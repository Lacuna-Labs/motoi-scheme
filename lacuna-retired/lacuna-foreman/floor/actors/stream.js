// actors/stream.js — THE STREAMS AND PACKETS (lane F5-BC; THE-FLOOR-5.0 §3.8; A3 §4.12, §5.5; A4 §2.11; RULINGS C-32, C-77).
// Owns: which events ride which road (`roadsOf`: a text cube per 8 answered tokens, the intent packet to the pad and the
// receipt back, the sentry wire and audit diamonds, the foreman's droplet, the library's pages, the cloud's and Claude's
// words, error diamonds for every failure), a road's record tail (kind, from, to, identity, the 10 s rate, the width bin,
// the latency state, the sampling count, the packet ring ≤ 64), its five states (dormant · live · sampled · over-budget ·
// fading), its ceremonies, the road's pose and the packet pose in closed form (the reference lane D compiles to its vertex
// shader: `u = (logT − t0) / dur`, `dur = clamp(0.5 + len × 0.0045, 0.5, 0.9)`, the arc lifted by max(1.2, len × 0.18), an
// error diamond that flies 85 % of the road and fades without landing). Refuses: ≥ 8 packets/s on one road (it samples and
// prints N), a packet whose speed encodes a value, a road with no record, a landing error diamond, a `Math.random` spin.
// Implements: A3 §4.12, §5.5. Invariants (design §18): "an error diamond never lands". Faults (§16): none.

import { blankPose, CH, FLAG } from '../keyframe.js'
import { packet as packetCurve, exit, clamp01 } from '../curves.js'
import { HUE, ceremonyOf } from '../vocabulary.js'
import { seedOf } from '../seed.js'

export const KIND = 'stream'
export const PERIOD_S = 10
export const STATES = Object.freeze(['dormant', 'live', 'sampled', 'over-budget', 'fading'])
export const LIGHTS = Object.freeze({ latency: ['within', 'slow', 'over'] })
export const COUNTERS = Object.freeze(['packets', 'sampled', 'errors', 'rate'])
/** A road reacts through `roadsOf`, not the kind table. */
export const REACTS = Object.freeze([])
/** States a tick never leaves without an event (actors/index.js skips them on a tick). */
export const FINAL = new Set(['dormant'])
export const TRANSITIONS = Object.freeze([['*', 'live', 'stream.live'], ['*', 'sampled', 'stream.sample'], ['*', 'over-budget', 'stream.over'], ['*', 'fading', 'stream.fade'], ['*', 'dormant', 'stream.fade']])
/** The six shapes (master §3.8). */
export const SHAPES = Object.freeze(['text', 'code', 'file', 'page', 'droplet', 'diamond'])
/** The packet cap per road per second; past it every N-th message rides and N is printed. */
export const CAP_PER_S = 8
const PACKETS_KEPT = 64
const IDENTITY = { foreman: 'GREEN', lacuna: 'CYAN', claude: 'CLAY', cloud: 'BLUE', owner: 'LAV', desk: 'LAV' }

const road = (shape, from, to, o = {}) => ({ id: `road:${shape}:${from}>${to}`, shape, from, to, n: 1, error: false, ...o })

/**
 * The roads one event rides (A3 §4.12; A4 §2.11): `[{id, shape, from, to, n, error, identity}]`.
 * @param {!Object} ev @param {!Map<string, !Object>} registry
 * @return {!Array<!Object>}
 */
export function roadsOf(ev, registry) {
  const d = ev.data ?? {}
  const k = ev.kind
  const run = registry.get(ev.actor)
  const brain = run?.brain ?? null
  switch (k) {
    case 'mind.turn.phase': {
      const mind = registry.get(ev.actor)
      const who = mind?.turn?.who ?? d.who ?? null
      const to = who === 'owner' ? 'desk' : who ?? 'desk'
      if (d.phase === 'answer') { const n = Math.floor((d.tokens ?? 0) / 8) - Math.floor((mind?.turn?.tokensSeen ?? 0) / 8); if (mind?.turn) mind.turn.tokensSeen = d.tokens ?? 0; return n > 0 ? [road('text', ev.actor, to, { n })] : [] }
      if (d.phase === 'read' && who) return [road('text', to, ev.actor)]
      return []
    }
    case 'run.ticket.open': return brain ? [road(/write|patch|edit/.test(String(d.op)) ? 'code' : 'text', brain, `pad:${ev.actor}`)] : []
    case 'run.ticket.close':
    case 'hands.receipt': return brain ? [road((d.exit ?? 0) !== 0 ? 'diamond' : d.files > 0 ? 'file' : d.rows > 0 ? 'page' : 'text', `pad:${ev.actor}`, brain, { error: (d.exit ?? 0) !== 0 })] : []
    case 'run.step': return [road('text', ev.actor, 'foreman')]
    case 'run.claim': return [road('text', ev.actor, 'foreman')]
    case 'run.fail': return [road('diamond', ev.actor, 'foreman', { error: true })]
    case 'run.mail': return d.dir === 'in' ? [road('text', 'foreman', ev.actor)] : [road('text', ev.actor, 'foreman')]
    case 'run.artifact': return [road('file', ev.actor, 'foreman')]
    case 'run.start': return [road('droplet', 'foreman', ev.actor)]
    case 'sentry.attach': return [road('droplet', 'lacuna', ev.actor)]
    case 'sentry.check': return [road('diamond', 'lacuna', ev.actor)]
    case 'sentry.verdict': return [road('diamond', ev.actor, 'lacuna', { error: d.action === 'stop' || d.action === 'kick' })]
    case 'sentry.warn': return [road('diamond', ev.actor, 'lacuna')]
    case 'mind.turn.fail': return [road('diamond', ev.actor, run?.turn?.who === 'owner' ? 'desk' : 'foreman', { error: true })]
    case 'mind.read': return [road(d.from === 'web' ? 'text' : 'page', d.from === 'web' ? 'web' : d.from === 'cortex' ? 'cortex' : 'library', ev.actor)]
    case 'cortex.recall': return d.by ? [road('page', 'cortex', d.by)] : []
    case 'visitor.turn': return d.mind ? (d.phase === 'done' ? [road('text', d.mind, ev.actor)] : [road('text', ev.actor, d.mind)]) : []
    case 'visitor.made': return d.mind ? [road('page', ev.actor, d.mind)] : []
    case 'cloud.call': return [road(d.ok === false ? 'diamond' : 'text', 'cloud', 'desk', { error: d.ok === false })]
    case 'claude.talk': return d.mind && d.phase !== 'done' ? [road('code', 'claude', d.mind)] : []
    case 'mind.swap': return d.from && d.to ? [road('text', d.from, d.to)] : []
    case 'door.proxy.fail': return [road('diamond', 'svc:door', 'svc:api', { error: true, n: d.n ?? 1 })]
    default: return []
  }
}

/** @return {!Object} the tail (A3 §3.2 stream row) */
export function create(id, logT, ev) {
  const m = id.match(/^road:([a-z]+):([^>]+)>(.+)$/)
  const from = m?.[2] ?? null
  const to = m?.[3] ?? null
  return { shape: m?.[1] ?? 'text', from, to, identity: IDENTITY[from] ?? IDENTITY[to] ?? null, lastPacketT: null, lastLandT: null, rate: 0, widthBin: 0, latency: 'within', sampled: 1, packets: [], count: 0, errors: 0, times: [], len: 0 }
}

/** Folds one event's packets into the road (`ctx.road` names the shape, count and error flag). */
export function apply(rec, ev, ctx) {
  const t = ctx.logT
  const r = ctx.road
  const a = ctx.registry.get(rec.from)
  const b = ctx.registry.get(rec.to)
  rec.len = a && b ? Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z) : rec.len
  rec.times = rec.times.filter((x) => t - x < 10).concat(t)
  rec.rate = rec.times.length / 10
  rec.widthBin = rec.rate < 1 ? 0 : rec.rate <= 4 ? 1 : 2
  const perS = rec.times.filter((x) => t - x < 1).length
  rec.sampled = perS > CAP_PER_S ? Math.ceil(perS / CAP_PER_S) : 1
  rec.count += r.n
  if (r.error) rec.errors += r.n
  if (rec.count % rec.sampled === 0 || r.error) {
    const dur = durOf(rec.len)
    rec.packets.push({ t0: t, dur, size: Math.min(6, r.n), shape: r.shape, error: r.error, seed: seedOf(rec.id, rec.count) })
    if (rec.packets.length > PACKETS_KEPT) rec.packets.shift()
    rec.lastPacketT = t
    rec.lastLandT = t + dur
  }
  if (ev.kind === 'run.ticket.close' || ev.kind === 'hands.receipt') {
    const budget = (ev.data?.kind === 'act' ? 600 : 120) * 1000
    rec.latency = ev.data?.ms == null ? rec.latency : ev.data.ms > budget ? 'over' : ev.data.ms > budget / 2 ? 'slow' : 'within'
    rec.latencyT = t
  }
}

/** `dur = clamp(0.5 + len × 0.0045, 0.5, 0.9)` s (A3 §4.12; C-77). */
export const durOf = (len) => Math.min(0.9, Math.max(0.5, 0.5 + len * 0.0045))

/** The state at `logT` (A3 §4.12). */
export function classify(rec, logT) {
  if (rec.lastPacketT == null) return { state: 'dormant', cause: null, since: 0 }
  if (rec.latency === 'over' && rec.latencyT != null && logT - rec.latencyT < 2) return { state: 'over-budget', cause: 'over budget', since: rec.latencyT }
  const live = logT <= rec.lastLandT + 1.2
  if (live && rec.sampled > 1) return { state: 'sampled', cause: `1 dot = ${rec.sampled}`, since: rec.state === 'sampled' ? rec.since : rec.lastPacketT }
  if (live) return { state: 'live', cause: null, since: rec.state === 'live' ? rec.since : rec.lastPacketT }
  if (logT <= rec.lastLandT + 2.4) return { state: 'fading', cause: null, since: rec.lastLandT + 1.2 }
  return { state: 'dormant', cause: null, since: rec.lastLandT + 2.4 }
}

/** The ceremony of a transition (A3 §5.5). */
export const transitions = (from, to) => ceremonyOf(TRANSITIONS, from, to)

/**
 * One packet's pose at `logT` on the road from `a` to `b` (closed form; A3 §4.12): `{x, y, z, u, alpha, rot, lands}`.
 * @param {!Object} pk @param {{x: number, z: number}} a @param {{x: number, z: number}} b @param {number} logT
 * @return {{x: number, y: number, z: number, u: number, alpha: number, rot: number, lands: boolean}}
 */
export function packetPose(pk, a, b, logT) {
  const u = clamp01((logT - pk.t0) / pk.dur)
  const e = packetCurve(u)
  const len = Math.hypot(b.x - a.x, b.z - a.z)
  const lift = Math.max(1.2, len * 0.18)
  const reach = pk.error ? 0.85 : 1
  const k = e * reach
  const x = a.x + (b.x - a.x) * k
  const z = a.z + (b.z - a.z) * k
  const y = 1.5 + lift * 4 * k * (1 - k)
  const spawn = 0.5 + 0.5 * Math.min(1, 8 * u)
  const alpha = pk.error ? (u < 0.88 ? 1 : 1 - clamp01((u - 0.88) / 0.12)) : spawn
  const rot = pk.shape === 'code' ? Math.PI * u : pk.shape === 'page' ? 0.35 * Math.sin(2 * Math.PI * 3 * u + 2 * Math.PI * (pk.seed / 4294967296)) : pk.shape === 'diamond' ? 2 * Math.PI * u : 0
  return { x, y, z, u, alpha, rot, lands: !pk.error && u >= 1 }
}

/** The road's pose at `logT`: `l` the wire's light, `fill` the width bin, `motion` the newest packet's u, `hue` the identity. */
export function pose(rec, logT) {
  const p = blankPose()
  const st = rec.state ?? 'dormant'
  const dt = Math.max(0, logT - (rec.since ?? logT))
  p[CH.x] = rec.pos.x
  p[CH.z] = rec.pos.z
  p[CH.y] = 1.5
  p[CH.hue] = rec.identity ? HUE[rec.identity] : HUE['N-WHITE']
  p[CH.edgeHue] = HUE['N-STEEL']
  p[CH.fill] = rec.widthBin / 2
  const newest = rec.packets[rec.packets.length - 1]
  p[CH.motion] = newest ? clamp01((logT - newest.t0) / newest.dur) : 0
  switch (st) {
    case 'dormant': p[CH.flags] &= ~FLAG.drawn; p[CH.l] = 0; break
    case 'live': case 'sampled': p[CH.l] = 0.14 + 0.26; if (rec.errors > 0 && newest?.error) p[CH.flags] |= FLAG.red; break
    case 'over-budget': p[CH.l] = 0.4; p[CH.ring] = 1; p[CH.edgeHue] = HUE.RED; p[CH.flags] |= FLAG.red; break
    case 'fading': p[CH.l] = 0.4 * (1 - exit(clamp01(dt / 1.2))); break
    default: break
  }
  p[CH.hollow] = rec.sampled > 1 ? 1 : 0
  return p
}
