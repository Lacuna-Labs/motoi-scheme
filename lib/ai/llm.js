// llm.js — Tier 0 LLM-augmented REPL/IDE verb surface.
//
// Provenance: engineering/LLM-AUGMENTED-REPL-1.0.ENG.slat (spec,
// 2026-07-17). This module implements the Tier-0 subset — 13 verbs —
// so the trained model can be taught to USE them.
//
// PERSONA-SCOPED RENAME (2026-07-17, Alfred):
//   The 7 "bare" verbs (what-is, explain, fix, complete, scaffold,
//   pretty-error, rag) are now under the copilot/ namespace so the
//   persona name is visible at the call site — mirrors sakura/ask
//   in the Sakura dialect. Plus a new copilot/ask persona-wrapper
//   verb over llm/ask.
//
//   Bare names → persona-scoped:
//     what-is       → copilot/what-is
//     explain       → copilot/explain
//     fix           → copilot/fix
//     complete      → copilot/complete
//     scaffold      → copilot/scaffold
//     pretty-error  → copilot/pretty-error
//     rag           → copilot/rag
//   NEW: copilot/ask — persona wrapper over llm/ask.
//
//   llm/* primitives (llm/ask, llm/complete, llm/stream, llm/embed,
//   llm/config) STAY as raw model surface.
//
// Verbs installed (13):
//   Primitives (5):    llm/ask, llm/complete, llm/stream, llm/embed, llm/config
//   Persona wrapper (1): copilot/ask
//   Introspection (3): copilot/what-is, copilot/explain, copilot/fix
//   Generative (2):    copilot/complete, copilot/scaffold
//   Meta (2):          copilot/pretty-error, copilot/rag
//
// Backend model (Alfred lock, 2026-07-17):
//   - Reads env vars MOTOI_LLM_ENDPOINT + MOTOI_LLM_MODEL.
//     Optional: MOTOI_LLM_EMBED_ENDPOINT for embeddings (may equal the
//     completion endpoint or be unset).
//   - If unset, every LLM verb returns #f (except llm/config, which
//     returns (("backend" . "none"))). NO throws — programs check and
//     degrade.
//   - When set, POSTs JSON to the endpoint using an OpenAI-compatible
//     shape: { model, messages: [{role:"user", content:prompt}],
//              temperature, max_tokens }. Response is expected as
//     { choices: [{ message: { content: "..." } }] } — llama.cpp,
//     ollama, vllm all offer this.
//   - Embedding response: { data: [{ embedding: [f, ...] }] }.
//
// Hermetic doctrine: no external SDK dep. Node's built-in fetch does
// the POST.
//
// Installer runs LAST (installer #40) after cortex-io + composer so it
// OVERRIDES the older llm/complete + llm/embed stubs in lib/ai/ai.js
// with the environment-configurable versions.

import { Sym } from '../../src/reader.js'
import { getVerbMeta, snapshotRegistry } from '../../src/verbRegistry.js'
import { apply as schemeApply, Closure } from '../../src/interp.js'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { filterOutput, filterAlistAnswer } from '../security/output-filter.js'
import { safePath } from '../security/path-guard.js'

// ── helpers ─────────────────────────────────────────────────────────

// Unwrap a Sym to its string name, otherwise passthrough.
const nm = (x) => (x instanceof Sym ? x.name : x)

// Recursively unwrap Syms in nested structures so args pass cleanly
// into JS-land. Mirrors cortex-io.js's norm() helper.
function norm(v) {
  if (v instanceof Sym) return v.name
  if (Array.isArray(v)) return v.map(norm)
  if (v && typeof v === 'object') {
    const out = {}
    for (const k of Object.keys(v)) out[k] = norm(v[k])
    return out
  }
  return v
}

// Format a JS value as a Scheme-ish string. Used when the LLM prompt
// wants to include an S-expression form.
function schemeFormat(f) {
  if (f == null) return '()'
  if (f === true) return '#t'
  if (f === false) return '#f'
  if (typeof f === 'number') return String(f)
  if (typeof f === 'string') return JSON.stringify(f)
  if (f instanceof Sym) return f.name
  if (Array.isArray(f)) return '(' + f.map(schemeFormat).join(' ') + ')'
  return String(f)
}

// Parse keyword-plist args: (:key val :key val) → { key: val, … }.
// Keys are Syms whose name starts with ':'. Unwraps Syms in values.
function kwargsToObj(args) {
  const out = {}
  for (let i = 0; i + 1 < args.length; i += 2) {
    const kRaw = args[i]
    const kName = kRaw instanceof Sym ? kRaw.name : String(kRaw)
    if (!kName.startsWith(':')) continue
    out[kName.slice(1)] = norm(args[i + 1])
  }
  return out
}

// Read env vars fresh on each call — tests spin up temporary servers
// and mutate process.env; a cached-at-load config would miss the change.
function currentConfig() {
  const endpoint = process.env.MOTOI_LLM_ENDPOINT || null
  const model = process.env.MOTOI_LLM_MODEL || null
  const embedEndpoint = process.env.MOTOI_LLM_EMBED_ENDPOINT || endpoint || null
  return {
    endpoint,
    model,
    embedEndpoint,
    // "connected" means we have BOTH an endpoint AND a model — either
    // missing = no backend.
    connected: Boolean(endpoint && model),
  }
}

// Build an alist (list of (key . value) pairs) that Scheme code can
// destructure. Uses interned Syms (from reader.js) so equality checks
// against ':backend' etc. line up.
function configAsAlist() {
  const c = currentConfig()
  if (!c.connected) return [[new Sym(':backend'), 'none']]
  return [
    [new Sym(':backend'),        'http'],
    [new Sym(':endpoint'),       c.endpoint],
    [new Sym(':model'),          c.model],
    [new Sym(':embed-endpoint'), c.embedEndpoint],
  ]
}

// Motoi Scheme's evaluator is synchronous — every verb must return a
// value, not a promise. To keep LLM verbs synchronous while making
// real HTTP calls, we shell out to curl via execFileSync. curl is
// universally available on macOS + Linux CI runners; when not, the
// call returns #f and the caller degrades gracefully.
//
// Note: fetch() would be cleaner but is async-only. Wrapping fetch in
// a sync-wait via Atomics/SharedArrayBuffer requires --experimental
// flags. The curl shell-out has no such dependency.

function syncHttpJson(url, bodyObj, opts = {}) {
  if (typeof url !== 'string' || !url) return null
  // Build a curl command that POSTs JSON. --max-time defends against
  // slow endpoints. --silent so we only see the body. --fail-with-body
  // returns non-zero on 4xx/5xx but still gives us the body.
  const bodyStr = JSON.stringify(bodyObj)
  const args = [
    '-s',
    '--max-time', String(opts.timeout ?? 30),
    '-H', 'content-type: application/json',
    '-X', 'POST',
    '--data-binary', '@-',
    url,
  ]
  try {
    const out = execFileSync('curl', args, {
      input: bodyStr,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 32 * 1024 * 1024,
    })
    if (!out) return null
    try { return JSON.parse(out) } catch { return null }
  } catch {
    return null
  }
}

function llmCompleteSync(prompt, opts = {}) {
  const c = currentConfig()
  if (!c.connected) return false
  const body = {
    model: c.model,
    messages: [{ role: 'user', content: String(prompt) }],
  }
  if (opts.system) body.messages.unshift({ role: 'system', content: String(opts.system) })
  if (opts['max-tokens'] != null) body.max_tokens = Number(opts['max-tokens'])
  if (opts.temperature != null) body.temperature = Number(opts.temperature)
  if (opts.stop != null) body.stop = opts.stop
  const data = syncHttpJson(c.endpoint, body)
  if (!data) return false
  const choice = data?.choices?.[0]
  if (!choice) return false
  return choice.message?.content ?? choice.text ?? false
}

function llmEmbedSync(text) {
  const c = currentConfig()
  if (!c.embedEndpoint || !c.model) return false
  const body = { model: c.model, input: String(text) }
  const data = syncHttpJson(c.embedEndpoint, body)
  if (!data) return false
  const emb = data?.data?.[0]?.embedding
  if (Array.isArray(emb)) return emb
  if (Array.isArray(data?.embedding)) return data.embedding
  return false
}

// ── verbs ───────────────────────────────────────────────────────────

// Re-exports so consumers (Sakura's persona.js, tests) can reuse the
// low-level primitives and the copilot filter without cloning them.
export {
  llmCompleteSync,
  llmEmbedSync,
  syncHttpJson,
  currentConfig,
  configAsAlist,
  kwargsToObj,
  schemeFormat,
  nm,
}

export function installLLM(env, fuel) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  // Fuel box shared with the installed evaluator so callback invocations
  // in llm/stream deduct from the caller's budget. Falls back to a
  // fresh box if the installer wasn't handed one.
  const fuelBox = typeof fuel === 'number' ? { n: fuel } : (fuel || { n: 1_000_000 })

  // Small helper: call a Scheme callback (Closure) or a JS function with
  // one arg. Returns whatever it returned; swallows nothing.
  const callCallback = (cb, arg) => {
    if (typeof cb === 'function') return cb(arg)
    if (cb instanceof Closure) return schemeApply(cb, [arg], fuelBox)
    return undefined
  }

  // Track the last error a Scheme call raised so (fix) with no args can
  // read it. Motoi's evaluator doesn't yet expose last-error; we shim
  // by exposing (last-error) here.
  const lastError = { value: null }

  // ── Primitives ─────────────────────────────────────────────────────

  // (llm/ask prompt . opts) → string or #f.
  // opts is a keyword-plist: :system :temperature :max-tokens.
  def('llm/ask', (prompt, ...rest) => {
    const opts = kwargsToObj(rest)
    return llmCompleteSync(String(nm(prompt)), opts)
  }, 'read')

  // (llm/complete partial . opts) → string or #f.
  // Same wire protocol as llm/ask — completion vs chat is a prompt
  // convention. We prefix a mild instruction so most servers give raw
  // continuation rather than chatty preamble.
  def('llm/complete', (partial, ...rest) => {
    const opts = kwargsToObj(rest)
    const prompt = 'Continue this text or code directly, no preamble:\n' + String(nm(partial))
    return llmCompleteSync(prompt, opts)
  }, 'read')

  // (llm/stream prompt callback . opts) → boolean.
  // True-streaming needs SSE; for Tier 0 we CALL the callback once with
  // the full response and once with #!eof, so callback code doesn't
  // change shape when true streaming lands. Returns #t on success, #f
  // otherwise.
  def('llm/stream', (prompt, callback, ...rest) => {
    const opts = kwargsToObj(rest)
    const result = llmCompleteSync(String(nm(prompt)), opts)
    if (result === false) return false
    // callback can be either a JS function (JS-registered verb) OR a
    // Scheme Closure (user lambda). callCallback dispatches on kind.
    if (typeof callback !== 'function' && !(callback instanceof Closure)) return false
    try {
      callCallback(callback, result)
      callCallback(callback, new Sym('#!eof'))
      return true
    } catch {
      return false
    }
  }, 'read')

  // (llm/embed text . opts) → vector (JS array) or #f.
  def('llm/embed', (text, ...rest) => {
    return llmEmbedSync(String(nm(text)))
  }, 'read')

  // (llm/config) → alist. Never returns the API key (there isn't one in
  // this backend model — the endpoint URL is the only credential surface).
  def('llm/config', () => configAsAlist(), 'read')

  // ── Persona wrapper ────────────────────────────────────────────────

  // (copilot/ask prompt . opts) → string or #f.
  // Persona-scoped wrapper over llm/ask. Prepends a system prompt with
  //   (a) Motoi Copilot persona (fun coder, terse, no world knowledge
  //       outside the language, technical but warm)
  //   (b) A registry snapshot for symbols mentioned in the prompt
  //   (c) An in-scope-verb hint appended to the response
  // Same wire protocol, same graceful-degrade to #f when no backend.
  //
  // Mirrors sakura/ask on the Sakura side; the persona name is visible
  // at the call site so cart authors reading a Scheme program can tell
  // WHICH persona is being asked.
  const MOTOI_COPILOT_PERSONA =
    'You are Motoi Copilot — a fun, terse coder inside the Motoi Scheme ' +
    'language. You know the language and its verb registry cold. You ' +
    'have no world knowledge outside the language. Warm but technical; ' +
    'keep answers short. When you cite a verb, use its exact registered ' +
    'name.'

  def('copilot/ask', (prompt, ...rest) => {
    const opts = kwargsToObj(rest)
    const promptStr = String(nm(prompt))
    // Registry snapshot for symbols we can spot in the prompt.
    const snap = snapshotRegistry()
    const mentioned = []
    // Longest names first so `copilot/what-is` matches before `what-is`;
    // otherwise a bare-name match inside a namespaced name would win.
    const registeredNames = Object.keys(snap).sort((a, b) => b.length - a.length)
    for (const name of registeredNames) {
      if (name.length < 2) continue
      const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      // Match with word-boundary characters Scheme identifiers actually
      // sit between: whitespace, parens, quote, comma, punctuation.
      const re = new RegExp(`(?:^|[\\s('"\`,])${esc}(?:$|[\\s)'"\`,?!.:])`)
      if (re.test(promptStr)) mentioned.push(name)
      if (mentioned.length >= 12) break
    }
    const contextLines = mentioned.length > 0
      ? '\n\nRegistry context (verbs the user mentioned):\n' +
        mentioned.map((n) => {
          const m = snap[n]
          const doc = m?.doc ? ` — ${m.doc}` : ''
          const contract = m?.contract ? ` :: ${m.contract}` : ''
          return `  ${n}${contract}${doc}`
        }).join('\n')
      : ''
    const system = MOTOI_COPILOT_PERSONA + contextLines
    // Merge system: persona always wins as base voice; user-provided
    // :system appended after.
    const mergedOpts = { ...opts }
    mergedOpts.system = opts.system
      ? `${system}\n\n${opts.system}`
      : system
    const answer = llmCompleteSync(promptStr, mergedOpts)
    if (answer === false) return false
    // Append an in-scope-verb hint so the surface can render "you can
    // try: <verb1> <verb2>" without extra plumbing.
    const composed = mentioned.length > 0
      ? `${String(answer)}\n\n(in scope: ${mentioned.slice(0, 6).join(', ')})`
      : String(answer)
    // Sandbox: any non-Scheme drift is hard-refused (shell) or wrapped
    // with a warning (python/js/ruby). See lib/security/output-filter.js.
    return filterOutput(composed, { verb: 'copilot/ask' })
  }, 'read')

  // ── Introspection-augmented (copilot/*) ────────────────────────────

  // (copilot/what-is sym) → record (alist) with :registry-hit :reference-hit
  // :llm-hit :confidence.
  //
  // registry-hit: verb metadata if registered.
  // reference-hit: the doc / contract / examples fields from the same
  //   registry entry (the reference manual populates these when it lands).
  // llm-hit: the LLM's guess when nothing else matches (or #f if no
  //   backend / no match).
  // confidence: 'certain if registry hit, 'likely if reference-only,
  //   'guess if LLM-only, 'unknown otherwise.
  def('copilot/what-is', (sym) => {
    const name = String(nm(sym))
    const meta = getVerbMeta(name)
    const registryHit = meta ? {
      name: meta.name || name,
      perm: meta.perm,
      arity: meta.arity,
      contract: meta.contract,
    } : false
    const referenceHit = meta && (meta.doc || meta.contract || (meta.examples && meta.examples.length > 0)) ? {
      doc: meta.doc,
      contract: meta.contract,
      examples: meta.examples,
    } : false
    // Only fall through to the LLM if we don't already have solid data.
    let llmHit = false
    if (!referenceHit) {
      const guess = llmCompleteSync(
        `In the Motoi Scheme language, what is the verb or symbol '${name}'? ` +
        'Reply in one sentence.',
        { 'max-tokens': 100 })
      if (guess) llmHit = String(guess).trim()
    }
    let confidence = 'unknown'
    if (registryHit && referenceHit) confidence = 'certain'
    else if (registryHit) confidence = 'likely'
    else if (llmHit) confidence = 'guess'
    // Filter the :llm-hit slot — the model might have drifted; :registry-hit
    // and :reference-hit are structured data and pass through unchanged.
    return filterAlistAnswer([
      [new Sym(':registry-hit'),  registryHit],
      [new Sym(':reference-hit'), referenceHit],
      [new Sym(':llm-hit'),       llmHit],
      [new Sym(':confidence'),    new Sym(confidence)],
    ], { verb: 'copilot/what-is' })
  }, 'read')

  // (copilot/explain x) → string. Grounded: reads verb docs for symbols in x
  // and includes them as context.
  def('copilot/explain', (x) => {
    const collected = []
    const walk = (v) => {
      if (v instanceof Sym) {
        const meta = getVerbMeta(v.name)
        if (meta && meta.doc) collected.push(`${v.name}: ${meta.doc}`)
      } else if (Array.isArray(v)) {
        for (const c of v) walk(c)
      }
    }
    walk(x)
    const context = collected.length > 0
      ? '\n\nKnown verb docs:\n' + collected.join('\n')
      : ''
    const prompt = `Explain what this Scheme value/form does in plain language:\n${schemeFormat(x)}${context}`
    const out = llmCompleteSync(prompt, { 'max-tokens': 300 })
    // Graceful degrade: if no LLM, at least return the collected docs.
    if (out === false) {
      if (collected.length > 0) return 'No LLM configured; known docs:\n' + collected.join('\n')
      return false
    }
    return filterOutput(String(out), { verb: 'copilot/explain' })
  }, 'read')

  // (copilot/fix error-or-form) → form or #f. LLM suggests a repair.
  def('copilot/fix', (errorOrForm) => {
    const v = errorOrForm === undefined ? lastError.value : errorOrForm
    if (v == null) return false
    const asText = typeof v === 'string' ? v : schemeFormat(v)
    const prompt = 'This Motoi Scheme code or error needs repair. ' +
      'Return ONLY the corrected S-expression, no prose:\n' + asText
    const out = llmCompleteSync(prompt, { 'max-tokens': 400 })
    if (out === false) return false
    return filterOutput(String(out).trim(), { verb: 'copilot/fix' })
  }, 'read')

  // ── Generative (copilot/*) ─────────────────────────────────────────

  // (copilot/complete partial-with-#!hole) → form or #f. LLM fills the hole.
  def('copilot/complete', (partial) => {
    const asText = schemeFormat(partial)
    if (!asText.includes('#!hole')) {
      // No hole — behave like llm/complete.
      const out = llmCompleteSync(asText, { 'max-tokens': 200 })
      return out === false ? false : filterOutput(String(out).trim(), { verb: 'copilot/complete' })
    }
    const prompt = 'Fill the #!hole placeholder(s) in this Scheme form. ' +
      'Return ONLY the filled S-expression, no prose:\n' + asText
    const out = llmCompleteSync(prompt, { 'max-tokens': 200 })
    if (out === false) return false
    return filterOutput(String(out).trim(), { verb: 'copilot/complete' })
  }, 'read')

  // (copilot/scaffold kind . opts) → path. Writes a stub to disk, returns the
  // absolute path. Perm state-change (only write-verb in Tier 0).
  //
  // Options: :name :purpose :dir. If :dir omitted, writes under
  // scratch/scaffold/ under cwd (or tmpdir if cwd not writable).
  def('copilot/scaffold', (kind, ...rest) => {
    const opts = kwargsToObj(rest)
    const k = String(nm(kind))
    const name = opts.name ? String(nm(opts.name)) : `unnamed-${k}`
    const purpose = opts.purpose ? String(opts.purpose) : ''
    // Sanitize name for filename use.
    const safeName = name.replace(/[^a-zA-Z0-9_./-]/g, '_')
    // Pick a directory: explicit :dir wins, else scratch/scaffold under cwd.
    // Sandbox: caller-supplied :dir MUST land under cwd() or ~/.motoi/;
    // anything else falls back to the default scratch/scaffold path.
    let dir
    if (opts.dir) {
      const proposed = safePath(String(opts.dir), {
        verb: 'copilot/scaffold',
        softFail: true,
      })
      if (proposed) dir = proposed
      else dir = join(process.cwd(), 'scratch', 'scaffold')
    } else {
      const cwd = process.cwd()
      dir = join(cwd, 'scratch', 'scaffold')
    }
    // Ensure directory exists; on failure, fall back to tmpdir.
    try {
      mkdirSync(dir, { recursive: true })
    } catch {
      dir = join(tmpdir(), 'motoi-scaffold')
      try { mkdirSync(dir, { recursive: true }) } catch { /* soft */ }
    }
    // Pick an extension per kind.
    const ext = k === 'test' ? '.test.js' : '.slat'
    // Replace slashes in safeName with dashes so we don't create nested
    // directories accidentally.
    const filename = safeName.replace(/\//g, '-') + ext
    const path = resolve(join(dir, filename))
    // Build the stub content. For 'verb' and 'cart' we author a small
    // SLAT record; for 'test' a Node test skeleton; else a plain header.
    let content
    switch (k) {
      case 'verb':
        content = `(verb\n  :name ${name}\n  :purpose ${JSON.stringify(purpose)}\n  :arity 1\n  :contract "(any) -> any"\n  :body (lambda (x) x))\n`
        break
      case 'cart':
        content = `(cart\n  :name ${name}\n  :purpose ${JSON.stringify(purpose)}\n  :body (lambda () (display "hello from ${name}") (newline)))\n`
        break
      case 'test':
        content = `import { test } from 'node:test'\nimport assert from 'node:assert/strict'\n\n// ${purpose || name}\ntest('${name}', () => {\n  assert.ok(true, 'stub')\n})\n`
        break
      case 'module':
        content = `(module ${name}\n  :purpose ${JSON.stringify(purpose)}\n  :exports ()\n  :body ())\n`
        break
      case 'chapter':
        content = `(chapter\n  :name ${name}\n  :purpose ${JSON.stringify(purpose)}\n  :sections ())\n`
        break
      case 'appendix':
        content = `(appendix\n  :name ${name}\n  :purpose ${JSON.stringify(purpose)}\n  :sections ())\n`
        break
      default:
        content = `(scaffold\n  :kind ${k}\n  :name ${name}\n  :purpose ${JSON.stringify(purpose)})\n`
    }
    try {
      writeFileSync(path, content, 'utf8')
      return path
    } catch (e) {
      return false
    }
  }, 'state-change')

  // ── Meta (copilot/*) ───────────────────────────────────────────────

  // (copilot/pretty-error error-record) → string. LLM rewrites a cryptic error.
  // With no LLM: returns a hand-shaped fallback so surfaces still get
  // something readable.
  def('copilot/pretty-error', (err) => {
    const asText = schemeFormat(err)
    const prompt = 'Rewrite this Motoi Scheme error in one clear paragraph ' +
      'a beginner can act on:\n' + asText
    const out = llmCompleteSync(prompt, { 'max-tokens': 200 })
    if (out === false) {
      // Fallback: extract :message if present in an alist.
      if (Array.isArray(err)) {
        for (const pair of err) {
          if (Array.isArray(pair) && pair.length === 2 && pair[0] instanceof Sym) {
            if (pair[0].name === ':message' || pair[0].name === 'message') {
              return String(pair[1])
            }
          }
        }
      }
      if (err && typeof err === 'object' && err.message) return String(err.message)
      return asText
    }
    return filterOutput(String(out), { verb: 'copilot/pretty-error' })
  }, 'read')

  // (copilot/rag question) → record with :answer :sources.
  // Retrieval-augmented: embeds the question, searches the verb
  // registry (docs field) for the highest cosine-similarity matches
  // (or when no embeddings, keyword substring match), hands top matches
  // plus the question to the LLM.
  def('copilot/rag', (question) => {
    const q = String(nm(question))
    // Retrieval step — search registry for verbs whose doc or contract
    // mention any keyword from the question. Keyword-based fallback so
    // rag works even when the embedding backend is missing.
    const snap = snapshotRegistry()
    const words = q.toLowerCase().split(/\s+/).filter((w) => w.length >= 3)
    const scored = []
    for (const [name, meta] of Object.entries(snap)) {
      const doc = (meta.doc || '').toLowerCase()
      const contract = (meta.contract || '').toLowerCase()
      let score = 0
      // Direct name hit is worth a lot.
      const lname = name.toLowerCase()
      if (words.some((w) => lname.includes(w))) score += 3
      for (const w of words) {
        if (doc.includes(w)) score += 1
        if (contract.includes(w)) score += 0.5
      }
      if (score > 0) scored.push({ name, meta, score })
    }
    scored.sort((a, b) => b.score - a.score)
    const top = scored.slice(0, 5)
    const sources = top.map((s) => [
      [new Sym(':name'),     s.name],
      [new Sym(':doc'),      s.meta.doc || ''],
      [new Sym(':contract'), s.meta.contract || ''],
      [new Sym(':score'),    s.score],
    ])
    // Compose prompt with retrieved context.
    const context = top.length > 0
      ? top.map((s) => `${s.name}: ${s.meta.doc || '(no doc)'}`).join('\n')
      : '(no verbs matched)'
    const prompt = `Answer this question about Motoi Scheme, grounded in the retrieved verb docs.
Question: ${q}
Retrieved verbs:
${context}

Answer:`
    const answer = llmCompleteSync(prompt, { 'max-tokens': 400 })
    // Filter the :answer slot; :sources are structured metadata (verb
    // names + docs from the registry) — no model text there to sanitize.
    return filterAlistAnswer([
      [new Sym(':answer'),  answer === false ? false : String(answer)],
      [new Sym(':sources'), sources],
    ], { verb: 'copilot/rag' })
  }, 'read')

  // Expose (last-error) so (fix) with no arg has something to read.
  // Very small hook — the REPL should set lastError.value on catch.
  def('last-error', () => lastError.value, 'read')

  // Return a handle so REPL / tests can push into lastError.
  env.__llmLastError = lastError

  return env
}

export default installLLM
