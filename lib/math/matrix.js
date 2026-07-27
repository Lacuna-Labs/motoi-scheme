// matrix.js — small honest matrix verbs for Book of ML.

import { Sym as _Sym } from '../../src/reader.js'

//
// Provenance: 2026-07-19 (Marcus, IDE Wave 2). Ada's Book of ML
// chapter 3 introduces matrices as lists-of-lists and reaches for
// `matrix/make`, `matrix/rows`, `matrix/cols`, `matrix/multiply`,
// `matrix/transpose`, and `matrix/identity`. Every capstone from
// chapter 3 onwards depends on this family. Not adding it was one
// of the runtime papercuts blocking capstone runs.
//
// Doctrine:
//   * A matrix is a list of rows; each row is a list of numbers.
//     Nothing new — the reader already treats it as a nested list.
//     `matrix/make` mostly serves as a marker + numeric coercion pass.
//   * Every verb here is pure. No side effects, no state.
//   * All verbs cost O(rows × cols) at worst — small models train on
//     these; a full transformer inference is dozens of matmuls but
//     the numbers stay tractable at Motoi kid-scale (< 1000 rows).
//   * Kid-friendly names: `matrix/rows`, `matrix/cols`, `matrix/ref`.
//
// Verbs installed:
//   (matrix/make lists)          → validated list-of-rows
//   (matrix/rows m)              → row count
//   (matrix/cols m)              → column count
//   (matrix/ref m r c)           → element at (r, c)
//   (matrix/row m r)             → r-th row as a vector
//   (matrix/col m c)             → c-th column as a vector
//   (matrix/transpose m)         → transposed matrix
//   (matrix/multiply a b)        → matrix product
//   (matrix/matvec m v)          → matrix-vector product
//   (matrix/identity n)          → n×n identity
//   (matrix/zero rows cols)      → all-zero matrix
//   (matrix/scale m k)           → every element × k
//   (matrix/add a b)             → element-wise add
//   (matrix/sub a b)             → element-wise subtract

function asMatrix(m) {
  if (!Array.isArray(m)) throw new Error('matrix: expected list of rows, got ' + typeof m)
  const rows = m.length
  if (rows === 0) return []
  const cols = Array.isArray(m[0]) ? m[0].length : 0
  const out = new Array(rows)
  for (let i = 0; i < rows; i++) {
    const row = m[i]
    if (!Array.isArray(row)) throw new Error('matrix: row ' + i + ' is not a list')
    if (row.length !== cols) throw new Error('matrix: ragged row ' + i +
      ` (expected ${cols}, got ${row.length})`)
    out[i] = row.map((x) => +x)
  }
  return out
}

function rowsOf(m) { return Array.isArray(m) ? m.length : 0 }
function colsOf(m) {
  if (!Array.isArray(m) || m.length === 0) return 0
  return Array.isArray(m[0]) ? m[0].length : 0
}

// ── inline registration metadata (2026-07-22) ────────────────────
// See engineering/HOW-TO-REGISTER-A-VERB.md.
export const VERBS = [
  "matrix/*",
  "matrix/+",
  "matrix/-",
  "matrix/->string",
  "matrix/=",
  "matrix/add",
  "matrix/col",
  "matrix/cols",
  "matrix/determinant",
  "matrix/get",
  "matrix/identity",
  "matrix/make",
  "matrix/matvec",
  "matrix/multiply",
  "matrix/ref",
  "matrix/row",
  "matrix/rows",
  "matrix/scale",
  "matrix/sub",
  "matrix/transpose",
  "matrix/zero",
]
export const LAZY = true

export function installMatrix(env, fuel) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  // (matrix/make list-of-rows) — validate + coerce.
  //
  // Passing anything else: two args (rows cols) OR (rows cols init) still
  // supported for backward-compat with earlier drafts. If two numeric
  // args are given, they create a rows×cols zero matrix.
  def('matrix/make', (a, b, init) => {
    if (typeof a === 'number' && typeof b === 'number') {
      const rows = a | 0, cols = b | 0
      const fill = typeof init === 'number' ? init : 0
      const out = new Array(rows)
      for (let i = 0; i < rows; i++) out[i] = new Array(cols).fill(fill)
      return out
    }
    // Ragged input returns the symbol 'ragged (per reference contract:
    // "-> matrix | 'ragged"), never a thrown error.
    if (Array.isArray(a)) {
      const cols = Array.isArray(a[0]) ? a[0].length : 0
      for (const row of a) {
        if (!Array.isArray(row) || row.length !== cols) return new _Sym('ragged')
      }
    }
    return asMatrix(a)
  })

  def('matrix/rows', (m) => rowsOf(m))
  def('matrix/cols', (m) => colsOf(m))

  // Out-of-range indices return the symbol 'nan (per reference contract:
  // "-> number | 'nan"), never a thrown error.
  def('matrix/ref', (m, r, c) => {
    const row = Array.isArray(m) ? m[r | 0] : undefined
    if (!Array.isArray(row)) return new _Sym('nan')
    const val = row[c | 0]
    return val === undefined ? new _Sym('nan') : val
  })
  def('matrix/row', (m, r) => (m[r | 0]).slice())
  def('matrix/col', (m, c) => m.map((row) => row[c | 0]))

  def('matrix/transpose', (m) => {
    const rows = rowsOf(m), cols = colsOf(m)
    const out = new Array(cols)
    for (let j = 0; j < cols; j++) {
      out[j] = new Array(rows)
      for (let i = 0; i < rows; i++) out[j][i] = m[i][j]
    }
    return out
  })

  def('matrix/identity', (n) => {
    const size = n | 0
    const out = new Array(size)
    for (let i = 0; i < size; i++) {
      out[i] = new Array(size).fill(0)
      out[i][i] = 1
    }
    return out
  })

  def('matrix/zero', (r, c) => {
    const rows = r | 0, cols = c | 0
    const out = new Array(rows)
    for (let i = 0; i < rows; i++) out[i] = new Array(cols).fill(0)
    return out
  })

  // Order-agnostic: the matrix is whichever arg is a 2-D array, the scalar
  // is the number. Reference programs call it both ways (`(matrix/scale A k)`
  // and `(matrix/scale k A)`); a matrix and a scalar are unambiguous by type.
  def('matrix/scale', (m, k) => {
    if (!Array.isArray(m) && Array.isArray(k)) { const t = m; m = k; k = t }
    return m.map((row) => row.map((x) => x * k))
  })

  def('matrix/add', (a, b) => {
    const rows = rowsOf(a), cols = colsOf(a)
    if (rowsOf(b) !== rows || colsOf(b) !== cols) throw new Error('matrix/add: shape mismatch')
    const out = new Array(rows)
    for (let i = 0; i < rows; i++) {
      out[i] = new Array(cols)
      for (let j = 0; j < cols; j++) out[i][j] = a[i][j] + b[i][j]
    }
    return out
  })

  def('matrix/sub', (a, b) => {
    const rows = rowsOf(a), cols = colsOf(a)
    if (rowsOf(b) !== rows || colsOf(b) !== cols) throw new Error('matrix/sub: shape mismatch')
    const out = new Array(rows)
    for (let i = 0; i < rows; i++) {
      out[i] = new Array(cols)
      for (let j = 0; j < cols; j++) out[i][j] = a[i][j] - b[i][j]
    }
    return out
  })

  // (matrix/multiply A B) — standard matrix product; A is m×k, B is k×n
  // → result is m×n. Names deliberately mirror numpy: A @ B.
  def('matrix/multiply', (a, b) => {
    const m = rowsOf(a), k = colsOf(a)
    const kB = rowsOf(b), n = colsOf(b)
    if (k !== kB) throw new Error(`matrix/multiply: shape mismatch (A is ${m}×${k}, B is ${kB}×${n})`)
    const out = new Array(m)
    for (let i = 0; i < m; i++) {
      out[i] = new Array(n).fill(0)
      for (let j = 0; j < n; j++) {
        let s = 0
        for (let t = 0; t < k; t++) s += a[i][t] * b[t][j]
        out[i][j] = s
      }
    }
    return out
  })

  // (matrix/matvec M v) — treat M as m×n, v as length-n vector, return
  // a length-m vector. This is the shape used in every layer forward
  // pass in Book of ML.
  def('matrix/matvec', (m, v) => {
    const rows = rowsOf(m), cols = colsOf(m)
    if (!Array.isArray(v)) throw new Error('matrix/matvec: v must be a list')
    if (v.length !== cols) throw new Error(`matrix/matvec: shape mismatch (M is ${rows}×${cols}, v is ${v.length})`)
    const out = new Array(rows)
    for (let i = 0; i < rows; i++) {
      let s = 0
      for (let j = 0; j < cols; j++) s += m[i][j] * v[j]
      out[i] = s
    }
    return out
  })

  // ── Operator aliases (2026-07-22) ──────────────────────────────────
  // Ergonomic short names mirroring vec/+, vec/-, vec/*. Alfred's convention
  // for arithmetic: the / character separates namespace from operator.

  // (matrix/+ A B) — element-wise sum. Alias for matrix/add.
  def('matrix/+', (a, b) => env.get('matrix/add')(a, b))

  // (matrix/- A B) — element-wise difference. Alias for matrix/sub.
  def('matrix/-', (a, b) => env.get('matrix/sub')(a, b))

  // (matrix/* A B) — linear-map composition. Alias for matrix/multiply.
  def('matrix/*', (a, b) => env.get('matrix/multiply')(a, b))

  // (matrix/= A B) — cell-wise equality; returns boolean. Same-shape only.
  def('matrix/=', (a, b) => {
    const rA = rowsOf(a), cA = colsOf(a)
    const rB = rowsOf(b), cB = colsOf(b)
    if (rA !== rB || cA !== cB) return false
    for (let i = 0; i < rA; i++) {
      for (let j = 0; j < cA; j++) {
        if (a[i][j] !== b[i][j]) return false
      }
    }
    return true
  })

  // (matrix/->string M) — canonical rendered form. '((r1)(r2)...)' with
  // each row a space-separated list of numbers, no trailing newline.
  def('matrix/->string', (m) => {
    if (!Array.isArray(m) || m.length === 0) return '()'
    const rowStr = (r) => '(' + r.map((x) => String(x)).join(' ') + ')'
    return '(' + m.map(rowStr).join('') + ')'
  })

  // (matrix/get M r c) — element accessor with OOB default 0. Kid-friendly
  // sibling to matrix/ref; ref throws on OOB, get returns 0.
  def('matrix/get', (m, r, c) => {
    if (!Array.isArray(m)) return 0
    const ri = r | 0, ci = c | 0
    if (ri < 0 || ri >= m.length) return 0
    const row = m[ri]
    if (!Array.isArray(row) || ci < 0 || ci >= row.length) return 0
    return row[ci]
  })

  // (matrix/determinant M) — scalar determinant via cofactor expansion for
  // small n (≤4); LU-style row reduction otherwise. Returns 'not-square
  // on non-square input.
  def('matrix/determinant', (m) => {
    const n = rowsOf(m)
    if (n !== colsOf(m)) return new _Sym('not-square')
    if (n === 0) return 1
    if (n === 1) return m[0][0]
    if (n === 2) return m[0][0] * m[1][1] - m[0][1] * m[1][0]
    if (n === 3) {
      const [a, b, c] = m[0]
      const [d, e, f] = m[1]
      const [g, h, i] = m[2]
      return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g)
    }
    // General: LU with partial pivot, det = product of pivots × sign.
    const A = m.map((r) => r.slice())
    let sign = 1
    for (let col = 0; col < n; col++) {
      let pivot = col
      let bestVal = Math.abs(A[col][col])
      for (let r = col + 1; r < n; r++) {
        const v = Math.abs(A[r][col])
        if (v > bestVal) { bestVal = v; pivot = r }
      }
      if (bestVal < 1e-14) return 0
      if (pivot !== col) { const t = A[col]; A[col] = A[pivot]; A[pivot] = t; sign = -sign }
      for (let r = col + 1; r < n; r++) {
        const factor = A[r][col] / A[col][col]
        for (let j = col; j < n; j++) A[r][j] -= factor * A[col][j]
      }
    }
    let det = sign
    for (let i = 0; i < n; i++) det *= A[i][i]
    return det
  })

  return env
}

export default installMatrix
