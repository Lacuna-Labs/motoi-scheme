// framebuffer-verbs.js — thin Scheme-verb wrappers for the pure
// Framebuffer engine + frame-cycle hooks.
//
// Doctrine (Alfred, 2026-07-16): framebuffer.js is pure. This file adds
// the CORE verbs the reference declares:
//   clear-surface-layer  begin-frame  end-frame  after-frame
//   on-canvas-trace      surface-exists?
//   pixels-wide  pixels-tall  viewport  viewport-width
//   cols  rows  measure-content
//
// on-canvas-trace: per Alfred, return the list of drawn primitives since
// frame start. The frame-verb array is captured on begin-frame and
// returned on on-canvas-trace.
//
// measure-content: bounding box alist ((:x N)(:y N)(:width N)(:height N))
// for the union of primitives drawn since begin-frame — via the same
// trace list.

import { Sym } from '../../src/reader.js'
import { getMediaState } from '../media/media.js'

// Frame-scoped trace + bbox tracked here. begin-frame reinitializes.
const _trace = {
  primitives: [],   // list of tagged prims: ('circle 40 40 15) etc.
  bbox: null,       // {x, y, w, h} accumulated
  active: false,
  callbacks: [],    // on-canvas-trace subscribers
  afterFrame: [],   // after-frame subscribers
}

function _extendBbox(x, y, w = 1, h = 1) {
  if (!_trace.bbox) {
    _trace.bbox = { x, y, w, h }
    return
  }
  const bx = Math.min(_trace.bbox.x, x)
  const by = Math.min(_trace.bbox.y, y)
  const bx2 = Math.max(_trace.bbox.x + _trace.bbox.w, x + w)
  const by2 = Math.max(_trace.bbox.y + _trace.bbox.h, y + h)
  _trace.bbox = { x: bx, y: by, w: bx2 - bx, h: by2 - by }
}

// Public: called by draw wrappers to record a primitive + bbox.
export function recordPrimitive(prim, bboxInfo) {
  if (!_trace.active) return
  _trace.primitives.push(prim)
  if (bboxInfo) _extendBbox(bboxInfo.x, bboxInfo.y, bboxInfo.w, bboxInfo.h)
}

export function resetFrameTrace() {
  _trace.primitives = []
  _trace.bbox = null
  _trace.active = false
  _trace.callbacks = []
  _trace.afterFrame = []
}

export function installFramebufferVerbs(env, fuel) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  // (surface-exists?) → boolean. Cheap: is there a fb allocated?
  def('surface-exists?', () => {
    const st = getMediaState()
    return !!(st && st.fb)
  })

  // (pixels-wide) → w. Framebuffer width in px.
  def('pixels-wide', () => {
    const st = getMediaState()
    return st && st.fb ? st.fb.w : 0
  })

  // (pixels-tall) → h.
  def('pixels-tall', () => {
    const st = getMediaState()
    return st && st.fb ? st.fb.h : 0
  })

  // (viewport) → (w h). Alias for the framebuffer dims.
  def('viewport', () => {
    const st = getMediaState()
    if (!st || !st.fb) return [0, 0]
    return [st.fb.w, st.fb.h]
  })

  // (viewport-width) → w.
  def('viewport-width', () => {
    const st = getMediaState()
    return st && st.fb ? st.fb.w : 0
  })

  // (cols) → integer column count. In terminal mode this maps to
  // characters wide; for our pure fb we alias to pixels-wide.
  def('cols', () => {
    const st = getMediaState()
    return st && st.fb ? st.fb.w : 80
  })

  // (rows) → row count. Alias for pixels-tall.
  def('rows', () => {
    const st = getMediaState()
    return st && st.fb ? st.fb.h : 24
  })

  // (clear-surface-layer color?) — clear the framebuffer to color (or 0).
  def('clear-surface-layer', (color) => {
    const st = getMediaState()
    if (!st || !st.fb) return undefined
    st.fb.clear((color | 0) || 0)
    return undefined
  }, 'paint')

  // (begin-frame) — reset the trace buffer and mark active. Returns 'ok.
  def('begin-frame', () => {
    _trace.primitives = []
    _trace.bbox = null
    _trace.active = true
    return new Sym('ok')
  }, 'paint')

  // (end-frame) — stop trace collection. Fires any pending after-frame
  // callbacks (each with the current frame counter) before returning.
  // Callbacks are drained (one-shot) so a repeat frame doesn't refire
  // stale registrations from a previous cart. Errors in callbacks are
  // swallowed — a broken after-frame handler must not brick the frame
  // loop for its siblings.
  def('end-frame', () => {
    _trace.active = false
    const st = getMediaState()
    const frameNo = st && st.fb ? st.fb.frame : 0
    // Drain callbacks so registrations don't accumulate frame-over-frame.
    const callbacks = _trace.afterFrame
    _trace.afterFrame = []
    for (const cb of callbacks) {
      try { cb(frameNo) } catch { /* soft-fail — one broken cb ≠ dead loop */ }
    }
    return frameNo
  }, 'paint')

  // (after-frame fn) — register a callback to fire after end-frame.
  // The callback receives the frame counter. Returns 'ok.
  def('after-frame', (fn) => {
    if (typeof fn === 'function') _trace.afterFrame.push(fn)
    return new Sym('ok')
  }, 'paint')

  // (on-canvas-trace) → list of primitives drawn since begin-frame.
  // Per Alfred: return the list. Callers can `(length ...)` it or
  // walk it to see what a cart painted this frame.
  def('on-canvas-trace', () => _trace.primitives.slice())

  // (measure-content) → alist bbox of primitives drawn since begin-frame.
  // Per Alfred: return ((:x N) (:y N) (:width N) (:height N)).
  def('measure-content', () => {
    const b = _trace.bbox || { x: 0, y: 0, w: 0, h: 0 }
    return [
      [new Sym(':x'), b.x],
      [new Sym(':y'), b.y],
      [new Sym(':width'), b.w],
      [new Sym(':height'), b.h],
    ]
  })

  // (fb/dump) — dump the current framebuffer to stdout as colored
  // Unicode blocks. Two pixel rows per terminal row (upper half + lower
  // half share one character, via ▀ with fg=upper bg=lower). Colors use
  // 256-color ANSI. Beginners running via CLI can SEE what they drew.
  //
  // (fb/dump)                       → dump full framebuffer
  // (fb/dump x y w h)               → dump a region
  //
  // Palette: uses the framebuffer's index-to-name mapping if available;
  // otherwise falls back to the 8-color CGA-ish palette by index mod 16.
  def('fb/dump', (...args) => {
    const st = getMediaState()
    const fb = st && st.fb
    if (!fb) { process.stdout.write('(no framebuffer)\n'); return new Sym('ok') }
    const W = fb.w | 0, H = fb.h | 0
    if (!W || !H) { process.stdout.write('(empty framebuffer)\n'); return new Sym('ok') }
    let x0 = 0, y0 = 0, w = W, h = H
    if (args.length === 4) {
      x0 = args[0] | 0; y0 = args[1] | 0; w = args[2] | 0; h = args[3] | 0
    }
    // Motoi palette (matches NAMED_COLORS index → PICO-8-ish RGB → ANSI 256)
    // Wired to the same palette lib/graphics/framebuffer.js NAMED_COLORS uses.
    //   0 black       1 dark-blue    2 dark-purple  3 dark-green
    //   4 brown       5 dark-grey    6 light-grey   7 white
    //   8 red         9 orange      10 yellow      11 green
    //  12 blue       13 lavender    14 pink        15 peach
    const PICO8_RGB = [
      [0,   0,   0],   [29,  43,  83],  [126, 37,  83],  [0,   135, 81],
      [171, 82,  54],  [95,  87,  79],  [194, 195, 199], [255, 241, 232],
      [255, 0,   77],  [255, 163, 0],   [255, 236, 39],  [0,   228, 54],
      [41,  173, 255], [131, 118, 156], [255, 119, 168], [255, 204, 170],
    ]
    const rgbToAnsi256 = (r, g, b) => {
      const to6 = (v) => Math.max(0, Math.min(5, Math.round(v / 51)))
      return 16 + 36 * to6(r) + 6 * to6(g) + to6(b)
    }
    const paletteColor = (idx) => {
      // Try the fb's own palette (may be RGB or named)
      if (fb.palette && Array.isArray(fb.palette) && fb.palette[idx]) {
        const p = fb.palette[idx]
        if (p && typeof p === 'object' && 'r' in p) {
          return rgbToAnsi256(p.r & 0xff, p.g & 0xff, p.b & 0xff)
        }
      }
      // Default to Motoi's PICO-8 palette
      const rgb = PICO8_RGB[idx & 0xf]
      return rgbToAnsi256(rgb[0], rgb[1], rgb[2])
    }
    // 2 pixel rows per terminal row: ▀ with fg=upper bg=lower
    const lines = []
    for (let ty = 0; ty < h; ty += 2) {
      let line = ''
      for (let tx = 0; tx < w; tx++) {
        const upperIdx = fb.pixels[(y0 + ty) * W + (x0 + tx)] & 0xff
        const lowerIdx = (ty + 1 < h)
          ? fb.pixels[(y0 + ty + 1) * W + (x0 + tx)] & 0xff
          : 0
        const upperC = paletteColor(upperIdx)
        const lowerC = paletteColor(lowerIdx)
        line += `\x1b[38;5;${upperC};48;5;${lowerC}m▀`
      }
      lines.push(line + '\x1b[0m')
    }
    process.stdout.write(lines.join('\n') + '\n')
    return new Sym('ok')
  }, 'paint')

  // (fb/pixel x y) — read the palette index at (x, y). Returns 0 on out
  // of bounds or missing framebuffer. Useful in tests + introspection.
  def('fb/pixel', (x, y) => {
    const st = getMediaState()
    const fb = st && st.fb
    if (!fb) return 0
    const xi = x | 0, yi = y | 0
    if (xi < 0 || yi < 0 || xi >= fb.w || yi >= fb.h) return 0
    return fb.pixels[yi * fb.w + xi] & 0xff
  })

  // (text/draw str x y color? font?) — alias of fb/text so kids can
  // find it via the `text/` namespace. fb/text is already registered
  // by lib/graphics/text.js; we bind text/draw to the SAME function.
  // (draw-text) is a further alias — beginners typing the plain form
  // find the same function instead of an unbound-symbol wall.
  const fbText = env.vars.get('fb/text')
  if (typeof fbText === 'function') {
    def('text/draw', (...args) => fbText(...args), 'paint')
    def('draw-text', (...args) => fbText(...args), 'paint')
  } else {
    // If for some reason fb/text isn't there, we register a soft-fail
    // that returns undefined rather than crashing.
    def('text/draw', () => undefined, 'paint')
    def('draw-text', () => undefined, 'paint')
  }

  return env
}

export default installFramebufferVerbs
