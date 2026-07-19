// ide.js — Motoi Scheme IDE, browser side.
//
// Zero framework. Everything lives on `window.MotoiIDE` for inspection.
// Panels:
//   left       — file tree (books/chapters + a "buffers" section for
//                user-typed content)
//   center     — tabbed editor with Run + Run-All + book-reader mode
//   right-top  — fantasy console (80×80 framebuffer) — toggleable
//   right-btm  — REPL + output log (session log)
//   right-bt2  — call-stack panel (below REPL) — toggleable
//   footer     — CPU display — toggleable
//
// All persistent state lives in a single object. Some session bits round-
// trip via localStorage (tab order, editor mode, panel-open flags).
//
// Marcus 2026-07-19 — Wave 3: fantasy console + notebook + debugger.
// Every panel additive, cherry-tree palette locked, mobile-first
// preserved. F-key parity with the TUI (F1/F2/F4/F5/F6).

const state = {
  tabs: [],           // [{ id, kind, title, content, dirty?, chapter?, blockOutputs? }]
  activeTabId: null,
  books: [],          // list of book slugs from /api/books
  chapters: {},       // book → toc array
  cpuOpen: false,
  cpuTimer: null,
  consoleOpen: false, // fantasy-console panel
  stackOpen: false,   // call-stack panel
  focusedPanel: 'editor',
  ideMode: 'editing', // editing | running | paused — reflected in the chip

  // Wave 2 (from prior wave, preserved) ─────────────────────────────
  pairMode: 'off',    // off | user-drives | motoi-drives
  editorMode: 'basic',// basic | vim | emacs
  ambientTimer: null,
  lastAmbientPrefix: '',

  // Wave 3 additions (Marcus 2026-07-19) ────────────────────────────
  canvas: {
    rafId: null,
    lastFetch: 0,
    lastPixels: null,   // Uint8ClampedArray for reuse
    dims: { w: 80, h: 80 },
    palette: [],
  },
  stack: {
    timer: null,
    frames: [],
    depth: 0,
    which: 'live',
    idle: true,
  },
  drag: {
    tabId: null,
    dropTarget: null,   // { id, side: 'before'|'after' }
  },
}

let nextTabId = 1

// ── DOM shortcuts ────────────────────────────────────────────────────

const $ = (sel) => document.querySelector(sel)
const el = (tag, props = {}, children = []) => {
  const node = document.createElement(tag)
  for (const k of Object.keys(props)) {
    if (k === 'class') node.className = props[k]
    else if (k === 'text') node.textContent = props[k]
    else if (k === 'html') node.innerHTML = props[k]
    else if (k.startsWith('on') && typeof props[k] === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), props[k])
    } else {
      node.setAttribute(k, props[k])
    }
  }
  for (const c of children) {
    if (c == null) continue
    if (typeof c === 'string') node.appendChild(document.createTextNode(c))
    else node.appendChild(c)
  }
  return node
}

// ── API helpers ──────────────────────────────────────────────────────

async function api(path, opts) {
  const r = await fetch(path, opts || {})
  return r.json()
}

async function apiEval(source) {
  return api('/api/eval', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source }),
  })
}

// ── mode chip (editing / running / paused) ───────────────────────────

function setMode(mode) {
  state.ideMode = mode
  const chip = $('#mode-chip')
  if (!chip) return
  chip.textContent = mode
  chip.className = 'motoi-chip motoi-chip--' + (mode === 'running' ? 'running' : mode === 'paused' ? 'paused' : 'idle')
}

// ── focus indicator ──────────────────────────────────────────────────
//
// Any panel with data-focus-key gets a mint left-border when marked
// focused. Click within a panel = focused. Also toggled by F6 rotate.

const FOCUS_ORDER = ['tree', 'editor', 'repl', 'console', 'stack']

function setFocused(key) {
  state.focusedPanel = key
  for (const p of document.querySelectorAll('.motoi-panel[data-focus-key]')) {
    if (p.dataset.focusKey === key) p.dataset.focused = 'yes'
    else p.removeAttribute('data-focused')
  }
}

function cycleFocus() {
  const visible = FOCUS_ORDER.filter((k) => {
    if (k === 'console') return state.consoleOpen
    if (k === 'stack')   return state.stackOpen
    return true
  })
  const idx = visible.indexOf(state.focusedPanel)
  const next = visible[(idx + 1) % visible.length]
  setFocused(next)
  // Move cursor into the corresponding element when sensible.
  if (next === 'repl') $('#repl-input')?.focus()
  else if (next === 'editor') {
    const t = activeTab()
    if (t) document.querySelector(`textarea.motoi-editor[data-tab-id="${t.id}"]`)?.focus()
  }
}

// ── logging into the REPL panel ──────────────────────────────────────

function log(kind, text) {
  const logNode = $('#repl-log')
  if (!logNode) return
  const line = el('div', { class: kind }, [text])
  logNode.appendChild(line)
  logNode.scrollTop = logNode.scrollHeight
}

// Append an already-constructed DOM node to the REPL log (for structured
// output like colored help cards). Same auto-scroll as log().
function logNode(node) {
  const l = $('#repl-log')
  if (!l) return
  l.appendChild(node)
  l.scrollTop = l.scrollHeight
}

// Render a colored help card for a verb's metadata (from /api/help).
function renderHelpCard(meta) {
  const card = el('div', { class: 'motoi-help' })
  const head = el('div', {}, [
    el('span', { class: 'help-name' }, [meta.name]),
    el('span', { class: 'help-doc' }, [meta.doc || '(no doc)']),
  ])
  card.appendChild(head)
  const row = (label, valueNode) => {
    const r = el('div', { class: 'help-row' }, [
      el('span', { class: 'help-label' }, [label]),
      valueNode,
    ])
    card.appendChild(r)
  }
  if (meta.contract) row('signature', el('span', { class: 'help-sig' }, [meta.contract]))
  if (meta.arity != null) {
    const a = Array.isArray(meta.arity) ? meta.arity.join('..') : String(meta.arity)
    row('arity', el('span', { class: 'help-arity' }, [a]))
  }
  if (meta.namespace) row('namespace', el('span', {}, [meta.namespace]))
  if (meta.since) row('since', el('span', {}, [meta.since]))
  if (Array.isArray(meta.examples) && meta.examples.length) {
    const box = el('div', { class: 'help-examples' })
    for (const ex of meta.examples) {
      const level = (ex && (ex.level || ex.tier)) || ''
      const code = (ex && (ex.code || ex.form)) || (typeof ex === 'string' ? ex : '')
      if (!code) continue
      const line = el('div', { class: 'help-example' }, [
        level ? el('span', { class: 'help-example-key' }, [level]) : '',
        code,
      ])
      box.appendChild(line)
    }
    if (box.childNodes.length) row('examples', box)
  }
  if (Array.isArray(meta.seeAlso) && meta.seeAlso.length) {
    row('see also', el('span', { class: 'help-see-also' }, [meta.seeAlso.join(' · ')]))
  }
  return card
}

// ── meta-command dispatcher ──────────────────────────────────────────
//
// Wave 3 extends the vocabulary: `,console`, `,stack`, `,help`.

async function handleMetaCommand(src) {
  const s = src.trim()
  if (!s.startsWith(',')) return false
  const m = s.match(/^,(\w[\w!?/*+-]*)\s*(.*)$/)
  if (!m) return false
  const cmd = m[1]
  const arg = m[2].trim()
  if (cmd === 'help' || cmd === 'h') {
    if (!arg) {
      log('in', src)
      log('err', ',help <verb> — e.g. ,help circle')
      return true
    }
    log('in', src)
    try {
      const r = await api('/api/help?verb=' + encodeURIComponent(arg))
      if (r && r.ok && r.meta) logNode(renderHelpCard(r.meta))
      else log('err', (r && r.error) || `no help for ${arg}`)
    } catch (e) {
      log('err', 'help failed: ' + (e && e.message))
    }
    return true
  }
  if (cmd === 'console') {
    log('in', src)
    if (!state.consoleOpen) toggleConsole()
    log('out', 'fantasy console: ' + (state.consoleOpen ? 'open' : 'closed'))
    return true
  }
  if (cmd === 'stack') {
    log('in', src)
    if (!state.stackOpen) toggleStack()
    log('out', 'stack panel: ' + (state.stackOpen ? 'open' : 'closed'))
    return true
  }
  return false
}

// ── tab machinery ────────────────────────────────────────────────────

function openTab(spec) {
  if (spec.kind === 'chapter') {
    const existing = state.tabs.find((t) =>
      t.kind === 'chapter' && t.book === spec.book && t.chapter === spec.chapter)
    if (existing) return activateTab(existing.id)
  }
  const tab = {
    id: nextTabId++,
    kind: spec.kind,
    title: spec.title || '(untitled)',
    content: spec.content || '',
    chapter: spec.chapter,
    book: spec.book,
    blockOutputs: {},  // idx → { ok, value, stdout, error }
  }
  state.tabs.push(tab)
  state.activeTabId = tab.id
  renderTabs()
  renderEditor()
}

function activateTab(id) {
  state.activeTabId = id
  renderTabs()
  renderEditor()
}

function closeTab(id) {
  const idx = state.tabs.findIndex((t) => t.id === id)
  if (idx < 0) return
  state.tabs.splice(idx, 1)
  if (state.activeTabId === id) {
    state.activeTabId = state.tabs.length > 0 ? state.tabs[Math.max(0, idx - 1)].id : null
  }
  renderTabs()
  renderEditor()
}

function closeOthers(id) {
  state.tabs = state.tabs.filter((t) => t.id === id)
  state.activeTabId = id
  renderTabs()
  renderEditor()
}
function closeAll() {
  state.tabs = []
  state.activeTabId = null
  renderTabs()
  renderEditor()
}

function activeTab() {
  return state.tabs.find((t) => t.id === state.activeTabId) || null
}

// ── movable tabs ─────────────────────────────────────────────────────
//
// Native HTML5 drag-and-drop. Every tab is draggable; on drop we move
// the source tab before/after the target based on where the cursor
// crossed the horizontal midpoint of the target. Order persists in
// localStorage keyed by tab title so a page reload keeps intent.

function tabDragStart(t, e) {
  state.drag.tabId = t.id
  try { e.dataTransfer.setData('text/plain', String(t.id)) } catch { /* ignore */ }
  e.dataTransfer.effectAllowed = 'move'
  e.currentTarget.classList.add('motoi-tab--dragging')
}
function tabDragEnd(_t, e) {
  e.currentTarget.classList.remove('motoi-tab--dragging')
  state.drag.tabId = null
  state.drag.dropTarget = null
  // Clear any dangling drop-indicator classes.
  for (const el of document.querySelectorAll('.motoi-tab')) {
    el.classList.remove('motoi-tab--drop-before', 'motoi-tab--drop-after')
  }
}
function tabDragOver(t, e) {
  e.preventDefault()
  const rect = e.currentTarget.getBoundingClientRect()
  const side = (e.clientX - rect.left) < rect.width / 2 ? 'before' : 'after'
  state.drag.dropTarget = { id: t.id, side }
  for (const el of document.querySelectorAll('.motoi-tab')) {
    el.classList.remove('motoi-tab--drop-before', 'motoi-tab--drop-after')
  }
  e.currentTarget.classList.add('motoi-tab--drop-' + side)
}
function tabDrop(t, e) {
  e.preventDefault()
  const src = state.drag.tabId
  if (src == null || src === t.id) return
  const srcIdx = state.tabs.findIndex((x) => x.id === src)
  if (srcIdx < 0) return
  const [moved] = state.tabs.splice(srcIdx, 1)
  const targetIdx = state.tabs.findIndex((x) => x.id === t.id)
  const insertAt = state.drag.dropTarget?.side === 'after' ? targetIdx + 1 : targetIdx
  state.tabs.splice(insertAt, 0, moved)
  renderTabs()
  saveTabOrder()
}
function saveTabOrder() {
  try {
    const order = state.tabs.map((t) => t.title)
    localStorage.setItem('motoi.tabOrder', JSON.stringify(order))
  } catch { /* ignore */ }
}

// Right-click / middle-click tab menu.
function tabContextMenu(t, e) {
  e.preventDefault()
  const menu = $('#tab-menu')
  if (!menu) return
  menu.innerHTML = ''
  const mkItem = (label, onclick) => menu.appendChild(el('div', {
    class: 'motoi-tab-menu__item',
    onClick: () => { menu.setAttribute('hidden', ''); onclick() },
  }, [label]))
  mkItem('Close', () => closeTab(t.id))
  mkItem('Close Others', () => closeOthers(t.id))
  menu.appendChild(el('div', { class: 'motoi-tab-menu__sep' }))
  mkItem('Close All', () => closeAll())
  menu.style.left = e.clientX + 'px'
  menu.style.top = e.clientY + 'px'
  menu.removeAttribute('hidden')
}
function hideTabMenu() { $('#tab-menu')?.setAttribute('hidden', '') }
document.addEventListener('click', hideTabMenu)

// ── rendering ────────────────────────────────────────────────────────

function renderTabs() {
  const bar = $('#tab-bar')
  bar.innerHTML = ''
  for (const t of state.tabs) {
    const cls = 'motoi-tab' + (t.id === state.activeTabId ? ' motoi-tab--active' : '')
    const tabEl = el('div', {
      class: cls,
      role: 'tab',
      draggable: 'true',
      onClick: (e) => {
        // Middle-click closes.
        if (e.button === 1) { closeTab(t.id); return }
        activateTab(t.id)
      },
      onAuxclick: (e) => { if (e.button === 1) { e.preventDefault(); closeTab(t.id) } },
      onContextmenu: (e) => tabContextMenu(t, e),
      onDragstart: (e) => tabDragStart(t, e),
      onDragend:   (e) => tabDragEnd(t, e),
      onDragover:  (e) => tabDragOver(t, e),
      onDrop:      (e) => tabDrop(t, e),
    }, [
      t.title,
      el('span', {
        class: 'close',
        title: 'close tab',
        onClick: (e) => { e.stopPropagation(); closeTab(t.id) },
      }, ['×']),
    ])
    bar.appendChild(tabEl)
  }
}

function renderEditor() {
  const area = $('#editor-area')
  area.innerHTML = ''
  const t = activeTab()
  if (!t) {
    area.appendChild(el('div', { class: 'motoi-editor-empty' }, [
      el('p', {}, ['Nothing open yet.']),
      el('p', {}, ['Click a chapter on the left, or type Scheme in the REPL on the right.']),
      el('p', { class: 'dim' }, ['Try ',
        el('code', {}, ['(+ 1 2)']), ' or ',
        el('code', {}, ['(cpu/boot!)']), ' or ',
        el('code', {}, ['(book-of-code/tutor)']), '.']),
    ]))
    return
  }
  if (t.kind === 'chapter') {
    area.appendChild(renderChapterView(t))
  } else if (t.kind === 'settings') {
    area.appendChild(renderSettingsView(t))
  } else {
    area.appendChild(renderEditableBuffer(t))
  }
}

// ── settings view ────────────────────────────────────────────────────

function renderSettingsView(t) {
  const wrap = el('div', { class: 'motoi-chapter' })
  wrap.appendChild(el('h1', {}, ['Settings']))

  wrap.appendChild(el('h2', {}, ['Editor mode']))
  const modeWrap = el('div', {}, [])
  for (const m of ['basic', 'vim', 'emacs']) {
    const btn = el('button', {
      class: 'motoi-run' + (state.editorMode === m ? ' motoi-run--on' : ''),
      onClick: () => { state.editorMode = m; localStorage.setItem('motoi.editorMode', m); renderEditor() },
    }, [m])
    modeWrap.appendChild(btn)
    modeWrap.appendChild(document.createTextNode(' '))
  }
  wrap.appendChild(modeWrap)
  wrap.appendChild(el('p', { class: 'dim' }, [
    'basic: Cmd/Ctrl+Enter runs code, F2 explains selection. ',
    'vim: type `:` to open a mini command line (`:explain`, `:w`, `:q`, `:pair-on`, `:pair-off`). ',
    'emacs: M-e explains selection.',
  ]))

  wrap.appendChild(el('h2', {}, ['Pair programming']))
  const pairWrap = el('div', {}, [])
  for (const m of ['off', 'user-drives', 'motoi-drives']) {
    const btn = el('button', {
      class: 'motoi-run' + (state.pairMode === m ? ' motoi-run--on' : ''),
      onClick: () => setPairMode(m),
    }, [m])
    pairWrap.appendChild(btn)
    pairWrap.appendChild(document.createTextNode(' '))
  }
  wrap.appendChild(pairWrap)
  wrap.appendChild(el('p', { class: 'dim' }, [
    'When pair mode is on, Motoi offers ambient completions after a 3-second pause. ',
    'Press Tab to accept, any other keystroke to dismiss. Use "motoi drives" for narrated turn-taking.',
  ]))

  wrap.appendChild(el('h2', {}, ['Palette']))
  wrap.appendChild(el('p', {}, [
    'Pink (dominant), mint / green (secondary), earth / brown (tertiary). ',
    'Framed panels, monospace throughout, terminal-in-browser aesthetic. ',
    'These stay locked (Alfred 2026-07-17).',
  ]))

  wrap.appendChild(el('h2', {}, ['Reading state']))
  const readingBox = el('pre', { id: 'reading-state-summary', class: 'motoi-cpu-display' }, ['loading…'])
  wrap.appendChild(readingBox)
  refreshReadingStateSummary()

  return wrap
}

async function refreshReadingStateSummary() {
  const box = $('#reading-state-summary')
  if (!box) return
  try {
    const r = await api('/api/reading-state')
    if (!r.ok) { box.textContent = 'no reading-state yet.'; return }
    const s = r.state || {}
    const lines = []
    lines.push('file: ' + (s.path || '~/.motoi/reading-state.slat'))
    lines.push('bookmarks: ' + (s.bookmarks || []).join(', ') || '(none)')
    lines.push('highlights: ' + (s['highlight-count'] || 0))
    lines.push('session log: ' + (s['session-log-size'] || 0) + ' entries')
    lines.push('chapters read:')
    for (const c of s.chapters || []) {
      lines.push(`  · ${c.book} · ch ${c.chapter}  — ${c['section-count'] || 0} sections`)
    }
    box.textContent = lines.join('\n')
  } catch (e) {
    box.textContent = 'error: ' + e.message
  }
}

function renderEditableBuffer(t) {
  // A wrapper so we can host the floating run-overlay next to the textarea.
  const wrap = el('div', { class: 'motoi-editor-wrap', style: 'position:relative;width:100%;height:100%' })
  const ta = el('textarea', {
    class: 'motoi-editor',
    spellcheck: 'false',
    'data-tab-id': String(t.id),
    onFocus: () => setFocused('editor'),
  })
  ta.value = t.content
  ta.addEventListener('input', () => {
    t.content = ta.value
    t.dirty = true
    schedulePauseCompletion(ta)
  })
  ta.addEventListener('keydown', async (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      runSelectionOrAll(ta)
      return
    }
    if (e.key === 'F2') {
      e.preventDefault()
      await explainSelection(ta)
      return
    }
    if (state.editorMode === 'emacs' && e.altKey && e.key === 'e') {
      e.preventDefault()
      await explainSelection(ta)
      return
    }
    if (state.editorMode === 'vim' && e.key === ':' && !e.altKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault()
      const cmd = prompt(':')
      if (cmd === 'explain') await explainSelection(ta)
      else if (cmd === 'w') { log('out', 'saved (in-session only).') }
      else if (cmd === 'q') closeTab(state.activeTabId)
      else if (cmd === 'pair-on')  { setPairMode('user-drives') }
      else if (cmd === 'pair-off') { setPairMode('off') }
      else if (cmd && cmd.length) log('err', `unknown command: :${cmd}`)
      return
    }
    if (e.key === 'Tab' && ghostVisible()) {
      e.preventDefault()
      acceptGhost(ta)
      return
    }
    dismissGhost()
  })
  wrap.appendChild(ta)
  // Floating run-overlay (used by Run form under cursor). Hidden by default.
  wrap.appendChild(el('div', { id: `run-overlay-${t.id}`, class: 'motoi-run-overlay', hidden: '' }))
  return wrap
}

function renderChapterView(t) {
  const wrap = el('div', { class: 'motoi-chapter' })
  const data = t.chapterData || {}
  const title = data.title || t.title || 'Chapter'
  wrap.appendChild(el('h1', {}, [title]))

  const sections = Array.isArray(data.sections) ? data.sections : []
  const codeBlocks = Array.isArray(data.codeBlocks) ? data.codeBlocks
                     : (Array.isArray(data['code-blocks']) ? data['code-blocks'] : [])

  // Give each rendered code-block a stable index so its inline output
  // reattaches cleanly on re-render.
  let blockIdx = 0
  const nextIdx = () => blockIdx++

  if (sections.length > 0) {
    for (const s of sections) {
      if (s.heading) wrap.appendChild(el('h2', {}, [s.heading]))
      if (s.body) renderInlineProse(wrap, s.body, t, nextIdx)
    }
  } else if (data.prose) {
    renderInlineProse(wrap, data.prose, t, nextIdx)
  }

  if (codeBlocks.length > 0) {
    wrap.appendChild(el('h2', {}, ['Runnable Scheme']))
    codeBlocks.forEach((src, i) => {
      wrap.appendChild(makeCodeBlock(src, `block ${i + 1}`, t, nextIdx()))
    })
  }
  return wrap
}

function renderInlineProse(root, prose, t, nextIdx) {
  const parts = String(prose).split(/```scheme\s*\n([\s\S]*?)\n```/g)
  parts.forEach((chunk, i) => {
    if (i % 2 === 0) {
      const paras = chunk.split(/\n\n+/)
      for (const p of paras) {
        const text = p.trim()
        if (!text) continue
        if (/^##\s/.test(text)) root.appendChild(el('h2', {}, [text.replace(/^##\s*/, '')]))
        else if (/^#\s/.test(text)) { /* skip; chapter h1 already rendered */ }
        else root.appendChild(el('p', {}, [text]))
      }
    } else {
      root.appendChild(makeCodeBlock(chunk, '', t, nextIdx()))
    }
  })
}

// A code block + inline output card. Pressing Run runs the block and
// renders result BELOW the block (not into the REPL). Result includes
// stdout, return value, and any error.
function makeCodeBlock(src, label, tab, blockIndex) {
  const wrap = el('div', { class: 'motoi-code-block' })
  const pre = el('pre', {}, [src])
  wrap.appendChild(pre)
  const outputBox = el('div', {
    class: 'motoi-inline-output',
    id: `inline-output-${tab.id}-${blockIndex}`,
    hidden: '',
  })
  wrap.appendChild(el('button', {
    class: 'motoi-run',
    title: 'Run this block' + (label ? ' — ' + label : ''),
    onClick: async () => {
      wrap.classList.add('motoi-code-block--has-output')
      await runIntoInlineBox(src, outputBox, label)
    },
  }, ['Run']))
  wrap.appendChild(outputBox)
  // Restore prior output if we've re-rendered.
  const cached = tab.blockOutputs?.[blockIndex]
  if (cached) {
    fillInlineBox(outputBox, cached, label)
    wrap.classList.add('motoi-code-block--has-output')
  }
  return wrap
}

function fillInlineBox(box, r, label) {
  box.innerHTML = ''
  box.removeAttribute('hidden')
  if (label) box.appendChild(el('div', { class: 'motoi-inline-output__label' }, [label]))
  if (r.stdout) {
    box.appendChild(el('div', {
      class: 'motoi-inline-output__line line-stdout',
    }, [r.stdout.replace(/\n$/, '')]))
  }
  if (r.ok) {
    if (r.value !== '' && r.value != null) {
      box.appendChild(el('div', {
        class: 'motoi-inline-output__line line-out',
      }, [String(r.value)]))
    } else if (!r.stdout) {
      // Empty result + no stdout: hint the run succeeded.
      box.appendChild(el('div', {
        class: 'motoi-inline-output__line line-out',
      }, ['ok.']))
    }
  } else {
    box.appendChild(el('div', {
      class: 'motoi-inline-output__line line-err',
    }, ['error: ' + (r.error || 'unknown')]))
  }
}

async function runIntoInlineBox(src, box, label) {
  if (!src || !src.trim()) return
  // Meta-commands still flow through the REPL for now.
  if (await handleMetaCommand(src)) return
  // Also mirror to REPL so the session log stays complete.
  log('in', src)
  setMode('running')
  const r = await apiEval(src)
  setMode('editing')
  if (r.stdout) log('stdout', r.stdout.replace(/\n$/, ''))
  if (r.ok) {
    if (r.value !== '' && r.value != null) log('out', r.value)
  } else {
    log('err', 'error: ' + r.error)
  }
  const t = activeTab()
  if (t && box.id) {
    // Cache by block index for re-render survival.
    const m = box.id.match(/inline-output-(\d+)-(\d+)/)
    if (m) {
      const bIdx = Number(m[2])
      t.blockOutputs = t.blockOutputs || {}
      t.blockOutputs[bIdx] = r
    }
  }
  fillInlineBox(box, r, label)
  if (state.consoleOpen) startCanvasLoop()   // ensure first frame renders
  if (state.stackOpen) refreshStackOnce()
  if (state.cpuOpen) refreshCpu()
}

// ── running Scheme (REPL path, unchanged from Wave 2) ───────────────

async function runSource(source, label) {
  if (!source || !source.trim()) return
  if (await handleMetaCommand(source)) return
  log('in', source)
  setMode('running')
  const r = await apiEval(source)
  setMode('editing')
  if (r.stdout) log('stdout', r.stdout.replace(/\n$/, ''))
  if (r.ok) {
    if (r.value !== '' && r.value != null) log('out', r.value)
  } else {
    log('err', 'error: ' + r.error)
  }
  if (state.cpuOpen) refreshCpu()
  if (state.stackOpen) refreshStackOnce()
}

function runSelectionOrAll(ta) {
  const start = ta.selectionStart
  const end = ta.selectionEnd
  let src
  if (start !== end) src = ta.value.slice(start, end)
  else src = currentFormAt(ta.value, start)
  if (src && src.trim()) {
    // Show floating overlay for editable buffers so the kid sees output
    // right under where they were typing. REPL still gets the session
    // mirror (via runSource → runSourceIntoOverlay).
    runSourceIntoOverlay(src, ta)
  }
}

async function runSourceIntoOverlay(src, ta) {
  const t = activeTab()
  if (!t) { runSource(src); return }
  const overlay = document.getElementById(`run-overlay-${t.id}`)
  if (!overlay) { runSource(src); return }
  // Position overlay near the current caret line (best effort: below the
  // cursor's visible row). We rely on scrollTop + character metrics; if
  // the exact position is off, the overlay is still readable.
  const rect = ta.getBoundingClientRect()
  const parentRect = ta.parentElement.getBoundingClientRect()
  const wrapperTop = rect.top - parentRect.top
  const line = ta.value.slice(0, ta.selectionStart).split('\n').length
  const lineHeight = 1.5 * 14
  const y = wrapperTop + Math.max(24, Math.min(line * lineHeight - ta.scrollTop, rect.height - 40))
  overlay.style.top = `${y}px`
  overlay.style.left = '16px'
  overlay.removeAttribute('hidden')
  overlay.innerHTML = '<div class="motoi-inline-output__label">running…</div>'
  log('in', src)
  setMode('running')
  const r = await apiEval(src)
  setMode('editing')
  if (r.stdout) log('stdout', r.stdout.replace(/\n$/, ''))
  if (r.ok) {
    if (r.value !== '' && r.value != null) log('out', r.value)
  } else {
    log('err', 'error: ' + r.error)
  }
  fillInlineBox(overlay, r, 'form')
  if (state.cpuOpen) refreshCpu()
  if (state.stackOpen) refreshStackOnce()
  if (state.consoleOpen) startCanvasLoop()
  // Auto-dismiss overlay after 6 seconds unless clicked.
  clearTimeout(runSourceIntoOverlay._t)
  runSourceIntoOverlay._t = setTimeout(() => overlay.setAttribute('hidden', ''), 6000)
  overlay.addEventListener('click', () => overlay.setAttribute('hidden', ''), { once: true })
}

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

// ── fantasy console (Wave 3) ─────────────────────────────────────────
//
// rAF-driven loop polls /api/canvas at up to ~30 fps (throttled). Each
// response carries a base64 palette-indexed byte array + palette; we
// translate into an ImageData and blit at 1:1 into a hidden pixel canvas,
// then let CSS scale it (image-rendering: pixelated) up to the bezel
// size. Zero blur, integer upscale, honest pixels.

const CANVAS_MS = 33   // ~30 fps
let _pixelBuf = null   // Uint8ClampedArray reused across frames
let _pixelBufSize = 0

async function canvasTick() {
  if (!state.consoleOpen) return
  const now = performance.now()
  if (now - state.canvas.lastFetch < CANVAS_MS) {
    state.canvas.rafId = requestAnimationFrame(canvasTick)
    return
  }
  state.canvas.lastFetch = now
  try {
    const r = await fetch('/api/canvas')
    if (r.ok) {
      const data = await r.json()
      if (data && data.ok) blitFramebuffer(data)
    }
  } catch { /* soft-fail — try again next tick */ }
  state.canvas.rafId = requestAnimationFrame(canvasTick)
}

function blitFramebuffer(data) {
  const canvas = document.getElementById('fantasy-canvas')
  if (!canvas) return
  const { w, h, palette, pixels } = data
  if (canvas.width !== w) canvas.width = w
  if (canvas.height !== h) canvas.height = h
  state.canvas.dims = { w, h }
  state.canvas.palette = palette
  // Decode base64 → Uint8Array (palette indices).
  const bin = atob(pixels)
  const nPx = w * h
  const rgbaSize = nPx * 4
  if (!_pixelBuf || _pixelBufSize !== rgbaSize) {
    _pixelBuf = new Uint8ClampedArray(rgbaSize)
    _pixelBufSize = rgbaSize
  }
  // Expand each palette index into RGBA.
  for (let i = 0; i < nPx; i++) {
    const idx = bin.charCodeAt(i) & 0xff
    const pi = palette[idx] || [0, 0, 0, 255]
    const off = i * 4
    _pixelBuf[off]     = pi[0]
    _pixelBuf[off + 1] = pi[1]
    _pixelBuf[off + 2] = pi[2]
    _pixelBuf[off + 3] = pi[3] == null ? 255 : pi[3]
  }
  const ctx = canvas.getContext('2d')
  const img = new ImageData(_pixelBuf, w, h)
  ctx.putImageData(img, 0, 0)
  const loader = document.getElementById('console-loader')
  if (loader) loader.setAttribute('hidden', '')
  const dimEl = document.getElementById('console-dim')
  if (dimEl) dimEl.textContent = `${w}×${h}`
}

function startCanvasLoop() {
  if (state.canvas.rafId != null) return
  const loader = document.getElementById('console-loader')
  if (loader) loader.removeAttribute('hidden')
  state.canvas.rafId = requestAnimationFrame(canvasTick)
}
function stopCanvasLoop() {
  if (state.canvas.rafId != null) cancelAnimationFrame(state.canvas.rafId)
  state.canvas.rafId = null
}

function toggleConsole() {
  state.consoleOpen = !state.consoleOpen
  const panel = document.querySelector('.motoi-panel--console')
  const grid  = $('.motoi-ide')
  if (state.consoleOpen) {
    panel.removeAttribute('hidden')
    grid.classList.add('motoi-console-open')
    startCanvasLoop()
    try { localStorage.setItem('motoi.consoleOpen', '1') } catch { /* ignore */ }
  } else {
    panel.setAttribute('hidden', '')
    grid.classList.remove('motoi-console-open')
    stopCanvasLoop()
    try { localStorage.removeItem('motoi.consoleOpen') } catch { /* ignore */ }
  }
}

// ── stack panel (Wave 3) ─────────────────────────────────────────────
//
// Polls /api/stack at ~10 fps when open. When idle (no frames live) we
// automatically fall back to `which=peak` so the panel shows the last
// eval's peak stack instead of a blank list.

const STACK_MS = 100

async function refreshStackOnce() {
  if (!state.stackOpen) return
  try {
    // Try live first. If empty, ask for peak.
    let r = await api('/api/stack?which=live')
    if (r.ok && (!r.frames || r.frames.length === 0)) {
      r = await api('/api/stack?which=peak')
    }
    if (!r.ok) return
    state.stack.frames = r.frames || []
    state.stack.depth = r.depth || 0
    state.stack.which = r.which || 'live'
    state.stack.idle  = !!r.idle
    renderStack()
  } catch { /* soft-fail — try next tick */ }
}

function startStackLoop() {
  stopStackLoop()
  state.stack.timer = setInterval(refreshStackOnce, STACK_MS)
  refreshStackOnce()
}
function stopStackLoop() {
  if (state.stack.timer) clearInterval(state.stack.timer)
  state.stack.timer = null
}

function renderStack() {
  const list = $('#stack-list')
  if (!list) return
  const dimEl = $('#stack-mode')
  if (dimEl) dimEl.textContent = (state.stack.idle ? 'idle · peak' : 'live') + ` · d=${state.stack.depth}`
  list.innerHTML = ''
  if (!state.stack.frames.length) {
    list.appendChild(el('div', { class: 'motoi-stack-loading' }, [
      'nothing on the stack yet. Run some Scheme to see frames.',
    ]))
    return
  }
  const frames = state.stack.frames
  const active = frames[0]  // deepest is top-of-list per motoi/stack contract
  frames.forEach((f, i) => {
    const depth = typeof f.depth === 'number' ? f.depth : (frames.length - i)
    const isActive = i === 0
    const indent = Math.min(depth - 1, 12) * 2  // cap indent at 24 chars
    const cls = 'motoi-stack-frame' + (isActive ? ' motoi-stack-frame--active' : '')
    // Fade deeper (older) frames toward cedar-dark by opacity.
    const style = isActive ? '' : `opacity:${Math.max(0.45, 1 - (i * 0.06))}`
    const head = String(f.name ?? f.head ?? '?')
    const kind = f.kind ? ` :${f.kind}` : ''
    list.appendChild(el('div', { class: cls, style }, [
      el('span', { class: 'motoi-stack-frame__depth' }, [`d=${depth}`]),
      el('span', {
        class: 'motoi-stack-frame__head',
        style: `padding-left:${indent}ch`,
      }, [head + kind]),
    ]))
  })
  if (state.stack.depth > frames.length) {
    list.appendChild(el('div', { class: 'motoi-stack-more' }, [
      `… + ${state.stack.depth - frames.length} more frames (deeper)`,
    ]))
  }
  // Suppress unused-var lint for `active` — kept for future highlight logic.
  void active
}

function toggleStack() {
  state.stackOpen = !state.stackOpen
  const panel = document.getElementById('stack-panel')
  const grid  = $('.motoi-ide')
  if (state.stackOpen) {
    panel.removeAttribute('hidden')
    grid.classList.add('motoi-stack-open')
    startStackLoop()
    try { localStorage.setItem('motoi.stackOpen', '1') } catch { /* ignore */ }
  } else {
    panel.setAttribute('hidden', '')
    grid.classList.remove('motoi-stack-open')
    stopStackLoop()
    try { localStorage.removeItem('motoi.stackOpen') } catch { /* ignore */ }
  }
}

// ── header actions ───────────────────────────────────────────────────

function setupHeader() {
  $('#btn-run-all').addEventListener('click', () => {
    const t = activeTab()
    if (!t || t.kind !== 'buffer') {
      log('err', 'Open a buffer tab first (or click Run on a chapter block).')
      return
    }
    runSource(t.content)
  })
  $('#btn-run-selection').addEventListener('click', () => {
    const t = activeTab()
    if (!t || t.kind !== 'buffer') return
    const ta = document.querySelector(`textarea.motoi-editor[data-tab-id="${t.id}"]`)
    if (!ta) return
    runSelectionOrAll(ta)
  })
  $('#btn-boot-cpu').addEventListener('click', async () => {
    await runSource('(cpu/boot!)', 'boot')
    if (!state.cpuOpen) toggleCpu()
    refreshCpu()
  })
  $('#btn-toggle-cpu').addEventListener('click', toggleCpu)
  $('#btn-toggle-console').addEventListener('click', toggleConsole)
  $('#btn-toggle-stack').addEventListener('click', toggleStack)
  $('#btn-explain').addEventListener('click', async () => {
    const t = activeTab()
    if (!t || t.kind !== 'buffer') { log('err', 'Open a buffer + select code, then click Explain (F2).'); return }
    const ta = document.querySelector(`textarea.motoi-editor[data-tab-id="${t.id}"]`)
    if (!ta) return
    await explainSelection(ta)
  })
  $('#btn-pair-toggle').addEventListener('click', () => {
    const next = state.pairMode === 'off' ? 'user-drives'
              : state.pairMode === 'user-drives' ? 'motoi-drives'
              : 'off'
    setPairMode(next)
  })
  $('#btn-settings').addEventListener('click', openSettings)

  // Click-anywhere focus indicator.
  document.querySelectorAll('.motoi-panel[data-focus-key]').forEach((panel) => {
    panel.addEventListener('mousedown', () => setFocused(panel.dataset.focusKey))
    panel.addEventListener('focusin',   () => setFocused(panel.dataset.focusKey))
  })
}

// ── F-key parity with TUI (F1 help · F2 explain · F4 CPU · F5 pair · F6 focus)
//
// The TUI wires these globally; the IDE also needs them globally so the
// ,help corpus doesn't lie. F2 in the editor already handles explain-at-
// cursor; the global handler covers header-focused / REPL-focused cases.

function setupGlobalKeys() {
  document.addEventListener('keydown', async (e) => {
    if (e.key === 'F1') {
      e.preventDefault()
      // Open help — for now, a compact keybinding cheatsheet in the REPL.
      log('out', 'F1 help · F2 explain · F4 CPU · F5 pair · F6 focus cycle · Cmd/Ctrl+Enter run · Tab accept ghost · ,console ,stack ,help <verb>')
      return
    }
    if (e.key === 'F4') { e.preventDefault(); toggleCpu(); return }
    if (e.key === 'F5') {
      e.preventDefault()
      const next = state.pairMode === 'off' ? 'user-drives'
                : state.pairMode === 'user-drives' ? 'motoi-drives'
                : 'off'
      setPairMode(next)
      return
    }
    if (e.key === 'F6') { e.preventDefault(); cycleFocus(); return }
    // F2 in the editor is handled at the textarea; here we cover the
    // global case (focus in REPL / header) so the key doesn't feel dead.
    if (e.key === 'F2') {
      const t = activeTab()
      if (!t || t.kind !== 'buffer') return
      const ta = document.querySelector(`textarea.motoi-editor[data-tab-id="${t.id}"]`)
      if (!ta) return
      // Only trigger from global if the editor doesn't have focus (it'd
      // handle F2 itself).
      if (document.activeElement !== ta) {
        e.preventDefault()
        await explainSelection(ta)
      }
    }
  })
}

// ── pair-programming (Wave 2, preserved) ─────────────────────────────

async function setPairMode(mode) {
  state.pairMode = mode
  const btn = $('#btn-pair-toggle')
  if (btn) btn.textContent = 'Pair: ' + mode
  try {
    const r = await api('/api/pair/mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    })
    if (r.value) log('out', r.value)
  } catch (e) { log('err', 'pair mode error: ' + e.message) }
}

async function explainSelection(ta) {
  const start = ta.selectionStart
  const end = ta.selectionEnd
  let source = ''
  if (start !== end) source = ta.value.slice(start, end)
  else source = currentFormAt(ta.value, start)
  if (!source.trim()) { log('err', 'Nothing highlighted — select some Scheme first.'); return }
  try {
    await api('/api/highlight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: source, context: 'F2 explain' }),
    })
  } catch { /* soft-fail */ }
  try {
    const r = await api('/api/pair/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source }),
    })
    if (r.stdout) log('stdout', r.stdout)
    if (r.value) log('out', String(r.value).replace(/^"|"$/g, ''))
    else if (r.error) log('err', 'error: ' + r.error)
  } catch (e) { log('err', 'explain error: ' + e.message) }
}

// ── ghost-text ambient completions (Wave 2, preserved) ───────────────

const GHOST_PAUSE_MS = 3000
let ghostCurrent = null

function schedulePauseCompletion(ta) {
  if (state.pairMode === 'off') return
  clearTimeout(state.ambientTimer)
  state.ambientTimer = setTimeout(() => triggerAmbient(ta), GHOST_PAUSE_MS)
}

async function triggerAmbient(ta) {
  const pos = ta.selectionStart
  const before = ta.value.slice(0, pos)
  const m = before.match(/([a-zA-Z0-9\-_/?!*+.<>=]+)$/)
  if (!m) return
  const prefix = m[1]
  if (prefix.length < 2) return
  state.lastAmbientPrefix = prefix
  try {
    const r = await api('/api/pair/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix }),
    })
    if (!r.ok) return
    const nameM = String(r.value).match(/:name\s+"?([a-zA-Z0-9\-_/?!*+.<>=]+)"?/)
    if (!nameM) return
    const candidate = nameM[1]
    if (!candidate.startsWith(prefix) || candidate === prefix) return
    showGhost(ta, candidate.slice(prefix.length), pos)
  } catch { /* silent */ }
}

function showGhost(ta, text, pos) {
  const ov = $('#ghost-overlay')
  if (!ov) return
  ov.textContent = text
  ov.removeAttribute('hidden')
  const rect = ta.getBoundingClientRect()
  ov.style.left  = (rect.left + 12) + 'px'
  ov.style.top   = (rect.top + 12) + 'px'
  ghostCurrent = { text, pos, ta }
}

function ghostVisible() {
  return ghostCurrent !== null && !$('#ghost-overlay').hasAttribute('hidden')
}

function acceptGhost(ta) {
  if (!ghostCurrent) return
  const { text, pos } = ghostCurrent
  ta.value = ta.value.slice(0, pos) + text + ta.value.slice(pos)
  ta.selectionStart = ta.selectionEnd = pos + text.length
  const t = activeTab()
  if (t) t.content = ta.value
  dismissGhost()
}

function dismissGhost() {
  const ov = $('#ghost-overlay')
  if (ov) ov.setAttribute('hidden', '')
  ghostCurrent = null
}

// ── settings tab open ────────────────────────────────────────────────

function openSettings() {
  const existing = state.tabs.find((t) => t.kind === 'settings')
  if (existing) return activateTab(existing.id)
  openTab({ kind: 'settings', title: 'settings', content: '' })
}

function toggleCpu() {
  state.cpuOpen = !state.cpuOpen
  const panel = $('#cpu-panel')
  const grid = $('.motoi-ide')
  if (state.cpuOpen) {
    panel.removeAttribute('hidden')
    grid.classList.add('motoi-cpu-open')
    refreshCpu()
  } else {
    panel.setAttribute('hidden', '')
    grid.classList.remove('motoi-cpu-open')
  }
}

async function refreshCpu() {
  try {
    const r = await api('/api/cpu')
    if (r.ok && r.display) $('#cpu-display').textContent = r.display
    else $('#cpu-display').textContent = 'CPU not booted yet — click Boot CPU.'
  } catch (e) {
    $('#cpu-display').textContent = 'CPU fetch error: ' + e.message
  }
}

// ── REPL form ────────────────────────────────────────────────────────

function setupRepl() {
  const form = $('#repl-form')
  const input = $('#repl-input')
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    const src = input.value
    if (!src.trim()) return
    input.value = ''
    runSource(src)
  })
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      form.dispatchEvent(new Event('submit'))
    }
  })
  input.addEventListener('focus', () => setFocused('repl'))
}

// ── file tree ────────────────────────────────────────────────────────

async function loadTree() {
  const root = $('#tree-root')
  root.innerHTML = ''
  const booksResp = await api('/api/books')
  const books = (booksResp && booksResp.value) || []
  state.books = books

  root.appendChild(el('div', {
    class: 'motoi-tree-node motoi-tree-book',
    onClick: () => openNewBuffer(),
  }, ['+ new buffer']))

  for (const slug of books) {
    const bookNode = el('div', {
      class: 'motoi-tree-node motoi-tree-book',
    }, [slug])
    root.appendChild(bookNode)
    if (slug === 'code') {
      await loadTocInto(root, slug)
    } else {
      bookNode.addEventListener('click', async () => {
        if (bookNode.dataset.expanded === 'yes') return
        bookNode.dataset.expanded = 'yes'
        await loadTocInto(root, slug, bookNode)
      })
    }
  }
}

async function loadTocInto(root, slug, afterNode) {
  const r = await api('/api/toc?book=' + encodeURIComponent(slug))
  const toc = (r && r.value) || []
  state.chapters[slug] = toc
  const nodes = []
  toc.forEach((title, idx) => {
    const chNum = idx + 1
    const node = el('div', {
      class: 'motoi-tree-node motoi-tree-chapter',
      onClick: () => openChapterTab(slug, chNum, title),
    }, [
      el('span', { class: 'chnum' }, [String(chNum).padStart(2)]),
      String(title),
    ])
    nodes.push(node)
  })
  if (afterNode) {
    let cursor = afterNode
    for (const n of nodes) {
      cursor.after(n)
      cursor = n
    }
  } else {
    for (const n of nodes) root.appendChild(n)
  }
}

async function openChapterTab(book, chapter, title) {
  const r = await api(`/api/chapter?book=${encodeURIComponent(book)}&n=${chapter}`)
  const data = (r && r.value) || {}
  openTab({
    kind: 'chapter',
    title: `${book} · ch ${chapter}`,
    book, chapter,
    chapterData: data,
  })
  const t = state.tabs[state.tabs.length - 1]
  if (t) t.chapterData = data
  renderEditor()
}

let bufferCount = 0
function openNewBuffer(seed) {
  bufferCount++
  openTab({
    kind: 'buffer',
    title: `buffer ${bufferCount}`,
    content: seed || '; Motoi Scheme scratch buffer\n; select code + Cmd/Ctrl+Enter to run\n\n(+ 1 2)\n',
  })
}

// ── boot ─────────────────────────────────────────────────────────────

async function boot() {
  try {
    const m = localStorage.getItem('motoi.editorMode')
    if (m === 'vim' || m === 'emacs' || m === 'basic') state.editorMode = m
  } catch { /* private mode */ }

  setupHeader()
  setupRepl()
  setupGlobalKeys()
  setFocused('editor')
  setMode('editing')
  await loadTree()

  log('out', 'Motoi Scheme IDE ready. Click a chapter on the left, or type at the REPL.')
  log('out', 'Try: (book-of-code/tutor) — Motoi will walk you through the book.')
  log('out', 'Fantasy Console button (or ,console) opens the 80×80 pixel screen. Stack button shows call frames.')

  openNewBuffer()

  // Restore prior open panels.
  try {
    if (localStorage.getItem('motoi.consoleOpen') === '1') toggleConsole()
    if (localStorage.getItem('motoi.stackOpen')   === '1') toggleStack()
  } catch { /* ignore */ }
}

// ─────────────────────────────────────────────────────────────────
// WAVE 4 — Marcus 2026-07-19
// Splash · Mode toggle · Hacker overlay · Widget tab types ·
// Cart save/load · View menu.
// Everything ADDITIVE — no prior behavior removed.
// ─────────────────────────────────────────────────────────────────

// ── SPLASH (Deliverable 1) ───────────────────────────────────────
//
// First-launch retro boot. ~500ms stripe-draw animation, then wait
// for user click/key. 4s auto-dismiss. Chime plays deterministically
// via the audio driver at 660/880 Hz (0.15s each) — never LLM.
// Skipped on subsequent boots unless URL has ?splash or user typed
// `,splash` (handled in meta-command dispatcher).

const SPLASH_SEEN_KEY = 'motoi.splash.seen'
let _splashDismissed = false

async function showSplash({ force = false } = {}) {
  if (_splashDismissed) return
  let seen = false
  try { seen = localStorage.getItem(SPLASH_SEEN_KEY) === '1' } catch { /* private mode */ }
  const url = new URL(window.location.href)
  const flag = url.searchParams.has('splash')
  if (!force && !flag && seen) return

  const splash = document.getElementById('splash')
  if (!splash) return
  splash.removeAttribute('hidden')

  // Draw stripes on next frame so the width-0 → width-100% transition fires.
  requestAnimationFrame(() => {
    splash.classList.add('motoi-splash--drawn')
  })

  // Chime — DETERMINISTIC audio via the runtime `tone` verb.
  // Doctrine [[deterministic-audio-no-llm-2026-07-19]]: sound bytes
  // synthesized by lib/audio/audio-driver.js, never LLM output.
  try {
    await apiEval('(tone 660 0.15)')
    await apiEval('(tone 880 0.15)')
  } catch { /* soft-fail — splash still dismissible without audio */ }

  const done = () => dismissSplash()

  const onKey = () => { window.removeEventListener('keydown', onKey); done() }
  const onClick = () => { splash.removeEventListener('click', onClick); done() }
  window.addEventListener('keydown', onKey, { once: true })
  splash.addEventListener('click', onClick, { once: true })
  setTimeout(done, 4000)
}

function dismissSplash() {
  if (_splashDismissed) return
  _splashDismissed = true
  const splash = document.getElementById('splash')
  if (!splash) return
  splash.classList.add('motoi-splash--fading')
  setTimeout(() => splash.setAttribute('hidden', ''), 260)
  try { localStorage.setItem(SPLASH_SEEN_KEY, '1') } catch { /* ignore */ }
}

// ── MODE TOGGLE (Deliverable 2) ──────────────────────────────────
//
// Top-level: IDE vs Fantasy Console. Not overlapping. IDE mode is
// the classic 3-panel + optional canvas/stack/CPU. Fantasy Console
// mode centers the canvas; the code editor stays but shrinks; REPL
// slides down as a small overlay. Choice persisted to localStorage.

const MODE_KEY = 'motoi.topMode'
state.topMode = 'ide'   // 'ide' | 'fc'

function setTopMode(mode) {
  state.topMode = mode
  const ide = document.querySelector('.motoi-ide')
  if (mode === 'fc') {
    ide.classList.add('motoi-fc-mode')
    // Auto-open the canvas — the whole point of FC mode.
    if (!state.consoleOpen) toggleConsole()
  } else {
    ide.classList.remove('motoi-fc-mode')
  }
  const btnIde = document.getElementById('btn-mode-ide')
  const btnFc  = document.getElementById('btn-mode-fc')
  if (btnIde && btnFc) {
    btnIde.classList.toggle('motoi-mode-toggle__btn--active', mode === 'ide')
    btnFc.classList.toggle('motoi-mode-toggle__btn--active', mode === 'fc')
    btnIde.setAttribute('aria-checked', mode === 'ide' ? 'true' : 'false')
    btnFc.setAttribute('aria-checked', mode === 'fc' ? 'true' : 'false')
  }
  try { localStorage.setItem(MODE_KEY, mode) } catch { /* ignore */ }
}

// ── HACKER MODE (Deliverable 3) ──────────────────────────────────
//
// Overlay-only. Adds body.motoi-hacker → CSS variables swap to
// phosphor green + amber cursor. All existing classes unchanged.
// Persona shift: session flag `motoi/hacker-mode-on!` set on the
// eval env so the eval/ambient/explain paths know to suppress
// unsolicited output. If that verb doesn't exist yet (Motoi 5.0
// training pending), we set a client-side flag and gate ambient
// completions ourselves.

const HACKER_KEY = 'motoi.hackerMode'
state.hackerMode = false

async function toggleHacker() {
  state.hackerMode = !state.hackerMode
  document.body.classList.toggle('motoi-hacker', state.hackerMode)
  const btn = document.getElementById('btn-hacker')
  if (btn) btn.textContent = state.hackerMode ? 'Hacker: on' : 'Hacker'
  try { localStorage.setItem(HACKER_KEY, state.hackerMode ? '1' : '0') } catch { /* ignore */ }
  // Signal the runtime — best-effort. If the verb isn't defined
  // (pre-Motoi-5.0), the eval quietly errors and we ignore it; the
  // client-side flag still gates ambient completions.
  try {
    const src = state.hackerMode ? '(motoi/hacker-mode-on!)' : '(motoi/hacker-mode-off!)'
    await apiEval(src)
  } catch { /* verb not present yet — client-side flag suffices */ }
  log('out', state.hackerMode
    ? 'hacker mode: on · motoi is silent unless asked'
    : 'hacker mode: off · motoi is chatty again')
}

// ── COMPOSER WIDGETS (Deliverable 4) ─────────────────────────────
//
// Every widget renders as a tab-type with a `data-tab-type`. Widgets
// carry their own state on the tab record. `emit` produces a Scheme
// form; `apply` restores widget state from a form. Both operations
// satisfy the round-trip identity contract at widget-level.
//
// For MVP each widget renders read/write UI as HTML; the emitted
// form is dropped into the cart's respective section slot when the
// cart is saved.

// Sprite Grid Editor — 8×8 palette-indexed. Tools: pencil, eyedropper,
// fill, mirror. Onion-skin ghost of previous frame.
function makeSpriteWidget(tab) {
  tab.widget = tab.widget || {
    kind: 'sprite-grid',
    w: 8, h: 8,
    pixels: Array.from({ length: 8 }, () => new Array(8).fill(0)),
    palette: DEFAULT_PALETTE.slice(),
    tool: 'pencil',
    color: 1,
    mirror: false,
    prevFrame: null,   // onion-skin
    undoStack: [],
    redoStack: [],
  }
  const w = tab.widget
  const wrap = el('div', { class: 'motoi-widget', 'data-tab-type': 'sprite-grid' })
  wrap.appendChild(el('div', { class: 'motoi-widget__head' }, [
    el('span', { class: 'motoi-widget__title' }, ['Sprite Grid']),
    el('span', { class: 'motoi-widget__hint' }, [`${w.w}×${w.h} · palette-indexed`]),
  ]))
  const tools = el('div', { class: 'motoi-widget__tools' })
  for (const t of ['pencil', 'eyedropper', 'fill', 'mirror']) {
    tools.appendChild(el('button', {
      class: 'motoi-widget__tool' + (w.tool === t ? ' motoi-widget__tool--active' : ''),
      onClick: () => { w.tool = t; renderEditor() },
    }, [t]))
  }
  tools.appendChild(el('button', {
    class: 'motoi-widget__tool',
    onClick: () => spriteUndo(w),
  }, ['undo']))
  tools.appendChild(el('button', {
    class: 'motoi-widget__tool',
    onClick: () => spriteRedo(w),
  }, ['redo']))
  wrap.appendChild(tools)
  // Palette strip
  const pal = el('div', { class: 'motoi-palette' })
  w.palette.forEach((rgba, i) => {
    const sw = el('div', {
      class: 'motoi-palette__swatch' + (w.color === i ? ' motoi-palette__swatch--active' : ''),
      style: `background: rgba(${rgba[0]},${rgba[1]},${rgba[2]},${(rgba[3] ?? 255) / 255})`,
      onClick: () => { w.color = i; renderEditor() },
    }, [el('span', { class: 'motoi-palette__swatch__idx' }, [String(i)])])
    pal.appendChild(sw)
  })
  wrap.appendChild(pal)
  // Grid
  const grid = el('div', {
    class: 'motoi-sprite-grid',
    style: `grid-template-columns: repeat(${w.w}, 1fr);`,
  })
  for (let r = 0; r < w.h; r++) {
    for (let c = 0; c < w.w; c++) {
      const pIdx = w.pixels[r][c]
      const rgba = w.palette[pIdx] || [0, 0, 0, 255]
      const cell = el('div', {
        class: 'motoi-sprite-cell',
        style: `background: rgba(${rgba[0]},${rgba[1]},${rgba[2]},${(rgba[3] ?? 255) / 255})`,
        onClick: () => spriteCellClick(w, r, c),
      })
      grid.appendChild(cell)
    }
  }
  wrap.appendChild(grid)
  wrap.appendChild(el('div', { class: 'motoi-widget__hint' }, [
    'Widget → cart :sprites slot. Emits (sprite N (bytes ...)).',
  ]))
  return wrap
}
function spritePushUndo(w) {
  w.undoStack.push(w.pixels.map((r) => r.slice()))
  if (w.undoStack.length > 40) w.undoStack.shift()
  w.redoStack.length = 0
}
function spriteUndo(w) {
  const prev = w.undoStack.pop()
  if (!prev) return
  w.redoStack.push(w.pixels.map((r) => r.slice()))
  w.pixels = prev
  renderEditor()
}
function spriteRedo(w) {
  const next = w.redoStack.pop()
  if (!next) return
  w.undoStack.push(w.pixels.map((r) => r.slice()))
  w.pixels = next
  renderEditor()
}
function spriteCellClick(w, r, c) {
  if (w.tool === 'eyedropper') {
    w.color = w.pixels[r][c]
    renderEditor()
    return
  }
  spritePushUndo(w)
  if (w.tool === 'fill') {
    spriteFloodFill(w, r, c, w.pixels[r][c], w.color)
  } else {
    // pencil / mirror
    w.pixels[r][c] = w.color
    if (w.tool === 'mirror') {
      w.pixels[r][w.w - 1 - c] = w.color
      w.pixels[w.h - 1 - r][c] = w.color
      w.pixels[w.h - 1 - r][w.w - 1 - c] = w.color
    }
  }
  renderEditor()
}
function spriteFloodFill(w, r, c, from, to) {
  if (from === to) return
  const q = [[r, c]]
  while (q.length) {
    const [rr, cc] = q.shift()
    if (rr < 0 || cc < 0 || rr >= w.h || cc >= w.w) continue
    if (w.pixels[rr][cc] !== from) continue
    w.pixels[rr][cc] = to
    q.push([rr + 1, cc], [rr - 1, cc], [rr, cc + 1], [rr, cc - 1])
  }
}

// Default 8-color palette. Deterministic, no LLM.
const DEFAULT_PALETTE = [
  [0, 0, 0, 255], [255, 255, 255, 255], [244, 160, 181, 255], [159, 227, 197, 255],
  [163, 113, 82, 255], [107, 74, 52, 255], [245, 236, 217, 255], [255, 184, 77, 255],
  [126, 255, 126, 255], [255, 126, 126, 255], [77, 204, 77, 255], [204, 143, 38, 255],
  [30, 30, 30, 255], [80, 80, 80, 255], [140, 140, 140, 255], [220, 220, 220, 255],
]

// Tile Map Editor
function makeTileWidget(tab) {
  tab.widget = tab.widget || {
    kind: 'tile-map',
    cols: 12, rows: 8,
    cells: {},   // { "c,r": tileIdx }
    tile: 1,
  }
  const w = tab.widget
  const wrap = el('div', { class: 'motoi-widget', 'data-tab-type': 'tile-map' })
  wrap.appendChild(el('div', { class: 'motoi-widget__head' }, [
    el('span', { class: 'motoi-widget__title' }, ['Tile Map']),
    el('span', { class: 'motoi-widget__hint' }, [`${w.cols}×${w.rows}`]),
  ]))
  const tools = el('div', { class: 'motoi-widget__tools' })
  tools.appendChild(el('span', {}, ['stamp tile: ']))
  for (let i = 0; i < 8; i++) {
    tools.appendChild(el('button', {
      class: 'motoi-widget__tool' + (w.tile === i ? ' motoi-widget__tool--active' : ''),
      onClick: () => { w.tile = i; renderEditor() },
    }, [String(i)]))
  }
  wrap.appendChild(tools)
  const grid = el('div', {
    class: 'motoi-tile-map',
    style: `grid-template-columns: repeat(${w.cols}, 1fr);`,
  })
  for (let r = 0; r < w.rows; r++) {
    for (let c = 0; c < w.cols; c++) {
      const v = w.cells[`${c},${r}`] || 0
      grid.appendChild(el('div', {
        class: 'motoi-tile-cell',
        onClick: () => { w.cells[`${c},${r}`] = w.tile; renderEditor() },
      }, [String(v)]))
    }
  }
  wrap.appendChild(grid)
  wrap.appendChild(el('div', { class: 'motoi-widget__hint' }, [
    'Widget → cart :tiles slot. Emits ((c r tile) ...).',
  ]))
  return wrap
}

// Timeline Scrubber
function makeTimelineWidget(tab) {
  tab.widget = tab.widget || {
    kind: 'timeline',
    frames: 16, current: 0, keyframes: [0, 8],
  }
  const w = tab.widget
  const wrap = el('div', { class: 'motoi-widget', 'data-tab-type': 'timeline' })
  wrap.appendChild(el('div', { class: 'motoi-widget__head' }, [
    el('span', { class: 'motoi-widget__title' }, ['Timeline']),
    el('span', { class: 'motoi-widget__hint' }, [`${w.frames} frames · frame ${w.current}`]),
  ]))
  const tools = el('div', { class: 'motoi-widget__tools' })
  tools.appendChild(el('button', {
    class: 'motoi-widget__tool',
    onClick: () => { w.current = Math.max(0, w.current - 1); renderEditor() },
  }, ['◀']))
  tools.appendChild(el('button', {
    class: 'motoi-widget__tool',
    onClick: () => { w.current = Math.min(w.frames - 1, w.current + 1); renderEditor() },
  }, ['▶']))
  tools.appendChild(el('button', {
    class: 'motoi-widget__tool',
    onClick: () => {
      if (w.keyframes.includes(w.current)) w.keyframes = w.keyframes.filter((k) => k !== w.current)
      else w.keyframes = [...w.keyframes, w.current].sort((a, b) => a - b)
      renderEditor()
    },
  }, ['toggle keyframe']))
  wrap.appendChild(tools)
  const tl = el('div', { class: 'motoi-timeline' })
  for (let i = 0; i < w.frames; i++) {
    const cls = 'motoi-timeline__frame'
      + (w.current === i ? ' motoi-timeline__frame--active' : '')
      + (w.keyframes.includes(i) ? ' motoi-timeline__frame--keyframe' : '')
    tl.appendChild(el('div', {
      class: cls,
      onClick: () => { w.current = i; renderEditor() },
    }, [String(i)]))
  }
  wrap.appendChild(tl)
  wrap.appendChild(el('div', { class: 'motoi-widget__hint' }, [
    'Widget → cart :music or :sprites slot depending on scope.',
  ]))
  return wrap
}

// Palette Designer
function makePaletteWidget(tab) {
  tab.widget = tab.widget || {
    kind: 'palette',
    colors: DEFAULT_PALETTE.slice(),
    active: 0,
  }
  const w = tab.widget
  const wrap = el('div', { class: 'motoi-widget', 'data-tab-type': 'palette' })
  wrap.appendChild(el('div', { class: 'motoi-widget__head' }, [
    el('span', { class: 'motoi-widget__title' }, ['Palette']),
    el('span', { class: 'motoi-widget__hint' }, [`${w.colors.length} colors · slot ${w.active}`]),
  ]))
  const pal = el('div', { class: 'motoi-palette' })
  w.colors.forEach((rgba, i) => {
    pal.appendChild(el('div', {
      class: 'motoi-palette__swatch' + (w.active === i ? ' motoi-palette__swatch--active' : ''),
      style: `background: rgba(${rgba[0]},${rgba[1]},${rgba[2]},${(rgba[3] ?? 255) / 255})`,
      onClick: () => { w.active = i; renderEditor() },
    }, [el('span', { class: 'motoi-palette__swatch__idx' }, [String(i)])]))
  })
  wrap.appendChild(pal)
  const cur = w.colors[w.active] || [0, 0, 0, 255]
  const hex = '#' + [cur[0], cur[1], cur[2]].map((v) => v.toString(16).padStart(2, '0')).join('')
  const picker = el('input', { type: 'color', value: hex })
  picker.addEventListener('input', (e) => {
    const v = e.target.value
    const r = parseInt(v.slice(1, 3), 16)
    const g = parseInt(v.slice(3, 5), 16)
    const b = parseInt(v.slice(5, 7), 16)
    w.colors[w.active] = [r, g, b, 255]
    renderEditor()
  })
  const picked = el('div', { class: 'motoi-widget__tools' })
  picked.appendChild(el('span', {}, ['edit slot ' + w.active + ': ']))
  picked.appendChild(picker)
  wrap.appendChild(picked)
  wrap.appendChild(el('div', { class: 'motoi-widget__hint' }, [
    'Widget → cart :palette slot. Emits an RGBA list.',
  ]))
  return wrap
}

// Piano Roll — 16 steps × 12 notes, one octave.
function makePianoWidget(tab) {
  tab.widget = tab.widget || {
    kind: 'piano-roll',
    steps: 16, notes: 12, base: 60,   // C4
    grid: Array.from({ length: 12 }, () => new Array(16).fill(false)),
  }
  const w = tab.widget
  const wrap = el('div', { class: 'motoi-widget', 'data-tab-type': 'piano-roll' })
  wrap.appendChild(el('div', { class: 'motoi-widget__head' }, [
    el('span', { class: 'motoi-widget__title' }, ['Piano Roll']),
    el('span', { class: 'motoi-widget__hint' }, [`${w.steps} steps · ${w.notes} pitches`]),
  ]))
  const tools = el('div', { class: 'motoi-widget__tools' })
  tools.appendChild(el('button', {
    class: 'motoi-widget__tool',
    onClick: async () => {
      const notes = []
      for (let n = 0; n < w.notes; n++) {
        for (let s = 0; s < w.steps; s++) {
          if (w.grid[n][s]) notes.push(w.base + (w.notes - 1 - n))
        }
      }
      if (notes.length === 0) { log('err', 'piano roll is empty'); return }
      // Deterministic tone playback via (melody …). Never LLM.
      await apiEval(`(melody (list ${notes.join(' ')}) 0.15)`)
    },
  }, ['play']))
  tools.appendChild(el('button', {
    class: 'motoi-widget__tool',
    onClick: () => {
      w.grid = Array.from({ length: 12 }, () => new Array(16).fill(false))
      renderEditor()
    },
  }, ['clear']))
  wrap.appendChild(tools)
  const roll = el('div', { class: 'motoi-piano-roll' })
  const BLACK = new Set([1, 3, 6, 8, 10])   // C=0, C#=1, D=2, D#=3 …
  for (let n = 0; n < w.notes; n++) {
    const midi = w.base + (w.notes - 1 - n)
    const row = el('div', { class: 'motoi-piano-row' })
    row.appendChild(el('div', { class: 'motoi-piano-row__label' }, [midiName(midi)]))
    const isBlack = BLACK.has(midi % 12)
    for (let s = 0; s < w.steps; s++) {
      const on = w.grid[n][s]
      const cls = 'motoi-piano-cell'
        + (isBlack ? ' motoi-piano-cell--black' : '')
        + (on ? ' motoi-piano-cell--on' : '')
      row.appendChild(el('div', {
        class: cls,
        onClick: () => { w.grid[n][s] = !w.grid[n][s]; renderEditor() },
      }))
    }
    roll.appendChild(row)
  }
  wrap.appendChild(roll)
  wrap.appendChild(el('div', { class: 'motoi-widget__hint' }, [
    'Widget → cart :music slot. Emits phrase-list.',
  ]))
  return wrap
}
function midiName(m) {
  const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  return NAMES[m % 12] + Math.floor(m / 12 - 1)
}

// Widget → Scheme form emitters. Round-trip: emit → apply → emit
// produces identical output. Widget-level identity holds because we
// preserve exact state fields.
function widgetEmit(w) {
  switch (w.kind) {
    case 'sprite-grid':
      return { section: 'sprites', form: ['sprite', 0, ['bytes', ...w.pixels.flat()]] }
    case 'tile-map':
      return { section: 'tiles', form: Object.entries(w.cells).map(([k, v]) => {
        const [c, r] = k.split(',').map(Number)
        return [c, r, v]
      }) }
    case 'timeline':
      return { section: 'music', form: ['timeline', w.frames, w.keyframes.slice()] }
    case 'palette':
      return { section: 'palette', form: w.colors.map((c) => c.slice()) }
    case 'piano-roll': {
      const notes = []
      for (let n = 0; n < w.notes; n++) {
        for (let s = 0; s < w.steps; s++) {
          if (w.grid[n][s]) notes.push([w.base + (w.notes - 1 - n), s])
        }
      }
      return { section: 'music', form: ['phrase', notes] }
    }
    default: return { section: 'code', form: [] }
  }
}
function widgetApply(w, incoming) {
  // Widget-level round-trip: apply an emitted form back onto the
  // widget. For MVP we accept the incoming form and update the state
  // fields verbatim — mirror of emit.
  if (!incoming || !incoming.form) return
  switch (w.kind) {
    case 'sprite-grid': {
      const bytes = (incoming.form[2] || [])
      const flat = Array.isArray(bytes) ? bytes.slice(1) : []
      if (flat.length === w.w * w.h) {
        for (let i = 0; i < flat.length; i++) {
          w.pixels[Math.floor(i / w.w)][i % w.w] = flat[i]
        }
      }
      break
    }
    case 'tile-map': {
      const cells = {}
      for (const entry of incoming.form || []) {
        if (Array.isArray(entry) && entry.length >= 3) cells[`${entry[0]},${entry[1]}`] = entry[2]
      }
      w.cells = cells
      break
    }
    case 'palette': {
      if (Array.isArray(incoming.form)) w.colors = incoming.form.map((c) => c.slice())
      break
    }
    case 'timeline': {
      const [, frames, keyframes] = incoming.form
      if (typeof frames === 'number') w.frames = frames
      if (Array.isArray(keyframes)) w.keyframes = keyframes.slice()
      break
    }
    case 'piano-roll': {
      const notes = incoming.form[1] || []
      w.grid = Array.from({ length: w.notes }, () => new Array(w.steps).fill(false))
      for (const [midi, step] of notes) {
        const rowIdx = (w.notes - 1) - (midi - w.base)
        if (rowIdx >= 0 && rowIdx < w.notes && step >= 0 && step < w.steps) {
          w.grid[rowIdx][step] = true
        }
      }
      break
    }
  }
}

// ── CART SAVE / LOAD (Deliverable 5) ─────────────────────────────
//
// Uses composer/cart-emit + save-cart runtime verbs. Bundle every
// widget tab's state into the appropriate section.

function collectCartFromWidgets() {
  const sections = { meta: [], palette: [], sprites: [], tiles: [], sounds: [], music: [], code: [] }
  for (const t of state.tabs) {
    if (!t.widget) continue
    const { section, form } = widgetEmit(t.widget)
    // For sections that are lists of items, push each. For palette
    // (single list of RGBA), replace.
    if (section === 'palette') sections.palette = form
    else sections[section].push(form)
  }
  // Convert to Scheme text via a naive formatter.
  const format = (v) => {
    if (v == null) return '()'
    if (v === true) return '#t'
    if (v === false) return '#f'
    if (typeof v === 'number') return String(v)
    if (typeof v === 'string') return JSON.stringify(v)
    if (Array.isArray(v)) return '(' + v.map(format).join(' ') + ')'
    return String(v)
  }
  const lines = ['(cart']
  for (const k of ['meta', 'palette', 'sprites', 'tiles', 'sounds', 'music', 'code']) {
    lines.push(`  (:${k} ${format(sections[k])})`)
  }
  lines.push(')')
  return lines.join('\n')
}

async function newCart() {
  // Spawn a template cart buffer holding an empty cart form.
  const src = ';; Motoi Fantasy-Console cart template.\n'
    + ';; Sections per Spec/CART-TEMPLATE.slat.\n'
    + '(composer/cart-empty)\n'
  openTab({ kind: 'buffer', title: 'new cart', content: src })
  log('out', 'new cart from template. Save with the Save button; add widgets from header.')
}

async function saveCart() {
  const name = prompt('Cart name (letters, digits, - . _):', 'my-cart')
  if (!name) return
  const cartText = collectCartFromWidgets()
  // Save the composer-collected cart alongside a save-cart snapshot.
  // For simplicity we write via composer/save on a dummy canvas whose
  // .body is the cart text — but a cleaner path uses save-cart. Try
  // both; if the runtime supports save-cart use it.
  try {
    const src = `(save-cart "${name}.sks")`
    const r = await apiEval(src)
    if (r.ok) log('out', 'cart snapshot saved to ~/.motoi/carts/' + name + '.sks · ' + (r.value || ''))
    else log('err', 'save-cart error: ' + (r.error || ''))
  } catch (e) {
    log('err', 'save-cart failed: ' + e.message)
  }
  // Also dump the widget-collected cart text into the REPL so the
  // kid can see what got captured.
  log('stdout', cartText)
}

async function loadCart() {
  const name = prompt('Cart name to load (letters, digits, - . _):', 'my-cart')
  if (!name) return
  try {
    const src = `(load-cart "${name}.sks")`
    const r = await apiEval(src)
    if (r.ok) log('out', 'loaded ' + (r.value || name))
    else log('err', 'load-cart error: ' + (r.error || ''))
  } catch (e) {
    log('err', 'load-cart failed: ' + e.message)
  }
}

// ── VIEW MENU (Deliverable 6) ────────────────────────────────────

function openViewMenu(anchorEl) {
  const menu = document.getElementById('view-menu')
  if (!menu) return
  menu.innerHTML = ''
  const section = (label) => {
    menu.appendChild(el('div', { class: 'motoi-view-menu__section' }, [label]))
  }
  const item = (label, checked, onClick) => {
    menu.appendChild(el('div', {
      class: 'motoi-view-menu__item',
      onClick,
    }, [
      el('span', {}, [label]),
      checked ? el('span', { class: 'motoi-view-menu__item__check' }, ['✓']) : el('span', {}, ['']),
    ]))
  }
  section('Panels')
  item('CPU',     state.cpuOpen,     () => { toggleCpu();     openViewMenu(anchorEl) })
  item('Console', state.consoleOpen, () => { toggleConsole(); openViewMenu(anchorEl) })
  item('Stack',   state.stackOpen,   () => { toggleStack();   openViewMenu(anchorEl) })
  section('Widgets')
  item('Sprite',   false, () => { menu.setAttribute('hidden', ''); openWidgetTab('sprite-grid', 'Sprite') })
  item('Tile',     false, () => { menu.setAttribute('hidden', ''); openWidgetTab('tile-map', 'Tile') })
  item('Timeline', false, () => { menu.setAttribute('hidden', ''); openWidgetTab('timeline', 'Timeline') })
  item('Palette',  false, () => { menu.setAttribute('hidden', ''); openWidgetTab('palette', 'Palette') })
  item('Piano Roll', false, () => { menu.setAttribute('hidden', ''); openWidgetTab('piano-roll', 'Piano Roll') })
  section('Presets')
  item('Edit',   false, () => { applyPreset('edit');   menu.setAttribute('hidden', '') })
  item('Play',   false, () => { applyPreset('play');   menu.setAttribute('hidden', '') })
  item('Debug',  false, () => { applyPreset('debug');  menu.setAttribute('hidden', '') })
  item('Hacker', state.hackerMode, () => { toggleHacker(); menu.setAttribute('hidden', '') })
  const rect = anchorEl.getBoundingClientRect()
  menu.style.top  = (rect.bottom + 2) + 'px'
  menu.style.left = rect.left + 'px'
  menu.removeAttribute('hidden')
}
function hideViewMenu() { document.getElementById('view-menu')?.setAttribute('hidden', '') }

function applyPreset(name) {
  const openIfNot = (flag, toggler) => { if (!flag) toggler() }
  const closeIfSo = (flag, toggler) => { if (flag) toggler() }
  if (name === 'edit') {
    closeIfSo(state.consoleOpen, toggleConsole)
    closeIfSo(state.stackOpen, toggleStack)
    closeIfSo(state.cpuOpen, toggleCpu)
    setTopMode('ide')
  } else if (name === 'play') {
    openIfNot(state.consoleOpen, toggleConsole)
    closeIfSo(state.stackOpen, toggleStack)
    closeIfSo(state.cpuOpen, toggleCpu)
    setTopMode('fc')
  } else if (name === 'debug') {
    openIfNot(state.consoleOpen, toggleConsole)
    openIfNot(state.stackOpen, toggleStack)
    openIfNot(state.cpuOpen, toggleCpu)
    setTopMode('ide')
  }
  log('out', 'preset: ' + name)
}

function openWidgetTab(kind, title) {
  const existing = state.tabs.find((t) => t.kind === 'widget' && t.widgetKind === kind)
  if (existing) return activateTab(existing.id)
  openTab({
    kind: 'widget',
    widgetKind: kind,
    title,
    content: '',
  })
}

// Extend renderEditor to know about widget tabs. Patch by wrapping.
const _origRenderEditor = renderEditor
function renderEditorPatched() {
  const t = activeTab()
  if (t && t.kind === 'widget') {
    const area = document.getElementById('editor-area')
    area.innerHTML = ''
    if (t.widgetKind === 'sprite-grid') area.appendChild(makeSpriteWidget(t))
    else if (t.widgetKind === 'tile-map') area.appendChild(makeTileWidget(t))
    else if (t.widgetKind === 'timeline') area.appendChild(makeTimelineWidget(t))
    else if (t.widgetKind === 'palette')  area.appendChild(makePaletteWidget(t))
    else if (t.widgetKind === 'piano-roll') area.appendChild(makePianoWidget(t))
    return
  }
  _origRenderEditor()
}
// Reassign the name in module scope.
// eslint-disable-next-line no-func-assign
renderEditor = renderEditorPatched

// ── WIRING (Wave 4 buttons) ──────────────────────────────────────

function setupWave4() {
  const btn = (id, fn) => document.getElementById(id)?.addEventListener('click', fn)
  btn('btn-mode-ide', () => setTopMode('ide'))
  btn('btn-mode-fc',  () => setTopMode('fc'))
  btn('btn-hacker',   toggleHacker)
  btn('btn-new-cart', newCart)
  btn('btn-save-cart', saveCart)
  btn('btn-load-cart', loadCart)
  btn('btn-widget-sprite',   () => openWidgetTab('sprite-grid', 'Sprite'))
  btn('btn-widget-tile',     () => openWidgetTab('tile-map', 'Tile'))
  btn('btn-widget-timeline', () => openWidgetTab('timeline', 'Timeline'))
  btn('btn-widget-palette',  () => openWidgetTab('palette', 'Palette'))
  btn('btn-widget-piano',    () => openWidgetTab('piano-roll', 'Piano Roll'))

  const viewBtn = document.getElementById('btn-view')
  if (viewBtn) {
    viewBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      openViewMenu(viewBtn)
    })
  }
  document.addEventListener('click', (e) => {
    const menu = document.getElementById('view-menu')
    if (!menu || menu.hasAttribute('hidden')) return
    if (menu.contains(e.target)) return
    if (e.target && e.target.id === 'btn-view') return
    hideViewMenu()
  })

  // Restore preferences
  try {
    if (localStorage.getItem(HACKER_KEY) === '1') toggleHacker()
    const m = localStorage.getItem(MODE_KEY)
    if (m === 'fc' || m === 'ide') setTopMode(m)
  } catch { /* ignore */ }

  // Alt-H toggles hacker mode.
  document.addEventListener('keydown', (e) => {
    if (e.altKey && (e.key === 'h' || e.key === 'H')) {
      e.preventDefault()
      toggleHacker()
    }
  })
}

// ── META-COMMAND EXTENSIONS ──────────────────────────────────────
// Add ,hacker and ,splash to the meta-command dispatcher.
const _origHandleMeta = handleMetaCommand
// eslint-disable-next-line no-func-assign
handleMetaCommand = async function (src) {
  const s = src.trim()
  if (s === ',hacker') {
    log('in', src)
    await toggleHacker()
    return true
  }
  if (s === ',splash') {
    log('in', src)
    _splashDismissed = false
    try { localStorage.removeItem(SPLASH_SEEN_KEY) } catch { /* ignore */ }
    await showSplash({ force: true })
    return true
  }
  return _origHandleMeta(src)
}

// ── BOOT PATCH ───────────────────────────────────────────────────
const _origBoot = boot
// eslint-disable-next-line no-func-assign
boot = async function () {
  await _origBoot()
  setupWave4()
  // Splash after everything else so we're not blocking initial load.
  showSplash()
}

window.MotoiIDE = {
  state, openTab, log, runSource, refreshCpu,
  toggleConsole, toggleStack, cycleFocus, setMode,
  setTopMode, toggleHacker, showSplash, dismissSplash,
  openWidgetTab, newCart, saveCart, loadCart,
  widgetEmit, widgetApply,
}

document.addEventListener('DOMContentLoaded', boot)
