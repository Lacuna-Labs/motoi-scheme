// actors/landmark.js — THE LANDMARKS (lane F5-BC; THE-FLOOR-5.0 §3.7; A3 §4.9, §5.5; A4 §2.9; A5 §2.36; RULINGS C-14, Q-A16,
// Q-D2). Owns: five records in one module, one table each: the library (reads → pages flying; down with its service), the
// web globe (drawn only while something reads it), the cortex prism (its op rate as heat against the day's own peak, `unknown`
// until the cortex-ops line lands), the forge (a slow furnace: step, loss, banked when paused), the desk (the owner's
// hexagon, breathing with the mark's level); their states, transitions to A3 §5.5's ids and poses. Refuses: a landmark that
// moves, a forge progress read from step text, a web globe with nothing reading it, a heat with no printed scale.
// Implements: A3 §4.9, §5.5. Invariants (design §18): "a landmark never moves"; "the web is drawn only while something reads
// it". Faults (§16): none.

import { blankPose, CH, FLAG } from '../keyframe.js'
import { enter, exit, rc, clamp01 } from '../curves.js'
import { HUE, ceremonyOf } from '../vocabulary.js'

export const KIND = 'landmark'
export const PERIOD_S = 10
export const STATES = Object.freeze(['shelved', 'read', 'down', 'absent', 'cold', 'warm', 'recall', 'training', 'paused', 'rest', 'listening', 'thinking', 'speaking', 'asking'])
/** Which states belong to which landmark (A3 §4.9). */
export const STATES_OF = Object.freeze({ library: ['shelved', 'read', 'down'], web: ['absent', 'read'], cortex: ['cold', 'warm', 'recall'], forge: ['cold', 'training', 'paused'], desk: ['rest', 'listening', 'thinking', 'speaking', 'asking'] })
export const LIGHTS = Object.freeze({ shelf: ['dark', 'lit'], pips: ['dark', 'lit'] })
export const COUNTERS = Object.freeze(['reads', 'opsPer10s', 'opsMax', 'recallHits', 'step', 'total', 'loss', 'level'])
export const REACTS = Object.freeze(['mind.read', 'owner.read', 'cortex.ops', 'cortex.recall', 'forge.step', 'forge.pause', 'forge.resume', 'forge.trained', 'service.down', 'service.up', 'owner.present', 'mind.turn.start', 'mind.turn.phase', 'mind.turn.done', 'mind.turn.fail'])
/** States a tick never leaves without an event (actors/index.js skips them on a tick). */
export const FINAL = new Set(['shelved', 'absent'])
export const TRANSITIONS = Object.freeze([
  ['*', 'read', 'library.read'], ['*', 'shelved', 'library.shelve'], ['*', 'down', 'library.down'], ['*', 'absent', 'web.fade'],
  ['*', 'warm', 'cortex.heat'], ['*', 'recall', 'cortex.recall'], ['*', 'training', 'forge.light'], ['*', 'paused', 'forge.bank'], ['*', 'cold', 'cortex.cool'],
  ['*', 'rest', 'desk.mark'], ['*', 'listening', 'desk.mark'], ['*', 'thinking', 'desk.mark'], ['*', 'speaking', 'desk.mark'], ['*', 'asking', 'desk.mark'],
])

/** @return {!Object} the tail (A3 §3.2 landmark row, per landmark) */
export function create(id, logT, ev) {
  const t = { which: id, reads: 0 }
  if (id === 'library') Object.assign(t, { readers: [], last: null, readT: null, down: false, downT: null })
  if (id === 'web') Object.assign(t, { readers: [], readT: null, last: null })
  if (id === 'cortex') Object.assign(t, { opsPer10s: null, opsMax: 0, opsT: null, recallHits: 0, recallT: null, recalls: 0 })
  if (id === 'forge') Object.assign(t, { step: 0, total: 0, loss: null, loss0: null, paused: false, model: null, stepT: null, pauseT: null, resumeT: null, trained: [] })
  if (id === 'desk') Object.assign(t, { markState: 'rest', level: 0, turn: null, presentT: null })
  return t
}

/** Folds one event into the tail (A2 §3.8's Fold column; C-14 `mind.read`). */
export function apply(rec, ev, ctx) {
  const t = ctx.logT
  const d = ev.data ?? {}
  const k = ev.kind
  if (rec.which === 'library' || rec.which === 'web') {
    if (k === 'mind.read') { rec.reads++; rec.readT = t; rec.last = { who: ev.actor, what: d.what ?? null, at: t, ms: d.ms ?? null }; if (!rec.readers.includes(ev.actor)) rec.readers.push(ev.actor); rec.readers = rec.readers.slice(-8) }
    if (k === 'owner.read' && rec.which === 'library') { rec.reads++; rec.readT = t; rec.last = { who: 'owner', what: d.what ?? null, at: t, ms: null } }   // a page of the built library
    if (rec.which === 'library' && k === 'service.down' && ev.actor === 'library') { rec.down = true; rec.downT = t }
    if (rec.which === 'library' && k === 'service.up' && ev.actor === 'library') rec.down = false
  } else if (rec.which === 'cortex') {
    if (k === 'cortex.ops') { rec.opsPer10s = d.n ?? 0; rec.opsMax = Math.max(rec.opsMax, rec.opsPer10s); rec.opsT = t }
    if (k === 'cortex.recall') { rec.recalls++; rec.recallHits = d.hits ?? 0; rec.recallT = t; rec.recallBy = d.by ?? null }
    if (k === 'mind.read') { rec.reads++; rec.recallT = t; rec.recallBy = ev.actor }
  } else if (rec.which === 'forge') {
    if (k === 'forge.step') { rec.step = d.n ?? rec.step; rec.total = d.total ?? rec.total; rec.loss = d.loss ?? rec.loss; rec.loss0 ??= rec.loss; rec.model = d.model ?? rec.model; rec.stepT = t; rec.paused = false }
    if (k === 'forge.pause') { rec.paused = true; rec.pauseT = t; rec.parked = d.park === true }
    if (k === 'forge.resume') { rec.paused = false; rec.resumeT = t }
    if (k === 'forge.trained') rec.trained = rec.trained.concat({ name: d.name ?? null, mb: d.mb ?? null, at: t }).slice(-12)
  } else if (rec.which === 'desk') {
    if (k === 'owner.present') rec.presentT = t
    if (k === 'mind.turn.start' && d.who === 'owner') rec.turn = { mind: ev.actor, since: t, phase: 'read' }
    if (k === 'mind.turn.phase' && rec.turn && rec.turn.mind === ev.actor) rec.turn.phase = d.phase ?? rec.turn.phase
    if ((k === 'mind.turn.done' || k === 'mind.turn.fail') && rec.turn && rec.turn.mind === ev.actor) rec.turn = null
  }
}

/** The state at `logT` (A3 §4.9, one table per landmark). */
export function classify(rec, logT, registry) {
  const w = rec.which
  if (w === 'library') {
    if (rec.down) return { state: 'down', cause: 'library down', since: rec.downT }
    if (rec.readT != null && logT - rec.readT < 60) return { state: 'read', cause: `${rec.last?.who ?? ''} reads ${rec.last?.what ?? ''}`.trim(), since: rec.readT }
    return { state: 'shelved', cause: null, since: rec.readT != null ? rec.readT + 60 : 0 }
  }
  if (w === 'web') {
    if (rec.readT != null && logT - rec.readT < 60 + 1.2) return { state: 'read', cause: `${rec.last?.who ?? ''} reads ${rec.last?.what ?? ''}`.trim(), since: rec.state === 'read' ? rec.since : rec.readT }
    return { state: 'absent', cause: null, since: rec.readT != null ? rec.readT + 61.2 : 0 }
  }
  if (w === 'cortex') {
    if (rec.recallT != null && logT - rec.recallT < 0.4) return { state: 'recall', cause: `${rec.recallHits} hits`, since: rec.recallT }
    if (rec.opsT != null && rec.opsPer10s > 0 && logT - rec.opsT < 30) return { state: 'warm', cause: `${rec.opsPer10s} ops/10 s`, since: rec.state === 'warm' ? rec.since : rec.opsT }
    return { state: 'cold', cause: rec.opsT == null ? 'unknown: no cortex-ops line yet' : null, since: rec.opsT != null ? rec.opsT + 30 : 0 }
  }
  if (w === 'forge') {
    if (rec.paused) return { state: 'paused', cause: rec.parked ? 'parked · banked' : 'banked', since: rec.pauseT }
    if (rec.stepT != null && logT - rec.stepT < 600) return { state: 'training', cause: `step ${rec.step}/${rec.total} · loss ${rec.loss}`, since: rec.state === 'training' ? rec.since : rec.resumeT != null && rec.resumeT > (rec.pauseT ?? -1) ? rec.resumeT : rec.stepT }
    return { state: 'cold', cause: null, since: rec.stepT != null ? rec.stepT + 600 : 0 }
  }
  const tphase = rec.turn?.phase
  const st = !rec.turn ? 'rest' : tphase === 'answer' ? 'speaking' : tphase === 'think' || tphase === 'call' ? 'thinking' : tphase === 'wait' ? 'asking' : 'listening'
  rec.markState = st
  rec.level = st === 'rest' ? 0 : st === 'speaking' ? 1 : 0.6
  return { state: st, cause: null, since: rec.state === st ? rec.since : rec.turn?.since ?? logT }
}

/** The ceremony of a transition (A3 §5.5). */
export const transitions = (from, to) => ceremonyOf(TRANSITIONS, from, to)

/** The pose at `logT` (A3 §4.9): `fill` is a heat or a step share, `l` the furnace or the hexagon's breath. */
export function pose(rec, logT) {
  const p = blankPose()
  const st = rec.state ?? 'rest'
  const dt = Math.max(0, logT - (rec.since ?? logT))
  p[CH.x] = rec.pos.x
  p[CH.z] = rec.pos.z
  p[CH.edgeHue] = HUE['N-STEEL']
  p[CH.hue] = HUE['N-ICE']
  switch (rec.which) {
    case 'library':
      p[CH.y] = 6
      p[CH.l] = st === 'read' ? 1 : 0.35
      if (st === 'read') { p[CH.hue] = HUE['N-STAR']; p[CH.fill] = 1 - clamp01(dt / 0.4) }
      if (st === 'down') { p[CH.edgeHue] = HUE.RED; p[CH.flags] |= FLAG.red | FLAG.dashed; p[CH.l] = 0.3 }
      break
    case 'web':
      p[CH.y] = 30
      p[CH.scale] = 6
      if (st === 'absent') { p[CH.flags] &= ~FLAG.drawn; p[CH.l] = 0 }
      else { const since = rec.readT - (rec.state === 'read' ? rec.readT - rec.since : 0); p[CH.l] = enter(clamp01((logT - since) / 0.7)) * (1 - exit(clamp01((logT - rec.readT - 60) / 1.2))); p[CH.scale] = 6 * (0.92 + 0.08 * enter(clamp01((logT - since) / 0.7))) }
      break
    case 'cortex':
      p[CH.y] = 4
      p[CH.l] = rec.opsT == null ? 0.3 : 0.3 + 0.7 * clamp01(rec.opsMax > 0 ? Math.log2(1 + (rec.opsPer10s ?? 0)) / Math.log2(1 + rec.opsMax) : 0)
      p[CH.fill] = rec.opsMax > 0 ? clamp01((rec.opsPer10s ?? 0) / rec.opsMax) : 0
      if (st === 'recall') p[CH.blink] = 1 - dt / 0.4
      if (rec.opsT == null) p[CH.flags] |= FLAG.dashed
      break
    case 'forge':
      p[CH.y] = 8
      p[CH.fill] = rec.total > 0 ? clamp01(rec.step / rec.total) : 0
      p[CH.hue] = HUE['N-STAR']
      p[CH.l] = st === 'training' ? 0.5 + 0.5 * rc(dt / 8) : st === 'paused' ? 0.4 : 0.2
      p[CH.motion] = rec.loss0 && rec.loss != null ? clamp01(1 - rec.loss / rec.loss0) : 0
      break
    default:
      p[CH.y] = 0
      p[CH.scale] = 6
      p[CH.l] = 0.6 + 0.4 * rec.level
      if (st !== 'rest') { p[CH.edgeHue] = HUE.LAV; p[CH.blink] = 0.6 + 0.4 * rc(0.25 * dt) }
      break
  }
  return p
}
