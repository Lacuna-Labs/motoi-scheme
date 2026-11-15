// assign.mjs — THE ASSIGNMENT RULE (the load balancer's one decision, MINDS §4.3; work order A16). Owns: reading the minds
// index (`minds/**/*.slat`, one `(mind …)` each) and the job forms (`jobs/<class>.slat`) with the one reader; for one job
// class, the pick: the lowest rung (fewest parameters) among the minds the job `may` use, resident in the box's current
// state, with an exam row for that class sat in role whose recall meets the job's SLO; a warm (loaded) mind wins a tie
// (affinity); when none meets the SLO the pick climbs to the lowest resident mind that has any row for the class and the
// climb is counted; when none has a row the answer is the honest null (the brain, climb counted). The `(served …)` row
// that records the pick. Refuses: to load or unload anything (the broker and the gateway own residency); to pick a mind
// with no exam row for the class as a non-climb; a mind whose exam was sat out of role (MINDS §7.1: a bare question grades
// nothing); to read more than the index (never the ledger, never the cortex). Implements: LACUNA-MINDS-1.0 §4.3 (the
// forms, the rule, the climb rate), §7.1 (in role), §3.1 (ids). Invariants (§18): "if a mind served a class, then its row
// met the SLO or the served row says climb". Faults (§16): F-A1 (no index: every pick is the honest null and says so).
import fs from 'node:fs'
import path from 'node:path'
import { readForms, dataToJson } from '../../lacuna-scheme/src/slat-data.js'
import { gridCells, route } from './router.mjs'

/** The ladder: fewest parameters first (MINDS §4.2). A base is matched by the short name in its tag or id. */
export const RUNGS = Object.freeze(['270m', 'functiongemma', '1b', 'e2b', '3-4b', 'e4b', '12b', '26b'])

const sym = (x) => (x && typeof x === 'object' && typeof x.name === 'string' ? x.name : x)
const keyed = (form) => { const o = {}; for (const f of form.slice(1)) if (Array.isArray(f) && f.length) o[sym(f[0])] = f.length === 2 ? f[1] : f.slice(1); return o }
const num = (x) => { const n = Number(sym(x)); return Number.isFinite(n) ? n : null }
const bool = (x) => sym(x) === true || sym(x) === '#t'

/** The rung index of a mind, from its tag or id; -1 when it is on no rung. */
export function rungOf(m) {
  const s = `${m.tag || ''} ${m.id || ''} ${m.base || ''}`.toLowerCase()
  // `3-4b` is Gemma 3's 4B, written gemma3:4b in a tag and 3-4b in an id; a bare `4b` not after `e` is the same rung
  const pat = (r) => (r === '3-4b' ? /(gemma3[:-]4b|3-4b|(^|[^a-z0-9e])4b)([^a-z0-9]|$)/ : new RegExp(`(^|[^a-z0-9])${r}([^a-z0-9]|$)`))
  const hit = RUNGS.map((r, i) => (pat(r).test(s) ? i : -1)).filter((i) => i >= 0)
  return hit.length ? Math.min(...hit) : -1
}

/** One `(mind …)` form → {id, kind, tag, base, quant, rung, exams:[{class, level, inRole, recall, lb, n, skipped}], warmMs, resident:{a,b,node16}, state}. */
export function mindOf(form) {
  const o = keyed(form)
  // `(exam ((class …) …) ((class …) …))`: one row reads back as the row itself (its first element is a `(class …)` pair), many as a list of rows
  const oneRow = (x) => Array.isArray(x) && Array.isArray(x[0]) && typeof sym(x[0][0]) === 'string' && !Array.isArray(x[0][0])
  const rows = !Array.isArray(o.exam) || !o.exam.length ? [] : oneRow(o.exam) ? [o.exam] : o.exam
  const exams = rows.filter(Array.isArray).map((row) => {
    const e = keyed([null, ...row])
    return { class: String(sym(e.class) ?? ''), level: String(sym(e.level) ?? ''), inRole: bool(e['in-role']), recall: num(e.recall), lb: num(e.lb), n: num(e.n), skipped: e.skipped ? String(e.skipped) : null }
  })
  const res = Array.isArray(o.resident) ? keyed([null, ...o.resident]) : {}
  const lat = Array.isArray(o.latency) ? keyed([null, ...o.latency]) : {}
  const m = { id: String(o.id ?? ''), kind: String(sym(o.kind) ?? ''), tag: o.tag ? String(o.tag) : null, base: o.base ? String(o.base) : null, quant: String(sym(o.quant) ?? ''),
              exams, warmMs: num(lat['warm-ms']), resident: { a: bool(res.a), b: bool(res.b), node16: bool(res.node16) }, state: o.state ? String(o.state) : null }
  m.rung = rungOf(m)
  return m
}

/** One `(job-class …)` form → {class, level, slo:{pass, p95Ms}, may:[short…], maxLevel}. */
export function jobOf(form) {
  const o = keyed(form)
  const slo = Array.isArray(o.slo) ? keyed([null, ...o.slo]) : {}
  return { class: String(sym(o.class) ?? ''), level: String(sym(o.level) ?? ''), slo: { pass: num(slo.pass) ?? 0.9, p95Ms: num(slo['p95-ms']) },
           may: (Array.isArray(o.may) ? o.may : o.may ? [o.may] : []).map((x) => String(sym(x)).toLowerCase()), maxLevel: String(sym(o['max-level']) ?? '') }
}

const walk = (dir) => { const out = []; const seen = new Set(); (function rec(d) { let names = []; try { names = fs.readdirSync(d, { withFileTypes: true }) } catch { return } for (const e of names) { const p = path.join(d, e.name); if (e.isDirectory()) rec(p); else if (e.name.endsWith('.slat') && !seen.has(p)) { seen.add(p); out.push(p) } } })(dir); return out.sort() }
const formsIn = (file, head) => { try { return readForms(fs.readFileSync(file, 'utf8')).filter((f) => Array.isArray(f) && sym(f[0]) === head) } catch { return [] } }

/**
 * Reads the index: every `(mind …)` under `mindsDir` and every `(job-class …)` under `jobsDir` (the old head `(job …)` is read
 * as nothing since call 19's step 3, 2026-11-01).
 * @returns {{minds: object[], jobs: Map<string, object>, files: number, why: ?string}} `why` names a missing index (F-A1)
 */
export function loadIndex({ mindsDir, jobsDir }) {
  const mindFiles = walk(mindsDir); const jobFiles = walk(jobsDir)
  const minds = mindFiles.flatMap((f) => formsIn(f, 'mind').map(mindOf)).filter((m) => m.id)
  const jobs = new Map(jobFiles.flatMap((f) => formsIn(f, 'job-class').map(jobOf)).filter((j) => j.class).map((j) => [j.class, j]))
  const why = !mindFiles.length ? `no minds index under ${mindsDir}` : !minds.length ? `no (mind …) form under ${mindsDir}` : null
  return { minds, jobs, files: mindFiles.length + jobFiles.length, why }
}

const mayUse = (job, m) => !job.may.length || job.may.some((short) => rungOf({ tag: short }) === m.rung)
const rowFor = (m, cls) => m.exams.filter((e) => e.class === cls && !e.skipped)

/**
 * The pick for one job class (MINDS §4.3). `state` is the box's residency state (a | b | node16); `loaded` the bases up now.
 * @param {string} jobClass e.g. 'signal->label'
 * @param {{minds: object[], jobs: Map<string, object>}} index
 * @param {{state?: string, loaded?: Iterable<string>}} [box]
 * @returns {{mind: ?object, climb: boolean, why: string, level: ?string, recall: ?number, candidates: number}}
 */
export function assign(jobClass, index, box = {}) {
  const state = box.state || 'a'; const loaded = new Set([...(box.loaded || [])].map((x) => String(x).toLowerCase()))
  const job = index.jobs.get(jobClass) || { class: jobClass, slo: { pass: 0.9 }, may: [], level: '' }
  // R1.4 Part 2: when a passing Rolebench grid cell (`authority === 'record'`) exists for a `role/function` job class (or `box.cells`), the grid decides
  const cells = Array.isArray(box.cells) ? box.cells : (box.gridFile || String(jobClass || '').includes('/')) ? gridCells(box.gridFile) : []
  if (cells.length && (String(jobClass || '').includes('/') || (box.role && box.function))) {
    const [rRole, rFn] = String(jobClass || '').includes('/') ? String(jobClass).split('/', 2) : [box.role, box.function]
    const routed = route(
      { role: rRole, function: rFn, level: job.level || box.level || undefined, step: { budget: box.budget || { in: 512, out: 128 } } },
      { cells, resident: { loaded: [...loaded] } },
    )
    if (routed.authority === 'record' && routed.mind) {
      const targetRung = rungOf({ tag: routed.mind })
      const matched = index.minds.find((m) => m.rung === targetRung || String(m.id).toLowerCase() === routed.mind) || {
        id: routed.mind,
        tag: routed.mind,
        rung: targetRung,
      }
      return {
        mind: matched,
        climb: routed.climb,
        level: routed.cell?.level || job.level || null,
        recall: routed.cell?.sitting?.lb90 ?? null,
        candidates: routed.candidates.length,
        authority: routed.authority,
        why: routed.why,
      }
    }
  }
  const warm = (m) => loaded.has(String(m.tag || m.base || '').toLowerCase()) ? 0 : 1
  const order = (x, y) => (x.rung - y.rung) || (warm(x) - warm(y)) || (String(x.id) < String(y.id) ? -1 : 1)
  const resident = index.minds.filter((m) => m.rung >= 0 && m.resident[state] && mayUse(job, m)).sort(order)
  const meets = resident.map((m) => ({ m, row: rowFor(m, jobClass).filter((e) => e.inRole && e.recall != null && e.recall >= job.slo.pass).sort((a, b) => b.recall - a.recall)[0] })).filter((x) => x.row)
  if (meets.length) return { mind: meets[0].m, climb: false, level: meets[0].row.level, recall: meets[0].row.recall, candidates: resident.length, why: `${meets[0].m.id} meets ${jobClass} at recall ${meets[0].row.recall} ≥ ${job.slo.pass} (${meets[0].row.level}, in role)${warm(meets[0].m) === 0 ? ', warm' : ''}` }
  const any = resident.map((m) => ({ m, row: rowFor(m, jobClass).filter((e) => e.inRole).sort((a, b) => (b.recall ?? -1) - (a.recall ?? -1))[0] })).filter((x) => x.row)
  if (any.length) return { mind: any[0].m, climb: true, level: any[0].row.level, recall: any[0].row.recall, candidates: resident.length, why: `no resident mind meets ${jobClass} at ${job.slo.pass}; climbed to ${any[0].m.id} (recall ${any[0].row.recall ?? 'none'}, ${any[0].row.level}); counted` }
  return { mind: null, climb: true, level: null, recall: null, candidates: resident.length, why: `no resident mind has an in-role row for ${jobClass}${index.minds.length ? '' : ' (no index)'}; the brain takes it; counted` }
}

/** The `(served …)` row's data for a pick and its outcome (MINDS §4.3). */
export function servedRow({ job, pick, ms, result, instance = null, served = null, at = Math.round(Date.now() / 1000) }) {
  // `served` is the mind the gateway says answered (the box's word beats the pick's); `climb` is the pick's word
  return { job, mind: served ?? pick?.mind?.id ?? 'brain', ms, result: pick?.climb ? 'climb' : result, instance, at }
}

let cache = null
/** The box's index, read once per `INDEX_TTL_S` (default 60) from LACUNA_MINDS_DIR / LACUNA_JOBS_DIR (default ~/lacuna-world/{minds,jobs}). */
export function boxIndex(env = process.env, now = Date.now() / 1000) {
  const ttl = Number(env.INDEX_TTL_S || 60)
  if (cache && now - cache.at < ttl) return cache.index
  const home = env.HOME || '/'
  const world = env.LACUNA_WORLD || path.join(home, 'lacuna-world')
  const index = loadIndex({ mindsDir: env.LACUNA_MINDS_DIR || path.join(world, 'minds'), jobsDir: env.LACUNA_JOBS_DIR || path.join(world, 'jobs') })
  cache = { at: now, index }
  return index
}
