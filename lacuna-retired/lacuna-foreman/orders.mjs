// orders.mjs — THE OWNER'S SCHEME (work order O20, O21; OFFICE-PROTOCOL §5). Owns: `do` — one Scheme form from the owner run
// as a worker under the foreman's engine (its tier, its fuel, its verbs; an act still goes to the press), the form's value
// and the first hand or act reply reported back as `(report 'do …)`; and the standing orders — every `.scm` file in
// `<foreman>/orders/`, loaded at boot like a cart (one living worker per file, by name `order:<file>`, never doubled),
// re-armed by name on a restart (the supervisor's resume), a file that does not read refused with its sentence.
// Refuses: a form from anyone but the owner's road (the route checks the foreman token; a model's words are data, never
// run: "Slat is data, Scheme is code", §5); a form over the program limit; an act tier unless asked (`tier: act`), and even
// then every act waits for its press (law 4). Implements: O20, O21. Invariants (§18): "if an act ran, a press preceded it";
// "one living worker per order". Faults (§16): F-02 via the supervisor's verbs.
import fs from 'node:fs'
import path from 'node:path'

let seq = 0

/**
 * The worker program for one owner form: the value reported at once, and the first hand or act reply after it.
 * @param {string} form the owner's Scheme text
 * @returns {string}
 */
export function doProgram(form) {
  const f = String(form || '').trim()
  if (!f) throw new Error('lacuna do takes one Scheme form')
  return `(on 'hand (lambda (r) (report 'do r) (stop)))\n(on 'act (lambda (r) (report 'do r) (stop)))\n(report 'do-value ${f})`
}

/**
 * Runs one owner form. → the worker, named `do:<n>`.
 * @param {object} sup the supervisor
 * @param {string} form
 * @param {{tier?: string}} [o]
 */
export function runDo(sup, form, o = {}) {
  seq += 1
  return sup.spawn({ name: `do:${seq}`, program: doProgram(form), tier: o.tier === 'act' ? 'act' : 'watch', by: 'owner', restart: 'temporary' })
}

/** What a `do` worker said: its state and its `do` reports. */
export function doResult(w) {
  if (!w) return { ok: false, why: 'no such do' }
  return { ok: w.state !== 'grave', id: w.id, state: w.state, why: w.state === 'grave' ? w.last : undefined,
    value: (w.reports || []).find((r) => r.kind === 'do-value')?.data?.[0] ?? null, reply: (w.reports || []).find((r) => r.kind === 'do')?.data?.[0] ?? null }
}

/**
 * Loads the standing orders: one worker per `.scm` file, by name, never twice.
 * @param {object} sup
 * @param {string} dir `<foreman>/orders`
 * @param {{log?: function}} [o]
 * @returns {{spawned: string[], kept: string[], refused: Array<{name: string, why: string}>}}
 */
export function loadOrders(sup, dir, o = {}) {
  const log = o.log || (() => {})
  const out = { spawned: [], kept: [], refused: [] }
  let files = []
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.scm') && !f.startsWith('.')).sort() } catch { return out }
  for (const f of files) {
    const name = `order:${f.replace(/\.scm$/, '')}`.slice(0, 60)
    if (sup.living().some((w) => w.name === name)) { out.kept.push(name); continue }
    try {
      const w = sup.spawn({ name, program: fs.readFileSync(path.join(dir, f), 'utf8'), by: 'owner', tier: 'watch' })
      if (w.state === 'grave') out.refused.push({ name, why: w.last })
      else out.spawned.push(name)
    } catch (e) { out.refused.push({ name, why: String(e.message || e) }) }
  }
  log(`orders: ${out.spawned.length} spawned (${out.spawned.join(' ') || '-'}), ${out.kept.length} living, ${out.refused.length} refused`)
  return out
}
