// runs.mjs — THE RUN LEDGER AND THE RUN INDEX. Owns: the `(run …)` record a run leaves when it ends (design §7.5), the
// `(verdict …)` row every sentry check leaves (RULINGS Q-D1; SENTRY-2.0 unit 3.3) and the `(handoff …)` record a mind or
// the router writes when a step moves to another rung (ROLEBENCH §5.3), each appended to `~/lacuna-world/foreman/ledger/
// runs.slat` by the foreman only, through `host.ledger`; the one reader of each row (`readVerdict`, `readHandoff`); the hook
// R1's grid ledger reads at the run row (`host.onRunRow`); the live index of runs by key (`file` merges on it); what a run's
// `hands`/`minds`/`kicks`/`swaps` counts are. Refuses: a second record for one run; a record for a worker that is not a run
// and not a cart; a verdict row without a `why`, a check or an action (not written: one sentence to the caller); a row that
// carries a mind's text or a call's arguments (ids, counts and ≤ 200-char sentences only). Implements §7.5, §8 lifecycle
// ("`(run …)` appended → `cart-retired` upstream"); SENTRY-2.0 §4 (the coordinate `at` on every run and verdict row), §5 S2
// and ROAD category 2 ruling 5 (the `why` on the run row); Q-D1 (one row shape, one ledger, one tailer). Invariants (§18):
// "every run leaves one row"; "a verdict without a why is not written". Faults: none of its own (a ledger that refuses is
// noted on the worker, never a crash). The work rows (finale order §7 ruling 6, §10 row 5): a run (a filed run, a cart or a pausable
// worker; WORDS-1.0: a job is a stretch of a run between yields, not a worker) writes one `(work …)` row when it opens and one when it closes, through `host.work` (work.mjs owns the form; the
// foreman alone writes `pass` on a run, law 6); `livingRuns` carries each living run's last row.
import { toSlat } from './protocol.mjs'
import { readForms, writeString, writeData, dataToJson } from '../../lacuna-scheme/src/slat-data.js'
import { coordinateOf } from './contract.mjs'
import { print } from './coordinate.mjs'
import { detach } from './phase.mjs'
import { iso, workForm } from './work.mjs'

/** The running run under `key`, or null. */
export function runByKey(sup, key) {
  const k = String(key)
  return [...sup.workers.values()].find((x) => x.run && x.run.key === k && ['running', 'starting', 'paused'].includes(x.state)) || null
}

/** Every living run, for the desk: {id, key, cart, state, step, hops, awaiting}. */
export function livingRuns(sup) {
  return sup.living().filter((w) => w.run || w.cart).map((w) => ({
    id: w.id, key: w.run?.key ?? w.contract?.key ?? null, cart: w.contract?.cart ?? w.cart?.name ?? null, state: w.contract?.state ?? w.state,
    step: w.contract?.step ?? 0, hops: w.run?.hops ?? 0, awaiting: w.awaiting ? Math.max(0, Math.round(w.awaiting.due - sup.host.now())) : null,
    goal: w.contract?.goal ?? null, by: w.by ?? null, kind: w.run ? 'run' : 'cart',
    role: w.run?.role ?? null, desk: !!w.run?.desk, sentry: w.workSentry?.domain ?? (w.cart ? 'cart' : null),   // the office floor: who sent it, who watches it (O25, O11)
    brain: w.contract?.brain ?? null, open: (w.pending || []).length,   // open requests: the points on the foreman's arm
    at: w.contract ? print(coordinateOf(sup, w)) : null,                 // the run's coordinate (SENTRY-2.0 §4)
    work: w.workRow ? { state: w.workRow.state, check: w.workRow.check, started: w.workRow.started, updated: w.workRow.updated, by: 'foreman' } : null,
  }))
}

// ── the work rows (finale order §7 ruling 6, §10 row 5) ───────────────────────────────────────────────────────────────
/** A worker's work kind: a run (a filed run, a cart or a pausable worker), or null (a watch worker is not work). Pure. */
export const workKindOf = (w) => (w.run || w.cart || w.pausable ? 'run' : null)
const STATE_OF = { done: 'done', 'waiting-owner': 'held', paused: 'held', running: 'running', starting: 'running' }

/**
 * The worker's work row at a phase. Pure but for the host's clock.
 * @param {{host: {now: function(): number}}} sup
 * @param {!Object} w the worker
 * @param {'open'|'close'} phase
 * @return {?Object} null for a worker that is not a run or a job
 */
export function workRowOf(sup, w, phase) {
  const kind = workKindOf(w)
  if (!kind) return null
  const c = w.contract || {}
  const closing = phase === 'close'
  const state = closing ? (STATE_OF[c.state] === 'held' ? 'held' : c.outcome === 'pass' || c.state === 'done' ? 'done' : 'failed') : 'running'
  const check = closing && c.outcome === 'pass' ? 'pass' : closing && c.outcome === 'fail' ? 'fail' : 'none'
  return { id: w.id, kind, 'asked-by': w.by ?? null, doing: String(c.goal ?? w.cart?.name ?? w.name ?? '').slice(0, 200), expect: c.expect ? String(Array.isArray(c.expect) ? c.expect[0] : c.expect).slice(0, 200) : null, state, check,
    parent: w.parent ?? null, started: iso(w.started), updated: iso(sup.host.now()), ended: closing ? iso(sup.host.now()) : null }
}

/** Writes the worker's work row through `host.work`; a refusal is noted on the worker, never a stop. */
export function noteWorkRow(sup, w, phase) {
  const row = workRowOf(sup, w, phase)
  if (!row || (phase === 'close' && w.workClosed)) return null
  if (phase === 'close') w.workClosed = true
  try { sup.host.work?.(`${workForm(row, 'foreman')}\n`); w.workRow = row } catch (e) { w.workError = String(e && e.message ? e.message : e).slice(0, 200) }
  return row
}

/** The record (§7.5), built once at the end of a run; `checked_by` is the done-check's name or null. */
export function runRecord(sup, w, { checkedBy = null, batch = null, attempt = 1 } = {}) {
  const c = w.contract
  if (!c) return null
  const now = sup.host.now()
  const m = w.mind || {}
  const hands = (c.steps || []).filter((s) => /^hand /.test(s.text) && s.status === 'done').length
  return {
    id: w.id, cart: c.cart, run: c.key, batch, attempt, 'first-try': attempt === 1 && c.outcome === 'pass',
    outcome: c.outcome, exit: c.exit, 'checked-by': c.outcome === 'pass' ? checkedBy || 'foreman' : null,
    // swaps: a swap at step 0 is a swap (2026-10-24, U2: `swapped_at ? 1 : 0` read step 0 as none)
    rounds: w.run?.hops ?? (c.steps || []).length, kicks: (c.kicks || []).length, swaps: c.swapped_at != null ? 1 : 0, hands,
    minutes: Math.round(((now - w.started) / 60) * 100) / 100, 'brain-seconds': Math.round(w.brainSeconds || 0),
    minds: m.asked ? { asked: m.asked, labels: m.labels || 0, dropped: m.dropped || 0, failed: m.failed || 0 } : null,
    ended: now,
    // 1.0 (K1): the reason a run that did not pass ended with (category 2 ruling 5) and the run's coordinate (SENTRY-2.0 §4)
    why: c.outcome === 'pass' ? null : c.why ?? null, at: c.at ?? print(coordinateOf(sup, w)),
  }
}

/** Append the row once; `host.ledger(text)` writes it; R1's grid ledger hears it (`host.onRunRow`); the sentry detaches. */
export function closeRun(sup, w, opts = {}) {
  noteWorkRow(sup, w, 'close')                 // every run and job closes its work row, with a contract or without
  if (!w.contract || w.runRecorded) return null
  const row = runRecord(sup, w, opts)
  w.runRecorded = true
  try { sup.host.ledger?.(`(run ${toSlat(row)})\n`) } catch (e) { w.ledgerError = String(e && e.message ? e.message : e).slice(0, 200) }
  try { sup.host.onRunRow?.(row, w) } catch (e) { w.gridError = String(e && e.message ? e.message : e).slice(0, 200) }   // the grid is a reader, never a stop
  if (w.sentry?.attached) detach(sup, w, 'ended')
  return row
}

// ── the verdict row (Q-D1) ────────────────────────────────────────────────────────────────────────────────────────────
/** The verdict row's fields in their one order; `t` is the foreman's clock in seconds (the tailer's `t` is it × 1000). */
export const VERDICT_FIELDS = Object.freeze(['run', 'step', 'check', 'by', 'action', 'detail', 'why', 'at', 't'])
/** A P7 verdict's two more (design WORK-CHIPS-CHAT §7.1): the expectation met or not, and the side that failed. */
export const VERDICT_P7_FIELDS = Object.freeze([...VERDICT_FIELDS, 'met', 'side'])
const str = writeString
const num = (n) => (Number.isFinite(Number(n)) ? String(Number(n)) : '0')

/**
 * One verdict row as text: `(verdict (run "w-…") (step n) (check "…") (by "code|regex|1b|270m|none|late") (action "…")
 * (detail "…") (why "…") (at "lacuna:/…") (t s))`. The caller's `why` is the record: a row with none is refused.
 * @param {{run: string, step: number, check: string, by: string, action: string, detail: string, why: string, at: string, t: number}} v
 * @returns {string} one line with its newline
 * @throws {Error} when check, action or why is missing
 */
export function verdictLine(v) {
  for (const k of ['check', 'action', 'why']) if (!String(v[k] ?? '').trim()) throw new Error(`a verdict row without ${k === 'why' ? 'a why' : `a ${k}`} is not written`)
  return `(verdict (run ${str(String(v.run))}) (step ${num(v.step)}) (check ${str(v.check)}) (by ${str(String(v.by || 'code'))}) (action ${str(v.action)})` +
         ` (detail ${str(String(v.detail ?? '').slice(0, 200))}) (why ${str(String(v.why).slice(0, 200))}) (at ${str(String(v.at || '-'))}) (t ${num(v.t)})` +
         `${v.met || v.side ? ` (met ${str(String(v.met || 'none'))}) (side ${str(String(v.side || 'none'))})` : ''})\n`
}

/** Read one verdict row back, field by field (the one reader; the tailer and the tests use it). Throws one sentence. */
export function readVerdict(line) {
  try { return readRow(line, 'verdict', VERDICT_FIELDS) } catch { return readRow(line, 'verdict', VERDICT_P7_FIELDS) }   // a P7 row has met and side
}

/** Append one verdict row through the host's ledger. A ledger that refuses is noted on the worker, never a crash. */
export function appendVerdict(sup, w, v) {
  const text = verdictLine(v)
  try { sup.host.ledger?.(text) } catch (e) { w.ledgerError = String(e && e.message ? e.message : e).slice(0, 200) }
  return text
}

// ── the handoff record (ROLEBENCH §5.3) ──────────────────────────────────────────────────────────────────────────────
export const HANDOFF_FIELDS = Object.freeze(['from', 'to', 'step', 'why', 'partial', 'at', 't'])

/**
 * One handoff as text: `(handoff (from "e4b") (to "12b"|"queue") (step n) (why "…") (partial <data>) (at "lacuna:/…") (t s))`,
 * written by the mind that stops or the router that refuses; the next rung reads `partial` (data: what was done so far).
 * @param {{from: string, to: string, step: number, why: string, partial?: *, at: string, t: number}} h
 * @returns {string}
 */
export function handoffLine(h) {
  for (const k of ['from', 'to', 'why']) if (!String(h[k] ?? '').trim()) throw new Error(`a handoff without ${k === 'why' ? 'a why' : `its ${k}`} is not written`)
  return `(handoff (from ${str(String(h.from))}) (to ${str(String(h.to))}) (step ${num(h.step)}) (why ${str(String(h.why).slice(0, 200))})` +
         ` (partial ${writeData(h.partial ?? null)}) (at ${str(String(h.at || '-'))}) (t ${num(h.t)}))\n`
}

/** Read one handoff back, field by field. Throws one sentence. */
export function readHandoff(line) {
  return readRow(line, 'handoff', HANDOFF_FIELDS)
}

/** Append one handoff record; the row rides back to the caller (the router attaches it to the next rung's brief). */
export function appendHandoff(sup, w, h) {
  const row = { ...h, at: h.at || print(coordinateOf(sup, w, { step: h.step })), t: h.t ?? sup.host.now() }
  const text = handoffLine(row)
  try { sup.host.ledger?.(text) } catch (e) { w.ledgerError = String(e && e.message ? e.message : e).slice(0, 200) }
  sup.host.upstream?.('handoff', w, { from: row.from, to: row.to, step: row.step, why: row.why, at: row.at })
  return row
}

function readRow(line, head, fields) {
  const [whole, ...rest] = readForms(String(line))
  // a chained row's last field is its `(prev "sha256:…")` (ledger-chain.mjs): the chain's, not the row's
  const last = Array.isArray(whole) ? whole.at(-1) : null
  const f = Array.isArray(last) && String(last[0]) === 'prev' ? whole.slice(0, -1) : whole
  if (rest.length || !Array.isArray(f) || String(f[0]) !== head || f.length !== fields.length + 1)
    throw new Error(`a ${head} row is (${head} ${fields.map((k) => `(${k} …)`).join(' ')})`)
  const o = {}
  fields.forEach((k, i) => {
    const x = f[i + 1]
    if (!Array.isArray(x) || x.length !== 2 || String(x[0]) !== k) throw new Error(`field ${i + 1} of a ${head} row is (${k} …)`)
    o[k] = dataToJson(x[1])
  })
  return o
}
