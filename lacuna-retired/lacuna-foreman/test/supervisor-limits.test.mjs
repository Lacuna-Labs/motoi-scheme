// supervisor-limits.test.mjs — U1 unit tests for the supervisor's bounds: every `LIMITS` number held at the number and
// the number + 1, the bounded mailbox, fuel per load, per event and per minute, and the manners that hush a busy foreman.
// owns: the proofs that spawn refuses past each ceiling with a sentence (workers 64, depth 3, children 8 living, program
//   64,000 chars, tier, parent), that a paused worker's mailbox holds 100 in order and counts its drops, and that fuel
//   stops a loop at load and in a handler without stopping the foreman.
// refuses: to mock supervisor.mjs; every test runs real programs on a real Supervisor and a fake clock (makeSup).
// implements: design §6 (fuel; LIMITS; the mailbox; manners), §10 (ceilings); eng §3.5 (fuel 200,000/50,000/2,000,000
//   per minute, mailbox 100, workers 64, depth 3, children 8), §10.2 (ceilings refused with a sentence each).
// invariants: "the supervisor only supervises" (a bound is a refusal on the record, never a crash of the foreman).
// faults: F-04 (a program that cannot load: the grave), F-06 (a hushed foreman skips background turns, counted).
// coverage: supervisor.mjs — see supervisor.test.mjs (the supervisor*.test.mjs files together)
import test from 'node:test'
import assert from 'node:assert/strict'
import { makeSup } from '../../../test/conformance/fake-host.mjs'
import { LIMITS, MANNERS } from '../supervisor.mjs'
import { interrupt } from '../talk.mjs'

const stopAll = (s) => { for (const id of s.workers.keys()) s.stop(id, 'test over') }
const IDLE = `(every 60 (lambda () #t))`

// spec: design §6 (LIMITS) · eng §3.5 workers 64 · §10.2 (ceilings refused with a sentence each)
// class: B7 workers 65, depth 4, children 9, filedEach 9
// technique: boundary: the 64th worker and the 65th; a retired worker makes room
// method: spawn 64 workers (all running); the 65th throws "this foreman already runs 64 workers"; stop one; the 65th lands
// sre: if a cart spawns in a loop, does the foreman stop at 64 with a sentence instead of eating the box?
test('the 65th worker is refused with a sentence; a stopped one makes room', () => {
  const { s } = makeSup()
  const ws = Array.from({ length: LIMITS.workers }, (_, i) => s.spawn({ name: `w${i}`, program: IDLE }))
  assert.equal(s.living().length, 64)
  assert.throws(() => s.spawn({ name: 'w64', program: IDLE }), /^Error: this foreman already runs 64 workers$/)
  s.stop(ws[0].id)
  assert.equal(s.spawn({ name: 'w64', program: IDLE }).state, 'running')
  stopAll(s)
})

// spec: design §6 (LIMITS depth 3, children 8) · §11 (a child ≤ its parent) · eng §3.5
// class: B7 workers 65, depth 4, children 9, filedEach 9
// technique: boundary: depth 3 and 4; the 8th and 9th living child, where some living children are paused
// method: build a chain 3 deep, the 4th is refused; a parent with 8 children of which 4 are paused (by the owner) is
//         refused a 9th; a child asking for a higher tier than its parent gets the parent's tier
// sre: if the owner pauses a few children, can the parent spawn past its ceiling while they sleep? A paused child lives.
test('depth 4 is refused; a 9th living child is refused even when some are paused', () => {
  const { s } = makeSup()
  let parent = s.spawn({ name: 'd1', program: IDLE }).id
  for (let d = 2; d <= LIMITS.depth; d++) parent = s.spawn({ name: `d${d}`, program: IDLE, parent }).id
  assert.throws(() => s.spawn({ name: 'd4', program: IDLE, parent }), /^Error: a worker may be at most 3 deep$/)
  const p = s.spawn({ name: 'lead', tier: 'watch', program: `(on 'go (lambda (x) (spawn 'kid "(every 60 (lambda () #t))" 'act)))` })
  for (let i = 0; i < LIMITS.childrenEach; i++) assert.equal(s.send(p.id, 'go', 0).ok, true)
  assert.ok(p.children.every((c) => s.workers.get(c).tier === 'watch'), 'a child never outranks its parent')
  for (const c of p.children.slice(0, 4)) interrupt(s, c, 'pause')
  const r = s.send(p.id, 'go', 0)
  assert.equal(r.ok, false)
  assert.match(r.why, /lead already has 8 children$/)
  assert.throws(() => s.spawn({ name: 'x', program: IDLE, parent: 'w-gone' }), /^Error: no parent w-gone$/)
  stopAll(s)
})

// spec: design §6 (a worker needs a program; programBytes 64,000; tiers watch|act) · eng §3.5
// class: J10 HTTP body too large (here: a program too large)
// technique: boundary: 64,000 and 64,001 characters; an empty program, a non-string, an unknown tier
// method: spawn each; read the sentence each refusal throws; the 64,000-char program loads
// sre: if a brain writes a 1 MB cart, is it refused before the reader spends a second on it?
test('a program is text of at most 64,000 characters, under a tier the foreman knows', () => {
  const { s } = makeSup()
  const pad = (n) => `(define x 1)${' '.repeat(n - 12)}`
  assert.equal(s.spawn({ name: 'max', program: pad(LIMITS.programBytes) }).state, 'running')
  assert.throws(() => s.spawn({ name: 'big', program: pad(LIMITS.programBytes + 1) }), /^Error: the program is over 64000 bytes$/)
  assert.throws(() => s.spawn({ name: 'none', program: '' }), /^Error: a worker needs a program \(slat text\)$/)
  assert.throws(() => s.spawn({ name: 'num', program: 42 }), /needs a program/)
  assert.throws(() => s.spawn({ name: 'root', program: IDLE, tier: 'root' }), /^Error: tier is one of watch, act$/)
  stopAll(s)
})

// spec: design §6 (the mailbox: bounded, counted, ordered) · eng §3.5 mailbox 100
// class: B6 the mailbox at 101; E5 mailbox overflow
// technique: boundary: 100 and 101 messages to a paused worker; then the resume
// method: pause a worker; send 101 events it handles; the 101st pushes out the oldest (mailboxDropped 1, queued 100);
//         an event it does not handle is refused, not queued; resume it: the 100 arrive in order (2 … 101)
// sre: if the owner pauses a busy worker for an hour, does its mailbox grow without a bound? It holds 100 and counts the rest.
test('a paused worker keeps 100 messages in order, drops the oldest past 100 and counts it', () => {
  const { s } = makeSup()
  const w = s.spawn({ name: 'box', program: `(on 'm (lambda (v) (remember 'seen (cons v (recall 'seen '()))))) ${IDLE}` })
  interrupt(s, w.id, 'pause')
  let r
  for (let i = 1; i <= LIMITS.mailbox + 1; i++) r = s.send(w.id, 'm', i)
  assert.deepEqual(r, { ok: true, queued: 100 })
  assert.equal(w.mailboxDropped, 1)
  assert.deepEqual(s.send(w.id, 'other', 1), { ok: false, why: 'the worker is paused' })
  interrupt(s, w.id, 'resume')
  const seen = w.kv.seen.slice().reverse()
  assert.equal(seen.length, 100); assert.equal(seen[0], 2); assert.equal(seen.at(-1), 101)
  stopAll(s)
})

// spec: design §6 (fuel: a loop stops itself) · eng §3.5 fuel 200,000 to load, 50,000 per event · §10.2 (4 ms)
// class: E6 an infinite loop (fuel)
// technique: boundary: a loop at load and a loop in a handler, timed on the wall clock
// method: a program that loops at load goes to the grave with the fuel sentence; a handler that loops crashes once and
//         the worker restarts; both inside 1 s of wall time; the foreman's other worker still answers
// sre: if a cart has an infinite loop, does it cost the box a few milliseconds and a record, never the foreman?
test('fuel stops a loop at load (the grave) and in a handler (a crash), and the foreman goes on', () => {
  const { h, s } = makeSup()
  const t0 = performance.now()
  const atLoad = s.spawn({ name: 'spin-load', program: `(define (spin) (spin)) (spin)` })
  assert.equal(atLoad.state, 'grave'); assert.match(atLoad.last, /^load: .*fuel/)
  const inHandler = s.spawn({ name: 'spin-go', program: `(define (spin) (spin)) (on 'go (lambda (x) (spin)))` })
  assert.equal(s.send(inHandler.id, 'go', 1).restarted, true)
  assert.ok(performance.now() - t0 < 1000)
  const other = s.spawn({ name: 'fine', program: `(on 'go (lambda (x) (remember 'ok #t)))` })
  s.send(other.id, 'go', 1)
  assert.equal(other.kv.ok, true)
  assert.ok(h.up.some((u) => u.kind === 'child-graved' && u.name === 'spin-load'))
})

// spec: design §6 (manners) · eng §3.5 (fuel 2,000,000 per minute; manners judged every 15 s)
// class: J3 the event loop blocked (a worker that burns its minute's fuel is slowed, not killed)
// technique: boundary across the minute: burn past 2,000,000 steps in one minute, then cross into the next minute
// method: a worker burns ~44,000 steps per event in the foreground 46 times (past the minute's budget); a background
//         event is skipped with "it spent its fuel for this minute" and counted; a foreground event still lands; the
//         next minute a background event lands again
// sre: if one cart hogs the CPU, does the foreman slow that cart alone, while the owner's own events still get through?
test('a worker that spends its minute\'s fuel skips background turns until the minute turns', () => {
  const { h, s } = makeSup()
  const w = s.spawn({ name: 'hog', program: `(define (burn n) (if (> n 0) (burn (- n 1)) 0)) (on 'go (lambda (x) (burn 4000))) (on 'bg (lambda (x) (remember 'bg x)))` })
  for (let i = 0; i < 1000 && !(w.fuelUsed > MANNERS.fuelPerMinute); i++) assert.equal(s.send(w.id, 'go', 1).ok, true)
  assert.ok(w.fuelUsed > MANNERS.fuelPerMinute)
  const r = s.send(w.id, 'bg', 1, { background: true })
  assert.deepEqual([r.skipped, r.why, w.skipped], [true, 'it spent its fuel for this minute', 1])
  assert.equal(s.send(w.id, 'bg', 2).ok, true, 'a person\'s event is never skipped')
  h.tick(60)
  assert.equal(s.send(w.id, 'bg', 3, { background: true }).ok, true)
  assert.equal(w.kv.bg, 3)
})

// spec: design §6 (manners: a hushed foreman refuses new spawns; a worker coming back is not new) · eng §3.5
// class: M6 memory pressure (the box is busy; the foreman hushes)
// technique: fault injection: host.manners answers a reason
// method: a hushed host refuses a new spawn with the reason; a resume (a spawn with an id, from a checkpoint) lands
// sre: if the box is out of memory when the foreman restarts, do its workers still come back? They must; new ones wait.
test('a hushed foreman refuses a new worker but still brings one back from its checkpoint', () => {
  const { h, s } = makeSup()
  const w = s.spawn({ name: 'kept', program: IDLE })
  h.manners = () => 'the box has 300 MB free'
  assert.throws(() => s.spawn({ name: 'new', program: IDLE }), /^Error: not now — the foreman is hushed: the box has 300 MB free$/)
  s.workers.delete(w.id)
  const back = s.spawn({ name: 'kept', program: IDLE, id: w.id })
  assert.equal(back.state, 'running')
  stopAll(s)
})
