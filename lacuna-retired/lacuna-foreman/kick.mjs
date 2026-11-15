// kick.mjs — THE KICK RULE, by promise id, and THE ONE KICK WRITER. Owns: one sweep over every running run: a promise past
// its deadline gets one kick — the event (on 'kick ((promise id) (text …) (missed n))) to the run and a `kick` row on the
// contract, deadline extended once by the same span; a second miss ends the run with exit 99 (stalled) and a letter to
// Claude's mailbox; a run past its hop deadline with no intent ends the same way; `kick()`, the one writer every sentry
// check kicks through (the contract row, the event to the run, the bus, the contract re-rendered). Refuses: to kick a run
// that is not running, to kick the same promise twice, to extend a deadline more than once, a kick in shadow (the caller
// writes a would-kick verdict instead and never calls here). Implements: LACUNA-3.0-DESIGN §9.2 (the kick rule), §17
// (exit 99); SENTRY-2.0 §8 (one writer). Invariants (§18): "a promise is kicked by its id, never by its text"; "no kick
// without a verdict or a promise row behind it". Faults (§16): F-03 (a promise missed twice), F-06 (no intent by the hop
// deadline, exit 99).
import { symOf } from './scheme.mjs'
import { contractExit, EXIT, KICKS_KEPT, renderContract } from './contract.mjs'
import { think } from './talk.mjs'
import { sendMail } from './mail.mjs'

/** A filed run no brain has taken yet (no hop) may wait this long for a driver before F-06; the hop deadline rules from the first intent on. */
export const UNCLAIMED_S = 3600
/** One kick row on the contract, the ring kept at KICKS_KEPT (U1 2026-10-24: a long run's kicks grew the list and every checkpoint). */
const kickRow = (w, row) => { const k = w.contract.kicks; k.push(row); if (k.length > KICKS_KEPT) k.splice(0, k.length - KICKS_KEPT) }
const letter = (sup, w, subject, body) => sendMail(sup, w, { kind: 'self-report', severity: 'stuck', what: subject, evidence: { detail: body, exit: w.contract.exit, fault: body.slice(0, 4) }, asks: 'a person decides' })

/**
 * One kick, written once: a `kick` row on the contract (category, evidence, by), the event to the run when it listens,
 * the bus's `kick`, the contract re-rendered. The sentries, the cart sentry and the semantics checks kick through here.
 * @param {object} sup
 * @param {object} w the run or cart
 * @param {{category: string, text: string, by?: string, evidence?: object, event?: object}} o `event` is what the run's
 *   `(on 'kick …)` hears (default: `{promise: null, text, missed: 1, kind: category}`)
 * @returns {{category: string, text: string}}
 */
export function kick(sup, w, { category, text, by = 'kick.mjs', evidence = {}, event = null }) {
  const now = sup.host.now()
  if (w.contract) kickRow(w, { verdict: 'kick', category, evidence: { ...evidence, now }, by })
  think(w, 'state', `kick: ${text}`, now)
  if (w.handlers?.has('kick')) sup.send(w.id, 'kick', event || { promise: null, text, missed: 1, kind: category })
  sup.host.upstream?.('kick', w, { kind: category, text, missed: event?.missed ?? 1 })
  if (w.contract) sup.host.contract?.(w, renderContract(w.contract))
  return { category, text }
}

/** One pass. Call it after `sup.sweep()` on the same interval. → the ids kicked and the runs ended, for the log. */
export function kickSweep(sup) {
  const now = sup.host.now()
  const out = { kicked: [], ended: [] }
  for (const w of [...sup.workers.values()]) {
    if (w.state !== 'running' || !w.contract) continue
    for (const p of w.contract.promises) {
      if (p.state !== 'open' || now < p.deadline_at) continue
      if (p.kicks === 0) {
        p.kicks = 1
        p.deadline_at = now + Math.max(1, p.deadline_at - p.made_at)
        kickRow(w, { verdict: 'kick', category: 'deadline', evidence: { promise: p.id, deadline: p.deadline_at, now }, by: 'kick.mjs' })
        think(w, 'state', `kick: promise ${p.id} (${p.text.slice(0, 80)}) is late`, now)
        if (w.handlers.has('kick')) sup.send(w.id, 'kick', { promise: p.id, text: p.text, missed: 1, ticket: p.ticket ? symOf(p.ticket) : null })
        sup.host.contract?.(w, renderContract(w.contract))
        out.kicked.push({ run: w.id, promise: p.id })
        continue
      }
      p.state = 'broken'
      kickRow(w, { verdict: 'kick', category: 'second-miss', evidence: { promise: p.id, deadline: p.deadline_at, now }, by: 'kick.mjs' })
      end(sup, w, now, `stalled: promise ${p.id} missed twice`, `F-03: promise ${p.id} "${p.text}" missed its deadline twice`)
      out.ended.push({ run: w.id, why: 'F-03', promise: p.id })
      break
    }
    const unclaimed = w.run && !(w.run.hops > 0) && now - w.awaiting?.since < UNCLAIMED_S   // 2026-10-24: six queued runs stalled behind two drivers
    if (w.state === 'running' && w.awaiting && now >= w.awaiting.due && !unclaimed) {
      end(sup, w, now, 'stalled: no intent by the hop deadline', `F-06: no intent for ${Math.round(now - w.awaiting.since)} s (${w.run?.intensity || 'normal'})`)
      out.ended.push({ run: w.id, why: 'F-06' })
    }
  }
  return out
}

function end(sup, w, now, why, body) {
  think(w, 'state', why, now)
  if (w.contract.exit == null) contractExit(sup, w, EXIT.STALLED, 'fail')
  letter(sup, w, `${w.name}: ${why}`, body)
  delete w.awaiting
  sup.stop(w.id, why, { state: 'stalled', stall: true })
}
