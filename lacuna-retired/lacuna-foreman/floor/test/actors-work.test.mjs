// actors-work.test.mjs — WORLD TWO'S STATECHARTS (lane F5-BC, BC.4). Owns: A3 §9's cases for the worker (file → bud → fall
// → land with the ring drawing 300 ms after; a step every 8 s never stalls; silence past a ticket's deadline stalls at
// max(10, 3 × p99); kick; press; the hollow claim with the ring open; pass → seal → home; fail exit 15 cinder; parked stays;
// resume lands without a fall; a finish between keyframes still plays; a stale foreman → unknown), the ring (the radius
// table, pips, past plan, sealed, closed red), the pad (the linear drain, resent, press-held, receipt, refused, deadline,
// crash, two rings), the sentry (attach → self-test → attached; one sweep per check; warn 10 s; fail until ack; missed at
// 3 × period; detach), Lacuna (worst wins; unwatched past the on-delay; stale edge; down on a part; speaking; never
// evicted) and the foreman (up, busy swirl, hush, calm, stale with children unknown, down). Refuses: a mock of the fold.
import test from 'node:test'
import assert from 'node:assert/strict'
import { scenario, loadMind, beat, beats, startRun } from './fixtures/scenario.mjs'
import { pose, snapshot, restore, actor } from '../fold.js'
import { radiusOf } from '../actors/ring.js'
import { swirlOf } from '../actors/foreman.js'
import { STATES as WORKER_STATES, transitions as workerTransitions } from '../actors/worker.js'
import { CH, FLAG } from '../keyframe.js'

function step(sc, s, run, n, text = 'shell') { return sc.ev(s, 'run.step', run, { n, status: 'done', text, ticket: null }) }
function openTicket(sc, s, run, n, deadlineS = 120, o = {}) { return sc.ev(s, 'run.ticket.open', run, { op: 'tail-log', kind: 'hand', 'deadline-s': deadlineS, n, pressed: false, ticket: `${run}-hand-${n}`, ...o }) }
function closeTicket(sc, s, run, n, exit = 0) { return sc.ev(s, 'run.ticket.close', run, { exit, ms: 145, files: 0, rows: 12, ticket: `${run}-hand-${n}` }) }

// spec: A3 §4.3 queued → budding → falling → working; §4.4 drawing → open 300 ms after the landing; A5 §2.15 · class: M ·
// technique: event sequence · method: states around each boundary; the ring draws for 0.3 s after landT · sre: does a star appear from nowhere?
test('run.filed → run.start plays queued, budding, falling, working in order and the ring draws 300 ms after the landing', () => {
  const sc = scenario()
  beat(sc, 0)
  loadMind(sc, 'e4b', 1)
  startRun(sc, 'w-aaa111', 10, 'e4b')
  assert.equal(sc.state(10.5, 'w-aaa111'), 'queued')
  assert.equal(sc.at(10.5, 'w-aaa111').slot.set, 'queue')
  assert.equal(sc.state(11.1, 'w-aaa111'), 'budding')
  assert.equal(sc.state(11.4, 'w-aaa111'), 'falling')
  const w = sc.at(11.4, 'w-aaa111')
  assert.ok(w.flightS >= 0.5 && w.flightS <= 0.7)
  assert.equal(sc.state(w.landT + 0.05, 'w-aaa111'), 'working')
  assert.equal(sc.state(w.landT + 0.1, 'ring:w-aaa111'), 'drawing')
  assert.equal(sc.state(w.landT + 0.35, 'ring:w-aaa111'), 'open')
  assert.equal(sc.state(w.landT + 0.35, 'pad:w-aaa111'), 'idle')
  assert.equal(workerTransitions('falling', 'working'), 'worker.land')
  assert.equal(sc.at(w.landT + 0.35, 'e4b').onJob, 'w-aaa111')
  assert.equal(sc.at(w.landT + 0.35, 'e4b').slot.set, 'ring')
})

// spec: A3 §4.3 stalled rule (max(10 s, 3 × p99) past an open ticket's deadline; cleared 2 s after a step); run.kick 2 s · class: M ·
// technique: a step every 8 s, then silence · method: never stalled while stepping; stalled past the ticket's deadline; kick 2 s ·
// sre: when does the floor call a run stuck?
test('a run.step every 8 s never stalls; 30 s of silence past an open ticket\'s deadline stalls; a kick is a 2 s stall with its why', () => {
  const sc = scenario()
  beat(sc, 0)
  loadMind(sc, 'e4b', 1)
  startRun(sc, 'w-bbb222', 10, 'e4b')
  for (let i = 1; i <= 10; i++) step(sc, 12 + i * 8, 'w-bbb222', i)
  assert.equal(sc.state(61, 'w-bbb222'), 'working')
  assert.equal(sc.state(92.2, 'w-bbb222'), 'stepping')
  assert.equal(sc.state(92.8, 'w-bbb222'), 'working')
  openTicket(sc, 93, 'w-bbb222', 11, 10)
  assert.equal(sc.state(102, 'w-bbb222'), 'working')
  assert.equal(sc.state(103.5, 'w-bbb222'), 'working')
  const w = sc.at(104, 'w-bbb222')
  assert.ok(Math.abs(w.p99Gap - 9) < 1e-9, `p99 ${w.p99Gap} (the first gap, start → step 1, is 9 s and real)`)
  assert.equal(sc.state(118.9, 'w-bbb222'), 'working')
  assert.equal(sc.state(119.1, 'w-bbb222'), 'stalled')
  assert.match(sc.cause(117, 'w-bbb222'), /hand tail-log never answered/)
  assert.equal(sc.state(117, 'ring:w-bbb222'), 'stalled-step')
  assert.equal(sc.state(117, 'pad:w-bbb222'), 'deadline')
  closeTicket(sc, 120, 'w-bbb222', 11, 0)
  assert.equal(sc.state(121.5, 'w-bbb222'), 'stalled')
  assert.equal(sc.state(122.5, 'w-bbb222'), 'working')
  sc.ev(130, 'run.kick', 'w-bbb222', { promise: 'p-1', missed: 1, category: 'deadline', why: 'loop', step: 11 })
  assert.equal(sc.state(130.5, 'w-bbb222'), 'stalled')
  assert.equal(sc.cause(130.5, 'w-bbb222'), 'kicked loop')
  assert.equal(sc.state(132.5, 'w-bbb222'), 'working')
  assert.equal(sc.at(132.5, 'w-bbb222').kicks, 1)
})

// spec: A3 §4.3 waiting-press, done-claimed (law 7), passed → seal → home; §4.4 sealed · class: M · technique: press, claim, pass ·
// method: the claim is hollow and the ring stays open; run.pass seals and the star flies home · sre: can a worker's word close its ring?
test('press.wait holds the run; a claim is hollow with the ring open; run.pass seals the ring and the star flies home', () => {
  const sc = scenario()
  beat(sc, 0)
  loadMind(sc, 'e4b', 1)
  startRun(sc, 'w-ccc333', 10, 'e4b')
  sc.ev(20, 'press.wait', 'w-ccc333', { id: 'p-20261030-17', action: 'git-push', run: 'w-ccc333' })
  assert.equal(sc.state(20.5, 'w-ccc333'), 'waiting-press')
  assert.equal(sc.cause(20.5, 'w-ccc333'), 'press git-push p-20261030-17')
  assert.equal(sc.state(20.5, 'ring:w-ccc333'), 'held')
  assert.equal(sc.state(20.5, 'e4b'), 'waiting.press')
  assert.equal(sc.state(20.5, 'owner'), 'press-waiting')
  sc.ev(25, 'press.pressed', 'w-ccc333', { id: 'p-20261030-17', answer: 'yes', by: 'owner' })
  assert.equal(sc.state(25.5, 'w-ccc333'), 'working')
  sc.ev(30, 'run.claim', 'w-ccc333', { 'claims-done': true, chars: 40, receipt: null, text: 'done' })
  assert.equal(sc.state(30.5, 'w-ccc333'), 'done-claimed')
  assert.equal(pose(sc.f, 'w-ccc333', 30.5)[CH.hollow], 1)
  assert.equal(sc.state(30.5, 'ring:w-ccc333'), 'open')
  sc.ev(40, 'run.pass', 'w-ccc333', { 'checked-by': 'done-check', minutes: 0.5, rounds: 1, kicks: 0 })
  assert.equal(sc.state(40.2, 'w-ccc333'), 'passed')
  assert.equal(sc.state(40.2, 'ring:w-ccc333'), 'sealed')
  assert.equal(workerTransitions('done-claimed', 'passed'), 'run.pass')
  const p = pose(sc.f, 'w-ccc333', 40.3)
  assert.equal(p[CH.hue], 1, 'the seal is green')
  assert.ok(p[CH.y] > 1.9, 'the lift')
  assert.ok((pose(sc.f, 'w-ccc333', 44)[CH.flags] & FLAG.drawn) === 0, 'home and taken in')
  assert.equal(sc.state(44, 'ring:w-ccc333'), 'gone')
  assert.equal(sc.at(44, 'e4b').slot.set, 'stage')
})

// spec: A3 §4.3 failed (the cinder straight down, C-49), stopped parked, resumed, a finish between keyframes; §4.4 closed-red ·
// class: M · technique: three runs · method: fail exit 15 with cause; parked stays seated; resume without a fall; a run first seen
// at its run.pass row plays passed · sre: is a run that ended between polls ever "left the floor"? (never)
test('run.fail exit 15 is a cinder that stays until the ack; a parked run stays seated and resumes without a fall; a finish seen only by its row still plays', () => {
  const sc = scenario({ beats: 0 })
  beats(sc, 0, 100, 10)
  loadMind(sc, 'e4b', 1)
  startRun(sc, 'w-ddd444', 10, 'e4b')
  sc.ev(30, 'run.fail', 'w-ddd444', { why: 'the hands killed shell at 120 s', exit: 15, step: 4 })
  assert.equal(sc.state(30.5, 'w-ddd444'), 'failed')
  assert.equal(sc.cause(30.5, 'w-ddd444'), 'exit 15 deadline: the hands killed shell at 120 s')
  assert.equal(sc.state(30.5, 'ring:w-ddd444'), 'closed-red')
  const before = pose(sc.f, 'w-ddd444', 30.3)
  const after = pose(sc.f, 'w-ddd444', 31.5)
  assert.ok(after[CH.y] < before[CH.y], 'it drops')
  assert.ok(Math.abs(after[CH.x] - before[CH.x]) < 1e-6, 'zero outward velocity')
  assert.equal(sc.state(60, 'w-ddd444'), 'failed')
  sc.ev(61, 'alert.ack', 'alert:w-ddd444:exit-15', { by: 'owner' })
  assert.equal(sc.state(64, 'ring:w-ddd444'), 'gone')
  startRun(sc, 'w-eee555', 70, 'e4b')
  sc.ev(80, 'run.pause', 'w-eee555', { by: 'broker', park: true, for: '26b' })
  assert.equal(sc.state(80.5, 'w-eee555'), 'stopped')
  assert.equal(sc.cause(80.5, 'w-eee555'), 'parked for 26b')
  assert.equal(sc.state(80.5, 'ring:w-eee555'), 'held')
  const seat = sc.at(80.5, 'w-eee555').pos
  sc.ev(90, 'run.resume', 'w-eee555', { by: 'broker', from: 'parked' })
  assert.equal(sc.state(90.5, 'w-eee555'), 'resumed')
  const back = sc.at(90.5, 'w-eee555').pos
  assert.ok(Math.hypot(back.x - seat.x, back.z - seat.z) < 1e-3, 'no fall: it is already seated')
  assert.equal(sc.state(91.5, 'w-eee555'), 'working')
  sc.ev(100, 'run.pass', 'w-fff666', { 'checked-by': 'done-check', minutes: 3, rounds: 2, kicks: 0 })
  assert.equal(sc.state(100.2, 'w-fff666'), 'passed')
  assert.equal(sc.state(100.2, 'w-eee555'), 'working')
  beat(sc, 101, 1)
  assert.equal(sc.state(110, 'w-eee555'), 'working')
  assert.equal(sc.state(132, 'w-eee555'), 'unknown')
  assert.equal(sc.cause(132, 'w-eee555'), 'foreman-stale')
  assert.equal(sc.state(132, 'ring:w-eee555'), 'held')
})

// spec: A3 §4.4 the radius (master §3.5's formula); §9 ring cases · class: E · technique: table · method: 14 at N=1 W=1, 16.8 at N=2, 17.2 at W=2, 26 cap;
// past-plan amber on step 9 of 8 · sre: can a ring be smaller than 12?
test('the ring radius table holds and a run past its plan reads past-plan', () => {
  assert.equal(radiusOf(1, 1), 14)
  assert.ok(Math.abs(radiusOf(2, 1) - 16.8) < 1e-9)
  assert.ok(Math.abs(radiusOf(1, 2) - 17.2) < 1e-9)
  assert.equal(radiusOf(5, 3), 26)
  assert.equal(radiusOf(NaN, undefined), 14)
  assert.equal(radiusOf(0, 0), 14, 'the floor of 12 is never reached by the formula: A3 §9\'s "12 at N=1" row is wrong, the formula of master §3.5, A3 §4.4, A4 V-060 and floorProcs.js:529 wins')
  const sc = scenario()
  beat(sc, 0)
  loadMind(sc, 'e4b', 1)
  startRun(sc, 'w-ggg777', 10, 'e4b', 8)
  for (let i = 1; i <= 9; i++) step(sc, 12 + i, 'w-ggg777', i)
  assert.equal(sc.state(20.2, 'ring:w-ggg777'), 'open')
  assert.equal(sc.state(21.5, 'ring:w-ggg777'), 'past-plan')
  assert.equal(sc.cause(21.5, 'ring:w-ggg777'), 'past plan by 1')
  assert.equal(pose(sc.f, 'ring:w-ggg777', 21.5)[CH.ring], 14)
  for (const s of WORKER_STATES) assert.ok(typeof s === 'string')
})

// spec: A3 §4.6 the pad: a ring is a clock (linear), resent, press-held, receipt, refused, deadline, crash, two rings · class: M ·
// technique: tickets · method: fill 0.5 at half the deadline; tries 2 → resent; waiting → press-held; exits 0/12/15/30 ·
// sre: is the deadline ring ever eased? (never)
test('the pad drains linearly, reads resent, press-held, receipt, refused, deadline and crash, and stacks two rings', () => {
  const sc = scenario()
  beat(sc, 0)
  loadMind(sc, 'e4b', 1)
  startRun(sc, 'w-hhh888', 10, 'e4b')
  openTicket(sc, 20, 'w-hhh888', 1, 100)
  assert.equal(sc.state(20.5, 'pad:w-hhh888'), 'ticket-open')
  assert.equal(sc.cause(20.5, 'pad:w-hhh888'), 'tail-log hand')
  assert.ok(Math.abs(pose(sc.f, 'pad:w-hhh888', 70)[CH.fill] - 0.5) < 1e-9, 'fill 0.5 at half the deadline')
  assert.ok(Math.abs(pose(sc.f, 'pad:w-hhh888', 45)[CH.fill] - 0.75) < 1e-9, 'linear')
  openTicket(sc, 71, 'w-hhh888', 1, 100, { tries: 2 })
  assert.equal(sc.state(71.5, 'pad:w-hhh888'), 'resent')
  closeTicket(sc, 72, 'w-hhh888', 1, 0)
  assert.equal(sc.state(72.5, 'pad:w-hhh888'), 'receipt')
  assert.equal(sc.state(73.5, 'pad:w-hhh888'), 'idle')
  openTicket(sc, 80, 'w-hhh888', 2, 600, { kind: 'act', op: 'git-push', pressed: true })
  assert.equal(sc.state(80.5, 'pad:w-hhh888'), 'press-held')
  closeTicket(sc, 81, 'w-hhh888', 2, 12)
  assert.equal(sc.state(81.5, 'pad:w-hhh888'), 'refused')
  assert.equal(sc.state(84.5, 'pad:w-hhh888'), 'idle')
  openTicket(sc, 90, 'w-hhh888', 3, 120)
  closeTicket(sc, 91, 'w-hhh888', 3, 15)
  assert.equal(sc.state(91.5, 'pad:w-hhh888'), 'deadline')
  openTicket(sc, 100, 'w-hhh888', 4, 120)
  openTicket(sc, 101, 'w-hhh888', 5, 120)
  assert.equal(sc.at(101.5, 'pad:w-hhh888').tickets.length, 2)
  assert.ok(pose(sc.f, 'pad:w-hhh888', 101.5)[CH.scale] > 1, 'two rings stack')
  closeTicket(sc, 102, 'w-hhh888', 5, 30)
  assert.equal(sc.state(102.5, 'pad:w-hhh888'), 'crash')
  assert.equal(sc.state(130, 'pad:w-hhh888'), 'crash')
})

// spec: A3 §4.5 the sentry; §4.7 Lacuna's lights worst-wins and R1's counter (C-34) · class: M · technique: attach, checks, verdicts ·
// method: arriving → attached; a sweep only for 0.4 s after a check; note → warn 10 s; stop → fail until ack; 31 s silence → missed;
// detach; Lacuna's sem light is fail while one sentry fails; an unwatched run counts past the on-delay · sre: does a sentry sweep on a timer?
test('a sentry arrives, scans only per check, warns 10 s, fails until ack, misses at 3 × period and detaches; Lacuna aggregates worst-wins and counts unwatched runs', () => {
  const sc = scenario()
  beat(sc, 0)
  loadMind(sc, 'e4b', 1)
  startRun(sc, 'w-iii999', 10, 'e4b')
  assert.equal(sc.at(25, 'lacuna').unwatched, 1, 'unwatched past the 10 s on-delay with no history')
  assert.equal(sc.at(25, 'lacuna').lights.sem, 'unknown')
  assert.ok(['raised', 'raised-steady'].includes(sc.state(25, 'alert:w-iii999:no-sentry')), 'the no-sentry warn is raised (the newest warn flashes)')
  sc.ev(26, 'sentry.attach', 'sentry-1b:w-iii999', { model: '1b', run: 'w-iii999', domain: null, mode: 'shadow', 'period-s': 10 }, { ref: 'w-iii999' })
  assert.equal(sc.state(26.2, 'sentry-1b:w-iii999'), 'arriving')
  assert.equal(sc.state(27.5, 'sentry-1b:w-iii999'), 'attached')
  assert.equal(sc.at(27.5, 'lacuna').unwatched, 0)
  sc.ev(30, 'sentry.check', 'sentry-1b:w-iii999', { kind: 'semantics', n: 3, by: '1b', ms: 400 }, { ref: 'w-iii999' })
  assert.equal(sc.state(30.2, 'sentry-1b:w-iii999'), 'scanning')
  assert.equal(sc.state(30.6, 'sentry-1b:w-iii999'), 'attached')
  let sweeps = 0
  for (let s = 31; s < 40; s++) if (sc.state(s, 'sentry-1b:w-iii999') === 'scanning') sweeps++
  assert.equal(sweeps, 0, 'no sweep without a check')
  assert.equal(sc.at(35, 'lacuna').lights.sem, 'clean')
  sc.ev(40, 'sentry.verdict', 'sentry-1b:w-iii999', { check: 'claim-without-receipt', action: 'note', detail: 'said done; no receipt', shadow: true, by: '1b' }, { ref: 'w-iii999' })
  assert.equal(sc.state(40.5, 'sentry-1b:w-iii999'), 'warn')
  assert.equal(sc.at(40.5, 'lacuna').lights.sem, 'warn')
  assert.equal(sc.state(49.5, 'sentry-1b:w-iii999'), 'warn')
  assert.equal(sc.state(50.5, 'sentry-1b:w-iii999'), 'attached')
  sc.ev(60, 'sentry.verdict', 'sentry-1b:w-iii999', { check: 'provenance', action: 'stop', detail: 'the chain broke', shadow: false, by: '1b' }, { ref: 'w-iii999' })
  assert.equal(sc.state(60.5, 'sentry-1b:w-iii999'), 'fail')
  assert.equal(sc.at(60.5, 'lacuna').lights.prov, 'fail')
  assert.equal(sc.state(100, 'sentry-1b:w-iii999'), 'fail')
  sc.ev(101, 'alert.ack', 'alert:sentry-1b:w-iii999:provenance', { by: 'owner' })
  assert.equal(sc.state(103.5, 'sentry-1b:w-iii999'), 'missed-check')
  assert.match(sc.cause(103.5, 'sentry-1b:w-iii999'), /no check for \d+ s/)
  sc.ev(104, 'sentry.check', 'sentry-1b:w-iii999', { kind: 'ast', n: 1, by: 'regex', ms: 2 }, { ref: 'w-iii999' })
  assert.equal(sc.state(105, 'sentry-1b:w-iii999'), 'attached')
  sc.ev(110, 'sentry.detach', 'sentry-1b:w-iii999', { why: 'ended' }, { ref: 'w-iii999' })
  assert.equal(sc.state(110.5, 'sentry-1b:w-iii999'), 'detached')
  assert.equal(sc.at(110.5, 'lacuna').lights.prov, 'unknown')
})

// spec: A3 §4.7 the edges: shadow by default, enforcing on sentry.mode live, down on a part, stale on floor.stale; the voice;
// never evicted · class: M · technique: events on the cube · method: each edge state; a mind.unload actor=e2b leaves the cube
// alone · sre: can Lacuna be evicted? (never)
test('Lacuna\'s edge is shadow until sentry.mode live, down when a part is down, stale on floor.stale; it speaks on its own turn and is never evicted', () => {
  const sc = scenario()
  beat(sc, 0)
  assert.equal(sc.state(1, 'lacuna'), 'shadow')
  sc.ev(5, 'sentry.mode', 'lacuna', { mode: 'live', by: 'owner' })
  assert.equal(sc.state(5.5, 'lacuna'), 'enforcing')
  sc.ev(10, 'service.down', 'hands', { 'was-pid': 1, why: 'launchd' })
  assert.equal(sc.state(10.5, 'lacuna'), 'down')
  assert.equal(sc.cause(10.5, 'lacuna'), 'hands down')
  sc.ev(12, 'service.up', 'hands', { pid: 2, 'rss-mb': 40, at: 'hands.sock' })
  assert.equal(sc.state(12.5, 'lacuna'), 'enforcing')
  sc.ev(20, 'floor.stale', 'floor', { producer: 'door', 'period-s': 5, 'silent-s': 15, actors: [] })
  assert.equal(sc.state(20.5, 'lacuna'), 'stale')
  sc.ev(25, 'floor.fresh', 'floor', { producer: 'door', 'silent-s': 20 })
  assert.equal(sc.state(25.5, 'lacuna'), 'enforcing')
  loadMind(sc, 'e2b', 30)
  sc.ev(40, 'mind.turn.start', 'e2b', { who: 'lacuna', session: 'eval:lacuna', model: 'e2b', mode: 'talk' })
  assert.equal(sc.at(40.5, 'lacuna').voice, 'speaking')
  sc.ev(41, 'mind.turn.done', 'e2b', { ms: 900, tokens: 30, tps: 33, 'prefill-ms': 100, prompt: 500, reused: 0, reason: 'eos', slot: 0 })
  assert.equal(sc.at(41.5, 'lacuna').voice, 'quiet')
  sc.ev(50, 'mind.unload', 'e2b', { by: 'owner', phase: 'begin' })
  assert.equal(sc.state(50.5, 'lacuna'), 'enforcing')
  assert.equal(sc.state(50.5, 'e2b'), 'evicted')
})

// spec: A3 §4.2 the foreman: up, busy by living, hushed with its why, calm, stale at 30 s with every child unknown, down at
// service.down; the swirl `min(2, 1 + log10(1 + living))` (C-45) · class: M · technique: beats · method: each state; the swirl table ·
// sre: does a blind foreman page? (no: unknown and inhibit)
test('the foreman is up, busy by living, hushed with its why, stale at 30 s with every child unknown, down at service.down; the swirl is log10', () => {
  const sc = scenario({ beats: 0 })
  assert.equal(sc.state(0, 'foreman'), 'stale')
  assert.equal(sc.cause(0, 'foreman'), 'no record')
  beat(sc, 1, 0)
  assert.equal(sc.state(1.5, 'foreman'), 'up')
  beat(sc, 6, 3)
  assert.equal(sc.state(6.5, 'foreman'), 'busy')
  assert.equal(sc.cause(6.5, 'foreman'), '3 living')
  sc.ev(10, 'foreman.hush', 'foreman', { why: 'rss 612 MB' })
  assert.equal(sc.state(10.5, 'foreman'), 'hushed')
  assert.equal(sc.cause(10.5, 'foreman'), 'rss 612 MB')
  sc.ev(20, 'foreman.calm', 'foreman', { was: 'rss 612 MB', 'hushed-s': 10 })
  assert.equal(sc.state(20.5, 'foreman'), 'busy')
  loadMind(sc, 'e4b', 21)
  startRun(sc, 'w-jjj000', 22, 'e4b')
  beat(sc, 24, 1)
  assert.equal(sc.state(53.9, 'foreman'), 'busy')
  assert.equal(sc.state(54.1, 'foreman'), 'stale')
  assert.equal(sc.state(54.1, 'w-jjj000'), 'unknown')
  assert.equal(sc.state(54.1, 'ring:w-jjj000'), 'held')
  assert.equal(sc.at(54.1, 'lacuna').unwatched, 0, 'inhibited under a stale parent')
  beat(sc, 60, 1)
  assert.equal(sc.state(60.5, 'w-jjj000'), 'working')
  sc.ev(70, 'service.down', 'foreman', { 'was-pid': 3, why: 'launchd' })
  assert.equal(sc.state(70.5, 'foreman'), 'down')
  assert.equal(swirlOf(0), 1)
  assert.ok(Math.abs(swirlOf(1) - 1.30103) < 1e-5)
  assert.equal(swirlOf(9), 2)
  assert.equal(swirlOf(100), 2)
})

// spec: the make-it-right audit E14 §5 row 8 (A2 fix 6: two 1B sentries said "no check for 418,270 s" on runs that had ended days
// before; 55 fold sentries stood `arriving`) · class: M a body with no living record · technique: a run's end · method: the fold ·
// sre: does a run's sentry leave the floor with its run, and its control check light Lacuna's semantics?
test('a run\'s sentry checks by code light semantics, and it detaches when its run ends', () => {
  const sc = scenario()
  beat(sc, 0)
  loadMind(sc, 'e4b', 1)
  startRun(sc, 'w-jjj000', 10, 'e4b')
  sc.ev(12, 'sentry.attach', 'sentry-270m:w-jjj000', { model: '270m', run: 'w-jjj000', domain: null, mode: 'shadow', 'period-s': 10 }, { ref: 'w-jjj000' })
  sc.ev(15, 'sentry.check', 'sentry-270m:w-jjj000', { kind: 'control', n: 1, by: 'code' }, { ref: 'w-jjj000' })
  assert.equal(sc.at(15.5, 'sentry-270m:w-jjj000').checks, 1)
  assert.equal(sc.at(16, 'lacuna').lights.sem, 'clean')
  sc.ev(30, 'run.pass', 'w-jjj000', { 'checked-by': 'done-check', minutes: 0.3, rounds: 1, kicks: 0 })
  assert.equal(sc.state(30.5, 'sentry-270m:w-jjj000'), 'detached')
  assert.equal(sc.cause(30.5, 'sentry-270m:w-jjj000'), 'the run ended (pass)')
  assert.notEqual(sc.state(500, 'sentry-270m:w-jjj000'), 'missed-check', 'never a missed check on an ended run')
})

// spec: the postmortem of 2026-11-10 (the frontend died at boot: the day's keyframe held a cube record written before
// `directLights` existed, and the first sentry row after it threw in the cube's fold) · class: M a record older than its module ·
// technique: a keyframe with the field cut · method: snapshot → cut `direct-lights` → restore → fold a verdict, a check and a
// warn · sre: does a record written by an older build fold under the newer one?
test('a cube restored from a keyframe written before its direct lights existed folds sentry rows without a fault', () => {
  const sc = scenario()
  beat(sc, 0)
  loadMind(sc, 'e4b', 1)
  startRun(sc, 'w-kkk111', 10, 'e4b')
  sc.to(20)
  const text = snapshot(sc.f, 20)
  assert.match(text, /\("direct-lights" /, 'a keyframe of this build carries the field')
  const old = text.replace(/ \("direct-lights" \(@(?: \("[a-z]+" "[a-z]+"\))+\)\)/, '')
  assert.doesNotMatch(old, /direct-lights/, 'the fixture cuts the field')
  restore(sc.f, old)
  assert.equal(actor(sc.f, 'lacuna').directLights, undefined, 'the restored cube has the old shape')
  sc.ev(21, 'sentry.verdict', 'sentry-code:w-kkk111', { check: 'no-progress', action: 'would-stop', detail: 'abandoned at hand tail-log (shadow: nothing sent)', shadow: true, by: 'code' }, { ref: 'w-kkk111' })
  sc.ev(22, 'sentry.check', 'sentry-code:w-kkk111', { kind: 'control', n: 1, by: 'code' }, { ref: 'w-kkk111' })
  assert.doesNotThrow(() => sc.to(23), 'the row that stopped the boot folds')
  assert.equal(sc.at(23.5, 'lacuna').lights.sem, 'clean', 'the check lights semantics on the healed record')
  sc.ev(24, 'sentry.warn', 'sentry-code:w-kkk111', { check: 'no-progress', detail: 'no step for 60 s' }, { ref: 'w-kkk111' })
  assert.doesNotThrow(() => sc.to(25))
  assert.equal(sc.at(25.5, 'lacuna').lights.sem, 'warn')
})

// spec: RULINGS M-01 (`unknown` with no verdict row: never a false clean); the kind catalog's `sentry.verdict` (check, action,
// detail, shadow, by: no judgment field) · class: M a light that says more than its row · technique: a ledger-shaped verdict from
// a sentry that never attached · method: the fold; the cube's light before and after; then rows that carry a judgment ·
// sre: does a `would-stop` paint the cube clean?
test('a verdict row with no judgment moves no direct light on the cube; a row that carries one does', () => {
  const sc = scenario()
  beat(sc, 0)
  loadMind(sc, 'e4b', 1)
  startRun(sc, 'w-lll222', 10, 'e4b')
  assert.equal(sc.at(11.5, 'lacuna').lights.sem, 'unknown')
  sc.ev(12, 'sentry.verdict', 'sentry-code:w-lll222', { check: 'no-progress', action: 'would-stop', detail: 'abandoned at hand tail-log (shadow: nothing sent)', shadow: true, by: 'code' }, { ref: 'w-lll222' })
  assert.equal(sc.at(12.5, 'lacuna').lights.sem, 'unknown', 'a would-stop with no judgment is not a clean')
  sc.ev(14, 'sentry.verdict', 'sentry-code:w-lll222', { light: 'semantics', judged: 'pass' }, { ref: 'w-lll222' })
  assert.equal(sc.at(14.5, 'lacuna').lights.sem, 'clean', 'a judged pass is a clean')
  sc.ev(16, 'sentry.verdict', 'sentry-code:w-lll222', { light: 'semantics', judged: 'stop' }, { ref: 'w-lll222' })
  assert.equal(sc.at(16.5, 'lacuna').lights.sem, 'warn', 'a judged stop warns')
  sc.ev(18, 'sentry.verdict', 'sentry-code:w-lll222', { light: 'provenance', level: 'warn' }, { ref: 'w-lll222' })
  assert.equal(sc.at(18.5, 'lacuna').lights.prov, 'warn', 'a level warn warns its own light')
  assert.equal(sc.at(18.5, 'lacuna').lights.ast, 'unknown', 'a light no row named stays unknown')
})
