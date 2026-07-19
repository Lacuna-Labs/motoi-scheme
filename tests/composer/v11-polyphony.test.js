// tests/composer/v11-polyphony.test.js
//
// Composer v1.1 — 16-voice polyphony + voice-16 mixer tests.
//
// Alfred, 2026-07-17: v2 audio design proposed 8 voices; v1.1 bumps to
// 16 and makes voice 16 the MIXER — "mix them together and form other
// ones, like, compose them together."
//
// Round-trip must be preserved. The emitted Scheme MUST show the mix
// explicitly so save/load preserves routing.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeCoreEnv } from '../../core/index.js'
import { evaluate } from '../../src/interp.js'
import { parse } from '../../src/reader.js'
import { formatForm } from '../../lib/composer/composer.js'

function freshEnv() {
  const fuel = { n: 1_000_000 }
  return { env: makeCoreEnv({ fuel }), fuel }
}

function evalSrc(env, fuel, src) {
  const forms = parse(src)
  let out
  for (const f of forms) out = evaluate(f, env, fuel)
  return out
}

// ── song/config ────────────────────────────────────────────────────

test('v11 — song/config default voices is 16', () => {
  const { env, fuel } = freshEnv()
  const cfg = evalSrc(env, fuel, '(song/config)')
  assert.equal(cfg.kind, 'song-config')
  assert.equal(cfg.voices, 16)
  assert.equal(cfg.voiceSteal, 'oldest')
})

test('v11 — song/config :voices 16 :voice-steal oldest', () => {
  const { env, fuel } = freshEnv()
  const cfg = evalSrc(env, fuel, "(song/config :voices 16 :voice-steal (quote oldest) :bpm 120)")
  assert.equal(cfg.voices, 16)
  assert.equal(cfg.voiceSteal, 'oldest')
  assert.equal(cfg.bpm, 120)
})

test('v11 — song/config clamps voices > 16 with warning', () => {
  const { env, fuel } = freshEnv()
  const cfg = evalSrc(env, fuel, '(song/config :voices 32)')
  assert.equal(cfg.voices, 16, 'clamped to 16')
  assert.ok(cfg.warnings.length > 0, 'warning attached')
  assert.ok(cfg.warnings[0].includes('clamped'), 'warning mentions clamp')
})

// ── composer/voice-pool widget ─────────────────────────────────────

test('v11 — composer/voice-pool creates 16-voice bank with mixer at 16', () => {
  const { env, fuel } = freshEnv()
  const pool = evalSrc(env, fuel, "(composer/voice-pool :bind (quote (song :voices)) :steal (quote oldest))")
  assert.equal(pool.kind, 'voice-pool')
  assert.equal(pool.state.voices.length, 16)
  // Voice 1..15 are individual slots
  for (let i = 0; i < 15; i++) {
    assert.equal(pool.state.voices[i].instrument, null, `voice ${i + 1} starts free`)
  }
  // Voice 16 (index 15) is the mixer
  assert.ok(Array.isArray(pool.state.voices[15].mixes), 'voice 16 has mixes list')
  assert.equal(pool.state.voices[15].mixes.length, 0, 'mixer starts empty')
})

// ── voice/mix + voice/compose ──────────────────────────────────────

test('v11 — voice/mix combines voice ids into a record', () => {
  const { env, fuel } = freshEnv()
  const mix = evalSrc(env, fuel, "(voice/mix (quote (1 2 3 4)))")
  assert.equal(mix.kind, 'voice-mix')
  assert.deepEqual(mix.voices, [1, 2, 3, 4])
  assert.equal(mix.gain, 1.0)
})

test('v11 — voice/compose is an alias for voice/mix', () => {
  const { env, fuel } = freshEnv()
  const mix = evalSrc(env, fuel, "(voice/compose (quote (5 6 7)) 0.75)")
  assert.equal(mix.kind, 'voice-mix')
  assert.deepEqual(mix.voices, [5, 6, 7])
  assert.equal(mix.gain, 0.75)
})

test('v11 — voice/mix rejects out-of-range voice ids', () => {
  const { env, fuel } = freshEnv()
  // 0 is invalid, 16 is the mixer itself (can't self-reference), 20 is out of range.
  const mix = evalSrc(env, fuel, "(voice/mix (quote (0 1 16 20 5)))")
  assert.deepEqual(mix.voices, [1, 5], 'only valid ids 1..15 survive')
})

// ── voice-pool mutation ────────────────────────────────────────────

test('v11 — composer/voice-assign puts an instrument in a slot', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (define pool (composer/voice-pool :bind (quote (song :v))))
    (composer/voice-assign pool 3 (quote lead))
    pool
  `
  const pool = evalSrc(env, fuel, src)
  assert.equal(pool.state.voices[2].instrument, 'lead')
})

test('v11 — composer/voice-mix-set writes the mixer routing', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (define pool (composer/voice-pool :bind (quote (song :v))))
    (composer/voice-mix-set pool (quote (1 2 3)))
    pool
  `
  const pool = evalSrc(env, fuel, src)
  assert.deepEqual(pool.state.voices[15].mixes, [1, 2, 3])
})

// ── round-trip — voice-pool emit/apply preserves routing ───────────

test('v11 — voice-pool round-trips through emit/apply, mix intact', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (song)))
      (composer/voice-pool :bind (quote (song :voices)) :steal (quote oldest)))
  `
  const canvas = evalSrc(env, fuel, src)
  const pool = canvas.children[0]
  // Set the mixer routing.
  const setter = env.get('composer/voice-mix-set')
  setter(pool, [1, 2, 5, 8])
  // Emit → apply → emit is identity.
  const emit = env.get('composer/emit')
  const apply = env.get('composer/apply')
  const before = emit(canvas)
  apply(canvas, before)
  const after = emit(canvas)
  assert.equal(formatForm(after), formatForm(before),
    'voice-pool round-trip drift')
  // The emitted form MUST contain the mix explicitly.
  const beforeStr = formatForm(before)
  assert.ok(beforeStr.includes('composer/voice-pool'),
    `emit includes widget: ${beforeStr.slice(0, 200)}`)
  assert.ok(beforeStr.includes('1 2 5 8'),
    `emit shows mix explicitly: ${beforeStr}`)
})

// ── property: repeated emit/apply is stable ────────────────────────

test('v11 — voice-pool is a fixed point of (emit ∘ apply) after 5 iters', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (song)))
      (composer/voice-pool :bind (quote (song :voices)) :steal (quote quietest)))
  `
  const canvas = evalSrc(env, fuel, src)
  env.get('composer/voice-mix-set')(canvas.children[0], [2, 4, 6, 8, 10])
  const emit = env.get('composer/emit')
  const apply = env.get('composer/apply')
  const t0 = formatForm(emit(canvas))
  for (let i = 0; i < 5; i++) apply(canvas, emit(canvas))
  const tN = formatForm(emit(canvas))
  assert.equal(tN, t0, 'no drift after 5 apply cycles')
})
