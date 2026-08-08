// linalg.js — linear algebra verbs (extending matrix.js).
//
// Provenance: 2026-07-22. Motoi linalg lane.
//
// matrix.js already provides construction + basic ops (add, sub, scale,
// multiply, transpose, matvec, identity, zero). This file adds:
//
//   Solvers:      linalg/solve · linalg/least-squares · linalg/lu
//   Determinant:  (used internally + exposed via linalg/is-invertible?)
//   Rank:         linalg/rank
//   Inversion:    linalg/inverse · linalg/is-invertible?
//   Eigen:        linalg/eigenvalues · linalg/eigenvalues-2x2 ·
//                 linalg/eigenvalues-3x3 · linalg/eigenvectors ·
//                 linalg/characteristic-poly
//   Decomp:       linalg/qr · linalg/gram-schmidt · linalg/null-space ·
//                 linalg/svd
//   Predicates:   linalg/is-symmetric? · linalg/is-orthogonal?
//   Utility:      linalg/trace · linalg/matrix-power · linalg/project ·
//                 linalg/vec-add
//
// Matrix representation matches lib/math/matrix.js: list-of-rows.
//
// All verbs are pure (no side effects, no shared state).

import { Sym } from '../../src/reader.js'

import { isList, seqVerb } from '../base/list.js'
const num = (x) => (typeof x === 'number' ? x : Number(x) || 0)

function rowsOf(m) { return isList(m) ? m.length : 0 }
function colsOf(m) {
  if (!isList(m) || m.length === 0) return 0
  return isList(m[0]) ? m[0].length : 0
}

function copyMatrix(m) {
  return m.map(r => isList(r) ? r.map(num) : [num(r)])
}

function makeIdentity(n) {
  const out = new Array(n)
  for (let i = 0; i < n; i++) {
    out[i] = new Array(n).fill(0)
    out[i][i] = 1
  }
  return out
}

function matMul(A, B) {
  const m = rowsOf(A), k = colsOf(A)
  const n = colsOf(B)
  const out = new Array(m)
  for (let i = 0; i < m; i++) {
    out[i] = new Array(n).fill(0)
    for (let j = 0; j < n; j++) {
      let s = 0
      for (let t = 0; t < k; t++) s += num(A[i][t]) * num(B[t][j])
      out[i][j] = s
    }
  }
  return out
}

function transpose(m) {
  const rows = rowsOf(m), cols = colsOf(m)
  const out = new Array(cols)
  for (let j = 0; j < cols; j++) {
    out[j] = new Array(rows)
    for (let i = 0; i < rows; i++) out[j][i] = num(m[i][j])
  }
  return out
}

// ── Gaussian elimination for solve / rank / null-space ─────────────

// Reduce [A | b] to row-echelon form. b may be null (rank/null-space) or
// a vector (solve). Returns { rows, rank, pivots }.
function rowReduce(A, b) {
  const m = rowsOf(A), n = colsOf(A)
  const augmented = A.map((row, i) => {
    const r = row.map(num)
    if (b !== null && b !== undefined) r.push(num(b[i]))
    return r
  })
  const nCols = n + (b ? 1 : 0)
  const pivots = []
  let row = 0
  for (let col = 0; col < n && row < m; col++) {
    // Partial pivoting: find max in column
    let maxRow = row
    let maxVal = Math.abs(augmented[row][col])
    for (let r = row + 1; r < m; r++) {
      const v = Math.abs(augmented[r][col])
      if (v > maxVal) { maxVal = v; maxRow = r }
    }
    if (maxVal < 1e-12) continue
    // Swap
    if (maxRow !== row) [augmented[row], augmented[maxRow]] = [augmented[maxRow], augmented[row]]
    // Normalize
    const pivot = augmented[row][col]
    for (let c = 0; c < nCols; c++) augmented[row][c] /= pivot
    // Eliminate
    for (let r = 0; r < m; r++) {
      if (r === row) continue
      const factor = augmented[r][col]
      if (Math.abs(factor) < 1e-12) continue
      for (let c = 0; c < nCols; c++) augmented[r][c] -= factor * augmented[row][c]
    }
    pivots.push(col)
    row++
  }
  return { rows: augmented, rank: pivots.length, pivots, m, n }
}

function determinant(A) {
  const n = rowsOf(A)
  if (n === 0 || colsOf(A) !== n) return 0
  const mat = copyMatrix(A)
  let det = 1
  for (let i = 0; i < n; i++) {
    // Partial pivoting
    let pivot = i
    for (let r = i + 1; r < n; r++) {
      if (Math.abs(mat[r][i]) > Math.abs(mat[pivot][i])) pivot = r
    }
    if (Math.abs(mat[pivot][i]) < 1e-12) return 0
    if (pivot !== i) {
      [mat[i], mat[pivot]] = [mat[pivot], mat[i]]
      det = -det
    }
    det *= mat[i][i]
    for (let r = i + 1; r < n; r++) {
      const f = mat[r][i] / mat[i][i]
      for (let c = i; c < n; c++) mat[r][c] -= f * mat[i][c]
    }
  }
  return det
}

function invert(A) {
  const n = rowsOf(A)
  if (n === 0 || colsOf(A) !== n) return null
  const aug = A.map((row, i) => {
    const r = row.map(num)
    for (let j = 0; j < n; j++) r.push(i === j ? 1 : 0)
    return r
  })
  for (let i = 0; i < n; i++) {
    let pivot = i
    for (let r = i + 1; r < n; r++) {
      if (Math.abs(aug[r][i]) > Math.abs(aug[pivot][i])) pivot = r
    }
    if (Math.abs(aug[pivot][i]) < 1e-12) return null
    if (pivot !== i) [aug[i], aug[pivot]] = [aug[pivot], aug[i]]
    const p = aug[i][i]
    for (let c = 0; c < 2 * n; c++) aug[i][c] /= p
    for (let r = 0; r < n; r++) {
      if (r === i) continue
      const f = aug[r][i]
      if (Math.abs(f) < 1e-12) continue
      for (let c = 0; c < 2 * n; c++) aug[r][c] -= f * aug[i][c]
    }
  }
  const inv = new Array(n)
  for (let i = 0; i < n; i++) inv[i] = aug[i].slice(n)
  return inv
}

// LU decomposition with PARTIAL PIVOTING: returns [L, U, P] with P·A = L·U,
// L unit-lower-triangular, U upper-triangular, P a permutation matrix.
// null only when A is not square.
//
// 38-linalg.slat's linalg/lu record is unanimous about the three-element
// shape: the :signature is "(linalg/lu M) -> (list L U P) | 'not-square",
// the :summary says "M = Pᵀ L U", the :explanation says "P M = L U", and
// three call sites reach for the third element — (list-ref lu 2) in the
// intermediate example, (caddr lu) in :row-4-proof :cs-program and in
// :row-5-emergence :math-composition. Zero sites treat the result as a
// two-element (L U). The old Doolittle version had no pivoting and no P.
//
// The singular case is likewise settled by the record, whose :caveats say
// "Singular matrices may produce U with zeros on diagonal; det(M) =
// det(P) × ∏ Uᵢᵢ" — so a zero pivot must NOT abort. :row-5-emergence
// :cs-composition (rank-from-lu) depends on exactly that: it counts the
// nonzero diagonal entries of U to recover the rank. So a dead column is
// skipped, leaving Uᵢᵢ = 0 and Lᵢᵢ = 1. The old code returned null there,
// which surfaced as the symbol 'lu-failed — a value the chapter never
// mentions anywhere.
function luDecomp(A) {
  const n = rowsOf(A)
  if (n === 0 || colsOf(A) !== n) return null

  const U = new Array(n)
  const L = new Array(n)
  const P = new Array(n)
  for (let i = 0; i < n; i++) {
    U[i] = new Array(n)
    for (let j = 0; j < n; j++) U[i][j] = num(A[i][j])
    L[i] = new Array(n).fill(0)
    P[i] = new Array(n).fill(0)
    P[i][i] = 1
  }

  for (let k = 0; k < n; k++) {
    // Partial pivot: largest magnitude in column k at or below the diagonal.
    let piv = k
    for (let i = k + 1; i < n; i++) {
      if (Math.abs(U[i][k]) > Math.abs(U[piv][k])) piv = i
    }
    if (Math.abs(U[piv][k]) < 1e-12) continue  // singular column: U[k][k] stays 0
    if (piv !== k) {
      const ut = U[k]; U[k] = U[piv]; U[piv] = ut
      const pt = P[k]; P[k] = P[piv]; P[piv] = pt
      // L's already-computed multipliers travel with their row.
      for (let j = 0; j < k; j++) {
        const t = L[k][j]; L[k][j] = L[piv][j]; L[piv][j] = t
      }
    }
    for (let i = k + 1; i < n; i++) {
      const f = U[i][k] / U[k][k]
      L[i][k] = f
      U[i][k] = 0                       // exact zero, not float residue
      for (let j = k + 1; j < n; j++) U[i][j] -= f * U[k][j]
    }
  }
  for (let i = 0; i < n; i++) L[i][i] = 1

  return [L, U, P]
}

// QR decomposition via classical Gram-Schmidt.
function qrDecomp(A) {
  const m = rowsOf(A), n = colsOf(A)
  const Q = new Array(m)
  for (let i = 0; i < m; i++) Q[i] = new Array(n).fill(0)
  const R = new Array(n)
  for (let i = 0; i < n; i++) R[i] = new Array(n).fill(0)

  for (let k = 0; k < n; k++) {
    // v = A[:, k]
    const v = new Array(m)
    for (let i = 0; i < m; i++) v[i] = num(A[i][k])
    for (let j = 0; j < k; j++) {
      let r = 0
      for (let i = 0; i < m; i++) r += Q[i][j] * v[i]
      R[j][k] = r
      for (let i = 0; i < m; i++) v[i] -= r * Q[i][j]
    }
    let nrm = 0
    for (let i = 0; i < m; i++) nrm += v[i] * v[i]
    nrm = Math.sqrt(nrm)
    R[k][k] = nrm
    if (nrm > 1e-12) {
      for (let i = 0; i < m; i++) Q[i][k] = v[i] / nrm
    }
  }
  return [Q, R]
}

// Gram-Schmidt on a list of column-vectors (each a list).
// Returns an orthonormal list.
function gramSchmidt(vectors) {
  if (!isList(vectors)) return []
  const out = []
  for (const v0 of vectors) {
    if (!isList(v0)) continue
    const v = v0.map(num)
    for (const u of out) {
      let dot = 0
      for (let i = 0; i < v.length; i++) dot += v[i] * u[i]
      for (let i = 0; i < v.length; i++) v[i] -= dot * u[i]
    }
    let nrm = 0
    for (let i = 0; i < v.length; i++) nrm += v[i] * v[i]
    nrm = Math.sqrt(nrm)
    if (nrm > 1e-12) {
      for (let i = 0; i < v.length; i++) v[i] /= nrm
      out.push(v)
    }
  }
  return out
}

// Null space: basis of {x : A x = 0}. Uses RREF.
function nullSpace(A) {
  const m = rowsOf(A), n = colsOf(A)
  if (n === 0) return []
  const { rows, pivots } = rowReduce(A, null)
  const pivotSet = new Set(pivots)
  const freeCols = []
  for (let c = 0; c < n; c++) if (!pivotSet.has(c)) freeCols.push(c)
  const basis = []
  for (const f of freeCols) {
    const vec = new Array(n).fill(0)
    vec[f] = 1
    // For each pivot row: vec[pivot_col] = -rows[i][f]
    for (let i = 0; i < pivots.length; i++) {
      vec[pivots[i]] = -rows[i][f]
    }
    basis.push(vec)
  }
  return basis
}

// Eigenvalues of 2x2: solve x^2 - trace*x + det = 0.
function eigen2x2(A) {
  const a = num(A[0][0]), b = num(A[0][1])
  const c = num(A[1][0]), d = num(A[1][1])
  const tr = a + d
  const det = a * d - b * c
  const disc = tr * tr - 4 * det
  if (disc < 0) return new Sym('complex-eigenvalues')
  const s = Math.sqrt(disc)
  return [(tr + s) / 2, (tr - s) / 2]
}

// Eigenvalues of 3x3: cubic via Cardano/trigonometric for symmetric case.
// For general 3x3 we use a numeric root-finder on the characteristic poly.
function eigen3x3(A) {
  const a = num(A[0][0]), b = num(A[0][1]), c = num(A[0][2])
  const d = num(A[1][0]), e = num(A[1][1]), f = num(A[1][2])
  const g = num(A[2][0]), h = num(A[2][1]), i = num(A[2][2])
  // Characteristic polynomial: det(A - λI) = -λ^3 + tr·λ^2 - m·λ + det
  // where m = sum of 2x2 principal minors.
  const tr = a + e + i
  const m = (e * i - f * h) + (a * i - c * g) + (a * e - b * d)
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g)
  // Solve λ^3 - tr·λ^2 + m·λ - det = 0
  return solveCubic(1, -tr, m, -det)
}

// Solve monic cubic x^3 + px^2 + qx + r = 0 (real roots as best we can).
function solveCubic(a3, a2, a1, a0) {
  // Normalize
  const p = a2 / a3
  const q = a1 / a3
  const r = a0 / a3
  // Substitute x = y - p/3 → depressed cubic y^3 + Py + Q = 0
  const P = q - (p * p) / 3
  const Q = (2 * p * p * p) / 27 - (p * q) / 3 + r
  const D = (Q * Q) / 4 + (P * P * P) / 27
  const shift = -p / 3
  if (D > 1e-12) {
    // one real root
    const sq = Math.sqrt(D)
    const u = Math.cbrt(-Q / 2 + sq)
    const v = Math.cbrt(-Q / 2 - sq)
    return [u + v + shift]
  } else if (D < -1e-12) {
    // three distinct real roots (use trig)
    const A = 2 * Math.sqrt(-P / 3)
    const arg = 3 * Q / (P * A)
    const phi = Math.acos(Math.max(-1, Math.min(1, arg)))
    const roots = []
    for (let k = 0; k < 3; k++) {
      roots.push(A * Math.cos((phi - 2 * Math.PI * k) / 3) + shift)
    }
    return roots.sort((a, b) => b - a)
  } else {
    // triple or double root
    const u = Math.cbrt(-Q / 2)
    return [2 * u + shift, -u + shift]
  }
}

// Eigenvalues of a symmetric matrix via QR iteration (Wilkinson shift).
function eigenSymmetric(A, iter = 100, tol = 1e-10) {
  const n = rowsOf(A)
  if (n === 0) return []
  let X = copyMatrix(A)
  for (let it = 0; it < iter; it++) {
    // Wilkinson shift on bottom-right 2x2
    let shift = 0
    if (n >= 2) {
      const d = (X[n - 2][n - 2] - X[n - 1][n - 1]) / 2
      const sign = d >= 0 ? 1 : -1
      shift = X[n - 1][n - 1] - (sign * X[n - 1][n - 2] * X[n - 1][n - 2]) /
              (Math.abs(d) + Math.sqrt(d * d + X[n - 1][n - 2] * X[n - 1][n - 2]) || 1)
    }
    // Shift
    for (let i = 0; i < n; i++) X[i][i] -= shift
    const [Q, R] = qrDecomp(X)
    X = matMul(R, Q)
    // Unshift
    for (let i = 0; i < n; i++) X[i][i] += shift
    // Check convergence: off-diagonal small?
    let offMax = 0
    for (let i = 1; i < n; i++) offMax = Math.max(offMax, Math.abs(X[i][i - 1]))
    if (offMax < tol) break
  }
  const evs = []
  for (let i = 0; i < n; i++) evs.push(X[i][i])
  return evs.sort((a, b) => b - a)
}

// General eigenvalues (small dispatch)
function eigenvalues(A) {
  const n = rowsOf(A)
  if (n === 0 || colsOf(A) !== n) return []
  if (n === 1) return [num(A[0][0])]
  if (n === 2) return eigen2x2(A)
  if (n === 3) return eigen3x3(A)
  // n >= 4: use QR iteration (works well for symmetric; approximate else)
  if (n <= 8) return eigenSymmetric(A)
  return new Sym('use-backend')
}

// Characteristic polynomial coefficients (Faddeev-Leverrier), returned
// low-to-high (const, x, x^2, ..., x^n).
function characteristicPoly(A) {
  const n = rowsOf(A)
  if (n === 0 || colsOf(A) !== n) return [1]
  // Coefficients c_0, c_1, ..., c_n such that p(λ) = sum c_k λ^k, with c_n = 1.
  // Faddeev-Leverrier: M_1 = A, c_{n-1} = -tr(M_1); M_2 = A(M_1 + c_{n-1} I),
  // c_{n-2} = -tr(M_2)/2; ...
  let M = copyMatrix(A)
  const c = new Array(n + 1).fill(0)
  c[n] = 1
  for (let k = 1; k <= n; k++) {
    let tr = 0
    for (let i = 0; i < n; i++) tr += M[i][i]
    c[n - k] = -tr / k
    if (k < n) {
      // M = A * (M + c[n-k] I)
      const M2 = copyMatrix(M)
      for (let i = 0; i < n; i++) M2[i][i] += c[n - k]
      M = matMul(A, M2)
    }
  }
  return c
}

// Eigenvectors for known eigenvalues: solve (A - λI) v = 0.
function eigenvectorsFor(A, lambdas) {
  const n = rowsOf(A)
  const out = []
  for (const l of lambdas) {
    if (typeof l !== 'number') continue
    const M = copyMatrix(A)
    for (let i = 0; i < n; i++) M[i][i] -= l
    const ns = nullSpace(M)
    if (ns.length > 0) out.push(ns[0])
    else {
      // Try adding a small perturbation for numerical noise
      const M2 = copyMatrix(A)
      for (let i = 0; i < n; i++) M2[i][i] -= l + 1e-8
      const ns2 = nullSpace(M2)
      if (ns2.length > 0) out.push(ns2[0])
      else out.push(new Array(n).fill(0))
    }
  }
  return out
}

// ── inline registration metadata ────────────────────────────────────
export const VERBS = [
  'linalg/characteristic-poly',
  'linalg/eigenvalues',
  'linalg/eigenvalues-2x2',
  'linalg/eigenvalues-3x3',
  'linalg/eigenvectors',
  'linalg/gram-schmidt',
  'linalg/inverse',
  'linalg/is-invertible?',
  'linalg/is-orthogonal?',
  'linalg/is-symmetric?',
  'linalg/least-squares',
  'linalg/lu',
  'linalg/matrix-power',
  'linalg/null-space',
  'linalg/project',
  'linalg/qr',
  'linalg/rank',
  'linalg/solve',
  'linalg/svd',
  'linalg/trace',
  'linalg/vec-add',
]

export const LAZY = true

export const BOOK = 'book-of-math/ch15-linear-algebra'

export const TESTS = [
  ['(linalg/trace (list (list 1 2) (list 3 4)))', '5'],
  ['(linalg/rank (list (list 1 2) (list 2 4)))', '1'],
  ['(linalg/is-invertible? (list (list 1 0) (list 0 1)))', '#t'],
  ['(linalg/is-symmetric? (list (list 1 2) (list 2 3)))', '#t'],
  ['(linalg/vec-add (list 1 2 3) (list 4 5 6))', '(5 7 9)'],
  ['(linalg/eigenvalues-2x2 (list (list 2 0) (list 0 3)))', '(3 2)'],
]

export function installLinalg(env, ctx) {
  const def = (n, f, perm = 'read') => {
    const existing = env.vars.get(n)
    if (typeof existing === 'function' && !existing._sakuraStub && !existing.__lazy) return
    env.define(n, seqVerb(f), { perm })
  }

  // ── Solvers ──────────────────────────────────────────────────────

  // (linalg/solve A b) — solve A x = b for x, returning a vector.
  def('linalg/solve', (A, b) => {
    if (!isList(A) || !isList(b)) return []
    const n = rowsOf(A)
    if (n === 0 || colsOf(A) !== n) return new Sym('non-square')
    const { rows, rank } = rowReduce(A, b)
    if (rank < n) return new Sym('no-unique-solution')
    const x = new Array(n)
    for (let i = 0; i < n; i++) x[i] = rows[i][n]
    return x
  })

  // (linalg/least-squares A b) — minimize ||Ax - b||^2 via normal equations.
  def('linalg/least-squares', (A, b) => {
    if (!isList(A) || !isList(b)) return []
    const At = transpose(A)
    const AtA = matMul(At, A)
    const Atb = new Array(rowsOf(AtA)).fill(0)
    for (let i = 0; i < rowsOf(At); i++) {
      let s = 0
      for (let j = 0; j < b.length; j++) s += At[i][j] * num(b[j])
      Atb[i] = s
    }
    const inv = invert(AtA)
    if (inv === null) return new Sym('rank-deficient')
    const x = new Array(rowsOf(inv)).fill(0)
    for (let i = 0; i < rowsOf(inv); i++) {
      for (let j = 0; j < colsOf(inv); j++) x[i] += inv[i][j] * Atb[j]
    }
    return x
  })

  // (linalg/lu A) → (list L U P) with P·A = L·U, or 'not-square.
  // The sentinel name is the record's: :signature "... | 'not-square" and
  // :caveats "Returns 'not-square if M is not square". Three sites test it
  // ((eq? lu 'not-square), (equal? lu 'not-square), (eq? lu 'not-square));
  // none test the old 'lu-failed.
  def('linalg/lu', (A) => {
    const lu = luDecomp(A)
    if (lu === null) return new Sym('not-square')
    return lu
  })

  // ── Rank + inverse + predicates ─────────────────────────────────

  def('linalg/rank', (A) => rowReduce(A, null).rank)

  def('linalg/inverse', (A) => {
    const inv = invert(A)
    if (inv === null) return new Sym('singular')
    return inv
  })

  def('linalg/is-invertible?', (A) => {
    const n = rowsOf(A)
    if (n === 0 || colsOf(A) !== n) return false
    return Math.abs(determinant(A)) > 1e-12
  })

  def('linalg/is-symmetric?', (A) => {
    const n = rowsOf(A)
    if (n === 0 || colsOf(A) !== n) return false
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(num(A[i][j]) - num(A[j][i])) > 1e-9) return false
      }
    }
    return true
  })

  def('linalg/is-orthogonal?', (A) => {
    const n = rowsOf(A)
    if (n === 0 || colsOf(A) !== n) return false
    // A^T A should equal identity
    const AtA = matMul(transpose(A), A)
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const target = i === j ? 1 : 0
        if (Math.abs(AtA[i][j] - target) > 1e-9) return false
      }
    }
    return true
  })

  // ── Eigen ───────────────────────────────────────────────────────

  def('linalg/eigenvalues', (A) => eigenvalues(A))
  def('linalg/eigenvalues-2x2', (A) => eigen2x2(A))
  def('linalg/eigenvalues-3x3', (A) => eigen3x3(A))

  def('linalg/eigenvectors', (A) => {
    const evs = eigenvalues(A)
    if (evs instanceof Sym) return []
    return eigenvectorsFor(A, evs)
  })

  def('linalg/characteristic-poly', (A) => characteristicPoly(A))

  // ── Decomposition ────────────────────────────────────────────────

  def('linalg/qr', (A) => qrDecomp(A))
  def('linalg/gram-schmidt', (vectors) => gramSchmidt(vectors))
  def('linalg/null-space', (A) => nullSpace(A))

  // (linalg/svd A) — SVD via eigendecomposition of A^T A.
  // Returns the KEYED a-list ((:U U) (:Sigma singular-values) (:V V)),
  // where U and V are orthogonal and :Sigma is the list of singular
  // values (nonnegative, sorted descending).
  //
  // 38-linalg.slat never reads this result positionally. Every site that
  // reaches inside it uses assoc on a keyword:
  //   * linalg/is-orthogonal? :row-5 :cs-composition —
  //       (cadr (assoc ':U decomp)) / (cadr (assoc ':V decomp))
  //   * linalg/svd :row-2-audit :cs-program —
  //       (and (assoc ':U r) (assoc ':Sigma r) (assoc ':V r))
  //   * linalg/svd :row-4-proof —
  //       (and (assoc ':U r) (assoc ':Sigma r) (assoc ':V r))
  // 3 keyed sites, 0 positional. Reference wins. The last two evaluated to
  // #f against the old positional shape while still passing the
  // runs-without-error gate; they now evaluate to #t.
  //
  // NOTE (unresolved, see :status "needs-alfred" on the linalg/svd record):
  // that record ALSO says the verb is unimplemented and escalates
  // 'not-implemented, which this working implementation contradicts. That
  // conflict is not settled here — only the result SHAPE is.
  def('linalg/svd', (A) => {
    const keyed = (u, s, v) => [
      [new Sym(':U'), u], [new Sym(':Sigma'), s], [new Sym(':V'), v],
    ]
    if (!isList(A) || A.length === 0) return keyed([], [], [])
    const At = transpose(A)
    const AtA = matMul(At, A)
    const evs = eigenvalues(AtA)
    if (evs instanceof Sym) return new Sym('svd-failed')
    const singular = evs.map(e => Math.sqrt(Math.max(0, e))).sort((a, b) => b - a)
    // V = eigenvectors of AtA
    const V = eigenvectorsFor(AtA, evs)
    // U columns: A v_i / σ_i
    const U = []
    for (let i = 0; i < singular.length; i++) {
      if (singular[i] < 1e-12) continue
      const v = V[i] || []
      const u = new Array(rowsOf(A)).fill(0)
      for (let r = 0; r < rowsOf(A); r++) {
        for (let c = 0; c < colsOf(A); c++) u[r] += num(A[r][c]) * (v[c] || 0)
      }
      for (let r = 0; r < u.length; r++) u[r] /= singular[i]
      U.push(u)
    }
    return keyed(U, singular, V)
  })

  // ── Utility ──────────────────────────────────────────────────────

  def('linalg/trace', (A) => {
    const n = rowsOf(A)
    let s = 0
    for (let i = 0; i < n; i++) s += num(A[i][i])
    return s
  })

  def('linalg/matrix-power', (A, k) => {
    const n = rowsOf(A)
    if (n === 0 || colsOf(A) !== n) return []
    const kk = num(k) | 0
    if (kk === 0) return makeIdentity(n)
    if (kk < 0) {
      const inv = invert(A)
      if (inv === null) return new Sym('singular')
      let out = inv
      for (let i = 1; i < -kk; i++) out = matMul(out, inv)
      return out
    }
    let out = copyMatrix(A)
    for (let i = 1; i < kk; i++) out = matMul(out, A)
    return out
  })

  // (linalg/project v u) — orthogonal projection of v onto u.
  def('linalg/project', (v, u) => {
    if (!isList(v) || !isList(u)) return v
    let dot = 0, unrm = 0
    for (let i = 0; i < Math.min(v.length, u.length); i++) {
      dot += num(v[i]) * num(u[i])
      unrm += num(u[i]) * num(u[i])
    }
    if (unrm < 1e-12) return v.map(() => 0)
    const s = dot / unrm
    return u.map(x => s * num(x))
  })

  def('linalg/vec-add', (a, b) => {
    if (!isList(a) || !isList(b)) return []
    const n = Math.max(a.length, b.length)
    const out = new Array(n)
    for (let i = 0; i < n; i++) out[i] = num(a[i] || 0) + num(b[i] || 0)
    return out
  })

  def('linalg/mv', (A, v) => {
    // Matrix–vector product A·v. A is a row-major nested array (m×n), v a
    // flat n-vector; result is a flat m-vector.
    if (!isList(A) || !isList(v)) return []
    const out = new Array(A.length)
    for (let i = 0; i < A.length; i++) {
      const row = A[i]
      let s = 0
      if (isList(row)) for (let j = 0; j < row.length; j++) s += num(row[j]) * num(v[j] || 0)
      out[i] = s
    }
    return out
  })
  def('linalg/norm', (v) => {
    // Euclidean (L2) norm. Accepts a flat vector or a matrix (Frobenius).
    if (!isList(v)) return num(v) < 0 ? -num(v) : num(v)
    let s = 0
    for (const x of v) {
      if (isList(x)) { for (const y of x) s += num(y) * num(y) }
      else s += num(x) * num(x)
    }
    return Math.sqrt(s)
  })

  return env
}

export default installLinalg
