// sentry/fence.mjs — THE FENCE, the enable line (SENTRY-2.0 §2, unit 3.0). Owns: membership of a call in the step's
// `allows` (a set; O(1)), where the set comes from (the ladder's step k on a run, the header on a cart, nothing on a desk
// turn), the `out-of-sequence` verdict for a call outside it (warn-only in 1.0: the call still goes, the row says so), the
// scope check a cart's agent meets before the hands (an op outside the header's verbs, hands or acts, or a file outside its
// `touches`: refused by code, exit 12), and the `touches` glob rule. Refuses: to stop a run (the fence records; 1.0's teeth
// are code's own stops in cart-sentry.mjs); to read a mind for a membership question (the 270M locates a prose step,
// locator.mjs; the fence only compares). Implements: SENTRY-2.0 §2 ("the 270M locates; code fences"), §8 (teeth); O11 scope
// check 3. Invariants (§18): "a call outside its step leaves a row before it goes". Faults (§16): F-02 (an op or a file
// outside a cart's header, exit 12).
import { verdict } from './verdicts.mjs'

/** Does a path fall inside a `touches` glob list (`**`, `dir/**`, `*.ext`, an exact path, or a `kind:name` label)? */
export function inTouches(file, touches = []) {
  const f = String(file || '')
  return touches.some((g) => {
    const t = String(g)
    if (t === '**' || t === f) return true
    if (t.endsWith('/**')) return f.startsWith(t.slice(0, -2))
    if (t.startsWith('*.')) return f.endsWith(t.slice(1))
    return false
  })
}

/**
 * May an agent sent with this cart do `op` on `files`? Code, before the hands (scope check 3).
 * @param {{cart: object}} w the cart's worker
 * @param {{op: string, files?: string[]}} intent
 * @returns {{ok: boolean, exit?: number, fault?: string, why?: string}}
 */
export function scope(w, intent) {
  const c = w.cart
  if (!c) return { ok: true }
  const allowed = new Set([...(c.verbs || []), ...(c.hands || []), ...(c.acts || [])].map(String))
  if (allowed.size && !allowed.has(String(intent.op))) return { ok: false, exit: 12, fault: 'F-02', why: `${intent.op} is not in the cart ${c.name}'s header` }
  const off = (intent.files || []).filter((f) => !inTouches(f, c.touches || []))
  if (off.length && (c.touches || []).length) return { ok: false, exit: 12, fault: 'F-02', why: `${off.join(', ')} is outside the cart ${c.name}'s touches` }
  return { ok: true }
}

/**
 * Where a run's `allows` comes from: the ladder's current step on a run with one; nothing else (a cart's body was checked
 * against its header at load, a desk turn's header is the intent door's own check).
 * @param {object} w
 * @returns {{allows: ?Set<string>, source: ?string, k: ?number}}
 */
export function allowsOf(w) {
  const l = w.contract?.latch
  if (l && Array.isArray(l.steps) && l.k >= 1 && l.k <= l.steps.length) {
    return { allows: new Set((l.steps[l.k - 1].allows || []).map(String)), source: 'ladder', k: l.k }
  }
  return { allows: null, source: null, k: null }
}

/**
 * The fence at a call: inside the step's `allows` the call is in sequence; outside it the row `out-of-sequence` is written
 * (warn-only in 1.0) and the call still goes. A run with no ladder has no fence here.
 * @param {object} sup
 * @param {object} w
 * @param {string} op the call's op
 * @returns {{ok: true, outside: boolean, verdict: ?object}}
 */
export function fence(sup, w, op) {
  const { allows, k } = allowsOf(w)
  if (!allows || allows.has(String(op))) return { ok: true, outside: false, verdict: null }
  const v = verdict(sup, w, { check: 'out-of-sequence', action: 'warn', by: 'code', step: k,
    detail: `${op} outside step ${k} (allows ${[...allows].slice(0, 8).join(' ') || 'nothing'})`,
    why: `step ${k}'s allows does not name ${op}; warn-only in 1.0 (SENTRY-2.0 §2)` })
  return { ok: true, outside: true, verdict: v }
}
