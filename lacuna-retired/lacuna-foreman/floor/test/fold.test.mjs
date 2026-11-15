// fold.test.mjs — THE FOLD (lane F5-BC, BC.3). Owns: the tests that every kind in the catalog folds without a throw, that an
// unknown kind, a bad seq and a bad clock are refused with their reasons, that a stale producer marks its actors `unknown`,
// that `floor.quarantine` reaches Lacuna's record and the floor block, that a scene.begin takes a keyframe, and that the
// fold reads `(ev …)` text through the one reader. Refuses: a mock of the fold.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createFold, fold, tick, registry, actor, refused, keyframe, readEvents, restore, snapshot, KINDS_REACTED } from '../fold.js'
import { readCatalog, validate } from './fixtures/catalog.mjs'
import { sampleEvent, EPOCH } from './fixtures/sample.mjs'

const catalog = readCatalog()

// spec: BC.3's gate; RULINGS §1(a) the catalog · class: J · technique: one event per kind · method: fold each catalog kind
// once, valid against the catalog · sre: can any record on the wire crash the floor?
test('every kind in the catalog folds without a throw and every folded kind is valid against the catalog', () => {
  const f = createFold({ epoch: EPOCH })
  let seq = 0
  const kinds = [...catalog.keys()]
  for (const kind of kinds) {
    const ev = sampleEvent(kind, catalog.get(kind), ++seq, EPOCH + seq * 1000)
    const v = validate(catalog, ev)
    assert.ok(v.ok, v.why)
    assert.equal(fold(f, [ev]), 1, `${kind} folds`)
  }
  assert.equal(refused(f).length, 0, JSON.stringify(refused(f)))
  for (const k of kinds) assert.ok(KINDS_REACTED.has(k), `${k} reacted`)
  assert.ok(registry(f).size > 20)
})

// spec: master §2.6 item 2 (a bad event is refused with its reason) · class: J · technique: three bad events · method:
// unknown kind, a seq at the last, a non-finite t · sre: what does the floor do with a kind nobody declared?
test('an unknown kind, a seq not after the last and a bad clock are refused with their reasons', () => {
  const f = createFold({ epoch: EPOCH })
  fold(f, [sampleEvent('foreman.beat', catalog.get('foreman.beat'), 5, EPOCH + 5000)])
  assert.equal(fold(f, [{ seq: 6, t: EPOCH + 6000, kind: 'mind.levitate', actor: 'e4b', at: '-', ref: null, src: ['x', 0], data: {} }]), 0)
  assert.equal(fold(f, [sampleEvent('foreman.beat', catalog.get('foreman.beat'), 5, EPOCH + 7000)]), 0)
  assert.equal(fold(f, [{ ...sampleEvent('foreman.beat', catalog.get('foreman.beat'), 7, EPOCH), t: NaN }]), 0)
  assert.deepEqual(refused(f).map((r) => r.why), ['unknown-kind', 'seq', 'clock'])
  assert.equal(f.floor.bad['unknown-kind'], 1)
  assert.equal(f.seq, 7, 'a row refused in order still passes its seq (A2 §5.2: the keyframe stands after it)')
  assert.equal(fold(f, [{ seq: 8, t: EPOCH + 8000, kind: 'wo.state', actor: '', at: '-', ref: null, src: ['work-orders', 8], data: { state: 'running' } }]), 0)
  assert.deepEqual([refused(f).at(-1).why, f.seq], ['no-record', 8], 'a row that names no record too')
})

// spec: A2 §5.3 (a day restarts seq at 1; the reader marks each event with its day) · class: J14 clocks (midnight) ·
// technique: the last event of a day, then the first of the next · method: fold seq 5 of one day, seq 1 and 2 of the next,
// then seq 9 of the day before and an unmarked seq 1; restore a keyframe that names its day · sre: does the floor stop at
// midnight?
test('a later day restarts seq at 1, an earlier day is refused, and a restored keyframe keeps its day', () => {
  const f = createFold({ epoch: EPOCH })
  const beat = (seq, t, day) => ({ ...sampleEvent('foreman.beat', catalog.get('foreman.beat'), seq, t), day })
  assert.equal(fold(f, [beat(5, EPOCH + 1000, '2026-10-31'), beat(1, EPOCH + 2000, '2026-11-01'), beat(2, EPOCH + 3000, '2026-11-01')]), 3)
  assert.equal(fold(f, [beat(9, EPOCH + 4000, '2026-10-31')]), 0)
  assert.equal(fold(f, [beat(1, EPOCH + 5000, undefined)]), 0, "an unmarked event keeps the fold's day and its count")
  assert.deepEqual(refused(f).map((r) => r.why), ['seq', 'seq'])
  const g = restore(createFold({ epoch: EPOCH }), `${snapshot(f, 5).slice(0, -1)} (day "2026-11-01"))`)
  assert.equal(g.day, '2026-11-01')
  assert.equal(fold(g, [beat(2, EPOCH + 6000, '2026-11-01')]), 0, 'a seq the restored day already holds')
  assert.equal(fold(g, [beat(3, EPOCH + 6000, '2026-11-01')]), 1)
})

// spec: master §2.6 item 3 "staleness is a state, never a held value" · class: M · technique: floor.stale then floor.fresh ·
// method: a loaded mind on a job goes unknown with the producer's sentence, then back · sre: does a dead feed ever show a live light?
test('a stale producer marks its actors unknown with the cause and floor.fresh clears it', () => {
  const f = createFold({ epoch: EPOCH })
  const evs = [
    sampleEvent('foreman.beat', catalog.get('foreman.beat'), 1, EPOCH + 1000),
    { ...sampleEvent('mind.load.start', catalog.get('mind.load.start'), 2, EPOCH + 2000), actor: 'e4b' },
    { ...sampleEvent('mind.load.done', catalog.get('mind.load.done'), 3, EPOCH + 3000), actor: 'e4b' },
    { seq: 4, t: EPOCH + 10000, kind: 'floor.stale', actor: 'floor', at: '-', ref: null, src: ['door', 4], data: { producer: 'lme-breadcrumbs', 'period-s': 6, 'silent-s': 18, actors: ['e4b'] } },
  ]
  assert.equal(fold(f, evs), 4)
  const m = actor(f, 'e4b')
  assert.equal(m.state, 'unknown')
  assert.match(m.cause, /stale-feed/)
  assert.equal(fold(f, [{ seq: 5, t: EPOCH + 12000, kind: 'floor.fresh', actor: 'floor', at: '-', ref: null, src: ['door', 5], data: { producer: 'lme-breadcrumbs', 'silent-s': 20 } }]), 1)
  assert.equal(actor(f, 'e4b').state, 'resident')
})

// spec: master §2.6 item 2 the quarantine count lights Lacuna's edges; §2.6 item 4 a drill is a transaction · class: M ·
// technique: two floor events · method: a quarantine row, then scene.begin · sre: where does a bad producer show?
test('floor.quarantine reaches Lacuna and the floor block; scene.begin takes the keyframe', () => {
  const f = createFold({ epoch: EPOCH })
  fold(f, [{ seq: 1, t: EPOCH + 1000, kind: 'floor.quarantine', actor: 'floor', at: '-', ref: null, src: ['door', 1], data: { n: 3, reason: 'unknown-kind', producer: 'forge-runs' } }])
  assert.equal(actor(f, 'lacuna').quarantine, 3)
  assert.equal(f.floor.quarantine, 3)
  assert.equal(keyframe(f), null)
  fold(f, [{ seq: 2, t: EPOCH + 2000, kind: 'scene.begin', actor: 'floor', at: '-', ref: 'drill:night', src: ['owner', 2], data: { name: 'the long night', secs: 96, by: 'owner' } }])
  assert.ok(keyframe(f).startsWith('(state (v 1) '))
  assert.equal(f.floor.scene.name, 'the long night')
  fold(f, [{ seq: 3, t: EPOCH + 3000, kind: 'scene.end', actor: 'floor', at: '-', ref: 'drill:night', src: ['owner', 3], data: { name: 'the long night', score: null } }])
  assert.equal(f.floor.scene, null)
})

// spec: A2 §2.1 the grammar; law 5 one reader · class: J · technique: text round trip · method: two (ev …) lines with a prev ·
// sre: does the fold read what the day file wrote?
test('readEvents reads (ev …) lines through the one reader, prev ignored, src kept', () => {
  const text = `(ev (seq 2205) (t 1793388010000) (kind foreman.beat) (actor "foreman") (at "studio·foreman·-·-·-·-") (ref null) (src "foreman-health" 1793388010) (data (@ ("living" 4) ("lag-ms" 2) ("rss-mb" 188) ("drops" 0))) (prev "sha256:abc"))
(ev (seq 2206) (t 1793388011000) (kind wo.state) (actor "wo-995779") (at "-") (ref "wo-995779") (src "work-orders" 1793388011) (data (@ ("state" "running") ("for" "engineer") ("run" "w-5f0c6c"))))`
  const evs = readEvents(text)
  assert.equal(evs.length, 2)
  assert.deepEqual(evs[0], { seq: 2205, t: 1793388010000, kind: 'foreman.beat', actor: 'foreman', at: 'studio·foreman·-·-·-·-', ref: null, src: ['foreman-health', 1793388010], data: { living: 4, 'lag-ms': 2, 'rss-mb': 188, drops: 0 } })
  assert.equal(evs[1].data.run, 'w-5f0c6c')
})

// spec: A3 lifetimes & P-2026-11-01-floor-state-too-long · class: M · technique: fold a run + worker + visitor to completion,
// assert they stand during their exit ceremony, then tick past their retirement grace and assert they leave the registry ·
// sre: does the floor registry grow without bound over a 24 h day?
test('retired rings, pads, workers, visitors and their ephemeral streams leave the registry after their exit grace', () => {
  const f = createFold({ epoch: EPOCH })
  fold(f, [
    { seq: 1, t: EPOCH + 1000, kind: 'wo.state', actor: 'wo-retire1', at: '-', ref: 'wo-retire1', src: ['work-orders', 1], data: { state: 'running', for: 'engineer', run: 'w-retire1' } },
    { seq: 2, t: EPOCH + 1000, kind: 'run.start', actor: 'w-retire1', at: '-', ref: 'wo-retire1', src: ['runs', 2], data: { cart: 'cart:probe', brain: 'e4b', steps: 2 } },
    { seq: 3, t: EPOCH + 2000, kind: 'run.step', actor: 'w-retire1', at: '-', ref: 'wo-retire1', src: ['runs', 3], data: { i: 1, n: 2, phase: 'done', ms: 40 } },
    { seq: 4, t: EPOCH + 3000, kind: 'run.pass', actor: 'w-retire1', at: '-', ref: 'wo-retire1', src: ['runs', 4], data: { ms: 2000, receipts: 1 } },
    { seq: 5, t: EPOCH + 3000, kind: 'wo.state', actor: 'wo-retire1', at: '-', ref: 'wo-retire1', src: ['work-orders', 5], data: { state: 'done', for: 'engineer', run: 'w-retire1' } },
  ])
  // At logT = 6.2 s, ring has finished its seal ceremony and entered 'gone', and remains inspectable during the 90 s grace:
  tick(f, 6.2)
  assert.equal(actor(f, 'ring:w-retire1')?.state, 'gone')
  assert.ok(actor(f, 'pad:w-retire1'))
  assert.equal(actor(f, 'w-retire1')?.state, 'passed')
  assert.equal(actor(f, 'wo-retire1')?.state, 'done')

  // After the 90 s retirement grace (logT = 200 s), ring, pad, worker, work order, and ephemeral run streams are pruned:
  tick(f, 200)
  assert.equal(actor(f, 'ring:w-retire1'), null)
  assert.equal(actor(f, 'pad:w-retire1'), null)
  assert.equal(actor(f, 'w-retire1'), null)
  assert.equal(actor(f, 'wo-retire1'), null)
  assert.equal(actor(f, 'road:text:w-retire1>foreman'), null)
  // Permanent seats remain:
  assert.ok(actor(f, 'lacuna'))
  assert.ok(actor(f, 'foreman'))
})
