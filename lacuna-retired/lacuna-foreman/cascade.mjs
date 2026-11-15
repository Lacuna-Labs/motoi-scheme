// THE CASCADE — owns the ladder a mind job climbs, only as far as it must (rungs from bench/agents/tiers.json, inside box-minds.json
//   agent_minds, never past max_params_b while the 26B is loaded, smallest first; the 26B `last_rung` is always last).
// Owns: accept rule (reads under the job's grammar · certainty ≥ threshold, default 0.6, unknown climbs · cascade/rules.json holds);
//   SHADOW MODE (every eligible rung answers, one load at a time, the 26B is truth); records go to the host, Lacuna writes them.
// Refuses: a wrong label to a worker (it hears "unread"); two loads at once; a rung outside the box list; any disk write but policy files.
// Implements: design §10 (brains, memory, context), §12; keeps LACUNA-1.3-DESIGN §40.1–§40.3 (B50) as history.
// Invariants (§18): "If a mind's gate is below 90% per class, then its verdicts are advice" — the thresholds file carries the gate.
// Faults (§16): none by id (a refused last rung is "unread" to the worker).
import { readFileSync, statSync } from 'node:fs'
import { readAnswer } from './grammar.mjs'

const canon = (m) => String(m || '').replace(/:latest$/, '')
export const LAST_RUNG = 'lacuna-worker-lite'
const POLICY_DIR = process.env.FOREMAN_CASCADE_DIR ? new URL(`file://${process.env.FOREMAN_CASCADE_DIR.replace(/\/?$/, '/')}`) : new URL('./cascade/', import.meta.url)   // a test points it at its own folder

/** The fields that follow the brain now serving: switch-brain.sh writes them to ~/.lacuna/brain-profile.json and never to the
 *  tracked box-minds.json (order §1.5, 2026-11-06); the box file is configuration. */
export const BRAIN_FIELDS = Object.freeze(['brain', 'brain_files', 'brain_kv_gb', 'max_params_b', 'workhorse'])
/** The box's list with the current brain's fields laid over it; no profile (or an unreadable one) leaves the box's own word. */
export function brainOver(box, profile) {
  if (!box || typeof box !== 'object') return box ?? null
  if (!profile || typeof profile !== 'object') return box
  const p = { ...profile }
  if (p.file && !p.brain_files) p.brain_files = [p.file]   // a profile written before 2026-11-06 names its one file
  return { ...box, ...Object.fromEntries(BRAIN_FIELDS.filter((k) => p[k] != null).map((k) => [k, p[k]])) }
}

/** The rungs for one job class (tiers.json's class key: label, verb, route, fill, shell), small → large, the 26B last. */
export function ladder(key, { tiers = null, box = null } = {}) {
  const b = box && Array.isArray(box.agent_minds) ? box : { agent_minds: ['functiongemma'], reserved: {} }
  const reserved = new Set(Object.keys(b.reserved || {}).map(canon))
  const last = canon(b.last_rung || LAST_RUNG)
  const params = new Map(((tiers && tiers.models) || []).map((m) => [canon(m.model), m.params_b]))
  const cap = Number(b.max_params_b) || Infinity
  const fits = (m) => b.agent_minds.map(canon).includes(m) && !reserved.has(m) && m !== last && !((params.get(m) ?? 0) > cap)
  const row = tiers && tiers.classes && tiers.classes[key]
  let small = row ? (row.ranked || []).map((r) => ({ model: canon(r.model), params_b: r.params_b ?? params.get(canon(r.model)) ?? null, pct: r.pct ?? null }))
    .filter((r) => fits(r.model)) : []
  if (!row) {
    // nothing benched for this class yet: the box's workhorse alone climbs to the 26B
    const wh = canon(b.workhorse || b.agent_minds[0])
    if (fits(wh)) small = [{ model: wh, params_b: params.get(wh) ?? null, pct: null }]
  }
  small.sort((x, y) => ((x.params_b ?? 99) - (y.params_b ?? 99)) || ((y.pct ?? 0) - (x.pct ?? 0)) || x.model.localeCompare(y.model))
  const seen = new Set()
  const rungs = small.filter((r) => !seen.has(r.model) && seen.add(r.model)).map((r) => ({ ...r, last: false }))
  return rungs.concat([{ model: last, params_b: params.get(last) ?? null, pct: row?.ranked?.find((r) => canon(r.model) === last)?.pct ?? null, last: true }])
}

// ── the policy files, re-read when they change (the calibration writes thresholds.json) ────────────────────────────
const cache = {}
function readJson(name) {
  const u = new URL(name, POLICY_DIR)
  try {
    const m = statSync(u).mtimeMs
    if (cache[name]?.m !== m) cache[name] = { m, doc: JSON.parse(readFileSync(u, 'utf8')) }
    return cache[name].doc
  } catch { return null }
}
/** {thresholds, rules} from cascade/*.json; a missing file means the defaults (0.6, unknown climbs, no rules). */
export function policy() {
  return { thresholds: readJson('thresholds.json') || { default: 0.6, unknown: 'climb', jobs: {} }, rules: readJson('rules.json') || {} }
}

export function threshold(pol, jobClass, model) {
  const t = pol.thresholds || {}
  const row = (t.jobs || {})[jobClass] || {}
  const v = row[canon(model)] ?? row[model] ?? t.default
  // a number, or a number a person wrote as text; null, blank and booleans are no number (Number(null) is 0: accept every guess)
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : Number.NaN
  return Number.isFinite(n) ? n : 0.6
}

/** The job's hard rules against one read answer. → null when they pass, or the sentence that says which broke. */
export function brokenRule(pol, jobClass, slice, r) {
  const spec = (pol.rules || {})[jobClass]
  if (!spec) return null
  if (spec.answer && r.kind !== spec.answer) return `the job answers with a ${spec.answer}, not a ${r.kind}`
  for (const rule of spec.rules || []) {
    if (r.kind !== 'label' || !(rule.never || []).includes(r.label)) continue
    const text = String((slice || {})[rule.field || 'line'] ?? '')
    const pats = Array.isArray(rule.match) ? rule.match : [rule.match]
    let hit = true
    for (const p of pats) { try { if (!new RegExp(p, rule.flags || '').test(text)) { hit = false; break } } catch { hit = false; break } }
    if (hit) return `${rule.why || 'a hard rule'} (said ${r.label})`
  }
  return null
}

/** One rung's answer judged: {ok, r} or {ok:false, why}. The last rung's certainty is recorded, never gating. */
export function judge({ text, certainty, rung, job, jobClass, slice, pol }) {
  const r = readAnswer(text, job)
  if (!r.ok) return { ok: false, r: null, why: `outside the grammar: ${r.why}` }
  const broke = brokenRule(pol, jobClass, slice, r)
  if (broke) return { ok: false, r, why: broke }
  if (rung.last) return { ok: true, r }
  const c = Number(certainty)
  if (certainty == null || !Number.isFinite(c)) {
    if ((pol.thresholds || {}).unknown === 'accept') return { ok: true, r }
    return { ok: false, r, why: 'its certainty is unknown' }
  }
  const t = threshold(pol, jobClass, rung.model)
  return c >= t ? { ok: true, r } : { ok: false, r, why: `certainty ${c.toFixed(2)} under ${t}` }
}

/**
 * Climb. `ask(rung)` → Promise<{text, certainty?, box?}> asks ONE model; rungs are asked one after another, never two
 * at once. Normal: stop at the first accepted. Shadow: every rung answers, then the same acceptance runs over them.
 * → {accepted: step | null, steps: [{model, last, text, certainty, ms, ok, why, r, box}], shadow}
 */
export async function climb({ ask, rungs, job, jobClass, slice, pol, shadow = false, clock = () => Date.now() }) {
  const steps = []
  let accepted = null
  for (const rung of rungs) {
    const t0 = clock()
    let out
    try {
      const res = await ask(rung)
      out = typeof res === 'string' ? { text: res } : (res || {})
    } catch (e) {
      out = { text: null, failed: String(e && e.message ? e.message : e).slice(0, 160) }
    }
    const ms = Math.max(0, Math.round(clock() - t0))
    const c = out.certainty == null || !Number.isFinite(Number(out.certainty)) ? null : Number(out.certainty)
    const v = out.failed ? { ok: false, r: null, why: `did not answer: ${out.failed}` }
      : judge({ text: out.text, certainty: c, rung, job, jobClass, slice, pol })
    const s = { model: rung.model, last: !!rung.last, text: out.text == null ? null : String(out.text).slice(0, 400), certainty: c, ms,
                ok: v.ok, why: v.ok ? null : v.why, r: v.r || null, box: out.box || null }
    steps.push(s)
    if (v.ok && !accepted) { accepted = s; if (!shadow) break }
  }
  return { accepted, steps, shadow }
}

const keyOf = (r) => (!r ? null : r.kind === 'label' ? `label:${r.label}` : r.text)

/** The records Lacuna keeps: the escalation (only when the job climbed) and, in shadow, one row per rung. */
export function records(out, { job, jobClass, slice, cart = null, at = Date.now() / 1000 }) {
  const iso = new Date(at * 1000).toISOString().slice(0, 19)
  const upto = out.accepted ? out.steps.indexOf(out.accepted) + 1 : out.steps.length
  const climbed = out.steps.slice(0, upto).some((s) => !s.ok)
  const escalation = climbed ? {
    at: iso, job, class: jobClass, cart, input: slice,
    rungs: out.steps.slice(0, upto).map((s, i) => ({ rung: i, model: s.model, answer: s.text, certainty: s.certainty, ms: s.ms,
                                                     climbed: s.ok ? null : s.why })),
    accepted_by: out.accepted ? out.accepted.model : null, accepted: out.accepted ? out.accepted.text : null,
    // a 26B answer that held is a candidate training pair (Gemma outputs only; §40.2 keeps it only if a machine check passes)
    candidate_pair: !!(out.accepted && out.accepted.last),
    ms: out.steps.slice(0, upto).reduce((a, s) => a + s.ms, 0),
  } : null
  let shadow = []
  if (out.shadow) {
    const truth = out.steps.find((s) => s.last)
    const t = truth && truth.r ? keyOf(truth.r) : null
    shadow = out.steps.map((s) => ({
      at: iso, job, class: jobClass, cart, model: s.model, truth: s.last, right: t == null ? null : keyOf(s.r) === t,
      answer: s.text, certainty: s.certainty, ms: s.ms, would_accept: s.ok, why: s.why, box: s.box,
    }))
  }
  return { escalation, shadow }
}
