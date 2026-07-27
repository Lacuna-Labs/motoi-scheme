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

import { apply } from '../../src/interp.js'
import { Sym } from '../../src/reader.js'
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
]

export function installSRFI1 (env, fuelBox) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  // (iota count [start [step]]) — SRFI-1. Numeric range with start+step.
  def('iota', (count, start = 0, step = 1) => {
    const n = Math.max(0, count | 0)
    const out = new Array(n)
    for (let i = 0; i < n; i++) out[i] = start + i * step
    return out
  })

  // (fold f init lst) — SRFI-1 left fold. Element-first: (f elem acc).
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
  def('cons*', (...args) => {
    if (args.length === 0) return []
    if (args.length === 1) return args[0]
    const tail = args[args.length - 1]
    const prefix = args.slice(0, -1)
    return [...prefix, ...(Array.isArray(tail) ? tail : [tail])]
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

  registerPartMeta(META, { source: 'lib/std/srfi-1.js' })
  return env
}

export const META = [
  ['iota',              [1, 3],       '(iota count [start [step]]) — a list of count numbers starting at start with the given step. SRFI-1.', '(iota 5) => (0 1 2 3 4)', 'list'],
  ['fold',              3,            '(fold f init lst) — left fold, element-first (f elem acc). SRFI-1.',   '(fold + 0 (list 1 2 3)) => 6',                'higher-order'],
  ['fold-right',        3,            '(fold-right f init lst) — right fold. SRFI-1.',                       '(fold-right cons (list) (list 1 2 3)) => (1 2 3)', 'higher-order'],
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
]

export default installSRFI1
