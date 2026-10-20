// scratch/grade-book.mjs — CANONICAL grader for a .book.slatl file.
// Extracts every ```scheme block, concatenates in order, writes a temp .scm,
// and runs it through the REAL ./bin/motoi binary (not a JS import). This is
// the grader of record: if this prints CLEAN, `./bin/motoi run` accepts the
// whole book's code cumulatively. Usage: node scratch/grade-book.mjs <file...>
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

function blocks(text) {
  const out = []
  const re = /```scheme\n([\s\S]*?)```/g
  let m
  while ((m = re.exec(text)) !== null) {
    out.push(m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\'))
  }
  return out
}

const dir = mkdtempSync(join(tmpdir(), 'gradebook-'))
let allClean = true
for (const f of process.argv.slice(2)) {
  const bs = blocks(readFileSync(f, 'utf8'))
  const code = bs.join('\n\n')
  const tmp = join(dir, 'book.scm')
  writeFileSync(tmp, code)
  const name = f.split('/').slice(-2).join('/')
  // Session-representative fuel: a whole book concatenated is far larger than
  // any real session, so we grade with a generous budget (override via
  // GRADE_FUEL). This measures "does the code run", not "does it fit 200k".
  const fuel = process.env.GRADE_FUEL || '5000000'
  try {
    execFileSync('./bin/motoi', ['run', tmp, '--fuel', fuel], { stdio: 'pipe', timeout: 120000 })
    console.log(`CLEAN  ${name}  (${bs.length} blocks)`)
  } catch (e) {
    allClean = false
    const err = (e.stderr ? e.stderr.toString() : '') + (e.stdout ? e.stdout.toString() : '')
    const line = err.split('\n').find(l => /error|unbound|mismatch|not a function|expected/i.test(l)) || err.split('\n')[0] || String(e.message)
    console.log(`FAIL   ${name}  (${bs.length} blocks)  ::  ${line.trim().slice(0, 90)}`)
  }
}
process.exit(allClean ? 0 : 1)
