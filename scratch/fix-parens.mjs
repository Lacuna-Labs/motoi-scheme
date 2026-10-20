import { readFileSync, writeFileSync } from 'node:fs'

// paren depth over RAW code where " and \ are backslash-escaped
function depth(code) {
  let d = 0, inStr = false
  for (let i = 0; i < code.length; i++) {
    const c = code[i]
    if (inStr) { if (c === '\\') { i++; continue } if (c === '"') inStr = false; continue }
    if (c === ';') { while (i < code.length && code[i] !== '\n') i++; continue }
    if (c === '\\') { i++; continue }
    if (c === '"') { inStr = true; continue }
    if (c === '(' || c === '[') d++
    else if (c === ')' || c === ']') d--
  }
  return d
}

const file = process.argv[2]
const dry = process.argv[3] === '--dry'
let raw = readFileSync(file, 'utf8')
const fence = /(```scheme\n)([\s\S]*?)(```)/g
let idx = -1, fixed = 0
const report = []
raw = raw.replace(fence, (m, open, code, close) => {
  idx++
  const d = depth(code)
  if (d === 0) return m
  report.push(`block ${idx} depth ${d}`)
  if (d !== -1) return m
  const lines = code.split('\n')
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/\)\s*$/.test(lines[i])) { lines[i] = lines[i].replace(/\)(\s*)$/, '$1'); fixed++; break }
  }
  return open + lines.join('\n') + close
})
console.log(report.join('\n') || 'all balanced')
console.log(`fixed ${fixed} block(s)`)
if (!dry && fixed) writeFileSync(file, raw)
