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

import { isList, seqVerb } from '../base/list.js'
// Small helper: tag a list with a symbol head for round-tripping.
function tag(name, ...rest) { return [new Sym(name), ...rest] }

// Euclid, on non-negative integers. Used to reduce mixed-number fractions.
function gcdInt(a, b) { while (b) { const t = b; b = a % b; a = t } return a }


// ── inline registration metadata (2026-07-22) ────────────────────
// See engineering/HOW-TO-REGISTER-A-VERB.md.
export const VERBS = [
  "math/area-model",
  "math/array",
  "math/count-on",
  "math/digit-at",
  "math/expanded-form",
  "math/fraction-bar",
  "math/integer-line",
  "math/log-base",
  "math/mixed-number",
  "math/number-line",
  "math/place-value",
  "math/ratio-bar",
  "math/round-half-up",
  "math/round-to-place",
  "math/skip-count",
]
export const LAZY = false

export function installMathPedagogy(env, fuel) {
  const def = (n, f, perm = 'read') => env.define(n, seqVerb(f), { perm })

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

  // (math/mixed-number improper-fraction) -> (whole numerator denominator) | 'nan
  //
  // 40-math.slat is the contract: a UNARY converter taking the improper
  // fraction as one `(numerator denominator)` list and returning a plain
  // three-element list, fully reduced, `'nan` when the denominator is zero.
  // All 20 documented accessors read it as (list-ref m 0/1/2) and every one of
  // the record's 16 calls passes a single list. Until 2026-08-02 this was a
  // ternary CONSTRUCTOR returning the 5-element tagged form
  // `(mixed-number w n d dec)` — a different function under the same name, so
  // `(list-ref m 1)` handed back the symbol `mixed-number` instead of a number.
  // Sign convention per :caveats — the whole part truncates toward zero and
  // the fractional numerator carries the sign, so w + n/d = num/den exactly.
  def('math/mixed-number', (frac) => {
    if (!isList(frac) || frac.length < 2) return new Sym('nan')
    let n = Math.trunc(Number(frac[0])), d = Math.trunc(Number(frac[1]))
    if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return new Sym('nan')
    if (d < 0) { n = -n; d = -d }
    const whole = Math.trunc(n / d)
    let rn = n - whole * d
    const g = gcdInt(Math.abs(rn), d) || 1
    return [whole, rn / g, d / g]
  })

  // (math/number-line low high step?) — like integer-line but with a step.
  def('math/number-line', (low, high, step) => {
    const s = step ?? 1
    const r = []; for (let x = low; x <= high; x += s) r.push(x); return r
  })

  // (math/ratio-bar a b) — tagged ratio visualization.
  def('math/ratio-bar', (a, b) => tag('ratio-bar', a, b, b ? a / b : 0))

  // (math/round-half-up x places) — round to `places` decimal places with
  // halves going AWAY FROM ZERO (unlike Math.round, which sends -0.5 to 0).
  // places=0 → integer, places=2 → cents, places=-1 → nearest ten, per
  // 40-math.slat. All 17 documented calls pass `places`; until 2026-08-02 the
  // verb took one argument and DROPPED it, so `(math/round-half-up gross 2)`
  // silently returned whole dollars — a wrong answer, not an error.
  def('math/round-half-up', (x, places) => {
    const p = places === undefined || places === null ? 0 : Math.trunc(Number(places))
    const scale = Math.pow(10, p)
    return Math.sign(x) * Math.floor(Math.abs(x) * scale + 0.5) / scale
  })

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

  // (math/place-value n) — decompose n into an a-list of (digit place) pairs,
  // most-significant first: 305 -> ((3 2) (0 1) (5 0)). Non-integer -> 'nan.
  // (The single-digit-at-a-place scalar form lives in math/digit-at.)
  def('math/place-value', (n) => {
    if (typeof n !== 'number' || !Number.isFinite(n) || !Number.isInteger(n)) {
      return new Sym('nan')
    }
    const digits = String(Math.abs(n)).split('')
    const hi = digits.length - 1
    return digits.map((d, i) => [Number(d), hi - i])
  })

  return env
}

export default installMathPedagogy
