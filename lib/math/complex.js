// complex.js — complex-number arithmetic.
//
// Provenance: 2026-07-22. Wires 18 complex/* verbs from
// scheme/reference/17-complex.slat and
// scheme-books/book-of-math/ch-advanced-11-complex-analysis.book.slatl.
//
// Representation:
//   Complex numbers are plain JS objects tagged with Symbol.for('motoi:complex'):
//     { [TAG]: true, re: number, im: number }
//   Bare JS numbers are lifted to (n + 0i) as needed.
//   The tag makes them recognizable by the display formatter in src/base.js.

import { Sym, sym } from '../../src/reader.js'

const TAG = Symbol.for('motoi:complex')

// ── inline registration metadata ─────────────────────────────────
export const VERBS = [
  'complex/*',
  'complex/+',
  'complex/-',
  'complex/->polar',
  'complex/->string',
  'complex//',
  'complex/=',
  'complex/arg',
  'complex/conjugate',
  'complex/exp',
  'complex/from-polar',
  'complex/im',
  'complex/make',
  'complex/modulus',
  'complex/neg',
  'complex/pow',
  'complex/re',
  'complex/scale',
]
export const LAZY = true
export const BOOK = 'book-of-math/ch-advanced-11-complex-analysis'
export const TESTS = [
  ['(complex/->string (complex/make 3 4))', '"3+4i"'],
  ['(complex/modulus (complex/make 3 4))', '5'],
  ['(complex/re (complex/+ (complex/make 1 2) (complex/make 3 4)))', '4'],
]

// Helpers
function isC(v) { return v && typeof v === 'object' && v[TAG] === true }
function lift(v) {
  if (isC(v)) return v
  if (typeof v === 'number') return { [TAG]: true, re: v, im: 0 }
  if (typeof v === 'bigint') return { [TAG]: true, re: Number(v), im: 0 }
  // A complex is also writable as a 2-element list `(re im)` — the literal
  // form reference programs use, e.g. `(complex/* '(3 4) '(1 2))`.
  if (Array.isArray(v) && v.length === 2 &&
      typeof v[0] === 'number' && typeof v[1] === 'number') {
    return { [TAG]: true, re: v[0], im: v[1] }
  }
  throw new Error('complex: cannot coerce to complex — ' + typeof v)
}
function mk(re, im) { return { [TAG]: true, re: +re, im: +im } }
function fmt(z) {
  const { re, im } = z
  if (im === 0) return String(re)
  if (re === 0) return im === 1 ? 'i' : im === -1 ? '-i' : `${im}i`
  const sign = im >= 0 ? '+' : '-'
  const ai = Math.abs(im)
  const imPart = ai === 1 ? 'i' : `${ai}i`
  return `${re}${sign}${imPart}`
}

export function installComplex(env, ctx) {
  const def = (name, fn) => env.define(name, fn, { perm: 'read' })

  // Constructors / accessors
  def('complex/make', (a, b) => mk(a, b))
  def('complex/re', (z) => lift(z).re)
  def('complex/im', (z) => lift(z).im)

  // Arithmetic
  def('complex/+', (a, b) => {
    const x = lift(a), y = lift(b)
    return mk(x.re + y.re, x.im + y.im)
  })
  def('complex/-', (a, b) => {
    const x = lift(a), y = lift(b)
    return mk(x.re - y.re, x.im - y.im)
  })
  def('complex/*', (a, b) => {
    const x = lift(a), y = lift(b)
    return mk(x.re * y.re - x.im * y.im, x.re * y.im + x.im * y.re)
  })
  def('complex//', (a, b) => {
    const x = lift(a), y = lift(b)
    const den = y.re * y.re + y.im * y.im
    if (den === 0) return [sym('escalate'), sym('divide-by-zero')]
    return mk((x.re * y.re + x.im * y.im) / den, (x.im * y.re - x.re * y.im) / den)
  })
  def('complex/neg', (z) => { const x = lift(z); return mk(-x.re, -x.im) })
  def('complex/scale', (k, z) => {
    const K = typeof k === 'number' ? k : lift(k).re
    const x = lift(z)
    return mk(K * x.re, K * x.im)
  })

  // Comparison
  def('complex/=', (a, b) => {
    const x = lift(a), y = lift(b)
    return Math.abs(x.re - y.re) < 1e-12 && Math.abs(x.im - y.im) < 1e-12
  })

  // Conjugate, modulus, arg
  def('complex/conjugate', (z) => { const x = lift(z); return mk(x.re, -x.im) })
  def('complex/modulus', (z) => {
    const x = lift(z)
    return Math.hypot(x.re, x.im)
  })
  def('complex/arg', (z) => {
    const x = lift(z)
    if (x.re === 0 && x.im === 0) return [sym('escalate'), sym('arg-undefined')]
    return Math.atan2(x.im, x.re)
  })

  // Polar
  def('complex/->polar', (z) => {
    const x = lift(z)
    if (x.re === 0 && x.im === 0) return [sym('escalate'), sym('arg-undefined')]
    return [Math.hypot(x.re, x.im), Math.atan2(x.im, x.re)]
  })
  def('complex/from-polar', (r, theta) => {
    const R = +r, T = +theta
    return mk(R * Math.cos(T), R * Math.sin(T))
  })

  // Formatting
  def('complex/->string', (z) => fmt(lift(z)))

  // Transcendentals
  def('complex/exp', (z) => {
    const x = lift(z)
    const eRe = Math.exp(x.re)
    return mk(eRe * Math.cos(x.im), eRe * Math.sin(x.im))
  })

  // Complex power z^n. If n is real integer we do repeated multiplication;
  // for arbitrary n we use e^(n log z).
  def('complex/pow', (z, n) => {
    const x = lift(z)
    // n can be integer, real, or complex
    if (typeof n === 'number' && Number.isInteger(n)) {
      // Integer power via de Moivre for accuracy.
      if (n === 0) return mk(1, 0)
      const r = Math.hypot(x.re, x.im)
      const t = Math.atan2(x.im, x.re)
      const rn = Math.pow(r, n)
      return mk(rn * Math.cos(n * t), rn * Math.sin(n * t))
    }
    // General n: e^(n · log(z))
    const nc = lift(n)
    const r = Math.hypot(x.re, x.im)
    if (r === 0) return mk(0, 0)
    const logZ = { re: Math.log(r), im: Math.atan2(x.im, x.re) }
    const prod = {
      re: nc.re * logZ.re - nc.im * logZ.im,
      im: nc.re * logZ.im + nc.im * logZ.re,
    }
    const eRe = Math.exp(prod.re)
    return mk(eRe * Math.cos(prod.im), eRe * Math.sin(prod.im))
  })

  return env
}

export default installComplex
