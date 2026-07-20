// matrix.js — small honest matrix verbs for Book of ML.
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
    return asMatrix(a)
  })

  def('matrix/rows', (m) => rowsOf(m))
  def('matrix/cols', (m) => colsOf(m))

  def('matrix/ref', (m, r, c) => (m[r | 0][c | 0]))
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

  def('matrix/scale', (m, k) => m.map((row) => row.map((x) => x * k)))

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

  return env
}

export default installMatrix
