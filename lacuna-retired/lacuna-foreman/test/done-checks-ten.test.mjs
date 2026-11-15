// done-checks-ten.test.mjs — U1 unit tests for W1.4: the ten jobs' done-checks (TEN-JOBS-2026-10-27 "done when"; ROAD Category 2
// ruling 2: every job has a mechanical done-check).
// owns: the proofs that each of the ten ladders carries a run-level done-check form that reads and judges a run's record: false
//   while its latch is open, true once the latch closed with the receipts the form names, false when a named receipt exited non-zero;
//   QA-DOWN's "up" path read from the services receipt; a run filed under a ladder with words or no done-check takes the ladder's
//   form, and a filer's form wins; a ladder whose done-check is not a form does not read.
// refuses: a mock of intents.mjs or ladder.mjs; the forms are the real ladders', the records are built beside them.
// implements: W1.4 (docs/lanes/1.0/W1-work-road.md); ROAD-TO-1.0 Category 2 ruling 2; law 6.
// invariants: law 6 ("outcome pass is written only by the foreman's done-check").
// faults: none by id.
// coverage: intents.mjs doneCheck's W1.4 words and fileRun's fill-in; ladder.mjs readLadder's done-check (2026-10-31)
import test from 'node:test'
import assert from 'node:assert/strict'
import { makeSup } from '../../../test/conformance/fake-host.mjs'
import { doneCheck, fileRun } from '../intents.mjs'
import { loadLadder, readLadder } from '../ladder.mjs'
import { TEN_JOBS, rehearseJob, rehearseTen } from '../rehearsal.mjs'

const TEN = ['WATCHDOG-RED', 'DISK', 'CART-REPAIR', 'QA-DOWN', 'ERROR-SPIKE', 'WORK-ORDERS', 'HOTFIX', 'RELEASE', 'GAME-ROOM', 'BACKUP']
/** The receipts a closed run of each job leaves beside its latch: the ones its form names (TEN-JOBS "done when"). */
const NAMED = { 'CART-REPAIR': ['strict'], 'WORK-ORDERS': ['test-run', 'git-commit'], HOTFIX: ['test-run', 'git-commit'], 'GAME-ROOM': ['make-bundle'] }
const record = (form, { closed, results = [] }) => ({ id: 'w-t', run: { results, hops: results.length }, contract: { done_check: form, latch: { closed }, steps: [] } })
const rows = (tools, exit = 0) => tools.map((tool, i) => ({ n: i + 1, tool, value: { ok: exit === 0, exit } }))

// spec: W1.4 "each evaluated true on a run's record" · ROAD Category 2 ruling 2 · law 6
// class: L1 pass without a form (each ladder carries one) · L5 the ledger row's shape (the receipts a form reads)
// technique: table over the ten real ladders; records built with the latch open, closed, and closed with a named receipt failing
// method: open → fail, checked; closed with the named receipts at exit 0 → pass; a named receipt at exit 1 → fail with its answer
// sre: can a job close `pass` on a mind's word alone, or only on the receipts its ladder and its form name?
test('each of the ten ladders carries a done-check that fails an open latch and passes a closed one with its named receipts', () => {
  for (const name of TEN) {
    const form = loadLadder(name).doneCheck
    assert.match(form, /^\(/, `${name} carries a form`)
    const open = doneCheck(record(form, { closed: false, results: rows(NAMED[name] || []) }))
    assert.deepEqual([open.pass, open.checked], [false, true], `${name}: an open latch is not done (${open.why})`)
    const closed = doneCheck(record(form, { closed: true, results: rows(NAMED[name] || []) }))
    assert.equal(closed.pass, true, `${name}: a closed latch with its receipts is done (${closed.why})`)
    if (NAMED[name]) {
      const failed = doneCheck(record(form, { closed: true, results: rows(NAMED[name], 1) }))
      assert.equal(failed.pass, false, `${name}: a named receipt that exited 1 is not done`)
      assert.match(failed.why, /answered/)
    }
  }
})

// spec: TEN-JOBS #4 "up, or the failing service named" · class: L5 the ledger row's shape (the services receipt's rows)
// technique: QA-DOWN's form over four records: QA up and healthy, up and unhealthy, down, no services receipt (latch open in all)
// method: only up and healthy passes without the latch; the others need the ladder closed (the failing service named, a petition)
// sre: when the owner asks "is QA up?" and it is, does the job close on the services read instead of failing for want of a restart?
test('QA-DOWN closes on the services receipt when QA is up and healthy, and needs its ladder closed otherwise', () => {
  const form = loadLadder('QA-DOWN').doneCheck
  const svc = (row) => ({ closed: false, results: [{ n: 1, tool: 'services', value: [{ name: 'dev-api', up: true, healthy: true }, row] }] })
  assert.equal(doneCheck(record(form, svc({ name: 'qa-api', up: true, healthy: true }))).pass, true)
  assert.equal(doneCheck(record(form, svc({ name: 'qa-api', up: true, healthy: false }))).pass, false)
  assert.equal(doneCheck(record(form, svc({ name: 'qa-api', up: false, healthy: false }))).pass, false)
  assert.equal(doneCheck(record(form, { closed: false })).pass, false, 'no services receipt: no row')
  assert.equal(doneCheck(record(form, { closed: true })).pass, true, 'the failing service named: the ladder closed')
})

// spec: W1.4 "written with K1's form into the ladder header" · class: L1 pass without a form
// technique: three runs filed through the real fileRun under DISK: done-check words, none, and a form of the filer's own
// method: words and none take the ladder's form; the filer's form stands
// sre: when a work order says its done-check in words, does the run still get a form a receipt can satisfy?
test('a run filed under a ladder takes its done-check when the filer gave words or none; a filer\'s form wins', () => {
  const { s } = makeSup()
  const file = (key, doneCheckText) => fileRun(s, { key, goal: 'check the disk (recall DISK)', hands: ['disk', 'disk-usage', 'jobs', 'files', 'recall'], ...(doneCheckText === undefined ? {} : { doneCheck: doneCheckText }) })
  const disk = loadLadder('DISK').doneCheck
  assert.equal(file('r-words', 'free space and the plan, in numbers').contract.done_check, disk)
  assert.equal(file('r-none').contract.done_check, disk)
  assert.equal(file('r-form', '(has (quote disk))').contract.done_check, '(has (quote disk))')
})

// spec: W1.4 · class: W5 malformed (a done-check in words where a form belongs)
// technique: readLadder over a ladder whose done-check is a sentence
// method: the reader refuses it with one sentence naming the ladder
// sre: if someone writes a done-check as prose in a ladder, is it refused at load instead of failing every run later?
test('a ladder whose done-check is not a form does not read', () => {
  const ladder = (dc) => `(ladder (playbook "T") (version 1) (role operator) (done-check ${JSON.stringify(dc)})
  (step 1 (allows disk) (gives) (done (receipt disk)) (budget (in 1) (out 1) (s 1))))`
  assert.equal(readLadder(ladder('(has (quote disk))')).doneCheck, '(has (quote disk))')
  assert.throws(() => readLadder(ladder('the disk was read')), /the ladder T's done-check is a form in a string/)
})

// spec: 5.1 & 5.2 (ten-job rehearsal on eval:rehearsal-* sessions through the real Supervisor, ladders, desk verbs and done-checks)
// class: E end-to-end rehearsal · L1 pass only by done-check · L8 eval: session isolation
// technique: rehearseTen() over all 10 jobs, plus QA-DOWN early close and fault-injected failing receipt / skipped step
// method: 10/10 pass with closed latches, floorEvents and desk records; RELEASE dry-runs fileCartOrders; faulted job fails with why
// sre: do all ten real SRE jobs walk their ladders end-to-end on eval sessions and fail with a mechanical why when a step fails?
test('rehearseTen walks all ten jobs on eval:rehearsal-* sessions to outcome pass, and fails with a mechanical why on a fault', () => {
  const clean = rehearseTen({ now: () => 1_762_000_000 })
  assert.deepEqual([clean.total, clean.passed, clean.failed], [10, 10, 0])
  assert.deepEqual(clean.rows.map((r) => r.playbook), TEN)
  for (const r of clean.rows) {
    assert.match(r.session, /^eval:rehearsal-/)
    assert.equal(r.outcome, 'pass', `${r.playbook} failed: ${r.why}`)
    assert.equal(r.latchClosed, true, `${r.playbook} latch did not close`)
    assert.equal(r.floorEvents[0].type, 'run.start')
    assert.equal(r.floorEvents.at(-1).type, 'run.done')
  }
  const rel = clean.rows.find((r) => r.playbook === 'RELEASE')
  assert.equal(rel.dryOrder.filed, 1)
  assert.equal(rel.dryOrder.dry, true)
  assert.match(rel.dryOrder.runKey, /^wo:eval:/)
  const qaUp = rehearseJob(TEN_JOBS.find((j) => j.playbook === 'QA-DOWN'), { qaUp: true })
  assert.deepEqual([qaUp.outcome, qaUp.stepCount, qaUp.latchClosed], ['pass', 1, false])
  const faulted = rehearseTen({ faults: { 'CART-REPAIR': { step: 4, exit: 1 }, 'GAME-ROOM': { step: 3, skip: true } } })
  assert.deepEqual([faulted.total, faulted.passed, faulted.failed], [10, 8, 2])
  const badCart = faulted.rows.find((r) => r.playbook === 'CART-REPAIR')
  const badGame = faulted.rows.find((r) => r.playbook === 'GAME-ROOM')
  assert.equal(badCart.outcome, 'fail')
  assert.match(badCart.why, /done-check/)
  assert.equal(badGame.outcome, 'fail')
  assert.equal(badGame.latchClosed, false)
  assert.throws(() => rehearseJob({ ...TEN_JOBS[0], session: 'alfred' }), /Law 8/)
})
