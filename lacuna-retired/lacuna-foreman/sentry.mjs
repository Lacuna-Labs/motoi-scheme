// sentry.mjs — THE SENTRY, the device on a run (SENTRY-2.0 §1: a device, not an agent; the foreman's side). Owns: the
// attach (`attachSentry`: which device sits on a run — the work device by its domain, the cart device, the desk's — with
// its mind from the box config and its mode, said once on the bus), the slice a boundary hands the sentry (the said, the
// receipts opened and closed in that window, the step's done-check, the exit), the regex pass over its sentences, the
// labeler's word when a sentence stays unsure (labeler.mjs, the 1B under its grammar), what code does with each label (a
// verdict row through sentry/verdicts.mjs; a promise row; a wake row when the promise names a time; a kick through kick.mjs
// when a claim has no receipt; the grade form's on-task flag), the shadow switch by domain (sentry-mode.mjs: in shadow a
// would-kick is written and nothing is sent), the wake sweep, and the grade form the next turn reads last. Refuses: to
// change a receipt, a step or an exit (one writer: the foreman); to kick in shadow; to read more than one slice's worth
// (≤ SLICE.chars, ≤ SLICE.receipts); "done" as a state word in a mind's text (a claim without a receipt unless one closes
// it); to judge a situation (a label over a slice is all a mind answers); a verdict without a why. Implements:
// LACUNA-SENTRY-2.0 §1 (the device), §5 S0–S1, §8 (teeth: models warn, code kicks), unit 3.0; LACUNA-SENTRY-1.0 §2 (forms),
// §3 (the loop), §5 (S-1…S-8), §6 (F-S1…F-S5); LACUNA-3.0-DESIGN §9. Invariants (§18 / SENTRY §5): "every said at a boundary
// has a verdict row"; "no kick without a verdict or a promise row behind it"; "a verdict never changes a record"; "in
// shadow, nothing leaves the record". Faults (§16 / SENTRY §6): F-S1 (no verdict within its deadline), F-S2 (a kick sent in
// shadow).
import { contractPromise } from './contract.mjs'
import { verdict, sentryOf, MODEL_BY } from './sentry/verdicts.mjs'
import { labelSentence, onTask, stuck, pushback } from './sentry/labeler.mjs'
import { stepCheck } from './sentry/expectation.mjs'
import { kick } from './kick.mjs'
import { turnChecks } from './sentry/semantics.mjs'
import { locateCheck } from './sentry/locator.mjs'
import { attach as attachEv, check as checkEv } from './phase.mjs'
import { think } from './talk.mjs'

export { sentryOf } from './sentry/verdicts.mjs'
export { readEnd, END_STATES } from './sentry/ast.mjs'

/** The verdict kinds a said's sentences take (SENTRY-1.0 §2.2). `unsure` is the honest null and is counted. */
export const KINDS = Object.freeze(['claim-with-receipt', 'claim-without-receipt', 'promise', 'remark', 'off-task', 'unsure'])
/** A slice's bounds: the 1B's horizon (TRAINING §1: ≤ 2–4k tokens in). */
export const SLICE = Object.freeze({ chars: 8000, receipts: 20, said: 2000, sentences: 24 })
/** Wake rows kept per worker. */
export const WAKES_KEPT = 16
/** The sentry's deadline for one slice (SENTRY F-S1). */
export const VERDICT_S = 2

const ACT_WORDS = /(?<!\b(?:to|can|could|will|would|should|may|might|must|let's|please)\s)\b(started|ran|restarted|pushed|committ?ed|deployed|deleted|removed|backed up|installed|promoted|merged|trained|killed|cleared|pruned|wrote|written|fixed|patched|bundled)\b/i
const DONE_WORDS = /(?<!\b(?:to|can|could|will|would|should|may|might|must)\s)\b(done|finished|completed|all set)\b/i
const PROMISE_WORDS = /\b(i will|i'll|let me|i am going to|i'm going to|going to|next i|i can do that|will do)\b/i
const RECEIPT_ID = /\b(t-\d+|rc-\d+|rc-shadow-\d+|tk-[0-9a-f]{4,}|i-\d+)\b/g
const AT_TIME = /\b(?:at|by)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b|\bin\s+(\d{1,3})\s*(s|sec|seconds?|m|min|minutes?|h|hours?)\b|\b(tomorrow|tonight)\b/i

/** Shadow is the default until the domain's sitting passes and the owner presses (SENTRY-2.0 §8); the host says otherwise. */
export const inShadow = (sup, domain = null) => (typeof sup.host.sentryShadow === 'function' ? sup.host.sentryShadow(domain) !== false : true)

/** The short name of a sentry mind's tag for the floor (`1b`, `270m`), or `code` when none sits on the run. */
export const modelWord = (tag) => (/270m/i.test(String(tag || '')) ? '270m' : /\b1b\b|-1b-|:1b/i.test(String(tag || '')) ? '1b' : 'code')

/**
 * Sit a device on a run: the state on the worker, the mind from the box config by seat, the mode by domain, one
 * `sentry.attach` on the bus. Called by the work device (work-sentry.mjs attach) and the cart device (cart-sentry.mjs sweep).
 * @param {object} sup
 * @param {object} w
 * @param {{device: 'work'|'cart'|'desk', domain?: ?string, seat?: string, periodS?: ?number}} o
 * @returns {object} the sentry state
 */
export function attachSentry(sup, w, { device, domain = null, seat = 'sentry', periodS = null }) {
  const st = sentryOf(w)
  if (st.attached) return st
  const tag = typeof sup.host.sentryModel === 'function' ? sup.host.sentryModel(seat) : null
  Object.assign(st, { attached: true, device, domain, tag: tag || null, model: modelWord(tag), mode: inShadow(sup, domain) ? 'shadow' : 'live' })
  attachEv(sup, w, { model: st.model, domain, mode: st.mode, periodS })
  return st
}

/**
 * The slice a boundary hands the sentry (SENTRY §2.1): bounded, never the run, never the chat.
 * @param {object} sup the supervisor
 * @param {object} w the run (a worker with `run` and `contract`)
 * @param {string} said the text said at this boundary
 * @returns {object} {run, step, turn, at, said, receipts: [{id, op, state}], done_check, exit, step_text, chars}
 */
export function buildSlice(sup, w, said) {
  const c = w.contract || {}
  const closed = (w.run?.results || []).slice(-SLICE.receipts).map((r) => ({ id: String(r.ticket), op: String(r.tool), state: 'closed' }))
  const open = (w.pending || []).map((t) => ({ id: String(t.ticket), op: String(t.op), state: t.kind === 'press' ? 'waiting-press' : 'open' }))
  const receipts = [...open, ...closed].slice(-SLICE.receipts)
  const step_text = c.steps?.length ? String(c.steps.at(-1).text) : ''
  const s = { run: w.id, step: c.latch?.k ?? c.step ?? 0, turn: w.run?.hops ?? 0, at: sup.host.now(), said: String(said || '').slice(0, SLICE.said),
              receipts, done_check: String(c.done_check || '').slice(0, 400), exit: c.exit ?? null, step_text: step_text.slice(0, 240) }
  s.chars = JSON.stringify(s).length
  if (s.chars > SLICE.chars) { s.said = s.said.slice(0, Math.max(200, SLICE.said - (s.chars - SLICE.chars))); s.chars = JSON.stringify(s).length }
  return s
}

/** Sentences of a said, numbered from 1, at most `most` (SLICE.sentences: one slice's; the turn sentry slices a whole reply). */
export function sentences(text, most = SLICE.sentences) {
  return String(text || '').replace(/\s+/g, ' ').split(/(?<=[.!?])\s+(?=[A-Z"'(\[])|\n+/).map((x) => x.trim()).filter(Boolean).slice(0, most)
}

/** A time named in a sentence → seconds since 1970 (today's clock from `now`), or null. */
export function whenOf(sentence, now) {
  const m = String(sentence).match(AT_TIME)
  if (!m) return null
  if (m[1]) {
    let h = Number(m[1]); const min = Number(m[2] || 0); const ap = (m[3] || '').toLowerCase()
    if (ap === 'pm' && h < 12) h += 12
    if (ap === 'am' && h === 12) h = 0
    if (!ap && h < 8) h += 12                                      // "at three" on a working day is 15:00, never 03:00
    const d = new Date(now * 1000); d.setHours(h, min, 0, 0)
    let at = d.getTime() / 1000; if (at <= now) at += 86400
    return Math.round(at)
  }
  if (m[4]) { const n = Number(m[4]); const u = m[5][0]; return Math.round(now + n * (u === 'h' ? 3600 : u === 'm' ? 60 : 1)) }
  if (m[6]) return Math.round(now + (m[6].toLowerCase() === 'tonight' ? 6 * 3600 : 86400))
  return null
}

/**
 * The regex pass (SENTRY §3 step 3): what code can label without a mind. → [{n, text, kind|null, evidence, when}]
 * `kind` stays null where the sentence needs the 1B.
 */
export function regexPass(slice) {
  const closedById = new Map(slice.receipts.filter((r) => r.state === 'closed').map((r) => [r.id, r]))
  const closedOps = new Set(slice.receipts.filter((r) => r.state === 'closed').map((r) => r.op.toLowerCase()))
  const openOps = new Set(slice.receipts.filter((r) => r.state !== 'closed').map((r) => r.op.toLowerCase()))
  const row = (n, text, kind, evidence = null, when = null) => ({ n, text, kind, evidence, when })
  return sentences(slice.said).map((text, i) => {
    const n = i + 1
    const ids = [...text.matchAll(RECEIPT_ID)].map((m) => m[1])
    const named = ids.find((id) => closedById.has(id))
    const low = text.toLowerCase()
    const opNamed = [...closedOps].find((op) => op && low.includes(op))
    const opOpen = [...openOps].find((op) => op && low.includes(op))
    if (named) return row(n, text, 'claim-with-receipt', named)
    if (PROMISE_WORDS.test(text)) return row(n, text, 'promise', null, whenOf(text, slice.at))
    if (ACT_WORDS.test(text) && opNamed) return row(n, text, 'claim-with-receipt', [...closedById.values()].find((r) => r.op.toLowerCase() === opNamed)?.id ?? null)
    if (ACT_WORDS.test(text) && opOpen) return row(n, text, 'promise', null, whenOf(text, slice.at))
    if ((DONE_WORDS.test(text) || ACT_WORDS.test(text)) && !closedById.size) return row(n, text, 'claim-without-receipt')
    if (ACT_WORDS.test(text) || DONE_WORDS.test(text)) return row(n, text, null)   // receipts exist; which one covers it is the 1B's call
    return row(n, text, 'remark')
  })
}

/**
 * The verdict for one slice (SENTRY §3 steps 3–5): regex, then the labeler for what is left, inside its 3 s wall.
 * @returns {Promise<{slice: object, sentences: Array<{n, text, kind, evidence, when, by}>, unsure: number, ms: number}>}
 */
export async function verdictOf(sup, w, slice) {
  const t0 = sup.host.now()
  const rows = regexPass(slice).map((s) => ({ ...s, by: s.kind ? 'regex' : null }))
  for (const s of rows) {
    if (s.kind) continue
    const r = await labelSentence(sup, w, slice, s)              // F-S1: a late or absent mind leaves `unsure`, counted
    s.kind = r.label; s.by = r.by
  }
  return { slice, sentences: rows, unsure: rows.filter((s) => s.kind === 'unsure').length, ms: Math.round((sup.host.now() - t0) * 1000) }
}

const WHY = {
  'claim-with-receipt': (s) => `receipt ${s.evidence} covers it`,
  'claim-without-receipt': () => 'the sentence reports an act and no receipt in the window closes it',
  promise: (s) => (s.when ? 'the sentence names a time: a promise row and a wake' : 'the sentence says what it will do: a promise row'),
  remark: () => 'the said acts on nothing',
  'off-task': () => 'the labeler reads the sentence as other work than the step',
  unsure: (s) => `no label held (${s.by})`,
}

/**
 * What code does with a verdict (SENTRY §3 step 6): rows, promises, wakes, kicks (never in shadow), the grade's flag. One
 * row per finding; a said with no finding leaves one `remark` row (every said at a boundary has a row).
 * @returns {{recorded: number, promises: string[], wakes: string[], kicks: number, would: number, shadow: boolean, rows: Array<object>}}
 */
export function apply(sup, w, v, { shadow = inShadow(sup, w.sentry?.domain) } = {}) {
  const st = sentryOf(w)
  const now = sup.host.now()
  const out = { recorded: 0, promises: [], wakes: [], kicks: 0, would: 0, shadow, rows: [] }
  const findings = v.sentences.filter((s) => s.kind !== 'remark')
  const row = (s, action, why) => { const r = verdict(sup, w, { check: s.kind, action, by: s.by || 'regex', step: v.slice.step, detail: `sentence ${s.n}: ${s.text.slice(0, 160)}`, why }); out.rows.push(r); out.recorded++; return r }
  for (const s of v.sentences) {   // verdicts.mjs is the one counter (st.counts by check); a remark leaves one row per said below
    if (s.kind === 'promise') {
      row(s, 'note', WHY.promise(s))
      const span = s.when ? Math.max(60, s.when - now) : sup.alive.hand
      const id = contractPromise(sup, w, s.text, span, null)
      out.promises.push(id)
      if (s.when) {
        const wid = `w-${st.wakes.length + 1}`
        st.wakes.push({ id: wid, at: s.when, why: id, fired: false }); if (st.wakes.length > WAKES_KEPT) st.wakes.splice(0, st.wakes.length - WAKES_KEPT)
        out.wakes.push(wid)
        think(w, 'state', `wake ${wid} at ${new Date(s.when * 1000).toISOString()} for ${id}`, now)
      }
    } else if (s.kind === 'claim-without-receipt' && MODEL_BY.has(s.by)) {
      // SENTRY-2.0 §8 (K1.10): a model warns, code kicks. The regex labels a claim without a receipt only when no receipt closed
      // at all (certain); with receipts in the window the 1B judges whether one covers the sentence, and a judgment is a warn.
      row(s, 'warn', `the ${s.by} reads the sentence as an act no receipt in the window covers; a model warns, code kicks`)
    } else if (s.kind === 'claim-without-receipt') {
      const text = `you said "${s.text.slice(0, 160)}"; no receipt closes it`
      if (shadow) { row(s, 'would-kick', WHY[s.kind](s)); st.would.push({ at: now, kind: 'kick', text }); out.would++; think(w, 'state', `shadow: would kick — ${text}`, now) }
      else { row(s, 'kick', WHY[s.kind](s)); kick(sup, w, { category: 'no-receipt', text, by: 'sentry.mjs', evidence: { sentence: s.n, text: s.text.slice(0, 160) }, event: { promise: null, text, missed: 1, kind: 'claim-without-receipt' } }); out.kicks++ }
    } else if (s.kind === 'off-task') { st.grade.on_task = false; row(s, 'warn', WHY['off-task'](s)) }
    else if (s.kind === 'claim-with-receipt' || s.kind === 'unsure') row(s, 'note', WHY[s.kind](s))
  }
  const sem = turnChecks(sup, w, v, { shadow })                          // SENTRY-2.0 §5 S0 (K1.7): answered-not-acted, circling
  out.rows.push(...sem.rows); out.recorded += sem.rows.length; out.would += sem.would; out.kicks += sem.kicks
  if (!findings.length && v.sentences.length) {
    const r = verdict(sup, w, { check: 'remark', action: 'note', by: 'regex', step: v.slice.step, detail: `${v.sentences.length} sentence(s), nothing claimed`, why: WHY.remark() })
    out.rows.push(r); out.recorded++
  }
  if (v.sentences.length) checkEv(sup, w, { kind: 'semantics', n: v.sentences.length, by: v.sentences.some((s) => s.by === '1b') ? '1b' : 'regex', ms: v.ms ?? null })
  st.grade.last = { turn: v.slice.turn, step: v.slice.step, at: now }
  sup.host.save?.(w)
  return out
}

/** One boundary, end to end: slice → verdict → apply. Never throws; a late sentry leaves `unsure` rows (F-S1). */
export async function atBoundary(sup, w, said, o = {}) {
  const slice = buildSlice(sup, w, said)
  const v = await verdictOf(sup, w, slice)
  const out = apply(sup, w, v, o)
  const located = await locateCheck(sup, w, slice, { dir: o.dir, domain: w.sentry?.domain })   // SENTRY-2.0 §5 S1 (K1.8): the 270M says which step; warn-only
  if (located) { out.rows.push(located); out.recorded++ }
  const expected = await stepCheck(sup, w, { step: slice.step, ask: Boolean(o.checkQuestions || w.sentry?.checkQuestions) })   // P7: the step's expectation
  if (expected) { out.rows.push(expected); out.recorded++ }
  if (o.checkQuestions || w.sentry?.checkQuestions) {
    const goal = w.contract?.goal || ''
    if (goal) {
      const ot = await onTask(sup, w, { goal, expect: w.contract?.expect, message: slice.said, call: slice.step_text })
      if (ot.label === 'off-task') { sentryOf(w).grade.on_task = false; out.rows.push(verdict(sup, w, { check: 'off-task', action: 'warn', by: ot.by, step: slice.step, detail: slice.said.slice(0, 120), why: 'the 1B on-task? labeler marked the turn off-task' })); out.recorded++ }
      if (/\b(cannot|can't|should not|shouldn't|refuse)\b/i.test(slice.said)) {
        const pb = await pushback(sup, w, { goal, message: slice.said })
        if (pb.label === 'pushback') { out.rows.push(verdict(sup, w, { check: 'pushback', action: 'warn', by: pb.by, step: slice.step, detail: slice.said.slice(0, 120), why: 'the 1B pushback? labeler noted a reasoned refusal' })); out.recorded++ }
      }
    }
    const steps = (w.contract?.steps || []).map((s) => s.text)
    if (steps.length >= 3) {
      const sk = await stuck(sup, w, steps)
      if (sk.label === 'circling') { out.rows.push(verdict(sup, w, { check: 'stuck', action: 'warn', by: sk.by, step: slice.step, detail: steps.slice(-3).join(' | ').slice(0, 120), why: 'the 1B stuck? labeler marked the last three steps circling' })); out.recorded++ }
    }
  }
  return { ...out, unsure: v.unsure, sentences: v.sentences }
}

/** The wake sweep: a due wake wakes its run with the grade form (SENTRY §2.4). → the ids fired. */
export function wakeSweep(sup) {
  const now = sup.host.now(); const fired = []
  for (const w of sup.living()) {
    const st = w.sentry; if (!st) continue
    for (const k of st.wakes) {
      if (k.fired || now < k.at) continue
      k.fired = true; fired.push({ run: w.id, wake: k.id, why: k.why })
      think(w, 'state', `wake ${k.id}: ${k.why} is due`, now)
      if (w.handlers?.has('wake')) sup.send(w.id, 'wake', { id: k.id, why: k.why, grade: gradeForm(sup, w) })
      sup.host.upstream('wake', w, { id: k.id, why: k.why })
    }
  }
  return fired
}

/**
 * The grade form the next turn reads last (SENTRY §2.3, MINDS §4.1): what was said, what closed, what is open, on task.
 * @returns {object} {turn, step, said_count, receipts_closed, receipts_open, open_promises, kicks, on_task, would_kicks}
 */
export function gradeForm(sup, w) {
  const st = sentryOf(w); const c = w.contract || {}
  const open = (c.promises || []).filter((p) => p.state === 'open').map((p) => ({ id: p.id, text: p.text.slice(0, 80), by: p.deadline_at }))
  return { turn: w.run?.hops ?? 0, step: c.latch?.k ?? c.step ?? 0, said_count: w.run?.saids ?? 0, receipts_closed: (w.run?.results || []).length,
           receipts_open: (w.pending || []).length, open_promises: open, kicks: (c.kicks || []).length, on_task: st.grade.on_task !== false, would_kicks: st.would.length }
}

/** The grade form as slat text, for the prefix. */
export function gradeSlat(g) {
  const open = g.open_promises.map((p) => `(${p.id} "${String(p.text).replace(/"/g, '\\"')}")`).join(' ')
  return `(grade (turn ${g.turn}) (step ${g.step}) (said ${g.said_count}) (closed ${g.receipts_closed}) (open ${g.receipts_open}) (promises (${open})) (kicks ${g.kicks}) (on-task ${g.on_task ? '#t' : '#f'}))`
}
