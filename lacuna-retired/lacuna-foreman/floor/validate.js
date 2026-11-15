// validate.js — THE VALIDATOR OF THE FLOOR'S EVENTS (lane F5-A, unit A.1; RULINGS-2026-10-30 §1(a); A2 §2.1 and §4.2's steps
// 1–3). Owns: the catalog, read from `kinds.slat` through `kinds-text.js` (so the browser imports it with no file system);
// `kinds()` and `producers()`, the catalog as maps; `validateEvent(ev)`, one event object against its kind (its form, its kind,
// its producer, its data against the kind's fields, its coordinate and its ref); `readEventLine(line)`, one canonical `(ev …)`
// line into an event object by the one reader, then validated. Refuses, with A2 §4.2's reasons in its order: `malformed`,
// `too-long`, `prev-set`, `unknown-kind`, `producer` (a scene, which feeds `any`, carries every kind), `schema:<key>`. Pure: no
// clock and no state. The door's admit (floor-events.mjs) adds the clock, the dedup, the rate and the scene gate, A2 §4.2's
// steps 4–7. Implements: A2 §2.1 (the envelope's grammar and limits, with `at` in coordinate.mjs's print form), §4.1 (the
// registry, as data), §4.2 (steps 1–3). Invariants (design §18): "guaranteed good data" (the owner): an event this module
// refuses never reaches the day file. Faults (§16): none; a refusal is a reason.
import { dataToJson, readForms, writeData } from '../../../lacuna-scheme/src/slat-data.js'
import { parse as parseCoordinate } from '../coordinate.mjs'
import { KINDS_SLAT } from './kinds-text.js'

/** The event's fields, in the fixed order of A2 §2.1. A day file's line adds `prev` last (floor-log.mjs writes it). */
export const FIELDS = Object.freeze(['seq', 't', 'kind', 'actor', 'at', 'ref', 'src', 'data'])
/** The reasons a refusal names, in the order the checks run (A2 §4.2; `schema` carries the key it refused). */
export const REASONS = Object.freeze(['malformed', 'too-long', 'prev-set', 'unknown-kind', 'producer', 'schema'])
/** The limits of A2 §2.1. */
export const LIMITS = Object.freeze({ line: 2048, data: 1500, keys: 24, actor: 48, at: 120, ref: 64, producer: 32, kind: 40, string: 300 })

const KIND_RE = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*){1,2}$/
const ACTOR_RE = /^[a-z0-9][a-z0-9:._#-]*$/
const KEY_RE = /^[a-z][a-z0-9-]*$/
const CONTROL_RE = /[\u0000-\u001f\u007f]/
// the one field the door adds to any kind's data: the ms an event trails the day file's newest (A2 §4.4)
const DOOR_FIELD = Object.freeze({ type: { is: 'int' }, unit: 'ms' })
const NON_NEGATIVE = new Set(['ms', 's', 'MB', 'GB', 'B', 'tok', 'min', 'tok/s', '/s'])

const nameOf = (x) => (x && typeof x === 'object' && 'name' in x ? x.name : x)
// A2 §2.4's actor ids by rule; a rule the table does not name holds to the generic id (ACTOR_RE); a literal is the id itself
// (a run id is `w-…` on the box and `w<n>` in the foreman's test host; `wo-…` is a work order's; a sentry is `sentry-<model>:<run>`
// on a run and `sentry-<device>:<mind>` on a mind's turn, frontend/turn-sentry.mjs turnSentryRows: the door refused every turn verdict
// as schema:actor until 2026-11-06, finale §2.8 unit 10, so no verdict ever reached the floor)
const ACTOR_RULES = Object.freeze({ run: /^w(?!o-)[-0-9a-z]/, sentry: /^sentry-[a-z0-9]+:[a-z0-9]/, 'work-order': /^wo-/, alert: /^alert:/,
  visitor: /^visitor:/, 'run-or-petition': /^(w(?!o-)[-0-9a-z]|p-)/ })

// one field's type form, read: int | number | bool | (string n) | (one-of …) | (list number|string n) | (counts …) | (or T null)
function readType(f) {
  if (!Array.isArray(f)) return { is: nameOf(f) }
  const [head, ...rest] = f
  switch (nameOf(head)) {
    case 'string': return { is: 'string', max: Number(rest[0]) }
    case 'one-of': return { is: 'one-of', values: new Set(rest.map((v) => (typeof v === 'bigint' ? Number(v) : nameOf(v)))) }
    case 'list': return { is: 'list', of: nameOf(rest[0]), max: Number(rest[1]) }
    case 'counts': return { is: 'counts', keys: new Set(rest.map(nameOf)) }
    case 'or': return { ...readType(rest[0]), nullable: true }
    default: throw new Error(`kinds.slat: the type ${nameOf(head)} is not one of the catalog's types`)
  }
}

// the value forms of one (key …) clause: the rest of a form after its head, as plain values
const clause = (form, key) => form.find((c) => Array.isArray(c) && nameOf(c[0]) === key)
const words = (form, key) => (clause(form, key) || []).slice(1).map((v) => (typeof v === 'bigint' ? Number(v) : nameOf(v)))

/**
 * The catalog of a kinds.slat text: its kinds and its producers.
 * @param {string} text the catalog's slat
 * @return {{kinds: !Map<string, !Object>, producers: !Map<string, !Object>}}
 * @throws {Error} a type the catalog does not define, or a kind that names a producer the catalog does not hold.
 */
export function catalogFrom(text) {
  const kinds = new Map()
  const producers = new Map()
  for (const form of readForms(text)) {
    const head = nameOf(form[0])
    if (head === 'producer') {
      const [period] = words(form, 'period-s')
      producers.set(nameOf(form[1]), { name: nameOf(form[1]), source: words(form, 'source')[0], periodS: period === 'none' ? null : period,
        feeds: words(form, 'feeds'), pseq: words(form, 'pseq')[0] })
    } else if (head === 'kind') {
      const name = nameOf(form[1])
      const fields = new Map()
      for (const f of (clause(form, 'fields') || []).slice(1)) fields.set(nameOf(f[0]), { type: readType(f[1]), unit: f[2] ?? null })
      const [period] = words(form, 'period-s')
      kinds.set(name, {
        name, family: words(form, 'family')[0], record: words(form, 'record')[0], producers: new Set(words(form, 'producers')), fields,
        required: new Set(words(form, 'required')), at: words(form, 'at')[0] === 'required',
        // a string is the actor id itself ("foreman"); a symbol names the rule its ids follow (mind, run, …)
        actor: typeof (clause(form, 'actor') || [])[1] === 'string' ? { literal: clause(form, 'actor')[1] } : { rule: words(form, 'actor')[0] },
        ref: words(form, 'ref')[0] === 'required', rate: words(form, 'rate')[0], periodS: period === 'none' ? null : period,
        retention: words(form, 'retention'),
      })
    }
  }
  for (const k of kinds.values()) {
    for (const p of k.producers) if (!producers.has(p)) throw new Error(`kinds.slat: ${k.name} names the producer ${p}, which the catalog does not hold`)
  }
  return { kinds, producers }
}

const CATALOG = catalogFrom(KINDS_SLAT)

/**
 * The kinds of the catalog, by name.
 * @return {!Map<string, !Object>} name → {family, record, producers, fields, required, actor, at, ref, rate, periodS, retention}
 */
export function kinds() {
  return CATALOG.kinds
}

/**
 * The producers of the catalog, by name.
 * @return {!Map<string, !Object>} name → {source, periodS, feeds, pseq}
 */
export function producers() {
  return CATALOG.producers
}

// a producer's name as the catalog lists it: a scene's events come from `scene:<name>`, listed once as `scene`
const producerOf = (name) => (String(name).startsWith('scene:') ? 'scene' : String(name))

// a value against its field: null when it fits, else the word for why it does not
function misfit(v, field) {
  const t = field.type
  if (v === null) return t.nullable ? null : 'is null'
  switch (t.is) {
    case 'int': if (!Number.isInteger(v)) return 'is not an integer'; break
    case 'number': if (typeof v !== 'number' || !Number.isFinite(v)) return 'is not a finite number'; break
    case 'bool': return typeof v === 'boolean' ? null : 'is not #t or #f'
    case 'string':
      if (typeof v !== 'string') return 'is not a string'
      if (v.length > t.max) return `is longer than ${t.max} characters`
      if (CONTROL_RE.test(v)) return 'holds a control character'
      return null
    case 'one-of': return t.values.has(v) ? null : `is not one of ${[...t.values].join(' ')}`
    case 'list':
      if (!Array.isArray(v) || v.length > t.max) return `is not a list of at most ${t.max}`
      return v.every((x) => (t.of === 'number' ? typeof x === 'number' && Number.isFinite(x) : typeof x === 'string')) ? null : `holds a non-${t.of}`
    case 'counts':
      if (!v || typeof v !== 'object' || Array.isArray(v)) return 'is not an object of counts'
      return Object.entries(v).every(([k, n]) => t.keys.has(k) && Number.isInteger(n) && n >= 0) ? null : 'holds a key or a count outside its set'
    default: return `has the unknown type ${t.is}`
  }
  if (NON_NEGATIVE.has(field.unit) && v < 0) return 'is below 0'
  if (field.unit === '%' && (v < 0 || v > 100)) return 'is outside 0 to 100'
  return null
}

const refuse = (why, kind = null) => ({ ok: false, why, kind: kind?.name ?? null, family: kind?.family ?? null })

// a coordinate: "-", or the print form of coordinate.mjs, K1's frozen day-1 contract (`lacuna:/1/4096/5/0/1/0/-`; SENTRY-2.0 §4).
// It supersedes A2 §2.1's six fields joined by "·", which K1 implemented in this form.
function coordinateOk(at) {
  if (at === '-') return true
  try {
    parseCoordinate(at)
    return true
  } catch {
    return false   // the coordinate's own sentence is the parser's; the validator's reason is schema:at
  }
}

/**
 * One event object against the catalog: A2 §4.2's steps 1–3.
 * @param {*} ev {seq?, t, kind, actor, at, ref, src: [producer, pseq], data}
 * @return {{ok: boolean, why: ?string, kind: ?string, family: ?string}} `why` is a reason of REASONS (`schema:<key>` names the key)
 */
export function validateEvent(ev) {
  if (!ev || typeof ev !== 'object' || Array.isArray(ev)) return refuse('malformed')
  if ('prev' in ev) return refuse('prev-set')
  for (const k of Object.keys(ev)) if (!FIELDS.includes(k)) return refuse('malformed')
  if (typeof ev.kind !== 'string' || ev.kind.length > LIMITS.kind || !KIND_RE.test(ev.kind)) return refuse('malformed')
  if (!Array.isArray(ev.src) || ev.src.length !== 2 || typeof ev.src[0] !== 'string' || ev.src[0].length > LIMITS.producer ||
      !Number.isInteger(ev.src[1]) || ev.src[1] < 0) return refuse('malformed')
  const kind = CATALOG.kinds.get(ev.kind)
  if (!kind) return refuse('unknown-kind')
  const producer = producerOf(ev.src[0])
  // a scene's rows carry their real kinds (RULINGS §1(a): no scene.ev), so the producer that feeds `any` carries every kind;
  // whether it may write one now is the scene gate's (floor-events.mjs, A2 §4.7)
  const p = CATALOG.producers.get(producer)
  if (!p || !(kind.producers.has(producer) || p.feeds.includes('any'))) return refuse('producer', kind)
  if (ev.seq !== undefined && !(Number.isInteger(ev.seq) && ev.seq >= 1)) return refuse('schema:seq', kind)
  if (!Number.isInteger(ev.t) || ev.t < 1e12 || ev.t >= 1e13) return refuse('schema:t', kind)
  if (typeof ev.actor !== 'string' || ev.actor.length > LIMITS.actor || !ACTOR_RE.test(ev.actor)) return refuse('schema:actor', kind)
  if (kind.actor.literal ? ev.actor !== kind.actor.literal : !(ACTOR_RULES[kind.actor.rule] ?? ACTOR_RE).test(ev.actor)) {
    return refuse('schema:actor', kind)
  }
  if (typeof ev.at !== 'string' || ev.at.length > LIMITS.at || !coordinateOk(ev.at) || (kind.at && ev.at === '-')) return refuse('schema:at', kind)
  if (ev.ref !== null && (typeof ev.ref !== 'string' || ev.ref.length === 0 || ev.ref.length > LIMITS.ref)) return refuse('schema:ref', kind)
  if (kind.ref && ev.ref === null) return refuse('schema:ref', kind)
  const data = ev.data ?? {}
  if (!data || typeof data !== 'object' || Array.isArray(data)) return refuse('schema:data', kind)
  const keys = Object.keys(data)
  if (keys.length > LIMITS.keys) return refuse('schema:data', kind)
  for (const k of keys) {
    const field = kind.fields.get(k) ?? (k === 'late' ? DOOR_FIELD : null)
    if (!KEY_RE.test(k) || !field) return refuse(`schema:${k}`, kind)
    if (typeof data[k] === 'string' && data[k].normalize('NFC') !== data[k]) return refuse('malformed', kind)
    if (misfit(data[k], field)) return refuse(`schema:${k}`, kind)
  }
  for (const k of kind.required) if (!(k in data)) return refuse(`schema:${k}`, kind)
  if (writeData(data).length > LIMITS.data) return refuse('too-long', kind)
  return { ok: true, why: null, kind: kind.name, family: kind.family }
}

// one (key value) clause of an (ev …) line, by its position in FIELDS
function fieldOf(form, i) {
  const c = form[i + 1]
  return Array.isArray(c) && nameOf(c[0]) === FIELDS[i] ? c : null
}

/**
 * One canonical `(ev …)` line, read by the one reader and validated (A2 §2.1, §4.2's steps 1–3).
 * @param {string} line the line, without its newline
 * @param {{log?: boolean}=} opts `log`: the line comes from a day file, whose last field is `prev` (else `prev` is refused)
 * @return {{ok: boolean, why: ?string, ev: ?Object, kind: ?string, family: ?string}}
 */
export function readEventLine(line, opts = {}) {
  if (typeof line !== 'string') return { ...refuse('malformed'), ev: null }
  if (new TextEncoder().encode(line).length > LIMITS.line) return { ...refuse('too-long'), ev: null }
  let forms
  try {
    forms = readForms(line)
  } catch {
    return { ...refuse('malformed'), ev: null }   // not slat, or a string that is not NFC: the reader's own refusal
  }
  const form = forms[0]
  if (forms.length !== 1 || !Array.isArray(form) || nameOf(form[0]) !== 'ev') return { ...refuse('malformed'), ev: null }
  const extra = form.length - 1 - FIELDS.length
  const prev = extra === 1 && Array.isArray(form[form.length - 1]) && nameOf(form[form.length - 1][0]) === 'prev'
  if (prev && !opts.log) return { ...refuse('prev-set'), ev: null }
  if (!(extra === 0 || prev)) return { ...refuse('malformed'), ev: null }
  const clauses = FIELDS.map((_, i) => fieldOf(form, i))
  if (clauses.some((c) => !c)) return { ...refuse('malformed'), ev: null }   // a field missing or out of its order
  const [seq, t, kind, actor, at, ref, src, data] = clauses
  if (typeof nameOf(kind[1]) !== 'string' || typeof kind[1] === 'string') return { ...refuse('malformed'), ev: null }   // a kind is a symbol
  let ev
  try {
    ev = { seq: Number(seq[1]), t: Number(t[1]), kind: nameOf(kind[1]), actor: actor[1], at: at[1], ref: nameOf(ref[1]) === 'null' ? null : ref[1],
      src: [src[1], Number(src[2])], data: dataToJson(data[1]) }
  } catch {
    return { ...refuse('malformed'), ev: null }   // a tag or a symbol in data (A2 §2.1)
  }
  return { ...validateEvent(ev), ev }
}
