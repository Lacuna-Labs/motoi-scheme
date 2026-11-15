// supervisor-restart.test.mjs — U1 unit tests for the supervisor's let-it-crash: restart types, intensity, the grave,
// the poisoned checkpoint, the three strategies, shutdown order, and what a restart keeps.
// owns: the proofs that a crash restarts per type (permanent, transient, temporary → exit 30), that the third crash in
//   the window is the grave with the record the design names, that a restart resumes from the checkpoint (kv, tickets,
//   step timers and subscriptions) unless the step is poisoned, and that a stop buries children before the parent.
// refuses: to mock supervisor.mjs; every test runs real programs on a real Supervisor and a fake clock (makeSup).
// implements: design §6 change 5 (restart types; intensity 3/300; the poisoned-checkpoint rule), §17 (30), §8 (the run
//   ends with one code; its `(run …)` row), law 3; eng §3.5 (intensity 3/300), §10.2 (strategies 010 · 011 · 111).
// invariants: "If a run foreman died, then its children are buried"; "If a step is done, then a ticket closed it".
// faults: F-04 (three exit 30 in 300 s → grave).
// coverage: supervisor.mjs — see supervisor.test.mjs (the supervisor*.test.mjs files together)
import test from 'node:test'
import assert from 'node:assert/strict'
import { makeSup } from '../../../test/conformance/fake-host.mjs'
import { LIMITS } from '../supervisor.mjs'
import { fileRun } from '../intents.mjs'

const ups = (h, kind) => h.up.filter((u) => u.kind === kind)
const BOOM = `(on 'boom (lambda (x) (car '()))) (on 'ok (lambda (x) (remember 'n (+ 1 (recall 'n 0)))))`
const stopAll = (s) => { for (const id of s.workers.keys()) s.stop(id, 'test over') }
/** The fake host's ledger writer, captured (makeHost declares `ledger` twice; see MAIL). */
const ledgerOf = (h) => { const rows = []; h.ledger = (t) => rows.push(t); return rows }

// spec: design §6 change 5 · eng §3.5 intensity 3/300 · F-04 · exit 30 · I "if a run foreman died, its children are buried"
// class: E2 restart intensity exceeded
// technique: fault injection on a fake host clock (makeSup); the third crash inside the window
// method: a cart with a child crashes three times; read upstream (two `crashed`, one `child-graved` with fault F-04), the
//         child's fate (retired, "its parent … was buried"), the contract (exit 30, outcome fail, state failed), the one
//         `(run …)` ledger row, the cart-retired record, and that a fourth send is refused with a sentence
// sre: if a worker crash-loops, does the foreman stop restarting it and tell someone, without taking the box with it?
test('the third crash inside 300 s is the grave: two crashed, one child-graved, the contract closed with exit 30', () => {
  const { h, s } = makeSup()
  const rows = ledgerOf(h)
  const c = s.spawn({ name: 'fragile', program: `(lacuna-cart 'fragile '((does . "breaks") (done . "broke") (agent . ((tier . watch) (verbs . (on spawn every))))))
(define (start) (spawn 'kid "(every 60 (lambda () #t))"))
(on 'boom (lambda (x) (car '())))` })
  const kid = s.workers.get(c.children[0])
  for (let i = 0; i < 3; i++) s.send(c.id, 'boom', i)
  assert.deepEqual(h.up.filter((u) => u.name === 'fragile' && ['crashed', 'child-graved'].includes(u.kind)).map((u) => u.kind), ['crashed', 'crashed', 'child-graved'])
  assert.deepEqual([ups(h, 'child-graved')[0].data.fault, ups(h, 'child-graved')[0].data.crashes], ['F-04', 3])
  assert.deepEqual([c.state, kid.state, kid.last], ['grave', 'retired', 'its parent fragile was buried'])
  assert.deepEqual([c.contract.exit, c.contract.outcome, c.contract.state], [30, 'fail', 'failed'])
  assert.equal(rows.filter((r) => r.includes(`"${c.id}"`)).length, 1, 'one (run …) row')
  assert.equal(ups(h, 'cart-retired').filter((u) => u.name === 'fragile').length, 1)
  assert.deepEqual(s.send(c.id, 'ok', 1), { ok: false, why: 'the worker is grave' })
})

// spec: design §6 change 5 (permanent · transient · temporary; a run or hand is temporary) · §17 30
// class: E1 a handler throws
// technique: state walk over the three restart types, and a temporary worker that fails at load
// method: one crash each; read the state (permanent and transient running with new handlers; temporary retired with
//         "crashed: …"), the `crashed` row's restart type, a run's contract exit 30; a normal stop of the transient is
//         final; a temporary that cannot load goes to the grave like any other
// sre: does a crashed run end once with a code, while a crashed watcher just comes back?
test('a crash restarts permanent and transient workers, ends a temporary one with exit 30', () => {
  const { h, s } = makeSup()
  const perm = s.spawn({ name: 'perm', program: BOOM })
  const tran = s.spawn({ name: 'tran', tier: 'act', program: BOOM })
  const temp = s.spawn({ name: 'temp', program: BOOM, restart: 'temporary' })
  const hp = perm.handlers, ht = tran.handlers
  for (const w of [perm, tran, temp]) s.send(w.id, 'boom', 1)
  assert.deepEqual([perm.restart, tran.restart, temp.restart], ['permanent', 'transient', 'temporary'])
  assert.deepEqual([perm.state, perm.handlers !== hp, tran.state, tran.handlers !== ht], ['running', true, 'running', true])
  assert.equal(temp.state, 'retired'); assert.match(temp.last, /^crashed: on boom: /)
  assert.deepEqual(ups(h, 'crashed').map((u) => u.data.restart), ['permanent', 'transient', 'temporary'])
  s.stop(tran.id, 'done with it')
  assert.equal(s.send(tran.id, 'ok', 1).ok, false, 'a stopped transient stays stopped')
  const run = fileRun(s, { key: 'r', goal: 'g' })
  run.handlers.set('boom', run.handlers.get('hand'))
  s._run(run, () => { throw new Error('bad step') }, 'on boom')
  assert.deepEqual([run.state, run.contract.exit, run.contract.outcome], ['retired', 30, 'fail'])
  const dead = s.spawn({ name: 'dead', program: '(on (quote x)', restart: 'temporary' })
  assert.equal(dead.state, 'grave')
})

// spec: design §6 change 5 ((restart …) and (intensity N S) per header) · eng §3.5 intensity 3/300
// class: E2 restart intensity exceeded (the header's own numbers)
// technique: boundary: (intensity 2 60) crashes at 0 s and 61 s, then twice inside 60 s; malformed intensities
// method: read the intensity and restart type taken from a cart header; crash at the window's edge (restarted) and
//         inside it (grave); a spawn with a malformed intensity or restart falls back to the defaults
// sre: if a cart's author asks for a stricter intensity, does the foreman honour it — and ignore a nonsense one safely?
test('a header\'s (intensity 2 60) and (restart …) rule; malformed ones fall back to 3/300 and the tier default', () => {
  const { h, s } = makeSup()
  const c = s.spawn({ name: 'strict', program: `(lacuna-cart 'strict '((does . "x") (done . "y") (agent . ((tier . watch) (verbs . (on))))
  (intensity 2 60) (restart . transient)))
(on 'boom (lambda (x) (car '())))` })
  assert.deepEqual([c.intensity, c.restart], [{ crashes: 2, window: 60 }, 'transient'])
  assert.equal(s.send(c.id, 'boom', 0).restarted, true)
  h.tick(61)
  assert.equal(s.send(c.id, 'boom', 0).restarted, true, 'outside its 60 s window the first crash no longer counts')
  assert.equal(s.send(c.id, 'boom', 0).grave, true)
  for (const bad of [[0, 300], [3], 'x', [3, -1]]) assert.deepEqual(s.spawn({ name: 'b', program: BOOM, intensity: bad }).intensity, { crashes: LIMITS.crashes, window: LIMITS.crashWindow })
  assert.equal(s.spawn({ name: 'r', program: BOOM, restart: 'sometimes' }).restart, 'permanent')
  stopAll(s)
})

// spec: design §6 change 5 (first crash resumes from the checkpoint) · eng §10.2 (kv + timers intact) · E17
// class: E17 timers after restart (re-armed by name; never doubled)
// technique: fault injection: a handler throws after a step armed a timer and a subscription
// method: a step arms (after 300 later), (every 60 …) and subscribes; another handler throws once; read the timers
//         (the load's one, plus the step's two, each once) and the subscriptions; crash again at the same step (poisoned):
//         kv only — the step's timers are gone and the load's timer is there once
// sre: if a cart that planned its next check crashes elsewhere, does it forget the plan and stall? It must keep it.
test('a crash restart resumes the step\'s timers and subscriptions once; a poisoned one restarts from kv only', () => {
  const { h, s } = makeSup()
  const subs = []; h.subscribe = (w, m, sec) => subs.push(m)
  const w = s.spawn({ name: 'planner', program: `(define (later) (report 'later 1))
(every 60 (lambda () #t))
(on 'plan (lambda (x) (after 300 later) (every 90 later) (subscribe 'disk_free_pct 60) (report 'step 'planned)))
(on 'boom (lambda (x) (car '())))` })
  s.send(w.id, 'plan', 1)
  const shape = () => w.timers.map((t) => `${t.spec.verb}:${t.spec.origin}:${t.spec.fn}`).sort()
  const before = shape()
  assert.deepEqual(before, ['after:step:later', 'every:load:null', 'every:step:later'])
  s.send(w.id, 'boom', 1)
  assert.deepEqual(shape(), before, 'the same timers, none doubled')
  assert.deepEqual(w.subs.map((x) => x.metric), ['disk_free_pct'])
  assert.equal(w.kv.n, undefined)
  const r = s.send(w.id, 'boom', 1)
  assert.equal(r.poisoned, true)
  assert.deepEqual(shape(), ['every:load:null'], 'kv only: the step\'s timers are not re-armed')
  stopAll(s)
})

// spec: design §6 change 5 (a second crash at the same step drops the step's tickets) · law 4 (an act is never re-sent)
// class: E4 poisoned state on restart
// technique: state walk: two crashes at different steps (not poisoned), then two at the same step (poisoned)
// method: a worker asks a hand in a step, crashes (step n), reports (step n+1), crashes (not poisoned: the step moved),
//         crashes again at the same step (poisoned): read `poisonedStep`, the `crashed` rows' `poisoned` flags and the
//         pending list after each
// sre: does the rule drop tickets only when the same step crashes twice, never when the worker made progress between?
test('the poisoned rule fires only on a second crash at the same step', () => {
  const { h, s } = makeSup()
  const w = s.spawn({ name: 'stepper', intensity: [5, 300], program: `(on 'ask (lambda (x) (hand 'jobs))) (on 'step (lambda (x) (report 'step x)))
(on 'boom (lambda (x) (car '()))) (on 'hand (lambda (r) #t))` })
  s.send(w.id, 'ask', 1)
  s.send(w.id, 'boom', 1)
  s.send(w.id, 'step', 1)
  s.send(w.id, 'boom', 1)
  assert.deepEqual(ups(h, 'crashed').map((u) => u.data.poisoned), [false, false])
  assert.equal(w.pending.length, 1)
  s.send(w.id, 'boom', 1)
  assert.deepEqual(ups(h, 'crashed').map((u) => u.data.poisoned), [false, false, true])
  assert.equal(w.pending.length, 0); assert.equal(w.poisonedStep, ups(h, 'crashed').at(-1).data.step)
})

// spec: design §6 (three strategies) · eng §10.2 (strategies 010 · 011 · 111; siblings by birth order) · POSTMORTEMS B02
// class: E3 the wrong strategy family
// technique: state walk over the strategies with a stopped sibling and a parent-less worker
// method: rest_for_one with the youngest sibling stopped: only the running younger siblings restart; one_for_all with a
//         stopped sibling: it is not booted again; a crash of a worker with no parent under one_for_all restarts it alone
// sre: does a strategy ever bring a stopped sibling back to life?
test('a strategy restarts only running siblings, never a stopped one, and a parent-less worker alone', () => {
  const crash = `(on 'go (lambda (x) (car 1)))`
  for (const policy of ['rest_for_one', 'one_for_all']) {
    const { s } = makeSup()
    const p = s.spawn({ name: 'p', program: `(every 60 (lambda () #t))` })
    const kids = [1, 2, 3].map((i) => s.spawn({ name: `k${i}`, program: crash, parent: p.id, policy }))
    s.stop(kids[2].id, 'the owner stopped it')
    const before = kids.map((k) => k.handlers)
    s.send(kids[0].id, 'go', 1)
    assert.deepEqual(kids.map((k, i) => (k.handlers !== before[i] ? 1 : 0)).join(''), '110', policy)
    assert.equal(kids[2].state, 'retired')
    stopAll(s)
  }
  const { s } = makeSup()
  const lone = s.spawn({ name: 'lone', program: crash, policy: 'one_for_all' })
  const other = s.spawn({ name: 'other', program: crash })
  const ho = other.handlers
  assert.equal(s.send(lone.id, 'go', 1).restarted, true)
  assert.equal(other.handlers, ho)
})

// spec: design §6 (stopping a parent stops its children first) · invariant "a run foreman died → children buried"
// class: E15 shutdown ordering (children before parent)
// technique: state walk over a three-deep tree, read in upstream order
// method: stop the root; read the `retired` rows in order: grandchild, child, root; each child's reason names its parent
// sre: when a tree stops, does any child outlive its parent long enough to act on a dead parent's behalf?
test('a stop retires children before their parent, deepest first', () => {
  const { h, s } = makeSup()
  const root = s.spawn({ name: 'root', program: `(define c (spawn 'child "(define g (spawn 'grand \\"(every 60 (lambda () #t))\\"))"))` })
  s.stop(root.id, 'stopped by the owner')
  assert.deepEqual(ups(h, 'retired').map((u) => u.name), ['grand', 'child', 'root'])
  assert.equal(ups(h, 'retired')[0].data.why, 'its parent child its parent root stopped by the owner')
  assert.equal(s.stop(root.id), false, 'a retired worker has nothing to stop')
  assert.equal(s.stop('w-none'), false)
})

// spec: design §6 change 5 (a restart resumes; nothing asked twice) · eng §10.2 (kill -9 → back: living count equal) · E17
// class: E17 timers after restart (and children: re-armed by name, never doubled)
// technique: fault injection (a crash restart), then process-restart simulation (checkpoints read by a new Supervisor,
//   the parent first, as foreman.mjs reload() orders them)
// method: a parent spawns 'kid at load and remembers its id; crash it twice (outside the window): one child, the same id,
//         no new spawn; checkpoint both, resume the parent then the child in a new Supervisor: still one child, the old
//         id, running, in the parent's children list once; a child the owner stopped is spawned anew on the next load,
//         and a living child with another name or program is never taken for it
// sre: if a parent crash-loops or the foreman is killed, do its children multiply until the cap buries the parent?
test('a reload adopts the living child its load spawned the first time; it never spawns a second one', () => {
  const { h, s } = makeSup()
  const store = new Map(); h.checkpoint = (id, d) => store.set(id, JSON.parse(JSON.stringify(d)))
  const p = s.spawn({ name: 'lead', program: `(remember 'kid (spawn 'kid "(every 60 (lambda () #t))")) (on 'boom (lambda (x) (car '())))
(on 'help (lambda (x) (spawn 'helper "(every 90 (lambda () #t))")))` })
  const first = p.kv.kid
  s.send(p.id, 'boom', 1); h.tick(LIMITS.crashWindow + 1); s.send(p.id, 'boom', 1)
  assert.deepEqual([p.children, p.kv.kid, s.living().length], [[first], first, 2], 'one child, the same one')
  const { h: h2, s: s2 } = makeSup(); h2.tick(60)
  const p2 = s2.resume(store.get(p.id))
  const k2 = s2.resume(store.get(first))
  assert.deepEqual([p2.kv.kid, p2.children, k2.state, s2.living().length], [first, [first], 'running', 2], 'after kill -9: the same child, once')
  s.send(p.id, 'help', 1)
  s.stop(first, 'the owner stopped it')
  h.tick(LIMITS.crashWindow + 1); s.send(p.id, 'boom', 1)
  assert.notEqual(p.kv.kid, first, 'a stopped child is not adopted: the load spawns a new one')
  assert.deepEqual(p.children.filter((c) => s.living().includes(s.workers.get(c))).map((c) => s.workers.get(c).name).sort(), ['helper', 'kid'],
    'the living helper is not taken for the kid; the helper is kept')
  stopAll(s); stopAll(s2)
})
