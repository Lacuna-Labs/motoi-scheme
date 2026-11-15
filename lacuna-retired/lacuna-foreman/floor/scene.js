// scene.js — THE SCENE (lane F5-H, unit H.2; A8 §2, §4.1; THE-FLOOR-5.0 §2.5–§2.7). Owns: reading one keyed `(scene …)` form
// (name, v, by, secs, doc, params, actors, score, and its rows: `(ev (at ms) …)`, `(expect (at ms) …)`, each with an optional
// `(when pred)` or `(unless pred)` and a press-relative `(after-ms n)` inside its data); the closed predicate grammar (`pressed state
// cause param not and or`, nothing else: a scene file is data); binding `"$name"` parameters; and the player: rows due at their
// times (`at`, or a press's time plus `after-ms` for a row keyed to the owner's press; a press-ended turn's `ms` measured from its
// start in the fold, the one value the player fills), each event stamped `(src <src> n)` and folded
// into a fold handle at its moment, each expectation judged against the fold's record at its `at` (a verdict with its `why`, `want`
// and `got`), the score from `win`/`lose` at the end. One module for Node and the browser: a scene folded in either yields the same
// `(state …)` (the parity test). Refuses: a field outside the grammar; a row past `secs`; rows out of `at` order; a `$name` with no
// param; an actor a row names that `actors` does not list; a predicate head outside the grammar ("author the branch from a cart");
// more than 4,000 rows or 256 actors; a stamp from the author (the player writes `src`, never the file). Implements: A8 §2.1–§2.4,
// §4.1, §5.1 (the hash is the fold's snapshot). Invariants (§18): "live, replay, drills and scenes are one code path" (the fold folds
// a scene's events as it folds the day's); "a record or nothing". Faults (§16): none raised; a refusal is `{ok: false, why}`.
import { readForms } from '../../../lacuna-scheme/src/slat-data.js'
import { createFold, fold as foldEvents, tick, actor as actorOf, snapshot } from './fold.js'
import { kinds as catalog } from './validate.js'

/** The coordinate a scene's row stands at when its kind needs one (the catalog's `(at required)`): box 1, the foreman's service
 *  number (4096), no work order, run, step or call (coordinate.mjs's printed form). */
export const SCENE_AT = 'lacuna:/1/4096/-/-/-/-/-'

/** The scene's bounds (A8 §3 LIMITS, the parts a reader and a player need). */
export const LIMITS = Object.freeze({ secs: 600, rows: 4000, actors: 256, doc: 240, name: /^[a-z][a-z0-9-]{0,39}$/ })
/** The predicate heads a file may carry (A8 §2.4). */
export const PREDICATES = Object.freeze(['pressed', 'state', 'cause', 'param', 'not', 'and', 'or'])
/** The fields an expectation may check (A8 §2.1). */
export const CHECKS = Object.freeze(['state', 'cause', 'since-ms', 'counter', 'light', 'slot'])

const sym = (x) => (x && typeof x === 'object' && !Array.isArray(x) && 'name' in x ? x.name : null)
const atom = (x) => (sym(x) ?? x)
const field = (form, k) => form.slice(1).find((p) => Array.isArray(p) && atom(p[0]) === k)
const one = (form, k) => { const p = field(form, k); return p ? atom(p[1]) : undefined }
const fail = (why) => ({ ok: false, why })

/** A data form `((k v) …)` as an object; nested forms as arrays of atoms. */
function dataOf(form) {
  const out = {}
  for (const p of form || []) if (Array.isArray(p) && p.length >= 2) out[String(atom(p[0]))] = p.length === 2 ? atom(p[1]) : p.slice(1).map(atom)
  return out
}

/**
 * A predicate form read into plain data, checked against the grammar.
 * @param {*} form
 * @return {{ok: true, pred: Array}|{ok: false, why: string}}
 */
export function readPred(form) {
  if (!Array.isArray(form) || !form.length) return fail('a predicate is a form: (pressed "actor"), (state "actor" s), …')
  const head = atom(form[0])
  if (!PREDICATES.includes(head)) return fail(`predicate \`(${head} …)\` is not in the scene grammar; author the branch from a cart`)
  if (head === 'not') { const r = readPred(form[1]); return r.ok ? { ok: true, pred: ['not', r.pred] } : r }
  if (head === 'and' || head === 'or') {
    const parts = []
    for (const f of form.slice(1)) { const r = readPred(f); if (!r.ok) return r; parts.push(r.pred) }
    return { ok: true, pred: [head, ...parts] }
  }
  return { ok: true, pred: [head, ...form.slice(1).map((x) => String(atom(x)))] }
}

/**
 * A predicate's value now. `pressed` reads the scene's own presses before `atMs`; `state` and `cause` read the fold's registry.
 * @param {Array} pred readPred's
 * @param {{presses: Map<string, number>, atMs: number, f: Object, params: Object}} ctx
 * @return {boolean}
 */
export function evalPred(pred, ctx) {
  const [head, ...args] = pred
  if (head === 'not') return !evalPred(args[0], ctx)
  if (head === 'and') return args.every((p) => evalPred(p, ctx))
  if (head === 'or') return args.some((p) => evalPred(p, ctx))
  if (head === 'pressed') { const at = ctx.presses.get(args[0]); return at != null && at <= ctx.atMs }
  if (head === 'param') return ctx.params[args[0]] === true || ctx.params[args[0]] === '#t'
  const rec = ctx.f ? actorOf(ctx.f, args[0]) : null
  if (head === 'state') return Boolean(rec) && String(rec.state) === args[1]
  if (head === 'cause') return Boolean(rec) && String(rec.cause) === args[1]
  return false
}

/** `"$name"` in a string, every string of a value, replaced by its parameter. */
function bind(v, params, missing) {
  if (typeof v === 'string') return v.replace(/\$([a-z][a-z0-9-]*)/g, (m, n) => (n in params ? String(params[n]) : (missing.add(n), m)))
  if (Array.isArray(v)) return v.map((x) => bind(x, params, missing))
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, bind(x, params, missing)]))
  return v
}

/**
 * Reads one scene file.
 * @param {string} text the `(scene …)` form
 * @param {Object<string, *>=} values the parameters' values (each param's default otherwise)
 * @return {{ok: true, scene: Object}|{ok: false, why: string}}
 */
export function readScene(text, values = {}) {
  let forms
  try { forms = readForms(String(text)) } catch (e) { return fail(`the scene does not read: ${e.message}`) }
  const form = forms.find((f) => Array.isArray(f) && atom(f[0]) === 'scene')
  if (!form) return fail('no (scene …) form')
  const name = one(form, 'name'), v = one(form, 'v'), by = one(form, 'by'), secs = Number(one(form, 'secs')), doc = one(form, 'doc') ?? ''
  if (!LIMITS.name.test(String(name || ''))) return fail(`the name ${JSON.stringify(name)} is not a scene name`)
  if (v !== 1) return fail(`v ${v}: only v 1 is read`)
  if (!['drill', 'cart', 'replay'].includes(by)) return fail(`by ${by}: drill, cart or replay`)
  if (!(secs >= 1 && secs <= LIMITS.secs)) return fail(`secs ${secs}: 1 to ${LIMITS.secs}`)
  if (String(doc).length > LIMITS.doc) return fail(`the doc runs ${String(doc).length} characters; at most ${LIMITS.doc}`)
  const params = {}
  for (const p of form.slice(1).filter((x) => Array.isArray(x) && atom(x[0]) === 'param')) {
    const pn = one(p, 'name')
    params[pn] = pn in values ? values[pn] : one(p, 'default')
  }
  const missing = new Set()
  const actorsForm = field(form, 'actors')
  if (!actorsForm) return fail('no (actors …): every actor a row names is listed')
  const actors = new Set(bind(actorsForm.slice(1).map(String), params, missing))
  if (actors.size > LIMITS.actors) return fail(`${actors.size} actors; at most ${LIMITS.actors}`)
  let score = null
  const sc = field(form, 'score')
  if (sc) {
    const w = field(sc, 'win'), l = field(sc, 'lose')
    const win = w ? readPred(w[1]) : null, lose = l ? readPred(l[1]) : null
    if (win && !win.ok) return win
    if (lose && !lose.ok) return lose
    score = { win: win?.pred ?? null, lose: lose?.pred ?? null, parMs: Number(one(sc, 'par-ms') ?? 0) || null }
  }
  const rows = []
  let last = 0
  for (const r of form.slice(1)) {
    if (!Array.isArray(r)) continue
    const head = atom(r[0])
    if (head !== 'ev' && head !== 'expect') continue
    const at = Number(one(r, 'at'))
    if (!Number.isFinite(at) || at < 0) return fail(`row ${rows.length + 1}: no (at ms)`)
    if (at > secs * 1000) return fail(`row ${rows.length + 1}: at ${at} ms is past the scene's ${secs} s`)
    const whenF = field(r, 'when'), unlessF = field(r, 'unless')
    const when = whenF ? readPred(whenF[1]) : null, unless = unlessF ? readPred(unlessF[1]) : null
    if (when && !when.ok) return fail(`row ${rows.length + 1}: ${when.why}`)
    if (unless && !unless.ok) return fail(`row ${rows.length + 1}: ${unless.why}`)
    // the events run in time: an `ev` row not keyed to a press comes at or after the one above it; an expectation may stand
    // anywhere (A8's own drill lists them beside the rows they judge), the player orders every row by its time
    if (head === 'ev' && !(when?.pred?.[0] === 'pressed')) { if (at < last) return fail(`row ${rows.length + 1}: at ${at} ms comes before the event above it (${last} ms)`); last = at }
    const actor = bind(String(one(r, 'actor') ?? ''), params, missing)
    if (!actors.has(actor)) return fail(`row ${rows.length + 1}: the actor ${JSON.stringify(actor)} is not in (actors …)`)
    if (head === 'ev') {
      const data = bind(dataOf(field(r, 'data')?.slice(1)), params, missing)
      const afterMs = data['after-ms'] != null ? Number(data['after-ms']) : null
      delete data['after-ms']
      rows.push({ type: 'ev', at, when: when?.pred ?? null, unless: unless?.pred ?? null, afterMs, kind: String(one(r, 'kind')), actor,
        ref: one(r, 'ref') != null ? bind(String(one(r, 'ref')), params, missing) : null, data })
    } else {
      const checks = {}
      for (const k of CHECKS) { const p = field(r, k); if (p) checks[k] = p.slice(1).map(atom) }
      const why = one(r, 'why')
      if (!why) return fail(`row ${rows.length + 1}: an expectation names its why`)
      if (!Object.keys(checks).length) return fail(`row ${rows.length + 1}: an expectation checks one field at least`)
      rows.push({ type: 'expect', at, when: when?.pred ?? null, unless: unless?.pred ?? null, actor, checks, why: String(why) })
    }
    if (rows.length > LIMITS.rows) return fail(`more than ${LIMITS.rows} rows`)
  }
  if (missing.size) return fail(`no param for ${[...missing].map((n) => `$${n}`).join(', ')}`)
  return { ok: true, scene: { name, v, by, secs, doc: String(doc), params, actors: [...actors], score, rows } }
}

/** A light's state on a record: Lacuna's are words, a sentry's are objects with a state. */
const LIGHT = { semantics: 'sem', provenance: 'prov', ast: 'ast', sem: 'sem', prov: 'prov' }
function lightOn(rec, name) {
  const L = rec?.lights?.[LIGHT[name] || name]
  const s = L && typeof L === 'object' ? (L.state ?? L.s ?? L.value) : L
  return ['warn', 'fail', 'moving', 'lit', 'on'].includes(String(s))
}

/**
 * One expectation judged against the fold now.
 * @param {Object} row the expect row
 * @param {Object} f the fold
 * @param {number} logT seconds
 * @return {{ok: boolean, why: string, want: Object, got: Object}}
 */
export function judge(row, f, logT) {
  const rec = actorOf(f, row.actor)
  const want = {}, got = {}
  let ok = true
  for (const [k, args] of Object.entries(row.checks)) {
    if (k === 'state') { want.state = String(args[0]); got.state = rec ? String(rec.state) : 'absent'; if (rec ? got.state !== want.state : want.state !== 'gone') ok = false }
    else if (k === 'cause') { want.cause = String(args[0]); got.cause = rec?.cause ?? null; if (got.cause !== want.cause) ok = false }
    else if (k === 'since-ms') { const [n, tol = 0] = args.map(Number); want.sinceMs = n; got.sinceMs = rec ? Math.round((logT - rec.since) * 1000) : null; if (got.sinceMs == null || Math.abs(got.sinceMs - n) > tol) ok = false }
    else if (k === 'counter') {   // a counter by name, or a dotted path into the record (`disk.free-gb` → rec.disk.freeGb)
      const [name, v] = args
      want[`counter ${name}`] = String(v)
      const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
      const have = rec?.counters?.[name] ?? String(name).split('.').reduce((o, seg) => (o == null ? o : o[camel(seg)]), rec)
      got[`counter ${name}`] = have == null ? null : String(have)
      if (got[`counter ${name}`] !== want[`counter ${name}`]) ok = false
    }
    else if (k === 'light') { const [name, v] = args; want[`light ${name}`] = String(v); got[`light ${name}`] = lightOn(rec, name) ? 'on' : 'off'; if (got[`light ${name}`] !== want[`light ${name}`]) ok = false }
    else if (k === 'slot') { want.slot = Number(args[0]); got.slot = rec?.slot ?? null; if (got.slot !== want.slot) ok = false }
  }
  return { ok, why: row.why, want, got }
}

/**
 * Plays a scene into a fold: each row at its time, events stamped and folded, expectations judged, the score at the end.
 * @param {Object} scene readScene's
 * @param {{epoch: number, src?: string, by?: string, presses?: Array<{actor: string, atMs: number}>, f?: Object, until?: number}} o
 *   `epoch` ms UTC of the scene's 0; `src` the producer stamp, `scene:<name>` by default (A2's catalog: the scene producer, written
 *   `scene:<name>`; A8 §2.2's `drill:` and `cart:` words ride `by` and the floor's scene block); `by` who plays it (`owner` for a
 *   drill, `cart` for a cart's scene); `presses` the owner's presses on actors, in scene ms; `until` ms to play to
 * @return {{f: Object, events: Array<Object>, verdicts: Array<Object>, score: ?Object, hash: string}}
 */
export function play(scene, o) {
  const f = o.f || createFold({ epoch: o.epoch })
  const presses = new Map((o.presses || []).map((p) => [p.actor, p.atMs]))
  const end = Math.min(o.until ?? scene.secs * 1000, scene.secs * 1000)
  // the timeline: a row keyed to a press fires at the press plus its after-ms; a press that never came drops it
  const due = []
  scene.rows.forEach((r, i) => {
    if (r.when?.[0] === 'pressed' && r.afterMs != null) {
      const at = presses.get(r.when[1])
      if (at != null) due.push({ r, t: at + r.afterMs, i })
    } else due.push({ r, t: r.at, i })
  })
  for (const p of presses.keys()) due.push({ r: { type: 'press', actor: p }, t: presses.get(p), i: -1 })
  due.sort((a, b) => a.t - b.t || a.i - b.i)
  const events = [], verdicts = []
  let seq = f.seq, n = 0
  const src = o.src || `scene:${scene.name}`
  const cat = catalog()
  const emit = (kind, actor, ref, data, tMs) => {
    const k = cat.get(kind)
    const ev = { seq: ++seq, t: o.epoch + tMs, kind, actor, at: k?.at ? SCENE_AT : '-', ref: ref ?? null, src: [src, ++n],
      data: { ...data, ...(o.by && (kind === 'scene.begin' || kind === 'press.pressed') ? { by: o.by } : {}) } }
    events.push(ev)
    foldEvents(f, [ev])
    return ev
  }
  for (const { r, t } of due) {
    if (t > end) break
    tick(f, (o.epoch + t - f.epoch) / 1000)
    const ctx = { presses, atMs: t, f, params: scene.params }
    if (r.type === 'press') { emit('press.pressed', r.actor, r.actor, { id: `scene:${scene.name}:${r.actor}`, answer: 'yes', by: 'owner' }, t); continue }
    if (r.when && !(r.when[0] === 'pressed' && r.afterMs != null) && !evalPred(r.when, ctx)) continue
    if (r.unless && evalPred(r.unless, ctx)) continue
    if (r.type === 'ev') {
      // a turn ended by the owner's press has no length the file can write (no arithmetic in a scene): the player measures it from
      // the turn's start in the fold, the one value it fills, and only when the row leaves it out
      let data = r.data
      if (r.kind === 'mind.turn.done' && data.ms == null) {
        const turn = actorOf(f, r.actor)?.turn
        data = { ...data, ms: turn ? Math.max(0, Math.round(t - (turn.startT * 1000 + f.epoch - o.epoch))) : 0 }
      }
      emit(r.kind, r.actor, r.ref, data, t)
      continue
    }
    const v = judge(r, f, (o.epoch + t - f.epoch) / 1000)
    verdicts.push({ at: t, actor: r.actor, ...v })
    emit('scene.verdict', 'lacuna', null, { check: `${r.actor}@${t}`.slice(0, 60), ok: v.ok, why: v.ok ? r.why.slice(0, 200) : `want ${JSON.stringify(v.want)}, got ${JSON.stringify(v.got)}: ${r.why}`.slice(0, 200) }, t)
  }
  tick(f, (o.epoch + end - f.epoch) / 1000)
  let score = null
  if (scene.score && end >= scene.secs * 1000) {
    const ctx = { presses, atMs: end, f, params: scene.params }
    const result = scene.score.win && evalPred(scene.score.win, ctx) ? 'win' : scene.score.lose && evalPred(scene.score.lose, ctx) ? 'lose' : 'none'
    const pressedAt = [...presses.values()].sort((a, b) => a - b)[0] ?? null
    score = { result, pressedAtMs: pressedAt, parMs: scene.score.parMs }
  }
  const state = snapshot(f, f.logT)
  return { f, events, verdicts, score, state }
}
