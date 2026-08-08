// stat.js — descriptive statistics: mean, median, mode, sd, variance,
// quartiles, histogram, z-score.
//
// Provenance: 2026-07-22 (Alfred completion sweep, applied-math lane).
// Reference chapter 59-stat.slat documents 18 verbs; none were wired. This
// file wires all 18 with honest math.
//
// Doctrine:
//   * Every verb is a pure function on a list of numbers. Empty list
//     handling matches the reference documentation (chapter 59-stat.slat),
//     which is canonical:
//       - stat/count of () → 0 (a count of nothing really is nothing)
//       - stat/sum of () → 0 (0 is the identity of addition)
//       - every other aggregate of () → the symbol 'nan, the chapter's
//         documented "no data, no answer" sentinel — the one stat/mode has
//         returned since 2026-07-22.
//     Until 2026-08-02 they all answered 0 instead, which is a confident
//     wrong number: "the mean of no numbers is zero" is a false statement,
//     and the reference had said 'nan all along.
//   * Population vs sample: variance / sd use population (divide by n);
//     variance-sample / sd-sample use Bessel's correction (divide by n-1).
//   * histogram returns a list of (lo hi count) triples; histogram-counts
//     returns just the counts. Default bin count is Sturges' formula:
//     ceil(log2(n) + 1), floored at 1.
//   * quartile takes q in {0, 1, 2, 3, 4}; q=0 is min, q=4 is max, q=2 is
//     median. Uses linear interpolation.
//   * mode returns a single value if unique, a list if multi-modal, or the
//     symbol 'nan if the list is empty.
//   * Where a summary exists but cannot be estimated — the spread of a
//     single sample, a probability out of no outcomes — the verb returns
//     the `(escalate <reason>)` pair the reference documents and the rest
//     of the engine already uses (see lib/math/calc.js).
//   * Nothing in this file trusts its argument. A stat verb that does
//     arithmetic requires a proper list of numbers and says so when it does
//     not get one; it never folds a string into the total (JS `+` would
//     concatenate) and never treats a non-list as the empty list.

import { Sym, Pair } from '../../src/reader.js'
import { isVec, Ch } from '../base/r7rs-types.js'
import { isRational } from './exact.js'


import { isList, isListish, isNull, seqVerb } from '../base/list.js'
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
// `nan` is the chapter's documented no-data sentinel; `escalate` is the
// engine's documented "the question is well-formed but has no answer here"
// pair. Both are values a caller can test for — neither is a number that
// lies about the data.
const NAN = () => new Sym('nan')
const escalate = (reason) => [new Sym('escalate'), new Sym(reason)]

// Same wording as `_describe` in src/base.js — a learner reading
// `stat/mean: expected a list of numbers, got the string "a"` should see
// the same sentence shape the arithmetic verbs use.
function describe(x) {
  if (x === undefined || x === null) return 'nothing'
  if (typeof x === 'string') return `the string ${JSON.stringify(x)}`
  if (typeof x === 'boolean') return x ? '#t' : '#f'
  if (isNull(x)) return 'the empty list'
    if (isListish(x)) return 'a list'
  if (x instanceof Sym) return `the symbol ${x.name}`
  if (x instanceof Ch) return `the character #\\${x.value}`
  if (isVec(x)) return 'a vector'
  if (x instanceof Pair) return 'a pair'
  if (typeof x === 'function') return 'a procedure'
  if (isRational(x)) return `the number ${x.n}/${x.d}`
  if (typeof x === 'number') return `the number ${x}`
  return 'a value of another kind'
}

const isNum = (x) => typeof x === 'number' || isRational(x)
const toFloat = (x) => (isRational(x) ? Number(x.n) / Number(x.d) : x)

// A proper list — nothing more is asked of the elements. `stat/count` and
// `stat/mode` are honest on symbols and strings, so only the LIST-ness is
// checked for them. Until 2026-08-02 `asList` answered `[]` for anything at
// all, so `(stat/count 5)` was 0 and `(stat/sum (vector 1 2 3))` was 0 — a
// wrong answer for a question the caller thought had been asked.
function asList(op, xs) {
  if (!isList(xs)) {
    throw new Error(`${op}: expected a proper list, got ${describe(xs)}`)
  }
  return xs
}

// A proper list of numbers, handed back as plain doubles. Exact rationals
// are accepted and floated: `(stat/sum (list 1/2 1/2))` used to fold a
// Rational OBJECT through JS `+` and answer the STRING
// "0[object Object][object Object]".
function asNums(op, xs) {
  if (!isList(xs)) {
    throw new Error(`${op}: expected a list of numbers, got ${describe(xs)}`)
  }
  const out = new Array(xs.length)
  for (let i = 0; i < xs.length; i++) {
    if (!isNum(xs[i])) {
      throw new Error(`${op}: expected a list of numbers, got ${describe(xs[i])} in the list`)
    }
    out[i] = toFloat(xs[i])
  }
  return out
}

function ckNum(op, x, what) {
  if (!isNum(x)) throw new Error(`${op}: expected ${what}, got ${describe(x)}`)
  return toFloat(x)
}

function sum(xs) {
  let s = 0; for (const x of xs) s += x; return s
}

function meanOf(xs) {
  if (xs.length === 0) return NAN()
  return sum(xs) / xs.length
}

function medianOf(xs) {
  if (xs.length === 0) return NAN()
  const s = xs.slice().sort((a, b) => a - b)
  const mid = s.length >> 1
  if (s.length % 2 === 1) return s[mid]
  return (s[mid - 1] + s[mid]) / 2
}

// () → 'nan (no data at all). Fewer points than the estimator needs →
// (escalate no-spread): one observation cannot witness a spread, and 0 is
// not "no spread", it is a claim that the data never varies.
function varianceOf(xs, ddof) {
  const n = xs.length
  if (n === 0) return NAN()
  if (n <= ddof) return escalate('no-spread')
  const m = meanOf(xs)
  let s = 0
  for (const x of xs) s += (x - m) * (x - m)
  return s / (n - ddof)
}

// sqrt of a variance, passing any sentinel straight through.
const sqrtOf = (v) => (typeof v === 'number' ? Math.sqrt(v) : v)

// The bin count, when one is given. `(numBins | 0)` used to swallow every
// bad value — 0, -3 and 2.5 all fell through to the Sturges default, so a
// caller who asked for no bins was handed four and never told. A bin count
// is a count of buckets; there is no drawing a histogram in nought of them.
function binsOf(op, numBinsOpt, n) {
  if (numBinsOpt === undefined || numBinsOpt === null) {
    return Math.max(1, Math.ceil(Math.log2(n) + 1))   // Sturges
  }
  const nb = ckNum(op, numBinsOpt, 'a positive whole number of bins')
  if (!Number.isInteger(nb) || nb < 1) {
    throw new Error(`${op}: expected a positive whole number of bins, got ${describe(numBinsOpt)}`)
  }
  return nb
}

export function installStat(env, fuel) {
  const def = (n, f, perm = 'read') => env.define(n, seqVerb(f), { perm })

  // (stat/count data) → length of the list. Counts anything, numbers or
  // not; only the list-ness is required.
  def('stat/count', (xs) => asList('stat/count', xs).length)

  // (stat/sum data) → sum. The empty sum is 0 — the identity of addition.
  def('stat/sum', (xs) => sum(asNums('stat/sum', xs)))

  // (stat/mean data) → arithmetic mean ('nan for empty).
  def('stat/mean', (xs) => meanOf(asNums('stat/mean', xs)))

  // (stat/median data) → median ('nan for empty).
  def('stat/median', (xs) => medianOf(asNums('stat/median', xs)))

  // (stat/min data) → min ('nan for empty).
  def('stat/min', (xs) => {
    const a = asNums('stat/min', xs)
    if (a.length === 0) return NAN()
    let m = a[0]
    for (const x of a) if (x < m) m = x
    return m
  })

  // (stat/max data) → max ('nan for empty).
  def('stat/max', (xs) => {
    const a = asNums('stat/max', xs)
    if (a.length === 0) return NAN()
    let m = a[0]
    for (const x of a) if (x > m) m = x
    return m
  })

  // (stat/range data) → max - min ('nan for empty).
  def('stat/range', (xs) => {
    const a = asNums('stat/range', xs)
    if (a.length === 0) return NAN()
    let mn = a[0], mx = a[0]
    for (const x of a) { if (x < mn) mn = x; if (x > mx) mx = x }
    return mx - mn
  })

  // (stat/mode data) → most common value, or list of tied values, or 'nan.
  // Mode is a frequency count, so it is honest on symbols and strings too.
  def('stat/mode', (xs) => {
    const a = asList('stat/mode', xs)
    if (a.length === 0) return NAN()
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
  def('stat/variance', (xs) => varianceOf(asNums('stat/variance', xs), 0))

  // (stat/variance-sample data) → sample variance (Bessel).
  def('stat/variance-sample', (xs) => varianceOf(asNums('stat/variance-sample', xs), 1))

  // (stat/sd data) → population standard deviation.
  def('stat/sd', (xs) => sqrtOf(varianceOf(asNums('stat/sd', xs), 0)))

  // (stat/sd-sample data) → sample standard deviation.
  def('stat/sd-sample', (xs) => sqrtOf(varianceOf(asNums('stat/sd-sample', xs), 1)))

  // (stat/z-score data value) → (value - mean) / sd (population).
  //
  // A zero sd means every observation is identical, so no value has a
  // position relative to the spread. That used to answer 0 — "this value is
  // exactly average" — which is a confident claim about a question with no
  // answer; the reference has always said it escalates 'no-spread.
  def('stat/z-score', (xs, v) => {
    const a = asNums('stat/z-score', xs)
    const val = ckNum('stat/z-score', v, 'a number to score')
    if (a.length === 0) return NAN()
    const sd = Math.sqrt(varianceOf(a, 0))
    if (sd === 0) return escalate('no-spread')
    return (val - meanOf(a)) / sd
  })

  // (stat/probability favorable total) → favorable / total.
  //
  // No outcomes means no probability. Answering 0 said "this never happens",
  // which is a statement about an experiment that was never run.
  def('stat/probability', (fav, total) => {
    const f = ckNum('stat/probability', fav, 'a number of favourable outcomes')
    const t = ckNum('stat/probability', total, 'a number of total outcomes')
    if (t <= 0) return escalate('no-outcomes')
    return f / t
  })

  // (stat/quartile data q) — q in {0, 1, 2, 3, 4}. Linear interpolation.
  def('stat/quartile', (xs, q) => {
    const a = asNums('stat/quartile', xs).slice().sort((x, y) => x - y)
    const qq = ckNum('stat/quartile', q, 'a quartile between 0 and 4')
    // The guard says "between 0 and 4" and then used to CLAMP instead of
    // enforcing it, so (stat/quartile data 9) quietly answered the maximum —
    // a real number, in range, indistinguishable from a correct quartile.
    if (qq < 0 || qq > 4) {
      throw new Error(`stat/quartile: expected a quartile between 0 and 4, got ${qq}`)
    }
    if (a.length === 0) return NAN()
    if (qq === 0) return a[0]
    if (qq === 4) return a[a.length - 1]
    // Position: (q/4)·(n-1).
    const pos = (qq / 4) * (a.length - 1)
    const lo = Math.floor(pos), hi = Math.ceil(pos)
    if (lo === hi) return a[lo]
    return a[lo] + (a[hi] - a[lo]) * (pos - lo)
  })

  // (stat/iqr data) → q3 - q1 ('nan for empty).
  def('stat/iqr', (xs) => {
    const a = asNums('stat/iqr', xs).slice().sort((x, y) => x - y)
    if (a.length === 0) return NAN()
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
    const a = asNums('stat/histogram', xs)
    if (a.length === 0) return NAN()
    let mn = a[0], mx = a[0]
    for (const x of a) { if (x < mn) mn = x; if (x > mx) mx = x }
    if (mn === mx) return [[mn, mx, a.length]]
    const nb = binsOf('stat/histogram', numBinsOpt, a.length)
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
    const a = asNums('stat/histogram-counts', xs)
    if (a.length === 0) return NAN()
    let mn = a[0], mx = a[0]
    for (const x of a) { if (x < mn) mn = x; if (x > mx) mx = x }
    if (mn === mx) return [a.length]
    const nb = binsOf('stat/histogram-counts', numBinsOpt, a.length)
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
