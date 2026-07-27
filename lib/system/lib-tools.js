// lib/system/lib-tools.js — the standard-library PARTS surface, in-language.
//
// Created 2026-07-24. Exposes the parts registry + the 5-point gate to
// Motoi programs, so the language can look at (and validate) its own
// standard library the same way `motoi lib …` does from the shell.
//
//   (std-parts)              → list of parts, each an alist of metadata
//   (lib-info 'SRFI-13)      → one part's metadata alist, or nil
//   (lib-verbs 'SRFI-13)     → list of the part's verb names (symbols)
//   (lib-validate 'SRFI-13)  → 5-point-gate report alist for one part
//   (lib-validate-all)       → reports for every standard part
//
// The gate here validates a named STANDARD part against the LIVE env (the
// part is already installed, so gates 3 + 5 confirm the surface is live).
// Registering an ARBITRARY new lib file is async (dynamic import) and lives
// on the CLI: `motoi lib register <file.js>`. See src/lib-register.js.
//
// Provenance: the stdlib split + parts registry (2026-07-24). Doctrine:
// each SRFI is its own includable/excludable part; the language must be
// able to name, inspect, and conformance-check its parts. See CLAUDE.md
// "The standard library (LOCKED 2026-07-24)".

import { Sym } from '../../src/reader.js'
import { STD_PARTS, findPart, validatePart } from '../../core/parts-registry.js'

const nm = (x) => (x instanceof Sym ? x.name : String(x))

// A part → Motoi-native alist. Keys are `:name`-style Syms so the reader
// prints them cleanly and `assoc` walks them.
function partToAlist (p) {
  return [
    [new Sym(':name'), p.name],
    [new Sym(':std'), p.std],
    [new Sym(':spec'), p.spec],
    [new Sym(':mode'), new Sym(p.mode)],
    [new Sym(':verb-count'), p.verbs.length],
  ]
}

// A validatePart report → alist. Each check becomes (:id pass "detail").
function reportToAlist (rep) {
  return [
    [new Sym(':ok'), rep.ok],
    [new Sym(':std'), rep.std ?? false],
    [new Sym(':spec'), rep.spec ?? false],
    [new Sym(':checks'), rep.checks.map((c) => [new Sym(':' + c.id), c.pass, c.detail])],
  ]
}

// ── inline registration metadata ─────────────────────────────────
// See engineering/HOW-TO-REGISTER-A-VERB.md.
export const VERBS = [
  'std-parts', 'lib-info', 'lib-verbs', 'lib-validate', 'lib-validate-all',
]
export const LAZY = false

export function installLibTools (env, ctx) {
  const fuelBox = (ctx && ctx.fuel) || { n: 1_000_000 }
  const def = (n, f, perm = 'read', doc = '') =>
    env.define(n, f, { perm, doc, namespace: null, tier: 'operator' })

  def('std-parts', () => STD_PARTS.map(partToAlist), 'read',
    'List every standard-library part (R7RS-small + adopted SRFIs) as metadata alists.')

  def('lib-info', (name) => {
    const p = findPart(nm(name))
    return p ? partToAlist(p) : null
  }, 'read',
    "(lib-info 'SRFI-13) — one part's metadata alist, or nil if not a standard part.")

  def('lib-verbs', (name) => {
    const p = findPart(nm(name))
    return p ? p.verbs.map((v) => new Sym(v)) : null
  }, 'read',
    "(lib-verbs 'SRFI-1) — list of the verb names a part provides, as symbols.")

  def('lib-validate', (name) => {
    const p = findPart(nm(name))
    if (!p) return null
    return reportToAlist(validatePart(p, { env, fuelBox }))
  }, 'read',
    "(lib-validate 'SRFI-125) — run the 5-point gate on one standard part against the live env.")

  def('lib-validate-all', () =>
    STD_PARTS.map((p) => [
      new Sym(':' + p.name),
      ...reportToAlist(validatePart(p, { env, fuelBox })),
    ]), 'read',
    'Run the 5-point gate on every standard part; return a report per part.')

  return env
}

export default installLibTools
