// alive-checkpoint.test.mjs — U1 unit tests for `alive.mjs` checkpoints, re-arming and the context packet: a foreman
// restart resumes a worker from its last checkpoint, never as a blank worker.
// owns: checkpointStore (tmp + rename, read, drop, the id as a file name), snapshot and resume of a run, rearm (load
//   timers skipped, step timers by name or by closure, lost timers counted), packetOf/packetFrom, aliveFields.
// refuses: to mock alive.mjs; files live only under /private/tmp/lacuna-unit/U1/ and are removed by each test.
// implements: design §6 (checkpoints; a restart resumes), §8 (on foreman restart: resume from checkpoint), change 5;
//   eng §3.5 (rings), §10.2 (kill -9 → back: kv + timers intact).
// invariants: a foreman restart resumes from the checkpoint (module header); "If a step is done, a ticket closed it"
//   (tickets survive the restart with their deadlines).
// faults: F-06 (a resumed worker with nothing to wake it is judged by the zombie law like any other).
// coverage: alive.mjs — see alive.test.mjs (the four alive*.test.mjs files together)
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { checkpointStore, snapshot, rearm, nameOf, packetOf, aliveFields } from '../alive.mjs'
import { Supervisor } from '../supervisor.mjs'
import { fileRun } from '../intents.mjs'
import { makeSup, makeHost, DEADLINES } from '../../../test/conformance/fake-host.mjs'

const DEADLINES_MIND = DEADLINES.mind, DEADLINES_BEAT = DEADLINES.beat

const ROOT = '/private/tmp/lacuna-unit/U1'
const scratch = (tag) => { fs.mkdirSync(ROOT, { recursive: true }); return fs.mkdtempSync(path.join(ROOT, `${tag}-`)) }
const stopAll = (s) => { for (const id of s.workers.keys()) s.stop(id, 'test over') }

// spec: design §6 (checkpoints written whole or not at all) · eng §10.2 kill -9 → back
// class: M7 APFS rename atomicity (tmp + rename); J11 fs ENOENT, a partial write
// technique: fault injection on real files: a missing checkpoint, a torn one, a never-written drop, a hostile id
// method: write through the store into a directory that does not exist yet (created), list the directory (no tmp left),
//         read a missing id (null), truncate the file to half and read (null, never a throw), drop twice; write under the
//         id "../../escape" and read the directory: the file stays inside it
// sre: if the box loses power mid-write, does the next foreman read a torn checkpoint as "none" and go on?
test('the store writes whole files by tmp + rename, reads a torn or missing one as null, and keeps every id inside its dir', () => {
  const dir = path.join(scratch('ckpt'), 'deep', 'ckpt')
  const store = checkpointStore(dir)
  store.write('w-1', { v: 1, kv: { n: 7 } })
  assert.deepEqual(fs.readdirSync(dir), ['w-1.json'])
  assert.deepEqual(store.read('w-1'), { v: 1, kv: { n: 7 } })
  assert.equal(store.read('w-none'), null)
  const f = path.join(dir, 'w-1.json')
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').slice(0, 8))
  assert.equal(store.read('w-1'), null, 'a torn checkpoint is no checkpoint')
  store.drop('w-1'); store.drop('w-1')
  assert.deepEqual(fs.readdirSync(dir), [])
  store.write('../../escape', { v: 1 })
  assert.deepEqual(fs.readdirSync(dir), ['.._.._escape.json'])
  fs.rmSync(path.dirname(path.dirname(dir)), { recursive: true, force: true })
})

// spec: design §6 (a disk that refuses is noted on the worker, never a crash of it) · eng §10.2
// class: J11 fs ENOSPC / EISDIR (the checkpoint cannot be written)
// technique: fault injection twice: a host whose checkpoint throws ENOSPC; a real store whose target is a directory
// method: spawn a worker on each; handle one event; read `checkpointError` (the sentence), the worker's state (running)
//         and its next step, which still runs
// sre: if the disk is full, does every worker keep working with the error on the record, instead of crashing in a loop?
test('a checkpoint the disk refuses is an error on the worker, never a crash of it', () => {
  const { h, s } = makeSup()
  h.checkpoint = () => { const e = new Error('ENOSPC: no space left on device, write'); e.code = 'ENOSPC'; throw e }
  const w = s.spawn({ name: 'full', program: `(on 'go (lambda (x) (remember 'n x)))` })
  assert.equal(s.send(w.id, 'go', 1).ok, true)
  assert.match(w.checkpointError, /^ENOSPC: no space left on device/)
  assert.equal(w.state, 'running'); assert.equal(w.kv.n, 1)
  const dir = scratch('eisdir')
  const store = checkpointStore(dir)
  const h2 = makeHost(); h2.checkpoint = (id, d) => store.write(id, d)
  const s2 = new Supervisor(h2)
  fs.mkdirSync(path.join(dir, 'w1.json', 'occupied'), { recursive: true })
  const w2 = s2.spawn({ name: 'blocked', program: `(on 'go (lambda (x) (remember 'n x)))` })
  assert.equal(s2.send(w2.id, 'go', 2).ok, true)
  assert.match(w2.checkpointError, /EISDIR|ENOTEMPTY|EEXIST|EPERM/)
  h2.checkpoint = () => { throw 'a bare string' }
  s2.send(w2.id, 'go', 3)
  assert.equal(w2.checkpointError, 'a bare string')
  fs.rmSync(dir, { recursive: true, force: true })
})

// spec: design §8 (on foreman restart: resume from checkpoint) · eng §10.2 (P7 finding 4: the hop window starts again)
// class: E12 the supervisor itself dies (kill -9; resume from the record)
// technique: process-restart simulation: snapshot written to disk, a new Supervisor on a later clock reads it
// method: file a run with a checkpoint store; read the checkpoint (run hands/acts as arrays, the contract, awaiting);
//         resume it 500 s later in a new Supervisor; read the run's sets, the contract (same key and goal), the awaiting
//         window (since = now, span ≥ 60 s) and the "resumed from its checkpoint of HH:MM:SS" thought
// sre: if the foreman is killed mid-run, does the run come back with its contract and a fresh hop window, not stalled?
test('a run comes back from its checkpoint with its contract, its header sets and a fresh hop window', () => {
  const dir = scratch('run')
  const store = checkpointStore(dir)
  const h = makeHost(); h.checkpoint = (id, d) => store.write(id, d)
  const s = new Supervisor(h)
  const w = fileRun(s, { key: 'r-ck', goal: 'g', hands: ['jobs', 'disk'] })
  const ck = store.read(w.id)
  assert.deepEqual(ck.run.hands.sort(), ['disk', 'jobs'])
  assert.deepEqual(ck.run.acts, [])
  assert.equal(ck.contract.key, 'r-ck'); assert.equal(ck.verbs.length, 0); assert.equal(ck.readsUntrusted, false)
  const h2 = makeHost(); h2.tick(500)
  const s2 = new Supervisor(h2)
  const r = s2.resume(ck)
  assert.ok(r.run.hands instanceof Set && r.run.hands.has('jobs'))
  assert.equal(r.contract.goal, 'g')
  assert.equal(r.awaiting.since, h2.now())
  assert.equal(r.awaiting.due - r.awaiting.since, 60, 'the 50 s hop of the fake host, floored at 60 s')
  assert.equal(r.started, ck.started, 'the desk\'s started is when it first began')
  assert.ok(r.thoughts.some((t) => /^resumed from its checkpoint of \d\d:\d\d:\d\d: 0 ticket/.test(t.text)))
  const bare = s2.resume({ ...ck, id: 'w-bare', t: null, awaiting: { since: 1, due: 1 }, started: null, run: null, contract: null })
  assert.ok(bare.thoughts.some((t) => /^resumed from its checkpoint: /.test(t.text)), 'no time when the checkpoint has none')
  assert.equal(bare.awaiting.due - bare.awaiting.since, 300, 'a zero span falls back to 300 s')
  stopAll(s); stopAll(s2)
  fs.rmSync(dir, { recursive: true, force: true })
})

// spec: design §6 change 5 · eng §10.2 (timers intact after kill -9) · E17 (re-armed by name; never doubled)
// class: E17 timers after restart
// technique: fault injection on the checkpoint: the program changed between foremen and a named procedure is gone
// method: a worker arms (after 300 later) and (after 60 (lambda …)) in a step, and its load arms (every 60 …); snapshot it;
//         rename `later` in the spec to a name the program lacks; resume in a new Supervisor: the load timer is armed
//         once (by the load), the named one is lost, the lambda is lost (no closure across processes); read the thought
//         and lostTimers; then rearm the same snapshot in-process with the closure ref: armed, not doubled
// sre: if a cart was edited between foreman versions, does it say which timers it lost instead of silently forgetting?
test('re-arming after a restart: load timers by the load, step timers by name or closure, a lost one is said and counted', () => {
  const { s } = makeSup()
  const w = s.spawn({ name: 'planner', program: `(define (later) (report 'later 1))
(every 60 (lambda () #t))
(on 'go (lambda (v) (after 300 later) (after 60 (lambda () #t))))` })
  s.send(w.id, 'go', 1)
  const ck = JSON.parse(JSON.stringify(snapshot(s, w)))
  assert.deepEqual(ck.timers.map((t) => [t.verb, t.origin, t.fn]), [['every', 'load', null], ['after', 'step', 'later'], ['after', 'step', null]])
  ck.timers[1].fn = 'renamed-away'
  const { s: s2 } = makeSup()
  const r = s2.resume(ck)
  assert.equal(r.timers.length, 1, 'only the load\'s own timer; nothing doubled')
  assert.equal(r.lostTimers, 2)
  assert.ok(r.thoughts.some((t) => /2 timer\(s\) armed with an unnamed procedure could not be armed again/.test(t.text)))
  const inProcess = { ...snapshot(s, w), timers: w.timers.map((t) => ({ ...t.spec, ref: t.fnRef })), subs: [{ metric: 'disk_free_pct', seconds: 60 }] }
  const before = w.timers.length
  const got = rearm(s, w, inProcess)
  assert.deepEqual(got, { armed: 2, lost: 0 })
  assert.equal(w.timers.length, before + 2)
  rearm(s, w, inProcess)
  assert.equal(w.subs.filter((x) => x.metric === 'disk_free_pct').length, 1, 'a subscription is never doubled')
  stopAll(s); stopAll(s2)
})

// spec: design §6 (the context packet: a child's first event) · eng §3.5 (rings: bounded)
// class: B1 every *_KEPT bound holds under 10× its size
// technique: boundary: 10× the list bound, 10× the text bound, every non-object shape
// method: packetOf over 200 done_so_far items, a 4,000-char goal, a number task, a string cortex_refs, objects in lists,
//         null, a string; read the clipped packet
// sre: if a parent's kv holds a megabyte of history, does every child's packet stay small?
test('a packet keeps only its own keys and stays bounded at 10× its sizes', () => {
  const p = packetOf({ goal: 'g'.repeat(4000), task: 7, parent: 'p'.repeat(100), branch: 'b'.repeat(200), done_so_far: Array.from({ length: 200 }, (_, i) => ({ i })),
    cortex_refs: 'c:1', junk: 'x' })
  assert.equal(p.goal.length, 400); assert.equal(p.task, 7); assert.equal(p.parent.length, 60); assert.equal(p.branch.length, 120)
  assert.equal(p.done_so_far.length, 20); assert.equal(p.done_so_far[0], '{"i":180}')
  assert.deepEqual(p.cortex_refs, ['c:1'])
  assert.equal('junk' in p, false)
  assert.equal(packetOf(null), null); assert.equal(packetOf('a goal'), null)
  assert.deepEqual(packetOf({}).done_so_far, [])
})

// spec: design §6 (a child's packet from its parent: kv, else the parent's packet, else a cart's does and steps)
// class: E11 an orphan (what a child knows of its parent when the parent's kv says nothing)
// technique: state walk over the three sources
// method: a cart parent with no kv spawns a child (goal = the cart's does, done_so_far = its done steps); a plain parent
//         given a packet spawns a child (every field from the packet, the deadline too)
// sre: if a child is born from a cart with no notes, does it still know what the run is for?
test('a child\'s packet comes from the parent\'s kv, else its packet, else its cart', () => {
  const { s } = makeSup()
  const c = s.spawn({ name: 'lead', program: `(lacuna-cart 'lead '((does . "fix the build") (done . "green") (agent . ((tier . watch) (verbs . (on spawn report))))))
(define (start) (spawn 'kid "(every 60 (lambda () #t))"))` })
  const kid = s.workers.get(c.children[0])
  assert.equal(kid.packet.goal, 'fix the build')
  assert.match(kid.packet.done_so_far[0], /^load: header read/)
  const p = s.spawn({ name: 'p', program: `(define k (spawn 'k2 "(every 60 (lambda () #t))"))`,
    packet: { goal: 'pg', task: 'pt', done_so_far: ['a'], cortex_refs: ['c'], branch: 'b', deadline: 99 } })
  const k2 = s.workers.get(p.children[0])
  assert.deepEqual({ ...k2.packet }, { goal: 'pg', task: 'pt', parent: p.id, done_so_far: ['a'], cortex_refs: ['c'], branch: 'b', deadline: 99 })
  stopAll(s)
})

// spec: design §13 (what the desk reads) · eng §3.3
// class: J14 clock jumps (a record with no clock of its own reads the wall clock)
// technique: state walk: a bare record (a non-living row the foreman lists), a press ticket with no deadline
// method: aliveFields over a bare object (no clock, no beat) and over one with a press ticket; read nulls where nothing
//         is known; nameOf on a record without an env
// sre: does the desk show "—" for a buried worker's beat instead of a nonsense age from 1970?
test('the desk fields of a bare record say null where nothing is known', () => {
  const f = aliveFields({})
  assert.deepEqual([f.pending, f.timers, f.subs, f.last_beat, f.beat_age_s, f.missed_beats, f.packet, f.checkpoint_t, f.stall_reason, f.resumed_from],
    [[], 0, 0, null, null, 0, null, null, null, null])
  const t = Date.now() / 1000
  const g = aliveFields({ pending: [{ ticket: 'a', op: 'pass', kind: 'press', sent_at: t - 5, deadline_at: null, tries: 1 }] })
  assert.equal(g.pending[0].deadline_in_s, null); assert.ok(g.pending[0].age_s >= 5 && g.pending[0].age_s < 60)
  assert.equal(nameOf({}, () => 1), null)
})

// spec: design §6 (a worker from before §45.3 comes back from its record and the zombie law judges it like any other)
// class: E16 a stale checkpoint older than the record (a record shape from an older foreman)
// technique: fault injection of record shapes: workers and checkpoints missing every optional §45.3 field
// method: call aliveConfig, closeTicket, adoptTicket, freshTicket, snapshot and rearm on bare shapes; then put three
//         bare running records in a Supervisor (one waiting on a mind long gone, one with no beat, one with no children
//         list and a fresh beat) and sweep twice; read the records: a `restarted` row then a MISSED stop for the first, a
//         STALLED stop for the second, nothing for the third — never a throw from the sweep
// sre: if the foreman upgrades under a worker whose record predates tickets and beats, does one sweep crash the daemon?
test('records from an older foreman (no tickets, no beat, no timers) pass every rule without a throw', async () => {
  const { aliveConfig, closeTicket, adoptTicket, freshTicket, STALLED, MISSED } = await import('../alive.mjs')
  assert.deepEqual(aliveConfig({}), { hand: 120, act: 600, acts: {}, beat: 30, mind: 360, sweep: 10 })
  assert.deepEqual(aliveConfig({ deadlines: { hand: 1, acts: { pass: 9 } } }).acts, { pass: 9 })
  assert.equal(closeTicket(null, {}, 'hand', { op: 'jobs' }), null)
  assert.equal(adoptTicket({ loading: true, adoptable: new Set(['t']) }, 'hand', 'jobs', []), null)
  assert.equal(adoptTicket({ loading: true, adoptable: new Set(['t']), pending: [{ ticket: 't', kind: 'hand', op: 'jobs', args: ['a'] }] }, 'hand', 'jobs', ['b']), null, 'other args: asked anew')
  assert.equal(adoptTicket({ loading: true, adoptable: new Set(['t']), pending: [{ ticket: 't', kind: 'press', op: 'pass', args: [] }] }, 'act', 'pass', []), 't', 'an act adopts its press ticket')
  assert.equal(freshTicket({ pending: [{ ticket: 'x' }] }, 'x'), 'x.1')
  const { h, s } = makeSup()
  h.checkpoint = () => {}
  const ck = snapshot(s, { id: 'old', name: 'old' })
  assert.deepEqual([ck.verbs, ck.pending, ck.timers, ck.subs, ck.children, ck.packet, ck.mind, ck.restarts, ck.last_beat, ck.contract, ck.run, ck.awaiting],
    [[], [], [], [], [], null, null, 0, null, null, null, null])
  assert.deepEqual(snapshot(s, { id: 'old', pending: [{ ticket: 'a' }] }).pending, [{ ticket: 'a', was: [] }], 'a ticket from before re-sends')
  assert.deepEqual(rearm(s, { subs: [] }, {}), { armed: 0, lost: 0 })
  const base = (id, o) => ({ id, name: id, program: '(define x 1)', tier: 'watch', state: 'running', handlers: new Map(), crashes: [], kv: {},
    verbs: new Set(), literals: new Set(), started: h.now(), depth: 1, reports: [], ...o })
  const minder = base('minder', { children: [], minding: [{ at: h.now() }] })
  const quiet = base('quiet', { children: [] })
  const fresh = base('fresh', { lastBeat: h.now() + 10_000 })
  for (const w of [minder, quiet, fresh]) s.workers.set(w.id, w)
  h.tick(DEADLINES_MIND + 2 * DEADLINES_BEAT); s.sweep()
  assert.equal(h.up.filter((u) => u.kind === 'restarted' && u.name === 'minder').length, 1)
  assert.equal(quiet.state, 'stalled'); assert.equal(quiet.stallReason, STALLED)
  h.tick(DEADLINES_BEAT); s.sweep()
  assert.equal(minder.stallReason, MISSED)
  assert.equal(fresh.state, 'running', 'a record with a beat inside its window is left alone')
})
