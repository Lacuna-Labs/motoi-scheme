// juggle.js — siteswap juggling math.
//
// Provenance: scheme-lang/src/juggle.js. Migrated to
// motoi-scheme/lib/game/ on 2026-07-16 (Pass-3 Wave 1). Dialect-
// neutral pure math; no content changes.
//
// Pure functions. No state. No I/O.
//
// A vanilla siteswap is a list of non-negative integers s[0..p-1] where
// p is the period. The pattern is VALID iff the map i ↦ (i + s[i]) mod p
// is a permutation of {0, 1, ..., p-1} — i.e. no two throws land on the
// same beat.
//
// The AVERAGE THEOREM says the ball count of a valid siteswap is the
// arithmetic mean of the throw heights. It must be an integer.
//
// This module provides:
//   (juggle/valid?    siteswap) -> boolean
//   (juggle/balls     siteswap) -> number | 'nan
//   (juggle/max-throw siteswap) -> number | 'nan
//   (juggle/state     siteswap) -> vector | 'nan
//   (juggle/simulate  siteswap) -> list-of-throws | 'nan
//   (juggle/generate  period ball-count) -> list-of-siteswaps | 'fuel-budget
//
// Kid-readable comment: numbers-that-are-juggling. Every number is how
// high you throw the ball on this beat; the next time it comes back is
// exactly that many beats later. (5 3 1) means throw high, then medium,
// then a low pass; the ball you threw high catches your next-beat's hand,
// and the pattern keeps its shape.

import { Sym } from '../../src/reader.js'

// Sentinel Scheme symbols — the reference contract calls for 'nan on
// invalid inputs. Fresh Sym per call so interning doesn't collide.
const NAN = () => new Sym('nan')
const FUEL_BUDGET = () => new Sym('fuel-budget')

// Under this reader Scheme lists and vectors both arrive as JS arrays.
function asArray(x) {
  if (Array.isArray(x)) return x
  return null
}

// Non-negative integer predicate.
function isNonNegInt(n) {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0
}

// Validate: non-empty array of non-negative integers with permutation
// landings. Returns the array if valid; null otherwise.
function validateSiteswap(pattern) {
  const arr = asArray(pattern)
  if (!arr) return null
  if (arr.length === 0) return null
  for (const n of arr) if (!isNonNegInt(n)) return null
  const p = arr.length
  const seen = new Array(p).fill(false)
  for (let i = 0; i < p; i++) {
    const land = (i + arr[i]) % p
    if (seen[land]) return null
    seen[land] = true
  }
  return arr
}

// ── verb impls ─────────────────────────────────────────────────────────

export function jugglValid(pattern) {
  return validateSiteswap(pattern) !== null
}

export function jugglBalls(pattern) {
  const arr = validateSiteswap(pattern)
  if (!arr) return NAN()
  let sum = 0
  for (const n of arr) sum += n
  const avg = sum / arr.length
  if (!Number.isInteger(avg)) return NAN()
  return avg
}

export function jugglMaxThrow(pattern) {
  const arr = validateSiteswap(pattern)
  if (!arr) return NAN()
  let m = arr[0]
  for (let i = 1; i < arr.length; i++) if (arr[i] > m) m = arr[i]
  return m
}

// Occupancy vector: slot k = 1 iff some throw lands at (beat mod period)
// == k. Under this reader arrays render as Scheme lists/vectors equivalently.
export function jugglState(pattern) {
  const arr = validateSiteswap(pattern)
  if (!arr) return NAN()
  const p = arr.length
  const v = new Array(p).fill(0)
  for (let i = 0; i < p; i++) {
    v[(i + arr[i]) % p] = 1
  }
  return v
}

// Schedule expansion: per-beat (beat height landing hand). Hand alternates
// 'L / 'R starting 'L on beat 0. Reference spec is explicit.
export function jugglSimulate(pattern) {
  const arr = validateSiteswap(pattern)
  if (!arr) return NAN()
  const p = arr.length
  const out = []
  const L = new Sym('L')
  const R = new Sym('R')
  for (let i = 0; i < p; i++) {
    const land = (i + arr[i]) % p
    const hand = (i % 2 === 0) ? L : R
    out.push([i, arr[i], land, hand])
  }
  return out
}

// Enumerate all valid period-length siteswaps averaging to ballCount.
// Backtracking with occupancy set. Prunes via sum feasibility bounds.
const NODE_CAP = 20000
export function jugglGenerate(period, ballCount) {
  if (!isNonNegInt(period) || period <= 0) return NAN()
  if (!isNonNegInt(ballCount)) return NAN()
  const total = period * ballCount
  const maxThrow = total // upper bound; further pruning below
  const results = []
  const occupied = new Set()
  const stack = new Array(period)
  let nodes = 0
  let fuelExceeded = false

  function recurse(beat, remaining) {
    if (fuelExceeded) return
    if (nodes > NODE_CAP) { fuelExceeded = true; return }
    nodes++
    if (beat === period) {
      results.push(stack.slice())
      return
    }
    const beatsLeft = period - beat
    const minThrow = Math.max(0, remaining - maxThrow * (beatsLeft - 1))
    const maxT = Math.min(maxThrow, remaining)
    for (let s = minThrow; s <= maxT; s++) {
      const land = (beat + s) % period
      if (occupied.has(land)) continue
      occupied.add(land)
      stack[beat] = s
      recurse(beat + 1, remaining - s)
      occupied.delete(land)
      if (fuelExceeded) return
    }
  }
  recurse(0, total)
  if (fuelExceeded) return FUEL_BUDGET()
  return results
}

// ── install into env ───────────────────────────────────────────────────

export function installJuggle(env) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  def('juggle/valid?', jugglValid, 'read')
  def('juggle/balls', jugglBalls, 'read')
  def('juggle/max-throw', jugglMaxThrow, 'read')
  def('juggle/state', jugglState, 'read')
  def('juggle/simulate', jugglSimulate, 'read')
  def('juggle/generate', jugglGenerate, 'read')

  return env
}

export default installJuggle
