import { readFileSync } from 'node:fs'
import { parse } from '../src/reader.js'
import { makeCoreEnv } from '../core/index.js'
function proseOf(file){
  const forms = parse(readFileSync(file,'utf8'))
  const rec = forms.find(f=>Array.isArray(f))
  for(let i=0;i<rec.length-1;i++){ if(String(rec[i])===':prose') return String(rec[i+1]) }
  return ''
}
function blocks(t){const o=[];const re=/```scheme\n([\s\S]*?)```/g;let m;while((m=re.exec(t))!==null)o.push(m[1]);return o}
const prelude = readFileSync('/Users/alfred/code/motoi-scheme/scratch/anim-prelude.scm','utf8')
for(const file of process.argv.slice(2)){
  const bs = blocks(proseOf(file))
  const env = makeCoreEnv({fuel:{n:8000000}})
  let ok=0, failAt=-1, err=''
  const all = [prelude, ...bs]
  for(let i=0;i<all.length;i++){
    try{ const forms=parse(all[i]); for(const f of forms) env.eval(f); ok++ }
    catch(e){ failAt=i-1; err=String(e.message||e); break }
  }
  const name=file.split('/').pop()
  if(failAt<0) console.log('PASS ', name, `(${bs.length} blocks)`)
  else console.log('FAIL ', name, `(${ok-1}/${bs.length})`, `@block ${failAt}:`, err.slice(0,80))
}
