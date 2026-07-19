// tests/composer/hunt-roundtrip.test.js
//
// Zane #1 — Composer v1.1 round-trip HUNT.
//
// Every case here is a probe for a case where
//   emit(apply(x)) != x   OR   apply(emit(c)) != c
// where "apply(emit(c))" means: emit -> serialize -> load into a FRESH
// canvas (via composer/save + composer/load, i.e. reconstructCanvasFromForm)
// and check the reconstructed canvas re-emits the same form.
//
// The existing round-trip.test.js is WEAK: it calls apply(canvas, emit(canvas))
// on the SAME canvas, so apply mutating little/nothing still passes because
// emit reads state that was never touched. To hunt real drift, we also
// exercise save + load (fresh reconstruction) and cross-apply (form from
// canvas A into canvas B).
//
// This file DOCUMENTS. Nothing is fixed here. test.todo() marks cases we
// could not reproduce or that require infrastructure we don't have.

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
import { unlinkSync } from 'node:fs'

function freshEnv() {
  const fuel = { n: 5_000_000 }
  return { env: makeCoreEnv({ fuel }), fuel }
}

function evalSrc(env, fuel, src) {
  const forms = parse(src)
  let out
  for (const f of forms) out = evaluate(f, env, fuel)
  return out
}

// Save canvas to disk, load it back, return the reconstructed canvas.
function saveLoadRoundTrip(env, canvas) {
  const save = env.get('composer/save')
  const load = env.get('composer/load')
  // Sandbox (2026-07-17): composer/save requires a path under cwd() or
  // ~/.motoi/. /tmp is outside allowed roots.
  const path = `${process.cwd()}/scratch/motoi-hunt-${process.pid}-${Math.random().toString(36).slice(2)}.slat`
  save(canvas, path)
  try {
    return { loaded: load(path), path }
  } catch (e) {
    return { loaded: null, path, err: e }
  }
}

function cleanup(path) {
  try { unlinkSync(path) } catch { /* ignore */ }
}

// Assert: emit(canvas) equals emit(save+load(canvas)).
function assertSaveLoadStable(env, canvas, label) {
  const emit = env.get('composer/emit')
  const before = emit(canvas)
  const { loaded, path, err } = saveLoadRoundTrip(env, canvas)
  cleanup(path)
  if (err) throw err
  const after = emit(loaded)
  const bs = formatForm(before)
  const as = formatForm(after)
  assert.equal(as, bs, `${label}: save/load drift\n  before: ${bs}\n  after:  ${as}`)
}

// ─────────────────────────────────────────────────────────────────────
// CLASS 1 — Deep nesting: canvas containing canvas containing canvas
// ─────────────────────────────────────────────────────────────────────

test('HUNT 1a — canvas-in-canvas one level: nested canvas dropped on load', () => {
  // BUG: instantiateWidgetFromForm has no case for 'composer/canvas'
  // so a saved nested canvas is dropped when reconstructing.
  // Expected: nested canvas is preserved.
  // Actual:   nested canvas is dropped (children -> [] after load).
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (outer)))
      (composer/slider :label "vol" :bind (quote (outer :vol)) :min 0 :max 1 :value 0.5))
  `
  const outer = evalSrc(env, fuel, src)
  // Manually nest an inner canvas as a child so we exercise emit-of-child-canvas.
  const innerSrc = `
    (composer/canvas (list :bind (quote (inner)))
      (composer/slider :label "pan" :bind (quote (inner :pan)) :min -1 :max 1 :value 0))
  `
  const inner = evalSrc(env, fuel, innerSrc)
  outer.children.push(inner)
  assert.equal(outer.children.length, 2, 'outer has slider + inner canvas')

  const emit = env.get('composer/emit')
  const beforeForm = emit(outer)
  const beforeStr = formatForm(beforeForm)
  // Emit DOES include nested canvas (emitWidgetDeclaration → case 'canvas').
  assert.ok(beforeStr.includes('(composer/canvas'), 'nested canvas appears twice')
  // Now save+load.
  assertSaveLoadStable(env, outer, 'nested canvas 1 level')
})

test('HUNT 1b — 10-level canvas nesting: total collapse on load', () => {
  // BUG: same root cause as 1a. Ten deep nested canvases collapse to one.
  const { env, fuel } = freshEnv()
  const emit = env.get('composer/emit')
  const load = env.get('composer/load')
  const save = env.get('composer/save')

  // Build 10 nested canvases.
  const buildInner = (depth) => {
    const src = `
      (composer/canvas (list :bind (quote (depth${depth})))
        (composer/slider :label "s${depth}" :bind (quote (d${depth} :v)) :min 0 :max 1 :value 0.${depth}))
    `
    return evalSrc(env, fuel, src)
  }
  const root = buildInner(0)
  let cur = root
  for (let d = 1; d < 10; d++) {
    const c = buildInner(d)
    cur.children.push(c)
    cur = c
  }
  const before = emit(root)
  const beforeStr = formatForm(before)
  // Expect 10 (composer/canvas occurrences in emit.
  const beforeCount = (beforeStr.match(/composer\/canvas/g) || []).length
  assert.equal(beforeCount, 10, 'emit has 10 canvas forms')

  const path = `${process.cwd()}/scratch/motoi-hunt-10lvl-${process.pid}.slat`
  save(root, path)
  const loaded = load(path)
  const afterStr = formatForm(emit(loaded))
  const afterCount = (afterStr.match(/composer\/canvas/g) || []).length
  cleanup(path)
  // Expected 10, actual 1 (only root reconstructs).
  assert.equal(afterCount, beforeCount,
    `10-level nesting collapsed on load: before=${beforeCount} after=${afterCount}`)
})

// ─────────────────────────────────────────────────────────────────────
// CLASS 2 — Cyclic refs (widget A binds path to B, B to A)
// ─────────────────────────────────────────────────────────────────────

test.todo('HUNT 2 — cyclic :bind paths (A→B, B→A)', () => {
  // Bind paths are just data — not JS references — so they can't create
  // an object cycle. This is a semantic cycle: two sliders bind to each
  // other's namespaces. Composer does not track binding semantics; it
  // just stores names. No bug reproducible at the composer layer.
  // TODO if/when bind graph resolution lands (SC verb layer).
})

// ─────────────────────────────────────────────────────────────────────
// CLASS 3 — Empty widgets
// ─────────────────────────────────────────────────────────────────────

test('HUNT 3a — canvas with 0 widgets: OK', () => {
  const { env, fuel } = freshEnv()
  const canvas = evalSrc(env, fuel, '(composer/canvas (list :bind (quote (empty))))')
  assert.equal(canvas.children.length, 0)
  assertSaveLoadStable(env, canvas, 'empty canvas')
})

test('HUNT 3b — piano-roll with 0 steps: emit uses steps=0', () => {
  // Not necessarily a bug — user may want 0 steps. Round-trip should hold.
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (song)))
      (composer/piano-roll :bind (quote (song :n)) :steps 0 :emit-shape (quote sequence)))
  `
  const canvas = evalSrc(env, fuel, src)
  assert.equal(canvas.children[0].opts.steps, 0)
  assertSaveLoadStable(env, canvas, 'piano-roll steps=0')
})

test('HUNT 3c — sprite-grid 0×0: pixels array is empty, round-trip', () => {
  // BUG SUSPECTED: makeSpriteGrid loops h times, w=0 gives empty rows.
  // Emit uses w/h from opts and pixels state — but state.pixels was built at
  // 0×0 so emitting sprite/from-grid yields '(). Load should reconstruct.
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (s)))
      (composer/sprite-grid :bind (quote (s :hero)) :size (quote (0 0)) :palette (quote pico-8)))
  `
  const canvas = evalSrc(env, fuel, src)
  assert.equal(canvas.children[0].opts.w, 0)
  assert.equal(canvas.children[0].opts.h, 0)
  assertSaveLoadStable(env, canvas, 'sprite-grid 0x0')
})

// ─────────────────────────────────────────────────────────────────────
// CLASS 4 — Malformed :bind paths
// ─────────────────────────────────────────────────────────────────────

test('HUNT 4a — empty :bind list', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote ()))
      (composer/slider :label "x" :bind (quote ()) :min 0 :max 1 :value 0.5))
  `
  const canvas = evalSrc(env, fuel, src)
  assert.deepEqual(canvas.bind, [])
  assert.deepEqual(canvas.children[0].bind, [])
  assertSaveLoadStable(env, canvas, 'empty bind list')
})

test('HUNT 4b — nested keywords in :bind path', () => {
  // (:foo :bar) — keywords as path segments. pathToNames just strings them,
  // but namesToPath makes syms named ":foo" which format as :foo — and when
  // re-read, the reader will parse them as keyword syms again.
  // Likely round-trip is OK, but the ':' prefix may confuse extractKws
  // during load — a child's :bind '(:foo :bar) may confuse the kw parser
  // if it appears in an unexpected position.
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (:root)))
      (composer/slider :label "x" :bind (quote (:a :b)) :min 0 :max 1 :value 0.5))
  `
  const canvas = evalSrc(env, fuel, src)
  assertSaveLoadStable(env, canvas, 'nested keywords in bind')
})

test('HUNT 4c — unicode symbols in :bind path', () => {
  const { env, fuel } = freshEnv()
  // A sym like 花 (flower). Reader supports non-ASCII identifiers?
  // If parse fails on load, save/load round-trip breaks.
  const src = `
    (composer/canvas (list :bind (quote (音楽)))
      (composer/slider :label "vol" :bind (quote (音楽 :vol)) :min 0 :max 1 :value 0.5))
  `
  const canvas = evalSrc(env, fuel, src)
  assertSaveLoadStable(env, canvas, 'unicode bind path')
})

test('HUNT 4d — very long :bind path (100 segments)', () => {
  const { env, fuel } = freshEnv()
  const segs = Array.from({ length: 100 }, (_, i) => `seg${i}`).join(' ')
  const src = `
    (composer/canvas (list :bind (quote (${segs})))
      (composer/slider :label "x" :bind (quote (${segs})) :min 0 :max 1 :value 0.5))
  `
  const canvas = evalSrc(env, fuel, src)
  assert.equal(canvas.bind.length, 100)
  assertSaveLoadStable(env, canvas, '100-segment bind path')
})

// ─────────────────────────────────────────────────────────────────────
// CLASS 5 — Unicode + emoji in :label, :title, :name fields
// ─────────────────────────────────────────────────────────────────────

test('HUNT 5a — emoji in slider :label', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (s)))
      (composer/slider :label "Volume 🔊" :bind (quote (s :v)) :min 0 :max 1 :value 0.5))
  `
  const canvas = evalSrc(env, fuel, src)
  assert.equal(canvas.children[0].opts.label, 'Volume 🔊')
  assertSaveLoadStable(env, canvas, 'emoji label')
})

test('HUNT 5b — CJK + zero-width joiner in text-field value', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (m)))
      (composer/text-field :bind (quote (m :t)) :label "タイトル" :value "こんにちは世界"))
  `
  const canvas = evalSrc(env, fuel, src)
  assert.equal(canvas.children[0].state.value, 'こんにちは世界')
  assertSaveLoadStable(env, canvas, 'CJK label + value')
})

test('HUNT 5c — string with embedded double-quote in label', () => {
  const { env, fuel } = freshEnv()
  // formatForm uses JSON.stringify for strings → escapes " correctly.
  // But if reader chokes on the escape, round-trip breaks.
  const src = `
    (composer/canvas (list :bind (quote (s)))
      (composer/slider :label "he said \\"hi\\"" :bind (quote (s :v)) :min 0 :max 1 :value 0.5))
  `
  const canvas = evalSrc(env, fuel, src)
  assertSaveLoadStable(env, canvas, 'embedded quote in label')
})

// ─────────────────────────────────────────────────────────────────────
// CLASS 6 — Boolean/number/nil in string-expected fields
// ─────────────────────────────────────────────────────────────────────

test('HUNT 6a — slider :label is a number (5) not a string', () => {
  // Not a bug per se — makeSlider coerces via String(nm(opts.label)).
  // But emit will format label as `5` (a number literal), and on load,
  // parse reads `5` as number, apply coerces back to "5". Test drift.
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (s)))
      (composer/slider :label 5 :bind (quote (s :v)) :min 0 :max 1 :value 0.5))
  `
  const canvas = evalSrc(env, fuel, src)
  assert.equal(canvas.children[0].opts.label, '5', 'coerced to string on build')
  assertSaveLoadStable(env, canvas, 'numeric label')
  // The label survives as "5" through save/load? formatForm(5) = "5",
  // reader parses "5" as number, makeSlider coerces to "5" again.
})

test('HUNT 6b — toggle :label is nil (empty list)', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (m)))
      (composer/toggle :bind (quote (m :on)) :label (quote ()) :value #f))
  `
  const canvas = evalSrc(env, fuel, src)
  // makeToggle: label != null → String(nm([])) → "" (Array becomes "")
  assertSaveLoadStable(env, canvas, 'nil label toggle')
})

test('HUNT 6c — button :emits is nil', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (m)))
      (composer/button :label "click" :emits (quote ())))
  `
  const canvas = evalSrc(env, fuel, src)
  assertSaveLoadStable(env, canvas, 'nil emits button')
})

// ─────────────────────────────────────────────────────────────────────
// CLASS 7 — Very large canvases
// ─────────────────────────────────────────────────────────────────────

test('HUNT 7a — canvas with 100 sliders', () => {
  const { env, fuel } = freshEnv()
  const parts = Array.from({ length: 100 }, (_, i) =>
    `(composer/slider :label "s${i}" :bind (quote (c :s${i})) :min 0 :max 1 :value 0.${i % 10})`
  ).join('\n      ')
  const src = `(composer/canvas (list :bind (quote (c))) ${parts})`
  const canvas = evalSrc(env, fuel, src)
  assert.equal(canvas.children.length, 100)
  assertSaveLoadStable(env, canvas, '100 sliders')
})

test('HUNT 7b — piano-roll with 1000 steps + 500 notes', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (song)))
      (composer/piano-roll :bind (quote (song :n)) :steps 1000 :emit-shape (quote sequence)))
  `
  const canvas = evalSrc(env, fuel, src)
  const roll = canvas.children[0]
  const pitches = ['C4', 'D4', 'E4', 'F4', 'G4']
  for (let i = 0; i < 500; i++) {
    pianoRollPlace(roll, pitches[i % 5], i, { vel: 0.5, dur: 1 })
  }
  assert.equal(roll.state.notes.length, 500)
  // Emit contains notes because emitWidgetTarget serializes notes — but
  // emitWidgetDeclaration does NOT serialize state.notes. So round-trip
  // through save/load LOSES ALL NOTES.
  // BUG: piano-roll's emit-declaration omits notes; load reconstructs an
  // empty piano-roll. High severity for song save/load.
  const emit = env.get('composer/emit')
  const before = emit(canvas)
  const beforeStr = formatForm(before)
  // Load-side has no notes to reconstruct.
  const { loaded, path } = saveLoadRoundTrip(env, canvas)
  cleanup(path)
  assert.equal(loaded.children[0].state.notes.length, 500,
    `notes lost on save/load: had 500, loaded has ${loaded.children[0].state.notes.length}`)
})

// ─────────────────────────────────────────────────────────────────────
// CLASS 8 — Voice-16 self-reference and cycles (v11)
// ─────────────────────────────────────────────────────────────────────

test('HUNT 8a — voice/mix rejects voice 16 (mixer cannot self-reference)', () => {
  const { env, fuel } = freshEnv()
  // 16 is the mixer itself — should be rejected.
  const mix = evalSrc(env, fuel, "(voice/mix (quote (1 2 16 15)))")
  // Test source is [1, 2, 16, 15] — 15 and 1 and 2 are valid, 16 is not.
  assert.deepEqual(mix.voices, [1, 2, 15], 'mixer self-ref stripped')
})

test('HUNT 8b — voice-pool mix set with self-ref (16) then round-trip', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (song)))
      (composer/voice-pool :bind (quote (song :v)) :steal (quote oldest)))
  `
  const canvas = evalSrc(env, fuel, src)
  const setter = env.get('composer/voice-mix-set')
  setter(canvas.children[0], [1, 16, 2, 16, 3])  // dupes + self-refs
  assert.deepEqual(canvas.children[0].state.voices[15].mixes, [1, 2, 3],
    'mixer dedup + self-ref strip')
  assertSaveLoadStable(env, canvas, 'voice-pool mix with self-ref')
})

test('HUNT 8c — voice-pool assignments (voices 1..15) LOST on save/load', () => {
  // BUG (v11): emitVoicePoolDeclaration only emits :bind, :steal, :mix.
  // It does NOT emit the instrument/pitch/at/dur/vel state of voices 1..15.
  // A live-assigned pool loses ALL its instrument assignments on save/load.
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (song)))
      (composer/voice-pool :bind (quote (song :v)) :steal (quote oldest)))
  `
  const canvas = evalSrc(env, fuel, src)
  const assign = env.get('composer/voice-assign')
  assign(canvas.children[0], 1, sym('lead'))
  assign(canvas.children[0], 3, sym('bass'))
  assert.equal(canvas.children[0].state.voices[0].instrument, 'lead')
  assert.equal(canvas.children[0].state.voices[2].instrument, 'bass')
  const { loaded, path } = saveLoadRoundTrip(env, canvas)
  cleanup(path)
  assert.equal(loaded.children[0].state.voices[0].instrument, 'lead',
    `voice 1 assignment lost on save/load: got ${loaded.children[0].state.voices[0].instrument}`)
  assert.equal(loaded.children[0].state.voices[2].instrument, 'bass',
    `voice 3 assignment lost on save/load: got ${loaded.children[0].state.voices[2].instrument}`)
})

// ─────────────────────────────────────────────────────────────────────
// CLASS 9 — song/config with :voices > 16, = 0, = -1, = 1.5
// ─────────────────────────────────────────────────────────────────────

test('HUNT 9a — song/config :voices 0 clamped to 1', () => {
  const { env, fuel } = freshEnv()
  const cfg = evalSrc(env, fuel, '(song/config :voices 0)')
  assert.equal(cfg.voices, 1)
  assert.ok(cfg.warnings.length > 0)
})

test('HUNT 9b — song/config :voices -1 clamped to 1', () => {
  const { env, fuel } = freshEnv()
  const cfg = evalSrc(env, fuel, '(song/config :voices -1)')
  assert.equal(cfg.voices, 1)
  assert.ok(cfg.warnings.length > 0)
})

test('HUNT 9c — song/config :voices 1.5 (fractional) — kept as 1.5, not clamped', () => {
  // BUG: makeSongConfig does Number(opts.voices ?? 16) — 1.5 stays 1.5.
  // Doesn't clamp non-integer. May desync from voice-pool (fixed 16).
  const { env, fuel } = freshEnv()
  const cfg = evalSrc(env, fuel, '(song/config :voices 1.5)')
  // Expect either clamped to 1 or 2, or a warning about non-integer.
  assert.ok(Number.isInteger(cfg.voices),
    `voices should be an integer, got ${cfg.voices}`)
})

test('HUNT 9d — song/config :voices NaN via string', () => {
  const { env, fuel } = freshEnv()
  // Number("hello") → NaN → passes > 16 check (NaN > 16 = false) and
  // < 1 check (NaN < 1 = false) → voices ends up NaN.
  const cfg = evalSrc(env, fuel, '(song/config :voices "hello")')
  assert.ok(Number.isFinite(cfg.voices),
    `voices should be a finite number, got ${cfg.voices}`)
})

// ─────────────────────────────────────────────────────────────────────
// CLASS 10 — Round-trip after apply of a partial form (fewer widgets)
// ─────────────────────────────────────────────────────────────────────

test('HUNT 10a — apply a shorter form: widgets NOT in form retain state', () => {
  // Documented behavior: applyForm updates the OVERLAP only. So a canvas
  // with 5 widgets receiving a form with 3 widget forms updates the first
  // 3 and leaves 4,5 alone. Not a bug — but callers may assume it prunes.
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (c)))
      (composer/slider :label "a" :bind (quote (c :a)) :min 0 :max 1 :value 0.1)
      (composer/slider :label "b" :bind (quote (c :b)) :min 0 :max 1 :value 0.2)
      (composer/slider :label "c" :bind (quote (c :c)) :min 0 :max 1 :value 0.3))
  `
  const canvas = evalSrc(env, fuel, src)
  // Build a partial form with only 1 slider updated.
  const partial = [
    sym('composer/canvas'),
    [sym(':bind'), [sym('quote'), [sym('c')]]],
    [sym('composer/slider'),
      sym(':label'), 'a',
      sym(':bind'), [sym('quote'), [sym('c'), sym(':a')]],
      sym(':value'), 0.9],
  ]
  const apply = env.get('composer/apply')
  apply(canvas, partial)
  assert.equal(canvas.children[0].state.value, 0.9, 'first updated')
  assert.equal(canvas.children[1].state.value, 0.2, 'second untouched')
  assert.equal(canvas.children[2].state.value, 0.3, 'third untouched')
})

test('HUNT 10b — apply a LONGER form: extra widgets silently ignored', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (c)))
      (composer/slider :label "a" :bind (quote (c :a)) :min 0 :max 1 :value 0.1))
  `
  const canvas = evalSrc(env, fuel, src)
  const longer = [
    sym('composer/canvas'),
    [sym(':bind'), [sym('quote'), [sym('c')]]],
    [sym('composer/slider'), sym(':label'), 'a',
     sym(':bind'), [sym('quote'), [sym('c'), sym(':a')]], sym(':value'), 0.7],
    [sym('composer/slider'), sym(':label'), 'b',
     sym(':bind'), [sym('quote'), [sym('c'), sym(':b')]], sym(':value'), 0.8],
  ]
  const apply = env.get('composer/apply')
  apply(canvas, longer)
  assert.equal(canvas.children.length, 1, 'no widget added by apply (documented)')
  assert.equal(canvas.children[0].state.value, 0.7, 'first updated')
})

// ─────────────────────────────────────────────────────────────────────
// EXTRA — DRIFT via applyForm not restoring state (per-widget)
// ─────────────────────────────────────────────────────────────────────

test('HUNT X1 — sprite-grid pixels NOT preserved on save/load', () => {
  // BUG: emitWidgetDeclaration for sprite-grid does not include pixel state.
  // A drawn sprite -> save -> load -> blank sprite.
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (s)))
      (composer/sprite-grid :bind (quote (s :hero)) :size (quote (8 8)) :palette (quote pico-8)))
  `
  const canvas = evalSrc(env, fuel, src)
  const grid = canvas.children[0]
  spriteGridSet(grid, 2, 2, 8)
  spriteGridSet(grid, 5, 5, 12)
  const { loaded, path } = saveLoadRoundTrip(env, canvas)
  cleanup(path)
  assert.equal(loaded.children[0].state.pixels[2][2], 8,
    `sprite pixel lost: got ${loaded.children[0].state.pixels[2][2]}`)
  assert.equal(loaded.children[0].state.pixels[5][5], 12,
    `sprite pixel lost: got ${loaded.children[0].state.pixels[5][5]}`)
})

test('HUNT X2 — tile-map cells NOT preserved on save/load', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (lvl)))
      (composer/tile-map :bind (quote (lvl :m)) :size (quote (8 8))))
  `
  const canvas = evalSrc(env, fuel, src)
  tileMapSet(canvas.children[0], 3, 4, 7)
  const { loaded, path } = saveLoadRoundTrip(env, canvas)
  cleanup(path)
  assert.equal(loaded.children[0].state.cells['3,4'], 7,
    `tile cell lost: got ${loaded.children[0].state.cells['3,4']}`)
})

test('HUNT X3 — timeline frames NOT preserved on save/load', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (anim)))
      (composer/timeline :bind (quote (anim :hero)) :entities (quote (hero)) :duration 60 :fps 30))
  `
  const canvas = evalSrc(env, fuel, src)
  timelinePlace(canvas.children[0], 'hero', 0, [100, 100])
  timelinePlace(canvas.children[0], 'hero', 30, [200, 200])
  const { loaded, path } = saveLoadRoundTrip(env, canvas)
  cleanup(path)
  const frames = loaded.children[0].state.frames.hero || []
  assert.equal(frames.length, 2,
    `timeline frames lost: had 2, loaded has ${frames.length}`)
})

test('HUNT X4 — fx-chain chain NOT preserved on save/load', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (s)))
      (composer/fx-chain :bind (quote (s :fx)) :available (quote (fx/reverb fx/delay))))
  `
  const canvas = evalSrc(env, fuel, src)
  fxChainAdd(canvas.children[0], 'fx/reverb', { wet: 0.4 })
  fxChainAdd(canvas.children[0], 'fx/delay', { time: 0.25 })
  const { loaded, path } = saveLoadRoundTrip(env, canvas)
  cleanup(path)
  assert.equal(loaded.children[0].state.chain.length, 2,
    `fx-chain lost: had 2, loaded has ${loaded.children[0].state.chain.length}`)
})

test('HUNT X5 — instrument-picker :chosen NOT preserved on save/load', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (s)))
      (composer/instrument-picker :bind (quote (s :w)) :choices (quote (sine square triangle))))
  `
  const canvas = evalSrc(env, fuel, src)
  pickerChoose(canvas.children[0], 'triangle')
  assert.equal(canvas.children[0].state.chosen, 'triangle')
  const { loaded, path } = saveLoadRoundTrip(env, canvas)
  cleanup(path)
  assert.equal(loaded.children[0].state.chosen, 'triangle',
    `chosen lost: got ${loaded.children[0].state.chosen}`)
})

test('HUNT X6 — slider :value survives save/load (baseline good case)', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (s)))
      (composer/slider :label "vol" :bind (quote (s :v)) :min 0 :max 1 :value 0.5))
  `
  const canvas = evalSrc(env, fuel, src)
  sliderSet(canvas.children[0], 0.77)
  assertSaveLoadStable(env, canvas, 'slider value save/load')
  const { loaded, path } = saveLoadRoundTrip(env, canvas)
  cleanup(path)
  assert.equal(loaded.children[0].state.value, 0.77, 'slider value survives')
})

test('HUNT X7 — piano-roll :range dotted-pair notation broken on emit', () => {
  // BUG: emit writes range as '(C3 . C6) using a Sym('.') sentinel.
  // formatForm outputs "(C3 . C6)". Reader may parse "." as a sym; when
  // apply reads the range back it may fail to reconstruct.
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (song)))
      (composer/piano-roll :bind (quote (song :n)) :steps 16 :emit-shape (quote sequence)))
  `
  const canvas = evalSrc(env, fuel, src)
  const roll = canvas.children[0]
  // Default range is [C3, C6] — check emit output.
  const emit = env.get('composer/emit')
  const before = emit(canvas)
  const beforeStr = formatForm(before)
  // Try save+load — reader may reject the dot.
  let loadErr = null
  const { loaded, path, err } = saveLoadRoundTrip(env, canvas)
  cleanup(path)
  if (err) loadErr = err
  assert.equal(loadErr, null,
    `save/load failed on dotted-pair range: ${loadErr?.message ?? ''}\n  emitted: ${beforeStr}`)
})

test('HUNT X8 — color-picker :palette opt NOT emitted, lost on load', () => {
  // BUG: emitWidgetDeclaration for color-picker only emits :bind and :value,
  // not :palette. On load, palette defaults back to null even if user set
  // 'pico-8'. Round-trip drops palette.
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (theme)))
      (composer/color-picker :bind (quote (theme :bg)) :palette (quote pico-8)))
  `
  const canvas = evalSrc(env, fuel, src)
  assert.equal(canvas.children[0].opts.palette, 'pico-8')
  const { loaded, path } = saveLoadRoundTrip(env, canvas)
  cleanup(path)
  assert.equal(loaded.children[0].opts.palette, 'pico-8',
    `palette lost: got ${loaded.children[0].opts.palette}`)
})

test('HUNT X9 — button :bind not emitted, lost on load', () => {
  // BUG: emitWidgetDeclaration for button emits :label + :emits ONLY.
  // No :bind. Load rebuilds a button with bind=[].
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (m)))
      (composer/button :label "Save" :bind (quote (m :save-btn)) :emits (quote (cart/save))))
  `
  const canvas = evalSrc(env, fuel, src)
  assert.deepEqual(canvas.children[0].bind, ['m', ':save-btn'])
  const { loaded, path } = saveLoadRoundTrip(env, canvas)
  cleanup(path)
  assert.deepEqual(loaded.children[0].bind, ['m', ':save-btn'],
    `button bind lost: got ${JSON.stringify(loaded.children[0].bind)}`)
})

test('HUNT X10 — live-code :source NOT preserved on save/load', () => {
  // BUG: emit for live-code has only :bind. state.source is dropped.
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (t)))
      (composer/live-code :bind (quote (t :src))))
  `
  const canvas = evalSrc(env, fuel, src)
  canvas.children[0].state.source = '(display "hi")'
  const { loaded, path } = saveLoadRoundTrip(env, canvas)
  cleanup(path)
  assert.equal(loaded.children[0].state.source, '(display "hi")',
    `live-code source lost: got "${loaded.children[0].state.source}"`)
})

test('HUNT X11 — text-field :bind survives save/load', () => {
  // Sanity — text-field emits :bind + :label + :value.
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (m)))
      (composer/text-field :bind (quote (m :title)) :label "Title" :value "untitled"))
  `
  const canvas = evalSrc(env, fuel, src)
  textFieldSet(canvas.children[0], 'my song')
  const { loaded, path } = saveLoadRoundTrip(env, canvas)
  cleanup(path)
  assert.equal(loaded.children[0].state.value, 'my song', 'text-field value survives')
})

test('HUNT X12 — apply cross-canvas: form from canvas A into canvas B', () => {
  // Not a bug — documented that apply only updates overlap by index.
  // But important because it's how the "identity" test would actually
  // detect drift. Confirms current apply is index-based, kind-agnostic.
  const { env, fuel } = freshEnv()
  const a = evalSrc(env, fuel, `
    (composer/canvas (list :bind (quote (a)))
      (composer/slider :label "x" :bind (quote (a :x)) :min 0 :max 1 :value 0.9))
  `)
  const b = evalSrc(env, fuel, `
    (composer/canvas (list :bind (quote (b)))
      (composer/toggle :bind (quote (b :on)) :label "on" :value #f))
  `)
  const emit = env.get('composer/emit')
  const apply = env.get('composer/apply')
  const formA = emit(a)
  apply(b, formA)
  // b's toggle received a slider form — the apply switch for 'toggle'
  // reads kws.value which is 0.9 (number). value === true → false.
  // Silent kind mismatch, no error thrown.
  assert.equal(b.children[0].kind, 'toggle', 'kind unchanged')
  assert.equal(b.children[0].state.value, false, 'wrong-kind apply silently no-op')
})
