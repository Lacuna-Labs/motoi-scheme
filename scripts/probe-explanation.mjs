#!/usr/bin/env node
// probe-explanation.mjs — Explanation-axis probe over Motoi Mk1 SFT adapter.
//
// Fires 500 prompts (100 verbs × 5 rows) through a PERSISTENT MLX worker,
// scores each row deterministically against per-verb metadata (:signature,
// :summary, :examples[:note], :related), streams progress every 25 verbs
// (125 prompts / batch, 4 batches total), and writes per-prompt results
// to jsonl.
//
// Args:
//   --prompts PATH   prompts.jsonl input (500 rows)
//   --verbs PATH     verbs.jsonl (100 rows — for scoring metadata)  [optional; defaults next to prompts]
//   --adapter PATH   adapter file OR directory (staged into a scratch dir if raw .safetensors)
//   --stream PATH    per-batch stream log (append)
//   --results PATH   per-prompt results.jsonl (write, append)
//   --max-tokens N   optional (default 300 — explanations are longer than one-liners)
//
// Streaming discipline: flush stdout + fsync stream-log per batch line.

import { spawn } from 'node:child_process'
import { readFileSync, openSync, writeSync, fsyncSync, closeSync, existsSync, mkdirSync, symlinkSync, writeFileSync, statSync, unlinkSync } from 'node:fs'
import { dirname, join, basename } from 'node:path'

const args = parseArgs(process.argv)
const PROMPTS = args.prompts
const VERBS = args.verbs || join(dirname(PROMPTS), 'verbs.jsonl')
const ADAPTER_ARG = args.adapter
const STREAM = args.stream
const RESULTS = args.results
const MAX_TOKENS = args.maxTokens || 300
const BATCH_SIZE_VERBS = 25 // 125 prompts per batch, 4 batches
const TIME_BUDGET_MIN = 60

function parseArgs(argv) {
  const a = { prompts: null, verbs: null, adapter: null, stream: null, results: null, maxTokens: 300 }
  for (let i = 2; i < argv.length; i++) {
    const t = argv[i]
    if (t === '--prompts') a.prompts = argv[++i]
    else if (t === '--verbs') a.verbs = argv[++i]
    else if (t === '--adapter') a.adapter = argv[++i]
    else if (t === '--stream') a.stream = argv[++i]
    else if (t === '--results') a.results = argv[++i]
    else if (t === '--max-tokens') a.maxTokens = parseInt(argv[++i], 10)
  }
  for (const k of ['prompts', 'adapter', 'stream', 'results']) {
    if (!a[k]) { console.error(`missing --${k}`); process.exit(2) }
  }
  return a
}

// ── adapter staging: mlx_lm expects a DIRECTORY with adapter_config.json + adapters.safetensors ──

function stageAdapter(adapterArg) {
  const st = statSync(adapterArg)
  if (st.isDirectory()) return adapterArg
  // It's a file — stage a scratch dir next to it with a symlink named adapters.safetensors
  const stageDir = '/Users/alfred/.forge/runs/motoi-mk1/probe-explanation/adapter-staging'
  mkdirSync(stageDir, { recursive: true })
  const link = join(stageDir, 'adapters.safetensors')
  try {
    if (existsSync(link)) unlinkSync(link)
  } catch {}
  symlinkSync(adapterArg, link)
  // Copy adapter_config.json from the prior probe-per-verb staging if not present
  const cfgTarget = join(stageDir, 'adapter_config.json')
  if (!existsSync(cfgTarget)) {
    const priorCfg = '/Users/alfred/.forge/runs/motoi-mk1/probe-per-verb/adapter-staging/adapter_config.json'
    if (existsSync(priorCfg)) {
      const txt = readFileSync(priorCfg, 'utf8')
      writeFileSync(cfgTarget, txt)
    } else {
      // Fall back to the archived adapter_config.json
      const archCfg = '/Users/alfred/.forge/runs/motoi-mk1/_archive/mk1-sft-final-20260720.adapter_config.json'
      if (existsSync(archCfg)) {
        const txt = readFileSync(archCfg, 'utf8')
        writeFileSync(cfgTarget, txt)
      } else {
        console.error(`no adapter_config.json found (neither at ${priorCfg} nor ${archCfg})`)
        process.exit(3)
      }
    }
  }
  return stageDir
}

// ── prompt + verb loading ──────────────────────────────────────────

function loadPrompts(path) {
  return readFileSync(path, 'utf8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l))
}
function loadVerbs(path) {
  const rows = readFileSync(path, 'utf8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l))
  const byKey = new Map()
  for (const v of rows) byKey.set(`${v.library}::${v.verb}`, v)
  return byKey
}

// ── scoring, per row ───────────────────────────────────────────────

function normLower(s) { return (s || '').toLowerCase() }

function scoreRow1(response, meta) {
  // HOW pass = response contains at least one of: verbatim :signature, verbatim :summary,
  // OR a (<verb> ...) call form.
  const R = response || ''
  const RL = normLower(R)
  if (meta.signature && RL.includes(normLower(meta.signature))) return { pass: true, reason: 'contains verbatim signature' }
  if (meta.summary && RL.includes(normLower(meta.summary))) return { pass: true, reason: 'contains verbatim summary' }
  const escaped = meta.verb.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const callRe = new RegExp(`\\(\\s*${escaped}(\\s|\\)|$)`, '')
  if (callRe.test(R)) return { pass: true, reason: 'contains (verb ...) call form' }
  return { pass: false, reason: 'no signature/summary/call-form found' }
}

function tokensFromNote(note) {
  // Word-normalize: lowercase, strip punctuation, split
  return normLower(note).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean)
}

function scoreRow2(response, meta) {
  // WHEN pass = any :example :note word overlap >= 5, OR any of the trigger phrases.
  const R = response || ''
  const RL = normLower(R)
  const triggers = ['when you', 'if you need', 'use this', 'in situations where']
  for (const t of triggers) if (RL.includes(t)) return { pass: true, reason: `contains trigger phrase '${t}'` }
  // Word overlap ≥ 5 tokens between response and any example note
  const respTokens = new Set(tokensFromNote(R))
  for (const note of meta.example_notes || []) {
    const noteTokens = tokensFromNote(note)
    let overlap = 0
    const seenIn = new Set()
    for (const tok of noteTokens) {
      if (tok.length < 3) continue
      if (seenIn.has(tok)) continue
      if (respTokens.has(tok)) { overlap++; seenIn.add(tok) }
    }
    if (overlap >= 5) return { pass: true, reason: `word overlap=${overlap} with example note` }
  }
  return { pass: false, reason: 'no trigger phrase + no ≥5-word note overlap' }
}

function scoreRow3(response, meta) {
  // WHERE-ELSE pass = references at least one domain outside Motoi, OR uses any
  // :related verb in a context suggesting different-domain analogy.
  const R = response || ''
  const RL = normLower(R)
  const domains = ['python', 'javascript', 'unix', 'math', 'physics', 'orchestra', 'kitchen']
  for (const d of domains) {
    // whole-word-ish
    const re = new RegExp(`(^|[^a-z])${d}([^a-z]|$)`, 'i')
    if (re.test(R)) return { pass: true, reason: `references domain '${d}'` }
  }
  // :related verbs mentioned by name (as evidence of analogy, per brief)
  for (const rv of meta.related || []) {
    const escaped = rv.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`(^|[^\\w-])${escaped}([^\\w-]|$)`, 'i')
    if (re.test(R)) return { pass: true, reason: `mentions related verb '${rv}'` }
  }
  return { pass: false, reason: 'no external-domain reference + no :related verb mention' }
}

function scoreRow4(response, meta) {
  // WHY pass = contains one of the invariant/proof keywords.
  const R = response || ''
  const RL = normLower(R)
  const keys = ['invariant', 'guarantee', 'ensures', 'always', 'never', '∀', '∃', 'for all', 'assumes', 'property']
  for (const k of keys) {
    // Special-case unicode + multi-word — use plain lowercase substring match
    if (RL.includes(k.toLowerCase())) return { pass: true, reason: `contains proof keyword '${k}'` }
  }
  return { pass: false, reason: 'no invariant/property keyword found' }
}

function scoreRow5(response, meta) {
  // WITH-WHAT-ELSE pass = at least one :related verb in call form (related ...)
  const R = response || ''
  for (const rv of meta.related || []) {
    const escaped = rv.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`\\(\\s*${escaped}(\\s|\\)|$)`, '')
    if (re.test(R)) return { pass: true, reason: `contains (${rv} ...) call form` }
  }
  return { pass: false, reason: 'no :related verb in call form' }
}

function scoreForRow(row, response, meta) {
  if (row === 1) return scoreRow1(response, meta)
  if (row === 2) return scoreRow2(response, meta)
  if (row === 3) return scoreRow3(response, meta)
  if (row === 4) return scoreRow4(response, meta)
  if (row === 5) return scoreRow5(response, meta)
  return { pass: false, reason: `unknown row ${row}` }
}

// ── MLX worker (identical structure to probe-per-verb) ─────────────

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
    return new Promise((resolve, reject) => { this.onReady = { resolve, reject } })
  }
  onStdout(chunk) {
    this.buf += chunk
    let idx
    while ((idx = this.buf.indexOf('\n')) !== -1) {
      const line = this.buf.slice(0, idx)
      this.buf = this.buf.slice(idx + 1)
      if (!line.trim()) continue
      let msg
      try { msg = JSON.parse(line) } catch (e) {
        process.stderr.write(`[worker-parse-error] ${line.slice(0, 200)}\n`)
        continue
      }
      if (msg._ready) { this.ready = true; this.onReady?.resolve(msg); continue }
      if (msg._startup_error) { this.onReady?.reject(new Error(msg._startup_error)); continue }
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
      this.proc.stdin.write(JSON.stringify({ id, prompt }) + '\n')
    })
  }
  close() { try { this.proc.stdin.end() } catch {} }
}

// ── logging helpers ────────────────────────────────────────────────

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
  console.log(`probe-explanation starting`)
  console.log(`  prompts: ${PROMPTS}`)
  console.log(`  verbs:   ${VERBS}`)
  console.log(`  adapter: ${ADAPTER_ARG}`)
  console.log(`  stream:  ${STREAM}`)
  console.log(`  results: ${RESULTS}`)
  console.log(`  max-tokens: ${MAX_TOKENS}`)

  const ADAPTER = stageAdapter(ADAPTER_ARG)
  console.log(`  staged adapter dir: ${ADAPTER}`)

  const prompts = loadPrompts(PROMPTS)
  const verbMeta = loadVerbs(VERBS)
  console.log(`Loaded ${prompts.length} prompts across ${verbMeta.size} verbs`)

  // Group prompts by verb, preserving prompt order
  const byVerb = []
  const seenVerbs = new Set()
  const groups = new Map()
  for (const p of prompts) {
    const key = `${p.library}::${p.verb}`
    if (!groups.has(key)) { groups.set(key, []); byVerb.push(key) }
    groups.get(key).push(p)
  }
  console.log(`Grouped into ${byVerb.length} verbs`)

  const totalBatches = Math.ceil(byVerb.length / BATCH_SIZE_VERBS)

  const worker = new MLXWorker(ADAPTER, MAX_TOKENS)
  const startPromise = worker.start()
  console.log(`Loading MLX model + adapter...`)
  const ready = await startPromise
  const tLoad = Date.now()
  console.log(`Model ready in ${((tLoad - t0) / 1000).toFixed(1)}s`)

  const streamLog = new StreamLog(STREAM)
  const resultsLog = new ResultsLog(RESULTS)

  streamLog.writeLine(`BOOT · adapter=${ADAPTER_ARG} · verbs=${byVerb.length} · batches=${totalBatches} · load-time=${((tLoad-t0)/1000).toFixed(1)}s`)
  process.stdout.write(`Streaming to ${STREAM}\n`)

  const running = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, n: 0 }

  for (let bi = 0; bi < totalBatches; bi++) {
    const startI = bi * BATCH_SIZE_VERBS
    const endI = Math.min(startI + BATCH_SIZE_VERBS, byVerb.length)
    const batchKeys = byVerb.slice(startI, endI)
    const batchNum = bi + 1
    const bScores = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }

    for (const key of batchKeys) {
      const verbPrompts = groups.get(key)
      const meta = verbMeta.get(key)
      if (!meta) {
        process.stderr.write(`WARN: no metadata for ${key}\n`)
      }
      for (const p of verbPrompts) {
        let response = ''
        try {
          response = await worker.generate(p.id, p.prompt)
        } catch (e) {
          response = ''
        }
        const scoring = scoreForRow(p.row, response, meta || { verb: p.verb, related: [], example_notes: [] })
        if (scoring.pass) bScores[p.row]++
        resultsLog.writeRow({
          verb: p.verb,
          library: p.library,
          row: p.row,
          prompt: p.prompt,
          response,
          pass: scoring.pass,
          reason: scoring.reason,
        })
      }
    }

    for (const r of [1, 2, 3, 4, 5]) running[r] += bScores[r]
    running.n += batchKeys.length

    const line = `EXPL BATCH ${batchNum}/${totalBatches} · row1 ${bScores[1]}/${batchKeys.length} · row2 ${bScores[2]}/${batchKeys.length} · row3 ${bScores[3]}/${batchKeys.length} · row4 ${bScores[4]}/${batchKeys.length} · row5 ${bScores[5]}/${batchKeys.length} · running: ${running[1]}/${running[2]}/${running[3]}/${running[4]}/${running[5]} of ${running.n}`
    streamLog.writeLine(line)
    process.stdout.write(line + '\n')

    const elapsedMin = (Date.now() - t0) / 60000
    if (elapsedMin > TIME_BUDGET_MIN) {
      const stopMsg = `STOP · time budget exceeded (${elapsedMin.toFixed(1)}min > ${TIME_BUDGET_MIN}min) · after batch ${batchNum}`
      streamLog.writeLine(stopMsg)
      process.stdout.write(stopMsg + '\n')
      break
    }
  }

  const total = running.n * 5
  const passSum = running[1] + running[2] + running[3] + running[4] + running[5]
  const overall = total > 0 ? (100 * passSum / total).toFixed(1) : 'n/a'
  const rowPct = r => running.n > 0 ? (100 * running[r] / running.n).toFixed(1) : 'n/a'
  const finalMsg = `DONE · verbs=${running.n}/${byVerb.length} · row1=${running[1]}(${rowPct(1)}%) · row2=${running[2]}(${rowPct(2)}%) · row3=${running[3]}(${rowPct(3)}%) · row4=${running[4]}(${rowPct(4)}%) · row5=${running[5]}(${rowPct(5)}%) · overall=${overall}% · elapsed=${((Date.now()-t0)/60000).toFixed(1)}min`
  streamLog.writeLine(finalMsg)
  process.stdout.write(finalMsg + '\n')

  worker.close()
  streamLog.close()
  resultsLog.close()
}

main().catch(err => {
  console.error('probe-explanation error:', err)
  process.exit(1)
})
