// completions.js — Tier-A (free) + Tier-B (LLM-augmented) completion
// verb family. Per Alfred (2026-07-17): "code completion stuff... good
// tab complete library imports."
//
// Spec: engineering/LLM-AUGMENTED-REPL-1.0.ENG.slat (v1.0-completions
// addendum, 2026-07-17).
//
// Verbs installed (6):
//   Tier A — free, no LLM tokens (<10ms):
//     completions/at-point
//     completions/import-suggestions
//     completions/next-arg
//   Tier B — LLM-augmented, metered:
//     completions/smart-at-point
//     completions/body
//   Config:
//     completions/mode
//
// Tier A relies on:
//   - the verb registry (name matches, doc, contract)
//   - the caller's env (already-bound symbols)
//   - the enclosing verb's :contract field (when known)
//
// Tier B calls llm/ask (or llm/complete) with a registry snapshot as
// prompt context. If MOTOI_LLM_ENDPOINT is unset, Tier B falls back
// silently to Tier A results.
//
// Installer runs AFTER installLLM so it can look up llm/ask + llm/complete
// on the env.

import { Sym } from '../../src/reader.js'
import { snapshotRegistry } from '../../src/verbRegistry.js'

// ── helpers ─────────────────────────────────────────────────────────

const nm = (x) => (x instanceof Sym ? x.name : x)

// Parse keyword-plist args: (:key val :key val) → { key: val, … }
function kwargsToObj(args) {
  const out = {}
  for (let i = 0; i + 1 < args.length; i += 2) {
    const kRaw = args[i]
    const kName = kRaw instanceof Sym ? kRaw.name : String(kRaw)
    if (!kName.startsWith(':')) continue
    let v = args[i + 1]
    if (v instanceof Sym) v = v.name
    out[kName.slice(1)] = v
  }
  return out
}

// Build a candidate record (alist) shaped exactly as the spec asks.
function candidateRecord({ candidate, kind, arity, doc, score, source }) {
  return [
    [new Sym(':candidate'), new Sym(String(candidate))],
    [new Sym(':kind'),      new Sym(String(kind))],
    [new Sym(':arity'),     arity ?? false],
    [new Sym(':doc'),       doc ?? ''],
    [new Sym(':score'),     score],
    [new Sym(':source'),    new Sym(String(source))],
  ]
}

// Prefix match — highest weight.
function prefixScore(query, name) {
  return name.startsWith(query) ? 1 : 0
}

// Sub-word match (matches after a namespace slash or delimiter).
function subwordScore(query, name) {
  if (name.includes('/' + query)) return 1
  if (name.includes('-' + query)) return 1
  return 0
}

// Fuzzy match — every char of query appears in order in name. Returns
// a score in [0, 1) where denser matches score higher. Prefix hits
// dominate this via the higher-scale prefix weight.
function fuzzyScore(query, name) {
  if (!query) return 0
  let qi = 0
  let firstIdx = -1
  let lastIdx = -1
  for (let ni = 0; ni < name.length && qi < query.length; ni++) {
    if (name[ni] === query[qi]) {
      if (firstIdx < 0) firstIdx = ni
      lastIdx = ni
      qi++
    }
  }
  if (qi < query.length) return 0
  const span = lastIdx - firstIdx + 1
  // Tighter spans score higher. Bias against very long matches.
  return Math.max(0.01, query.length / (span + name.length * 0.1))
}

// Score + rank a name against a query. Returns { score, kind } where
// kind labels how it matched (for :source in the record).
function scoreName(query, name) {
  const lname = name.toLowerCase()
  const lq = query.toLowerCase()
  const px = prefixScore(lq, lname)
  if (px > 0) return { score: 3 + (query.length / name.length), kind: 'prefix' }
  const sw = subwordScore(lq, lname)
  if (sw > 0) return { score: 2 + (query.length / name.length), kind: 'subword' }
  const fz = fuzzyScore(lq, lname)
  if (fz > 0) return { score: 1 + fz, kind: 'fuzzy' }
  return { score: 0, kind: 'none' }
}

// Guess the (motoi <module>) form for a verb name based on its namespace
// prefix. Best-effort; kids will still get useful suggestions.
//
// The mapping mirrors the physical layout under lib/ plus a small set of
// module-only aliases that live under modules/.
const NAMESPACE_TO_MODULE = new Map([
  ['note',        ['motoi', 'audio']],
  ['synth',       ['motoi', 'audio']],
  ['audio',       ['motoi', 'audio']],
  ['tick',        ['motoi', 'audio']],
  ['sprite',      ['motoi', 'graphics']],
  ['text',        ['motoi', 'graphics']],
  ['fb',          ['motoi', 'graphics']],
  ['geom',        ['motoi', 'graphics']],
  ['vec',         ['motoi', 'graphics']],
  ['easing',      ['motoi', 'graphics']],
  ['animation',   ['motoi', 'graphics']],
  ['entity',      ['motoi', 'game']],
  ['world',       ['motoi', 'game']],
  ['grid',        ['motoi', 'game']],
  ['camera',      ['motoi', 'game']],
  ['motion',      ['motoi', 'game']],
  ['scene',       ['motoi', 'game']],
  ['game',        ['motoi', 'game']],
  ['prefab',      ['motoi', 'game-entity-advanced']],
  ['juggle',      ['motoi', 'game-juggle']],
  ['ai',          ['motoi', 'ai']],
  ['cortex',      ['motoi', 'ai']],
  ['llm',         ['motoi', 'ai']],
  ['copilot',     ['motoi', 'ai']],
  ['completions', ['motoi', 'ai']],
  ['eng',         ['motoi', 'math-advanced']],
  ['ops',         ['motoi', 'math-advanced']],
  ['alg',         ['motoi', 'base']],
  ['assert',      ['motoi', 'base']],
  ['math',        ['motoi', 'math']],
  ['const',       ['motoi', 'math']],
  ['system',      ['motoi', 'system']],
  ['input',       ['motoi', 'system']],
  ['time',        ['motoi', 'system']],
  ['artifact',    ['motoi', 'system']],
  ['composer',    ['motoi', 'composer']],
  ['scheduler',   ['motoi', 'game']],
  ['part',        ['motoi', 'game']],
])

// Given a verb name, return the import path as a list-shaped value or
// null when we can't guess. Returns e.g. [Sym('motoi'), Sym('audio')].
function guessImportPath(name) {
  const slash = name.indexOf('/')
  if (slash <= 0) return null
  const ns = name.slice(0, slash)
  const parts = NAMESPACE_TO_MODULE.get(ns)
  if (!parts) return null
  return parts.map((p) => new Sym(p))
}

// Read the in-process completion mode. Env-var backed so cart authors
// can pin it; in-memory override wins for the current process.
let _completionMode = null
function currentMode() {
  if (_completionMode) return _completionMode
  const env = process.env.MOTOI_LLM_COMPLETION_MODE
  if (env === 'local-only' || env === 'local-then-llm' || env === 'llm-first') return env
  return 'local-only'  // safe default — never spend tokens unless asked
}

// ── verbs ───────────────────────────────────────────────────────────

export function installCompletions(env, fuel) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  // (completions/at-point partial . opts) → list of candidate records.
  //
  // Prefix + fuzzy match against the verb registry AND already-bound
  // env symbols. Rank: exact-prefix > subword > fuzzy. Contract calls
  // for <5ms, but the registry can be several thousand entries so we
  // do one sweep with a small heap-like top-N filter.
  //
  // opts (keyword plist):
  //   :context      — surrounding forms (unused today, spec-ready)
  //   :cursor-form  — form the cursor is in (unused today, spec-ready)
  //   :limit        — max candidates to return (default 20)
  def('completions/at-point', (partial, ...rest) => {
    const opts = kwargsToObj(rest)
    const query = String(nm(partial))
    const limit = Number(opts.limit ?? 20)
    if (query.length === 0) return []
    const snap = snapshotRegistry()
    const scored = []
    for (const [name, meta] of Object.entries(snap)) {
      const { score, kind } = scoreName(query, name)
      if (score <= 0) continue
      scored.push({
        name,
        meta,
        score,
        matchKind: kind,
      })
    }
    // Also consider env-bound symbols that aren't in the registry (user
    // bindings — defines in the REPL). These bind to functions or values.
    // A Set-based dedupe against the registry names would be ideal; we
    // just check membership.
    if (env && env.vars && typeof env.vars.keys === 'function') {
      for (const name of env.vars.keys()) {
        if (snap[name]) continue
        const { score, kind } = scoreName(query, name)
        if (score <= 0) continue
        scored.push({ name, meta: {}, score, matchKind: kind })
      }
    }
    scored.sort((a, b) => b.score - a.score)
    const top = scored.slice(0, limit)
    return top.map((s) => candidateRecord({
      candidate: s.name,
      kind:      s.meta.perm === 'state-change' || s.meta.perm === 'paint'
                   || s.meta.perm === 'read' ? 'verb' : 'binding',
      arity:     s.meta.arity ?? false,
      doc:       s.meta.doc ?? '',
      score:     Number(s.score.toFixed(3)),
      source:    'registry',
    }))
  }, 'read')

  // (completions/import-suggestions symbol) → list of import candidates.
  //
  // Given a symbol not (yet) in scope, look up which module in the
  // registry exports it and suggest `(import (motoi <module>))`. Handles
  // both core modules (motoi audio, motoi game) and cart-local ones.
  //
  // If the symbol IS in scope, we still return candidates — the caller
  // may want alternates from other modules (e.g. someone imports
  // `(motoi audio)` and asks about `note/strike` — we confirm the source).
  def('completions/import-suggestions', (sym) => {
    const name = String(nm(sym))
    const snap = snapshotRegistry()
    const out = []
    // Direct match: verb exists in the registry (or will after import).
    // Guess the module via the namespace prefix.
    const path = guessImportPath(name)
    if (path) {
      const meta = snap[name]
      out.push([
        [new Sym(':import'),     path],
        [new Sym(':provides'),   new Sym(name)],
        [new Sym(':confidence'), meta ? 0.95 : 0.7],
      ])
    }
    // Fuzzy: also suggest related verbs in the same namespace.
    const slash = name.indexOf('/')
    if (slash > 0) {
      const ns = name.slice(0, slash)
      const related = Object.keys(snap)
        .filter((n) => n.startsWith(ns + '/') && n !== name)
        .slice(0, 3)
      for (const rel of related) {
        const rpath = guessImportPath(rel)
        if (!rpath) continue
        out.push([
          [new Sym(':import'),     rpath],
          [new Sym(':provides'),   new Sym(rel)],
          [new Sym(':confidence'), 0.5],
        ])
      }
    }
    return out
  }, 'read')

  // (completions/next-arg verb args-so-far) → suggested next-arg record.
  //
  // Purely mechanical — reads the verb's :contract and :arity from the
  // registry to guess what shape the next arg wants. Zero LLM cost.
  //
  // Returns: (:suggestion ... :contract-fragment "..." :reason "...")
  //
  // args-so-far is a list of the args already typed (Syms or literals).
  def('completions/next-arg', (verb, argsSoFar) => {
    const name = String(nm(verb))
    const snap = snapshotRegistry()
    const meta = snap[name]
    const argCount = Array.isArray(argsSoFar) ? argsSoFar.length : 0
    if (!meta) {
      return [
        [new Sym(':suggestion'),        false],
        [new Sym(':contract-fragment'), ''],
        [new Sym(':reason'),            `no registry entry for ${name}`],
      ]
    }
    const contract = String(meta.contract || '')
    // Very small contract-parser: split on ' -> ' first, then walk the
    // arg-list side splitting on whitespace + comma.
    const argsSide = contract.split('->')[0].trim().replace(/^\(|\)$/g, '')
    const parts = argsSide.split(/[\s,]+/).filter((p) => p && p !== '.')
    const nextIdx = argCount   // zero-indexed → argCount == "next position"
    const nextType = parts[nextIdx] || parts[parts.length - 1] || ''
    // Guess a reasonable literal per type.
    let suggestion = false
    if (/number|int|float/i.test(nextType)) suggestion = 0.5
    else if (/string/i.test(nextType))      suggestion = ''
    else if (/symbol/i.test(nextType))      suggestion = new Sym('foo')
    else if (/list|plist|record/i.test(nextType)) suggestion = null
    else if (/form/i.test(nextType))        suggestion = null
    else if (/boolean/i.test(nextType))     suggestion = false
    return [
      [new Sym(':suggestion'),        suggestion],
      [new Sym(':contract-fragment'), nextType],
      [new Sym(':reason'),
        contract
          ? `arg #${nextIdx + 1} per contract must be ${nextType || 'unspecified'}`
          : `no contract on ${name}; using arity-fallback`],
    ]
  }, 'read')

  // ── Tier B — LLM-augmented ─────────────────────────────────────────

  // (completions/smart-at-point partial . opts) → list of candidate records.
  //
  // Fires only if opts contain :mode 'llm-first or 'llm-fallback AND either
  // Tier A returned <threshold results OR the mode is llm-first. Sends
  // partial + context + registry snapshot to llm/ask; returns ranked
  // candidates with :source 'llm.
  //
  // If MOTOI_LLM_ENDPOINT is unset (no backend), returns Tier A results
  // as fallback — no throws, no token spend.
  def('completions/smart-at-point', (partial, ...rest) => {
    const opts = kwargsToObj(rest)
    const query = String(nm(partial))
    // Always compute Tier A first so we have a base + can fallback.
    const local = env.get('completions/at-point')(query)
    const mode = opts.mode || currentMode()
    const threshold = Number(opts.threshold ?? 3)
    // Check whether we should fire the LLM.
    const askLLM = env.get('llm/ask')
    if (typeof askLLM !== 'function') return local
    const shouldFire =
      mode === 'llm-first' ||
      (mode === 'llm-fallback' && (local.length < threshold)) ||
      (mode === 'local-then-llm' && (local.length < threshold))
    if (!shouldFire) return local
    // Build a small prompt with the top registry names as context.
    const snap = snapshotRegistry()
    const registryHint = Object.keys(snap).slice(0, 40).join(' ')
    const prompt =
      `Suggest up to 5 Motoi Scheme verb names starting with or fuzzy-matching "${query}". ` +
      `Return one name per line, no prose. Registry sample: ${registryHint}`
    const answer = askLLM(prompt)
    if (answer === false || typeof answer !== 'string') return local
    const suggestions = answer.split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s && /^[a-zA-Z][\w/?!*+-]*$/.test(s))
      .slice(0, 5)
    const llmCandidates = suggestions.map((name, i) => candidateRecord({
      candidate: name,
      kind:      snap[name] ? 'verb' : 'llm-guess',
      arity:     snap[name]?.arity ?? false,
      doc:       snap[name]?.doc ?? '',
      score:     Number((0.9 - i * 0.1).toFixed(2)),
      source:    'llm',
    }))
    // Merge: LLM-first mode leads with LLM; otherwise append.
    if (mode === 'llm-first') return llmCandidates.concat(local)
    return local.concat(llmCandidates)
  }, 'read')

  // (completions/body partial-form . opts) → completed form (string).
  //
  // You wrote (define (fact n) ...) and want the body filled. Wraps
  // llm/complete with a small prompt so the model returns just the
  // completion (no prose preamble).
  //
  // Returns #f gracefully when no backend.
  def('completions/body', (partialForm, ...rest) => {
    const opts = kwargsToObj(rest)
    const complete = env.get('llm/complete')
    if (typeof complete !== 'function') return false
    // Format the form as text if it's a list, else use as-is.
    let asText
    if (typeof partialForm === 'string') asText = partialForm
    else if (partialForm instanceof Sym) asText = partialForm.name
    else if (Array.isArray(partialForm)) {
      // Small Scheme-format so the LLM sees an S-expression, not JSON.
      const fmt = (f) => {
        if (f == null) return '()'
        if (f === true) return '#t'
        if (f === false) return '#f'
        if (typeof f === 'number') return String(f)
        if (typeof f === 'string') return JSON.stringify(f)
        if (f instanceof Sym) return f.name
        if (Array.isArray(f)) return '(' + f.map(fmt).join(' ') + ')'
        return String(f)
      }
      asText = fmt(partialForm)
    } else {
      asText = String(partialForm)
    }
    return complete(asText)
  }, 'read')

  // (completions/mode [mode]) → symbol.
  //
  // With no args → returns the current mode as a Sym.
  // With arg    → sets the in-process mode and returns the previous mode.
  //
  // mode ∈ ('local-only 'local-then-llm 'llm-first). Anything else
  // returns #f without change.
  def('completions/mode', (mode) => {
    if (mode === undefined) return new Sym(currentMode())
    const m = String(nm(mode))
    if (m !== 'local-only' && m !== 'local-then-llm' && m !== 'llm-first') return false
    const prev = currentMode()
    _completionMode = m
    return new Sym(prev)
  }, 'state-change')

  return env
}

export default installCompletions
