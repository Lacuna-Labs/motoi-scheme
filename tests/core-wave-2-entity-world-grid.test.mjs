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

// entity/spawn is ratified as "(entity/spawn kind x y) -> entity" —
// scheme/reference/24-entity.slat:2711, :impl-status "wired",
// :impl-file "lib/game/world.js". Its :impl-notes read: "returns the entity
// object (displays as [object Object] — never assert its raw display; feed it
// to an accessor)" and "the first spawn in a fresh process gets id 1". The old
// `typeof id === 'string'` assertion contradicted that. Updated 2026-08-01 to
// assert through the accessors the reference names.
test('entity/spawn returns an entity handle, entity/pos matches', () => {
  const env = fresh()
  const id = env.vars.get('entity/spawn')(new Sym('ball'), 10, 20)
  assert.equal(typeof id, 'object')
  assert.equal(env.vars.get('entity/id')(id), 1)
  assert.equal(String(env.vars.get('entity/kind')(id)), 'ball')
  assert.deepEqual(env.vars.get('entity/pos')(id), [10, 20])
})
test('entity/alive? #t after spawn', () => {
  const env = fresh()
  const id = env.vars.get('entity/spawn')(new Sym('ball'), 0, 0)
  assert.equal(env.vars.get('entity/alive?')(id), true)
})
// entity/despawn! is ratified "-> void" (scheme/reference/24-entity.slat:318);
// the reference's own novice example checks the effect via entity/alive?, not
// a return value. The old `=== true` return assertion was never ratified.
// Updated 2026-08-01. The alive? effect check below is the real contract.
test('entity/despawn! removes entity', () => {
  const env = fresh()
  const id = env.vars.get('entity/spawn')(new Sym('ball'), 0, 0)
  assert.equal(env.vars.get('entity/despawn!')(id), undefined)
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
// entity/damage! is ratified "(entity/damage! id hp-loss) -> void"
// (scheme/reference/24-entity.slat:262) — it does NOT return the remaining hp.
// The reference reads health back through an accessor afterwards, and its
// entity/hp! example fixes the formula: 50 hp, two 10-damage calls, "boss is
// now at 30 HP". By that formula 100 - 30 = 70. Updated 2026-08-01 to assert
// the ratified formula through the entity/hp accessor.
test('entity/hp! + entity/damage!', () => {
  const env = fresh()
  const id = env.vars.get('entity/spawn')(new Sym('ball'), 0, 0)
  env.vars.get('entity/hp!')(id, 100)
  env.vars.get('entity/damage!')(id, 30)
  assert.equal(env.vars.get('entity/hp')(id), 70)
  assert.equal(env.vars.get('entity/alive?')(id), true)
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

// object/spawn is ratified "(object/spawn target [at: p] [scale: s]
// [colour: k]) -> symbol" (scheme/reference/46-object.slat:71) — the position
// arrives as the KEYWORD `at:`, not as bare positionals, and the summary is
// "Instantiate a specific named object into the scene". The old test passed
// `5, 5` positionally (silently dropped, object landed at 0,0) and asserted a
// string id. Updated 2026-08-01 to the ratified keyword form and to assert the
// scene effect both reference and code agree on.
//
// TWO OPEN ITEMS reported, deliberately NOT papered over here:
//  (a) Return type. The reference says these return a symbol ('ok — see the
//      :row-2-audit note "Fetch returns 'ok, not an ID"), but
//      lib/game/composer.js:383,391 delegate to entity/spawn and return the
//      entity object. Code and reference disagree.
//  (b) Keyword spelling. 46-object.slat writes keywords with a TRAILING colon
//      ('at: 'class:) in all 17 of its call sites, but parseArgs
//      (lib/game/composer.js:35) — and every other keyword parser in lib/ —
//      recognises only the LEADING-colon form (:at). Called the way the
//      reference is written, the position is silently dropped and the object
//      lands at (0 0), violating that chapter's own row-4 invariant
//      "spawned object's position equals the requested position".
// These tests use the engine-wide :at form so they assert real behaviour
// rather than encoding either side of the conflict. See the lane report.
test('object/spawn adds an entity to the scene', () => {
  const env = fresh()
  env.vars.get('object/spawn')(new Sym('rock'), new Sym(':at'), [5, 5])
  assert.equal(env.vars.get('world/count')(), 1)
  assert.deepEqual(env.vars.get('entity/pos')(env.vars.get('world/find')(new Sym('rock'))[0]), [5, 5])
})
test('object/fetch instantiates by class', () => {
  const env = fresh()
  env.vars.get('object/fetch')(new Sym(':class'), new Sym('rock'), new Sym(':at'), [5, 5])
  assert.equal(env.vars.get('world/count')(), 1)
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
// world/collisions is ratified as reading the buffer that world/step fills:
// "After world/step completes, this reads the collision buffer... The buffer is
// cleared at the start of each step, so collisions only live for one frame"
// (scheme/reference/72-world.slat:445). The old test read the buffer without
// ever stepping, so it could only ever see 0. Step added 2026-08-01.
test('world/collisions on overlapping entities', () => {
  const env = fresh()
  env.vars.get('world/spawn')(new Sym('a'), 0, 0)
  env.vars.get('world/spawn')(new Sym('b'), 5, 5)
  env.vars.get('world/step')()
  const cols = env.vars.get('world/collisions')()
  assert.equal(cols.length, 1)
  assert.equal(cols[0].length, 2)
})
// world/gravity! is ratified "(world/gravity! gx gy) -> void" — a TWO-arg
// vector, no return value (scheme/reference/72-world.slat:802; novice example
// "(world/gravity! 0 0.5)"). The old test passed one arg and asserted a return
// value; neither is ratified. The reference defines the observable instead:
// "Every frame, gravity applies a constant acceleration to all entities...
// in world units per frame squared" — so after one step a dynamic body's
// vy is exactly gy. Updated 2026-08-01 to assert that.
test('world/gravity! sets gravity', () => {
  const env = fresh()
  const p = env.vars.get('world/spawn')(new Sym('player'), 0, 0)
  assert.equal(env.vars.get('world/gravity!')(0, 0.7), undefined)
  env.vars.get('world/step')()
  assert.deepEqual(env.vars.get('entity/vel')(p), [0, 0.7])
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
// camera-home is ratified as returning to the ORIGIN, not to the last
// camera-set! position: "Reset the camera view to a neutral starting state —
// centered at world origin (0, 0) with scale 1.0" (scheme/reference/
// 01-core.slat:933). The old test expected 50 (the previously-set position),
// a "home = last set point" notion the reference never ratified. Updated
// 2026-08-01 to the ratified origin-and-scale-1 contract.
test('camera-home returns to home', () => {
  const env = fresh()
  env.vars.get('camera-set!')(50, 50, 1.5)
  env.vars.get('camera-pan')(100, 100)
  env.vars.get('camera-home')()
  assert.equal(env.vars.get('camera-x')(), 0)
  assert.equal(env.vars.get('camera-y')(), 0)
  assert.equal(env.vars.get('camera-scale')(), 1)
})
// camera-zoom-to's ratified reader is camera-scale — the reference's own
// intermediate example is "(let ((current-scale (camera-scale))) ...)"
// (scheme/reference/01-core.slat:1331). There is no 'zoom key in camera-state;
// the scale field is spelled 'k ("sometimes called `k` internally", same
// entry). The old test looked up a 'zoom key that has never existed and threw.
// Updated 2026-08-01 to read through camera-scale.
test('camera-zoom-to', () => {
  const env = fresh()
  env.vars.get('camera-zoom-to')(3)
  assert.equal(env.vars.get('camera-scale')(), 3)
  const st = env.vars.get('camera-state')()
  const k = st.find(e => String(e[0]) === 'k')
  assert.equal(k[1], 3)
})
