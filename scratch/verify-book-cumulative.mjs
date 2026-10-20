// scratch/verify-book-cumulative.mjs
// Like verify-book.mjs but shares ONE env across ALL files given (whole-book
// cumulative), to distinguish real single-chapter bugs from the per-chapter
// verifier's isolation artifact (a book that defines helpers in ch01 and uses
// them in ch04 fails ch04 in isolation but is correct read start-to-finish).
import { readFileSync } from 'node:fs'
import { parse } from '../src/reader.js'
import { evaluate } from '../src/interp.js'
import { expandProgram } from '../src/macro.js'
import { makeCoreEnv } from '../core/index.js'

const origErr = process.stderr.write.bind(process.stderr)
process.stderr.write = (s, ...a) => (String(s).startsWith('[verbRegistry]') ? true : origErr(s, ...a))
process.stdout.write = () => true

function blocks(text) {
  const out = []
  const re = /```scheme\n([\s\S]*?)```/g
  let m
  while ((m = re.exec(text)) !== null) {
    out.push(m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\'))
  }
  return out
}

const FUEL = 2_000_000_000
const files = process.argv.slice(2)
const env = makeCoreEnv({ fuel: { n: FUEL } })
let firstFail = null, chapters = 0, okChapters = 0
for (const f of files) {
  const bs = blocks(readFileSync(f, 'utf8'))
  chapters++
  let failed = false
  for (let i = 0; i < bs.length; i++) {
    try {
      const forms = parse(bs[i])
      const { forms: expanded } = expandProgram(forms, { fuel: { n: FUEL } })
      const fuel = { n: FUEL }
      for (const fm of expanded) evaluate(fm, env, fuel)
    } catch (e) {
      const name = f.split('/').pop()
      const msg = (e && e.message) ? e.message : String(e)
      origErr(`FAIL  ${name}  @block ${i}: ${msg.slice(0, 80)}\n`)
      if (!firstFail) firstFail = name
      failed = true
      break
    }
  }
  if (!failed) okChapters++
}
origErr(`\ncumulative: ${okChapters}/${chapters} chapters clean\n`)
