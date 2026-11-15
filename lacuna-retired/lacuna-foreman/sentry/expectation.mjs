// sentry/expectation.mjs — THE WORK SENTRY READS THE EXPECTATION (docs/eng/finale-1.0/WORK-CHIPS-CHAT-DESIGN-2026-11-06.md §7.1–
// §7.3, part P7). Owns: a run's expectations (the order's `expect` on the contract, filed with the run; the step's `gives`, its
// `(text "…")` forms, through the latch; each task's `expected`, kept by its ticket), the check at a step's boundary (the step's
// expectation against the step's receipts: code first, the 1B's `met?` for what code cannot test, one `met?` verdict with `met`
// and `side`), and the job-end row (a run that ends with its order's expectation unmet by its receipts: `thinking` when every
// task met its own, `tool` when one did not). Refuses: to pass or fail a run (the done-check does, law 6: the expectation explains
// a step); to kick (a side is a word on a warn until a domain's sitting proves it, SENTRY-2.0 §8). Implements: §7.1 (the three
// places), §7.2's job-end row, §7.3 (the order's expectation first). Invariants (§18): "a verdict never changes a record".
// Faults (§16): F-S1 (a late labeler is `unsure`, counted).
import { currentStep } from '../latch.mjs'
import { verdict } from './verdicts.mjs'
import { met as metLabel } from './labeler.mjs'
import { endSide, metByCode } from './met.mjs'

/** The longest expectation kept, in characters (one sentence, never a plan). */
export const EXPECT_MAX = 300
const one = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, EXPECT_MAX)

/** A result's words, for code to look in: its text rows, its why, else its data. */
export function textOf(v) {
  if (v == null) return ''
  if (typeof v === 'string') return v
  return [v.rows?.text, v.text, v.why, typeof v.rows === 'object' && !v.rows?.text ? JSON.stringify(v.rows) : ''].filter(Boolean).join('\n')
}

/** The expectation the work sentry reads first (§7.3): the order's, else the current step's `gives` sentences. → {expected, from} | null */
export function expectationOf(w) {
  if (w.contract?.expect) return { expected: one(w.contract.expect), from: 'order' }
  const gives = (currentStep(w)?.gives || []).filter((g) => g.kind === 'text').map((g) => g.text).join('; ')
  return gives ? { expected: one(gives), from: 'step' } : null
}

/** Keep a task's expectation by its ticket (intents.mjs, when an intent carries `expected`). */
export function keepTaskExpect(w, ticket, expected) {
  if (expected) ((w.run.expects ||= {})[ticket] = one(expected))
}

/** The run's tasks that carried an expectation, each met or not by its own receipt. */
export function tasksOf(w) {
  return (w.run?.results || []).filter((r) => w.run.expects?.[r.ticket]).map((r) => ({ ticket: r.ticket, ...metByCode(w.run.expects[r.ticket], textOf(r.value)) }))
}

/**
 * At a step's boundary: the step's expectation against what came back. Code first; the 1B only when code cannot tell and the
 * run asks its questions. → the verdict row, or null when there is no expectation or no receipt yet.
 * @param {object} sup @param {object} w @param {{step?: number, ask?: boolean}=} o
 */
export async function stepCheck(sup, w, o = {}) {
  const e = expectationOf(w)
  const results = (w.run?.results || []).slice(-8)
  if (!e || !results.length) return null
  const text = results.map((r) => textOf(r.value)).join('\n')
  let { met, missing } = metByCode(e.expected, text), by = 'code'
  if (met === 'unsure' && o.ask) { const l = await metLabel(sup, w, { expected: e.expected, got: text }); met = l.label; by = l.by }
  const failed = results.some((r) => Number(r.value?.exit ?? 0) !== 0)
  const side = met === 'unmet' ? (failed ? 'tool' : 'world') : 'none'
  return verdict(sup, w, { check: 'met?', action: met === 'unmet' ? 'warn' : 'note', by, met, side, step: o.step,
    detail: `${e.from}: ${e.expected}`, why: met === 'unmet' ? `the ${e.from}'s expectation is not in what came back${missing ? ` (missing ${missing.join(', ')})` : ''}` : met === 'met' ? `what came back shows the ${e.from}'s expectation` : `no word on the ${e.from}'s expectation (${by})` })
}

/**
 * The job-end row (§7.2's last): a run ending with its order's expectation unmet by its receipts says which side failed.
 * → the verdict row, or null when the order had no expectation, or its receipts meet it, or code cannot tell.
 * @param {object} sup @param {object} w
 */
export function endCheck(sup, w) {
  const expect = w.contract?.expect
  if (!expect) return null
  const r = metByCode(expect, (w.run?.results || []).map((x) => textOf(x.value)).join('\n'))
  if (r.met !== 'unmet') return null
  const tasks = tasksOf(w), side = endSide(tasks)
  return verdict(sup, w, { check: 'met?', action: 'warn', by: 'code', met: 'unmet', side, detail: `order: ${one(expect)}`,
    why: side === 'thinking' ? 'every task met its own expectation and the order\'s is unmet: the chain of tasks went wrong' : `a task missed its own expectation (${tasks.filter((t) => t.met === 'unmet').map((t) => t.ticket).join(', ')}): the tool or the world` })
}
