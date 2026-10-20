import { makeCoreEnv } from '../../core/index.js'
import { evaluate } from '../../src/interp.js'
import { parse } from '../../src/reader.js'
const run = (src) => {
  const fuel = { n: 1_000_000 }
  const env = makeCoreEnv({ fuel })
  let last
  for (const f of parse(src)) last = evaluate(f, env, fuel)
  return last
}
for (const ex of [
  '(random 100)', '(random-int 1000)', '(random-range 0 1)',
  '(random-pick (list 1 2 3 4 5))', '(randint 0 1000)', '(rng-uniform)',
  '(random-integer 1000)', '(random-real)',
  '(alg/random-element (list 1 2 3 4 5))',
  '(ai/wander (list 0 0) (list 1 0) 1)',
]) {
  try { console.log(ex, '=>', JSON.stringify(run(ex))) }
  catch (e) { console.log(ex, 'ERR', e.message) }
}
