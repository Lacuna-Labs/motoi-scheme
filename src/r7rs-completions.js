// r7rs-completions.js — the FILL PASS for the language-finalization
// audit (2026-07-18). Adds R7RS-small standard forms/procedures + the
// most-used SRFI-1 (list library), SRFI-13 (string library), SRFI-125
// (hash tables), R7RS §6.6 (chars), §6.8 (bytevectors), §6.10 (ports),
// §6.11 (exceptions) that neither Motoi nor Sakura had previously.
//
// Every add here traces to a named R7RS section or SRFI number in the
// per-verb comment. No fabrication. Every add gets a reference paragraph
// in scheme/MOTOI-SCHEME-REFERENCE.slat and a test in tests/.
//
// Doctrine — MODULE VS CORE:
//   Every verb installed here lands in CORE (loaded by every Motoi
//   runtime). R7RS-small is the baseline every conforming Scheme ships,
//   and the SRFI-1/13 helpers here are the ones a working Scheme
//   AUTHOR reaches for daily (fold, iota, filter-map, string-split,
//   string-join). Specialty SRFI verbs (unfold, string-fold, etc.) are
//   left for future MODULE surfaces.
//
// This module installs INTO an existing env. Callers pass in the env
// built by makeBaseEnv and the fuel box. See src/base.js for the wiring.

import { apply, Closure } from './interp.js'
import { Sym } from './reader.js'
import { registerVerbMeta } from './verbRegistry.js'

// ──────────────────────────────────────────────────────────────────────
// Record types — R7RS §5.5. We use a lightweight tag + slot map. A
// record value is a plain JS object with a hidden `__record_type__` tag
// so type predicates can distinguish. Constructors are curried at
// define time; accessors close over the slot name.
// ──────────────────────────────────────────────────────────────────────

const RECORD_TAG = Symbol('motoi:record-type')

export function makeRecordType(typeName, fieldNames) {
  const type = { name: typeName, fields: fieldNames, [RECORD_TAG]: true }
  return type
}

export function isRecord(value, type) {
  return value != null && typeof value === 'object'
    && value.__record_type__ === type
}

export function makeRecord(type, fieldValues) {
  const rec = { __record_type__: type }
  for (let i = 0; i < type.fields.length; i++) {
    rec[type.fields[i]] = fieldValues[i]
  }
  return rec
}

// ──────────────────────────────────────────────────────────────────────
// Hash tables — SRFI-125 / R7RS-large "Hash Tables" (rnrs-hashtable line).
// Sakura substrate had `hash-ref` as a corpus-attested need (Priya's
// audit). This landing gives both dialects a full R7RS-large-track
// hash-table surface.
//
// We chose SRFI-125 over SRFI-69 (the older spec) because:
//   * SRFI-125 is the R7RS-large-track selection
//   * It uses standardized equality-predicate + hash-fn constructor
//   * `hash-table-ref`/`hash-table-set!` is R7RS-large canonical
// Backward compat: `hash-ref` in Priya's audit maps to `hash-table-ref`.
// ──────────────────────────────────────────────────────────────────────

class HashTable {
  constructor() { this.map = new Map() }
  _key(k) {
    if (k instanceof Sym) return 'sym:' + k.name
    if (typeof k === 'string') return 'str:' + k
    if (typeof k === 'number') return 'num:' + String(k)
    if (typeof k === 'boolean') return 'bool:' + String(k)
    if (Array.isArray(k)) return 'list:' + JSON.stringify(k)
    return 'obj:' + String(k)
  }
  set(k, v) { this.map.set(this._key(k), [k, v]) }
  get(k, dflt) {
    const p = this.map.get(this._key(k))
    return p ? p[1] : dflt
  }
  has(k) { return this.map.has(this._key(k)) }
  delete(k) { return this.map.delete(this._key(k)) }
  keys() { return [...this.map.values()].map((p) => p[0]) }
  values() { return [...this.map.values()].map((p) => p[1]) }
  entries() { return [...this.map.values()].map((p) => [p[0], p[1]]) }
  get size() { return this.map.size }
}

export function isHashTable(v) { return v instanceof HashTable }

// ──────────────────────────────────────────────────────────────────────
// String ports — R7RS §6.10.1 (input-port?) + §6.10.2 (open-input-string /
// open-output-string / get-output-string).
// ──────────────────────────────────────────────────────────────────────

class StringInputPort {
  constructor(str) { this.str = str; this.pos = 0; this.closed = false; this._kind = 'input' }
  read() {
    if (this.closed || this.pos >= this.str.length) return EOF
    return this.str.charAt(this.pos++)
  }
  peek() {
    if (this.closed || this.pos >= this.str.length) return EOF
    return this.str.charAt(this.pos)
  }
  readAll() {
    if (this.closed) return EOF
    const rest = this.str.slice(this.pos)
    this.pos = this.str.length
    return rest === '' ? EOF : rest
  }
  close() { this.closed = true }
}

class StringOutputPort {
  constructor() { this.parts = []; this.closed = false; this._kind = 'output' }
  write(s) {
    if (this.closed) throw new Error('write on closed port')
    this.parts.push(String(s))
  }
  getOutput() { return this.parts.join('') }
  close() { this.closed = true }
}

export const EOF = { __eof__: true }

// ──────────────────────────────────────────────────────────────────────
// Bytevectors — R7RS §6.9. Backed by Uint8Array so bytes really are
// bytes.
// ──────────────────────────────────────────────────────────────────────

export function isBytevector(v) { return v instanceof Uint8Array }

// ──────────────────────────────────────────────────────────────────────
// Error objects — R7RS §6.11. `error` raises; `guard` in interp.js
// catches; `error-object?` etc. inspect.
// ──────────────────────────────────────────────────────────────────────

export class SchemeError extends Error {
  constructor(message, irritants) {
    super(String(message))
    this.name = 'SchemeError'
    this.message_ = String(message)
    this.irritants = irritants || []
    this.isSchemeError = true
  }
}

// ──────────────────────────────────────────────────────────────────────
// installR7RSCompletions(env, fuelBox) — the entry point. Called from
// makeBaseEnv AFTER the base primitives are wired.
// ──────────────────────────────────────────────────────────────────────

export function installR7RSCompletions(env, fuelBox) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  // ── SRFI-1 list library (the working-Scheme baseline) ────────────
  //
  // We already had: map, filter, reduce, any, every, count, take,
  // drop, first, last, nth, list-index, sort, argmin. Add the rest.

  // (iota count [start [step]]) — SRFI-1. Numeric range with start+step.
  def('iota', (count, start = 0, step = 1) => {
    const n = Math.max(0, count | 0)
    const out = new Array(n)
    for (let i = 0; i < n; i++) out[i] = start + i * step
    return out
  })

  // (fold f init lst) — SRFI-1 left fold. Same as reduce but the arg
  // order (f init lst) matches SRFI convention where reduce is
  // (reduce f init lst) here.
  def('fold', (fn, init, lst) => {
    if (!Array.isArray(lst)) return init
    let acc = init
    for (const x of lst) acc = apply(fn, [x, acc], fuelBox)
    return acc
  })

  // (fold-right f init lst) — SRFI-1 right fold.
  def('fold-right', (fn, init, lst) => {
    if (!Array.isArray(lst)) return init
    let acc = init
    for (let i = lst.length - 1; i >= 0; i--) acc = apply(fn, [lst[i], acc], fuelBox)
    return acc
  })

  // (concatenate lst-of-lsts) — SRFI-1. Flatten one level.
  def('concatenate', (lst) => {
    if (!Array.isArray(lst)) return []
    return [].concat(...lst.map((x) => Array.isArray(x) ? x : [x]))
  })

  // (append-map f lst) — SRFI-1. Map then concatenate.
  def('append-map', (fn, lst) => {
    if (!Array.isArray(lst)) return []
    return [].concat(...lst.map((x) => {
      const r = apply(fn, [x], fuelBox)
      return Array.isArray(r) ? r : [r]
    }))
  })

  // (filter-map f lst) — SRFI-1. Map, then drop #f results.
  def('filter-map', (fn, lst) => {
    if (!Array.isArray(lst)) return []
    const out = []
    for (const x of lst) {
      const r = apply(fn, [x], fuelBox)
      if (r !== false) out.push(r)
    }
    return out
  })

  // (partition pred lst) — SRFI-1. Two-list split. Returns (in out).
  def('partition', (pred, lst) => {
    if (!Array.isArray(lst)) return [[], []]
    const yes = [], no = []
    for (const x of lst) {
      if (apply(pred, [x], fuelBox) !== false) yes.push(x)
      else no.push(x)
    }
    return [yes, no]
  })

  // (find pred lst) — SRFI-1. First element satisfying pred, or #f.
  def('find', (pred, lst) => {
    if (!Array.isArray(lst)) return false
    for (const x of lst) if (apply(pred, [x], fuelBox) !== false) return x
    return false
  })

  // (delete-duplicates lst) — SRFI-1. Keep first occurrence.
  def('delete-duplicates', (lst) => {
    if (!Array.isArray(lst)) return lst
    const seen = new Set()
    const out = []
    for (const x of lst) {
      const k = (x instanceof Sym) ? 'sym:' + x.name
        : typeof x === 'string' ? 'str:' + x
        : typeof x === 'number' ? 'num:' + x
        : JSON.stringify(x)
      if (!seen.has(k)) { seen.add(k); out.push(x) }
    }
    return out
  })

  // (unzip lst-of-pairs) — SRFI-1. Inverse of zip.
  def('unzip', (lst) => {
    if (!Array.isArray(lst) || lst.length === 0) return [[], []]
    const a = [], b = []
    for (const p of lst) {
      if (Array.isArray(p)) { a.push(p[0]); b.push(p[1]) }
    }
    return [a, b]
  })

  // (second lst) .. (tenth lst) — SRFI-1 positional accessors.
  def('second', (a) => a[1])
  def('third', (a) => a[2])
  def('fourth', (a) => a[3])
  def('fifth', (a) => a[4])
  def('sixth', (a) => a[5])
  def('seventh', (a) => a[6])
  def('eighth', (a) => a[7])
  def('ninth', (a) => a[8])
  def('tenth', (a) => a[9])

  // (list? x) — R7RS §6.4. #t if x is a proper list (finite chain).
  def('list?', (a) => Array.isArray(a))

  // (list-tail lst k) — R7RS §6.4. Drop first k.
  def('list-tail', (lst, k) => Array.isArray(lst) ? lst.slice(k | 0) : [])

  // (list-copy lst) — R7RS §6.4.
  def('list-copy', (lst) => Array.isArray(lst) ? lst.slice() : lst)

  // ── SRFI-13 string library (the working-Scheme string baseline) ──

  // (string-contains hay needle) — R7RS-ish / SRFI-13. Return index or #f.
  def('string-contains', (hay, needle) => {
    const i = String(hay).indexOf(String(needle))
    return i < 0 ? false : i
  })

  // (string-index s pred-or-char) — SRFI-13. First index where pred/char matches.
  def('string-index', (s, predOrChar) => {
    const str = String(s)
    if (typeof predOrChar === 'string') {
      const i = str.indexOf(predOrChar)
      return i < 0 ? false : i
    }
    if (typeof predOrChar === 'function' || predOrChar instanceof Closure) {
      for (let i = 0; i < str.length; i++) {
        if (apply(predOrChar, [str.charAt(i)], fuelBox) !== false) return i
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

  // (string-upcase s) — R7RS §6.7.
  def('string-upcase', (s) => String(s).toUpperCase())

  // (string-downcase s) — R7RS §6.7.
  def('string-downcase', (s) => String(s).toLowerCase())

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

  // (string-replace s from to) — non-R7RS but SRFI-13-adjacent + very common.
  def('string-replace', (s, from, to) => {
    return String(s).split(String(from)).join(String(to))
  })

  // (string-reverse s) — SRFI-13.
  def('string-reverse', (s) => String(s).split('').reverse().join(''))

  // (string-count s pred-or-char) — SRFI-13.
  def('string-count', (s, predOrChar) => {
    const str = String(s)
    let n = 0
    if (typeof predOrChar === 'string') {
      for (let i = 0; i < str.length; i++) if (str.charAt(i) === predOrChar) n++
      return n
    }
    if (typeof predOrChar === 'function' || predOrChar instanceof Closure) {
      for (let i = 0; i < str.length; i++) {
        if (apply(predOrChar, [str.charAt(i)], fuelBox) !== false) n++
      }
    }
    return n
  })

  // (string->list s) / (list->string lst) — R7RS §6.7.
  def('string->list', (s) => String(s).split(''))
  def('list->string', (lst) => Array.isArray(lst) ? lst.map(String).join('') : String(lst))

  // (string s ...) — R7RS §6.7. Build a string from char arguments.
  def('string', (...chars) => chars.map(String).join(''))

  // (make-string k [char]) — R7RS §6.7.
  def('make-string', (k, char = ' ') => String(char).repeat(Math.max(0, k | 0)))

  // (string-copy s [start [end]]) — R7RS §6.7.
  def('string-copy', (s, start = 0, end) => {
    const str = String(s)
    if (end === undefined) return str.slice(start | 0)
    return str.slice(start | 0, end | 0)
  })

  // (string<? a b) / string>? / string<=? / string>=? — R7RS §6.7.
  def('string<?', (a, b) => String(a) < String(b))
  def('string>?', (a, b) => String(a) > String(b))
  def('string<=?', (a, b) => String(a) <= String(b))
  def('string>=?', (a, b) => String(a) >= String(b))
  def('string-ci=?', (a, b) => String(a).toLowerCase() === String(b).toLowerCase())
  def('string-ci<?', (a, b) => String(a).toLowerCase() < String(b).toLowerCase())

  // (symbol->string sym) / (string->symbol s) — R7RS §6.5.
  def('symbol->string', (s) => (s instanceof Sym) ? s.name : String(s))
  def('string->symbol', (s) => new Sym(String(s)))

  // ── Character predicates + conversions (R7RS §6.6) ───────────────

  def('char-alphabetic?', (c) => /^[A-Za-z]$/.test(String(c)))
  def('char-numeric?', (c) => /^[0-9]$/.test(String(c)))
  def('char-whitespace?', (c) => /^\s$/.test(String(c)))
  def('char-upper-case?', (c) => /^[A-Z]$/.test(String(c)))
  def('char-lower-case?', (c) => /^[a-z]$/.test(String(c)))
  def('char-upcase', (c) => String(c).toUpperCase())
  def('char-downcase', (c) => String(c).toLowerCase())
  def('char-foldcase', (c) => String(c).toLowerCase())
  def('char->integer', (c) => String(c).charCodeAt(0))
  def('integer->char', (n) => String.fromCharCode(n | 0))
  def('digit-value', (c) => {
    const s = String(c)
    if (/^[0-9]$/.test(s)) return s.charCodeAt(0) - 48
    return false
  })
  def('char?', (c) => typeof c === 'string' && c.length === 1)
  def('char=?', (a, b) => String(a) === String(b))
  def('char<?', (a, b) => String(a) < String(b))
  def('char>?', (a, b) => String(a) > String(b))
  def('char<=?', (a, b) => String(a) <= String(b))
  def('char>=?', (a, b) => String(a) >= String(b))

  // ── Numeric tower completions (R7RS §6.2) ────────────────────────

  def('exact', (x) => {
    // R7RS: convert inexact to exact if possible. JS numbers are all
    // double; exact-integer semantics apply to integer-valued doubles.
    return Math.trunc(x)
  })
  def('inexact', (x) => Number(x))
  def('exact->inexact', (x) => Number(x))
  def('inexact->exact', (x) => Math.trunc(x))
  def('exact?', (x) => typeof x === 'number' && Number.isInteger(x))
  def('inexact?', (x) => typeof x === 'number' && !Number.isInteger(x))
  def('integer?', (x) => typeof x === 'number' && Number.isInteger(x))
  def('rational?', (x) => typeof x === 'number' && Number.isFinite(x))
  def('real?', (x) => typeof x === 'number')
  def('complex?', (x) => typeof x === 'number')
  def('exact-integer?', (x) => typeof x === 'number' && Number.isInteger(x))
  def('finite?', (x) => typeof x === 'number' && Number.isFinite(x))
  def('infinite?', (x) => typeof x === 'number' && !Number.isFinite(x) && !Number.isNaN(x))
  def('nan?', (x) => typeof x === 'number' && Number.isNaN(x))

  // (gcd a b ...) / (lcm a b ...) — R7RS §6.2.6.
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

  // (numerator x) / (denominator x) — R7RS §6.2.6. For JS doubles the
  // numerator is x, denominator is 1 (we don't carry fraction form).
  def('numerator', (x) => Number.isInteger(x) ? x : Math.trunc(x))
  def('denominator', (x) => Number.isInteger(x) ? 1 : 1)

  // (truncate x) — R7RS §6.2.6.
  def('truncate', (x) => Math.trunc(x))

  // (atan y [x]) — R7RS §6.2.6. Two-arg = atan2.
  def('atan', (y, x) => (x === undefined ? Math.atan(y) : Math.atan2(y, x)))

  // (square x) — R7RS §6.2.6.
  def('square', (x) => x * x)

  // ── I/O completions (R7RS §6.10) ─────────────────────────────────

  // (write v) — R7RS §6.10.3. Machine-readable representation. Strings
  // get quoted (unlike display).
  def('write', (v) => { process.stdout.write(_writeFormat(v)); return undefined })

  // (write-string s) — R7RS §6.10.3.
  def('write-string', (s) => { process.stdout.write(String(s)); return undefined })

  // (read-line [port]) — R7RS §6.10.2. From a string-input-port for now.
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

  // (read-char port) — R7RS §6.10.2.
  def('read-char', (port) => {
    if (!port || port._kind !== 'input') return EOF
    return port.read()
  })

  // (peek-char port) — R7RS §6.10.2.
  def('peek-char', (port) => {
    if (!port || port._kind !== 'input') return EOF
    return port.peek()
  })

  // (write-char c [port]) — R7RS §6.10.3.
  def('write-char', (c, port) => {
    if (port && port._kind === 'output') { port.write(String(c)); return undefined }
    process.stdout.write(String(c))
    return undefined
  })

  // (eof-object) / (eof-object? v) — R7RS §6.10.
  def('eof-object', () => EOF)
  def('eof-object?', (v) => v === EOF || (v != null && typeof v === 'object' && v.__eof__ === true))

  // (open-input-string s) / (open-output-string) / (get-output-string p)
  // — R7RS §6.10.2.
  def('open-input-string', (s) => new StringInputPort(String(s)))
  def('open-output-string', () => new StringOutputPort())
  def('get-output-string', (p) => (p instanceof StringOutputPort) ? p.getOutput() : '')
  def('close-port', (p) => { if (p && p.close) p.close(); return undefined })
  def('close-input-port', (p) => { if (p && p.close) p.close(); return undefined })
  def('close-output-port', (p) => { if (p && p.close) p.close(); return undefined })
  def('input-port?', (p) => p != null && p._kind === 'input')
  def('output-port?', (p) => p != null && p._kind === 'output')
  def('port?', (p) => p != null && (p._kind === 'input' || p._kind === 'output'))

  // (with-output-to-string thunk) — R7RS §6.10.3 / SRFI-6.
  def('with-output-to-string', (thunk) => {
    // We route via a StringOutputPort. Since our `display`/`newline` write
    // to stdout (not to a current-output-port parameter), we implement
    // this by capturing stdout writes. Simpler: allocate a port, call the
    // thunk with an env parameter, join the parts.
    const port = new StringOutputPort()
    // Save and shadow process.stdout.write. Restore in a finally.
    const origWrite = process.stdout.write.bind(process.stdout)
    process.stdout.write = (chunk) => { port.write(chunk); return true }
    try { apply(thunk, [], fuelBox) } finally { process.stdout.write = origWrite }
    return port.getOutput()
  })

  // (with-input-from-string s thunk) — R7RS §6.10.2. Minimal: exposes the
  // string as current-input; the interpreter has no `current-input-port`
  // parameter, so we hand the port to the thunk directly (via env
  // parameter is the R7RS route; we approximate as (thunk port)).
  def('with-input-from-string', (s, thunk) => {
    const port = new StringInputPort(String(s))
    return apply(thunk, [port], fuelBox)
  })

  // ── Bytevectors — R7RS §6.9 ──────────────────────────────────────

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

  // ── Hash tables — SRFI-125 / R7RS-large ──────────────────────────

  def('make-hash-table', () => new HashTable())
  def('hash-table?', (v) => v instanceof HashTable)
  def('hash-table-set!', (h, k, v) => { if (h instanceof HashTable) h.set(k, v); return undefined }, 'state-change')
  def('hash-table-ref', (h, k, dflt = false) => {
    if (!(h instanceof HashTable)) return dflt
    if (h.has(k)) return h.get(k)
    return dflt
  })
  def('hash-table-ref/default', (h, k, dflt) => {
    if (!(h instanceof HashTable)) return dflt
    return h.has(k) ? h.get(k) : dflt
  })
  // Sakura-substrate compatibility (Priya audit: `hash-ref` was corpus-attested).
  def('hash-ref', (h, k, dflt = false) => {
    if (!(h instanceof HashTable)) return dflt
    return h.has(k) ? h.get(k) : dflt
  })
  def('hash-set!', (h, k, v) => { if (h instanceof HashTable) h.set(k, v); return undefined }, 'state-change')
  def('hash-table-delete!', (h, k) => { if (h instanceof HashTable) h.delete(k); return undefined }, 'state-change')
  def('hash-table-exists?', (h, k) => (h instanceof HashTable) && h.has(k))
  def('hash-table-contains?', (h, k) => (h instanceof HashTable) && h.has(k))
  def('hash-table-keys', (h) => (h instanceof HashTable) ? h.keys() : [])
  def('hash-table-values', (h) => (h instanceof HashTable) ? h.values() : [])
  def('hash-table-size', (h) => (h instanceof HashTable) ? h.size : 0)
  def('hash-table-clear!', (h) => { if (h instanceof HashTable) h.map.clear(); return undefined }, 'state-change')
  def('hash-table-update!', (h, k, updater, dflt = false) => {
    if (!(h instanceof HashTable)) return undefined
    const cur = h.has(k) ? h.get(k) : dflt
    h.set(k, apply(updater, [cur], fuelBox))
    return undefined
  }, 'state-change')
  def('hash-table-fold', (h, fn, seed) => {
    if (!(h instanceof HashTable)) return seed
    let acc = seed
    for (const [k, v] of h.entries()) acc = apply(fn, [k, v, acc], fuelBox)
    return acc
  })
  def('hash-table->alist', (h) => {
    if (!(h instanceof HashTable)) return []
    return h.entries().map(([k, v]) => [k, v])
  })
  def('alist->hash-table', (alist) => {
    const h = new HashTable()
    if (Array.isArray(alist)) {
      for (const pair of alist) {
        if (Array.isArray(pair) && pair.length >= 2) h.set(pair[0], pair[1])
      }
    }
    return h
  })

  // ── Vectors — R7RS §6.8 (partial; Motoi represents vectors as
  //    JS arrays, sharing the list representation. That's a doctrine
  //    call — R7RS §6.8 says vectors are distinct from lists, but
  //    Motoi historically conflates them. We add the standard verb
  //    names as aliases into the existing list ops so R7RS code
  //    that reaches for `vector-length` finds it.)

  def('vector', (...a) => a)
  def('make-vector', (k, fill = 0) => {
    const n = Math.max(0, k | 0)
    const out = new Array(n)
    for (let i = 0; i < n; i++) out[i] = fill
    return out
  })
  def('vector?', (v) => Array.isArray(v))
  def('vector-length', (v) => Array.isArray(v) ? v.length : 0)
  def('vector-set!', (v, i, x) => { if (Array.isArray(v)) v[i | 0] = x; return undefined }, 'state-change')
  def('vector->list', (v) => Array.isArray(v) ? v.slice() : [])
  def('list->vector', (lst) => Array.isArray(lst) ? lst.slice() : [])
  def('vector-map', (fn, v) => Array.isArray(v) ? v.map((x) => apply(fn, [x], fuelBox)) : [])
  def('vector-for-each', (fn, v) => { if (Array.isArray(v)) for (const x of v) apply(fn, [x], fuelBox); return undefined })
  def('vector-fill!', (v, x) => { if (Array.isArray(v)) v.fill(x); return undefined }, 'state-change')
  def('vector-copy', (v, start = 0, end) => {
    if (!Array.isArray(v)) return []
    return end === undefined ? v.slice(start | 0) : v.slice(start | 0, end | 0)
  })

  // ── Exceptions — R7RS §6.11 ──────────────────────────────────────
  //
  // `error` raises a SchemeError. `guard` is a special form (see
  // interp.js). `raise` re-throws a value.

  def('error', (message, ...irritants) => {
    throw new SchemeError(message, irritants)
  })
  def('raise', (obj) => {
    if (obj instanceof SchemeError) throw obj
    throw new SchemeError('raised', [obj])
  })
  def('raise-continuable', (obj) => {
    // We don't implement continuation-based raise; treat as non-continuable.
    if (obj instanceof SchemeError) throw obj
    throw new SchemeError('raised', [obj])
  })
  def('error-object?', (v) => v instanceof SchemeError || (v && v.isSchemeError === true))
  def('error-object-message', (v) => (v instanceof SchemeError) ? v.message_ : (v && v.message) || '')
  def('error-object-irritants', (v) => (v instanceof SchemeError) ? v.irritants : [])
  def('error?', (v) => v instanceof SchemeError || v instanceof Error)

  // ── Records — R7RS §5.5 support helpers ──────────────────────────
  //
  // `define-record-type` is a special form in interp.js. It calls into
  // these helpers to make the type + accessors.
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

  // ── Delay / Force — R7RS §4.2.5 (lazy) ──────────────────────────
  // Simple thunk-based promises; force memoizes. Delay is best-modeled
  // as a special form (delays evaluation), but a thunk-wrapped version
  // is a reasonable fallback for the base library. We provide `force`
  // as a proc; `delay` as a macro is added via a define-syntax at repl
  // seed time (see delay-macro.slat / installed in interp).
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

  // ── Higher-order helpers (small, unambiguous) ───────────────────

  // (identity x) — SRFI-1 (used as default fold seed / debugging).
  def('identity', (x) => x)
  // (const x) — a lambda-of-any-args returning x. SRFI convenience.
  def('const', (x) => (..._args) => x)
  // (compose f g ...) — right-to-left function composition.
  //   ((compose f g h) x) === (f (g (h x)))
  def('compose', (...fns) => {
    if (fns.length === 0) return (x) => x
    return (...args) => {
      let cur = apply(fns[fns.length - 1], args, fuelBox)
      for (let i = fns.length - 2; i >= 0; i--) cur = apply(fns[i], [cur], fuelBox)
      return cur
    }
  })

  // ── Boolean helpers (R7RS §6.3) ──────────────────────────────────
  def('boolean=?', (a, b) => a === b && (a === true || a === false))

  // ── Symbol helpers (R7RS §6.5) ──────────────────────────────────
  def('symbol=?', (a, b) => (a instanceof Sym) && (b instanceof Sym) && a.name === b.name)

  // Register rich metadata for every completion added above.
  registerR7RSCompletionsMetadata()
}

// Machine-readable value format for `write`. Strings get JSON-quoted;
// lists become s-exprs; symbols write as their name. This is the R7RS
// spec — display is human-facing, write is round-trippable.
function _writeFormat(v) {
  if (v === undefined) return ''
  if (v === null) return '()'
  if (v === true) return '#t'
  if (v === false) return '#f'
  if (typeof v === 'string') return JSON.stringify(v)
  if (typeof v === 'number') return String(v)
  if (v instanceof Sym) return v.name
  if (Array.isArray(v)) return '(' + v.map(_writeFormat).join(' ') + ')'
  if (v && typeof v === 'object' && v.__eof__) return '#<eof>'
  return String(v)
}

// Rich metadata for the completions. Same shape as base.js:
// [name, arity, doc, example, namespace].
function registerR7RSCompletionsMetadata() {
  const META = [
    // SRFI-1 list library
    ['iota',              [1, 3],       '(iota count [start [step]]) — a list of count numbers starting at start with the given step. SRFI-1.', '(iota 5) => (0 1 2 3 4)', 'list'],
    ['fold',              3,            '(fold f init lst) — left fold. SRFI-1.',                              '(fold + 0 (list 1 2 3)) => 6',                'higher-order'],
    ['fold-right',        3,            '(fold-right f init lst) — right fold. SRFI-1.',                       '(fold-right cons (list) (list 1 2 3)) => (1 2 3)', 'higher-order'],
    ['concatenate',       1,            '(concatenate lst-of-lsts) — flatten one level. SRFI-1.',              '(concatenate (list (list 1 2) (list 3 4))) => (1 2 3 4)', 'list'],
    ['append-map',        2,            '(append-map f lst) — map then concatenate. SRFI-1.',                  '(append-map (lambda (x) (list x x)) (list 1 2)) => (1 1 2 2)', 'higher-order'],
    ['filter-map',        2,            '(filter-map f lst) — map, then drop #f results. SRFI-1.',             '(filter-map (lambda (x) (if (odd? x) (* x x) #f)) (list 1 2 3)) => (1 9)', 'higher-order'],
    ['partition',         2,            '(partition pred lst) — return (in out). SRFI-1.',                     '(partition odd? (list 1 2 3 4)) => ((1 3) (2 4))', 'higher-order'],
    ['find',              2,            '(find pred lst) — first element satisfying pred, or #f. SRFI-1.',     '(find odd? (list 2 4 5)) => 5',               'higher-order'],
    ['delete-duplicates', 1,            '(delete-duplicates lst) — keep first occurrence of each. SRFI-1.',    '(delete-duplicates (list 1 2 1 3 2)) => (1 2 3)', 'list'],
    ['unzip',             1,            '(unzip lst-of-pairs) — inverse of zip. SRFI-1.',                      '(unzip (list (list 1 3) (list 2 4))) => ((1 2) (3 4))', 'list'],
    ['second',            1,            'The second element of a list. SRFI-1.',                               '(second (list 10 20 30)) => 20', 'list'],
    ['third',             1,            'The third element of a list. SRFI-1.',                                '(third (list 10 20 30)) => 30', 'list'],
    ['fourth',            1,            'The fourth element of a list. SRFI-1.',                               '(fourth (list 1 2 3 4)) => 4',   'list'],
    ['fifth',             1,            'The fifth element of a list. SRFI-1.',                                '(fifth (list 1 2 3 4 5)) => 5', 'list'],
    ['sixth',             1,            'The sixth element of a list. SRFI-1.',                                '(sixth (list 1 2 3 4 5 6)) => 6', 'list'],
    ['seventh',           1,            'The seventh element of a list. SRFI-1.',                              '(seventh (list 1 2 3 4 5 6 7)) => 7', 'list'],
    ['eighth',            1,            'The eighth element of a list. SRFI-1.',                               '(eighth (list 1 2 3 4 5 6 7 8)) => 8', 'list'],
    ['ninth',             1,            'The ninth element of a list. SRFI-1.',                                '(ninth (list 1 2 3 4 5 6 7 8 9)) => 9', 'list'],
    ['tenth',             1,            'The tenth element of a list. SRFI-1.',                                '(tenth (list 1 2 3 4 5 6 7 8 9 10)) => 10', 'list'],
    ['list?',             1,            '#t if x is a proper list. R7RS §6.4.',                                '(list? (list 1 2 3)) => #t', 'predicate'],
    ['list-tail',         2,            '(list-tail lst k) — drop the first k elements. R7RS §6.4.',           '(list-tail (list 1 2 3 4) 2) => (3 4)', 'list'],
    ['list-copy',         1,            '(list-copy lst) — a shallow copy. R7RS §6.4.',                        '(list-copy (list 1 2 3)) => (1 2 3)', 'list'],

    // SRFI-13 string library
    ['string-contains',   2,            '(string-contains hay needle) → index of first match, or #f.',         '(string-contains "hello world" "world") => 6',   'string'],
    ['string-index',      2,            '(string-index s char-or-pred) → index of first match, or #f.',        '(string-index "hello" "l") => 2',                'string'],
    ['string-split',      [1, 2],       '(string-split s [sep]) → list of parts. Whitespace default sep.',     '(string-split "a,b,c" ",") => ("a" "b" "c")',    'string'],
    ['string-join',       [1, 2],       '(string-join lst [sep]) → glue lst with sep. Inverse of split.',      '(string-join (list "a" "b" "c") "-") => "a-b-c"', 'string'],
    ['string-upcase',     1,            'Uppercase a string. R7RS §6.7.',                                      '(string-upcase "hi") => "HI"',                   'string'],
    ['string-downcase',   1,            'Lowercase a string. R7RS §6.7.',                                      '(string-downcase "HI") => "hi"',                 'string'],
    ['string-titlecase',  1,            'Titlecase (first-letter-cap per word). SRFI-13.',                     '(string-titlecase "hello world") => "Hello World"', 'string'],
    ['string-take',       2,            '(string-take s n) — first n characters. SRFI-13.',                    '(string-take "hello" 3) => "hel"',               'string'],
    ['string-drop',       2,            '(string-drop s n) — drop first n characters. SRFI-13.',               '(string-drop "hello" 2) => "llo"',               'string'],
    ['string-pad',        [2, 3],       '(string-pad s len [char]) — left-pad to len.',                        '(string-pad "7" 3 "0") => "007"',                'string'],
    ['string-pad-right',  [2, 3],       '(string-pad-right s len [char]) — right-pad to len.',                 '(string-pad-right "7" 3 "0") => "700"',          'string'],
    ['string-trim',       1,            'Trim whitespace from both ends. SRFI-13.',                            '(string-trim "  hi  ") => "hi"',                 'string'],
    ['string-trim-left',  1,            'Trim leading whitespace.',                                            '(string-trim-left "  hi") => "hi"',              'string'],
    ['string-trim-right', 1,            'Trim trailing whitespace.',                                           '(string-trim-right "hi  ") => "hi"',             'string'],
    ['string-replace',    3,            '(string-replace s from to) → replace all occurrences.',               '(string-replace "hello" "l" "L") => "heLLo"',    'string'],
    ['string-reverse',    1,            'Reverse a string. SRFI-13.',                                          '(string-reverse "abc") => "cba"',                'string'],
    ['string-count',      2,            '(string-count s char-or-pred) → count of matches.',                   '(string-count "hello" "l") => 2',                'string'],
    ['string->list',      1,            'Explode a string into a list of 1-char strings. R7RS §6.7.',          '(string->list "abc") => ("a" "b" "c")',          'string'],
    ['list->string',      1,            'Concatenate a list of chars into a string. R7RS §6.7.',               '(list->string (list "a" "b" "c")) => "abc"',     'string'],
    ['string',            [0, Infinity], 'Build a string from character arguments. R7RS §6.7.',                '(string "a" "b" "c") => "abc"',                  'string'],
    ['make-string',       [1, 2],       '(make-string k [char]) — a string of k copies of char.',              '(make-string 3 "-") => "---"',                   'string'],
    ['string-copy',       [1, 3],       '(string-copy s [start [end]]) — copy substring.',                     '(string-copy "hello" 1 4) => "ell"',             'string'],
    ['string<?',          2,            'Lexicographic less-than. R7RS §6.7.',                                 '(string<? "abc" "abd") => #t',                   'string'],
    ['string>?',          2,            'Lexicographic greater-than.',                                          '(string>? "abd" "abc") => #t',                   'string'],
    ['string<=?',         2,            'Lexicographic less-than-or-equal.',                                   '(string<=? "abc" "abc") => #t',                  'string'],
    ['string>=?',         2,            'Lexicographic greater-than-or-equal.',                                '(string>=? "abc" "abc") => #t',                  'string'],
    ['string-ci=?',       2,            'Case-insensitive string equality. R7RS §6.7.',                        '(string-ci=? "Hi" "hi") => #t',                  'string'],
    ['string-ci<?',       2,            'Case-insensitive lexicographic less-than.',                           '(string-ci<? "abc" "ABD") => #t',                'string'],
    ['symbol->string',    1,            'Convert a symbol to its printable name. R7RS §6.5.',                  "(symbol->string 'foo) => \"foo\"",              'string'],
    ['string->symbol',    1,            'Intern a string as a symbol. R7RS §6.5.',                             "(string->symbol \"foo\") => foo",               'string'],

    // Characters
    ['char?',             1, '#t if arg is a single-character string. R7RS §6.6.',        '(char? "a") => #t',       'char'],
    ['char=?',            2, 'Character equality. R7RS §6.6.',                            '(char=? "a" "a") => #t',  'char'],
    ['char<?',            2, 'Character less-than. R7RS §6.6.',                           '(char<? "a" "b") => #t',  'char'],
    ['char>?',            2, 'Character greater-than.',                                   '(char>? "b" "a") => #t',  'char'],
    ['char<=?',           2, 'Character less-than-or-equal.',                             '(char<=? "a" "a") => #t', 'char'],
    ['char>=?',           2, 'Character greater-than-or-equal.',                          '(char>=? "b" "a") => #t', 'char'],
    ['char-alphabetic?',  1, '#t if arg is an ASCII letter. R7RS §6.6.',                  '(char-alphabetic? "a") => #t', 'char'],
    ['char-numeric?',     1, '#t if arg is an ASCII digit. R7RS §6.6.',                   '(char-numeric? "5") => #t', 'char'],
    ['char-whitespace?',  1, '#t if arg is whitespace. R7RS §6.6.',                       '(char-whitespace? " ") => #t', 'char'],
    ['char-upper-case?',  1, '#t if arg is uppercase.',                                   '(char-upper-case? "A") => #t', 'char'],
    ['char-lower-case?',  1, '#t if arg is lowercase.',                                   '(char-lower-case? "a") => #t', 'char'],
    ['char-upcase',       1, 'Uppercase a single character. R7RS §6.6.',                  '(char-upcase "a") => "A"', 'char'],
    ['char-downcase',     1, 'Lowercase a single character. R7RS §6.6.',                  '(char-downcase "A") => "a"', 'char'],
    ['char-foldcase',     1, 'Foldcase (Unicode-lowercase, ASCII-equivalent to downcase).', '(char-foldcase "A") => "a"', 'char'],
    ['char->integer',     1, 'Char code point. R7RS §6.6.',                               '(char->integer "A") => 65', 'char'],
    ['integer->char',     1, 'Code point → 1-char string. R7RS §6.6.',                    '(integer->char 65) => "A"', 'char'],
    ['digit-value',       1, 'Digit character to numeric value 0-9, or #f. R7RS §6.6.',   '(digit-value "5") => 5',    'char'],

    // Numeric tower
    ['exact',             1, 'Convert to exact (integer). R7RS §6.2.',                    '(exact 3.7) => 3',        'math'],
    ['inexact',           1, 'Convert to inexact (float). R7RS §6.2.',                    '(inexact 3) => 3',        'math'],
    ['exact->inexact',    1, 'Alias for inexact. R7RS §6.2.',                             '(exact->inexact 3) => 3', 'math'],
    ['inexact->exact',    1, 'Alias for exact. R7RS §6.2.',                               '(inexact->exact 3.7) => 3', 'math'],
    ['exact?',            1, '#t if x is an integer-valued number.',                      '(exact? 3) => #t',        'predicate'],
    ['inexact?',          1, '#t if x is a non-integer-valued number.',                   '(inexact? 3.5) => #t',    'predicate'],
    ['integer?',          1, '#t if x is an integer. R7RS §6.2.',                         '(integer? 3) => #t',      'predicate'],
    ['rational?',         1, '#t if x is a finite real. R7RS §6.2.',                      '(rational? 3.5) => #t',   'predicate'],
    ['real?',             1, '#t if x is a real number. R7RS §6.2.',                      '(real? 3.5) => #t',       'predicate'],
    ['complex?',          1, '#t if x is a complex number (JS: same as real). R7RS §6.2.', '(complex? 3) => #t',      'predicate'],
    ['exact-integer?',    1, '#t if x is an exact integer.',                              '(exact-integer? 3) => #t', 'predicate'],
    ['finite?',           1, '#t if x is a finite number.',                               '(finite? 3.5) => #t',     'predicate'],
    ['infinite?',         1, '#t if x is +inf or -inf.',                                  '(infinite? (/ 1 0)) => #t', 'predicate'],
    ['nan?',              1, '#t if x is NaN.',                                           '(nan? (/ 0 0)) => #t',    'predicate'],
    ['gcd',               [0, Infinity], 'Greatest common divisor. R7RS §6.2.6.',         '(gcd 12 18) => 6',        'math'],
    ['lcm',               [0, Infinity], 'Least common multiple. R7RS §6.2.6.',           '(lcm 4 6) => 12',         'math'],
    ['numerator',         1, 'The numerator of a rational. JS: x for integers.',          '(numerator 3) => 3',      'math'],
    ['denominator',       1, 'The denominator of a rational. JS: always 1.',              '(denominator 3) => 1',    'math'],
    ['truncate',          1, 'Truncate to integer (toward zero). R7RS §6.2.6.',           '(truncate 3.7) => 3',     'math'],
    ['atan',              [1, 2], '(atan y) → arctan; (atan y x) → atan2. R7RS §6.2.6.',  '(atan 1 1) => 0.785…',    'math'],
    ['square',            1, 'x squared. R7RS §6.2.6.',                                   '(square 5) => 25',        'math'],

    // I/O
    ['write',             1, 'Print a machine-readable representation. Strings quoted.', '(write "hi") ; prints "hi"', 'io'],
    ['write-string',      1, 'Print a string with no quoting. R7RS §6.10.3.',            '(write-string "hi")',        'io'],
    ['write-char',        [1, 2], 'Print a single character. R7RS §6.10.3.',             '(write-char "!")',           'io'],
    ['read-line',         1, '(read-line port) — read a line from a port.',              '(read-line (open-input-string "hi\\n")) => "hi"', 'io'],
    ['read-char',         1, '(read-char port) — read one character or EOF.',            '(read-char (open-input-string "a")) => "a"',      'io'],
    ['peek-char',         1, '(peek-char port) — look at next char without consuming.',  '(peek-char (open-input-string "a")) => "a"',      'io'],
    ['eof-object',        0, 'Return the EOF object. R7RS §6.10.',                       '(eof-object)',              'io'],
    ['eof-object?',       1, '#t if arg is the EOF object. R7RS §6.10.',                 '(eof-object? (eof-object)) => #t', 'io'],
    ['open-input-string', 1, 'Open a read-port over a string. R7RS §6.10.2.',            '(open-input-string "hi")',    'io'],
    ['open-output-string', 0, 'Open a write-port. R7RS §6.10.2.',                         '(open-output-string)',       'io'],
    ['get-output-string', 1, 'Extract accumulated string from a write-port.',             '(get-output-string p)',      'io'],
    ['close-port',        1, 'Close any port.',                                          '(close-port p)',             'io'],
    ['close-input-port',  1, 'Close a read-port.',                                       '(close-input-port p)',       'io'],
    ['close-output-port', 1, 'Close a write-port.',                                      '(close-output-port p)',      'io'],
    ['input-port?',       1, '#t if arg is a read-port.',                                '(input-port? p) => #t',      'predicate'],
    ['output-port?',      1, '#t if arg is a write-port.',                               '(output-port? p) => #t',     'predicate'],
    ['port?',             1, '#t if arg is any port.',                                   '(port? p) => #t',            'predicate'],
    ['with-output-to-string', 1, '(with-output-to-string thunk) — capture stdout as a string.', '(with-output-to-string (lambda () (display "hi"))) => "hi"', 'io'],
    ['with-input-from-string', 2, '(with-input-from-string s thunk) — pass a string-input-port to thunk.', '(with-input-from-string "hi" (lambda (p) (read-line p))) => "hi"', 'io'],

    // Bytevectors
    ['make-bytevector',   [1, 2], '(make-bytevector k [fill]) — new bytevector. R7RS §6.9.', '(make-bytevector 3 0) => #u8(0 0 0)', 'bytevector'],
    ['bytevector',        [0, Infinity], 'Build a bytevector from byte arguments. R7RS §6.9.', '(bytevector 1 2 3) => #u8(1 2 3)', 'bytevector'],
    ['bytevector?',       1, '#t if arg is a bytevector. R7RS §6.9.',                     '(bytevector? #u8(1 2)) => #t', 'predicate'],
    ['bytevector-length', 1, 'Number of bytes. R7RS §6.9.',                               '(bytevector-length #u8(1 2 3)) => 3', 'bytevector'],
    ['bytevector-u8-ref', 2, '(bytevector-u8-ref bv i) — the i-th byte.',                 '(bytevector-u8-ref #u8(10 20 30) 1) => 20', 'bytevector'],
    ['bytevector-u8-set!', 3, '(bytevector-u8-set! bv i byte) — mutate.',                 '(bytevector-u8-set! bv 0 42)', 'bytevector'],
    ['bytevector-copy',   [1, 3], '(bytevector-copy bv [start [end]]) — copy a range.',   '(bytevector-copy #u8(1 2 3 4) 1 3) => #u8(2 3)', 'bytevector'],
    ['bytevector-append', [0, Infinity], 'Concatenate bytevectors.',                       '(bytevector-append #u8(1) #u8(2 3)) => #u8(1 2 3)', 'bytevector'],
    ['utf8->string',      [1, 3], '(utf8->string bv [start [end]]) — decode UTF-8. R7RS §6.9.', '(utf8->string #u8(72 105)) => "Hi"', 'bytevector'],
    ['string->utf8',      [1, 3], '(string->utf8 s [start [end]]) — encode UTF-8. R7RS §6.9.', '(string->utf8 "Hi") => #u8(72 105)', 'bytevector'],

    // Hash tables
    ['make-hash-table',   0, 'Make a new empty hash table. SRFI-125.',                    '(make-hash-table)',          'hash'],
    ['hash-table?',       1, '#t if arg is a hash table.',                                '(hash-table? (make-hash-table)) => #t', 'predicate'],
    ['hash-table-set!',   3, '(hash-table-set! h k v) — insert or update.',               '(hash-table-set! h "k" 42)', 'hash'],
    ['hash-table-ref',    [2, 3], '(hash-table-ref h k [default]) — read with optional default.', '(hash-table-ref h "k" 0)', 'hash'],
    ['hash-table-ref/default', 3, '(hash-table-ref/default h k default) — read, default if missing.', '(hash-table-ref/default h "k" 0)', 'hash'],
    ['hash-ref',          [2, 3], '(hash-ref h k [default]) — Sakura-substrate alias for hash-table-ref.', '(hash-ref h "k" 0)', 'hash'],
    ['hash-set!',         3, '(hash-set! h k v) — alias for hash-table-set!.',            '(hash-set! h "k" 42)', 'hash'],
    ['hash-table-delete!', 2, '(hash-table-delete! h k) — remove entry.',                  '(hash-table-delete! h "k")', 'hash'],
    ['hash-table-exists?', 2, '(hash-table-exists? h k) — #t if k is bound.',              '(hash-table-exists? h "k") => #f', 'hash'],
    ['hash-table-contains?', 2, 'Alias for hash-table-exists?.',                            '(hash-table-contains? h "k") => #t', 'hash'],
    ['hash-table-keys',   1, 'List of all keys in a hash table.',                          '(hash-table-keys h) => ("a" "b")', 'hash'],
    ['hash-table-values', 1, 'List of all values in a hash table.',                        '(hash-table-values h) => (1 2)', 'hash'],
    ['hash-table-size',   1, 'Number of entries in a hash table.',                         '(hash-table-size h) => 2', 'hash'],
    ['hash-table-clear!', 1, 'Remove all entries.',                                        '(hash-table-clear! h)',    'hash'],
    ['hash-table-update!', [3, 4], '(hash-table-update! h k updater [default]) — apply updater to existing value.', '(hash-table-update! h "k" (lambda (v) (+ v 1)) 0)', 'hash'],
    ['hash-table-fold',   3, '(hash-table-fold h f seed) — left fold over entries.',      '(hash-table-fold h (lambda (k v acc) (+ acc v)) 0)', 'hash'],
    ['hash-table->alist', 1, 'Convert a hash table to an association list.',              '(hash-table->alist h) => (("a" 1) ("b" 2))', 'hash'],
    ['alist->hash-table', 1, 'Convert an association list to a hash table.',              '(alist->hash-table (list (list "a" 1)))', 'hash'],

    // Vectors
    ['vector',            [0, Infinity], 'Build a vector from element arguments. R7RS §6.8.', '(vector 1 2 3) => #(1 2 3)', 'vector'],
    ['make-vector',       [1, 2], '(make-vector k [fill]) — new vector of length k.',    '(make-vector 3 0) => #(0 0 0)', 'vector'],
    ['vector?',           1, '#t if arg is a vector.',                                   '(vector? #(1 2)) => #t',        'predicate'],
    ['vector-length',     1, 'Number of elements. R7RS §6.8.',                           '(vector-length #(1 2 3)) => 3', 'vector'],
    ['vector-set!',       3, '(vector-set! v i x) — mutate slot i.',                     '(vector-set! v 0 42)',          'vector'],
    ['vector->list',      1, 'Convert vector to list.',                                   '(vector->list #(1 2 3)) => (1 2 3)', 'vector'],
    ['list->vector',      1, 'Convert list to vector.',                                   '(list->vector (list 1 2 3)) => #(1 2 3)', 'vector'],
    ['vector-map',        2, '(vector-map f v) — map f over the vector.',                '(vector-map square #(1 2 3)) => #(1 4 9)', 'vector'],
    ['vector-for-each',   2, '(vector-for-each f v) — call f for side-effects.',         '(vector-for-each display #(1 2))', 'vector'],
    ['vector-fill!',      2, '(vector-fill! v x) — set every slot to x.',                '(vector-fill! v 0)',            'vector'],
    ['vector-copy',       [1, 3], '(vector-copy v [start [end]]) — copy range.',        '(vector-copy #(1 2 3 4) 1 3) => #(2 3)', 'vector'],

    // Exceptions
    ['error',             [1, Infinity], '(error msg . irritants) — raise a Scheme error. R7RS §6.11.', '(error "not found" key)', 'exception'],
    ['raise',             1, '(raise obj) — raise obj as a condition. R7RS §6.11.',        '(raise "boom")',              'exception'],
    ['raise-continuable', 1, '(raise-continuable obj) — same as raise (no continuations).', '(raise-continuable "boom")', 'exception'],
    ['error-object?',     1, '#t if arg is an error object. R7RS §6.11.',                  '(error-object? e) => #t',    'predicate'],
    ['error-object-message', 1, 'Extract the message string.',                              '(error-object-message e)',   'exception'],
    ['error-object-irritants', 1, 'Extract the irritant list.',                             '(error-object-irritants e)', 'exception'],
    ['error?',            1, '#t if arg is any error.',                                    '(error? e) => #t',           'predicate'],

    // Delay / force / promises
    ['force',             1, 'Force a promise (evaluate the delayed thunk once, memoize).', '(force (delay (+ 1 2))) => 3', 'lazy'],
    ['make-promise',      1, '(make-promise v) — a pre-forced promise. R7RS §4.2.5.',      '(force (make-promise 42)) => 42', 'lazy'],
    ['promise?',          1, '#t if arg is a promise.',                                    '(promise? (delay 3)) => #t',  'predicate'],

    // Higher-order helpers
    ['identity',          1, '(identity x) → x. Useful as a default fold seed.',            '(identity 42) => 42',        'higher-order'],
    ['const',             1, '(const x) → a function returning x for any args.',            '((const 7) 1 2 3) => 7',      'higher-order'],
    ['compose',           [0, Infinity], '(compose f g h …) → right-to-left composition.',  '((compose square +) 1 2) => 9', 'higher-order'],

    // Boolean/symbol equality
    ['boolean=?',         2, 'Boolean equality (both #t or both #f). R7RS §6.3.',           '(boolean=? #t #t) => #t',    'compare'],
    ['symbol=?',          2, 'Symbol equality by name. R7RS §6.5.',                          "(symbol=? 'foo 'foo) => #t", 'compare'],
  ]

  for (const [name, arity, doc, exampleCode, namespace] of META) {
    registerVerbMeta(name, {
      name,
      arity,
      doc,
      examples: exampleCode ? [{ level: 'novice', code: exampleCode }] : [],
      namespace: namespace || null,
      perm: 'read',
      tier: 'base',
      source: 'src/r7rs-completions.js',
      since: 'motoi-scheme@0.75',
    })
  }
}
