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

import { isList, listItems, seqVerb } from '../base/list.js'
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

// Multivariable callables receive the point as ONE list, `(f '(x y))`, which is
// the shape 11-calc.slat documents in 142 of its 143 examples. This used to
// spread the coordinates — `(f x y)` — so every documented `(lambda (p) (car p))`
// was handed a bare number as `p` and the extra coordinate was dropped on the
// floor. Nothing raised, because the interpreter did not check arity then: the
// gradient of x²+y² came back computed against one axis and looked plausible.
function wrapN(fn, fuel) {
  return (...args) => num(callAtPoint(fn, args, fuel))
}

// Call a user-supplied field/point function with a coordinate array, honouring
// whichever convention the closure was WRITTEN with. 11-calc.slat uses two:
// `(lambda (p) (car p))` — the point as ONE list, which is the dominant form —
// and `(lambda (x y z) ...)` — coordinates spread. Both appear inside the SAME
// record (calc/line-integral, calc/surface-integral), so neither can simply be
// declared wrong. Ask the closure how many parameters it declared instead of
// guessing: a Motoi Closure carries `.params`. When the declared count matches
// the coordinate count we spread; otherwise we pass the one list. A 1-D point
// is genuinely ambiguous, so it falls to the dominant one-list reading.
function callAtPoint(fn, coords, fuel) {
  const n = coords.length
  if (n > 1 && fn && isList(fn.params) && !fn.restParam && fn.params.length === n) {
    return apply(fn, coords, fuel)
  }
  return apply(fn, [coords], fuel)
}

// 3-vector helpers for the surface-integral normal.
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const to3 = (v) => [num(v[0]) || 0, v.length > 1 ? num(v[1]) : 0, v.length > 2 ? num(v[2]) : 0]

// A vector FIELD argument (calc/curl, calc/divergence) has two written shapes:
// a list of scalar component functions, or ONE closure returning the component
// list. The chapter settles it — of the resolved field call sites in
// 11-calc.slat, 16 curl + 14 divergence pass a single closure returning a list
// and ZERO pass a list of component functions. The engine only accepted the
// list-of-functions form, so every one of those 30 sites silently fell through
// to (escalate shape-error) and any arithmetic on the result blew up (or, worse,
// didn't). Accept both; the reference is the language.
//
// Returns null when `F` is not a usable field. Otherwise an array of scalar
// sampling functions taking spread coordinates (the shape partialAt wants).
function fieldComponents(F, point, fuel) {
  if (isList(F)) return F.map(fn => wrapN(fn, fuel))
  if (F == null) return null
  const sample = (args) => callAtPoint(F, args, fuel)
  let probe
  try { probe = sample(point) } catch { return null }
  if (!isList(probe)) return null
  return probe.map((_, i) => (...args) => num(sample(args)[i]))
}

// Central-difference derivative.
function ddx(fn, x, h = H_DERIV) {
  return (fn(x + h) - fn(x - h)) / (2 * h)
}
function d2dx2(fn, x, h = H_SECOND) {
  return (fn(x + h) - 2 * fn(x) + fn(x - h)) / (h * h)
}

// Derivative at x that never samples fn OUTSIDE [lo, hi].
//
// The arc-length / surface-of-revolution integrands need f' at the quadrature
// nodes, and Simpson puts nodes exactly ON a and b. A central difference there
// steps h past the end of the domain, where the caller's f is routinely
// undefined — √x at x=0, √(r²−x²) at x=r — and raises `sqrt: -0.000001 has no
// real square root`. The integral only ever needs f' ON [a, b], so at an
// endpoint take the one-sided difference instead. Interior nodes are unchanged.
function ddxIn(fn, x, lo, hi, h = H_DERIV) {
  if (hi < lo) { const t = lo; lo = hi; hi = t }
  if (hi - lo < 2 * h) return ddx(fn, x, h)   // interval too narrow to be one-sided
  const l = x - h, r = x + h
  if (l >= lo && r <= hi) return (fn(r) - fn(l)) / (2 * h)
  if (l < lo) return (fn(x + h) - fn(x)) / h  // forward at the left edge
  return (fn(x) - fn(x - h)) / h              // backward at the right edge
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
  const def = (name, fn) => env.define(name, seqVerb(fn), { perm: 'read' })

  // ── first derivative — central difference ────────────────────────
  def('calc/derivative', (f, x) => {
    const F = wrap1(f, fuel)
    return ddx(F, num(x))
  })

  def('calc/second-derivative', (f, x) => {
    const F = wrap1(f, fuel)
    return d2dx2(F, num(x))
  })

  // Directional derivative at a point along a direction (list): grad(f)·v.
  //
  // NOT normalized. This used to divide by |v|, which silently broke the one
  // property the chapter states as the verb's invariant — linearity in the
  // direction, D_{av+bw} f = a D_v f + b D_w f (11-calc.slat row-4-proof of
  // calc/directional-derivative). The reference settles it on the same side
  // twice more: :explanation calls the result "the dot product of the gradient
  // ∇f with u", and the first :caveat says outright "non-unit vectors give
  // scaled results" — i.e. scaling is the caller's to notice, not ours to undo.
  // Every documented example passes a unit direction, so no documented value
  // moves; only the three linearity programs change, from #f to #t.
  def('calc/directional-derivative', (f, point, direction) => {
    const F = wrapN(f, fuel)
    const p = isList(point) ? point.map(num) : [num(point)]
    const d = isList(direction) ? direction.map(num) : [num(direction)]
    let s = 0
    for (let i = 0; i < p.length; i++) s += partialAt(F, p, i) * (d[i] ?? 0)
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
      // Same one-list calling convention as wrapN: `(f '(x y))`, not `(f x y)`.
      // This used to pass `pt` spread, so every documented `(lambda (p) ...)`
      // vector-valued field was called with n args and now raises on arity.
      const vecAt = (pt) => {
        const out = callAtPoint(fields, pt, fuel)
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
  //
  // A field may return MORE components than the point has coordinates — the
  // chapter's div(curl F) = 0 programs do exactly that, wrapping a 2-D scalar
  // curl as (0 0 ω) and evaluating it at a 2-D point. Those extra components
  // are not an error and they are not "garbage": the point fixes the domain at
  // n variables, so F is literally a function of n variables, and ∂Fᵢ/∂xᵢ for
  // i ≥ n is the derivative of an n-ary function along an axis it does not
  // have — identically zero, not merely assumed zero. So sum over the axes the
  // domain actually supplies. Too FEW components stays an error: there the
  // missing term is genuinely unknown rather than provably nil.
  def('calc/divergence', (F, point) => {
    if (!isList(point)) return [sym('escalate'), sym('shape-error')]
    const p = point.map(num)
    const fs = fieldComponents(F, p, fuel)
    if (!fs) return [sym('escalate'), sym('shape-error')]
    if (fs.length < p.length) return [sym('escalate'), sym('shape-error')]
    let s = 0
    for (let i = 0; i < p.length; i++) s += partialAt(fs[i], p, i)
    if (!Number.isFinite(s)) return [sym('escalate'), sym('diverged')]
    return s
  })

  // Curl of 3D vector field at point. Returns [∂Fz/∂y-∂Fy/∂z,
  //   ∂Fx/∂z-∂Fz/∂x, ∂Fy/∂x-∂Fx/∂y].
  // In 2D returns the scalar ∂Fy/∂x-∂Fx/∂y.
  def('calc/curl', (F, point) => {
    if (!isList(point)) return [sym('escalate'), sym('shape-error')]
    const p = point.map(num)
    const fs = fieldComponents(F, p, fuel)
    if (!fs) return [sym('escalate'), sym('shape-error')]
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
    const A = num(a), B = num(b)
    const g = (x) => Math.sqrt(1 + ddxIn(F, x, A, B) ** 2)
    return simpson(g, A, B)
  })

  // Parametric arc length: ∫ √(x'(t)² + y'(t)²) dt.
  def('calc/arc-length-param', (fx, fy, t0, t1) => {
    const X = wrap1(fx, fuel)
    const Y = wrap1(fy, fuel)
    const T0 = num(t0), T1 = num(t1)
    const g = (t) => Math.sqrt(ddxIn(X, t, T0, T1) ** 2 + ddxIn(Y, t, T0, T1) ** 2)
    return simpson(g, T0, T1)
  })

  // Surface area from revolving y = f(x) about x-axis:
  //   ∫ 2π f(x) √(1 + f'(x)²) dx
  def('calc/surface-revolution', (f, a, b) => {
    const F = wrap1(f, fuel)
    const A = num(a), B = num(b)
    const g = (x) => 2 * Math.PI * Math.abs(F(x)) * Math.sqrt(1 + ddxIn(F, x, A, B) ** 2)
    return simpson(g, A, B)
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

  // Line integral over a parametric curve.
  //
  //   scalar (default)  ∫ f(r(t)) |r'(t)| dt      — the field weighted by arc length
  //   'vector           ∫ F(r(t)) · r'(t) dt      — circulation / work
  //
  // The `curve` argument has two written shapes and both are honoured, because
  // they are told apart with no guessing:
  //   • a CLOSURE t ↦ (x y [z]) over the default domain t ∈ [0, 1]. This is the
  //     chapter's form (11 of 16 call sites) and the one its :signature
  //     declares, `(calc/line-integral f-or-F curve [integrand-type])`.
  //   • a LIST (x-fn y-fn t0 t1). This is the form taught in
  //     book-of-math/ch-advanced-16, so it must keep working.
  //
  // The integrand-type argument used to be accepted and then IGNORED — every
  // 'vector call silently got the scalar arc-length integral instead of the
  // circulation, which is a different number, not a rounder one.
  def('calc/line-integral', (fOrF, curve, integrandType) => {
    let R, t0, t1, dim
    if (isList(curve)) {
      if (curve.length < 4) return [sym('escalate'), sym('shape-error')]
      const [xfn, yfn, a, b] = curve
      const X = wrap1(xfn, fuel), Y = wrap1(yfn, fuel)
      R = (t) => [X(t), Y(t), 0]
      t0 = num(a); t1 = num(b); dim = 2
    } else if (curve != null) {
      let d = null
      R = (t) => {
        const r = apply(curve, [t], fuel)
        if (!isList(r)) { d = 1; return [num(r), 0, 0] }
        d = r.length
        return to3(r)
      }
      R(0)  // probe once so `dim` reflects how many coordinates the curve emits
      t0 = 0; t1 = 1; dim = d
    } else {
      return [sym('escalate'), sym('shape-error')]
    }
    const kind = integrandType instanceof Sym ? integrandType.name : String(integrandType)
    const dR = (t) => {
      const h = H_DERIV
      const a = R(t - h), b = R(t + h)
      return [(b[0] - a[0]) / (2 * h), (b[1] - a[1]) / (2 * h), (b[2] - a[2]) / (2 * h)]
    }
    if (kind === 'vector' || kind === 'flux') {
      return simpson((t) => {
        const F = callAtPoint(fOrF, R(t).slice(0, dim), fuel)
        return dot3(to3(isList(F) ? F : [F, 0, 0]), dR(t))
      }, t0, t1)
    }
    return simpson((t) => {
      const f = num(callAtPoint(fOrF, R(t).slice(0, dim), fuel))
      return f * Math.hypot(...dR(t))
    }, t0, t1)
  })

  // Surface integral over a parametric surface (u, v) ↦ (x y z).
  //
  //   'scalar   ∫∫ f(r(u,v)) |r_u × r_v| du dv    — area-weighted scalar
  //   'flux     ∫∫ F(r(u,v)) · (r_u × r_v) du dv  — oriented normal flow
  //   'flat     legacy rectangle mode (book-of-math ch-advanced-16): the scalar
  //             field-fn(x, y) over [x0,x1]x[y0,y1] from opts.
  //
  // Only 'flat existed; 'scalar and 'flux escalated 'not-implemented, so the
  // nine chapter-11 call sites that ask for them got an (escalate ...) marker
  // where they documented a number.
  //
  // DEFAULT (u, v) DOMAIN = [0, 2π] x [0, π]. The record's :caveats used to say
  // the default was [0,1]x[0,1], but six runnable examples in the same record
  // pass the standard sphere parametrisation with NO opts and pin the answer at
  // 4π — the unit sphere's area — which only holds over [0,2π]x[0,π]. Six
  // value-bearing examples outrank one prose clause; the caveat was corrected
  // to match. Pass opts to override.
  def('calc/surface-integral', (surfaceFn, fieldFn, mode, opts) => {
    const m = mode instanceof Sym ? mode.name : String(mode)
    if (m === 'flat') {
      if (!isList(opts) || opts.length < 4) return [sym('escalate'), sym('bad-bounds')]
      const [x0, x1, y0, y1] = opts.map(num)
      const g = (x) => simpson((y) => num(apply(fieldFn, [x, y], fuel)), y0, y1, 40)
      return simpson(g, x0, x1, 40)
    }
    if (m !== 'scalar' && m !== 'flux') return [sym('escalate'), sym('not-implemented')]
    const [u0, u1, v0, v1] = (isList(opts) && opts.length >= 4)
      ? opts.map(num)
      : [0, 2 * Math.PI, 0, Math.PI]
    const S = (u, v) => {
      const r = apply(surfaceFn, [u, v], fuel)
      return isList(r) ? to3(r) : [num(r), 0, 0]
    }
    // Forward differences for the tangent vectors, reusing r(u,v) itself, so a
    // grid node costs THREE Scheme applies instead of five. The CLI's default
    // fuel budget is 200000 and snippets in this chapter call the verb twice in
    // one expression; a central-difference normal on a fine grid exhausts it.
    // h = 1e-5 keeps the O(h) tangent error near 1e-5 — far below the accuracy
    // the quadrature itself delivers.
    const h = 1e-5
    // ORIENTATION. r_u x r_v points whichever way the parametrisation happens
    // to order its arguments — for the standard sphere it points INWARD, for
    // the standard cylinder OUTWARD — so taking it as given makes the sign of a
    // flux an accident of how the surface was written. The record pins flux
    // OUTWARD: it reads the flux of E = (x,y,z) through the unit sphere as +4π
    // (Gauss's law) and prints it side by side with calc/divergence, which is
    // +3 at the centre; the divergence theorem only reconciles those two with
    // an outward normal. So we orient outward — away from the surface's own
    // centroid — and do it ONCE globally, never per node (a per-node flip would
    // quietly turn a genuinely non-convex surface into a wrong number rather
    // than an honest one). Accumulate ΣN·p, ΣN and Σp during the quadrature and
    // resolve the sign afterwards: Σ N·(p − c) = Σ N·p − (Σ N)·c.
    let sNp = 0, sN = [0, 0, 0], sP = [0, 0, 0], nodes = 0
    const integrand = (u, v) => {
      const p = S(u, v)
      const ru = S(u + h, v), rv = S(u, v + h)
      const N = cross(
        [(ru[0] - p[0]) / h, (ru[1] - p[1]) / h, (ru[2] - p[2]) / h],
        [(rv[0] - p[0]) / h, (rv[1] - p[1]) / h, (rv[2] - p[2]) / h],
      )
      if (m === 'flux') {
        sNp += dot3(N, p); nodes++
        for (let k = 0; k < 3; k++) { sN[k] += N[k]; sP[k] += p[k] }
        const F = callAtPoint(fieldFn, p, fuel)
        return dot3(to3(isList(F) ? F : [F, 0, 0]), N)
      }
      return num(callAtPoint(fieldFn, p, fuel)) * Math.hypot(...N)
    }
    // 12x12 tensor Simpson — 169 nodes, 3 surface applies + 1 field apply each.
    // The integrands here are smooth (|r_u x r_v| = sin v on the unit sphere),
    // and Simpson is already exact to ~5 digits at 12 panels.
    const N = 12
    const raw = simpson((u) => simpson((v) => integrand(u, v), v0, v1, N), u0, u1, N)
    if (m !== 'flux' || !nodes) return raw
    const c = [sP[0] / nodes, sP[1] / nodes, sP[2] / nodes]
    const outward = sNp - dot3(sN, c)
    return outward < 0 ? -raw : raw
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
        const root = (lo + hi) / 2
        // Dedupe. When f'(x) is exactly 0 AT a grid node (x² at x=0, the common
        // textbook case) BOTH brackets touching that node see `prev * cur <= 0`
        // and both bisect to the same point, so a single critical point was
        // reported twice — which made extrema-1d list x=2 twice for a parabola
        // while the chapter pins optimization-report at ONE entry. Merge within
        // half a grid step: the sampler cannot resolve two distinct sign changes
        // closer than that anyway, so nothing real is lost.
        if (!roots.length || Math.abs(roots[roots.length - 1] - root) > h / 2) {
          roots.push(root)
        }
      }
      prev = cur
    }
    return roots
  })

  // Extrema on [a, b]: classify each INTERIOR critical point by second
  // derivative. Returns list of (list x kind f(x)) with kind ∈ {'min 'max
  // 'saddle}. The third slot is not decoration — 11-calc.slat reads it with
  // caddr in three places and pins the values: best-minimum on x²−4x+5 over
  // [0,4] claims (min-at 2 value 1) = f(2), and optimization-report on
  // 2x²−8x+6 over [0,5] claims ((x 2 type min value -2)) = f(2). This used to
  // return a 2-list, so every caddr read fell off the end.
  // Endpoints are NOT included: the row-5 example pins x³ on [-1,1] at ().
  def('calc/extrema-1d', (f, a, b) => {
    const F = wrap1(f, fuel)
    const critsFn = env.vars.get('calc/critical-points-1d')
    // critsFn is the REGISTERED verb, so it answers in the cell spelling even
    // though this caller is inside array-world.
    const crits = critsFn(f, a, b)
    const out = []
    if (!isList(crits)) return out
    for (const x of listItems(crits)) {
      const d2 = d2dx2(F, num(x))
      let kind
      if (Math.abs(d2) < 1e-4) kind = sym('saddle')
      else if (d2 > 0) kind = sym('min')
      else kind = sym('max')
      out.push([num(x), kind, F(num(x))])
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

  // Radius of convergence via the ratio test on the coeffs list.
  // R = lim |aₙ / aₙ₊₁|. Returns (radius interval) with interval = (-R R).
  //
  // This used to return the MEAN of the sampled ratios, which is not the ratio
  // test — the ratio test is a LIMIT, and averaging drags a growing sequence
  // down toward its early terms. On the exponential coefficients the record
  // itself uses as a CI smoke test the ratios run 1,2,3,4,5,6: the mean is 3.5
  // and the documented claim `(> (car ...) 5)` quietly printed #f, while the
  // limit estimate 6 satisfies it. Take the LAST usable ratio — the best
  // estimate of the limit from a finite prefix — and let the caller add terms
  // when they want a sharper one.
  def('calc/radius-of-convergence', (coeffs) => {
    if (!isList(coeffs) || coeffs.length < 2) return [sym('escalate'), sym('too-few-coeffs')]
    let last = null
    for (let i = 0; i < coeffs.length - 1; i++) {
      const a = Math.abs(num(coeffs[i]))
      const b = Math.abs(num(coeffs[i + 1]))
      if (b < 1e-15) continue
      const r = a / b
      if (Number.isFinite(r)) last = r
    }
    if (last === null) return [sym('escalate'), sym('inconclusive')]
    return [last, [-last, last]]
  })

  // Series-converges? — nth-term test + ratio test on coeff-fn(n).
  //
  // Both tests used to be decided from the wrong quantity, and both misread the
  // harmonic series, which 11-calc.slat pins three separate times (:examples
  // novice note, row-2 :cs-program, row-4 third :claim) as the canonical
  // 'inconclusive case:
  //
  //   * The nth-term test compared |a_n| at ONE n against a fixed 1e-3 floor.
  //     But a_n → 0 is a statement about a LIMIT, not about the value at
  //     n = 200: the harmonic term 1/201 ≈ 0.005 clears that floor while
  //     plainly still falling, so the verb answered 'diverges. Ask instead
  //     whether the term is still SHRINKING between a small and a large n.
  //   * The ratio test averaged the ratios over a window. L = lim|a_{n+1}/a_n|
  //     is likewise a limit, and averaging drags a monotonically rising ratio
  //     below its own limit — the harmonic ratios mean 0.990 over n∈[50,200]
  //     but converge to 1. Read the LAST usable ratio. (Same defect, same fix,
  //     as calc/radius-of-convergence above.)
  def('calc/series-converges?', (coeffFn, opts) => {
    const c = (n) => num(apply(coeffFn, [n], fuel))
    // nth-term test as a limit: terms that are still appreciably large and no
    // longer shrinking cannot tend to 0, so the series diverges.
    const aSmall = Math.abs(c(50)), aBig = Math.abs(c(200))
    if (!Number.isFinite(aBig)) return sym('inconclusive')
    if (aBig > 1e-6 && aBig > 0.9 * aSmall) return sym('diverges')
    // Ratio test: estimate L by the largest n we can afford, not by a mean.
    let last = null
    for (let n = 50; n <= 400; n += 50) {
      const a = Math.abs(c(n))
      const b = Math.abs(c(n + 1))
      if (!Number.isFinite(a) || !Number.isFinite(b) || a < 1e-30) continue
      const r = b / a
      if (Number.isFinite(r)) last = r
    }
    if (last === null) return sym('inconclusive')
    if (last < 0.99) return sym('converges')
    if (last > 1.01) return sym('diverges')
    return sym('inconclusive')
  })

  return env
}

export default installCalc
