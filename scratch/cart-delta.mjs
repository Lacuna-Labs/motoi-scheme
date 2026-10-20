import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { parse as parseNew } from '../src/reader.js'
import { parse as parseOld } from './baseline-reader/reader.js'
import { expandProgram } from '../src/macro.js'

const files = execSync("find /Users/alfred/code/scheme-carts -name '*.sks'",
  { encoding: 'utf8', maxBuffer: 1 << 28 }).trim().split('\n')

const newReadFail = [], newExpandFail = []
for (const f of files) {
  const src = readFileSync(f, 'utf8')
  let oldOk = true
  try { parseOld(src) } catch { oldOk = false }
  let forms
  try { forms = parseNew(src) }
  catch (e) { if (oldOk) newReadFail.push([f, e.message]); continue }
  if (!oldOk) continue
  try { expandProgram(forms, { fuel: { n: 400000 } }) }
  catch (e) { newExpandFail.push([f, e.message]) }
}
console.log(`REGRESSED-READ ${newReadFail.length}  REGRESSED-EXPAND ${newExpandFail.length}`)
console.log('\n--- read regressions (message histogram) ---')
const h = {}
for (const [, m] of newReadFail) { const k = m.replace(/\(line.*/, '').trim(); h[k] = (h[k]||0)+1 }
for (const [k, n] of Object.entries(h).sort((a,b)=>b[1]-a[1])) console.log(`  ${String(n).padStart(4)}  ${k}`)
console.log('\n--- expand regressions (message histogram) ---')
const h2 = {}
for (const [, m] of newExpandFail) { const k = m.slice(0,70); h2[k] = (h2[k]||0)+1 }
for (const [k, n] of Object.entries(h2).sort((a,b)=>b[1]-a[1])) console.log(`  ${String(n).padStart(4)}  ${k}`)
writeFileSync('scratch/regressed-read.txt', newReadFail.map(x=>x.join(' :: ')).join('\n'))
writeFileSync('scratch/regressed-expand.txt', newExpandFail.map(x=>x.join(' :: ')).join('\n'))
console.log('\nsample read:', newReadFail[0]?.join(' :: '))
console.log('sample expand:', newExpandFail[0]?.join(' :: '))
