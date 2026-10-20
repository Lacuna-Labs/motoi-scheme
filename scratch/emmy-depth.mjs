// scratch/emmy-depth.mjs — print paren depth at the END of every line of a file.
// Same string/comment/#\char handling as emmy-paren-scan.mjs. Read-only.
import { readFile } from 'node:fs/promises'

const src = await readFile(process.argv[2], 'utf8')
const lines = src.split('\n')
let depth = 0, inStr = false

lines.forEach((ln, idx) => {
  for (let i = 0; i < ln.length; i++) {
    const c = ln[i]
    if (inStr) {
      if (c === '\\') { i++; continue }
      if (c === '"') inStr = false
      continue
    }
    if (c === ';') break
    if (c === '"') { inStr = true; continue }
    if (c === '#' && ln[i + 1] === '\\') { i += 2; continue }
    if (c === '(') depth++
    else if (c === ')') depth--
  }
  console.log(`${String(idx + 1).padStart(5)} d=${depth}${inStr ? ' STR' : ''}  ${ln.slice(0, 60)}`)
})
