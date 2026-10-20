// Run ALL chapters of a book CONCATENATED in ONE env (continuous-session semantics).
import { readFileSync } from 'node:fs'
import { parse } from '../src/reader.js'
import { evaluate } from '../src/interp.js'
import { expandProgram } from '../src/macro.js'
import { makeCoreEnv } from '../core/index.js'
const origErr = process.stderr.write.bind(process.stderr)
process.stderr.write = (s,...a)=>(String(s).startsWith('[verbRegistry]')?true:origErr(s,...a))
process.stdout.write = () => true
function blocks(t){const o=[];const re=/```scheme\n([\s\S]*?)```/g;let m;while((m=re.exec(t))!==null)o.push(m[1]);return o}
const files = process.argv.slice(2)
const env = makeCoreEnv({ fuel:{n:8000000} })
let gi=0, fails=0
for (const f of files){
  const bs = blocks(readFileSync(f,'utf8'))
  const name = f.split('/').pop()
  for (let i=0;i<bs.length;i++){
    gi++
    try {
      const forms = parse(bs[i])
      const { forms: ex } = expandProgram(forms,{fuel:{n:8000000}})
      const fuel={n:8000000}
      for (const fm of ex) evaluate(fm, env, fuel)
    } catch(e){
      fails++
      const msg=(e&&e.message)?e.message:String(e)
      origErr(`FAIL ${name} block ${i}: ${msg.slice(0,80)}\n`)
    }
  }
}
origErr(`\n${gi-fails}/${gi} blocks pass as ONE continuous session (${fails} fail)\n`)
