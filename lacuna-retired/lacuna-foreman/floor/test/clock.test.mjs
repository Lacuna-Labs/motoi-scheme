// clock.test.mjs — THE ONE CLOCK (lane F5-BC, BC.2). Owns: the tests that logT is seconds since the window epoch, that
// float32 holds it under 0.3 ms of jitter across an hour, that a seek and the hour crossing rebase, that the live formula
// is `newest.t + elapsed − 250 ms`, that speeds clamp to ×¼ … ×8, and that alpha is a pure function of logT.
// Refuses: a wall clock (every call passes its time).
import test from 'node:test'
import assert from 'node:assert/strict'
import * as clock from '../clock.js'

const EPOCH = 1793386800000   // 2026-10-30 11:00:00 UTC, an hour boundary

// spec: master §2.2 "rebased hourly … so float32 never jitters"; A6 §2.5 · class: E · technique: sweep · method: every 0.1 s of
// an hour, |fround(logT) − logT| < 0.3 ms · sre: do two frames a minute apart see the same spacing?
test('float32 jitter stays under 0.3 ms across an hour of logT', () => {
  let worst = 0
  for (let ms = 0; ms < clock.HOUR_MS; ms += 100) {
    const logT = ms / 1000
    worst = Math.max(worst, Math.abs(Math.fround(logT) - logT) * 1000)
  }
  assert.ok(worst < 0.3, `worst jitter ${worst} ms`)
  assert.ok(worst > 0.05, `float32 is coarsest past 2,048 s (${worst} ms)`)
})

// spec: master §2.2 "rebased … on every seek"; A6 §2.5 the epoch is a function of log time · class: E · technique: seek ·
// method: seek into another hour, read epoch and logT · sre: does a replay of 14:37 compute the same epoch as live did?
test('a seek rebases to the target hour and a live tick crossing the hour rebases too', () => {
  const c = clock.createClock({ epoch: EPOCH + 1234 })
  assert.equal(c.epoch, EPOCH)
  clock.seek(c, EPOCH + 3 * clock.HOUR_MS + 2_222_000)
  assert.equal(c.epoch, EPOCH + 3 * clock.HOUR_MS)
  assert.equal(c.logT, 2222)
  assert.equal(c.mode, 'replay')
  clock.set(c, 3599.5)
  clock.advance(c, 1000)
  assert.equal(c.epoch, EPOCH + 4 * clock.HOUR_MS)
  assert.ok(Math.abs(c.logT - 0.5) < 1e-9)
  assert.equal(clock.epochOf(EPOCH + clock.HOUR_MS - 1), EPOCH)
  assert.equal(clock.toT(c, clock.toLogT(c, EPOCH + 5 * clock.HOUR_MS)), EPOCH + 5 * clock.HOUR_MS)
})

// spec: master §2.2 `logT = newest.t + elapsed − 250 ms` · class: E · technique: fake wall clock · method: newest at t,
// arrived at w, now w + 400 · sre: is the presentation delay exactly 250 ms?
test('the live formula is newest.t + elapsed − 250 ms, on the newest event\'s hour', () => {
  const c = clock.createClock({ epoch: EPOCH })
  const newestT = EPOCH + 600_000
  clock.live(c, newestT, 5000, 5400)
  assert.ok(Math.abs(c.logT - (600 + 0.4 - 0.25)) < 1e-9)
  assert.equal(c.mode, 'live')
  clock.live(c, EPOCH + clock.HOUR_MS + 10_000, 0, 0)
  assert.equal(c.epoch, EPOCH + clock.HOUR_MS)
  assert.ok(Math.abs(c.logT - 9.75) < 1e-9)
})

// spec: master §2.2 speeds ×¼ … ×8; A3 §6.2 alpha interpolates two 60 Hz states · class: E · technique: table ·
// method: clamp both ends; alpha at step boundaries and midpoints · sre: does ×16 exist? (no)
test('speed clamps to ×¼ … ×8 and alpha is the fraction of the 60 Hz step at logT', () => {
  const c = clock.createClock({ epoch: EPOCH })
  assert.equal(clock.speed(c, 16), 8)
  assert.equal(clock.speed(c, 0.1), 0.25)
  assert.equal(clock.speed(c, 'x'), 1)
  clock.speed(c, 4)
  clock.advance(c, 250)
  assert.ok(Math.abs(c.logT - 1) < 1e-9)
  assert.ok(Math.abs(clock.alpha(2 / 60) - 0) < 1e-6)
  assert.ok(Math.abs(clock.alpha(2.5 / 60) - 0.5) < 1e-6)
  assert.equal(clock.stepIndex(1), 60)
  const fr = clock.frame(c)
  assert.deepEqual(Object.keys(fr), ['logT', 'epoch', 'alpha'])
})
