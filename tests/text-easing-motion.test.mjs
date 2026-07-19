// tests/text-easing-motion.test.mjs
//
// Smoke tests for the text + easing + animation + physics lane
// (2026-07-16). Covers:
//
//   1. Text seams register (fb/text, text/measure, text/wrap, fonts)
//   2. Emoji strings round-trip through fb/text and land on the overlay
//   3. Easing curves — bezier, named-ease, spring — return sane values
//   4. Motion tweens interpolate through frames
//   5. Bounce is a one-liner (kid-facing API)
//   6. Physics applied to a tween nudges it (60-year-old low-level API)
//   7. Adapter seams — renderText / measureText / wrapText overridable
//   8. Font symbols are Sym-typed constants
//
// Run: node --test tests/text-easing-motion.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeExtendedBaseEnv } from '../src/lib-loader.js'
import { resetMediaState, getMediaState } from '../lib/media/media.js'
import { setAdapters, getAdapters } from '../adapters/base.js'
import {
  bezierEase,
  namedEase,
  springEase,
  NAMED_EASINGS,
} from '../lib/graphics/easing.js'
import {
  addTween,
  tweenState,
  clearTweens,
  getTweens,
} from '../lib/graphics/animation.js'
import { Sym } from '../src/reader.js'

// Reset media between tests so tween & overlay state doesn't leak.
function fresh() {
  resetMediaState()
  clearTweens()
  return makeExtendedBaseEnv()
}

// ── 1. Text seams register ──────────────────────────────────────────

test('text — fb/text, text/measure, text/wrap, and font/* register', () => {
  const env = fresh()
  for (const v of ['fb/text', 'text/measure', 'text/wrap',
                   'text/overlay', 'text/overlay-clear',
                   'font/default', 'font/mono', 'font/big', 'font/tiny']) {
    assert.ok(env.vars.has(v), `missing verb: ${v}`)
  }
  // Font constants are symbols (so users can eq? compare them).
  assert.ok(env.vars.get('font/default') instanceof Sym,
    'font/default is a Sym')
})

// ── 2. fb/text with emoji lands on the overlay ──────────────────────

test('text — fb/text with emoji records to overlay', () => {
  fresh()
  const st = getMediaState()
  const fbText = getAdapters()   // spy checkpoint
  // Call fb/text directly through env, bypass parse for speed.
  const env = makeExtendedBaseEnv()
  const draw = env.vars.get('fb/text')
  draw('🎉', 10, 20, 'red', 'default')
  draw('hi', 30, 40, 'blue')
  const overlay = env.vars.get('text/overlay')()
  assert.equal(overlay.length, 2)
  assert.equal(overlay[0].str, '🎉')
  assert.equal(overlay[0].x, 10)
  assert.equal(overlay[0].y, 20)
  assert.equal(overlay[1].str, 'hi')
  assert.equal(overlay[1].font, 'default')
})

// ── 3. Easing curves return sensible values ─────────────────────────

test('easing — bezier-ease boundary + midpoint', () => {
  // (0,0) → (1,1) with linear controls == linear
  assert.equal(bezierEase(0, 0, 0, 1, 1), 0)
  assert.equal(bezierEase(1, 0, 0, 1, 1), 1)
  // Emphasized: standard Google Material — mid should be past 0.5
  const y = bezierEase(0.5, 0.2, 0, 0, 1)
  assert.ok(y > 0.5, `emphasized(0.5) = ${y} should overshoot linear`)
  assert.ok(y < 1.0, `emphasized(0.5) = ${y} bounded above`)
})

test('easing — named-ease dispatch (emphasized, spring, linear)', () => {
  assert.equal(namedEase(0, 'linear'), 0)
  assert.equal(namedEase(1, 'linear'), 1)
  const emp = namedEase(0.5, 'emphasized')
  assert.ok(emp > 0.5)
  // Symbol form works too.
  const empSym = namedEase(0.5, new Sym('emphasized'))
  assert.equal(emp.toFixed(4), empSym.toFixed(4))
  // Full 'easing/xxx form.
  const empFull = namedEase(0.5, 'easing/emphasized')
  assert.equal(emp.toFixed(4), empFull.toFixed(4))
})

test('easing — spring settles near 1 by t=1', () => {
  // Default spring: mass=1, tension=170, friction=26.
  const settled = springEase(1)
  // Should settle very close to 1 (may overshoot slightly on the way).
  assert.ok(Math.abs(settled - 1) < 0.05,
    `spring(1) = ${settled}, should settle near 1`)
  assert.equal(springEase(0), 0)
})

test('easing — NAMED_EASINGS table has all 10 curves', () => {
  const names = ['emphasized', 'standard', 'decelerated', 'accelerated',
                 'linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out',
                 'spring']
  for (const n of names) {
    assert.ok(n in NAMED_EASINGS, `missing named easing: ${n}`)
  }
})

// ── 4. Motion tween interpolates ────────────────────────────────────

test('motion — text tween interpolates from A to B', () => {
  fresh()
  const env = makeExtendedBaseEnv()
  const motion = env.vars.get('motion')
  const tick = env.vars.get('animation/tick')
  // (motion "😊" :from (0 0) :to (100 100) :duration 100 :easing 'linear)
  const tween = motion(
    new Sym(':target'), '😊',
    new Sym(':from'), [0, 0],
    new Sym(':to'), [100, 100],
    new Sym(':duration'), 100,    // 100ms @ 60fps ≈ 6 frames
    new Sym(':easing'), new Sym('linear'),
  )
  assert.ok(tween, 'motion returned a tween record')
  assert.equal(tween.target, '😊')
  assert.equal(tween.fromX, 0)
  assert.equal(tween.toX, 100)
  // Advance a few frames; the framebuffer's `frame` counter needs to
  // move for the tween to progress — poke it directly.
  const st = getMediaState()
  st.fb.frame = 3
  tick()
  // At frame 3 of 6 with linear ease, we should be ~half-way.
  const mid = tweenState(tween, 3)
  assert.ok(Math.abs(mid.x - 50) < 20, `mid x ${mid.x} ≈ 50`)
  st.fb.frame = 100
  const end = tweenState(tween, 100)
  assert.equal(end.done, true)
  assert.equal(end.x, 100)
  assert.equal(end.y, 100)
})

// ── 5. Bounce is a kid-friendly one-liner ───────────────────────────

test('bounce — one-call, one-emoji, spring by default', () => {
  fresh()
  const env = makeExtendedBaseEnv()
  const bounce = env.vars.get('bounce')
  const tick = env.vars.get('animation/tick')
  // (bounce "🎉" :height 100)
  const tw = bounce(
    new Sym(':target'), '🎉',
    new Sym(':height'), 100,
    new Sym(':at'), [40, 60],
  )
  assert.equal(tw.target, '🎉')
  assert.equal(tw._bounceHeight, 100)
  assert.equal(tw.fromY, 60)
  // Tick and confirm the overlay has the emoji at the peak height.
  const st = getMediaState()
  st.fb.frame = Math.round(tw.durationFrames / 2)   // peak of sin arc
  tick()
  const overlay = env.vars.get('text/overlay')()
  assert.ok(overlay.length > 0, 'bounce painted the emoji')
  assert.equal(overlay[overlay.length - 1].str, '🎉')
  // At the peak the y should be well above the base y (60).
  const last = overlay[overlay.length - 1]
  assert.ok(last.y < 60,
    `y at peak = ${last.y}, should be well above 60 (up)`)
})

// ── 6. Physics applied to a tween nudges the tween ──────────────────

test('physics — apply-gravity + apply-force operate on a text tween', () => {
  fresh()
  const env = makeExtendedBaseEnv()
  const motion = env.vars.get('motion')
  const applyGravity = env.vars.get('physics/apply-gravity')
  const applyForce = env.vars.get('physics/apply-force')

  const tween = motion(
    new Sym(':target'), '💧',
    new Sym(':from'), [100, 20],
    new Sym(':to'), [100, 20],
    new Sym(':duration'), 500,
  )
  const initialToY = tween.toY
  applyGravity(tween, 5)
  assert.ok(tween.toY > initialToY,
    `gravity moved toY down (${initialToY} → ${tween.toY})`)

  const initialToX = tween.toX
  applyForce(tween, 10, 0)
  assert.equal(tween.toX, initialToX + 10, 'apply-force shifted toX')
})

test('physics — apply-force + apply-gravity still work on entities', () => {
  fresh()
  const env = makeExtendedBaseEnv()
  const entityMake = env.vars.get('entity/make')
  const applyForce = env.vars.get('physics/apply-force')
  const applyGravity = env.vars.get('physics/apply-gravity')
  const state = env.vars.get('entity/state')

  entityMake(new Sym('hero'), 0, 0)
  applyForce(new Sym('hero'), 5, -3)
  const s1 = state(new Sym('hero'))
  // (id x y vx vy w h)
  assert.equal(s1[3], 5, 'vx += 5')
  assert.equal(s1[4], -3, 'vy += -3')
  applyGravity(new Sym('hero'), 2)
  const s2 = state(new Sym('hero'))
  assert.equal(s2[4], -1, 'gravity added 2 to vy (from -3 to -1)')
})

// ── 7. Adapter seams — renderText / measureText / wrapText overridable ─

test('adapters — renderText/measureText/wrapText overridable via setAdapters', () => {
  fresh()
  let seen = null
  const prev = getAdapters()
  setAdapters({
    renderText: (s, x, y, c, f) => { seen = { s, x, y, c, f } },
    measureText: (s) => ({ width: String(s).length * 10, height: 12 }),
    wrapText:    (s) => [String(s), 'wrapped'],
  })
  try {
    const env = makeExtendedBaseEnv()
    env.vars.get('fb/text')('hi', 5, 6, 'blue', 'mono')
    assert.deepEqual(seen, { s: 'hi', x: 5, y: 6, c: 'blue', f: 'mono' },
      'renderText override called with the right args')

    const [w, h] = env.vars.get('text/measure')('four')
    assert.equal(w, 40, 'measureText override: 4 chars × 10px')
    assert.equal(h, 12)

    const lines = env.vars.get('text/wrap')('any string', 80)
    assert.deepEqual(lines, ['any string', 'wrapped'])
  } finally {
    // Restore defaults so we don't pollute later tests.
    setAdapters({
      renderText: () => {},
      measureText: (s) => ({ width: String(s ?? '').length * 6, height: 8 }),
      wrapText: prev.wrapText,
    })
  }
})

// ── 8. Composition: kid-API + adult-API share the same runtime ──────

test('composition — kid one-liner and adult low-level share verbs', () => {
  fresh()
  const env = makeExtendedBaseEnv()
  // Kid: (bounce "🎈") — one call.
  const kidTween = env.vars.get('bounce')(
    new Sym(':target'), '🎈',
  )
  assert.ok(kidTween, 'kid API returned a tween')

  // Adult: same primitives, more control.
  const adultTween = env.vars.get('motion')(
    new Sym(':target'), '⭐',
    new Sym(':from'), [10, 10],
    new Sym(':to'), [90, 90],
    new Sym(':duration'), 400,
    new Sym(':easing'), new Sym('easing/emphasized'),
  )
  assert.ok(adultTween)

  // Both tweens live in the same registry — animation/tick advances both.
  const all = env.vars.get('animation/tweens')()
  assert.equal(all.length, 2, 'both tweens registered')

  // The 60-year-old builds up a physics sim by composing primitives:
  //   (bezier-ease t x1 y1 x2 y2)
  //   (spring-ease t opts)
  //   (physics/apply-force target fx fy)
  const bez = env.vars.get('bezier-ease')(0.5, 0.2, 0, 0, 1)
  assert.ok(bez > 0.5 && bez < 1, 'bezier-ease still exposed as primitive')

  env.vars.get('physics/apply-force')(adultTween, 5, 5)
  assert.equal(adultTween.toX, 95, 'physics still nudges the composed tween')
})
