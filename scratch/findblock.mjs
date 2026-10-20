import { readFileSync } from 'node:fs'
import { parse } from '../src/reader.js'
function proseOf(file){const forms=parse(readFileSync(file,'utf8'));const rec=forms.find(f=>Array.isArray(f));for(let i=0;i<rec.length-1;i++){if(String(rec[i])===':prose')return String(rec[i+1])}return ''}
function blocks(t){const o=[];const re=/```scheme\n([\s\S]*?)```/g;let m;while((m=re.exec(t))!==null)o.push(m[1]);return o}
const [needle,...files]=process.argv.slice(2)
for(const f of files){const bs=blocks(proseOf(f));for(let i=0;i<bs.length;i++){if(bs[i].includes(needle)){console.log('### '+f.split('/').pop()+' block '+i);console.log(bs[i]);console.log();break}}}
