// actors/sentry.js — THE SENTRIES (lane F5-BC; THE-FLOOR-5.0 §3.6; A3 §4.5, §5.4; A4 §2.6; A5 §2.23; RULINGS M-15, M-34, C-15,
// C-33, C-73, Q-A33). Owns: a sentry's record tail (model, run, the three lights as the three checks provenance · AST ·
// semantics, the last check, the recorded period, the verdict rows ≤ 24, shadow), its eight states with A3 §4.5's delays
// (a sweep only per recorded `sentry.check`; a note, warn, would-stop or kick verdict is a warn that lingers 10 s (A3 §4.5's
// table); a stop is a fail until the ack; dashed after 3 missed checks of the
// recorded period, 30 s until one is recorded), its transitions to A3 §5.4's ids, and the pose (a cube 1.2 or 2.15 by
// model, the cyan droplet from Lacuna's cube, the 80 ms self-test, the 400 ms scan band, lights by check state, dashed when
// a check is missed, lights out in reverse on detach). Refuses: a hologram, a bob, a wander, a sweep on a timer, a light
// changed by anything but a verdict row, a stop (warn-only in 1.0: the floor reads). Implements: A3 §4.5, §5.4.
// Invariants (design §18): "no sweep without a sentry.check"; "a sentry arrives from the cube, never from nowhere".
// Faults (§16): none.

import { blankPose, CH, FLAG } from '../keyframe.js'
import { enter, glide, blink, clamp01 } from '../curves.js'
import { HUE, ceremonyOf } from '../vocabulary.js'

export const KIND = 'sentry'
/** The stand-in check period until `period-s` is recorded (A3 §4.5; Q-A33). */
export const PERIOD_S = 30
export const STATES = Object.freeze(['arriving', 'attached', 'scanning', 'warn', 'fail', 'missed-check', 'detached', 'unknown'])
/** The three lights are the three checks (R2; M-34). */
export const LIGHTS = Object.freeze({ prov: ['clean', 'warn', 'fail', 'unknown'], ast: ['clean', 'warn', 'fail', 'unknown'], sem: ['clean', 'warn', 'fail', 'unknown'] })
export const COUNTERS = Object.freeze(['note', 'warn', 'wouldStop', 'kick', 'stop', 'checks'])
export const REACTS = Object.freeze(['sentry.attach', 'sentry.check', 'sentry.verdict', 'sentry.warn', 'sentry.detach', 'run.pass', 'run.fail', 'run.stop', 'run.crash'])
/** A run's ends: its sentry leaves with it (A2 fix 6: two 1B sentries said "no check for 418,270 s" on runs ended days before). */
const RUN_ENDS = new Set(['run.pass', 'run.fail', 'run.stop', 'run.crash'])
/** States a tick never leaves without an event (actors/index.js skips them on a tick). */
export const FINAL = new Set(['detached'])
export const TRANSITIONS = Object.freeze([
  ['(none)', 'arriving', 'sentry.attach'], ['arriving', 'attached', 'sentry.seated'], ['*', 'unknown', 'sentry.stale'], ['unknown', '*', 'sentry.fresh'],
  ['*', 'scanning', 'sentry.scan'], ['*', 'warn', 'sentry.warn'], ['warn', '*', 'sentry.warn.end'], ['*', 'fail', 'sentry.fail'], ['fail', '*', 'sentry.fail.end'],
  ['*', 'missed-check', 'sentry.missed'], ['missed-check', '*', 'sentry.scan'], ['*', 'detached', 'sentry.detach'], ['*', 'attached', 'sentry.seated'],
])
/** The cube's side by model (floorProcs.js:244, kept). */
export const SIDE = Object.freeze({ '270m': 1.2, '1b': 2.15, cart: 1.2, work: 1.2 })
const VERDICTS_KEPT = 24
const ARRIVE_S = 0.5 + 3 * 0.08 + 0.12

/**
 * The check a verdict names → the light (provenance · AST · semantics; the cart sentry's progress, claim, loop, scope and
 * end checks are semantics).
 * @param {?string} check
 * @return {string} prov | ast | sem
 */
export const lightOf = (check) => (/^prov/.test(String(check)) ? 'prov' : /^ast|syntax/.test(String(check)) ? 'ast' : 'sem')

/** @return {!Object} the tail (A3 §3.2 sentry row) */
export function create(id, logT, ev) {
  const m = id.match(/^sentry-([^:]+):(.*)$/)
  return {
    model: m?.[1] ?? '270m', runId: m?.[2] ?? null, attachedT: null, checkPeriod: PERIOD_S, lastCheckT: null, shadow: true, missed: false,
    lights: { prov: light(), ast: light(), sem: light() }, verdicts: [], checks: 0, note: 0, warn: 0, wouldStop: 0, kick: 0, stop: 0,
    detachT: null, detachWhy: null, ackT: null, side: SIDE[m?.[1]] ?? 1.2,
  }
}

const light = () => ({ state: 'unknown', since: null, lastT: null, warnLastT: null, failT: null })

/** Folds one event into the tail (A2 §3.3's Fold column). */
export function apply(rec, ev, ctx) {
  const t = ctx.logT
  const d = ev.data ?? {}
  switch (ev.kind) {
    case 'sentry.attach':
      rec.attachedT = t
      rec.model = d.model ?? rec.model
      rec.side = SIDE[rec.model] ?? rec.side
      rec.runId = d.run ?? rec.runId
      rec.shadow = d.mode !== 'live'
      if (d['period-s'] > 0) rec.checkPeriod = d['period-s']
      rec.detachT = null
      { const run = ctx.registry.get(rec.runId); if (run && run.kind === 'worker') { run.sentry = rec.id; run.watched = true } }
      break
    case 'sentry.check': {
      rec.lastCheckT = t
      rec.checks++
      const L = rec.lights[lightOf(d.kind)]
      L.lastT = t
      if (L.state === 'unknown') { L.state = 'clean'; L.since = t }
      break
    }
    case 'sentry.verdict':
    case 'sentry.warn': {
      const action = ev.kind === 'sentry.warn' ? 'warn' : d.action ?? 'note'
      const L = rec.lights[lightOf(d.check)]
      rec.verdicts.push({ check: d.check ?? null, action, detail: d.detail ?? null, at: t })
      if (rec.verdicts.length > VERDICTS_KEPT) rec.verdicts.shift()
      if (action === 'note') rec.note++
      else if (action === 'warn') rec.warn++
      else if (action === 'would-stop') rec.wouldStop++
      else if (action === 'kick') rec.kick++
      else if (action === 'stop') rec.stop++
      if (action === 'stop') { L.state = 'fail'; L.since = t; L.failT = t }
      else if (L.state !== 'fail') { if (L.state !== 'warn') { L.state = 'warn'; L.since = t } L.warnLastT = t }
      L.lastT = t
      rec.lastDetail = d.detail ?? null
      rec.lastCheck = d.check ?? null
      break
    }
    case 'sentry.detach': rec.detachT = t; rec.detachWhy = d.why ?? 'detached'; break
    case 'run.pass': case 'run.fail': case 'run.stop': case 'run.crash':
      if (RUN_ENDS.has(ev.kind) && ev.actor === rec.runId && rec.detachT == null) { rec.detachT = t; rec.detachWhy = `the run ended (${ev.kind.slice(4)})` }
      break
    default: break
  }
}

/** The lights settled at `logT`: a warn clears 10 s after its last row; a fail clears 2 s after the ack. */
function lightsAt(rec, logT) {
  const out = {}
  for (const k of ['prov', 'ast', 'sem']) {
    const L = rec.lights[k]
    let s = L.state
    if (s === 'fail' && rec.ackT != null && logT >= rec.ackT + 2) s = 'clean'
    if (s === 'warn' && L.warnLastT != null && logT - L.warnLastT >= 10) s = 'clean'
    out[k] = s
  }
  return out
}

/** The state at `logT` (A3 §4.5). */
export function classify(rec, logT, registry) {
  if (rec.detachT != null) return { state: 'detached', cause: rec.detachWhy, since: rec.detachT }
  if (rec.stale != null) return { state: 'unknown', cause: `stale-feed ${Math.round(logT - rec.stale)} s`, since: rec.stale }
  const foreman = registry?.get('foreman')
  const lac = registry?.get('lacuna')
  if ((foreman && foreman.state === 'stale') || (lac && lac.state === 'stale')) return { state: 'unknown', cause: 'stale', since: foreman?.state === 'stale' ? foreman.since : lac.since }
  if (rec.attachedT == null) return { state: 'arriving', cause: null, since: logT }
  if (logT < rec.attachedT + ARRIVE_S) return { state: 'arriving', cause: null, since: rec.attachedT }
  const lights = lightsAt(rec, logT)
  const failed = Object.entries(lights).find(([, s]) => s === 'fail')
  if (failed) return { state: 'fail', cause: `${rec.lastCheck ?? failed[0]}: ${rec.lastDetail ?? ''}`.trim(), since: rec.lights[failed[0]].failT ?? rec.lights[failed[0]].since }
  const warned = Object.entries(lights).find(([, s]) => s === 'warn')
  if (warned) return { state: 'warn', cause: `${rec.lastCheck ?? warned[0]}: ${rec.lastDetail ?? ''}`.trim(), since: rec.lights[warned[0]].since }
  const last = rec.lastCheckT ?? rec.attachedT + ARRIVE_S
  if (logT - last > 3 * rec.checkPeriod) return { state: 'missed-check', cause: `no check for ${Math.round(logT - last)} s`, since: last + 3 * rec.checkPeriod }
  if (rec.lastCheckT != null && logT - rec.lastCheckT < 0.4) return { state: 'scanning', cause: null, since: rec.lastCheckT }
  return { state: 'attached', cause: null, since: rec.state === 'attached' ? rec.since : Math.max(rec.attachedT + ARRIVE_S, rec.lastCheckT != null ? rec.lastCheckT + 0.4 : 0) }
}

/** The ceremony of a transition (A3 §5.4). */
export const transitions = (from, to) => ceremonyOf(TRANSITIONS, from, to)

/** The pose at `logT` (A3 §4.5): `fill` carries the scan band, `blink` the worst light's blink, `hue` the worst light's hue. */
export function pose(rec, logT) {
  const p = blankPose()
  const st = rec.state ?? 'arriving'
  const dt = Math.max(0, logT - (rec.since ?? logT))
  const lights = lightsAt(rec, logT)
  p[CH.x] = rec.pos.x
  p[CH.z] = rec.pos.z
  p[CH.y] = 1.3 + 0.6 * rec.side
  p[CH.scale] = rec.side
  p[CH.hue] = HUE.NONE
  p[CH.edgeHue] = HUE['N-STEEL']
  p[CH.l] = 0.8
  switch (st) {
    case 'arriving': { const u = glide(clamp01(dt / 0.5)); p[CH.motion] = u; p[CH.hue] = HUE.CYAN; p[CH.flags] |= FLAG.mover; p[CH.fill] = dt > 0.5 ? clamp01((dt - 0.5) / 0.24) : 0; break }
    case 'scanning': p[CH.fill] = enter(clamp01(dt / 0.4)); p[CH.hue] = HUE.CYAN; p[CH.l] = 1.2; break
    case 'warn': { const w = Object.values(rec.lights).find((L) => L.state === 'warn'); const since = w?.since ?? rec.since; p[CH.hue] = HUE.AMBER; p[CH.blink] = logT - since < 5 && rec.ackT == null ? 0.4 + 0.6 * blink(0.6, logT - since) : 1; p[CH.flags] |= FLAG.amber; break }
    case 'fail': p[CH.hue] = HUE.RED; p[CH.blink] = dt < 2 ? blink(1.5, dt) : 1; p[CH.flags] |= FLAG.red; break
    case 'missed-check': p[CH.l] = 0.5; p[CH.flags] |= FLAG.dashed; p[CH.edgeHue] = HUE['N-GHOST']; break
    case 'detached': { const out = 3 * 0.08; p[CH.fill] = 1 - clamp01(dt / out); p[CH.y] -= (p[CH.y] + 1) * enter(clamp01((dt - out) / (0.85 * 0.5))); p[CH.l] = 0.8 * (1 - clamp01((dt - out) / 0.5)); if (dt > out + 0.5) p[CH.flags] &= ~FLAG.drawn; break }
    case 'unknown': p[CH.sat] = 0.5; p[CH.edge] = 0.25; p[CH.flags] |= FLAG.frozen; break
    default: break
  }
  p[CH.spin] = 0
  p[CH.hollow] = Object.values(lights).every((s) => s === 'unknown') ? 1 : 0
  return p
}

/** The three lights at `logT`, for Lacuna's aggregate (worst wins). */
export { lightsAt }
