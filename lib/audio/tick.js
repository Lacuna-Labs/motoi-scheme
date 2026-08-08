import { isList, seqVerb } from '../base/list.js'
// tick.js — beat-relative oscillators for scoring music-driven animation.
//
// Doctrine (Alfred, 2026-07-16): pure math over a phase parameter (0..1).
// No audio state, no clock. Callers pass in the current phase and get
// back a scalar in some range. Kid-composable: `(tick/sine 0.25)` returns
// 1 (peak of a sine), `(tick/pulse 0.6 0.5)` returns 0 (past duty cycle).


// ── inline registration metadata (2026-07-22) ────────────────────
// See engineering/HOW-TO-REGISTER-A-VERB.md.
export const VERBS = [
  "tick/ease",
  "tick/lissajous",
  "tick/mod-n",
  "tick/osc",
  "tick/pattern",
  "tick/phase",
  "tick/pulse",
  "tick/sine",
  "tick/triangle",
]
export const LAZY = false

export function installTick(env, fuel) {
  const def = (n, f, perm = 'read') => env.define(n, seqVerb(f), { perm })

  // (tick/sine phase) → -1..1. Phase is 0..1 for one full cycle.
  def('tick/sine', (phase) => Math.sin(phase * 2 * Math.PI))

  // (tick/osc phase amp?) → -amp..amp. Amplitude scales the sine.
  def('tick/osc', (phase, amp) => Math.sin(phase * 2 * Math.PI) * (amp ?? 1))

  // (tick/pulse phase duty?) → 1 while phase < duty, else 0. Default duty 0.5.
  def('tick/pulse', (phase, duty) => {
    const d = duty ?? 0.5
    const p = ((phase % 1) + 1) % 1
    return p < d ? 1 : 0
  })

  // (tick/ease phase) — smoothstep 0..1 over 0..1 phase.
  def('tick/ease', (phase) => {
    const t = Math.max(0, Math.min(1, phase))
    return t * t * (3 - 2 * t)
  })

  // (tick/phase t period) — reduce absolute time t to phase in [0, 1).
  def('tick/phase', (t, period) => {
    if (!period) return 0
    return ((t / period) % 1 + 1) % 1
  })

  // (tick/triangle phase amp?) → -amp..amp. Linear ramp up 0..0.5, then
  // ramp down 0.5..1. Amplitude scales the peak.
  def('tick/triangle', (phase, amp) => {
    const a = amp ?? 1
    const p = ((phase % 1) + 1) % 1
    // 0..0.5 → -a..+a linearly; 0.5..1 → +a..-a linearly.
    const v = p < 0.5 ? (-1 + 4 * p) : (3 - 4 * p)
    return v * a
  })

  // (tick/mod-n phase n) → integer in 0..n-1. Bucket the phase into n
  // equal slices; useful for step-sequencer indexing.
  def('tick/mod-n', (phase, n) => {
    const nn = Math.max(1, n | 0)
    const p = ((phase % 1) + 1) % 1
    return Math.min(nn - 1, Math.floor(p * nn))
  })

  // (tick/lissajous phase a b delta?) → (x y). Classic parametric
  // Lissajous curve at time = phase. a and b are frequency ratios;
  // delta is the phase offset for the Y channel (radians).
  def('tick/lissajous', (phase, a, b, delta) => {
    const A = a ?? 1
    const B = b ?? 1
    const d = delta ?? 0
    const t = phase * 2 * Math.PI
    return [Math.sin(A * t + d), Math.sin(B * t)]
  })

  // (tick/pattern phase steps) → the item in steps at phase-selected
  // position. steps is a list; the phase indexes uniformly into it.
  // If steps is empty, returns null.
  def('tick/pattern', (phase, steps) => {
    if (!isList(steps) || steps.length === 0) return null
    const p = ((phase % 1) + 1) % 1
    return steps[Math.min(steps.length - 1, Math.floor(p * steps.length))]
  })

  return env
}

export default installTick
