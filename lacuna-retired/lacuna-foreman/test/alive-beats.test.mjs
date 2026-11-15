// alive-beats.test.mjs — U1 unit tests for `alive.mjs` heartbeats and the zombie law: a worker that waits must still be
// seen breathing; two missed beats restart it from its checkpoint, a third stops it; a worker nothing can wake is stalled.
// owns: coverEnd (what a worker waits on), heartbeat (2 → restart, 3 → stopped), zombie (pending, timers, subs, minds,
//   the brain's hop, the unclaimed hour, living children, a cart that said done).
// refuses: to mock alive.mjs; every test drives a real Supervisor on a fake clock (makeSup) and reads the record.
// implements: design §6 (alive or said dead), §9 (the kick rule's neighbour), §17 (99); eng §3.5 (beat 30 s → 5 s here;
//   missed beats 2/3; unclaimed run 3,600 s).
// invariants: "If a promise is open past its deadline, then a kick was sent; if two, exit 99" (the heartbeat's twin: a
//   worker past its cover is restarted once, then stopped with 99).
// faults: F-06 (stalled: nothing could wake it).
// coverage: alive.mjs — see alive.test.mjs (the four alive*.test.mjs files together)
import test from 'node:test'
import assert from 'node:assert/strict'
import { STALLED, MISSED } from '../alive.mjs'
import { fileRun, intent, result, awaitBrain } from '../intents.mjs'
import { makeSup, DEADLINES } from '../../../test/conformance/fake-host.mjs'

const ups = (h, kind) => h.up.filter((u) => u.kind === kind)
const CART = `(lacuna-cart 'waiter '((does . "waits") (done . "waited") (agent . ((tier . watch) (verbs . (on report))))))
(on 'x (lambda (v) v))`

// spec: design §6 (the zombie law) · §17 99 · eng §3.5 (hop deadline) · F-06
// class: E7 a zombie (a run whose brain stopped sending intents, with no kick sweep to catch it)
// technique: boundary: the hop deadline − 1 s and the hop deadline, the alive sweep alone (kick.mjs never runs)
// method: a run with one hop waits on its brain; at due − 1 s it is covered (running); at due nothing can wake it: the
//         zombie law sends `stuck` with STALLED, the worker is stalled and its contract says exit 99
// sre: if the kick sweep is broken too, does the alive sweep still end a silent run on time with the right code?
test('a run whose brain goes quiet is stalled at its hop deadline by the zombie law alone, exit 99', () => {
  const { h, s } = makeSup()
  const w = fileRun(s, { key: 'r-beat', goal: 'g' })
  const i = intent(s, w.id, { tool: 'jobs' }); result(s, w.id, 'hand', { ticket: i.ticket, op: 'jobs', ok: true })
  h.tick(DEADLINES.hop - 1); s.sweep()
  assert.deepEqual([w.state, w.missed], ['running', 0])
  h.tick(1); s.sweep()
  assert.equal(w.state, 'stalled')
  assert.equal(ups(h, 'stuck').at(-1).data.why, STALLED)
  assert.equal(ups(h, 'restarted').length, 0, 'nothing to restart for: the zombie law is first')
  assert.deepEqual([w.contract.exit, w.contract.state], [99, 'stalled'])
})

// spec: design §6 (the zombie law) · eng §3.5 unclaimed run 3,600 s · F-06
// class: E7 a zombie (nothing pending, no hop yet: waiting for a driver is not a zombie)
// technique: boundary: 3,599 s and 3,600 s after the filing, the sweep alone (no kick sweep)
// method: file a run and never claim it; sweep at 3,599 s (running, no restart: an unclaimed hop is no cover), then at
//         3,600 s (the zombie law stalls it: `stuck` with STALLED, exit 99)
// sre: does a run queued behind busy drivers survive the hour it is promised, and not a second longer?
test('an unclaimed run is no zombie for its hour, and its hop deadline is no heartbeat cover', () => {
  const { h, s } = makeSup()
  const w = fileRun(s, { key: 'r-wait', goal: 'g' })
  h.tick(3599); s.sweep()
  assert.deepEqual([w.state, w.restarts || 0, w.missed], ['running', 0, 0])
  h.tick(1); s.sweep()
  assert.equal(w.state, 'stalled')
  assert.equal(ups(h, 'stuck').at(-1).data.why, STALLED)
  assert.equal(w.contract.exit, 99)
})

// spec: design §6 (the zombie law: nothing pending, no timer, no subscription, no living child) · F-06
// class: E7 a zombie
// technique: state walk: one worker per waking source — a subscription, a mind in flight, a brain wait inside its hop
// method: spawn each; pass two beats; sweep; each stays running (something can wake it); then the brain wait's hop ends
//         and the cart with nothing else is stalled at that sweep, while the subscriber stays
// sre: does the zombie law only take workers that truly nothing can wake, and never one waiting on a sensor or the 26B?
test('a subscription, a mind in flight, or a brain wait inside its hop keeps a worker out of the zombie law', async () => {
  const { h, s } = makeSup()
  h.mind = () => new Promise(() => {})
  const sub = s.spawn({ name: 'sub', program: `(subscribe 'disk_free_pct 60) (on 'disk_free_pct (lambda (v) v))` })
  const minder = s.spawn({ name: 'minder', program: `(mind-job 'sum '(:ask "say it" :needs (text))) (on 'go (lambda (v) (mind 'sum "hi"))) (on 'mind (lambda (m) m))` })
  s.send(minder.id, 'go', 1)
  await new Promise((r) => setImmediate(r))
  const waiter = s.spawn({ name: 'waiter', program: CART })
  awaitBrain(s, waiter)
  h.tick(DEADLINES.beat * 2); s.sweep()
  assert.deepEqual([sub.state, minder.state, waiter.state], ['running', 'running', 'running'])
  h.tick(DEADLINES.hop); s.sweep()
  assert.equal(waiter.state, 'stalled', 'its hop ended and nothing else can wake it')
  assert.equal(waiter.stallReason, STALLED)
  assert.equal(sub.state, 'running')
})

// spec: design §6 (no living child) · invariant "if a run foreman died, then its children are buried" (the reverse: a
//   parent whose children live is alive) · F-06
// class: E11 an orphan (and its mirror: a parent whose only child is paused)
// technique: state walk over the child's state: paused (alive), then retired (gone)
// method: a parent with nothing of its own and one child; pause the child; sweep past a beat: the parent is not a zombie;
//         stop the child; sweep: the parent is stalled with STALLED and `stuck` names it
// sre: if the owner pauses a child, does the parent get buried for waiting on it? It must wait; once the child ends, it goes.
test('a parent waiting on a paused child is alive; once the child ends, the parent is stalled', () => {
  const { h, s } = makeSup()
  const p = s.spawn({ name: 'lead', program: `(on 'child-report (lambda (r) r)) (remember 'kid (spawn 'kid "(every 60 (lambda () #t))"))` })
  const kid = s.workers.get(p.kv.kid)
  kid.state = 'paused'
  h.tick(DEADLINES.beat + 1); s.sweep()
  assert.equal(p.state, 'running')
  s.stop(kid.id, 'the owner stopped it')
  h.tick(DEADLINES.beat + 1); s.sweep()
  assert.equal(p.state, 'stalled')
  assert.ok(ups(h, 'stuck').some((u) => u.name === 'lead' && u.data.why === STALLED))
})

// spec: design §6 change 5 (a restart resumes) · eng §3.5 missed beats 2/3 · F-04
// class: E4 poisoned state on restart (the program cannot load again at the heartbeat's restart)
// technique: fault injection: a program that loads once and throws on every later load
// method: a worker waits on a mind that never answers; two missed beats restart it from its checkpoint; the reload throws;
//         read the grave state, the `child-graved` row, and that no timer was re-armed into a dead worker
// sre: if the restart that should save a stuck worker crashes it, does the worker end in the grave on the record?
test('a heartbeat restart whose reload throws ends in the grave, with nothing re-armed', async () => {
  const { h, s } = makeSup()
  h.mind = () => new Promise(() => {})
  const w = s.spawn({ name: 'fragile', program: `(if (recall 'loaded #f) (car '()) (remember 'loaded #t))
(mind-job 'sum '(:ask "say it" :needs (text)))
(on 'go (lambda (v) (after 999 (lambda () #t)) (mind 'sum "hi")))
(on 'mind (lambda (m) m))` })
  s.send(w.id, 'go', 1)
  await new Promise((r) => setImmediate(r))
  h.tick(DEADLINES.mind + DEADLINES.beat * 2); s.sweep()
  assert.equal(w.state, 'grave')
  assert.equal(ups(h, 'child-graved').length, 1)
  assert.match(ups(h, 'child-graved')[0].data.why, /^load: /)
  assert.equal(w.timers.length, 0)
})
