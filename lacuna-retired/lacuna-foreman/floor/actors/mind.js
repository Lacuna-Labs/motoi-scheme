// actors/mind.js — THE MINDS, world one (lane F5-BC; THE-FLOOR-5.0 §3.1; A3 §4.1, §5.1; A4 §2.1; A5 §2.3–2.13; RULINGS C-02,
// C-11, C-12, C-13, C-37, C-39, C-56, C-57). Owns: a mind's record tail (the engine, the load, the open turn, the 250 ms slot
// sample, the rolling p99 progress gap, the health, the KV fill, the counters), its nineteen states with A3 §4.1's on/off
// delays (stalled = max(10 s, 3 × p99 gap) of silence, cleared after 2 s of progress, never during prefill: a busy slot with
// no token yet is reading), the orthogonal `warned` flag (10 s linger), the transitions to A3 §5.1's ceremony ids, and the
// pose in closed form (A3 §4.1's table: the resident swell, the float `max(4 s, 3.5 s × mT)`, the comet at `log₂(1 + tps)`,
// the frozen channels of a stall, the hold-close-dark of a failure, the sit of an engine down, the sink of an eviction).
// Refuses: a worker's state as the mind's (it reads only `mind.*` and the run events that name it as brain), a stall while
// `n-decoded` is 0, "idle" for a down engine, a constant tok/s, green, any overshoot but `passing`; a cancel or the owner's stop as
// the mind's failure, and a failure that outlives the next turn or an unload (the make-it-right audit E14 §5 row 8, A2 fix 5: a
// cancel 228 s old outranked the 26B's live turn; the E4B read `failed` for 2.5 days unloaded, `cold-restarts 20199`). Implements: A3 §4.1,
// §5.1. Invariants (design §18): "stalled and unknown have zero internal motion"; "resident has zero vertical velocity".
// Faults (§16): none.

import { held } from '../curves.js'
import { BYTES, LAYERS, baseOf, massOf, riseFactor, ceremonyOf } from '../vocabulary.js'
import { pose, smoothedTps, H0 } from './mind-pose.js'

export const KIND = 'mind'
/** The health answer's period (A3 §3.2). */
export const PERIOD_S = 6
export { H0 }
export const STATES = Object.freeze([
  'dark', 'loading', 'resident', 'busy.reading', 'busy.thinking', 'busy.answering', 'busy.calling', 'busy.condensing',
  'waiting.queued', 'waiting.press', 'waiting.starved', 'waiting.backpressure', 'stalled', 'failed', 'refused', 'engine-down',
  'evicted', 'passing', 'unknown',
])
/** `warned` is an orthogonal flag (A3 §4.1): a mind can be `busy.answering` and warned. */
export const LIGHTS = Object.freeze({ warned: ['off', 'on'], platter: ['fill', 'red'] })
export const COUNTERS = Object.freeze(['restarts', 'coldRestarts', 'grammarErrors', 'turns', 'refusals', 'tpsMax', 'longestPrefillMs'])
/** A turn's end that is no failure of the mind's: the caller closed the request, the owner stopped it, or a swap took the engine. */
export const NOT_A_FAILURE = Object.freeze(new Set(['cancel', 'stopped', 'stop', 'swap']))   // a swap cut is the engine's leaving, not the mind's fault
export const REACTS = Object.freeze([
  'mind.load.start', 'mind.load.done', 'mind.load.refused', 'mind.unload', 'mind.engine.down', 'mind.engine.up', 'mind.swap', 'mind.slot',
  'mind.turn.start', 'mind.turn.phase', 'mind.turn.done', 'mind.turn.fail', 'mind.read', 'mind.climb', 'mind.exam', 'mind.instance.add',
  'mind.instance.remove', 'box.coast', 'service.down', 'service.up', 'run.start', 'run.pass', 'run.fail', 'run.stop', 'run.ticket.open',
  'run.ticket.close', 'press.wait', 'press.pressed', 'sentry.warn',
])
/** A3 §5.1, in order; the first match wins. */
export const TRANSITIONS = Object.freeze([
  ['(none)', 'dark', 'mind.sleep'], ['*', 'passing', 'mind.pass'], ['*', 'unknown', 'mind.stale'], ['unknown', '*', 'mind.fresh'],
  ['dark', 'loading', 'mind.arrive'], ['loading', 'resident', 'mind.ready'], ['loading', 'refused', 'mind.refused'],
  ['refused', 'dark', 'mind.sleep'], ['*', 'engine-down', 'mind.engine.down'], ['engine-down', '*', 'mind.engine.up'],
  ['stalled', 'failed', 'mind.fail'], ['busy.*', 'failed', 'mind.fail'], ['*', 'failed', 'mind.crash'], ['failed', '*', 'mind.fail.end'],
  ['*', 'evicted', 'mind.depart'], ['evicted', 'dark', 'mind.sleep'], ['busy.*', 'stalled', 'mind.stall'], ['stalled', 'busy.*', 'mind.stall.end'],
  ['busy.*', 'waiting.*', 'mind.wait'], ['waiting.*', 'busy.*', 'mind.wait.end'], ['busy.*', 'busy.*', 'mind.phase'], ['busy.*', 'resident', 'mind.turn.end'],
  ['*', 'busy.reading', 'mind.intake'], ['*', 'busy.thinking', 'mind.circulate'], ['*', 'busy.answering', 'mind.emit'], ['*', 'busy.calling', 'mind.call'],
  ['*', 'busy.condensing', 'mind.condense'], ['*', 'waiting.*', 'mind.wait'], ['*', 'resident', 'mind.ready'], ['*', 'loading', 'mind.arrive'],
  ['*', 'dark', 'mind.sleep'],
])
const STALL_FLOOR_S = 10
const GAPS_KEPT = 64

/** @return {!Object} the tail (A3 §3.2 mind row) */
export function create(id, logT, ev) {
  const base = baseOf(id)
  const bytes = BYTES[base] ?? 0
  return {
    base, bytes, layers: LAYERS[base] ?? 0, m: massOf(bytes), loaded: false, engine: { up: null, pid: null, uptimeS: null, downT: null, upT: null },
    load: { startT: null, doneT: null, hotMb: null, arenaMb: null, warmMs: null, refused: null, refusedT: null, by: null },
    turn: null, engineSlot: { busy: false, nDecoded: 0, held: 0, nCtx: 0, tps: 0, at: null, busySince: null, idleSince: null },
    gaps: [], p99Gap: null, lastProgressT: null, health: { at: null }, kvFill: 0, grammarErrors: 0, coldRestarts: 0, restarts: 0,
    turns: 0, refusals: 0, tpsMax: 0, longestPrefillMs: 0, tpsSample: null, swap: null, onJob: null, ring: null, desk: false,
    unload: null, stallClearT: null, warn: { since: null, lastT: null, cause: null }, warned: false, pressWait: null, fail: null, passT: null, ackT: null,
    stale: null, parentStale: false, reads: 0, instances: 0,
  }
}

/** Folds one event into the tail (A2 §3.1's Fold column). */
export function apply(rec, ev, ctx) {
  const t = ctx.logT
  const d = ev.data ?? {}
  const progress = () => { noteGap(rec, t); if (rec.state === 'stalled' && !(rec.stallClearT > rec.since)) rec.stallClearT = t; rec.lastProgressT = t }
  switch (ev.kind) {
    case 'mind.load.start':
      if (d.bytes > 0) { rec.bytes = d.bytes; rec.m = massOf(d.bytes) }
      if (d.layers > 0) rec.layers = d.layers
      rec.load = { ...rec.load, startT: t, doneT: null, refused: null, refusedT: null, by: d.by ?? null }
      rec.unload = null
      break
    case 'mind.load.done':
      if (d.bytes > 0) { rec.bytes = d.bytes; rec.m = massOf(d.bytes) }
      if (d.layers > 0) rec.layers = d.layers
      rec.loaded = true
      rec.load = { ...rec.load, doneT: t, hotMb: d['hot-mb'] ?? null, arenaMb: d['arena-mb'] ?? null, warmMs: d['warm-ms'] ?? null }
      if (rec.engine.up == null) rec.engine.up = true
      rec.health.at = t
      break
    case 'mind.load.refused':
      rec.refusals++
      rec.load = { ...rec.load, refused: { needMb: d['need-mb'] ?? null, availMb: d['available-mb'] ?? null, why: d.why ?? null }, refusedT: t, startT: null }
      break
    case 'mind.unload':
      if (d.phase === 'done') { rec.unload = { ...(rec.unload ?? { beginT: t, by: d.by ?? null }), doneT: t }; rec.loaded = false; rec.turn = null; rec.fail = null; rec.ackT = null }
      else rec.unload = { beginT: t, doneT: null, by: d.by ?? null }
      break
    case 'mind.engine.down':
      rec.engine = { ...rec.engine, up: false, downT: t }
      if (rec.turn) { rec.fail = { at: t, cause: 'crash', crash: true }; rec.ackT = null }
      rec.turn = null
      break
    case 'mind.engine.up':
      if (rec.engine.uptimeS != null && d['uptime-s'] != null && d['uptime-s'] < rec.engine.uptimeS) rec.restarts++
      if (d.restart === true) rec.restarts++
      rec.engine = { ...rec.engine, up: true, pid: d.pid ?? rec.engine.pid, uptimeS: d['uptime-s'] ?? rec.engine.uptimeS, upT: t }
      rec.health.at = t
      break
    case 'mind.swap':
      if (d.phase === 'begin' || d.phase == null) rec.swap = { from: d.from ?? null, to: d.to ?? null, by: d.by ?? null, startT: t }
      else {
        rec.swap = null
        if (d.phase === 'done' && d.from === rec.id && d.to && d.to !== rec.id) {
          rec.unload = { beginT: t, doneT: t, by: 'swap' }
          rec.loaded = false; rec.turn = null; rec.fail = null; rec.ackT = null
        }
      }
      break
    case 'mind.slot': {
      const s = rec.engineSlot
      const busy = d.busy === true
      const nDecoded = d['n-decoded'] ?? 0
      if (busy && !s.busy) { s.busySince = t; s.idleSince = null }
      if (!busy && s.busy) { s.idleSince = t; s.busySince = null }
      if (busy && nDecoded > s.nDecoded) progress()
      if (busy && s.nDecoded === 0 && nDecoded > 0 && s.busySince != null) rec.longestPrefillMs = Math.max(rec.longestPrefillMs, Math.round((t - s.busySince) * 1000))
      if (d.cold === true && !s.cold && rec.loaded) rec.coldRestarts++   // the slot going cold while loaded, once; never every sample
      Object.assign(s, { busy, cold: d.cold === true, nDecoded, held: d.held ?? s.held, nCtx: d['n-ctx'] ?? s.nCtx, tps: d.tps ?? 0, at: t, prefill: d.prefill ?? null })
      if (s.nCtx > 0) rec.kvFill = s.held / s.nCtx
      noteTps(rec, d.tps ?? 0, t)
      rec.health.at = t
      break
    }
    case 'mind.turn.start':
      rec.fail = null   // a new turn ends the last failure: a failure never outranks a live turn
      rec.ackT = null
      rec.turn = { who: d.who ?? null, session: d.session ?? null, startT: t, phase: 'read', phaseT: t, tokens: 0, tps: 0, prefillMs: null, why: null, tool: null, run: ev.ref ?? null }
      rec.lastProgressT = t
      rec.gaps = []
      rec.p99Gap = null
      rec.turns++
      break
    case 'mind.turn.phase':
      if (!rec.turn) rec.turn = { who: null, session: null, startT: t, phase: 'read', phaseT: t, tokens: 0, tps: 0, prefillMs: null, why: null, tool: null, run: ev.ref ?? null }
      if ((d.tokens ?? 0) > rec.turn.tokens || d.phase !== rec.turn.phase) progress()
      rec.turn = { ...rec.turn, phase: d.phase ?? rec.turn.phase, phaseT: t, tokens: d.tokens ?? rec.turn.tokens, tps: d.tps ?? rec.turn.tps, why: d.why ?? null, tool: d.tool ?? null }
      noteTps(rec, d.tps ?? 0, t)
      break
    case 'mind.turn.done':
      rec.turn = null
      rec.lastTurn = { ms: d.ms ?? null, tps: d.tps ?? null, prefillMs: d['prefill-ms'] ?? null, reused: d.reused ?? null, reason: d.reason ?? null, margins: d.margins ?? null, at: t,
        prompt: d.prompt ?? null, window: d.window ?? null, kept: d.kept ?? null }   // what the mind held, from the turn's record (E14 §5 row 45)
      if (d['prefill-ms'] > rec.longestPrefillMs) rec.longestPrefillMs = d['prefill-ms']
      if (d.reason === 'max' || d.reason === 'deadline') warn(rec, t, `budget-burn ${d.reason}`)
      progress()
      break
    case 'mind.turn.fail':
      if (d.grammar === true || /grammar/.test(String(d.reason))) rec.grammarErrors++
      rec.turn = null
      if (NOT_A_FAILURE.has(d.reason)) { rec.lastTurn = { ms: d.ms ?? null, tps: null, prefillMs: null, reused: null, reason: d.reason, margins: null, at: t, prompt: d.prompt ?? null, window: null, kept: null }; break }
      rec.fail = { at: t, cause: `turn-fail ${d.reason ?? 'unknown'}`, crash: false, layer: d.layer ?? null }
      rec.ackT = null
      break
    case 'mind.read': rec.reads++; break
    case 'mind.instance.add': rec.instances = d.n ?? rec.instances + 1; break
    case 'mind.instance.remove': rec.instances = Math.max(0, d.n ?? rec.instances - 1); break
    case 'box.coast':
      rec.coast = { level: d.level ?? 'unknown', availMb: d['avail-mb'] ?? null }
      if (d.level === 'tight' && rec.loaded) warn(rec, t, `memory-tight ${d['free-pct'] ?? '?'} %`)
      break
    case 'service.down': if (ev.actor === 'lme' || ev.actor === 'brain') rec.engine = { ...rec.engine, up: false, downT: t }; break
    case 'service.up': if ((ev.actor === 'lme' || ev.actor === 'brain') && rec.engine.up === false) rec.engine = { ...rec.engine, up: true, upT: t }; break
    case 'run.start': if (d.brain === rec.id) { rec.onJob = ev.actor; rec.ring = `ring:${ev.actor}` } break
    case 'run.pass': if (rec.onJob === ev.actor) { rec.passT = t; rec.onJob = null; rec.ring = null } break
    case 'run.fail': case 'run.stop': if (rec.onJob === ev.actor) { rec.onJob = null; rec.ring = null; rec.call = null } break   // the job's open call ends with it (F5-H's stall drill, 2026-11-01)
    case 'run.ticket.open': if (rec.onJob === ev.actor) rec.call = { ticket: d.ticket ?? null, op: d.op ?? null, at: t }; break
    case 'run.ticket.close': if (rec.onJob === ev.actor) rec.call = null; break
    case 'press.wait': if (rec.onJob === ev.actor || d.run === rec.id) rec.pressWait = { id: d.id ?? null, action: d.action ?? null, since: t }; break
    case 'press.pressed': rec.pressWait = null; break
    case 'sentry.warn': if (rec.onJob === ev.ref) warn(rec, t, `sentry-warn ${d.check ?? ''}`.trim()); break
    default: break
  }
  if (rec.kvFill >= 0.9 && rec.loaded) warn(rec, t, `kv ${Math.round(rec.kvFill * 100)} %`)
}

function warn(rec, t, cause) {
  rec.warn = { since: rec.warn.since ?? t, lastT: t, cause }
}

function noteGap(rec, t) {
  if (rec.lastProgressT != null) {
    rec.gaps.push(t - rec.lastProgressT)
    if (rec.gaps.length > GAPS_KEPT) rec.gaps.shift()
  }
  if (rec.gaps.length >= 8) {
    const sorted = [...rec.gaps].sort((a, b) => a - b)
    rec.p99Gap = sorted[Math.min(sorted.length - 1, Math.floor(0.99 * sorted.length))]
  } else rec.p99Gap = null
}

function noteTps(rec, tps, t) {
  const prev = rec.tpsSample
  rec.tpsSample = { tps1: tps, t1: t, tps0: prev ? smoothedTps(rec, t) : tps }
  if (tps > rec.tpsMax) rec.tpsMax = tps
}

/** The stall on-delay: `max(10 s, 3 × p99 gap)`; 10 s until eight gaps exist (A3 §4.1). */
export const stallDelay = (rec) => (rec.p99Gap == null ? STALL_FLOOR_S : Math.max(STALL_FLOOR_S, 3 * rec.p99Gap))

/** The state at `logT` (A3 §4.1; priority: engine-down > failed > refused > unknown > stalled > waiting.press > busy.* > waiting.* > resident > loading > dark). */
export function classify(rec, logT, registry) {
  rec.warned = rec.warn.lastT != null && logT - rec.warn.lastT < 10
  const since = (s) => s ?? logT
  const mR = riseFactor(rec.m)
  if (rec.passT != null && logT - rec.passT < 0.5 && rec.loaded) return { state: 'passing', cause: null, since: rec.passT }
  if (rec.engine.up === false && rec.loaded) return { state: 'engine-down', cause: rec.engine.downT != null ? '503' : 'no-health', since: since(rec.engine.downT) }
  if (rec.fail && (rec.ackT == null || logT < rec.ackT + 2)) return { state: 'failed', cause: rec.fail.cause, since: rec.fail.at }
  if (rec.fail && rec.ackT != null && logT >= rec.ackT + 2) { rec.fail = null; rec.ackT = null }
  if (rec.load.refusedT != null && logT - rec.load.refusedT < 6) return { state: 'refused', cause: `needs ${rec.load.refused?.needMb ?? '?'} MB, ${rec.load.refused?.availMb ?? '?'} free`, since: rec.load.refusedT }
  if (rec.unload && !rec.unload.doneT && logT - rec.unload.beginT < 1.1 * mR + 1.2) return { state: 'evicted', cause: `by-${rec.unload.by ?? 'unknown'}`, since: rec.unload.beginT }
  if (rec.unload?.doneT != null && logT - rec.unload.doneT < 1.1 * mR) return { state: 'evicted', cause: `by-${rec.unload.by ?? 'unknown'}`, since: rec.unload.beginT }
  if (!rec.loaded) {
    if (rec.load.startT != null && rec.load.doneT == null) return { state: 'loading', cause: rec.load.by ? `wake-by-${rec.load.by}` : (rec.swap ? `swap-for ${rec.swap.by ?? ''}`.trim() : null), since: rec.load.startT }
    const fits = rec.coast?.availMb == null || rec.load.hotMb == null || rec.coast.availMb >= rec.load.hotMb
    return { state: 'dark', cause: rec.unload ? (rec.unload.by === 'owner' ? 'evicted-by-owner' : rec.unload.by === 'expiry' ? 'expired' : 'asleep') : fits ? 'asleep' : 'does-not-fit', since: since(rec.unload?.doneT ?? rec.unload?.beginT) }
  }
  const foreman = registry?.get('foreman')
  if (rec.stale != null) return { state: 'unknown', cause: `stale-feed ${Math.round(logT - rec.stale)} s`, since: rec.stale }
  if (rec.onJob && foreman && foreman.state === 'stale') return { state: 'unknown', cause: 'foreman-stale', since: foreman.since }
  const busy = busyState(rec, logT)
  if (busy && busy !== 'busy.reading' && rec.lastProgressT != null) {
    const on = stallDelay(rec)
    const stallSince = rec.lastProgressT + on
    const clearing = rec.state === 'stalled' && rec.stallClearT != null && rec.stallClearT > rec.since && logT < rec.stallClearT + 2
    if (held(rec.lastProgressT, on, logT) || clearing) {
      const cause = rec.kvFill >= 0.98 ? 'kv-full' : `no-token-for ${Math.round(logT - rec.lastProgressT)} s`
      return { state: 'stalled', cause, since: clearing ? rec.since : stallSince }
    }
  }
  if (rec.pressWait) return { state: 'waiting.press', cause: `press ${rec.pressWait.id ?? ''} ${rec.pressWait.action ?? ''}`.trim(), since: rec.pressWait.since }
  if (busy === 'busy.reading') {
    const readS = logT - (rec.turn?.startT ?? rec.engineSlot.busySince ?? logT)
    const longest = rec.longestPrefillMs / 1000
    const cause = longest > 0 && readS > longest ? `no first token for ${Math.round(readS)} s (longest read so far ${Math.round(longest)} s)` : null
    return { state: busy, cause, since: busySince(rec, busy, logT) }
  }
  if (busy) return { state: busy, cause: null, since: busySince(rec, busy, logT) }
  const w = waitState(rec, logT)
  if (w) return w
  return { state: 'resident', cause: null, since: since(rec.turn?.startT ?? rec.load.doneT ?? rec.engine.upT) }
}

function busyState(rec, logT) {
  const t = rec.turn
  const s = rec.engineSlot
  if (t && t.phase !== 'wait') {
    if (t.phase === 'read' && s.busy && s.nDecoded > 0) return 'busy.answering'
    return t.phase === 'call' ? 'busy.calling' : t.phase === 'condense' ? 'busy.condensing' : t.phase === 'think' ? 'busy.thinking' : t.phase === 'answer' ? 'busy.answering' : 'busy.reading'
  }
  if (rec.call) return 'busy.calling'
  if (s.busy && held(s.busySince, 0.25, logT)) return s.nDecoded > 0 ? 'busy.answering' : 'busy.reading'
  if (!s.busy && rec.state?.startsWith('busy.') && s.idleSince != null && logT - s.idleSince < 0.5) return rec.state
  return null
}

function busySince(rec, state, logT) {
  if (rec.state === state && rec.since != null) return rec.since
  return rec.turn?.phaseT ?? (rec.engineSlot.busySince != null ? rec.engineSlot.busySince + 0.25 : logT)
}

function waitState(rec, logT) {
  const t = rec.turn
  if (!t || t.phase !== 'wait') return null
  const why = t.why
  const on = why === 'queue' ? 1 : why === 'input' ? 2 : why === 'backpressure' ? 2 : 0
  if (!held(t.phaseT, on, logT)) return rec.state?.startsWith('busy.') ? { state: rec.state, cause: null, since: rec.since } : null
  const since = t.phaseT + on
  if (why === 'queue') return { state: 'waiting.queued', cause: 'slot-busy', since }
  if (why === 'input') return { state: 'waiting.starved', cause: `no-input-from ${t.tool ?? 'hand'}`, since }
  if (why === 'backpressure') return { state: 'waiting.backpressure', cause: 'receiver-busy', since }
  return { state: 'waiting.starved', cause: 'wait', since }
}

/** The ceremony of a transition (A3 §5.1). */
export const transitions = (from, to) => ceremonyOf(TRANSITIONS, from, to)

/** The pose at `logT` (actors/mind-pose.js, A3 §4.1's pose table). */
export { pose }
