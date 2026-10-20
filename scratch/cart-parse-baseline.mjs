// Same sweep, but through the PRE-dotted-pair reader archived from Sakura on
// 2026-08-02. Any delta against cart-parse-sweep.mjs is caused by my change;
// anything failing in BOTH was already broken.
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { parse } from './baseline-reader/reader.js'
import { expandProgram } from '../src/macro.js'

const files = execSync("find /Users/alfred/code/scheme-carts -name '*.sks'",
  { encoding: 'utf8', maxBuffer: 1 << 28 }).trim().split('\n')

let ok = 0
const readFail = [], expandFail = []
for (const f of files) {
  let forms
  try { forms = parse(readFileSync(f, 'utf8')) } catch { readFail.push(f); continue }
  try { expandProgram(forms, { fuel: { n: 400000 } }) } catch { expandFail.push(f); continue }
  ok++
}
console.log(`BASELINE carts ${files.length} ok ${ok} READ-FAIL ${readFail.length} EXPAND-FAIL ${expandFail.length}`)
writeFileSync('scratch/baseline-readfail.txt', readFail.join('\n'))
writeFileSync('scratch/baseline-expandfail.txt', expandFail.join('\n'))
