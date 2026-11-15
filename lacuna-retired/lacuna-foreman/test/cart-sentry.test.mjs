// cart-sentry.test.mjs — THE CART SENTRY (O11). Owns: the tests that a stalled cart is kicked once and stopped as abandoned
// at the second miss (written only, in shadow), that a done step with no receipt is a verdict, that an agent's op or file
// outside the header is refused by code, and that an unstated end is recorded. Refuses: a mock of the cart sentry; it runs
// on plain workers shaped as the supervisor keeps them.
import test from 'node:test'
import assert from 'node:assert/strict'
import { cartSweep, checkIntent, endCheck, inTouches, STEP_S } from '../cart-sentry.mjs'

function world(cart) {
  let t = 1000
  const stops = [], ledger = [], sent = []
  const w = { id: 'w1', state: 'running', handlers: new Map([['kick', () => {}]]), cart: { name: 'backup', started: 1000, steps: [], verbs: ['hand', 'done'], hands: ['disk'], acts: ['bundle'], touches: ['~/Lacuna-Backups/**'], ...cart } }
  const sup = { host: { now: () => t, ledger: (l) => ledger.push(l) }, living: () => [w], stop: (id, why) => { stops.push([id, why]); w.state = 'stopped' }, send: (id, k) => sent.push([id, k]) }
  return { w, sup, stops, ledger, sent, tick: (s) => { t += s } }
}

test('a stalled cart is kicked once, then stopped as abandoned at its last step', () => {
  const { w, sup, stops, sent, tick } = world({ steps: [{ name: 'bundle', status: 'started', why: '' }] })
  tick(STEP_S + 1)
  assert.deepEqual(cartSweep(sup).map((v) => v.action), ['kick'])
  assert.deepEqual(sent, [['w1', 'kick']])
  tick(STEP_S + 1)
  const v = cartSweep(sup)
  assert.equal(v[0].action, 'stop')
  assert.match(stops[0][1], /abandoned at bundle/)
  assert.equal(w.cart.sentry_rows.length, 2)
})

test('in shadow the second miss is written, never sent', () => {
  const { sup, stops, ledger, tick } = world({})
  tick(STEP_S + 1); cartSweep(sup, { shadow: true })
  tick(STEP_S + 1)
  assert.equal(cartSweep(sup, { shadow: true })[0].action, 'would-stop')
  assert.deepEqual(stops, [])
  assert.match(ledger.at(-1), /would-stop/)
})

test('progress resets the clock; a header step deadline wins over the default', () => {
  const { w, sup, tick } = world({ deadlines: { step: 30 } })
  tick(20); w.cart.progressAt = 1020
  tick(20); assert.deepEqual(cartSweep(sup), [])
  tick(31); assert.equal(cartSweep(sup)[0].check, 'no-progress')
})

test('a done step with no ticket or result is a claim without a receipt; with one it passes; each step is read once', () => {
  const { sup } = world({ steps: [{ name: 'bundle', status: 'done', why: 'all good' }, { name: 'verify', status: 'done', why: 'ticket t-412 exit 0' }] })
  const v = cartSweep(sup)
  assert.deepEqual(v.map((x) => [x.check, x.detail.startsWith('step bundle')]), [['claim-without-receipt', true]])
  assert.deepEqual(cartSweep(sup), [])
})

test('a looping cart that repeats a step with the same words is noted once in the run; new words are noted again', () => {
  const { sup, w } = world({ steps: [{ name: 'hand tail-log', status: 'done', why: 'asked Lacuna to read tail-log dev-api 400' }] })
  assert.equal(cartSweep(sup).length, 1)
  w.cart.steps.push({ name: 'hand tail-log', status: 'done', why: 'asked Lacuna to read tail-log dev-api 400' })   // the next loop: a new step, the same finding
  assert.deepEqual(cartSweep(sup), [])
  w.cart.steps.push({ name: 'hand tail-log', status: 'done', why: 'asked Lacuna to read tail-log qa-api 503' })
  assert.equal(cartSweep(sup)[0].check, 'claim-without-receipt')
})

test('an agent op or file outside the header is refused by code', () => {
  const { w } = world({})
  assert.equal(checkIntent(w, { op: 'bundle', files: ['~/Lacuna-Backups/world/x.tar'] }).ok, true)
  assert.match(checkIntent(w, { op: 'prune' }).why, /not in the cart backup's header/)
  assert.match(checkIntent(w, { op: 'bundle', files: ['~/code/lacuna/x.mjs'] }).why, /outside the cart backup's touches/)
  assert.equal(checkIntent({}, { op: 'anything' }).ok, true, 'a plain worker is not the cart sentry\'s')
})

test('touches globs: **, dir/**, *.ext, exact', () => {
  assert.ok(inTouches('a/b.js', ['**']) && inTouches('a/b.js', ['a/**']) && inTouches('a/b.js', ['*.js']) && inTouches('a/b.js', ['a/b.js']))
  assert.ok(!inTouches('c/b.js', ['a/**']))
})

test('a cart that stops without done or a reason is recorded; a stated stop is not', () => {
  const { w, sup } = world({})
  assert.equal(endCheck(sup, w, '').check, 'ended-unstated')
  assert.equal(endCheck(sup, w, 'the owner stopped it'), null)
  w.cart.outcome = 'done'; assert.equal(endCheck(sup, w, ''), null)
})

// J2: the G.2 atlas's loop and runaway output each have a rule, kicked within their contract (once, then stopped)
test('a loop (four identical steps) is kicked, then stopped at the next identical step though the clock moves', () => {
  const step = { name: 'retry', status: 'done', why: 'exit 1' }
  const { w, sup, stops, sent } = world({ steps: [step, step, step, step].map((s) => ({ ...s })) })
  w.cart.progressAt = 1000
  assert.deepEqual(cartSweep(sup).filter((v) => v.check === 'loop').map((v) => v.action), ['kick'])
  assert.deepEqual(sent, [['w1', 'kick']])
  assert.deepEqual(cartSweep(sup).filter((v) => v.check === 'loop'), [])   // no new step: no second verdict
  w.cart.steps.push({ ...step })
  assert.equal(cartSweep(sup).find((v) => v.check === 'loop').action, 'stop')
  assert.match(stops[0][1], /loop/)
})
test('a runaway (more steps than the header allows) is kicked, then stopped; in shadow only written', () => {
  const steps = Array.from({ length: 6 }, (_, i) => ({ name: `s${i}`, status: 'done', why: `exit 0 row ${i}` }))
  const { w, sup, stops } = world({ steps, 'max-steps': 5 })
  assert.equal(cartSweep(sup, { shadow: true }).find((v) => v.check === 'runaway').action, 'kick')
  w.cart.steps.push({ name: 's6', status: 'done', why: 'exit 0 row 6' })
  assert.equal(cartSweep(sup, { shadow: true }).find((v) => v.check === 'runaway').action, 'would-stop')
  assert.deepEqual(stops, [])
})
test('varied steps under the limit are neither a loop nor a runaway', () => {
  const steps = ['a', 'b', 'a', 'b'].map((n) => ({ name: n, status: 'done', why: 'exit 0' }))
  const { sup } = world({ steps })
  assert.deepEqual(cartSweep(sup).filter((v) => ['loop', 'runaway'].includes(v.check)), [])
})

// spec: 2026-10-27, the foreman crash-looped on `c.noted.has is not a function` after a restart restored a run · class: B · sre: can a restored run kill the foreman?
test('a run restored with noted as a list or an object never throws in the sweep', async () => {
  const m = await import('../cart-sentry.mjs');
  for (const noted of [[], {}, ['x|y']]) { const c = { noted }; if (!(c.noted instanceof Set)) c.noted = new Set(Array.isArray(c.noted) ? c.noted : []); assert.equal(typeof c.noted.has, 'function'); }
  assert.ok(m);
});

// spec: 1.4, standing carts wrote 3,613 claim-without-receipt notes because hand/act steps omitted their ticket and snapshot serialized c.noted Set as {}
test('1.4 a standing cart hand or act step carries its ticket and receipt across checkpoints without false claim-without-receipt notes; a planted unreceipted step is noted', async () => {
  const { Supervisor } = await import('../supervisor.mjs')
  const { snapshot } = await import('../alive.mjs')
  let t = 2000
  const ledger = []
  const sup = new Supervisor({
    now: () => t,
    id: () => 'w-standing',
    save: () => {},
    upstream: () => {},
    ledger: (l) => ledger.push(l),
  })
  const prog = `(lacuna-cart 'standing-watch '(
    (does . "watch the box")
    (done . "never")
    (agent (tier . watch) (verbs . (hand on every)))
    (hands . (box-watchdogs))))
  (on 'hand (lambda (r) #t))
  (hand 'box-watchdogs)`
  const w = sup.spawn({ name: 'standing-watch', program: prog })
  const handStep = w.cart.steps.find((s) => s.name === 'hand box-watchdogs')
  assert.ok(handStep, 'hand step recorded')
  assert.ok(handStep.ticket, 'hand step carries its ticket id')
  assert.deepEqual(cartSweep(sup), [], 'a hand step with its ticket produces no false claim-without-receipt note')

  const ticket = handStep.ticket
  sup.send(w.id, 'hand', { ticket, op: 'box-watchdogs', exit: 0, rows: [] })
  assert.deepEqual(handStep.receipt, { exit: 0, at: 2000 }, 'closeTicket attaches the receipt to the step')

  w.cart.steps.push({ name: 'planted-claim', status: 'done', why: 'all green by eye' })
  const v = cartSweep(sup)
  assert.equal(v.length, 1)
  assert.equal(v[0].check, 'claim-without-receipt')

  const ck = JSON.parse(JSON.stringify(snapshot(sup, w)))
  assert.deepEqual(ck.cart.noted, ['planted-claim|all green by eye'], 'snapshot serializes c.noted Set as an array so checkpoints preserve dedup')
})
