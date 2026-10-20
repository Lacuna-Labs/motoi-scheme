// ram-fuel.mjs — report fuel CONSUMED by a Scheme source file.
// Usage: node scratch/ram-fuel.mjs <file.scm> [budget]
// Prints "used=<n> budget=<b>" or "EXHAUSTED budget=<b>" / "ERROR <msg>".
import { readFileSync } from 'node:fs'
import { parse } from '../src/reader.js'
import { evaluate } from '../src/interp.js'
import { makeCoreEnv } from '../core/index.js'
import { expandProgram } from '../src/macro.js'

const file = process.argv[2]
const budget = Number(process.argv[3] || 200000)
const src = readFileSync(file, 'utf8')
try {
  // NOTE: src/cli.js hands makeCoreEnv, expandProgram and evaluate three
  // SEPARATE fuel objects. Builtins (map/filter/apply) burn the env's counter;
  // evalStep burns the evaluator's. Share one here so `used` is the real total.
  const fuel = { n: budget }
  const env = makeCoreEnv({ fuel })
  const { forms: expanded } = expandProgram(parse(src), { fuel })
  for (const f of expanded) evaluate(f, env, fuel)
  console.log(`used=${budget - fuel.n} budget=${budget}`)
} catch (err) {
  const m = String(err && err.message || err)
  if (/fuel exhausted/i.test(m)) console.log(`EXHAUSTED budget=${budget}`)
  else console.log(`ERROR ${m}`)
}
