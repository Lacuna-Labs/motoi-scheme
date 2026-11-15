// K3 — the 3.0 header (design §12.1): version restart deadlines contract sentry states intensity foreman author hands;
// judgment as an alist with ask-owner as the bare default; the four new job classes; a cart's contract and its step text.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readCart, JOB_CLASSES } from '../cart.mjs'
import { Supervisor } from '../supervisor.mjs'
import { renderContract, readContract } from '../contract.mjs'

const CART = (extra = '', verbs = 'on report need-brain') => `(lacuna-cart 'probe
  '((does . "reads one thing") (done . "one pass")
    (agent . ((tier . watch) (verbs . (${verbs}))))
    ${extra}))
(on 'tick (lambda (x) (report 'step "read the log")))`

test('the 3.0 fields read with their defaults', () => {
  const h = readCart(CART())
  assert.deepEqual([h.version, h.restart, h.deadlines, h.contract, h.sentry, h.states, h.intensity, h.foreman, h.author, h.hands],
                   [null, 'permanent', {}, null, [], [], [3, 300], null, 'claude', []])
})

test('the 3.0 fields read as written, and a wrong one is one sentence', () => {
  const h = readCart(CART(`(version . 2) (restart . transient) (deadlines . ((hand . 60) (mind . 30))) (intensity . (5 120))
    (contract . ((goal . "the log is read") (done-check . "(> lines 0)"))) (sentry . (error warning)) (states . (serving)) (foreman . "studio")
    (author . 26b) (hands . (jobs disk))`))
  assert.equal(h.version, '2'); assert.equal(h.restart, 'transient'); assert.deepEqual(h.deadlines, { hand: 60, mind: 30 })
  assert.deepEqual(h.intensity, [5, 120]); assert.deepEqual(h.contract, { goal: 'the log is read', done_check: '(> lines 0)' })
  assert.deepEqual(h.sentry, ['error', 'warning']); assert.deepEqual(h.states, ['serving']); assert.equal(h.foreman, 'studio')
  assert.equal(h.author, '26b'); assert.deepEqual(h.hands, ['jobs', 'disk'])
  assert.throws(() => readCart(CART('(restart . always)')), /restart is one of permanent transient temporary/)
  assert.throws(() => readCart(CART('(author . gemini)')), /author is one of/)
  assert.throws(() => readCart(CART('(intensity . (3))')), /\(intensity N SECONDS\)/)
  assert.throws(() => readCart(CART('(deadlines . ((hand . 0)))')), /seconds > 0/)
})

test('judgment is an alist; a bare name falls back to ask-owner (F-09); a wrong fallback is refused', () => {
  const h = readCart(CART(`(judgment . ((new-thing . skip) stale))`))
  assert.deepEqual(h.judgment, ['new-thing', 'stale']); assert.deepEqual(h.judgmentFallback, { 'new-thing': 'skip', stale: 'ask-owner' })
  assert.deepEqual(readCart(CART(`(judgment . (stale))`)).judgmentFallback, { stale: 'ask-owner' })
  assert.throws(() => readCart(CART(`(judgment . ((stale . guess)))`)), /falls back to guess/)
})

test('the four new job classes are known; an unknown one still names the list', () => {
  for (const c of ['condense', 'yes-no', 'pick', 'nearness']) assert.equal(JOB_CLASSES[c], c)
  const h = readCart(CART(`(minds . ((short . ((job . condense) (labels . (a b))))))`, 'on report mind'))
  assert.equal(h.minds.short.job, 'condense')
  assert.throws(() => readCart(CART(`(minds . ((x . ((job . guess)))))`, 'on report mind')), /yes-no/)
})

test('a cart holds a contract it never writes: (report \'step …) is the step text, running, never done', () => {
  let t = 1000; const texts = []
  const s = new Supervisor({ now: () => t, id: () => 'wc', save: () => {}, upstream: () => {}, contract: (w, x) => texts.push(x) })
  const w = s.spawn({ name: 'probe', program: CART() })
  assert.equal(w.contract.cart, 'probe'); assert.equal(w.contract.goal, 'reads one thing')
  s.send(w.id, 'tick', 0)
  const c = readContract(renderContract(w.contract))
  assert.deepEqual(c.steps.at(-1), { n: 1, status: 'running', text: 'read the log', ticket: null })
  assert.equal(c.state, 'running')
  assert.equal(c.steps.filter((x) => x.status === 'done').length, 0, 'no report makes a step done (F-12)')
})

test('sentry reads as written: none, names, or the alist plan', () => {
  assert.deepEqual(readCart(CART('(sentry . ())')).sentry, [])
  assert.deepEqual(readCart(CART('(sentry . (error warning))')).sentry, ['error', 'warning'])
  assert.deepEqual(readCart(CART('(sentry . ((cart . x) (watch . (log fs)) (gates . #f)))')).sentry, { cart: 'x', watch: ['log', 'fs'], gates: false })
})

test("F-09: a judgment the brain never answers falls back as the header says — skip answers #f, ask-owner goes up, stop stops", () => {
  const CARTJ = (fb) => `(lacuna-cart 'judge '((does . "d") (done . "e") (agent . ((tier . watch) (verbs . (on need-brain remember)))) (judgment . ((stale . ${fb})))))
(on 'go (lambda (x) (need-brain 'stale "is it stale?" 1)))
(on 'brain (lambda (r) (remember 'by (get r 'by)) (remember 'answer (get r 'answer))))`
  const mk = () => { let t = 1000; const up = []; const h = { up, tick: (s) => { t += s }, deadlines: { hand: 10, act: 40, beat: 5, mind: 20 }, now: () => t, id: () => 'wj' + Math.random().toString(36).slice(2, 6), save: () => {}, upstream: (k, w, d) => up.push({ k, d }) }; return { h, s: new Supervisor(h) } }
  const a = mk(); const wa = a.s.spawn({ name: 'j', program: CARTJ('skip') }); a.s.send(wa.id, 'go', 0)
  assert.equal(wa.pending[0].kind, 'brain'); assert.equal(a.h.up.at(-1).d.fallback, 'skip')
  a.h.tick(21); a.s.sweep()
  assert.equal(wa.kv.by, 'fallback'); assert.equal(wa.kv.answer, false); assert.equal(wa.pending.length, 0); assert.equal(wa.state, 'running')
  const b = mk(); const wb = b.s.spawn({ name: 'j', program: CARTJ('ask-owner') }); b.s.send(wb.id, 'go', 0); b.h.tick(21); b.s.sweep()
  assert.ok(b.h.up.some((u) => u.k === 'ask' && u.d.topic === 'stale'))
  const c = mk(); const wc = c.s.spawn({ name: 'j', program: CARTJ('stop') }); c.s.send(wc.id, 'go', 0); c.h.tick(21); c.s.sweep()
  assert.equal(wc.state, 'retired'); assert.match(wc.last, /fallback is stop/)
  const d = mk(); const wd = d.s.spawn({ name: 'j', program: CARTJ('skip') }); d.s.send(wd.id, 'go', 0)
  d.s.send(wd.id, 'brain', { ticket: wd.pending[0].ticket, by: 'brain', answer: 'yes' }); assert.equal(wd.pending.length, 0, 'the brain answered: ticket closed'); assert.equal(wd.kv.by, 'brain')
})
