// fold.js — THE FOLD (lane F5-BC; THE-FLOOR-5.0 §2.2 `model.js`, law 2, law 3; A3 §3, §7, §8; A8 §4.1; RULINGS §1(b) and REVIEW
// §5b verbatim). Owns: the fold handle (one per floor: the foreman's eval floors and the browser's live floor share no module
// state), seq-ordered events folded into the actors registry (the record head of A3 §3.1 and each kind's tail), the order of
// one fold step (settle the clock → the floor's own events → each target record's `apply` → the roads → the alarm rules →
// `classifyAll` → the layout's reaction to each transition), the snapshot and restore of the canonical `(state …)` text, the
// keyframe taken at `scene.begin`, `tick` (the integrators stepped and the delays elapsed to a logT with no event: a stall is a
// transition no event announces), the director's one local input (`seen`), and the reader of `(ev …)` text for tests and
// scenes; Lacuna, the foreman, the box, the owner, the landmarks and the giants are seated at logT 0 (they are places and
// columns; a row lights them, never creates them). Every 60 Hz step of the layout classifies the registry at that step's
// moment, so a transition's effect lands on the same step at every tick cadence. Refuses: an event of a kind outside the
// catalog (refused with its reason, never guessed into a record), a seq at or below the last folded within its day, and an
// event of a day before the fold's (the client refolds from its snapshot, D3; a day restarts seq at 1, A2 §5.3), an event that
// names no record, a wall clock, three, the DOM, `Math.random`. Implements: master §2.2, §2.6 item 3; A3 §3, §7, §8; A8 §4.1;
// RULINGS §1(b). Invariants (design §18): "a record or nothing"; "live, replay, drills and scenes are one code path" (nothing
// here knows which it is folding); "restore then fold forward equals a straight fold". Faults (§16): none raised; a refusal is
// a row in `refused(f)` and a count in the floor block.

import { readForms, dataToJson } from '../../../lacuna-scheme/src/slat-data.js'
import { MODULES, KINDS, KINDS_REACTED, LANDMARKS, GIANTS, targets, classifyAll, commit } from './actors/index.js'
import * as stream from './actors/stream.js'
import * as layout from './layout.js'
import * as alarms from './alarms.js'
import { writeState, readState, blankPose } from './keyframe.js'
import { seedOf } from './seed.js'
import { epochOf } from './clock.js'

export { KINDS, KINDS_REACTED }

/** The registry keeps the last 32 events of a record (A3 §3.1); the keyframe cuts them to 8. */
export const EVENTS_RING = 32
/** Refusals kept on the handle for a reader. */
const REFUSED_KEPT = 32

/**
 * @typedef {Object} Event one `(ev …)` as JS: {seq, t, kind, actor, at, ref, src: [producer, pseq], data: {kebab keys}}
 * @property {number} seq @property {number} t ms UTC @property {string} kind @property {string} actor @property {string} at
 * @property {?string} ref @property {!Array} src @property {!Object} data
 */

/**
 * @typedef {Object} Head the common head of every record (A3 §3.1); each kind adds its tail (actors/<kind>.js `create`)
 * @property {string} id @property {string} kind
 * @property {?string} state the committed state (classify, after its on-delay) @property {?string} cause
 * @property {number} since logT at which the state was entered @property {number} stateAt logT of the last commit
 * @property {?{state: ?string, since: number, pose: ?Array<number>}} prev the state before, for the ceremony's first keyframe
 * @property {?string} ceremony A3 §5.6's id of the ceremony that entered the state, or null for a cut
 * @property {number} seenAt logT of the newest event for this actor @property {number} period the expected event period, s
 * @property {!Array<{seq: number, t: number, kind: string, data: !Object}>} events the last 32
 * @property {?{set: string, index: number, x: number, z: number}} slot @property {{x: number, z: number}} pos
 * @property {{x: number, z: number}} vel @property {?{x: number, z: number}} target @property {?number} settledAt
 * @property {number} seed uint32 @property {number} m mass @property {!Array<string>} alarms alert ids
 * @property {boolean} changed a state change while off-screen, until seen
 */

/**
 * A fold handle at logT 0 of `epoch`, with the actors that stand on the floor from the first frame: Lacuna, the foreman, the
 * box, the owner and the landmarks (A3 §4.7, §4.9; master §3.2: Lacuna is never absent).
 * @param {{epoch: number}} o `epoch` ms UTC; floored to its hour (A6 §2.5)
 * @return {!Object} the handle: {epoch, day, seq, t, logT, registry, layout, alarms, slots, floor, sceneKeyframe, refused}
 */
export function createFold({ epoch }) {
  const f = {
    epoch: epochOf(epoch), day: null, seq: 0, t: null, logT: 0, registry: new Map(), layout: layout.create(), alarms: alarms.create(),
    slots: {}, floor: { scene: null, bad: {}, stale: [], quarantine: 0, clients: 0, up: null }, sceneKeyframe: null, refused: [],
  }
  f.layout.slots = f.slots
  layout.bind(f.layout, f.registry)
  for (const [kind, id] of [['lacuna', 'lacuna'], ['foreman', 'foreman'], ['box', 'box'], ['owner', 'owner'], ...LANDMARKS.map((l) => ['landmark', l]), ...GIANTS.map((g) => ['giant', g])]) {
    ensure(f, kind, id, 0, null)
  }
  classifyAll(f.registry, 0)
  return f
}

/**
 * Folds seq-ordered events: for each, the fold settles at its moment, the record(s) it names apply it, the roads take its
 * packet, the alarm rules run, every record is classified and the layout reacts to each transition (REVIEW §5b). A day
 * restarts `seq` at 1 (A2 §5.3): an event's `day`, the reader's mark (the day file's name, the SSE id's `<day>:`), later than
 * the fold's opens that day and its count; an earlier one is refused `seq`; an event with no mark keeps the fold's day. A row
 * refused in order (its kind, its clock, no record) still passes its seq: the fold's seq is the last row it has read.
 * @param {!Object} f @param {!Array<!Event>} events
 * @return {number} the events folded; a refused event is a row in `refused(f)` and a count in `f.floor.bad`
 */
export function fold(f, events) {
  let n = 0
  for (const ev of events) {
    if (!ev || typeof ev !== 'object') { refuse(f, ev, 'unknown-kind'); continue }
    if (typeof ev.day === 'string' && ev.day !== f.day) {
      if (f.day !== null && ev.day < f.day) { refuse(f, ev, 'seq'); continue }
      f.day = ev.day
      f.seq = 0
    }
    if (!(Number.isInteger(ev.seq) && ev.seq > f.seq)) { refuse(f, ev, 'seq'); continue }
    // in order from here: a refused row still passes its seq, so the fold's seq is the last row it has read (A2 §5.2: a
    // keyframe's seq names the row it stands after; a resume starts from it)
    if (typeof ev.kind !== 'string' || !KINDS_REACTED.has(ev.kind)) { refuse(f, ev, 'unknown-kind'); f.seq = ev.seq; continue }
    if (!Number.isFinite(ev.t)) { refuse(f, ev, 'clock'); f.seq = ev.seq; continue }
    const logT = (ev.t - f.epoch) / 1000
    tick(f, logT)
    const ctx = context(f, logT)
    if (!applyFloor(f, ev, logT)) {
      const hits = targets(ev, f.registry)
      if (hits.length === 0) { refuse(f, ev, 'no-record'); f.seq = ev.seq; f.t = ev.t; continue }
      for (const { kind, id } of hits) {
        const rec = ensure(f, kind, id, logT, ev)
        note(rec, ev, logT)
        MODULES[kind].apply(rec, ev, ctx)
      }
    }
    for (const road of stream.roadsOf(ev, f.registry)) {
      const rec = ensure(f, 'stream', road.id, logT, ev)
      note(rec, ev, logT)
      stream.apply(rec, ev, { ...ctx, road })
    }
    alarms.fold(f.alarms, ev, f.registry, logT, ctx)
    settle(f, logT)
    f.seq = ev.seq
    f.t = ev.t
    n++
  }
  return n
}

/**
 * Settles the fold at `logT` with no event: the layout steps at 60 Hz to that moment, every delay elapses, every
 * classification is committed and the layout reacts to each transition. A logT behind the fold's is left as it stands.
 * @param {!Object} f @param {number} logT seconds
 * @return {!Array<!Object>} the records whose state changed
 */
export function tick(f, logT) {
  if (!(logT > f.logT)) return []
  return settle(f, logT, true)
}

function settle(f, logT, onTick = false) {
  const changed = []
  const note_ = (c) => { for (const r of c) if (!changed.includes(r)) changed.push(r) }
  layout.stepTo(f.layout, f.registry, logT, (t) => {
    note_(classifyAt(f, t, true))
    pruneAtStep(f, t)
  })
  note_(classifyAt(f, logT, onTick))
  f.logT = Math.max(f.logT, logT)
  return changed
}

/**
 * Prunes retired ephemeral actors after their exit ceremony and grace window (`A3` lifetimes; `P-2026-11-01-floor-state-too-long`).
 * Runs on the 60 Hz step boundary inside `settle` so 30/60/120 Hz cadences and snapshot/restore stay bit-identical.
 * @param {!Object} f @param {number} t seconds
 * @return {!Array<string>} pruned actor ids
 */
export function prune(f, t = f.logT) {
  return pruneAtStep(f, t)
}

function isEndpointGone(reg, ep) {
  if (!ep) return false
  if (ep.startsWith('pad:')) return !reg.has(`ring:${ep.slice(4)}`)
  if (ep.startsWith('w-')) return !reg.has(`ring:${ep}`)
  if (ep.startsWith('ring:') || ep.startsWith('sentry-') || ep.startsWith('visitor:') || ep.startsWith('wo-')) {
    return !reg.has(ep)
  }
  return false
}

const RETIRE_GRACE_S = 90

function shouldRetire(reg, rec, t) {
  const dt = t - (rec.since ?? 0)
  if (dt < RETIRE_GRACE_S) return false
  switch (rec.kind) {
    case 'ring':
      return rec.state === 'gone'
    case 'sentry':
      return rec.state === 'detached'
    case 'alert':
    case 'visitor':
      return rec.state === 'gone'
    case 'wo':
      return rec.state === 'done' && (!rec.run || !reg.has(rec.run))
    case 'worker':
      if (rec.state === 'passed' || (rec.state === 'stopped' && rec.outcome === 'stopped')) {
        return !reg.has(`ring:${rec.id}`)
      }
      return rec.state === 'failed' && rec.ackT != null && t - rec.ackT >= RETIRE_GRACE_S
    case 'stream':
      return rec.state === 'dormant' && (isEndpointGone(reg, rec.from) || isEndpointGone(reg, rec.to))
    default:
      return false
  }
}

function pruneAtStep(f, t) {
  const gone = []
  for (const rec of f.registry.values()) {
    if (shouldRetire(f.registry, rec, t)) {
      gone.push(rec.id)
      if (rec.kind === 'ring' && rec.runId && f.registry.has(`pad:${rec.runId}`)) {
        gone.push(`pad:${rec.runId}`)
      }
    }
  }
  for (const id of gone) {
    f.registry.delete(id)
    layout.forget(f.layout, id)
  }
  return gone
}

/** One classification pass to a fixpoint at `t`, with the layout's and the alarms' reactions to each transition. */
function classifyAt(f, t, onTick) {
  for (const r of f.registry.values()) if (r.kind === 'ring' && r.reflowAsk) { r.reflowAsk = false; layout.reflow(f.layout, r) }
  const changed = []
  for (let pass = 0; pass < 3; pass++) {
    const c = classifyAll(f.registry, t, onTick && pass === 0)
    for (const rec of c) if (!changed.includes(rec)) changed.push(rec)
    if (c.length === 0) break
  }
  const ctx = context(f, t)
  for (const rec of changed) {
    layout.onTransition(f.layout, f.registry, rec, t)
    alarms.onTransition(f.alarms, rec, f.registry, t, ctx)
  }
  for (const rec of alarms.unwatched(f.alarms, f.registry, t, ctx)) { commit(rec, t, f.registry); changed.push(rec) }
  return changed
}

/**
 * The actors registry: one record per actor id (the head of A3 §3.1 and the kind's tail).
 * @param {!Object} f
 * @return {!Map<string, !Object>}
 */
export const registry = (f) => f.registry

/**
 * One record, or null.
 * @param {!Object} f @param {string} id
 * @return {?Object}
 */
export const actor = (f, id) => f.registry.get(id) ?? null

/**
 * The closed-form pose of an actor at `logT` (actors/<kind>.js `pose(rec, logT)`), sixteen channels in keyframe.js's order;
 * null for an unknown id. The fold is settled at `logT` first.
 * @param {!Object} f @param {string} id @param {number} logT
 * @return {?Array<number>}
 */
export function pose(f, id, logT) {
  const rec = f.registry.get(id)
  if (!rec) return null
  tick(f, logT)
  return MODULES[rec.kind].pose(rec, logT)
}

/**
 * The canonical `(state …)` text at `logT`: the registry (events cut to 8), the floor block, the layout checkpoint, the
 * flasher, the movers, the flood state, the slot order and every pose quantized to 1/4,096 (A3 §8; C-25; C-64).
 * @param {!Object} f @param {number} logT
 * @return {string}
 */
export function snapshot(f, logT) {
  tick(f, logT)
  const poses = new Map()
  for (const rec of f.registry.values()) poses.set(rec.id, MODULES[rec.kind].pose(rec, logT) ?? blankPose())
  return writeState({
    t: f.t, seq: f.seq, epoch: f.epoch, logT, actors: [...f.registry.values()], floor: f.floor,
    layout: layout.checkpoint(f.layout), flasher: alarms.flasher(f.alarms), movers: layout.movers(f.layout),
    flood: alarms.flood(f.alarms), slots: f.slots, poses,
  })
}

/**
 * Restores a `(state …)` text: a seek or a `scene.end` (the inverse of `snapshot`); the fold then folds forward from
 * `seq + 1`.
 * @param {!Object} f @param {string} text
 * @return {!Object} f
 */
export function restore(f, text) {
  const v = readState(text)
  f.epoch = v.epoch
  f.day = typeof v.extra.day === 'string' ? v.extra.day : null   // lane A's keyframe names its day; a bare snapshot does not
  f.seq = v.seq
  f.t = v.t
  f.logT = v.logT
  f.registry = new Map(v.actors.map((r) => [r.id, r]))
  f.floor = v.floor
  f.slots = v.slots
  f.layout.slots = f.slots
  layout.bind(f.layout, f.registry)
  layout.restore(f.layout, v.layout, v.movers, f.registry)
  alarms.restore(f.alarms, v.flasher, v.flood, f.registry)
  return f
}

/**
 * The `(state …)` taken at the last `scene.begin`: the transaction's undo, restored at `scene.end` (master §2.6 item 4).
 * @param {!Object} f
 * @return {?string}
 */
export const keyframe = (f) => f.sceneKeyframe

/**
 * The director's local input (A3 §7 "ghost until seen", "changed since you looked"): these actors stood in frame,
 * unoccluded, for ≥ 1 s at `logT`. Never written to the log; replay recomputes it from a recorded camera path or treats
 * everything as unseen.
 * @param {!Object} f @param {!Array<string>} ids @param {number} logT
 */
export function seen(f, ids, logT) {
  for (const id of ids) {
    const rec = f.registry.get(id)
    if (!rec) continue
    rec.changed = false
    alarms.seen(f.alarms, rec, f.registry, logT)
  }
}

/**
 * The last 32 refusals: `{seq, kind, why}` with `why` one of unknown-kind · seq · clock · no-record.
 * @param {!Object} f
 * @return {!Array<{seq: ?number, kind: ?string, why: string}>}
 */
export const refused = (f) => f.refused

/**
 * Reads `(ev …)` lines into events (the day file's and a scene's form, A2 §2.1): `(ev (seq n) (t ms) (kind k) (actor "id")
 * (at "…") (ref …) (src "p" n) (data (@ …)) …)`; a trailing `(prev …)` is ignored. For tests and the scene reader.
 * @param {string} text
 * @return {!Array<!Event>}
 */
export function readEvents(text) {
  const out = []
  for (const form of readForms(text)) {
    if (!Array.isArray(form) || String(form[0]) !== 'ev') continue
    const ev = { seq: 0, t: 0, kind: '', actor: '', at: '-', ref: null, src: ['-', 0], data: {} }
    for (const field of form.slice(1)) {
      const name = String(field[0])
      if (name === 'src') ev.src = field.slice(1).map(dataToJson)
      else if (name === 'kind') ev.kind = String(field[1])
      else if (name === 'prev') continue
      else ev[name] = dataToJson(field[1])
    }
    out.push(ev)
  }
  return out
}

function context(f, logT) {
  return {
    f, logT, registry: f.registry,
    get: (kind, id) => ensure(f, kind, id, logT, null),
    has: (id) => f.registry.has(id),
    remove: (id) => { f.registry.delete(id); layout.forget(f.layout, id) },
    slotsOf: (set) => (f.slots[set] ||= []),
  }
}

function ensure(f, kind, id, logT, ev) {
  let rec = f.registry.get(id)
  if (rec) return rec
  const mod = MODULES[kind]
  rec = {
    id, kind, state: null, cause: null, since: logT, prev: null, ceremony: null, seenAt: logT, period: mod.PERIOD_S,
    events: [], slot: null, pos: { x: 0, z: 0 }, vel: { x: 0, z: 0 }, target: null, settledAt: null, seed: seedOf(id), m: 1,
    alarms: [], changed: false, touched: true, ...mod.create(id, logT, ev),
  }
  insert(f, rec)
  layout.place(f.layout, f.registry, rec, f.slots, logT)
  return rec
}

/** The registry keeps one order, by id, so a straight fold and a restored one iterate alike (ties in the packer and the push-apart). */
function insert(f, rec) {
  const last = [...f.registry.keys()].pop()
  if (last == null || last < rec.id) { f.registry.set(rec.id, rec); return }
  const entries = [...f.registry.entries(), [rec.id, rec]].sort((a, b) => (a[0] < b[0] ? -1 : 1))
  f.registry = new Map(entries)
  layout.bind(f.layout, f.registry)
}

function note(rec, ev, logT) {
  rec.touched = true
  rec.seenAt = logT
  rec.events.push({ seq: ev.seq, t: ev.t, kind: ev.kind, data: ev.data ?? {} })
  if (rec.events.length > EVENTS_RING) rec.events.splice(0, rec.events.length - EVENTS_RING)
}

function refuse(f, ev, why) {
  f.refused.push({ seq: ev?.seq ?? null, kind: ev?.kind ?? null, why })
  if (f.refused.length > REFUSED_KEPT) f.refused.shift()
  f.floor.bad[why] = (f.floor.bad[why] || 0) + 1
}

/** The floor's own events (A2 §3.9, scene.*, box.up/down): applied to the floor block and Lacuna's record; true when handled. */
function applyFloor(f, ev, logT) {
  const k = ev.kind
  const lacuna = f.registry.get('lacuna')
  if (k === 'scene.begin') {
    f.sceneKeyframe = snapshot(f, logT)
    f.floor.scene = { name: ev.data.name ?? null, since: logT, secs: ev.data.secs ?? null, by: ev.data.by ?? null }
    return true
  }
  if (k === 'scene.end') { f.floor.scene = null; return true }
  if (k.startsWith('scene.')) { note(lacuna, ev, logT); return true }
  if (k === 'box.up') { f.floor.up = logT; return true }
  if (k === 'box.down.begin' || k === 'box.down.end') { f.floor.down = { phase: k.slice(9), at: logT }; return true }
  if (k === 'floor.stale' || k === 'floor.fresh' || k === 'floor.quarantine') {
    note(lacuna, ev, logT)
    MODULES.lacuna.apply(lacuna, ev, context(f, logT))
    if (k === 'floor.quarantine') f.floor.quarantine += ev.data.n ?? 1
    if (k === 'floor.stale') {
      f.floor.stale = [...new Set([...f.floor.stale, ev.data.producer])]
      for (const id of ev.data.actors ?? []) { const r = f.registry.get(String(id)); if (r) { r.stale = logT; r.staleProducer = ev.data.producer ?? null } }
    }
    if (k === 'floor.fresh') {
      f.floor.stale = f.floor.stale.filter((p) => p !== ev.data.producer)
      for (const r of f.registry.values()) if (r.staleProducer === ev.data.producer) { r.stale = null; r.staleProducer = null }
    }
    return true
  }
  if (k === 'floor.client') { f.floor.clients = ev.data.n ?? f.floor.clients; return true }
  if (k.startsWith('floor.')) return true
  return false
}
