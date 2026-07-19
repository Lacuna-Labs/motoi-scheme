// tests/wave-0-do-loop.test.mjs
//
// Wave 0 of architect-motoi-core-runtime-completion-2026-07-16 §4 :do-loop.
//
// R7RS §4.2.4 `do` iteration form, implemented as a built-in desugar in
// src/macro.js. Kept at the macro layer so interp.js is untouched
// (3B backup base surface stays clean).
//
// Shape:
//   (do ((var init [step]) ...)
//       (test result ...)
//       body ...)
//
// Semantics:
//   * Bindings evaluated in parallel each iteration.
//   * `step` optional; omitted step leaves the binding unchanged.
//   * When `test` becomes true, evaluate result ... and return the last;
//     if no results, return the R7RS unspecified value.
//   * `body ...` may side-effect; runs once per iteration when test is false.
//
// Run: node --test tests/wave-0-do-loop.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parse } from '../src/reader.js'
import { evaluate } from '../src/interp.js'
import { makeBaseEnv } from '../src/base.js'
import { expandProgram } from '../src/macro.js'

// Evaluate one Scheme source string in a fresh base env.
function run(src, fuel = 200000) {
  const env = makeBaseEnv({ n: fuel })
  const forms = parse(src)
  const { forms: expanded } = expandProgram(forms, { fuel: { n: fuel } })
  const fuelBox = { n: fuel }
  let result
  for (const f of expanded) result = evaluate(f, env, fuelBox)
  return result
}

// ── basic counting loops ────────────────────────────────────────────

test('do — sum 0..4 via accumulator', () => {
  // R7RS classic — parallel-update ((i 0 (+ i 1)) (sum 0 (+ sum i)))
  const result = run(`
    (do ((i 0 (+ i 1))
         (sum 0 (+ sum i)))
        ((= i 5) sum))
  `)
  assert.equal(result, 10)   // 0+1+2+3+4
})

test('do — factorial 5!', () => {
  const result = run(`
    (do ((i 1 (+ i 1))
         (acc 1 (* acc i)))
        ((> i 5) acc))
  `)
  assert.equal(result, 120)
})

test('do — count-down loop returns final result', () => {
  const result = run(`
    (do ((n 10 (- n 1)))
        ((= n 0) 'blastoff))
  `)
  // eq? of symbol comes through as the Sym instance — check its name.
  assert.equal(result.name, 'blastoff')
})

// ── optional step ────────────────────────────────────────────────────

test('do — omitted step leaves binding unchanged (R7RS)', () => {
  // `limit` has no step; only `i` advances.
  const result = run(`
    (do ((i 0 (+ i 1))
         (limit 3))
        ((>= i limit) i))
  `)
  assert.equal(result, 3)
})

// ── optional result ──────────────────────────────────────────────────

test('do — empty result yields unspecified (R7RS)', () => {
  // (if #f #f) is our unspecified sentinel — surfaces as `false` in JS.
  const result = run(`
    (do ((i 0 (+ i 1)))
        ((= i 3)))
  `)
  assert.equal(result, false)
})

test('do — multiple results returns the LAST', () => {
  const result = run(`
    (do ((i 0 (+ i 1)))
        ((= i 3) 'first 'second 'third))
  `)
  assert.equal(result.name, 'third')
})

// ── body side effects ────────────────────────────────────────────────

test('do — body runs each iteration and can side-effect via set!', () => {
  const result = run(`
    (let ((total 0))
      (do ((i 0 (+ i 1)))
          ((= i 4) total)
        (set! total (+ total (* i i)))))
  `)
  assert.equal(result, 14)   // 0 + 1 + 4 + 9
})

test('do — body may be absent', () => {
  const result = run(`
    (do ((i 0 (+ i 1))
         (acc 0 (+ acc 1)))
        ((= i 5) acc))
  `)
  assert.equal(result, 5)
})

// ── list traversal (R7RS canonical example) ─────────────────────────

test('do — list traversal via cdr, sum', () => {
  const result = run(`
    (do ((lst (list 1 2 3 4 5) (cdr lst))
         (sum 0 (+ sum (car lst))))
        ((null? lst) sum))
  `)
  assert.equal(result, 15)
})

// ── nesting + hygiene ────────────────────────────────────────────────

test('do — nested loops (double sum)', () => {
  const result = run(`
    (do ((i 0 (+ i 1))
         (total 0
                (+ total
                   (do ((j 0 (+ j 1))
                        (row 0 (+ row j)))
                       ((= j 3) row)))))
        ((= i 3) total))
  `)
  // inner sum = 0+1+2 = 3, then i in 0,1,2 => total = 3+3+3 = 9
  assert.equal(result, 9)
})

test('do — hygienic loop name does not clash with user `loop`', () => {
  // User names a var `loop`; the desugared loop name is gensymed
  // (`do-loop~N`), so no shadow.
  const result = run(`
    (let ((loop 42))
      (do ((i 0 (+ i 1)))
          ((= i 3) (+ loop i))))
  `)
  assert.equal(result, 45)   // 42 + 3
})

// ── error paths ──────────────────────────────────────────────────────

test('do — malformed bindings raise a clear error', () => {
  assert.throws(
    () => run(`(do ((i)) ((= i 3)))`),
    /each binding must be \(var init/,
  )
})

test('do — missing test clause raises a clear error', () => {
  assert.throws(
    () => run(`(do ((i 0 (+ i 1))))`),
    /do:/,
  )
})
