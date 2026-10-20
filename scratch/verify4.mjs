// Faithful per-example verifier: fresh env + fresh fuel per block (block0 prelude prepended).
// Models how a learner runs one ```scheme example: one process, one budget.
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
function runOne(prelude, code){
  const fuel={n:FUEL}
  const env=makeCoreEnv({fuel})            // same fuel object the run uses — fresh per example
  if(prelude){const{forms}=expandProgram(parse(prelude),{fuel});for(const f of forms)evaluate(f,env,fuel)}
  const{forms}=expandProgram(parse(code),{fuel});for(const f of forms)evaluate(f,env,fuel)
}
for(const f of process.argv.slice(2)){
  let prose='';try{prose=proseOf(f)}catch(e){oe(`READFAIL ${f.split('/').pop()}: ${e.message}\n`);continue}
  const bs=blocks(prose);const prelude=bs[0]||''
  let fail=-1,err='',ran=0
  for(let i=0;i<bs.length;i++){
    try{ runOne(i>0?prelude:'', bs[i]); ran++ }
    catch(e){ fail=i; err=(e&&e.message)?e.message:String(e); break }
  }
  const name=f.split('/').pop()
  oe(`${fail===-1?'PASS':'FAIL'}  ${name}  (${ran}/${bs.length})${fail===-1?'':`  @${fail}: ${err.slice(0,70)}`}\n`)
}
