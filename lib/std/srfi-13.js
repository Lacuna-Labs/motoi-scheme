// lib/std/srfi-13.js — SRFI-13: String Library (the working-Scheme string
// baseline BEYOND R7RS §6.7).
//
// Relocated 2026-07-24 from src/r7rs-completions.js (full standard-library
// relocation into per-part libs). This is the SRFI-13 PART: only the string
// verbs that are NOT already in R7RS §6.7 live here. The R7RS §6.7 string
// verbs (string-upcase/downcase, string->list, comparisons, make-string,
// string-copy, symbol<->string) live in lib/std/r7rs-completions-core.js
// per the conformance ladder (R7RS-small first, then the SRFI).
//
// Provenance: SRFI-13 (Olin Shivers). https://srfi.schemers.org/srfi-13/
//
// NOTE on divergences from SRFI-13 (kept, documented):
//   • `string-split` here is Racket-flavored (whitespace default, string
//     separator) rather than SRFI-13's char-set API — Motoi has no
//     char-sets yet. See broken-examples/string-split-charset.
//   • `string-replace` is the common "replace all substrings" spelling,
//     not SRFI-13's positional (string-replace s1 s2 start1 end1 …).
//   • The optional `token-set` / `criterion` argument that SRFI-13 spells as
//     a CHAR-SET is spelled in Motoi as a character or a one-argument
//     predicate on characters (the same shape `string-index` already
//     accepts), because Motoi has no char-set objects. The no-optional-arg
//     default behavior is the SRFI-13 default in every case. Added
//     2026-08-02 with string-tokenize / string-index-right / string-skip.

import { apply, Closure } from '../../src/interp.js'
import { Ch, ch } from '../../lib/base/r7rs-types.js'
import { registerPartMeta } from './_shared.js'

// The R7RS §6.6 character passed to string-index/string-count may arrive as a
// Ch (the `#\l` literal), a bare 1-char string (legacy call sites), or a
// predicate. Normalize a char argument to its scalar string, else null.
const charStr = (x) => (x instanceof Ch ? x.value : (typeof x === 'string' ? x : null))

export const STD = 'SRFI-13'
export const SPEC = 'spec/srfi-13.slatl'
export const LAZY = true // not in the default bundle; pulled in explicitly

export const VERBS = [
  'string-contains', 'string-index', 'string-split', 'string-join',
  'string-titlecase', 'string-take', 'string-drop', 'string-pad',
  'string-pad-right', 'string-trim', 'string-trim-left', 'string-trim-right',
  'string-replace', 'string-reverse', 'string-count',
  'string-prefix?', 'string-suffix?', 'string-null?',
  // Surface completion 2026-08-02 — SRFI-13 procedures the part declared
  // but never wired.
  'string-tokenize', 'string-fold', 'string-fold-right', 'string-any',
  'string-every', 'string-concatenate', 'string-index-right', 'string-skip',
]

export function installSRFI13 (env, fuelBox) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  // (string-contains hay needle) — SRFI-13. Return index or #f.
  def('string-contains', (hay, needle) => {
    const i = String(hay).indexOf(String(needle))
    return i < 0 ? false : i
  })

  // (string-index s pred-or-char) — SRFI-13. First index where pred/char matches.
  def('string-index', (s, predOrChar) => {
    const str = String(s)
    const cs = charStr(predOrChar)
    if (cs !== null) {
      const i = str.indexOf(cs)
      return i < 0 ? false : i
    }
    if (typeof predOrChar === 'function' || predOrChar instanceof Closure) {
      for (let i = 0; i < str.length; i++) {
        if (apply(predOrChar, [ch(str.charAt(i))], fuelBox) !== false) return i
      }
    }
    return false
  })

  // (string-split s sep) — SRFI-13-ish, Racket-style. Return list of parts.
  def('string-split', (s, sep) => {
    if (sep == null || sep === '') return String(s).split(/\s+/).filter((x) => x !== '')
    return String(s).split(String(sep))
  })

  // (string-join lst [sep]) — SRFI-13-ish. Inverse of string-split.
  def('string-join', (lst, sep = ' ') => {
    if (!Array.isArray(lst)) return String(lst)
    return lst.map(String).join(String(sep))
  })

  // (string-titlecase s) — SRFI-13. Uppercase first letter of every word.
  def('string-titlecase', (s) => {
    return String(s).replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
  })

  // (string-take s n) — SRFI-13.
  def('string-take', (s, n) => String(s).slice(0, Math.max(0, n | 0)))

  // (string-drop s n) — SRFI-13.
  def('string-drop', (s, n) => String(s).slice(Math.max(0, n | 0)))

  // (string-pad s len [char]) — SRFI-13. Left-pad to len.
  def('string-pad', (s, len, char = ' ') => String(s).padStart(len | 0, String(char)))

  // (string-pad-right s len [char]) — SRFI-13.
  def('string-pad-right', (s, len, char = ' ') => String(s).padEnd(len | 0, String(char)))

  // (string-trim s) / string-trim-left / string-trim-right — SRFI-13.
  def('string-trim', (s) => String(s).trim())
  def('string-trim-left', (s) => String(s).replace(/^\s+/, ''))
  def('string-trim-right', (s) => String(s).replace(/\s+$/, ''))

  // (string-replace s from to) — SRFI-13-adjacent, common "replace all" form.
  def('string-replace', (s, from, to) => {
    return String(s).split(String(from)).join(String(to))
  })

  // (string-reverse s) — SRFI-13.
  def('string-reverse', (s) => String(s).split('').reverse().join(''))

  // (string-count s pred-or-char) — SRFI-13.
  def('string-count', (s, predOrChar) => {
    const str = String(s)
    let n = 0
    const cs = charStr(predOrChar)
    if (cs !== null) {
      for (let i = 0; i < str.length; i++) if (str.charAt(i) === cs) n++
      return n
    }
    if (typeof predOrChar === 'function' || predOrChar instanceof Closure) {
      for (let i = 0; i < str.length; i++) {
        if (apply(predOrChar, [ch(str.charAt(i))], fuelBox) !== false) n++
      }
    }
    return n
  })

  // (string-prefix? s1 s2) — SRFI-13. #t if s1 is a prefix of s2.
  def('string-prefix?', (s1, s2) => String(s2).startsWith(String(s1)))

  // (string-suffix? s1 s2) — SRFI-13. #t if s1 is a suffix of s2.
  def('string-suffix?', (s1, s2) => String(s2).endsWith(String(s1)))

  // (string-null? s) — SRFI-13. #t if s is the empty string.
  def('string-null?', (s) => String(s).length === 0)

  // ── Surface completion 2026-08-02 ─────────────────────────────────
  // The SRFI-13 procedures the part declared but never bound.
  //
  // SRFI-13 gives most of these an optional [start end] substring window and
  // spells the "which characters count" argument as a CHAR-SET. Motoi has no
  // char-set objects, so a criterion here is a character (#\a or a one-char
  // string) or a one-argument predicate on characters — the same shape
  // `string-index` already accepts. The start/end window IS supported, so
  // these conform to the SRFI-13 signature everywhere Motoi can.

  // Turn a SRFI-13 "criterion" into a JS char→boolean test. Refuses a
  // multi-character string rather than inventing char-set semantics.
  const _criterion = (name, c) => {
    if (typeof c === 'function' || c instanceof Closure) {
      return (chr) => apply(c, [ch(chr)], fuelBox) !== false
    }
    if (c instanceof Ch) { const t = c.value; return (chr) => chr === t }
    if (typeof c === 'string') {
      if (c.length === 1) return (chr) => chr === c
      throw new Error(
        `${name}: "${c}" is ${c.length} characters, and ${name} tests ONE character at a time. ` +
        'SRFI-13 would take a char-set here; Motoi has no char-sets, so pass a single ' +
        'character (#\\a) or a predicate — (lambda (c) (char-alphabetic? c)).')
    }
    throw new Error(
      `${name}: expected a character or a predicate on characters, got something else. ` +
      'Try #\\a or (lambda (c) (char-alphabetic? c)).')
  }

  // Clamp a SRFI-13 [start end] window onto a string.
  const _window = (str, start, end) => {
    const s = start === undefined ? 0 : Math.max(0, Math.min(str.length, start | 0))
    const e = end === undefined ? str.length : Math.max(s, Math.min(str.length, end | 0))
    return [s, e]
  }

  // (string-tokenize s [token-set start end]) — SRFI-13. Split s into the
  // maximal runs of characters that belong to token-set. The DEFAULT
  // token-set is char-set:graphic, i.e. split on whitespace and drop the
  // empty pieces — so (string-tokenize "a  b c") is ("a" "b" "c").
  // Unlike string-split, string-tokenize never returns an empty token.
  def('string-tokenize', (s, tokenSet, start, end) => {
    const str = String(s)
    const [i0, i1] = _window(str, start, end)
    const isTok = tokenSet === undefined
      ? (chr) => !/\s/.test(chr)
      : _criterion('string-tokenize', tokenSet)
    const out = []
    let cur = ''
    for (let i = i0; i < i1; i++) {
      const chr = str.charAt(i)
      if (isTok(chr)) cur += chr
      else if (cur !== '') { out.push(cur); cur = '' }
    }
    if (cur !== '') out.push(cur)
    return out
  })

  // (string-fold kons knil s [start end]) — SRFI-13. Left fold over the
  // characters: (kons char acc), character first, like every SRFI fold.
  def('string-fold', (kons, knil, s, start, end) => {
    const str = String(s)
    const [i0, i1] = _window(str, start, end)
    let acc = knil
    for (let i = i0; i < i1; i++) acc = apply(kons, [ch(str.charAt(i)), acc], fuelBox)
    return acc
  })

  // (string-fold-right kons knil s [start end]) — SRFI-13. Right fold.
  def('string-fold-right', (kons, knil, s, start, end) => {
    const str = String(s)
    const [i0, i1] = _window(str, start, end)
    let acc = knil
    for (let i = i1 - 1; i >= i0; i--) acc = apply(kons, [ch(str.charAt(i)), acc], fuelBox)
    return acc
  })

  // (string-any pred s [start end]) — SRFI-13. Returns the TRUE VALUE that
  // pred produced on the first character it liked (not just #t), or #f if it
  // liked none. An empty string gives #f.
  def('string-any', (pred, s, start, end) => {
    const str = String(s)
    const [i0, i1] = _window(str, start, end)
    // A char criterion is legal here too; it just yields #t/#f.
    const test = (typeof pred === 'function' || pred instanceof Closure)
      ? (chr) => apply(pred, [ch(chr)], fuelBox)
      : ((hit) => (chr) => hit(chr) || false)(_criterion('string-any', pred))
    for (let i = i0; i < i1; i++) {
      const r = test(str.charAt(i))
      if (r !== false) return r
    }
    return false
  })

  // (string-every pred s [start end]) — SRFI-13. Returns the value of the
  // LAST application of pred if every character satisfied it, #f as soon as
  // one does not. An empty string gives #t (nothing failed).
  def('string-every', (pred, s, start, end) => {
    const str = String(s)
    const [i0, i1] = _window(str, start, end)
    const test = (typeof pred === 'function' || pred instanceof Closure)
      ? (chr) => apply(pred, [ch(chr)], fuelBox)
      : ((hit) => (chr) => hit(chr) || false)(_criterion('string-every', pred))
    let last = true
    for (let i = i0; i < i1; i++) {
      const r = test(str.charAt(i))
      if (r === false) return false
      last = r
    }
    return last
  })

  // (string-concatenate string-list) — SRFI-13. Append every string in the
  // list. The list form of string-append; takes ONE argument, a list.
  def('string-concatenate', (lst) => {
    if (!Array.isArray(lst)) {
      throw new Error(
        'string-concatenate: expected a LIST of strings — it takes one list, not many strings. ' +
        'Use (string-concatenate (list "a" "b")), or (string-append "a" "b") for loose arguments.')
    }
    return lst.map(String).join('')
  })

  // (string-index-right s criterion [start end]) — SRFI-13. The index of the
  // LAST character matching criterion, or #f. The mirror of string-index.
  def('string-index-right', (s, criterion, start, end) => {
    const str = String(s)
    const [i0, i1] = _window(str, start, end)
    const hit = _criterion('string-index-right', criterion)
    for (let i = i1 - 1; i >= i0; i--) if (hit(str.charAt(i))) return i
    return false
  })

  // (string-skip s criterion [start end]) — SRFI-13. The index of the first
  // character that does NOT match criterion, or #f if they all match. Where
  // string-index finds the first hit, string-skip finds the first miss.
  def('string-skip', (s, criterion, start, end) => {
    const str = String(s)
    const [i0, i1] = _window(str, start, end)
    const hit = _criterion('string-skip', criterion)
    for (let i = i0; i < i1; i++) if (!hit(str.charAt(i))) return i
    return false
  })

  registerPartMeta(META, { source: 'lib/std/srfi-13.js' })
  return env
}

export const META = [
  ['string-contains',   2,            '(string-contains hay needle) → index of first match, or #f. SRFI-13.',         '(string-contains "hello world" "world") => 6',   'string'],
  ['string-index',      2,            '(string-index s char-or-pred) → index of first match, or #f. SRFI-13.',        '(string-index "hello" "l") => 2',                'string'],
  ['string-split',      [1, 2],       '(string-split s [sep]) → list of parts. Whitespace default sep. SRFI-13.',     '(string-split "a,b,c" ",") => ("a" "b" "c")',    'string'],
  ['string-join',       [1, 2],       '(string-join lst [sep]) → glue lst with sep. Inverse of split. SRFI-13.',      '(string-join (list "a" "b" "c") "-") => "a-b-c"', 'string'],
  ['string-titlecase',  1,            'Titlecase (first-letter-cap per word). SRFI-13.',                     '(string-titlecase "hello world") => "Hello World"', 'string'],
  ['string-take',       2,            '(string-take s n) — first n characters. SRFI-13.',                    '(string-take "hello" 3) => "hel"',               'string'],
  ['string-drop',       2,            '(string-drop s n) — drop first n characters. SRFI-13.',               '(string-drop "hello" 2) => "llo"',               'string'],
  ['string-pad',        [2, 3],       '(string-pad s len [char]) — left-pad to len. SRFI-13.',                        '(string-pad "7" 3 "0") => "007"',                'string'],
  ['string-pad-right',  [2, 3],       '(string-pad-right s len [char]) — right-pad to len. SRFI-13.',                 '(string-pad-right "7" 3 "0") => "700"',          'string'],
  ['string-trim',       1,            'Trim whitespace from both ends. SRFI-13.',                            '(string-trim "  hi  ") => "hi"',                 'string'],
  ['string-trim-left',  1,            'Trim leading whitespace. SRFI-13.',                                   '(string-trim-left "  hi") => "hi"',              'string'],
  ['string-trim-right', 1,            'Trim trailing whitespace. SRFI-13.',                                  '(string-trim-right "hi  ") => "hi"',             'string'],
  ['string-replace',    3,            '(string-replace s from to) → replace all occurrences. SRFI-13.',               '(string-replace "hello" "l" "L") => "heLLo"',    'string'],
  ['string-reverse',    1,            'Reverse a string. SRFI-13.',                                          '(string-reverse "abc") => "cba"',                'string'],
  ['string-count',      2,            '(string-count s char-or-pred) → count of matches. SRFI-13.',                   '(string-count "hello" "l") => 2',                'string'],
  ['string-prefix?',    2,            '(string-prefix? s1 s2) → #t if s1 is a prefix of s2. SRFI-13.',                '(string-prefix? "he" "hello") => #t',            'string'],
  ['string-suffix?',    2,            '(string-suffix? s1 s2) → #t if s1 is a suffix of s2. SRFI-13.',                '(string-suffix? "lo" "hello") => #t',            'string'],
  ['string-null?',      1,            '(string-null? s) → #t if s is the empty string. SRFI-13.',                     '(string-null? "") => #t',                        'string'],
  // Surface completion 2026-08-02.
  ['string-tokenize',   [1, 4],       '(string-tokenize s [token-set start end]) → list of the maximal token runs; splits on whitespace by default and never yields an empty token. SRFI-13 (Motoi spells token-set as a char or a predicate).', '(string-tokenize "a  b c") => ("a" "b" "c")', 'string'],
  ['string-fold',       [3, 5],       '(string-fold kons knil s [start end]) — left fold over the characters, (kons char acc). SRFI-13.', '(string-fold (lambda (c n) (+ n 1)) 0 "abc") => 3', 'higher-order'],
  ['string-fold-right', [3, 5],       '(string-fold-right kons knil s [start end]) — right fold over the characters, (kons char acc). SRFI-13.', '(string-fold-right cons (list) "abc") => (#\\a #\\b #\\c)', 'higher-order'],
  ['string-any',        [2, 4],       '(string-any pred s [start end]) → the true value pred gave on the first character it liked, else #f. SRFI-13.', '(string-any char-numeric? "ab3c") => #t', 'higher-order'],
  ['string-every',      [2, 4],       '(string-every pred s [start end]) → the last value of pred if every character satisfied it, else #f; #t for the empty string. SRFI-13.', '(string-every char-alphabetic? "abc") => #t', 'higher-order'],
  ['string-concatenate', 1,           '(string-concatenate string-list) — append every string in a LIST. The list form of string-append. SRFI-13.', '(string-concatenate (list "ab" "cd")) => "abcd"', 'string'],
  ['string-index-right', [2, 4],      '(string-index-right s char-or-pred [start end]) → index of the LAST match, or #f. SRFI-13.', '(string-index-right "hello" #\\l) => 3', 'string'],
  ['string-skip',       [2, 4],       '(string-skip s char-or-pred [start end]) → index of the first character that does NOT match, or #f. SRFI-13.', '(string-skip "aaab" #\\a) => 3', 'string'],
]

export default installSRFI13
