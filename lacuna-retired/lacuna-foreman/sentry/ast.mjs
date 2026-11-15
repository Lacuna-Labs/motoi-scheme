// sentry/ast.mjs — AST AT THE BOUNDARIES THE FOREMAN HOLDS (SENTRY-2.0 §3, units 3.0 and 3.3): the call and the turn, and the
// reading of the patch boundary's receipt (the parse itself is the hands', H1). Owns: the `(end …)` form a turn must close
// with (`readEnd`, the states a turn may name; "done" is the foreman's word); the receipt's AST fields read into verdict rows
// (`(ast (file ok|error line msg) …)` → `ast-error` with the repair sentence for the next step, `module-over-law`,
// `test-deleted`, `test-skipped`, `blast-radius`); the call's arguments against the verb's schema (`checkCall`, the schema
// object grammar-step.mjs compiles: the same text the engine masks with) → `bad-call`. Refuses: to parse a file (no parser
// here; the hands parse and the receipt carries the answer); to verify by a model (the model's part is repair: a failed parse
// becomes the next step's instruction, one repair round per failure, three per run); to evaluate anything (text is read as
// data). Implements: SENTRY-2.0 §3 (the four boundaries), §8; LACUNA-SENTRY-1.0 §2.3 (the end form, S-8). Invariants (§18):
// "a step is done only by a receipt that parsed". Faults (§16): F-02 (a call outside its schema, exit 12).
import { parse, Sym } from '../scheme.mjs'
import { verdict } from './verdicts.mjs'

/** The states a turn may close with (SENTRY-1.0 §2.3, S-8): "done" is the foreman's word and is not among them. */
export const END_STATES = Object.freeze(['running', 'waiting-owner', 'paused', 'stalled', 'cut'])
/** Repair rounds: one per failure, this many per run (SENTRY-2.0 §3). */
export const REPAIRS_PER_RUN = 3

const w0 = (x) => (x instanceof Sym ? x.name : x)

/**
 * Read the `(end …)` form at the end of a turn's text. → {ok, turn, at, state, step, open, wake, said_count} or {ok:false, why}.
 * @param {string} text the turn's whole text
 * @returns {object}
 */
export function readEnd(text) {
  const t = String(text || '')
  const i = t.lastIndexOf('(end ')
  if (i < 0) return { ok: false, why: 'no (end …) form: the turn is not over' }
  let forms
  try { forms = parse(t.slice(i)) } catch (e) { return { ok: false, why: `the end form does not read: ${e.message}` } }
  const f = forms[0]
  if (!Array.isArray(f) || w0(f[0]) !== 'end') return { ok: false, why: 'not an (end …) form' }
  const o = {}
  for (const x of f.slice(1)) if (Array.isArray(x) && x.length >= 2) o[w0(x[0])] = x.length === 2 ? x[1] : x.slice(1)
  const state = w0(o.state)
  if (!END_STATES.includes(state)) return { ok: false, why: `state ${JSON.stringify(state)} is not one of ${END_STATES.join(' ')} ("done" is the foreman's word)` }
  const open = Array.isArray(o.open) ? o.open.filter(Array.isArray).map((p) => ({ text: p[1], by: Array.isArray(p[2]) ? p[2][1] : null })) : []
  const wake = Array.isArray(o.wake) ? { [w0(o.wake[0])]: w0(o.wake[1]) } : null
  return { ok: true, turn: Number(o.turn), at: String(o.at ?? ''), state, step: Number(o.step), open, wake, said_count: Number(o['said-count'] ?? 0) }
}

/**
 * The turn's end form as a verdict: a turn that closes with no form, or names "done", is the row `end-form` (a note: the
 * foreman's own form check already refuses the state; the row is the record the light reads).
 * @returns {?object} the verdict, or null when the form reads
 */
export function endCheck(sup, w, text) {
  const r = readEnd(text)
  if (r.ok) return null
  return verdict(sup, w, { check: 'end-form', action: 'note', by: 'code', detail: r.why.slice(0, 160), why: `the turn did not close with a readable (end …) form: ${r.why}` })
}

// a receipt's ast rows as the hands write them: `(file ok|error line msg)` tuples, or objects {file, ok|state, line, msg}
const astRows = (v) => (Array.isArray(v) ? v : []).map((r) => {
  if (Array.isArray(r)) return { file: String(r[0] ?? ''), ok: String(r[1] ?? 'ok') === 'ok', line: r[2] ?? null, msg: r[3] ?? null }
  if (r && typeof r === 'object') return { file: String(r.file ?? ''), ok: r.ok === true || String(r.state ?? r.ok ?? 'ok') === 'ok', line: r.line ?? null, msg: r.msg ?? r.error ?? null }
  return { file: String(r), ok: true, line: null, msg: null }
})
const field = (value, ...names) => { for (const n of names) if (value && value[n] !== undefined) return value[n]; return undefined }

/**
 * The patch boundary's receipt, read into rows (the parse is the hands'): every file that did not parse is `ast-error` with
 * the repair sentence the next step gets; a module over the law `module-over-law` (warn); a deleted or skipped test is a
 * would-kick (a warning, the owner's ruling 5 of 2026-11-02); a blast radius over the role's ceiling is a warn. Nothing here
 * reads the files.
 * @param {object} sup
 * @param {object} w
 * @param {object} t the ticket the receipt closes
 * @param {object} value the receipt
 * @returns {{verdicts: Array<object>, repairs: Array<string>}}
 */
export function receiptAst(sup, w, t, value = {}) {
  const verdicts = [], repairs = []
  const call = t?.call ?? null
  for (const r of astRows(field(value, 'ast'))) {
    if (r.ok) continue
    const repair = `fix ${r.file}${r.line != null ? ` line ${r.line}` : ''}: ${String(r.msg ?? 'it does not parse').slice(0, 120)}`
    const st = (w.sentry ||= {})
    st.repairs = (st.repairs || 0) + 1
    repairs.push(repair)
    verdicts.push(verdict(sup, w, { check: 'ast-error', action: 'note', by: 'code', call, detail: `${t?.op || 'patch'} wrote ${r.file}: it does not parse`,
      why: st.repairs <= REPAIRS_PER_RUN ? `${repair} (repair ${st.repairs} of ${REPAIRS_PER_RUN})` : `${repair}; the run's ${REPAIRS_PER_RUN} repairs are spent` }))
  }
  for (const m of field(value, 'module-over-law', 'module_over_law') || []) {
    const [file, lines] = Array.isArray(m) ? m : [m?.file, m?.lines]
    verdicts.push(verdict(sup, w, { check: 'module-over-law', action: 'warn', by: 'code', call, detail: `${file} is ${lines} lines`, why: `${file} is over the 500-line law at ${lines} lines; split it by responsibility` }))
  }
  for (const [check, key] of [['test-deleted', 'test-deleted'], ['test-skipped', 'test-skipped']]) {
    for (const f of field(value, key, key.replace('-', '_')) || []) {
      const file = Array.isArray(f) ? f[0] : f?.file ?? f
      // a would-kick, a warning: the owner's ruling 5 of 2026-11-02 ("sentries? only warn", LACUNA-1.0-FINALE.md §1); nothing kicks
      verdicts.push(verdict(sup, w, { check, action: 'would-kick', by: 'code', call, detail: `${file}`, why: `${file}: a ${check.replace('test-', '')} test is not a fix` }))
    }
  }
  const blast = field(value, 'blast-radius', 'blast_radius')
  if (blast && (blast.over === true || String(Array.isArray(blast) ? blast[0] : blast.state ?? blast) === 'over')) {
    const ceiling = Array.isArray(blast) ? blast[1] : blast.ceiling ?? '?'
    verdicts.push(verdict(sup, w, { check: 'blast-radius', action: 'warn', by: 'code', call, detail: `lines changed over the ceiling ${ceiling}`, why: `the patch changed more lines than the role's proven ceiling (${ceiling})` }))
  }
  return { verdicts, repairs }
}

/**
 * The call boundary: the op's arguments against the verb's schema, by the step grammar's schema object (K1.4: the same text
 * the engine decodes under). → {ok} or {ok:false, why}; a refusal is the row `bad-call` (exit 12 at the intent door).
 * @param {object} sup
 * @param {object} w
 * @param {{readCall: function(string, Array<*>): {ok: boolean, why?: string}}} schema a step schema from grammar-step.mjs
 * @param {string} op
 * @param {Array<*>|object} args
 * @returns {{ok: boolean, why?: string, verdict?: object}}
 */
export function checkCall(sup, w, schema, op, args) {
  if (!schema || typeof schema.readCall !== 'function') return { ok: true }
  const r = schema.readCall(op, args)
  if (r.ok) return { ok: true }
  const v = verdict(sup, w, { check: 'bad-call', action: 'refuse', by: 'code', detail: `${op}: ${String(r.why).slice(0, 160)}`, why: `${op}'s arguments do not fit its schema: ${r.why}` })
  return { ok: false, why: r.why, verdict: v }
}
