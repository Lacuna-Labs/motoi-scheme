// alarms.js — THE ALARM DISCIPLINE AS FOLD RULES (lane F5-BC; THE-FLOOR-5.0 §3.10; A3 §7; A4 §7; R4 §6; RULINGS C-78, C-80).
// Owns: one mark per incident (`alert:<actor>:<faultId>`, a second raise is ×N and refreshes `raisedT` only after a
// resolve), the derived raises the floor's own records make (a failed run, a stall, a kick, a sentry's verdict, a service
// down by its class, a crash or a grave, a failed turn, an engine down, a refused load, a broken chain, an unwatched run),
// inhibit under a stale parent (no derived raise from a child while the foreman is stale; raised ones hold), flapping by
// Nagios's 21 weighted states (in at ≥ 50 %, out at ≤ 25 %), ack → steady, resolve → ghost until seen or 60 s → fade,
// flood (≥ 10 raises per 10 min per area; out at ≤ 3), the one flasher (the highest level, newest among equals; the press
// edge yields to any), the off-screen marker list, the "changed since you looked" marks and the owner's page budget as a
// count. Refuses: a second flasher, a mark with no record, a page from a child under a stale parent, a flash while flapping.
// Implements: A3 §7; A4 §7; master §3.10. Invariants (design §18): "at most one thing flashes"; "children are inhibited
// when the parent is stale". Faults (§16): none.

import { PAGE_CLASS } from './actors/service.js'

/** The alert history window (Nagios). */
export const HISTORY = 21
/** Flood: ≥ 10 raises per 10 min in one area; out at ≤ 3 (A3 §7). */
export const FLOOD = Object.freeze({ windowS: 600, on: 10, off: 3 })
/** The owner's budget (master §3.10): two pages a day; a count, never a gate. */
export const PAGES_A_DAY = 2
const CHILD_KINDS = new Set(['worker', 'ring', 'sentry', 'pad'])

/**
 * A fresh alarm state.
 * @return {!Object} {flasher: ?string, flood: {area: {on, raises: [logT]}}, pages: [ms]}
 */
export function create() {
  return { flasher: null, flood: {}, pages: [] }
}

/**
 * The area of a record (the flood's collapse key): `minds` (world one), `work` (world two), `rack`, `landmarks`.
 * @param {!Object} rec
 * @return {string}
 */
export const areaOf = (rec) => (rec.kind === 'mind' || rec.kind === 'lacuna' ? 'minds' : CHILD_KINDS.has(rec.kind) || rec.kind === 'foreman' || rec.kind === 'wo' ? 'work' : rec.kind === 'service' ? 'rack' : 'landmarks')

/** The derived raises per event kind: `[actorIdOf(ev), faultId, level]` or null (A3 §7's fault ids). */
function derived(ev, registry) {
  const d = ev.data ?? {}
  switch (ev.kind) {
    case 'run.fail': return [ev.actor, `exit-${d.exit ?? 'fail'}`, 'page']
    case 'run.stall': return [ev.actor, 'f-06', 'warn']
    case 'run.kick': return [ev.actor, 'kick', 'warn']
    case 'sentry.verdict': return d.action === 'stop' ? [ev.actor, String(d.check ?? 'check'), 'page'] : d.action === 'warn' || d.action === 'would-stop' || d.action === 'kick' ? [ev.actor, String(d.check ?? 'check'), 'warn'] : null
    case 'sentry.warn': return [ev.actor, String(d.check ?? 'check'), 'warn']
    case 'service.down': return [`svc:${ev.actor}`, `svc-down:${ev.actor}`, PAGE_CLASS.includes(ev.actor) ? 'page' : 'warn']
    case 'foreman.crash': return registry.get(String(d.id))?.kind === 'worker' ? [String(d.id), 'crash', 'warn'] : ['foreman', 'crash', 'page']
    case 'foreman.grave': return [String(d.id ?? 'foreman'), 'f-04', 'page']
    case 'foreman.down': return ['foreman', 'down', 'page']
    case 'mind.turn.fail': return /^(cancel|stopped|stop|swap)$/.test(String(d.reason)) ? null : [ev.actor, d.grammar === true ? 'grammar' : 'turn-fail', 'warn']   // a cancel or his stop is no fault (E14 §5 row 8)
    case 'mind.engine.down': return [ev.actor, 'engine-down', 'page']
    case 'mind.load.refused': return [ev.actor, 'f-lme-load', 'warn']
    case 'floor.quarantine': return d.reason === 'chain' ? ['lacuna', 'chain', 'page'] : null
    default: return null
  }
}

/** The derived resolves per event kind: `[actorId, faultId]`. */
function resolves(ev) {
  const d = ev.data ?? {}
  switch (ev.kind) {
    case 'run.step': return [[ev.actor, 'f-06'], [ev.actor, 'kick']]
    case 'run.pass': return [[ev.actor, 'f-06'], [ev.actor, 'kick'], [ev.actor, 'no-sentry']]
    case 'service.up': return [[`svc:${ev.actor}`, `svc-down:${ev.actor}`]]
    case 'mind.engine.up': return [[ev.actor, 'engine-down']]
    case 'mind.load.done': return [[ev.actor, 'f-lme-load']]
    case 'sentry.verdict': return d.action === 'note' ? [[ev.actor, String(d.check ?? 'check')]] : []
    default: return []
  }
}

/**
 * Runs the alarm rules for one event (A3 §7): the raw `alert.*` rows, the derived raises and resolves, flapping, flood and
 * the flasher. Raises on a child under a stale foreman are held back (inhibit).
 * @param {!Object} A @param {!Object} ev @param {!Map<string, !Object>} registry @param {number} logT @param {!Object} ctx
 */
export function fold(A, ev, registry, logT, ctx) {
  const d = ev.data ?? {}
  if (ev.kind === 'alert.raise') {
    const rec = registry.get(ev.actor)
    if (rec) {
      const actorId = d.actor ?? rec.actorId ?? ev.actor.slice(6)
      raise(A, rec, actorId, d.fault ?? rec.faultId, rec.level, registry, logT, false)
      if (rec.level === 'page') A.pages.push(ev.t)
    }
  } else if (ev.kind === 'alert.resolve') {
    const rec = registry.get(ev.actor)
    if (rec) resolve(rec, logT)
  } else if (ev.kind === 'alert.ack') {
    const rec = registry.get(ev.actor)
    const target = rec && registry.get(rec.actorId)
    if (target) target.ackT = logT
    const pad = rec && registry.get(`pad:${rec.actorId}`)
    if (pad) pad.ackT = logT
    const sentry = rec && [...registry.values()].find((r) => r.kind === 'sentry' && r.runId === rec.actorId)
    if (sentry) sentry.ackT = logT
  } else {
    const r = derived(ev, registry)
    if (r) {
      const [actorId, faultId, level] = r
      const target = registry.get(actorId)
      const foreman = registry.get('foreman')
      const inhibited = target && CHILD_KINDS.has(target.kind) && foreman && foreman.state === 'stale'
      if (target && !inhibited) {
        const rec = ctx.get('alert', `alert:${actorId}:${faultId}`)
        rec.level = rec.level === 'page' ? 'page' : level
        rec.derived = true
        raise(A, rec, actorId, faultId, level, registry, logT, true)
      }
    }
    for (const [actorId, faultId] of resolves(ev)) { const rec = registry.get(`alert:${actorId}:${faultId}`); if (rec && rec.resolvedT == null && rec.raisedT != null) resolve(rec, logT) }
  }
  chooseFlasher(A, registry, logT)
}

function raise(A, rec, actorId, faultId, level, registry, logT, derivedRow) {
  const target = registry.get(actorId)
  rec.actorId = actorId
  rec.faultId = faultId
  rec.derived = derivedRow
  rec.area = target ? areaOf(target) : 'floor'
  if (target) { rec.at = { x: target.pos.x, z: target.pos.z }; if (!target.alarms.includes(rec.id)) target.alarms.push(rec.id); if (level === 'warn' || level === 'page') target.warnedAt = logT }
  const wasOpen = rec.raisedT != null && rec.resolvedT == null
  rec.count = wasOpen ? rec.count + 1 : 1
  if (!wasOpen) { rec.raisedT = logT; rec.resolvedT = null; rec.ackT = null; rec.seen = false; rec.seenT = null; rec.seenWhileRaised = false }
  history(rec, logT, true)
  rec.level = level === 'page' ? 'page' : rec.level === 'page' ? 'page' : level
  floodNote(A, rec.area, logT)
}

function resolve(rec, logT) {
  rec.resolvedT = logT
  rec.seen = rec.seenWhileRaised === true
  rec.seenT = rec.seen ? logT : null
  history(rec, logT, false)
}

/** Nagios's weighted flap score over the last 21 samples: weights 1.0 (oldest) → 1.5 (newest). */
function history(rec, logT, up) {
  rec.history.push({ t: logT, up })
  if (rec.history.length > HISTORY) rec.history.shift()
  const h = rec.history
  let num = 0
  let den = 0
  for (let i = 1; i < h.length; i++) {
    const w = 1 + (0.5 * i) / Math.max(1, h.length - 1)
    den += w
    if (h[i].up !== h[i - 1].up) num += w
  }
  rec.flapPct = den > 0 ? (100 * num) / den : 0
  if (!rec.flapping && rec.flapPct >= 50) rec.flapping = true
  if (rec.flapping && rec.flapPct <= 25) rec.flapping = false
}

function floodNote(A, area, logT) {
  const f = (A.flood[area] ||= { on: false, raises: [] })
  f.raises = f.raises.filter((t) => logT - t < FLOOD.windowS).concat(logT)
  if (!f.on && f.raises.length >= FLOOD.on) f.on = true
  if (f.on && f.raises.length <= FLOOD.off) f.on = false
}

/** The one flasher (C-78): among raised, unacknowledged, unresolved, not flapping, not hidden: the highest level, newest among equals. */
function chooseFlasher(A, registry, logT) {
  let best = null
  for (const r of registry.values()) {
    if (r.kind !== 'alert' || r.raisedT == null || r.resolvedT != null || r.ackT != null || r.flapping) continue
    const f = A.flood[r.area]
    r.hidden = Boolean(f && f.on)
    if (r.hidden) continue
    if (!best || levelRank(r.level) > levelRank(best.level) || (levelRank(r.level) === levelRank(best.level) && r.raisedT > best.raisedT)) best = r
  }
  A.flasher = best?.id ?? null
  for (const r of registry.values()) {
    if (r.kind === 'alert') r.flasher = r === best
    if (r.pressWait !== undefined) r.pressYields = best != null
  }
}

const levelRank = (l) => (l === 'page' ? 2 : l === 'warn' ? 1 : 0)

/**
 * The rules that follow a state change (A3 §7): the "changed since you looked" mark, the unwatched run's warn, the flood
 * window and the flasher.
 * @param {!Object} A @param {!Object} rec @param {!Map<string, !Object>} registry @param {number} logT @param {!Object} ctx the fold's context (`get` creates a record)
 */
export function onTransition(A, rec, registry, logT, ctx) {
  if (rec.visible === false || rec.visible == null) rec.changed = true
  if (rec.kind === 'alert') return
  for (const id of rec.alarms) { const a = registry.get(id); if (a) a.at = { x: rec.pos.x, z: rec.pos.z } }
  chooseFlasher(A, registry, logT)
}

/**
 * R1 on every settle: a run working past its stall on-delay with no sentry raises `no-sentry` (warn, amber on the run);
 * the red lives on the corner mark's work light, read from Lacuna's `unwatched` counter (C-34).
 * @param {!Object} A @param {!Map<string, !Object>} registry @param {number} logT @param {!Object} ctx
 * @return {!Array<!Object>} the alert records created (the fold classifies them in the same settle)
 */
export function unwatched(A, registry, logT, ctx) {
  const lac = registry.get('lacuna')
  const foreman = registry.get('foreman')
  const created = []
  if (!lac || !lac.unwatched || (foreman && foreman.state === 'stale')) return created
  for (const id of [...lac.runs]) {
    const r = registry.get(id)
    if (!r || r.sentry || r.outcome || r.startT == null || r.desk || r.eval || !['working', 'stepping', 'stalled', 'waiting-press'].includes(r.state)) continue
    const due = (r.landT ?? r.startT) + (r.p99Gap == null ? 10 : Math.max(10, 3 * r.p99Gap))
    if (logT < due) continue
    const aid = `alert:${r.id}:no-sentry`
    if (registry.get(aid)?.raisedT != null && registry.get(aid).resolvedT == null) continue
    const rec = ctx.get('alert', aid)
    rec.derived = true
    raise(A, rec, r.id, 'no-sentry', 'warn', registry, due, true)
    created.push(rec)
  }
  chooseFlasher(A, registry, logT)
  return created
}

/**
 * The director saw this actor at `logT` (ghost until seen; changed since you looked): its alerts are seen, its ghost fades.
 * @param {!Object} A @param {!Object} rec @param {!Map<string, !Object>} registry @param {number} logT
 */
export function seen(A, rec, registry, logT) {
  rec.visible = true
  for (const id of rec.alarms) {
    const a = registry.get(id)
    if (!a) continue
    a.offScreen = false
    if (a.resolvedT == null) a.seenWhileRaised = true
    else if (!a.seen) { a.seen = true; a.seenT = logT }
  }
}

/**
 * The off-screen marker list (A3 §4.13): alerts whose actor is not in frame, with level and bearing data for the renderer.
 * @param {!Object} A @param {!Map<string, !Object>} registry
 * @return {!Array<{id: string, actorId: string, level: string, at: {x: number, z: number}, flasher: boolean}>}
 */
export function markers(A, registry) {
  const out = []
  for (const r of registry.values()) if (r.kind === 'alert' && r.raisedT != null && r.resolvedT == null && !r.hidden && r.offScreen) out.push({ id: r.id, actorId: r.actorId, level: r.level, at: r.at, flasher: r.flasher })
  return out
}

/**
 * The one flasher's alert id, or null.
 * @param {!Object} A
 * @return {?string}
 */
export const flasher = (A) => A.flasher

/**
 * The flood state per area.
 * @param {!Object} A
 * @return {!Object}
 */
export const flood = (A) => A.flood

/**
 * Pages raised in the UTC day of `tMs` (the owner's budget is two; a count, never a gate).
 * @param {!Object} A @param {number} tMs
 * @return {number}
 */
export const pagesToday = (A, tMs) => A.pages.filter((t) => Math.floor(t / 86_400_000) === Math.floor(tMs / 86_400_000)).length

/**
 * Restores the flasher and the flood state from a keyframe.
 * @param {!Object} A @param {?string} flasherId @param {!Object} floodState @param {!Map<string, !Object>} registry
 */
export function restore(A, flasherId, floodState, registry) {
  A.flasher = flasherId ?? null
  A.flood = floodState ?? {}
  A.pages = []
}
