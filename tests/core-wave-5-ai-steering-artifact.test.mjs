// tests/core-wave-5-ai-steering-artifact.test.mjs
//
// Wave 5 — ai/steering, artifact/, cortex/read+write.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Sym } from '../src/reader.js'
import { makeCoreEnv } from '../core/index.js'

function fresh() { return makeCoreEnv() }

// ── ai/steering ─────────────────────────────────────────────────

test('ai/seek returns vector toward target', () => {
  const env = fresh()
  const v = env.vars.get('ai/seek')([0, 0], [10, 0], 1)
  assert.equal(v[0], 1)
})
test('ai/flee returns vector away from target', () => {
  const env = fresh()
  const v = env.vars.get('ai/flee')([0, 0], [10, 0], 1)
  assert.equal(v[0], -1)
})
test('ai/arrive slows near target', () => {
  const env = fresh()
  const v = env.vars.get('ai/arrive')([0, 0], [5, 0], 1, 10)
  assert.ok(v[0] > 0 && v[0] < 1)
})
test('ai/utility normalizes to 0..1', () => {
  const env = fresh()
  assert.equal(env.vars.get('ai/utility')(5, 0, 10), 0.5)
})
test('ai/decide picks highest weight', () => {
  const env = fresh()
  assert.equal(env.vars.get('ai/decide')(['a', 'b', 'c'], [0.1, 0.9, 0.5]), 'b')
})
test('ai/align returns avg velocity', () => {
  const env = fresh()
  const v = env.vars.get('ai/align')([[1, 0], [1, 0]], 5)
  assert.equal(v[0], 1)
})
test('ai/cohere targets centroid', () => {
  const env = fresh()
  const v = env.vars.get('ai/cohere')([0, 0], [[10, 0], [10, 0]], 5)
  assert.equal(v[0], 5)
})

// ── ai/bt- ──────────────────────────────────────────────────────

test('ai/bt-action returns success on truthy', () => {
  const env = fresh()
  const node = env.vars.get('ai/bt-action')(() => true)
  const r = env.vars.get('ai/bt-tick')(node)
  assert.equal(r.name, 'success')
})
test('ai/bt-action returns failure on falsy', () => {
  const env = fresh()
  const node = env.vars.get('ai/bt-action')(() => false)
  const r = env.vars.get('ai/bt-tick')(node)
  assert.equal(r.name, 'failure')
})
test('ai/bt-sequence all-pass returns success', () => {
  const env = fresh()
  const a = env.vars.get('ai/bt-action')(() => true)
  const seq = env.vars.get('ai/bt-sequence')(a, a)
  assert.equal(env.vars.get('ai/bt-tick')(seq).name, 'success')
})
test('ai/bt-selector any-pass returns success', () => {
  const env = fresh()
  const bad = env.vars.get('ai/bt-action')(() => false)
  const good = env.vars.get('ai/bt-action')(() => true)
  const sel = env.vars.get('ai/bt-selector')(bad, good)
  assert.equal(env.vars.get('ai/bt-tick')(sel).name, 'success')
})

// ── ai/bb- ──────────────────────────────────────────────────────

test('ai/bb-set!/get!', () => {
  const env = fresh()
  env.vars.get('ai/bb-set!')(new Sym('foo'), 42)
  assert.equal(env.vars.get('ai/bb-get')(new Sym('foo')), 42)
})
test('ai/bb-has?', () => {
  const env = fresh()
  env.vars.get('ai/bb-set!')(new Sym('bar'), 1)
  assert.equal(env.vars.get('ai/bb-has?')(new Sym('bar')), true)
})
test('ai/bb-del!', () => {
  const env = fresh()
  env.vars.get('ai/bb-set!')(new Sym('baz'), 1)
  assert.equal(env.vars.get('ai/bb-del!')(new Sym('baz')), true)
  assert.equal(env.vars.get('ai/bb-has?')(new Sym('baz')), false)
})

// ── audio (CORE surface only) ───────────────────────────────────

test('audio/tempo returns 120 default', () => {
  const env = fresh()
  assert.equal(env.vars.get('audio/tempo')(), 120)
})
// audio/master-volume is ratified "(audio/master-volume volume) -> zero-duration
// AudioHandle" (scheme/reference/07-audio.slat:365). It is a SETTER only — the
// entry's :drawbacks say outright: "There is no query verb to read the current
// master volume; you must track it in your context if you need to know the
// current level." The old "set + get" test called it nullary expecting 0.5 back;
// that getter has never been ratified and does not exist. Updated 2026-08-01 to
// assert the ratified return: an audio handle.
test('audio/master-volume returns an audio handle', () => {
  const env = fresh()
  const h = env.vars.get('audio/master-volume')(0.5)
  assert.ok(h && h.__audioHandle, 'expected a zero-duration AudioHandle')
  assert.equal(h.__audioHandle.name, 'master')
})
// audio/halt is ratified "(audio/halt handle) → zero-duration AudioHandle"
// (scheme/reference/07-audio.slat:101); its novice example is
// "(let ((h (audio-play \"ambient\"))) (audio/halt h))" — a handle goes IN.
// The old test called it with no handle at all and expected a symbol 'ok, which
// the reference never mentions. Updated 2026-08-01 to the ratified round-trip.
test('audio/halt returns an audio handle', () => {
  const env = fresh()
  const playing = env.vars.get('audio/play')('ambient')
  const r = env.vars.get('audio/halt')(playing)
  assert.ok(r && r.__audioHandle, 'expected a zero-duration AudioHandle')
})
// note/strike is ratified "(note/strike pitch duration) -> null"
// (scheme/reference/43-note.slat:113), pitch as a SYMBOL — its novice example
// is "(note/strike 'c4 1.0)". The old test expected a symbol 'ok, which the
// signature contradicts, and passed the pitch as a JS string. Updated
// 2026-08-01 to the ratified call and the ratified null return.
test('note/strike sounds a pitch and returns null', () => {
  const env = fresh()
  assert.equal(env.vars.get('note/strike')(new Sym('c4'), 1.0), undefined)
})
// synth/chord is ratified "(synth/chord section pitches [duration [dynamic
// [articulation]]]) -> handle | [status info-dict]" (scheme/reference/
// 62-synth.slat:100). SECTION comes first — the novice example is
// "(synth/chord 'strings '(C4 E4 G4))". The old test omitted the section
// entirely (passing the pitch list as the section) and expected 'ok, which the
// signature does not offer. Updated 2026-08-01 to assert the ratified info-dict
// echoes back the section and duration it was given.
test('synth/chord returns an info-dict for the section played', () => {
  const env = fresh()
  const r = env.vars.get('synth/chord')(new Sym('strings'), [new Sym('C4'), new Sym('E4'), new Sym('G4')], 2.0)
  assert.ok(Array.isArray(r))
  const entry = k => r.find(e => String(e[0]) === k)
  assert.equal(String(entry(':kind')[1]), 'chord')
  assert.equal(String(entry(':section')[1]), 'strings')
  assert.equal(entry(':duration')[1], 2.0)
})
// synth/kit is ratified "(synth/kit name pattern [voice]) -> handle | [status
// info-dict]" (scheme/reference/62-synth.slat:166): name is the KIT
// ('electronic, 'acoustic), pattern is a binary string where "1 = strike, 0 =
// rest", and the voice ('kick) is the optional THIRD argument. The old test
// passed 'kick as the kit name and 0 as the pattern, and expected 'ok. Updated
// 2026-08-01 to the reference's own novice example — "(synth/kit 'electronic
// \"1000100010001000\" 'kick)", a four-on-the-floor kick — whose documented
// meaning fixes the expected hits at steps 0, 4, 8, 12 of 16.
test('synth/kit plays a pattern on a named kit', () => {
  const env = fresh()
  const r = env.vars.get('synth/kit')(new Sym('electronic'), '1000100010001000', new Sym('kick'))
  assert.ok(Array.isArray(r))
  const entry = k => r.find(e => String(e[0]) === k)
  assert.equal(String(entry(':name')[1]), 'electronic')
  assert.equal(String(entry(':voice')[1]), 'kick')
  assert.equal(entry(':steps')[1], 16)
  assert.deepEqual(entry(':hits')[1], [0, 4, 8, 12])
})

// ── artifact/ (writes to ~/.motoi/artifacts) ────────────────────

test('artifact/save round-trip through /cite', () => {
  const env = fresh()
  const p = env.vars.get('artifact/save')('test-verb-completion', 'hello world')
  assert.ok(typeof p === 'string')
  const cite = env.vars.get('artifact/cite')('test-verb-completion')
  assert.ok(Array.isArray(cite))
  env.vars.get('artifact/delete')('test-verb-completion')
})

test('artifact/cite returns #f for missing', () => {
  const env = fresh()
  const r = env.vars.get('artifact/cite')('does-not-exist-9999')
  assert.equal(r, false)
})

// ── cortex/read + /write ────────────────────────────────────────

test('cortex/write then cortex/read round-trip', () => {
  const env = fresh()
  const key = new Sym('test-cortex-key-' + Date.now())
  const ok = env.vars.get('cortex/write')(key, 42)
  assert.equal(ok, true)
  const v = env.vars.get('cortex/read')(key)
  assert.equal(v, 42)
})

test('cortex/read returns #f for missing', () => {
  const env = fresh()
  const r = env.vars.get('cortex/read')(new Sym('nonexistent-' + Math.random()))
  assert.equal(r, false)
})

// ── framebuffer host verbs ──────────────────────────────────────

test('surface-exists? returns boolean', () => {
  const env = fresh()
  assert.equal(typeof env.vars.get('surface-exists?')(), 'boolean')
})
test('pixels-wide is positive', () => {
  const env = fresh()
  assert.ok(env.vars.get('pixels-wide')() > 0)
})
test('viewport returns (w h)', () => {
  const env = fresh()
  const v = env.vars.get('viewport')()
  assert.ok(Array.isArray(v))
  assert.equal(v.length, 2)
})
test('begin-frame + end-frame + on-canvas-trace', () => {
  const env = fresh()
  env.vars.get('begin-frame')()
  const trace = env.vars.get('on-canvas-trace')()
  assert.ok(Array.isArray(trace))
  env.vars.get('end-frame')()
})
test('measure-content returns bbox alist', () => {
  const env = fresh()
  env.vars.get('begin-frame')()
  const bbox = env.vars.get('measure-content')()
  assert.ok(Array.isArray(bbox))
  assert.equal(bbox.length, 4)
})

// ── scheduler ──────────────────────────────────────────────────

test('on-tick returns id', () => {
  const env = fresh()
  const id = env.vars.get('on-tick')(() => 1)
  assert.ok(typeof id === 'number' && id > 0)
})
test('cancel-tick returns boolean', () => {
  const env = fresh()
  const id = env.vars.get('on-tick')(() => 1)
  assert.equal(env.vars.get('cancel-tick')(id), true)
})
test('tempo returns bpm', () => {
  const env = fresh()
  assert.ok(typeof env.vars.get('tempo')() === 'number')
})
test('at-beat returns tagged clause', () => {
  const env = fresh()
  const c = env.vars.get('at-beat')(1, () => 1)
  assert.ok(Array.isArray(c))
})

// ── misc ────────────────────────────────────────────────────────

test('random returns 0..1', () => {
  const env = fresh()
  const r = env.vars.get('random')()
  assert.ok(r >= 0 && r < 1)
})
test('random n scales', () => {
  const env = fresh()
  const r = env.vars.get('random')(100)
  assert.ok(r >= 0 && r < 100)
})
test('with-seed makes random deterministic', () => {
  const env = fresh()
  let capture
  env.vars.get('with-seed')(42, () => { capture = env.vars.get('random')(); return capture })
  env.vars.get('with-seed')(42, () => {
    assert.equal(env.vars.get('random')(), capture)
  })
})
test('key? returns false', () => {
  const env = fresh()
  assert.equal(env.vars.get('key?')(new Sym('a')), false)
})
test('base/make-character returns tagged data', () => {
  const env = fresh()
  const c = env.vars.get('base/make-character')(new Sym('sakura'))
  assert.ok(Array.isArray(c))
  assert.equal(c[0].name, 'character')
})
