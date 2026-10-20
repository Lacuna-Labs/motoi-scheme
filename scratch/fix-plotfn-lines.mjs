import { readFileSync, writeFileSync } from 'node:fs'
const f = process.argv[2]
const lines = readFileSync(f, 'utf8').split('\n')
let count = 0
const out = lines.map(line => {
  if (!line.includes('plot/function')) return line
  // match a trailing " LO HI))" or " LO HI)" where LO,HI are bare numbers
  const m = line.match(/^(.*plot\/function.*?)\s(-?\d+(?:\.\d+)?)\s(-?\d+(?:\.\d+)?)(\)+)\s*$/)
  if (!m) return line
  count++
  return `${m[1]} (list ${m[2]} ${m[3]})${m[4]}`
})
writeFileSync(f, out.join('\n'))
console.log('rewrote', count, 'lines')
