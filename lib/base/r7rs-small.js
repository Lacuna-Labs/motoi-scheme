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

import { Sym, sym, Pair, pairToString, tokenize, parse } from '../../src/reader.js'
import { isRational, makeRational } from '../math/exact.js'
import { makeRecordType, makeRecord, isRecord } from '../std/_shared.js'
import { apply } from '../../src/interp.js'

// Ch (character type) — R7RS §6.6. The class + `ch()` interner now live in
// the shared r7rs-types.js so reader.js (which produces `#\A` literals) and
// this file (char procedures) draw from ONE interned registry — literals are
// `eq?` across modules (2026-07-24; completes the Wave-1 migration note).
import {
  Ch, ch,
  Values, SchemePromise, Parameter, EOF,
  RecordType, RecordInstance, Port, ErrorObject, RaisedValue,
  isVec, mkVec,
} from './r7rs-types.js'

// Re-export the types so consumers that import from r7rs-small still work.
export {
  Values, SchemePromise, Parameter, EOF,
  RecordType, RecordInstance, Port, ErrorObject,
}

// ────────────────────────────────────────────────────────────────────────
// Install R7RS-small procedures into the env.
// ────────────────────────────────────────────────────────────────────────


// ── inline registration metadata (2026-07-22) ────────────────────
// See engineering/HOW-TO-REGISTER-A-VERB.md.
export const VERBS = [
  "angle",
  "assq",
  "assv",
  "binary-port?",
  "bytevector",
  "bytevector-append",
  "bytevector-copy",
  "bytevector-copy!",
  "bytevector-length",
  "bytevector-u8-ref",
  "bytevector-u8-set!",
  "bytevector?",
  "caaaar",
  "caaadr",
  "caaar",
  "caadar",
  "caaddr",
  "caadr",
  "caar",
  "cadaar",
  "cadadr",
  "cadar",
  "caddar",
  "cadddr",
  "call-with-current-continuation",
  "call-with-values",
  "call/cc",
  "cdaaar",
  "cdaadr",
  "cdaar",
  "cdadar",
  "cdaddr",
  "cdadr",
  "cdar",
  "cddaar",
  "cddadr",
  "cddar",
  "cdddar",
  "cddddr",
  "cdddr",
  "cddr",
  "char->integer",
  "char-alphabetic?",
  "char-ci<=?",
  "char-ci<?",
  "char-ci=?",
  "char-ci>=?",
  "char-ci>?",
  "char-downcase",
  "char-foldcase",
  "char-lower-case?",
  "char-numeric?",
  "char-ready?",
  "char-upcase",
  "char-upper-case?",
  "char-whitespace?",
  "char<=?",
  "char<?",
  "char=?",
  "char>=?",
  "char>?",
  "char?",
  "close-input-port",
  "close-output-port",
  "close-port",
  "command-line",
  "complex?",
  "current-error-port",
  "current-input-port",
  "current-jiffy",
  "current-output-port",
  "current-second",
  "denominator",
  "digit-value",
  "display",
  "dynamic-wind",
  "emergency-exit",
  "eof-object",
  "eof-object?",
  "error",
  "error-object-irritants",
  "error-object-message",
  "error-object-type",
  "error-object?",
  "escalate",
  "exact-integer-sqrt",
  "exact-integer?",
  "exact-rational?",
  "features",
  "file-error?",
  "floor-quotient",
  "floor-remainder",
  "floor/",
  "flush-output-port",
  "force",
  "get-environment-variable",
  "get-environment-variables",
  "get-output-bytevector",
  "get-output-string",
  "imag-part",
  "input-port-open?",
  "input-port?",
  "integer->char",
  "jiffies-per-second",
  "list->string",
  "list-set!",
  "magnitude",
  "make-bytevector",
  "make-parameter",
  "make-polar",
  "make-promise",
  "make-rectangular",
  "memq",
  "memv",
  "newline",
  "numerator",
  "open-input-bytevector",
  "open-input-string",
  "open-output-bytevector",
  "open-output-string",
  "output-port-open?",
  "output-port?",
  "peek-char",
  "peek-u8",
  "port?",
  "raise",
  "raise-continuable",
  "rationalize",
  "read",
  "read-char",
  "read-error?",
  "read-line",
  "read-string",
  "read-u8",
  "real-part",
  "string->list",
  "string->utf8",
  "string->vector",
  "string-ci<=?",
  "string-ci<?",
  "string-ci=?",
  "string-ci>=?",
  "string-ci>?",
  "string-foldcase",
  "string-for-each",
  "string-map",
  "string-ref",
  "textual-port?",
  "truncate-quotient",
  "truncate-remainder",
  "truncate/",
  "u8-ready?",
  "utf8->string",
  "values",
  "vector->string",
  "vector-append",
  "vector-copy",
  "vector-copy!",
  "vector-fill!",
  "vector-for-each",
  "vector-map",
  "vector-set!",
  "with-exception-handler",
  "write",
  "write-char",
  "write-shared",
  "write-simple",
  "write-string",
  "write-u8",
]
export const LAZY = false

export function installR7rsSmall(env, fuel) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  // ── shared argument validation (2026-08-02 conformance pass) ────────
  //
  // The dominant defect this pass fixes is SILENT-WRONG: a plausible
  // answer where the standard requires an error. A teaching language may
  // not do that — a wrong answer here is copied into a learner's head
  // (and, via the reference corpus, into a model's weights). These
  // helpers exist so every fixed site raises the SAME shape of error.

  // An exact non-negative index. Rejects NaN, floats, negatives, and
  // non-numbers. `-2` used to be read as "two from the end" by JS slice;
  // R7RS gives no such meaning (§6.7, §6.8).
  const _idx = (who, v, what, limit) => {
    if (typeof v !== 'number' || !Number.isInteger(v)) {
      throw new ErrorObject(`${who}: ${what} must be an exact non-negative integer`, [v])
    }
    if (v < 0) throw new ErrorObject(`${who}: ${what} must not be negative`, [v])
    if (limit !== undefined && v > limit) {
      throw new ErrorObject(`${who}: ${what} out of range (limit ${limit})`, [v])
    }
    return v
  }

  // Resolve an optional [start [end]] pair against a container length,
  // raising on anything the standard calls an error.
  const _range = (who, start, end, len) => {
    const s = start === undefined ? 0 : _idx(who, start, 'start', len)
    const e = end === undefined ? len : _idx(who, end, 'end', len)
    if (s > e) throw new ErrorObject(`${who}: start is greater than end`, [s, e])
    return [s, e]
  }

  const _vec = (who, v) => {
    if (!isVec(v)) throw new ErrorObject(`${who}: not a vector`, [v])
    return v
  }
  const _bvec = (who, b) => {
    if (!(b instanceof Uint8Array)) throw new ErrorObject(`${who}: not a bytevector`, [b])
    return b
  }

  // _describe / _ckIndex mirror src/base.js VERBATIM in wording. base.js
  // bounds-checks string-ref / vector-ref / list-ref with these; several of
  // those bindings are re-defined in THIS file (which installs later and
  // therefore wins), so the same message must be produced here or the
  // language reports the same mistake two different ways depending on which
  // verb the learner happened to type. One voice.
  const _describeVal = (x) => {
    if (x === undefined || x === null) return 'nothing'
    if (typeof x === 'string') return `the string ${JSON.stringify(x)}`
    if (typeof x === 'boolean') return x ? '#t' : '#f'
    if (Array.isArray(x)) return x.length === 0 ? 'the empty list' : 'a list'
    if (x instanceof Sym) return `the symbol ${x.name}`
    if (x instanceof Ch) return `the character #\\${x.value}`
    if (isVec(x)) return 'a vector'
    if (x instanceof Pair) return 'a pair'
    if (typeof x === 'function') return 'a procedure'
    if (isRational(x)) return `the number ${x.n}/${x.d}`
    if (typeof x === 'number') return `the number ${x}`
    return 'a value of another kind'
  }
  const _ckIndex = (op, i, len, what) => {
    const k = isRational(i) ? Number(i.n) / Number(i.d) : i
    if (typeof k !== 'number' || !Number.isInteger(k)) {
      throw new ErrorObject(`${op}: expected an integer index, got ${_describeVal(i)}`, [i])
    }
    if (len === 0) {
      throw new ErrorObject(`${op}: index ${k} is out of range — the ${what} is empty, so no index is valid`, [i])
    }
    if (k < 0 || k >= len) {
      throw new ErrorObject(`${op}: index ${k} is out of range for a ${what} of length ${len}; valid indices are 0 to ${len - 1}`, [i])
    }
    return k
  }

  // ── §6.2 Numbers (missing pieces) ───────────────────────────────────

  // Motoi's numeric tower is PARTIAL, not absent. Two representations
  // exist at runtime:
  //
  //   1. JS doubles. JavaScript cannot tell `2` from `2.0`, so Motoi has
  //      no exact/inexact distinction for them and `exact?` answers #t.
  //      That is a REPRESENTATION LIMIT sanctioned by R7RS §6.2.3, which
  //      permits an implementation to support only part of the tower —
  //      not a bug, and not something these predicates should apologise
  //      for. (`/` likewise stays inexact. Settled 2026-08-02.)
  //   2. Rational (lib/math/exact.js) — a REAL runtime type, BigInt n/d,
  //      reduced, produced by literals like `1/2` and by exact arithmetic.
  //
  // The comment that used to sit here said "Motoi has no numeric tower
  // (decision-011)" and that Rationals therefore could not arrive. They
  // do. Every predicate below must admit them, or it answers #f to a
  // question about a value it is the paradigm case of — silent-wrong.
  //
  // The JS-double arm of each predicate is UNCHANGED: what these answer
  // for a plain number is governed by the exactness ruling above.

  // GOTCHA: lib/math/exact.js's isRational is `v && typeof v === 'object'
  // && ...` — for a FALSY argument it returns the argument, not false. So
  // `false || isRational(NaN)` evaluates to NaN, and a predicate that must
  // answer #t or #f hands back a number instead. Every predicate below
  // therefore goes through this strict wrapper.
  const _ratQ = (x) => isRational(x) === true

  // §6.2.6 — every Rational is a real, hence a complex, number.
  def('complex?', (x) => (typeof x === 'number' && Number.isFinite(x)) || _ratQ(x))
  // §6.2.6 — a Rational with denominator 1 IS an integer: (+ 1/2 1/2) is
  // the integer 1, held as a Rational. Spelling kept identical to the
  // (shadowed) copy at lib/std/r7rs-completions-core.js so the two agree.
  def('exact-integer?', (x) => (typeof x === 'number' && Number.isInteger(x)) || (_ratQ(x) && x.d === 1n))
  // §6.2.6 — a Rational is the paradigm exact rational.
  def('exact-rational?', (x) => (typeof x === 'number' && Number.isFinite(x) && Number.isInteger(x)) || _ratQ(x))

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

  // numerator / denominator (§6.2.6). Exact rationals (the {n,d} objects
  // from lib/math/exact.js) report their reduced parts; a plain integer
  // is its own numerator over denominator 1.
  def('numerator',   (x) => isRational(x) ? Number(x.n) : x)
  def('denominator', (x) => isRational(x) ? Number(x.d) : 1)

  // rationalize (§6.2.6). Returns the SIMPLEST rational differing from
  // `x` by no more than `y`. This was an identity stub until 2026-08-02
  // — it ignored the tolerance entirely, so `(rationalize 3/10 1/10)`
  // answered `3/10` instead of `1/3`. That is the exact silent-wrong
  // shape this pass exists to kill.
  //
  // The algorithm is the standard `simplest-rational` from the R7RS
  // reference implementation (continued-fraction descent over the
  // Stern-Brocot tree). All arithmetic is exact BigInt n/d so no
  // floating error can leak into the answer.
  //
  // Exactness follows Motoi's representation limit (see
  // CONFORMANCE-FIX-DECISIONS-2026-08-02): if either argument is a
  // Rational the answer is a Rational; if both are plain JS numbers the
  // answer is a plain JS number. Motoi cannot represent an inexact 1/3
  // any other way.
  const _rat = (n, d) => {
    if (d < 0n) { n = -n; d = -d }
    let a = n < 0n ? -n : n, b = d
    while (b) { const t = b; b = a % b; a = t }
    const g = a || 1n
    return { n: n / g, d: d / g }
  }
  // Exact binary value of a JS double. Scaling by 2 is lossless, so this
  // is the true value of the float, not an approximation of it.
  const _exactOf = (who, x) => {
    if (isRational(x)) return { n: x.n, d: x.d }
    if (typeof x !== 'number' || !Number.isFinite(x)) {
      throw new ErrorObject(`${who}: not a finite real number`, [x])
    }
    let v = x, e = 0
    while (!Number.isInteger(v) && e < 1100) { v *= 2; e++ }
    if (!Number.isInteger(v)) throw new ErrorObject(`${who}: not a finite real number`, [x])
    return _rat(BigInt(v), 1n << BigInt(e))
  }
  const _rAdd = (a, b) => _rat(a.n * b.d + b.n * a.d, a.d * b.d)
  const _rSub = (a, b) => _rat(a.n * b.d - b.n * a.d, a.d * b.d)
  const _rNeg = (a) => ({ n: -a.n, d: a.d })
  const _rCmp = (a, b) => {
    const l = a.n * b.d, r = b.n * a.d
    return l < r ? -1 : l > r ? 1 : 0
  }
  const _rRecip = (a) => _rat(a.d, a.n)
  const _rFloor = (a) => {
    let q = a.n / a.d
    if (a.n % a.d !== 0n && a.n < 0n) q -= 1n
    return q
  }
  // sr: both bounds strictly positive, x < y.
  const _sr = (x, y) => {
    const fx = _rFloor(x), fy = _rFloor(y)
    if (_rCmp({ n: fx, d: 1n }, x) >= 0) return { n: fx, d: 1n }
    if (fx === fy) {
      const inner = _sr(_rRecip(_rSub(y, { n: fy, d: 1n })),
                        _rRecip(_rSub(x, { n: fx, d: 1n })))
      return _rAdd({ n: fx, d: 1n }, _rRecip(inner))
    }
    return { n: fx + 1n, d: 1n }
  }
  const _simplest = (x, y) => {
    if (_rCmp(y, x) < 0) return _simplest(y, x)
    if (_rCmp(x, y) === 0) return x
    if (x.n > 0n) return _sr(x, y)
    if (y.n < 0n) return _rNeg(_sr(_rNeg(y), _rNeg(x)))
    return { n: 0n, d: 1n }
  }
  def('rationalize', (x, y) => {
    if (y === undefined) throw new ErrorObject('rationalize: expects (rationalize x y)', [x])
    const ex = _exactOf('rationalize', x)
    const ey = _exactOf('rationalize', y)
    const r = _simplest(_rSub(ex, ey), _rAdd(ex, ey))
    if (isRational(x) || isRational(y)) return makeRational(r.n, r.d)
    return Number(r.n) / Number(r.d)
  })

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
  // Alist entries may be either shape: a proper list `(k v)` or a real
  // dotted pair `(k . v)` from `(cons k v)`. Match on both, or every
  // cons-built alist silently looks up as empty.
  const _entryKey = (p) => (p instanceof Pair ? p.car : Array.isArray(p) ? p[0] : undefined)
  const _isEntry = (p) => p instanceof Pair || Array.isArray(p)
  def('assq', (key, alist) => {
    if (!Array.isArray(alist)) return false
    const eq = (a, b) => a === b || (a instanceof Sym && b instanceof Sym && a.name === b.name) || (a instanceof Ch && b instanceof Ch && a.value === b.value)
    return alist.find((pair) => _isEntry(pair) && eq(_entryKey(pair), key)) || false
  })
  def('assv', (key, alist) => {
    if (!Array.isArray(alist)) return false
    const eq = (a, b) => a === b || (a instanceof Sym && b instanceof Sym && a.name === b.name) || (a instanceof Ch && b instanceof Ch && a.value === b.value)
    return alist.find((pair) => _isEntry(pair) && eq(_entryKey(pair), key)) || false
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
  // Improper Pairs walk through this family too — `(cdar '((a . 1) (b . 2)))`
  // must reach the 1, so a Pair is a valid step target, not a dead end.
  const _c = (lst, ops) => {
    let x = lst
    for (const op of ops) {
      if (x instanceof Pair) { x = op === 'a' ? x.car : x.cdr; continue }
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
  // R7RS §6.7 takes a string. See the note on string-upcase in
  // lib/std/r7rs-completions-core.js: coercing a character here silently
  // produced the character's printed text rather than an error.
  def('string-foldcase', (s) => {
    if (typeof s !== 'string') throw new Error(`string-foldcase: expected a string, got ${_describe(s)}`)
    return s.toLowerCase()
  })

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
  //
  // Both validate their arguments as of 2026-08-02. Previously
  // `(string->vector "abcdef" -2)` answered #(e f), because a negative
  // start fell through to JS `slice`, which reads it as an offset from
  // the END. R7RS §6.7 gives negative indices no meaning at all — the
  // only correct answer is an error.
  def('string->vector', (s, start, end) => {
    if (typeof s !== 'string') throw new ErrorObject('string->vector: not a string', [s])
    const [a, b] = _range('string->vector', start, end, s.length)
    return mkVec(s.slice(a, b).split('').map((c) => ch(c)))
  })
  // vector->string required its elements to be characters all along;
  // `(vector->string (vector 1 2 3))` used to answer "123" by stringifying
  // whatever it found. A vector of numbers is not a string.
  def('vector->string', (v, start, end) => {
    const items = _vec('vector->string', v).items
    const [a, b] = _range('vector->string', start, end, items.length)
    let out = ''
    for (let i = a; i < b; i++) {
      const c = items[i]
      if (!(c instanceof Ch)) {
        throw new ErrorObject('vector->string: vector element is not a character', [c])
      }
      out += c.value
    }
    return out
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
  //
  // BOUNDS (§6.7): "It is an error if k is not a valid index of string."
  // This used to be `charAt(i | 0)`, which answers a character built from
  // the empty string for `(string-ref "abc" 99)` — a plausible value for a
  // question that was never asked. `i | 0` also silently truncated 1.5 to 1
  // and wrapped anything past 2^31. Checked via _ckIndex so the message
  // matches the one src/base.js raises for the same mistake.
  def('string-ref', (s, i) => {
    if (typeof s !== 'string') {
      throw new ErrorObject(`string-ref: expected a string, got ${_describeVal(s)}`, [s])
    }
    return ch(s.charAt(_ckIndex('string-ref', i, s.length, 'string')))
  })

  // ── §6.8 Vectors (missing pieces) ──────────────────────────────────

  // vector-set! — R7RS-mutable vectors per decision-009.
  //
  // BOUNDS (§6.8): "It is an error if k is not a valid index of vector."
  // This wrote through `v.items[i | 0]` with no range check, so
  // `(vector-set! (vector 1 2) 99 9)` GREW a 2-slot vector into a 100-slot
  // sparse array full of holes — and every later vector-ref, vector-length
  // and display reported that corruption far from its cause.
  //
  // This copy is the LIVE one: lib/std/r7rs-completions-core.js also binds
  // vector-set!, but core/index.js installs this file afterwards, so this
  // definition wins (verified: `(vector-set! 5 0 1)` raises the message
  // below, which only exists here).
  def('vector-set!', (v, i, val) => {
    if (!isVec(v)) throw new ErrorObject(`vector-set!: not a vector`, [v])
    v.items[_ckIndex('vector-set!', i, v.items.length, 'vector')] = val
    return undefined
  })
  def('vector-fill!', (v, val, start, end) => {
    if (!isVec(v)) return undefined
    const items = v.items
    const s = start | 0, e = end === undefined ? items.length : (end | 0)
    for (let i = s; i < e; i++) items[i] = val
    return undefined
  })
  def('vector-copy', (v, start, end) => {
    if (!isVec(v)) return mkVec([])
    return mkVec(v.items.slice(start || 0, end === undefined ? v.items.length : end))
  })
  // vector-copy! (§6.8). R7RS requires this to behave "as if" the source
  // range were copied to a temporary vector first, so an OVERLAPPING
  // right shift must not smear: on #(1 2 3 4 5), `(vector-copy! v 1 v 0 4)`
  // is #(1 1 2 3 4), not #(1 1 1 1 1). The forward loop this replaces
  // smeared (2026-08-02). Taking a real slice is the honest fix — it is
  // literally the intermediate the standard describes.
  //
  // Range validation added in the same pass: this used to silently GROW
  // the destination past its own length (its sibling bytevector-copy!
  // silently DISCARDED instead — same call, two different wrong answers).
  // §6.8 makes an over-long range an error; raise.
  def('vector-copy!', (to, at, from, start, end) => {
    const ti = _vec('vector-copy!', to).items
    const fi = _vec('vector-copy!', from).items
    const a = _idx('vector-copy!', at, 'at', ti.length)
    const [s, e] = _range('vector-copy!', start, end, fi.length)
    if (ti.length - a < e - s) {
      throw new ErrorObject(
        'vector-copy!: source range does not fit in the destination', [e - s, ti.length - a])
    }
    const tmp = fi.slice(s, e)
    for (let i = 0; i < tmp.length; i++) ti[a + i] = tmp[i]
    return undefined
  })
  // vector-append (§6.8). A non-vector argument used to be SKIPPED, so
  // `(vector-append (vector 1) (list 2 3))` answered #(1) and the real
  // mistake surfaced arbitrarily far away. Raise instead (2026-08-02).
  def('vector-append', (...vs) => {
    const out = []
    for (const v of vs) out.push(..._vec('vector-append', v).items)
    return mkVec(out)
  })
  // Re-register vector-map / vector-for-each supporting MULTIPLE vectors.
  def('vector-map', (fn, ...vs) => {
    if (vs.length === 0) return mkVec([])
    const n = Math.min(...vs.map((v) => (isVec(v) ? v.items.length : 0)))
    const out = new Array(n)
    for (let i = 0; i < n; i++) {
      const args = vs.map((v) => v.items[i])
      out[i] = apply(fn, args, fuel)
    }
    return mkVec(out)
  })
  def('vector-for-each', (fn, ...vs) => {
    if (vs.length === 0) return undefined
    const n = Math.min(...vs.map((v) => (isVec(v) ? v.items.length : 0)))
    for (let i = 0; i < n; i++) {
      const args = vs.map((v) => v.items[i])
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
  // bytevector-copy! (§6.9) — same two fixes as vector-copy! above:
  // overlap goes through a real intermediate copy, and a range that does
  // not fit raises instead of being silently truncated by the fixed-width
  // Uint8Array (2026-08-02).
  def('bytevector-copy!', (to, at, from, start, end) => {
    const t = _bvec('bytevector-copy!', to)
    const f = _bvec('bytevector-copy!', from)
    const a = _idx('bytevector-copy!', at, 'at', t.length)
    const [s, e] = _range('bytevector-copy!', start, end, f.length)
    if (t.length - a < e - s) {
      throw new ErrorObject(
        'bytevector-copy!: source range does not fit in the destination', [e - s, t.length - a])
    }
    t.set(f.slice(s, e), a)
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
  // get-output-string (§6.13.3). Answering "" for an input port, a binary
  // port, or a non-port made a WRONG ARGUMENT indistinguishable from a
  // sink that genuinely had nothing in it. Raise (2026-08-02). Same
  // reasoning as get-output-bytevector below; the two are siblings and
  // must be equally strict or the pair teaches a contradiction.
  //
  // A CLOSED string port is still readable — the accumulated characters
  // do not vanish when the sink is closed, and R7RS does not forbid it.
  def('get-output-string',  (p) => {
    if (!(p instanceof Port)) throw new ErrorObject('get-output-string: not a port', [p])
    if (p.mode !== 'output' || p.kind !== 'textual') {
      throw new ErrorObject('get-output-string: not a textual output port', [p])
    }
    return p.buffer.join('')
  })

  // Bytevector ports.
  def('open-input-bytevector',  (b) => {
    if (!(b instanceof Uint8Array)) throw new ErrorObject('open-input-bytevector: not a bytevector', [b])
    return new Port('binary', 'input', b)
  })
  def('open-output-bytevector', () => new Port('binary', 'output', null))
  // get-output-bytevector (§6.13.3). Used to answer #u8() for a textual
  // port, an input port, and a non-port alike — indistinguishable from a
  // genuinely empty sink, which is the worst kind of wrong answer
  // because it looks like a correct one. Raise (2026-08-02).
  def('get-output-bytevector',  (p) => {
    if (!(p instanceof Port)) throw new ErrorObject('get-output-bytevector: not a port', [p])
    if (p.mode !== 'output' || p.kind !== 'binary') {
      throw new ErrorObject('get-output-bytevector: not a binary output port', [p])
    }
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
  //
  // CLOSED PORTS (fixed 2026-08-02). `input-port-open?` and
  // `output-port-open?` reported a state the port did not honour: a
  // closed port went right on reading and writing. §6.13.1 makes
  // operating on a closed port an error, and a teaching language that
  // answers a read on a closed port is teaching a false model of what
  // "closed" means. Every read and write path below now goes through
  // one of these two resolvers, so the check cannot be forgotten at a
  // single site.
  //
  // Wrong-type ports are raised for the same reason: `(read-char
  // (open-output-string))` used to answer `#<eof>`, which is
  // indistinguishable from a genuinely exhausted input port.
  const _inPort = (who, port, kind) => {
    const p = port === undefined ? currentInput.value : port
    if (!(p instanceof Port)) throw new ErrorObject(`${who}: not a port`, [p])
    if (p.mode !== 'input') throw new ErrorObject(`${who}: not an input port`, [p])
    if (kind && p.kind !== kind) throw new ErrorObject(`${who}: not a ${kind} port`, [p])
    if (!p.open) throw new ErrorObject(`${who}: port is closed`, [p])
    return p
  }
  const _outPort = (who, port, kind) => {
    const p = port === undefined ? currentOutput.value : port
    if (!(p instanceof Port)) throw new ErrorObject(`${who}: not a port`, [p])
    if (p.mode !== 'output') throw new ErrorObject(`${who}: not an output port`, [p])
    if (kind && p.kind !== kind) throw new ErrorObject(`${who}: not a ${kind} port`, [p])
    if (!p.open) throw new ErrorObject(`${who}: port is closed`, [p])
    return p
  }
  def('read-char', (port) => {
    const p = _inPort('read-char', port, 'textual')
    if (p.pos >= p.backing.length) return EOF
    return ch(p.backing.charAt(p.pos++))
  })
  def('peek-char', (port) => {
    const p = _inPort('peek-char', port, 'textual')
    if (p.pos >= p.backing.length) return EOF
    return ch(p.backing.charAt(p.pos))
  })
  def('read-line', (port) => {
    const p = _inPort('read-line', port, 'textual')
    if (p.pos >= p.backing.length) return EOF
    const start = p.pos
    while (p.pos < p.backing.length && p.backing.charAt(p.pos) !== '\n') p.pos++
    const line = p.backing.slice(start, p.pos)
    if (p.pos < p.backing.length) p.pos++  // skip \n
    return line
  })
  // read-string (§6.13.2). A negative k used to fall through to JS
  // `slice`, which read it as an offset from the end — so `(read-string
  // -1 p)` returned characters AND advanced the port. Raise (2026-08-02).
  def('read-string', (k, port) => {
    _idx('read-string', k, 'k')
    const p = _inPort('read-string', port, 'textual')
    if (p.pos >= p.backing.length) return EOF
    const s = p.backing.slice(p.pos, p.pos + k)
    p.pos += s.length
    return s
  })
  def('read-u8', (port) => {
    const p = _inPort('read-u8', port, 'binary')
    if (p.pos >= p.backing.length) return EOF
    return p.backing[p.pos++]
  })
  def('peek-u8', (port) => {
    const p = _inPort('peek-u8', port, 'binary')
    if (p.pos >= p.backing.length) return EOF
    return p.backing[p.pos]
  })
  // char-ready? / u8-ready? (§6.13.2). Three bugs, all fixed 2026-08-02:
  // they answered #f AT END OF FILE where the standard explicitly
  // requires #t ("if the port is at end of file then char-ready? returns
  // #t"); they crashed on an output port; and they answered #t for a
  // value that was not a port at all.
  //
  // Motoi's ports are wholly backed by an in-memory string or bytevector,
  // so input never blocks: a character is always either available or the
  // port is at EOF. Both cases are #t, which is why the body is a
  // constant. The validation is the whole point of the procedure here.
  def('char-ready?', (port) => { _inPort('char-ready?', port, 'textual'); return true })
  def('u8-ready?',   (port) => { _inPort('u8-ready?', port, 'binary');   return true })

  // read (§6.13.2) — was UNBOUND until 2026-08-02, despite being one of
  // the three procedures the standard names for textual input.
  //
  // It reads exactly ONE datum and leaves the port positioned after it.
  // Rather than hand-roll a second parser (which would drift from the
  // real one the moment either changed), this runs the ACTUAL tokenizer
  // from src/reader.js over the rest of the port, walks the token stream
  // to the end of the first datum, and hands that slice to the ACTUAL
  // parser. One grammar, one source of truth.
  //
  // Token line/col → byte offset. The tokenizer counts columns per
  // character and resets on newline, so this inverts exactly.
  const _offsetOf = (src, line, col) => {
    let off = 0
    for (let l = 1; l < line; l++) {
      const nl = src.indexOf('\n', off)
      if (nl < 0) return src.length
      off = nl + 1
    }
    return Math.min(src.length, off + col - 1)
  }
  const _OPENERS = new Set(['(', '#(', '#u8('])
  const _PREFIXES = new Set(["'", '`', ',', ',@'])
  def('read', (port) => {
    const p = _inPort('read', port, 'textual')
    const rest = p.backing.slice(p.pos)
    const toks = tokenize(rest)
    if (toks.length === 0) { p.pos = p.backing.length; return EOF }
    // Walk to the token index just past the first complete datum.
    let i = 0, depth = 0
    for (; i < toks.length; i++) {
      const t = toks[i].t
      if (_PREFIXES.has(t)) continue          // a prefix never completes a datum
      if (_OPENERS.has(t)) { depth++; continue }
      if (t === ')') { depth--; if (depth <= 0) { i++; break } continue }
      if (depth === 0) { i++; break }         // a bare atom is a whole datum
    }
    const endAt = i < toks.length
      ? _offsetOf(rest, toks[i].line, toks[i].col)
      : rest.length
    const forms = parse(rest.slice(0, endAt))
    if (forms.length === 0) { p.pos = p.backing.length; return EOF }
    p.pos += endAt
    return forms[0]
  })

  // Writes on ports (or default console).
  const _MOTOI_RAT_TAG = Symbol.for('motoi:rational')
  const _renderForWrite = (v) => {
    if (v === true) return '#t'
    if (v === false) return '#f'
    if (v === undefined || v === null) return ''
    if (typeof v === 'number') {
      if (v === Infinity) return '+inf.0'
      if (v === -Infinity) return '-inf.0'
      if (Number.isNaN(v)) return '+nan.0'
      return String(v)
    }
    if (typeof v === 'bigint') return String(v)
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
    if (isVec(v)) return '#(' + v.items.map(_renderForWrite).join(' ') + ')'
    if (Array.isArray(v)) return '(' + v.map(_renderForWrite).join(' ') + ')'
    if (v instanceof Pair) return pairToString(v, _renderForWrite)
    if (typeof v === 'function') return '#<procedure>'
    // Motoi exact rationals — carry Symbol.for('motoi:rational').
    if (v && typeof v === 'object' && v[_MOTOI_RAT_TAG] === true) {
      return v.d === 1n ? String(v.n) : `${v.n}/${v.d}`
    }
    // Promise objects — show shape not JS repr.
    if (v && typeof v === 'object' && v.__promise__ === true) {
      return v.forced ? _renderForWrite(v.value) : '#<promise>'
    }
    // Everything below reached `String(v)` and printed `[object Object]` — a
    // JS artifact with no meaning in Scheme, and the same shape for four
    // unrelated types.
    if (v === EOF || (v && typeof v === 'object' && v.__eof__ === true)) return '#<eof>'
    if (v instanceof Values) return v.vals.map(_renderForWrite).join(' ')
    if (v instanceof Port) return `#<port ${v.kind || 'textual'}>`
    if (isRecord(v)) return '#<record>'
    return String(v)
  }
  const _renderForDisplay = (v) => {
    if (v instanceof Ch) return v.value           // display prints the raw char
    if (typeof v === 'string') return v           // display prints the raw text
    if (Array.isArray(v)) return '(' + v.map(_renderForDisplay).join(' ') + ')'
    if (v instanceof Pair) return pairToString(v, _renderForDisplay)
    if (isVec(v)) return '#(' + v.items.map(_renderForDisplay).join(' ') + ')'
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
  // ── datum labels (§6.13.3) ─────────────────────────────────────────
  //
  // `write-shared` was literally the same function as `write` — no
  // visited set, no labels. That is a genuine divergence, because
  // write-shared is DEFINED by emitting `#n=` / `#n#` for every shared
  // structure, not merely for cycles.
  //
  // `write` needed the machinery too. Cycles are constructible today
  // (`(list-set! l 1 l)`) and `set-cdr!` lands in this same pass, so the
  // old renderer blew the JS stack — "Maximum call stack size exceeded"
  // — on a circular datum. §6.13.3 requires `write` to label exactly the
  // structure needed to make the output finite, i.e. cycles only.
  // `write-simple` never labels; it stays as it was.
  const _isCompound = (v) => Array.isArray(v) || isVec(v) || v instanceof Pair

  // Find the objects needing a label. `allShared` picks write-shared's
  // rule (anything reachable more than once); otherwise only members of
  // a cycle are labelled, which is write's rule.
  const _labelTargets = (root, allShared) => {
    const counts = new Map()
    const onPath = new Set()
    const cyclic = new Set()
    const walk = (v) => {
      if (!_isCompound(v)) return
      if (onPath.has(v)) { cyclic.add(v); return }
      const seen = counts.get(v) || 0
      counts.set(v, seen + 1)
      if (seen > 0) return                 // subtree already traversed
      onPath.add(v)
      if (v instanceof Pair) { walk(v.car); walk(v.cdr) }
      else if (isVec(v)) { for (const x of v.items) walk(x) }
      else { for (const x of v) walk(x) }
      onPath.delete(v)
    }
    walk(root)
    const targets = new Set()
    for (const [obj, n] of counts) {
      // A cycle is always labelled — write-shared labels a SUPERSET of
      // what write labels, never a subset. (A self-referential datum is
      // reached only once by the counter, because the back-edge stops
      // the walk, so `n > 1` alone would miss it and recurse forever.)
      if (cyclic.has(obj) || (allShared && n > 1)) targets.add(obj)
    }
    return targets
  }

  // Render with labels. Label numbers are assigned in emission order, so
  // the first `#0=` is always the leftmost labelled datum.
  const _renderLabeled = (root, targets) => {
    const assigned = new Map()
    let next = 0
    const go = (x) => {
      if (targets.has(x)) {
        if (assigned.has(x)) return '#' + assigned.get(x) + '#'
        const id = next++
        assigned.set(x, id)
        return '#' + id + '=' + body(x)
      }
      return body(x)
    }
    const body = (x) => {
      if (isVec(x)) return '#(' + x.items.map(go).join(' ') + ')'
      if (Array.isArray(x)) return '(' + x.map(go).join(' ') + ')'
      if (x instanceof Pair) {
        // Collapse the cdr chain the way pairToString does, but stop at a
        // labelled cdr so the label is not swallowed by the collapse.
        const parts = [go(x.car)]
        let t = x.cdr
        while (t instanceof Pair && !targets.has(t)) { parts.push(go(t.car)); t = t.cdr }
        return '(' + parts.join(' ') + ' . ' + go(t) + ')'
      }
      return _renderForWrite(x)         // atoms only — body handles compounds
    }
    return go(root)
  }

  // When nothing needs a label the labelled renderer is skipped entirely,
  // so ordinary acyclic output is byte-for-byte what it always was.
  const _writeText = (v, allShared) => {
    const targets = _labelTargets(v, allShared)
    return targets.size === 0 ? _renderForWrite(v) : _renderLabeled(v, targets)
  }

  def('write', (v, port) => {
    const p = _outPort('write', port)
    _emit(p, _writeText(v, false))
    return undefined
  })
  def('display', (v, port) => {
    const p = _outPort('display', port)
    _emit(p, _renderForDisplay(v))
    return undefined
  })
  def('write-shared', (v, port) => {
    const p = _outPort('write-shared', port)
    _emit(p, _writeText(v, true))
    return undefined
  })
  def('write-simple', (v, port) => {
    const p = _outPort('write-simple', port)
    _emit(p, _renderForWrite(v))
    return undefined
  })
  def('newline', (port) => {
    const p = _outPort('newline', port)
    _emit(p, '\n')
    return undefined
  })
  def('write-char', (c, port) => {
    const p = _outPort('write-char', port)
    _emit(p, c instanceof Ch ? c.value : String(c))
    return undefined
  })
  def('write-string', (s, port, start, end) => {
    const p = _outPort('write-string', port)
    const str = String(s).slice(start || 0, end === undefined ? undefined : end)
    _emit(p, str)
    return undefined
  })
  // write-u8 (§6.13.3). Two silent-wrongs, both fixed 2026-08-02:
  // an out-of-range byte was masked mod 256 (so `(write-u8 300 p)` wrote
  // 44 and said nothing), and a write to a TEXTUAL port was discarded
  // outright. A byte is a byte; a textual port is not a byte sink.
  def('write-u8', (u8, port) => {
    const p = _outPort('write-u8', port, 'binary')
    if (typeof u8 !== 'number' || !Number.isInteger(u8) || u8 < 0 || u8 > 255) {
      throw new ErrorObject('write-u8: not a byte (expected an exact integer 0..255)', [u8])
    }
    p.buffer.push(u8)
    return undefined
  })
  // flush-output-port (§6.13.3) was a bare no-op that ignored its
  // argument entirely — it accepted a closed port, an input port, and a
  // non-port alike. The console really is unbuffered, so there is nothing
  // to flush, but the argument still has to be a live output port.
  def('flush-output-port', (port) => { _outPort('flush-output-port', port); return undefined })

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

  // Accept both SchemePromise instances (make-promise below) AND the
  // plain-object promise shape produced by the `delay` special form in
  // src/interp.js — { __promise__: true, forced, value, thunk }. Both
  // are semantically identical (thunk + forced flag + memo slot); the
  // walker treats them the same.
  const _isPromise = (v) => v instanceof SchemePromise
    || (v != null && typeof v === 'object' && v.__promise__ === true)
  const _force = (p) => {
    let cur = p
    while (_isPromise(cur)) {
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
    // The converter arrives as a Scheme procedure, so it has to be applied
    // through the interpreter rather than called as a JS function.
    const conv = converter == null ? undefined : (x) => apply(converter, [x], fuel)
    const param = new Parameter(init, conv)
    return paramReader(param)
  })

  // ── §5.5 define-record-type helper ─────────────────────────────────
  //
  // The `define-record-type` special form (added in interp.js) uses this
  // registry to build accessor/mutator closures. We expose the pieces
  // here so both the interp and user macros can reach them.
  // These share ONE record representation with lib/std/_shared.js — the
  // interpreter's define-record-type reaches for them by field name, so an
  // index-keyed variant here would silently shadow it into a type error.
  const _fieldName = (f) => (f instanceof Sym ? f.name : String(f))
  def('_make-record-type', (name, ...fields) =>
    makeRecordType(_fieldName(name), fields.map(_fieldName)))
  def('_make-record', (type, ...vals) => makeRecord(type, vals))
  def('_record-of-type?', (v, type) => isRecord(v, type))
  def('_record?', (type, v) => isRecord(v, type))
  def('_record-ref', (v, field) => (v == null || typeof v !== 'object' ? false : v[_fieldName(field)]))
  def('_record-set!', (v, field, val) => {
    if (v != null && typeof v === 'object') v[_fieldName(field)] = val
    return undefined
  })

  return env
}

// Alias for backward compatibility with intra-file references.
const _RaisedValue = RaisedValue
