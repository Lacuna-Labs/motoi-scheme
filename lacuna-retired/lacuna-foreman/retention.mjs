// retention.mjs — RETENTION AS DATA, THE READER (lane R1, unit R1.7; ROLEBENCH-2.0 §7). Owns: reading `retention.slat`
// (one `(class name (holds "…") (paths "glob" …) (keep days|forever) (past drop|condense|forever) [(condense cadence …)])`
// per ledger class) into rows, with one sentence on a defect; `ruleFor(path)`, the class a file falls under by its globs
// (the first match in file order, or null: unruled, kept and named by the audit); `expired(rule, ageDays)`, whether a row of
// that age is past its time; the audit's plan for a set of files (`plan`): what to drop, what to condense, what stands, and
// what is unruled. Refuses: deleting anything (the plan is rows; the cart acts and writes the `(dropped …)` row); a keep that
// is not a whole number of days or `forever`; a `past` outside drop · condense · forever; a class named twice. Implements:
// R1.7; the owner's notes 2026-10-30 ("compression, retention, audit"). Invariants (design §18): "every drop a row".
// Faults (§16): none.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readForms, dataToJson } from '../../lacuna-scheme/src/slat-data.js'

/** The file beside this module. */
export const RETENTION_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'retention.slat')
export const PAST = Object.freeze(['drop', 'condense', 'forever'])

const word = (x) => (x && typeof x === 'object' && typeof x.name === 'string' ? x.name : typeof x === 'string' ? x : null)
const isForm = (f, head) => Array.isArray(f) && f.length >= 1 && word(f[0]) === head
const part = (f, name) => f.slice(1).find((x) => isForm(x, name))

/**
 * Reads the retention table.
 * @param {string} text the slat text
 * @returns {{version: number, date: ?string, classes: Array<{name: string, holds: string, paths: string[], keepDays: ?number, past: string, condense: ?{cadence: string, into: ?string}}>}}
 * @throws {Error} one sentence naming the class and the fault
 */
export function readRetention(text) {
  let forms
  try { forms = readForms(String(text || '')) } catch (e) { throw new Error(`retention.slat does not read: ${e.message}`) }
  const f = forms.find((x) => isForm(x, 'retention'))
  if (!f || forms.length !== 1) throw new Error('retention.slat is exactly one (retention …) form')
  const version = part(f, 'version') ? Number(part(f, 'version')[1]) : 1
  const date = part(f, 'date') ? String(dataToJson(part(f, 'date')[1])) : null
  const classes = []
  const seen = new Set()
  for (const c of f.slice(1).filter((x) => isForm(x, 'class'))) {
    const name = word(c[1])
    if (!name) throw new Error('a class names itself: (class name …)')
    if (seen.has(name)) throw new Error(`class ${name} twice`)
    seen.add(name)
    const paths = (part(c, 'paths') || []).slice(1).map((p) => String(dataToJson(p)))
    if (!paths.length) throw new Error(`class ${name}: (paths "glob" …) names at least one glob`)
    const keep = part(c, 'keep')
    if (!keep) throw new Error(`class ${name}: (keep days|forever) is missing`)
    const keepDays = word(keep[1]) === 'forever' ? null : Number(keep[1])
    if (keepDays !== null && (!Number.isInteger(keepDays) || keepDays < 0)) throw new Error(`class ${name}: keep is a whole number of days or forever`)
    const past = word(part(c, 'past')?.[1])
    if (!PAST.includes(past)) throw new Error(`class ${name}: past is one of ${PAST.join(' · ')}, not ${past}`)
    if (keepDays === null && past !== 'forever') throw new Error(`class ${name}: a class kept forever has (past forever)`)
    if (keepDays !== null && past === 'forever') throw new Error(`class ${name}: a class kept ${keepDays} days names what happens past it`)
    const cf = part(c, 'condense')
    const condense = cf ? { cadence: word(cf[1]) || String(cf[1]), into: part(cf, 'into') ? String(dataToJson(part(cf, 'into')[1])) : null } : null
    if (past === 'condense' && !condense) throw new Error(`class ${name}: (past condense) names its (condense cadence …)`)
    classes.push({ name, holds: part(c, 'holds') ? String(dataToJson(part(c, 'holds')[1])) : '', paths, keepDays, past, condense })
  }
  if (!classes.length) throw new Error('retention.slat rules at least one class')
  return { version, date, classes }
}

/** The table beside this module. */
export function loadRetention(p = RETENTION_PATH) { return readRetention(fs.readFileSync(p, 'utf8')) }

const expand = (g) => g.replace(/^~(?=\/|$)/, os.homedir())
/** A glob with `*` (no slash) and `**` to a RegExp over an absolute path. */
export function globToRegExp(glob) {
  const esc = (s) => s.replace(/[.+^${}()|[\]\\?]/g, '\\$&')
  const src = expand(glob).split('**').map((seg) => seg.split('*').map(esc).join('[^/]*')).join('.*')
  return new RegExp(`^${src}(?:/.*)?$`)
}

/**
 * The class a path falls under: the first class, in file order, with a glob that matches; null when none (unruled).
 * @param {string} p an absolute path (a `~` is expanded)
 * @param {object} [table]
 */
export function ruleFor(p, table = loadRetention()) {
  const abs = expand(String(p))
  for (const c of table.classes) if (c.paths.some((g) => globToRegExp(g).test(abs))) return c
  return null
}

/** Is a row of `ageDays` past its class's time? Never for a class kept forever. */
export function expired(rule, ageDays) {
  return rule.keepDays !== null && Number.isFinite(ageDays) && ageDays > rule.keepDays
}

/**
 * The audit's plan over files: `{drop, condense, stands, unruled}`, each a list of `{path, class, ageDays}`. Pure: nothing
 * is removed; the cart acts on the plan and writes one `(dropped …)` row per drop.
 * @param {Array<{path: string, ageDays: number}>} files
 * @param {object} [table]
 */
export function plan(files, table = loadRetention()) {
  const out = { drop: [], condense: [], stands: [], unruled: [] }
  for (const f of files) {
    const rule = ruleFor(f.path, table)
    const row = { path: f.path, class: rule?.name ?? null, ageDays: f.ageDays }
    if (!rule) out.unruled.push(row)
    else if (!expired(rule, f.ageDays)) out.stands.push(row)
    else if (rule.past === 'condense') out.condense.push(row)
    else out.drop.push(row)
  }
  return out
}
