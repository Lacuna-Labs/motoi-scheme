// latch.mjs — THE LATCH (lane K1, unit K1.3; SENTRY-2.0 §1–§2 "the step pointer is a latch"). Owns: a run's step pointer over
// its playbook's ladder (`ladder.mjs`): `openLatch` binds step 1 of a ladder to the run's contract (`contract.latch`: the
// playbook, its version, `k`, `n`, the step's `allows`, their hash, its `done`, its `budget`, its sentence); `advanceLatch`
// moves k to k + 1 only when a receipt matches step k's `done` (the op, its exit, its file glob); a receipt that matches a
// later step's `done` before step k is refused as an advance and leaves one `out-of-sequence` row (warn-only in 1.0, as the
// fence); `answerLatch` closes a step whose `done` is `(answer (names …))` when the said names every word; the latch
// persists on the contract (`(latch (@ …))`) and comes back from a checkpoint by its playbook's name and k. Refuses: a step
// closed by a mind's word (only a receipt or a named answer moves k; law 6); a latch on a run with no contract; a ladder it
// cannot load (no latch, one think line, never a throw). Implements: SENTRY-2.0 §2; K1.3; design §45.3 (the ticket carries
// `step` and `allows-sha256` from here, hands-link.mjs). Invariants (design §18): "if a step is done, a receipt closed it".
// Faults (§16): none by id (`out-of-sequence` is a verdict).
import { loadLadder, allowsSha } from './ladder.mjs'
import { verdict } from './sentry/verdicts.mjs'
import { coordinateOf } from './contract.mjs'
import { print } from './coordinate.mjs'
import { think } from './talk.mjs'

const RECALL = /\((?:recall|playbook)\s+([A-Za-z][A-Za-z0-9-]{1,40})\)|\bplaybook\s+([A-Z][A-Z0-9-]{2,40})\b/

/** The playbook a goal names (`(recall WATCHDOG-RED)`, `playbook DISK`), or null. */
export function playbookOf(goal) {
  const m = RECALL.exec(String(goal || ''))
  return m ? (m[1] || m[2]).toUpperCase() : null
}

/** The latch's fields for step k of a ladder (what the contract keeps, what the ticket reads). */
export function stepFields(ladder, k) {
  const s = ladder.steps[k - 1]
  if (!s) return null
  return { allows: [...s.allows], allows_sha: allowsSha(s.allows), done: s.done, budget: s.budget, says: s.says ?? null }
}

/**
 * Bind the run to step `k` (default 1) of a ladder. → the latch, or null when the ladder does not load.
 * @param {object} sup @param {object} w the run @param {string|object} ladder a playbook's name or a read ladder
 */
export function openLatch(sup, w, ladder, { k = 1 } = {}) {
  if (!w.contract) return null
  const l = typeof ladder === 'string' ? safeLoad(ladder) : ladder
  if (!l) { think(w, 'state', `no ladder for ${String(ladder).slice(0, 40)}: the run has no latch`, sup.host.now()); return null }
  const step = Math.min(Math.max(1, Number(k) || 1), l.steps.length)
  w.latchLadder = l
  w.contract.latch = { playbook: l.playbook, version: l.version, k: step, n: l.steps.length, closed: false, since: sup.host.now(), ...stepFields(l, step) }
  think(w, 'state', `latch: ${l.playbook} v${l.version} step ${step} of ${l.steps.length}; allows ${w.contract.latch.allows.join(' ')}`, sup.host.now())
  sup.host.contract?.(w, null)
  return w.contract.latch
}

function safeLoad(name) { try { return loadLadder(name) } catch { return null } }

/** The run's latch with its ladder in memory (re-loaded by name after a checkpoint), or null. */
export function latchOf(w) {
  const c = w.contract
  if (!c?.latch) return null
  if (!w.latchLadder || w.latchLadder.playbook !== c.latch.playbook) {
    w.latchLadder = safeLoad(c.latch.playbook)
    if (w.latchLadder && !c.latch.allows) Object.assign(c.latch, stepFields(w.latchLadder, c.latch.k))
  }
  return w.latchLadder ? c.latch : null
}

/** The step record the latch points at, or null. */
export const currentStep = (w) => (latchOf(w) ? w.latchLadder.steps[w.contract.latch.k - 1] ?? null : null)

const globRe = (g) => new RegExp(`^${String(g).split('**').map((seg) => seg.split('*').map((s) => s.replace(/[.+^${}()|[\]\\?]/g, '\\$&')).join('[^/]*')).join('.*')}$`)
const receiptMatches = (d, r) => d.kind === 'receipt' && d.op === String(r.op || '').toLowerCase() &&
  (d.exit === 'any' || d.exit === (Number.isInteger(r.exit) ? r.exit : 0)) &&
  (!d.file || (r.touched || []).some((f) => globRe(d.file).test(String(f)) || globRe(`**/${d.file}`).test(String(f))))

function moveTo(sup, w, next, how) {
  const c = w.contract
  const l = w.latchLadder
  const was = c.latch.k
  if (next > l.steps.length) { c.latch.closed = true; c.latch.k = l.steps.length; think(w, 'state', `latch: step ${was} of ${l.steps.length} done by ${how}; the ladder is closed`, sup.host.now()) }
  else { Object.assign(c.latch, { k: next, closed: false, since: sup.host.now() }, stepFields(l, next)); think(w, 'state', `latch: step ${was} done by ${how}; step ${next} of ${l.steps.length}, allows ${c.latch.allows.join(' ')}`, sup.host.now()) }
  w.sem = { ...(w.sem || {}), turnsOnStep: 0, circledAt: null }
  c.at = print(coordinateOf(sup, w))                         // the coordinate's step field is the latch's k, from this moment
  sup.host.contract?.(w, null)
  return { advanced: true, from: was, to: c.latch.k, closed: c.latch.closed }
}

/**
 * A receipt landed: step k closes when one of its `done` receipts matches `{op, exit, touched}`; a receipt that closes a later
 * step first is an `out-of-sequence` row and no advance. → `{advanced, from, to, closed}` or `{advanced: false, why}`.
 */
export function advanceLatch(sup, w, r) {
  const latch = latchOf(w)
  if (!latch || latch.closed) return { advanced: false, why: latch ? 'closed' : 'no latch' }
  const l = w.latchLadder
  const step = l.steps[latch.k - 1]
  if (step.done.some((d) => receiptMatches(d, r))) return moveTo(sup, w, latch.k + 1, `a receipt of ${r.op}`)
  const later = l.steps.slice(latch.k).find((s) => s.done.some((d) => receiptMatches(d, r)))
  if (later) {
    verdict(sup, w, { check: 'out-of-sequence', action: 'warn', by: 'code', step: latch.k, why: `a receipt of ${r.op} closes step ${later.n} of ${l.playbook}, but step ${latch.k} is open; the latch does not move` })
    return { advanced: false, why: `step ${later.n} before step ${latch.k}` }
  }
  return { advanced: false, why: `no done of step ${latch.k} names ${r.op}` }
}

/** A said landed: a step whose `done` is `(answer (names …))` closes when the said names every word. */
export function answerLatch(sup, w, said) {
  const latch = latchOf(w)
  if (!latch || latch.closed) return { advanced: false, why: latch ? 'closed' : 'no latch' }
  const low = String(said || '').toLowerCase()
  const step = w.latchLadder.steps[latch.k - 1]
  const d = step.done.find((x) => x.kind === 'answer' && x.names.every((n) => low.includes(String(n).toLowerCase())))
  if (!d) return { advanced: false, why: 'the said names no answer of this step' }
  return moveTo(sup, w, latch.k + 1, `an answer naming ${d.names.join(', ')}`)
}

/** The latch as the contract writes it (the step's fields come back from the ladder). */
export const latchData = (latch) => (latch ? { playbook: latch.playbook, version: latch.version, k: latch.k, n: latch.n, closed: latch.closed ? 1 : 0 } : null)
/** A latch read back from a contract's `(latch …)` field. */
export const latchFromData = (d) => (d && d.playbook ? { playbook: String(d.playbook), version: Number(d.version) || 1, k: Number(d.k) || 1, n: Number(d.n) || 0, closed: Number(d.closed) === 1, since: null } : null)
