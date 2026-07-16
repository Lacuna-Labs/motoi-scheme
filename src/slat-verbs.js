// slat-verbs.js — install the SLAT primitives into a Sakura Scheme env.
//
// Wires the minimum-viable set for Book of SLAT (17 chapters + 10 appendices)
// into the runtime. Before this file, the Book taught ~9 verbs (slat-loads,
// slat-load, slat-load-doc, slat-dumps, slat-dump, slat-dump-doc, slat-read,
// slat-write, slat-key) that ZERO of the interpreter's base env exposed.
// Training on that corpus would have taught Sakura to call verbs that don't
// exist at runtime — a launch-blocker flagged in PRE-LAUNCH-POLISH-BURNDOWN
// -2026-07-12 §2 (Zain lane, item #1).
//
// This is the substrate. Every verb here:
//   - accepts Sakura Scheme values (Sym, arrays, plain objects)
//   - bridges to the SLAT binding's SlatValue shape at the boundary
//   - returns Sakura Scheme values on the way back
//   - reports errors as (error :kind ... :message ...) records — never a
//     JS throw that would crash the interpreter
//
// Design notes:
//
// 1. Sym ↔ SlatValue bridge. The interpreter's symbol type is Sym (with a
//    .name field, defined in reader.js). The slat binding's symbol type is
//    SlatValue('symbol', name). Bridging happens ONCE per boundary crossing
//    — see toSlatValues / fromSlatValues below.
//
// 2. Keywords. The reader interns `:foo` as Sym(':foo') (the colon is part
//    of the name). The slat binding emits keywords as SlatValue('keyword',
//    'foo') — no colon. The bridge strips/adds the leading colon so
//    round-tripping works both ways.
//
// 3. Records. The slat binding returns forms with head symbols as JS
//    plain objects: `{ _form: 'event', ts: ..., _positional: [...] }`.
//    Sakura Scheme code (per the Book) reads these directly and calls
//    slat-key to pull fields. We keep them as plain JS objects — the
//    interpreter treats them as opaque values, which is exactly right.
//
// 4. Streams. Sakura Scheme has no stream/port abstraction in the base env.
//    slat-load / slat-dump accept a STRING (multi-line text) rather than a
//    stream handle: slat-load parses many forms, returns a list; slat-dump
//    takes a list of values and returns the serialized text. This matches
//    the Book's semantics without requiring a port shim (the Book's
//    open-input-file example is aspirational; the base env is stringly).
//
// 5. Vote-1 shape. The wrapper below applies the Vote-1 structured-dispatch
//    doctrine from the Wave 0 dispatch-migration authoring guide. When the
//    interpreter calls a primitive with the classic positional shape
//    (fn(a, b, c)), the wrapper passes through unchanged. When it calls
//    with the structured shape (fn([Sym, ...args])), the wrapper unwraps
//    and hands the body the positional shape it was authored against. Same
//    contract as curator-web/src/scheme/runtime/wrapStructured.js.
//
// 6. Errors. Every verb wraps its body in a try/catch that converts any
//    thrown Error into (error :kind ... :message ...). Consumers can
//    pattern-match on `_form === 'error'` without a JS try/catch surfacing
//    into their Scheme code.

import { Sym, sym } from './reader.js'
import { slatLoads, slatDumps, SlatValue } from '../bindings/js/slat.js'

// ─────────────────────────────────────────────────────────────────────────
// Vote-1 wrapper — local copy of the wrapStructured pattern, tightened.
//
// The Curator dispatch layer wraps every verb call through the structured
// shape [Sym('verb-name'), ...args]. This wrapper detects that shape and
// unwraps it so verb bodies can stay authored against the positional
// shape. When called with the legacy positional shape, it passes through
// unchanged (hot path for every non-Curator consumer).
//
// Zain-refinement note: unlike Curator's tokens, SLAT verbs LEGITIMATELY
// receive Sym-headed arrays as their sole positional (e.g., `(slat-dumps
// '(hello world))` — the arg IS a Sym-headed list). Curator's wrapper's
// "any Sym-headed sole arg" heuristic collides with that pattern. We
// tighten the guard: the head Sym.name MUST match the registered verb
// name for the structured-shape branch to fire. That eliminates false
// positives for the data-carrying case.
// ─────────────────────────────────────────────────────────────────────────
function wrapStructured(fn, verbName) {
  return function wrapped(...args) {
    if (
      verbName
      && args.length === 1
      && Array.isArray(args[0])
      && args[0].length > 0
      && args[0][0] instanceof Sym
      && args[0][0].name === verbName
    ) {
      // Structured shape — [Sym('verb-name'), positional..., :kw, val, ...]
      const list = args[0]
      const rest = list.slice(1)
      return fn(...rest)
    }
    // Legacy positional shape — pass through unchanged.
    return fn(...args)
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Sym ↔ SlatValue bridge.
//
// Sakura Scheme uses Sym instances for symbols; the reader interns them
// via sym(name). Keywords land as Sym(':name') (colon included).
//
// The slat binding uses SlatValue('symbol', name) for symbols and
// SlatValue('keyword', name) for keywords (colon stripped).
//
// The bridge walks values in both directions at the verb boundary. It is
// idempotent — round-tripping a value through both directions yields an
// equal shape.
// ─────────────────────────────────────────────────────────────────────────

/**
 * fromSlatValues(v) — convert slat-binding values into Sakura Scheme
 * values, in place. Deep-walks arrays and plain objects.
 *
 *   SlatValue('symbol', 'foo')      → Sym('foo')
 *   SlatValue('keyword', 'kw')      → Sym(':kw')
 *   SlatValue('rational', '1/3')    → SlatValue kept as-is (opaque)
 *   SlatValue('char', 'a')          → SlatValue kept as-is (opaque)
 *   plain object with _form         → object walked, keys preserved
 *   Array                            → array walked
 *   everything else                  → unchanged
 */
function fromSlatValues(v) {
  if (v instanceof SlatValue) {
    if (v.kind === 'symbol') return sym(v.value)
    if (v.kind === 'keyword') return sym(':' + v.value)
    // Other kinds (rational, char, etc.) stay as SlatValue — they're
    // opaque to the interpreter and their Sakura Scheme representation
    // is not defined in the minimum-viable set.
    return v
  }
  if (Array.isArray(v)) return v.map(fromSlatValues)
  if (v && typeof v === 'object') {
    // Plain object — walk keys, preserve _form / _positional shape.
    const out = {}
    for (const [k, val] of Object.entries(v)) {
      out[k] = fromSlatValues(val)
    }
    return out
  }
  return v
}

/**
 * toSlatValues(v) — convert Sakura Scheme values into slat-binding values,
 * in place. Inverse of fromSlatValues.
 *
 *   Sym('foo')                       → SlatValue('symbol', 'foo')
 *   Sym(':kw')                       → SlatValue('keyword', 'kw')
 *   Array                            → array walked
 *   plain object with _form          → object walked, keys preserved
 *   everything else                  → unchanged
 */
function toSlatValues(v) {
  if (v instanceof Sym) {
    if (v.name.startsWith(':')) {
      return new SlatValue('keyword', v.name.slice(1))
    }
    return new SlatValue('symbol', v.name)
  }
  if (v instanceof SlatValue) return v   // already in slat shape
  if (Array.isArray(v)) return v.map(toSlatValues)
  if (v && typeof v === 'object') {
    const out = {}
    for (const [k, val] of Object.entries(v)) {
      out[k] = toSlatValues(val)
    }
    return out
  }
  return v
}

// ─────────────────────────────────────────────────────────────────────────
// Error helpers.
//
// Sakura Scheme's honest-null pattern: never throw across the Scheme
// boundary. Return a structured (error :kind ... :message ...) record
// that consumers can pattern-match.
// ─────────────────────────────────────────────────────────────────────────
function slatError(kind, message, extra = {}) {
  return { _form: 'error', kind: sym(kind), message: String(message), ...extra }
}

function tryOr(fn, kind) {
  try {
    return fn()
  } catch (err) {
    return slatError(kind, err && err.message ? err.message : String(err))
  }
}

// ─────────────────────────────────────────────────────────────────────────
// The verbs themselves.
//
// Each returns a Sakura Scheme value (or an error record on failure). The
// binding-level slatLoads / slatDumps do the heavy lifting; the wrappers
// bridge Sym ↔ SlatValue and translate the surface into what the Book
// taught.
// ─────────────────────────────────────────────────────────────────────────

/**
 * (slat-loads text) → value
 *
 * Parse one form from a single-line string. If `text` contains multiple
 * lines each with one form, returns a list of values (matches the
 * binding's existing multi-line convenience). Bad input produces an
 * error record.
 */
export const slatLoadsVerb = wrapStructured(function slatLoadsVerbBody(text) {
  return tryOr(() => {
    if (typeof text !== 'string') {
      return slatError('slat/bad-arg', 'slat-loads: expected a string')
    }
    const raw = slatLoads(text)
    return fromSlatValues(raw)
  }, 'slat/parse-error')
}, 'slat-loads')

/**
 * (slat-load text) → list-of-values
 *
 * Iterate forms from a line-delimited text stream. Sakura Scheme has no
 * stream/port abstraction in the base env, so we accept a STRING of one
 * form per line. Returns an array of parsed values (empty list if the
 * text is empty). Bad lines produce (_bad-line :input ... :error ...)
 * sentinels rather than aborting the whole stream (tolerant mode).
 */
export const slatLoadVerb = wrapStructured(function slatLoadVerbBody(text) {
  if (typeof text !== 'string') {
    return slatError('slat/bad-arg', 'slat-load: expected a string')
  }
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith(';'))
  const out = []
  for (const line of lines) {
    try {
      const raw = slatLoads(line)
      // Multi-line inside a single line shouldn't happen post-filter,
      // but slatLoads may still yield an array if the line was empty
      // after trimming — normalize.
      out.push(fromSlatValues(raw))
    } catch (err) {
      out.push({
        _form: '_bad-line',
        input: line,
        error: err && err.message ? err.message : String(err),
      })
    }
  }
  return out
}, 'slat-load')

/**
 * (slat-load-doc text) → value
 *
 * Parse one whole-document `.slat` file's single form. The base env's
 * slatLoads binding already handles multi-line input inside a single
 * form (see bindings/js/slat.js tokenizer). Bad input produces an
 * error record.
 *
 * NOTE: the binding's tokenizer currently throws on literal newlines
 * inside a form (per §5.1 of the spec — line-delimited mode). For
 * whole-document parsing we join multi-line input into a single
 * whitespace-normalized line before parsing. This preserves the
 * Book's teaching that "you get one value out" for `.slat` files.
 */
export const slatLoadDocVerb = wrapStructured(function slatLoadDocVerbBody(text) {
  return tryOr(() => {
    if (typeof text !== 'string') {
      return slatError('slat/bad-arg', 'slat-load-doc: expected a string')
    }
    // Whole-document framing permits newlines inside a form; the
    // current binding doesn't, so we squash intra-form whitespace to a
    // single space. Comments (`; ...`) are stripped line-by-line.
    const stripped = text
      .split('\n')
      .map((l) => {
        const semi = l.indexOf(';')
        return (semi >= 0 ? l.slice(0, semi) : l).trim()
      })
      .filter((l) => l)
      .join(' ')
    const raw = slatLoads(stripped)
    // slatLoads returns an array if multiple top-level forms are present;
    // a whole-document parse expects zero or one top-level form (§5.1).
    if (Array.isArray(raw) && raw.length > 1
        && !(raw.length && typeof raw[0] === 'object' && raw[0]._form)) {
      // Ambiguous: got multiple forms. Per §5.1, whole-doc expects one.
      // Return the array wrapped as an error for the caller to inspect.
      return slatError('slat/multi-form',
        'slat-load-doc: whole-document mode expects zero or one top-level form; got '
        + raw.length)
    }
    return fromSlatValues(raw)
  }, 'slat/parse-error')
}, 'slat-load-doc')

/**
 * (slat-dumps value) → string
 *
 * Serialize one value to a canonical string. Bad input (e.g., a JS
 * function value) produces an error record.
 */
export const slatDumpsVerb = wrapStructured(function slatDumpsVerbBody(value) {
  return tryOr(() => {
    const bridged = toSlatValues(value)
    return slatDumps(bridged)
  }, 'slat/emit-error')
}, 'slat-dumps')

/**
 * (slat-dump values) → string
 *
 * Serialize a list of values as line-delimited text (one form per line).
 * Base-env has no output port; the verb RETURNS the serialized text
 * rather than writing to a stream. Consumers can `(display …)` the
 * result or hand it to a host file-write shim.
 */
export const slatDumpVerb = wrapStructured(function slatDumpVerbBody(values) {
  return tryOr(() => {
    if (!Array.isArray(values)) {
      return slatError('slat/bad-arg', 'slat-dump: expected a list of values')
    }
    const lines = values.map((v) => slatDumps(toSlatValues(v)))
    return lines.join('\n') + '\n'
  }, 'slat/emit-error')
}, 'slat-dump')

/**
 * (slat-dump-doc value) → string
 *
 * Serialize a single value as a whole document. In the minimum-viable
 * set this is the same shape as slat-dumps (pretty-printing is
 * permitted per §5.2 but not required; canonical form is fine).
 */
export const slatDumpDocVerb = wrapStructured(function slatDumpDocVerbBody(value) {
  return tryOr(() => {
    const bridged = toSlatValues(value)
    return slatDumps(bridged) + '\n'
  }, 'slat/emit-error')
}, 'slat-dump-doc')

/**
 * (slat-read text) → value
 *
 * Book-taught alias for slat-loads. Preserved as its own registered
 * verb so introspection surfaces it distinctly ({help slat-read}
 * doesn't say "unknown verb"). Same semantics as slat-loads.
 */
export const slatReadVerb = slatLoadsVerb

/**
 * (slat-write value) → string
 *
 * Book-taught alias for slat-dumps. Same rationale as slat-read.
 */
export const slatWriteVerb = slatDumpsVerb

/**
 * (slat-key record key) → value
 *
 * Extract a field from a slat-record by key. `key` may be a symbol
 * (Sym('lesson')) or a keyword (Sym(':lesson')) or a bare string
 * ("lesson"); all three resolve to the same field.
 *
 * Returns #f when the key is absent. Returns an error record when the
 * record isn't a slat-record shape. Never throws.
 */
export const slatKeyVerb = wrapStructured(function slatKeyVerbBody(record, key) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return slatError('slat/bad-arg', 'slat-key: expected a slat-record')
  }
  let name
  if (key instanceof Sym) {
    name = key.name.startsWith(':') ? key.name.slice(1) : key.name
  } else if (typeof key === 'string') {
    name = key.startsWith(':') ? key.slice(1) : key
  } else if (key instanceof SlatValue && (key.kind === 'symbol' || key.kind === 'keyword')) {
    name = key.value
  } else {
    return slatError('slat/bad-arg', 'slat-key: key must be a symbol, keyword, or string')
  }
  if (Object.prototype.hasOwnProperty.call(record, name)) {
    return record[name]
  }
  return false
}, 'slat-key')

/**
 * (load-community-cart cart-id) → error-record
 *
 * Book of SLAT Ch 15/16 speculative primitive — loads a cart from the
 * community registry. The registry isn't wired yet (see Book §16 which
 * marks the whole "share your slat" surface as forward-looking).
 *
 * The stub exists so calls don't hard-crash the interpreter. It returns
 * a clean error record with kind 'not-yet-implemented' and a friendly
 * message so consumers can display / log / route around it. When the
 * registry lands, this stub is replaced with the real fetch.
 */
export const loadCommunityCartVerb = wrapStructured(function loadCommunityCartVerbBody(cartId) {
  const id = cartId instanceof Sym ? cartId.name
    : (typeof cartId === 'string' ? cartId : String(cartId))
  return slatError(
    'not-yet-implemented',
    `load-community-cart: the community registry is not wired yet (Book of SLAT §16 forward-looking). Requested cart '${id}'.`,
    { requested: id },
  )
}, 'load-community-cart')

// ─────────────────────────────────────────────────────────────────────────
// Metadata for every verb — the shape verbRegistry / introspection reads.
// ─────────────────────────────────────────────────────────────────────────
const SLAT_VERB_META = [
  ['slat-loads', 1,
    'Parse one form from a text string. Returns the parsed value or an (error …) record.',
    '(slat-loads "(hello :who \\"world\\")") => (hello :who "world")'],
  ['slat-load', 1,
    'Parse a line-delimited text stream. Returns a list of parsed values; bad lines become _bad-line sentinels.',
    '(slat-load "(a 1)\\n(b 2)") => ((a :_positional (1)) (b :_positional (2)))'],
  ['slat-load-doc', 1,
    'Parse one whole-document .slat form. Newlines inside the form are permitted.',
    '(slat-load-doc "(incident\\n  :id \\"in-1\\"\\n  :body \\"...\\")") => (incident :id "in-1" :body "...")'],
  ['slat-dumps', 1,
    'Serialize one value to a canonical slat string.',
    '(slat-dumps \'(event :ts 1 :kind "opened")) => "(event :kind \\"opened\\" :ts 1)"'],
  ['slat-dump', 1,
    'Serialize a list of values as line-delimited text.',
    '(slat-dump (list \'(a 1) \'(b 2))) => "(a 1)\\n(b 2)\\n"'],
  ['slat-dump-doc', 1,
    'Serialize one value as a whole-document string.',
    '(slat-dump-doc \'(incident :id "in-1")) => "(incident :id \\"in-1\\")\\n"'],
  ['slat-read', 1,
    'Alias for slat-loads — parse one form from text.',
    '(slat-read "(hello)") => (hello)'],
  ['slat-write', 1,
    'Alias for slat-dumps — serialize one value to canonical text.',
    '(slat-write \'(hello)) => "(hello)"'],
  ['slat-key', 2,
    'Extract a field from a slat-record by key. Returns #f when absent.',
    '(slat-key (slat-loads "(event :ts 1)") \'ts) => 1'],
  ['load-community-cart', 1,
    'Load a cart from the community registry. Currently stub — returns a not-yet-implemented error record.',
    '(load-community-cart "cart-example") => (error :kind not-yet-implemented …)'],
]

/**
 * installSlatVerbs(env) — bind every SLAT primitive into the given env.
 *
 * Idempotent: calling twice replaces bindings in place (last writer wins,
 * per verbRegistry contract). Every verb registers with perm 'read' —
 * the reader is inert, canonicalization is a pure transform, and the
 * community-cart stub returns an error record without any side effect.
 * When the community-cart primitive is wired for real, its perm bumps
 * to 'network'.
 *
 * Returns the env for chaining: `installSlatVerbs(makeBaseEnv(fuel))`.
 */
export function installSlatVerbs(env) {
  if (!env || typeof env.define !== 'function') {
    throw new TypeError('installSlatVerbs: expected an Env with .define')
  }

  const verbs = {
    'slat-loads':          slatLoadsVerb,
    'slat-load':           slatLoadVerb,
    'slat-load-doc':       slatLoadDocVerb,
    'slat-dumps':          slatDumpsVerb,
    'slat-dump':           slatDumpVerb,
    'slat-dump-doc':       slatDumpDocVerb,
    'slat-read':           slatReadVerb,
    'slat-write':          slatWriteVerb,
    'slat-key':            slatKeyVerb,
    'load-community-cart': loadCommunityCartVerb,
  }

  const metaByName = new Map(SLAT_VERB_META.map(([n, ar, doc, ex]) => [n, { ar, doc, ex }]))

  for (const [name, fn] of Object.entries(verbs)) {
    const m = metaByName.get(name)
    env.define(name, fn, {
      perm: 'read',
      name,
      arity: m ? m.ar : null,
      doc: m ? m.doc : null,
      examples: m ? [{ level: 'novice', code: m.ex }] : [],
      namespace: 'slat',
      tier: 'base',
      source: 'src/slat-verbs.js',
      since: 'sakura-scheme@1.5',
    })
  }

  return env
}

// Convenience: also export the metadata table so the docs emitter can
// enumerate the roster without importing the installer.
export const SLAT_VERBS_META = Object.freeze(SLAT_VERB_META.map(([name, arity, doc, example]) => ({
  name, arity, doc, examples: [{ level: 'novice', code: example }],
  namespace: 'slat', perm: 'read', tier: 'base', source: 'src/slat-verbs.js',
})))
