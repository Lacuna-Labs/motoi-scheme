// calc.js — numerical calculus: differentiation, integration,
// critical points, tangent-line construction, vector calculus.
//
// Provenance: 2026-07-22. Wires the 30 calc/* verbs referenced in
// scheme/reference/11-calc.slat + scheme-books/book-of-math/ch13,ch14.
// The reference had them documented for months; this is the impl.
//
// Doctrine (Alfred): "no fake behavior; document what you actually did."
// Every verb here is real numeric math — Simpson integration, Newton's
// method, central-difference differentiation, discretized vector-calc
// operators. Where a verb's contract requires user-supplied structure
// beyond scalar sampling (curl / divergence of a vector field with no
// specified shape), we escalate cleanly rather than lie.
//
// Numerical constants (Alfred: pick values that work on kid-scale math):
//   H_DERIV   = 1e-6      central-difference step for first derivative
//   H_SECOND  = 1e-4      slightly larger for second derivative (stable)
//   INT_N     = 200       default Simpson subintervals per axis
//   NEWTON_TOL = 1e-9     convergence tolerance
//   NEWTON_MAX = 50       iteration cap

import { apply } from '../../src/interp.js'
import { Sym, sym } from '../../src/reader.js'

// ── inline registration metadata (2026-07-22) ────────────────────
export const VERBS = [
  'calc/arc-length',
  'calc/arc-length-param',
  'calc/average-value',
  'calc/continuous?',
  'calc/critical-points-1d',
  'calc/curl',
  'calc/derivative',
  'calc/differentiable?',
  'calc/directional-derivative',
  'calc/divergence',
  'calc/extrema-1d',
  'calc/gradient',
  'calc/hessian',
  'calc/integral',
  'calc/jacobian',
  'calc/laplacian',
  'calc/limit',
  'calc/line-integral',
  'calc/newton',
  'calc/partial',
  'calc/radius-of-convergence',
  'calc/riemann-sum',
  'calc/second-derivative',
  'calc/series-converges?',
  'calc/surface-integral',
  'calc/surface-revolution',
  'calc/tangent-line',
  'calc/taylor',
  'calc/total-differential',
  'calc/volume-revolution',
]
export const LAZY = true
export const BOOK = 'book-of-math/ch13-calculus-1'
export const TESTS = [
  ['(calc/derivative (lambda (x) (* x x)) 3)', '6'],
  ['(calc/integral (lambda (x) x) 0 1)', '0.5'],
  ['(calc/newton (lambda (x) (- (* x x) 2)) 1)', '1.414'],
]

const H_DERIV   = 1e-6
const H_SECOND  = 1e-4
const INT_N     = 200
const NEWTON_TOL = 1e-9
const NEWTON_MAX = 50

const num = (x) => (typeof x === 'number' ? x : Number(x))
const isList = (x) => Array.isArray(x)

// Composite Simpson's rule for a scalar function f on [a, b].
// n must be even; we bump odd n to n+1.
function simpson(f, a, b, n = INT_N) {
  if (n % 2) n += 1
  if (a === b) return 0
  const h = (b - a) / n
  let sum = f(a) + f(b)
  for (let i = 1; i < n; i++) {
    sum += (i % 2 === 0 ? 2 : 4) * f(a + i * h)
  }
  return (sum * h) / 3
}

// Wrap a Scheme callable so we can invoke it as JS(number)->number.
function wrap1(fn, fuel) {
  return (x) => {
    const r = typeof fn === 'function' && !fn.__lazy && fn.length !== undefined
      ? tryDirect(fn, [x], fuel)
      : apply(fn, [x], fuel)
    return num(r)
  }
}

// Some primitives are native JS closures with fixed arity — call directly
// when possible so we don't pay the trampoline cost. Fall back to apply().
function tryDirect(fn, args, fuel) {
  try { return fn(...args) } catch { return apply(fn, args, fuel) }
}

function wrapN(fn, fuel) {
  return (...args) => num(apply(fn, args, fuel))
}

// Central-difference derivative.
function ddx(fn, x, h = H_DERIV) {
  return (fn(x + h) - fn(x - h)) / (2 * h)
}
function d2dx2(fn, x, h = H_SECOND) {
  return (fn(x + h) - 2 * fn(x) + fn(x - h)) / (h * h)
}

// Partial derivative of a multi-arg fn along axis i at point (list).
function partialAt(fn, point, i, h = H_DERIV) {
  const pl = point.slice(); const pr = point.slice()
  pl[i] = point[i] - h; pr[i] = point[i] + h
  return (fn(...pr) - fn(...pl)) / (2 * h)
}

// Second partial ∂²f/∂xᵢ∂xⱼ at point.
function partial2At(fn, point, i, j, h = H_SECOND) {
  if (i === j) {
    const pl = point.slice(); const pr = point.slice()
    pl[i] = point[i] - h; pr[i] = point[i] + h
    return (fn(...pr) - 2 * fn(...point) + fn(...pl)) / (h * h)
  }
  // mixed partial via four-point stencil
  const pp = point.slice(); pp[i] += h; pp[j] += h
  const pm = point.slice(); pm[i] += h; pm[j] -= h
  const mp = point.slice(); mp[i] -= h; mp[j] += h
  const mm = point.slice(); mm[i] -= h; mm[j] -= h
  return (fn(...pp) - fn(...pm) - fn(...mp) + fn(...mm)) / (4 * h * h)
}

export function installCalc(env, ctx) {
  const fuel = (ctx && ctx.fuel) || { n: 1_000_000 }
  const def = (name, fn) => env.define(name, fn, { perm: 'read' })

  // ── first derivative — central difference ────────────────────────
  def('calc/derivative', (f, x) => {
    const F = wrap1(f, fuel)
    return ddx(F, num(x))
  })

  def('calc/second-derivative', (f, x) => {
    const F = wrap1(f, fuel)
    return d2dx2(F, num(x))
  })

  // Directional derivative at a point along a direction (list).
  // grad(f)·direction, normalized.
  def('calc/directional-derivative', (f, point, direction) => {
    const F = wrapN(f, fuel)
    const p = isList(point) ? point.map(num) : [num(point)]
    const d = isList(direction) ? direction.map(num) : [num(direction)]
    const norm = Math.hypot(...d) || 1
    const u = d.map(x => x / norm)
    let s = 0
    for (let i = 0; i < p.length; i++) s += partialAt(F, p, i) * u[i]
    return s
  })

  def('calc/partial', (f, i, point) => {
    const F = wrapN(f, fuel)
    const p = isList(point) ? point.map(num) : [num(point)]
    return partialAt(F, p, num(i) | 0)
  })

  def('calc/gradient', (f, point) => {
    const F = wrapN(f, fuel)
    const p = isList(point) ? point.map(num) : [num(point)]
    const g = new Array(p.length)
    for (let i = 0; i < p.length; i++) g[i] = partialAt(F, p, i)
    return g
  })

  def('calc/hessian', (f, point) => {
    const F = wrapN(f, fuel)
    const p = isList(point) ? point.map(num) : [num(point)]
    const n = p.length
    const H = []
    for (let i = 0; i < n; i++) {
      const row = new Array(n)
      for (let j = 0; j < n; j++) row[j] = partial2At(F, p, i, j)
      H.push(row)
    }
    return H
  })

  def('calc/jacobian', (fields, point) => {
    const p = isList(point) ? point.map(num) : [num(point)]
    // Vector-valued form: a single function f: Rⁿ → Rᵐ returning a list.
    // Finite-difference the whole output vector w.r.t. each input, then
    // arrange so row i is ∂fᵢ/∂xⱼ.
    if (!isList(fields)) {
      const vecAt = (pt) => {
        const out = apply(fields, pt, fuel)
        return isList(out) ? out.map(num) : [num(out)]
      }
      const m = vecAt(p).length
      const J = Array.from({ length: m }, () => new Array(p.length))
      for (let j = 0; j < p.length; j++) {
        const pr = p.slice(); const pl = p.slice()
        pr[j] += H_DERIV; pl[j] -= H_DERIV
        const fr = vecAt(pr); const fl = vecAt(pl)
        for (let i = 0; i < m; i++) J[i][j] = (fr[i] - fl[i]) / (2 * H_DERIV)
      }
      return J
    }
    const J = []
    for (const field of fields) {
      const F = wrapN(field, fuel)
      const row = new Array(p.length)
      for (let i = 0; i < p.length; i++) row[i] = partialAt(F, p, i)
      J.push(row)
    }
    return J
  })

  // Laplacian: sum of unmixed second partials.
  def('calc/laplacian', (f, point) => {
    const F = wrapN(f, fuel)
    const p = isList(point) ? point.map(num) : [num(point)]
    let s = 0
    for (let i = 0; i < p.length; i++) s += partial2At(F, p, i, i)
    return s
  })

  // Divergence of vector field F at a point.
  //   F is a list of scalar-valued fns of n vars. Returns sum ∂Fᵢ/∂xᵢ.
  def('calc/divergence', (F, point) => {
    if (!isList(F)) return [sym('escalate'), sym('shape-error')]
    if (!isList(point)) return [sym('escalate'), sym('shape-error')]
    const p = point.map(num)
    if (F.length !== p.length) return [sym('escalate'), sym('shape-error')]
    let s = 0
    for (let i = 0; i < F.length; i++) {
      const fi = wrapN(F[i], fuel)
      s += partialAt(fi, p, i)
    }
    return s
  })

  // Curl of 3D vector field at point. Returns [∂Fz/∂y-∂Fy/∂z,
  //   ∂Fx/∂z-∂Fz/∂x, ∂Fy/∂x-∂Fx/∂y].
  // In 2D returns the scalar ∂Fy/∂x-∂Fx/∂y.
  def('calc/curl', (F, point) => {
    if (!isList(F) || !isList(point)) return [sym('escalate'), sym('shape-error')]
    const p = point.map(num)
    const fs = F.map(fn => wrapN(fn, fuel))
    if (fs.length === 2 && p.length === 2) {
      return partialAt(fs[1], p, 0) - partialAt(fs[0], p, 1)
    }
    if (fs.length === 3 && p.length === 3) {
      return [
        partialAt(fs[2], p, 1) - partialAt(fs[1], p, 2),
        partialAt(fs[0], p, 2) - partialAt(fs[2], p, 0),
        partialAt(fs[1], p, 0) - partialAt(fs[0], p, 1),
      ]
    }
    return [sym('escalate'), sym('shape-error')]
  })

  // ── integration ──────────────────────────────────────────────────
  def('calc/integral', (f, a, b) => {
    const F = wrap1(f, fuel)
    return simpson(F, num(a), num(b))
  })

  // Riemann sum: kind is 'left | 'right | 'midpoint | 'trapezoid.
  def('calc/riemann-sum', (f, a, b, kind, n) => {
    const F = wrap1(f, fuel)
    const A = num(a), B = num(b), N = Math.max(1, Math.floor(num(n)))
    const h = (B - A) / N
    const k = kind instanceof Sym ? kind.name : String(kind)
    let s = 0
    for (let i = 0; i < N; i++) {
      const xL = A + i * h, xR = xL + h
      if (k === 'left') s += F(xL)
      else if (k === 'right') s += F(xR)
      else if (k === 'midpoint' || k === 'mid') s += F((xL + xR) / 2)
      else if (k === 'trapezoid' || k === 'trap') s += 0.5 * (F(xL) + F(xR))
      else s += F((xL + xR) / 2)  // default midpoint
    }
    return s * h
  })

  def('calc/average-value', (f, a, b) => {
    const A = num(a), B = num(b)
    if (B === A) return num(apply(f, [A], fuel))
    const F = wrap1(f, fuel)
    return simpson(F, A, B) / (B - A)
  })

  // Arc length of y = f(x) on [a, b]: ∫ √(1 + f'(x)²) dx.
  def('calc/arc-length', (f, a, b) => {
    const F = wrap1(f, fuel)
    const g = (x) => Math.sqrt(1 + ddx(F, x) ** 2)
    return simpson(g, num(a), num(b))
  })

  // Parametric arc length: ∫ √(x'(t)² + y'(t)²) dt.
  def('calc/arc-length-param', (fx, fy, t0, t1) => {
    const X = wrap1(fx, fuel)
    const Y = wrap1(fy, fuel)
    const g = (t) => Math.sqrt(ddx(X, t) ** 2 + ddx(Y, t) ** 2)
    return simpson(g, num(t0), num(t1))
  })

  // Surface area from revolving y = f(x) about x-axis:
  //   ∫ 2π f(x) √(1 + f'(x)²) dx
  def('calc/surface-revolution', (f, a, b) => {
    const F = wrap1(f, fuel)
    const g = (x) => 2 * Math.PI * Math.abs(F(x)) * Math.sqrt(1 + ddx(F, x) ** 2)
    return simpson(g, num(a), num(b))
  })

  // Volume of solid of revolution.
  //   axis = 'x | 'y — for axis='x, disk method V = ∫ π f(x)² dx.
  //   For axis='y, shell method V = ∫ 2π x |f(x)| dx.
  def('calc/volume-revolution', (f, a, b, axis) => {
    const F = wrap1(f, fuel)
    const A = num(a), B = num(b)
    const ax = axis instanceof Sym ? axis.name : String(axis || 'x')
    if (ax === 'y') {
      return simpson((x) => 2 * Math.PI * x * Math.abs(F(x)), A, B)
    }
    return simpson((x) => Math.PI * F(x) * F(x), A, B)
  })

  // Line integral of scalar f over parametric curve (x(t), y(t)) on [t0,t1]:
  //   ∫ f(x(t), y(t)) √(x'² + y'²) dt.
  // Curve is (list x-fn y-fn t0 t1).
  def('calc/line-integral', (fOrF, curve, integrandType) => {
    if (!isList(curve) || curve.length < 4) return [sym('escalate'), sym('shape-error')]
    const [xfn, yfn, t0raw, t1raw] = curve
    const X = wrap1(xfn, fuel)
    const Y = wrap1(yfn, fuel)
    const t0 = num(t0raw), t1 = num(t1raw)
    const scalar = (t) => {
      const r = apply(fOrF, [X(t), Y(t)], fuel)
      return num(r)
    }
    const arcElement = (t) => Math.sqrt(ddx(X, t) ** 2 + ddx(Y, t) ** 2)
    return simpson((t) => scalar(t) * arcElement(t), t0, t1)
  })

  // Surface integral — mode 'flat: over rectangle [x0,x1]x[y0,y1] of scalar
  // field-fn(x,y). For anything else we honestly escalate.
  def('calc/surface-integral', (surfaceFn, fieldFn, mode, opts) => {
    const m = mode instanceof Sym ? mode.name : String(mode)
    if (m !== 'flat') return [sym('escalate'), sym('not-implemented')]
    if (!isList(opts) || opts.length < 4) return [sym('escalate'), sym('bad-bounds')]
    const [x0, x1, y0, y1] = opts.map(num)
    const g = (x) => simpson((y) => num(apply(fieldFn, [x, y], fuel)), y0, y1, 40)
    return simpson(g, x0, x1, 40)
  })

  // Total differential: f' · dv (dot product of gradient with dv-vector).
  def('calc/total-differential', (f, point, dv) => {
    const F = wrapN(f, fuel)
    const p = isList(point) ? point.map(num) : [num(point)]
    const d = isList(dv) ? dv.map(num) : [num(dv)]
    let s = 0
    for (let i = 0; i < Math.min(p.length, d.length); i++) {
      s += partialAt(F, p, i) * d[i]
    }
    return s
  })

  // ── limits, continuity, differentiability ────────────────────────

  // Two-sided numerical limit: average of left+right small-h evaluations.
  // Returns 'undefined if left != right within tolerance.
  def('calc/limit', (f, a) => {
    const F = wrap1(f, fuel)
    const A = num(a)
    const hs = [1e-3, 1e-5, 1e-7]
    let lastL = null, lastR = null
    for (const h of hs) {
      lastL = F(A - h)
      lastR = F(A + h)
      if (!Number.isFinite(lastL) || !Number.isFinite(lastR)) return sym('undefined')
    }
    if (Math.abs(lastL - lastR) > 1e-3 * (1 + Math.abs(lastL))) return sym('undefined')
    return (lastL + lastR) / 2
  })

  def('calc/continuous?', (f, a) => {
    const F = wrap1(f, fuel)
    const A = num(a)
    let fa
    try { fa = F(A) } catch { return false }
    if (!Number.isFinite(fa)) return false
    const L = F(A - 1e-5), R = F(A + 1e-5)
    if (!Number.isFinite(L) || !Number.isFinite(R)) return false
    return Math.abs(L - fa) < 1e-3 && Math.abs(R - fa) < 1e-3
  })

  def('calc/differentiable?', (f, x) => {
    const F = wrap1(f, fuel)
    const X = num(x)
    let fx; try { fx = F(X) } catch { return false }
    if (!Number.isFinite(fx)) return false
    // Left and right derivatives should agree.
    const dL = (F(X) - F(X - 1e-6)) / 1e-6
    const dR = (F(X + 1e-6) - F(X)) / 1e-6
    if (!Number.isFinite(dL) || !Number.isFinite(dR)) return false
    return Math.abs(dL - dR) < 1e-3 * (1 + Math.max(Math.abs(dL), Math.abs(dR)))
  })

  // ── root-finding, tangent, extrema ───────────────────────────────

  def('calc/newton', (f, x0, tol, maxIter) => {
    const F = wrap1(f, fuel)
    let x = num(x0)
    const T = num(tol) || NEWTON_TOL
    const M = Math.max(1, Math.floor(num(maxIter))) || NEWTON_MAX
    for (let i = 0; i < M; i++) {
      const fx = F(x)
      if (Math.abs(fx) < T) return x
      const d = ddx(F, x)
      if (d === 0 || !Number.isFinite(d)) return sym('no-convergence')
      const nx = x - fx / d
      if (Math.abs(nx - x) < T) return nx
      x = nx
    }
    return sym('no-convergence')
  })

  // Tangent line at x=a: y = m x + c where m = f'(a), c = f(a) - m·a.
  // Returns (list slope intercept).
  def('calc/tangent-line', (f, a) => {
    const F = wrap1(f, fuel)
    const A = num(a)
    const m = ddx(F, A)
    const c = F(A) - m * A
    return [m, c]
  })

  // Critical points on [a, b]: sample the interval, find sign changes in
  // f'(x). Returns list of x-values (approximate roots of f').
  def('calc/critical-points-1d', (f, a, b) => {
    const F = wrap1(f, fuel)
    const A = num(a), B = num(b)
    if (B <= A) return []
    const N = 200
    const h = (B - A) / N
    const df = (x) => ddx(F, x)
    const roots = []
    let prev = df(A)
    for (let i = 1; i <= N; i++) {
      const x = A + i * h
      const cur = df(x)
      if (Number.isFinite(prev) && Number.isFinite(cur) && prev * cur <= 0 && (prev !== 0 || cur !== 0)) {
        // Bisect for refinement.
        let lo = A + (i - 1) * h, hi = x
        for (let k = 0; k < 40; k++) {
          const m = (lo + hi) / 2
          const dm = df(m)
          if (df(lo) * dm <= 0) hi = m; else lo = m
          if (hi - lo < 1e-9) break
        }
        roots.push((lo + hi) / 2)
      }
      prev = cur
    }
    return roots
  })

  // Extrema on [a, b]: classify each critical point by second derivative.
  // Returns list of (list x kind) where kind ∈ {'min 'max 'saddle}.
  def('calc/extrema-1d', (f, a, b) => {
    const F = wrap1(f, fuel)
    const critsFn = env.vars.get('calc/critical-points-1d')
    const crits = critsFn(f, a, b)
    const out = []
    if (!isList(crits)) return out
    for (const x of crits) {
      const d2 = d2dx2(F, num(x))
      let kind
      if (Math.abs(d2) < 1e-4) kind = sym('saddle')
      else if (d2 > 0) kind = sym('min')
      else kind = sym('max')
      out.push([num(x), kind])
    }
    return out
  })

  // ── series ───────────────────────────────────────────────────────

  // Taylor coefficients up to order n at expansion point a.
  // Uses derivative via finite differences (cheap; loses accuracy fast).
  def('calc/taylor', (f, a, n) => {
    const F = wrap1(f, fuel)
    const A = num(a), N = Math.max(0, Math.floor(num(n)))
    const coeffs = []
    // Use higher-order finite differences for f^(k)(a).
    // Central-difference formulas up to k=4; beyond that, iterate ddx.
    const derivK = (k) => {
      // Iterated central difference — accuracy degrades, but honest for kid-scale.
      const h = 1e-3
      if (k === 0) return F(A)
      if (k === 1) return ddx(F, A)
      if (k === 2) return d2dx2(F, A)
      // Generic: repeated central difference.
      const diff = (g, x, order) => {
        if (order === 0) return g(x)
        return (diff(g, x + h, order - 1) - diff(g, x - h, order - 1)) / (2 * h)
      }
      return diff(F, A, k)
    }
    let fact = 1
    for (let k = 0; k <= N; k++) {
      if (k > 0) fact *= k
      coeffs.push(derivK(k) / fact)
    }
    return coeffs
  })

  // Radius of convergence via ratio test on the coeffs list.
  // R = lim |aₙ / aₙ₊₁|. Returns (radius . interval) as (r a b).
  def('calc/radius-of-convergence', (coeffs) => {
    if (!isList(coeffs) || coeffs.length < 2) return [sym('escalate'), sym('too-few-coeffs')]
    let last = null, R = 0, count = 0
    for (let i = 0; i < coeffs.length - 1; i++) {
      const a = Math.abs(num(coeffs[i]))
      const b = Math.abs(num(coeffs[i + 1]))
      if (b < 1e-15) continue
      const r = a / b
      if (Number.isFinite(r)) { last = r; R += r; count++ }
    }
    if (count === 0) return [sym('escalate'), sym('inconclusive')]
    const radius = R / count
    return [radius, [-radius, radius]]
  })

  // Series-converges? — nth-term test + ratio test on coeff-fn(n).
  def('calc/series-converges?', (coeffFn, opts) => {
    const c = (n) => num(apply(coeffFn, [n], fuel))
    // nth-term test: if a_n doesn't → 0, diverges.
    const cn = c(200)
    if (!Number.isFinite(cn)) return sym('inconclusive')
    if (Math.abs(cn) > 1e-3) return sym('diverges')
    // Ratio test.
    const ratios = []
    for (let n = 50; n <= 200; n += 25) {
      const a = Math.abs(c(n))
      const b = Math.abs(c(n + 1))
      if (a < 1e-30) continue
      ratios.push(b / a)
    }
    if (ratios.length === 0) return sym('inconclusive')
    const avg = ratios.reduce((s, r) => s + r, 0) / ratios.length
    if (avg < 0.99) return sym('converges')
    if (avg > 1.01) return sym('diverges')
    return sym('inconclusive')
  })

  return env
}

export default installCalc
