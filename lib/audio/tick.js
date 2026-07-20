// tick.js — beat-relative oscillators for scoring music-driven animation.
//
// Doctrine (Alfred, 2026-07-16): pure math over a phase parameter (0..1).
// No audio state, no clock. Callers pass in the current phase and get
// back a scalar in some range. Kid-composable: `(tick/sine 0.25)` returns
// 1 (peak of a sine), `(tick/pulse 0.6 0.5)` returns 0 (past duty cycle).

export function installTick(env, fuel) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

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

  return env
}

export default installTick
