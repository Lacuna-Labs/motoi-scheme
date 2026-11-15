// job-loop.test.mjs — THE JOB LOOP (WORK-CHIPS-CHAT design 2026-11-06 §2.4, §2.5, §8 P4). Owns: the continue rule's
// truth table (`decide`: the 16 cases of check green, stop, press and budget, then the hold, pushback live and
// shadow, circling, idle and chat rows) and the loop on real runs (`fileRun`, `intent`, `result`, `finishRun` with
// the host's `jobLoop`): a red check with budget opens job n + 1 with the check's words and stops at budget zero with
// `why "budget: …"`; a stop or a press holds it; a hold takes no task until cleared; the same call three times ends
// the job `fault circling`; two jobs with no new receipt stop it (exit 99); a green check passes by the foreman only;
// a desk run never continues; the loop off keeps today's end. Refuses: a mock of intents.mjs, the supervisor or the
// evaluator; the live door. Implements: §8 P4's node --test gate. Invariants (§18): "if a run is pass, the foreman's
// done-check said so"; "the budget on the record is the loop's". Faults (§16): F-03, F-06; F24, F25, F133 (the
// design's appendix F).
import test from 'node:test'
import assert from 'node:assert/strict'
import { makeSup } from '../../../test/conformance/fake-host.mjs'
import { fileRun, intent, result, said, finishRun } from '../intents.mjs'
import { decide, setStop, JOB_BUDGET } from '../job-loop.mjs'
import { readContract, renderContract } from '../contract.mjs'
import { sentryOf } from '../sentry/verdicts.mjs'

const RED = "(and (has 'test-run) (= (exit-of 'test-run) 0))"
function loop({ jobs, shadow = true, on = true, check = RED } = {}) {
  const { h, s } = makeSup()
  h.jobLoop = on
  h.sentryShadow = () => shadow
  const w = fileRun(s, { key: 'p4', goal: 'make the tests pass', doneCheck: check, hands: ['test-run', 'read'], jobs })
  return { h, s, w }
}
/** One job: the suite runs (its exit), and the mind answers. */
const job = (s, w, exit = 1, answer = 'I changed the loop; the tests should pass now.') => {
  const i = intent(s, w.id, { tool: 'test-run', args: ['suite'] })
  assert.equal(i.ok, true, i.why)
  assert.equal(result(s, w.id, 'hand', { ticket: i.ticket, op: 'test-run', exit, rows: { status: exit } }).ok, true)
  return finishRun(s, w.id, { pass: true, answer })
}

// spec: §2.5 the continue rule, in its order · §8 P4 "the 16-case truth table with a test"
// class: L5 the decision table
// technique: every combination of the four booleans
// method: green wins; then stop, then press, then the budget; else job n + 1
// sre: does any combination continue a run whose check is green, or one the owner stopped?
test('the 16 cases: green passes; else a stop or a press waits; else no budget fails (exit 15); else job n + 1 opens', () => {
  for (let k = 0; k < 16; k++) {
    const [green, stop, press, budgetLeft] = [8, 4, 2, 1].map((b) => Boolean(k & b))
    const d = decide({ checked: true, green, stop: stop ? { mode: 'stop', said: 'nah, leave it' } : null, press, budgetLeft, jobs: 6, checkWhy: 'tests exit 1' })
    const want = green ? 'pass' : stop || press ? 'wait' : !budgetLeft ? 'fail' : 'open'
    assert.equal(d.do, want, `green ${green} stop ${stop} press ${press} budget ${budgetLeft}`)
    if (want === 'fail') { assert.equal(d.exit, 15); assert.match(d.why, /^budget: 6 jobs, the check still says tests exit 1/) }
    if (want === 'open') assert.match(d.why, /^the check is not green: tests exit 1/)
  }
})

// spec: §2.5's rows after the four · law 15 (models warn, code kicks) · F25 · RL76
// class: L5 the decision table
// technique: one row each
// method: no check ends; a hold waits; pushback waits only live (shadow: would-park, open); circling waits with fault; idle fails 99
// sre: can the 1B's pushback park a run while its domain is in shadow?
test('the rows after the four: chat ends, hold waits, pushback parks only live, circling waits, two idle jobs stall', () => {
  const base = { checked: true, green: false, stop: null, press: false, budgetLeft: true }
  assert.equal(decide({ ...base, checked: false }).do, 'end')
  assert.deepEqual([decide({ ...base, stop: { mode: 'hold', said: "don't fix it yet" } }).do, decide({ ...base, stop: { mode: 'hold', said: "don't fix it yet" } }).why],
    ['wait', 'held by the owner: "don\'t fix it yet"'])
  assert.equal(decide({ ...base, pushback: 'I should not delete that', live: true }).do, 'wait')
  assert.deepEqual([decide({ ...base, pushback: 'I should not', live: false }).do, decide({ ...base, pushback: 'x', live: false }).wouldPark], ['open', true])
  assert.deepEqual([decide({ ...base, circling: 'circling: x' }).do, decide({ ...base, circling: 'circling: x' }).yield], ['wait', 'fault'])
  assert.deepEqual([decide({ ...base, idle: true }).do, decide({ ...base, idle: true }).exit], ['fail', 99])
  assert.equal(decide({ ...base, green: true, idle: true, circling: 'c' }).do, 'pass', 'no job after green')
})

// spec: §8 P4 gate "a run with a red check and budget continues once and stops at budget zero with why budget: jobs"
// class: E the run's outcome · L5 the record (the jobs field)
// technique: a real run on a fake host; the suite answers exit 1 twice
// method: job 1 ends answered → next (job 2, the check's words in its form, hops start again); job 2 at a budget of 2 → fail 15
// sre: does a run that never gets green stop on its budget, and say what the check still wants?
test('a red check with budget opens job 2 with the check\'s words, and at budget zero fails with why "budget: …"', () => {
  const { s, w } = loop({ jobs: 2 })
  const one = job(s, w)
  assert.deepEqual([one.ok, one.outcome, one.next.job], [true, null, 2])
  assert.match(one.next.form, /^\(job \(n 2\) \(of-run "w\d+"\) \(why "the check is not green: .*answered false"\) \(budget \(jobs-left 1\) \(s-left \d+\)\)\)$/)
  assert.equal(w.run.hops, 0, 'the job starts its hops again')
  assert.equal(w.contract.exit, null)
  const two = job(s, w)
  assert.deepEqual([two.outcome, w.contract.exit, w.contract.outcome], ['fail', 15, 'fail'])
  assert.match(w.contract.why, /^budget: 2 jobs, the check still says/)
  const rec = readContract(renderContract(w.contract)).jobs
  assert.deepEqual(rec.budget.jobs, [2, 2])
  assert.deepEqual(rec.rows.map((r) => [r.n, r.yield, r.receipts]), [[1, 'answered', 0], [2, 'answered', 0]])
  assert.equal(JOB_BUDGET.jobs, 6, 'the default is the design\'s proposal until the measure')
})

// spec: §8 P4 "a green check passes by the foreman only" · law 6
// class: E the run's outcome
// technique: job 1 red, job 2 green
// method: the second finish passes; no job 3 is offered
// sre: once the suite is green, does the loop stop asking the mind for more?
test('a green check passes by the foreman: job 2 turns the suite green and the run passes, with no job 3', () => {
  const { s, w } = loop()
  assert.equal(job(s, w, 1).next.job, 2)
  const two = job(s, w, 0, 'Fixed the off-by-one; the suite passes.')
  assert.deepEqual([two.outcome, two.next, w.contract.exit, w.contract.outcome], ['pass', undefined, 0, 'pass'])
})

// spec: §8 P4 "a stop word stops it; a ticket holds it"
// class: E the owner's stop · F-08 a press waiting
// technique: the stop record set before the job's end; an act that waits on its press
// method: both finish with waiting and the contract in waiting-owner; clearing the stop puts the run back to running
// sre: when he says "nah, leave it", does the loop leave it?
test('a stop on the record or a press waiting holds the run for the owner; clearing the stop lets it run', () => {
  const { s, w } = loop()
  assert.equal(setStop(s, w, { mode: 'stop', said: 'nah, leave it' }).ok, true)
  const d = job(s, w)
  assert.deepEqual([d.waiting, w.contract.state, w.contract.exit], [true, 'waiting-owner', null])
  assert.match(d.why, /stopped by the owner: "nah, leave it"/)
  assert.deepEqual(setStop(s, w, null), { ok: true, cleared: true })
  assert.equal(w.contract.state, 'running')
  const p = loop()
  p.w.pending.push({ kind: 'press', op: 'git-commit', ticket: 't-press', args: [] })
  assert.match(job(p.s, p.w).why, /a press waits on the owner/)
})

// spec: §2.5 "a hold is not a stop" (F25) · §8 P4 "a hold word yields no ticket until cleared"
// class: L3 an act during a hold
// technique: the hold on the record, then a call, then the clearing
// method: the call is refused with the hold's sentence and no ticket; after the clearing the same call takes a ticket
// sre: when he says "don't fix it yet", does the mind change nothing until he says go?
test('a hold takes no task: the call is refused until the owner clears it', () => {
  const { s, w } = loop()
  setStop(s, w, { mode: 'hold', said: "don't fix it yet" })
  const held = intent(s, w.id, { tool: 'read', args: ['game.js'] })
  assert.deepEqual([held.ok, held.ticket], [false, undefined])
  assert.match(held.why, /held: the owner said "don't fix it yet" — answer, change nothing/)
  assert.equal(w.pending.length, 0)
  setStop(s, w, null)
  assert.equal(intent(s, w.id, { tool: 'read', args: ['game.js'] }).ok, true)
})

// spec: §2.5 circling (F133 five identical edits, F24 "I'll try READ FILE" twenty times) · §8 P4 "fault circling"
// class: E2 a loop inside a job
// technique: the same call three times running, then the same announced call three times
// method: the third is refused, the job row says fault circling, the run waits for the owner
// sre: does a mind that repeats itself get stopped and handed to him, instead of looping to the budget?
test('the same call three times running ends the job fault circling and the run waits; an announced call too', () => {
  const { s, w } = loop()
  for (let k = 0; k < 2; k++) {
    const i = intent(s, w.id, { tool: 'read', args: ['game.js'] })
    result(s, w.id, 'hand', { ticket: i.ticket, op: 'read', exit: 0, rows: 'same text' })
  }
  const third = intent(s, w.id, { tool: 'read', args: ['game.js'] })
  assert.deepEqual([third.ok, third.circling, third.waiting], [false, third.circling, true])
  assert.match(third.why, /circling: the same call 3 times/)
  assert.deepEqual([w.contract.jobs.rows.at(-1).yield, w.contract.state], ['fault', 'waiting-owner'])
  const p = loop()
  let r
  for (let k = 0; k < 3; k++) r = said(p.s, p.w.id, "I'll try READ FILE: space_2048/game.js")
  assert.match(r.circling, /circling/)
  assert.equal(p.w.contract.state, 'waiting-owner')
})

// spec: §2.5 "the last two jobs closed no new receipt → the run stops (exit 99)"
// class: F-06 stalled
// technique: two jobs that answer with no call
// method: job 1 opens job 2; job 2 with no receipt either stops the run 99
// sre: does a mind that only talks get stopped before it spends six jobs?
test('two jobs with no new receipt stop the run with exit 99', () => {
  const { s, w } = loop()
  assert.equal(finishRun(s, w.id, { pass: true, answer: 'Thinking about it.' }).next.job, 2)
  const d = finishRun(s, w.id, { pass: true, answer: 'Still thinking.' })
  assert.deepEqual([d.outcome, w.contract.exit], ['fail', 99])
  assert.equal(w.contract.why, 'two jobs with no new receipt')
})

// spec: §2.5 the pushback row · law 15 · SENTRY-2.0 §8 (shadow: nothing leaves the record)
// class: E the sentry's word
// technique: a pushback verdict on the open job, the domain live and then in shadow
// method: live → the run waits with the mind's sentence; shadow → job 2 opens and a would-park row is on the worker
// sre: can a 1B that has not passed its sitting park his run?
test('pushback parks the run only when its domain is live; in shadow job 2 opens and a would-park row is written', () => {
  for (const shadow of [false, true]) {
    const { s, w } = loop({ shadow })
    sentryOf(w).verdicts.push({ check: 'pushback', t: s.host.now(), detail: 'I should not delete the save file', why: 'x' })
    const d = job(s, w)
    if (!shadow) assert.deepEqual([d.waiting, /pushed back: I should not delete the save file/.test(d.why)], [true, true])
    else { assert.equal(d.next.job, 2); assert.equal(sentryOf(w).would.at(-1).kind, 'park') }
  }
})

// spec: §2.5 "a chat or break turn runs the same read with check none … never continues" · the flag
// class: E the outcome
// technique: a desk run with no form; a red run with the loop off
// method: the desk run ends stopped with no next; the loop off ends the red run fail as before P4
// sre: does the loop change anything for the desk, or for the box before the measure says so?
test('a desk run never continues, and with the loop off a red run fails as it did before', () => {
  const { s, w } = loop({ check: '' })
  const d = finishRun(s, w.id, { pass: true, answer: 'Here it is.' })
  assert.deepEqual([d.outcome, d.next], ['stopped', undefined])
  const off = loop({ on: false })
  const r = job(off.s, off.w)
  assert.deepEqual([r.outcome, r.next, off.w.contract.jobs], ['fail', undefined, undefined])
})
