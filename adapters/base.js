// motoi-scheme / adapters / base.js
// -----------------------------------------------------------------------------
// Adapter interfaces for dialect-provided host services.
//
// Provenance: scheme-lang/src/adapters.js. Migrated + generalized to
// motoi-scheme/adapters/ on 2026-07-16 (Pass-3 Wave 1).
//
// Motoi is the BASE dialect. It ships NO-OP STUBS for every host seam so
// `bin/motoi` works standalone: arithmetic, forms, macros, REPL all fly
// with zero host wiring.
//
// A DIALECT LAYER (Sakura, Lacuna, or any other) overrides these by
// calling `setAdapters({ ... })` before the first dispatch. The runtime
// keeps overrides in one state record; imports below are stable exports
// that resolve current values at call time — so dialect code that
// imports `emit` before its own bootstrap runs still sees the injected
// impl after `setAdapters()` fires.
//
// Doctrine (Alfred 2026-07-12): the language must NOT reach into any
// particular product's runtime. Every host service arrives via this
// seam.
//
// 14 legacy seams (matches the shape scheme-lang/src/adapters.js exposed):
//   emit                    log-bus event emission
//   _setCurrentCaller       card-API caller registration
//   _getCurrentCaller       card-API caller lookup
//   canvasPowerGetTier      permission tier resolution
//   chipWrite               user-facing chip sink
//   chipEvent               chip event notification
//   logEvent                legal-floor per-verb evidence log
//   currentCorrelationId    request/session correlation
//   withCorrelation         run fn under a correlation id
//   mintCorrelationId       fresh correlation id
//   chatChipPublish         chat-UI reasoning event bus
//   bricklayCacheKey        graphics layout cache key
//   bricklayCacheGet        graphics layout cache read
//   bricklayCacheSet        graphics layout cache write
//
// + 3 text seams added 2026-07-16 (text + emoji lane):
//   renderText              draw a glyph run into the host surface
//                           (Canvas fillText / terminal repaint)
//   measureText             return {width, height} for a string+font
//   wrapText                greedy line-wrap for a max pixel width
//
// Default renderText no-op still tracks the paint in the shared
// framebuffer's text overlay (see lib/graphics/text.js) so headless
// runs remain observable without a live host.
// -----------------------------------------------------------------------------

const noop = () => {}
const noopReturning = (v) => () => v

// Default adapter set — all no-ops, safe defaults. Dialects override via
// setAdapters().
const state = {
  // Log bus — best-effort event emission.
  emit: noop,

  // Card API — who's the current caller?
  _setCurrentCaller: noop,
  _getCurrentCaller: noopReturning(null),

  // Permission tier — which caller-tier is currently in force?
  // Default 'operator' so Motoi standalone can fire operator-level verbs
  // (draw, paint, math) with no host wiring.
  canvasPowerGetTier: noopReturning('operator'),

  // Chip sink — where user-facing side chips get written.
  chipWrite: noop,
  chipEvent: noop,

  // Legal-floor event log — per-verb evidence layer.
  logEvent: noop,

  // Correlation context — request/session ids.
  currentCorrelationId: noopReturning(null),
  withCorrelation: (id, fn) => fn(),
  mintCorrelationId: () => 'corr-' + Math.random().toString(36).slice(2, 10),

  // Chat-UI reasoning event bus.
  chatChipPublish: noop,

  // Bricklay layout cache (graphics verbs).
  bricklayCacheKey: () => '',
  bricklayCacheGet: noopReturning(null),
  bricklayCacheSet: noop,

  // Text seams — the browser adapter overrides with Canvas fillText;
  // the terminal adapter overrides with cursor-positioned UTF-8 writes.
  // Default no-op: returns null / conservative estimates so headless
  // callers (tests, CI, kids-with-no-display) still get a plausible
  // layout answer.
  //
  // renderText(str, x, y, color, font) → undefined
  //   Draw `str` at pixel (x, y) in `color` using `font`. The host
  //   handles Unicode + emoji via its own font stack.
  renderText: noop,
  // measureText(str, font) → { width, height }
  //   Approx bounding box. Default assumes 6px-wide monospace cells.
  measureText: (str, _font) => {
    const s = String(str ?? '')
    // Assume one JS-visible code unit ≈ 6px wide, 8px tall — a floor
    // estimate for headless layout. Browser adapter overrides.
    return { width: s.length * 6, height: 8 }
  },
  // wrapText(str, maxWidth, font) → [line, line, ...]
  //   Greedy word-wrap using the default measurement above.
  wrapText: (str, maxWidth, _font) => {
    const s = String(str ?? '')
    const w = Math.max(1, Number(maxWidth) || 0)
    // Character-cell width matches the default measureText.
    const cols = Math.max(1, Math.floor(w / 6))
    const words = s.split(/\s+/).filter(Boolean)
    if (words.length === 0) return ['']
    const lines = []
    let cur = ''
    for (const word of words) {
      if (cur.length === 0) { cur = word; continue }
      if (cur.length + 1 + word.length <= cols) cur += ' ' + word
      else { lines.push(cur); cur = word }
    }
    if (cur) lines.push(cur)
    return lines
  },
}

export function setAdapters(overrides) {
  for (const k in overrides) {
    if (typeof overrides[k] === 'function') state[k] = overrides[k]
  }
}

export function getAdapters() {
  return { ...state }
}

// Named exports — resolve current state at call time so setAdapters()
// takes effect for callers who imported before the override happened.
export const emit                  = (...a) => state.emit(...a)
export const _setCurrentCaller     = (...a) => state._setCurrentCaller(...a)
export const _getCurrentCaller     = (...a) => state._getCurrentCaller(...a)
export const canvasPowerGetTier    = (...a) => state.canvasPowerGetTier(...a)
export const chipWrite             = (...a) => state.chipWrite(...a)
export const chipEvent             = (...a) => state.chipEvent(...a)
export const logEvent              = (...a) => state.logEvent(...a)
export const currentCorrelationId  = (...a) => state.currentCorrelationId(...a)
export const withCorrelation       = (...a) => state.withCorrelation(...a)
export const mintCorrelationId     = (...a) => state.mintCorrelationId(...a)
export const chatChipPublish       = (...a) => state.chatChipPublish(...a)
export const bricklayCacheKey      = (...a) => state.bricklayCacheKey(...a)
export const bricklayCacheGet      = (...a) => state.bricklayCacheGet(...a)
export const bricklayCacheSet      = (...a) => state.bricklayCacheSet(...a)
export const renderText            = (...a) => state.renderText(...a)
export const measureText           = (...a) => state.measureText(...a)
export const wrapText              = (...a) => state.wrapText(...a)
