// Tiny s-expression reader — one leaf dependency (r7rs-types, pure value
// classes) for the R7RS §6.6 character type produced by `#\` literals.
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

import { ch, mkVec } from '../lib/base/r7rs-types.js'
import { makeRational } from '../lib/math/exact.js'

export class Sym {
  constructor(name) { this.name = name }
  toString() { return this.name }
}

// R7RS §6.4 — an IMPROPER pair, i.e. one whose cdr is not a list.
//
// Motoi represents proper lists as JS arrays, and that stays: it is what
// makes the common path fast and what every cart already depends on. A
// `Pair` is minted only by `(cons a b)` where b is not a list, so the
// array path is untouched and nothing that works today changes shape.
//
// Before 2026-08-01 `(cons 'sku 42)` silently produced the two-element
// list `(sku 42)`, so `(cdr (assq 'sku alist))` yielded `(42)` instead of
// `42` — the printer disguised it, which is why it went unnoticed. With a
// real Pair, `cdr` returns the value, as R7RS requires.
export class Pair {
  constructor(car, cdr) { this.car = car; this.cdr = cdr }
}

// A "list-ish" value: a proper list (array) or an improper Pair. Use this
// wherever a verb must accept both, so the two representations stay
// interchangeable to callers.
export function isPair(v) { return v instanceof Pair || (Array.isArray(v) && v.length > 0) }

// Render a dotted pair the way Scheme writes it. The cdr chain collapses,
// so `(cons 1 (cons 2 3))` prints `(1 2 . 3)` rather than `(1 . (2 . 3))`.
// `fmt` is the caller's element formatter — Motoi has several (repl, cli,
// ide-server, display) and they all route here so they cannot drift apart.
export function pairToString(p, fmt) {
  const parts = []
  let x = p
  while (x instanceof Pair) { parts.push(fmt(x.car)); x = x.cdr }
  return '(' + parts.join(' ') + ' . ' + fmt(x) + ')'
}

// R7RS §6.6 named character literals → their scalar values. Anything not
// listed is a single-character literal (#\a) or a #\xHH hex escape.
const CHAR_NAMES = {
  space: ' ', newline: '\n', tab: '\t', return: '\r', nul: '\0', null: '\0',
  delete: '\x7f', escape: '\x1b', altmode: '\x1b', backspace: '\b',
  alarm: '\x07', linefeed: '\n', page: '\f', rubout: '\x7f',
}
function charFromToken(rest) {
  if (rest.length === 1) return rest                       // #\a #\( #\space-as-literal
  const lower = rest.toLowerCase()
  if (lower in CHAR_NAMES) return CHAR_NAMES[lower]
  if ((rest[0] === 'x' || rest[0] === 'X') && /^[0-9a-fA-F]+$/.test(rest.slice(1))) {
    return String.fromCodePoint(parseInt(rest.slice(1), 16))
  }
  throw new ReadError(`unknown character literal #\\${rest}`, null, null)
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

// Patch 4 (2026-07-19, Book of ML feedback): scientific notation.
// The number tokenizer now accepts `1e-5`, `1.5e10`, `-2E-3`, and the
// corner cases `.5e3`, `2e0`. Backwards-compatible: every previously-
// accepted number still parses. The exponent part is optional; a bare
// `e` after digits (no exponent digits) is NOT a number — it stays a
// symbol, matching Scheme reader tradition.
const NUM_RE = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/
const RAT_RE = /^[+-]?\d+\/\d+$/
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
    if (c === '(' || c === ')') { out.push({ t: c, line: L, col: C }); adv(); continue }
    // `'` is the quote reader macro when it starts a token (after a
    // delimiter or at BOF). If it appears mid-atom — e.g. `banker's` —
    // this is an author typo/paste from prose; catching it at the reader
    // level yields a clearer error than letting the parser downstream
    // complain about `(banker (quote s))`. Detect by looking at the
    // previous non-comment char: it must be either start-of-input or a
    // delimiter (whitespace / paren / string / comment start).
    if (c === "'") {
      const prev = i > 0 ? src[i - 1] : null
      if (prev !== null && !DELIM.has(prev) && prev !== '\n' && prev !== '\r') {
        throw new ReadError(
          "apostrophe (') inside identifier — Motoi uses ' as quote; " +
          'rename the identifier (banker-s, banker_s) or use spaces',
          L, C,
        )
      }
      out.push({ t: c, line: L, col: C }); adv(); continue
    }
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
        if (src[i] === '\\' && i + 1 < n) {
          // R7RS-style escape sequences: recognize the common ones
          // (\n \t \r \\ \" \0). Anything else falls through to the
          // literal next character (\a → a) for backward-compat.
          const next = src[i + 1]
          switch (next) {
            case 'n': s += '\n'; break
            case 't': s += '\t'; break
            case 'r': s += '\r'; break
            case '"': s += '"'; break
            case '\\': s += '\\'; break
            case '0': s += '\0'; break
            default: s += next
          }
          adv(2)
        }
        else { s += src[i]; adv() }
      }
      if (i >= n) throw new ReadError('unterminated string', L, C)
      adv() // closing quote
      out.push({ t: { str: s }, line: L, col: C })
      continue
    }
    // R7RS §6.9 bytevector literal: #u8(b0 b1 …). Emit an open-token that the
    // parser turns into a Uint8Array; the trailing `(` is consumed here.
    if (c === '#' && src[i + 1] === 'u' && src[i + 2] === '8' && src[i + 3] === '(') {
      out.push({ t: '#u8(', line: L, col: C }); adv(4); continue
    }
    // R7RS §6.8 vector literal: #(e0 e1 …). Emit an open-token that the
    // parser turns into a SchemeVector; the trailing `(` is consumed here.
    if (c === '#' && src[i + 1] === '(') {
      out.push({ t: '#(', line: L, col: C }); adv(2); continue
    }
    // R7RS §6.6 character literal: #\X, #\space, #\(, #\newline, #\x41 ...
    // The char immediately after `#\` is ALWAYS taken literally (even a
    // delimiter like `(` or a space); if it's a letter we keep reading to
    // capture named literals (space/newline/tab/…).
    if (c === '#' && src[i + 1] === '\\') {
      let j = i + 2
      if (j < n) {
        const first = src[j]
        j++                                     // always consume one char
        if (/[A-Za-z]/.test(first)) { while (j < n && !DELIM.has(src[j])) j++ }
      }
      out.push({ t: src.slice(i, j), line: L, col: C })
      adv(j - i)
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
  if (tok.length >= 3 && tok[0] === '#' && tok[1] === '\\') return ch(charFromToken(tok.slice(2)))
  // R7RS number tower: inexact infinities/NaN, then exact rational literals.
  if (tok === '+inf.0') return Infinity
  if (tok === '-inf.0') return -Infinity
  if (tok === '+nan.0' || tok === '-nan.0') return NaN
  if (RAT_RE.test(tok)) {
    const slash = tok.indexOf('/')
    const den = BigInt(tok.slice(slash + 1))
    if (den !== 0n) return makeRational(BigInt(tok.slice(0, slash)), den)
  }
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
        if (toks[pos].t === '.') {
          const dot = toks[pos]
          pos++ // consume .
          if (pos >= toks.length || toks[pos].t === ')') {
            throw new ReadError('nothing after . in pair', dot.line, dot.col)
          }
          const tail = read()
          if (pos >= toks.length || toks[pos].t !== ')') {
            throw new ReadError('more than one form after . in pair', dot.line, dot.col)
          }
          pos++ // consume )
          // `(1 . (2 3))` is the same object as `(1 2 3)` — a proper list.
          if (Array.isArray(tail)) return tagPos([...list, ...tail], { line: tk.line, col: tk.col })
          let acc = tail
          for (let i = list.length - 1; i >= 0; i--) acc = new Pair(list[i], acc)
          return tagPos(acc, { line: tk.line, col: tk.col })
        }
        list.push(read())
      }
      pos++ // consume )
      return tagPos(list, { line: tk.line, col: tk.col })
    }
    if (t === '#u8(') {
      const bytes = []
      while (true) {
        if (pos >= toks.length) throw new ReadError('missing ) in bytevector', tk.line, tk.col)
        if (toks[pos].t === ')') break
        bytes.push(read())
      }
      pos++ // consume )
      return Uint8Array.from(bytes.map((b) => Number(b) & 0xff))
    }
    if (t === '#(') {
      const items = []
      while (true) {
        if (pos >= toks.length) throw new ReadError('missing ) in vector', tk.line, tk.col)
        if (toks[pos].t === ')') break
        items.push(read())
      }
      pos++ // consume )
      return mkVec(items)
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
