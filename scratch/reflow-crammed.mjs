// reflow-crammed.mjs — reflow crammed multi-statement single-line program
// strings into canonical one-form-per-line, PROVABLY safe: a rewrite is only
// applied when parse(reflowed) is structurally identical to parse(original).
//
// Span-based: uses the reader's own tokenizer to locate each string literal's
// exact source span (so escapes never need reconstructing), reflows only the
// program-bearing ones, and verifies AST-equality before writing.
//
// Usage: node scratch/reflow-crammed.mjs           (dry run, reports)
//        node scratch/reflow-crammed.mjs --write    (apply)
import { parse, tokenize, Sym } from '../src/reader.js'
import fs from 'fs'
import path from 'path'

const REF = 'scheme/reference'
const WRITE = process.argv.includes('--write')

// structural equality over reader ASTs (Sym by name, arrays recurse, prims ===,
// NaN==NaN, typed values compared by string form as a safe fallback)
const deepEq = (a, b) => {
  if (a === b) return true
  if (a instanceof Sym && b instanceof Sym) return a.name === b.name
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) if (!deepEq(a[i], b[i])) return false
    return true
  }
  if (typeof a === 'number' && typeof b === 'number') return a === b || (Number.isNaN(a) && Number.isNaN(b))
  if (a && b && typeof a === 'object' && typeof b === 'object') return String(a) === String(b)
  return false
}

// whole-file equality that TOLERATES reflowed program strings: identical
// everywhere, except two differing strings are accepted iff both parse to the
// same code AST (i.e. one is a whitespace-reflow of the other). Prose strings
// are never edited, so they hit the a===b fast path — only reflowed program
// strings reach the parse-compare branch. This is the correct file-level
// invariant: the reflow deliberately changes a string LITERAL's bytes, so a
// naive AST compare will always (correctly) say "changed".
const eqModuloReflow = (a, b) => {
  if (a === b) return true
  if (a instanceof Sym && b instanceof Sym) return a.name === b.name
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) if (!eqModuloReflow(a[i], b[i])) return false
    return true
  }
  if (typeof a === 'string' && typeof b === 'string') {
    let pa, pb
    try { pa = parse(a); pb = parse(b) } catch { return false }
    return deepEq(pa, pb)
  }
  if (typeof a === 'number' && typeof b === 'number') return a === b || (Number.isNaN(a) && Number.isNaN(b))
  if (a && b && typeof a === 'object' && typeof b === 'object') return String(a) === String(b)
  return false
}

// map a token's (line,col) start to a raw source index
const indexOf = (src, line, col) => {
  let i = 0, ln = 1, c = 1
  while (i < src.length) { if (ln === line && c === col) return i; if (src[i] === '\n') { ln++; c = 1 } else c++; i++ }
  return -1
}

// given src and the index of an opening quote, return [innerStart, innerEnd, close]
// honoring backslash escapes exactly as the tokenizer does
const stringSpan = (src, openIdx) => {
  let i = openIdx + 1
  while (i < src.length && src[i] !== '"') { if (src[i] === '\\' && i + 1 < src.length) i += 2; else i++ }
  return [openIdx + 1, i] // inner content span; src[i] === closing quote
}

// reflow decoded content: insert '\n' between top-level forms. Returns null if
// content is not multi-top-form code (comment/prose/single form).
const reflow = (c) => {
  if (/^\s*;;/.test(c)) return null       // comment-led: leave alone
  let depth = 0, inStr = false, forms = 0, out = '', boundary = false
  for (let i = 0; i < c.length; i++) {
    const ch = c[i]
    if (inStr) { out += ch; if (ch === '\\' && i + 1 < c.length) { out += c[++i] } else if (ch === '"') inStr = false; continue }
    if (ch === ';') { // comment to EOL inside content — abort reflow (ambiguous)
      return null
    }
    if (ch === '"') { inStr = true; out += ch; continue }
    if (ch === '#' && c[i + 1] === '\\') { out += c[i] + c[i + 1] + (c[i + 2] || ''); i += 2; continue }
    if (ch === '(') {
      if (depth === 0 && boundary) { out = out.replace(/[ \t]+$/, '') + '\n'; forms++; boundary = false }
      else if (depth === 0) forms++
      depth++; out += ch; continue
    }
    if (ch === ')') { depth--; out += ch; if (depth === 0) boundary = true; continue }
    out += ch
  }
  if (forms < 2) return null
  return out
}

const rows = []
for (const file of fs.readdirSync(REF).filter((f) => f.endsWith('.slat')).sort()) {
  const src = fs.readFileSync(path.join(REF, file), 'utf8')
  const before = parse(src)
  const toks = tokenize(src)
  // collect edits as [innerStart, innerEnd, newInner]
  const edits = []
  for (let ti = 0; ti < toks.length; ti++) {
    const tk = toks[ti]
    if (!(tk.t && typeof tk.t === 'object' && 'str' in tk.t)) continue
    // ONLY reflow strings that are the value of a program-bearing key.
    // The token immediately before the string is its plist key (whitespace is
    // not tokenized). Prose keys (:summary :note :problem …) are skipped — a
    // prose string with incidental parens like "help(v) ∈ (0,∞)" would pass an
    // AST compare yet get mangled by newline insertion. Binding to the key is
    // the real guard; the AST gate alone is insufficient.
    const prev = toks[ti - 1]
    const key = prev && typeof prev.t === 'string' ? prev.t : ''
    if (!(key.startsWith(':') && /(?:code|program|composition)$/.test(key.slice(1)))) continue
    const content = tk.t.str
    if (content.includes('\n')) continue          // already multi-line
    const re = reflow(content)
    if (re == null || re === content) continue
    // prove semantics-identical
    let a, b
    try { a = parse(content); b = parse(re) } catch { continue }
    if (!deepEq(a, b)) continue
    const openIdx = indexOf(src, tk.line, tk.col)
    if (openIdx < 0 || src[openIdx] !== '"') continue
    const [s, e] = stringSpan(src, openIdx)
    if (src.slice(s, e) !== content) continue      // raw span must decode-match (no escapes) — else skip to be safe
    edits.push([s, e, re])
  }
  if (!edits.length) { rows.push({ file, edits: 0, ok: true }); continue }
  // apply right-to-left
  edits.sort((a, b) => b[0] - a[0])
  let out = src
  for (const [s, e, re] of edits) out = out.slice(0, s) + re + out.slice(e)
  // verify whole-file AST unchanged
  let after
  try { after = parse(out) } catch (err) { rows.push({ file, edits: edits.length, ok: false, err: 'reparse-fail: ' + err.message }); continue }
  const same = eqModuloReflow(before, after)
  if (!same) { rows.push({ file, edits: edits.length, ok: false, err: 'AST changed — NOT written' }); continue }
  if (WRITE) fs.writeFileSync(path.join(REF, file), out)
  rows.push({ file, edits: edits.length, ok: true })
}

const total = rows.reduce((a, r) => a + r.edits, 0)
const bad = rows.filter((r) => !r.ok)
console.log(`${WRITE ? 'WROTE' : 'DRY-RUN'} — reflowed program strings: ${total} across ${rows.filter((r) => r.edits).length} files`)
for (const r of rows.filter((r) => r.edits)) console.log(`  ${String(r.edits).padStart(3)}  ${r.file}${r.ok ? '' : '  !! ' + r.err}`)
if (bad.length) console.log(`\nSKIPPED (invariant failed, left untouched): ${bad.length}`)
