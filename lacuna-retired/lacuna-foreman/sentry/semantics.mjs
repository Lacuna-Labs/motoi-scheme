// sentry/semantics.mjs — S0 SEMANTICS BY CODE (lane K1, unit K1.7; SENTRY-2.0 §5 S0, unit 2.2; the w-393661 postmortem).
// Owns: the checks code makes on every call and every turn without a mind: `drift` (an act's touched set shares nothing
// with the parts the goal names), `answered-not-acted` (the latch's step is done by a receipt and the turn answered in
// prose: no call opened, no receipt landed since the last said; the 12B's first failure on wo-273615), `circling` (three
// turns on one step moving no receipt and no answer). Each is one verdict row through verdicts.mjs; a kick goes through
// kick.mjs and, in shadow, is a `would-kick` row and nothing more. Refuses: a model (regex and set algebra only); a verdict
// without its why; a second circling kick on the same step. Implements: SENTRY-2.0 §5 (S0), §8 (code kicks, models warn);
// K1.7. Invariants (design §18): "no kick without a verdict row behind it"; "in shadow, nothing leaves the record".
// Faults (§16): none by id.
import { latchOf } from '../latch.mjs'
import { verdict, sentryOf } from './verdicts.mjs'
import { kick } from '../kick.mjs'
import { think } from '../talk.mjs'

/** Turns on one step before `circling` is written. */
export const CIRCLING_TURNS = 3
const PATHY = /(?:~\/|\.\/|\/)?(?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.*-]*|\b[A-Za-z0-9_-]+\.(?:mjs|js|py|md|slat|sks|sh|json|jsx|ts|cpp|hpp|html|css)\b/g

/** The file-like parts a goal names (paths and file names), lower-cased, without a leading `~/` or `./`. */
export function goalParts(goal) {
  const out = new Set()
  for (const m of String(goal || '').matchAll(PATHY)) { const p = m[0].toLowerCase().replace(/^(?:~\/|\.\/)/, '').replace(/(?:\/\.?|[.,;:])+$/, ''); if (p) out.add(p) }
  return [...out]
}

const segs = (p) => String(p).toLowerCase().split('/').filter((s) => s && s !== '.' && s !== '~')
/** Does a touched file share a segment or a stem with any part? */
const near = (file, parts) => {
  const fs = segs(file)
  const stem = (fs.at(-1) || '').replace(/\.[^.]+$/, '')
  return parts.some((p) => { const ps = segs(p); return ps.some((s) => fs.includes(s)) || (stem.length >= 4 && ps.some((s) => s.includes(stem))) })
}

/**
 * An act's receipt against the goal: files that share nothing with what the goal names are `drift` (warn). Silent when the
 * goal names no part or the receipt touched nothing. → the verdict row or null.
 */
export function drift(sup, w, { touched = [], op = 'act' } = {}) {
  const parts = goalParts(w.contract?.goal)
  if (!parts.length || !touched.length) return null
  const off = touched.map(String).filter((f) => !near(f, parts))
  if (!off.length) return null
  return verdict(sup, w, { check: 'drift', action: 'warn', by: 'code', detail: off.slice(0, 6).join(' '),
    why: `${op} touched ${off.length} file(s) the goal does not name (${off[0]}${off.length > 1 ? ` +${off.length - 1}` : ''}); the goal names ${parts.slice(0, 3).join(', ')}` })
}

function kickOrWould(sup, w, s, { check, text, why, shadow, step }) {
  const row = verdict(sup, w, { check, action: shadow ? 'would-kick' : 'kick', by: 'code', step, why, detail: text.slice(0, 200) })
  if (shadow) { s.would.push({ at: sup.host.now(), kind: 'kick', text }); think(w, 'state', `shadow: would kick — ${text}`, sup.host.now()); return { row, would: 1, kicks: 0 } }
  kick(sup, w, { category: check, text, by: 'sentry/semantics.mjs', evidence: { step }, event: { promise: null, text, missed: 1, kind: check } })
  return { row, would: 0, kicks: 1 }
}

/**
 * The turn's checks, at a said (sentry.mjs `apply`): answered-not-acted and circling. → `{rows, would, kicks}`.
 * @param {object} sup @param {object} w @param {{slice: object, sentences: Array}} v the verdict of the said
 * @param {{shadow: boolean}} o
 */
export function turnChecks(sup, w, v, { shadow = true } = {}) {
  const out = { rows: [], would: 0, kicks: 0 }
  const s = sentryOf(w)
  const sem = (w.sem ||= { resultsAtSaid: 0, turnsOnStep: 0, circledAt: null, stepAtSaid: null })
  const results = (w.run?.results || []).length
  const latch = latchOf(w)
  const step = latch ? w.latchLadder.steps[latch.k - 1] : null
  const acted = results > (sem.resultsAtSaid || 0) || (w.pending || []).length > 0
  const moved = latch && sem.stepAtSaid != null && sem.stepAtSaid !== latch.k
  const allPromise = v.sentences.length > 0 && v.sentences.every((x) => x.kind === 'promise')
  if (step && !latch.closed && !acted && !moved && !allPromise && step.done.some((d) => d.kind === 'receipt')) {
    const ops = step.done.filter((d) => d.kind === 'receipt').map((d) => d.op)
    const text = `step ${latch.k} of ${latch.playbook} is done by a receipt of ${ops.join(' or ')}; the turn answered in prose with no call`
    const r = kickOrWould(sup, w, s, { check: 'answered-not-acted', text, why: 'the step names an act and the turn made none', shadow, step: latch.k })
    out.rows.push(r.row); out.would += r.would; out.kicks += r.kicks
  }
  if (latch && !latch.closed && !acted && !moved) {
    sem.turnsOnStep = (sem.turnsOnStep || 0) + 1
    if (sem.turnsOnStep >= CIRCLING_TURNS && sem.circledAt !== latch.k) {
      sem.circledAt = latch.k
      const text = `${sem.turnsOnStep} turns on step ${latch.k} of ${latch.playbook} moved no receipt and no answer`
      const r = kickOrWould(sup, w, s, { check: 'circling', text, why: `${CIRCLING_TURNS} turns on one step with nothing closing it`, shadow, step: latch.k })
      out.rows.push(r.row); out.would += r.would; out.kicks += r.kicks
    }
  } else sem.turnsOnStep = 0
  sem.resultsAtSaid = results
  sem.stepAtSaid = latch ? latch.k : null
  return out
}
