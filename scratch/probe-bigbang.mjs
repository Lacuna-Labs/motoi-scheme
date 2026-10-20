import { parse } from '../src/reader.js'
import { evaluate } from '../src/interp.js'
import { makeCoreEnv } from '../core/index.js'
import { expandProgram } from '../src/macro.js'
const FUEL=200000
const src = "(big-bang (lambda () (world/spawn 'ball 10 10)))\n(world/count 'ball)"
try {
  const env = makeCoreEnv({ fuel: { n: FUEL } })
  const { forms } = expandProgram(parse(src), { fuel: { n: FUEL } })
  const fuel = { n: FUEL }
  let last
  for (const f of forms) last = evaluate(f, env, fuel)
  console.log('OK ->', last)
} catch(e) { console.log('ERR ->', String(e && e.message || e)) }
