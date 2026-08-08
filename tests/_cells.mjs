// Test helper — read a Scheme value back as plain JavaScript.
//
// Motoi used to spell a proper list as a flat JS array, so a test could assert
// `deepEqual(run("(vec/add …)"), [4, 6])` and be comparing the engine's actual
// value object. A list is a chain of cons cells now, so that same assertion
// compares a `Pair` against an array and fails on the SPELLING while the value
// is right.
//
// `plain` converts the spelling and nothing else. Every element is still
// compared, so these assertions keep their full strength — they check the
// values, which is what they were written to check. The cell semantics that the
// array spelling could not express (interior identity, `set-cdr!`, circular
// lists, shared tails) are asserted directly in `tests/pairs.test.mjs`, where
// converting to arrays would destroy exactly the thing under test.

import { Pair, NIL } from '../lib/base/list.js'

export function plain(v) {
  if (v === NIL) return []
  if (v instanceof Pair) {
    const out = []
    let x = v
    let n = 0
    while (x instanceof Pair) {
      out.push(plain(x.car))
      x = x.cdr
      // A circular list has no array spelling. Fail loudly rather than hang —
      // a test that produced one almost certainly did so by accident.
      if (++n > 1e6) throw new Error('plain: circular list')
    }
    if (x !== NIL) return { __improper__: out, tail: plain(x) }
    return out
  }
  if (Array.isArray(v)) return v.map(plain)
  return v
}
