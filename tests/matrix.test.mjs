// tests/matrix.test.mjs — small honest matrix verbs.
//
// Provenance: 2026-07-19 (Marcus, IDE Wave 2). Book of ML ch 3+ leans
// on matrix/make, /rows, /cols, /transpose, /multiply, /matvec, and
// friends. These tests are the shape contract.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeCoreEnv } from '../core/index.js'
import { evaluate } from '../src/interp.js'
import { parse } from '../src/reader.js'

import { plain } from './_cells.mjs'
function evalSrc(src) {
  const fuel = { n: 1_000_000 }
  const env = makeCoreEnv({ fuel })
  const forms = parse(src)
  let out
  for (const f of forms) out = evaluate(f, env, fuel)
  return { out, env }
}

test('matrix/make — list-of-rows validates and coerces', () => {
  const { out } = evalSrc('(matrix/make (list (list 1 2 3) (list 4 5 6)))')
  assert.deepEqual(plain(out), [[1, 2, 3], [4, 5, 6]])
})

test('matrix/make — (rows cols) creates a zero matrix', () => {
  const { out } = evalSrc('(matrix/make 2 3)')
  assert.deepEqual(plain(out), [[0, 0, 0], [0, 0, 0]])
})

// 2026-08-01: this asserted ragged input THROWS. It does not, by design.
// Scheme/reference/41-matrix.slat locks the signature as
// "(matrix/make (list row1 row2 ...)) -> matrix | 'ragged", and lib/math/matrix.js
// says so at the return site: "Ragged input returns the symbol 'ragged (per
// reference contract ...), never a thrown error." A returned sentinel is the
// friendlier shape here — it is checkable with eq? and needs no escape
// continuation to recover from. The reference is the language, so the
// assertion was the thing that was wrong, not the implementation.
test("matrix/make — ragged rows return the 'ragged sentinel, not a throw", () => {
  let out
  assert.doesNotThrow(() => { out = evalSrc('(matrix/make (list (list 1 2) (list 3 4 5)))').out })
  assert.equal(out?.name, 'ragged')
})

test("matrix/make — the 'ragged sentinel is eq?-comparable from Scheme", () => {
  // This is how the reference tells callers to check, so it has to hold.
  assert.equal(evalSrc("(eq? (matrix/make (list (list 1 2) (list 3 4 5))) 'ragged)").out, true)
  // A well-formed matrix must NOT trip the sentinel.
  assert.equal(evalSrc("(eq? (matrix/make (list (list 1 2) (list 3 4))) 'ragged)").out, false)
})

test('matrix/rows + matrix/cols — shape reflection', () => {
  const rows = evalSrc('(matrix/rows (matrix/make (list (list 1 2 3) (list 4 5 6))))').out
  const cols = evalSrc('(matrix/cols (matrix/make (list (list 1 2 3) (list 4 5 6))))').out
  assert.equal(rows, 2)
  assert.equal(cols, 3)
})

test('matrix/ref matrix/row matrix/col — element + slice access', () => {
  assert.equal(evalSrc('(matrix/ref (list (list 1 2) (list 3 4)) 1 0)').out, 3)
  assert.deepEqual(plain(evalSrc('(matrix/row (list (list 1 2) (list 3 4)) 0)').out), [1, 2])
  assert.deepEqual(plain(evalSrc('(matrix/col (list (list 1 2) (list 3 4)) 1)').out), [2, 4])
})

test('matrix/transpose — 2×3 becomes 3×2', () => {
  const { out } = evalSrc('(matrix/transpose (list (list 1 2 3) (list 4 5 6)))')
  assert.deepEqual(plain(out), [[1, 4], [2, 5], [3, 6]])
})

test('matrix/identity — I3 is right', () => {
  const { out } = evalSrc('(matrix/identity 3)')
  assert.deepEqual(plain(out), [[1, 0, 0], [0, 1, 0], [0, 0, 1]])
})

test('matrix/zero — rows × cols filled with 0', () => {
  const { out } = evalSrc('(matrix/zero 2 4)')
  assert.deepEqual(plain(out), [[0, 0, 0, 0], [0, 0, 0, 0]])
})

test('matrix/scale — every element × k', () => {
  const { out } = evalSrc('(matrix/scale (list (list 1 2) (list 3 4)) 10)')
  assert.deepEqual(plain(out), [[10, 20], [30, 40]])
})

test('matrix/add + matrix/sub — element-wise', () => {
  const add = evalSrc('(matrix/add (list (list 1 2) (list 3 4)) (list (list 10 20) (list 30 40)))').out
  const sub = evalSrc('(matrix/sub (list (list 10 20) (list 30 40)) (list (list 1 2) (list 3 4)))').out
  assert.deepEqual(plain(add), [[11, 22], [33, 44]])
  assert.deepEqual(plain(sub), [[9, 18], [27, 36]])
})

test('matrix/multiply — I × M = M', () => {
  const src = `
    (define I (matrix/identity 2))
    (define M (list (list 1 2) (list 3 4)))
    (matrix/multiply I M)
  `
  const { out } = evalSrc(src)
  assert.deepEqual(plain(out), [[1, 2], [3, 4]])
})

test('matrix/multiply — 2×3 * 3×2 = 2×2', () => {
  const src = `
    (define A (list (list 1 2 3) (list 4 5 6)))
    (define B (list (list 7 8) (list 9 10) (list 11 12)))
    (matrix/multiply A B)
  `
  const { out } = evalSrc(src)
  assert.deepEqual(plain(out), [[58, 64], [139, 154]])
})

test('matrix/matvec — matrix-vector product', () => {
  const src = `
    (define M (list (list 1 2 3) (list 4 5 6)))
    (define v (list 10 20 30))
    (matrix/matvec M v)
  `
  const { out } = evalSrc(src)
  assert.deepEqual(plain(out), [140, 320])
})

test('matrix/multiply — shape mismatch throws', () => {
  assert.throws(() => evalSrc(`
    (matrix/multiply (list (list 1 2 3)) (list (list 1) (list 2)))
  `), /shape/)
})
