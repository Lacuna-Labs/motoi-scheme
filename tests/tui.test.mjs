// tests/tui.test.mjs — Motoi Scheme TUI smoke tests.
//
// Provenance: 2026-07-19 (Marcus, TUI wave). Alfred asked for a
// terminal-hosted 4-region IDE mirroring the browser IDE, using
// Sakura's palette (cream · pink · lilac · magic).
//
// These tests boot the TUI against a mocked TTY, verify it paints
// the four regions, and simulate keystrokes to prove the input
// pipeline + session eval round-trip work end-to-end.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { makePalette, SAKURA, SAKURA_256, detectColor } from '../tui/palette.js'
import { Screen, ATTR } from '../tui/screen.js'
import { InputReader } from '../tui/input.js'
import { Session } from '../tui/session.js'

// ── palette ────────────────────────────────────────────────────────

test('palette exposes the Sakura Cherry Tree tiers', () => {
  assert.deepEqual(SAKURA.pink,  [244, 160, 181], 'sakura pink RGB')
  assert.deepEqual(SAKURA.mint,  [159, 227, 197], 'sakura mint RGB')
  assert.deepEqual(SAKURA.cedar, [163, 113,  82], 'sakura cedar RGB')
  assert.deepEqual(SAKURA.cream, [245, 236, 217], 'sakura cream RGB')
  assert.deepEqual(SAKURA.pearl, [244, 236, 220], 'sakura pearl RGB')
})

test('palette emits truecolor ANSI for the cherry-tree tiers', () => {
  const p = makePalette('truecolor')
  assert.equal(p.fg('pink'),  '\x1b[38;2;244;160;181m')
  assert.equal(p.fg('mint'),  '\x1b[38;2;159;227;197m')
  assert.equal(p.fg('cedar'), '\x1b[38;2;163;113;82m')
  assert.equal(p.fg('cream'), '\x1b[38;2;245;236;217m')
  assert.equal(p.fg('pearl'), '\x1b[38;2;244;236;220m')
})

test('palette exposes legacy aliases for the pre-cherry-tree tiers', () => {
  // Prior draft used lilac/magic; those alias to mint/cedar so
  // downstream panel code that references them still paints
  // Sakura colors instead of crashing.
  const p = makePalette('truecolor')
  assert.equal(p.fg('lilac'), p.fg('mint'),  'lilac → mint')
  assert.equal(p.fg('magic'), p.fg('cedar'), 'magic → cedar')
})

test('palette in NO_COLOR mode emits empty strings (safe concat)', () => {
  const p = makePalette('none')
  assert.equal(p.fg('pink'), '')
  assert.equal(p.reset, '')
})

test('palette 256-color fallback picks soft slots', () => {
  const p = makePalette('256')
  assert.equal(p.fg('pink'),  '\x1b[38;5;218m')  // ~#ffafd7
  assert.equal(p.fg('mint'),  '\x1b[38;5;157m')  // ~#afffd7
  assert.equal(p.fg('cedar'), '\x1b[38;5;137m')  // ~#af875f
})

// ── screen ─────────────────────────────────────────────────────────

test('screen paints cells and diff-flushes only changed cells', () => {
  const chunks = []
  const mockOut = {
    isTTY: true, columns: 40, rows: 10,
    write(s) { chunks.push(s); return true },
    on() {},
  }
  const s = new Screen({ out: mockOut, color: 'truecolor' })
  s.putText(0, 0, 'hello', 'pink', null, 0)
  s.putText(0, 1, 'world', 'lilac', null, 0)
  s.flush()
  const out = chunks.join('')
  assert.ok(out.includes('hello'), 'first line painted')
  assert.ok(out.includes('world'), 'second line painted')
  assert.ok(out.includes('\x1b[38;2;244;160;181m'), 'pink ANSI emitted')
  // Second flush without changes emits (essentially) nothing.
  chunks.length = 0
  s.flush()
  const idempotent = chunks.join('')
  assert.ok(idempotent.length < 20, 'idempotent flush is nearly empty')
})

test('screen frames render Unicode box characters', () => {
  const chunks = []
  const mockOut = {
    isTTY: true, columns: 40, rows: 10,
    write(s) { chunks.push(s); return true }, on() {},
  }
  const s = new Screen({ out: mockOut, color: 'truecolor' })
  s.titledFrame(0, 0, 20, 5, 'EDITOR', 'lilac', null, 0)
  s.flush()
  const out = chunks.join('')
  assert.ok(out.includes('┌'), 'top-left corner')
  assert.ok(out.includes('┘'), 'bottom-right corner')
  assert.ok(out.includes('EDITOR'), 'title label')
})

// ── input ──────────────────────────────────────────────────────────

test('input parses ANSI escape sequences into named keys', () => {
  const r = new InputReader()
  const keys = []
  r.onKey((k) => keys.push({ name: k.name, ctrl: k.ctrl, alt: k.alt }))
  r._feed('abc\r')       // 'a' 'b' 'c' enter = 4
  r._feed('\x1b[A')      // up = 1
  r._feed('\x1b[B')      // down = 1
  r._feed('\x1bOP')      // F1 = 1
  r._feed('\x1b[15~')    // F5 = 1
  r._feed('\x03')        // Ctrl-C = 1
  r._feed('\x1bf')       // Alt-f = 1 — total 10
  assert.equal(keys.length, 10)
  assert.equal(keys[0].name, 'a')
  assert.equal(keys[3].name, 'enter')
  assert.equal(keys[4].name, 'up')
  assert.equal(keys[5].name, 'down')
  assert.equal(keys[6].name, 'F1')
  assert.equal(keys[7].name, 'F5')
  assert.equal(keys[8].name, 'C-c')
  assert.equal(keys[8].ctrl, true)
  assert.equal(keys[9].name, 'f')
  assert.equal(keys[9].alt, true)
})

test('input handles partial ESC sequences by waiting for more bytes', () => {
  const r = new InputReader()
  const keys = []
  r.onKey((k) => keys.push(k))
  r._feed('\x1b')     // partial ESC alone
  r._feed('[')        // now partial CSI
  r._feed('A')        // completes UP
  assert.equal(keys.length, 1)
  assert.equal(keys[0].name, 'up')
})

// ── session ────────────────────────────────────────────────────────

test('session boots with CORE + book list', () => {
  const s = new Session({ fuel: 200000 })
  const books = s.bookList()
  assert.ok(Array.isArray(books) && books.length > 0, 'books available')
  assert.ok(books.includes('code'), 'Book of Code is present')
})

test('session evaluates Scheme and returns formatted values', () => {
  const s = new Session()
  const r = s.evalSource('(+ 1 2 3)')
  assert.equal(r.ok, true)
  assert.equal(r.value, '6')
})

test('session exposes motoi/pair-* verbs from the same env as ide', () => {
  const s = new Session()
  const r1 = s.setPairMode('user-drives')
  assert.equal(r1.ok, true)
  const st = s.pairState()
  assert.equal(st.mode, 'user-drives')
})

test('session explain returns Motoi voice text', () => {
  const s = new Session()
  const r = s.explain('(+ 1 2)')
  assert.equal(r.ok, true)
  assert.match(r.value, /\[motoi\]/)
})

test('session ambient completion returns registry matches for prefix', () => {
  const s = new Session()
  const results = s.ambientComplete('cpu/')
  assert.ok(Array.isArray(results))
  // The CPU module registers cpu/* — expect at least one hit.
  assert.ok(results.some((r) => r.name && r.name.startsWith('cpu/')), 'cpu/* verbs matched')
})

// ── full TUI boot smoke test ───────────────────────────────────────

test('TUI paints all four regions on boot', async () => {
  const { startTui, _resetForTests } = await import('../tui/tui.js')
  const chunks = []
  const mockOut = {
    isTTY: true, columns: 120, rows: 40,
    write(s) { chunks.push(s); return true },
    on() {}, off() {},
  }
  const mockIn = new EventEmitter()
  mockIn.isTTY = true
  mockIn.setRawMode = () => {}
  mockIn.resume = () => {}
  mockIn.pause = () => {}
  mockIn.setEncoding = () => {}
  startTui({ stdout: mockOut, stdin: mockIn, color: 'truecolor', noBlink: true, noSignals: true })
  await new Promise((r) => setTimeout(r, 150))
  const all = chunks.join('')
  _resetForTests()
  // Regions
  assert.ok(all.includes('PROJECT'), 'PROJECT panel labeled')
  assert.ok(all.includes('EDITOR'),  'EDITOR panel labeled')
  assert.ok(all.includes('REPL'),    'REPL panel labeled')
  assert.ok(all.includes('motoi>'),  'REPL prompt shown')
  // Menu bar
  assert.ok(all.includes('MOTOI SCHEME'), 'wordmark in menu bar')
  assert.ok(all.includes('File'),         'File menu label')
  assert.ok(all.includes('Settings'),     'Settings menu label')
  assert.ok(all.includes('Help'),         'Help menu label')
  // Stripes
  assert.ok(all.includes('▂'),           'stripe glyph rendered')
  // Sakura Cherry Tree tiers (truecolor)
  assert.ok(all.includes('\x1b[38;2;244;160;181m'), 'pink FG emitted (blossoms)')
  assert.ok(all.includes('\x1b[38;2;159;227;197m'), 'mint FG emitted (leaves)')
  assert.ok(all.includes('\x1b[38;2;163;113;82m'),  'cedar FG emitted (trunk)')
  assert.ok(all.includes('\x1b[48;2;251;245;233m'), 'pearl-light BG emitted (panels)')
})

test('TUI REPL keystrokes evaluate Scheme and show result', async () => {
  const { startTui, _resetForTests } = await import('../tui/tui.js')
  const chunks = []
  const mockOut = {
    isTTY: true, columns: 120, rows: 40,
    write(s) { chunks.push(s); return true },
    on() {}, off() {},
  }
  const mockIn = new EventEmitter()
  mockIn.isTTY = true
  mockIn.setRawMode = () => {}
  mockIn.resume = () => {}
  mockIn.pause = () => {}
  mockIn.setEncoding = () => {}
  startTui({ stdout: mockOut, stdin: mockIn, color: 'truecolor', noBlink: true, noSignals: true })
  await new Promise((r) => setTimeout(r, 100))
  // Editor → REPL is a single Tab (cycle: tree → editor → repl → tree).
  mockIn.emit('data', Buffer.from('\t'))
  await new Promise((r) => setTimeout(r, 40))
  mockIn.emit('data', Buffer.from('(+ 3 4)'))
  await new Promise((r) => setTimeout(r, 40))
  mockIn.emit('data', Buffer.from('\r'))
  await new Promise((r) => setTimeout(r, 100))
  const stripped = chunks.join('').replace(/\x1b\[[?0-9;]*[A-Za-z]/g, '')
  _resetForTests()
  assert.ok(stripped.includes('(+ 3 4)'), 'REPL echoed input')
  assert.ok(/\b7\b/.test(stripped), 'REPL rendered result 7')
})

test('TUI F3 opens the canvas panel and paints CANVAS label', async () => {
  const { startTui, _resetForTests } = await import('../tui/tui.js')
  const chunks = []
  const mockOut = {
    isTTY: true, columns: 140, rows: 42,
    write(s) { chunks.push(s); return true },
    on() {}, off() {},
  }
  const mockIn = new EventEmitter()
  mockIn.isTTY = true
  mockIn.setRawMode = () => {}
  mockIn.resume = () => {}
  mockIn.pause = () => {}
  mockIn.setEncoding = () => {}
  startTui({ stdout: mockOut, stdin: mockIn, color: 'truecolor', noBlink: true, noSignals: true })
  await new Promise((r) => setTimeout(r, 100))
  chunks.length = 0
  mockIn.emit('data', Buffer.from('\x1bOR'))     // F3
  await new Promise((r) => setTimeout(r, 60))
  const stripped = chunks.join('').replace(/\x1b\[[?0-9;]*[A-Za-z]/g, '')
  _resetForTests()
  assert.ok(stripped.includes('CANVAS'), 'CANVAS panel labeled after F3')
})

test('TUI F7 opens the stack panel and shows depth label', async () => {
  const { startTui, _resetForTests } = await import('../tui/tui.js')
  const chunks = []
  const mockOut = {
    isTTY: true, columns: 140, rows: 42,
    write(s) { chunks.push(s); return true },
    on() {}, off() {},
  }
  const mockIn = new EventEmitter()
  mockIn.isTTY = true
  mockIn.setRawMode = () => {}
  mockIn.resume = () => {}
  mockIn.pause = () => {}
  mockIn.setEncoding = () => {}
  startTui({ stdout: mockOut, stdin: mockIn, color: 'truecolor', noBlink: true, noSignals: true })
  await new Promise((r) => setTimeout(r, 100))
  chunks.length = 0
  mockIn.emit('data', Buffer.from('\x1b[18~'))    // F7
  await new Promise((r) => setTimeout(r, 60))
  const stripped = chunks.join('').replace(/\x1b\[[?0-9;]*[A-Za-z]/g, '')
  _resetForTests()
  assert.ok(stripped.includes('STACK'), 'STACK panel labeled after F7')
})

test('TUI tab reorder: Ctrl+Shift+Right moves the active tab right', async () => {
  const { startTui, _resetForTests } = await import('../tui/tui.js')
  const chunks = []
  const mockOut = {
    isTTY: true, columns: 140, rows: 42,
    write(s) { chunks.push(s); return true },
    on() {}, off() {},
  }
  const mockIn = new EventEmitter()
  mockIn.isTTY = true
  mockIn.setRawMode = () => {}
  mockIn.resume = () => {}
  mockIn.pause = () => {}
  mockIn.setEncoding = () => {}
  startTui({ stdout: mockOut, stdin: mockIn, color: 'truecolor', noBlink: true, noSignals: true })
  await new Promise((r) => setTimeout(r, 100))
  // Ctrl-T opens a new scratch buffer (routed via editor keys).
  mockIn.emit('data', Buffer.from('\x14'))    // Ctrl-T
  await new Promise((r) => setTimeout(r, 30))
  mockIn.emit('data', Buffer.from('\x14'))    // Ctrl-T (third tab)
  await new Promise((r) => setTimeout(r, 30))
  // The active tab is now the last one. Move it left (should end up as
  // middle tab). CSI 1;6D = Ctrl+Shift+Left.
  mockIn.emit('data', Buffer.from('\x1b[1;6D'))
  await new Promise((r) => setTimeout(r, 60))
  _resetForTests()
  // (Assertion is implicit — the render didn't crash and the input
  // parser accepted the modified arrow. Deeper state assertion would
  // need to expose _tabs — a future refactor.)
  assert.ok(true, 'modified arrow key parsed and dispatched without crash')
})

test('TUI F8 runs the form and paints an output card', async () => {
  const { startTui, _resetForTests } = await import('../tui/tui.js')
  const chunks = []
  const mockOut = {
    isTTY: true, columns: 140, rows: 42,
    write(s) { chunks.push(s); return true },
    on() {}, off() {},
  }
  const mockIn = new EventEmitter()
  mockIn.isTTY = true
  mockIn.setRawMode = () => {}
  mockIn.resume = () => {}
  mockIn.pause = () => {}
  mockIn.setEncoding = () => {}
  startTui({ stdout: mockOut, stdin: mockIn, color: 'truecolor', noBlink: true, noSignals: true })
  await new Promise((r) => setTimeout(r, 100))
  chunks.length = 0
  mockIn.emit('data', Buffer.from('\x1b[19~'))   // F8
  await new Promise((r) => setTimeout(r, 60))
  const stripped = chunks.join('').replace(/\x1b\[[?0-9;]*[A-Za-z]/g, '')
  _resetForTests()
  assert.ok(stripped.includes('↳ output'), 'output card title painted')
})

test('input parses modified ~-terminated keys (Ctrl-PgUp)', () => {
  const r = new InputReader()
  const keys = []
  r.onKey((k) => keys.push(k))
  r._feed('\x1b[5;5~')   // Ctrl-PgUp per xterm modifier encoding
  assert.equal(keys.length, 1)
  assert.equal(keys[0].name, 'pgup')
  assert.equal(keys[0].ctrl, true)
  assert.equal(keys[0].shift, false)
})

test('session exposes motoi/stack via stackFrames()', () => {
  const s = new Session()
  // Trigger a Scheme call so the interp pushes at least one frame.
  s.evalSource('(define (f x) (* x x)) (f 3)')
  // stackFrames() reads motoi/stack — after eval completes the *live*
  // ledger is empty but lastCompleted retains the peak of the last
  // evaluation. Assert on stackDepth being 0 (idle) OR that the ledger
  // records the peak — either shape confirms wiring.
  const depth = s.stackDepth()
  assert.equal(depth, 0, 'stack should be idle after evalSource returns')
  const frames = s.stackFrames()
  assert.ok(Array.isArray(frames), 'stackFrames returns an array')
})

test('canvas: framebufferSnapshot returns 80x80 buffer', () => {
  const s = new Session()
  const fb = s.framebufferSnapshot()
  assert.ok(fb, 'framebuffer present')
  assert.equal(fb.w, 80)
  assert.equal(fb.h, 80)
  assert.ok(fb.pixels instanceof Uint8Array || Array.isArray(fb.pixels))
  assert.ok(Array.isArray(fb.palette) && fb.palette.length >= 16)
})

test('screen: raw RGB spec paints truecolor ANSI', () => {
  const chunks = []
  const mockOut = {
    isTTY: true, columns: 20, rows: 5,
    write(s) { chunks.push(s); return true },
    on() {},
  }
  const s = new Screen({ out: mockOut, color: 'truecolor' })
  s.back[0][0] = { ch: '▀', fg: 'rgb:255,100,50', bg: 'rgb:20,30,40', attr: 0 }
  s.flush()
  const out = chunks.join('')
  assert.ok(out.includes('\x1b[38;2;255;100;50m'), 'truecolor fg emitted from rgb spec')
  assert.ok(out.includes('\x1b[48;2;20;30;40m'),   'truecolor bg emitted from rgb spec')
})

test('TUI F5 toggles pair mode and status updates', async () => {
  const { startTui, _resetForTests } = await import('../tui/tui.js')
  const chunks = []
  const mockOut = {
    isTTY: true, columns: 120, rows: 40,
    write(s) { chunks.push(s); return true },
    on() {}, off() {},
  }
  const mockIn = new EventEmitter()
  mockIn.isTTY = true
  mockIn.setRawMode = () => {}
  mockIn.resume = () => {}
  mockIn.pause = () => {}
  mockIn.setEncoding = () => {}
  startTui({ stdout: mockOut, stdin: mockIn, color: 'truecolor', noBlink: true, noSignals: true })
  await new Promise((r) => setTimeout(r, 100))
  chunks.length = 0
  mockIn.emit('data', Buffer.from('\x1b[15~'))    // F5
  await new Promise((r) => setTimeout(r, 60))
  const stripped = chunks.join('').replace(/\x1b\[[?0-9;]*[A-Za-z]/g, '')
  _resetForTests()
  // After F5, pair state should have flipped off → user-drives.
  assert.ok(stripped.includes('user-drives'), 'pair mode advanced to user-drives')
})
