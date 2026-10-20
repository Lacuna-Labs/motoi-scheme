// scratch/eq-audit-books.mjs — CUMULATIVE book grading for the eq-bug audit.
// Books grade block-by-block sharing state, so a trigger can span blocks.
// This concatenates all ```scheme blocks per chapter (like grade-book.mjs) and
// runs the whole chapter, but ONLY for chapters that call an eq-family verb.
// Emits per-chapter status + eq-signature detection so a buggy-vs-fixed diff
// reveals which chapters break *only* because of the bug.
import { readFileSync, readdirSync, writeFileSync, statSync, mkdtempSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const EQ = /(?:^|[^\w?!])(=\?|equal\?|eqv\?|eq\?)(?:[^\w?!]|$)/
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
const chapters = []
for (const book of readdirSync(BOOKS)) {
  const bp = join(BOOKS, book)
  if (!statSync(bp).isDirectory()) continue
  for (const f of readdirSync(bp).filter((f) => f.endsWith('.slatl'))) {
    const bs = schemeBlocks(readFileSync(join(bp, f), 'utf8'))
    const code = bs.join('\n\n')
    if (EQ.test(code)) chapters.push({ id: `${book}/${f}`, code })
  }
}
console.error(`eq-candidate chapters: ${chapters.length}`)

const OUT = process.argv[2]
const dir = mkdtempSync(join(tmpdir(), 'eqbooks-'))
const tmp = join(dir, 'c.scm')
const results = []
for (const c of chapters) {
  writeFileSync(tmp, c.code)
  let status = 'CLEAN', err = ''
  try {
    execFileSync('./bin/motoi', ['run', tmp, '--fuel', '50000000'], { stdio: 'pipe', timeout: 120000 })
  } catch (e) {
    const out = (e.stderr ? e.stderr.toString() : '') + (e.stdout ? e.stdout.toString() : '')
    err = (out.split('\n').find((l) => /error|Cannot use/i.test(l)) || out.split('\n')[0] || '').trim().slice(0, 120)
    status = /Cannot use 'in' operator to search for 'name'/.test(out) ? 'EQ-BUG'
      : /fuel exhausted/.test(out) ? 'FUEL' : 'OTHER-FAIL'
  }
  results.push({ id: c.id, status, err })
}
writeFileSync(OUT, JSON.stringify(results, null, 0))
const tally = {}
for (const r of results) tally[r.status] = (tally[r.status] || 0) + 1
console.error(`RAN ${results.length} chapters -> ${JSON.stringify(tally)}  written ${OUT}`)
