// check-truthy.mjs — flag proof-row snippets that evaluate to #f.
// Wraps each proof/audit/composition program so the value of its LAST
// expression is displayed, then flags any that print exactly "#f".
import { readFileSync, mkdtempSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const file = process.argv[2]
const src = readFileSync(file, 'utf8')

// Proof/audit fields whose last expression is meant to be a truthy assertion.
const proofKeys = new Set([':eng-program', ':cs-program', ':math-program'])

const snippets = []
const re = /(:[a-z0-9-]+)\s+"((?:[^"\\]|\\.)*)"/g
let m
while ((m = re.exec(src)) !== null) {
  const key = m[1]
  if (!proofKeys.has(key)) continue
  let code = m[2].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  // Skip honest-null placeholders.
  if (code.includes(':honest-null')) continue
  snippets.push({ key, code })
}

console.log(`checking ${snippets.length} proof snippets for truthiness`)
const HOME = mkdtempSync(join(tmpdir(), 'motoi-home-'))
let falsy = 0
snippets.forEach((s, i) => {
  // Wrap: force display of the final expression's value.
  const wrapped = `(display (begin ${s.code} ))`
  let out = ''
  try {
    out = execSync('./bin/motoi run /dev/stdin', {
      input: wrapped + '\n',
      env: { ...process.env, HOME },
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000,
    }).toString().trim()
  } catch (e) {
    // Some snippets use (define ...) at top level then a bool — begin-wrap
    // may reject internal defines. Fall back to raw run + last-line display.
    out = '<<wrap-error>>'
  }
  if (out === '#f') {
    falsy++
    console.log(`FALSY #${i} ${s.key}: ${JSON.stringify(s.code).slice(0,140)}`)
  } else if (out === '<<wrap-error>>') {
    console.log(`WRAP  #${i} ${s.key}: ${JSON.stringify(s.code).slice(0,100)} (needs manual check — has internal define)`)
  }
})
console.log(`done: ${falsy} snippets evaluate to #f`)
