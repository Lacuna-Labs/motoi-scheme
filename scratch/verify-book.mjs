// scratch/verify-book.mjs
// Extract ```scheme fenced blocks from a .book.slatl chapter and run them
// CONCATENATED (in order) through the same core env motoi uses. Chapters
// define a tiny runtime in their first block, so later blocks depend on it —
// running them concatenated is the honest test of "does this chapter run".
//
// Usage: node scratch/verify-book.mjs scheme-books/book-of-motion/*.book.slatl
import { readFileSync } from 'node:fs'
import { parse } from '../src/reader.js'
import { evaluate } from '../src/interp.js'
import { expandProgram } from '../src/macro.js'
import { makeCoreEnv } from '../core/index.js'

const origErr = process.stderr.write.bind(process.stderr)
process.stderr.write = (s, ...a) => (String(s).startsWith('[verbRegistry]') ? true : origErr(s, ...a))
const origOut = process.stdout.write.bind(process.stdout)
process.stdout.write = () => true

function blocks(text) {
  const out = []
  const re = /```scheme\n([\s\S]*?)```/g
  let m
  // Book prose is a SLAT double-quoted string, so code-block quotes and
  // newlines are stored escaped (\" \n \\). Unescape before running, the same
  // way check-book.mjs (and the real extractor) does.
  while ((m = re.exec(text)) !== null) {
    out.push(m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\'))
  }
  return out
}

const files = process.argv.slice(2)
const results = []
for (const f of files) {
  const text = readFileSync(f, 'utf8')
  const bs = blocks(text)
  // Run concatenated in ONE env (chapter-session semantics).
  // NOTE: core primitives close over the env-level fuel object created here and
  // drain it CUMULATIVELY across every block. A per-chapter run touches ~80-100
  // blocks (some animate hundreds of frames), so the shared counter must be very
  // large or late blocks spuriously report "fuel exhausted" even though each block
  // passes standalone via `./bin/motoi run`. Give it a generous session budget.
  const SESSION_FUEL = 2_000_000_000
  const env = makeCoreEnv({ fuel: { n: SESSION_FUEL } })
  let failAt = -1, err = '', ranBlocks = 0
  for (let i = 0; i < bs.length; i++) {
    try {
      const forms = parse(bs[i])
      const { forms: expanded } = expandProgram(forms, { fuel: { n: SESSION_FUEL } })
      const fuel = { n: SESSION_FUEL }
      for (const fm of expanded) evaluate(fm, env, fuel)
      ranBlocks++
    } catch (e) {
      failAt = i
      err = (e && e.message) ? e.message : String(e)
      break
    }
  }
  const name = f.split('/').pop()
  results.push({ name, total: bs.length, ranBlocks, failAt, err })
  origErr(`${failAt === -1 ? 'PASS' : 'FAIL'}  ${name}  (${ranBlocks}/${bs.length} blocks)${failAt === -1 ? '' : `  @block ${failAt}: ${err.slice(0, 90)}`}\n`)
}
const passed = results.filter(r => r.failAt === -1).length
origErr(`\n${passed}/${results.length} chapters run clean\n`)
