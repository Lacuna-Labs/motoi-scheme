// ram-profile.mjs — per-block fuel profile of one book chapter.
// Usage: node scratch/ram-profile.mjs <blocks.json> [budget]
// blocks.json is [{key, code}, ...] in chapter order (emitted by ram-blocks.py).
// Evaluates blocks sequentially in ONE env with ONE fuel counter (this is what
// the chapter-scoped audit gate effectively measures) and prints per-block cost.
import { readFileSync } from 'node:fs'
import { parse } from '../src/reader.js'
import { evaluate } from '../src/interp.js'
import { makeCoreEnv } from '../core/index.js'
import { expandProgram } from '../src/macro.js'

const blocks = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const budget = Number(process.argv[3] || 200000)
const fuel = { n: budget }
const env = makeCoreEnv({ fuel })
const boot = budget - fuel.n
console.log(`boot=${boot}`)
let prev = fuel.n
for (const b of blocks) {
  let note = 'ok'
  try {
    const { forms } = expandProgram(parse(b.code), { fuel })
    for (const f of forms) evaluate(f, env, fuel)
  } catch (err) {
    note = String(err && err.message || err).split('\n')[0]
  }
  const used = prev - fuel.n
  prev = fuel.n
  console.log(`${String(used).padStart(9)}  ${b.key.padEnd(18)}  ${note}`)
  if (fuel.n < 0) { console.log('  (fuel gone — remaining blocks not run)'); break }
}
console.log(`total=${budget - fuel.n}`)
