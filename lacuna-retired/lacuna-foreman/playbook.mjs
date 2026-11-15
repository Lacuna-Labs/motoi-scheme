// playbook.mjs — THE PLAYBOOK LOADER. Owns: reading every `playbooks/*.slat` with the one reader (slat-data), checking
// the tree (one `(playbook …)` form, its fields, every `(step n (unit "…") …)`), the UNIT TABLE a step's unit must
// resolve against (the hands' reads and acts, the worker verbs, the mind jobs as `mind:<name>`, the structural `ask`),
// the ten named `when` conditions, and the index rows `(playbook-row (@ …))`. Refuses: a unit outside the table (a prose
// step like "restore to scratch…"), a `when` outside the ten, a unit the playbook's `(may …)` does not name, a field
// the form does not have — each as `{playbook, step, unit, why}` and the playbook marked `refused` (exit 12); nothing
// here runs a step. Implements: LACUNA-MINDS-1.0 §5.2 (the switchboard: a step lands only on a line that exists),
// LACUNA-UNITS-OF-WORK-1.0 §1 (the unit library), playbooks/README.md (the owed loader). Invariants (§18): "a step names
// a unit in the table or the playbook does not load". Faults (§16): F-02 (a unit outside the header, exit 12).
//
// THE UNIT TABLE, in resolution order: a hands read (`READS` of lacuna-executor/reads.mjs) · a hands act (`ACT_OPS` of
// lacuna-executor/acts.mjs) · a worker verb (capabilities.mjs VERBS, the table verbs.mjs defines from) · a mind job the
// playbook declares under `(minds …)`, written `(unit "gist")` or `(unit "mind:gist")` · the structural `ask`. The
// foreman's jail (foreman.sb, law 4) reads lacuna-foreman and lacuna-scheme only, so the import of lacuna-executor can be
// refused at run time: then the caller's `units` table stands in; without one, reads fall back to capabilities.mjs
// HAND_READS (the foreman's own copy of the read table) and acts resolve to nothing, said in each fault's `why`.
//
// THE TEN `when` CONDITIONS (evaluated by playbook-run.mjs over the previous step's result `v` and, in an `each`, the row):
//   "pass"            the previous step's receipt has exit 0
//   "down"            v.ok is #f, or v.status ≥ 500
//   "up"              a previous result exists and it is not down
//   "P0" · "P1"       the row's (else v's) `priority` is P0 · P1
//   "P2+"             the row's (else v's) `priority` is P2, P3 or P4
//   "under the line"  v.under_line is #t (disk-usage against the 5 % line)
//   "bundles > 3"     v has more than 3 rows
//   "budget breached" v.breached is #t (the page budget)
//   "any step fails"  structural: the step runs only after an earlier step failed (the failure arm)
// Anything else is refused at load with the sentence naming the step; the playbook says what it needs instead.
import fs from 'node:fs'
import path from 'node:path'
import { readForms, writeData } from '../../lacuna-scheme/src/slat-data.js'
import { VERBS, HAND_READS } from './capabilities.mjs'

/** The mind jobs a playbook may name (LACUNA-UNITS-OF-WORK-1.0 §1.4; day-report's herald and release-train's scribe; the Arcade's and
 *  the Factory's `maker`, job class `files`, lane L3 2026-10-24). */
export const MIND_JOBS = Object.freeze(['gist', 'triage', 'verdict', 'nearness', 'janitor', 'scribe', 'herald', 'pick-fix', 'maker'])
/** The label sets a job class fixes (MINDS §7.1: a small mind answers under a form, never bare); a playbook may name its own `(labels …)`. */
export const JOB_LABELS = Object.freeze({ 'yes-no': ['yes', 'no'], 'signal->label': ['noise', 'real-error', 'regression', 'new-thing', 'recovered', 'needs-owner'] })
/** The named conditions (the header says what each reads). `unhealthy`, `expiring`, `stale`, `flapping` joined on 2026-10-24 for
 *  loam-down, cert-and-door and service-return: each is one boolean the previous unit answers (`unhealthy`, `expiring`, `stale`,
 *  `flapping`), never a threshold the runner computes (the unit owns its line). */
export const WHEN = Object.freeze(['pass', 'down', 'up', 'P0', 'P1', 'P2+', 'under the line', 'bundles > 3', 'budget breached', 'any step fails', 'unhealthy', 'expiring', 'stale', 'flapping'])
/** The fields of a `(playbook …)` form: required first. */
export const FIELDS = Object.freeze(['id', 'version', 'cart', 'type', 'steps', 'trigger', 'press', 'may', 'never', 'minds', 'judgment', 'done-check', 'exam', 'report'])
const REQUIRED = FIELDS.slice(0, 5)
const STEP_FIELDS = new Set(['unit', 'args', 'deadline-s', 'done', 'each', 'when', 'judgment'])
/** A refused playbook's exit (design §17). */
export const EXIT_REFUSED = 12

const word = (x) => (x && typeof x === 'object' && typeof x.name === 'string' ? x.name : null)
const isForm = (f, head) => Array.isArray(f) && f.length >= 1 && word(f[0]) === head

/**
 * The unit table: name → {kind}. `reads`, `acts`, `verbs`, `minds` are lists of names; what is missing is taken from the
 * default sources (the hands' tables when their import is admitted, else the foreman's own copy of the reads).
 * @param {{reads?: string[], acts?: string[], verbs?: string[], minds?: string[]}} [o]
 * @returns {Promise<{table: Map<string, {kind: string}>, source: string}>} the table and where its reads and acts came from
 */
/** The units file: `{at, reads: [name], acts: [name]}`, or null when it is absent or not that shape. */
function readUnitsFile(file) {
  try {
    const d = JSON.parse(fs.readFileSync(file, 'utf8'))
    const names = (a) => Array.isArray(a) && a.every((x) => typeof x === 'string' && /^[a-z][a-z0-9-]{0,40}$/.test(x))
    return names(d.reads) && names(d.acts) ? d : null
  } catch { return null }
}

export async function unitTable(o = {}) {
  let reads = o.reads, acts = o.acts, source = 'injected'
  if (!reads || !acts) {
    try {
      const [r, a] = await Promise.all([import('../../lacuna-executor/reads.mjs'), import('../../lacuna-executor/acts.mjs')])
      reads ||= Object.keys(r.READS); acts ||= [...a.ACT_OPS]; source = 'lacuna-executor'
    } catch (e) {
      // under foreman.sb the hands' modules are not readable (law 4): the table the restart tool wrote into the foreman's
      // folder (tools/restart.mjs, `units.json`: the hands' READS and ACT_OPS by name) stands in; without it, reads only
      const file = o.unitsFile ? readUnitsFile(o.unitsFile) : null
      if (file) { reads ||= file.reads; acts ||= file.acts; source = `${o.unitsFile} (written ${file.at || 'at an unknown time'}; the hands' modules are outside the jail)` }
      else {
        reads ||= [...HAND_READS]; acts ||= []
        source = `the hands' table could not be read (${String(e.message || e).slice(0, 80)}): reads from capabilities.mjs HAND_READS, no acts`
      }
    }
  }
  const table = new Map()
  const put = (names, kind) => { for (const n of names) if (!table.has(n)) table.set(String(n), { kind }) }
  put(['ask'], 'ask')                                   // structural first: the verb `ask` is the same line, run as a want row
  put(reads, 'read'); put(acts, 'act'); put(o.verbs || VERBS.map((v) => v.name), 'verb')
  put((o.minds || MIND_JOBS).map((m) => `mind:${m}`), 'mind')
  return { table, source }
}

/**
 * Read every `*.slat` in `dir` and check each tree. Never throws for a bad playbook: it is a `refused` row with its faults.
 * @param {string} dir the playbooks directory
 * @param {{units?: {reads?: string[], acts?: string[], verbs?: string[], minds?: string[]}, unitsFile?: string}} [o] a unit table to stand in for the hands' import;
 *   `unitsFile` is read only when the hands' modules cannot be imported (the jail)
 * @returns {Promise<{playbooks: Array<object>, rows: Array<object>, faults: Array<{playbook: string, step: ?number, unit: ?string, why: string}>, source: string}>}
 */
export async function loadPlaybooks(dir, o = {}) {
  const { table, source } = await unitTable({ ...(o.units || {}), ...(o.unitsFile ? { unitsFile: o.unitsFile } : {}) })
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.slat') && !/^INDEX/.test(f)).sort()
  const playbooks = files.map((f) => readPlaybook(path.join(dir, f), table, source))
  return { playbooks, rows: playbookRows(playbooks), faults: playbooks.flatMap((p) => p.faults), source }
}

/**
 * One file → one playbook, `ready` or `refused` with every fault named.
 * @param {string} file
 * @param {Map<string, {kind: string}>} table the unit table
 * @param {string} [source] where the table's reads and acts came from (said in an unresolved unit's `why`)
 * @returns {object} {id, version, cart, type, trigger, press, may, never, minds, steps, judgment, doneCheck, exam, report, state, exit, faults, file}
 */
export function readPlaybook(file, table, source = 'lacuna-executor') {
  const id0 = path.basename(file, '.slat')
  const faults = []
  const fault = (why, step = null, unit = null) => faults.push({ playbook: id0, step, unit, why })
  let forms
  try { forms = readForms(fs.readFileSync(file, 'utf8')) } catch (e) { fault(`the file does not read as slat data: ${e.message}`); return refused(id0, file, faults) }
  if (forms.length !== 1 || !isForm(forms[0], 'playbook')) { fault(`a playbook file holds exactly one (playbook …) form, this one ${forms.length === 1 ? 'opens with ' + (word(forms[0]?.[0]) || 'data') : 'holds ' + forms.length}`); return refused(id0, file, faults) }
  const f = new Map()
  for (const x of forms[0].slice(1)) {
    const k = Array.isArray(x) ? word(x[0]) : null
    if (!k || !FIELDS.includes(k)) { fault(`the field ${k ? `(${k} …)` : JSON.stringify(x)} is not one of ${FIELDS.join(' ')}`); continue }
    if (f.has(k)) fault(`the field (${k} …) appears twice`)
    f.set(k, x.slice(1))
  }
  for (const k of REQUIRED) if (!f.has(k)) fault(`the field (${k} …) is required`)
  const one = (k, type) => { const v = f.get(k)?.[0]; if (f.has(k) && (f.get(k).length !== 1 || typeof v !== type)) fault(`(${k} …) holds one ${type}`); return typeof v === type ? v : null }
  const id = one('id', 'string')
  if (f.has('id') && id !== id0) fault(`the id "${id}" is not the file name ${id0}`)
  const pb = {
    id: id0, version: one('version', 'number'), cart: one('cart', 'string'), type: one('type', 'string') || '',
    trigger: f.get('trigger') || [], press: one('press', 'string') || 'none', may: (f.get('may') || []).map((m) => word(m) || String(m)),
    never: (f.get('never') || []).map(String), minds: readMinds(f.get('minds') || [], fault), judgment: f.get('judgment')?.[0] ?? null,
    doneCheck: one('done-check', 'string') || '', exam: one('exam', 'string') || '', report: (f.get('report') || []).map((r) => word(r?.[0]) || String(r)),
    steps: [], file,
  }
  for (const m of Object.keys(pb.minds)) if (!MIND_JOBS.includes(m)) fault(`the mind ${m} is not one of ${MIND_JOBS.join(' ')}`)
  const allowed = new Set([...pb.may, ...Object.keys(pb.minds), ...Object.keys(pb.minds).map((m) => `mind:${m}`), 'ask'])
  let last = -1
  for (const s of f.get('steps') || []) {
    const step = readStep(s, pb, table, allowed, source, fault)
    if (!step) continue
    if (step.n <= last) fault(`step ${step.n} is out of order (after ${last})`, step.n, step.unit)
    last = step.n
    pb.steps.push(step)
  }
  if (f.has('steps') && !pb.steps.length) fault('(steps …) holds at least one step')
  pb.faults = faults
  pb.unresolved = faults.filter((x) => x.unit && /not in the unit table/.test(x.why)).map((x) => x.unit)
  pb.state = faults.length ? 'refused' : 'ready'
  pb.exit = faults.length ? EXIT_REFUSED : null
  return pb
}

const refused = (id, file, faults) => ({ id, file, version: null, cart: null, type: '', steps: [], minds: {}, may: [], faults, unresolved: [], state: 'refused', exit: EXIT_REFUSED })

// (minds (triage (job "signal->label") (level "L3") [(role swe) (function systems-code) (budget in out)]) …) → {triage: {job, level, role, function, budget}}
function readMinds(forms, fault) {
  const out = {}
  for (const m of forms) {
    const name = Array.isArray(m) ? word(m[0]) : null
    if (!name) { fault(`a mind is (name (job "…") (level "…") [(labels a b …)]), not ${JSON.stringify(m)}`); continue }
    const spec = {}
    for (const e of m.slice(1)) { const k = Array.isArray(e) ? word(e[0]) : null; if (k === 'job' || k === 'level' || k === 'role' || k === 'function') spec[k] = String(e[1] ?? ''); else if (k === 'budget') spec.budget = { in: Number(e[1]), out: Number(e[2]) }; else if (k === 'labels') spec.labels = e.slice(1).map((x) => String(word(x) ?? x)); else fault(`the mind ${name} has a field that is not job or level`) }
    out[name] = { job: spec.job || null, level: spec.level || null, labels: spec.labels || JOB_LABELS[spec.job] || null,
                  role: spec.role || null, function: spec.function || null, budget: spec.budget && Number.isFinite(spec.budget.in) && Number.isFinite(spec.budget.out) ? spec.budget : null }   // R1.4: the router's ask
  }
  return out
}

// (step n (unit "…") (args "…") (deadline-s s) (done "…") [(each "…")] [(when "…")] [(judgment #t)]) → the step, or null
function readStep(s, pb, table, allowed, source, fault) {
  if (!isForm(s, 'step') || typeof s[1] !== 'number' || !Number.isInteger(s[1]) || s[1] < 0) { fault(`a step is (step n (unit "…") …) with n a whole number, not ${JSON.stringify(s).slice(0, 80)}`); return null }
  const n = s[1]
  const g = {}
  for (const x of s.slice(2)) {
    const k = Array.isArray(x) ? word(x[0]) : null
    if (!k || !STEP_FIELDS.has(k)) { fault(`step ${n} has a field that is not one of ${[...STEP_FIELDS].join(' ')}`, n); continue }
    g[k] = x[1]
  }
  if (typeof g.unit !== 'string' || !g.unit) { fault(`step ${n} names no unit`, n); return null }
  const unit = g.unit
  const key = table.has(unit) ? unit : table.has(`mind:${unit}`) && pb.minds[unit] ? `mind:${unit}` : null
  const entry = key ? table.get(key) : null
  if (!entry) fault(`step ${n}: the unit "${unit}" is not in the unit table (${source === 'lacuna-executor' ? 'reads, acts, verbs, declared minds, ask' : source})`, n, unit)
  else if (entry.kind === 'mind' && !pb.minds[unit.replace(/^mind:/, '')]) fault(`step ${n}: the mind ${unit} is not declared under (minds …)`, n, unit)
  else if (!allowed.has(unit) && !allowed.has(key)) fault(`step ${n}: the unit "${unit}" is not in (may …)`, n, unit)
  if (g['deadline-s'] !== undefined && !(typeof g['deadline-s'] === 'number' && g['deadline-s'] >= 0)) fault(`step ${n}: (deadline-s …) is seconds ≥ 0`, n, unit)
  if (g.when !== undefined && !WHEN.includes(g.when)) fault(`step ${n}: (when "${String(g.when)}") is not one of the named conditions: ${WHEN.map((w) => `"${w}"`).join(' ')}`, n, unit)
  if (g.each !== undefined && typeof g.each !== 'string') fault(`step ${n}: (each "…") names what it iterates`, n, unit)
  return { n, unit, kind: entry ? entry.kind : null, mind: entry?.kind === 'mind' ? unit.replace(/^mind:/, '') : null, args: g.args == null ? '' : String(g.args),
           deadline_s: typeof g['deadline-s'] === 'number' ? g['deadline-s'] : null, done: g.done == null ? '' : String(g.done),
           each: typeof g.each === 'string' ? g.each : null, when: typeof g.when === 'string' ? g.when : null, judgment: g.judgment === true }
}

/**
 * The index rows: one object per playbook, the shape `indexText` writes as `(playbook-row (@ …))`.
 * @param {Array<object>} playbooks from loadPlaybooks
 * @returns {Array<{id: string, version: ?number, cart: ?string, type: string, steps: number, units: string[], unresolved: string[], state: string, faults: number}>}
 */
export function playbookRows(playbooks) {
  return playbooks.map((p) => ({ id: p.id, version: p.version, cart: p.cart, type: p.type, steps: p.steps.length,
    units: [...new Set(p.steps.map((s) => s.unit))], unresolved: [...new Set(p.unresolved)], state: p.state, faults: p.faults.length }))
}

/**
 * The rows as slat text, one `(playbook-row (@ …))` per line (the INDEX.slat the foreman keeps in its folder).
 * @param {Array<object>} rows from playbookRows
 * @returns {string}
 */
export function indexText(rows) {
  return rows.map((r) => `(playbook-row ${writeData(r)})`).join('\n') + '\n'
}
