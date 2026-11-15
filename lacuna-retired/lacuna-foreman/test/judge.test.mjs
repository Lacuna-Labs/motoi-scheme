// judge.test.mjs — U1 unit tests for `judge.mjs`, the S2 judge (W1.3; SENTRY-2.0 §5).
// owns: the proofs that a failed run is judged once by the resident judge-capable mind under the two-form grammar and leaves one
//   `(judged …)` row beside its run row and one floor event; that a pass is never judged, nor any run while the E4B holds the port;
//   that an answer outside the grammar, or no answer, writes nothing; that the row reads back field by field.
// refuses: a mock of judge.mjs, runs.mjs or the supervisor (a real Supervisor; the host's `mind` is a fake brain, which the
//   code rules allow; its ledger and upstream are captured).
// implements: W1.3 (docs/lanes/1.0/W1-work-road.md); SENTRY-2.0 §5 S2; ROAD Category 5 D4 (the judge is the resident 26B or 12B).
// invariants: "a claim is not a record" (the judged row is advice beside the run row; the outcome stands).
// faults: none by id.
import test from 'node:test'
import assert from 'node:assert/strict'
import { Supervisor } from '../supervisor.mjs'
import { fileRun } from '../intents.mjs'
import { contractExit, EXIT } from '../contract.mjs'
import { closeRun } from '../runs.mjs'
import { JUDGE_GRAMMAR, JUDGED_FIELDS, judge, judgedLine, readJudgment } from '../judge.mjs'
import { readForms } from '../../../lacuna-scheme/src/slat-data.js'

const ANSWER = '(why "the test file was never written: five reads, then a plan in prose") (fix "write the test with patch, run test-run, then commit")'
function setup({ brain = '26b', mind = async () => ({ text: ANSWER }) } = {}) {
  let t = 1000, n = 0
  const h = { rows: [], up: [], asks: [], deadlines: { hand: 10, act: 40, beat: 5, mind: 20, hop: 50 }, now: () => t, id: () => `w${++n}`, save: () => {},
    contract: () => {}, mail: () => {}, mailCount: () => {}, brainNow: () => brain, ledger: (text) => h.rows.push(text),
    upstream: (kind, w, data) => h.up.push({ kind, data }), mind: async (req) => { h.asks.push(req); return mind(req) } }
  const s = new Supervisor(h)
  const run = (outcome) => {
    const w = fileRun(s, { key: 'wo:wo-273615', goal: 'the Curator watchdog dev-api.health is red: fix it', by: 'work-order', role: 'coder', tier: 'act', hands: ['read'], acts: ['patch'] })
    contractExit(s, w, EXIT.DONE, outcome, { checked: true, why: outcome === 'pass' ? null : 'done-check: (latch-closed?) answered #f' })
    return { w, row: closeRun(s, w) }
  }
  return { s, h, run }
}

// spec: SENTRY-2.0 §5 "at a failed run's end, one call: why, in one line, and the fix" · class: L5 the ledger row's shape
// technique: a real failed run's row and a fake 26B that answers in the grammar
// method: one call, with the grammar, the port's model name and the run's goal in the prompt; one (judged …) row that reads back
//         with the run, the why, the fix and the judge's name; one floor event; a second call for the same run asks nothing
// sre: when a run fails, does the record say why in one line, labeled by the mind that said it, without the judge running forever?
test('a failed run is judged once by the resident 26B: one call under the grammar, one (judged …) row, the floor told', async () => {
  const { s, h, run } = setup()
  const { w, row } = run('fail')
  const r = await judge(s, w, row)
  assert.equal(r.why, null, r.why)
  assert.equal(h.asks.length, 1)
  assert.deepEqual([h.asks[0].grammar, h.asks[0].model, h.asks[0].job], [JUDGE_GRAMMAR, 'lacuna-worker-lite', 'judge'])
  assert.match(h.asks[0].prompt, /the Curator watchdog dev-api\.health is red/)
  assert.match(h.asks[0].prompt, /the foreman's why: done-check: \(latch-closed\?\) answered #f/)
  const judged = h.rows.filter((x) => x.startsWith('(judged '))
  assert.equal(judged.length, 1)
  const [f] = readForms(judged[0])
  assert.deepEqual(f.slice(1).map((x) => String(x[0].name)), [...JUDGED_FIELDS])
  const o = Object.fromEntries(f.slice(1).map((x) => [x[0].name, x[1]]))
  assert.deepEqual([o.run, o.by], [w.id, '26b'])
  assert.match(o.why, /^the test file was never written/)
  assert.match(o.fix, /^write the test with patch/)
  assert.match(o.at, /^lacuna:\//)
  assert.equal(h.up.filter((u) => u.kind === 'judged').length, 1)
  assert.match((await judge(s, w, row)).why, /judged already/)
  assert.equal(h.asks.length, 1, 'never continuous')
})

// spec: SENTRY-2.0 §5 "on demand, never continuous" · ROAD Category 5 D4 "never a park-and-load per failed run"
// class: E (a call that must not happen)
// technique: a passing run with the 26B resident; a failed run with the E4B on the port
// method: neither asks the mind or writes a row; the second says the foreman's why stands
// sre: does a failure while the desk's E4B holds the port load the 26B to explain itself? It must not.
test('a pass is never judged, nor any run while the E4B holds the port', async () => {
  const a = setup()
  const pass = a.run('pass')
  assert.match((await judge(a.s, pass.w, pass.row)).why, /only a failed run/)
  const b = setup({ brain: 'e4b' })
  const fail = b.run('fail')
  assert.match((await judge(b.s, fail.w, fail.row)).why, /no judge-capable mind holds the brain's port \(the e4b\); the foreman's why stands/)
  assert.equal(a.h.asks.length + b.h.asks.length, 0)
  assert.equal([...a.h.rows, ...b.h.rows].filter((x) => x.startsWith('(judged ')).length, 0)
})

// spec: the judge's grammar (two forms, one line each) · class: W5 malformed (an answer outside the grammar) · J18 a mind that fails
// technique: a fake mind answering prose, then one that throws
// method: prose writes nothing and is counted on the worker; an error writes nothing and says so
// sre: if the judge rambles or the engine is away, does a sentence it never finished land in the record? It must not.
test('an answer outside the grammar, or no answer, writes nothing', async () => {
  const prose = setup({ mind: async () => ({ text: 'It failed because the model never wrote the test.' }) })
  const one = prose.run('fail')
  assert.match((await judge(prose.s, one.w, one.row)).why, /outside its grammar/)
  assert.equal(one.w.judgeDropped, 1)
  const away = setup({ mind: async () => { throw new Error('the small mind answered 503') } })
  const two = away.run('fail')
  assert.match((await judge(away.s, two.w, two.row)).why, /the judge did not answer: the small mind answered 503/)
  assert.equal([...prose.h.rows, ...away.h.rows].filter((x) => x.startsWith('(judged ')).length, 0)
})

// spec: the judged row's shape · class: J15 Unicode and bytes (a quote and a long line in the answer)
// technique: readJudgment over the grammar's own shape, a third form, a missing fix; judgedLine over a 300-character why
// method: two forms read; anything else is null; a line is cut to 160 characters and its quotes escaped
// sre: can a judge's line break the ledger's one-row-per-line rule or grow without a bound?
test('the judgment reads back only in its two forms, and a judged row is one bounded line', () => {
  assert.deepEqual(readJudgment(ANSWER), { why: 'the test file was never written: five reads, then a plan in prose', fix: 'write the test with patch, run test-run, then commit' })
  assert.equal(readJudgment('(why "a") (fix "b") (more "c")'), null)
  assert.equal(readJudgment('(why "a")'), null)
  assert.equal(readJudgment('(why "") (fix "b")'), null)
  const line = judgedLine({ run: 'w-1', why: `say "no" ${'x'.repeat(300)}`, fix: 'f', by: '12b', at: 'lacuna:/1/4096/0/0/0/0/0', t: 5 })
  assert.equal(line.split('\n').length, 2, 'one line and its newline')
  const [f] = readForms(line)
  assert.equal(f[2][1].length, 160)
  assert.match(f[2][1], /^say "no" x+$/)
})
