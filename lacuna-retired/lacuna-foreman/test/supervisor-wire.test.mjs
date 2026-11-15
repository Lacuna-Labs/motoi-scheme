// supervisor-wire.test.mjs — U1 unit tests for the supervisor's doors and clocks: the signed hop and its gate, delivery
// refusals, broadcast, the sweep interval, timer fires (every, after, while paused, while hushed, throwing), the small
// minds in flight, the dry-run trial and the description a desk reads.
// owns: the proofs that only a signed protocol message reaches a worker (every drop counted by kind), that a timer is
//   armed once and fires into the same metered path as an event, and that the trial finds what would fail first.
// refuses: to mock supervisor.mjs; timers run on node:test's mock clock (never a sleep), hops use the real gate.
// implements: design §6 (the kernel: links, timers, the sweep), §6 change 6 (one envelope, signed per hop; drops counted),
//   law 5, law 11; eng §3.1 (the envelope), §3.5 (sweep 10 s, window 120 s, everyMin 5 s).
// invariants: "If an envelope is unsigned, forged, stale, replayed or malformed, then it was dropped and /health.dropped
//   counted it."
// faults: F-10 (a message dropped at the gate), F-04 (a timer that throws crashes its worker, never the foreman).
// coverage: supervisor.mjs — see supervisor.test.mjs (the supervisor*.test.mjs files together)
import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import { makeSup } from '../../../test/conformance/fake-host.mjs'
import { describe, trial } from '../trial.mjs'
import { seal } from '../protocol.mjs'
import { interrupt } from '../talk.mjs'

const stopAll = (s) => { for (const id of s.workers.keys()) s.stop(id, 'test over') }

// spec: design §6 change 6 · law 5 · eng §3.1 (window 120 s) · F-10 · I "unsigned, forged, stale, replayed or malformed → dropped and counted"
// class: W9 the order of drops (W1 unsigned · W2 forged · W3 stale · W4 replayed · W6 a wrong `to`)
// technique: fault injection on real sealed envelopes; boundary on the window (121 s)
// method: seal one good message and deliver it (the handler runs); deliver it again (replayed); strip its signature
//         (unsigned); flip its signature (forged); seal one 121 s old (stale); deliver a good one to the wrong `to` pin;
//         read status().dropped per kind and that the handler ran exactly once
// sre: if something on the box replays or forges a hop, does it ever reach a worker? Each attempt must be counted, none run.
test('only a signed, fresh, unseen message for this worker is delivered; every other is dropped and counted by kind', () => {
  const { h, s } = makeSup()
  const w = s.spawn({ name: 'peer', program: `(on 'ping (lambda (x) (remember 'n (+ 1 (recall 'n 0)))))` })
  const good = seal(s.key, { from: 'test', to: w.id, kind: 'ping', body: 1, at: h.now() })
  assert.equal(s.deliver(good).ok, true)
  assert.equal(s.deliver(good).dropped, 'replayed')
  assert.equal(s.deliver({ slat: good.slat }).dropped, 'unsigned')
  assert.equal(s.deliver({ ...good, sig: good.sig.replace(/^./, (c) => (c === 'a' ? 'b' : 'a')) }).dropped, 'forged')
  assert.equal(s.deliver(seal(s.key, { from: 'test', to: w.id, kind: 'ping', body: 1, at: h.now() - 121 })).dropped, 'stale')
  const other = seal(s.key, { from: 'test', to: w.id, kind: 'ping', body: 1, at: h.now() })
  assert.deepEqual(s.deliver(other, { to: 'w-someone-else' }), { ok: false, why: 'dropped (malformed): addressed to another worker', dropped: 'malformed' })
  const d = s.status().dropped
  assert.deepEqual([d.replayed, d.unsigned, d.forged, d.stale, d.malformed], [1, 1, 1, 1, 1])
  assert.equal(w.kv.n, 1)
})

// spec: design §6 (send: one event to one worker) · eng §3.3 worker events
// class: E9 a message lost (what the sender sees when the receiver cannot take it)
// technique: state walk over the receivers: none, retired, no handler, a hop to nobody
// method: send to each and read the sentence the sender gets back
// sre: when a message cannot be delivered, does the sender learn why, in words, instead of it vanishing?
test('a message that cannot be delivered answers why: no such worker, not running, no handler', () => {
  const { s } = makeSup()
  const w = s.spawn({ name: 'w', program: `(on 'x (lambda (v) v))` })
  assert.deepEqual(s.send('w-none', 'x', 1), { ok: false, why: 'no such worker' })
  assert.deepEqual(s.send(w.id, 'y', 1), { ok: false, why: "w does not handle 'y" })
  assert.deepEqual(s.hop(w.id, 'w-none', 'x', 1), { ok: false, why: 'no such worker' })
  s.stop(w.id)
  assert.deepEqual(s.send(w.id, 'x', 1), { ok: false, why: 'the worker is retired' })
})

// spec: design §6 (a subscription's metric is a broadcast) · eng §3.3
// class: E18 subscriptions after restart (a broadcast reaches only who listens, paused ones keep it)
// technique: state walk: a listener, a paused listener, a worker without the handler, a retired listener
// method: broadcast once; the listener ran it, the paused one queued it (mailbox 1), the others got nothing
// sre: does a metric reach every worker that asked for it, and only those?
test('a broadcast reaches every living worker that handles the kind; a paused one keeps it in its mailbox', () => {
  const { s } = makeSup()
  const prog = `(on 'disk_free_pct (lambda (v) (remember 'v v))) (every 60 (lambda () #t))`
  const a = s.spawn({ name: 'a', program: prog }), b = s.spawn({ name: 'b', program: prog })
  const c = s.spawn({ name: 'c', program: `(every 60 (lambda () #t))` }), d = s.spawn({ name: 'd', program: prog })
  interrupt(s, b.id, 'pause'); s.stop(d.id)
  s.broadcast('disk_free_pct', 7)
  assert.deepEqual([a.kv.v, b.kv.v, b.mailbox.length, c.kv.v, d.kv.v], [7, undefined, 1, undefined, undefined])
  stopAll(s)
})

// spec: design §6 (the sweep is one interval) · eng §3.5 sweep 10 s · J6
// class: J6 a timer kept alive (unref) or doubled
// technique: node:test mock timers: the interval fires on a mocked clock; the host clock moves with it
// method: startSweep(0) arms an interval of at least 1 s; advance the mock 1 s with the host clock past a beat: the
//         idle worker is stalled by that sweep; clear it; startSweep() with no argument uses the configured 10 s
// sre: does the foreman's sweep run on its own clock, and can a sub-second setting ever make it spin?
test('startSweep arms one interval of at least 1 s that runs the sweep', () => {
  mock.timers.enable({ apis: ['setInterval'] })
  try {
    const { h, s } = makeSup()
    const z = s.spawn({ name: 'idle', program: `(on 'x (lambda (v) v))` })
    const t = s.startSweep(0)
    h.tick(10)
    mock.timers.tick(999)
    assert.equal(z.state, 'running', 'not before 1 s')
    mock.timers.tick(1)
    assert.equal(z.state, 'stalled')
    clearInterval(t)
    const t2 = s.startSweep()
    assert.ok(t2, 'the default is the configured sweep (10 s)')
    clearInterval(t2)
  } finally { mock.timers.reset() }
})

// spec: design §6 (timers: every, after; held while paused; manners skip background turns) · eng §3.5 everyMin 5 s
// class: J2 uncaught exception in a callback (a timer that throws); J6 a timer doubled
// technique: node:test mock timers over the real _arm path
// method: (every 5) fires twice in 10 s; hushed, its fire is skipped and counted; (after 5) fires once and leaves the
//         timer list; an (after …) that comes due while paused is held and runs on resume; an (every …) whose
//         procedure throws crashes the worker (a `crashed` row), and the test process is still alive
// sre: if a timer callback throws at 3 a.m., does the foreman die of an uncaught exception? The worker restarts instead.
test('timers fire through the metered path: every repeats, after fires once, paused holds, hushed skips, a throw is a crash', () => {
  mock.timers.enable({ apis: ['setInterval', 'setTimeout'] })
  try {
    const { h, s } = makeSup()
    const w = s.spawn({ name: 'clock', program: `(every 5 (lambda () (remember 'e (+ 1 (recall 'e 0)))))
(on 'later (lambda (x) (after 5 (lambda () (remember 'a (+ 1 (recall 'a 0)))))))` })
    mock.timers.tick(10_000)
    assert.equal(w.kv.e, 2)
    h.manners = () => 'the box is busy'
    mock.timers.tick(5000)
    assert.deepEqual([w.kv.e, w.skipped], [2, 1])
    delete h.manners
    s.send(w.id, 'later', 1)
    assert.equal(w.timers.length, 2)
    mock.timers.tick(5000)
    assert.deepEqual([w.kv.a, w.timers.length], [1, 1])
    s.send(w.id, 'later', 1)
    interrupt(s, w.id, 'pause')
    mock.timers.tick(5000)
    assert.equal(w.kv.a, 1, 'held while paused')
    assert.equal(w.held.length, 1)
    interrupt(s, w.id, 'resume')
    assert.equal(w.kv.a, 2, 'run on resume')
    const bad = s.spawn({ name: 'bad', program: `(every 5 (lambda () (car '())))` })
    mock.timers.tick(5000)
    assert.ok(h.up.some((u) => u.kind === 'crashed' && u.name === 'bad' && /^every: car/.test(u.data.why)))
    s.stop(bad.id)
    const gone = s.spawn({ name: 'gone', program: `(on 'later (lambda (x) (after 5 (lambda () (remember 'ran #t)))))` })
    s.send(gone.id, 'later', 1)
    gone.state = 'stalled'
    mock.timers.tick(5000)
    assert.equal(gone.kv.ran, undefined, 'a stalled worker\'s step neither runs nor waits')
    stopAll(s)
  } finally { mock.timers.reset() }
})

// spec: design §10 (small minds) · §13 (the desk shows what the minds did) · eng §3.5 (the small mind 60 s)
// class: J18 a Promise that never settles (here: one that does; settle waits for every one in flight)
// technique: fault injection on host.mind: one answer resolves on the next tick
// method: two workers ask their minds; settle() waits for both; read status().mind summed over the workers (asked 2)
//         and each worker's (on 'mind) result
// sre: on a clean stop, does the foreman wait for minds in flight instead of dropping their answers?
test('settle waits for every small-mind answer in flight, and status sums what the minds did', async () => {
  const { h, s } = makeSup()
  h.mind = async () => '(summary "all good")'
  const prog = `(mind-job 'sum '(:ask "say it" :needs (text))) (on 'go (lambda (v) (mind 'sum "hello"))) (on 'mind (lambda (m) (remember 'heard #t)))`
  const w = s.spawn({ name: 'thinker', program: prog }), w2 = s.spawn({ name: 'thinker2', program: prog })
  s.spawn({ name: 'plain', program: `(every 60 (lambda () #t))` })
  s.send(w.id, 'go', 1); s.send(w2.id, 'go', 1)
  assert.equal(s.pending.size, 2)
  assert.equal(w.kv.heard, undefined, 'not before the answer')
  await s.settle()
  assert.equal(s.pending.size, 0)
  assert.deepEqual(s.status().mind, { asked: 2, ran: 0, labels: 0, dropped: 0, failed: 0 })
  assert.deepEqual([w.kv.heard, w2.kv.heard], [true, true])
})

// spec: design §6 (a dry run before anyone is asked) · §12 (a cart's minds and labels) · law 11 (plan, then execute)
// class: E1 a handler throws (found by the trial, before a person sees it)
// technique: state walk over a cart's mind labels, a bad label branch, a timer that crashes to the grave, an unknown
//         hand op, a spawn the supervisor refuses
// method: run trial() over each program; read the problems, the handled kinds, the hands a cart asked, and the cart
//         summary (name, tier, verbs, minds with their models)
// sre: does a cart that would crash on its third label get caught at the trial, before the 26B ships it?
test('the trial tries every mind label, every timer and every hand, and names each problem', () => {
  const cart = (onMind) => `(lacuna-cart 'sorter '((does . "sorts lines") (done . "sorted") (agent . ((tier . watch) (verbs . (on hand report mind))))
  (minds . ((label . ((job . signal->label) (labels . (noise real-error))))))))
(define (start) (hand 'jobs))
(on 'mind (lambda (m) ${onMind}))`
  const good = trial(cart(`(report 'label (get m 'label))`))
  assert.equal(good.ok, true, JSON.stringify(good.problems))
  assert.deepEqual([good.cart.name, good.cart.tier, good.hands, Object.keys(good.cart.minds)], ['sorter', 'watch', ['jobs'], ['label']])
  assert.ok(good.cart.minds.label.model)
  const bad = trial(cart(`(if (eq? (get m 'label) 'real-error) (car '()) #t)`))
  assert.match(bad.problems.join(' '), /\(on 'mind …\) with the label real-error: /)
  const tables = trial(cart(`#t`), { tiers: null, box: { agent_minds: ['gemma3-1b'], workhorse: 'gemma3-1b' } })
  assert.equal(tables.cart.minds.label.model, 'gemma3-1b')
  assert.equal(good.cart.minds.label.role, null)
  const role = trial(cart(`#t`).replace('(labels . (noise real-error))', '(labels . (noise real-error)) (role . verdict)'))
  assert.equal(role.cart.minds.label.role, 'verdict', 'a mind asked by its role names it, in service or not')
  const grave = trial(`(every 60 (lambda () (car '()))) (every 60 (lambda () (car '()))) (every 60 (lambda () (car '()))) (every 60 (lambda () #t))`)
  assert.equal(grave.problems.filter((p) => /^\(every …\) timer/.test(p)).length, 3, 'stops at the grave')
  assert.match(trial(`(hand 'teleport)`).problems[0], /^there is no hand 'teleport — use one of /)
  assert.match(trial(`(subscribe 'cpu_temp 60)`).problems[0], /^there is no metric 'cpu_temp/)
  assert.deepEqual(trial('x'.repeat(64_001)), { ok: false, problems: ['the program is over 64000 bytes'] })
  assert.deepEqual(trial(null).problems, ['a worker needs a program (slat text)'])
})

// spec: design §13 (what the desk reads) · eng §3.3
// class: L5 the ledger row's shape (the desk row of a cart)
// technique: read the description of a cart after one step
// method: describe a running cart; read its cart block (name, outcome, steps, minds by model), its verbs sorted, reads
//         untrusted flag, skip counters, jobs and the alive fields
// sre: can the owner see what a cart is, what it did and which minds it uses, from one card?
test('the description of a cart carries its record, its minds and its alive fields', () => {
  const { s } = makeSup()
  const c = s.spawn({ name: 'sorter', program: `(lacuna-cart 'sorter '((does . "sorts") (done . "sorted") (agent . ((tier . watch) (verbs . (report on mind))))
  (minds . ((label . ((job . signal->label) (labels . (noise))))))))
(on 'x (lambda (v) v))` })
  const d = describe(c)
  assert.deepEqual([d.cart.name, d.cart.outcome, d.cart.steps[0].name, Object.keys(d.cart.minds), d.verbs, d.reads_untrusted, d.skipped, d.jobs],
    ['sorter', null, 'load', ['label'], ['mind', 'report'], false, 0, []])
  assert.equal(typeof d.cart.minds.label.model, 'string')
  assert.deepEqual([d.pending, d.timers], [[], 0])
  stopAll(s)
})
