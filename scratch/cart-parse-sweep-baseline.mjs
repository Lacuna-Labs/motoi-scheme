// Parse-sweep every automations cart through the CURRENT reader.
// Execution needs Curator's dispatch + live endpoints, so it is not a
// meaningful gate here. Parsing is: the reader changed when real dotted
// pairs landed, and a reader regression would be silent and total.
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { parse } from '../src/reader.js'
import { expandProgram } from '../src/macro.js'

const files = execSync("find /tmp/cartbase/scheme-carts -name '*.sks'",
  { encoding: 'utf8', maxBuffer: 1 << 28 }).trim().split('\n')

let ok = 0, readFail = [], expandFail = []
for (const f of files) {
  let forms
  try { forms = parse(readFileSync(f, 'utf8')) }
  catch (e) { readFail.push([f, e.message]); continue }
  try { expandProgram(forms, { fuel: { n: 400000 } }) }
  catch (e) { expandFail.push([f, e.message]); continue }
  ok++
}
console.log(`carts ${files.length}  parsed+expanded ${ok}  READ-FAIL ${readFail.length}  EXPAND-FAIL ${expandFail.length}`)
for (const [f, m] of readFail.slice(0, 25)) console.log('  READ  ', f.replace(/.*scheme-carts\//,''), '::', m.slice(0, 130))
for (const [f, m] of expandFail.slice(0, 25)) console.log('  EXPAND', f.replace(/.*scheme-carts\//,''), '::', m.slice(0, 130))
