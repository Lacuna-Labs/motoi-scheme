// keyframe.js — THE KEYFRAME SCHEMA (lane F5-BC; A2 §5.2; A3 §8; RULINGS §1(b), C-25, C-26, C-64). Owns: the pose channel
// table (sixteen floats, the one order lane D's instance tables and the determinism hash read), the quantization to 1/4,096,
// the one mapping between kebab-case on disk and camelCase in JS, the canonical key order of a record, and the writer and
// reader of the `(state …)` form: registry records with `events` cut to the last 8, the floor block, the layout checkpoint,
// the flasher, the movers FIFO, the flood state per area, the slot tables' membership order and every actor's quantized pose.
// It writes through `writeData` and reads through `readForms` and `dataToJson` (law 5: one writer, one reader). Refuses: a
// second key spelling (every key passes `kebab()`/`camel()`), a float in a pose (poses are integers of 1/4,096 units), a
// `prev` hash (lane A's log writes the chain), an object keyed by a name in a record tail (an id or an area has hyphens, which
// the mapping would eat: tails carry lists of `{id, …}`; the `flood` and `bad` blocks pass verbatim). Implements: A2 §5.2 as C-25 widened it; A3 §8; A8 §5.1 (L1).
// Invariants (design §18): "restoring a keyframe and folding forward yields the registry a straight fold yields" (the
// text carries every integrator state and every committed classification). Faults (§16): none raised; a text that does
// not read is a thrown SlatDataError from the reader.

import { readForms, dataToJson, writeData } from '../../../lacuna-scheme/src/slat-data.js'

/** The schema version written in `(v …)`. */
export const VERSION = 1
/** Poses are quantized to 1/4,096 of a unit (C-64; A8 §5.1). */
export const Q = 4096
/** The keyframe keeps the last 8 events of a record (A3 §8); the registry keeps 32 (A3 §3.1). */
export const EVENTS_KEPT = 8

/**
 * The pose channels, in the order every `pose()` returns them and every table reads them (A6 §3.7 reads these by index):
 * x y z: world position (y is the lift above the floor) · scale · l: emissive level, 1 at rest · sat: saturation 0..1 ·
 * hue: an index into vocabulary `HUES` · edge: edge opacity 0..1 · edgeHue: an index into `HUES` · blink: the status
 * channel's lit share 0..1 at this instant · fill: a ring, band or deadline fill 0..1 · spin: radians · motion: the internal
 * motion's parameter (comet, band, float phase) 0..1 · ring: the ring radius in units, 0 when none · hollow: 0 solid, 1
 * hollow · flags: the `FLAG` bits.
 */
export const CHANNELS = Object.freeze([
  'x', 'y', 'z', 'scale', 'l', 'sat', 'hue', 'edge', 'edgeHue', 'blink', 'fill', 'spin', 'motion', 'ring', 'hollow', 'flags',
])
/** Channel name → index. */
export const CH = Object.freeze(Object.fromEntries(CHANNELS.map((n, i) => [n, i])))
/** The bits of the `flags` channel. */
export const FLAG = Object.freeze({
  drawn: 1, dashed: 2, hatched: 4, frozen: 8, flash: 16, seated: 32, mover: 64, ghost: 128, press: 256, red: 512, amber: 1024,
})

/**
 * A fresh pose: drawn, at the origin, resting level, solid, neutral.
 * @return {!Array<number>} sixteen channels
 */
export function blankPose() {
  const p = new Array(CHANNELS.length).fill(0)
  p[CH.scale] = 1
  p[CH.l] = 1
  p[CH.sat] = 1
  p[CH.edge] = 1
  p[CH.flags] = FLAG.drawn
  return p
}

/**
 * A pose quantized to 1/4,096 units: integers, the hash's domain.
 * @param {!Array<number>} pose
 * @return {!Array<number>}
 */
export const quantize = (pose) => pose.map((v) => Math.round(v * Q))

/**
 * The inverse of `quantize`.
 * @param {!Array<number>} q
 * @return {!Array<number>}
 */
export const dequantize = (q) => q.map((v) => v / Q)

/**
 * camelCase → kebab-case: `lastBeatT` → `last-beat-t`, `p99Gap` → `p99-gap`, `nCtx` → `n-ctx`.
 * @param {string} k
 * @return {string}
 */
export const kebab = (k) => { let v = KEBAB.get(k); if (v === undefined) { v = k.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase(); KEBAB.set(k, v) } return v }

/**
 * kebab-case → camelCase, the exact inverse of `kebab` on every key a record carries.
 * @param {string} k
 * @return {string}
 */
export const camel = (k) => k.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase())

/** The common head's keys in canonical order (A3 §3.1); tail keys follow, sorted. */
export const HEAD_KEYS = Object.freeze([
  'id', 'kind', 'state', 'cause', 'since', 'prev', 'ceremony', 'seenAt', 'period', 'events', 'slot', 'pos', 'vel', 'target', 'settledAt',
  'seed', 'm', 'alarms', 'changed',
])
/** Keys whose values pass to disk untouched: an event's `data` is the wire's kebab-case object; `bad` is keyed by refusal reason. */
const VERBATIM = new Set(['data', 'bad'])
const KEBAB = new Map()

/**
 * A record as it is written: kebab keys in canonical order, `events` cut to the last 8, nested objects mapped the same way.
 * @param {!Object} rec a registry record (camelCase)
 * @return {!Object}
 */
export function toDisk(rec) {
  const out = {}
  const keys = [...HEAD_KEYS.filter((k) => k in rec), ...Object.keys(rec).filter((k) => !HEAD_KEYS.includes(k)).sort()]
  for (const k of keys) {
    const v = k === 'events' ? rec.events.slice(-EVENTS_KEPT) : rec[k]
    out[kebab(k)] = diskValue(v)
  }
  return out
}

function diskValue(v) {
  if (Array.isArray(v)) return v.map(diskValue)
  if (v && typeof v === 'object') {
    const o = {}
    for (const k of Object.keys(v)) o[kebab(k)] = VERBATIM.has(k) ? v[k] : diskValue(v[k])
    return o
  }
  return v === undefined ? null : v
}

/**
 * A record as it is read: camelCase keys, the inverse of `toDisk`.
 * @param {!Object} obj
 * @return {!Object}
 */
export function fromDisk(obj) {
  return memoryValue(obj)
}

function memoryValue(v) {
  if (Array.isArray(v)) return v.map(memoryValue)
  if (v && typeof v === 'object') {
    const o = {}
    for (const k of Object.keys(v)) o[camel(k)] = VERBATIM.has(k) ? v[k] : memoryValue(v[k])
    return o
  }
  return v
}

/**
 * @typedef {Object} StateView
 * @property {number} t ms UTC of the last folded event
 * @property {number} seq the last folded seq
 * @property {number} epoch ms UTC of logT 0
 * @property {number} logT the moment the view stands at, seconds
 * @property {!Array<!Object>} actors registry records (camelCase), sorted by id
 * @property {!Object} floor the floor block: scene, bad, stale, quarantine, clients
 * @property {!Object} layout the integrator checkpoint: step, bodies [{id, x, z, vx, vz, tx, tz, settledAt}], reflow, pending
 * @property {?string} flasher the one flasher's alert id
 * @property {!Array<!Object>} movers the movers FIFO: [{id, kind, startedAt}]
 * @property {!Object} flood flood state per area: {area: {on, raises}}
 * @property {!Object} slots slot tables' membership order: {set: [ids]}
 * @property {!Map<string, !Array<number>>} poses every actor's pose at logT (unquantized)
 */

/**
 * The canonical `(state …)` text of a view (A2 §5.2 + A3 §8's blocks; poses quantized to 1/4,096). The log (lane A) wraps it
 * with `day part off prev` when it writes the day's state file; this text is the snapshot and the hash's domain.
 * @param {!StateView} view
 * @return {string} one line
 */
export function writeState(view) {
  const actors = [...view.actors].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).map(toDisk)
  const poses = {}
  for (const id of [...view.poses.keys()].sort()) poses[id] = quantize(view.poses.get(id))
  const parts = [
    `(v ${VERSION})`, `(t ${writeData(view.t)})`, `(seq ${writeData(view.seq)})`, `(epoch ${writeData(view.epoch)})`,
    `(logt ${writeData(view.logT)})`, `(actors ${writeData(actors)})`, `(floor ${writeData(diskValue(view.floor))})`,
    `(layout ${writeData(diskValue(view.layout))})`, `(flasher ${writeData(view.flasher ?? null)})`,
    `(movers ${writeData(diskValue(view.movers))})`, `(flood ${writeData(view.flood)})`,
    `(slots ${writeData(view.slots)})`, `(poses ${writeData(poses)})`,
  ]
  return `(state ${parts.join(' ')})`
}

/**
 * Reads a `(state …)` text back into a view (camelCase); unknown fields (`day`, `part`, `off`, `prev`) are kept under
 * `extra` and never refused, so lane A's wrapped keyframe restores too.
 * @param {string} text
 * @return {!StateView}
 * @throws {Error} the text is not one `(state …)` form
 */
export function readState(text) {
  const forms = readForms(text)
  const form = forms[0]
  if (forms.length !== 1 || !Array.isArray(form) || String(form[0]) !== 'state') throw new Error('not one (state …) form')
  const fields = {}
  for (const f of form.slice(1)) fields[String(f[0])] = f.length === 2 ? dataToJson(f[1]) : f.slice(1).map(dataToJson)
  const view = {
    t: fields.t, seq: fields.seq, epoch: fields.epoch, logT: fields.logt,
    actors: (fields.actors || []).map(fromDisk), floor: memoryValue(fields.floor || {}), layout: memoryValue(fields.layout || {}),
    flasher: fields.flasher ?? null, movers: memoryValue(fields.movers || []), flood: fields.flood || {},
    slots: fields.slots || {}, poses: new Map(Object.entries(fields.poses || {}).map(([id, q]) => [id, dequantize(q)])),
    extra: {},
  }
  for (const k of ['v', 'day', 'part', 'off', 'prev']) if (k in fields) view.extra[k] = fields[k]
  return view
}
