// LACUNA SCHEME — owns the bridge between the engine at lacuna-scheme/ (3.0: ported from Sakura; Sakura inherits it back — one upstream,
//   work order §2) and the foreman's verbs (verbs.mjs): values in and out.
// Refuses: the verbs a worker may NOT have — names matching llm/ persona/ sakura/ artifact/ completion/ completions/ throw "ask the brain
//   with (need-brain …)".
// Implements: design §5, §6 (the kernel's reader and evaluator), §12 (carts are Scheme).
// Invariants (§18): none written here; enforces law 3 (the brain never executes) by withholding the model verbs.
// Faults (§16): none by id.
import { parse as readText, evaluate, apply, makeBaseEnv, Env, sym, Sym } from '../../lacuna-scheme/src/core.js'
import { VERSION } from '../../lacuna-scheme/src/version.js'
// O-68: the foreman names the engine range it supports; a major outside it refuses to boot (a migration plan is owed in both)
export const ENGINE_RANGE = '^3.0.0'
if (!/^3\./.test(String(VERSION))) throw new Error(`lacuna-scheme ${VERSION} is outside the foreman's range ${ENGINE_RANGE}`)

export { evaluate, apply, Env, Sym }

/** The engine's reader, minus one leading byte-order mark (U1 2026-10-24: a cart saved with a BOM was buried for
 *  "unbound symbol: \uFEFF", a character nobody can see). */
export const parse = (text) => readText(typeof text === 'string' && text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text)

// The base env reaches the host in a few places — llm/* shells out to curl, persona/* reads files, sakura/* asks a model
// through persona, artifact/* belongs to a browser surface. A worker thinks only through `need-brain` (Lacuna's brain,
// Lacuna's limits) or its small mind under a grammar, so those names are shadowed with a refusal in every worker. There
// is no eval: text a worker receives can be read as data (slat-loads), never run as code.
const REFUSED = /^(llm|persona|sakura|artifact|completion|completions)\//
const refusal = (name) => () => { throw new Error(`${name} is not a worker's verb — ask the brain with (need-brain …)`) }

export function baseEnv(fuel) {
  const root = makeBaseEnv(fuel)
  const env = new Env(root)
  for (const name of root.vars.keys()) if (REFUSED.test(name)) env.define(name, refusal(name), { perm: 'read' })
  return env
}

/** JS → Scheme: a kind becomes a symbol; arrays stay lists; objects become alists of (key . value); a symbol stays one. */
export function toScheme(v) {
  if (v instanceof Sym) return v                                   // already Scheme (a mind's label)
  if (Array.isArray(v)) return v.map(toScheme)
  if (v && typeof v === 'object') return Object.entries(v).map(([k, x]) => [sym(k), toScheme(x)])
  return v
}

/** Scheme → JSON: symbols by name, lists as arrays, pairs as two-element arrays, closures named. */
export function toJson(v, depth = 0) {
  if (depth > 12) return '…'
  if (v instanceof Sym) return v.name
  if (Array.isArray(v)) return v.map((x) => toJson(x, depth + 1))
  if (v && typeof v === 'object' && 'car' in v && 'cdr' in v) return [toJson(v.car, depth + 1), toJson(v.cdr, depth + 1)]
  if (typeof v === 'function' || (v && v.params)) return '#<procedure>'
  if (v === undefined) return null
  return v
}

export const symOf = (s) => sym(String(s))
