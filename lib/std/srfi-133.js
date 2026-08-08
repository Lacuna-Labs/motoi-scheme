// lib/std/srfi-133.js — SRFI-133: Vector Library (R7RS-compatible).
//
// Provenance: SRFI-133 (John Cowan, Will Clinger), the R7RS-large successor
// to SRFI-43. https://srfi.schemers.org/srfi-133/
//
// This is the SRFI-133 PART. R7RS-small already owns `vector?`, `make-vector`,
// `vector`, `vector-length`, `vector-ref`, `vector-set!`, `vector->list`,
// `list->vector`, `vector->string`, `string->vector`, `vector-copy`,
// `vector-copy!`, `vector-append`, `vector-fill!`, `vector-map` and
// `vector-for-each`. Per the conformance ladder R7RS-small is the semantic
// authority for those names, so this part does NOT rebind them — SRFI-133's
// text for them is satisfied by the R7RS definitions already installed from
// lib/base/r7rs-small.js. Everything here is the surface R7RS-small lacks.
//
// One argument-order trap worth stating out loud: SRFI-133's `vector-fold`
// calls `(kons state elt ...)` with the ACCUMULATOR FIRST, the opposite of
// SRFI-1's `fold`, which calls `(kons elt state)`. They are different
// standards and Motoi carries both, so the orders must not be "harmonized".

import { apply, Closure } from '../../src/interp.js'
import { SchemeVector, isVec, mkVec, Values } from '../base/r7rs-types.js'
import { registerPartMeta } from './_shared.js'
import { seqVerb } from '../base/list.js'

export const STD = 'SRFI-133'
export const SPEC = 'spec/srfi-133.slatl'
export const LAZY = true // not in the default bundle; pulled in explicitly

export const VERBS = [
  // constructors
  'vector-unfold', 'vector-unfold-right', 'vector-reverse-copy',
  'vector-concatenate', 'vector-append-subvectors',
  // predicates
  'vector-empty?', 'vector=',
  // iteration
  'vector-fold', 'vector-fold-right', 'vector-count', 'vector-cumulate',
  // searching
  'vector-index', 'vector-index-right', 'vector-skip', 'vector-skip-right',
  'vector-binary-search', 'vector-any', 'vector-every', 'vector-partition',
  // mutators
  'vector-swap!', 'vector-reverse!', 'vector-reverse-copy!',
  'vector-unfold!', 'vector-unfold-right!', 'vector-map!',
  // conversion
  'reverse-vector->list', 'reverse-list->vector',
]

function _vec (name, v, what = 'a vector') {
  if (!isVec(v)) {
    throw new Error(
      `${name}: expected ${what}, got ${_describe(v)}. ` +
      `A vector is written #(1 2 3) or built with (vector 1 2 3).`)
  }
  return v
}

function _describe (v) {
  if (v === undefined || v === null) return 'nothing'
  if (Array.isArray(v)) return `a list of ${v.length} element${v.length === 1 ? '' : 's'}`
  if (typeof v === 'string') return 'a string'
  if (typeof v === 'number') return `the number ${v}`
  if (typeof v === 'function' || v instanceof Closure) return 'a procedure'
  return String(v)
}

function _needProc (name, v, what = 'a procedure') {
  if (typeof v === 'function' || v instanceof Closure) return v
  throw new Error(
    `${name}: expected ${what}, got ${_describe(v)}. ` +
    `Pass a procedure — (lambda (x) ...) — not the result of calling one.`)
}

// An index must be a real, in-range integer. `| 0` truncates a float, wraps
// past 2^31 and lets a negative through to JS `slice`, where it means "from
// the end" — a reading neither R7RS nor SRFI-133 has.
function _idx (name, v, what, len) {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > len) {
    throw new Error(
      `${name}: ${what} must be an integer from 0 to ${len}, got ${_describe(v)}.`)
  }
  return v
}

function _range (name, start, end, len) {
  const a = start === undefined ? 0 : _idx(name, start, 'start', len)
  const b = end === undefined ? len : _idx(name, end, 'end', len)
  if (a > b) throw new Error(`${name}: start ${a} is past end ${b}.`)
  return [a, b]
}

// Every multi-vector verb in SRFI-133 stops at the SHORTEST argument.
function _cols (name, vs) {
  if (vs.length === 0) return [[], 0]
  const items = vs.map((v) => _vec(name, v).items)
  return [items, items.reduce((m, it) => Math.min(m, it.length), Infinity)]
}

// `vector-unfold` and friends let f return the element plus n new seeds as
// MULTIPLE values. With zero seeds f returns the element bare, and a
// single-value `values` call is indistinguishable from that value, so both
// spellings have to be accepted.
function _unfoldStep (r) {
  if (r instanceof Values) return [r.vals[0], r.vals.slice(1)]
  return [r, []]
}

export function installSRFI133 (env, fuelBox) {
  const fuel = fuelBox
  const def = (n, f, perm = 'read') => env.define(n, seqVerb(f), { perm })

  // ── Constructors ───────────────────────────────────────────────────

  // (vector-unfold f length seed ...) — f is called as (f i seed ...) and
  // answers the element followed by the next seeds. Fills left to right.
  def('vector-unfold', (f, len, ...seeds) => {
    _needProc('vector-unfold', f)
    const n = _idx('vector-unfold', len, 'length', Number.MAX_SAFE_INTEGER)
    const out = new Array(n)
    let s = seeds
    for (let i = 0; i < n; i++) {
      const [elt, next] = _unfoldStep(apply(f, [i, ...s], fuel))
      out[i] = elt
      s = next
    }
    return mkVec(out)
  })

  // (vector-unfold-right f length seed ...) — same, but fills from the LAST
  // index down to 0, so the seed threads right to left.
  def('vector-unfold-right', (f, len, ...seeds) => {
    _needProc('vector-unfold-right', f)
    const n = _idx('vector-unfold-right', len, 'length', Number.MAX_SAFE_INTEGER)
    const out = new Array(n)
    let s = seeds
    for (let i = n - 1; i >= 0; i--) {
      const [elt, next] = _unfoldStep(apply(f, [i, ...s], fuel))
      out[i] = elt
      s = next
    }
    return mkVec(out)
  })

  // (vector-unfold! f vec start end seed ...) — in-place, left to right.
  def('vector-unfold!', (f, v, start, end, ...seeds) => {
    _needProc('vector-unfold!', f)
    const items = _vec('vector-unfold!', v).items
    const [a, b] = _range('vector-unfold!', start, end, items.length)
    let s = seeds
    for (let i = a; i < b; i++) {
      const [elt, next] = _unfoldStep(apply(f, [i, ...s], fuel))
      items[i] = elt
      s = next
    }
    return undefined
  }, 'state-change')

  def('vector-unfold-right!', (f, v, start, end, ...seeds) => {
    _needProc('vector-unfold-right!', f)
    const items = _vec('vector-unfold-right!', v).items
    const [a, b] = _range('vector-unfold-right!', start, end, items.length)
    let s = seeds
    for (let i = b - 1; i >= a; i--) {
      const [elt, next] = _unfoldStep(apply(f, [i, ...s], fuel))
      items[i] = elt
      s = next
    }
    return undefined
  }, 'state-change')

  def('vector-reverse-copy', (v, start, end) => {
    const items = _vec('vector-reverse-copy', v).items
    const [a, b] = _range('vector-reverse-copy', start, end, items.length)
    return mkVec(items.slice(a, b).reverse())
  })

  // (vector-concatenate list-of-vectors). The argument is a LIST of vectors,
  // not a rest argument — that is the whole difference from `vector-append`.
  def('vector-concatenate', (lst) => {
    if (!Array.isArray(lst)) {
      throw new Error(
        `vector-concatenate: expected a list of vectors, got ${_describe(lst)}. ` +
        `To concatenate loose arguments use vector-append.`)
    }
    const out = []
    for (const v of lst) out.push(..._vec('vector-concatenate', v).items)
    return mkVec(out)
  })

  // (vector-append-subvectors [vec start end] ...) — arguments come in
  // groups of three. A partial trailing group is a mistake, not a default.
  def('vector-append-subvectors', (...args) => {
    if (args.length % 3 !== 0) {
      throw new Error(
        `vector-append-subvectors: arguments come in groups of three ` +
        `(vector start end); got ${args.length}, which is not a multiple of 3.`)
    }
    const out = []
    for (let i = 0; i < args.length; i += 3) {
      const items = _vec('vector-append-subvectors', args[i]).items
      const [a, b] = _range('vector-append-subvectors', args[i + 1], args[i + 2], items.length)
      out.push(...items.slice(a, b))
    }
    return mkVec(out)
  })

  // ── Predicates ─────────────────────────────────────────────────────

  def('vector-empty?', (v) => _vec('vector-empty?', v).items.length === 0)

  // (vector= elt=? vec ...). With no vectors or one vector the answer is #t
  // vacuously — there is no pair to disagree. Adjacent vectors are compared
  // pairwise, and a length mismatch short-circuits before elt=? is called.
  def('vector=', (eq, ...vs) => {
    _needProc('vector=', eq, 'an equality procedure')
    if (vs.length < 2) { vs.forEach((v) => _vec('vector=', v)); return true }
    for (let k = 0; k < vs.length - 1; k++) {
      const x = _vec('vector=', vs[k]).items
      const y = _vec('vector=', vs[k + 1]).items
      if (x.length !== y.length) return false
      for (let i = 0; i < x.length; i++) {
        if (apply(eq, [x[i], y[i]], fuel) === false) return false
      }
    }
    return true
  })

  // ── Iteration ──────────────────────────────────────────────────────

  // (vector-fold kons knil vec1 vec2 ...) — kons is (kons state elt ...).
  // ACCUMULATOR FIRST. SRFI-1's `fold` puts it LAST; both live in this
  // engine and neither may be bent toward the other.
  def('vector-fold', (kons, knil, ...vs) => {
    _needProc('vector-fold', kons)
    const [items, n] = _cols('vector-fold', vs)
    let acc = knil
    for (let i = 0; i < n; i++) acc = apply(kons, [acc, ...items.map((it) => it[i])], fuel)
    return acc
  })

  def('vector-fold-right', (kons, knil, ...vs) => {
    _needProc('vector-fold-right', kons)
    const [items, n] = _cols('vector-fold-right', vs)
    let acc = knil
    for (let i = n - 1; i >= 0; i--) acc = apply(kons, [acc, ...items.map((it) => it[i])], fuel)
    return acc
  })

  def('vector-count', (pred, ...vs) => {
    _needProc('vector-count', pred, 'a predicate')
    const [items, n] = _cols('vector-count', vs)
    let c = 0
    for (let i = 0; i < n; i++) {
      if (apply(pred, items.map((it) => it[i]), fuel) !== false) c++
    }
    return c
  })

  // (vector-cumulate f knil vec) — a running fold whose intermediate states
  // are the result: element i is (f state_{i-1} elt_i).
  def('vector-cumulate', (f, knil, v) => {
    _needProc('vector-cumulate', f)
    const items = _vec('vector-cumulate', v).items
    const out = new Array(items.length)
    let acc = knil
    for (let i = 0; i < items.length; i++) {
      acc = apply(f, [acc, items[i]], fuel)
      out[i] = acc
    }
    return mkVec(out)
  })

  // ── Searching ──────────────────────────────────────────────────────

  const _search = (name, want, rightward) => (pred, ...vs) => {
    _needProc(name, pred, 'a predicate')
    const [items, n] = _cols(name, vs)
    const hit = (i) => (apply(pred, items.map((it) => it[i]), fuel) !== false) === want
    if (rightward) { for (let i = n - 1; i >= 0; i--) if (hit(i)) return i }
    else { for (let i = 0; i < n; i++) if (hit(i)) return i }
    return false
  }

  def('vector-index', _search('vector-index', true, false))
  def('vector-index-right', _search('vector-index-right', true, true))
  // `skip` is `index` with the predicate's answer inverted: the first element
  // that does NOT satisfy it.
  def('vector-skip', _search('vector-skip', false, false))
  def('vector-skip-right', _search('vector-skip-right', false, true))

  // (vector-binary-search vec value cmp) — cmp answers negative / zero /
  // positive for "value sorts before / equal to / after this element".
  def('vector-binary-search', (v, value, cmp) => {
    const items = _vec('vector-binary-search', v).items
    _needProc('vector-binary-search', cmp, 'a three-way comparison procedure')
    let lo = 0, hi = items.length - 1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      const c = apply(cmp, [value, items[mid]], fuel)
      if (typeof c !== 'number') {
        throw new Error(
          `vector-binary-search: the comparison must answer a number ` +
          `(negative, zero or positive), got ${_describe(c)}.`)
      }
      if (c === 0) return mid
      if (c < 0) hi = mid - 1
      else lo = mid + 1
    }
    return false
  })

  // (vector-any pred vec ...) — the FIRST true value the predicate produced,
  // not #t. (vector-every ...) — the LAST value, or #t over an empty range.
  def('vector-any', (pred, ...vs) => {
    _needProc('vector-any', pred, 'a predicate')
    const [items, n] = _cols('vector-any', vs)
    for (let i = 0; i < n; i++) {
      const r = apply(pred, items.map((it) => it[i]), fuel)
      if (r !== false) return r
    }
    return false
  })

  def('vector-every', (pred, ...vs) => {
    _needProc('vector-every', pred, 'a predicate')
    const [items, n] = _cols('vector-every', vs)
    let last = true
    for (let i = 0; i < n; i++) {
      last = apply(pred, items.map((it) => it[i]), fuel)
      if (last === false) return false
    }
    return last
  })

  // (vector-partition pred vec) → TWO values: a new vector with the
  // satisfying elements first (both groups keeping their original order),
  // and the count of satisfying elements — the index where the second
  // group begins.
  def('vector-partition', (pred, v) => {
    _needProc('vector-partition', pred, 'a predicate')
    const items = _vec('vector-partition', v).items
    const yes = [], no = []
    for (const x of items) {
      (apply(pred, [x], fuel) !== false ? yes : no).push(x)
    }
    return new Values([mkVec([...yes, ...no]), yes.length])
  })

  // ── Mutators ───────────────────────────────────────────────────────

  def('vector-swap!', (v, i, j) => {
    const items = _vec('vector-swap!', v).items
    const a = _idx('vector-swap!', i, 'the first index', items.length - 1)
    const b = _idx('vector-swap!', j, 'the second index', items.length - 1)
    const t = items[a]; items[a] = items[b]; items[b] = t
    return undefined
  }, 'state-change')

  // (vector-map! f vec1 vec2 ...) — like vector-map, but the result is
  // written back into vec1. Stops at the shortest vector, so the tail of a
  // longer vec1 keeps its original elements rather than being cleared.
  def('vector-map!', (f, ...vs) => {
    _needProc('vector-map!', f)
    const [items, n] = _cols('vector-map!', vs)
    if (n === 0 || n === Infinity) return undefined
    for (let i = 0; i < n; i++) {
      items[0][i] = apply(f, items.map((it) => it[i]), fuel)
    }
    return undefined
  }, 'state-change')

  def('vector-reverse!', (v, start, end) => {
    const items = _vec('vector-reverse!', v).items
    const [a, b] = _range('vector-reverse!', start, end, items.length)
    for (let i = a, j = b - 1; i < j; i++, j--) {
      const t = items[i]; items[i] = items[j]; items[j] = t
    }
    return undefined
  }, 'state-change')

  // (vector-reverse-copy! to at from [start [end]]). The source slice is
  // taken BEFORE anything is written, so `to` and `from` may be the same
  // vector with overlapping ranges without smearing — the same "as if
  // copied to a temporary" rule R7RS gives `vector-copy!`.
  def('vector-reverse-copy!', (to, at, from, start, end) => {
    const ti = _vec('vector-reverse-copy!', to).items
    const fi = _vec('vector-reverse-copy!', from).items
    const a = _idx('vector-reverse-copy!', at, 'at', ti.length)
    const [s, e] = _range('vector-reverse-copy!', start, end, fi.length)
    if (ti.length - a < e - s) {
      throw new Error(
        `vector-reverse-copy!: source range does not fit in the destination ` +
        `(${e - s} elements into ${ti.length - a} slots).`)
    }
    const tmp = fi.slice(s, e).reverse()
    for (let i = 0; i < tmp.length; i++) ti[a + i] = tmp[i]
    return undefined
  }, 'state-change')

  // ── Conversion ─────────────────────────────────────────────────────

  // These two cross the vector/list boundary. They are `seqVerb`-wrapped, so
  // a list arrives as a JavaScript array and a returned array leaves as a
  // real cons chain — the conversion happens at the boundary, not here.
  def('reverse-vector->list', (v, start, end) => {
    const items = _vec('reverse-vector->list', v).items
    const [a, b] = _range('reverse-vector->list', start, end, items.length)
    return items.slice(a, b).reverse()
  })

  def('reverse-list->vector', (lst) => {
    if (!Array.isArray(lst)) {
      throw new Error(
        `reverse-list->vector: expected a list, got ${_describe(lst)}.`)
    }
    return mkVec(lst.slice().reverse())
  })

  registerPartMeta(META, { source: 'lib/std/srfi-133.js' })
  return env
}

export const META = [
  ['vector-unfold', -1, '(vector-unfold f length seed ...) — build a vector left to right; f answers the element and the next seeds. SRFI-133.', '(vector-unfold (lambda (i) (* i i)) 4) => #(0 1 4 9)', 'vector'],
  ['vector-unfold-right', -1, '(vector-unfold-right f length seed ...) — build a vector right to left. SRFI-133.', '(vector-unfold-right (lambda (i) i) 4) => #(0 1 2 3)', 'vector'],
  ['vector-unfold!', -1, '(vector-unfold! f vec start end seed ...) — fill a range in place, left to right. SRFI-133.', '(vector-unfold! (lambda (i) i) (make-vector 3 0) 0 3)', 'vector'],
  ['vector-unfold-right!', -1, '(vector-unfold-right! f vec start end seed ...) — fill a range in place, right to left. SRFI-133.', '(vector-unfold-right! (lambda (i) i) (make-vector 3 0) 0 3)', 'vector'],
  ['vector-reverse-copy', -1, '(vector-reverse-copy vec [start [end]]) — a fresh vector holding the range backwards. SRFI-133.', "(vector-reverse-copy '#(1 2 3)) => #(3 2 1)", 'vector'],
  ['vector-concatenate', 1, '(vector-concatenate list-of-vectors) — append the vectors in a LIST. SRFI-133.', "(vector-concatenate (list '#(1) '#(2 3))) => #(1 2 3)", 'vector'],
  ['vector-append-subvectors', -1, '(vector-append-subvectors [vec start end] ...) — append slices, three arguments per group. SRFI-133.', "(vector-append-subvectors '#(1 2 3) 0 2 '#(4 5) 1 2) => #(1 2 5)", 'vector'],
  ['vector-empty?', 1, '(vector-empty? vec) — #t when the vector has no elements. SRFI-133.', "(vector-empty? '#()) => #t", 'vector'],
  ['vector=', -1, '(vector= elt=? vec ...) — compare vectors elementwise; #t for fewer than two vectors. SRFI-133.', "(vector= eqv? '#(1 2) '#(1 2)) => #t", 'vector'],
  ['vector-fold', -1, '(vector-fold kons knil vec ...) — fold left; kons takes the STATE FIRST, unlike SRFI-1 fold. SRFI-133.', "(vector-fold (lambda (s x) (+ s x)) 0 '#(1 2 3)) => 6", 'vector'],
  ['vector-fold-right', -1, '(vector-fold-right kons knil vec ...) — fold right; state first. SRFI-133.', "(vector-fold-right (lambda (s x) (cons x s)) '() '#(1 2 3)) => (1 2 3)", 'vector'],
  ['vector-count', -1, '(vector-count pred vec ...) — how many positions satisfy the predicate. SRFI-133.', "(vector-count even? '#(1 2 3 4)) => 2", 'vector'],
  ['vector-cumulate', 3, '(vector-cumulate f knil vec) — the running states of a fold, as a vector. SRFI-133.', "(vector-cumulate + 0 '#(1 2 3)) => #(1 3 6)", 'vector'],
  ['vector-index', -1, '(vector-index pred vec ...) — index of the first satisfying position, else #f. SRFI-133.', "(vector-index even? '#(1 3 4)) => 2", 'vector'],
  ['vector-index-right', -1, '(vector-index-right pred vec ...) — index of the LAST satisfying position, else #f. SRFI-133.', "(vector-index-right even? '#(2 3 4)) => 2", 'vector'],
  ['vector-skip', -1, '(vector-skip pred vec ...) — index of the first position that does NOT satisfy the predicate. SRFI-133.', "(vector-skip even? '#(2 4 5)) => 2", 'vector'],
  ['vector-skip-right', -1, '(vector-skip-right pred vec ...) — index of the last position that does NOT satisfy the predicate. SRFI-133.', "(vector-skip-right even? '#(1 2 4)) => 0", 'vector'],
  ['vector-binary-search', 3, '(vector-binary-search vec value cmp) — index of value in a sorted vector, else #f; cmp answers negative/zero/positive. SRFI-133.', "(vector-binary-search '#(1 3 5) 3 -) => 1", 'vector'],
  ['vector-any', -1, '(vector-any pred vec ...) — the first true value the predicate produced, else #f. SRFI-133.', "(vector-any even? '#(1 2 3)) => #t", 'vector'],
  ['vector-every', -1, '(vector-every pred vec ...) — the last value if every position satisfies the predicate, else #f. SRFI-133.', "(vector-every even? '#(2 4)) => #t", 'vector'],
  ['vector-partition', 2, '(vector-partition pred vec) — two values: the regrouped vector and the count that satisfied. SRFI-133.', "(vector-partition even? '#(1 2 3 4))", 'vector'],
  ['vector-swap!', 3, '(vector-swap! vec i j) — exchange two elements in place. SRFI-133.', '(vector-swap! (vector 1 2) 0 1)', 'vector'],
  ['vector-map!', -1, '(vector-map! f vec1 vec2 ...) — like vector-map, but writes the results back into vec1. SRFI-133.', "(vector-map! (lambda (x) (* x 2)) (vector 1 2 3))", 'vector'],
  ['vector-reverse!', -1, '(vector-reverse! vec [start [end]]) — reverse a range in place. SRFI-133.', '(vector-reverse! (vector 1 2 3))', 'vector'],
  ['vector-reverse-copy!', -1, '(vector-reverse-copy! to at from [start [end]]) — copy a range backwards into another vector. SRFI-133.', '(vector-reverse-copy! (make-vector 3 0) 0 (vector 1 2 3))', 'vector'],
  ['reverse-vector->list', -1, '(reverse-vector->list vec [start [end]]) — the range as a list, backwards. SRFI-133.', "(reverse-vector->list '#(1 2 3)) => (3 2 1)", 'vector'],
  ['reverse-list->vector', 1, '(reverse-list->vector list) — the list as a vector, backwards. SRFI-133.', "(reverse-list->vector '(1 2 3)) => #(3 2 1)", 'vector'],
]

export default installSRFI133
