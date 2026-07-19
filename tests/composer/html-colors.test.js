// tests/composer/html-colors.test.js
//
// Composer v1.1 — 16 HTML color names as canonical palette.
//
// Alfred, 2026-07-17: "kids recognize gold and coral; nobody recognizes
// color 9." Palette-indexed NAMED_COLORS (framebuffer.js) stays for
// back-compat; the composer's default palette becomes HTML-16.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeCoreEnv } from '../../core/index.js'
import { evaluate } from '../../src/interp.js'
import { parse, Sym } from '../../src/reader.js'
import {
  NAMED_COLORS_HTML,
  NAMED_COLORS_HTML_ORDER,
  colorNamed,
  colorNameOf,
  BRAND_STRIPES,
} from '../../lib/graphics/named-colors-html.js'

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

// ── palette invariants ────────────────────────────────────────────

test('html-colors — exactly 16 entries', () => {
  const keys = Object.keys(NAMED_COLORS_HTML)
  assert.equal(keys.length, 16, `expected 16 palette entries, got ${keys.length}`)
  assert.equal(NAMED_COLORS_HTML_ORDER.length, 16, '_ORDER also has 16')
})

test('html-colors — Alfred required set present', () => {
  const required = [
    'black', 'white', 'crimson', 'forestgreen',
    'peachpuff', 'gold', 'coral', 'plum',
    'teal', 'sienna', 'pink',
  ]
  for (const name of required) {
    assert.ok(name in NAMED_COLORS_HTML, `missing required palette entry: ${name}`)
  }
})

test('html-colors — all hex values are valid #rrggbb', () => {
  for (const [name, hex] of Object.entries(NAMED_COLORS_HTML)) {
    assert.ok(/^#[0-9a-f]{6}$/.test(hex), `${name}: bad hex ${hex}`)
  }
})

test('html-colors — insertion order matches _ORDER', () => {
  const keys = Object.keys(NAMED_COLORS_HTML)
  assert.deepEqual(keys, [...NAMED_COLORS_HTML_ORDER],
    'palette order drifted from _ORDER')
})

// ── colorNamed / colorNameOf ──────────────────────────────────────

test('html-colors — colorNamed known name returns hex', () => {
  assert.equal(colorNamed('crimson'), '#dc143c')
  assert.equal(colorNamed('CRIMSON'), '#dc143c', 'case insensitive')
  assert.equal(colorNamed('gold'), '#ffd700')
})

test('html-colors — colorNamed unknown returns null', () => {
  assert.equal(colorNamed('chartreuse'), null, 'not in HTML-16 palette')
  assert.equal(colorNamed('rebeccapurple'), null)
  assert.equal(colorNamed(''), null)
})

test('html-colors — colorNameOf exact hex returns palette name', () => {
  assert.equal(colorNameOf('#dc143c'), 'crimson')
  assert.equal(colorNameOf('#000000'), 'black')
  assert.equal(colorNameOf('#ffffff'), 'white')
  assert.equal(colorNameOf('#ffd700'), 'gold')
})

test('html-colors — colorNameOf near-hex returns nearest palette name', () => {
  // A shade of red near crimson should map to crimson (not pink).
  assert.equal(colorNameOf('#d81b3f'), 'crimson', 'near-crimson maps to crimson')
  // Near-black.
  assert.equal(colorNameOf('#020202'), 'black')
})

test('html-colors — colorNameOf accepts 3-digit hex shorthand', () => {
  assert.equal(colorNameOf('#000'), 'black')
  assert.equal(colorNameOf('#fff'), 'white')
})

test('html-colors — colorNameOf malformed returns null', () => {
  assert.equal(colorNameOf('not-a-hex'), null)
  assert.equal(colorNameOf('#gggggg'), null)
  assert.equal(colorNameOf(''), null)
})

// ── brand stripes ─────────────────────────────────────────────────

test('html-colors — BRAND_STRIPES has pink/green/brown from palette', () => {
  assert.ok(BRAND_STRIPES.pink)
  assert.ok(BRAND_STRIPES.green)
  assert.ok(BRAND_STRIPES.brown)
  // Each is a valid palette hex.
  const palValues = new Set(Object.values(NAMED_COLORS_HTML))
  assert.ok(palValues.has(BRAND_STRIPES.pink), 'pink stripe from palette')
  assert.ok(palValues.has(BRAND_STRIPES.green), 'green stripe from palette')
  assert.ok(palValues.has(BRAND_STRIPES.brown), 'brown stripe from palette')
})

// ── Scheme verb bindings ──────────────────────────────────────────

test('html-colors — (color/named ...) reachable from Scheme', () => {
  const { env, fuel } = freshEnv()
  const hex = evalSrc(env, fuel, "(color/named (quote crimson))")
  assert.equal(hex, '#dc143c')
})

test('html-colors — (color/name-of ...) returns Sym from Scheme', () => {
  const { env, fuel } = freshEnv()
  const nameSym = evalSrc(env, fuel, '(color/name-of "#dc143c")')
  assert.ok(nameSym instanceof Sym, `expected Sym, got ${typeof nameSym}`)
  assert.equal(nameSym.name, 'crimson')
})

test('html-colors — (color/palette-html-16) returns 16 Syms', () => {
  const { env, fuel } = freshEnv()
  const palette = evalSrc(env, fuel, '(color/palette-html-16)')
  assert.ok(Array.isArray(palette))
  assert.equal(palette.length, 16)
  for (const s of palette) assert.ok(s instanceof Sym)
  assert.equal(palette[0].name, 'black')
  // Final palette (2026-07-17 refinement): saddlebrown moved to slot 14,
  // navy in slot 16. See rationale block in named-colors-html.js.
  assert.equal(palette[15].name, 'navy')
  assert.equal(palette[13].name, 'saddlebrown')
})

test('html-colors — color/named unknown name returns #f (false)', () => {
  const { env, fuel } = freshEnv()
  const result = evalSrc(env, fuel, "(color/named (quote chartreuse))")
  assert.equal(result, false)
})
