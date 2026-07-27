#!/usr/bin/env node
// probe-composition.mjs — Composition probe over Motoi Mk1 SFT adapter.
//
// Fires each composition prompt (from composition-prompts.jsonl) through a
// PERSISTENT MLX worker (one model load), scores four categories:
//
//   strict_pass — primary_verb as (verb ...) AND at least one related_verb as call
//   partial_pass — primary as call but no related, OR related as call but no primary
//   confabulation_fail — output contains any verb name NOT in the catalog
//                        (in call position) — invented API surface, the same
//                        failure mode we saw on the code probe with cell/at.
//   full_fail — none of the above (no verbs appear at all, or output is empty)
//
// Streams progress every 25 prompts (8 batches total for 200).
//
// Args:
//   --prompts PATH   composition-prompts.jsonl input
//   --catalog PATH   composition-verb-catalog.jsonl (known verb names)
//   --adapter PATH   adapter DIR (contains adapter_config.json + adapters.safetensors)
//   --stream PATH    _composition_stream.log
//   --results PATH   composition-results.jsonl
//   --max-tokens N   optional (default 256 — code prompts need more room than recall)

import { spawn } from 'node:child_process'
import { readFileSync, openSync, writeSync, fsyncSync, closeSync } from 'node:fs'

const args = parseArgs(process.argv)
const PROMPTS = args.prompts
const CATALOG = args.catalog
const ADAPTER = args.adapter
const STREAM = args.stream
const RESULTS = args.results
const MAX_TOKENS = args.maxTokens || 256
const BATCH_SIZE = 25
const TIME_BUDGET_MIN = 90

function parseArgs(argv) {
  const a = { prompts: null, catalog: null, adapter: null, stream: null, results: null, maxTokens: 256 }
  for (let i = 2; i < argv.length; i++) {
    const t = argv[i]
    if (t === '--prompts') a.prompts = argv[++i]
    else if (t === '--catalog') a.catalog = argv[++i]
    else if (t === '--adapter') a.adapter = argv[++i]
    else if (t === '--stream') a.stream = argv[++i]
    else if (t === '--results') a.results = argv[++i]
    else if (t === '--max-tokens') a.maxTokens = parseInt(argv[++i], 10)
  }
  for (const k of ['prompts', 'catalog', 'adapter', 'stream', 'results']) {
    if (!a[k]) { console.error(`missing --${k}`); process.exit(2) }
  }
  return a
}

// ── scoring ────────────────────────────────────────────────────────

// Match `(verb ...)` — verb in call position — whole word after paren.
function callFormRegex(verb) {
  const escaped = verb.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\(\\s*${escaped}(\\s|\\)|$)`, '')
}

function isCallForm(response, verb) {
  return callFormRegex(verb).test(response || '')
}

// Extract every verb-like head-of-list token from the response. A verb-token
// is what appears immediately after `(` when the position is call-form:
//   (foo ...) or (foo/bar ...) or (foo-bar-baz ...) — Scheme identifier chars.
// We deliberately allow `/` and `-` and `?` and `!` since those are standard
// Motoi/Scheme verb name chars.
function extractCalledVerbs(response) {
  if (!response) return []
  // Match `( <optional-ws> <ident>` where <ident> is a symbol char sequence.
  const re = /\(\s*([A-Za-z_][A-Za-z0-9_\-/?!]*)(?=[\s()])/g
  const out = new Set()
  let m
  while ((m = re.exec(response)) !== null) {
    out.add(m[1])
  }
  return Array.from(out)
}

// Scheme special forms + built-in operators that are always OK to see, even
// if they aren't in the reference. This whitelist is intentionally narrow:
// only "keywords" of the language, not domain verbs.
const SCHEME_KEYWORDS = new Set([
  'define', 'define-syntax', 'define-record-type', 'define-values',
  'lambda', 'let', 'let*', 'letrec', 'letrec*', 'let-values', 'let*-values',
  'if', 'cond', 'case', 'when', 'unless', 'and', 'or', 'not',
  'begin', 'do', 'quote', 'quasiquote', 'unquote', 'unquote-splicing',
  'set!', 'delay', 'force', 'parameterize', 'guard', 'raise',
  'else', '=>',
  // arithmetic + comparison operators (heads of `(+ 1 2)` etc.)
  '+', '-', '*', '/', '<', '>', '<=', '>=', '=', 'mod', 'modulo', 'quotient',
  'remainder', 'abs', 'min', 'max', 'expt', 'sqrt', 'square', 'floor',
  'ceiling', 'round', 'truncate', 'exp', 'log', 'sin', 'cos', 'tan',
  // classic scheme list / control that appears in nearly every code fragment
  'car', 'cdr', 'cons', 'list', 'list?', 'null?', 'pair?', 'append',
  'length', 'reverse', 'map', 'filter', 'for-each', 'fold', 'fold-left',
  'fold-right', 'reduce', 'apply', 'eq?', 'equal?', 'eqv?',
  'number?', 'string?', 'symbol?', 'boolean?', 'procedure?', 'zero?',
  'positive?', 'negative?', 'odd?', 'even?',
  'display', 'newline', 'write', 'read', 'error',
  // number literals sometimes get parsed
  // (skipped — we already require identifier-start-char in the regex)
])

// Extract names locally defined in the response via `(define (NAME ...))` or
// `(define NAME ...)` or `(let ((NAME ...)) ...)` / `(let* ...)` / `(letrec ...)`.
// These are user bindings, NOT calls to invented APIs.
function extractLocallyBoundNames(response) {
  if (!response) return []
  const out = new Set()
  // (define (name ...))
  const re1 = /\(\s*define\s+\(\s*([A-Za-z_][A-Za-z0-9_\-/?!]*)/g
  // (define name ...)
  const re2 = /\(\s*define\s+([A-Za-z_][A-Za-z0-9_\-/?!]*)\s/g
  // (let ((name ...)) ...) or (let* ((...)) ...) or (letrec ...)
  //   We match ((name  after let/let*/letrec.
  const re3 = /\(\s*(?:let|let\*|letrec|letrec\*)\s*\(\s*\(\s*([A-Za-z_][A-Za-z0-9_\-/?!]*)/g
  // Also handle lambda param positions — but those are hard to spot without
  // full parse. We accept the imperfection: params-as-calls happens rarely.
  for (const re of [re1, re2, re3]) {
    let m
    while ((m = re.exec(response)) !== null) out.add(m[1])
  }
  return Array.from(out)
}

function scoreOne(response, promptRow, catalog) {
  const primary = promptRow.primary_verb
  const related = promptRow.related || []

  const primaryCalled = isCallForm(response, primary)
  const relatedCalled = related.some(r => isCallForm(response, r))

  // Confabulation detection: any called-verb that is NOT in
  //   catalog ∪ scheme-keywords ∪ primary ∪ related ∪ locally-defined-names
  // is an invented verb. Note: primary + related are already in the catalog
  // (we filtered), but include them for defensive scoring.
  const localBindings = extractLocallyBoundNames(response)
  const allowed = new Set([
    ...catalog,
    ...SCHEME_KEYWORDS,
    ...localBindings,
    primary,
    ...related,
  ])
  const called = extractCalledVerbs(response)
  const confabulated = called.filter(v => !allowed.has(v))

  let category
  if (primaryCalled && relatedCalled) category = 'strict_pass'
  else if (primaryCalled || relatedCalled) category = 'partial_pass'
  else if (confabulated.length > 0) category = 'confabulation_fail'
  else category = 'full_fail'

  // Confab-flag runs INDEPENDENTLY of the pass categories: even a strict-pass
  // may have accidental confabulation elsewhere in the output. We track both
  // the primary category AND whether any confab tokens appeared.
  return {
    category,
    primary_called: primaryCalled,
    related_called: relatedCalled,
    called_verbs: called,
    confabulated_verbs: confabulated,
    has_confab: confabulated.length > 0,
  }
}

// ── prompt + catalog loading ───────────────────────────────────────

function loadPrompts(path) {
  const text = readFileSync(path, 'utf8')
  return text.split('\n').filter(l => l.trim()).map(l => JSON.parse(l))
}

function loadCatalog(path) {
  const text = readFileSync(path, 'utf8')
  const set = new Set()
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    try {
      const row = JSON.parse(line)
      if (row.verb) set.add(row.verb)
    } catch {}
  }
  return set
}

// ── MLX worker (identical to per-verb probe) ────────────────────────

class MLXWorker {
  constructor(adapter, maxTokens) {
    this.adapter = adapter
    this.maxTokens = maxTokens
    this.pending = new Map()
    this.buf = ''
    this.ready = false
    this.deadPromise = null
  }
  start() {
    const py = '/Users/alfred/code/forge/.venv/bin/python'
    const scriptPath = '/Users/alfred/code/motoi-scheme/scripts/probe-mlx-worker.py'
    this.proc = spawn(py, [scriptPath, '--adapter', this.adapter, '--max-tokens', String(this.maxTokens)], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    this.proc.stdout.setEncoding('utf8')
    this.proc.stderr.setEncoding('utf8')
    this.proc.stdout.on('data', d => this.onStdout(d))
    this.proc.stderr.on('data', d => process.stderr.write(`[worker-stderr] ${d}`))
    this.deadPromise = new Promise(resolve => {
      this.proc.on('exit', code => {
        for (const [id, p] of this.pending) p.reject(new Error(`worker exited ${code}`))
        this.pending.clear()
        resolve(code)
      })
    })
    return new Promise((resolve, reject) => {
      this.onReady = { resolve, reject }
    })
  }
  onStdout(chunk) {
    this.buf += chunk
    let idx
    while ((idx = this.buf.indexOf('\n')) !== -1) {
      const line = this.buf.slice(0, idx)
      this.buf = this.buf.slice(idx + 1)
      if (!line.trim()) continue
      let msg
      try { msg = JSON.parse(line) } catch {
        process.stderr.write(`[worker-parse-error] ${line.slice(0, 200)}\n`)
        continue
      }
      if (msg._ready) {
        this.ready = true
        this.onReady?.resolve(msg)
        continue
      }
      if (msg._startup_error) {
        this.onReady?.reject(new Error(msg._startup_error))
        continue
      }
      const id = msg.id
      const p = this.pending.get(id)
      if (p) {
        this.pending.delete(id)
        if (msg.error) p.reject(new Error(msg.error))
        else p.resolve(msg.text || '')
      }
    }
  }
  generate(id, prompt) {
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      const line = JSON.stringify({ id, prompt }) + '\n'
      this.proc.stdin.write(line)
    })
  }
  close() {
    try { this.proc.stdin.end() } catch {}
  }
}

// ── streaming utilities ────────────────────────────────────────────

class StreamLog {
  constructor(path) { this.fd = openSync(path, 'a') }
  writeLine(line) { writeSync(this.fd, line + '\n'); fsyncSync(this.fd) }
  close() { closeSync(this.fd) }
}
class ResultsLog {
  constructor(path) { this.fd = openSync(path, 'a') }
  writeRow(obj) { writeSync(this.fd, JSON.stringify(obj) + '\n'); fsyncSync(this.fd) }
  close() { closeSync(this.fd) }
}

// ── main ───────────────────────────────────────────────────────────

async function main() {
  const t0 = Date.now()
  console.log(`probe-composition starting`)
  console.log(`  prompts:  ${PROMPTS}`)
  console.log(`  catalog:  ${CATALOG}`)
  console.log(`  adapter:  ${ADAPTER}`)
  console.log(`  stream:   ${STREAM}`)
  console.log(`  results:  ${RESULTS}`)
  console.log(`  max-tokens: ${MAX_TOKENS}`)

  const prompts = loadPrompts(PROMPTS)
  const catalog = loadCatalog(CATALOG)
  console.log(`Loaded ${prompts.length} composition prompts, ${catalog.size} verbs in catalog`)

  const totalBatches = Math.ceil(prompts.length / BATCH_SIZE)

  const worker = new MLXWorker(ADAPTER, MAX_TOKENS)
  const startPromise = worker.start()
  console.log(`Loading MLX model + adapter...`)
  const ready = await startPromise
  const tLoad = Date.now()
  console.log(`Model ready in ${((tLoad - t0) / 1000).toFixed(1)}s`)

  const streamLog = new StreamLog(STREAM)
  const resultsLog = new ResultsLog(RESULTS)

  streamLog.writeLine(`COMP BOOT · adapter=${ADAPTER} · prompts=${prompts.length} · batches=${totalBatches} · load-time=${((tLoad-t0)/1000).toFixed(1)}s`)
  process.stdout.write(`Streaming to ${STREAM}\n`)

  let running = { strict: 0, partial: 0, confab: 0, fail: 0, n: 0, confabAny: 0 }

  for (let bi = 0; bi < totalBatches; bi++) {
    const start = bi * BATCH_SIZE
    const end = Math.min(start + BATCH_SIZE, prompts.length)
    const batch = prompts.slice(start, end)
    const batchNum = bi + 1

    let bStrict = 0, bPartial = 0, bConfab = 0, bFail = 0, bConfabAny = 0

    for (const p of batch) {
      let response = ''
      try {
        response = await worker.generate(p.id, p.prompt)
      } catch {
        response = ''
      }
      const scored = scoreOne(response, p, catalog)
      if (scored.category === 'strict_pass') bStrict++
      else if (scored.category === 'partial_pass') bPartial++
      else if (scored.category === 'confabulation_fail') bConfab++
      else bFail++
      if (scored.has_confab) bConfabAny++

      resultsLog.writeRow({
        id: p.id,
        primary_verb: p.primary_verb,
        library: p.library,
        related: p.related,
        tier: p.tier,
        response,
        category: scored.category,
        primary_called: scored.primary_called,
        related_called: scored.related_called,
        called_verbs: scored.called_verbs,
        confabulated_verbs: scored.confabulated_verbs,
        has_confab: scored.has_confab,
      })
    }

    running.strict += bStrict
    running.partial += bPartial
    running.confab += bConfab
    running.fail += bFail
    running.confabAny += bConfabAny
    running.n += batch.length

    const line = `COMP BATCH ${batchNum}/${totalBatches} · strict ${bStrict}/${batch.length} · partial ${bPartial}/${batch.length} · CONFAB ${bConfab}/${batch.length} · fail ${bFail}/${batch.length} · running total: ${running.strict}/${running.partial}/${running.confab}/${running.fail} out of ${running.n} (any-confab ${running.confabAny})`
    streamLog.writeLine(line)
    process.stdout.write(line + '\n')

    const elapsedMin = (Date.now() - t0) / 60000
    if (elapsedMin > TIME_BUDGET_MIN) {
      const stopMsg = `STOP · time budget exceeded (${elapsedMin.toFixed(1)}min > ${TIME_BUDGET_MIN}min) · stopping after batch ${batchNum}`
      streamLog.writeLine(stopMsg)
      process.stdout.write(stopMsg + '\n')
      break
    }
  }

  const finalMsg = `COMP DONE · n=${running.n}/${prompts.length} · strict=${running.strict} · partial=${running.partial} · confab-primary=${running.confab} · fail=${running.fail} · any-confab=${running.confabAny} · elapsed=${((Date.now()-t0)/60000).toFixed(1)}min`
  streamLog.writeLine(finalMsg)
  process.stdout.write(finalMsg + '\n')

  worker.close()
  streamLog.close()
  resultsLog.close()
}

main().catch(err => {
  console.error('probe-composition error:', err)
  process.exit(1)
})
