// sentry/verdicts.mjs — THE VERDICT WRITER (SENTRY-2.0 unit 3.0; RULINGS Q-D1). Owns: the one verdict object every check
// returns (`{run, step, check, by, action, detail, why, at, t, light}`), its row in `runs.slat` through runs.mjs (the
// hook `host.sentryLedger` that was never defined is this writer), its event on the bus (`sentry.verdict`), the ring kept
// on the worker, the three lights as counters (provenance · ast · semantics, per worker and foreman-wide: what the floor's
// tailer counts from the rows, mirrored for `/sentry`), the levels (`note` info · `warn`/`would-*` warn · `kick`/`stop`/
// `refuse` error) and the inbox: one letter per `service·check·level` per hour, every repeat a count (SENTRY-2.0 §8).
// Refuses: a verdict without a `why`, a check outside the table or an action outside the seven (one sentence, nothing
// written); a kick or a stop (it records; kick.mjs kicks, the supervisor stops); a second letter inside the hour; a text
// body or an argument on a row (≤ 200-char sentences). Implements: SENTRY-2.0 §3–§5 (the checks' names), §8 (teeth: the
// lights, the dedup), unit 3.7; A2 §3.3. Invariants (§18): "a verdict without a why is not written"; "a verdict never
// changes a record". Faults (§16): none (a refusing ledger is noted on the worker by runs.mjs).
import { appendVerdict } from '../runs.mjs'
import { verdictEv } from '../phase.mjs'
import { coordinateOf } from '../contract.mjs'
import { print, SERVICES } from '../coordinate.mjs'
import { sendMail } from '../mail.mjs'

/** The three lights (THE-FLOOR-5.0 R2: the cube's lights are the three checks). */
export const LIGHTS = Object.freeze(['provenance', 'ast', 'semantics'])

/** Every check the sentry knows → the light it moves. A check outside this table is not a verdict. */
export const LIGHT_OF = Object.freeze({
  // provenance (SENTRY-2.0 §4): the chain, the coordinate, the scope
  'no-ticket': 'provenance', 'outside-touches': 'provenance', 'no-order': 'provenance', 'stale-gen': 'provenance', 'broken-link': 'provenance',
  'out-of-order': 'provenance', scope: 'provenance',
  // ast (§3): the call, the patch, the turn
  'bad-call': 'ast', 'ast-error': 'ast', 'end-form': 'ast', 'module-over-law': 'ast', 'blast-radius': 'ast', 'test-deleted': 'ast',
  'test-skipped': 'ast', 'past-500-lines': 'ast', 'empty-write': 'ast', 'no-assertion': 'ast',
  // semantics (§5): S0 code on every call, S1 the labels, the cart's control checks, the said's labels
  'out-of-sequence': 'semantics', drift: 'semantics', circling: 'semantics', 'claim-without-receipt': 'semantics', 'claim-with-receipt': 'semantics',
  'answered-not-acted': 'semantics', 'claims-tests-pass': 'semantics', 'commit-before-tests': 'semantics', promise: 'semantics', remark: 'semantics',
  'off-task': 'semantics', 'on-task': 'semantics', unsure: 'semantics', stuck: 'semantics', progress: 'semantics', pushback: 'semantics', proceed: 'semantics',
  'met?': 'semantics', locator: 'semantics', 'no-progress': 'semantics', loop: 'semantics', runaway: 'semantics', 'ended-unstated': 'semantics', 'step-too-large': 'semantics',
})
/** The seven actions; `would-*` is a shadow action (nothing was sent). */
export const ACTIONS = Object.freeze(['note', 'warn', 'would-kick', 'would-stop', 'kick', 'stop', 'refuse'])
/** The three levels (law 14) by action. */
export const LEVEL_OF = Object.freeze({ note: 'info', warn: 'warn', 'would-kick': 'warn', 'would-stop': 'warn', kick: 'error', stop: 'error', refuse: 'error' })
/** Rows kept on a worker. */
export const VERDICTS_KEPT = 32
/** The verdict writers that are minds (K1.10: they warn; only code kicks, stops or refuses). */
export const MODEL_BY = Object.freeze(new Set(['1b', '270m']))
/** The actions with teeth. */
export const TEETH = Object.freeze(new Set(['kick', 'stop', 'refuse']))
/** The inbox dedup window, seconds (SENTRY-2.0 §8: one per service·name·level per hour). */
export const DEDUP_S = 3600

const freshLights = () => Object.fromEntries(LIGHTS.map((l) => [l, { info: 0, warn: 0, error: 0 }]))

/** The sentry's state on a worker (never on the rendered contract; the ledger row is the record). */
export function sentryOf(w) {
  return (w.sentry ||= { attached: false, device: null, model: null, domain: null, mode: null, verdicts: [], would: [], wakes: [],
                         grade: { on_task: true }, counts: {}, lights: freshLights() })
}

/** The foreman-wide counters the `/sentry` route shows (the ledger's rows are the record the floor counts). */
export function lights(sup) { return (sup.sentryLights ||= freshLights()) }

/**
 * One verdict: kept on the worker, written to the ledger, put on the bus, counted on its light, lettered once an hour.
 * @param {object} sup the supervisor
 * @param {object} w the run or cart the check looked at
 * @param {{check: string, action: string, why: string, detail?: string, by?: string, step?: number, call?: number, letter?: boolean}} o
 *   `letter: false` when the road that found it letters on its own (I-03's mail carries the ticket): one finding, one letter
 * @returns {{run: string, step: number, check: string, by: string, action: string, detail: string, why: string, at: string, t: number, light: string, level: string}}
 * @throws {Error} a check outside the table, an action outside the seven, or no why
 */
export function verdict(sup, w, o) {
  const { check, action, by = 'code' } = o
  const light = LIGHT_OF[check]
  if (!light) throw new Error(`${check} is not a check the sentry knows (sentry/verdicts.mjs LIGHT_OF)`)
  if (!ACTIONS.includes(action)) throw new Error(`a verdict's action is one of ${ACTIONS.join(' ')}, not ${action}`)
  if (MODEL_BY.has(by) && TEETH.has(action)) throw new Error(`a model warns, code kicks (SENTRY-2.0 §8): a verdict by ${by} may not ${action}`)   // K1.10
  if (!String(o.why ?? '').trim()) throw new Error(`a verdict (${check}) without a why is not written`)
  const st = sentryOf(w)
  const now = sup.host.now()
  const level = LEVEL_OF[action]
  const step = o.step ?? w.contract?.latch?.k ?? w.contract?.step ?? (w.cart ? (w.cart.steps || []).length : 0)
  const row = { run: w.id, step, check, by, action, detail: String(o.detail ?? '').slice(0, 200), why: String(o.why).slice(0, 200),
                at: print(coordinateOf(sup, w, { step, call: o.call })), t: Math.round(now * 1000) / 1000, light, level,
                ...(o.met ? { met: o.met } : {}), ...(o.side ? { side: o.side } : {}) }   // P7: the expectation met or not, and the side
  st.verdicts.push(row)
  if (st.verdicts.length > VERDICTS_KEPT) st.verdicts.splice(0, st.verdicts.length - VERDICTS_KEPT)
  st.counts[check] = (st.counts[check] || 0) + 1
  st.lights[light][level] += 1
  lights(sup)[light][level] += 1
  appendVerdict(sup, w, row)
  verdictEv(sup, w, row)
  if (level !== 'info' && o.letter !== false) inbox(sup, w, row)
  return row
}

/**
 * The inbox: one letter per `service·check·level` per hour; a repeat inside the hour raises the count and writes nothing.
 * @returns {{deduped: boolean, count: number}}
 */
export function inbox(sup, w, row) {
  const key = `${SERVICES.foreman}·${row.check}·${row.level}`
  const seen = (sup.sentryInbox ||= new Map()).get(key)
  const now = sup.host.now()
  if (seen && now - seen.at < DEDUP_S) { seen.count += 1; return { deduped: true, count: seen.count } }
  sup.sentryInbox.set(key, { at: now, count: 1 })
  if (typeof sup.host.mail === 'function') {
    sendMail(sup, w, { kind: 'self-report', severity: row.level === 'error' ? 'wrong' : 'note', what: `sentry ${row.level}: ${row.check} — ${row.why}`,
                       evidence: { run: row.run, step: row.step, check: row.check, action: row.action, detail: row.detail, at: row.at }, asks: 'read the run' })
  }
  return { deduped: false, count: 1 }
}
