import { parse as pNew } from '../src/reader.js'
import { parse as pOld } from './baseline-reader/reader.js'
import { expandProgram } from '../src/macro.js'
const src = `(define (f ctx) (do (ctx-log ctx 'warn "x") (done)))`
for (const [tag, p] of [['OLD', pOld], ['NEW', pNew]]) {
  let out
  try { out = JSON.stringify(p(src)).slice(0, 200) } catch (e) { console.log(tag, 'READ-ERR', e.message); continue }
  console.log(tag, 'parsed:', out)
  try { expandProgram(p(src), { fuel: { n: 100000 } }); console.log(tag, 'expand OK') }
  catch (e) { console.log(tag, 'expand FAIL:', e.message) }
}
