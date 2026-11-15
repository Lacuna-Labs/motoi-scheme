// trial.mjs — THE READERS OF A WORKER. Owns: the dry run before anyone is asked (`trial`: load a program in a scratch
// supervisor with no upstream and give every handler a sample, so a bad report is seen before it ships) and the record
// of a worker as the desk reads it (`describe`). Refuses: changing a worker (both only read); reaching the box (the
// scratch supervisor has no upstream, no hands, no mind). Implements: LACUNA-3.0-DESIGN §12 (carts: a trial before a
// cart serves), §13 (what the desk reads). Invariants (§18): none of its own. Faults (§16): F-07 (a trial names what a
// cart's handler cannot take). Moved out of supervisor.mjs 2026-10-24 (the size law; SRE ch. 9).
import { readFileSync } from 'node:fs'
import { apply, symOf } from './scheme.mjs'
import { HAND_READS } from './capabilities.mjs'
import { aliveFields } from './alive.mjs'
import { Supervisor, LIMITS, plainKv } from './supervisor.mjs'
import { readVerbTable } from './verb-table.mjs'

/** A DRY RUN before anyone is asked (the brain fixes its own mistakes first): load the program in a scratch supervisor
 *  with no upstream, then give every handler a sample — a number for a metric, a small list for the rest. Text a report
 *  would carry is returned, so a report that says '%.2f' is seen before it ships. */
const KNOWN = (() => {
  try {
    const v = readVerbTable(readFileSync(new URL('./verbs.slat', import.meta.url), 'utf8'))
    const metrics = new Set((v.verbs.find((x) => x.name === 'subscribe') || {}).metrics || [])
    return { metrics, ops: HAND_READS }
  } catch { return null }
})()

export function trial(program, tables = null) {
  const said = []
  const scratch = new Supervisor({ now: () => 0, id: () => `t${said.length}${Math.random()}`, save: () => {}, trial: true,
                                   tables: tables ? () => tables : undefined,
                                   upstream: (kind, w, data) => said.push({ kind, data }) })
  let w
  try { w = scratch.spawn({ name: 'trial', program: String(program || '') }) } catch (e) { return { ok: false, problems: [String(e.message)] } }
  if (w.state === 'grave') return { ok: false, problems: [`it does not load — ${w.last}`] }
  const problems = []
  if (KNOWN) {
    for (const s of w.subs) if (!KNOWN.metrics.has(s.metric)) problems.push(`there is no metric '${s.metric} — use one of ${[...KNOWN.metrics].join(', ')}`)
    for (const u of said) if (u.kind === 'hand' && !KNOWN.ops.has(u.data.op)) problems.push(`there is no hand '${u.data.op} — use one of ${[...KNOWN.ops].join(', ')}`)
  }
  // a cart: every label of every mind is tried first, so each branch of its (on 'mind …) runs before anyone is asked
  for (const [job, m] of Object.entries(w.cart?.minds || {})) {
    for (const label of m.labels) {
      if (w.state !== 'running') break
      const r = scratch.send(w.id, 'mind', { job, ok: true, kind: 'label', label: symOf(label), of: { line: 'a trial line', source: 'trial' } })
      if (!r.ok && !r.why?.includes('does not handle')) { problems.push(`(on 'mind …) with the label ${label}: ${r.why}`); break }
    }
  }
  for (const kind of w.handlers.keys()) {
    for (const sample of [1.0, 50.0]) {
      const r = scratch.send(w.id, kind, kind.includes('_') || kind.startsWith('up:') ? sample : [sample])
      if (!r.ok) { problems.push(`(on '${kind}) with ${sample}: ${r.why}`); break }
    }
  }
  for (const [i, f] of (w.trialTimers || []).entries()) {
    const r = scratch._run(w, () => apply(f, [], { n: LIMITS.fuelEvent }), 'every')
    if (!r.ok) { problems.push(`(every …) timer ${i + 1}: ${r.why}`); if (w.state === 'grave') break }
  }
  for (const s of said) {
    const text = JSON.stringify(s.data)
    if (/%[.0-9]*[dfsx]|~a|~s/.test(text)) problems.push(`a report would say ${text.slice(0, 120)} — format does not fill %/~ here; use (string-append "…" (number->string x))`)
  }
  for (const id of scratch.workers.keys()) scratch.stop(id, 'trial over')
  const cart = w.cart && { name: w.cart.name, exam: w.cart.exam, tier: w.cart.tier, verbs: w.cart.verbs, judgment: w.cart.judgment,
                           touches: w.cart.touches, done: w.cart.done, acts: w.cart.acts || [],
                           minds: Object.fromEntries(Object.entries(w.cart.minds).map(([j, m]) => [j, { job: m.job, model: m.model, why: m.why, role: m.role || null, rungs: m.rungs }])) }
  return { ok: problems.length === 0, problems, handles: [...w.handlers.keys()], reports: said.filter((x) => x.kind === 'report').map((x) => x.data),
           ...(cart ? { cart, hands: said.filter((x) => x.kind === 'hand').map((x) => x.data.op) } : {}) }
}

export const describe = (w) => ({
  id: w.id, name: w.name, state: w.state, tier: w.tier, parent: w.parent, children: w.children, depth: w.depth,
  by: w.by, started: w.started, crashes: w.crashes.length, last: w.last, skipped: w.skipped || 0, skip_why: w.skipWhy || null, kv: plainKv(w.kv), reports: w.reports.slice(-20),
  handles: [...w.handlers.keys()], subscriptions: w.subs, program: w.program,
  verbs: [...(w.verbs || [])].sort(), reads_untrusted: !!w.readsUntrusted, mind: w.mind || null, jobs: [...(w.jobs?.keys() || [])],
  cart: w.cart ? { name: w.cart.name, exam: w.cart.exam, outcome: w.cart.outcome, said: w.cart.said, steps: w.cart.steps.slice(-8),
                   minds: Object.fromEntries(Object.entries(w.cart.minds).map(([j, m]) => [j, { model: m.model, why: m.why }])) } : null,
  ...aliveFields(w),               // §45.3: pending, timers, subs, last_beat, beat_age_s, packet, checkpoint_t, steps, tools …
})
