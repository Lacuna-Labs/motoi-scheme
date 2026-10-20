// Shared env (cross-block continuations work) + ONE fuel object reset per block.
// The single fuel object is the one makeCoreEnv captures (animation-budget etc.),
// so world/step and evaluate share a per-block-fresh budget = faithful to real runs.
import { readFileSync } from 'node:fs'
import { parse } from '../src/reader.js'
import { evaluate } from '../src/interp.js'
import { expandProgram } from '../src/macro.js'
import { makeCoreEnv } from '../core/index.js'
const oe = process.stderr.write.bind(process.stderr)
process.stderr.write=(s,...a)=>(String(s).startsWith('[verbRegistry]')?true:oe(s,...a))
process.stdout.write=()=>true
const FUEL=8000000
function proseOf(file){const forms=parse(readFileSync(file,'utf8'));const rec=forms.find(f=>Array.isArray(f));for(let i=0;i<rec.length-1;i++){const k=rec[i];if((k&&k.name===':prose')||String(k)===':prose')return String(rec[i+1])}return''}
function blocks(t){const o=[];const re=/```scheme\n([\s\S]*?)```/g;let m;while((m=re.exec(t))!==null)o.push(m[1]);return o}
for(const f of process.argv.slice(2)){
  let prose='';try{prose=proseOf(f)}catch(e){oe(`READFAIL ${f.split('/').pop()}: ${e.message}\n`);continue}
  const bs=blocks(prose)
  const fuel={n:FUEL}                     // the ONE budget object
  const env=makeCoreEnv({fuel})           // captured by animation-budget etc.
  let fail=-1,err='',ran=0
  for(let i=0;i<bs.length;i++){
    fuel.n=FUEL                           // refresh the shared budget before each block
    if(i>0){try{const{forms:rf}=expandProgram(parse("(world/reset!)"),{fuel});for(const r of rf)evaluate(r,env,fuel);fuel.n=FUEL}catch(e){}}
    try{const{forms:ex}=expandProgram(parse(bs[i]),{fuel});for(const fm of ex)evaluate(fm,env,fuel);ran++}
    catch(e){fail=i;err=(e&&e.message)?e.message:String(e);break}
  }
  const name=f.split('/').pop()
  oe(`${fail===-1?'PASS':'FAIL'}  ${name}  (${ran}/${bs.length})${fail===-1?'':`  @${fail}: ${err.slice(0,70)}`}\n`)
}
