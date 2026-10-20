import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const file = process.argv[2]
const src = readFileSync(file, 'utf8')

// Find all keyword-tagged string literals for runnable fields.
const runnableKeys = new Set([
  ':code', ':program',
  ':eng-program', ':math-program', ':cs-program',
  ':eng-composition', ':math-composition', ':cs-composition',
  ':composition',
])

// Tokenize just enough: scan for ':key "..."' allowing \n and \" escapes.
const snippets = []
const re = /(:[a-z0-9-]+)\s+"((?:[^"\\]|\\.)*)"/g
let m
while ((m = re.exec(src)) !== null) {
  const key = m[1]
  if (!runnableKeys.has(key)) continue
  // Unescape \n and \" and \\
  let code = m[2].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  snippets.push({ key, code })
}

console.log(`found ${snippets.length} runnable snippets`)
const HOME = mkdtempSync(join(tmpdir(), 'motoi-home-'))
let fails = 0
snippets.forEach((s, i) => {
  try {
    execSync('./bin/motoi run /dev/stdin', {
      input: s.code + '\n',
      env: { ...process.env, HOME },
      stdio: ['pipe', 'ignore', 'pipe'],
      timeout: 30000,
    })
  } catch (e) {
    fails++
    console.log(`FAIL #${i} ${s.key}: ${JSON.stringify(s.code).slice(0,120)}`)
    const err = (e.stderr || e.stdout || '').toString().split('\n').slice(0,3).join(' | ')
    console.log(`   -> ${err}`)
  }
})
console.log(`done: ${snippets.length - fails} pass, ${fails} fail`)
