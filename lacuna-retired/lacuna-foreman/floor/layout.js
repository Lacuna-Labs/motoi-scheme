// layout.js — THE LAYOUT (lane F5-BC; THE-FLOOR-5.0 law 9, §3.5; A3 §6; A4 §5.4; RULINGS C-44, M-09, Q-A16). Owns: fixed
// slots from ids (the stage row center-out, the queue arc at 12° ≤ 12, the arsenal's alternating back row, the rack's ten,
// the family edge, the fixed places of Lacuna, the foreman, the landmarks and the giants), the front-chain packer that seats
// a new ring without moving a seated one (36 angles × 6 radii, the 18-unit buffer, the work field), the exact critically
// damped spring at a fixed 60 Hz step with the half-life `clamp(0.12 × mT, 0.12, 0.30)`, 3-pass push-apart over unseated
// bodies, the pin (settled 1 s = seated), the reflow queue (one ring at a time, 240 ms apart, 120 ms past three), the ≤ 4
// movers FIFO with its yield order (a fall and a come-here never wait; a reflow waits first, then a return, then a toring,
// then a home flight), the mind to its ring and back, and the checkpoint block of the keyframe. Refuses: moving a seated
// actor to make room, a random jitter, a frame-rate step, a reflow because something changed color, moving Lacuna, the
// foreman, the rack, the landmarks or the giants, a body not in the registry. Implements: A3 §6; master §2.3 (follow), §3.5.
// Invariants (design §18): "a seated actor is never moved to make room"; "one ring re-flows at a time". Faults (§16): none.

import { halfLife } from './curves.js'
import { STEP_HZ, STEP_S, stepIndex } from './clock.js'
import { travelFactor, baseOf } from './vocabulary.js'
import { radiusOf, BUFFER } from './actors/ring.js'
import { RACK } from './actors/service.js'
import { AT as FOREMAN_AT } from './actors/foreman.js'
import { AT as LACUNA_AT } from './actors/lacuna.js'
import { SIDE as SENTRY_SIDE } from './actors/sentry.js'

/** Fixed places (A3 §4.2, §4.7, §4.9, §4.10; the cortex prism and the desk are this module's rulings, Q-A16). */
export const FIXED = Object.freeze({
  foreman: { x: FOREMAN_AT.x, z: FOREMAN_AT.z }, lacuna: { x: LACUNA_AT.x, z: LACUNA_AT.z }, library: { x: 124, z: -56 }, web: { x: -78, z: -96 },
  cortex: { x: 84, z: -80 }, forge: { x: -52, z: -34 }, desk: { x: 0, z: 52 }, owner: { x: 0, z: 52 }, claude: { x: 112, z: -104 }, cloud: { x: 136, z: -90 }, box: { x: 0, z: 0 },
})
/** The minds' widths by class (A4 §4.1, measured with `boxOf`; lane E's anatomy may change them). */
export const WIDTH = Object.freeze({ e2b: 15.3, e4b: 18.2, '12b': 56.8, '26b': 45.6, '31b': 37.8, '1b': 11.9, '270m': 7.8, embed: 9.0, fn: 7.8 })
/** The work field and the desk's clearance (A3 §6.1). */
export const FIELD = Object.freeze({ x0: -70, x1: 70, z0: -40, z1: 55, deskClear: 18 })
/** The queue arc: 12° slots, ≤ 12 then "+N" (C-44), radius 8.5 about the foreman. */
export const QUEUE = Object.freeze({ step: Math.PI / 15, r: 8.5, max: 12 })
export const MAX_MOVERS = 4
/** The yield order when a fifth mover arrives (A3 §7): lower waits first; a fall and a come-here never wait. */
export const YIELD = Object.freeze({ reflow: 0, return: 1, toring: 2, home: 3, fall: 9, comehere: 9 })
const SETTLE_EPS = 0.05
const SETTLE_S = 1
const BODY_BUFFER = 2

/**
 * A fresh layout state.
 * @return {!Object} {step, reflow: [ringId], reflowAt, pending: [{id, kind, target, askedAt}], movers: [{id, kind, since, until}], next}
 */
export function create() {
  return { step: 0, reflow: [], reflowAt: null, pending: [], movers: [], next: 0, active: new Set(), registry: null, large: null, largeFor: -1 }
}

/**
 * Binds the fold's registry (the fold rebuilds its Map when an id sorts before the last, so the layout reads it through here).
 * @param {!Object} L @param {!Map<string, !Object>} registry
 */
export function bind(L, registry) {
  L.registry = registry
  L.large = null
  L.largeFor = -1
}

/**
 * The slots of a set for its member list (A3 §6.1), pure in the list; a `null` member is a held-empty index.
 * @param {string} set stage | queue | arsenal | rack | family
 * @param {!Array<?string>} members
 * @return {!Array<{x: number, z: number, index: number, y?: number}>}
 */
export function slotsFor(set, members) {
  const out = []
  if (set === 'stage' || set === 'arsenal') {
    const gap = set === 'stage' ? 8 : 10
    let right = 0
    let left = 0
    members.forEach((id, i) => {
      const w = WIDTH[baseOf(id ?? 'e4b')] ?? 18
      const row = set === 'stage' ? Math.floor(i / 5) : 0
      const k = set === 'stage' ? i % 5 : i
      const z = set === 'stage' ? 3 - row * 46 : -96
      if (k === 0) { right = w / 2; left = -w / 2; out.push({ x: 0, z, index: i }); return }
      if (k % 2) { const x = right + gap + w / 2; right = x + w / 2; out.push({ x, z, index: i }) } else { const x = left - gap - w / 2; left = x - w / 2; out.push({ x, z, index: i }) }
    })
    return out
  }
  if (set === 'queue') return members.map((_, k) => ({ x: FOREMAN_AT.x + Math.cos(QUEUE.step * k) * QUEUE.r, z: FOREMAN_AT.z + Math.sin(QUEUE.step * k) * QUEUE.r, y: FOREMAN_AT.y - 1.2 + 0.8 * Math.sin(2 * QUEUE.step * k), index: k, overflow: k >= QUEUE.max }))
  if (set === 'rack') return members.map((id, i) => { const k = RACK.indexOf(id); return { x: -54 + 12 * (k < 0 ? i : k), z: -112, index: i } })
  if (set === 'family') return members.map((_, k) => ({ x: -40 + 8 * k, z: 60, index: k }))
  return members.map((_, index) => ({ x: 0, z: 0, index }))
}

/** The lowest free index of a set, or the end. */
function freeIndex(list) {
  const i = list.indexOf(null)
  return i < 0 ? list.length : i
}

function join(slots, set, id) {
  const list = (slots[set] ||= [])
  const have = list.indexOf(id)
  if (have >= 0) return have
  const i = freeIndex(list)
  list[i] = id
  return i
}

function leave(slots, set, id) {
  const list = slots[set]
  if (!list) return
  const i = list.indexOf(id)
  if (i >= 0) list[i] = null
  while (list.length && list[list.length - 1] == null) list.pop()
}

function seat(rec, at, logT, seated = true) {
  rec.target = { x: at.x, z: at.z }
  rec.pos = { x: at.x, z: at.z }
  rec.vel = { x: 0, z: 0 }
  rec.settledAt = seated ? logT : null
  rec.bodyR = radiusOfBody(rec)
}

function pushable(L, registry) {
  if (L.large && L.largeFor === registry.size && L.largeMap === registry) return L.large
  L.large = [...registry.values()].filter((r) => r.bodyR)
  L.largeFor = registry.size
  L.largeMap = registry
  return L.large
}

/**
 * Seats a new record: a fixed place, or the nearest free slot of its set (A3 §6.4), or the packer for a ring.
 * @param {!Object} L @param {!Map<string, !Object>} registry @param {!Object} rec @param {!Object} slots @param {number} logT
 */
export function place(L, registry, rec, slots, logT) {
  const k = rec.kind
  if (FIXED[rec.id]) { rec.slot = { set: 'fixed', index: 0, ...FIXED[rec.id] }; seat(rec, FIXED[rec.id], logT); return }
  if (k === 'mind') { setSlot(rec, slots, rec.loaded || rec.load?.startT != null ? 'stage' : 'arsenal'); seat(rec, rec.slot, logT); return }
  if (k === 'service') { setSlot(rec, slots, 'rack', rec.name); seat(rec, rec.slot, logT); return }
  if (k === 'visitor') { setSlot(rec, slots, 'family'); seat(rec, rec.slot, logT); return }
  if (k === 'wo' || k === 'worker') { setSlot(rec, slots, 'queue'); seat(rec, rec.slot, logT); return }
  if (k === 'ring') { const c = pack(registry, rec); rec.center = { x: c.x, z: c.z }; rec.slot = { set: 'rings', index: join(slots, 'rings', rec.id), x: c.x, z: c.z }; seat(rec, c, logT); return }
  if (k === 'pad') { const ring = registry.get(`ring:${rec.runId}`); const at = ring ? { x: ring.center.x, z: ring.center.z - (radiusOf(ring.n, ring.w) - 2) } : { x: 0, z: 0 }; rec.slot = { set: 'ring', index: 0, ...at }; seat(rec, at, logT); return }
  if (k === 'sentry') { const at = sentrySeat(registry, rec); rec.slot = { set: 'ring', index: 0, ...at }; seat(rec, at, logT); return }
  if (k === 'stream') { const a = registry.get(rec.from); const b = registry.get(rec.to); const at = a && b ? { x: (a.pos.x + b.pos.x) / 2, z: (a.pos.z + b.pos.z) / 2 } : { x: 0, z: 0 }; rec.slot = { set: 'road', index: 0, ...at }; seat(rec, at, logT); return }
  if (k === 'alert') { const a = registry.get(rec.actorId); const at = a ? { x: a.pos.x, z: a.pos.z } : { x: 0, z: 0 }; rec.at = at; rec.slot = { set: 'mark', index: 0, ...at }; seat(rec, at, logT); return }
  rec.slot = { set: k, index: 0, x: 0, z: 0 }
  seat(rec, { x: 0, z: 0 }, logT)
}

function setSlot(rec, slots, set, key = rec.id) {
  const index = join(slots, set, key)
  const s = slotsFor(set, slots[set])[index]
  rec.slot = { set, index, x: s.x, z: s.z, ...(s.y != null ? { y: s.y } : {}), ...(s.overflow ? { overflow: true } : {}) }
}

/**
 * The mind's seat on its ring: on the radial opposite the pad, inside `R − s/2 − 2` when the body fits beside the star
 * (A3 §6.4); a body wider than its ring stands at the ring's edge outside it, `R + s/2 + 2` out (this module's ruling: the
 * 12B is 57 wide, the largest ring 26).
 */
function mindSeat(ring, mind) {
  const r = radiusOf(ring.n, ring.w)
  const w = WIDTH[baseOf(mind.id)] ?? 18
  const inside = r - w / 2 - 2
  return { x: ring.center.x, z: ring.center.z + (inside >= 1.15 + 2 ? inside : r + w / 2 + 2) }
}

/** Two cube-widths off the mind toward the pad; a second sentry at +60° (A3 §6.1). */
function sentrySeat(registry, rec) {
  const ring = registry.get(`ring:${rec.runId}`)
  if (!ring) return { x: 0, z: 0 }
  const run = registry.get(rec.runId)
  const mind = run?.brain ? registry.get(run.brain) : null
  const from = mind && mind.ring === ring.id ? mindSeat(ring, mind) : ring.center
  const off = 2 * 2.15 + (SENTRY_SIDE[rec.model] ?? 1.2)
  const n = [...registry.values()].filter((r) => r.kind === 'sentry' && r.runId === rec.runId && r.id !== rec.id).length
  const a = -Math.PI / 2 + (n * Math.PI) / 3
  return { x: from.x + Math.cos(a) * off, z: from.z + Math.sin(a) * off }
}

/**
 * The packer (A3 §6.1, §6.4): the new ring's center, the first of 36 angles × 6 radii around each seated ring (nearest the
 * field's anchor first) that overlaps no seated ring by `R_i + R_j + 18` and lies in the field, clear of the desk.
 * @param {!Map<string, !Object>} registry @param {!Object} rec the new ring
 * @return {{x: number, z: number}}
 */
export function pack(registry, rec) {
  const r = radiusOf(rec.n, rec.w)
  const others = [...registry.values()].filter((o) => o.kind === 'ring' && o.id !== rec.id && o.state !== 'gone' && o.center)
  const anchor = { x: 0, z: 8 }
  const fits = (c) => c.x - r >= FIELD.x0 && c.x + r <= FIELD.x1 && c.z - r >= FIELD.z0 && c.z + r <= FIELD.z1 &&
    Math.hypot(c.x - FIXED.desk.x, c.z - FIXED.desk.z) >= r + FIELD.deskClear &&
    others.every((o) => Math.hypot(c.x - o.center.x, c.z - o.center.z) >= r + radiusOf(o.n, o.w) + BUFFER)
  if (others.length === 0 && fits(anchor)) return anchor
  const candidates = []
  for (const o of [{ center: anchor, n: 0, w: 0 }, ...others]) {
    const base = o === others[0] || o.center === anchor ? (o.center === anchor ? 0 : radiusOf(o.n, o.w)) : radiusOf(o.n, o.w)
    for (let k = 0; k < 6; k++) {
      for (let a = 0; a < 36; a++) {
        const d = base + r + BUFFER + k * 4 + (o.center === anchor ? -BUFFER : 0)
        const c = { x: o.center.x + Math.cos((a * Math.PI) / 18) * d, z: o.center.z + Math.sin((a * Math.PI) / 18) * d }
        if (fits(c)) candidates.push({ c, d: Math.hypot(c.x - anchor.x, c.z - anchor.z), k, a })
      }
    }
  }
  candidates.sort((p, q) => p.d - q.d || p.k - q.k || p.a - q.a)
  return candidates[0]?.c ?? { x: FIELD.x1 + r + BUFFER * (others.length + 1), z: anchor.z }
}

/**
 * Steps the integrator at 60 Hz from its last step to the step at or before `logT` (A3 §6.2, §6.3): at each step, the fold's
 * `atStep(t)` (classification at the step's moment, so a transition's effect lands on the same step at every cadence), the
 * reflow queue, the movers FIFO, the spring per active body, 3 passes of push-apart among minds and rings, the pin.
 * @param {!Object} L @param {!Map<string, !Object>} registry @param {number} logT @param {function(number)=} atStep
 */
export function stepTo(L, registry, logT, atStep) {
  const target = stepIndex(logT)
  while (L.step < target) {
    L.step++
    const t = L.step * STEP_S
    if (atStep) atStep(t)
    const reg = L.registry ?? registry
    runReflow(L, reg, t)
    startDue(L, reg, t)
    const moving = []
    for (const rec of L.active) {
      if (!rec.target || (rec.settledAt != null && rec.pos.x === rec.target.x && rec.pos.z === rec.target.z)) { L.active.delete(rec); continue }
      const w = rec.omega ?? (rec.omega = Math.LN2 / halfLife(travelFactor(rec.m ?? 1)))
      const e = rec.decay ?? (rec.decay = Math.exp(-w * STEP_S))
      const dx = rec.pos.x - rec.target.x
      const cx = rec.vel.x + w * dx
      rec.pos.x = rec.target.x + (dx + cx * STEP_S) * e
      rec.vel.x = (rec.vel.x - cx * w * STEP_S) * e
      const dz = rec.pos.z - rec.target.z
      const cz = rec.vel.z + w * dz
      rec.pos.z = rec.target.z + (dz + cz * STEP_S) * e
      rec.vel.z = (rec.vel.z - cz * w * STEP_S) * e
      moving.push(rec)
    }
    if (moving.length) {
      for (let i = 0; i < moving.length; i++) moving[i].movingIdx = i
      const large = pushable(L, reg)
      for (let pass = 0; pass < 3; pass++) pushApart(moving, large, L.step)
      for (const rec of moving) rec.movingIdx = -1
    }
    for (const rec of moving) {
      const near = Math.abs(rec.pos.x - rec.target.x) < SETTLE_EPS && Math.abs(rec.pos.z - rec.target.z) < SETTLE_EPS && Math.abs(rec.vel.x) < SETTLE_EPS && Math.abs(rec.vel.z) < SETTLE_EPS
      if (!near) { rec.nearSince = null; rec.settledAt = null; continue }
      rec.nearSince ??= t
      if (t - rec.nearSince >= SETTLE_S) { rec.settledAt = rec.nearSince + SETTLE_S; rec.pos = { ...rec.target }; rec.vel = { x: 0, z: 0 } }
    }
    endDone(L, t)
  }
}

/** A body's push radius: minds by class width, rings by their radius; the rest are placed, never shoved. */
function radiusOfBody(rec) {
  if (rec.kind === 'mind') return (WIDTH[baseOf(rec.id)] ?? 18) / 2
  if (rec.kind === 'ring') return radiusOf(rec.n, rec.w)
  return 0
}

/**
 * Moves each unseated body by half the overlap along the pair's axis; a seated body takes none (A3 §6.3). Minds and rings
 * are the bodies that push (a star, a sentry and a pad are placed by their ring's geometry and never shoved). A pair of two
 * moving bodies is visited once per pass (`movingIdx` orders them); a seated body is visited from every mover.
 */
function pushApart(moving, large) {
  for (let i = 0; i < moving.length; i++) {
    const a = moving[i]
    if (!a.bodyR) continue
    const ap = a.pos
    const aR = a.bodyR
    const buffer = a.kind === 'ring' ? BUFFER : BODY_BUFFER
    for (let j = 0; j < large.length; j++) {
      const b = large[j]
      if (b === a || b.kind !== a.kind || (b.movingIdx >= 0 && b.movingIdx < i)) continue
      const bp = b.pos
      const min = aR + b.bodyR + buffer
      const dx = ap.x - bp.x
      const dz = ap.z - bp.z
      const d = Math.sqrt(dx * dx + dz * dz)
      if (d >= min || d === 0) continue
      const push = (min - d) / 2
      const bSeated = b.settledAt != null
      const k = (bSeated ? 2 * push : push) / d
      ap.x += dx * k
      ap.z += dz * k
      if (!bSeated) { bp.x -= (dx / d) * push; bp.z -= (dz / d) * push }
    }
  }
}

/**
 * Asks for a move (A3 §7's scheduler): a fall or a come-here starts at once; the rest wait when four run, in the yield order.
 * @param {!Object} L @param {!Object} rec @param {string} kind fall | home | toring | return | reflow | comehere
 * @param {{x: number, z: number}} target @param {number} durS @param {number} logT
 */
export function requestMove(L, rec, kind, target, durS, logT) {
  L.pending = L.pending.filter((p) => p.id !== rec.id)
  L.movers = L.movers.filter((m) => m.id !== rec.id)
  const running = L.movers.length
  if (running < MAX_MOVERS || YIELD[kind] >= 9) { begin(L, rec, kind, target, durS, Math.max(logT, L.next)); return }
  L.pending.push({ id: rec.id, kind, target, durS, askedAt: logT })
  L.pending.sort((a, b) => YIELD[a.kind] - YIELD[b.kind] || a.askedAt - b.askedAt)
}

function begin(L, rec, kind, target, durS, since) {
  rec.target = { x: target.x, z: target.z }
  rec.settledAt = null
  rec.nearSince = null
  L.active.add(rec)
  L.movers.push({ id: rec.id, kind, since, until: since + durS })
  L.next = since + 0.12
}

function startDue(L, registry, t) {
  while (L.pending.length && L.movers.length < MAX_MOVERS && t >= L.next) {
    const p = L.pending.pop()
    const rec = registry.get(p.id)
    if (rec) begin(L, rec, p.kind, p.target, p.durS, t)
  }
}

function endDone(L, t) {
  for (const m of L.movers) if (t >= m.until) { L.movers = L.movers.filter((x) => t < x.until); return }
}

/**
 * The layout's reaction to a state change (A3 §6.4): the mind to its ring on a landing and back on the ring's `gone`, a
 * star's fall and home flight as movers, a queued run leaving the arc, a dark mind to the arsenal, a loading one to the stage.
 * @param {!Object} L @param {!Map<string, !Object>} registry @param {!Object} rec @param {number} logT
 */
export function onTransition(L, registry, rec, logT) {
  const slots = L.slots
  if (!slots) return
  const at = Math.min(logT, rec.since ?? logT)
  if (rec.kind === 'mind') {
    const want = rec.state === 'dark' || rec.state === 'refused' ? 'arsenal' : rec.state === 'evicted' ? null : 'stage'
    if (want && rec.slot?.set !== want && rec.slot?.set !== 'ring') { leave(slots, want === 'stage' ? 'arsenal' : 'stage', rec.id); setSlot(rec, slots, want); requestMove(L, rec, want === 'stage' ? 'return' : 'home', rec.slot, 1.1 * travelFactor(rec.m), at) }
    return
  }
  if (rec.kind === 'worker') {
    const ring = registry.get(`ring:${rec.id}`)
    if (rec.state === 'budding' && ring) { leave(slots, 'queue', rec.id); rec.slot = { set: 'ring', index: 0, ...ring.center }; requestMove(L, rec, 'fall', ring.center, 0.2 + rec.flightS, at); seat(rec, ring.center, at) }
    if (rec.state === 'working' && rec.prev?.state === 'falling' && ring && rec.brain) {
      const mind = registry.get(rec.brain)
      if (mind && !mind.desk && mind.slot?.set === 'stage') { mind.heldSlot = mind.slot; mind.heldRing = ring.id; mind.slot = { set: 'ring', index: 0, ...mindSeat(ring, mind) }; mind.ring = ring.id; requestMove(L, mind, 'toring', mind.slot, Math.min(2.6, 1.1 + Math.hypot(mind.pos.x - ring.center.x, mind.pos.z - ring.center.z) * 0.035) * travelFactor(mind.m), at) }
    }
    if ((rec.state === 'passed' || rec.state === 'stopped') && !rec.stop?.parked) requestMove(L, rec, 'home', FIXED.foreman, 1 + rec.flightS, at + (rec.state === 'passed' ? 1 : 0.4))
    return
  }
  if (rec.kind === 'ring' && rec.state === 'gone') {
    leave(slots, 'rings', rec.id)
    for (const m of registry.values()) if (m.kind === 'mind' && m.heldRing === rec.id && m.heldSlot) { m.slot = m.heldSlot; m.heldSlot = null; m.heldRing = null; m.ring = null; requestMove(L, m, 'return', m.slot, 1.1 * travelFactor(m.m), at) }
  }
}

/**
 * A ring's radius changed: queue its reflow; the queue runs at the 60 Hz step boundaries, one ring at a time, 240 ms apart
 * (120 ms past three), and the ring and its members move as one body (A3 §6.4).
 * @param {!Object} L @param {!Object} ring
 */
export function reflow(L, ring) {
  if (!L.reflow.includes(ring.id)) L.reflow.push(ring.id)
}

function runReflow(L, registry, logT) {
  if (!L.reflow.length) return
  if (L.reflowAt != null && logT - L.reflowAt < (L.reflow.length > 3 ? 0.12 : 0.24) - 1e-9) return
  const id = L.reflow.shift()
  const ring = id && registry.get(id)
  if (!ring) return
  const c = pack(registry, ring)
  const dx = c.x - ring.center.x
  const dz = c.z - ring.center.z
  ring.center = { x: c.x, z: c.z }
  ring.bodyR = radiusOf(ring.n, ring.w)
  L.active.add(ring)
  ring.reflowT = logT
  L.reflowAt = logT
  requestMove(L, ring, 'reflow', c, 0.24, logT)
  for (const m of registry.values()) if (m !== ring && m.slot?.set === 'ring' && (m.id === `pad:${ring.runId}` || m.runId === ring.runId || m.ring === ring.id || m.id === ring.runId)) requestMove(L, m, 'reflow', { x: m.target.x + dx, z: m.target.z + dz }, 0.24, logT)
}

/**
 * The checkpoint block of the keyframe (A3 §8): `{step, reflow, reflowAt, pending, next}`; positions ride each record.
 * @param {!Object} L
 * @return {!Object}
 */
export const checkpoint = (L) => ({ step: L.step, reflow: L.reflow, reflowAt: L.reflowAt, pending: L.pending, next: L.next })

/**
 * Restores a checkpoint block and the movers FIFO.
 * @param {!Object} L @param {!Object} block @param {!Array} movers @param {!Map<string, !Object>} registry
 */
export function restore(L, block, movers, registry) {
  L.step = block.step ?? 0
  L.reflow = block.reflow ?? []
  L.reflowAt = block.reflowAt ?? null
  L.pending = block.pending ?? []
  L.next = block.next ?? 0
  L.movers = movers ?? []
  L.active = new Set([...registry.values()].filter((r) => r.target && !(r.settledAt != null && r.pos.x === r.target.x && r.pos.z === r.target.z)))
  bind(L, registry)
}

/**
 * The movers FIFO: `[{id, kind, since, until}]`, at most 4 (A3 §7).
 * @param {!Object} L
 * @return {!Array<!Object>}
 */
export const movers = (L) => L.movers

/**
 * Forgets a removed actor.
 * @param {!Object} L @param {string} id
 */
export function forget(L, id) {
  for (const r of L.active) if (r.id === id) L.active.delete(r)
  L.large = null
  L.movers = L.movers.filter((m) => m.id !== id)
  L.pending = L.pending.filter((p) => p.id !== id)
  L.reflow = L.reflow.filter((r) => r !== id)
}

export { STEP_HZ }
