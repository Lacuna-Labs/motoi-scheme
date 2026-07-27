// seq.js — sequences and series: arithmetic, geometric, Fibonacci, Lucas,
// recurrence, sigma (sum), product, nth-term detection.
//
// Provenance: 2026-07-22 (Alfred completion sweep, applied-math lane).
// Reference chapter 56-seq.slat documents 12 verbs; none were wired.
//
// Doctrine:
//   * Every verb is pure. Fibonacci uses fast doubling; general recurrence
//     uses tail-recursion in a JS loop.
//   * seq/sigma and seq/product take a JS closure `f` and evaluate on the
//     integer range [lo, hi] inclusive. Motoi lambdas ARE JS functions here
//     (see interp.js applyStep — typeof fn === 'function' path); calling
//     `f(i)` from JS just works.
//   * seq/nth-term is a small pattern-detector: given (a1 a2 a3 ...) it
//     checks whether the sequence is arithmetic (constant difference) or
//     geometric (constant ratio) and returns a tagged descriptor. If
//     neither pattern fits, returns 'unknown.
//   * seq/recurrence takes (coeffs init n): a linear recurrence
//     a_i = c1·a_{i-1} + c2·a_{i-2} + ... + ck·a_{i-k}, seeded by `init`
//     (length k), advanced to term n (0-indexed). Small kids can build
//     Fibonacci as `(seq/recurrence '(1 1) '(0 1) 10)`.

import { Sym } from '../../src/reader.js'
import { apply } from '../../src/interp.js'


// ── inline registration metadata (2026-07-22) ────────────────────
// See engineering/HOW-TO-REGISTER-A-VERB.md.
export const VERBS = [
  'seq/arithmetic',
  'seq/arithmetic-sum',
  'seq/fibonacci',
  'seq/geometric',
  'seq/geometric-inf-sum',
  'seq/geometric-sum',
  'seq/lucas',
  'seq/nth-term',
  'seq/partial-sums',
  'seq/product',
  'seq/recurrence',
  'seq/sigma',
]
export const LAZY = true
export const BOOK = 'book-of-math/ch-advanced-03-sequences-series-recurrence'

export const TESTS = [
  // Arithmetic sequence a=1, d=2, n=4 → a_4 = 1 + 4·2 = 9 (0-indexed nth)
  ['(seq/arithmetic 1 2 4)', '9'],
  // Arithmetic sum: first 5 of a=1,d=2 → 1+3+5+7+9 = 25
  ['(seq/arithmetic-sum 1 2 5)', '25'],
  // Fibonacci: F(0)=0, F(1)=1, F(6)=8, F(10)=55
  ['(seq/fibonacci 0)', '0'],
  ['(seq/fibonacci 6)', '8'],
  ['(seq/fibonacci 10)', '55'],
  // Geometric: a=2, r=3, n=0 → 2; n=4 → 162
  ['(seq/geometric 2 3 0)', '2'],
  ['(seq/geometric 2 3 4)', '162'],
  // Geometric sum: 1 + 2 + 4 + 8 = 15 (a=1, r=2, n=4)
  ['(seq/geometric-sum 1 2 4)', '15'],
  // Geometric infinite sum: 1 + 1/2 + 1/4 + ... = 2 (|r|<1)
  ['(seq/geometric-inf-sum 1 0.5)', '2'],
  // Lucas: L(0)=2, L(1)=1, L(5)=11
  ['(seq/lucas 0)', '2'],
  ['(seq/lucas 5)', '11'],
  // nth-term detection: arithmetic (3,5,7,9) → (arithmetic 3 2)
  ['(car (seq/nth-term (list 3 5 7 9)))', 'arithmetic'],
  // Partial sums: (1 2 3 4) → (1 3 6 10)
  ['(seq/partial-sums (list 1 2 3 4))', '(1 3 6 10)'],
  // Product: (product (lambda (i) i) 1 4) = 1·2·3·4 = 24
  ['(seq/product (lambda (i) i) 1 4)', '24'],
  // Sigma: (sigma (lambda (i) i) 1 4) = 1+2+3+4 = 10
  ['(seq/sigma (lambda (i) i) 1 4)', '10'],
  // Recurrence: Fibonacci from coeffs (1 1), init (0 1), n=10 → 55
  ['(seq/recurrence (list 1 1) (list 0 1) 10)', '55'],
]

export function installSeq(env, fuel) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  // (seq/arithmetic a d n) → a + n·d (0-indexed nth term).
  def('seq/arithmetic', (a, d, n) => a + n * d)

  // (seq/arithmetic-sum a d n) — sum of first n terms of a,d arithmetic.
  //
  // Formula: S_n = n·(2a + (n-1)·d)/2.
  def('seq/arithmetic-sum', (a, d, n) => n * (2 * a + (n - 1) * d) / 2)

  // (seq/geometric a r n) → a·r^n (0-indexed nth term).
  def('seq/geometric', (a, r, n) => a * Math.pow(r, n))

  // (seq/geometric-sum a r n) — sum of first n terms of a,r geometric.
  //
  // Formula: S_n = a·(r^n - 1)/(r - 1); when r=1, S_n = n·a.
  def('seq/geometric-sum', (a, r, n) => {
    if (r === 1) return n * a
    return a * (Math.pow(r, n) - 1) / (r - 1)
  })

  // (seq/geometric-inf-sum a r) → a/(1-r) if |r|<1, else NaN.
  def('seq/geometric-inf-sum', (a, r) => {
    if (Math.abs(r) >= 1) return NaN
    return a / (1 - r)
  })

  // (seq/fibonacci n) — fast doubling.
  //
  // F(2k)   = F(k)·(2·F(k+1) − F(k))
  // F(2k+1) = F(k)² + F(k+1)²
  def('seq/fibonacci', (n) => {
    n = n | 0
    if (n < 0) throw new Error('seq/fibonacci: n must be non-negative')
    function fib(m) {
      if (m === 0) return [0, 1]
      const [a, b] = fib(m >> 1)
      const c = a * ((2 * b) - a)
      const d = a * a + b * b
      if (m & 1) return [d, c + d]
      return [c, d]
    }
    return fib(n)[0]
  })

  // (seq/lucas n) — Lucas numbers L(0)=2, L(1)=1, L(n)=L(n-1)+L(n-2).
  def('seq/lucas', (n) => {
    n = n | 0
    if (n < 0) throw new Error('seq/lucas: n must be non-negative')
    if (n === 0) return 2
    if (n === 1) return 1
    let a = 2, b = 1
    for (let i = 2; i <= n; i++) {
      const c = a + b
      a = b
      b = c
    }
    return b
  })

  // (seq/nth-term lst) — detect an arithmetic or geometric pattern.
  //
  // Returns (arithmetic a d), (geometric a r), or (unknown).
  def('seq/nth-term', (lst) => {
    if (!Array.isArray(lst) || lst.length < 2) return [new Sym('unknown')]
    // Arithmetic: constant difference.
    const d = lst[1] - lst[0]
    let arith = true
    for (let i = 2; i < lst.length; i++) {
      if (Math.abs((lst[i] - lst[i - 1]) - d) > 1e-9) { arith = false; break }
    }
    if (arith) return [new Sym('arithmetic'), lst[0], d]
    // Geometric: constant ratio.
    if (lst[0] !== 0) {
      const r = lst[1] / lst[0]
      let geo = true
      for (let i = 2; i < lst.length; i++) {
        if (lst[i - 1] === 0) { geo = false; break }
        if (Math.abs((lst[i] / lst[i - 1]) - r) > 1e-9) { geo = false; break }
      }
      if (geo) return [new Sym('geometric'), lst[0], r]
    }
    return [new Sym('unknown')]
  })

  // (seq/partial-sums lst) → prefix-sum list.
  def('seq/partial-sums', (lst) => {
    if (!Array.isArray(lst)) return []
    const out = new Array(lst.length)
    let s = 0
    for (let i = 0; i < lst.length; i++) {
      s += lst[i]
      out[i] = s
    }
    return out
  })

  // callFn — invoke either a JS function or a Scheme Closure.
  //
  // apply() drives the trampoline for Scheme closures; for pure JS fns we
  // still route through it (apply's applyStep fast-paths JS via
  // `typeof fn === 'function'`).
  const callFn = (f, args) => apply(f, args, fuel)

  // (seq/product f lo hi) — product of f(i) for i in [lo, hi] inclusive.
  def('seq/product', (f, lo, hi) => {
    lo = lo | 0; hi = hi | 0
    let p = 1
    for (let i = lo; i <= hi; i++) p *= callFn(f, [i])
    return p
  })

  // (seq/sigma f lo hi) — sum of f(i) for i in [lo, hi] inclusive.
  def('seq/sigma', (f, lo, hi) => {
    lo = lo | 0; hi = hi | 0
    let s = 0
    for (let i = lo; i <= hi; i++) s += callFn(f, [i])
    return s
  })

  // (seq/recurrence coeffs init n) — linear recurrence.
  //
  // a_i = c1·a_{i-1} + c2·a_{i-2} + ... + ck·a_{i-k}. `init` seeds the
  // first k terms (index 0..k-1). Returns term at index n.
  def('seq/recurrence', (coeffs, init, n) => {
    if (!Array.isArray(coeffs) || !Array.isArray(init)) {
      throw new Error('seq/recurrence: coeffs and init must be lists')
    }
    const k = coeffs.length
    if (init.length !== k) {
      throw new Error(`seq/recurrence: init length (${init.length}) must equal coeffs length (${k})`)
    }
    n = n | 0
    if (n < k) return init[n]
    // Sliding window of last k terms, oldest first.
    const win = init.slice()
    for (let i = k; i <= n; i++) {
      let next = 0
      // Contribution: c1·a_{i-1} + c2·a_{i-2} + ... + ck·a_{i-k}
      // In win: a_{i-1} = win[k-1], a_{i-2} = win[k-2], ..., a_{i-k} = win[0]
      for (let j = 0; j < k; j++) {
        next += coeffs[j] * win[k - 1 - j]
      }
      // Slide window: drop oldest, append new.
      win.shift()
      win.push(next)
    }
    return win[k - 1]
  })

  return env
}

export default installSeq
