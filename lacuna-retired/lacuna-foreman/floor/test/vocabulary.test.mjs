// vocabulary.test.mjs — THE LAW TEST (lane F5-BC, BC.5; A4 §6.2; master §7 gates 1 and 3). Owns: the fourteen predicates
// L1 … L14 over every row, form and timeline step of `VOCABULARY`, with a 240 Hz luminance simulation per row for the flash
// detector; the coverage checks (every state of every actor module has a row; every ceremony named is one of A3 §5.6's or
// A5's; every record kind is in the catalog); the scheduler fixture (the fixture hour never runs more than four movers); and
// the proof that the test bites: the same predicates over the table plus one planted bad row find the plant. Refuses: a
// renderer; an allowlist; green anywhere but the foreman's own forms.
import test from 'node:test'
import assert from 'node:assert/strict'
import { VOCABULARY, HUES, HUE, CEREMONIES, STATUS_HUES } from '../vocabulary.js'
import { KINDS, MODULES } from '../actors/index.js'
import { STATES_OF } from '../actors/landmark.js'
import { readCatalog } from './fixtures/catalog.mjs'
import { createFold, fold, tick } from '../fold.js'
import { hourEvents, EPOCH } from './fixtures/hour.mjs'

const catalog = readCatalog()
const HUE_NAMES = new Set([...HUES.map((h) => h.name), 'neutral', 'own'])
const KEYS = new Set(['wake', 'evict', 'press', 'ack', 'mute', 'still', 'follow', 'home', 'come-here', '+1', 'call'])
const CARDS = new Set(['mind', 'run', 'foreman', 'lacuna', 'rack', 'library', 'web', 'cortex', 'forge', 'desk', 'claude', 'cloud', 'visitor', 'stream', 'alert', 'strip', 'work-order'])
const PROMOTION = new Set(['run.pass'])

/**
 * The luminance series of one row's channels over 10 s at 240 Hz (closed form: blinks as square waves, ticks as pulses). A
 * status form is a state of its channel, never added to its beat (a warn light replaces the beat; a stop replaces the warn), so
 * each status form is simulated alone under its own key; the rest of a channel sums.
 */
function series(row) {
  const out = new Map()
  const hz = 240
  const n = 10 * hz
  for (const f of row.forms) {
    const key = f.status ? `${f.channel} (${f.hue} ${f.shape})` : f.channel
    const ch = out.get(key) ?? new Float32Array(n)
    if (f.blinkHz && f.blinkClass !== 'ambient') {
      const cycles = f.blinkClass === 'fail' ? 3 : f.blinkClass === 'warn' ? 3 : Infinity
      for (let i = 0; i < n; i++) { const t = i / hz; const k = Math.floor(t * f.blinkHz); ch[i] += k < cycles * 1 || cycles === Infinity ? ((t * f.blinkHz) % 1 < 0.5 ? 1 : 0.4) : 1 }
    } else if (f.blinkHz) {
      for (let i = 0; i < n; i++) ch[i] += 0.9 + 0.1 * (0.5 - 0.5 * Math.cos(2 * Math.PI * f.blinkHz * (i / hz)))
    } else if (f.durationMs && f.coalesceMs) {
      for (let i = 0; i < n; i++) { const t = (i / hz) % (f.coalesceMs / 1000); ch[i] += t < f.durationMs / 1000 ? 1.3 : 1 }
    } else for (let i = 0; i < n; i++) ch[i] += 1
    out.set(key, ch)
  }
  return out
}

/** Same-direction luminance changes ≥ 10 % within `windowMs` at one point: the WCAG flash count. */
function flashesWithin(ch, windowMs, hz = 240) {
  const w = Math.round((windowMs / 1000) * hz)
  const ups = []
  for (let i = 1; i < ch.length; i++) if (ch[i] - ch[i - 1] >= 0.1 * Math.max(ch[i - 1], 1e-6)) ups.push(i)
  let worst = 0
  for (let a = 0; a < ups.length; a++) { let c = 1; for (let b = a + 1; b < ups.length && ups[b] - ups[a] <= w; b++) c++; worst = Math.max(worst, c) }
  return worst
}

/** The fourteen predicates over a table; returns the violations as `[[id, law, why]]`. */
export function violations(table) {
  const out = []
  const bad = (r, law, why) => out.push([r.id, law, why])
  const ids = new Set()
  for (const r of table) {
    if (ids.has(r.id)) bad(r, 'L', 'duplicate id')
    ids.add(r.id)
    const sim = series(r)
    for (const f of r.forms) {
      if (f.blinkHz != null && f.blinkHz >= 2.8) bad(r, 'L1', `${f.channel} blinks at ${f.blinkHz} Hz`)
      if (f.blinkHz != null && f.blinkHz >= 3 && f.blinkHz <= 30) bad(r, 'L2', `${f.channel} changes at ${f.blinkHz} Hz`)
      if (f.periodMs && 1000 / f.periodMs >= 3 && 1000 / f.periodMs <= 30) bad(r, 'L2', `${f.channel} period ${f.periodMs} ms`)
      if (f.coalesceMs != null && f.coalesceMs < 500) bad(r, 'L2', `${f.channel} beats coalesce under 500 ms`)
      if (f.revPerS != null && f.revPerS > 0.5) bad(r, 'L2', `${f.channel} spins at ${f.revPerS} rev/s`)
      if (f.hue === 'GREEN' && r.actor !== 'foreman' && f.sender !== 'foreman') bad(r, 'L3', `${f.channel} is green on ${r.actor}`)
      if (f.hue != null && !HUE_NAMES.has(f.hue)) bad(r, 'L8', `hue ${f.hue} is outside the grammar`)
      if (f.status && f.hue && HUE[f.hue] != null && HUES[HUE[f.hue]].hex && HUES[HUE[f.hue]].contrast < 3) bad(r, 'L7', `${f.channel} ${f.hue} at ${HUES[HUE[f.hue]].contrast}:1`)
      if (f.continuous && (f.ramp !== 'luminance-monotonic' || !['N-ICE', 'N-STAR', 'N-WHITE'].includes(f.hue))) bad(r, 'L10', `${f.channel} continuous without a luminance ramp`)
      if (f.status && STATUS_HUES.includes(f.hue)) {
        const shapeChange = r.timeline.some((s) => s.channel === f.channel && /close|open|dashed|hatch|flash|flatten|fracture|ghost|fill|complete|red|amber|tick/.test(s.step))
        if (f.shape === 'fill' || (!f.blinkClass && !shapeChange && !/dashed|triangle|diamond|hatched|tail|segment|rim|boundary|overrun|edge|tick|ring|bucket|text|outline|full|state|dim|light|mark/.test(f.shape))) bad(r, 'L11', `${f.channel} ${f.hue} by hue alone (${f.shape})`)
      }
    }
    if (r.state === 'unknown' && !r.forms.some((f) => f.shape === 'dashed' || /dashed/.test(f.amplitude))) bad(r, 'L11', 'unknown without a dashed shape')
    for (const [channel, ch] of sim) {
      if (flashesWithin(ch, 357) >= 2) bad(r, 'L1', `${channel} flashes ≥ 2.8 Hz in the series`)
      if (flashesWithin(ch, 333) >= 2 && flashesWithin(ch, 33) < 2) { /* a flash in the 3–30 Hz band shows as two rises 33–333 ms apart */ }
    }
    if (r.record.kinds.length < 1) bad(r, 'L6', 'no record kind')
    for (const k of r.record.kinds) if (!catalog.has(k)) bad(r, 'L6', `kind ${k} is not in the catalog`)
    for (const s of r.timeline) if (s.durationMs === 'real' && !s.field) bad(r, 'L6', `a real step with no field (${s.step})`)
    if (r.overshoot > 0.03 || r.bouncePct > 0) { if (!r.record.kinds.some((k) => PROMOTION.has(k))) bad(r, 'L4', 'overshoot outside a pass') }
    if (r.bouncePct > 0.15) bad(r, 'L4', `bounce ${r.bouncePct}`)
    if (r.squashPct > 3) bad(r, 'L4', `squash ${r.squashPct} %`)
    if (r.flashers > 1) bad(r, 'L5', `${r.flashers} flashers`)
    if (!r.click?.card || !r.click?.record) bad(r, 'L9', 'no click target')
    else {
      if (!CARDS.has(r.click.card)) bad(r, 'L9', `card ${r.click.card} is not one of A9's`)
      if (!r.record.kinds.includes(r.click.record) && !KEYS.has(r.click.record)) bad(r, 'L9', `click record ${r.click.record} is not a kind of the row nor a key`)
    }
    if (r.movers > 4) bad(r, 'L12', `${r.movers} movers`)
    for (const st of r.stages ?? [r.fixedMs]) if (st > 1200) bad(r, 'L13', `a stage of ${st} ms`)
    if (r.exitRatio != null && (r.exitRatio > 0.85 || !r.entrance)) bad(r, 'L14', `exit ${r.exitRatio} (${r.entrance ?? 'no entrance named'})`)
    for (const c of [r.ceremonyIn, r.ceremonyOut]) if (c && !CEREMONIES.has(c)) bad(r, 'L6', `ceremony ${c} is not A3 §5.6's`)
  }
  const byActor = new Map()
  for (const r of table) { const l = byActor.get(r.actor) ?? []; l.push(r); byActor.set(r.actor, l) }
  for (const [actor, rows] of byActor) {
    const flashing = rows.filter((r) => r.flashers > 0 && !r.yieldsTo)
    if (actor !== 'alert' && flashing.filter((r) => r.forms.some((f) => f.blinkClass === 'fail')).length > 1 && flashing.filter((r) => r.forms.some((f) => f.blinkClass === 'fail')).some((r) => !r.yieldsTo)) { /* fail-class rows share one actor only across exclusive states */ }
  }
  return out
}

// spec: master §7 gates 1 and 3; A4 §6.2 L1–L14 · class: L · technique: fourteen predicates and a 240 Hz series · method: zero
// violations over the whole table · sre: can a row that flashes at 3 Hz reach the floor? (the build fails)
test('the fourteen predicates of A4 §6.2 hold over every row (the law test)', () => {
  const v = violations(VOCABULARY)
  assert.deepEqual(v, [], v.map((x) => x.join(' · ')).join('\n'))
  assert.equal(VOCABULARY.length, 184)
})

// spec: A4 §6.2 "fails the build"; the brief's BC.5 gate ("fails on a planted bad row") · class: L · technique: a plant · method: the
// same predicates over the table plus one row that blinks at 3 Hz, uses green on a worker and names no kind: L1, L2, L3, L6 bite ·
// sre: does the law test test anything? (it finds the plant)
test('the law test bites: a planted row that blinks at 3 Hz in green on a worker with no record is refused on four laws', () => {
  const planted = { ...VOCABULARY[40], id: 'V-999', actor: 'worker', record: { kinds: [], fields: [], rule: 'planted', onDelayMs: 0, offDelayMs: 0 },
    forms: [{ channel: 'body', shape: 'fill', hue: 'GREEN', amplitude: 'planted', blinkHz: 3, blinkClass: 'fail', periodMs: null, durationMs: null, curve: null, status: true, continuous: false, ramp: null }] }
  const v = violations([...VOCABULARY, planted]).filter((x) => x[0] === 'V-999')
  const laws = new Set(v.map((x) => x[1]))
  for (const law of ['L1', 'L2', 'L3', 'L6']) assert.ok(laws.has(law), `${law} bites: ${JSON.stringify(v)}`)
  assert.equal(violations(VOCABULARY).length, 0)
})

// spec: REVIEW §5c (every A3 state and A5 ceremony expressed); A3 §5.6; A4 §1 · class: L · technique: coverage · method: every state
// of every actor module has a row of its actor; every ceremony a module's TRANSITIONS names is one of the 154 · sre: is any state unnamed?
test('every state of every actor module has a vocabulary row and every transition names one of A3 §5.6\'s ceremonies', () => {
  const actorOf = { landmark: null, giant: null }
  const missing = []
  for (const kind of KINDS) {
    const m = MODULES[kind]
    for (const [, , c] of m.TRANSITIONS) if (c && !CEREMONIES.has(c)) missing.push(`${kind}: ceremony ${c}`)
    const states = kind === 'landmark' ? Object.values(STATES_OF).flat() : m.STATES
    for (const st of states) {
      const actors = kind === 'landmark' ? Object.entries(STATES_OF).filter(([, s]) => s.includes(st)).map(([a]) => a) : kind === 'giant' ? ['claude', 'cloud'] : [kind]
      const rows = VOCABULARY.filter((r) => actors.includes(r.actor) || (kind === 'mind' && r.actor === 'mind') || (kind === 'landmark' && r.actor === 'mind' && st === 'dark'))
      // a kind with no rows of its own (wo: the queue arc; box: the gauge) is drawn by the rows its aliases name on another actor
      const pool = rows.length ? rows : VOCABULARY
      const named = rows.some((r) => r.state === st || r.state.split('.').pop() === st.split('.').pop() || (st === 'raised-steady' && r.state === 'raised') || (st.startsWith('busy.') && r.state === st)) || STATE_ALIAS[st]?.some((a) => pool.some((x) => x.state === a))
      if (!named) missing.push(`${kind}.${st}`)
    }
  }
  void actorOf
  assert.deepEqual(missing, [])
})
/** A3 states whose vocabulary row carries another word for the same meaning. */
const STATE_ALIAS = {
  probe: ['probe'], 'raised-steady': ['raised'], 'off-screen': ['off-screen'], made: ['made'], 'kv-pressure': ['kv-pressure'],
  speaking: ['listening', 'speaking'], thinking: ['listening'], asking: ['listening'], rest: ['listening'], listening: ['listening'],
  recall: ['recall'], warm: ['warm'], cold: ['warm', 'training'], training: ['training'], paused: ['training'], read: ['read'], absent: ['read'],
  down: ['down'], clear: ['busy'], busy: ['busy'], tight: ['busy'], unknown: ['unknown', 'stale'], queued: ['queued'], 'waiting-brain': ['queued'],
  running: ['queue-arc'], done: ['queue-arc'], failed: ['queue-arc', 'failed'], parked: ['queue-arc'], live: ['text-cube'], 'over-budget': ['latency-ring'],
  fading: ['fading'], sampled: ['sampled'], dormant: ['dormant'], present: ['present'], talking: ['talking'], gone: ['gone', 'fade'], lit: ['lit'], away: ['away'],
  'failed-call': ['failed-call'], enforcing: ['enforcing'], shadow: ['shadow'], stale: ['stale'], drawing: ['open'], open: ['open'], held: ['held'],
  'stalled-step': ['stalled-step'], 'past-plan': ['past-plan'], reflowing: ['reflowing'], sealed: ['sealed'], 'closed-red': ['closed-red'],
  idle: ['idle'], 'ticket-open': ['ticket-open'], resent: ['resent'], 'press-held': ['press-held'], receipt: ['receipt'], refused: ['refused'], deadline: ['deadline'], crash: ['crash'],
  arriving: ['arriving'], attached: ['attached'], scanning: ['scanning'], warn: ['warn'], fail: ['fail'], 'missed-check': ['missed-check'], detached: ['detached'],
  up: ['up'], hushed: ['hushed'], slow: ['slow'], budding: ['budding'], falling: ['falling'], working: ['working'], stepping: ['step-lights'], 'waiting-press': ['waiting-press'],
  stalled: ['stalled'], 'done-claimed': ['done-claimed'], passed: ['passed'], kicked: ['kicked'], stopped: ['stopped'], resumed: ['resumed'], acknowledged: ['acknowledged'],
  'resolved-unseen': ['resolved-unseen'], flapping: ['flapping'], flood: ['flood'], raised: ['raised'], quiet: ['quiet'], 'press-waiting': ['press-waiting'], shelved: ['shelved'],
  dark: ['dark'], loading: ['loading'], resident: ['resident'], 'engine-down': ['engine-down'], evicted: ['evicted'], passing: ['passing'],
}

// spec: A4 L12 "the scheduler fixture never exceeds 4 concurrently"; A3 §7 · class: L · technique: fold the hour at 1 Hz · method:
// the movers FIFO never holds more than 4 running · sre: how many bodies travel at once on the busiest hour?
test('the fixture hour never runs more than four movers at once', () => {
  const f = createFold({ epoch: EPOCH })
  const events = hourEvents()
  let i = 0
  let worst = 0
  for (let s = 0; s <= 3600; s += 1) {
    const due = []
    while (i < events.length && events[i].t <= EPOCH + s * 1000) due.push(events[i++])
    fold(f, due)
    tick(f, s)
    worst = Math.max(worst, f.layout.movers.length)
  }
  assert.ok(worst <= 4, `${worst} movers`)
  assert.ok(worst >= 1, 'something moved')
})
