// curves.js — THE HOUSE CURVES (lane F5-BC; THE-FLOOR-5.0 §2.3 house tokens; A3 §2, §6.2; A4 §5.1; R5 §1). Owns: the
// cubic Bézier solver kept from floorCamera.js:49-58, the three house curves (enter, exit, glide) and the packet curve,
// the raised cosine, the 50 % duty blink, smoothstep, the exact critically damped spring of A3 §6.2 with its half-life by
// mass, and the two step functions every classifier uses (an on/off delay held against logT). Lane D imports these and
// builds its LUTs from them (RULINGS §5). Refuses: any curve with overshoot (`back()` of floorMotion.js:19 is gone: the only
// overshoot on the floor is the pass spring, written in actors/worker.js and actors/mind.js), a per-frame lerp (R5 §1: it
// changes with frame rate), anything that reads a clock (every function takes its time as an argument).
// Implements: master §2.3; A3 §2, §6.2; A4 §5.1. Invariants (design §18): "a pose is a closed-form function of a record
// and logT" (nothing here holds state). Faults (§16): none.

/**
 * A cubic Bézier easing (CSS's `cubic-bezier(x1, y1, x2, y2)`), Newton's method with a bisection fallback (floorCamera.js:49).
 * @param {number} x1 @param {number} y1 @param {number} x2 @param {number} y2
 * @return {function(number): number} the eased value for `x` in [0, 1]; clamped outside
 */
export function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by
  const X = (t) => ((ax * t + bx) * t + cx) * t
  const Y = (t) => ((ay * t + by) * t + cy) * t
  const dX = (t) => (3 * ax * t + 2 * bx) * t + cx
  return (x) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let t = x
    for (let i = 0; i < 6; i++) {
      const e = X(t) - x
      const d = dX(t)
      if (Math.abs(e) < 1e-5) return Y(t)
      if (Math.abs(d) < 1e-6) break
      t -= e / d
    }
    let lo = 0
    let hi = 1
    t = x
    for (let i = 0; i < 24; i++) {
      const v = X(t)
      if (Math.abs(v - x) < 1e-5) break
      if (v < x) lo = t
      else hi = t
      t = (lo + hi) / 2
    }
    return Y(t)
  }
}

/** The enter curve, M3 emphasized decelerate (master §2.3): `E()` in A3. */
export const enter = bezier(0.05, 0.7, 0.1, 1)
/** The exit curve, M3 emphasized accelerate: `X()` in A3. */
export const exit = bezier(0.3, 0, 0.8, 0.15)
/** The house glide for travel (floorCamera.js:60): `G()` in A3. */
export const glide = bezier(0.3, 0, 0.02, 1)
/** The packet's arc easing (R5 answering row; A3 §4.12). */
export const packet = bezier(0.2, 0, 0, 1)

/**
 * Clamps to [0, 1].
 * @param {number} x
 * @return {number}
 */
export const clamp01 = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x)

/**
 * Clamps to [lo, hi].
 * @param {number} x @param {number} lo @param {number} hi
 * @return {number}
 */
export const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x)

/**
 * Hermite smoothstep (floorMotion.js:18 `ease`, kept under its proper name).
 * @param {number} k
 * @return {number}
 */
export const smoothstep = (k) => {
  const x = clamp01(k)
  return x * x * (3 - 2 * x)
}

/**
 * The raised cosine `0.5 − 0.5 cos(2πx)`: breaths and floats (A3 §2 `rc`).
 * @param {number} x
 * @return {number}
 */
export const rc = (x) => 0.5 - 0.5 * Math.cos(2 * Math.PI * x)

/**
 * A square wave at `f` Hz with 50 % duty: 1 in the lit half, 0 in the dark half (A3 §2 `blink`).
 * @param {number} f Hz
 * @param {number} dt seconds since the blink began
 * @return {number} 0 or 1
 */
export const blink = (f, dt) => (((f * dt) % 1 + 1) % 1 < 0.5 ? 1 : 0)

/**
 * The eased share of a fixed-length stage: 0 before it starts, 1 after it ends.
 * @param {number} dt seconds since the stage's start
 * @param {number} durS the stage's length in seconds
 * @param {function(number): number=} curve the house curve; the enter curve by default
 * @return {number}
 */
export const stage = (dt, durS, curve = enter) => (durS <= 0 ? 1 : curve(clamp01(dt / durS)))

/**
 * The spring's half-life by mass (A3 §6.2): `clamp(0.12 × mT, 0.12, 0.30)` seconds.
 * @param {number} mT the travel factor `0.6 + 0.5 √m`
 * @return {number} seconds
 */
export const halfLife = (mT) => clamp(0.12 * mT, 0.12, 0.3)

/**
 * The exact critically damped spring of A3 §6.2, one closed-form step of `dt` seconds from `(x0, v0)` toward `target`.
 * `x(t) = target + (Δ + (v0 + ωΔ) t) e^(−ωt)`, `v(t) = (v0 − (v0 + ωΔ) ω t) e^(−ωt)`, `ω = ln 2 / hl`.
 * @param {number} x0 @param {number} v0 @param {number} target
 * @param {number} hl the half-life in seconds
 * @param {number} dt seconds
 * @return {{x: number, v: number}}
 */
export function spring(x0, v0, target, hl, dt) {
  const w = Math.LN2 / hl
  const d = x0 - target
  const c = v0 + w * d
  const e = Math.exp(-w * dt)
  return { x: target + (d + c * dt) * e, v: (v0 - c * w * dt) * e }
}

/**
 * An on-delay or off-delay step: true once a condition has held for `delayS` seconds of logT (A3 §4: "an on-delay stops
 * a one-sample flicker from naming a state; an off-delay stops a state from clearing on one good sample").
 * @param {?number} since logT at which the condition began, or null when it does not hold
 * @param {number} delayS seconds
 * @param {number} logT seconds
 * @return {boolean}
 */
export const held = (since, delayS, logT) => since != null && logT - since >= delayS

/**
 * Exponential smoothing in closed form from the last two samples (A3 §4.1 answering row; §8: a smoother is not an integrator):
 * the value at `logT` with half-life `hlS`, starting at `prev` at `t1` and tending to `next`.
 * @param {number} prev @param {number} next @param {number} t1 @param {number} hlS @param {number} logT
 * @return {number}
 */
export const smoothed = (prev, next, t1, hlS, logT) => next + (prev - next) * Math.pow(2, -Math.max(0, logT - t1) / hlS)
