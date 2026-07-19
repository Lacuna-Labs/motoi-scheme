// tests/composer/round-trip.test.js
//
// Composer round-trip tests. Every widget kind must satisfy the
// identity:
//
//   (composer/apply c (composer/emit c))  ≡  c
//
// as observed by comparing (composer/emit) BEFORE vs AFTER a re-apply.
// If any widget's emit + apply pair drifts, the composer's round-trip
// guarantee is broken and no cart round-trips cleanly.
//
// Fixtures per spec:
//   - 4-slider synth patch
//   - 12-note piano-roll
//   - 8×8 sprite
//   - text-field + toggle + button combination

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeCoreEnv } from '../../core/index.js'
import { evaluate } from '../../src/interp.js'
import { parse, Sym } from '../../src/reader.js'
import {
  installComposer,
  deepEqual, formatForm,
  sliderSet, pianoRollPlace, spriteGridSet, tileMapSet,
  timelinePlace, adsrSet, pickerChoose, fxChainAdd,
  textFieldSet, toggleSet, colorPickerSet,
} from '../../lib/composer/composer.js'

// Fresh env per test — carts share no state.
function freshEnv() {
  const fuel = { n: 1_000_000 }
  return { env: makeCoreEnv({ fuel }), fuel }
}

// Evaluate a source string, return the last value.
function evalSrc(env, fuel, src) {
  const forms = parse(src)
  let out
  for (const f of forms) out = evaluate(f, env, fuel)
  return out
}

// Round-trip helper: emit, apply the emitted form back, emit again,
// assert both emitted forms are structurally identical. This is the
// core identity check the spec demands.
function assertRoundTrip(env, canvas, label) {
  const emit = env.get('composer/emit')
  const apply = env.get('composer/apply')
  const before = emit(canvas)
  apply(canvas, before)
  const after = emit(canvas)
  const beforeStr = formatForm(before)
  const afterStr = formatForm(after)
  assert.equal(afterStr, beforeStr,
    `${label}: round-trip drift\n  before: ${beforeStr}\n  after:  ${afterStr}`)
  assert.ok(deepEqual(before, after),
    `${label}: deep-equal check failed`)
}

// ── Fixture 1: 4-slider synth patch ────────────────────────────────

test('composer round-trip — 4-slider synth patch', () => {
  const { env, fuel } = freshEnv()
  // Build the canvas via Scheme so we prove the verbs are reachable
  // through the evaluator (not just JS).
  const src = `
    (composer/canvas (list :bind (quote (synth)))
      (composer/slider :label "Attack"  :bind (quote (synth :a)) :min 0.0 :max 2.0 :step 0.01 :value 0.05)
      (composer/slider :label "Decay"   :bind (quote (synth :d)) :min 0.0 :max 2.0 :step 0.01 :value 0.10)
      (composer/slider :label "Sustain" :bind (quote (synth :s)) :min 0.0 :max 1.0 :step 0.01 :value 0.70)
      (composer/slider :label "Release" :bind (quote (synth :r)) :min 0.0 :max 3.0 :step 0.01 :value 0.30))
  `
  const canvas = evalSrc(env, fuel, src)
  assert.equal(canvas.kind, 'canvas')
  assert.equal(canvas.children.length, 4)
  for (const c of canvas.children) assert.equal(c.kind, 'slider')
  assertRoundTrip(env, canvas, '4-slider synth')
  // Mutate a value, round-trip again.
  sliderSet(canvas.children[0], 0.5)
  sliderSet(canvas.children[2], 0.42)
  assertRoundTrip(env, canvas, '4-slider synth (mutated)')
})

// ── Fixture 2: 12-note piano-roll ──────────────────────────────────

test('composer round-trip — 12-note piano-roll', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (song)))
      (composer/piano-roll :bind (quote (song :notes)) :steps 16 :emit-shape (quote sequence)))
  `
  const canvas = evalSrc(env, fuel, src)
  assert.equal(canvas.children.length, 1)
  const roll = canvas.children[0]
  // Place a C-major scale + a chord — 12 notes.
  const scale = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'E5', 'G5', 'C6', 'G4']
  scale.forEach((p, i) => pianoRollPlace(roll, p, i, { vel: 0.8, dur: 1 }))
  assert.equal(roll.state.notes.length, 12)
  assertRoundTrip(env, canvas, '12-note piano-roll')
})

// ── Fixture 3: 8×8 sprite ──────────────────────────────────────────

test('composer round-trip — 8×8 sprite', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (sprites)))
      (composer/sprite-grid :bind (quote (sprites :hero)) :size (quote (8 8)) :palette (quote pico-8)))
  `
  const canvas = evalSrc(env, fuel, src)
  const grid = canvas.children[0]
  assert.equal(grid.opts.w, 8)
  assert.equal(grid.opts.h, 8)
  // Draw a smiley face — a handful of pixels.
  spriteGridSet(grid, 2, 2, 8)  // left eye
  spriteGridSet(grid, 5, 2, 8)  // right eye
  spriteGridSet(grid, 1, 5, 8)
  spriteGridSet(grid, 2, 6, 8)
  spriteGridSet(grid, 3, 6, 8)
  spriteGridSet(grid, 4, 6, 8)
  spriteGridSet(grid, 5, 6, 8)
  spriteGridSet(grid, 6, 5, 8)
  assertRoundTrip(env, canvas, '8×8 sprite')
})

// ── Fixture 4: text-field + toggle + button combination ────────────

test('composer round-trip — text-field + toggle + button combo', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (meta)))
      (composer/text-field :bind (quote (meta :title)) :label "Cart title" :value "untitled")
      (composer/toggle :bind (quote (meta :muted)) :label "Muted" :value #f)
      (composer/button :label "Save" :emits (quote (cart/save))))
  `
  const canvas = evalSrc(env, fuel, src)
  assert.equal(canvas.children.length, 3)
  const [tf, tog, btn] = canvas.children
  assert.equal(tf.kind, 'text-field')
  assert.equal(tog.kind, 'toggle')
  assert.equal(btn.kind, 'button')
  assertRoundTrip(env, canvas, 'text+toggle+button')
  // Mutate.
  textFieldSet(tf, 'my-song')
  toggleSet(tog, true)
  assertRoundTrip(env, canvas, 'text+toggle+button (mutated)')
})

// ── Coverage: every remaining widget kind ──────────────────────────

test('composer round-trip — ADSR envelope', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (synth)))
      (composer/adsr :bind (quote (synth :env))))
  `
  const canvas = evalSrc(env, fuel, src)
  adsrSet(canvas.children[0], 'a', 0.02)
  adsrSet(canvas.children[0], 'd', 0.15)
  adsrSet(canvas.children[0], 's', 0.6)
  adsrSet(canvas.children[0], 'r', 0.4)
  assertRoundTrip(env, canvas, 'adsr')
})

test('composer round-trip — instrument-picker', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (synth)))
      (composer/instrument-picker :bind (quote (synth :wave)) :choices (quote (sine square triangle saw noise))))
  `
  const canvas = evalSrc(env, fuel, src)
  pickerChoose(canvas.children[0], 'square')
  assertRoundTrip(env, canvas, 'instrument-picker')
})

test('composer round-trip — fx-chain', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (synth)))
      (composer/fx-chain :bind (quote (synth :fx)) :available (quote (fx/reverb fx/delay fx/filter))))
  `
  const canvas = evalSrc(env, fuel, src)
  fxChainAdd(canvas.children[0], 'fx/reverb', { wet: 0.4 })
  fxChainAdd(canvas.children[0], 'fx/delay', { time: 0.25, feedback: 0.5 })
  assertRoundTrip(env, canvas, 'fx-chain')
})

test('composer round-trip — timeline', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (anim)))
      (composer/timeline :bind (quote (anim :hero)) :entities (quote (hero)) :duration 60 :fps 30))
  `
  const canvas = evalSrc(env, fuel, src)
  timelinePlace(canvas.children[0], 'hero', 0, [100, 100])
  timelinePlace(canvas.children[0], 'hero', 30, [200, 100])
  timelinePlace(canvas.children[0], 'hero', 60, [200, 200])
  assertRoundTrip(env, canvas, 'timeline')
})

test('composer round-trip — tile-map', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (level)))
      (composer/tile-map :bind (quote (level :map)) :size (quote (8 8))))
  `
  const canvas = evalSrc(env, fuel, src)
  tileMapSet(canvas.children[0], 0, 0, 1)
  tileMapSet(canvas.children[0], 3, 4, 2)
  tileMapSet(canvas.children[0], 7, 7, 5)
  assertRoundTrip(env, canvas, 'tile-map')
})

test('composer round-trip — color-picker + live-code', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (theme)))
      (composer/color-picker :bind (quote (theme :bg)) :palette (quote pico-8))
      (composer/live-code :bind (quote (theme :src))))
  `
  const canvas = evalSrc(env, fuel, src)
  colorPickerSet(canvas.children[0], 'red')
  assertRoundTrip(env, canvas, 'color-picker + live-code')
})

// ── The property test: emit is a fixed point of (emit ∘ apply) ─────

test('composer property — apply(canvas, emit(canvas)) is emit-stable', () => {
  const { env, fuel } = freshEnv()
  // Big canvas with one of every widget.
  const src = `
    (composer/canvas (list :bind (quote (kitchen)))
      (composer/slider :label "vol" :bind (quote (k :vol)) :min 0 :max 1 :step 0.01 :value 0.5)
      (composer/text-field :bind (quote (k :name)) :label "name" :value "kitchen")
      (composer/toggle :bind (quote (k :on)) :label "on" :value #t)
      (composer/adsr :bind (quote (k :env)))
      (composer/instrument-picker :bind (quote (k :wave)) :choices (quote (sine square)))
      (composer/piano-roll :bind (quote (k :song)) :steps 8 :emit-shape (quote sequence))
      (composer/sprite-grid :bind (quote (k :icon)) :size (quote (8 8)) :palette (quote pico-8))
      (composer/tile-map :bind (quote (k :map)) :size (quote (4 4)))
      (composer/timeline :bind (quote (k :anim)) :entities (quote (a b)) :duration 30 :fps 30)
      (composer/fx-chain :bind (quote (k :fx)) :available (quote (fx/reverb fx/delay)))
      (composer/color-picker :bind (quote (k :bg)) :palette (quote pico-8))
      (composer/button :label "go" :emits (quote (start)))
      (composer/live-code :bind (quote (k :src))))
  `
  const canvas = evalSrc(env, fuel, src)
  assert.equal(canvas.children.length, 13)
  // Populate some state on the more interesting ones.
  sliderSet(canvas.children[0], 0.72)
  adsrSet(canvas.children[3], 'a', 0.03)
  pianoRollPlace(canvas.children[5], 'C4', 0)
  pianoRollPlace(canvas.children[5], 'E4', 2)
  spriteGridSet(canvas.children[6], 3, 3, 8)
  fxChainAdd(canvas.children[10], 'fx/reverb', { wet: 0.3 })
  // Emit once — this is the ground truth.
  const emit = env.get('composer/emit')
  const apply = env.get('composer/apply')
  const t0 = emit(canvas)
  // Apply back, emit again — must match.
  apply(canvas, t0)
  const t1 = emit(canvas)
  assert.equal(formatForm(t1), formatForm(t0), 'emit stable after one apply')
  // Do it 5 times — no drift.
  for (let i = 0; i < 5; i++) {
    apply(canvas, emit(canvas))
  }
  const tN = emit(canvas)
  assert.equal(formatForm(tN), formatForm(t0), 'emit stable after 5 applies')
})

// ── save/load round-trip via a temp file ─────────────────────────────

test('composer round-trip — save then load', async () => {
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (song)))
      (composer/slider :label "BPM" :bind (quote (song :bpm)) :min 60 :max 240 :step 1 :value 128)
      (composer/toggle :bind (quote (song :loop)) :label "loop" :value #t))
  `
  const canvas = evalSrc(env, fuel, src)
  const emit = env.get('composer/emit')
  const save = env.get('composer/save')
  const load = env.get('composer/load')
  const emittedBefore = emit(canvas)
  // Path guard (2026-07-17): composer/save + composer/load require a
  // path under cwd() or ~/.motoi/. Use a scratch/ path so the security
  // sandbox is honored — /tmp is deliberately outside the allowed roots.
  const { mkdirSync, unlinkSync } = await import('node:fs')
  const { join } = await import('node:path')
  const scratchDir = join(process.cwd(), 'scratch')
  try { mkdirSync(scratchDir, { recursive: true }) } catch {}
  const tmpPath = join(scratchDir, `motoi-composer-test-${process.pid}.slat`)
  save(canvas, tmpPath)
  const loaded = load(tmpPath)
  assert.equal(loaded.kind, 'canvas')
  const emittedAfter = emit(loaded)
  assert.equal(formatForm(emittedAfter), formatForm(emittedBefore),
    'load round-trip')
  try { unlinkSync(tmpPath) } catch { /* ignore */ }
})
