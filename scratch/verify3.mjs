import { readFileSync } from 'node:fs'
import { parse } from '../src/reader.js'
import { evaluate } from '../src/interp.js'
import { expandProgram } from '../src/macro.js'
import { makeCoreEnv } from '../core/index.js'
const oe = process.stderr.write.bind(process.stderr)
process.stderr.write = (s,...a)=>(String(s).startsWith('[verbRegistry]')?true:oe(s,...a))
process.stdout.write = () => true
// Extract :prose string from a SLAT chapter via the reader (proper unescape)
function proseOf(file){
  const forms = parse(readFileSync(file,'utf8'))
  // forms[0] is the (chapter ...) list; walk for :prose
  const rec = forms.find(f=>Array.isArray(f))
  if(!rec) return ''
  for(let i=0;i<rec.length-1;i++){
    const k=rec[i]
    if(k && k.name===':prose' || (k&&k.sym===':prose') || String(k)===':prose'){ return String(rec[i+1]) }
  }
  return ''
}
function blocks(t){const o=[];const re=/```scheme\n([\s\S]*?)```/g;let m;while((m=re.exec(t))!==null)o.push(m[1]);return o}
const files=process.argv.slice(2)
for(const f of files){
  let prose=''
  try{ prose=proseOf(f) }catch(e){ oe(`READFAIL ${f.split('/').pop()}: ${e.message}\n`); continue }
  const bs=blocks(prose)
  const env=makeCoreEnv({fuel:{n:8000000}})
  let fail=-1,err='',ran=0
  for(let i=0;i<bs.length;i++){ if(i>0){try{const rf=parse("(world/reset!)");const{forms:rex}=expandProgram(rf,{fuel:{n:1000}});for(const rfm of rex)evaluate(rfm,env,{n:100000})}catch(e){}}
    try{
      const forms=parse(bs[i]);const {forms:ex}=expandProgram(forms,{fuel:{n:8000000}});const fuel={n:8000000}
      for(const fm of ex) evaluate(fm,env,fuel); ran++
    }catch(e){ fail=i; err=(e&&e.message)?e.message:String(e); break }
  }
  const name=f.split('/').pop()
  oe(`${fail===-1?'PASS':'FAIL'}  ${name}  (${ran}/${bs.length})${fail===-1?'':`  @${fail}: ${err.slice(0,70)}`}\n`)
}
