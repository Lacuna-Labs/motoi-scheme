import { parse as pOld } from './baseline-reader/reader.js'
import { parse as pNew } from '../src/reader.js'
// The exact shape found in 48 carts. `.` may appear ONCE, before the LAST
// element. Two dots in one list is not a pair, not a list, not Scheme.
const src = `'(:reason "required" :refund-id . refund-id :provider . provider)`
for (const [tag, p] of [['OLD', pOld], ['NEW', pNew]]) {
  try { console.log(tag, '=>', JSON.stringify(p(src))) }
  catch (e) { console.log(tag, '=> ERROR:', e.message) }
}
