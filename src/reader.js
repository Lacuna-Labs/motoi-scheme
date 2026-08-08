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
import { makeRational, isRational } from '../lib/math/exact.js'
import { flo, num, toExact, toInexact, exactFromDecimal } from '../lib/math/tower.js'
import { makeComplex } from '../lib/math/complex.js'

import { NIL, Pair, arrayToList, isList, isListish, isNull, isPair, listLength, listToArray, pairToString, seqVerb, toJS, toScheme } from '../lib/base/list.js'
export class Sym {
  constructor(name) { this.name = name }
  toString() { return this.name }
}

// How a list is spelled now lives in one file. Re-exported here because the
// reader is where every other module has always imported it from.
export { Pair, isPair, pairToString } from '../lib/base/list.js'

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
// R7RS §7.1.1 allows five exponent markers — `e` plus the precision-specific
// `s f d l`. They all denote the same flonum here (Motoi has one float type),
// so `1s2`, `1f2` and `1e2` are all 100.0.
const NUM_RE = /^[+-]?(\d+\.?\d*|\.\d+)([esfdlESFDL][+-]?\d+)?$/
const RAT_RE = /^[+-]?\d+\/\d+$/

// Every real that is written without a radix prefix: infinities, NaN (all
// case-insensitive per §7.1.1) and ordinary decimals. Returns null when the
// text is not a number, so callers can leave the token alone.
function plainReal(tok) {
  const lc = tok.toLowerCase()
  if (lc === '+inf.0') return Infinity
  if (lc === '-inf.0') return -Infinity
  if (lc === '+nan.0' || lc === '-nan.0') return NaN
  if (!NUM_RE.test(tok)) return null
  // §6.2.5: a number written in DECIMAL notation — with a point or an exponent
  // marker — is inexact; a bare integer is exact. `1` and `1.0` used to read as
  // the same JS double, which is why `(exact? 1.0)` said #t.
  if (/[.esfdlESFDL]/.test(tok)) {
    // parseFloat only knows `e`; normalize the other four markers onto it.
    return flo(parseFloat(tok.replace(/[sfdlSFDL]/, 'e')))
  }
  // An exact integer literal keeps every digit it was written with. Past 2^53
  // a double cannot, so `9007199254740993` became …92 the moment it was read.
  const big = BigInt(tok)
  return (big <= 9007199254740991n && big >= -9007199254740991n) ? Number(big) : big
}
const DELIM = new Set([' ', '\t', '\n', '\r', '(', ')', ';', "'", '"', '|'])

// R7RS §6.2.5 number prefixes. `#x11` is 17, not the symbol `#x11`.
const RADIX = { b: 2, o: 8, d: 10, x: 16 }
const DIGITS = '0123456789abcdef'

function digitsToBigInt(s, radix) {
  if (!s.length) return null
  let acc = 0n
  const R = BigInt(radix)
  for (const c of s.toLowerCase()) {
    const d = DIGITS.indexOf(c)
    if (d < 0 || d >= radix) return null
    acc = acc * R + BigInt(d)
  }
  return acc
}

// The body after any prefixes, in the given radix. Returns a JS number, a
// rational, or null when the text is not a number at all (so the caller can
// leave it alone rather than guess).
function realInRadix(body, radix) {
  // §7.1.1 puts <infnan> outside <ureal R>, so it is spelled the same in
  // every radix — `#x+inf.0` is an infinity, not the hex digits `inf`.
  const lc = body.toLowerCase()
  if (lc === '+inf.0') return Infinity
  if (lc === '-inf.0') return -Infinity
  if (lc === '+nan.0' || lc === '-nan.0') return NaN
  let sign = 1n
  let s = body
  if (s[0] === '+') s = s.slice(1)
  else if (s[0] === '-') { sign = -1n; s = s.slice(1) }
  const slash = s.indexOf('/')
  if (slash >= 0) {
    const num = digitsToBigInt(s.slice(0, slash), radix)
    const den = digitsToBigInt(s.slice(slash + 1), radix)
    if (num === null || den === null || den === 0n) return null
    return makeRational(sign * num, den)
  }
  if (radix === 10) return plainReal(body)
  const v = digitsToBigInt(s, radix)
  return v === null ? null : Number(sign * v)
}

const isSign = (c) => c === '+' || c === '-'

// Where the imaginary part starts. §7.1.1 REQUIRES a sign in front of it, so
// the split is the last sign that is not an exponent's — which is also what
// keeps `2i` a symbol while `+2i` is a number.
function imagSplit(s, radix) {
  for (let i = s.length - 1; i > 0; i--) {
    if (!isSign(s[i])) continue
    // Only radix 10 has exponent markers; in radix 16 `e` is a digit, so
    // `#x1e+2i` really is 30+2i.
    if (radix === 10 && /[esfdl]/i.test(s[i - 1])) continue
    return i
  }
  return -1
}

// §7.1.1 <complex R>, both notations. Returns the two components AND the text
// each was written as, because `#e` has to be applied to the DIGITS: `#e0.1i`
// is 1/10, not the dyadic rational 0.1 rounds to. Null when the text is not a
// complex number, so the caller can leave the token alone.
function complexParts(body, radix) {
  const at = body.indexOf('@')
  if (at > 0) {
    const mag = realInRadix(body.slice(0, at), radix)
    const ang = realInRadix(body.slice(at + 1), radix)
    if (mag === null || ang === null) return null
    // §6.2.5: polar notation goes through a transcendental, so the result is
    // inexact even when both components were written exact.
    const m = num(mag), a = num(ang)
    return { re: flo(m * Math.cos(a)), im: flo(m * Math.sin(a)), reText: null, imText: null }
  }
  const last = body[body.length - 1]
  if (last !== 'i' && last !== 'I') return null
  const s = body.slice(0, -1)
  const k = imagSplit(s, radix)
  const reText = k < 0 ? '0' : s.slice(0, k)
  const imText = k < 0 ? s : s.slice(k)
  if (!isSign(imText[0])) return null
  const re = k < 0 ? 0 : realInRadix(reText, radix)
  if (re === null) return null
  // `+i` / `-i` elide the 1, and the elided 1 is EXACT.
  const im = imText.length === 1
    ? (imText === '+' ? 1 : -1)
    : realInRadix(imText, radix)
  if (im === null) return null
  return { re, im, reText, imText }
}

function numInRadix(body, radix) {
  const real = realInRadix(body, radix)
  if (real !== null) return real
  const parts = complexParts(body, radix)
  return parts === null ? null : makeComplex(parts.re, parts.im)
}

// `#e` and `#i` are the exactness prefixes; both now route through the one
// tower so a literal and a call to `exact`/`inexact` cannot disagree.
const exactOf = (v) => toExact(v)
const inexactOf = (v) => toInexact(v)

function applyExactness(text, value, exact, radix) {
  // In radix 10 the exact reading comes from the DIGITS, not from the double
  // they parsed to: `#e0.1` is 1/10, not the dyadic rational 0.1 rounds to.
  if (exact === 'e') {
    if (radix === 10 && text !== null) {
      const ex = exactFromDecimal(text)
      if (ex !== null) return ex
    }
    return exactOf(value)
  }
  if (exact === 'i') return inexactOf(value)
  return value
}

// `#x` `#o` `#b` `#d` `#e` `#i` in either order, at most one of each kind.
// Returns undefined for anything that is not a prefixed number, so `#t`,
// `#(`, `#\a` and ordinary symbols fall through untouched.
function numFromPrefixed(tok) {
  if (typeof tok !== 'string' || tok.length < 3 || tok[0] !== '#') return undefined
  let radix = null
  let exact = null
  let i = 0
  while (tok[i] === '#') {
    const c = tok[i + 1]
    if (c === undefined) return undefined
    const lc = c.toLowerCase()
    if (Object.prototype.hasOwnProperty.call(RADIX, lc)) {
      if (radix !== null) return undefined
      radix = RADIX[lc]
    } else if (lc === 'e' || lc === 'i') {
      if (exact !== null) return undefined
      exact = lc
    } else return undefined
    i += 2
  }
  const body = tok.slice(i)
  if (!body) return undefined
  const R = radix ?? 10
  const real = realInRadix(body, R)
  if (real !== null) return applyExactness(body, real, exact, R)
  const parts = complexParts(body, R)
  if (parts === null) return undefined
  return makeComplex(
    applyExactness(parts.reText, parts.re, exact, R),
    applyExactness(parts.imText, parts.im, exact, R),
  )
}

// `string->number` (src/base.js) keeps its own spelling of the REAL grammar,
// but §7.1.1's <complex R> is written once, here, so the two cannot drift.
// Returns null — never throws — for anything that is not a complex number;
// `#e+inf.0i` names no exact value, and that is a #f, not an error.
export function complexFromString(text, radix, exactness) {
  const parts = complexParts(text, radix)
  if (parts === null) return null
  try {
    return makeComplex(
      applyExactness(parts.reText, parts.re, exactness, radix),
      applyExactness(parts.imText, parts.im, exactness, radix),
    )
  } catch {
    return null
  }
}

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
  // §7.1.2 `#!fold-case` / `#!no-fold-case` are directives, not data: they take
  // effect from where they appear to the end of the stream (or the next one).
  let fold = false
  while (i < n) {
    const c = src[i]
    const L = line, C = col
    // A comment ends at ANY line terminator. Stopping only at \n meant a file
    // with lone-\r line endings swallowed everything to the next \n.
    if (c === ';') { while (i < n && src[i] !== '\n' && src[i] !== '\r') adv(); continue }
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
      // The other reader macros count as delimiters here even though they are
      // not in DELIM (which also governs where an ATOM ends, and widening it
      // would change atom lexing). `,'five` inside a quasiquote is ordinary
      // R7RS — unquote of a quote — and was being read as an apostrophe typo.
      const PREFIX = prev === '`' || prev === ',' || prev === '@' || prev === '#'
      if (prev !== null && !PREFIX && !DELIM.has(prev) && prev !== '\n' && prev !== '\r') {
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
          // R7RS §6.7 escape sequences. Anything unrecognized falls through
          // to the literal next character (\q → q) for backward-compat.
          const next = src[i + 1]
          if (next === 'x' || next === 'X') {
            let j = i + 2
            let hex = ''
            while (j < n && /[0-9a-fA-F]/.test(src[j])) { hex += src[j]; j++ }
            if (hex && j < n && src[j] === ';') {
              s += String.fromCodePoint(parseInt(hex, 16))
              adv(j + 1 - i)
              continue
            }
            s += next; adv(2); continue
          }
          // \<intraline ws>* <newline> <intraline ws>*  — a line continuation,
          // contributing nothing to the string.
          if (next === ' ' || next === '\t' || next === '\n' || next === '\r') {
            let j = i + 1
            while (j < n && (src[j] === ' ' || src[j] === '\t')) j++
            if (j < n && (src[j] === '\n' || src[j] === '\r')) {
              if (src[j] === '\r' && src[j + 1] === '\n') j++
              j++
              while (j < n && (src[j] === ' ' || src[j] === '\t')) j++
              adv(j - i)
              continue
            }
            s += next; adv(2); continue
          }
          switch (next) {
            case 'a': s += '\x07'; break
            case 'b': s += '\b'; break
            case 'n': s += '\n'; break
            case 't': s += '\t'; break
            case 'r': s += '\r'; break
            case '"': s += '"'; break
            case '\\': s += '\\'; break
            case '0': s += '\0'; break
            default: s += next
          }
          adv(2)
          continue
        }
        s += src[i]; adv()
      }
      if (i >= n) throw new ReadError('unterminated string', L, C)
      adv() // closing quote
      out.push({ t: { str: s }, line: L, col: C })
      continue
    }
    // R7RS §2.2 block comment: #| … |#, nesting. Same code already ran at
    // file top level; `read` had drifted and never learned it.
    if (c === '#' && src[i + 1] === '|') {
      let depth = 1
      adv(2)
      while (i < n && depth > 0) {
        if (src[i] === '#' && src[i + 1] === '|') { depth++; adv(2); continue }
        if (src[i] === '|' && src[i + 1] === '#') { depth--; adv(2); continue }
        adv()
      }
      if (depth > 0) throw new ReadError('unterminated #| block comment', L, C)
      continue
    }
    // R7RS §2.2 datum comment: #; drops the NEXT datum, which only the
    // parser can identify, so emit a token for it.
    if (c === '#' && src[i + 1] === ';') {
      out.push({ t: '#;', line: L, col: C }); adv(2); continue
    }
    // R7RS §7.1.1 |vertical bar| symbol — arbitrary characters in a name.
    if (c === '|') {
      let s = ''
      adv()
      while (i < n && src[i] !== '|') {
        if (src[i] === '\\' && i + 1 < n) {
          const next = src[i + 1]
          // `\xHH;` — the same inline hex escape strings take, so `|H\x65;llo|`
          // is the symbol `Hello`. Without this the escape landed verbatim.
          if (next === 'x' || next === 'X') {
            let j = i + 2
            let hex = ''
            while (j < n && /[0-9a-fA-F]/.test(src[j])) { hex += src[j]; j++ }
            if (hex && j < n && src[j] === ';') {
              s += String.fromCodePoint(parseInt(hex, 16))
              adv(j + 1 - i)
              continue
            }
          }
          const named = { n: '\n', t: '\t', r: '\r', a: '\x07', b: '\b', '|': '|', '\\': '\\' }
          s += Object.prototype.hasOwnProperty.call(named, next) ? named[next] : next
          adv(2)
          continue
        }
        s += src[i]; adv()
      }
      if (i >= n) throw new ReadError('unterminated |symbol|', L, C)
      adv()
      out.push({ t: { bar: s }, line: L, col: C })
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
    // §2.4 datum labels are self-delimiting: `#0=#1=(a)` is three tokens, but
    // neither `=` nor `#` is a delimiter, so the generic atom scan below would
    // swallow the lot as one symbol.
    if (c === '#' && /\d/.test(src[i + 1] || '')) {
      let j = i + 1
      while (j < n && /\d/.test(src[j])) j++
      if (src[j] === '=' || src[j] === '#') {
        out.push({ t: src.slice(i, j + 1), line: L, col: C })
        adv(j + 1 - i)
        continue
      }
    }
    let j = i                                                               // atom
    while (j < n && !DELIM.has(src[j])) j++
    const lex = src.slice(i, j)
    const dir = lex.toLowerCase()
    if (dir === '#!fold-case' || dir === '#!no-fold-case') {
      fold = dir === '#!fold-case'
      adv(j - i)
      continue                                                  // directive, not a datum
    }
    out.push({ t: lex, line: L, col: C, fold })
    adv(j - i)
  }
  return out
}

// `fold` is set when a `#!fold-case` directive is in effect for this token.
// It folds identifiers only — a `|Bar Symbol|` and a string keep their case,
// which is why the folding happens here and not in the tokenizer.
function atom(tok, fold) {
  if (typeof tok === 'object' && tok && 'str' in tok) return tok.str
  if (typeof tok === 'object' && tok && 'bar' in tok) return sym(tok.bar)
  // §7.1.1 spells the booleans four ways and all of them are case-insensitive,
  // so `#T`, `#true` and `#TRUE` are the same datum as `#t`.
  const lc = tok.toLowerCase()
  if (lc === '#t' || lc === '#true') return true
  if (lc === '#f' || lc === '#false') return false
  if (tok.length >= 3 && tok[0] === '#' && tok[1] === '\\') return ch(charFromToken(tok.slice(2)))
  const prefixed = numFromPrefixed(tok)
  if (prefixed !== undefined) return prefixed
  // R7RS number tower: exact rational literals, then everything plainReal knows
  // (infinities, NaN, decimals, the five exponent markers).
  if (RAT_RE.test(tok)) {
    const slash = tok.indexOf('/')
    const den = BigInt(tok.slice(slash + 1))
    if (den !== 0n) return makeRational(BigInt(tok.slice(0, slash)), den)
  }
  const real = plainReal(tok)
  if (real !== null) return real
  const parts = complexParts(tok, 10)
  if (parts !== null) return makeComplex(parts.re, parts.im)
  return sym(fold ? lc : tok)
}

// A `#n#` read before its `#n=` datum finished being built. Replaced in place
// by `patchLabels` the moment the label is bound, which is what lets a datum
// contain itself.
class LabelRef {
  constructor(n) { this.n = n }
}

function patchLabels(root, labels) {
  if (labels.size === 0) return root
  const seen = new Set()
  const sub = (v) => (v instanceof LabelRef && labels.has(v.n)) ? labels.get(v.n) : v
  const walk = (v) => {
    if (!v || typeof v !== 'object' || seen.has(v)) return
    seen.add(v)
    // Cells first: a proper chain answers `isList` too, and its `.length` is
    // `undefined`, so the array loop below silently walked nothing and a datum
    // label inside a cell chain was never patched.
    if (v instanceof Pair) {
      v.car = sub(v.car); walk(v.car)
      v.cdr = sub(v.cdr); walk(v.cdr)
    } else if (Array.isArray(v)) {
      for (let k = 0; k < v.length; k++) { v[k] = sub(v[k]); walk(v[k]) }
    } else if (Array.isArray(v.items)) {
      for (let k = 0; k < v.items.length; k++) { v.items[k] = sub(v.items[k]); walk(v.items[k]) }
    }
  }
  walk(root)
  return sub(root)
}

// ── parse, with positions ────────────────────────────────────────────────
function parseInner(src) {
  const toks = tokenize(src)
  const labels = new Map()
  let pos = 0
  // `#;` drops the datum that FOLLOWS it, so it must be skipped everywhere a
  // datum can start — not just at the front of `read`, or `(a #;b c)` breaks.
  function skipComments() {
    while (pos < toks.length && toks[pos].t === '#;') {
      const hash = toks[pos]
      pos++
      // Datum comments nest: in `#; #;x . z` the inner one eats `x`, and only
      // then does the outer one look for its own datum — and find a dot.
      skipComments()
      // `#;` must be followed by a DATUM. `(a #;. b)` names no datum, so it is
      // a read error rather than a list whose dot quietly vanished.
      if (pos < toks.length && toks[pos].t === '.') {
        throw new ReadError('#; must be followed by a datum, got .', hash.line, hash.col)
      }
      read()
    }
  }
  function read() {
    skipComments()
    if (pos >= toks.length) throw new ReadError('unexpected EOF', null, null)
    const tk = toks[pos++]
    const t = tk.t
    if (t === '(') {
      const list = []
      while (true) {
        skipComments()
        if (pos >= toks.length) throw new ReadError('missing )', tk.line, tk.col)
        if (toks[pos].t === ')') break
        if (toks[pos].t === '.') {
          const dot = toks[pos]
          if (list.length === 0) {
            throw new ReadError('nothing before . in pair', dot.line, dot.col)
          }
          pos++ // consume .
          skipComments()
          if (pos >= toks.length || toks[pos].t === ')') {
            throw new ReadError('nothing after . in pair', dot.line, dot.col)
          }
          const tail = read()
          // `(a . b #;c)` is legal — the datum comment sits between the tail
          // and the `)`, so the "one form after ." check has to look past it.
          skipComments()
          if (pos >= toks.length || toks[pos].t !== ')') {
            throw new ReadError('more than one form after . in pair', dot.line, dot.col)
          }
          pos++ // consume )
          // `(1 . (2 3))` is the same object as `(1 2 3)` — a proper list.
          //
          // The test here was `isList(tail)`, which is the trap: `isList`
          // answers #t for a cell chain and for `NIL` as well as for an array,
          // and neither of those can be SPREAD — `NIL` is a frozen singleton
          // with no iterator, and a chain has no `.length`. Spreading either
          // throws a raw JavaScript type error out of the READER, which is the
          // worst place for one: the learner has not run anything yet. Only the
          // array spelling may take the spread; the empty tail is just the list
          // itself; a chain falls through to the cell loop below, which already
          // builds the right answer for it.
          if (Array.isArray(tail)) return tagPos([...list, ...tail], { line: tk.line, col: tk.col })
          if (isNull(tail)) return tagPos(list, { line: tk.line, col: tk.col })
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
        skipComments()
        if (pos >= toks.length) throw new ReadError('missing ) in bytevector', tk.line, tk.col)
        if (toks[pos].t === ')') break
        bytes.push(read())
      }
      pos++ // consume )
      // Anything that is not an exact byte used to be coerced with `& 0xff`,
      // so `#u8(#xff)` silently became 0. Silent wrong data is worse than a
      // read error.
      const bv = new Uint8Array(bytes.length)
      for (let k = 0; k < bytes.length; k++) {
        const b = bytes[k]
        if (typeof b !== 'number' || !Number.isInteger(b) || b < 0 || b > 255) {
          throw new ReadError(
            `bytevector element must be an exact integer 0..255, got ${String(b)}`,
            tk.line, tk.col,
          )
        }
        bv[k] = b
      }
      return bv
    }
    if (t === '#(') {
      const items = []
      while (true) {
        skipComments()
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
    // §2.4 datum labels. `#n=<datum>` names the datum; `#n#` is that datum
    // again. The reference may point INTO the datum being labelled (`#0=(1 .
    // #0#)` is circular), so `#n#` reads as a placeholder and the whole
    // structure is patched once the labelled datum is complete.
    if (typeof t === 'string') {
      const def = /^#(\d+)=$/.exec(t)
      if (def) {
        const v = read()
        labels.set(def[1], v)
        return patchLabels(v, labels)
      }
      const ref = /^#(\d+)#$/.exec(t)
      if (ref) {
        if (labels.has(ref[1])) return labels.get(ref[1])
        return new LabelRef(ref[1])
      }
    }
    return atom(t, tk.fold)
  }
  const forms = []
  while (true) {
    skipComments()
    if (pos >= toks.length) break
    forms.push(read())
  }
  return forms
}

// ── writing symbols back out ─────────────────────────────────────────────
// `write` must emit a symbol that reads back as the SAME symbol, which means
// `|` bars around anything the reader would not return unchanged. Rather than
// restate §7.1.1's identifier grammar (a second copy that can drift from the
// one above), ask the reader: tokenize the name and see whether it comes back
// as exactly this symbol. Self-consistent by construction.
const BARE_SYM = new Map()
const BARE_SYM_MAX = 4096

export function symbolReadsBare(name) {
  const hit = BARE_SYM.get(name)
  if (hit !== undefined) return hit
  let ok
  // `.` alone is dot-notation, never a bare symbol, whatever the tokenizer says.
  if (name === '.') ok = false
  // Motoi's atom lexer is permissive and will read a bare `\` back as part of
  // the identifier, but R7RS §7.1.1 has no such <subsequent>: a backslash only
  // appears inside `|…|`, where it is an escape. Writing one bare would emit a
  // token no other Scheme can read.
  else if (name.includes('\\')) ok = false
  else {
    try {
      const forms = parseInner(name)
      ok = forms.length === 1 && forms[0] instanceof Sym && forms[0].name === name
    } catch {
      ok = false
    }
  }
  if (BARE_SYM.size >= BARE_SYM_MAX) BARE_SYM.clear()
  BARE_SYM.set(name, ok)
  return ok
}

const BAR_ESCAPE = { '\n': '\\n', '\t': '\\t', '\r': '\\r', '\x07': '\\a', '\b': '\\b' }

export function writeSymbol(name) {
  if (symbolReadsBare(name)) return name
  const body = name.replace(/[\\|\n\t\r\x07\b]/g, (c) =>
    BAR_ESCAPE[c] || ('\\' + c))
  return '|' + body + '|'
}

// R7RS §6.13.3: `write` output must READ BACK. `JSON.stringify` was doing this
// job, and it spells a control character `\u0007` — a JavaScript escape that
// §7.1.1's <string element> does not have, so the text Motoi printed was text
// Motoi could not read. The grammar offers exactly two spellings: the named
// escapes below, and `\x<hex>;` for everything else in the control range.
//
// A bare `|` is legal INSIDE a string (only a symbol's bars need escaping),
// and every printable character above the control range stands for itself.
const STR_ESCAPE = {
  '"': '\\"', '\\': '\\\\', '\x07': '\\a', '\b': '\\b',
  '\t': '\\t', '\n': '\\n', '\r': '\\r',
}

export function writeString(s) {
  let out = '"'
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    const esc = STR_ESCAPE[c]
    if (esc !== undefined) { out += esc; continue }
    const cc = s.charCodeAt(i)
    // The remaining C0 controls and DEL have no named escape. Two hex digits
    // minimum, so `\x0;` writes as `\x00;` — which is what chibi emits.
    if (cc < 0x20 || cc === 0x7f) {
      out += '\\x' + cc.toString(16).padStart(2, '0') + ';'
      continue
    }
    out += c
  }
  return out + '"'
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
