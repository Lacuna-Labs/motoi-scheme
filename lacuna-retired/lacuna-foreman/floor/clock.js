// clock.js — THE ONE CLOCK (lane F5-BC; THE-FLOOR-5.0 law 2, §2.2; A6 §2.5; RULINGS §1(b)). Owns: `logT` in seconds since a
// window epoch (`floor(t ÷ 3,600,000) × 3,600,000` ms UTC, a pure function of log time, so live and replay agree), the
// hourly rebase and the rebase on every seek (float32 never jitters past 0.3 ms inside an hour), the live formula
// `logT = newest.t + elapsed − 250 ms` (the presentation delay lets late events land before their moment is drawn), replay
// speeds ×¼ … ×8, and `alpha`, the render's interpolation weight between the last two fixed-step integrator states.
// This is the only file under floor/ that may name a wall clock, and it names it only as a default argument: every
// function takes its wall time as a parameter, so a test drives it. Refuses: advancing by frames (it advances by ms of
// wall time × speed), a pose (poses read logT, never the clock), a timer. Implements: master §2.2; A6 §2.5, §14 item 1.
// Invariants (design §18): "one clock" — nothing else under floor/ reads time. Faults (§16): none.

/** One window: an hour of ms. */
export const HOUR_MS = 3_600_000
/** The presentation delay on the live floor (master §2.2). */
export const PRESENTATION_DELAY_MS = 250
/** The replay speeds (master §2.2). */
export const SPEEDS = Object.freeze([0.25, 0.5, 1, 2, 4, 8])
/** The fixed step of every integrator (A3 §6.2, §8): 60 Hz of logT. */
export const STEP_HZ = 60
/** The fixed step in seconds. */
export const STEP_S = 1 / STEP_HZ

/**
 * The window epoch of a moment: `floor(t ÷ 3,600,000) × 3,600,000` ms UTC (A6 §2.5, ruling).
 * @param {number} tMs ms UTC
 * @return {number} ms UTC
 */
export const epochOf = (tMs) => Math.floor(tMs / HOUR_MS) * HOUR_MS

/**
 * @typedef {Object} Clock
 * @property {number} epoch ms UTC of logT 0
 * @property {number} logT seconds since the epoch
 * @property {number} speed replay speed, 0.25 … 8
 * @property {string} mode `live` | `replay`
 */

/**
 * A clock at logT 0 of `epoch`.
 * @param {{epoch: number}} o `epoch` ms UTC, any moment: it is floored to its hour
 * @return {!Clock}
 */
export function createClock({ epoch }) {
  return { epoch: epochOf(epoch), logT: 0, speed: 1, mode: 'live' }
}

/**
 * Sets logT in seconds (the scrubber).
 * @param {!Clock} c @param {number} logT
 */
export function set(c, logT) {
  c.logT = logT
  rebaseIfCrossed(c)
}

/**
 * Advances by `ms` of wall time at the clock's speed; crossing the hour rebases.
 * @param {!Clock} c @param {number} ms
 */
export function advance(c, ms) {
  c.logT += (ms * c.speed) / 1000
  rebaseIfCrossed(c)
}

/**
 * The clock's logT in seconds.
 * @param {!Clock} c
 * @return {number}
 */
export const logT = (c) => c.logT

/**
 * Rebases the clock on a new epoch, keeping the absolute moment (master §2.2: hourly and on every seek).
 * @param {!Clock} c @param {number} epoch ms UTC
 */
export function rebase(c, epoch) {
  const abs = c.epoch + c.logT * 1000
  c.epoch = epochOf(epoch)
  c.logT = (abs - c.epoch) / 1000
}

/**
 * Seeks to an absolute moment: the epoch becomes that moment's hour and the mode replay.
 * @param {!Clock} c @param {number} tMs ms UTC
 */
export function seek(c, tMs) {
  c.epoch = epochOf(tMs)
  c.logT = (tMs - c.epoch) / 1000
  c.mode = 'replay'
}

/**
 * The live formula: `logT = newest.t + elapsed − 250 ms`, `elapsed` the wall time since the newest event arrived.
 * @param {!Clock} c
 * @param {number} newestT the newest event's `t`, ms UTC
 * @param {number} arrivedAt the wall time it arrived, ms
 * @param {number=} now the wall time, ms (a test passes it; the browser's loop passes its frame time)
 */
export function live(c, newestT, arrivedAt, now = Date.now()) {
  const abs = newestT + (now - arrivedAt) - PRESENTATION_DELAY_MS
  const e = epochOf(abs)
  if (e !== c.epoch) c.epoch = e
  c.logT = (abs - c.epoch) / 1000
  c.mode = 'live'
}

/**
 * Sets the replay speed, clamped to ×¼ … ×8.
 * @param {!Clock} c @param {number} x
 * @return {number} the speed set
 */
export function speed(c, x) {
  c.speed = Math.min(SPEEDS[SPEEDS.length - 1], Math.max(SPEEDS[0], Number(x) || 1))
  return c.speed
}

/**
 * The render interpolation weight between the last two integrator states at `logT`: the fraction of the current 60 Hz step
 * elapsed (A3 §6.2; master §2.2). A pure function of logT, so every frame rate reads the same picture at the same moment.
 * @param {number} logTs seconds
 * @return {number} in [0, 1)
 */
export const alpha = (logTs) => {
  const k = logTs * STEP_HZ
  return k - Math.floor(k)
}

/**
 * The index of the last integrator step at or before `logT`.
 * @param {number} logTs seconds
 * @return {number}
 */
export const stepIndex = (logTs) => Math.floor(logTs * STEP_HZ + 1e-9)

/**
 * A moment's logT on this clock.
 * @param {!Clock} c @param {number} tMs ms UTC
 * @return {number} seconds
 */
export const toLogT = (c, tMs) => (tMs - c.epoch) / 1000

/**
 * A logT's absolute moment on this clock.
 * @param {!Clock} c @param {number} logTs seconds
 * @return {number} ms UTC
 */
export const toT = (c, logTs) => c.epoch + logTs * 1000

/**
 * What the renderer reads each frame (A6 §2.5, §12.3).
 * @param {!Clock} c
 * @return {{logT: number, epoch: number, alpha: number}}
 */
export const frame = (c) => ({ logT: c.logT, epoch: c.epoch, alpha: alpha(c.logT) })

function rebaseIfCrossed(c) {
  if (c.logT >= HOUR_MS / 1000 || c.logT < 0) rebase(c, c.epoch + c.logT * 1000)
}
