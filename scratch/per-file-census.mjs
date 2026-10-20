import { parse } from '../src/reader.js'
import { readFile, readdir } from 'node:fs/promises'
const DIR = 'scheme/reference'
const KEYS = new Set([':code', ':program', ':composition',
  ':eng-program', ':math-program', ':cs-program',
  ':eng-composition', ':math-composition', ':cs-composition'])

function countStrings(node) {
  let n = 0
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      const e = node[i]
      if (e && typeof e === 'object' && KEYS.has(e.name) && typeof node[i + 1] === 'string') n++
      n += countStrings(e)
    }
  }
  return n
}

const files = (await readdir(DIR)).filter(f => f.endsWith('.slat') && !f.endsWith('.retag-new')).sort()
let tot = 0
const rows = []
for (const f of files) {
  const c = countStrings(parse(await readFile(`${DIR}/${f}`, 'utf8')))
  rows.push([f, c]); tot += c
}
rows.sort((a, b) => b[1] - a[1])
for (const [f, c] of rows) console.log(String(c).padStart(5), f)
console.log('-'.repeat(30))
console.log('TOTAL', tot, 'across', files.length, 'files')
