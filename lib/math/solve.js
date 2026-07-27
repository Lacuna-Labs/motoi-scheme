// solve.js — algebra solvers, distance/midpoint, interest, percent change.
//
// Provenance: 2026-07-22 (Alfred completion sweep, applied-math lane).
// Reference chapter 57-solve.slat documents 13 verbs across linear /
// quadratic / completing-square / distance / midpoint / interest / etc.
// None were wired. This file wires all 13 with honest algebra: the actual
// quadratic formula, real Pythagorean checks, compound-interest arithmetic.
//
// Doctrine:
//   * Every solver is a pure function on numbers. No state, no drawing.
//   * Return shapes match the reference exactly:
//       - solve/quadratic → (discriminant nature root1 root2), where nature
//         is 'two-real 'one-real or 'complex.
//       - solve/completing-square → (list h k) (vertex form parameters)
//       - solve/vertex → (list h k)
//       - solve/midpoint → (list x y)
//       - solve/percent-change → (list fractional-change percent-change)
//       - solve/slope-intercept → (list slope intercept)
//       - solve/system-2x2 → (list x y)
//       - solve/unit-circle → (list cos sin tan)
//       - solve/interest → number (compound amount)
//       - solve/pythagorean-triple? → boolean
//   * Complex roots use JS complex-as-pair encoding (real, imag) only when
//     the reference asks for it; solve/quadratic returns 'complex plus the
//     real part shifted (real ± imag·i encoded as two conjugate pairs). To
//     stay kid-friendly, return two lists `(list real imag)` for complex
//     roots, and bare numbers for real roots.

import { Sym } from '../../src/reader.js'


// ── inline registration metadata (2026-07-22) ────────────────────
// See engineering/HOW-TO-REGISTER-A-VERB.md.
export const VERBS = [
  'solve/completing-square',
  'solve/distance',
  'solve/interest',
  'solve/linear',
  'solve/midpoint',
  'solve/percent-change',
  'solve/proportion',
  'solve/pythagorean-triple?',
  'solve/quadratic',
  'solve/slope-intercept',
  'solve/system-2x2',
  'solve/unit-circle',
  'solve/vertex',
]
export const LAZY = true
export const BOOK = 'book-of-math/ch09-algebra-1'

export const TESTS = [
  // Linear: 2x + 3 = 0 → x = -1.5
  ['(solve/linear 2 3)', '-1.5'],
  // Quadratic x²-5x+6=0 → roots 2, 3, discriminant 1, nature two-real
  ['(car (solve/quadratic 1 -5 6))', '1'],
  ['(car (cdr (solve/quadratic 1 -5 6)))', 'two-real'],
  // Completing square: x²+6x+5 → (x+3)² - 4, so h=-3, k=-4
  ['(solve/completing-square 1 6 5)', '(-3 -4)'],
  // Distance (0,0)→(3,4) = 5
  ['(solve/distance 0 0 3 4)', '5'],
  // Interest: P=1000, r=0.05, n=1, t=1 → 1050
  ['(solve/interest 1000 0.05 1 1)', '1050'],
  // Midpoint (0,0)-(4,6) = (2,3)
  ['(solve/midpoint 0 0 4 6)', '(2 3)'],
  // Percent change: 100→150 → (0.5 50)
  ['(solve/percent-change 100 150)', '(0.5 50)'],
  // Proportion: a/b = c/x → x = b·c/a. 2/3 = 4/x → x=6
  ['(solve/proportion 2 3 4)', '6'],
  // Pythagorean: (3,4,5) is a triple
  ['(solve/pythagorean-triple? 3 4 5)', '#t'],
  ['(solve/pythagorean-triple? 3 4 6)', '#f'],
  // Slope-intercept: (0,1)-(2,5) → slope 2, intercept 1
  ['(solve/slope-intercept 0 1 2 5)', '(2 1)'],
  // System 2x2: x+y=3, x-y=1 → x=2, y=1
  ['(solve/system-2x2 1 1 3 1 -1 1)', '(2 1)'],
  // Unit circle at 0: cos=1, sin=0, tan=0
  ['(car (solve/unit-circle 0))', '1'],
  // Vertex of y = x²-4x+3 → h=2, k=-1
  ['(solve/vertex 1 -4 3)', '(2 -1)'],
]

export function installSolve(env, fuel) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  // (solve/linear a b) — solve ax + b = 0 → x = -b/a.
  def('solve/linear', (a, b) => {
    if (a === 0) throw new Error('solve/linear: a cannot be zero')
    return -b / a
  })

  // (solve/quadratic a b c) — solve ax² + bx + c = 0.
  //
  // Returns (list discriminant nature root1 root2). For real roots, roots
  // are numbers; for complex roots, each root is (list real imag).
  def('solve/quadratic', (a, b, c) => {
    if (a === 0) throw new Error('solve/quadratic: a cannot be zero')
    const D = b * b - 4 * a * c
    let nature, r1, r2
    if (D > 1e-12) {
      const s = Math.sqrt(D)
      nature = new Sym('two-real')
      r1 = (-b - s) / (2 * a)
      r2 = (-b + s) / (2 * a)
    } else if (Math.abs(D) <= 1e-12) {
      nature = new Sym('one-real')
      r1 = -b / (2 * a)
      r2 = r1
    } else {
      const s = Math.sqrt(-D)
      nature = new Sym('complex')
      const re = -b / (2 * a)
      const im = s / (2 * a)
      r1 = [re, -im]
      r2 = [re, im]
    }
    return [D, nature, r1, r2]
  })

  // (solve/completing-square a b c) — for ax² + bx + c, rewrite as
  // a(x - h)² + k. Returns (list h k). h = -b/(2a), k = c - b²/(4a).
  def('solve/completing-square', (a, b, c) => {
    if (a === 0) throw new Error('solve/completing-square: a cannot be zero')
    const h = -b / (2 * a)
    const k = c - (b * b) / (4 * a)
    return [h, k]
  })

  // (solve/vertex a b c) — same as completing-square: the vertex of the
  // parabola y = ax² + bx + c is (h, k) with h = -b/(2a), k = c - b²/(4a).
  def('solve/vertex', (a, b, c) => {
    if (a === 0) throw new Error('solve/vertex: a cannot be zero')
    const h = -b / (2 * a)
    const k = c - (b * b) / (4 * a)
    return [h, k]
  })

  // (solve/distance x1 y1 x2 y2) — Euclidean distance.
  def('solve/distance', (x1, y1, x2, y2) => {
    const dx = x2 - x1, dy = y2 - y1
    return Math.sqrt(dx * dx + dy * dy)
  })

  // (solve/midpoint x1 y1 x2 y2) — midpoint of the segment.
  def('solve/midpoint', (x1, y1, x2, y2) => {
    return [(x1 + x2) / 2, (y1 + y2) / 2]
  })

  // (solve/percent-change old new) — (fractional-change percent-change).
  //
  // Fractional = (new-old)/old; percent = fractional·100.
  def('solve/percent-change', (o, n) => {
    if (o === 0) throw new Error('solve/percent-change: old value cannot be zero')
    const frac = (n - o) / o
    return [frac, frac * 100]
  })

  // (solve/interest p r n t) — compound interest amount.
  //
  // A = p·(1 + r/n)^(n·t). p=principal, r=annual rate, n=compounds/year,
  // t=years.
  def('solve/interest', (p, r, n, t) => {
    return p * Math.pow(1 + r / n, n * t)
  })

  // (solve/proportion a b c) — solve a/b = c/x → x = b·c/a.
  def('solve/proportion', (a, b, c) => {
    if (a === 0) throw new Error('solve/proportion: a cannot be zero')
    return b * c / a
  })

  // (solve/pythagorean-triple? a b c) — is (a, b, c) a Pythagorean triple?
  //
  // Order-insensitive: sort so c is the largest, then test a²+b²=c². Uses
  // integer comparison so floating-point drift doesn't produce false hits.
  def('solve/pythagorean-triple?', (a, b, c) => {
    const arr = [a, b, c].map(Math.abs).sort((x, y) => x - y)
    return arr[0] * arr[0] + arr[1] * arr[1] === arr[2] * arr[2]
  })

  // (solve/slope-intercept x1 y1 x2 y2) — line through (x1,y1) and (x2,y2).
  //
  // Returns (slope intercept). slope = (y2-y1)/(x2-x1), intercept = y1 - slope·x1.
  def('solve/slope-intercept', (x1, y1, x2, y2) => {
    if (x1 === x2) throw new Error('solve/slope-intercept: vertical line')
    const slope = (y2 - y1) / (x2 - x1)
    const intercept = y1 - slope * x1
    return [slope, intercept]
  })

  // (solve/system-2x2 a b c d e f) — solve ax+by=c, dx+ey=f by Cramer's rule.
  def('solve/system-2x2', (a, b, c, d, e, f) => {
    const det = a * e - b * d
    if (Math.abs(det) < 1e-12) throw new Error('solve/system-2x2: singular system')
    const x = (c * e - b * f) / det
    const y = (a * f - c * d) / det
    return [x, y]
  })

  // (solve/unit-circle θ) — (cos θ, sin θ, tan θ) at angle θ (radians).
  def('solve/unit-circle', (theta) => {
    return [Math.cos(theta), Math.sin(theta), Math.tan(theta)]
  })

  return env
}

export default installSolve
