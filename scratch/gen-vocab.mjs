import { readFileSync, writeFileSync } from 'node:fs'
import { parse } from '../src/reader.js'

const files = process.argv.slice(2)
const fence = /```scheme\n([\s\S]*?)```/g
const kws = new Set()
const names = new Set()
for (const f of files) {
  const raw = readFileSync(f, 'utf8')
  const rec = parse(raw)[0]
  let prose = ''
  const walk = (n) => {
    if (typeof n === 'string' && n.includes('```scheme')) prose = n
    else if (Array.isArray(n)) n.forEach(walk)
  }
  walk(rec)
  if (!prose) continue
  let m
  while ((m = fence.exec(prose))) {
    // strip line comments so comment-colons don't pollute
    const code = m[1].replace(/;[^\n]*/g, '')
    for (const t of code.match(/[A-Za-z][A-Za-z0-9-]*:/g) || []) kws.add(t)
    for (const mm of code.matchAll(/\((?:entity|actor|spawn|world\/spawn)\s+([A-Za-z][A-Za-z0-9-]*)/g)) names.add(mm[1])
  }
}
// code variables / clause-functions to exclude from bare-name binding
const exclude = new Set(['x','y','a','t','world','tag','name','velocity','vx','y-offset','rest-y','anchor-x','head','trunk','tail','rotation',
  // builtins that also appear as sample entity names — never shadow
  'car','cdr','cons','list','map','filter','length','min','max','abs','round','floor'])
const nameList = [...names].filter(n => !exclude.has(n)).sort()
const kwList = [...kws].sort()

let out = '\n;; --- shared illustrative vocabulary (auto-collected from motion chapters) ---\n'
out += ';; keyword-arg symbols (trailing colon) self-evaluate\n'
for (const k of kwList) out += `(define ${k} '${k})\n`
out += ';; sample entity/actor names self-quote\n'
for (const n of nameList) out += `(define ${n} '${n})\n`
writeFileSync('/Users/alfred/code/motoi-scheme/scratch/motion-vocab.scm', out)
console.log(`keywords=${kwList.length} names=${nameList.length} -> scratch/motion-vocab.scm`)
