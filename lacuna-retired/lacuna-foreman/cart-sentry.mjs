// cart-sentry.mjs — THE CART DEVICE (SENTRY-2.0 unit 3.0: one of the two attachments calling the same checks; work order
// O11; CART-MODE-1.0 §4). Owns: watching every living cart run from its header and its steps, code first: (1) progress — a
// step that has not moved past the header's step deadline (default STEP_S) is kicked once, and at the second miss the run
// is stopped as abandoned at that step; (2) evidence — a step marked done whose line carries no ticket or result is a claim
// without a receipt ("if a step is done, then a ticket closed it"); (3) scope — an agent sent with the cart asking for an op
// outside the header or a file outside its `touches` is refused before it reaches the hands (sentry/fence.mjs); (4) the
// end — a cart that stops without `(done …)` and without a stop reason is recorded abandoned; (5) loop — the last LOOP_N
// steps identical is kicked once and stopped at the next identical step; (6) runaway — more steps than the header's
// `(max-steps n)` is kicked once, then stopped. Every finding is one verdict row (sentry/verdicts.mjs) with its why; the
// device is attached on the first sweep that sees the cart. Refuses: to correct a record (it detects; the foreman's
// done-check writes pass, law 6); to stop a run while in shadow (the would-stop is written, nothing is sent: SENTRY §8); to
// judge content (the work device's, by domain). Implements: SENTRY-2.0 §8 (code stops: progress, loop, runaway, scope on
// carts), unit 3.0; O11; CART-MODE-1.0 §4 rows "claim without receipt" and "a diff touching files the cart did not declare".
// Invariants (§18): "if a step is done, then a ticket closed it"; "in shadow, nothing leaves the record". Faults (§16):
// F-02 (an op outside the header, exit 12); F-03 (no progress, a loop, a runaway: the kick).
import { createHash } from 'node:crypto'
import { verdict } from './sentry/verdicts.mjs'
import { scope } from './sentry/fence.mjs'
import { attachSentry } from './sentry.mjs'
import { kick } from './kick.mjs'
import { check as checkEv } from './phase.mjs'

export { inTouches } from './sentry/fence.mjs'

/**
 * K7 deterministic cart step replay hash: SHA-256 chain over the run id and ordered step actions.
 * @param {string} runId
 * @param {Array<{name?: string, status?: string}>} steps
 * @return {string}
 */
export function stepReplayHash(runId, steps = []) {
  const h = createHash('sha256').update(String(runId || ''))
  for (const s of steps) h.update(`|${s.name || ''}:${s.status || ''}:${s['ticket'] || ''}`)
  return h.digest('hex').slice(0, 16)
}

/** Seconds a cart step may sit without progress before the kick (a header's `(deadlines . ((step . n)))` wins). */
export const STEP_S = 600
/** Kicks before the stop. */
export const MISSES = 2
/** Identical steps in a row that make a loop. */
export const LOOP_N = 4
/** Steps a run may take before it is a runaway (a header's `(max-steps n)` wins). */
export const MAX_STEPS = 200
/** Verdict rows kept on a cart (the sentry state keeps its own ring too). */
export const KEPT = 24

const EVIDENCE = /\b(t-\d+|tk-[0-9a-f]{4,}|i-\d+|rc-\d+|exit \d+|ticket|receipt|result|\d+ (files?|rows?|lines?|bytes?|GB|MB))\b/i

/**
 * May an agent sent with this cart do `op` on `files`? Code, before the hands (scope check 3; sentry/fence.mjs).
 * @param {{cart: object}} w the cart's worker
 * @param {{op: string, files?: string[]}} intent
 * @returns {{ok: boolean, exit?: number, fault?: string, why?: string}}
 */
export function checkIntent(w, intent) { return scope(w, intent) }

/**
 * A cart's stall budget, the seconds a step may sit (E14 row 11; records-06): the header's `(deadlines (step . n))` when it
 * names one; else twice the cart's own shortest `every` tick, never under STEP_S (a cart that reads once an hour stalls at
 * 2 h, not at 10 min: 547 `would-stop` rows for the weekly memory audit, 482 for the hourly forge steward). `said` names
 * which, for the verdict's why.
 * @param {{cart: object, timers?: Array}} w
 * @returns {{limit: number, said: string}}
 */
export function stepBudget(w) {
  const named = Number(w.cart?.deadlines?.step)
  if (named > 0) return { limit: named, said: 'the header names it' }
  const ticks = (w.timers || []).filter((t) => t.spec?.verb === 'every').map((t) => Number(t.spec.seconds)).filter((n) => n > 0)
  const tick = ticks.length ? Math.min(...ticks) : null
  if (tick && 2 * tick > STEP_S) return { limit: 2 * tick, said: `twice its ${tick} s tick` }
  return { limit: STEP_S, said: 'the default' }
}

/** One verdict row on the cart (its own ring, for the artifact) and the ledger row through the one writer. */
function row(sup, w, check, action, detail, why) {
  const c = w.cart
  const v = verdict(sup, w, { check, action, detail, why, by: 'code' })
  ;(c.sentry_rows ||= []).push({ check, action, detail: v.detail, at: v.t })
  if (c.sentry_rows.length > KEPT) c.sentry_rows.shift()
  return { run: w.id, cart: c.name, check, action, detail: v.detail, why: v.why, at: v.t }
}

/**
 * One pass over the living carts (progress and evidence).
 * @param {object} sup the supervisor
 * @param {{shadow?: boolean}} [o] in shadow the stop is only written
 * @returns {Array<object>} the verdicts of this pass
 */
export function cartSweep(sup, o = {}) {
  const now = sup.host.now()
  const out = []
  for (const w of sup.living()) {
    const c = w.cart
    if (!c || c.outcome || w.state !== 'running') continue
    if (!w.sentry?.attached) attachSentry(sup, w, { device: 'cart', domain: 'cart', seat: 'label', periodS: sup.alive?.sweep ?? null })
    const before = out.length
    const { limit, said } = stepBudget(w)
    const last = c.progressAt ?? c.started ?? now
    const curStep = c.steps.at(-1)?.name || 'start'
    c.replay_hash = stepReplayHash(w.id, c.steps)
    c.promise_lease = { key: `cart:${c.name}:${curStep}`, worker: w.id, state: 'working', expiresAt: Math.round(now + Math.min(60, limit)) }
    if (now - last > limit) {
      c.sentry_misses = (c.sentry_misses || 0) + 1
      const at = c.steps.at(-1)?.name || 'the start'
      const why = `no step since ${at} for ${Math.round(now - last)} s (the step deadline is ${limit} s: ${said})`
      if (c.sentry_misses < MISSES) {
        out.push(row(sup, w, 'no-progress', 'kick', `no step since ${at} for ${Math.round(now - last)} s`, why))
        c.progressAt = now
        kick(sup, w, { category: 'no-progress', text: why, by: 'cart-sentry.mjs', evidence: { step: at }, event: { why: 'no progress', step: at } })
      } else if (o.shadow) {
        out.push(row(sup, w, 'no-progress', 'would-stop', `abandoned at ${at} (shadow: nothing sent)`, `${why}, kicked once; in shadow the stop is written only`))
        c.progressAt = now
      } else {
        out.push(row(sup, w, 'no-progress', 'stop', `abandoned at ${at}`, `${why}, kicked once`))
        sup.stop(w.id, `stopped by the cart sentry: abandoned at ${at} (no progress in ${limit} s, kicked once)`, { stall: true })
      }
    }
    if (w.state === 'running') out.push(...shapeChecks(sup, w, c, now, o))
    for (const s of c.steps) {
      if (s.status !== 'done' || s.sentried || s.name === 'done' || s.name === 'load') continue
      s.sentried = true
      if (s.ticket || s.receipt !== undefined || EVIDENCE.test(s.why || '')) continue
      // ONE NOTE PER FINDING PER RUN (2026-10-27: a looping cart wrote the same note every minute, each loop a new step): the same
      // step name with the same words is noted once in a run; a new reason is noted again
      const key = `${s.name}|${s.why || ''}`; if (!(c.noted instanceof Set)) c.noted = new Set(Array.isArray(c.noted) ? c.noted : []); if (c.noted.has(key)) continue; c.noted.add(key)   // a run brought back from its checkpoint carries `noted` as a list or an object (2026-10-27: TypeError, the foreman crash-looped)
      out.push(row(sup, w, 'claim-without-receipt', 'note', `step ${s.name} is done with no ticket or result: "${s.why || ''}"`, `the step row ${s.name} says done and names no ticket, receipt or result`))
    }
    if (out.length > before) checkEv(sup, w, { kind: 'control', n: out.length - before, by: 'code' })   // SENTRY-2.0 §7: a sweep that produced ≥ 1 row
  }
  return out
}

/** Loop and runaway (checks 5 and 6): kick once, then stop (written only in shadow). */
function shapeChecks(sup, w, c, now, o) {
  const out = []
  const tail = c.steps.slice(-LOOP_N)
  const looping = tail.length === LOOP_N && tail.every((s) => s.name === tail[0].name && (s.why || '') === (tail[0].why || ''))
  const max = Number(c['max-steps'] ?? c.maxSteps) || MAX_STEPS
  const finding = looping ? ['loop', `${LOOP_N} identical steps: ${tail[0].name} "${String(tail[0].why || '').slice(0, 60)}"`, `the last ${LOOP_N} steps are one step repeated`]
    : c.steps.length > max ? ['runaway', `${c.steps.length} steps, over the ${max} allowed`, `the run took ${c.steps.length} steps; the header allows ${max}`] : null
  if (!finding) return out
  const [check, detail, why] = finding
  const seenAt = (c.shape_seen ||= {})[check]
  if (seenAt === undefined) {
    c.shape_seen[check] = c.steps.length
    out.push(row(sup, w, check, 'kick', detail, why))
    kick(sup, w, { category: check, text: detail, by: 'cart-sentry.mjs', evidence: { step: tail.at(-1)?.name }, event: { why: check, step: tail.at(-1)?.name } })
  } else if (c.steps.length > seenAt) {   // it went on the same way after the kick
    if (o.shadow) { c.shape_seen[check] = c.steps.length; out.push(row(sup, w, check, 'would-stop', `${detail} (shadow: nothing sent)`, `${why}, kicked once; in shadow the stop is written only`)) }
    else { out.push(row(sup, w, check, 'stop', detail, `${why}, kicked once`)); sup.stop(w.id, `stopped by the cart sentry: ${check} (${detail}), kicked once`, { stall: true }) }
  }
  return out
}

/**
 * The end check, when a cart stops (scope check 4): no `(done …)` and no stated reason is an abandoned run.
 * @param {object} sup
 * @param {object} w
 * @param {string} [why] the stop's reason
 * @returns {object|null} the verdict, or null when the end was clean or stated
 */
export function endCheck(sup, w, why = '') {
  const c = w.cart
  if (!c || c.outcome === 'done') return null
  if (String(why || '').trim()) return null
  const at = c.steps.at(-1)?.name || 'the start'
  return row(sup, w, 'ended-unstated', 'note', `the cart stopped without (done …) or a reason at ${at}`, `the cart ended at ${at} with no (done …) and no stop reason: an abandoned run`)
}
