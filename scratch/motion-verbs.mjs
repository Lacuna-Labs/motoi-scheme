import { readFileSync } from 'node:fs'
import { parse } from '../src/reader.js'
function proseOf(file){
  const forms = parse(readFileSync(file,'utf8'))
  const rec = forms.find(f=>Array.isArray(f))
  for(let i=0;i<rec.length-1;i++){ if(String(rec[i])===':prose') return String(rec[i+1]) }
  return ''
}
function blocks(t){const o=[];const re=/```scheme\n([\s\S]*?)```/g;let m;while((m=re.exec(t))!==null)o.push(m[1]);return o}
const verbs = new Map()
for(const file of process.argv.slice(2)){
  const t = proseOf(file)
  for(const b of blocks(t)){
    const noComments = b.replace(/;;[^\n]*/g,'')
    let m; const re=/\(([a-z][a-z0-9]*\/[a-z0-9!?*+<>=-]+)/g
    while((m=re.exec(noComments))!==null){ verbs.set(m[1],(verbs.get(m[1])||0)+1) }
  }
}
const sorted=[...verbs.entries()].sort((a,b)=>a[0].localeCompare(b[0]))
for(const [v,n] of sorted) console.log(String(n).padStart(4), v)
