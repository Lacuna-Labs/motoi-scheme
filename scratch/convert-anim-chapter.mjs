// Convert one animation .book.slatl chapter to run on the honest Motoi runtime.
// ALWAYS restores from backup first (so the prelude can be iterated), then:
//   - injects the runtime block as a new FIRST scheme fence,
//   - transforms brackets INSIDE ```scheme fences with a context-aware rule:
//       big-bang CLAUSE brackets  [kw ...]  -> (list 'kw ...)   (kw in a fixed set)
//       every other bracket       [ ]       -> ( )              (let/let* bindings etc.)
// Motoi's reader has no [] list syntax and big-bang is a plain fn (clauses are data),
// so this is the honest rewrite of Curator/HtDP bracket code onto Motoi.
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs'
const [,, file] = process.argv
const base = file.split('/').pop()
const bak = `scratch/attic/books-broken-by-surgery-2026-07-25/animation/${base}`
if (!existsSync(bak)) { console.log('NO BACKUP, skipping', base); process.exit(1) }
// Always start from the pristine backup so we can re-run with a new prelude.
const raw = readFileSync(bak, 'utf8')

// The runtime, SLAT-escaped (quotes -> \"), to inject inside the :prose string.
const runtime = readFileSync('scratch/anim-prelude.scm','utf8')
const runtimeEsc = runtime.replace(/\\/g,'\\\\').replace(/"/g,'\\"')

// big-bang clause keywords: these are DATA, not calls -> quote them into a list.
const CLAUSE = ['on-tick','to-draw','on-draw','stop-when','on-key','on-release',
  'on-mouse','on-pad','on-tilt','on-pause','name','record\\?','close-on-stop','on-stop']
const clauseRe = new RegExp('\\[(' + CLAUSE.join('|') + ')\\b', 'g')

let injected = false
const out = raw.replace(/```scheme\n([\s\S]*?)```/g, (m, body) => {
  let b = body
  b = b.replace(clauseRe, "(list '$1")   // clause brackets -> quoted-list data
  b = b.replace(/\[/g, '(')              // any remaining bracket -> paren (let bindings)
  b = b.replace(/\]/g, ')')
  if (!injected) {
    injected = true
    return '```scheme\n;; --- chapter runtime (real Motoi primitives) ---\n' + runtimeEsc + '\n```\n\n```scheme\n' + b + '```'
  }
  return '```scheme\n' + b + '```'
})
writeFileSync(file, out)
console.log('converted', base, '(restored-from-backup + context-aware brackets)')
