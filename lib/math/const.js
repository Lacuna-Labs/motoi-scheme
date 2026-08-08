import { seqVerb } from '../base/list.js'
// const.js — mathematical constants.
//
// CORE constants are `const/pi`, `const/tau`, `const/e`, `const/phi`.
//
// Bound as VALUES (not zero-arg procedures). The reference — canonical, and it
// wins when code and reference disagree — documents these as constants that
// "Evaluate to 3.1415…" and uses the bare form 194× vs the called form 7×.
// This also matches `pi` in src/base.js, which is a plain value. (Superseded
// the 2026-07-16 "zero-arg procedure" convention on 2026-07-26 per reference.)
//
// A parallel set of `math/pi` etc. lives in lib/math/basic.js — same values.


// ── inline registration metadata (2026-07-22) ────────────────────
// See engineering/HOW-TO-REGISTER-A-VERB.md.
export const VERBS = [
  "const/e",
  "const/ln10",
  "const/ln2",
  "const/phi",
  "const/pi",
  "const/sqrt2",
  "const/sqrt3",
  "const/tau",
]
export const LAZY = false

export function installConst(env, fuel) {
  const def = (n, f, perm = 'read') => env.define(n, seqVerb(f), { perm })

  // Pi. 3.141592653589793.
  def('const/pi', Math.PI)
  // Tau = 2 * pi. 6.283185307179586.
  def('const/tau', Math.PI * 2)
  // Euler's number. 2.718281828459045.
  def('const/e', Math.E)
  // Golden ratio (1 + sqrt(5)) / 2. 1.618033988749895.
  def('const/phi', (1 + Math.sqrt(5)) / 2)
  // Natural log of 10. 2.302585092994046.
  def('const/ln10', Math.LN10)
  // Natural log of 2. 0.6931471805599453.
  def('const/ln2',  Math.LN2)
  // Square root of 2. 1.4142135623730951.
  def('const/sqrt2', Math.SQRT2)
  // Square root of 3. 1.7320508075688772.
  def('const/sqrt3', Math.sqrt(3))

  return env
}

export default installConst
