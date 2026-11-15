// contract.test.mjs — THE DAY-1 CONTRACT (lane F5-BC, BC.1). Owns: the tests that the frozen surface of RULINGS §1(b) and
// REVIEW §5b loads with its exact names, that the record kind table and every actor module's contract data stand, that
// the keyframe schema round-trips through the one writer and reader, and that the vocabulary row type carries the five
// fields RULINGS §1(c) adds. Refuses: a mock of the fold.
import test from 'node:test'
import assert from 'node:assert/strict'
import * as floor from '../index.js'
import * as foldMod from '../fold.js'
import * as kf from '../keyframe.js'
import { KINDS, MODULES, KINDS_REACTED } from '../actors/index.js'
import { row, form, step } from '../vocabulary.js'

// spec: RULINGS §1(b); REVIEW §5b · class: J · technique: surface check · method: import and name every export ·
// sre: can lane D and lane H build on these names today?
test('the fold surface has the frozen names of RULINGS §1(b)', () => {
  for (const name of ['createFold', 'fold', 'registry', 'actor', 'pose', 'snapshot', 'restore', 'keyframe', 'KINDS_REACTED']) {
    assert.ok(name in foldMod, `fold.js exports ${name}`)
    assert.ok(name in floor, `index.js re-exports ${name}`)
  }
  assert.ok(foldMod.KINDS_REACTED instanceof Set && foldMod.KINDS_REACTED.size > 60)
  for (const name of ['createClock', 'set', 'advance', 'logT', 'rebase', 'seek', 'live', 'speed', 'alpha']) assert.equal(typeof floor.clock[name], 'function')
})

// spec: RULINGS §1(b) the record kind table · class: J · technique: table check · method: compare the sixteen kinds and each
// module's contract exports · sre: does every kind have a statechart module with its data?
test('the record kind table is the sixteen of RULINGS §1(b) and every module carries STATES LIGHTS COUNTERS REACTS', () => {
  assert.deepEqual([...KINDS], ['mind', 'foreman', 'worker', 'ring', 'sentry', 'pad', 'lacuna', 'service', 'landmark', 'giant', 'visitor', 'stream', 'alert', 'owner', 'wo', 'box'])
  for (const kind of KINDS) {
    const m = MODULES[kind]
    assert.equal(m.KIND, kind)
    assert.ok(Array.isArray(m.STATES) && m.STATES.length > 0, `${kind} STATES`)
    assert.equal(typeof m.LIGHTS, 'object')
    assert.ok(Array.isArray(m.COUNTERS))
    assert.ok(Array.isArray(m.REACTS))
    assert.ok(m.PERIOD_S > 0)
    for (const fn of ['create', 'apply', 'classify', 'transitions', 'pose']) assert.equal(typeof m[fn], 'function', `${kind}.${fn}`)
  }
  for (const k of ['mind.slot', 'run.claim', 'run.pause', 'mind.read', 'box.up', 'scene.begin', 'floor.stale']) assert.ok(KINDS_REACTED.has(k), k)
})

// spec: A2 §5.2 + A3 §8 (C-25); C-26 kebab on disk, camel in JS; C-64 poses quantized · class: J · technique: round trip ·
// method: a view through writeState and readState · sre: does a seek read what a keyframe wrote?
test('the keyframe schema round-trips a view through the one writer and the one reader', () => {
  const f = floor.createFold({ epoch: 1793388000000 + 1234 })
  assert.equal(f.epoch, 1793386800000)
  const text = floor.snapshot(f, 12.5)
  assert.ok(text.startsWith('(state (v 1) '))
  assert.ok(text.includes('(poses (@ '))
  const v = kf.readState(text)
  assert.equal(v.logT, 12.5)
  assert.ok(v.actors.some((a) => a.id === 'lacuna' && a.kind === 'lacuna'))
  assert.ok(v.poses.get('lacuna').length === kf.CHANNELS.length)
  const f2 = floor.restore(floor.createFold({ epoch: 0 }), text)
  assert.equal(floor.snapshot(f2, 12.5), text)
  for (const k of ['lastBeatT', 'p99Gap', 'nCtx', 'rssMb', 'warmMs', 'tps', 'checkedBy', 'x']) assert.equal(kf.camel(kf.kebab(k)), k)
  assert.deepEqual(kf.quantize([0.5, -1, 1 / 4096, 0.00001]), [2048, -4096, 1, 0])
})

// spec: RULINGS §1(c) · class: J · technique: shape check · method: build one row and read the five new fields ·
// sre: can lane F's cards and lane D read the ceremony, sound, camera and label of a row?
test('the vocabulary row type carries A4 §6.1 plus ceremonyIn ceremonyOut sound degraded camera label chip strip', () => {
  const r = row('V-048', 'worker', 'stalled', null, { kinds: ['run.stall', 'run.step'], fields: ['n'], rule: 'no run.step for max(10 s, 3 × p99 gap)', on: 10000, off: 2000 },
    [form('ring', 'arc', 'AMBER', 'fills the remaining deadline', { blinkHz: 0.5, blinkClass: 'attention', curve: 'LIN', status: true })],
    [step(0, 'body', 'freeze'), step(0, 'body', 'jolt', 60), step(120, 'body', 'jolt', 60), step(180, 'ring', 'fill', 'real', 'deadline')],
    { tokens: ['T', 'ATT'], click: ['run', 'steps', 'run.stall'], ceremonyIn: 'run.stall', ceremonyOut: 'run.stall.end', sound: 'warn', degraded: 'D1', camera: { priority: 2, dwellMs: 6000 }, label: 'no step for {age}', chip: '{run} stalled at step {n}', strip: 'stall' })
  for (const k of ['id', 'actor', 'state', 'cause', 'record', 'forms', 'timeline', 'tokens', 'movers', 'flashers', 'overshoot', 'bouncePct', 'squashPct', 'exitRatio', 'fixedMs', 'massScaled', 'click', 'reducedMotion', 'lite', 'source', 'ceremonyIn', 'ceremonyOut', 'sound', 'degraded', 'camera', 'label', 'chip', 'strip']) assert.ok(k in r, k)
  assert.equal(r.fixedMs, 180)
  assert.equal(r.flashers, 1)
  assert.deepEqual(r.click, { card: 'run', tab: 'steps', record: 'run.stall' })
})
