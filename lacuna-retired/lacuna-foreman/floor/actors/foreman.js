// actors/foreman.js — THE FOREMAN, the bubble in the sky (lane F5-BC; THE-FLOOR-5.0 §3.3; A3 §4.2, §5.2; A4 §2.2; A5 §2.34;
// RULINGS C-44, C-45, C-46, C-47, C-61). Owns: the foreman's record tail (living, total, hushed and its why, lag, RSS, the
// dropped counts, the queue in filed order, restarts, spawned, crashes, graves), his five states (up · busy · hushed · stale
// · down: stale at 30 s with every child `unknown` and alarms inhibited, down at `service.down` or 90 s), his transitions
// to A3 §5.2's ids, and the pose (a fixed sphere R 4.2 at (−48, 28, 8), green and only green, the film swirl at `min(2, 1 +
// log10(1 + living))`, the 200 ms dimple per landing message, the swirl stopping on hush, the rim flat when stale, the
// hold-close-desaturate of a crash with the red diamond on the status layer). Refuses: a color from his workers, a star or
// sparks inside, blades, a change of position or size, a page from absence alone (R4 anti-pattern 9). Implements: A3 §4.2,
// §5.2. Invariants (design §18): "the only green on the floor"; "stale inhibits every child alarm". Faults (§16): none.

import { blankPose, CH, FLAG } from '../keyframe.js'
import { exit, rc, blink, clamp01 } from '../curves.js'
import { HUE, ceremonyOf } from '../vocabulary.js'

export const KIND = 'foreman'
/** The health probe's period (C-61). */
export const PERIOD_S = 5
export const STATES = Object.freeze(['up', 'busy', 'hushed', 'stale', 'down'])
export const LIGHTS = Object.freeze({ rim: ['green', 'flat', 'red'] })
export const COUNTERS = Object.freeze(['living', 'total', 'restarts', 'spawned', 'crashes', 'graves', 'lagMs', 'rssMb'])
export const REACTS = Object.freeze(['foreman.beat', 'foreman.spawn', 'foreman.crash', 'foreman.restart', 'foreman.grave', 'foreman.hush', 'foreman.calm', 'foreman.down', 'foreman.talk', 'service.down', 'service.up', 'run.filed', 'run.start', 'run.pass', 'run.fail', 'run.stop'])
export const TRANSITIONS = Object.freeze([
  ['(none)', 'up', 'box.up'], ['down', 'up', 'box.up'], ['up', 'busy', 'foreman.busy'], ['busy', 'up', 'foreman.calm.swirl'], ['*', 'hushed', 'foreman.hush'],
  ['hushed', '*', 'foreman.calm'], ['*', 'stale', 'foreman.stale'], ['stale', '*', 'foreman.fresh'], ['*', 'down', 'box.down'], ['*', 'up', 'box.up'], ['*', 'busy', 'foreman.busy'],
])
/** Fixed position and radius (floorProcs.js:134, :146, kept). */
export const AT = Object.freeze({ x: -48, y: 28, z: 8 })
export const R = 4.2
const STALE_S = 30
const DOWN_S = 90

/** @return {!Object} the tail (A3 §3.2 foreman row) */
export function create(id, logT, ev) {
  return {
    living: 0, total: 0, hushed: false, hushWhy: null, lagMs: null, rssMb: null, dropped: {}, drops: 0, lastBeatT: null, firstBeatT: null, queue: [],
    restarts: 0, spawned: 0, crashes: 0, graves: 0, hushT: null, calmT: null, downT: null, svcDown: false, landT: null, talks: 0, lastRestartT: null,
  }
}

/** Folds one event into the tail (A2 §3.4's Fold column; the queue from the runs). */
export function apply(rec, ev, ctx) {
  const t = ctx.logT
  const d = ev.data ?? {}
  switch (ev.kind) {
    case 'foreman.beat':
      rec.lastBeatT = t
      rec.firstBeatT ??= t
      Object.assign(rec, { living: d.living ?? rec.living, total: d.total ?? rec.total, lagMs: d['lag-ms'] ?? rec.lagMs, rssMb: d['rss-mb'] ?? rec.rssMb, drops: d.drops ?? rec.drops })
      if (d.dropped && typeof d.dropped === 'object') rec.dropped = { ...d.dropped }
      if (d.hushed === false) rec.hushed = false
      rec.downT = null
      rec.svcDown = false
      break
    case 'foreman.spawn': rec.spawned++; rec.landT = t; break
    case 'foreman.crash': rec.crashes++; break
    case 'foreman.restart': rec.restarts++; rec.lastRestartT = t; break
    case 'foreman.grave': rec.graves++; break
    case 'foreman.hush': rec.hushed = true; rec.hushWhy = d.why ?? null; rec.hushT = t; break
    case 'foreman.calm': rec.hushed = false; rec.calmT = t; break
    case 'foreman.down': rec.downT = t; rec.downWhy = d.why ?? 'down'; break
    case 'foreman.talk': rec.talks++; rec.landT = t; break
    case 'service.down': if (ev.actor === 'foreman') { rec.svcDown = true; rec.downT = t; rec.downWhy = 'down' } break
    case 'service.up': if (ev.actor === 'foreman') { rec.svcDown = false; rec.downT = null } break
    case 'run.filed': if (!rec.queue.includes(ev.actor)) rec.queue.push(ev.actor); rec.landT = t; break
    case 'run.start': case 'run.pass': case 'run.fail': case 'run.stop': rec.queue = rec.queue.filter((id) => id !== ev.actor); rec.landT = t; break
    default: break
  }
}

/** The state at `logT` (A3 §4.2; C-47: 30 s unknown and inhibit, 90 s down). */
export function classify(rec, logT) {
  if (rec.svcDown || rec.downT != null) return { state: 'down', cause: rec.downWhy ?? 'down', since: rec.downT ?? logT }
  if (rec.stale != null) return { state: 'stale', cause: `stale-feed ${Math.round(logT - rec.stale)} s`, since: rec.stale }
  if (rec.lastBeatT == null) return { state: 'stale', cause: 'no record', since: 0 }
  const silent = logT - rec.lastBeatT
  if (silent >= DOWN_S) return { state: 'down', cause: `no-beat ${Math.round(silent)} s`, since: rec.lastBeatT + DOWN_S }
  if (silent >= STALE_S) return { state: 'stale', cause: `no-beat ${Math.round(silent)} s`, since: rec.lastBeatT + STALE_S }
  if (rec.hushed) return { state: 'hushed', cause: rec.hushWhy ?? 'hushed', since: rec.hushT ?? logT }
  if (rec.living > 0) return { state: 'busy', cause: `${rec.living} living`, since: rec.state === 'busy' ? rec.since : logT }
  if (rec.state === 'busy' && rec.since != null && logT - (rec.lastBeatT ?? logT) < 2) return { state: 'busy', cause: '0 living', since: rec.since }
  return { state: 'up', cause: null, since: rec.state === 'up' ? rec.since : (rec.calmT != null && rec.calmT > (rec.firstBeatT ?? 0) ? rec.calmT : rec.firstBeatT) }
}

/** The ceremony of a transition (A3 §5.2). */
export const transitions = (from, to) => ceremonyOf(TRANSITIONS, from, to)

/** The swirl speed `min(2, 1 + log10(1 + living))` (C-45). */
export const swirlOf = (living) => Math.min(2, 1 + Math.log10(1 + Math.max(0, living)))

/** The pose at `logT` (A3 §4.2): `spin` the film's phase, `motion` the dimple, `fill` the hue drift, `hue` green. */
export function pose(rec, logT) {
  const p = blankPose()
  const st = rec.state ?? 'stale'
  const dt = Math.max(0, logT - (rec.since ?? logT))
  p[CH.x] = AT.x
  p[CH.y] = AT.y
  p[CH.z] = AT.z
  p[CH.scale] = R
  p[CH.hue] = HUE.GREEN
  p[CH.edgeHue] = HUE.GREEN
  const swirl = swirlOf(rec.living)
  switch (st) {
    case 'up':
    case 'busy': p[CH.spin] = (2 * Math.PI * swirl * logT) / 15; p[CH.fill] = 0.5 + 0.5 * Math.sin((2 * Math.PI * logT) / 15); p[CH.l] = 1; break
    case 'hushed': p[CH.spin] = (2 * Math.PI * swirl * rec.since) / 15 + (2 * Math.PI * swirl * 0.4 * (1 - exit(clamp01(dt / 0.4)))) / 15; p[CH.l] = 0.7; break
    case 'stale': p[CH.spin] = (2 * Math.PI * swirl * rec.since) / 15; p[CH.sat] = 0.5; p[CH.edge] = 0.25; p[CH.flags] |= FLAG.frozen; break
    case 'down': { const past = dt - 0.15; p[CH.spin] = (2 * Math.PI * swirl * rec.since) / 15; p[CH.sat] = past <= 0 ? 1 : 1 - 0.8 * exit(clamp01(past / 0.4)); p[CH.l] = past <= 0 ? 1 : 1 - 0.6 * exit(clamp01(past / 0.4)); p[CH.edgeHue] = HUE.RED; p[CH.blink] = past < 0.24 ? clamp01(past / 0.24) : dt < 0.39 + 2 ? blink(1.5, dt - 0.39) : 1; p[CH.flags] |= FLAG.red; break }
    default: break
  }
  if (rec.landT != null && logT - rec.landT < 0.4 && (st === 'up' || st === 'busy')) p[CH.motion] = 0.03 * rc(clamp01((logT - rec.landT) / 0.2) / 2) + 0.5 * clamp01((logT - rec.landT) / 0.4)
  if (rec.lastRestartT != null && logT - rec.lastRestartT < 0.7) p[CH.scale] = R * (0.92 + 0.08 * clamp01((logT - rec.lastRestartT) / 0.7))
  return p
}
