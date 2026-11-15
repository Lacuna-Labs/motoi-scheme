// actors/alert.js — THE ALERT MARKS (lane F5-BC; THE-FLOOR-5.0 §3.10; A3 §4.13, §5.5; A4 §2.12, §5.2; RULINGS C-76, C-78,
// C-80). Owns: an alert's record tail (its actor and fault id, level, count, the ack, the resolve, seen, the 21-sample
// history, flapping, its area, whether a flood hides it, whether it is the one flasher), its eight states (raised ·
// raised-steady · acknowledged · resolved-unseen · flapping · flood · off-screen · gone), its ceremonies and the pose of the
// mark on its actor (warn an amber triangle, page a red diamond; the one flasher blinks at its class, fail 1.5 Hz × 3 cycles
// then steady regardless (A4 §5.2), warn 0.6 Hz ≤ 5 s; every other mark steady; hatched when flapping; a ghost outline when
// resolved and unseen until seen or 60 s, then a 2 s fade). The rules that set these fields live in alarms.js. Refuses: a
// second flasher, a blink while flapping, a mark with no record. Implements: A3 §4.13, §5.5. Invariants (design §18): "at
// most one thing flashes". Faults (§16): none.

import { blankPose, CH, FLAG } from '../keyframe.js'
import { blink, clamp01 } from '../curves.js'
import { HUE, ceremonyOf } from '../vocabulary.js'

export const KIND = 'alert'
export const PERIOD_S = 5
export const STATES = Object.freeze(['raised', 'raised-steady', 'acknowledged', 'resolved-unseen', 'flapping', 'flood', 'off-screen', 'gone'])
export const LIGHTS = Object.freeze({ mark: ['triangle', 'diamond', 'hatched', 'ghost'] })
export const COUNTERS = Object.freeze(['count', 'flapPct'])
export const REACTS = Object.freeze(['alert.raise', 'alert.ack', 'alert.resolve'])
/** States a tick never leaves without an event (actors/index.js skips them on a tick). */
export const FINAL = new Set(['gone', 'acknowledged'])
export const TRANSITIONS = Object.freeze([
  ['(none)', '*', 'alert.raise'], ['*', 'raised', 'alert.raise'], ['*', 'acknowledged', 'alert.ack'], ['*', 'resolved-unseen', 'alert.ghost'], ['*', 'flapping', 'alert.flap'],
  ['*', 'flood', 'alert.flood'], ['resolved-unseen', 'gone', 'alert.seen'], ['*', 'gone', 'alert.seen'],
])
/** A resolved ghost lives until seen or 60 s (C-76), then fades 2 s. */
export const GHOST_S = 60

/** @return {!Object} the tail (A3 §3.2 alert row) */
export function create(id, logT, ev) {
  const m = id.match(/^alert:([^:]+):(.+)$/)
  return { actorId: m?.[1] ?? null, faultId: m?.[2] ?? id.slice(6), key: id.slice(6), level: 'warn', title: null, source: null, raisedT: null, count: 0, ackT: null, resolvedT: null, seen: false, seenT: null, history: [], flapPct: 0, flapping: false, area: 'floor', hidden: false, flasher: false, derived: false, at: { x: 0, z: 0 }, offScreen: false }
}

/** The raw `alert.*` events (alarms.js runs the rules and writes the derived fields). */
export function apply(rec, ev, ctx) {
  const t = ctx.logT
  const d = ev.data ?? {}
  if (ev.kind === 'alert.raise') { rec.level = d.level === 'crit' || d.level === 'page' ? 'page' : d.level === 'info' ? 'info' : 'warn'; rec.title = d.title ?? rec.title; rec.source = d.source ?? rec.source; rec.lastRaiseT = t }
  if (ev.kind === 'alert.ack') rec.ackT = t
  if (ev.kind === 'alert.resolve') rec.resolvedT = t
}

/** The state at `logT` (A3 §4.13). */
export function classify(rec, logT) {
  if (rec.resolvedT != null) {
    const faded = rec.seen ? (rec.seenT ?? rec.resolvedT) + 2 : rec.resolvedT + GHOST_S + 2
    if (logT >= faded) return { state: 'gone', cause: null, since: faded }
    return { state: 'resolved-unseen', cause: null, since: rec.resolvedT }
  }
  if (rec.raisedT == null) return { state: 'gone', cause: 'no raise', since: 0 }
  if (rec.hidden) return { state: 'flood', cause: `${rec.area} flood`, since: rec.state === 'flood' ? rec.since : logT }
  if (rec.flapping) return { state: 'flapping', cause: `flapping ${Math.round(rec.flapPct)}%`, since: rec.state === 'flapping' ? rec.since : logT }
  if (rec.ackT != null) return { state: 'acknowledged', cause: rec.count > 1 ? `×${rec.count}` : null, since: rec.ackT }
  if (rec.offScreen) return { state: 'off-screen', cause: rec.count > 1 ? `×${rec.count}` : null, since: rec.state === 'off-screen' ? rec.since : logT }
  if (rec.flasher) return { state: 'raised', cause: rec.count > 1 ? `×${rec.count}` : null, since: rec.state === 'raised' ? rec.since : rec.raisedT }
  return { state: 'raised-steady', cause: rec.count > 1 ? `×${rec.count}` : null, since: rec.state === 'raised-steady' ? rec.since : rec.raisedT }
}

/** The ceremony of a transition (A3 §5.5). */
export const transitions = (from, to) => ceremonyOf(TRANSITIONS, from, to)

/** The pose at `logT` (A3 §4.13; A4 V-160…V-170): `hue` and `flags` carry level and shape, `blink` the one flasher's blink. */
export function pose(rec, logT) {
  const p = blankPose()
  const st = rec.state ?? 'raised-steady'
  const page = rec.level === 'page'
  const dr = Math.max(0, logT - (rec.raisedT ?? logT))
  p[CH.x] = rec.at.x
  p[CH.z] = rec.at.z
  p[CH.y] = 3
  p[CH.scale] = 0.8
  p[CH.hue] = page ? HUE.RED : HUE.AMBER
  p[CH.edgeHue] = p[CH.hue]
  p[CH.flags] |= page ? FLAG.red : FLAG.amber
  p[CH.blink] = 1
  switch (st) {
    case 'raised': p[CH.flags] |= FLAG.flash; p[CH.blink] = page ? (dr < 2 ? blink(1.5, dr) : 1) : dr < 5 ? blink(0.6, dr) : 1; break
    case 'raised-steady': case 'off-screen': break
    case 'acknowledged': p[CH.l] = 0.8; break
    case 'resolved-unseen': p[CH.l] = 0.35; p[CH.hollow] = 1; p[CH.flags] |= FLAG.ghost; p[CH.hue] = HUE['N-GHOST']; if (rec.seen) p[CH.l] *= 1 - clamp01((logT - (rec.seenT ?? logT)) / 2); else if (logT > rec.resolvedT + GHOST_S) p[CH.l] *= 1 - clamp01((logT - rec.resolvedT - GHOST_S) / 2); break
    case 'flapping': p[CH.flags] |= FLAG.hatched; break
    case 'flood': p[CH.flags] &= ~FLAG.drawn; break
    case 'gone': p[CH.flags] &= ~FLAG.drawn; p[CH.l] = 0; break
    default: break
  }
  p[CH.fill] = Math.min(1, rec.count / 10)
  return p
}
