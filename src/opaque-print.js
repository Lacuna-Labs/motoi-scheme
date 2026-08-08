// src/opaque-print.js — ONE external representation for every host-backed
// opaque value, shared by all four printers.
//
// Why this file exists
// -------------------
// R7RS §6.13.3 says a value with no standard written representation prints in
// an implementation-specific way; the convention every Scheme uses is
// `#<something>`. Motoi had no such convention for its host-backed values, so
// they fell through to JavaScript's `String(v)` and printed `[object Object]`
// — the SAME six characters for a hash table, a random source, a SLAT record
// and an audio record, at the top level where a learner reads the answer. That
// string is a JavaScript artifact. It is not a Scheme value, it names nothing,
// and it cannot be read back.
//
// The renderers had drifted too: `(display (make-hash-table))` said `#<record>`
// while the CLI's auto-print of the same value said `[object Object]`. Two
// answers, one engine, neither of them right.
//
// Why one file instead of a branch in each printer
// -----------------------------------------------
// The entity case was fixed first by duck-typing the same test into all four
// renderers and keeping them in sync by comment ("spelled identically in ...").
// Four copies of a rule is four chances to drift, and drift is exactly the bug
// this file closes. One function, imported by all four, makes "every renderer
// agrees" structural instead of aspirational.
//
// This module imports NOTHING. src/cli.js, src/base.js, lib/base/r7rs-small.js
// and lib/std/_shared.js all import it, and two of those (r7rs-small,
// _shared) are on the import path of the reader/interp, so any dependency here
// would risk a cycle. Every test below is duck-typed for that reason.
//
// What it does NOT cover: values that already have a representation (numbers,
// strings, pairs, vectors, chars, ports, promises, eof, procedures, multiple
// values). Those stay in the individual printers, which legitimately differ —
// `display` in src/base.js prints a procedure as `<fn>`, the others as
// `#<procedure>`. This file is only for the opaque host objects that had no
// answer at all.
//
// No fabricated names. Each name below is either the constructor's own name
// (`make-hash-table` → hash-table, `make-random-source` → random-source) or a
// field the object itself carries (an entity's kind, a SLAT record's `_form`,
// an audio record's `kind`).

// The audio verbs (lib/audio/sound.js) all return a scheduling record shaped
// { ok, kind, ... }. Listing the kinds keeps the test tight: a bare
// { ok: #t, kind: "..." } from somewhere else is not claimed as audio.
const AUDIO_KINDS = new Set(['tone', 'note', 'sfx', 'music', 'silence'])

/**
 * opaqueRepr(v) — the `#<...>` external representation for a host-backed
 * value, or `null` when `v` is not one of them (so the caller falls through
 * to its own handling).
 *
 * Returning null rather than throwing lets each printer keep its own
 * ordering; every caller uses the same shape:
 *
 *     const op = opaqueRepr(v); if (op) return op
 *
 * placed immediately before its `String(v)` / `#<record>` fallback.
 */
export function opaqueRepr (v) {
  if (v === null || typeof v !== 'object') return null

  // Hash tables — lib/std/_shared.js `HashTable`, built by SRFI-125's
  // `make-hash-table`. Duck-typed on the backing JS Map rather than
  // `instanceof`, because importing the class from lib/std/_shared.js would
  // make that module import itself through this one.
  //
  // The size is included because it is O(1) on a Map and it is the one fact
  // about a table worth seeing at a glance — `#<hash-table 0>` immediately
  // distinguishes an empty table from a full one, which is the actual
  // question a learner has when they print a table by mistake.
  if (v.map instanceof Map && typeof v.set === 'function' &&
      typeof v.entries === 'function') {
    return `#<hash-table ${v.map.size}>`
  }

  // Random sources — lib/std/srfi-27.js. The object carries its own tag.
  if (v.__random_source__ === true) return '#<random-source>'

  // Entities — lib/game/world.js. Kept here (it used to be duck-typed into
  // each of the four printers separately) so all of them go through one rule.
  if (typeof v._id === 'number' && typeof v.kind === 'string' && 'alive' in v) {
    return `#<entity ${v._id} ${v.kind}>`
  }

  // Audio scheduling records — lib/audio/sound.js, returned by tone / note /
  // sfx / music / silence. `kind` is the record's own field and names the
  // verb that made it, so `#<audio-record music>` invents nothing.
  if (typeof v.ok === 'boolean' && typeof v.kind === 'string' &&
      AUDIO_KINDS.has(v.kind)) {
    return `#<audio-record ${v.kind}>`
  }

  // Verb-metadata examples — src/verbRegistry.js, reached through
  // `(assoc :examples (help 'car))`. Each entry is a { level, code } pair, and
  // a list of them printed as `([object Object])`, which is a bad first thing
  // for a learner to meet in the verb that is supposed to explain the
  // language to them. `level` is the object's own field.
  if (typeof v.level === 'string' && typeof v.code === 'string') {
    return `#<example ${v.level}>`
  }

  // Images — lib/graphics/image-algebra.js. The whole point of the algebra is
  // that overlay / above / beside return another image, so a half-built
  // picture is a value a learner holds and inspects. `w` and `h` are its own
  // fields and they are the two facts that tell you whether the composition
  // came out the size you meant.
  if (v.__image === true) return `#<image ${v.w}x${v.h}>`

  // Signed distance fields — lib/graphics/sdf.js. A closure over a distance
  // function; it has no size, no bounds and no name to report.
  if (v.__sdf === true) return '#<sdf>'

  // Motion-tape frames — lib/game/world.js, handed back by world/tape-replay
  // as a LIST of them, which printed as `(#<record> #<record>)`. `n` is the
  // frame number the recorder stamped, so `#<tape-frame 7>` is the one fact
  // that distinguishes two frames in that list.
  if (typeof v.n === 'number' && Array.isArray(v.ents) && 'hash' in v) {
    return `#<tape-frame ${v.n}>`
  }

  // Tween records — lib/graphics/animation.js, returned by motion/move-to and
  // its siblings so a caller can chain motion/on-settle onto one. The source
  // calls them "tween record"; `target` is the field that says which thing is
  // being animated, and it is the only way to tell two tweens apart.
  if (typeof v.durationFrames === 'number' && 'toX' in v && 'ease' in v) {
    return typeof v.target === 'string' ? `#<tween ${v.target}>` : '#<tween>'
  }

  // Error records from the sprite verbs — lib/graphics/sprite.js, shaped
  // { kind: 'error', reason, ... }. `reason` is the object's own field and it
  // is the thing the caller needs; printing it beats printing nothing.
  if (v.kind === 'error' && typeof v.reason === 'string') {
    return `#<error ${v.reason}>`
  }

  // R7RS §5.5 records — lib/std/_shared.js `makeRecord`. These printed as a
  // bare `#<record>` through write and `[object Object]` at the top level,
  // which means every record type in a program looked identical. The type
  // object carries the name the program itself gave in define-record-type, so
  // `(display (make-point 1 2))` can say `#<record point>` without inventing
  // anything. Fields are deliberately NOT shown: R7RS gives no reader syntax
  // for records, and printing fields invites code that parses the text back.
  const rt = v.__record_type__
  if (rt && typeof rt === 'object' && typeof rt.name === 'string') {
    return `#<record ${rt.name}>`
  }

  // SLAT records — src/slat-verbs.js. `_form` is the record's leading symbol,
  // which is what the format calls the record's type, so an error record
  // reads `#<slat-record error>` and is distinguishable at a glance from a
  // good one. That distinction is the documented trap: a SLAT error record is
  // truthy, so an unchecked `(if (slat-loads bad) ...)` takes the success
  // branch, and until now printing it gave you nothing to go on.
  if (typeof v._form === 'string') return `#<slat-record ${v._form}>`

  // Scheme procedures — src/interp.js `Closure`. A lambda is a Closure OBJECT,
  // not a JS function, so it falls past every `typeof v === 'function'` test.
  // All four printers already answer `#<procedure>` for one before they reach
  // this file, so this branch changes nothing there; it exists for the callers
  // that have no printer of their own — chiefly the irritant list of an error
  // object, where `(display 'x (lambda (c) c))` used to report the offending
  // value as `[object Object]`. `#<procedure>` is the answer the rest of the
  // engine already gives, so the two agree instead of one saying `#<Closure>`.
  if (Array.isArray(v.params) && 'body' in v && 'env' in v) return '#<procedure>'

  // ── the backstop ────────────────────────────────────────────────────
  // Every branch above names a type we know. This one catches the ones we do
  // not, and it is what makes the guarantee total: no host object can reach
  // output as `[object Object]` just because nobody has met it yet.
  //
  // The test is exact rather than heuristic. `[object Object]` — and its
  // siblings `[object Map]`, `[object Set]`, `[object WeakMap]` — are
  // precisely what String(v) yields when v inherits Object.prototype.toString
  // and nothing else. If String(v) gives anything OUTSIDE that shape, that
  // something else is a real string form the type chose for itself, and we
  // return null to let the caller use it. We only intercept the cases that
  // were already broken.
  //
  // No invented names: the label is the CONSTRUCTOR's name, which is what the
  // author of the class called it. A bare `{...}` literal has constructor
  // `Object` and no name to borrow, so it gets `#<object>` — honest about
  // being an unnamed host value rather than pretending to a type.
  let asString
  try {
    asString = String(v)
  } catch {
    // Object.create(null) has no toString at all.
    return '#<object>'
  }
  const dflt = /^\[object [A-Za-z]+\]$/.exec(asString)
  if (!dflt) return null
  const cname = v.constructor && typeof v.constructor.name === 'string'
    ? v.constructor.name
    : ''
  return cname && cname !== 'Object' ? `#<${cname}>` : '#<object>'
}

export default opaqueRepr
