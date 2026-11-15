// sentry-semantics.test.mjs — S0 SEMANTICS BY CODE (K1.7; SENTRY-2.0 §5 S0, unit 2.2). Owns: the proofs that the 12B's first
// failure on wo-273615 (w-393661: a turn that answered in prose while the step's done named an act) is `answered-not-acted`,
// a would-kick in shadow and a kick with its category out of it; that a turn with a call open or a receipt landed is not;
// that three turns on one step moving nothing are `circling`, once per step; that an act touching files the goal does not
// name is `drift` and one inside the goal is silent; that a run with no latch gets none of the latch checks. Refuses: a mock
// of semantics.mjs; every run is filed through intents.mjs on a real Supervisor.
import test from 'node:test'
import assert from 'node:assert/strict'
import { makeSup } from '../../../test/conformance/fake-host.mjs'
import { fileRun, intent, result, said } from '../intents.mjs'
import { atBoundary } from '../sentry.mjs'
import { openLatch } from '../latch.mjs'
import { readLadder } from '../ladder.mjs'
import { CIRCLING_TURNS, drift, goalParts } from '../sentry/semantics.mjs'

const rows = (h, check) => h.rows.filter((l) => l.startsWith('(verdict ') && (l.includes(`(check ${check})`) || l.includes(`(check "${check}")`)))
// the transcript's answer (runs/w-393661/drive.jsonl, 2026-10-30), cut: prose, no call, step 1 of WATCHDOG-RED open
const PROSE = 'The watch.app.main_thread watchdog is currently red because the application\'s main thread is stalled. ' +
  'This indicates a bug where the thread is blocked or hung, which is likely a web or iPad-specific UI hang. ' +
  'I have not yet checked the specific application logs to confirm the exact line of code causing the stall.'
const GOAL = 'Work order wo-273615: Read the watchdogs (watchdogs), pick the red or stale one, read its playbook (recall WATCHDOG-RED) and the code of its check in tools/sre/watchdogs.mjs, find why it is red, and either fix the check with a test or write the cause and the fix to a note under docs/eng/notes/. Commit.'
const file = (s, o = {}) => fileRun(s, { key: 'wo:wo-273615', goal: GOAL, by: 'work-order', tier: 'act', hands: ['watchdogs', 'recall', 'read'], acts: ['patch', 'git-commit'], ...o })

// spec: unit 2.2 (the postmortem's first failure reproduced) · class: J6 · technique: w-393661's prose on step 1 · method: the row, shadow and not
test('w-393661: a prose answer on a step done by a receipt is answered-not-acted: would-kick in shadow, a kick out of it', async () => {
  const { s, h } = makeSup()
  const w = file(s)
  assert.equal(w.contract.latch.playbook, 'WATCHDOG-RED')
  assert.ok(w.contract.latch.done.some((d) => d.kind === 'receipt'), 'step 1 is done by a receipt')
  const r = await atBoundary(s, w, PROSE)
  assert.equal(r.shadow, true)
  assert.equal(rows(h, 'answered-not-acted').length, 1)
  assert.match(rows(h, 'answered-not-acted')[0], /\(action "would-kick"\)/)
  assert.match(rows(h, 'answered-not-acted')[0], /step 1 of WATCHDOG-RED is done by a receipt of/)
  assert.equal(w.contract.kicks.length, 0, 'nothing leaves the record in shadow')
  const live = makeSup(); live.h.sentryShadow = () => false
  const w2 = file(live.s)
  const r2 = await atBoundary(live.s, w2, PROSE, { shadow: false })
  assert.ok(r2.kicks >= 1)
  assert.ok(w2.contract.kicks.some((k) => k.category === 'answered-not-acted'), JSON.stringify(w2.contract.kicks))
})

// spec: "acted" = a call open or a receipt landed since the last said · class: E · technique: an open ticket; a receipt; then prose
test('a turn with a call open or a receipt landed since the last said is not answered-not-acted', async () => {
  const { s, h } = makeSup()
  const w = file(s)
  intent(s, w.id, { tool: 'watchdogs', args: [] })
  await atBoundary(s, w, 'Reading the watchdogs now.')
  assert.equal(rows(h, 'answered-not-acted').length, 0, 'a call is open')
  const t = w.pending[0]
  result(s, w.id, 'hand', { ticket: t.ticket, op: 'watchdogs', exit: 0, rows: [] })
  await atBoundary(s, w, 'The red one is watch.app.main_thread.')
  assert.equal(rows(h, 'answered-not-acted').length, 0, 'a receipt landed since the last said')
})

// spec: circling: three turns on one step moving nothing · class: E · method: four saids on step 3 of a three-step ladder's answer step
test('three turns on one step that move no receipt and no answer are circling, once per step', async () => {
  const { s, h } = makeSup()
  const w = file(s)
  openLatch(s, w, readLadder('(ladder (playbook "C") (step 1 (allows recall) (gives) (done (answer (names "GB"))) (budget (in 1) (out 1) (s 1))))'))
  for (let i = 0; i < CIRCLING_TURNS + 1; i++) await atBoundary(s, w, `Thinking about the disk, turn ${i}.`)
  assert.equal(rows(h, 'circling').length, 1)
  assert.match(rows(h, 'circling')[0], new RegExp(`${CIRCLING_TURNS} turns on step 1 of C moved no receipt and no answer`))
  assert.equal(rows(h, 'answered-not-acted').length, 0, 'an answer step is not an act step')
  said(s, w.id, 'free space is 62 GB')
  assert.equal(w.contract.latch.closed, true)
})

// spec: S0 drift: the touched set vs the goal's parts · class: E · technique: a goal naming two places; a patch inside, a patch outside
test('an act touching files the goal does not name is drift; one inside the goal is silent; a goal naming nothing checks nothing', () => {
  const { s, h } = makeSup()
  const w = file(s)
  assert.deepEqual(goalParts(GOAL), ['tools/sre/watchdogs.mjs', 'docs/eng/notes'])
  assert.equal(drift(s, w, { touched: ['tools/sre/watchdogs.mjs', 'docs/eng/notes/why-red.md'], op: 'patch' }), null)
  const r = drift(s, w, { touched: ['lacuna-home/src/App.jsx', 'tools/sre/watchdogs.mjs'], op: 'patch' })
  assert.equal(r.check, 'drift'); assert.equal(r.action, 'warn')
  assert.match(r.why, /^patch touched 1 file\(s\) the goal does not name \(lacuna-home\/src\/App\.jsx\); the goal names tools\/sre\/watchdogs\.mjs, docs\/eng\/notes$/)
  assert.equal(rows(h, 'drift').length, 1)
  const plain = fileRun(s, { key: 'r-1', goal: 'tidy the kitchen', hands: ['read'] })
  assert.equal(drift(s, plain, { touched: ['anything.mjs'] }), null)
  assert.equal(drift(s, w, { touched: [] }), null)
})

// spec: no latch, no latch checks · class: E
test('a run with no latch gets no answered-not-acted and no circling', async () => {
  const { s, h } = makeSup()
  const w = fileRun(s, { key: 'r-5', goal: 'a desk question', hands: ['read'] })
  for (let i = 0; i < 5; i++) await atBoundary(s, w, `Just talking, turn ${i}.`)
  assert.equal(rows(h, 'answered-not-acted').length + rows(h, 'circling').length, 0)
})
