// cascade.test.mjs — THE CASCADE, THE HAPPY ROAD (B50 as kept history). Owns: the tests that a mind job climbs its ladder only
// as far as it must, every climb is recorded, and shadow mode asks every rung one at a time and scores each against the 26B.
// Refuses: the brain and the small minds (host.mind is the test's), the live box profile; a mock of cascade.mjs. Implements:
// design §10 (the 2B cap, the 4B reserved, the 26B last), §9 (shadow until the gate). Invariants (§18): "If a mind's gate is
// below 90% per class, then its verdicts are advice and no notice or kick came from it". Faults (§16): F-16.
// coverage: cascade.mjs — lines 100% branches 98.20% functions 100% (2026-10-24, the lane's files alone; the policy-file default is a todo)
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ladder, judge, climb, records, policy, threshold, brokenRule } from '../cascade.mjs'
import { Supervisor } from '../supervisor.mjs'

const BOX = JSON.parse(readFileSync(new URL('./fixtures/box-minds.json', import.meta.url)  /* a fixture, never the live box (2026-10-23) */, 'utf8'))
const TIERS = {
  models: [{ model: 'gemma3:270m', params_b: 0.27 }, { model: 'functiongemma:latest', params_b: 0.27 }, { model: 'gemma3:1b', params_b: 1.0 },
           { model: 'shieldgemma:2b', params_b: 2.6 }, { model: 'gemma4:e4b', params_b: 4.0 }, { model: 'lacuna-worker-lite', params_b: 25.2 }],
  classes: { label: { pick: 'lacuna-worker-lite', ranked: [
    { model: 'lacuna-worker-lite', params_b: 25.2, pct: 100 }, { model: 'gemma4:e4b', params_b: 4, pct: 95 },
    { model: 'shieldgemma:2b', params_b: 2.6, pct: 50 }, { model: 'gemma3:1b', params_b: 1.0, pct: 70 },
    { model: 'gemma3:270m', params_b: 0.27, pct: 22.7 }, { model: 'functiongemma:latest', params_b: 0.27, pct: 36.4 },
    { model: 'qwen:0.5b', params_b: 0.5, pct: 99 }] } },
}
const JOB = { name: 'label', labels: ['noise', 'real-error', 'new-thing'], verbs: new Set() }
const POL = { thresholds: { default: 0.6, unknown: 'climb', jobs: { 'signal->label': { 'gemma3:1b': 0.8 } } }, rules: policy().rules }
const RUNGS = ladder('label', { tiers: TIERS, box: BOX })
const TRACE = 'Traceback (most recent call last):'

// spec: design §10 (the 2B cap, the 4B reserved, the 26B last)
// class: B7 a bound at its edge (2B) · the 90% gate invariant
// technique: the bench fixture against the box fixture
// method: ladder(); read the rungs
// sre: can a ladder put a 4B mind beside the 26B and swap the box?
test('the ladder: benched rungs inside the box, smallest first, never the 4B or past 2B, the 26B last', () => {
  assert.deepEqual(RUNGS.map((r) => r.model), ['functiongemma', 'gemma3:270m', 'gemma3:1b', 'lacuna-worker-lite'])
  assert.deepEqual(RUNGS.map((r) => r.last), [false, false, false, true])
  // a model the box does not list (qwen) and one it reserves (e4b) are never rungs, whatever they scored
  assert.ok(!RUNGS.some((r) => r.model === 'gemma4:e4b' || r.model === 'qwen:0.5b' || r.model === 'shieldgemma:2b'))
  // a class with no bench row: the box's workhorse, then the 26B
  assert.deepEqual(ladder('shell', { tiers: TIERS, box: BOX }).map((r) => r.model), ['functiongemma', 'lacuna-worker-lite'])
  // a box that allows only the 270M keeps only it below the 26B
  const small = { ...BOX, agent_minds: ['gemma3:270m'], workhorse: 'gemma3:270m' }
  assert.deepEqual(ladder('label', { tiers: TIERS, box: small }).map((r) => r.model), ['gemma3:270m', 'lacuna-worker-lite'])
  // the live tables, when present, give the same shape: small → large, the 26B last, no reserved model
  let live = null
  try { live = JSON.parse(readFileSync(new URL('../../../../../lacuna-world/bench/agents/tiers.json', import.meta.url), 'utf8')) } catch { /* not on this box */ }
  if (live) {
    const r = ladder('label', { tiers: live, box: BOX })
    assert.equal(r.at(-1).model, 'lacuna-worker-lite')
    assert.ok(r.every((x) => x.model !== 'gemma4:e4b'))
  }
})

// spec: cascade.mjs judge · thresholds.json · rules.json
// class: the 90% gate invariant · J7 an answer outside the grammar
// technique: state-machine walk over the accept rule
// method: judge each answer; read ok and why
// sre: is a small mind's answer accepted only when it reads, is sure enough and breaks no hard rule?
test('acceptance: under the grammar, at or above the threshold, and the hard rules pass — else it climbs', () => {
  const rung = RUNGS[0]
  const j = (text, certainty, slice = { line: 'GET /healthz 200' }, r = rung) => judge({ text, certainty, rung: r, job: JOB, jobClass: 'signal->label', slice, pol: POL })
  assert.equal(j("(label 'noise)", 0.9).ok, true)
  assert.match(j("(label 'noise)", 0.5).why, /certainty 0.50 under 0.6/)
  assert.match(j("(label 'noise)", null).why, /unknown/)                             // missing certainty is unknown: climb
  assert.equal(judge({ text: "(label 'noise)", certainty: null, rung, job: JOB, jobClass: 'signal->label', slice: {}, pol: { ...POL, thresholds: { unknown: 'accept' } } }).ok, true)
  assert.match(j('(spawn "x")', 0.99).why, /outside the grammar/)
  assert.match(j('(summary "fine")', 0.99).why, /answers with a label/)
  // per job × model thresholds: the 1B must be surer
  assert.equal(threshold(POL, 'signal->label', 'gemma3:1b'), 0.8)
  assert.match(j("(label 'noise)", 0.7, { line: 'x' }, RUNGS[2]).why, /under 0.8/)
  // the hard rules (rules.json, data): a traceback or an Error at error level is never noise, however sure the rung
  assert.match(j("(label 'noise)", 0.99, { line: TRACE }).why, /a traceback is never noise/)
  assert.match(j("(label 'noise)", 0.99, { line: 'BrokenPipeError: [Errno 32] Broken pipe' }).why, /never noise/)
  assert.match(j("(label 'noise)", 0.99, { line: '{"level":"ERROR","msg":"KeyError in sync"}' }).why, /at error level is never noise/)
  assert.match(j("(label 'noise)", 0.99, { line: "Exception occurred during processing of request from ('127.0.0.1', 1)" }).why, /never noise/)
  assert.equal(j("(label 'real-error)", 0.99, { line: TRACE }).ok, true)
  assert.equal(j("(label 'noise)", 0.99, { line: '{"level":"INFO","error":null,"msg":"request"}' }).ok, true)
  assert.equal(brokenRule(POL, 'signal->label', { line: '  File "x.py", line 3, in f' }, { kind: 'label', label: 'noise' }), null)
  // the last rung: its certainty is recorded, never gating — but a broken rule still refuses it
  const last = RUNGS.at(-1)
  assert.equal(j("(label 'noise)", 0.1, { line: 'x' }, last).ok, true)
  assert.equal(j("(label 'noise)", 0.99, { line: TRACE }, last).ok, false)
})

function asker(answers, log = []) {
  let inFlight = 0
  const stats = { max: 0 }
  const ask = async (rung) => {
    inFlight++; stats.max = Math.max(stats.max, inFlight)
    log.push(rung.model)
    await new Promise((r) => setTimeout(r, 2))
    inFlight--
    const a = answers[rung.model]
    if (a instanceof Error) throw a
    return typeof a === 'function' ? a() : a
  }
  return { ask, stats, log }
}

// spec: design §10 (one at a time) · cascade.mjs climb
// class: E9 a message lost (each rung's reason kept)
// technique: a climb with a fake clock
// method: climb; read every step
// sre: does a job stop climbing as soon as it can, and say why it climbed?
test('a climb stops at the first rung that holds, and the record says each rung, its answer, certainty, why, and ms', async () => {
  const { ask, log } = asker({ functiongemma: { text: "(label 'noise)", certainty: 0.95 }, 'gemma3:270m': { text: "(label 'noise)", certainty: 0.4 },
                               'gemma3:1b': new Error('the small mind answered 503'), 'lacuna-worker-lite': { text: "(label 'real-error)", certainty: 0.97 } })
  let t = 0
  const out = await climb({ ask, rungs: RUNGS, job: JOB, jobClass: 'signal->label', slice: { line: TRACE }, pol: POL, clock: () => (t += 7) })
  assert.deepEqual(log, ['functiongemma', 'gemma3:270m', 'gemma3:1b', 'lacuna-worker-lite'])
  assert.equal(out.accepted.model, 'lacuna-worker-lite')
  const { escalation, shadow } = records(out, { job: 'label', jobClass: 'signal->label', slice: { line: TRACE }, cart: 'log-watch', at: 1e9 })
  assert.deepEqual(shadow, [])
  assert.equal(escalation.job, 'label')
  assert.deepEqual(escalation.input, { line: TRACE })
  assert.equal(escalation.accepted_by, 'lacuna-worker-lite')
  assert.equal(escalation.accepted, "(label 'real-error)")
  assert.equal(escalation.candidate_pair, true)                 // a 26B answer that held: a candidate training pair
  assert.deepEqual(escalation.rungs.map((r) => [r.model, r.certainty]), [['functiongemma', 0.95], ['gemma3:270m', 0.4], ['gemma3:1b', null], ['lacuna-worker-lite', 0.97]])
  assert.match(escalation.rungs[0].climbed, /traceback is never noise/)
  assert.match(escalation.rungs[1].climbed, /never noise/)
  assert.match(escalation.rungs[2].climbed, /did not answer: the small mind answered 503/)
  assert.equal(escalation.rungs[3].climbed, null)
  assert.ok(escalation.rungs.every((r) => r.ms === 7))
  // a first rung that holds: no climb, no record, and the 26B is never asked
  const quiet = asker({ functiongemma: { text: "(label 'noise)", certainty: 0.9 } })
  const o2 = await climb({ ask: quiet.ask, rungs: RUNGS, job: JOB, jobClass: 'signal->label', slice: { line: 'GET / 200' }, pol: POL })
  assert.deepEqual(quiet.log, ['functiongemma'])
  assert.equal(records(o2, { job: 'label', jobClass: 'signal->label', slice: {} }).escalation, null)
  // a small rung holds after one climb: logged, but not a training pair
  const mid = asker({ functiongemma: { text: 'garbage', certainty: 0.9 }, 'gemma3:270m': { text: "(label 'noise)", certainty: 0.9 } })
  const o3 = await climb({ ask: mid.ask, rungs: RUNGS, job: JOB, jobClass: 'signal->label', slice: { line: 'ok' }, pol: POL })
  const e3 = records(o3, { job: 'label', jobClass: 'signal->label', slice: { line: 'ok' } }).escalation
  assert.equal(e3.accepted_by, 'gemma3:270m')
  assert.equal(e3.candidate_pair, false)
})

// spec: design §9 (shadow until the gate) · F-16
// class: the 90% gate invariant
// technique: shadow over the fixture ladder
// method: climb in shadow; read the order and the rows
// sre: are shadow verdicts scored against the 26B, one load at a time?
test('shadow: every rung answers, one after another (never two at once), scored against the 26B, with the box per step', async () => {
  const box = { available_gb: 6.1, swap_used_mb: 900, load1: 3.2, person_slot_free: true }
  const { ask, stats, log } = asker({ functiongemma: { text: "(label 'real-error)", certainty: 0.9, box }, 'gemma3:270m': { text: "(label 'noise)", certainty: 0.8, box },
                                      'gemma3:1b': { text: '(nope)', box }, 'lacuna-worker-lite': { text: "(label 'real-error)", certainty: 0.99, box } })
  const out = await climb({ ask, rungs: RUNGS, job: JOB, jobClass: 'signal->label', slice: { line: TRACE }, pol: POL, shadow: true })
  assert.deepEqual(log, RUNGS.map((r) => r.model))          // every rung, in ladder order
  assert.equal(stats.max, 1)                                // sequential: one server asked at a time
  assert.equal(out.accepted.model, 'functiongemma')          // what the worker hears is still the cascade's choice
  const { escalation, shadow } = records(out, { job: 'label', jobClass: 'signal->label', slice: { line: TRACE } })
  assert.equal(escalation, null)                            // the first rung held: nothing climbed
  assert.deepEqual(shadow.map((r) => [r.model, r.right, r.truth]),
                   [['functiongemma', true, false], ['gemma3:270m', false, false], ['gemma3:1b', false, false], ['lacuna-worker-lite', true, true]])
  assert.deepEqual(shadow[0].box, box)
  assert.equal(shadow[1].would_accept, false)
  assert.equal(shadow[2].certainty, null)
})

// spec: design §10 · §12 (carts' minds) · law 3
// class: the 90% gate invariant · E5 one mind at a time across jobs
// technique: a real Supervisor with a mock mind
// method: settle; read heard labels, max in flight, the escalations
// sre: is a traceback ever labelled noise because a small mind said so?
test('in a cart, the mind climbs the ladder; records go to the host; shadow from the header asks every rung, one job at a time', async () => {
  const PROG = (shadow) => `(lacuna-cart 'sentry
  '((does . "reads a log once") (agent . ((tier . watch) (verbs . (on report mind-job mind done))))
    (minds . ((label . ((job . signal->label) (labels . (noise real-error new-thing)) (untrusted . #t)))))
    (done . "read")${shadow ? ' (shadow . #t)' : ''}))
(mind-job 'label '(:ask "what is this line?" :needs (line) :labels (noise real-error new-thing) :untrusted #t))
(on 'line (lambda (l) (mind 'label (list (cons 'line l)))))
(on 'mind (lambda (m) (report 'heard (get m 'label 'unread))))`
  for (const shadow of [false, true]) {
    const asked = [], kept = [], up = []
    let inFlight = 0, max = 0, n = 0
    const host = {
      key: 'k', now: () => 1000, id: () => `w${++n}`, save: () => {}, tables: () => ({ tiers: TIERS, box: BOX }),
      upstream: (kind, w, data) => up.push({ kind, data }), cascade: (kind, rec) => kept.push({ kind, rec }),
      mind: async (req) => {
        inFlight++; max = Math.max(max, inFlight); asked.push([req.model, req.cascade, req.last, req.shadow])
        await new Promise((r) => setTimeout(r, 1)); inFlight--
        // every small rung says noise; the 26B knows a traceback
        return req.last ? { text: req.prompt.includes('Traceback') ? "(label 'real-error)" : "(label 'noise)", certainty: 0.9 }
                        : { text: "(label 'noise)", certainty: 0.95 }
      },
    }
    const s = new Supervisor(host)
    const w = s.spawn({ name: 'sentry', program: PROG(shadow) })
    assert.deepEqual(w.cart.minds.label.rungs, ['functiongemma', 'gemma3:270m', 'gemma3:1b', 'lacuna-worker-lite'])
    s.send(w.id, 'line', TRACE)
    s.send(w.id, 'line', 'GET /healthz 200')
    await s.settle()
    const heard = up.filter((u) => u.kind === 'report').map((u) => u.data.data[0])
    assert.deepEqual(heard, ['real-error', 'noise'])          // the traceback is no longer noise
    assert.equal(max, 1)                                      // never two minds at once, across jobs too
    const esc = kept.filter((k) => k.kind === 'escalation')
    assert.equal(esc.length, 1)
    assert.equal(esc[0].rec.cart, 'sentry')
    assert.equal(esc[0].rec.accepted_by, 'lacuna-worker-lite')
    assert.ok(asked.every(([, cascade, , sh]) => cascade === true && sh === shadow))
    if (shadow) {
      assert.equal(asked.length, 8)                           // two jobs × four rungs
      assert.equal(kept.filter((k) => k.kind === 'shadow').length, 8)
    } else {
      assert.equal(asked.length, 5)                           // the traceback climbed all four; the healthz line held at once
      assert.equal(kept.some((k) => k.kind === 'shadow'), false)
    }
    assert.equal(w.mind.climbs, 1)
    assert.equal(w.mind.by_rung['lacuna-worker-lite'].accepted, 1)
  }
})

// spec: cascade.mjs header (a wrong label never reaches a worker) · rules.json
// class: E9 a message lost (no rung held)
// technique: every rung breaks a hard rule
// method: read what the worker heard
// sre: when no mind can be trusted, does the worker get 'unread' rather than a wrong label?
test('when no rung holds, the worker hears unread with why — never a wrong label', async () => {
  const up = []
  const host = { key: 'k', now: () => 1, id: () => 'w1', save: () => {}, tables: () => ({ tiers: TIERS, box: BOX }),
                 upstream: (kind, w, data) => up.push({ kind, data }), cascade: () => {},
                 mind: async () => ({ text: "(label 'noise)", certainty: 0.99 }) }
  const s = new Supervisor(host)
  const w = s.spawn({ name: 'x', program: `(lacuna-cart 'x '((does . "d") (agent . ((tier . watch) (verbs . (on report mind-job mind done))))
    (minds . ((label . ((job . signal->label) (labels . (noise real-error)) (untrusted . #t))))) (done . "d")))
(mind-job 'label '(:ask "?" :needs (line) :labels (noise real-error) :untrusted #t))
(on 'line (lambda (l) (mind 'label (list (cons 'line l)))))
(on 'mind (lambda (m) (report 'heard (if (get m 'ok #f) (get m 'label 'noise) 'unread) (get m 'why ""))))` })
  s.send(w.id, 'line', TRACE)
  await s.settle()
  const r = up.find((u) => u.kind === 'report').data.data
  assert.equal(r[0], 'unread')
  assert.match(r[1], /no rung's answer held \(the last, lacuna-worker-lite: a traceback is never noise/)
})
