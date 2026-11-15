// work-sentry.mjs — THE WORK DEVICE, BY WORK TYPE (SENTRY-2.0 unit 3.0: the second attachment calling the same checks;
// work order O25). Owns: the work types (DOMAINS), each with its failure triggers drawn from the failure library and the
// box's postmortems; attaching one work device to every run that wakes for work (by its role and goal; the 1B from the box
// config by seat, shadow by domain); the code checks at the three boundaries — before an act goes out (`beforeIntent`),
// when a result lands (`afterResult`), when the run ends (`finishCheck`); one verdict row for each finding (sentry/verdicts.mjs,
// written when the caller hands the supervisor); and the labeled evidence line each finding writes for its domain's sitting
// (`<foreman>/sentry/work/<domain>.jsonl`, `use: eval-only`: evidence from work on our own repos is never a training pair,
// law 9). The 1B judges only what code cannot (its labels per domain, sentry/labeler.mjs), in shadow until its sitting
// passes. Refuses: to watch words (the said's labels are sentry.mjs's); to change a result or a contract (it may refuse an
// act before it goes out, the way the header refuses: exit 12); to judge without evidence in front of it. Implements:
// SENTRY-2.0 §5 S0 (the touched set, the claim against the receipt), §8; O25, O11's sibling; FAILURE-LIBRARY-1.0 FL-01,
// FL-05, FL-09, FL-10; CART-MODE-1.0 §4 (code first, the 1B at boundaries). Invariants (§18): "a claim is not a record" (a
// run's words that tests passed must match its test-run's exit). Faults (§16): F-02 (an act refused before it goes out).
import { verdict } from './sentry/verdicts.mjs'
import { evidenceRow } from './sentry/labeler.mjs'
import { attachSentry } from './sentry.mjs'

/** The work types: who wakes for them, the failure triggers code checks, and the labels the domain's 1B gives. */
export const DOMAINS = Object.freeze({
  patch: { roles: ['engineer', 'coder'], fl: ['FL-01', 'FL-05', 'FL-10'],
    triggers: ['commit before a passing test-run', 'a file written past 500 lines', 'a test deleted or skipped', 'claims tests pass against a failing test-run', 'a write with empty content'],
    labels: ['on-task', 'dodges-the-bug', 'message-mismatch', 'unsure'] },
  'test-write': { roles: ['tester'], fl: ['FL-01'], goal: /\b(unit tests?|write tests?|test coverage)\b/i,
    triggers: ['a test file with no assertion', 'an async test that never awaits', 'commit before a passing test-run'],
    labels: ['tests-the-thing', 'tests-the-mock', 'cannot-fail', 'unsure'] },
  ticket: { roles: ['triage', 'triager', 'ticketmaster'], fl: ['FL-02'], goal: /\b(ticket|triage|file a bug)\b/i,
    triggers: ['a ticket with no file:line or log evidence'], labels: ['actionable', 'duplicate', 'severity-wrong', 'unsure'] },
  ops: { roles: ['operator', 'ops'], fl: ['FL-09'], goal: /\b(restart|playbook|runbook|start|stop)\b/i,
    triggers: ['an act the playbook step does not name', 'a second act before the first answered'], labels: ['in-step', 'wrong-target', 'unsure'] },
  review: { roles: ['reviewer'], fl: ['FL-01'], goal: /\breview\b/i,
    triggers: ['changes requested with no finding', 'approve over a failing test-run'], labels: ['sound', 'missed-bug', 'unsure'] },
  'cart-step': { roles: ['cart'], fl: ['FL-01', 'FL-17'], triggers: ['the cart sentry covers progress, receipts and scope'], labels: ['on-task', 'off-task', 'unsure'] },
})

/** The domain a run's work belongs to: its role first, then its goal's words; null for a desk turn (the said's sentry). */
export function domainOf(run = {}, goal = '') {
  if (run.desk) return null
  const role = String(run.role || '')
  for (const [d, x] of Object.entries(DOMAINS)) if (x.roles.includes(role) && !x.goal) return d
  for (const [d, x] of Object.entries(DOMAINS)) if (x.goal?.test(goal) || x.roles.includes(role)) return d
  return null
}

/**
 * Attaches the work device to a run that woke for work (fileRun calls it). With the supervisor the attach is on the bus.
 * @param {object} w
 * @param {string} [goal]
 * @param {?object} [sup]
 * @returns {?string} the domain, or null for a desk turn
 */
export function attach(w, goal = '', sup = null) {
  const domain = domainOf(w.run, goal)
  if (domain) w.workSentry = { domain, verdicts: [], tests: null }
  if (domain && sup) attachSentry(sup, w, { device: 'work', domain, seat: 'sentry' })
  return domain
}

const lines = (s) => String(s || '').split('\n').length
const writesOf = (args) => (Array.isArray(args?.edits) ? args.edits : Array.isArray(args) ? args.filter((a) => a && typeof a === 'object' && a.file) : [])

function row(w, check, action, detail, why, evidence, now, opts = {}) {
  const s = w.workSentry
  const v = opts.sup ? verdict(opts.sup, w, { check, action, detail, why, by: 'code' })
    : { run: w.id, step: w.contract?.step ?? 0, check, by: 'code', action, detail: String(detail).slice(0, 200), why: String(why).slice(0, 200), t: now }
  s.verdicts.push({ domain: s.domain, check, action, detail: v.detail, why: v.why, at: now })
  if (s.verdicts.length > 32) s.verdicts.shift()
  if (opts.dir) evidenceRow(opts.dir, { run: w.id, domain: s.domain, question: check, label: check, by: 'code', evidence, at: now }, w)
  return { ...v, domain: s.domain }
}

/**
 * Before an act goes out: the code triggers that refuse it.
 * @param {{workSentry?: object, id: string}} w
 * @param {string} tool
 * @param {*} args
 * @param {{now?: number, dir?: string, sup?: object}} [o]
 * @returns {{ok: boolean, why?: string, verdict?: object}}
 */
export function beforeIntent(w, tool, args, o = {}) {
  const s = w.workSentry
  if (!s) return { ok: true }
  const now = o.now ?? 0
  const refuse = (check, detail, why, evidence) => { const v = row(w, check, 'refuse', detail, why, evidence, now, o); return { ok: false, why: `the work sentry: ${why}`, verdict: v } }
  if (tool === 'git-commit' && (s.domain === 'patch' || s.domain === 'test-write') && s.tests !== 'pass') {
    const d = s.tests === 'fail' ? 'the last test-run failed' : 'no test-run yet'
    return refuse('commit-before-tests', d, `commit only after a passing test-run (${d})`, JSON.stringify(args))
  }
  if (tool === 'patch') {
    for (const e of writesOf(args)) {
      const text = String(e.write ?? e.content ?? '')
      if (!text.trim()) return refuse('empty-write', `${e.file} would be written empty`, `${e.file} would be written empty`, JSON.stringify(e).slice(0, 400))
      if (lines(text) > 500 && !/\.(md|slat|json|txt)$/.test(String(e.file))) {
        return refuse('past-500-lines', `${e.file} would be ${lines(text)} lines`, `${e.file} would be ${lines(text)} lines; split it by responsibility or file a split ticket (O32)`, String(e.file))
      }
      if (/(^|\/)test\//.test(String(e.file)) && /\b(test|it|describe)\.(skip|todo)\(|\bskip:\s*true\b/.test(text)) {
        return refuse('test-skipped', `${e.file} skips a test`, `${e.file} skips a test; a skipped test is not a fix`, text.slice(0, 600))
      }
      if (s.domain === 'test-write' && /(^|\/)test\//.test(String(e.file)) && !/\bassert\b|\bexpect\(/.test(text)) {
        return refuse('no-assertion', `${e.file} has no assertion`, `${e.file} has no assertion`, text.slice(0, 600))
      }
    }
    for (const d of Array.isArray(args?.delete) ? args.delete : []) {
      if (/(^|\/)test\//.test(String(d))) return refuse('test-deleted', `${d} would be deleted`, `${d} would be deleted; a deleted test is not a fix`, String(d))
    }
  }
  return { ok: true }
}

/**
 * A result landed: the sentry keeps what later checks need (the last test-run's exit).
 * @param {{workSentry?: object}} w
 * @param {{tool: string, value: object}} r
 */
export function afterResult(w, r) {
  const s = w.workSentry
  if (!s || (r.tool !== 'test-run' && r.tool !== 'strict')) return
  const exit = Number(r.value?.exit ?? r.value?.rows?.exit ?? NaN)
  s.tests = exit === 0 ? 'pass' : 'fail'
}

/**
 * The run ends: its words against its record.
 * @param {{workSentry?: object, id: string}} w
 * @param {string|null} answer
 * @param {{now?: number, dir?: string, sup?: object}} [o]
 * @returns {object|null} the verdict, or null
 */
export function finishCheck(w, answer, o = {}) {
  const s = w.workSentry
  if (!s || !answer) return null
  if (/\b(tests? (pass(ed)?|are green|green)|all (tests )?pass(ing)?)\b/i.test(answer) && s.tests !== 'pass') {
    const d = s.tests === 'fail' ? 'says tests pass; the last test-run failed' : 'says tests pass; no test-run ran'
    return row(w, 'claims-tests-pass', 'note', d, `the answer claims the tests pass and the record says otherwise (${d})`, String(answer).slice(0, 600), o.now ?? 0, o)
  }
  return null
}
