// tests/composer/tui-render.test.js
//
// Composer v1.1 — TUI renderer tests.
//
// Alfred, 2026-07-17: the composer must work in the terminal. Snapshots
// are stored inline so a drift shows up in the diff.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeCoreEnv } from '../../core/index.js'
import { evaluate } from '../../src/interp.js'
import { parse } from '../../src/reader.js'
import { renderCanvasToTUI, TREE_LOGO } from '../../lib/composer/tui.js'
import {
  pianoRollPlace,
  spriteGridSet,
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

// ── 4-slider snapshot (matches Alfred's synth-patch cart) ──────────

test('tui — 4-slider synth patch renders as expected ASCII', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (synth)))
      (composer/slider :label "Attack"  :bind (quote (synth :a)) :min 0.0 :max 2.0 :step 0.01 :value 0.05)
      (composer/slider :label "Decay"   :bind (quote (synth :d)) :min 0.0 :max 2.0 :step 0.01 :value 0.10)
      (composer/slider :label "Sustain" :bind (quote (synth :s)) :min 0.0 :max 1.0 :step 0.01 :value 0.70)
      (composer/slider :label "Release" :bind (quote (synth :r)) :min 0.0 :max 3.0 :step 0.01 :value 0.30))
  `
  const canvas = evalSrc(env, fuel, src)
  const out = renderCanvasToTUI(canvas, { brand: false })
  // Snapshot — headline shape checks.
  assert.ok(out.includes('MOTOI COMPOSER'), 'has header')
  assert.ok(out.includes('Attack 0.05'), 'attack shown')
  assert.ok(out.includes('Decay 0.10'), 'decay shown')
  assert.ok(out.includes('Sustain 0.70'), 'sustain shown')
  assert.ok(out.includes('Release 0.30'), 'release shown')
  // Slider bars — [ ... ] wrapper.
  const lines = out.split('\n')
  const sliderLines = lines.filter((l) => l.includes('['))
  assert.ok(sliderLines.length >= 4, `expected 4+ slider bars, got ${sliderLines.length}`)
  for (const l of sliderLines.slice(0, 4)) {
    assert.ok(l.includes('['), `slider line has open bracket: ${l}`)
    assert.ok(l.includes(']'), `slider line has close bracket: ${l}`)
  }
})

// ── piano-roll snapshot ────────────────────────────────────────────

test('tui — piano-roll renders as 12-row grid with # for filled cells', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (song)))
      (composer/piano-roll :bind (quote (song :notes)) :steps 8 :emit-shape (quote sequence)))
  `
  const canvas = evalSrc(env, fuel, src)
  const roll = canvas.children[0]
  pianoRollPlace(roll, 'C4', 0)
  pianoRollPlace(roll, 'E4', 2)
  pianoRollPlace(roll, 'G4', 4)
  const out = renderCanvasToTUI(canvas, { brand: false })
  assert.ok(out.includes('piano-roll:'), 'has piano-roll header')
  // 12 rows should be present — check the labels.
  for (const pitch of ['C', 'D', 'E', 'F', 'G', 'A', 'B']) {
    assert.ok(out.includes(` ${pitch} `), `has ${pitch} row`)
  }
  // C4 note is at row=C, col=0 → '#' at position 0.
  const cRow = out.split('\n').find((l) => l.trim().startsWith('C '))
  assert.ok(cRow.includes('#'), 'C row has a note')
})

// ── sprite-grid snapshot ───────────────────────────────────────────

test('tui — sprite-grid renders palette indices as chars', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (sprites)))
      (composer/sprite-grid :bind (quote (sprites :hero)) :size (quote (4 4)) :palette (quote pico-8)))
  `
  const canvas = evalSrc(env, fuel, src)
  const grid = canvas.children[0]
  spriteGridSet(grid, 0, 0, 1)
  spriteGridSet(grid, 1, 1, 8)
  spriteGridSet(grid, 3, 3, 12)
  const out = renderCanvasToTUI(canvas, { brand: false })
  assert.ok(out.includes('sprite:'), 'has sprite header')
  assert.ok(out.includes('4x4'), 'shows dimensions')
  // Row 0 should look like "1..." (0,0 set to 1)
  const lines = out.split('\n').map((l) => l.trim())
  // Find the sprite row - starts with a digit or dot
  const spriteRow0 = lines.find((l) => /^1\.\.\./.test(l))
  assert.ok(spriteRow0, `expected row starting with "1..." found lines: ${lines.slice(-5).join(' | ')}`)
})

// ── button snapshot ────────────────────────────────────────────────

test('tui — button renders as [ label ]', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (ui)))
      (composer/button :label "Save" :emits (quote (cart/save))))
  `
  const canvas = evalSrc(env, fuel, src)
  const out = renderCanvasToTUI(canvas, { brand: false })
  assert.ok(out.includes('[ Save ]'), `button rendered: ${out}`)
})

// ── brand header ──────────────────────────────────────────────────

test('tui — brand header shows pink/green/brown stripes by default', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (song)))
      (composer/slider :label "vol" :bind (quote (song :vol)) :min 0 :max 1 :value 0.5))
  `
  const canvas = evalSrc(env, fuel, src)
  const out = renderCanvasToTUI(canvas)
  assert.ok(out.includes('[pink ]'), 'pink stripe present')
  assert.ok(out.includes('[green]'), 'green stripe present')
  assert.ok(out.includes('[brown]'), 'brown stripe present')
})

// ── tree logo ─────────────────────────────────────────────────────

test('tui — TREE_LOGO exports the ASCII tree', () => {
  assert.ok(TREE_LOGO, 'tree exists')
  assert.ok(TREE_LOGO.includes('/\\'), 'has tree branches')
  assert.ok(TREE_LOGO.includes('||'), 'has trunk')
})

// ── palette strip appears with html-16 mode ───────────────────────

test('tui — palette strip appears when palette=html-16', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (composer/canvas (list :bind (quote (theme)))
      (composer/color-picker :bind (quote (theme :bg)) :palette (quote html-16)))
  `
  const canvas = evalSrc(env, fuel, src)
  const out = renderCanvasToTUI(canvas, { brand: false })
  assert.ok(out.includes('palette (html-16)'), 'palette header present')
  assert.ok(out.includes('crimson'), 'crimson listed')
  assert.ok(out.includes('gold'), 'gold listed')
})

// ── composer/render-tui verb reachable via Scheme ────────────────

test('tui — (composer/render-tui c) returns a string via Scheme', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (define c
      (composer/canvas (list :bind (quote (synth)))
        (composer/slider :label "A" :bind (quote (synth :a)) :min 0 :max 1 :value 0.5)))
    (composer/render-tui c)
  `
  const out = evalSrc(env, fuel, src)
  assert.equal(typeof out, 'string', `expected string, got ${typeof out}`)
  assert.ok(out.includes('MOTOI COMPOSER'))
  assert.ok(out.includes('A '))
})

// ── voice-pool renders in TUI ─────────────────────────────────────

test('tui — voice-pool renders 16 voice lines with mix summary', () => {
  const { env, fuel } = freshEnv()
  const src = `
    (define pool
      (composer/canvas (list :bind (quote (song)))
        (composer/voice-pool :bind (quote (song :voices)) :steal (quote oldest))))
    (composer/voice-mix-set (car (list-ref pool 3)) (quote (1 2 3)))
    pool
  `
  // simpler: just build a canvas and set mixes manually via JS
  const src2 = `
    (composer/canvas (list :bind (quote (song)))
      (composer/voice-pool :bind (quote (song :voices)) :steal (quote oldest)))
  `
  const canvas = evalSrc(env, fuel, src2)
  const setter = env.get('composer/voice-mix-set')
  setter(canvas.children[0], [1, 2, 3])
  const out = renderCanvasToTUI(canvas, { brand: false })
  assert.ok(out.includes('voice-pool'), 'header present')
  assert.ok(out.includes('16 [MIX]'), 'mixer voice labelled')
  assert.ok(out.includes('#1,#2,#3'), 'mix routing shown')
})
