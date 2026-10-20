import { readFileSync, writeFileSync } from 'node:fs'
const [f, from, to] = process.argv.slice(2)
let t = readFileSync(f, 'utf8')
const before = t.split(from).length - 1
t = t.split(from).join(to)
writeFileSync(f, t)
console.log('replaced', before, 'x', from, '->', to)
