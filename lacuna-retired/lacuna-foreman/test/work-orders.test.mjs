process.env.LACUNA_AUTO_LOADS = '1'   // these tests exercise the automatic swap road, opt-in since 2026-11-04 (the owner decides who is loaded)
// work-orders.test.mjs — THE WORK-ORDER DISPATCHER. Owns: the tests of work-orders.mjs: the swap waits for the owner's quiet;
// a coder order becomes a coder run (role, reads, acts, standing press, done-check) once the 12B holds the brain; a finished run
// settles its order; the 26B comes back when no coder order is left; a seat request parks the run and swaps. Refuses: a mock
// of the dispatcher or the broker (a real Supervisor and broker; the host's act is captured, never sent).
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Supervisor } from '../supervisor.mjs'
import { broker, swapDone } from '../broker.mjs'
import { runDeskVerb } from '../desk-verbs.mjs'
import { DONE, coderGoal, dispatch, dispatchEngineer, readOrders, seatChange, QUIET_S } from '../work-orders.mjs'
import { doneCheck } from '../intents.mjs'

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wo-'))
  let t = 1000, n = 0
  const acts = [], drives = []
  const host = { deadlines: { hand: 10, act: 40, beat: 5, mind: 20, hop: 50 }, now: () => t, id: () => `w${++n}`, save: () => {}, contract: () => {},
    upstream: () => {}, act: (op, args) => acts.push([op, ...args]), drive: (w) => drives.push(w.id) }
  const sup = new Supervisor(host)
  runDeskVerb('work-order', { goal: 'split cards.css into one file per card', for: 'coder', repo: 'lacuna' }, { dir, run: 'desk:1', now: 1, seq: () => 1 })
  return { dir, sup, acts, drives }
}

test('the swap waits for the owner\'s quiet, then the 26B steps out for the coder', () => {
  const { dir, sup, acts } = setup()
  const a = dispatch(sup, { dir, quietS: 30 })
  assert.equal(a.did, 'nothing'); assert.match(a.why, /talked 30 s ago/)
  assert.deepEqual(acts, [])
  const b = dispatch(sup, { dir, quietS: QUIET_S })
  assert.equal(b.did, 'swap'); assert.deepEqual(acts, [['switch-brain', '12b']])
  assert.equal(readOrders(dir)[0].state, 'waiting-brain')
  assert.equal(dispatch(sup, { dir, quietS: QUIET_S }).did, 'nothing', 'one swap at a time')
})

test('with the 12B holding the brain an order becomes one coder run; a finished run settles it; then the 26B comes back', () => {
  const { dir, sup, acts, drives } = setup()
  dispatch(sup, { dir, quietS: QUIET_S }); swapDone(sup, { ok: true, to: '12b' })
  const r = dispatch(sup, { dir, quietS: QUIET_S })
  assert.equal(r.did, 'run')
  const w = sup.workers.get(r.run)
  assert.deepEqual([w.run.role, w.tier, w.run.press, w.run.desk], ['coder', 'act', 'standing', false])
  assert.ok(w.run.acts.has('patch') && w.run.acts.has('test-run') && !w.run.acts.has('merge'))
  assert.match(w.contract.done_check, /test-run/)
  assert.deepEqual(drives, [r.run])
  assert.equal(dispatch(sup, { dir, quietS: QUIET_S }).why, 'a coder run is in flight (one 12B, one leg)')
  sup.stop(r.run, 'done for the test')
  const after = dispatch(sup, { dir, quietS: QUIET_S })
  assert.equal(readOrders(dir)[0].state, 'failed')   // no done-check pass: failed, said with its run
  assert.equal(after.did, 'swap'); assert.deepEqual(acts.at(-1), ['switch-brain', '26b'])
})

test('a seat request for the 26B parks the coder run and swaps back; the dispatcher never undoes the owner\'s swap', () => {
  const { dir, sup, acts } = setup()
  dispatch(sup, { dir, quietS: QUIET_S }); swapDone(sup, { ok: true, to: '12b' })
  const r = dispatch(sup, { dir, quietS: QUIET_S })
  const s = seatChange(sup, { mind: '26b' }, { dir })
  assert.equal(s.did, 'swap'); assert.deepEqual(acts.at(-1), ['switch-brain', '26b'])
  assert.notEqual(sup.workers.get(r.run)?.state, 'running')
  assert.equal(readOrders(dir)[0].state, 'parked')
  swapDone(sup, { ok: true, to: '26b' })
  assert.equal(broker(sup).by, 'owner')
})

test('T4: a release work order becomes the release card (the door\'s road); any other cart order is refused', async () => {
  const { fileCartOrders } = await import('../work-orders.mjs')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wo-cart-'))
  runDeskVerb('work-order', { goal: 'release: ship the desk build to QA', for: 'cart' }, { dir, run: 'desk:console:1', now: 1, seq: () => 1 })
  runDeskVerb('work-order', { goal: 'run the disk watch now', for: 'cart' }, { dir, run: 'd', now: 1, seq: () => 2 })
  const posts = []
  const r = await fileCartOrders({ dir, post: async (route, body) => { posts.push([route, body]); return { ok: true, petition: 'p-rel-9', filed: true } } })
  assert.deepEqual(posts, [['/api/release/cart', { dry: false, mode: 'push' }]])
  assert.deepEqual(r.map((x) => x.did), ['card', 'refused'])
  const o = readOrders(dir)
  assert.equal(o[0].state, 'waiting-owner'); assert.equal(o[1].state, 'refused')
  assert.match(fs.readFileSync(o[0].file, 'utf8'), /POST \/api\/desk\/press\/p-rel-9/)
  runDeskVerb('work-order', { goal: 'release: ship it', for: 'cart' }, { dir, run: 'desk:eval:ten:2', now: 2, seq: () => 3 })
  await fileCartOrders({ dir, post: async (route, body) => { posts.push([route, body]); return { ok: true, petition: 'p-dry-1' } } })
  assert.deepEqual(posts.at(-1), ['/api/release/cart', { dry: true, mode: 'push' }], 'an eval session files a dry release')
})

// spec: order 2026-11-06 §1.2b; P-2026-11-06-soak-orphan-two-weeks (a deleted soak script filed desk:eval:soak:* every 5 min for 14 days)
// class: E10 a loop no one watches; J14 clock (the episode's first filing, a pause that ends it)
// technique: evalGate on a book, a filing every 300 s across 24 h and past it; then the book through its slat text; then a cart order
// method: ok through 24 h, refused after with the sentence; a refusal keeps the loop refused; 1 h of quiet starts a new episode;
//         another session and the owner's own keys are never gated; a restart reads the same book
// sre: if an eval loop outlives the person who started it, does the foreman stop it within a day and say why?
test('§1.2b: an eval session filing for 24 h without an hour\'s pause is refused; the owner\'s runs never are', async () => {
  const { EVAL_LIFE_S, EVAL_GAP_S, evalGate, evalBookText, evalSessionOf, fileCartOrders, readEvalBook } = await import('../work-orders.mjs')
  assert.equal(evalSessionOf('desk:eval:soak:1730000000'), 'eval:soak')
  assert.equal(evalSessionOf('desk:console:1730000000'), null)
  const book = new Map(), t0 = 1_730_000_000
  let t = t0
  for (; t <= t0 + EVAL_LIFE_S; t += 300) assert.equal(evalGate(book, `desk:eval:soak:${t}`, t).ok, true, `${(t - t0) / 3600} h`)
  const no = evalGate(book, `desk:eval:soak:${t}`, t)
  assert.equal(no.ok, false)
  assert.match(no.why, /^refused: the eval session eval:soak has filed without a pause for 24\.\d h, over 24 h; no live session owns it/)
  assert.equal(evalGate(book, `desk:eval:soak:${t + 3000}`, t + 3000).ok, false, 'a refused filing keeps the loop refused')
  assert.equal(evalGate(book, `desk:eval:other:${t}`, t).ok, true, 'another session has its own life')
  assert.equal(evalGate(book, `desk:console:${t}`, t).ok, true, 'the owner\'s turns are never gated')
  const again = readEvalBook(evalBookText(book))   // a foreman restart reads the same book
  assert.deepEqual([...again], [...book])
  assert.equal(evalGate(again, `desk:eval:soak:${t + 3300}`, t + 3300).ok, false)
  assert.equal(evalGate(again, 'desk:eval:soak:x', t + 3300 + EVAL_GAP_S + 1).ok, true, 'an hour of quiet starts a new episode')
  // a release order from the loop's session is refused before anything is filed
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wo-eval-'))
  runDeskVerb('work-order', { goal: 'release: ship it', for: 'cart' }, { dir, run: `desk:eval:soak:${t}`, now: 2, seq: () => 1 })
  const posts = []
  const r = await fileCartOrders({ dir, book, now: t + 600, post: async (route, body) => { posts.push([route, body]); return { ok: true, petition: 'p' } } })
  assert.deepEqual([r[0].did, posts.length, readOrders(dir)[0].state], ['refused', 0, 'refused'])
})

test('D3: every swap is a ledger record: from, to, by, why, seconds, ok', () => {
  const rows = []
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wo-d3-'))
  let t = 1000
  const host = { deadlines: { hand: 10, act: 40, beat: 5, mind: 20, hop: 50 }, now: () => t, id: () => 'w1', save: () => {}, contract: () => {}, upstream: () => {}, act: () => {}, drive: () => {}, ledger: (x) => rows.push(x) }
  const sup = new Supervisor(host)
  runDeskVerb('work-order', { goal: 'g', for: 'coder', repo: 'lacuna' }, { dir, run: 'd', now: 1, seq: () => 1 })
  dispatch(sup, { dir, quietS: QUIET_S }); t += 20; swapDone(sup, { ok: true, to: '12b' })
  assert.match(rows[0], /^\(swap \(@ \("from" "26b"\) \("to" "12b"\) \("by" "work-order"\) \("why" "work order wo-0001"\) \("seconds" 20\) \("ok" #t\) \("at" 1020\)\)\)\n$/)
})

// ── the engineer orders (O31): a second E4B slot, no swap ───────────────────────────────────────────────────────────────
function engineerSetup(brain, filedBy = 'desk:1') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wo-e-'))
  let t = 1000, n = 0
  const acts = []
  const host = { deadlines: { hand: 10, act: 40, beat: 5, mind: 20, hop: 50 }, now: () => t, id: () => `w${++n}`, save: () => {}, contract: () => {},
    upstream: () => {}, act: (op, args) => acts.push([op, ...args]), drive: () => {}, brainNow: () => brain }
  const sup = new Supervisor(host)
  runDeskVerb('work-order', { goal: 'fix the off-by-one in lastN and add its test', for: 'engineer', repo: 'lacuna' }, { dir, run: filedBy, now: 1, seq: () => 1 })
  return { dir, sup, acts }
}

test('with the E4B on the port, an engineer order runs at once on its second slot, with no swap', () => {
  const { dir, sup, acts } = engineerSetup('e4b')
  assert.equal(broker(sup).brain, 'e4b', 'the broker reads the brain the port holds')
  const r = dispatchEngineer(sup, { dir })
  assert.equal(r.did, 'run')
  const w = sup.workers.get(r.run)
  assert.deepEqual([w.run.role, w.tier, w.run.press], ['engineer', 'act', 'standing'])
  assert.deepEqual(acts, [], 'no swap: the engineer on duty is already loaded')
  assert.equal(dispatchEngineer(sup, { dir }).did, 'nothing', 'one engineer run at a time')
})

test('with the planner on the port, an engineer order waits and says why; it never swaps', () => {
  const { dir, sup, acts } = engineerSetup('26b')
  const r = dispatchEngineer(sup, { dir })
  assert.equal(r.did, 'nothing'); assert.match(r.why, /26b/)
  assert.equal(readOrders(dir)[0].state, 'waiting-brain')
  assert.deepEqual(acts, [])
})

test('the owner can call the planner in and send the engineer on duty back', () => {
  const { dir, sup, acts } = engineerSetup('e4b')
  assert.equal(seatChange(sup, { mind: '26b' }, { dir }).did, 'swap')
  swapDone(sup, { ok: true, to: '26b' })
  assert.equal(seatChange(sup, { mind: 'e4b' }, { dir }).did, 'swap')
  assert.deepEqual(acts, [['switch-brain', '26b'], ['switch-brain', 'e4b']])
})

// spec: work-orders.mjs runKeyOf, contract.mjs woOf; law 8 (a test never reaches the owner's surfaces) · class: L the record ·
// technique: an order filed from an eval desk run, and one filed by the owner's · method: the run's key and the order number read
// back · sre: can a test's work order end as a notice on the owner's desk (wave 1's integration re-run, 2026-11-01: wo-3678)?
test('an order filed from an eval session runs under an eval key; its number still reads; the owner\'s keeps its key', async () => {
  const { runKeyOf } = await import('../work-orders.mjs')
  const { woOf } = await import('../contract.mjs')
  assert.equal(runKeyOf({ id: 'wo-3678', from: 'desk:eval:wave1-integration-11:1793550937325' }), 'wo:eval:wo-3678')
  assert.equal(runKeyOf({ id: 'wo-3679', from: 'desk:console:1793550000000' }), 'wo:wo-3679')
  assert.equal(runKeyOf({ id: 'wo-3680' }), 'wo:wo-3680', 'an order with no filing run is the owner\'s')
  assert.equal(woOf('wo:eval:wo-3678'), 3678)
  assert.equal(woOf('wo:wo-3679'), 3679)
  const { dir, sup } = engineerSetup('e4b', 'desk:eval:probe:1')
  const r = dispatchEngineer(sup, { dir })
  assert.equal(r.did, 'run')
  assert.match(sup.workers.get(r.run).run.key, /^wo:eval:wo-/, 'the run itself carries the mark the wake reads')
})


// spec: finale make-it-right E14 §5 row 18; minds-15 ("a compliance test: a run whose only green test is the one it
// named does not pass") · class: L (law 6: pass only by the done-check) · technique: the done-check over the run's
// own records · sre: can a coder run pass on a test the mind chose, or on tests that failed?
test('a coder run passes only on the repository\'s suites, green, and a commit; a test it named never decides', () => {
  const w = (testRun, commit = { exit: 0, status: 0 }) => ({ contract: { done_check: DONE },
    run: { results: [{ n: 1, tool: 'test-run', value: testRun }, { n: 2, tool: 'git-commit', value: commit }] } })
  const suites = [{ name: 'node', status: 0, fail: 0 }]
  const suite = { exit: 0, status: 0, rows: { scope: 'suite', source: 'run', suites } }
  assert.equal(doneCheck(w(suite)).pass, true)
  const ci = { ...suite, rows: { scope: 'suite', source: 'ci', green: true } }
  assert.equal(doneCheck(w(ci)).pass, true, 'the CI\'s verdict')
  for (const scope of ['named', 'package', 'folder']) {
    const step = { exit: 0, status: 0, rows: { scope, pass: 1, fail: 0 } }
    assert.equal(doneCheck(w(step)).pass, false, `${scope}: a step's check`)
  }
  assert.equal(doneCheck(w({ ...suite, status: 1 })).pass, false, 'it ran and failed: exit 0 says only that it ran')
  assert.equal(doneCheck(w({ exit: 12, status: null, rule: 'ci-only' })).pass, false)
  assert.equal(doneCheck(w(suite, { exit: 30, status: 1 })).pass, false, 'no commit')
  const words = coderGoal({ id: 'wo-1', goal: 'g', repo: 'lacuna' })
  assert.match(words, /The run's done is the repository's own suites for what you changed: test-run with suite: true/)
})
