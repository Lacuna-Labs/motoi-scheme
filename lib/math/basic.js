// basic.js — arithmetic, powers, logs, aggregate, GCD/LCM.
//
// Doctrine (Alfred, 2026-07-16): every CORE `math/*` verb is a pure function
// on numbers. No state, no logging, no side effects. Kid-friendly: `math/sum`
// takes a list, `math/avg` takes a list, `math/lerp` takes three numbers.
// Named `math/*` deliberately — the plain `+`, `sqrt`, etc. are still in
// makeBaseEnv; these are the namespaced siblings kids can grep-find.


// Every body reads its arguments through `num` and returns through the tower
// (lib/math/tower.js): an exact rational or a bigint reaching `Math.exp`
// directly answers NaN, and §6.2.6 says a transcendental result is inexact.
import { flo, num, isExact, asFraction, normExact, exactSqrt, exptNum } from './tower.js'

import { isList, seqVerb } from '../base/list.js'
// ── inline registration metadata (2026-07-22) ────────────────────
// See engineering/HOW-TO-REGISTER-A-VERB.md.
export const VERBS = [
  "math/avg",
  "math/ceil",
  "math/clamp",
  "math/compare",
  "math/cube",
  "math/e",
  "math/exp",
  "math/floor",
  "math/gcd",
  "math/hypot",
  "math/lcm",
  "math/lerp",
  "math/log",
  "math/log10",
  "math/log2",
  "math/pct",
  "math/pi",
  "math/pow",
  "math/round",
  "math/sqrt",
  "math/square",
  "math/sum",
  "math/tau",
]
export const LAZY = false

export function installMathBasic(env, fuel) {
  const def = (n, f, perm = 'read') => env.define(n, seqVerb(f), { perm })

  // Constants (namespaced siblings of const/*). Bound as VALUES, not nullary
  // functions: the reference documents `math/pi` as "Evaluates to 3.1415…" and
  // uses the bare form 146× vs the called form once. Reference wins.
  def('math/pi', flo(Math.PI))
  def('math/tau', flo(Math.PI * 2))
  def('math/e', flo(Math.E))

  // Single-argument math primitives.
  // Same kernel as the plain `sqrt`, so the namespaced sibling cannot answer
  // 12.0 where `sqrt` answers 12.
  def('math/sqrt', (x) => { const r = exactSqrt(x); return r !== null ? r : flo(Math.sqrt(num(x))) })
  // Rounding an exact number keeps it exact; only the transcendentals below
  // are required to go inexact.
  const _round = (f) => (x) => (isExact(x) ? f(num(x)) : flo(f(num(x))))
  def('math/floor', _round(Math.floor))
  def('math/ceil', _round(Math.ceil))
  // The reference signature is (math/round n decimals), half away from zero.
  // The old body was Math.round(x): it dropped `decimals` on the floor, so
  // (math/round 12.99 2) answered 13, and it rounded -2.5 to -2 where the
  // reference says -3, because JS rounds halves toward +Infinity, not away
  // from zero. Scaling goes through decimal-exponent notation rather than
  // multiplication — 2.345 * 100 is 234.49999999999997, so the multiply form
  // answers 2.34 for a number the reference documents as 2.35.
  const _shift = (n, e) => {
    const s = String(n)
    if (s.includes('e') || s.includes('E')) return n * Math.pow(10, e)
    const v = Number(`${s}e${e}`)
    return Number.isFinite(v) ? v : n * Math.pow(10, e)
  }
  def('math/round', (x0, decimals) => {
    const exact = isExact(x0)
    const x = num(x0)
    if (!Number.isFinite(x)) return x
    const d = decimals === undefined ? 0 : Math.trunc(num(decimals))
    const sign = x < 0 ? -1 : 1
    const up = _shift(Math.abs(x), d)
    // 1e308 scaled up by two decimal places overflows to Infinity. A number
    // that large has no fractional part left to round, so it is its own answer.
    if (!Number.isFinite(up)) return x
    const r = sign * _shift(Math.floor(up + 0.5), -d)
    return exact ? r : flo(r)
  })
  // Powers are ordinary multiplication, so they keep the argument's exactness.
  const _pow = (k) => (x) => {
    if (isExact(x)) { const [n, dd] = asFraction(x); return normExact(n ** k, dd ** k) }
    return flo(Math.pow(num(x), Number(k)))
  }
  def('math/square', _pow(2n))
  def('math/cube', _pow(3n))
  def('math/exp', (x) => flo(Math.exp(num(x))))
  def('math/log', (x) => flo(Math.log(num(x))))
  def('math/log10', (x) => flo(Math.log10(num(x))))
  def('math/log2', (x) => flo(Math.log2(num(x))))

  // Two-argument.
  // The reference states math/pow IS expt under another name; one kernel keeps
  // that true.
  def('math/pow', (x, y) => exptNum(x, y))
  // A Pythagorean triple has an exact answer and the reference states it as
  // one — (math/hypot 3 4) is 5, not 5.0.
  def('math/hypot', (...xs) => {
    if (xs.every(isExact)) {
      let n = 0n, d = 1n
      for (const x of xs) { const [a, b] = asFraction(x); n = n * b * b + a * a * d; d = d * b * b }
      const r = exactSqrt(normExact(n, d))
      if (r !== null) return r
    }
    return flo(Math.hypot(...xs.map(num)))
  })
  // `| 0` would truncate to 32-bit signed integer; math/gcd is meant to
  // work on any positive whole number. Use Math.trunc + Math.abs so values
  // above 2^31 don't wrap into negatives. Non-integer inputs still get
  // truncated to their integer part (Scheme integer gcd semantics).
  def('math/gcd', (a, b) => {
    a = Math.abs(Math.trunc(num(a))); b = Math.abs(Math.trunc(num(b)))
    while (b) { const t = b; b = a % b; a = t }
    return a
  })
  def('math/lcm', (a, b) => {
    const A = Math.abs(Math.trunc(num(a)))
    const B = Math.abs(Math.trunc(num(b)))
    const g = (function gcd(x, y) {
      while (y) { const t = y; y = x % y; x = t }
      return x
    })(A, B)
    return g === 0 ? 0 : (A * B) / g
  })

  // Three-argument.
  def('math/lerp', (a, b, t) => num(a) + (num(b) - num(a)) * num(t))
  // `math/clamp` returns one of its own arguments, so it hands back the
  // caller's value untouched — exactness included.
  def('math/clamp', (x, lo, hi) => {
    const r = num(x) < num(lo) ? lo : x
    return num(r) > num(hi) ? hi : r
  })

  // Aggregations over a list.
  def('math/sum', (xs) => {
    if (!isList(xs)) return 0
    let s = 0; for (const x of xs) s += num(x)
    return s
  })
  def('math/avg', (xs) => {
    if (!isList(xs) || xs.length === 0) return 0
    let s = 0; for (const x of xs) s += num(x)
    return s / xs.length
  })

  // Percentage (returns 0..100 by convention).
  def('math/pct', (part, whole) => {
    if (!num(whole)) return 0
    return (num(part) / num(whole)) * 100
  })

  // Compare: -1, 0, 1.
  def('math/compare', (a, b) => (num(a) < num(b) ? -1 : num(a) > num(b) ? 1 : 0))

  return env
}

export default installMathBasic
