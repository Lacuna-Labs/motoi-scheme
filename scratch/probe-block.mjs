// scratch/probe-block.mjs — find which ```scheme block first fails, cumulatively.
// Usage: node scratch/probe-block.mjs <file>
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
const dir = mkdtempSync(join(tmpdir(), 'probe-'))
const tmp = join(dir, 'book.scm')
const fuel = process.env.GRADE_FUEL || '5000000'
for (let i = 0; i < bs.length; i++) {
  const code = bs.slice(0, i + 1).join('\n\n')
  writeFileSync(tmp, code)
  try {
    execFileSync('./bin/motoi', ['run', tmp, '--fuel', fuel], { stdio: 'pipe', timeout: 120000 })
  } catch (e) {
    const err = (e.stderr ? e.stderr.toString() : '') + (e.stdout ? e.stdout.toString() : '')
    const line = err.split('\n').find(l => /error|unbound|mismatch|not a function|expected|escalate/i.test(l)) || err.split('\n')[0]
    console.log(`FIRST FAIL at block index ${i} (of ${bs.length}):`)
    console.log('---- error ----')
    console.log(line.trim())
    console.log('---- block source ----')
    console.log(bs[i])
    process.exit(0)
  }
}
console.log(`ALL ${bs.length} blocks CLEAN`)
