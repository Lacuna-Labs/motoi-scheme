// tui.js — Motoi Composer terminal / curses renderer.
//
// Doctrine (Alfred, 2026-07-17): the composer must work in the terminal.
// Kids on Chromebooks in a school computer lab may not have a graphical
// canvas surface available. The TUI is not a fallback — it's a first-class
// view. Same canvas, same round-trip, different render function.
//
// Provenance: engineering/COMPOSER-1.1.ENG.slat (Task 3).
// Zane #4 hunt (tests/composer/hunt-tui.test.js): width/height respect,
// NO_COLOR / TERM=dumb / !isTTY suppression, ANSI escape sanitization on
// all user-supplied strings, brand stripe clamping.
//
// Zero dependencies. Plain ANSI escapes. Node's process.stdout writes.
//
// The render is a PURE function of the canvas + opts — no side effects,
// no state. Everything returns a string; callers (REPL, curses driver)
// decide when to redraw.

import { NAMED_COLORS_HTML_ORDER, colorNamed } from '../graphics/named-colors-html.js'
import { TREE_LOGO as CANONICAL_TREE_LOGO } from '../brand/tree-logo.js'

// ── ANSI helpers ────────────────────────────────────────────────────
//
// We stay conservative: 8-color foregrounds + bold + reset. Some
// terminals mangle 24-bit sequences; some CI machines strip escapes
// entirely. Callers who want raw text pass `{ color: false }`.

const ESC = '\x1b['
const RESET = ESC + '0m'
const BOLD  = ESC + '1m'
const DIM   = ESC + '2m'

// Foreground color palette — 8 base ANSI colors. The HTML-16 palette
// is quantized down for terminal display: kids see COLOR-NAME LABELS
// but the terminal shows a rough approximation. Full-fidelity color is
// the browser TUI-mirror layer's job (later).
const ANSI_FG = {
  black: 30, red: 31, green: 32, yellow: 33,
  blue: 34, magenta: 35, cyan: 36, white: 37,
}

function fg(name) { return ESC + (ANSI_FG[name] ?? 37) + 'm' }

// Rough HTML-name → ANSI 8-color quantization. Used for palette-strip
// rendering. If a name isn't in the table we fall back to white.
// Kept in sync with NAMED_COLORS_HTML_ORDER — the 16 curated slots.
const HTML_TO_ANSI = {
  black: 'black', white: 'white', crimson: 'red', forestgreen: 'green',
  peachpuff: 'yellow', gold: 'yellow', coral: 'red', plum: 'magenta',
  teal: 'cyan', sienna: 'yellow', pink: 'magenta', skyblue: 'cyan',
  mediumseagreen: 'green', saddlebrown: 'red',
  slategray: 'white', navy: 'blue',
}

// ── color-mode detection (mirrors REPL splash) ──────────────────────
//
// Returns 'none' | '256' | 'truecolor'. Honours NO_COLOR
// (https://no-color.org), TERM=dumb, and an explicit opts.isTTY=false
// hint from the caller. When 'none', callers strip all ANSI from the
// final output.
function detectColor(opts) {
  if (process.env.NO_COLOR) return 'none'
  if (opts && opts.isTTY === false) return 'none'
  if (opts && opts.color === false) return 'none'
  if (process.env.FORCE_COLOR === '3') return 'truecolor'
  if (process.env.FORCE_COLOR === '2') return '256'
  if (process.env.FORCE_COLOR === '1') return '256'
  if (process.env.FORCE_COLOR === '0') return 'none'
  const term = String(process.env.TERM || '').toLowerCase()
  if (!term || term === 'dumb') return 'none'
  const colorterm = String(process.env.COLORTERM || '').toLowerCase()
  if (colorterm === 'truecolor' || colorterm === '24bit') return 'truecolor'
  if (term.includes('256color')) return '256'
  return '256'
}

// Strip ALL ANSI CSI + OSC sequences from a string. Used when the
// caller wants plain text (NO_COLOR / TERM=dumb / piped).
const ANSI_STRIP = /\x1b\[[0-9;?]*[A-Za-z]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[@-Z\\-_]/g
function stripAnsi(s) {
  return String(s).replace(ANSI_STRIP, '')
}

// ── sanitize user-supplied strings ─────────────────────────────────
//
// Zane #4 SECURITY: any string that reached the renderer through
// widget opts / widget state must be scrubbed of terminal-control
// characters before it lands in the output. A malicious cart could
// place an OSC 8 hyperlink in a label to redirect clicks, or an
// arbitrary CSI to hijack terminal state on the reader's screen.
//
// We strip:
//   - C0 control chars (0x00-0x08, 0x0B-0x1F, 0x7F) except newline (0x0A)
//     and tab (0x09) — labels stay one-line so we also drop those but
//     visible whitespace is preserved in widget bodies through their
//     own newline-joining paths.
//   - C1 control (0x9B — CSI in 8-bit)
//   - OSC 8 hyperlink escapes and any other ESC-]-... sequence
//   - Bare ESC (0x1B) — belt-and-braces
//
// Result: user labels can carry printable text (including unicode /
// emoji / RTL). Anything that would move the cursor, change color, or
// hijack the terminal is dropped.
const CONTROL_STRIP = /[\x00-\x08\x0b-\x1f\x7f\x9b]/g
function sanitizeText(s) {
  if (s == null) return ''
  // Drop OSC and other ESC-introduced sequences first (they contain
  // the ESC byte we want removed anyway).
  let out = String(s).replace(ANSI_STRIP, '')
  // Then drop any remaining bare control chars (including tabs).
  out = out.replace(CONTROL_STRIP, '')
  return out
}

// ── width / height resolution ──────────────────────────────────────
//
// The renderer takes width / height hints. Falls back to
// process.stdout.columns / rows (when running on a real TTY) and then
// to 80 × 24 (the classic vt100 default). Zero and negative widths are
// clamped to 1 so the render always produces at least one column.

function resolveWidth(opts) {
  const raw = opts && opts.width != null
    ? opts.width
    : (process.stdout && process.stdout.columns) || 80
  const n = Number(raw)
  if (!Number.isFinite(n)) return 80
  return Math.max(1, Math.floor(n))
}

function resolveHeight(opts) {
  const raw = opts && opts.height != null
    ? opts.height
    : (process.stdout && process.stdout.rows) || 24
  const n = Number(raw)
  if (!Number.isFinite(n)) return 24
  return Math.max(1, Math.floor(n))
}

// Clip a single line to `width` columns. Uses code-point length rather
// than String.length so surrogate pairs (emoji) count as 1 cell — this
// is still an approximation (some East-Asian glyphs are 2 cells wide)
// but it's honest enough to avoid the hard failure mode of "line >
// terminal width".
function clipLine(line, width) {
  if (line.length <= width) return line
  // Slice by code points, not code units.
  const cps = Array.from(line)
  if (cps.length <= width) return line
  return cps.slice(0, width).join('')
}

// Truncate a rendered widget string to fit width; keep newlines. If a
// line overflows, clip it. Do NOT wrap — wrap-and-reflow interacts
// badly with grid widgets (piano-roll, sprite-grid) whose rows are
// significant.
function clipWidgetLines(rendered, width) {
  return rendered.split('\n').map((l) => clipLine(l, width)).join('\n')
}

// ── slider bar ──────────────────────────────────────────────────────

// [==|--] label 0.42  — bar width in cells (default 20). We budget the
// bar against the hinted terminal width so a narrow terminal shrinks
// the bar (rather than push the label off-screen).
function renderSlider(w, opts = {}) {
  const label = sanitizeText(w.opts.label || w.bind.join('/') || 'slider')
  const val = w.state.value
  const shown = Number.isInteger(val) ? String(val) : val.toFixed(2)
  // Reserve columns for " label value" so the bar doesn't crowd them out.
  const trailerLen = 1 + Array.from(label).length + 1 + shown.length
  const termWidth = opts.width
  let barWidth = 20
  if (termWidth) barWidth = Math.max(3, Math.min(20, termWidth - trailerLen - 2))
  const min = w.opts.min
  const max = w.opts.max
  const range = max - min
  const pos = range === 0 ? 0 : Math.max(0, Math.min(1, (val - min) / range))
  const filled = Math.round(pos * barWidth)
  const empty = barWidth - filled
  const bar = '[' + '='.repeat(Math.max(0, filled - 1)) + (filled > 0 ? '|' : '') + '-'.repeat(Math.max(0, empty)) + ']'
  return `${bar} ${label} ${shown}`
}

// ── piano-roll ─────────────────────────────────────────────────────
//
// 12-row × steps-col grid. Rows are one octave (C..B) modulo pitch
// spellings the roll happens to hold. `#` for filled, `.` for empty.
// Row labels on the left.

const PITCH_ORDER = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

function pitchToRow(pitch) {
  // "C4" → 0, "C#4" → 1, ... "B4" → 11. Ignores octave for grid row.
  const m = /^([A-Ga-g][#b]?)(-?\d+)?$/.exec(String(pitch))
  if (!m) return null
  let letter = m[1].toUpperCase()
  // Normalize Db → C#, etc.
  const flatMap = { DB: 'C#', EB: 'D#', GB: 'F#', AB: 'G#', BB: 'A#' }
  if (flatMap[letter]) letter = flatMap[letter]
  return PITCH_ORDER.indexOf(letter)
}

function renderPianoRoll(w, opts = {}) {
  const requestedSteps = w.opts.steps
  // Width budget: hinted width MINUS the "  Xx " row-label prefix (5 cols)
  // MINUS 2 safety cols. If width isn't hinted we render all steps.
  const width = opts.width
  const stepWidth = Math.max(1, Math.min(requestedSteps, width ? width - 5 : requestedSteps))
  const truncated = stepWidth < requestedSteps
  const grid = []
  for (let r = 0; r < 12; r++) grid.push(new Array(stepWidth).fill('.'))
  for (const note of w.state.notes) {
    const row = pitchToRow(note.pitch)
    if (row == null || row < 0) continue
    const at = Math.max(0, Math.floor(note.at))
    if (at >= stepWidth) continue
    const dur = Math.max(1, Math.floor(note.dur ?? 1))
    for (let c = at; c < Math.min(stepWidth, at + dur); c++) {
      grid[row][c] = '#'
    }
  }
  const lines = []
  const label = sanitizeText(w.opts.label || w.bind.join('/') || 'piano-roll')
  const trailer = truncated
    ? `piano-roll: ${label} (${w.state.notes.length} notes, ${stepWidth}/${requestedSteps} steps shown)`
    : `piano-roll: ${label} (${w.state.notes.length} notes, ${requestedSteps} steps)`
  lines.push(trailer)
  // Emit HIGH pitches first (C6-ish at top) — reverse iteration.
  for (let r = 11; r >= 0; r--) {
    const name = PITCH_ORDER[r].padStart(2, ' ')
    lines.push(`  ${name} ${grid[r].join('')}`)
  }
  return lines.join('\n')
}

// ── sprite-grid ────────────────────────────────────────────────────

// Palette index → single char. 0='.', 1..9=digits, 10..15=a..f.
function idxChar(i) {
  const n = Number(i) | 0
  if (n === 0) return '.'
  if (n >= 1 && n <= 9) return String(n)
  if (n >= 10 && n <= 15) return 'abcdef'[n - 10]
  return '?'
}

function renderSpriteGrid(w, opts = {}) {
  const lines = []
  const label = sanitizeText(w.opts.label || w.bind.join('/') || 'sprite')
  const width = opts.width
  // Budget: hinted width - 2 col indent - 2 safety.
  const cellBudget = width ? Math.max(1, width - 2) : w.opts.w
  const truncated = cellBudget < w.opts.w
  const dimLabel = truncated
    ? `${w.opts.w}x${w.opts.h}, ${cellBudget} cols shown`
    : `${w.opts.w}x${w.opts.h}`
  lines.push(`sprite: ${label} (${dimLabel}, palette ${sanitizeText(w.opts.palette)})`)
  for (const row of w.state.pixels) {
    const cells = row.slice(0, cellBudget).map(idxChar).join('')
    lines.push('  ' + cells)
  }
  return lines.join('\n')
}

// ── button ─────────────────────────────────────────────────────────

function renderButton(w) {
  const label = sanitizeText(w.opts.label || 'button')
  return `[ ${label} ]`
}

// ── the other widget kinds ─────────────────────────────────────────

function renderTextField(w) {
  const label = sanitizeText(w.opts.label || w.bind.join('/') || 'text')
  const value = sanitizeText(w.state.value)
  return `${label}: "${value}"`
}

function renderToggle(w) {
  const label = sanitizeText(w.opts.label || w.bind.join('/') || 'toggle')
  const mark = w.state.value ? '[X]' : '[ ]'
  return `${mark} ${label}`
}

function renderColorPicker(w) {
  const label = sanitizeText(w.opts.label || w.bind.join('/') || 'color')
  const val = w.state.value
  const name = sanitizeText(val && typeof val === 'object' && 'name' in val ? val.name : String(val))
  return `color(${label}): ${name}`
}

function renderAdsr(w) {
  const s = w.state
  return `ADSR: a=${s.a} d=${s.d} s=${s.s} r=${s.r}`
}

function renderInstrumentPicker(w) {
  const choices = (w.opts.choices || []).map((c) => sanitizeText(c))
  return `instrument: [${choices.join('|')}] chosen=${sanitizeText(w.state.chosen)}`
}

function renderTileMap(w) {
  const lines = [`tile-map: (${w.opts.cols}x${w.opts.rows})`]
  for (let r = 0; r < w.opts.rows; r++) {
    const row = []
    for (let c = 0; c < w.opts.cols; c++) {
      const v = w.state.cells[`${c},${r}`]
      row.push(v == null ? '.' : idxChar(v))
    }
    lines.push('  ' + row.join(''))
  }
  return lines.join('\n')
}

function renderTimeline(w) {
  const entities = w.opts.entities.length
    ? w.opts.entities.map((e) => sanitizeText(e)).join(',')
    : '(none)'
  const frameCount = Object.values(w.state.frames).reduce((s, arr) => s + arr.length, 0)
  return `timeline: entities=${entities} duration=${w.opts.duration}s fps=${w.opts.fps} frames=${frameCount}`
}

function renderFxChain(w) {
  const chain = w.state.chain.map(([n]) => sanitizeText(n)).join(' -> ')
  return `fx-chain: ${chain || '(empty)'}`
}

function renderLiveCode(w) {
  const src = sanitizeText(w.state.source)
  const preview = src.length > 30 ? src.slice(0, 30) + '...' : src
  return `live-code: "${preview}"`
}

function renderVoicePool(w) {
  // Custom v1.1 widget (see composer-v11.js). Renders the 16-voice pool.
  const lines = [`voice-pool: 16 voices, steal=${sanitizeText(w.opts.steal || 'oldest')}`]
  for (let i = 0; i < 16; i++) {
    const v = w.state.voices[i]
    if (i === 15) {
      // Mixer voice.
      const mixed = v && v.mixes ? v.mixes.map((x) => '#' + x).join(',') : '(empty)'
      lines.push(`  16 [MIX] <- ${mixed}`)
    } else {
      const inst = v && v.instrument ? sanitizeText(String(v.instrument)) : '(free)'
      lines.push(`  ${String(i + 1).padStart(2, ' ')} ${inst}`)
    }
  }
  return lines.join('\n')
}

// ── one widget → string ────────────────────────────────────────────

function renderWidget(w, opts) {
  switch (w.kind) {
    case 'slider':            return renderSlider(w, opts)
    case 'button':            return renderButton(w)
    case 'piano-roll':        return renderPianoRoll(w, opts)
    case 'sprite-grid':       return renderSpriteGrid(w, opts)
    case 'text-field':        return renderTextField(w)
    case 'toggle':            return renderToggle(w)
    case 'color-picker':      return renderColorPicker(w)
    case 'adsr':              return renderAdsr(w)
    case 'instrument-picker': return renderInstrumentPicker(w)
    case 'tile-map':          return renderTileMap(w)
    case 'timeline':          return renderTimeline(w)
    case 'fx-chain':          return renderFxChain(w)
    case 'live-code':         return renderLiveCode(w)
    case 'voice-pool':        return renderVoicePool(w)
    default:                  return `[${sanitizeText(w.kind)}]`
  }
}

// ── palette strip (rendered under a canvas when palette=html-16) ───

function renderPaletteStrip() {
  return NAMED_COLORS_HTML_ORDER.map((n, i) => {
    const num = String(i + 1).padStart(2, '0')
    return `${num}:${n}`
  }).join('  ')
}

// ── the whole canvas → string ──────────────────────────────────────
//
// Header: brand stripes (pink/green/brown) rendered as three lines of
// characters — captured non-decoratively for test-snapshot friendliness.
// Then a title, then each widget separated by a blank line. Width and
// height come from opts (with process.stdout fallback). When height is
// exhausted the widget list is truncated with a "...N more widgets"
// indicator.

const DEFAULT_STRIPE_WIDTH = 40
const STRIPE_PREFIXES = ['[pink ] ', '[green] ', '[brown] ']

function brandHeader(opts, width) {
  if (opts.brand === false) return []
  const prefixLen = STRIPE_PREFIXES[0].length
  // Budget: width - prefix - 0 safety. Clamp to at least 0 so width=1
  // still doesn't crash (we'll just emit the prefix, then clip).
  const stripeChars = Math.max(0, width - prefixLen)
  const stripe = '='.repeat(stripeChars)
  return [
    clipLine(`[pink ] ${stripe}`, width),
    clipLine(`[green] ${stripe}`, width),
    clipLine(`[brown] ${stripe}`, width),
    '',
  ]
}

// ASCII tree logo (per branding memory — "the ASCII tree is the logo now").
// Consolidated to lib/brand/tree-logo.js per Zain audit F1. Re-exported
// here so existing tests / consumers keep working.
export const TREE_LOGO = CANONICAL_TREE_LOGO

export function renderCanvasToTUI(canvas, opts = {}) {
  if (!canvas || canvas.kind !== 'canvas') {
    return '(not-a-canvas)'
  }
  const width = resolveWidth(opts)
  const height = resolveHeight(opts)
  const colorMode = detectColor(opts)

  const lines = []
  lines.push(...brandHeader(opts, width))
  const bindLabel = canvas.bind.length
    ? sanitizeText(canvas.bind.join('/'))
    : '(unbound)'
  lines.push(clipLine(`MOTOI COMPOSER — canvas ${bindLabel}`, width))
  // Separator matches the current terminal width (respects width hint).
  lines.push('-'.repeat(width))
  // Widget rendering — each widget clipped per-line to width. If we
  // exhaust height mid-list, take as many lines of the truncating
  // widget as fit (so its header stays visible) and append a
  // "...N more widgets" indicator for the ones that don't fit at all.
  let heightBudget = height - lines.length
  const remaining = []
  let dropped = 0
  for (let i = 0; i < canvas.children.length; i++) {
    if (heightBudget <= 1) {
      dropped = canvas.children.length - i
      break
    }
    const child = canvas.children[i]
    const widgetOpts = { width }
    const rendered = clipWidgetLines(renderWidget(child, widgetOpts), width)
    const widgetLines = rendered.split('\n')
    const needed = widgetLines.length + 1 // +1 for separating blank
    if (needed <= heightBudget) {
      remaining.push(...widgetLines, '')
      heightBudget -= needed
    } else {
      // Partial render of this widget: keep header + as many body rows
      // as fit. Reserve one row for the "...N more widgets" indicator
      // if there's any following widget (or truncation of this one).
      const followers = canvas.children.length - i - 1
      const needIndicator = followers > 0 || widgetLines.length > heightBudget
      const take = Math.max(1, heightBudget - (needIndicator ? 1 : 0))
      remaining.push(...widgetLines.slice(0, take))
      const missing = widgetLines.length - take
      dropped = followers + (missing > 0 ? 1 : 0)
      heightBudget -= take
      break
    }
  }
  lines.push(...remaining)
  // Trim trailing blank.
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  if (dropped > 0) {
    const indicator = clipLine(
      `... ${dropped} more widget${dropped === 1 ? '' : 's'}`,
      width,
    )
    // Evict older lines until the indicator fits inside height.
    while (lines.length >= height && lines.length > 0) lines.pop()
    lines.push(indicator)
  }
  // Palette strip if any child uses html-16 — but only if we have room.
  const anyHtml16 = canvas.children.some((c) =>
    (c.opts && c.opts.palette === 'html-16') ||
    (c.kind === 'color-picker' && c.opts && c.opts.palette === 'html-16'))
  if ((anyHtml16 || opts.palette === 'html-16') && lines.length + 3 <= height && dropped === 0) {
    lines.push('')
    lines.push(clipLine('palette (html-16):', width))
    lines.push(clipLine('  ' + renderPaletteStrip(), width))
  }
  // Final height clamp — even after all the budgeting above, guarantee
  // we never emit more than `height` lines.
  const clamped = lines.slice(0, height)
  let out = clamped.join('\n')
  // If we're in a non-color mode (NO_COLOR / TERM=dumb / !isTTY),
  // scrub ANY ANSI that leaked through (defense in depth — the current
  // renderers don't emit ANSI, but consolidated stripping is cheap).
  if (colorMode === 'none') out = stripAnsi(out)
  return out
}

// Reset codes exposed so REPL callers can wrap in color.
export const TUI_ANSI = { ESC, RESET, BOLD, DIM, fg, HTML_TO_ANSI }

// Also exposed for tests / callers that want the exact detection.
export const _internal = { detectColor, sanitizeText, stripAnsi, resolveWidth, resolveHeight }
