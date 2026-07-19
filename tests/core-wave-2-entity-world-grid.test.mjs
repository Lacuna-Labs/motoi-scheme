// tests/core-wave-2-entity-world-grid.test.mjs
//
// Wave 2 CORE completion — entity, world, grid, camera.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Sym } from '../src/reader.js'
import { makeCoreEnv } from '../core/index.js'

function fresh() {
  const env = makeCoreEnv()
  env.vars.get('world/reset!')()
  return env
}

// ── entity/ ────────────────────────────────────────────────────────

test('entity/spawn returns id, entity/pos matches', () => {
  const env = fresh()
  const id = env.vars.get('entity/spawn')(new Sym('ball'), 10, 20)
  assert.ok(typeof id === 'string')
  assert.deepEqual(env.vars.get('entity/pos')(id), [10, 20])
})
test('entity/alive? #t after spawn', () => {
  const env = fresh()
  const id = env.vars.get('entity/spawn')(new Sym('ball'), 0, 0)
  assert.equal(env.vars.get('entity/alive?')(id), true)
})
test('entity/despawn! removes entity', () => {
  const env = fresh()
  const id = env.vars.get('entity/spawn')(new Sym('ball'), 0, 0)
  assert.equal(env.vars.get('entity/despawn!')(id), true)
  assert.equal(env.vars.get('entity/alive?')(id), false)
})
test('entity/set-vel! + entity/vel', () => {
  const env = fresh()
  const id = env.vars.get('entity/spawn')(new Sym('ball'), 0, 0)
  env.vars.get('entity/set-vel!')(id, 3, 4)
  assert.deepEqual(env.vars.get('entity/vel')(id), [3, 4])
})
test('entity/move! is additive', () => {
  const env = fresh()
  const id = env.vars.get('entity/spawn')(new Sym('ball'), 10, 10)
  env.vars.get('entity/move!')(id, 5, -5)
  assert.deepEqual(env.vars.get('entity/pos')(id), [15, 5])
})
test('entity/hp! + entity/damage!', () => {
  const env = fresh()
  const id = env.vars.get('entity/spawn')(new Sym('ball'), 0, 0)
  env.vars.get('entity/hp!')(id, 100)
  const hp = env.vars.get('entity/damage!')(id, 30)
  assert.equal(hp, 70)
})
test('entity/overlaps? true for stacked entities', () => {
  const env = fresh()
  const a = env.vars.get('entity/spawn')(new Sym('a'), 0, 0)
  const b = env.vars.get('entity/spawn')(new Sym('b'), 5, 5)
  assert.equal(env.vars.get('entity/overlaps?')(a, b), true)
})
test('entity/distance', () => {
  const env = fresh()
  const a = env.vars.get('entity/spawn')(new Sym('a'), 0, 0)
  const b = env.vars.get('entity/spawn')(new Sym('b'), 30, 40)
  const d = env.vars.get('entity/distance')(a, b)
  // Distance is between centers (both 16x16 sprites) → 30,40 raw + center offsets cancel
  assert.equal(d, 50)
})

// ── object/spawn (alias) ───────────────────────────────────────────

test('object/spawn adds an entity', () => {
  const env = fresh()
  const id = env.vars.get('object/spawn')(new Sym('rock'), 5, 5)
  assert.ok(typeof id === 'string')
})
test('object/fetch returns alist', () => {
  const env = fresh()
  const id = env.vars.get('object/spawn')(new Sym('rock'), 5, 5)
  const fetched = env.vars.get('object/fetch')(id)
  assert.ok(Array.isArray(fetched))
  assert.ok(fetched.length >= 8)
})

// ── world/ ──────────────────────────────────────────────────────────

test('world/reset! clears entities', () => {
  const env = fresh()
  env.vars.get('world/spawn')(new Sym('ball'), 0, 0)
  env.vars.get('world/reset!')()
  assert.equal(env.vars.get('world/count')(), 0)
})
test('world/step increments frame', () => {
  const env = fresh()
  const f0 = env.vars.get('world/frame')()
  env.vars.get('world/step')()
  const f1 = env.vars.get('world/frame')()
  assert.equal(f1, f0 + 1)
})
test('world/nearest returns different entity', () => {
  const env = fresh()
  const a = env.vars.get('world/spawn')(new Sym('a'), 0, 0)
  const b = env.vars.get('world/spawn')(new Sym('b'), 10, 10)
  const near = env.vars.get('world/nearest')(a)
  assert.equal(near, b)
})
test('world/collisions on overlapping entities', () => {
  const env = fresh()
  env.vars.get('world/spawn')(new Sym('a'), 0, 0)
  env.vars.get('world/spawn')(new Sym('b'), 5, 5)
  const cols = env.vars.get('world/collisions')()
  assert.equal(cols.length, 1)
})
test('world/gravity! sets gravity', () => {
  const env = fresh()
  const r = env.vars.get('world/gravity!')(0.7)
  assert.equal(r, 0.7)
})
test('world/count reflects spawns', () => {
  const env = fresh()
  env.vars.get('world/spawn')(new Sym('a'), 0, 0)
  env.vars.get('world/spawn')(new Sym('b'), 10, 10)
  assert.equal(env.vars.get('world/count')(), 2)
})

// ── grid/ ───────────────────────────────────────────────────────────

test('grid-init allocates', () => {
  const env = fresh()
  assert.deepEqual(env.vars.get('grid-init')(8, 8), [8, 8])
  assert.equal(env.vars.get('grid-cols')(), 8)
  assert.equal(env.vars.get('grid-rows')(), 8)
})
test('grid-cell-set!/cell?', () => {
  const env = fresh()
  env.vars.get('grid-init')(8, 8)
  env.vars.get('grid-cell-set!')(3, 3, true)
  assert.equal(env.vars.get('grid-cell?')(3, 3), true)
  assert.equal(env.vars.get('grid-cell?')(4, 4), false)
})
test('grid-neighbors returns 8', () => {
  const env = fresh()
  env.vars.get('grid-init')(8, 8)
  const n = env.vars.get('grid-neighbors')(3, 3)
  assert.equal(n.length, 8)
})
test('grid-live-count', () => {
  const env = fresh()
  env.vars.get('grid-init')(8, 8)
  env.vars.get('grid-cell-set!')(1, 1, true)
  env.vars.get('grid-cell-set!')(2, 2, true)
  assert.equal(env.vars.get('grid-live-count')(), 2)
})
test('grid/card-center', () => {
  const env = fresh()
  env.vars.get('grid-init')(8, 8)
  env.vars.get('grid-step')(4)
  const c = env.vars.get('grid/card-center')(2, 2)
  assert.deepEqual(c, [10, 10])
})

// ── camera- ─────────────────────────────────────────────────────────

test('camera-set!/x/y', () => {
  const env = fresh()
  env.vars.get('camera-set!')(15, 25, 1.5)
  assert.equal(env.vars.get('camera-x')(), 15)
  assert.equal(env.vars.get('camera-y')(), 25)
})
test('camera-pan is additive', () => {
  const env = fresh()
  env.vars.get('camera-set!')(0, 0)
  env.vars.get('camera-pan')(10, 5)
  assert.equal(env.vars.get('camera-x')(), 10)
})
test('camera-home returns to home', () => {
  const env = fresh()
  env.vars.get('camera-set!')(50, 50)
  env.vars.get('camera-pan')(100, 100)
  env.vars.get('camera-home')()
  assert.equal(env.vars.get('camera-x')(), 50)
})
test('camera-zoom-to', () => {
  const env = fresh()
  env.vars.get('camera-zoom-to')(3)
  const st = env.vars.get('camera-state')()
  const zoom = st.find(e => e[0] === 'zoom')
  assert.equal(zoom[1], 3)
})
