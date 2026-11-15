// actors/owner.js — THE OWNER MARKER (lane F5-BC; THE-FLOOR-5.0 §3.7; A3 §4.14, §5.5; A4 V-175, V-176; A5 §2.26; RULINGS
// Q-A8). Owns: the owner's record tail (present, the quiet seconds, the last turn, the presses waiting, the screen and the
// road the turn came by), the three states (present · quiet · press-waiting), transitions and the pose (the desk hexagon's
// lavender edge, L 0.8 present and 0.4 quiet, an amber tick per waiting press at 0.5 Hz then steady after 5 s, which never
// counts as the one flasher). Refuses: a customer name, session text, lavender on anyone else. Implements: A3 §4.14, §5.5.
// Invariants (design §18): "lavender is the owner's alone". Faults (§16): none.

import { blankPose, CH, FLAG } from '../keyframe.js'
import { blink } from '../curves.js'
import { HUE, ceremonyOf } from '../vocabulary.js'

export const KIND = 'owner'
export const PERIOD_S = 60
export const STATES = Object.freeze(['present', 'quiet', 'press-waiting'])
export const LIGHTS = Object.freeze({ edge: ['dim', 'lit', 'press'] })
export const COUNTERS = Object.freeze(['quietS', 'pressesWaiting', 'turns'])
export const REACTS = Object.freeze(['owner.quiet', 'owner.present', 'owner.press', 'owner.flag', 'owner.read', 'owner.update', 'press.wait', 'press.pressed', 'mind.turn.start'])
export const TRANSITIONS = Object.freeze([['*', 'present', 'owner.present'], ['*', 'quiet', 'owner.quiet'], ['*', 'press-waiting', 'owner.press']])
/** The background-work note's threshold (work-orders.mjs:19 QUIET_S). */
export const QUIET_SWAP_S = 600

/** @return {!Object} the tail (A3 §3.2 owner row) */
export function create(id, logT, ev) {
  return { present: false, quietS: null, quietAt: null, lastTurnT: null, presentT: null, pressesWaiting: [], screen: null, via: null, lastPressT: null, turns: 0, flags: 0,
           reads: 0, lastRead: null, lastReadT: null, updates: 0 }
}

/** Folds one event into the tail (A2 §3.7's Fold column). */
export function apply(rec, ev, ctx) {
  const t = ctx.logT
  const d = ev.data ?? {}
  switch (ev.kind) {
    case 'owner.quiet': rec.quietS = d.s ?? 0; rec.quietAt = t; if (rec.quietS < 60) { rec.present = true; rec.presentT = t } break
    case 'owner.present': rec.present = true; rec.presentT = t; rec.screen = d.screen ?? rec.screen; rec.via = d.via ?? rec.via; rec.quietS = 0; rec.quietAt = t; break
    case 'owner.press': rec.lastPressT = t; break
    case 'owner.flag': rec.flags++; break
    case 'owner.update': if (d.state === 'queued') { rec.updates++; rec.present = true; rec.presentT = t } break   // his words into a turn (WORK-CHIPS-CHAT-DESIGN #20)
    case 'owner.read': rec.reads++; rec.lastRead = d.what ?? null; rec.lastReadT = t; rec.present = true; rec.presentT = t; break   // a page of the library
    case 'mind.turn.start': if (d.who === 'owner') { rec.turns++; rec.lastTurnT = t; rec.present = true; rec.presentT = t; rec.quietS = 0; rec.quietAt = t } break
    case 'press.wait': rec.pressesWaiting = rec.pressesWaiting.filter((p) => p.id !== d.id).concat({ id: d.id ?? null, action: d.action ?? null, run: d.run ?? ev.actor, since: t }); break
    case 'press.pressed': rec.pressesWaiting = rec.pressesWaiting.filter((p) => p.id !== d.id); rec.lastPressT = t; break
    default: break
  }
}

/** The quiet seconds at `logT`: the last recorded value plus the time since it was recorded. */
export const quietAt = (rec, logT) => (rec.quietAt == null ? null : (rec.quietS ?? 0) + (logT - rec.quietAt))

/** The state at `logT` (A3 §4.14). */
export function classify(rec, logT) {
  if (rec.pressesWaiting.length > 0) return { state: 'press-waiting', cause: `${rec.pressesWaiting.length} press${rec.pressesWaiting.length > 1 ? 'es' : ''} waiting`, since: rec.pressesWaiting[0].since }
  const q = quietAt(rec, logT)
  if (q != null && q >= 60) return { state: 'quiet', cause: `quiet ${Math.round(q / 60)} min${q >= QUIET_SWAP_S ? ' · background work may swap the brain' : ''}`, since: rec.quietAt + Math.max(0, 60 - (rec.quietS ?? 0)) }
  if (rec.presentT != null) return { state: 'present', cause: null, since: rec.state === 'present' ? rec.since : rec.presentT }
  return { state: 'quiet', cause: 'no record', since: 0 }
}

/** The ceremony of a transition (A3 §5.5). */
export const transitions = (from, to) => ceremonyOf(TRANSITIONS, from, to)

/** The pose at `logT` (A3 §4.14): the hexagon's edge; `blink` the press tick. */
export function pose(rec, logT) {
  const p = blankPose()
  const st = rec.state ?? 'quiet'
  const dt = Math.max(0, logT - (rec.since ?? logT))
  p[CH.x] = rec.pos.x
  p[CH.z] = rec.pos.z
  p[CH.y] = 0.2
  p[CH.scale] = 6
  p[CH.edgeHue] = HUE.LAV
  p[CH.hue] = HUE.LAV
  if (st === 'present') { p[CH.l] = 0.8; if (rec.presentT != null && logT - rec.presentT < 0.12) p[CH.blink] = 1 }
  else if (st === 'quiet') p[CH.l] = 0.4
  else { p[CH.l] = 0.8; p[CH.edgeHue] = HUE.AMBER; p[CH.blink] = dt < 5 ? blink(0.5, dt) : 1; p[CH.flags] |= FLAG.amber }
  return p
}
