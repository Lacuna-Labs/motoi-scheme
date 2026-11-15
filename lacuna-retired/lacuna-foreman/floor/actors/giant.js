// actors/giant.js — THE GIANTS at the edge (lane F5-BC; THE-FLOOR-5.0 §3.7; A3 §4.10, §5.5; A4 §2.10; RULINGS C-31, C-75,
// C-85). Owns: Claude's and the cloud seat's record tails (lit by a real commit, a card talk or a cloud ledger row; never
// hard-coded), their three states (away · lit · failed-call), their transitions and poses (columns at fixed places, clay
// and blue, L 0.35 away, L 0.75 + 0.2 breath lit, 0.1 rev/s while lit, a ring rising once per lighting event, a red diamond
// that does not land on a failed call). Refuses: a light without a ledger row, a constant "on a call" sentence, a turn
// while away. Implements: A3 §4.10, §5.5. Invariants (design §18): "never lit without a ledger row". Faults (§16): none.

import { blankPose, CH, FLAG } from '../keyframe.js'
import { enter, rc, clamp01 } from '../curves.js'
import { HUE, ceremonyOf } from '../vocabulary.js'

export const KIND = 'giant'
/** Lit for 15 min after a lighting event (A3 §4.10). */
export const PERIOD_S = 900
export const STATES = Object.freeze(['away', 'lit', 'failed-call'])
export const LIGHTS = Object.freeze({ column: ['dim', 'lit'] })
export const COUNTERS = Object.freeze(['commits', 'talks', 'calls', 'tokens', 'mails'])
export const REACTS = Object.freeze(['claude.commit', 'claude.talk', 'claude.mail', 'cloud.call'])
export const TRANSITIONS = Object.freeze([['*', 'lit', 'giant.light'], ['*', 'away', 'giant.rest'], ['*', 'failed-call', 'giant.failed']])
const LIT_S = 900

/** @return {!Object} the tail (A3 §3.2 giant row) */
export function create(id, logT, ev) {
  return { who: id, litT: null, last: null, commits: 0, talks: 0, calls: 0, tokens: 0, mails: 0, failT: null, failWhy: null, talkOpen: null }
}

/** Folds one event into the tail (A2 §3.8's Fold column). */
export function apply(rec, ev, ctx) {
  const t = ctx.logT
  const d = ev.data ?? {}
  switch (ev.kind) {
    case 'claude.commit': rec.commits++; rec.litT = t; rec.last = { kind: 'commit', sha: d.sha ?? null, subject: d.subject ?? null, at: t }; break
    case 'claude.talk': rec.talks++; rec.litT = t; rec.last = { kind: 'talk', thread: d.thread ?? null, at: t }; rec.talkOpen = d.phase === 'done' ? null : { mind: d.mind ?? null, since: t }; break
    case 'claude.mail': rec.mails++; rec.last = { kind: 'mail', id: d.id ?? null, severity: d.severity ?? null, at: t }; break
    case 'cloud.call':
      rec.calls++
      rec.tokens += (d.in ?? 0) + (d.out ?? 0)
      rec.last = { kind: 'call', model: d.model ?? null, tokens: (d.in ?? 0) + (d.out ?? 0), ok: d.ok !== false, at: t }
      if (d.ok === false) { rec.failT = t; rec.failWhy = d.why ?? 'call failed' } else rec.litT = t
      break
    default: break
  }
}

/** The state at `logT` (A3 §4.10). */
export function classify(rec, logT) {
  if (rec.failT != null && logT - rec.failT < 10) return { state: 'failed-call', cause: `call failed: ${rec.failWhy}`, since: rec.failT }
  if (rec.litT != null && logT - rec.litT < LIT_S) {
    const l = rec.last
    const cause = l?.kind === 'commit' ? `commit ${String(l.sha ?? '').slice(0, 7)} ${Math.round((logT - l.at) / 60)} min ago` : l?.kind === 'talk' ? 'talking' : l?.kind === 'call' ? `call ${l.model ?? ''} ${l.tokens} tok`.trim() : null
    return { state: 'lit', cause, since: rec.state === 'lit' ? rec.since : rec.litT }
  }
  return { state: 'away', cause: null, since: rec.litT != null ? rec.litT + LIT_S : 0 }
}

/** The ceremony of a transition (A3 §5.5). */
export const transitions = (from, to) => ceremonyOf(TRANSITIONS, from, to)

/** The pose at `logT` (A3 §4.10; A4 V-130…V-135). */
export function pose(rec, logT) {
  const p = blankPose()
  const st = rec.state ?? 'away'
  const dt = Math.max(0, logT - (rec.since ?? logT))
  p[CH.x] = rec.pos.x
  p[CH.z] = rec.pos.z
  p[CH.y] = 4
  p[CH.hue] = rec.who === 'claude' ? HUE.CLAY : HUE.BLUE
  p[CH.edgeHue] = p[CH.hue]
  if (st === 'away') p[CH.l] = 0.35
  else if (st === 'lit') {
    p[CH.l] = 0.75 + 0.2 * rc(0.25 * dt)
    p[CH.spin] = 2 * Math.PI * 0.1 * dt
    const de = logT - (rec.litT ?? logT)
    if (de < 1.2) { p[CH.ring] = 4 + 26 * enter(de / 1.2); p[CH.fill] = 1 - de / 1.2 }
  } else { p[CH.l] = 0.75; p[CH.flags] |= FLAG.red; p[CH.motion] = clamp01(dt / 0.9) }
  return p
}
