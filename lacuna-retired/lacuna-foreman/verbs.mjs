// verbs.mjs — THE WORKER VERBS (Lacuna Scheme's foreman module). Owns: every verb a worker program may call — on ·
// every · after · subscribe · report · remember · recall · need-brain · spawn · send-to · hand · act · ask · stop and the
// pure helpers — defined into a worker's environment with its capability check and its call counter. Refuses: a verb the
// worker does not hold (sup._may), a spawn from text that is not a literal of the program, an act the cart header does
// not name, an ask from a watch worker. Implements: LACUNA-3.0-DESIGN §6 (the kernel as built; split out of
// supervisor.mjs 2026-10-23 under the 500-line rule, K1), §6 change 7 lands here (call · cast · link · monitor · register
// · state! · promise · want · drop · mail · exit · spawn-foreman). Invariants (§18): "if an act ran, a press ticket
// preceded it"; "if a step is done, a ticket closed it". Faults (§16): F-02 (tool not in header), F-08 (act waits on the
// press). The supervisor keeps the process model; sup file keeps only what a program can say.
import { nextDeskSeq, runDeskVerb } from './desk-verbs.mjs'
import { toJson, Sym } from './scheme.mjs'
import { contractStep } from './contract.mjs'
import { fileRun } from './intents.mjs'
import { sendMail, mailArgs } from './mail.mjs'
import { think } from './talk.mjs'
import { PURE, ACTING, HAND_READS } from './capabilities.mjs'
import { mindVerbs } from './mind.mjs'
import { cartVerbs, cartBrain, noteReport, step } from './cart.mjs'
import { beat, tool, openTicket, adoptTicket, adoptChild, freshTicket } from './alive.mjs'
import { LIMITS, kvOut, kvIn, shaOf } from './supervisor.mjs'

/**
 * Define every worker verb into `env` for the worker `w` under the supervisor `sup`.
 * A verb the worker does not hold throws one sentence (sup._may); every call is counted by name (the Agents card).
 * @param {import('./supervisor.mjs').Supervisor} sup the supervisor that owns `w` (clock, tickets, hops, upstream)
 * @param {object} w the worker: name · tier · verbs (Set) · kv · handlers · timers · subs · reports · cart · readsUntrusted
 * @param {object} env the worker's Scheme environment (baseEnv with the refused host verbs shadowed)
 * @returns {void}
 */
export function defineVerbs(sup, w, env) {
  // a verb the worker does not hold is a refusal, said plainly; the pure helpers are everyone's
  // every call is counted by verb: the Agents card's tool strip (§45.4)
  const def = (name, fn, perm = 'read') => env.define(name, PURE.has(name) ? (...a) => { tool(w, name); return fn(...a) }
    : (...a) => { sup._may(w, name); tool(w, name); return fn(...a) }, { perm })
  const name = (s) => (s instanceof Sym ? s.name : String(s))
  const handler = (fn, verb) => {
    if (typeof fn !== 'function' && !(fn && fn.params)) throw new Error(`${verb} needs a procedure`)
    return fn
  }
  def('on', (kind, fn) => { w.handlers.set(name(kind), handler(fn, 'on')); return true })
  def('every', (seconds, fn) => {
    const s = Math.max(LIMITS.everyMin, Number(seconds) || 0)
    const f = handler(fn, 'every')
    if (sup.host.trial) { (w.trialTimers ||= []).push(f); return s }      // a dry run calls it once instead
    sup._arm(w, 'every', s, f, w.loading ? 'load' : 'step')
    return s
  })
  def('after', (seconds, fn) => {
    // one step of a plan, once, later (1 s … 7 days). Kept across a foreman restart when its procedure has a name in
    // the program's top level — (after 60 check), not (after 60 (lambda …)): the checkpoint arms it again by that name
    const s = Math.min(7 * 86400, Math.max(1, Number(seconds) || 0))
    const f = handler(fn, 'after')
    if (sup.host.trial) { (w.trialTimers ||= []).push(f); return s }
    sup._arm(w, 'after', s, f, w.loading ? 'load' : 'step')
    return s
  })
  def('subscribe', (metric, seconds) => {
    const s = Math.max(LIMITS.subscribeMin, Number(seconds) || 60)
    w.subs.push({ metric: name(metric), seconds: s })
    sup.host.subscribe?.(w, name(metric), s)
    return s
  })
  def('report', (kind, ...data) => {
    const r = { at: sup.host.now(), kind: name(kind), data: data.map((d) => toJson(d)) }
    w.reports = w.reports.concat(r).slice(-LIMITS.reportsKept)
    noteReport(w, r.kind, r.data)
    if (r.kind === 'step' && w.contract) contractStep(sup, w, 'running', r.data.map((d) => (typeof d === 'string' ? d : JSON.stringify(d))).join(' '))   // §12.2: the step text; only a ticket makes it done (F-12)
    beat(sup, w)
    sup.host.save(w)
    sup.host.upstream('report', w, r)
    if (w.parent) sup.hop(w.id, w.parent, 'child-report', { from: w.name, kind: r.kind, data: r.data })
    return true
  })
  def('work-order', (goal, forWho) => {
    // E14 row 11: a red the on-call loop cannot clear becomes work, the one record the desk's verb writes (desk-verbs.mjs);
    // a host that names no desk folder files nothing (a test never writes the owner's queue)
    const dir = sup.host.deskDir?.()
    const r = dir ? runDeskVerb('work-order', [{ goal: String(goal), for: name(forWho) }], { dir, run: w.run?.key || w.id, now: sup.host.now(), seq: nextDeskSeq })
      : { exit: 12, why: 'this foreman names no desk folder' }
    think(w, 'state', r.exit === 0 ? `work order ${r.rows.id} for the ${r.rows.for}: ${String(goal).slice(0, 120)}` : `no work order: ${r.why}`, sup.host.now())
    return r.exit === 0 ? r.rows.id : false
  }, 'state-change')
  def('mail', (kind, what, extra) => {
    const r = sendMail(sup, w, mailArgs(name(kind), what, toJson(extra ?? null)))
    if (!r.ok) throw new Error(r.why)
    think(w, 'mail', `mail ${name(kind)}: ${String(what).slice(0, 120)}${r.deduped ? ` (count ${r.count})` : ''}`, sup.host.now())
    return r.id
  })
  def('remember', (k, v) => { w.kv[name(k)] = kvOut(v); sup.host.save(w); return v })
  def('recall', (k, dflt = false) => (name(k) in w.kv ? kvIn(w.kv[name(k)]) : dflt))
  def('need-brain', (...args) => {
    const [question, ...facts] = cartBrain(w, args)        // in a cart: a judgment point first, or a refusal
    // a question to the 26B is a ticket with the mind's deadline and the header's fallback (F-09): no answer by then and the
    // fallback answers as (on 'brain {by fallback}) — ask-owner goes up as an ask, skip answers #f, stop stops the worker
    const fb = w.lastJudgment || { topic: null, fallback: 'ask-owner' }
    const ticket = freshTicket(w, `${w.id}-brain-${(w.cart?.brain ?? 0) || Date.now() % 1e6}`)
    const t = openTicket(sup, w, 'brain', fb.topic || 'brain', [String(question)], ticket, { deadlineS: sup.alive.mind }); t.once = true; t.fallback = fb.fallback; t.deadline_at = sup.host.now() + sup.alive.mind
    sup.host.upstream('need-brain', w, { ticket, question: String(question), facts: facts.map((f) => toJson(f)), topic: fb.topic, fallback: fb.fallback })
    return ticket
  })
  def('spawn', (childName, program, tierOrVerbs, verbs) => {
    // plan, then execute: the child's program is text written in THIS program — never assembled from what arrived
    if (typeof program !== 'string' || !w.literals.has(program))
      throw new Error(`${w.name} may spawn only a program written in its own text — runtime data never becomes code`)
    const kept = adoptChild(w, name(childName).slice(0, 60), shaOf(program))   // a reload adopts the child it spawned the first time
    if (kept) return kept
    const asked = Array.isArray(tierOrVerbs) ? tierOrVerbs : Array.isArray(verbs) ? verbs : null
    const tier = tierOrVerbs && !Array.isArray(tierOrVerbs) ? name(tierOrVerbs) : w.tier
    const c = sup.spawn({ name: name(childName), program, tier, parent: w.id, by: w.id, verbs: asked && asked.map(name) })
    return c.id
  })
  def('send-to', (id, kind, value) => sup.hop(w.id, String(id), name(kind), value).ok)
  def('file', (spec) => {
    // a run under a key, filed once: the triggers cart says (file '((key "ipad-verify@07:00") (cart ipad-verify) …)) (3.0 §7.2, C's mail 2026-10-23)
    const o = alistOf(toJson(spec))
    const key = String(o.key || '').trim()
    if (!key) throw new Error(`${w.name} files a run under a key: (file '((key "…") …))`)
    const open = [...sup.workers.values()].find((x) => x.run && x.run.key === key && ['running', 'starting', 'paused'].includes(x.state))
    if (open) return open.id
    // the kernel's own ceiling on runs in flight per filer (design §10: ≤ 8 run foremen; 2026-10-24: a cart's bookkeeping slipped and 44 runs
    // with 44 checkouts ate the disk): past it the filing answers #f and the cart tries again on its next tick
    const mine = [...sup.workers.values()].filter((x) => x.run && x.by === w.id && ['running', 'starting', 'paused'].includes(x.state)).length
    if (mine >= LIMITS.filedEach) { think(w, 'state', `file ${key}: ${mine} runs of mine are living already (the ceiling is ${LIMITS.filedEach}); not filed`, sup.host.now()); return false }
    const r = fileRun(sup, { key, cart: o.cart == null ? null : String(o.cart), goal: String(o.goal || o.cart || key), doneCheck: o['done-check'] == null ? undefined : String(o['done-check']),
                             hands: listOf(o.hands), acts: listOf(o.acts), tier: listOf(o.acts).length ? 'act' : 'watch', intensity: o.intensity == null ? undefined : name(o.intensity),
                             // a run is its own unit of work (law 2): filed BY the cart, never its child — the cart follows it by its contract and
                             // neither its crash nor its stop reaches the run (2026-10-24: a cart's crash stopped its eight runs)
                             by: w.id, parent: null, desk: false, repo: o.repo == null ? null : v(o.repo), touches: listOf(o.touches), press: o.press == null ? null : v(o.press) })
    sup.host.upstream('filed', w, { run: r.id, key, cart: r.run.cart, trigger: o.trigger == null ? null : String(o.trigger), evidence: o.evidence ?? null })
    return r.id
  })
  def('hand', (op, ...args) => {
    if (w.readsUntrusted && !HAND_READS.has(name(op))) throw new Error(`${w.name} reads untrusted text — it may hand only a read`)
    // a READ the foreman cannot do itself (its sandbox): Lacuna does it and the answer comes back as (on 'hand …)
    // the ticket stays on the worker until its reply clears it, under a deadline (§45.3): never fire-and-forget again
    const a = args.map((x) => toJson(x))
    const kept = adoptTicket(w, 'hand', name(op), a)
    if (kept) return kept
    const ticket = sup._ticket(w)
    // the road that reads it, named (E14 row 11): the executor over its socket, or Lacuna's API while the executor is down
    step(w, `hand ${name(op)}`, 'done', `asked ${sup.host.handRoad?.() || 'Lacuna'} to read ${name(op)} ${a.join(' ')}`.trim(), sup.host.now(), { ticket })
    openTicket(sup, w, 'hand', name(op), a, ticket)
    sup.host.upstream('hand', w, { ticket, op: name(op), args: a })
    return ticket
  })
  def('act', (op, ...args) => {
    // a cart's act (acts.py): only an act its header names; Lacuna checks the owner's press on sup run and answers
    if (!w.cart || !(w.cart.acts || []).includes(name(op))) throw new Error(`${w.name} may act only with an act its cart header names — not ${name(op)}`)
    const a = args.map((x) => toJson(x))
    const kept = adoptTicket(w, 'act', name(op), a)
    if (kept) return kept
    const ticket = sup._ticket(w, 'a')
    step(w, `act ${name(op)}`, 'done', `asked Lacuna to ${name(op)} ${a.join(' ')}`.trim(), sup.host.now(), { ticket })
    openTicket(sup, w, 'act', name(op), a, ticket)
    sup.host.upstream('act', w, { ticket, op: name(op), args: a })
    return ticket
  }, 'state-change')
  def('ask', (what) => {
    sup.host.upstream('ask', w, { what: String(what) })
    return true
  }, 'state-change')
  def('stop', () => { setTimeout(() => sup.stop(w.id, 'it stopped itself'), 0); return true })
  def('get', (alist, key, dflt = false) => {
    // (get r 'ok) — a value out of an event's alist (a hand's answer, a report): ((ok #t) (result …)) → #t
    const k = name(key)
    if (Array.isArray(alist)) for (const x of alist) if (Array.isArray(x) && x.length >= 2 && name(x[0]) === k) return x[1]
    return dflt
  })
  def('take', (lst, n) => (Array.isArray(lst) ? lst.slice(0, Math.max(0, Number(n) || 0)) : []))
  def('sort-by', (lst, key, order) => {
    // (sort-by rows 'size) biggest first; (sort-by rows 'name 'up) smallest first — rows are alists
    if (!Array.isArray(lst)) return []
    const k = name(key)
    const val = (row) => { if (Array.isArray(row)) for (const x of row) if (Array.isArray(x) && name(x[0]) === k) return x[1]; return null }
    const up = order && name(order) === 'up'
    return [...lst].sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * (up ? 1 : -1) })
  })
  def('now', () => Math.round(sup.host.now()))
  def('my-name', () => w.name)
  def('my-gen', () => w.gen || 1)                 // the supervisor's generation counter (a restart adds one)
  def('my-slot', () => w.slot ?? 0)
  def('display', (v) => { w.last = `said: ${String(toJson(v)).slice(0, 200)}`; return undefined })
  def('newline', () => undefined)
  mindVerbs(sup, w, def)
  cartVerbs(sup, w, def)
}

// '((k v) (k . v) (k a b)) as read → {k: v | [a b]}; a list field → its strings
const alistOf = (x) => Object.fromEntries((Array.isArray(x) ? x : []).filter((e) => Array.isArray(e) && e.length).map((e) => [String(e[0]), e.length === 2 ? e[1] : e.slice(1)]))
const listOf = (x) => (Array.isArray(x) ? x.flat(1).map((v) => (v && v.name) || String(v)) : x == null ? [] : [String(v(x))])
const v = (x) => (x && x.name) || x
