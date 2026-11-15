// actors/lacuna.js — LACUNA, the cube (lane F5-BC; THE-FLOOR-5.0 §3.2, R1, R2; A3 §4.7, §5.5; A4 §2.7; A5 §2.33; RULINGS M-01,
// M-18, M-34, C-34, C-35, C-36, Q-D1). Owns: three statecharts in one record: the three lights (provenance · AST · semantics,
// each aggregated over the attached sentries with worst-wins, `unknown` with no verdict row: never a false clean, M-01), the
// edges (its own health: enforcing · shadow · stale · down; the record's `state` is the edge), and its voice (speaking,
// calling, deploying); R1's `unwatched` as a counter the corner mark reads (`unwatched`, `unwatchedSince`), never a cube light
// (C-34). Refuses: an `evicted` state (Lacuna is never evicted), an edge that flashes, a 2.86 Hz anything, a bob, a yaw,
// a light moved by anything but a verdict row. Implements: A3 §4.7, §5.5. Invariants (design §18): "Lacuna is never evicted";
// "red here means a page and only a page"; "the cube never moves". Faults (§16): none.

import { blankPose, CH, FLAG } from '../keyframe.js'
import { enter, exit, rc, blink, clamp01 } from '../curves.js'
import { HUE, ceremonyOf } from '../vocabulary.js'
import { lightsAt as sentryLights } from './sentry.js'
import { stallDelay } from './worker.js'

export const KIND = 'lacuna'
/** The keep-alive's 3 × (C-36): STALE at 15 s; the record's period is the keep-alive. */
export const PERIOD_S = 5
/** The edge states; the record's `state` (A3 §4.7). */
export const STATES = Object.freeze(['enforcing', 'shadow', 'stale', 'down'])
export const LIGHTS = Object.freeze({
  prov: ['clean', 'moving', 'warn', 'fail', 'unknown'], ast: ['clean', 'moving', 'warn', 'fail', 'unknown'], sem: ['clean', 'moving', 'warn', 'fail', 'unknown'],
  voice: ['quiet', 'speaking', 'calling', 'deploying'],
})
export const COUNTERS = Object.freeze(['unwatched', 'pagesToday', 'quarantine', 'watching'])
export const REACTS = Object.freeze([
  'sentry.attach', 'sentry.check', 'sentry.verdict', 'sentry.warn', 'sentry.detach', 'sentry.mode', 'sentry.ready', 'service.up', 'service.down',
  'mind.turn.start', 'mind.turn.phase', 'mind.turn.done', 'mind.turn.fail', 'press.wait', 'mind.load.start', 'floor.stale', 'floor.fresh', 'floor.quarantine',
  'run.start', 'run.pass', 'run.fail', 'run.stop', 'run.crash',
])
export const TRANSITIONS = Object.freeze([
  ['*', 'enforcing', 'lacuna.edge.live'], ['*', 'shadow', 'lacuna.edge.shadow'], ['*', 'stale', 'lacuna.edge.stale'], ['*', 'down', 'lacuna.edge.down'],
])
/** Position and side (floorModel.js:487, floorProcs.js:410, kept). */
export const AT = Object.freeze({ x: -20, z: 30 })
export const SIDE = 4.4

/** @return {!Object} the tail (A3 §3.2 lacuna row) */
export function create(id, logT, ev) {
  return {
    mode: 'shadow', feedAt: null, staleSince: null, parts: { door: true, foreman: true, hands: true }, speaking: null, calling: null, deployT: null,
    unwatched: 0, unwatchedSince: null, why: [], quarantineT: null, quarantine: 0, watching: 0, pagesToday: 0, ackT: null, lastCheckT: { prov: null, ast: null, sem: null },
    directLights: { prov: 'unknown', ast: 'unknown', sem: 'unknown' }, chain: null, tickT: null, sentries: [], runs: [],
  }
}

/**
 * The record's direct lights. A record restored from a keyframe written before the field existed gets them here: `restore`
 * upgrades no shape, and a write through the missing field stopped the frontend's boot on 2026-11-10 (the postmortem).
 * @param {!Object} rec @return {{prov: string, ast: string, sem: string}}
 */
function directOf(rec) { return (rec.directLights ??= { prov: 'unknown', ast: 'unknown', sem: 'unknown' }) }

/** Folds one event into the tail (A2 §3.3, §3.6, §3.9's Fold columns as they reach the cube). */
export function apply(rec, ev, ctx) {
  const t = ctx.logT
  const d = ev.data ?? {}
  const lightKey = (s) => (/^prov/.test(String(s)) ? 'prov' : /^ast|syntax/.test(String(s)) ? 'ast' : 'sem')
  rec.feedAt = t
  rec.tickT = t
  switch (ev.kind) {
    case 'sentry.check': { const k = lightKey(d.light ?? d.kind); const direct = directOf(rec); rec.lastCheckT[k] = t; if (direct[k] === 'unknown') direct[k] = 'clean'; break }
    case 'sentry.warn': directOf(rec)[lightKey(d.light ?? d.kind)] = 'warn'; break
    case 'sentry.verdict': {
      // a row with no judgment (the catalog's check · action · detail · shadow · by) moves no direct light: never a false clean (M-01)
      const said = d.level ?? d.judged
      if (said != null) directOf(rec)[lightKey(d.light ?? d.kind)] = (said === 'warn' || said === 'stop') ? 'warn' : 'clean'
      break
    }
    case 'sentry.attach': rec.deployT = t; if (!rec.sentries.includes(ev.actor)) rec.sentries.push(ev.actor); rec.runs = rec.runs.filter((id) => id !== d.run); break
    case 'sentry.detach': rec.sentries = rec.sentries.filter((id) => id !== ev.actor); break
    case 'run.start': if (!rec.runs.includes(ev.actor)) rec.runs.push(ev.actor); break
    case 'run.pass': case 'run.fail': case 'run.stop': rec.runs = rec.runs.filter((id) => id !== ev.actor); break
    case 'sentry.mode': rec.mode = d.mode === 'live' ? 'live' : 'shadow'; break
    case 'service.down': if (['door', 'foreman', 'hands'].includes(ev.actor)) rec.parts[ev.actor] = false; break
    case 'service.up': if (['door', 'foreman', 'hands'].includes(ev.actor)) rec.parts[ev.actor] = true; break
    case 'mind.turn.start': if (d.who === 'lacuna' || ev.actor === 'lacuna') rec.speaking = { since: t, mind: ev.actor }; break
    case 'mind.turn.phase': if (rec.speaking && rec.speaking.mind === ev.actor) rec.speaking.phase = d.phase ?? null; break
    case 'mind.turn.done': case 'mind.turn.fail': if (rec.speaking && rec.speaking.mind === ev.actor) rec.speaking = null; break
    case 'press.wait': if (d.by === 'lacuna') rec.calling = { mind: d.run ?? ev.actor, since: t }; break
    case 'mind.load.start': if (d.by === 'lacuna') rec.calling = { mind: ev.actor, since: t }; else if (rec.calling?.mind === ev.actor) rec.calling = null; break
    case 'floor.stale': if (d.producer === 'door' || d.producer === 'floor') rec.staleSince = rec.staleSince ?? t; break
    case 'floor.fresh': if (d.producer === 'door' || d.producer === 'floor') rec.staleSince = null; break
    case 'floor.quarantine': rec.quarantine += d.n ?? 1; rec.quarantineT = t; if (d.reason === 'chain') rec.chain = { at: t, seq: d.seq ?? null }; break
    default: break
  }
}

/**
 * The three lights at `logT`, aggregated over the attached sentries with worst-wins (A3 §4.7; R4 §7 item 6).
 * @param {!Object} rec @param {number} logT @param {!Map<string, !Object>=} registry
 * @return {{prov: string, ast: string, sem: string}}
 */
export function lightsAt(rec, logT, registry) {
  const rank = { unknown: 0, clean: 1, moving: 1, warn: 2, fail: 3 }
  const out = { ...(rec.directLights || { prov: 'unknown', ast: 'unknown', sem: 'unknown' }) }
  let watching = 0
  if (registry) {
    for (const id of rec.sentries) {
      const r = registry.get(id)
      if (!r || r.state === 'detached') continue
      watching++
      const ls = sentryLights(r, logT)
      for (const k of ['prov', 'ast', 'sem']) if (rank[ls[k]] > rank[out[k]]) out[k] = ls[k]
    }
  }
  for (const k of ['prov', 'ast', 'sem']) {
    if (rec.chain && k === 'prov' && (rec.ackT == null || logT < rec.ackT + 2)) out[k] = 'fail'
    if (out[k] === 'clean' && rec.lastCheckT[k] != null && logT - rec.lastCheckT[k] < 0.4) out[k] = 'moving'
  }
  rec.watching = watching
  return out
}

/** The state at `logT`: the edge (A3 §4.7); the lights, the voice and the unwatched count are written on the record. */
export function classify(rec, logT, registry) {
  rec.lights = lightsAt(rec, logT, registry)
  rec.voice = rec.speaking ? 'speaking' : rec.calling && logT - rec.calling.since < 10 ? 'calling' : rec.deployT != null && logT - rec.deployT < 0.2 ? 'deploying' : 'quiet'
  unwatchedAt(rec, logT, registry)
  const down = Object.entries(rec.parts).find(([, up]) => !up)
  if (down) return { state: 'down', cause: `${down[0]} down`, since: rec.state === 'down' ? rec.since : logT }
  const staleAt = rec.staleSince ?? rec.stale
  if (staleAt != null) return { state: 'stale', cause: `feed stale ${Math.round(logT - staleAt)} s`, since: staleAt }
  if (rec.mode === 'live') return { state: 'enforcing', cause: null, since: rec.state === 'enforcing' ? rec.since : logT }
  return { state: 'shadow', cause: 'shadow', since: rec.state === 'shadow' ? rec.since : logT }
}

/** R1: runs working past their stall on-delay with no sentry; amber on the run at once, red on the mark only past the delay. */
function unwatchedAt(rec, logT, registry) {
  let n = 0
  let earliest = null
  const foreman = registry?.get('foreman')
  if (registry && !(foreman && foreman.state === 'stale')) {
    for (const id of rec.runs) {
      const r = registry.get(id)
      if (!r || r.sentry || r.startT == null || r.outcome || r.desk || r.eval) continue
      if (!['working', 'stepping', 'stalled', 'waiting-press'].includes(r.state)) continue
      const at = (r.landT ?? r.startT) + stallDelay(r)
      if (logT >= at) { n++; earliest = earliest == null ? at : Math.min(earliest, at) }
    }
  }
  rec.unwatched = n
  rec.unwatchedSince = n > 0 ? earliest : null
}

/** The ceremony of a transition (A3 §5.5). */
export const transitions = (from, to) => ceremonyOf(TRANSITIONS, from, to)

/** The pose at `logT` (A3 §4.7): `hue` the worst light, `blink` its blink, `edgeHue` and `edge` the edges, `fill` the tick. */
export function pose(rec, logT) {
  const p = blankPose()
  const st = rec.state ?? 'shadow'
  const dt = Math.max(0, logT - (rec.since ?? logT))
  const lights = rec.lights ?? { prov: 'unknown', ast: 'unknown', sem: 'unknown' }
  p[CH.x] = AT.x
  p[CH.z] = AT.z
  p[CH.y] = SIDE / 2 + 3
  p[CH.scale] = SIDE
  p[CH.spin] = 0
  switch (st) {
    case 'enforcing': p[CH.edgeHue] = HUE['N-WHITE']; p[CH.edge] = 0.95; break
    case 'shadow': p[CH.edgeHue] = HUE['N-GHOST']; p[CH.edge] = 0.9; break
    case 'stale': p[CH.edgeHue] = HUE['N-DARK']; p[CH.edge] = 0.25; p[CH.sat] = 0.5; p[CH.flags] |= FLAG.frozen; break
    case 'down': p[CH.edgeHue] = HUE.RED; p[CH.edge] = 0.9; p[CH.flags] |= FLAG.red; break
    default: break
  }
  if (rec.tickT != null && logT - rec.tickT < 0.12 && st !== 'stale') p[CH.fill] = 1 - (logT - rec.tickT) / 0.12
  const worst = ['fail', 'warn', 'moving', 'clean', 'unknown'].find((s) => Object.values(lights).includes(s)) ?? 'unknown'
  if (worst === 'fail') { p[CH.hue] = HUE.RED; p[CH.blink] = dt < 2 ? blink(1.5, dt) : 1; p[CH.flags] |= FLAG.red }
  else if (worst === 'warn') { p[CH.hue] = HUE.AMBER; p[CH.blink] = dt < 5 && rec.ackT == null ? 0.4 + 0.6 * blink(0.6, dt) : 0.9 + 0.1 * rc(0.2 * logT); p[CH.flags] |= FLAG.amber }
  else if (worst === 'moving') { const k = ['prov', 'ast', 'sem'].find((x) => lights[x] === 'moving'); const d2 = logT - (rec.lastCheckT[k] ?? logT); p[CH.hue] = HUE.CYAN; p[CH.blink] = 0.4 + 0.6 * enter(clamp01(d2 / 0.2)) * (1 - exit(clamp01((d2 - 0.2) / 0.2))) }
  else if (worst === 'clean') { p[CH.hue] = HUE.NONE; p[CH.blink] = 0.1 }
  else { p[CH.hue] = HUE['N-GHOST']; p[CH.blink] = 0.25 }
  if (rec.voice === 'speaking') { p[CH.edgeHue] = HUE.LAV; p[CH.l] = 1.1 }
  if (rec.voice === 'deploying') p[CH.motion] = rc((logT - rec.deployT) / 0.2) * 0.03
  p[CH.hollow] = Object.values(lights).every((s) => s === 'unknown') ? 1 : 0
  return p
}
