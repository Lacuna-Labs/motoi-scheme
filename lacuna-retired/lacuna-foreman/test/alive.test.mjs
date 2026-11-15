// alive.test.mjs — U1 unit tests for `alive.mjs` (§45.3): every hand and act is a ticket with a deadline (one re-send,
// then a timeout handler or "never answered"); a worker with nothing pending is stalled, never "running"; a checkpoint at
// every step lets a new foreman RESUME a worker; a child gets a context packet first; the description shows all of it.
// owns: the baseline behaviours of tickets, deadlines, the zombie law, checkpoints and the packet (the measured zombie:
//   ci-guard, w-cf9317, 2026-10-19); alive-tickets, alive-beats and alive-checkpoint hold the failure classes.
// refuses: to mock alive.mjs; every test drives a real Supervisor on a fake clock and reads the record.
// implements: design §6 (alive or said dead; checkpoints), §9 (press tickets have no deadline), §17 (15, 99); eng §3.3,
//   §3.5 (hand 120 s, act 600 s, beat 30 s, sweep 10 s, missed beats 2/3).
// invariants: "If a promise is open past its deadline, then a kick was sent; if two, exit 99"; a restart resumes.
// faults: F-01, F-06, F-08.
// coverage: alive.mjs — lines 100% branches 100% functions 100% (2026-10-24; alive*.test.mjs together)
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Supervisor } from '../supervisor.mjs'
import { describe } from '../trial.mjs'
import { node } from '../talk.mjs'
import { checkpointStore, STALLED, MISSED } from '../alive.mjs'

const DEADLINES = { hand: 10, act: 40, beat: 5, mind: 20 }

function host(extra = {}) {
  let t = 1000
  let n = 0
  const up = []
  return {
    up, tick: (s) => { t += s }, deadlines: DEADLINES,
    now: () => t, id: () => `w${++n}`, save: () => {}, upstream: (kind, w, data) => up.push({ kind, name: w.name, data }),
    ...extra,
  }
}
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'foreman-ckpt-'))

const READER = `
(define t (hand 'jobs "all"))
(on 'hand (lambda (r) (remember 'got #t) (every 60 (lambda () (report 'tick 1)))))`

// spec: design §6 change 2(d)(f) (a ticket per hand; on result the ticket clears) · eng §3.3 · §3.5 hand 120 s (10 s here)
// class: E9 a message lost (the baseline: the reply arrives and the ticket clears)
// technique: fake clock; read the ticket the load opened, then deliver its reply
// method: a worker asks (hand 'jobs "all") at load; read the one pending ticket (op, kind, tries, deadline − sent = 10 s);
//         deliver the reply by ticket; pending is empty and the handler's kv write landed
// sre: does every read a worker asks leave a ticket with a deadline the foreman can see and close?
test('a hand is a pending ticket with a deadline; its reply clears it', () => {
  const h = host()
  const s = new Supervisor(h)
  const w = s.spawn({ name: 'reader', program: READER })
  assert.equal(w.pending.length, 1)
  const [p] = w.pending
  assert.equal(p.op, 'jobs'); assert.equal(p.kind, 'hand'); assert.equal(p.tries, 1)
  assert.equal(p.deadline_at - p.sent_at, DEADLINES.hand)
  s.send(w.id, 'hand', { ticket: p.ticket, op: 'jobs', ok: true })
  assert.equal(w.pending.length, 0)
  assert.equal(w.kv.got, true)
  for (const id of s.workers.keys()) s.stop(id)
})

// spec: design §6 change 2 (a cart's hand keeps its single re-send) · §17 15 · F-01 · eng §3.5 hand
// class: E8 a deadline passed
// technique: time travel: two ticks, each one past the hand deadline
// method: the reply never comes; the first sweep re-sends once (new ticket, retry_of the first, same args, tries 2); the
//         second sweep stops the worker "jobs never answered (F-01)" and the `retired` row carries that reason
// sre: if the hands drop a reply, do we retry exactly once and then say so, instead of waiting forever or looping?
test('a dropped hand reply: one re-send with a new ticket, then "never answered" stops it', () => {
  const h = host()
  const s = new Supervisor(h)
  const w = s.spawn({ name: 'reader', program: READER })
  const first = w.pending[0].ticket
  h.tick(DEADLINES.hand + 1); s.sweep()
  const hands = h.up.filter((u) => u.kind === 'hand')
  assert.equal(hands.length, 2)
  assert.notEqual(hands[1].data.ticket, first)
  assert.equal(hands[1].data.retry_of, first)
  assert.deepEqual(hands[1].data.args, ['all'])
  assert.equal(w.pending[0].tries, 2)
  assert.equal(w.state, 'running')
  h.tick(DEADLINES.hand + 1); s.sweep()
  assert.equal(h.up.filter((u) => u.kind === 'hand').length, 2)       // once only
  assert.equal(w.state, 'retired')
  assert.equal(w.last, 'stopped: jobs never answered (F-01)')
  assert.equal(describe(w).stall_reason, 'stopped: jobs never answered (F-01)')
  assert.ok(h.up.some((u) => u.kind === 'retired' && u.data.why === 'stopped: jobs never answered (F-01)'))
})

// spec: design §6 change 2(f) · eng §3.3 (a re-sent ticket remembers the ones it replaced)
// class: E10 a duplicate message (the original reply arrives after the re-send)
// technique: time travel past the deadline, then the late reply to the first ticket
// method: re-send once; deliver the reply naming the FIRST ticket; the re-sent ticket clears (it was replaced, not lost)
// sre: if the slow first answer arrives after the retry went out, is it accepted rather than orphaned?
test('the late answer to the first ticket still clears a re-sent one', () => {
  const h = host()
  const s = new Supervisor(h)
  const w = s.spawn({ name: 'reader', program: READER })
  const first = w.pending[0].ticket
  h.tick(DEADLINES.hand + 1); s.sweep()
  s.send(w.id, 'hand', { ticket: first, op: 'jobs', ok: true })
  assert.equal(w.pending.length, 0)
  s.stop(w.id)
})

// spec: design §6 change 2 · §16 F-01 · eng §3.3 worker events (hand-timeout)
// class: E8 a deadline passed (the program chose to handle it)
// technique: time travel past both deadlines with a hand-timeout handler present
// method: read the handler's kv (op as a symbol, tries 2), the state (running) and the empty pending list
// sre: can a cart that knows how to recover from a dead read do so, instead of being stopped by the foreman?
test("a program with (on 'hand-timeout …) hears the timeout instead of being stopped", () => {
  const h = host()
  const s = new Supervisor(h)
  const w = s.spawn({ name: 'patient', program: READER + `
(on 'hand-timeout (lambda (x) (remember 'timed-out (get x 'op)) (remember 'tries (get x 'tries)) (every 60 (lambda () #t))))` })
  h.tick(DEADLINES.hand + 1); s.sweep()
  h.tick(DEADLINES.hand + 1); s.sweep()
  assert.equal(w.state, 'running')
  assert.equal(w.kv['timed-out'].$sym, 'jobs')
  assert.equal(w.kv.tries, 2)
  assert.equal(w.pending.length, 0)
  s.stop(w.id)
})

// spec: design §9 (a press ticket has no deadline) · §16 F-08 · eng §3.5 act 600 s or the header's per-op deadline
// class: E8 a deadline passed (one that must never pass: a person's press)
// technique: time travel 10,000 s past an act that waits on the press
// method: the act ticket carries the per-op deadline (99 s); its reply says waiting → the ticket becomes a press with no
//         deadline; after 10,000 s the worker still runs (no zombie); the press's answer (op only) clears it
// sre: if the owner takes a day to press, does the foreman wait for him instead of timing the act out?
test('an act uses its own deadline; an act waiting on the owner\'s press keeps its ticket with no deadline', () => {
  const h = host({ deadlines: { ...DEADLINES, acts: { pass: 99 } } })
  const s = new Supervisor(h)
  const REL = `(lacuna-cart 'rel
  '((does . "releases") (agent . ((tier . act) (verbs . (on act report done)))) (acts . (pass)) (done . "released")))
(define (start) (act 'pass))
(on 'act (lambda (r) (if (get r 'waiting #f) #t (done "released"))))`
  const w = s.spawn({ name: 'rel', program: REL, tier: 'act' })
  assert.equal(w.pending[0].kind, 'act')
  assert.equal(w.pending[0].deadline_at - w.pending[0].sent_at, 99)
  s.send(w.id, 'act', { ticket: w.pending[0].ticket, op: 'pass', ok: true, waiting: 'c-123' })
  assert.equal(w.pending[0].kind, 'press')
  assert.equal(w.pending[0].deadline_at, null)
  assert.equal(describe(w).pending[0].waiting, 'c-123')
  h.tick(10_000); s.sweep()
  assert.equal(w.state, 'running')                                     // a person's press has no deadline, and it is no zombie
  s.send(w.id, 'act', { op: 'pass', ok: true })                         // the press's answer carries the op only
  assert.equal(w.pending.length, 0)
  s.stop(w.id)
})

// spec: design §6 (the zombie law) · §16 F-06 · eng §3.5 beat 30 s (5 s here)
// class: E7 a zombie
// technique: boundary: the first sweep (inside one beat) and one beat later
// method: a worker with one handler and nothing else is left alone for one beat, then stalled: `stuck` and `retired`
//         upstream, the stall reason on the description, out of the living list; a worker with a timer stays running
// sre: does a worker nothing can wake show as stalled on the desk within a beat, never as "running" for 8 h (ci-guard)?
test('the zombie law: nothing pending and nothing to wake it → stalled and stopped, never "running"', () => {
  const h = host()
  const s = new Supervisor(h)
  const z = s.spawn({ name: 'ci-guard', program: `(on 'x (lambda (v) v))` })
  const timed = s.spawn({ name: 'ticker', program: `(every 60 (lambda () (report 'tick 1)))` })
  s.sweep()
  assert.equal(z.state, 'running')                                     // one beat to arm what it waits on
  h.tick(DEADLINES.beat + 1); s.sweep()
  assert.equal(z.state, 'stalled')
  assert.equal(z.last, STALLED)
  assert.equal(describe(z).stall_reason, STALLED)
  assert.ok(h.up.some((u) => u.kind === 'stuck' && u.name === 'ci-guard'))
  assert.ok(h.up.some((u) => u.kind === 'retired' && u.name === 'ci-guard'))
  assert.equal(s.living().includes(z), false)
  assert.equal(timed.state, 'running')                                 // a worker idle on a timer is not missing anything
  s.stop(timed.id)
})

// spec: design §6 (the zombie law: a living child can wake it) · §12 (done means retired) · F-06
// class: E7 a zombie (two false positives the law must not take)
// technique: state walk: a parent with a living child; a cart that said (done …)
// method: sweep past a beat; the parent runs; the cart is retired with outcome done and no stall reason
// sre: does the zombie law ever bury a worker that is waiting on its child, or call a finished cart stalled?
test('a cart that said done is done, not stalled; a parent with a living child is not a zombie', () => {
  const h = host()
  const s = new Supervisor(h)
  const p = s.spawn({ name: 'parent', program: `(on 'child-report (lambda (r) r)) (define kid (spawn 'kid "(every 60 (lambda () #t))"))` })
  h.tick(DEADLINES.beat + 1); s.sweep()
  assert.equal(p.state, 'running')
  const c = s.spawn({ name: 'quick', program: `(lacuna-cart 'quick '((does . "one thing") (agent . ((tier . watch) (verbs . (on report done)))) (done . "did it")))
(define (start) (done "did it"))` })
  h.tick(DEADLINES.beat + 1); s.sweep()
  assert.equal(c.state, 'retired')
  assert.equal(c.cart.outcome, 'done')
  assert.equal(describe(c).stall_reason, null)
  s.stop(p.id)
})

// spec: design §6 · eng §3.5 (mind 360 s; missed beats 2 → restart, 3 → stopped) · F-06
// class: J18 a Promise that never settles (the small mind's answer)
// technique: fault injection: host.mind returns a promise that never settles; time travel in beats
// method: inside the mind deadline nothing happens; two beats past it one `restarted` row; one more beat the worker is
//         stopped with MISSED and `stuck` upstream
// sre: if a small mind hangs forever, is the worker restarted once and then stopped, never left "thinking"?
test('a small mind that never answers: two missed beats past its deadline → one restart, a third → stopped', async () => {
  const h = host({ mind: () => new Promise(() => {}) })
  const s = new Supervisor(h)
  // asked in a step, not at load: a restart loads the program again, and a load that asks would ask afresh
  const w = s.spawn({ name: 'thinker', program: `(mind-job 'sum '(:ask "say it" :needs (text)))
(on 'go (lambda (v) (mind 'sum "hello")))
(on 'mind (lambda (m) m))` })
  s.send(w.id, 'go', 1)
  await new Promise((r) => setImmediate(r))
  assert.equal(describe(w).minds_in_flight, 1)
  h.tick(DEADLINES.mind - 1); s.sweep()
  assert.equal(w.state, 'running'); assert.equal(w.restarts || 0, 0)    // inside the mind's own deadline: a wait, not a miss
  h.tick(1 + DEADLINES.beat * 2); s.sweep()
  assert.equal(w.restarts, 1)
  assert.ok(h.up.some((u) => u.kind === 'restarted'))
  assert.equal(w.state, 'running')
  h.tick(DEADLINES.beat); s.sweep()
  assert.equal(w.state, 'retired')
  assert.equal(describe(w).stall_reason, MISSED)
  assert.ok(h.up.some((u) => u.kind === 'stuck' && u.data.why === MISSED))
})

// spec: design §6 (checkpoints; a restart resumes) · §8 · eng §10.2 (kill -9 → back: kv + timers intact)
// class: E12 the supervisor itself dies (kill -9; resume from the record)
// technique: process-restart simulation: a real checkpoint store on disk, a second Supervisor on a later clock
// method: read the checkpoint file (one file, no tmp, kv, the ticket, the named timer, the subscription); resume it: the
//         same id, kv, the timer at the same due moment, the subscription re-made, the ticket with its deadline, and the
//         expired ticket re-sent once by the next sweep
// sre: if the foreman is killed, does every worker come back as it was, not blank (ci-guard came back remembering nothing)?
test('a checkpoint at every step; a new supervisor RESUMES the worker: kv, its timer re-armed, its ticket kept', () => {
  const dir = tmp()
  const store = checkpointStore(dir)
  const h = host({ checkpoint: (id, d) => store.write(id, d) })
  const s = new Supervisor(h)
  const w = s.spawn({ name: 'planner', program: `
(define (later) (report 'later 1))
(on 'go (lambda (v) (remember 'n v) (after 300 later) (subscribe 'disk_free_pct 60) (hand 'jobs)))` })
  s.send(w.id, 'go', 7)
  const file = path.join(dir, `${w.id}.json`)
  assert.ok(fs.existsSync(file))
  assert.deepEqual(fs.readdirSync(dir), [`${w.id}.json`])               // the last checkpoint only, no tmp left behind
  const ck = JSON.parse(fs.readFileSync(file, 'utf8'))
  assert.equal(ck.kv.n, 7)
  assert.equal(ck.pending.length, 1)
  assert.deepEqual(ck.timers.map((t) => [t.verb, t.fn, t.origin]), [['after', 'later', 'step']])
  assert.deepEqual(ck.subs, [{ metric: 'disk_free_pct', seconds: 60 }])
  assert.equal(ck.steps, w.steps)
  assert.equal(describe(w).checkpoint_t, ck.t)
  const deadline = ck.pending[0].deadline_at
  for (const t of w.timers) clearTimeout(t)                              // the old foreman is gone

  const subscribed = []
  const h2 = host({ checkpoint: (id, d) => store.write(id, d), subscribe: (x, m, sec) => subscribed.push([m, sec]) })
  h2.tick(100)
  const s2 = new Supervisor(h2)
  const r = s2.resume(store.read(w.id))
  assert.equal(r.id, w.id)
  assert.equal(r.state, 'running')
  assert.equal(r.kv.n, 7)
  assert.equal(r.timers.length, 1)
  assert.equal(r.timers[0].spec.fn, 'later')
  assert.equal(r.timers[0].spec.due_at, ck.timers[0].due_at)             // the same moment, not a fresh 300 s
  assert.deepEqual(subscribed, [['disk_free_pct', 60]])
  assert.equal(r.pending.length, 1)
  assert.equal(r.pending[0].deadline_at, deadline)
  assert.equal(describe(r).resumed_from, ck.t)
  assert.ok(r.thoughts.some((x) => x.kind === 'state' && x.text.startsWith('resumed from its checkpoint')))
  // its expired ticket goes through the deadline rule: one re-send
  h2.tick(DEADLINES.hand); s2.sweep()
  assert.equal(h2.up.filter((u) => u.kind === 'hand').length, 1)
  assert.equal(r.pending[0].tries, 2)
  s2.stop(r.id)
  fs.rmSync(dir, { recursive: true, force: true })
})

// spec: design §6 change 5 (an issued ticket is followed on the restart, never reissued) · eng §3.3
// class: E10 a duplicate message (a reload would ask the same read again)
// technique: fault injection (a crash restart), then a resume in a second Supervisor
// method: a worker asks (hand 'jobs "all") at load; crash it; read one ticket and one `hand` row; resume its checkpoint
//         elsewhere: the same ticket, zero new `hand` rows
// sre: if a worker restarts mid-read, does it ask the hands twice and get two answers?
test('a load again (resume, crash restart) adopts the ticket its first load asked — never asks twice', () => {
  const store = new Map()
  const h = host({ checkpoint: (id, d) => store.set(id, JSON.parse(JSON.stringify(d))) })
  const s = new Supervisor(h)
  const w = s.spawn({ name: 'top', program: `(hand 'jobs "all") (on 'boom (lambda (x) (car '())))` })
  s.send(w.id, 'boom', 0)                                              // a crash: the program loads again
  assert.equal(w.pending.length, 1)
  assert.equal(h.up.filter((u) => u.kind === 'hand').length, 1)
  const h2 = host()
  const r = new Supervisor(h2).resume(store.get(w.id))
  assert.equal(r.pending.length, 1)
  assert.equal(r.pending[0].ticket, w.pending[0].ticket)
  assert.equal(h2.up.filter((u) => u.kind === 'hand').length, 0)
})

// spec: design §6 (the context packet as the first event) · eng §3.3 worker events (start)
// class: E11 an orphan (what a child knows of its parent)
// technique: state walk: a parent's kv, a packet given to spawn (only its own keys), a root with none
// method: the child's (on 'start) runs first and once; its kv shows the parent's goal and id; the description shows the
//         packet; a given packet keeps only the seven keys; a root has null
// sre: does a child know what the run is for before it does anything?
test('a child gets a context packet from its parent as its first event', () => {
  const h = host()
  const s = new Supervisor(h)
  const p = s.spawn({ name: 'lead', program: `
(remember 'goal "make ci green")
(remember 'task "T3")
(remember 'branch "lacuna-t3")
(define kid (spawn 'kid "(define first #f) (on 'start (lambda (pk) (if first #f (set! first 'start)) (remember 'first first) (remember 'goal (get pk 'goal)) (remember 'from (get pk 'parent)) (every 60 (lambda () #t))))"))
(remember 'kid kid)` })
  const kid = s.workers.get(p.kv.kid)
  assert.equal(kid.kv.first.$sym, 'start')
  assert.equal(kid.kv.goal, 'make ci green')
  assert.equal(kid.kv.from, p.id)
  const d = describe(kid)
  assert.equal(d.packet.goal, 'make ci green')
  assert.equal(d.packet.task, 'T3')
  assert.equal(d.packet.branch, 'lacuna-t3')
  assert.equal(d.packet.parent, p.id)
  assert.equal(d.steps, 1)
  // a packet handed to spawn is kept as given (only its own keys)
  const q = s.spawn({ name: 'given', program: `(every 60 (lambda () #t))`, packet: { goal: 'g', task: 't', cortex_refs: ['c:1'], junk: 1 } })
  assert.deepEqual(Object.keys(q.packet).sort(), ['branch', 'cortex_refs', 'deadline', 'done_so_far', 'goal', 'parent', 'task'])
  assert.deepEqual(q.packet.cortex_refs, ['c:1'])
  assert.equal(describe(s.spawn({ name: 'root', program: `(every 60 (lambda () #t))` })).packet, null)
  for (const id of s.workers.keys()) s.stop(id)
})

// spec: design §13 (what the desk reads) · eng §3.3 ticket fields
// class: L5 the ledger row's shape (here: the desk row's shape)
// technique: fake clock 3 s after the load; both readers (describe and the tree node)
// method: read every alive field on both: the ticket's keys, age 3 s, deadline in 7 s, timers 1, subs 1, beat age 3 s,
//         checkpoint time, steps 0, the tool counts per verb
// sre: can the owner see from the card what a worker waits on and how long it has waited?
test('the description and the tree node expose pending, timers, subs, beat, packet, checkpoint, steps, tools', () => {
  const h = host({ checkpoint: () => {} })
  const s = new Supervisor(h)
  const w = s.spawn({ name: 'reader', program: `(every 60 (lambda () #t)) (subscribe 'disk_free_pct 60) (remember 'a 1) (recall 'a) (hand 'jobs) (report 'hi 1)` })
  h.tick(3)
  for (const d of [describe(w), node(w)]) {
    assert.equal(d.pending.length, 1)
    assert.deepEqual(Object.keys(d.pending[0]).sort(), ['age_s', 'deadline_in_s', 'kind', 'op', 'ticket', 'tries', 'waiting'])
    assert.equal(d.pending[0].op, 'jobs'); assert.equal(d.pending[0].kind, 'hand')
    assert.equal(d.pending[0].age_s, 3); assert.equal(d.pending[0].deadline_in_s, DEADLINES.hand - 3); assert.equal(d.pending[0].tries, 1)
    assert.equal(d.timers, 1)
    assert.equal(d.subs, 1)
    assert.equal(d.last_beat, 1000)
    assert.equal(d.beat_age_s, 3)
    assert.equal(d.packet, null)
    assert.equal(d.checkpoint_t, 1000)
    assert.equal(d.steps, 0)
    assert.equal(d.stall_reason, null)
    assert.equal(d.minds_in_flight, 0)
    assert.deepEqual(d.tools, { every: 1, timer: 1, subscribe: 1, remember: 1, recall: 1, hand: 1, report: 1 })
  }
  s.stop(w.id)
})
