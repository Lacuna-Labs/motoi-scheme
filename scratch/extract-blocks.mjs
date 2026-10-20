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
const dir = mkdtempSync(join(tmpdir(), 'bisect-'))
const fuel = process.env.GRADE_FUEL || '5000000'
// find first failing block cumulatively
for (let i = 0; i < bs.length; i++) {
  const code = bs.slice(0, i+1).join('\n\n')
  const tmp = join(dir, 'b.scm')
  writeFileSync(tmp, code)
  try {
    execFileSync('./bin/motoi', ['run', tmp, '--fuel', fuel], { stdio: 'pipe', timeout: 120000 })
  } catch (e) {
    const err = (e.stderr ? e.stderr.toString() : '') + (e.stdout ? e.stdout.toString() : '')
    console.log(`FIRST FAIL at block index ${i}:`)
    console.log('---- block source ----')
    console.log(bs[i])
    console.log('---- error ----')
    console.log(err.split('\n').filter(l=>l.trim()).slice(-8).join('\n'))
    process.exit(0)
  }
}
console.log('all blocks pass')
