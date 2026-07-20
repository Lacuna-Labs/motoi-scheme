// book/reader.js — Motoi 0.75 book-reader runtime.
//
// Per Alfred (2026-07-17): "if we could shove even the tutorials, say it
// can read the book to you inside of the REPL or inside of the IDE… code
// examples inside of the IDE, it's runnable, and you have the black box
// as you think, and you hit enter."
//
// The book-reader turns scheme-books/ into a first-class runtime surface.
// Six verbs — book/list, book/read, book/toc, book/example, book/search,
// book/next, book/prev — plus REPL meta-commands (,books ,read ,example
// ,search ,next ,prev) that wrap them.
//
// Book files are `.book.slatl` / `.slat` chapter records with multi-line
// `:prose` strings. The SLAT parser is line-oriented and cannot ingest a
// chapter file directly; we ship a purpose-fit extractor here that pulls
// the :title and :prose fields (which is all this surface needs). We do
// NOT try to re-implement the full SLAT parser.
//
// Cursor state (last-book / last-chapter) persists across sessions via
// cortex/write under a fixed subject/predicate — the continuity doctrine.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { Sym } from '../../src/reader.js'
import { parse as parseScheme } from '../../src/reader.js'
import { evaluate } from '../../src/interp.js'

// ── constants ─────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url))
// scheme-books/ lives at repo root: motoi-scheme/scheme-books/.
// This file lives at lib/book/reader.js → up two → repo root.
const BOOKS_DIR = join(__dirname, '..', '..', 'scheme-books')

// Cursor storage: subject + predicate keys we reserve inside cortex.
const CURSOR_SUBJECT = 'book-cursor'
const CURSOR_PREDICATE = 'position'

// Cached book list — computed once per process.
let _bookListCache = null

// Cache of parsed chapter files, keyed by absolute path.
const _chapterCache = new Map()

// ── helpers ───────────────────────────────────────────────────────────

const nm = (x) => (x instanceof Sym ? x.name : x)

// Parse keyword-arg style: (:key1 val1 :key2 val2 …) → { key1: val1, … }
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

// Wrap a string to 80 columns, preserving paragraph breaks and NOT
// re-wrapping code fences or lines that begin with whitespace (already
// intentionally-indented content).
function wrap80(text, cols = 80) {
  const lines = text.split('\n')
  const out = []
  let inFence = false
  for (const line of lines) {
    if (line.startsWith('```')) {
      inFence = !inFence
      out.push(line)
      continue
    }
    if (inFence || line.startsWith('  ') || line.startsWith('\t') || line.length <= cols) {
      out.push(line)
      continue
    }
    // Word-wrap this line.
    const words = line.split(/\s+/)
    let cur = ''
    for (const w of words) {
      if (cur.length === 0) { cur = w; continue }
      if (cur.length + 1 + w.length > cols) { out.push(cur); cur = w }
      else cur = cur + ' ' + w
    }
    if (cur.length) out.push(cur)
  }
  return out.join('\n')
}

// ── book directory scanning ───────────────────────────────────────────

// Return a sorted list of book slugs (without the `book-of-` prefix).
// Skips `_archive`, files (not dirs), and empty dirs.
export function listBooks() {
  if (_bookListCache) return _bookListCache
  if (!existsSync(BOOKS_DIR)) { _bookListCache = []; return [] }
  const entries = readdirSync(BOOKS_DIR)
  const out = []
  for (const name of entries) {
    if (name.startsWith('_')) continue          // _archive
    if (name.startsWith('.')) continue           // dotfiles
    if (!name.startsWith('book-of-')) continue
    const full = join(BOOKS_DIR, name)
    let s
    try { s = statSync(full) } catch { continue }
    if (!s.isDirectory()) continue
    // Skip empty dirs (no chapter/appendix content of any kind).
    let contents
    try { contents = readdirSync(full) } catch { continue }
    const chapterFiles = contents.filter((f) =>
      (f.endsWith('.book.slatl') || f.endsWith('.slat')) &&
      !f.startsWith('MANIFEST') &&
      !f.startsWith('00-manifest') &&
      !f.startsWith('00-outline'))
    if (chapterFiles.length === 0) continue
    out.push(name.replace(/^book-of-/, ''))
  }
  out.sort()
  _bookListCache = out
  return out
}

// Test seam — clear the memoized book list.
export function _clearBookListCache() {
  _bookListCache = null
  _chapterCache.clear()
}

// Resolve a book slug (e.g. 'jesse') back to its directory.
//
// Sandbox: slug must be [A-Za-z0-9_-]+ (no dots, no slashes, no path
// tricks). Alfred lock (2026-07-17) — a caller-supplied slug like
// `../../../etc/passwd` used to compose a directory that resolved
// outside BOOKS_DIR; the regex + startsWith check now refuse those.
function bookDir(slug) {
  const s = String(slug || '')
  if (!s || !/^[A-Za-z0-9_-]+$/.test(s)) return null
  const dir = join(BOOKS_DIR, 'book-of-' + s)
  // Belt-and-braces: even a clean regex-passing slug must resolve back
  // under BOOKS_DIR (defense against Node path quirks).
  if (!dir.startsWith(BOOKS_DIR)) return null
  if (!existsSync(dir)) return null
  return dir
}

// List chapter files for a book, sorted by numeric prefix. Excludes
// MANIFEST/outline; keeps ch/appendix ordering natural.
function listChapterFiles(slug) {
  const dir = bookDir(slug)
  if (!dir) return []
  const all = readdirSync(dir)
  const chapters = []
  for (const f of all) {
    if (!(f.endsWith('.book.slatl') || f.endsWith('.slat'))) continue
    if (f.startsWith('MANIFEST')) continue
    if (f.startsWith('00-manifest') || f.startsWith('00-outline')) continue
    chapters.push(f)
  }
  // Sort: numbered chapters first (natural), then appendices.
  chapters.sort((a, b) => {
    const na = a.match(/^(\d+)/)
    const nb = b.match(/^(\d+)/)
    if (na && nb) return parseInt(na[1], 10) - parseInt(nb[1], 10)
    if (na && !nb) return -1
    if (!na && nb) return 1
    return a.localeCompare(b)
  })
  return chapters.map((f) => join(dir, f))
}

// ── chapter parser ────────────────────────────────────────────────────
//
// A chapter file looks like:
//   (chapter
//     :book "..."
//     :chapter-number 13
//     :title "..."
//     :prose
//   "multi-line string with \n escapes")
//
// The SLAT parser is line-oriented (fails on multi-line strings). We
// extract the fields we need directly.
//
// Returns: { title, chapterNumber, prose, book } or null on failure.
function parseChapter(absPath) {
  if (_chapterCache.has(absPath)) return _chapterCache.get(absPath)
  let src
  try { src = readFileSync(absPath, 'utf8') } catch { return null }

  const rec = { title: null, chapterNumber: null, prose: '', book: null, path: absPath }

  // Extract :title  "value"
  const titleM = src.match(/:title\s+"((?:[^"\\]|\\.)*)"/)
  if (titleM) rec.title = unescapeStr(titleM[1])

  // :chapter-number N (integer or decimal)
  const chNumM = src.match(/:chapter-number\s+([\d.]+)/)
  if (chNumM) rec.chapterNumber = parseFloat(chNumM[1])

  // :book "value"
  const bookM = src.match(/:book\s+"((?:[^"\\]|\\.)*)"/)
  if (bookM) rec.book = unescapeStr(bookM[1])

  // :prose  "…\n…" — capture the entire quoted string. The string may
  // contain \n escapes AND literal newlines (SLAT strings preserve both
  // in raw form). We scan by hand: find `:prose` then the next `"` and
  // walk to the matching closing `"`, respecting `\` escapes.
  const proseIdx = src.indexOf(':prose')
  if (proseIdx >= 0) {
    let i = proseIdx + ':prose'.length
    // skip whitespace
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

  _chapterCache.set(absPath, rec)
  return rec
}

function unescapeStr(s) {
  return s
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
}

// ── example extraction ────────────────────────────────────────────────
//
// Chapters embed runnable Scheme in markdown fences: ```scheme … ```.
// We extract these in order; caller asks for the Nth (1-based).
function extractExamples(prose) {
  if (!prose) return []
  const out = []
  const re = /```scheme\s*\n([\s\S]*?)\n```/g
  let m
  while ((m = re.exec(prose)) !== null) {
    out.push(m[1])
  }
  return out
}

// ── verbs ─────────────────────────────────────────────────────────────

export function installBookReader(env, fuel) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  // (book/list) → list of book slugs (strings, without the book-of- prefix).
  def('book/list', () => {
    return listBooks()
  })

  // (book/read :book 'introspection [:chapter N] [:section M]) → string.
  def('book/read', (...args) => {
    const opts = kwargsToObj(args)
    const slug = opts.book != null ? String(opts.book) : null
    if (!slug) return `usage: (book/read :book 'name [:chapter N] [:section M])\n\navailable books:\n  ${listBooks().join('\n  ')}`
    const dir = bookDir(slug)
    if (!dir) {
      return `no such book: ${slug}\n\navailable books:\n  ${listBooks().join('\n  ')}`
    }
    const chapNumRaw = opts.chapter
    if (chapNumRaw == null) {
      // No chapter → return manifest + outline.
      const files = listChapterFiles(slug)
      const lines = []
      lines.push(`# Book of ${cap(slug)}`)
      lines.push('')
      // Try MANIFEST.slat for one-line description; fall back silently.
      const one = readOneLine(dir)
      if (one) { lines.push(one); lines.push('') }
      lines.push(`Chapters (${files.length}):`)
      for (const f of files) {
        const rec = parseChapter(f)
        if (!rec) continue
        const num = rec.chapterNumber != null ? String(rec.chapterNumber) : ''
        const title = rec.title || basename(f)
        lines.push(`  ${num.padStart(3)}  ${title}`)
      }
      return wrap80(lines.join('\n'))
    }
    const files = listChapterFiles(slug)
    const chapNum = Number(chapNumRaw)
    // Find chapter by number (prefer :chapter-number match, else numeric-prefix match).
    let picked = null
    for (const f of files) {
      const rec = parseChapter(f)
      if (rec && rec.chapterNumber === chapNum) { picked = rec; break }
    }
    if (!picked) {
      // Fall back to filename numeric prefix.
      for (const f of files) {
        const m = basename(f).match(/^(\d+)/)
        if (m && parseInt(m[1], 10) === chapNum) { picked = parseChapter(f); break }
      }
    }
    if (!picked) return `no such chapter: ${chapNum} in book ${slug}`
    let prose = picked.prose || ''
    const sectionRaw = opts.section
    if (sectionRaw != null) {
      const sectionNum = Number(sectionRaw)
      const sections = splitSections(prose)
      if (sectionNum < 1 || sectionNum > sections.length) {
        return `no such section: ${sectionNum} (chapter has ${sections.length} sections)`
      }
      prose = sections[sectionNum - 1]
    }
    return wrap80(prose)
  })

  // (book/toc :book 'jesse) → list of chapter titles.
  def('book/toc', (...args) => {
    const opts = kwargsToObj(args)
    const slug = opts.book != null ? String(opts.book) : null
    if (!slug) return []
    const files = listChapterFiles(slug)
    const out = []
    for (const f of files) {
      const rec = parseChapter(f)
      out.push(rec && rec.title ? rec.title : basename(f))
    }
    return out
  })

  // (book/example :book 'composition :chapter 5 :example 2 [:run? #t])
  //   → form (default) or evaluated result (:run? #t).
  def('book/example', (...args) => {
    const opts = kwargsToObj(args)
    const slug = opts.book != null ? String(opts.book) : null
    if (!slug) return false
    const chapNum = Number(opts.chapter)
    const exNum = Number(opts.example ?? 1)
    const run = opts['run?'] === true || opts.run === true
    const files = listChapterFiles(slug)
    let picked = null
    for (const f of files) {
      const rec = parseChapter(f)
      if (rec && rec.chapterNumber === chapNum) { picked = rec; break }
    }
    if (!picked) {
      for (const f of files) {
        const m = basename(f).match(/^(\d+)/)
        if (m && parseInt(m[1], 10) === chapNum) { picked = parseChapter(f); break }
      }
    }
    if (!picked) return false
    const examples = extractExamples(picked.prose)
    if (exNum < 1 || exNum > examples.length) return false
    const src = examples[exNum - 1]
    let forms
    try { forms = parseScheme(src) } catch { return src }  // parse failure → raw string
    if (!forms || forms.length === 0) return false
    if (!run) {
      // Return the first form (or a (begin …) wrapper if multiple).
      if (forms.length === 1) return forms[0]
      return [new Sym('begin'), ...forms]
    }
    // Evaluate every form; return last value.
    const fuelBox = fuel && typeof fuel === 'object' ? fuel : { n: 1_000_000 }
    let out
    for (const f of forms) out = evaluate(f, env, fuelBox)
    return out
  })

  // (book/search "query") → top-10 list of ((:book B) (:chapter N) (:snippet S)).
  def('book/search', (query) => {
    const q = String(nm(query) || '').toLowerCase()
    if (!q) return []
    const hits = []
    for (const slug of listBooks()) {
      const files = listChapterFiles(slug)
      for (const f of files) {
        const rec = parseChapter(f)
        if (!rec || !rec.prose) continue
        const lower = rec.prose.toLowerCase()
        const idx = lower.indexOf(q)
        if (idx < 0) continue
        // Build a 1-line snippet around the hit.
        const start = Math.max(0, idx - 30)
        const end = Math.min(rec.prose.length, idx + q.length + 40)
        let snippet = rec.prose.slice(start, end).replace(/\s+/g, ' ').trim()
        if (start > 0) snippet = '…' + snippet
        if (end < rec.prose.length) snippet = snippet + '…'
        hits.push({
          slug,
          chapterNumber: rec.chapterNumber,
          snippet,
          score: -idx, // earlier = higher score
        })
      }
    }
    hits.sort((a, b) => b.score - a.score)
    return hits.slice(0, 10).map((h) => [
      [new Sym(':book'),    new Sym(h.slug)],
      [new Sym(':chapter'), h.chapterNumber ?? false],
      [new Sym(':snippet'), h.snippet],
    ])
  })

  // (book/next) — advance cursor to next chapter; return new (book, chapter).
  def('book/next', () => cursorMove(env, +1))

  // (book/prev) — rewind cursor by one chapter.
  def('book/prev', () => cursorMove(env, -1))

  return env
}

// ── cursor implementation ─────────────────────────────────────────────
//
// State: (:book slug :chapter N). Persisted via cortex/write when
// cortex/write is registered on the env; otherwise falls back to a
// process-local variable so the verb still works headless.

let _memoryCursor = null

function readCursor(env) {
  try {
    const fn = env.get('cortex/read')
    if (typeof fn === 'function') {
      const key = CURSOR_SUBJECT + '.' + CURSOR_PREDICATE
      const v = fn(key)
      if (v && typeof v === 'object' && v.book) return v
    }
  } catch { /* cortex not registered */ }
  return _memoryCursor
}

function writeCursor(env, cursor) {
  _memoryCursor = cursor
  try {
    const fn = env.get('cortex/write')
    if (typeof fn === 'function') {
      const key = CURSOR_SUBJECT + '.' + CURSOR_PREDICATE
      fn(key, cursor)
    }
  } catch { /* soft-fail */ }
}

function cursorMove(env, delta) {
  const books = listBooks()
  let cur = readCursor(env)
  if (!cur) {
    // No cursor yet — start at the first book, first chapter.
    if (books.length === 0) return false
    const first = books[0]
    const files = listChapterFiles(first)
    const rec = files.length ? parseChapter(files[0]) : null
    cur = { book: first, chapter: rec && rec.chapterNumber != null ? rec.chapterNumber : 1 }
    writeCursor(env, cur)
    return renderCursor(cur)
  }
  const files = listChapterFiles(cur.book)
  const numbers = files
    .map((f) => parseChapter(f))
    .filter((r) => r && r.chapterNumber != null)
    .map((r) => r.chapterNumber)
  const idx = numbers.indexOf(cur.chapter)
  const nextIdx = idx + delta
  if (nextIdx >= 0 && nextIdx < numbers.length) {
    cur = { book: cur.book, chapter: numbers[nextIdx] }
    writeCursor(env, cur)
    return renderCursor(cur)
  }
  // Fell off either end — move to adjacent book if possible.
  const bookIdx = books.indexOf(cur.book)
  const nextBookIdx = bookIdx + delta
  if (nextBookIdx < 0 || nextBookIdx >= books.length) return renderCursor(cur)  // clamp
  const nextBook = books[nextBookIdx]
  const nextFiles = listChapterFiles(nextBook)
  const nextNumbers = nextFiles
    .map((f) => parseChapter(f))
    .filter((r) => r && r.chapterNumber != null)
    .map((r) => r.chapterNumber)
  if (nextNumbers.length === 0) return renderCursor(cur)
  const target = delta > 0 ? nextNumbers[0] : nextNumbers[nextNumbers.length - 1]
  cur = { book: nextBook, chapter: target }
  writeCursor(env, cur)
  return renderCursor(cur)
}

function renderCursor(cur) {
  return [
    [new Sym(':book'),    new Sym(cur.book)],
    [new Sym(':chapter'), cur.chapter],
  ]
}

// ── misc helpers ──────────────────────────────────────────────────────

function cap(s) {
  return s.split('-').map((w) => w[0]?.toUpperCase() + w.slice(1)).join(' ')
}

function readOneLine(dir) {
  const candidates = ['MANIFEST.slat', '00-manifest.slat']
  for (const name of candidates) {
    const p = join(dir, name)
    if (!existsSync(p)) continue
    try {
      const src = readFileSync(p, 'utf8')
      const m = src.match(/:one-line\s+"((?:[^"\\]|\\.)*)"/)
      if (m) return unescapeStr(m[1])
      const anchor = src.match(/:anchor\s+"((?:[^"\\]|\\.)*)"/)
      if (anchor) return unescapeStr(anchor[1])
    } catch { /* skip */ }
  }
  return null
}

// Split a chapter's prose by markdown `## ` section headers.
// Returns a list of section bodies (each string starts with its `## ` header).
function splitSections(prose) {
  const lines = prose.split('\n')
  const sections = []
  let cur = []
  for (const line of lines) {
    if (/^##\s/.test(line)) {
      if (cur.length) sections.push(cur.join('\n'))
      cur = [line]
    } else {
      cur.push(line)
    }
  }
  if (cur.length) sections.push(cur.join('\n'))
  return sections
}

export default installBookReader
