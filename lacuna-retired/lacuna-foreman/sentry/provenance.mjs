// sentry/provenance.mjs — THE PROVENANCE CHAIN (SENTRY-2.0 §4, unit 3.3). Owns: the five links of authority — authority →
// work order → run → step → call — built from the worker's own records at a call, each link carrying the hash of the one
// before (`chain`), the walk that checks them (`verify`), and the checks at a call that a broken link is the red light
// for: a result with no open ticket (`no-ticket`), a receipt whose touched set leaves the run's `touches` (`outside-touches`,
// the run stops as I-03 does today), a run filed as work with no order behind it (`no-order`), a ticket of a past generation
// (`stale-gen`, the ghost guard's twin on the ticket). Refuses: any decision on the coordinate (the address locates; the
// chain authorizes); a model (table lookups only); a link it cannot build (missing records are a broken link, never a
// guess). Implements: SENTRY-2.0 §4 ("authority is the chain, never the address"), §8; design §45.3 (the ticket), law 6.
// Invariants (§18): "if an act ran, a ticket preceded it"; "every link names the hash of the one before". Faults (§16):
// F-02 (a call refused by provenance, exit 12).
import crypto from 'node:crypto'
import { writeData } from '../../../lacuna-scheme/src/slat-data.js'
import { verdict } from './verdicts.mjs'
import { inTouches } from './fence.mjs'

/** The five links, in order. */
export const LINKS = Object.freeze(['authority', 'order', 'run', 'step', 'call'])

const sha = (text) => `sha256:${crypto.createHash('sha256').update(text, 'utf8').digest('hex')}`
const list = (xs) => (xs instanceof Set ? [...xs] : Array.isArray(xs) ? xs : []).map(String)

/** The principal behind a run: who filed it and by what right (SENTRY-2.0 §4 link 1). */
export function authorityOf(w, t = null) {
  const by = String(w.by || '')
  const kind = t?.pressed ? (t.pressed.by === 'standing' ? 'standing' : 'press') : by === 'work-order' ? 'order'
    : /^owner\b|^desk\b|^alfred$/i.test(by) ? 'owner' : /^w-/.test(by) || w.cart ? 'schedule' : by === 'brain' ? 'owner' : 'none'
  return { kind, principal: t?.pressed?.by || by || null }
}

/**
 * The five links as data, from the worker's records at ticket `t` (null before a ticket exists).
 * @param {object} sup
 * @param {object} w the run
 * @param {?object} t the ticket (alive.mjs's pending row)
 * @param {?object} [value] the receipt, when one landed
 * @returns {Object<string, object>} link name → data
 */
export function links(sup, w, t = null, value = null) {
  const c = w.contract || {}
  const checkout = (w.run?.results || []).find((r) => r.tool === 'checkout')?.value?.rows || null
  return {
    authority: { ...authorityOf(w, t), at: w.started ?? null },
    order: { id: c.wo != null ? `wo-${c.wo}` : null, key: c.key ?? null, goal: String(c.goal || '').slice(0, 200), repo: w.run?.repo ?? null, role: w.run?.role ?? null },
    run: { id: w.id, touches: list(w.run?.touches), hands: list(w.run?.hands), acts: list(w.run?.acts), done: String(c.done_check || '').slice(0, 200),
           brain: c.brain ?? null, checkout: checkout ? { dir: checkout.dir ?? null, branch: checkout.branch ?? null } : null, gen: w.gen || 1 },
    step: { k: c.latch?.k ?? c.step ?? 0, allows: c.latch ? list(c.latch.steps?.[c.latch.k - 1]?.allows) : null, sha: c.latch?.allows_sha ?? null },
    call: t ? { ticket: t.ticket, op: t.op, kind: t.kind, deadline_at: t.deadline_at ?? null, at: t.at ?? null, gen: t.gen ?? null,
                receipt: value ? { exit: value.exit ?? null, touched: list(value.touched), sha: value.sha ?? null } : null } : null,
  }
}

/**
 * The chain: each link's hash covers its data and the hash of the link before (`prev`; the first is "genesis").
 * @returns {Array<{link: string, data: object, prev: string, hash: string}>}
 */
export function chain(sup, w, t = null, value = null) {
  const l = links(sup, w, t, value)
  const out = []
  let prev = 'genesis'
  for (const name of LINKS) {
    const data = l[name]
    const hash = sha(writeData({ link: name, data, prev }))
    out.push({ link: name, data, prev, hash })
    prev = hash
  }
  return out
}

/**
 * Walk a chain: every link's hash recomputes from its data and its `prev`, and every `prev` is the hash before it. A link
 * with no data (a call before its ticket, an order a work run lacks) is broken too.
 * @param {Array<{link: string, data: object, prev: string, hash: string}>} ch
 * @returns {{ok: boolean, broken: ?string, why: ?string}}
 */
export function verify(ch) {
  let prev = 'genesis'
  for (let i = 0; i < LINKS.length; i++) {
    const x = ch[i]
    if (!x || x.link !== LINKS[i]) return { ok: false, broken: LINKS[i], why: `link ${i + 1} is ${LINKS[i]}, not ${x?.link ?? 'missing'}` }
    if (x.prev !== prev) return { ok: false, broken: x.link, why: `${x.link} names prev ${String(x.prev).slice(0, 20)}, not the ${i ? LINKS[i - 1] : 'genesis'} hash` }
    if (sha(writeData({ link: x.link, data: x.data, prev })) !== x.hash) return { ok: false, broken: x.link, why: `${x.link}'s hash does not match its data` }
    if (x.data == null) return { ok: false, broken: x.link, why: `${x.link} has no record behind it` }
    prev = x.hash
  }
  return { ok: true, broken: null, why: null }
}

/**
 * The checks at a call (table lookups; a broken link is red). `phase` is `intent` (before the ticket) or `result` (the
 * receipt landed on ticket `t`, or on none).
 * @param {object} sup
 * @param {object} w
 * @param {{phase: 'intent'|'result', t?: ?object, value?: ?object, op?: string}} o
 * @returns {{ok: boolean, why?: string, check?: string, verdicts: Array<object>}}
 */
export function checkCall(sup, w, o) {
  const out = []
  const red = (check, action, detail, why, letter = true) => { out.push(verdict(sup, w, { check, action, by: 'code', detail, why, call: o.t?.call ?? null, letter })); return { ok: false, why, check, verdicts: out } }
  if (o.phase === 'intent') {
    if (String(w.by || '') === 'work-order' && (w.contract?.wo == null)) {
      return red('no-order', 'refuse', `${o.op || 'a call'} on a run filed as work with no order`, `the run was filed by the work-order road but its key names no wo-NNNNNN: no order link (SENTRY-2.0 §4)`)
    }
    return { ok: true, verdicts: out }
  }
  const t = o.t, v = o.value || {}
  if (!t && v.ticket != null) return red('no-ticket', 'refuse', `${v.op || 'a result'} ${v.ticket}`.trim(), `a result landed for ticket ${v.ticket} and no open ticket matches it: an act with no open ticket is a broken call link`)
  if (!t) {   // a reply that names no ticket (a press's answer carries the op only): it lands at the current position and closes no step
    out.push(verdict(sup, w, { check: 'no-ticket', action: 'note', by: 'code', detail: `${v.op || 'a reply'} named no ticket`, why: 'the reply named no ticket: it lands at the current position and marks no step done' }))
    return { ok: true, verdicts: out }
  }
  if (t.gen != null && Number(t.gen) !== (w.gen || 1)) {
    return red('stale-gen', 'refuse', `ticket ${t.ticket} gen ${t.gen}, the run is gen ${w.gen || 1}`, `the ticket was issued to generation ${t.gen}; the run is generation ${w.gen || 1} (a restart): a ticket dies with its generation`)
  }
  const touches = list(w.run?.touches ?? w.cart?.touches)
  const touched = list(v.touched)
  if (touches.length && touched.length) {
    const outside = touched.filter((f) => !inTouches(f, touches))
    if (outside.length) return red('outside-touches', 'stop', outside.slice(0, 3).join(', '), `the hand wrote outside the run's touches (${outside.slice(0, 3).join(', ')}): the jail or the touches are wrong (I-03)`, false)   // I-03's own letter carries the ticket
  }
  return { ok: true, verdicts: out }
}
