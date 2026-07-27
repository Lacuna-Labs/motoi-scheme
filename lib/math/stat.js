// stat.js — descriptive statistics: mean, median, mode, sd, variance,
// quartiles, histogram, z-score.
//
// Provenance: 2026-07-22 (Alfred completion sweep, applied-math lane).
// Reference chapter 59-stat.slat documents 18 verbs; none were wired. This
// file wires all 18 with honest math.
//
// Doctrine:
//   * Every verb is a pure function on a list of numbers. Empty list
//     handling matches the reference documentation:
//       - stat/count of () → 0
//       - stat/mean of () → 0
//       - stat/sum of () → 0
//       - min/max of () → +/-Infinity is unhelpful; return 0
//       - median/mode of () → 0
//   * Population vs sample: variance / sd use population (divide by n);
//     variance-sample / sd-sample use Bessel's correction (divide by n-1).
//   * histogram returns a list of (lo hi count) triples; histogram-counts
//     returns just the counts. Default bin count is Sturges' formula:
//     ceil(log2(n) + 1), floored at 1.
//   * quartile takes q in {0, 1, 2, 3, 4}; q=0 is min, q=4 is max, q=2 is
//     median. Uses linear interpolation.
//   * mode returns a single value if unique, a list if multi-modal, or the
//     symbol 'nan if the list is empty.

import { Sym } from '../../src/reader.js'


// ── inline registration metadata (2026-07-22) ────────────────────
// See engineering/HOW-TO-REGISTER-A-VERB.md.
export const VERBS = [
  'stat/count',
  'stat/histogram',
  'stat/histogram-counts',
  'stat/iqr',
  'stat/max',
  'stat/mean',
  'stat/median',
  'stat/min',
  'stat/mode',
  'stat/probability',
  'stat/quartile',
  'stat/range',
  'stat/sd',
  'stat/sd-sample',
  'stat/sum',
  'stat/variance',
  'stat/variance-sample',
  'stat/z-score',
]
export const LAZY = true
export const BOOK = 'book-of-craft/ch02-the-multimeter'

export const TESTS = [
  // Count
  ['(stat/count (list 1 2 3))', '3'],
  ['(stat/count (list))', '0'],
  // Sum
  ['(stat/sum (list 1 2 3 4))', '10'],
  // Mean of (2 4 6 8) = 5
  ['(stat/mean (list 2 4 6 8))', '5'],
  // Median odd length: (1 3 5) = 3
  ['(stat/median (list 1 3 5))', '3'],
  // Median even length: (1 2 3 4) = 2.5
  ['(stat/median (list 1 2 3 4))', '2.5'],
  // Min / Max
  ['(stat/min (list 5 2 8 1))', '1'],
  ['(stat/max (list 5 2 8 1))', '8'],
  // Range
  ['(stat/range (list 5 2 8 1))', '7'],
  // Mode: (1 2 2 3) → 2
  ['(stat/mode (list 1 2 2 3))', '2'],
  // Variance (population) of (2 4 4 4 5 5 7 9) = 4
  ['(stat/variance (list 2 4 4 4 5 5 7 9))', '4'],
  // Variance (sample) of same list = 32/7 ≈ 4.571
  ['(< (abs (- (stat/variance-sample (list 2 4 4 4 5 5 7 9)) 4.571428571428571)) 1e-9)', '#t'],
  // SD (population) of same list = 2
  ['(stat/sd (list 2 4 4 4 5 5 7 9))', '2'],
  // SD (sample) = sqrt(32/7) ≈ 2.138
  ['(< (abs (- (stat/sd-sample (list 2 4 4 4 5 5 7 9)) 2.138089935299395)) 1e-9)', '#t'],
  // z-score: value 5 in (1..9) mean=5 sd=~2.58 → 0
  ['(stat/z-score (list 1 2 3 4 5 6 7 8 9) 5)', '0'],
  // Probability: 3/10 = 0.3
  ['(stat/probability 3 10)', '0.3'],
  // Quartile: q=2 (median) of (1 2 3 4 5) = 3
  ['(stat/quartile (list 1 2 3 4 5) 2)', '3'],
  // IQR (q3 - q1) of (1 2 3 4 5 6 7 8 9) = 7 - 3 = 4 (linear interpolation)
  ['(stat/iqr (list 1 2 3 4 5 6 7 8 9))', '4'],
  // Histogram counts: with 2 bins on (1 2 3 4) → (2 2)
  ['(stat/histogram-counts (list 1 2 3 4) 2)', '(2 2)'],
  // Histogram (with 2 bins): three-tuples per bin
  ['(car (car (stat/histogram (list 1 2 3 4) 2)))', '1'],
]

// ── local helpers ─────────────────────────────────────────────────
function asList(xs) {
  return Array.isArray(xs) ? xs : []
}

function sum(xs) {
  let s = 0; for (const x of xs) s += x; return s
}

function meanOf(xs) {
  if (xs.length === 0) return 0
  return sum(xs) / xs.length
}

function medianOf(xs) {
  if (xs.length === 0) return 0
  const s = xs.slice().sort((a, b) => a - b)
  const mid = s.length >> 1
  if (s.length % 2 === 1) return s[mid]
  return (s[mid - 1] + s[mid]) / 2
}

function varianceOf(xs, ddof) {
  const n = xs.length
  if (n <= ddof) return 0
  const m = meanOf(xs)
  let s = 0
  for (const x of xs) s += (x - m) * (x - m)
  return s / (n - ddof)
}

export function installStat(env, fuel) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  // (stat/count data) → length of the list.
  def('stat/count', (xs) => asList(xs).length)

  // (stat/sum data) → sum.
  def('stat/sum', (xs) => sum(asList(xs)))

  // (stat/mean data) → arithmetic mean.
  def('stat/mean', (xs) => meanOf(asList(xs)))

  // (stat/median data) → median.
  def('stat/median', (xs) => medianOf(asList(xs)))

  // (stat/min data) → min (0 for empty).
  def('stat/min', (xs) => {
    const a = asList(xs)
    if (a.length === 0) return 0
    let m = a[0]
    for (const x of a) if (x < m) m = x
    return m
  })

  // (stat/max data) → max (0 for empty).
  def('stat/max', (xs) => {
    const a = asList(xs)
    if (a.length === 0) return 0
    let m = a[0]
    for (const x of a) if (x > m) m = x
    return m
  })

  // (stat/range data) → max - min.
  def('stat/range', (xs) => {
    const a = asList(xs)
    if (a.length === 0) return 0
    let mn = a[0], mx = a[0]
    for (const x of a) { if (x < mn) mn = x; if (x > mx) mx = x }
    return mx - mn
  })

  // (stat/mode data) → most common value, or list of tied values, or 'nan.
  def('stat/mode', (xs) => {
    const a = asList(xs)
    if (a.length === 0) return new Sym('nan')
    const counts = new Map()
    for (const x of a) counts.set(x, (counts.get(x) || 0) + 1)
    let maxCount = 0
    for (const c of counts.values()) if (c > maxCount) maxCount = c
    const winners = []
    for (const [v, c] of counts) if (c === maxCount) winners.push(v)
    if (winners.length === 1) return winners[0]
    // Multi-modal: return sorted list.
    return winners.sort((a, b) => a - b)
  })

  // (stat/variance data) → population variance.
  def('stat/variance', (xs) => varianceOf(asList(xs), 0))

  // (stat/variance-sample data) → sample variance (Bessel).
  def('stat/variance-sample', (xs) => varianceOf(asList(xs), 1))

  // (stat/sd data) → population standard deviation.
  def('stat/sd', (xs) => Math.sqrt(varianceOf(asList(xs), 0)))

  // (stat/sd-sample data) → sample standard deviation.
  def('stat/sd-sample', (xs) => Math.sqrt(varianceOf(asList(xs), 1)))

  // (stat/z-score data value) → (value - mean) / sd (population).
  def('stat/z-score', (xs, v) => {
    const a = asList(xs)
    const sd = Math.sqrt(varianceOf(a, 0))
    if (sd === 0) return 0
    return (v - meanOf(a)) / sd
  })

  // (stat/probability favorable total) → favorable / total.
  def('stat/probability', (fav, total) => {
    if (total === 0) return 0
    return fav / total
  })

  // (stat/quartile data q) — q in {0, 1, 2, 3, 4}. Linear interpolation.
  def('stat/quartile', (xs, q) => {
    const a = asList(xs).slice().sort((x, y) => x - y)
    if (a.length === 0) return 0
    if (q <= 0) return a[0]
    if (q >= 4) return a[a.length - 1]
    // Position: (q/4)·(n-1).
    const pos = (q / 4) * (a.length - 1)
    const lo = Math.floor(pos), hi = Math.ceil(pos)
    if (lo === hi) return a[lo]
    return a[lo] + (a[hi] - a[lo]) * (pos - lo)
  })

  // (stat/iqr data) → q3 - q1.
  def('stat/iqr', (xs) => {
    const a = asList(xs).slice().sort((x, y) => x - y)
    if (a.length === 0) return 0
    const q1pos = 0.25 * (a.length - 1)
    const q3pos = 0.75 * (a.length - 1)
    const at = (p) => {
      const lo = Math.floor(p), hi = Math.ceil(p)
      if (lo === hi) return a[lo]
      return a[lo] + (a[hi] - a[lo]) * (p - lo)
    }
    return at(q3pos) - at(q1pos)
  })

  // (stat/histogram data [num-bins]) → list of (lo hi count).
  //
  // Default bins via Sturges: ceil(log2(n) + 1), floored at 1.
  def('stat/histogram', (xs, numBinsOpt) => {
    const a = asList(xs)
    if (a.length === 0) return []
    let mn = a[0], mx = a[0]
    for (const x of a) { if (x < mn) mn = x; if (x > mx) mx = x }
    if (mn === mx) return [[mn, mx, a.length]]
    const nb = (numBinsOpt | 0) > 0
      ? (numBinsOpt | 0)
      : Math.max(1, Math.ceil(Math.log2(a.length) + 1))
    const width = (mx - mn) / nb
    const counts = new Array(nb).fill(0)
    for (const x of a) {
      let idx = Math.floor((x - mn) / width)
      if (idx >= nb) idx = nb - 1  // right edge falls in last bin
      counts[idx]++
    }
    const out = new Array(nb)
    for (let i = 0; i < nb; i++) {
      out[i] = [mn + i * width, mn + (i + 1) * width, counts[i]]
    }
    return out
  })

  // (stat/histogram-counts data [num-bins]) → just the counts.
  def('stat/histogram-counts', (xs, numBinsOpt) => {
    const a = asList(xs)
    if (a.length === 0) return []
    let mn = a[0], mx = a[0]
    for (const x of a) { if (x < mn) mn = x; if (x > mx) mx = x }
    if (mn === mx) return [a.length]
    const nb = (numBinsOpt | 0) > 0
      ? (numBinsOpt | 0)
      : Math.max(1, Math.ceil(Math.log2(a.length) + 1))
    const width = (mx - mn) / nb
    const counts = new Array(nb).fill(0)
    for (const x of a) {
      let idx = Math.floor((x - mn) / width)
      if (idx >= nb) idx = nb - 1
      counts[idx]++
    }
    return counts
  })

  return env
}

export default installStat
