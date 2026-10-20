import { parse } from '../src/reader.js'
import { readFile, readdir } from 'node:fs/promises'
const DIR = 'scheme/reference'

const KEYS = [':code', ':program', ':composition',
  ':eng-program', ':math-program', ':cs-program',
  ':eng-composition', ':math-composition', ':cs-composition']

// Count a key ONLY when its value (next sibling in the list) is a string.
// A record is a flat list: (... :key value :key value ...). We walk lists and
// look at each keyword followed by its value.
function walk(node, tally) {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      const e = node[i]
      if (e && typeof e === 'object' && typeof e.name === 'string' && KEYS.includes(e.name)) {
        const val = node[i + 1]
        if (typeof val === 'string') tally[e.name].strings = (tally[e.name].strings || 0) + 1
        else tally[e.name].other = (tally[e.name].other || 0) + 1
      }
      walk(e, tally)
    }
  }
}

const files = (await readdir(DIR)).filter(f => f.endsWith('.slat') && !f.endsWith('.retag-new')).sort()
const tally = {}
for (const k of KEYS) tally[k] = { strings: 0, other: 0 }
for (const f of files) {
  walk(parse(await readFile(`${DIR}/${f}`, 'utf8')), tally)
}
let totS = 0, totO = 0
console.log('key                strings   non-string')
for (const k of KEYS) {
  console.log(k.padEnd(18), String(tally[k].strings).padStart(7), String(tally[k].other).padStart(10))
  totS += tally[k].strings; totO += tally[k].other
}
console.log('-'.repeat(40))
console.log('TOTAL runnable (string-valued):', totS)
console.log('TOTAL non-string (list/#f/null):', totO)
console.log('files:', files.length)
