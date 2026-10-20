// scratch/triage-ref-failures.mjs
// Classify /tmp/motoi-ref-failures.jsonl into actionable buckets.
// Usage: node scratch/triage-ref-failures.mjs

import { readFile } from 'node:fs/promises'

const raw = await readFile('/tmp/motoi-ref-failures.jsonl', 'utf8')
const rows = raw.split('\n').filter(Boolean).map(l => JSON.parse(l))

// Doctrine-excluded names (R6RS/Racket) — legit broken-examples per CLAUDE.md.
const EXCLUDED = new Set(['fold-left', 'foldl', 'foldr'])

// R7RS-small number-tower tokens the reader currently rejects.
const NUMTOK = /^[+-]?\d+\/\d+$|^[+-](inf|nan)\.0$/

// Single lowercase/upper letter or common 1-2 char locals => fragment tell.
const FRAGMENT_SYM = /^[a-zA-Z][0-9]?$/

function classify(d) {
  const e = d.error || ''
  const m = /unbound(?:\s+symbol)?:?\s*([^\s"'()]+)/i.exec(e)
  const sym = m ? m[1] : null

  if (sym && EXCLUDED.has(sym)) return 'A-excluded-doctrine'
  if (sym && NUMTOK.test(sym)) return 'B-number-tower'
  if (/cannot coerce to complex/i.test(e)) return 'B-number-tower'
  if (sym === 'read' || sym === 'write' || sym === 'read-line' || sym === 'error?' ||
      sym === 'list-head' || sym === 'for-all' || sym === 'exists') return 'C-missing-stdlib'
  if (sym && sym.includes('/')) return 'F-namespaced-gap'   // e.g. linalg/mv
  if (sym && FRAGMENT_SYM.test(sym)) return 'D-fragment'
  if (/is not a function|reading '|\.map|\.slice|not a function: NaN/i.test(e)) return 'E-js-impl-bug'
  if (/unexpected \)|apostrophe|inside identifier|parse|reader/i.test(e)) return 'G-parse-reader'
  if (/not a character/i.test(e)) return 'H-char-coerce'
  if (sym) return 'I-other-unbound'
  return 'Z-other'
}

const buckets = {}
const bySymByBucket = {}
for (const d of rows) {
  const c = classify(d)
  ;(buckets[c] ||= []).push(d)
  const m = /unbound(?:\s+symbol)?:?\s*([^\s"'()]+)/i.exec(d.error || '')
  if (m) {
    bySymByBucket[c] ||= {}
    bySymByBucket[c][m[1]] = (bySymByBucket[c][m[1]] || 0) + 1
  }
}

console.log(`TOTAL FAILURES: ${rows.length}\n`)
const order = Object.entries(buckets).sort((a, b) => b[1].length - a[1].length)
for (const [c, arr] of order) {
  console.log(`${String(arr.length).padStart(5)}  ${c}`)
}
console.log('\n=== per-bucket top symbols / sample chapters ===')
for (const [c, arr] of order) {
  console.log(`\n--- ${c} (${arr.length}) ---`)
  const syms = bySymByBucket[c]
  if (syms) {
    const top = Object.entries(syms).sort((a, b) => b[1] - a[1]).slice(0, 12)
    console.log('  symbols:', top.map(([s, n]) => `${s}×${n}`).join('  '))
  }
  const chaps = {}
  for (const d of arr) chaps[d.chapter] = (chaps[d.chapter] || 0) + 1
  const topc = Object.entries(chaps).sort((a, b) => b[1] - a[1]).slice(0, 6)
  console.log('  chapters:', topc.map(([s, n]) => `${s}×${n}`).join('  '))
}
