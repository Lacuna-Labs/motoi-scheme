// r7rs-types.js — shared R7RS-small value classes.
//
// Provenance: scheme-lang/src/r7rs-types.js. Migrated to
// motoi-scheme/lib/base/ on 2026-07-16 (Pass-3 Wave 1). No content
// changes — file is dialect-neutral.
//
// These are the tagged JS wrappers used by both interp.js (for special-
// form dispatch: (values ...), (delay ...), (parameterize ...), record
// operations) and r7rs-small.js (for the procedural surface). Kept in
// their own module so neither of those files imports the other via
// this path (both import from here).

// R7RS §6.6 character type. A distinct value class (NOT a 1-char string) so
// `char?` is decidable and `char->integer` can reject strings. Interned via
// `ch()` so equal literals are `eq?` across the whole runtime — including the
// ones produced by the reader (`#\A`) and by procedures (`integer->char`).
// Ported here 2026-07-24 from r7rs-small.js's module-local copy so reader.js
// and r7rs-small.js share ONE interned registry (per the Wave-1 migration note).
export class Ch {
  constructor(value) { this.value = value }
  toString() { return '#\\' + this.value }
}
const _CHS = new Map()
export function ch(value) {
  const v = String(value)
  let c = _CHS.get(v)
  if (!c) { c = new Ch(v); _CHS.set(v, c) }
  return c
}

// R7RS §6.8 vector — a DISTINCT type from lists. Wraps a JS array so
// `vector?` is decidable and vectors never satisfy `pair?`/`list?`. The
// reader produces these for `#(...)` literals; every vector procedure
// constructs and consumes SchemeVector. `.items` is the backing array.
// (Named SchemeVector, not Vec, to avoid colliding with the graphics
// 2D/3D vector in lib/graphics/vec.js.)
export class SchemeVector {
  constructor(items) { this.items = items }
}
export function isVec (v) { return v instanceof SchemeVector }
export function mkVec (items) { return new SchemeVector(items) }

// R7RS §6.10 multiple-value wrapper. `values` builds one; call-with-values
// splices Values.vals into the consumer's args.
export class Values {
  constructor(vals) { this.vals = vals }
}

// R7RS §4.2.5 promise. `delay` wraps a thunk; `force` walks the chain.
// The `__promise__` flag makes SchemePromise instances observationally
// interchangeable with the plain-object promise shape produced by the
// `delay` special form in src/interp.js — so `promise?` (defined in
// r7rs-completions.js via `__promise__ === true`) recognizes both.
export class SchemePromise {
  constructor(thunk) {
    this.__promise__ = true
    this.forced = false
    this.value = undefined
    this.thunk = thunk
  }
}

// R7RS §4.2.6 dynamically-scoped parameter object.
export class Parameter {
  constructor(init, converter) {
    this.stack = [converter ? converter(init) : init]
    this.converter = converter || ((x) => x)
  }
  get value() { return this.stack[this.stack.length - 1] }
  push(v) { this.stack.push(this.converter(v)) }
  pop()   { this.stack.pop() }
}

// R7RS §6.13 eof-object.
// Two EOF sentinels exist in the tree — this one and `lib/std/_shared.js`'s,
// which spells the tag `__eof__`. They are distinct objects, so each carries
// BOTH spellings; otherwise a value produced by one module fails the other's
// `eof-object?` and renders as `[object Object]`.
export const EOF = Object.freeze({ __eof: true, __eof__: true })

// R7RS §5.5 records.
export class RecordType {
  constructor(name, fields) {
    this.name = name
    this.fields = fields   // array of field names (strings)
  }
}
export class RecordInstance {
  constructor(type, values) {
    this._recordType = type
    this._recordValues = values
  }
}

// R7RS §6.13 port abstraction.
export class Port {
  constructor(kind, mode, backing) {
    this.kind = kind          // 'textual' | 'binary'
    this.mode = mode          // 'input' | 'output'
    this.backing = backing
    this.pos = 0
    this.open = true
    this.buffer = []
  }
}

// R7RS §6.11 first-class error object. Extends Error so JS throw/catch
// carries it through the interp with `err instanceof Error`.
export class ErrorObject extends Error {
  constructor(message, irritants = [], type = 'error') {
    const rendered = String(message) + (irritants.length ? ' ' + irritants.map(String).join(' ') : '')
    super(rendered)
    this.name = 'ErrorObject'
    this._errorMessage = message
    this._errorIrritants = irritants
    this._errorType = type
    this._isErrorObject = true
  }
}

// Non-Error raised values (`raise` of a non-Error datum). Wrapped so
// they survive the JS throw seam and can be unwrapped by
// with-exception-handler / guard.
export class RaisedValue extends Error {
  constructor(v) { super('raised'); this.value = v; this.name = 'RaisedValue' }
}
