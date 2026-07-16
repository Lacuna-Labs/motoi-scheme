// sakura-scheme — introspection surface
//
// One source of truth for what a verb IS: what it does, what it takes,
// what it returns, where it lives. REPL, CLI, docs, and Sakura all
// read from these functions.
//
// The registry itself lives in verbRegistry.js; this module just
// shapes what the registry stores into the answers a caller wants.

import { getVerbMeta, snapshotRegistry } from './verbRegistry.js'
import { Sym } from './reader.js'

// Resolve a name or Sym into the string the registry indexes by.
function nameOf(x) {
  if (x instanceof Sym) return x.name
  if (typeof x === 'string') return x
  throw new TypeError(`introspect: expected symbol or string, got ${typeof x}`)
}

/**
 * Return the full metadata blob for a verb as a plain object.
 * Callers: `,help card/open` in REPL, `(help 'card/open)` in Scheme,
 * `sakura-scheme help card/open` in the CLI.
 *
 * @param {string|Sym} name
 * @returns {object|null} the metadata, or null if no such verb
 */
export function help(name) {
  const meta = getVerbMeta(nameOf(name))
  if (!meta) return null
  return {
    name: meta.name || nameOf(name),
    doc: meta.doc || '',
    contract: meta.contract || null,
    arity: meta.arity || null,
    examples: meta.examples || [],
    namespace: meta.namespace || null,
    tier: meta.tier || null,
    perm: meta.perm || null,
    atom: meta.atom || null,
    source: meta.source || null,
    since: meta.since || null,
  }
}

/**
 * Return a short human-readable description of the verb — one paragraph.
 * If the verb has no doc, returns a placeholder.
 */
export function describe(name) {
  const meta = getVerbMeta(nameOf(name))
  if (!meta) return `unknown verb: ${nameOf(name)}`
  const doc = meta.doc || '(no doc)'
  const arity = meta.arity ? ` — arity ${JSON.stringify(meta.arity)}` : ''
  const ns = meta.namespace ? ` [${meta.namespace}]` : ''
  return `${nameOf(name)}${ns}${arity}\n${doc}`
}

/**
 * Return the contract string, e.g. "(symbol [options]) -> boolean".
 */
export function typeOf(name) {
  const meta = getVerbMeta(nameOf(name))
  return meta?.contract || null
}

/**
 * Return the arity — a scalar or a `[min, max]` pair.
 */
export function arityOf(name) {
  const meta = getVerbMeta(nameOf(name))
  return meta?.arity ?? null
}

/**
 * Return the docstring alone.
 */
export function docOf(name) {
  const meta = getVerbMeta(nameOf(name))
  return meta?.doc || null
}

/**
 * Return a source hint (path:line) where the verb impl lives.
 */
export function sourceOf(name) {
  const meta = getVerbMeta(nameOf(name))
  return meta?.source || null
}

/**
 * Every registered verb as `{ name, meta }` pairs.
 * Useful for tab-completion, apropos, doc emission.
 */
export function allVerbs() {
  return snapshotRegistry()
}
