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

import { Sym, sym, Pair, pairToString, tokenize, parse, writeSymbol, writeString } from '../../src/reader.js'
import { isRational, makeRational } from '../math/exact.js'
import { isCpx, makeComplex, cpxToString } from '../math/complex.js'
import {
  Flo, flo, isFlo, isNum, num, isExact, isInexact, isIntegerValued,
  toExact, toInexact, anyInexact, withExactness, numEq, numCmp, numEqv,
  numToString, asFraction, numeratorOf, denominatorOf, normExact, bigISqrt,
} from '../math/tower.js'
import { makeRecordType, makeRecord, isRecord } from '../std/_shared.js'
import { opaqueRepr } from '../../src/opaque-print.js'
import { apply, evaluate } from '../../src/interp.js'
// `load` runs a whole FILE, so it has to expand macros before it evaluates —
// `eval` alone would meet the first `define-syntax` in the file and stop.
import { expandProgram } from '../../src/macro.js'
// File ports (§6.13.1) and `load` (§6.14). Every path a Scheme program names
// is canonicalized through `safePath` first — the same sandbox every other
// file-touching verb in the engine already goes through, so opening a port
// cannot become the one door that traverses out of the allowed roots.
import { closeSync, existsSync, openSync, readFileSync, unlinkSync, writeSync } from 'node:fs'
import { dirname } from 'node:path'
import { safePath } from '../security/path-guard.js'
// One deep-equality walk for the whole engine. See the note at `_eqDeep`.
import { deepEqual } from '../../src/base.js'
import { isStr, str as _sstr, mstr } from './mutable-string.js'

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

import { NIL, arrayToList, isList, isListish, isNull, isPair, listLength, listToArray, seqVerb, toJS, toScheme } from './list.js'
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
  "call-with-input-file",
  "call-with-output-file",
  "call-with-port",
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
  "delete-file",
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
  "exit",
  "features",
  "file-error?",
  "file-exists?",
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
  "load",
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
  "open-binary-input-file",
  "open-binary-output-file",
  "open-input-bytevector",
  "open-input-file",
  "open-input-string",
  "open-output-bytevector",
  "open-output-file",
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
  "read-bytevector",
  "read-bytevector!",
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
  "with-input-from-file",
  "with-output-to-file",
  "write",
  "write-bytevector",
  "write-char",
  "write-shared",
  "write-simple",
  "write-string",
  "write-u8",
]
export const LAZY = false

export function installR7rsSmall(env, fuel) {
  // Sequence verbs take a list as a SEQUENCE and are wrapped at the cell
  // boundary so they keep receiving a JavaScript array. `_RAW` names the ones
  // whose meaning IS the cell — identity, sharing, or in-place mutation — and
  // those are installed untouched and written against the chain.
  const _RAW = new Set([
    'set-car!', 'set-cdr!', 'list?', 'list-copy', 'list-tail',
    // R7RS §6.4: memq/memv/assq/assv answer a SUBLIST of their argument — the
    // cell the match sits in — so they must see and return the caller's cells.
    'memq', 'memv', 'assq', 'assv',
    // list-set! writes into a cell.
    'list-set!',
    // The writers render the datum they were HANDED. Wrapped, the argument was
    // converted to a JavaScript array on the way in — and an array cannot
    // express a cycle, so `(write x)` on a circular x raised "circular list
    // passed to a verb that expects a proper list" before the datum-label pass
    // below ever ran. §6.13.3 requires `write` to LABEL that structure, not
    // refuse it. (These names are already raw in the `_RAW` sets of
    // `src/base.js` and `lib/std/r7rs-completions-core.js`; this installer was
    // the one still wrapping them.)
    'write', 'write-shared', 'write-simple', 'display',
    // `values` is a pass-through box: whatever it is handed comes back out
    // through let-values/call-with-values untouched. Wrapped, each value was
    // converted to a JavaScript array on the way IN — so `(values 'int '())`
    // bound an array-spelled empty list, which satisfies null?/list?/eq? but
    // is not NIL, and consing onto it built an improper chain.
    // call-with-values is raw for the same reason: it splices those values.
    'values', 'call-with-values',
    // `load` hands back whatever the loaded file's last form evaluated to.
    // Wrapped, that datum would be re-serialized on the way out — so a file
    // ending in a shared or circular structure would come back as something
    // other than what it built.
    'load',
  ])
  // The c[ad]+r family is raw too (`/^c[ad]{2,4}r$/` below): every one of them
  // is a chain of car/cdr steps, and a cdr step MUST hand back the interior
  // cell or `(eq? (cddr x) (cdr (cdr x)))` is #f.
  const def = (n, f, perm = 'read') =>
    env.define(n, _RAW.has(n) || /^c[ad]{2,4}r$/.test(n) ? f : seqVerb(f), { perm })

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

  // The irritant list is appended to the printed message, so passing the
  // offending value raw put a JS rendering in front of the learner:
  // `(vector-append (vector 1) (list 2 3))` reported "not a vector 2,3",
  // an Array.join with no meaning in Scheme. Name the value in house voice
  // instead, and stop repeating it as an irritant.
  const _vec = (who, v) => {
    if (!isVec(v)) throw new ErrorObject(`${who}: expected a vector, got ${_describeVal(v)}`)
    return v
  }
  const _bvec = (who, b) => {
    if (!(b instanceof Uint8Array)) throw new ErrorObject(`${who}: expected a bytevector, got ${_describeVal(b)}`)
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
    if (isStr(x)) return `the string ${JSON.stringify(_sstr(x))}`
    if (typeof x === 'boolean') return x ? '#t' : '#f'
    if (isNull(x)) return 'the empty list'
    if (isListish(x)) return 'a list'
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
    // No irritant: the printer appends it to the message, and the message
    // already names the index, so `(string-ref "ab" 9)` ended "…0 to 1 9"
    // with a stray 9 that reads like part of the range. src/base.js raises
    // a plain Error for the same check and prints clean; match it.
    if (len === 0) {
      throw new ErrorObject(`${op}: index ${k} is out of range — the ${what} is empty, so no index is valid`)
    }
    if (k < 0 || k >= len) {
      throw new ErrorObject(`${op}: index ${k} is out of range for a ${what} of length ${len}; valid indices are 0 to ${len - 1}`)
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

  // §6.2.1 states the implication `(real? x)` ⟹ `(complex? x)`. Motoi answers
  // #t to (real? +inf.0) and (real? +nan.0), and #t to (number? …) for both,
  // so the old `Number.isFinite` body broke that implication outright — and it
  // also denied Motoi's OWN complex values, making
  // `(complex? (make-rectangular 3 4))` #f. complex? is the top of the tower:
  // anything real? or number? says yes to, it says yes to.
  def('complex?', (x) => isNum(x) || _isCpx(x))
  // §6.2.6 — a Rational with denominator 1 IS an integer: (+ 1/2 1/2) is
  // the integer 1, held as a Rational. Both this and the (shadowing) copy at
  // lib/std/r7rs-completions-core.js now route through the one tower, so they
  // cannot drift apart: 3.0 is an integer but NOT an exact one.
  def('exact-integer?', (x) => isExact(x) && isIntegerValued(x))
  // §6.2.6 — a Rational is the paradigm exact rational.
  def('exact-rational?', (x) => isExact(x) && Number.isFinite(num(x)))

  // Floor and truncate quotient/remainder families (R7RS §6.2.6).
  // floor/ returns two values (quotient, remainder); truncate/ likewise.
  //
  // R7RS §6.2.6 makes a zero divisor an error. `/`, `quotient`, `modulo` and
  // `remainder` all route through src/base.js's `_ckNonZero` and raise; this
  // family bypassed it, so (floor/ 7 0) answered `+inf.0 +nan.0` — two verbs
  // in one language disagreeing about dividing by zero. Same message as `/`.
  const _nz = (op, b) => {
    if (num(b) === 0) throw new Error(`${op}: division by zero`)
    return num(b)
  }
  // §6.2.6: an inexact argument makes the result inexact, so
  // (truncate-quotient 17.0 3.0) is 5.0 and not 5.
  const floorQuotient  = (a, b) => withExactness([a, b], Math.floor(num(a) / _nz('floor-quotient', b)))
  const floorRemainder = (a, b) => withExactness([a, b], num(a) - Math.floor(num(a) / _nz('floor-remainder', b)) * num(b))
  const truncQuotient  = (a, b) => withExactness([a, b], Math.trunc(num(a) / _nz('truncate-quotient', b)))
  const truncRemainder = (a, b) => withExactness([a, b], num(a) - Math.trunc(num(a) / _nz('truncate-remainder', b)) * num(b))
  def('floor-quotient',   floorQuotient)
  def('floor-remainder',  floorRemainder)
  def('truncate-quotient',  truncQuotient)
  def('truncate-remainder', truncRemainder)
  def('floor/',    (a, b) => (_nz('floor/', b),    new Values([floorQuotient(a, b), floorRemainder(a, b)])))
  def('truncate/', (a, b) => (_nz('truncate/', b), new Values([truncQuotient(a, b), truncRemainder(a, b)])))

  // numerator / denominator (§6.2.6). Exact rationals (the {n,d} objects
  // from lib/math/exact.js) report their reduced parts; a plain integer
  // is its own numerator over denominator 1.
  def('numerator',   (x) => numeratorOf(x))
  def('denominator', (x) => denominatorOf(x))

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
    if (!isNum(x) || !Number.isFinite(num(x))) {
      throw new ErrorObject(`${who}: not a finite real number`, [x])
    }
    let v = num(x), e = 0
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
    // An infinite argument has no exact value, so the simplest-rational search
    // cannot run — but the answer is still defined. A tolerance of +inf.0
    // admits every rational, and 0 is the simplest of them; an infinite x with
    // a finite tolerance can only be itself.
    if (!Number.isFinite(num(x)) || !Number.isFinite(num(y))) {
      if (Number.isNaN(num(x)) || Number.isNaN(num(y))) return NaN
      if (!Number.isFinite(num(y))) return Number.isFinite(num(x)) ? flo(0) : NaN
      return x
    }
    const ex = _exactOf('rationalize', x)
    const ey = _exactOf('rationalize', y)
    const r = _simplest(_rSub(ex, ey), _rAdd(ex, ey))
    // §6.2.6: an inexact argument makes the result inexact — (rationalize 0.3
    // 1/10) is 0.3333…, not the exact 1/3 the simplest-rational search found.
    return withExactness([x, y], normExact(r.n, r.d))
  })

  // exact-integer-sqrt (§6.2.6). Returns (floor(sqrt(k)), k - floor(sqrt(k))^2)
  // as two values.
  def('exact-integer-sqrt', (k) => {
    if (!isExact(k) || !isIntegerValued(k) || num(k) < 0) {
      throw new ErrorObject('exact-integer-sqrt: expects an exact non-negative integer', [k])
    }
    // Newton on BigInt, not Math.sqrt: past 2^53 the double has already lost
    // the digits that decide the floor.
    const [n] = asFraction(k)
    const s = bigISqrt(n)
    return new Values([normExact(s, 1n), normExact(n - s * s, 1n)])
  })

  // Complex-number surface (§6.2.6). Motoi DOES have complex numbers —
  // lib/math/complex.js ships the complex/* library, and its values are
  // plain objects tagged with the shared Symbol.for('motoi:complex')
  // (the same tag src/base.js and src/cli.js format against). These
  // R7RS names operate on THOSE objects and on plain reals.
  //
  // Fixed 2026-08-02: real-part was the identity (so (real-part "hi")
  // answered "hi" and (real-part (complex/make 3 4)) answered 3+4i),
  // imag-part was the constant 0, magnitude was Math.abs (so
  // (magnitude (complex/make 3 4)) answered +nan.0 instead of 5),
  // angle's range was only {0, pi}, and make-rectangular / make-polar
  // always raised. All five were silently wrong on Motoi's own library.
  const _isCpx = isCpx
  const _mkCpx = makeComplex
  // Rectangular parts of any number (complex OR real), as JS doubles.
  const _cpxParts = (name, x) => {
    if (_isCpx(x)) return [Number(x.re), Number(x.im)]
    if (isNum(x)) return [num(x), 0]
    throw new ErrorObject(`${name}: expected a number, got ${_describeVal(x)}`, [x])
  }
  // A REAL argument as a JS double — rejects a complex, because the
  // constructors below take real components only.
  const _realArg = (name, x) => {
    if (_isCpx(x)) {
      throw new ErrorObject(`${name}: expected a real number, got a complex number`, [x])
    }
    if (!isNum(x)) {
      throw new ErrorObject(`${name}: expected a number, got ${_describeVal(x)}`, [x])
    }
    return x
  }
  def('make-rectangular', (re, im) =>
    _mkCpx(_realArg('make-rectangular', re), _realArg('make-rectangular', im ?? 0)))
  // §6.2.5: polar goes through a transcendental, so the result is inexact even
  // when both arguments were exact.
  def('make-polar', (mag, ang) => {
    const m = num(_realArg('make-polar', mag))
    const a = num(_realArg('make-polar', ang ?? 0))
    return _mkCpx(flo(m * Math.cos(a)), flo(m * Math.sin(a)))
  })
  // real-part / imag-part on a real number are the real number and 0;
  // on a complex they are its two components.
  def('real-part', (x) => {
    if (_isCpx(x)) return x.re
    _cpxParts('real-part', x)   // validate — a non-number is an error, not an answer
    return x                    // a real is its own real part (keeps a rational exact)
  })
  def('imag-part', (x) => _isCpx(x) ? x.im : (_cpxParts('imag-part', x), 0))
  def('magnitude', (x) => {
    const [re, im] = _cpxParts('magnitude', x)
    // On a REAL argument magnitude IS abs, and abs is exact-preserving — going
    // through `_cpxParts`' double flattened `(magnitude 1/2)` to 0.5.
    if (!_isCpx(x)) {
      if (isExact(x)) { const [n, d] = asFraction(x); return normExact(n < 0n ? -n : n, d) }
      return flo(Math.abs(re))
    }
    // Exactness is decided by the COMPONENTS, not by the complex object that
    // carries them — `withExactness([x], …)` saw a `Cpx`, called it exact, and
    // answered `5` for `(magnitude (make-rectangular 3.0 4.0))` where §6.2.2's
    // contagion rule (and chibi) say `5.0`.
    return withExactness([x.re, x.im], im === 0 ? Math.abs(re) : Math.hypot(re, im))
  })
  // §6.2.6 transcendental: always inexact, so (angle 1.0) is 0.0.
  def('angle', (x) => {
    const [re, im] = _cpxParts('angle', x)
    return flo(Math.atan2(im, re))
  })

  // ── §6.4 Pairs and lists (missing pieces) ───────────────────────────

  // memq / memv / member with optional comparator (R7RS §6.4).
  // memq uses eq?, memv uses eqv?, member uses equal? or the supplied
  // predicate. Motoi's eq/eqv/equal all collapse to _eqQ (see base.js);
  // we honor the three names for spec compliance.
  const _eqStrict = (a, b) => a === b
  // The walk over pairs and vectors — and the stop that keeps it from running
  // forever on a circular structure (R7RS §6.1 requires `equal?` to terminate
  // on one) — is `deepEqual` in src/base.js, shared with the `equal?` this file
  // is the companion to. Only the LEAF test is spelled here.
  //
  // It used to be a private copy of the whole walk, and a private copy is how
  // the two drifted: the copy in base.js was fixed for the isList trap and this
  // one was fixed separately, which is exactly the shape of divergence that
  // ends with `equal?` terminating in one file and hanging in the other.
  const _eqDeep = (a, b) => deepEqual(a, b, (x, y) => {
    if (x instanceof Sym && y instanceof Sym) return x.name === y.name
    if (x instanceof Ch && y instanceof Ch)   return x.value === y.value
    return false
  })
  // §6.4: a successful search answers the SUBLIST — the cell holding the match
  // — so `(eq? (memq 2 x) (cdr x))` is #t and `(set-car! (memq 2 x) 9)` writes
  // through into x. Returning a slice broke both silently.
  const _memWalk = (lst, hit) => {
    if (!isListish(lst)) return false
    for (let p = toScheme(lst); p instanceof Pair; p = p.cdr) if (hit(p.car)) return p
    return false
  }
  def('memq', (x, lst) => {
    // memq compares with eq?. Symbols compare by name.
    const eq = (a, b) => {
      if (a === b) return true
      if (a instanceof Sym && b instanceof Sym) return a.name === b.name
      if (a instanceof Ch && b instanceof Ch) return a.value === b.value
      // Motoi binds `eq?` to `eqv?` (see src/base.js), so memq has to see a
      // number the same way — an inexact integer is a heap-allocated `Flo`
      // that `===` cannot see through, and memq would say #f where eq? says #t.
      if (isNum(a) && isNum(b)) return numEqv(a, b)
      return false
    }
    return _memWalk(lst, (y) => eq(x, y))
  })
  // `eqv?` as R7RS §6.1 defines it, for the two verbs (§6.3) that are specified
  // in terms of it. Until 2026-08-02 memv and assv were byte-for-byte copies of
  // memq/assq — identity plus a name/char check — so they compared by LOCATION
  // where the standard requires numeric value. Every number Motoi stores off the
  // JS stack therefore missed: `(memv 1/2 '(1/3 1/2))` and `(assv 1/2 ...)` both
  // answered #f, because an exact rational and a complex are heap objects and
  // two equal ones are never `===`. Silently answering "not in the list" for a
  // key that IS in the list is the worst shape of wrong.
  //
  // Deliberately matches src/base.js's `eqv?` on the exactness rule: an exact
  // 4/2 IS eqv? to the integer 2, an exact 1/2 is NOT eqv? to the inexact 0.5.
  const _ratOf = (x) => {
    if (isRational(x)) return x
    if (typeof x === 'number' && Number.isInteger(x)) return makeRational(BigInt(x), 1n)
    return null   // an inexact number, or not a number at all
  }
  const _eqvVal = (a, b) => {
    if (a === b) return true
    if (a == null || b == null) return false
    if (a instanceof Sym && b instanceof Sym) return a.name === b.name
    if (a instanceof Ch && b instanceof Ch) return a.value === b.value
    // Every number through the one tower comparison — equal value AND equal
    // exactness. An inexact integer is a heap-allocated `Flo`, so `===` said
    // #f for `(eqv? 7.0 7.0)` and memv/assv/case inherited the wrong answer.
    if (isNum(a) && isNum(b)) return numEqv(a, b)
    // §6.1: there is only ONE empty list. Motoi spells it as a JS array and
    // every `'()` allocates a fresh one, so `===` misses it.
    if (isListish(a) || isListish(b)) {
      return isNull(a) && isNull(b)
    }
    // Exact rationals are heap objects; makeRational keeps lowest terms with
    // d > 0, so equal n/d IS equal value.
    if (isRational(a) || isRational(b)) {
      const ra = _ratOf(a), rb = _ratOf(b)
      if (ra === null || rb === null) return false
      return ra.n === rb.n && ra.d === rb.d
    }
    // Complex numbers are heap objects too, and both components are doubles —
    // two inexact complexes of the same value are numerically equal, hence eqv?.
    if (_isCpx(a) || _isCpx(b)) {
      return _isCpx(a) && _isCpx(b) && a.re === b.re && a.im === b.im
    }
    return false
  }
  def('memv', (x, lst) => _memWalk(lst, (y) => _eqvVal(x, y)))
  // Alist entries may be either shape: a proper list `(k v)` or a real
  // dotted pair `(k . v)` from `(cons k v)`. Match on both, or every
  // cons-built alist silently looks up as empty.
  //
  // `isList` used to stand in for "array-spelled entry" here, and it answers #t
  // for `NIL` too — so `()` sitting in an alist counted as an ENTRY whose key
  // was `NIL[0]`, i.e. `undefined`. Nothing in Scheme is `eq?` to `undefined`,
  // so the wrong reading happened to give the right answer; it was one
  // `eq`-implementation away from matching a key it must never match. R7RS
  // §6.4 says an alist is a list of PAIRS, and `()` is not one.
  const _entryKey = (p) => (p instanceof Pair ? p.car : Array.isArray(p) && p.length > 0 ? p[0] : undefined)
  const _isEntry = (p) => p instanceof Pair || (Array.isArray(p) && p.length > 0)
  // assq/assv answer the ENTRY cell, so `(set-cdr! (assq k a) v)` — the
  // canonical alist update — reaches the alist rather than a discarded copy.
  const _assWalk = (alist, hit) => {
    if (!isListish(alist)) return false
    for (let p = toScheme(alist); p instanceof Pair; p = p.cdr) {
      if (_isEntry(p.car) && hit(_entryKey(p.car))) return p.car
    }
    return false
  }
  def('assq', (key, alist) => {
    const eq = (a, b) => a === b || (a instanceof Sym && b instanceof Sym && a.name === b.name) || (a instanceof Ch && b instanceof Ch && a.value === b.value)
    return _assWalk(alist, (k) => eq(k, key))
  })
  // assv compares keys with eqv? (§6.3) — see _eqvVal above.
  def('assv', (key, alist) => _assWalk(alist, (k) => _eqvVal(k, key)))

  // list-set! — mutates the underlying JS array (which IS our pair-list
  // storage; decision-006 forbids set-car! / set-cdr! on individual cells
  // but list-set! is R7RS-standard for vectors of list shape).
  //
  // BOUNDS (§6.4): "It is an error if k is not a valid index of list." This
  // wrote through `lst[k | 0]` with no range check, so `(list-set! '(1 2 3) 5 'x)`
  // GREW the list to six slots padded with truthy non-values, and — worse —
  // `(list-set! '() 0 'x)` wrote into the SHARED `'()` literal, after which
  // `(null? '())` answered #f for the rest of the process. `vector-set!` above
  // raises on exactly this mistake; checked here through the same _ckIndex, so
  // both report it the same way. A length-0 list has no valid index at all, so
  // the empty-list literal can no longer be reached, let alone mutated.
  def('list-set!', (lst, k, v) => {
    if (!isListish(lst)) throw new ErrorObject('list-set!: not a list', [lst])
    const head = toScheme(lst)
    _ckIndex('list-set!', k, listLength(head), 'list')
    let p = head
    for (let i = 0; i < k; i++) p = p.cdr
    p.car = v
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
  //
  // BOUNDS (§6.4): every step of a c[ad]+r is a `car` or a `cdr`, and each one
  // "is an error" when its argument is not a pair. Until 2026-08-02 a bad step
  // did `return undefined` instead. JS `undefined` is a TRUTHY NON-VALUE here:
  // it prints as nothing, survives an `if`, and answers #f to `number?` rather
  // than failing — so `(caar '(1 2))` handed back a blank that travelled on and
  // surfaced somewhere unrelated, and `(cdddr '(1))` answered `()` as though
  // the list had simply run out. base.js's cadr/caddr already raise (via
  // _asPair); this family now raises with the SAME wording, and blames the
  // verb the learner actually typed rather than the inner car or cdr.
  //
  // THE EMPTY LIST is checked on its own line, before the array case, and it
  // has to be: `isList` answers #t for `NIL`, and `NIL.length === 0` is
  // `undefined === 0`, which is FALSE — so `'()` cleared a guard written to
  // stop exactly it. `(cddr '())` then reached `NIL.slice(1)` and leaked
  // `x.slice is not a function`, a JavaScript method name shown to someone who
  // has never seen JavaScript, and `(caar '())` walked one step further on an
  // `undefined` before blaming the wrong argument.
  const _c = (name, lst, ops) => {
    let x = lst
    for (const op of ops) {
      if (x instanceof Pair) { x = op === 'a' ? x.car : x.cdr; continue }
      if (isNull(x) || !Array.isArray(x) || x.length === 0) {
        throw new ErrorObject(
          `${name}: expected a pair or a non-empty list, got ${_describeVal(x)}`, [x])
      }
      if (op === 'a') x = x[0]
      else x = x.slice(1)
    }
    return x
  }
  // 2-deep (base.js already has cadr).
  def('caar', (l) => _c('caar', l, ['a','a']))
  def('cdar', (l) => _c('cdar', l, ['a','d']))
  def('cddr', (l) => _c('cddr', l, ['d','d']))
  // 3-deep (base.js already has caddr).
  def('caaar', (l) => _c('caaar', l, ['a','a','a']))
  def('caadr', (l) => _c('caadr', l, ['d','a','a']))
  def('cadar', (l) => _c('cadar', l, ['a','d','a']))
  def('cdaar', (l) => _c('cdaar', l, ['a','a','d']))
  def('cdadr', (l) => _c('cdadr', l, ['d','a','d']))
  def('cddar', (l) => _c('cddar', l, ['a','d','d']))
  def('cdddr', (l) => _c('cdddr', l, ['d','d','d']))
  // 4-deep — full set.
  def('caaaar', (l) => _c('caaaar', l, ['a','a','a','a']))
  def('caaadr', (l) => _c('caaadr', l, ['d','a','a','a']))
  def('caadar', (l) => _c('caadar', l, ['a','d','a','a']))
  def('caaddr', (l) => _c('caaddr', l, ['d','d','a','a']))
  def('cadaar', (l) => _c('cadaar', l, ['a','a','d','a']))
  def('cadadr', (l) => _c('cadadr', l, ['d','a','d','a']))
  def('caddar', (l) => _c('caddar', l, ['a','d','d','a']))
  def('cadddr', (l) => _c('cadddr', l, ['d','d','d','a']))
  def('cdaaar', (l) => _c('cdaaar', l, ['a','a','a','d']))
  def('cdaadr', (l) => _c('cdaadr', l, ['d','a','a','d']))
  def('cdadar', (l) => _c('cdadar', l, ['a','d','a','d']))
  def('cdaddr', (l) => _c('cdaddr', l, ['d','d','a','d']))
  def('cddaar', (l) => _c('cddaar', l, ['a','a','d','d']))
  def('cddadr', (l) => _c('cddadr', l, ['d','a','d','d']))
  def('cdddar', (l) => _c('cdddar', l, ['a','d','d','d']))
  def('cddddr', (l) => _c('cddddr', l, ['d','d','d','d']))

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
  // R7RS §6.6 defines these against Unicode general categories, not ASCII.
  // The ASCII ranges these used to test made (char-alphabetic? #\é) answer
  // #f, so every accented name in a roster classified as punctuation and
  // strip-non-alpha quietly deleted it. Unicode property escapes are the
  // direct spelling of what the standard asks for.
  def('char-alphabetic?',  (c) => /^\p{Alphabetic}$/u.test(_asCh(c)))
  def('char-numeric?',     (c) => /^\p{Nd}$/u.test(_asCh(c)))
  def('char-whitespace?',  (c) => /^\s$/u.test(_asCh(c)))
  def('char-upper-case?',  (c) => /^\p{Uppercase}$/u.test(_asCh(c)))
  def('char-lower-case?',  (c) => /^\p{Lowercase}$/u.test(_asCh(c)))
  // §6.6: digit-value answers for EVERY Unicode decimal digit, not just ASCII
  // — `(digit-value #\x0664)` (Arabic-Indic four) is 4. It used to answer #f
  // for all of them. Every Nd block is ten consecutive code points starting at
  // its own zero, so walking back to that zero gives the value directly.
  def('digit-value', (c) => {
    const v = _asCh(c)
    if (v >= '0' && v <= '9') return v.charCodeAt(0) - 48
    if (!/^\p{Nd}$/u.test(v)) return false
    const cp = v.codePointAt(0)
    for (let d = 0; d <= 9; d++) {
      if (!/^\p{Nd}$/u.test(String.fromCodePoint(cp - d))) return false
      if (d === 9 || !/^\p{Nd}$/u.test(String.fromCodePoint(cp - d - 1))) return d
    }
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
  // §6.7 specifies FULL Unicode case folding, which is not `toLowerCase`:
  // folding may lengthen the string (ß → ss) and must never emit a
  // context-sensitive form (final sigma ς folds to plain σ). JS ships no
  // case-folding primitive, so the length-changing and context-sensitive
  // entries of CaseFolding.txt are applied here on top of toLowerCase.
  // This is the F+C subset that differs from lowercasing, not all 1,500 rows.
  const _FOLD = new Map(Object.entries({
    'ß': 'ss', 'ﬀ': 'ff', 'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬃ': 'ffi', 'ﬄ': 'ffl',
    'ﬅ': 'st', 'ﬆ': 'st', 'ς': 'σ', 'ſ': 's', 'ﬗ': 'մխ', 'ﬖ': 'վն',
    'ﬔ': 'մն', 'ﬕ': 'մե', 'ﬓ': 'մն', 'ŉ': 'ʼn', 'ǰ': 'ǰ', 'ΐ': 'ΐ', 'ΰ': 'ΰ',
  }))
  const _foldcase = (s) => {
    let out = ''
    for (const c of s.toLowerCase()) out += _FOLD.get(c) ?? c
    return out
  }
  def('string-foldcase', (s) => {
    if (!isStr(s)) throw new Error(`string-foldcase: expected a string, got ${_describe(s)}`)
    return _foldcase(_sstr(s))
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
    if (!isStr(s)) throw new ErrorObject('string->vector: not a string', [s])
    const t = _sstr(s)
    const [a, b] = _range('string->vector', start, end, t.length)
    return mkVec(t.slice(a, b).split('').map((c) => ch(c)))
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
  //
  // The optional [start [end]] used to be `start || 0` + a raw JS slice,
  // which gave a negative start the JS "from the end" meaning R7RS §6.7
  // does not have, and let a float or a past-the-end index through. Route
  // it through _range like every other member of the family (2026-08-02).
  def('string->list', (s, start, end) => {
    const t = _sstr(s)
    const [a, b] = _range('string->list', start, end, t.length)
    return t.slice(a, b).split('').map((c) => ch(c))
  })
  // §6.7 calls this result "newly allocated" — mutable. See mutable-string.js.
  def('list->string', (lst) => {
    // Two defects in one line. The guard was `if (!isList(lst)) return mstr('')`
    // — so `(list->string 5)` answered `""`, a plausible-looking value where
    // R7RS §6.7 requires an error (chibi: "improper list: 5"). A wrong answer
    // that LOOKS right is the worst kind here; the learner copies it. And the
    // guard that let it through is the `isList` trap: `isList` also says #t to
    // a cell chain and to `NIL`, neither of which has `.map`.
    if (!isListish(lst)) {
      throw new ErrorObject(`list->string: expected a list of characters, got ${_describeVal(lst)}`, [lst])
    }
    const items = Array.isArray(lst) ? lst : listToArray(lst)
    return mstr(items.map((c) => c instanceof Ch ? c.value : String(c)).join(''))
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
    if (!isStr(s)) {
      throw new ErrorObject(`string-ref: expected a string, got ${_describeVal(s)}`, [s])
    }
    const t = _sstr(s)
    return ch(t.charAt(_ckIndex('string-ref', i, t.length, 'string')))
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
  // vector->list / vector-fill! / vector-copy all take an optional
  // [start [end]] in R7RS §6.8. Until 2026-08-02 `vector->list` took NO
  // range arguments at all (lib/std/r7rs-completions-core.js binds the
  // 1-argument version; this file installs later and wins), so
  // `(vector->list '#(dah dah didah) 1 2)` silently answered the WHOLE
  // vector instead of one element — the extra arguments were dropped by
  // JS, not rejected. `vector-fill!` and `vector-copy` did honor the
  // range but with `| 0` / `|| 0`, which truncates a float index, wraps
  // past 2^31, and hands a negative straight to JS `slice` (where it
  // means "from the end", a reading R7RS does not have). All three now
  // route through _range, so an out-of-range request is an error rather
  // than a plausible wrong answer.
  def('vector->list', (v, start, end) => {
    const items = _vec('vector->list', v).items
    const [a, b] = _range('vector->list', start, end, items.length)
    return items.slice(a, b)
  })
  def('vector-fill!', (v, val, start, end) => {
    const items = _vec('vector-fill!', v).items
    const [a, b] = _range('vector-fill!', start, end, items.length)
    for (let i = a; i < b; i++) items[i] = val
    return undefined
  })
  def('vector-copy', (v, start, end) => {
    const items = _vec('vector-copy', v).items
    const [a, b] = _range('vector-copy', start, end, items.length)
    return mkVec(items.slice(a, b))
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
  // R7RS §6.9 requires a bytevector and a valid index. All three used to
  // answer instead of refusing: a non-bytevector had length 0, an
  // out-of-range read handed back the unspecified value (which is truthy
  // and flows on), and an out-of-range write was dropped without a word —
  // `(bytevector-u8-set! b 9 5)` on a 3-byte vector left it unchanged and
  // reported success. Vectors and strings already bounds-check here.
  def('bytevector-length', (b) => _bvec('bytevector-length', b).length)
  def('bytevector-u8-ref', (b, i) => {
    const bv = _bvec('bytevector-u8-ref', b)
    return bv[_ckIndex('bytevector-u8-ref', i, bv.length, 'bytevector')]
  })
  def('bytevector-u8-set!', (b, i, v) => {
    const bv = _bvec('bytevector-u8-set!', b)
    bv[_ckIndex('bytevector-u8-set!', i, bv.length, 'bytevector')] = v & 0xff
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
  // WINDERS is the one seam between this verb and `guard` (src/interp.js).
  // R7RS §4.2.7 says a guard whose clauses ALL fail re-raises the condition
  // "within the dynamic environment of the original call to raise" — i.e.
  // control goes back INTO the body's extent to re-raise. By the time the
  // condition reaches the guard, the `finally` below has already run `after`
  // and that extent is gone, and Motoi has no full continuations
  // (decision-004) to jump back into it. So each dynamic-wind that an
  // exception passes through leaves its before/after pair on the condition;
  // `guard` replays them to rebuild the extent before re-raising. A Symbol
  // key keeps this off Object.keys/JSON and out of author-visible data.
  const WINDERS = Symbol.for('motoi.guard.winders')
  def('dynamic-wind', (before, thunk, after) => {
    apply(before, [], fuel)
    try {
      return apply(thunk, [], fuel)
    } catch (e) {
      // A continuation escape is control flow, not a condition — it is not
      // re-raised by a guard, so recording winders on it would replay
      // before/after thunks that must run exactly once.
      if (!(e instanceof _EscapeSignal) && e !== null && typeof e === 'object' &&
          Object.isExtensible(e)) {
        const ws = e[WINDERS]
        if (ws) ws.push({ before, after })
        else e[WINDERS] = [{ before, after }]
      }
      throw e
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

  // The stack of handlers installed by with-exception-handler. It exists so
  // `raise-continuable` can do the one thing a thrown exception cannot: come
  // back. §6.11 says raise-continuable CALLS the current handler and returns
  // its value TO THE RAISE POINT, so `(+ (raise-continuable "x") 23)` sees the
  // handler's answer and goes on to add 23. Mapping it onto `raise` unwound the
  // stack instead, and the whole expression collapsed to the handler's value.
  const _handlers = []

  // The handler runs with ITSELF removed from the stack, so a handler that
  // raises again reaches the next one out rather than looping on itself.
  def('raise-continuable', (v) => {
    if (_handlers.length === 0) throw v instanceof Error ? v : new _RaisedValue(v)
    const h = _handlers.pop()
    try { return apply(h, [v], fuel) } finally { _handlers.push(h) }
  })

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
  def('error-object-irritants',   (e) => (e && isList(e._errorIrritants)) ? e._errorIrritants : [])
  // error-object-type reads the NAME `escalate` put on a condition, and
  // answers `error` for a condition that carries no name. It must not
  // answer `error` for a value that is not a condition at all — before
  // 2026-08-02 (error-object-type 42) answered `error`, which told a
  // handler that a bare number was an error condition.
  const _isCondition = (e) =>
    e instanceof Error || (e != null && typeof e === 'object' && e._isErrorObject === true)
  def('error-object-type',        (e) => {
    if (!_isCondition(e)) {
      throw new ErrorObject(
        `error-object-type: expected a condition, got ${_describeVal(e)}`, [e])
    }
    return e._errorType ? sym(e._errorType) : sym('error')
  })
  def('read-error?',              (e) => e && e.name === 'ReadError')
  // file-error? (§6.11). Before 2026-08-02 this was hardcoded #f, so it
  // could never identify a file error at all. It now answers #t
  // for (a) a condition explicitly named as a file condition — the
  // portable `(escalate 'file-error path)` route — and (b) a Node
  // filesystem error, which carries an fs errno plus a syscall/path.
  const _FS_ERRNO = new Set([
    'EACCES', 'EBADF', 'EBUSY', 'EEXIST', 'EFBIG', 'EIO', 'EISDIR', 'ELOOP',
    'EMFILE', 'ENAMETOOLONG', 'ENFILE', 'ENOENT', 'ENOSPC', 'ENOTDIR',
    'ENOTEMPTY', 'EPERM', 'EROFS', 'EXDEV',
  ])
  def('file-error?',              (e) => {
    if (e == null || typeof e !== 'object') return false
    if (e._errorType === 'file-error' || e._errorType === 'file') return true
    return typeof e.code === 'string' && _FS_ERRNO.has(e.code) &&
      (e.syscall !== undefined || e.path !== undefined)
  })

  // with-exception-handler — installs a handler, runs a thunk, restores
  // the handler on exit. If the thunk raises, the handler is called with the
  // raised value.
  //
  // §6.11: a `raise` is NON-CONTINUABLE. The handler is called, and if it
  // RETURNS, a secondary exception is raised in the same dynamic environment
  // as the handler — the handler's value does NOT become the value of
  // with-exception-handler. Motoi returned it until 2026-08-03, which made
  // `raise` behave exactly like `raise-continuable` and silently swallowed a
  // condition the program had no way to continue from. Reach for
  // `raise-continuable` (whose handler value DOES come back to the raise
  // point) or for `guard` (which unwinds to a chosen answer) instead.
  def('with-exception-handler', (handler, thunk) => {
    _handlers.push(handler)
    let raised
    try {
      return apply(thunk, [], fuel)
    } catch (e) {
      // A continuation escape is control flow, not a condition.
      if (e instanceof _EscapeSignal) throw e
      raised = e
    } finally {
      // Popped before the handler runs: §6.11 calls a handler with itself
      // removed, so a handler that raises again reaches the next one out.
      _handlers.pop()
    }
    const v = raised instanceof _RaisedValue ? raised.value : raised
    apply(handler, [v], fuel)
    throw new ErrorObject(
      'with-exception-handler: the handler returned, but the condition was raised with `raise`, which cannot be continued',
      [v], 'error')
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
  // Closing a port that holds a file descriptor must give the descriptor back
  // to the operating system — a program that opens files in a loop otherwise
  // runs out of them, and the failure lands nowhere near the mistake. §6.13.1
  // makes closing an already-closed port a no-op, so `_fd` is cleared rather
  // than merely used, and every close path in this file routes through here.
  const _shut = (p) => {
    if (!(p instanceof Port)) return undefined
    if (p.open && p._fd !== undefined) {
      try { closeSync(p._fd) } catch { /* already gone; closing twice is not an error */ }
      p._fd = undefined
    }
    p.open = false
    return undefined
  }
  def('close-port',         (p) => _shut(p))
  def('close-input-port',   (p) => (p instanceof Port && p.mode === 'input')  ? _shut(p) : undefined)
  def('close-output-port',  (p) => (p instanceof Port && p.mode === 'output') ? _shut(p) : undefined)
  // call-with-port (§6.13.1). Was simply unbound (2026-08-02), which made
  // the standard's idiomatic way of reading a string port unreachable —
  // Chibi's `read-line` tests all go through it. §6.13.1: "calls proc with
  // port as an argument. If proc returns, then the port is closed
  // automatically and the values yielded by proc are returned." The port
  // is NOT closed if proc escapes non-locally, so the close is deliberately
  // not in a `finally`: the standard leaves an escaping port open so a
  // continuation can re-enter it.
  def('call-with-port', (p, proc) => {
    if (!(p instanceof Port)) throw new ErrorObject('call-with-port: not a port', [p])
    const r = apply(proc, [p], fuel)
    _shut(p)
    return r
  })

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

  // ── file ports (§6.13.1) + `load` (§6.14) ──────────────────────────
  //
  // decision-010 deferred all of these — "Motoi has no file ports." That
  // was a scope call, not a conformance argument, and it cost 13 verbs the
  // standard requires: three drops plus three cascading failures in
  // Larceny's base.sld, and four failures in chibi's. Struck 2026-08-03.
  //
  // Every filename a Scheme program hands in is canonicalized by
  // `safePath` before it reaches the filesystem, so the sandbox that
  // already covers every other file-touching verb covers these too: no
  // traversal out of cwd / ~/.motoi / ~/motoi, no symlink escape, no null
  // bytes. That guard is the reason a file port can exist here at all.
  //
  // Permissions follow what a verb can DO, not what it is called. Reading
  // an arbitrary path can exfiltrate a secret, so the readers sit in
  // `personal-data` alongside `get-environment-variable`. Opening for
  // output TRUNCATES whatever was there and `delete-file` removes it, so
  // those are `destructive`. §6.11 says a filesystem failure raises an
  // object satisfying `file-error?`; `_fileError` is the one constructor
  // for that, so no path can raise something a `guard` clause can't name.
  const _fileError = (who, msg, path) =>
    new ErrorObject(`${who}: ${msg}`, [path === undefined ? '' : String(path)], 'file-error')

  const _filename = (who, p) => {
    if (!isStr(p)) throw new ErrorObject(`${who}: expected a filename string`, [p])
    try {
      return safePath(String(p), { verb: who })
    } catch (e) {
      throw _fileError(who, e && e.message ? String(e.message).replace(`${who}: `, '') : 'refused', p)
    }
  }

  const _openIn = (who, name, kind) => {
    const abs = _filename(who, name)
    let data
    try {
      data = kind === 'binary' ? readFileSync(abs) : readFileSync(abs, 'utf8')
    } catch (e) {
      throw _fileError(who, `cannot open '${String(name)}' for input (${e && e.code ? e.code : 'failed'})`, name)
    }
    const port = new Port(kind, 'input', kind === 'binary' ? new Uint8Array(data) : data)
    port._file = abs
    return port
  }

  const _openOut = (who, name, kind) => {
    const abs = _filename(who, name)
    let fd
    try {
      fd = openSync(abs, 'w')
    } catch (e) {
      throw _fileError(who, `cannot open '${String(name)}' for output (${e && e.code ? e.code : 'failed'})`, name)
    }
    const port = new Port(kind, 'output', null)
    port._file = abs
    port._fd = fd
    return port
  }

  def('open-input-file',         (name) => _openIn('open-input-file', name, 'textual'),         'personal-data')
  def('open-binary-input-file',  (name) => _openIn('open-binary-input-file', name, 'binary'),   'personal-data')
  def('open-output-file',        (name) => _openOut('open-output-file', name, 'textual'),       'destructive')
  def('open-binary-output-file', (name) => _openOut('open-binary-output-file', name, 'binary'), 'destructive')

  // §6.13.1: call-with-*-file opens the port, calls proc with it, and
  // closes it when proc RETURNS. As with `call-with-port` the close is
  // deliberately not in a `finally` — the standard leaves the port open
  // when proc escapes non-locally, so a continuation can re-enter it.
  const _callWithFile = (who, open) => (name, proc) => {
    const p = open(name)
    const r = apply(proc, [p], fuel)
    _shut(p)
    return r
  }
  def('call-with-input-file',
    _callWithFile('call-with-input-file', (n) => _openIn('call-with-input-file', n, 'textual')),
    'personal-data')
  def('call-with-output-file',
    _callWithFile('call-with-output-file', (n) => _openOut('call-with-output-file', n, 'textual')),
    'destructive')

  // §6.13.1: with-*-from/to-file rebinds the CURRENT port for the dynamic
  // extent of a thunk that takes no arguments — the thunk reads and writes
  // with no port argument at all. The port is closed and the parameter
  // restored on the way out, including when the thunk raises, which is why
  // these two DO use `finally`: leaving current-output-port pointing at a
  // dead file port would break every later `display` in the program.
  const _withFile = (who, open, param) => (name, thunk) => {
    const p = open(name)
    param.push(p)
    try {
      return apply(thunk, [], fuel)
    } finally {
      param.pop()
      _shut(p)
    }
  }
  def('with-input-from-file',
    _withFile('with-input-from-file', (n) => _openIn('with-input-from-file', n, 'textual'), currentInput),
    'personal-data')
  def('with-output-to-file',
    _withFile('with-output-to-file', (n) => _openOut('with-output-to-file', n, 'textual'), currentOutput),
    'destructive')

  // §6.14. `file-exists?` answers a BOOLEAN, so a path the sandbox refuses
  // answers #f rather than raising — refusing to look is indistinguishable
  // from not finding, and the standard gives no way to report the third
  // case. `delete-file` has no such out: §6.14 says it is an error if the
  // file cannot be deleted, so it raises.
  def('file-exists?', (name) => {
    if (!isStr(name)) throw new ErrorObject('file-exists?: expected a filename string', [name])
    const abs = safePath(String(name), { verb: 'file-exists?', softFail: true })
    return abs === null ? false : existsSync(abs)
  }, 'personal-data')
  def('delete-file', (name) => {
    const abs = _filename('delete-file', name)
    try {
      unlinkSync(abs)
    } catch (e) {
      throw _fileError('delete-file', `cannot delete '${String(name)}' (${e && e.code ? e.code : 'failed'})`, name)
    }
    return undefined
  }, 'destructive')

  // §6.14 `load`. The optional second argument is an environment specifier;
  // Motoi has one substrate environment and `(environment …)` hands back a
  // child of it, so a supplied environment is honoured as the frame the
  // file's definitions land in. Macros are expanded first: `eval` alone
  // would meet the file's first `define-syntax` and have nothing to do
  // with it. Each form is evaluated in order and the value of the last one
  // is returned, which is more than the standard promises (it says the
  // result is unspecified) and is what makes `load` usable at a REPL.
  def('load', (name, environment) => {
    const abs = _filename('load', name)
    let src
    try {
      src = readFileSync(abs, 'utf8')
    } catch (e) {
      throw _fileError('load', `cannot read '${String(name)}' (${e && e.code ? e.code : 'failed'})`, name)
    }
    const target = (environment && typeof environment === 'object' && 'vars' in environment)
      ? environment : env
    // baseDir is the loaded file's own directory, so an `include` written
    // inside it resolves relative to itself rather than to wherever the
    // process happened to be started.
    const { forms } = expandProgram(parse(src), { fuel, baseDir: dirname(abs) })
    let result
    for (const f of forms) result = evaluate(f, target, fuel)
    return result
  }, 'personal-data')

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
  // A Scheme character is a CODE POINT, but a JS string indexes UTF-16 code
  // UNITS, so `charAt` cuts an astral character (U+10000 and up) in half and
  // hands back a lone surrogate. Reading back the three code points of
  // `(string #\x10F700 #\x10F701 #\x10F702)` produced six broken halves.
  const _cpAt = (s, i) => {
    const cp = s.codePointAt(i)
    return cp > 0xFFFF ? s.slice(i, i + 2) : s.charAt(i)
  }
  def('read-char', (port) => {
    const p = _inPort('read-char', port, 'textual')
    if (p.pos >= p.backing.length) return EOF
    const c = _cpAt(p.backing, p.pos)
    p.pos += c.length
    return ch(c)
  })
  def('peek-char', (port) => {
    const p = _inPort('peek-char', port, 'textual')
    if (p.pos >= p.backing.length) return EOF
    return ch(_cpAt(p.backing, p.pos))
  })
  def('read-line', (port) => {
    const p = _inPort('read-line', port, 'textual')
    if (p.pos >= p.backing.length) return EOF
    const start = p.pos
    // §6.13.2 ends a line at a linefeed, a RETURN, or a return/linefeed pair —
    // not at linefeed alone. Only `\n` was recognised, so a file with classic
    // Mac endings came back as one enormous line and a CRLF file kept a
    // trailing `\r` on every line.
    while (p.pos < p.backing.length) {
      const c = p.backing.charAt(p.pos)
      if (c === '\n' || c === '\r') break
      p.pos++
    }
    const line = p.backing.slice(start, p.pos)
    if (p.backing.charAt(p.pos) === '\r') p.pos++
    if (p.backing.charAt(p.pos) === '\n') p.pos++
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
    // Walk to the token index just past the first complete datum. `#;` does not
    // end the scan — it means one MORE datum has to be consumed before this
    // call has a value to return, which is why `read` needs a counter and not
    // just a depth. `#; abc def` returns `def`.
    let i = 0, depth = 0, need = 1
    for (; i < toks.length; i++) {
      const t = toks[i].t
      if (t === '#;') { need++; continue }
      if (_PREFIXES.has(t)) continue          // a prefix never completes a datum
      if (typeof t === 'string' && /^#\d+=$/.test(t)) continue   // a label prefixes its datum
      if (_OPENERS.has(t)) { depth++; continue }
      if (t === ')') {
        depth--
        if (depth <= 0) { depth = 0; if (--need === 0) { i++; break } }
        continue
      }
      if (depth === 0 && --need === 0) { i++; break }   // a bare atom is a whole datum
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
    // One printer for the whole tower (lib/math/tower.js), so an inexact
    // integer shows its point — `1.0`, not `1` — and cannot read back exact.
    if (typeof v === 'number' || typeof v === 'bigint' || isFlo(v)) return numToString(v)
    if (isStr(v)) return writeString(_sstr(v))
    // §6.13.3: `write` output must read back. A symbol whose name is not a
    // bare identifier (`|.|`, `|a b|`, the empty symbol) gets its bars.
    if (v instanceof Sym) return writeSymbol(v.name)
    if (v instanceof Ch) {
      // Named chars for read-back safety.
      const CHUNAME = { '\x07': 'alarm', '\b': 'backspace', '\x7f': 'delete', '\x1b': 'escape', '\n': 'newline', '\0': 'null', '\r': 'return', ' ': 'space', '\t': 'tab' }
      const cv = v.value
      if (Object.prototype.hasOwnProperty.call(CHUNAME, cv)) return '#\\' + CHUNAME[cv]
      return '#\\' + cv
    }
    if (v instanceof Uint8Array) return '#u8(' + Array.from(v).join(' ') + ')'
    if (isVec(v)) return '#(' + v.items.map(_renderForWrite).join(' ') + ')'
    // Cells BEFORE the array branch. A proper cell chain answers `isList` too,
    // and `.map` is not a thing a chain has. Most values reach this printer as
    // arrays (`write` is seqVerb-wrapped, so `toJS` converts them on the way
    // in) — but a chain sitting inside an IMPROPER pair never crossed that
    // boundary, and `(write (cons '(a b) 'c))` died on it.
    if (v === NIL) return '()'
    if (v instanceof Pair) return pairToString(v, _renderForWrite)
    if (isList(v)) return '(' + v.map(_renderForWrite).join(' ') + ')'
    if (typeof v === 'function') return '#<procedure>'
    // A Scheme lambda is a Closure object, not a JS function, so it missed
    // the test above and fell through to isRecord: `(display car)` said
    // `#<procedure>` while `(display (lambda (x) x))` said `#<record>`, for
    // two things the language calls by the same name.
    if (v && typeof v === 'object' && isList(v.params) && 'body' in v && 'env' in v) {
      return '#<procedure>'
    }
    // Motoi exact rationals — carry Symbol.for('motoi:rational').
    if (v && typeof v === 'object' && v[_MOTOI_RAT_TAG] === true) {
      return v.d === 1n ? String(v.n) : `${v.n}/${v.d}`
    }
    // Motoi complex numbers. Without this they fell through to `isRecord`
    // below and printed `#<record>`, so `(display (make-rectangular 3 4))`
    // showed a shrug while the top level printed `3+4i` for the same value.
    // Spelled identically to src/base.js and src/cli.js so all three agree.
    if (isCpx(v)) return cpxToString(v)
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
    // Host-backed opaque values — entities, hash tables, random sources, audio
    // records, SLAT records. These answered `#<record>` here (the catch-all
    // below: one-argument `isRecord` compares `__record_type__` against
    // `undefined`, which every plain object satisfies) while the top level
    // printed `[object Object]` for the same value — two renderers, one
    // engine, different answers, and neither of them a Scheme value. The rule
    // now lives in src/opaque-print.js and all four renderers call it.
    const opaque = opaqueRepr(v)
    if (opaque) return opaque
    if (isRecord(v)) return '#<record>'
    return String(v)
  }
  const _renderForDisplay = (v) => {
    if (v instanceof Ch) return v.value           // display prints the raw char
    if (isStr(v)) return _sstr(v)                 // display prints the raw text
    if (v instanceof Sym) return v.name           // …and the raw name, no bars
    // Cells first — see _renderForWrite for why the order is load-bearing.
    if (v === NIL) return '()'
    if (v instanceof Pair) return pairToString(v, _renderForDisplay)
    if (isList(v)) return '(' + v.map(_renderForDisplay).join(' ') + ')'
    if (isVec(v)) return '#(' + v.items.map(_renderForDisplay).join(' ') + ')'
    return _renderForWrite(v)
  }
  // A file port carries a descriptor (`_fd`) and writes THROUGH to it rather
  // than accumulating in `buffer`. Buffering would mean a program that forgets
  // to close its port loses everything it wrote, and "the output silently
  // wasn't there" is the worst failure a teaching language can hand someone.
  // Every write path — textual via `_emit`, binary via `_pushBytes` — has to
  // consult `_fd`, so both go through one of these two.
  const _pushBytes = (port, bytes) => {
    if (port._fd !== undefined) { writeSync(port._fd, Buffer.from(bytes)); return }
    for (const b of bytes) port.buffer.push(b)
  }
  const _emit = (port, text) => {
    if (port instanceof Port) {
      if (port.kind === 'binary') {
        // Coerce to bytes.
        const enc = typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(text) : null
        if (port._fd !== undefined) {
          _pushBytes(port, enc || Array.from(text, (c) => c.charCodeAt(0) & 0xff))
        } else if (enc) port.buffer.push(enc)
        else for (let i = 0; i < text.length; i++) port.buffer.push(text.charCodeAt(i) & 0xff)
      } else if (port._fd !== undefined) {
        writeSync(port._fd, text)
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
  // Only something with INTERIOR structure can carry a datum label. `isList`
  // answers #t for `'()` as well, and `'()` is a frozen singleton with nothing
  // to walk — so it reached the `for...of` below and threw "v is not iterable"
  // on any datum containing an empty list, which is most of them.
  const _isCompound = (v) => v instanceof Pair || isVec(v)

  // Everything the labeller looks at is normalized to CELLS first.
  //
  // A list that crossed the sequence boundary is stored as a JavaScript array
  // — `(vector x x x)` puts three array snapshots in the vector's slots — and
  // an array cannot express a cycle. So the labeller walked the SNAPSHOT and
  // wrote `(1 2 3 4 5)` for a list that `set-car!`/`set-cdr!` had since turned
  // into `#1=(1 2 #0# 4 . #1#)`. The output was finite, well-formed, and about
  // a value that no longer existed; reading it back gave a structure that is
  // rightly NOT `equal?` to the one written, which is how the two circular
  // round-trip cases in larceny's write suite failed.
  //
  // `toScheme` is memoized in both directions, so it hands back the ORIGINAL
  // chain the array was made from — the live one, cycle and all — and the
  // label pass and the render pass agree on object identity because they
  // normalize through the same cache.
  const _cells = (v) => (Array.isArray(v) ? toScheme(v) : v)

  // Find the objects needing a label. `allShared` picks write-shared's
  // rule (anything reachable more than once); otherwise only members of
  // a cycle are labelled, which is write's rule.
  const _labelTargets = (root, allShared) => {
    const counts = new Map()
    const onPath = new Set()
    const cyclic = new Set()
    const walk = (raw) => {
      const v = _cells(raw)
      if (!_isCompound(v)) return
      if (onPath.has(v)) { cyclic.add(v); return }
      const seen = counts.get(v) || 0
      counts.set(v, seen + 1)
      if (seen > 0) return                 // subtree already traversed
      onPath.add(v)
      if (v instanceof Pair) { walk(v.car); walk(v.cdr) }
      else { for (const x of v.items) walk(x) }
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
    // Normalized through `_cells` on the way in, the same as the label pass —
    // otherwise the two passes would be looking at different objects and a
    // target found by one would be invisible to the other.
    const go = (raw) => {
      const x = _cells(raw)
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
      if (x instanceof Pair) {
        // Collapse the cdr chain the way pairToString does, but stop at a
        // labelled cdr so the label is not swallowed by the collapse.
        const parts = [go(x.car)]
        let t = x.cdr
        while (t instanceof Pair && !targets.has(t)) { parts.push(go(t.car)); t = t.cdr }
        if (t === NIL) return '(' + parts.join(' ') + ')'
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
    _pushBytes(p, [u8])
    return undefined
  })
  // read-bytevector / read-bytevector! / write-bytevector (§6.13.2-3) — the
  // bulk half of binary I/O. The per-byte verbs were bound; these were not.
  def('read-bytevector', (k, port) => {
    const p = _inPort('read-bytevector', port, 'binary')
    if (typeof k !== 'number' || !Number.isInteger(k) || k < 0) {
      throw new ErrorObject('read-bytevector: not a length (expected an exact non-negative integer)', [k])
    }
    if (k === 0) return new Uint8Array()
    // EOF only when nothing at all is left; a short read returns what there is.
    if (p.pos >= p.backing.length) return EOF
    const out = p.backing.slice(p.pos, p.pos + k)
    p.pos += out.length
    return new Uint8Array(out)
  })
  def('read-bytevector!', (bv, port, start, end) => {
    const b = _bvec('read-bytevector!', bv)
    const p = _inPort('read-bytevector!', port, 'binary')
    const s = start === undefined ? 0 : start
    const e = end === undefined ? b.length : end
    if (s < 0 || e > b.length || s > e) {
      throw new ErrorObject(`read-bytevector!: range ${s}..${e} is outside a bytevector of ${b.length} bytes`, [bv, s, e])
    }
    if (s === e) return 0
    if (p.pos >= p.backing.length) return EOF
    let n = 0
    while (s + n < e && p.pos < p.backing.length) b[s + n++] = p.backing[p.pos++]
    return n
  })
  def('write-bytevector', (bv, port, start, end) => {
    const b = _bvec('write-bytevector', bv)
    const p = _outPort('write-bytevector', port, 'binary')
    const s = start === undefined ? 0 : start
    const e = end === undefined ? b.length : end
    if (s < 0 || e > b.length || s > e) {
      throw new ErrorObject(`write-bytevector: range ${s}..${e} is outside a bytevector of ${b.length} bytes`, [bv, s, e])
    }
    _pushBytes(p, b.subarray(s, e))
    return undefined
  })

  // flush-output-port (§6.13.3) was a bare no-op that ignored its
  // argument entirely — it accepted a closed port, an input port, and a
  // non-port alike. The console really is unbuffered, so there is nothing
  // to flush, but the argument still has to be a live output port.
  def('flush-output-port', (port) => { _outPort('flush-output-port', port); return undefined })

  // ── §6.14 System interface ─────────────────────────────────────────

  def('command-line', () => {
    if (typeof process !== 'undefined' && isList(process.argv)) return process.argv.slice(1)
    return []
  })
  // SECURITY (Priya 2026-07-17): emergency-exit terminates the host
  // process — hoisted to `destructive` so only `system` /
  // `operator-gesture` / `operator-voice` tiers can call it. Prior
  // behavior: default `read` perm let untrusted / external / sakura
  // fire process.exit at will (DoS).
  //
  // R7RS §6.14 exit convention (fixed 2026-08-02 — it was INVERTED):
  //   (exit)   / (exit #t)  → success, status 0
  //   (exit #f)             → failure, a non-zero status (1)
  //   (exit n)              → that integer as the status
  // The old code was `process.exit(code | 0)`, which made #t exit 1 and
  // #f exit 0 — exactly backwards, so a program reporting success told
  // the shell it had failed.
  const _exitStatus = (obj) => {
    if (obj === undefined || obj === true) return 0
    if (obj === false) return 1
    if (typeof obj === 'number' && Number.isFinite(obj)) return obj | 0
    if (typeof obj === 'bigint') return Number(obj) | 0
    return 0   // any other truthy object is success, per Scheme truthiness
  }
  def('emergency-exit', (obj) => {
    if (typeof process !== 'undefined' && process.exit) process.exit(_exitStatus(obj))
    return undefined
  }, 'destructive')
  // `exit` (§6.14) was UNBOUND before 2026-08-02 even though R7RS-small
  // requires it. Motoi's call/cc is escape-only and there is no exposed
  // dynamic-wind stack to unwind here, so exit and emergency-exit
  // terminate identically; they differ only in name and intent. Same
  // `destructive` permission as emergency-exit — both kill the host
  // process, so the same tier gate applies (Priya 2026-07-17).
  def('exit', (obj) => {
    if (typeof process !== 'undefined' && process.exit) process.exit(_exitStatus(obj))
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
      // R7RS §6.14: an ASSOCIATION LIST — each entry is a PAIR whose car
      // is the name and whose cdr is the value. Before 2026-08-02 this
      // built two-element LISTS, so `assoc` still found the entry but
      // (cdr entry) yielded ("value") instead of "value" — the mistake
      // surfaced one line after it was made.
      .map(([k, v]) => new Pair(k, v))
  }, 'personal-data')
  def('current-second',  () => Date.now() / 1000)
  def('current-jiffy',   () => Date.now())
  def('jiffies-per-second', () => 1000)
  // features (§6.14) must describe the engine that EXISTS — portable code
  // tests this list to decide what it may rely on, so a false claim here is
  // worse than a missing one. `exact-closed` and `ratios` were dropped
  // 2026-08-02, when Motoi had one number type (the JS double) and both were
  // lies. The exactness tower landed 2026-08-03 and made them true: (/ 1 3)
  // is the exact 1/3, and every exact-argument operation but `/` and the
  // transcendentals yields an exact result.
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
  // The memo flag is set AFTER the thunk runs, not before (fixed
  // 2026-08-02). R7RS §4.2.5's worked example is a promise whose own body
  // forces itself:
  //
  //   (define p (delay (begin (set! count (+ count 1))
  //                           (if (> count x) count (force p)))))
  //   (force p)  ;=> 6
  //
  // Setting `forced` first made that inner `(force p)` see a promise
  // already marked done with an EMPTY value slot, so it handed back the
  // unspecified value and the whole recursion collapsed to unspecified —
  // silently, since there is no error to raise. The standard's reference
  // implementation instead calls the thunk and only then asks
  // `promise-done?`; a nested force that already memoized the promise
  // WINS, and its value is returned rather than overwritten. That is the
  // `if (cur.forced)` check after `apply` below.
  //
  // Consequence, and it is the standard's: a promise that forces itself
  // with no base case (`(define q (delay (force q)))`) now recurses
  // instead of answering unspecified. R7RS's own `force` diverges on it
  // too. Motoi's fuel budget stops it and reports, which is the honest
  // outcome — a wrong answer was not a safety feature.
  const _force = (p) => {
    let cur = p
    while (_isPromise(cur)) {
      if (cur.forced) { cur = cur.value; continue }
      const result = apply(cur.thunk, [], fuel)
      if (cur.forced) { cur = cur.value; continue }
      cur.forced = true
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
