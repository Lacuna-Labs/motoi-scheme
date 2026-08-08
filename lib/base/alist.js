// lib/base/alist.js — association-list value accessors.
//
// Provenance: 2026-08-04. `assoc-ref` is called 1,123 times across the eBay
// and Etsy carts and was unbound. Heritage is Guile's `assoc-ref`; it is not
// R7RS-small and it is not in any adopted SRFI, so by the conformance ladder
// (R7RS-small → SRFI → Motoi-own) it lands on the last rung as Motoi-own.
//
// Why it is not a redundant spelling of `assoc`:
//   (assoc key alist)      -> the ENTRY, or #f
//   (assoc-ref alist key)  -> the VALUE, or a default
// Different answer, different argument order, and a default the caller can
// name. `(cdr (assoc k a))` raises on a miss; that raise is the reason every
// cart wrapped it, and wrapping it 1,123 times is what this verb replaces.
//
// Doctrine:
//   * Key comparison is the LANGUAGE's `equal?`, reached through apply — not
//     a private comparison written here. A second, subtly different equality
//     is exactly how a lookup starts answering #f forever without raising.
//   * The value is the entry's CDR, always. No shape sniffing. A (k . v)
//     entry answers v; a (k v) entry answers (v), because that is its cdr.
//     Guessing which shape the caller meant would make the answer depend on
//     the data instead of on the call, and a wrong guess here is silent.

import { Pair } from './list.js'
import { apply } from '../../src/interp.js'

// ── inline registration metadata ─────────────────────────────────
export const VERBS = ['assoc-ref']
export const LAZY = false
export const BOOK = 'book-of-code/ch-lists-and-tables'

export const TESTS = [
  // Dotted entries — the shape the carts build with (cons 'k v).
  ['(assoc-ref (list (cons \'a 1) (cons \'b 2)) \'b)', '2'],
  // A miss with no default is #f.
  ['(assoc-ref (list (cons \'a 1)) \'z)', '#f'],
  // A miss with a default answers the default.
  ['(assoc-ref (list (cons \'a 1)) \'z 0)', '0'],
  // equal? keys, not eq? — a string key built at call time still matches.
  ['(assoc-ref (list (cons "k" 7)) (string-append "" "k"))', '7'],
  // The value is the cdr, so a two-element entry answers a one-element list.
  ['(assoc-ref (list (list \'a 1)) \'a)', '(1)'],
  // The empty table is a miss, not an error.
  ['(assoc-ref (list) \'a)', '#f'],
]

export function installAlist (env, fuelBox) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  // (assoc-ref alist key [default]) -> value | default
  //
  // Note the argument order: the TABLE comes first, unlike `assoc`. That is
  // Guile's order and the order all 1,123 call sites are written in.
  def('assoc-ref', (alist, key, ...rest) => {
    const dflt = rest.length > 0 ? rest[0] : false
    const same = (a, b) => apply(env.get('equal?'), [a, b], fuelBox) === true

    const valueOf = (entry) => {
      if (entry instanceof Pair) return entry.cdr
      if (Array.isArray(entry)) return entry.slice(1)
      // An entry that is neither is not a table row; treat the table as
      // malformed rather than inventing a value for it.
      throw new Error('assoc-ref: alist entry is not a pair')
    }

    // Both spellings of a list spine, because both reach this verb — cells
    // from quoted data, arrays from the sequence-verb side of the boundary.
    if (Array.isArray(alist)) {
      for (const entry of alist) {
        const k = entry instanceof Pair ? entry.car : (Array.isArray(entry) ? entry[0] : undefined)
        if (k !== undefined && same(k, key)) return valueOf(entry)
      }
      return dflt
    }

    let x = alist
    while (x instanceof Pair) {
      const entry = x.car
      const k = entry instanceof Pair ? entry.car : (Array.isArray(entry) ? entry[0] : undefined)
      if (k !== undefined && same(k, key)) return valueOf(entry)
      x = x.cdr
    }
    return dflt
  })

  return env
}

export default installAlist
