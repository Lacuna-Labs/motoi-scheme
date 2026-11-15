// cascade-climb.test.mjs — THE CLIMB AND ITS RECORDS, WHEN RUNGS FAIL. Owns: the tests of cascade.mjs `climb` and
// `records` when a rung throws, answers nothing, answers a bare string, answers a non-number certainty, or the 26B is
// absent from a shadow pass. Refuses: the brain and every small mind (each rung is a function the test writes); a mock
// of cascade.mjs. Implements: work order U5 §3; design §10 (one load at a time; the 26B last), §12.5 (Gemma-made pairs
// only: a candidate pair is a 26B answer that held). Invariants (§18): "If a mind's gate is below 90% per class, then its
// verdicts are advice and no notice or kick came from it" — shadow rows are records, scored against the 26B, never acted
// on. Faults (§16): F-16 (a rung that answers no verdict is recorded as such).
// coverage: cascade.mjs — lines 100% branches 98.20% functions 100% (2026-10-24, the lane's files alone; the policy-file default is a todo)
import test from 'node:test'
import assert from 'node:assert/strict'
import { climb, records, policy, LAST_RUNG } from '../cascade.mjs'

const JOB = { name: 'label', labels: ['noise', 'real-error'], verbs: new Set() }
const POL = { thresholds: { default: 0.6, unknown: 'climb' }, rules: {} }
const RUNGS = [{ model: 'a', last: false }, { model: 'b', last: false }, { model: LAST_RUNG, last: true }]
const base = { rungs: RUNGS, job: JOB, jobClass: 'signal->label', slice: { line: 'x' }, pol: POL }

// spec: cascade.mjs `climb` ("rungs are asked one after another, never two at once") · design §10 · law 3 (the brain never executes)
// class: J1 a rejection in the ask (an Error, a bare string, undefined) · J2 a throw in the ask · F-16 a rung with no verdict
// technique: fault injection — each rung's ask fails a different way; a fake clock that moves 7 ms per read
// method: climb once; read every step's ok, why, text and ms, and that the 26B's answer is the one accepted
// sre: when the small minds are down (F-16: --llm off), does a job still reach the 26B and say why each rung was passed?
test('a rung that throws, rejects with a string, or answers nothing climbs with its reason; the 26B holds; each step has its ms', async () => {
  let t = 0
  const asks = [() => { throw new Error('connect ECONNREFUSED 127.0.0.1:8092') }, () => Promise.reject('down'), () => null]
  const seen = []
  const out = await climb({ ...base, rungs: [...RUNGS.slice(0, 2), { model: 'c', last: false }, RUNGS[2]], clock: () => (t += 7),
    ask: async (rung) => { seen.push(rung.model); const f = asks.shift(); return f ? f() : { text: "(label 'real-error)", box: { free_gb: 6 } } } })
  assert.deepEqual(seen, ['a', 'b', 'c', LAST_RUNG], 'one at a time, in ladder order')
  assert.deepEqual(out.steps.map((s) => s.why), ['did not answer: connect ECONNREFUSED 127.0.0.1:8092', 'did not answer: down',
                                                 "outside the grammar: not exactly one form", null])
  assert.deepEqual(out.steps.map((s) => s.ms), [7, 7, 7, 7])
  assert.equal(out.accepted.model, LAST_RUNG)
  assert.deepEqual(out.accepted.box, { free_gb: 6 })
  assert.equal(out.steps[0].text, null)
  assert.equal(out.steps[2].box, null)
})

// spec: cascade.mjs `climb` (a bare string answer; certainty unknown climbs) · J7 NaN/Infinity
// class: J7 a certainty that is NaN, Infinity, a numeric string or absent · J15 a long text (cut at 400 characters)
// technique: boundary on certainty values and on text length; the default clock (Date.now)
// method: climb with string answers and certainties of each shape; read each step's certainty, ok, and the text kept
// sre: can a rung that answers certainty "NaN" or a 10 kB essay get past the threshold or bloat the record?
test('a bare string answer reads as text with unknown certainty; NaN and Infinity are unknown; text is kept to 400 characters', async () => {
  const answers = ["(label 'noise)", { text: `(summary "${'x'.repeat(1000)}")`, certainty: 'NaN' }, { text: "(label 'noise)", certainty: Infinity }]
  const out = await climb({ ...base, rungs: [{ model: 'a' }, { model: 'b' }, { model: 'c', last: false }], ask: async () => answers.shift() })
  assert.deepEqual(out.steps.map((s) => s.certainty), [null, null, null])
  assert.deepEqual(out.steps.map((s) => s.ok), [false, false, false])
  assert.equal(out.steps[1].text.length, 400)
  assert.equal(out.steps[0].last, false)
  assert.ok(out.steps.every((s) => s.ms >= 0 && Number.isInteger(s.ms)))
  assert.equal(out.accepted, null)
  assert.equal(out.shadow, false)
  const sure = await climb({ ...base, rungs: [{ model: 'a' }], ask: async () => ({ text: "(label 'noise)", certainty: '0.9' }) })
  assert.equal(sure.accepted.certainty, 0.9, 'a numeric string is its number')
})

// spec: design §12.5 (Gemma-made pairs; a 26B answer that held is a candidate) · cascade.mjs `records` (escalation only when it climbed)
// class: L5 the record's shape · E9 a message lost (no rung held: the record still says every rung)
// technique: state-machine walk over the three ends of a climb: held at once, held after a climb, no rung held
// method: records() for each; read escalation (null or its rungs), accepted_by, candidate_pair, ms, and the iso time
// sre: when the 26B had to answer, is there exactly one record that can become a training pair, and none when a small mind held?
test('records: none when the first rung held; an escalation naming every rung when it climbed; accepted null when nothing held', () => {
  const s = (model, ok, last = false, why = ok ? null : 'its certainty is unknown') => ({ model, last, text: "(label 'noise)", certainty: ok ? 0.9 : null, ms: 5, ok, why, r: { kind: 'label', label: 'noise' }, box: null })
  const held = { steps: [s('a', true)], shadow: false }
  held.accepted = held.steps[0]
  assert.deepEqual(records(held, { job: 'label', jobClass: 'signal->label', slice: {}, at: 0 }), { escalation: null, shadow: [] })
  const climbed = { steps: [s('a', false), s(LAST_RUNG, true, true)], shadow: false }
  climbed.accepted = climbed.steps[1]
  const e = records(climbed, { job: 'label', jobClass: 'signal->label', slice: { line: 'x' }, cart: 'sentry-watch', at: 1_792_800_000 }).escalation
  assert.equal(e.at, '2026-10-24T00:00:00', 'UTC, seconds, no zone')
  assert.deepEqual(e.rungs.map((r) => [r.rung, r.model, r.climbed]), [[0, 'a', 'its certainty is unknown'], [1, LAST_RUNG, null]])
  assert.deepEqual([e.accepted_by, e.candidate_pair, e.ms, e.cart, e.class], [LAST_RUNG, true, 10, 'sentry-watch', 'signal->label'])
  const none = { steps: [s('a', false), s('b', false)], accepted: null, shadow: false }
  const n = records(none, { job: 'label', jobClass: 'signal->label', slice: {} }).escalation
  assert.deepEqual([n.accepted_by, n.accepted, n.candidate_pair, n.rungs.length, n.cart], [null, null, false, 2, null])
  assert.match(n.at, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$/, 'the default time is now')
})

// spec: design §9 (the gate: until 90% per class, shadow, verdicts on the record with counts, no notice, no kick) · cascade.mjs shadow
// class: the 90% gate invariant · F-16 (a mind's verdicts are advice while below the gate)
// technique: state-machine walk — shadow with the 26B present and right, the 26B unreadable, the 26B absent; a non-label answer
// method: climb in shadow; records(); read each row's `truth`, `right` and `would_accept`; assert rows only, nothing acted
// sre: while a mind is under the gate, are its verdicts scored against the 26B and kept as records — never a notice or a kick?
test('shadow scores every rung against the 26B; with no 26B verdict every row says right null; a summary is scored by its text', async () => {
  const say = { a: { text: "(label 'noise)", certainty: 0.95 }, b: { text: "(label 'real-error)", certainty: 0.95 }, [LAST_RUNG]: { text: "(label 'real-error)" } }
  const asked = []
  const out = await climb({ ...base, shadow: true, ask: async (r) => { asked.push(r.model); return say[r.model] } })
  assert.deepEqual(asked, ['a', 'b', LAST_RUNG], 'shadow asks every rung even after one held')
  assert.equal(out.accepted.model, 'a', 'the first that held is what the worker hears')
  const rows = records(out, { job: 'label', jobClass: 'signal->label', slice: {}, cart: 'sentry-watch', at: 0 }).shadow
  assert.deepEqual(rows.map((r) => [r.model, r.truth, r.right, r.would_accept]), [['a', false, false, true], ['b', false, true, true], [LAST_RUNG, true, true, true]])
  assert.equal(records(out, { job: 'label', jobClass: 'signal->label', slice: {}, at: 0 }).escalation, null)
  const blind = await climb({ ...base, shadow: true, ask: async (r) => (r.last ? { text: 'junk' } : say[r.model]) })
  assert.ok(records(blind, { job: 'label', jobClass: 'x', slice: {}, at: 0 }).shadow.every((r) => r.right === null), 'an unreadable 26B is no truth')
  const headless = await climb({ ...base, rungs: RUNGS.slice(0, 2), shadow: true, ask: async (r) => say[r.model] })
  assert.ok(records(headless, { job: 'label', jobClass: 'x', slice: {}, at: 0 }).shadow.every((r) => r.right === null), 'no 26B rung: no truth')
  const summaries = await climb({ ...base, shadow: true, ask: async (r) => ({ text: r.last ? '(summary "two")' : '(summary "one")', certainty: 0.9 }) })
  assert.deepEqual(records(summaries, { job: 'label', jobClass: 'x', slice: {}, at: 0 }).shadow.map((r) => r.right), [false, false, true])
  assert.equal(policy().thresholds.unknown, 'climb')
})
