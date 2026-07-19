// tests/composer/hunt-tui.test.js
//
// Zane #4 — TUI bug hunt.
//
// Attack surface: terminal widths (20/40/80/132/200/1/0), heights,
// non-TTY stdout, NO_COLOR, TERM values, unicode/emoji labels, RTL,
// oversized labels, 300-step piano-roll in narrow terminal, 32×32
// sprite-grid, ANSI-escape injection in labels, SIGWINCH mid-render.
//
// These tests are DESIGNED TO FAIL where the renderer misbehaves.
// Green = a real bug got fixed. Red = the bug is real and open.
//
// The renderer under test is a PURE function of the canvas (per module
// header) — it takes no width/height, ignores TERM, ignores TTY-ness.
// The tests below assert what a well-behaved TUI renderer WOULD do;
// most will fail against the current implementation, and that's the
// point of a hunt file.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderCanvasToTUI, TUI_ANSI } from '../../lib/composer/tui.js'

// ── minimal widget/canvas builders (bypass Scheme evaluator) ────────

function makeCanvas(children = [], bind = ['test']) {
  return { kind: 'canvas', bind, opts: {}, body: [], children }
}

function makeSlider({ label = '', min = 0, max = 1, value = 0.5 } = {}) {
  return {
    kind: 'slider',
    bind: ['x'],
    opts: { label, min, max, step: 0.01, orientation: 'horizontal', log: false },
    state: { value },
  }
}

function makeButton(label = 'ok') {
  return { kind: 'button', bind: [], opts: { label }, state: { emits: null, clicked: 0 } }
}

function makeTextField({ label = 'name', value = '' } = {}) {
  return { kind: 'text-field', bind: ['f'], opts: { label }, state: { value } }
}

function makeToggle({ label = 't', value = false } = {}) {
  return { kind: 'toggle', bind: ['t'], opts: { label }, state: { value } }
}

function makePianoRoll({ steps = 16, notes = [], label = '' } = {}) {
  return {
    kind: 'piano-roll',
    bind: ['song', 'notes'],
    opts: { label, range: ['C3', 'C6'], steps, emitShape: 'sequence' },
    state: { notes },
  }
}

function makeSpriteGrid({ w = 8, h = 8 } = {}) {
  const pixels = []
  for (let r = 0; r < h; r++) pixels.push(new Array(w).fill(0))
  return {
    kind: 'sprite-grid',
    bind: ['hero'],
    opts: { w, h, palette: 'pico-8', emitShape: 'sprite/from-grid' },
    state: { pixels },
  }
}

// Strip ANSI escapes so we can measure printable width.
function stripAnsi(s) {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '')
}

// Longest visible line width across the rendered output.
function maxLineWidth(s) {
  return s.split('\n').reduce((m, l) => Math.max(m, stripAnsi(l).length), 0)
}

// ── 1. terminal-width degradation ───────────────────────────────────

// The renderer today ignores width entirely. If the caller passes
// { width: N } it *should* clamp output to N columns. It does not.
// These four tests document the gap at 20/40/80/132/200 columns.

for (const width of [20, 40, 80, 132, 200]) {
  test(`hunt — output fits within width=${width} when hinted`, () => {
    const canvas = makeCanvas([
      makeSlider({ label: 'Attack', value: 0.5 }),
      makeButton('Save'),
    ])
    const out = renderCanvasToTUI(canvas, { brand: false, width })
    const w = maxLineWidth(out)
    assert.ok(
      w <= width,
      `renderer ignored width=${width} — got a line ${w} cols wide`,
    )
  })
}

// Pathological widths — must not throw, must produce SOMETHING legible.

test('hunt — width=1 degrades without throwing', () => {
  const canvas = makeCanvas([makeSlider({ label: 'A' })])
  let out
  assert.doesNotThrow(() => {
    out = renderCanvasToTUI(canvas, { brand: false, width: 1 })
  })
  assert.ok(out.length > 0, 'produced empty output at width=1')
  assert.ok(
    maxLineWidth(out) <= 1,
    `width=1 hint ignored — line max was ${maxLineWidth(out)}`,
  )
})

test('hunt — width=0 must not crash and must not emit fixed 40-col stripes', () => {
  const canvas = makeCanvas([makeButton('hi')])
  let out
  assert.doesNotThrow(() => {
    out = renderCanvasToTUI(canvas, { width: 0 }) // brand ON — stripes are 40
  })
  // Today: stripes always 40 chars regardless of width. This asserts they aren't.
  assert.ok(
    maxLineWidth(out) <= 0 || !out.includes('='.repeat(40)),
    `width=0 still emitted a 40-char stripe`,
  )
})

// ── 2. terminal-height / row-count clamping ─────────────────────────

for (const height of [5, 24, 100, 1]) {
  test(`hunt — output fits within height=${height} when hinted`, () => {
    // 300-step piano-roll ⇒ 13+ lines guaranteed.
    const canvas = makeCanvas([makePianoRoll({ steps: 300 })])
    const out = renderCanvasToTUI(canvas, { brand: false, height })
    const lines = out.split('\n').length
    assert.ok(
      lines <= height,
      `renderer ignored height=${height} — got ${lines} lines`,
    )
  })
}

// ── 3. non-TTY stdout — ANSI escape suppression ─────────────────────

test('hunt — piped-stdout hint {isTTY:false} strips ANSI escapes', () => {
  const canvas = makeCanvas([makeSlider({ label: 'A' })])
  const out = renderCanvasToTUI(canvas, { brand: false, isTTY: false })
  // eslint-disable-next-line no-control-regex
  assert.equal(/\x1b\[/.test(out), false, 'ANSI escape present in non-TTY output')
})

// ── 4. NO_COLOR env ────────────────────────────────────────────────

test('hunt — NO_COLOR env is respected (no ANSI escapes)', () => {
  const prev = process.env.NO_COLOR
  process.env.NO_COLOR = '1'
  try {
    const canvas = makeCanvas([makeButton('go')])
    const out = renderCanvasToTUI(canvas, { brand: false })
    // eslint-disable-next-line no-control-regex
    assert.equal(/\x1b\[/.test(out), false, 'NO_COLOR set but ANSI escape emitted')
  } finally {
    if (prev == null) delete process.env.NO_COLOR
    else process.env.NO_COLOR = prev
  }
})

// ── 5. TERM values ─────────────────────────────────────────────────

test('hunt — TERM=dumb suppresses ANSI escapes', () => {
  const prev = process.env.TERM
  process.env.TERM = 'dumb'
  try {
    const canvas = makeCanvas([makeButton('go')])
    const out = renderCanvasToTUI(canvas, { brand: false })
    // eslint-disable-next-line no-control-regex
    assert.equal(/\x1b\[/.test(out), false, 'TERM=dumb but ANSI escape emitted')
  } finally {
    if (prev == null) delete process.env.TERM
    else process.env.TERM = prev
  }
})

for (const term of ['xterm', 'xterm-256color']) {
  test(`hunt — TERM=${term} renders without throwing`, () => {
    const prev = process.env.TERM
    process.env.TERM = term
    try {
      const canvas = makeCanvas([makeButton('go')])
      assert.doesNotThrow(() => renderCanvasToTUI(canvas, { brand: false }))
    } finally {
      if (prev == null) delete process.env.TERM
      else process.env.TERM = prev
    }
  })
}

test('hunt — TERM unset falls back to plain text', () => {
  const prev = process.env.TERM
  delete process.env.TERM
  try {
    const canvas = makeCanvas([makeButton('go')])
    assert.doesNotThrow(() => renderCanvasToTUI(canvas, { brand: false }))
  } finally {
    if (prev != null) process.env.TERM = prev
  }
})

// ── 6. Unicode / emoji in :label ───────────────────────────────────

test('hunt — emoji label preserved and does not corrupt width math', () => {
  // Two-column-wide emoji + combining chars. String.length ≠ display width.
  const canvas = makeCanvas([makeButton('save 💾 🎹')])
  const out = renderCanvasToTUI(canvas, { brand: false })
  assert.ok(out.includes('💾'), 'emoji stripped from label')
  assert.ok(out.includes('🎹'), 'emoji stripped from label')
})

test('hunt — CJK label preserved', () => {
  const canvas = makeCanvas([makeSlider({ label: '音量', value: 0.5 })])
  const out = renderCanvasToTUI(canvas, { brand: false })
  assert.ok(out.includes('音量'), 'CJK label missing from output')
})

// ── 7. RTL text (Arabic / Hebrew) in :label ─────────────────────────

test('hunt — Arabic RTL label preserved verbatim', () => {
  // "volume" in Arabic.
  const canvas = makeCanvas([makeSlider({ label: 'مستوى الصوت' })])
  const out = renderCanvasToTUI(canvas, { brand: false })
  assert.ok(out.includes('مستوى'), 'RTL label lost')
})

test('hunt — Hebrew RTL label preserved verbatim', () => {
  const canvas = makeCanvas([makeSlider({ label: 'עוצמת קול' })])
  const out = renderCanvasToTUI(canvas, { brand: false })
  assert.ok(out.includes('עוצמת'), 'Hebrew label lost')
})

// ── 8. Very long labels — wrap or truncate? ────────────────────────

test('hunt — 500-char label does not exceed hinted width', () => {
  const label = 'x'.repeat(500)
  const canvas = makeCanvas([makeButton(label)])
  const out = renderCanvasToTUI(canvas, { brand: false, width: 80 })
  // Should wrap or truncate — either way, no single line > 80.
  assert.ok(
    maxLineWidth(out) <= 80,
    `long label overflowed: max width ${maxLineWidth(out)}`,
  )
})

// ── 9. Piano-roll with 300 steps in 80-col terminal ─────────────────

test('hunt — piano-roll with steps=300 fits in width=80', () => {
  const canvas = makeCanvas([makePianoRoll({ steps: 300 })])
  const out = renderCanvasToTUI(canvas, { brand: false, width: 80 })
  assert.ok(
    maxLineWidth(out) <= 80,
    `piano-roll steps=300 overflows width=80: got ${maxLineWidth(out)}`,
  )
})

// The single-step case is the safe reference — passes today.
test('hunt — piano-roll with steps=8 fits comfortably', () => {
  const canvas = makeCanvas([makePianoRoll({ steps: 8 })])
  const out = renderCanvasToTUI(canvas, { brand: false })
  assert.ok(out.includes('piano-roll'))
})

// ── 10. 32×32 sprite-grid in 80-col terminal ────────────────────────

test('hunt — 32x32 sprite-grid fits within width=80', () => {
  const canvas = makeCanvas([makeSpriteGrid({ w: 32, h: 32 })])
  const out = renderCanvasToTUI(canvas, { brand: false, width: 80 })
  // 32 chars + 2-space indent = 34, fine at 80; but a 64x64 would overflow.
  // Real test: 128×128 chestnut.
  const canvas128 = makeCanvas([makeSpriteGrid({ w: 128, h: 32 })])
  const out128 = renderCanvasToTUI(canvas128, { brand: false, width: 80 })
  assert.ok(
    maxLineWidth(out128) <= 80,
    `128-wide sprite-grid overflows width=80: got ${maxLineWidth(out128)}`,
  )
  assert.ok(out.includes('sprite:'))
})

// ── 11. ANSI escape injection in :label ─────────────────────────────

test('hunt — SECURITY: ANSI escape in label must not execute at terminal', () => {
  // A malicious cart could set a widget label containing a raw escape.
  // The renderer must escape or strip it — otherwise a shared REPL
  // session could re-color other users' output, hide text, or in
  // pathological cases exploit terminal-specific sequences (e.g. iTerm2
  // filesystem-title sequences, xterm OSC 52 clipboard set).
  const evilLabel = '\x1b[31mRED\x1b[0m'
  const canvas = makeCanvas([makeButton(evilLabel)])
  const out = renderCanvasToTUI(canvas, { brand: false })
  // Two acceptable outcomes: (a) escape stripped, (b) escape shown as
  // literal text like "\x1b[31m". UNACCEPTABLE: raw escape in output.
  const hasRawEscape = out.includes('\x1b[31m')
  assert.equal(
    hasRawEscape,
    false,
    'ANSI escape from user label passed through to terminal — injection risk',
  )
})

test('hunt — SECURITY: OSC 8 hyperlink escape in label neutralized', () => {
  // OSC 8 is more dangerous — it can make labels click to arbitrary URLs.
  const evilLabel = '\x1b]8;;https://evil.example.com/\x07click me\x1b]8;;\x07'
  const canvas = makeCanvas([makeButton(evilLabel)])
  const out = renderCanvasToTUI(canvas, { brand: false })
  assert.equal(
    out.includes('\x1b]8'),
    false,
    'OSC 8 hyperlink escape from user label passed through',
  )
})

test('hunt — SECURITY: text-field value with raw escape neutralized', () => {
  const canvas = makeCanvas([makeTextField({ value: '\x1b[2J' })]) // clear screen
  const out = renderCanvasToTUI(canvas, { brand: false })
  assert.equal(
    out.includes('\x1b[2J'),
    false,
    'clear-screen escape survived through text-field value',
  )
})

// ── 12. SIGWINCH mid-render ────────────────────────────────────────

test('hunt — repeated renders are stable across simulated resize', async () => {
  // The renderer is pure, so a real SIGWINCH can't corrupt it — but a
  // caller that reads process.stdout.columns between lines would.
  // Simulate: render twice under different width hints, both should be
  // stable strings (no shared mutable state leaks).
  const canvas = makeCanvas([makeSlider({ label: 'A', value: 0.5 })])
  const a1 = renderCanvasToTUI(canvas, { brand: false, width: 40 })
  const a2 = renderCanvasToTUI(canvas, { brand: false, width: 40 })
  assert.equal(a1, a2, 'render is not deterministic')
  const b = renderCanvasToTUI(canvas, { brand: false, width: 80 })
  const a3 = renderCanvasToTUI(canvas, { brand: false, width: 40 })
  assert.equal(a1, a3, 'render was contaminated by a prior wider render')
  assert.notEqual(a1, b, 'width hint had no effect')
})

// ── 13. brand stripes should respect width hint ─────────────────────

test('hunt — brand stripes shrink to terminal width', () => {
  const canvas = makeCanvas([makeButton('go')])
  const out = renderCanvasToTUI(canvas, { width: 20 })
  assert.ok(
    maxLineWidth(out) <= 20,
    `brand stripes fixed at 40 cols regardless of width — got ${maxLineWidth(out)}`,
  )
})

// ── 14. TUI_ANSI is exported and internally consistent ──────────────

test('hunt — TUI_ANSI.fg returns a known-good escape for named colors', () => {
  const s = TUI_ANSI.fg('red')
  assert.match(s, /^\x1b\[3\dm$/, 'fg("red") did not return ANSI SGR')
})

test('hunt — TUI_ANSI.fg falls back safely for unknown color', () => {
  // Current code uses `?? 37` — should not throw and should return a valid SGR.
  const s = TUI_ANSI.fg('not-a-color')
  assert.match(s, /^\x1b\[\d+m$/, 'fg fallback malformed')
})
