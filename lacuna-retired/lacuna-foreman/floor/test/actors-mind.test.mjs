// actors-mind.test.mjs — THE MIND'S STATECHART (lane F5-BC, BC.4). Owns: A3 §9's mind cases: every state reachable, the
// load with no dark gap, the refusal for 6 s, the phase chain, the stall on-delay with and without history, never during
// prefill, the 2 s clear, the grammar failure, the crash, the warned flag's 10 s linger, passing, unknown only on a job
// under a stale foreman, eviction, the swap's two ceremonies, and the stalled pose frozen on every channel but the ring.
// Refuses: a mock of the fold or of the mind.
import test from 'node:test'
import assert from 'node:assert/strict'
import { scenario, loadMind, beat, beats, startRun } from './fixtures/scenario.mjs'
import { pose } from '../fold.js'
import { STATES, transitions } from '../actors/mind.js'
import { CH } from '../keyframe.js'

function slot(sc, s, id, busy, nDecoded, tps = 0) {
  return sc.ev(s, 'mind.slot', id, { slot: 0, busy, 'n-decoded': nDecoded, held: 2000, 'n-ctx': 32768, tps })
}

// spec: A3 §4.1 rows dark · loading · resident · refused; master §3.1 · class: M · technique: event sequence · method: a
// wake, then a refusal; states sampled around each boundary · sre: does a loading mind ever read "dark" between start and done?
test('load.start → load.done is loading then resident with no dark gap; a refusal is refused for 6 s then dark with the engine sentence', () => {
  const sc = scenario()
  beat(sc, 0)
  assert.equal(sc.state(0.5, 'foreman'), 'up')
  sc.ev(1, 'mind.load.start', '12b', { 'need-mb': 6389, 'available-mb': 9000, by: 'owner' })
  sc.ev(5, 'mind.load.done', '12b', { 'hot-mb': 6389, 'arena-mb': null, 'warm-ms': 3000 })
  assert.equal(sc.state(1, '12b'), 'loading')
  assert.equal(sc.cause(1, '12b'), 'wake-by-owner')
  assert.equal(sc.state(4.9, '12b'), 'loading')
  assert.equal(sc.state(5, '12b'), 'resident')
  assert.equal(transitions('loading', 'resident'), 'mind.ready')
  sc.ev(10, 'mind.load.refused', '26b', { 'need-mb': 14439, 'available-mb': 9120, why: 'not enough memory' })
  assert.equal(sc.state(10, '26b'), 'refused')
  assert.equal(sc.cause(10, '26b'), 'needs 14439 MB, 9120 free')
  assert.equal(sc.state(15.9, '26b'), 'refused')
  assert.equal(sc.state(16.1, '26b'), 'dark')
  assert.equal(transitions('refused', 'dark'), 'mind.sleep')
})

// spec: A3 §4.1 busy.* rows; §5.1 `mind.phase`; A5 §2.9 · class: M · technique: phase chain · method: read → think → answer → done ·
// sre: do the chips follow the phases in event order?
test('the phase chain read → think → answer → done plays busy.reading, busy.thinking, busy.answering then resident', () => {
  const sc = scenario()
  beat(sc, 0)
  loadMind(sc, 'e4b', 1)
  sc.ev(10, 'mind.turn.start', 'e4b', { who: 'owner', session: 'eval:x', model: 'e4b', mode: 'desk' })
  sc.ev(10.1, 'mind.turn.phase', 'e4b', { phase: 'read', tokens: 0, n: 1, tps: null })
  sc.ev(12, 'mind.turn.phase', 'e4b', { phase: 'think', tokens: 0, n: 1, tps: 40 })
  sc.ev(14, 'mind.turn.phase', 'e4b', { phase: 'answer', tokens: 16, n: 1, tps: 77.2 })
  sc.ev(16, 'mind.turn.done', 'e4b', { ms: 6000, tokens: 160, tps: 77.2, 'prefill-ms': 1210, prompt: 6801, reused: 0, reason: 'eos', slot: 0 })
  assert.equal(sc.state(10.5, 'e4b'), 'busy.reading')
  assert.equal(sc.state(12.5, 'e4b'), 'busy.thinking')
  assert.equal(sc.state(14.5, 'e4b'), 'busy.answering')
  assert.equal(transitions('busy.thinking', 'busy.answering'), 'mind.phase')
  assert.equal(sc.state(16.5, 'e4b'), 'resident')
  assert.equal(sc.at(16.5, 'e4b').turns, 1)
  assert.equal(transitions('busy.answering', 'resident'), 'mind.turn.end')
})

// spec: A3 §4.1 stalled row as C-11, C-12 rule it; master §3.1 · class: M · technique: slot samples with flat tokens · method:
// busy at 9 s is answering, at 11 s stalled (10 s, no history); with a 5 s p99 the on-delay is 15 s; progress clears after 2 s ·
// sre: when does the floor call a slot stuck?
test('a busy slot with flat tokens is answering at 9 s and stalled at 11 s; with a p99 gap of 5 s the on-delay is 15 s; 2 s of progress clears it', () => {
  const sc = scenario()
  beat(sc, 0)
  loadMind(sc, 'e4b', 1)
  sc.ev(10, 'mind.turn.start', 'e4b', { who: 'owner', session: 'eval:x', model: 'e4b', mode: 'desk' })
  slot(sc, 10.25, 'e4b', true, 8, 30)
  for (let i = 0; i < 40; i++) slot(sc, 10.5 + i * 0.25, 'e4b', true, 8, 0)
  assert.equal(sc.state(19, 'e4b'), 'busy.answering')
  assert.equal(sc.state(20.1, 'e4b'), 'busy.answering')
  assert.equal(sc.state(20.3, 'e4b'), 'stalled')
  assert.match(sc.cause(20.5, 'e4b'), /no-token-for 10 s/)
  assert.equal(transitions('busy.answering', 'stalled'), 'mind.stall')
  slot(sc, 30, 'e4b', true, 9, 4)
  slot(sc, 30.5, 'e4b', true, 10, 4)
  assert.equal(sc.state(31.5, 'e4b'), 'stalled')
  assert.equal(sc.state(32.1, 'e4b'), 'busy.answering')
  const sc2 = scenario()
  beat(sc2, 0)
  loadMind(sc2, 'e2b', 1)
  sc2.ev(10, 'mind.turn.start', 'e2b', { who: 'owner', session: 'eval:y', model: 'e2b', mode: 'desk' })
  for (let i = 0; i < 10; i++) slot(sc2, 10.25 + i * 5, 'e2b', true, 1 + i, 2)
  const m = sc2.at(56, 'e2b')
  assert.ok(Math.abs(m.p99Gap - 5) < 1e-9, `p99 ${m.p99Gap}`)
  for (let i = 0; i < 80; i++) slot(sc2, 56 + i * 0.25, 'e2b', true, 10, 0)
  assert.equal(sc2.state(69, 'e2b'), 'busy.answering')
  assert.equal(sc2.state(70.5, 'e2b'), 'stalled')
})

// spec: C-12 "busy.reading never becomes stalled"; A7 §4.5 · class: M · technique: a 49 s prefill · method: busy with n-decoded 0
// for 60 s; never stalled; past the longest measured read the cause names it · sre: is a long read a stall? (never)
test('a mind in prefill never stalls: 60 s of busy with n-decoded 0 stays busy.reading; past the longest read the label says so', () => {
  const sc = scenario()
  beat(sc, 0)
  loadMind(sc, '26b', 1)
  sc.ev(5, 'mind.turn.start', '26b', { who: 'owner', session: 'eval:z', model: '26b', mode: 'desk' })
  sc.ev(5.1, 'mind.turn.phase', '26b', { phase: 'read', tokens: 0, n: 1 })
  sc.ev(9, 'mind.turn.done', '26b', { ms: 3900, tokens: 10, tps: 2, 'prefill-ms': 3000, prompt: 2000, reused: 0, reason: 'eos', slot: 0 })
  sc.ev(10, 'mind.turn.start', '26b', { who: 'owner', session: 'eval:z', model: '26b', mode: 'desk' })
  for (let i = 0; i < 240; i++) slot(sc, 10.25 + i * 0.25, '26b', true, 0, 0)
  assert.equal(sc.state(40, '26b'), 'busy.reading')
  assert.equal(sc.state(69, '26b'), 'busy.reading')
  assert.match(sc.cause(69, '26b'), /no first token for \d+ s \(longest read so far 3 s\)/)
  assert.equal(sc.at(69, '26b').longestPrefillMs, 3000)
})

// spec: A3 §4.1 failed row and the crash branch; §5.1 mind.crash · class: M · technique: two failures · method: turn.fail grammar
// counts a red tick and reads failed; engine.down with an open turn is failed by crash, without one engine-down · sre: crash or down?
test('turn.fail grammar → failed with the tick counted; engine.down with an open turn → failed by crash, without one → engine-down, never idle', () => {
  const sc = scenario()
  beat(sc, 0)
  loadMind(sc, 'e4b', 1)
  sc.ev(10, 'mind.turn.start', 'e4b', { who: 'owner', session: 'eval:x', model: 'e4b', mode: 'desk' })
  sc.ev(11, 'mind.turn.fail', 'e4b', { reason: 'grammar: an unexpected {', code: null, grammar: true })
  assert.equal(sc.state(11, 'e4b'), 'failed')
  assert.equal(sc.at(11, 'e4b').grammarErrors, 1)
  assert.equal(transitions('busy.reading', 'failed'), 'mind.fail')
  sc.ev(12, 'alert.ack', 'alert:e4b:grammar', { by: 'owner' })
  assert.equal(sc.at(12, 'e4b').ackT, 12)
  assert.equal(sc.state(13.5, 'e4b'), 'failed')
  assert.equal(sc.state(14.5, 'e4b'), 'resident')
  sc.ev(20, 'mind.turn.start', 'e4b', { who: 'owner', session: 'eval:x', model: 'e4b', mode: 'desk' })
  sc.ev(21, 'mind.engine.down', 'e4b', { 'probe-ms': 3, code: 503 })
  assert.equal(sc.state(21, 'e4b'), 'engine-down')
  assert.equal(sc.at(21, 'e4b').fail.crash, true)
  assert.equal(transitions('busy.reading', 'engine-down'), 'mind.engine.down')
  sc.ev(30, 'mind.engine.up', 'e4b', { pid: 41023, 'uptime-s': 1, served: 0, failed: 0, restart: true })
  assert.equal(sc.state(30, 'e4b'), 'failed')
  assert.equal(sc.at(30, 'e4b').restarts, 2)
  const sc2 = scenario()
  beat(sc2, 0)
  loadMind(sc2, 'e2b', 1)
  sc2.ev(10, 'mind.engine.down', 'e2b', { 'probe-ms': 3, code: 503 })
  assert.equal(sc2.state(10, 'e2b'), 'engine-down')
  assert.equal(sc2.cause(10, 'e2b'), '503')
  assert.notEqual(sc2.state(10, 'e2b'), 'idle')
})

// spec: A3 §4.1 warned flag (0 / 10 s); passing (0.5 s); unknown under a stale foreman only on a job · class: M · technique: coast,
// pass, silence · method: box.coast tight sets warned, clear + 10 s unsets it; run.pass naming this brain is passing for 0.5 s;
// 30 s of foreman silence makes the mind on a job unknown and leaves the resident one alone · sre: which mind goes gray when the foreman is blind?
test('box.coast tight warns a loaded mind for 10 s past clear; run.pass plays passing for 0.5 s; a stale foreman makes only the mind on a job unknown', () => {
  const sc = scenario({ beats: 0 })
  beats(sc, 0, 20, 10)
  loadMind(sc, 'e4b', 1)
  loadMind(sc, 'e2b', 1)
  sc.ev(10, 'box.coast', 'box', { level: 'tight', 'free-pct': 4.2, 'wired-mb': 29000, 'avail-mb': 1200 })
  assert.equal(sc.at(10.5, 'e4b').warned, true)
  assert.match(sc.at(10.5, 'e4b').warn.cause, /memory-tight/)
  sc.ev(12, 'box.coast', 'box', { level: 'clear', 'free-pct': 31.4, 'wired-mb': 9120, 'avail-mb': 10020 })
  assert.equal(sc.at(19.5, 'e4b').warned, true)
  assert.equal(sc.at(20.5, 'e4b').warned, false)
  startRun(sc, 'w-aaa111', 21, 'e4b')
  beat(sc, 23, 1)
  assert.equal(sc.at(24, 'e4b').onJob, 'w-aaa111')
  sc.ev(40, 'run.pass', 'w-aaa111', { 'checked-by': 'done-check', minutes: 0.3, rounds: 1, kicks: 0 })
  assert.equal(sc.state(40.2, 'e4b'), 'passing')
  assert.equal(sc.state(40.6, 'e4b'), 'resident')
  startRun(sc, 'w-bbb222', 41, 'e4b')
  beat(sc, 43, 1)
  assert.equal(sc.state(60, 'e4b'), 'resident')
  assert.equal(sc.state(74, 'foreman'), 'stale')
  assert.equal(sc.state(74, 'e4b'), 'unknown')
  assert.equal(sc.cause(74, 'e4b'), 'foreman-stale')
  assert.equal(sc.state(74, 'e2b'), 'resident')
  beat(sc, 75, 1)
  assert.equal(sc.state(75, 'e4b'), 'resident')
})

// spec: A3 §4.1 evicted row (C-56, C-57 two phases); §5.1 swap = depart ∥ arrive · class: M · technique: unload then swap · method:
// unload begin → evicted, done → dark by-owner; a swap's `to` loads · sre: does an evicted mind vanish or sink?
test('unload by owner is evicted then dark; a swap plays depart on `from` and arrive on `to`', () => {
  const sc = scenario()
  beat(sc, 0)
  loadMind(sc, 'e4b', 1)
  sc.ev(10, 'mind.unload', 'e4b', { by: 'owner', phase: 'begin' })
  assert.equal(sc.state(10.5, 'e4b'), 'evicted')
  assert.equal(transitions('resident', 'evicted'), 'mind.depart')
  sc.ev(11, 'mind.unload', 'e4b', { by: 'owner', phase: 'done', 'held-s': 900 })
  assert.equal(sc.state(11.5, 'e4b'), 'evicted')
  assert.equal(sc.state(13, 'e4b'), 'dark')
  assert.equal(sc.cause(13, 'e4b'), 'evicted-by-owner')
  sc.ev(20, 'mind.swap', 'e4b', { from: 'e4b', to: '12b', by: 'broker', phase: 'begin', seconds: null, why: 'a coder job' })
  sc.ev(20.24, 'mind.load.start', '12b', { 'need-mb': 6389, 'available-mb': 9000 })
  assert.equal(sc.state(20.5, '12b'), 'loading')
  assert.match(sc.cause(20.5, '12b') ?? '', /swap-for|wake/)
  assert.equal(transitions('dark', 'loading'), 'mind.arrive')
  loadMind(sc, '12b', 21)
  sc.ev(22, 'mind.turn.start', '12b', { who: 'owner', session: 'eval:x', model: '12b', mode: 'desk' })
  assert.equal(sc.state(22.5, '12b'), 'busy.reading')
  sc.ev(30, 'mind.swap', 'e4b', { from: '12b', to: 'e4b', by: 'broker', phase: 'done', seconds: 3.1, why: 'desk' })
  assert.equal(sc.state(30.2, '12b'), 'evicted')
  assert.equal(sc.state(34, '12b'), 'dark')
})

// spec: A3 §4.1 invariants: stalled and unknown have zero internal motion; §8 · class: M · technique: pose at dt and dt + 1 ·
// method: compare every channel but the ring fill and the jolt window · sre: does a stuck mind keep breathing? (no)
test('every mind state is reachable and the stalled pose at dt and dt + 1 is equal on every channel but the ring', () => {
  const sc = scenario()
  beat(sc, 0)
  loadMind(sc, 'e4b', 1)
  sc.ev(10, 'mind.turn.start', 'e4b', { who: 'owner', session: 'eval:x', model: 'e4b', mode: 'desk' })
  slot(sc, 10.25, 'e4b', true, 8, 30)
  for (let i = 0; i < 80; i++) slot(sc, 10.5 + i * 0.25, 'e4b', true, 8, 0)
  assert.equal(sc.state(25, 'e4b'), 'stalled')
  const a = pose(sc.f, 'e4b', 25)
  const b = pose(sc.f, 'e4b', 26)
  for (const [name, i] of Object.entries(CH)) if (name !== 'fill' && name !== 'blink') assert.equal(a[i], b[i], `channel ${name}`)
  assert.ok(b[CH.fill] > a[CH.fill], 'the amber elapsed ring fills')
  const seen = new Set(['dark', 'loading', 'resident', 'busy.reading', 'busy.thinking', 'busy.answering', 'stalled', 'failed', 'refused', 'engine-down', 'evicted', 'passing', 'unknown'])
  const sc2 = scenario()
  beat(sc2, 0)
  loadMind(sc2, 'e4b', 1)
  startRun(sc2, 'w-ccc333', 5, 'e4b')
  sc2.ev(10, 'mind.turn.start', 'e4b', { who: 'w-ccc333', session: 'eval:x', model: 'e4b', mode: 'work' }, { ref: 'w-ccc333' })
  sc2.ev(11, 'mind.turn.phase', 'e4b', { phase: 'call', tokens: 20, n: 1, tool: 'tail-log' })
  seen.add(sc2.state(11.5, 'e4b'))
  sc2.ev(12, 'mind.turn.phase', 'e4b', { phase: 'condense', tokens: 20, n: 1 })
  seen.add(sc2.state(12.5, 'e4b'))
  sc2.ev(13, 'mind.turn.phase', 'e4b', { phase: 'wait', tokens: 20, n: 1, why: 'queue' })
  seen.add(sc2.state(14.5, 'e4b'))
  sc2.ev(15, 'mind.turn.phase', 'e4b', { phase: 'wait', tokens: 20, n: 1, why: 'input' })
  seen.add(sc2.state(17.5, 'e4b'))
  sc2.ev(18, 'mind.turn.phase', 'e4b', { phase: 'wait', tokens: 20, n: 1, why: 'backpressure' })
  seen.add(sc2.state(20.5, 'e4b'))
  sc2.ev(21, 'press.wait', 'w-ccc333', { id: 'p-1', action: 'git-push', run: 'w-ccc333' })
  seen.add(sc2.state(21.5, 'e4b'))
  for (const s of STATES) assert.ok(seen.has(s), `state ${s} reached`)
})

// spec: F5-H's stall drill (2026-11-01: the 12B read "calling", then "stalled", 18 s after its run was stopped) · class: M ·
// technique: event sequence · sre: does a mind keep calling for a job the owner stopped?
test('a stopped run takes its open call with it: the mind leaves busy.calling when the job stops', () => {
  const sc = scenario()
  loadMind(sc, 'e4b', 1)
  startRun(sc, 'w-1', 3, 'e4b')
  sc.ev(6, 'run.ticket.open', 'w-1', { op: 'vector-eval', ticket: 't-1' })
  assert.equal(sc.state(7, 'e4b'), 'busy.calling')   // the job's call, with no turn of its own
  sc.ev(8, 'run.stop', 'w-1', { why: 'held by the owner', by: 'owner' })
  assert.equal(sc.state(30, 'e4b'), 'resident')
})

// spec: the make-it-right audit E14 §5 row 8 (A2 fix 5: the fold said the 26B `failed · turn-fail cancel` 228 s while its slot was busy;
// the E4B `failed` 2.5 days unloaded with `alert:e4b:turn-fail ×1064` and `cold-restarts 20199`) · class: M a state that lies · technique:
// a cancel, the owner's stop and a real failure, each followed by a turn, an unload, cold samples · method: the fold · sre: does a cancel
// ever outrank a live turn, does a failure outlive the next turn or an unload, and does every cold sample count a restart?
test('a cancel or the owner\'s stop is no failure; a failure ends at the next turn or an unload; a cold slot counts once', () => {
  const sc = scenario()
  beat(sc, 0)
  loadMind(sc, '26b', 1)
  sc.ev(10, 'mind.turn.start', '26b', { who: 'owner', session: 'console', id: 'desk-1' })
  sc.ev(12, 'mind.turn.fail', '26b', { reason: 'cancel', id: 'desk-1', msg: 'the caller closed the request' })
  assert.equal(sc.state(12.5, '26b'), 'resident', 'a cancel is no failure')
  assert.equal(sc.at(12.5, '26b').lastTurn.reason, 'cancel')
  assert.equal(sc.at(12.5, 'alert:26b:turn-fail'), null, 'and raises no alert')
  sc.ev(20, 'mind.turn.start', '26b', { who: 'owner', session: 'console', id: 'desk-2' })
  sc.ev(21, 'mind.turn.fail', '26b', { reason: 'stopped', id: 'desk-2' })
  assert.equal(sc.state(21.5, '26b'), 'resident', 'his stop is no failure either')
  sc.ev(22, 'mind.turn.start', '26b', { who: 'owner', session: 'console', id: 'room-1' })
  sc.ev(23, 'mind.turn.fail', '26b', { reason: 'stop', id: 'room-1' })
  sc.ev(24, 'mind.turn.start', '26b', { who: 'owner', session: 'console', id: 'room-2' })
  sc.ev(25, 'mind.turn.fail', '26b', { reason: 'swap', id: 'room-2' })
  assert.equal(sc.state(25.5, '26b'), 'resident', 'the room\'s stop and a swap\'s cut are no failure')
  sc.ev(30, 'mind.turn.start', '26b', { who: 'owner', session: 'console', id: 'desk-3' })
  sc.ev(31, 'mind.turn.fail', '26b', { reason: 'deadline', id: 'desk-3' })
  assert.equal(sc.state(31.5, '26b'), 'failed')
  assert.equal(sc.cause(31.5, '26b'), 'turn-fail deadline')
  sc.ev(40, 'mind.turn.start', '26b', { who: 'owner', session: 'console', id: 'desk-4' })
  sc.ev(40.1, 'mind.turn.phase', '26b', { phase: 'answer', id: 'desk-4', tokens: 12 })
  assert.equal(sc.state(40.5, '26b'), 'busy.answering', 'the next turn ends the failure: a failure never outranks a live turn')
  sc.ev(50, 'mind.turn.fail', '26b', { reason: 'error', id: 'desk-4' })
  assert.equal(sc.state(50.5, '26b'), 'failed')
  sc.ev(60, 'mind.unload', '26b', { by: 'owner', phase: 'done' })
  assert.notEqual(sc.state(80, '26b'), 'failed', 'an unload ends it')
  const sc2 = scenario()
  beat(sc2, 0)
  loadMind(sc2, 'e4b', 1)
  for (const s of [5, 6, 7]) sc2.ev(s, 'mind.slot', 'e4b', { slot: 0, busy: false, cold: true })
  sc2.ev(8, 'mind.slot', 'e4b', { slot: 0, busy: false, cold: false })
  sc2.ev(9, 'mind.slot', 'e4b', { slot: 0, busy: false, cold: true })
  assert.equal(sc2.at(9.5, 'e4b').coldRestarts, 2, 'the slot went cold twice; three cold samples are one')
})

// spec: the make-it-right audit E14 §5 rows 17, 45 (minds-17: the same mind has three sizes and he is told none) · class: M a record ·
// technique: a room turn read, answered and done with its sizes · method: the fold · sre: does the mind's last turn keep what it
// held (window, prompt, kept turns) from the turn's own record, and say nothing where the record says nothing?
test('a turn\'s read is the read phase with its tokens, and the last turn keeps its window, prompt and kept turns', () => {
  const sc = scenario()
  beat(sc, 0)
  loadMind(sc, 'e4b', 1)
  sc.ev(10, 'mind.turn.start', 'e4b', { who: 'owner', id: 'room-1' })
  sc.ev(10.1, 'mind.turn.phase', 'e4b', { phase: 'read', id: 'room-1', tokens: 7619, n: 0 })
  assert.equal(sc.state(11, 'e4b'), 'busy.reading')
  assert.equal(sc.at(11, 'e4b').turn.tokens, 7619)
  sc.ev(14, 'mind.turn.phase', 'e4b', { phase: 'answer', id: 'room-1', tokens: 0, n: 1 })
  assert.equal(sc.state(14.5, 'e4b'), 'busy.answering')
  sc.ev(20, 'mind.turn.done', 'e4b', { ms: 10000, id: 'room-1', window: 16384, prompt: 7619, kept: 3 })
  const last = sc.at(20.5, 'e4b').lastTurn
  assert.deepEqual([last.window, last.prompt, last.kept], [16384, 7619, 3])
  sc.ev(30, 'mind.turn.start', 'e4b', { who: 'owner', id: 'room-2' })
  sc.ev(31, 'mind.turn.done', 'e4b', { ms: 1000, id: 'room-2' })
  assert.deepEqual([sc.at(31.5, 'e4b').lastTurn.window, sc.at(31.5, 'e4b').lastTurn.kept], [null, null], 'no record, no number')
})
