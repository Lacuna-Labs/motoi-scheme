// book/tutor.js — Motoi walks you through Book of Code, chapter by chapter.
//
// Provenance: 2026-07-19 (Marcus, infra lane, coordinating with Ada's
// Book of Code authoring lane a4c5303c…). The generic book reader
// (lib/book/reader.js) is book-agnostic; this file is the book-specific
// pedagogical layer for Book of Code — the book with the runnable
// CPU underneath. Chapter 12 in particular walks the reader through
// fetch/decode/execute on the actual `cpu/*` verbs installed elsewhere
// on the env.
//
// Doctrine:
//   * Motoi's voice — dry wit, kid-first, no walk-back. See the persona
//     memory (project_motoi_personality_2026_07_17.md).
//   * 11-year-old readable. Every hint short.
//   * Speak & Spell — deterministic. `(book-of-code/chapter 12)`
//     produces the SAME structure every call. No randomization, no
//     dialogue trees. The IDE + the REPL render the same string.
//   * No fabrication. Every code-block index we return comes from
//     the underlying `.book.slatl` file's ```scheme fences — we do
//     not synthesise examples.
//   * NO SLAT parser rewrite. We reach into the existing book/read
//     and book/example verbs the parent installer registered.
//
// Five verbs on top of the generic `book/*` roster:
//   (book-of-code/table-of-contents) → chapter list
//   (book-of-code/chapter N)         → parsed structure of chapter N
//   (book-of-code/read N)            → prose (wrapped, ready to display)
//   (book-of-code/run-code-block N K [:cpu? #t])
//                                    → evaluate code block K of chapter N
//   (book-of-code/tutor [N])         → the Motoi-voice walkthrough intro

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { Sym } from '../../src/reader.js'
import { parse as parseScheme } from '../../src/reader.js'
import { evaluate } from '../../src/interp.js'

// scheme-books/book-of-code lives at repo root.
const __dirname = dirname(fileURLToPath(import.meta.url))
const BOOK_DIR = join(__dirname, '..', '..', 'scheme-books', 'book-of-code')

const BOOK_SLUG = 'code'

// ── keyword-args helper ───────────────────────────────────────────────
function kwargsToObj(args) {
  const out = {}
  for (let i = 0; i + 1 < args.length; i += 2) {
    const kRaw = args[i]
    const kName = kRaw instanceof Sym ? kRaw.name : String(kRaw)
    const key = kName.startsWith(':') ? kName.slice(1) : kName
    let v = args[i + 1]
    if (v instanceof Sym) v = v.name
    out[key] = v
  }
  return out
}

// ── chapter-file discovery ────────────────────────────────────────────
//
// The Book of Code manifest lists chapters in canonical order in the
// MANIFEST.slat file. We read the directory instead — the manifest is
// authoritative for docs but the on-disk .book.slatl files are what
// actually exist. Ada's lane will fill in more chapters over time; this
// stays in sync automatically.

function listChapterFiles() {
  if (!existsSync(BOOK_DIR)) return []
  const all = readdirSync(BOOK_DIR)
  const chapters = []
  for (const f of all) {
    if (!f.endsWith('.book.slatl')) continue
    if (f.startsWith('MANIFEST')) continue
    if (f === 'cover.book.slatl') continue
    chapters.push(f)
  }
  chapters.sort((a, b) => {
    const na = a.match(/^(\d+)/)
    const nb = b.match(/^(\d+)/)
    if (na && nb) return parseInt(na[1], 10) - parseInt(nb[1], 10)
    if (na && !nb) return -1
    if (!na && nb) return 1
    return a.localeCompare(b)
  })
  return chapters.map((f) => join(BOOK_DIR, f))
}

// Cached parse of a chapter file. Keyed by absolute path.
const _cache = new Map()

// Re-uses the SAME parser shape as lib/book/reader.js so the two
// producers agree on chapter structure. Extract :title, :chapter-number,
// :prose (the load-bearing bits).
function parseChapter(absPath) {
  if (_cache.has(absPath)) return _cache.get(absPath)
  let src
  try { src = readFileSync(absPath, 'utf8') } catch { return null }

  const rec = { title: null, chapterNumber: null, prose: '', path: absPath }

  const titleM = src.match(/:title\s+"((?:[^"\\]|\\.)*)"/)
  if (titleM) rec.title = unescape(titleM[1])

  const chNumM = src.match(/:chapter-number\s+([\d.]+)/)
  if (chNumM) rec.chapterNumber = parseFloat(chNumM[1])

  const proseIdx = src.indexOf(':prose')
  if (proseIdx >= 0) {
    let i = proseIdx + ':prose'.length
    while (i < src.length && /\s/.test(src[i])) i++
    if (src[i] === '"') {
      let j = i + 1
      let out = ''
      while (j < src.length) {
        const c = src[j]
        if (c === '\\' && j + 1 < src.length) {
          const nx = src[j + 1]
          if (nx === 'n') out += '\n'
          else if (nx === 't') out += '\t'
          else if (nx === 'r') out += '\r'
          else if (nx === '\\') out += '\\'
          else if (nx === '"') out += '"'
          else out += nx
          j += 2
          continue
        }
        if (c === '"') break
        out += c
        j++
      }
      rec.prose = out
    }
  }

  _cache.set(absPath, rec)
  return rec
}

function unescape(s) {
  return s
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
}

// ── section + code-block extraction ───────────────────────────────────

// Split prose by `## ` headings. Returns [{ heading, body }, …].
function splitSections(prose) {
  const lines = (prose || '').split('\n')
  const sections = []
  let cur = { heading: null, body: [] }
  for (const line of lines) {
    if (/^##\s/.test(line)) {
      if (cur.body.length || cur.heading) sections.push(cur)
      cur = { heading: line.replace(/^##\s*/, '').trim(), body: [] }
    } else {
      cur.body.push(line)
    }
  }
  if (cur.body.length || cur.heading) sections.push(cur)
  return sections.map((s) => ({ heading: s.heading, body: s.body.join('\n').trim() }))
}

// Extract every ```scheme … ``` block. Order preserved. 1-based indexing
// in the public API (matches book/example).
function extractCodeBlocks(prose) {
  if (!prose) return []
  const out = []
  const re = /```scheme\s*\n([\s\S]*?)\n```/g
  let m
  while ((m = re.exec(prose)) !== null) {
    out.push(m[1])
  }
  return out
}

// ── voice ─────────────────────────────────────────────────────────────
//
// Motoi doesn't monologue. Every voice fragment below is short, dry,
// kid-parseable. No emojis. No walk-backs. If a chapter isn't there yet
// Motoi says so plainly.

const TUTOR_INTRO = `[motoi] Book of Code. Sixteen chapters, eight appendices.
        We build a computer from nothing. A bone. A gate. A CPU. A network.
        Ask for a chapter: (book-of-code/read 1) through (book-of-code/read 16).
        Ask for the runnable CPU: (book-of-code/run-code-block 12 1).
        The chapter I like best is 12 — that's where the fetch loop shows up.`

const TUTOR_NO_CHAPTER = (n) => `[motoi] Chapter ${n} isn't authored yet. It will be.
        Try (book-of-code/table-of-contents) to see which ones exist.`

// ── progress helpers ──────────────────────────────────────────────────
//
// Wave 2 additions — draw a compact ASCII progress bar and describe how
// long ago a chapter was last visited. Both are deterministic and text
// wraps well in the fixed-width panel of the IDE.

function alistGet(alist, key) {
  if (!Array.isArray(alist)) return undefined
  for (const pair of alist) {
    if (Array.isArray(pair) && pair.length === 2 && pair[0] instanceof Sym) {
      if (pair[0].name === key) return pair[1]
    }
  }
  return undefined
}

function progressBar(read, total, width) {
  if (!total || total <= 0) return '─'.repeat(width)
  const filled = Math.max(0, Math.min(width, Math.round((read / total) * width)))
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

function humanizeAgo(ms) {
  if (!ms) return 'first visit'
  const delta = Date.now() - ms
  if (delta < 0) return 'moments ago'
  const s = Math.floor(delta / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

// ── verb installer ────────────────────────────────────────────────────

export function installBookOfCodeTutor(env, fuel) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  // (book-of-code/table-of-contents) → list of ((:chapter N) (:title "…") (:authored? #t/#f))
  def('book-of-code/table-of-contents', () => {
    const files = listChapterFiles()
    const out = []
    for (const f of files) {
      const rec = parseChapter(f)
      if (!rec) continue
      out.push([
        [new Sym(':chapter'), rec.chapterNumber ?? false],
        [new Sym(':title'), rec.title || basename(f)],
        [new Sym(':authored?'), true],
        [new Sym(':path'), rec.path],
      ])
    }
    return out
  })

  // (book-of-code/chapter N) → alist with :title, :chapter-number,
  // :prose, :sections, :code-blocks. The structured form for callers
  // that need to render one section at a time (the IDE walk-through).
  def('book-of-code/chapter', (n) => {
    const files = listChapterFiles()
    let picked = null
    for (const f of files) {
      const rec = parseChapter(f)
      if (rec && rec.chapterNumber === Number(n)) { picked = rec; break }
    }
    if (!picked) {
      // Fall back to filename numeric prefix, matching book/read.
      for (const f of files) {
        const m = basename(f).match(/^(\d+)/)
        if (m && parseInt(m[1], 10) === Number(n)) { picked = parseChapter(f); break }
      }
    }
    if (!picked) return false

    const sections = splitSections(picked.prose)
    const codeBlocks = extractCodeBlocks(picked.prose)
    return [
      [new Sym(':title'), picked.title || ''],
      [new Sym(':chapter-number'), picked.chapterNumber ?? Number(n)],
      [new Sym(':prose'), picked.prose || ''],
      [new Sym(':sections'), sections.map((s) => [
        [new Sym(':heading'), s.heading || ''],
        [new Sym(':body'), s.body || ''],
      ])],
      [new Sym(':code-blocks'), codeBlocks],
      [new Sym(':path'), picked.path],
    ]
  })

  // (book-of-code/read N) — the prose of chapter N, wrapped for terminal
  // display. The IDE calls this for the reader-tab.
  //
  // Wave 2 (2026-07-19): whenever we serve a chapter, log a read event
  // via motoi/mark-read! if that verb is installed. That's how the
  // reading-state file grows without asking the user to think about it.
  def('book-of-code/read', (n) => {
    const files = listChapterFiles()
    for (const f of files) {
      const rec = parseChapter(f)
      if (!rec) continue
      const num = rec.chapterNumber
      const m = basename(f).match(/^(\d+)/)
      const fromName = m ? parseInt(m[1], 10) : null
      if (num === Number(n) || fromName === Number(n)) {
        try {
          const mark = env.get('motoi/mark-read!')
          if (typeof mark === 'function') mark('code', Number(n))
        } catch { /* reading-state not installed — skip */ }
        return rec.prose || ''
      }
    }
    return TUTOR_NO_CHAPTER(n)
  })

  // (book-of-code/run-code-block N K) — evaluate the K-th ```scheme fence
  // of chapter N. Uses the same env the caller is in, so any (define …)
  // sticks around for the next block — that's what a walkthrough needs.
  // Passing :cpu? #t reboots the CPU before running the block; kids
  // playing through chapter 12 use this so they always start clean.
  def('book-of-code/run-code-block', (...args) => {
    // Two shapes: positional (chapter, block, opts…) or all kw.
    let chapterN, blockN, opts
    if (args.length >= 2 && typeof args[0] === 'number' && typeof args[1] === 'number') {
      chapterN = args[0]
      blockN = args[1]
      opts = kwargsToObj(args.slice(2))
    } else {
      opts = kwargsToObj(args)
      chapterN = Number(opts.chapter)
      blockN = Number(opts.block ?? opts.example ?? 1)
    }

    if (opts['cpu?'] === true || opts.cpu === true) {
      // Reset CPU state before running. Best-effort — silently skip if
      // the CPU verbs aren't installed (running headless outside core).
      try {
        const boot = env.get('cpu/boot!')
        if (typeof boot === 'function') boot()
      } catch { /* cpu/* not installed */ }
    }

    const files = listChapterFiles()
    let picked = null
    for (const f of files) {
      const rec = parseChapter(f)
      if (rec && rec.chapterNumber === chapterN) { picked = rec; break }
    }
    if (!picked) {
      for (const f of files) {
        const m = basename(f).match(/^(\d+)/)
        if (m && parseInt(m[1], 10) === chapterN) { picked = parseChapter(f); break }
      }
    }
    if (!picked) return false

    const blocks = extractCodeBlocks(picked.prose)
    if (blockN < 1 || blockN > blocks.length) return false

    const src = blocks[blockN - 1]
    let forms
    try { forms = parseScheme(src) } catch (e) {
      return `parse error in chapter ${chapterN} block ${blockN}: ${e.message}`
    }
    if (!forms || forms.length === 0) return false

    const fuelBox = fuel && typeof fuel === 'object' ? fuel : { n: 1_000_000 }
    let out
    for (const f of forms) out = evaluate(f, env, fuelBox)
    // Wave 2 (2026-07-19): every successful block run bumps the
    // per-block counter in reading-state. If the block errored, the
    // exception will already have thrown above; we only reach here on
    // success.
    try {
      const bump = env.get('motoi/mark-block-run!')
      if (typeof bump === 'function') bump('code', chapterN, blockN)
    } catch { /* reading-state not installed — skip */ }
    return out
  }, 'state-change')

  // (book-of-code/tutor [N]) — Motoi's voice. With no arg, it prints
  // the intro. With a chapter number, it prints an intro paragraph
  // then the chapter title + section headings — a "here's what we'll
  // do" preview a kid can skim before diving in.
  def('book-of-code/tutor', (n) => {
    if (n == null) return TUTOR_INTRO
    const num = Number(n)
    const files = listChapterFiles()
    let picked = null
    for (const f of files) {
      const rec = parseChapter(f)
      if (rec && rec.chapterNumber === num) { picked = rec; break }
    }
    if (!picked) {
      for (const f of files) {
        const m = basename(f).match(/^(\d+)/)
        if (m && parseInt(m[1], 10) === num) { picked = parseChapter(f); break }
      }
    }
    if (!picked) return TUTOR_NO_CHAPTER(num)

    const sections = splitSections(picked.prose)
    const blocks = extractCodeBlocks(picked.prose)

    const lines = []
    lines.push(`[motoi] Chapter ${num} — ${picked.title || '(untitled)'}.`)

    // Wave 2 (2026-07-19): progress bar at the top of every chapter
    // preview. Reads (motoi/reading-progress …) if the reading-state
    // module is installed. Silent-fail otherwise.
    try {
      const progressFn = env.get('motoi/reading-progress')
      if (typeof progressFn === 'function') {
        const named = sections.filter((s) => s.heading)
        const total = named.length || sections.length
        const alist = progressFn('code', num, total)
        // alist has :read + :total + :last-visited-at
        const read = alistGet(alist, ':read') ?? 0
        const totalOut = alistGet(alist, ':total') ?? total
        const last = alistGet(alist, ':last-visited-at') ?? 0
        if (totalOut && totalOut > 0) {
          const bar = progressBar(read, totalOut, 20)
          const lastStr = last ? humanizeAgo(last) : 'first visit'
          lines.push(`        Progress: ${bar}  ${read} / ${totalOut}  (${lastStr})`)
        }
      }
    } catch { /* reading-state absent */ }

    if (sections.length > 0) {
      const named = sections.filter((s) => s.heading)
      if (named.length > 0) {
        lines.push(`        We'll go through ${named.length} section${named.length === 1 ? '' : 's'}:`)
        for (const s of named) lines.push(`         · ${s.heading}`)
      }
    }
    if (blocks.length > 0) {
      lines.push(`        ${blocks.length} runnable Scheme block${blocks.length === 1 ? '' : 's'}.`)
      lines.push(`        Try (book-of-code/run-code-block ${num} 1) when you're ready.`)
    }
    if (num === 12) {
      lines.push('        This is the fetch/decode/execute one. The CPU is real.')
      lines.push("        Poke it: (cpu/boot!) (cpu/display) (cpu/step!).")
    }
    return lines.join('\n')
  })

  return env
}

export default installBookOfCodeTutor
