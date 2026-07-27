// lib/std/r7rs-completions-core.js — R7RS-small completions (the standard
// core that every conforming Scheme ships).
//
// Relocated 2026-07-24 from src/r7rs-completions.js (full standard-library
// relocation into per-part libs). This is the R7RS-SMALL PART: the semantic
// authority. It is EAGER — part of the default bundle alongside SRFI-1 —
// because R7RS-small is the baseline every Motoi program assumes.
//
// Sections (each verb's comment cites its exact R7RS section):
//   §6.4 lists · §6.7 strings · §6.5 symbols · §6.6 chars · §6.2 numeric
//   tower · §6.10 I/O + string ports · §6.9 bytevectors · §6.8 vectors ·
//   §6.11 exceptions · §5.5 records · §4.2.5 delay/force · §6.3 booleans.
//
// A handful of tiny convenience helpers (identity/const/compose) ride along
// at the end: `identity` is SRFI-1, `const`/`compose` are Motoi-own — kept
// here because they are trivial, always-eager, and depended on broadly.
//
// Provenance: R7RS-small (2013). https://small.r7rs.org/

import { apply } from '../../src/interp.js'
import { isRational, floatToRational } from '../math/exact.js'
import { Sym } from '../../src/reader.js'
import { Ch, ch, isVec, mkVec } from '../base/r7rs-types.js'
import {
  RECORD_TAG, makeRecordType, isRecord, makeRecord,
  StringInputPort, StringOutputPort, EOF, SchemeError,
  writeFormat, registerPartMeta,
} from './_shared.js'

export const STD = 'R7RS-small'
export const SPEC = 'spec/r7rs-small.slatl'
export const LAZY = false // default bundle: eager, the semantic authority

export const VERBS = [
  // §6.4 lists
  'list?', 'list-tail', 'list-copy',
  // §6.7 strings (R7RS-standard; SRFI-13 extras live in lib/std/srfi-13.js)
  'string-upcase', 'string-downcase', 'string->list', 'list->string',
  'string', 'make-string', 'string-copy', 'string<?', 'string>?',
  'string<=?', 'string>=?', 'string-ci=?', 'string-ci<?',
  // §6.5 symbols
  'symbol->string', 'string->symbol',
  // §6.6 chars
  'char-alphabetic?', 'char-numeric?', 'char-whitespace?', 'char-upper-case?',
  'char-lower-case?', 'char-upcase', 'char-downcase', 'char-foldcase',
  'char->integer', 'integer->char', 'digit-value', 'char?', 'char=?',
  'char<?', 'char>?', 'char<=?', 'char>=?',
  // §6.2 numeric tower
  'exact', 'inexact', 'exact->inexact', 'inexact->exact', 'exact?',
  'inexact?', 'integer?', 'rational?', 'real?', 'complex?', 'exact-integer?',
  'finite?', 'infinite?', 'nan?', 'gcd', 'lcm', 'numerator', 'denominator',
  'truncate', 'atan', 'square',
  // §6.10 I/O + string ports
  'write', 'write-string', 'read-line', 'read-char', 'peek-char',
  'write-char', 'eof-object', 'eof-object?', 'open-input-string',
  'open-output-string', 'get-output-string', 'close-port', 'close-input-port',
  'close-output-port', 'input-port?', 'output-port?', 'port?',
  'with-output-to-string', 'with-input-from-string',
  // §6.9 bytevectors
  'make-bytevector', 'bytevector', 'bytevector?', 'bytevector-length',
  'bytevector-u8-ref', 'bytevector-u8-set!', 'bytevector-copy',
  'bytevector-append', 'utf8->string', 'string->utf8',
  // §6.8 vectors
  'vector', 'make-vector', 'vector?', 'vector-length', 'vector-set!',
  'vector->list', 'list->vector', 'vector-map', 'vector-for-each',
  'vector-fill!', 'vector-copy',
  // §6.11 exceptions
  'error', 'raise', 'raise-continuable', 'error-object?',
  'error-object-message', 'error-object-irritants',
  // §5.5 record helpers
  '_make-record-type', '_make-record', '_record-of-type?', '_record-ref',
  '_record-set!',
  // §4.2.5 delay/force
  'force', 'make-promise', 'promise?',
  // convenience (identity SRFI-1; const/compose Motoi-own)
  'identity', 'const', 'compose',
  // §6.3/§6.5 equality
  'boolean=?', 'symbol=?',
]

export function installR7RSCore (env, fuelBox) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  // R7RS §6.6 characters are a distinct type (Ch), NOT single-char strings.
  // These helpers accept a real Ch (extract its .value) so the char/string
  // verbs conform to R7RS even though lib/base/r7rs-small.js re-registers the
  // char surface after this part loads. Legacy single-char strings still pass
  // through unchanged.
  const cs = (x) => (x instanceof Ch) ? x.value : String(x)

  // ── §6.4 lists ───────────────────────────────────────────────────
  def('list?', (a) => Array.isArray(a))
  def('list-tail', (lst, k) => Array.isArray(lst) ? lst.slice(k | 0) : [])
  def('list-copy', (lst) => Array.isArray(lst) ? lst.slice() : lst)

  // ── §6.7 strings (R7RS-standard) ─────────────────────────────────
  def('string-upcase', (s) => String(s).toUpperCase())
  def('string-downcase', (s) => String(s).toLowerCase())
  def('string->list', (s) => String(s).split('').map(ch))
  def('list->string', (lst) => Array.isArray(lst) ? lst.map(cs).join('') : cs(lst))
  def('string', (...chars) => chars.map(cs).join(''))
  def('make-string', (k, char = ' ') => cs(char).repeat(Math.max(0, k | 0)))
  def('string-copy', (s, start = 0, end) => {
    const str = String(s)
    if (end === undefined) return str.slice(start | 0)
    return str.slice(start | 0, end | 0)
  })
  def('string<?', (a, b) => String(a) < String(b))
  def('string>?', (a, b) => String(a) > String(b))
  def('string<=?', (a, b) => String(a) <= String(b))
  def('string>=?', (a, b) => String(a) >= String(b))
  def('string-ci=?', (a, b) => String(a).toLowerCase() === String(b).toLowerCase())
  def('string-ci<?', (a, b) => String(a).toLowerCase() < String(b).toLowerCase())

  // ── §6.5 symbols ─────────────────────────────────────────────────
  def('symbol->string', (s) => (s instanceof Sym) ? s.name : String(s))
  def('string->symbol', (s) => new Sym(String(s)))

  // ── §6.6 chars ───────────────────────────────────────────────────
  def('char-alphabetic?', (c) => /^[A-Za-z]$/.test(cs(c)))
  def('char-numeric?', (c) => /^[0-9]$/.test(cs(c)))
  def('char-whitespace?', (c) => /^\s$/.test(cs(c)))
  def('char-upper-case?', (c) => /^[A-Z]$/.test(cs(c)))
  def('char-lower-case?', (c) => /^[a-z]$/.test(cs(c)))
  def('char-upcase', (c) => ch(cs(c).toUpperCase()))
  def('char-downcase', (c) => ch(cs(c).toLowerCase()))
  def('char-foldcase', (c) => ch(cs(c).toLowerCase()))
  def('char->integer', (c) => cs(c).charCodeAt(0))
  def('integer->char', (n) => ch(String.fromCharCode(n | 0)))
  def('digit-value', (c) => {
    const s = cs(c)
    if (/^[0-9]$/.test(s)) return s.charCodeAt(0) - 48
    return false
  })
  def('char?', (c) => c instanceof Ch)
  def('char=?', (a, b) => cs(a) === cs(b))
  def('char<?', (a, b) => cs(a) < cs(b))
  def('char>?', (a, b) => cs(a) > cs(b))
  def('char<=?', (a, b) => cs(a) <= cs(b))
  def('char>=?', (a, b) => cs(a) >= cs(b))

  // ── §6.2 numeric tower ───────────────────────────────────────────
  // exact: inexact→exact. A non-integer float becomes a rational; a
  // rational or exact integer passes through. exact-integer floats truncate.
  def('exact', (x) => isRational(x) ? x : (Number.isInteger(x) ? x : floatToRational(x)))
  def('inexact', (x) => isRational(x) ? Number(x.n) / Number(x.d) : Number(x))
  def('exact->inexact', (x) => isRational(x) ? Number(x.n) / Number(x.d) : Number(x))
  def('inexact->exact', (x) => isRational(x) ? x : (Number.isInteger(x) ? x : floatToRational(x)))
  def('exact?', (x) => isRational(x) || (typeof x === 'number' && Number.isInteger(x)))
  def('inexact?', (x) => typeof x === 'number' && !Number.isInteger(x))
  def('integer?', (x) => (typeof x === 'number' && Number.isInteger(x)) || (isRational(x) && x.d === 1n))
  def('rational?', (x) => isRational(x) || (typeof x === 'number' && Number.isFinite(x)))
  def('real?', (x) => typeof x === 'number' || isRational(x))
  def('complex?', (x) => typeof x === 'number' || isRational(x))
  def('exact-integer?', (x) => (typeof x === 'number' && Number.isInteger(x)) || (isRational(x) && x.d === 1n))
  def('finite?', (x) => isRational(x) || (typeof x === 'number' && Number.isFinite(x)))
  def('infinite?', (x) => typeof x === 'number' && !Number.isFinite(x) && !Number.isNaN(x))
  def('nan?', (x) => typeof x === 'number' && Number.isNaN(x))
  def('gcd', (...args) => {
    if (args.length === 0) return 0
    const gcd2 = (a, b) => { a = Math.abs(a | 0); b = Math.abs(b | 0); while (b) { [a, b] = [b, a % b] } return a }
    return args.reduce(gcd2)
  })
  def('lcm', (...args) => {
    if (args.length === 0) return 1
    const gcd2 = (a, b) => { a = Math.abs(a | 0); b = Math.abs(b | 0); while (b) { [a, b] = [b, a % b] } return a }
    const lcm2 = (a, b) => (a === 0 || b === 0) ? 0 : Math.abs((a * b) / gcd2(a, b))
    return args.reduce(lcm2)
  })
  def('numerator', (x) => isRational(x) ? Number(x.n) : (Number.isInteger(x) ? x : Math.trunc(x)))
  def('denominator', (x) => isRational(x) ? Number(x.d) : 1)
  def('truncate', (x) => Math.trunc(x))
  def('atan', (y, x) => (x === undefined ? Math.atan(y) : Math.atan2(y, x)))
  def('square', (x) => x * x)

  // ── §6.10 I/O ────────────────────────────────────────────────────
  def('write', (v) => { process.stdout.write(writeFormat(v)); return undefined })
  def('write-string', (s) => { process.stdout.write(String(s)); return undefined })
  def('read-line', (port) => {
    if (!port || port._kind !== 'input') return EOF
    let out = ''
    while (true) {
      const c = port.read()
      if (c === EOF) return out === '' ? EOF : out
      if (c === '\n') return out
      out += c
    }
  })
  def('read-char', (port) => {
    if (!port || port._kind !== 'input') return EOF
    return port.read()
  })
  def('peek-char', (port) => {
    if (!port || port._kind !== 'input') return EOF
    return port.peek()
  })
  def('write-char', (c, port) => {
    if (port && port._kind === 'output') { port.write(String(c)); return undefined }
    process.stdout.write(String(c))
    return undefined
  })
  def('eof-object', () => EOF)
  def('eof-object?', (v) => v === EOF || (v != null && typeof v === 'object' && v.__eof__ === true))
  def('open-input-string', (s) => new StringInputPort(String(s)))
  def('open-output-string', () => new StringOutputPort())
  def('get-output-string', (p) => (p instanceof StringOutputPort) ? p.getOutput() : '')
  def('close-port', (p) => { if (p && p.close) p.close(); return undefined })
  def('close-input-port', (p) => { if (p && p.close) p.close(); return undefined })
  def('close-output-port', (p) => { if (p && p.close) p.close(); return undefined })
  def('input-port?', (p) => p != null && p._kind === 'input')
  def('output-port?', (p) => p != null && p._kind === 'output')
  def('port?', (p) => p != null && (p._kind === 'input' || p._kind === 'output'))
  def('with-output-to-string', (thunk) => {
    const port = new StringOutputPort()
    const origWrite = process.stdout.write.bind(process.stdout)
    process.stdout.write = (chunk) => { port.write(chunk); return true }
    try { apply(thunk, [], fuelBox) } finally { process.stdout.write = origWrite }
    return port.getOutput()
  })
  def('with-input-from-string', (s, thunk) => {
    // Build the port via the live `open-input-string` (base re-registers the
    // port surface after this part loads) so read-line/read-char recognize it.
    const port = env.get('open-input-string')(String(s))
    return apply(thunk, [port], fuelBox)
  })

  // ── §6.9 bytevectors ─────────────────────────────────────────────
  def('make-bytevector', (k, fill = 0) => {
    const bv = new Uint8Array(Math.max(0, k | 0))
    if (fill !== 0) bv.fill(fill & 0xff)
    return bv
  })
  def('bytevector', (...bytes) => new Uint8Array(bytes.map((b) => b & 0xff)))
  def('bytevector?', (v) => v instanceof Uint8Array)
  def('bytevector-length', (bv) => (bv instanceof Uint8Array) ? bv.length : 0)
  def('bytevector-u8-ref', (bv, i) => (bv instanceof Uint8Array) ? bv[i | 0] : 0)
  def('bytevector-u8-set!', (bv, i, b) => {
    if (bv instanceof Uint8Array) bv[i | 0] = b & 0xff
    return undefined
  }, 'state-change')
  def('bytevector-copy', (bv, start = 0, end) => {
    if (!(bv instanceof Uint8Array)) return new Uint8Array(0)
    const e = end === undefined ? bv.length : (end | 0)
    return bv.slice(start | 0, e)
  })
  def('bytevector-append', (...bvs) => {
    const total = bvs.reduce((n, b) => n + (b instanceof Uint8Array ? b.length : 0), 0)
    const out = new Uint8Array(total)
    let off = 0
    for (const b of bvs) {
      if (b instanceof Uint8Array) { out.set(b, off); off += b.length }
    }
    return out
  })
  def('utf8->string', (bv, start = 0, end) => {
    if (!(bv instanceof Uint8Array)) return ''
    const e = end === undefined ? bv.length : (end | 0)
    return new TextDecoder('utf-8').decode(bv.slice(start | 0, e))
  })
  def('string->utf8', (s, start = 0, end) => {
    const str = String(s)
    const slice = str.slice(start | 0, end === undefined ? str.length : (end | 0))
    return new TextEncoder().encode(slice)
  })

  // ── §6.8 vectors — a DISTINCT disjoint type (SchemeVector), never a list ──
  def('vector', (...a) => mkVec(a))
  def('make-vector', (k, fill = 0) => {
    const n = Math.max(0, k | 0)
    const out = new Array(n)
    for (let i = 0; i < n; i++) out[i] = fill
    return mkVec(out)
  })
  def('vector?', (v) => isVec(v))
  def('vector-length', (v) => isVec(v) ? v.items.length : 0)
  def('vector-set!', (v, i, x) => { if (isVec(v)) v.items[i | 0] = x; return undefined }, 'state-change')
  def('vector->list', (v) => isVec(v) ? v.items.slice() : [])
  def('list->vector', (lst) => mkVec(Array.isArray(lst) ? lst.slice() : []))
  def('vector-map', (fn, v) => isVec(v) ? mkVec(v.items.map((x) => apply(fn, [x], fuelBox))) : mkVec([]))
  def('vector-for-each', (fn, v) => { if (isVec(v)) for (const x of v.items) apply(fn, [x], fuelBox); return undefined })
  def('vector-fill!', (v, x) => { if (isVec(v)) v.items.fill(x); return undefined }, 'state-change')
  def('vector-copy', (v, start = 0, end) => {
    if (!isVec(v)) return mkVec([])
    const items = v.items
    return mkVec(end === undefined ? items.slice(start | 0) : items.slice(start | 0, end | 0))
  })

  // ── §6.11 exceptions ─────────────────────────────────────────────
  def('error', (message, ...irritants) => {
    throw new SchemeError(message, irritants)
  })
  def('raise', (obj) => {
    if (obj instanceof SchemeError) throw obj
    throw new SchemeError('raised', [obj])
  })
  def('raise-continuable', (obj) => {
    if (obj instanceof SchemeError) throw obj
    throw new SchemeError('raised', [obj])
  })
  def('error-object?', (v) => v instanceof SchemeError || (v && v.isSchemeError === true))
  // Motoi-own umbrella predicate: #t for ANY raised/caught value (structured
  // error-object OR a custom raised non-error value). Superset of error-object?.
  def('error?', (v) => v instanceof Error || (v && (v.isSchemeError === true || v._isErrorObject === true || v._isRaisedValue === true)))
  def('error-object-message', (v) => (v instanceof SchemeError) ? v.message_ : (v && v.message) || '')
  def('error-object-irritants', (v) => (v instanceof SchemeError) ? v.irritants : [])

  // ── §5.5 record helpers (define-record-type is a special form) ───
  def('_make-record-type', (name, ...fields) => {
    const fieldNames = fields.map((f) => f instanceof Sym ? f.name : String(f))
    return makeRecordType(name instanceof Sym ? name.name : String(name), fieldNames)
  })
  def('_make-record', (type, ...values) => {
    if (!type || !type[RECORD_TAG]) throw new SchemeError('_make-record: not a record type', [type])
    return makeRecord(type, values)
  })
  def('_record-of-type?', (v, type) => isRecord(v, type))
  def('_record-ref', (v, field) => {
    if (v == null || typeof v !== 'object') return false
    const key = field instanceof Sym ? field.name : String(field)
    return v[key]
  })
  def('_record-set!', (v, field, value) => {
    if (v == null || typeof v !== 'object') return undefined
    const key = field instanceof Sym ? field.name : String(field)
    v[key] = value
    return undefined
  }, 'state-change')

  // ── §4.2.5 delay/force ───────────────────────────────────────────
  def('force', (p) => {
    if (p == null || typeof p !== 'object' || !p.__promise__) return p
    if (p.forced) return p.value
    p.value = apply(p.thunk, [], fuelBox)
    p.forced = true
    p.thunk = null
    return p.value
  })
  def('make-promise', (v) => ({ __promise__: true, forced: true, value: v, thunk: null }))
  def('promise?', (v) => v != null && typeof v === 'object' && v.__promise__ === true)

  // ── convenience helpers ──────────────────────────────────────────
  def('identity', (x) => x)          // SRFI-1
  def('const', (x) => (..._args) => x)
  def('compose', (...fns) => {
    if (fns.length === 0) return (x) => x
    return (...args) => {
      let cur = apply(fns[fns.length - 1], args, fuelBox)
      for (let i = fns.length - 2; i >= 0; i--) cur = apply(fns[i], [cur], fuelBox)
      return cur
    }
  })

  // ── §6.3/§6.5 equality ───────────────────────────────────────────
  def('boolean=?', (a, b) => a === b && (a === true || a === false))
  def('symbol=?', (a, b) => (a instanceof Sym) && (b instanceof Sym) && a.name === b.name)

  registerPartMeta(META, { source: 'lib/std/r7rs-completions-core.js' })
  return env
}

export const META = [
  // §6.4 lists
  ['list?',             1,            '#t if x is a proper list. R7RS §6.4.',                                '(list? (list 1 2 3)) => #t', 'predicate'],
  ['list-tail',         2,            '(list-tail lst k) — drop the first k elements. R7RS §6.4.',           '(list-tail (list 1 2 3 4) 2) => (3 4)', 'list'],
  ['list-copy',         1,            '(list-copy lst) — a shallow copy. R7RS §6.4.',                        '(list-copy (list 1 2 3)) => (1 2 3)', 'list'],
  // §6.7 strings
  ['string-upcase',     1,            'Uppercase a string. R7RS §6.7.',                                      '(string-upcase "hi") => "HI"',                   'string'],
  ['string-downcase',   1,            'Lowercase a string. R7RS §6.7.',                                      '(string-downcase "HI") => "hi"',                 'string'],
  ['string->list',      1,            'Explode a string into a list of characters. R7RS §6.7.',              '(string->list "abc") => (#\\a #\\b #\\c)',       'string'],
  ['list->string',      1,            'Concatenate a list of characters into a string. R7RS §6.7.',          '(list->string (list #\\a #\\b #\\c)) => "abc"',  'string'],
  ['string',            [0, Infinity], 'Build a string from character arguments. R7RS §6.7.',                '(string #\\a #\\b #\\c) => "abc"',               'string'],
  ['make-string',       [1, 2],       '(make-string k [char]) — a string of k copies of char. R7RS §6.7.',   '(make-string 3 #\\-) => "---"',                  'string'],
  ['string-copy',       [1, 3],       '(string-copy s [start [end]]) — copy substring. R7RS §6.7.',          '(string-copy "hello" 1 4) => "ell"',             'string'],
  ['string<?',          2,            'Lexicographic less-than. R7RS §6.7.',                                 '(string<? "abc" "abd") => #t',                   'string'],
  ['string>?',          2,            'Lexicographic greater-than. R7RS §6.7.',                               '(string>? "abd" "abc") => #t',                   'string'],
  ['string<=?',         2,            'Lexicographic less-than-or-equal. R7RS §6.7.',                        '(string<=? "abc" "abc") => #t',                  'string'],
  ['string>=?',         2,            'Lexicographic greater-than-or-equal. R7RS §6.7.',                     '(string>=? "abc" "abc") => #t',                  'string'],
  ['string-ci=?',       2,            'Case-insensitive string equality. R7RS §6.7.',                        '(string-ci=? "Hi" "hi") => #t',                  'string'],
  ['string-ci<?',       2,            'Case-insensitive lexicographic less-than. R7RS §6.7.',                '(string-ci<? "abc" "ABD") => #t',                'string'],
  // §6.5 symbols
  ['symbol->string',    1,            'Convert a symbol to its printable name. R7RS §6.5.',                  "(symbol->string 'foo) => \"foo\"",              'string'],
  ['string->symbol',    1,            'Intern a string as a symbol. R7RS §6.5.',                             "(string->symbol \"foo\") => foo",               'string'],
  // §6.6 chars
  ['char?',             1, '#t if arg is a character object. R7RS §6.6.',               '(char? #\\a) => #t',       'char'],
  ['char=?',            2, 'Character equality. R7RS §6.6.',                            '(char=? #\\a #\\a) => #t',  'char'],
  ['char<?',            2, 'Character less-than. R7RS §6.6.',                           '(char<? #\\a #\\b) => #t',  'char'],
  ['char>?',            2, 'Character greater-than. R7RS §6.6.',                        '(char>? #\\b #\\a) => #t',  'char'],
  ['char<=?',           2, 'Character less-than-or-equal. R7RS §6.6.',                  '(char<=? #\\a #\\a) => #t', 'char'],
  ['char>=?',           2, 'Character greater-than-or-equal. R7RS §6.6.',              '(char>=? #\\b #\\a) => #t', 'char'],
  ['char-alphabetic?',  1, '#t if arg is an ASCII letter. R7RS §6.6.',                  '(char-alphabetic? #\\a) => #t', 'char'],
  ['char-numeric?',     1, '#t if arg is an ASCII digit. R7RS §6.6.',                   '(char-numeric? #\\5) => #t', 'char'],
  ['char-whitespace?',  1, '#t if arg is whitespace. R7RS §6.6.',                       '(char-whitespace? #\\space) => #t', 'char'],
  ['char-upper-case?',  1, '#t if arg is uppercase. R7RS §6.6.',                        '(char-upper-case? #\\A) => #t', 'char'],
  ['char-lower-case?',  1, '#t if arg is lowercase. R7RS §6.6.',                        '(char-lower-case? #\\a) => #t', 'char'],
  ['char-upcase',       1, 'Uppercase a single character. R7RS §6.6.',                  '(char-upcase #\\a) => #\\A', 'char'],
  ['char-downcase',     1, 'Lowercase a single character. R7RS §6.6.',                  '(char-downcase #\\A) => #\\a', 'char'],
  ['char-foldcase',     1, 'Foldcase (Unicode-lowercase, ASCII-equivalent to downcase). R7RS §6.6.', '(char-foldcase #\\A) => #\\a', 'char'],
  ['char->integer',     1, 'Char code point. R7RS §6.6.',                               '(char->integer #\\A) => 65', 'char'],
  ['integer->char',     1, 'Code point → character. R7RS §6.6.',                        '(integer->char 65) => #\\A', 'char'],
  ['digit-value',       1, 'Digit character to numeric value 0-9, or #f. R7RS §6.6.',   '(digit-value #\\5) => 5',    'char'],
  // §6.2 numeric tower
  ['exact',             1, 'Convert an inexact number to exact (integer or rational). R7RS §6.2.', '(exact 3.5) => 7/2',      'math'],
  ['inexact',           1, 'Convert to inexact (float). R7RS §6.2.',                    '(inexact 3) => 3',        'math'],
  ['exact->inexact',    1, 'Alias for inexact. R7RS §6.2.',                             '(exact->inexact 3) => 3', 'math'],
  ['inexact->exact',    1, 'Alias for exact. R7RS §6.2.',                               '(inexact->exact 3.5) => 7/2', 'math'],
  ['exact?',            1, '#t if x is an integer-valued number. R7RS §6.2.',           '(exact? 3) => #t',        'predicate'],
  ['inexact?',          1, '#t if x is a non-integer-valued number. R7RS §6.2.',        '(inexact? 3.5) => #t',    'predicate'],
  ['integer?',          1, '#t if x is an integer. R7RS §6.2.',                         '(integer? 3) => #t',      'predicate'],
  ['rational?',         1, '#t if x is a finite real. R7RS §6.2.',                      '(rational? 3.5) => #t',   'predicate'],
  ['real?',             1, '#t if x is a real number. R7RS §6.2.',                      '(real? 3.5) => #t',       'predicate'],
  ['complex?',          1, '#t if x is a complex number (JS: same as real). R7RS §6.2.', '(complex? 3) => #t',      'predicate'],
  ['exact-integer?',    1, '#t if x is an exact integer. R7RS §6.2.',                   '(exact-integer? 3) => #t', 'predicate'],
  ['finite?',           1, '#t if x is a finite number. R7RS §6.2.',                    '(finite? 3.5) => #t',     'predicate'],
  ['infinite?',         1, '#t if x is +inf or -inf. R7RS §6.2.',                       '(infinite? (/ 1 0)) => #t', 'predicate'],
  ['nan?',              1, '#t if x is NaN. R7RS §6.2.',                                '(nan? (/ 0 0)) => #t',    'predicate'],
  ['gcd',               [0, Infinity], 'Greatest common divisor. R7RS §6.2.6.',         '(gcd 12 18) => 6',        'math'],
  ['lcm',               [0, Infinity], 'Least common multiple. R7RS §6.2.6.',           '(lcm 4 6) => 12',         'math'],
  ['numerator',         1, 'The numerator of a rational. JS: x for integers. R7RS §6.2.6.', '(numerator 3) => 3',      'math'],
  ['denominator',       1, 'The denominator of a rational. JS: always 1. R7RS §6.2.6.', '(denominator 3) => 1',    'math'],
  ['truncate',          1, 'Truncate to integer (toward zero). R7RS §6.2.6.',           '(truncate 3.7) => 3',     'math'],
  ['atan',              [1, 2], '(atan y) → arctan; (atan y x) → atan2. R7RS §6.2.6.',  '(atan 1 1) => 0.785…',    'math'],
  ['square',            1, 'x squared. R7RS §6.2.6.',                                   '(square 5) => 25',        'math'],
  // §6.10 I/O
  ['write',             1, 'Print a machine-readable representation. Strings quoted. R7RS §6.10.3.', '(write "hi") ; prints "hi"', 'io'],
  ['write-string',      1, 'Print a string with no quoting. R7RS §6.10.3.',            '(write-string "hi")',        'io'],
  ['write-char',        [1, 2], 'Print a single character. R7RS §6.10.3.',             '(write-char #\\!)',          'io'],
  ['read-line',         1, '(read-line port) — read a line from a port. R7RS §6.10.2.', '(read-line (open-input-string "hi\\n")) => "hi"', 'io'],
  ['read-char',         1, '(read-char port) — read one character or EOF. R7RS §6.10.2.', '(read-char (open-input-string "a")) => #\\a',     'io'],
  ['peek-char',         1, '(peek-char port) — look at next char without consuming. R7RS §6.10.2.', '(peek-char (open-input-string "a")) => #\\a',     'io'],
  ['eof-object',        0, 'Return the EOF object. R7RS §6.10.',                       '(eof-object)',              'io'],
  ['eof-object?',       1, '#t if arg is the EOF object. R7RS §6.10.',                 '(eof-object? (eof-object)) => #t', 'io'],
  ['open-input-string', 1, 'Open a read-port over a string. R7RS §6.10.2.',            '(open-input-string "hi")',    'io'],
  ['open-output-string', 0, 'Open a write-port. R7RS §6.10.2.',                         '(open-output-string)',       'io'],
  ['get-output-string', 1, 'Extract accumulated string from a write-port. R7RS §6.10.2.', '(let ((p (open-output-string))) (display "hi" p) (get-output-string p)) => "hi"', 'io'],
  ['close-port',        1, 'Close any port. R7RS §6.10.',                              '(close-port (open-output-string))', 'io'],
  ['close-input-port',  1, 'Close a read-port. R7RS §6.10.',                           '(close-input-port (open-input-string "x"))', 'io'],
  ['close-output-port', 1, 'Close a write-port. R7RS §6.10.',                          '(close-output-port (open-output-string))', 'io'],
  ['input-port?',       1, '#t if arg is a read-port. R7RS §6.10.',                    '(input-port? (open-input-string "x")) => #t', 'predicate'],
  ['output-port?',      1, '#t if arg is a write-port. R7RS §6.10.',                   '(output-port? (open-output-string)) => #t', 'predicate'],
  ['port?',             1, '#t if arg is any port. R7RS §6.10.',                       '(port? (open-input-string "x")) => #t', 'predicate'],
  ['with-output-to-string', 1, '(with-output-to-string thunk) — capture stdout as a string. SRFI-6/R7RS §6.10.3.', '(with-output-to-string (lambda () (display "hi"))) => "hi"', 'io'],
  ['with-input-from-string', 2, '(with-input-from-string s thunk) — pass a string-input-port to thunk. R7RS §6.10.2.', '(with-input-from-string "hi" (lambda (p) (read-line p))) => "hi"', 'io'],
  // §6.9 bytevectors
  ['make-bytevector',   [1, 2], '(make-bytevector k [fill]) — new bytevector. R7RS §6.9.', '(make-bytevector 3 0) => #u8(0 0 0)', 'bytevector'],
  ['bytevector',        [0, Infinity], 'Build a bytevector from byte arguments. R7RS §6.9.', '(bytevector 1 2 3) => #u8(1 2 3)', 'bytevector'],
  ['bytevector?',       1, '#t if arg is a bytevector. R7RS §6.9.',                     '(bytevector? #u8(1 2)) => #t', 'predicate'],
  ['bytevector-length', 1, 'Number of bytes. R7RS §6.9.',                               '(bytevector-length #u8(1 2 3)) => 3', 'bytevector'],
  ['bytevector-u8-ref', 2, '(bytevector-u8-ref bv i) — the i-th byte. R7RS §6.9.',      '(bytevector-u8-ref #u8(10 20 30) 1) => 20', 'bytevector'],
  ['bytevector-u8-set!', 3, '(bytevector-u8-set! bv i byte) — mutate. R7RS §6.9.',      '(let ((bv (make-bytevector 3 0))) (bytevector-u8-set! bv 0 42) (bytevector-u8-ref bv 0)) => 42', 'bytevector'],
  ['bytevector-copy',   [1, 3], '(bytevector-copy bv [start [end]]) — copy a range. R7RS §6.9.', '(bytevector-copy #u8(1 2 3 4) 1 3) => #u8(2 3)', 'bytevector'],
  ['bytevector-append', [0, Infinity], 'Concatenate bytevectors. R7RS §6.9.',           '(bytevector-append #u8(1) #u8(2 3)) => #u8(1 2 3)', 'bytevector'],
  ['utf8->string',      [1, 3], '(utf8->string bv [start [end]]) — decode UTF-8. R7RS §6.9.', '(utf8->string #u8(72 105)) => "Hi"', 'bytevector'],
  ['string->utf8',      [1, 3], '(string->utf8 s [start [end]]) — encode UTF-8. R7RS §6.9.', '(string->utf8 "Hi") => #u8(72 105)', 'bytevector'],
  // §6.8 vectors
  ['vector',            [0, Infinity], 'Build a vector from element arguments. R7RS §6.8.', '(vector 1 2 3) => #(1 2 3)', 'vector'],
  ['make-vector',       [1, 2], '(make-vector k [fill]) — new vector of length k. R7RS §6.8.', '(make-vector 3 0) => #(0 0 0)', 'vector'],
  ['vector?',           1, '#t if arg is a vector. R7RS §6.8.',                         '(vector? #(1 2)) => #t',        'predicate'],
  ['vector-length',     1, 'Number of elements. R7RS §6.8.',                           '(vector-length #(1 2 3)) => 3', 'vector'],
  ['vector-set!',       3, '(vector-set! v i x) — mutate slot i. R7RS §6.8.',          '(let ((v (vector 1 2 3))) (vector-set! v 0 42) v) => #(42 2 3)',          'vector'],
  ['vector->list',      1, 'Convert vector to list. R7RS §6.8.',                        '(vector->list #(1 2 3)) => (1 2 3)', 'vector'],
  ['list->vector',      1, 'Convert list to vector. R7RS §6.8.',                        '(list->vector (list 1 2 3)) => #(1 2 3)', 'vector'],
  ['vector-map',        2, '(vector-map f v) — map f over the vector. R7RS §6.8.',      '(vector-map square #(1 2 3)) => #(1 4 9)', 'vector'],
  ['vector-for-each',   2, '(vector-for-each f v) — call f for side-effects. R7RS §6.8.', '(vector-for-each display #(1 2))', 'vector'],
  ['vector-fill!',      2, '(vector-fill! v x) — set every slot to x. R7RS §6.8.',      '(let ((v (vector 1 2 3))) (vector-fill! v 0) v) => #(0 0 0)',            'vector'],
  ['vector-copy',       [1, 3], '(vector-copy v [start [end]]) — copy range. R7RS §6.8.', '(vector-copy #(1 2 3 4) 1 3) => #(2 3)', 'vector'],
  // §6.11 exceptions
  ['error',             [1, Infinity], '(error msg . irritants) — raise a Scheme error. R7RS §6.11.', '(guard (e (#t (error-object-message e))) (error "not found" "k")) => "not found"', 'exception'],
  ['raise',             1, '(raise obj) — raise obj as a condition. R7RS §6.11.',        '(guard (e (#t e)) (raise "boom")) => "boom"', 'exception'],
  ['raise-continuable', 1, '(raise-continuable obj) — same as raise (no continuations). R7RS §6.11.', '(guard (e (#t e)) (raise-continuable "boom")) => "boom"', 'exception'],
  ['error-object?',     1, '#t if arg is an error object. R7RS §6.11.',                  '(guard (e ((error-object? e) #t)) (error "x")) => #t', 'predicate'],
  ['error-object-message', 1, 'Extract the message string. R7RS §6.11.',                 '(guard (e (#t (error-object-message e))) (error "boom" 1 2)) => "boom"', 'exception'],
  ['error-object-irritants', 1, 'Extract the irritant list. R7RS §6.11.',                '(guard (e (#t (error-object-irritants e))) (error "boom" 1 2)) => (1 2)', 'exception'],
  // §4.2.5 delay/force
  ['force',             1, 'Force a promise (evaluate the delayed thunk once, memoize). R7RS §4.2.5.', '(force (delay (+ 1 2))) => 3', 'lazy'],
  ['make-promise',      1, '(make-promise v) — a pre-forced promise. R7RS §4.2.5.',      '(force (make-promise 42)) => 42', 'lazy'],
  ['promise?',          1, '#t if arg is a promise. R7RS §4.2.5.',                       '(promise? (delay 3)) => #t',  'predicate'],
  // convenience
  ['identity',          1, '(identity x) → x. Useful as a default fold seed. SRFI-1.',   '(identity 42) => 42',        'higher-order'],
  ['const',             1, '(const x) → a function returning x for any args. Motoi-own.', '((const 7) 1 2 3) => 7',      'higher-order'],
  ['compose',           [0, Infinity], '(compose f g h …) → right-to-left composition. Motoi-own.', '((compose square +) 1 2) => 9', 'higher-order'],
  // §6.3/§6.5 equality
  ['boolean=?',         2, 'Boolean equality (both #t or both #f). R7RS §6.3.',           '(boolean=? #t #t) => #t',    'compare'],
  ['symbol=?',          2, 'Symbol equality by name. R7RS §6.5.',                          "(symbol=? 'foo 'foo) => #t", 'compare'],
]

export default installR7RSCore
