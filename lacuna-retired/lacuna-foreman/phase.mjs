// phase.mjs — THE PHASE STREAM, the foreman's part (SENTRY-2.0 §7, unit 3.6). Owns: the nine kinds the foreman emits on
// its upstream bus with the fields of the floor's catalog (`floor/kinds.slat`, RULINGS §1(a)): `run.step`, `run.ticket.open`,
// `run.ticket.close`, `run.claim`, `run.pause`, `sentry.attach`, `sentry.check`, `sentry.verdict`, `sentry.detach` — each
// carrying the actor, the coordinate `at` and the `ref` (the run id) the door's tailer turns into one `(ev …)` line. The bus
// kind IS the catalog kind; the data is `{at, ref, actor, …the kind's fields}`. Refuses: a kind outside the nine (one
// sentence); a field outside the kind's catalog row (dropped, never sent); a string over 300 chars (cut); a mind's words
// or a call's arguments (`run.claim` carries `chars`, never the text; `run.ticket.open` never carries `args`). The brain
// loop's think·recall·read·call·wait·answer·condense phases are the door's; `run.pass|fail|stop` stay the ledger row's.
// Implements: SENTRY-2.0 §7; A2 §3.2, §3.3, §2.2 (the object form on a wire); RULINGS §1(a). Invariants (§18 / law 17):
// "a record or nothing: every event names the run it came from and the coordinate it was stamped with". Faults (§16): none.
import { coordinateOf } from './contract.mjs'
import { print } from './coordinate.mjs'

/** The kinds and the data fields each may carry (the catalog's row, less what law 7 keeps off the wire). */
export const KINDS = Object.freeze({
  'run.step': Object.freeze(['n', 'status', 'text', 'ticket', 'awaiting']),
  'run.ticket.open': Object.freeze(['op', 'kind', 'deadline-s', 'n', 'pressed', 'ticket', 'tries']),
  'run.ticket.close': Object.freeze(['exit', 'ms', 'files', 'rows', 'ticket', 'op']),
  'run.claim': Object.freeze(['claims-done', 'chars', 'receipt']),
  'run.pause': Object.freeze(['by', 'park', 'for']),
  'sentry.attach': Object.freeze(['model', 'run', 'domain', 'mode', 'period-s']),
  'sentry.check': Object.freeze(['kind', 'n', 'by', 'ms']),
  'sentry.verdict': Object.freeze(['check', 'action', 'detail', 'shadow', 'by']),
  'sentry.detach': Object.freeze(['why']),
})
/** The longest string a field carries (A2 §2.1). */
export const STRING_MAX = 300

const clip = (v) => (typeof v === 'string' ? v.slice(0, STRING_MAX) : v)

/** The sentry's actor id for a run (A2 §2.4): `sentry-<model>:<run>`; `code` when no mind sits on it. */
export const sentryActor = (w) => `sentry-${w.sentry?.model || 'code'}:${w.id}`

/**
 * Emit one event of the stream. The fields outside the kind's row are dropped; `at` is the run's coordinate at this step and
 * call unless the caller stamps one; `ref` is the run.
 * @param {object} sup the supervisor (its host's `upstream` is the bus; a host without one records nothing)
 * @param {object} w the run
 * @param {string} kind one of KINDS
 * @param {Object<string, *>} data the kind's fields
 * @param {{actor?: string, at?: string, step?: number, call?: number}} [o]
 * @returns {{kind: string, actor: string, at: string, ref: string, data: Object<string, *>}} what went on the bus
 * @throws {Error} on a kind outside the nine
 */
export function emit(sup, w, kind, data = {}, o = {}) {
  const fields = KINDS[kind]
  if (!fields) throw new Error(`${kind} is not a kind the foreman emits (${Object.keys(KINDS).join(' ')})`)
  const out = {}
  for (const k of fields) if (data[k] !== undefined && data[k] !== null) out[k] = clip(data[k])
  const actor = o.actor || (kind.startsWith('sentry.') ? sentryActor(w) : w.id)
  const at = o.at || print(coordinateOf(sup, w, { step: o.step, call: o.call }))
  const ev = { kind, actor, at, ref: w.id, data: out }
  sup.host.upstream?.(kind, w, { at, ref: w.id, actor, ...out })
  return ev
}

/** A contract step row landed: `run.step`. */
export const stepRow = (sup, w, row, o = {}) => emit(sup, w, 'run.step', { n: row.n, status: row.status, text: String(row.text || '').slice(0, 240), ticket: row.ticket ?? undefined, awaiting: w.awaiting ? Math.round(w.awaiting.due - sup.host.now()) : undefined }, o)
/** A ticket opened: `run.ticket.open` (never the args: the ticket id names them on the contract). */
export const ticketOpen = (sup, w, t, o = {}) => emit(sup, w, 'run.ticket.open', { op: t.op, kind: t.kind, 'deadline-s': t.deadline_at == null ? undefined : Math.max(0, Math.round(t.deadline_at - t.sent_at)), n: t.n, pressed: !!t.pressed, ticket: t.ticket, tries: t.tries }, { call: t.call, ...o })
/** A ticket closed by its receipt: `run.ticket.close`. */
export const ticketClose = (sup, w, t, value = {}, o = {}) => emit(sup, w, 'run.ticket.close', { exit: Number.isInteger(value.exit) ? value.exit : undefined, ms: Number.isFinite(value.ms) ? Math.round(value.ms) : undefined, files: Array.isArray(value.files) ? value.files.length : undefined, rows: Array.isArray(value.rows) ? value.rows.length : undefined, ticket: t.ticket, op: t.op }, { call: t.call, ...o })
/** The mind spoke a claim: `run.claim` (chars, never the words). */
export const claim = (sup, w, { claimsDone = false, chars = 0, receipt = null } = {}, o = {}) => emit(sup, w, 'run.claim', { 'claims-done': !!claimsDone, chars: Math.round(chars), receipt: receipt ?? undefined }, o)
/** The run paused or parked: `run.pause`. */
export const pause = (sup, w, { by = null, park = false, forWhat = null } = {}, o = {}) => emit(sup, w, 'run.pause', { by: by ?? undefined, park: !!park, for: forWhat ?? undefined }, o)
/** A sentry device sat on the run: `sentry.attach`. */
export const attach = (sup, w, { model = 'code', domain = null, mode = 'shadow', periodS = null } = {}, o = {}) => emit(sup, w, 'sentry.attach', { model, run: w.id, domain: domain ?? undefined, mode, 'period-s': periodS ?? undefined }, o)
/** A sweep that produced ≥ 1 row: `sentry.check`. */
export const check = (sup, w, { kind, n = 1, by = 'code', ms = null } = {}, o = {}) => emit(sup, w, 'sentry.check', { kind, n, by, ms: ms ?? undefined }, o)
/** A verdict row: `sentry.verdict` (`shadow` is true for a would-* action). */
export const verdictEv = (sup, w, v, o = {}) => emit(sup, w, 'sentry.verdict', { check: v.check, action: v.action, detail: String(v.detail || '').slice(0, 160), shadow: /^would-/.test(String(v.action)), by: v.by, ...(v.met ? { met: v.met } : {}), ...(v.side ? { side: v.side } : {}) }, { at: v.at, ...o })
/** The run ended or the mode changed: `sentry.detach`. */
export const detach = (sup, w, why = 'ended', o = {}) => { if (w.sentry) w.sentry.attached = false; return emit(sup, w, 'sentry.detach', { why }, o) }
