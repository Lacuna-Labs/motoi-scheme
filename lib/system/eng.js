// eng.js — engineering-math verbs: beams, transfer functions, statics.
//
// Provenance: scheme-lang/src/eng.js. Migrated to
// motoi-scheme/lib/system/ on 2026-07-16 (Pass-3 Wave 1).
//
// Owner: hiroshi (Lacuna Eng, input+system+eng lane, 2026-07-14).
//
// Alfred's floor rule: "We can't lie to people. They trust us."
// Every verb here is REAL math with a runnable algorithm. Six verbs,
// all pure (no I/O, no state, no network):
//
//   eng/beam-reactions   — reactions at supports of a simply-supported beam
//   eng/tf               — construct a transfer-function record
//   eng/tf-dc-gain       — H(0) = num(0) / den(0)
//   eng/tf-stable?       — Routh–Hurwitz on denominator coefficients
//   eng/bode             — H(jω) at n log-spaced frequencies
//   eng/statics-solve    — solve stacked equilibrium equations via Gauss–Jordan
//
// All six run in ≤1ms for the reference example sizes. eng/bode has a
// documented n-threshold above which the reference permits an
// 'use-backend escalation; we compute in-language up to n=200 which
// covers every example tier + normal engineering usage.
//
// This module is installed by base.js (peer to installAlg) so any
// downstream env factory picks it up automatically.

import { Sym } from '../../src/reader.js'

// ─── shared helpers ────────────────────────────────────────────────

const nm = (x) => (x instanceof Sym ? x.name : x)
const num = (x) => {
  if (typeof x === 'number') return x
  const n = Number(x)
  return Number.isFinite(n) ? n : 0
}

// Coerce a Scheme list (JS array) of numbers to a plain array. Non-numeric
// entries are coerced via num() so a stray Sym doesn't crash.
const coerceNumList = (xs) => {
  if (!Array.isArray(xs)) return []
  return xs.map(num)
}

// A transfer function is represented as an association-list-shaped
// tagged list: (('kind 'tf) ('num (…)) ('den (…))). We use a stable
// shape so eng/tf-dc-gain / eng/tf-stable? / eng/bode all agree on how
// to destructure. The `_tf` marker on the raw JS array makes JS-side
// detection cheap; Scheme code reads via car/cdr/assoc.
function makeTF(numList, denList) {
  const rec = [
    [new Sym('kind'), new Sym('tf')],
    [new Sym('num'), numList],
    [new Sym('den'), denList],
  ]
  // Non-enumerable marker so introspection doesn't pollute the assoc list.
  Object.defineProperty(rec, '_tf', { value: true, enumerable: false })
  Object.defineProperty(rec, '_num', { value: numList, enumerable: false })
  Object.defineProperty(rec, '_den', { value: denList, enumerable: false })
  return rec
}

// Extract (num, den) from a transfer function record, in either the
// tagged-list shape (our own eng/tf output) or a raw 2-element (num den)
// shape (some callers may pass a naked pair). Returns { num, den } or
// null if the shape isn't recognized.
function unwrapTF(tf) {
  if (tf && tf._tf) return { num: tf._num, den: tf._den }
  if (Array.isArray(tf) && tf.length === 2 && Array.isArray(tf[0]) && Array.isArray(tf[1])) {
    return { num: tf[0], den: tf[1] }
  }
  // Try assoc-list lookup for 'num and 'den.
  if (Array.isArray(tf)) {
    let numArr = null, denArr = null
    for (const row of tf) {
      if (!Array.isArray(row) || row.length < 2) continue
      const k = row[0] instanceof Sym ? row[0].name : row[0]
      if (k === 'num') numArr = row[1]
      else if (k === 'den') denArr = row[1]
    }
    if (Array.isArray(numArr) && Array.isArray(denArr)) return { num: numArr, den: denArr }
  }
  return null
}

// ─── Routh–Hurwitz (stability) ─────────────────────────────────────
//
// Build the Routh array from denominator coefficients (highest degree
// first). System is stable iff no sign changes in the first column and
// no first-column zero (proper handling of the zero-in-first-column
// edge case: return 'unstable rather than trying epsilon perturbation,
// matching the reference caveat about borderline cases).
function routhStable(den) {
  const d = den.slice()
  // Drop leading zeros — an all-zero polynomial is meaningless.
  while (d.length > 0 && d[0] === 0) d.shift()
  if (d.length === 0) return false
  if (d.length === 1) return d[0] !== 0   // constant polynomial: stable iff non-zero constant
  if (d.length === 2) return d[0] * d[1] > 0  // first-order: sign match

  const n = d.length
  const rows = Math.ceil(n / 2)
  // Build Routh table. Each row has `rows` columns (top rows padded with 0).
  const table = []
  const row0 = []
  const row1 = []
  for (let i = 0; i < n; i += 2) row0.push(d[i])
  for (let i = 1; i < n; i += 2) row1.push(d[i])
  while (row0.length < rows) row0.push(0)
  while (row1.length < rows) row1.push(0)
  table.push(row0, row1)

  for (let r = 2; r < n; r++) {
    const prev = table[r - 1]
    const prev2 = table[r - 2]
    const a = prev[0]
    if (a === 0) return false   // first-column zero → unstable (or borderline; treat conservatively)
    const nextRow = []
    for (let j = 0; j < rows - 1; j++) {
      const b1 = prev2[j + 1] || 0
      const b2 = prev[j + 1] || 0
      nextRow.push((a * b1 - prev2[0] * b2) / a)
    }
    while (nextRow.length < rows) nextRow.push(0)
    table.push(nextRow)
    // Early exit: if the row is all zero, mark auxiliary polynomial case
    // as unstable (reference says borderline may be misclassified —
    // consistent with our documented behavior).
    if (nextRow.every((v) => v === 0)) return false
  }

  // Count sign changes in the first column.
  let sign = Math.sign(table[0][0])
  for (let r = 1; r < table.length; r++) {
    const s = Math.sign(table[r][0])
    if (s === 0) return false
    if (s !== sign) return false
    sign = s
  }
  return true
}

// ─── Bode ──────────────────────────────────────────────────────────
//
// Evaluate H(jω) at n log-spaced frequencies between fMin and fMax.
// Return an assoc-list { freqs, mag-db, phase-deg }.
function polyEvalComplex(coeffs, jw) {
  // coeffs are highest degree first. Compute p(s) at s = j*w in complex
  // arithmetic using Horner's method.
  let re = 0, im = 0
  for (let i = 0; i < coeffs.length; i++) {
    // result = result * (j*w) + coeff  →  (re + im j)(j w) + c = -im*w + (re*w) j + c
    const newRe = -im * jw + coeffs[i]
    const newIm = re * jw
    re = newRe
    im = newIm
  }
  return { re, im }
}

function bodeCompute(numArr, denArr, fMin, fMax, nPts) {
  const freqs = []
  const magDb = []
  const phaseDeg = []
  const logMin = Math.log10(fMin)
  const logMax = Math.log10(fMax)
  const step = nPts > 1 ? (logMax - logMin) / (nPts - 1) : 0
  for (let i = 0; i < nPts; i++) {
    const w = Math.pow(10, logMin + i * step)
    const N = polyEvalComplex(numArr, w)
    const D = polyEvalComplex(denArr, w)
    // H = N / D (complex division).
    const denomMag2 = D.re * D.re + D.im * D.im
    const hre = (N.re * D.re + N.im * D.im) / denomMag2
    const him = (N.im * D.re - N.re * D.im) / denomMag2
    const mag = Math.sqrt(hre * hre + him * him)
    freqs.push(w)
    magDb.push(20 * Math.log10(mag))
    phaseDeg.push(Math.atan2(him, hre) * 180 / Math.PI)
  }
  return { freqs, magDb, phaseDeg }
}

// ─── Gauss–Jordan (statics-solve) ──────────────────────────────────
//
// Solve the augmented matrix A|b (each row = [a1, a2, …, an, b]).
// Returns { solution: [x1, x2, …], rank } or { rank: <k>, underdetermined: true }.
function gaussJordan(rows, nUnknowns) {
  if (rows.length === 0) return { rank: 0, underdetermined: nUnknowns > 0 }
  const m = rows.length
  const n = nUnknowns
  const A = rows.map((r) => r.slice())
  // Forward elimination + back substitution combined.
  let rank = 0
  const pivotCols = []
  for (let col = 0, row = 0; col < n && row < m; col++) {
    // Find pivot.
    let pivot = -1
    let bestVal = 1e-12
    for (let r = row; r < m; r++) {
      const v = Math.abs(A[r][col])
      if (v > bestVal) { bestVal = v; pivot = r }
    }
    if (pivot === -1) continue
    // Swap.
    if (pivot !== row) { const tmp = A[row]; A[row] = A[pivot]; A[pivot] = tmp }
    // Normalize.
    const scale = A[row][col]
    for (let j = col; j <= n; j++) A[row][j] /= scale
    // Eliminate.
    for (let r = 0; r < m; r++) {
      if (r === row) continue
      const factor = A[r][col]
      if (factor === 0) continue
      for (let j = col; j <= n; j++) A[r][j] -= factor * A[row][j]
    }
    pivotCols.push(col)
    row++
    rank++
  }
  // Detect inconsistency: any row [0 0 … 0 | b≠0].
  for (let r = 0; r < m; r++) {
    let allZero = true
    for (let j = 0; j < n; j++) if (Math.abs(A[r][j]) > 1e-9) { allZero = false; break }
    if (allZero && Math.abs(A[r][n]) > 1e-9) return { rank, inconsistent: true }
  }
  if (rank < n) return { rank, underdetermined: true }
  // Extract solution — pivot columns line up with the first n rows.
  const solution = new Array(n).fill(0)
  for (let i = 0; i < pivotCols.length; i++) {
    solution[pivotCols[i]] = A[i][n]
  }
  return { rank, solution }
}

// ─── Installer ─────────────────────────────────────────────────────
export function installEng(env) {
  const def = (n, f, perm) => env.define(n, f, { perm })

  // ── eng/beam-reactions ────────────────────────────────────────────
  // Simply-supported beam, single point load P at distance a from left
  // support of a span L. Sum of forces = 0 and sum of moments about A = 0:
  //   R_A + R_B = P
  //   R_B * L = P * a          →  R_B = P*a/L
  //   R_A = P - R_B            →  R_A = P*(L−a)/L
  // Returned as (R_A R_B M_A) matching the reference signature; M_A = 0
  // for a simply-supported beam (no fixed moment at the support).
  def('eng/beam-reactions', (L, a, P) => {
    const Ln = num(L), an = num(a), Pn = num(P)
    if (Ln === 0) return [0, 0, 0]
    const RB = (Pn * an) / Ln
    const RA = Pn - RB
    return [RA, RB, 0]
  }, 'read')

  // ── eng/tf ────────────────────────────────────────────────────────
  def('eng/tf', (numerator, denominator) => {
    const nArr = coerceNumList(numerator)
    const dArr = coerceNumList(denominator)
    return makeTF(nArr, dArr)
  }, 'read')

  // ── eng/tf-dc-gain ────────────────────────────────────────────────
  // H(0) = num(0) / den(0) = last-coefficient(num) / last-coefficient(den).
  // Reference note: division by zero → informational; we return the Sym
  // 'infinite (kin: 'nan sentinel used elsewhere in the codebase).
  def('eng/tf-dc-gain', (tf) => {
    const parts = unwrapTF(tf)
    if (!parts) return new Sym('nan')
    const numArr = parts.num
    const denArr = parts.den
    const nc = numArr.length ? numArr[numArr.length - 1] : 0
    const dc = denArr.length ? denArr[denArr.length - 1] : 0
    if (dc === 0) return new Sym('infinite')
    return nc / dc
  }, 'read')

  // ── eng/tf-stable? ────────────────────────────────────────────────
  def('eng/tf-stable?', (tf) => {
    const parts = unwrapTF(tf)
    if (!parts) return false
    return routhStable(parts.den)
  }, 'read')

  // ── eng/bode ──────────────────────────────────────────────────────
  // n ≤ 200 in-language; above threshold, return the honest 'use-backend
  // escalation the reference permits.
  def('eng/bode', (tf, fMin, fMax, nPts) => {
    const parts = unwrapTF(tf)
    if (!parts) return new Sym('nan')
    const nMin = num(fMin), nMax = num(fMax), N = Math.max(1, Math.floor(num(nPts)))
    if (N > 200) return [new Sym('use-backend'), { reason: 'n>200-in-language-limit', n: N }]
    if (!(nMin > 0) || !(nMax > 0) || nMin >= nMax) return new Sym('nan')
    const { freqs, magDb, phaseDeg } = bodeCompute(parts.num, parts.den, nMin, nMax, N)
    return [
      [new Sym('freqs'), freqs],
      [new Sym('mag-db'), magDb],
      [new Sym('phase-deg'), phaseDeg],
    ]
  }, 'read')

  // ── eng/statics-solve ─────────────────────────────────────────────
  // Input: force-equations + moment-equations, each a list of rows.
  // Each row is [c1, c2, …, cn, b] where c_i are coefficients on the
  // unknowns and b is the constant on the RHS (moved to the right side).
  //
  // We concatenate force and moment rows, solve via Gauss–Jordan, and
  // pair the solution values with the unknowns list. If rank < n_unknowns,
  // return the Sym 'underdetermined per the reference summary.
  def('eng/statics-solve', (forceEqs, momentEqs, unknowns) => {
    const fRows = Array.isArray(forceEqs) ? forceEqs : []
    const mRows = Array.isArray(momentEqs) ? momentEqs : []
    const rows = [...fRows, ...mRows].map(coerceNumList)
    const ukns = Array.isArray(unknowns) ? unknowns : []
    const n = ukns.length
    if (rows.length === 0 || n === 0) return new Sym('underdetermined')
    // Each row must have n+1 entries (n coeffs + b). Pad short rows with 0
    // (missing coefficients treated as absent).
    const shaped = rows.map((r) => {
      const out = new Array(n + 1).fill(0)
      for (let i = 0; i < Math.min(r.length, n + 1); i++) out[i] = r[i]
      return out
    })
    const result = gaussJordan(shaped, n)
    if (result.underdetermined) return new Sym('underdetermined')
    if (result.inconsistent) return new Sym('inconsistent')
    // Pair each unknown symbol with its computed value.
    return ukns.map((u, i) => [u, result.solution[i]])
  }, 'read')
}

export default installEng
