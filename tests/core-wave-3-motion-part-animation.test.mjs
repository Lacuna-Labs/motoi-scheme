// tests/core-wave-3-motion-part-animation.test.mjs
//
// Wave 3 — motion, part (pure animation functions), animation-budget.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Sym } from '../src/reader.js'
import { makeCoreEnv } from '../core/index.js'

function fresh() {
  const env = makeCoreEnv()
  env.vars.get('world/reset!')()
  return env
}

// ── motion/ ────────────────────────────────────────────────────────

test('motion/halt zeroes velocity', () => {
  const env = fresh()
  const id = env.vars.get('entity/spawn')(new Sym('ball'), 0, 0)
  env.vars.get('entity/set-vel!')(id, 10, 10)
  env.vars.get('motion/halt')(id)
  assert.deepEqual(env.vars.get('entity/vel')(id), [0, 0])
})

test('motion/drop applies gravity to vy', () => {
  const env = fresh()
  const id = env.vars.get('entity/spawn')(new Sym('ball'), 0, 0)
  env.vars.get('motion/drop')(id, 0.5)
  assert.deepEqual(env.vars.get('entity/vel')(id), [0, 0.5])
})

test('motion/arc returns tagged clause', () => {
  const env = fresh()
  const c = env.vars.get('motion/arc')(new Sym('e1'), 50, 30)
  assert.ok(Array.isArray(c))
  assert.equal(c[0].name, 'motion/arc')
})

test('motion/follow-input returns tagged clause', () => {
  const env = fresh()
  const c = env.vars.get('motion/follow-input')(new Sym('e1'))
  assert.equal(c[0].name, 'motion/follow-input')
})

test('motion/with-feel runs thunk', () => {
  const env = fresh()
  let called = false
  const r = env.vars.get('motion/with-feel')(new Sym('quick'), () => { called = true; return 42 })
  assert.equal(r, 42)
  assert.equal(called, true)
})

test('motion/with-pace runs thunk', () => {
  const env = fresh()
  const r = env.vars.get('motion/with-pace')(new Sym('slow'), () => 99)
  assert.equal(r, 99)
})

// ── part/ (pure animation functions) ────────────────────────────

for (const name of ['part/wave', 'part/nod', 'part/turn', 'part/tilt',
  'part/step', 'part/reach', 'part/point', 'part/raise', 'part/lower',
  'part/shake', 'part/breathe', 'part/lean', 'part/look-toward',
  'part/shrug', 'part/bow', 'part/sway', 'part/expression']) {
  test(`${name} — returns a function`, () => {
    const env = fresh()
    const f = env.vars.get(name)(1)
    assert.equal(typeof f, 'function')
  })
}

test('part/wave amp=2 at phase 0.25 = 2', () => {
  const env = fresh()
  const f = env.vars.get('part/wave')(2)
  assert.ok(Math.abs(f(0.25) - 2) < 1e-12)
})
test('part/nod amp=5 at phase 0.5 = 5', () => {
  const env = fresh()
  const f = env.vars.get('part/nod')(5)
  assert.equal(f(0.5), 5)
})
test('part/turn 0..pi at 0.5 = pi/2', () => {
  const env = fresh()
  const f = env.vars.get('part/turn')(0, Math.PI)
  assert.equal(f(0.5), Math.PI / 2)
})
test('part/raise amp=10 at 0.5 = 5', () => {
  const env = fresh()
  const f = env.vars.get('part/raise')(10)
  assert.equal(f(0.5), 5)
})
test('part/bow amp=10 at 0.5 = 10', () => {
  const env = fresh()
  const f = env.vars.get('part/bow')(10)
  assert.equal(f(0.5), 10)
})

// ── animation-budget ──────────────────────────────────────────

test('animation/budget default 16', () => {
  const env = fresh()
  assert.equal(env.vars.get('animation/budget')(), 16)
})
test('animation/budget setter', () => {
  const env = fresh()
  assert.equal(env.vars.get('animation/budget')(32), 32)
})
test('animation/reflow-policy default auto', () => {
  const env = fresh()
  const p = env.vars.get('animation/reflow-policy')()
  assert.equal(p.name, 'auto')
})
test('animation/set-reflow-policy stable', () => {
  const env = fresh()
  const r = env.vars.get('animation/set-reflow-policy')(new Sym('stable'))
  assert.equal(r.name, 'stable')
})
