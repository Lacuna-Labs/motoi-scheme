// sentry/locator.mjs — THE 270M LOCATOR (lane K1, unit K1.8; SENTRY-2.0 §5 S1 "3.4 the 270M locator"). Owns: the one
// question a tiny mind answers at a turn's boundary under a label grammar — which step of the ladder the mind is working:
// `step-1 … step-N | none` — from the goal's first line, the step list (each step's sentence or its allows), the said's last
// sentence and the turn's last call; its budgets (≤ 768 tokens in, ≤ 24 out; past the 3 s wall the answer is `unsure`, counted
// on the worker); the mind from the box config by seat (`host.sentryModel('label')`, the 270M's seat; never a tag in code);
// the evidence row for the domain's sitting (eval-only, law 9); and what code does with the answer: a step other than the
// latch's k is one `out-of-sequence` warn by the mind, `none` one `off-task` warn, `unsure` nothing but the count. Refuses:
// a kick (a model warns; code kicks, SENTRY-2.0 §8); a run with no latch (nothing asked); a prompt over the budget (cut).
// Implements: SENTRY-2.0 §5 (S1), §8; K1.8. Invariants (design §18): "a late or absent mind is `unsure`, never a guess".
// Faults (§16): F-S1 (no verdict within its deadline) as a count.
import { askLabel, BUDGET, evidenceRow } from './labeler.mjs'
import { verdict } from './verdicts.mjs'
import { latchOf } from '../latch.mjs'
import { sentences } from '../sentry.mjs'

/** The locator's labels for a ladder of n steps. */
export const locatorLabels = (n) => Object.freeze([...Array.from({ length: Math.max(1, n) }, (_, i) => `step-${i + 1}`), 'none'])
const words = (s, n) => String(s || '').split(/\s+/).filter(Boolean).slice(0, n).join(' ')

/** The prompt: the goal's first line, the step list, the last sentence, the last call (≤ BUDGET.chars). */
export function locatorPrompt({ goal, steps, sentence, call }) {
  const list = steps.map((s, i) => `step-${i + 1}: ${words(s.says || `calls ${s.allows.join(' ')}`, 24)}`).join('\n')
  const labels = locatorLabels(steps.length)
  const text = `Goal: ${words(String(goal || '').split('\n')[0], 40)}\nThe steps:\n${list}\nThe mind's last sentence: "${words(sentence, 60)}"\nIts last call: ${call || 'none'}\n` +
    `Answer the step the mind is working: ${labels.slice(0, -1).map((l) => `(label '${l})`).join(' ')}; (label 'none) if it works none of them.`
  return text.length > BUDGET.chars ? text.slice(0, BUDGET.chars) : text
}

/**
 * Ask the locator once. → {label: 'step-k'|'none'|'unsure', by, ms}. Never throws.
 * @param {object} sup @param {object} w the run
 * @param {{goal: string, steps: Array<{says: ?string, allows: string[]}>, sentence: string, call: ?string}} q
 */
export async function locate(sup, w, q) {
  const r = await askLabel(sup, { name: 'locate?', labels: locatorLabels(q.steps.length) }, locatorPrompt(q), { seat: 'label' })
  const st = (w.sentry ||= {})
  const c = (st.locator ||= { asked: 0, located: 0, unsure: 0, late: 0, none: 0, dropped: 0 })
  c.asked++
  if (r.by !== '270m' && r.by !== '1b') { if (r.by === 'late') c.late++; else if (r.by === 'none') c.none++; else c.dropped++ }
  if (r.label === 'unsure') c.unsure++; else c.located++
  return r
}

/**
 * The boundary's locator check: with a latch open, where does the mind say it is? → the verdict row or null.
 * @param {object} sup @param {object} w @param {{said: string}} slice @param {{dir?: string, domain?: string}} [o]
 */
export async function locateCheck(sup, w, slice, o = {}) {
  const latch = latchOf(w)
  if (!latch || latch.closed) return null
  const steps = w.latchLadder.steps
  const sentence = sentences(slice.said).at(-1) || ''
  const last = (w.run?.results || []).at(-1)
  const r = await locate(sup, w, { goal: w.contract.goal, steps, sentence, call: last ? `${last.tool} (result ${last.n})` : null })
  const by = r.by === '1b' ? '270m' : r.by
  if (o.dir) evidenceRow(o.dir, { run: w.id, domain: o.domain || 'desk', question: 'locate?', label: r.label, by, evidence: `k ${latch.k}; "${sentence.slice(0, 200)}"`, at: sup.host.now() }, w)
  if (r.label === 'unsure') return null
  if (r.label === 'none') return verdict(sup, w, { check: 'off-task', action: 'warn', by: '270m', step: latch.k, detail: sentence.slice(0, 200), why: `the locator reads the turn as none of ${latch.playbook}'s ${steps.length} steps` })
  const j = Number(r.label.slice(5))
  if (j === latch.k) return null
  return verdict(sup, w, { check: 'out-of-sequence', action: 'warn', by: '270m', step: latch.k, detail: sentence.slice(0, 200), why: `the locator reads the turn as step ${j} of ${latch.playbook}; the latch is at step ${latch.k}` })
}
