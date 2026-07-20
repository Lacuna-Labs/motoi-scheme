// tui/input.js — raw keystroke reader for the TUI.
//
// stdin is put into raw mode so we get each keypress as it happens.
// We decode ANSI escape sequences into named keys (arrow keys, F-keys,
// alt-combos) so panels don't have to parse escape codes themselves.
//
// This is deliberately small — Node's readline already handles a lot
// of this but its abstractions fight raw-mode painting. Handrolled is
// tighter and predictable.

export class InputReader {
  constructor(opts = {}) {
    this.stdin = opts.stdin || process.stdin
    this.listeners = new Set()
    this._buf = ''
    this._onData = (chunk) => this._feed(chunk.toString('utf8'))
  }

  start() {
    if (this.stdin.setRawMode) this.stdin.setRawMode(true)
    this.stdin.resume()
    this.stdin.setEncoding('utf8')
    this.stdin.on('data', this._onData)
  }

  stop() {
    this.stdin.off('data', this._onData)
    if (this.stdin.setRawMode) this.stdin.setRawMode(false)
    this.stdin.pause()
  }

  onKey(fn) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  _emit(key) {
    for (const l of this.listeners) {
      try { l(key) } catch (e) {
        // Never let a listener crash the input loop.
        process.stderr.write('[tui/input] listener error: ' + e.message + '\n')
      }
    }
  }

  // ── incoming chunk demux ──────────────────────────────────────────
  _feed(chunk) {
    this._buf += chunk
    while (this._buf.length > 0) {
      const parsed = parseKey(this._buf)
      if (!parsed) return    // wait for more bytes (incomplete escape)
      this._buf = this._buf.slice(parsed.consumed)
      this._emit(parsed.key)
    }
  }
}

// ── key parsing ─────────────────────────────────────────────────────
//
// Returns { key, consumed } or null if the buffer is a partial ESC
// sequence. `key` is { name, ctrl, alt, shift, raw }.

function parseKey(s) {
  if (!s.length) return null
  const c0 = s[0]

  // Ctrl+char (0x01–0x1a excluding ESC/tab/enter)
  if (c0 === '\x03') return keyOf('C-c', s[0], { ctrl: true })
  if (c0 === '\x04') return keyOf('C-d', s[0], { ctrl: true })
  if (c0 === '\x08') return keyOf('backspace', s[0])
  if (c0 === '\x7f') return keyOf('backspace', s[0])
  if (c0 === '\r') return keyOf('enter', s[0])
  if (c0 === '\n') return keyOf('enter', s[0])
  if (c0 === '\t') return keyOf('tab', s[0])

  // ESC sequences
  if (c0 === '\x1b') {
    if (s.length === 1) return null   // incomplete
    // Alt + <char>
    if (s.length >= 2 && s[1] !== '[' && s[1] !== 'O') {
      // Alt+char: "\x1b" + char
      return {
        consumed: 2,
        key: { name: s[1], ctrl: false, alt: true, shift: false, raw: s.slice(0, 2) },
      }
    }
    if (s[1] === '[' || s[1] === 'O') {
      // CSI or SS3 — find terminator (letter or ~).
      let end = 2
      while (end < s.length && !/[A-Za-z~]/.test(s[end])) end++
      if (end >= s.length) return null   // incomplete
      const seq = s.slice(0, end + 1)
      return {
        consumed: end + 1,
        key: parseCsi(seq),
      }
    }
    // Bare ESC by itself — treat as Escape.
    return keyOf('escape', c0)
  }

  // Ctrl-A..Ctrl-Z (0x01..0x1a), excluding \r \n \t already handled
  if (c0 >= '\x01' && c0 <= '\x1a') {
    const letter = String.fromCharCode(c0.charCodeAt(0) + 96) // 'a'-'z'
    return {
      consumed: 1,
      key: { name: 'C-' + letter, ctrl: true, alt: false, shift: false, raw: c0 },
    }
  }

  // Regular printable — pass through as-is.
  return keyOf(c0, c0)
}

function keyOf(name, raw, extras = {}) {
  return {
    consumed: raw.length,
    key: {
      name,
      ctrl: extras.ctrl || false,
      alt: extras.alt || false,
      shift: extras.shift || false,
      raw,
    },
  }
}

function parseCsi(seq) {
  // Common single-char terminators for arrow / home / end / pgup / pgdn.
  const last = seq[seq.length - 1]
  const middle = seq.slice(2, -1)   // strip \x1b[
  const map = {
    A: 'up', B: 'down', C: 'right', D: 'left',
    H: 'home', F: 'end',
  }
  if (map[last] && !middle) {
    return { name: map[last], ctrl: false, alt: false, shift: false, raw: seq }
  }
  // Function keys — F1..F4 come as \x1bOP..S (SS3), F5+ as \x1b[15~ etc.
  if (seq[1] === 'O') {
    const fmap = { P: 'F1', Q: 'F2', R: 'F3', S: 'F4' }
    if (fmap[last]) return { name: fmap[last], ctrl: false, alt: false, shift: false, raw: seq }
  }
  if (last === '~') {
    const parts = middle.split(';')
    const n = parseInt(parts[0], 10)
    const fkeys = { 2: 'insert', 3: 'delete', 5: 'pgup', 6: 'pgdn',
      15: 'F5', 17: 'F6', 18: 'F7', 19: 'F8',
      20: 'F9', 21: 'F10', 23: 'F11', 24: 'F12' }
    if (fkeys[n]) {
      // Modifier byte — CSI n;<mod>~ per xterm. Same encoding as arrows.
      let shift = false, alt = false, ctrl = false
      if (parts.length >= 2) {
        const mod = parseInt(parts[1], 10)
        if (Number.isFinite(mod) && mod >= 2) {
          shift = !!(((mod - 1) & 1))
          alt   = !!(((mod - 1) & 2))
          ctrl  = !!(((mod - 1) & 4))
        }
      }
      return { name: fkeys[n], ctrl, alt, shift, raw: seq }
    }
  }
  // Modified arrow keys (Shift/Alt/Ctrl) — CSI 1;<mod><letter>.
  if (map[last] && /^1;\d+$/.test(middle)) {
    const mod = parseInt(middle.split(';')[1], 10)
    // Xterm's modifier encoding: 2=Shift, 3=Alt, 4=Alt+Shift,
    // 5=Ctrl, 6=Ctrl+Shift, 7=Ctrl+Alt, 8=Ctrl+Alt+Shift.
    const shift = !!(((mod - 1) & 1))
    const alt   = !!(((mod - 1) & 2))
    const ctrl  = !!(((mod - 1) & 4))
    return { name: map[last], ctrl, alt, shift, raw: seq }
  }
  // Unknown — pass through as a raw seq for diagnostics.
  return { name: 'unknown', ctrl: false, alt: false, shift: false, raw: seq }
}

export default InputReader
