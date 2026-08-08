// lib/system/introspection.js — expose the introspection surface as
// Scheme-callable verbs.
//
// Provenance: 2026-07-22. The seven functions in src/introspect.js have
// existed as JavaScript exports since the language was born but were
// never registered as Motoi verbs. That meant `motoi help <name>` worked
// from the CLI (a shell subcommand) but `(help 'car)` from a Motoi
// program was `unbound symbol`. The Book of Introspection teaches an
// interface the runtime didn't expose. This installer fixes that.
//
// Wires 7 verbs, all in the base namespace (no prefix) because they are
// language-primitive introspection, matching Scheme tradition:
//
//   (help 'car)         → metadata hash for `car`
//   (describe 'car)     → one-paragraph human-readable
//   (arity-of 'car)     → scalar or [min max] pair
//   (type-of 'car)      → contract string
//   (doc-of 'car)       → docstring alone
//   (source-of 'car)    → source path:line hint
//   (all-verbs)         → list of every registered verb
//
// All accept either a Symbol or a string. `all-verbs` takes zero args.
// Return values are Motoi-native (nil for missing metadata, plain lists
// for enumerations) so they compose cleanly with the rest of the
// language.
//
// Doctrine: the language must be able to look at itself. See
// scheme-books/book-of-introspection/ + reference/00b-introspection.slat.

import {
  help as _help,
  describe as _describe,
  typeOf as _typeOf,
  arityOf as _arityOf,
  docOf as _docOf,
  sourceOf as _sourceOf,
} from '../../src/introspect.js'
import { Sym } from '../../src/reader.js'

import { isList, seqVerb, NIL } from '../base/list.js'

// A missing field crosses back into Scheme as NIL, not as JS `null`.
//
// This file's own header has said "nil for missing metadata" since 2026-07-22,
// but the six accessors returned a bare JS `null` and `toScheme` passes a
// non-array straight through. The escaping value satisfied NOTHING: it was
// truthy, `null?` said #f, `string?` said #f, and `write` printed zero
// characters. The reference's own runnable example is
//
//   (define (contract-shape? v) (let ((t (type-of v))) (or (null? t) (string? t))))
//
// (00b-introspection.slat:1018) and it answered #f for `car` — against
// `:signature "(type-of symbol-or-string) -> string-or-null"` (:996) and
// `:invariant "∀ v ∈ Sym. type(type-of(v)) ∈ {String, Null}."` (:1040).
// `arity-of` carries the same `-> integer-or-pair-or-null` (:916).
//
// A silent-wrong of exactly the shape this class of bug keeps taking: no raise,
// an answer-shaped nothing, and a run-only gate sees green.
const nilIfMissing = (v) => (v === null || v === undefined ? NIL : v)

// Convert a JS metadata blob into a Motoi-native alist.
// Alists are `((:key val) (:key val))` — the shape Scheme code expects
// when it walks metadata with `assoc` / `car` / `cdr`. Keys are Motoi
// Sym instances (not JS Symbol) so the reader prints them as `:name`
// instead of `Symbol(:name)`.
function metaToAlist(meta) {
  if (!meta || typeof meta !== 'object') return null
  const out = []
  for (const [k, v] of Object.entries(meta)) {
    // Skip null-ish scalars but keep 0 and false — genuine values.
    if (v === null || v === undefined) continue
    out.push([new Sym(':' + k), v])
  }
  return out
}

// Walk env chain and collect every bound name, deepest→shallowest.
function envAllNames(env) {
  const names = new Set()
  let e = env
  while (e) {
    if (e.vars && e.vars.keys) for (const k of e.vars.keys()) names.add(k)
    e = e.parent
  }
  return [...names].sort()
}


// ── inline registration metadata (2026-07-22) ────────────────────
// See engineering/HOW-TO-REGISTER-A-VERB.md.
export const VERBS = [
  "all-verbs",
  "arity-of",
  "describe",
  "doc-of",
  "help",
  "source-of",
  "type-of",
]
export const LAZY = false

export function installIntrospection(env) {
  const def = (n, f, perm = 'read', doc = '') =>
    env.define(n, seqVerb(f), { perm, doc, namespace: null, tier: 'operator' })

  // help — full metadata as a Motoi-native alist so `(assoc :doc (help 'car))` works.
  def('help', (name) => nilIfMissing(metaToAlist(_help(name))), 'read',
      'Return the full metadata alist for a verb. (help \'car) → ((:name "car") (:doc "…") …)')

  // describe — a one-paragraph human string. Useful in REPL echo.
  def('describe', (name) => _describe(name), 'read',
      'Return a one-paragraph human description of a verb.')

  // arity-of — scalar or [min max]. In Scheme, a two-element list.
  def('arity-of', (name) => {
    const a = _arityOf(name)
    if (a === null || a === undefined) return NIL
    if (isList(a)) return a
    return a
  }, 'read', 'Return arity: an integer or a (min max) pair.')

  // type-of — contract string. Note the reference calls this the contract;
  // we alias to type-of for readability in probes.
  def('type-of', (name) => nilIfMissing(_typeOf(name) || null), 'read',
      'Return the contract string, e.g. "(symbol) -> boolean".')

  // doc-of — the docstring alone. Useful for terse REPL echo.
  def('doc-of', (name) => nilIfMissing(_docOf(name) || null), 'read',
      'Return the docstring for a verb.')

  // source-of — the source hint (path:line). Useful in probes and IDE.
  def('source-of', (name) => nilIfMissing(_sourceOf(name) || null), 'read',
      'Return the source path:line where the verb impl lives.')

  // all-verbs — every bound name in the env chain, as a list of strings.
  // Reads the env at CALL time (not install time) so grows as later
  // installers add verbs.
  def('all-verbs', () => envAllNames(env), 'read',
      'Return a list of every bound name in the env chain.')

  return env
}

export default installIntrospection
