import { readFileSync, writeFileSync } from 'node:fs'
const f = process.argv[2]
let t = readFileSync(f, 'utf8')
let n = 0
// (plot/nice-domain <lo> <hi> <n>) -> (plot/nice-domain (list <lo> <hi>))
// lo/hi/n can be bare numbers or parenthesized exprs. Balance-parse.
let out = ''
let i = 0
while (i < t.length) {
  const idx = t.indexOf('(plot/nice-domain', i)
  if (idx === -1) { out += t.slice(i); break }
  out += t.slice(i, idx)
  // find matching close paren of the whole call
  let depth = 0, j = idx
  for (; j < t.length; j++) {
    if (t[j] === '(') depth++
    else if (t[j] === ')') { depth--; if (depth === 0) { j++; break } }
  }
  const call = t.slice(idx, j)
  const inner = call.slice(1, -1) // strip outer parens
  // split top-level tokens
  const parts = []
  let d=0, buf='', inStr=false
  for (let k=0;k<inner.length;k++){
    const c=inner[k]
    if(inStr){buf+=c; if(c==='"'&&inner[k-1]!=='\\')inStr=false; continue}
    if(c==='"'){inStr=true;buf+=c;continue}
    if(c==='('){d++;buf+=c;continue}
    if(c===')'){d--;buf+=c;continue}
    if((c===' '||c==='\n'||c==='\t')&&d===0){ if(buf.length){parts.push(buf);buf=''} continue }
    buf+=c
  }
  if(buf.length)parts.push(buf)
  // parts[0]=plot/nice-domain, then lo, hi, [n]
  if (parts.length >= 3) {
    const lo = parts[1], hi = parts[2]
    out += `(plot/nice-domain (list ${lo} ${hi}))`
    n++
  } else {
    out += call
  }
  i = j
}
writeFileSync(f, out)
console.log('rewrote', n)
