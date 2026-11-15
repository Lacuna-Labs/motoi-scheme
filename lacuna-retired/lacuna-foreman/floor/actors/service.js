// actors/service.js — THE RACK SERVICES (lane F5-BC; THE-FLOOR-5.0 §3.7, R4; A3 §4.8, §5.5; A4 §2.8; A5 §2.29; RULINGS C-16,
// Q-A22, Q-D4). Owns: a service's record tail (up, pid, RSS, the probe, the wires lit only by recorded hops, the budget when a
// watchdog's line names one, the page class), its five states (up · probe · slow · down · stale: a service with no record is
// dark and says so, never green), its transitions to A3 §5.5's ids, and the pose (a fixed tile on the back wall, steel
// edges, RSS as a fill only against a recorded budget, one 120 ms probe tick, the three-state ring on slow, red steady and
// the fill lost over 400 ms on down, edges 0.25 on stale). The record id is `svc:<procs.mjs id>`; the LME or the brain
// front going down also sets every mind they serve to `engine-down` (R4; actors/index.js routes it). Refuses: a spin, a
// wire with no recorded hop, red from absence alone. Implements: A3 §4.8, §5.5. Invariants (design §18): "no wire lights
// without a recorded hop". Faults (§16): none.

import { blankPose, CH, FLAG } from '../keyframe.js'
import { exit, held, clamp01 } from '../curves.js'
import { HUE, ceremonyOf } from '../vocabulary.js'

export const KIND = 'service'
/** The probe's period (A2 §3.6; C-62). */
export const PERIOD_S = 30
export const STATES = Object.freeze(['up', 'probe', 'slow', 'down', 'stale'])
export const LIGHTS = Object.freeze({ ring: ['within', 'slow', 'over'] })
export const COUNTERS = Object.freeze(['restarts', 'proxyFail', 'rssMb', 'probeMs'])
export const REACTS = Object.freeze(['service.up', 'service.down', 'service.stop', 'service.probe', 'door.proxy.fail'])
export const TRANSITIONS = Object.freeze([
  ['*', 'up', 'svc.up'], ['*', 'probe', 'svc.probe'], ['*', 'slow', 'svc.slow'], ['*', 'down', 'svc.down'], ['*', 'stale', 'svc.stale'],
])
/** The rack's services in their fixed order (C-16: procs.mjs's ids from services.slat) and the page class (Q-A22). */
export const RACK = Object.freeze(['door', 'foreman', 'hands', 'lme', 'brain', 'gateway', 'ollama', 'library', 'caddy', 'api', 'ci', 'vm'])
export const PAGE_CLASS = Object.freeze(['foreman', 'hands', 'brain', 'lme', 'ollama'])

/** @return {!Object} the tail (A3 §3.2 service row) */
export function create(id, logT, ev) {
  const name = id.slice(4)
  return { name, up: null, pid: null, rssMb: null, upSince: null, probeMs: null, probeAt: null, wires: [], budget: { p99Ms: null, rssMb: null }, downT: null, upT: null, restarts: 0, proxyFail: 0, proxyFailT: null, pageClass: PAGE_CLASS.includes(name), slowSince: null, fastSince: null, by: null, why: null, commits: null, crash: false }
}

/** Folds one event into the tail (A2 §3.6's Fold column). */
export function apply(rec, ev, ctx) {
  const t = ctx.logT
  const d = ev.data ?? {}
  switch (ev.kind) {
    case 'service.up':
      if (rec.up === true && d.pid != null && rec.pid != null && d.pid !== rec.pid) rec.restarts++
      Object.assign(rec, { up: true, pid: d.pid ?? rec.pid, rssMb: d['rss-mb'] ?? rec.rssMb, upSince: rec.up === true ? rec.upSince : t, upT: t, downT: null, by: d.by ?? rec.by, why: d.why ?? rec.why, commits: d.commits ?? rec.commits, crash: d.crash === true || d.why === 'nobody asked' })
      if (d['p99-ms'] != null) rec.budget.p99Ms = d['p99-ms']
      if (d['rss-budget-mb'] != null) rec.budget.rssMb = d['rss-budget-mb']
      break
    case 'service.stop':
      Object.assign(rec, { up: false, downT: t, downWhy: d.why ? `${d.by ? `${d.by}: ` : ''}${d.why}` : 'stopped', by: d.by ?? null, why: d.why ?? null, crash: false, pid: null })
      break
    case 'service.down':
      Object.assign(rec, { up: false, downT: t, downWhy: d.why ?? 'pid gone', by: d.by ?? null, crash: d.crash === true || d.why === 'nobody asked', pid: null })
      break
    case 'service.probe': {
      Object.assign(rec, { probeMs: d.ms ?? null, probeAt: t, rssMb: d['rss-mb'] ?? rec.rssMb, pid: d.pid ?? rec.pid })
      if (d.up === true && rec.up !== true) { rec.up = true; rec.upT = t; rec.upSince = t; rec.downT = null }
      if (d.up === false && rec.up !== false) { rec.up = false; rec.downT = t; rec.downWhy = d.code != null ? String(d.code) : 'probe' }
      const slow = rec.budget.p99Ms != null && d.ms != null && d.ms > rec.budget.p99Ms
      rec.slowSince = slow ? rec.slowSince ?? t : null
      rec.fastSince = slow ? null : rec.fastSince ?? t
      break
    }
    case 'door.proxy.fail': rec.proxyFail += d.n ?? 1; rec.proxyFailT = t; rec.wires = [{ to: `svc:api`, live: false, at: t, error: true }]; break
    default: break
  }
}

/** The state at `logT` (A3 §4.8). */
export function classify(rec, logT) {
  if (rec.up === false) return { state: 'down', cause: rec.downWhy ?? 'down', since: rec.downT ?? logT }
  if (rec.stale != null) return { state: 'stale', cause: `stale-feed ${Math.round(logT - rec.stale)} s`, since: rec.stale }
  const last = Math.max(rec.probeAt ?? -Infinity, rec.upT ?? -Infinity)
  if (!Number.isFinite(last)) return { state: 'stale', cause: 'no record', since: 0 }
  if (logT - last > 3 * PERIOD_S) return { state: 'stale', cause: `no probe ${Math.round(logT - last)} s`, since: last + 3 * PERIOD_S }
  if (held(rec.slowSince, 2, logT) || (rec.state === 'slow' && !held(rec.fastSince, 2, logT))) return { state: 'slow', cause: `p99 ${rec.probeMs ?? '?'} ms over ${rec.budget.p99Ms ?? '?'}`, since: rec.state === 'slow' ? rec.since : rec.slowSince + 2 }
  if (rec.probeAt != null && logT - rec.probeAt < 0.24) return { state: 'probe', cause: null, since: rec.probeAt }
  return { state: 'up', cause: null, since: rec.state === 'up' ? rec.since : Math.max(rec.upT ?? 0, rec.probeAt != null ? rec.probeAt + 0.24 : 0) }
}

/** The ceremony of a transition (A3 §5.5). */
export const transitions = (from, to) => ceremonyOf(TRANSITIONS, from, to)

/** The pose at `logT` (A3 §4.8): `fill` is RSS against a recorded budget, `blink` the probe tick. */
export function pose(rec, logT) {
  const p = blankPose()
  const st = rec.state ?? 'stale'
  const dt = Math.max(0, logT - (rec.since ?? logT))
  p[CH.x] = rec.pos.x
  p[CH.z] = rec.pos.z
  p[CH.y] = 1
  p[CH.scale] = 2
  p[CH.edgeHue] = HUE['N-STEEL']
  p[CH.hue] = HUE['N-ICE']
  p[CH.l] = 0.6
  const fill = rec.budget.rssMb && rec.rssMb != null ? 0.1 + 0.8 * clamp01(rec.rssMb / rec.budget.rssMb) : 0
  p[CH.fill] = fill
  switch (st) {
    case 'up': break
    case 'probe': p[CH.blink] = 1 - dt / 0.24; p[CH.l] = 0.6 + 0.3 * (1 - dt / 0.24); break
    case 'slow': p[CH.ring] = 1; p[CH.edgeHue] = HUE.AMBER; p[CH.flags] |= FLAG.amber; break
    case 'down': p[CH.edgeHue] = HUE.RED; p[CH.flags] |= FLAG.red | FLAG.dashed; p[CH.fill] = fill * (1 - exit(clamp01(dt / 0.4))); p[CH.l] = 0.3; break
    case 'stale': p[CH.edge] = 0.25; p[CH.flags] |= FLAG.dashed; p[CH.l] = 0.3; p[CH.edgeHue] = HUE['N-GHOST']; break
    default: break
  }
  if (rec.budget.rssMb && rec.rssMb > 0.9 * rec.budget.rssMb) p[CH.flags] |= FLAG.amber
  return p
}
