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
import { apply } from '../../src/interp.js'

// Simple linear-congruential PRNG for with-seed. Not cryptographic.
class LCG {
  constructor(seed = 42) { this.s = (seed >>> 0) || 42 }
  next() {
    this.s = (this.s * 1664525 + 1013904223) >>> 0
    return this.s / 0x100000000
  }
}

let _rng = null   // when null, use Math.random; when set, use the LCG

// BUG-2 fix (Zane-2, 2026-07-17): the seeded rng draw. Every random-* verb
// installed below routes through this helper so `with-seed` covers ALL of
// them, not just (random). Previously random-int / random-range / random-
// pick / randint / rng-uniform (registered in src/base.js) bypassed the
// LCG entirely — same seed produced divergent outputs from those verbs.
function _seededUniform() {
  return _rng ? _rng.next() : Math.random()
}

// Exported so sibling modules (part.js, steering.js) can also route their
// random draws through the shared seed. Same LCG state as (with-seed …).
// BUG-3 + BUG-4 (2026-07-17): part/shake and ai/wander called Math.random
// directly, breaking determinism under (with-seed …).
export function seededRandom() { return _seededUniform() }

function tag(name, ...rest) { return [new Sym(name), ...rest] }

export function installMisc(env, fuel) {
  const _fuel = fuel ?? { n: 1_000_000 }
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

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
  def('randint', (a, b) => a + Math.floor(_seededUniform() * (b - a)))
  def('rng-uniform', () => _seededUniform())

  // (with-seed seed thunk) → run thunk with a seeded PRNG for its
  // dynamic extent. Restores the previous rng on exit. Now covers every
  // random-* verb registered above (BUG-2 fix).
  def('with-seed', (seed, thunk) => {
    const prev = _rng
    _rng = new LCG(seed | 0)
    try {
      if (thunk != null) return apply(thunk, [], _fuel)
      return undefined
    } finally {
      _rng = prev
    }
  }, 'paint')

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

  // (eval form) → result. Runs a parsed form against the current env.
  // Real eval imported lazily to avoid circular refs.
  def('eval', async (form) => {
    const { evaluate } = await import('../../src/interp.js')
    return evaluate(form, env, _fuel)
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
