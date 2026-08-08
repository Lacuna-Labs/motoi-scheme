// lib/std/srfi-1.js — SRFI-1: List Library (the working-Scheme list baseline).
//
// Relocated 2026-07-24 from src/r7rs-completions.js (full standard-library
// relocation into per-part libs). This is the SRFI-1 PART: its own bucket,
// its own spec kept alongside (STD-PARTS.slat / spec/srfi-1.slatl), and
// every verb conformance-tracked. Default bundle installs it EAGER
// alongside R7RS-small.
//
// Provenance: SRFI-1 (Olin Shivers). https://srfi.schemers.org/srfi-1/
//
// NOTE on `reduce` (lives in src/base.js, not this part's VERBS list):
//   Conformed 2026-07-25 to SRFI-1: element-first (f elem acc), ridentity
//   IGNORED for a non-empty list (returned only for the empty list). Was
//   previously acc-first + seed-consuming (an R6RS fold-left shape). The
//   surviving cross-standard trap — SRFI-1 reduce ignores the seed for a
//   non-empty list whereas R6RS fold-left / Racket foldl fold it in every
//   time — is taught in broken-examples/reduce-arg-order.slatl.

import { apply, Closure } from '../../src/interp.js'
import { Sym, Pair } from '../../src/reader.js'
import { Values } from '../base/r7rs-types.js'
import { registerPartMeta } from './_shared.js'

import { NIL, arrayToList, bumpListEpoch, isList, isListish, isNull, isPair, listLength, listToArray, pairToString, seqVerb, toJS, toScheme } from '../base/list.js'
export const STD = 'SRFI-1'
export const SPEC = 'spec/srfi-1.slatl'
export const LAZY = false // default bundle: eager with R7RS-small

export const VERBS = [
  'iota', 'fold', 'fold-right', 'concatenate', 'append-map', 'filter-map',
  'partition', 'find', 'delete-duplicates', 'remove', 'delete', 'unfold',
  'take-while', 'drop-while', 'last-pair', 'cons*', 'list-tabulate', 'unzip',
  'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth',
  'ninth', 'tenth',
  // Surface completion 2026-08-02 — SRFI-1 procedures that were declared by
  // the standard but never wired. Constructors + searchers + the whole lset
  // (set-operations-on-lists) family.
  'xcons', 'proper-list?', 'span', 'break', 'take-right', 'drop-right',
  'split-at', 'reduce-right', 'append-reverse',
  'lset-adjoin', 'lset-union', 'lset-intersection', 'lset-difference',
  'lset<=', 'lset=', 'list=',
  // Surface completion 2026-08-03 — the rest of the SRFI-1 surface: the
  // predicates over improper/circular lists, the pair-level folds, the alist
  // family, the remaining unzips, and the two missing lset verbs.
  'not-pair?', 'circular-list', 'circular-list?', 'dotted-list?', 'null-list?',
  'length+', 'car+cdr', 'find-tail', 'map-in-order', 'unfold-right',
  'alist-cons', 'alist-copy', 'alist-delete',
  'pair-fold', 'pair-fold-right', 'pair-for-each',
  'unzip1', 'unzip2', 'unzip3', 'unzip4', 'unzip5',
  'lset-xor', 'lset-diff+intersection',
  // SRFI-1's linear-update variants. The standard PERMITS them to reuse their
  // argument's storage, and reuse is the whole reason the names exist — a `!`
  // verb that allocates is a slower alias of its twin. Motoi implements the
  // STRONG reading: the ones below that can reuse, do. See the section at the
  // bottom of `installSRFI1` for which reuse and which are still aliases.
  'append!', 'reverse!', 'append-reverse!', 'filter!', 'remove!', 'partition!',
  'append-map!', 'take-while!', 'drop-while!', 'find-tail!', 'filter-map!',
  'pair-for-each!',
  'delete!', 'delete-duplicates!', 'concatenate!', 'take!', 'drop-right!',
  'split-at!', 'span!', 'break!', 'map!', 'alist-delete!',
  'lset-adjoin!', 'lset-union!', 'lset-intersection!', 'lset-difference!',
  'lset-xor!', 'lset-diff+intersection!',
]

// ── teaching-quality guards ─────────────────────────────────────────
// A list is a chain of cons cells. The verbs named in `_RAW` below see that
// chain; every other verb is wrapped at its installer and still receives a
// JavaScript array, because it takes a list as a SEQUENCE and has no opinion
// about cell identity. The guards here must therefore answer for BOTH
// spellings — see the header of lib/base/list.js.
//
// They exist so a learner who hands a dotted pair to a list verb reads a
// sentence about lists instead of a raw JS "x.map is not a function".
// Same shape as `_needList` in src/base.js — that is the house pattern.

function _describe (v) {
  if (v === undefined) return 'nothing'
  if (v === null) return 'the empty list ()'
  if (v === true) return 'the boolean #t'
  if (v === false) return 'the boolean #f'
  if (typeof v === 'number') return `the number ${v}`
  if (typeof v === 'string') return `the string ${JSON.stringify(v)}`
  if (v instanceof Sym) return `the symbol ${v.name}`
  if (typeof v === 'function' || v instanceof Closure) return 'a procedure'
  if (isNull(v)) return 'the empty list ()'
  if (isList(v)) {
    const n = Array.isArray(v) ? v.length : listLength(v)
    return `a list of ${n} element${n === 1 ? '' : 's'}`
  }
  if (v instanceof Pair) return 'an improper (dotted) pair'
  return 'a value of some other kind'
}

function _needList (name, v) {
  if (isList(v)) return v
  if (v instanceof Pair) {
    throw new Error(
      `${name}: expected a proper list, got an improper (dotted) pair. ` +
      `${name} walks a list all the way to the end, and a dotted pair like ` +
      `(1 2 . 3) never gets there — its last cdr is 3, not (). Build it with ` +
      `(list 1 2 3), or cons onto a list: (cons 1 (list 2 3)).`)
  }
  throw new Error(
    `${name}: expected a proper list, got ${_describe(v)}. ` +
    `Wrap it up first — (list x) makes a one-element list.`)
}

function _needProc (name, v, what) {
  if (typeof v === 'function' || v instanceof Closure) return v
  const hint = name.startsWith('lset')
    ? ` Every SRFI-1 lset procedure takes the equality test FIRST: (${name} equal? list1 list2 ...).`
    : ` Pass a procedure — (lambda (x) ...) — not the result of calling one.`
  throw new Error(`${name}: expected ${what}, got ${_describe(v)}.${hint}`)
}

export function installSRFI1 (env, fuelBox) {
  // Sequence verbs take a list as a SEQUENCE and are wrapped at the cell
  // boundary so they keep receiving a JavaScript array. `_RAW` names the ones
  // whose meaning IS the cell — identity, sharing, or in-place mutation — and
  // those are installed untouched and written against the chain.
  // `filter-map` and `pair-for-each!` are raw for a different reason than the
  // rest: not identity, but TERMINATION. Both may legally be handed a circular
  // list (SRFI-1 stops at the shortest argument), and `seqVerb` converts an
  // argument to an array BEFORE the verb runs — a conversion a cycle never
  // returns from. A verb that must survive a cycle has to see the cells.
  const _RAW = new Set(['last-pair', 'pair-fold', 'pair-fold-right', 'pair-for-each', 'pair-for-each!', 'circular-list', 'circular-list?', 'proper-list?', 'dotted-list?', 'not-pair?', 'null-list?', 'length+', 'filter-map', 'filter-map!', 'take!', 'drop-right!', 'split-at!', 'append!', 'map!', 'filter!', 'remove!', 'partition!', 'take-while!', 'span!', 'break!', 'delete!', 'delete-duplicates!', 'alist-delete!', 'reverse!', 'append-reverse!', 'concatenate!', 'set-car!', 'set-cdr!', 'cons', 'car', 'cdr', 'last'])
  const def = (n, f, perm = 'read') =>
    env.define(n, _RAW.has(n) ? f : seqVerb(f), { perm })

  // ── cell-world helpers, shared by every raw verb below ──────────────
  // A raw verb is normally handed the caller's own chain. It can still be
  // reached with an ARRAY — through an alias that `def` wrapped in `seqVerb`,
  // or from a value that already crossed the boundary — and `toScheme` is
  // memoized, so converting one back yields the SAME chain the array was made
  // from rather than a copy. Identity survives either route, which is why the
  // linear-update verbs can be strict about reuse without being brittle.
  const _chain = (name, l) => {
    if (l === NIL || l === null || l === undefined) return NIL
    if (l instanceof Pair) return l
    if (Array.isArray(l)) return toScheme(l)
    return _needList(name, l) // throws with the teaching message
  }

  // Length of a chain, stopping at whatever tail it has. Never throws: the
  // callers here have already decided what an improper tail means to them.
  const _chainLength = (chain) => {
    let n = 0
    for (let x = chain; x instanceof Pair; x = x.cdr) n++
    return n
  }

  // The cell k steps in, or the non-pair the chain ended on if it is shorter.
  const _nth = (chain, k) => {
    let x = chain
    for (let i = 0; i < k && x instanceof Pair; i++) x = x.cdr
    return x
  }

  const _lastCell = (chain) => {
    let x = chain
    while (x.cdr instanceof Pair) x = x.cdr
    return x
  }

  // The elements of a list, whichever way it is spelled. This is the answer to
  // the `isList` trap: `isList(v)` is #t for a chain AND for a JS array (see the
  // header of lib/base/list.js), so code that guards with it and then reaches
  // for `v.length` / `v.map` / `v[i]` reads `undefined` off a chain and reports
  // success — `Math.min(Infinity, undefined)` is NaN, `i < NaN` is false, the
  // loop never runs, nothing throws. Every guard below that is followed by an
  // array reach goes through here first.
  const _elems = (v) => {
    if (Array.isArray(v)) return v
    const out = []
    for (let x = v; x instanceof Pair; x = x.cdr) out.push(x.car)
    return out
  }

  // (iota count [start [step]]) — SRFI-1. Numeric range with start+step.
  def('iota', (count, start = 0, step = 1) => {
    const n = Math.max(0, count | 0)
    const out = new Array(n)
    for (let i = 0; i < n; i++) out[i] = start + i * step
    return out
  })

  // fold / fold-right are N-ARY OVER LISTS — SRFI-1 §Fold, Unfold & Map:
  //   (fold kons knil list1 list2 ...)
  //   (fold-right kons knil list1 list2 ...)
  // With n lists, kons is called with n+1 arguments and THE ACCUMULATOR COMES
  // LAST: (kons e1 e2 ... acc). The walk stops when the SHORTEST list runs out
  // (SRFI-1's %cars+cdrs+ / %cdrs return nothing the moment any list is spent),
  // which is the same shortest-stop rule map/for-each already use here.
  //
  // Both were bound as three-argument arrows until 2026-08-02, so every list
  // past the first was silently DROPPED: (fold + 0 '(1 2) '(10 20)) answered 3
  // instead of 33. Silent-wrong, no error, no warning.
  //
  // The one-list path is unchanged: args are still [elem, acc], so
  // (fold cons '() '(1 2 3)) still answers (3 2 1).
  //
  // `()` reads as null in Motoi (an array is a PROPER list), so a non-array is
  // treated as the empty list and folds to init — the historical lenient
  // behaviour, deliberately preserved. Raising on a genuine non-list is a
  // stricter reading the 2026-08-02 decisions file does not settle.
  //
  // `_elems` rather than a bare `l` behind the `isList` guard: `isList` is #t
  // for a chain too, and `Math.min(Infinity, undefined)` is NaN, so `i < stop`
  // would be false on the first test and the fold would answer its own seed.
  const _foldLists = (lists) => lists.map((l) => (isList(l) ? _elems(l) : []))
  const _foldStop = (ls) => ls.reduce((m, l) => Math.min(m, l.length), Infinity)

  // (fold f init lst1 lst2 ...) — SRFI-1 left fold. Element-first, acc LAST.
  def('fold', (fn, init, ...lists) => {
    if (lists.length === 0) return init
    const ls = _foldLists(lists)
    const stop = _foldStop(ls)
    let acc = init
    for (let i = 0; i < stop; i++) {
      const args = ls.map((l) => l[i])
      args.push(acc)
      acc = apply(fn, args, fuelBox)
    }
    return acc
  })

  // (fold-right f init lst1 lst2 ...) — SRFI-1 right fold. Element-first,
  // acc LAST. Walks the shortest common prefix from its far end back.
  def('fold-right', (fn, init, ...lists) => {
    if (lists.length === 0) return init
    const ls = _foldLists(lists)
    const stop = _foldStop(ls)
    let acc = init
    for (let i = stop - 1; i >= 0; i--) {
      const args = ls.map((l) => l[i])
      args.push(acc)
      acc = apply(fn, args, fuelBox)
    }
    return acc
  })

  // (concatenate lst-of-lsts) — SRFI-1. Flatten one level.
  def('concatenate', (lst) => {
    if (!isList(lst)) return []
    return [].concat(...lst.map((x) => isList(x) ? x : [x]))
  })

  // SRFI-1 gives both of these the n-ary signature `(f lst1 lst2 ...)`, and
  // both used to take exactly one list and SILENTLY DROP the rest — so the
  // callback's extra parameters bound to nothing and the body failed with
  // "expected a number, got nothing", pointing at the callback instead of at
  // the verb that never passed the argument. Shortest-stop matches `map`.
  const _rowsOf = (name, lists) => {
    if (lists.length === 0 || !lists.every((l) => isList(l))) return null
    // `isList` passed a chain too, and `l.length` on one is `undefined`, so the
    // row count came out NaN and the verb quietly answered the empty list.
    const ls = lists.map(_elems)
    const n = Math.min(...ls.map((l) => l.length))
    const rows = []
    for (let i = 0; i < n; i++) rows.push(ls.map((l) => l[i]))
    return rows
  }

  // (append-map f lst1 lst2 ...) — SRFI-1. Map then concatenate.
  def('append-map', (fn, ...lists) => {
    const rows = _rowsOf('append-map', lists)
    if (rows === null) return []
    return [].concat(...rows.map((args) => {
      const r = apply(fn, args, fuelBox)
      return isList(r) ? r : [r]
    }))
  })

  // (filter-map f lst1 lst2 ...) — SRFI-1. Map, then drop #f results.
  //
  // Installed RAW, unlike its neighbours, because SRFI-1's shortest-stop rule
  // makes a CIRCULAR argument legal so long as some other argument is finite:
  //   (filter-map f '(a 1 b 3 c 7) (circular-list 1 2))
  // `seqVerb` would convert every argument to an array before the verb ran, and
  // a cycle has no array spelling — the walk hit the 10-million-cell cap and
  // reported "circular list passed to a verb that expects a proper list" about
  // an expression the standard allows. Walking cells lets the finite list stop
  // the loop, which is exactly what shortest-stop means.
  //
  // If EVERY argument cycles there is no shortest, so that is refused up front
  // rather than left to spin.
  def('filter-map', (fn, ...lists) => {
    if (lists.length === 0) return NIL
    const cursors = lists.map((l) => _chain('filter-map', l))
    // A non-list argument folds to the empty list, matching the lenient
    // reading the other n-ary verbs here already use.
    if (cursors.some((c) => !(c instanceof Pair))) return NIL
    if (cursors.every((c) => _cycles(c))) {
      throw new Error('filter-map: every argument list is circular, so there is no shortest one to stop at. ' +
        'SRFI-1 stops at the shortest list, which means at least one argument has to be finite.')
    }
    const out = []
    while (cursors.every((c) => c instanceof Pair)) {
      const r = apply(fn, cursors.map((c) => c.car), fuelBox)
      if (r !== false) out.push(r)
      for (let i = 0; i < cursors.length; i++) cursors[i] = cursors[i].cdr
    }
    return arrayToList(out)
  })

  // (partition pred lst) — SRFI-1. Two-list split. Returns TWO values
  // (in-list out-list) per spec; consume with call-with-values / let-values /
  // receive. `values`/`call-with-values` machinery is live (R7RS §6.10).
  def('partition', (pred, lst) => {
    if (!isList(lst)) return new Values([[], []])
    const yes = [], no = []
    for (const x of lst) {
      if (apply(pred, [x], fuelBox) !== false) yes.push(x)
      else no.push(x)
    }
    return new Values([yes, no])
  })

  // (find pred lst) — SRFI-1. First element satisfying pred, or #f.
  def('find', (pred, lst) => {
    if (!isList(lst)) return false
    for (const x of lst) if (apply(pred, [x], fuelBox) !== false) return x
    return false
  })

  // (delete-duplicates lst [=]) — SRFI-1. Keep first occurrence. An optional
  // comparator is called as (= kept candidate), kept-element first, and forces
  // the O(n^2) pairwise walk the spec describes — a hash key cannot stand in
  // for an arbitrary equality predicate.
  def('delete-duplicates', (lst, eq) => {
    if (!isList(lst)) return lst
    const out = []
    if (eq) {
      for (const x of lst) {
        let dup = false
        for (const k of out) {
          if (apply(eq, [k, x], fuelBox) !== false) { dup = true; break }
        }
        if (!dup) out.push(x)
      }
      return out
    }
    const seen = new Set()
    for (const x of lst) {
      const k = _key(x)
      if (!seen.has(k)) { seen.add(k); out.push(x) }
    }
    return out
  })

  // (remove pred lst) — SRFI-1. Keep elements NOT satisfying pred.
  def('remove', (pred, lst) => {
    if (!isList(lst)) return []
    return lst.filter((x) => apply(pred, [x], fuelBox) === false)
  })

  // (delete x lst [=]) — SRFI-1. Remove every element equal to x. Default
  // equality is structural (Motoi collapses eq?/eqv?/equal? to one _eqQ);
  // an optional comparator is called as (= x elem).
  const _key = (v) => (v instanceof Sym) ? 'sym:' + v.name
    : typeof v === 'string' ? 'str:' + v
    : typeof v === 'number' ? 'num:' + v
    : JSON.stringify(v)
  def('delete', (x, lst, eq) => {
    if (!isList(lst)) return []
    if (eq) return lst.filter((y) => apply(eq, [x, y], fuelBox) === false)
    const k = _key(x)
    return lst.filter((y) => _key(y) !== k)
  })

  // (unfold p f g seed [tail-gen]) — SRFI-1. Build a list from a seed:
  // while (p seed) is false, cons (f seed) and step the seed with (g seed).
  // When (p seed) becomes true, the tail is (tail-gen seed) if given, else ().
  def('unfold', (p, f, g, seed, tailGen) => {
    const out = []
    let s = seed
    while (apply(p, [s], fuelBox) === false) {
      out.push(apply(f, [s], fuelBox))
      s = apply(g, [s], fuelBox)
    }
    if (tailGen) {
      const tail = apply(tailGen, [s], fuelBox)
      if (isList(tail)) out.push(...tail)
    }
    return out
  })

  // (take-while pred lst) — SRFI-1. Longest prefix all satisfying pred.
  def('take-while', (pred, lst) => {
    if (!isList(lst)) return []
    const out = []
    for (const x of lst) {
      if (apply(pred, [x], fuelBox) === false) break
      out.push(x)
    }
    return out
  })

  // (drop-while pred lst) — SRFI-1. Drop the take-while prefix.
  def('drop-while', (pred, lst) => {
    if (!isList(lst)) return []
    let i = 0
    while (i < lst.length && apply(pred, [lst[i]], fuelBox) !== false) i++
    return lst.slice(i)
  })

  // (last-pair lst) — SRFI-1. Motoi has no dotted pairs, so the last pair
  // of (1 2 3) is the one-element list (3).
  // SRFI-1: the last PAIR, not the last element and not a copy of it. It is an
  // interior pointer, so `(set-car! (last-pair x) 9)` changes x.
  def('last-pair', (lst) => {
    if (!isPair(lst)) throw new Error('last-pair: expected a non-empty list')
    let p = lst
    while (isPair(p.cdr)) p = p.cdr
    return p
  })

  // (cons* e1 e2 ... tail) — SRFI-1. Cons every leading arg onto the tail.
  // Folds right with the same rule as `cons`, so a non-list tail mints a real
  // improper pair: (cons* 1 2 3) is (1 2 . 3), not (1 2 3).
  def('cons*', (...args) => {
    if (args.length === 0) return []
    let acc = args[args.length - 1]
    for (let i = args.length - 2; i >= 0; i--) {
      acc = isList(acc) ? [args[i], ...acc] : new Pair(args[i], acc)
    }
    return acc
  })

  // (list-tabulate n proc) — SRFI-1. Build (proc 0) .. (proc n-1).
  def('list-tabulate', (n, proc) => {
    const len = Math.max(0, n | 0)
    const out = new Array(len)
    for (let i = 0; i < len; i++) out[i] = apply(proc, [i], fuelBox)
    return out
  })

  // (unzip lst-of-pairs) — SRFI-1. Inverse of zip.
  def('unzip', (lst) => {
    if (!isList(lst) || lst.length === 0) return [[], []]
    const a = [], b = []
    for (const p of lst) {
      if (isList(p)) { a.push(p[0]); b.push(p[1]) }
    }
    return [a, b]
  })

  // (second lst) .. (tenth lst) — SRFI-1 positional accessors. The SRFI defines
  // each as the corresponding car/cdr composition, so running off the end must
  // raise exactly as `cadr` does. Indexing straight into the array returned
  // `undefined`, which surfaced as an unspecified value several frames away from
  // the short list that caused it — found 2026-08-04 authoring `unzip2`.
  const _positional = (name, i) => (a) => {
    if (a.length <= i) {
      throw new Error(`${name}: expected a list of at least ${i + 1} elements, got ${a.length}`)
    }
    return a[i]
  }
  def('second', _positional('second', 1))
  def('third', _positional('third', 2))
  def('fourth', _positional('fourth', 3))
  def('fifth', _positional('fifth', 4))
  def('sixth', _positional('sixth', 5))
  def('seventh', _positional('seventh', 6))
  def('eighth', _positional('eighth', 7))
  def('ninth', _positional('ninth', 8))
  def('tenth', _positional('tenth', 9))

  // ── Surface completion 2026-08-02 ─────────────────────────────────
  // The SRFI-1 procedures the part declared but never bound. Each one is
  // written against the reference implementation in the SRFI-1 document so
  // argument order and edge cases match the spec, not intuition.

  // (xcons d a) — SRFI-1 §Constructors. "Exchanged cons": (cons a d). The
  // arguments are FLIPPED relative to cons — the tail comes first — which
  // is exactly what makes xcons useful as a fold kons.
  //   (xcons (list 'b 'c) 'a) => (a b c)
  // Consing onto a proper list yields a proper list (an array); consing
  // onto anything else mints a real improper Pair, same as `cons`.
  def('xcons', (d, a) => (isList(d) ? [a, ...d] : new Pair(a, d)))

  // (proper-list? x) — SRFI-1 §Predicates. #t iff x is a finite,
  // ()-terminated list. Motoi's arrays ARE proper lists, so the array case
  // is immediate; a Pair chain is walked, and it is proper only if the
  // chain lands on a list or on (). Circular structure returns #f, per
  // spec, and the walk is bounded so a cycle cannot hang the interpreter.
  def('proper-list?', (x) => {
    if (isList(x)) return true
    if (!(x instanceof Pair)) return false
    // Floyd cycle detection over the cdr chain.
    let slow = x, fast = x
    for (;;) {
      if (!(fast instanceof Pair)) return isList(fast)
      fast = fast.cdr
      if (!(fast instanceof Pair)) return isList(fast)
      fast = fast.cdr
      slow = slow.cdr
      if (fast === slow) return false // circular — not a proper list
    }
  })

  // (span pred lst) — SRFI-1 §Searching. Splits lst at the first element
  // that FAILS pred. Returns TWO values: the take-while prefix and the
  // drop-while rest. Consume with call-with-values / let-values / receive.
  def('span', (pred, lst) => {
    _needProc('span', pred, 'a predicate')
    const a = _needList('span', lst)
    let i = 0
    while (i < a.length && apply(pred, [a[i]], fuelBox) !== false) i++
    return new Values([a.slice(0, i), a.slice(i)])
  })

  // (break pred lst) — SRFI-1 §Searching. The mirror of span: splits at the
  // first element that SATISFIES pred. (break pred lst) is (span (not pred) lst).
  // Returns TWO values.
  def('break', (pred, lst) => {
    _needProc('break', pred, 'a predicate')
    const a = _needList('break', lst)
    let i = 0
    while (i < a.length && apply(pred, [a[i]], fuelBox) === false) i++
    return new Values([a.slice(0, i), a.slice(i)])
  })

  // (take-right lst k) — SRFI-1 §Selectors. The LAST k elements of lst.
  // SRFI-1 defines take-right/drop-right over DOTTED lists too: they count k
  // pairs back from the end, and for `(1 2 3 . 4)` with k=2 that is `(2 3 . 4)`
  // — the improper tail rides along. Both used to refuse any dotted argument.
  // `_dotted` splits one into its elements and its final non-() cdr.
  //
  // `isList` is true of a chain as well as an array, so `v.slice()` and
  // `...cur` were array-only reaches guarded by a both-spellings predicate —
  // the trap the list.js header names. `_elems` walks either one.
  const _dotted = (v) => {
    if (isList(v)) return { items: _elems(v).slice(), tail: null }
    const items = []
    let cur = v
    while (cur instanceof Pair) { items.push(cur.car); cur = cur.cdr }
    if (isList(cur)) { items.push(..._elems(cur)); cur = null }
    return { items, tail: cur === undefined ? null : cur }
  }
  const _rebuild = (items, tail) => {
    if (tail === null) return items
    let acc = tail
    for (let i = items.length - 1; i >= 0; i--) acc = new Pair(items[i], acc)
    return acc
  }

  def('take-right', (lst, k) => {
    if (!isList(lst) && !(lst instanceof Pair)) _needList('take-right', lst)
    const { items, tail } = _dotted(lst)
    const n = Math.max(0, k | 0)
    if (n > items.length) {
      throw new Error(`take-right: asked for the last ${n} elements of a list that is only ${items.length} long.`)
    }
    return _rebuild(items.slice(items.length - n), tail)
  })

  // (drop-right lst k) — SRFI-1 §Selectors. All but the last k elements.
  def('drop-right', (lst, k) => {
    if (!isList(lst) && !(lst instanceof Pair)) _needList('drop-right', lst)
    const { items } = _dotted(lst)
    const n = Math.max(0, k | 0)
    if (n > items.length) {
      throw new Error(`drop-right: asked to drop the last ${n} elements of a list that is only ${items.length} long.`)
    }
    // The dropped tail takes the improper cdr with it, so the result is proper.
    return items.slice(0, items.length - n)
  })

  // (split-at lst i) — SRFI-1 §Selectors. Returns TWO values: the first i
  // elements and everything after them. (split-at (list 1 2 3 4) 2) is
  // (1 2) and (3 4).
  def('split-at', (lst, i) => {
    const a = _needList('split-at', lst)
    const n = Math.max(0, i | 0)
    if (n > a.length) {
      throw new Error(`split-at: asked to split at ${n}, but the list is only ${a.length} long.`)
    }
    return new Values([a.slice(0, n), a.slice(n)])
  })

  // (reduce-right f ridentity lst) — SRFI-1 §Fold. The right-fold variant of
  // reduce: the LAST element of lst seeds the accumulator, so no seed value
  // is ever folded in. ridentity is returned ONLY for the empty list — the
  // same trap `reduce` carries (see broken-examples/reduce-arg-order).
  // Element-first, like every SRFI-1 fold: (f elem acc).
  def('reduce-right', (f, ridentity, lst) => {
    _needProc('reduce-right', f, 'a procedure of two arguments')
    const a = _needList('reduce-right', lst)
    if (a.length === 0) return ridentity
    let acc = a[a.length - 1]
    for (let i = a.length - 2; i >= 0; i--) acc = apply(f, [a[i], acc], fuelBox)
    return acc
  })

  // (append-reverse rev-head tail) — SRFI-1 §Constructors. Equivalent to
  // (append (reverse rev-head) tail) but done in one pass; the classic
  // accumulator-flush at the end of a reverse-building loop.
  def('append-reverse', (revHead, tail) => {
    const a = _elems(_needList('append-reverse', revHead))
    // `isList(tail)` is true of a chain too, and `...t` cannot spread a chain.
    const t = isList(tail) ? _elems(tail) : null
    const out = a.slice().reverse()
    if (t !== null) { out.push(...t); return out }
    // A non-list tail is legal in SRFI-1 (the result is then improper).
    // Rebuild it as a Pair chain so the dotted tail survives.
    let acc = tail
    for (let i = out.length - 1; i >= 0; i--) acc = new Pair(out[i], acc)
    return acc
  })

  // ── lset: set operations on lists — SRFI-1 §Set operations ────────
  // EVERY lset procedure takes the equality predicate as its FIRST
  // argument. That is the standard signature and Motoi keeps it, even
  // though Motoi collapses eq?/eqv?/equal? into one `=?`: writing
  // (lset-union equal? a b) is what every other Scheme reads.
  //
  // Argument order inside the predicate follows the SRFI-1 reference
  // implementation exactly, because a non-symmetric `=` can tell the
  // difference.

  // member-with-= : is x in lst, comparing (= x elem)?
  const _memb = (eq, x, lst) => {
    for (const y of lst) if (apply(eq, [x, y], fuelBox) !== false) return true
    return false
  }
  // subset : is every element of s1 present in s2?
  const _subset = (eq, s1, s2) => {
    for (const x of s1) if (!_memb(eq, x, s2)) return false
    return true
  }

  // (lset-adjoin = lst elt1 elt2 ...) — add each elt to lst if not already a
  // member. New elements are consed onto the FRONT, per the reference
  // implementation, so they come out in reverse order of arrival.
  //   (lset-adjoin equal? (list 1 2) 3 1 4) => (4 3 1 2)
  def('lset-adjoin', (eq, lst, ...elts) => {
    _needProc('lset-adjoin', eq, 'an equality predicate')
    let ans = _needList('lset-adjoin', lst)
    for (const elt of elts) {
      if (!_memb(eq, elt, ans)) ans = [elt, ...ans]
    }
    return ans
  })

  // (lset-union = lst1 lst2 ...) — the union of the lists. Each later list's
  // new elements are consed onto the front of the answer so far.
  //   (lset-union equal? (list 1 2 3) (list 3 4)) => (4 1 2 3)
  def('lset-union', (eq, ...lists) => {
    _needProc('lset-union', eq, 'an equality predicate')
    if (lists.length === 0) return []
    let ans = _needList('lset-union', lists[0])
    for (let i = 1; i < lists.length; i++) {
      const lis = _needList('lset-union', lists[i])
      if (lis.length === 0) continue
      if (ans.length === 0) { ans = lis; continue }
      for (const elt of lis) {
        // Reference impl: (any (lambda (x) (= x elt)) ans) — ans element first.
        let seen = false
        for (const x of ans) {
          if (apply(eq, [x, elt], fuelBox) !== false) { seen = true; break }
        }
        if (!seen) ans = [elt, ...ans]
      }
    }
    return ans
  })

  // (lset-intersection = lst1 lst2 ...) — elements of lst1 that appear in
  // EVERY other list. lst1's order is preserved.
  def('lset-intersection', (eq, ...lists) => {
    _needProc('lset-intersection', eq, 'an equality predicate')
    if (lists.length === 0) return []
    const lis1 = _needList('lset-intersection', lists[0])
    const rest = lists.slice(1).map((l) => _needList('lset-intersection', l))
    if (rest.length === 0) return lis1
    if (rest.some((l) => l.length === 0)) return []
    return lis1.filter((x) => rest.every((l) => _memb(eq, x, l)))
  })

  // (lset-difference = lst1 lst2 ...) — elements of lst1 that appear in NONE
  // of the other lists. lst1's order is preserved.
  def('lset-difference', (eq, ...lists) => {
    _needProc('lset-difference', eq, 'an equality predicate')
    if (lists.length === 0) return []
    const lis1 = _needList('lset-difference', lists[0])
    // Reference impl throws out the empty lists first — they subtract nothing.
    const rest = lists.slice(1)
      .map((l) => _needList('lset-difference', l))
      .filter((l) => l.length > 0)
    if (rest.length === 0) return lis1
    return lis1.filter((x) => rest.every((l) => !_memb(eq, x, l)))
  })

  // (list= = lst ...) — #t iff every list is elementwise `=` to the next.
  // Zero lists and one list are trivially true; `=` is never called on them.
  // The `_elems` calls are load-bearing, not tidying. `_needList` answers a
  // chain unchanged, and `a.length !== b.length` on two chains is
  // `undefined !== undefined` — false. The loop bound is then `undefined` too,
  // so it never runs and `list=` answers #t for ANY two lists. That is the same
  // defect `equal?` shipped with; it must not be reintroduced here.
  def('list=', (eq, ...lists) => {
    _needProc('list=', eq, 'an equality predicate')
    for (let i = 0; i + 1 < lists.length; i++) {
      const a = _elems(_needList('list=', lists[i]))
      const b = _elems(_needList('list=', lists[i + 1]))
      if (a.length !== b.length) return false
      for (let k = 0; k < a.length; k++) if (apply(eq, [a[k], b[k]], fuelBox) === false) return false
    }
    return true
  })

  // (lset<= = lst1 lst2 ...) — #t iff each list is a SUBSET of the next.
  // Zero lists and one list are trivially true.
  def('lset<=', (eq, ...lists) => {
    _needProc('lset<=', eq, 'an equality predicate')
    for (let i = 0; i + 1 < lists.length; i++) {
      const s1 = _needList('lset<=', lists[i])
      const s2 = _needList('lset<=', lists[i + 1])
      if (s1 === s2) continue // fast path: the same list object
      if (!_subset(eq, s1, s2)) return false
    }
    return true
  })

  // (lset= = lst1 lst2 ...) — #t iff every list is set-equal to the next
  // (mutual subset). Duplicates and order do not matter.
  def('lset=', (eq, ...lists) => {
    _needProc('lset=', eq, 'an equality predicate')
    for (let i = 0; i + 1 < lists.length; i++) {
      const s1 = _needList('lset=', lists[i])
      const s2 = _needList('lset=', lists[i + 1])
      if (s1 === s2) continue // fast path
      if (!_subset(eq, s1, s2)) return false
      if (!_subset(eq, s2, s1)) return false
    }
    return true
  })

  // ── surface completion 2026-08-03 ──────────────────────────────────
  // The SRFI-1 procedures the part still had no binding for. Measured
  // against Larceny's `test/R7RS/list.sld`, which is where the absence
  // showed up as 84 failing assertions rather than as anything Motoi's own
  // suite would notice.

  // `cons` semantics, kept in one place: a proper list stays an array, and a
  // non-list cdr mints a real Pair. Mirrors the reader's contract.
  // `isList(d)` is true of a chain as well as an array, and `...d` cannot
  // spread a chain — `_elems` answers for both spellings.
  const _cons = (a, d) => (isList(d) ? [a, ..._elems(d)] : (d === null || d === undefined ? [a] : new Pair(a, d)))

  // SRFI-1's default equality is `equal?`. Only the shapes an alist key can
  // take need covering here.
  //
  // `isList` answers #t for a cell chain AND for a JS array — see the header of
  // lib/base/list.js. This used to read `isList(a) && isList(b)` and then reach
  // for `a.length` and `a.every`, which is the trap that shape always is:
  //   * two CHAINS  — `undefined === undefined` passes, then `.every` throws;
  //   * an array vs a chain — a number never equals `undefined`, so two lists
  //     with identical contents compared UNEQUAL, silently, because they were
  //     spelled differently. `equal?` must not be able to tell the spellings
  //     apart, so the walk below never asks which one it has (`_elems`, above).
  const _structurallyEqual = (a, b) => {
    if (a === b) return true
    if (a instanceof Sym && b instanceof Sym) return a.name === b.name
    // A PROPER list either way — array, chain, or one of each.
    if (isList(a) && isList(b)) {
      const xs = _elems(a), ys = _elems(b)
      return xs.length === ys.length && xs.every((x, i) => _structurallyEqual(x, ys[i]))
    }
    if (a instanceof Pair && b instanceof Pair) {
      return _structurallyEqual(a.car, b.car) && _structurallyEqual(a.cdr, b.cdr)
    }
    return false
  }

  // Floyd's tortoise-and-hare over a Pair chain. Arrays are finite by
  // construction, so only Pair chains can close a loop.
  const _cycles = (x) => {
    let slow = x, fast = x
    while (fast instanceof Pair && fast.cdr instanceof Pair) {
      slow = slow.cdr
      fast = fast.cdr.cdr
      if (slow === fast) return true
    }
    return false
  }

  def('not-pair?', (x) => !(x instanceof Pair) && !(isPair(x)))

  // (circular-list e ...) — the only way to build a cyclic list here. It is
  // necessarily a Pair chain: an array cannot contain itself as a tail.
  def('circular-list', (...xs) => {
    if (xs.length === 0) return []
    const head = new Pair(xs[0], null)
    let tail = head
    for (let i = 1; i < xs.length; i++) {
      const p = new Pair(xs[i], null)
      tail.cdr = p
      tail = p
    }
    tail.cdr = head
    return head
  })

  def('circular-list?', (x) => _cycles(x))

  // (dotted-list? x) — SRFI-1 counts ANY non-pair as a dotted list of length
  // zero, so `(dotted-list? 5)` is #t. Only ()-terminated and circular lists
  // are excluded.
  def('dotted-list?', (x) => {
    if (isList(x)) return false
    if (!(x instanceof Pair)) return true
    if (_cycles(x)) return false
    let t = x
    while (t instanceof Pair) t = t.cdr
    return !(isNull(t)) && t !== null && t !== undefined
  })

  // (null-list? lst) — SRFI-1 §Predicates. #t for (), #f for a pair, an error
  // for anything else. A CIRCULAR list is a pair, so the answer is #f — which
  // it can only give if it never tries to walk one. Both this and `length+`
  // below are installed raw for that reason: `seqVerb` would flatten the
  // argument to an array first, and the cycle has no bottom to flatten to.
  def('null-list?', (l) => {
    if (isNull(l) || l === null || l === undefined) return true
    if (l instanceof Pair || isPair(l)) return false
    throw new Error('null-list?: expected a list, got ' + _describe(l))
  })

  // (length+ lst) — SRFI-1. Like `length`, but #f for a circular list instead
  // of spinning forever. `isList(l)` is true of a chain as well as an array, so
  // the old `l.length` behind it answered `undefined` for a chain; count the
  // cells instead and let the array case take the array's own length.
  def('length+', (l) => {
    if (_cycles(l)) return false
    if (Array.isArray(l)) return l.length
    let n = 0, t = l
    while (t instanceof Pair) { n++; t = t.cdr }
    return n
  })

  // (car+cdr pair) — both halves as two values, so a caller walks a list
  // without paying for two traversals.
  def('car+cdr', (p) => {
    if (p instanceof Pair) return new Values([p.car, p.cdr])
    const l = _needList('car+cdr', p)
    if (l.length === 0) throw new Error('car+cdr: the empty list has no car')
    // SRFI-1 is exactly (values (car p) (cdr p)) — the tail must be the real
    // cdr, so it is eq? to it and is itself a well-formed list. The slice()
    // form used until 2026-08-04 handed back a bare array, which the Pair
    // representation then read as an improper list.
    const chain = toScheme(l)
    return new Values([chain.car, chain.cdr])
  })

  // (find-tail pred lst) — the SUFFIX beginning at the first match, not the
  // element. `find` answers the element; this answers where it is.
  // SRFI-1 returns the actual PAIR, so the result is eq? to the corresponding
  // cdr of the input — that is what makes it usable as a cursor. The slice()
  // form used until 2026-08-04 answered a copy, which was equal? but not eq?.
  def('find-tail', (pred, l) => {
    _needProc('find-tail', pred, 'a predicate')
    _needList('find-tail', l)
    for (let p = toScheme(l); p instanceof Pair; p = p.cdr) {
      if (apply(pred, [p.car], fuelBox) !== false) return p
    }
    return false
  })

  // ── association lists ───────────────────────────────────────────────
  // SRFI-1 defines this as exactly (cons (cons key datum) alist): the tail is
  // SHARED, so the push is O(1) and the old alist stays an alias. The spread
  // form used until 2026-08-04 copied the spine, which made it O(n) and broke
  // the eq? tail law the doc line above already claimed.
  def('alist-cons', (key, datum, alist) => {
    _needList('alist-cons', alist)
    return new Pair(_cons(key, datum), toScheme(alist))
  })

  // Copies the SPINE and each entry, so mutating a copied entry cannot reach
  // back into the original.
  def('alist-copy', (alist) => _elems(_needList('alist-copy', alist)).map((e) => {
    if (e instanceof Pair) return new Pair(e.car, e.cdr)
    // `e.slice()` behind an `isList` guard is the array-only reach again.
    return isList(e) ? _elems(e).slice() : e
  }))

  def('alist-delete', (key, alist, eq) => {
    const xs = _needList('alist-delete', alist)
    const same = (a, b) => (eq ? apply(eq, [a, b], fuelBox) !== false : _structurallyEqual(a, b))
    return xs.filter((e) => {
      const k = e instanceof Pair ? e.car : (isList(e) ? e[0] : e)
      return same(key, k) === false
    })
  })

  // ── mapping over the pairs, not the elements ────────────────────────
  // SRFI-1's pair-* family hands the procedure each successive SUFFIX. Motoi
  // stores a proper list as an array, so a suffix is a slice — equal by value
  // to the cons-cell tail another Scheme would pass, though not `eq?` to it.
  // `_needList` hands back what it was given, chain or array, so `_elems`
  // normalizes before `_shortest` reaches for `.length` — otherwise the stop is
  // NaN and `map-in-order` answers () for a perfectly good list.
  const _suffixes = (name, lists) => lists.map((l) => _elems(_needList(name, l)))
  const _shortest = (ls) => ls.reduce((m, l) => Math.min(m, l.length), Infinity)

  // The three `pair-*` verbs hand the callback the CELL, not the element —
  // that is their whole point. SRFI-1 promises the cell is the caller's own, so
  // a `set-cdr!` inside the callback is visible outside; that is how the
  // canonical `reverse!` is written. They are installed raw (`_RAW`) and walk
  // cells directly.
  //
  // They used to share `_suffixes`/`_shortest` with the array-world verbs and
  // take `l.slice(i)` for each tail. Two things were wrong with that. A chain
  // has no `.length`, so `_shortest` was `NaN`, `i < NaN` is false, the loop
  // ran zero times and `pair-fold-right` answered its own seed. And `.slice`
  // COPIED, so even on an array the callback never received the caller's cell.
  //
  // The tails are collected before any callback runs, so a callback that
  // smashes the cdr it was handed cannot cut the walk short — the same
  // guarantee SRFI-1's reference implementation gets by grabbing `(cdr lis)`
  // one step ahead.
  const _tails = (name, l) => {
    const out = []
    let x = toScheme(_needList(name, l))
    while (x instanceof Pair) { out.push(x); x = x.cdr }
    return out
  }
  const _tailRows = (name, lists) => {
    const cols = lists.map((l) => _tails(name, l))
    const stop = cols.reduce((m, c) => Math.min(m, c.length), Infinity)
    return [cols, cols.length === 0 ? 0 : stop]
  }

  def('pair-fold', (fn, init, ...lists) => {
    if (lists.length === 0) return init
    const [cols, stop] = _tailRows('pair-fold', lists)
    let acc = init
    for (let i = 0; i < stop; i++) {
      const args = cols.map((c) => c[i])
      args.push(acc)
      acc = apply(fn, args, fuelBox)
    }
    return acc
  })

  def('pair-fold-right', (fn, init, ...lists) => {
    if (lists.length === 0) return init
    const [cols, stop] = _tailRows('pair-fold-right', lists)
    let acc = init
    for (let i = stop - 1; i >= 0; i--) {
      const args = cols.map((c) => c[i])
      args.push(acc)
      acc = apply(fn, args, fuelBox)
    }
    return acc
  })

  def('pair-for-each', (fn, ...lists) => {
    const [cols, stop] = _tailRows('pair-for-each', lists)
    for (let i = 0; i < stop; i++) apply(fn, cols.map((c) => c[i]), fuelBox)
    return undefined
  })

  // (map-in-order f lst ...) — `map` with the evaluation order PROMISED to be
  // left-to-right. Motoi's map already is; the separate name is the promise.
  def('map-in-order', (fn, ...lists) => {
    const ls = _suffixes('map-in-order', lists)
    const stop = _shortest(ls)
    const out = []
    for (let i = 0; i < stop; i++) out.push(apply(fn, ls.map((l) => l[i]), fuelBox))
    return out
  })

  // ── unzip1..5 ───────────────────────────────────────────────────────
  // unzip1 answers ONE list; unzip2..5 answer that many VALUES.
  // The guard is `Array.isArray`, not `isList`: `isList` is #t for a chain as
  // well, and `r[k]` on a chain is `undefined` — a whole column of nothing, with
  // nothing thrown. A chain falls through to the cdr walk below, which is right
  // for it and for a dotted row alike.
  // A row shorter than the requested width used to yield `undefined` for the
  // missing column, so `(unzip2 '((1 a) (2)))` answered a list with a hole in it
  // instead of raising. SRFI-1 defines unzipN as N maps of first..fifth, and
  // those raise — found 2026-08-04 authoring the unzip records.
  const _column = (name, rows, k) => rows.map((r) => {
    if (Array.isArray(r)) {
      if (r.length <= k) throw new Error(`${name}: row shorter than ${k + 1} elements`)
      return r[k]
    }
    let t = r
    for (let i = 0; i < k && t instanceof Pair; i++) t = t.cdr
    if (!(t instanceof Pair)) throw new Error(`${name}: row shorter than ${k + 1} elements`)
    return t.car
  })
  def('unzip1', (l) => _column('unzip1', _elems(_needList('unzip1', l)), 0))
  for (let k = 2; k <= 5; k++) {
    def(`unzip${k}`, ((width) => (l) => {
      const rows = _elems(_needList(`unzip${width}`, l))
      const cols = []
      for (let c = 0; c < width; c++) cols.push(_column(`unzip${width}`, rows, c))
      return new Values(cols)
    })(k))
  }

  // ── the two remaining lset operations ───────────────────────────────
  // (lset-xor = lst ...) — elements in an ODD number of the lists.
  def('lset-xor', (eq, ...lists) => {
    _needProc('lset-xor', eq, 'an equality predicate')
    const sets = lists.map((l) => _needList('lset-xor', l))
    const has = (s, x) => s.some((y) => apply(eq, [x, y], fuelBox) !== false)
    return sets.reduce((acc, s) => {
      const out = acc.filter((x) => !has(s, x))
      for (const x of s) if (!has(acc, x) && !out.some((y) => apply(eq, [x, y], fuelBox) !== false)) out.push(x)
      return out
    }, [])
  })

  // (lset-diff+intersection = lst1 lst ...) — both halves of the split in one
  // pass, as two values.
  def('lset-diff+intersection', (eq, first, ...rest) => {
    _needProc('lset-diff+intersection', eq, 'an equality predicate')
    const xs = _needList('lset-diff+intersection', first)
    const others = rest.map((l) => _needList('lset-diff+intersection', l))
    const inAny = (x) => others.some((s) => s.some((y) => apply(eq, [x, y], fuelBox) !== false))
    const diff = [], both = []
    for (const x of xs) (inAny(x) ? both : diff).push(x)
    return new Values([diff, both])
  })

  // (unfold-right p f g seed [tail]) — unfold that CONSES ONTO the result, so
  // the list comes out in the reverse order `unfold` would produce.
  def('unfold-right', (p, f, g, seed, tail = []) => {
    let out = isList(tail) ? tail.slice() : []
    let s = seed
    while (apply(p, [s], fuelBox) === false) {
      out = [apply(f, [s], fuelBox), ...out]
      s = apply(g, [s], fuelBox)
    }
    return out
  })

  // ── the linear-update (!) names ─────────────────────────────────────
  //
  // SRFI-1 permits a `!` procedure to REUSE its argument's cells, and that
  // permission is the entire reason the names exist: `filter!` is `filter` with
  // the allocation taken out. A `!` verb that quietly allocates is a slower
  // alias of its twin, and portable code that reaches for one gets nothing.
  //
  // Until 2026-08-03 every `!` name here was bound to its pure twin, justified
  // by "the standard only permits, it does not require" and by the old array
  // representation, which had no shared tail to reuse. Both halves of that
  // justification are gone: lists are real cells now, and Alfred has ruled for
  // the STRONG reading. The verbs below reuse. Larceny's SRFI-1 suite asserts
  // it — `(eq? x (take! x 3))`, and the `(pair-fold cons '() x)` idiom that
  // captures a list's cells and then checks the answer's cells are `memq` among
  // them — and thirteen of those assertions were failing.
  //
  // Every one of them is installed RAW (see `_RAW` above), because a verb whose
  // contract is "you get your own cells back" cannot go through `seqVerb`,
  // which converts to an array on the way in and mints a fresh chain on the way
  // out. That is the difference between reuse and a rumour of reuse.
  //
  // Callers who need the old list intact should use the twin without the `!`.

  // A mutation invalidates the array<->chain memo in lib/base/list.js: an array
  // cached for a chain whose spine just changed is now a stale answer. Swapping
  // the maps is the whole invalidation, and it is cheap relative to a `!` call.
  const _mutated = (v) => { bumpListEpoch(); return v }

  // The single relinking walk every destructive filter is made of. Keep the
  // cells whose car passes, splice the others out, answer the head that
  // survived. The cdr is read BEFORE it is overwritten, so relinking a cell
  // cannot cut the walk short — the same grab-ahead SRFI-1's own reference
  // implementation does.
  const _filterCells = (chain, keep) => {
    let head = NIL, prev = null
    let x = chain
    while (x instanceof Pair) {
      const next = x.cdr
      if (keep(x.car)) {
        if (prev === null) head = x
        else prev.cdr = x
        prev = x
      }
      x = next
    }
    if (prev !== null) prev.cdr = NIL
    return _mutated(head)
  }

  // The same walk, keeping BOTH sides instead of dropping one.
  const _partitionCells = (chain, keep) => {
    let inHead = NIL, inPrev = null, outHead = NIL, outPrev = null
    let x = chain
    while (x instanceof Pair) {
      const next = x.cdr
      if (keep(x.car)) {
        if (inPrev === null) inHead = x
        else inPrev.cdr = x
        inPrev = x
      } else {
        if (outPrev === null) outHead = x
        else outPrev.cdr = x
        outPrev = x
      }
      x = next
    }
    if (inPrev !== null) inPrev.cdr = NIL
    if (outPrev !== null) outPrev.cdr = NIL
    return _mutated(new Values([inHead, outHead]))
  }

  // Cut the chain after its longest passing prefix; answer [prefix, suffix].
  // The suffix is the caller's own cell, not a copy — that is what makes
  // `(eq? b (cddr x))` hold for `(split-at! x 2)` and for `span!`.
  const _spanCells = (chain, keep) => {
    if (!(chain instanceof Pair) || !keep(chain.car)) return [NIL, chain]
    let prev = chain
    let rest = chain.cdr
    while (rest instanceof Pair && keep(rest.car)) { prev = rest; rest = rest.cdr }
    prev.cdr = NIL
    bumpListEpoch()
    return [chain, rest]
  }

  // (take! lst k) — SRFI-1 §Selectors. `take` without the copy: truncate the
  // caller's own chain after k cells and hand it back.
  def('take!', (lst, k) => {
    const chain = _chain('take!', lst)
    const n = Math.max(0, k | 0)
    if (n === 0) return NIL
    const cell = _nth(chain, n - 1)
    if (!(cell instanceof Pair)) {
      throw new Error(`take!: asked for the first ${n} elements of a list that is only ${_chainLength(chain)} long.`)
    }
    cell.cdr = NIL
    return _mutated(chain)
  })

  // (drop-right! lst k) — SRFI-1 §Selectors. Truncate in place k cells from the
  // end, found with the classic two-cursor walk (one runs k ahead).
  def('drop-right!', (lst, k) => {
    const chain = _chain('drop-right!', lst)
    const n = Math.max(0, k | 0)
    let lead = _nth(chain, n)
    if (!(lead instanceof Pair)) {
      if (n > _chainLength(chain)) {
        throw new Error(`drop-right!: asked to drop the last ${n} elements of a list that is only ${_chainLength(chain)} long.`)
      }
      return NIL // dropped every cell; the caller's chain is left alone
    }
    let prev = chain
    lead = lead.cdr
    while (lead instanceof Pair) { prev = prev.cdr; lead = lead.cdr }
    prev.cdr = NIL
    return _mutated(chain)
  })

  // (split-at! lst i) — SRFI-1 §Selectors. Two values, and BOTH are made of the
  // caller's cells: the prefix is the original head truncated, the suffix is the
  // original cell at position i. `split-at!` was listed in `_RAW` and given a
  // META row but never actually defined, so it was an unbound symbol.
  def('split-at!', (lst, i) => {
    const chain = _chain('split-at!', lst)
    const n = Math.max(0, i | 0)
    if (n === 0) return new Values([NIL, chain])
    const prev = _nth(chain, n - 1)
    if (!(prev instanceof Pair)) {
      throw new Error(`split-at!: asked to split at ${n}, but the list is only ${_chainLength(chain)} long.`)
    }
    const suffix = prev.cdr
    prev.cdr = NIL
    return _mutated(new Values([chain, suffix]))
  })

  // (append! lst ...) — SRFI-1 §Constructors. `append` without the copying:
  // splice each list's head onto the previous list's LAST cell. Empty arguments
  // contribute nothing and are skipped, so `(append! x y '() z)` still lands z
  // directly on the end of y. The final argument is spliced as-is and may be
  // any object, which is how `(append! (list 1) 2)` gives the dotted `(1 . 2)`.
  const _appendBang = (lists) => {
    if (lists.length === 0) return NIL
    const last = lists[lists.length - 1]
    let head = NIL, tail = null
    for (let i = 0; i < lists.length - 1; i++) {
      const c = _chain('append!', lists[i])
      if (!(c instanceof Pair)) continue
      if (tail === null) head = c
      else tail.cdr = c
      tail = _lastCell(c)
    }
    const lastV = Array.isArray(last) ? toScheme(last) : last
    if (tail === null) return lastV
    tail.cdr = lastV
    return _mutated(head)
  }
  def('append!', (...lists) => _appendBang(lists))

  // (concatenate! lst-of-lsts) — SRFI-1 defines this as (apply append! lists).
  def('concatenate!', (lst) => {
    const outer = _chain('concatenate!', lst)
    const parts = []
    for (let x = outer; x instanceof Pair; x = x.cdr) parts.push(x.car)
    return _appendBang(parts)
  })

  // (reverse! lst) — SRFI-1. The textbook in-place reversal: walk the chain
  // flipping each cdr backwards. No cell is allocated and the caller's head
  // becomes the LAST cell, which is why the name carries the `!`.
  def('reverse!', (lst) => {
    let acc = NIL
    let x = _chain('reverse!', lst)
    while (x instanceof Pair) { const next = x.cdr; x.cdr = acc; acc = x; x = next }
    return _mutated(acc)
  })

  // (append-reverse! rev-head tail) — the same flip, but seeded with `tail`
  // instead of (), so the reversed cells land straight on top of it.
  def('append-reverse!', (revHead, tail) => {
    let acc = Array.isArray(tail) ? toScheme(tail) : tail
    let x = _chain('append-reverse!', revHead)
    while (x instanceof Pair) { const next = x.cdr; x.cdr = acc; acc = x; x = next }
    return _mutated(acc)
  })

  // (map! f lst1 lst2 ...) — SRFI-1 §Fold, Unfold & Map. `map` that writes each
  // answer back into the cell it came from, so the argument list is changed too:
  //   (let* ((l (list 1 2 3)) (m (map! (lambda (x) (* x x)) l))) l)  =>  (1 4 9)
  // With several lists the shortest still wins, and lst1 is truncated there —
  // there is nowhere else for a result cell to come from.
  def('map!', (fn, first, ...rest) => {
    const chain = _chain('map!', first)
    if (rest.length === 0) {
      for (let x = chain; x instanceof Pair; x = x.cdr) x.car = apply(fn, [x.car], fuelBox)
      return _mutated(chain)
    }
    const cursors = rest.map((l) => _chain('map!', l))
    let x = chain
    let prev = null
    while (x instanceof Pair && cursors.every((c) => c instanceof Pair)) {
      x.car = apply(fn, [x.car, ...cursors.map((c) => c.car)], fuelBox)
      prev = x
      x = x.cdr
      for (let i = 0; i < cursors.length; i++) cursors[i] = cursors[i].cdr
    }
    if (x instanceof Pair) {
      // A shorter argument ran out first: cut lst1 back to the common length.
      if (prev === null) return _mutated(NIL)
      prev.cdr = NIL
    }
    return _mutated(chain)
  })

  // (filter! pred lst) / (remove! pred lst) — SRFI-1 §Filtering. Same walk,
  // opposite sense. Every cell in the answer is one the caller already had.
  def('filter!', (pred, lst) => {
    _needProc('filter!', pred, 'a predicate')
    return _filterCells(_chain('filter!', lst), (x) => apply(pred, [x], fuelBox) !== false)
  })
  def('remove!', (pred, lst) => {
    _needProc('remove!', pred, 'a predicate')
    return _filterCells(_chain('remove!', lst), (x) => apply(pred, [x], fuelBox) === false)
  })

  // (partition! pred lst) — SRFI-1 §Filtering. TWO values, and the two answers
  // between them are made of exactly the cells lst was made of: nothing is
  // allocated and nothing is dropped.
  def('partition!', (pred, lst) => {
    _needProc('partition!', pred, 'a predicate')
    return _partitionCells(_chain('partition!', lst), (x) => apply(pred, [x], fuelBox) !== false)
  })

  // (take-while! pred lst) / (span! pred lst) / (break! pred lst) — SRFI-1
  // §Searching. All three are the one cut: `take-while!` keeps the prefix,
  // `span!` answers both halves, `break!` is `span!` with the test flipped.
  def('take-while!', (pred, lst) => {
    _needProc('take-while!', pred, 'a predicate')
    return _spanCells(_chain('take-while!', lst), (x) => apply(pred, [x], fuelBox) !== false)[0]
  })
  def('span!', (pred, lst) => {
    _needProc('span!', pred, 'a predicate')
    return new Values(_spanCells(_chain('span!', lst), (x) => apply(pred, [x], fuelBox) !== false))
  })
  def('break!', (pred, lst) => {
    _needProc('break!', pred, 'a predicate')
    return new Values(_spanCells(_chain('break!', lst), (x) => apply(pred, [x], fuelBox) === false))
  })

  // (delete! x lst [=]) — SRFI-1 §Deletion, defined there as
  // (filter! (lambda (y) (not (= x y))) lis). The comparison keeps the SRFI's
  // argument order — the sought value first — which a non-symmetric test can
  // tell apart: (delete! 5 (list 1 48 2 5 37) <) drops 48 and 37, not 1 and 2.
  def('delete!', (x, lst, eq) => {
    const chain = _chain('delete!', lst)
    const same = eq
      ? (y) => apply(eq, [x, y], fuelBox) !== false
      : (y) => _structurallyEqual(x, y)
    return _filterCells(chain, (y) => !same(y))
  })

  // (delete-duplicates! lst [=]) — SRFI-1 §Deletion. Keep the first occurrence
  // of each element and splice the later ones out. The optional comparator is
  // called (= kept candidate), kept-element first, and forces the pairwise walk
  // the spec describes; an arbitrary predicate has no hash key to stand in.
  def('delete-duplicates!', (lst, eq) => {
    const chain = _chain('delete-duplicates!', lst)
    const kept = []
    return _filterCells(chain, (x) => {
      for (const k of kept) {
        const dup = eq ? apply(eq, [k, x], fuelBox) !== false : _structurallyEqual(k, x)
        if (dup) return false
      }
      kept.push(x)
      return true
    })
  })

  // (alist-delete! key alist [=]) — SRFI-1 §Association lists, defined there as
  // (filter! (lambda (elt) (not (= key (car elt)))) alist). The ENTRIES are left
  // untouched, so an entry surviving in the answer is still `eq?` to the entry
  // in a `list-copy` of the original alist.
  def('alist-delete!', (key, alist, eq) => {
    const chain = _chain('alist-delete!', alist)
    const keyOf = (e) => (e instanceof Pair ? e.car : (Array.isArray(e) ? e[0] : e))
    const same = (k) => (eq ? apply(eq, [key, k], fuelBox) !== false : _structurallyEqual(key, k))
    return _filterCells(chain, (e) => !same(keyOf(e)))
  })

  // The remaining `!` names stay bound to their twins, and for these that IS
  // the implementation rather than a placeholder for one: `append-map!` and
  // `filter-map!` build their answer entirely out of cells the callback just
  // made, `pair-for-each!` returns nothing at all, and the lset family draws
  // its answer from lists it has no licence to smash.
  //
  // `find-tail!` and `drop-while!` are the honest exception. Both ANSWER a
  // suffix, which SRFI-1 expects to be the caller's own cell, and their twins
  // here are sequence verbs that copy it — so `(eq? (find-tail! p x) (cdr x))`
  // is #f where another Scheme says #t. Nothing in the conformance suite pins
  // it, so it is left as it is and written down rather than quietly claimed.
  for (const [bang, pure] of _BANG_ALIASES) {
    let impl
    try { impl = env.get(pure) } catch { impl = undefined }
    if (impl !== undefined) def(bang, impl)
  }

  registerPartMeta(META, { source: 'lib/std/srfi-1.js' })
  return env
}

export const META = [
  ['iota',              [1, 3],       '(iota count [start [step]]) — a list of count numbers starting at start with the given step. SRFI-1.', '(iota 5) => (0 1 2 3 4)', 'list'],
  ['fold',              [3, Infinity], '(fold f init lst1 lst2 ...) — left fold, element-first, accumulator LAST: (f e1 e2 ... acc). N-ary over lists, stopping at the shortest. SRFI-1.', '(fold + 0 (list 1 2 3)) => 6',                'higher-order'],
  ['fold-right',        [3, Infinity], '(fold-right f init lst1 lst2 ...) — right fold, element-first, accumulator LAST: (f e1 e2 ... acc). N-ary over lists, stopping at the shortest. SRFI-1.', '(fold-right cons (list) (list 1 2 3)) => (1 2 3)', 'higher-order'],
  ['concatenate',       1,            '(concatenate lst-of-lsts) — flatten one level. SRFI-1.',              '(concatenate (list (list 1 2) (list 3 4))) => (1 2 3 4)', 'list'],
  ['append-map',        2,            '(append-map f lst) — map then concatenate. SRFI-1.',                  '(append-map (lambda (x) (list x x)) (list 1 2)) => (1 1 2 2)', 'higher-order'],
  ['filter-map',        2,            '(filter-map f lst) — map, then drop #f results. SRFI-1.',             '(filter-map (lambda (x) (if (odd? x) (* x x) #f)) (list 1 2 3)) => (1 9)', 'higher-order'],
  ['partition',         2,            '(partition pred lst) — return TWO values (in-list out-list); consume with call-with-values. SRFI-1.', '(call-with-values (lambda () (partition odd? (list 1 2 3 4))) list) => ((1 3) (2 4))', 'higher-order'],
  ['find',              2,            '(find pred lst) — first element satisfying pred, or #f. SRFI-1.',     '(find odd? (list 2 4 5)) => 5',               'higher-order'],
  ['delete-duplicates', 1,            '(delete-duplicates lst) — keep first occurrence of each. SRFI-1.',    '(delete-duplicates (list 1 2 1 3 2)) => (1 2 3)', 'list'],
  ['remove',            2,            '(remove pred lst) — keep elements NOT satisfying pred. SRFI-1.',      '(remove odd? (list 1 2 3 4 5)) => (2 4)',     'higher-order'],
  ['delete',            [2, 3],       '(delete x lst [=]) — remove every element equal to x. SRFI-1.',       '(delete 2 (list 1 2 3 2 1)) => (1 3 1)',      'list'],
  ['unfold',            [4, 5],       '(unfold p f g seed [tail-gen]) — build a list by unfolding a seed. SRFI-1.', '(unfold (lambda (x) (> x 3)) (lambda (x) x) (lambda (x) (+ x 1)) 1) => (1 2 3)', 'higher-order'],
  ['take-while',        2,            '(take-while pred lst) — longest prefix all satisfying pred. SRFI-1.', '(take-while odd? (list 1 3 4 5)) => (1 3)',   'higher-order'],
  ['drop-while',        2,            '(drop-while pred lst) — drop the take-while prefix. SRFI-1.',         '(drop-while odd? (list 1 3 4 5)) => (4 5)',   'higher-order'],
  ['last-pair',         1,            '(last-pair lst) — the last pair; in Motoi a one-element list. SRFI-1.', '(last-pair (list 1 2 3)) => (3)',           'list'],
  ['cons*',             [1, Infinity], '(cons* e1 e2 ... tail) — cons the leading args onto tail. SRFI-1.',   '(cons* 1 2 (list 3 4)) => (1 2 3 4)',         'list'],
  ['list-tabulate',     2,            '(list-tabulate n proc) — build (proc 0)..(proc n-1). SRFI-1.',        '(list-tabulate 3 (lambda (i) (* i i))) => (0 1 4)', 'list'],
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
  // Surface completion 2026-08-02.
  ['xcons',             2,            '(xcons d a) — "exchanged cons": (cons a d), tail first. SRFI-1.',     "(xcons (list 2 3) 1) => (1 2 3)",            'list'],
  ['proper-list?',      1,            '(proper-list? x) — #t if x is a finite, ()-terminated list (#f for a dotted or circular one). SRFI-1.', '(proper-list? (list 1 2)) => #t', 'predicate'],
  ['span',              2,            '(span pred lst) — split at the first element that FAILS pred; returns TWO values (prefix rest). SRFI-1.', '(call-with-values (lambda () (span odd? (list 1 3 4 5))) list) => ((1 3) (4 5))', 'higher-order'],
  ['break',             2,            '(break pred lst) — split at the first element that SATISFIES pred; returns TWO values (prefix rest). SRFI-1.', '(call-with-values (lambda () (break even? (list 1 3 4 5))) list) => ((1 3) (4 5))', 'higher-order'],
  ['take-right',        2,            '(take-right lst k) — the last k elements. SRFI-1.',                   '(take-right (list 1 2 3 4 5) 2) => (4 5)',   'list'],
  ['drop-right',        2,            '(drop-right lst k) — all but the last k elements. SRFI-1.',           '(drop-right (list 1 2 3 4 5) 2) => (1 2 3)', 'list'],
  ['split-at',          2,            '(split-at lst i) — returns TWO values: the first i elements and the rest. SRFI-1.', '(call-with-values (lambda () (split-at (list 1 2 3 4) 2)) list) => ((1 2) (3 4))', 'list'],
  ['reduce-right',      3,            '(reduce-right f ridentity lst) — right fold seeded by the LAST element; ridentity is used only for the empty list. Element-first (f elem acc). SRFI-1.', '(reduce-right + 0 (list 1 2 3)) => 6', 'higher-order'],
  ['append-reverse',    2,            '(append-reverse rev-head tail) — (append (reverse rev-head) tail) in one pass. SRFI-1.', '(append-reverse (list 3 2 1) (list 4 5)) => (1 2 3 4 5)', 'list'],
  ['lset-adjoin',       [2, Infinity], '(lset-adjoin = lst elt ...) — add each elt to lst unless already a member; new elements go on the front. SRFI-1.', '(lset-adjoin equal? (list 1 2) 3) => (3 1 2)', 'list'],
  ['lset-union',        [1, Infinity], '(lset-union = lst ...) — the union of the lists; the equality test comes FIRST. SRFI-1.', '(lset-union equal? (list 1 2 3) (list 3 4)) => (4 1 2 3)', 'list'],
  ['lset-intersection', [1, Infinity], '(lset-intersection = lst1 lst ...) — elements of lst1 present in every other list, in lst1 order. SRFI-1.', '(lset-intersection equal? (list 1 2 3) (list 2 3 4)) => (2 3)', 'list'],
  ['lset-difference',   [1, Infinity], '(lset-difference = lst1 lst ...) — elements of lst1 present in none of the others, in lst1 order. SRFI-1.', '(lset-difference equal? (list 1 2 3 4) (list 2 4)) => (1 3)', 'list'],
  ['lset<=',            [1, Infinity], '(lset<= = lst ...) — #t if each list is a subset of the next. SRFI-1.', '(lset<= equal? (list 1) (list 1 2)) => #t',  'predicate'],
  ['lset=',             [1, Infinity], '(lset= = lst ...) — #t if the lists are set-equal (order and duplicates ignored). SRFI-1.', '(lset= equal? (list 1 2) (list 2 1 1)) => #t', 'predicate'],
  ['list=',             [1, Infinity], '(list= = lst ...) — #t if the lists are elementwise equal under =. SRFI-1.', '(list= equal? (list 1 2) (list 1 2)) => #t', 'predicate'],
  ['not-pair?',         1,            '(not-pair? x) — #t for anything that is NOT a pair. SRFI-1.',        '(not-pair? 5) => #t',                          'predicate'],
  ['circular-list',     [1, Infinity], '(circular-list x ...) — a list whose last cdr points back at its head. SRFI-1.', '(circular-list? (circular-list 1 2)) => #t', 'list'],
  ['circular-list?',    1,            '(circular-list? x) — #t if x closes a loop. SRFI-1.',                '(circular-list? (list 1 2)) => #f',            'predicate'],
  ['dotted-list?',      1,            '(dotted-list? x) — #t for a finite chain not ending in (). A non-pair counts as a dotted list of length 0. SRFI-1.', '(dotted-list? 5) => #t', 'predicate'],
  ['null-list?',        1,            '(null-list? lst) — #t if lst is the empty list. SRFI-1.',            '(null-list? (list)) => #t',                    'predicate'],
  ['length+',           1,            '(length+ x) — the length, or #f if x is circular. SRFI-1.',          '(length+ (list 1 2 3)) => 3',                  'list'],
  ['car+cdr',           1,            '(car+cdr p) — return the car and the cdr as TWO values. SRFI-1.',    '(call-with-values (lambda () (car+cdr (list 1 2))) list) => (1 (2))', 'list'],
  ['find-tail',         2,            '(find-tail pred lst) — the first TAIL whose head satisfies pred, or #f. SRFI-1.', '(find-tail even? (list 1 3 4 5)) => (4 5)', 'higher-order'],
  ['map-in-order',      [2, Infinity], '(map-in-order f lst ...) — like map, with left-to-right order guaranteed. SRFI-1.', '(map-in-order (lambda (x) (* x 2)) (list 1 2)) => (2 4)', 'higher-order'],
  ['unfold-right',      [4, 5],       '(unfold-right p f g seed [tail]) — unfold a seed, building the list right-to-left. SRFI-1.', '(unfold-right (lambda (x) (> x 3)) (lambda (x) x) (lambda (x) (+ x 1)) 1) => (3 2 1)', 'higher-order'],
  ['alist-cons',        3,            '(alist-cons key datum alist) — push (key . datum) onto an alist without copying it. SRFI-1.', '(alist-cons (quote a) 1 (list)) => ((a . 1))', 'list'],
  ['alist-copy',        1,            '(alist-copy alist) — copy the spine AND every pair. SRFI-1.',        '(alist-copy (list (cons 1 2))) => ((1 . 2))',  'list'],
  ['alist-delete',      [2, 3],       '(alist-delete key alist [=]) — drop every entry whose key matches. SRFI-1.', '(alist-delete 1 (list (cons 1 2) (cons 3 4))) => ((3 . 4))', 'list'],
  ['pair-fold',         [3, Infinity], '(pair-fold f init lst ...) — like fold, but f sees each TAIL, not each element. SRFI-1.', '(pair-fold (lambda (p acc) (+ acc 1)) 0 (list 1 2 3)) => 3', 'higher-order'],
  ['pair-fold-right',   [3, Infinity], '(pair-fold-right f init lst ...) — the right-to-left pair-fold. SRFI-1.', '(pair-fold-right cons (list) (list 1 2)) => ((1 2) (2))', 'higher-order'],
  ['pair-for-each',     [2, Infinity], '(pair-for-each f lst ...) — for-each over the TAILS, for effect. SRFI-1.', '(pair-for-each (lambda (p) p) (list 1 2)) => #<unspecified>', 'higher-order'],
  ['unzip1',            1,            '(unzip1 lst-of-lsts) — the list of first elements. SRFI-1.',         '(unzip1 (list (list 1 2) (list 3 4))) => (1 3)', 'list'],
  ['unzip2',            1,            '(unzip2 lst-of-lsts) — the first two columns, as TWO values. SRFI-1.', '(call-with-values (lambda () (unzip2 (list (list 1 2)))) list) => ((1) (2))', 'list'],
  ['unzip3',            1,            '(unzip3 lst-of-lsts) — the first three columns, as THREE values. SRFI-1.', '(call-with-values (lambda () (unzip3 (list (list 1 2 3)))) list) => ((1) (2) (3))', 'list'],
  ['unzip4',            1,            '(unzip4 lst-of-lsts) — the first four columns, as FOUR values. SRFI-1.', '(call-with-values (lambda () (unzip4 (list (list 1 2 3 4)))) list) => ((1) (2) (3) (4))', 'list'],
  ['unzip5',            1,            '(unzip5 lst-of-lsts) — the first five columns, as FIVE values. SRFI-1.', '(call-with-values (lambda () (unzip5 (list (list 1 2 3 4 5)))) list) => ((1) (2) (3) (4) (5))', 'list'],
  ['lset-xor',          [1, Infinity], '(lset-xor = lst ...) — the symmetric difference of the sets. SRFI-1.', '(lset-xor equal? (list 1 2) (list 2 3)) => (3 1)', 'list'],
  ['lset-diff+intersection', [2, Infinity], '(lset-diff+intersection = lst1 lst ...) — the difference and the intersection, as TWO values. SRFI-1.', '(call-with-values (lambda () (lset-diff+intersection equal? (list 1 2) (list 2))) list) => ((1) (2))', 'list'],
]

// SRFI-1's linear-update names, in two groups.
//
// `_BANG_LINEAR` are the ones with their own implementation in `installSRFI1`:
// they REUSE the caller's cells, which is the strong reading of SRFI-1's
// permission and the one Motoi took on 2026-08-03. Their doc row has to say so,
// because "same as the twin" is now false about every name in this group and a
// learner reading the reference would be told the opposite of what runs.
//
// `_BANG_ALIASES` are the ones for which the twin genuinely IS the linear-update
// procedure — nothing of the caller's is theirs to reuse. Deriving their META
// rows from the twin's keeps the two from drifting apart.
// The third column is the arity. It is spelled out rather than borrowed from
// the twin's row because several of these twins — take, drop, filter, map,
// reverse, append — live in src/base.js and are not in this file's META at all,
// so the lookup found nothing and every one of them documented itself as
// "1 or more arguments".
const _BANG_LINEAR = [
  ['append!', 'append', [0, Infinity]], ['reverse!', 'reverse', 1],
  ['append-reverse!', 'append-reverse', 2], ['concatenate!', 'concatenate', 1],
  ['take!', 'take', 2], ['drop-right!', 'drop-right', 2],
  ['split-at!', 'split-at', 2], ['map!', 'map', [2, Infinity]],
  ['filter!', 'filter', 2], ['remove!', 'remove', 2], ['partition!', 'partition', 2],
  ['take-while!', 'take-while', 2], ['span!', 'span', 2], ['break!', 'break', 2],
  ['delete!', 'delete', [2, 3]], ['delete-duplicates!', 'delete-duplicates', [1, 2]],
  ['alist-delete!', 'alist-delete', [2, 3]],
]

const _BANG_ALIASES = [
  ['append-map!', 'append-map'], ['drop-while!', 'drop-while'],
  ['find-tail!', 'find-tail'], ['filter-map!', 'filter-map'],
  ['pair-for-each!', 'pair-for-each'],
  ['lset-adjoin!', 'lset-adjoin'], ['lset-union!', 'lset-union'],
  ['lset-intersection!', 'lset-intersection'], ['lset-difference!', 'lset-difference'],
  ['lset-xor!', 'lset-xor'], ['lset-diff+intersection!', 'lset-diff+intersection'],
]

for (const [bang, pure, arity] of _BANG_LINEAR) {
  const row = META.find((r) => r[0] === pure)
  META.push([
    bang,
    arity,
    `(${bang} ...) — the linear-update variant of \`${pure}\`. It REUSES the cells of the list you hand it, so that list is changed and must not be used again; the answer is built from the very cells you passed in. Use \`${pure}\` when you still need the original. SRFI-1.`,
    row ? row[3] : `(${bang} ...) => like ${pure}, reusing the argument's cells`,
    row ? row[4] : 'list',
  ])
}

for (const [bang, pure] of _BANG_ALIASES) {
  const row = META.find((r) => r[0] === pure)
  META.push([
    bang,
    row ? row[1] : [1, Infinity],
    `(${bang} ...) — the linear-update variant of \`${pure}\`. It has nothing of yours to reuse (its answer is built from fresh cells either way), so it is exactly \`${pure}\`. SRFI-1.`,
    row ? row[3] : `(${bang} ...) => same as ${pure}`,
    row ? row[4] : 'list',
  ])
}

export default installSRFI1
