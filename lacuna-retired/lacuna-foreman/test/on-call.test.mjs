// on-call.test.mjs — THE ON-CALL LOOP RUNS (E14 §5 row 11). Owns: the proofs that the foreman's hush neither refuses nor skips
// a mindless watch cart while it still holds back other work (cart.mjs onCall; supervisor.mjs spawn and _polite); that a cart's
// stall budget is the header's step deadline or twice its own tick (cart-sentry.mjs stepBudget); that `work-order` files the
// desk's record and files nothing on a host with no desk folder (verbs.mjs); and that a hand's step names the road that reads
// it. Refuses: the live world (scratch desks under /private/tmp/lacuna-unit; a mock host).
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Supervisor } from '../supervisor.mjs'
import { onCall } from '../cart.mjs'
import { cartSweep, stepBudget, STEP_S } from '../cart-sentry.mjs'

mkdirSync('/private/tmp/lacuna-unit', { recursive: true })
const CART = (name, tier, body, verbs = '(on every hand report)') => `(lacuna-cart '${name} '((does . "watches ${name}") (done . "a standing cart")
  (agent . ((tier . ${tier}) (verbs . ${verbs})))))
${body}`
function host(o = {}) {
  let t = 1_793_000_000
  let n = 0
  const up = []
  return { up, now: () => t, tick: (s) => { t += s }, id: () => `w${++n}`, save: () => {}, upstream: (kind, w, data) => up.push({ kind, data }), ...o }
}

// spec: E14 §5 row 11 (sre-07: the watchdog sweep skipped every tick while the foreman was hushed, `hushed: the box's load is
//       14.4` at 18:09:36Z and no `calm again` for hours; its last hand 18:09:30Z)
// class: J a guard that silences the alarm it protects · technique: a host whose manners() hushes the foreman
// method: a mindless watch cart spawns and its tick is not skipped; an act cart is refused at spawn and a running one is
//         skipped (red before: every cart refused and skipped) · sre: do the watchdogs still run when the box is loaded?
test('the hush holds back work but never the on-call loop: a mindless watch cart spawns and ticks while the foreman is hushed', () => {
  let hushed = null
  const h = host({ manners: () => hushed })
  const s = new Supervisor(h)
  const act = s.spawn({ name: 'mover', program: CART('mover', 'act', "(every 600 (lambda () (report 'tick 1)))", '(on every report act)') })
  hushed = "the box's load is 14.4"
  const sweep = s.spawn({ name: 'sweep', program: CART('sweep', 'watch', "(every 300 (lambda () (hand 'box-watchdogs)))") })
  assert.equal(sweep.state, 'running')
  assert.equal(s._polite(sweep), false, 'the sweep ticks under the hush')
  assert.equal(s._polite(act), true, 'an act cart waits for calm')
  assert.equal(act.skipWhy, "the foreman is hushed: the box's load is 14.4")
  assert.throws(() => s.spawn({ name: 'mover2', program: CART('mover2', 'act', '', '(on report act)') }), /not now — the foreman is hushed/)
  assert.equal(onCall({ tier: 'watch', minds: { label: { job: 'signal->label' } } }), false, 'a cart that holds a mind is not the on-call loop')
})

// spec: E14 §5 row 11 (records-06: a standing cart has no stall budget; the cart sentry held an hourly cart to 600 s, 482
//       would-stop rows for forge-tender) · class: J a budget that is not the cart's own clock · technique: carts with 3,600 s
//       and 60 s ticks and a header step deadline · method: twice the tick, the header's when named, never under STEP_S; an
//       hourly cart quiet 90 min is not kicked, quiet 2 h and more it is, and the why names the budget · sre: does a red on
//       a slow cart mean it stopped, or only that it is slow by design?
test('a cart\'s stall budget is its header\'s step deadline, else twice its own tick, and the sentry holds it to that', () => {
  const h = host()
  const s = new Supervisor(h)
  const hourly = s.spawn({ name: 'hourly', program: CART('hourly', 'watch', "(every 3600 (lambda () (hand 'forge-runs)))") })
  const minute = s.spawn({ name: 'minute', program: CART('minute', 'watch', "(every 60 (lambda () (hand 'queue)))") })
  assert.deepEqual(stepBudget(hourly), { limit: 7200, said: 'twice its 3600 s tick' })
  assert.deepEqual(stepBudget(minute), { limit: STEP_S, said: 'the default' })
  assert.deepEqual(stepBudget({ cart: { deadlines: { step: 691200 } }, timers: [] }), { limit: 691200, said: 'the header names it' })
  h.tick(5400)
  const quiet = cartSweep(s, { shadow: true }).filter((v) => v.check === 'no-progress')
  assert.deepEqual(quiet.map((v) => v.cart), ['minute'], 'the hourly cart is not stalled at 90 min')
  h.tick(1900)
  const late = cartSweep(s, { shadow: true }).filter((v) => v.check === 'no-progress' && v.cart === 'hourly')
  assert.equal(late.length, 1)
  assert.match(late[0].why, /\(the step deadline is 7200 s: twice its 3600 s tick\)$/)
})

// spec: E14 §5 row 11 (a red past 3 h files work) · class: E a write to the owner's queue from a test · technique: hosts with
// and without a desk folder; the hand road named by the host · method: the order is the desk's record, for the judge, with
// its id answered; no desk folder, #f and nothing written; the step says who reads the hand · sre: does the loop's work land
// where the minds read it, and never in the owner's queue from a test?
test('work-order files the desk\'s record, or nothing on a host with no desk folder; a hand\'s step names its road', () => {
  const desk = mkdtempSync('/private/tmp/lacuna-unit/on-call-desk-')
  const h = host({ deskDir: () => desk, handRoad: () => 'the executor' })
  const s = new Supervisor(h)
  const w = s.spawn({ name: 'filer', program: CART('filer', 'watch', `(define id (work-order "Diagnose the watchdog box.disk.free.01: red for 3 h" 'judge))
(report 'filed id)
(hand 'box-watchdogs)`, '(on every hand report work-order)') })
  const files = readdirSync(join(desk, 'work-orders'))
  assert.equal(files.length, 1)
  const text = readFileSync(join(desk, 'work-orders', files[0]), 'utf8')
  assert.match(text, /^\(work-order /)
  assert.match(text, /\(for "judge"\)/)
  assert.match(text, /Diagnose the watchdog box\.disk\.free\.01: red for 3 h/)
  assert.equal(w.reports.find((r) => r.kind === 'filed').data[0], files[0].replace(/\.slat$/, ''))
  assert.match(w.cart.steps.find((x) => x.name === 'hand box-watchdogs').why, /^asked the executor to read box-watchdogs/)
  const bare = new Supervisor(host())
  const v = bare.spawn({ name: 'filer', program: CART('filer', 'watch', `(report 'filed (work-order "x y z" 'judge))`, '(on report work-order)') })
  assert.equal(v.reports.find((r) => r.kind === 'filed').data[0], false)
  assert.match(JSON.stringify(v.thoughts), /no work order: this foreman names no desk folder/)
})
