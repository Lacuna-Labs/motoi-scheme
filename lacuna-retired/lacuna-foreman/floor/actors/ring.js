// actors/ring.js — THE WORK RINGS, the unit of work on the floor (lane F5-BC; THE-FLOOR-5.0 §3.5; A3 §4.4, §5.4; A4 §2.4;
// RULINGS M-09, C-81). Owns: a ring's record tail (its run, members, job weight, radius, plan, center, the step mirror), its
// nine states read from its run's record, the radius `R = max(12, min(26, 14 + 2.8 (N − 1) + 3.2 (W − 1)))`, its
// transitions to A3 §5.4's ids, and the pose (the clockwise draw in 300 ms, the dashes marching only while the run works,
// the pips as records, the amber tail past plan, the seal's close in 300 ms, the solid red close in 240 ms then 1.5 Hz × 3).
// A queued run has no ring (M-09); the ring is created on `run.start` by actors/worker.js. Refuses: a radius under 12 or over
// 26, a reflow that moves a seated member (the layout moves the ring and its members as one body), green except the seal,
// a pip from a timer. Implements: A3 §4.4, §5.4. Invariants (design §18): "pips are records, never a timer". Faults (§16): none.

import { blankPose, CH, FLAG } from '../keyframe.js'
import { enter, blink, clamp01 } from '../curves.js'
import { HUE, ceremonyOf } from '../vocabulary.js'

export const KIND = 'ring'
export const PERIOD_S = 10
export const STATES = Object.freeze(['drawing', 'open', 'held', 'stalled-step', 'past-plan', 'reflowing', 'sealed', 'closed-red', 'gone'])
export const LIGHTS = Object.freeze({ pip: ['hollow', 'lit', 'running', 'failed', 'amber', 'stalled'] })
export const COUNTERS = Object.freeze(['n', 'w', 'r', 'plan', 'step'])
/** The ring reacts to nothing itself: its run's module feeds it (A3 §4.4). */
export const REACTS = Object.freeze([])
/** States a tick never leaves without an event (actors/index.js skips them on a tick). */
export const FINAL = new Set(['gone'])
export const TRANSITIONS = Object.freeze([
  ['(none)', 'drawing', 'ring.draw'], ['drawing', 'open', 'ring.open'], ['*', 'held', 'ring.hold'], ['*', 'stalled-step', 'ring.stall'],
  ['*', 'past-plan', 'ring.overrun'], ['*', 'reflowing', 'ring.reflow'], ['*', 'sealed', 'ring.seal'], ['*', 'closed-red', 'ring.close'],
  ['*', 'gone', 'ring.gone'], ['*', 'open', 'ring.open'],
])
/** The 18-unit buffer between rings' edges (master §3.5). */
export const BUFFER = 18
/** Dash 0.55, gap 0.38 (floorProcs.js:201, kept). */
export const DASH = Object.freeze({ dash: 0.55, gap: 0.38 })

/**
 * The radius: `max(12, min(26, 14 + 2.8 (N − 1) + 3.2 (W − 1)))` (master §3.5; A3 §4.4).
 * @param {number} n workers inside @param {number} w job weight
 * @return {number}
 */
export const radiusOf = (n, w) => Math.max(12, Math.min(26, 14 + 2.8 * (Math.max(1, Number.isFinite(n) ? n : 1) - 1) + 3.2 * (Math.max(1, Number.isFinite(w) ? w : 1) - 1)))

/** @return {!Object} the tail (A3 §3.2 ring row) */
export function create(id, logT, ev) {
  return { runId: id.slice(5), n: 1, w: 1, r: 12, members: [], step: 0, plan: 0, center: { x: 0, z: 0 }, reflowT: null, reflowFor: null, startT: logT, seal: null, close: null, failedStep: null, lastStepT: null }
}

/** A ring applies no event of its own (its run's `apply` writes its tail). */
export function apply(rec, ev, ctx) {}

/** The state at `logT`, read from the run's record (A3 §4.4). */
export function classify(rec, logT, registry) {
  const run = registry?.get(rec.runId)
  const rs = run?.state ?? null
  const goneAt = rec.close != null ? (run?.ackT != null ? run.ackT + 2 : null)
    : rec.seal != null ? rec.seal + 1 + (run?.flightS ?? 0.7) + 1.2
    : rs === 'stopped' && run?.outcome === 'stopped' ? run.since + 0.4 + (run.flightS ?? 0.7) + 1.2 : null
  if (goneAt != null && logT >= goneAt) return { state: 'gone', cause: null, since: goneAt }
  if (rec.close != null) return { state: 'closed-red', cause: run?.cause ?? null, since: rec.close }
  if (rec.seal != null) return { state: 'sealed', cause: null, since: rec.seal }
  if (rs == null || rs === 'budding' || rs === 'falling' || (run?.landT != null && logT < run.landT + 0.3)) return { state: 'drawing', cause: null, since: run?.landT ?? rec.startT }
  if (rec.reflowT != null && logT - rec.reflowT < 0.24) return { state: 'reflowing', cause: `made room for ${rec.reflowFor ?? ''}`.trim(), since: rec.reflowT }
  if (rs === 'waiting-press' || rs === 'stopped' || rs === 'unknown') return { state: 'held', cause: run.cause ?? null, since: run.since }
  if (rs === 'stalled') return { state: 'stalled-step', cause: run.cause ?? null, since: run.since }
  if (rec.plan > 0 && rec.step > rec.plan) return { state: 'past-plan', cause: `past plan by ${rec.step - rec.plan}`, since: rec.lastStepT ?? logT }
  return { state: 'open', cause: null, since: rec.state === 'open' && rec.since != null ? rec.since : (run?.landT ?? rec.startT) + 0.3 }
}

/** The ceremony of a transition (A3 §5.4). */
export const transitions = (from, to) => ceremonyOf(TRANSITIONS, from, to)

/** The pose at `logT` (A3 §4.4): `ring` carries R, `fill` the done arc, `motion` the draw or dash phase. */
export function pose(rec, logT) {
  const p = blankPose()
  const st = rec.state ?? 'drawing'
  const dt = Math.max(0, logT - (rec.since ?? logT))
  p[CH.x] = rec.center.x
  p[CH.z] = rec.center.z
  p[CH.y] = 0
  p[CH.ring] = radiusOf(rec.n, rec.w)
  p[CH.hue] = HUE['N-STEEL']
  p[CH.edgeHue] = HUE['N-STEEL']
  p[CH.l] = 0.6
  p[CH.fill] = rec.plan > 0 ? clamp01(rec.step / Math.max(rec.plan, rec.step)) : 0
  p[CH.flags] |= FLAG.dashed
  switch (st) {
    case 'drawing': p[CH.motion] = enter(clamp01(dt / 0.3)); break
    case 'open': p[CH.motion] = dt % 1; p[CH.blink] = 0.7 + 0.3 * Math.sin(2 * Math.PI * 0.25 * dt) ** 2; break
    case 'held': p[CH.l] = 0.4; p[CH.flags] |= FLAG.frozen; break
    case 'stalled-step': p[CH.blink] = blink(0.5, dt); p[CH.edgeHue] = HUE.AMBER; p[CH.flags] |= FLAG.amber | FLAG.frozen; break
    case 'past-plan': p[CH.motion] = dt % 1; p[CH.edgeHue] = HUE.AMBER; p[CH.flags] |= FLAG.amber; break
    case 'reflowing': p[CH.motion] = enter(clamp01(dt / 0.24)); p[CH.flags] |= FLAG.mover; break
    case 'sealed': { const close = clamp01(dt / 0.3); p[CH.motion] = 1 - close; p[CH.flags] &= ~FLAG.dashed; if (dt > 0.3) { p[CH.hue] = HUE.GREEN; p[CH.scale] = 1 + 0.15 * enter(clamp01((dt - 0.3) / 0.5)); p[CH.l] = 1 - enter(clamp01((dt - 0.3) / 0.5)) } break }
    case 'closed-red': { const past = dt - 0.15; p[CH.flags] &= ~FLAG.dashed; p[CH.flags] |= FLAG.red; p[CH.edgeHue] = HUE.RED; p[CH.hue] = HUE.RED; p[CH.blink] = past < 0.24 ? clamp01(past / 0.24) : dt < 0.39 + 2 ? blink(1.5, dt - 0.39) : 1; p[CH.l] = 1; break }
    case 'gone': p[CH.flags] &= ~FLAG.drawn; p[CH.l] = 0; break
    default: break
  }
  if (rec.failedStep != null && st !== 'gone') p[CH.flags] |= FLAG.red
  return p
}
