// basic.js — arithmetic, powers, logs, aggregate, GCD/LCM.
//
// Doctrine (Alfred, 2026-07-16): every CORE `math/*` verb is a pure function
// on numbers. No state, no logging, no side effects. Kid-friendly: `math/sum`
// takes a list, `math/avg` takes a list, `math/lerp` takes three numbers.
// Named `math/*` deliberately — the plain `+`, `sqrt`, etc. are still in
// makeBaseEnv; these are the namespaced siblings kids can grep-find.

export function installMathBasic(env, fuel) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  // Constants (namespaced siblings of const/*).
  def('math/pi', () => Math.PI)
  def('math/tau', () => Math.PI * 2)
  def('math/e', () => Math.E)

  // Single-argument math primitives.
  def('math/sqrt', (x) => Math.sqrt(x))
  def('math/floor', (x) => Math.floor(x))
  def('math/ceil', (x) => Math.ceil(x))
  def('math/round', (x) => Math.round(x))
  def('math/square', (x) => x * x)
  def('math/cube', (x) => x * x * x)
  def('math/exp', (x) => Math.exp(x))
  def('math/log', (x) => Math.log(x))
  def('math/log10', (x) => Math.log10(x))
  def('math/log2', (x) => Math.log2(x))

  // Two-argument.
  def('math/pow', (x, y) => Math.pow(x, y))
  def('math/hypot', (...xs) => Math.hypot(...xs))
  // `| 0` would truncate to 32-bit signed integer; math/gcd is meant to
  // work on any positive whole number. Use Math.trunc + Math.abs so values
  // above 2^31 don't wrap into negatives. Non-integer inputs still get
  // truncated to their integer part (Scheme integer gcd semantics).
  def('math/gcd', (a, b) => {
    a = Math.abs(Math.trunc(a)); b = Math.abs(Math.trunc(b))
    while (b) { const t = b; b = a % b; a = t }
    return a
  })
  def('math/lcm', (a, b) => {
    const A = Math.abs(Math.trunc(a))
    const B = Math.abs(Math.trunc(b))
    const g = (function gcd(x, y) {
      while (y) { const t = y; y = x % y; x = t }
      return x
    })(A, B)
    return g === 0 ? 0 : (A * B) / g
  })

  // Three-argument.
  def('math/lerp', (a, b, t) => a + (b - a) * t)
  def('math/clamp', (x, lo, hi) => Math.max(lo, Math.min(hi, x)))

  // Aggregations over a list.
  def('math/sum', (xs) => {
    if (!Array.isArray(xs)) return 0
    let s = 0; for (const x of xs) s += x
    return s
  })
  def('math/avg', (xs) => {
    if (!Array.isArray(xs) || xs.length === 0) return 0
    let s = 0; for (const x of xs) s += x
    return s / xs.length
  })

  // Percentage (returns 0..100 by convention).
  def('math/pct', (part, whole) => {
    if (!whole) return 0
    return (part / whole) * 100
  })

  // Compare: -1, 0, 1.
  def('math/compare', (a, b) => (a < b ? -1 : a > b ? 1 : 0))

  return env
}

export default installMathBasic
