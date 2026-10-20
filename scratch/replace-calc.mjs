import { readFileSync, writeFileSync } from 'node:fs'
const f = process.argv[2]
let t = readFileSync(f, 'utf8')
const map = [
  [/\bcalc\/exp\b/g, 'exp'],
  [/\bcalc\/log\b/g, 'log'],
  [/\bcalc\/sqrt\b/g, 'sqrt'],
  [/\bcalc\/atan\b/g, 'atan'],
  [/\bcalc\/sin\b/g, 'geom/sin'],
  [/\bcalc\/cos\b/g, 'geom/cos'],
  [/\bcalc\/tan\b/g, 'geom/tan'],
]
let n = 0
for (const [re, rep] of map) { t = t.replace(re, () => { n++; return rep }) }
writeFileSync(f, t)
console.log('replaced', n)
