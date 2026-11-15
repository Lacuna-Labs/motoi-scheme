process.env.LACUNA_AUTO_LOADS = '1'   // these tests exercise the automatic swap road, opt-in since 2026-11-04 (the owner decides who is loaded)
// broker.test.mjs — U3: THE POOLS AND THE MEMORY WALL, every state and every event. Owns: the tests of broker.mjs on a
// fake host (makeSup from the conformance suite: a clock the test moves, upstream and acts captured, a memory probe the
// test sets): admission of run foremen and minds, release, the wall's sweep (low for 300 s → the 12B as an act; high
// again → back, only a swap the wall made), a swap begun, done, failed and pressed twice, and what the desk reads.
// Refuses: files, sockets, the live broker; a mock of broker.mjs. Implements: unit-test work order §3 row broker.mjs
// (design §10 pools, the wall < 2 GB for 300 s → 12B as an act, < 1 GB admit refused, the wall undoes only its own swap,
// Permutation B; §17 exit 89; eng §3.5 WALL; §3.7). Invariants (§18): "if the brain is the 12B, then the 26B is not
// resident" (one swap in flight, its act sent once); "if swapped-at is set, the next step started on the new brain from
// the contract". Faults (§16): F-05.
// coverage: broker.mjs — lines 100% branches 100% functions 100% (2026-10-24)
import test from 'node:test'
import assert from 'node:assert/strict'
import { makeSup } from '../../../test/conformance/fake-host.mjs'
import { admit, release, wallSweep, beginSwap, swapDone, brokerStatus, broker, WALL, POOLS } from '../broker.mjs'
import { fileRun } from '../intents.mjs'

const mem = (o) => { const box = { availMB: o, wiredMB: 0 }; return { box, memory: () => box } }
// the acting governor's memory refusal, restored by LACUNA_GOVERNOR=1 for one test
const armed = (fn) => () => { process.env.LACUNA_GOVERNOR = '1'; try { return fn() } finally { delete process.env.LACUNA_GOVERNOR } }

// spec: design §10 (< 1 GB admit refused; ≤ 8 run foremen; MIND_MAX 3) · design §17 (89) · eng §3.5 WALL.admitMB 1,024, runForemen 8 · F-05
// class: B7 ceilings (the 9th run foreman, the 4th mind); M6 memory pressure
// technique: boundary (1,023 / 1,024 MB; 8 / 9 run foremen; 3 / 4 minds; an unknown kind)
// method: admit at each boundary; read ok/exit/why and the `no-room` upstream row naming F-05; release a mind and a
//         foreman and admit again; a kind that is neither is exit 12 with no upstream row
// sre: if the box is short of memory or full of runs, is a new one refused with 89 and a record, and is the seat given back?
test('admission: 1,023 MB is 89 with a no-room row, 1,024 is in; the 9th run foreman and the 4th mind are 89; release gives the seat back', armed(() => {
  const m = mem(WALL.admitMB - 1); const { h, s } = makeSup({ memory: m.memory })
  const r = admit(s, 'foreman', { id: 'r0' })
  assert.deepEqual([r.ok, r.exit, r.fault], [false, 89, 'F-05']); assert.match(r.why, /1023 MB non-wired free, under 1024/)
  assert.deepEqual(h.up.at(-1), { kind: 'no-room', name: 'broker', data: { fault: 'F-05', exit: 89, why: r.why, kind: 'foreman', id: 'r0' } })
  m.box.availMB = WALL.admitMB
  for (let i = 0; i < WALL.runForemen; i++) assert.equal(admit(s, 'foreman', { id: `r${i}` }).ok, true)
  assert.match(admit(s, 'foreman', { id: 'r9' }).why, /8 run foremen already/)
  for (let i = 0; i < POOLS.minds.max; i++) assert.equal(admit(s, 'mind').ok, true)
  assert.match(admit(s, 'mind').why, /3 small minds already \(MIND_MAX\)/)
  release(s, 'mind'); release(s, 'foreman', 'r3'); release(s, 'nothing')
  assert.equal(admit(s, 'mind').ok, true); assert.equal(admit(s, 'foreman').ok, true, 'an anonymous foreman takes the seat without a name')
  const n = h.up.length
  const odd = admit(s, 'gpu')
  assert.deepEqual([odd.ok, odd.exit], [false, 12]); assert.equal(h.up.length, n, 'a refusal by form is not a no-room record')
  release(s, 'mind'); release(s, 'mind'); release(s, 'mind'); release(s, 'mind')
  assert.equal(brokerStatus(s).minds, 0, 'never below zero')
}))

// spec: the owner, 2026-11-04 ("governors off ... let the os clear the memory"); LACUNA_GOVERNOR unset
// class: M6 memory pressure reported, never acted on
// technique: boundary: 1,023 MB with the governor off
// method: admit a run foreman: ok, no no-room row, one (governor (act report)) row with the figure
// sre: when memory is low, does the work the owner started still start, with the number written down?
test('governor off (the default): 1,023 MB admits with a report row carrying the figure, and no no-room row', () => {
  const m = mem(WALL.admitMB - 1); const { h, s } = makeSup({ memory: m.memory })
  assert.equal(admit(s, 'foreman', { id: 'r0' }).ok, true)
  assert.equal(h.up.filter((u) => u.kind === 'no-room').length, 0)
  assert.match(h.rows.at(-1), /^\(governor .*\("act" "report"\).*\("kind" "foreman"\).*\("avail-mb" 1023\)/)
})

// spec: design §10 (Permutation B: free < 2 GB for 5 min → the 12B; back at > 6 GB) · eng §3.5 WALL lowMB 2,048, lowForS 300, highMB 6,144 · F-05
// class: M6 memory pressure (the wall's numbers); J14 clock (the window measured on the host's clock)
// technique: fake clock (makeSup) and boundary: 2,047 MB for 299 s and for 300 s; a recovery inside the window resets it
// method: sweep at each step; read `lowSince`, the `switch-brain` act sent once, the `brain-swap begin` row, admission
//         refused while the swap is in flight, and no second act on the next sweep
// sre: if memory stays low for five minutes, does the brain step down once, and does nothing new start while it switches?
test('the wall: under 2,048 MB for 300 s swaps to the 12B as one act; a recovery inside the window resets the clock; nothing is admitted mid-swap', () => {
  const m = mem(WALL.lowMB - 1); const { h, s } = makeSup({ memory: m.memory })
  assert.equal(wallSweep(s).swap, null); h.tick(200)
  m.box.availMB = WALL.lowMB; assert.equal(wallSweep(s).swap, null); assert.equal(broker(s).lowSince, null, 'a recovery resets the window')
  m.box.availMB = WALL.lowMB - 1; wallSweep(s); h.tick(WALL.lowForS - 1)
  assert.equal(wallSweep(s).swap, null, '299 s is not 300')
  h.tick(1); const r = wallSweep(s)
  assert.equal(r.swap, '12b'); assert.match(r.why, /2047 MB free for 300 s/)
  assert.deepEqual(h.acts, [{ op: 'switch-brain', args: ['12b'] }])
  assert.equal(h.up.at(-1).data.phase, 'begin')
  assert.deepEqual(wallSweep(s), { swap: null, swapping: '12b' }); assert.equal(h.acts.length, 1)
  assert.match(admit(s, 'mind').why, /the brain is switching to the 12b/)
  assert.equal(brokerStatus(s).swapping.by, 'wall')
})

// spec: design §10 (the wall undoes only its own swap; "back at > 6 GB") · eng §3.7 row "§10 hysteresis" · POSTMORTEMS 2026-10-23 (the wall undid a pressed swap)
// class: E3 the wrong strategy family (an automatic undo applied to a person's act)
// technique: state-machine walk: wall swap → done → high memory → back; pressed swap → done → high memory → held
// method: (a) a wall swap done; 6,144 MB is not "high again", 6,145 is: the wall begins the swap back; (b) a pressed swap
//         done; 9,000 MB: held, "the wall does not undo a press"; (c) a 12B whose swap predates `by`: held, "a person"
// sre: if the owner pressed the 12B, does the wall leave it alone when memory recovers?
test('back to the 26B only above 6,144 MB and only when the wall made the swap; a press (or an unknown author) is held', () => {
  const m = mem(1000); const { h, s } = makeSup({ memory: m.memory })
  beginSwap(s, '12b', 'low', 'wall'); swapDone(s, { ok: true })
  m.box.availMB = WALL.highMB; assert.equal(wallSweep(s).swap, null)
  m.box.availMB = WALL.highMB + 1; assert.equal(wallSweep(s).swap, '26b'); swapDone(s, { ok: true, to: '26b' })
  assert.equal(brokerStatus(s).brain, '26b')
  beginSwap(s, '12b', 'pressed by owner', 'owner'); swapDone(s, { ok: true })
  m.box.availMB = 9000
  assert.match(wallSweep(s).held, /pressed by owner; the wall does not undo a press/)
  delete broker(s).by
  assert.match(wallSweep(s).held, /pressed by a person/)
  assert.deepEqual(h.acts.map((a) => a.args[0]), ['12b', '26b', '12b'])
})

// spec: design §10 (Permutation B is a restart; one swap at a time) · law 4 (an act is followed, never reissued) · I-12
// class: E10 a duplicate message (a second switch-brain act while the first runs)
// technique: state-machine walk: begin → begin again before done
// method: begin a pressed swap to the 12B; press again (12B or 26B) before the hands answer; the second is held, no second
//         act goes out, the first's author is kept; after done, a new press begins normally
// sre: if the owner presses twice while the brain switches, does the box restart the brain once, not twice?
test('a second swap while one is in flight is held: one switch-brain act, the first author kept', () => {
  const { h, s } = makeSup()
  assert.equal(beginSwap(s, '12b', 'pressed', 'owner').swap, '12b')
  const again = beginSwap(s, '26b', 'pressed again', 'proof')
  assert.equal(again.swap, null); assert.match(again.held, /a swap to the 12b is in flight/)
  assert.equal(h.acts.length, 1); assert.equal(broker(s).swapping.by, 'owner')
  swapDone(s, { ok: true })
  assert.equal(beginSwap(s, '26b', 'pressed', 'owner').swap, '26b'); assert.equal(h.acts.length, 2)
})

// spec: design §10 ("the contract records swapped-at"; "the desk shows brain switching") · §18 ("if swapped-at is set, the next step started on the new brain from the contract") · F-05
// class: E9 a message lost (the swap act failed); L5 the record's shape
// technique: state-machine walk: no swap → done (refused); begin → failed; begin → done with living runs; an armed host
// method: swapDone with nothing in flight; a failed swap (brain unchanged, `failed` row with why, swaps list); a done swap
//         with a living run: its contract's swapped-at is set and its thought says the brain; an unarmed host holds the swap
// sre: if the switch fails, is the brain left as it was and said so; if it succeeds, does every living run know?
test('swap done records swapped-at on every living run; a failed swap leaves the brain and says why; an unarmed host holds the swap', () => {
  const { h, s } = makeSup()
  assert.deepEqual(swapDone(s), { ok: false, why: 'no swap in flight' })
  beginSwap(s, '12b', 'pressed', 'owner')
  assert.deepEqual(swapDone(s, { ok: false, why: 'the 12B did not load' }), { ok: false, why: 'the 12B did not load', brain: '26b' })
  assert.equal(brokerStatus(s).brain, '26b'); assert.equal(brokerStatus(s).swaps.at(-1).failed, 'the 12B did not load')
  assert.equal(h.up.filter((u) => u.kind === 'brain-swap').at(-1).data.phase, 'failed')
  assert.equal(h.letters.length, 1, 'one letter for the refusal'); assert.match(h.letters[0].what, /The 26b serves the desk\. One try/)
  const run = fileRun(s, { key: 'sw', goal: 'g' })
  s.spawn({ name: 'plain', program: "(on 'x (lambda (v) v))" })
  beginSwap(s, '12b', 'pressed', 'owner'); const d = swapDone(s, { ok: true, to: '12b' })
  assert.deepEqual(d, { ok: true, brain: '12b' })
  assert.ok(run.contract.swapped_at != null, 'swapped-at on the run'); assert.ok(run.thoughts.some((x) => /the brain is the 12b now/.test(x.text)))
  assert.equal(brokerStatus(s).by, 'owner'); assert.equal(brokerStatus(s).avail_mb, null, 'no probe: no number on the desk')
  const { s: s2 } = makeSup(); s2.host.swapArmed = () => false
  assert.match(beginSwap(s2, '12b', 'low').held, /waits for the owner's press/)
  s2.host.swapArmed = () => true; assert.equal(beginSwap(s2, '12b', 'low').swap, '12b')
  broker(s2).swapping = { to: '12b', since: 0, why: 'old' }; swapDone(s2)
  assert.equal(brokerStatus(s2).by, 'press', 'a swap with no author is recorded as a press')
})

// spec: design §10 ("no memory reading: the wall does nothing"; 2026-10-24 Infinity read as high) · eng §3.5 WALL
// class: J13 an absent reading (NaN, Infinity, no probe); M6
// technique: boundary over the probe's answers (none, NaN, Infinity) with the 12B in place
// method: with the 12B by the wall, sweep with no probe, a NaN and an Infinity reading: no swap, "no memory reading";
//         /broker's avail_mb is null for each and a number for a real reading
// sre: if Lacuna's memory sample is missing, does the wall stay still instead of swapping the brain on a guess?
test('no real memory reading: the wall does nothing and the desk shows no number', () => {
  const m = mem(NaN); const { s } = makeSup({ memory: m.memory })
  beginSwap(s, '12b', 'low', 'wall'); swapDone(s, { ok: true })
  for (const v of [NaN, Infinity]) { m.box.availMB = v; assert.equal(wallSweep(s).why, 'no memory reading: the wall does nothing'); assert.equal(brokerStatus(s).avail_mb, null) }
  m.box.availMB = 3000.4; assert.equal(brokerStatus(s).avail_mb, 3000); assert.equal(wallSweep(s).swap, null)
})
