import fs from 'fs'
const j = JSON.parse(fs.readFileSync('scratch/reference-failures.json', 'utf8'))
const src = fs.readFileSync('scheme/reference/01-core.slat', 'utf8')
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const defined = (sym) => new RegExp('\\(define\\s+\\(?' + esc(sym) + '[\\s)]').test(src)
const curatorish = (s) => /^(card|camera|sprite|shop|world|scene|minimap|easing|entity)/.test(s) || /^on-minimap/.test(s)
let artifact = 0, curatorLeak = 0
const freevars = [], notfn = []
for (const f of j) {
  const m = (f.err || '').match(/unbound symbol: (\S+)/)
  if (!m) { notfn.push((f.code || '').slice(0, 55)); continue }
  const s = m[1]
  if (defined(s)) artifact++
  else if (curatorish(s)) { curatorLeak++; }
  else freevars.push(s)
}
console.log('extraction-artifacts (symbol defined in a sibling snippet):', artifact)
console.log('curator-dialect leaks (card/camera/sprite/easing…):', curatorLeak)
console.log('free-vars undefined anywhere in chapter:', freevars.length, freevars.length ? '-> ' + [...new Set(freevars)].join(', ') : '')
console.log('not-a-function:', notfn.length, notfn.map(c => JSON.stringify(c)).join(' | '))
