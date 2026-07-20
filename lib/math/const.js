// const.js — mathematical constants.
//
// Doctrine (Alfred, 2026-07-16): CORE constants are `const/pi`, `const/tau`,
// `const/e`, `const/phi`. Every constant is a zero-arg procedure that
// returns the value — this keeps them uniform with the other verb dispatch
// pattern and makes them safe to shadow at binding sites.
//
// A parallel set of `math/pi` etc. lives in lib/math/basic.js. Same values,
// different name so kids can `(math/pi)` without dragging in the `const/`
// namespace.

export function installConst(env, fuel) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  // Pi. 3.141592653589793.
  def('const/pi', () => Math.PI)
  // Tau = 2 * pi. 6.283185307179586.
  def('const/tau', () => Math.PI * 2)
  // Euler's number. 2.718281828459045.
  def('const/e', () => Math.E)
  // Golden ratio (1 + sqrt(5)) / 2. 1.618033988749895.
  def('const/phi', () => (1 + Math.sqrt(5)) / 2)

  return env
}

export default installConst
