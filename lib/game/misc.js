// misc.js — small utilities that the CORE reference declares but that
// don't fit neatly in any single module.
//
// Includes:
//   random          — 0..1 uniform, or 0..n if arg given
//   with-seed       — dynamic-extent seeded PRNG (macro-like: takes seed + thunk)
//   with-spacing    — dynamic-extent spacing hint (returns thunk result)
//   to-draw         — big-bang render-clause factory
//   key?            — input probe (soft-fail if no host)
//   touch           — touch input probe (soft-fail if no host)
//   eval            — evaluate a Scheme form in the current env
//   base/make-character — placeholder character constructor (returns tagged data)

import { Sym } from '../../src/reader.js'
import { apply, Env, evaluate } from '../../src/interp.js'
import { seededRandom as _seededUniform, withSeed } from '../../src/rng.js'

import { seqVerb } from '../base/list.js'
// The seed used to live in this file, which is why it kept getting escaped:
// a verb author adding `random-integer` to lib/std/srfi-27.js had no reason
// to import from the game namespace. It now lives in src/rng.js — see the
// note there. This module is just another consumer.

function tag(name, ...rest) { return [new Sym(name), ...rest] }


// ── inline registration metadata (2026-07-22) ────────────────────
// See engineering/HOW-TO-REGISTER-A-VERB.md.
export const VERBS = [
  "base/make-character",
  "environment",
  "eval",
  "interaction-environment",
  "null-environment",
  "scheme-report-environment",
  "key?",
  "randint",
  "random",
  "random-int",
  "random-pick",
  "random-range",
  "rng-uniform",
  "to-draw",
  "touch",
  "with-seed",
  "with-spacing",
]
export const LAZY = false

export function installMisc(env, fuel) {
  const _fuel = fuel ?? { n: 1_000_000 }
  const def = (n, f, perm = 'read') => env.define(n, seqVerb(f), { perm })

  // (random) → 0..1 uniform.
  // (random n) → 0..n exclusive uniform (float).
  def('random', (n) => {
    const r = _seededUniform()
    return n == null ? r : r * n
  })

  // BUG-2 fix (Zane-2, 2026-07-17): rebind the base random-* verbs so
  // (with-seed …) makes the ENTIRE random surface deterministic, not
  // just (random). These names originate in src/base.js which registered
  // them against Math.random directly; we replace them here so the same
  // seed produces the same draw regardless of which random verb the
  // caller reaches for. Kid-facing surface: same seed → same everything.
  def('random-int', (n) => Math.floor(_seededUniform() * Math.max(1, n | 0)))
  def('random-range', (lo, hi) => lo + _seededUniform() * (hi - lo))
  def('random-pick', (lst) => (lst && lst.length
    ? lst[Math.floor(_seededUniform() * lst.length)]
    : null))
  // Mirrors src/base.js — see the note there. One argument used to yield
  // +nan.0 rather than an error.
  def('randint', (a, b) => {
    if (typeof a !== 'number' || typeof b !== 'number') {
      throw new Error('randint: expected two numeric bounds, as (randint a b) — a random integer in [a, b). ' +
        'For a single upper bound use (random-int n), which draws from 0..n-1.')
    }
    return a + Math.floor(_seededUniform() * (b - a))
  })
  def('rng-uniform', () => _seededUniform())

  // (with-seed seed thunk) → run thunk with a seeded PRNG for its
  // dynamic extent. Restores the previous rng on exit. Now covers every
  // random-* verb registered above (BUG-2 fix).
  def('with-seed', (seed, thunk) => withSeed(seed, () => (
    thunk != null ? apply(thunk, [], _fuel) : undefined
  )), 'paint')

  // (with-spacing spacing thunk) — dynamic-extent spacing hint. For
  // now, just runs the thunk and returns its result. Layout adapters
  // may read the last spacing value from the stack; the base CORE
  // exposes it as an identity wrapper.
  def('with-spacing', (spacing, thunk) => {
    if (thunk != null) return apply(thunk, [], _fuel)
    return spacing
  }, 'paint')

  // Also make sure `thunk != null` correctly routes back — the ban on
  // typeof === 'function' matters because Scheme Closures aren't JS
  // functions, they're `Closure` class instances, and `apply` handles
  // both. Keeping the check as `!= null` catches undefined/null while
  // letting closures + JS functions both flow through.

  // (to-draw fn) → tagged big-bang render clause. The animation loop
  // reads this to know how to paint the current state.
  def('to-draw', (fn) => tag('to-draw', fn))

  // (key? name) → boolean. Without a live input adapter, always #f;
  // never throw. When a media adapter (media.js) is wired to hardware,
  // that adapter can replace this with a real probe.
  def('key?', (name) => false)

  // (touch) → tagged touch descriptor. Empty when no touch adapter.
  def('touch', () => tag('touch', new Sym('none')))

  // (eval form [environment]) → result. R7RS §6.12. Two bugs: the environment
  // argument was ignored outright, so `(eval x (environment '(scheme base)))`
  // silently ran against whatever was in scope; and the body was `async`, so
  // eval handed back a PROMISE — `(f (eval '(lambda ...)))` died with "not a
  // function: [object Promise]". `evaluate` is synchronous; so is this now.
  def('eval', (form, environment) =>
    evaluate(form, environment instanceof Env ? environment : env, _fuel))

  // The §6.12 environment specifiers. Motoi has no module system: there is one
  // substrate environment, and every library's bindings live in it. So each of
  // these hands back a fresh CHILD of that environment — writable, discardable,
  // and containing the requested library, but not restricted to it. That is an
  // approximation, not the standard's isolation; recorded here rather than
  // hidden. `(scheme-report-environment 5)` and `(null-environment 5)` accept
  // only version 5, which is the only version the standard defines.
  def('environment', (..._libs) => new Env(env))
  def('interaction-environment', () => env)
  def('scheme-report-environment', (version) => {
    if (version !== 5) throw new Error('scheme-report-environment: only version 5 is defined')
    return new Env(env)
  })
  def('null-environment', (version) => {
    if (version !== 5) throw new Error('null-environment: only version 5 is defined')
    return new Env(env)
  })

  // (base/make-character name?) → tagged character descriptor. The
  // structure is a plain alist so higher layers can enrich it.
  def('base/make-character', (name) => [
    new Sym('character'),
    [new Sym(':name'), name ?? new Sym('unnamed')],
    [new Sym(':parts'), []],
    [new Sym(':pose'), new Sym('idle')],
  ])

  return env
}

export default installMisc
