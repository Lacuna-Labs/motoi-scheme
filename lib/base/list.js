// R7RS §6.4 — the one place that knows how Motoi spells a list.
//
// Motoi used to spell a PROPER list as a flat JavaScript array and mint a
// `Pair` object only for an improper one. That made `(cdr x)` ALLOCATE a new
// array instead of handing back an interior pointer, and three things followed:
// `(eq? (cdr x) (cdr x))` was `#f`, `set-cdr!` on a proper list had nowhere to
// write, and a circular list — hence a datum label — could not be built at all.
// Thirty of the sixty-five remaining R7RS conformance failures were that single
// choice.
//
// A list is now a chain of real cells ending in `NIL`. This module is the only
// file allowed to know that; every other file asks it questions (`isPair`,
// `isNull`, `listLength`) instead of asking JavaScript (`Array.isArray`,
// `.length`), which is what made the change possible at all.
//
// WHERE THE ARRAYS SURVIVE, ON PURPOSE
//   The EVALUATOR's spine — the AST the reader hands `interp` and `macro` — is
//   still JavaScript arrays. That is sound here only because Motoi has no
//   `eval` (decision-005): program text and program data never have to be the
//   same objects. Quoted data crosses into the cell world at `quote` and
//   `quasiquote`, and nowhere else. Keeping the spine as arrays is what kept
//   this change from touching the evaluator and the macro expander at all.

import { Values } from './r7rs-types.js'

// The empty list. One object for the whole process, so `(eq? '() '())` is `#t`
// — the identity a learner leans on hardest when writing a recursive list walk.
export const NIL = Object.freeze({ __nil__: true })

// A cell. Every list is built from these now, proper or not.
export class Pair {
  constructor(car, cdr) { this.car = car; this.cdr = cdr }
}

export function nil() { return NIL }

// `(cons a b)` — no case analysis left. b is the tail, whatever it is.
export function cons(a, b) { return new Pair(a, b) }

// The three predicates below answer for BOTH spellings of a list — a cell chain
// and a JavaScript array — and that is deliberate, not a leftover.
//
// The core sees cells; the sequence verbs behind `seqVerb` see arrays. Both
// sides ask these same three questions, and a guard has to be right on either
// side of the boundary. Making them cells-only would mean every one of the
// several hundred guards had to know which side it was on, which is precisely
// the knowledge this module exists to remove.

// R7RS `pair?`.
export function isPair(v) { return v instanceof Pair || (Array.isArray(v) && v.length > 0) }

// R7RS `null?` — the empty list, and nothing else. `isNull` and `isPair` are
// NOT complements: a symbol is neither.
export function isNull(v) { return v === NIL || (Array.isArray(v) && v.length === 0) }

// Either end of a chain, in O(1). This is the guard a verb wants when it is
// about to TRAVERSE — the traversal itself will reject an improper tail, and
// unlike `isList` it does not walk the list first.
export function isListish(v) { return v === NIL || v instanceof Pair || Array.isArray(v) }

// R7RS `list?` — a PROPER list: empty, or a chain ending in `NIL`. O(n), and it
// must terminate on a circular list, so it walks with two speeds (Floyd). An
// improper chain is deliberately excluded; that is `pair?`, not `list?`.
export function isList(v) {
  if (Array.isArray(v)) return true
  let slow = v
  let fast = v
  for (;;) {
    if (fast === NIL) return true
    if (!(fast instanceof Pair)) return false
    fast = fast.cdr
    if (fast === NIL) return true
    if (!(fast instanceof Pair)) return false
    fast = fast.cdr
    slow = slow.cdr
    if (fast === slow) return false        // circular: never reaches NIL
  }
}

// Elements in a PROPER list. Throws on an improper or circular one, because
// silently answering a number for `(length '(1 2 . 3))` is how a wrong value
// travels several steps before surfacing somewhere unrelated.
export function listLength(l) {
  let n = 0
  let slow = l
  let x = l
  while (x instanceof Pair) {
    n++
    x = x.cdr
    if (!(x instanceof Pair)) break
    n++
    x = x.cdr
    slow = slow.cdr
    if (x === slow) throw new Error('length: circular list')
  }
  if (x !== NIL) throw new Error('length: improper list')
  return n
}

// A JavaScript array of the elements, for code that genuinely wants random
// access or JS iteration. O(n) — it was O(n) before too, when every `cdr`
// sliced — but it is no longer free, so prefer the O(1) predicates in guards.
export function listToArray(l) {
  const out = []
  let x = l
  while (x instanceof Pair) { out.push(x.car); x = x.cdr }
  if (x !== NIL) throw new Error('expected a proper list')
  return out
}

// The converter that matches `isList`, and the reason it exists is a real bug
// class rather than convenience. `isList` deliberately answers #t for BOTH
// spellings of a list — a cell chain and a JS array — but `listToArray` only
// accepts the chain. So `isList(v) ? v.map(f) : []` reads as careful code and
// is not: it passes the guard for a cell chain and then calls `.map` on a
// `Pair`, which surfaces to the author as a raw JavaScript TypeError
// ("objective.map is not a function") from inside a verb they did nothing
// wrong to call. Guard and converter must accept the same inputs, so anything
// `isList` admits, this converts.
export function listItems(l) {
  if (Array.isArray(l)) return l
  return listToArray(l)
}

// Same, but stops at an improper tail instead of throwing. Returns
// `[elements, tail]` so a caller that must handle both can do so in one walk.
export function listParts(l) {
  const out = []
  let x = l
  while (x instanceof Pair) { out.push(x.car); x = x.cdr }
  return [out, x]
}

// The inverse. Every place that builds a list out of a JS array — `map`'s
// result, a literal, a splice — routes through here.
export function arrayToList(a, tail = NIL) {
  let acc = tail
  for (let i = a.length - 1; i >= 0; i--) acc = new Pair(a[i], acc)
  return acc
}

// ── the sequence boundary ───────────────────────────────────────────────
// Motoi's CORE — car, cdr, cons, the mutators, the SRFI-1 list surgery, the
// printer, the equality predicates — works on cells directly, because those are
// the verbs whose whole meaning is the cell: identity, sharing, mutation.
//
// The rest of the library (the math, the graphics, the game, the composer)
// takes a list as a SEQUENCE. `plot/histogram` wants the numbers; it has no
// opinion about whether the tail is shared. Those verbs are wrapped at their
// installer so they keep receiving JavaScript arrays. That is not a shim for
// unconverted code — it is the honest interface: they were never about cells,
// and rewriting four hundred of them to walk chains would have added risk
// without adding a single conformance point.
//
// The wrapper is NOT applied to a verb that must preserve identity or mutate in
// place. Those verbs are installed raw and hand-written against the cells.

// Conversions are memoized so a list crossing the boundary twice costs one
// walk. A mutation invalidates every cache at once by swapping the maps —
// cheaper and far safer than trying to invalidate one entry, since a cell can
// be interior to any number of cached lists.
let _toJS = new WeakMap()
let _toScheme = new WeakMap()
export function bumpListEpoch() { _toJS = new WeakMap(); _toScheme = new WeakMap() }

// A circular list is now constructible, so every walk needs a stop. This cap is
// far above any real list and exists to turn a hang into a message.
const WALK_CAP = 1e7

// A cycle in the SPINE and a cycle in an ELEMENT are different situations, and
// they used to be conflated because the element walk was a plain recursive call
// whose overrun surfaced as the OUTER list's error:
//
//   (length x)   where x is circular  — a real mistake. x has no length.
//   (list x 'a)  where x is circular  — perfectly legal. The list being built
//                                       is proper; x is just a value riding in
//                                       it, and R7RS's own `equal?` examples
//                                       do exactly this.
//
// The second raised "circular list passed to a verb that expects a proper list"
// about a list that was proper. A circular list has no array spelling, the same
// way an improper tail has none, so a circular ELEMENT is handed through AS
// CELLS — the rule already applied to a dotted tail below. The spine keeps
// raising, because there the complaint is true.
//
// Floyd's tortoise and hare settles the question in one pass, instead of
// turning a hang into a message after ten million steps.
function _isCircular(v) {
  let slow = v
  let fast = v
  while (fast instanceof Pair && fast.cdr instanceof Pair) {
    slow = slow.cdr
    fast = fast.cdr.cdr
    if (slow === fast) return true
  }
  return false
}

export function toJS(v) {
  if (v === NIL) return []
  if (!(v instanceof Pair)) return v
  const hit = _toJS.get(v)
  if (hit) return hit
  if (_isCircular(v)) {
    throw new Error('circular list passed to a verb that expects a proper list')
  }
  const out = []
  let x = v
  let n = 0
  while (x instanceof Pair) {
    const el = x.car
    out.push(el instanceof Pair && _isCircular(el) ? el : toJS(el))
    x = x.cdr
    if (++n > WALK_CAP) throw new Error('circular list passed to a verb that expects a proper list')
  }
  // An improper tail has no array spelling. Hand the cells straight through and
  // let the verb's own guard reject it, with its own message.
  if (x !== NIL) return v
  _toJS.set(v, out)
  // Cache the way BACK at the same time. Without this, `(list x)` would answer
  // a list holding a COPY of x — x crossed the boundary to an array and a fresh
  // chain was built on the way out — and `(eq? (car (list x)) x)` would be #f.
  // R7RS is explicit that `list` does not copy its arguments.
  _toScheme.set(out, v)
  return out
}

export function toScheme(v) {
  // A multiple-value return is a BOX around results, not a result. Converting
  // only the box left every array-world verb that answers two lists — partition,
  // span, break, split-at, lset-diff+intersection, unzip2..unzip5 — handing bare
  // JS arrays to the caller, where the very next `length` or `cdr` reported an
  // improper list. Found 2026-08-04 authoring the unzip records.
  if (v instanceof Values) return new Values(v.vals.map(toScheme))
  if (!Array.isArray(v)) return v
  const hit = _toScheme.get(v)
  if (hit) return hit
  const out = arrayToList(v.map(toScheme))
  _toScheme.set(v, out)
  return out
}

// A PROCEDURE crossing into array-world has to be adapted too, not just data.
//
// `fold`, `map`, `append-map`, `sort` and friends are array-world natives that
// CALL BACK into Scheme. The callback is a Scheme procedure: it answers cells.
// Converting only the native's own arguments and result left that inner call
// unconverted, and the two spellings met in the middle:
//
//   (fold cons '() '(1 2 3))  →  (3 2 1 . ())   -- the seed arrived as a JS []
//                                                  and got consed as the tail
//   (fold cons '(9) '(1 2))   →  a cell chain with a JS ARRAY tail, which
//                                `length` calls improper and the printer
//                                overflows the stack on
//   (append-map (λ (x) (list x x)) '(1 2 3))
//                             →  ((1 1) (2 2) (3 3))  -- concat cannot spread
//                                                        a Pair, so no flatten
//
// A hybrid value escaping into user data is the worst outcome available here,
// so the boundary adapts BOTH directions: arguments handed to a callback are
// converted back to cells, and the callback's answer is converted to an array.
// The conversions are memoized (above), so a round trip preserves identity —
// a callback that returns its argument returns the caller's own object.
//
// `interp.js` installs the two hooks at load; they are null only in a unit
// test that imports this module alone, where no callback can occur anyway.
let _applyProc = null
let _isProc = null
export function installProcAdapter(applyFn, isProcFn) {
  _applyProc = applyFn
  _isProc = isProcFn
}

// One wrapper per procedure, so a procedure crossing the boundary twice is the
// same object both times and `eq?` still answers #t.
const _adapted = new WeakMap()

function adaptIn(a) {
  if (_isProc !== null && _isProc(a)) {
    const hit = _adapted.get(a)
    if (hit) return hit
    const w = (...inner) => toJS(_applyProc(a, inner.map(toScheme)))
    // Arity is load-bearing: `apply` checks it before calling, and several
    // verbs branch on `fn.length` to decide how many arguments to pass.
    Object.defineProperty(w, 'length', { value: a.length ?? 0 })
    // Some of Motoi's values ARE procedures with a tag hung off them — an
    // AudioHandle is a closure answering 'id/'name/'halt with `__audioHandle`
    // attached, and `audio/halt` looks for that tag. A bare wrapper is callable
    // but untagged, so the handle arrived looking like an anonymous lambda.
    copyTags(a, w)
    _adapted.set(a, w)
    return w
  }
  return toJS(a)
}

// Wrap a native verb so it sees arrays and answers cells.
export function seqVerb(fn) {
  // `def` binds constants through this same helper — `def('const/pi', Math.PI)`.
  // Wrapping a number produced a PROCEDURE named const/pi, so `(* 2 const/pi)`
  // failed with "expected a number, got a procedure". A non-procedure has no
  // calling convention to adapt; it only needs its spelling fixed.
  if (typeof fn !== 'function') return toScheme(fn)
  const w = (...args) => toScheme(fn(...args.map(adaptIn)))
  Object.defineProperty(w, 'length', { value: fn.length })
  Object.defineProperty(w, 'name', { value: fn.name })
  // Some of Motoi's procedures carry a tag that other code looks for — a
  // parameter object hangs `_parameter` off itself, an audio handle hangs
  // `__audioHandle`. A bare wrapper is callable but untagged, so
  // `parameterize` said "not a parameter" about a real parameter.
  copyTags(fn, w)
  return w
}

// Own properties, minus the three the wrapper defines itself.
function copyTags(from, to) {
  for (const k of Object.getOwnPropertyNames(from)) {
    if (k === 'length' || k === 'name' || k === 'prototype') continue
    Object.defineProperty(to, k, Object.getOwnPropertyDescriptor(from, k))
  }
}

// Render a dotted pair the way Scheme writes it. The cdr chain collapses, so
// `(cons 1 (cons 2 3))` prints `(1 2 . 3)` rather than `(1 . (2 . 3))`. `fmt`
// is the caller's element formatter — Motoi has several (repl, cli, ide-server,
// display) and they all route here so they cannot drift apart.
export function pairToString(p, fmt) {
  const parts = []
  let x = p
  while (x instanceof Pair) { parts.push(fmt(x.car)); x = x.cdr }
  if (x === NIL) return '(' + parts.join(' ') + ')'
  return '(' + parts.join(' ') + ' . ' + fmt(x) + ')'
}
