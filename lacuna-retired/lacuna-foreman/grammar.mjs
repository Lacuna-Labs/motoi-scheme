// THE ACTION SELECTOR'S GRAMMAR — owns what a small mind may say: from verbs.slat and one mind job (verbs ⊆ the worker's, its labels),
//   mindGrammar(job) → a GBNF text (llama.cpp decodes under it) and readAnswer(text, job) → the same rules in code (Ollama ignores `grammar`).
// Refuses: any verb outside the job; procedures, program text or expressions in an argument; spawn, on, every, after (never mindable);
//   evaluating the answer — it is READ as data, never evaluated. What fails is dropped and counted, never run.
// Implements: design §11 (action selector by grammar), §10; keeps LACUNA-1.3-DESIGN §36 (B42) as history.
// Invariants (§18): none written here; enforces law 11 (untrusted input never triggers a consequential action) and law 1 (a mind never writes code).
// Faults (§16): none by id (a refused answer is dropped and counted in w.mind.dropped).
import { parse, Sym } from './scheme.mjs'
import { VERBS, PURE, HAND_READS } from './capabilities.mjs'

const SHAPE = new Map(VERBS.map((v) => [v.name, v.args || []]))
const METRICS = VERBS.find((v) => v.name === 'subscribe').metrics
const CODE_SHAPES = new Set(['proc', 'program', 'expr'])
export const LIMIT = Object.freeze({ str: 400, sym: 40, star: 4 })

/** May a mind ever choose this verb? Only one that reaches outside and takes data, never code. */
export function mindable(verb) {
  const shape = SHAPE.get(verb)
  return !!shape && !PURE.has(verb) && !shape.some((s) => CODE_SHAPES.has(s.replace(/[?*]$/, '')))
}

// The data forms every job may answer with: they are delivered to the worker as data and run nothing.
const DATA_FORMS = { summary: ['str'], observe: ['sym', 'datum'] }

const lit = (s) => JSON.stringify(s)
const rule = (verb) => `v-${verb.replace(/[^a-z0-9]+/g, '-')}`

/** The GBNF for one job: root is exactly one form, and the forms are the job's verbs, its labels, summary, observe. */
export function mindGrammar(job) {
  const forms = [...job.verbs].filter(mindable)
  const lines = []
  const alts = forms.map(rule)
  for (const v of forms) lines.push(`${rule(v)} ::= ${lit(v)}${argsRule(SHAPE.get(v))}`)
  if (job.labels.length) { alts.push('d-label'); lines.push(`d-label ::= "label" sp label`) }
  for (const [name, shape] of Object.entries(DATA_FORMS)) { alts.push(`d-${name}`); lines.push(`d-${name} ::= ${lit(name)}${argsRule(shape)}`) }
  return [
    `root ::= "(" form ")"`,
    `form ::= ${alts.join(' | ')}`,
    ...lines,
    `sp ::= " "`,
    `sym ::= "'" [a-z] [a-z0-9_-]{0,${LIMIT.sym - 1}}`,
    `str ::= "\\"" ( [^"\\\\\\n] | "\\\\" ["\\\\n] ){0,${LIMIT.str}} "\\""`,
    `num ::= "-"? [0-9]{1,12} ("." [0-9]{1,6})?`,
    `datum ::= str | num | sym | "#t" | "#f"`,
    `label ::= ${job.labels.length ? job.labels.map((l) => lit(`'${l}`)).join(' | ') : 'sym'}`,
    `metric ::= ${METRICS.map((m) => lit(`'${m}`)).join(' | ')}`,
    `op ::= ${[...HAND_READS].map((o) => lit(`'${o}`)).join(' | ')}`,
  ].join('\n') + '\n'
}

function argsRule(shape) {
  return shape.map((s) => {
    const base = s.replace(/[?*]$/, '')
    const r = base
    return s.endsWith('*') ? ` (sp ${r}){0,${LIMIT.star}}` : s.endsWith('?') ? ` (sp ${r})?` : ` sp ${r}`
  }).join('')
}

// ── the same rules, in code ─────────────────────────────────────────────────────────────────────────────────────────
const quoted = (x) => Array.isArray(x) && x.length === 2 && x[0] instanceof Sym && x[0].name === 'quote' && x[1] instanceof Sym
const SYM_RE = new RegExp(`^[a-z][a-z0-9_-]{0,${LIMIT.sym - 1}}$`)

function fits(base, x, job) {
  switch (base) {
    case 'str': case 'id': return typeof x === 'string' && x.length <= LIMIT.str
    case 'num': return typeof x === 'number' && Number.isFinite(x)
    case 'sym': return quoted(x) && SYM_RE.test(x[1].name)
    case 'label': return quoted(x) && job.labels.includes(x[1].name)
    case 'metric': return quoted(x) && METRICS.includes(x[1].name)
    case 'op': return quoted(x) && HAND_READS.has(x[1].name)
    case 'datum': return typeof x === 'boolean' || fits('str', x) || fits('num', x) || fits('sym', x)
    default: return false
  }
}

function matchArgs(shape, args, job) {
  let i = 0
  for (const s of shape) {
    const base = s.replace(/[?*]$/, '')
    if (s.endsWith('*')) { let n = 0; while (i < args.length && n < LIMIT.star && fits(base, args[i], job)) { i++; n++ } }
    else if (s.endsWith('?')) { if (i < args.length && fits(base, args[i], job)) i++ }
    else if (i < args.length && fits(base, args[i], job)) i++
    else return false
  }
  return i === args.length
}

/** Plain JS values out of checked arguments: a quoted symbol stays a symbol (the verb wants one), the rest as is. */
const value = (x) => (quoted(x) ? x[1] : x)

/**
 * Read a mind's answer under its job. → {ok, kind: 'verb'|'label'|'summary'|'observe', verb?, args?, label?, text}
 * or {ok:false, why}. Never evaluates anything: the reader turns text into data, and data is all that is checked.
 */
export function readAnswer(text, job) {
  const t = String(text || '').trim()
  let forms
  try { forms = parse(t) } catch (e) { return { ok: false, why: `it does not read: ${e.message}` } }
  if (forms.length !== 1 || !Array.isArray(forms[0]) || !(forms[0][0] instanceof Sym)) return { ok: false, why: 'not exactly one form' }
  const [head, ...args] = forms[0]
  const h = head.name
  if (h === 'label') {
    if (!job.labels.length || args.length !== 1 || !fits('label', args[0], job)) return { ok: false, why: `(label …) must be one of ${job.labels.join(', ') || 'no labels'}` }
    return { ok: true, kind: 'label', label: args[0][1].name, text: t }
  }
  if (DATA_FORMS[h]) {
    if (!matchArgs(DATA_FORMS[h], args, job)) return { ok: false, why: `(${h} …) has the wrong arguments` }
    return { ok: true, kind: h, args: args.map(value), text: t }
  }
  if (!job.verbs.has(h) || !mindable(h)) return { ok: false, why: `'${h}' is not in this job's grammar` }
  if (!matchArgs(SHAPE.get(h), args, job)) return { ok: false, why: `(${h} …) has the wrong arguments` }
  return { ok: true, kind: 'verb', verb: h, args: args.map(value), text: t }
}
