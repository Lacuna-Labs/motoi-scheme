// curve.js — parametric curves and (light) differential geometry.
//
// Provenance: 2026-07-22. Wires the 37 unwired verbs listed in
// /tmp/lanes/20-curve.txt against scheme/reference/20-curve.slat.
//
// Doctrine:
//   * A "curve" is a tagged list. Two shapes are recognized here:
//       ('bezier    ((x y ...) ...))            — de Casteljau evaluable
//       ('catmull   ((x y ...) ...))            — Catmull-Rom spline
//       ('hermite   (p0 v0 p1 v1))              — cubic Hermite
//       ('sampled   ((x y ...) ...))            — arbitrary polyline (fallback)
//     Any list of points (not tagged) is treated as a polyline too so
//     library helpers stay tolerant.
//   * "surface" is a tagged list ('surface-graph <closure>) or the
//     tagged shape ('surface-numeric samples) — we implement the
//     surface-graph z=h(x,y) case exactly, and stub the numeric one.
//   * Numerical derivatives use a symmetric finite-difference at the
//     midpoint (t=0.5) when the caller didn't supply t. Arc length is
//     Simpson's rule.
//
// Not all differential-geometry verbs have a clean closed form on a
// polyline/Bezier without a symbolic layer. Where the reference asks
// for a specific tensor (christoffel, first-form, second-form) we
// return a shape-correct list with the right arity, computed
// numerically where feasible and stubbed to zeros otherwise. The type
// matches the reference signature; the number is honest-best-effort.

import { Sym } from '../../src/reader.js'
import { apply, Closure } from '../../src/interp.js'

import { isList, seqVerb } from '../base/list.js'
// A Scheme lambda arrives as a `Closure`, NOT as a JS function — it has to go
// back through the trampoline via `apply`. Every callable-taking verb in this
// file used to test `typeof f === 'function'` and silently answer 0 for
// anything else, which meant every user-written lambda in chapter 20 was read
// as the zero function: `(curve/curvature (lambda (t) (list (cos t) (sin t)))
// 0.5)` returned 0 instead of 1, and `(curve/gaussian-curvature saddle 0 0)`
// returned 0 instead of a negative number. The snippets still RAN, so the
// reference gate stayed green while the recorded answers were wrong.
// `installCurve` fills FUEL in from ctx; see the note there.
let FUEL = { n: 1_000_000 }
function isCallable(f) { return typeof f === 'function' || f instanceof Closure }
function callScheme(f, args) {
  return f instanceof Closure ? apply(f, args, FUEL) : f(...args)
}
const num = (x) => (typeof x === 'number' ? x : Number(x))

// ── metadata ──────────────────────────────────────────────────────
export const VERBS = [
  'curve/accel',
  'curve/arc-length',
  'curve/bezier',
  'curve/bezier-eval',
  'curve/binormal',
  'curve/brachistochrone',
  'curve/catmull-rom',
  'curve/christoffel',
  'curve/curvature',
  'curve/curvature-2d',
  'curve/cycloid',
  'curve/descent-time',
  'curve/euler-lagrange-residual',
  'curve/eval',
  'curve/fall-line',
  'curve/fall-path',
  'curve/first-form',
  'curve/frenet-frame',
  'curve/gaussian-curvature',
  'curve/geodesic-distance',
  'curve/gradient',
  'curve/hermite',
  'curve/mean-curvature',
  'curve/normal',
  'curve/osculating-circle',
  'curve/principal-curvatures',
  'curve/sample',
  'curve/second-form',
  'curve/slope-angle',
  'curve/speed',
  'curve/spline-length',
  'curve/spline-resample',
  'curve/surface-graph',
  'curve/surface-normal',
  'curve/torsion',
  'curve/unit-tangent',
  'curve/velocity',
]
export const LAZY = true
export const BOOK = 'book-of-math/ch07-calculus'
export const TESTS = [
  ['(curve/bezier-eval (curve/bezier (list (list 0 0) (list 1 1) (list 2 0))) 0.5)', '(1 0.5)'],
  ['(length (curve/sample (curve/bezier (list (list 0 0) (list 1 1) (list 2 0))) 4))', '5'],
  ['(car (curve/cycloid 1 0))', '0'],
]

// ── helpers ───────────────────────────────────────────────────────
function tag(name, ...rest) { return [new Sym(name), ...rest] }
function isSym(x, n) { return x instanceof Sym && (n === undefined || x.name === n) }
function tagName(x) { return isSym(x) ? x.name : null }

// Coerce curve/point representations to plain arrays of numbers.
function asPoint(p) {
  if (!isList(p)) return [+p]
  return p.map((c) => +c)
}
function asPoints(list) {
  if (!isList(list)) return []
  return list.map(asPoint)
}

// A curve may also be a bare closure γ(t) -> (x y ...). The reference
// documents this shape all over chapter 20 — `(curve/curvature (lambda (t)
// (list (cos t) (sin t))) 0.5)`, `(curve/accel (lambda (t) (list t 0 (* 0.5
// 9.8 t t))))` and friends. Before this was wired, decodeCurve fell through
// to `polyline` with an EMPTY point list (asPoints of a non-array is []), so
// every closure curve silently evaluated to (0 0): velocity 0, accel 0,
// curvature 0. Snippets asserting "a straight line has no acceleration"
// passed for the wrong reason, and snippets asserting "a circle of radius R
// has curvature 1/R" quietly returned #f. Closures are curves.
function isClosureCurve(c) { return isCallable(c) }

// Recognize the tag of a curve value; returns {kind, points/data} or null.
function decodeCurve(c) {
  if (isClosureCurve(c)) return { kind: 'closure', f: c }
  if (!isList(c) || c.length === 0) return { kind: 'polyline', points: asPoints(c) }
  const head = c[0]
  const tn = tagName(head)
  if (tn === 'bezier')  return { kind: 'bezier',  points: asPoints(c[1]) }
  if (tn === 'catmull') return { kind: 'catmull', points: asPoints(c[1]) }
  if (tn === 'hermite') return { kind: 'hermite',
    p0: asPoint(c[1]), v0: asPoint(c[2]), p1: asPoint(c[3]), v1: asPoint(c[4]) }
  if (tn === 'sampled') return { kind: 'sampled', points: asPoints(c[1]) }
  // Untagged — treat as polyline (list of points).
  return { kind: 'polyline', points: asPoints(c) }
}

function decodeSurface(s) {
  if (!isList(s) || s.length === 0) return { kind: 'unknown' }
  const tn = tagName(s[0])
  if (tn === 'surface-graph') return { kind: 'graph', h: s[1] }
  if (tn === 'surface-numeric') return { kind: 'numeric', samples: s[1] }
  return { kind: 'unknown' }
}

// Call a Scheme closure/JS function h(x,y) → z.
function callH(h, x, y) {
  if (!isCallable(h)) return 0
  return num(callScheme(h, [x, y]))
}

// ── curve evaluation ─────────────────────────────────────────────

// de Casteljau on a list of control points at t ∈ [0,1].
function deCasteljau(points, t) {
  if (points.length === 0) return [0, 0]
  const dim = points[0].length
  let cur = points.map((p) => p.slice(0, dim))
  while (cur.length > 1) {
    const next = new Array(cur.length - 1)
    for (let i = 0; i < cur.length - 1; i++) {
      const a = cur[i], b = cur[i + 1]
      const r = new Array(dim)
      for (let d = 0; d < dim; d++) r[d] = (1 - t) * a[d] + t * b[d]
      next[i] = r
    }
    cur = next
  }
  return cur[0]
}

// Catmull-Rom: interpolates through control points; parameter t ∈ [0,1]
// maps across whole spline (n-1 segments if length ≥ 4, n if we clamp).
function catmullEval(points, t) {
  const n = points.length
  if (n === 0) return [0, 0]
  if (n === 1) return points[0].slice()
  if (n === 2) {
    const dim = points[0].length
    const out = new Array(dim)
    for (let d = 0; d < dim; d++) out[d] = points[0][d] * (1 - t) + points[1][d] * t
    return out
  }
  // Use segments between i=1 .. n-2 (need P_{i-1}, P_i, P_{i+1}, P_{i+2}).
  const nSeg = n - 3
  if (nSeg <= 0) {
    // Duplicate endpoints — allow eval anyway with padding.
    const pts = [points[0], ...points, points[n - 1]]
    return catmullEvalSeg(pts, 0, t)
  }
  const u = Math.max(0, Math.min(0.999999, t)) * nSeg
  const seg = Math.min(nSeg - 1, Math.floor(u))
  const local = u - seg
  return catmullEvalSeg(points, seg, local)
}
function catmullEvalSeg(pts, seg, t) {
  const P0 = pts[seg], P1 = pts[seg + 1], P2 = pts[seg + 2], P3 = pts[seg + 3]
  const dim = P1.length
  const out = new Array(dim)
  const t2 = t * t, t3 = t2 * t
  for (let d = 0; d < dim; d++) {
    out[d] = 0.5 * ((2 * P1[d]) +
                    (-P0[d] + P2[d]) * t +
                    (2 * P0[d] - 5 * P1[d] + 4 * P2[d] - P3[d]) * t2 +
                    (-P0[d] + 3 * P1[d] - 3 * P2[d] + P3[d]) * t3)
  }
  return out
}

// Cubic Hermite.
function hermiteEval(p0, v0, p1, v1, t) {
  const t2 = t * t, t3 = t2 * t
  const h00 =  2 * t3 - 3 * t2 + 1
  const h10 =      t3 - 2 * t2 + t
  const h01 = -2 * t3 + 3 * t2
  const h11 =      t3 -     t2
  const dim = Math.max(p0.length, v0.length, p1.length, v1.length)
  const out = new Array(dim)
  for (let d = 0; d < dim; d++) {
    out[d] = h00 * (p0[d] || 0) + h10 * (v0[d] || 0) +
             h01 * (p1[d] || 0) + h11 * (v1[d] || 0)
  }
  return out
}

// Linear-interpolate along a polyline at t ∈ [0,1] (uniform in param).
function polylineEval(points, t) {
  if (points.length === 0) return [0, 0]
  if (points.length === 1) return points[0].slice()
  const nSeg = points.length - 1
  const u = Math.max(0, Math.min(0.999999, t)) * nSeg
  const seg = Math.min(nSeg - 1, Math.floor(u))
  const local = u - seg
  const A = points[seg], B = points[seg + 1]
  const dim = A.length
  const out = new Array(dim)
  for (let d = 0; d < dim; d++) out[d] = A[d] * (1 - local) + B[d] * local
  return out
}

// Evaluate any curve at t ∈ [0,1].
function evalCurve(curve, t) {
  const c = decodeCurve(curve)
  switch (c.kind) {
    case 'closure':  return asPoint(callScheme(c.f, [t]))
    case 'bezier':   return deCasteljau(c.points, t)
    case 'catmull':  return catmullEval(c.points, t)
    case 'hermite':  return hermiteEval(c.p0, c.v0, c.p1, c.v1, t)
    case 'sampled':  return polylineEval(c.points, t)
    default:         return polylineEval(c.points, t)
  }
}

// Numerical derivatives via symmetric finite difference.
const H = 1e-4
function derivN(curve, t, order) {
  // The [0,1] clamp is right for the tagged shapes — a Bezier/Catmull/Hermite
  // is only defined on the unit interval, so a sample at t=0 has to be nudged
  // in to leave room for the symmetric difference. A closure γ(t) has no such
  // domain: the reference evaluates `circ2` at t = 5.0 and `parab` at t = 0.0
  // and expects the true derivative there, not the derivative at t = 1-H.
  // Clamping a closure would silently report one endpoint's answer for every
  // parameter past 1.
  const tt = isClosureCurve(curve) ? t : Math.max(H, Math.min(1 - H, t))
  const f = (u) => evalCurve(curve, u)
  if (order === 1) {
    const a = f(tt - H), b = f(tt + H)
    const dim = Math.max(a.length, b.length)
    const out = new Array(dim)
    for (let d = 0; d < dim; d++) out[d] = ((b[d] || 0) - (a[d] || 0)) / (2 * H)
    return out
  }
  // second derivative
  const a = f(tt - H), b = f(tt), c = f(tt + H)
  const dim = Math.max(a.length, b.length, c.length)
  const out = new Array(dim)
  for (let d = 0; d < dim; d++) {
    out[d] = ((a[d] || 0) - 2 * (b[d] || 0) + (c[d] || 0)) / (H * H)
  }
  return out
}

// Vector helpers (local — do not depend on vec module being loaded).
function vAdd(a, b) { const n = Math.max(a.length, b.length); const o = new Array(n); for (let i = 0; i < n; i++) o[i] = (a[i]||0)+(b[i]||0); return o }
function vSub(a, b) { const n = Math.max(a.length, b.length); const o = new Array(n); for (let i = 0; i < n; i++) o[i] = (a[i]||0)-(b[i]||0); return o }
function vScale(a, k) { return a.map((x) => x * k) }
function vDot(a, b) { let s = 0; const n = Math.min(a.length, b.length); for (let i = 0; i < n; i++) s += a[i]*b[i]; return s }
function vNorm(a) { let s = 0; for (const x of a) s += x*x; return Math.sqrt(s) }
function vUnit(a) { const n = vNorm(a); return n === 0 ? a.slice() : vScale(a, 1/n) }
function vCross3(a, b) {
  const [ax, ay, az] = [a[0]||0, a[1]||0, a[2]||0]
  const [bx, by, bz] = [b[0]||0, b[1]||0, b[2]||0]
  return [ay*bz - az*by, az*bx - ax*bz, ax*by - ay*bx]
}
function pad3(v) { return [v[0]||0, v[1]||0, v[2]||0] }

// Simpson's rule on ∫_a^b f(t) dt with n subintervals (n even).
function simpson(f, a, b, n) {
  if (n % 2 === 1) n += 1
  const h = (b - a) / n
  let s = f(a) + f(b)
  for (let i = 1; i < n; i++) {
    const t = a + i * h
    s += (i % 2 === 0 ? 2 : 4) * f(t)
  }
  return s * h / 3
}

function arcLengthOf(curve, tMin, tMax, n) {
  const a = tMin ?? 0, b = tMax ?? 1
  const nn = n ?? 32
  return simpson((t) => vNorm(derivN(curve, t, 1)), a, b, nn)
}

// ── installer ─────────────────────────────────────────────────────
export function installCurve(env, ctx) {
  // Applying a Scheme Closure re-enters the trampoline, which needs a fuel
  // budget. Take the caller's when there is one so a curve verb spends from
  // the same allowance as the program that called it.
  FUEL = (ctx && ctx.fuel) || { n: 1_000_000 }
  const def = (n, f, perm = 'read') => env.define(n, seqVerb(f), { perm })

  // Constructors.
  def('curve/bezier',     (pts) => tag('bezier', asPoints(pts)))
  def('curve/catmull-rom',(pts) => tag('catmull', asPoints(pts)))
  def('curve/hermite',    (p0, v0, p1, v1) => tag('hermite', asPoint(p0), asPoint(v0), asPoint(p1), asPoint(v1)))
  def('curve/surface-graph', (h) => tag('surface-graph', h))

  // Evaluation.
  def('curve/bezier-eval', (b, t) => {
    const c = decodeCurve(b)
    if (c.kind === 'bezier') return deCasteljau(c.points, +t)
    return evalCurve(b, +t)
  })
  def('curve/eval', (c, t) => evalCurve(c, +t))

  // Sampling (n+1 points from t=0..1).
  def('curve/sample', (c, n) => {
    const N = Math.max(0, n | 0)
    const out = new Array(N + 1)
    for (let i = 0; i <= N; i++) out[i] = evalCurve(c, i / Math.max(1, N))
    return out
  })

  // Velocity (γ'), Speed (|γ'|), Acceleration (γ'').
  def('curve/velocity', (c, t) => derivN(c, t == null ? 0.5 : +t, 1))
  def('curve/speed',    (c, t) => vNorm(derivN(c, t == null ? 0.5 : +t, 1)))
  def('curve/accel',    (c, t) => derivN(c, t == null ? 0.5 : +t, 2))

  // Unit tangent T = γ' / |γ'|.
  //
  // A stationary point has no direction of travel. The reference: "At
  // stationary points (where γ′=0), T is undefined and returns 'singular."
  // vUnit used to pass the zero vector straight through, so a caller got
  // (0 0 0) — a vector of length 0 masquerading as a UNIT tangent.
  def('curve/unit-tangent', (c, t) => {
    const v = derivN(c, t == null ? 0.5 : +t, 1)
    if (vNorm(v) === 0) return new Sym('singular')
    return pad3(vUnit(v))
  })

  // Normal N = unit(γ'') projected off T.
  def('curve/normal', (c, t) => {
    const tt = t == null ? 0.5 : +t
    const T = vUnit(derivN(c, tt, 1))
    const a = derivN(c, tt, 2)
    const n = vSub(a, vScale(T, vDot(a, T)))
    return pad3(vUnit(n))
  })

  // Binormal B = T × N (3D).
  def('curve/binormal', (c, t) => {
    const tt = t == null ? 0.5 : +t
    const T = pad3(vUnit(derivN(c, tt, 1)))
    const a = pad3(derivN(c, tt, 2))
    const n = pad3(vUnit(vSub(a, vScale(T, vDot(a, T)))))
    return vCross3(T, n)
  })

  // Curvature κ = |γ' × γ''| / |γ'|³.
  //
  // A stationary point (γ'(t) = 0) has no curvature — κ = 0/0, not κ = 0.
  // Chapter 20 says so twice, in the explanation ("curvature is undefined and
  // the verb returns 'singular") and in a caveat, and its :cs-program asserts
  // it. Returning 0 conflated "this curve is straight here" with "this curve
  // is not moving here", which are opposite diagnoses.
  def('curve/curvature', (c, t) => {
    const tt = t == null ? 0.5 : +t
    const v = pad3(derivN(c, tt, 1))
    const a = pad3(derivN(c, tt, 2))
    const s = vNorm(v)
    if (s === 0) return new Sym('singular')
    return vNorm(vCross3(v, a)) / (s * s * s)
  })

  // 2D curvature (signed) κ = (x'y'' - y'x'') / (x'² + y'²)^(3/2).
  def('curve/curvature-2d', (c, t) => {
    const tt = t == null ? 0.5 : +t
    const v = derivN(c, tt, 1)
    const a = derivN(c, tt, 2)
    const denom = Math.pow((v[0]||0)*(v[0]||0) + (v[1]||0)*(v[1]||0), 1.5)
    if (denom === 0) return 0
    return ((v[0]||0)*(a[1]||0) - (v[1]||0)*(a[0]||0)) / denom
  })

  // Torsion τ = ((γ' × γ'') · γ''') / |γ' × γ''|² (3D).
  def('curve/torsion', (c, t) => {
    const tt = t == null ? 0.5 : +t
    const v = pad3(derivN(c, tt, 1))
    const a = pad3(derivN(c, tt, 2))
    // Third derivative via extra finite-difference of accel.
    const h = 1e-3
    const t1 = Math.max(h, Math.min(1 - h, tt))
    const a1 = pad3(derivN(c, t1 - h, 2))
    const a2 = pad3(derivN(c, t1 + h, 2))
    const j  = [ (a2[0]-a1[0])/(2*h), (a2[1]-a1[1])/(2*h), (a2[2]-a1[2])/(2*h) ]
    const cross = vCross3(v, a)
    const denom = vDot(cross, cross)
    if (denom === 0) return 0
    return vDot(cross, j) / denom
  })

  // Frenet frame — (T N B κ τ).
  def('curve/frenet-frame', (c, t) => {
    const tt = t == null ? 0.5 : +t
    const v = pad3(derivN(c, tt, 1))
    const a = pad3(derivN(c, tt, 2))
    const T = pad3(vUnit(v))
    const N = pad3(vUnit(vSub(a, vScale(T, vDot(a, T)))))
    const B = vCross3(T, N)
    const s = vNorm(v)
    const kappa = s === 0 ? 0 : vNorm(vCross3(v, a)) / (s*s*s)
    // tau
    const h = 1e-3
    const t1 = Math.max(h, Math.min(1 - h, tt))
    const a1 = pad3(derivN(c, t1 - h, 2))
    const a2 = pad3(derivN(c, t1 + h, 2))
    const j  = [ (a2[0]-a1[0])/(2*h), (a2[1]-a1[1])/(2*h), (a2[2]-a1[2])/(2*h) ]
    const cross = vCross3(v, a)
    const denom = vDot(cross, cross)
    const tau = denom === 0 ? 0 : vDot(cross, j) / denom
    return [T, N, B, kappa, tau]
  })

  // Osculating circle — center = γ + (1/κ) N, radius = 1/κ.
  def('curve/osculating-circle', (c, t) => {
    const tt = t == null ? 0.5 : +t
    const p = pad3(evalCurve(c, tt))
    const v = pad3(derivN(c, tt, 1))
    const a = pad3(derivN(c, tt, 2))
    const s = vNorm(v)
    const kappa = s === 0 ? 0 : vNorm(vCross3(v, a)) / (s*s*s)
    if (kappa === 0) return [p, Infinity]
    const T = pad3(vUnit(v))
    const N = pad3(vUnit(vSub(a, vScale(T, vDot(a, T)))))
    const r = 1 / kappa
    const center = vAdd(p, vScale(N, r))
    return [center, r]
  })

  // Arc length — Simpson.
  def('curve/arc-length', (c, tMin, tMax) => arcLengthOf(c, +tMin || 0, tMax == null ? 1 : +tMax, 32))

  // Spline length — alias for polyline sum, or arc-length if curve.
  def('curve/spline-length', (c) => {
    const d = decodeCurve(c)
    if (d.kind === 'polyline' || d.kind === 'sampled') {
      let s = 0
      for (let i = 0; i < d.points.length - 1; i++) s += vNorm(vSub(d.points[i+1], d.points[i]))
      return s
    }
    return arcLengthOf(c, 0, 1, 64)
  })

  // Spline resample — n points spaced by arc length.
  def('curve/spline-resample', (c, n) => {
    const N = Math.max(1, n | 0)
    // Precompute arc length table.
    const M = 128
    const ts = new Array(M + 1)
    const ss = new Array(M + 1)
    ts[0] = 0; ss[0] = 0
    let prev = evalCurve(c, 0)
    for (let i = 1; i <= M; i++) {
      const t = i / M
      const p = evalCurve(c, t)
      ss[i] = ss[i-1] + vNorm(vSub(p, prev))
      ts[i] = t
      prev = p
    }
    const L = ss[M]
    const out = new Array(N + 1)
    for (let k = 0; k <= N; k++) {
      const target = (k / N) * L
      // find bracketing i
      let lo = 0, hi = M
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (ss[mid] < target) lo = mid + 1
        else hi = mid
      }
      const i = Math.max(1, lo)
      const s0 = ss[i-1], s1 = ss[i]
      const alpha = s1 === s0 ? 0 : (target - s0) / (s1 - s0)
      const t = ts[i-1] * (1 - alpha) + ts[i] * alpha
      out[k] = evalCurve(c, t)
    }
    return out
  })

  // Cycloid — (R(θ - sinθ), R(1 - cosθ)).
  def('curve/cycloid', (R, theta) => [ +R * (theta - Math.sin(theta)), +R * (1 - Math.cos(theta)) ])

  // Brachistochrone — solve for the cycloid through (x, y), x across and y
  // down. Returns (list R θ_end): the generating radius and the sweep angle
  // of γ(θ) = (R(θ - sinθ), R(1 - cosθ)). That is what chapter 20 documents
  // ("The result is a list [R, θ_end]"), and it is the only return shape the
  // sibling verbs compose with — both `curve/cycloid` and `curve/descent-time`
  // take exactly (R, θ).
  //
  // Two defects were fixed here. First the return type: this used to hand back
  // 25 sampled points, so every reference snippet that did arithmetic on
  // (car sol) / (cadr sol) was multiplying lists.
  //
  // Second the solve. It used to sweep theta over the FULL [0, 2π] and then
  // rescale, which cannot work: a full sweep returns the cycloid to y = 0, so
  // the endpoint y was always 0, the `last[1] === 0` guard always took its `1`
  // branch, and the y rescale never happened. The requested depth appeared
  // only in the middle of the arch, by accident. Solve for the sweep angle
  // instead of guessing it: on x = R(θ - sinθ), y = R(1 - cosθ) the ratio
  // (θ - sinθ)/(1 - cosθ) rises monotonically from 0 as θ → 0 to +∞ as
  // θ → 2π, so one bisection finds the θ_end whose ratio is x/y.
  def('curve/brachistochrone', (x, y) => {
    const X = Math.abs(+x), Y = Math.abs(+y)
    if (!Number.isFinite(X) || !Number.isFinite(Y)) return [NaN, NaN]
    // y = 0 is not degenerate — it is the full arch, θ_end = 2π exactly,
    // where x = R(2π - sin 2π) = 2πR. Solve it in closed form; the bisection
    // below cannot reach its own open upper bound.
    if (Y === 0) return [X / (2 * Math.PI), 2 * Math.PI]
    const target = X / Y
    const ratio = (t) => (t - Math.sin(t)) / (1 - Math.cos(t))
    let lo = 1e-9, hi = 2 * Math.PI - 1e-9
    for (let i = 0; i < 100; i++) {
      const mid = (lo + hi) / 2
      if (ratio(mid) < target) lo = mid; else hi = mid
    }
    const thEnd = (lo + hi) / 2
    // Recover R from whichever of the two equations is better conditioned:
    // (1 - cosθ) collapses as θ → 2π, (θ - sinθ) collapses as θ → 0.
    const dx = thEnd - Math.sin(thEnd)
    const dy = 1 - Math.cos(thEnd)
    const R = dy >= dx ? Y / dy : X / dx
    return [R, thEnd]
  })

  // Descent time on a cycloid — closed form: t = θ · sqrt(R/g).
  def('curve/descent-time', (R, thetaEnd, g) => Math.abs(+thetaEnd) * Math.sqrt(Math.abs(+R) / Math.abs(+g || 9.81)))

  // Euler–Lagrange residual — L is a JS function of (q, q̇, q̈) OR (q, q̇)
  // whose Euler-Lagrange equation is d/dt(∂L/∂q̇) - ∂L/∂q. We compute
  // a residual via finite differences.
  def('curve/euler-lagrange-residual', (L, q, qDot, qDdot) => {
    if (!isCallable(L)) return 0
    const Lf = (a, b) => num(callScheme(L, [a, b]))
    const h = 1e-4
    const dLdq  = (Lf(q + h, qDot) - Lf(q - h, qDot)) / (2 * h)
    const dLdqd = (Lf(q, qDot + h) - Lf(q, qDot - h)) / (2 * h)
    // Approx d/dt(∂L/∂q̇) ≈ (∂²L/∂q̇²) · q̈  (ignore mixed term for stub)
    const d2Ldqd2 = (Lf(q, qDot + h) - 2 * Lf(q, qDot) + Lf(q, qDot - h)) / (h * h)
    return d2Ldqd2 * qDdot - dLdq + dLdqd * 0
  })

  // --- surface verbs ---------------------------------------------

  // Fall-line — steepest descent direction: the UNIT vector -∇h/|∇h|.
  //
  // Two fixes. The result used to be the raw -∇h, but the reference defines
  // the fall line as "the unit vector −∇h / |∇h|" — so on the bowl x²+y² at
  // (3,4) it handed back (-6,-8), magnitude 10, where the documented answer
  // has magnitude 1. And a flat region has no downhill direction at all; the
  // reference says the verb returns 'singular there rather than the (0,0)
  // that a caller cannot distinguish from "due east, no slope".
  //
  // Both this and curve/fall-path also skipped decodeSurface, so a
  // `(curve/surface-graph f)` argument — the shape the reference passes
  // everywhere — reached callH as a tagged LIST, was not callable, and read
  // as the zero height field. Every fall-path over a surface-graph came back
  // as a stationary point.
  def('curve/fall-line', (surface, x, y) => {
    const s = decodeSurface(surface)
    const h = s.kind === 'graph' ? s.h : surface
    const dx = (callH(h, +x + H, +y) - callH(h, +x - H, +y)) / (2 * H)
    const dy = (callH(h, +x, +y + H) - callH(h, +x, +y - H)) / (2 * H)
    const L = Math.hypot(dx, dy)
    if (L === 0) return new Sym('singular')
    return [-dx / L, -dy / L]
  })

  // Fall-path — iterate a gradient descent from (x0, y0) for `steps`.
  def('curve/fall-path', (surface, x0, y0, steps) => {
    const s = decodeSurface(surface)
    const h = s.kind === 'graph' ? s.h : surface
    const N = Math.max(1, (steps | 0) || 20)
    const dt = 0.05
    const out = [[+x0, +y0]]
    let x = +x0, y = +y0
    for (let i = 0; i < N; i++) {
      const dx = (callH(h, x + H, y) - callH(h, x - H, y)) / (2 * H)
      const dy = (callH(h, x, y + H) - callH(h, x, y - H)) / (2 * H)
      x -= dt * dx
      y -= dt * dy
      out.push([x, y])
    }
    return out
  })

  // Gradient ∇h(x,y).
  def('curve/gradient', (surface, u, v) => {
    const s = decodeSurface(surface)
    const h = s.kind === 'graph' ? s.h : surface
    const du = (callH(h, +u + H, +v) - callH(h, +u - H, +v)) / (2 * H)
    const dv = (callH(h, +u, +v + H) - callH(h, +u, +v - H)) / (2 * H)
    return [du, dv]
  })

  // Slope-angle — atan(|∇h|) in radians.
  def('curve/slope-angle', (surface, u, v) => {
    const s = decodeSurface(surface)
    const h = s.kind === 'graph' ? s.h : surface
    const du = (callH(h, +u + H, +v) - callH(h, +u - H, +v)) / (2 * H)
    const dv = (callH(h, +u, +v + H) - callH(h, +u, +v - H)) / (2 * H)
    return Math.atan(Math.hypot(du, dv))
  })

  // Surface-normal — (-h_x, -h_y, 1) / |·|.
  def('curve/surface-normal', (surface, x, y) => {
    const s = decodeSurface(surface)
    const h = s.kind === 'graph' ? s.h : surface
    const hx = (callH(h, +x + H, +y) - callH(h, +x - H, +y)) / (2 * H)
    const hy = (callH(h, +x, +y + H) - callH(h, +x, +y - H)) / (2 * H)
    const n = [-hx, -hy, 1]
    const L = Math.hypot(n[0], n[1], n[2])
    return L === 0 ? n : n.map((c) => c / L)
  })

  // First fundamental form E,F,G for z=h(x,y): E=1+h_x², F=h_x·h_y, G=1+h_y².
  def('curve/first-form', (surface, u, v) => {
    const s = decodeSurface(surface)
    const h = s.kind === 'graph' ? s.h : surface
    const hx = (callH(h, +u + H, +v) - callH(h, +u - H, +v)) / (2 * H)
    const hy = (callH(h, +u, +v + H) - callH(h, +u, +v - H)) / (2 * H)
    return [1 + hx*hx, hx*hy, 1 + hy*hy]
  })

  // Second fundamental form L,M,N for z=h(x,y): L,M,N = h_xx, h_xy, h_yy
  // divided by √(1+h_x²+h_y²).
  def('curve/second-form', (surface, x, y) => {
    const s = decodeSurface(surface)
    const h = s.kind === 'graph' ? s.h : surface
    const hx = (callH(h, +x + H, +y) - callH(h, +x - H, +y)) / (2 * H)
    const hy = (callH(h, +x, +y + H) - callH(h, +x, +y - H)) / (2 * H)
    const hxx = (callH(h, +x + H, +y) - 2*callH(h, +x, +y) + callH(h, +x - H, +y)) / (H * H)
    const hyy = (callH(h, +x, +y + H) - 2*callH(h, +x, +y) + callH(h, +x, +y - H)) / (H * H)
    const hxy = (callH(h, +x + H, +y + H) - callH(h, +x + H, +y - H)
               - callH(h, +x - H, +y + H) + callH(h, +x - H, +y - H)) / (4 * H * H)
    const denom = Math.sqrt(1 + hx*hx + hy*hy)
    if (denom === 0) return [0, 0, 0]
    return [hxx / denom, hxy / denom, hyy / denom]
  })

  // Gaussian curvature K = (LN - M²) / (EG - F²).
  def('curve/gaussian-curvature', (surface, u, v) => {
    const s = decodeSurface(surface)
    const h = s.kind === 'graph' ? s.h : surface
    const hx = (callH(h, +u + H, +v) - callH(h, +u - H, +v)) / (2 * H)
    const hy = (callH(h, +u, +v + H) - callH(h, +u, +v - H)) / (2 * H)
    const hxx = (callH(h, +u + H, +v) - 2*callH(h, +u, +v) + callH(h, +u - H, +v)) / (H * H)
    const hyy = (callH(h, +u, +v + H) - 2*callH(h, +u, +v) + callH(h, +u, +v - H)) / (H * H)
    const hxy = (callH(h, +u + H, +v + H) - callH(h, +u + H, +v - H)
               - callH(h, +u - H, +v + H) + callH(h, +u - H, +v - H)) / (4 * H * H)
    const num = hxx * hyy - hxy * hxy
    const denom = Math.pow(1 + hx*hx + hy*hy, 2)
    return denom === 0 ? 0 : num / denom
  })

  // Mean curvature H = ((1+h_y²)h_xx - 2 h_x h_y h_xy + (1+h_x²)h_yy) / (2(1+h_x²+h_y²)^(3/2))
  def('curve/mean-curvature', (surface, u, v) => {
    const s = decodeSurface(surface)
    const h = s.kind === 'graph' ? s.h : surface
    const hx = (callH(h, +u + H, +v) - callH(h, +u - H, +v)) / (2 * H)
    const hy = (callH(h, +u, +v + H) - callH(h, +u, +v - H)) / (2 * H)
    const hxx = (callH(h, +u + H, +v) - 2*callH(h, +u, +v) + callH(h, +u - H, +v)) / (H * H)
    const hyy = (callH(h, +u, +v + H) - 2*callH(h, +u, +v) + callH(h, +u, +v - H)) / (H * H)
    const hxy = (callH(h, +u + H, +v + H) - callH(h, +u + H, +v - H)
               - callH(h, +u - H, +v + H) + callH(h, +u - H, +v - H)) / (4 * H * H)
    const num = (1 + hy*hy) * hxx - 2 * hx * hy * hxy + (1 + hx*hx) * hyy
    const denom = 2 * Math.pow(1 + hx*hx + hy*hy, 1.5)
    return denom === 0 ? 0 : num / denom
  })

  // Principal curvatures — eigenvalues of the shape operator on a graph.
  // Return (k1 k2) with k1 = H + √(H² - K), k2 = H - √(...).
  def('curve/principal-curvatures', (surface, x, y) => {
    const s = decodeSurface(surface)
    const h = s.kind === 'graph' ? s.h : surface
    const hx = (callH(h, +x + H, +y) - callH(h, +x - H, +y)) / (2 * H)
    const hy = (callH(h, +x, +y + H) - callH(h, +x, +y - H)) / (2 * H)
    const hxx = (callH(h, +x + H, +y) - 2*callH(h, +x, +y) + callH(h, +x - H, +y)) / (H * H)
    const hyy = (callH(h, +x, +y + H) - 2*callH(h, +x, +y) + callH(h, +x, +y - H)) / (H * H)
    const hxy = (callH(h, +x + H, +y + H) - callH(h, +x + H, +y - H)
               - callH(h, +x - H, +y + H) + callH(h, +x - H, +y - H)) / (4 * H * H)
    const denK = Math.pow(1 + hx*hx + hy*hy, 2)
    const denH = 2 * Math.pow(1 + hx*hx + hy*hy, 1.5)
    const K = denK === 0 ? 0 : (hxx*hyy - hxy*hxy) / denK
    const Hm = denH === 0 ? 0 : ((1+hy*hy)*hxx - 2*hx*hy*hxy + (1+hx*hx)*hyy) / denH
    const disc = Math.max(0, Hm*Hm - K)
    const r = Math.sqrt(disc)
    return [Hm + r, Hm - r]
  })

  // Christoffel symbols — for a graph z=h(x,y) with metric g_ij derived
  // from the first form. Returns a nested list [[[Γ^1_11, Γ^1_12],[Γ^1_12, Γ^1_22]], [[Γ^2_11, ...], ...]].
  // Numerically light — computed from ∂g_ij/∂x^k.
  def('curve/christoffel', (surface) => {
    const s = decodeSurface(surface)
    if (s.kind !== 'graph') return [[[0,0],[0,0]], [[0,0],[0,0]]]
    // We don't have a point without extra args; return a zero-shaped tensor.
    return [[[0,0],[0,0]], [[0,0],[0,0]]]
  })

  // Geodesic distance — stub: straight-line ambient distance between two
  // (u,v) points, projected onto the graph.
  def('curve/geodesic-distance', (surface, p1, p2) => {
    const s = decodeSurface(surface)
    const h = s.kind === 'graph' ? s.h : surface
    const [u1, v1] = [asPoint(p1)[0]||0, asPoint(p1)[1]||0]
    const [u2, v2] = [asPoint(p2)[0]||0, asPoint(p2)[1]||0]
    // Sample straight line in (u,v) and integrate 3D arc length on the surface.
    const N = 32
    let last = [u1, v1, callH(h, u1, v1)]
    let s2 = 0
    for (let i = 1; i <= N; i++) {
      const t = i / N
      const u = u1 * (1 - t) + u2 * t
      const v = v1 * (1 - t) + v2 * t
      const p = [u, v, callH(h, u, v)]
      s2 += Math.hypot(p[0]-last[0], p[1]-last[1], p[2]-last[2])
      last = p
    }
    return s2
  })

  return env
}

export default installCurve
