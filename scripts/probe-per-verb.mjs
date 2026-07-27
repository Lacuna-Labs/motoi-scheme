#!/usr/bin/env node
// probe-per-verb.mjs — Per-verb probe runner over Motoi Mk1 SFT adapter.
//
// Fires all 3,237 prompts through a PERSISTENT MLX worker (one model load),
// scores each shape (recall/signature/use) deterministically, streams progress
// to a batch log every 25 verbs, and writes per-verb results to jsonl.
//
// Args:
//   --prompts PATH   prompts.jsonl input
//   --adapter PATH   adapter DIR (contains adapter_config.json + adapters.safetensors)
//   --stream PATH    per-batch stream log (append)
//   --results PATH   per-verb results.jsonl (write)
//   --max-tokens N   optional (default 160)
//
// Streaming discipline:
//   - flush stdout after every batch line
//   - flush stream-log file with fsync after every batch line
//   - process verbs in batches of 25 (75 prompts per batch)

import { spawn } from 'node:child_process'
import { readFileSync, openSync, writeSync, fsyncSync, closeSync, existsSync } from 'node:fs'
import { createInterface } from 'node:readline'

const args = parseArgs(process.argv)
const PROMPTS = args.prompts
const ADAPTER = args.adapter
const STREAM = args.stream
const RESULTS = args.results
const MAX_TOKENS = args.maxTokens || 160
const BATCH_SIZE = 25 // verbs per batch (75 prompts)
const TIME_BUDGET_MIN = 90

function parseArgs(argv) {
  const a = { prompts: null, adapter: null, stream: null, results: null, maxTokens: 160 }
  for (let i = 2; i < argv.length; i++) {
    const t = argv[i]
    if (t === '--prompts') a.prompts = argv[++i]
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

// ── scoring ────────────────────────────────────────────────────────

function normWS(s) {
  return (s || '').replace(/\s+/g, ' ').trim()
}

function scoreRecall(response, expectedVerb) {
  // Whole word, case-insensitive
  const escaped = expectedVerb.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(^|[^\\w-])${escaped}([^\\w-]|$)`, 'i')
  return re.test(response || '')
}

function scoreSignature(response, expectedSig) {
  if (!expectedSig) return false
  const normResp = normWS(response).toLowerCase()
  const normExp = normWS(expectedSig).toLowerCase()
  return normResp.includes(normExp)
}

function scoreUse(response, expectedVerb) {
  // Look for (<verb> ...) — exact verb, in call position, whole-word after paren
  const escaped = expectedVerb.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`\\(\\s*${escaped}(\\s|\\)|$)`, '')
  return re.test(response || '')
}

// ── prompt loading ─────────────────────────────────────────────────

function loadPrompts(path) {
  const text = readFileSync(path, 'utf8')
  const rows = text.split('\n').filter(l => l.trim()).map(l => JSON.parse(l))
  // Group by (library, verb) preserving file order; prompts.jsonl is emitted
  // as 3 consecutive rows (recall, signature, use) per verb.
  const byVerb = new Map()
  for (const r of rows) {
    const key = `${r.library}::${r.verb}`
    if (!byVerb.has(key)) byVerb.set(key, { verb: r.verb, library: r.library, prompts: [] })
    byVerb.get(key).prompts.push(r)
  }
  // Guard: warn if any verb doesn't have exactly 3 prompts
  let bad = 0
  for (const [k, v] of byVerb) if (v.prompts.length !== 3) bad++
  if (bad > 0) console.error(`WARN: ${bad} verbs with != 3 prompts (grouping key collision?)`)
  return Array.from(byVerb.values())
}

// ── worker ─────────────────────────────────────────────────────────

class MLXWorker {
  constructor(adapter, maxTokens) {
    this.adapter = adapter
    this.maxTokens = maxTokens
    this.pending = new Map() // id -> { resolve, reject }
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
      try { msg = JSON.parse(line) } catch (e) {
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
  constructor(path) {
    this.fd = openSync(path, 'a')
  }
  writeLine(line) {
    writeSync(this.fd, line + '\n')
    fsyncSync(this.fd)
  }
  close() { closeSync(this.fd) }
}

class ResultsLog {
  constructor(path) {
    this.fd = openSync(path, 'a')
  }
  writeRow(obj) {
    writeSync(this.fd, JSON.stringify(obj) + '\n')
    fsyncSync(this.fd)
  }
  close() { closeSync(this.fd) }
}

// ── main ───────────────────────────────────────────────────────────

async function main() {
  const t0 = Date.now()
  console.log(`probe-per-verb starting`)
  console.log(`  prompts: ${PROMPTS}`)
  console.log(`  adapter: ${ADAPTER}`)
  console.log(`  stream:  ${STREAM}`)
  console.log(`  results: ${RESULTS}`)
  console.log(`  max-tokens: ${MAX_TOKENS}`)

  const verbs = loadPrompts(PROMPTS)
  console.log(`Loaded ${verbs.length} verbs (${verbs.reduce((a,v)=>a+v.prompts.length,0)} prompts total)`)

  const totalBatches = Math.ceil(verbs.length / BATCH_SIZE)

  // Start worker
  const worker = new MLXWorker(ADAPTER, MAX_TOKENS)
  const startPromise = worker.start()
  console.log(`Loading MLX model + adapter...`)
  const ready = await startPromise
  const tLoad = Date.now()
  console.log(`Model ready in ${((tLoad - t0) / 1000).toFixed(1)}s`)

  const streamLog = new StreamLog(STREAM)
  const resultsLog = new ResultsLog(RESULTS)

  // Kick off — write a boot line so parent can see us
  streamLog.writeLine(`BOOT · adapter=${ADAPTER} · verbs=${verbs.length} · batches=${totalBatches} · load-time=${((tLoad-t0)/1000).toFixed(1)}s`)
  process.stdout.write(`Streaming to ${STREAM}\n`)

  let running = { recall: 0, sig: 0, use: 0, n: 0 }

  for (let bi = 0; bi < totalBatches; bi++) {
    const startVerb = bi * BATCH_SIZE
    const endVerb = Math.min(startVerb + BATCH_SIZE, verbs.length)
    const batch = verbs.slice(startVerb, endVerb)
    const batchNum = bi + 1

    let bRecall = 0, bSig = 0, bUse = 0

    // Fire prompts serially (mlx_lm.generate is single-threaded on Metal anyway)
    for (const v of batch) {
      const scores = { verb: v.verb, library: v.library, recall: false, sig: false, use: false }
      for (const p of v.prompts) {
        let response = ''
        try {
          response = await worker.generate(p.id, p.prompt)
        } catch (e) {
          response = ''
          // continue — score as fail
        }
        if (p.shape === 'recall') {
          scores.recall = scoreRecall(response, p.expected_verb)
        } else if (p.shape === 'signature') {
          scores.sig = scoreSignature(response, p.expected_signature)
        } else if (p.shape === 'use') {
          scores.use = scoreUse(response, p.expected_verb)
        }
      }
      if (scores.recall) bRecall++
      if (scores.sig) bSig++
      if (scores.use) bUse++
      resultsLog.writeRow(scores)
    }

    running.recall += bRecall
    running.sig += bSig
    running.use += bUse
    running.n += batch.length

    const line = `BATCH ${batchNum}/${totalBatches} · verbs ${startVerb + 1}-${endVerb} · recall ${bRecall}/${batch.length} · sig ${bSig}/${batch.length} · use ${bUse}/${batch.length} · running total: ${running.recall}/${running.sig}/${running.use} out of ${running.n}`
    streamLog.writeLine(line)
    process.stdout.write(line + '\n')

    // Time budget guard
    const elapsedMin = (Date.now() - t0) / 60000
    if (elapsedMin > TIME_BUDGET_MIN) {
      const stopMsg = `STOP · time budget exceeded (${elapsedMin.toFixed(1)}min > ${TIME_BUDGET_MIN}min) · stopping after batch ${batchNum}`
      streamLog.writeLine(stopMsg)
      process.stdout.write(stopMsg + '\n')
      break
    }
  }

  const finalMsg = `DONE · verbs=${running.n}/${verbs.length} · recall=${running.recall} · sig=${running.sig} · use=${running.use} · elapsed=${((Date.now()-t0)/60000).toFixed(1)}min`
  streamLog.writeLine(finalMsg)
  process.stdout.write(finalMsg + '\n')

  worker.close()
  streamLog.close()
  resultsLog.close()
}

main().catch(err => {
  console.error('probe-per-verb error:', err)
  process.exit(1)
})
