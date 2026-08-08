// tests/core-wave-3-motion-part-animation.test.mjs
//
// Wave 3 — motion, part (composer gesture/timing planners), animation-budget.
//
// REBASELINED 2026-08-01 (bucket 1, stale-by-design). This file previously
// asserted the semantics of the RIPPED Curator client stubs
// `lib/game/motion.js` + `lib/game/part.js` (archived 2026-07-25 to
// scratch/attic/curator-verbs-ripped-2026-07-25/game/), in which
//   · motion/halt zeroed an entity's velocity
//   · part/wave was curried: (part/wave amp) -> (lambda (phase) ...)
//
// Both are now wrong on three independent authorities:
//   1. lib/game/composer.js header (dated 2026-07-25): "Replaces the ripped
//      Curator character-rig client stubs (part/*, motion/*, ...) with genuine
//      parametric planners."
//   2. scheme/reference/48-part.slat — part/* signatures are
//      `(part/wave sprite [options]) -> effect`, never curried phase functions;
//      prose: "Part verbs are motion specifications, not imperative commands."
//   3. scheme/reference/42-motion.slat — `(motion/halt target) -> null`, and
//      the :caveats say explicitly "Motion/halt does not reset the entity's
//      velocity to zero in the physics engine; use entity/set-vel! ...".
//
// Assertions below are derived from the reference signatures and from the
// documented curve formulas, NOT read back off current output.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Sym } from '../src/reader.js'
import { makeCoreEnv } from '../core/index.js'

import { plain } from './_cells.mjs'
function fresh() {
  const env = makeCoreEnv()
  env.vars.get('world/reset!')()
  return env
}

// ── motion-spec readers ────────────────────────────────────────────
// A composer motion-spec is an alist of [keyword-Sym, value] rows.

// These readers walk the spec with JS array methods. A Scheme list is a chain
// of cons cells now, so each one converts the SPELLING at its entry (`plain`,
// tests/_cells.mjs) and asserts exactly what it asserted before.
const specGet = (spec, key) => {
  const rows = plain(spec)
  assert.ok(Array.isArray(rows), 'motion-spec should be an alist')
  const row = rows.find((r) => r[0] instanceof Sym && r[0].name === ':' + key)
  return row ? row[1] : undefined
}
const kindOf = (spec) => specGet(spec, 'kind').name
const channelOf = (spec, name) => {
  const rows = specGet(spec, 'channels') ?? []
  const row = rows.find((r) => r[0] instanceof Sym && r[0].name === name)
  assert.ok(row, `spec should carry a '${name}' channel`)
  return row[1]
}
const peakOf = (curve) => Math.max(...plain(curve).map(([, v]) => Math.abs(v)))
const atFrame = (curve, i) => plain(curve)[i][1]

// ── motion/ — timing planners (reference: 42-motion.slat) ──────────

test('motion/halt returns null and is idempotent', () => {
  const env = fresh()
  // A gesture registers a spec against the target; halt cancels it.
  env.vars.get('part/wave')(new Sym('hero'))
  // reference :signature "(motion/halt target) -> null"
  assert.equal(env.vars.get('motion/halt')(new Sym('hero')), undefined)
  // reference :summary "... Idempotent." — a second halt is a safe no-op.
  assert.equal(env.vars.get('motion/halt')(new Sym('hero')), undefined)
})

test('motion/halt does NOT zero entity velocity (reference caveat)', () => {
  const env = fresh()
  const id = env.vars.get('entity/spawn')(new Sym('ball'), 0, 0)
  env.vars.get('entity/set-vel!')(id, 10, 10)
  env.vars.get('motion/halt')(id)
  // 42-motion.slat :caveats — "Motion/halt does not reset the entity's
  // velocity to zero in the physics engine; use entity/set-vel! if you need
  // to clear inertia." This test pins that documented boundary.
  assert.deepEqual(plain(env.vars.get('entity/vel')(id)), [10, 10])
  // ...and entity/set-vel! IS the documented way to clear it.
  env.vars.get('entity/set-vel!')(id, 0, 0)
  assert.deepEqual(plain(env.vars.get('entity/vel')(id)), [0, 0])
})

test('motion/drop returns a beat-aligned articulation spec', () => {
  const env = fresh()
  // reference: (motion/drop [targetBeat] [totalBeats])
  const s = env.vars.get('motion/drop')(1, 4)
  assert.equal(kindOf(s), 'drop')
  assert.equal(specGet(s, 'target-beat'), 1)
  assert.equal(specGet(s, 'total-beats'), 4)
  // Gaussian articulation peaks at u = targetBeat/totalBeats = 0.25.
  const cv = specGet(s, 'curve')
  let best = 0
  for (let i = 1; i < cv.length; i++) if (cv[i][1] > cv[best][1]) best = i
  const u = best / (cv.length - 1)
  assert.ok(Math.abs(u - 0.25) < 0.02, `articulation peaks at beat 1 of 4 (u=${u})`)
})

test('motion/arc extracts intensity peaks from a motion tensor', () => {
  const env = fresh()
  // reference: (motion/arc tensor-id) -> {kind:'arc', ok: bool, ...}
  // 12 frames makes the wave's peak land exactly on a sampled frame.
  const tensor = env.vars.get('part/wave')(
    new Sym('hero'), new Sym(':amplitude'), 4, new Sym(':frames'), 12,
  )
  const s = env.vars.get('motion/arc')(tensor)
  assert.equal(kindOf(s), 'arc')
  assert.equal(specGet(s, 'ok'), true)
  const peaks = specGet(s, 'peaks')
  assert.equal(peaks.length, 1, 'one channel (hand-wave) → one peak')
  // hand-wave = amplitude · sin(u·6π); peak magnitude is the amplitude.
  assert.ok(Math.abs(peaks[0][1] - 4) < 1e-9)
})

test('motion/arc reports ok=#f for a tensor with no channels', () => {
  const env = fresh()
  const s = env.vars.get('motion/arc')(env.vars.get('motion/cadence')(120, 1))
  assert.equal(kindOf(s), 'arc')
  assert.equal(specGet(s, 'ok'), false)
})

test('motion/follow-input returns an honest binding spec', () => {
  const env = fresh()
  // composer.js header: "verbs that need a capability the deterministic
  // runtime lacks (live sensor input) return an honest binding spec, never a
  // faked reading."
  const s = env.vars.get('motion/follow-input')(new Sym('e1'), new Sym('mouse-position'))
  assert.equal(kindOf(s), 'follow-input')
  assert.equal(specGet(s, 'target').name, 'e1')
  assert.equal(specGet(s, 'sensor-field').name, 'mouse-position')
  assert.equal(specGet(s, 'bound'), true)
})

test('motion/with-feel applies an articulation to a tensor', () => {
  const env = fresh()
  const tensor = env.vars.get('part/nod')()
  // reference: (motion/with-feel tensor-id :articulation style) -> descriptor
  const stac = env.vars.get('motion/with-feel')(
    tensor, new Sym(':articulation'), new Sym('staccato'),
  )
  assert.equal(kindOf(stac), 'with-feel')
  assert.equal(specGet(stac, 'articulation').name, 'staccato')
  assert.equal(specGet(stac, 'sustain-factor'), 0.5)
  // legato sustains longer than staccato — that ordering is the whole point.
  const leg = env.vars.get('motion/with-feel')(
    tensor, new Sym(':articulation'), new Sym('legato'),
  )
  assert.equal(specGet(leg, 'sustain-factor'), 1.4)
  assert.ok(specGet(leg, 'sustain-factor') > specGet(stac, 'sustain-factor'))
})

test('motion/with-pace modulates speed by intensity', () => {
  const env = fresh()
  const tensor = env.vars.get('part/nod')()
  // reference: (motion/with-pace tensor-id :intensity level) -> descriptor
  const slow = env.vars.get('motion/with-pace')(tensor, new Sym(':intensity'), 0)
  const fast = env.vars.get('motion/with-pace')(tensor, new Sym(':intensity'), 2)
  assert.equal(kindOf(slow), 'with-pace')
  assert.equal(specGet(slow, 'intensity'), 0)
  assert.equal(specGet(slow, 'speed-scale'), 0.5)
  assert.equal(specGet(fast, 'speed-scale'), 2.5)
  assert.ok(specGet(fast, 'speed-scale') > specGet(slow, 'speed-scale'))
})

// ── part/ — gesture planners (reference: 48-part.slat) ─────────────
//
// The reference partitions part/* into three arities. Each group is tested
// for the shape the reference gives it, plus a real (non-degenerate) curve —
// composer.js doctrine: "a gesture ... is a real, inspectable KEYFRAME CURVE".

// Group 1 — reference `(part/X) -> void`: nullary, fixed curve.
for (const [name, channel, frames] of [
  ['part/lower', 'arm-pitch', 14],
  ['part/nod', 'head-pitch', 12],
  ['part/point', 'arm-extend', 12],
  ['part/raise', 'arm-pitch', 14],
  ['part/reach', 'arm-extend', 16],
  ['part/shake', 'head-yaw', 20],
  ['part/shrug', 'shoulder-lift', 16],
  ['part/step', 'foot-cycle', 24],
]) {
  test(`${name} — emits a ${frames}-frame ${channel} gesture spec`, () => {
    const env = fresh()
    const s = env.vars.get(name)()
    assert.equal(kindOf(s), 'gesture')
    assert.equal(specGet(s, 'gesture').name, name.split('/')[1])
    assert.equal(specGet(s, 'frames'), frames)
    const cv = channelOf(s, channel)
    assert.equal(cv.length, frames + 1, 'curve samples frames+1 points')
    // Math.abs normalises IEEE −0 (part/lower is −90·u, so frame 0 is −0).
    assert.equal(Math.abs(atFrame(cv, 0)), 0, 'curve starts at rest')
    assert.ok(peakOf(cv) > 0, 'curve is non-degenerate — a real motion')
  })
}

// Group 2 — reference `(part/X sprite [options]) -> effect`: parametric.
for (const [name, channel] of [
  ['part/sway', 'torso-roll'],
  ['part/tilt', 'head-roll'],
  ['part/turn', 'body-yaw'],
  ['part/twist', 'torso-yaw'],
  ['part/wave', 'hand-wave'],
]) {
  test(`${name} — takes a sprite and honours :amplitude / :frames`, () => {
    const env = fresh()
    const s = env.vars.get(name)(
      new Sym('hero'), new Sym(':amplitude'), 3, new Sym(':frames'), 12,
    )
    assert.equal(kindOf(s), 'gesture')
    assert.equal(specGet(s, 'sprite').name, 'hero', 'sprite is echoed into the spec')
    assert.equal(specGet(s, 'amplitude'), 3)
    assert.equal(specGet(s, 'frames'), 12)
    const cv = channelOf(s, channel)
    assert.equal(cv.length, 13)
    assert.ok(peakOf(cv) > 0)
  })
}

// Group 3 — reference `-> motion-spec`: (sprite + named params).
test('part/bow — depth and angle drive spine-pitch and head-yaw', () => {
  const env = fresh()
  // reference: (part/bow [sprite] [depth] [angle] [hold]) -> motion-spec
  const s = env.vars.get('part/bow')(new Sym('hero'), 10, 45, 6)
  assert.equal(specGet(s, 'gesture').name, 'bow')
  assert.equal(specGet(s, 'depth'), 10)
  assert.equal(specGet(s, 'angle'), 45)
  assert.equal(specGet(s, 'hold'), 6)
  assert.equal(specGet(s, 'frames'), 30, 'frames = 24 + hold')
  // head-yaw holds the constant offset angle for the whole gesture.
  for (const [, v] of channelOf(s, 'head-yaw')) assert.equal(v, 45)
  // spine-pitch bends forward then releases back toward rest.
  const spine = channelOf(s, 'spine-pitch')
  assert.equal(atFrame(spine, 0), 0)
  assert.ok(peakOf(spine) > 0)
  assert.ok(Math.abs(spine[spine.length - 1][1]) < 1e-9, 'bow self-releases to rest')
})

test('part/breathe — a looping chest-scale around 1.0', () => {
  const env = fresh()
  // reference: (part/breathe [sprite] [pace] [depth]) -> motion-spec
  const s = env.vars.get('part/breathe')(new Sym('hero'), 12, 4)
  assert.equal(specGet(s, 'gesture').name, 'breathe')
  assert.equal(specGet(s, 'pace'), 12)
  assert.equal(specGet(s, 'depth'), 4)
  assert.equal(specGet(s, 'frames'), 24, 'frames = pace * 2')
  assert.equal(specGet(s, 'loop'), true, 'breathing is a loop')
  // chest-scale = 1 + (depth/100)·sin(u·2π) — a scale factor, so centred on 1.
  const cv = channelOf(s, 'chest-scale')
  assert.equal(atFrame(cv, 0), 1)
  for (const [, v] of cv) assert.ok(Math.abs(v - 1) <= 0.04 + 1e-9)
})

test('part/expression — a 6-frame crossfade into a named expression', () => {
  const env = fresh()
  // reference: (part/expression [sprite] expression-name) -> motion-spec
  const s = env.vars.get('part/expression')(new Sym('hero'), new Sym('joy'))
  assert.equal(specGet(s, 'gesture').name, 'expression')
  assert.equal(specGet(s, 'expression').name, 'joy')
  assert.equal(specGet(s, 'frames'), 6)
  const cv = channelOf(s, 'face')
  assert.equal(atFrame(cv, 0), 0, 'crossfade starts at the old face')
  assert.equal(atFrame(cv, 6), 1, 'crossfade ends fully on the new one')
})

test('part/grasp — grip style selects the hand-close curve', () => {
  const env = fresh()
  // reference: (part/grasp [sprite] [grip-style] [target]) -> motion-spec
  const firm = env.vars.get('part/grasp')(new Sym('hero'), new Sym('firm'))
  const soft = env.vars.get('part/grasp')(new Sym('hero'), new Sym('gentle'))
  assert.equal(specGet(firm, 'grip').name, 'firm')
  assert.equal(specGet(soft, 'grip').name, 'gentle')
  // A firm grip closes further than a gentle one.
  assert.ok(peakOf(channelOf(firm, 'hand-close')) > peakOf(channelOf(soft, 'hand-close')))
})

test('part/lean — direction picks the sign of body-roll', () => {
  const env = fresh()
  // reference: (part/lean [sprite] [direction] [angle]) -> motion-spec
  const left = env.vars.get('part/lean')(new Sym('hero'), new Sym('left'), 12)
  const right = env.vars.get('part/lean')(new Sym('hero'), new Sym('right'), 12)
  assert.equal(specGet(left, 'direction').name, 'left')
  assert.equal(specGet(left, 'angle'), -12, 'left leans negative')
  assert.equal(specGet(right, 'angle'), 12, 'right leans positive')
  assert.ok(atFrame(channelOf(left, 'body-roll'), 16) < 0)
  assert.ok(atFrame(channelOf(right, 'body-roll'), 16) > 0)
})

test('part/look-toward — orients head and eyes at a target', () => {
  const env = fresh()
  // reference: (part/look-toward [sprite] [target]) -> motion-spec
  const s = env.vars.get('part/look-toward')(new Sym('hero'), new Sym('camera'))
  assert.equal(specGet(s, 'gesture').name, 'look-toward')
  assert.equal(specGet(s, 'target').name, 'camera')
  assert.equal(specGet(s, 'frames'), 10)
  // eye-track ramps 0→1 over the gesture; head-yaw turns with it.
  const eye = channelOf(s, 'eye-track')
  assert.equal(atFrame(eye, 0), 0)
  assert.equal(atFrame(eye, 10), 1)
  assert.equal(atFrame(channelOf(s, 'head-yaw'), 10), 20)
})

// ── the curve math itself (replaces the old curried-function checks) ──
// Each expected value is derived from the formula in lib/game/composer.js,
// which the reference describes as "a real, inspectable KEYFRAME CURVE".

test('part/wave amp=2 peaks at 2 (a·sin(u·6π))', () => {
  const env = fresh()
  const s = env.vars.get('part/wave')(
    new Sym('hero'), new Sym(':amplitude'), 2, new Sym(':frames'), 12,
  )
  const cv = channelOf(s, 'hand-wave')
  // u = 1/12 → sin(6π/12) = sin(π/2) = 1 → exactly the amplitude.
  assert.ok(Math.abs(atFrame(cv, 1) - 2) < 1e-12)
  assert.ok(Math.abs(peakOf(cv) - 2) < 1e-12)
})

test('part/nod peaks at 18 mid-gesture (18·sin(u·π))', () => {
  const env = fresh()
  const cv = channelOf(env.vars.get('part/nod')(), 'head-pitch')
  assert.ok(Math.abs(atFrame(cv, 6) - 18) < 1e-12, 'u=0.5 → sin(π/2)=1')
  assert.ok(Math.abs(atFrame(cv, 12)) < 1e-12, 'returns to rest')
})

test('part/turn amp=3 reaches 6·a·u at the end (body-yaw)', () => {
  const env = fresh()
  const s = env.vars.get('part/turn')(
    new Sym('hero'), new Sym(':amplitude'), 3, new Sym(':frames'), 20,
  )
  const cv = channelOf(s, 'body-yaw')
  assert.ok(Math.abs(atFrame(cv, 10) - 9) < 1e-12, 'u=0.5 → 3·6·0.5 = 9')
  assert.ok(Math.abs(atFrame(cv, 20) - 18) < 1e-12, 'u=1 → 3·6 = 18')
})

test('part/raise sweeps arm-pitch 0→90 (90·u)', () => {
  const env = fresh()
  const cv = channelOf(env.vars.get('part/raise')(), 'arm-pitch')
  assert.ok(Math.abs(atFrame(cv, 7) - 45) < 1e-12, 'u=0.5 → 45')
  assert.ok(Math.abs(atFrame(cv, 14) - 90) < 1e-12, 'u=1 → 90')
})

test('part/lower mirrors part/raise (−90·u)', () => {
  const env = fresh()
  const cv = channelOf(env.vars.get('part/lower')(), 'arm-pitch')
  assert.ok(Math.abs(atFrame(cv, 7) + 45) < 1e-12, 'u=0.5 → −45')
  assert.ok(Math.abs(atFrame(cv, 14) + 90) < 1e-12, 'u=1 → −90')
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
