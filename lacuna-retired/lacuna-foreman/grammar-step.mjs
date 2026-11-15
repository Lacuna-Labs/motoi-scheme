// grammar-step.mjs — THE LATCH COMPILED TO THE GRAMMAR (ROAD-TO-1.0 category 5 "the Arbiter", SENTRY-2.0 §2; unit K1.4).
// Owns: from step k's `allows` and the verbs' schema, the one grammar text the engine decodes under (the intent grammar
// of lacuna-scheme narrowed to the step's calls: a mind cannot emit a call outside its step), the same text loaded as
// rules for the AST check at the call (`readCall`: the call's canonical slat text matched against the grammar; full CFG
// semantics, no second parser), the mind grammar for the worker verbs a step allows (what playbook-run.mjs and mind.mjs
// hand `askMind`), and the hash of the step's `allows` the ticket carries. One grammar text, three enforcers: the
// engine's mask, the call boundary here, the sentry's fence (sentry/fence.mjs reads the same `allows`). Refuses: a step
// with no `allows` (nothing to decode under: one sentence); a call whose op is outside the step or whose arguments do not
// read as slat data (`bad-call`, exit 12 at the intent door); evaluating anything (the text is matched, never run).
// Implements: ROAD category 5 D1 ("the latch compiles to the grammar"), SENTRY-2.0 §2–§3, design §7.1, §7.10.
// Invariants (§18): "a call the grammar refuses was never decodable: the mask and the check are one text". Faults (§16):
// F-02 (bad-call, exit 12).
import fs from 'node:fs'
import { loadGrammar, matchGrammar, intentGrammar } from '../../lacuna-scheme/src/grammar.js'
import { writeData } from '../../lacuna-scheme/src/slat-data.js'
import { mindGrammar, mindable } from './grammar.mjs'
import { allowsSha } from './ladder.mjs'

export { allowsSha }

/** The slat line grammar every intent grammar is built on (lacuna-scheme/grammar/slat-line.gbnf). */
export const LINE_GBNF = fs.readFileSync(new URL('../../lacuna-scheme/grammar/slat-line.gbnf', import.meta.url), 'utf8')
/** A step with no deadline decodes with this many seconds in its grammar (design §6 change 2c: the foreman clamps the value). */
export const DEFAULT_S = 600

const isPlain = (x) => x && typeof x === 'object' && !Array.isArray(x)

/**
 * Compile step k: `{step, allows, sha, text, rules, mind, readCall}`.
 * @param {{n: number, allows: string[], budget?: {s?: number}}} step a ladder step
 * @returns {object}
 * @throws {Error} a step with no allows, or a grammar that does not load (an undefined rule)
 */
export function stepGrammar(step) {
  const allows = (step.allows || []).map(String)
  if (!allows.length) throw new Error(`step ${step.n} allows nothing: there is no grammar to decode under`)
  const text = intentGrammar({ hands: allows, deadline: step.budget?.s ?? DEFAULT_S }, LINE_GBNF)
  const rules = loadGrammar(text)
  const verbs = allows.filter(mindable)
  const mind = verbs.length ? mindGrammar({ name: `step-${step.n}`, verbs: new Set(verbs), labels: [] }) : null
  /**
   * The call boundary: is `(op args)` a call this step's grammar accepts? The call is written as the one intent form and
   * matched against the same text the engine masks with.
   * @param {string} op
   * @param {Array<*>|object} args
   * @returns {{ok: boolean, why?: string}}
   */
  const readCall = (op, args) => {
    const o = String(op ?? '')
    if (!allows.includes(o)) return { ok: false, why: `${o} is outside step ${step.n}'s allows (${allows.join(' ')})` }
    let data
    try { data = writeData(isPlain(args) ? args : { list: Array.isArray(args) ? args : args == null ? [] : [args] }) } catch (e) { return { ok: false, why: `the arguments are not data: ${e.message}` } }
    const intent = `(@ ("id" "i") ("tool" ${writeData(o)}) ("args" ${data}) ("promise" "") ("deadline" 1) ("idem" #f))`
    const m = matchGrammar(rules, intent)
    return m.ok ? { ok: true } : { ok: false, why: `the call does not fit step ${step.n}'s grammar (stops at character ${m.furthest} of its form)` }
  }
  return Object.freeze({ step: step.n, allows, sha: allowsSha(allows), text, rules, mind, readCall })
}
