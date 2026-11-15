// lifecycle.mjs — A WORKER'S END AND ITS RESTART (design §6 change 5: restart types and intensity; OTP's supervisor). Owns: the
// ways a worker leaves `running`: a stop (retired, or stalled under the zombie law), a crash that restarts its family
// (one_for_one, rest_for_one, one_for_all) under the poisoned-checkpoint rule, the grave (a program that cannot load, or the
// intensity's crashes in its window), and a cart's retirement record; each closes the worker's contract and its (run …) row
// once. Split from supervisor.mjs (finale order §3.16 unit 4: the lifecycle module O32 named), whose `stop` and `_run` call it.
// Refuses: restarting a run or a hand (`temporary`: exit 30, never restarted); asking a poisoned step's tickets again (an issued
// act, or one waiting on its press, is followed, never reissued: law 4); stopping a worker already retired or buried (false).
// Implements: design §6 change 5, §17. Invariants (§18): "If a run foreman died, then its children are buried"; the supervisor
// only supervises. Faults (§16): F-04 (the intensity's crashes in its window: the grave).
import { contractClose } from './contract.mjs'
import { jobEnded } from './broker.mjs'
import { endCheck } from './cart-sentry.mjs'
import { closeRun } from './runs.mjs'
import { think } from './talk.mjs'
import { step, record as cartRecord } from './cart.mjs'
import { rearm } from './alive.mjs'

// the step a crash happened at: the contract's, a cart's steps, or the reports so far
const stepOf = (w) => (w.contract ? w.contract.step : w.cart ? w.cart.steps.length : (w.reports || []).length)

/**
 * Stops a worker and its children: its timers cleared, its tombstone set, its contract closed with one of the six codes, its one
 * (run …) row written, a pausable job's end told to the broker, its cart retired. `state`: 'retired', or 'stalled' under the
 * zombie law; `stall`: one of §45.3's rules stopped it (the card says why).
 * @param {!Object} sup the supervisor
 * @param {string} id the worker
 * @param {string=} why
 * @param {{state: (string|undefined), stall: (boolean|undefined)}=} opts
 * @return {boolean} false when there is no such worker, or it is already retired or buried
 */
export function stopWorker(sup, id, why = 'stopped', { state = 'retired', stall = false } = {}) {
  const w = sup.workers.get(id)
  // a STALLED worker stops too (2026-10-20: the owner pressed stop on ci-guard four times and it stayed, "the worker is stalled"): it
  // already does nothing, so stopping it retires it; only a worker already retired or buried has nothing to stop
  if (!w || w.state === 'retired' || w.state === 'grave') return false
  for (const c of w.children) sup.stop(c, `its parent ${w.name} ${why}`)
  sup._clear(w)
  w.state = state
  w.last = why
  sup.tombstones.set(w.id, { id: w.id, gen: w.gen || 1, name: w.name, died_at: sup.host.now(), why })
  if (stall) w.stallReason = why
  contractClose(sup, w, why)                 // a run's contract ends with one of the six codes (contract.mjs, K2)
  closeRun(sup, w)                           // and leaves its one (run …) row in the ledger (runs.mjs, K5)
  if (w.pausable) jobEnded(sup, w, why)      // the 26B comes back; a passed job's exam waits on the press (broker.mjs)
  sup.host.save(w)
  sup._checkpoint(w)
  sup.host.upstream('retired', w, { why })
  retireCart(sup, w, why)
  return true
}

// a cart that ends (done, stopped, or buried) sends its run's record up once: Lacuna writes the artifact
function retireCart(sup, w, why) {
  if (!w.cart || w.cart.retired) return
  w.cart.retired = true
  const m = w.mind
  if (m.asked) step(w, 'minds', 'done', `asked ${m.asked}, labels ${m.labels || 0}, dropped ${m.dropped || 0}, failed ${m.failed || 0}`, sup.host.now())
  if (!w.cart.outcome) step(w, 'stop', 'stopped', why, sup.host.now())
  sup.host.save(w)
  endCheck(sup, w, why)   // the cart sentry's end check (O11): an unstated end is a verdict before the record
  sup.host.upstream('cart-retired', w, { record: cartRecord(w, sup.host.now(), why) })
}

/**
 * A worker's handler threw: a `temporary` worker (a run, a hand) ends with exit 30; a program that cannot load, or the
 * intensity's crashes in its window, goes to the grave (F-04); otherwise its family restarts, from its checkpoint, or from kv only
 * when the same step crashed twice (the poisoned-checkpoint rule).
 * @param {!Object} sup the supervisor
 * @param {!Object} w the worker
 * @param {string} why
 * @param {boolean} loading the crash came while its program loaded
 * @return {{ok: boolean, why: string, stopped: (boolean|undefined), grave: (boolean|undefined), restarted: (boolean|undefined),
 *     poisoned: (boolean|undefined)}}
 */
export function crash(sup, w, why, loading) {
  const now = sup.host.now()
  const lim = w.intensity
  w.crashes = w.crashes.filter((t) => now - t < lim.window).concat(now)
  w.last = why
  if (!loading && w.restart === 'temporary') {
    // a run or a hand is never restarted (§6 change 5): it ends here with exit 30 (contract.mjs reads "crashed")
    sup.host.upstream('crashed', w, { why, crashes: w.crashes.length, restart: 'temporary' })
    sup.stop(w.id, `crashed: ${why}`)
    return { ok: false, why, stopped: true }
  }
  if (loading || w.crashes.length >= lim.crashes) {
    // a program that cannot load, or the third crash in the window: the grave (OTP's restart intensity)
    sup._clear(w)
    w.state = 'grave'
    sup.tombstones.set(w.id, { id: w.id, gen: w.gen || 1, name: w.name, died_at: now, why })
    for (const c of w.children) sup.stop(c, `its parent ${w.name} was buried`)
    contractClose(sup, w, `buried (F-04): ${why}`)   // exit 30 and the (run …) row, as a stop leaves them (U1 2026-10-24: the grave left both open)
    closeRun(sup, w)
    if (w.pausable) jobEnded(sup, w, `buried (F-04): ${why}`)
    sup.host.save(w)
    sup.host.upstream('child-graved', w, { why, crashes: w.crashes.length, fault: 'F-04' })
    retireCart(sup, w, `buried (F-04): ${why}`)
    if (w.parent) sup.hop(w.id, w.parent, 'child-graved', { id: w.id, name: w.name, why })
    return { ok: false, why, grave: true }
  }
  // THE POISONED-CHECKPOINT RULE (§6 change 5): the first crash at a step comes back from its checkpoint (kv and tickets, adopted);
  // a second crash at the SAME step comes back from kv only — the step's tickets are dropped, since asking them again is what crashed
  const at = stepOf(w)
  const poisoned = w.crashStep === at && w.crashes.length >= 2
  w.crashStep = at
  if (poisoned) {
    w.poisonedStep = at
    // an issued act (or one waiting on its press) is followed, never reissued (law 4; U1 2026-10-24: dropping it made the reload ask again)
    const acts = (w.pending || []).filter((t) => t.kind === 'act' || t.kind === 'press')
    const dropped = (w.pending || []).length - acts.length
    w.pending = acts
    think(w, 'state', `the checkpoint at step ${at} may be poisoned: restarting from kv only, ${dropped} ticket(s) dropped, ${acts.length} act(s) followed`, now)
  }
  sup.host.upstream('crashed', w, { why, crashes: w.crashes.length, restart: w.restart, step: at, poisoned })
  restartFamily(sup, w, poisoned)
  return { ok: false, why, restarted: true, poisoned }
}

// one_for_one: just this one; rest_for_one: it and its younger siblings; one_for_all: the whole family
function restartFamily(sup, w, poisoned = false) {
  const p = w.parent ? sup.workers.get(w.parent) : null
  let family = [w]
  if (p && w.policy !== 'one_for_one') {
    const sibs = p.children.map((c) => sup.workers.get(c)).filter((x) => x && x.state === 'running')
    // start order, never the clock: `started` is whole seconds, so siblings born in one second would tie (burn-in B02)
    const born = (x) => p.children.indexOf(x.id)
    family = w.policy === 'one_for_all' ? sibs : sibs.filter((x) => born(x) >= born(w))
    if (!family.includes(w)) family.push(w)
  }
  for (const x of family) {
    x.gen = (x.gen || 1) + 1                      // a restart is a new generation: a message for the old one is a ghost's (send)
    // from the checkpoint: the step's timers and subscriptions come back once (rearm); a poisoned step from kv only (U1 2026-10-24)
    const ck = { timers: x.timers.map((t) => ({ ...t.spec, ref: t.fnRef })), subs: x.subs.map((m) => ({ ...m })) }
    x.state = 'starting'
    sup._boot(x)
    if (x.state === 'running' && !(poisoned && x === w)) rearm(sup, x, ck)
    sup.host.save(x)
  }
}
