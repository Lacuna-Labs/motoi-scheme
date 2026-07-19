// tests/reconciliation-locked-calls.test.mjs
//
// Coverage for the 5 locked calls from the 2026-07-16 reconciliation:
//
//   1. bounce / slide / fade keyword shapes
//   2. Uniform :duration + :easing on motion verbs
//   3. :easing accepts symbols AND procedures (values from
//      bezier-ease / named-ease / spring-ease)
//   4. Font constants register as :kind "meta" (value-typed handles)
//   5. Physics verbs (on-collision, entity/apply-force!,
//      motion/on-settle) exist in Motoi base
//
// Run: node --test tests/reconciliation-locked-calls.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeExtendedBaseEnv } from '../src/lib-loader.js'
import { resetMediaState, getMediaState } from '../lib/media/media.js'
import { clearTweens } from '../lib/graphics/animation.js'
import { Sym } from '../src/reader.js'

function fresh() {
  resetMediaState()
  clearTweens()
  return makeExtendedBaseEnv()
}

// ── 1. bounce / slide / fade keyword shapes ───────────────────────────

test('bounce — :height + :easing + :duration + :at keyword shape', () => {
  const env = fresh()
  const bounce = env.vars.get('bounce')
  const tw = bounce(
    new Sym(':target'), '🎉',
    new Sym(':height'), 40,
    new Sym(':easing'), new Sym('easing/spring'),
    new Sym(':duration'), 700,
    new Sym(':at'), [50, 60],
  )
  assert.equal(tw.target, '🎉')
  assert.equal(tw._bounceHeight, 40)
  assert.equal(tw.fromY, 60)
  assert.ok(tw.durationFrames > 0)
})

test('slide — :from-side + :duration + :easing keyword shape', () => {
  const env = fresh()
  const slide = env.vars.get('slide')
  assert.ok(slide, 'slide verb registered')

  const twLeft = slide(
    new Sym(':target'), 'hi',
    new Sym(':from-side'), new Sym('left'),
    new Sym(':duration'), 400,
    new Sym(':easing'), new Sym('easing/emphasized'),
    new Sym(':at'), [100, 50],
    new Sym(':distance'), 80,
  )
  assert.equal(twLeft.target, 'hi')
  assert.equal(twLeft._slideSide, 'left')
  // Left slide: start x is at.x - distance = 100 - 80 = 20.
  assert.equal(twLeft.fromX, 20)
  assert.equal(twLeft.toX, 100)

  // Verify all four sides.
  const twTop = slide(
    new Sym(':target'), '🎁',
    new Sym(':from-side'), new Sym('top'),
    new Sym(':at'), [40, 40],
    new Sym(':distance'), 60,
  )
  assert.equal(twTop.fromY, -20)   // 40 - 60
  assert.equal(twTop.toY, 40)

  const twBottom = slide(
    new Sym(':target'), 'x',
    new Sym(':from-side'), new Sym('bottom'),
    new Sym(':at'), [40, 40],
    new Sym(':distance'), 100,
  )
  assert.equal(twBottom.fromY, 140)
})

test('fade — :from + :to + :duration + :easing keyword shape', () => {
  const env = fresh()
  const fade = env.vars.get('fade')
  assert.ok(fade, 'fade verb registered')

  const tw = fade(
    new Sym(':target'), 'welcome',
    new Sym(':from'), 1.0,
    new Sym(':to'), 0.0,
    new Sym(':duration'), 600,
    new Sym(':easing'), new Sym('easing/standard'),
  )
  assert.equal(tw.target, 'welcome')
  assert.equal(tw._fromAlpha, 1.0)
  assert.equal(tw._toAlpha, 0.0)
  assert.equal(tw.alpha, 1.0)

  // Tick partway and confirm alpha crossfades toward :to.
  const tick = env.vars.get('animation/tick')
  const st = getMediaState()
  st.fb.frame = Math.round(tw.durationFrames / 2)
  tick()
  assert.ok(tw.alpha < 1.0 && tw.alpha > 0.0,
    `fade mid-alpha ${tw.alpha} should be strictly between from and to`)

  // Tick past the end; alpha should reach :to.
  st.fb.frame = tw.durationFrames + 10
  tick()
  assert.ok(Math.abs(tw.alpha - 0.0) < 0.05, `alpha at end: ${tw.alpha}`)
})

// ── 2. Uniform :duration + :easing on motion verbs ────────────────────

test('motion/move-to — with :duration animates, without snaps instantly', () => {
  const env = fresh()
  const moveTo = env.vars.get('motion/move-to')
  assert.ok(moveTo, 'motion/move-to registered')

  // Without :duration → instant snap. Returns a completed 1-frame tween.
  const snap = moveTo(
    new Sym(':target'), '🎯',
    new Sym(':x'), 100,
    new Sym(':y'), 200,
  )
  assert.equal(snap.toX, 100)
  assert.equal(snap.toY, 200)
  assert.equal(snap._instant, true)

  // With :duration → animates. durationFrames grows with :duration.
  const anim = moveTo(
    new Sym(':target'), '⭐',
    new Sym(':x'), 50,
    new Sym(':y'), 60,
    new Sym(':from'), [0, 0],
    new Sym(':duration'), 500,
    new Sym(':easing'), new Sym('easing/emphasized'),
  )
  assert.ok(anim.durationFrames > 1, 'animated tween has real duration')
  assert.equal(anim.toX, 50)
  assert.equal(anim.toY, 60)
  assert.equal(anim._instant, undefined)
})

test('entity/rotate! — with :duration animates, without snaps instantly', () => {
  const env = fresh()
  const entityMake = env.vars.get('entity/make')
  const rotate = env.vars.get('entity/rotate!')
  assert.ok(rotate, 'entity/rotate! registered')

  entityMake(new Sym('hero'), 0, 0)
  // Instant snap.
  const okSnap = rotate(new Sym('hero'), 90)
  assert.equal(okSnap, true)

  // Animated (still returns true; a scratch tween is seeded).
  const okAnim = rotate(
    new Sym('hero'), 180,
    new Sym(':duration'), 400,
    new Sym(':easing'), new Sym('easing/spring'),
  )
  assert.equal(okAnim, true)
})

// ── 3. :easing accepts procedures (values from bezier-ease etc.) ──────

test('easing — bezier-ease/named-ease/spring-ease return procedures in curve form', () => {
  const env = fresh()
  const bezier = env.vars.get('bezier-ease')
  const named = env.vars.get('named-ease')
  const spring = env.vars.get('spring-ease')

  // 4-arg bezier-ease returns a curve procedure.
  const curveB = bezier(0.2, 0.0, 0.0, 1.0)
  assert.equal(typeof curveB, 'function')
  assert.equal(curveB(0), 0)
  assert.equal(curveB(1), 1)

  // 1-arg named-ease returns a curve procedure.
  const curveN = named(new Sym('emphasized'))
  assert.equal(typeof curveN, 'function')
  assert.equal(curveN(0), 0)
  assert.equal(curveN(1), 1)

  // 0-arg spring-ease returns a curve procedure.
  const curveS = spring()
  assert.equal(typeof curveS, 'function')
  assert.equal(curveS(0), 0)
})

test('easing — :easing accepts procedures from bezier-ease as first-class values', () => {
  const env = fresh()
  const bezier = env.vars.get('bezier-ease')
  const motion = env.vars.get('motion')
  const moveTo = env.vars.get('motion/move-to')

  // Build a Bezier curve procedure and hand it to :easing.
  const curve = bezier(0.4, 0.0, 0.2, 1.0)

  const tw1 = motion(
    new Sym(':target'), '🎈',
    new Sym(':from'), [0, 0],
    new Sym(':to'), [100, 0],
    new Sym(':duration'), 400,
    new Sym(':easing'), curve,
  )
  assert.equal(typeof tw1.ease, 'function')
  // The curve's midpoint value should transfer through.
  const midDirect = curve(0.5)
  const midThroughTween = tw1.ease(0.5)
  assert.equal(midDirect, midThroughTween,
    'procedure-form easing preserved through motion verb')

  // Same procedure passed to motion/move-to.
  const tw2 = moveTo(
    new Sym(':target'), '🎁',
    new Sym(':x'), 50,
    new Sym(':y'), 60,
    new Sym(':duration'), 300,
    new Sym(':easing'), curve,
  )
  assert.equal(typeof tw2.ease, 'function')
  assert.equal(tw2.ease(0.5), midDirect)
})

// ── 4. Font constants as :kind "meta" ─────────────────────────────────

test('meta — font constants are read-only value handles (Sym)', () => {
  const env = fresh()
  for (const name of ['font/default', 'font/mono', 'font/big', 'font/tiny']) {
    const v = env.vars.get(name)
    assert.ok(v instanceof Sym, `${name} is a Sym`)
  }
  // They are NOT verbs / functions.
  assert.equal(typeof env.vars.get('font/default'), 'object')
})

test('meta — registerPrimitive accepts meta-kind (non-function) registrations', async () => {
  // Prove the shim tolerates a meta-kind binding without throwing.
  const env = fresh()
  const { registerPrimitive } = await import('../lib/system/registry.js')
  const { sym } = await import('../src/reader.js')

  // Register a Sym-valued constant with :kind "meta".
  registerPrimitive(env, 'test/meta-const', sym('sentinel'), {
    perm: 'read', kind: 'meta',
  })
  const v = env.vars.get('test/meta-const')
  assert.ok(v instanceof Sym)
  assert.equal(v.name, 'sentinel')
})

// ── 5. Physics verbs ──────────────────────────────────────────────────

test('physics — on-collision fires per overlapping pair each physics/step', () => {
  const env = fresh()
  const entityMake = env.vars.get('entity/make')
  const setVel = env.vars.get('entity/set-velocity!')
  const onCollision = env.vars.get('on-collision')
  const step = env.vars.get('physics/step')
  assert.ok(onCollision, 'on-collision registered')

  // Two overlapping entities.
  entityMake(new Sym('a'), 0, 0, 16, 16)
  entityMake(new Sym('b'), 8, 8, 16, 16)   // overlaps a

  const hits = []
  onCollision((x, y) => {
    hits.push([x instanceof Sym ? x.name : x, y instanceof Sym ? y.name : y])
  })
  // Stop them drifting so the overlap holds.
  setVel(new Sym('a'), 0, 0)
  setVel(new Sym('b'), 0, 0)

  step()
  assert.ok(hits.length >= 1, `expected at least one collision, got ${hits.length}`)
  const pair = hits[0]
  assert.ok(
    (pair[0] === 'a' && pair[1] === 'b') ||
    (pair[0] === 'b' && pair[1] === 'a'),
    `pair should be (a, b) in either order, got ${JSON.stringify(pair)}`
  )
})

test('physics — entity/apply-force! adds impulse to entity velocity', () => {
  const env = fresh()
  const entityMake = env.vars.get('entity/make')
  const applyForce = env.vars.get('entity/apply-force!')
  const state = env.vars.get('entity/state')
  assert.ok(applyForce, 'entity/apply-force! registered')

  entityMake(new Sym('hero'), 0, 0)
  applyForce(new Sym('hero'), 3, -2)
  const s = state(new Sym('hero'))
  // (id x y vx vy w h)
  assert.equal(s[3], 3, 'vx += 3')
  assert.equal(s[4], -2, 'vy += -2')

  // Also works on tween records (same tween semantics as physics/apply-force).
  const motion = env.vars.get('motion')
  const tw = motion(
    new Sym(':target'), '💧',
    new Sym(':from'), [10, 20],
    new Sym(':to'), [10, 20],
    new Sym(':duration'), 500,
  )
  applyForce(tw, 5, 0)
  assert.equal(tw.toX, 15)
})

test('physics — motion/on-settle fires on tween completion', () => {
  const env = fresh()
  const motion = env.vars.get('motion')
  const onSettle = env.vars.get('motion/on-settle')
  const tick = env.vars.get('animation/tick')
  assert.ok(onSettle, 'motion/on-settle registered')

  const tw = motion(
    new Sym(':target'), '🎊',
    new Sym(':from'), [0, 0],
    new Sym(':to'), [40, 40],
    new Sym(':duration'), 100,
    new Sym(':easing'), new Sym('linear'),
  )
  let settled = null
  onSettle(tw, (x) => { settled = x })

  const st = getMediaState()
  // Advance the frame counter past the tween's duration.
  st.fb.frame = tw.durationFrames + 5
  tick()
  assert.equal(settled, tw, 'on-settle handler was invoked with the tween')

  // Called exactly once.
  settled = null
  st.fb.frame = tw.durationFrames + 15
  tick()
  assert.equal(settled, null, 'on-settle fires exactly once')
})

test('physics — motion/on-settle fires when an entity comes to rest', () => {
  const env = fresh()
  const entityMake = env.vars.get('entity/make')
  const setVel = env.vars.get('entity/set-velocity!')
  const onSettle = env.vars.get('motion/on-settle')
  const step = env.vars.get('physics/step')
  const physicsGravity = env.vars.get('physics/gravity!')
  const physicsFriction = env.vars.get('physics/friction!')

  // No gravity, extremely high friction — one step brings the entity
  // from moving to at-rest.
  physicsGravity(0)
  physicsFriction(0)   // instant velocity kill

  entityMake(new Sym('slider'), 100, 100)
  setVel(new Sym('slider'), 5, 5)

  let seen = null
  onSettle(new Sym('slider'), (id) => { seen = id })

  step()
  assert.ok(seen instanceof Sym, 'settle callback fired with entity id')
  assert.equal(seen.name, 'slider')
})
