// tests/base.test.mjs — base-library patches (2026-07-19, Marcus).
//
// Book of ML surfaced four runtime papercuts; three of them live in
// base.js / lib/graphics/vec.js / lib/graphics/geom.js:
//   1. vec/make should accept a single list arg (not only variadic)
//   2. map should accept multiple lists (R7RS multi-arg form)
//   3. math/sin math/cos math/tan should alias geom/sin geom/cos geom/tan
//
// This file exercises each patch AND the backwards-compatible original
// behaviour so no existing cart breaks.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeCoreEnv } from '../core/index.js'
import { evaluate } from '../src/interp.js'
import { parse } from '../src/reader.js'

function evalSrc(src, envOpt) {
  const fuel = { n: 1_000_000 }
  const env = envOpt || makeCoreEnv({ fuel })
  const forms = parse(src)
  let out
  for (const f of forms) out = evaluate(f, env, fuel)
  return { out, env }
}

// ── Patch 1: vec/make list-arg ───────────────────────────────────────

test('vec/make — variadic form still builds vector', () => {
  const { out } = evalSrc('(vec/make 1 2 3)')
  assert.deepEqual(out, [1, 2, 3])
})

test('vec/make — list arg builds vector (Patch 1)', () => {
  const { out } = evalSrc('(vec/make (list 1 2 3))')
  assert.deepEqual(out, [1, 2, 3])
})

test('vec/make — nested arithmetic list works', () => {
  const { out } = evalSrc('(vec/make (map (lambda (x) (* x x)) (list 1 2 3)))')
  assert.deepEqual(out, [1, 4, 9])
})

test('vec/make — empty list arg → empty vector', () => {
  const { out } = evalSrc('(vec/make (list))')
  assert.deepEqual(out, [])
})

test('vec/make — coerces non-numbers via + coercion', () => {
  // Backwards-compat behaviour: any non-number input coerces via +x.
  // A single scalar number arg stays a length-1 vector.
  const { out } = evalSrc('(vec/make 3.14)')
  assert.deepEqual(out, [3.14])
})

// ── Patch 2: map with multiple lists ─────────────────────────────────

test('map — single list form unchanged', () => {
  const { out } = evalSrc('(map (lambda (x) (* x x)) (list 1 2 3))')
  assert.deepEqual(out, [1, 4, 9])
})

test('map — two lists, pairwise + (Patch 2)', () => {
  const { out } = evalSrc('(map + (list 1 2 3) (list 10 20 30))')
  assert.deepEqual(out, [11, 22, 33])
})

test('map — three lists, ternary lambda', () => {
  const { out } = evalSrc('(map (lambda (a b c) (+ a b c)) (list 1 2 3) (list 10 20 30) (list 100 200 300))')
  assert.deepEqual(out, [111, 222, 333])
})

test('map — shortest list determines length (R7RS)', () => {
  const { out } = evalSrc('(map + (list 1 2 3 4 5) (list 10 20 30))')
  assert.deepEqual(out, [11, 22, 33])
})

test('for-each — multiple lists execute pairwise', () => {
  // Confirms the symmetric extension to for-each landed too.
  const src = `
    (define sink (list))
    (define (push! v) (set! sink (cons v sink)))
    (for-each (lambda (a b) (push! (+ a b))) (list 1 2 3) (list 10 20 30))
    sink
  `
  const { out } = evalSrc(src)
  // cons pushes to the front, so we see 33, 22, 11.
  assert.deepEqual(out, [33, 22, 11])
})

// ── Patch 3: math/* trig aliases ─────────────────────────────────────

test('math/sin — alias of geom/sin', () => {
  const a = evalSrc('(math/sin 0)').out
  const b = evalSrc('(geom/sin 0)').out
  assert.equal(a, 0)
  assert.equal(a, b)
})

test('math/cos — alias of geom/cos', () => {
  const { out } = evalSrc('(math/cos 0)')
  assert.equal(out, 1)
})

test('math/tan — alias of geom/tan', () => {
  const { out } = evalSrc('(math/tan 0)')
  assert.equal(out, 0)
})

test('math/atan2 — 4-quadrant arctangent', () => {
  const { out } = evalSrc('(math/atan2 1 1)')
  assert.ok(Math.abs(out - Math.PI / 4) < 1e-10)
})

test('math/asin math/acos math/atan — installed', () => {
  assert.equal(evalSrc('(math/asin 0)').out, 0)
  assert.equal(evalSrc('(math/acos 1)').out, 0)
  assert.equal(evalSrc('(math/atan 0)').out, 0)
})

// ── Patch 4 smoke: sci notation reaches evaluator ────────────────────

test('reader × evaluator — 1e-5 evaluates as 0.00001', () => {
  const { out } = evalSrc('1e-5')
  assert.equal(out, 1e-5)
})

test('reader × evaluator — (+ 1e5 1) = 100001', () => {
  const { out } = evalSrc('(+ 1e5 1)')
  assert.equal(out, 100001)
})

// ── Book-of-ML capstone shape: verify a mini-neuron works ────────────

test('mini-neuron — (vec/dot ws xs) + bias with math/exp works end-to-end', () => {
  const src = `
    (define ws (vec/make (list 0.1 0.2 0.3)))
    (define xs (vec/make (list 1 2 3)))
    (define b 0.5)
    (+ (vec/dot ws xs) b)
  `
  const { out } = evalSrc(src)
  // 0.1*1 + 0.2*2 + 0.3*3 + 0.5 = 0.1 + 0.4 + 0.9 + 0.5 = 1.9
  assert.ok(Math.abs(out - 1.9) < 1e-9)
})
