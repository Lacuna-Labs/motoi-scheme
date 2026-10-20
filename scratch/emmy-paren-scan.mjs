// scratch/emmy-paren-scan.mjs — locate unbalanced top-level forms in a .slat.
// Scans char-by-char honouring string literals, \ escapes, #\char literals and
// ; line comments. Prints the start line of every top-level form and its depth
// at EOF, so an unclosed record is obvious without reflowing anything.
import { readFile } from 'node:fs/promises'

const path = process.argv[2]
const src = await readFile(path, 'utf8')

let depth = 0, line = 1, startLine = 0
let inStr = false
const opens = []            // stack of line numbers for each unmatched '('
const forms = []            // [startLine, endLine, ok]

for (let i = 0; i < src.length; i++) {
  const c = src[i]
  if (c === '\n') { line++; continue }
  if (inStr) {
    if (c === '\\') { i++; continue }
    if (c === '"') inStr = false
    continue
  }
  if (c === ';') { while (i < src.length && src[i] !== '\n') i++; line++; continue }
  if (c === '"') { inStr = true; continue }
  if (c === '#' && src[i + 1] === '\\') { i += 2; continue }   // #\( is a char
  if (c === '(') {
    if (depth === 0) startLine = line
    opens.push(line)
    depth++
    continue
  }
  if (c === ')') {
    depth--
    opens.pop()
    if (depth === 0) forms.push([startLine, line])
    if (depth < 0) { console.log(`EXTRA ) at line ${line}`); depth = 0; opens.length = 0 }
  }
}

console.log(`forms closed: ${forms.length}`)
console.log(`depth at EOF: ${depth}`)
if (depth > 0) console.log(`unclosed '(' opened at lines: ${opens.join(', ')}`)
if (inStr) console.log('EOF inside a string literal')
