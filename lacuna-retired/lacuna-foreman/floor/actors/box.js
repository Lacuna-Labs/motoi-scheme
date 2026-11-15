// actors/box.js — THE BOX (lane F5-BC; THE-FLOOR-5.0 §2.1 `box`; A2 §3.8; A5 §2.35; RULINGS §1(b) C-26 adds `box` to the record
// table, §1(a) adds `box.disk`, `box.lease`). Owns: the box's record tail (the coast level and free share, the memory gauge's
// blocks of 256 MiB, the disk's free gigabytes against the 5 % line, the GPU lease), its four states (clear · busy · tight ·
// unknown: unknown while a feed of it is stale, with no coast record in 3 × 60 s, or when the hands are down and the coast says
// so), its ceremonies and a pose that carries the gauge's numbers (the box has no body on the floor; the gauge and the cards
// read the record). Refuses: a constant block count (R2 §BLUF: the gauge was 29 blocks for a week), a guessed level.
// Implements: A2 §3.8. Invariants (design §18): "no constant printed as a number". Faults (§16): none.

import { blankPose, CH, FLAG } from '../keyframe.js'
import { clamp01 } from '../curves.js'
import { HUE, ceremonyOf } from '../vocabulary.js'

export const KIND = 'box'
/** `box.coast` lands at least every 60 s (A2 §3.8). */
export const PERIOD_S = 60
export const STATES = Object.freeze(['clear', 'busy', 'tight', 'unknown'])
export const LIGHTS = Object.freeze({ gauge: ['clear', 'busy', 'tight', 'unknown'], disk: ['ok', 'low'] })
export const COUNTERS = Object.freeze(['freePct', 'availMb', 'wiredMb', 'blocks', 'freeGb'])
export const REACTS = Object.freeze(['box.coast', 'box.memory', 'box.disk', 'box.lease'])
export const TRANSITIONS = Object.freeze([['*', 'tight', 'box.coast'], ['*', 'busy', 'box.coast'], ['*', 'clear', 'box.coast'], ['*', 'unknown', 'box.coast']])
/** One block (the owner's contract). */
export const BLOCK_MB = 256
/** The disk line (CLAUDE.md: 5 %). */
export const DISK_LINE_PCT = 5

/** @return {!Object} the tail (A2 §5.2 box row) */
export function create(id, logT, ev) {
  return { level: 'unknown', freePct: null, wiredMb: null, availMb: null, othersCpu: null, othersGb: null, coastT: null, lowSince: null, blocks: null, disk: { freeGb: null, pct: null, at: null }, lease: null }
}

/** Folds one event into the tail (A2 §3.8's Fold column). */
export function apply(rec, ev, ctx) {
  const t = ctx.logT
  const d = {}
  for (const [k, v] of Object.entries(ev.data ?? {})) d[k] = typeof v === 'number' && !Number.isFinite(v) ? null : typeof v === 'string' && k !== 'level' && k !== 'holder' ? null : v
  switch (ev.kind) {
    case 'box.coast':
      Object.assign(rec, { level: ['clear', 'busy', 'tight', 'unknown'].includes(d.level) ? d.level : 'unknown', freePct: d['free-pct'] ?? rec.freePct, wiredMb: d['wired-mb'] ?? rec.wiredMb, availMb: d['avail-mb'] ?? rec.availMb, othersCpu: d['others-cpu'] ?? rec.othersCpu, othersGb: d['others-gb'] ?? rec.othersGb, coastT: t })
      break
    case 'box.memory': Object.assign(rec, { availMb: d['avail-mb'] ?? rec.availMb, wiredMb: d['wired-mb'] ?? rec.wiredMb, freePct: d['free-pct'] ?? rec.freePct, lowSince: d['low-since'] ?? null, coastT: t }); break
    case 'box.disk': rec.disk = { freeGb: d['free-gb'] ?? null, pct: d.pct ?? null, at: t }; break
    case 'box.lease': rec.lease = { holder: d.holder ?? null, leftS: d['left-s'] ?? null, at: t }; break
    default: break
  }
  rec.blocks = rec.wiredMb != null ? Math.ceil(rec.wiredMb / BLOCK_MB) : null
}

/** The state at `logT`: the coast level; unknown when a feed of it is stale (A2 §4.6, §10.6) or the record is late (§3.8). */
export function classify(rec, logT) {
  if (rec.stale != null) return { state: 'unknown', cause: `stale-feed ${Math.round(logT - rec.stale)} s`, since: rec.stale }
  if (rec.coastT == null) return { state: 'unknown', cause: 'no coast record', since: 0 }
  if (logT - rec.coastT > 3 * PERIOD_S) return { state: 'unknown', cause: `coast silent ${Math.round(logT - rec.coastT)} s`, since: rec.coastT + 3 * PERIOD_S }
  return { state: rec.level, cause: rec.freePct != null ? `${rec.freePct} % free` : null, since: rec.state === rec.level ? rec.since : rec.coastT }
}

/** The ceremony of a transition. */
export const transitions = (from, to) => ceremonyOf(TRANSITIONS, from, to)

/** The pose at `logT`: not drawn as a body; `fill` carries the free share, `motion` the disk's free share, `flags` the lines. */
export function pose(rec, logT) {
  const p = blankPose()
  p[CH.flags] &= ~FLAG.drawn
  p[CH.fill] = rec.freePct != null ? clamp01(rec.freePct / 100) : 0
  p[CH.motion] = rec.disk.pct != null ? clamp01(rec.disk.pct / 100) : 0
  p[CH.hue] = rec.state === 'tight' ? HUE.AMBER : HUE.NONE
  if (rec.state === 'tight') p[CH.flags] |= FLAG.amber
  if (rec.disk.pct != null && rec.disk.pct < DISK_LINE_PCT) p[CH.flags] |= FLAG.red
  if (rec.state === 'unknown') p[CH.flags] |= FLAG.dashed
  return p
}
