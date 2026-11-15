// ALIVE OR SAID DEAD — owns the ticket, deadline, heartbeat, zombie and checkpoint rules that keep a worker alive or say it died.
// Measured 2026-10-19: ci-guard (w-cf9317) read "running" for 8 h with one ring line; nothing could wake it and nothing noticed.
// Owns: tickets (120 s hand; act's own deadline or 600 s; a `press` ticket has no deadline), one re-send then (on 'hand-timeout …),
//   two missed beats = one restart, a third = "stopped: missed heartbeats", the zombie law (`stalled`), ckpt/<wid>.json per step,
//   and what a reload adopts instead of asking again (a kept ticket, a living child); a press that lands before the hands'
//   `waiting` reply, held for its ticket and sent with it once (F5).
// Refuses: to show a worker with nothing pending, no timer, no subscription and no living child as running; to re-send an act twice.
// Implements: design §6 (the kernel; alive or said dead), §17 (exits 15, 99); keeps LACUNA-1.3-DESIGN §45.3 as history.
// Invariants (§18): "If a promise is open past its deadline, then a kick was sent"; a foreman restart resumes from the checkpoint.
// Faults (§16): F-06 (stalled), F-08 (act waits on the owner's press, no deadline).
// The supervisor calls in; the sweep is one interval in the foreman (startSweep), or a test's own call.
import fs from 'node:fs'
import path from 'node:path'
import { symOf } from './scheme.mjs'
import { think, event } from './talk.mjs'
import { coordinateOf } from './contract.mjs'
import { print } from './coordinate.mjs'
import { ticketOpen, ticketClose } from './phase.mjs'

export const ALIVE = Object.freeze({ hand: 120, act: 600, beat: 30, mind: 360, sweep: 10 })
const PACKET_KEYS = ['goal', 'task', 'parent', 'done_so_far', 'cortex_refs', 'branch', 'deadline']
export const STALLED = 'stalled: nothing pending, nothing could wake it (F-06)'
export const MISSED = 'stopped: missed heartbeats'

/** The rules' clock, from the host: {hand, act, acts: {op: s}, beat, mind, sweep} in seconds; tests make them short. */
export function aliveConfig(host = {}) {
  const d = host.deadlines || {}
  return { hand: d.hand ?? ALIVE.hand, act: d.act ?? ALIVE.act, acts: { ...(d.acts || {}) }, beat: d.beat ?? ALIVE.beat,
           mind: d.mind ?? ALIVE.mind, sweep: d.sweep ?? ALIVE.sweep }
}

// ── beats and tools ─────────────────────────────────────────────────────────────────────────────────────────────────
export function beat(sup, w) { w.lastBeat = sup.host.now(); w.missed = 0 }
export function tool(w, verb) {
  const t = (w.tools ||= {})
  t[verb] = (t[verb] || 0) + 1
  if (verb === 'every' || verb === 'after') t.timer = (t.timer || 0) + 1      // the card's one "timer" glyph
}

// ── tickets ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const spanOf = (sup, kind, op) => (kind === 'act' ? sup.alive.acts[op] ?? sup.alive.act : sup.alive.hand)

/** A ticket id no pending ticket already holds (two hands in one millisecond got the same one before). */
export function freshTicket(w, base) {
  const held = new Set((w.pending || []).flatMap((t) => [t.ticket, ...(t.was || [])]))
  let t = base
  for (let n = 1; held.has(t); n++) t = `${base}.${n}`
  return t
}

/** A load again (a resume, a restart) asks what it asked the first time: the ticket it kept for the same op and args is
 *  the answer — not asked twice (2026-10-19, a smoke run: a top-level (hand 'jobs) came back with two tickets). → the
 *  kept ticket id, or null. Each kept ticket is adopted once, and only during the load (`w.adoptable`). */
export function adoptTicket(w, kind, op, args) {
  if (!w.loading || !w.adoptable?.size) return null
  const same = JSON.stringify(args)
  const t = (w.pending || []).find((x) => w.adoptable.has(x.ticket) && (x.kind === kind || (kind === 'act' && x.kind === 'press'))
                                         && x.op === op && JSON.stringify(x.args) === same)
  if (!t) return null
  w.adoptable.delete(t.ticket)
  return t.ticket
}

/** A load again spawns what it spawned the first time: a living child (or one its checkpoint names, on a resume) with the
 *  same name and program is the answer — not spawned twice (U1 2026-10-24: each crash restart added a child until the cap
 *  buried the parent). → the child's id, or null. Each is adopted once, and only during the load. */
export function adoptChild(w, name, sha) {
  if (!w.loading || !w.adoptableKids?.length) return null
  const i = w.adoptableKids.findIndex((k) => k.name === name && k.sha === sha)
  return i < 0 ? null : w.adoptableKids.splice(i, 1)[0].id
}

/**
 * Open one ticket on a worker: the pending row with its deadline (the kind's span, or the caller's shorter one), its
 * position `n` when the caller knows it, its coordinate and its generation; `run.ticket.open` rides the bus once, whole.
 * @param {object} sup
 * @param {object} w
 * @param {string} kind hand · act · brain · press
 * @param {string} op
 * @param {Array<*>|object} args
 * @param {string} ticket
 * @param {{deadlineS?: number, n?: number}} [o] a deadline under the kind's span; the positional index of the intent
 * @returns {object} the pending row
 */
export function openTicket(sup, w, kind, op, args, ticket, o = {}) {
  const now = sup.host.now()
  // SENTRY-2.0 §4 (K1): the ticket carries its coordinate — the run's next call ordinal (past every ticket and result it holds,
  // so a resume never reuses one) and the generation it was issued to (a ticket dies with its generation)
  const call = Math.max(w.calls || 0, ...(w.pending || []).map((t) => t.call || 0), ...(w.run?.results || []).map((r) => r.call || 0)) + 1
  w.calls = call
  const span = spanOf(sup, kind, op)
  const t = { ticket, op, kind, args, sent_at: now, deadline_at: now + (o.deadlineS > 0 ? Math.min(span, o.deadlineS) : span), tries: 1, was: [], call, gen: w.gen || 1 }
  if (o.n != null) t.n = o.n
  t.at = print(coordinateOf(sup, w, { call }))
  ;(w.pending ||= []).push(t)
  ticketOpen(sup, w, t)                         // SENTRY-2.0 §7: run.ticket.open rides the bus (never the args)
  return t
}

/** A reply arrived: clear its ticket. By ticket (or one it replaced), else the oldest of its kind with its op, else the
 *  oldest of its kind (a press's answer carries the op only). A reply that names a ticket nobody holds (late, or a
 *  duplicate) clears nothing (U1 2026-10-24: a replayed reply closed the other ticket of its op). → the ticket, or null. */
export function closeTicket(sup, w, kind, value) {
  const p = w.pending || []
  if (!p.length) return null
  const v = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const same = (t) => t.kind === kind || (kind === 'act' && t.kind === 'press')
  const op = v.op == null ? null : String(v.op && v.op.name ? v.op.name : v.op)
  const t = (v.ticket != null && p.find((x) => x.ticket === String(v.ticket) || (x.was || []).includes(String(v.ticket))))
    || (v.ticket == null && op && p.find((x) => same(x) && x.op === op)) || (v.ticket == null && !op && p.find(same)) || null
  if (!t) return null
  if (kind === 'act' && v.waiting && t.kind === 'act') {
    if (t.pressed && !t.sentPressed && !w.playbook) {
      // the owner's press landed before this reply (F5, 2026-10-25: the decided road pressed 9 ms after the spawn): the hands
      // did not run it, so the same ticket goes to them again, now pressed — what press() does after a wait; never a new
      // ticket, and once: a waiting reply to the pressed send holds the run for the owner (intents.mjs result)
      t.sentPressed = true
      t.deadline_at = sup.host.now() + spanOf(sup, 'act', t.op)
      sup.host.upstream('act', w, { ticket: t.ticket, op: t.op, args: t.args, n: t.n, run: w.run?.key, pressed: true, pressed_by: t.pressed.by })
      return t
    }
    // the act waits for the owner's press (acts.py _press): still pending, now on the owner — no deadline on a person
    t.kind = 'press'; t.deadline_at = null; t.waiting = String(v.waiting)
    return t
  }
  p.splice(p.indexOf(t), 1)
  if (w.cart?.steps) {
    const now = sup.host.now()
    for (const s of w.cart.steps) {
      if (s.ticket && (s.ticket === t.ticket || (t.was || []).includes(s.ticket))) s.receipt = { exit: v.exit ?? 0, at: now }
    }
    if (kind === 'hand' || kind === 'act') keepReply(w.cart, t, v)
  }
  ticketClose(sup, w, t, v)                     // SENTRY-2.0 §7: run.ticket.close rides the bus when the receipt lands
  return t
}

// A cart's done-check reads the executor's answers, never the cart's words (finale 2026-11-06, intents.mjs doneCheck):
// the last answer of each op with the args it was asked with, and a tally of every answer of that op (ok · failed ·
// dry). An answer past REPLY_BYTES keeps its ok and exit only: a form that reads its rows finds none and fails.
const REPLY_BYTES = 65_536
function keepReply(c, t, v) {
  const op = String(t.op || v.op || '')
  if (!op) return
  const size = JSON.stringify(v).length
  const value = size <= REPLY_BYTES ? v : { ok: v.ok ?? false, op, exit: v.exit ?? null, kept: false, bytes: size }
  ;(c.replies ||= {})[op] = { value, args: Array.isArray(t.args) ? t.args : [] }
  const n = ((c.tally ||= {})[op] ||= { ok: 0, failed: 0, dry: 0 })
  if (v.dry) n.dry++
  else if (v.ok === true) n.ok++
  else n.failed++
}

// ── the sweep ───────────────────────────────────────────────────────────────────────────────────────────────────────
/** One pass over every running worker: deadlines, then heartbeats, then the zombie law. */
export function sweep(sup) {
  const now = sup.host.now()
  for (const w of [...sup.workers.values()]) {
    for (const rule of [deadlines, heartbeat, zombie]) {
      if (w.state !== 'running') break
      rule(sup, w, now)
    }
  }
}

function deadlines(sup, w, now) {
  let changed = false
  for (const t of [...(w.pending || [])]) {
    if (t.deadline_at == null || now < t.deadline_at || w.state !== 'running') continue
    changed = true
    // law 4 (3.0 §3): an act is never re-sent; an intent filed with idem no (t.once) is never re-sent either
    if (t.tries < 2 && t.kind !== 'act' && !t.once) { resend(sup, w, t, now); continue }
    w.pending.splice(w.pending.indexOf(t), 1)
    if (t.kind === 'brain') {                                              // F-09: the judgment's fallback answers for the brain
      think(w, 'state', `the brain did not answer '${t.op} in ${sup.alive.mind} s: the fallback ${t.fallback} answers`, now)
      if (t.fallback === 'stop') { sup.stop(w.id, `stopped: the brain did not answer '${t.op} and the fallback is stop`); continue }
      if (t.fallback === 'ask-owner') sup.host.upstream('ask', w, { ticket: t.ticket, topic: t.op, question: t.args[0], why: 'the brain did not answer; the header says ask-owner' })
      if (w.handlers.has('brain')) sup.send(w.id, 'brain', { ticket: t.ticket, topic: symOf(t.op), by: 'fallback', fallback: t.fallback, answer: t.fallback === 'skip' ? false : null })
      continue
    }
    const kind = `${t.kind}-timeout`
    think(w, 'state', `${t.kind} ${t.op} never answered (${t.tries} tries)`, now)
    if (w.handlers.has(kind)) sup.send(w.id, kind, { ticket: t.ticket, op: symOf(t.op), tries: t.tries })
    else sup.stop(w.id, `stopped: ${t.op} never answered (F-01)`, { stall: true })
  }
  if (changed && w.state === 'running') sup._checkpoint(w)
}

function resend(sup, w, t, now) {
  const old = t.ticket
  t.was.push(old)
  t.ticket = freshTicket(w, `${old.replace(/\.r\d+$/, '')}.r${t.tries}`)
  t.tries += 1
  t.sent_at = now
  t.deadline_at = now + spanOf(sup, t.kind, t.op)
  think(w, 'state', `${t.kind} ${t.op} had no answer by its deadline — sent again as ${t.ticket}`, now)
  sup.host.upstream(t.kind, w, { ticket: t.ticket, op: t.op, args: t.args, retry_of: old, tries: t.tries })
}

/** When the cover of what it waits on ends (null: still inside a deadline, or it waits on nothing). */
function coverEnd(sup, w, now) {
  const ends = (w.pending || []).map((t) => t.deadline_at).concat((w.minding || []).map((m) => m.at + sup.alive.mind))
    // a run waiting on its brain's next intent (intents.mjs) — but a run with no hop yet is waiting for a driver, not a brain: its
    // first-intent deadline is no cover for an hour (kick.mjs UNCLAIMED_S; 2026-10-23: runs stalled at 6.7 min as missed beats)
    .concat(w.awaiting && !(w.run && !(w.run.hops > 0) && now - (w.started ?? now) < 3600) ? [w.awaiting.due] : [])
  if (!ends.length) return null
  if ((w.pending || []).some((t) => t.deadline_at == null) || ends.some((e) => e > now)) return null
  return Math.max(...ends)
}

function heartbeat(sup, w, now) {
  const end = coverEnd(sup, w, now)
  if (end == null) { w.missed = 0; return }
  const missed = Math.floor((now - Math.max(w.lastBeat ?? w.started, end)) / sup.alive.beat)
  w.missed = Math.max(0, missed)
  if (missed >= 3 && w.beatRestarted) {
    sup.host.upstream('stuck', w, { wid: w.id, why: MISSED, missed })
    sup.stop(w.id, MISSED, { stall: true })
  } else if (missed >= 2 && !w.beatRestarted) {
    w.beatRestarted = true
    restartFromCheckpoint(sup, w, `${missed} missed heartbeats`)
  }
}

function zombie(sup, w, now) {
  if ((w.pending || []).length || (w.timers || []).length || (w.subs || []).length || (w.minding || []).length) return
  if (w.awaiting && now < w.awaiting.due) return                            // a run inside its hop deadline waits on its brain
  // a filed run with no hop yet waits an hour for a driver (kick.mjs UNCLAIMED_S) whether or not a ticket is open: its checkout act
  // ends before the driver arrives (2026-10-23: 69 runs stalled at 5-13 min with 0 rounds behind two busy drivers)
  if (w.run && !(w.run.hops > 0) && now - (w.started ?? now) < 3600) return
  const live = (id) => { const c = sup.workers.get(id); return c && ['running', 'starting', 'paused'].includes(c.state) }
  if ((w.children || []).some(live)) return                              // a child's report can wake it
  if (w.cart?.outcome === 'done') { sup.stop(w.id, `done: ${w.cart.said}`); return }   // it said done: it is done
  if (now - (w.lastBeat ?? w.started) < sup.alive.beat) return            // one beat to arm what it waits on
  sup.host.upstream('stuck', w, { wid: w.id, why: STALLED })
  sup.stop(w.id, STALLED, { state: 'stalled', stall: true })
}

// ── checkpoints ─────────────────────────────────────────────────────────────────────────────────────────────────────
/** Its resumable state, as JSON: enough to load it again, re-arm its timers and subscriptions, and keep its tickets. */
export function snapshot(sup, w) {
  return {
    v: 1, t: sup.host.now(), id: w.id, name: w.name, program: w.program, tier: w.tier, parent: w.parent, policy: w.policy,
    by: w.by, state: w.state, verbs: [...(w.verbs || [])], readsUntrusted: !!w.readsUntrusted, kv: w.kv,
    gen: w.gen || 1, slot: w.slot ?? null, calls: w.calls || 0,            // the generation, the slot and the call ordinal come back on a resume
    pending: (w.pending || []).map((t) => ({ ...t, was: [...(t.was || [])] })),
    contract: w.contract || null, run: w.run ? { ...w.run, hands: [...w.run.hands], acts: [...w.run.acts] } : null,   // K3: a run comes back with its contract
    awaiting: w.awaiting || null,                                           // the run's wait on its brain, re-armed on resume
    timers: (w.timers || []).map((h) => h.spec).filter(Boolean), subs: (w.subs || []).map((s) => ({ ...s })),
    packet: w.packet || null, steps: w.steps || 0, tools: { ...(w.tools || {}) },
    cart: w.cart ? { ...w.cart, ...(w.cart.noted instanceof Set ? { noted: [...w.cart.noted] } : {}) } : null,
    started: w.started,
    children: [...(w.children || [])], kids: (w.children || []).map((id) => sup.workers.get(id)).filter((c) => c && c.sha).map((c) => ({ id: c.id, name: c.name, sha: c.sha })),
    mind: w.mind || null, restarts: w.restarts || 0, last_beat: w.lastBeat ?? null,
  }
}

/** One file per worker, written whole or not at all (tmp + rename); the last checkpoint only. */
export function checkpointStore(dir) {
  const file = (id) => path.join(dir, `${String(id).replace(/[^\w.-]/g, '_')}.json`)
  return {
    dir,
    write(id, d) {
      fs.mkdirSync(dir, { recursive: true })
      const tmp = `${file(id)}.${process.pid}.tmp`
      fs.writeFileSync(tmp, JSON.stringify(d))
      fs.renameSync(tmp, file(id))
    },
    read(id) { try { return JSON.parse(fs.readFileSync(file(id), 'utf8')) } catch { return null } },
    drop(id) { try { fs.unlinkSync(file(id)) } catch { /* never written */ } },
  }
}

/** The name a procedure is bound to in the worker's own top level, if any (a timer armed in a step re-arms by name). */
export function nameOf(w, f) {
  for (const [k, v] of w.env?.vars || []) if (v === f) return k
  return null
}

/** After a load: arm again what the load itself does not (timers a step armed; subscriptions a step made). */
export function rearm(sup, w, ck) {
  const now = sup.host.now()
  let armed = 0, lost = 0
  for (const s of ck.timers || []) {
    if (s.origin !== 'step') continue                     // the program's own load armed it again
    let f = null
    try { f = s.fn ? w.env.get(s.fn) : null } catch { f = null }
    if (!f || !(typeof f === 'function' || f.params)) f = s.ref || null   // in this process, the closure itself
    if (!f) { lost++; continue }
    sup._arm(w, s.verb, s.verb === 'after' ? Math.max(1, s.due_at - now) : s.seconds, f, 'step', s.due_at)
    armed++
  }
  for (const s of ck.subs || []) {
    if (w.subs.some((x) => x.metric === s.metric)) continue
    w.subs.push({ metric: s.metric, seconds: s.seconds })
    sup.host.subscribe?.(w, s.metric, s.seconds)
  }
  if (lost) think(w, 'state', `${lost} timer(s) armed with an unnamed procedure could not be armed again`, now)
  w.lostTimers = (w.lostTimers || 0) + lost
  return { armed, lost }
}

function restartFromCheckpoint(sup, w, why) {
  const now = sup.host.now()
  const ck = snapshot(sup, w)
  ck.timers = (w.timers || []).map((h) => h.spec && { ...h.spec, ref: h.fnRef }).filter(Boolean)
  const keep = { lastBeat: w.lastBeat, missed: w.missed }
  w.state = 'starting'
  sup._boot(w)
  Object.assign(w, keep)                                   // a restart is not a beat: a third miss still stops it
  if (w.state === 'running') rearm(sup, w, ck)
  w.restarts = (w.restarts || 0) + 1
  event(sup, 'restart', w, why)
  think(w, 'state', `restarted from its checkpoint: ${why}`, now)
  sup.host.upstream('restarted', w, { why })
  sup._checkpoint(w)
}

// ── the context packet ──────────────────────────────────────────────────────────────────────────────────────────────
const clip = (x, n = 400) => (x == null ? null : typeof x === 'string' ? x.slice(0, n) : x)
const list = (x, n = 20) => (Array.isArray(x) ? x.slice(-n).map((y) => clip(typeof y === 'string' ? y : JSON.stringify(y), 300)) : x == null ? [] : [clip(String(x), 300)])

/** Only the packet's own keys, bounded. */
export function packetOf(p) {
  if (!p || typeof p !== 'object') return null
  const o = Object.fromEntries(PACKET_KEYS.map((k) => [k, p[k] ?? null]))
  o.goal = clip(o.goal); o.task = clip(o.task); o.branch = clip(o.branch, 120); o.parent = clip(o.parent, 60)
  o.done_so_far = list(o.done_so_far); o.cortex_refs = list(o.cortex_refs)
  return o
}

/** A child's packet from its parent: what the parent was given or keeps (goal, task, done_so_far, cortex_refs, branch),
 *  else a cart's (does …) and its steps done so far. Read at the spawn, so it holds the spawning step's own work too. */
export function packetFrom(parent, plainKv) {
  const kv = plainKv(parent.kv), pp = parent.packet || {}
  const steps = (parent.cart?.steps || []).filter((s) => s.status === 'done').map((s) => `${s.name}: ${s.why}`)
  return packetOf({
    goal: kv.goal ?? pp.goal ?? parent.cart?.does ?? null, task: kv.task ?? pp.task ?? null, parent: parent.id,
    done_so_far: kv.done_so_far ?? (steps.length ? steps : pp.done_so_far ?? []), cortex_refs: kv.cortex_refs ?? pp.cortex_refs ?? [],
    branch: kv.branch ?? pp.branch ?? null, deadline: pp.deadline ?? null,
  })
}

// ── what the desk reads ─────────────────────────────────────────────────────────────────────────────────────────────
const r1 = (x) => Math.round(x * 10) / 10

/** The fields the Agents card reads, on a worker's description and its tree node. */
export function aliveFields(w) {
  const now = w.clock ? w.clock() : Date.now() / 1000
  return {
    pending: (w.pending || []).map((t) => ({ ticket: t.ticket, op: t.op, kind: t.kind, age_s: r1(now - t.sent_at),
                                             deadline_in_s: t.deadline_at == null ? null : r1(t.deadline_at - now), tries: t.tries,
                                             waiting: t.waiting || null })),
    timers: (w.timers || []).length, subs: (w.subs || []).length, minds_in_flight: (w.minding || []).length,
    last_beat: w.lastBeat ?? null, beat_age_s: w.lastBeat == null ? null : r1(now - w.lastBeat), missed_beats: w.missed || 0,
    packet: w.packet || null, checkpoint_t: w.checkpointT ?? null, steps: w.steps || 0, tools: { ...(w.tools || {}) },
    stall_reason: w.stallReason || null, resumed_from: w.resumedFrom ?? null,
  }
}
