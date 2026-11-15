// determinism.test.mjs — THE DETERMINISM GATE (lane F5-BC, BC.8; master §7 gate 2; A3 §8; A8 §5.1; RULINGS C-64). Owns: the
// tests that the fixture hour is itself deterministic (its SHA-256 is pasted in the report), that folding it with ticks at
// 30, 60 and 120 Hz gives identical `(state …)` texts every 5 s and at every keyframe (60 s or 2,000 events), that a
// restore from the keyframe at minute 30 and a fold forward equals the straight fold for minutes 30 to 60, and that the
// summary stays under its cap every minute. The hashes are printed for the report. Refuses: a wall clock, a mock of the fold.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createFold, fold, tick, snapshot, restore } from '../fold.js'
import { summary, MAX_CHARS } from '../summary.js'
import { hourEvents, EPOCH } from './fixtures/hour.mjs'
import { readCatalog, validate } from './fixtures/catalog.mjs'

const sha = (text) => createHash('sha256').update(text).digest('hex')
const events = hourEvents()
const SPAN_S = 3600
const KEYFRAME_S = 60
const KEYFRAME_EVENTS = 2000

/** Folds the hour with a tick every 1/hz s; returns the hash list `[[logT, sha]]` every 5 s and at every keyframe, and the texts at the keyframes. */
function run(hz, from = 0, f = createFold({ epoch: EPOCH }), startIndex = 0) {
  const hashes = []
  const keyframes = new Map()
  let i = startIndex
  let sinceKeyframe = 0
  let lastKeyframeS = from
  const steps = Math.round((SPAN_S - from) * hz)
  for (let k = 0; k <= steps; k++) {
    const s = from + k / hz
    const t = EPOCH + Math.round(s * 1000)
    const due = []
    while (i < events.length && events[i].t <= t) due.push(events[i++])
    if (due.length) { fold(f, due); sinceKeyframe += due.length }
    tick(f, s)
    const onGrid = Math.abs(s * 5 - Math.round(s * 5)) < 1e-9 && Math.round(s * 5) % 25 === 0
    const keyframe = s - lastKeyframeS >= KEYFRAME_S - 1e-9 || sinceKeyframe >= KEYFRAME_EVENTS
    if (onGrid || keyframe) {
      const text = snapshot(f, s)
      hashes.push([Math.round(s * 1000) / 1000, sha(text)])
      if (keyframe) { keyframes.set(Math.round(s * 1000) / 1000, text); lastKeyframeS = s; sinceKeyframe = 0 }
    }
  }
  return { hashes, keyframes, f, nextIndex: i }
}

// spec: A3 §9 fixtures (every kind at least once, valid against kinds.slat); COMMON §7 "a number without its command is a claim" ·
// class: J · technique: hash · method: the hour's event list is stable and valid; its sha is pasted in the report ·
// sre: is the fixture the same hour tomorrow?
test('the fixture hour is deterministic, valid against the catalog, and carries every catalog kind the floor folds', () => {
  const catalog = readCatalog()
  const kinds = new Set(events.map((e) => e.kind))
  for (const k of catalog.keys()) if (!k.startsWith('scene.') && !k.startsWith('box.up') && !k.startsWith('box.down')) assert.ok(kinds.has(k), `${k} in the hour`)
  let bad = null
  for (const e of events) { const v = validate(catalog, e); if (!v.ok) { bad = v.why; break } }
  assert.equal(bad, null)
  for (let i = 1; i < events.length; i++) assert.ok(events[i].seq === events[i - 1].seq + 1 && events[i].t >= events[i - 1].t)
  const h = sha(JSON.stringify(events))
  assert.equal(sha(JSON.stringify(hourEvents())), h, 'the same hour twice')
  process.stdout.write(`fixture hour: ${events.length} events, ${(events.length / 3600).toFixed(2)}/s, sha256 ${h}\n`)
})

// spec: master §7 gate 2; A3 §8; A8 §5.1; C-64 · class: J · technique: three cadences · method: hashes every 5 s and at every keyframe
// at 30, 60 and 120 Hz ticks are identical · sre: does the iPad at 30 fps fold another floor than the Mac at 120?
test('folding the hour at 30, 60 and 120 Hz ticks gives identical (state …) hashes every 5 s and at every keyframe', () => {
  const a = run(30)
  const b = run(60)
  const c = run(120)
  assert.equal(a.hashes.length, b.hashes.length)
  assert.equal(b.hashes.length, c.hashes.length)
  for (let i = 0; i < a.hashes.length; i++) {
    assert.equal(a.hashes[i][0], b.hashes[i][0])
    assert.equal(a.hashes[i][1], b.hashes[i][1], `at ${a.hashes[i][0]} s: 30 vs 60 Hz`)
    assert.equal(b.hashes[i][1], c.hashes[i][1], `at ${b.hashes[i][0]} s: 60 vs 120 Hz`)
  }
  const last = a.hashes[a.hashes.length - 1]
  process.stdout.write(`determinism: ${a.hashes.length} hashes; first ${a.hashes[0][1].slice(0, 16)} at ${a.hashes[0][0]} s; at 1800 s ${a.hashes.find((h) => h[0] === 1800)[1].slice(0, 16)}; last ${last[1].slice(0, 16)} at ${last[0]} s; actors ${a.f.registry.size}\n`)
})

// spec: A3 §8 "restoring a keyframe and folding forward yields the same registry"; A2 §5.3 seek · class: J · technique: restore ·
// method: the keyframe at 1800 s restored into a fresh fold, folded forward at 60 Hz; the hashes from 1800 to 3600 equal the
// straight run's · sre: does a seek show the same floor as a live watcher saw?
test('restore from the keyframe at minute 30 then fold forward equals the straight fold for minutes 30 to 60', () => {
  const straight = run(60)
  const text = straight.keyframes.get(1800)
  assert.ok(text, 'a keyframe at 1800 s')
  const f2 = restore(createFold({ epoch: 0 }), text)
  const nextIndex = events.findIndex((e) => e.seq > f2.seq)
  const resumed = run(60, 1800, f2, nextIndex)
  const after = straight.hashes.filter((h) => h[0] >= 1800)
  assert.equal(resumed.hashes.length, after.length)
  for (let i = 0; i < after.length; i++) assert.equal(resumed.hashes[i][1], after[i][1], `at ${after[i][0]} s`)
  assert.equal(snapshot(f2, 3600), snapshot(straight.f, 3600))
})

// spec: master §3.2 the fold's summary ≤ 1,200 characters of slat · class: J · technique: every minute of the hour · method: the
// summary's length and its form at 60 samples · sre: can Lacuna's turn carry the floor?
test('the summary stays under 1,200 characters every minute of the hour and names what is stuck', () => {
  const f = createFold({ epoch: EPOCH })
  let i = 0
  let worst = 0
  let stuckSeen = false
  for (let s = 0; s <= 3600; s += 60) {
    const due = []
    while (i < events.length && events[i].t <= EPOCH + s * 1000) due.push(events[i++])
    fold(f, due)
    const text = summary(f, s)
    assert.ok(text.startsWith('(summary (logt '), text.slice(0, 40))
    assert.ok(text.length <= MAX_CHARS, `${text.length} chars at ${s} s`)
    worst = Math.max(worst, text.length)
    if (/\(stuck \(\(@/.test(text)) stuckSeen = true
  }
  assert.ok(stuckSeen, 'the stalled run of minute 23 is named')
  process.stdout.write(`summary: longest ${worst} chars of ${MAX_CHARS}\n`)
})
