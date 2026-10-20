import { readFileSync } from 'node:fs'
const [f, idx] = [process.argv[2], parseInt(process.argv[3])]
const text = readFileSync(f, 'utf8')
const re = /```scheme\n([\s\S]*?)```/g
let m, i=0
while ((m = re.exec(text)) !== null) {
  if (i === idx) { console.log(m[1].replace(/\\n/g,'\n').replace(/\\"/g,'"').replace(/\\\\/g,'\\')); break }
  i++
}
