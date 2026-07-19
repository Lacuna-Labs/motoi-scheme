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
test('audio/master-volume set + get', () => {
  const env = fresh()
  env.vars.get('audio/master-volume')(0.5)
  assert.equal(env.vars.get('audio/master-volume')(), 0.5)
})
test('audio/halt returns ok', () => {
  const env = fresh()
  const r = env.vars.get('audio/halt')()
  assert.equal(r.name, 'ok')
})
test('note/strike returns ok', () => {
  const env = fresh()
  const r = env.vars.get('note/strike')('C4', 0.1)
  assert.equal(r.name, 'ok')
})
test('synth/chord returns ok', () => {
  const env = fresh()
  const r = env.vars.get('synth/chord')(['C4', 'E4', 'G4'], 0.1)
  assert.equal(r.name, 'ok')
})
test('synth/kit kick returns ok', () => {
  const env = fresh()
  const r = env.vars.get('synth/kit')(new Sym('kick'), 0)
  assert.equal(r.name, 'ok')
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
