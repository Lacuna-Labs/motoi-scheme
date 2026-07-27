// model-client.js — the pluggable completion backend.
//
// Two tiers, per the latency mandate (<100ms inline, escalate for agentic):
//   · LOCAL  — a small fast model produces inline ghost text. Target <100ms.
//   · BIG    — a larger reasoning model handles agentic / multi-form edits.
//
// The client is BACKEND-AGNOSTIC. A host wires a real endpoint via `configure`.
// When no backend is present (the common case in this repo, and every CI run),
// the client falls back to a STRUCTURAL generator that proposes candidates from
// the parts-registry itself — so the whole gate + evolve pipeline is testable
// and useful with zero model tokens. This mirrors the existing completions.js
// contract ("never spend tokens unless asked; graceful #f when no backend").
//
// De-branding: every string returned from a backend is run through debrand()
// AND stripFimTokens() before it leaves this module. The model's surfaced
// identity is "the Motoi copilot" — the base-weight provenance never leaks.

import { debrand } from './debrand.js'
import { stripFimTokens, buildFimPrompt, splitAtCursor } from './fim.js'

// ── backend registry ────────────────────────────────────────────────────────
// A backend is { name, complete(prompt, opts) -> Promise<string[]>|string[] }.
// `complete` returns raw candidate strings (the model's fill for the hole).
let _local = null
let _big = null

/**
 * configure — install model backends. Either may be omitted; the structural
 * fallback covers the gap.
 * @param {object} cfg
 * @param {object} [cfg.local]  { complete(prompt, opts) }
 * @param {object} [cfg.big]    { complete(prompt, opts) }
 */
export function configure(cfg = {}) {
  if (cfg.local) _local = cfg.local
  if (cfg.big) _big = cfg.big
}
export function resetBackends() { _local = null; _big = null }
export function hasBackend() { return !!(_local || _big) }

/**
 * proposeInline — get raw inline candidates for an edit position. Uses the local
 * backend if configured, else the structural generator. Always returns cleaned,
 * de-branded candidate strings. Never throws; never spends tokens without a
 * configured backend.
 *
 * @param {import('./fim.js').EditPosition} pos
 * @param {object} [opts]
 * @param {number} [opts.n=4]   number of candidates to request (Darwinian pool)
 * @param {import('./registry-oracle.js').RegistryOracle} [opts.oracle]  used by
 *   the structural fallback to propose only real verbs.
 * @returns {Promise<string[]>}
 */
export async function proposeInline(pos, opts = {}) {
  const n = opts.n ?? 4
  const { prompt } = buildFimPrompt(pos)
  if (_local) {
    try {
      const raw = await _local.complete(prompt, { n, tier: 'local' })
      return clean(raw)
    } catch { /* fall through to structural */ }
  }
  return structuralCandidates(pos, { n, oracle: opts.oracle })
}

/**
 * proposeAgentic — get a candidate for a multi-form / agentic edit from the big
 * model. Falls back to the structural generator (single best-effort form).
 * @param {string} instruction   natural-language task
 * @param {object} context       { buffer, file, oracle }
 * @returns {Promise<string[]>}
 */
export async function proposeAgentic(instruction, context = {}) {
  if (_big) {
    try {
      const raw = await _big.complete(instruction, { tier: 'big', context })
      return clean(raw)
    } catch { /* fall through */ }
  }
  // No big backend: the structural generator can't invent a plan, so it returns
  // an honest empty set — the copilot will say "I don't know — let's run it".
  return []
}

// ── structural fallback ──────────────────────────────────────────────────────
// With no model, we still produce USEFUL, GATE-PASSING candidates by reading the
// registry: complete a partial head-symbol to the real verbs that extend it.
// This is the "cannot invent a function that doesn't exist" property taken to
// its limit — the candidate SOURCE is the registry, so RESOLVE can't reject it.
function structuralCandidates(pos, { n = 4, oracle } = {}) {
  const { prefix } = splitAtCursor(pos)
  // Find the partial symbol the cursor is completing: last run of symbol chars.
  const m = prefix.match(/([a-zA-Z][\w/?!*+.-]*)$/)
  if (!m || !oracle) return []
  const partial = m[1]
  const out = []
  for (const name of oracle.verbs) {
    if (name.startsWith(partial) && name !== partial) {
      out.push(name.slice(partial.length)) // the completion is the tail
      if (out.length >= n * 3) break
    }
  }
  // Prefer shorter, closer completions (a mild "better wins" prior before the
  // reasoning loop re-ranks).
  out.sort((a, b) => a.length - b.length)
  return out.slice(0, n)
}

function clean(raw) {
  const arr = Array.isArray(raw) ? raw : [raw]
  return arr
    .filter((s) => typeof s === 'string' && s.length > 0)
    .map((s) => debrand(stripFimTokens(s)))
}

export default { configure, resetBackends, hasBackend, proposeInline, proposeAgentic }
