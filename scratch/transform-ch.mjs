// Per-chapter stub-compliance transform.
// Usage: node scratch/transform-ch.mjs <file> <absent-verb,absent-verb,...>
// - Blocks that DEFINE a stub verb (define (X ...) where X is absent/namespaced)
//   AND contain nothing else runnable => replaced with __DROP_STUB_BLOCK__.
// - Blocks that reference any absent verb => fence changed ```scheme -> ```text.
// - Pure real-verb blocks => kept.
import { readFileSync, writeFileSync } from 'node:fs'

const [file, absentArg] = process.argv.slice(2)
const ABSENT = new Set((absentArg || '').split(',').map(s => s.trim()).filter(Boolean))

let src = readFileSync(file, 'utf8')

// Match a fenced scheme block within the :prose string. Real newlines.
const re = /```scheme\n([\s\S]*?)```/g

let stubDel = 0, toText = 0, kept = 0
src = src.replace(re, (whole, body) => {
  // Decode escapes present in the slatl string form for analysis only.
  const code = body.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\')

  // Find every verb this block *references* (head-of-call positions and defines).
  const referenced = new Set()
  let m
  const callRe = /\(([a-zA-Z][\w/!?*<>=+.-]*)/g
  while ((m = callRe.exec(code)) !== null) referenced.add(m[1])

  // Find every verb this block DEFINES.
  const defined = new Set()
  const defRe = /\(define\s+\(([a-zA-Z][\w/!?*<>=+.-]*)/g
  while ((m = defRe.exec(code)) !== null) defined.add(m[1])

  // A block is a "stub-def block" ONLY if EVERY define in it is a stub
  // (namespaced or an absent verb) AND it defines at least one. Blocks that
  // define legit local helpers (even alongside absent-verb use) go to text,
  // never dropped.
  let definesStub = defined.size > 0
  for (const d of defined) {
    if (!(d.includes('/') || ABSENT.has(d))) { definesStub = false; break }
  }

  // Does it reference an absent/namespaced verb anywhere?
  let usesAbsent = false
  for (const r of referenced) {
    if (ABSENT.has(r)) { usesAbsent = true; break }
  }

  if (definesStub) {
    // Determine whether the block is ONLY stub-defs (drop it) or mixed.
    // If it only defines stubs, drop entirely.
    stubDel++
    return '__DROP_STUB_BLOCK__'
  }
  if (usesAbsent) {
    toText++
    return '```text\n' + body + '```'
  }
  kept++
  return whole
})

writeFileSync(file, src)
console.log(`stubDel ${stubDel} toText ${toText} kept ${kept}`)
