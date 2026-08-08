import { seqVerb } from '../base/list.js'
// exact.js — exact rational arithmetic for Motoi Scheme.
//
// A rational is represented as a plain object { n: BigInt, d: BigInt }
// stored in lowest terms with d > 0. Integers are represented with d = 1n.
// This module installs 19 verbs under the `exact/` namespace.
//
// Reference: scheme/reference/25-exact.slat.

const _gcd = (a, b) => {
  a = a < 0n ? -a : a
  b = b < 0n ? -b : b
  while (b) { [a, b] = [b, a % b] }
  return a || 1n
}

const _tag = Symbol.for('motoi:rational')

// Must return a real boolean, never the argument. `v && …` handed back `NaN`
// for `_isRat(NaN)`, and the ~40 `typeof x === 'number' || isRational(x)`
// guards across the tree then evaluated to `NaN` rather than `false` — a falsy
// non-boolean that callers went on to do arithmetic with.
function _isRat(v) {
  return typeof v === 'object' && v !== null && v[_tag] === true
}

function _toBig(x) {
  if (typeof x === 'bigint') return x
  if (typeof x === 'number') {
    if (!Number.isInteger(x)) throw new Error('exact: numerator/denominator must be integer')
    return BigInt(x)
  }
  throw new Error('exact: cannot coerce to bigint: ' + typeof x)
}

function _mk(n, d) {
  n = _toBig(n); d = _toBig(d)
  if (d === 0n) throw new Error('exact: zero denominator')
  if (d < 0n) { n = -n; d = -d }
  const g = _gcd(n, d)
  return { [_tag]: true, n: n / g, d: d / g }
}

// Accept both raw JS numbers (as integers) and rationals. This makes
// `(exact/+ 1 2)` and `(exact/+ (exact/rat 1 2) (exact/rat 1 3))` both work.
function _lift(v) {
  if (_isRat(v)) return v
  if (typeof v === 'bigint') return _mk(v, 1n)
  if (typeof v === 'number' && Number.isInteger(v)) return _mk(BigInt(v), 1n)
  throw new Error('exact: not a rational or integer: ' + typeof v)
}

// Approximate a JS float as an exact rational (0.5 → 1/2, 0.25 → 1/4).
function _floatToRat(f) {
  if (typeof f !== 'number') throw new Error('exact/float->rat: need number')
  if (Number.isInteger(f)) return _mk(BigInt(f), 1n)
  const scale = 1_000_000_000
  const n = BigInt(Math.round(f * scale))
  return _mk(n, BigInt(scale))
}

// Shared number-tower helpers — the reader and core arithmetic (src/base.js)
// reuse this one representation so `1/2` literals and `exact/*` verbs agree.
export {
  _mk as makeRational,
  _isRat as isRational,
  _lift as liftRational,
  _floatToRat as floatToRational,
}
export const RATIONAL_TAG = _tag


// ── inline registration metadata (2026-07-22) ────────────────────
// See engineering/HOW-TO-REGISTER-A-VERB.md.
export const VERBS = [
  "exact/*",
  "exact/+",
  "exact/-",
  "exact/->float",
  "exact/->mixed",
  "exact/->string",
  "exact//",
  "exact/<",
  "exact/<=",
  "exact/=",
  "exact/>",
  "exact/>=",
  "exact/abs",
  "exact/denominator",
  "exact/float->rat",
  "exact/inverse",
  "exact/neg",
  "exact/numerator",
  "exact/rat",
]
export const LAZY = false

export function installExact(env) {
  const def = (name, fn) => {
    Object.defineProperty(fn, '__verbName', { value: name })
    env.define(name, seqVerb(fn), { perm: 'read' })
  }

  def('exact/rat', (n, d) => _mk(n, d ?? 1n))

  def('exact/+', (a, b) => {
    a = _lift(a); b = _lift(b)
    return _mk(a.n * b.d + b.n * a.d, a.d * b.d)
  })
  def('exact/-', (a, b) => {
    a = _lift(a); b = _lift(b)
    return _mk(a.n * b.d - b.n * a.d, a.d * b.d)
  })
  def('exact/*', (a, b) => {
    a = _lift(a); b = _lift(b)
    return _mk(a.n * b.n, a.d * b.d)
  })
  def('exact//', (a, b) => {
    a = _lift(a); b = _lift(b)
    if (b.n === 0n) throw new Error('exact: division by zero')
    return _mk(a.n * b.d, a.d * b.n)
  })

  const cmp = (a, b) => {
    a = _lift(a); b = _lift(b)
    const l = a.n * b.d
    const r = b.n * a.d
    return l < r ? -1 : l > r ? 1 : 0
  }
  def('exact/=',  (a, b) => cmp(a, b) === 0)
  def('exact/<',  (a, b) => cmp(a, b) < 0)
  def('exact/<=', (a, b) => cmp(a, b) <= 0)
  def('exact/>',  (a, b) => cmp(a, b) > 0)
  def('exact/>=', (a, b) => cmp(a, b) >= 0)

  def('exact/abs', (a) => { a = _lift(a); return _mk(a.n < 0n ? -a.n : a.n, a.d) })
  def('exact/neg', (a) => { a = _lift(a); return _mk(-a.n, a.d) })
  def('exact/inverse', (a) => {
    a = _lift(a)
    if (a.n === 0n) throw new Error('exact: inverse of zero')
    return _mk(a.d, a.n)
  })

  def('exact/numerator',   (a) => Number(_lift(a).n))
  def('exact/denominator', (a) => Number(_lift(a).d))

  def('exact/->float',  (a) => { a = _lift(a); return Number(a.n) / Number(a.d) })
  def('exact/->mixed', (a) => {
    a = _lift(a)
    const whole = a.n / a.d
    const rem = a.n - whole * a.d
    return [Number(whole), Number(rem < 0n ? -rem : rem), Number(a.d)]
  })
  def('exact/->string', (a) => {
    a = _lift(a)
    return a.d === 1n ? String(a.n) : `${a.n}/${a.d}`
  })

  // Convert via a decimal scale so most inputs reduce cleanly
  // (e.g. 0.5 → 1/2, 0.25 → 1/4). See module-level _floatToRat.
  def('exact/float->rat', (f) => _floatToRat(f))

  return env
}

export default installExact
