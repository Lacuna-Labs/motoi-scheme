// supervisor-record.test.mjs — U1 unit tests for what the supervisor writes down: the kv as it goes to disk and comes
// back, a worker resumed from a sparse checkpoint, a reply's ticket closed and checkpointed without a handler, a cart's
// last record, and the description of a record a restarted foreman lists.
// owns: the proofs that a remembered value survives the disk in shape (symbols, pairs, depth), that a checkpoint from an
//   older foreman resumes, that a closed ticket is on the record even when nothing handles the reply, and that the desk
//   reads a non-living record without a throw.
// refuses: to mock supervisor.mjs; every test runs real programs on a real Supervisor and a fake clock (makeSup).
// implements: design §6 (checkpoints; the record), §8 (cart-retired, its record), §13 (what the desk reads); eng §3.3,
//   §10.2 (kill -9 → back: kv intact).
// invariants: "If a step is done, then a ticket closed it" (a closed ticket is checkpointed at once).
// faults: F-06 (a resumed worker is judged like any other).
// coverage: supervisor.mjs — see supervisor.test.mjs (the supervisor*.test.mjs files together)
import test from 'node:test'
import assert from 'node:assert/strict'
import { makeSup } from '../../../test/conformance/fake-host.mjs'
import { kvOut, kvIn, symOf } from '../supervisor.mjs'
import { describe } from '../trial.mjs'

const stopAll = (s) => { for (const id of s.workers.keys()) s.stop(id, 'test over') }

// spec: design §6 (a small KV kept on purpose; a symbol stays a symbol) · eng §10.2 (kv intact after kill -9)
// class: J7 JSON.parse on hostile input (depth; shapes JSON cannot hold)
// technique: boundary: a list 14 deep (the bound is 12); a pair; a symbol inside an object the host gave
// method: remember each, round-trip through JSON (the disk), read back with kvIn; read the description's plain kv
// sre: if a cart remembers a cyclic or very deep value, does the checkpoint write hang or lose the symbol it needs?
test('the kv goes to disk bounded and comes back in shape: symbols, pairs, depth 12', () => {
  let deep = symOf('leaf')
  for (let i = 0; i < 14; i++) deep = [deep]
  const disk = JSON.parse(JSON.stringify(kvOut(deep)))
  let d = 0, x = disk
  while (Array.isArray(x)) { x = x[0]; d++ }
  assert.deepEqual([d, x], [13, '…'])
  const { s } = makeSup()
  const w = s.spawn({ name: 'kv', kv: { cfg: { mode: { $sym: 'fast' }, n: 1 } }, program: `(remember 'pair (cons 1 'b)) (remember 'syms (list 'a 'b))` })
  const back = kvIn(JSON.parse(JSON.stringify(w.kv.pair)))
  assert.deepEqual([back[0], back[1]], [1, symOf('b')])
  assert.deepEqual(describe(w).kv, { cfg: { mode: 'fast', n: 1 }, pair: [1, 'b'], syms: ['a', 'b'] })
  assert.deepEqual(kvIn({ $sym: 'x', extra: 1 }), [[symOf('$sym'), 'x'], [symOf('extra'), 1]], 'only a lone $sym is a symbol')
  stopAll(s)
})

// spec: design §8 (on foreman restart: resume from checkpoint) · E16
// class: E16 a stale checkpoint older than the record (a sparse one from an older foreman)
// technique: fault injection of the checkpoint shape: no kv, no verbs, no pending list; a ticket without `was`
// method: resume three sparse checkpoints; read: a worker with an empty kv, the tier's verbs, no tickets; one whose
//         ticket comes back with an empty `was`; a spawn with no name is "worker"
// sre: if the foreman upgrades and reads yesterday's checkpoints, does every worker come back instead of crashing the boot?
test('a sparse checkpoint from an older foreman resumes; a nameless spawn is "worker"', () => {
  const { s } = makeSup()
  const a = s.resume({ id: 'w-old', name: 'old', program: `(every 60 (lambda () #t))`, tier: 'watch' })
  assert.deepEqual([a.state, a.kv, a.pending, a.verbs.has('report')], ['running', {}, [], true])
  const b = s.resume({ id: 'w-old2', name: 'old2', program: `(every 60 (lambda () #t))`, tier: 'watch', pending: [{ ticket: 't-1', kind: 'hand', op: 'jobs', args: [], sent_at: 1, deadline_at: 2, tries: 1 }] })
  assert.deepEqual(b.pending[0].was, [])
  assert.equal(s.spawn({ program: `(every 60 (lambda () #t))` }).name, 'worker')
  stopAll(s)
})

// spec: design §6 change 2(f) (a reply clears its ticket, whatever the worker does with it) · I "a step done ← a ticket"
// class: E9 a message lost (a reply nobody handles)
// technique: fault injection: a worker that asked a hand but has no (on 'hand …)
// method: count checkpoints; deliver the reply; the send answers "does not handle 'hand", the ticket is gone, and one
//         checkpoint was written for the close
// sre: if a worker forgot its reply handler, does its ticket stay open forever and time it out? It closes, on the record.
test('a reply to a worker with no handler still closes its ticket and checkpoints the close', () => {
  const { h, s } = makeSup()
  let writes = 0; h.checkpoint = () => { writes++ }
  const w = s.spawn({ name: 'deaf', program: `(hand 'jobs) (every 60 (lambda () #t))` })
  const before = writes
  const r = s.send(w.id, 'hand', { ticket: w.pending[0].ticket, op: 'jobs', ok: true })
  assert.deepEqual(r, { ok: false, why: "deaf does not handle 'hand" })
  assert.deepEqual([w.pending.length, writes - before], [0, 1])
  stopAll(s)
})

// spec: design §8 (cart-retired, its record) · §10 (the minds a run asked) · eng §3.3
// class: L5 the ledger row's shape (the cart's record)
// technique: state walk: a cart that asked its mind, then is stopped
// method: a cart asks its small mind, the answer lands, the owner stops it; read the cart's steps (a `minds` step with
//         the counts, then `stop`) and the one `cart-retired` record upstream
// sre: does a stopped cart's record say what its minds did, so the forge can learn from the run?
test('a stopped cart that asked its minds records them in its last steps, once', async () => {
  const { h, s } = makeSup()
  h.mind = async () => '(label \'noise)'
  const c = s.spawn({ name: 'sorter', program: `(lacuna-cart 'sorter '((does . "sorts") (done . "sorted") (agent . ((tier . watch) (verbs . (on mind mind-job))))
  (minds . ((label . ((job . signal->label) (labels . (noise real-error))))))))
(mind-job 'label '(:ask "label the line" :needs (text)))
(on 'go (lambda (x) (mind 'label "a line")))
(on 'mind (lambda (m) #t))` })
  s.send(c.id, 'go', 1)
  await s.settle()
  s.stop(c.id, 'stopped by the owner')
  const names = c.cart.steps.map((x) => x.name)
  assert.deepEqual(names.slice(-2), ['minds', 'stop'])
  assert.match(c.cart.steps.at(-2).why, /^asked 1, labels \d+, dropped \d+, failed \d+$/)
  s.stop(c.id, 'again')
  assert.equal(h.up.filter((u) => u.kind === 'cart-retired').length, 1)
})

// spec: design §13 (what the desk reads) · eng §5 (operating: records after a restart)
// class: E12 the supervisor itself dies (the records a restarted foreman lists but does not run)
// technique: state walk: the shape foreman.mjs reload() builds for a retired worker (verbs as a list, no jobs, no mind)
// method: describe that record; read verbs sorted, jobs [], mind null and the alive fields from the wall clock
// sre: after a restart, does the desk still show yesterday's retired workers, or does one odd record blank the page?
test('the desk describes a retired worker\'s record after a restart without a throw', () => {
  const r = { id: 'w-9', name: 'gone', state: 'retired', tier: 'watch', parent: null, children: [], depth: 1, by: 'lacuna', started: 1,
    crashes: [], last: 'stopped', kv: {}, reports: [], handlers: new Map(), timers: [], subs: [], program: '(define x 1)',
    verbs: ['report', 'hand'], readsUntrusted: false, cart: null }
  const d = describe(r)
  assert.deepEqual([d.verbs, d.jobs, d.mind, d.cart, d.timers, d.beat_age_s], [['hand', 'report'], [], null, null, 0, null])
  assert.deepEqual(describe({ ...r, verbs: undefined }).verbs, [])
  assert.deepEqual(describe({ ...r, kv: undefined }).kv, {}, 'a record with no kv reads as an empty one')
})

