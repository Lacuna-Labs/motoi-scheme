// actors/worker.js — THE WORKERS, the stars (lane F5-BC; THE-FLOOR-5.0 §3.4, law 7; A3 §4.3, §5.3; A4 §2.3; A5 §2.15–2.22;
// RULINGS R3, C-05, C-06, C-48, C-49, C-60). Owns: a run's record tail (the contract's steps, promises and open tickets, the
// beats, the kicks, the claim, the seal, the sentry), its fourteen states with A3 §4.3's delays (stalled = `run.stall`, a
// kick, a missed beat, or max(10 s, 3 × p99 step gap) of silence past an open ticket's deadline; cleared 2 s after a step),
// the feeding of its ring and its pad (one record each, created on `run.start`), its transitions to A3 §5.3's ids, and the
// pose in closed form (star-white, hollow when queued or claimed, 0.25 rev/s while working, the press edge, the frozen spin
// and amber ring of a stall, the hold-close-settle of a failure straight down where it stood). Refuses: a state read from
// text, a body in amber or green, a ring closed by the worker's own "done" (law 7), an outward velocity on death (law 6), a
// re-bud on a kick (C-48). Implements: A3 §4.3, §5.3. Invariants (design §18): "a claim is hollow; a record is solid".
// Faults (§16): none.

import { blankPose, CH, FLAG } from '../keyframe.js'
import { enter, exit, glide, rc, blink, held, clamp01 } from '../curves.js'
import { HUE, ceremonyOf } from '../vocabulary.js'
import { radiusOf } from './ring.js'
import { AT as F } from './foreman.js'

export const KIND = 'worker'
/** The foreman's sweep (A3 §3.2). */
export const PERIOD_S = 10
export const STATES = Object.freeze([
  'queued', 'budding', 'falling', 'working', 'stepping', 'waiting-press', 'stalled', 'done-claimed', 'passed', 'failed', 'kicked',
  'stopped', 'resumed', 'unknown',
])
/** The floor lights: one pip per contract step (A4 V-046; C-81). */
export const LIGHTS = Object.freeze({ pip: ['hollow', 'lit', 'running', 'failed', 'stalled', 'amber'] })
export const COUNTERS = Object.freeze(['step', 'plan', 'kicks', 'missedBeats', 'restarts', 'exit'])
export const REACTS = Object.freeze([
  'run.filed', 'run.start', 'run.step', 'run.ticket.open', 'run.ticket.close', 'run.promise', 'run.kick', 'run.stall', 'run.pass', 'run.fail',
  'run.stop', 'run.resume', 'run.pause', 'run.claim', 'run.mail', 'run.artifact', 'run.crash', 'press.wait', 'press.pressed', 'hands.receipt',
  'hands.rate', 'foreman.spawn', 'foreman.crash', 'foreman.restart', 'foreman.grave', 'wo.state',
  'ci.pass.start', 'ci.suite.start', 'ci.suite.end', 'ci.pass.end', 'scheme.eval',
])

/**
 * THE OTHER WORK AS RUNS (the owner, 2026-11-04: "if i start an erlang job it shows up on the floor. i run something in scheme?
 * floor… it's work. it's on the floor"): a CI pass and its suites, and a Scheme eval on lacuna.runtime, live a run's life on the
 * floor — filed, started, passed or failed — so they are drawn by the same star and the same rules. The kinds stay their own
 * on the record; only the fold reads them as a run's edges.
 * @param {!Object} ev
 * @return {!Array<!Object>} the run edges, in order ([] for a run kind: it is folded as it is)
 */
export function asRunEdges(ev) {
  const d = ev.data ?? {}
  const sha = String(d.sha ?? '').slice(0, 8)
  const counts = d.tests != null ? ` · ${d.passed ?? '?'}/${d.tests}` : ''
  const secs = Number.isFinite(d.ms) ? ` · ${(d.ms / 1000).toFixed(1)} s` : ''
  const edge = (kind, data) => ({ ...ev, kind, data })
  switch (ev.kind) {
    case 'ci.pass.start': return [edge('run.filed', { key: `ci ${sha}`, goal: `CI ${sha} · ${(d.suites ?? []).length} suites`, by: 'lacuna.ci', role: 'ci', plan: (d.suites ?? []).length || 1 }), edge('run.start', {})]
    case 'ci.suite.start': return [edge('run.filed', { key: d.name, goal: d.name, by: 'lacuna.ci', role: 'ci', parent: d.parent ?? null }), edge('run.start', {})]
    case 'ci.suite.end': return d.state === 'pass'
      ? [edge('run.pass', { 'checked-by': 'lacuna.ci', solid: true }), edge('run.claim', { said: `${d.name}${counts}${secs}` })]
      : [edge('run.fail', { why: `${d.name}${d.failed != null ? ` · ${d.failed} failed` : ''}${secs}`, exit: 1 })]
    case 'ci.pass.end': return [d.green ? edge('run.pass', { 'checked-by': 'lacuna.ci', solid: true }) : edge('run.fail', { why: `CI ${sha} red`, exit: 1 })]
    case 'scheme.eval': return [edge('run.filed', { key: `(${d.head ?? '…'})`, goal: `(${d.head ?? '…'})${secs}`, by: 'lacuna.runtime', role: 'scheme' }), edge('run.start', {}),
      d.ok ? edge('run.pass', { 'checked-by': 'lacuna.runtime', solid: true }) : edge('run.fail', { why: `(${d.head ?? '…'}) failed`, exit: 1 })]
    default: return []
  }
}
/** A3 §5.3 in order. */
/** States a tick never leaves without an event (actors/index.js skips them on a tick). */
export const FINAL = new Set(['passed', 'stopped', 'failed'])
export const TRANSITIONS = Object.freeze([
  ['(none)', 'queued', 'worker.file'], ['(none)', '*', 'worker.land'], ['*', 'unknown', 'worker.stale'], ['unknown', '*', 'worker.fresh'],
  ['queued', 'budding', 'worker.bud'], ['budding', 'falling', 'worker.fall'], ['falling', 'working', 'worker.land'],
  ['working', 'stepping', 'worker.step'], ['stepping', 'working', 'worker.step'], ['*', 'waiting-press', 'worker.press'],
  ['waiting-press', 'working', 'worker.pressed'], ['*', 'stalled', 'run.stall'], ['stalled', '*', 'run.stall.end'],
  ['*', 'done-claimed', 'worker.claim'], ['*', 'passed', 'run.pass'], ['*', 'failed', 'run.fail'], ['*', 'stopped', 'run.stop'],
  ['stopped', 'resumed', 'run.resume'], ['resumed', 'working', 'worker.land'], ['*', 'kicked', 'run.kick'], ['*', 'working', 'worker.land'],
])
const STEPS_KEPT = 200
const num = (v, dflt) => (Number.isFinite(v) ? v : dflt)
const GAPS_KEPT = 64
const STALL_FLOOR_S = 10
/** Hand 120 s, act 600 s (alive.mjs:17). */
const DEADLINE_S = { hand: 120, act: 600, beat: 30, mind: 360 }

/** @return {!Object} the tail (A3 §3.2 worker row) */
export function create(id, logT, ev) {
  return {
    cart: null, key: null, goal: null, by: null, role: null, brain: null, parent: null, children: [], contract: 'filed', step: 0, plan: 0, weight: 1,
    steps: [], promises: [], pending: [], lastBeatT: null, missedBeats: 0, stallReason: null, kicks: 0, exit: null, outcome: null, claimed: false,
    sealedAt: null, sentry: null, swappedAt: null, resumedFrom: null, watched: false, filedT: null, startT: null, flightS: 0.6, landT: null,
    lastStepT: null, stepGaps: [], p99Gap: null, stallClearT: null, kick: null, pressWait: null, stall: null, pass: null, fail: null, stop: null,
    resumeT: null, claim: null, ackT: null, restarts: 0, desk: false, eval: false, tier: null, mails: 0, artifacts: 0, crashes: 0,
  }
}

/** Folds one event into the tail and into the run's ring and pad (A2 §3.2's Fold column). */
export function apply(rec, ev, ctx) {
  const edges = asRunEdges(ev)
  if (edges.length) { for (const e of edges) apply(rec, e, ctx); return }
  const t = ctx.logT
  const d = ev.data ?? {}
  const ring = () => ctx.get('ring', `ring:${rec.id}`)
  const pad = () => ctx.get('pad', `pad:${rec.id}`)
  const stepNoted = () => { noteGap(rec, t); if (rec.state === 'stalled' && !(rec.stallClearT > rec.since)) rec.stallClearT = t; rec.lastStepT = t; rec.lastBeatT = t; rec.missedBeats = 0 }
  switch (ev.kind) {
    case 'run.filed':
      Object.assign(rec, { cart: d.cart ?? null, key: d.key ?? null, goal: d.goal ?? null, by: d.by ?? null, role: d.role ?? null, parent: d.parent ?? null,
        desk: d.desk === true, tier: d.tier ?? null, sentry: d.sentry ?? null, filedT: t, plan: num(d.plan, rec.plan), weight: num(d.weight, rec.weight) })
      if (String(d.by ?? '').startsWith('eval:') || String(rec.key ?? '').startsWith('eval:')) rec.eval = true
      if (rec.parent && ctx.has(rec.parent)) { const p = ctx.registry.get(rec.parent); if (!p.children.includes(rec.id)) p.children.push(rec.id); const pr = ctx.registry.get(`ring:${rec.parent}`); if (pr) { pr.n = 1 + p.children.length; pr.r = radiusOf(pr.n, pr.w); pr.reflowAsk = true } }
      break
    case 'run.start': {
      rec.contract = 'running'
      rec.startT = t
      rec.brain = typeof d.brain === 'string' ? d.brain : rec.brain
      rec.plan = num(d.plan, rec.plan)
      rec.weight = num(d.weight, rec.weight)
      rec.lastBeatT = t
      rec.lastStepT = t
      const r = ring()
      Object.assign(r, { runId: rec.id, plan: rec.plan, w: rec.weight, n: 1, r: radiusOf(1, rec.weight), startT: t, members: [rec.id] })
      Object.assign(pad(), { runId: rec.id, startT: t })
      const flightLen = Math.hypot(rec.pos.x - r.center.x, rec.pos.z - r.center.z)
      rec.flightS = Math.min(0.7, Math.max(0.5, 0.5 + flightLen * 0.0025))
      rec.landT = t + 0.2 + rec.flightS
      break
    }
    case 'run.step': {
      const row = { n: d.n ?? rec.step + 1, status: d.status ?? 'running', text: d.text ?? '', ticket: d.ticket ?? null, at: t }
      rec.steps.push(row)
      if (rec.steps.length > STEPS_KEPT) rec.steps.shift()
      rec.step = Math.max(rec.step, row.n)
      if (row.status === 'done' && !row.ticket && /^done\b/i.test(row.text)) rec.claim = { at: t, text: row.text }
      stepNoted()
      if (rec.stall && rec.stall.cleared == null) rec.stall.cleared = t
      Object.assign(ring(), { step: rec.step, plan: rec.plan, lastStepT: t, failedStep: row.status === 'failed' ? row.n : ring().failedStep })
      break
    }
    case 'run.ticket.open': {
      const ticket = d.ticket ?? `${rec.id}-${d.kind ?? 'hand'}-${d.n ?? rec.step}`
      const deadlineS = d['deadline-s'] ?? DEADLINE_S[d.kind] ?? DEADLINE_S.hand
      const row = { ticket, op: d.op ?? null, kind: d.kind ?? 'hand', sentAt: t, deadlineAt: d.pressed === true ? null : t + deadlineS, tries: d.tries ?? 1, waiting: d.pressed === true, n: d.n ?? rec.step }
      rec.pending = rec.pending.filter((p) => p.ticket !== ticket).concat(row)
      pad().tickets = rec.pending.map((p) => ({ ...p }))
      break
    }
    case 'run.ticket.close':
    case 'hands.receipt': {
      const ticket = d.ticket ?? ev.ref ?? rec.pending[rec.pending.length - 1]?.ticket
      const open = rec.pending.find((p) => p.ticket === ticket) ?? rec.pending[rec.pending.length - 1]
      rec.pending = rec.pending.filter((p) => p !== open)
      const exit = d.exit ?? 0
      const p = pad()
      p.tickets = rec.pending.map((q) => ({ ...q }))
      p.lastClose = { ticket: open?.ticket ?? ticket ?? null, op: d.op ?? open?.op ?? null, exit, ms: d.ms ?? null, files: d.files ?? null, at: t }
      if (exit === 0) { stepNoted(); if (rec.stall && rec.stall.cleared == null) rec.stall.cleared = t }
      break
    }
    case 'run.promise':
      rec.promises = rec.promises.filter((q) => q.id !== d.id).concat({ id: d.id ?? null, text: d.text ?? '', state: 'open', deadlineAt: t + (d['deadline-s'] ?? DEADLINE_S.hand), kicks: 0 }).slice(-32)
      break
    case 'run.kick': {
      rec.kicks++
      rec.kick = { at: t, why: d.why ?? d.category ?? 'kick', step: d.step ?? rec.step }
      const pr = rec.promises.find((q) => q.id === d.promise)
      if (pr) pr.kicks = d.missed ?? pr.kicks + 1
      break
    }
    case 'run.stall': rec.stall = { at: t, why: d.why ?? 'stuck', missed: d.missed ?? null, cleared: null }; rec.stallReason = rec.stall.why; if (d.missed) rec.missedBeats = d.missed; break
    case 'run.claim': rec.claim = { at: t, text: d.text ?? (d['claims-done'] === false ? 'said' : 'done'), chars: d.chars ?? null }; rec.claimed = d['claims-done'] !== false; break
    case 'run.pass': rec.pass = { at: t, checkedBy: d['checked-by'] ?? null, solid: d.solid !== false }; rec.outcome = 'pass'; rec.exit = 0; rec.sealedAt = t; rec.contract = 'done'; rec.pending = []; ring().seal = t; break
    case 'run.fail': rec.fail = { at: t, why: d.why ?? null, exit: d.exit ?? null, step: d.step ?? rec.step }; rec.outcome = 'fail'; rec.exit = d.exit ?? null; rec.contract = 'failed'; rec.pending = []; Object.assign(ring(), { close: t, failedStep: d.step ?? rec.step }); break
    case 'run.stop': rec.stop = { at: t, by: d.by ?? null, why: d.why ?? null, parked: false }; rec.outcome = 'stopped'; rec.contract = 'done'; rec.pending = []; break
    case 'run.pause': rec.stop = { at: t, by: d.by ?? null, why: d.park === true ? `parked for ${d.for ?? ''}`.trim() : 'paused', parked: d.park === true }; rec.contract = 'paused'; break
    case 'run.resume': rec.resumeT = t; rec.resumedFrom = d.from ?? null; rec.stop = null; rec.contract = 'running'; rec.lastBeatT = t; break
    case 'run.crash': rec.crashes = d.crashes ?? rec.crashes + 1; if (d.grave === true) rec.fail = { at: t, why: d.why ?? 'grave', exit: 30, step: d.step ?? rec.step }; break
    case 'run.mail': rec.mails++; break
    case 'run.artifact': rec.artifacts++; break
    case 'press.wait': rec.pressWait = { id: d.id ?? null, action: d.action ?? null, since: t }; rec.contract = 'waiting-owner'; break
    case 'press.pressed': rec.pressWait = null; if (rec.contract === 'waiting-owner') rec.contract = 'running'; if (d.answer === 'no') rec.stop = { at: t, by: d.by ?? 'owner', why: 'declined', parked: false }; break
    case 'foreman.spawn': if (!rec.filedT) rec.filedT = t; break
    case 'foreman.restart': rec.restarts++; rec.restartT = t; break
    case 'foreman.crash': rec.crashes = d.crashes ?? rec.crashes + 1; break
    case 'foreman.grave': rec.fail = rec.fail ?? { at: t, why: d.why ?? 'grave', exit: 30, step: rec.step }; rec.outcome = 'fail'; break
    case 'wo.state': if (d.state === 'parked') rec.stop = { at: t, by: 'broker', why: `parked`, parked: true }; break
    default: break
  }
}

function noteGap(rec, t) {
  if (rec.lastStepT != null) {
    rec.stepGaps.push(t - rec.lastStepT)
    if (rec.stepGaps.length > GAPS_KEPT) rec.stepGaps.shift()
  }
  if (rec.stepGaps.length >= 8) {
    const s = [...rec.stepGaps].sort((a, b) => a - b)
    rec.p99Gap = s[Math.min(s.length - 1, Math.floor(0.99 * s.length))]
  }
}

/** The stall on-delay `max(10 s, 3 × p99 step gap)`; 10 s with no history (A3 §4.3; R1). */
export const stallDelay = (rec) => (rec.p99Gap == null ? STALL_FLOOR_S : Math.max(STALL_FLOOR_S, 3 * rec.p99Gap))

/** The state at `logT` (A3 §4.3). */
export function classify(rec, logT, registry) {
  const foreman = registry?.get('foreman')
  if (rec.stale != null) return { state: 'unknown', cause: `stale-feed ${Math.round(logT - rec.stale)} s`, since: rec.stale }
  if (rec.parentStale || (foreman && foreman.state === 'stale' && rec.startT != null && !rec.outcome)) return { state: 'unknown', cause: 'foreman-stale', since: foreman?.since ?? logT }
  if (rec.fail) return { state: 'failed', cause: failCause(rec), since: rec.fail.at }
  if (rec.pass) return { state: 'passed', cause: null, since: rec.pass.at }
  if (rec.stop && rec.stop.parked === false && rec.outcome === 'stopped') return { state: 'stopped', cause: rec.stop.by ? `by-${rec.stop.by}` : rec.stop.why ?? 'stopped', since: rec.stop.at }
  if (rec.stop) return { state: 'stopped', cause: rec.stop.why ?? 'paused', since: rec.stop.at }
  if (rec.resumeT != null && logT - rec.resumeT < 1) return { state: 'resumed', cause: `from-${rec.resumedFrom ?? 'checkpoint'}`, since: rec.resumeT }
  if (rec.startT == null) return { state: 'queued', cause: rec.filedT != null && logT - rec.filedT > 3600 ? 'waiting-for-driver' : 'waiting-brain', since: rec.filedT ?? logT }
  if (logT < rec.startT + 0.2) return { state: 'budding', cause: null, since: rec.startT }
  if (logT < rec.landT) return { state: 'falling', cause: null, since: rec.startT + 0.2 }
  if (rec.pressWait) return { state: 'waiting-press', cause: `press ${rec.pressWait.action ?? ''} ${rec.pressWait.id ?? ''}`.trim(), since: rec.pressWait.since }
  const st = stall(rec, logT)
  if (st) return st
  if (rec.claim && !rec.pass) return { state: 'done-claimed', cause: `claimed: ${rec.claim.text}`, since: rec.claim.at }
  if (rec.lastStepT != null && rec.lastStepT > rec.landT && logT - rec.lastStepT < 0.4) return { state: 'stepping', cause: null, since: rec.lastStepT }
  return { state: 'working', cause: null, since: rec.landT }
}

function stall(rec, logT) {
  const on = stallDelay(rec)
  if (rec.stall && rec.stall.cleared == null) return { state: 'stalled', cause: rec.stall.missed ? `missed-beats ${rec.stall.missed}` : rec.stall.why, since: rec.stall.at }
  if (rec.stall && rec.stall.cleared != null && logT < rec.stall.cleared + 2) return { state: 'stalled', cause: rec.stall.why, since: rec.stall.at }
  if (rec.kick && logT - rec.kick.at < 2) return { state: 'stalled', cause: `kicked ${rec.kick.why}`, since: rec.kick.at }
  if (rec.missedBeats >= 1) return { state: 'stalled', cause: `missed-beats ${rec.missedBeats}`, since: rec.lastBeatT ?? logT }
  const overdue = rec.pending.find((p) => p.deadlineAt != null && logT > p.deadlineAt)
  if (overdue && held(rec.lastStepT, on, logT)) return { state: 'stalled', cause: `hand ${overdue.op ?? ''} never answered`.trim(), since: Math.max(rec.lastStepT + on, overdue.deadlineAt) }
  if (rec.state === 'stalled' && rec.stallClearT != null && rec.stallClearT > rec.since && logT < rec.stallClearT + 2) return { state: 'stalled', cause: rec.cause, since: rec.since }
  return null
}

function failCause(rec) {
  const w = { 12: 'exit 12 refused F-02', 15: 'exit 15 deadline', 30: 'exit 30 crash', 89: 'exit 89 memory', 99: 'exit 99 stalled', 0: 'done-check failed' }
  return [w[rec.fail.exit] ?? (rec.fail.exit != null ? `exit ${rec.fail.exit}` : 'failed'), rec.fail.why].filter(Boolean).join(': ')
}

/** The ceremony of a transition (A3 §5.3); a restart is `worker.restart`, not a state. */
export const transitions = (from, to) => ceremonyOf(TRANSITIONS, from, to)

/** The pose at `logT` (A3 §4.3's pose table). */
export function pose(rec, logT) {
  const p = blankPose()
  const st = rec.state ?? 'queued'
  const dt = Math.max(0, logT - (rec.since ?? logT))
  p[CH.x] = rec.pos.x
  p[CH.z] = rec.pos.z
  p[CH.y] = 1.9
  p[CH.hue] = HUE['N-STAR']
  p[CH.edgeHue] = HUE['N-STAR']
  const spinAt = (upTo) => 2 * Math.PI * 0.25 * Math.max(0, upTo - (rec.landT ?? upTo))
  if (rec.kick && logT - rec.kick.at < 0.12) p[CH.l] = 0.6
  if (rec.restartT != null && logT - rec.restartT < 0.12) p[CH.l] = 0.7
  switch (st) {
    case 'queued': p[CH.hollow] = 1; p[CH.scale] = 0.62; p[CH.l] = 0.7 + 0.05 * rc(0.25 * dt); p[CH.edgeHue] = HUE['N-GHOST']; break
    case 'budding': p[CH.x] = F.x; p[CH.z] = F.z; p[CH.y] = F.y - 1.2; p[CH.scale] = 0.62; p[CH.l] = 0.7 * enter(dt / 0.2); p[CH.hue] = HUE.GREEN; p[CH.flags] |= FLAG.mover; break
    case 'falling': { const u = glide(clamp01(dt / rec.flightS)); p[CH.x] = F.x + (rec.pos.x - F.x) * u; p[CH.z] = F.z + (rec.pos.z - F.z) * u; p[CH.y] = (F.y - 1.2) * (1 - u) + 1.9 * u + 14 * Math.sin(Math.PI * u) * (1 - u); p[CH.flags] |= FLAG.mover; p[CH.motion] = u; break }
    case 'working': p[CH.spin] = spinAt(logT); p[CH.motion] = (logT - rec.landT) % 1; p[CH.fill] = rec.plan > 0 ? clamp01(rec.step / rec.plan) : 0; break
    case 'stepping': p[CH.spin] = spinAt(logT); p[CH.scale] = 1 - 0.03 * rc(dt / 0.4); p[CH.fill] = rec.plan > 0 ? clamp01(rec.step / rec.plan) : 0; break
    case 'waiting-press': p[CH.spin] = spinAt(rec.since); p[CH.blink] = rec.pressYields ? 1 : blink(0.5, dt); p[CH.edgeHue] = p[CH.blink] ? HUE.AMBER : HUE['N-DARK']; p[CH.flags] |= FLAG.press | FLAG.frozen; break
    case 'stalled': {
      p[CH.spin] = spinAt(rec.since)
      p[CH.flags] |= FLAG.frozen | FLAG.amber
      p[CH.x] += dt < 0.06 || (dt >= 0.12 && dt < 0.18) ? 0.017 : 0
      p[CH.blink] = blink(0.5, dt)
      const overdue = rec.pending.find((q) => q.deadlineAt != null)
      const span = overdue ? Math.max(1, overdue.deadlineAt - overdue.sentAt) : 60
      p[CH.fill] = clamp01((logT - (rec.lastStepT ?? rec.since)) / span)
      p[CH.edgeHue] = HUE.AMBER
      break
    }
    case 'done-claimed': p[CH.hollow] = 1; p[CH.spin] = spinAt(rec.since); p[CH.l] = 1 - 0.3 * enter(dt / 0.24); break
    case 'passed': {
      const seal = clamp01(dt / 0.5)
      p[CH.ring] = 1 + 0.15 * enter(seal)
      p[CH.hue] = HUE.GREEN
      p[CH.y] = 1.9 * (1 + 0.03 * (1 - Math.exp(-6 * seal) * Math.cos(2 * Math.PI * 1.2 * seal)))
      p[CH.spin] = spinAt(rec.since) * 1
      if (dt > 1) { const u = glide(clamp01((dt - 1) / rec.flightS)); p[CH.motion] = u; p[CH.x] = rec.pos.x + (F.x - rec.pos.x) * u; p[CH.z] = rec.pos.z + (F.z - rec.pos.z) * u; p[CH.y] = 1.9 + (F.y - 1.2 - 1.9) * u; p[CH.flags] |= FLAG.mover; if (u >= 1) p[CH.flags] &= ~FLAG.drawn }
      break
    }
    case 'failed': {
      const past = dt - 0.15
      p[CH.sat] = past <= 0 ? 1 : 1 - 0.8 * exit(clamp01(past / 0.4))
      p[CH.l] = past <= 0 ? 1 : 1 - 0.6 * exit(clamp01(past / 0.4))
      p[CH.edgeHue] = HUE.RED
      p[CH.flags] |= FLAG.red | FLAG.frozen
      p[CH.blink] = past < 0.24 ? clamp01(past / 0.24) : dt < 0.39 + 2 ? blink(1.5, dt - 0.39) : 1
      const fall = clamp01((dt - 0.39) / 0.48)
      p[CH.y] = 1.9 - 1.6 * (fall < 1 ? fall * fall : 1) + (fall >= 1 && dt < 0.39 + 0.48 + 0.2 ? 0.16 * Math.sin(Math.PI * (dt - 0.87) / 0.2) : 0)
      p[CH.spin] = spinAt(rec.since)
      if (rec.ackT != null) p[CH.l] *= 1 - clamp01((logT - rec.ackT) / 2)
      break
    }
    case 'stopped': p[CH.l] = 0.5; p[CH.hollow] = 1; p[CH.spin] = spinAt(rec.since); if (!rec.stop?.parked && dt > 0.4) { const u = glide(clamp01((dt - 0.4) / (rec.flightS * 0.85))); p[CH.motion] = u; p[CH.x] = rec.pos.x + (F.x - rec.pos.x) * u; p[CH.z] = rec.pos.z + (F.z - rec.pos.z) * u; p[CH.y] = 1.9 + (F.y - 1.2 - 1.9) * u; p[CH.flags] |= FLAG.mover; if (u >= 1) p[CH.flags] &= ~FLAG.drawn } break
    case 'resumed': p[CH.l] = 0.5 + 0.5 * enter(dt / 0.4); p[CH.spin] = spinAt(logT) * enter(dt / 0.4); break
    case 'unknown': p[CH.sat] = 0.5; p[CH.edge] = 0.25; p[CH.flags] |= FLAG.frozen; p[CH.spin] = spinAt(rec.since); break
    default: break
  }
  if (rec.kick && logT - rec.kick.at < 2 && st !== 'failed') { p[CH.blink] = blink(0.6, logT - rec.kick.at); p[CH.flags] |= FLAG.amber }
  return p
}
