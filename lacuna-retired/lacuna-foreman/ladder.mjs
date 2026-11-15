// ladder.mjs — THE STEP LADDER (SENTRY-2.0 §2 "step ladders", §6 chunking; unit 3.1). Owns: the `(ladder …)` form that
// sits beside a playbook's prose — per step `allows` (the calls), `gives` (the reads to bring, with sizes), `done` (the
// receipt that closes it), `budget` (tokens in, tokens out, seconds), an optional `says` (the step's one sentence), and in
// the head an optional `(done-check "form")`, the run's done-check when its filer gave words (W1.4) —
// its reader (`readLadder`, one sentence on a defect), the fence block that carries it at the head of a Markdown playbook
// (`ladderOf`, `withLadder`), the foreman's own copies under `lacuna-foreman/ladders/` (`loadLadder`: foreman.sb reads
// no playbook under ~/lacuna-world, so the foreman's source is here and the playbook's head carries the same text for
// the mind), the hash of a step's `allows` the ticket carries (`allowsSha`), the minds' sizes until R1's grid lands
// (`SIZES`, SENTRY-2.0 §6: provisional), `fits` (a step against a mind), and the per-step window the foreman assembles
// (role brief + step k + its gives). Refuses: a ladder whose steps are not 1 … N in order or lack one of the four
// fields; an `allows` op that is not a plain name; a budget that is not three whole numbers. A step over every mind's
// size is refused at dispatch by `router.mjs` (`fits` against these sizes) and never attempted by `playbook-run.mjs`: a
// handoff row (K1.13). Implements: SENTRY-2.0 §2, §6, unit 3.1; ROLEBENCH §5.3 (the handoff). Invariants (§18): "a step
// larger than the mind's proven size is never attempted" (held by the router and the runner over `fits`). Faults (§16):
// none by id (a refused dispatch is a handoff row with its why).
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readForms, writeData, dataToJson } from '../../lacuna-scheme/src/slat-data.js'

/** The four fields every step carries. */
export const STEP_FIELDS = Object.freeze(['allows', 'gives', 'done', 'budget'])
/** Where the foreman's copies live (the playbook's head carries the same text; a test keeps them equal). */
export const LADDERS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'ladders')
/** The fence that carries a ladder at the head of a Markdown playbook. */
export const FENCE = Object.freeze({ open: '```slat', close: '```' })
/**
 * The minds' sizes per step until R1's grid lands (SENTRY-2.0 §6: 270M a choice ≤ 768/24; 1B labels and short plans; E4B one
 * step ≤ ~80 changed lines; 12B two or three steps ≤ 300 LOC; 26B the whole playbook). Provisional: the grid replaces this
 * table by the same names.
 * @type {Readonly<Object<string, {in: number, out: number, lines: number, steps: number}>>}
 */
export const SIZES = Object.freeze({
  '270m': { in: 768, out: 24, lines: 0, steps: 0 }, '1b': { in: 768, out: 96, lines: 0, steps: 0 },
  e2b: { in: 8192, out: 1024, lines: 40, steps: 1 }, e4b: { in: 16384, out: 2048, lines: 80, steps: 1 },
  '12b': { in: 32768, out: 4096, lines: 300, steps: 3 }, '26b': { in: 65536, out: 8192, lines: 1000, steps: 64 }, '31b': { in: 65536, out: 8192, lines: 1000, steps: 64 },
})
/** The climb, smallest first (ROLEBENCH §5.3: one climb per step). */
export const RUNGS = Object.freeze(['270m', '1b', 'e2b', 'e4b', '12b', '26b', '31b'])

const word = (x) => (x && typeof x === 'object' && typeof x.name === 'string' ? x.name : typeof x === 'string' ? x : null)
const isForm = (f, head) => Array.isArray(f) && f.length >= 1 && word(f[0]) === head
/** The named parts of a list of forms, by head word (the caller passes the parts, never the form's own head). */
const fields = (parts) => { const o = {}; for (const x of parts) if (Array.isArray(x) && word(x[0])) o[word(x[0])] = x; return o }
const NAME = /^[a-z][a-z0-9-]{0,40}$/

/** sha256 of a step's `allows` as slat data, in ladder order (the ticket carries it; the hands recompute it). */
export function allowsSha(allows) {
  return `sha256:${crypto.createHash('sha256').update(writeData((allows || []).map(String)), 'utf8').digest('hex')}`
}

function readDone(f, n) {
  const alts = []
  for (const d of f.slice(1)) {
    if (isForm(d, 'receipt')) {
      const op = word(d[1])
      if (!op || !NAME.test(op)) throw new Error(`step ${n}: (done (receipt op …)) names an op`)
      const o = { kind: 'receipt', op, exit: 0, file: null }
      for (const x of d.slice(2)) {
        if (isForm(x, 'exit')) o.exit = word(x[1]) === 'any' ? 'any' : Number(x[1])
        else if (isForm(x, 'file')) o.file = String(dataToJson(x[1]))
        else throw new Error(`step ${n}: a receipt's parts are (exit n|any) and (file "glob")`)
      }
      if (o.exit !== 'any' && !Number.isInteger(o.exit)) throw new Error(`step ${n}: (exit …) is a whole number or any`)
      alts.push(o)
    } else if (isForm(d, 'answer')) {
      const names = isForm(d[1], 'names') ? d[1].slice(1).map((x) => String(dataToJson(x))) : []
      if (!names.length) throw new Error(`step ${n}: (done (answer (names "…" …))) names at least one word`)
      alts.push({ kind: 'answer', names })
    } else throw new Error(`step ${n}: done is (receipt op …) or (answer (names …)) forms`)
  }
  if (!alts.length) throw new Error(`step ${n}: done names at least one receipt or answer`)
  return alts
}

function readGives(f, n) {
  return f.slice(1).map((g) => {
    if (isForm(g, 'read') || isForm(g, 'file')) { const p = dataToJson(g[1]); const kb = g.slice(2).find((x) => isForm(x, 'kb')); return { kind: 'read', path: String(p), kb: kb ? Number(kb[1]) : null } }
    if (isForm(g, 'hand')) return { kind: 'hand', op: word(g[1]), args: g.slice(2).map((x) => dataToJson(x)) }
    if (isForm(g, 'text')) return { kind: 'text', text: String(dataToJson(g[1])) }
    throw new Error(`step ${n}: gives holds (read "path" (kb n)), (hand op args…) or (text "…") forms`)
  })
}

function readBudget(f, n) {
  const o = { in: null, out: null, s: null }
  for (const x of f.slice(1)) { const k = word(x?.[0]); if (k in o) o[k] = Number(x[1]) }
  for (const k of Object.keys(o)) if (!Number.isInteger(o[k]) || o[k] < 0) throw new Error(`step ${n}: budget is (in tokens) (out tokens) (s seconds), whole numbers`)
  return o
}

/**
 * Read one `(ladder (playbook "NAME") (version n) (role r) (step 1 (allows …) (gives …) (done …) (budget …) [(says "…")]) …)`.
 * @param {string} text slat text (one ladder form)
 * @returns {{playbook: string, version: number, role: ?string, steps: Array<{n: number, allows: string[], gives: Array<object>, done: Array<object>, budget: {in: number, out: number, s: number}, says: ?string}>}}
 * @throws {Error} one sentence naming the step and the fault
 */
export function readLadder(text) {
  let forms
  try { forms = readForms(String(text || '')) } catch (e) { throw new Error(`the ladder does not read: ${e.message}`) }
  const f = forms.find((x) => isForm(x, 'ladder'))
  if (!f || forms.length !== 1) throw new Error('a ladder is exactly one (ladder …) form')
  const head = fields(f.slice(1).filter((x) => Array.isArray(x) && word(x[0]) !== 'step'))
  const playbook = head.playbook ? String(dataToJson(head.playbook[1])) : null
  if (!playbook) throw new Error('a ladder names its playbook: (playbook "NAME")')
  const version = head.version ? Number(head.version[1]) : 1
  const role = head.role ? word(head.role[1]) : null
  // W1.4: the run's done-check, a Scheme form in a string the foreman's doneCheck evaluates (intents.mjs); optional
  const doneCheck = head['done-check'] ? String(dataToJson(head['done-check'][1])).trim() : null
  if (doneCheck !== null && !/^\(/.test(doneCheck)) throw new Error(`the ladder ${playbook}'s done-check is a form in a string, not ${JSON.stringify(doneCheck.slice(0, 40))}`)
  const steps = []
  for (const s of f.slice(1).filter((x) => isForm(x, 'step'))) {
    const n = Number(s[1])
    if (n !== steps.length + 1) throw new Error(`the steps run 1 … N in order; step ${steps.length + 1} is ${s[1]}`)
    const o = fields(s.slice(2))
    for (const k of STEP_FIELDS) if (!o[k]) throw new Error(`step ${n} lacks (${k} …): every step has ${STEP_FIELDS.join(', ')}`)
    const allows = o.allows.slice(1).map((x) => word(x) ?? String(dataToJson(x)))
    for (const a of allows) if (!NAME.test(a)) throw new Error(`step ${n}: allows names ops as plain names, not ${JSON.stringify(a)}`)
    steps.push({ n, allows, gives: readGives(o.gives, n), done: readDone(o.done, n), budget: readBudget(o.budget, n), says: o.says ? String(dataToJson(o.says[1])) : null })
  }
  if (!steps.length) throw new Error(`the ladder ${playbook} has no step`)
  return { playbook, version, role, doneCheck, steps }
}

/** The ladder text at the head of a Markdown playbook (a ```slat fence before the first heading), or null. */
export function ladderOf(markdown) {
  const t = String(markdown || '')
  const open = t.indexOf(FENCE.open)
  if (open < 0) return null
  const first = t.startsWith('#') ? 0 : t.indexOf('\n#')   // every playbook opens with its heading: a fence below it is prose
  if (first >= 0 && first < open) return null
  const close = t.indexOf(`\n${FENCE.close}`, open + FENCE.open.length)
  if (close < 0) return null
  return t.slice(open + FENCE.open.length, close).trim()
}

/** The playbook's text with the ladder fence at its head (an existing fence is replaced; the prose stays byte for byte). */
export function withLadder(markdown, ladderText) {
  const t = String(markdown || '')
  const had = ladderOf(t)
  const body = had ? t.slice(t.indexOf(`\n${FENCE.close}`, t.indexOf(FENCE.open)) + FENCE.close.length + 1).replace(/^\n+/, '') : t
  return `${FENCE.open}\n${String(ladderText).trim()}\n${FENCE.close}\n\n${body}`
}

/**
 * The foreman's copy of a playbook's ladder, by name (`lacuna-foreman/ladders/<NAME>.slat`), or null when there is none.
 * @param {string} name the playbook's name (WATCHDOG-RED)
 * @param {string} [dir]
 * @returns {?object} the ladder (see readLadder)
 */
export function loadLadder(name, dir = LADDERS_DIR) {
  const n = String(name || '').toUpperCase().replace(/\.md$/i, '')
  if (!/^[A-Z][A-Z0-9-]{0,40}$/.test(n)) return null
  let text
  try { text = fs.readFileSync(path.join(dir, `${n}.slat`), 'utf8') } catch { return null }
  return readLadder(text)
}

/** Every ladder in the folder, by playbook name. */
export function loadLadders(dir = LADDERS_DIR) {
  const out = new Map()
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.slat')).sort()) out.set(path.basename(f, '.slat'), readLadder(fs.readFileSync(path.join(dir, f), 'utf8')))
  return out
}

/**
 * Does the step fit the mind (SENTRY-2.0 §6)? The step's budget against the mind's size (the grid's row when it lands).
 * @param {{budget: {in: number, out: number}}} step
 * @param {string} mind a mind id (e4b, 12b …)
 * @param {Object<string, object>} [sizes]
 * @returns {{ok: boolean, why: ?string}}
 */
export function fits(step, mind, sizes = SIZES) {
  const size = sizes[String(mind || '').toLowerCase()]
  if (!size) return { ok: false, why: `no size is known for the mind ${mind}` }
  if (step.budget.in > size.in) return { ok: false, why: `step ${step.n} asks ${step.budget.in} tokens in; the ${mind} holds ${size.in}` }
  if (step.budget.out > size.out) return { ok: false, why: `step ${step.n} asks ${step.budget.out} tokens out; the ${mind} gives ${size.out}` }
  return { ok: true, why: null }
}

/** The smallest rung that fits the step, from `from` upward (one climb per step), or null. */
export function rungFor(step, from = null, sizes = SIZES) {
  const start = from ? RUNGS.indexOf(String(from).toLowerCase()) + 1 : 0
  for (const m of RUNGS.slice(Math.max(0, start))) if (sizes[m] && fits(step, m, sizes).ok) return m
  return null
}

/**
 * The window for step k: the role brief, the step's sentence, what it may call, what to bring, what closes it, its budget.
 * @param {object} ladder
 * @param {number} k
 * @param {{brief?: string}} [o]
 * @returns {{step: object, text: string}}
 */
export function window(ladder, k, o = {}) {
  const step = ladder.steps[k - 1]
  if (!step) throw new Error(`the ladder ${ladder.playbook} has no step ${k}`)
  const gives = step.gives.map((g) => (g.kind === 'read' ? `read ${g.path}${g.kb ? ` (${g.kb} KB)` : ''}` : g.kind === 'hand' ? `${g.op} ${g.args.join(' ')}`.trim() : g.text))
  const done = step.done.map((d) => (d.kind === 'receipt' ? `a receipt of ${d.op}${d.exit === 'any' ? '' : ` with exit ${d.exit}`}${d.file ? ` touching ${d.file}` : ''}` : `an answer naming ${d.names.join(', ')}`))
  const text = [o.brief ? String(o.brief).trim() : null,
    `Step ${k} of ${ladder.steps.length} (${ladder.playbook}${step.says ? `): ${step.says}` : ')'}`,
    `You may call: ${step.allows.join(' ')}.`,
    gives.length ? `Bring first: ${gives.join('; ')}.` : null,
    `The step is done by ${done.join(', or ')}.`,
    `Budget: ${step.budget.in} tokens in, ${step.budget.out} out, ${step.budget.s} s.`].filter(Boolean).join('\n')
  return { step, text }
}
