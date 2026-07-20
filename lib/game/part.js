// part.js — pure animation functions per Alfred's decision (2026-07-16).
//
// Doctrine (Alfred LOCK): part/* are PURE ANIMATION FUNCTIONS.
// (part/twist ...) returns a function; (part/wave ...) returns a function.
// The returned function accepts a phase parameter (0..1 typically) and
// returns a transform value (angle, offset, tuple).
//
// This makes part/* pure and testable without a rigged-character model.
// A downstream module can bind these to character parts by threading
// their outputs through a sprite transform each frame.

import { Sym } from '../../src/reader.js'
import { seededRandom } from './misc.js'

// Small helper for the returned functions — they carry a tag so callers
// can `procedure?` them and also introspect via `(car (fn))` if wrapped.
// We use closures directly since (procedure?) already covers them.

export function installPart(env, fuel) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  // (part/wave amp?) → (fn phase) → offset. amplitude default 1.
  def('part/wave', (amp) => (phase) => Math.sin((phase ?? 0) * Math.PI * 2) * (amp ?? 1))

  // (part/nod amp?) → (fn phase) → up/down offset via half-sine.
  def('part/nod', (amp) => (phase) => Math.abs(Math.sin((phase ?? 0) * Math.PI)) * (amp ?? 1))

  // (part/turn from to?) → (fn phase) → linearly interpolated angle.
  def('part/turn', (from, to) => {
    const f = from ?? 0, t = to ?? Math.PI * 2
    return (phase) => f + (t - f) * (phase ?? 0)
  })

  // (part/tilt max-angle?) → (fn phase) → tilt in radians via sine.
  def('part/tilt', (maxAngle) => (phase) => Math.sin((phase ?? 0) * Math.PI * 2) * (maxAngle ?? 0.3))

  // (part/step stride?) → (fn phase) → alternating stride offset.
  def('part/step', (stride) => (phase) => {
    const p = ((phase ?? 0) % 1 + 1) % 1
    return (p < 0.5 ? p * 2 : (1 - p) * 2) * (stride ?? 1)
  })

  // (part/reach distance?) → (fn phase) → extended reach 0..distance.
  def('part/reach', (distance) => (phase) => (phase ?? 0) * (distance ?? 1))

  // (part/point angle?) → (fn phase) → constant angle. angle default 0.
  def('part/point', (angle) => (_phase) => angle ?? 0)

  // (part/raise amp?) → (fn phase) → rising offset (0..amp).
  def('part/raise', (amp) => (phase) => (phase ?? 0) * (amp ?? 1))

  // (part/lower amp?) → (fn phase) → falling offset (amp..0).
  def('part/lower', (amp) => (phase) => (1 - (phase ?? 0)) * (amp ?? 1))

  // (part/shake amp?) → (fn phase) → random jitter in [-amp, amp].
  // BUG-3 fix (Zane-2, 2026-07-17): route through seededRandom so
  // (with-seed …) makes the returned jitter fn deterministic. Previously
  // Math.random directly, defeating replay for any animation that used
  // shake.
  def('part/shake', (amp) => (_phase) => (seededRandom() - 0.5) * 2 * (amp ?? 1))

  // (part/breathe amp?) → (fn phase) → slow half-cycle for breathing.
  def('part/breathe', (amp) => (phase) => (Math.sin((phase ?? 0) * Math.PI * 2) * 0.5 + 0.5) * (amp ?? 1))

  // (part/lean angle?) → (fn phase) → gradual tilt building over phase.
  def('part/lean', (angle) => (phase) => (angle ?? 0.5) * (phase ?? 0))

  // (part/look-toward target-x target-y?) → (fn phase pos-x pos-y) → angle.
  // If phase-only called, returns a fn that takes (phase, x, y).
  def('part/look-toward', (tx, ty) => (_phase, x, y) => Math.atan2((ty ?? 0) - (y ?? 0), (tx ?? 0) - (x ?? 0)))

  // (part/shrug amp?) → (fn phase) → up-then-down shoulder motion.
  def('part/shrug', (amp) => (phase) => {
    const p = ((phase ?? 0) % 1 + 1) % 1
    return (p < 0.5 ? p * 2 : (1 - p) * 2) * (amp ?? 1)
  })

  // (part/bow depth?) → (fn phase) → half-sine forward bow.
  def('part/bow', (depth) => (phase) => Math.sin((phase ?? 0) * Math.PI) * (depth ?? 0.5))

  // (part/sway amp?) → (fn phase) → gentle horizontal sway.
  def('part/sway', (amp) => (phase) => Math.sin((phase ?? 0) * Math.PI * 2) * (amp ?? 0.5))

  // (part/expression name?) → (fn phase) → a symbol representing an
  // expression state. For CORE, always returns the given symbol.
  def('part/expression', (name) => (_phase) => (name instanceof Sym ? name : new Sym(String(name ?? 'neutral'))))

  return env
}

export default installPart
