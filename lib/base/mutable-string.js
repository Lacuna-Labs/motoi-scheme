// mutable-string.js — mutable strings for the Motoi runtime.
//
// R7RS §6.7 has TWO kinds of string. A string LITERAL is immutable: the
// standard says it is an error to pass one to `string-set!`. Everything a
// constructor hands back — `(make-string 5 #\x)`, `(string #\a #\b)`,
// `(string-copy s)` — is "newly allocated" and therefore mutable. Motoi had
// only the first kind: a Scheme string was a JS primitive string, so
// `string-set!`, `string-fill!` and `string-copy!` could not exist at all.
// That is ~32 assertions in the chibi conformance suite and ~41 in Larceny's,
// and it is the reason `(eq? s (string-copy s))` answered #t when the standard
// requires #f — a copy that is not a copy.
//
// The representation:
//
//   immutable string   JS primitive string   — literals, symbol->string, …
//   mutable string     MStr (below)          — make-string, string, string-copy
//
// Two carriers is deliberate, not sloppiness, and it is the same shape
// lib/math/tower.js uses for exactness (`Flo extends Number`). A literal is
// ALREADY unambiguously immutable — nothing can write to a JS primitive — so
// it needs no wrapper, which keeps the overwhelmingly common path
// allocation-free. `MStr` is only required where a value must be able to
// CHANGE while callers keep pointing at it.
//
// ── Why `extends String` is the load-bearing detail ────────────────────
//
// Every method on String.prototype is specified to begin with ToString(this)
// (ECMA-262 §22.1.3), and for an object that runs the overridden toString().
// So a call site that has never heard of MStr still computes the RIGHT TEXT:
// `s.slice(1)`, `s.charAt(0)`, `s.indexOf('x')`, `s.toUpperCase()`, `'a' + s`,
// `` `${s}` ``, `String(s)` and `JSON.stringify(s)` all read the LIVE, current
// value. Missing a site degrades to the old answer; it does not corrupt one.
// That is the same trade `Flo` makes, and it is what makes a change this wide
// tractable at all.
//
// ── The four things `extends String` does NOT give you ─────────────────
//
// These are not oversights; every one of them is converted at the call sites
// this module serves, and they are listed here so the next person does not
// have to rediscover them:
//
//   1. `typeof v === 'string'` is FALSE for an MStr — it is an object. Use
//      `isStr(v)`. This is why every string type-guard in src/base.js,
//      lib/base/r7rs-small.js and lib/std/* routes through `isStr`.
//   2. `v === "literal"` is FALSE even when the text matches, because it
//      compares object identity. Compare `str(v) === "literal"`.
//   3. `v[i]` reads a STALE own property frozen at construction. `.charAt(i)`
//      and `.charCodeAt(i)` go through ToString and are live. Bracket
//      indexing on a Scheme string is always a bug here.
//   4. Map/Set keys and `===` see an object, so a hash table keyed by string
//      must key on `str(v)`, and `equal?` must compare by VALUE while
//      `eqv?`/`eq?` keep comparing by IDENTITY. That split is exactly what
//      R7RS §6.1 asks for: `(eqv? (string #\a) (string #\a))` is #f.
//
// ── The one known degradation: `.length` after an astral write ─────────
//
// `.length` is an own, non-writable, NON-CONFIGURABLE property of the String
// exotic object, fixed when super() runs. It cannot be redefined — a getter on
// the subclass prototype is shadowed by it. Normally that is harmless and in
// fact the whole reason this design is safe: every R7RS string mutator
// PRESERVES LENGTH, so a frozen length stays correct forever.
//
// The exception is astral characters. Motoi indexes strings by UTF-16 CODE
// UNIT throughout (`string-length`, `string-ref`, `substring`, `string->list`
// all count code units, not code points — verified 2026-08-03 against chibi,
// which counts code points; that divergence is a separate, pre-existing gap
// and is NOT changed here). Writing a non-BMP character such as #\x1F700 into
// a one-unit slot therefore changes the code-unit length, and `.length` on the
// wrapper goes stale from that moment.
//
// The containment is that nothing in Motoi consults `MStr.length`: every verb
// measures with `str(v).length`, which is always live. A stale `.length` can
// only be read by JS that has not been taught about MStr at all, and only
// after a program has written an astral character into a mutable string.
// `strLength()` below is the one measurement helper; use it.

// ── The carrier ────────────────────────────────────────────────────────
// `s` holds the current text. super(s) seeds the exotic object so that
// `.length` and the prototype methods exist; every read of the CURRENT value
// goes through toString()/valueOf().
export class MStr extends String {
  constructor (s) {
    super(s)
    this.s = String(s)
  }

  toString () { return this.s }
  valueOf () { return this.s }
}

// True for the mutable carrier only.
export const isMStr = (v) => v instanceof MStr

// True for EITHER kind of Scheme string. This is the predicate that replaces
// `typeof v === 'string'` everywhere a Scheme value is being type-checked.
// (A JS-internal check on a JS-internal string should stay `typeof`; only
// values that can reach a Scheme verb need this.)
export const isStr = (v) => typeof v === 'string' || v instanceof MStr

// The live JS primitive behind a Scheme string. Callers are expected to have
// established `isStr(v)` first — the String() fallback exists so that a missed
// site degrades to the old coercion rather than throwing a JS TypeError, and
// must not be relied on as a type conversion.
export const str = (v) => (typeof v === 'string' ? v : (v instanceof MStr ? v.s : String(v)))

// Length in UTF-16 code units, read LIVE. Always use this rather than
// `v.length`, which is frozen at construction — see the note above.
export const strLength = (v) => str(v).length

// Allocate a fresh MUTABLE string. Every R7RS constructor that the standard
// describes as returning a "newly allocated" string routes through here.
export const mstr = (s) => new MStr(s)

// Guard for the three mutators. R7RS §6.7: "It is an error to attempt to store
// a new value into a location that is denoted by an immutable object", and a
// string literal is such an object. Raising here is what makes
// `(string-set! "abc" 0 #\x)` a mistake the learner is told about, instead of
// a write that silently does nothing.
//
// The message names the fix, because the fix is always the same shape: take a
// copy first. `(string-copy "abc")` is mutable; the literal it came from is not.
export function ckMutable (op, v, mkError) {
  if (v instanceof MStr) return v
  const raise = mkError || ((m) => new Error(m))
  if (typeof v === 'string') {
    throw raise(`${op}: cannot modify a string literal — R7RS §6.7 makes literals immutable. ` +
      `Take a mutable copy first: (${op} (string-copy ${JSON.stringify(v.length > 12 ? v.slice(0, 12) + '…' : v)}) …).`)
  }
  throw raise(`${op}: expected a mutable string`)
}

// Write a whole new text into an existing mutable string, preserving identity.
// Every mutator is expressed as one of these, which keeps the "does the length
// change" question in exactly one place.
export function strWrite (m, text) {
  m.s = text
  return undefined
}
