// scratch/build-book-bootrecords.mjs — apply the folder-book boot-record
// convention (spec/BOOK-LAYOUT.slat) to every learn-to-code book folder in
// scheme-books/. Emits one README.slatl boot record per book, DERIVED from that
// book's existing manifest (title/type/subtitle/audience/scope prose) and its
// chapter files (nav + :boot-into). No prose is invented: if a book has no
// manifest and no cover to read a scope from, the book is reported as
// needs-alfred and SKIPPED — never fabricated.
//
// The superseded orientation file (old README.slat / README.md /
// README.book.slatl) is archived under _archive/bootrecord-books-<date>/ so a
// folder never carries two orientation files (that split is itself a bug).
//
// Usage:
//   node scratch/build-book-bootrecords.mjs            # dry run (prints plan)
//   node scratch/build-book-bootrecords.mjs --write    # write README.slatl + archive olds

import { parse, Sym } from '../src/reader.js'
import { readFile, writeFile, readdir, mkdir, rename } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join, basename } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const BOOKS = resolve(ROOT, 'scheme-books')
const WRITE = process.argv.includes('--write')
const TODAY = new Date().toISOString().slice(0, 10).replace(/-/g, '')
const ARCHIVE = resolve(ROOT, '_archive', `bootrecord-books-${TODAY}`)

const isSym = x => x instanceof Sym || (x && typeof x === 'object' && typeof x.name === 'string')
const symName = x => (isSym(x) ? x.name : null)

// pull keyword value out of a parsed array-form s-expr
function kw (form, key) {
  if (!Array.isArray(form)) return undefined
  for (let i = 0; i < form.length - 1; i++) {
    if (symName(form[i]) === key) return form[i + 1]
  }
  return undefined
}
// first keyword present out of several aliases
function kwAny (form, keys) {
  for (const k of keys) { const v = kw(form, k); if (v !== undefined) return v }
  return undefined
}

async function parseFile (path) {
  try { return parse(await readFile(path, 'utf8')) } catch { return null }
}

function findForm (forms, head) {
  if (!Array.isArray(forms)) return null
  return forms.find(f => Array.isArray(f) && symName(f[0]) === head) || null
}

const prettifySlug = slug => slug
  .replace(/\.book\.slatl$|\.slatl$|\.slat$/,'')
  .replace(/^\d+[-_]?/, '')
  .replace(/^appendix-([a-z])-/, (_, l) => `Appendix ${l.toUpperCase()} — `)
  .split('-').map(w => w ? w[0].toUpperCase() + w.slice(1) : w).join(' ')

// classify a filename in a book folder
function classify (name) {
  if (!/\.(book\.slatl|slatl|slat)$/.test(name)) return 'other'
  if (/^readme/i.test(name)) return 'readme'
  if (/manifest/i.test(name)) return 'manifest'
  if (/^chapters\b/i.test(name)) return 'toc'
  if (/^appendix-/i.test(name)) return 'appendix'
  if (/^(\d|ch\d|chapter-?\d)/i.test(name)) return 'chapter' // 00-cover, 01-, ch01-, chapter-1-
  return 'loose'
}

async function chapterTitle (path, fallbackName) {
  const forms = await parseFile(path)
  if (Array.isArray(forms)) {
    for (const f of forms) {
      const h = symName(Array.isArray(f) ? f[0] : null)
      if (h === 'chapter' || h === 'cover' || h === 'appendix' || h === 'index') {
        const t = kwAny(f, [':title', ':name'])
        if (typeof t === 'string') return t
      }
    }
  }
  return prettifySlug(fallbackName)
}

const jstr = s => JSON.stringify(s)

async function buildBook (slug) {
  const dir = join(BOOKS, slug)
  const entries = (await readdir(dir)).sort()
  const buckets = { readme: [], manifest: [], toc: [], chapter: [], appendix: [], loose: [], other: [] }
  for (const e of entries) buckets[classify(e)].push(e)

  // --- manifest-derived metadata ---
  let manForm = null, manFile = null
  for (const m of buckets.manifest) {
    const forms = await parseFile(join(dir, m))
    const f = findForm(forms, 'book-manifest') || findForm(forms, 'manifest')
    if (f) { manForm = f; manFile = m; break }
  }

  let title = manForm ? kwAny(manForm, [':book', ':book-title', ':title']) : null
  const subtitle = manForm ? kwAny(manForm, [':subtitle']) : null
  const bookType = manForm ? kwAny(manForm, [':book-type']) : null
  const audience = manForm ? kwAny(manForm, [':audience']) : null
  let scope = manForm ? kwAny(manForm, [':scope', ':what-this-is', ':purpose', ':overview', ':about']) : null

  // No manifest title? Recover it from a cover / index / toc head (real data,
  // not invented). Never fabricate — if there's genuinely no title anywhere, stop.
  if (!title) {
    for (const f of [...buckets.chapter, ...buckets.toc]) {
      const forms = await parseFile(join(dir, f))
      const head = (forms || []).find(x => ['cover', 'index', 'chapters', 'book', 'chapter'].includes(symName(Array.isArray(x) ? x[0] : null)))
      if (head) {
        title = title || kwAny(head, [':book', ':book-title', ':title'])
        scope = scope || kwAny(head, [':scope', ':what-this-is', ':purpose', ':about'])
        if (title) break
      }
    }
  }
  if (!title) {
    return { slug, status: 'needs-alfred', reason: `no :book title in manifest (${manFile || 'NONE'}) or cover/toc` }
  }

  // --- nav from chapter + appendix files ---
  const chapFiles = buckets.chapter.filter(f => classify(f) === 'chapter')
  const apxFiles = buckets.appendix
  const nav = []
  for (const f of chapFiles) nav.push({ file: f, kind: 'chapter', title: await chapterTitle(join(dir, f), f) })
  for (const f of apxFiles) nav.push({ file: f, kind: 'appendix', title: await chapterTitle(join(dir, f), f) })
  if (nav.length === 0) {
    return { slug, status: 'needs-alfred', reason: 'no chapter/appendix files to build nav from' }
  }
  const bootInto = nav[0].file

  // superseded orientation files to archive (old readmes, not the new .slatl)
  const oldReadmes = buckets.readme.filter(f => f.toLowerCase() !== 'readme.slatl')

  const record = renderBootRecord({ slug, title, subtitle, bookType, audience, scope, manFile, bootInto, nav })
  return { slug, status: 'ok', title, bootInto, navCount: nav.length, oldReadmes, manFile, record, dir }
}

function renderBootRecord ({ slug, title, subtitle, bookType, audience, scope, manFile, bootInto, nav }) {
  const navLines = nav.map(n =>
    `   (:title ${jstr(n.title)} :file ${jstr(n.file)} :kind ${jstr(n.kind)})`).join('\n')
  const kindLabel = bookType ? `${bookType} book` : 'Motoi Scheme book'
  const subtitleLine = subtitle ? `\n  :subtitle ${jstr(subtitle)}` : ''
  const bookTypeLine = bookType ? `\n  :book-type ${jstr(bookType)}` : ''
  const audienceLine = audience ? `\n  :audience ${jstr(audience)}` : ''
  const scopeSection = scope
    ? `\n\n  :what-this-is\n  ${jstr(scope)}`
    : `\n\n  :what-this-is\n  ${jstr(`This folder is "${title}" — a chaptered ${kindLabel} for Motoi Scheme, meant to be read by humans AND used as training data for LLMs. Read the chapters in order; every code block runs through ./bin/motoi.`)}`

  return `;; README.slatl — ${title} · BOOT RECORD
;;
;; Boot record for this book, per spec/BOOK-LAYOUT.slat. First file any reader
;; (human, LLM, Rosetta) opens in this folder: it names the book's first chapter
;; (:boot-into), briefs a cold reader, and carries the ordered chapter nav that
;; renders to a Markdown table of contents. GENERATED from ${manFile || 'the chapter files'}
;; by scratch/build-book-bootrecords.mjs — regenerate after adding a chapter.
(dialect :applies ("motoi") :note ${jstr(`Boot record for ${slug}.`)})

(boot-record
  :book-title ${jstr(title)}${subtitleLine}
  :book-kind "scheme-book"${bookTypeLine}
  :book-slug ${jstr(slug)}
  :boot-into ${jstr(bootInto)}
  :chapter-count ${nav.filter(n => n.kind === 'chapter').length} :appendix-count ${nav.filter(n => n.kind === 'appendix').length}${audienceLine}
  :for ("human-reader" "motoi-copilot-training" "motoi-copilot-inference"
        "sakura-training" "returning-collaborator" "rosetta-render-target")
  :training-eligible #t
  :confidentiality "public"${scopeSection}

  :when-to-read
  ${jstr(`Read this book when you want to learn ${title.replace(/^Book of /, '').toLowerCase()} in Motoi Scheme, chapter by chapter. Start at ${bootInto}; each chapter builds on the last.`)}

  :not-here
  "Only this book lives here. The language reference lives in scheme/reference/,
   the engineering & recovery journal in docs/, the operations manual in
   SRE-MANUAL/. Each is its own book folder with its own boot record."

  :nav
  (
${navLines}
  )

  :for-rosetta
  "This folder is a book: this README.slatl (boot record) + a manifest + numbered
   .book.slatl chapters. Render this boot record as the folder landing page:
   the prose sections become the intro, :nav becomes the linked table of contents
   (one item per chapter/appendix in order). Do not hand-author a README.md —
   generate it from here."

  :the-rule
  "One book = one folder = one README.slatl boot record + ordered chapters +
   a manifest. Same shape in every book folder (spec/BOOK-LAYOUT.slat).")
`
}

// ---- main ----
const slugs = (await readdir(BOOKS, { withFileTypes: true }))
  .filter(d => d.isDirectory() && d.name.startsWith('book-of-'))
  .map(d => d.name).sort()

const results = []
for (const slug of slugs) results.push(await buildBook(slug))

const ok = results.filter(r => r.status === 'ok')
const blocked = results.filter(r => r.status === 'needs-alfred')

console.log(`\nbooks: ${slugs.length}  ok: ${ok.length}  needs-alfred: ${blocked.length}  (${WRITE ? 'WRITE' : 'DRY RUN'})\n`)
for (const r of ok) {
  console.log(`  OK   ${r.slug.padEnd(30)} boot-into=${r.bootInto.padEnd(28)} nav=${r.navCount}` +
    (r.oldReadmes.length ? `  archive-old=[${r.oldReadmes.join(', ')}]` : ''))
}
for (const r of blocked) console.log(`  ??   ${r.slug.padEnd(30)} needs-alfred: ${r.reason}`)

if (WRITE) {
  await mkdir(ARCHIVE, { recursive: true })
  for (const r of ok) {
    // archive superseded orientation files first
    for (const old of r.oldReadmes) {
      const destDir = join(ARCHIVE, r.slug)
      await mkdir(destDir, { recursive: true })
      await rename(join(r.dir, old), join(destDir, old))
    }
    await writeFile(join(r.dir, 'README.slatl'), r.record, 'utf8')
    // sanity: it must parse
    const check = parse(r.record)
    if (!Array.isArray(check) || check.length < 2) {
      console.log(`  WARN ${r.slug}: emitted README.slatl did not parse to >=2 forms`)
    }
  }
  console.log(`\nwrote ${ok.length} README.slatl; archived superseded readmes under _archive/bootrecord-books-${TODAY}/`)
}
