import { readFileSync } from 'node:fs'
import { parse } from '../src/reader.js'
function proseOf(file){
  const forms = parse(readFileSync(file,'utf8'))
  const rec = forms.find(f=>Array.isArray(f))
  for(let i=0;i<rec.length-1;i++){ if(String(rec[i])===':prose') return String(rec[i+1]) }
  return ''
}
function blocks(t){const o=[];const re=/```scheme\n([\s\S]*?)```/g;let m;while((m=re.exec(t))!==null)o.push(m[1]);return o}
const bs = blocks(proseOf('scheme-books/book-of-animation/ch12-wayfinding.book.slatl'))
console.log('num blocks:', bs.length)
try { parse(bs[10]); console.log('block 10 parsed OK') }
catch(e){ console.log('block 10 parse ERR:', e.message) }
// show raw with visible markers
console.log('--- raw block 10 repr tail ---')
console.log(JSON.stringify(bs[10].slice(-120)))
