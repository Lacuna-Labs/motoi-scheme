// scratch/build-reference-bootrecord.mjs — emit scheme/reference/README.slatl,
// the boot record for the Motoi Scheme Reference Manual, per spec/BOOK-LAYOUT.slat.
// The :nav list is DERIVED from MANIFEST.slat so the boot record and the machine
// index never drift. Prose sections are authored here (a boot record must brief a
// cold reader). Regenerate after adding/reordering a chapter.
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { parse } from '../src/reader.js'

const REF = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'scheme', 'reference')

// pull a keyword value out of a parsed s-expr record (array form).
// src/reader.js represents symbols/keywords as { name: ":number" }.
function kw (record, key) {
  for (let i = 0; i < record.length - 1; i++) {
    if (record[i] && record[i].name === key) return record[i + 1]
  }
  return undefined
}

const manifestText = await readFile(resolve(REF, 'MANIFEST.slat'), 'utf8')
const forms = parse(manifestText)
const manifest = forms.find(f => Array.isArray(f) && f[0] && f[0].name === 'manifest')
const chaptersKw = kw(manifest, ':chapters')

// chaptersKw is a list of (:number .. :file .. :library .. :kind .. :title .. :verb-count ..)
const ACRONYM = { ai: 'AI', io: 'IO', nt: 'NT' } // keep known acronyms uppercase
const nice = lib => lib
  ? lib.split('-').map(w => ACRONYM[w] || (w[0].toUpperCase() + w.slice(1))).join(' ')
  : null
const verbs = n => (n == null ? '' : ` — ${n} verb${Number(n) === 1 ? '' : 's'}`)
const navLines = []
for (const ch of chaptersKw) {
  const num = kw(ch, ':number')
  const file = kw(ch, ':file')
  const lib = kw(ch, ':library')
  const kind = kw(ch, ':kind')
  const title = kw(ch, ':title')
  const vc = kw(ch, ':verb-count')
  const label = kind === 'intro' ? 'Introduction'
    : kind === 'appendix' ? (title || 'Appendix — Row-4/Row-5 prose')
    : title || (lib ? `${nice(lib)} library` : (kind || 'chapter'))
  const purpose = kind === 'intro' ? 'welcome + how to read + the five-row rules'
    : kind === 'appendix' ? 'Row-4/Row-5 prose essays (migrating in)'
    : kind === 'meta-chapter' ? `${lib ? `the ${lib} library${verbs(vc)}` : 'meta-chapter — how the language sees itself and loads'}`
    : lib ? `the ${lib} library${verbs(vc)}`
    : 'meta-chapter'
  navLines.push(
    `   (:n ${JSON.stringify(String(num))} :title ${JSON.stringify(String(label))} :file ${JSON.stringify(String(file))} :purpose ${JSON.stringify(purpose)})`
  )
}

const chapterCount = kw(manifest, ':chapter-count')
const verbCount = kw(manifest, ':verb-count')
const libraryCount = kw(manifest, ':library-count')

const out = `;; README.slatl — Motoi Scheme Reference Manual · BOOT RECORD
;;
;; This is the boot record for this book, per spec/BOOK-LAYOUT.slat. It is the
;; first file any reader (human, LLM, Rosetta) opens in this folder. It names the
;; book's first chapter (:boot-into), briefs a cold reader on what the book is /
;; when to read it / what is inside, and carries the ordered chapter nav that
;; renders to a Markdown table of contents. The :nav below is generated from
;; MANIFEST.slat by scratch/build-reference-bootrecord.mjs — do not hand-edit the
;; nav; edit the manifest and regenerate.
(dialect :applies ("motoi") :note "Boot record for the Motoi Scheme Reference Manual.")

(boot-record
  :book-title "Motoi Scheme Reference Manual"
  :book-kind  "reference-manual"
  :book-slug  "motoi-scheme-reference"
  :boot-into  "00-intro.slat"
  :chapter-count ${chapterCount} :verb-count ${verbCount} :library-count ${libraryCount}
  :for        ("human-reader" "llm-training" "llm-inference"
               "returning-collaborator" "rosetta-render-target")
  :training-eligible #t
  :confidentiality "public"

  :what-this-is
  "This folder is the Motoi Scheme Reference Manual — ONE book, many chapters.
   Every callable verb in the Motoi runtime has a record in one of these chapters.
   The reference IS the language: when the reference and the code disagree, the
   reference wins. It is written to be read by humans AND used as training data
   for LLMs (Motoi Copilot, Sakura). This is the language itself — not the
   engineering journal, not the learn-to-code books; those are other shelves
   (see :not-here)."

  :when-to-read
  "Read this book when you need to know what a verb does, what standard it comes
   from, how to call it, and how it composes — the ground truth of the language.
   Reach for 00-intro first if you are new; jump straight to a library chapter
   if you know the namespace you need. If you are rebuilding the system, this is
   the specification you rebuild the runtime AGAINST."

  :whats-inside
  "An intro (how to read + the five-row rules), four meta-chapters (introspection,
   runtime & composition, loading, and the standard library — R7RS-small + the
   named SRFI parts and where each verb comes from), one chapter per library
   (${libraryCount} libraries), and a prose appendix. Every verb entry carries its
   origin standard (:std) and provenance, its signature, and up to fifteen runnable
   example programs across five rows (HOW · WHEN · WHERE-ELSE · WHY · WITH-WHAT-ELSE)."

  :not-here
  "Only the LANGUAGE lives here. The engineering & recovery journal (how the system
   is built and rebuilt) lives in docs/. The narrative learn-to-code books live in
   scheme-books/. The operations manual lives in SRE-MANUAL/. Each is its own book
   folder with its own boot record."

  :nav
  (
${navLines.join('\n')}
  )

  :for-rosetta
  "This folder is a book. Signals: this README.slatl (boot record) + MANIFEST.slat
   (machine index) + numbered chapter files. Render this boot record as the folder
   landing page: :what-this-is / :when-to-read / :whats-inside become the intro,
   :nav becomes the linked table of contents (one item per chapter in order,
   annotated with :purpose). Render each chapter as its own page. Cross-link verbs
   by :name across chapters. Do not hand-author a README.md — generate it from here."

  :the-rule
  "One book = one folder = one README.slatl boot record + ordered chapters +
   MANIFEST.slat. Same shape in every book folder (spec/BOOK-LAYOUT.slat). The
   format rules for verb entries live in 00-intro.slat (five rows, the numbered
   rules) and are summarized at the top of every library chapter.")
`

await writeFile(resolve(REF, 'README.slatl'), out, 'utf8')
console.log(`scheme/reference/README.slatl written. chapters=${chapterCount} nav-entries=${navLines.length}`)
