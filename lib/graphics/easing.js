// easing.js — named easings + cubic-bezier + spring physics.
//
// Created 2026-07-16 as the easing lane of the animation+physics build.
//
// One file, three shapes:
//   1. Named easings for the 90% case: `easing/emphasized`, `easing/standard`,
//      `easing/decelerated`, `easing/accelerated`, plus the classics
//      (linear, ease-in, ease-out, ease-in-out) and `easing/spring`.
//   2. `(bezier-ease t x1 y1 x2 y2)` — the raw cubic-bezier math. Portable,
//      pure, no adapter. Kids can copy the numbers off a design blog and
//      get the same curve.
//   3. `(spring-ease t opts)` — physics-based easing with mass / tension /
//      friction. Default is the classic mobile-app spring
//      (mass=1, tension=170, friction=26).
//
// All easings map t ∈ [0, 1] → eased-t ∈ [0, 1] (approximately — some
// springs overshoot past 1 and settle back; that's the point of a spring).
//
// Kid-readable version: an easing curve is HOW SOMETHING SPEEDS UP OR
// SLOWS DOWN. `easing/linear` = constant speed (boring). `easing/ease-out`
// = slows to a stop (natural). `easing/spring` = bounces at the end
// (fun). Pass one to `motion` or `bounce` and the animation feels right.

import { Sym, sym } from '../../src/reader.js'

const nm = (x) => (x instanceof Sym ? x.name : x)

// ── named-easing table ──────────────────────────────────────────────
//
// Google Material's motion curves + classic timing functions. Each
// value is a 4-tuple [x1, y1, x2, y2] for a cubic-bezier where the
// endpoints are fixed at (0,0) and (1,1).

export const NAMED_EASINGS = Object.freeze({
  // Google Material curves.
  'emphasized':    [0.2,  0.0, 0.0,  1.0],
  'standard':      [0.4,  0.0, 0.2,  1.0],
  'decelerated':   [0.0,  0.0, 0.2,  1.0],
  'accelerated':   [0.4,  0.0, 1.0,  1.0],
  // Classic CSS timing functions.
  'linear':        null,  // pass-through, no bezier needed
  'ease':          [0.25, 0.1, 0.25, 1.0],
  'ease-in':       [0.42, 0.0, 1.0,  1.0],
  'ease-out':      [0.0,  0.0, 0.58, 1.0],
  'ease-in-out':   [0.42, 0.0, 0.58, 1.0],
  // Spring is a special-case; NAMED_EASINGS just marks it as recognized.
  'spring':        'spring',
})

// ── cubic-bezier — the workhorse ────────────────────────────────────
//
// Numerical root-find on the x-component of a bezier with fixed
// endpoints (0,0)/(1,1) and control points (x1, y1) / (x2, y2), then
// evaluate y at the found parameter. Newton + bisection fallback —
// same shape browsers use for CSS timing functions.
//
// Returns a number, typically in [0, 1] (extrapolation is possible for
// exotic control points; that's fine — callers know their curve).

export function bezierEase(t, x1, y1, x2, y2) {
  // Clamp t: eased curves outside [0,1] are almost always a bug in the
  // driver. Springs overshoot in a DIFFERENT function.
  if (!Number.isFinite(t)) return 0
  if (t <= 0) return 0
  if (t >= 1) return 1

  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by

  const sampleCurveX = (p) => ((ax * p + bx) * p + cx) * p
  const sampleCurveY = (p) => ((ay * p + by) * p + cy) * p
  const sampleCurveDerivX = (p) => (3 * ax * p + 2 * bx) * p + cx

  // Newton-Raphson: fast when the derivative is well-behaved.
  let p = t
  for (let i = 0; i < 8; i++) {
    const x = sampleCurveX(p) - t
    if (Math.abs(x) < 1e-6) return sampleCurveY(p)
    const d = sampleCurveDerivX(p)
    if (Math.abs(d) < 1e-6) break
    p = p - x / d
  }

  // Bisection fallback — always converges.
  let lo = 0, hi = 1
  p = t
  while (lo < hi) {
    const x = sampleCurveX(p)
    if (Math.abs(x - t) < 1e-6) return sampleCurveY(p)
    if (t > x) lo = p
    else hi = p
    p = (hi - lo) / 2 + lo
  }
  return sampleCurveY(p)
}

// ── named-ease dispatcher ───────────────────────────────────────────
//
// Accepts either a symbol ('emphasized, 'standard, ...) or the raw
// string. Returns eased t; on unknown name returns linear (t itself).

export function namedEase(t, name) {
  const key = String(nm(name) ?? 'linear').toLowerCase()
  // Accept both 'linear and 'easing/linear as inputs.
  const short = key.startsWith('easing/') ? key.slice(7) : key
  if (short === 'spring') return springEase(t)
  const spec = NAMED_EASINGS[short]
  if (spec === undefined) return t   // unknown → linear
  if (spec === null) return t        // linear
  return bezierEase(t, spec[0], spec[1], spec[2], spec[3])
}

// ── spring physics — closed-form damped oscillator ──────────────────
//
// The React Spring / iOS spring is a damped harmonic oscillator with
// mass m, stiffness k (tension), and damping c (friction). Solved in
// closed form:
//
//   underdamped (c² < 4mk):  y(t) = 1 - e^(-ζωₙt) · [cos(ωd t) + (ζ / √(1-ζ²)) sin(ωd t)]
//   critically damped:       y(t) = 1 - e^(-ωₙt) · (1 + ωₙ t)
//   overdamped:              y(t) = 1 - (a₁ e^(r₁ t) + a₂ e^(r₂ t))
//
// where ωₙ = √(k/m) and ζ = c / (2√(mk)).
//
// We map input t ∈ [0, 1] to a time-in-seconds by SCALING against the
// spring's natural period — so t=0 is start, t≈1 is settled. Springs
// can overshoot; callers who need a strict [0,1] range should clamp.

export function springEase(t, opts = {}) {
  if (!Number.isFinite(t) || t <= 0) return 0
  const mass     = Math.max(1e-6, Number(opts.mass)     || 1)
  const tension  = Math.max(1e-6, Number(opts.tension)  || 170)
  const friction = Math.max(0,    Number(opts.friction) || 26)

  const omega0 = Math.sqrt(tension / mass)          // natural freq
  const zeta = friction / (2 * Math.sqrt(mass * tension))  // damping ratio

  // Map t=[0,1] onto a duration that lets the spring settle. A
  // heuristic: 5 time-constants of decay covers >99% settling.
  const timeConstant = 1 / (zeta * omega0 || omega0)
  const duration = Math.max(0.1, 5 * timeConstant)
  const time = t * duration

  if (zeta < 1) {
    // Underdamped — oscillates.
    const omegaD = omega0 * Math.sqrt(1 - zeta * zeta)
    const env = Math.exp(-zeta * omega0 * time)
    return 1 - env * (Math.cos(omegaD * time) + (zeta / Math.sqrt(1 - zeta * zeta)) * Math.sin(omegaD * time))
  } else if (zeta === 1) {
    // Critically damped — fastest non-oscillating.
    const env = Math.exp(-omega0 * time)
    return 1 - env * (1 + omega0 * time)
  } else {
    // Overdamped — slow, no oscillation.
    const r = omega0 * Math.sqrt(zeta * zeta - 1)
    const a = zeta * omega0
    return 1 - Math.exp(-a * time) * (Math.cosh(r * time) + (a / r) * Math.sinh(r * time))
  }
}

// ── installer ───────────────────────────────────────────────────────

export function installEasing(env) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  // Named-easing symbols. Bind BOTH the short and long forms so
  // `(motion ... :easing 'emphasized)` and `easing/emphasized` both work.
  const symbols = ['emphasized', 'standard', 'decelerated', 'accelerated',
                   'linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out',
                   'spring']
  for (const name of symbols) {
    env.define('easing/' + name, sym('easing/' + name), { perm: 'read' })
  }

  // (bezier-ease t x1 y1 x2 y2) → number  (5-arg form: eval at t)
  // (bezier-ease x1 y1 x2 y2)   → procedure (4-arg form: return a curve)
  //   Two arities:
  //     · 5-arg — the raw cubic-bezier eval at a specific t. Same math
  //       as CSS cubic-bezier(). Returns a number in [0,1].
  //     · 4-arg — matches the reference signature; returns a procedure
  //       (t) → eased-t so the value can be handed to any `:easing`
  //       keyword. This lets a design-spec cubic-bezier(x1,y1,x2,y2)
  //       transfer directly.
  def('bezier-ease', (...args) => {
    if (args.length >= 5) {
      const [t, x1, y1, x2, y2] = args
      return bezierEase(Number(t) || 0, Number(x1) || 0, Number(y1) || 0,
                                         Number(x2) || 0, Number(y2) || 0)
    }
    // 4-arg curve form.
    const [x1, y1, x2, y2] = args
    const a = Number(x1) || 0, b = Number(y1) || 0
    const c = Number(x2) || 0, d = Number(y2) || 0
    const curve = (t) => bezierEase(Number(t) || 0, a, b, c, d)
    curve.__easing = 'bezier'
    return curve
  })

  // (named-ease t name) → number      (2-arg form: eval at t)
  // (named-ease name)    → procedure  (1-arg form: return a curve)
  //   Same two shapes as bezier-ease. Unknown names return the linear
  //   curve; symbols and 'easing/xxx forms both work.
  def('named-ease', (...args) => {
    if (args.length >= 2) {
      const [t, name] = args
      return namedEase(Number(t) || 0, name)
    }
    const [name] = args
    const curve = (t) => namedEase(Number(t) || 0, name)
    curve.__easing = 'named'
    return curve
  })

  // (spring-ease t [opts]) → number     (2-arg-with-t form: eval at t)
  // (spring-ease [opts])    → procedure (0/1-arg form: return a curve)
  //   Detect: if the FIRST arg is numeric AND we have zero-or-one more
  //   args, treat it as an eval-at-t call. Otherwise return a curve.
  //   Springs may overshoot 1 — that's the spring feel.
  def('spring-ease', (...args) => {
    if (args.length >= 1 && typeof args[0] === 'number') {
      const [t, opts] = args
      return springEase(Number(t) || 0, optListToObj(opts))
    }
    // Zero args or opts-only → curve.
    const o = optListToObj(args[0])
    const curve = (t) => springEase(Number(t) || 0, o)
    curve.__easing = 'spring'
    return curve
  })

  // (easing/apply name t [opts]) → number
  //   The one-verb convenience — takes a name and dispatches to the
  //   right function. Springs use opts; bezier easings ignore opts.
  def('easing/apply', (name, t, opts) => {
    const key = String(nm(name) ?? 'linear').toLowerCase()
    const short = key.startsWith('easing/') ? key.slice(7) : key
    if (short === 'spring') return springEase(Number(t) || 0, optListToObj(opts))
    return namedEase(Number(t) || 0, name)
  })

  return env
}

// Turn a Scheme-shaped option list ((k v k v ...) or ((k v) (k v))) into
// a plain object. Keys arrive as Syms; we normalize to string names.
function optListToObj(opts) {
  const o = {}
  if (!Array.isArray(opts)) return o
  // Flat form: (mass 1 tension 170 friction 26)
  if (opts.length > 0 && !Array.isArray(opts[0])) {
    for (let i = 0; i < opts.length - 1; i += 2) {
      const k = String(nm(opts[i]))
      o[k] = opts[i + 1]
    }
    return o
  }
  // Alist form: ((mass 1) (tension 170) (friction 26))
  for (const pair of opts) {
    if (Array.isArray(pair) && pair.length >= 2) {
      o[String(nm(pair[0]))] = pair[1]
    }
  }
  return o
}

export default installEasing
