// vec.js — vector arithmetic for 2D+ points.
//
// Doctrine (Alfred, 2026-07-16): vectors are lists of numbers. `vec/make`
// packs them; `vec/add`, `vec/sub`, `vec/scale`, `vec/dot`, `vec/norm`,
// `vec/distance`, `vec/lerp`, `vec/zero`, `vec/ref`, `vec/dim` operate on
// them. Works for any dimension >= 1. Kid-friendly aliases: `vec/+` for
// `vec/add`, `vec/-` for `vec/sub`.

function asVec(v) {
  if (!Array.isArray(v)) return [+v]
  return v.map((x) => +x)
}


// ── inline registration metadata (2026-07-22) ────────────────────
// See engineering/HOW-TO-REGISTER-A-VERB.md.
export const VERBS = [
  "vec/+",
  "vec/-",
  "vec/->string",
  "vec/=",
  "vec/add",
  "vec/angle-between",
  "vec/cross",
  "vec/dim",
  "vec/distance",
  "vec/dot",
  "vec/lerp",
  "vec/make",
  "vec/norm",
  "vec/normalize",
  "vec/ref",
  "vec/scale",
  "vec/sub",
  "vec/zero",
]
export const LAZY = false

export function installVec(env, fuel) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  // (vec/make x y z ...) — build a vector of arbitrary dim.
  //
  // Patch 1 (2026-07-19, Book of ML feedback): also accept a single list
  // arg — `(vec/make (list 1 2 3))` behaves the same as `(vec/make 1 2 3)`.
  // Backwards-compatible: the variadic form still works. Ada's Book of ML
  // chapters lean on the list form as the natural way to build vectors
  // from computed sequences (e.g. `(vec/make (range 0 5))`).
  def('vec/make', (...xs) => {
    if (xs.length === 1 && Array.isArray(xs[0])) return xs[0].map((x) => +x)
    return xs.map((x) => +x)
  })
  // (vec/zero n) — n-dim zero vector.
  def('vec/zero', (n) => new Array(n | 0).fill(0))
  // (vec/dim v)
  def('vec/dim', (v) => (Array.isArray(v) ? v.length : 1))
  // (vec/ref v i)
  def('vec/ref', (v, i) => (Array.isArray(v) ? v[i | 0] : (i === 0 ? +v : undefined)))

  // Element-wise add / sub. Both length-tolerant — pads the shorter side
  // with 0.
  const zip = (a, b, op) => {
    const A = asVec(a), B = asVec(b)
    const n = Math.max(A.length, B.length)
    const r = new Array(n)
    for (let i = 0; i < n; i++) r[i] = op(A[i] ?? 0, B[i] ?? 0)
    return r
  }

  def('vec/add', (a, b) => zip(a, b, (x, y) => x + y))
  def('vec/sub', (a, b) => zip(a, b, (x, y) => x - y))
  def('vec/+',   (a, b) => zip(a, b, (x, y) => x + y))
  def('vec/-',   (a, b) => zip(a, b, (x, y) => x - y))

  // (vec/scale v k) — multiply every component by k.
  def('vec/scale', (v, k) => asVec(v).map((x) => x * k))

  // (vec/dot a b) — dot product.
  def('vec/dot', (a, b) => {
    const A = asVec(a), B = asVec(b)
    const n = Math.max(A.length, B.length)
    let s = 0
    for (let i = 0; i < n; i++) s += (A[i] ?? 0) * (B[i] ?? 0)
    return s
  })

  // (vec/norm v) — magnitude / length.
  def('vec/norm', (v) => {
    const V = asVec(v)
    let s = 0; for (const x of V) s += x * x
    return Math.sqrt(s)
  })

  // (vec/normalize v) — unit vector; zero vector stays zero.
  def('vec/normalize', (v) => {
    const V = asVec(v)
    let s = 0; for (const x of V) s += x * x
    const n = Math.sqrt(s)
    if (n === 0) return V.slice()
    return V.map((x) => x / n)
  })

  // (vec/distance a b)
  def('vec/distance', (a, b) => {
    const A = asVec(a), B = asVec(b)
    const n = Math.max(A.length, B.length)
    let s = 0
    for (let i = 0; i < n; i++) {
      const d = (A[i] ?? 0) - (B[i] ?? 0)
      s += d * d
    }
    return Math.sqrt(s)
  })

  // (vec/lerp a b t)
  def('vec/lerp', (a, b, t) => {
    const A = asVec(a), B = asVec(b)
    const n = Math.max(A.length, B.length)
    const r = new Array(n)
    for (let i = 0; i < n; i++) {
      const x = A[i] ?? 0, y = B[i] ?? 0
      r[i] = x + (y - x) * t
    }
    return r
  })

  // (vec/->string v) — canonical rendered form '(x y z ...)'.
  def('vec/->string', (v) => {
    const V = asVec(v)
    return '(' + V.map((x) => String(x)).join(' ') + ')'
  })

  // (vec/= a b) — element-wise equality; requires same length.
  def('vec/=', (a, b) => {
    const A = asVec(a), B = asVec(b)
    if (A.length !== B.length) return false
    for (let i = 0; i < A.length; i++) if (A[i] !== B[i]) return false
    return true
  })

  // (vec/angle-between a b) — angle in radians between two vectors.
  // Uses dot/|a||b|; clamps for numerical safety. Returns 0 for zero-length.
  def('vec/angle-between', (a, b) => {
    const A = asVec(a), B = asVec(b)
    const n = Math.max(A.length, B.length)
    let dot = 0, na = 0, nb = 0
    for (let i = 0; i < n; i++) {
      const x = A[i] ?? 0, y = B[i] ?? 0
      dot += x * y; na += x * x; nb += y * y
    }
    const denom = Math.sqrt(na) * Math.sqrt(nb)
    if (denom === 0) return 0
    const c = Math.max(-1, Math.min(1, dot / denom))
    return Math.acos(c)
  })

  // (vec/cross a b) — cross product. Two forms:
  //   3D:  (a1 a2 a3) × (b1 b2 b3) → 3-vector
  //   2D:  (a1 a2) × (b1 b2) → scalar (z-component of the 3D cross)
  def('vec/cross', (a, b) => {
    const A = asVec(a), B = asVec(b)
    if (A.length === 2 && B.length === 2) {
      return A[0] * B[1] - A[1] * B[0]
    }
    const a0 = A[0] ?? 0, a1 = A[1] ?? 0, a2 = A[2] ?? 0
    const b0 = B[0] ?? 0, b1 = B[1] ?? 0, b2 = B[2] ?? 0
    return [
      a1 * b2 - a2 * b1,
      a2 * b0 - a0 * b2,
      a0 * b1 - a1 * b0,
    ]
  })

  return env
}

export default installVec
