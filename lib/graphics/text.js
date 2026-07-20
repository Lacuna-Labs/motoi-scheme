// text.js — text + emoji rendering for Motoi.
//
// Created 2026-07-16 as the text lane of the animation+physics build.
//
// Doctrine:
//   The framebuffer draws PIXELS. Text (and especially emoji) needs a
//   font stack — the OS ships one, the browser Canvas ships one, the
//   terminal ships one. Motoi doesn't. So text rendering routes through
//   the adapter seam: the host draws real glyphs; the framebuffer keeps
//   a text OVERLAY (a small list of {str, x, y, color, font} records)
//   for headless tests, snapshotting, and animation.
//
// Kid-readable version: `(fb/text "hi" 10 20 'red)` writes the letters
// "h" and "i" at pixel (10, 20) in red. Works with emoji too — try
// `(fb/text "🎉" 40 40 'yellow)`. The computer already knows what a
// party-popper looks like; we just tell it where to put one.
//
// Verb surface (all registered here):
//   (fb/text str x y color)             — draw with default font
//   (fb/text str x y color font)        — draw with named font
//   (text/measure str)                  → (width height)
//   (text/measure str font)             → (width height) with font
//   (text/wrap str max-width)           → (line line ...)
//   (text/wrap str max-width font)      → (line line ...) with font
//   (text/overlay)                      → the raw overlay records (for tests)
//   (text/overlay-clear)                → wipe the overlay
//   font/default   font/mono   font/big   font/tiny
//
// Colors accept the same names + palette indices as fb/setColor. Fonts
// arrive as symbols; the adapter maps them to concrete typefaces.

import { Sym, sym } from '../../src/reader.js'
import { getMediaState } from '../media/media.js'
import { renderText, measureText, wrapText } from '../../adapters/base.js'
import { NAMED_COLORS } from './framebuffer.js'

// ── helpers ─────────────────────────────────────────────────────────

const nm = (x) => (x instanceof Sym ? x.name : x)

// Resolve a color arg (symbol, string, or number) to a palette-friendly
// display name. We keep the string form on the overlay record — the
// adapter can map it back to its own color space (Canvas fillStyle,
// terminal ANSI code) as it chooses.
function resolveColor(c, fb) {
  if (typeof c === 'number') {
    const idx = ((c | 0) % 16 + 16) % 16
    return { name: null, index: idx }
  }
  const s = c == null ? null : String(nm(c)).toLowerCase()
  if (s && NAMED_COLORS[s] !== undefined) {
    return { name: s, index: NAMED_COLORS[s] }
  }
  // Fall back to the framebuffer's current color.
  return { name: null, index: fb ? fb.color : 14 }
}

function resolveFont(f) {
  if (f == null) return 'default'
  const s = String(nm(f)).toLowerCase()
  // Accept `font/mono` too — we normalize to the short name.
  if (s.startsWith('font/')) return s.slice(5)
  return s
}

// ── the text overlay lives on the shared media state ────────────────
//
// We attach a `textOverlay` array to the framebuffer lazily so a call
// to fb/text is observable even when there's no host paint channel.
// Animation drivers clear the overlay each frame and re-push during the
// on-frame handler — same shape as sprites in game.js.

function overlay(fb) {
  if (!fb.textOverlay) fb.textOverlay = []
  return fb.textOverlay
}

// ── installer ───────────────────────────────────────────────────────

export function installText(env) {
  const def = (n, f, perm = 'paint') => env.define(n, f, { perm })

  // Named-font constants. Callers can pass either the symbol (font/mono)
  // or a plain string ("mono") — both resolve to the same font key.
  env.define('font/default', sym('default'), { perm: 'read' })
  env.define('font/mono',    sym('mono'),    { perm: 'read' })
  env.define('font/big',     sym('big'),     { perm: 'read' })
  env.define('font/tiny',    sym('tiny'),    { perm: 'read' })

  // (fb/text str x y color [font]) — draw text at pixel position.
  //   `str`    — any UTF-8 string, including emoji.
  //   `x, y`   — top-left pixel position on the framebuffer.
  //   `color`  — palette index (0..15), color name symbol, or nil for
  //              the current draw color.
  //   `font`   — optional font name (symbol or string). Defaults to
  //              'default (the host's system font).
  //
  // Side-effect only. Returns undefined per the R7RS side-effect
  // convention (see media.js §draw verbs for the discussion).
  def('fb/text', (str, x, y, color, font) => {
    const st = getMediaState()
    if (!st || !st.fb) return undefined
    const fb = st.fb
    const s = String(str == null ? '' : str)
    const px = Number(x) || 0
    const py = Number(y) || 0
    const col = resolveColor(color, fb)
    const fnt = resolveFont(font)
    // Push into the framebuffer's text overlay for headless observers.
    overlay(fb).push({
      str: s,
      x: px | 0,
      y: py | 0,
      color: col.name || `#${col.index}`,
      colorIndex: col.index,
      font: fnt,
    })
    fb.version++
    // Delegate to the adapter — real render happens here in a browser
    // or terminal host. The default adapter no-op is fine for tests.
    try {
      renderText(s, px | 0, py | 0, col.name || col.index, fnt)
    } catch { /* soft-fail — never crash the animation loop on paint */ }
    return undefined
  })

  // (text/measure str [font]) → (width height)
  //   Returns the pixel bounding box the host would use to lay out
  //   `str`. Emoji count as ~2× width in monospace terminals but the
  //   host reports the truth; we just forward its answer.
  def('text/measure', (str, font) => {
    const s = String(str == null ? '' : str)
    const fnt = resolveFont(font)
    const r = measureText(s, fnt) || { width: 0, height: 0 }
    return [Number(r.width) || 0, Number(r.height) || 0]
  }, 'read')

  // (text/wrap str max-width [font]) → (line line ...)
  //   Greedy word-wrap that keeps lines under `max-width` pixels.
  //   Returns the wrapped lines as a list of strings.
  def('text/wrap', (str, maxWidth, font) => {
    const s = String(str == null ? '' : str)
    const w = Number(maxWidth) || 0
    const fnt = resolveFont(font)
    const lines = wrapText(s, w, fnt) || []
    // Ensure we always return a list, even for empty input.
    return Array.isArray(lines) ? lines : [String(lines)]
  }, 'read')

  // (text/overlay) → the raw overlay records. Test-facing.
  //   Each record is a plain object; consumers read (fb-snapshot) for
  //   pixels and (text/overlay) for glyphs.
  def('text/overlay', () => {
    const st = getMediaState()
    if (!st || !st.fb) return []
    return overlay(st.fb).slice()
  }, 'read')

  // (text/overlay-clear) — wipe the overlay. Called by animation
  //   drivers before re-emitting text each frame.
  def('text/overlay-clear', () => {
    const st = getMediaState()
    if (!st || !st.fb) return undefined
    if (st.fb.textOverlay) st.fb.textOverlay.length = 0
    return undefined
  })

  // (text/rasterize str [font] [color]) → raster
  //
  // Mirror of sprite/rasterize for text. Turns a string into a pixel
  // raster: a 2D array of color-name strings (or nulls for transparent
  // cells), plus width/height metadata. Same shape as a sprite so
  // callers can compose text and sprites uniformly (e.g. stamp a text
  // raster into a framebuffer via the same pipeline that stamps
  // sprites).
  //
  // The actual glyph pixel data comes from the adapter's measureText
  // (dimensions) plus a stub raster (a solid rectangle in the requested
  // color) when no adapter is wired. Real hosts (browser/terminal)
  // override via setAdapters({ rasterizeText: ... }) if they want to
  // ship exact bitmaps. Cheap fallback so headless callers still get a
  // plausibly-shaped raster to test their layout code against.
  //
  // Return record shape:
  //   ((:width  W)
  //    (:height H)
  //    (:font   F)
  //    (:color  C)
  //    (:cells  ((x y color) ...)))    ; sparse — only opaque cells
  //
  // Empty string returns width=0 height=0 cells=().
  def('text/rasterize', (str, font, color) => {
    const s = String(str == null ? '' : str)
    const fnt = resolveFont(font)
    const st = getMediaState()
    const col = resolveColor(color, st ? st.fb : null)
    const colName = col.name || `#${col.index}`
    const dims = s.length === 0
      ? { width: 0, height: 0 }
      : (measureText(s, fnt) || { width: 0, height: 0 })
    const w = Math.max(0, Number(dims.width) | 0)
    const h = Math.max(0, Number(dims.height) | 0)
    // Stub raster: paint a solid filled block. Real hosts override via
    // adapter to ship per-pixel glyph bitmaps. We keep the record shape
    // stable so callers write the same code either way.
    const cells = []
    if (s.length > 0 && w > 0 && h > 0) {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          cells.push([x, y, colName])
        }
      }
    }
    return [
      [new Sym('width'),  w],
      [new Sym('height'), h],
      [new Sym('font'),   new Sym(fnt)],
      [new Sym('color'),  colName],
      [new Sym('cells'),  cells],
    ]
  }, 'read')

  return env
}

export default installText
