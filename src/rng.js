// src/rng.js — the ONE random draw in Motoi.
//
// Every random-producing verb in the language must draw from `seededRandom()`
// here. Not Math.random. Not a local LCG. Not a captured `rand` field.
//
// Why this file exists at all: the seed used to live inside
// `lib/game/misc.js`, a leaf module in the game namespace. Verbs added
// anywhere else — src/base.js, lib/std/srfi-27.js, lib/base/alg.js —
// reasonably reached for Math.random and silently escaped `(with-seed …)`.
// That bug was found and fixed three separate times (Zane-2 BUG-2/3/4
// 2026-07-17, then again 2026-08-01) because each fix patched the call
// sites it knew about rather than removing the choice. Hoisting the state
// to the engine layer means a new verb has nothing else to reach for, and
// `tests/seed-determinism.test.mjs` enumerates the live environment so an
// escapee fails the suite instead of a replay.
//
// Determinism is a promise Motoi makes to learners: same seed, same run.

// Linear-congruential generator (Numerical Recipes constants). Not
// cryptographic — it is a replay device, and it must never be used as one.
class LCG {
  constructor(seed = 42) { this.s = (seed >>> 0) || 42 }
  next() {
    this.s = (this.s * 1664525 + 1013904223) >>> 0
    return this.s / 0x100000000
  }
}

let _rng = null // null → unseeded (Math.random); set → inside (with-seed …)

// The uniform draw in [0, 1). The only legitimate source of randomness.
export function seededRandom() {
  return _rng ? _rng.next() : Math.random()
}

export function isSeeded() {
  return _rng !== null
}

// Run `fn` with a seeded generator for its dynamic extent, restoring the
// previous generator on the way out — nesting and throws both unwind.
export function withSeed(seed, fn) {
  const prev = _rng
  _rng = new LCG(seed | 0)
  try {
    return fn()
  } finally {
    _rng = prev
  }
}
