// cart-done-check.test.mjs — A CART'S DONE-CHECK FORM (K1.12; review B-19, Q-S4; law 6). Owns: the proofs that a cart whose
// header carries a done-check form closes `pass` (exit 0) on its (done …) when the form holds, and `fail` with the form's
// answer when it does not; that the form judges the contract's own record (`steps`, `answer`); that a cart with a done-check in
// words, or none, closes `stopped` (exit 0) with "nothing was checked", never `pass` and never the false `fail` the stop path
// wrote for every clean cart end before (93 rows). Refuses: a mock of cart.mjs or the evaluator; the carts run on a Supervisor.
import test from 'node:test'
import assert from 'node:assert/strict'
import { Supervisor } from '../supervisor.mjs'

function host() {
  let t = 1000, n = 0
  const h = { up: [], texts: [], rows: [], tick: (s) => { t += s }, now: () => t, id: () => `w${++n}`, save: () => {},
    deadlines: { hand: 10, act: 40, beat: 5, mind: 20, hop: 50 }, upstream: (kind, w, data) => h.up.push({ kind, name: w.name, data }),
    contract: (w, text) => h.texts.push(text), mail: () => {}, mailCount: () => {}, ledger: (text) => h.rows.push(text) }
  return h
}
const cart = (contract, said = 'counted once') => `(lacuna-cart 'tally
  '((does . "counts once and says so")
    (agent . ((tier . watch) (verbs . (on report done))))${contract ? `\n    (contract . ((goal . "one count") (done-check . ${JSON.stringify(contract)})))` : ''}
    (done . "counted once")))
(define (start) (report "one count") (done ${JSON.stringify(said)}))`
async function closed(program) {
  const h = host(); const s = new Supervisor(h)
  const w = s.spawn({ name: 'tally', program })
  await new Promise((r) => setTimeout(r, 5))
  return { w, c: w.contract, h }
}

// spec: K1.12's gate "a cart with a true done-check passes" · class: E · method: the contract's exit, outcome and state
test('a cart whose done-check form holds closes pass on exit 0; the form judges its said', async () => {
  const { c } = await closed(cart('(string? answer)'))
  assert.deepEqual([c.exit, c.outcome, c.state, c.why], [0, 'pass', 'done', null])
})

// spec: law 6 (a pass only by the done-check) · class: E · technique: a false form · method: fail with the form's answer named
test('a cart whose done-check form does not hold closes fail on exit 0, its why naming the form and its answer', async () => {
  const { c } = await closed(cart('(equal? answer "something else")'))
  assert.deepEqual([c.exit, c.outcome, c.state], [0, 'fail', 'failed'])
  assert.match(c.why, /^done-check: \(equal\? answer "something else"\) answered false/)
})

// spec: K1.12 "the form judges the contract's own record" · class: E · method: a form over the steps the cart left
test('a done-check form reads the cart\'s own steps: the load and the done rows are there when it judges', async () => {
  const { w, c } = await closed(cart('(> (length steps) 1)'))
  assert.equal(c.outcome, 'pass')
  assert.ok(w.cart.steps.some((x) => x.name === 'done' && x.why === 'counted once'), "the done row is on the cart's record when it judges")
  const none = await closed(cart('(> (length steps) 99)'))
  assert.equal(none.c.outcome, 'fail')
})

// spec: K1.12's gate "without one it closes … with why" (B-19: the 93 false fails) · class: E · technique: words, and no contract
test('a cart with a done-check in words, or none, closes stopped on exit 0 and says nothing was checked; never fail, never pass', async () => {
  const words = await closed(cart('the count is one'))
  assert.deepEqual([words.c.exit, words.c.outcome, words.c.state], [0, 'stopped', 'done'])
  assert.match(words.c.why, /the done-check is words, not a form: nothing was checked/)
  const none = await closed(cart(null))
  assert.deepEqual([none.c.exit, none.c.outcome], [0, 'stopped'])
  assert.match(none.c.why, /nothing was checked/)
  assert.ok(!none.h.texts.some((t) => /\(outcome "fail"\)/.test(t)), 'no false fail on the record')
})
