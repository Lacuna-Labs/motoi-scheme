// scratch/verify-tui.mjs — render the synth-patch cart via composer/render-tui
// and print it out. Used to capture the 20-line sample for the report.

import { readFileSync } from 'node:fs'
import { makeCoreEnv } from '../core/index.js'
import { parse } from '../src/reader.js'
import { evaluate } from '../src/interp.js'

const env = makeCoreEnv()
const fuel = { n: 1_000_000 }
const src = readFileSync('carts/composer/synth-patch.slat', 'utf8')
const forms = parse(src)
let canvas
for (const f of forms) {
  const r = evaluate(f, env, fuel)
  if (r && r.kind === 'canvas') canvas = r
}
if (!canvas) throw new Error('no canvas produced')
const render = env.get('composer/render-tui')
const out = render(canvas)
console.log(out)
