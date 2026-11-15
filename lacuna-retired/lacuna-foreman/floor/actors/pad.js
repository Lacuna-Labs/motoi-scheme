// actors/pad.js — THE HANDS' PAD, the jail (lane F5-BC; THE-FLOOR-5.0 §3.5; A3 §4.6, §5.4; A4 §2.5 V-070…V-076; RULINGS M-10,
// C-32, C-43). Owns: a pad's record tail (the open tickets with their deadlines and tries, the last close), its eight states
// (idle, ticket-open, resent, press-held, receipt, refused, deadline, crash), its transitions to A3 §5.4's ids, and the pose
// (a 3 × 3 square at the ring's inner edge; the dotted neutral white intent line that draws in 240 ms and marches only once
// the ticket is open; the deadline ring draining clockwise and linearly over the real deadline, R 2.2; a press ring with no
// fill at 0.5 Hz; the receipt's collapse in 240 ms; one red flash on a refusal; the red rim of a crash until the ack). One
// pad per ring, created on `run.start` by actors/worker.js, which writes the tickets. Refuses: an eased deadline ring (a ring
// is a clock), a re-send on an act, a deadline on a press, a secret in an argument (args are shown by path). Implements:
// A3 §4.6, §5.4. Invariants (design §18): "an act is never re-sent". Faults (§16): none.

import { blankPose, CH, FLAG } from '../keyframe.js'
import { enter, blink, clamp01 } from '../curves.js'
import { HUE, ceremonyOf } from '../vocabulary.js'

export const KIND = 'pad'
export const PERIOD_S = 10
export const STATES = Object.freeze(['idle', 'ticket-open', 'resent', 'press-held', 'receipt', 'refused', 'deadline', 'crash'])
export const LIGHTS = Object.freeze({ ring: ['draining', 'press', 'full', 'red'] })
export const COUNTERS = Object.freeze(['slotsUsed', 'slotsTotal', 'closes'])
/** The pad reacts to nothing itself: its run's module feeds it (A3 §4.6). */
export const REACTS = Object.freeze([])
/** States a tick never leaves without an event (actors/index.js skips them on a tick). */
export const FINAL = new Set(['idle'])
export const TRANSITIONS = Object.freeze([
  ['(none)', 'idle', 'pad.idle'], ['*', 'ticket-open', 'pad.ticket'], ['*', 'resent', 'pad.resend'], ['*', 'press-held', 'pad.press'],
  ['*', 'receipt', 'pad.receipt'], ['*', 'refused', 'pad.refused'], ['*', 'deadline', 'pad.deadline'], ['*', 'crash', 'pad.crash'],
  ['*', 'idle', 'pad.idle'],
])
/** The pad's side and the deadline ring's radius (A4 V-070, V-072). */
export const SIDE = 3
export const RING_R = 2.2

/** @return {!Object} the tail (A3 §3.2 hands-pad row) */
export function create(id, logT, ev) {
  return { runId: id.slice(4), tickets: [], lastClose: null, slotsUsed: 0, slotsTotal: null, startT: logT, closes: 0, ackT: null }
}

/** A pad applies no event of its own (its run's `apply` writes `tickets` and `lastClose`). */
export function apply(rec, ev, ctx) {}

/** The state at `logT` (A3 §4.6). */
export function classify(rec, logT) {
  const lc = rec.lastClose
  if (lc && lc.exit === 30 && (rec.ackT == null || logT < rec.ackT + 2)) return { state: 'crash', cause: `crash: ${lc.op ?? 'hand'}`, since: lc.at }
  const full = rec.tickets.find((t) => t.deadlineAt != null && logT >= t.deadlineAt)
  if ((lc && lc.exit === 15 && logT - lc.at < 3)) return { state: 'deadline', cause: `deadline ${lc.op ?? ''} ${Math.round((lc.ms ?? 0) / 1000)} s`.trim(), since: lc.at }
  if (full) return { state: 'deadline', cause: `deadline ${full.op ?? ''} ${Math.round(full.deadlineAt - full.sentAt)} s`.trim(), since: full.deadlineAt }
  if (lc && lc.exit === 12 && logT - lc.at < 3) return { state: 'refused', cause: `refused: ${lc.op ?? ''}`.trim(), since: lc.at }
  if (lc && lc.exit === 0 && logT - lc.at < 0.8 && rec.tickets.length === 0) return { state: 'receipt', cause: null, since: lc.at }
  const newest = rec.tickets[rec.tickets.length - 1]
  if (newest) {
    if (newest.waiting || newest.deadlineAt == null) return { state: 'press-held', cause: 'press waiting', since: newest.sentAt }
    if (newest.tries >= 2 && newest.kind !== 'act') return { state: 'resent', cause: `resent as ${newest.ticket}`, since: newest.sentAt }
    return { state: 'ticket-open', cause: `${newest.op ?? 'hand'} ${newest.kind}`, since: newest.sentAt }
  }
  return { state: 'idle', cause: null, since: lc ? lc.at + (lc.exit === 0 ? 0.8 : 3) : rec.startT }
}

/** The ceremony of a transition (A3 §5.4). */
export const transitions = (from, to) => ceremonyOf(TRANSITIONS, from, to)

/** The pose at `logT` (A3 §4.6): `fill` is the deadline remaining (linear), `motion` the intent line's draw then dash phase. */
export function pose(rec, logT) {
  const p = blankPose()
  const st = rec.state ?? 'idle'
  const dt = Math.max(0, logT - (rec.since ?? logT))
  const newest = rec.tickets[rec.tickets.length - 1]
  p[CH.x] = rec.pos.x
  p[CH.z] = rec.pos.z
  p[CH.y] = 0
  p[CH.hue] = HUE['N-WHITE']
  p[CH.edgeHue] = HUE['N-STEEL']
  p[CH.l] = 0.4
  switch (st) {
    case 'idle': p[CH.l] = 0.4 + (rec.lastClose ? 0.4 * (1 - clamp01(dt / 1.2)) : 0); break
    case 'ticket-open':
    case 'resent': {
      p[CH.l] = 1
      p[CH.ring] = RING_R
      p[CH.motion] = dt < 0.24 ? enter(dt / 0.24) : (dt - 0.24) % 1
      p[CH.fill] = newest ? clamp01((newest.deadlineAt - logT) / Math.max(1e-6, newest.deadlineAt - newest.sentAt)) : 0
      if (newest && p[CH.fill] <= 0.1) p[CH.flags] |= FLAG.red
      break
    }
    case 'press-held': p[CH.l] = 1; p[CH.ring] = RING_R; p[CH.blink] = blink(0.5, dt); p[CH.edgeHue] = p[CH.blink] ? HUE.AMBER : HUE['N-DARK']; p[CH.flags] |= FLAG.press; break
    case 'receipt': p[CH.l] = 1; p[CH.ring] = RING_R * (1 - enter(clamp01(dt / 0.24))); p[CH.motion] = 1 - clamp01((dt - 0.3) / 0.5); break
    case 'refused': p[CH.l] = 0.6; if (dt < 0.24) { p[CH.edgeHue] = HUE.RED; p[CH.blink] = 1; p[CH.flags] |= FLAG.red } break
    case 'deadline': p[CH.l] = 0.6; p[CH.ring] = RING_R; p[CH.fill] = 0; p[CH.edgeHue] = HUE.RED; p[CH.flags] |= FLAG.red; p[CH.motion] = 1 - clamp01(dt / 1.2); break
    case 'crash': p[CH.l] = dt < 0.15 ? 1 : 0.2; p[CH.edgeHue] = HUE.RED; p[CH.blink] = 1; p[CH.flags] |= FLAG.red; if (rec.ackT != null) p[CH.l] *= 1 - clamp01((logT - rec.ackT) / 2); break
    default: break
  }
  if (rec.tickets.length > 1) p[CH.scale] = 1 + 0.1 * Math.min(2, rec.tickets.length - 1)
  return p
}
