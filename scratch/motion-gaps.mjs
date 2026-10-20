import { readFileSync } from 'node:fs'
import { parse } from '../src/reader.js'
import { evaluate } from '../src/interp.js'
import { expandProgram } from '../src/macro.js'
import { makeCoreEnv } from '../core/index.js'
const oe=process.stderr.write.bind(process.stderr)
process.stderr.write=(s,...a)=>(String(s).startsWith('[verbRegistry]')?true:oe(s,...a))
process.stdout.write=()=>true
function proseOf(file){const forms=parse(readFileSync(file,'utf8'));const rec=forms.find(f=>Array.isArray(f));for(let i=0;i<rec.length-1;i++){if(String(rec[i])===':prose')return String(rec[i+1])}return ''}
function blocks(t){const o=[];const re=/```scheme\n([\s\S]*?)```/g;let m;while((m=re.exec(t))!==null)o.push(m[1]);return o}
const gaps=new Map()
for(const f of process.argv.slice(2)){
  const bs=blocks(proseOf(f))
  const env=makeCoreEnv({fuel:{n:8000000}})
  for(let i=0;i<bs.length;i++){
    try{const forms=parse(bs[i]);const {forms:ex}=expandProgram(forms,{fuel:{n:8000000}});const fuel={n:8000000};for(const fm of ex)evaluate(fm,env,fuel)}
    catch(e){const msg=(e&&e.message)?e.message:String(e);const m=msg.match(/unbound symbol: (\S+)/);if(m)gaps.set(m[1],(gaps.get(m[1])||0)+1);else gaps.set('ERR:'+msg.slice(0,40),(gaps.get('ERR:'+msg.slice(0,40))||0)+1)}
  }
}
const sorted=[...gaps.entries()].sort((a,b)=>b[1]-a[1])
for(const [v,n] of sorted)oe(String(n).padStart(4)+'  '+v+'\n')
