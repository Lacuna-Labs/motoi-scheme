// tests/composer/hunt-per-widget.test.js
//
// Zane #2 — HOSTILE INPUT HUNT per widget kind, Composer v1.1.
//
// For each of the ~18 widget kinds, we probe six attack surfaces:
//   1. Missing required opts        (no :bind, no :choices, etc.)
//   2. Contract-violating types     (:min > :max, negative size,
//                                    negative frame counts, string as
//                                    number)
//   3. Empty vs full state          (unfilled piano-roll, 100%-full
//                                    piano-roll, empty vs full tile-map)
//   4. Duplicate widget ids in a canvas
//      (composer has no explicit widget-id notion; we probe duplicate
//      bind-paths + duplicate identical widgets)
//   5. Bind path that doesn't exist in the target form
//      (composer never validates path targets; probed to record that)
//   6. Bind to a leaf whose shape doesn't match the widget
//      (slider bound to a string, toggle bound to a piano-roll form,
//      color-picker bound to a numeric leaf)
//
// GOAL of these tests is NOT to pass — it is to CHARACTERIZE behavior.
// Each test asserts what CURRENTLY happens: crash, silent-garbage,
// clean-reject, or accept-and-round-trip. That way a change to the
// underlying composer behavior is visible in the test diff.
//
// Tests do not mutate the composer or spec — they only observe.
//
// The final REPORT (posted in the transcript) summarizes the
// widget × attack matrix.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeCoreEnv } from '../../core/index.js'
import { evaluate } from '../../src/interp.js'
import { parse, Sym, sym } from '../../src/reader.js'
import {
  formatForm, deepEqual,
  sliderSet, pianoRollPlace, spriteGridSet, tileMapSet,
  timelinePlace, adsrSet, pickerChoose, fxChainAdd,
  textFieldSet, toggleSet, colorPickerSet,
} from '../../lib/composer/composer.js'

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

// Try to evaluate `src`. Returns { ok, value, err }. Never throws.
function tryEval(env, fuel, src) {
  try {
    return { ok: true, value: evalSrc(env, fuel, src) }
  } catch (e) {
    return { ok: false, err: e }
  }
}

// Classify a probe result for the report matrix.
//   CRASH        — evaluator or emit/apply threw
//   SILENT-BAD   — accepted but produced NaN, undefined, or malformed form
//   REJECTED     — cleanly rejected (returned a non-widget or a false)
//   ACCEPTED     — took input, produced a well-formed widget/form
function classify(res, extra) {
  if (!res.ok) return 'CRASH'
  const v = res.value
  if (v == null) return 'REJECTED'
  if (v && typeof v === 'object' && v.kind) return extra?.badState ? 'SILENT-BAD' : 'ACCEPTED'
  return 'ACCEPTED'
}

// Round-trip helper for a canvas — never throws; returns before/after.
function roundTripSafe(env, canvas) {
  const emit = env.get('composer/emit')
  const apply = env.get('composer/apply')
  let before, after, err = null
  try {
    before = emit(canvas)
    apply(canvas, before)
    after = emit(canvas)
  } catch (e) { err = e }
  return { before, after, err }
}

// ── composer/canvas ─────────────────────────────────────────────────

test('canvas — no :bind opt', () => {
  const { env, fuel } = freshEnv()
  const res = tryEval(env, fuel, '(composer/canvas)')
  assert.equal(res.ok, true, 'canvas with no opts accepted')
  assert.equal(res.value.kind, 'canvas')
  assert.deepEqual(res.value.bind, [], 'empty bind, no reject')
})

test('canvas — duplicate identical child widgets', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (x)))
      (composer/slider :label "A" :bind (quote (x :a)) :min 0 :max 1 :value 0.5)
      (composer/slider :label "A" :bind (quote (x :a)) :min 0 :max 1 :value 0.5))
  `
  const res = tryEval(env, fuel, src)
  assert.equal(res.ok, true)
  assert.equal(res.value.children.length, 2, 'both duplicates kept — no dedupe')
  // Round-trip preserves both duplicates.
  const rt = roundTripSafe(env, res.value)
  assert.equal(rt.err, null, 'round-trip clean')
  assert.equal(formatForm(rt.before), formatForm(rt.after), 'no drift on dup')
})

test('canvas — duplicate bind paths on distinct children', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (x)))
      (composer/slider :label "S" :bind (quote (x :v)) :min 0 :max 1 :value 0.2)
      (composer/toggle :label "T" :bind (quote (x :v)) :value #t))
  `
  const res = tryEval(env, fuel, src)
  assert.equal(res.ok, true, 'silent — no collision check')
  assert.equal(res.value.children.length, 2)
})

test('canvas — child that is not a widget record is filtered', () => {
  const { env, fuel } = freshEnv()
  const src = `(composer/canvas (list :bind (quote (x))) 42 "hello" (quote nope))`
  const res = tryEval(env, fuel, src)
  assert.equal(res.ok, true)
  assert.equal(res.value.children.length, 0,
    'non-widget positional entries silently dropped')
})

// ── composer/slider ─────────────────────────────────────────────────

test('slider — no opts at all', () => {
  const { env, fuel } = freshEnv()
  const res = tryEval(env, fuel, '(composer/slider)')
  assert.equal(res.ok, true, 'no-opt slider accepted')
  assert.equal(res.value.kind, 'slider')
  // Defaults: min 0, max 1, step 0.01, value = min = 0
  assert.equal(res.value.opts.min, 0)
  assert.equal(res.value.opts.max, 1)
  assert.equal(res.value.state.value, 0)
})

test('slider — :min > :max is REJECTED (contract enforced)', () => {
  const { env, fuel } = freshEnv()
  const res = tryEval(env, fuel,
    '(composer/slider :bind (quote (x)) :min 100 :max 10 :value 50)')
  assert.equal(res.ok, false, 'contract-violating inverted range rejected')
  assert.match(res.err.message, /:min.*must be <=.*:max/)
})

test('slider — value outside [min,max] is CLAMPED with warning', () => {
  const { env, fuel } = freshEnv()
  const res = tryEval(env, fuel,
    '(composer/slider :bind (quote (x)) :min 0 :max 1 :value 9999)')
  assert.equal(res.ok, true, 'accepted with clamp')
  assert.equal(res.value.state.value, 1, 'value clamped to :max')
  assert.ok(res.value.warnings && res.value.warnings.length > 0,
    'warning field populated')
})

test('slider — string in :min is REJECTED (no more silent NaN)', () => {
  const { env, fuel } = freshEnv()
  const res = tryEval(env, fuel,
    '(composer/slider :bind (quote (x)) :min "not-a-number" :max 1)')
  assert.equal(res.ok, false, 'string :min rejected')
  assert.match(res.err.message, /:min.*not a number/)
})

test('slider — bind to a form path that does not exist in any target', () => {
  const { env, fuel } = freshEnv()
  // composer never resolves bind against a target — it just records path.
  const res = tryEval(env, fuel,
    '(composer/slider :bind (quote (does/not/exist :nowhere)) :min 0 :max 1)')
  assert.equal(res.ok, true)
  assert.deepEqual(res.value.bind, ['does/not/exist', ':nowhere'],
    'path recorded verbatim, no existence check')
})

test('slider — bind path may be a bare string (non-list), no reject', () => {
  const { env, fuel } = freshEnv()
  const res = tryEval(env, fuel,
    '(composer/slider :bind "just-a-string" :min 0 :max 1)')
  assert.equal(res.ok, true)
  // pathToNames wraps a scalar to [String(scalar)].
  assert.deepEqual(res.value.bind, ['just-a-string'])
})

// ── composer/button ─────────────────────────────────────────────────

test('button — no opts', () => {
  const { env, fuel } = freshEnv()
  const res = tryEval(env, fuel, '(composer/button)')
  assert.equal(res.ok, true)
  assert.equal(res.value.opts.label, '')
  assert.equal(res.value.state.emits, null)
})

test('button — :emits is a bare number (weird but accepted)', () => {
  const { env, fuel } = freshEnv()
  const res = tryEval(env, fuel, '(composer/button :label "X" :emits 42)')
  assert.equal(res.value.state.emits, 42, 'stored verbatim')
})

test('button — emits target from emitWidgetTarget is empty when no emits', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (x)))
      (composer/button :label "P"))
  `
  const canvas = evalSrc(env, fuel, src)
  const rt = roundTripSafe(env, canvas)
  assert.equal(rt.err, null)
  // Round-trip is stable even with null emits.
  assert.equal(formatForm(rt.before), formatForm(rt.after))
})

// ── composer/piano-roll ─────────────────────────────────────────────

test('piano-roll — no opts (missing :bind, :range, :steps)', () => {
  const { env, fuel } = freshEnv()
  const res = tryEval(env, fuel, '(composer/piano-roll)')
  assert.equal(res.ok, true, 'no rejection')
  // Defaults: range C3..C6, steps 16, sequence shape
  assert.deepEqual(res.value.opts.range, ['C3', 'C6'])
  assert.equal(res.value.opts.steps, 16)
})

test('piano-roll — dotted-pair range (C3 . C6) filters dot at receiver', () => {
  const { env, fuel } = freshEnv()
  // Reader gives [Sym('C3'), Sym('.'), Sym('C6')] for '(C3 . C6). The
  // widget-level receiver filters Sym('.') so legacy spec examples work.
  const res = tryEval(env, fuel,
    '(composer/piano-roll :bind (quote (x)) :range (quote (C3 . C6)))')
  assert.deepEqual(res.value.opts.range, ['C3', 'C6'],
    'dotted-pair dot filtered — clean [low, high]')
})

test('piano-roll — negative steps REJECTED', () => {
  const { env, fuel } = freshEnv()
  const res = tryEval(env, fuel,
    '(composer/piano-roll :bind (quote (x)) :steps -10)')
  assert.equal(res.ok, false, 'negative steps rejected')
  assert.match(res.err.message, /:steps.*non-negative/)
})

test('piano-roll — empty state emits (sequence) with no notes', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (song)))
      (composer/piano-roll :bind (quote (song :seq)) :steps 8))
  `
  const canvas = evalSrc(env, fuel, src)
  const emit = env.get('composer/emit')
  const rt = roundTripSafe(env, canvas)
  assert.equal(rt.err, null)
  assert.equal(formatForm(rt.before), formatForm(rt.after), 'empty stable')
})

test('piano-roll — 100%-full grid (steps × range) round-trips', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (song)))
      (composer/piano-roll :bind (quote (song :seq)) :steps 4))
  `
  const canvas = evalSrc(env, fuel, src)
  const pr = canvas.children[0]
  // Cram 100 notes at random positions — well over "full".
  for (let s = 0; s < 100; s++) {
    pianoRollPlace(pr, s % 2 ? 'C4' : 'E4', s, { vel: 0.5, dur: 1 })
  }
  const rt = roundTripSafe(env, canvas)
  assert.equal(rt.err, null, 'no crash on full')
  assert.equal(formatForm(rt.before), formatForm(rt.after), 'full round-trips')
})

// ── composer/sprite-grid ────────────────────────────────────────────

test('sprite-grid — no opts (default 8x8)', () => {
  const { env, fuel } = freshEnv()
  const res = tryEval(env, fuel, '(composer/sprite-grid)')
  assert.equal(res.ok, true)
  assert.equal(res.value.opts.w, 8)
  assert.equal(res.value.opts.h, 8)
})

test('sprite-grid — negative size (dotted-pair notation) REJECTED', () => {
  const { env, fuel } = freshEnv()
  // '(-4 . -4) reads as [-4, Sym('.'), -4]; filter drops the dot so
  // both -4s become the numbers. Contract then rejects negative size.
  const res = tryEval(env, fuel,
    '(composer/sprite-grid :bind (quote (x)) :size (quote (-4 . -4)))')
  assert.equal(res.ok, false, 'negative size rejected (dotted-pair filtered)')
  assert.match(res.err.message, /:size.*must be non-negative/)
})

test('sprite-grid — negative size (proper-list notation) REJECTED', () => {
  const { env, fuel } = freshEnv()
  const res = tryEval(env, fuel,
    '(composer/sprite-grid :bind (quote (x)) :size (quote (-4 -4)))')
  assert.equal(res.ok, false, 'negative size rejected')
  assert.match(res.err.message, /:size.*must be non-negative/)
})

test('sprite-grid — zero size', () => {
  const { env, fuel } = freshEnv()
  const res = tryEval(env, fuel,
    '(composer/sprite-grid :bind (quote (x)) :size (quote (0 . 0)))')
  assert.equal(res.value.opts.w, 0)
  assert.equal(res.value.state.pixels.length, 0, 'zero-size grid has no rows')
})

test('sprite-grid — non-numeric size elements REJECTED', () => {
  const { env, fuel } = freshEnv()
  // '("cat" . "dog") — filter drops the dot, coerce -> NaN -> reject.
  const res = tryEval(env, fuel,
    '(composer/sprite-grid :bind (quote (x)) :size (quote ("cat" . "dog")))')
  assert.equal(res.ok, false, 'non-numeric size rejected')
  assert.match(res.err.message, /:size.*list of two numbers/)
})

test('sprite-grid — huge size (proper-list) does not crash', () => {
  const { env, fuel } = freshEnv()
  const res = tryEval(env, fuel,
    '(composer/sprite-grid :bind (quote (x)) :size (quote (200 200)))')
  assert.equal(res.ok, true)
  assert.equal(res.value.state.pixels.length, 200)
})

test('sprite-grid — dotted-pair size (8 . 8) works cleanly now', () => {
  const { env, fuel } = freshEnv()
  // Widget receiver filters Sym('.') so legacy dotted-pair spec examples
  // no longer silently produce a NaN grid.
  const res = tryEval(env, fuel,
    '(composer/sprite-grid :bind (quote (x)) :size (quote (8 . 8)))')
  assert.equal(res.ok, true, 'accepted after dot-filter')
  assert.equal(res.value.opts.w, 8)
  assert.equal(res.value.opts.h, 8, 'height parsed cleanly — no NaN')
  assert.equal(res.value.state.pixels.length, 8, '8 rows built')
})

test('sprite-grid — fully-painted 8x8 round-trips (proper list)', () => {
  const { env, fuel } = freshEnv()
  // Use proper-list to avoid the dotted-pair NaN trap.
  const src = `
    (composer/canvas (list :bind (quote (spr)))
      (composer/sprite-grid :bind (quote (spr :hero)) :size (quote (8 8))))
  `
  const canvas = evalSrc(env, fuel, src)
  const w = canvas.children[0]
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) spriteGridSet(w, c, r, ((r + c) % 16))
  const rt = roundTripSafe(env, canvas)
  assert.equal(rt.err, null)
  assert.equal(formatForm(rt.before), formatForm(rt.after))
})

// ── composer/tile-map ───────────────────────────────────────────────

test('tile-map — no opts', () => {
  const { env, fuel } = freshEnv()
  const res = tryEval(env, fuel, '(composer/tile-map)')
  assert.equal(res.ok, true)
  assert.equal(res.value.opts.cols, 8)
  assert.equal(res.value.opts.rows, 8)
})

test('tile-map — negative size (dotted-pair) REJECTED', () => {
  const { env, fuel } = freshEnv()
  const res = tryEval(env, fuel,
    '(composer/tile-map :bind (quote (x)) :size (quote (-3 . -3)))')
  assert.equal(res.ok, false, 'negative size rejected')
  assert.match(res.err.message, /:size.*must be non-negative/)
})

test('tile-map — dotted-pair size (64 . 32) parses cleanly', () => {
  const { env, fuel } = freshEnv()
  // Widget receiver filters Sym('.') so spec-example dotted-pair works.
  const res = tryEval(env, fuel,
    '(composer/tile-map :bind (quote (x)) :size (quote (64 . 32)))')
  assert.equal(res.ok, true, 'accepted after dot-filter')
  assert.equal(res.value.opts.cols, 64)
  assert.equal(res.value.opts.rows, 32, 'rows parses cleanly — no NaN')
})

test('tile-map — cells at out-of-bounds coords stored anyway', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (l)))
      (composer/tile-map :bind (quote (l :m)) :size (quote (4 . 4))))
  `
  const canvas = evalSrc(env, fuel, src)
  const tm = canvas.children[0]
  tileMapSet(tm, 999, -50, 7) // out of bounds
  assert.equal(tm.state.cells['999,-50'], 7, 'stored without bounds check')
  const rt = roundTripSafe(env, canvas)
  assert.equal(rt.err, null)
})

test('tile-map — empty vs 16-full both round-trip', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (l)))
      (composer/tile-map :bind (quote (l :m)) :size (quote (4 . 4))))
  `
  const canvas = evalSrc(env, fuel, src)
  const rtEmpty = roundTripSafe(env, canvas)
  assert.equal(rtEmpty.err, null)
  const tm = canvas.children[0]
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) tileMapSet(tm, c, r, r * 4 + c)
  const rtFull = roundTripSafe(env, canvas)
  assert.equal(rtFull.err, null)
  assert.equal(formatForm(rtFull.before), formatForm(rtFull.after))
})

// ── composer/timeline ───────────────────────────────────────────────

test('timeline — no opts', () => {
  const { env, fuel } = freshEnv()
  const res = tryEval(env, fuel, '(composer/timeline)')
  assert.equal(res.ok, true)
  assert.deepEqual(res.value.opts.entities, [])
  assert.equal(res.value.opts.duration, 60)
})

test('timeline — negative duration REJECTED', () => {
  const { env, fuel } = freshEnv()
  const res = tryEval(env, fuel,
    '(composer/timeline :bind (quote (a)) :duration -10 :fps -30)')
  assert.equal(res.ok, false, 'negative duration rejected')
  assert.match(res.err.message, /:duration.*non-negative/)
})

test('timeline — frames at negative t stored', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (a)))
      (composer/timeline :bind (quote (a :hero-walk)) :entities (quote (hero)) :duration 60))
  `
  const canvas = evalSrc(env, fuel, src)
  const tl = canvas.children[0]
  timelinePlace(tl, 'hero', -50, [0, 0])
  assert.equal(tl.state.frames.hero.length, 1)
  assert.equal(tl.state.frames.hero[0].at, -50)
  const rt = roundTripSafe(env, canvas)
  assert.equal(rt.err, null)
})

test('timeline — empty frames set produces empty form', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (a)))
      (composer/timeline :bind (quote (a :x)) :entities (quote (hero enemy)) :duration 60))
  `
  const canvas = evalSrc(env, fuel, src)
  const rt = roundTripSafe(env, canvas)
  assert.equal(rt.err, null)
})

// ── composer/adsr ───────────────────────────────────────────────────

test('adsr — no opts (defaults)', () => {
  const { env, fuel } = freshEnv()
  const res = tryEval(env, fuel, '(composer/adsr)')
  assert.equal(res.ok, true)
  assert.equal(res.value.state.a, 0.01)
  assert.equal(res.value.state.s, 0.7)
})

test('adsr — negative envelope values REJECTED', () => {
  const { env, fuel } = freshEnv()
  const res = tryEval(env, fuel,
    '(composer/adsr :bind (quote (s)) :a -1 :d -1 :s -1 :r -1)')
  assert.equal(res.ok, false, 'negative attack rejected')
  assert.match(res.err.message, /:a.*non-negative/)
})

test('adsr — non-numeric envelope value REJECTED', () => {
  const { env, fuel } = freshEnv()
  const res = tryEval(env, fuel,
    '(composer/adsr :bind (quote (s)) :a "hello")')
  assert.equal(res.ok, false, 'string :a rejected')
  assert.match(res.err.message, /:a.*not a number/)
})

// ── composer/instrument-picker ──────────────────────────────────────

test('instrument-picker — no :choices → chosen is null, but empty picker', () => {
  const { env, fuel } = freshEnv()
  const res = tryEval(env, fuel, '(composer/instrument-picker :bind (quote (s :w)))')
  assert.equal(res.ok, true)
  assert.equal(res.value.state.chosen, null)
  assert.deepEqual(res.value.opts.choices, [])
})

test('instrument-picker — choices is a non-list scalar', () => {
  const { env, fuel } = freshEnv()
  const res = tryEval(env, fuel,
    '(composer/instrument-picker :bind (quote (s :w)) :choices (quote sine))')
  assert.equal(res.ok, true)
  // Non-array choices ignored — falls back to []
  assert.deepEqual(res.value.opts.choices, [])
  assert.equal(res.value.state.chosen, null)
})

test('instrument-picker — pickerChoose to a symbol not in choices is stored', () => {
  const { env, fuel } = freshEnv()
  const res = tryEval(env, fuel,
    '(composer/instrument-picker :bind (quote (s :w)) :choices (quote (sine square)))')
  const pk = res.value
  pickerChoose(pk, 'harpsichord') // not a valid choice
  assert.equal(pk.state.chosen, 'harpsichord', 'no membership check')
})

// ── composer/fx-chain ───────────────────────────────────────────────

test('fx-chain — no :available (empty list is fine)', () => {
  const { env, fuel } = freshEnv()
  const res = tryEval(env, fuel, '(composer/fx-chain :bind (quote (s :fx)))')
  assert.equal(res.ok, true)
  assert.deepEqual(res.value.opts.available, [])
})

test('fx-chain — fxChainAdd of an fx NOT in :available succeeds', () => {
  const { env, fuel } = freshEnv()
  const res = tryEval(env, fuel,
    '(composer/fx-chain :bind (quote (s :fx)) :available (quote (fx/reverb)))')
  const fx = res.value
  fxChainAdd(fx, 'fx/nuclear-detonation', { wet: 1.0 })
  assert.equal(fx.state.chain.length, 1)
  assert.equal(fx.state.chain[0][0], 'fx/nuclear-detonation',
    'unregistered fx added — no allowlist enforcement')
})

test('fx-chain — 100 entries round-trip', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (s)))
      (composer/fx-chain :bind (quote (s :fx)) :available (quote (fx/reverb fx/delay))))
  `
  const canvas = evalSrc(env, fuel, src)
  const fx = canvas.children[0]
  for (let i = 0; i < 100; i++) fxChainAdd(fx, 'fx/reverb', { wet: i / 100 })
  const rt = roundTripSafe(env, canvas)
  assert.equal(rt.err, null)
})

// ── composer/text-field ─────────────────────────────────────────────

test('text-field — no opts', () => {
  const { env, fuel } = freshEnv()
  const res = tryEval(env, fuel, '(composer/text-field)')
  assert.equal(res.ok, true)
  assert.equal(res.value.state.value, '')
})

test('text-field — numeric :value is stringified', () => {
  const { env, fuel } = freshEnv()
  const res = tryEval(env, fuel,
    '(composer/text-field :bind (quote (x)) :value 42)')
  assert.equal(res.value.state.value, '42', 'coerced to string')
})

test('text-field — bind to a "leaf" that is actually a slider spot: no complaint', () => {
  const { env, fuel } = freshEnv()
  const res = tryEval(env, fuel,
    '(composer/text-field :bind (quote (bpm)) :value "not-a-number")')
  assert.equal(res.ok, true, 'composer never validates target-shape')
})

// ── composer/toggle ─────────────────────────────────────────────────

test('toggle — no opts (default false)', () => {
  const { env, fuel } = freshEnv()
  const res = tryEval(env, fuel, '(composer/toggle)')
  assert.equal(res.value.state.value, false)
})

test('toggle — :value string REJECTED (no silent collapse)', () => {
  const { env, fuel } = freshEnv()
  const res = tryEval(env, fuel,
    '(composer/toggle :bind (quote (x)) :value "true")')
  assert.equal(res.ok, false, 'string :value rejected')
  assert.match(res.err.message, /:value.*must be #t or #f/)
})

test('toggle — apply with :value #t survives round-trip', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (x)))
      (composer/toggle :bind (quote (x :on)) :value #t))
  `
  const canvas = evalSrc(env, fuel, src)
  const rt = roundTripSafe(env, canvas)
  assert.equal(rt.err, null)
  assert.equal(formatForm(rt.before), formatForm(rt.after))
})

// ── composer/color-picker ───────────────────────────────────────────

test('color-picker — no opts', () => {
  const { env, fuel } = freshEnv()
  const res = tryEval(env, fuel, '(composer/color-picker)')
  assert.equal(res.ok, true)
  assert.equal(res.value.state.value, '#000000', 'default hex without palette')
})

test('color-picker — with :palette default is symbol black', () => {
  const { env, fuel } = freshEnv()
  const res = tryEval(env, fuel,
    '(composer/color-picker :bind (quote (t :bg)) :palette (quote pico-8))')
  const v = res.value.state.value
  assert.ok(v instanceof Sym && v.name === 'black', 'palette default is symbol')
})

test('color-picker — colorPickerSet to a hex string works', () => {
  const { env, fuel } = freshEnv()
  const res = tryEval(env, fuel,
    '(composer/color-picker :bind (quote (t :bg)))')
  colorPickerSet(res.value, '#ff00ff')
  assert.equal(res.value.state.value, '#ff00ff')
})

test('color-picker — round-trip on symbol value', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (t)))
      (composer/color-picker :bind (quote (t :bg)) :palette (quote pico-8)))
  `
  const canvas = evalSrc(env, fuel, src)
  const rt = roundTripSafe(env, canvas)
  assert.equal(rt.err, null)
  assert.equal(formatForm(rt.before), formatForm(rt.after))
})

// ── composer/live-code ──────────────────────────────────────────────

test('live-code — no opts', () => {
  const { env, fuel } = freshEnv()
  const res = tryEval(env, fuel, '(composer/live-code)')
  assert.equal(res.ok, true)
  assert.equal(res.value.state.source, '')
})

test('live-code — source PRESERVED across round-trip', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (x)))
      (composer/live-code :bind (quote (x))))
  `
  const canvas = evalSrc(env, fuel, src)
  canvas.children[0].state.source = '(cool code)'
  const rt = roundTripSafe(env, canvas)
  assert.equal(rt.err, null)
  // source is now emitted as :source — should survive round-trip.
  const beforeStr = formatForm(rt.before)
  assert.ok(beforeStr.includes('cool code'),
    'live-code source preserved via :source kw')
  assert.equal(canvas.children[0].state.source, '(cool code)',
    'source unchanged post-apply')
})

// ── song/config (v1.1) ─────────────────────────────────────────────

test('song/config — no opts (defaults 16, oldest, 120)', () => {
  const { env, fuel } = freshEnv()
  const res = tryEval(env, fuel, '(song/config)')
  assert.equal(res.value.voices, 16)
  assert.equal(res.value.voiceSteal, 'oldest')
  assert.equal(res.value.bpm, 120)
})

test('song/config — voices > 16 clamps with warning', () => {
  const { env, fuel } = freshEnv()
  const res = tryEval(env, fuel, '(song/config :voices 999)')
  assert.equal(res.value.voices, 16)
  assert.ok(res.value.warnings.length > 0)
})

test('song/config — voices < 1 clamps to 1 with warning', () => {
  const { env, fuel } = freshEnv()
  const res = tryEval(env, fuel, '(song/config :voices -5)')
  assert.equal(res.value.voices, 1)
  assert.ok(res.value.warnings.length > 0)
})

test('song/config — non-numeric voices becomes NaN then clamped to 1', () => {
  const { env, fuel } = freshEnv()
  const res = tryEval(env, fuel, '(song/config :voices "cat")')
  // Number("cat") is NaN. NaN > 16 is false, NaN < 1 is false — falls through.
  // Observing what really happens:
  assert.equal(res.ok, true)
  // Document actual behavior: voices stays NaN OR clamps.
  const v = res.value.voices
  assert.ok(v === 1 || Number.isNaN(v), 'either clamped or NaN')
})

// ── voice/mix (v1.1) ───────────────────────────────────────────────

test('voice/mix — no arg (undefined)', () => {
  const { env, fuel } = freshEnv()
  const res = tryEval(env, fuel, '(voice/mix)')
  assert.equal(res.ok, true, 'no arg — no crash')
  assert.equal(res.value.kind, 'voice-mix')
  assert.deepEqual(res.value.voices, [])
})

test('voice/mix — invalid ids only (0, 16, 20) → empty', () => {
  const { env, fuel } = freshEnv()
  const res = tryEval(env, fuel, '(voice/mix (quote (0 16 20 -3)))')
  assert.deepEqual(res.value.voices, [], 'all filtered')
})

test('voice/mix — duplicate ids DEDUPED (consistent with voice-mix-set)', () => {
  const { env, fuel } = freshEnv()
  const res = tryEval(env, fuel, '(voice/mix (quote (1 1 1 2 2 3)))')
  // Both entry points now share dedupe+cap semantics.
  assert.deepEqual(res.value.voices, [1, 2, 3],
    'voice/mix + voice-mix-set both dedupe')
})

test('voice/mix — non-numeric ids skipped', () => {
  const { env, fuel } = freshEnv()
  const res = tryEval(env, fuel, '(voice/mix (quote (1 "two" 3)))')
  assert.deepEqual(res.value.voices, [1, 3])
})

// ── composer/voice-assign (v1.1) ──────────────────────────────────

test('voice-assign — voice id 16 (mixer) rejected silently', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (define p (composer/voice-pool :bind (quote (s :v))))
    (composer/voice-assign p 16 (quote lead))
    p
  `
  const pool = evalSrc(env, fuel, src)
  // Mixer slot untouched — still has 'mixes' shape, not instrument.
  assert.ok(Array.isArray(pool.state.voices[15].mixes),
    'voice 16 stays a mixer')
  assert.equal(pool.state.voices[15].instrument, undefined)
})

test('voice-assign — voice id 0 (below range) silently rejected', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (define p (composer/voice-pool :bind (quote (s :v))))
    (composer/voice-assign p 0 (quote lead))
    p
  `
  const pool = evalSrc(env, fuel, src)
  // No slot modified (all voices 1..15 unchanged).
  for (let i = 0; i < 15; i++) {
    assert.equal(pool.state.voices[i].instrument, null,
      `voice ${i + 1} unchanged`)
  }
})

test('voice-assign — voice id 99 (way out of range) silent no-op', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (define p (composer/voice-pool :bind (quote (s :v))))
    (composer/voice-assign p 99 (quote lead))
    p
  `
  const pool = evalSrc(env, fuel, src)
  for (let i = 0; i < 15; i++) {
    assert.equal(pool.state.voices[i].instrument, null)
  }
})

test('voice-assign — spec is null (empty) does not crash', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (define p (composer/voice-pool :bind (quote (s :v))))
    (composer/voice-assign p 3 (quote ()))
    p
  `
  const res = tryEval(env, fuel, src)
  assert.equal(res.ok, true, 'null spec ok')
})

// ── composer/voice-mix-set (v1.1) ─────────────────────────────────

test('voice-mix-set — empty list clears mix', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (define p (composer/voice-pool :bind (quote (s :v))))
    (composer/voice-mix-set p (quote (1 2 3)))
    (composer/voice-mix-set p (quote ()))
    p
  `
  const pool = evalSrc(env, fuel, src)
  assert.deepEqual(pool.state.voices[15].mixes, [])
})

test('voice-mix-set — 15 unique ids fill the mixer', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (define p (composer/voice-pool :bind (quote (s :v))))
    (composer/voice-mix-set p (quote (1 2 3 4 5 6 7 8 9 10 11 12 13 14 15)))
    p
  `
  const pool = evalSrc(env, fuel, src)
  assert.equal(pool.state.voices[15].mixes.length, 15)
})

test('voice-mix-set — out-of-range ids filtered', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (define p (composer/voice-pool :bind (quote (s :v))))
    (composer/voice-mix-set p (quote (1 100 -5 3)))
    p
  `
  const pool = evalSrc(env, fuel, src)
  assert.deepEqual(pool.state.voices[15].mixes, [1, 3])
})

test('voice-mix-set — non-array argument silently produces empty mix', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (define p (composer/voice-pool :bind (quote (s :v))))
    (composer/voice-mix-set p 42)
    p
  `
  const res = tryEval(env, fuel, src)
  assert.equal(res.ok, true)
  assert.deepEqual(res.value.state.voices[15].mixes, [])
})

// ── voice-pool as widget (v1.1) — additional hostile probes ────────

test('voice-pool — round-trip on empty mix stays empty', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (song)))
      (composer/voice-pool :bind (quote (song :v))))
  `
  const canvas = evalSrc(env, fuel, src)
  const rt = roundTripSafe(env, canvas)
  assert.equal(rt.err, null)
  assert.equal(formatForm(rt.before), formatForm(rt.after))
})

test('voice-pool — apply of a form with garbage :mix survives', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (song)))
      (composer/voice-pool :bind (quote (song :v))))
  `
  const canvas = evalSrc(env, fuel, src)
  // Feed apply a synthetic canvas form with junk :mix.
  const junkForm = [
    sym('composer/canvas'),
    [sym(':bind'), [sym('quote'), [sym('song')]]],
    [sym('composer/voice-pool'),
      sym(':bind'), [sym('quote'), [sym('song'), sym(':v')]],
      sym(':steal'), [sym('quote'), sym('oldest')],
      sym(':mix'), [sym('quote'), 'not-a-list']],
  ]
  const apply = env.get('composer/apply')
  let err = null
  try { apply(canvas, junkForm) } catch (e) { err = e }
  assert.equal(err, null, 'apply tolerates bad :mix value')
})
