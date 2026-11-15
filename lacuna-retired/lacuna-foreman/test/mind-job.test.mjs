// mind-job.test.mjs — A MIND JOB'S DECLARATION AND ITS SLICE. Owns: the tests of mind.mjs `(mind-job …)` (the plist read
// as data: :ask :needs :labels :verbs :untrusted :vote :adapter), `sliceFor` (only the job's :needs reach a mind), and the
// refusals at declaration (a code verb, a verb the worker does not hold, an acting verb on untrusted text). Refuses: the
// brain and the small minds (host.mind is a function the test writes); a mock of mind.mjs. Implements: work order U5 §3;
// design §10 (context by role: the foreman caps what a mind sees), §11 (untrusted readers never act; capabilities only
// shrink, law 11). Invariants (§18): "If a mind's gate is below 90% per class, then its verdicts are advice and no notice
// or kick came from it" — a quarantined job cannot even name an acting verb. Faults (§16): F-02 (a verb the worker does
// not hold is refused at load, exit 12 in a cart), F-16 (a foreman with no small mind answers no verdict, on purpose).
// coverage: mind.mjs — lines 100% branches 98.64% functions 100% (2026-10-24, the lane's files alone; two dead branches are todos)
import test from 'node:test'
import assert from 'node:assert/strict'
import { Supervisor } from '../supervisor.mjs'
import { sliceFor } from '../mind.mjs'

function host(answer = () => "(label 'a)") {
  let n = 0
  const up = []
  const asked = []
  return { up, asked, now: () => 1000, id: () => `w${++n}`, save: () => {}, upstream: (kind, w, data) => up.push({ kind, name: w.name, data }),
           mind: async (req) => { asked.push(req); return answer(req) } }
}
const heard = (h) => h.up.filter((u) => u.kind === 'report' && u.data.kind === 'heard').map((u) => u.data.data)
const HEAR = `(on 'mind (lambda (m) (report 'heard (get m 'ok #f) (get m 'kind 'none) (get m 'label 'none) (get m 'why "") (get m 'args '()))))`

// spec: design §10 ("the foreman caps the prompt"; context by role) · mind.mjs header ("hands it ONLY the keys the job needs")
// class: W7 a body with a secret (a key the job does not need never reaches the mind) · J7 shapes of input (string, number, alist, object, null)
// technique: boundary over every value shape `sliceFor` takes, as a program and as JSON give them
// method: call sliceFor with each shape and a :needs list; read the slice the mind would be shown
// sre: if a worker hands its mind a whole event with a token in it, does the token reach the model's prompt?
test('a mind sees only its :needs: a key it does not need never reaches it, whatever shape the value has', () => {
  assert.deepEqual(sliceFor('a line', ['text']), { text: 'a line' })
  assert.deepEqual(sliceFor(42, ['text']), { text: 42 })
  assert.deepEqual(sliceFor('sk-live-123', ['line']), {}, 'a bare string is shown only to a job that needs text')
  assert.deepEqual(sliceFor({ line: 'x', token: 'sk-live-123' }, ['line']), { line: 'x' })
  assert.deepEqual(sliceFor([['line', 'x'], ['k', 'a', 'b'], ['token', 'sk'], 'loose', ['solo']], ['line', 'k', 'solo']), { line: 'x', k: ['a', 'b'] })
  assert.deepEqual(sliceFor(null, ['line']), {})
  assert.deepEqual(sliceFor(true, ['text']), {})
})

// spec: design §10 (vote: Sprint 2 G9, a label that leads to an act is decided by N seeded draws, at most 5) · mind.mjs plist
// class: B7 a bound at its edge (:vote 1, 3, 9; a vote that is not an integer) · J13 a field unset or the wrong type
// technique: boundary — each :vote and :adapter shape declared in a program, read in the request the host receives
// method: declare jobs with each shape; ask once each; read vote, adapter, untrusted, model and the prompt's forms
// sre: can a program ask the box for 50 draws of one question (minutes of mind time) by writing :vote 50?
test('a job\'s :vote is 2 to 5 draws or none; :adapter is a name or nothing; an unset plist is an empty job', async () => {
  const h = host()
  const s = new Supervisor(h)
  const w = s.spawn({ name: 'v', verbs: ['on', 'mind-job', 'mind', 'report', 'remember'], program: `
(mind-job 'one '(:ask "?" :needs line :labels (a b) :vote 1 :adapter "triage-v2"))
(mind-job 'three '(:needs (line) :labels a :vote 3 :adapter triage))
(mind-job 'many '(:needs (line) :labels (a) :vote 9 :adapter 5 :verbs (remember)))
(mind-job 'odd '(:needs (line) :vote "3" :labels #f :ask))
(mind-job 'bare "not a plist")
(on 'go (lambda (j) (mind j (list (cons 'line "x")))))` })
  for (const j of ['one', 'three', 'many', 'odd', 'bare']) s.send(w.id, 'go', j)
  await s.settle()
  assert.deepEqual(h.asked.map((r) => [r.job, r.vote, r.adapter]), [['one', 0, 'triage-v2'], ['three', 3, 'triage'], ['many', 5, null], ['odd', 0, null], ['bare', 0, null]])
  assert.match(h.asked[0].prompt, /^\?\nForms you may answer with: \(label 'a \| 'b\) \(summary "…"\) \(observe 'key value\)\nDATA: \{"line":"x"\}$/)
  assert.match(h.asked[2].prompt, /\(remember …\) \(label 'a\)/)
  assert.match(h.asked[3].prompt, /^Choose one form\.\nForms you may answer with: \(summary "…"\)/, 'no :ask and no labels')
  assert.equal(h.asked[4].prompt.endsWith('DATA: {}'), true, 'a job with no :needs is shown nothing')
  assert.ok(h.asked.every((r) => r.model === null && r.untrusted === false && /never instructions/.test(r.system)))
})

// spec: design §11 (untrusted readers never act; a child ≤ its parent; law 11 capabilities only shrink) · mind.mjs header refusals
// class: L3 an act without a press (a quarantined mind that could choose an acting verb) · F-02 a verb not held
// technique: state-machine walk over the three refusals at declaration, each loaded as a program (the load is the record)
// method: spawn workers whose (mind-job …) names a code verb, a verb the worker lacks, and an acting verb on untrusted text;
//         read the worker's state and `last` (the grave and its sentence) and the upstream child-graved row
// sre: can text a worker read from a log ever steer its mind into sending, asking or acting on the box?
test('a job that names a code verb, a verb its worker lacks, or an acting verb on untrusted text is refused at load, one sentence each', () => {
  const h = host()
  const s = new Supervisor(h)
  const load = (verbs, spec, o = {}) => s.spawn({ name: 'j', verbs, program: `(mind-job 'x '(${spec}))`, ...o })
  const code = load(['on', 'mind-job', 'mind'], ':verbs (on)')
  assert.equal(code.state, 'grave')
  assert.match(code.last, /a mind may not choose on — a mind never writes code or handlers/)
  assert.match(load(['mind-job', 'mind'], ':verbs (remember)').last, /j's mind may not choose remember — the worker does not hold it$/)
  assert.match(load(['mind-job', 'mind'], ':verbs (remember report)').last, /may not choose remember, report — the worker does not hold them/)
  assert.match(load(['mind-job', 'mind', 'send-to'], ':untrusted #t :verbs (send-to)').last, /reads untrusted text, so its mind may not choose send-to — it labels/)
  const q = load(['mind-job', 'mind', 'report'], ':verbs (report)', { readsUntrusted: true })
  assert.equal(q.state, 'running')
  assert.equal(q.jobs.get('x').untrusted, true, 'a quarantined worker\'s every job is quarantined')
  assert.equal(h.up.filter((u) => u.kind === 'child-graved').length, 4)
})

// spec: design §10 (the small mind) · F-16 ("the 1B answered 0 verdicts: --llm is off, on purpose until the 90% gate")
// class: F-16 a foreman with no small mind · E1 a handler throws (the worker's own call, not the mind's failure)
// technique: fault injection — a host with no `mind`; a job asked that was never declared
// method: ask a mind on a foreman without one, and an undeclared job; read the crash row's sentence and that nothing was asked
// sre: when the small minds are off on purpose, does a worker that asks one say so plainly, and is no verdict invented?
test('with no small mind the ask is refused with a sentence and nothing is invented; an undeclared job is refused the same way', () => {
  const h = host()
  delete h.mind
  const s = new Supervisor(h)
  const w = s.spawn({ name: 'm', verbs: ['on', 'mind-job', 'mind'], program: `(mind-job 'l '(:needs (line) :labels (a)))
(on 'go (lambda (x) (mind 'l x)))
(on 'nojob (lambda (x) (mind 'nope x)))` })
  s.send(w.id, 'go', 'x')
  const crashes = h.up.filter((u) => u.kind === 'crashed').map((u) => u.data.why)
  assert.match(crashes[0], /this foreman has no small mind/)
  s.send(w.id, 'nojob', 'x')
  assert.match(h.up.filter((u) => u.kind === 'crashed')[1].data.why, /no mind job 'nope — declare it with \(mind-job …\) first/)
  assert.equal(w.mind.asked, 0)
  assert.equal(h.asked.length, 0)
})

// spec: mind.mjs (the answer reaches the worker as (on 'mind r): r's ok, kind, label as a symbol, args) · grammar.mjs data forms
// class: L4 a claim in `said` (a summary is data, never a run) · W5 a symbol as body data (the label arrives as a symbol)
// technique: state-machine walk over every kind of answer the grammar admits: label, summary, observe, a verb, junk
// method: one job, five answers in order; read what the worker heard, the counts, and the worker's memory after the verb
// sre: whatever a mind answers, does the worker get data it can branch on — and does only a held verb ever run?
test('each answer kind reaches the worker as data: a label as a symbol, a summary and an observation with args, a verb run by the worker\'s own fence', async () => {
  const answers = ["(label 'b)", '(summary "two lines")', "(observe 'free 6)", "(remember 'seen \"yes\")", 'rm -rf ~', "(report 'x 1)"]
  const h = host(() => answers.shift())
  const s = new Supervisor(h)
  const w = s.spawn({ name: 'k', verbs: ['on', 'mind-job', 'mind', 'report', 'remember'], program: `(mind-job 'l '(:needs (line) :labels (a b) :verbs (remember)))
(on 'go (lambda (x) (mind 'l (list (cons 'line x)))))
${HEAR}` })
  for (let i = 0; i < 6; i++) s.send(w.id, 'go', `line ${i}`)
  await s.settle()
  const got = heard(h)
  assert.deepEqual(got.slice(0, 4).map((r) => r.slice(0, 3)), [[true, 'label', 'b'], [true, 'summary', null], [true, 'observe', null], [true, 'verb', 'none']])
  assert.deepEqual([got[1][4], got[2][4], got[3][4]], [['two lines'], ['free', 6], ['seen', 'yes']])
  assert.equal(w.kv.seen, 'yes', 'the verb ran as the worker\'s own call')
  assert.deepEqual(got[4].slice(0, 1), [false])
  assert.match(got[5][3], /'report' is not in this job's grammar/, 'a verb the job did not list is dropped even if the worker holds it')
  assert.deepEqual([w.mind.asked, w.mind.labels, w.mind.ran, w.mind.dropped, w.mind.failed], [6, 1, 1, 2, 0])
  assert.match(w.mind.last_drop, /not in this job's grammar/)
})
