// router.mjs — THE ONE ROUTER (lane R1, unit R1.4; ROLEBENCH-2.0 §5 "the authority ladder: the grid decides who decides";
// MINDS-1.0 §4.3). Owns: one decision for one unit of work — which mind takes it — from the step's class and size against the
// grid's measured cells (`grid-ledger.mjs`: a `passes` cell is the record; `advises` is advice with a warn; nothing else is
// authority), the minds that fit the step's budget (`ladder.mjs` SIZES, smallest rung first), what is resident (the brain
// and the loaded minds, which win a tie) and the climb's price against the box profile and the free memory; one climb per
// step (`from` names the rung left); the handoff form `(handoff (from)(to)(step)(why)(partial …)(at))` when nothing fits
// (`to: queue`; a second refusal: `to: waiting-owner`), written by runs.mjs. Refuses: a model (table lookups); loading or
// unloading anything (the broker and the gateway own residency); a pick with no why; a cell that is not sealed (readCells
// refuses it before this module sees it). Implements: R1.4; ROLEBENCH-2.0 §3, §5.3 (one climb per step); MINDS-1.0 §4.3
// (`assign.mjs`'s rule stays the index road for job classes the grid has no cell for). Invariants (design §18): "a claim
// is not a record" (every pick names the cell or the rule that made it). Faults (§16): none by id.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { RUNGS, SIZES, fits } from './ladder.mjs'
import { handoffLine } from './runs.mjs'
import { GRID_FILE, readCells } from './grid-ledger.mjs'
import { broker } from './broker.mjs'

/** The box profile the router prices against (the foreman's own folder). */
export const BOX_FILE = process.env.FOREMAN_PROFILE || path.join(os.homedir(), 'lacuna-world', 'foreman', 'box.slat')   // the foreman's own name for the file (foreman.mjs, governor.mjs)

/** The climb's order, smallest first, as ladder.mjs ranks the rungs; the mind ids of the grid use the same words. */
export const ORDER = Object.freeze([...RUNGS])
/** What a cell's standing is worth to the router. */
export const AUTHORITY = Object.freeze({ passes: 'record', advises: 'advice', 'not-sat': 'none' })

const rungOf = (mind) => { const i = ORDER.indexOf(String(mind || '').toLowerCase()); return i < 0 ? ORDER.length : i }
const lower = (x) => String(x || '').toLowerCase()

/**
 * The grid's cell for a mind × role × function × level, or null.
 * @param {Array<Object>} cells readCells(...).cells
 */
export function cellFor(cells, mind, role, fn, level) {
  return (cells || []).find((c) => lower(c.mind) === lower(mind) && c.role === role && c.function === fn && (!level || c.level === level)) || null
}

/**
 * The price of a mind that is not resident: its `use-mb` from the box profile against the free memory, or null when the
 * profile does not know it.
 * @param {Array<{id: string, useMb: ?number}>} box the box profile's minds
 */
export function priceOf(box, mind, availMb) {
  const row = (box || []).find((m) => lower(m.id) === lower(mind))
  if (!row || !Number.isFinite(row.useMb)) return { useMb: null, fits: null }
  return { useMb: row.useMb, fits: Number.isFinite(availMb) ? row.useMb <= availMb : null }
}

/**
 * Route one unit of work.
 * @param {{role?: string, function?: string, level?: string, jobClass?: string, step: {n?: number, budget: {in: number, out: number, s?: number}},
 *   from?: ?string, refusals?: number, urgency?: string, at?: ?string, partial?: *}} ask
 * @param {{cells?: Array<Object>, box?: Array<{id: string, useMb: ?number}>, resident?: {brain?: ?string, loaded?: string[]}, availMb?: ?number,
 *   sizes?: Object, minds?: string[]}} deps
 * @returns {{mind: ?string, why: string, cell: ?Object, authority: string, climb: boolean, rung: ?number, priceMb: ?number, candidates: string[], handoff: ?Object, handoffLine: ?string}}
 */
export function route(ask, deps = {}) {
  const sizes = deps.sizes || SIZES
  const minds = (deps.minds || Object.keys(sizes)).map(lower).sort((a, b) => rungOf(a) - rungOf(b))
  const resident = new Set([deps.resident?.brain, ...(deps.resident?.loaded || [])].filter(Boolean).map(lower))
  const start = ask.from ? rungOf(ask.from) + 1 : 0
  const step = ask.step || { budget: { in: 0, out: 0 } }
  const fitting = minds.filter((m) => rungOf(m) >= start && fits(step, m, sizes).ok)
  const candidates = fitting.map((m) => {
    const cell = ask.role && ask.function ? cellFor(deps.cells, m, ask.role, ask.function, ask.level) : null
    const standing = cell ? cell.standing : 'not-sat'
    const price = resident.has(m) ? { useMb: 0, fits: true } : priceOf(deps.box, m, deps.availMb)
    return { m, cell, standing, authority: AUTHORITY[standing] || 'none', resident: resident.has(m), price }
  })
  const rank = { record: 0, advice: 1, none: 2 }
  const admissible = candidates.filter((c) => c.price.fits !== false)
  // the grid decides who decides: a passing cell first, then advice, then the smallest fitting rung (MINDS §4.3: the lowest rung,
  // a warm mind winning a tie); a mind the box cannot load now is not admissible, so residency is a price, never a preference
  admissible.sort((a, b) => (rank[a.authority] - rank[b.authority]) || (rungOf(a.m) - rungOf(b.m)) || (Number(b.resident) - Number(a.resident)))
  const pick = admissible[0]
  const stepN = step.n ?? ask.step?.n ?? 0
  if (!pick) {
    const why = fitting.length
      ? `nothing fits: ${fitting.map((m) => `${m} needs ${priceOf(deps.box, m, deps.availMb).useMb ?? '?'} MB`).join(', ')} against ${Number.isFinite(deps.availMb) ? `${Math.round(deps.availMb)} MB free` : 'an unknown free memory'}`
      : `no mind holds step ${stepN}'s budget (${step.budget.in} in, ${step.budget.out} out)${ask.from ? ` above ${ask.from}` : ''}`
    const to = (ask.refusals || 0) >= 1 ? 'waiting-owner' : 'queue'
    const handoff = { from: ask.from || 'router', to, step: stepN, why, partial: ask.partial ?? null, at: ask.at || null }
    return { mind: null, why, cell: null, authority: 'none', climb: false, rung: null, priceMb: null, candidates: fitting, handoff, handoffLine: handoffLine(handoff) }
  }
  const climb = Boolean(ask.from) || rungOf(pick.m) > (fitting[0] ? rungOf(fitting[0]) : 0)
  const why = pick.cell
    ? `${pick.m}: the grid's cell ${pick.cell.role}/${pick.cell.function} ${pick.cell.level} ${pick.standing}${pick.cell.sitting ? ` (lb90 ${pick.cell.sitting.lb90}, n ${pick.cell.sitting.n})` : ''}${pick.resident ? '; resident' : `; to load: ${pick.price.useMb ?? '?'} MB`}`
    : `${pick.m}: the smallest rung holding step ${stepN}'s budget (${step.budget.in} in, ${step.budget.out} out)${ask.role && ask.function ? `; no cell for ${ask.role}/${ask.function}${ask.level ? ` ${ask.level}` : ''}: advice only` : ''}${pick.resident ? '; resident' : `; to load: ${pick.price.useMb ?? '?'} MB`}`
  return { mind: pick.m, why, cell: pick.cell, authority: pick.authority, climb, rung: rungOf(pick.m), priceMb: pick.price.useMb, candidates: fitting, handoff: null, handoffLine: null }
}

/** The box profile's minds as the router reads them: `[{id, useMb}]` from box.slat's `(mind (id …) … (use-mb n) …)` forms. */
export function boxMinds(text) {
  const out = []
  for (const m of String(text || '').matchAll(/\(mind \(id ([^)\s]+)\)(?: \(tag "([^"]*)"\))?[^\n]*?\(use-mb ([^)]+)\)/g)) out.push({ id: m[1], tag: m[2] ?? null, useMb: m[3] === 'null' ? null : Number(m[3]) })
  return out
}

// the two files, re-read when they change (the grid is written whole by matrix.mjs; the box by the lead)
const cache = new Map()
function cached(file, read) {
  try {
    const m = fs.statSync(file).mtimeMs
    const c = cache.get(file)
    if (c && c.m === m) return c.v
    const v = read(fs.readFileSync(file, 'utf8'))
    cache.set(file, { m, v })
    return v
  } catch { return read('') }
}
/** The grid's cells, cached by the file's mtime; an unreadable grid is no cells. */
export const gridCells = (file = GRID_FILE) => cached(file, (t) => readCells(t, { ladder: null }).cells)
/** The box profile's minds, cached by the file's mtime. */
export const boxProfile = (file = BOX_FILE) => cached(file, boxMinds)

/**
 * Route one mind job of a playbook step on the live foreman: the grid, the box profile, what the broker holds and the host's
 * free memory. → the route with the mind's tag, or null when the job names neither a budget nor a role and function.
 * @param {object} sup
 * @param {{role?: ?string, function?: ?string, level?: ?string, job?: ?string, budget?: ?{in: number, out: number}, n?: number}} m
 * @param {{grid?: string, box?: string}} [o] the files (the host's `routeFiles()` seam for a test; the live files by default)
 */
export function routeJob(sup, m, o = sup.host.routeFiles?.() || {}) {
  if (!m || (!m.budget && !(m.role && m.function))) return null
  const box = boxProfile(o.box || BOX_FILE)
  const r = route({ role: m.role || null, function: m.function || null, level: m.level || null, jobClass: m.job || null,
    step: { n: m.n ?? 0, budget: m.budget || { in: 0, out: 0 } } },
  { cells: gridCells(o.grid || GRID_FILE), box, resident: { brain: broker(sup).brain, loaded: sup.host.loadedMinds?.() || [] }, availMb: sup.host.memory?.()?.availMB ?? null })
  const tag = r.mind ? box.find((b) => lower(b.id) === r.mind)?.tag ?? null : null
  return { ...r, tag }
}
