// Tiny s-expression reader — no dependencies.
//
// Parses Scheme source into plain JS values so the interpreter can walk them:
//   number  → JS number          string → JS string
//   boolean → true / false (#t/#f)
//   symbol  → Sym instance       list   → JS array
//
// This is the front of the Scheme Control Interface: the same homoiconic
// text an operator reads is the data the evaluator runs.
//
// ── SC1 (B3, 2026-06-11) ────────────────────────────────────────────────
// Two hardening additions that do NOT change the value shape (so every
// existing consumer — interp, dispatch, walkVerbCalls — keeps working):
//
//   1. SOURCE POSITIONS. The tokenizer records {line,col,start} per token;
//      `parse` attaches `{line,col}` for every *list* form on a side
//      WeakMap (POS). Atoms can't key a WeakMap (numbers/strings/booleans
//      aren't objects, and interned Syms are shared), so list-level
//      positions are what a "bad program points at the offending form"
//      story needs — the smallest reliable granularity. `posOf(form)`
//      reads it back; the interpreter + dispatcher surface it in errors.
//
//   2. AST CACHE. `parse(src)` memoizes by source string. Re-running the
//      same cart text (replay, repeated dispatch, the studio's
//      run-on-keystroke) skips the tokenize+read pass entirely. The cache
//      is bounded (LRU-ish, capped) so a long session can't grow it
//      without limit. `clearParseCache()` is the test seam.

export class Sym {
  constructor(name) { this.name = name }
  toString() { return this.name }
}

const SYMS = new Map()
export function sym(name) {
  let s = SYMS.get(name)
  if (!s) { s = new Sym(name); SYMS.set(name, s) }
  return s
}

// ── source positions ────────────────────────────────────────────────────
// List forms are objects (arrays) so they can key a WeakMap. We never key
// atoms (they're primitives or shared interned Syms). The map auto-clears
// when a form is GC'd, so it carries no leak.
const POS = new WeakMap()
export function posOf(form) {
  if (form && typeof form === 'object') return POS.get(form) || null
  return null
}
export function tagPos(form, pos) {
  if (form && typeof form === 'object' && pos) POS.set(form, pos)
  return form
}

const NUM_RE = /^[+-]?(\d+\.?\d*|\.\d+)$/
const DELIM = new Set([' ', '\t', '\n', '\r', '(', ')', ';', "'", '"'])

// A reader error that carries a {line,col} so callers can point at the
// offending text. `message` already embeds the location for legacy
// callers that only read `.message`.
export class ReadError extends Error {
  constructor(message, line, col) {
    super(line != null ? `${message} (line ${line}, col ${col})` : message)
    this.name = 'ReadError'
    this.line = line ?? null
    this.col = col ?? null
  }
}

// Tokens carry their source position so list forms can be tagged. A token
// is `{ t, line, col }` where `t` is the lexeme (string) or `{str}` for a
// string literal.
export function tokenize(src) {
  const out = []
  let i = 0
  let line = 1
  let col = 1
  const n = src.length
  const adv = (k = 1) => {
    while (k-- > 0) {
      if (src[i] === '\n') { line++; col = 1 } else { col++ }
      i++
    }
  }
  while (i < n) {
    const c = src[i]
    const L = line, C = col
    if (c === ';') { while (i < n && src[i] !== '\n') adv(); continue }     // comment
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { adv(); continue }
    if (c === '(' || c === ')' || c === "'") { out.push({ t: c, line: L, col: C }); adv(); continue }
    // `expr  → (quasiquote expr)
    // ,expr  → (unquote expr)
    // ,@expr → (unquote-splicing expr)
    if (c === '`') { out.push({ t: '`', line: L, col: C }); adv(); continue }
    if (c === ',') {
      if (i + 1 < n && src[i + 1] === '@') { out.push({ t: ',@', line: L, col: C }); adv(2); continue }
      out.push({ t: ',', line: L, col: C }); adv(); continue
    }
    if (c === '"') {                                                         // string
      let s = ''
      adv() // opening quote
      while (i < n && src[i] !== '"') {
        if (src[i] === '\\' && i + 1 < n) { s += src[i + 1]; adv(2) }
        else { s += src[i]; adv() }
      }
      if (i >= n) throw new ReadError('unterminated string', L, C)
      adv() // closing quote
      out.push({ t: { str: s }, line: L, col: C })
      continue
    }
    let j = i                                                               // atom
    while (j < n && !DELIM.has(src[j])) j++
    out.push({ t: src.slice(i, j), line: L, col: C })
    adv(j - i)
  }
  return out
}

function atom(tok) {
  if (typeof tok === 'object' && tok && 'str' in tok) return tok.str
  if (tok === '#t') return true
  if (tok === '#f') return false
  if (NUM_RE.test(tok)) return parseFloat(tok)
  return sym(tok)
}

// ── parse, with positions ────────────────────────────────────────────────
function parseInner(src) {
  const toks = tokenize(src)
  let pos = 0
  function read() {
    if (pos >= toks.length) throw new ReadError('unexpected EOF', null, null)
    const tk = toks[pos++]
    const t = tk.t
    if (t === '(') {
      const list = []
      while (true) {
        if (pos >= toks.length) throw new ReadError('missing )', tk.line, tk.col)
        if (toks[pos].t === ')') break
        list.push(read())
      }
      pos++ // consume )
      return tagPos(list, { line: tk.line, col: tk.col })
    }
    if (t === ')') throw new ReadError('unexpected )', tk.line, tk.col)
    if (t === "'") return tagPos([sym('quote'), read()], { line: tk.line, col: tk.col })
    if (t === '`') return tagPos([sym('quasiquote'), read()], { line: tk.line, col: tk.col })
    if (t === ',') return tagPos([sym('unquote'), read()], { line: tk.line, col: tk.col })
    if (t === ',@') return tagPos([sym('unquote-splicing'), read()], { line: tk.line, col: tk.col })
    return atom(t)
  }
  const forms = []
  while (pos < toks.length) forms.push(read())
  return forms
}

// ── AST cache (SC1a) ─────────────────────────────────────────────────────
// Memoize by source string. Bounded so a long session can't grow it
// unboundedly — when full, evict the oldest entry (insertion order of a
// Map is FIFO, which is a fine LRU-approximation for cart text).
//
// Cached forms are SHARED across hits. The macro expander + interpreter
// never mutate the read forms (they build NEW arrays), and `quote`
// returns a sub-form directly — but quoted data is treated as immutable
// by every consumer, so sharing the same instance is safe. (If a future
// consumer wanted to mutate, it would clone first — same as today.)
const PARSE_CACHE = new Map()
const PARSE_CACHE_MAX = 256
let _cacheHits = 0
let _cacheMisses = 0

export function parse(src) {
  if (typeof src !== 'string') return parseInner(src)
  const hit = PARSE_CACHE.get(src)
  if (hit) {
    _cacheHits++
    // Refresh insertion order (move-to-end) so hot entries survive eviction.
    PARSE_CACHE.delete(src)
    PARSE_CACHE.set(src, hit)
    return hit
  }
  _cacheMisses++
  const forms = parseInner(src)
  if (PARSE_CACHE.size >= PARSE_CACHE_MAX) {
    // Evict oldest (first key).
    const oldest = PARSE_CACHE.keys().next().value
    if (oldest !== undefined) PARSE_CACHE.delete(oldest)
  }
  PARSE_CACHE.set(src, forms)
  return forms
}

// Test/diagnostic seams.
export function clearParseCache() { PARSE_CACHE.clear(); _cacheHits = 0; _cacheMisses = 0 }
export function parseCacheStats() {
  return { size: PARSE_CACHE.size, hits: _cacheHits, misses: _cacheMisses, max: PARSE_CACHE_MAX }
}
