// scratch/smoke-reference-examples.mjs
//
// Pick N examples from /tmp/motoi-ref-examples.jsonl and try to evaluate
// each via evalSource (same path as `motoi eval "..."`). Report pass/fail.
//
// Usage: node scratch/smoke-reference-examples.mjs [N] [SEED]

import { readFile } from 'node:fs/promises'
import { parse } from '../src/reader.js'
import { evaluate } from '../src/interp.js'
import { makeCoreEnv } from '../core/index.js'
import { expandProgram } from '../src/macro.js'

const N = parseInt(process.argv[2] || '100', 10)
const SEED = parseInt(process.argv[3] || '42', 10)

// Load examples.
const raw = await readFile('/tmp/motoi-ref-examples.jsonl', 'utf8')
const all = raw.split('\n').filter(Boolean).map((l) => JSON.parse(l))
process.stderr.write(`total examples: ${all.length}\n`)

// Deterministic shuffle with a seed (mulberry32).
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rng = mulberry32(SEED)
const shuffled = [...all]
for (let i = shuffled.length - 1; i > 0; i--) {
  const j = Math.floor(rng() * (i + 1))
  ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
}
const picks = shuffled.slice(0, N)

function evalSource(src, fuelBudget = 200000) {
  const env = makeCoreEnv({ fuel: { n: fuelBudget } })
  const forms = parse(src)
  const { forms: expanded } = expandProgram(forms, { fuel: { n: fuelBudget } })
  const fuel = { n: fuelBudget }
  let result
  for (const f of expanded) result = evaluate(f, env, fuel)
  return result
}

const passes = []
const fails = []

for (const ex of picks) {
  try {
    evalSource(ex.code)
    passes.push(ex)
  } catch (e) {
    fails.push({ ...ex, error: (e && e.message) || String(e) })
  }
}

process.stderr.write(`\n=== SMOKE TEST RESULTS ===\n`)
process.stderr.write(`sampled: ${N}\n`)
process.stderr.write(`pass:    ${passes.length}\n`)
process.stderr.write(`fail:    ${fails.length}\n`)
process.stderr.write(`rate:    ${((passes.length / N) * 100).toFixed(1)}%\n\n`)

// Categorize failure reasons.
const buckets = {}
for (const f of fails) {
  const m = f.error.match(/unbound symbol: ([^\s]+)/)
  if (m) {
    const key = `unbound: ${m[1]}`
    buckets[key] = (buckets[key] || 0) + 1
    continue
  }
  const m2 = f.error.match(/^([^:\n]+)/)
  const key = m2 ? m2[1].slice(0, 60) : f.error.slice(0, 60)
  buckets[key] = (buckets[key] || 0) + 1
}
const ranked = Object.entries(buckets).sort((a, b) => b[1] - a[1])
process.stderr.write(`=== FAILURE PATTERNS (top 20) ===\n`)
for (const [k, n] of ranked.slice(0, 20)) {
  process.stderr.write(`${String(n).padStart(4)}  ${k}\n`)
}

// Emit JSONL for downstream analysis.
process.stdout.write(JSON.stringify({ sampled: N, pass: passes.length, fail: fails.length }) + '\n')
for (const f of fails) process.stdout.write(JSON.stringify({ kind: 'fail', ...f }) + '\n')
