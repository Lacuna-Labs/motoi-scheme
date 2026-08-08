// lib/std/srfi-125.js — SRFI-125: Intermediate Hash Tables.
//
// Relocated 2026-07-24 from src/r7rs-completions.js (full standard-library
// relocation into per-part libs). This is the SRFI-125 PART. It supersedes
// SRFI-69 (the older spec) as the R7RS-large-track selection: standardized
// equality-predicate + hash-fn constructor, `hash-table-ref`/`-set!` as the
// canonical surface.
//
// Provenance: SRFI-125 (Taylor Campbell, John Cowan, Will Clinger).
// https://srfi.schemers.org/srfi-125/
//
// The HashTable class itself lives in lib/std/_shared.js (one representation
// shared across parts).
//
// STRICT SRFI-125 SURFACE (2026-07-24): the non-SRFI-125 names that previously
// lived here were DROPPED from the wired surface so this bucket is strictly
// SRFI-125. Removed: `hash-ref` / `hash-set!` (short aliases, not SRFI-125) and
// `hash-table-exists?` (the SRFI-69 name that SRFI-125 replaced with
// `hash-table-contains?`). Programs using the removed names are preserved as
// teaching cases in broken-examples/ with their standard fix.
//
// NOTE on kept divergences (broken-examples, not silent bugs):
//   • `hash-table->alist` returns two-element lists ((k v)), not dotted
//     pairs ((k . v)) — Motoi has no dotted pairs. See
//     broken-examples/hash-table-alist-dotted.
//   • The `hash-table` constructor OMITS the SRFI-125 comparator argument
//     (Motoi has no comparator objects; `make-hash-table` is arity 0), so it
//     takes alternating key/value arguments directly: (hash-table k1 v1 ...).
//     SRFI-125's result is immutable; Motoi's is an ordinary mutable table.
//
// SURFACE COMPLETION (2026-07-24): wired the four remaining SRFI-125 whole-table
// procedures used by the reference — `hash-table` (constructor), `hash-table-walk`
// (table-first), `hash-table-for-each` (proc-first), `hash-table-copy`.

import { apply } from '../../src/interp.js'
import { Values } from '../base/r7rs-types.js'
import { HashTable, registerPartMeta } from './_shared.js'

import { isList, seqVerb } from '../base/list.js'
export const STD = 'SRFI-125'
export const SPEC = 'spec/srfi-125.slatl'
export const LAZY = true // not in the default bundle; pulled in explicitly

export const VERBS = [
  'make-hash-table', 'hash-table', 'hash-table?', 'hash-table-set!',
  'hash-table-ref', 'hash-table-ref/default', 'hash-table-delete!',
  'hash-table-contains?', 'hash-table-keys',
  'hash-table-values', 'hash-table-size', 'hash-table-clear!',
  'hash-table-update!', 'hash-table-update!/default', 'hash-table-fold',
  'hash-table-walk', 'hash-table-for-each', 'hash-table-copy',
  'hash-table->alist', 'alist->hash-table',
  // Surface completion 2026-08-02 — SRFI-125 procedures the part declared
  // but never wired.
  'hash-table-empty?', 'hash-table-count', 'hash-table-find',
  'hash-table-map', 'hash-table-prune!', 'hash-table-pop!',
  'hash-table-intern!',
]

export function installSRFI125 (env, fuelBox) {
  const def = (n, f, perm = 'read') => env.define(n, seqVerb(f), { perm })

  def('make-hash-table', () => new HashTable())
  // (hash-table key1 value1 key2 value2 ...) — SRFI-125 constructor. STRICT
  // SRFI-125 takes a comparator as the first argument; Motoi has no comparator
  // objects (make-hash-table is arity 0), so this constructor consistently
  // OMITS the comparator and takes alternating key/value arguments directly.
  // An odd number of arguments is an error. SRFI-125's result is immutable;
  // Motoi has no immutable tables, so the returned table is ordinary/mutable.
  def('hash-table', (...kv) => {
    if (kv.length % 2 !== 0) {
      throw new Error(`hash-table: odd number of arguments (need alternating key/value): ${kv.length}`)
    }
    const h = new HashTable()
    for (let i = 0; i < kv.length; i += 2) h.set(kv[i], kv[i + 1])
    return h
  })
  def('hash-table?', (v) => v instanceof HashTable)
  def('hash-table-set!', (h, k, v) => { if (h instanceof HashTable) h.set(k, v); return undefined }, 'state-change')
  // (hash-table-ref h k [failure [success]]) — SRFI-125. Strict: the third
  // arg is a FAILURE THUNK (called with no args when the key is missing), the
  // fourth a SUCCESS procedure (called on the found value). With no failure
  // thunk, a missing key is an error — NOT a silent #f. For a plain-value
  // default, use hash-table-ref/default.
  def('hash-table-ref', (h, k, failure, success) => {
    if (h instanceof HashTable && h.has(k)) {
      const v = h.get(k)
      return success ? apply(success, [v], fuelBox) : v
    }
    if (failure !== undefined) return apply(failure, [], fuelBox)
    // A non-table used to reach the same message, so (hash-table-ref 5 1)
    // reported "key not found: 1" and sent the reader hunting for a key
    // that was never the problem. Name the actual cause.
    if (!(h instanceof HashTable)) {
      throw new Error('hash-table-ref: expected a hash table first — the order is (hash-table-ref table key [failure] [success]). Make one with (make-hash-table).')
    }
    throw new Error(`hash-table-ref: key not found: ${String(k)}`)
  })
  def('hash-table-ref/default', (h, k, dflt) => {
    if (!(h instanceof HashTable)) return dflt
    return h.has(k) ? h.get(k) : dflt
  })
  def('hash-table-delete!', (h, k) => { if (h instanceof HashTable) h.delete(k); return undefined }, 'state-change')
  def('hash-table-contains?', (h, k) => (h instanceof HashTable) && h.has(k))
  def('hash-table-keys', (h) => (h instanceof HashTable) ? h.keys() : [])
  def('hash-table-values', (h) => (h instanceof HashTable) ? h.values() : [])
  def('hash-table-size', (h) => (h instanceof HashTable) ? h.size : 0)
  def('hash-table-clear!', (h) => { if (h instanceof HashTable) h.map.clear(); return undefined }, 'state-change')
  // (hash-table-update! h k updater [failure [success]]) — SRFI-125. failure
  // is a THUNK producing the value when the key is missing (error if absent
  // and no failure given); success optionally transforms the found value
  // before updater runs. For a plain-value fallback, use the /default variant.
  def('hash-table-update!', (h, k, updater, failure, success) => {
    if (!(h instanceof HashTable)) return undefined
    let cur
    if (h.has(k)) {
      cur = h.get(k)
      if (success) cur = apply(success, [cur], fuelBox)
    } else if (failure !== undefined) {
      cur = apply(failure, [], fuelBox)
    } else {
      throw new Error(`hash-table-update!: key not found and no failure thunk: ${String(k)}`)
    }
    h.set(k, apply(updater, [cur], fuelBox))
    return undefined
  }, 'state-change')
  // (hash-table-update!/default h k proc default) — SRFI-125. Like
  // hash-table-update! but the missing-key fallback is a plain default
  // VALUE (not a thunk). proc is applied to the current-or-default value.
  def('hash-table-update!/default', (h, k, proc, dflt) => {
    if (!(h instanceof HashTable)) return undefined
    const cur = h.has(k) ? h.get(k) : dflt
    h.set(k, apply(proc, [cur], fuelBox))
    return undefined
  }, 'state-change')
  def('hash-table-fold', (h, fn, seed) => {
    if (!(h instanceof HashTable)) return seed
    let acc = seed
    for (const [k, v] of h.entries()) acc = apply(fn, [k, v, acc], fuelBox)
    return acc
  })
  // (hash-table-walk h proc) — SRFI-125. Calls (proc key value) on every entry
  // in unspecified order, for side effect. Table-first argument order (kept
  // from SRFI-69 for compatibility). Returns unspecified.
  def('hash-table-walk', (h, proc) => {
    if (h instanceof HashTable) {
      for (const [k, v] of h.entries()) apply(proc, [k, v], fuelBox)
    }
    return undefined
  }, 'read')
  // (hash-table-for-each proc h) — SRFI-125. Same as hash-table-walk but with
  // proc FIRST (the R7RS-large argument order). Calls (proc key value) on every
  // entry for side effect. Returns unspecified.
  def('hash-table-for-each', (proc, h) => {
    if (h instanceof HashTable) {
      for (const [k, v] of h.entries()) apply(proc, [k, v], fuelBox)
    }
    return undefined
  }, 'read')
  // (hash-table-copy h [mutable]) — SRFI-125. Returns a newly allocated hash
  // table with the same associations as h. The optional mutable argument is
  // accepted and ignored (Motoi tables are always mutable).
  def('hash-table-copy', (h, _mutable) => {
    const out = new HashTable()
    if (h instanceof HashTable) {
      for (const [k, v] of h.entries()) out.set(k, v)
    }
    return out
  })
  def('hash-table->alist', (h) => {
    if (!(h instanceof HashTable)) return []
    return h.entries().map(([k, v]) => [k, v])
  })
  def('alist->hash-table', (alist) => {
    const h = new HashTable()
    if (isList(alist)) {
      for (const pair of alist) {
        if (isList(pair) && pair.length >= 2) h.set(pair[0], pair[1])
      }
    }
    return h
  })

  // ── Surface completion 2026-08-02 ─────────────────────────────────
  // The SRFI-125 procedures the part declared but never bound. Argument
  // ORDER follows SRFI-125 exactly, which is not uniform: some take the
  // table first (count, intern!, empty?, pop!) and some take the procedure
  // first (find, prune!, map). Do not "tidy" these — the spec is the spec.
  //
  // Unlike the older verbs above (which quietly return a default when handed
  // a non-table), these say so. A learner who passes the wrong thing should
  // read a sentence, not get a silent 0.
  const PROC_FIRST = new Set(['hash-table-find', 'hash-table-prune!', 'hash-table-map'])
  const _needTable = (name, h) => {
    if (h instanceof HashTable) return h
    const where = PROC_FIRST.has(name)
      ? `(${name} proc table …) — the procedure comes first, the table SECOND`
      : `(${name} table …) — the table comes FIRST`
    throw new Error(
      `${name}: expected a hash table. Make one with (make-hash-table), or ` +
      "(hash-table 'a 1 'b 2) to start it off with entries. Argument order is " +
      `${where}.`)
  }

  // (hash-table-empty? h) — SRFI-125. #t when the table has no associations.
  def('hash-table-empty?', (h) => _needTable('hash-table-empty?', h).size === 0)

  // (hash-table-count h pred) — SRFI-125. How many associations satisfy pred,
  // which is called as (pred key value). Table FIRST.
  def('hash-table-count', (h, pred) => {
    const t = _needTable('hash-table-count', h)
    let n = 0
    for (const [k, v] of t.entries()) {
      if (apply(pred, [k, v], fuelBox) !== false) n++
    }
    return n
  })

  // (hash-table-find proc h failure) — SRFI-125. Calls (proc key value) on
  // each association; returns the first TRUE result. If none is true, calls
  // the thunk `failure` with no arguments and returns that. Procedure FIRST.
  def('hash-table-find', (proc, h, failure) => {
    const t = _needTable('hash-table-find', h)
    for (const [k, v] of t.entries()) {
      const r = apply(proc, [k, v], fuelBox)
      if (r !== false) return r
    }
    if (failure === undefined) {
      throw new Error('hash-table-find: nothing matched and no failure thunk was given. Pass one: (hash-table-find proc table (lambda () #f)).')
    }
    return apply(failure, [], fuelBox)
  })

  // (hash-table-map proc h) — SRFI-125. A NEW table with the same keys, each
  // value replaced by (proc value). The original is untouched.
  //
  // DIVERGENCE (the one this whole file already carries): strict SRFI-125 is
  // (hash-table-map proc comparator table). Motoi has no comparator objects —
  // make-hash-table is arity 0 and the `hash-table` constructor omits the
  // comparator too — so this omits it as well, consistently.
  def('hash-table-map', (proc, h) => {
    const t = _needTable('hash-table-map', h)
    const out = new HashTable()
    for (const [k, v] of t.entries()) out.set(k, apply(proc, [v], fuelBox))
    return out
  })

  // (hash-table-prune! proc h) — SRFI-125. REMOVES every association for
  // which (proc key value) is true. Mutates h; returns unspecified.
  // Note the polarity: prune! deletes what matches, the opposite of filter.
  // Procedure FIRST.
  def('hash-table-prune!', (proc, h) => {
    const t = _needTable('hash-table-prune!', h)
    const doomed = []
    for (const [k, v] of t.entries()) {
      if (apply(proc, [k, v], fuelBox) !== false) doomed.push(k)
    }
    for (const k of doomed) t.delete(k)
    return undefined
  }, 'state-change')

  // (hash-table-pop! h) — SRFI-125. Removes an arbitrary association and
  // returns TWO values: its key and its value. Popping an empty table is an
  // error. Consume with call-with-values / let-values / receive.
  def('hash-table-pop!', (h) => {
    const t = _needTable('hash-table-pop!', h)
    if (t.size === 0) {
      throw new Error('hash-table-pop!: the table is empty, so there is nothing to pop. Check (hash-table-empty? h) first.')
    }
    const [k, v] = t.entries()[0]
    t.delete(k)
    return new Values([k, v])
  }, 'state-change')

  // (hash-table-intern! h key failure) — SRFI-125. If key is already bound,
  // returns its value and changes nothing. Otherwise calls the thunk
  // `failure` with no arguments, STORES that result under key, and returns
  // it. The "compute it once, then remember it" verb. Table FIRST.
  def('hash-table-intern!', (h, key, failure) => {
    const t = _needTable('hash-table-intern!', h)
    if (t.has(key)) return t.get(key)
    const v = apply(failure, [], fuelBox)
    t.set(key, v)
    return v
  }, 'state-change')

  registerPartMeta(META, { source: 'lib/std/srfi-125.js' })
  return env
}

export const META = [
  ['make-hash-table',   0, 'Make a new empty hash table. SRFI-125.',                    '(make-hash-table)',          'hash'],
  ['hash-table',        [0, Infinity], '(hash-table key1 value1 key2 value2 ...) — construct a hash table from alternating key/value arguments. SRFI-125 (Motoi omits the comparator argument; odd argument count is an error).', '(hash-table \'a 1 \'b 2)', 'hash'],
  ['hash-table?',       1, '#t if arg is a hash table. SRFI-125.',                      '(hash-table? (make-hash-table)) => #t', 'predicate'],
  ['hash-table-set!',   3, '(hash-table-set! h k v) — insert or update. SRFI-125.',     '(let ((h (make-hash-table))) (hash-table-set! h "k" 42) (hash-table-ref/default h "k" 0)) => 42', 'hash'],
  ['hash-table-ref',    [2, 4], '(hash-table-ref h k [failure [success]]) — read; failure is a thunk called when missing (error if omitted), success transforms the found value. SRFI-125.', '(hash-table-ref (hash-table "k" 42) "k" (lambda () 0)) => 42', 'hash'],
  ['hash-table-ref/default', 3, '(hash-table-ref/default h k default) — read, default if missing. SRFI-125.', '(hash-table-ref/default (hash-table "k" 42) "k" 0) => 42', 'hash'],
  ['hash-table-delete!', 2, '(hash-table-delete! h k) — remove entry. SRFI-125.',       '(let ((h (hash-table "k" 1))) (hash-table-delete! h "k") (hash-table-size h)) => 0', 'hash'],
  ['hash-table-contains?', 2, '(hash-table-contains? h k) — #t if k is bound. SRFI-125 (replaces the SRFI-69 name hash-table-exists?).', '(hash-table-contains? (hash-table "k" 1) "k") => #t', 'hash'],
  ['hash-table-keys',   1, 'List of all keys in a hash table. SRFI-125.',                '(hash-table-keys (hash-table "a" 1 "b" 2)) => ("a" "b")', 'hash'],
  ['hash-table-values', 1, 'List of all values in a hash table. SRFI-125.',              '(hash-table-values (hash-table "a" 1 "b" 2)) => (1 2)', 'hash'],
  ['hash-table-size',   1, 'Number of entries in a hash table. SRFI-125.',               '(hash-table-size (hash-table "a" 1 "b" 2)) => 2', 'hash'],
  ['hash-table-clear!', 1, 'Remove all entries. SRFI-125.',                              '(let ((h (hash-table "a" 1))) (hash-table-clear! h) (hash-table-size h)) => 0', 'hash'],
  ['hash-table-update!', [3, 5], '(hash-table-update! h k updater [failure [success]]) — apply updater; failure is a thunk for the missing-key value (error if omitted). SRFI-125.', '(let ((h (hash-table "k" 1))) (hash-table-update! h "k" (lambda (v) (+ v 1)) (lambda () 0)) (hash-table-ref/default h "k" 0)) => 2', 'hash'],
  ['hash-table-update!/default', 4, '(hash-table-update!/default h k proc default) — update; default is a plain value. SRFI-125.', '(let ((h (make-hash-table))) (hash-table-update!/default h "k" (lambda (v) (+ v 1)) 0) (hash-table-ref/default h "k" 0)) => 1', 'hash'],
  ['hash-table-fold',   3, '(hash-table-fold h f seed) — left fold over entries. SRFI-125.', '(hash-table-fold (hash-table "a" 1 "b" 2) (lambda (k v acc) (+ acc v)) 0) => 3', 'hash'],
  ['hash-table-walk',   2, '(hash-table-walk h proc) — call (proc key value) on every entry for side effect (table-first order). SRFI-125.', '(hash-table-walk (hash-table "a" 1) (lambda (k v) (display v)))', 'hash'],
  ['hash-table-for-each', 2, '(hash-table-for-each proc h) — like hash-table-walk but proc-first (R7RS-large order). SRFI-125.', '(hash-table-for-each (lambda (k v) (display v)) (hash-table "a" 1))', 'hash'],
  ['hash-table-copy',   [1, 2], '(hash-table-copy h [mutable]) — new hash table with the same associations (mutable arg accepted and ignored). SRFI-125.', '(hash-table-size (hash-table-copy (hash-table "a" 1))) => 1', 'hash'],
  ['hash-table->alist', 1, 'Convert a hash table to an association list. SRFI-125.',     '(hash-table->alist (hash-table "a" 1 "b" 2)) => (("a" 1) ("b" 2))', 'hash'],
  ['alist->hash-table', 1, 'Convert an association list to a hash table. SRFI-125.',     '(alist->hash-table (list (list "a" 1)))', 'hash'],
  // Surface completion 2026-08-02.
  ['hash-table-empty?', 1, '(hash-table-empty? h) — #t when the table has no associations. SRFI-125.', '(hash-table-empty? (make-hash-table)) => #t', 'predicate'],
  ['hash-table-count',  2, '(hash-table-count h pred) — how many associations satisfy (pred key value). Table first. SRFI-125.', '(hash-table-count (hash-table "a" 1 "b" 2) (lambda (k v) (> v 1))) => 1', 'hash'],
  ['hash-table-find',   3, '(hash-table-find proc h failure) — first true result of (proc key value), else the thunk failure. Procedure FIRST. SRFI-125.', '(hash-table-find (lambda (k v) (and (> v 1) v)) (hash-table "a" 1 "b" 2) (lambda () #f)) => 2', 'hash'],
  ['hash-table-map',    2, '(hash-table-map proc h) — a NEW table, same keys, each value replaced by (proc value). Procedure FIRST. SRFI-125 (Motoi omits the comparator argument).', '(hash-table-ref/default (hash-table-map (lambda (v) (* v 10)) (hash-table "a" 1)) "a" 0) => 10', 'hash'],
  ['hash-table-prune!', 2, '(hash-table-prune! proc h) — REMOVE every association where (proc key value) is true. Procedure FIRST. SRFI-125.', '(let ((h (hash-table "a" 1 "b" 2))) (hash-table-prune! (lambda (k v) (> v 1)) h) (hash-table-size h)) => 1', 'hash'],
  ['hash-table-pop!',   1, '(hash-table-pop! h) — remove an arbitrary association and return TWO values, its key and its value. Empty table is an error. SRFI-125.', '(call-with-values (lambda () (hash-table-pop! (hash-table "a" 1))) list) => ("a" 1)', 'hash'],
  ['hash-table-intern!', 3, '(hash-table-intern! h key failure) — the existing value, or else store and return the thunk failure\'s result. Compute once, then remember. SRFI-125.', '(hash-table-intern! (make-hash-table) "k" (lambda () 42)) => 42', 'hash'],
]

export default installSRFI125
