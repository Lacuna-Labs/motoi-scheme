// tui/tui.js — Motoi Scheme Terminal IDE.
//
// Provenance: 2026-07-19 (Marcus, TUI wave). Alfred: "Can I have the
// same thing on the TUI also? And!! Use Sakura's color palette. So
// it's all soft colors. Use it for our colors."
//
// Layout (4 regions):
//   ┌─ File  Settings  Help ───────────────────────────┐  ← menu bar
//   │ ┌── PROJECT ──┐ ┌── EDITOR ──────────────────┐  │
//   │ │ tree        │ │ tabs • buffer              │  │
//   │ └─────────────┘ └────────────────────────────┘  │
//   │ ┌── REPL ────────────────────────────────────┐  │
//   │ │ motoi>                                     │  │
//   │ └────────────────────────────────────────────┘  │
//   └──────────────────────────────────────────────────┘
//
// Same feature set as the web IDE:
//   * File tree — books (from book/list) + chapters + a "buffers" node.
//   * Tabbed editor with basic / vim / emacs modes; :w :q :explain etc.
//   * REPL where you talk to Motoi.
//   * CPU panel toggle (F4).
//   * Motoi meta-awareness (F2 explain selection, ambient completions).
//
// Sakura palette (cream · pink · lilac · magic).
// Zero external deps — plain ANSI + node:process + node:tty.

import { Screen, ATTR } from './screen.js'
import { InputReader } from './input.js'
import { Session } from './session.js'
import { activeTheme } from './themes.js'
import { SAKURA } from './palette.js'

// ── the whole application state ────────────────────────────────────

const state = {
  screen: null,
  input: null,
  session: null,
  // Layout metrics — recomputed each paint.
  layout: {},
  // File tree
  books: [],
  bookTocs: {},       // slug → [title, …]
  bookExpanded: {},   // slug → bool (chapters shown?)
  treeIndex: 0,       // which flattened tree row has focus
  treeScroll: 0,
  treeRows: [],       // flattened list of {kind, label, book?, chapter?}
  // Tabs
  tabs: [],           // [{ id, kind, title, content, cursor, scroll,
                      //    book?, chapter?, chapterData? }]
  activeTabId: null,
  nextTabId: 1,
  // REPL
  replLog: [],        // [{kind, text}]  where kind ∈ 'in'|'out'|'err'|'stdout'
  replInput: '',
  replCursor: 0,
  replHistory: [],
  replHistIdx: -1,
  replScroll: 0,
  // Modes
  focus: 'editor',    // 'tree' | 'editor' | 'repl'
  editorMode: 'basic',// 'basic' | 'vim' | 'emacs'
  vimMode: 'insert',  // 'insert' | 'normal' | 'command'
  vimCmd: '',
  pairMode: 'off',
  cpuOpen: false,
  cpuText: '',
  // Fantasy console canvas panel — 80×80 framebuffer via half-block
  // characters (`▀` — 2 pixels per cell vertically). Toggle with F3
  // or Alt-C. When on, the editor width halves.
  canvasOpen: false,
  canvasTimer: null,       // polling timer id
  canvasEncoding: 'half',  // 'half' | 'braille' — half is retro-console;
                           //                       braille is quarter-res fallback.
  canvasLastFrame: -1,     // last fb.frame we rendered; skip re-paint if unchanged
  // Stack panel — live call frames from motoi/stack.
  stackOpen: false,
  stackTimer: null,
  stackFrames: [],
  stackPeak: 0,
  // Inline "run in box" — output card painted directly below the form.
  // { tabId, line, endLine, stdout, value, error, scroll } | null.
  runCard: null,
  // Running vs idle — for canvas throttle + mode pill.
  runningMode: 'idle',     // 'idle' | 'running'
  runningUntil: 0,         // set to now + N ms when we know we're running
  // Menu bar
  menuOpen: null,     // null | 'File' | 'Tab' | 'Settings' | 'Help'
  menuItemIdx: 0,
  // Ambient completion ghost
  ghost: null,        // { text, prefix, cursor } — showing at active tab
  ambientTimer: null,
  // Toast / status line
  status: '',
  statusUntil: 0,
  // Tick counter for cursor blink animation + spinner
  ticks: 0,
  blinkTimer: null,
  // Exit flag
  running: true,
}

// Spinner glyphs — a single braille char cycling through 8 phases.
// Zero deps, looks clean on any modern terminal.
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠏']

// ── SPLASH (Wave 4 · Deliverable 1) ────────────────────────────────
//
// A retro boot sequence: cherry-tree ASCII, wordmark, three stripes
// with a typing animation, blinking cursor, 660/880 Hz chime through
// the deterministic runtime `tone` verb. Auto-dismisses after 4s or
// on any keypress. Skipped on subsequent boots via ~/.motoi/state.slat
// unless opts.splash is truthy.

const SPLASH_STATE_FILE = '.motoi/state.slat'

async function maybeShowSplash(opts) {
  // Test seams — never paint splash in a mock/noSignals context.
  if (opts.noSignals || opts.noBlink) return
  if (opts.stdout && opts.stdout !== process.stdout) return

  // Have we shown splash before?
  const { readFileSync, writeFileSync, mkdirSync } = await import('node:fs')
  const { join } = await import('node:path')
  const { homedir } = await import('node:os')
  const statePath = join(homedir(), SPLASH_STATE_FILE)
  let seen = false
  try {
    const raw = readFileSync(statePath, 'utf8')
    seen = raw.includes(':splash-seen #t')
  } catch { /* no state file yet */ }
  if (seen && !opts.splash) return

  const out = opts.stdout || process.stdout
  const clear = '\x1b[2J\x1b[H'
  const ansi = (code) => '\x1b[' + code
  const reset  = ansi('0m')
  const bold   = ansi('1m')
  const dim    = ansi('2m')

  // Resolve splash colors from the active theme. Every splash element
  // (tree, leaves, trunk, title, hint, blossom) has a role; the theme
  // decides which RGB paints it. Under Sakura → pink/mint/cedar; under
  // Hacker → phosphor greens.
  const theme = opts.theme || activeTheme(opts)
  const rgbFor = (role) => {
    // Chase role → color name → RGB. Fall back to SAKURA[name].
    let name = theme.roles[role] || role
    if (theme.colors && theme.colors[name]) return theme.colors[name]
    return SAKURA[name] || SAKURA.fg
  }
  const fg = (rgb) => ansi('38;2;' + rgb[0] + ';' + rgb[1] + ';' + rgb[2] + 'm')
  const trunkRgb  = rgbFor('splashTrunk')
  const leafRgb   = rgbFor('splashLeaves')
  const treeRgb   = rgbFor('splashTree')
  const titleRgb  = rgbFor('splashTitle')
  const hintRgb   = rgbFor('splashHint')
  const blossomRgb = rgbFor('splashBlossom')

  const tree = [
    '        ' + fg(blossomRgb) + '*' + reset,
    '     ' + fg(blossomRgb) + '* * *' + reset,
    '   ' + fg(blossomRgb) + '* * * * *' + reset,
    '     ' + fg(leafRgb) + '| |' + reset,
    '     ' + fg(trunkRgb) + '| |' + reset,
  ]

  const title = bold + fg(titleRgb) +
    'M O T O I   S C H E M E   ·   v0.75   ·   FANTASY CONSOLE' + reset

  out.write(clear)
  // Center the tree roughly
  const cols = process.stdout.columns || 80
  const centerRow = 4
  tree.forEach((line, i) => {
    out.write(ansi(`${centerRow + i};1H`))
    out.write(' '.repeat(Math.max(0, Math.floor((cols - 16) / 2))))
    out.write(line)
  })
  out.write(ansi(`${centerRow + tree.length + 2};1H`))
  out.write(' '.repeat(Math.max(0, Math.floor((cols - 40) / 2))))
  out.write(title)

  // Stripes — typing animation ~500ms total, 3 rows.
  const stripeWidth = Math.min(40, cols - 4)
  const stripeChars = ['█', '█', '█']
  const stripes = [fg(rgbFor('stripe1')), fg(rgbFor('stripe2')), fg(rgbFor('stripe3'))]
  const startRow = centerRow + tree.length + 4
  for (let step = 1; step <= 20; step++) {
    for (let s = 0; s < 3; s++) {
      out.write(ansi(`${startRow + s};1H`))
      out.write(' '.repeat(Math.max(0, Math.floor((cols - stripeWidth) / 2))))
      out.write(stripes[s] + stripeChars[s].repeat(Math.floor(stripeWidth * step / 20)) + reset)
    }
    await new Promise(r => setTimeout(r, 25))
  }

  out.write(ansi(`${startRow + 5};1H`))
  const prompt = 'PRESS ANY KEY / CLICK TO START'
  out.write(' '.repeat(Math.max(0, Math.floor((cols - prompt.length - 2) / 2))))
  out.write(fg(hintRgb) + prompt + reset + ' ' + bold + fg(titleRgb) + '_' + reset)

  // Chime — deterministic tones. Doctrine [[deterministic-audio-no-llm]].
  try {
    const { playTone } = await import('../lib/audio/audio-driver.js')
    playTone(660, 0.15).catch(() => {})
    setTimeout(() => playTone(880, 0.15).catch(() => {}), 200)
  } catch { /* soft-fail */ }

  // Wait for keypress or 4s.
  await new Promise((resolve) => {
    let done = false
    const finish = () => { if (done) return; done = true; resolve() }
    const stdin = opts.stdin || process.stdin
    const onKey = () => finish()
    try {
      if (stdin.isTTY) stdin.setRawMode(true)
      stdin.once('data', onKey)
    } catch { /* fallback to timeout */ }
    setTimeout(finish, 4000)
  })

  // Persist that splash has been seen.
  try {
    mkdirSync(join(homedir(), '.motoi'), { recursive: true })
    writeFileSync(statePath, ';; Motoi state\n(:splash-seen #t)\n', 'utf8')
  } catch { /* soft-fail */ }
  out.write(clear)
}

// ── main entry ─────────────────────────────────────────────────────

export async function startTui(opts = {}) {
  // Reset the module state singleton — supports multiple tui-boot cycles
  // in the same process (tests, session re-launch). Every mutable field
  // that startTui reads gets restored to its initial value.
  Object.assign(state, {
    screen: null, input: null, session: null,
    theme: null,
    layout: {},
    books: [], bookTocs: {}, bookExpanded: {},
    treeIndex: 0, treeScroll: 0, treeRows: [],
    tabs: [], activeTabId: null, nextTabId: 1,
    replLog: [], replInput: '', replCursor: 0,
    replHistory: [], replHistIdx: -1, replScroll: 0,
    focus: 'editor', editorMode: 'basic',
    vimMode: 'insert', vimCmd: '',
    pairMode: 'off',
    cpuOpen: false, cpuText: '',
    canvasOpen: false, canvasTimer: null, canvasEncoding: 'half', canvasLastFrame: -1,
    stackOpen: false, stackTimer: null, stackFrames: [], stackPeak: 0,
    runCard: null,
    runningMode: 'idle', runningUntil: 0,
    menuOpen: null, menuItemIdx: 0,
    ghost: null, ambientTimer: null,
    status: '', statusUntil: 0,
    ticks: 0, blinkTimer: null,
    running: true,
    _resolveExit: null,
  })

  // Resolve the active theme (opts.theme > MOTOI_THEME > opts.hacker > sakura).
  // Panel code paints role names ('pink', 'pearl', 'cedar', …) which
  // Screen resolves through the theme + palette module. If the theme
  // load fails, activeTheme returns the Sakura fallback shape.
  let theme
  try { theme = activeTheme(opts) } catch { theme = null }
  state.theme = theme

  state.screen = new Screen({
    out: opts.stdout || process.stdout,
    color: opts.color,
    theme,
  })
  state.input = new InputReader({ stdin: opts.stdin || process.stdin })
  state.session = new Session({ fuel: opts.fuel ?? 200000 })

  state.screen.enterAltScreen()

  // ── SPLASH (Wave 4 · Deliverable 1) ────────────────────────────
  //
  // Show the retro boot splash on first launch. Persisted to
  // ~/.motoi/state.slat. Auto-dismisses after 4s. Skipped on
  // subsequent boots unless opts.splash is truthy (motoi tui --splash).
  await maybeShowSplash({ ...opts, theme })

  state.books = state.session.bookList()
  if (state.books.includes('code')) {
    state.bookTocs.code = state.session.bookToc('code')
    state.bookExpanded.code = true
  }
  rebuildTreeRows()

  openScratchBuffer()

  appendRepl('out', 'Motoi Scheme TUI ready. Tab tabs the tabs; C-x C-c bows out.')
  appendRepl('out', 'F2 explains what\'s highlighted. F4 shows the CPU. F5 for pair mode.')

  state.input.onKey((key) => handleKey(key))
  state.input.start()

  // Blink cursor at 500ms. Only install when we own a real TTY — tests
  // pass their own mock stdout and don't want the interval fighting
  // node --test's watchdog for event-loop time.
  if (!opts.noBlink) {
    state.blinkTimer = setInterval(() => {
      state.ticks++
      render()
    }, 500)
    // Prevent the interval from keeping the process alive after tests.
    if (typeof state.blinkTimer.unref === 'function') state.blinkTimer.unref()
  }

  // Handle terminal resize + signals — real-process side effects only.
  if (!opts.noSignals) {
    if (opts.stdout && opts.stdout !== process.stdout) {
      // Mock stdout — no resize event to hook.
    } else {
      process.stdout.on('resize', () => render())
      process.on('SIGINT', () => shutdown())
    }
  }

  render()
  return new Promise((resolve) => {
    state._resolveExit = resolve
  })
}

// Test seam — tears down timers / listeners / alt-screen without
// calling process.exit(). Returns immediately once cleanup finishes.
export function _resetForTests() {
  if (state.blinkTimer)   { clearInterval(state.blinkTimer);  state.blinkTimer  = null }
  if (state.ambientTimer) { clearTimeout (state.ambientTimer); state.ambientTimer = null }
  if (state.canvasTimer)  { clearInterval(state.canvasTimer); state.canvasTimer = null }
  if (state.stackTimer)   { clearInterval(state.stackTimer);  state.stackTimer  = null }
  if (state.input) {
    try { state.input.stop() } catch { /* no-op */ }
  }
  if (state.screen) {
    try { state.screen.leaveAltScreen() } catch { /* no-op */ }
  }
  state.running = false
  const resolve = state._resolveExit
  state._resolveExit = null
  if (resolve) resolve(0)
}

function shutdown() {
  if (state.blinkTimer)   clearInterval(state.blinkTimer)
  if (state.ambientTimer) clearTimeout (state.ambientTimer)
  if (state.canvasTimer)  clearInterval(state.canvasTimer)
  if (state.stackTimer)   clearInterval(state.stackTimer)
  state.input.stop()
  state.screen.leaveAltScreen()
  state.running = false
  process.stdout.write('bye — thanks for pairing.\n')
  if (state._resolveExit) state._resolveExit(0)
  process.exit(0)
}

// ── tree ──────────────────────────────────────────────────────────

function rebuildTreeRows() {
  const rows = []
  rows.push({ kind: 'action', label: '+ new buffer' })
  rows.push({ kind: 'sep', label: '' })
  for (const slug of state.books) {
    const expanded = state.bookExpanded[slug]
    rows.push({ kind: 'book', label: (expanded ? '▾ ' : '▸ ') + slug, book: slug })
    if (expanded) {
      const toc = state.bookTocs[slug] || []
      toc.forEach((title, i) => {
        rows.push({
          kind: 'chapter',
          label: '  ' + String(i + 1).padStart(2, ' ') + ' ' + title,
          book: slug,
          chapter: i + 1,
        })
      })
    }
  }
  state.treeRows = rows
}

function activateTreeRow() {
  const row = state.treeRows[state.treeIndex]
  if (!row) return
  if (row.kind === 'action') { openScratchBuffer(); state.focus = 'editor'; return }
  if (row.kind === 'book') {
    state.bookExpanded[row.book] = !state.bookExpanded[row.book]
    if (state.bookExpanded[row.book] && !state.bookTocs[row.book]) {
      state.bookTocs[row.book] = state.session.bookToc(row.book)
    }
    rebuildTreeRows()
    return
  }
  if (row.kind === 'chapter') {
    openChapterTab(row.book, row.chapter)
    state.focus = 'editor'
    return
  }
}

// ── tabs ──────────────────────────────────────────────────────────

function openScratchBuffer(seed) {
  const n = state.tabs.filter((t) => t.kind === 'buffer').length + 1
  const tab = {
    id: state.nextTabId++,
    kind: 'buffer',
    title: 'buffer ' + n,
    content: seed || '; Motoi Scheme scratch buffer\n; C-x C-e (basic) / :w (vim) / M-x eval (emacs) to run.\n\n(+ 1 2)\n',
    cursor: 0,
    scroll: 0,
  }
  tab.cursor = tab.content.length
  state.tabs.push(tab)
  state.activeTabId = tab.id
}

function openChapterTab(book, chapter) {
  // If chapter tab already open, activate.
  const found = state.tabs.find((t) => t.kind === 'chapter'
                             && t.book === book && t.chapter === chapter)
  if (found) { state.activeTabId = found.id; return }
  const data = state.session.bookChapter(book, chapter)
  const tab = {
    id: state.nextTabId++,
    kind: 'chapter',
    title: book + ' · ch ' + chapter,
    book, chapter,
    chapterData: data,
    content: renderChapterAsText(data),
    cursor: 0,
    scroll: 0,
  }
  state.tabs.push(tab)
  state.activeTabId = tab.id
}

function openSettingsTab() {
  const found = state.tabs.find((t) => t.kind === 'settings')
  if (found) { state.activeTabId = found.id; return }
  const tab = {
    id: state.nextTabId++,
    kind: 'settings',
    title: 'settings',
    content: '',
    cursor: 0,
    scroll: 0,
  }
  state.tabs.push(tab)
  state.activeTabId = tab.id
}

function openHelpTab() {
  const found = state.tabs.find((t) => t.kind === 'help')
  if (found) { state.activeTabId = found.id; return }
  const tab = {
    id: state.nextTabId++,
    kind: 'help',
    title: 'help',
    content: HELP_TEXT,
    cursor: 0,
    scroll: 0,
  }
  state.tabs.push(tab)
  state.activeTabId = tab.id
}

function closeActiveTab() {
  const idx = state.tabs.findIndex((t) => t.id === state.activeTabId)
  if (idx < 0) return
  state.tabs.splice(idx, 1)
  state.activeTabId = state.tabs.length > 0
    ? state.tabs[Math.max(0, idx - 1)].id
    : null
}

function activeTab() {
  return state.tabs.find((t) => t.id === state.activeTabId) || null
}

function renderChapterAsText(data) {
  if (!data) return '(chapter unavailable)'
  if (data.error) return '(error: ' + data.error + ')'
  const lines = []
  if (data.title) lines.push('# ' + data.title, '')
  const sections = Array.isArray(data.sections) ? data.sections : []
  if (sections.length > 0) {
    for (const s of sections) {
      if (s.heading) lines.push('## ' + s.heading, '')
      if (s.body)    lines.push(String(s.body).trimEnd(), '')
    }
  } else if (data.prose) {
    lines.push(String(data.prose))
  }
  const cb = data.codeBlocks || data['code-blocks'] || []
  if (cb.length > 0) {
    lines.push('', '## Runnable Scheme')
    cb.forEach((src, i) => {
      lines.push('', '```scheme  ; block ' + (i + 1),
        String(src).trimEnd(), '```')
    })
  }
  return lines.join('\n')
}

// ── REPL log helpers ──────────────────────────────────────────────

function appendRepl(kind, text) {
  if (text == null) return
  const s = String(text)
  // Split multiline output into separate entries so the wrapping
  // renderer can style each line by kind.
  for (const line of s.split('\n')) {
    state.replLog.push({ kind, text: line })
  }
  // Cap the log so a runaway (loop) doesn't eat memory.
  if (state.replLog.length > 5000) {
    state.replLog.splice(0, state.replLog.length - 5000)
  }
  // Auto-scroll to bottom.
  state.replScroll = 0
}

function statusFlash(text, ms = 3000) {
  state.status = text
  state.statusUntil = Date.now() + ms
}

// ── running Scheme ─────────────────────────────────────────────────

function runSource(source) {
  const src = String(source || '').trim()
  if (!src) return
  appendRepl('in', src)
  const r = state.session.evalSource(src)
  if (r.stdout) appendRepl('stdout', r.stdout.replace(/\n$/, ''))
  if (r.ok) {
    if (r.value !== '' && r.value != null) appendMarkdownAwareOut(r.value)
  } else {
    appendRepl('err', 'error: ' + r.error)
  }
  if (state.cpuOpen) state.cpuText = state.session.cpuDisplay()
}

// If the returned value is a JSON-stringified string containing embedded
// newlines + markdown-shaped lines (`# ...`, `## ...`, ```` ``` ````), we
// unwrap it and drop each source-line into the REPL log as its own entry
// with markdown-ish styling. Everything else takes the plain path — this
// preserves list/number/etc. output.
function appendMarkdownAwareOut(value) {
  // `format()` wraps strings in JSON.stringify — so a returned prose
  // string looks like `"# Book…\n…"`. Unwrap when we see that shape.
  let unwrapped = value
  if (typeof value === 'string' && value.length >= 2
      && value.charCodeAt(0) === 34 /* " */ && value.charCodeAt(value.length - 1) === 34
      && value.indexOf('\\n') !== -1) {
    try { unwrapped = JSON.parse(value) } catch { /* leave as-is */ }
  }
  // Heuristic — only treat as markdown if it has both a newline and a
  // header/code-fence signal. Otherwise fall through so short results
  // (numbers, symbols, single-line strings) don't get chopped.
  const looksMarkdown = typeof unwrapped === 'string'
    && unwrapped.indexOf('\n') !== -1
    && (/(^|\n)#\s/.test(unwrapped) || /```/.test(unwrapped))
  if (!looksMarkdown) { appendRepl('out', value); return }
  let inFence = false
  for (const raw of unwrapped.split('\n')) {
    const line = raw.replace(/\s+$/, '')
    let style = { fg: 'fg', attr: 0 }
    if (line.startsWith('```')) { inFence = !inFence; style = { fg: 'mintDark', attr: ATTR.DIM } }
    else if (inFence)             style = { fg: 'cedarDark', attr: 0 }
    else if (/^###\s/.test(line)) style = { fg: 'mintDark', attr: ATTR.BOLD }
    else if (/^##\s/.test(line))  style = { fg: 'mintDark', attr: ATTR.BOLD }
    else if (/^#\s/.test(line))   style = { fg: 'pinkDark', attr: ATTR.BOLD }
    state.replLog.push({ kind: 'out', text: line, mdStyle: style })
  }
  if (state.replLog.length > 5000) state.replLog.splice(0, state.replLog.length - 5000)
  state.replScroll = 0
}

// ── enclosing-form heuristic (mirrors ide.js) ─────────────────────

function currentFormAt(text, pos) {
  let start = pos
  let depth = 0
  while (start > 0) {
    start--
    if (text[start] === ')') depth++
    else if (text[start] === '(') {
      if (depth === 0) break
      depth--
    }
  }
  let end = start
  depth = 0
  for (; end < text.length; end++) {
    if (text[end] === '(') depth++
    else if (text[end] === ')') {
      depth--
      if (depth === 0) { end++; break }
    }
  }
  const form = text.slice(start, end).trim()
  return form || text
}

function runFormAtCursor(tab) {
  const src = currentFormAt(tab.content, tab.cursor)
  runSource(src)
}

async function explainAtCursor(tab) {
  const src = currentFormAt(tab.content, tab.cursor)
  if (!src.trim()) { appendRepl('err', 'Nothing at the cursor to explain.'); return }
  state.session.highlight(src, 'F2 explain')
  const r = state.session.explain(src)
  if (r.ok && r.value) appendRepl('out', r.value.replace(/^"|"$/g, ''))
  else if (r.error)   appendRepl('err', 'explain error: ' + r.error)
}

// ── ambient completion (ghost text) ───────────────────────────────

function scheduleAmbient(tab) {
  if (state.pairMode === 'off') return
  if (state.ambientTimer) clearTimeout(state.ambientTimer)
  state.ambientTimer = setTimeout(() => {
    fireAmbient(tab)
  }, 3000)
}

function fireAmbient(tab) {
  const before = tab.content.slice(0, tab.cursor)
  const m = before.match(/([a-zA-Z0-9\-_/?!*+.<>=]+)$/)
  if (!m) return
  const prefix = m[1]
  if (prefix.length < 2) return
  const results = state.session.ambientComplete(prefix)
  if (!results || results.length === 0) return
  const first = results[0]
  if (!first.name || !first.name.startsWith(prefix) || first.name === prefix) return
  const suffix = first.name.slice(prefix.length)
  state.ghost = { text: suffix, prefix, cursor: tab.cursor, tabId: tab.id }
  render()
}

function acceptGhost() {
  const t = activeTab()
  if (!t || !state.ghost || state.ghost.tabId !== t.id) return
  t.content = t.content.slice(0, state.ghost.cursor)
    + state.ghost.text + t.content.slice(state.ghost.cursor)
  t.cursor = state.ghost.cursor + state.ghost.text.length
  dismissGhost()
}

function dismissGhost() {
  if (state.ghost) state.ghost = null
}

// ── pair mode ─────────────────────────────────────────────────────

function togglePairMode() {
  const cycle = ['off', 'user-drives', 'motoi-drives']
  const next = cycle[(cycle.indexOf(state.pairMode) + 1) % cycle.length]
  state.pairMode = next
  const r = state.session.setPairMode(next)
  if (r.value) appendRepl('out', r.value.replace(/^"|"$/g, ''))
  statusFlash('pair: ' + next)
}

// ── CPU panel ─────────────────────────────────────────────────────

function toggleCpu() {
  state.cpuOpen = !state.cpuOpen
  if (state.cpuOpen) state.cpuText = state.session.cpuDisplay()
}

// ── canvas panel (fantasy console) ────────────────────────────────
//
// Toggles the 80×80 framebuffer display. When on, we poll the fb at
// 100ms idle / 30ms while code is actively running. The paint layer
// samples the palette-indexed pixels down to the terminal cell grid
// via half-block characters (▀) — 2 pixels per cell vertically —
// giving a retro-console look on any modern terminal that can render
// truecolor. Narrower terminals silently drop to braille (⣿) — 8
// pixels per cell — which halves the visual fidelity but keeps the
// panel usable at 80-col shell widths.

function toggleCanvas() {
  state.canvasOpen = !state.canvasOpen
  if (state.canvasOpen) startCanvasPolling()
  else stopCanvasPolling()
}

function startCanvasPolling() {
  if (state.canvasTimer) return
  const tick = () => {
    // Throttle: fast (30ms) while running, slow (100ms) idle.
    const now = Date.now()
    if (state.runningUntil > now) state.runningMode = 'running'
    else state.runningMode = 'idle'
    // Only re-render if the fb changed OR the running-mode flipped OR
    // spinner needs to advance.
    render()
  }
  state.canvasTimer = setInterval(tick, 100)
  if (typeof state.canvasTimer.unref === 'function') state.canvasTimer.unref()
}

function stopCanvasPolling() {
  if (state.canvasTimer) { clearInterval(state.canvasTimer); state.canvasTimer = null }
}

// ── stack panel ───────────────────────────────────────────────────

function toggleStack() {
  state.stackOpen = !state.stackOpen
  if (state.stackOpen) startStackPolling()
  else stopStackPolling()
}

function startStackPolling() {
  if (state.stackTimer) return
  const tick = () => {
    state.stackFrames = state.session.stackFrames()
    // Also refresh peak by asking the session for the deeper snapshot.
    render()
  }
  // 10 fps live update.
  state.stackTimer = setInterval(tick, 100)
  if (typeof state.stackTimer.unref === 'function') state.stackTimer.unref()
}

function stopStackPolling() {
  if (state.stackTimer) { clearInterval(state.stackTimer); state.stackTimer = null }
}

// ── tab reorder / jump ────────────────────────────────────────────

function moveActiveTab(delta) {
  const idx = state.tabs.findIndex((t) => t.id === state.activeTabId)
  if (idx < 0) return
  const targetIdx = idx + delta
  if (targetIdx < 0 || targetIdx >= state.tabs.length) return
  const [tab] = state.tabs.splice(idx, 1)
  state.tabs.splice(targetIdx, 0, tab)
}

function jumpTab(delta) {
  const idx = state.tabs.findIndex((t) => t.id === state.activeTabId)
  if (idx < 0) return
  const n = state.tabs.length
  const target = ((idx + delta) % n + n) % n
  state.activeTabId = state.tabs[target].id
}

// ── inline run card ───────────────────────────────────────────────
//
// "Run in box" — instead of dumping output only to the REPL, paint a
// small card directly beneath the form. The REPL still receives the
// entry (it becomes the session ledger). Esc / Ctrl-D dismiss the card.

function runFormWithCard(tab) {
  const src = currentFormAt(tab.content, tab.cursor)
  if (!src.trim()) return
  const { line: formLine } = cursorLineCol(tab.content, tab.cursor)
  // Mark running mode so the canvas panel accelerates its poll.
  state.runningUntil = Date.now() + 1500
  state.runningMode = 'running'
  appendRepl('in', src)
  const r = state.session.evalSource(src)
  if (r.stdout) appendRepl('stdout', r.stdout.replace(/\n$/, ''))
  if (r.ok) {
    if (r.value !== '' && r.value != null) appendRepl('out', r.value)
  } else {
    appendRepl('err', 'error: ' + r.error)
  }
  if (state.cpuOpen) state.cpuText = state.session.cpuDisplay()
  // Attach card to the current tab.
  state.runCard = {
    tabId: tab.id,
    anchorLine: formLine,
    stdout: r.stdout || '',
    value:  r.ok ? (r.value || '') : '',
    error:  r.ok ? null : r.error,
    scroll: 0,
  }
}

// ── key dispatch ──────────────────────────────────────────────────

function handleKey(key) {
  // Global keys first.
  if (state.menuOpen) return handleMenuKey(key)
  if (key.name === 'C-c' || (key.ctrl && key.name === 'c')) return shutdown()

  // F-keys — global (any focus).
  if (key.name === 'F1') return openHelpTab()
  if (key.name === 'F2') {
    const t = activeTab()
    if (t && (t.kind === 'buffer' || t.kind === 'chapter')) explainAtCursor(t)
    return
  }
  if (key.name === 'F3') { toggleCanvas(); render(); return }
  if (key.name === 'F4') { toggleCpu(); render(); return }
  if (key.name === 'F5') { togglePairMode(); render(); return }
  if (key.name === 'F6') {
    // Cycle focus. When canvas or stack panels are open, they get a
    // slot in the rotation — but only visible-slot focus is honored;
    // the actual key routing stays in tree/editor/repl since neither
    // canvas nor stack take text input.
    const cycle = ['tree', 'editor', 'repl']
    if (state.canvasOpen && state.layout && state.layout.canvasW > 0) cycle.push('canvas')
    if (state.stackOpen  && state.layout && state.layout.stackW  > 0) cycle.push('stack')
    state.focus = cycle[(cycle.indexOf(state.focus) + 1) % cycle.length]
    render()
    return
  }
  if (key.name === 'F7') { toggleStack(); render(); return }
  if (key.name === 'F8') {
    const t = activeTab()
    if (t && (t.kind === 'buffer' || t.kind === 'chapter')) { runFormWithCard(t); render() }
    return
  }
  if (key.name === 'F10') {
    // Open File menu.
    state.menuOpen = 'File'
    state.menuItemIdx = 0
    render()
    return
  }

  // Alt+<char> menu accelerators (mirrors classic TUI convention).
  if (key.alt && key.name === 'f') { state.menuOpen = 'File'; state.menuItemIdx = 0; render(); return }
  if (key.alt && key.name === 't') { state.menuOpen = 'Tab'; state.menuItemIdx = 0; render(); return }
  if (key.alt && key.name === 's') { state.menuOpen = 'Settings'; state.menuItemIdx = 0; render(); return }
  if (key.alt && key.name === 'h') { state.menuOpen = 'Help'; state.menuItemIdx = 0; render(); return }
  if (key.alt && key.name === 'c') { toggleCanvas(); render(); return }
  if (key.alt && key.name === 'k') { toggleStack(); render(); return }

  // Tab reordering + jump (2026-07-19). Ctrl+Shift+Left/Right slides the
  // active tab within the bar; Ctrl+PgUp/PgDn jumps to prev/next tab.
  if (key.name === 'left'  && key.ctrl && key.shift) { moveActiveTab(-1); render(); return }
  if (key.name === 'right' && key.ctrl && key.shift) { moveActiveTab(+1); render(); return }
  if (key.name === 'pgup'  && key.ctrl) { jumpTab(-1); render(); return }
  if (key.name === 'pgdn'  && key.ctrl) { jumpTab(+1); render(); return }
  if (key.name === 'pgup'  && key.shift) { jumpTab(-1); render(); return }   // fallback for terms that swallow ctrl
  if (key.name === 'pgdn'  && key.shift) { jumpTab(+1); render(); return }

  // Esc dismisses the inline output card, ghost, or (nothing).
  if (key.name === 'escape') {
    if (state.runCard) { state.runCard = null; render(); return }
    if (state.ghost)   { dismissGhost(); render(); return }
  }
  if (key.name === 'C-d' && state.runCard) { state.runCard = null; render(); return }

  // Tab cycles focus.
  if (key.name === 'tab' && !key.shift) {
    // Ghost-accept has priority in editor.
    if (state.focus === 'editor' && state.ghost) { acceptGhost(); render(); return }
    const cycle = ['tree', 'editor', 'repl']
    if (state.canvasOpen && state.layout && state.layout.canvasW > 0) cycle.push('canvas')
    if (state.stackOpen  && state.layout && state.layout.stackW  > 0) cycle.push('stack')
    state.focus = cycle[(cycle.indexOf(state.focus) + 1) % cycle.length]
    render()
    return
  }

  // Route by focus.
  if (state.focus === 'tree')   return handleTreeKey(key)
  if (state.focus === 'repl')   return handleReplKey(key)
  if (state.focus === 'canvas' || state.focus === 'stack') {
    // Canvas/stack panels are read-only surfaces. Everything but Tab
    // (already handled) is a no-op — this keeps stray keystrokes from
    // leaking into the editor buffer.
    return
  }
  return handleEditorKey(key)
}

// ── tree focus ────────────────────────────────────────────────────

function handleTreeKey(key) {
  if (key.name === 'up') {
    do { state.treeIndex = Math.max(0, state.treeIndex - 1) }
    while (state.treeRows[state.treeIndex] && state.treeRows[state.treeIndex].kind === 'sep')
    render(); return
  }
  if (key.name === 'down') {
    do { state.treeIndex = Math.min(state.treeRows.length - 1, state.treeIndex + 1) }
    while (state.treeRows[state.treeIndex] && state.treeRows[state.treeIndex].kind === 'sep')
    render(); return
  }
  if (key.name === 'enter' || key.name === 'right' || key.name === ' ') {
    activateTreeRow(); render(); return
  }
  if (key.name === 'left') { state.focus = 'editor'; render(); return }
}

// ── repl focus ────────────────────────────────────────────────────

function handleReplKey(key) {
  // Repl history nav.
  if (key.name === 'up') {
    if (state.replHistory.length === 0) return
    if (state.replHistIdx === -1) state.replHistIdx = state.replHistory.length - 1
    else state.replHistIdx = Math.max(0, state.replHistIdx - 1)
    state.replInput = state.replHistory[state.replHistIdx] || ''
    state.replCursor = state.replInput.length
    render(); return
  }
  if (key.name === 'down') {
    if (state.replHistIdx === -1) return
    state.replHistIdx = Math.min(state.replHistory.length, state.replHistIdx + 1)
    state.replInput = state.replHistory[state.replHistIdx] || ''
    state.replCursor = state.replInput.length
    render(); return
  }
  if (key.name === 'left') {
    state.replCursor = Math.max(0, state.replCursor - 1); render(); return
  }
  if (key.name === 'right') {
    state.replCursor = Math.min(state.replInput.length, state.replCursor + 1); render(); return
  }
  if (key.name === 'home') { state.replCursor = 0; render(); return }
  if (key.name === 'end') { state.replCursor = state.replInput.length; render(); return }
  if (key.name === 'backspace') {
    if (state.replCursor > 0) {
      state.replInput = state.replInput.slice(0, state.replCursor - 1)
        + state.replInput.slice(state.replCursor)
      state.replCursor--
    }
    render(); return
  }
  if (key.name === 'delete') {
    state.replInput = state.replInput.slice(0, state.replCursor)
      + state.replInput.slice(state.replCursor + 1)
    render(); return
  }
  if (key.name === 'enter') {
    const src = state.replInput
    state.replInput = ''
    state.replCursor = 0
    state.replHistIdx = -1
    if (src.trim()) {
      state.replHistory.push(src)
      // Meta-command support.
      if (src.startsWith(',')) {
        runMetaCommand(src)
      } else {
        runSource(src)
      }
    }
    render(); return
  }
  if (key.name === 'C-l') { state.replLog = []; render(); return }
  if (key.name === 'C-k') {
    state.replInput = state.replInput.slice(0, state.replCursor)
    render(); return
  }
  if (key.name === 'C-a') { state.replCursor = 0; render(); return }
  if (key.name === 'C-e') { state.replCursor = state.replInput.length; render(); return }
  if (key.name === 'pgup') {
    state.replScroll = Math.min(state.replLog.length, state.replScroll + 10); render(); return
  }
  if (key.name === 'pgdn') {
    state.replScroll = Math.max(0, state.replScroll - 10); render(); return
  }
  // Printable insertion.
  if (isPrintable(key)) {
    state.replInput = state.replInput.slice(0, state.replCursor)
      + key.name + state.replInput.slice(state.replCursor)
    state.replCursor += key.name.length
    render(); return
  }
}

function runMetaCommand(src) {
  const t = src.trim()
  if (t === ',help' || t === ',h') {
    appendRepl('out', HELP_TEXT.split('\n').slice(0, 20).join('\n'))
    return
  }
  if (t === ',exit' || t === ',quit' || t === ',q') return shutdown()
  if (t === ',clear' || t === ',cls') { state.replLog = []; return }
  if (t.startsWith(',cpu')) { toggleCpu(); return }
  if (t.startsWith(',pair')) { togglePairMode(); return }
  // ,book <slug> <n> — fetch a chapter + render it clean in the REPL.
  // Same output shape as `(book/read :book 'slug :chapter n)` but goes
  // through appendMarkdownAwareOut directly, so it's always formatted
  // (no dependence on the eval's return-value passthrough).
  const bookMatch = t.match(/^,book\s+(\S+)(?:\s+(\d+))?$/)
  if (bookMatch) {
    const slug = bookMatch[1]
    const n = bookMatch[2] ? Number(bookMatch[2]) : null
    const src = n != null
      ? `(book/read :book (quote ${slug}) :chapter ${n})`
      : `(book/read :book (quote ${slug}))`
    appendRepl('in', src)
    const r = state.session.evalSource(src)
    if (r.stdout) appendRepl('stdout', r.stdout.replace(/\n$/, ''))
    if (r.ok) { if (r.value !== '' && r.value != null) appendMarkdownAwareOut(r.value) }
    else appendRepl('err', 'error: ' + r.error)
    return
  }
  // Fallback: pass through to eval — the REPL side handles ,help ,type
  // etc via the src/repl.js dispatch table, but we don't own that
  // machinery here; just tell the user.
  appendRepl('err', 'unknown TUI meta-command: ' + t + ' (try F1 for help)')
}

// ── editor focus ──────────────────────────────────────────────────

function handleEditorKey(key) {
  const t = activeTab()
  if (!t) return

  // Global tab management first (regardless of mode).
  if (key.ctrl && key.name === 'C-w') { closeActiveTab(); render(); return }
  if (key.ctrl && (key.name === 'C-t' || key.name === 't')) {
    openScratchBuffer(); render(); return
  }
  // Cmd/Ctrl+Enter to run the enclosing form.
  if (key.name === 'enter' && (key.ctrl || key.alt)) {
    if (t.kind === 'buffer' || t.kind === 'chapter') runFormAtCursor(t)
    return
  }

  // Vim mode dispatch.
  if (state.editorMode === 'vim') {
    if (state.vimMode === 'command') return handleVimCommand(key)
    if (state.vimMode === 'normal')  return handleVimNormal(key)
    // else insert mode falls through to basic handling
  }

  // Emacs bindings (compose with basic).
  if (state.editorMode === 'emacs') {
    if (key.name === 'C-x') { state.vimCmd = 'C-x'; return }   // reuse vimCmd as prefix
    if (state.vimCmd === 'C-x') {
      state.vimCmd = ''
      if (key.name === 'C-s') { statusFlash('saved (in-session).'); render(); return }
      if (key.name === 'C-c') return shutdown()
      if (key.name === 'C-e') { if (t.kind === 'buffer' || t.kind === 'chapter') runFormAtCursor(t); return }
      statusFlash('C-x ' + key.name + ' — no binding'); render(); return
    }
    if (key.alt && key.name === 'e') { explainAtCursor(t); return }
    if (key.alt && key.name === 'x') {
      // M-x: eval current form.
      if (t.kind === 'buffer' || t.kind === 'chapter') runFormAtCursor(t)
      return
    }
  }

  // Basic-mode + insert-mode shared cursor movement + text editing.
  return handleBasicEditor(key, t)
}

function handleBasicEditor(key, t) {
  // Read-only tabs (chapter, help) — allow movement but no edits.
  const readonly = t.kind !== 'buffer'

  if (key.name === 'up' || key.name === 'down'
      || key.name === 'left' || key.name === 'right'
      || key.name === 'home' || key.name === 'end'
      || key.name === 'pgup' || key.name === 'pgdn') {
    moveCursor(t, key.name)
    render(); return
  }
  if (key.name === 'backspace' && !readonly) {
    if (t.cursor > 0) {
      t.content = t.content.slice(0, t.cursor - 1) + t.content.slice(t.cursor)
      t.cursor--
      dismissGhost()
      scheduleAmbient(t)
    }
    render(); return
  }
  if (key.name === 'delete' && !readonly) {
    t.content = t.content.slice(0, t.cursor) + t.content.slice(t.cursor + 1)
    render(); return
  }
  if (key.name === 'enter' && !readonly) {
    t.content = t.content.slice(0, t.cursor) + '\n' + t.content.slice(t.cursor)
    t.cursor++
    dismissGhost()
    render(); return
  }
  if (key.name === 'F2') { explainAtCursor(t); return }

  // Vim `:` in insert mode? Actually vim insert-mode passes `:` as
  // normal text — leave that to normal-mode. Basic mode allows `:` as text.

  if (isPrintable(key) && !readonly) {
    t.content = t.content.slice(0, t.cursor) + key.name + t.content.slice(t.cursor)
    t.cursor += key.name.length
    dismissGhost()
    scheduleAmbient(t)
    render(); return
  }
}

function moveCursor(t, dir) {
  const lines = t.content.split('\n')
  const { line, col } = cursorLineCol(t.content, t.cursor)
  if (dir === 'left')  { if (t.cursor > 0) t.cursor-- ; return }
  if (dir === 'right') { if (t.cursor < t.content.length) t.cursor++ ; return }
  if (dir === 'up' || dir === 'down') {
    const targetLine = dir === 'up' ? Math.max(0, line - 1) : Math.min(lines.length - 1, line + 1)
    if (targetLine === line) return
    const targetCol = Math.min(col, lines[targetLine].length)
    t.cursor = lineColToPos(lines, targetLine, targetCol)
    return
  }
  if (dir === 'home') { t.cursor = lineColToPos(lines, line, 0); return }
  if (dir === 'end')  { t.cursor = lineColToPos(lines, line, lines[line].length); return }
  if (dir === 'pgup') {
    const target = Math.max(0, line - 10)
    t.cursor = lineColToPos(lines, target, Math.min(col, lines[target].length))
    return
  }
  if (dir === 'pgdn') {
    const target = Math.min(lines.length - 1, line + 10)
    t.cursor = lineColToPos(lines, target, Math.min(col, lines[target].length))
    return
  }
}

function cursorLineCol(content, pos) {
  const lines = content.slice(0, pos).split('\n')
  return { line: lines.length - 1, col: lines[lines.length - 1].length }
}

function lineColToPos(lines, line, col) {
  let pos = 0
  for (let i = 0; i < line; i++) pos += lines[i].length + 1
  pos += col
  return pos
}

// ── vim ──────────────────────────────────────────────────────────

function handleVimNormal(key) {
  const t = activeTab()
  if (!t) return
  if (key.name === 'i') { state.vimMode = 'insert'; render(); return }
  if (key.name === 'a') {
    if (t.cursor < t.content.length) t.cursor++
    state.vimMode = 'insert'; render(); return
  }
  if (key.name === 'o') {
    const { line } = cursorLineCol(t.content, t.cursor)
    const lines = t.content.split('\n')
    t.cursor = lineColToPos(lines, line, lines[line].length)
    t.content = t.content.slice(0, t.cursor) + '\n' + t.content.slice(t.cursor)
    t.cursor++
    state.vimMode = 'insert'; render(); return
  }
  if (key.name === ':') {
    state.vimMode = 'command'; state.vimCmd = ''; render(); return
  }
  if (key.name === 'h') { moveCursor(t, 'left'); render(); return }
  if (key.name === 'l') { moveCursor(t, 'right'); render(); return }
  if (key.name === 'j') { moveCursor(t, 'down'); render(); return }
  if (key.name === 'k') { moveCursor(t, 'up'); render(); return }
  if (key.name === '0') { moveCursor(t, 'home'); render(); return }
  if (key.name === '$') { moveCursor(t, 'end'); render(); return }
  if (key.name === 'x' && t.kind === 'buffer') {
    t.content = t.content.slice(0, t.cursor) + t.content.slice(t.cursor + 1)
    render(); return
  }
  // Fall through to basic movement for arrow keys.
  return handleBasicEditor(key, t)
}

function handleVimCommand(key) {
  if (key.name === 'escape') {
    state.vimMode = 'normal'; state.vimCmd = ''; render(); return
  }
  if (key.name === 'enter') {
    const cmd = state.vimCmd.trim()
    state.vimCmd = ''; state.vimMode = 'normal'
    const t = activeTab()
    if (cmd === 'w') { statusFlash('saved (in-session only).') }
    else if (cmd === 'q' || cmd === 'q!') { closeActiveTab() }
    else if (cmd === 'wq' || cmd === 'x') { closeActiveTab() }
    else if (cmd === 'explain' && t) { explainAtCursor(t) }
    else if (cmd === 'pair-on')  { state.pairMode = 'user-drives'; state.session.setPairMode('user-drives'); statusFlash('pair: user-drives') }
    else if (cmd === 'pair-off') { state.pairMode = 'off'; state.session.setPairMode('off'); statusFlash('pair: off') }
    else if (cmd === 'cpu') { toggleCpu() }
    else if (cmd === 'help') { openHelpTab() }
    else if (cmd === 'settings') { openSettingsTab() }
    else if (cmd) { appendRepl('err', 'unknown :' + cmd) }
    render(); return
  }
  if (key.name === 'backspace') {
    state.vimCmd = state.vimCmd.slice(0, -1); render(); return
  }
  if (isPrintable(key)) {
    state.vimCmd += key.name; render(); return
  }
}

// ── menu ──────────────────────────────────────────────────────────

const MENUS = {
  File: [
    { label: 'New Buffer',    run: () => openScratchBuffer() },
    { label: 'Close Tab',     run: () => closeActiveTab() },
    { label: 'Exit',          run: () => shutdown() },
  ],
  Tab: [
    { label: 'Rename Tab',    run: () => promptRenameTab() },
    { label: 'Move Left',     run: () => moveActiveTab(-1) },
    { label: 'Move Right',    run: () => moveActiveTab(+1) },
    { label: 'Close Tab',     run: () => closeActiveTab() },
    { label: 'Close Others',  run: () => closeOtherTabs() },
    { label: 'Close All',     run: () => closeAllTabs() },
  ],
  Settings: [
    { label: 'Basic editor',  run: () => { state.editorMode = 'basic'; statusFlash('editor: basic') } },
    { label: 'Vim editor',    run: () => { state.editorMode = 'vim'; state.vimMode = 'normal'; statusFlash('editor: vim (normal)') } },
    { label: 'Emacs editor',  run: () => { state.editorMode = 'emacs'; statusFlash('editor: emacs') } },
    { label: 'Pair: off',            run: () => { state.pairMode = 'off'; state.session.setPairMode('off') } },
    { label: 'Pair: user-drives',    run: () => { state.pairMode = 'user-drives'; state.session.setPairMode('user-drives') } },
    { label: 'Pair: motoi-drives',   run: () => { state.pairMode = 'motoi-drives'; state.session.setPairMode('motoi-drives') } },
    { label: 'Toggle Canvas panel',  run: () => toggleCanvas() },
    { label: 'Toggle CPU panel',     run: () => toggleCpu() },
    { label: 'Toggle Stack panel',   run: () => toggleStack() },
    { label: 'Open Settings tab',    run: () => openSettingsTab() },
  ],
  Help: [
    { label: 'Keys + Commands',   run: () => openHelpTab() },
    { label: 'About',             run: () => appendRepl('out', 'Motoi Scheme TUI — same runtime as the browser IDE, softer light.') },
  ],
}

function closeOtherTabs() {
  const kept = state.tabs.find((t) => t.id === state.activeTabId)
  if (!kept) return
  state.tabs = [kept]
}

function closeAllTabs() {
  state.tabs = []
  state.activeTabId = null
}

// Non-modal rename — flashes a status hint; actual rename is a follow-up.
// For 0.75 we just cycle titles between the tab's default and a numbered
// alt; a real prompt-line comes later.
function promptRenameTab() {
  const t = activeTab()
  if (!t) return
  if (t.kind !== 'buffer') { statusFlash("can't rename chapter/help tabs"); return }
  // Cycle "buffer N" ↔ "scratch" as a lightweight sentinel — a proper
  // prompt-line follows in Marcus's TUI wave 2.
  t.title = t.title.startsWith('buffer ') ? 'scratch' : ('buffer ' + t.id)
  statusFlash('renamed to ' + t.title)
}

function handleMenuKey(key) {
  const items = MENUS[state.menuOpen] || []
  if (key.name === 'escape') { state.menuOpen = null; render(); return }
  if (key.name === 'up') { state.menuItemIdx = Math.max(0, state.menuItemIdx - 1); render(); return }
  if (key.name === 'down') { state.menuItemIdx = Math.min(items.length - 1, state.menuItemIdx + 1); render(); return }
  if (key.name === 'left') {
    const order = ['File', 'Tab', 'Settings', 'Help']
    state.menuOpen = order[(order.indexOf(state.menuOpen) - 1 + order.length) % order.length]
    state.menuItemIdx = 0; render(); return
  }
  if (key.name === 'right') {
    const order = ['File', 'Tab', 'Settings', 'Help']
    state.menuOpen = order[(order.indexOf(state.menuOpen) + 1) % order.length]
    state.menuItemIdx = 0; render(); return
  }
  if (key.name === 'enter') {
    const it = items[state.menuItemIdx]
    state.menuOpen = null
    if (it && it.run) it.run()
    render(); return
  }
}

// ── input helpers ─────────────────────────────────────────────────

function isPrintable(key) {
  if (key.ctrl || key.alt) return false
  return typeof key.name === 'string' && key.name.length === 1
      && key.name >= ' ' && key.name.charCodeAt(0) < 127
}

// ── layout + paint ────────────────────────────────────────────────

function computeLayout() {
  const scr = state.screen
  const W = scr.cols
  const H = scr.rows
  // 1 row stripes at top, 1 row menu, 1 row status at bottom.
  const stripeY = 0
  const menuY = 1
  const contentY = 2
  const statusY = H - 1
  const contentH = statusY - contentY
  // Region split: tree left (24 cols), editor middle, repl bottom (~11 rows or 40%).
  const treeW = Math.max(20, Math.min(28, Math.floor(W * 0.22)))
  const replH = Math.max(9, Math.min(16, Math.floor(contentH * 0.38)))
  let editorH = contentH - replH
  let cpuH = 0
  if (state.cpuOpen) {
    cpuH = Math.max(8, Math.min(12, Math.floor(contentH * 0.28)))
    editorH = contentH - replH - cpuH
  }
  // Canvas + stack panels split the row alongside the editor. Canvas
  // wants ≥40 cols (half-block, 80×80 downsampled). Stack wants ≥18.
  // If the terminal is small, we fall back to braille (25 cols) or hide.
  const editorRowX = treeW
  const editorRowW = W - treeW
  let editorW = editorRowW
  let canvasW = 0
  let stackW = 0
  let canvasEnc = 'half'
  if (state.canvasOpen) {
    const remaining = editorRowW - 30   // leave ≥30 cols for the editor
    if (remaining >= 44) { canvasW = 44; canvasEnc = 'half' }        // 42-inner cols half-block
    else if (remaining >= 26) { canvasW = 26; canvasEnc = 'braille' } // 24-inner cols braille
    else if (remaining >= 22) { canvasW = 22; canvasEnc = 'braille' }
    else canvasW = 0                                                 // too narrow, hide
  }
  if (state.stackOpen) {
    // Stack panel wants ~22 cols; if too narrow, fall back to 18.
    const remaining = editorRowW - 30 - canvasW
    if (remaining >= 22) stackW = 22
    else if (remaining >= 18) stackW = 18
    else stackW = 0
  }
  editorW = editorRowW - canvasW - stackW
  return {
    W, H, stripeY, menuY, statusY,
    treeX: 0, treeY: contentY, treeW, treeH: editorH,
    editorX: editorRowX, editorY: contentY,
    editorW, editorH,
    canvasX: editorRowX + editorW, canvasY: contentY,
    canvasW, canvasH: editorH, canvasEncoding: canvasEnc,
    stackX: editorRowX + editorW + canvasW, stackY: contentY,
    stackW, stackH: editorH,
    cpuX: 0, cpuY: contentY + editorH, cpuW: W, cpuH,
    replX: 0, replY: contentY + editorH + cpuH, replW: W, replH,
  }
}

function render() {
  if (!state.running) return
  // Decay runningMode → idle once the running budget expires. The
  // canvas polling tick also does this, but the panel might not be
  // open — do it here so the mode pill flips back on time.
  if (state.runningMode === 'running' && Date.now() > state.runningUntil) {
    state.runningMode = 'idle'
  }
  const scr = state.screen
  scr.clear()
  const L = computeLayout()
  state.layout = L

  paintStripes(scr, L)
  paintMenuBar(scr, L)
  paintTree(scr, L)
  paintEditor(scr, L)
  if (state.canvasOpen && L.canvasW > 0) paintCanvas(scr, L)
  if (state.stackOpen  && L.stackW  > 0) paintStack(scr, L)
  if (state.cpuOpen) paintCpu(scr, L)
  paintRepl(scr, L)
  paintStatus(scr, L)
  paintMenuDropdown(scr, L)
  paintGhost(scr, L)
  if (state.runCard) paintRunCard(scr, L)

  scr.flush()
  // Cursor placement.
  placeCursorPostFlush(L)
}

// ── stripes (cherry-tree tiers, mirror of web) ────────────────────

function paintStripes(scr, L) {
  // Three cherry-tree stripes at very top: pink (blossoms) · mint
  // (leaves) · cedar (trunk + earth). Only one row fits before the
  // menu bar — split it into three equal bands so the palette is
  // visible at a glance.
  const y = L.stripeY
  const w = L.W
  const bands = ['pink', 'mint', 'cedar']
  for (let x = 0; x < w; x++) {
    const bandIdx = Math.min(bands.length - 1, Math.floor(x / (w / bands.length)))
    scr.putCell(x, y, '▂', bands[bandIdx], null, 0)
  }
}

// ── menu bar ──────────────────────────────────────────────────────

function paintMenuBar(scr, L) {
  const y = L.menuY
  // Fill background with pearl (the brand "white").
  scr.fillRect(0, y, L.W, 1, ' ', 'fg', 'pearl', 0)
  // Wordmark on the left. Cedar-dark ink on pearl.
  scr.putText(1, y, '♢ MOTOI SCHEME', 'cedarDark', 'pearl', ATTR.BOLD)
  // Menus, each with alt-mnemonic hinted via first-letter bold.
  const menus = ['File', 'Tab', 'Settings', 'Help']
  let x = 18
  for (const m of menus) {
    const active = state.menuOpen === m
    const attr = active ? ATTR.REV | ATTR.BOLD : 0
    scr.putText(x, y, ' ' + m + ' ', 'cedarDark', 'pearl', attr)
    x += m.length + 3
  }
  // Mode pill just after the menus — mint-tinted "EDITING" or "RUNNING".
  const isRunning = state.runningMode === 'running'
  const pill = isRunning
    ? ' ' + SPINNER_FRAMES[state.ticks % SPINNER_FRAMES.length] + ' RUNNING '
    : ' EDITING '
  scr.putText(x + 1, y, pill, 'cedarDark', 'mint', ATTR.BOLD)
  x += pill.length + 2

  // Right-side status: pair mode + editor mode.
  const right = 'pair:' + state.pairMode + '  editor:' + state.editorMode
    + (state.editorMode === 'vim' ? '(' + state.vimMode + ')' : '')
    + '  F1 help  F6 focus  ^C bye'
  const rx = Math.max(x + 2, L.W - right.length - 1)
  scr.putText(rx, y, right, 'mintDark', 'pearl', 0)
}

function paintMenuDropdown(scr, L) {
  if (!state.menuOpen) return
  const items = MENUS[state.menuOpen] || []
  const menus = ['File', 'Tab', 'Settings', 'Help']
  let x = 18
  for (const m of menus) {
    if (m === state.menuOpen) break
    x += m.length + 3
  }
  const y = L.menuY + 1
  const w = Math.max(18, ...items.map((it) => it.label.length)) + 4
  const h = items.length + 2
  scr.fillRect(x, y, w, h, ' ', 'fg', 'pearlLight', 0)
  scr.titledFrame(x, y, w, h, null, 'cedar', 'pearlLight', 0)
  items.forEach((it, i) => {
    const attr = i === state.menuItemIdx ? ATTR.REV | ATTR.BOLD : 0
    scr.putText(x + 2, y + 1 + i, it.label.padEnd(w - 4, ' '), 'fg', 'pearlLight', attr)
  })
}

// ── tree panel ────────────────────────────────────────────────────

function paintTree(scr, L) {
  const focused = state.focus === 'tree'
  const border = focused ? 'pink' : 'cedar'
  scr.fillRect(L.treeX, L.treeY, L.treeW, L.treeH, ' ', 'fg', 'pearlLight', 0)
  scr.titledFrame(L.treeX, L.treeY, L.treeW, L.treeH, 'PROJECT', border, 'pearlLight',
    focused ? ATTR.BOLD : 0)
  const innerH = L.treeH - 2
  const startY = L.treeY + 1
  const startX = L.treeX + 1
  if (state.treeIndex < state.treeScroll) state.treeScroll = state.treeIndex
  if (state.treeIndex >= state.treeScroll + innerH) state.treeScroll = state.treeIndex - innerH + 1
  for (let i = 0; i < innerH; i++) {
    const rowIdx = state.treeScroll + i
    const row = state.treeRows[rowIdx]
    if (!row) break
    const y = startY + i
    const selected = focused && rowIdx === state.treeIndex
    let fg = 'fg'
    let attr = 0
    if (row.kind === 'book')    { fg = 'mintDark'; attr = ATTR.BOLD }   // leaves
    if (row.kind === 'action')  { fg = 'pinkDark'; attr = ATTR.BOLD }   // blossom accent
    if (row.kind === 'chapter') fg = 'fg'
    if (row.kind === 'sep') continue
    const bg = selected ? 'pink' : 'pearlLight'
    scr.putText(startX, y, ' '.repeat(L.treeW - 2), fg, bg, 0)
    scr.putText(startX + 1, y, row.label.slice(0, L.treeW - 3), fg, bg, attr | (selected ? ATTR.BOLD : 0))
  }
}

// ── editor panel (tabs + buffer) ──────────────────────────────────

function paintEditor(scr, L) {
  const focused = state.focus === 'editor'
  const border = focused ? 'pink' : 'cedar'
  scr.fillRect(L.editorX, L.editorY, L.editorW, L.editorH, ' ', 'fg', 'pearlLight', 0)
  scr.titledFrame(L.editorX, L.editorY, L.editorW, L.editorH, 'EDITOR', border, 'pearlLight',
    focused ? ATTR.BOLD : 0)

  const tabY = L.editorY + 1
  const tabsStartX = L.editorX + 1
  let x = tabsStartX
  const maxTabX = L.editorX + L.editorW - 2
  for (const t of state.tabs) {
    const active = t.id === state.activeTabId
    const label = ' ' + t.title + ' × '
    const attr = active ? ATTR.BOLD : 0
    const fg = active ? 'cedarDark' : 'cedar'
    const bg = active ? 'pearlLight' : 'pearl'
    if (x + label.length > maxTabX) break
    scr.putText(x, tabY, label, fg, bg, attr)
    // Underline the active tab with a blossom bar.
    if (active) {
      for (let i = 0; i < label.length; i++) {
        scr.putCell(x + i, tabY + 1, '▁', 'pink', null, 0)
      }
    }
    x += label.length
  }

  const bufY = tabY + 2
  const bufH = L.editorH - 3
  const bufW = L.editorW - 2
  const bufX = L.editorX + 1
  const t = activeTab()
  if (!t) {
    scr.putText(bufX + 2, bufY + 2, 'Nothing open yet.', 'fgDim', 'pearlLight', 0)
    scr.putText(bufX + 2, bufY + 3, 'Click a chapter on the left (or Tab to it), or', 'fgDim', 'pearlLight', 0)
    scr.putText(bufX + 2, bufY + 4, 'type Scheme at the REPL below.', 'fgDim', 'pearlLight', 0)
    return
  }
  if (t.kind === 'settings') return paintSettingsBuffer(scr, bufX, bufY, bufW, bufH)
  paintTextBuffer(scr, t, bufX, bufY, bufW, bufH, focused)
}

function paintSettingsBuffer(scr, x, y, w, h) {
  const lines = [
    '# Settings',
    '',
    '## Editor mode',
    '  ' + (state.editorMode === 'basic' ? '[x]' : '[ ]') + ' basic     C-Enter runs form, F2 explains',
    '  ' + (state.editorMode === 'vim'   ? '[x]' : '[ ]') + ' vim       :w :q :explain :pair-on :pair-off',
    '  ' + (state.editorMode === 'emacs' ? '[x]' : '[ ]') + ' emacs     C-x C-s save, C-x C-e eval, M-e explain',
    '',
    '## Pair programming',
    '  ' + (state.pairMode === 'off'          ? '[x]' : '[ ]') + ' off',
    '  ' + (state.pairMode === 'user-drives'  ? '[x]' : '[ ]') + ' user-drives    (ambient completions after 3s pause)',
    '  ' + (state.pairMode === 'motoi-drives' ? '[x]' : '[ ]') + ' motoi-drives   (narrated turn-taking)',
    '',
    '## Palette — Sakura Cherry Tree',
    '  pink  — blossoms · mint  — leaves · cedar — trunk & earth',
    '  cream / pearl — warm baseline · deep-cedar ink',
    '  Detect: ' + state.screen.mode,
    '',
    '## Panels',
    '  ' + (state.canvasOpen ? '[x]' : '[ ]') + ' Canvas display (F3 · Alt-C toggles)',
    '  ' + (state.cpuOpen    ? '[x]' : '[ ]') + ' CPU display    (F4 toggles)',
    '  ' + (state.stackOpen  ? '[x]' : '[ ]') + ' Stack panel    (F7 · Alt-K toggles)',
    '',
    'Use the Settings menu (Alt-S) to reopen this tab.',
  ]
  lines.forEach((ln, i) => {
    if (i >= h) return
    let fg = 'fg'
    if (ln.startsWith('# ')) fg = 'cedarDark'
    if (ln.startsWith('## ')) fg = 'mintDark'
    scr.putText(x + 1, y + i, ln.slice(0, w - 2), fg, 'pearlLight',
      ln.startsWith('#') ? ATTR.BOLD : 0)
  })
}

function paintTextBuffer(scr, t, x, y, w, h, focused) {
  const lines = t.content.split('\n')
  const { line, col } = cursorLineCol(t.content, t.cursor)
  if (line < t.scroll) t.scroll = line
  if (line >= t.scroll + h) t.scroll = line - h + 1
  for (let i = 0; i < h; i++) {
    const li = t.scroll + i
    const ln = lines[li]
    if (ln === undefined) break
    // Line number gutter (soft cedar-dim).
    const gutter = String(li + 1).padStart(3, ' ') + ' '
    scr.putText(x, y + i, gutter, 'fgDim', 'pearlLight', 0)
    // Body — with lightweight highlight for parens / comments / strings.
    paintSchemeLine(scr, x + gutter.length, y + i, ln.slice(0, w - gutter.length))
  }
  if (focused) {
    const gutter = 4
    const cx = x + gutter + col
    const cy = y + (line - t.scroll)
    if (cy >= y && cy < y + h && cx >= x + gutter && cx < x + w) {
      const cur = scr.back[cy][cx]
      const ch = cur ? cur.ch : ' '
      const blink = (Math.floor(state.ticks / 1) % 2) === 0
      // Cedar-dark block cursor on cream — reads as a warm ink smudge.
      scr.putCell(cx, cy, ch, 'pearlLight', 'cedarDark', blink ? ATTR.BOLD : 0)
    }
  }
}

// Very small syntax-color pass:
//   ; comments  → mint-dark (leaves whisper aside)
//   "strings"   → pink-dark (blossom-tinted)
//   ( ) parens  → cedar (trunk/anchor)
//   everything else → cedar-brown ink (fg)
function paintSchemeLine(scr, x, y, s) {
  let mode = 'code'
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (mode === 'string') {
      scr.putCell(x + i, y, c, 'pinkDark', 'pearlLight', 0)
      if (c === '"' && s[i - 1] !== '\\') mode = 'code'
      continue
    }
    if (mode === 'comment') {
      scr.putCell(x + i, y, c, 'mintDark', 'pearlLight', ATTR.DIM)
      continue
    }
    if (c === ';') { mode = 'comment'; scr.putCell(x + i, y, c, 'mintDark', 'pearlLight', ATTR.DIM); continue }
    if (c === '"') { mode = 'string'; scr.putCell(x + i, y, c, 'pinkDark', 'pearlLight', 0); continue }
    if (c === '(' || c === ')') {
      scr.putCell(x + i, y, c, 'cedar', 'pearlLight', ATTR.BOLD)
      continue
    }
    scr.putCell(x + i, y, c, 'fg', 'pearlLight', 0)
  }
}

// ── CPU panel ──────────────────────────────────────────────────

function paintCpu(scr, L) {
  scr.fillRect(L.cpuX, L.cpuY, L.cpuW, L.cpuH, ' ', 'fg', 'pearlLight', 0)
  scr.titledFrame(L.cpuX, L.cpuY, L.cpuW, L.cpuH, 'CPU', 'cedar', 'pearlLight', 0)
  const lines = String(state.cpuText || 'CPU not booted — (cpu/boot!)').split('\n')
  for (let i = 0; i < L.cpuH - 2; i++) {
    if (!lines[i]) break
    scr.putText(L.cpuX + 2, L.cpuY + 1 + i, lines[i].slice(0, L.cpuW - 4), 'fg', 'pearlLight', 0)
  }
}

// ── canvas panel (fantasy console screen) ─────────────────────
//
// Half-block ▀ character: two vertically-stacked pixels per cell, top
// half painted as the fg color, bottom half as the bg color. That's
// how PICO-8, TIC-80 and every retro fantasy console fake a bitmap
// display on a text grid. We map the 80×80 framebuffer's palette
// indices to 24-bit ANSI (or 256 in fallback mode). Braille ⣿ is
// available as a fallback for terminals too narrow for half-block.
//
// The whole surface is drawn with cherry-tree bezel: pink top, mint
// sides, cedar bottom, cream corners.

// Nearest-neighbor sample of the fb pixels into a target rect.
// Given fb pixels (w×h) and target (tw×th), returns pixels[ty][tx].
function samplePixel(pixels, fbW, fbH, tx, ty, tw, th) {
  const x = Math.floor(tx * fbW / tw)
  const y = Math.floor(ty * fbH / th)
  return pixels[y * fbW + x] | 0
}

// Approximate an RGB triple to the nearest xterm-256 slot for the
// fallback path. Uses the 6×6×6 color cube (indices 16..231) — good
// enough for palette-index sprites and matches how the Screen palette
// module treats truecolor-degrade traffic.
function rgbTo256(r, g, b) {
  // Grayscale detection: if r ≈ g ≈ b, use the 24-step gray ramp.
  if (Math.abs(r - g) < 8 && Math.abs(g - b) < 8) {
    const gray = Math.round((r + g + b) / 3)
    if (gray < 8)   return 16   // black corner
    if (gray > 248) return 231  // white corner
    return 232 + Math.min(23, Math.max(0, Math.round((gray - 8) / 10)))
  }
  const c = (v) => Math.min(5, Math.max(0, Math.round(v / 51)))
  return 16 + 36 * c(r) + 6 * c(g) + c(b)
}

// Build a truecolor OR 256-color ANSI escape for an RGB triple. Uses
// the Screen's palette mode so NO_COLOR degrades to empty strings.
function rgbAnsi(scr, r, g, b, isBg) {
  const mode = scr.palette.mode
  if (mode === 'none') return ''
  const prefix = isBg ? '48' : '38'
  if (mode === 'truecolor') return '\x1b[' + prefix + ';2;' + r + ';' + g + ';' + b + 'm'
  return '\x1b[' + prefix + ';5;' + rgbTo256(r, g, b) + 'm'
}

function paintCanvas(scr, L) {
  const focused = state.focus === 'canvas'
  const border = focused ? 'pink' : 'cedar'
  scr.fillRect(L.canvasX, L.canvasY, L.canvasW, L.canvasH, ' ', 'fg', 'pearlLight', 0)
  scr.titledFrame(L.canvasX, L.canvasY, L.canvasW, L.canvasH, 'CANVAS', border, 'pearlLight',
    focused ? ATTR.BOLD : 0)

  // Cherry-tree bezel accents INSIDE the frame — pink top-tick + cedar
  // bottom-tick, so the panel reads as a little display, not just
  // another box. One tick at each middle-column mark.
  const midX = L.canvasX + Math.floor(L.canvasW / 2)
  scr.putCell(midX, L.canvasY,             '▂', 'pink',  'pearlLight', 0)
  scr.putCell(midX, L.canvasY + L.canvasH - 1, '▔', 'cedar', 'pearlLight', 0)

  const snap = state.session.framebufferSnapshot()
  if (!snap) {
    scr.putText(L.canvasX + 2, L.canvasY + 2, 'no framebuffer.', 'fgDim', 'pearlLight', 0)
    scr.putText(L.canvasX + 2, L.canvasY + 3, 'try (circle 40 40 12)', 'mintDark', 'pearlLight', 0)
    return
  }

  // Inner drawable rect (inside the frame).
  const innerX = L.canvasX + 1
  const innerY = L.canvasY + 1
  const innerW = L.canvasW - 2
  const innerH = L.canvasH - 2

  // Compute the display grid.
  //   half-block: 2 pixels vertically per cell, 1 pixel horizontally
  //   braille:    4 rows × 2 cols per cell
  const enc = L.canvasEncoding || 'half'
  if (enc === 'half') {
    // We render min(80, innerW) × (innerH * 2) pixels of the fb, scaled
    // to fit. If innerW > 80 we still cap at innerW (letting pixels be
    // ~1:1 for small terminals). Center within the inner rect.
    const cols = Math.min(innerW, 80)
    const rows = Math.min(innerH * 2, 80)
    const displayRows = Math.ceil(rows / 2)
    const offX = innerX + Math.floor((innerW - cols) / 2)
    const offY = innerY + Math.floor((innerH - displayRows) / 2)
    paintHalfBlock(scr, snap, offX, offY, cols, rows)
  } else {
    const cols = Math.min(innerW, 40) * 2  // 2 pixels per braille col
    const rows = Math.min(innerH, 20) * 4  // 4 pixels per braille row
    const displayRows = Math.ceil(rows / 4)
    const displayCols = Math.ceil(cols / 2)
    const offX = innerX + Math.floor((innerW - displayCols) / 2)
    const offY = innerY + Math.floor((innerH - displayRows) / 2)
    paintBraille(scr, snap, offX, offY, cols, rows)
  }

  // Frame indicator: bottom-right corner shows `frame N`, wrapped small.
  const label = 'frame ' + snap.frame
  if (label.length + 4 < innerW) {
    scr.putText(L.canvasX + L.canvasW - label.length - 2, L.canvasY + L.canvasH - 1,
      label, 'cedar', 'pearlLight', ATTR.DIM)
  }
  // Spinner when we know code is running.
  if (state.runningMode === 'running') {
    const spin = SPINNER_FRAMES[state.ticks % SPINNER_FRAMES.length]
    scr.putCell(L.canvasX + 2, L.canvasY + L.canvasH - 1, spin, 'pinkDark', 'pearlLight', ATTR.BOLD)
  }
}

// Paint half-block pixels (▀). Each terminal cell shows two vertically
// stacked pixels — top as fg, bottom as bg. We bypass the Screen's
// palette-tier abstraction and write direct-RGB escapes so we can
// address the fb's 16-entry palette faithfully.
function paintHalfBlock(scr, fb, offX, offY, cols, rows) {
  for (let ry = 0; ry < rows; ry += 2) {
    const cy = offY + (ry >> 1)
    if (cy < 0 || cy >= scr.rows) continue
    for (let cx = 0; cx < cols; cx++) {
      const x = offX + cx
      if (x < 0 || x >= scr.cols) continue
      const top = samplePixel(fb.pixels, fb.w, fb.h, cx, ry,     cols, rows)
      const bot = ry + 1 < rows
        ? samplePixel(fb.pixels, fb.w, fb.h, cx, ry + 1, cols, rows)
        : top
      const tRGB = fb.palette[top & 0x0f] || [0, 0, 0]
      const bRGB = fb.palette[bot & 0x0f] || [0, 0, 0]
      // Write directly into the back buffer with an already-encoded
      // color spec — do this by using a private putCell shape: we
      // stash the RGB triple as fg/bg strings so Screen._ansiFor doesn't
      // rewrap. Simpler path: pre-encode into a Sentinel via putText.
      putRgbCell(scr, x, cy, '▀', tRGB, bRGB)
    }
  }
}

// Braille rendering — 2×4 pixel packing per cell. Each Unicode
// braille glyph is U+2800..U+28FF; bits map to a 2-col × 4-row dot
// matrix: col0 (rows 0,1,2,3) = bits 0,1,2,6; col1 = bits 3,4,5,7.
// We use it as a monochrome fallback — one color per cell, taken from
// the dominant palette index in the 2×4 block.
function paintBraille(scr, fb, offX, offY, cols, rows) {
  const BIT_MAP = [
    [0, 3],  // row 0: col0=bit0, col1=bit3
    [1, 4],
    [2, 5],
    [6, 7],
  ]
  for (let ry = 0; ry < rows; ry += 4) {
    const cy = offY + (ry >> 2)
    if (cy < 0 || cy >= scr.rows) continue
    for (let cx = 0; cx < cols; cx += 2) {
      const x = offX + (cx >> 1)
      if (x < 0 || x >= scr.cols) continue
      // Compute the 8-bit dot mask + pick a color as the most-common
      // non-zero palette index across the block. If all zeros, skip.
      let mask = 0
      const counts = {}
      let bestIdx = 0, bestN = 0
      for (let dy = 0; dy < 4 && ry + dy < rows; dy++) {
        for (let dx = 0; dx < 2 && cx + dx < cols; dx++) {
          const p = samplePixel(fb.pixels, fb.w, fb.h, cx + dx, ry + dy, cols, rows) & 0x0f
          if (p !== 0) {
            mask |= (1 << BIT_MAP[dy][dx])
            counts[p] = (counts[p] || 0) + 1
            if (counts[p] > bestN) { bestN = counts[p]; bestIdx = p }
          }
        }
      }
      if (mask === 0) continue
      const ch = String.fromCharCode(0x2800 + mask)
      const rgb = fb.palette[bestIdx] || [255, 255, 255]
      putRgbCell(scr, x, cy, ch, rgb, null)
    }
  }
}

// Screen.putCell speaks palette-tier names ('pink', …), not raw RGB.
// For the canvas we need pixel-accurate palette faithfulness — the
// fb defines its own 16-color palette (PICO-8-inspired) that isn't
// on the SAKURA tier list. We escape hatch by writing directly into
// the back buffer with the encoded ANSI as the fg/bg field. Screen's
// diff-flush treats any two cells with different fg strings as
// different, so cache hits still work.
function putRgbCell(scr, x, cy, ch, fgRGB, bgRGB) {
  if (cy < 0 || cy >= scr.rows || x < 0 || x >= scr.cols) return
  const fgStr = fgRGB ? ('rgb:' + fgRGB[0] + ',' + fgRGB[1] + ',' + fgRGB[2]) : null
  const bgStr = bgRGB ? ('rgb:' + bgRGB[0] + ',' + bgRGB[1] + ',' + bgRGB[2]) : null
  scr.back[cy][x] = { ch, fg: fgStr, bg: bgStr, attr: 0 }
}

// xterm-256 → RGB. Uses the 6×6×6 color cube (indices 16..231) and the
// 24-step gray ramp (232..255). Slots 0..15 use the standard xterm
// system palette (approximate — Motoi's fb/dump only emits 16..231).
const XTERM_256_LOW = [
  [0,0,0], [128,0,0], [0,128,0], [128,128,0], [0,0,128], [128,0,128], [0,128,128], [192,192,192],
  [128,128,128], [255,0,0], [0,255,0], [255,255,0], [0,0,255], [255,0,255], [0,255,255], [255,255,255],
]
function xterm256ToRgb(n) {
  n = n | 0
  if (n < 16) return XTERM_256_LOW[n] || [0, 0, 0]
  if (n >= 232) {
    const g = 8 + (n - 232) * 10
    return [g, g, g]
  }
  const i = n - 16
  const r = Math.floor(i / 36), g = Math.floor((i % 36) / 6), b = i % 6
  const scale = (v) => v === 0 ? 0 : 55 + v * 40
  return [scale(r), scale(g), scale(b)]
}

// Decode a run of `\x1b[...m▀` sequences and paint each character as an
// RGB cell. Handles the exact shape `fb/dump` emits — `\x1b[38;5;N;48;5;Mm`
// followed by a single grapheme — plus stray `\x1b[0m` resets. Cells that
// don't fit in the panel are clipped, not wrapped (fb/dump is 40 rows of
// 80 cells; wrapping would double-render each row).
function paintAnsiLine(scr, x, y, text, maxW) {
  let fg = null, bg = null
  let col = 0
  let i = 0
  while (i < text.length && col < maxW) {
    if (text[i] === '\x1b' && text[i + 1] === '[') {
      const mEnd = text.indexOf('m', i + 2)
      if (mEnd < 0) break
      const params = text.slice(i + 2, mEnd).split(';').map((s) => parseInt(s, 10) | 0)
      // Parse SGR params. Reset (0) clears both. `38;5;N` sets fg 256-color;
      // `48;5;N` sets bg 256-color. Any other codes are ignored — fb/dump
      // doesn't emit them.
      for (let p = 0; p < params.length; p++) {
        const v = params[p]
        if (v === 0)      { fg = null; bg = null }
        else if (v === 38 && params[p + 1] === 5) { fg = xterm256ToRgb(params[p + 2]); p += 2 }
        else if (v === 48 && params[p + 1] === 5) { bg = xterm256ToRgb(params[p + 2]); p += 2 }
      }
      i = mEnd + 1
      continue
    }
    // A literal character. fb/dump uses the half-block ▀ (multi-byte UTF-8);
    // JS strings index by code unit, so we advance by 1 and let put occur
    // — the fill glyph will still be ▀ as a single grapheme.
    // Detect surrogate/multi-byte codepoints: pick a whole codepoint using
    // codePointAt so `▀` (U+2580, a BMP char but multi-byte UTF-8) reads
    // fine — JS still stores it as one code unit.
    const ch = text[i]
    if (ch === '\n' || ch === '\r') { i++; continue }
    putRgbCell(scr, x + col, y, ch, fg, bg)
    col++
    i++
  }
}

// ── stack panel ──────────────────────────────────────────────

function paintStack(scr, L) {
  const focused = state.focus === 'stack'
  const border = focused ? 'pink' : 'cedar'
  scr.fillRect(L.stackX, L.stackY, L.stackW, L.stackH, ' ', 'fg', 'pearlLight', 0)
  scr.titledFrame(L.stackX, L.stackY, L.stackW, L.stackH, 'STACK', border, 'pearlLight',
    focused ? ATTR.BOLD : 0)
  const frames = state.stackFrames || []
  const innerX = L.stackX + 1
  const innerY = L.stackY + 1
  const innerW = L.stackW - 2
  const innerH = L.stackH - 2

  if (frames.length === 0) {
    scr.putText(innerX + 1, innerY + 1, '(idle)',    'fgDim',   'pearlLight', ATTR.DIM)
    scr.putText(innerX + 1, innerY + 2, 'Run some',  'fgDim',   'pearlLight', 0)
    scr.putText(innerX + 1, innerY + 3, 'Scheme to', 'fgDim',   'pearlLight', 0)
    scr.putText(innerX + 1, innerY + 4, 'see frames.','fgDim',  'pearlLight', 0)
    return
  }

  // Header: "depth: N"
  const header = 'depth ' + frames.length
  scr.putText(innerX, innerY, header, 'mintDark', 'pearlLight', ATTR.BOLD)

  // Frames — deepest first (already ordered by the ledger). Active
  // (deepest) frame gets a mint background bar.
  for (let i = 0; i < innerH - 1 && i < frames.length; i++) {
    const f = frames[i]
    const active = i === 0
    const bg = active ? 'mint' : 'pearlLight'
    const fg = active ? 'cedarDark' : 'fg'
    const attr = active ? ATTR.BOLD : 0
    const label = String(f.name || '?').slice(0, innerW - 4)
    const kindHint = String(f.kind || '').slice(0, 1)  // 'c' | 'p' | 's'
    const line = (i === 0 ? '▸ ' : '  ') + label
    scr.putText(innerX, innerY + 1 + i, ' '.repeat(innerW), fg, bg, 0)
    scr.putText(innerX, innerY + 1 + i, line.slice(0, innerW - 2), fg, bg, attr)
    scr.putText(innerX + innerW - 1, innerY + 1 + i, kindHint, 'cedar', bg, ATTR.DIM)
  }
}

// ── inline run card (output beneath the form) ─────────────────
//
// The card is a small tinted box floated over the editor at the form's
// last line. It shows stdout + return value + error. Dismiss via Esc
// or Ctrl-D. If it can't fit at the anchor (bottom of viewport), we
// drift it up to fit — always within the editor rect.

function paintRunCard(scr, L) {
  const card = state.runCard
  if (!card) return
  const t = activeTab()
  if (!t || t.id !== card.tabId) return
  // Compute card content lines.
  const stdoutLines = card.stdout ? card.stdout.split('\n').filter((l) => l !== '') : []
  const bodyLines = []
  for (const s of stdoutLines) bodyLines.push({ kind: 'stdout', text: s })
  if (card.error) bodyLines.push({ kind: 'err', text: card.error })
  else if (card.value !== '') bodyLines.push({ kind: 'value', text: card.value })
  if (bodyLines.length === 0) bodyLines.push({ kind: 'meta', text: 'ok — no output' })

  const maxBodyW = Math.min(L.editorW - 6, 60)
  // Wrap long lines to maxBodyW.
  const wrapped = []
  for (const b of bodyLines) {
    let s = b.text
    while (s.length > maxBodyW) {
      wrapped.push({ kind: b.kind, text: s.slice(0, maxBodyW) })
      s = s.slice(maxBodyW)
    }
    wrapped.push({ kind: b.kind, text: s })
  }
  const cardH = Math.min(wrapped.length, 6) + 2   // +2 for border
  const cardW = Math.min(maxBodyW, wrapped.reduce((m, l) => Math.max(m, l.text.length), 0)) + 4

  // Anchor position within the editor buffer viewport.
  const gutter = 4
  const bufY0 = L.editorY + 3
  let cy = bufY0 + (card.anchorLine - (t.scroll || 0)) + 1
  let cx = L.editorX + 1 + gutter
  // Fit within editor rect.
  if (cy + cardH >= L.editorY + L.editorH - 1) cy = L.editorY + L.editorH - 1 - cardH
  if (cy < bufY0) cy = bufY0
  if (cx + cardW >= L.editorX + L.editorW - 1) cx = L.editorX + L.editorW - 1 - cardW
  if (cx < L.editorX + 1) cx = L.editorX + 1

  // Frame — cedar-dark ink, pearl-light bg.
  scr.fillRect(cx, cy, cardW, cardH, ' ', 'fg', 'pearlShadow', 0)
  scr.titledFrame(cx, cy, cardW, cardH, '↳ output', 'cedarDark', 'pearlShadow', ATTR.BOLD)
  // Body.
  for (let i = 0; i < cardH - 2; i++) {
    const rec = wrapped[i]
    if (!rec) break
    let fg = 'fg'
    if (rec.kind === 'stdout') fg = 'mintDark'
    if (rec.kind === 'err')    fg = 'danger'
    if (rec.kind === 'value')  fg = 'cedarDark'
    if (rec.kind === 'meta')   fg = 'fgDim'
    scr.putText(cx + 2, cy + 1 + i, rec.text.slice(0, cardW - 4), fg, 'pearlShadow',
      rec.kind === 'value' ? ATTR.BOLD : 0)
  }
  // Dismiss hint on the right of the title.
  const hint = ' Esc '
  if (cardW > 20) {
    scr.putText(cx + cardW - hint.length - 1, cy, hint, 'cedarDark', 'pearlShadow', ATTR.DIM)
  }
}

// ── REPL panel ─────────────────────────────────────────────────

function paintRepl(scr, L) {
  const focused = state.focus === 'repl'
  const border = focused ? 'pink' : 'cedar'
  scr.fillRect(L.replX, L.replY, L.replW, L.replH, ' ', 'fg', 'pearlLight', 0)
  scr.titledFrame(L.replX, L.replY, L.replW, L.replH, 'REPL', border, 'pearlLight',
    focused ? ATTR.BOLD : 0)
  const logH = L.replH - 3
  const logY = L.replY + 1
  const logX = L.replX + 1
  const logW = L.replW - 2
  const start = Math.max(0, state.replLog.length - logH - state.replScroll)
  const end = state.replLog.length - state.replScroll
  for (let i = 0; i < logH; i++) {
    const idx = start + i
    if (idx >= end) break
    const rec = state.replLog[idx]
    if (!rec) continue
    // Cherry-tree kinds:
    //   in     → cedar-dark (deep ink, what the user wrote)
    //   out    → fg (cedar-brown ink, Motoi's reply)
    //   err    → danger (pink-dark)
    //   stdout → mint-dark (italic in web IDE; here just tinted)
    let fg = 'fg', prefix = ''
    if (rec.kind === 'in')     { fg = 'cedarDark'; prefix = '> ' }
    if (rec.kind === 'out')    { fg = 'fg' }
    if (rec.kind === 'err')    { fg = 'danger' }
    if (rec.kind === 'stdout') { fg = 'mintDark' }
    // ANSI passthrough — fb/dump emits `\x1b[38;5;N;48;5;Mm▀` runs. When
    // one of those lines lands in the REPL log we decode the escapes and
    // paint each character as an RGB cell so the pixels ACTUALLY show as
    // pixels in the panel. Non-ANSI lines take the normal path.
    if (rec.kind === 'stdout' && rec.text.indexOf('\x1b[') !== -1) {
      paintAnsiLine(scr, logX, logY + i, rec.text, logW)
      continue
    }
    const line = (prefix + rec.text).slice(0, logW)
    // Book-of-* prose renders one visual line per source line and uses
    // markdown-ish styling so `(book/read :book 'scheme :chapter 1)` no
    // longer dumps a JSON-escaped wall.
    if (rec.kind === 'out' && rec.mdStyle) {
      scr.putText(logX, logY + i, line, rec.mdStyle.fg, 'pearlLight',
        rec.mdStyle.attr || 0)
      continue
    }
    scr.putText(logX, logY + i, line, fg, 'pearlLight', 0)
  }
  // Input row.
  const inY = L.replY + L.replH - 2
  scr.putText(logX, inY, 'motoi> ', 'pinkDark', 'pearlLight', ATTR.BOLD)
  const promptW = 'motoi> '.length
  const inputSlice = state.replInput.slice(0, logW - promptW)
  scr.putText(logX + promptW, inY, inputSlice, 'fg', 'pearlLight', 0)
  if (focused) {
    const cx = logX + promptW + Math.min(state.replCursor, logW - promptW - 1)
    const cy = inY
    const cur = state.replInput[state.replCursor] || ' '
    // Cedar-dark block cursor — same ink as the editor.
    scr.putCell(cx, cy, cur, 'pearlLight', 'cedarDark', ATTR.BOLD)
  }
}

// ── status line ──────────────────────────────────────────────

function paintStatus(scr, L) {
  const y = L.statusY
  // Status bar sits on mint (leaf-band) for a soft green ribbon at the
  // very bottom — same role as the tree's canopy in the cherry-tree
  // metaphor.
  scr.fillRect(0, y, L.W, 1, ' ', 'fg', 'mint', 0)
  const t = activeTab()
  let left = ''
  if (t) {
    const { line, col } = cursorLineCol(t.content || '', t.cursor || 0)
    left = ' ' + t.title + '  ' + (line + 1) + ':' + (col + 1)
  }
  scr.putText(0, y, left, 'cedarDark', 'mint', ATTR.BOLD)
  if (state.editorMode === 'vim' && state.vimMode === 'command') {
    const cmd = ':' + state.vimCmd
    scr.putText(Math.floor(L.W / 2) - Math.floor(cmd.length / 2), y, cmd,
      'cedarDark', 'mint', ATTR.BOLD | ATTR.REV)
  }
  if (state.statusUntil > Date.now()) {
    const s = ' ' + state.status + ' '
    scr.putText(L.W - s.length - 1, y, s, 'cedarDark', 'pink', ATTR.BOLD)
  } else {
    const hint = ' Tab: cycle focus · F1 help · ^C exit '
    scr.putText(L.W - hint.length - 1, y, hint, 'cedarDark', 'mint', 0)
  }
}

// ── ghost text (ambient completion) ─────────────────────────

function paintGhost(scr, L) {
  const t = activeTab()
  if (!state.ghost || !t || t.id !== state.ghost.tabId) return
  const { line, col } = cursorLineCol(t.content, state.ghost.cursor)
  const gutter = 4
  const bx = L.editorX + 1 + gutter + col
  const by = L.editorY + 3 + (line - (t.scroll || 0))
  const bufY0 = L.editorY + 3
  if (by < bufY0 || by >= L.editorY + L.editorH - 1) return
  const text = state.ghost.text
  const maxW = L.editorX + L.editorW - 1 - bx
  const clipped = text.slice(0, Math.max(0, maxW))
  // Ghost is a blossom-tinted whisper on cream.
  scr.putText(bx, by, clipped, 'pinkDark', 'cream', ATTR.DIM | ATTR.BOLD)
  if (bx + clipped.length + 6 < L.editorX + L.editorW) {
    scr.putText(bx + clipped.length + 1, by, '↹Tab', 'mintDark', 'cream', ATTR.DIM)
  }
}

// ── cursor placement (after flush) ──────────────────────────

function placeCursorPostFlush(L) {
  // Hide cursor — we render our own block cursors for editor & REPL,
  // and don't want the OS cursor jittering across the alt screen.
  process.stdout.write('\x1b[?25l')
}

// ── help text ──────────────────────────────────────────────

const HELP_TEXT = `# Motoi Scheme TUI — help

## Panels
  PROJECT   left        books + chapters, use ↑↓ + Enter
  EDITOR    center      tabbed buffers + chapter views
  CANVAS    toggle F3   80×80 fantasy-console screen (half-block)
  CPU       toggle F4   little 8-bit machine for Book of Code ch 12
  STACK     toggle F7   live evaluation frames
  REPL      bottom      talk to Motoi, ↑↓ recalls history

## Global keys
  F1  help      F2  explain form   F3  canvas panel
  F4  cpu       F5  pair mode      F6  cycle focus
  F7  stack     F8  run form (inline output card)
  F10 File menu
  Alt-F/T/S/H open menus (File · Tab · Settings · Help)
  Alt-C toggle canvas · Alt-K toggle stack
  Tab cycle focus (or accept ghost completion when visible)
  C-c exit      Ctrl-Enter run enclosing form
  C-t new tab   C-w close tab
  Ctrl+Shift+Left/Right — move current tab left / right
  Ctrl+PgUp/PgDn — jump to prev / next tab
  Esc — dismiss inline output card (or ghost text)

## Editor modes
  basic   arrows + printable text.
          Ctrl-Enter runs the enclosing form.
          F2 explains what's under the cursor.
  vim     starts in NORMAL mode. i/a/o insert.
          hjkl move, 0/$ line ends, x delete char.
          : opens command line — :w :q :wq :explain
          :pair-on :pair-off :cpu :help :settings
  emacs   C-x C-s save (in-session), C-x C-e eval form,
          M-e explain, M-x eval form.

## REPL
  ↑↓ history, C-a home, C-e end, C-l clear.
  ,help  ,exit  ,clear  ,cpu  ,pair — TUI shortcuts.
  ,book <slug> <n> — fetch + pretty-render a book chapter.
  Every other line evaluates as Scheme.

## Pair programming
  F5 cycles off → user-drives → motoi-drives.
  In user-drives, Motoi offers ambient completions after
  ~3s of typing pause. Press Tab to accept.

## Palette — Sakura Cherry Tree
  pink   — blossoms          (top stripe, focus rings, prompt)
  mint   — leaves            (comments, tree headers, status ribbon)
  cedar  — trunk + earth     (parens, panel frames, active tab ink)
  cream / pearl              (warm baseline everywhere else)
  Same runtime as motoi ide (browser); same soft colors in the shell.

Type ,exit or press C-c to leave.
`

export default startTui
