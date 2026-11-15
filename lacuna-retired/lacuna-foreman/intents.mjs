// intents.mjs — THE INTENT DOOR. Owns: a run as a worker (`fileRun`), the one entry for a brain's intent (`intent`): the tool
// checked against the run's header hands and acts, a ticket per intent, `idem` deciding whether a late one is re-sent, the
// hand's reply as a positional result (`result`), prose and salvaged calls recorded as `said`, the run's wait on its brain
// between hops (`awaitBrain`), and the run's end by the foreman's done-check (`finishRun`; a run filed `once` ends with its one
// receipt, finale §3.19). Refuses: a tool the header does
// not name, a shell on a desk run (`sh` is the hands' allow-listed command read, a hand: finale §3.11), an act from a watch-tier
// run, an intent on a run that is not running, an act re-sent.
// Implements: LACUNA-3.0-DESIGN §6 change 1 (the brain emits, the foreman records), §6 change 2 (positional results),
// §7.2, §12.3 (the desk default: reads only, no shell). Invariants (§18): "every intent is a ticket", "a result is
// addressed by position, never pasted back". Faults (§16): F-02 (a tool outside the header, exit 12), F-02 also for a shell on a desk run,
// F-21 (an act asked twice), F-12 via contract.mjs; F-02 also for a call provenance refuses (SENTRY-2.0 §4: no order link, a
// result with no open ticket, a ticket of a past generation).
import path from 'node:path'
import { attach, beforeIntent, afterResult, finishCheck } from './work-sentry.mjs'
import { DESK_VERBS, isDeskVerb, nextDeskSeq, runDeskVerb } from './desk-verbs.mjs'
import { openTicket, freshTicket, beat } from './alive.mjs'
import { HAND_READS } from './capabilities.mjs'
import { openContract, contractStep, contractPromise, contractResult, contractExit, contractResolve, EXIT, STEPS_KEPT, KICKS_KEPT } from './contract.mjs'
import { atBoundary, inShadow, attachSentry } from './sentry.mjs'
import { fence } from './sentry/fence.mjs'
import { checkCall as provenanceCheck } from './sentry/provenance.mjs'
import { receiptAst } from './sentry/ast.mjs'
import { openLatch, advanceLatch, answerLatch, playbookOf } from './latch.mjs'
import { drift } from './sentry/semantics.mjs'
import { claim as claimEv } from './phase.mjs'
import { think } from './talk.mjs'
import { afterJob, closeJob, holdWhy, loopOn, noteCall, noteReceipt } from './job-loop.mjs'
import { parse, evaluate, baseEnv, toScheme, toJson } from './scheme.mjs'
import { sidecarOn, vmRunActorSteps } from './vm-sidecar.mjs'
import { noteWorkRow } from './runs.mjs'
import { endCheck, keepTaskExpect } from './sentry/expectation.mjs'

/** Hop deadlines by intensity (seconds the foreman waits for the brain's next intent). */
export const HOP = Object.freeze({ low: 900, normal: 300, high: 120 })
/** The hop cap per run (design §21 ReAct row): 5 by default, at most 7 from the header. */
export const HOPS = Object.freeze({ default: 5, max: 7 })
// `sh` is not here: it is the hands' allow-listed command read (lacuna-executor/reads/sh.mjs; finale §3.11), argv only, J0, never a shell
export const SHELL = new Set(['shell', 'bash', 'exec', 'run', 'python', 'node'])
/** A desk run's default reads (design §12.3 "the read table"): the ones a desk turn uses, not all 85 — measured 2026-10-23: the
 *  whole table as native tools put 32,256 tokens in front of one question (16.8 s warm); this set is the brain's working desk. */
export const DESK_READS = Object.freeze(['overview', 'health', 'disk', 'services', 'service', 'service-log', 'watchdogs', 'alerts', 'errors', 'jobs', 'job',
  'carts', 'cart-run', 'builds', 'release', 'minds', 'brain', 'usage', 'work', 'git-status', 'git-log', 'tail-log', 'files', 'recall', 'contract', 'design',
  'triggers', 'bundles', 'forge-runs', 'devices', 'web-search', 'read-page', 'read', 'find', 'grep', 'disk-usage', 'ask-cloud', 'code-where',
  'sh', 'scheme', 'look-up', 'git', 'test'])   // + the desk's web and files (L8): the Python desk read them by shell; + sh, one allow-listed command (finale §3.11 unit 2); + scheme and look-up, the room's own runner (unit 4); + git, a mind's moves in its own clone (§3.19)
/** Positional results kept on a run (the window masks older ones; the contract keeps the last). */
export const RESULTS_KEPT = 32
/** A run worker's program: it holds no verbs of its own; every event lands here and the foreman records it. */
const RUN_PROGRAM = `(on 'hand (lambda (r) #t)) (on 'act (lambda (r) #t)) (on 'kick (lambda (r) #t))`
// no 'hand-timeout / 'act-timeout handler on purpose: a second miss stops the run and contract.mjs writes exit 15.

/** Where the desk verbs write their records (the foreman's world folder); a host may name another (tests). */
const DESK_DIR = process.env.FOREMAN_DESK_DIR || `${process.env.HOME}/lacuna-world/foreman/desk`

const names = (xs) => new Set((Array.isArray(xs) ? xs : []).map((x) => String(x && x.name ? x.name : x)))

/**
 * File a run: one worker, one contract, a header of hands and acts it may ask for.
 * @param {import('./supervisor.mjs').Supervisor} sup
 * @param {{key: string, goal: string, doneCheck?: string, by?: string, hands?: string[], acts?: string[], tier?: 'watch'|'act',
 *          brain?: string, intensity?: 'low'|'normal'|'high', desk?: boolean, name?: string}} o
 * @returns {object} the worker that is the run
 */
export function fileRun(sup, o) {
  if (!o || !o.key || !o.goal) throw new Error('a run is filed with a key and a goal')
  const tier = o.tier === 'act' ? 'act' : 'watch'
  const w = sup.spawn({ name: o.name || `run:${o.key}`.slice(0, 60), program: RUN_PROGRAM, tier, by: o.by || 'brain', verbs: [], restart: 'temporary', parent: o.parent || null })
  w.run = { key: String(o.key), desk: o.desk !== false && !o.hands?.length && !o.acts?.length ? true : !!o.desk,
            hands: names(o.hands?.length ? o.hands : o.allReads ? [...HAND_READS] : [...DESK_READS.filter((h) => HAND_READS.has(h)), ...DESK_VERBS.map((v) => v.name)]), acts: tier === 'act' ? names(o.acts) : new Set(),
            intensity: HOP[o.intensity] ? o.intensity : 'normal', results: [], hops: 0, saids: 0, claimed: null, cart: o.cart ?? null,
            cap: Math.min(HOPS.max, Math.max(1, Number(o.hops) || HOPS.default)),
            touches: Array.isArray(o.touches) ? o.touches.map(String).slice(0, 24) : [], repo: o.repo ? String(o.repo) : null,
            press: o.press === 'standing' ? 'standing' : null, role: o.role ? String(o.role).slice(0, 20) : null,
            class: o.class && typeof o.class === 'object' ? o.class : null,   // T7: standing press; R1.3: the run's class for the grid ledger
            once: o.once === true }   // a run filed to carry one call (the Agents Room's hand or act, finale §3.11, §3.19) ends with its receipt
  if (Number(o.jobs) > 0) w.run.jobCap = Math.min(24, Number(o.jobs))   // P4: the run's job budget (job-loop.mjs); the loop's default else
  // the goal names the run's real places: <run> is the id, <dir> its checkout (2026-10-24: the brain built the path from the checkout
  // ticket's id and asked for runs/<id>-checkout/… five times)
  const dir = o.repo ? `runs/${w.id}/${String(o.repo)}` : `runs/${w.id}`
  const goal = String(o.goal).replace(/<run>/g, w.id).replace(/<dir>/g, dir)
  openContract(w, { key: o.key, goal, doneCheck: String(o.doneCheck ?? '').replace(/<run>/g, w.id).replace(/<dir>/g, dir) || o.doneCheck, cart: o.cart ?? null, brain: o.brain, attempt: o.attempt })
  noteWorkRow(sup, w, 'open')   // the run's work row (finale order §10 row 5): it runs from its filing
  if (o.expect) w.contract.expect = String(o.expect).replace(/\s+/g, ' ').trim().slice(0, 300)   // P7: the order's expectation (§7.1)
  const playbook = o.playbook ? String(o.playbook).toUpperCase() : playbookOf(goal)   // SENTRY-2.0 §2 (K1.3): a run under a playbook carries its ladder's latch
  if (playbook) openLatch(sup, w, playbook)
  if (!o.hops && w.latchLadder?.steps?.length > w.run.cap) w.run.cap = Math.min(HOPS.max, w.latchLadder.steps.length)
  // W1.4: the ladder's done-check is the run's when the filer gave words or none (a filer's form always wins)
  if (w.latchLadder?.doneCheck && !/^\(/.test(String(w.contract.done_check || '').trim())) {
    w.contract.done_check = w.latchLadder.doneCheck
    sup.host.contract?.(w, null)
  }
  const domain = attach(w, goal, sup)   // the work device of its work type (O25, SENTRY-2.0 §1); a desk turn gets the said's device
  if (!domain) attachSentry(sup, w, { device: 'desk', domain: null, seat: 'sentry' })
  awaitBrain(sup, w)
  think(w, 'state', `run filed: ${String(o.goal).slice(0, 120)} (hands ${w.run.hands.size}, acts ${w.run.acts.size}, ${w.run.intensity}${domain ? `, work sentry ${domain}` : ''})`, sup.host.now())
  sup._checkpoint(w)                               // a foreman restart brings the run back with its contract (P7 finding 4)
  if (w.run.repo) {                                // §8 lifecycle: "checkout cloned, jail tier set" at the filing — a standing press (K-6)
    const ticket = freshTicket(w, `${w.id}-checkout`)
    openTicket(sup, w, 'act', 'checkout', [w.run.repo], ticket); w.pending.at(-1).once = true; w.pending.at(-1).pressed = { by: 'standing', at: sup.host.now() }; w.pending.at(-1).sentPressed = true
    sup.host.upstream('act', w, { ticket, op: 'checkout', args: [w.run.repo], run: w.run.key, pressed: true, touches: w.run.touches })
  }
  if (o.drive !== false && (o.by && o.by !== 'brain') && !w.run.desk) sup.host.drive?.(w)   // a cart filed it: the brain loop drives it (P7 finding 1)
  return w
}

/** The run now waits on its brain's next intent, until the hop deadline for its intensity. */
export function awaitBrain(sup, w) {
  const now = sup.host.now()
  w.awaiting = { who: 'brain', since: now, due: now + (sup.host.deadlines?.hop ?? HOP[w.run?.intensity || 'normal']) }
}

const refuse = (w, fault, why) => {                                 // exit 12: refused by form (§17); the record shows the fault (§16, row 25)
  if (fault && w.contract) {
    const c = w.contract
    c.step += 1; c.steps.push({ n: c.step, status: 'skipped', text: `${fault}: ${String(why).slice(0, 200)}`, ticket: null, at: 0 })
    if (c.steps.length > STEPS_KEPT) c.steps.splice(0, c.steps.length - STEPS_KEPT)   // the ring holds for refusals too (2026-10-24, U2)
  }
  return { ok: false, fault, exit: fault ? 12 : null, why: `${w.name}: ${why}` }
}

/** One kick row on the run's record, the ring kept at KICKS_KEPT (a looping brain grew it without end before 2026-10-24, U2). */
const kickRow = (w, row) => {
  const k = w.contract.kicks
  k.push(row)
  if (k.length > KICKS_KEPT) k.splice(0, k.length - KICKS_KEPT)
}

/**
 * One intent from the brain: `{tool, args, promise?, deadline_s?, idem?}`. → `{ok, ticket, n, kind}` or a refusal with its fault id.
 * `n` is the positional index the result will carry (design §6 change 2). `idem: false` means never re-send.
 */
export function intent(sup, runId, o = {}) {
  const w = sup.workers.get(runId)
  if (!w || !w.run) return { ok: false, fault: null, why: 'no such run' }
  if (w.state !== 'running') return refuse(w, null, `the run is ${w.state}`)
  const tool = String(o.tool || '').trim()
  const args = Array.isArray(o.args) ? o.args.map((a) => (typeof a === 'string' ? a.slice(0, 2000) : a)) : o.args && typeof o.args === 'object' ? o.args : []   // the form's args as written: a list, or the object the hand names (§7.1)
  if (!tool) return refuse(w, 'F-02', 'an intent names a tool')
  const held = holdWhy(w)                           // P4 (F25): a hold takes no task until the owner clears it
  if (held) return refuse(w, 'F-02', held)
  if (w.run.hops >= w.run.cap) {                   // past the cap the foreman takes no intent: a kick, and the brain says what it has (§21 ReAct)
    w.run.capHits = (w.run.capHits || 0) + 1
    kickRow(w, { verdict: 'kick', category: 'no-ticket', evidence: { promise: null, cap: w.run.cap, hops: w.run.hops, now: sup.host.now() }, by: 'intents.mjs' })
    if (w.run.capHits >= 2) { holdForOwner(sup, w.id, `the hop cap ${w.run.cap} was hit twice`); return { ...refuse(w, 'F-03', `hop cap ${w.run.cap} hit twice: the owner decides`), waiting: true } }
    if (w.handlers.has('kick')) sup.send(w.id, 'kick', { promise: null, text: `hop cap ${w.run.cap} reached`, missed: 0 })
    return { ...refuse(w, 'F-03', `hop cap ${w.run.cap} reached: say what you have, or finish`), kick: true }
  }
  if (SHELL.has(tool) && (w.run.desk || !w.run.acts.has(tool))) return refuse(w, 'F-02', `${tool} is a shell; a desk run reads only (§12.3)`)
  const kind = w.run.acts.has(tool) ? 'act' : w.run.hands.has(tool) ? 'hand' : null   // the header's acts name the effects; a name in both is an act
  if (!kind) return refuse(w, 'F-02', `${tool} is not in the run's header (hands ${[...w.run.hands].slice(0, 6).join(' ')}…)`)
  if (kind === 'act' && w.tier !== 'act') return refuse(w, 'F-02', `a watch run may not act (${tool})`)
  if (kind === 'act' && w.contract?.mode === 'break') return refuse(w, 'F-02', `the run is on break: ${tool} waits until the owner switches it back to work`)   // W1.6
  const prov = provenanceCheck(sup, w, { phase: 'intent', op: tool })   // SENTRY-2.0 §4: a work run with no order behind it is red
  if (!prov.ok) return refuse(w, 'F-02', prov.why)
  fence(sup, w, tool)                                                    // SENTRY-2.0 §2: a call outside the step's allows leaves a row; warn-only in 1.0
  // an act waiting on its press is still pending (F-08: never re-ask; 2026-10-24, U2: a `press` ticket was missed and the act went twice)
  if (kind === 'act' && (w.pending || []).some((t) => (t.kind === 'act' || t.kind === 'press') && t.op === tool && JSON.stringify(t.args) === JSON.stringify(args)))
    return refuse(w, 'F-21', `act ${tool} is already pending; an act is never re-sent`)
  // THE REPEAT RULE (ReAct's repetitive-loop failure; 2026-10-23: a run asked the same refused read five times): the same tool and
  // args after two refused answers is not taken; a kick says change the arguments or finish
  const sig = `${tool}\n${JSON.stringify(args)}`
  const last = w.run.results.at(-1)
  if (w.run.lastSig === sig && last && last.tool === tool && last.value?.exit === 12) w.run.sameRefused = (w.run.sameRefused || 0) + 1
  else w.run.sameRefused = 0
  // the same tool refused three times running, whatever the spelling of its arguments (a trailing slash, a glob), is the same loop
  const tail3 = w.run.results.slice(-3)
  const refusedThrice = tail3.length === 3 && tail3.every((r) => r.tool === tool && r.value?.exit === 12)
  w.run.lastSig = sig
  if (w.run.sameRefused >= 2 || refusedThrice) {
    kickRow(w, { verdict: 'kick', category: 'no-ticket', evidence: { tool, repeat: true, why: last.value?.why || '', now: sup.host.now() }, by: 'intents.mjs' })
    return { ...refuse(w, 'F-03', `${tool} was refused twice with these arguments (${String(last.value?.why || '').slice(0, 120)}): change them or finish`), kick: true }
  }
  const circ = loopOn(sup) ? noteCall(w, sig) : null   // P4 (F133, F24): the same call three times running ends the job; he decides
  if (circ) { closeJob(sup, w, 'fault', circ); holdForOwner(sup, w.id, circ); return { ...refuse(w, 'F-03', circ), waiting: true, circling: true } }
  const ws = beforeIntent(w, tool, args, { now: sup.host.now(), dir: path.dirname(sup.host.deskDir?.() || DESK_DIR), sup })   // the work device, before the act goes out (O25)
  if (!ws.ok) return refuse(w, 'F-02', ws.why)
  const ticket = freshTicket(w, `${w.id}-${kind}-${w.run.hops + 1}`)
  const dl = Number(o.deadline ?? o.deadline_s)                                    // the form says `deadline` (§7.1); `deadline_s` is read too
  const n = w.run.hops + 1                          // the position: the k-th intent of the run, never the contract's step number
  const t = openTicket(sup, w, kind, tool, args, ticket, { deadlineS: dl > 0 ? dl : undefined, n })
  // §6 change 2 (f): a late ticket is re-sent once ONLY when the intent carries (idem #t); an act never (law 4). The default is once:
  // the brain's reads cost brain time and the deadline already says when to stop (corrected 2026-10-23: the default re-sent)
  if (kind === 'act' || o.idem !== true) t.once = true
  w.run.hops += 1; w.run.saids = 0
  delete w.awaiting
  // an object argument is written as data, never `[object Object]` (lane M's macro mining found 1,000+ such rows, 2026-10-24)
  const argText = Array.isArray(args) ? args.map((a) => String(typeof a === 'string' ? a : (JSON.stringify(a) ?? a)).slice(0, 120)) : [JSON.stringify(args).slice(0, 120)]
  contractStep(sup, w, 'running', `${n}: ${kind} ${tool} ${argText.join(' ')}`.trim())
  t.n = n
  if (o.promise) t.promise = contractPromise(sup, w, o.promise, dl || (kind === 'act' ? sup.alive.act : sup.alive.hand), ticket)
  t.intent = o.id == null ? ticket : String(o.id)
  keepTaskExpect(w, ticket, o.expected)   // P7: the task's expectation, read when the run ends (sentry/expectation.mjs)
  beat(sup, w)
  if (isDeskVerb(tool) && w.run.desk) {            // the desk's own verbs: the foreman answers them, through the same result road (desk-verbs.mjs)
    const value = { ticket, op: tool, ...runDeskVerb(tool, args, { dir: sup.host.deskDir?.() || DESK_DIR, run: w.run.key, now: sup.host.now(), seq: nextDeskSeq }) }
    queueMicrotask(() => result(sup, w.id, 'hand', value))
    if (tool === 'seat' && value.exit === 0 && value.rows?.state === 'requested') sup.host.seat?.(value.rows)   // the foreman brings the mind (work-orders.mjs seatChange); an eval's request is only recorded
  } else sup.host.upstream(kind, w, { ticket, op: tool, args, n, run: w.run.key })
  sup._checkpoint(w)
  return { ok: true, ticket, n, kind, intent: t.intent, promise: t.promise ?? null }   // the accepted form (§7.2)
}

/** The reply to an intent (the hand or act answered): clears its ticket, lands as result `n`, the step is done by its ticket. */
export function result(sup, runId, kind, value) {
  const w = sup.workers.get(runId)
  if (!w || !w.run) return { ok: false, why: 'no such run' }
  const before = (w.pending || []).find((t) => value && (t.ticket === String(value.ticket) || (t.was || []).includes(String(value.ticket))))
  // E10: a second reply to a ticket already answered never lands twice, nor closes another ticket by its op (2026-10-24, U2)
  const answered = !before && value?.ticket != null && w.run.results.find((x) => x.ticket === String(value.ticket))
  if (answered) return { ok: false, duplicate: true, why: `ticket ${value.ticket} was already answered (result ${answered.n})` }
  // SENTRY-2.0 §4: the chain at the receipt — no open ticket, a ticket of a past generation, a write outside touches — each a red row
  const prov = provenanceCheck(sup, w, { phase: 'result', t: before || null, value })
  if (!prov.ok && prov.check !== 'outside-touches' && value?.rule !== 'touched-outside') return { ok: false, exit: 12, check: prov.check, why: prov.why }
  const r = sup.send(runId, kind, value)
  if (!r.ok) return r
  const t = before || null
  if ((value && value.rule === 'touched-outside') || !prov.ok) {                      // I-03: the jail is wrong; the run stops, exit 12, mail
    const why = value?.rule === 'touched-outside' ? String(value.why || '') : prov.why
    kickRow(w, { verdict: 'kick', category: 'no-ticket', evidence: { ticket: t?.ticket ?? null, touchedOutside: true, why, now: sup.host.now() }, by: 'intents.mjs' })
    sup.host.mail?.({ id: `m-touch-${w.id}`, kind: 'self-report', from: w.name, to: 'claude', at: sup.host.now(), severity: 'wrong', run: w.run.key, what: `a hand wrote outside the run's touches: ${why}`.slice(0, 400), evidence: { ticket: t?.ticket ?? null }, asks: 'the jail or the touches are wrong', untrusted: false, count: 1, text: '', file: `touched-outside-${w.id}.slat` })
    contractExit(sup, w, EXIT.REFUSED, 'fail', { checked: true, why: `a hand wrote outside the run's touches (I-03): ${why}` }); delete w.awaiting; sup.stop(runId, `refused: a hand wrote outside the run's touches (I-03)`)
    return { ok: false, exit: 12, why: 'wrote outside touches: the run stopped' }
  }
  const n = t?.n ?? w.run.hops
  const row = { n, ticket: t?.ticket ?? String(value?.ticket ?? ''), tool: t?.op ?? String(value?.op ?? ''), value, at: sup.host.now(), call: t?.call ?? null }
  if (t && w.pending.includes(t) && t.kind === 'press') {   // not a result yet: the act waits on the owner (F-08), no row, no deadline
    if (w.run.press === 'standing' && !t.pressed) {                   // the standing press (T7): pressed by the filing cart's word, said on the record
      contractStep(sup, w, 'running', `standing press on ${t.op} (${t.ticket})`)
      press(sup, t.ticket, `standing:${w.by || 'cart'}`)
      return { ok: true, n, ticket: row.ticket, waiting: false, pressed: 'standing' }
    }
    w.contract.state = 'waiting-owner'; delete w.awaiting; sup.host.contract?.(w, null); return { ok: true, n, ticket: row.ticket, waiting: true }
  }
  w.run.results.push(row)
  afterResult(w, row)
  if (loopOn(sup)) noteReceipt(w, `${row.tool}\n${JSON.stringify(t?.args ?? [])}`, !Number.isInteger(value?.exit) || value.exit === 0)
  if (w.run.results.length > RESULTS_KEPT) w.run.results.splice(0, w.run.results.length - RESULTS_KEPT)
  if (t && !w.pending.includes(t)) contractStep(sup, w, 'done', `${t.kind} ${t.op} → result ${n}`, t.ticket)
  if (t && t.kind === 'act') receiptAst(sup, w, t, value)                 // SENTRY-2.0 §3: the patch boundary's receipt, read into rows
  const touched = Array.isArray(value?.touched) ? value.touched : Array.isArray(value?.rows?.touched) ? value.rows.touched : []
  advanceLatch(sup, w, { op: row.tool, exit: Number.isInteger(value?.exit) ? value.exit : 0, touched })   // SENTRY-2.0 §2 (K1.3): only a receipt moves the latch
  if (t && t.kind === 'act') drift(sup, w, { touched, op: row.tool })                                     // SENTRY-2.0 §5 S0 (K1.7)
  if (t?.promise) contractResolve(sup, w, t.promise, 'kept', t.ticket)
  contractResult(sup, w, value)
  // ONE CALL, ONE RECEIPT, THE END (§3.19): a run filed to carry one call ends when its receipt lands, so an act the owner pressed
  // hours after the room's turn left does not stall at its hop deadline; a run with a ticket still open waits on it
  if (w.run.once && !(w.pending || []).length) {
    finishRun(sup, w.id, { pass: value?.exit == null || value.exit === 0, why: value?.exit ? `exit ${value.exit}: ${String(value.why || '').slice(0, 160)}` : '' })
    return { ok: true, n, ticket: row.ticket, waiting: false, ended: true }
  }
  awaitBrain(sup, w)
  return { ok: true, n, ticket: row.ticket, waiting: !!(t && w.pending.includes(t)) }
}

/** Result `n`'s value (the brain's tool message carries the last observation verbatim, older ones masked — its call, B2). */
export function resultText(w, n) {
  const r = (w.run?.results || []).find((x) => x.n === Number(n))
  return r ? { ok: true, n: r.n, tool: r.tool, ticket: r.ticket, at: r.at, value: r.value } : { ok: false, why: `no result ${n}` }
}

/** The owner pressed (or the desk confirms a press) for an act ticket held by any run: the press ticket is marked. */
export function press(sup, ticket, by = 'owner') {
  for (const w of sup.living()) for (const t of w.pending || []) if (t.ticket === String(ticket) && (t.kind === 'act' || t.kind === 'press')) {
    t.pressed = { by: String(by).slice(0, 40), at: sup.host.now() }
    if (t.kind === 'press') {                        // it waited: the same ticket goes to the hands again, now pressed (never a new ticket)
      t.kind = 'act'; t.deadline_at = sup.host.now() + (sup.alive.acts[t.op] ?? sup.alive.act); delete t.waiting; t.sentPressed = true
      if (w.contract && w.contract.state === 'waiting-owner') w.contract.state = 'running'
      sup.host.upstream('act', w, { ticket: t.ticket, op: t.op, args: t.args, n: t.n, run: w.run?.key, pressed: true, pressed_by: t.pressed.by })
    }
    return { ok: true, run: w.id, op: t.op }
  }
  return { ok: false, why: `no act ticket ${ticket}` }
}

/** The hands ask before an act runs: is this ticket pressed? (H's `press-check`.) */
export function pressCheck(sup, ticket) {
  for (const w of sup.living()) for (const t of w.pending || []) if (t.ticket === String(ticket) && (t.kind === 'act' || t.kind === 'press'))
    return { ok: true, pressed: !!t.pressed, by: t.pressed?.by ?? null, run: w.id, op: t.op, args: t.args, kind: t.kind }
  return { ok: false, pressed: false, why: `no act ticket ${ticket}` }
}

/** What the brain's window shows for results: positions and tools, never the raw text pasted back (§6 change 2). */
export function resultsOf(w) {
  return (w.run?.results || []).map((r) => ({ n: r.n, tool: r.tool, ticket: r.ticket, at: r.at }))
}

/** The brain spoke prose or a call the grammar could not salvage. Recorded, counted; never executed. A `(done …)` claim is kept
 *  as a claim for the done-check (law 6). */
export function said(sup, runId, text, { claimsDone = false, promise = null } = {}) {
  const w = sup.workers.get(runId)
  if (!w || !w.run) return { ok: false, why: 'no such run' }
  w.run.saids += 1
  if (claimsDone) w.run.claimed = String(text).slice(0, 240)
  // a desk-turn promise ("I will …" with no call) is a promise the kick rule watches (§9, row 16): kicked once, then exit 99
  const PROMISE = /\b(i will|i'll|let me|i am going to|i'm going to|going to|next i)\b/i
  const p = promise || (claimsDone || PROMISE.test(String(text)) ? String(text).slice(0, 240) : null)
  if (p) contractPromise(sup, w, p, sup.alive.hand, null)
  const circ = p && loopOn(sup) ? noteCall(w, `said\n${p.toLowerCase().replace(/\s+/g, ' ')}`) : null   // P4 (F24): an announced call, again
  if (circ) { closeJob(sup, w, 'fault', circ); holdForOwner(sup, w.id, circ) }
  think(w, 'talk', String(text).slice(0, 400), sup.host.now())
  answerLatch(sup, w, text)                                               // SENTRY-2.0 §2 (K1.3): a step done by (answer (names …)) closes on the words
  claimEv(sup, w, { claimsDone, chars: String(text).length })             // SENTRY-2.0 §7: run.claim (chars, never the words)
  beat(sup, w)
  if (w.awaiting) awaitBrain(sup, w)
  // SENTRY §3: every said at a boundary gets a verdict row; shadow by default, so nothing leaves the record until the exam passes.
  // The sentry never blocks the turn: the promise is kept on the worker; a late verdict leaves `unsure` rows (F-S1).
  w.sentryPending = atBoundary(sup, w, String(text), { shadow: inShadow(sup) }).catch((e) => think(w, 'state', `sentry failed: ${String(e.message || e).slice(0, 120)}`, sup.host.now()))
  return { ok: true, saids: w.run.saids, claimed: !!claimsDone, ...(circ ? { circling: circ, waiting: true } : {}) }
}

/** The foreman's done-check decided: the run ends with `pass` (checked here, the only place) or `fail`. */
export function finishRun(sup, runId, { pass, why = '', answer = null, yield: y = null }) {
  const w = sup.workers.get(runId)
  if (!w || !w.run) return { ok: false, why: 'no such run' }
  if (w.contract.exit != null) return { ok: false, why: `the run already ended (${w.contract.outcome})` }
  // LAW 6: the caller's word is a claim; `pass` is written only when the contract's done-check form held. A run with no form (a desk
  // turn) or a done-check in words was never checked: a clean end is exit 0 `stopped`, never `pass` (2026-10-23: 9 desk runs and the
  // repair runs' prose check had turned the brain's word into `pass` on the ledger)
  const check = doneCheck(w, answer, sup.host.now())
  // P4, the job loop (design §2.5; behind its flag): a job that ended answered or cut on a run with a check is followed by
  // job n + 1 while the check is not green and the budget, the stop and the press allow; the run waits or fails with why
  const ended = y ?? (pass ? 'answered' : null)
  if (loopOn(sup) && check.checked && (ended === 'answered' || ended === 'cut')) {
    const d = afterJob(sup, w, { check, yield: ended, shadow: inShadow(sup, w.sentry?.domain) })
    if (d.do === 'open') { awaitBrain(sup, w); return { ok: true, outcome: null, next: d.next } }
    if (d.do === 'wait') { holdForOwner(sup, w.id, d.why); return { ok: true, outcome: null, waiting: true, why: d.why } }
    if (d.do === 'fail') { contractExit(sup, w, d.exit, 'fail', { checked: true, why: d.why }); delete w.awaiting; sup.stop(runId, `done: ${d.why}`); return { ok: true, outcome: 'fail', why: d.why } }
  }
  const ws = finishCheck(w, answer, { now: sup.host.now(), dir: path.dirname(sup.host.deskDir?.() || DESK_DIR), sup })
  if (ws) why = `${why ? why + ' — ' : ''}work sentry: ${ws.detail}`
  endCheck(sup, w)   // P7: the order's expectation against the receipts, its side on a warn (design §7.2's last row)
  let outcome
  if (!check.checked) outcome = pass ? 'stopped' : 'fail'
  else { outcome = check.pass ? 'pass' : 'fail'; if (pass && !check.pass) why = `${why ? why + ' — ' : ''}done-check: ${check.why}` }
  // category 2 ruling 5: every run that did not pass says why (the done-check's word when nothing else does)
  contractExit(sup, w, EXIT.DONE, outcome, { checked: check.checked, why: outcome === 'pass' ? null : (why || check.why) })
  delete w.awaiting
  const said = outcome === 'pass' ? 'the done-check passed' : outcome === 'stopped' ? `the run ended (${check.why})` : check.checked ? 'the done-check failed' : `the run failed (${check.why})`
  if (sidecarOn() || w.run?.vmActor === true || process.env.LACUNA_VM === 'actors') {
    w.actorRun = vmRunActorSteps({
      id: w.id,
      session: w.run?.key || '',
      gen: w.gen || 1,
      steps: (w.contract?.steps || []).map((s) => ({ op: s.tool || s.name || 'step', exit: s.status === 'done' ? 0 : 12 })),
      latchClosed: Boolean(w.contract?.latch?.closed || outcome === 'pass'),
    })
  }
  sup.stop(runId, `done: ${said}${why ? ' — ' + why : ''}`)
  return w.actorRun ? { ok: true, outcome: w.contract.outcome, actorRun: w.actorRun } : { ok: true, outcome: w.contract.outcome }
}

// a form a cart header lays over several lines reads as one line in a why (the contract's, the log's)
const shown = (form) => form.replace(/\s+/g, ' ')

/**
 * The done-check (design §8, law 6): the contract's `done-check` is one slat form evaluated over the run's results — each tool's
 * last result bound by its name (`jobs`, `bundle`, `strict` …, as data: `(get jobs 'rows)` works), `results` (the list), `answer`
 * (the brain's words), `hops`, and the contract's `steps` and `last` (a cart's record, K1.12). Truthy → pass. No form, or a check in words → `checked: false` (nothing was checked; the run can end
 * `stopped`, never `pass`). A form that throws → fail, with the sentence.
 * A cart's form reads the executor's answers (finale 2026-11-06; alive.mjs keepReply): each op's last answer bound by
 * its name like a tool's (`(get bundle-verify 'result)`), `(args-of 'op)` what it was asked with, `(answered 'op)` the
 * tally ((ok . n) (failed . n) (dry . n)), `(reported 'kind)` the data of each report of that kind, oldest first,
 * `today` the local date ("2026-11-06"). Its step rows carry each task's `ticket` and task-receipt (`receipt`).
 * @param {object} w the worker.
 * @param {string|null} answer what the run said.
 * @param {number|null} now seconds by the host's clock (`today`); the wall clock when none is given.
 * @returns {{pass: boolean, checked: boolean, why: string}}
 */
export function doneCheck(w, answer = null, now = null) {
  const form = String(w.contract?.done_check || '').trim()
  if (!form || !/^\(/.test(form)) return { pass: false, checked: false, why: form ? 'the done-check is words, not a form: nothing was checked' : 'no done-check' }
  try {
    const fuel = { n: 200_000 }
    const env = baseEnv(fuel)
    const nm = (x) => (x && typeof x === 'object' && typeof x.name === 'string' ? x.name : String(x))
    env.define('get', (alist, key, dflt = false) => { const k = nm(key); if (Array.isArray(alist)) for (const x of alist) if (Array.isArray(x) && x.length >= 2 && nm(x[0]) === k) return x[1]; return dflt })
    env.define('take', (lst, n) => (Array.isArray(lst) ? lst.slice(0, Math.max(0, Number(n) || 0)) : []))
    const byTool = new Map()
    for (const r of w.run?.results || []) byTool.set(r.tool, r.value)
    for (const [op, r] of Object.entries(w.cart?.replies || {})) byTool.set(op, r.value)
    for (const [tool, v] of byTool) env.define(String(tool).replace(/[^\w-]/g, '-'), toScheme(v))
    env.define('results', toScheme((w.run?.results || []).map((r) => ({ n: r.n, tool: r.tool, value: r.value }))))
    env.define('answer', toScheme(answer == null ? null : String(answer)))
    env.define('hops', toScheme(w.run?.hops ?? 0))
    // K1.12: the worker's own record, so a cart (which has no run results) judges its steps and its last result: a cart's step rows
    // are its own (cart.mjs step: name, status, why), a run's are the contract's (n, status, text, ticket)
    // a row has `ticket` and `receipt` only when the record holds them: a missing key reads #f under `get`, a null true
    const stepRows = w.cart ? (w.cart.steps || []).map((x) => ({ name: x.name, status: x.status, text: x.why,
      ...(x.ticket ? { ticket: x.ticket } : {}), ...(x.receipt ? { receipt: x.receipt } : {}) })) :
      (w.contract?.steps || []).map((x) => ({ n: x.n, status: x.status, text: x.text, ticket: x.ticket ?? null }))
    env.define('steps', toScheme(stepRows))
    env.define('last', toScheme(w.contract?.last_result ?? null))
    // W1.4: the words the ten jobs' forms read the record by — the latch closed on its last step's receipt, a tool's receipt, its
    // exit code, the first row of its rows whose key holds a value (a row is an alist; #f when there is none)
    env.define('latch-closed?', () => Boolean(w.contract?.latch?.closed))
    env.define('has', (tool) => byTool.has(nm(tool)))
    env.define('exit-of', (tool) => { const v = byTool.get(nm(tool)); return v && typeof v === 'object' && Number.isInteger(v.exit) ? v.exit : false })
    env.define('row-where', (tool, key, want) => {
      const v = byTool.get(nm(tool))
      const rows = Array.isArray(v) ? v : Array.isArray(v?.rows) ? v.rows : Array.isArray(v?.services) ? v.services : []
      const k = nm(key), r = rows.find((x) => x && typeof x === 'object' && String(x[k]) === String(want))
      return r ? toScheme(r) : false
    })
    const tally = w.cart?.tally || {}
    env.define('answered', (op) => toScheme(tally[nm(op)] || { ok: 0, failed: 0, dry: 0 }))
    env.define('args-of', (op) => toScheme(w.cart?.replies?.[nm(op)]?.args || []))
    env.define('reported', (kind) => toScheme((w.reports || []).filter((r) => r.kind === nm(kind)).map((r) => r.data)))
    const d = new Date((now ?? Date.now() / 1000) * 1000), two = (n) => String(n).padStart(2, '0')
    env.define('today', `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`)
    const forms = parse(form)
    let v = false
    for (const f of forms) v = evaluate(f, env, fuel)
    const ok = v !== false && v !== null && v !== undefined
    const said = shown(form)
    return { pass: ok, checked: true, why: ok ? `${said} held` : `${said} answered ${JSON.stringify(toJson(v))}` }
  } catch (e) {
    const why = String(e.message || e).slice(0, 160)
    return { pass: false, checked: true, why: `${shown(form)} could not be judged: ${why}` }
  }
}

/** A run's two modes (W1.6; ROAD Category 2 ruling 7): `work` acts; `break` reads and talks, and every act waits at this door. */
export const MODES = Object.freeze(['work', 'break'])

/**
 * Set a run's mode: the owner's WORK | BREAK switch on the card, through the door (the chat's words choose the turn's mode in the
 * brain when no switch was pressed). Recorded on the contract, in the run's thoughts and as a floor event.
 * @param {object} sup @param {string} runId @param {string} mode `work` or `break` @param {{by?: string}} [o] who switched it
 * @return {{ok: boolean, mode?: string, changed?: boolean, why?: string}}
 */
export function setRunMode(sup, runId, mode, { by = 'owner' } = {}) {
  const w = sup.workers.get(runId)
  if (!w || !w.run || !w.contract) return { ok: false, why: 'no such run' }
  if (!MODES.includes(mode)) return { ok: false, why: `a run's mode is ${MODES.join(' or ')}` }
  const was = w.contract.mode || 'work'
  if (was === mode) return { ok: true, mode, changed: false }
  w.contract.mode = mode
  think(w, 'state', `mode ${was} → ${mode} by ${String(by).slice(0, 40)}`, sup.host.now())
  sup.host.contract?.(w, null)
  sup.host.upstream?.('mode', w, { run: w.id, mode, was, by: String(by).slice(0, 40) })
  return { ok: true, mode, changed: true }
}

/** The owner holds the run (a press is owed): `waiting-owner`, no deadline on a person. */
export function holdForOwner(sup, runId, why) {
  const w = sup.workers.get(runId)
  if (!w || !w.run) return { ok: false, why: 'no such run' }
  w.contract.state = 'waiting-owner'
  delete w.awaiting
  for (const t of w.pending || []) if (t.kind === 'act') { t.kind = 'press'; t.deadline_at = null; t.waiting = String(why || 'the owner') }
  sup.host.contract?.(w, null)
  return { ok: true }
}
