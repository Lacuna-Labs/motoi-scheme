// Extract ```scheme blocks from a .slatl book chapter and run each through
// ./bin/motoi run. Reports per-block PASS/FAIL. Blocks are SLATL string
// literals, so \" escapes and \n are unescaped before running.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { execSync } from 'node:child_process'

const file = process.argv[2]
const src = readFileSync(file, 'utf8')

// The chapter prose is a big "...":-delimited SLATL string. Inside it,
// code fences use \n for newline and \" for quote. Find fenced blocks.
const fence = /```scheme\s*([\s\S]*?)```/g
// A chapter is read top to bottom; later blocks may use earlier defines.
// The "cumulative" mode (default) concatenates prior blocks so each block
// runs in the context a reader would have. Pass "iso" to run each alone.
const mode = process.argv[3] || 'cumulative'
let m, i = 0, fails = 0, passes = 0
mkdirSync('scratch/blocks', { recursive: true })
const results = []
let prelude = ''
while ((m = fence.exec(src)) !== null) {
  i++
  let code = m[1]
  // Unescape SLATL string-literal escapes.
  code = code.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  const run = mode === 'iso' ? code : prelude + '\n' + code
  prelude = prelude + '\n' + code
  const path = `scratch/blocks/block-${i}.scm`
  writeFileSync(path, run)
  try {
    const out = execSync(`./bin/motoi run ${path} 2>&1`, { encoding: 'utf8' })
    if (/error:|unbound symbol|Traceback/i.test(out)) {
      fails++
      results.push(`BLOCK ${i}: FAIL\n${out.trim().split('\n').slice(0,4).join('\n')}\n---`)
    } else {
      passes++
      results.push(`BLOCK ${i}: pass`)
    }
  } catch (e) {
    fails++
    const out = (e.stdout || '') + (e.stderr || '')
    results.push(`BLOCK ${i}: FAIL (exit)\n${out.trim().split('\n').slice(0,4).join('\n')}\n---`)
  }
}
console.log(`${file}\nblocks=${i} pass=${passes} fail=${fails}\n`)
console.log(results.join('\n'))
