import { parse } from '../src/reader.js'
import { readFile, readdir } from 'node:fs/promises'
const DIR = 'scheme/reference'
const PROG = new Set([':code', ':program', ':composition',
  ':eng-program', ':math-program', ':cs-program',
  ':eng-composition', ':math-composition', ':cs-composition'])

function tally(node, acc) {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      const e = node[i]
      if (e && typeof e === 'object' && typeof e.name === 'string') {
        if (PROG.has(e.name) && typeof node[i + 1] === 'string') acc.progs++
        if (e.name === ':signature') acc.verbs++
      }
      tally(e, acc)
    }
  }
}

const files = (await readdir(DIR)).filter(f => f.endsWith('.slat') && !f.endsWith('.retag-new')).sort()
let TV = 0, TP = 0
const rows = []
for (const f of files) {
  const acc = { progs: 0, verbs: 0 }
  tally(parse(await readFile(`${DIR}/${f}`, 'utf8')), acc)
  if (acc.verbs === 0 && acc.progs === 0) continue
  rows.push([f, acc.verbs, acc.progs, acc.verbs ? (acc.progs / acc.verbs) : 0])
  TV += acc.verbs; TP += acc.progs
}
rows.sort((a, b) => b[3] - a[3])
console.log('verbs progs  per-verb  file')
for (const [f, v, p, r] of rows) {
  console.log(String(v).padStart(4), String(p).padStart(5), r.toFixed(2).padStart(7), '  ' + f)
}
console.log('-'.repeat(40))
console.log('TOTAL verbs', TV, ' progs', TP, ' mean/verb', (TP / TV).toFixed(2))
console.log('15-grid floor at', TV, 'verbs =', TV * 15)
