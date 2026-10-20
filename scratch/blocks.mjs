// scratch/blocks.mjs — dump each ```scheme block of a book file with an index,
// and (optionally) run cumulative prefixes to find the FIRST failing block.
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

const file = process.argv[2]
const mode = process.argv[3] || 'list' // list | firstfail
const bs = blocks(readFileSync(file, 'utf8'))

if (mode === 'list') {
  bs.forEach((b, i) => {
    console.log(`\n===== BLOCK ${i} =====`)
    console.log(b)
  })
} else if (mode === 'firstfail') {
  const dir = mkdtempSync(join(tmpdir(), 'blk-'))
  // find first block index whose cumulative prefix fails
  for (let i = 0; i < bs.length; i++) {
    const code = bs.slice(0, i + 1).join('\n\n')
    const tmp = join(dir, 'b.scm')
    writeFileSync(tmp, code)
    try {
      execFileSync('./bin/motoi', ['run', tmp], { stdio: 'pipe', timeout: 120000 })
    } catch (e) {
      const err = (e.stderr ? e.stderr.toString() : '') + (e.stdout ? e.stdout.toString() : '')
      const line = err.split('\n').find(l => /error|unbound|mismatch|not a function|expected|unexpected/i.test(l)) || err.split('\n')[0]
      console.log(`FIRST FAIL at block ${i}: ${line.trim().slice(0,120)}`)
      console.log(`----- block ${i} source -----`)
      console.log(bs[i])
      process.exit(0)
    }
  }
  console.log(`ALL ${bs.length} blocks CLEAN cumulatively`)
}
