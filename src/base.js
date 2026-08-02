// The base vocabulary — the only "library" the interpreter gets.
//
// Pure, total, side-effect-free functions over numbers and lists. Anything
// that touches the world (sprites, the shop) is injected separately and
// gated. Higher-order prims (for-each, map) re-enter the evaluator through
// `apply`, so they share the same fuel budget — no way to escape the cap.

import { Env, apply, Closure } from './interp.js'
import { Sym, Pair } from './reader.js'
import { makeRational, isRational, liftRational } from '../lib/math/exact.js'
import { SchemeVector, isVec, Ch } from '../lib/base/r7rs-types.js'
import { registerVerbMeta } from './verbRegistry.js'
import { seededRandom } from './rng.js'
import { installSlatVerbs } from './slat-verbs.js'
import { installR7RSCompletions } from './r7rs-completions.js'

// The bricklay cache was Curator-specific host state. Extracted engine
// keeps the `bricklay-pack-native` primitive but drops the cache — the
// primitive still returns correct results, it just re-packs every call.
// A future Curator-side wrapper can memoize.
const bricklayCacheKey = () => null
const bricklayCacheGet = () => undefined
const bricklayCacheSet = () => {}

export function makeBaseEnv(fuel) {
  const e = new Env()
  // The higher-order primitives (`map`, `for-each`, `filter`, `reduce`,
  // `apply`, `any`, `every`, `count`, `list-index`, `sort`) re-enter the
  // evaluator via `apply()`, which threads the same fuel box the rest of
  // the interpreter uses — `evalStep` does `--fuel.n` to decrement.
  // Callers pass in a raw number, so we box it once here so the whole
  // base vocabulary shares one fuel counter for callback work.
  const fuelBox = (typeof fuel === 'number') ? { n: fuel } : fuel
  // The base vocabulary is the language layer — math, predicates, list
  // ops, string ops. Every binding is a pure value transform with no
  // app-state side effects; perm `read` per CARD-MANIFEST-CONTRACT §3.2.
  // The third arg is now mandatory at the audit level (the warming
  // wrapper at interp.js logs a warn otherwise); the `def` helper
  // defaults the perm so we don't repeat it at every line.
  const def = (n, f, perm = 'read', extra = {}) => e.define(n, f, { perm, ...extra })

  // ── R7RS number tower (exact rationals) ───────────────────────────
  // Rationals are the {n,d} objects from lib/math/exact.js. The core
  // numeric verbs stay on plain JS numbers unless an operand IS a
  // rational object — then they switch to the exact path. Exactness
  // contagion: any inexact (non-integer float) operand collapses the
  // whole expression back to float. `(/ 1 2)` stays 0.5; only rational
  // literals like `1/2` trigger the exact path, so no regression.
  const _ZERO = makeRational(0n, 1n)
  const _ONE = makeRational(1n, 1n)
  const _hasRat = (a) => a.some(isRational)
  const _inexact = (x) => typeof x === 'number' && !Number.isInteger(x)
  const _anyInexact = (a) => a.some(_inexact)
  const _toFloat = (x) => isRational(x) ? Number(x.n) / Number(x.d) : x
  const _ratAdd = (a, b) => makeRational(a.n * b.d + b.n * a.d, a.d * b.d)
  const _ratSub = (a, b) => makeRational(a.n * b.d - b.n * a.d, a.d * b.d)
  const _ratMul = (a, b) => makeRational(a.n * b.n, a.d * b.d)
  const _ratDiv = (a, b) => makeRational(a.n * b.d, a.d * b.n)
  const _ratCmp = (a, b) => { const l = a.n * b.d, r = b.n * a.d; return l < r ? -1 : l > r ? 1 : 0 }
  // Fold a variadic op with rational operands present. `ratOp` is the
  // exact combiner; `fltOp` the JS-number combiner used when inexact.
  const _numFold = (a, ratOp, fltOp, ratId) => {
    if (_anyInexact(a)) {
      const f = a.map(_toFloat)
      return f.length === 1 ? fltOp(ratId === _ONE ? 1 : 0, f[0]) : f.reduce(fltOp)
    }
    const r = a.map(liftRational)
    return r.length === 1 ? ratOp(ratId, r[0]) : r.reduce(ratOp)
  }
  // Compare two numbers where at least one is rational.
  const _numCmp = (x, y) => (_inexact(x) || _inexact(y))
    ? Math.sign(_toFloat(x) - _toFloat(y))
    : _ratCmp(liftRational(x), liftRational(y))

  // ── The rounding family on exact rationals. ────────────────────────
  //
  // `round` / `floor` / `ceiling` / `truncate` / `sqrt` all went straight to
  // the `Math.*` intrinsics, which see a Rational as a plain object, coerce
  // it to NaN, and hand back `+nan.0`. `(round 9/10)` answering "not a
  // number" is indefensible — 1 is exactly representable. Fixed 2026-08-02
  // per scratch/CONFORMANCE-FIX-DECISIONS-2026-08-02.md.
  //
  // A Rational is always in lowest terms with d > 0 (lib/math/exact.js), so
  // these only have to get the sign convention right. BigInt `/` truncates
  // toward zero, so floor and ceiling each correct in one direction.
  //
  // The results come back as plain JS numbers. Per the same ruling, a JS
  // integer IS Motoi's exact integer — there is no separate inexact 2 for it
  // to be confused with — so returning a number keeps the value out of the
  // Rational-object paths (`Math.floor`, canvas ops) that the ruling protects.
  const _ratFloor = (r) => {
    const q = r.n / r.d
    return Number((r.n % r.d !== 0n && r.n < 0n) ? q - 1n : q)
  }
  const _ratCeil = (r) => {
    const q = r.n / r.d
    return Number((r.n % r.d !== 0n && r.n > 0n) ? q + 1n : q)
  }
  const _ratTrunc = (r) => Number(r.n / r.d)
  // Half rounds to EVEN, matching the flonum `round` below. The halfway test
  // is done exactly in BigInt — `2*(r - floor r)` against `1` — so no float
  // ever touches it.
  const _ratRound = (r) => {
    const f = _ratFloor(r)
    const twice = (r.n - BigInt(f) * r.d) * 2n
    if (twice < r.d) return f
    if (twice > r.d) return f + 1
    return (f % 2 === 0) ? f : f + 1
  }
  // Integer square root by Newton's method on BigInt. Returns null for a
  // negative input. Used only to decide whether an exact rational HAS an
  // exact square root; when it does, R7RS §6.2.6 says the result should be
  // exact, so `(sqrt 1/4)` is 1/2 and not 0.5.
  const _bigISqrt = (v) => {
    if (v < 0n) return null
    if (v < 2n) return v
    let x = v
    let y = (x + 1n) / 2n
    while (y < x) { x = y; y = (x + v / x) / 2n }
    return x
  }

  // The arithmetic verbs used to be the raw JS operators, so `(+ 1 "a")`
  // answered "1a" and `(* 2 'x)` answered NaN — JS coercion leaking through
  // the language. Wrong answers with no error are the failure a learner
  // cannot debug, because nothing tells them anything went wrong. Every
  // numeric verb now states what it got instead of a number.
  const _isNum = (x) => typeof x === 'number' || isRational(x)
  const _describe = (x) => {
    if (x === undefined || x === null) return 'nothing'
    if (typeof x === 'string') return `the string ${JSON.stringify(x)}`
    if (typeof x === 'boolean') return x ? '#t' : '#f'
    if (Array.isArray(x)) return x.length === 0 ? 'the empty list' : 'a list'
    if (x instanceof Sym) return `the symbol ${x.name}`
    // A character is its OWN type (R7RS §6.6), not a one-letter string —
    // naming it is what tells a caller of `(string=? (string-ref s 0) "a")`
    // that `char=?` is the verb they wanted.
    if (x instanceof Ch) return `the character #\\${x.value}`
    if (isVec(x)) return 'a vector'
    if (x instanceof Pair) return 'a pair'
    if (typeof x === 'function' || x instanceof Closure) return 'a procedure'
    if (_isNum(x)) return `the number ${isRational(x) ? `${x.n}/${x.d}` : x}`
    return 'a value of another kind'
  }
  const _ckNums = (op, a) => {
    for (const x of a) {
      if (!_isNum(x)) throw new Error(`${op}: expected a number, got ${_describe(x)}`)
    }
    return a
  }
  // R7RS §6.2.6: it is an error to divide by exact zero. Motoi errors on any
  // zero divisor rather than handing back JS's Infinity, which reads as a
  // legitimate answer and then poisons every arithmetic step downstream.
  const _ckNonZero = (op, divisors) => {
    for (const d of divisors) {
      if (_toFloat(d) === 0) throw new Error(`${op}: division by zero`)
    }
  }

  def('+', (...a) => _hasRat(_ckNums('+', a)) ? _numFold(a, _ratAdd, (x, y) => x + y, _ZERO) : a.reduce((x, y) => x + y, 0))
  def('-', (...a) => _hasRat(_ckNums('-', a)) ? _numFold(a, _ratSub, (x, y) => x - y, _ZERO) : (a.length === 1 ? -a[0] : a.reduce((x, y) => x - y)))
  def('*', (...a) => _hasRat(_ckNums('*', a)) ? _numFold(a, _ratMul, (x, y) => x * y, _ONE) : a.reduce((x, y) => x * y, 1))
  def('/', (...a) => {
    _ckNums('/', a)
    _ckNonZero('/', a.length === 1 ? a : a.slice(1))
    return _hasRat(a) ? _numFold(a, _ratDiv, (x, y) => x / y, _ONE) : (a.length === 1 ? 1 / a[0] : a.reduce((x, y) => x / y))
  })
  def('modulo', (x, y) => { _ckNums('modulo', [x, y]); _ckNonZero('modulo', [y]); return ((x % y) + y) % y })
  def('quotient', (x, y) => { _ckNums('quotient', [x, y]); _ckNonZero('quotient', [y]); return Math.trunc(x / y) })   // integer division — standard Scheme
  def('remainder', (x, y) => { _ckNums('remainder', [x, y]); _ckNonZero('remainder', [y]); return x - Math.trunc(x / y) * y })
  // R7RS §6.2.6 spells these `(max x1 x2 …)` — at least one argument. Zero
  // arguments used to hand back JS's reduce identity, so `(max)` answered
  // -Infinity and `(min)` answered Infinity: a number where the learner asked
  // a question that has no answer. (The inexact-contagion rule — "if any
  // argument is inexact the result is inexact" — is NOT implemented, and is a
  // documented Motoi limit, not a bug: JS cannot tell 4 from 4.0. See
  // scratch/CONFORMANCE-FIX-DECISIONS-2026-08-02.md.)
  const _ckArity1 = (op, a) => {
    if (a.length === 0) throw new Error(`${op}: expected at least 1 argument, got none`)
    return a
  }
  def('max', (...a) => Math.max(..._ckNums('max', _ckArity1('max', a)).map(_toFloat)))
  def('min', (...a) => Math.min(..._ckNums('min', _ckArity1('min', a)).map(_toFloat)))
  def('abs', (x) => isRational(x) ? (x.n < 0n ? makeRational(-x.n, x.d) : x) : Math.abs(x))

  // R7RS §6.2.6: `= < > <= >=` are N-ARY and hold when EVERY adjacent pair
  // holds — `(< 1 2 3)` is #t, `(< 1 3 2)` is #f, `(= 1 1 2)` is #f.
  //
  // Until 2026-08-02 each was a two-argument JS arrow. JS silently discards
  // every argument past the declared parameters, so `(= 1 1 2)` compared only
  // 1 against 1 and answered #t — a wrong answer with no error, which is the
  // failure a learner cannot debug and the one a beginner meets first. The
  // `-ci` string family and the char comparisons already looped pairwise;
  // these now match that shape, as do `max`/`min` directly above with `(...a)`.
  //
  // A single argument is a chain with no adjacent pair, so it is vacuously
  // #t (ruling R2-2: Chez, Guile and Racket all agree). Zero arguments raise —
  // there is no chain at all to be vacuous about.
  //
  // The per-pair test keeps the EXACT semantics the two-argument version had,
  // including NaN: `(= +nan.0 +nan.0)` stays #f because JS `===` says so.
  //
  // R7RS §6.2.6 requires NUMBERS here, and has no "coerce" clause, so
  // `_ckNums` runs over every argument first (ruling R2-1, 2026-08-02).
  // Without it `(= 1 'a)` answered #f and `(= 'easy 'easy)` answered #t:
  // a plausible answer to a question that was never asked, which is worse
  // than an error because nothing tells the learner they asked the wrong
  // one. carts/asteroids.sks and carts/space-invaders.sks branch on
  // `(= DIFFICULTY 'easy)` and so start raising — the carts are wrong, not
  // the engine; comparing a symbol with `=` is exactly the mistake this
  // check exists to catch, and `eq?` is the verb they wanted.
  const _numRel = (rel, x, y) => {
    if (isRational(x) || isRational(y)) {
      const c = _numCmp(x, y)
      return rel === '=' ? c === 0
        : rel === '<' ? c < 0
          : rel === '>' ? c > 0
            : rel === '<=' ? c <= 0 : c >= 0
    }
    return rel === '=' ? x === y
      : rel === '<' ? x < y
        : rel === '>' ? x > y
          : rel === '<=' ? x <= y : x >= y
  }
  const _numChain = (op, rel) => (...a) => {
    _ckNums(op, _ckArity1(op, a))
    for (let i = 0; i + 1 < a.length; i++) if (!_numRel(rel, a[i], a[i + 1])) return false
    return true
  }
  def('=', _numChain('=', '='))
  def('<', _numChain('<', '<'))
  def('>', _numChain('>', '>'))
  def('<=', _numChain('<=', '<='))
  def('>=', _numChain('>=', '>='))
  def('not', (a) => a === false)

  // Internal car/cdr that read either representation. Every derived
  // accessor goes through these so the two shapes never drift apart.
  //
  // R7RS §6.4 makes `(car '())` and `(cdr '())` errors, and until 2026-08-02
  // they returned JS `undefined` and an empty array instead. `undefined`
  // prints as nothing, so a learner's REPL showed a blank line where the
  // mistake was — and the value then travelled several more steps before
  // surfacing somewhere unrelated. Failing at the point of the mistake is
  // the whole reason the error exists.
  const _asPair = (op, a) => {
    if (a instanceof Pair) return a
    if (Array.isArray(a) && a.length > 0) return a
    throw new Error(`${op}: expected a pair or a non-empty list, got ${_describe(a)}`)
  }
  const _car = (a, op = 'car') => { const p = _asPair(op, a); return p instanceof Pair ? p.car : p[0] }
  const _cdr = (a, op = 'cdr') => { const p = _asPair(op, a); return p instanceof Pair ? p.cdr : p.slice(1) }

  def('list', (...a) => a)
  // R7RS §6.4. Consing onto a list extends the list (array fast path, the
  // shape every cart already relies on); consing onto a non-list mints a
  // real improper Pair, so `(cons 'sku 42)` is `(sku . 42)` and not the
  // two-element list it silently produced before 2026-08-01.
  def('cons', (a, b) => (Array.isArray(b) ? [a, ...b] : new Pair(a, b)))
  def('car', (a) => _car(a))
  def('cdr', (a) => _cdr(a))
  // Standard Scheme convenience accessors — second + third elements.
  // Saves the conway.sks additive-blend code from repeated `(car (cdr ...))`.
  // They report their own name so a short list blames `cadr`, not `car`.
  def('cadr', (a) => _car(_cdr(a, 'cadr'), 'cadr'))
  def('caddr', (a) => _car(_cdr(_cdr(a, 'caddr'), 'caddr'), 'caddr'))
  // (set-car! pair obj) / (set-cdr! pair obj) — R7RS §6.4. Both were UNBOUND
  // until 2026-08-02, so every program that mutated a pair died on "unbound
  // symbol: set-cdr!".
  //
  // Motoi carries TWO list representations, and they are handled differently
  // on purpose rather than papered over:
  //
  //   * An improper `Pair` is a two-field cell. Both verbs are a direct field
  //     write and every case works.
  //
  //   * A proper list is a JS array. `set-car!` is `a[0] = v`. `set-cdr!`
  //     replaces the tail IN PLACE in the same array object, so every other
  //     binding holding that list sees the change — which is the entire
  //     observable point of the verb, and the behaviour worth teaching.
  //
  // Two cases genuinely cannot be represented by a flat array. They RAISE and
  // say so, rather than doing something adjacent and looking like they worked:
  //
  //   * a non-list tail. `(set-cdr! (list 1 2) 3)` asks for `(1 . 3)`, and an
  //     array has nowhere to keep an improper tail.
  //   * a tail that reaches the list itself, i.e. a circular list. An array
  //     cannot hold the cycle, and the printer would not survive it.
  //
  // `(cons a b)` with a non-list `b` DOES mint a real dotted `Pair`, and
  // `set-cdr!` works on that without restriction — so the capability exists,
  // it is the array spelling that cannot host it.
  const _reachesFrom = (start, target) => {
    const seen = new Set()
    const walk = (v) => {
      if (v === target) return true
      if (v === null || typeof v !== 'object') return false
      if (seen.has(v)) return false
      seen.add(v)
      if (Array.isArray(v)) return v.some(walk)
      if (v instanceof Pair) return walk(v.car) || walk(v.cdr)
      return false
    }
    return walk(start)
  }
  def('set-car!', (p, v) => {
    if (p instanceof Pair) { p.car = v; return undefined }
    if (Array.isArray(p) && p.length > 0) { p[0] = v; return undefined }
    throw new Error(`set-car!: expected a pair or a non-empty list, got ${_describe(p)}`)
  }, 'state-change')
  def('set-cdr!', (p, v) => {
    if (p instanceof Pair) { p.cdr = v; return undefined }
    if (Array.isArray(p) && p.length > 0) {
      if (!Array.isArray(v)) {
        throw new Error(`set-cdr!: cannot make ${_describe(v)} the tail of a list built by (list …). ` +
          'Motoi spells a proper list as a flat array, which has no cell to hold an improper tail. ' +
          'To get a dotted pair, build it with cons — (cons x y) with a non-list y is a real pair, ' +
          'and set-cdr! can change that one freely.')
      }
      if (_reachesFrom(v, p)) {
        throw new Error('set-cdr!: the new tail leads back to this same list, which would make it circular. ' +
          'Motoi spells a proper list as a flat array and cannot hold a cycle, so this is refused ' +
          'rather than left half-done.')
      }
      const tail = v.slice()
      p.length = 1
      for (const x of tail) p.push(x)
      return undefined
    }
    throw new Error(`set-cdr!: expected a pair or a non-empty list, got ${_describe(p)}`)
  }, 'state-change')

  def('null?', (a) => Array.isArray(a) && a.length === 0)
  // R7RS §6.4 / §6.3 / §6.5 — the load-bearing type predicates the spec
  // expects every Scheme to bind. `pair?` is true of a non-empty list
  // (Motoi represents proper lists as JS arrays) or an improper `Pair`.
  // `symbol?` is true on a `Sym` reader token. `procedure?` is true on
  // anything callable — JS functions (primitives) or `Closure` instances.
  def('pair?', (a) => a instanceof Pair || (Array.isArray(a) && a.length > 0))
  def('symbol?', (a) => a instanceof Sym)
  def('procedure?', (a) => typeof a === 'function' || a instanceof Closure)
  // R7RS §6.4: `length` is an error on an improper list. (`list?` already
  // lives in lib/std/r7rs-completions-core.js and is correct as written —
  // `Array.isArray` is false for a Pair.)
  def('length', (a) => {
    if (a instanceof Pair) throw new Error('length: improper list')
    // `(length 5)` used to answer `undefined` — JS reads `.length` off
    // anything, and a number simply has none.
    if (!Array.isArray(a)) throw new Error(`length: expected a proper list, got ${_describe(a)}`)
    return a.length
  })
  def('range', (a, b) => { const r = []; for (let i = a; i < b; i++) r.push(i); return r })

  // (for-each fn xs [ys …]) — R7RS §6.10. Multi-list form iterates
  // pairwise; the callback receives one arg from each list per step.
  // Length is the shortest list; no error on ragged inputs (matches
  // R7RS behaviour that "the shortest list determines the length").
  // Improper lists reach these as a Pair; without this guard the learner
  // sees a JS message like "lists[0].map is not a function".
  const _needList = (name, v) => {
    if (!Array.isArray(v)) throw new Error(`${name}: expected a proper list`)
    return v
  }
  def('for-each', (fn, ...lists) => {
    lists.forEach((l) => _needList('for-each', l))
    if (lists.length === 0) return undefined
    if (lists.length === 1) {
      for (const x of lists[0]) apply(fn, [x], fuelBox)
      return undefined
    }
    const n = lists.reduce((m, l) => Math.min(m, l.length), Infinity)
    for (let i = 0; i < n; i++) {
      const args = lists.map((l) => l[i])
      apply(fn, args, fuelBox)
    }
    return undefined
  })
  // (map fn xs [ys …]) — R7RS §6.10, "Patch 2" (2026-07-19). Prior form
  // was single-list only; the multi-list form evaluates the callback
  // once per index with one arg from each list. `(map + xs ys)` sums two
  // lists pairwise. Backwards-compatible: single-list callers work
  // unchanged. If the fn has a fixed lower arity the runtime error
  // surfaces from apply, not from map.
  def('map', (fn, ...lists) => {
    lists.forEach((l) => _needList('map', l))
    if (lists.length === 0) return []
    if (lists.length === 1) return lists[0].map((x) => apply(fn, [x], fuelBox))
    const n = lists.reduce((m, l) => Math.min(m, l.length), Infinity)
    const out = new Array(n)
    for (let i = 0; i < n; i++) {
      const args = lists.map((l) => l[i])
      out[i] = apply(fn, args, fuelBox)
    }
    return out
  })
  def('filter', (fn, lst) => _needList('filter', lst).filter((x) => apply(fn, [x], fuelBox) !== false))
  // SRFI-1 `reduce`: (reduce f ridentity list). For a NON-empty list the
  // ridentity is IGNORED and the fold is (fold f (car list) (cdr list)) with
  // f called element-first, (f elem acc). Conformed 2026-07-25 (was acc-first
  // + seed-consuming, an R6RS fold-left shape — see broken-examples/
  // reduce-arg-order.slatl). Provenance: SRFI-1 §Fold/Reduce.
  def('reduce', (fn, ridentity, lst) => {
    if (!lst || lst.length === 0) return ridentity
    let acc = lst[0]
    for (let i = 1; i < lst.length; i++) acc = apply(fn, [lst[i], acc], fuelBox)
    return acc
  })
  // (apply fn arg1 … args) — R7RS §6.10. The LAST argument is a list; every
  // argument before it is passed through as a leading argument. Before
  // 2026-08-02 this was `(fn, args)`, so the extra arguments were silently
  // dropped and `(apply + 1 2 (list 3 4))` answered 1 instead of 10 — a wrong
  // answer with no error, which is the worst failure a teaching language has.
  // Same fuel budget as a direct call.
  def('apply', (fn, ...rest) => {
    if (rest.length === 0) throw new Error('apply: expected a procedure and an argument list')
    const tail = rest[rest.length - 1]
    if (!Array.isArray(tail)) {
      throw new Error('apply: the last argument must be a list of arguments')
    }
    return apply(fn, [...rest.slice(0, -1), ...tail], fuelBox)
  })

  // (=? a b) — smart equality. The PICO-8-style "do what I mean" verb:
  //   * numbers compare by value (===)
  //   * strings compare by value (===)
  //   * lists compare structurally (deep, length-aware)
  //   * symbols compare by name
  //   * everything else falls through to reference equality
  // Replaces the long-running confusion between eq? / eqv? / equal? in
  // the canon Schemes (per Dr. Imani's PICO-8 research pass —
  // beginners cite this as the #1 surprise). Use `=?` everywhere and
  // it just works; the verbose forms stay for the few cases that need
  // them.
  function _eqQ(a, b) {
    if (a === b) return true
    if (a == null || b == null) return false
    // R7RS §6.1 guarantees that `eqv?` IMPLIES `equal?` — equal? is defined
    // to return #t "if eqv? would". Exact rationals are heap objects, so the
    // `a === b` identity test above misses two separately-allocated 1/2s, and
    // until 2026-08-02 nothing else here looked at them: `(equal? 1/2 1/2)`
    // answered #f while `(eqv? 1/2 1/2)` answered #t, inverting the one
    // ordering the standard promises. Delegate to `_eqvQ`, so the two can
    // never disagree about a number again.
    if (isRational(a) || isRational(b)) return _eqvQ(a, b)
    // Sym comparison by .name (reader interns these consistently).
    if (a && b && typeof a === 'object' && typeof b === 'object'
        && 'name' in a && 'name' in b
        && Object.getPrototypeOf(a) === Object.getPrototypeOf(b)
        && typeof a.name === 'string') {
      return a.name === b.name
    }
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false
      for (let i = 0; i < a.length; i++) if (!_eqQ(a[i], b[i])) return false
      return true
    }
    if (a instanceof Pair || b instanceof Pair) {
      return a instanceof Pair && b instanceof Pair
        && _eqQ(a.car, b.car) && _eqQ(a.cdr, b.cdr)
    }
    // R7RS §6.8: two vectors are `equal?` when same length + element-wise equal.
    if (isVec(a) && isVec(b)) {
      if (a.items.length !== b.items.length) return false
      for (let i = 0; i < a.items.length; i++) if (!_eqQ(a.items[i], b.items[i])) return false
      return true
    }
    // R7RS §6.9: two bytevectors are `equal?` when same length + byte-wise equal.
    if (a instanceof Uint8Array && b instanceof Uint8Array) {
      if (a.length !== b.length) return false
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
      return true
    }
    return false
  }
  def('=?', _eqQ)
  // `equal?` IS the deep one — R7RS §6.1 defines it recursively over pairs,
  // vectors, strings and bytevectors. `=?` is its friendly spelling.
  def('equal?', _eqQ)

  // `eqv?` / `eq?` are NOT deep, and until 2026-08-02 all four names were
  // bound to `_eqQ`, so `(eq? (list 1 2) (list 1 2))` answered #t. That is
  // the single most load-bearing distinction in Scheme — the whole reason
  // `equal?` exists — and a learner who is taught it here and then meets any
  // other Scheme finds their mental model inverted.
  //
  // R7RS §6.1 requires `eqv?` to be #t for two objects that are the same
  // location, and for the immutable atoms (numbers of the same exactness and
  // value, characters, symbols, the empty list) that "cannot be distinguished
  // by any operation". It requires #f for two separately-allocated aggregates.
  // Motoi's atoms are already value-shaped in the host: symbols carry `.name`,
  // characters are interned by `ch()`, numbers are JS numbers or exact
  // rationals. So `eqv?` is identity plus a value check on those, and nothing
  // else — an aggregate is `eqv?` only to itself.
  //
  // `eq?` is bound to the same function. R7RS leaves `eq?` weaker than `eqv?`
  // only on numbers and characters, and leaves those cases UNSPECIFIED rather
  // than requiring #f — so making them agree is conformant, and it spares the
  // learner a distinction that has no observable meaning in this runtime.
  // (Motoi's strings are host primitives and therefore compare by value here;
  // R7RS also leaves `(eq? "a" "a")` unspecified. See the reference caveat.)
  function _eqvQ(a, b) {
    if (a === b) return true
    if (a == null || b == null) return false
    if (a instanceof Sym && b instanceof Sym) return a.name === b.name
    // R7RS §6.1 lists the empty list among the objects `eqv?` must answer #t
    // for: there is only ONE empty list. Motoi spells it as a JS array, and
    // every `'()` literal allocates a fresh one, so `===` said #f — which
    // made `(eq? '() '())` #f and quietly broke the identity a learner leans
    // on hardest when writing a recursive list walk.
    if (Array.isArray(a) && Array.isArray(b)) return a.length === 0 && b.length === 0
    // Exact rationals are heap objects, so `===` misses two equal ones.
    // Exactness must still separate them: R7RS says 1/2 and 0.5 are not eqv?.
    if (isRational(a) || isRational(b)) {
      const numeric = (x) => isRational(x) || typeof x === 'number'
      if (!numeric(a) || !numeric(b)) return false
      if (_inexact(a) !== _inexact(b)) return false
      return _numCmp(a, b) === 0
    }
    return false
  }
  def('eqv?', _eqvQ)
  def('eq?', _eqvQ)

  // (inspect x) — walk any value and return a flat, readable string
  // suitable for `(text ...)` or `(display)`. The runtime
  // inspector PICO-8 authors keep asking for; pretty-prints lists,
  // truncates strings, marks closures as `<fn>`.
  function _show(v, depth = 0) {
    if (v === undefined) return 'nil'
    if (v === false) return '#f'
    if (v === true) return '#t'
    if (v === null) return 'null'
    if (typeof v === 'number') return String(v)
    if (typeof v === 'string') {
      return v.length > 80 ? JSON.stringify(v.slice(0, 80)) + '…' : JSON.stringify(v)
    }
    if (typeof v === 'function') return '<fn>'
    if (v instanceof Closure) return '<fn>'
    if (v && typeof v === 'object' && 'name' in v && typeof v.name === 'string'
        && Object.keys(v).length === 1) return v.name
    if (Array.isArray(v)) {
      if (depth > 4) return '(…)'
      const inner = v.slice(0, 12).map((x) => _show(x, depth + 1)).join(' ')
      const tail = v.length > 12 ? ' …' : ''
      return '(' + inner + tail + ')'
    }
    if (typeof v === 'object') {
      if (depth > 3) return '{…}'
      const entries = Object.entries(v).slice(0, 8)
        .map(([k, vv]) => `${k}: ${_show(vv, depth + 1)}`)
      return '{' + entries.join(', ')
        + (Object.keys(v).length > 8 ? ', …' : '') + '}'
    }
    return String(v)
  }
  def('inspect', (v) => _show(v))

  // ── I/O — the two Scheme primitives every beginner reaches for. ─────
  //
  // `(display v)` writes v to stdout with no trailing newline. Strings
  // print unquoted (that's the whole point of `display` vs `write`);
  // #t/#f and () use the reader-visible spellings; lists recurse; every
  // other value falls through to String().
  //
  // `(newline)` writes a single '\n'. Both return undefined so a REPL
  // top-level `(display "hi")` doesn't echo a bogus `=> ...` line.
  //
  // The output stream is `process.stdout` — the CLI and REPL both write
  // there, so display/newline land next to the `=> value` prints in the
  // same terminal without any extra plumbing. A future host-injected
  // seam (opts.stdout) can override; for 1.4 the direct stdout write is
  // what a beginner cart expects. See docs/BOOK-VOICE-1.0.md §I/O.
  function _displayFormat(v) {
    if (v === undefined) return ''
    if (v === null) return '()'
    if (v === true) return '#t'
    if (v === false) return '#f'
    if (typeof v === 'string') return v
    if (typeof v === 'bigint') return String(v)
    if (typeof v === 'number') {
      if (v === Infinity) return '+inf.0'
      if (v === -Infinity) return '-inf.0'
      if (Number.isNaN(v)) return '+nan.0'
      return String(v)
    }
    if (v instanceof Pair) return pairToString(v, _displayFormat)
    if (Array.isArray(v)) return '(' + v.map(_displayFormat).join(' ') + ')'
    if (typeof v === 'function') return '<fn>'
    if (v instanceof Closure) return '<fn>'
    if (v && typeof v === 'object' && 'name' in v && typeof v.name === 'string'
        && Object.keys(v).length === 1) return v.name
    // Exact rationals (lib/math/exact.js) — carry the shared tag.
    const RAT_TAG = Symbol.for('motoi:rational')
    if (v && typeof v === 'object' && v[RAT_TAG] === true) {
      return v.d === 1n ? String(v.n) : `${v.n}/${v.d}`
    }
    // Complex numbers (lib/math/complex.js) — carry the shared tag.
    const CPX_TAG = Symbol.for('motoi:complex')
    if (v && typeof v === 'object' && v[CPX_TAG] === true) {
      const { re, im } = v
      if (im === 0) return String(re)
      if (re === 0) return im === 1 ? 'i' : im === -1 ? '-i' : `${im}i`
      const sign = im >= 0 ? '+' : '-'
      const ai = Math.abs(im)
      const imPart = ai === 1 ? 'i' : `${ai}i`
      return `${re}${sign}${imPart}`
    }
    // Promise objects (from delay/make-promise) — show shape not JS repr.
    if (v && typeof v === 'object' && v.__promise__ === true) {
      return v.forced ? _displayFormat(v.value) : '<promise>'
    }
    if (v && typeof v === 'object' && v.__eof__ === true) return '#<eof>'
    // A Values box reaching display means the program used a multiple-value
    // producer in single-value position. Show the values rather than falling
    // through to String(), which printed `[object Object]`.
    if (v && typeof v === 'object' && Array.isArray(v.vals)) {
      return v.vals.map(_displayFormat).join(' ')
    }
    return String(v)
  }
  def('display', (v) => { process.stdout.write(_displayFormat(v)); return undefined })
  def('newline', () => { process.stdout.write('\n'); return undefined })

  // ── SRFI 1 essentials (per Dr. Imani's research — what every Scheme
  // author reaches for first; we already have map/filter/reduce/append/
  // reverse/first/last/nth; add the remainder so a cart authored in
  // any other Scheme runs here without a port).
  // SRFI-1: any/every/count take one or more parallel lists, stopping at the
  // shortest. any returns the first true value; every returns the last true
  // value (or #t when all lists are empty); both short-circuit.
  def('any', (pred, ...lists) => {
    if (lists.length === 0 || lists.some((l) => !Array.isArray(l))) return false
    const n = Math.min(...lists.map((l) => l.length))
    for (let i = 0; i < n; i++) {
      const r = apply(pred, lists.map((l) => l[i]), fuelBox)
      if (r !== false) return r
    }
    return false
  })
  def('every', (pred, ...lists) => {
    if (lists.length === 0 || lists.some((l) => !Array.isArray(l))) return true
    const n = Math.min(...lists.map((l) => l.length))
    let last = true
    for (let i = 0; i < n; i++) {
      last = apply(pred, lists.map((l) => l[i]), fuelBox)
      if (last === false) return false
    }
    return last
  })
  def('count', (pred, ...lists) => {
    if (lists.length === 0 || lists.some((l) => !Array.isArray(l))) return 0
    const n = Math.min(...lists.map((l) => l.length))
    let c = 0
    for (let i = 0; i < n; i++) {
      if (apply(pred, lists.map((l) => l[i]), fuelBox) !== false) c++
    }
    return c
  })
  def('take', (lst, n) => Array.isArray(lst) ? lst.slice(0, Math.max(0, n|0)) : [])
  def('drop', (lst, n) => Array.isArray(lst) ? lst.slice(Math.max(0, n|0)) : [])
  // list-head is the R7RS name for take's prefix operation (SRFI-1 `take`).
  def('list-head', (lst, n) => Array.isArray(lst) ? lst.slice(0, Math.max(0, n|0)) : [])
  def('zip', (a, b) => {
    if (!Array.isArray(a) || !Array.isArray(b)) return []
    const n = Math.min(a.length, b.length)
    const out = new Array(n)
    for (let i = 0; i < n; i++) out[i] = [a[i], b[i]]
    return out
  })
  // R7RS §6.4: every argument but the last must be a proper list; the last
  // may be any object, and becomes the tail — so `(append '(1) '(2 . 3))`
  // is `(1 2 . 3)`, not a list holding a pair.
  // Every argument BUT the last must genuinely be a proper list. `[].concat`
  // wraps a non-list instead of rejecting it, so `(append 7 '(1))` answered
  // `(7 1)` — silently promoting a number to a one-element list. The learner
  // then believes `append` cons-es, which is the wrong model of the verb.
  def('append', (...ls) => {
    if (ls.length === 0) return []
    for (let i = 0; i < ls.length - 1; i++) {
      if (!Array.isArray(ls[i])) {
        throw new Error(`append: every argument but the last must be a proper list; ` +
          `argument ${i + 1} is ${_describe(ls[i])}. Only the LAST argument may be any object.`)
      }
    }
    const last = ls[ls.length - 1]
    const front = [].concat(...ls.slice(0, -1))
    if (Array.isArray(last)) return front.concat(last)
    let acc = last
    for (let i = front.length - 1; i >= 0; i--) acc = new Pair(front[i], acc)
    return acc
  })
  def('reverse', (a) => {
    if (a instanceof Pair) throw new Error('reverse: improper list')
    return a.slice().reverse()
  })
  def('first', (a) => a[0])
  def('last', (a) => a[a.length - 1])
  def('nth', (a, i) => a[i])

  // ── more math ───────────────────────────────────────────────────────
  // R7RS §6.2.6: the result is exact when the argument is exact and the root
  // is exactly representable. `(sqrt 1/4)` is 1/2; `(sqrt 2)` stays inexact.
  def('sqrt', (x) => {
    if (isRational(x)) {
      const sn = _bigISqrt(x.n)
      const sd = _bigISqrt(x.d)
      if (sn !== null && sd !== null && sn * sn === x.n && sd * sd === x.d) {
        return makeRational(sn, sd)
      }
      return Math.sqrt(_toFloat(x))
    }
    // R7RS §6.2.3 permits a limited tower, and Motoi's stops short of complex
    // numbers. Returning NaN let `(sqrt -1)` flow onward as a number-shaped
    // non-number; saying so is the teachable answer.
    if (typeof x === 'number' && x < 0) {
      throw new Error(`sqrt: ${x} has no real square root, and Motoi has no complex numbers`)
    }
    return Math.sqrt(x)
  })
  def('cos', (x) => Math.cos(x))
  def('sin', (x) => Math.sin(x))
  def('tan', (x) => Math.tan(x))
  def('atan2', (y, x) => Math.atan2(y, x))
  def('pi', Math.PI)                            // (pi) → 3.14159…
  def('expt', (b, p) => Math.pow(b, p))
  // Exp/log family — Wave 0, per architect-motoi-core-runtime-completion
  // 2026-07-16 §4 :exp-log. Thin wrappers over the ES Math intrinsics.
  // `log` is the natural logarithm (R7RS §6.2.6), `log10`/`log2`/`exp2`
  // are pedagogical conveniences the kid picks up in growth-curve carts.
  // Also surfaced as math/* in lib/math/basic.js during Wave 1.
  def('exp', (x) => Math.exp(x))
  // R7RS §6.2.6: `(log z)` is the natural logarithm; `(log z1 z2)` is the
  // logarithm of z1 in base z2, defined as (/ (log z1) (log z2)). The
  // two-argument form was a one-parameter JS arrow until 2026-08-02, so
  // `(log 8 2)` discarded the base and answered 2.0794…, the natural log of 8
  // — a plausible-looking number, which is exactly what makes it dangerous.
  def('log', (x, base) => {
    _ckNums('log', base === undefined ? [x] : [x, base])
    const z = Math.log(_toFloat(x))
    if (base === undefined) return z
    return z / Math.log(_toFloat(base))
  })
  def('log2', (x) => Math.log2(x))
  def('log10', (x) => Math.log10(x))
  def('exp2', (x) => Math.pow(2, x))
  def('floor', (x) => isRational(x) ? _ratFloor(x) : Math.floor(x))
  def('ceil', (x) => isRational(x) ? _ratCeil(x) : Math.ceil(x))
  // R7RS §6.2.6 spells it `ceiling`. We keep `ceil` as the short-form
  // alias the cart authors learned first; both point to the same impl.
  def('ceiling', (x) => isRational(x) ? _ratCeil(x) : Math.ceil(x))
  // R7RS §6.2.6: `round` returns the closest integer, rounding to EVEN
  // when x is halfway between two integers (banker's rounding).
  // JS Math.round is half-up (2.5=>3), which diverges — so we roll our own.
  def('round', (x) => {
    if (isRational(x)) return _ratRound(x)
    const f = Math.floor(x)
    const diff = x - f
    if (diff < 0.5) return f
    if (diff > 0.5) return f + 1
    return (f % 2 === 0) ? f : f + 1   // exactly halfway: pick the even one
  })
  def('round2', (x) => Math.round(x * 100) / 100)   // money-friendly
  def('sign', (x) => Math.sign(x))
  def('clamp', (x, lo, hi) => Math.min(hi, Math.max(lo, x)))
  def('lerp', (a, b, t) => a + (b - a) * t)
  // `rng-uniform` is the plain uniform in [0,1). It is intentionally NOT
  // named `random`. Every draw below goes through seededRandom so one seed
  // governs the whole random surface no matter which verb a cart reaches
  // for — these used to call Math.random directly and so escaped
  // `(with-seed …)`, which cost three separate fixes to find.
  def('rng-uniform', () => seededRandom())
  // Two bounds, always: [a, b). Called with one argument, `b` was undefined and
  // the arithmetic quietly produced +nan.0 — which then flows into substring
  // indices and grid coordinates and fails somewhere else entirely, or worse,
  // does not fail at all. `(random-int n)` is the one-argument verb.
  def('randint', (a, b) => {
    if (!_isNum(a) || !_isNum(b)) {
      throw new Error('randint: expected two numeric bounds, as (randint a b) — a random integer in [a, b). ' +
        'For a single upper bound use (random-int n), which draws from 0..n-1.')
    }
    return a + Math.floor(seededRandom() * (b - a))
  })
  // Racket-style aliases — friendlier names that Scheme-ers reach for.
  // `(random-int n)` → 0..n-1.  `(random-range lo hi)` → uniform float
  // in [lo, hi).  `(random-pick lst)` → an element of the list.
  def('random-int', (n) => Math.floor(seededRandom() * Math.max(1, n | 0)))
  def('random-range', (lo, hi) => lo + seededRandom() * (hi - lo))
  def('random-pick', (lst) => (lst && lst.length ? lst[Math.floor(seededRandom() * lst.length)] : null))
  def('sum', (lst) => lst.reduce((x, y) => x + y, 0))
  def('mean', (lst) => (lst.length ? lst.reduce((x, y) => x + y, 0) / lst.length : 0))

  // ── finance ─────────────────────────────────────────────────────────
  def('pct', (a, b) => (b === 0 ? 0 : (a / b) * 100))                 // a as % of b
  def('pct-change', (oldV, newV) => (oldV === 0 ? 0 : ((newV - oldV) / oldV) * 100))
  def('margin', (price, cost) => (price === 0 ? 0 : ((price - cost) / price) * 100))
  def('markup', (cost, pctUp) => cost * (1 + pctUp / 100))
  def('markdown', (price, pctOff) => price * (1 - pctOff / 100))
  def('profit', (revenue, cost) => revenue - cost)
  def('fee', (amount, ratePct) => amount * (ratePct / 100))
  def('net', (gross, ...fees) => gross - fees.reduce((x, y) => x + y, 0))
  def('cagr', (begin, end, years) => (begin <= 0 || years <= 0 ? 0 : (Math.pow(end / begin, 1 / years) - 1) * 100))
  def('sma', (lst, n) => {            // simple moving average → array
    const out = []
    for (let i = n - 1; i < lst.length; i++) {
      let s = 0
      for (let j = i - n + 1; j <= i; j++) s += lst[j]
      out.push(s / n)
    }
    return out
  })

  // ── thresholds (over values/series the host provides) ───────────────
  def('above?', (x, t) => x > t)
  def('below?', (x, t) => x < t)
  def('crossed?', (prev, now, t) => (prev <= t && now > t) || (prev >= t && now < t))

  // ── collisions (the game kit) ───────────────────────────────────────
  def('dist', (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1))
  def('near?', (x1, y1, x2, y2, r) => Math.hypot(x2 - x1, y2 - y1) <= r)
  def('in-rect?', (px, py, x, y, w, h) => px >= x && px < x + w && py >= y && py < y + h)
  def('overlap?', (x1, y1, w1, h1, x2, y2, w2, h2) =>
    x1 < x2 + w2 && x2 < x1 + w1 && y1 < y2 + h2 && y2 < y1 + h1)

  // ── equality, predicates, strings, lookup ───────────────────────────
  // NOTE: `eq?` and `equal?` were previously ALSO defined at lines 116-117
  // above using the smart `_eqQ` shared with `=?`. Those definitions
  // handle Sym-by-name and deep list equality; the SIMPLE strict/deep
  // pair that used to live here shadowed them silently, which broke
  // (eq? (sym "foo") (sym "foo")) for freshly constructed Sym instances.
  // We keep the smart definitions in force here. Both `eq?` and `equal?`
  // remain structural per Motoi's `=?` doctrine (PICO-8-style DWIM
  // equality — Dr. Imani's beginner-friendliness research pass).
  def('zero?', (x) => isRational(x) ? x.n === 0n : x === 0)
  def('positive?', (x) => isRational(x) ? x.n > 0n : x > 0)
  def('negative?', (x) => isRational(x) ? x.n < 0n : x < 0)
  // `x % 2` on a Rational object is NaN, so `(even? 4/2)` answered #f even
  // though 4/2 IS the integer 2. A Rational with denominator 1 is an integer
  // and its parity is the parity of the numerator; anything else is not an
  // integer at all and has no parity.
  // A non-integer NUMBER answers #f — 1.5 is not odd, and that predicate is
  // total by an earlier deliberate decision (tests/zane-1-bughunt.test.mjs).
  // A non-number has no parity to report and raises.
  const _parity = (op, x, want) => {
    if (isRational(x)) {
      if (x.d !== 1n) return false
      return ((x.n % 2n) + 2n) % 2n === want
    }
    if (typeof x !== 'number') throw new Error(`${op}: expected a number, got ${_describe(x)}`)
    if (!Number.isInteger(x)) return false
    return ((x % 2) + 2) % 2 === Number(want)
  }
  def('even?', (x) => _parity('even?', x, 0n))
  def('odd?', (x) => _parity('odd?', x, 1n))
  def('number?', (x) => typeof x === 'number' || isRational(x))
  def('string?', (x) => typeof x === 'string')
  def('boolean?', (x) => x === true || x === false)
  // R7RS §6.7 takes strings only. The old `a.map(String)` coerced anything,
  // and the character case was the damaging one: `(string-append acc (string-ref s i))`
  // built the literal text `#\a` into the result, so a cart's cipher output or
  // grid row came out as `#\k#\h#\o` instead of letters — no error, just garbage.
  def('string-append', (...a) => {
    for (const x of a) {
      if (typeof x !== 'string') {
        throw new Error(`string-append: expected a string, got ${_describe(x)}`)
      }
    }
    return a.join('')
  })
  // ── Indexed access: range + type checks. ───────────────────────────
  //
  // Until 2026-08-02 every accessor in this group read straight off the
  // host object, so an out-of-range index answered JS `undefined` and a
  // wrong-type argument answered whatever JS coercion produced. That is the
  // most poisonous shape a bug can have here: `(vector-ref v 99)` handed back
  // a truthy non-value, `(number? …)` on that non-value ALSO answered truthy,
  // the `(if (number? x) …)` took the number branch, and the arithmetic blew
  // up several steps later somewhere unrelated to the actual mistake. The
  // whole point of an error is to fire AT the mistake.
  //
  // Every message names the procedure, the bad index, and the valid range,
  // matching the style `_ckNums` / `_ckNonZero` / `substring` already use.
  const _ckIndex = (op, i, len, what) => {
    if (!_isNum(i)) throw new Error(`${op}: expected an integer index, got ${_describe(i)}`)
    const k = _toFloat(i)
    if (!Number.isInteger(k)) throw new Error(`${op}: expected an integer index, got ${k}`)
    if (len === 0) throw new Error(`${op}: index ${k} is out of range — the ${what} is empty, so no index is valid`)
    if (k < 0 || k >= len) {
      throw new Error(`${op}: index ${k} is out of range for a ${what} of length ${len}; valid indices are 0 to ${len - 1}`)
    }
    return k
  }
  def('string-length', (s) => {
    // `(string-length 5)` used to answer 1 — JS stringified the number and
    // measured THAT. A length is not a plausible answer to a type error.
    if (typeof s !== 'string') throw new Error(`string-length: expected a string, got ${_describe(s)}`)
    return s.length
  })
  // → single-char string. (lib/base/r7rs-small.js overrides this with a
  // character-returning version per R7RS §6.7; the bounds check is repeated
  // here so the base env alone is never silently wrong.)
  def('string-ref', (s, i) => {
    if (typeof s !== 'string') throw new Error(`string-ref: expected a string, got ${_describe(s)}`)
    return s.charAt(_ckIndex('string-ref', i, s.length, 'string'))
  })
  // R7RS §6.7: `string=?` is n-ary and holds when EVERY adjacent pair holds,
  // exactly like the numeric chain above. It was a two-argument JS arrow until
  // 2026-08-02, so `(string=? "a" "a" "b")` answered #t. Same defect, same
  // shape of fix; the `-ci` family in lib/std already loops pairwise.
  // `string-eq?` is a Motoi-own alias for the same procedure (see the
  // conformance decisions file) and moves in lockstep, so the two can never
  // disagree about arity or type again.
  //
  // §6.7 requires STRINGS and has no "coerce" clause, so `_ckStrs` runs over
  // every argument first (ruling R2-1, 2026-08-02). The operands used to go
  // through `String(x)`, which made `(string=? 5 "5")` answer #t — a
  // plausible answer to a question nobody asked.
  //
  // A CHARACTER IS NOT A STRING (ruling R2-3). `(string=? (string-ref s 0)
  // "a")` raising is the type system doing its job, and `char=?` is the verb
  // that line wanted; carts/sokoban-boxes.sks has been silently rendering
  // garbage on exactly that mistake. No char -> string coercion goes in here
  // to make it "pass".
  const _ckStrs = (op, a) => {
    for (const x of a) {
      if (typeof x !== 'string') throw new Error(`${op}: expected a string, got ${_describe(x)}`)
    }
    return a
  }
  const _strChain = (op, ok) => (...a) => {
    _ckStrs(op, _ckArity1(op, a))
    for (let i = 0; i + 1 < a.length; i++) {
      if (!ok(a[i], a[i + 1])) return false
    }
    return true
  }
  def('string-eq?', _strChain('string-eq?', (x, y) => x === y))
  def('string=?', _strChain('string=?', (x, y) => x === y))
  def('vector-ref', (v, i) => {
    const items = isVec(v) ? v.items : Array.isArray(v) ? v : null
    if (items === null) throw new Error(`vector-ref: expected a vector, got ${_describe(v)}`)
    return items[_ckIndex('vector-ref', i, items.length, 'vector')]
  })
  // (substring s start [end]) — R7RS §6.7, which requires
  // 0 <= start <= end <= (string-length s). This used to be raw JS
  // String.prototype.substring, which instead clamped past the end, clamped
  // negatives to 0, and SWAPPED the arguments when start > end — so a
  // reversed-index bug returned a plausible string and never announced
  // itself. Each error names the real length and the conforming spelling,
  // because a caller who hits it is usually reaching for one of two other
  // things: a prefix TEST (string-prefix?), or a TRUNCATION, which is
  // (substring s 0 (min n (string-length s))).
  def('substring', (s, a, b = undefined) => {
    const str = String(s)
    const len = str.length
    const start = (a === undefined) ? 0 : a
    const end = (b === undefined) ? len : b
    if (!_isNum(start) || !_isNum(end)) {
      throw new Error(`substring: expected a number index, got ${_describe(_isNum(start) ? end : start)}`)
    }
    if (start < 0) {
      throw new Error(`substring: start ${start} is negative; R7RS §6.7 requires 0 <= start <= end <= ${len}`)
    }
    if (end > len) {
      throw new Error(`substring: end ${end} is past the end of a string of length ${len}. ` +
        `To TEST a prefix use (string-prefix? "..." s); to TRUNCATE use (substring s ${start} (min ${end} (string-length s))).`)
    }
    if (start > end) {
      throw new Error(`substring: start ${start} is greater than end ${end} — the indices are reversed. ` +
        `R7RS §6.7 requires 0 <= start <= end <= ${len}.`)
    }
    return str.slice(start, end)
  })
  def('number->string', (n, radix) => {
    // Standard Scheme: (number->string n [radix]). Default radix 10.
    // Radix 16 emits lowercase hex (matches the `"#rrggbb"` convention).
    const r = (typeof radix === 'number') ? (radix | 0) : 10
    // `Number(rational)` is NaN, so `(number->string 1/2)` used to answer the
    // string "NaN". R7RS §6.2.7 requires the result to read back as the same
    // number, and `1/2` is exactly what the reader accepts.
    if (isRational(n)) {
      if (n.d === 1n) return n.n.toString(r)
      if (r !== 10) {
        throw new Error(`number->string: radix ${r} is not supported for the exact rational ${n.n}/${n.d}`)
      }
      return `${n.n}/${n.d}`
    }
    if (!_isNum(n)) throw new Error(`number->string: expected a number, got ${_describe(n)}`)
    return Number(n).toString(r)
  })
  // (string->number s [radix]) — R7RS §6.2.7. Default radix 10.
  //
  // "Returns a number of the maximally precise representation expressed by
  // the given string. … If string is not a syntactically valid notation for
  // a number, or would result in a number that cannot be represented, then
  // string->number returns #f."
  //
  // The WHOLE string must be a number. Until 2026-08-02 this called
  // `parseFloat`, which stops at the first character it cannot use — so
  // `(string->number "12abc")` answered 12. A learner testing whether input
  // is a number got "yes, 12" for "12abc", and the corpus would have been
  // taught that. `parseFloat` also skips leading whitespace, so `" 12"` was
  // 12 where the standard requires #f. Both are gone: the string is matched
  // against the R7RS number grammar first, and only then converted.
  //
  // `"1/2"` now yields the exact rational 1/2 rather than 1. Rationals are
  // already Motoi's exact representation (`(exact 0.5)` is 1/2), so there was
  // never a representation excuse for dropping the denominator.
  const _RADIX_DIGITS = { 2: '[01]', 8: '[0-7]', 10: '[0-9]', 16: '[0-9a-fA-F]' }
  const _digitsToBig = (str, r) => {
    const neg = str[0] === '-'
    const body = (str[0] === '+' || str[0] === '-') ? str.slice(1) : str
    const big = BigInt(r)
    let acc = 0n
    for (const c of body) acc = acc * big + BigInt(parseInt(c, r))
    return neg ? -acc : acc
  }
  def('string->number', (s, radix) => {
    if (typeof s !== 'string') {
      throw new Error(`string->number: expected a string, got ${_describe(s)}`)
    }
    let r = (typeof radix === 'number') ? (radix | 0) : 10
    if (!_RADIX_DIGITS[r]) {
      throw new Error(`string->number: radix must be 2, 8, 10 or 16, got ${r}`)
    }
    let str = s
    // §6.2.5 radix prefixes. An explicit prefix wins over the radix argument.
    const pfx = /^#([bodxBODX])/.exec(str)
    if (pfx) {
      r = { b: 2, o: 8, d: 10, x: 16 }[pfx[1].toLowerCase()]
      str = str.slice(2)
    } else if (r === 16 && (str.startsWith('0x') || str.startsWith('0X'))) {
      // Motoi-own convenience carried over from the pre-2026-08-02 version so
      // the "#rrggbb" colour code that passes "0xff" keeps parsing.
      str = str.slice(2)
    }
    if (str === '') return false
    const D = _RADIX_DIGITS[r]
    // Exact rational — valid in every radix.
    if (new RegExp(`^[+-]?${D}+/${D}+$`).test(str)) {
      const [nS, dS] = str.split('/')
      const d = _digitsToBig(dS, r)
      if (d === 0n) return false          // 1/0 is not a representable number
      return makeRational(_digitsToBig(nS, r), d)
    }
    // Exact integer.
    if (new RegExp(`^[+-]?${D}+$`).test(str)) {
      const v = Number(_digitsToBig(str, r))
      return Number.isFinite(v) ? v : false
    }
    if (r !== 10) return false            // §6.2.5: decimals only in radix 10
    // Infinities and NaN are part of the numeric grammar in radix 10, and
    // `display` already writes them back in this spelling — so they have to
    // read back in, or the round trip is broken.
    if (str === '+inf.0') return Infinity
    if (str === '-inf.0') return -Infinity
    if (str === '+nan.0' || str === '-nan.0') return NaN
    // Decimal, with an optional exponent. `1.`, `.5` and `1e3` are all legal.
    if (!/^[+-]?([0-9]+\.?[0-9]*|\.[0-9]+)(e[+-]?[0-9]+)?$/i.test(str)) return false
    const n = Number(str)
    return Number.isNaN(n) ? false : n
  })
  // (hex-byte "#rrggbb" i) → 0..255. Convenience for the conway.sks
  // additive-blend code — reads 2 hex chars at offset i without forcing
  // operators to remember the radix argument to string->number.
  def('hex-byte', (s, i) => {
    const n = parseInt(String(s).substr(i, 2), 16)
    return Number.isNaN(n) ? 0 : n
  })
  // (byte->hex n) → 2-char lowercase hex string. Pads single digits.
  def('byte->hex', (n) => {
    const v = Math.max(0, Math.min(255, n | 0)).toString(16)
    return v.length === 1 ? '0' + v : v
  })
  def('list-ref', (a, i) => {
    if (!Array.isArray(a)) throw new Error(`list-ref: expected a proper list, got ${_describe(a)}`)
    return a[_ckIndex('list-ref', i, a.length, 'list')]
  })
  // R7RS §6.4: `(member obj list [compare])` and `(assoc obj alist [compare])`.
  // The optional third argument REPLACES the default `equal?` comparison and
  // is called as `(compare obj element)` — obj first. Motoi bound both as
  // two-argument arrows until 2026-08-02, so the comparator was silently
  // discarded and `(member 2 '(1 2 3) (lambda (a b) #f))` still answered
  // `(2 3)`: the learner's own predicate had no effect and nothing said so.
  //
  // The default is now `_eqQ`, which IS `equal?` — the procedure R7RS names.
  // (It was a near-identical private `deepEqual`, which additionally missed
  // vectors and bytevectors.)
  const _memberEq = (op, cmp) => {
    if (cmp === undefined) return _eqQ
    if (typeof cmp !== 'function' && !(cmp instanceof Closure)) {
      throw new Error(`${op}: the third argument must be a comparison procedure, got ${_describe(cmp)}`)
    }
    return (x, y) => apply(cmp, [x, y], fuelBox) !== false
  }
  def('member', (x, lst, cmp) => {
    if (!Array.isArray(lst)) throw new Error(`member: expected a proper list, got ${_describe(lst)}`)
    const eq = _memberEq('member', cmp)
    for (let i = 0; i < lst.length; i++) if (eq(x, lst[i])) return lst.slice(i)
    return false
  })
  // Entries may be `(k v)` lists or `(k . v)` dotted pairs — match both.
  def('assoc', (key, alist, cmp) => {
    if (!Array.isArray(alist)) throw new Error(`assoc: expected a proper list of pairs, got ${_describe(alist)}`)
    const eq = _memberEq('assoc', cmp)
    for (const pair of alist) {
      if (pair instanceof Pair) { if (eq(key, pair.car)) return pair }
      else if (Array.isArray(pair) && pair.length > 0) { if (eq(key, pair[0])) return pair }
    }
    return false
  })

  // ── list-builders the layout carts reach for ────────────────────────
  //
  // bricklay tracks a vector of column bottoms and updates it as cards
  // land. We expose the SRFI-1-friendly trio that makes that ergonomic:
  //
  //   (make-list n value)    → a fresh list of length n filled with value
  //   (list-set lst i value) → a NEW list with element i replaced (pure;
  //                            the source list is not mutated — matches
  //                            the immutable shape Scheme code is already
  //                            written in here)
  //   (list-index pred lst)  → index of the first element where (pred x)
  //                            is true, or #f. SRFI-1 standard.
  //   (argmin lst)           → index of the smallest number in lst
  //                            (ties: leftmost wins). The bricklay packer
  //                            uses this to pick the shortest column.
  //   (sort seq less?)       → a NEW list (or vector, if seq is one) sorted
  //                            ascending under the two-arg less?
  //                            predicate. Stable.
  def('make-list', (n, value) => {
    const k = Math.max(0, n | 0)
    const out = new Array(k)
    for (let i = 0; i < k; i++) out[i] = value
    return out
  })
  def('list-set', (lst, i, value) => {
    if (!Array.isArray(lst)) return lst
    const out = lst.slice()
    if (i >= 0 && i < out.length) out[i] = value
    return out
  })
  // SRFI-1 `list-index` takes ONE OR MORE parallel lists and walks them in
  // step, stopping at the shortest, exactly like `any`/`every`/`count` above.
  // The two-argument arrow it used to be discarded every list past the first,
  // so `(list-index = '(1 2 3) '(4 5 3))` answered on the first list alone.
  def('list-index', (pred, ...lists) => {
    if (lists.length === 0 || lists.some((l) => !Array.isArray(l))) return false
    const n = Math.min(...lists.map((l) => l.length))
    for (let i = 0; i < n; i++) {
      if (apply(pred, lists.map((l) => l[i]), fuelBox) !== false) return i
    }
    return false
  })
  def('argmin', (lst) => {
    if (!Array.isArray(lst) || lst.length === 0) return false
    let best = 0
    let bestV = lst[0]
    for (let i = 1; i < lst.length; i++) {
      if (lst[i] < bestV) { bestV = lst[i]; best = i }
    }
    return best
  })
  // `sort` accepts a LIST or a VECTOR and returns the same kind, freshly
  // built — the source is never mutated (that would be `sort!`).
  //
  // Until 2026-08-02 the guard was `if (!Array.isArray(lst)) return lst`, and
  // a vector is a SchemeVector, not a JS array, so `(sort (vector 3 1 2) <)`
  // handed back `#(3 1 2)`: the untouched input, wearing the shape of an
  // answer, with no error. Silent-wrong of the worst kind — the caller reads
  // a sorted vector and the first element they trust is the wrong one.
  // Anything that is neither list nor vector still returns unchanged, which
  // is the pre-existing behaviour and not this pass's call to change.
  def('sort', (seq, less) => {
    const items = isVec(seq) ? seq.items : Array.isArray(seq) ? seq : null
    if (items === null) return seq
    // Decorate-sort-undecorate so JS Array.sort can be stable on the
    // shared key while honouring the user's less? predicate.
    const indexed = items.map((v, i) => [v, i])
    indexed.sort((a, b) => {
      const ab = apply(less, [a[0], b[0]], fuelBox) !== false
      const ba = apply(less, [b[0], a[0]], fuelBox) !== false
      if (ab && !ba) return -1
      if (ba && !ab) return 1
      return a[1] - b[1]   // stable
    })
    const out = indexed.map((p) => p[0])
    return isVec(seq) ? new SchemeVector(out) : out
  })

  // ── bricklay-pack-native — JS-backed bottom-left bin-pack (#414) ─────
  //
  // The Scheme cart `carts/layout/bricklay.sks` used to run a pure-Scheme
  // FFD bottom-left fill — O(N³)-in-Scheme-primitives because every
  // (cdr ...) sliced a fresh list, every (cons …) reallocated, and the
  // overlap walk and candidate regeneration each cost O(N) per card.
  // The 22-card production roster needed 4M fuel to land.
  //
  // This primitive lifts the *algorithm* into JS so the per-step cost
  // collapses to native array ops. The cart calls this once with its
  // sorted card list (sort is already JS) and dispatches `move-card`
  // for each (id x y) the primitive returns. Output is byte-identical
  // to the prior Scheme implementation on every existing fixture; only
  // the cost changes.
  //
  // Algorithm — preserved exactly so tests pass byte-for-byte:
  //   1. Iterate cards in input order (caller sorts via FFD).
  //   2. Build candidate anchors: origin at the head, then
  //      `right-of-P` and `below-of-P` for each placed P in reverse
  //      placement order (newest first — matches the cart's cons-onto-
  //      head ordering exactly).
  //   3. Valid: x≥MARGIN, y≥MARGIN, x+w ≤ vw-MARGIN, no rect overlap.
  //   4. Best: first valid candidate becomes best; replace only on
  //      strict (cy<by) || (cy==by && cx<bx). First-in-order wins ties.
  //   5. Fallback: (MARGIN, max-bottom + GAP-Y).
  //
  // Inputs:
  //   cards    — list of (id w h) triples; caller pre-sorts.
  //   vw       — viewport width (effective, after canvas-min clamp).
  //   marginX  — left/right margin (BRICKLAY-MARGIN).
  //   marginY  — top margin (BRICKLAY-MARGIN).
  //   gapX     — horizontal gap (BRICKLAY-GAP-X).
  //   gapY     — vertical gap   (BRICKLAY-GAP-Y).
  //
  // Output: list of (id x y) triples in placement order.
  //
  // Complexity: O(N²). Each placement adds 2 anchors (total 2N+1), each
  // selection scans those anchors and tests each against placed cards
  // (O(N) anchors × O(N) overlap = O(N²) per card → O(N³) WORST-CASE
  // but the JS overhead is two orders of magnitude smaller than the
  // Scheme equivalent — see bricklay.test.js benchmark notes).
  def('bricklay-pack-native', (cards, vw, marginX, marginY, gapX, gapY) => {
    if (!Array.isArray(cards) || cards.length === 0) return []
    // ── Memoization (#415) ───────────────────────────────────────────
    // The packer is deterministic — same input, same output. Cache by a
    // 32-bit FNV hash over the canonical (rows, vw, margins, gaps) key.
    // A hit returns the placement list straight from the cache; a miss
    // computes + stores. The cache is bounded (32 entries, LRU) and is
    // invalidated by `bricklayCacheClear()` whenever the host detects a
    // size/priority change. See bricklayCache.js.
    const cacheKey = bricklayCacheKey(cards, vw, marginX, marginY, gapX, gapY)
    if (cacheKey != null) {
      const cached = bricklayCacheGet(cacheKey)
      if (cached) return cached
    }
    // Parallel arrays for placed-card geometry. Avoids tuple allocation
    // per placement and keeps the overlap walk on flat number arrays.
    const px = new Array(cards.length)
    const py = new Array(cards.length)
    const pw = new Array(cards.length)
    const ph = new Array(cards.length)
    let placedCount = 0
    // Anchor buffer. Two new anchors per placement = 2N capacity, plus
    // the origin seed. We never remove entries — the validity check
    // prunes per-iteration.
    const ax = new Array(cards.length * 2 + 1)
    const ay = new Array(cards.length * 2 + 1)
    let anchorCount = 0
    const out = []

    for (let i = 0; i < cards.length; i++) {
      const c = cards[i]
      if (!Array.isArray(c)) continue
      const id = c[0]
      const w = +c[1]
      const h = +c[2]
      if (!isFinite(w) || !isFinite(h)) continue

      // ── Build the candidate list in the cart's iteration order. ────
      // The cart visits anchors in the order [origin, right(newest),
      // below(newest), right(2nd-newest), below(2nd-newest), …]. We
      // mirror that by walking placed in reverse-placement order.
      // For performance we don't materialise the candidate list — we
      // scan and pick the best inline.
      let bestX = 0, bestY = 0, haveBest = false

      // (a) origin anchor.
      {
        const cx = marginX, cy = marginY
        if (cx + w <= vw - marginX && !rectOverlapsAny(cx, cy, w, h, px, py, pw, ph, placedCount)) {
          bestX = cx; bestY = cy; haveBest = true
        }
      }
      // (b) per-placed anchors, walking newest→oldest (cart's order).
      for (let j = placedCount - 1; j >= 0; j--) {
        // right-of-P
        {
          const cx = px[j] + pw[j] + gapX
          const cy = py[j]
          if (cx >= marginX && cy >= marginY &&
              cx + w <= vw - marginX &&
              !rectOverlapsAny(cx, cy, w, h, px, py, pw, ph, placedCount)) {
            if (!haveBest || cy < bestY || (cy === bestY && cx < bestX)) {
              bestX = cx; bestY = cy; haveBest = true
            }
          }
        }
        // below-of-P
        {
          const cx = px[j]
          const cy = py[j] + ph[j] + gapY
          if (cx >= marginX && cy >= marginY &&
              cx + w <= vw - marginX &&
              !rectOverlapsAny(cx, cy, w, h, px, py, pw, ph, placedCount)) {
            if (!haveBest || cy < bestY || (cy === bestY && cx < bestX)) {
              bestX = cx; bestY = cy; haveBest = true
            }
          }
        }
      }

      // (c) Fallback row when no candidate fits — wide card on narrow
      // viewport. (MARGIN, max-bottom + GAP-Y). max-bottom seeded with
      // marginY so a first-card-too-wide still lands at (M, M + gapY).
      if (!haveBest) {
        let maxBottom = marginY
        for (let j = 0; j < placedCount; j++) {
          const b = py[j] + ph[j]
          if (b > maxBottom) maxBottom = b
        }
        bestX = marginX
        bestY = maxBottom + gapY
      }

      // Commit.
      px[placedCount] = bestX
      py[placedCount] = bestY
      pw[placedCount] = w
      ph[placedCount] = h
      placedCount += 1
      // anchor buffer maintenance (kept for completeness even though we
      // don't read it — keeps the API surface honest if a future caller
      // wants the anchor history).
      ax[anchorCount] = bestX + w + gapX; ay[anchorCount] = bestY; anchorCount += 1
      ax[anchorCount] = bestX;            ay[anchorCount] = bestY + h + gapY; anchorCount += 1
      out.push([id, bestX, bestY])
    }
    if (cacheKey != null) bricklayCacheSet(cacheKey, out)
    return out
  })

  // ─── artifact/* — DOM-hosted surface verbs ────────────────────────────
  //
  // These are the Phase-A core verbs from artifact-doctrine-synthesis-2026-07-10.
  // The base env installs THUNK stubs that throw a legible error when the
  // interpreter runs headless (no DOM); the browser-side wiring in
  // site/apps/hello-surface/artifact/verbs.js re-defines them with the
  // real implementations when the surface mounts.
  //
  // Any Scheme program that CALLS one of these verbs is legal in any env
  // — it just can't run in the node interpreter without a shim. The verb
  // NAMES are stable so tooling, linters, and RAG indexers can enumerate
  // the artifact API from the language alone.
  const artifactHeadlessStub = (name) => (...a) => {
    throw new Error(
      `[artifact] '${name}' called in a headless env — install browser verbs ` +
      `from site/apps/hello-surface/artifact/verbs.js first (installArtifactVerbs).`
    )
  }
  const ARTIFACT_VERB_NAMES = [
    'artifact/spawn',
    'artifact/describe',
    'artifact/apply',
    'artifact/read',
    'artifact/on-event',
    'artifact/at-location',
    'artifact/close',
    'artifact/list',
    // Phase B — compose / nest / subscribe-cortex
    'artifact/compose',
    'artifact/nest',
    'artifact/subscribe-cortex',
  ]
  const ARTIFACT_STATE_CHANGE_NAMES = new Set([
    'artifact/spawn',
    'artifact/apply',
    'artifact/close',
    'artifact/compose',
    'artifact/nest',
  ])
  for (const n of ARTIFACT_VERB_NAMES) {
    // Use 'state-change' as the perm for spawn/apply/close/compose/nest
    // (worst-case), 'read' for the pure introspection verbs. Since the
    // stubs throw, the dispatcher never fires them in a headless env;
    // the perm is here for static tooling.
    const perm = ARTIFACT_STATE_CHANGE_NAMES.has(n) ? 'state-change' : 'read'
    e.define(n, artifactHeadlessStub(n), { perm })
  }

  // The rich metadata for every base primitive is registered at module
  // load time (see BASE_META below). `env.define` already stamped each
  // verb with an inferred meta stub; the last-writer-wins path in
  // verbRegistry replaces the stub with the rich shape (name/arity/
  // doc/example) that the introspection surface reads.
  registerBaseMetadata()

  // SLAT primitives — the minimum-viable set the Book of SLAT teaches.
  // See src/slat-verbs.js for the full roster and design notes. Wired
  // here so every consumer that reaches for `makeBaseEnv` gets slat-
  // loads / slat-dumps / slat-key / etc. as first-class Scheme verbs
  // without a follow-up install call. Pre-launch polish item #1.
  installSlatVerbs(e)

  // R7RS-small + SRFI-1/13 + SRFI-125 completions — the FILL PASS from
  // the 2026-07-18 language finalization audit. Adds fold/iota/find/
  // string-split/string-join/hash-table-*/bytevector-*/error/raise/
  // char predicates/etc — the standard/conventional coverage Motoi was
  // missing pre-lock. See src/r7rs-completions.js for the full list
  // and per-verb R7RS/SRFI citations.
  installR7RSCompletions(e, fuelBox)

  return e
}

// ── Rich metadata for every base primitive. ────────────────────────────
//
// The introspection surface (`,help car`, `help('car')`, the CLI
// `motoi help car`) needs the shape the extraction plan
// §"Verb metadata — the ergonomics contract" spells out: name, arity,
// doc, at least one worked example. Without this, the REPL says
// "unknown verb: car" for every base primitive.
//
// The table lives at module scope so `motoi help car` works
// even before any evaluator env has been built — the CLI's `help` path
// never touches an Env. We register at module load once; every fresh
// REPL/CLI process gets the full manifest with zero setup cost.
//
// Shape: [name, arity, doc, exampleCode, namespace?]. arity is a scalar
// number or a `[min, max]` pair (variadic → [min, Infinity]). Every
// entry ships one example (novice tier) at minimum — the beginner
// reading the Motoi Scheme Book Chapter 1 sees a runnable form under `,help X`.
function registerBaseMetadata() {
  const BASE_META = [
    // arithmetic
    ['+',        [0, Infinity], 'Sum of all arguments. Zero args → 0.',                        '(+ 1 2 3) => 6',           'math'],
    ['-',        [1, Infinity], 'Subtract: (- a) negates; (- a b …) folds left.',              '(- 10 3 2) => 5',          'math'],
    ['*',        [0, Infinity], 'Product of all arguments. Zero args → 1.',                    '(* 2 3 4) => 24',          'math'],
    ['/',        [1, Infinity], 'Divide: (/ a) reciprocates; (/ a b …) folds left.',           '(/ 20 2 2) => 5',          'math'],
    ['modulo',   2,             'Mathematical modulo — result has divisor sign.',              '(modulo 7 3) => 1',        'math'],
    ['quotient', 2,             'Integer division, truncated toward zero.',                    '(quotient 7 2) => 3',      'math'],
    ['remainder',2,             'Integer remainder matching quotient.',                        '(remainder 7 2) => 1',     'math'],
    ['max',      [1, Infinity], 'Largest of the given numbers.',                               '(max 3 1 4 1 5) => 5',     'math'],
    ['min',      [1, Infinity], 'Smallest of the given numbers.',                              '(min 3 1 4 1 5) => 1',     'math'],
    ['abs',      1,             'Absolute value.',                                             '(abs -7) => 7',            'math'],
    ['sqrt',     1,             'Square root. Exact when the argument is exact and the root is representable.', '(sqrt 1/4) => 1/2',        'math'],
    ['expt',     2,             'Base raised to the power. (expt b p) => b^p.',                '(expt 2 10) => 1024',      'math'],
    ['floor',    1,             'Round DOWN to an integer.',                                   '(floor 3.7) => 3',         'math'],
    ['ceil',     1,             'Round UP to an integer.',                                     '(ceil 3.2) => 4',          'math'],
    ['ceiling',  1,             'Round UP to an integer (R7RS alias for ceil).',               '(ceiling 3.2) => 4',       'math'],
    ['round',    1,             'Round to the nearest integer, halfway to even. Works on exact rationals.', '(round 9/10) => 1',        'math'],
    ['log',      [1, 2],        '(log z) natural logarithm; (log z1 z2) logarithm of z1 in base z2. R7RS §6.2.6.', '(log 8 2) => 3',           'math'],
    ['sign',     1,             '-1, 0, or 1 by the sign of x.',                               '(sign -8) => -1',          'math'],
    ['clamp',    3,             '(clamp x lo hi) — clamp x into [lo, hi].',                    '(clamp 15 0 10) => 10',    'math'],
    ['lerp',     3,             '(lerp a b t) — linear interpolation.',                        '(lerp 0 10 0.5) => 5',     'math'],
    ['sin',      1,             'Sine (radians).',                                             '(sin 0) => 0',             'math'],
    ['cos',      1,             'Cosine (radians).',                                           '(cos 0) => 1',             'math'],
    ['tan',      1,             'Tangent (radians).',                                          '(tan 0) => 0',             'math'],
    ['atan2',    2,             '(atan2 y x) — arc-tangent by quadrant.',                      '(atan2 1 1) => 0.785…',    'math'],
    ['sum',      1,             'Sum every element of a list.',                                '(sum (list 1 2 3)) => 6',  'math'],
    ['mean',     1,             'Arithmetic mean of a list.',                                  '(mean (list 2 4 6)) => 4', 'math'],

    // comparisons + logic
    ['=',        [1, Infinity], 'Numeric equality across the whole chain. R7RS §6.2.6.',        '(= 1 1 2) => #f',      'compare'],
    ['<',        [1, Infinity], 'Strictly increasing across the whole chain.',                  '(< 1 2 3) => #t',      'compare'],
    ['>',        [1, Infinity], 'Strictly decreasing across the whole chain.',                  '(> 3 2 1) => #t',      'compare'],
    ['<=',       [1, Infinity], 'Non-decreasing across the whole chain.',                       '(<= 1 1 2) => #t',     'compare'],
    ['>=',       [1, Infinity], 'Non-increasing across the whole chain.',                       '(>= 2 2 1) => #t',     'compare'],
    ['not',      1, 'Logical negation of #f/#t.','(not #f) => #t',      'logic'],
    ['=?',       2, 'Smart equality — numbers/strings by value, lists deep, symbols by name.', "(=? '(1 2) '(1 2)) => #t", 'compare'],
    ['eq?',      2, 'Reference / structural equality.',    '(eq? 3 3) => #t',   'compare'],
    ['eqv?',     2, 'Equivalence (numbers/chars by value); collapses to =? in Motoi.', '(eqv? 3 3) => #t', 'compare'],
    ['equal?',   2, 'Structural equality (deep, list-aware).', "(equal? '(1 2) '(1 2)) => #t", 'compare'],

    // predicates
    ['null?',    1, '#t if arg is the empty list.',   "(null? '()) => #t",       'predicate'],
    ['pair?',    1, '#t if arg is a non-empty list.', "(pair? '(1 2)) => #t",    'predicate'],
    ['symbol?',  1, '#t if arg is a symbol.',         "(symbol? 'x) => #t",      'predicate'],
    ['procedure?', 1,'#t if arg is a function.',      '(procedure? car) => #t',  'predicate'],
    ['zero?',    1, '#t if arg equals 0.',            '(zero? 0) => #t',         'predicate'],
    ['positive?', 1,'#t if arg is > 0.',              '(positive? 3) => #t',     'predicate'],
    ['negative?', 1,'#t if arg is < 0.',              '(negative? -3) => #t',    'predicate'],
    ['even?',    1, '#t if arg is an even integer.',  '(even? 4) => #t',         'predicate'],
    ['odd?',     1, '#t if arg is an odd integer.',   '(odd? 3) => #t',          'predicate'],
    ['number?',  1, '#t if arg is a number.',         '(number? 3) => #t',       'predicate'],
    ['string?',  1, '#t if arg is a string.',         '(string? "x") => #t',     'predicate'],
    ['boolean?', 1, '#t if arg is #t or #f.',         '(boolean? #t) => #t',     'predicate'],

    // lists — the core ergonomic surface
    ['list',    [0, Infinity], 'Build a list from the given elements.',            '(list 1 2 3) => (1 2 3)',           'list'],
    ['cons',    2,             'Prepend a to list b. (cons 1 (list 2 3)) → (1 2 3).', '(cons 1 (list 2 3)) => (1 2 3)', 'list'],
    ['car',     1,             'The first element of a non-empty list.',           '(car (list 1 2 3)) => 1',           'list'],
    ['cdr',     1,             'Everything but the first element.',                '(cdr (list 1 2 3)) => (2 3)',       'list'],
    ['set-car!', 2,            '(set-car! pair obj) — replace the first element IN PLACE. R7RS §6.4.', '(let ((p (cons 1 2))) (set-car! p 9) p) => (9 . 2)', 'list'],
    ['set-cdr!', 2,            '(set-cdr! pair obj) — replace the tail IN PLACE. R7RS §6.4.',          '(let ((p (cons 1 2))) (set-cdr! p 3) p) => (1 . 3)', 'list'],
    ['cadr',    1,             'The second element. Alias for (car (cdr x)).',     '(cadr (list 1 2 3)) => 2',          'list'],
    ['caddr',   1,             'The third element. Alias for (car (cdr (cdr x))).', '(caddr (list 1 2 3)) => 3',         'list'],
    ['length',  1,             'How many elements in the list.',                   '(length (list 1 2 3)) => 3',        'list'],
    ['range',   2,             '(range a b) → list [a, a+1, …, b-1].',             '(range 0 5) => (0 1 2 3 4)',        'list'],
    ['append',  [0, Infinity], 'Concatenate lists.',                               '(append (list 1) (list 2 3)) => (1 2 3)', 'list'],
    ['reverse', 1,             'Reverse a list.',                                  '(reverse (list 1 2 3)) => (3 2 1)', 'list'],
    ['first',   1,             'First element.',                                   '(first (list 1 2 3)) => 1',         'list'],
    ['last',    1,             'Last element.',                                    '(last (list 1 2 3)) => 3',          'list'],
    ['nth',     2,             '(nth lst i) — the i-th element (0-indexed).',      '(nth (list 10 20 30) 1) => 20',     'list'],
    ['list-ref',2,             '(list-ref lst i) — R7RS spelling for nth.',        '(list-ref (list 10 20 30) 1) => 20','list'],
    ['member',  [2, 3],        '(member x lst [compare]) → tail beginning at x, or #f. compare replaces equal?.', "(member 2 '(1 2 3)) => (2 3)",      'list'],
    ['assoc',   [2, 3],        '(assoc key alist [compare]) — first pair whose car equals key, or #f.', "(assoc 'a '((a 1)(b 2))) => (a 1)", 'list'],
    ['make-list', 2,           '(make-list n v) → list of length n filled with v.', '(make-list 3 0) => (0 0 0)',       'list'],
    ['list-set', 3,            '(list-set lst i v) → a NEW list with element i replaced.', '(list-set (list 1 2 3) 1 9) => (1 9 3)', 'list'],
    ['take',    2,             '(take lst n) — first n elements.',                 '(take (list 1 2 3 4) 2) => (1 2)',  'list'],
    ['drop',    2,             '(drop lst n) — everything AFTER the first n.',     '(drop (list 1 2 3 4) 2) => (3 4)',  'list'],
    ['zip',     2,             'Pair up two lists element-wise.',                  '(zip (list 1 2) (list 3 4)) => ((1 3) (2 4))', 'list'],
    ['sort',    2,             '(sort seq less?) — stable ascending sort of a list or vector; returns the same kind.', '(sort (list 3 1 2) <) => (1 2 3)',  'list'],
    ['argmin',  1,             'Index of the smallest number in the list.',        '(argmin (list 5 2 8 2)) => 1',      'list'],

    // higher-order — the ones the REPL beginner reaches for
    ['for-each', 2,            'Call fn on every element for side-effects.',       '(for-each display (list 1 2))',     'higher-order'],
    ['map',      2,            'Apply fn to every element, collect the results.',  '(map (lambda (x) (* x x)) (list 1 2 3)) => (1 4 9)', 'higher-order'],
    ['filter',   2,            'Keep every element for which (pred x) is truthy.', '(filter odd? (list 1 2 3 4 5)) => (1 3 5)',          'higher-order'],
    ['reduce',   3,            '(reduce fn init lst) — left fold.',                '(reduce + 0 (list 1 2 3 4)) => 10',                  'higher-order'],
    ['apply',    2,            '(apply fn args) — call fn with the list of args.', '(apply + (list 1 2 3)) => 6',       'higher-order'],
    ['any',      2,            '#t if pred is truthy for some element.',           '(any odd? (list 2 4 5)) => #t',     'higher-order'],
    ['every',    2,            '#t if pred is truthy for every element.',          '(every odd? (list 1 3 5)) => #t',   'higher-order'],
    ['count',    2,            'How many elements satisfy pred.',                  '(count odd? (list 1 2 3 4)) => 2',  'higher-order'],
    ['list-index', [2, Infinity], 'Index of the first step where pred is truthy across one or more parallel lists, or #f. SRFI-1.', '(list-index odd? (list 2 4 5)) => 2', 'higher-order'],

    // strings
    ['string-append',  [0, Infinity], 'Concatenate any number of strings.',                  '(string-append "hi" " " "there") => "hi there"', 'string'],
    ['string-length',  1,             'Character count.',                                    '(string-length "abc") => 3',            'string'],
    ['string-ref',     2,             '(string-ref s i) — the i-th character.',              '(string-ref "abc" 1) => "b"',           'string'],
    ['string=?',      [1, Infinity], 'String equality across the whole chain. R7RS §6.7.', '(string=? "a" "a" "b") => #f',          'string'],
    ['string-eq?',    [1, Infinity], 'String equality — Motoi-own alias for string=?.',      '(string-eq? "a" "a") => #t',            'string'],
    ['substring',     [2, 3],         '(substring s a [b]) — the part of s from index a up to (not including) b, or to the end if b is omitted. Conforms to R7RS §6.7: requires 0 <= a <= b <= (string-length s) and RAISES otherwise. It does not clamp. To TEST a prefix reach for string-prefix?, which cannot go out of range; to TRUNCATE to at most n characters write (substring s 0 (min n (string-length s))).', '(substring "hello" 1 4) => "ell"',      'string'],
    ['number->string',[1, 2],         '(number->string n [radix]) — number to string.',      '(number->string 255 16) => "ff"',       'string'],
    ['string->number',[1, 2],         '(string->number s [radix]) — parse a number. The WHOLE string must be a number, otherwise #f. Reads exact rationals.', '(string->number "1/2") => 1/2',         'string'],

    // I/O
    ['display', 1, 'Print value to stdout (strings unquoted). Returns void.', '(display "hi") ; prints hi',  'io'],
    ['newline', 0, 'Print a newline to stdout. Returns void.',                '(newline)',                   'io'],
    ['inspect', 1, 'Return a pretty string for any value.',                   '(inspect (list 1 2)) => "(1 2)"', 'io'],

    // randomness
    ['rng-uniform',  0, 'Uniform random in [0, 1).',                          '(rng-uniform) => 0.72…',           'random'],
    ['randint',      2, '(randint a b) — random integer in [a, b).',          '(randint 0 10) => 3',              'random'],
    ['random-int',   1, '(random-int n) — random integer in [0, n).',         '(random-int 6) => 4',              'random'],
    ['random-range', 2, '(random-range lo hi) — uniform float in [lo, hi).',  '(random-range 0 1) => 0.42…',      'random'],
    ['random-pick',  1, 'A random element from the list.',                    '(random-pick (list 1 2 3)) => 2',  'random'],
    ['pi',           0, 'The constant π (3.14159…).',                         '(pi)',                             'math'],
  ]

  for (const [name, arity, doc, exampleCode, namespace] of BASE_META) {
    registerVerbMeta(name, {
      name,
      arity,
      doc,
      examples: exampleCode ? [{ level: 'novice', code: exampleCode }] : [],
      namespace: namespace || null,
      perm: 'read',
      tier: 'base',
      source: 'src/base.js',
      since: 'motoi-scheme@0.1',
    })
  }
}

// Register once at module load so `motoi help car` works even
// before makeBaseEnv is called (the CLI's `help` command path never
// touches an Env).
registerBaseMetadata()

/**
 * Export the artifact verb roster as data so introspection / RAG / docs
 * can enumerate it without evaluating an env.
 */
export const ARTIFACT_CORE_VERBS = Object.freeze([
  { name: 'artifact/spawn',       arity: '(type . kwargs)', perm: 'state-change', returns: 'id' },
  { name: 'artifact/describe',    arity: '(id)',            perm: 'read',         returns: 'alist' },
  { name: 'artifact/apply',       arity: '(id form)',       perm: 'state-change', returns: 'new-state' },
  { name: 'artifact/read',        arity: '(id . path-kws)', perm: 'read',         returns: 'value | #f' },
  { name: 'artifact/on-event',    arity: '(id name proc)',  perm: 'read',         returns: 'unsubscribe-proc' },
  { name: 'artifact/at-location', arity: '(id)',            perm: 'read',         returns: '(x y w h) | #f' },
  { name: 'artifact/close',       arity: '(id)',            perm: 'state-change', returns: '#t | #f' },
  { name: 'artifact/list',        arity: '()',              perm: 'read',         returns: '(id ...)' },
])

/**
 * Phase-B artifact verbs — compose, nest, subscribe-cortex. Registered
 * separately so consumers can enumerate the two phases distinctly (RAG
 * indexers, docs emitters, taxonomy tools). Every entry still ships as
 * a headless stub via ARTIFACT_VERB_NAMES above; the real
 * implementation is wired by installArtifactVerbs (which now installs
 * both phases).
 */
export const ARTIFACT_PHASE_B_VERBS = Object.freeze([
  {
    name: 'artifact/compose',
    arity: '(primitives . kwargs)',
    perm: 'state-change',
    returns: 'id',
    doc: 'Ad-hoc composition. Build an artifact from a primitives list without a pre-registered composition. Kwargs: :chrome sym, :state expr, :type name, :frosting sym.',
    examples: [
      { level: 'novice',       code: "(artifact/compose (list 'heading 'paragraph) :chrome 'clean-surface :state '(:title \"Hi\"))" },
      { level: 'intermediate', code: "(artifact/compose (list (list 'heading :level 1) 'markdown-body) :chrome 'clean-surface :state '(:title \"Cases\" :body \"…\"))" },
      { level: 'expert',       code: "(let ((id (artifact/compose (list 'chat-log 'input-row) :chrome 'clean-surface :state '(:messages ())))) (artifact/apply id '(set :messages (list \"hi\"))))" },
    ],
  },
  {
    name: 'artifact/nest',
    arity: '(parent-id child . kwargs)',
    perm: 'state-change',
    returns: 'child-id',
    doc: 'Recursive rendering. Attach a child composition into a named slot on a parent. :where slot-symbol, :props initial-alist. Nested address syntax: parent-id:slot:child-id.',
    examples: [
      { level: 'novice',       code: "(artifact/nest shop-1 'listing :where 'items :props '(:sku \"A-1\"))" },
      { level: 'intermediate', code: "(artifact/nest shop-1 'listing :where 'items :props '(:sku \"A-1\")) (artifact/nest shop-1 'listing :where 'items :props '(:sku \"A-2\"))" },
      { level: 'expert',       code: "(let ((child (artifact/nest shop-1 'review-form :where 'reviews :props '(:for \"A-1\")))) (artifact/on-event shop-1 'child.* (lambda (r) (display r))))" },
    ],
  },
  {
    name: 'artifact/subscribe-cortex',
    arity: '(artifact-id cortex-path :on-change form)',
    perm: 'read',
    returns: 'subscription-id',
    doc: "Cortex return path. Fire a verb-form on the artifact when a Cortex node/edge changes. Cortex path uses ':' segments with '*' wildcards. The incoming change value is appended to the form's arguments.",
    examples: [
      { level: 'novice',       code: "(artifact/subscribe-cortex chat-1 \"cortex:message:*\" :on-change '(refresh))" },
      { level: 'intermediate', code: "(artifact/subscribe-cortex shop-1 \"shop:listing:*:price\" :on-change '(reprice))" },
      { level: 'expert',       code: "(let ((sub (artifact/subscribe-cortex chat-1 \"cortex:*\" :on-change '(update-from-cortex)))) sub)" },
    ],
  },
])

// rectOverlapsAny — strict overlap against the parallel placed-rect
// arrays. Strict because two cards touching at edges (a.x + a.w === b.x)
// are NOT overlapping — the GAP lives between them.
function rectOverlapsAny(x, y, w, h, px, py, pw, ph, n) {
  const xr = x + w
  const yb = y + h
  for (let i = 0; i < n; i++) {
    if (x < px[i] + pw[i] && px[i] < xr &&
        y < py[i] + ph[i] && py[i] < yb) return true
  }
  return false
}

function deepEqual(a, b) {
  if (a === b) return true
  // Symbols/keywords compare by name — two `Sym` instances with the same
  // name are `equal?` even when they are distinct objects (e.g. one from the
  // reader, one built in JS via `new Sym`). Without this, assoc/member/equal?
  // silently miss symbol keys.
  if (a instanceof Sym && b instanceof Sym) return a.name === b.name
  // A dotted pair is equal? to another dotted pair, component-wise. It is
  // never equal? to a list — `(a . 1)` and `(a 1)` are distinct values,
  // which is exactly the distinction that was missing before 2026-08-01.
  if (a instanceof Pair || b instanceof Pair) {
    return a instanceof Pair && b instanceof Pair &&
      deepEqual(a.car, b.car) && deepEqual(a.cdr, b.cdr)
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]))
  }
  return false
}
