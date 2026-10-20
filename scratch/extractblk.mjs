import { readFileSync, writeFileSync } from 'node:fs'
import { parse } from '../src/reader.js'
const [file, idx, out] = process.argv.slice(2)
const forms = parse(readFileSync(file,'utf8'))
const rec = forms.find(f=>Array.isArray(f))
let prose=''; for(let i=0;i<rec.length-1;i++){ if(String(rec[i])===':prose'){prose=String(rec[i+1]);break} }
const re=/```scheme\n([\s\S]*?)```/g; const bs=[]; let m; while((m=re.exec(prose)))bs.push(m[1])
const s = bs[Number(idx)]
writeFileSync(out, s)
let d=0,ln=1,col=0,instr=false
for(const c of s){col++;if(c==="\n"){ln++;col=0;continue}if(c==='"'){instr=!instr;continue}if(instr)continue;if(c==="(")d++;if(c===")"){d--;if(d<0)console.log("NEG",ln,col)}}
console.log(`block ${idx} depth ${d} (of ${bs.length} blocks)`)
