import { readFileSync, readdirSync, statSync } from 'node:fs'
const missing = readFileSync('scratch/missing-2026-08-02.txt','utf8')
  .split('\n').slice(1).filter(l => l && !l.startsWith('---'))
function walk(d, out=[]) {
  for (const f of readdirSync(d)) {
    const p = `${d}/${f}`
    if (statSync(p).isDirectory()) walk(p, out)
    else if (p.endsWith('.js')) out.push(p)
  }
  return out
}
const files = [...walk('lib'), ...walk('src'), ...walk('core')]
const src = new Map(files.map(f => [f, readFileSync(f,'utf8')]))
const byFile = new Map()
for (const v of missing) {
  const esc = v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
  const re = new RegExp(`def\\(\\s*'${esc}'|def\\(\\s*"${esc}"|\\[\\s*'${esc}'\\s*,|'${esc}':|"${esc}":`)
  let hit = 'UNATTRIBUTED'
  for (const [f, s] of src) if (re.test(s)) { hit = f; break }
  if (!byFile.has(hit)) byFile.set(hit, [])
  byFile.get(hit).push(v)
}
for (const [f, vs] of [...byFile].sort((a,b)=>b[1].length-a[1].length))
  console.log(`${String(vs.length).padStart(4)}  ${f}`)
