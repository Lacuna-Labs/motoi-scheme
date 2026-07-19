// tests/wave-0-exp-log.test.mjs
//
// Wave 0 of architect-motoi-core-runtime-completion-2026-07-16 §4 :exp-log.
//
// Verbs under test (added to src/base.js — makeBaseEnv exposes them, so
// makeCoreEnv, makeExtendedBaseEnv, and every downstream env inherits):
//   exp    — e^x, natural exponential
//   log    — ln(x), natural logarithm  (R7RS §6.2.6)
//   log2   — log base 2
//   log10  — log base 10
//   exp2   — 2^x
//
// Run: node --test tests/wave-0-exp-log.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeBaseEnv } from '../src/base.js'
import { makeCoreEnv } from '../core/index.js'

function fresh() {
  return makeBaseEnv({ n: 1_000_000 })
}

// A small helper — floats need epsilon compare.
function approx(a, b, eps = 1e-12) {
  return Math.abs(a - b) < eps
}

// ── registration ──────────────────────────────────────────────────────

for (const name of ['exp', 'log', 'log2', 'log10', 'exp2']) {
  test(`${name} — registers on makeBaseEnv`, () => {
    const env = fresh()
    assert.ok(env.vars.has(name), `${name} is registered`)
    assert.equal(typeof env.vars.get(name), 'function')
  })

  test(`${name} — reachable through makeCoreEnv`, () => {
    const env = makeCoreEnv()
    assert.ok(env.vars.has(name), `${name} propagates to CORE env`)
  })
}

// ── happy path ────────────────────────────────────────────────────────

test('exp(0) === 1', () => {
  const env = fresh()
  assert.equal(env.vars.get('exp')(0), 1)
})

test('exp(1) === e', () => {
  const env = fresh()
  assert.ok(approx(env.vars.get('exp')(1), Math.E))
})

test('log(1) === 0', () => {
  const env = fresh()
  assert.equal(env.vars.get('log')(1), 0)
})

test('log(e) === 1', () => {
  const env = fresh()
  assert.ok(approx(env.vars.get('log')(Math.E), 1))
})

test('log2(8) === 3', () => {
  const env = fresh()
  assert.equal(env.vars.get('log2')(8), 3)
})

test('log10(1000) === 3', () => {
  const env = fresh()
  assert.ok(approx(env.vars.get('log10')(1000), 3))
})

test('exp2(10) === 1024', () => {
  const env = fresh()
  assert.equal(env.vars.get('exp2')(10), 1024)
})

test('exp2(0) === 1', () => {
  const env = fresh()
  assert.equal(env.vars.get('exp2')(0), 1)
})

// ── round-trip ────────────────────────────────────────────────────────

test('exp / log are inverses', () => {
  const env = fresh()
  const exp = env.vars.get('exp')
  const log = env.vars.get('log')
  for (const x of [0.5, 1, 2, 10, 42]) {
    assert.ok(approx(log(exp(x)), x, 1e-9), `log(exp(${x})) ≈ ${x}`)
  }
})

test('exp2 / log2 are inverses', () => {
  const env = fresh()
  const exp2 = env.vars.get('exp2')
  const log2 = env.vars.get('log2')
  for (const x of [1, 2, 3, 10, 20]) {
    assert.ok(approx(log2(exp2(x)), x, 1e-9))
  }
})

// ── edge cases ────────────────────────────────────────────────────────

test('log(0) === -Infinity', () => {
  const env = fresh()
  assert.equal(env.vars.get('log')(0), -Infinity)
})

test('log(-1) is NaN', () => {
  const env = fresh()
  assert.ok(Number.isNaN(env.vars.get('log')(-1)))
})
