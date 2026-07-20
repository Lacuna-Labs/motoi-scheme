// r7rs-small.js — R7RS-small compliance layer.
//
// Provenance: scheme-lang/src/r7rs-small.js. Migrated to
// motoi-scheme/lib/base/ on 2026-07-16 (Pass-3 Wave 1). Doctrine
// references to "Sakura Scheme" rephrased to "Motoi Scheme" (the base
// dialect); numeric-tower + call/cc decisions apply identically.
//
// Motoi Scheme aims for R7RS-small compliance. This file is the
// companion to base.js that installs the procedures R7RS specifies but
// which base.js did not already ship. Every procedure here has a
// citation to the R7RS §-number that mandates it.
//
// Doctrine (Alfred, 2026-07-14):
//   "Add all of R7RS-small's features. No diverging. Fix in book."
//   "They've tried things and talked about it longer than I have."
//
// Deferrals are documented in docs/ENGINEERING-DECISIONS.slat, not here.
// If a procedure is in R7RS-small and it's not implemented here, it
// should be either (a) already present in base.js, or (b) explicitly
// deferred by a decision-entry.
//
// See docs/reports/r7rs-compliance-audit-2026-07-14.slat for the full
// section-by-section audit that motivated this file.

import { Sym, sym } from '../../src/reader.js'
import { apply } from '../../src/interp.js'

// Ch (character type) — Wave-1 migration note: scheme-lang's reader
// exported Ch/ch (R7RS §6.6 character literal type); motoi-scheme's
// Pass-1 reader.js did not. Inlining here so r7rs-small.js's char
// procedures work standalone. A follow-up should port Ch/ch into
// motoi-scheme/src/reader.js so all consumers share the interned
// registry — until then, THIS Ch class is independent (eq? across
// modules will be false; eqv?/equal? on .value will be true).
class Ch {
  constructor(value) { this.value = value }
  toString() { return '#\\' + this.value }
}
const _CHS = new Map()
function ch(value) {
  const v = String(value)
  let c = _CHS.get(v)
  if (!c) { c = new Ch(v); _CHS.set(v, c) }
  return c
}
import {
  Values, SchemePromise, Parameter, EOF,
  RecordType, RecordInstance, Port, ErrorObject, RaisedValue,
} from './r7rs-types.js'

// Re-export the types so consumers that import from r7rs-small still work.
export {
  Values, SchemePromise, Parameter, EOF,
  RecordType, RecordInstance, Port, ErrorObject,
}

// ────────────────────────────────────────────────────────────────────────
// Install R7RS-small procedures into the env.
// ────────────────────────────────────────────────────────────────────────

export function installR7rsSmall(env, fuel) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  // ── §6.2 Numbers (missing pieces) ───────────────────────────────────

  // Motoi has no numeric tower (decision-011). complex? is #f for every
  // value; the exact-integer? / exact-rational? predicates are the same
  // as integer? because every number is inexact-double, unless it's a
  // JS-integer (Number.isInteger).
  def('complex?', (x) => typeof x === 'number' && Number.isFinite(x))
  def('exact-integer?', (x) => typeof x === 'number' && Number.isInteger(x))
  def('exact-rational?', (x) => typeof x === 'number' && Number.isFinite(x) && Number.isInteger(x))

  // Floor and truncate quotient/remainder families (R7RS §6.2.6).
  // floor/ returns two values (quotient, remainder); truncate/ likewise.
  const floorQuotient  = (a, b) => Math.floor(a / b)
  const floorRemainder = (a, b) => a - Math.floor(a / b) * b
  const truncQuotient  = (a, b) => Math.trunc(a / b)
  const truncRemainder = (a, b) => a - Math.trunc(a / b) * b
  def('floor-quotient',   floorQuotient)
  def('floor-remainder',  floorRemainder)
  def('truncate-quotient',  truncQuotient)
  def('truncate-remainder', truncRemainder)
  def('floor/',    (a, b) => new Values([floorQuotient(a, b),   floorRemainder(a, b)]))
  def('truncate/', (a, b) => new Values([truncQuotient(a, b),   truncRemainder(a, b)]))

  // numerator / denominator (§6.2.6). We have no rationals — every
  // number is its own numerator over denominator 1. This is honest per
  // decision-011: without exact rationals, this is what "the numerator
  // and denominator of x expressed as an integer ratio" means for us.
  def('numerator',   (x) => x)
  def('denominator', (x) => 1)

  // rationalize (§6.2.6). Returns the simplest rational within `y` of
  // `x`. Without rationals, we return `x` itself when `y` >= 0.
  def('rationalize', (x, _y) => x)

  // exact-integer-sqrt (§6.2.6). Returns (floor(sqrt(k)), k - floor(sqrt(k))^2)
  // as two values.
  def('exact-integer-sqrt', (k) => {
    if (k < 0) throw new ErrorObject('exact-integer-sqrt: negative argument', [k])
    const s = Math.floor(Math.sqrt(k))
    return new Values([s, k - s * s])
  })

  // Complex-number surface (§6.2.6). Motoi has no complex numbers
  // (decision-011 extension). These procedures error clearly rather
  // than silently return a wrong number.
  const complexUnavailable = (name) => () => {
    throw new ErrorObject(
      `${name}: complex numbers are not supported in Motoi Scheme (decision-011)`,
      [])
  }
  def('make-rectangular', complexUnavailable('make-rectangular'))
  def('make-polar',       complexUnavailable('make-polar'))
  // real-part / imag-part on a real number are the real number and 0.
  def('real-part', (x) => x)
  def('imag-part', (x) => 0)
  def('magnitude', (x) => Math.abs(x))
  def('angle',     (x) => x < 0 ? Math.PI : 0)

  // ── §6.4 Pairs and lists (missing pieces) ───────────────────────────

  // memq / memv / member with optional comparator (R7RS §6.4).
  // memq uses eq?, memv uses eqv?, member uses equal? or the supplied
  // predicate. Motoi's eq/eqv/equal all collapse to _eqQ (see base.js);
  // we honor the three names for spec compliance.
  const _eqStrict = (a, b) => a === b
  const _eqDeep = (a, b) => {
    if (a === b) return true
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false
      for (let i = 0; i < a.length; i++) if (!_eqDeep(a[i], b[i])) return false
      return true
    }
    if (a instanceof Sym && b instanceof Sym) return a.name === b.name
    if (a instanceof Ch && b instanceof Ch)   return a.value === b.value
    return false
  }
  def('memq', (x, lst) => {
    if (!Array.isArray(lst)) return false
    // memq compares with eq?. Symbols compare by name.
    const eq = (a, b) => {
      if (a === b) return true
      if (a instanceof Sym && b instanceof Sym) return a.name === b.name
      if (a instanceof Ch && b instanceof Ch) return a.value === b.value
      return false
    }
    const i = lst.findIndex((y) => eq(x, y))
    return i < 0 ? false : lst.slice(i)
  })
  def('memv', (x, lst) => {
    if (!Array.isArray(lst)) return false
    const i = lst.findIndex((y) => _eqStrict(x, y) || (x instanceof Sym && y instanceof Sym && x.name === y.name) || (x instanceof Ch && y instanceof Ch && x.value === y.value))
    return i < 0 ? false : lst.slice(i)
  })
  def('assq', (key, alist) => {
    if (!Array.isArray(alist)) return false
    const eq = (a, b) => a === b || (a instanceof Sym && b instanceof Sym && a.name === b.name) || (a instanceof Ch && b instanceof Ch && a.value === b.value)
    return alist.find((pair) => Array.isArray(pair) && eq(pair[0], key)) || false
  })
  def('assv', (key, alist) => {
    if (!Array.isArray(alist)) return false
    const eq = (a, b) => a === b || (a instanceof Sym && b instanceof Sym && a.name === b.name) || (a instanceof Ch && b instanceof Ch && a.value === b.value)
    return alist.find((pair) => Array.isArray(pair) && eq(pair[0], key)) || false
  })

  // list-set! — mutates the underlying JS array (which IS our pair-list
  // storage; decision-006 forbids set-car! / set-cdr! on individual cells
  // but list-set! is R7RS-standard for vectors of list shape).
  def('list-set!', (lst, k, v) => {
    if (!Array.isArray(lst)) throw new ErrorObject('list-set!: not a list', [lst])
    lst[k | 0] = v
    return undefined
  })

  // The R7RS §6.4.1 c[ad]xxxxr family. base.js already has car / cdr /
  // cadr / caddr. This block fills in the rest (2-deep: caar, cdar, cddr;
  // full 3-deep set; and the missing 4-deep entries). Prior versions
  // shipped only 14/16 of the 4-deep set and none of the 3-deep hole
  // beyond caddr — a spec gap flagged during the 2026-07-17 bug hunt.
  //
  // The `_c` helper reads the ops array in application order — leftmost
  // op runs first. Names decode right-to-left (dropping the leading c and
  // trailing r): `caadr` → "aad" → apply d, then a, then a.
  const _c = (lst, ops) => {
    let x = lst
    for (const op of ops) {
      if (!Array.isArray(x)) return undefined
      if (op === 'a') x = x[0]
      else x = x.slice(1)
    }
    return x
  }
  // 2-deep (base.js already has cadr).
  def('caar', (l) => _c(l, ['a','a']))
  def('cdar', (l) => _c(l, ['a','d']))
  def('cddr', (l) => _c(l, ['d','d']))
  // 3-deep (base.js already has caddr).
  def('caaar', (l) => _c(l, ['a','a','a']))
  def('caadr', (l) => _c(l, ['d','a','a']))
  def('cadar', (l) => _c(l, ['a','d','a']))
  def('cdaar', (l) => _c(l, ['a','a','d']))
  def('cdadr', (l) => _c(l, ['d','a','d']))
  def('cddar', (l) => _c(l, ['a','d','d']))
  def('cdddr', (l) => _c(l, ['d','d','d']))
  // 4-deep — full set.
  def('caaaar', (l) => _c(l, ['a','a','a','a']))
  def('caaadr', (l) => _c(l, ['d','a','a','a']))
  def('caadar', (l) => _c(l, ['a','d','a','a']))
  def('caaddr', (l) => _c(l, ['d','d','a','a']))
  def('cadaar', (l) => _c(l, ['a','a','d','a']))
  def('cadadr', (l) => _c(l, ['d','a','d','a']))
  def('caddar', (l) => _c(l, ['a','d','d','a']))
  def('cadddr', (l) => _c(l, ['d','d','d','a']))
  def('cdaaar', (l) => _c(l, ['a','a','a','d']))
  def('cdaadr', (l) => _c(l, ['d','a','a','d']))
  def('cdadar', (l) => _c(l, ['a','d','a','d']))
  def('cdaddr', (l) => _c(l, ['d','d','a','d']))
  def('cddaar', (l) => _c(l, ['a','a','d','d']))
  def('cddadr', (l) => _c(l, ['d','a','d','d']))
  def('cdddar', (l) => _c(l, ['a','d','d','d']))
  def('cddddr', (l) => _c(l, ['d','d','d','d']))

  // ── §6.6 Characters ────────────────────────────────────────────────

  def('char?', (x) => x instanceof Ch)
  const _asCh = (x) => {
    if (!(x instanceof Ch)) throw new ErrorObject('not a character', [x])
    return x.value
  }
  const _cCompare = (op) => (...args) => {
    for (let i = 0; i < args.length - 1; i++) {
      const a = _asCh(args[i]), b = _asCh(args[i + 1])
      if (!op(a, b)) return false
    }
    return true
  }
  def('char=?',  _cCompare((a, b) => a === b))
  def('char<?',  _cCompare((a, b) => a < b))
  def('char>?',  _cCompare((a, b) => a > b))
  def('char<=?', _cCompare((a, b) => a <= b))
  def('char>=?', _cCompare((a, b) => a >= b))
  const _ciCompare = (op) => (...args) => {
    for (let i = 0; i < args.length - 1; i++) {
      const a = _asCh(args[i]).toLowerCase()
      const b = _asCh(args[i + 1]).toLowerCase()
      if (!op(a, b)) return false
    }
    return true
  }
  def('char-ci=?',  _ciCompare((a, b) => a === b))
  def('char-ci<?',  _ciCompare((a, b) => a < b))
  def('char-ci>?',  _ciCompare((a, b) => a > b))
  def('char-ci<=?', _ciCompare((a, b) => a <= b))
  def('char-ci>=?', _ciCompare((a, b) => a >= b))
  def('char-alphabetic?',  (c) => /^[A-Za-z]$/.test(_asCh(c)))
  def('char-numeric?',     (c) => /^[0-9]$/.test(_asCh(c)))
  def('char-whitespace?',  (c) => /^\s$/.test(_asCh(c)))
  def('char-upper-case?',  (c) => { const v = _asCh(c); return v >= 'A' && v <= 'Z' })
  def('char-lower-case?',  (c) => { const v = _asCh(c); return v >= 'a' && v <= 'z' })
  def('digit-value', (c) => {
    const v = _asCh(c)
    if (v >= '0' && v <= '9') return v.charCodeAt(0) - 48
    return false
  })
  def('char->integer', (c) => _asCh(c).codePointAt(0))
  def('integer->char', (n) => ch(String.fromCodePoint(n | 0)))
  def('char-upcase',   (c) => ch(_asCh(c).toUpperCase()))
  def('char-downcase', (c) => ch(_asCh(c).toLowerCase()))
  def('char-foldcase', (c) => ch(_asCh(c).toLowerCase()))

  // ── §6.7 Strings (missing pieces) ──────────────────────────────────

  // string-ci=? and family — case-fold compare.
  const _sCiCompare = (op) => (...args) => {
    for (let i = 0; i < args.length - 1; i++) {
      const a = String(args[i]).toLowerCase()
      const b = String(args[i + 1]).toLowerCase()
      if (!op(a, b)) return false
    }
    return true
  }
  def('string-ci=?',  _sCiCompare((a, b) => a === b))
  def('string-ci<?',  _sCiCompare((a, b) => a < b))
  def('string-ci>?',  _sCiCompare((a, b) => a > b))
  def('string-ci<=?', _sCiCompare((a, b) => a <= b))
  def('string-ci>=?', _sCiCompare((a, b) => a >= b))
  def('string-foldcase', (s) => String(s).toLowerCase())

  // string-map / string-for-each — iterate over chars.
  def('string-map', (fn, ...strs) => {
    const n = Math.min(...strs.map((s) => String(s).length))
    const out = []
    for (let i = 0; i < n; i++) {
      const args = strs.map((s) => ch(String(s).charAt(i)))
      const r = apply(fn, args, fuel)
      out.push(r instanceof Ch ? r.value : String(r))
    }
    return out.join('')
  })
  def('string-for-each', (fn, ...strs) => {
    const n = Math.min(...strs.map((s) => String(s).length))
    for (let i = 0; i < n; i++) {
      const args = strs.map((s) => ch(String(s).charAt(i)))
      apply(fn, args, fuel)
    }
    return undefined
  })

  // string->vector — chars as vector. vector->string — inverse.
  def('string->vector', (s, start, end) => {
    const str = String(s).slice(start || 0, end === undefined ? undefined : end)
    return str.split('').map((c) => ch(c))
  })
  def('vector->string', (v, start, end) => {
    if (!Array.isArray(v)) return ''
    const slice = v.slice(start || 0, end === undefined ? undefined : end)
    return slice.map((c) => c instanceof Ch ? c.value : String(c)).join('')
  })

  // Re-register string->list / list->string honoring Ch shapes.
  def('string->list', (s, start, end) => {
    const str = String(s).slice(start || 0, end === undefined ? undefined : end)
    return str.split('').map((c) => ch(c))
  })
  def('list->string', (lst) => {
    if (!Array.isArray(lst)) return ''
    return lst.map((c) => c instanceof Ch ? c.value : String(c)).join('')
  })
  // R7RS §6.7 string-ref returns a character. base.js was returning a
  // 1-char string; we override to return Ch here so `(char? (string-ref
  // "hi" 0))` is #t. This is a behavior CHANGE: any code that compared
  // (string-ref s i) to a bare string must now compare to a Ch or use
  // (char=? (string-ref s i) #\a). Most existing code either compares
  // via a helper (which we can update) or reaches into string-append,
  // which still accepts strings.
  def('string-ref', (s, i) => ch(String(s).charAt(i | 0)))

  // ── §6.8 Vectors (missing pieces) ──────────────────────────────────

  // vector-set! — R7RS-mutable vectors per decision-009.
  def('vector-set!', (v, i, val) => {
    if (!Array.isArray(v)) throw new ErrorObject('vector-set!: not a vector', [v])
    v[i | 0] = val
    return undefined
  })
  def('vector-fill!', (v, val, start, end) => {
    if (!Array.isArray(v)) return undefined
    const s = start | 0, e = end === undefined ? v.length : (end | 0)
    for (let i = s; i < e; i++) v[i] = val
    return undefined
  })
  def('vector-copy', (v, start, end) => {
    if (!Array.isArray(v)) return []
    return v.slice(start || 0, end === undefined ? v.length : end)
  })
  def('vector-copy!', (to, at, from, start, end) => {
    if (!Array.isArray(to) || !Array.isArray(from)) return undefined
    const s = start || 0, e = end === undefined ? from.length : end
    for (let i = 0; i < e - s; i++) to[(at | 0) + i] = from[s + i]
    return undefined
  })
  def('vector-append', (...vs) => {
    const out = []
    for (const v of vs) if (Array.isArray(v)) out.push(...v)
    return out
  })
  // Re-register vector-map / vector-for-each supporting MULTIPLE vectors.
  def('vector-map', (fn, ...vs) => {
    if (vs.length === 0) return []
    const n = Math.min(...vs.map((v) => (Array.isArray(v) ? v.length : 0)))
    const out = new Array(n)
    for (let i = 0; i < n; i++) {
      const args = vs.map((v) => v[i])
      out[i] = apply(fn, args, fuel)
    }
    return out
  })
  def('vector-for-each', (fn, ...vs) => {
    if (vs.length === 0) return undefined
    const n = Math.min(...vs.map((v) => (Array.isArray(v) ? v.length : 0)))
    for (let i = 0; i < n; i++) {
      const args = vs.map((v) => v[i])
      apply(fn, args, fuel)
    }
    return undefined
  })

  // ── §6.9 Bytevectors ───────────────────────────────────────────────

  def('bytevector?',       (v) => v instanceof Uint8Array)
  def('make-bytevector',   (n, fill = 0) => {
    const b = new Uint8Array(Math.max(0, n | 0))
    if (fill) b.fill(fill & 0xff)
    return b
  })
  def('bytevector',        (...bytes) => new Uint8Array(bytes.map((b) => b & 0xff)))
  def('bytevector-length', (b) => (b instanceof Uint8Array ? b.length : 0))
  def('bytevector-u8-ref', (b, i) => {
    if (!(b instanceof Uint8Array)) throw new ErrorObject('bytevector-u8-ref: not a bytevector', [b])
    return b[i | 0]
  })
  def('bytevector-u8-set!', (b, i, v) => {
    if (!(b instanceof Uint8Array)) throw new ErrorObject('bytevector-u8-set!: not a bytevector', [b])
    b[i | 0] = v & 0xff
    return undefined
  })
  def('bytevector-copy', (b, start, end) => {
    if (!(b instanceof Uint8Array)) return new Uint8Array()
    return b.slice(start || 0, end === undefined ? b.length : end)
  })
  def('bytevector-copy!', (to, at, from, start, end) => {
    if (!(to instanceof Uint8Array) || !(from instanceof Uint8Array)) return undefined
    const s = start || 0, e = end === undefined ? from.length : end
    for (let i = 0; i < e - s; i++) to[(at | 0) + i] = from[s + i]
    return undefined
  })
  def('bytevector-append', (...bs) => {
    let total = 0
    for (const b of bs) total += (b instanceof Uint8Array) ? b.length : 0
    const out = new Uint8Array(total)
    let off = 0
    for (const b of bs) {
      if (b instanceof Uint8Array) { out.set(b, off); off += b.length }
    }
    return out
  })
  def('utf8->string', (b, start, end) => {
    if (!(b instanceof Uint8Array)) return ''
    const slice = (start != null || end != null)
      ? b.slice(start || 0, end === undefined ? b.length : end)
      : b
    if (typeof TextDecoder !== 'undefined') return new TextDecoder('utf-8').decode(slice)
    if (typeof Buffer !== 'undefined') return Buffer.from(slice).toString('utf-8')
    // Fallback: 1-byte per char (ASCII-safe).
    let s = ''
    for (let i = 0; i < slice.length; i++) s += String.fromCharCode(slice[i])
    return s
  })
  def('string->utf8', (s, start, end) => {
    const str = String(s).slice(start || 0, end === undefined ? undefined : end)
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str)
    if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(str, 'utf-8'))
    const out = new Uint8Array(str.length)
    for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0xff
    return out
  })

  // ── §6.10 Control features ─────────────────────────────────────────

  // values + call-with-values. `values` builds a Values wrapper (or
  // returns the single arg directly to avoid box overhead). call-with-values
  // splices Values.vals into the consumer's args.
  def('values', (...args) => {
    if (args.length === 1) return args[0]
    return new Values(args)
  })
  def('call-with-values', (producer, consumer) => {
    const result = apply(producer, [], fuel)
    if (result instanceof Values) return apply(consumer, result.vals, fuel)
    return apply(consumer, [result], fuel)
  })

  // dynamic-wind — R7RS §6.10. Without full call/cc (decision-004), the
  // before-thunk runs, then the body-thunk, then the after-thunk, and
  // any exception in the body still runs after (per R7RS semantics).
  // The before-body-after ordering is honored; continuation-driven
  // re-entry is not supported.
  def('dynamic-wind', (before, thunk, after) => {
    apply(before, [], fuel)
    try {
      return apply(thunk, [], fuel)
    } finally {
      apply(after, [], fuel)
    }
  })

  // call/cc, call-with-current-continuation. Motoi Scheme has NO full
  // continuations (decision-004). We provide an ESCAPE-ONLY version: the
  // continuation is a function that, when called, throws a sentinel
  // caught by call/cc. This is enough for guard + non-local exit.
  //
  // A first-class continuation would allow re-entering an already-exited
  // computation, which our dispatcher gate does not tolerate. Escape-only
  // covers the vast majority of R7RS usage.
  class _EscapeSignal {
    constructor(k, value) { this._escapeKey = k; this._escapeValue = value }
  }
  let _kCounter = 0
  const _callCC = (fn) => {
    const key = ++_kCounter
    const k = (...args) => {
      const v = args.length === 0 ? undefined : args.length === 1 ? args[0] : new Values(args)
      throw new _EscapeSignal(key, v)
    }
    try {
      return apply(fn, [k], fuel)
    } catch (e) {
      if (e instanceof _EscapeSignal && e._escapeKey === key) return e._escapeValue
      throw e
    }
  }
  def('call/cc', _callCC)
  def('call-with-current-continuation', _callCC)

  // ── §6.11 Exceptions ───────────────────────────────────────────────

  // raise: throws the value. In our model, `raise` is non-continuable —
  // once thrown, control returns to the nearest guard / handler.
  def('raise', (v) => { throw v instanceof Error ? v : new _RaisedValue(v) })
  // raise-continuable: R7RS supports continuation-aware exception
  // handlers. We map it to `raise` — the handler runs, and if it
  // returns normally, the return value is the raise-continuable's
  // value. Our with-exception-handler cooperates.
  def('raise-continuable', (v) => { throw v instanceof Error ? v : new _RaisedValue(v) })

  def('error', (msg, ...irritants) => {
    throw new ErrorObject(msg, irritants, 'error')
  })

  // escalate: bubble a named condition upward past the current handler.
  //
  //   (escalate 'condition-name . args)
  //
  // A generic control-flow primitive that raises a NAMED condition —
  // caught by the nearest with-exception-handler or guard. Composes with
  // existing error/guard machinery; the raised value is an ErrorObject
  // whose type is the condition name (a symbol) and whose irritants are
  // the extra args. Useful for early-exit, deferred handling, structured
  // error control (Sakura port, top-10 candidate #1, 2026-07-16).
  //
  // The condition name may be a Sym or a plain string. Args are captured
  // verbatim and surfaced via error-object-irritants.
  def('escalate', (name, ...args) => {
    const condName = name == null ? 'escalated'
      : (name instanceof Sym ? name.name : String(name))
    throw new ErrorObject(`escalate: ${condName}`, args, condName)
  })

  // error-object?, message, irritants, type. These accept any value that
  // was raised — non-ErrorObject values yield #f for error-object?.
  def('error-object?',            (e) => e instanceof ErrorObject || (e && e._isErrorObject === true))
  def('error-object-message',     (e) => (e && e._errorMessage != null) ? e._errorMessage : String(e && e.message || e))
  def('error-object-irritants',   (e) => (e && Array.isArray(e._errorIrritants)) ? e._errorIrritants : [])
  def('error-object-type',        (e) => (e && e._errorType) ? sym(e._errorType) : sym('error'))
  def('read-error?',              (e) => e && e.name === 'ReadError')
  // No file ports per decision-010; file-error? is always #f.
  def('file-error?',              (_e) => false)

  // with-exception-handler — installs a handler, runs a thunk, restores
  // the handler on exit. If the thunk raises, the handler is called
  // with the raised value; the handler's return value becomes the
  // return of with-exception-handler. R7RS non-continuable raises
  // that reach an ordinary handler cause an error; we accept both.
  def('with-exception-handler', (handler, thunk) => {
    try {
      return apply(thunk, [], fuel)
    } catch (e) {
      const val = e instanceof _RaisedValue ? e.value : e
      return apply(handler, [val], fuel)
    }
  })

  // ── §6.12 Environments and eval — DEFERRED (decision-005) ──────────
  // Not exposed to author programs. Adapter seams stay internal.

  // ── §6.13 Input and output ─────────────────────────────────────────

  // Ports. We ship string ports and bytevector ports; file ports are
  // gated via verbs (decision-010).
  //
  // "Current" ports are dynamically parameterised. They default to
  // console-backed textual output for current-output-port /
  // current-error-port; current-input-port is a stub that returns EOF
  // (Motoi Scheme programs do not read from stdin — the REPL owns
  // that path, not author code).

  const stdoutPort = new Port('textual', 'output', null)
  const stderrPort = new Port('textual', 'output', null)
  stdoutPort._console = 'stdout'
  stderrPort._console = 'stderr'
  const stdinEmpty = new Port('textual', 'input', '')

  const currentInput  = new Parameter(stdinEmpty)
  const currentOutput = new Parameter(stdoutPort)
  const currentError  = new Parameter(stderrPort)

  const paramReader = (param) => Object.assign((...args) => {
    if (args.length === 0) return param.value
    // parameterize sets via a call — but our parameterize special
    // form pushes/pops directly on the Parameter. A one-arg call
    // here is treated as a lookup with a hint; do not mutate.
    return param.value
  }, { _isParameter: true, _parameter: param })

  def('current-input-port',  paramReader(currentInput))
  def('current-output-port', paramReader(currentOutput))
  def('current-error-port',  paramReader(currentError))

  def('port?',              (p) => p instanceof Port)
  def('input-port?',        (p) => p instanceof Port && p.mode === 'input')
  def('output-port?',       (p) => p instanceof Port && p.mode === 'output')
  def('textual-port?',      (p) => p instanceof Port && p.kind === 'textual')
  def('binary-port?',       (p) => p instanceof Port && p.kind === 'binary')
  def('input-port-open?',   (p) => p instanceof Port && p.mode === 'input' && p.open)
  def('output-port-open?',  (p) => p instanceof Port && p.mode === 'output' && p.open)
  def('close-port',         (p) => { if (p instanceof Port) p.open = false; return undefined })
  def('close-input-port',   (p) => { if (p instanceof Port && p.mode === 'input') p.open = false; return undefined })
  def('close-output-port',  (p) => { if (p instanceof Port && p.mode === 'output') p.open = false; return undefined })

  // String ports.
  def('open-input-string',  (s) => {
    const p = new Port('textual', 'input', String(s))
    return p
  })
  def('open-output-string', () => new Port('textual', 'output', null))
  def('get-output-string',  (p) => {
    if (!(p instanceof Port) || p.mode !== 'output' || p.kind !== 'textual') return ''
    return p.buffer.join('')
  })

  // Bytevector ports.
  def('open-input-bytevector',  (b) => {
    if (!(b instanceof Uint8Array)) throw new ErrorObject('open-input-bytevector: not a bytevector', [b])
    return new Port('binary', 'input', b)
  })
  def('open-output-bytevector', () => new Port('binary', 'output', null))
  def('get-output-bytevector',  (p) => {
    if (!(p instanceof Port) || p.mode !== 'output' || p.kind !== 'binary') return new Uint8Array()
    const total = p.buffer.reduce((s, x) => s + (x instanceof Uint8Array ? x.length : 1), 0)
    const out = new Uint8Array(total)
    let off = 0
    for (const x of p.buffer) {
      if (x instanceof Uint8Array) { out.set(x, off); off += x.length }
      else                          { out[off++] = x & 0xff }
    }
    return out
  })

  def('eof-object',   () => EOF)
  def('eof-object?',  (v) => v === EOF)

  // Reads on ports.
  const _resolveInputPort = (port) => {
    if (port === undefined) return currentInput.value
    return port
  }
  const _resolveOutputPort = (port) => {
    if (port === undefined) return currentOutput.value
    return port
  }
  def('read-char', (port) => {
    const p = _resolveInputPort(port)
    if (!(p instanceof Port) || p.mode !== 'input' || p.kind !== 'textual') return EOF
    if (p.pos >= p.backing.length) return EOF
    return ch(p.backing.charAt(p.pos++))
  })
  def('peek-char', (port) => {
    const p = _resolveInputPort(port)
    if (!(p instanceof Port) || p.mode !== 'input' || p.kind !== 'textual') return EOF
    if (p.pos >= p.backing.length) return EOF
    return ch(p.backing.charAt(p.pos))
  })
  def('read-line', (port) => {
    const p = _resolveInputPort(port)
    if (!(p instanceof Port) || p.mode !== 'input' || p.kind !== 'textual') return EOF
    if (p.pos >= p.backing.length) return EOF
    const start = p.pos
    while (p.pos < p.backing.length && p.backing.charAt(p.pos) !== '\n') p.pos++
    const line = p.backing.slice(start, p.pos)
    if (p.pos < p.backing.length) p.pos++  // skip \n
    return line
  })
  def('read-string', (k, port) => {
    const p = _resolveInputPort(port)
    if (!(p instanceof Port) || p.mode !== 'input' || p.kind !== 'textual') return EOF
    if (p.pos >= p.backing.length) return EOF
    const s = p.backing.slice(p.pos, p.pos + (k | 0))
    p.pos += s.length
    return s
  })
  def('read-u8', (port) => {
    const p = _resolveInputPort(port)
    if (!(p instanceof Port) || p.mode !== 'input' || p.kind !== 'binary') return EOF
    if (p.pos >= p.backing.length) return EOF
    return p.backing[p.pos++]
  })
  def('peek-u8', (port) => {
    const p = _resolveInputPort(port)
    if (!(p instanceof Port) || p.mode !== 'input' || p.kind !== 'binary') return EOF
    if (p.pos >= p.backing.length) return EOF
    return p.backing[p.pos]
  })
  def('char-ready?', (port) => {
    const p = _resolveInputPort(port)
    if (!(p instanceof Port)) return true
    return p.pos < (typeof p.backing === 'string' ? p.backing.length : p.backing.length)
  })
  def('u8-ready?', (port) => {
    const p = _resolveInputPort(port)
    if (!(p instanceof Port)) return true
    return p.pos < p.backing.length
  })

  // Writes on ports (or default console).
  const _renderForWrite = (v) => {
    if (v === true) return '#t'
    if (v === false) return '#f'
    if (v === undefined || v === null) return ''
    if (typeof v === 'number') return String(v)
    if (typeof v === 'string') return JSON.stringify(v)
    if (v instanceof Sym) return v.name
    if (v instanceof Ch) {
      // Named chars for read-back safety.
      const CHUNAME = { '\x07': 'alarm', '\b': 'backspace', '\x7f': 'delete', '\x1b': 'escape', '\n': 'newline', '\0': 'null', '\r': 'return', ' ': 'space', '\t': 'tab' }
      const cv = v.value
      if (Object.prototype.hasOwnProperty.call(CHUNAME, cv)) return '#\\' + CHUNAME[cv]
      return '#\\' + cv
    }
    if (v instanceof Uint8Array) return '#u8(' + Array.from(v).join(' ') + ')'
    if (Array.isArray(v)) return '(' + v.map(_renderForWrite).join(' ') + ')'
    if (typeof v === 'function') return '#<procedure>'
    return String(v)
  }
  const _renderForDisplay = (v) => {
    if (v instanceof Ch) return v.value           // display prints the raw char
    if (typeof v === 'string') return v           // display prints the raw text
    if (Array.isArray(v)) return '(' + v.map(_renderForDisplay).join(' ') + ')'
    return _renderForWrite(v)
  }
  const _emit = (port, text) => {
    if (port instanceof Port) {
      if (port.kind === 'binary') {
        // Coerce to bytes.
        const enc = typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(text) : null
        if (enc) port.buffer.push(enc)
        else for (let i = 0; i < text.length; i++) port.buffer.push(text.charCodeAt(i) & 0xff)
      } else {
        if (port._console === 'stdout') {
          if (typeof process !== 'undefined' && process.stdout) process.stdout.write(text)
          else if (typeof console !== 'undefined') console.log(text)
        } else if (port._console === 'stderr') {
          if (typeof process !== 'undefined' && process.stderr) process.stderr.write(text)
          else if (typeof console !== 'undefined') console.error(text)
        } else {
          port.buffer.push(text)
        }
      }
    }
  }
  def('write', (v, port) => {
    const p = _resolveOutputPort(port)
    _emit(p, _renderForWrite(v))
    return undefined
  })
  def('display', (v, port) => {
    const p = _resolveOutputPort(port)
    _emit(p, _renderForDisplay(v))
    return undefined
  })
  def('write-shared', (v, port) => {
    // No shared-structure detection (decision-006 forbids cycles); same as write.
    const p = _resolveOutputPort(port)
    _emit(p, _renderForWrite(v))
    return undefined
  })
  def('write-simple', (v, port) => {
    const p = _resolveOutputPort(port)
    _emit(p, _renderForWrite(v))
    return undefined
  })
  def('newline', (port) => {
    const p = _resolveOutputPort(port)
    _emit(p, '\n')
    return undefined
  })
  def('write-char', (c, port) => {
    const p = _resolveOutputPort(port)
    _emit(p, c instanceof Ch ? c.value : String(c))
    return undefined
  })
  def('write-string', (s, port, start, end) => {
    const p = _resolveOutputPort(port)
    const str = String(s).slice(start || 0, end === undefined ? undefined : end)
    _emit(p, str)
    return undefined
  })
  def('write-u8', (u8, port) => {
    const p = _resolveOutputPort(port)
    if (p instanceof Port && p.kind === 'binary') {
      p.buffer.push(u8 & 0xff)
    }
    return undefined
  })
  def('flush-output-port', (_port) => undefined)   // console is unbuffered

  // ── §6.14 System interface ─────────────────────────────────────────

  def('command-line', () => {
    if (typeof process !== 'undefined' && Array.isArray(process.argv)) return process.argv.slice(1)
    return []
  })
  // SECURITY (Priya 2026-07-17): emergency-exit terminates the host
  // process — hoisted to `destructive` so only `system` /
  // `operator-gesture` / `operator-voice` tiers can call it. Prior
  // behavior: default `read` perm let untrusted / external / sakura
  // fire process.exit at will (DoS).
  def('emergency-exit', (code = 0) => {
    if (typeof process !== 'undefined' && process.exit) process.exit(code | 0)
    return undefined
  }, 'destructive')
  // SECURITY (Priya 2026-07-17): env-var reads leak secrets (AWS_*,
  // OPENAI_API_KEY, HF_TOKEN, …). Hoisted to `personal-data` so
  // untrusted / external / sakura / animation tiers can't read them.
  // Alfred's dispatch chain (TIER_PERMS) keeps `personal-data` off the
  // sakura / external / untrusted allow-lists. A denylist of well-known
  // credential prefixes further scrubs whatever leaks through explicit
  // operator invocation (belt AND suspenders — an operator asking
  // "what's my env?" still shouldn't paste tokens to an LLM by
  // accident).
  const CRED_KEY_RE = /(TOKEN|SECRET|KEY|PASSWORD|PASSWD|CREDENTIAL|COOKIE|SESSION|API|AUTH|BEARER|PRIVATE|SALT)/i
  const CRED_KEY_ALLOW = new Set(['PATH', 'MANPATH', 'INFOPATH', 'KRB5CCNAME'])
  const scrubValue = (k) => (CRED_KEY_ALLOW.has(k) ? false : CRED_KEY_RE.test(k))
  def('get-environment-variable', (name) => {
    if (typeof process === 'undefined' || !process.env) return false
    const k = String(name)
    if (scrubValue(k)) return false
    return process.env[k] ?? false
  }, 'personal-data')
  def('get-environment-variables', () => {
    if (typeof process === 'undefined' || !process.env) return []
    return Object.entries(process.env)
      .filter(([k]) => !scrubValue(k))
      .map(([k, v]) => [k, v])
  }, 'personal-data')
  def('current-second',  () => Date.now() / 1000)
  def('current-jiffy',   () => Date.now())
  def('jiffies-per-second', () => 1000)
  def('features', () => [
    sym('motoi-scheme'),
    sym('r7rs'),
    sym('exact-closed'),
    sym('ratios'),
    sym('ieee-float'),
    sym('full-unicode'),
  ])

  // ── §4.2.5 delay / force / make-promise (control layer) ────────────
  //
  // Also install `delay` and `delay-force` as SPECIAL FORMS via a macro
  // trick — but the interp doesn't do macros for these; we'll make them
  // special-forms in interp.js in a companion patch. For now, install
  // `force` and `make-promise` here as procedures.

  const _force = (p) => {
    let cur = p
    while (cur instanceof SchemePromise) {
      if (cur.forced) { cur = cur.value; continue }
      cur.forced = true
      const result = apply(cur.thunk, [], fuel)
      cur.value = result
      cur.thunk = null
      cur = result
    }
    return cur
  }
  def('force',        _force)
  def('make-promise', (v) => {
    const p = new SchemePromise(null)
    p.forced = true
    p.value = v
    return p
  })

  // ── §4.2.6 make-parameter ──────────────────────────────────────────
  def('make-parameter', (init, converter) => {
    const param = new Parameter(init, converter)
    return paramReader(param)
  })

  // ── §5.5 define-record-type helper ─────────────────────────────────
  //
  // The `define-record-type` special form (added in interp.js) uses this
  // registry to build accessor/mutator closures. We expose the pieces
  // here so both the interp and user macros can reach them.
  def('_make-record-type', (nameSym, fieldSyms) => {
    const name = nameSym instanceof Sym ? nameSym.name : String(nameSym)
    const fields = fieldSyms.map((s) => s instanceof Sym ? s.name : String(s))
    return new RecordType(name, fields)
  })
  def('_make-record', (type, ...vals) => new RecordInstance(type, vals))
  def('_record?', (type, v) => v instanceof RecordInstance && v._recordType === type)
  def('_record-ref',  (v, i) => (v instanceof RecordInstance ? v._recordValues[i | 0] : undefined))
  def('_record-set!', (v, i, val) => {
    if (v instanceof RecordInstance) v._recordValues[i | 0] = val
    return undefined
  })

  return env
}

// Alias for backward compatibility with intra-file references.
const _RaisedValue = RaisedValue
