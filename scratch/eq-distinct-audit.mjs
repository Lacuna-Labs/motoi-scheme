// scratch/eq-distinct-audit.mjs — find false-distinctness eq? claims.
//
// In Motoi eq?/eqv?/equal? are ONE predicate: deep structural equality by
// value. So `(not (eq? a b))` is TRUE only when a and b differ in CONTENT,
// and FALSE whenever they have equal content — even if they are "different
// objects". Any program that builds two equal-content values and displays
// `(not (eq? ...))` to claim object-distinctness will print #f, contradicting
// its own label/prose. Those are the poison sites.
//
// This extracts every runnable program containing `not (eq?`, runs it live,
// and flags any whose stdout contains `#f` (the tell that a distinctness slot
// came back false). Output is a review worklist, NOT an auto-fix.
import { parse, Sym } from '../src/reader.js'
import { readFileSync, readdirSync, writeFileSync, statSync, mkdtempSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const NOTEQ = /not\s*\(\s*eq\?/

const programs = [] // {id, file, src}

const isKw = (x) => x instanceof Sym && x.name.startsWith(':')
const isProgramKey = (n) => /(?:code|program|composition)$/.test(n.replace(/^:/, ''))
const isNull = (s) => typeof s === 'string' &&
  (s.trimStart().startsWith(';; honest-null') || /honest-null/.test(s.slice(0, 40)))
function walkRef(node, file, sink) {
  if (!Array.isArray(node)) return
  for (let i = 0; i < node.length; i++) {
    const k = node[i]
    if (isKw(k) && isProgramKey(k.name) && typeof node[i + 1] === 'string' && !isNull(node[i + 1])) {
      sink.push({ id: `ref:${file}#${sink.length}`, file: `scheme/reference/${file}`, src: node[i + 1] })
    }
    if (Array.isArray(node[i])) walkRef(node[i], file, sink)
  }
}
const REF = 'scheme/reference'
for (const f of readdirSync(REF).filter((f) => f.endsWith('.slat'))) {
  let forms
  try { forms = parse(readFileSync(join(REF, f), 'utf8')) } catch { continue }
  const sink = []
  for (const form of forms) walkRef(form, f, sink)
  programs.push(...sink)
}

function schemeBlocks(text) {
  const out = []
  const re = /```scheme\n([\s\S]*?)```/g
  let m
  while ((m = re.exec(text)) !== null) {
    out.push(m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\'))
  }
  return out
}
const BOOKS = 'scheme-books'
for (const book of readdirSync(BOOKS)) {
  const bp = join(BOOKS, book)
  if (!statSync(bp).isDirectory()) continue
  for (const f of readdirSync(bp).filter((f) => f.endsWith('.slatl'))) {
    const bs = schemeBlocks(readFileSync(join(bp, f), 'utf8'))
    bs.forEach((b, i) => programs.push({ id: `book:${book}/${f}#${i}`, file: `scheme-books/${book}/${f}`, src: b }))
  }
}

const candidates = programs.filter((p) => NOTEQ.test(p.src))
console.error(`programs total: ${programs.length}   not-eq candidates: ${candidates.length}`)

const dir = mkdtempSync(join(tmpdir(), 'eqdist-'))
const tmp = join(dir, 'p.scm')
const flagged = []
const ranClean = []
for (const c of candidates) {
  writeFileSync(tmp, c.src)
  let out = '', status = 'CLEAN'
  try {
    out = execFileSync('./bin/motoi', ['run', tmp, '--fuel', '2000000'], { stdio: 'pipe', timeout: 30000 }).toString()
  } catch (e) {
    out = (e.stdout ? e.stdout.toString() : '') + (e.stderr ? e.stderr.toString() : '')
    status = 'FAIL'
  }
  if (status === 'FAIL') { flagged.push({ ...c, status, out: out.slice(0, 200) }); continue }
  if (/#f/.test(out)) flagged.push({ ...c, status: 'HAS-#f', out: out.trim().slice(0, 300) })
  else ranClean.push(c.id)
}
writeFileSync('scratch/eq-distinct-flagged.json', JSON.stringify(flagged, null, 2))
console.error(`clean(no #f): ${ranClean.length}   flagged(#f or fail): ${flagged.length}`)
console.error(`written scratch/eq-distinct-flagged.json`)
for (const f of flagged) console.error(`  [${f.status}] ${f.file}\n      ${f.out.replace(/\n/g, ' ⏎ ')}`)
