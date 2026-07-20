// framebuffer.js — the pixel canvas the media verbs draw into.
//
// Provenance: scheme-lang/src/framebuffer.js. Migrated to
// motoi-scheme/lib/graphics/ on 2026-07-16 (Pass-3 Wave 1). Sakura-
// branded defaults neutralized: petal-comment removed, `sakura` mode
// alias preserved for backwards compat but `default` is the canonical
// name.
//
// One buffer, many adapters. The framebuffer holds a rectangular grid
// of color-indexed pixels; adapters (dots / iterm2 / kitty / sixel /
// browser-canvas) read the SAME buffer and produce different outputs.
//
// The buffer is stored as a Uint8Array of palette indices (0..255). A
// 16-color palette lives on the buffer and can be extended if the
// current mode is a "free RGBA" mode.
//
// This module is pure: no I/O, no adapter knowledge, no REPL glue. That
// separation is what lets the same code run in the terminal, in a
// browser via canvas, and inside a headless test.

// ── modes ────────────────────────────────────────────────────────────

// Presets. Custom sizes go through set-mode with two numeric args.
export const MODES = Object.freeze({
  // Motoi default — small, warm, dots-friendly.
  'default':  { w: 80,  h: 80 },
  // Backwards-compat alias for the Sakura dialect's mode name.
  'sakura':   { w: 80,  h: 80 },
  // PICO-8 — 128×128, the reference retro console.
  'pico8':    { w: 128, h: 128 },
  'pico-8':   { w: 128, h: 128 },
  // TIC-80 — 240×136, a step up in resolution.
  'tic80':    { w: 240, h: 136 },
  'tic-80':   { w: 240, h: 136 },
})

// ── 16-color palette ────────────────────────────────────────────────
//
// Default palette borrows from PICO-8's beloved 16-color set — the one
// so many pixel-art programmers already know. Index 0 is the clear/
// background color; indices 1..15 are draw colors.

export const DEFAULT_PALETTE = Object.freeze([
  [0,   0,   0,   255],  // 0  black — the clear color
  [29,  43,  83,  255],  // 1  dark-blue
  [126, 37,  83,  255],  // 2  dark-purple
  [0,   135, 81,  255],  // 3  dark-green
  [171, 82,  54,  255],  // 4  brown
  [95,  87,  79,  255],  // 5  dark-grey
  [194, 195, 199, 255],  // 6  light-grey
  [255, 241, 232, 255],  // 7  white
  [255, 0,   77,  255],  // 8  red
  [255, 163, 0,   255],  // 9  orange
  [255, 236, 39,  255],  // 10 yellow
  [0,   228, 54,  255],  // 11 green
  [41,  173, 255, 255],  // 12 blue
  [131, 118, 156, 255],  // 13 lavender
  [255, 119, 168, 255],  // 14 pink
  [255, 204, 170, 255],  // 15 peach
])

// ── the buffer ──────────────────────────────────────────────────────

export class Framebuffer {
  constructor(width, height, palette) {
    this.w = width | 0
    this.h = height | 0
    // Row-major byte array — one palette index per pixel.
    this.pixels = new Uint8Array(this.w * this.h)
    // Copy the palette so per-buffer palette tweaks (e.g. remap) don't
    // clobber the shared default.
    this.palette = (palette || DEFAULT_PALETTE).map(rgba => rgba.slice())
    // Current draw color index. Defaults to palette entry 14 (pink).
    this.color = 14
    // Frame counter. Bumps whenever the animation loop ticks (see
    // media.js `frame` verb + animation.js `on-frame` loop).
    this.frame = 0
    // Version bump — helps adapters detect "the buffer changed since I
    // last rendered" without diffing bytes.
    this.version = 0
  }

  // Reset every pixel to the clear color (0) and bump the version.
  // Optional `c` overrides the clear color index for this pass.
  clear(c = 0) {
    this.pixels.fill(c & 0xff)
    this.version++
    return undefined
  }

  // Set the current draw color. Accepts a palette index 0..15 or a
  // symbol like 'red / 'petal (via named-color lookup). Out-of-range
  // integers wrap into the palette.
  setColor(c) {
    if (typeof c === 'number') this.color = ((c | 0) % this.palette.length + this.palette.length) % this.palette.length
    else if (typeof c === 'string') {
      const n = NAMED_COLORS[c.toLowerCase()]
      if (n !== undefined) this.color = n
    }
    return this.color
  }

  // ── low-level pixel poke ──────────────────────────────────────────

  plot(x, y, c) {
    x = x | 0; y = y | 0
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return
    this.pixels[y * this.w + x] = (c === undefined ? this.color : c) & 0xff
  }

  // Read a pixel's palette index. Off-buffer coordinates return 0.
  peek(x, y) {
    x = x | 0; y = y | 0
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0
    return this.pixels[y * this.w + x]
  }

  // ── shape rasterizers — pure math, no I/O ─────────────────────────

  // Bresenham line. Both endpoints inclusive.
  line(x0, y0, x1, y1, c) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0
    const dx = Math.abs(x1 - x0)
    const dy = -Math.abs(y1 - y0)
    const sx = x0 < x1 ? 1 : -1
    const sy = y0 < y1 ? 1 : -1
    let err = dx + dy
    let x = x0, y = y0
    while (true) {
      this.plot(x, y, c)
      if (x === x1 && y === y1) break
      const e2 = 2 * err
      if (e2 >= dy) { err += dy; x += sx }
      if (e2 <= dx) { err += dx; y += sy }
    }
    this.version++
  }

  // Midpoint circle outline.
  circle(cx, cy, r, c) {
    cx |= 0; cy |= 0; r = Math.max(0, r | 0)
    let x = r, y = 0, err = 0
    while (x >= y) {
      this.plot(cx + x, cy + y, c); this.plot(cx + y, cy + x, c)
      this.plot(cx - y, cy + x, c); this.plot(cx - x, cy + y, c)
      this.plot(cx - x, cy - y, c); this.plot(cx - y, cy - x, c)
      this.plot(cx + y, cy - x, c); this.plot(cx + x, cy - y, c)
      y++
      if (err <= 0) err += 2 * y + 1
      if (err > 0)  { x--; err -= 2 * x + 1 }
    }
    this.version++
  }

  // Filled disc.
  disc(cx, cy, r, c) {
    cx |= 0; cy |= 0; r = Math.max(0, r | 0)
    const r2 = r * r
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r2) this.plot(cx + dx, cy + dy, c)
      }
    }
    this.version++
  }

  // Rectangle outline (not filled).
  rect(x, y, w, h, c) {
    x |= 0; y |= 0; w = Math.max(1, w | 0); h = Math.max(1, h | 0)
    this.line(x, y, x + w - 1, y, c)
    this.line(x + w - 1, y, x + w - 1, y + h - 1, c)
    this.line(x + w - 1, y + h - 1, x, y + h - 1, c)
    this.line(x, y + h - 1, x, y, c)
  }

  // Filled rectangle.
  rectFill(x, y, w, h, c) {
    x |= 0; y |= 0; w = Math.max(1, w | 0); h = Math.max(1, h | 0)
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) this.plot(x + dx, y + dy, c)
    }
  }

  // ── flower rasterizer ──────────────────────────────────────────────
  //
  // paintFlower(n, col, row, spin, sx, sy, dy, petals) — draw one of
  // four canned flower sprites at (col, row).
  //
  //   n=0  five-dot cluster (petal + center + 3 tips)
  //   n=1  five-petal daisy (petals around a center)
  //   n=2  six-petal (hex arrangement)
  //   n=3  small four-petal (tulip-ish)
  //
  // spin  — rotation in degrees (integer or float)
  // sx,sy — X/Y scale factors (default 1)
  // dy    — vertical pixel offset (draws petals dy below the geometric center)
  // petals— optional list of palette-indexed color values; if provided,
  //         petals[0] is the petal color and petals[1] is the center
  //         color. Non-numeric or malformed entries are silently ignored
  //         (reference caveat: 'malformed petals are ignored').
  //
  // All numeric args pass through the same coercion the reference
  // documents: non-numeric spin/dy become 0; non-numeric scales default
  // to 1. The verb mutates the buffer (bumps version once at the end).
  paintFlower(n, col, row, spin, sx, sy, dy, petals) {
    const cx = (col | 0)
    let cy = (row | 0)
    const sn = (typeof n === 'number' && Number.isFinite(n)) ? (n | 0) % 4 : 0
    const nIdx = ((sn % 4) + 4) % 4   // 0..3
    const th = (typeof spin === 'number' && Number.isFinite(spin))
      ? (spin * Math.PI / 180) : 0
    const scx = (typeof sx === 'number' && Number.isFinite(sx) && sx > 0) ? sx : 1
    const scy = (typeof sy === 'number' && Number.isFinite(sy) && sy > 0) ? sy : 1
    const dyi = (typeof dy === 'number' && Number.isFinite(dy)) ? (dy | 0) : 0
    cy += dyi
    // Colors: default petal=14 (pink), center=10 (yellow).
    let petalC = 14
    let centerC = 10
    if (Array.isArray(petals) && petals.length > 0) {
      const p0 = petals[0]
      if (typeof p0 === 'number' && Number.isFinite(p0)) petalC = ((p0 | 0) % this.palette.length + this.palette.length) % this.palette.length
      else if (typeof p0 === 'string') {
        const n0 = NAMED_COLORS[p0.toLowerCase()]
        if (n0 !== undefined) petalC = n0
      }
      if (petals.length > 1) {
        const p1 = petals[1]
        if (typeof p1 === 'number' && Number.isFinite(p1)) centerC = ((p1 | 0) % this.palette.length + this.palette.length) % this.palette.length
        else if (typeof p1 === 'string') {
          const n1 = NAMED_COLORS[p1.toLowerCase()]
          if (n1 !== undefined) centerC = n1
        }
      }
    }

    // Petal counts and base radius per sprite index.
    const spriteSpec = [
      { petals: 4, baseR: 2, center: 1 },   // 0 dot-cluster
      { petals: 5, baseR: 3, center: 1 },   // 1 daisy
      { petals: 6, baseR: 3, center: 1 },   // 2 hex
      { petals: 4, baseR: 2, center: 1 },   // 3 tulip-ish
    ][nIdx]

    const petalCount = spriteSpec.petals
    const rx = spriteSpec.baseR * scx
    const ry = spriteSpec.baseR * scy

    // Draw petals around center, rotated by spin.
    for (let i = 0; i < petalCount; i++) {
      const a = th + (i * 2 * Math.PI / petalCount)
      const pxc = Math.round(cx + Math.cos(a) * rx)
      const pyc = Math.round(cy + Math.sin(a) * ry)
      // Each petal is a small disc.
      const pr = Math.max(1, Math.round(Math.min(rx, ry) * 0.6))
      this.disc(pxc, pyc, pr, petalC)
    }
    // Center dot.
    this.disc(cx, cy, Math.max(1, Math.round(Math.min(rx, ry) * 0.4)), centerC)
    // Sprite 3 (tulip-ish) gets a tiny stem below.
    if (nIdx === 3) {
      const stemLen = Math.max(2, Math.round(3 * scy))
      const stemC = NAMED_COLORS['dark-green'] ?? 3
      this.line(cx, cy + Math.round(ry), cx, cy + Math.round(ry) + stemLen, stemC)
    }
    this.version++
  }

  // ── data plot — sparkline-style series ────────────────────────────

  // data: array of numbers. Renders as a connected line across the
  // full width, y auto-scaled to fit the buffer.
  plotSeries(data, c) {
    if (!Array.isArray(data) || data.length === 0) return
    let min = Infinity, max = -Infinity
    for (const v of data) { if (v < min) min = v; if (v > max) max = v }
    const span = Math.max(1e-9, max - min)
    const N = data.length
    let px = -1, py = -1
    for (let i = 0; i < N; i++) {
      const x = Math.round((i / Math.max(1, N - 1)) * (this.w - 1))
      const y = Math.round((1 - (data[i] - min) / span) * (this.h - 1))
      if (px >= 0) this.line(px, py, x, y, c)
      else this.plot(x, y, c)
      px = x; py = y
    }
    this.version++
  }

  // ── serialization ─────────────────────────────────────────────────

  // Snapshot the buffer as a plain object — useful for save-cart /
  // load-cart and cross-worker messaging.
  toObject() {
    return {
      w: this.w, h: this.h,
      color: this.color,
      frame: this.frame,
      palette: this.palette.map(rgba => rgba.slice()),
      pixels: Array.from(this.pixels),
    }
  }

  // Rehydrate from a toObject() snapshot.
  static fromObject(o) {
    const fb = new Framebuffer(o.w, o.h, o.palette)
    fb.color = o.color | 0
    fb.frame = o.frame | 0
    fb.pixels.set(o.pixels)
    fb.version++
    return fb
  }
}

// ── named color lookup ──────────────────────────────────────────────

export const NAMED_COLORS = Object.freeze({
  black: 0, 'dark-blue': 1, 'dark-purple': 2, 'dark-green': 3,
  brown: 4, 'dark-grey': 5, 'dark-gray': 5, 'light-grey': 6, 'light-gray': 6,
  white: 7, red: 8, orange: 9, yellow: 10, green: 11, blue: 12,
  lavender: 13, pink: 14, petal: 14, peach: 15,
})

// ── mode helpers ────────────────────────────────────────────────────

export function resolveMode(a, b) {
  // (set-mode 'pico8) — symbolic
  if (typeof a === 'string' && b === undefined) {
    const m = MODES[a.toLowerCase()]
    if (!m) throw new Error(`unknown mode: ${a}`)
    return { w: m.w, h: m.h }
  }
  // (set-mode w h) — numeric
  if (typeof a === 'number' && typeof b === 'number') {
    if (a < 1 || b < 1 || a > 1024 || b > 1024) {
      throw new Error(`mode dimensions out of range: ${a}×${b} (must be 1..1024)`)
    }
    return { w: a | 0, h: b | 0 }
  }
  throw new Error('set-mode: expected (set-mode w h) or (set-mode preset)')
}
