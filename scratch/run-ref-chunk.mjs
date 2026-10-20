// scratch/run-ref-chunk.mjs
// Run a [start, start+count) slice of /tmp/motoi-ref-allcode.jsonl.
// Suppresses snippet display output. Prints "PASS n FAIL m" to stderr.
// Appends failures (as JSONL) to /tmp/motoi-ref-failures.jsonl.
// Usage: node scratch/run-ref-chunk.mjs <start> <count>

import { readFile, appendFile } from 'node:fs/promises'
import { parse } from '../src/reader.js'
import { evaluate } from '../src/interp.js'
import { makeCoreEnv } from '../core/index.js'
import { expandProgram } from '../src/macro.js'

const start = parseInt(process.argv[2] || '0', 10)
const count = parseInt(process.argv[3] || '500', 10)

const raw = await readFile('/tmp/motoi-ref-allcode.jsonl', 'utf8')
const all = raw.split('\n').filter(Boolean).map(l => JSON.parse(l))
const slice = all.slice(start, start + count)

// Suppress display/side-effect stdout from snippets.
const realWrite = process.stdout.write.bind(process.stdout)
process.stdout.write = () => true

function evalSource(src, fuelBudget = 200000) {
  const env = makeCoreEnv({ fuel: { n: fuelBudget } })
  const forms = parse(src)
  const { forms: expanded } = expandProgram(forms, { fuel: { n: fuelBudget } })
  const fuel = { n: fuelBudget }
  let result
  for (const f of expanded) result = evaluate(f, env, fuel)
  return result
}

let pass = 0
const fails = []
for (const it of slice) {
  try { evalSource(it.code); pass++ }
  catch (e) { fails.push({ ...it, error: (e && e.message) || String(e) }) }
}

process.stdout.write = realWrite
if (fails.length) await appendFile('/tmp/motoi-ref-failures.jsonl', fails.map(f => JSON.stringify(f)).join('\n') + '\n')
process.stderr.write(`PASS ${pass} FAIL ${fails.length}\n`)
