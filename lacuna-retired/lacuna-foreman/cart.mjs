// THE LACUNA CART — owns the reading of a cart's header (its FIRST form, read as data before anything is evaluated) and the checks
//   built on it: (lacuna-cart 'name '((does . "…") (agent . ((tier . watch) (verbs . (…)))) (minds …) (judgment …) (touches …) (done …) (exam …))).
// Owns: verbs ⊆ header, mind model by job class from bench/agents/tiers.json inside lacuna-box/brain/box-minds.json (agent_minds),
//   need-brain only at header judgment points, (done "said") retiring a cart with a `cart-retired` record (the foreman writes no disk).
// Refuses: a body verb the header omits; a reserved mind; a judgment point the header lacks; a header that is not data.
// Implements: design §12 (carts; judgment alist, a bare name falls back to ask-owner), §8; keeps LACUNA-1.3-DESIGN §37.2–§37.3 (B45, B47, B48).
// Invariants (§18): "If a step is done, then a ticket closed it"; the 26B decides only at header judgment points (law 4).
// Faults (§16): F-02 (tool not in header, exit 12), F-09 (judgment fell back to `ask-owner`).
import { doneCheck } from './intents.mjs'
import { contractExit, EXIT } from './contract.mjs'
import { parse, Sym, toJson } from './scheme.mjs'
import { capsFor, PURE, VERBS } from './capabilities.mjs'
import { ladder } from './cascade.mjs'

const word = (x) => (x instanceof Sym ? x.name : x && x.name ? x.name : String(x))
const VERB_NAMES = new Set(VERBS.map((v) => v.name))

// job classes as the design names them → the class keys tiers.py writes (bench/agents/tiers.py CLASSES)
export const JOB_CLASSES = Object.freeze({
  'command->verb': 'verb', 'signal->label': 'label', 'output->route': 'route', 'template-fill': 'fill', 'shell': 'shell',
  verb: 'verb', label: 'label', route: 'route', fill: 'fill',
  // 3.0 §12.1 (P1): a cart's small-mind jobs beyond the four — benched under their own keys when tiers.py has them
  condense: 'condense', 'yes-no': 'yes-no', pick: 'pick', nearness: 'nearness',
})
/** 3.0 §12.1 header fields beyond the 1.3 ones, with their defaults. `restart` defaults by tier (§6 change 5). */
export const HEADER_3 = Object.freeze({ version: null, restart: null, deadlines: {}, contract: null, sentry: [], states: [], intensity: [3, 300],
                                        foreman: null, author: 'claude', hands: [] })
const RESTARTS = ['permanent', 'transient', 'temporary']
const AUTHORS = ['claude', '26b', 'owner']
const JUDGMENT_FALLBACKS = ['ask-owner', 'skip', 'stop', 'default']
// without a readable box profile, the smallest safe answer: the workhorse alone
export const DEFAULT_BOX = Object.freeze({ agent_minds: ['functiongemma'], workhorse: 'functiongemma', reserved: {} })
const LISTS = new Set(['verbs', 'labels', 'touches', 'acts', 'intensity'])
const RAW = new Set(['judgment', 'sentry', 'states', 'hands'])   // top-level only, kept as read (a mind may be named `sentry`)
const ALISTS = new Set(['agent', 'minds', 'deadlines', 'contract'])
const STEPS_KEPT = 60

/** Does this program open with a cart header? (Read only; nothing runs.) */
export function isCart(program) {
  return /^\s*(;[^\n]*\n\s*)*\(\s*lacuna-cart[\s)]/.test(String(program || ''))
}

// '((k . v) (k a b) …) read as JSON → {k: v | [a b] | {…}}
function alist(entries, nested = ALISTS, top = false) {
  const out = {}
  for (const e of Array.isArray(entries) ? entries : []) {
    if (!Array.isArray(e) || !e.length) continue
    const k = String(e[0])
    const rest = e.slice(1)
    if (top && RAW.has(k)) out[k] = rest
    else if (LISTS.has(k)) out[k] = rest.length === 1 && Array.isArray(rest[0]) ? rest[0].map(String) : rest.map(String)
    // each mind is an alist of its own, of one field or many: (l . ((job . pick))) reads as {job: pick} (inventory.mjs value())
    else if (k === 'minds') out[k] = Object.fromEntries(rest.filter((m) => Array.isArray(m) && m.length).map((m) => [String(m[0]), alist(m.slice(1), new Set())]))
    else if (nested.has(k)) out[k] = alist(rest, nested)
    else if (rest.length === 1) out[k] = rest[0]
    else out[k] = rest.length ? alist(rest, new Set()) : null
  }
  return out
}

const unquote = (f) => (Array.isArray(f) && f[0] instanceof Sym && f[0].name === 'quote' ? f[1] : f)

/**
 * Read a cart's header and check its body against it. Returns the header, or throws ONE sentence saying what to fix.
 * `tables` = {tiers, box}: the bench's tiers.json and the box's profile (either may be null).
 */
export function readCart(program, tables = {}) {
  let forms
  try { forms = parse(String(program || '')) } catch (e) { throw new Error(`the cart does not read: ${e.message}`) }
  const head = forms[0]
  if (!Array.isArray(head) || !(head[0] instanceof Sym) || head[0].name !== 'lacuna-cart' || head.length !== 3)
    throw new Error("a cart opens with its header: (lacuna-cart 'name '((does . \"…\") (agent . …) (done . \"…\") …))")
  const name = word(unquote(head[1]))
  if (!/^[a-z][a-z0-9-]{0,59}$/.test(name)) throw new Error(`a cart's name is a short lowercase word with dashes, not '${name}'`)
  const h = alist(toJson(unquote(head[2])), ALISTS, true)
  const agent = h.agent || {}
  const tier = String(agent.tier || 'watch')
  if (!['watch', 'act'].includes(tier)) throw new Error(`the cart ${name}'s tier is watch or act, not ${tier}`)
  for (const k of ['does', 'done']) if (typeof h[k] !== 'string' || !h[k].trim())
    throw new Error(`the cart ${name} says what it ${k === 'does' ? 'does' : 'is done at'}: (${k} . "…")`)
  const verbs = (agent.verbs || []).map(String)
  capsFor({ name: `the cart ${name}`, tier, asked: verbs })            // unknown or too wide for its tier: a sentence
  // JUDGMENT IS AN ALIST (§12.1): (judgment . ((new-thing . ask-owner) stale)) — a bare name's fallback is ask-owner (F-09)
  const judgmentFallback = {}
  for (const j of h.judgment || []) {
    const [point, fb] = Array.isArray(j) ? [String(j[0]), String(j[1] ?? 'ask-owner')] : [String(j), 'ask-owner']
    if (!JUDGMENT_FALLBACKS.includes(fb)) throw new Error(`the cart ${name}'s judgment point ${point} falls back to ${fb}; one of ${JUDGMENT_FALLBACKS.join(' ')}`)
    judgmentFallback[point] = fb
  }
  const judgment = Object.keys(judgmentFallback)
  if (judgment.length && !verbs.includes('need-brain'))
    throw new Error(`the cart ${name} names judgment points but its verbs do not hold need-brain`)
  const minds = {}
  for (const [job, spec] of Object.entries(h.minds || {})) {
    const s = spec && typeof spec === 'object' ? spec : {}
    const cls = String(s.job || '')
    if (!JOB_CLASSES[cls]) throw new Error(`the cart ${name}'s mind '${job} has no job class we bench — use one of ${Object.keys(JOB_CLASSES).filter((c) => c.includes('-')).join(', ')}`)
    // the cascade's ladder (B50): the job climbs from the smallest benched rung to the 26B only as far as it must
    const rungs = ladder(JOB_CLASSES[cls], tables).map((r) => r.model)
    // A PANTHEON MIND BY ITS ROLE (CARTS-ARE-THE-WORK §2, the owner 2026-10-18): (role . verdict) asks the trained mind
    // in service under that name (box-minds.json `roles`, served by the gateway by name); a role not in service yet —
    // under 90% one-shot — falls to the class's own pick, and the run says so
    const role = s.role == null ? null : String(s.role)
    const roles = (tables.box && tables.box.roles) || {}
    const picked = role && roles[role] ? { model: role, why: `the ${role} mind in service (${roles[role].version || 'v1'})`, role }
      : { ...pickMind(cls, tables), ...(role ? { role, why: `the ${role} mind is not in service yet (it has not passed 90% one-shot) — ${pickMind(cls, tables).why}` } : {}) }
    minds[job] = { job: cls, labels: (s.labels || []).map(String), untrusted: s.untrusted === true, ...picked,
                   rungs: picked.model === role ? [role, ...rungs.filter((m) => m !== role)] : rungs }
  }
  if (Object.keys(minds).length && !verbs.includes('mind')) throw new Error(`the cart ${name} declares minds but its verbs do not hold mind`)
  const restart = h.restart == null ? (tier === 'act' ? 'transient' : 'permanent') : String(h.restart)
  if (!RESTARTS.includes(restart)) throw new Error(`the cart ${name}'s restart is one of ${RESTARTS.join(' ')}, not ${restart}`)
  const author = h.author == null ? HEADER_3.author : String(h.author)
  if (!AUTHORS.includes(author)) throw new Error(`the cart ${name}'s author is one of ${AUTHORS.join(' ')}, not ${author}`)
  const intensity = h.intensity == null ? [...HEADER_3.intensity] : (Array.isArray(h.intensity) ? h.intensity : [h.intensity]).map(Number)
  if (intensity.length !== 2 || !intensity.every((n) => Number.isFinite(n) && n > 0)) throw new Error(`the cart ${name}'s intensity is (intensity N SECONDS), e.g. (intensity 3 300)`)
  const deadlines = {}
  for (const [op, sec] of Object.entries(h.deadlines || {})) {
    if (!(Number(sec) > 0)) throw new Error(`the cart ${name}'s deadline for ${op} is seconds > 0, not ${sec}`)
    deadlines[op] = Number(sec)
  }
  const contract = h.contract && typeof h.contract === 'object' ? { goal: h.contract.goal == null ? null : String(h.contract.goal), done_check: h.contract['done-check'] == null ? null : String(h.contract['done-check']) } : null
  const header = { name, does: h.does.trim(), done: h.done.trim(), tier, verbs, minds, judgment, judgmentFallback,
                   version: h.version == null ? null : String(h.version), restart, deadlines, contract, sentry: readSentry(h.sentry),   // (sentry . ()) none · (sentry . (error warning)) signals · (sentry . ((cart . x) (watch …) (gates . #f))) a plan (ch. 5 §5.2.1)
                   states: (h.states || []).flat().map(String), intensity, foreman: h.foreman == null ? null : String(h.foreman), author,
                   hands: (h.hands || []).flat().map(String),
                   touches: (h.touches || []).map(String).slice(0, 12), exam: h.exam == null ? null : String(h.exam),
                   shadow: h.shadow === true,                       // (shadow . #t): every rung answers every job (§40.3)
                   acts: (h.acts || []).map(String) }                 // (acts . (pass …)): the only acts it may do (acts.py)
  if (header.acts.length && !verbs.includes('act')) throw new Error(`the cart ${name} names acts but its verbs do not hold act`)
  checkBody(forms.slice(1), header)
  return header
}

/** The body may call only what the header holds; need-brain only at a judgment point; mind-job only a declared mind. */
function checkBody(forms, header) {
  // one handler per kind: a second (on 'hand …) at the top silently REPLACES the first (a generated cart did this,
  // 2026-10-18) — one handler, and (case (get r 'op 'none) …) inside it for several reads
  const seen = new Map()
  for (const f of forms) {
    if (Array.isArray(f) && f[0] instanceof Sym && f[0].name === 'on') {
      const k = unquote(f[1]); const kn = k instanceof Sym ? k.name : String(k)
      seen.set(kn, (seen.get(kn) || 0) + 1)
    }
  }
  for (const [k, n] of seen) if (n > 1) throw new Error(`the cart ${header.name} has ${n} handlers for '${k} — the last replaces the others; keep one (on '${k} …) and use (case (get r 'op 'none) ((op1) …) ((op2) …)) inside it`)
  const held = new Set(header.verbs)
  const outside = new Set()
  const walk = (f) => {
    if (!Array.isArray(f) || !f.length) return
    const h = f[0] instanceof Sym ? f[0].name : null
    if (h === 'quote' || h === 'quasiquote') return                     // data, not calls
    if (h === 'lacuna-cart') throw new Error('a cart has one header, and it is the first form')
    if (h && VERB_NAMES.has(h) && !PURE.has(h) && !held.has(h)) outside.add(h)
    if (h === 'need-brain') {
      const topic = unquote(f[1])
      if (!(topic instanceof Sym) || !(Array.isArray(f[1]) && f[1][0]?.name === 'quote'))
        throw new Error(`the cart ${header.name} asks the brain without naming a judgment point — write (need-brain '${header.judgment[0] || 'point'} "question" fact …)`)
      if (!header.judgment.includes(topic.name))
        throw new Error(`the cart ${header.name} asks the brain about '${topic.name}, which is not among its judgment points (${header.judgment.join(', ') || 'none'})`)
    }
    if (h === 'mind-job') {
      const job = unquote(f[1])
      if (job instanceof Sym && !header.minds[job.name])
        throw new Error(`the cart ${header.name} declares the mind job '${job.name} that its header does not name under (minds …)`)
    }
    f.forEach(walk)
  }
  forms.forEach(walk)
  if (outside.size) {
    const v = [...outside].sort()
    throw new Error(`the cart ${header.name} calls ${v.map((x) => `(${x} …)`).join(', ')} but its header does not hold ${v.length > 1 ? 'them' : 'it'} — add to (agent (verbs …)) or take the call out`)
  }
}

const canon = (m) => String(m || '').replace(/:latest$/, '')
/** The header's sentry field, kept in the shape it was written: an alist → object, names → strings, none → []. */
function readSentry(x) {
  const items = Array.isArray(x) ? x : x == null ? [] : [x]
  // a plan: (k . v) → v; (k . (a b)) → [a b]; (k . (a)) reads the same as (k . a) → a (the reader drops the dot)
  if (items.length && items.every((e) => Array.isArray(e) && e.length && !Array.isArray(e[0])))
    return Object.fromEntries(items.map((e) => [String(e[0]), e.length === 2 ? e[1] : e.slice(1)]))
  return items.flat(1).map(String)
}

/** The smallest model that held this job class (tiers.json's pick), kept inside the box's list; the choice and why. */
export function pickMind(jobClass, { tiers = null, box = null } = {}) {
  const b = box && Array.isArray(box.agent_minds) ? box : DEFAULT_BOX
  const reserved = new Set(Object.keys(b.reserved || {}).map(canon))
  const allowed = b.agent_minds.map(canon).filter((m) => !reserved.has(m))
  const workhorse = allowed.includes(canon(b.workhorse)) ? canon(b.workhorse) : allowed[0] || 'functiongemma'
  const ok = (m) => allowed.includes(canon(m))
  const key = JOB_CLASSES[jobClass]
  const row = tiers && tiers.classes && tiers.classes[key]
  if (!row) return { model: workhorse, why: tiers ? `tiers.json has no ${jobClass} row yet — the box's workhorse` : `no tiers.json yet — the box's workhorse` }
  if (ok(row.pick)) return { model: canon(row.pick), why: `tiers.json: ${row.why || 'its pick'} for ${jobClass}` }
  const best = (row.ranked || []).filter((r) => ok(r.model)).sort((x, y) => (y.pct - x.pct) || (x.params_b - y.params_b))[0]
  if (best) return { model: canon(best.model), why: `tiers.json picks ${canon(row.pick)} for ${jobClass} (${row.why || ''}); this box lets agents have only ${allowed.join(', ')} — ${canon(best.model)} scored best of those (${best.pct}%)` }
  return { model: workhorse, why: `tiers.json picks ${canon(row.pick)} for ${jobClass}, which this box does not allow an agent, and none of ${allowed.join(', ')} was benched — the workhorse` }
}

// ── the run ───────────────────────────────────────────────────────────────────────────────────────────────────────
export function cartState(header, now) {
  return { ...header, started: now, steps: [], made: { bugs: [], petitions: [], branches: [], files: [] }, brain: 0,
           outcome: null, said: null, retired: false }
}

/** One step of the run, as the artifact will say it: done · skipped · stopped, and the line that says why (with its ticket/receipt when opened by hand/act, 1.4). */
export function step(w, name, status, why, now, extra = null) {
  if (!w.cart) return
  const row = { name: String(name).slice(0, 60), status, why: String(why || '').slice(0, 240), at: clock(now) }
  if (extra?.ticket) row.ticket = String(extra.ticket)
  if (extra?.receipt !== undefined) row.receipt = extra.receipt
  w.cart.steps.push(row)
  w.cart.progressAt = now   // the cart sentry's clock (cart-sentry.mjs, O11)
  if (w.cart.steps.length > STEPS_KEPT) w.cart.steps.splice(1, 1)        // keep the first (the load) and the latest
}
// local wall time, the way artifact.py writes every other run's (INDEX.slat sorts runs by these strings)
const local = (t) => { const d = new Date(t * 1000); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString() }
const clock = (t) => local(t).slice(11, 19)
const iso = (t) => local(t).slice(0, 19)

/** A report is also what the run made: a bug candidate (only reported — filing a bug is a person's card). */
export function noteReport(w, kind, data) {
  if (!w.cart) return
  if (kind === 'bug' && w.cart.made.bugs.length < 40) w.cart.made.bugs.push(String(data.map((d) => (typeof d === 'string' ? d : JSON.stringify(d))).join(' ')).slice(0, 200))
}

/** The record Lacuna turns into the run's artifact (artifact.py's record shape) and the exam row. */
export function record(w, now, why) {
  const c = w.cart
  const outcome = c.outcome || 'stopped'
  const reason = outcome === 'stopped' ? String(why || 'stopped') : String(c.said || why || outcome)
  // the minds that answered (each rung the cascade asked), or the ones chosen when none was asked yet
  const answered = Object.keys((w.mind && w.mind.by_rung) || {})
  const minds = answered.length ? answered : Object.values(c.minds).map((m) => m.model)
  return {
    id: w.id, cart: c.name, class: 'lacuna-cart', exam: c.exam, asked: c.does, touches: c.touches,
    started: iso(c.started), ended: iso(now), steps: c.steps, made: c.made,
    minds: [...new Set(minds)], mind_choice: Object.fromEntries(Object.entries(c.minds).map(([j, m]) => [j, { model: m.model, why: m.why, rungs: m.rungs }])),
    seat: null, minutes: Math.round(((now - c.started) / 60) * 100) / 100, brain_seconds: 0, brain_asks: c.brain,
    mind_counts: w.mind ? { asked: w.mind.asked, labels: w.mind.labels, dropped: w.mind.dropped, failed: w.mind.failed,
                            climbs: w.mind.climbs || 0, by_rung: w.mind.by_rung || {} } : null,
    outcome, reason: reason.slice(0, 240), said: String(c.said || reason).slice(0, 200), sentry: (c.sentry_rows || []).slice(-8),
  }
}

/**
 * Is this cart part of the on-call loop: a watch cart that holds no mind? Its ticks only read and report (law 4), so the
 * foreman's hush (the box loaded) neither refuses its spawn nor skips its ticks (E14 row 11: the watchdog sweep skipped every
 * tick from 18:09Z on 2026-11-06, under a load of 14 to 70, and the watchdogs went quiet while the box was loaded).
 * @param {?{tier?: string, minds?: Object}} header a cart's header (readCart) or its run state (w.cart)
 * @returns {boolean}
 */
export const onCall = (header) => !!header && header.tier === 'watch' && !Object.keys(header.minds || {}).length

/** The cart's own verbs, defined in every worker that is a cart (a plain worker never sees them). */
export function cartVerbs(sup, w, def) {
  def('lacuna-cart', (name) => word(unquote(name)))                     // the header: already read, nothing to do at load
  def('done', (said) => {
    // done means retired (§37.2): the record says done, and the stop clears children, timers and minds in flight
    if (!w.cart) throw new Error(`${w.name} is not a cart — (done …) belongs to a cart; a worker uses (stop)`)
    if (w.cart.outcome) return true
    w.cart.outcome = 'done'
    w.cart.said = String(said ?? w.cart.done).slice(0, 200)
    step(w, 'done', 'done', w.cart.said, sup.host.now())
    // K1.12 (B-19; law 6): the cart's done closes `pass` only when its done-check form holds, judged here by the foreman's evaluator;
    // a done-check in words, or none, checked nothing: the end is `stopped` (exit 0) with that why, never `pass` and never the false
    // `fail` the stop path wrote for every clean cart end before 2026-10-30 (93 rows)
    if (w.contract && w.contract.exit == null) {
      const check = doneCheck(w, w.cart.said, sup.host.now())
      const outcome = check.checked ? (check.pass ? 'pass' : 'fail') : 'stopped'
      contractExit(sup, w, EXIT.DONE, outcome, { checked: check.checked, why: outcome === 'pass' ? null : check.checked ? `done-check: ${check.why}` : `${check.why}` })
    }
    setTimeout(() => sup.stop(w.id, `done: ${w.cart.said}`), 0)
    return true
  })
}

/** need-brain inside a cart: the first argument is the judgment point, and only the header's points pass. */
export function cartBrain(w, args) {
  if (!w.cart) return args
  const [topic, question, ...facts] = args
  const t = word(topic)
  if (!w.cart.judgment.includes(t)) throw new Error(`${w.name} may ask the brain only at its judgment points (${w.cart.judgment.join(', ') || 'none'}), not '${t}`)
  w.cart.brain++
  w.lastJudgment = { topic: t, fallback: w.cart.judgmentFallback?.[t] || 'ask-owner' }   // F-09: what answers when the brain does not
  return [`[${t}] ${String(question)}`, ...facts]
}

/** A mind job in a cart: only a declared mind, and the header's quarantine and labels hold even if the body forgets them. */
export function cartJob(w, job) {
  if (!w.cart) return job
  const m = w.cart.minds[job.name]
  if (!m) throw new Error(`${w.name}'s header names no mind '${job.name}`)
  job.untrusted = job.untrusted || m.untrusted
  if (!job.labels.length) job.labels = m.labels
  job.model = m.model
  job.jobClass = m.job
  job.rungs = m.rungs || null
  job.shadow = !!w.cart.shadow
  return job
}

export { PURE }
