// tui/composer-tab.js — Motoi TUI Composer tab (beat maker widget).
//
// Provenance: 2026-07-20 (Able, Carts + Composer). Alfred asked for a
// working COMPOSER tab in the TUI with a 4×16 beat-maker grid that
// emits deterministic Scheme via the existing (kick) (snare) (hat)
// (note …) verbs and plays through the REPL's evalSource path.
//
// Doctrine: [[deterministic-audio-no-llm]] — the widget EMITS a Scheme
// form. The runtime PLAYS it. LLM never touches note bytes. Round-trip
// is grid → Scheme string → eval (nothing generated, everything typed).
//
// Doctrine: [[fantasy-console-cart-template]] — saving a pattern writes
// a small cart under ~/motoi/carts/ with a `(begin …)` body. Missing
// slots stay empty; this widget only emits the `:code` slot.
//
// Layout inside the panel (taking over the right region when active):
//   ┌── COMPOSER ─── beat maker · 120 BPM · [P play] [S save] [C clear] ─┐
//   │  KICK   ▓ ·  ·  ·  ▓ ·  ·  ·  ▓ ·  ·  ·  ▓ ·  ·  ·                │
//   │  SNARE  ·  ·  ·  ·  ▓ ·  ·  ·  ·  ·  ·  ·  ▓ ·  ·  ·                │
//   │  HAT    ▓ ·  ▓ ·  ▓ ·  ▓ ·  ▓ ·  ▓ ·  ▓ ·  ▓ ·                    │
//   │  NOTE   ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·             │
//   │                                                                     │
//   │  ↑↓←→ move  ·  SPACE toggle  ·  P play  ·  S save  ·  C clear  · T │
//   │                                                                     │
//   │  (begin (kick) (sleep-ms 125) (hat) (sleep-ms 125) …)               │
//   └─────────────────────────────────────────────────────────────────────┘
//
// Zero deps beyond node builtins + tui/screen.js glyph writers.

import { ATTR } from './screen.js'
import { writeFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

// ── constants ───────────────────────────────────────────────────────

export const COMPOSER_ROWS = 4
export const COMPOSER_COLS = 16

// Row metadata. Order is fixed: KICK · SNARE · HAT · NOTE.
// Each row carries the verb form used when its cell is on, plus the
// dominant color for painting that row's active cells. Colors are tier
// names resolved through the active theme in tui.js.
export const COMPOSER_ROW_META = [
  { name: 'KICK',  verb: '(kick)',              color: 'cedar' },
  { name: 'SNARE', verb: '(snare)',             color: 'pink'  },
  { name: 'HAT',   verb: '(hat)',               color: 'mint'  },
  { name: 'NOTE',  verb: "(note 'C4 0.15 0.6)", color: 'amber' },
]

// Fallback color if the theme doesn't know a row's tier name — this is
// the fg-ink tier which every theme carries.
const FALLBACK_COLOR = 'fg'

// ── state factory ───────────────────────────────────────────────────

// Fresh empty composer state. Attach onto `state.composer` on TUI boot
// and again on _resetForTests so multiple boots start clean.
export function initComposerState() {
  return {
    enabled: false,
    grid: makeEmptyGrid(),
    cursor: { row: 0, col: 0 },
    bpm: 120,
    lastEmitted: '',
    // BPM prompt sub-mode. When active, keystrokes routed to the REPL
    // input area buffer the numeric BPM; Enter accepts, Esc cancels.
    bpmPrompt: false,
    bpmDraft: '',
    // Save-status flash — small message painted under the preview line
    // for a few seconds after a save.
    saveMsg: '',
    saveMsgUntil: 0,
  }
}

function makeEmptyGrid() {
  const g = []
  for (let r = 0; r < COMPOSER_ROWS; r++) {
    const row = []
    for (let c = 0; c < COMPOSER_COLS; c++) row.push(false)
    g.push(row)
  }
  return g
}

export function clearComposerGrid(composer) {
  composer.grid = makeEmptyGrid()
  composer.lastEmitted = ''
}

// ── pattern → Scheme (pure, deterministic) ──────────────────────────

// Emit a `(begin …)` form for the current grid. Sequence STEPS the grid
// column-by-column — for each column, we emit one call per row that's
// on, followed by a rest cell.
//
// Rest = `(sleep-ms 125)` — 500ms per beat at 120 BPM ÷ 4 sixteenth
// notes per beat = 125 ms per step. Task doctrine: `(rest)` verb does
// not exist in Motoi, so we fall back to `(sleep-ms …)`. Formula:
//   ms = round(60000 / bpm / 4)   ← quarter-note / 4 = sixteenth
//
// Cells with no rows on emit only the sleep — this keeps step timing
// even across sparse patterns.
//
// Deterministic: identical input → identical output. No randomness, no
// LLM in the loop. Round-trip friendly.
export function emitPattern(grid, bpm) {
  const stepMs = Math.max(1, Math.round(60000 / (bpm || 120) / 4))
  const parts = []
  for (let c = 0; c < COMPOSER_COLS; c++) {
    for (let r = 0; r < COMPOSER_ROWS; r++) {
      if (grid[r] && grid[r][c]) parts.push(COMPOSER_ROW_META[r].verb)
    }
    // Rest between steps. Always emitted (including after the final
    // step) so the pattern loops cleanly if someone wraps it in
    // `(forever …)`.
    parts.push('(sleep-ms ' + stepMs + ')')
  }
  return '(begin ' + parts.join(' ') + ')'
}

// Build the header comment + cart-shaped body for a saved beat file.
// See [[fantasy-console-cart-template]] — a cart is a bundle of Scheme
// with fixed sections; the beat maker only emits `:code`.
export function buildCartText(grid, bpm, timestamp) {
  const body = emitPattern(grid, bpm)
  const lines = [
    ';; Motoi beat cart — saved ' + timestamp,
    ';; Provenance: TUI Composer tab · 4×16 grid · ' + bpm + ' BPM',
    ';; Doctrine: deterministic audio, no LLM — this Scheme WAS a grid.',
    '',
    body,
    '',
  ]
  return lines.join('\n')
}

// ── save cart ───────────────────────────────────────────────────────

// Write the current pattern to ~/motoi/carts/beat-<TS>.scm. Returns
// the absolute path on success, or an Error string on failure. Doesn't
// throw — the caller flashes the result on-screen.
export function saveCart(composer) {
  try {
    const ts = timestampSlug(new Date())
    const dir = join(homedir(), 'motoi', 'carts')
    mkdirSync(dir, { recursive: true })
    const path = join(dir, 'beat-' + ts + '.scm')
    const text = buildCartText(composer.grid, composer.bpm, ts)
    writeFileSync(path, text, 'utf8')
    return { ok: true, path }
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) }
  }
}

// YYYYMMDDHHMMSS in local time. Deterministic per instant, sortable,
// filename-safe. Task's example format.
function timestampSlug(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return d.getFullYear()
    + pad(d.getMonth() + 1)
    + pad(d.getDate())
    + pad(d.getHours())
    + pad(d.getMinutes())
    + pad(d.getSeconds())
}

// ── layout ──────────────────────────────────────────────────────────

// When the composer panel is enabled, it takes over the whole right-of-
// tree column — same rect as editor + REPL together. This mirrors the
// "takes over" behavior the task calls out (contra Canvas/Stack which
// only carve a slice). The tree stays on the left so the user can still
// navigate books; the menu bar + status ribbon stay on top/bottom.
//
// Returns { x, y, w, h } for the composer's outer rect.
export function computeComposerRect(L) {
  const x = L.editorX
  const y = L.editorY
  const w = L.W - L.editorX
  const h = L.editorH + (L.cpuH || 0) + L.replH
  return { x, y, w, h }
}

// ── paint ───────────────────────────────────────────────────────────

// The panel paints itself entirely with tier names, so themes control
// the actual RGB. `state` is the full TUI state; we read state.composer
// + state.focus + state.ticks (for cursor blink).
//
// Cells:
//   empty  → `·`  in dim fg
//   active → `▓▓` in the row's dominant color (2 chars wide)
//   cursor → a subtle mint border box in the theme's focus color when
//            focus === 'composer'
export function paintComposer(scr, L, state) {
  const c = state.composer
  if (!c || !c.enabled) return
  const focused = state.focus === 'composer'
  const border = focused ? 'pink' : 'cedar'
  const rect = computeComposerRect(L)
  scr.fillRect(rect.x, rect.y, rect.w, rect.h, ' ', 'fg', 'pearlLight', 0)
  scr.titledFrame(rect.x, rect.y, rect.w, rect.h, 'COMPOSER', border, 'pearlLight',
    focused ? ATTR.BOLD : 0)

  paintTitleBar(scr, rect, state)
  const gridTop = paintGrid(scr, rect, state)
  paintHintLine(scr, rect, gridTop, state)
  paintPreview(scr, rect, gridTop, state)
}

// Top title bar — sits on the row just inside the frame.
//   COMPOSER · beat maker · 120 BPM · [ P play ] [ S save ] [ C clear ]
function paintTitleBar(scr, rect, state) {
  const c = state.composer
  const y = rect.y + 1
  const x = rect.x + 2
  const inner = rect.w - 4
  // Wipe the title band first so a shrinking BPM doesn't leave crumbs.
  scr.putText(x, y, ' '.repeat(Math.max(0, inner)), 'fg', 'pearlLight', 0)
  const bpmLabel = c.bpmPrompt
    ? ('BPM > ' + (c.bpmDraft || '') + '_ (enter accepts, esc cancels)')
    : (c.bpm + ' BPM')
  const parts = [
    { text: 'beat maker', color: 'cedarDark', attr: ATTR.BOLD },
    { text: '·',           color: 'fgDim',    attr: 0 },
    { text: bpmLabel,      color: c.bpmPrompt ? 'pinkDark' : 'mintDark', attr: ATTR.BOLD },
    { text: '·',           color: 'fgDim',    attr: 0 },
    { text: '[ P play ]',  color: 'mintDark', attr: ATTR.BOLD },
    { text: '[ S save ]',  color: 'cedarDark', attr: ATTR.BOLD },
    { text: '[ C clear ]', color: 'pinkDark', attr: ATTR.BOLD },
  ]
  let cx = x
  for (const p of parts) {
    if (cx + p.text.length > x + inner) break
    scr.putText(cx, y, p.text, p.color, 'pearlLight', p.attr)
    cx += p.text.length + 1
  }
}

// Grid — 4 rows, 16 columns. Each cell is 3 chars wide (2 glyph + 1
// space) so the eye reads the beats as a rhythm strip. Row labels sit
// in a 7-char left gutter, in the row's own color.
//
// Returns the y-coordinate of the row below the last grid line — the
// caller uses it to place the hint + preview.
function paintGrid(scr, rect, state) {
  const c = state.composer
  const gridStartY = rect.y + 3
  const labelX = rect.x + 2
  const cellW = 3
  const cellsStartX = labelX + 7   // "KICK   " padded to 7
  const focused = state.focus === 'composer'
  for (let r = 0; r < COMPOSER_ROWS; r++) {
    const meta = COMPOSER_ROW_META[r]
    const y = gridStartY + r
    // Row label — dominant color on pearl.
    scr.putText(labelX, y, meta.name.padEnd(6, ' '), safeColor(meta.color, state),
      'pearlLight', ATTR.BOLD)
    // Beat cells — chunky glyph pair per cell.
    for (let col = 0; col < COMPOSER_COLS; col++) {
      const cx = cellsStartX + col * cellW
      // Clip if the panel is too narrow to fit all 16 cells.
      if (cx + 2 > rect.x + rect.w - 1) break
      const on = c.grid[r][col]
      const isCursor = focused && c.cursor.row === r && c.cursor.col === col
      const cellFg = on ? safeColor(meta.color, state) : 'fgDim'
      const cellGlyph = on ? '▓▓' : ' ·'
      if (isCursor) {
        // Cursor — invert to make the cell read as a box border in the
        // focus color. Blink the invert once per second so the cell is
        // visibly the current step without hiding its content.
        const blink = (Math.floor(state.ticks / 1) % 2) === 0
        const cursorBg = blink ? 'pink' : 'pearlShadow'
        scr.putText(cx, y, cellGlyph, on ? 'pearlLight' : 'cedarDark', cursorBg, ATTR.BOLD)
      } else {
        // Every 4th step gets a slightly tinted background so the eye
        // groups steps into quarters — same trick every DAW does.
        const isQuarter = (col % 4) === 0
        const bg = isQuarter ? 'cream' : 'pearlLight'
        scr.putText(cx, y, cellGlyph, cellFg, bg, on ? ATTR.BOLD : 0)
      }
    }
  }
  return gridStartY + COMPOSER_ROWS
}

// Hint line — one blank row, then the keyboard cheat sheet.
function paintHintLine(scr, rect, gridBottomY, state) {
  const y = gridBottomY + 1
  const x = rect.x + 2
  const inner = rect.w - 4
  scr.putText(x, y, ' '.repeat(Math.max(0, inner)), 'fgDim', 'pearlLight', 0)
  const hint = '↑↓←→ move  ·  SPACE toggle  ·  P play  ·  S save  ·  C clear  ·  T set BPM'
  scr.putText(x, y, hint.slice(0, inner), 'mintDark', 'pearlLight', ATTR.DIM)
}

// Preview line — dim monospace showing the last emitted Scheme form.
// Wraps to 3 lines max so long patterns don't blow up the panel.
function paintPreview(scr, rect, gridBottomY, state) {
  const c = state.composer
  const y = gridBottomY + 3
  const x = rect.x + 2
  const inner = rect.w - 4
  const preview = c.lastEmitted || '(press P to play — the emitted (begin …) shows here)'
  const wrapped = wrapText(preview, inner)
  for (let i = 0; i < Math.min(4, wrapped.length); i++) {
    scr.putText(x, y + i, ' '.repeat(Math.max(0, inner)), 'fgDim', 'pearlLight', 0)
    scr.putText(x, y + i, wrapped[i].slice(0, inner), 'cedar', 'pearlLight', ATTR.DIM)
  }
  // Save-status flash — appears under the preview for saveMsgUntil ms.
  if (c.saveMsg && c.saveMsgUntil > Date.now()) {
    const sy = y + Math.min(4, wrapped.length) + 1
    if (sy < rect.y + rect.h - 1) {
      scr.putText(x, sy, ' '.repeat(Math.max(0, inner)), 'fg', 'pearlLight', 0)
      scr.putText(x, sy, c.saveMsg.slice(0, inner), 'mintDark', 'pearlLight', ATTR.BOLD)
    }
  }
}

// ── key handling ────────────────────────────────────────────────────

// Return true if the key was consumed. `ctx` provides callbacks the
// widget doesn't own: play (Scheme → session), render (to repaint), and
// statusFlash (menubar toast).
export function handleComposerKey(key, state, ctx) {
  const c = state.composer
  if (!c || !c.enabled) return false

  // BPM prompt mode — bufferred numeric input.
  if (c.bpmPrompt) {
    if (key.name === 'escape') {
      c.bpmPrompt = false
      c.bpmDraft = ''
      ctx.render()
      return true
    }
    if (key.name === 'enter') {
      const n = parseInt(c.bpmDraft, 10)
      if (Number.isFinite(n) && n >= 20 && n <= 400) {
        c.bpm = n
        ctx.statusFlash && ctx.statusFlash('BPM set to ' + n)
      } else {
        ctx.statusFlash && ctx.statusFlash('BPM out of range (20-400)')
      }
      c.bpmPrompt = false
      c.bpmDraft = ''
      ctx.render()
      return true
    }
    if (key.name === 'backspace') {
      c.bpmDraft = c.bpmDraft.slice(0, -1)
      ctx.render()
      return true
    }
    if (typeof key.name === 'string' && key.name.length === 1
        && key.name >= '0' && key.name <= '9') {
      if (c.bpmDraft.length < 3) c.bpmDraft += key.name
      ctx.render()
      return true
    }
    // Swallow other keys while in prompt mode.
    return true
  }

  // Cursor movement.
  if (key.name === 'up') {
    c.cursor.row = (c.cursor.row - 1 + COMPOSER_ROWS) % COMPOSER_ROWS
    ctx.render()
    return true
  }
  if (key.name === 'down') {
    c.cursor.row = (c.cursor.row + 1) % COMPOSER_ROWS
    ctx.render()
    return true
  }
  if (key.name === 'left') {
    c.cursor.col = (c.cursor.col - 1 + COMPOSER_COLS) % COMPOSER_COLS
    ctx.render()
    return true
  }
  if (key.name === 'right') {
    c.cursor.col = (c.cursor.col + 1) % COMPOSER_COLS
    ctx.render()
    return true
  }
  // Toggle cell.
  if (key.name === ' ' || key.name === 'enter') {
    const { row, col } = c.cursor
    c.grid[row][col] = !c.grid[row][col]
    ctx.render()
    return true
  }
  // Play.
  if (key.name === 'p' || key.name === 'P') {
    const src = emitPattern(c.grid, c.bpm)
    c.lastEmitted = src
    ctx.play && ctx.play(src)
    ctx.render()
    return true
  }
  // Save.
  if (key.name === 's' || key.name === 'S') {
    const src = emitPattern(c.grid, c.bpm)
    c.lastEmitted = src
    const r = saveCart(c)
    if (r.ok) {
      c.saveMsg = 'saved → ' + r.path
      c.saveMsgUntil = Date.now() + 4000
      ctx.statusFlash && ctx.statusFlash('cart saved')
    } else {
      c.saveMsg = 'save failed: ' + r.error
      c.saveMsgUntil = Date.now() + 6000
      ctx.statusFlash && ctx.statusFlash('save failed: ' + r.error)
    }
    ctx.render()
    return true
  }
  // Clear.
  if (key.name === 'c' || key.name === 'C') {
    clearComposerGrid(c)
    ctx.statusFlash && ctx.statusFlash('grid cleared')
    ctx.render()
    return true
  }
  // BPM prompt.
  if (key.name === 't' || key.name === 'T') {
    c.bpmPrompt = true
    c.bpmDraft = ''
    ctx.render()
    return true
  }
  // Home/End jump to first/last step in the current row.
  if (key.name === 'home') {
    c.cursor.col = 0
    ctx.render()
    return true
  }
  if (key.name === 'end') {
    c.cursor.col = COMPOSER_COLS - 1
    ctx.render()
    return true
  }
  return false
}

// ── helpers ─────────────────────────────────────────────────────────

// Not every theme paints `amber` (Sakura's blossom-name tier). If the
// theme doesn't know it, fall through to the built-in SAKURA palette,
// which does. Screen's palette module already does exactly this in
// makePalette.rgbFor — we're just guarding against typos here.
function safeColor(name, state) {
  if (!name) return FALLBACK_COLOR
  return name
}

// Basic word-preserving line wrap. Falls back to hard-slice if a single
// token is longer than the width. Used only for the preview line where
// long `(begin …)` forms need to display in a couple of lines.
function wrapText(text, width) {
  if (width <= 0) return ['']
  const lines = []
  let cur = ''
  for (const tok of String(text).split(' ')) {
    if (!cur) { cur = tok; continue }
    if (cur.length + 1 + tok.length <= width) {
      cur += ' ' + tok
    } else {
      lines.push(cur)
      cur = tok
    }
    // Hard-wrap a token that's longer than the width.
    while (cur.length > width) {
      lines.push(cur.slice(0, width))
      cur = cur.slice(width)
    }
  }
  if (cur) lines.push(cur)
  return lines.length > 0 ? lines : ['']
}
