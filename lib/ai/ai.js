// ai.js — Layer 2 (L2): Cortex + LLM primitives (INTERFACE ONLY).
//
// Provenance: scheme-lang/src/ai.js. Migrated to
// motoi-scheme/lib/ai/ on 2026-07-16 (Pass-3 Wave 1). Dialect-specific
// references (Sakura runtime, Curator, Lacuna Engineering) generalized
// to "downstream dialects". Provider seam (setAiProvider) unchanged.
//
// The interface Motoi Scheme scripts use to talk to the AI world:
//   · (cortex/remember key value) — write a fact into long-term memory
//   · (cortex/recall key)          — read a fact back out
//   · (cortex/query pattern)       — search memory by pattern
//   · (llm/complete prompt)        — ask an LLM to complete a prompt
//   · (llm/embed text)             — get an embedding vector for text
//
// STUB IMPLEMENTATION (standalone REPL):
//   · Cortex is an in-memory dictionary. Persists for the life of the
//     REPL process; goes away on exit. A downstream dialect plugs in a
//     real persistent Cortex via setAiProvider().
//   · LLM primitives ERROR with a clean message: "no LLM connected —
//     configure :ai-provider in motoi.config.slat." This is honest —
//     we don't pretend to be an LLM when we're not.
//
// The provider seam:
//   Downstream dialects (e.g. Sakura runtime, or any other consumer)
//   call setAiProvider({ cortex: {...}, llm: {...} }) to swap in real
//   impls. Same shape as adapters.js — one record, functions resolve
//   at call time so setAiProvider() takes effect for callers who
//   imported early.
//
// Kid-readable comment: this is the "remember + think" part of the
// language. Save something now, ask about it later. Or ask a big model
// a hard question.

import { Sym } from '../../src/reader.js'

const nm = (x) => (x instanceof Sym ? x.name : x)

// ── the default in-memory Cortex ──────────────────────────────────────
//
// A plain Map. Keyed by string; values can be anything Scheme can hold.
// Good enough for standalone testing; the real Cortex has persistence,
// provenance, similarity search, temporal decay, etc.
function makeInMemoryCortex() {
  const store = new Map()
  return {
    remember(key, value) {
      store.set(String(key), value)
      return true
    },
    recall(key) {
      const k = String(key)
      return store.has(k) ? store.get(k) : undefined
    },
    query(pattern) {
      // Very simple: pattern is either
      //   · a string  — substring match against keys
      //   · a list ('key foo) — exact key lookup (same as recall)
      // Real Cortex uses embeddings + similarity; the stub keeps it
      // honest by only doing what its name says.
      if (typeof pattern === 'string') {
        const hits = []
        for (const [k, v] of store) {
          if (k.includes(pattern)) hits.push([k, v])
        }
        return hits
      }
      if (Array.isArray(pattern) && pattern.length === 2) {
        const key = String(nm(pattern[1]))
        return store.has(key) ? [[key, store.get(key)]] : []
      }
      return []
    },
    forget(key) {
      return store.delete(String(key))
    },
    keys() {
      return Array.from(store.keys())
    },
    size() {
      return store.size
    },
    // Reset for tests. Not exposed to Scheme.
    __reset() {
      store.clear()
    },
  }
}

// ── the default (missing) LLM ─────────────────────────────────────────
//
// Standalone mode has no LLM. Every call errors with the same clean
// message so users know exactly what to do: configure a provider.
function makeMissingLlm() {
  const missing = (verb) => () => {
    throw new Error(
      `(${verb} …) needs an LLM provider. ` +
      `Set :ai-provider in scheme-lang.config.slat, ` +
      `or call setAiProvider({ llm: … }) at startup.`
    )
  }
  return {
    complete: missing('llm/complete'),
    embed:    missing('llm/embed'),
    chat:     missing('llm/chat'),
    tokens:   missing('llm/tokens'),
  }
}

// ── provider state + swap-in ──────────────────────────────────────────

const state = {
  cortex: makeInMemoryCortex(),
  llm:    makeMissingLlm(),
}

/**
 * setAiProvider — swap in real Cortex + LLM implementations. Downstream
 * dialects call this once at startup; every subsequent
 * (cortex/remember …) or (llm/complete …) reaches the real backend.
 *
 * Partial overrides are OK — pass just `{ cortex: … }` and llm stays
 * missing (so paid verbs still error cleanly).
 */
export function setAiProvider(providers) {
  if (!providers) return
  if (providers.cortex) state.cortex = providers.cortex
  if (providers.llm)    state.llm    = providers.llm
}

/**
 * getCortex — used by other layers that need to persist data (auth
 * tokens live in the Cortex — see auth/store.js).
 */
export function getCortex() {
  return state.cortex
}

/**
 * getLlm — used by higher-level verbs that want to route through the
 * configured LLM.
 */
export function getLlm() {
  return state.llm
}

/**
 * __resetAiProvider — test-only seam. Reinstalls the default in-memory
 * Cortex + the missing-LLM stub.
 */
export function __resetAiProvider() {
  state.cortex = makeInMemoryCortex()
  state.llm    = makeMissingLlm()
}

// ── install AI verbs into a Scheme env ────────────────────────────────

export function installAi(env) {
  // Most Cortex verbs are personal-data (they touch operator memory).
  // LLM verbs are network (they hit an external service).
  const def = (n, f, perm) => env.define(n, f, { perm })

  // ── Cortex ─────────────────────────────────────────────────────────

  // (cortex/remember key value) — save a fact. Key is coerced to string;
  // value can be any Scheme value.
  def('cortex/remember', (key, value) => {
    return state.cortex.remember(String(nm(key)), value)
  }, 'personal-data')

  // (cortex/recall key) — read a fact. Returns nil when nothing's stored.
  def('cortex/recall', (key) => {
    return state.cortex.recall(String(nm(key)))
  }, 'personal-data')

  // (cortex/query pattern) — search memory. Returns a list of matches.
  def('cortex/query', (pattern) => {
    // Handle Sym at the top so scripts can (cortex/query 'foo).
    const p = pattern instanceof Sym ? pattern.name : pattern
    return state.cortex.query(p)
  }, 'personal-data')

  // (cortex/forget key) — drop a fact.
  def('cortex/forget', (key) => {
    return state.cortex.forget(String(nm(key)))
  }, 'personal-data')

  // (cortex/keys) — list all remembered keys.
  def('cortex/keys', () => {
    return state.cortex.keys ? state.cortex.keys() : []
  }, 'personal-data')

  // (cortex/size) — how many facts are stored.
  def('cortex/size', () => {
    return state.cortex.size ? state.cortex.size() : 0
  }, 'personal-data')

  // ── LLM ────────────────────────────────────────────────────────────

  // (llm/complete prompt [options]) — ask the configured LLM to complete
  // a prompt. Options is an optional dict (currently a plain list for
  // Scheme-shape reasons); the real provider decides how to use them.
  def('llm/complete', (prompt, options) => {
    return state.llm.complete(String(prompt), options)
  }, 'network')

  // (llm/embed text) — get an embedding vector for text.
  def('llm/embed', (text) => {
    return state.llm.embed(String(text))
  }, 'network')

  // (llm/chat messages [options]) — chat-shaped completion. Messages is
  // a list of (role content) pairs.
  def('llm/chat', (messages, options) => {
    return state.llm.chat(messages, options)
  }, 'network')

  // (llm/tokens text) — count tokens in a piece of text.
  def('llm/tokens', (text) => {
    return state.llm.tokens(String(text))
  }, 'network')

  // ── AI verbs (Motoi's Scheme-facing thinking surface) ─────────────
  //
  // These sit above llm/* and cortex/*. They're what a cart calls when
  // it wants "classify this", "embed this", "summarize this" — without
  // caring which model or store. Each verb routes to state.llm, so
  // when no provider is wired the missing-LLM stub throws a clean
  // "requires provider" error. Alfred: "We can't lie to people." The
  // error IS the honest answer when the sidecar isn't wired.
  //
  // ai/embed is the ONE exception — a deterministic hash-vector
  // fallback is provided so REPL scripts can still get a stable,
  // reproducible vector for testing. The vector is :low-fidelity and
  // the docs say so.

  const sidecar = (verb, hint) => () => {
    throw new Error(
      `(${verb} …) requires-python-ml-sidecar. ` +
      `${hint} ` +
      `Set :ai-provider in scheme-lang.config.slat, ` +
      `or call setAiProvider({ llm: … }) at startup.`
    )
  }

  // Deterministic FNV-1a-flavored 32-dim hash vector. Not an embedding
  // in any semantic sense — a stable per-string fingerprint suitable
  // for tests and REPL demos only. Labeled low-fidelity in the docs.
  const hashVector = (text) => {
    const s = String(text)
    const dims = 32
    const out = new Array(dims).fill(0)
    let h = 2166136261 >>> 0
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i)
      h = Math.imul(h, 16777619) >>> 0
      out[i % dims] = ((out[i % dims] + (h & 0xff)) % 1000) / 1000
    }
    return out
  }

  // (ai/embed text) — return an embedding vector.
  //   Wired: routes through the configured LLM provider.
  //   Standalone fallback: 32-dim deterministic hash vector, :low-fidelity.
  def('ai/embed', (text) => {
    try {
      return state.llm.embed(String(text))
    } catch (_) {
      // No LLM provider — use the hash-vector fallback so REPL scripts
      // and tests don't blow up. Documented as :low-fidelity.
      return hashVector(text)
    }
  }, 'network')

  // (ai/classify text [labels]) — assign a label to text.
  //   Requires an LLM sidecar; graceful error otherwise.
  def('ai/classify', sidecar('ai/classify',
    'Classification requires a running ML sidecar; no local fallback.'), 'network')

  // (ai/generate prompt [options]) — generate text from a prompt.
  //   Requires an LLM sidecar; graceful error otherwise.
  def('ai/generate', sidecar('ai/generate',
    'Text generation requires a running LLM sidecar; no local fallback.'), 'network')

  // (ai/summarize text [options]) — summarize text.
  //   Requires an LLM sidecar; graceful error otherwise.
  def('ai/summarize', sidecar('ai/summarize',
    'Summarization requires a running LLM sidecar; no local fallback.'), 'network')

  // (ai/translate text target-lang [source-lang]) — translate text.
  //   Requires an LLM sidecar; graceful error otherwise.
  def('ai/translate', sidecar('ai/translate',
    'Translation requires a running LLM sidecar; no local fallback.'), 'network')

  // (ai/rank query candidates) — rank candidates by relevance.
  //   Requires an embedding sidecar; graceful error otherwise.
  def('ai/rank', sidecar('ai/rank',
    'Ranking requires an embedding sidecar; no local fallback (order would be arbitrary).'), 'network')

  // (ai/rerank query candidates) — rerank an existing list.
  //   Requires an embedding sidecar; graceful error otherwise.
  def('ai/rerank', sidecar('ai/rerank',
    'Reranking requires a cross-encoder sidecar; no local fallback.'), 'network')

  // (ai/vector-search query [k]) — search a vector index.
  //   Requires a vector store; graceful error otherwise.
  def('ai/vector-search', sidecar('ai/vector-search',
    'Vector search requires an indexed embedding store; no local fallback.'), 'network')

  return env
}

export default installAi
