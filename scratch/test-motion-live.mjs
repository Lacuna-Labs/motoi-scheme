// Prepend the live motion-prelude to ALL blocks of a motion chapter (these
// chapters have NO injected prelude block), run concatenated in one env.
import { readFileSync } from 'node:fs'
import { parse } from '../src/reader.js'
import { evaluate } from '../src/interp.js'
import { expandProgram } from '../src/macro.js'
import { makeCoreEnv } from '../core/index.js'
const oe = process.stderr.write.bind(process.stderr)
process.stderr.write = (s,...a)=>(String(s).startsWith('[verbRegistry]')?true:oe(s,...a))
process.stdout.write = () => true
function proseOf(file){
  const forms = parse(readFileSync(file,'utf8'))
  const rec = forms.find(f=>Array.isArray(f))
  for(let i=0;i<rec.length-1;i++){ if(String(rec[i])===':prose') return String(rec[i+1]) }
  return ''
}
function blocks(t){const o=[];const re=/```scheme\n([\s\S]*?)```/g;let m;while((m=re.exec(t))!==null)o.push(m[1]);return o}
const prelude = readFileSync('scratch/motion-prelude.scm','utf8')
for(const f of process.argv.slice(2)){
  const bs = blocks(proseOf(f))
  const run = [prelude, ...bs]
  const env = makeCoreEnv({fuel:{n:8000000}})
  let fail=-1,err='',ran=0
  for(let i=0;i<run.length;i++){
    try{
      const forms=parse(run[i]); const {forms:ex}=expandProgram(forms,{fuel:{n:8000000}}); const fuel={n:8000000}
      for(const fm of ex) evaluate(fm,env,fuel); ran++
    }catch(e){ fail=i; err=(e&&e.message)?e.message:String(e); break }
  }
  const name=f.split('/').pop()
  oe(`${fail===-1?'PASS':'FAIL'}  ${name}  (${ran}/${run.length})${fail===-1?'':`  @block ${fail-1}: ${err.slice(0,90)}`}\n`)
}
