// Inject the anim-prelude as a NEW first ```scheme block into chapters that
// have none. Non-destructive to all other blocks. Counterpart to bake-prelude
// (which SWAPS an existing prelude fence); this INSERTS one.
import { readFileSync, writeFileSync } from 'node:fs'
const runtime = readFileSync('/Users/alfred/code/motoi-scheme/scratch/anim-prelude.scm','utf8')
const runtimeEsc = runtime.replace(/\\/g,'\\\\').replace(/"/g,'\\"')
const marker = ';; --- chapter runtime (real Motoi primitives) ---'
const fence = '```scheme\n' + marker + '\n' + runtimeEsc + '\n```\n\n'
let injected=0, skipped=0
for (const file of process.argv.slice(2)) {
  const raw = readFileSync(file,'utf8')
  if (raw.includes(marker)) { console.log('ALREADY HAS PRELUDE, skip', file.split('/').pop()); skipped++; continue }
  const idx = raw.indexOf('```scheme\n')
  if (idx < 0) { console.log('NO SCHEME BLOCK, skip', file.split('/').pop()); skipped++; continue }
  const out = raw.slice(0,idx) + fence + raw.slice(idx)
  writeFileSync(file, out)
  console.log('injected', file.split('/').pop())
  injected++
}
console.log(`\n${injected} injected, ${skipped} skipped`)
