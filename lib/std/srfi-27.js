// lib/std/srfi-27.js — SRFI-27: Sources of Random Bits.
//
// Relocated 2026-07-24 from src/r7rs-completions.js (full standard-library
// relocation into per-part libs). This is the SRFI-27 PART — the standard
// random surface. R7RS-small has NO random, so per the conformance ladder
// (R7RS-small → SRFI → Motoi-own) SRFI-27 is the target. Motoi's own
// `random-int`/`random-range`/`random-pick` stay as extras elsewhere.
//
// Provenance: SRFI-27 (Sebastian Egner).
// https://srfi.schemers.org/srfi-27/
//
// A random source is a lightweight object wrapping the shared engine draw
// (src/rng.js); the default source backs the two convenience procedures.
// It must NOT capture Math.random: a source that draws directly escapes
// `(with-seed …)`, and a learner replaying a seeded run gets different
// numbers from `random-integer` than from `random-int`.

import { registerPartMeta } from './_shared.js'
import { seededRandom } from '../../src/rng.js'

import { seqVerb } from '../base/list.js'
export const STD = 'SRFI-27'
export const SPEC = 'spec/srfi-27.slatl'
export const LAZY = true // not in the default bundle; pulled in explicitly

export const VERBS = [
  'make-random-source', 'random-integer', 'random-real',
  'random-source-randomize!',
]

export function installSRFI27 (env, _fuelBox) {
  const def = (n, f, perm = 'read') => env.define(n, seqVerb(f), { perm })

  const makeSource = () => ({ __random_source__: true, rand: seededRandom })
  const defaultSource = makeSource()
  def('make-random-source', () => makeSource())
  // (random-integer n) — SRFI-27. Integer in [0, n).
  def('random-integer', (n) => Math.floor(defaultSource.rand() * Math.max(1, n | 0)))
  // (random-real) — SRFI-27. Real in the open interval (0, 1).
  def('random-real', () => {
    let r = defaultSource.rand()
    while (r <= 0) r = defaultSource.rand()
    return r
  })
  // (random-source-randomize! src) — SRFI-27. Deliberately a no-op that
  // returns the source for chaining. SRFI-27 has it reseed from system
  // entropy, but that would let a cart escape `(with-seed …)` from inside
  // the seeded extent and break replay. Outside a seed the draw is already
  // nondeterministic, so there is nothing for it to do.
  def('random-source-randomize!', (src) => src, 'state-change')

  registerPartMeta(META, { source: 'lib/std/srfi-27.js' })
  return env
}

export const META = [
  ['make-random-source', 0, '(make-random-source) — a fresh random source. SRFI-27.', '(make-random-source)', 'random'],
  ['random-integer',    1, '(random-integer n) — integer in [0, n). SRFI-27.',        '(< (random-integer 6) 6) => #t', 'random'],
  ['random-real',       0, '(random-real) — real in the open interval (0, 1). SRFI-27.', '(random-real) => 0.37…', 'random'],
  ['random-source-randomize!', 1, '(random-source-randomize! src) — reseed a source; no-op in Motoi. SRFI-27.', '(random-source-randomize! (make-random-source))', 'random'],
]

export default installSRFI27
