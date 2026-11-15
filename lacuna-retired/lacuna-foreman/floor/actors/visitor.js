// actors/visitor.js — THE VISITORS on the family edge (lane F5-BC; THE-FLOOR-5.0 §3.7, R6; A3 §4.11, §5.5; A4 §2.10 V-136…V-139;
// RULINGS C-50, C-79, Q-D9). Owns: a visitor's record tail (the name the room gave, the device, the mind it talks to, the
// games it made), its four states (present · talking · made · gone: gone on `visitor.leave`, else 10 min without a turn),
// transitions and poses (a lantern 1 × 1.6 on the family edge, L 0.5 present, 0.9 + 0.1 breath talking, a sheet landing on
// the mind's shelf when a game is made, hollow when untested). Refuses: customer-identifying text beyond the name, lavender
// (the owner's hue), a lantern lit with no turn. Implements: A3 §4.11, §5.5. Invariants (design §18): "no lavender on a
// visitor". Faults (§16): none.

import { blankPose, CH, FLAG } from '../keyframe.js'
import { enter, exit, rc, clamp01 } from '../curves.js'
import { HUE, ceremonyOf } from '../vocabulary.js'

export const KIND = 'visitor'
/** Leaves after 10 min without a turn (C-50). */
export const PERIOD_S = 600
export const STATES = Object.freeze(['present', 'talking', 'made', 'gone'])
export const LIGHTS = Object.freeze({ lantern: ['dim', 'lit'] })
export const COUNTERS = Object.freeze(['turns', 'made'])
export const REACTS = Object.freeze(['visitor.join', 'visitor.turn', 'visitor.made', 'visitor.leave'])
/** States a tick never leaves without an event (actors/index.js skips them on a tick). */
export const FINAL = new Set(['gone'])
export const TRANSITIONS = Object.freeze([['(none)', 'present', 'visitor.join'], ['*', 'talking', 'visitor.talk'], ['*', 'made', 'visitor.made'], ['*', 'gone', 'visitor.leave'], ['*', 'present', 'visitor.join']])
const LEAVE_S = 600

/** @return {!Object} the tail (A3 §3.2 visitor row) */
export function create(id, logT, ev) {
  return { name: null, device: null, joinT: null, turnT: null, turnOpen: null, talkingTo: null, madeT: null, made: [], leaveT: null, turns: 0 }
}

/** Folds one event into the tail (A2 §3.8's Fold column). */
export function apply(rec, ev, ctx) {
  const t = ctx.logT
  const d = ev.data ?? {}
  switch (ev.kind) {
    case 'visitor.join': rec.name = d.name ?? rec.name; rec.device = d.device ?? rec.device; rec.joinT = t; rec.leaveT = null; break
    case 'visitor.turn':
      rec.turns++
      rec.turnT = t
      rec.talkingTo = d.mind ?? rec.talkingTo
      rec.turnOpen = d.phase === 'done' ? null : { mind: d.mind ?? null, since: t }
      if (d.phase === 'done') rec.turnDoneT = t
      break
    case 'visitor.made': rec.madeT = t; rec.made = rec.made.concat({ file: d.file ?? null, tested: d.tested === true, mind: d.mind ?? rec.talkingTo, at: t }).slice(-12); break
    case 'visitor.leave': rec.leaveT = t; rec.turnOpen = null; break
    default: break
  }
}

/** The state at `logT` (A3 §4.11; C-50). */
export function classify(rec, logT) {
  if (rec.leaveT != null) return { state: 'gone', cause: 'left', since: rec.leaveT }
  const lastSeen = Math.max(rec.joinT ?? 0, rec.turnT ?? 0)
  if (logT - lastSeen >= LEAVE_S) return { state: 'gone', cause: `no turn for ${Math.round((logT - lastSeen) / 60)} min`, since: lastSeen + LEAVE_S }
  if (rec.madeT != null && logT - rec.madeT < 0.9) return { state: 'made', cause: rec.made[rec.made.length - 1]?.file ?? null, since: rec.madeT }
  if (rec.turnOpen || (rec.turnT != null && logT - rec.turnT < 60)) return { state: 'talking', cause: `talking to ${rec.talkingTo ?? ''}`.trim(), since: rec.state === 'talking' ? rec.since : rec.turnOpen?.since ?? rec.turnT }
  return { state: 'present', cause: null, since: rec.state === 'present' ? rec.since : Math.max(rec.joinT ?? 0, rec.turnT != null ? rec.turnT + 60 : 0) }
}

/** The ceremony of a transition (A3 §5.5). */
export const transitions = (from, to) => ceremonyOf(TRANSITIONS, from, to)

/** The pose at `logT` (A3 §4.11; A4 V-136…V-139). */
export function pose(rec, logT) {
  const p = blankPose()
  const st = rec.state ?? 'present'
  const dt = Math.max(0, logT - (rec.since ?? logT))
  p[CH.x] = rec.pos.x
  p[CH.z] = rec.pos.z
  p[CH.y] = 0.8
  p[CH.hue] = HUE['N-STAR']
  p[CH.edgeHue] = HUE['N-STAR']
  switch (st) {
    case 'present': p[CH.l] = 0.5 * enter(clamp01((logT - (rec.joinT ?? logT)) / 0.4)); break
    case 'talking': p[CH.l] = 0.9 + 0.1 * rc(0.25 * dt); break
    case 'made': p[CH.l] = 1; p[CH.motion] = clamp01(dt / 0.9); p[CH.hollow] = rec.made[rec.made.length - 1]?.tested ? 0 : 1; break
    case 'gone': p[CH.l] = 0.5 * (1 - exit(clamp01(dt / 0.34))); if (dt >= 0.34) p[CH.flags] &= ~FLAG.drawn; break
    default: break
  }
  return p
}
