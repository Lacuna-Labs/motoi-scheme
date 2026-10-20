// scratch/eq-audit.mjs — blast-radius audit for the _eqQ (equal?/eqv?/eq?/=?) bug.
//
// The bug threw a JS "Cannot use 'in' operator to search for 'name'" ONLY when a
// call to =?/equal?/eq?/eqv? had (symbol-first, truthy-primitive-second) args.
// So the ONLY candidate programs are those that textually call one of those 4
// verbs. This script extracts every runnable program from the three corpora,
// filters to candidates, and (with --run) runs each candidate through the live
// ./bin/motoi, recording which throw the signature error.
//
// Run it once against the buggy interpreter and once against the fixed one; the
// set that flips FAIL->CLEAN with the signature error is the blast radius.
//
// Usage:
//   node scratch/eq-audit.mjs            # size the candidate set (no running)
//   node scratch/eq-audit.mjs --run OUT  # run candidates, write results to OUT
import { parse, Sym } from '../src/reader.js'
import { readFileSync, readdirSync, writeFileSync, statSync, mkdtempSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const EQ = /(?:^|[^\w?!])(=\?|equal\?|eqv\?|eq\?)(?:[^\w?!]|$)/

// --- extract programs from all three corpora, tagged by origin ---
const programs = [] // {id, src}

// reference: reader-based, program-key slots
const isKw = (x) => x instanceof Sym && x.name.startsWith(':')
const isProgramKey = (n) => /(?:code|program|composition)$/.test(n.replace(/^:/, ''))
const isNull = (s) => typeof s === 'string' &&
  (s.trimStart().startsWith(';; honest-null') || /honest-null/.test(s.slice(0, 40)))
function walkRef(node, file, sink) {
  if (!Array.isArray(node)) return
  for (let i = 0; i < node.length; i++) {
    const k = node[i]
    if (isKw(k) && isProgramKey(k.name) && typeof node[i + 1] === 'string' && !isNull(node[i + 1])) {
      sink.push({ id: `ref:${file}#${sink.length}`, src: node[i + 1] })
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

// books: ```scheme blocks (each block independently, matches book grader unescape)
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
    bs.forEach((b, i) => programs.push({ id: `book:${book}/${f}#${i}`, src: b }))
  }
}

// carts: whole .sks files
const CARTS = 'carts'
for (const f of readdirSync(CARTS).filter((f) => f.endsWith('.sks'))) {
  programs.push({ id: `cart:${f}`, src: readFileSync(join(CARTS, f), 'utf8') })
}

const candidates = programs.filter((p) => EQ.test(p.src))
console.error(`programs total: ${programs.length}   eq-candidates: ${candidates.length}`)
const byOrigin = {}
for (const c of candidates) { const o = c.id.split(':')[0]; byOrigin[o] = (byOrigin[o] || 0) + 1 }
console.error(`candidates by origin: ${JSON.stringify(byOrigin)}`)

const runIdx = process.argv.indexOf('--run')
if (runIdx === -1) process.exit(0)
const OUT = process.argv[runIdx + 1]

// run each candidate through live ./bin/motoi; record clean / signature-throw / other-fail
const dir = mkdtempSync(join(tmpdir(), 'eqaudit-'))
const tmp = join(dir, 'p.scm')
const results = []
for (const c of candidates) {
  writeFileSync(tmp, c.src)
  let status = 'CLEAN', err = ''
  try {
    execFileSync('./bin/motoi', ['run', tmp, '--fuel', '2000000'], { stdio: 'pipe', timeout: 30000 })
  } catch (e) {
    const out = (e.stderr ? e.stderr.toString() : '') + (e.stdout ? e.stdout.toString() : '')
    err = (out.split('\n').find((l) => /error|Cannot use/i.test(l)) || out.split('\n')[0] || '').trim().slice(0, 120)
    status = /Cannot use 'in' operator to search for 'name'/.test(out) ? 'EQ-BUG' : 'OTHER-FAIL'
  }
  results.push({ id: c.id, status, err })
}
writeFileSync(OUT, JSON.stringify(results, null, 0))
const tally = {}
for (const r of results) tally[r.status] = (tally[r.status] || 0) + 1
console.error(`RAN ${results.length} candidates -> ${JSON.stringify(tally)}  written ${OUT}`)
