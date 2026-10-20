import { readFileSync } from 'node:fs'
function blocks(t){const o=[];const re=/```scheme\n([\s\S]*?)```/g;let m;while((m=re.exec(t))!==null)o.push(m[1].replace(/\\n/g,'\n').replace(/\\"/g,'"').replace(/\\\\/g,'\\'));return o}
const names = process.argv.slice(3)
const file = process.argv[2]
const text = readFileSync(file,'utf8')
const bs = blocks(text)
const code = bs.join('\n')
for(const nm of names){
  // usage = ( name followed by space or )  ; definition = (define ( name
  const esc = nm.replace(/[.*+?^${}()|[\]\\/]/g,'\\$&')
  const callRe = new RegExp('\\('+esc+'[\\s)]','g')
  const defRe = new RegExp('\\(define\\s+\\('+esc+'[\\s)]','g')
  const calls = (code.match(callRe)||[]).length
  const defs = (code.match(defRe)||[]).length
  console.log(`${nm}\tcalls=${calls}\tdefs=${defs}\tnon-def-calls=${calls-defs}`)
}
