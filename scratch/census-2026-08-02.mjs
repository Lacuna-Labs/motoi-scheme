import { readFileSync, readdirSync } from 'node:fs'
import { makeCoreEnv } from '../core/index.js'

// A verb record starts at a line beginning with "(verb" and runs to the next
// one. Take the FIRST :name inside that window — anything later belongs to a
// nested :examples form or a drawing-object table.
const dir = 'scheme/reference'
const documented = new Map()
for (const f of readdirSync(dir).filter(f => f.endsWith('.slat'))) {
  const lines = readFileSync(`${dir}/${f}`, 'utf8').split('\n')
  const starts = []
  for (let i = 0; i < lines.length; i++) if (/^\(verb\b/.test(lines[i])) starts.push(i)
  for (let k = 0; k < starts.length; k++) {
    const window = lines.slice(starts[k], starts[k + 1] ?? lines.length).join('\n')
    const m = window.match(/:name\s+"([^"]+)"/)
    if (m) documented.set(m[1], f)
  }
}

const env = makeCoreEnv(1e6)
const bound = new Set()
for (let e = env; e; e = e.parent) for (const k of e.vars.keys()) bound.add(k)

const missing = [...bound].filter(v => !documented.has(v)).sort()
const orphan = [...documented.keys()].filter(v => !bound.has(v)).sort()
console.log('bound', bound.size, 'documented', documented.size,
            'MISSING', missing.length, 'ORPHANED-DOC', orphan.length)
console.log('\n--- MISSING ---\n' + missing.join('\n'))
console.log('\n--- ORPHANED ---\n' + orphan.join('\n'))
