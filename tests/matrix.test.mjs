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
  assert.deepEqual(out, [[1, 2, 3], [4, 5, 6]])
})

test('matrix/make — (rows cols) creates a zero matrix', () => {
  const { out } = evalSrc('(matrix/make 2 3)')
  assert.deepEqual(out, [[0, 0, 0], [0, 0, 0]])
})

test('matrix/make — ragged rows throw', () => {
  assert.throws(() => evalSrc('(matrix/make (list (list 1 2) (list 3 4 5)))'), /ragged/)
})

test('matrix/rows + matrix/cols — shape reflection', () => {
  const rows = evalSrc('(matrix/rows (matrix/make (list (list 1 2 3) (list 4 5 6))))').out
  const cols = evalSrc('(matrix/cols (matrix/make (list (list 1 2 3) (list 4 5 6))))').out
  assert.equal(rows, 2)
  assert.equal(cols, 3)
})

test('matrix/ref matrix/row matrix/col — element + slice access', () => {
  assert.equal(evalSrc('(matrix/ref (list (list 1 2) (list 3 4)) 1 0)').out, 3)
  assert.deepEqual(evalSrc('(matrix/row (list (list 1 2) (list 3 4)) 0)').out, [1, 2])
  assert.deepEqual(evalSrc('(matrix/col (list (list 1 2) (list 3 4)) 1)').out, [2, 4])
})

test('matrix/transpose — 2×3 becomes 3×2', () => {
  const { out } = evalSrc('(matrix/transpose (list (list 1 2 3) (list 4 5 6)))')
  assert.deepEqual(out, [[1, 4], [2, 5], [3, 6]])
})

test('matrix/identity — I3 is right', () => {
  const { out } = evalSrc('(matrix/identity 3)')
  assert.deepEqual(out, [[1, 0, 0], [0, 1, 0], [0, 0, 1]])
})

test('matrix/zero — rows × cols filled with 0', () => {
  const { out } = evalSrc('(matrix/zero 2 4)')
  assert.deepEqual(out, [[0, 0, 0, 0], [0, 0, 0, 0]])
})

test('matrix/scale — every element × k', () => {
  const { out } = evalSrc('(matrix/scale (list (list 1 2) (list 3 4)) 10)')
  assert.deepEqual(out, [[10, 20], [30, 40]])
})

test('matrix/add + matrix/sub — element-wise', () => {
  const add = evalSrc('(matrix/add (list (list 1 2) (list 3 4)) (list (list 10 20) (list 30 40)))').out
  const sub = evalSrc('(matrix/sub (list (list 10 20) (list 30 40)) (list (list 1 2) (list 3 4)))').out
  assert.deepEqual(add, [[11, 22], [33, 44]])
  assert.deepEqual(sub, [[9, 18], [27, 36]])
})

test('matrix/multiply — I × M = M', () => {
  const src = `
    (define I (matrix/identity 2))
    (define M (list (list 1 2) (list 3 4)))
    (matrix/multiply I M)
  `
  const { out } = evalSrc(src)
  assert.deepEqual(out, [[1, 2], [3, 4]])
})

test('matrix/multiply — 2×3 * 3×2 = 2×2', () => {
  const src = `
    (define A (list (list 1 2 3) (list 4 5 6)))
    (define B (list (list 7 8) (list 9 10) (list 11 12)))
    (matrix/multiply A B)
  `
  const { out } = evalSrc(src)
  assert.deepEqual(out, [[58, 64], [139, 154]])
})

test('matrix/matvec — matrix-vector product', () => {
  const src = `
    (define M (list (list 1 2 3) (list 4 5 6)))
    (define v (list 10 20 30))
    (matrix/matvec M v)
  `
  const { out } = evalSrc(src)
  assert.deepEqual(out, [140, 320])
})

test('matrix/multiply — shape mismatch throws', () => {
  assert.throws(() => evalSrc(`
    (matrix/multiply (list (list 1 2 3)) (list (list 1) (list 2)))
  `), /shape/)
})
