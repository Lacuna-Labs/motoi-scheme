// scratch/probe-all.mjs — report EVERY failing ```scheme block in a chapter.
// Runs each block index cumulatively over the blocks that PASSED so far (a
// failing block is dropped from the accumulated context so later blocks that
// don't depend on it still get graded). Usage: node scratch/probe-all.mjs <file>
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

const f = process.argv[2]
const bs = blocks(readFileSync(f, 'utf8'))
const dir = mkdtempSync(join(tmpdir(), 'probeall-'))
const tmp = join(dir, 'book.scm')
const fuel = process.env.GRADE_FUEL || '5000000'
const good = []
let fails = 0
for (let i = 0; i < bs.length; i++) {
  writeFileSync(tmp, [...good, bs[i]].join('\n\n'))
  try {
    execFileSync('./bin/motoi', ['run', tmp, '--fuel', fuel], { stdio: 'pipe', timeout: 120000 })
    good.push(bs[i])
  } catch (e) {
    fails++
    const err = (e.stderr ? e.stderr.toString() : '') + (e.stdout ? e.stdout.toString() : '')
    const line = err.split('\n').find(l => /error|unbound|mismatch|not a function|expected|escalate/i.test(l)) || err.split('\n')[0]
    console.log(`\n### FAIL block ${i} :: ${line.trim().slice(0,80)}`)
    console.log(bs[i])
  }
}
console.log(`\n=== ${fails} failing block(s) of ${bs.length} ===`)
