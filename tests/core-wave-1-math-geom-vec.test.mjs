// tests/core-wave-1-math-geom-vec.test.mjs
//
// Wave 1 CORE completion — math, geom, vec, tick, const, time.
// Verifies every new verb is registered AND returns sensible values.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeCoreEnv } from '../core/index.js'
import { Sym } from '../src/reader.js'

function fresh() { return makeCoreEnv() }

// ── const/ ─────────────────────────────────────────────────────────

for (const name of ['const/pi', 'const/tau', 'const/e', 'const/phi']) {
  test(`${name} — registered`, () => {
    const env = fresh()
    assert.equal(typeof env.vars.get(name), 'function')
  })
}

test('const/pi ≈ Math.PI', () => {
  const env = fresh()
  assert.equal(env.vars.get('const/pi')(), Math.PI)
})
test('const/tau ≈ 2π', () => {
  const env = fresh()
  assert.equal(env.vars.get('const/tau')(), Math.PI * 2)
})
test('const/e ≈ Math.E', () => {
  const env = fresh()
  assert.equal(env.vars.get('const/e')(), Math.E)
})
test('const/phi ≈ golden ratio', () => {
  const env = fresh()
  const v = env.vars.get('const/phi')()
  assert.ok(Math.abs(v - 1.618033988749895) < 1e-12)
})

// ── math/basic ─────────────────────────────────────────────────────

test('math/sqrt 144 = 12', () => {
  const env = fresh()
  assert.equal(env.vars.get('math/sqrt')(144), 12)
})
test('math/lerp 0..10 at 0.5 = 5', () => {
  const env = fresh()
  assert.equal(env.vars.get('math/lerp')(0, 10, 0.5), 5)
})
test('math/hypot 3,4 = 5', () => {
  const env = fresh()
  assert.equal(env.vars.get('math/hypot')(3, 4), 5)
})
test('math/gcd 24,36 = 12', () => {
  const env = fresh()
  assert.equal(env.vars.get('math/gcd')(24, 36), 12)
})
test('math/lcm 4,6 = 12', () => {
  const env = fresh()
  assert.equal(env.vars.get('math/lcm')(4, 6), 12)
})
test('math/sum list', () => {
  const env = fresh()
  assert.equal(env.vars.get('math/sum')([1, 2, 3, 4, 5]), 15)
})
test('math/avg list', () => {
  const env = fresh()
  assert.equal(env.vars.get('math/avg')([2, 4, 6]), 4)
})
test('math/pct 25/100', () => {
  const env = fresh()
  assert.equal(env.vars.get('math/pct')(25, 100), 25)
})
test('math/compare', () => {
  const env = fresh()
  assert.equal(env.vars.get('math/compare')(1, 2), -1)
  assert.equal(env.vars.get('math/compare')(2, 1), 1)
  assert.equal(env.vars.get('math/compare')(1, 1), 0)
})
test('math/clamp', () => {
  const env = fresh()
  assert.equal(env.vars.get('math/clamp')(5, 0, 3), 3)
  assert.equal(env.vars.get('math/clamp')(-1, 0, 3), 0)
})
test('math/square+cube', () => {
  const env = fresh()
  assert.equal(env.vars.get('math/square')(4), 16)
  assert.equal(env.vars.get('math/cube')(3), 27)
})
test('math/pow', () => {
  const env = fresh()
  assert.equal(env.vars.get('math/pow')(2, 10), 1024)
})

// ── math/pedagogy ──────────────────────────────────────────────────

test('math/area-model 3x4 tagged with product', () => {
  const env = fresh()
  const r = env.vars.get('math/area-model')(3, 4)
  assert.ok(Array.isArray(r))
  assert.equal(r[3], 12)
})
test('math/count-on from 5, 4 steps', () => {
  const env = fresh()
  assert.deepEqual(env.vars.get('math/count-on')(5, 4), [5, 6, 7, 8])
})
test('math/expanded-form 132', () => {
  const env = fresh()
  assert.deepEqual(env.vars.get('math/expanded-form')(132), [100, 30, 2])
})
test('math/place-value 1234, 2 = 200', () => {
  const env = fresh()
  assert.equal(env.vars.get('math/place-value')(1234, 2), 200)
})
test('math/digit-at 1234, 2 = 2', () => {
  const env = fresh()
  assert.equal(env.vars.get('math/digit-at')(1234, 2), 2)
})
test('math/skip-count 0 by 3, 5 times', () => {
  const env = fresh()
  assert.deepEqual(env.vars.get('math/skip-count')(0, 3, 5), [0, 3, 6, 9, 12])
})

// ── geom/ ───────────────────────────────────────────────────────────

test('geom/point x y', () => {
  const env = fresh()
  assert.deepEqual(env.vars.get('geom/point')(3, 4), [3, 4])
})
test('geom/distance 0,0 to 3,4 = 5', () => {
  const env = fresh()
  assert.equal(env.vars.get('geom/distance')([0, 0], [3, 4]), 5)
})
test('geom/midpoint', () => {
  const env = fresh()
  assert.deepEqual(env.vars.get('geom/midpoint')([0, 0], [4, 6]), [2, 3])
})
test('geom/circle-area 5 ≈ π·25', () => {
  const env = fresh()
  assert.ok(Math.abs(env.vars.get('geom/circle-area')(5) - Math.PI * 25) < 1e-12)
})
test('geom/->degrees(pi) = 180', () => {
  const env = fresh()
  assert.equal(env.vars.get('geom/->degrees')(Math.PI), 180)
})
test('geom/triangle-area 4x3 right = 6', () => {
  const env = fresh()
  assert.equal(env.vars.get('geom/triangle-area')([0, 0], [4, 0], [0, 3]), 6)
})

// ── vec/ ────────────────────────────────────────────────────────────

test('vec/add', () => {
  const env = fresh()
  assert.deepEqual(env.vars.get('vec/add')([1, 2], [3, 4]), [4, 6])
})
test('vec/dot', () => {
  const env = fresh()
  assert.equal(env.vars.get('vec/dot')([1, 2], [3, 4]), 11)
})
test('vec/norm 3,4 = 5', () => {
  const env = fresh()
  assert.equal(env.vars.get('vec/norm')([3, 4]), 5)
})
test('vec/normalize', () => {
  const env = fresh()
  const r = env.vars.get('vec/normalize')([3, 4])
  assert.ok(Math.abs(r[0] - 0.6) < 1e-12)
  assert.ok(Math.abs(r[1] - 0.8) < 1e-12)
})
test('vec/lerp 0..10 at 0.5', () => {
  const env = fresh()
  assert.deepEqual(env.vars.get('vec/lerp')([0, 0], [10, 10], 0.5), [5, 5])
})
test('vec/zero 3 = (0 0 0)', () => {
  const env = fresh()
  assert.deepEqual(env.vars.get('vec/zero')(3), [0, 0, 0])
})

// ── tick/ ───────────────────────────────────────────────────────────

test('tick/sine 0 = 0', () => {
  const env = fresh()
  assert.equal(env.vars.get('tick/sine')(0), 0)
})
test('tick/sine 0.25 = 1', () => {
  const env = fresh()
  assert.ok(Math.abs(env.vars.get('tick/sine')(0.25) - 1) < 1e-12)
})
test('tick/pulse at 0.3, 0.5 duty = 1', () => {
  const env = fresh()
  assert.equal(env.vars.get('tick/pulse')(0.3, 0.5), 1)
})
test('tick/pulse at 0.7, 0.5 duty = 0', () => {
  const env = fresh()
  assert.equal(env.vars.get('tick/pulse')(0.7, 0.5), 0)
})
test('tick/ease at 0.5 = 0.5', () => {
  const env = fresh()
  assert.equal(env.vars.get('tick/ease')(0.5), 0.5)
})
test('tick/phase 3, 2 = 0.5', () => {
  const env = fresh()
  assert.equal(env.vars.get('tick/phase')(3, 2), 0.5)
})

// ── time/ (Wave 1 additions) ───────────────────────────────────────

test('time/now returns a positive number', () => {
  const env = fresh()
  const v = env.vars.get('time/now')()
  assert.ok(v > 0)
})
test('time/iso returns ISO string', () => {
  const env = fresh()
  const s = env.vars.get('time/iso')()
  assert.ok(typeof s === 'string')
  assert.ok(s.includes('T'))
})
test('time/to-ms 1 minute = 60000', () => {
  const env = fresh()
  assert.equal(env.vars.get('time/to-ms')(1, new Sym('m')), 60000)
})
