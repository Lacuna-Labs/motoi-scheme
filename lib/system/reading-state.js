// reading-state.js — persistent per-chapter reading progress + bookmarks
//                      + session log for Motoi's book tutor.
//
// Provenance: 2026-07-19 (Marcus, IDE Wave 2). Alfred asked:
//   "how will it know what text was read?"
// Answer — this file. It writes a small SLAT file at
// `~/motoi/reading-state.slat` so the next session picks up where the
// last one left off. Human-readable, editable, provenance-doctrine
// compliant.
//
// Verbs exposed on the env:
//   (motoi/reading-state)                — return the whole state alist
//   (motoi/reading-state 'chapter-06)    — detail for one chapter key
//   (motoi/mark-read! book ch [sec])     — record a read event
//   (motoi/reading-progress book ch)     — { read, total, last-visited }
//   (motoi/bookmark! name [context])     — drop a bookmark
//   (motoi/bookmarks)                    — list every bookmark
//   (motoi/highlight! text [context])    — record a code highlight
//   (motoi/highlights)                   — recent highlights
//   (motoi/log-exchange! kind text)      — append a REPL entry
//   (motoi/session-log [limit])          — recent exchanges
//   (motoi/reading-state/reset!)         — wipe the state (test seam)
//
// SLAT format is documented at the top of writeStateToDisk. It is
// deterministic (sorted keys) so the file diff-reads cleanly.
//
// Doctrine:
//   * No fabrication — every entry ties to a real user action.
//   * Non-crashy — if the file is missing, corrupt, or unwritable,
//     the state degrades to in-memory (still works). Alfred loses
//     persistence, not the session.
//   * Composes with book/tutor — that layer calls
//     (motoi/reading-progress …) to draw progress bars at the top of
//     each chapter render.
//   * The file lives under ~/motoi/ next to artifacts/ so the user's
//     Motoi home directory is one visible place (`ls ~/motoi`).

import { Sym } from '../../src/reader.js'
import {
  existsSync, mkdirSync, readFileSync, writeFileSync,
} from 'node:fs'
import { dirname } from 'node:path'
import { motoiUserDir, userReadingPath } from '../../src/paths.js'

// ── location ──────────────────────────────────────────────────────────

const MOTOI_HOME = motoiUserDir()
const READING_STATE_PATH = userReadingPath()

function ensureHome() {
  try {
    if (!existsSync(MOTOI_HOME)) mkdirSync(MOTOI_HOME, { recursive: true })
  } catch { /* soft-fail — degrade to in-memory */ }
}

// ── in-memory state shape ─────────────────────────────────────────────
//
// The full state is an object; disk serialization is one SLAT record
// per (book, chapter, section) plus one record per bookmark, plus a
// bounded session-log tail. In-memory we keep it structured:
//
//   {
//     chapters: {
//       "code:12": {
//         book: "code",
//         chapter: 12,
//         sections: { "intro": { firstReadAt: 123, lastVisitedAt: 456 },
//                     "fetch-decode-execute": { … } },
//         codeBlockRuns: { "1": 3, "2": 1 },   // block index → run count
//         notes: "…",
//         firstReadAt, lastVisitedAt,
//       },
//     },
//     bookmarks: { "name": { context, createdAt } },
//     highlights: [ { text, context, at }, … ],   // capped at 100
//     sessionLog:  [ { at, kind, text }, … ],     // capped at 500
//   }
//
// The keys use `:` as the book/chapter separator so a Scheme reader
// tokenises them cleanly. This lets a caller pass either
// `'chapter-06` (kebab, book="code" implicit) or the full compound.

function emptyState() {
  return {
    chapters: {},
    bookmarks: {},
    highlights: [],
    sessionLog: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

// Every install instance carries one state box. Sharing across envs
// is intentional: the user only has ONE `~/motoi` — a fresh env in
// the same process should still see prior progress.
let SHARED_STATE = null

function loadState() {
  if (SHARED_STATE) return SHARED_STATE
  ensureHome()
  if (!existsSync(READING_STATE_PATH)) {
    SHARED_STATE = emptyState()
    return SHARED_STATE
  }
  try {
    const raw = readFileSync(READING_STATE_PATH, 'utf8')
    SHARED_STATE = parseStateFromSlat(raw)
  } catch {
    // Corrupt file — degrade to empty rather than crash.
    SHARED_STATE = emptyState()
  }
  return SHARED_STATE
}

// ── SLAT serialization ────────────────────────────────────────────────
//
// The file shape is:
//
//   ;; ═══════════════════════════════════════════════════════════════
//   ;; MOTOI READING STATE — where the reader is in the book.
//   ;; Provenance: motoi/reading-state (lib/system/reading-state.js)
//   ;; Format: SLAT records, one per event. Human-editable.
//   ;; ═══════════════════════════════════════════════════════════════
//
//   (state
//     :created-at 1721425200000
//     :updated-at 1721428800000)
//
//   (chapter :book "code" :chapter 12
//            :first-read-at 1721425201000
//            :last-visited-at 1721428800000
//            :sections ("intro" "fetch-decode-execute")
//            :code-block-runs ((1 3) (2 1))
//            :notes "")
//
//   (bookmark :name "attention-lemma"
//             :context "book-of-ml/12"
//             :created-at 1721425300000)
//
//   (highlight :text "(vec/dot ws xs)"
//              :context "buffer 3"
//              :at 1721425400000)
//
//   (log :at 1721425500000 :kind "in"  :text "(+ 1 2)")
//   (log :at 1721425500500 :kind "out" :text "3")
//
// The parser is line-oriented and reads whichever records it recognises;
// unknown records are ignored (forward-compat).

function serializeStateToSlat(state) {
  const lines = []
  lines.push(';; ═══════════════════════════════════════════════════════════════')
  lines.push(';; MOTOI READING STATE — where the reader is in the book.')
  lines.push(';; Provenance: motoi/reading-state (lib/system/reading-state.js)')
  lines.push(';; Format: SLAT records, one per event. Human-editable.')
  lines.push(';; ═══════════════════════════════════════════════════════════════')
  lines.push('')
  lines.push(
    `(state :created-at ${state.createdAt} :updated-at ${state.updatedAt})`
  )
  lines.push('')

  const chapterKeys = Object.keys(state.chapters).sort()
  for (const key of chapterKeys) {
    const c = state.chapters[key]
    const sections = Object.keys(c.sections || {}).sort()
    const runs = Object.entries(c.codeBlockRuns || {})
      .map(([k, v]) => `(${k} ${v})`)
      .join(' ')
    const secs = sections.map((s) => JSON.stringify(s)).join(' ')
    lines.push(
      `(chapter :book ${JSON.stringify(c.book)}` +
      ` :chapter ${c.chapter}` +
      ` :first-read-at ${c.firstReadAt || 0}` +
      ` :last-visited-at ${c.lastVisitedAt || 0}` +
      ` :sections (${secs})` +
      ` :code-block-runs (${runs})` +
      ` :notes ${JSON.stringify(c.notes || '')})`
    )
  }
  if (chapterKeys.length > 0) lines.push('')

  const bookmarkKeys = Object.keys(state.bookmarks).sort()
  for (const name of bookmarkKeys) {
    const b = state.bookmarks[name]
    lines.push(
      `(bookmark :name ${JSON.stringify(name)}` +
      ` :context ${JSON.stringify(b.context || '')}` +
      ` :created-at ${b.createdAt})`
    )
  }
  if (bookmarkKeys.length > 0) lines.push('')

  for (const h of state.highlights) {
    lines.push(
      `(highlight :text ${JSON.stringify(h.text)}` +
      ` :context ${JSON.stringify(h.context || '')}` +
      ` :at ${h.at})`
    )
  }
  if (state.highlights.length > 0) lines.push('')

  for (const entry of state.sessionLog) {
    lines.push(
      `(log :at ${entry.at}` +
      ` :kind ${JSON.stringify(entry.kind)}` +
      ` :text ${JSON.stringify(entry.text)})`
    )
  }

  return lines.join('\n') + '\n'
}

// ── SLAT parser (line-oriented, tolerant) ──────────────────────────────
//
// We deliberately do NOT reuse the Scheme reader here — this file is a
// separate concern, and a corrupt line should be skipped, not crash the
// whole session. Every record starts with `(TAG` at column 0; we split
// key/value pairs by whitespace with JSON-string awareness for the
// string-valued keys.

function parseStateFromSlat(text) {
  const state = emptyState()
  const lines = String(text).split(/\r?\n/)
  for (const raw of lines) {
    const line = raw.trim()
    if (!line || line.startsWith(';')) continue
    if (line.startsWith('(state ')) {
      const kv = parseKvs(line)
      if (kv[':created-at'] != null) state.createdAt = Number(kv[':created-at']) || Date.now()
      if (kv[':updated-at'] != null) state.updatedAt = Number(kv[':updated-at']) || Date.now()
      continue
    }
    if (line.startsWith('(chapter ')) {
      const kv = parseKvs(line)
      const book = String(kv[':book'] ?? 'code')
      const ch = Number(kv[':chapter'] ?? 0)
      const key = chapterKey(book, ch)
      const sections = {}
      const sList = kv[':sections']
      if (Array.isArray(sList)) {
        for (const s of sList) sections[String(s)] = { firstReadAt: 0, lastVisitedAt: 0 }
      }
      const codeBlockRuns = {}
      const runs = kv[':code-block-runs']
      if (Array.isArray(runs)) {
        for (const pair of runs) {
          if (Array.isArray(pair) && pair.length === 2) codeBlockRuns[String(pair[0])] = Number(pair[1])
        }
      }
      state.chapters[key] = {
        book, chapter: ch,
        firstReadAt: Number(kv[':first-read-at']) || 0,
        lastVisitedAt: Number(kv[':last-visited-at']) || 0,
        sections,
        codeBlockRuns,
        notes: String(kv[':notes'] ?? ''),
      }
      continue
    }
    if (line.startsWith('(bookmark ')) {
      const kv = parseKvs(line)
      const name = String(kv[':name'] ?? '')
      if (!name) continue
      state.bookmarks[name] = {
        context: String(kv[':context'] ?? ''),
        createdAt: Number(kv[':created-at']) || Date.now(),
      }
      continue
    }
    if (line.startsWith('(highlight ')) {
      const kv = parseKvs(line)
      state.highlights.push({
        text: String(kv[':text'] ?? ''),
        context: String(kv[':context'] ?? ''),
        at: Number(kv[':at']) || Date.now(),
      })
      continue
    }
    if (line.startsWith('(log ')) {
      const kv = parseKvs(line)
      state.sessionLog.push({
        at: Number(kv[':at']) || Date.now(),
        kind: String(kv[':kind'] ?? ''),
        text: String(kv[':text'] ?? ''),
      })
      continue
    }
  }
  return state
}

// Cheap keyword-value parser. Tokenizes a SINGLE record line (without
// the outer `(tag …)`) into an object keyed by :name.
//
// Values understood:
//   * "quoted string"       → JS string (JSON.parse-safe)
//   * bare number           → JS number
//   * (foo bar baz)         → JS array (recursive)
//   * true/false/#t/#f      → JS boolean
// Anything else stays as a string.
function parseKvs(line) {
  // Strip outer parens `(tag ... )` — we know it starts with `(` and
  // ends with the last `)`.
  const first = line.indexOf(' ')
  if (first < 0) return {}
  let body = line.slice(first + 1).trim()
  // Strip trailing `)` at balanced depth 0.
  if (body.endsWith(')')) body = body.slice(0, -1).trim()

  const tokens = tokenize(body)
  const out = {}
  let i = 0
  while (i < tokens.length) {
    const key = tokens[i]
    if (typeof key === 'string' && key.startsWith(':') && i + 1 < tokens.length) {
      out[key] = tokens[i + 1]
      i += 2
    } else {
      i++
    }
  }
  return out
}

// Very small tokenizer used by parseKvs. Handles strings, parens, atoms.
function tokenize(src) {
  const out = []
  let i = 0
  const n = src.length
  while (i < n) {
    const c = src[i]
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue }
    if (c === '"') {
      // JSON-style string
      let j = i + 1
      while (j < n) {
        if (src[j] === '\\' && j + 1 < n) { j += 2; continue }
        if (src[j] === '"') break
        j++
      }
      const chunk = src.slice(i, j + 1)
      try { out.push(JSON.parse(chunk)) } catch { out.push(chunk.slice(1, -1)) }
      i = j + 1
      continue
    }
    if (c === '(') {
      // Sub-list — read until matching close.
      let depth = 1
      let j = i + 1
      while (j < n && depth > 0) {
        if (src[j] === '"') {
          // skip strings inside sub-list
          let k = j + 1
          while (k < n && src[k] !== '"') { if (src[k] === '\\') k++; k++ }
          j = k + 1
          continue
        }
        if (src[j] === '(') depth++
        else if (src[j] === ')') depth--
        j++
      }
      const inner = src.slice(i + 1, j - 1)
      out.push(tokenize(inner))
      i = j
      continue
    }
    // Atom
    let j = i
    while (j < n && !' \t\n\r()"'.includes(src[j])) j++
    const atom = src.slice(i, j)
    if (atom === '#t') out.push(true)
    else if (atom === '#f') out.push(false)
    else if (/^-?\d+(\.\d+)?$/.test(atom)) out.push(Number(atom))
    else out.push(atom)
    i = j
  }
  return out
}

// ── persistence ──────────────────────────────────────────────────────

function writeStateToDisk(state) {
  ensureHome()
  try {
    state.updatedAt = Date.now()
    const body = serializeStateToSlat(state)
    writeFileSync(READING_STATE_PATH, body, 'utf8')
    return true
  } catch { return false }
}

// ── key helpers ──────────────────────────────────────────────────────

function chapterKey(book, chapter) {
  return `${book}:${chapter}`
}

// Resolve a Scheme-side chapter reference to (book, chapter).
// Accepted forms:
//   * (motoi/reading-state 'chapter-6)      → book="code", chapter=6
//   * (motoi/reading-state 'code/12)        → book="code", chapter=12
//   * (motoi/reading-state 'ml/9)           → book="ml", chapter=9
//   * (motoi/reading-state 12)              → book="code", chapter=12
//   * (motoi/reading-state "code" 12)       → book="code", chapter=12
function resolveChapterRef(a, b) {
  if (typeof a === 'string' && typeof b === 'number') return { book: a, chapter: b }
  if (a instanceof Sym) {
    const name = a.name
    const slashM = name.match(/^([a-z0-9-]+)\/(\d+)$/i)
    if (slashM) return { book: slashM[1], chapter: Number(slashM[2]) }
    const kebabM = name.match(/^chapter-(\d+)$/i)
    if (kebabM) return { book: 'code', chapter: Number(kebabM[1]) }
    // Fall through — take the whole name as the book, chapter unknown.
    return { book: name, chapter: 0 }
  }
  if (typeof a === 'number') return { book: 'code', chapter: a }
  return { book: 'code', chapter: 0 }
}

// ── verb installer ───────────────────────────────────────────────────

export function installReadingState(env, fuel) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  // Pre-load once so first access has something.
  const state = loadState()

  const toAlistChapter = (c) => ([
    [new Sym(':book'),           c.book],
    [new Sym(':chapter'),        c.chapter],
    [new Sym(':first-read-at'),  c.firstReadAt],
    [new Sym(':last-visited-at'), c.lastVisitedAt],
    [new Sym(':sections'),       Object.keys(c.sections).sort()],
    [new Sym(':section-count'),  Object.keys(c.sections).length],
    [new Sym(':code-block-runs'),
      Object.entries(c.codeBlockRuns).map(([k, v]) => [Number(k), v])],
    [new Sym(':notes'),          c.notes || ''],
  ])

  // (motoi/reading-state)              → global snapshot
  // (motoi/reading-state 'chapter-N)   → one chapter
  // (motoi/reading-state 'book/N)      → one chapter
  // (motoi/reading-state 12)           → one chapter (book=code)
  // (motoi/reading-state "book" 12)    → one chapter
  def('motoi/reading-state', (a, b) => {
    if (a == null) {
      // Whole-state snapshot
      return [
        [new Sym(':chapters'),
          Object.keys(state.chapters).sort().map((k) => toAlistChapter(state.chapters[k]))],
        [new Sym(':bookmarks'), Object.keys(state.bookmarks).sort()],
        [new Sym(':highlight-count'), state.highlights.length],
        [new Sym(':session-log-size'), state.sessionLog.length],
        [new Sym(':path'), READING_STATE_PATH],
        [new Sym(':updated-at'), state.updatedAt],
      ]
    }
    const ref = resolveChapterRef(a, b)
    const key = chapterKey(ref.book, ref.chapter)
    const c = state.chapters[key]
    if (!c) {
      return [
        [new Sym(':book'), ref.book],
        [new Sym(':chapter'), ref.chapter],
        [new Sym(':status'), new Sym('unread')],
      ]
    }
    return toAlistChapter(c)
  })

  // (motoi/mark-read! book chapter [section])
  // Records that a chapter/section was visited. Idempotent — the
  // first-read-at is set on the first call and preserved; the
  // last-visited-at updates each call.
  def('motoi/mark-read!', (bookOrChapter, chapterOrSection, sectionMaybe) => {
    let book, chapter, section
    if (typeof bookOrChapter === 'string' && typeof chapterOrSection === 'number') {
      book = bookOrChapter
      chapter = chapterOrSection
      section = sectionMaybe != null ? String(sectionMaybe instanceof Sym ? sectionMaybe.name : sectionMaybe) : null
    } else if (typeof bookOrChapter === 'number') {
      book = 'code'
      chapter = bookOrChapter
      section = chapterOrSection != null ? String(chapterOrSection instanceof Sym ? chapterOrSection.name : chapterOrSection) : null
    } else {
      const ref = resolveChapterRef(bookOrChapter, chapterOrSection)
      book = ref.book; chapter = ref.chapter
      section = sectionMaybe != null ? String(sectionMaybe instanceof Sym ? sectionMaybe.name : sectionMaybe) : null
    }
    const key = chapterKey(book, chapter)
    const now = Date.now()
    if (!state.chapters[key]) {
      state.chapters[key] = {
        book, chapter, firstReadAt: now, lastVisitedAt: now,
        sections: {}, codeBlockRuns: {}, notes: '',
      }
    }
    const c = state.chapters[key]
    c.lastVisitedAt = now
    if (section) {
      if (!c.sections[section]) c.sections[section] = { firstReadAt: now, lastVisitedAt: now }
      else c.sections[section].lastVisitedAt = now
    }
    writeStateToDisk(state)
    return true
  }, 'state-change')

  // (motoi/mark-block-run! book chapter blockIndex)
  // Records that a runnable code block was executed. Increments the
  // per-block counter so tutor can say "you've run this block 3 times".
  def('motoi/mark-block-run!', (bookOrChapter, chapterOrBlock, blockMaybe) => {
    let book, chapter, block
    if (typeof bookOrChapter === 'string' && typeof chapterOrBlock === 'number' && typeof blockMaybe === 'number') {
      book = bookOrChapter; chapter = chapterOrBlock; block = blockMaybe
    } else if (typeof bookOrChapter === 'number' && typeof chapterOrBlock === 'number') {
      book = 'code'; chapter = bookOrChapter; block = chapterOrBlock
    } else {
      const ref = resolveChapterRef(bookOrChapter, chapterOrBlock)
      book = ref.book; chapter = ref.chapter; block = Number(blockMaybe || 1)
    }
    const key = chapterKey(book, chapter)
    const now = Date.now()
    if (!state.chapters[key]) {
      state.chapters[key] = {
        book, chapter, firstReadAt: now, lastVisitedAt: now,
        sections: {}, codeBlockRuns: {}, notes: '',
      }
    }
    const c = state.chapters[key]
    const idx = String(block | 0)
    c.codeBlockRuns[idx] = (c.codeBlockRuns[idx] || 0) + 1
    c.lastVisitedAt = now
    writeStateToDisk(state)
    return c.codeBlockRuns[idx]
  }, 'state-change')

  // (motoi/reading-progress book chapter) → alist { read, total,
  //   last-visited-at, code-block-runs }
  //   "read" is the number of sections we've recorded as read;
  //   "total" is either provided by the caller (via the third arg) or
  //   #f when the caller doesn't know. The tutor passes the section
  //   count when rendering the progress bar.
  def('motoi/reading-progress', (bookOrChapter, chapterOrTotal, totalMaybe) => {
    let book, chapter, total
    if (typeof bookOrChapter === 'string' && typeof chapterOrTotal === 'number') {
      book = bookOrChapter; chapter = chapterOrTotal
      total = typeof totalMaybe === 'number' ? totalMaybe : null
    } else if (typeof bookOrChapter === 'number') {
      book = 'code'; chapter = bookOrChapter
      total = typeof chapterOrTotal === 'number' ? chapterOrTotal : null
    } else {
      const ref = resolveChapterRef(bookOrChapter, chapterOrTotal)
      book = ref.book; chapter = ref.chapter
      total = typeof totalMaybe === 'number' ? totalMaybe : null
    }
    const key = chapterKey(book, chapter)
    const c = state.chapters[key]
    const readCount = c ? Object.keys(c.sections).length : 0
    return [
      [new Sym(':book'), book],
      [new Sym(':chapter'), chapter],
      [new Sym(':read'), readCount],
      [new Sym(':total'), total ?? false],
      [new Sym(':last-visited-at'), c ? c.lastVisitedAt : 0],
      [new Sym(':first-read-at'), c ? c.firstReadAt : 0],
      [new Sym(':code-block-runs'),
        c ? Object.entries(c.codeBlockRuns).map(([k, v]) => [Number(k), v]) : []],
    ]
  })

  // (motoi/bookmark! 'name [context]) — drop or move a bookmark.
  def('motoi/bookmark!', (name, context) => {
    const nm = name instanceof Sym ? name.name : String(name || '')
    if (!nm) return false
    const ctx = context instanceof Sym ? context.name : (context == null ? '' : String(context))
    state.bookmarks[nm] = { context: ctx, createdAt: Date.now() }
    writeStateToDisk(state)
    return true
  }, 'state-change')

  // (motoi/bookmarks) — list all bookmarks
  def('motoi/bookmarks', () => {
    return Object.keys(state.bookmarks).sort().map((name) => [
      [new Sym(':name'), name],
      [new Sym(':context'), state.bookmarks[name].context],
      [new Sym(':created-at'), state.bookmarks[name].createdAt],
    ])
  })

  // (motoi/bookmark-delete! 'name) — remove a bookmark
  def('motoi/bookmark-delete!', (name) => {
    const nm = name instanceof Sym ? name.name : String(name || '')
    if (!nm || !state.bookmarks[nm]) return false
    delete state.bookmarks[nm]
    writeStateToDisk(state)
    return true
  }, 'state-change')

  // (motoi/highlight! text [context]) — record a highlight so Motoi
  // can reference it later ("the piece you highlighted 5 minutes ago").
  def('motoi/highlight!', (text, context) => {
    const t = String(text ?? '')
    if (!t) return false
    const ctx = context instanceof Sym ? context.name : (context == null ? '' : String(context))
    state.highlights.push({ text: t, context: ctx, at: Date.now() })
    // Keep the last 100 only.
    if (state.highlights.length > 100) state.highlights.splice(0, state.highlights.length - 100)
    writeStateToDisk(state)
    return true
  }, 'state-change')

  // (motoi/highlights [limit]) — most-recent-first
  def('motoi/highlights', (limit) => {
    const n = typeof limit === 'number' ? limit : 20
    const recent = state.highlights.slice(-n).reverse()
    return recent.map((h) => [
      [new Sym(':text'), h.text],
      [new Sym(':context'), h.context],
      [new Sym(':at'), h.at],
    ])
  })

  // (motoi/log-exchange! 'kind text) — append an event to the session
  // log. Kind is a symbol like 'in / 'out / 'err.
  def('motoi/log-exchange!', (kind, text) => {
    const k = kind instanceof Sym ? kind.name : String(kind || 'in')
    const t = String(text ?? '')
    state.sessionLog.push({ at: Date.now(), kind: k, text: t })
    if (state.sessionLog.length > 500) state.sessionLog.splice(0, state.sessionLog.length - 500)
    writeStateToDisk(state)
    return state.sessionLog.length
  }, 'state-change')

  // (motoi/session-log [limit]) — recent exchanges, oldest-first
  def('motoi/session-log', (limit) => {
    const n = typeof limit === 'number' ? limit : 20
    const recent = state.sessionLog.slice(-n)
    return recent.map((e) => [
      [new Sym(':at'), e.at],
      [new Sym(':kind'), new Sym(e.kind)],
      [new Sym(':text'), e.text],
    ])
  })

  // (motoi/reading-state/reset!) — wipe every field. Test seam + kids
  // who want a clean slate.
  def('motoi/reading-state/reset!', () => {
    for (const k of Object.keys(state.chapters)) delete state.chapters[k]
    for (const k of Object.keys(state.bookmarks)) delete state.bookmarks[k]
    state.highlights.length = 0
    state.sessionLog.length = 0
    state.createdAt = Date.now()
    state.updatedAt = Date.now()
    writeStateToDisk(state)
    return true
  }, 'state-change')

  // (motoi/reading-state/path) — return the on-disk path.
  def('motoi/reading-state/path', () => READING_STATE_PATH)

  return env
}

// ── exports for tests / IDE server ────────────────────────────────────

export {
  READING_STATE_PATH,
  loadState,
  writeStateToDisk,
  emptyState,
  serializeStateToSlat,
  parseStateFromSlat,
}

// Test seam: reset the shared state box so tests can start clean.
export function _resetSharedStateForTests() { SHARED_STATE = null }

export default installReadingState
