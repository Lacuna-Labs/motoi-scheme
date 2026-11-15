// cart-run.test.mjs — A CART'S RUN: ITS STEPS, ITS RECORD, ITS VERBS, AND PICKING ITS MINDS. Owns: the tests of cart.mjs
// `step`, `noteReport`, `record`, `cartVerbs` (done), `cartBrain`, `cartJob` and `pickMind` at their bounds and on a cart
// record older than the code (a 1.3 checkpoint). Refuses: the live box profile and tiers.json; the brain; a mock of
// cart.mjs (the Supervisor is real; a few calls go straight to the exported function with a worker shaped as the record
// keeps it). Implements: work order U5 §3; design §12.2 (a cart reads its contract; report 'step is text), §12.6 (outcome
// pass only by done-check), §10 (minds by class inside the box list; the 4B reserved). Invariants (§18): "If a step is
// done, then a ticket closed it" — a cart's own `done` is its outcome word, never a step closed for someone else; "If a
// mind's gate is below 90% per class, then its verdicts are advice" — a role not yet in service never answers as that role.
// Faults (§16): F-09 (no judgment fallback recorded → ask-owner), F-02 (a mind the header does not name).
// coverage: cart.mjs — lines 100% branches 99.31% functions 100% (2026-10-24, the lane's files alone; two dead branches are todos)
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Supervisor } from '../supervisor.mjs'
import { step, noteReport, record, cartBrain, cartJob, cartState, pickMind, readCart, DEFAULT_BOX } from '../cart.mjs'

const BOX = JSON.parse(readFileSync(new URL('./fixtures/box-minds.json', import.meta.url), 'utf8'))
const T0 = 1_792_800_000
function host() {
  let t = T0
  let n = 0
  const up = []
  return { up, tick: (s) => { t += s }, now: () => t, id: () => `w${++n}`, save: () => {}, tables: () => ({ tiers: null, box: BOX }),
           upstream: (kind, w, data) => up.push({ kind, name: w.name, data }) }
}
const HEAD = (verbs = 'on report done', fields = '') => `(lacuna-cart 'run '((does . "runs once") (done . "ran") (exam . E-run)
  (agent . ((tier . watch) (verbs . (${verbs})))) ${fields}))`

// spec: design §12.2 (the run's steps are its record) · engineering §3.5 rings ("nothing that only grows") · cart.mjs STEPS_KEPT 60
// class: B1 a *_KEPT bound under 10× its size (600 steps, 400 bug reports) · J15 long text (names cut at 60, reasons at 240)
// technique: boundary — 600 steps and 400 bug reports into one cart; a step and a report on a plain worker
// method: read the step list (the first kept, the latest 59), the bug list (40), lengths, and that a plain worker has none
// sre: does a cart that loops for a day keep a record the size of a page, with the load step still first?
test('the steps keep the load and the latest 59 under 600 steps; bug reports stop at 40; text is cut; a plain worker keeps none', () => {
  const w = { cart: cartState(readCart(HEAD()), T0) }
  for (let i = 0; i < 600; i++) step(w, i === 0 ? 'load' : `s${i}${'x'.repeat(i === 599 ? 100 : 0)}`, 'done', i === 1 ? undefined : 'y'.repeat(300), T0 + i)
  assert.equal(w.cart.steps.length, 60)
  assert.equal(w.cart.steps[0].name, 'load')
  assert.equal(w.cart.steps[1].name, 's541')
  assert.equal(w.cart.steps.at(-1).name.length, 60)
  assert.equal(w.cart.steps.at(-1).why.length, 240)
  assert.match(w.cart.steps.at(-1).at, /^\d\d:\d\d:\d\d$/)
  for (let i = 0; i < 400; i++) noteReport(w, 'bug', [`b${i}`, { line: i }, 'z'.repeat(i === 0 ? 300 : 0)])
  noteReport(w, 'noise', ['not a bug'])
  assert.equal(w.cart.made.bugs.length, 40)
  assert.equal(w.cart.made.bugs[0].length, 200)
  assert.equal(w.cart.made.bugs[1], 'b1 {"line":1} ')
  const plain = {}
  step(plain, 'x', 'done', 'y', T0)
  noteReport(plain, 'bug', ['x'])
  assert.deepEqual(plain, {})
})

// spec: design §12.6 (outcome pass only by done-check; a cart's own word is `done`) · §17 (stopped: a correct stop) · law 6
// class: L5 the ledger row's shape (the record Lacuna turns into the artifact) · L4 a claim in `said`
// technique: state-machine walk over the record's ends: no outcome with and without a why, done with and without said,
//            minds asked and never asked, a mind with counts and without climbs
// method: build the record from a cart state at each end; read outcome, reason, said, minds, mind_counts, minutes
// sre: does every cart that ends leave one record that says how, in a sentence, with the minds that actually answered?
test('the record says stopped with why when nothing said done, the said sentence when done, and the minds that answered', () => {
  const c = cartState(readCart(HEAD('on report done mind mind-job', '(minds . ((l . ((job . yes-no) (labels . (y n))))))'), { box: BOX }), T0)
  const w = { id: 'w1', cart: c }
  let r = record(w, T0 + 90)
  assert.deepEqual([r.outcome, r.reason, r.said, r.minutes, r.mind_counts], ['stopped', 'stopped', 'stopped', 1.5, null])
  assert.deepEqual(r.minds, ['functiongemma'], 'no mind asked yet: the ones chosen')
  assert.equal(record(w, T0, 'stopped by the owner').reason, 'stopped by the owner')
  c.outcome = 'done'
  assert.deepEqual([record(w, T0, 'x').reason, record(w, T0).reason], ['x', 'done'], 'done without said: the why, else the word')
  c.said = 'ran clean'
  w.mind = { asked: 2, labels: 1, dropped: 0, failed: 1 }
  r = record(w, T0)
  assert.deepEqual([r.reason, r.said, r.mind_counts.climbs, r.mind_counts.by_rung], ['ran clean', 'ran clean', 0, {}])
  w.mind.by_rung = { 'gemma3:1b': { asked: 1, accepted: 0 }, 'lacuna-worker-lite': { asked: 1, accepted: 1 } }
  assert.deepEqual(record(w, T0).minds, ['gemma3:1b', 'lacuna-worker-lite'], 'the rungs that answered, not the ones chosen')
  assert.deepEqual(Object.keys(record(w, T0).mind_choice.l), ['model', 'why', 'rungs'])
})

// spec: design §12.6 (a cart retires once with one record) · cart.mjs cartVerbs ("done means retired"; "(done …) belongs to a cart")
// class: E10 a duplicate message (done said twice) · E1 a handler throws (a plain worker calls done)
// technique: a real Supervisor; a cart says done twice in one handler, then once with no sentence; a plain worker says done
// method: read the cart-retired rows (one), the outcome and said, and the plain worker's crash sentence
// sre: can a cart that says done twice send two artifacts, or a plain worker pretend to be a finished cart?
test('done retires a cart once with its sentence (or the header\'s), and a plain worker that says done is told to stop instead', async () => {
  const h = host()
  const s = new Supervisor(h)
  const w = s.spawn({ name: 'run', program: `${HEAD()}\n(on 'go (lambda (x) (done "first") (done "second")))` })
  s.send(w.id, 'go', 1)
  await new Promise((r) => setTimeout(r, 2))
  assert.equal(h.up.filter((u) => u.kind === 'cart-retired').length, 1)
  assert.deepEqual([w.state, w.cart.outcome, w.cart.said], ['retired', 'done', 'first'])
  const w2 = s.spawn({ name: 'run2', program: `${HEAD()}\n(on 'go (lambda (x) (done)))` })
  s.send(w2.id, 'go', 1)
  await new Promise((r) => setTimeout(r, 2))
  assert.equal(w2.cart.said, 'ran')
  assert.equal(h.up.filter((u) => u.kind === 'cart-retired').at(-1).data.record.outcome, 'done')
  const p = s.spawn({ name: 'plain', verbs: ['on', 'done'], program: "(on 'go (lambda (x) (done \"x\")))" })
  s.send(p.id, 'go', 1)
  assert.match(h.up.find((u) => u.kind === 'crashed' && u.name === 'plain').data.why, /plain is not a cart — \(done …\) belongs to a cart; a worker uses \(stop\)/)
})

// spec: design §12.1 (need-brain only at the header's judgment points) · F-09 (the fallback answers when the brain does not)
// class: E16 a stale checkpoint older than the record (a 1.3 cart record with no judgmentFallback) · J7 a topic that is a procedure
// technique: direct calls with the worker shaped as its record keeps it; a plain worker; a refused point
// method: cartBrain on each; read the question it forms, lastJudgment, the brain count, and the refusal sentence
// sre: when a cart restored from an old checkpoint asks the brain and the brain is down, does it still have a fallback?
test('cartBrain prefixes the judgment point, counts the ask and records the fallback; an old record falls back to ask-owner', () => {
  assert.deepEqual(cartBrain({ name: 'plain' }, ['q', 1]), ['q', 1], 'a plain worker asks as it likes (its tier gates need-brain)')
  const w = { name: 'old', cart: { judgment: ['stale'], brain: 0 } }
  assert.deepEqual(cartBrain(w, [{ name: 'stale' }, 'is it?', 'fact']), ['[stale] is it?', 'fact'])
  assert.deepEqual([w.cart.brain, w.lastJudgment], [1, { topic: 'stale', fallback: 'ask-owner' }])
  w.cart.judgmentFallback = { stale: 'skip' }
  cartBrain(w, ['stale', 'again?'])
  assert.deepEqual(w.lastJudgment, { topic: 'stale', fallback: 'skip' })
  w.cart.judgmentFallback = {}
  cartBrain(w, ['stale', 'again?'])
  assert.equal(w.lastJudgment.fallback, 'ask-owner')
  assert.throws(() => cartBrain({ name: 'n', cart: { judgment: [] } }, ['x', 'q']), /n may ask the brain only at its judgment points \(none\), not 'x/)
})

// spec: design §11 (an untrusted reader's mind is quarantined even if the body forgets) · §12.1 (minds the header names) · F-02
// class: E16 a stale checkpoint (a cart record whose mind has no rungs) · W7 a body that drops the quarantine flag
// technique: direct calls with a cart record; a job declared without :untrusted on a mind the header quarantines
// method: cartJob each; read untrusted, labels, model, jobClass, rungs, shadow; the refusal for an undeclared mind
// sre: if a cart body forgets :untrusted on a log-reading mind, does the header's quarantine still hold?
test('cartJob holds the header over the body: quarantine and labels stay, the model and ladder are the header\'s, an old record has no ladder', () => {
  const plain = { name: 'x', labels: [] }
  assert.equal(cartJob({ name: 'p' }, plain), plain)
  const w = { name: 'c', cart: { shadow: true, minds: { l: { job: 'signal->label', labels: ['a'], untrusted: true, model: 'gemma3:1b' } } } }
  const j = cartJob(w, { name: 'l', labels: [], untrusted: false })
  assert.deepEqual([j.untrusted, j.labels, j.model, j.jobClass, j.rungs, j.shadow], [true, ['a'], 'gemma3:1b', 'signal->label', null, true])
  w.cart.minds.l.rungs = ['gemma3:1b', 'lacuna-worker-lite']
  w.cart.shadow = undefined
  const k = cartJob(w, { name: 'l', labels: ['b'], untrusted: false })
  assert.deepEqual([k.labels, k.rungs, k.shadow], [['b'], ['gemma3:1b', 'lacuna-worker-lite'], false])
  assert.throws(() => cartJob(w, { name: 'm', labels: [] }), /c's header names no mind 'm/)
})

// spec: design §10 (agents stop at 2B; the 4B reserved; the workhorse when nothing is benched) · cart.mjs pickMind · tiers.json
// class: J13 tables unset or partial (no box list, no ranked rows, no `why`) · the 90% gate (a pick outside the box falls back)
// technique: state-machine walk over pickMind's answers: no box, a reserved workhorse, nothing allowed, no row, the pick,
//            the best allowed by score then size, nothing benched among the allowed
// method: pickMind each; read model and the sentence why
// sre: whatever tiers.json says, is a cart's mind always one this box lets an agent load, and does the run say why?
test('pickMind answers inside the box\'s list every time and says why: the pick, the best allowed, or the workhorse', () => {
  assert.deepEqual(pickMind('pick'), { model: 'functiongemma', why: "no tiers.json yet — the box's workhorse" })
  assert.equal(DEFAULT_BOX.workhorse, 'functiongemma')
  const box = { agent_minds: ['gemma4:e4b', 'gemma3:1b', 'gemma3:270m'], workhorse: 'gemma4:e4b', reserved: { 'gemma4:e4b': '4B' } }
  assert.equal(pickMind('pick', { box }).model, 'gemma3:1b', 'a reserved workhorse: the first allowed')
  assert.equal(pickMind('pick', { box: { agent_minds: [] } }).model, 'functiongemma', 'nothing allowed: the smallest safe answer')
  assert.match(pickMind('pick', { tiers: { classes: {} }, box }).why, /^tiers\.json has no pick row yet — the box's workhorse$/)
  assert.deepEqual(pickMind('pick', { tiers: { classes: { pick: { pick: 'gemma3:270m:latest' } } }, box }), { model: 'gemma3:270m', why: 'tiers.json: its pick for pick' })
  const ranked = [{ model: 'gemma3:270m', pct: 80, params_b: 0.27 }, { model: 'gemma3:1b', pct: 80, params_b: 1 }, { model: 'gemma4:e4b', pct: 99, params_b: 4 }]
  const best = pickMind('pick', { tiers: { classes: { pick: { pick: 'gemma4:e4b', ranked } } }, box })
  assert.equal(best.model, 'gemma3:270m', 'a tie on score goes to the smaller')
  assert.match(best.why, /picks gemma4:e4b for pick \(\); this box lets agents have only gemma3:1b, gemma3:270m — gemma3:270m scored best of those \(80%\)/)
  const none = pickMind('pick', { tiers: { classes: { pick: { pick: 'gemma4:e4b', why: 'only one at ≥90%' } } }, box })
  assert.deepEqual(none, { model: 'gemma3:1b', why: 'tiers.json picks gemma4:e4b for pick, which this box does not allow an agent, and none of gemma3:1b, gemma3:270m was benched — the workhorse' })
})
