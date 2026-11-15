// actors/index.js — THE KIND TABLE (lane F5-BC; A3 §1, §3, §9; RULINGS §1(b) C-26). Owns: the sixteen record kinds `mind
// foreman worker ring sentry pad lacuna service landmark giant visitor stream alert owner wo box` (`packet` is a table
// inside stream), the module of each, the kind of an id, the routing of one event to the records it updates, the set of
// event kinds the fold reacts to, the mass unit, and `classifyAll`. Refuses: a kind outside the table, an event with no
// route (the fold refuses it with its reason), importing fold.js (the fold imports this, never the reverse).
// Implements: A3 §3.2's id forms, §9 `actors/index.js`; RULINGS §1(b). Invariants (design §18): "a record or nothing"
// (an event that names no record is refused, never guessed into one). Faults (§16): none.

import * as mind from './mind.js'
import * as foreman from './foreman.js'
import * as worker from './worker.js'
import * as ring from './ring.js'
import * as sentry from './sentry.js'
import * as pad from './pad.js'
import * as lacuna from './lacuna.js'
import * as service from './service.js'
import * as landmark from './landmark.js'
import * as giant from './giant.js'
import * as visitor from './visitor.js'
import * as stream from './stream.js'
import * as alert from './alert.js'
import * as owner from './owner.js'
import * as wo from './wo.js'
import * as box from './box.js'

/** The record kinds, frozen (RULINGS §1(b)). */
export const KINDS = Object.freeze([
  'mind', 'foreman', 'worker', 'ring', 'sentry', 'pad', 'lacuna', 'service', 'landmark', 'giant', 'visitor', 'stream', 'alert',
  'owner', 'wo', 'box',
])

/** Kind → its module (`create apply classify transitions pose STATES LIGHTS COUNTERS REACTS PERIOD_S`). */
export const MODULES = Object.freeze({
  mind, foreman, worker, ring, sentry, pad, lacuna, service, landmark, giant, visitor, stream, alert, owner, wo, box,
})

/** The landmarks that stand on the floor from the first frame (A3 §4.9). */
export const LANDMARKS = Object.freeze(['library', 'web', 'cortex', 'forge', 'desk'])
/** The giants (A3 §4.10). */
export const GIANTS = Object.freeze(['claude', 'cloud'])

/**
 * The kind of an actor id (A3 §3.2's id forms).
 * @param {string} id
 * @return {?string}
 */
export function kindOf(id) {
  const s = String(id)
  if (s === 'foreman') return 'foreman'
  if (s === 'lacuna') return 'lacuna'
  if (s === 'owner') return 'owner'
  if (s === 'box') return 'box'
  if (GIANTS.includes(s)) return 'giant'
  if (LANDMARKS.includes(s)) return 'landmark'
  if (s.startsWith('ring:')) return 'ring'
  if (s.startsWith('pad:')) return 'pad'
  if (s.startsWith('sentry-')) return 'sentry'
  if (s.startsWith('svc:')) return 'service'
  if (s.startsWith('alert:')) return 'alert'
  if (s.startsWith('visitor:')) return 'visitor'
  if (s.startsWith('road:')) return 'stream'
  if (s.startsWith('wo-')) return 'wo'
  if (s.startsWith('w-') || s.startsWith('ci:') || s.startsWith('scheme:')) return 'worker'
  if (/^(e2b|e4b|12b|26b|31b|1b|270m|fn|embed)(-\d+)?$/.test(s)) return 'mind'
  return null
}

/** The event kinds the fold reacts to: every module's `REACTS` plus the floor's own (A2 §3.9). */
export const KINDS_REACTED = new Set([
  ...Object.values(MODULES).flatMap((m) => m.REACTS),
  'floor.open', 'floor.quarantine', 'floor.stale', 'floor.fresh', 'floor.keyframe', 'floor.client', 'floor.truth',
  'scene.begin', 'scene.end', 'scene.place', 'scene.say', 'scene.camera', 'scene.expect', 'scene.verdict', 'scene.mark', 'scene.score',
  'box.up', 'box.down.begin', 'box.down.end',
])

/**
 * The records one event updates, in order: `[{kind, id}]` (A2 §3's Fold column; A3 §3.2's id forms). Empty when the fold
 * handles the event itself (the floor and scene families).
 * @param {!Object} ev the event, camel fields: {seq, t, kind, actor, at, ref, data}
 * @param {!Map<string, !Object>} registry
 * @return {!Array<{kind: string, id: string}>}
 */
export function targets(ev, registry) {
  const k = ev.kind
  const fam = k.slice(0, k.indexOf('.'))
  const out = []
  const add = (kind, id) => { if (id && !out.some((x) => x.kind === kind && x.id === String(id))) out.push({ kind, id: String(id) }) }
  switch (fam) {
    case 'mind': {
      add('mind', ev.actor)
      if (k === 'mind.read') add('landmark', ev.data?.from === 'web' ? 'web' : ev.data?.from === 'cortex' ? 'cortex' : 'library')
      if (k === 'mind.swap') { add('mind', ev.data?.to); add('mind', ev.data?.from) }
      const who = ev.data?.who ?? registry.get(ev.actor)?.turn?.who ?? null
      if (k.startsWith('mind.turn.') && who === 'lacuna') add('lacuna', 'lacuna')
      if (k.startsWith('mind.turn.') && who === 'owner') add('landmark', 'desk')
      if (k === 'mind.load.start' && ev.data?.by === 'lacuna') add('lacuna', 'lacuna')
      break
    }
    case 'ci':        // a CI pass and its suites, a Scheme eval: work as runs (actors/worker.js asRunEdges; the owner, 2026-11-04)
    case 'scheme':
    case 'run':
    case 'press':
    case 'hands': {
      add('worker', ev.actor)
      if (fam === 'press') add('owner', 'owner')
      if (fam === 'press' && ev.data?.by === 'lacuna') add('lacuna', 'lacuna')
      const brain = (k === 'run.start' && typeof ev.data?.brain === 'string' ? ev.data.brain : null) ?? registry.get(ev.actor)?.brain ?? null
      if (brain && registry.has(brain)) add('mind', brain)
      if (['run.start', 'run.pass', 'run.fail', 'run.stop', 'run.crash'].includes(k)) add('lacuna', 'lacuna')
      if (['run.pass', 'run.fail', 'run.stop', 'run.crash'].includes(k)) { const s = registry.get(ev.actor)?.sentry; if (s && registry.has(s)) add('sentry', s) }   // the run's sentry leaves with it
      break
    }
    case 'sentry': {
      add('sentry', ev.actor)
      add('lacuna', 'lacuna')
      const brain = registry.get(String(ev.ref ?? ''))?.brain
      if (k === 'sentry.warn' && brain && registry.has(brain)) add('mind', brain)
      break
    }
    case 'foreman':
      add('foreman', 'foreman')
      if (['foreman.spawn', 'foreman.crash', 'foreman.restart', 'foreman.grave'].includes(k)) add('worker', ev.data?.id)
      break
    case 'wo': add('wo', ev.actor); break
    case 'service':
      add('service', `svc:${ev.actor}`)
      add('lacuna', 'lacuna')
      if (ev.actor === 'foreman') add('foreman', 'foreman')
      if (ev.actor === 'library') add('landmark', 'library')
      if (['lme', 'brain'].includes(ev.actor)) for (const r of registry.values()) if (r.kind === 'mind') add('mind', r.id)
      break
    case 'door': add('service', 'svc:door'); break
    case 'alert': add('alert', ev.actor); break
    case 'owner': add('owner', 'owner'); if (k === 'owner.read') add('landmark', 'library'); break   // a page of the library read: the tower lights too
    case 'cortex': add('landmark', 'cortex'); break
    case 'forge': add('landmark', 'forge'); break
    case 'box':
      if (k === 'box.coast' || k === 'box.memory' || k === 'box.disk' || k === 'box.lease') add('box', 'box')
      if (k === 'box.coast') for (const r of registry.values()) if (r.kind === 'mind') add('mind', r.id)
      break
    case 'visitor': add('visitor', ev.actor); break
    case 'cloud': add('giant', 'cloud'); break
    case 'claude': add('giant', 'claude'); break
    default: break
  }
  return out
}

/**
 * Classifies every record at `logT` in one pass, committing the result (`state cause since prev ceremony`) on each. On a tick
 * (no event) a record in one of its module's `FINAL` states is skipped until an event touches it: a gone ring, a dormant road,
 * a finished run change only by a record.
 * @param {!Map<string, !Object>} registry
 * @param {number} logT seconds
 * @param {boolean=} onTick true when no event brought the pass
 * @return {!Array<!Object>} the records whose state changed
 */
export function classifyAll(registry, logT, onTick = false) {
  const changed = []
  for (const rec of registry.values()) {
    if (onTick && !rec.touched && MODULES[rec.kind].FINAL?.has(rec.state)) continue
    if (commit(rec, logT, registry)) changed.push(rec)
  }
  return changed
}

/**
 * Classifies one record at `logT` and commits the result; returns true when the state changed. The ceremony's first keyframe
 * (`prev.pose`) is the old state's pose at the transition's own moment (`next.since`), never at the tick that found it.
 * @param {!Object} rec
 * @param {number} logT
 * @param {!Map<string, !Object>=} registry the other records a classify may read as data (a ring its run, a child its parent)
 * @return {boolean}
 */
export function commit(rec, logT, registry) {
  const mod = MODULES[rec.kind]
  const next = mod.classify(rec, logT, registry)
  const changed = next.state !== rec.state
  if (changed) {
    rec.prev = { state: rec.state, since: rec.since, pose: rec.state == null ? null : mod.pose(rec, Math.min(logT, next.since ?? logT)) }
    rec.ceremony = mod.transitions(rec.state, next.state)
  }
  rec.state = next.state
  rec.cause = next.cause ?? null
  rec.since = next.since
  rec.touched = false
  return changed
}
