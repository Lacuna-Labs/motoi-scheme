// contract.mjs — THE CONTRACT (the foreman's side). Owns: one (task-state …) per run, kept on the worker (`w.contract`),
// carried in its checkpoint, rendered as bare slat text for the hands daemon to write to runs/<run>/CONTRACT.slat and for
// GET /contracts/<run>; the optional `(stops …)` rows of a pausable job (F2: pause · park · resume); the six exit codes and
// the four outcomes; the field check that reads a contract back; the run's coordinate (`coordinateOf`: the box, the foreman's
// service number, the work order and run index fixed at filing, the generation, the step, the call) stamped as `(at …)` on
// the rendered form; the `why` a run ends with (ROAD category 2 ruling 5: failed term · last step · last sentence ≤ 200 chars).
// Refuses: a write by anything but the foreman (a worker program has no verb for it — the single-writer rule), an exit code
// outside the six, an outcome outside the four, `pass` without the done-check's word. Implements: LACUNA-3.0-DESIGN §6 change 3
// and change 5, §7.4, §8, §17; LACUNA-SENTRY-2.0 §4 (the coordinate on every run row); ROAD category 6 unit 6.1. Invariants
// (§18): "if a step is done, a ticket closed it"; "if swapped-at is set, the next step started on the new brain from the
// contract". Faults (§16): F-12 (a step marked done by a report line).
import { parse, Sym } from './scheme.mjs'
import { latchData, latchFromData } from './latch.mjs'
import { toSlat, fromSlat } from './protocol.mjs'
import { coordinate, print, SERVICES } from './coordinate.mjs'
import { stepRow } from './phase.mjs'   // the one step writer puts run.step on the bus; phase.mjs reads coordinateOf back from here (an import cycle used only inside functions)

/** The six exit codes (design §17). A hand's own process status is `result.status`, never one of these. */
export const EXIT = Object.freeze({ DONE: 0, REFUSED: 12, DEADLINE: 15, CRASH: 30, MEMORY: 89, STALLED: 99 })
export const EXITS = new Set(Object.values(EXIT))
/** The four outcomes (design §6 change 5): `pass` only by the foreman's done-check. */
export const OUTCOMES = Object.freeze(['pass', 'fail', 'stopped', 'waiting-owner'])
export const STATES = Object.freeze(['filed', 'running', 'waiting-owner', 'paused', 'done', 'failed', 'stalled'])
/** Rows kept on a contract: steps, promises, and the kick records written to the file. */
export const STEPS_KEPT = 200, PROMISES_KEPT = 32, KICKS_KEPT = 32, STOPS_KEPT = 32

/**
 * Open a run's contract on its worker. Called once at spawn (a cart's header seeds goal and done-check) or at `file`.
 * @param {object} w the worker that is the run
 * @param {{goal?: string, doneCheck?: string, key?: string, cart?: string|null, brain?: string}} o
 * @returns {object} the contract
 */
export function openContract(w, o = {}) {
  w.contract = {
    v: 1, run: w.id, key: o.key || null, cart: o.cart ?? (w.cart ? w.cart.name : null),
    goal: String(o.goal ?? w.cart?.does ?? ''), done_check: String(o.doneCheck ?? w.cart?.done ?? ''),
    state: 'filed', step: 0, steps: [], promises: [], last_result: null, brain: o.brain || null, swapped_at: null,
    exit: null, outcome: null, kicks: [], provenance: { fact: null, episode: null, decision: null },
    // the coordinate's fixed fields (SENTRY-2.0 §4; category 6): the order's number from the key `wo:wo-NNNNNN` (null under no
    // order), the run's index within it (the attempt), else its slot in the foreman's table; `why` is written at the end
    wo: woOf(o.key), run_index: Number.isInteger(o.attempt) && o.attempt > 0 ? o.attempt : Math.min(65535, Number(w.slot) || 0), why: null, at: null,
  }
  return w.contract
}

/** The work order's number out of a run key (`wo:wo-273615` or an eval order's `wo:eval:wo-273615` → 273615), or null when the
 *  key names no order. */
export function woOf(key) {
  const m = /^wo:(?:eval:)?wo-(\d{1,10})$/.exec(String(key || ''))
  return m && Number(m[1]) <= 4294967295 ? Number(m[1]) : null
}

/**
 * The run's coordinate (SENTRY-2.0 §4): box from the host (1 until box.slat carries a number), the foreman's service number,
 * the order and the run index from the contract, the generation from the worker, the step from the latch (else the contract's
 * row count), the call from the caller. Pure over its inputs; never a decision.
 * @param {object} sup the supervisor (its host may answer `box()`)
 * @param {object} w the worker that is the run
 * @param {{step?: ?number, call?: ?number}} [o]
 * @returns {object} a coordinate (coordinate.mjs)
 */
export function coordinateOf(sup, w, o = {}) {
  const c = w.contract || {}
  const step = o.step ?? c.latch?.k ?? c.step ?? null
  return coordinate({ box: Number(sup.host.box?.() ?? 1), service: SERVICES.foreman, wo: c.wo ?? null, run: c.run_index ?? null,
                      gen: Math.min(255, Number(w.gen) || 1), step: step == null ? null : Math.min(65535, Number(step)), call: o.call ?? null })
}

const now = (sup) => sup.host.now()
/** Every write refreshes the run's `at` (the generation and the step move) before the form is rendered. */
const stamp = (sup, w) => { if (w.contract) w.contract.at = print(coordinateOf(sup, w)) }

/** A step row, written only here. `status`: running · done · failed · skipped. A `done` row names its ticket (F-12). */
export function contractStep(sup, w, status, text, ticket = null) {
  const c = w.contract
  if (!c) return null
  if (status === 'done' && !ticket) throw new Error('F-12: a step is done only when a ticket closed it')
  c.step += 1
  c.steps.push({ n: c.step, status, text: String(text).slice(0, 240), ticket, at: now(sup) })
  if (c.steps.length > STEPS_KEPT) c.steps.splice(0, c.steps.length - STEPS_KEPT)
  if (c.state === 'filed') c.state = 'running'
  stamp(sup, w)
  sup.host.contract?.(w, renderContract(c))
  stepRow(sup, w, c.steps.at(-1))                        // SENTRY-2.0 §7: run.step
  return c.step
}

/** Record a promise (from an intent's `promise` field, or a `said`). → its id. */
export function contractPromise(sup, w, text, deadlineS, ticket = null) {
  const c = w.contract
  if (!c) return null
  const last = c.promises.at(-1)                        // ids rise past the 32-row ring: `length + 1` repeated p-33 (2026-10-24, U2)
  const id = `p-${last ? Number(last.id.slice(2)) + 1 : 1}`
  c.promises.push({ id, text: String(text).slice(0, 240), state: 'open', ticket, made_at: now(sup), deadline_at: now(sup) + Math.max(1, Number(deadlineS) || 60), kicks: 0 })
  if (c.promises.length > PROMISES_KEPT) c.promises.splice(0, c.promises.length - PROMISES_KEPT)
  sup.host.contract?.(w, renderContract(c))
  return id
}

/** A promise's ticket arrived, or it was kept, broken, or kept after a kick. */
export function contractResolve(sup, w, promiseId, state, ticket = null) {
  const p = (w.contract?.promises || []).find((x) => x.id === promiseId)
  if (!p) return false
  if (ticket) p.ticket = ticket
  if (state) p.state = state
  sup.host.contract?.(w, renderContract(w.contract))
  return true
}

/** The last result (a hand's or act's reply), bounded. */
export function contractResult(sup, w, result) {
  const c = w.contract
  if (!c) return
  c.last_result = bound(result, 4000)
  sup.host.contract?.(w, renderContract(c))
}

/** The broker swapped the brain: the next step resumes from the contract, not the window (§18). */
export function contractSwap(sup, w, brain) {
  const c = w.contract
  if (!c) return
  c.brain = String(brain); c.swapped_at = c.step        // the step at the swap (design §8, R9): the next step starts on the new brain
  sup.host.contract?.(w, renderContract(c))
}

/** Close the run with one of the six codes and one of the four outcomes. `pass` needs `checked = true`; `why` is the run's
 *  reason (category 2 ruling 5), kept on the contract and the run row; a pass carries none. */
export function contractExit(sup, w, exit, outcome, { checked = false, why = null } = {}) {
  const c = w.contract
  if (!c) return
  if (!EXITS.has(exit)) throw new Error(`exit ${exit} is not one of the six (0 12 15 30 89 99)`)
  if (!OUTCOMES.includes(outcome)) throw new Error(`outcome ${outcome} is not one of ${OUTCOMES.join(' ')}`)
  if (outcome === 'pass' && !checked) throw new Error("outcome pass is written only by the foreman's done-check (law 6)")
  if (outcome === 'pass' && exit !== EXIT.DONE) throw new Error(`outcome pass rides only on exit 0, not ${exit}`)
  c.exit = exit; c.outcome = outcome
  if (outcome !== 'pass') c.why = whyOf(c, why)
  // §8: `done` is a pass or a clean stop; a failed done-check on exit 0 is `failed` (corrected 2026-10-23: it read `done`)
  c.state = outcome === 'pass' ? 'done' : outcome === 'waiting-owner' ? 'waiting-owner' : exit === EXIT.STALLED ? 'stalled' : exit === EXIT.DONE && outcome === 'stopped' ? 'done' : 'failed'
  stamp(sup, w)
  sup.host.contract?.(w, renderContract(c))
}

/**
 * The `why` a run ends with (ROAD category 2 ruling 5): the reason given, else the failed term · the last step · the last
 * sentence, ≤ 200 chars. Never empty on a failed run: a row with no reason was the first bug of 1.0 (w-393661).
 * @param {object} c the contract
 * @param {?string} why the caller's reason
 * @returns {string}
 */
export function whyOf(c, why) {
  const given = String(why || '').trim()
  if (given) return given.slice(0, 200)
  const last = c.steps.at(-1)
  const parts = [c.exit != null ? `exit ${c.exit}` : null, last ? `last step ${last.n}: ${last.text}` : 'no step ran']
  return parts.filter(Boolean).join(' · ').slice(0, 200)
}

/** A value cut to fit: strings to `max` chars, lists to 50 items, depth 6; the shape survives, the bulk does not
 *  (2026-10-23: a 'jobs' reply of 30 KB crashed the live foreman through a sliced JSON string). */
export function bound(v, max = 4000, depth = 0) {
  if (v == null || typeof v === 'number' || typeof v === 'boolean') return v
  if (typeof v === 'string') return v.length > max ? v.slice(0, max) + `… (+${v.length - max})` : v
  if (depth > 6) return '…'
  if (Array.isArray(v)) return v.slice(0, 50).map((x) => bound(x, Math.max(80, Math.floor(max / 4)), depth + 1)).concat(v.length > 50 ? [`… (+${v.length - 50})`] : [])
  if (typeof v === 'object') return Object.fromEntries(Object.entries(v).slice(0, 60).map(([k, x]) => [k, bound(x, Math.max(80, Math.floor(max / 4)), depth + 1)]))
  return String(v)
}

// ── the text ─────────────────────────────────────────────────────────────────────────────────────────────────────
const str = (s) => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"'
const opt = (v) => (v == null ? 'null' : typeof v === 'number' ? String(v) : str(v))

/** The bare `(task-state …)` form (design §7.4, §8): never an envelope; signed only when it travels as a kind. The seventeenth
 *  field, `kicks`, is the typed kick record (O-80) on the file itself: the P7 gate reads "≥ 1 kick record" from CONTRACT.slat
 *  (added 2026-10-23; a file without it still reads). */
export function renderContract(c) {
  const steps = c.steps.map((s) => `(${s.n} ${str(s.status)} ${str(s.text)}${s.ticket ? ' ' + str(s.ticket) : ''})`).join(' ')
  const promises = c.promises.map((p) => `(${str(p.id)} ${str(p.text)} ${str(p.state)})`).join(' ')
  return `(task-state (v 1) (run ${str(c.run)}) (key ${opt(c.key)}) (cart ${opt(c.cart)}) (goal ${str(c.goal)}) (done-check ${str(c.done_check)})` +
         ` (state ${str(c.state)}) (step ${c.step}) (steps (${steps})) (promises (${promises})) (last-result ${toSlat(c.last_result ?? null)})` +
         ` (brain ${opt(c.brain)}) (swapped-at ${opt(c.swapped_at)}) (exit ${opt(c.exit)}) (outcome ${c.outcome == null ? 'null' : str(c.outcome)})` +
         ` (provenance ${toSlat(c.provenance || null)}) (kicks ${toSlat((c.kicks || []).slice(-KICKS_KEPT))})` +
         // F2 (2026-10-24): a pausable job's pause · park · resume rows (broker.mjs); written only when there is one, so every other contract keeps its bytes
         `${c.stops?.length ? ` (stops ${toSlat(c.stops.slice(-STOPS_KEPT))})` : ''}` +
         // 1.0 (K1): the run's coordinate and its reason, written when known (a file from before reads without them)
         `${c.at ? ` (at ${str(c.at)})` : ''}${c.why ? ` (why ${str(c.why)})` : ''}` +
         // 1.0 (K1.3): the latch's step over its ladder, written when the run has one (latch.mjs re-reads the step's fields by name)
         `${c.latch ? ` (latch ${toSlat(latchData(c.latch))})` : ''}` +
         // 1.0 (W1.6): the run's mode, written only on break (a run at work keeps its bytes)
         `${c.mode === 'break' ? ' (mode "break")' : ''}` +
         // P4 (the job loop): the jobs' rows, the budget and the owner's stop, written once a job has ended (a run without keeps its bytes)
         `${c.jobs ? ` (jobs ${toSlat(c.jobs)})` : ''})`
}

const FIELDS = ['v', 'run', 'key', 'cart', 'goal', 'done-check', 'state', 'step', 'steps', 'promises', 'last-result', 'brain', 'swapped-at', 'exit', 'outcome', 'provenance']
const OPTIONAL = ['kicks', 'stops', 'at', 'why', 'latch', 'mode', 'jobs']   // kicks since 2026-10-23, stops since 2026-10-24 (F2), at, why and latch since 2026-10-30 (K1), mode since 2026-10-31 (W1.6), jobs since 2026-11-06 (P4); read by name, any may be absent
const word = (x) => (x instanceof Sym ? x.name : x)
const nullable = (x) => { const v = word(x); return v === 'null' ? null : v }   // (key null) reads back as null, never the word "null" (D's finding 2026-10-23)

/** Read a contract back, field by field in its one order (the `readMsg` style). Throws one sentence on the first fault. */
export function readContract(text) {
  const forms = parse(String(text || ''))
  if (forms.length !== 1) throw new Error('a contract is exactly one form')
  const f = forms[0]
  const n = f.length - 1
  if (!Array.isArray(f) || !(f[0] instanceof Sym) || f[0].name !== 'task-state' || n < FIELDS.length || n > FIELDS.length + OPTIONAL.length)
    throw new Error(`a contract is (task-state ${FIELDS.map((k) => `(${k} …)`).join(' ')} [(kicks …)] [(stops …)] [(at …)] [(why …)])`)
  const o = {}
  FIELDS.forEach((name, i) => {
    const x = f[i + 1]
    if (!Array.isArray(x) || x.length !== 2 || !(x[0] instanceof Sym) || x[0].name !== name) throw new Error(`field ${i + 1} must be (${name} …)`)
    o[name] = x[1]
  })
  // the trailing fields by name, in the table's order, each at most once (a file from any date reads)
  let last = -1
  for (const x of f.slice(FIELDS.length + 1)) {
    const i = Array.isArray(x) && x.length === 2 && x[0] instanceof Sym ? OPTIONAL.indexOf(x[0].name) : -1
    if (i < 0 || i <= last) throw new Error(`a contract is (task-state …the ${FIELDS.length} fields…) then ${OPTIONAL.map((k) => `(${k} …)`).join(' ')} in that order, each once`)
    o[x[0].name] = x[1]; last = i
  }
  if (o.v !== 1) throw new Error('contract version 1 only')
  const state = word(o.state); if (!STATES.includes(state)) throw new Error(`state ${state} is not one of ${STATES.join(' ')}`)
  const exit = word(o.exit); if (exit !== 'null' && !EXITS.has(exit)) throw new Error(`exit ${exit} is not one of the six`)
  const outcome = word(o.outcome); if (outcome !== 'null' && !OUTCOMES.includes(outcome)) throw new Error(`outcome ${outcome} is not one of ${OUTCOMES.join(' ')}`)
  return { run: o.run, key: nullable(o.key), cart: nullable(o.cart), goal: o.goal, done_check: o['done-check'], state, step: o.step,
           steps: o.steps.map((s) => ({ n: s[0], status: word(s[1]), text: s[2], ticket: s[3] ?? null })),
           promises: o.promises.map((p) => ({ id: p[0], text: p[1], state: word(p[2]) })),
           last_result: fromSlat(o['last-result']), brain: nullable(o.brain), swapped_at: nullable(o['swapped-at']), exit: exit === 'null' ? null : exit,
           outcome: outcome === 'null' ? null : outcome, provenance: fromSlat(o.provenance), kicks: o.kicks === undefined ? [] : fromSlat(o.kicks),
           stops: o.stops === undefined ? [] : fromSlat(o.stops), at: o.at === undefined ? null : String(o.at), why: o.why === undefined ? null : String(o.why),
           latch: o.latch === undefined ? null : latchFromData(fromSlat(o.latch)), mode: o.mode === undefined ? 'work' : String(word(o.mode)),
           ...(o.jobs === undefined ? {} : { jobs: fromSlat(o.jobs) }) }
}

/** The stop path (supervisor.stop) ends the run: the reason names its code. Idempotent; no-op without a contract. */
export function contractClose(sup, w, why) {
  const c = w.contract
  if (!c || c.exit != null) return
  const s = String(why || '')
  const [exit, outcome] =
    /never answered|hop deadline/.test(s) ? [EXIT.DEADLINE, 'fail'] :
    /stalled|missed heartbeats|missed twice/.test(s) ? [EXIT.STALLED, 'fail'] :
    /buried|crash/.test(s) ? [EXIT.CRASH, 'fail'] :
    /memory|rss/.test(s) ? [EXIT.MEMORY, 'fail'] :
    /refused|may not/.test(s) ? [EXIT.REFUSED, 'fail'] :
    /^done:/.test(s) ? [EXIT.DONE, c.outcome || 'fail'] : [EXIT.DONE, 'stopped']
  c.exit = exit; c.outcome = outcome
  if (outcome !== 'pass') c.why = whyOf(c, s)
  c.state = outcome === 'pass' ? 'done' : exit === EXIT.STALLED ? 'stalled' : outcome === 'stopped' ? 'done' : 'failed'
  stamp(sup, w)
  sup.host.contract?.(w, renderContract(c))
}

/** The contract as DATA for the wire (§7.4): the `(@ …)` object slat-data reads; the file keeps the `(task-state …)` form. */
export function contractData(c) {
  return toSlat({ v: 1, run: c.run, key: c.key, cart: c.cart, goal: c.goal, 'done-check': c.done_check, state: c.state, step: c.step,
    steps: c.steps.map((s) => ({ n: s.n, status: s.status, text: s.text, ticket: s.ticket })), promises: c.promises.map((p) => ({ id: p.id, text: p.text, state: p.state })),
    'last-result': c.last_result ?? null, brain: c.brain, 'swapped-at': c.swapped_at, exit: c.exit, outcome: c.outcome, provenance: c.provenance || null, kicks: c.kicks || [], ...(c.stops?.length ? { stops: c.stops.slice(-STOPS_KEPT) } : {}),
    at: c.at ?? null, why: c.why ?? null, ...(c.latch ? { latch: latchData(c.latch) } : {}) })
}
