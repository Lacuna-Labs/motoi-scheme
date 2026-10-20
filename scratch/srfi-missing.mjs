import { readFileSync } from 'node:fs'
const missing = readFileSync('scratch/missing-2026-08-02.txt','utf8')
  .split('\n').slice(1).filter(l => l && !l.startsWith('---'))
for (const f of ['lib/std/srfi-1.js','lib/std/srfi-13.js','lib/std/srfi-125.js','lib/std/srfi-27.js']) {
  const s = readFileSync(f,'utf8')
  const hits = missing.filter(v => {
    const esc = v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
    return new RegExp(`def\\(\\s*'${esc}'|def\\(\\s*"${esc}"|'${esc}':|"${esc}":`).test(s)
  })
  console.log(`\n${f}  (${hits.length})\n  ${hits.join(' ')}`)
}
