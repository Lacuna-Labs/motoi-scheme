// kick.test.mjs — U1 unit tests for `kick.mjs`, the kick rule by promise id (K2).
// owns: the proofs that a late promise is kicked once by its id and its deadline extended once; that a second miss ends
//   the run with exit 99 and exactly one letter; that a run with no intent by its hop deadline ends the same way, and an
//   unclaimed run waits its hour first; that the sweep skips what it must not touch and survives clock jumps.
// refuses: to mock kick.mjs; every test files real runs through intents.mjs on a real Supervisor and a fake clock.
// implements: design §9 (the kick rule: once extended, twice exit 99 + letter), §17 (99), §8 (kicks, the 17th field);
//   eng §3.5 (UNCLAIMED_S 3,600; hop 300/900/120; promise deadline extended once by the same span).
// invariants: "If a promise is open past its deadline, then a kick was sent; if two, exit 99."
// faults: F-03 (a promise missed twice), F-06 (no intent by the hop deadline).
// coverage: kick.mjs — lines 100% branches 96.88% functions 100% (2026-10-24; line 17's null branch named in a todo)
import test from 'node:test'
import assert from 'node:assert/strict'
import { Supervisor } from '../supervisor.mjs'
import { fileRun, intent, result, said, awaitBrain } from '../intents.mjs'
import { contractPromise, contractResolve, KICKS_KEPT } from '../contract.mjs'
import { kickSweep, UNCLAIMED_S } from '../kick.mjs'
import { makeSup } from '../../../test/conformance/fake-host.mjs'

const DEADLINES = { hand: 100, act: 400, beat: 5, mind: 20, hop: 50 }
function host() {
  let t = 1000, n = 0
  const up = [], letters = []
  return { up, letters, tick: (s) => { t += s }, deadlines: DEADLINES, now: () => t, id: () => `w${++n}`, save: () => {},
           upstream: (kind, w, data) => up.push({ kind, name: w.name, data }), mail: (m) => letters.push(m) }
}
const CART = `(lacuna-cart 'checker '((does . "checks") (agent . ((tier . watch) (verbs . (on report done)))) (done . "checked")))
(on 'x (lambda (v) v))`

// spec: design §9 (the kick rule) · eng §3.5 promise deadline · F-03 · I "a promise open past its deadline → a kick"
// class: E8 a deadline passed
// technique: time travel on a fake host clock (one tick past the promise's deadline)
// method: file a run, send an intent with a 20 s promise, move the clock 21 s, sweep; read the kick row on the contract
//         (verdict, category, promise id), the extended deadline, a second sweep inside the extension, then the result
// sre: if the brain says it will act and goes quiet, does the foreman notice by id within one sweep and give it one more span?
test('a promise past its deadline is kicked once by id; kept after the kick, the run goes on', () => {
  const h = host(); const s = new Supervisor(h)
  const w = fileRun(s, { key: 'r-1', goal: 'g' })
  const i = intent(s, w.id, { tool: 'jobs', promise: 'the job count', deadline_s: 20 })
  h.tick(21)
  const k = kickSweep(s)
  assert.deepEqual(k.kicked, [{ run: w.id, promise: 'p-1' }]); assert.equal(k.ended.length, 0)
  const p = w.contract.promises[0]
  assert.equal(p.kicks, 1); assert.equal(p.deadline_at, h.now() + 20); assert.deepEqual(w.contract.kicks.map((x) => [x.verdict, x.category, x.evidence.promise]), [['kick', 'deadline', 'p-1']], 'the typed kick record (O-80)')
  assert.equal(kickSweep(s).kicked.length, 0, 'not kicked twice inside the extension')
  result(s, w.id, 'hand', { ticket: i.ticket, op: 'jobs', ok: true })
  assert.equal(p.state, 'kept'); assert.equal(w.state, 'running')
})

// spec: design §9 · §17 exit 99 · F-03 · I "if two, exit 99"
// class: E8 a deadline passed
// technique: time travel: two ticks, each past the promise's (extended) deadline
// method: kick once, miss again, sweep; read the contract (exit, outcome, state), the promise (broken) and the letter
// sre: if the brain misses the same promise twice, does a person hear about it exactly once, with the promise named?
test('a second miss ends the run: exit 99, outcome fail, a letter to Claude naming the promise', () => {
  const h = host(); const s = new Supervisor(h)
  const w = fileRun(s, { key: 'r-2', goal: 'g' })
  intent(s, w.id, { tool: 'jobs', promise: 'the job count', deadline_s: 20 })
  h.tick(21); kickSweep(s)
  h.tick(21)
  const k = kickSweep(s)
  assert.deepEqual(k.ended, [{ run: w.id, why: 'F-03', promise: 'p-1' }])
  assert.equal(w.state, 'stalled'); assert.deepEqual([w.contract.exit, w.contract.outcome, w.contract.state], [99, 'fail', 'stalled'])
  assert.equal(w.contract.promises[0].state, 'broken')
  assert.equal(h.letters.length, 1); assert.match(h.letters[0].evidence.detail, /F-03: promise p-1/); assert.equal(h.letters[0].run, 'r-2')
})

// spec: design §9 · §16 F-06 · §17 exit 99 · eng §3.5 hop normal 300 s (50 s on the fake host)
// class: E8 a deadline passed
// technique: boundary: the hop deadline − 1 s and the hop deadline
// method: one hop first (an unclaimed run waits an hour), then tick to due − 1 (nothing) and due (ended); read the
//         ended row, contract exit 99 and the letter's F-06 line
// sre: if the brain loop dies mid-run, does the run end on the minute its hop was due, not a sweep later or never?
test('no intent by the hop deadline is F-06: exit 99 and a letter', () => {
  const h = host(); const s = new Supervisor(h)
  const w = fileRun(s, { key: 'r-3', goal: 'g' })
  const i = intent(s, w.id, { tool: 'jobs' }); result(s, w.id, 'hand', { ticket: i.ticket, op: 'jobs', ok: true })   // one hop first: an unclaimed run waits an hour
  h.tick(DEADLINES.hop - 1)
  assert.equal(kickSweep(s).ended.length, 0)
  h.tick(1)
  assert.deepEqual(kickSweep(s).ended, [{ run: w.id, why: 'F-06' }])
  assert.equal(w.contract.exit, 99); assert.match(h.letters[0].evidence.detail, /F-06: no intent for 50 s \(normal\)/)
})

// spec: design §9 · eng §3.5 unclaimed run 3,600 s · F-06
// class: E7 a zombie (a run nobody has claimed must neither stall early nor wait forever)
// technique: time travel past the hop deadline, then past the hour
// method: file a run with no hop; sweep past the hop deadline (still running); sweep past the hour (stalled); a second
//         run with one hop is held to the hop deadline again
// sre: if six runs queue behind two drivers, do they wait their turn instead of stalling at 5 min?
test('a filed run no brain has taken yet is not stalled by the hop deadline for an hour; after its first intent the hop rule holds', () => {
  const h = host(); const s = new Supervisor(h)
  const w = fileRun(s, { key: 'r-q', goal: 'g' })
  h.tick(DEADLINES.hop + 1); s.sweep(); assert.equal(kickSweep(s).ended.length, 0); assert.equal(w.state, 'running', 'waiting for a driver')
  h.tick(3600); s.sweep(); kickSweep(s); assert.equal(w.state, 'stalled', 'an hour unclaimed is F-06')
  const w2 = fileRun(s, { key: 'r-q2', goal: 'g' }); const i = intent(s, w2.id, { tool: 'jobs' }); result(s, w2.id, 'hand', { ticket: i.ticket, op: 'jobs', ok: true })
  h.tick(DEADLINES.hop + 1); assert.deepEqual(kickSweep(s).ended, [{ run: w2.id, why: 'F-06' }], 'after a hop the brain owes the next intent by the hop deadline')
})

// spec: design §8 lifecycle (checkout at filing, standing press) · eng §3.5 unclaimed 3,600 s · F-06
// class: E7 a zombie
// technique: time travel in 30 s steps (the live sweep's cadence) for 13 min, then past the hour
// method: file a run with a repo (the checkout act), answer the act, sweep and kick every 30 s; read the state
// sre: if the checkout finishes before any driver arrives, does the run still wait for one (2026-10-23: 69 + 4 runs)?
test('a filed run whose checkout act already ended (no ticket open, no hop yet) still waits the hour for a driver', () => {
  const h = host(); const s = new Supervisor(h)
  const w = fileRun(s, { key: 'r-co', goal: 'g', repo: 'curator', press: 'standing' })
  const t = w.awaiting?.ticket || `${w.id}-checkout`
  result(s, w.id, 'act', { ticket: t, op: 'checkout', ok: true, exit: 0, rows: { dir: 'd', branch: `lacuna/${w.id}` } })
  assert.equal(w.run.hops, 0, 'an act result is not a hop')
  for (let t = 0; t < 13 * 60; t += 30) { h.tick(30); s.sweep(); assert.deepEqual(kickSweep(s), { kicked: [], ended: [] }) }   // every beat, as the live foreman sweeps
  assert.equal(w.state, 'running', '13 min unclaimed with the checkout done is neither F-06 nor missed beats (2026-10-23: 69 + 4 runs)')
  h.tick(3600); s.sweep(); kickSweep(s); assert.notEqual(w.state, 'running', 'an hour unclaimed ends the run (F-06, or its own deadline first)')
})

// spec: eng §3.5 unclaimed run 3,600 s · design §9 · F-06
// class: E8 a deadline passed
// technique: boundary: UNCLAIMED_S − 1 and UNCLAIMED_S, kickSweep alone (no zombie sweep)
// method: file a run with no hop; tick 3,599 s and sweep (running); tick 1 s and sweep (ended F-06, exit 99, one letter)
// sre: does the hour mean exactly an hour, so the desk's "waiting for a driver" never lies by a sweep?
test('an unclaimed run ends at exactly 3,600 s, not at 3,599 s', () => {
  const h = host(); const s = new Supervisor(h)
  const w = fileRun(s, { key: 'r-edge', goal: 'g' })
  h.tick(UNCLAIMED_S - 1)
  assert.deepEqual(kickSweep(s).ended, [])
  h.tick(1)
  assert.deepEqual(kickSweep(s).ended, [{ run: w.id, why: 'F-06' }])
  assert.deepEqual([w.contract.exit, h.letters.length], [99, 1])
})

// spec: design §9 (a `said` promise is watched; matched by id, never by words) · §8 kicks · eng §3.3
// class: E9 a message lost (the brain's promise had no call behind it)
// technique: time travel; read the event the run receives and the contract text the host writes
// method: a `said` "I will …" makes a promise with no ticket; past its deadline the sweep sends (on 'kick) with no ticket
//         and the host's contract writer receives the rendered contract carrying the kick
// sre: if the brain says "I will check" in prose and calls nothing, does the kick reach the run and the file on disk?
test('a promise made in prose has no ticket: the kick carries no ticket and the contract file records it', () => {
  const { h, s } = makeSup()
  const w = fileRun(s, { key: 'r-said', goal: 'g' })
  said(s, w.id, 'I will check the disk next')
  const p = w.contract.promises[0]
  assert.equal(p.ticket, null)
  const before = h.texts.length
  h.tick(s.alive.hand + 1)
  assert.deepEqual(kickSweep(s).kicked, [{ run: w.id, promise: 'p-1' }])
  const kick = w.thoughts.find((t) => t.kind === 'mail-in' && t.text.startsWith('kick'))
  assert.ok(kick, 'the run received (on \'kick …)')
  assert.match(kick.text, /"promise":"p-1".*"missed":1,"ticket":null/)
  assert.ok(h.texts.length > before && /kick/.test(h.texts.at(-1)), 'the host wrote the contract with the kick')
})

// spec: design §9 · §8 (a cart reads its contract) · F-03
// class: E9 a message lost (the receiver has no handler for the kick)
// technique: fault injection: a host with no contract writer; a cart with no (on 'kick …)
// method: a cart worker carries a contract; a promise on it goes late; sweep; read the kick row on the contract and the
//         thought line; nothing is sent to a handler the cart does not have, and no host.contract is called
// sre: if the receiver cannot hear a kick and the host has no file writer, does the kick still land on the record?
test('a kick on a cart with no kick handler and a host with no contract writer still lands on the contract', () => {
  const h = host(); const s = new Supervisor(h)
  const w = s.spawn({ name: 'checker', program: CART })
  contractPromise(s, w, 'check the disk', 10, 't-9')
  h.tick(11)
  assert.deepEqual(kickSweep(s).kicked, [{ run: w.id, promise: 'p-1' }])
  assert.equal(w.contract.kicks[0].evidence.promise, 'p-1')
  assert.ok(w.thoughts.some((t) => /kick: promise p-1 \(check the disk\) is late/.test(t.text)))
  assert.ok(!w.thoughts.some((t) => t.kind === 'mail-in' && t.text.startsWith('kick')))
})

// spec: design §9 (the kick rule refuses to kick a run that is not running) · F-03
// class: E7 a zombie (a stopped run must stay stopped)
// technique: state walk: a plain worker (no contract), a stopped run, a paused run
// method: each carries (or lacks) a late promise; sweep; nothing is kicked or ended and no letter is written
// sre: if the owner stops or pauses a run, can the kick rule wake it up or mail about it? It must not.
test('the sweep never kicks a worker without a contract, a stopped run, or a paused one', () => {
  const h = host(); const s = new Supervisor(h)
  s.spawn({ name: 'plain', program: `(on 'x (lambda (v) v))` })
  const stopped = fileRun(s, { key: 'r-s', goal: 'g' }); intent(s, stopped.id, { tool: 'jobs', promise: 'p', deadline_s: 5 })
  const paused = fileRun(s, { key: 'r-p', goal: 'g' }); intent(s, paused.id, { tool: 'jobs', promise: 'p', deadline_s: 5 })
  s.stop(stopped.id, 'stopped by the owner'); paused.state = 'paused'
  h.tick(UNCLAIMED_S * 2)
  assert.deepEqual(kickSweep(s), { kicked: [], ended: [] })
  assert.equal(h.letters.length, 0)
})

// spec: design §8 (promises 32) · eng §3.5 rings · design §9 · F-03
// class: B5 the contract at full size
// technique: boundary at the ring's size: 32 promises late at once
// method: 32 promises on one run go late together; one sweep kicks all 32 by id; the next sweep ends the run on the
//         first second miss and breaks: one ended row, one letter, and the kick ring at 32 with the second miss newest
// sre: if a run makes 32 promises and the brain dies, do we get one letter, not 32?
test('32 late promises: 32 kicks in one sweep, then one end and one letter, never a storm', () => {
  const h = host(); const s = new Supervisor(h)
  const w = fileRun(s, { key: 'r-32', goal: 'g' })
  for (let i = 0; i < 32; i++) contractPromise(s, w, `promise ${i}`, 10, null)
  h.tick(11)
  assert.equal(kickSweep(s).kicked.length, 32)
  h.tick(11)
  const k = kickSweep(s)
  assert.deepEqual(k.ended, [{ run: w.id, why: 'F-03', promise: 'p-1' }])
  assert.equal(h.letters.length, 1)
  assert.equal(w.contract.kicks.length, KICKS_KEPT, 'the kick ring holds 32: the oldest deadline row made room')
  assert.deepEqual([w.contract.kicks[0].evidence.promise, w.contract.kicks.at(-1).category], ['p-2', 'second-miss'])
})

// spec: design §8 (kicks, the 17th field) · eng §3.5 rings (kicks 32) · F-03
// class: B1 every *_KEPT bound holds under 10× its size
// technique: boundary at 10× the ring: 320 promises over one long run, each kicked once and then kept
// method: make a promise, pass its deadline, sweep (one kick row), keep it; 320 times; read the in-memory kick list
//         (the checkpoint carries the same list): never more than 32 rows, the newest last
// sre: if a long run is kicked every few minutes for a day, does its contract (and every checkpoint write) grow without end?
test('a day of kicks keeps the in-memory kick record at 32 rows', () => {
  const h = host(); const s = new Supervisor(h)
  const w = fileRun(s, { key: 'r-day', goal: 'g' })
  for (let i = 0; i < 320; i++) {
    const id = contractPromise(s, w, `promise ${i}`, 10, null)
    h.tick(11); kickSweep(s)
    contractResolve(s, w, id, 'kept-after-kick')
    assert.ok(w.contract.kicks.length <= KICKS_KEPT, `${w.contract.kicks.length} rows after ${i + 1} kicks`)
  }
  assert.equal(w.state, 'running')
  assert.equal(w.contract.kicks.length, KICKS_KEPT)
  assert.equal(w.contract.kicks.at(-1).evidence.promise, w.contract.promises.at(-1).id)
})

// spec: design §9 (deadline extended once by the same span) · eng §3.5 · F-03
// class: J14 clock jumps (forward past both deadlines in one tick; backwards before them)
// technique: time travel: the host clock jumps back an hour, then forward two hours
// method: a 20 s promise; jump the clock back (nothing happens), then forward 2 h in one step: the first sweep only
//         kicks (the extension starts from now), the second sweep 20 s later ends it
// sre: if the box sleeps for two hours, does the first sweep after wake end every run at once? It must kick first.
test('a clock that jumps back does nothing; a jump forward past both deadlines still kicks before it ends', () => {
  let t = 1000
  const h = { ...host(), now: () => t }
  const s = new Supervisor(h)
  const w = fileRun(s, { key: 'r-j', goal: 'g' })
  intent(s, w.id, { tool: 'jobs', promise: 'p', deadline_s: 20 })
  t -= 3600
  assert.deepEqual(kickSweep(s), { kicked: [], ended: [] })
  t += 3600 + 7200
  const first = kickSweep(s)
  assert.equal(first.kicked.length, 1); assert.equal(first.ended.length, 0)
  assert.equal(w.contract.promises[0].deadline_at, t + 20)
  t += 20
  assert.equal(kickSweep(s).ended[0].why, 'F-03')
})

// spec: design §9 · §17 99 · F-06 · eng §3.5 hop
// class: E7 a zombie (a cart, not a filed run, waiting on its brain)
// technique: state walk: a contract with an awaiting brain and no run (no unclaimed hour applies)
// method: a cart worker awaits its brain (awaitBrain); tick past the hop; sweep; read the F-06 letter's intensity word
//         ("normal" when there is no run header) and the contract's exit
// sre: if a cart waits on the brain and the brain never answers, does the cart end like a run, with the letter saying why?
test('a cart waiting on its brain past the hop deadline ends F-06 with "normal" named in the letter', () => {
  const h = host(); const s = new Supervisor(h)
  const w = s.spawn({ name: 'checker', program: CART })
  awaitBrain(s, w)
  h.tick(DEADLINES.hop)
  assert.deepEqual(kickSweep(s).ended, [{ run: w.id, why: 'F-06' }])
  assert.match(h.letters[0].evidence.detail, /^F-06: no intent for 50 s \(normal\)$/)
  assert.equal(h.letters[0].evidence.exit, 99)
  assert.equal(w.contract.exit, 99)
  assert.equal(w.awaiting, undefined, 'the wait ends with the run')
})

