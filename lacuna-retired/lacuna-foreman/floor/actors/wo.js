// actors/wo.js — THE WORK ORDERS (lane F5-BC; THE-FLOOR-5.0 §2.1 `wo`; A2 §3.5; A4 V-039; RULINGS §1(b) C-26 adds `wo` to
// the record table). Owns: a work order's record tail (for whom, the goal's first 200 characters, who filed it, its run, its
// result), its six states as `wo.state` writes them (queued · waiting-brain · running · done · failed · parked), its
// ceremonies and its pose (a hollow star on the queue arc while it waits; not drawn once its run is on the floor).
// Refuses: a guessed state, the owner's words beyond the goal. Implements: A2 §3.5; A4 V-039. Invariants (design §18): none
// of its own. Faults (§16): none.

import { blankPose, CH, FLAG } from '../keyframe.js'
import { rc } from '../curves.js'
import { HUE, ceremonyOf } from '../vocabulary.js'

export const KIND = 'wo'
export const PERIOD_S = 60
export const STATES = Object.freeze(['queued', 'waiting-brain', 'running', 'done', 'failed', 'parked'])
export const LIGHTS = Object.freeze({})
export const COUNTERS = Object.freeze([])
export const REACTS = Object.freeze(['wo.filed', 'wo.state'])
/** States a tick never leaves without an event (actors/index.js skips them on a tick). */
export const FINAL = new Set(['done', 'failed'])
export const TRANSITIONS = Object.freeze([['(none)', 'queued', 'worker.file'], ['*', 'queued', 'worker.file'], ['*', 'waiting-brain', 'worker.file'], ['*', 'running', 'worker.bud'], ['*', 'parked', 'run.stop']])

/** @return {!Object} the tail (A2 §5.2 wo row) */
export function create(id, logT, ev) {
  return { for: null, goal: null, from: null, run: null, result: null, woState: 'queued', filedT: null, stateT: null, eta: null }
}

/** Folds one event into the tail (A2 §3.5's Fold column). */
export function apply(rec, ev, ctx) {
  const d = ev.data ?? {}
  if (ev.kind === 'wo.filed') Object.assign(rec, { for: d.for ?? rec.for, goal: String(d.goal ?? rec.goal ?? '').slice(0, 200) || null, from: d.from ?? rec.from, eta: d.eta ?? rec.eta, filedT: ctx.logT, woState: 'queued', stateT: ctx.logT })
  if (ev.kind === 'wo.state') Object.assign(rec, { woState: STATES.includes(d.state) ? d.state : rec.woState, run: d.run ?? rec.run, result: d.result ?? rec.result, for: d.for ?? rec.for, stateT: ctx.logT })
}

/** The state at `logT`: what `wo.state` last wrote (A2 §3.5). */
export function classify(rec, logT) {
  return { state: rec.woState, cause: rec.result ?? (rec.run ? `run ${rec.run}` : null), since: rec.stateT ?? logT }
}

/** The ceremony of a transition. */
export const transitions = (from, to) => ceremonyOf(TRANSITIONS, from, to)

/** The pose at `logT`: a hollow star on the queue arc while queued (A4 V-039); not drawn otherwise. */
export function pose(rec, logT) {
  const p = blankPose()
  const st = rec.state ?? 'queued'
  const dt = Math.max(0, logT - (rec.since ?? logT))
  p[CH.x] = rec.pos.x
  p[CH.z] = rec.pos.z
  p[CH.y] = rec.slot?.y ?? 26.8
  p[CH.hue] = HUE['N-GHOST']
  p[CH.edgeHue] = HUE['N-GHOST']
  p[CH.hollow] = 1
  p[CH.scale] = 0.6
  if (st === 'queued' || st === 'waiting-brain') p[CH.l] = 0.7 + 0.05 * rc(0.25 * dt)
  else p[CH.flags] &= ~FLAG.drawn
  return p
}
