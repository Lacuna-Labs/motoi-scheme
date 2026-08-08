// require-verb.js — the (require 'lib-name) verb. Lets Scheme code trigger
// a lazy install without leaving the language.
//
// Usage from Scheme:
//   (require 'alg)          ; load lib/base/alg.js if not already loaded
//   (require 'game-theory)  ; load lib/game/game-theory.js
//   (require 'matrix)       ; load lib/math/matrix.js
//
// The name is matched against the entry.name suffix in verb-manifest.js
// (e.g. "base/alg" or "game/game-theory" — trailing segment matches too).
//
// Return values:
//   'ok  — installer ran (or was already loaded)
//   #f   — no lib in the manifest matched the name
//
// The miss used to be the symbol `unknown`, and every symbol is truthy in
// Motoi, so (if (require 'typo) ...) took the true branch — a require that
// matched nothing was indistinguishable from one that installed a library.
//
// The audit script scripts/audit-reference-impl-parity.py exercises this
// verb during compliance runs so lazy installs don't hide from the audit.

import { Sym } from '../../src/reader.js'
import { MANIFEST } from '../../core/verb-manifest.js'

import { seqVerb } from '../base/list.js'
const nm = (x) => (x instanceof Sym ? x.name : String(x))

const _loaded = new Set()

// The ledger only ever recorded libraries pulled in BY `require`, so at boot
// `(loaded-libs)` was empty even though installCoreLazy had just installed
// two dozen eager parts — the verb said nothing was loaded while the whole
// eager surface was live and callable. core/index.js calls this with the
// names whose install() actually returned, not with the manifest's intent,
// so a part that threw during install stays out of the list.
export function noteLibsLoaded (names) {
  for (const n of names) _loaded.add(n)
}


// ── inline registration metadata (2026-07-22) ────────────────────
// See engineering/HOW-TO-REGISTER-A-VERB.md.
export const VERBS = [
  "available-libs",
  "loaded-libs",
  "require",
]
export const LAZY = false

export function installRequire(env, ctx) {
  const def = (name, fn) => env.define(name, seqVerb(fn), { perm: 'read' })

  def('require', (libName) => {
    const target = nm(libName)
    // Match exact name OR trailing-segment match: "alg" matches "base/alg".
    let entry = MANIFEST.find(m => m.name === target)
      || MANIFEST.find(m => m.name.endsWith('/' + target))
    if (!entry) return false
    if (_loaded.has(entry.name)) return new Sym('ok')
    try {
      entry.install(env, ctx || { env, fuel: { n: 1_000_000 } })
      _loaded.add(entry.name)
      return new Sym('ok')
    } catch (e) {
      throw new Error(`require: install of ${entry.name} failed — ${e.message}`)
    }
  })

  def('loaded-libs', () => [..._loaded].sort().map(n => new Sym(n)))

  def('available-libs', () => MANIFEST.map(m => new Sym(m.name)).sort((a,b) => a.name.localeCompare(b.name)))

  return env
}

export default installRequire
