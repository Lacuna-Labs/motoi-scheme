import { readFileSync, writeFileSync } from 'node:fs'
const f = process.argv[2]
const lines = readFileSync(f, 'utf8').split('\n')
let count = 0
const out = lines.map(line => {
  if (!line.includes('plot/function')) return line
  if (line.includes('(list')) return line
  // Case A: "... LO HI)" or "... LO HI))" at end
  let m = line.match(/^(.*plot\/function.*?)\s(-?\d+(?:\.\d+)?)\s(-?\d+(?:\.\d+)?)(\)+)\s*$/)
  if (m) { count++; return `${m[1]} (list ${m[2]} ${m[3]})${m[4]}` }
  // Case B: "... LO HI '((..." opts follow, line may or may not close parens
  m = line.match(/^(.*plot\/function.*?)\s(-?\d+(?:\.\d+)?)\s(-?\d+(?:\.\d+)?)\s('.*)$/)
  if (m) { count++; return `${m[1]} (list ${m[2]} ${m[3]}) ${m[4]}` }
  // Case C: "... LO HI" with nothing after (opts on next line)
  m = line.match(/^(.*plot\/function.*?)\s(-?\d+(?:\.\d+)?)\s(-?\d+(?:\.\d+)?)\s*$/)
  if (m) { count++; return `${m[1]} (list ${m[2]} ${m[3]})` }
  return line
})
writeFileSync(f, out.join('\n'))
console.log('rewrote', count, 'lines')
