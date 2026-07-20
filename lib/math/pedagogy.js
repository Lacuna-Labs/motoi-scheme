// pedagogy.js — K-6 math visualizations + numeric predicates.
//
// Doctrine (Alfred, 2026-07-16): each K-6 verb returns a tagged list
// describing what SHOULD be drawn. If a UI adapter later paints these,
// great — for CORE the return value is inspectable at the REPL and
// carries enough data for a follow-on `draw` pass. This is the same
// pattern the media verbs (`circle`, `disc`) use: return the shape as
// data, mutate the framebuffer separately.
//
// Every verb here is pure — no framebuffer touch, no state.

import { Sym } from '../../src/reader.js'

// Small helper: tag a list with a symbol head for round-tripping.
function tag(name, ...rest) { return [new Sym(name), ...rest] }

export function installMathPedagogy(env, fuel) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  // (math/area-model a b) — visualize a*b as a rectangle of unit squares.
  def('math/area-model', (a, b) => tag('area-model', a | 0, b | 0, (a | 0) * (b | 0)))

  // (math/array rows cols) — grid of dots representing an array model.
  def('math/array', (rows, cols) => tag('array', rows | 0, cols | 0, (rows | 0) * (cols | 0)))

  // (math/count-on start n) — return list [start, start+1, ..., start+n-1]
  def('math/count-on', (start, n) => {
    const r = []; for (let i = 0; i < (n | 0); i++) r.push((start | 0) + i); return r
  })

  // (math/digit-at n place) — extract the digit at 10^place.
  def('math/digit-at', (n, place) => {
    const p = Math.pow(10, place | 0)
    return Math.floor(Math.abs(n) / p) % 10
  })

  // (math/expanded-form n) — list of place-value components. 132 → (100 30 2)
  //
  // Special case: (math/expanded-form 0) → (0). Every other number drops
  // zero-place components (205 → (200 5), not (200 0 5)).
  def('math/expanded-form', (n) => {
    const nn = n | 0
    if (nn === 0) return [0]
    const s = String(Math.abs(nn))
    const out = []
    for (let i = 0; i < s.length; i++) {
      const d = +s[i]
      if (d === 0) continue
      out.push(d * Math.pow(10, s.length - 1 - i))
    }
    return out
  })

  // (math/fraction-bar num den) — tagged fraction visualization.
  def('math/fraction-bar', (num, den) => tag('fraction-bar', num | 0, den | 0, den ? num / den : 0))

  // (math/integer-line low high) — return the integer sequence low..high.
  def('math/integer-line', (low, high) => {
    const r = []; for (let i = low | 0; i <= (high | 0); i++) r.push(i); return r
  })

  // (math/log-base n b) — logarithm of n in base b.
  def('math/log-base', (n, b) => Math.log(n) / Math.log(b))

  // (math/mixed-number whole num den) — tagged mixed fraction. 1 1/2.
  def('math/mixed-number', (whole, num, den) => {
    const dec = (whole | 0) + (den ? num / den : 0)
    return tag('mixed-number', whole | 0, num | 0, den | 0, dec)
  })

  // (math/number-line low high step?) — like integer-line but with a step.
  def('math/number-line', (low, high, step) => {
    const s = step ?? 1
    const r = []; for (let x = low; x <= high; x += s) r.push(x); return r
  })

  // (math/ratio-bar a b) — tagged ratio visualization.
  def('math/ratio-bar', (a, b) => tag('ratio-bar', a, b, b ? a / b : 0))

  // (math/round-half-up x) — round with halves going up (unlike Math.round
  // which rounds -0.5 to 0).
  def('math/round-half-up', (x) => Math.sign(x) * Math.floor(Math.abs(x) + 0.5))

  // (math/round-to-place x place) — round to nearest 10^place. place=0 →
  // to nearest integer; place=-1 → to nearest tenth; place=2 → to nearest 100.
  //
  // Naive `Math.round(x/p)*p` inherits IEEE-754 ghosts (21.44 → 21.4 →
  // 21.400000000000002). For negative place we route through exponential
  // notation so the shift happens at parse time (exact) instead of via a
  // float divide/multiply pair. This keeps the result an exact decimal
  // representation the way a kid learning place-value expects.
  def('math/round-to-place', (x, place) => {
    const pl = place | 0
    if (!Number.isFinite(x)) return x
    if (pl < 0) {
      // Negative place → decimal places. -1 → 1 dp, -2 → 2 dp, ...
      const digits = Math.min(15, -pl)   // 15 ≈ IEEE-754 double precision
      const shifted = Math.round(Number(x + 'e' + digits))
      return Number(shifted + 'e-' + digits)
    }
    const p = Math.pow(10, pl)
    return Math.round(x / p) * p
  })

  // (math/skip-count start step n) — list of n numbers, incrementing by step.
  def('math/skip-count', (start, step, n) => {
    const r = []; for (let i = 0; i < (n | 0); i++) r.push(start + i * step); return r
  })

  // (math/place-value n place) — value of the digit at 10^place. 132, 1 → 30.
  def('math/place-value', (n, place) => {
    const p = Math.pow(10, place | 0)
    return (Math.floor(Math.abs(n) / p) % 10) * p
  })

  return env
}

export default installMathPedagogy
