import { readFileSync } from 'node:fs'
import { parse } from '../src/reader.js'
function proseOf(file){
  const forms = parse(readFileSync(file,'utf8'))
  const rec = forms.find(f=>Array.isArray(f))
  for(let i=0;i<rec.length-1;i++){ if(String(rec[i])===':prose') return String(rec[i+1]) }
  return ''
}
function blocks(t){const o=[];const re=/```scheme\n([\s\S]*?)```/g;let m;while((m=re.exec(t))!==null)o.push(m[1]);return o}
const [file, idx] = [process.argv[2], parseInt(process.argv[3])]
const bs = blocks(proseOf(file))
console.log('=== block', idx, 'of', bs.length, '===')
console.log(bs[idx])
