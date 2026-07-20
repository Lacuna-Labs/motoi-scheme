// tui/screen.js — cell grid + double-buffered painter for the TUI.
//
// Doctrine: the whole TUI paints into an in-memory buffer, then we
// diff-flush to stdout each frame. Diff-flush means we only emit ANSI
// for cells that actually changed since the previous frame — no full
// clear, no flicker. On a 120×40 terminal the average delta is ~40
// cells per keystroke, well inside the interactive budget.
//
// Zero deps. Every method is O(cells) worst case.
//
// A "cell" is { ch, fg, bg, attr }. `ch` is a single grapheme (we don't
// try to handle wide-CJK — that's a later wave; the ASCII/Latin surface
// works today). `fg`/`bg` are palette tier names ('pink', 'lilac', …)
// or null. `attr` is a bitfield: BOLD=1, DIM=2, REV=4.

import { makePalette, RESET, BOLD, DIM, REV, detectColor } from './palette.js'

const ATTR = { BOLD: 1, DIM: 2, REV: 4 }
export { ATTR }

function makeCell(ch, fg, bg, attr) {
  return { ch: ch || ' ', fg: fg || null, bg: bg || null, attr: attr | 0 }
}
function cellEq(a, b) {
  return a.ch === b.ch && a.fg === b.fg && a.bg === b.bg && a.attr === b.attr
}

export class Screen {
  constructor(opts = {}) {
    this.out = opts.out || process.stdout
    this.mode = opts.color || detectColor(this.out)
    this.palette = makePalette(this.mode)
    // Terminal size — recomputed on SIGWINCH.
    this.cols = this.out.columns || 80
    this.rows = this.out.rows || 24
    // Two buffers: front is what's on screen, back is what we're painting.
    this.front = this._blank()
    this.back  = this._blank()
    this._resizeHandler = () => this.resize(this.out.columns, this.out.rows)
    if (this.out.on) this.out.on('resize', this._resizeHandler)
  }

  _blank() {
    const rows = []
    for (let r = 0; r < this.rows; r++) {
      const row = new Array(this.cols)
      for (let c = 0; c < this.cols; c++) row[c] = makeCell(' ', null, null, 0)
      rows.push(row)
    }
    return rows
  }

  resize(cols, rows) {
    this.cols = cols || this.cols
    this.rows = rows || this.rows
    this.front = this._blank()
    this.back  = this._blank()
    // Force a full paint by clearing the terminal — first flush will
    // repopulate against the fresh front.
    this.out.write('\x1b[2J\x1b[H')
  }

  clear() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        this.back[r][c] = makeCell(' ', null, null, 0)
      }
    }
  }

  /** Write a single cell to back-buffer. Out-of-bounds is silently dropped. */
  putCell(x, y, ch, fg, bg, attr) {
    if (y < 0 || y >= this.rows || x < 0 || x >= this.cols) return
    this.back[y][x] = makeCell(ch || ' ', fg, bg, attr | 0)
  }

  /** Draw a run of text; wraps at cols by clipping (no soft-wrap). */
  putText(x, y, text, fg, bg, attr) {
    if (y < 0 || y >= this.rows) return
    const s = String(text ?? '')
    // Strip inline ANSI (e.g. from user REPL output) so the grid renders
    // cleanly. Callers who want color pass fg/bg.
    const plain = s.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')
    for (let i = 0; i < plain.length; i++) {
      const c = x + i
      if (c >= this.cols) break
      if (c < 0) continue
      this.putCell(c, y, plain[i], fg, bg, attr | 0)
    }
  }

  /** Fill a rect with a single character + attrs. */
  fillRect(x, y, w, h, ch, fg, bg, attr) {
    for (let r = y; r < y + h; r++) {
      for (let c = x; c < x + w; c++) {
        this.putCell(c, r, ch, fg, bg, attr | 0)
      }
    }
  }

  /** Frame a rectangle using Unicode box-drawing (single line). */
  frame(x, y, w, h, fg, bg, attr) {
    if (w < 2 || h < 2) return
    const a = attr | 0
    // Corners
    this.putCell(x,           y,           '┌', fg, bg, a)
    this.putCell(x + w - 1,   y,           '┐', fg, bg, a)
    this.putCell(x,           y + h - 1,   '└', fg, bg, a)
    this.putCell(x + w - 1,   y + h - 1,   '┘', fg, bg, a)
    // Top / bottom
    for (let c = x + 1; c < x + w - 1; c++) {
      this.putCell(c, y,             '─', fg, bg, a)
      this.putCell(c, y + h - 1,     '─', fg, bg, a)
    }
    // Sides
    for (let r = y + 1; r < y + h - 1; r++) {
      this.putCell(x,         r, '│', fg, bg, a)
      this.putCell(x + w - 1, r, '│', fg, bg, a)
    }
  }

  /** Titled frame — draws a title label overlaid on the top edge. */
  titledFrame(x, y, w, h, title, fg, bg, attr) {
    this.frame(x, y, w, h, fg, bg, attr)
    if (!title) return
    const label = ' ' + title + ' '
    if (label.length > w - 4) {
      this.putText(x + 2, y, label.slice(0, w - 4), fg, bg, (attr | 0) | ATTR.BOLD)
    } else {
      this.putText(x + 2, y, label, fg, bg, (attr | 0) | ATTR.BOLD)
    }
  }

  // ── flushing ────────────────────────────────────────────────────────

  _ansiFor(cell) {
    const p = this.palette
    if (p.mode === 'none') return ''
    let seq = RESET
    if (cell.attr & ATTR.BOLD) seq += BOLD
    if (cell.attr & ATTR.DIM)  seq += DIM
    if (cell.attr & ATTR.REV)  seq += REV
    if (cell.fg) seq += this._colorSeq(cell.fg, false)
    if (cell.bg) seq += this._colorSeq(cell.bg, true)
    return seq
  }

  // Encode a color spec. Two shapes are honored:
  //   1) a palette tier name ('pink', 'mint', 'cedar', …) — resolves
  //      through the palette module (SAKURA truecolor / SAKURA_256).
  //   2) a raw RGB triple 'rgb:R,G,B' — used by the canvas panel to
  //      display the framebuffer's own 16-color palette (PICO-8-ish)
  //      without smashing it into the Sakura tier list.
  _colorSeq(spec, isBg) {
    if (typeof spec === 'string' && spec.length > 4 && spec.charCodeAt(0) === 114 /* r */
        && spec.startsWith('rgb:')) {
      const parts = spec.slice(4).split(',')
      const r = parts[0] | 0, g = parts[1] | 0, b = parts[2] | 0
      const p = this.palette
      const prefix = isBg ? '48' : '38'
      if (p.mode === 'truecolor') return '\x1b[' + prefix + ';2;' + r + ';' + g + ';' + b + 'm'
      // 256-color fallback: pick a slot in the 6×6×6 cube.
      const c = (v) => Math.min(5, Math.max(0, Math.round(v / 51)))
      const idx = 16 + 36 * c(r) + 6 * c(g) + c(b)
      return '\x1b[' + prefix + ';5;' + idx + 'm'
    }
    return isBg ? this.palette.bg(spec) : this.palette.fg(spec)
  }

  /** Diff-flush: emit ANSI + text only for cells that changed. */
  flush() {
    let out = ''
    let curX = -2, curY = -2   // -2 = not currently positioned
    let curSeq = ''
    // Hide cursor while painting to eliminate flicker on slow terminals.
    out += '\x1b[?25l'
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const b = this.back[r][c]
        const f = this.front[r][c]
        if (cellEq(b, f)) continue
        // Move cursor if we're not already right after the previous cell.
        if (curX !== c || curY !== r) {
          out += '\x1b[' + (r + 1) + ';' + (c + 1) + 'H'
        }
        const seq = this._ansiFor(b)
        if (seq !== curSeq) {
          out += seq
          curSeq = seq
        }
        out += b.ch
        curX = c + 1
        curY = r
        // Commit to front.
        this.front[r][c] = { ch: b.ch, fg: b.fg, bg: b.bg, attr: b.attr }
      }
    }
    // Restore default styling; the caller (e.g. cursor placement) may
    // want a clean SGR after our paint.
    out += RESET
    // Show cursor again (caller can hide + place explicitly).
    out += '\x1b[?25h'
    // Skip write if nothing actually changed — the boilerplate hide/
    // show/reset alone is (2 + reset.length + 2) chars in practice.
    const wrapperLen = '\x1b[?25l'.length + RESET.length + '\x1b[?25h'.length
    if (out.length > wrapperLen) {
      this.out.write(out)
    }
  }

  /** Force full repaint (drops the diff optimization for one frame). */
  fullFlush() {
    // Zero the front so every back cell reads as changed.
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) this.front[r][c] = makeCell('\x00', null, null, -1)
    }
    this.out.write('\x1b[2J\x1b[H')
    this.flush()
  }

  /** Explicit cursor placement AFTER a flush. */
  placeCursor(x, y) {
    if (x < 0 || y < 0) { this.out.write('\x1b[?25l'); return }
    this.out.write('\x1b[' + (y + 1) + ';' + (x + 1) + 'H\x1b[?25h')
  }

  /** Enter alt-screen; save cursor. Call this once on startup. */
  enterAltScreen() {
    // 1049 = alt screen buffer + save/restore cursor + clear on exit.
    // This is what vim / less / htop use. Prevents polluting the user's
    // scrollback when we exit.
    this.out.write('\x1b[?1049h\x1b[?25l\x1b[2J\x1b[H')
  }

  /** Leave alt-screen; restore user's shell. */
  leaveAltScreen() {
    this.out.write('\x1b[?25h\x1b[?1049l')
  }
}

export default Screen
