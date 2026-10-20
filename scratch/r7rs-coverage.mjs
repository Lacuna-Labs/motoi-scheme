import fs from 'fs'
import { makeCoreEnv } from '../core/index.js'
const env = makeCoreEnv({ fuel: { n: 1_000_000 } })
const ids = fs.readFileSync('/tmp/r7rs-ids.txt', 'utf8').split('\n').map(s => s.trim()).filter(Boolean)
const bound = (n) => {
  try { env.get(n); return true } catch { return false }
}
const missing = ids.filter(n => !bound(n))
console.log('R7RS-small identifiers checked :', ids.length)
console.log('bound in Motoi                 :', ids.length - missing.length)
console.log('NOT bound                      :', missing.length)
console.log(missing.join('\n'))
