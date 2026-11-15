// alive-tickets.test.mjs — U1 unit tests for `alive.mjs` tickets and deadlines: every hand, act and brain question is a
// ticket with a deadline; a reply clears exactly its own ticket; a deadline re-sends a read once, never an act.
// owns: freshTicket, adoptTicket, closeTicket and the deadline rule (re-send, *-timeout, F-01 stop, the brain's fallback).
// refuses: to mock alive.mjs; every test drives a real Supervisor on a fake clock (makeSup) and reads the record.
// implements: design §6 change 2(f) (deadlines; `idem`), change 5 (an issued act is followed, never reissued), §9 (a
//   press ticket has no deadline), §17 (15); eng §3.3 ticket fields, §3.5 (hand 120 s, act 600 s, mind 360 s).
// invariants: "If a promise is open past its deadline, then a kick was sent"; "If an act ran, a press ticket preceded it"
//   (an act is never re-sent); "If a step is done, then a ticket closed it".
// faults: F-01 (a hand overran its deadline), F-08 (an act waits on the press), F-09 (the brain's fallback answered).
// coverage: alive.mjs — see alive.test.mjs (the four alive*.test.mjs files together)
import test from 'node:test'
import assert from 'node:assert/strict'
import { freshTicket } from '../alive.mjs'
import { makeSup, DEADLINES } from '../../../test/conformance/fake-host.mjs'

const cart = (name, extra, body) => `(lacuna-cart '${name} '((does . "does a thing") (done . "did it") ${extra}))
${body}`
const ups = (h, kind) => h.up.filter((u) => u.kind === kind)

// spec: eng §3.3 (ticket ids) · design §6 change 2(d) (opens a ticket)
// class: E10 a duplicate message (two hands asked in one millisecond)
// technique: boundary: the same base id twice, three times, and once already held in `was`
// method: call freshTicket on workers holding colliding tickets; then spawn a worker that asks two hands at load on a
//         frozen clock and read the two `hand` rows upstream: two different tickets
// sre: if a cart asks two reads in the same millisecond, do the answers land on the right tickets?
test('two tickets asked in one millisecond never share an id, nor reuse one a re-send replaced', () => {
  assert.equal(freshTicket({}, 'w1-5'), 'w1-5')
  assert.equal(freshTicket({ pending: [{ ticket: 'w1-5' }, { ticket: 'w1-5.1' }] }, 'w1-5'), 'w1-5.2')
  assert.equal(freshTicket({ pending: [{ ticket: 'w1-5.r1', was: ['w1-5'] }] }, 'w1-5'), 'w1-5.1')
  const { h, s } = makeSup()
  s.spawn({ name: 'twice', program: `(hand 'jobs) (hand 'jobs) (on 'hand (lambda (r) #t))` })
  const [a, b] = ups(h, 'hand').map((u) => u.data.ticket)
  assert.ok(a && b && a !== b, `${a} ≠ ${b}`)
})

// spec: design §6 change 2(f) (on result: the step of THAT ticket) · I "if a step is done, a ticket closed it" · eng §3.3
// class: E10 a duplicate message (the same reply delivered twice)
// technique: fault injection: the hands' reply to the first of two same-op tickets arrives twice
// method: a worker asks (hand 'jobs) twice; deliver ticket A's reply twice; read the pending list (B must remain, with its
//         deadline), then pass B's deadline and read the re-send row upstream naming B
// sre: if the socket replays a reply, does it silently close a different read, so its deadline never fires?
test('a duplicate reply clears nothing: the other ticket of the same op stays pending and keeps its deadline', () => {
  const { h, s } = makeSup()
  const w = s.spawn({ name: 'twice', program: `(on 'go (lambda (x) (hand 'jobs) (hand 'jobs))) (on 'hand (lambda (r) (report 'got (get r 'ticket))))` })
  s.send(w.id, 'go', 1)
  const [a, b] = w.pending.map((t) => t.ticket)
  s.send(w.id, 'hand', { ticket: a, op: 'jobs', ok: true })
  s.send(w.id, 'hand', { ticket: a, op: 'jobs', ok: true })
  assert.deepEqual(w.pending.map((t) => t.ticket), [b], 'B is still watched')
  h.tick(DEADLINES.hand + 1); s.sweep()
  assert.equal(ups(h, 'hand').at(-1).data.retry_of, b, 'B is re-sent once at its deadline')
})

// spec: design §6 change 2(f) · §9 (a press's answer carries the op only) · eng §3.3
// class: J7 JSON.parse on hostile input (a reply in a shape the sender did not promise)
// technique: state walk over reply shapes: no ticket + op, op as a symbol, an array, nothing at all, a stale ticket
// method: open three hand tickets; deliver each shape; read which ticket left pending after each; deliver a reply to a
//         worker with nothing pending and read that the handler still ran
// sre: if the hands answer in an old shape, does the right ticket close, and does a stranger's reply close none?
test('a reply closes by its ticket, else the oldest of its op, else the oldest of its kind; a stale ticket closes none', async () => {
  const { symOf } = await import('../scheme.mjs')
  const { s } = makeSup()
  const w = s.spawn({ name: 'reader', program: `(on 'go (lambda (x) (hand 'jobs) (hand 'disk) (hand 'jobs) (hand 'disk)))
(on 'hand (lambda (r) (remember 'n (+ 1 (recall 'n 0)))))` })
  s.send(w.id, 'go', 1)
  const [j1, d1, j2, d2] = w.pending.map((t) => t.ticket)
  s.send(w.id, 'hand', { op: 'disk', ok: true })
  assert.deepEqual(w.pending.map((t) => t.ticket), [j1, j2, d2], 'no ticket: the oldest of its op')
  s.send(w.id, 'hand', { op: symOf('jobs'), ok: true })
  assert.deepEqual(w.pending.map((t) => t.ticket), [j2, d2], 'an op as a symbol reads by name')
  s.send(w.id, 'hand', ['not', 'an', 'object'])
  assert.deepEqual(w.pending.map((t) => t.ticket), [d2], 'no shape at all: the oldest of its kind')
  s.send(w.id, 'hand', { ticket: 'gone-1', ok: true })
  assert.deepEqual(w.pending.map((t) => t.ticket), [d2], 'a ticket nobody holds closes nothing')
  s.send(w.id, 'hand', { ticket: d2, ok: true })
  s.send(w.id, 'hand', { ticket: d2, ok: true })
  assert.equal(w.pending.length, 0)
  assert.equal(w.kv.n, 6, 'every reply still reached the handler')
})

// spec: design §6 change 5 (an act is never re-sent) · law 4 · §17 15 · F-01 · eng §3.5 act 600 s (40 s here)
// class: E8 a deadline passed
// technique: time travel past an act's deadline, with and without an act-timeout handler
// method: a cart asks (act 'pass); pass the deadline; read upstream (one `act` row only), the handler's event (tries 1);
//         a second cart without the handler is stopped "never answered (F-01)" and its contract says exit 15
// sre: if an act's reply is lost, could the foreman merge twice? It must never re-send an act; it says so instead.
test('an act past its deadline is never re-sent: the cart hears act-timeout, or is stopped with exit 15', () => {
  const { h, s } = makeSup()
  const body = `(define (start) (act 'pass))`
  const a = s.spawn({ name: 'patient', tier: 'act', program: cart('patient', `(agent . ((tier . act) (verbs . (on act report remember every)))) (acts . (pass))`,
    `${body} (on 'act (lambda (r) #t)) (on 'act-timeout (lambda (x) (remember 'tries (get x 'tries)) (every 60 (lambda () #t))))`) })
  const b = s.spawn({ name: 'plain', tier: 'act', program: cart('plain', `(agent . ((tier . act) (verbs . (on act report)))) (acts . (pass))`,
    `${body} (on 'act (lambda (r) #t))`) })
  h.tick(DEADLINES.act + 1); s.sweep()
  assert.equal(ups(h, 'act').length, 2, 'one act each, never a second')
  assert.equal(a.state, 'running'); assert.equal(a.kv.tries, 1); assert.equal(a.pending.length, 0)
  assert.equal(b.state, 'retired'); assert.equal(b.last, 'stopped: pass never answered (F-01)')
  assert.deepEqual([b.contract.exit, b.contract.outcome], [15, 'fail'])
})

// spec: design §12 (judgment alist; F-09 fallback) · eng §3.5 mind 360 s (20 s here) · F-09
// class: E8 a deadline passed (the brain's)
// technique: state walk over the three fallbacks: stop, skip, ask-owner; with and without (on 'brain …)
// method: carts whose judgment points fall back to stop and to skip ask the brain at start; a plain worker asks with no
//         header (ask-owner); a fourth has no brain handler. Pass the mind deadline, sweep, and read: the stop's `retired`
//         row, the skip's (on 'brain) answer #f, the ask-owner's `ask` upstream, and that no brain ticket is re-sent
// sre: if the 26B is down, does each cart get the answer its header promised, and only once?
test('the brain does not answer in time: stop stops, skip answers #f, ask-owner asks the owner; never re-sent', () => {
  const { h, s } = makeSup()
  const head = (pt) => `(agent . ((tier . watch) (verbs . (on report need-brain remember every)))) (judgment . ((${pt})))`
  const stopper = s.spawn({ name: 'stopper', program: cart('stopper', head('pick . stop'), `(define (start) (need-brain 'pick "which?")) (on 'brain (lambda (b) #t))`) })
  const skipper = s.spawn({ name: 'skipper', program: cart('skipper', head('pick . skip'), `(define (start) (need-brain 'pick "which?")) (on 'brain (lambda (b) (remember 'by (get b 'by)) (remember 'answer (get b 'answer 'none)) (every 60 (lambda () #t))))`) })
  const asker = s.spawn({ name: 'asker', program: `(on 'go (lambda (x) (need-brain "is the disk ok?"))) (on 'brain (lambda (b) (remember 'answer (get b 'answer 'none)) (every 60 (lambda () #t))))` })
  const mute = s.spawn({ name: 'mute', program: `(on 'go (lambda (x) (need-brain "anyone?"))) (every 60 (lambda () #t))` })
  s.send(asker.id, 'go', 1); s.send(mute.id, 'go', 1)
  assert.equal(ups(h, 'need-brain').length, 4)
  h.tick(DEADLINES.mind); s.sweep()
  assert.equal(stopper.state, 'retired'); assert.match(stopper.last, /the brain did not answer 'pick and the fallback is stop/)
  assert.deepEqual([skipper.state, skipper.kv.by.$sym ?? skipper.kv.by, skipper.kv.answer], ['running', 'fallback', false])
  assert.equal(asker.kv.answer, null, '(on \'brain) hears the fallback with no answer')
  const asks = ups(h, 'ask').map((u) => u.name)
  assert.deepEqual(asks.sort(), ['asker', 'mute'])
  assert.equal(mute.state, 'running')
  assert.equal(ups(h, 'need-brain').length, 4, 'a brain question is never re-sent')
  assert.ok(skipper.thoughts.some((t) => /the fallback skip answers/.test(t.text)))
})

// spec: design §6 change 2(f) · eng §3.5 mind 360 s · F-09
// class: E9 a message lost (here: not lost, the answer arrives inside the deadline)
// technique: time travel to one second before the mind deadline
// method: a worker asks the brain; the answer arrives as (on 'brain {ticket}) before the deadline; read the pending list
//         (empty) and, past the deadline, that no `ask` went up
// sre: if the brain is slow but on time, does the fallback stay quiet?
test('a brain answer inside its deadline closes the ticket; no fallback fires', () => {
  const { h, s } = makeSup()
  const w = s.spawn({ name: 'asker', program: `(on 'go (lambda (x) (need-brain "ok?"))) (on 'brain (lambda (b) (every 60 (lambda () #t))))` })
  s.send(w.id, 'go', 1)
  h.tick(DEADLINES.mind - 1)
  s.send(w.id, 'brain', { ticket: w.pending[0].ticket, answer: true })
  assert.equal(w.pending.length, 0)
  h.tick(10); s.sweep()
  assert.equal(ups(h, 'ask').length, 0)
})

// spec: §17 15 · F-01 · eng §3.5 hand 120 s (10 s here) · design §6 change 2
// class: E8 a deadline passed (two at once; the first stops the worker)
// technique: time travel past two re-sent hands in one sweep
// method: two hands past their second deadline in the same sweep: the first stops the worker; the second must be
//         skipped (one `retired` row, one stall reason, no checkpoint error)
// sre: if two reads time out together, do we get one clean stop, not two stops and two records?
test('two tickets past their last deadline in one sweep stop the worker once', () => {
  const { h, s } = makeSup()
  const w = s.spawn({ name: 'two', program: `(hand 'jobs) (hand 'disk) (on 'hand (lambda (r) #t))` })
  h.tick(DEADLINES.hand + 1); s.sweep()
  h.tick(DEADLINES.hand + 1); s.sweep()
  assert.equal(ups(h, 'retired').length, 1)
  assert.equal(w.last, 'stopped: jobs never answered (F-01)')
  assert.equal(w.pending.length, 1, 'the second ticket is left as it was, on a stopped worker')
})

// spec: law 4 (an act is press-gated and never re-sent) · F-08 · CARDS-2.0 §9.3 step 3 (F5, 2026-10-25)
// class: E9 a race (the owner's press lands before the hands' `waiting` reply)
// technique: event order swap: press first, then the waiting reply; and the usual order, waiting then press
// method: a cart asks (act 'forge); press its ticket while it is still `act`; deliver the hands' waiting reply; read
//         upstream: the same ticket goes to the hands again, pressed, once, and the ticket stays `act` with a deadline.
//         A second cart gets waiting first: it becomes a `press` ticket and nothing is re-sent until the press
// sre: if the press lands 9 ms after the spawn, before the hands said "waiting", is the press lost and the job dead?
test('a press that lands before the waiting reply is held for its ticket: the same ticket goes again, pressed, once', async () => {
  const { press } = await import('../intents.mjs')
  const { h, s } = makeSup()
  const prog = (name) => cart(name, `(agent . ((tier . act) (verbs . (on act report)))) (acts . (forge))`,
    `(define (start) (act 'forge "train")) (on 'act (lambda (r) #t))`)
  const early = s.spawn({ name: 'early', tier: 'act', program: prog('early') })
  const t = early.pending[0]
  assert.equal(press(s, t.ticket, 'the owner').ok, true)
  assert.equal(ups(h, 'act').filter((u) => u.data.ticket === t.ticket).length, 1, 'the press alone sends nothing: the act is in flight')
  s.send(early.id, 'act', { ticket: t.ticket, op: 'forge', waiting: 'forge waits on the owner\'s press' })
  const sent = ups(h, 'act').filter((u) => u.data.ticket === t.ticket)
  assert.equal(sent.length, 2, 'sent again once, now pressed')
  assert.deepEqual([sent[1].data.pressed, sent[1].data.pressed_by], [true, 'the owner'])
  assert.deepEqual([early.pending.length, early.pending[0].kind, early.pending[0].deadline_at > h.now()], [1, 'act', true])
  s.send(early.id, 'act', { ticket: t.ticket, op: 'forge', waiting: 'forge waits on the owner\'s press' })
  assert.equal(ups(h, 'act').filter((x) => x.data.ticket === t.ticket).length, 2, 'a waiting reply to the pressed send sends nothing: never a loop')
  assert.equal(early.pending[0].kind, 'press', 'it waits on the owner again')
  const late = s.spawn({ name: 'late', tier: 'act', program: prog('late') })
  const u = late.pending[0]
  s.send(late.id, 'act', { ticket: u.ticket, op: 'forge', waiting: 'forge waits on the owner\'s press' })
  assert.deepEqual([late.pending[0].kind, late.pending[0].deadline_at], ['press', null], 'waiting first: the press is the owner\'s')
  assert.equal(ups(h, 'act').filter((x) => x.data.ticket === u.ticket).length, 1)
  press(s, u.ticket, 'the owner')
  assert.equal(ups(h, 'act').filter((x) => x.data.ticket === u.ticket).length, 2, 'the press sends it, pressed')
})
