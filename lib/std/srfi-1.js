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
  'lset<=', 'lset=',
]

// ── teaching-quality guards ─────────────────────────────────────────
// Motoi represents a PROPER list as a JS array; a `Pair` is minted only for
// an improper (dotted) cdr. Every list verb therefore has an array fast path
// plus a guard, so a learner who hands a dotted pair to a list verb reads a
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
  if (Array.isArray(v)) return `a list of ${v.length} element${v.length === 1 ? '' : 's'}`
  if (v instanceof Pair) return 'an improper (dotted) pair'
  return 'a value of some other kind'
}

function _needList (name, v) {
  if (Array.isArray(v)) return v
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
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

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
  const _foldLists = (lists) => lists.map((l) => (Array.isArray(l) ? l : []))
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

  // (partition pred lst) — SRFI-1. Two-list split. Returns TWO values
  // (in-list out-list) per spec; consume with call-with-values / let-values /
  // receive. `values`/`call-with-values` machinery is live (R7RS §6.10).
  def('partition', (pred, lst) => {
    if (!Array.isArray(lst)) return new Values([[], []])
    const yes = [], no = []
    for (const x of lst) {
      if (apply(pred, [x], fuelBox) !== false) yes.push(x)
      else no.push(x)
    }
    return new Values([yes, no])
  })

  // (find pred lst) — SRFI-1. First element satisfying pred, or #f.
  def('find', (pred, lst) => {
    if (!Array.isArray(lst)) return false
    for (const x of lst) if (apply(pred, [x], fuelBox) !== false) return x
    return false
  })

  // (delete-duplicates lst [=]) — SRFI-1. Keep first occurrence. An optional
  // comparator is called as (= kept candidate), kept-element first, and forces
  // the O(n^2) pairwise walk the spec describes — a hash key cannot stand in
  // for an arbitrary equality predicate.
  def('delete-duplicates', (lst, eq) => {
    if (!Array.isArray(lst)) return lst
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
    if (!Array.isArray(lst)) return []
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
    if (!Array.isArray(lst)) return []
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
      if (Array.isArray(tail)) out.push(...tail)
    }
    return out
  })

  // (take-while pred lst) — SRFI-1. Longest prefix all satisfying pred.
  def('take-while', (pred, lst) => {
    if (!Array.isArray(lst)) return []
    const out = []
    for (const x of lst) {
      if (apply(pred, [x], fuelBox) === false) break
      out.push(x)
    }
    return out
  })

  // (drop-while pred lst) — SRFI-1. Drop the take-while prefix.
  def('drop-while', (pred, lst) => {
    if (!Array.isArray(lst)) return []
    let i = 0
    while (i < lst.length && apply(pred, [lst[i]], fuelBox) !== false) i++
    return lst.slice(i)
  })

  // (last-pair lst) — SRFI-1. Motoi has no dotted pairs, so the last pair
  // of (1 2 3) is the one-element list (3).
  def('last-pair', (lst) => {
    if (!Array.isArray(lst) || lst.length === 0) return []
    return [lst[lst.length - 1]]
  })

  // (cons* e1 e2 ... tail) — SRFI-1. Cons every leading arg onto the tail.
  // Folds right with the same rule as `cons`, so a non-list tail mints a real
  // improper pair: (cons* 1 2 3) is (1 2 . 3), not (1 2 3).
  def('cons*', (...args) => {
    if (args.length === 0) return []
    let acc = args[args.length - 1]
    for (let i = args.length - 2; i >= 0; i--) {
      acc = Array.isArray(acc) ? [args[i], ...acc] : new Pair(args[i], acc)
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
  def('xcons', (d, a) => (Array.isArray(d) ? [a, ...d] : new Pair(a, d)))

  // (proper-list? x) — SRFI-1 §Predicates. #t iff x is a finite,
  // ()-terminated list. Motoi's arrays ARE proper lists, so the array case
  // is immediate; a Pair chain is walked, and it is proper only if the
  // chain lands on a list or on (). Circular structure returns #f, per
  // spec, and the walk is bounded so a cycle cannot hang the interpreter.
  def('proper-list?', (x) => {
    if (Array.isArray(x)) return true
    if (!(x instanceof Pair)) return false
    // Floyd cycle detection over the cdr chain.
    let slow = x, fast = x
    for (;;) {
      if (!(fast instanceof Pair)) return Array.isArray(fast)
      fast = fast.cdr
      if (!(fast instanceof Pair)) return Array.isArray(fast)
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
  def('take-right', (lst, k) => {
    const a = _needList('take-right', lst)
    const n = Math.max(0, k | 0)
    if (n > a.length) {
      throw new Error(`take-right: asked for the last ${n} elements of a list that is only ${a.length} long.`)
    }
    return a.slice(a.length - n)
  })

  // (drop-right lst k) — SRFI-1 §Selectors. All but the last k elements.
  def('drop-right', (lst, k) => {
    const a = _needList('drop-right', lst)
    const n = Math.max(0, k | 0)
    if (n > a.length) {
      throw new Error(`drop-right: asked to drop the last ${n} elements of a list that is only ${a.length} long.`)
    }
    return a.slice(0, a.length - n)
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
    const a = _needList('append-reverse', revHead)
    const t = Array.isArray(tail) ? tail : null
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
]

export default installSRFI1
