import { readFileSync } from 'node:fs'
import { parse } from '../src/reader.js'
import { globSync } from 'node:fs'

const files = process.argv.slice(2)
const fence = /```scheme\n([\s\S]*?)```/g
const kws = new Set()
const names = new Set()
for (const f of files) {
  const raw = readFileSync(f, 'utf8')
  // pull :prose "..."
  const rec = parse(raw)[0]
  // find the prose string: walk the record for a string containing ```scheme
  let prose = ''
  const walk = (n) => {
    if (typeof n === 'string' && n.includes('```scheme')) prose = n
    else if (Array.isArray(n)) n.forEach(walk)
  }
  walk(rec)
  if (!prose) continue
  let m
  while ((m = fence.exec(prose))) {
    const code = m[1]
    // trailing-colon keyword tokens: token boundary
    for (const t of code.match(/[A-Za-z][A-Za-z0-9-]*:/g) || []) {
      // skip things like http: or ones that are actually part of ::
      kws.add(t)
    }
    // entity/actor/spawn first-arg unquoted names
    for (const mm of code.matchAll(/\((?:entity|actor|spawn|world\/spawn)\s+([A-Za-z][A-Za-z0-9-]*)/g)) {
      names.add(mm[1])
    }
  }
}
console.log('KEYWORDS', kws.size)
console.log([...kws].sort().join(' '))
console.log('\nNAMES', names.size)
console.log([...names].sort().join(' '))
