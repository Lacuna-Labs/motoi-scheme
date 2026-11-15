// alarms.test.mjs — THE ALARM DISCIPLINE (lane F5-BC, BC.7). Owns: A3 §9's alert cases: dedup ×N, inhibit under a stale parent
// and re-evaluation on fresh, flapping in at 50 % and out at 25 % over the 21-sample history, ack → steady, resolved-unseen
// ghost until seen, flood at 10 in 10 min and out at 3, the one flasher (the highest level, newest among equals; two pages at
// once → one flasher; the press edge yields), the ≤ 4 movers with the yield order and a fall that never waits, the off-screen
// marker list, the changed-since-you-looked mark, and the page budget as a count. Refuses: a mock of the fold.
import test from 'node:test'
import assert from 'node:assert/strict'
import { scenario, loadMind, startRun } from './fixtures/scenario.mjs'
import { pose, seen } from '../fold.js'
import { flasher, markers, pagesToday } from '../alarms.js'
import { requestMove, create as createLayout, movers } from '../layout.js'
import { CH, FLAG } from '../keyframe.js'

const raise = (sc, s, key, level = 'warn', actor = 'w-5f0c6c') => sc.ev(s, 'alert.raise', `alert:${key}`, { key, level, title: key, source: 'alerts', actor, fault: key.split(':').pop() })

// spec: A3 §7 one mark per incident; A4 V-166 · class: M · technique: two raises · method: the second raise is ×2 with the same
// raisedT; a raise after a resolve refreshes raisedT · sre: do two raises of one fault draw two marks? (never)
test('a second raise of the same actor + fault is ×2 on one mark; a raise after a resolve refreshes raisedT', () => {
  const sc = scenario()
  loadMind(sc, 'e4b', 1)
  raise(sc, 10, 'e4b:disk-low', 'warn', 'e4b')
  raise(sc, 20, 'e4b:disk-low', 'warn', 'e4b')
  const a = sc.at(20.5, 'alert:e4b:disk-low')
  assert.equal(a.count, 2)
  assert.equal(a.raisedT, 10)
  assert.equal(a.cause, '×2')
  assert.equal(a.state, 'raised')
  assert.deepEqual(sc.at(20.5, 'e4b').alarms, ['alert:e4b:disk-low'])
  sc.ev(30, 'alert.resolve', 'alert:e4b:disk-low', { 'after-s': 20 })
  assert.equal(sc.state(30.5, 'alert:e4b:disk-low'), 'resolved-unseen')
  raise(sc, 40, 'e4b:disk-low', 'warn', 'e4b')
  const b = sc.at(40.5, 'alert:e4b:disk-low')
  assert.equal(b.raisedT, 40)
  assert.equal(b.count, 1)
})

// spec: A3 §7 inhibit when the parent is stale, re-evaluate on fresh; C-47 · class: M · technique: silence then a beat · method:
// a derived raise on a worker is held while the foreman is stale; after the beat the next event raises it ·
// sre: does a blind parent raise its children's alarms? (never)
test('a derived raise on a child is held while the foreman is stale and raised again once he is fresh', () => {
  const sc = scenario({ beats: 0 })
  sc.ev(0, 'foreman.beat', 'foreman', { living: 1, 'lag-ms': 2, 'rss-mb': 188, drops: 0 })
  loadMind(sc, 'e4b', 1)
  startRun(sc, 'w-5f0c6c', 2)
  assert.equal(sc.state(35, 'foreman'), 'stale')
  sc.ev(36, 'run.stall', 'w-5f0c6c', { why: 'nothing pending', missed: 2, exit: null })
  assert.equal(sc.state(36.5, 'w-5f0c6c'), 'unknown')
  assert.equal(sc.at(36.5, 'alert:w-5f0c6c:f-06'), null, 'held')
  sc.ev(40, 'foreman.beat', 'foreman', { living: 1, 'lag-ms': 2, 'rss-mb': 188, drops: 0 })
  assert.equal(sc.state(40.5, 'w-5f0c6c'), 'stalled')
  sc.ev(41, 'run.stall', 'w-5f0c6c', { why: 'nothing pending', missed: 3, exit: null })
  assert.equal(sc.state(41.5, 'alert:w-5f0c6c:f-06'), 'raised')
})

// spec: A3 §7 flapping by Nagios's 21 weighted states (in ≥ 50 %, out ≤ 25 %); A4 V-163 · class: M · technique: a chattering key ·
// method: 8 raise/resolve pairs in 10 min → flapping, hatched, no flash; 16 steady raises 200 s apart (each a sample; ≤ 3 per
// 10 min, so the area's flood clears) bring it under 25 % ·
// sre: does a chattering alarm blink? (never: hatched)
test('a chattering key enters flapping at 50 % and the mark is hatched without a flash; it leaves at 25 %', () => {
  const sc = scenario()
  startRun(sc, 'w-5f0c6c', 1)
  for (let i = 0; i < 8; i++) { raise(sc, 10 + i * 20, 'w-5f0c6c:chatter'); sc.ev(20 + i * 20, 'alert.resolve', `alert:w-5f0c6c:chatter`, { 'after-s': 10 }) }
  raise(sc, 180, 'w-5f0c6c:chatter')
  const a = sc.at(180.5, 'alert:w-5f0c6c:chatter')
  assert.ok(a.flapPct >= 50, `flap ${a.flapPct} %`)
  assert.equal(a.state, 'flapping')
  const p = pose(sc.f, 'alert:w-5f0c6c:chatter', 180.5)
  assert.ok((p[CH.flags] & FLAG.hatched) !== 0)
  assert.equal(p[CH.flags] & FLAG.flash, 0)
  assert.equal(flasher(sc.f.alarms), null, 'a flapping mark is never the flasher')
  for (let i = 0; i < 16; i++) raise(sc, 1000 + i * 200, 'w-5f0c6c:chatter')
  const b = sc.at(4010, 'alert:w-5f0c6c:chatter')
  assert.ok(b.flapPct <= 25, `flap ${b.flapPct} %`)
  assert.equal(b.state, 'raised')
})

// spec: A3 §7 ack → steady, ghost until seen; A4 V-161, V-162, V-170; C-76 · class: M · technique: ack, resolve, seen · method:
// ack turns the mark steady; a resolve unseen is a ghost; `seen` fades it in 2 s; an unseen ghost lasts 60 s · sre: when does a mark leave?
test('an ack is steady; a resolve before it is seen is a ghost until seen (then a 2 s fade) or 60 s', () => {
  const sc = scenario()
  startRun(sc, 'w-5f0c6c', 1)
  raise(sc, 10, 'w-5f0c6c:a', 'page')
  assert.equal(sc.state(10.5, 'alert:w-5f0c6c:a'), 'raised')
  assert.ok((pose(sc.f, 'alert:w-5f0c6c:a', 10.5)[CH.flags] & FLAG.flash) !== 0)
  sc.ev(12, 'alert.ack', 'alert:w-5f0c6c:a', { by: 'owner' })
  assert.equal(sc.state(12.5, 'alert:w-5f0c6c:a'), 'acknowledged')
  assert.equal(pose(sc.f, 'alert:w-5f0c6c:a', 12.5)[CH.flags] & FLAG.flash, 0)
  raise(sc, 20, 'w-5f0c6c:b')
  sc.ev(25, 'alert.resolve', 'alert:w-5f0c6c:b', { 'after-s': 5 })
  assert.equal(sc.state(25.5, 'alert:w-5f0c6c:b'), 'resolved-unseen')
  assert.ok((pose(sc.f, 'alert:w-5f0c6c:b', 25.5)[CH.flags] & FLAG.ghost) !== 0)
  sc.to(30)
  seen(sc.f, ['w-5f0c6c'], 30)
  assert.equal(sc.at(31, 'alert:w-5f0c6c:b').seen, true)
  assert.equal(sc.state(32.5, 'alert:w-5f0c6c:b'), 'gone')
  raise(sc, 40, 'w-5f0c6c:c')
  sc.ev(41, 'alert.resolve', 'alert:w-5f0c6c:c', { 'after-s': 1 })
  assert.equal(sc.state(100, 'alert:w-5f0c6c:c'), 'resolved-unseen')
  assert.equal(sc.state(104, 'alert:w-5f0c6c:c'), 'gone')
})

// spec: A3 §7 flood ≥ 10 raises per 10 min per area, out at ≤ 3; A4 V-164 · class: M · technique: 12 raises · method: the area
// floods, single marks hide, the flood block names it; a quiet 10 min clears it · sre: what does the floor draw under a storm?
test('12 raises in 10 min on one area collapse to the flood marker; the area leaves flood when the window holds ≤ 3', () => {
  const sc = scenario()
  startRun(sc, 'w-5f0c6c', 1)
  for (let i = 0; i < 12; i++) raise(sc, 10 + i * 30, `w-5f0c6c:f${i}`)
  sc.to(345)
  const f = sc.f.alarms.flood.work
  assert.equal(f.on, true)
  assert.equal(sc.state(345, 'alert:w-5f0c6c:f11'), 'flood')
  assert.equal(flasher(sc.f.alarms), null, 'hidden marks do not flash')
  raise(sc, 1000, 'w-5f0c6c:late')
  sc.to(1000.5)
  assert.equal(sc.f.alarms.flood.work.on, false)
  assert.equal(sc.state(1000.5, 'alert:w-5f0c6c:late'), 'raised')
})

// spec: A3 §7 the one flasher (C-78: the highest level, newest among equals; the press edge yields) · class: M · technique: two
// pages and a warn · method: the newer page flashes, the older is steady, a newer warn does not out-flash a page; a press edge
// goes steady while a flasher stands · sre: can two things flash at once? (never)
test('two pages at once give one flasher (the newer); a newer warn never out-flashes a page; the press edge yields', () => {
  const sc = scenario()
  loadMind(sc, 'e4b', 1)
  startRun(sc, 'w-5f0c6c', 2)
  startRun(sc, 'w-aaa111', 2)
  sc.ev(4, 'sentry.attach', 'sentry-1b:w-5f0c6c', { model: '1b', run: 'w-5f0c6c', domain: null, mode: 'shadow', 'period-s': 10 }, { ref: 'w-5f0c6c' })
  sc.ev(4, 'sentry.attach', 'sentry-1b:w-aaa111', { model: '1b', run: 'w-aaa111', domain: null, mode: 'shadow', 'period-s': 10 }, { ref: 'w-aaa111' })
  raise(sc, 10, 'w-5f0c6c:p1', 'page')
  raise(sc, 20, 'w-aaa111:p2', 'page', 'w-aaa111')
  sc.to(20.5)
  assert.equal(flasher(sc.f.alarms), 'alert:w-aaa111:p2')
  assert.equal(sc.state(20.5, 'alert:w-5f0c6c:p1'), 'raised-steady')
  assert.equal(sc.state(20.5, 'alert:w-aaa111:p2'), 'raised')
  raise(sc, 30, 'w-5f0c6c:w1', 'warn')
  sc.to(30.5)
  assert.equal(sc.at(30.5, 'alert:w-aaa111:p2').flasher, true)
  assert.equal(sc.state(30.5, 'alert:w-5f0c6c:w1'), 'raised-steady')
  let flashing = 0
  for (const r of sc.f.registry.values()) if (r.kind === 'alert' && (pose(sc.f, r.id, 30.5)[CH.flags] & FLAG.flash)) flashing++
  assert.equal(flashing, 1)
  sc.ev(40, 'press.wait', 'w-5f0c6c', { id: 'p-1', action: 'git-push', run: 'w-5f0c6c' })
  assert.equal(sc.at(40.5, 'w-5f0c6c').pressYields, true)
  assert.equal(pose(sc.f, 'w-5f0c6c', 40.5)[CH.blink], 1, 'steady amber: the press edge yields')
  sc.ev(50, 'alert.ack', 'alert:w-aaa111:p2', { by: 'owner' })
  sc.ev(51, 'alert.ack', 'alert:w-5f0c6c:p1', { by: 'owner' })
  sc.ev(52, 'alert.ack', 'alert:w-5f0c6c:w1', { by: 'owner' })
  assert.equal(sc.at(52.5, 'w-5f0c6c').pressYields, false)
  assert.equal(pagesToday(sc.f.alarms, sc.f.t), 2)
})

// spec: A3 §7 the ≤ 4 movers scheduler with its yield order · class: M · technique: a burst of 12 moves · method: 4 run, a fifth
// reflow waits, a fall never waits, the next pending starts 120 ms after one ends in the yield order · sre: how many bodies travel at once?
test('a burst of 12 moves runs 4, yields reflows first, never delays a fall, and starts the next 120 ms after one ends', () => {
  const L = createLayout()
  const rec = (id) => ({ id, pos: { x: 0, z: 0 }, vel: { x: 0, z: 0 }, target: null, settledAt: 0 })
  const recs = Array.from({ length: 12 }, (_, i) => rec(`m${i}`))
  const kinds = ['home', 'toring', 'return', 'reflow', 'home', 'reflow', 'toring', 'return', 'home', 'reflow', 'toring', 'home']
  recs.forEach((r, i) => requestMove(L, r, kinds[i], { x: 10, z: 0 }, 1, 0))
  assert.equal(movers(L).length, 4)
  assert.deepEqual(movers(L).map((m) => m.id), ['m0', 'm1', 'm2', 'm3'])
  assert.equal(L.pending.length, 8)
  assert.equal(L.pending[L.pending.length - 1].kind, 'home', 'the last to wait is a home flight: reflows and returns yield first')
  assert.equal(L.pending[0].kind, 'reflow')
  requestMove(L, rec('star'), 'fall', { x: 5, z: 5 }, 0.7, 0.1)
  assert.equal(movers(L).length, 5, 'a fall never waits')
  const registry = new Map([...recs, rec('star')].map((r) => [r.id, r]))
  const { stepTo } = awaitLayout()
  stepTo(L, registry, 1.5)
  assert.ok(movers(L).length <= 4)
  assert.ok(movers(L).some((m) => m.kind === 'home'), 'the next pending started')
  assert.ok(L.next > 1, 'the next start is 120 ms after the last')
  function awaitLayout() { return { stepTo: (l, reg, t) => { const steps = Math.floor(t * 60); while (l.step < steps) { l.step++; const tt = l.step / 60; while (l.pending.length && l.movers.length < 4 && tt >= l.next) { const p = l.pending.pop(); l.movers.push({ id: p.id, kind: p.kind, since: tt, until: tt + p.durS }); l.next = tt + 0.12 } l.movers = l.movers.filter((m) => tt < m.until) } } } }
})

// spec: A3 §7 off-screen edge markers; "changed since you looked" (R4 §7 item 16) · class: M · technique: seen with a frustum
// list · method: an actor outside the list gets a marker for its raised alert; a state change off-screen sets changed, seen clears it ·
// sre: what does the owner see of a page behind the camera?
test('a raised alert on an actor out of frame is a marker; a change off-screen sets changed until seen', () => {
  const sc = scenario()
  loadMind(sc, 'e4b', 1)
  startRun(sc, 'w-5f0c6c', 2)
  raise(sc, 10, 'w-5f0c6c:p', 'page')
  sc.to(11)
  seen(sc.f, ['e4b'], 11)
  for (const r of sc.f.registry.values()) if (r.kind === 'alert' && r.actorId !== 'e4b') r.offScreen = true
  const m = markers(sc.f.alarms, sc.f.registry)
  assert.equal(m.length, 1)
  assert.equal(m[0].actorId, 'w-5f0c6c')
  assert.equal(m[0].level, 'page')
  assert.equal(m[0].flasher, true)
  assert.equal(sc.state(11.5, 'alert:w-5f0c6c:p'), 'off-screen')
  assert.equal(sc.at(11.5, 'w-5f0c6c').changed, true)
  assert.equal(sc.at(11.5, 'e4b').changed, false)
  seen(sc.f, ['w-5f0c6c'], 12)
  assert.equal(sc.at(12.5, 'w-5f0c6c').changed, false)
  assert.equal(markers(sc.f.alarms, sc.f.registry).length, 0)
})
