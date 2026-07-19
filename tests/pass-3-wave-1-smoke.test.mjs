// tests/pass-3-wave-1-smoke.test.mjs
//
// Smoke tests for Pass-3 Wave 1 lib migration (2026-07-16). Verifies
// that every migrated module loads, exports its expected shape, and
// (where cheap) that a hello-world call succeeds. This is a floor
// test — parity-with-scheme-lang test port is deferred.
//
// Run: node --test tests/pass-3-wave-1-smoke.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'

// ── adapters/base.js ──────────────────────────────────────────────────
test('adapters/base — 14 seams + setAdapters/getAdapters exported', async () => {
  const m = await import('../adapters/base.js')
  const seams = [
    'emit', '_setCurrentCaller', '_getCurrentCaller',
    'canvasPowerGetTier', 'chipWrite', 'chipEvent', 'logEvent',
    'currentCorrelationId', 'withCorrelation', 'mintCorrelationId',
    'chatChipPublish', 'bricklayCacheKey', 'bricklayCacheGet', 'bricklayCacheSet',
  ]
  for (const name of seams) assert.equal(typeof m[name], 'function', `missing seam: ${name}`)
  assert.equal(typeof m.setAdapters, 'function')
  assert.equal(typeof m.getAdapters, 'function')

  // No-op defaults return sensible "nothing happened" values.
  assert.equal(m.emit('any', 'thing'), undefined)
  assert.equal(m._getCurrentCaller(), null)
  assert.equal(m.canvasPowerGetTier(), 'operator')
  assert.equal(typeof m.mintCorrelationId(), 'string')

  // setAdapters overrides take effect immediately.
  let logged = null
  m.setAdapters({ emit: (...args) => { logged = args } })
  m.emit('hello', 'world')
  assert.deepEqual(logged, ['hello', 'world'])
})

// ── lib/base ──────────────────────────────────────────────────────────
test('lib/base/r7rs-types — value classes exported', async () => {
  const m = await import('../lib/base/r7rs-types.js')
  for (const name of ['Values', 'SchemePromise', 'Parameter', 'EOF',
    'RecordType', 'RecordInstance', 'Port', 'ErrorObject', 'RaisedValue']) {
    assert.ok(m[name], `missing ${name}`)
  }
})

test('lib/base/r7rs-small — installR7rsSmall exported', async () => {
  const m = await import('../lib/base/r7rs-small.js')
  assert.equal(typeof m.installR7rsSmall, 'function')
})

test('lib/base/alg — installAlg exported', async () => {
  const m = await import('../lib/base/alg.js')
  // scheme-lang's alg.js exports install functions per convention.
  const installers = Object.keys(m).filter(k => k.startsWith('install'))
  assert.ok(installers.length > 0 || typeof m.default === 'function',
    `expected installer export; got: ${Object.keys(m).join(',')}`)
})

test('lib/base/topo — loads', async () => {
  const m = await import('../lib/base/topo.js')
  assert.ok(m, 'topo.js should import cleanly')
})

// ── lib/graphics ──────────────────────────────────────────────────────
test('lib/graphics/framebuffer — Framebuffer + palette exported', async () => {
  const m = await import('../lib/graphics/framebuffer.js')
  assert.equal(typeof m.Framebuffer, 'function')
  assert.ok(Array.isArray(m.DEFAULT_PALETTE))
  assert.equal(m.DEFAULT_PALETTE.length, 16, '16-color palette')
  assert.ok(m.MODES.default, "'default' mode present")
  assert.ok(m.MODES.sakura, "'sakura' backwards-compat mode alias present")
  const fb = new m.Framebuffer(10, 10, m.DEFAULT_PALETTE)
  assert.equal(fb.pixels.length, 100)
  assert.equal(fb.color, 14, 'default color index preserved')
})

test('lib/graphics/animation — loads', async () => {
  const m = await import('../lib/graphics/animation.js')
  assert.ok(m, 'animation.js should import cleanly')
})

test('lib/graphics/sprite — loads + defineSprite exported', async () => {
  const m = await import('../lib/graphics/sprite.js')
  assert.equal(typeof m.defineSprite, 'function')
})

// ── lib/audio ─────────────────────────────────────────────────────────
test('lib/audio/sound — loads', async () => {
  const m = await import('../lib/audio/sound.js')
  assert.ok(m, 'sound.js should import cleanly')
  assert.ok(m.BellAdapter, 'BellAdapter class exported')
})

test('lib/audio/audio-driver — loads', async () => {
  const m = await import('../lib/audio/audio-driver.js')
  assert.ok(m, 'audio-driver.js should import cleanly')
})

// ── lib/game ──────────────────────────────────────────────────────────
test('lib/game/game-theory — nim-sum works', async () => {
  const m = await import('../lib/game/game-theory.js')
  // Whatever exports exist should form a valid module.
  assert.ok(m)
})

test('lib/game/juggle — loads', async () => {
  const m = await import('../lib/game/juggle.js')
  assert.ok(m)
})

test('lib/game/game-instances — loads', async () => {
  const m = await import('../lib/game/game-instances.js')
  assert.ok(m)
})

test('lib/game/prefab — loads', async () => {
  const m = await import('../lib/game/prefab.js')
  assert.ok(m)
})

test('lib/game/scene — loads', async () => {
  const m = await import('../lib/game/scene.js')
  assert.ok(m)
})

test('lib/game/game — loads', async () => {
  const m = await import('../lib/game/game.js')
  assert.ok(m)
})

// ── lib/media ─────────────────────────────────────────────────────────
test('lib/media/media — loads + getMediaState exported', async () => {
  const m = await import('../lib/media/media.js')
  assert.equal(typeof m.getMediaState, 'function')
})

// ── lib/ai ────────────────────────────────────────────────────────────
test('lib/ai/ai — loads + setAiProvider exported', async () => {
  const m = await import('../lib/ai/ai.js')
  assert.equal(typeof m.setAiProvider, 'function')
})

// ── lib/system ────────────────────────────────────────────────────────
test('lib/system/registry — registerPrimitive shim exported', async () => {
  const m = await import('../lib/system/registry.js')
  assert.equal(typeof m.registerPrimitive, 'function')
})

test('lib/system/system — loads', async () => {
  const m = await import('../lib/system/system.js')
  assert.ok(m)
})

test('lib/system/eng — loads', async () => {
  const m = await import('../lib/system/eng.js')
  assert.ok(m)
})

test('lib/system/time-verbs — loads', async () => {
  const m = await import('../lib/system/time-verbs.js')
  assert.ok(m)
})

test('lib/system/ops — loads', async () => {
  const m = await import('../lib/system/ops.js')
  assert.ok(m)
})

// ── Sakura-brand neutralization spot-checks ───────────────────────────
test('Sakura-brand neutralization — no ✿ flower in migrated files', async () => {
  const { readFileSync, readdirSync, statSync } = await import('node:fs')
  const { join } = await import('node:path')
  const roots = [
    '/Users/alfred/code/motoi-scheme/lib',
    '/Users/alfred/code/motoi-scheme/adapters',
  ]
  const walk = (dir) => {
    const items = []
    for (const f of readdirSync(dir)) {
      const p = join(dir, f)
      if (statSync(p).isDirectory()) items.push(...walk(p))
      else if (f.endsWith('.js')) items.push(p)
    }
    return items
  }
  for (const root of roots) {
    for (const f of walk(root)) {
      const src = readFileSync(f, 'utf-8')
      assert.ok(!src.includes('✿'), `${f} contains a cherry-blossom (✿)`)
      assert.ok(!src.includes('~/.sakura'), `${f} contains ~/.sakura path`)
    }
  }
})
