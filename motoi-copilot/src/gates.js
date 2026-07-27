// gates.js — the three-gate non-hallucination pipeline.
//
// Every ghost-text suggestion passes THREE gates before it is ever shown:
//
//   Gate 1  PARSE   — the reconstructed buffer is balanced s-expressions and
//                     the reader accepts it. No unbalanced parens, no garbage.
//   Gate 2  RESOLVE — every symbol in the completion resolves against the LOCKED
//                     parts-registry (∪ special forms ∪ syntax keywords ∪ the
//                     completion's own local bindings). It CANNOT ghost an
//                     unbound verb. This is the defensible edge.
//   Gate 3  SPEC-RUN — the reconstructed program is RUN in a fuel-capped
//                     sandbox; if it errors, the suggestion is suppressed.
//
// Gates 2 and 3 are impossible for open-language / non-runnable competitors:
// they require a closed, enumerable name-space and a deterministic interpreter,
// which Motoi has and JavaScript/Python copilots do not.
//
// A candidate that passes all three is `offerable`. One that fails any gate
// carries the gate + reason, which the SFT/reasoning layer keeps as teaching
// signal (a rejected candidate is a negative example, not garbage).

import { parse } from 'motoi-scheme/reader'
import { RegistryOracle } from './registry-oracle.js'
import { speculativeRun } from './sandbox.js'
import { reconstruct, isBalanced, stripFimTokens, parenDelta } from './fim.js'

export const GATE = Object.freeze({
  PARSE: 'parse',
  RESOLVE: 'resolve',
  SPEC_RUN: 'spec-run',
})

/**
 * A GateResult records the full verdict for one candidate.
 * @typedef {object} GateResult
 * @property {boolean} offerable         passed all applicable gates
 * @property {string}  [failedGate]      first gate that rejected it
 * @property {string}  [reason]          human-readable failure reason
 * @property {string[]} [unresolved]     symbols that failed RESOLVE
 * @property {object}  [run]             sandbox verdict (when SPEC-RUN ran)
 * @property {string}  middle            the (cleaned) candidate text
 * @property {string}  program           the reconstructed full program
 * @property {number}  ms                total gate time (ms)
 */

/**
 * A GateContext holds the shared, expensive state (the oracle) so the pipeline
 * doesn't rebuild the registry per candidate.
 */
export class GateContext {
  /**
   * @param {object} [opts]
   * @param {RegistryOracle} [opts.oracle]  reuse an existing oracle
   * @param {Set<string>} [opts.verbs]      inject a layered registry (a downstream dialect / Curator)
   * @param {boolean} [opts.speculate=true] run Gate 3 (can be disabled for the
   *   fastest inline pass; Gates 1+2 alone already block hallucinated verbs).
   * @param {number} [opts.fuel]            sandbox fuel budget
   * @param {number} [opts.timeoutMs]       sandbox wall-clock cap
   */
  constructor(opts = {}) {
    this.oracle = opts.oracle instanceof RegistryOracle
      ? opts.oracle
      : new RegistryOracle({ verbs: opts.verbs })
    this.speculate = opts.speculate !== false
    this.fuel = opts.fuel
    this.timeoutMs = opts.timeoutMs
  }
}

/**
 * runGates — put ONE candidate through the pipeline.
 *
 * @param {string} middleRaw   raw model completion for the hole (may carry FIM
 *   tokens / trailing junk).
 * @param {object} splice      { prefix, suffix } from the FIM split. The gates
 *   evaluate the FULL reconstructed buffer, not the fragment — because a
 *   fragment that is unbalanced alone may be perfectly balanced in context.
 * @param {GateContext} ctx
 * @param {object} [opts]
 * @param {Set<string>} [opts.outerScope]  names bound by the surrounding buffer
 *   (so a completion using a let-bound var from the prefix is not flagged).
 * @returns {GateResult}
 */
export function runGates(middleRaw, splice, ctx, opts = {}) {
  const t0 = now()
  const middle = stripFimTokens(middleRaw ?? '').replace(/\s+$/,'')
  const prefix = splice.prefix ?? ''
  const suffix = splice.suffix ?? ''
  const program = reconstruct(prefix, middle, suffix)
  const fail = (gate, reason, extra = {}) => ({
    offerable: false, failedGate: gate, reason, middle, program,
    ms: round(now() - t0), ...extra,
  })

  // Empty / whitespace middle is a legitimate NO-OP, not a failure — but it is
  // never "offerable" as ghost text (nothing to show).
  if (middle.length === 0) {
    return fail(GATE.PARSE, 'empty completion')
  }

  // ── Gate 1: PARSE ──────────────────────────────────────────────────────
  // Fast structural check first (cheap), then the real reader.
  const delta = parenDelta(program)
  if (delta === null) {
    return fail(GATE.PARSE, 'structurally impossible (stray close or unterminated string)')
  }
  if (!isBalanced(program)) {
    return fail(GATE.PARSE, `unbalanced s-expression (net paren depth ${delta})`)
  }
  let forms
  try {
    forms = parse(program)
  } catch (e) {
    return fail(GATE.PARSE, `reader rejected: ${e.message}`)
  }
  if (!Array.isArray(forms) || forms.length === 0) {
    return fail(GATE.PARSE, 'no complete forms')
  }

  // ── Gate 2: RESOLVE ────────────────────────────────────────────────────
  // Every symbol must resolve. We walk each top-level form with the outer
  // scope carried in. THIS is where an unbound verb is caught before display.
  const outerScope = opts.outerScope instanceof Set ? opts.outerScope : new Set()
  const unresolved = []
  for (const form of forms) {
    for (const bad of ctx.oracle.unresolved(form, outerScope)) {
      if (!unresolved.includes(bad)) unresolved.push(bad)
    }
  }
  if (unresolved.length > 0) {
    return fail(GATE.RESOLVE,
      `unbound symbol${unresolved.length > 1 ? 's' : ''}: ${unresolved.join(', ')}`,
      { unresolved })
  }

  // ── Gate 3: SPEC-RUN ───────────────────────────────────────────────────
  if (ctx.speculate) {
    const run = speculativeRun(program, { fuel: ctx.fuel, timeoutMs: ctx.timeoutMs })
    if (!run.ok) {
      return fail(GATE.SPEC_RUN, `ran but errored (${run.kind}): ${run.error}`, { run })
    }
    return {
      offerable: true, middle, program, run,
      ms: round(now() - t0),
    }
  }

  return { offerable: true, middle, program, ms: round(now() - t0) }
}

/**
 * screen — put MANY candidates through the pipeline and return only the
 * offerable ones plus the full rejection log (kept as teaching signal).
 *
 * @param {string[]} candidates   raw model completions
 * @param {object} splice         { prefix, suffix }
 * @param {GateContext} ctx
 * @param {object} [opts]         passed to runGates
 * @returns {{offerable:GateResult[], rejected:GateResult[]}}
 */
export function screen(candidates, splice, ctx, opts = {}) {
  const offerable = []
  const rejected = []
  const seen = new Set() // dedupe identical middles
  for (const c of candidates) {
    const r = runGates(c, splice, ctx, opts)
    const key = r.middle
    if (r.offerable) {
      if (seen.has(key)) continue
      seen.add(key)
      offerable.push(r)
    } else {
      rejected.push(r)
    }
  }
  return { offerable, rejected }
}

function now() {
  if (typeof performance !== 'undefined' && performance.now) return performance.now()
  const [s, ns] = process.hrtime(); return s * 1000 + ns / 1e6
}
function round(x) { return Math.round(x * 1000) / 1000 }

export default { GATE, GateContext, runGates, screen }
