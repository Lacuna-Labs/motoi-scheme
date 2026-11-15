// THE SUPERVISOR — owns a foreman's workers on the Erlang model (OTP; Fly's FLAME): a slat program as a process with its own environment,
//   a fuel budget per event, a small KV kept on purpose, a tier, a parent and children; verbs on · subscribe · every · report · remember · recall ·
//   need-brain · spawn · ask · stop. A throwing handler restarts the worker fresh (KV survives); 3 crashes in 300 s → grave. A restart resumes.
// A worker's end and restart (stop, the crash, the grave, the restart family, a cart's retirement) is lifecycle.mjs's (finale
//   order §3.16 unit 4); the supervisor's `stop` and `_run` call it.
// Refuses: HTTP and files (`host` gives clock, persistence, upstream — same code in a test, on the Studio, on a Fly runner); a restart of a run
//   or a hand (exit 30); a message that is not a signed protocol form (dropped, counted); a verb outside the worker's set (capabilities.mjs);
//   a ghost's message: one for a past generation (a restart adds one to `gen`) or for a buried worker whose tombstone stands (`ghost_worker`).
// Implements: design §6 (the kernel; restart types, intensity), §17; keeps LACUNA-1.3-DESIGN §32 and §45.3 (2026-10-19, alive.mjs) as history.
// Invariants (§18): "If a step is done, then a ticket closed it"; "If a run foreman died, then its children are buried"; the supervisor only supervises.
// Faults (§16): F-04 (three exit 30 in 300 s → grave), F-06 (stalled).
// The pausable header (F2, 2026-10-24; MINDS §4.5, CARDS-2.0 §8.4): a job that declares (pausable . #t) is the broker's to
//   pause, park and resume (broker.mjs); the supervisor reads the header, names the job's process from an act's reply, and
//   tells the broker when the job starts and ends. Invariant: "a paused worker is not dead" (its clock is held, never expired).
import { readFileSync } from 'node:fs'
import crypto from 'node:crypto'
import { parse, evaluate, apply, baseEnv, toScheme, toJson, symOf, Sym } from './scheme.mjs'
import { capsFor, literalStrings, PURE, ACTING, HAND_READS } from './capabilities.mjs'
import { Gate, seal } from './protocol.mjs'
import { mindVerbs } from './mind.mjs'
import { defineVerbs } from './verbs.mjs'
import { openContract } from './contract.mjs'
import { jobStarted } from './broker.mjs'
import { crash, stopWorker } from './lifecycle.mjs'
import { noteWorkRow } from './runs.mjs'
import { attachTalk, think, event } from './talk.mjs'
import { isCart, readCart, cartState, cartVerbs, cartBrain, noteReport, onCall, step } from './cart.mjs'
import { aliveConfig, aliveFields, beat, tool, freshTicket, openTicket, closeTicket, adoptTicket, sweep, snapshot, rearm, nameOf,
         packetOf, packetFrom } from './alive.mjs'

export const LIMITS = Object.freeze({
  fuelLoad: 200_000,        // steps to load a program
  fuelEvent: 50_000,        // steps per event — a loop stops itself
  depth: 3,                 // a worker's worker's worker, no deeper
  childrenEach: 8,
  filedEach: 8,             // runs in flight per filer (design §10's run-foreman ceiling)
  workers: 64,              // per foreman
  everyMin: 5,              // seconds
  subscribeMin: 15,         // seconds
  crashes: 3, crashWindow: 300,   // OTP restart intensity: 3 in 300 s → grave
  reportsKept: 200,
  mailbox: 100,             // messages a paused worker keeps for its resume (Erlang's mailbox, bounded)
  programBytes: 64_000,
})

// MANNERS (the owner, 2026-10-18: "very aware of its process usage … stop itself … be very gentle … friendly to each
// other"): a foreman hushes when the box or itself is over budget — timers and subscriptions skip their turn, spawns
// wait — and a worker that burns too much fuel in a minute is slowed on its own. host.manners() says why, or null.
export const MANNERS = Object.freeze({ fuelPerMinute: 2_000_000, hushCheck: 15 })

/** Seconds a stopped or buried worker's tombstone answers for its id once its record leaves the table (send's ghost guard). */
export const TOMBSTONE_S = 600

// A remembered value comes back as it went in: a symbol stays a symbol (2026-10-19: (remember 'step 'pass) came back as
// the string "pass", so every (eq? (recall 'step) 'pass) in the release cart was false). Kept as JSON on disk, a symbol
// tagged {"$sym": name}.
export function kvOut(v, depth = 0) {
  if (depth > 12) return '…'
  if (v instanceof Sym) return { $sym: v.name }
  if (Array.isArray(v)) return v.map((x) => kvOut(x, depth + 1))
  if (v && typeof v === 'object' && 'car' in v && 'cdr' in v) return [kvOut(v.car, depth + 1), kvOut(v.cdr, depth + 1)]
  return toJson(v, depth)
}
export function kvIn(x) {
  if (Array.isArray(x)) return x.map(kvIn)
  if (x && typeof x === 'object' && typeof x.$sym === 'string' && Object.keys(x).length === 1) return symOf(x.$sym)
  return toScheme(x)
}

// what a person reads (the desk, describe): a remembered symbol by its name
const plain = (x) => (Array.isArray(x) ? x.map(plain) : x && typeof x === 'object' && typeof x.$sym === 'string' ? x.$sym
  : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, plain(v)])) : x)
export const plainKv = (kv) => plain(kv || {})

export const TIERS = ['watch', 'act']            // act = may file a contract with (ask …); nothing writes the world directly
/** OTP's restart types (3.0 §6 change 5): permanent = always restarted on a crash; transient = restarted on a crash, never after
 *  a normal stop, and an issued act ticket is followed on the restart, never reissued (adoptTicket); temporary = never restarted. */
export const RESTARTS = ['permanent', 'transient', 'temporary']
const intensityOf = (x) => (Array.isArray(x) && x.length === 2 && x[0] > 0 && x[1] > 0 ? { crashes: Number(x[0]), window: Number(x[1]) }
                                                                                       : { crashes: LIMITS.crashes, window: LIMITS.crashWindow })
const tierRank = (t) => Math.max(0, TIERS.indexOf(t))
/** A program's short name on a checkpoint (a reload adopts the child with the same name and program). */
export const shaOf = (text) => crypto.createHash('sha256').update(String(text)).digest('hex').slice(0, 16)
/** Where a worker is: its contract's step, else its cart's steps, else the events it has handled. */

/**
 * THE PAUSABLE HEADER: `(pausable . #t)` with `checkpoint-every`, `memory-mb`, `priority`, `base`, `kind`, `eta-s` in a cart's
 * header, or the same fields as a spawn option. readCart keeps none of them, so the header is read here.
 * @param {string} program the worker's slat text.
 * @param {?Object} given the spawn option, read before the header.
 * @returns {?Object} the job's pause record, or null when the work is not pausable.
 */
export function pausableOf(program, given = null) {
  let h = given
  if (!h && isCart(program)) {
    try {
      const q = parse(String(program))[0][2]
      const a = toJson(Array.isArray(q) && q[0] instanceof Sym && q[0].name === 'quote' ? q[1] : q)
      h = Object.fromEntries((Array.isArray(a) ? a : []).filter((e) => Array.isArray(e) && e.length === 2).map(([k, v]) => [String(k), v]))
    } catch { h = null }
  }
  if (!h || h.pausable !== true) return null
  const pos = (x) => (Number(x) > 0 ? Number(x) : null)
  return { checkpointEvery: pos(h['checkpoint-every'] ?? h.checkpointEvery), memoryMB: pos(h['memory-mb'] ?? h.memoryMB),
           priority: Number.isFinite(Number(h.priority ?? 5)) ? Number(h.priority ?? 5) : 5,
           base: h.base == null ? null : String(h.base).toLowerCase(), kind: h.kind == null ? null : String(h.kind), etaS: pos(h['eta-s'] ?? h.etaS),
           pid: null, runDir: null, heldAt: null, parked: null, parking: null }
}

export class Supervisor {
  constructor(host) {
    this.host = host                              // { now(), save(w), drop(id), upstream(kind, w, data), id(), key?, mind?,
                                                  //   checkpoint?(id, snapshot), deadlines?: {hand, act, acts, beat, mind, sweep} }
    this.alive = aliveConfig(host)                // §45.3: ticket deadlines, the beat, the sweep (alive.mjs)
    this.workers = new Map()
    // the hop key: the foreman's token; a supervisor without one (a test, a trial) still signs, with a key of its own
    this.key = host.key || crypto.randomBytes(32).toString('hex')
    this.gate = new Gate(this.key, () => this.host.now())
    this.pending = new Set()                      // small-mind questions in flight
    this.tombstones = new Map()                   // id → {name, gen, died_at, why} of a stopped or buried worker, TOMBSTONE_S (send's guard)
    attachTalk(this)                              // thoughts per worker, the tree's events (talk.mjs)
  }

  /** §45.3: deadlines, heartbeats and the zombie law, once (alive.mjs). The foreman runs it on an interval. */
  sweep() {
    sweep(this)
    const now = this.host.now()
    for (const [id, t] of this.tombstones) if (now - t.died_at > TOMBSTONE_S) this.tombstones.delete(id)
  }
  startSweep(seconds = this.alive.sweep) {
    const t = setInterval(() => this.sweep(), Math.max(1, seconds) * 1000)
    t.unref?.()
    return t
  }

  /** Wait for every small-mind answer in flight (tests; a clean stop). */
  async settle() { while (this.pending.size) await Promise.allSettled([...this.pending]) }

  /** What the desk shows beside the workers: messages dropped at the gate, and what the small minds did. */
  status() {
    const mind = { asked: 0, ran: 0, labels: 0, dropped: 0, failed: 0 }
    for (const w of this.workers.values()) for (const k of Object.keys(mind)) mind[k] += (w.mind && w.mind[k]) || 0
    return { dropped: { ...this.gate.drops }, mind }
  }

  // ── spawn / stop ──────────────────────────────────────────────────────────────────────────────────────────────────
  spawn({ name, program, tier = 'watch', parent = null, policy = 'one_for_one', by = 'lacuna', kv = {}, id = null,
          verbs = null, readsUntrusted = false, cart = null, packet = null, resume = null, restart = null, intensity = null, pausable = null }) {
    if (!program || typeof program !== 'string') throw new Error('a worker needs a program (slat text)')
    if (program.length > LIMITS.programBytes) throw new Error(`the program is over ${LIMITS.programBytes} bytes`)
    if (!TIERS.includes(tier)) throw new Error(`tier is one of ${TIERS.join(', ')}`)
    if (this.living().length >= LIMITS.workers) throw new Error(`this foreman already runs ${LIMITS.workers} workers`)
    const hush = this.host.manners?.()
    // a cart's header is read before anything runs: its tier and verbs are the header's, its body is checked against them
    const header = isCart(program) ? readCart(program, this.host.tables?.() || {}) : null
    // manners hush the foreman's own new work while the box is loaded; the owner's own (`by: 'owner'`: his `lacuna do`, his press)
    // always starts (the owner, 2026-11-04: "governors off… when i ask… i get it"), and so does the on-call loop (cart.mjs onCall)
    if (hush && !id && by !== 'owner' && !onCall(header)) throw new Error(`not now — the foreman is hushed: ${hush}`)
    if (header) { tier = header.tier; verbs = header.verbs; name = name || header.name }
    // O4: a new cart runs only if its minds fit this box now (box.mjs); a cart brought back after a restart is not re-judged
    if (header && !id) { const fit = this.host.cartFits?.(header); if (fit && !fit.ok) throw new Error(fit.why) }
    const p = parent ? this.workers.get(parent) : null
    if (parent && !p) throw new Error(`no parent ${parent}`)
    if (p) {
      if (p.depth + 1 > LIMITS.depth) throw new Error(`a worker may be at most ${LIMITS.depth} deep`)
      if (p.children.filter((c) => ['running', 'starting', 'paused'].includes(this.workers.get(c)?.state)).length >= LIMITS.childrenEach)   // a paused child lives (U1 2026-10-24)
        throw new Error(`${p.name} already has ${LIMITS.childrenEach} children`)
      if (tierRank(tier) > tierRank(p.tier)) tier = p.tier          // a child never gets more than its parent
    }
    // its verbs: what it asked for, never wider than its tier, its parent, or (reading untrusted text) anything acting
    readsUntrusted = !!(readsUntrusted || p?.readsUntrusted)
    const caps = capsFor({ name: String(name || 'worker'), tier, asked: verbs, parent: p, readsUntrusted })
    const w = {
      id: id || this.host.id(), name: String(name || 'worker').slice(0, 60), program, tier, parent, policy, by,
      // 3.0 §6 change 5: the restart type (watch = permanent, act = transient, a run or hand = temporary) and the intensity
      restart: RESTARTS.includes(restart || header?.restart) ? (restart || header.restart) : tier === 'act' ? 'transient' : 'permanent',
      intensity: intensityOf(intensity || header?.intensity),
      depth: p ? p.depth + 1 : 1, children: [], kv: { ...kv }, state: 'starting', crashes: [], reports: [],
      handlers: new Map(), timers: [], subs: [], started: this.host.now(), env: null, last: null,
      verbs: caps, readsUntrusted, literals: literalStrings(program), sha: shaOf(program),
      // a cart brought back after a foreman restart keeps its run so far (and never runs its (start) twice)
      cart: header ? { ...cartState(header, this.host.now()), ...(cart || {}) } : null,
      // §45.3: its tickets, its context packet, its step and tool counts; a resumed worker brings its own back
      pending: [], steps: 0, tools: {}, lastBeat: null, missed: 0,
      packet: packetOf(packet) || (p ? packetFrom(p, plainKv) : null), packetDelivered: false,
      pausable: pausableOf(program, pausable),
      slot: resume?.slot ?? this.workers.size,      // (my-slot): its index at spawn, kept across a resume
      gen: resume?.gen || 1,                        // (my-gen): the generation counter; a restart adds one (lifecycle.mjs)
    }
    Object.defineProperty(w, 'clock', { value: () => this.host.now(), enumerable: false })
    if (resume) {
      w.pending = (resume.pending || []).map((t) => ({ ...t, was: [...(t.was || [])] }))
      w.steps = resume.steps || 0
      w.tools = { ...(resume.tools || {}) }
      w.packet = resume.packet || w.packet
      w.packetDelivered = true                        // the packet was its first event once; a resume does not repeat it
      if (resume.contract) w.contract = resume.contract   // K3: the contract survives a foreman restart (its exit, if any, with it)
      // a parked job stays parked across a foreman restart: its last park row with no resume after it (F2)
      const lastStop = (w.contract?.stops || []).filter((r) => r.kind === 'park' || r.kind === 'resume').at(-1)
      if (w.pausable && lastStop?.kind === 'park') w.pausable.parked = { step: lastStop.parked_at, checkpoint: lastStop.checkpoint, snapshot: lastStop.snapshot ?? null, at: lastStop.at }
      if (resume.run) w.run = { ...resume.run, hands: new Set(resume.run.hands), acts: new Set(resume.run.acts) }
      // the hop window starts again at the resume: the brain gets its full span to send the next intent (P7 finding 4)
      if (resume.awaiting) w.awaiting = { ...resume.awaiting, since: this.host.now(), due: this.host.now() + Math.max(60, (resume.awaiting.due - resume.awaiting.since) || 300) }
      if (resume.started) w.started = resume.started
      w.resumeKids = resume.kids || []                // its children by name and program: its load adopts them, never spawns twice
    }
    this.workers.set(w.id, w)
    if (p) p.children.push(w.id)
    // K1.12 (B-19): the header's own done-check (`(contract . ((done-check . "(form)")))`) is the contract's; else the done sentence
    if (header && !w.contract) openContract(w, { key: w.id, cart: header.name, goal: header.contract?.goal ?? header.does, doneCheck: header.contract?.done_check ?? header.done })   // §12.2: a cart reads its contract, never writes it
    if (!resume && (w.cart || w.pausable)) noteWorkRow(this, w, 'open')   // a cart's or pausable run's work row (finale order §10 row 5)
    this._boot(w)
    if (resume && w.state === 'running') this._resumed(w, resume)
    this.host.save(w)
    this._checkpoint(w)
    if (w.pausable && !resume && w.state === 'running') jobStarted(this, w)   // the broker decides whether the 26B parks (§8.4)
    return w
  }

  /** A worker back from its checkpoint (a foreman restart): what its load did not arm is armed again, and it says so. */
  _resumed(w, ck) {
    const now = this.host.now()
    const r = rearm(this, w, ck)
    w.resumedFrom = ck.t ?? null
    const line = `resumed from its checkpoint${ck.t ? ` of ${new Date(ck.t * 1000).toTimeString().slice(0, 8)}` : ''}: ` +
                 `${w.pending.length} ticket(s) pending, ${w.timers.length} timer(s), ${w.subs.length} subscription(s)` +
                 `${r.lost ? `, ${r.lost} timer(s) lost` : ''}`
    think(w, 'state', line, now)
    event(this, 'resume', w, line)
  }

  /** A worker that comes back after a foreman restart: from its checkpoint (`ck`), never as a blank worker. */
  resume(ck) {
    return this.spawn({ name: ck.name, program: ck.program, tier: ck.tier, parent: ck.parent, policy: ck.policy, by: ck.by,
                        kv: ck.kv || {}, id: ck.id, verbs: ck.verbs || null, readsUntrusted: !!ck.readsUntrusted,
                        cart: ck.cart || null, resume: ck, pausable: ck.pausable || null })
  }

  /** The step boundary: its resumable state to the host's checkpoint file (the last one only). A disk that refuses is
   *  noted on the worker, never a crash of it. */
  _checkpoint(w) {
    if (!this.host.checkpoint || this.host.trial) return
    try {
      const d = snapshot(this, w)
      this.host.checkpoint(w.id, d)
      w.checkpointT = d.t
      w.checkpointError = null
    } catch (e) { w.checkpointError = String(e && e.message ? e.message : e).slice(0, 200) }
  }

  _ticket(w, prefix = '') { return freshTicket(w, `${w.id}-${prefix}${Math.round(this.host.now() * 1000) % 1e9}`) }

  /** Stops a worker and its children (lifecycle.mjs `stopWorker`). `state`: 'retired', or 'stalled' under the zombie law;
   *  `stall`: one of §45.3's rules stopped it (the card says why). */
  stop(id, why = 'stopped', { state = 'retired', stall = false } = {}) { return stopWorker(this, id, why, { state, stall }) }


  living() { return [...this.workers.values()].filter((w) => w.state === 'running' || w.state === 'starting' || w.state === 'paused') }

  // ── events ────────────────────────────────────────────────────────────────────────────────────────────────────────
  /** Deliver one event to one worker: (on 'kind handler) gets (handler value). `targetGen` names the generation the sender
   *  addressed; a ghost's message (that generation is past, or the worker left the table and its tombstone stands) is refused
   *  with `ghost_worker` before it touches a ticket. */
  send(id, kind, value, { background = false, targetGen = null } = {}) {
    const w = this.workers.get(id)
    if (w && targetGen != null && Number(targetGen) !== (w.gen || 1)) {
      return { ok: false, ghost_worker: true, why: `${w.name} runs generation ${w.gen || 1}; a message for generation ${targetGen} is refused` }
    }
    const dead = w ? null : this.tombstones.get(id)
    if (dead) return { ok: false, ghost_worker: true, why: `${dead.name} (generation ${dead.gen}) is buried: ${dead.why}` }
    // a hand's or an act's reply clears its ticket, whatever the worker does with it (§45.3)
    const closed = w && (kind === 'hand' || kind === 'act' || kind === 'brain') ? closeTicket(this, w, String(kind), value) : null
    // a pausable job's process is named by the act reply that started it (`rows.pid`, `rows.run_dir`), never by a read's rows;
    // the reply's exit is the hands' record the broker reads when the job ends (an exam is owed only after an exit 0)
    if (w?.pausable && kind === 'act') {
      w.pausable.lastAct = { op: String(value?.op ?? ''), exit: value?.exit ?? null }
      if (Number(value?.rows?.pid) > 0) { w.pausable.pid = Number(value.rows.pid); if (value.rows.run_dir) w.pausable.runDir = String(value.rows.run_dir) }
      // a pause pressed before the trainer started is owed its SIGSTOP: sent now, once, so the trainer never runs under a paused worker
      if (w.pausable.pid && w.pausable.stopOwed && w.state === 'paused') { w.pausable.stopOwed = false; this.host.act?.('forge-signal', [w.pausable.pid, 'stop', w.id, w.pausable.runDir || null]) }
    }
    if (closed && !w.handlers.has(String(kind))) this._checkpoint(w)
    if (w && w.state === 'paused' && w.handlers.has(String(kind))) {
      // ERLANG'S MAILBOX: a paused process keeps its messages; they are delivered, in order, on resume. Bounded:
      // past LIMITS.mailbox the oldest goes, and the drop is counted (a mailbox that only grows is a leak)
      const box = (w.mailbox ||= [])
      box.push([String(kind), value])
      if (box.length > LIMITS.mailbox) { box.shift(); w.mailboxDropped = (w.mailboxDropped || 0) + 1 }
      return { ok: true, queued: box.length }
    }
    if (!w || w.state !== 'running') return { ok: false, why: w ? `the worker is ${w.state}` : 'no such worker' }
    const fn = w.handlers.get(String(kind))
    if (!fn) return { ok: false, why: `${w.name} does not handle '${kind}` }
    if (background && this._polite(w)) return { ok: false, why: w.skipWhy, skipped: true }
    // a hand's or an act's op is a name the cart wrote as a symbol ('jobs): it comes back as one, so (case op ((jobs) …))
    // matches (2026-10-19: every op arrived as the string "jobs", and six carts' case never matched)
    const v = (kind === 'hand' || kind === 'act') && value && typeof value.op === 'string' ? { ...value, op: symOf(value.op) } : value
    return this._metered(w, () => apply(fn, [toScheme(v)], this._fuel(w)), `on ${kind}`)
  }

  /** One hop between agents: sealed by the sender, opened at the gate, delivered only if it is the protocol. */
  hop(from, to, kind, body) {
    return this.deliver(seal(this.key, { from, to, kind, body: toJson(body), at: this.host.now() }))
  }

  /** A signed message arriving (a hop inside, or the HTTP door): unsigned, forged, stale, replayed or malformed → dropped
   *  and counted. `to` pins the receiver (the door's URL): a message for another worker is malformed here. */
  deliver(envelope, { to = null, background = false } = {}) {
    const r = this.gate.open(envelope)
    if (!r.ok) return { ok: false, why: `dropped (${r.drop}): ${r.why}`, dropped: r.drop }
    if (to && r.msg.to !== to) { this.gate.drops.malformed++; return { ok: false, why: 'dropped (malformed): addressed to another worker', dropped: 'malformed' } }
    return this.send(r.msg.to, r.msg.kind, r.msg.body, { background })
  }

  /** Manners: the foreman hushed (the box is busy), or this worker spent its minute's fuel → skip this turn, counted. */
  _polite(w) {
    const hush = this.host.manners?.()
    this._minute(w)
    const why = hush && !onCall(w.cart) ? `the foreman is hushed: ${hush}` : w.fuelUsed > MANNERS.fuelPerMinute ? 'it spent its fuel for this minute' : null
    if (why) { w.skipped = (w.skipped || 0) + 1; w.skipWhy = why; return true }
    return false
  }

  _fuel(w) { const f = { n: LIMITS.fuelEvent }; w._lastFuel = f; return f }
  /** The minute the fuel is counted in; a new minute starts at 0 (U1 2026-10-24: only a background turn rolled it, so
   *  the first one of a minute wiped what the foreground had spent in it). */
  _minute(w) { const m = Math.floor(this.host.now() / 60); if (w.fuelMinute !== m) { w.fuelMinute = m; w.fuelUsed = 0 } }

  // every handled event, timer fire and (start) is a step: a beat, a count, and a checkpoint at its boundary (§45.3)
  _metered(w, thunk, what) {
    beat(this, w)
    const r = this._run(w, thunk, what)
    if (w._lastFuel) { this._minute(w); w.fuelUsed = (w.fuelUsed || 0) + (LIMITS.fuelEvent - Math.max(0, w._lastFuel.n)); w._lastFuel = null }
    w.steps = (w.steps || 0) + 1
    this._checkpoint(w)
    return r
  }

  /** Every worker that handles `kind` (a subscription's metric, a broadcast). */
  broadcast(kind, value) {
    for (const w of this.living()) if (w.handlers.has(String(kind))) this.send(w.id, kind, value)
  }

  // ── inside ────────────────────────────────────────────────────────────────────────────────────────────────────────
  _boot(w) {
    this._clear(w)
    w.handlers = new Map()
    const fuel = { n: LIMITS.fuelLoad }
    const env = baseEnv(fuel)
    this._verbs(w, env)
    w.env = env
    w.loading = true                              // a timer armed now is the load's: the next load arms it again itself
    w.adoptable = new Set((w.pending || []).map((t) => t.ticket))   // a ticket the last load asked is not asked twice
    const living = w.children.map((c) => this.workers.get(c)).filter((c) => c && ['running', 'starting', 'paused'].includes(c.state))
    w.adoptableKids = living.map((c) => ({ id: c.id, name: c.name, sha: c.sha })).concat((w.resumeKids || []).filter((k) => !this.workers.has(k.id)))
    w.resumeKids = null
    const r = this._run(w, () => { for (const form of parse(w.program)) evaluate(form, env, fuel) }, 'load', true)
    w.loading = false
    w.adoptable = null
    w.adoptableKids = null
    if (r.ok && w.state === 'starting') w.state = 'running'
    if (r.ok) beat(this, w)
    if (r.ok && w.state === 'running' && w.packet && !w.packetDelivered) this._deliverPacket(w)
    if (r.ok && w.cart && !w.cart.begun && w.state === 'running') this._beginCart(w)
    return r
  }

  /** §45.3 inheritance: the packet is its first event, (on 'start packet), when its program listens for it. */
  _deliverPacket(w) {
    w.packetDelivered = true
    if (w.handlers.has('start')) this.send(w.id, 'start', w.packet)
  }

  /** A cart's first boot (not a restart): say what was chosen, then run its (start) once if it defines one. */
  _beginCart(w) {
    w.cart.begun = true
    const minds = Object.entries(w.cart.minds).map(([j, m]) => `${j} → ${m.model} (${m.why})`).join('; ')
    step(w, 'load', 'done', `header read; verbs ${w.cart.verbs.join(' ')}${minds ? `; minds: ${minds}` : ''}`, this.host.now())
    let start = null
    try { start = w.env.get('start') } catch { /* no (define (start) …): the cart starts from its handlers */ }
    if (start) this._metered(w, () => apply(start, [], this._fuel(w)), 'start')
  }

  _run(w, thunk, what, loading = false) {
    try {
      const v = thunk()
      return { ok: true, value: toJson(v) }
    } catch (e) {
      return crash(this, w, `${what}: ${e && e.message ? e.message : e}`, loading)   // lifecycle.mjs
    }
  }



  _clear(w) {
    for (const t of w.timers || []) { clearInterval(t); clearTimeout(t) }
    w.timers = []
    w.subs = []
  }

  // ── the verbs (Lacuna Scheme's foreman module) ───────────────────────────────────────────────────────────────────
  _verbs(w, env) { defineVerbs(this, w, env) }   // verbs.mjs (K1, 2026-10-23): what a program can say lives beside, not inside

  /** One timer, with the spec its checkpoint keeps ({verb, seconds, due_at, origin, fn}). An (after …) leaves the
   *  worker's timers when it fires, so a worker whose last step ran holds none (the zombie law counts them). */
  _arm(w, verb, s, f, origin, dueAt = null) {
    const spec = { verb, seconds: s, due_at: dueAt ?? this.host.now() + s, origin, fn: origin === 'step' ? nameOf(w, f) : null }
    let t
    if (verb === 'every') {
      t = setInterval(() => {
        spec.due_at = this.host.now() + s
        if (w.state === 'running' && !this._polite(w)) this._metered(w, () => apply(f, [], this._fuel(w)), 'every')
      }, s * 1000)
    } else {
      const run = () => this._metered(w, () => apply(f, [], this._fuel(w)), 'after')
      // paused by the owner: the step waits for the resume (talk.mjs interrupt) instead of being lost
      t = setTimeout(() => {
        w.timers = w.timers.filter((x) => x !== t)
        if (w.state === 'running') run(); else if (w.state === 'paused') (w.held ||= []).push(run)
      }, s * 1000)
    }
    t.unref?.()                                  // a worker's timer never holds the process open (the server does)
    t.spec = spec
    t.fnRef = f
    w.timers.push(t)
    return t
  }

  _may(w, verb) {
    if (w.verbs.has(verb)) return
    if (verb === 'ask' && w.tier !== 'act') throw new Error(`${w.name} is a watch worker — it may not ask to act`)
    const why = w.readsUntrusted && ACTING.has(verb) ? 'it reads untrusted text, so it may not act' : 'it is not among its verbs'
    throw new Error(`${w.name} may not (${verb} …) — ${why}`)
  }
}

export { symOf }
