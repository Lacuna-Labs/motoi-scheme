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
]

export default installSRFI13
