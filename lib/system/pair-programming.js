// pair-programming.js — Motoi as pair partner, not just tutor.
//
// Provenance: 2026-07-19 (Marcus, IDE Wave 2). Alfred asked for
// peer-programming features: ambient completions, turn-taking,
// explanation-on-demand, refactor suggestions, bug spotting.
// This file wires the Scheme-level surface; the IDE hooks the
// browser side to F2 / M-e / :explain and shows ghost-text.
//
// Doctrine:
//   * Voice = warm collaborator. "we" not "you should". No lecture.
//   * 11-year-old readable.
//   * No fabrication — every explanation cites the verb registry,
//     doc strings, or reveals a real error message.
//   * `pair-on!` is opt-in. The IDE requests completions only after
//     `pair-on!` was called. Nothing surprises the user.
//   * `motoi drives` mode narrates in the REPL but does NOT modify
//     buffers behind the user's back — every write is proposed as a
//     diff (surfaced via motoi/refactor-suggest).
//
// Verbs exposed on the env:
//   (motoi/pair-on!)                  — enter pair-programming mode
//   (motoi/pair-off!)                 — exit
//   (motoi/pair-mode?)                — 'off | 'user-drives | 'motoi-drives
//   (motoi/pair-set-mode! 'x)         — switch mode
//   (motoi/explain "code" [context])  — explanation string (kid-friendly)
//   (motoi/explain-selection "code")  — alias, used by F2 in the IDE
//   (motoi/refactor-suggest "code")   — alist with :original :suggested :why
//   (motoi/bug-spot "code")           — alist { :ok #t } or { :ok #f :error ...
//                                        :fix ...}
//   (motoi/ambient-complete "prefix" [context]) — ghost-text completions
//   (motoi/pair-narrate! "text")      — Motoi speaks in REPL
//
// Composes with motoi/reading-state — every explanation gets logged so
// the tutor can say "yesterday you were stuck on backprop — want to
// continue there?"

import { Sym } from '../../src/reader.js'
import { snapshotRegistry } from '../../src/verbRegistry.js'

// ── shared state ──────────────────────────────────────────────────────
//
// One box per installer instance; env inspects.
function makeShared() {
  return {
    mode: 'off',              // 'off | 'user-drives | 'motoi-drives
    lastNarration: '',
    completionCount: 0,       // metric for tests
    lastExplanation: null,    // { source, explanation, at }
    lastRefactor: null,       // { original, suggested, why, at }
    lastBugSpot: null,        // { source, ok, error, fix, at }
  }
}

// ── voice fragments ───────────────────────────────────────────────────
//
// Every fragment is short, warm, dry. No walk-back. "we" not "you should".
// The tutor voice is authoritative teacher; the pair voice is a peer
// looking at the same screen.

const PAIR_MODES = ['off', 'user-drives', 'motoi-drives']

function saySwitch(mode) {
  if (mode === 'off') return '[motoi] Pair off. Ping me if you want a second set of eyes.'
  if (mode === 'user-drives') return '[motoi] Pair on. You drive; I ride along and only speak when you ask.'
  if (mode === 'motoi-drives') return "[motoi] I'll drive. Watch the REPL; interject any time."
  return '[motoi] hm.'
}

// ── explanation logic ────────────────────────────────────────────────
//
// Given a snippet, produce a short paragraph. Strategy:
//   1. If it's a single verb call, look up the verb's doc in the
//      registry and paraphrase.
//   2. If it's a lambda / define / let / begin, describe the shape.
//   3. If it's arithmetic, describe the arithmetic.
//   4. Otherwise, honest: "let's try running it and see."
// No LLM call — the LLM adapter (llm.js) is available on the env when
// installed, and future waves can layer it on top; today the surface
// stays deterministic + testable.

function firstToken(src) {
  const m = String(src || '').trim().match(/\(?([a-z0-9?!/*+\-<>=.-]+)/i)
  return m ? m[1] : null
}

function explain(src, opts = {}) {
  const source = String(src || '').trim()
  if (!source) return "[motoi] There's nothing highlighted — select some Scheme first."
  const registry = safeSnapshot()

  const head = firstToken(source)
  const specialForm = new Set(['define', 'lambda', 'let', 'let*', 'letrec',
    'if', 'cond', 'when', 'unless', 'begin', 'quote', 'set!', 'and', 'or',
    'case', 'do'])

  if (head && specialForm.has(head)) {
    return explainSpecial(head, source)
  }
  if (head && registry[head]) {
    const meta = registry[head]
    const doc = (meta.doc || '').trim()
    if (doc) {
      return `[motoi] we're calling ${head} — ${doc.split(/[.\n]/)[0].trim()}.`
    }
    return `[motoi] we're calling ${head}. It's a registered verb, `
      + `namespace ${meta.namespace || 'root'}.`
  }
  if (head && /^[-+.\d]/.test(source)) {
    return `[motoi] arithmetic. Motoi treats numbers as JS numbers, `
      + `so 1e-5 works and (+ 1 2 3) folds left to right.`
  }
  if (head) {
    // Unknown identifier — that IS useful info.
    return `[motoi] ${head} isn't a verb I recognise on this env. `
      + `Try (help) or (motoi/pair-mode?) to check we're wired up.`
  }
  return `[motoi] let's run it and see what happens.`
}

function explainSpecial(head, source) {
  switch (head) {
    case 'define':
      return `[motoi] we're naming a value. Everything after the name is the value expression; `
        + `if it's a (lambda …), we're naming a function.`
    case 'lambda':
      return `[motoi] anonymous function. First list is the parameter names; `
        + `the rest is the body. The last expression's value is what it returns.`
    case 'let':
    case 'let*':
    case 'letrec':
      return `[motoi] local names. The bindings are only visible inside the body — `
        + `they disappear when we leave.`
    case 'if':
      return `[motoi] two-branch pick. Truthy? first branch. Falsy (#f only)? second branch.`
    case 'cond':
      return `[motoi] multi-branch pick. Each clause tests, first truthy wins. `
        + `Use 'else' for the fallback.`
    case 'when':
    case 'unless':
      return `[motoi] one-branch conditional. Runs the body when the test matches.`
    case 'begin':
      return `[motoi] sequence. Every form runs; the last one's value is what we get back.`
    case 'quote':
      return `[motoi] "don't evaluate this — hand me the data as-is." Symbols become themselves; `
        + `lists stay literal.`
    case 'set!':
      return `[motoi] mutation. We're changing an existing binding — the name has to already exist.`
    case 'and':
    case 'or':
      return `[motoi] short-circuit boolean. Stops at the first ${head === 'and' ? 'falsy' : 'truthy'} value.`
    case 'case':
      return `[motoi] like cond, but the key is compared against a list of options per clause.`
    case 'do':
      return `[motoi] a loop. The bindings evolve each iteration; the test decides when we stop.`
  }
  return `[motoi] special form: ${head}.`
}

function refactor(src) {
  const source = String(src || '').trim()
  if (!source) {
    return {
      original: '', suggested: '', why: 'nothing to look at yet.',
    }
  }
  // A tiny rule set of common motoi-idiomatic rewrites. Each rule is a
  // (test, rewrite, why) triple. Deterministic, testable, no LLM.
  const rules = [
    {
      test: /\(if\s+([^)]+)\s+#t\s+#f\)/,
      rewrite: (m) => `(and ${m[1]})`,
      why: '`(if cond #t #f)` is just the truthiness of cond — say what you mean.',
    },
    {
      test: /\(if\s+([^)]+)\s+#f\s+#t\)/,
      rewrite: (m) => `(not ${m[1]})`,
      why: '`(if cond #f #t)` is the negation of cond.',
    },
    {
      test: /\(car\s+\(cdr\s+([^)]+)\)\)/,
      rewrite: (m) => `(cadr ${m[1]})`,
      why: '`cadr` is (car (cdr x)) — the second element.',
    },
    {
      test: /\(car\s+\(cdr\s+\(cdr\s+([^)]+)\)\)\)/,
      rewrite: (m) => `(caddr ${m[1]})`,
      why: '`caddr` is (car (cdr (cdr x))) — the third element.',
    },
    {
      test: /\(vec\/make\s+\(list\s+([^)]+)\)\)/,
      rewrite: (m) => `(vec/make ${m[1]})`,
      why: '`vec/make` is variadic — you can drop the (list …) wrapper.',
    },
    {
      test: /\(geom\/sin\b/,
      rewrite: () => null,
      why: '`math/sin` is the newer name; `geom/sin` still works as an alias.',
    },
    {
      test: /\(geom\/cos\b/,
      rewrite: () => null,
      why: '`math/cos` is the newer name; `geom/cos` still works as an alias.',
    },
  ]
  for (const rule of rules) {
    const m = source.match(rule.test)
    if (m) {
      const suggested = rule.rewrite(m)
      if (suggested == null) {
        // rename-only rules — do a single replacement of the head.
        return {
          original: source,
          suggested: source
            .replace(/geom\/sin\b/, 'math/sin')
            .replace(/geom\/cos\b/, 'math/cos')
            .replace(/geom\/tan\b/, 'math/tan'),
          why: rule.why,
        }
      }
      return {
        original: source,
        suggested: source.replace(rule.test, suggested),
        why: rule.why,
      }
    }
  }
  return {
    original: source,
    suggested: source,
    why: 'looks fine to me. No obvious rewrite.',
  }
}

// ── bug spotting via sub-eval ────────────────────────────────────────
//
// The IDE side calls (motoi/bug-spot "…") on the highlighted region.
// We run the code in a fresh sandbox env so mutations don't leak into
// the user's session, and report what broke.

async function bugSpotSubEval(source, envMaker) {
  const src = String(source || '').trim()
  if (!src) return { ok: true, error: null, fix: null }
  try {
    const env = envMaker()
    const { parse } = await import('../../src/reader.js')
    const { evaluate } = await import('../../src/interp.js')
    const forms = parse(src)
    const fuel = { n: 200000 }
    for (const f of forms) evaluate(f, env, fuel)
    return { ok: true, error: null, fix: null }
  } catch (e) {
    const msg = String(e.message || e)
    return { ok: false, error: msg, fix: proposeFix(msg, src) }
  }
}

function proposeFix(errMsg, source) {
  // Small library of known error shapes we can offer a fix for.
  if (/undefined variable/i.test(errMsg) || /unknown symbol/i.test(errMsg)) {
    const m = errMsg.match(/[`'"]?([\w\-/?!*+.<>=]+)[`'"]?/)
    if (m) return `try (help '${m[1]}) — is it spelled right, or missing an import?`
  }
  if (/not a procedure/i.test(errMsg)) {
    return 'the first item in a list is being called like a function — is a parenthesis in the wrong place?'
  }
  if (/missing \)|missing paren|unexpected EOF/i.test(errMsg)) {
    return 'unbalanced parens — count opens vs closes.'
  }
  if (/NaN/i.test(errMsg)) {
    return 'we got a NaN — a number op saw something non-numeric. drop `(vec/make (…))` around a list if that list is already the vector.'
  }
  if (/wrong number of arguments|arity/i.test(errMsg)) {
    return "check the verb's arity — (help 'name) shows what it expects."
  }
  return null
}

// ── verb registry snapshot cache ──────────────────────────────────────
//
// Cheap; the registry doesn't change during a session.
let _snap = null
function safeSnapshot() {
  if (_snap) return _snap
  try { _snap = snapshotRegistry() } catch { _snap = {} }
  return _snap
}

// ── ambient completions ──────────────────────────────────────────────
//
// Ranked list of completions for a prefix. Cheap, deterministic, no LLM.
// The IDE uses this after 3s of typing pause; we return an alist so the
// ghost-text renderer can pick the first candidate + show alternatives
// in a dropdown.
function ambientComplete(prefix, opts = {}) {
  const p = String(prefix || '').trim()
  if (p.length < 2) return []
  const snap = safeSnapshot()
  const names = Object.keys(snap)
  const hits = names.filter((n) => n.startsWith(p)).slice(0, 8)
  return hits.map((n) => ({
    name: n,
    doc: (snap[n] && snap[n].doc) || '',
  }))
}

// ── verb installer ───────────────────────────────────────────────────

export function installPairProgramming(env, fuel) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })
  const shared = makeShared()

  def('motoi/pair-on!', () => {
    shared.mode = 'user-drives'
    // Log so tutor sees "user turned on pair mode at …".
    tryLog(env, 'pair-on', 'pair mode enabled (user-drives)')
    return saySwitch(shared.mode)
  }, 'state-change')

  def('motoi/pair-off!', () => {
    shared.mode = 'off'
    tryLog(env, 'pair-off', 'pair mode disabled')
    return saySwitch(shared.mode)
  }, 'state-change')

  def('motoi/pair-mode?', () => new Sym(shared.mode))

  def('motoi/pair-set-mode!', (mode) => {
    const m = mode instanceof Sym ? mode.name : String(mode || '')
    if (!PAIR_MODES.includes(m)) return false
    shared.mode = m
    tryLog(env, 'pair-set-mode', m)
    return saySwitch(shared.mode)
  }, 'state-change')

  def('motoi/explain', (src, context) => {
    const s = String(src ?? '')
    const ctx = context instanceof Sym ? context.name : (context == null ? '' : String(context))
    const out = explain(s, { context: ctx })
    shared.lastExplanation = { source: s, explanation: out, at: Date.now(), context: ctx }
    tryLog(env, 'explain', s.slice(0, 200))
    return out
  })

  // Alias — F2 in the IDE calls this on the current selection.
  def('motoi/explain-selection', (src) => {
    const s = String(src ?? '')
    const out = explain(s)
    shared.lastExplanation = { source: s, explanation: out, at: Date.now(), context: 'selection' }
    tryLog(env, 'explain-selection', s.slice(0, 200))
    return out
  })

  def('motoi/refactor-suggest', (src) => {
    const rec = refactor(src)
    shared.lastRefactor = { ...rec, at: Date.now() }
    tryLog(env, 'refactor-suggest', String(src || '').slice(0, 200))
    return [
      [new Sym(':original'),  rec.original],
      [new Sym(':suggested'), rec.suggested],
      [new Sym(':why'),       rec.why],
      [new Sym(':changed?'),  rec.original !== rec.suggested],
    ]
  })

  // Bug spot — sync entry that dispatches to a promise; we resolve
  // synchronously because we've imported at module top.
  def('motoi/bug-spot', (src) => {
    const s = String(src ?? '').trim()
    if (!s) return [
      [new Sym(':ok?'), true], [new Sym(':error'), false], [new Sym(':fix'), false],
    ]
    try {
      // Synchronous re-eval on the caller's env would touch their state.
      // Instead, we sub-eval on a fresh base env — safe, side-effect-free.
      const rec = bugSpotSync(s)
      shared.lastBugSpot = { source: s, ...rec, at: Date.now() }
      return [
        [new Sym(':ok?'), rec.ok],
        [new Sym(':error'), rec.error || false],
        [new Sym(':fix'), rec.fix || false],
      ]
    } catch (e) {
      return [
        [new Sym(':ok?'), false],
        [new Sym(':error'), e.message],
        [new Sym(':fix'), false],
      ]
    }
  })

  def('motoi/ambient-complete', (prefix, context) => {
    const results = ambientComplete(prefix, { context })
    shared.completionCount++
    return results.map((r) => [
      [new Sym(':name'), r.name],
      [new Sym(':doc'),  r.doc],
    ])
  })

  def('motoi/pair-narrate!', (text) => {
    const t = String(text ?? '')
    shared.lastNarration = t
    tryLog(env, 'narrate', t.slice(0, 300))
    return `[motoi] ${t}`
  }, 'state-change')

  // Introspection surface — the IDE polls this to render the pair-panel.
  def('motoi/pair-state', () => ([
    [new Sym(':mode'), new Sym(shared.mode)],
    [new Sym(':last-narration'), shared.lastNarration],
    [new Sym(':completion-count'), shared.completionCount],
    [new Sym(':last-explanation'), shared.lastExplanation ? shared.lastExplanation.explanation : false],
    [new Sym(':last-refactor-why'), shared.lastRefactor ? shared.lastRefactor.why : false],
    [new Sym(':last-bug-spot-ok?'), shared.lastBugSpot ? shared.lastBugSpot.ok : true],
  ]))

  return env
}

// ── sync sub-eval for bug-spot ────────────────────────────────────────
//
// We synchronously import reader/interp — inline require via the module
// system. The import is top-level so this is a no-op at call time.
import { parse as _parseImmediate } from '../../src/reader.js'
import { evaluate as _evalImmediate } from '../../src/interp.js'
import { makeBaseEnv as _baseImmediate } from '../../src/base.js'

function bugSpotSync(src) {
  try {
    const env = _baseImmediate({ n: 200000 })
    const forms = _parseImmediate(src)
    const fuel = { n: 200000 }
    for (const f of forms) _evalImmediate(f, env, fuel)
    return { ok: true, error: null, fix: null }
  } catch (e) {
    const msg = String(e.message || e)
    return { ok: false, error: msg, fix: proposeFix(msg, src) }
  }
}

// ── best-effort session log ──────────────────────────────────────────
//
// If motoi/log-exchange! is installed on the env (reading-state module
// present), route pair events through it so the tutor can reference
// them. Silent-fail otherwise.
function tryLog(env, kind, text) {
  try {
    const fn = env.get('motoi/log-exchange!')
    if (typeof fn === 'function') fn(new Sym(kind), text)
  } catch { /* not installed — that's fine */ }
}

export default installPairProgramming
