// job-loop.mjs — THE JOB LOOP (WORK-CHIPS-CHAT design 2026-11-06 §2.4 the eight yields, §2.5 how continuing is
// decided, §8 P4). Owns: the read after every job of a run with a check (a done-check form): the check green → the
// foreman passes it (law 6); a stop or a hold standing, a press waiting, the mind's pushback with its domain live, or
// the same call three times running → the run waits for the owner; out of jobs or seconds → it fails (exit 15) with
// what the check still says; two jobs with no new receipt → it stops (exit 99); else job n + 1 opens and its first
// form carries the check's words (`(job (n 2) (of-run …) (why …) (budget …))`). The job rows and the budget live on
// the contract (`(jobs …)`), written at every job's end so a restart, the floor and the loop read one number; a hold
// (`(stop (mode hold) …)`) takes no task until it is cleared. Refuses: continuing a run whose check holds (no job
// after green); continuing a run with no check (a chat or a desk turn never continues); a pushback that parks in
// shadow (a `would-park` row only); a mind's word as the verdict (models warn, code kicks). Implements: design §2.5's
// table (`decide`, 16 cases and the pushback, circling, hold and idle rows), §2.4's yields, §8 P4; behind
// LACUNA_JOB_LOOP=1 (or the host's `jobLoop`) until the measure says. Invariants (§18): "if a run is pass, the
// foreman's done-check said so"; "the budget on the record is the loop's". Faults (§16): F-03 (a promise with no
// call, circling), F-06 (stalled: two jobs with no new receipt).
import { EXIT } from './contract.mjs'
import { think } from './talk.mjs'
import { sentryOf } from './sentry/verdicts.mjs'

/** The eight ways a job ends (§2.4). */
export const YIELDS = Object.freeze(['answered', 'cut', 'question', 'press', 'stop', 'redirect', 'budget', 'fault'])
/** A run's default budget: 6 jobs is the design's proposal, unverified until the measure (§9 item 4); seconds the run's. */
export const JOB_BUDGET = Object.freeze({ jobs: Number(process.env.LACUNA_JOB_BUDGET) || 6, seconds: 1800 })
/** The same call this many times running ends the job (`fault circling`, F133's five identical edits, F24's twenty). */
export const CIRCLE = 3
/** Job rows kept on a contract. */
const ROWS_KEPT = 32

/** Whether the loop runs: the host's word when it gives one, else LACUNA_JOB_LOOP=1. */
export const loopOn = (sup) => (typeof sup.host?.jobLoop === 'boolean' ? sup.host.jobLoop : process.env.LACUNA_JOB_LOOP === '1')

/**
 * The continue rule (§2.5), in its order, as one pure function: the 16 cases of (green, stop, press, budget left) and the
 * pushback, circling, idle and chat rows are its tests.
 * @param {{checked: boolean, green: boolean, stop?: ?{mode: string, said?: string}, press?: boolean, budgetLeft: boolean,
 *   pushback?: ?string, live?: boolean, circling?: ?string, idle?: boolean, checkWhy?: string, jobs?: number}} r
 * @returns {{do: 'end'|'pass'|'wait'|'fail'|'open', why: string, exit?: number, yield?: string, wouldPark?: boolean}}
 */
export function decide(r) {
  if (!r.checked) return { do: 'end', why: 'no check: a chat or desk turn never continues' }
  if (r.green) return { do: 'pass', why: 'the check is green' }
  if (r.stop) return { do: 'wait', why: `${r.stop.mode === 'hold' ? 'held' : 'stopped'} by the owner${r.stop.said ? `: "${String(r.stop.said).slice(0, 80)}"` : ''}` }
  if (r.press) return { do: 'wait', why: 'a press waits on the owner' }
  if (!r.budgetLeft) return { do: 'fail', exit: EXIT.DEADLINE, yield: 'budget', why: `budget: ${r.jobs ?? '?'} jobs, the check still says ${r.checkWhy || 'not green'}` }
  if (r.pushback && r.live) return { do: 'wait', why: `the mind pushed back: ${String(r.pushback).slice(0, 160)}` }
  const would = Boolean(r.pushback)
  if (r.circling) return { do: 'wait', yield: 'fault', why: r.circling, wouldPark: would }
  if (r.idle) return { do: 'fail', exit: EXIT.STALLED, why: 'two jobs with no new receipt', wouldPark: would }
  return { do: 'open', why: `the check is not green: ${r.checkWhy || 'not green'}`, wouldPark: would }
}

/** The run's job record on its contract, made at first need: the rows, the budget and the stop. */
export function jobsOf(w) {
  const c = w.contract
  return (c.jobs ||= { budget: { jobs: [0, w.run?.jobCap ?? JOB_BUDGET.jobs], seconds: [0, JOB_BUDGET.seconds] }, rows: [], stop: null })
}

/** The open job's working state (not on the record): its start, its receipts, the last call and how often it came running. */
const cur = (w, now = 0) => (w.run.job ||= { n: 1, start: w.started ?? now, receipts: 0, sig: null, same: 0 })

/** A hold standing on the run: the sentence a task is refused with, or null. */
export function holdWhy(w) {
  const s = w.contract?.jobs?.stop
  return s && s.mode === 'hold' ? `held: the owner said "${String(s.said || '').slice(0, 80)}" — answer, change nothing, until he clears it` : null
}

/** One call (or one announced call) in the open job; the third the same running ends the job: the circling sentence. */
export function noteCall(w, sig) {
  if (!w.run) return null
  const j = cur(w)
  if (j.sig === sig) j.same += 1
  else { j.sig = sig; j.same = 1 }
  return j.same >= CIRCLE ? `circling: the same call ${j.same} times with no other receipt between (${String(sig).replace(/\s+/g, ' ').slice(0, 80)})` : null
}

/** A receipt landed in the open job: counted when it closed clean; a receipt for another call breaks a run of the same. */
export function noteReceipt(w, sig, ok) {
  if (!w.run) return
  const j = cur(w)
  if (ok) j.receipts += 1
  if (j.sig !== sig) { j.sig = null; j.same = 0 }
}

/**
 * The owner's stop or hold on a run, or null to clear it (his "continue", "go on" or next words that are not a hold).
 * A cleared stop puts a run that waited for it back to running.
 */
export function setStop(sup, w, stop) {
  if (!w?.run || !w.contract) return { ok: false, why: 'no such run' }
  const j = jobsOf(w)
  const now = sup.host.now()
  if (stop == null) {
    const was = j.stop
    j.stop = null
    if (was && w.contract.state === 'waiting-owner' && !(w.pending || []).some((t) => t.kind === 'press')) w.contract.state = 'running'
    think(w, 'state', `the owner cleared the ${was?.mode || 'stop'}`, now)
    sup.host.contract?.(w, null)
    return { ok: true, cleared: Boolean(was) }
  }
  const mode = stop.mode === 'hold' ? 'hold' : 'stop'
  j.stop = { mode, by: String(stop.by || 'owner').slice(0, 40), at: now, said: String(stop.said || '').slice(0, 160) }
  think(w, 'state', `${mode} by ${j.stop.by}: ${j.stop.said}`, now)
  sup.host.contract?.(w, null)
  return { ok: true, stop: j.stop }
}

/** The job's closing row (§2.4): its yield, its line ≤ 160 characters, its receipts; the budget written with it. */
export function closeJob(sup, w, yieldWhy, said) {
  const now = sup.host.now()
  const j = jobsOf(w), k = cur(w, now)
  const row = { n: k.n, yield: YIELDS.includes(yieldWhy) ? yieldWhy : 'fault', said: String(said || '').slice(0, 160), receipts: k.receipts, at: now }
  j.rows.push(row)
  if (j.rows.length > ROWS_KEPT) j.rows.splice(0, j.rows.length - ROWS_KEPT)
  j.budget.jobs[0] = k.n
  j.budget.seconds[0] = Math.max(0, Math.round(now - (w.started ?? k.start)))
  return row
}

/** The first form of job n + 1's user turn: what the mind receives instead of "continue" (§2.5). */
export function jobForm(w, n, why) {
  const b = jobsOf(w).budget
  const q = (s) => JSON.stringify(String(s).slice(0, 300))
  return `(job (n ${n}) (of-run ${q(w.id)}) (why ${q(why)}) (budget (jobs-left ${Math.max(0, b.jobs[1] - b.jobs[0])}) (s-left ${Math.max(0, b.seconds[1] - b.seconds[0])})))`
}

/**
 * After a job ended `answered` or `cut`: close its row, read the three records (the check, the stop, the budget) and the
 * sentry's pushback, and decide. `open` starts job n + 1 (the hops start again; the job form says why).
 * @param {object} sup @param {object} w the run @param {{check: {pass: boolean, checked: boolean, why: string}, yield?: string}} o
 * @returns {ReturnType<typeof decide> & {row: object, next?: {job: number, why: string, form: string, budget: object}}}
 */
export function afterJob(sup, w, { check, yield: y = 'answered', shadow = true }) {
  const now = sup.host.now()
  const j = jobsOf(w), k = cur(w, now)
  const said = check.pass ? 'the check: green' : `the check: ${String(check.why || 'not green').replace(/\s+/g, ' ').slice(0, 120)}`
  const row = closeJob(sup, w, y, `${y} · ${said}`)
  const idle = j.rows.length >= 2 && j.rows.slice(-2).every((r) => r.receipts === 0)
  const pb = (sentryOf(w).verdicts || []).filter((v) => v.check === 'pushback' && v.t >= k.start).at(-1)
  const press = (w.pending || []).some((t) => t.kind === 'press')
  const d = decide({ checked: check.checked, green: check.pass, stop: j.stop, press, jobs: j.budget.jobs[0],
    budgetLeft: j.budget.jobs[0] < j.budget.jobs[1] && j.budget.seconds[0] < j.budget.seconds[1],
    pushback: pb ? pb.detail || pb.why : null, live: !shadow, idle, checkWhy: String(check.why || '').replace(/\s+/g, ' ').slice(0, 200) })
  if (d.wouldPark) {
    sentryOf(w).would.push({ at: now, kind: 'park', text: String(pb.detail || pb.why).slice(0, 160) })
    think(w, 'state', `shadow: would park — the mind pushed back (${String(pb.detail || '').slice(0, 80)})`, now)
  }
  think(w, 'state', `job ${row.n} ended ${row.yield}: ${d.do} — ${d.why}`.slice(0, 300), now)
  if (d.do !== 'open') { sup.host.contract?.(w, null); return { ...d, row } }
  w.run.job = { n: k.n + 1, start: now, receipts: 0, sig: null, same: 0 }
  w.run.hops = 0; w.run.capHits = 0; w.run.saids = 0
  sup.host.contract?.(w, null)
  return { ...d, row, next: { job: k.n + 1, why: d.why, form: jobForm(w, k.n + 1, d.why), budget: { ...j.budget } } }
}
