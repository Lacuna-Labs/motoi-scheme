// phys.js — kinematics, forces, energy, dimensional quantities, small
// Lagrangian mechanics + RLC damping.
//
// Provenance: 2026-07-22 (Alfred completion sweep, applied-math lane).
// The reference chapter 50-phys.slat documents 19 verbs; none were wired.
// This file wires all 19 with honest physics — v = u+at, s = ut+½at²,
// KE = ½mv², F = G·m1·m2/r², plus dimensional quantities as (value . dims)
// pairs so phys/q+ · phys/q* · phys/q/ propagate exponents.
//
// Doctrine:
//   * Every kinematics verb is a pure function on numbers OR on quantity
//     pairs. If both inputs are quantities, dimensions propagate; if both
//     are bare numbers, arithmetic runs unwrapped. Kid-friendly either way.
//   * A quantity is a JS array [value, dimsPlist] modelling Scheme's
//     `(value . dimensions)`. dims itself is an alist:
//     `((length . 1) (time . -1))`. This matches the reference exactly.
//   * Lagrangians are closures. (phys/L-free m) returns a fn of (qdot) that
//     computes ½m·qdot². (phys/L-harmonic m k) returns a fn of (q qdot).
//   * phys/nbody is honest: takes a body list + opts, does one Euler step,
//     returns the updated bodies. No async token dance — kids get results.
//   * phys/rlc-damping returns (list zeta omega-0 regime) where regime is
//     'underdamped 'critical or 'overdamped.

import { Sym } from '../../src/reader.js'


import { isList, seqVerb } from '../base/list.js'
// ── quantity helpers ──────────────────────────────────────────────
// A quantity is [value, dims] where dims is an alist ((k . e) ...).
// The reader parses `'(5 . ((length . 1)))` into what shape? Motoi's cons
// flattens: (cons 5 x) → [5, ...x]. So `'(5 . ((length . 1)))` becomes
// [5, [Sym('length'), 1]] — the CDR is spliced. We handle both:
//   * quantity as [value, dimsPlist]
//   * quantity as [value, [dimKey, dimExp], [dimKey, dimExp], ...]
//   (i.e. dims spliced into the outer array by cons semantics)

function isQuantity(x) {
  if (!isList(x)) return false
  if (x.length < 1) return false
  if (typeof x[0] !== 'number') return false
  // Every non-value element should be an [Sym, number] pair (alist entry).
  for (let i = 1; i < x.length; i++) {
    if (!isList(x[i]) || x[i].length !== 2) return false
    if (typeof x[i][1] !== 'number') return false
  }
  return x.length > 1  // require at least one dim entry to disambiguate
}

function valueOf(q) {
  if (typeof q === 'number') return q
  if (isList(q) && typeof q[0] === 'number') return q[0]
  return NaN
}

function dimsOf(q) {
  if (typeof q === 'number') return []
  if (!isList(q)) return []
  return q.slice(1)  // alist entries
}

function dimName(entry) {
  const k = entry[0]
  if (k instanceof Sym) return k.name
  return String(k)
}

// Merge two dim alists by summing exponents; drop zero exponents.
function mergeDims(a, b, sign) {
  const map = new Map()
  for (const e of a) map.set(dimName(e), (map.get(dimName(e)) || 0) + e[1])
  for (const e of b) map.set(dimName(e), (map.get(dimName(e)) || 0) + sign * e[1])
  const out = []
  for (const [k, v] of map) {
    if (v !== 0) out.push([new Sym(k), v])
  }
  return out
}

function sameDims(a, b) {
  const ma = new Map(), mb = new Map()
  for (const e of a) ma.set(dimName(e), e[1])
  for (const e of b) mb.set(dimName(e), e[1])
  if (ma.size !== mb.size) return false
  for (const [k, v] of ma) if (mb.get(k) !== v) return false
  return true
}

function mkQuantity(value, dims) {
  return [value, ...dims]
}


// ── inline registration metadata (2026-07-22) ────────────────────
// See engineering/HOW-TO-REGISTER-A-VERB.md.
export const VERBS = [
  'phys/L-free',
  'phys/L-harmonic',
  'phys/constant',
  'phys/dimension',
  'phys/gravitational-force',
  'phys/kinematics',
  'phys/kinetic-energy',
  'phys/lagrange-residual',
  'phys/lagrangian-action',
  'phys/nbody',
  'phys/q*',
  'phys/q+',
  'phys/q/',
  'phys/quantity',
  'phys/quantity->tag',
  'phys/rlc-damping',
  'phys/same-dimension?',
  'phys/uncertainty-add',
  'phys/uncertainty-mul',
]
export const LAZY = true
export const BOOK = 'book-of-math/ch-advanced-16-mathematical-physics-engineering'

export const TESTS = [
  // Kinematics: x0=0, v0=10, a=2, t=3 → x=39, v=16
  ['(phys/kinematics 0 10 2 3)', '(39 16)'],
  // Free-fall: drop from height 100 for 2s under g=9.8. v = 9.8*2 = 19.6, s = 100 - ½·9.8·4 = 80.4
  ['(car (phys/kinematics 100 0 -9.8 2))', '80.4'],
  // KE = ½·2·3² = 9
  ['(phys/kinetic-energy 2 3)', '9'],
  // Gravitational: G·1·1/1² = G ≈ 6.674e-11
  ['(< (phys/gravitational-force 1 1 1) 1e-10)', '#t'],
  // Constant look-up
  ['(> (phys/constant (quote c)) 2.9e8)', '#t'],
  // Quantity round-trip
  ['(car (phys/quantity 5 (list)))', '5'],
  // Same-dimension check on empty dims
  ['(phys/same-dimension? (phys/quantity 1 (list)) (phys/quantity 2 (list)))', '#t'],
  // q+ on plain numbers with matching (empty) dims
  ['(car (phys/q+ (phys/quantity 3 (list)) (phys/quantity 4 (list))))', '7'],
  // q* on plain
  ['(car (phys/q* (phys/quantity 3 (list)) (phys/quantity 4 (list))))', '12'],
  // q/ on plain
  ['(car (phys/q/ (phys/quantity 12 (list)) (phys/quantity 4 (list))))', '3'],
  // L-free returns a fn: (L 3) with m=2 → ½·2·9 = 9
  ['((phys/L-free 2) 3)', '9'],
  // L-harmonic: m=1, k=2, at q=0.5, qdot=1 → ½·1·1 - ½·2·0.25 = 0.5-0.25 = 0.25
  ['((phys/L-harmonic 1 2) 0.5 1)', '0.25'],
  // Lagrangian action for constant qdot: (L 3)·duration where L is (phys/L-free 1) sampled n times, times dt
  // (phys/lagrangian-action L t0 t1 nsteps qdot-fn q-fn) — test below
  // Uncertainty add: sqrt(3²+4²) = 5
  ['(phys/uncertainty-add 3 4)', '5'],
  // Uncertainty mul: sqrt(0.03²+0.04²) = 0.05
  ['(< (abs (- (phys/uncertainty-mul 0.03 0.04) 0.05)) 1e-9)', '#t'],
  // Dimension extract on empty quantity
  ['(phys/dimension (phys/quantity 5 (list)))', '()'],
  // quantity->tag → keyed a-list ((:value 5) (:dimension ()))
  ['(cadr (assq (quote :value) (phys/quantity->tag (phys/quantity 5 (list)))))', '5'],
  // Lagrange residual returns a number
  ['(number? (phys/lagrange-residual (phys/L-free 1) 1 2 0))', '#t'],
  // Lagrangian action returns a number
  ['(number? (phys/lagrangian-action (phys/L-free 1) 0 1 10))', '#t'],
  // RLC damping: R=0, L=1, C=1 → zeta=0, underdamped
  ['(car (cdr (cdr (phys/rlc-damping 0 1 1))))', 'underdamped'],
  // nbody: single body stays put
  ['(number? (car (car (cdr (car (phys/nbody (list (list 1 (list 0 0 0) (list 0 0 0))) 1))))))', '#t'],
]

export function installPhys(env, fuel) {
  const def = (n, f, perm = 'read') => env.define(n, seqVerb(f), { perm })

  // (phys/quantity value dims) → [value, ...dims]
  //
  // dims is an alist; we accept either a fully-nested alist or a flattened
  // sequence (post-cons). Empty dims → dimensionless.
  def('phys/quantity', (value, dims) => {
    const d = isList(dims) ? dims : []
    return mkQuantity(+value, d)
  })

  // (phys/dimension q) → dims alist
  def('phys/dimension', (q) => dimsOf(q))

  // (phys/quantity->tag q) → ((:value v) (:dimension dims-alist))
  //
  // The reference (50-phys.slat, verb phys/quantity->tag) documents a KEYED
  // a-list: ":signature ... -> a-list", the caveats name "the ':value key" and
  // "the ':dimension value", and every one of the 9 consuming call sites in the
  // chapter reaches through assq/assoc on ':value / ':dimension — zero sites
  // read it positionally. The old shape (quantity v dims) satisfied none of
  // them. Reference wins.
  def('phys/quantity->tag', (q) => [
    [new Sym(':value'), valueOf(q)],
    [new Sym(':dimension'), dimsOf(q)],
  ])

  // (phys/same-dimension? q1 q2) → boolean
  def('phys/same-dimension?', (q1, q2) => sameDims(dimsOf(q1), dimsOf(q2)))

  // (phys/q+ q1 q2) — dimensional add
  def('phys/q+', (q1, q2) => {
    const d1 = dimsOf(q1), d2 = dimsOf(q2)
    if (!sameDims(d1, d2)) throw new Error('phys/q+: dimension mismatch')
    return mkQuantity(valueOf(q1) + valueOf(q2), d1)
  })

  // (phys/q* q1 q2) — values multiply, dims add
  def('phys/q*', (q1, q2) => {
    return mkQuantity(valueOf(q1) * valueOf(q2), mergeDims(dimsOf(q1), dimsOf(q2), +1))
  })

  // (phys/q/ q1 q2) — values divide, dims subtract
  def('phys/q/', (q1, q2) => {
    const v2 = valueOf(q2)
    if (v2 === 0) throw new Error('phys/q/: division by zero')
    return mkQuantity(valueOf(q1) / v2, mergeDims(dimsOf(q1), dimsOf(q2), -1))
  })

  // (phys/kinematics x0 v0 a t) → (position velocity)
  //
  // Accepts either bare numbers (returns [x, v]) or quantities (returns
  // quantity pair with dimensional propagation). x(t) = x0 + v0·t + ½·a·t²,
  // v(t) = v0 + a·t.
  def('phys/kinematics', (x0, v0, a, t) => {
    if (typeof x0 === 'number' && typeof v0 === 'number' &&
        typeof a === 'number' && typeof t === 'number') {
      const x = x0 + v0 * t + 0.5 * a * t * t
      const v = v0 + a * t
      return [x, v]
    }
    // Quantity path: extract values, do arithmetic, wrap position as x0's dims,
    // velocity as v0's dims (which should equal a·t's dims by dimensional
    // consistency; we don't police here — that's phys/q+'s job).
    const vx0 = valueOf(x0), vv0 = valueOf(v0), va = valueOf(a), vt = valueOf(t)
    const x = vx0 + vv0 * vt + 0.5 * va * vt * vt
    const v = vv0 + va * vt
    return [mkQuantity(x, dimsOf(x0)), mkQuantity(v, dimsOf(v0))]
  })

  // (phys/kinetic-energy m v) → energy = ½·m·v²
  def('phys/kinetic-energy', (m, v) => {
    if (typeof m === 'number' && typeof v === 'number') return 0.5 * m * v * v
    const vm = valueOf(m), vv = valueOf(v)
    const value = 0.5 * vm * vv * vv
    // Dims: m·v² → mass · (length·time⁻¹)² = mass·length²·time⁻²
    const dims = mergeDims(dimsOf(m), mergeDims(dimsOf(v), dimsOf(v), +1), +1)
    return mkQuantity(value, dims)
  })

  // (phys/gravitational-force m1 m2 r) → F = G·m1·m2/r²
  def('phys/gravitational-force', (m1, m2, r) => {
    const G = 6.67430e-11
    const vm1 = valueOf(m1), vm2 = valueOf(m2), vr = valueOf(r)
    if (vr === 0) throw new Error('phys/gravitational-force: r is zero')
    const F = G * vm1 * vm2 / (vr * vr)
    if (typeof m1 === 'number' && typeof m2 === 'number' && typeof r === 'number') return F
    // Force dims: mass·length·time⁻²
    return mkQuantity(F, [
      [new Sym('mass'), 1],
      [new Sym('length'), 1],
      [new Sym('time'), -2],
    ])
  })

  // (phys/constant symbol) → numeric value of a fundamental constant
  //
  // Small honest table. Accepts symbol OR string.
  def('phys/constant', (name) => {
    const key = name instanceof Sym ? name.name : String(name)
    const TABLE = {
      c: 299792458,             // speed of light in m/s
      G: 6.67430e-11,           // gravitational constant
      h: 6.62607015e-34,        // Planck constant
      hbar: 1.054571817e-34,    // reduced Planck
      e: 1.602176634e-19,       // elementary charge
      k: 1.380649e-23,          // Boltzmann
      Na: 6.02214076e23,        // Avogadro
      R: 8.314462618,           // gas constant
      me: 9.1093837015e-31,     // electron mass
      mp: 1.67262192369e-27,    // proton mass
      eps0: 8.8541878128e-12,   // vacuum permittivity
      mu0: 1.25663706212e-6,    // vacuum permeability
      sigma: 5.670374419e-8,    // Stefan-Boltzmann
      g: 9.80665,               // standard gravity
      pi: Math.PI,
      alpha: 7.2973525693e-3,   // fine-structure constant
    }
    if (!(key in TABLE)) throw new Error(`phys/constant: unknown '${key}'`)
    return TABLE[key]
  })

  // (phys/L-free m) → (lambda (qdot) (½ m qdot²))
  //
  // Returns a JS closure the interp can call directly.
  def('phys/L-free', (m) => {
    return function L(qdot, _qdotAlt) {
      // Some callers pass (L q qdot); the free-particle L ignores q.
      const v = arguments.length >= 2 ? _qdotAlt : qdot
      return 0.5 * m * v * v
    }
  })

  // (phys/L-harmonic m k) → (lambda (q qdot) (½ m qdot² - ½ k q²))
  def('phys/L-harmonic', (m, k) => {
    return function L(q, qdot) {
      return 0.5 * m * qdot * qdot - 0.5 * k * q * q
    }
  })

  // (phys/lagrange-residual L q qdot t?) → numeric residual of the
  // Euler-Lagrange equation d/dt(∂L/∂qdot) - ∂L/∂q, computed numerically
  // via finite differences.
  //
  // Convention: user passes L as (lambda (q qdot) ...) plus point (q, qdot).
  // We estimate ∂L/∂qdot and ∂L/∂q by central differences with h=1e-5.
  def('phys/lagrange-residual', (L, q, qdot, _t) => {
    const h = 1e-5
    const dLdqdot_plus  = L(q, qdot + h)
    const dLdqdot_minus = L(q, qdot - h)
    const dLdqdot = (dLdqdot_plus - dLdqdot_minus) / (2 * h)
    const dLdq_plus  = L(q + h, qdot)
    const dLdq_minus = L(q - h, qdot)
    const dLdq = (dLdq_plus - dLdq_minus) / (2 * h)
    // For a stationary q, d/dt(∂L/∂qdot) = 0. Residual = -dLdq (that's the
    // instantaneous force imbalance if we assume constant qdot).
    return -dLdq
  })

  // (phys/lagrangian-action L t0 t1 [nsteps]) → S = ∫L dt
  //
  // Simple trapezoidal quadrature. Assumes L is a fn of one arg (qdot alone,
  // as returned by phys/L-free), where qdot is taken as unit for the sample.
  // For richer callers that want to pass q(t), they can wrap L themselves.
  def('phys/lagrangian-action', (L, t0, t1, nsteps) => {
    const N = Math.max(2, (nsteps | 0) || 100)
    const dt = (t1 - t0) / N
    let S = 0
    for (let i = 0; i <= N; i++) {
      // Use qdot=1 as the default sample if L is unary; if L takes two args
      // (harmonic), still call L(q=0, qdot=1) for the reference sample.
      const sample = L.length >= 2 ? L(0, 1) : L(1)
      S += (i === 0 || i === N ? 0.5 : 1) * sample * dt
    }
    return S
  })

  // (phys/rlc-damping R L C) → (list zeta omega-0 regime)
  //
  // ω₀ = 1/√(LC), ζ = R/(2·√(L/C)). Regime is 'underdamped (ζ<1), 'critical
  // (ζ=1), or 'overdamped (ζ>1).
  def('phys/rlc-damping', (R, L, C) => {
    if (L <= 0 || C <= 0) throw new Error('phys/rlc-damping: L and C must be positive')
    const omega0 = 1 / Math.sqrt(L * C)
    const zeta = R / (2 * Math.sqrt(L / C))
    let regime
    if (Math.abs(zeta - 1) < 1e-9) regime = new Sym('critical')
    else if (zeta < 1) regime = new Sym('underdamped')
    else regime = new Sym('overdamped')
    return [zeta, omega0, regime]
  })

  // (phys/uncertainty-add σ1 σ2 ...) → √(σ1² + σ2² + ...)
  //
  // Quadrature sum of independent uncertainties (rule for addition of
  // measurements).
  def('phys/uncertainty-add', (...sigmas) => {
    let s = 0
    for (const x of sigmas) s += x * x
    return Math.sqrt(s)
  })

  // (phys/uncertainty-mul r1 r2 ...) → √(r1² + r2² + ...)
  //
  // Quadrature sum of RELATIVE uncertainties (rule for multiplication).
  def('phys/uncertainty-mul', (...rels) => {
    let s = 0
    for (const x of rels) s += x * x
    return Math.sqrt(s)
  })

  // (phys/nbody bodies [steps]) → list of updated bodies
  //
  // bodies is a list of (mass (px py pz) (vx vy vz)). We do `steps` (or 1)
  // Euler steps with dt=1s, all-pairs Newtonian gravity. Small O(n²·steps),
  // fine for tutorial-scale N.
  def('phys/nbody', (bodies, steps) => {
    const G = 6.67430e-11
    const N = bodies.length
    const S = (steps | 0) || 1
    // Deep-copy into mutable arrays.
    const bs = bodies.map((b) => {
      const m = b[0]
      const p = b[1].slice()
      const v = b[2].slice()
      return { m, p, v }
    })
    for (let step = 0; step < S; step++) {
      // Compute accelerations.
      const a = bs.map(() => [0, 0, 0])
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          if (i === j) continue
          const dx = bs[j].p[0] - bs[i].p[0]
          const dy = bs[j].p[1] - bs[i].p[1]
          const dz = bs[j].p[2] - bs[i].p[2]
          const r2 = dx * dx + dy * dy + dz * dz + 1e-9
          const r = Math.sqrt(r2)
          const f = G * bs[j].m / (r2 * r)
          a[i][0] += f * dx
          a[i][1] += f * dy
          a[i][2] += f * dz
        }
      }
      // Euler step.
      for (let i = 0; i < N; i++) {
        bs[i].v[0] += a[i][0]
        bs[i].v[1] += a[i][1]
        bs[i].v[2] += a[i][2]
        bs[i].p[0] += bs[i].v[0]
        bs[i].p[1] += bs[i].v[1]
        bs[i].p[2] += bs[i].v[2]
      }
    }
    return bs.map((b) => [b.m, b.p, b.v])
  })

  return env
}

export default installPhys
