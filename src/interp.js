// The evaluator — a tiny, capability-bounded Scheme.
//
// Capability security by construction: the interpreter has NO ambient
// authority. It can only touch what's been `define`d into the environment
// handed to it (numbers, lists, and whichever primitives we inject). There
// is no host `eval`, no file/network access, no `window`. A `fuel` budget
// caps total evaluation steps so a runaway program is killed, not hung.
//
// TAIL-CALL ELIMINATION (TCO).
//
// `evaluate()` is the entry point — an outer trampoline that drives
// `evalStep()` and unwraps `Tail` / `TailCall` sentinels until a real
// value lands. `evalStep()` is the body of the evaluator: every
// tail-position form returns a sentinel instead of recursing on the JS
// stack, so a deep `(loop n …)` is bounded only by `fuel`, not by the
// JS engine's stack depth.
//
// Tail positions handled:
//   • `if`     — both consequent and alternate (NOT the test)
//   • `begin`  — the last form (earlier forms still recurse, by design)
//   • `when`   — the last form of the body
//   • `unless` — the last form of the body
//   • `cond`   — the last form of the chosen clause's body
//   • `case`   — the last form of the chosen clause's body
//   • `let`    — the last form of the body (incl. named-let recursion)
//   • `let*`   — the last form of the body
//   • `letrec` — the last form of the body
//   • `and`    — the last conjunct (returned as a thunk)
//   • `or`     — the last disjunct
//   • function application — the call itself, bouncing through TailCall
//
// NOT tail positions (intentional — they evaluate inline):
//   • the test of `if` / `cond` / `case`
//   • all but the last form of any sequence
//   • operands to function calls (their order/side-effects matter)
//   • initialiser expressions of `let` / `let*` / `letrec`

import { Sym, Pair } from './reader.js'
import { registerVerbMeta, defaultMetaFor } from './verbRegistry.js'
import { Values, RaisedValue } from '../lib/base/r7rs-types.js'

// v2.20.0-A5 — track which verb names have already emitted a
// missing-perm warning, so a hot-mounted installer (test setup re-runs
// `installCardVerbs` per test) doesn't drown the console with the same
// name. The Set is process-global; the audit's test seam clears it.
const MISSING_PERM_WARNED = new Set()
export function __resetMissingPermWarnings() { MISSING_PERM_WARNED.clear() }

// ── stack hooks (2026-07-19, Marcus TUI wave) ─────────────────────────
//
// A ledger module (lib/system/stack.js) can attach {push, pop} hooks so
// panels can present a live call stack without reaching into evaluator
// internals. Additive: when no hooks are attached, applyStep is exactly
// what it was. The hooks fire only around Closure application, which is
// where user-visible Scheme frames live; JS primitives are hidden — the
// intent is to show the *reader's* call stack, not the evaluator's.
//
// setStackHooks({ push(name, kind), pop() })  → replaces both hooks
// clearStackHooks()                            → back to no-ops
let _STACK_PUSH = null
let _STACK_POP  = null
export function setStackHooks({ push, pop } = {}) {
  _STACK_PUSH = typeof push === 'function' ? push : null
  _STACK_POP  = typeof pop  === 'function' ? pop  : null
}
export function clearStackHooks() { _STACK_PUSH = null; _STACK_POP = null }

// Verb-call counter hook (2026-07-22). Alfred asked for a trillion-scale
// per-verb call counter on 2026-07-14 (task #749); this is the runtime seam
// that lib/system/verb-stats.js hangs its BigInt Map off. No-op when the
// module isn't installed. The hook fires ONCE per primitive dispatch.
let _COUNT_HOOK = null
export function setCountHook(fn) { _COUNT_HOOK = typeof fn === 'function' ? fn : null }
export function clearCountHook() { _COUNT_HOOK = null }

// Error-census hook (2026-07-27). The mirror of the count hook: where the
// count hook counts what RAN, this notes what BROKE. lib/system/verb-stats.js
// hangs its error-key ledger off this seam. Fired at the run/eval/REPL
// boundary (see noteError) for every error that ESCAPES a program — i.e. an
// unhandled failure, not one a Scheme `guard` caught and handled. No-op when
// the module isn't installed. Doctrine: this is the "wrong sink" — it exists
// to count and eliminate wrongs, not to rank rights. weights ≠ facts.
let _ERROR_HOOK = null
export function setErrorHook(fn) { _ERROR_HOOK = typeof fn === 'function' ? fn : null }
export function clearErrorHook() { _ERROR_HOOK = null }
// Record an error via the hook, then return it so callers can `throw noteError(err)`.
// Never throws itself — telemetry must not break the failure it is recording.
export function noteError(err) {
  if (_ERROR_HOOK) { try { _ERROR_HOOK(err) } catch { /* never break on telemetry */ } }
  return err
}

export class Env {
  constructor(parent = null) {
    this.vars = new Map()
    this.parent = parent
    // Substrate-freeze marker (set by `freeze()`). When set, attempts to
    // redefine OR set! any name that was already bound at freeze-time
    // throw — protecting the built-in verb roster from override by user
    // code, post-init env.define attacks, or Scheme `(define + name …)`
    // overlaying a primitive.
    //
    // Two-arg legacy callers (every installer) still work pre-freeze.
    // Post-freeze, only NEW names can be defined — the bricklay cart
    // adds `BRICKLAY-MARGIN`, user lambdas, etc. — but `(define car …)`
    // or `env.define('eval', …)` throw.
    this._frozen = false
    this._frozenNames = null
  }
  get(name) {
    if (this.vars.has(name)) return this.vars.get(name)
    if (this.parent) return this.parent.get(name)
    throw new Error('unbound symbol: ' + name)
  }
  set(name, val) {
    if (this.vars.has(name)) {
      // Substrate names are read-only post-freeze. set! on a frozen
      // binding throws — the protective wall §1.2 condition 1 of
      // SECURITY-AUDIT.md asked for.
      if (this._frozen && this._frozenNames && this._frozenNames.has(name)) {
        throw new Error('frozen sandbox: cannot set! substrate binding: ' + name)
      }
      this.vars.set(name, val); return
    }
    if (this.parent) { this.parent.set(name, val); return }
    throw new Error('set! on unbound symbol: ' + name)
  }
  /**
   * define(name, val, meta?)
   *
   * Item 8 of the security burn-down (2026-06-07). The third arg
   * carries verb metadata — `{ perm, confirm, rateLimit, schema,
   * idempotent }` — which the dispatcher (runtime/dispatch.js) reads
   * to gate each verb call. Backwards compatible: existing two-arg
   * calls still work; the meta is inferred from the name (paint-* →
   * `perm: 'paint'`, otherwise `perm: 'read'`). Verbs that name-pattern
   * as state-changing or stronger MUST declare `perm` explicitly —
   * `validateRegistry()` at app startup fails fast on any omission.
   *
   * The meta lives in a sibling registry keyed by verb name (not on
   * the function itself) so verb implementations stay pure JS — the
   * dispatcher walks the AST + reads the registry directly.
   *
   * Post-freeze behaviour (v2.20.0-B2 / HelloSurfaceFix): defining a
   * NEW name still works (so the bricklay cart, named-lets, and user
   * lambdas keep working), but redefining a substrate name throws —
   * the freeze blocks the `env.define('eval', …)` override path
   * SECURITY-AUDIT.md §1.2 condition 1 flagged.
   */
  define(name, val, meta) {
    if (this._frozen && this._frozenNames && this._frozenNames.has(name)) {
      throw new Error('frozen sandbox: cannot redefine substrate binding: ' + name)
    }
    this.vars.set(name, val)
    // Only treat function bindings as verbs — closures / data are
    // language values, not dispatcher-gated calls.
    if (typeof val === 'function') {
      // Stack-panel hook (2026-07-19). Tag the fn with its verb name so
      // applyStep can push a labeled frame. Best-effort — some primitives
      // are exotic and reject assignment; ignore.
      try { if (!val.__verbName) val.__verbName = name } catch { /* frozen fn */ }
      // perm-audit floor: the first time a verb registers without an
      // explicit `meta.perm`, `defaultMetaFor` infers one from the name.
      // This is a dev-only nicety and is SILENT by default — a plain
      // user-level `(define name fn)` should never print engine chatter,
      // and it must never leak downstream-consumer docs into base Motoi.
      // Opt in with MOTOI_PERM_AUDIT=1 when you actually want the report.
      const permAuditOn =
        typeof process !== 'undefined' && process.env && process.env.MOTOI_PERM_AUDIT
      if (permAuditOn && (!meta || meta.perm == null) && !MISSING_PERM_WARNED.has(name)) {
        MISSING_PERM_WARNED.add(name)
        try {
          if (typeof console !== 'undefined' && typeof console.warn === 'function') {
            console.warn(
              `[verbRegistry] '${name}' registered without an explicit perm — ` +
              `inferring one from the name.`,
            )
          }
        } catch { /* never break on a log call */ }
      }
      const resolved = meta || defaultMetaFor(name)
      registerVerbMeta(name, resolved)
    }
  }

  /**
   * freeze() — lock the substrate (v2.20.0-B2 / HelloSurfaceFix).
   *
   * Captures every name bound on THIS env at freeze-time as the
   * substrate roster; subsequent `define` / `set` on those names throws.
   * Then `Object.freeze(this)` so the env instance can't gain new
   * direct properties from outside (env.foo = 'bar' fails in strict).
   *
   * The Map at `this.vars` is NOT made structurally immutable — that
   * would break the bricklay cart's `(define BRICKLAY-MARGIN …)` path
   * which extends the root env. We instead enforce *binding-level*
   * immutability for the names we captured: NEW names land freely
   * (Bricklay, lambdas, named-lets), but EXISTING substrate names are
   * fixed for the life of the env.
   *
   * Idempotent — calling twice is a no-op. Returns `this` so a chain
   * `freeze(makeBaseEnv(f))` reads as one expression.
   */
  freeze() {
    if (this._frozen) return this
    this._frozenNames = new Set(this.vars.keys())
    this._frozen = true
    // Block adding new properties to the env instance itself
    // (env.eval = ..., env.foo = 'bar'). The Map at .vars stays
    // mutable so user code can still `(define new-name …)` — the
    // freeze is a per-binding gate, not a wholesale lock.
    Object.freeze(this)
    return this
  }
}

// Block prototype pollution of the Env class itself. Without this, an
// attacker who reached `Env.prototype.define = …` could swap the
// substrate's authority for every env in the process. We freeze once
// at module load — Env's API is fixed code, not something a verb body
// ever extends.
Object.freeze(Env.prototype)

export class Closure {
  /**
   * params  — array of fixed parameter names (strings). Empty for a
   *           fully-variadic lambda like `(lambda args body)`.
   * restParam — when set (string), the name to bind to the list of all
   *           call-time arguments past the fixed `params.length`. R7RS
   *           §4.1.4 ships two variadic shapes:
   *             • `(lambda args body)`       → params=[], restParam='args'
   *             • `(lambda (a b . rest) ...)` → params=['a','b'],
   *                                              restParam='rest'  (not yet
   *                                              wired through the reader)
   *           When unset, the closure is fixed-arity and args are matched
   *           positionally against `params`.
   */
  constructor(params, body, env, restParam = null) {
    this.params = params
    this.body = body
    this.env = env
    this.restParam = restParam
  }
}

// parseParams(symList) — split a lambda/define param list into fixed
// params + an optional rest param (R7RS §4.1.4 dotted tail). The reader
// keeps `.` as an ordinary symbol inside a list, so `(a b . rest)` arrives
// as `[Sym(a), Sym(b), Sym('.'), Sym(rest)]`. We detect the `.` marker and
// gather the single following symbol as the rest param. (A6 fix, B3.)
//
//   (a b)          → { params:['a','b'],  restParam: null }
//   (a b . rest)   → { params:['a','b'],  restParam: 'rest' }
//   (. rest)       → { params:[],         restParam: 'rest' }   (≡ variadic)
function parseParams(symList) {
  const params = []
  let restParam = null
  // `(define (f . rest) ...)` leaves a bare symbol as the whole param list.
  if (symList instanceof Sym) return { params, restParam: symList.name }
  // Dotted param lists now arrive as a Pair chain from the reader.
  if (symList instanceof Pair) {
    let x = symList
    while (x instanceof Pair) {
      if (!(x.car instanceof Sym)) throw new Error('lambda parameters must be identifiers')
      params.push(x.car.name)
      x = x.cdr
    }
    if (!(x instanceof Sym)) throw new Error('dotted-tail: a single rest name must follow `.`')
    return { params, restParam: x.name }
  }
  for (let i = 0; i < symList.length; i++) {
    const s = symList[i]
    if (s instanceof Sym && s.name === '.') {
      const tail = symList[i + 1]
      if (!(tail instanceof Sym)) throw new Error('dotted-tail: a single rest name must follow `.`')
      if (i + 2 !== symList.length) throw new Error('dotted-tail: exactly one name may follow `.`')
      restParam = tail.name
      break
    }
    if (s instanceof Sym) params.push(s.name)
    else throw new Error('lambda parameters must be identifiers')
  }
  return { params, restParam }
}

// Trampoline sentinels. `Tail` carries a form to re-evaluate in `env`.
// `TailCall` carries a function + already-evaluated args (so application
// in tail position never grows the stack).
class Tail {
  constructor(form, env) { this.form = form; this.env = env }
}
class TailCall {
  constructor(fn, args) { this.fn = fn; this.args = args }
}

/**
 * Public entry point — the trampoline. Drives `evalStep()` until it
 * produces a non-sentinel value. The JS stack stays flat regardless of
 * Scheme call depth, so the only depth bound is `fuel`.
 */
export function evaluate(form, env, fuel) {
  let cur = evalStep(form, env, fuel)
  while (cur instanceof Tail || cur instanceof TailCall) {
    if (cur instanceof Tail) {
      cur = evalStep(cur.form, cur.env, fuel)
    } else {
      cur = applyStep(cur.fn, cur.args, fuel)
    }
  }
  return cur
}

// DEPTH NOTE (R3, 2026-06-15): there is NO separate MAX_DEPTH constant.
// Recursion depth is bounded by `fuel`. Tail calls trampoline through
// Tail/TailCall sentinels (never growing the JS stack), so deep tail-
// recursive programs are bounded only by fuel. Non-tail calls grow the
// JS call stack; JS engines allow thousands of frames before a stack-
// overflow, so any practical fuel budget (≥50000) supports depth >100
// for non-tail recursion without hitting a JS engine limit.

// Special-form fast-path (Zane, 2026-06-22). Most calls hitting evalStep
// are VERB applications, not special forms. The string-switch below
// touches 16 case labels before falling through to the application path.
// SPECIAL_FORMS is a frozen Set used as a single Map.has-shaped guard so
// the common (verb …) call exits the special-form section in one lookup
// instead of running the cascading switch all the way through `default`.
//
// Background: this is the same idea Chibi-Scheme applies at expansion
// time (https://synthcode.com/scheme/chibi/) by pre-rewriting source
// into a closed set of "core forms" — we don't compile to bytecode, but
// pre-classifying the head symbol is the cheapest moral equivalent for a
// tree-walker. Femtolisp avoids the dispatch entirely by compiling to
// opcodes (https://github.com/JeffBezanson/femtolisp); we keep the AST
// shape, only short-circuit the no-match exit. JS engines fold the Set
// lookup to a hidden-class hash hit; the switch keeps its own optimizer
// niceness for the special-form branches. Net result is one branch saved
// per verb call, which is the dominant call shape in a card runtime.
const SPECIAL_FORMS = new Set([
  'quote', 'if', 'define', 'set!', 'lambda', 'begin',
  'let', 'let*', 'letrec', 'let-values', 'let*-values', 'quasiquote', 'when', 'and',
  'or', 'unless', 'cond', 'case',
  // R7RS §5.5 / §4.2.7 / §4.2.4 / §4.2.5 — 2026-07-18 finalization.
  'define-record-type', 'guard', 'do', 'delay',
  'letrec*', 'case-lambda', 'define-values', 'delay-force',
  'parameterize', 'cond-expand',
])

// Destructure a producer's result (a Values wrapper, or a bare single value)
// against let-values formals and define each name in `env`. Formals may be a
// proper list of symbols `(a b)` — positional — or a single symbol `rest`,
// which binds ALL the produced values as a list.
function bindValues(formals, result, env) {
  const vals = result instanceof Values ? result.vals : [result]
  if (formals instanceof Sym) {            // (rest) — collect every value
    env.define(formals.name, vals)
    return
  }
  if (Array.isArray(formals)) {
    if (formals.length !== vals.length) {
      throw new Error(`let-values: expected ${formals.length} value(s), got ${vals.length}`)
    }
    for (let i = 0; i < formals.length; i++) env.define(formals[i].name, vals[i])
    return
  }
  throw new Error('let-values: malformed formals')
}

// R7RS §4.2.1 cond-expand feature requirements.
const FEATURES = new Set(['motoi', 'scheme', 'r7rs', 'exact-closed', 'ratios', 'full-unicode'])
function featureMatch(req) {
  if (req instanceof Sym) return req.name === 'else' || FEATURES.has(req.name)
  if (!Array.isArray(req) || req.length === 0) return false
  const head = req[0] instanceof Sym ? req[0].name : ''
  if (head === 'and') return req.slice(1).every(featureMatch)
  if (head === 'or') return req.slice(1).some(featureMatch)
  if (head === 'not') return !featureMatch(req[1])
  if (head === 'library') return false   // no library registry to consult yet
  return false
}

function evalStep(form, env, fuel) {
  if (--fuel.n < 0) throw new Error('fuel exhausted')
  if (form instanceof Sym) {
    // Keyword literals (:foo) self-evaluate — used for kwargs in cortex/*, etc.
    if (form.name.length > 1 && form.name.charCodeAt(0) === 58 /* ':' */) return form
    return env.get(form.name)
  }
  if (!Array.isArray(form)) return form        // number / string / boolean / fn — self-evaluating
  if (form.length === 0) return []

  const head = form[0]
  if (head instanceof Sym && SPECIAL_FORMS.has(head.name)) {
    switch (head.name) {
      case 'quote':
        return form[1]
      case 'if': {
        const test = evaluate(form[1], env, fuel)
        // Tail position: consequent or alternate. Bounce, don't recurse.
        return new Tail(test !== false ? form[2] : (form[3] ?? false), env)
      }
      case 'define': {
        if (Array.isArray(form[1]) || form[1] instanceof Pair) { // (define (f a b) body...)
          const head = form[1]
          const isPairHead = head instanceof Pair
          const name = (isPairHead ? head.car : head[0]).name
          // A6 (B3): dotted-tail params — (define (f a b . rest) body) binds
          // `rest` to a list of all args past the fixed ones. parseParams
          // splits the dotted tail out of the param list.
          const { params, restParam } = parseParams(isPairHead ? head.cdr : head.slice(1))
          const closure = new Closure(params, form.slice(2), env, restParam)
          // Stack-panel hook — same idea as JS primitives, so a lambda
          // defined via (define (f ...) ...) shows its own name.
          try { closure.__verbName = name } catch { /* frozen */ }
          env.define(name, closure)
        } else {                                       // (define x v)
          const val = evaluate(form[2], env, fuel)
          if (val instanceof Closure && !val.__verbName) {
            try { val.__verbName = form[1].name } catch { /* frozen */ }
          }
          env.define(form[1].name, val)
        }
        return undefined
      }
      case 'set!':
        env.set(form[1].name, evaluate(form[2], env, fuel))
        return undefined
      case 'lambda': {
        // Two R7RS §4.1.4 shapes:
        //   (lambda (a b c) body)  → form[1] is an array of param Syms
        //   (lambda args body)     → form[1] is a single Sym; ALL call-
        //                             time arguments get gathered into a
        //                             list bound to that name.
        // Detect the variadic shape by `form[1]` being a Sym instead of
        // an array. The fixed-arity path stays untouched.
        if (form[1] instanceof Sym) {
          return new Closure([], form.slice(2), env, form[1].name)
        }
        // A6 (B3): (lambda (a b . rest) body) — dotted-tail variadic.
        // parseParams splits the trailing `. rest` into restParam.
        const { params, restParam } = parseParams(form[1])
        return new Closure(params, form.slice(2), env, restParam)
      }
      case 'begin': {
        // All but the last form: evaluate eagerly for side-effects.
        for (let i = 1; i < form.length - 1; i++) evaluate(form[i], env, fuel)
        if (form.length === 1) return undefined
        return new Tail(form[form.length - 1], env)   // last form: tail position
      }
      case 'let': {
        // Named let — (let loop ((i 0) ...) body...) — bind `loop` to a
        // closure that re-enters the body, then call it once with the
        // initial values. Standard Scheme; the curated games rely on it.
        if (form[1] instanceof Sym) {
          const loopName = form[1].name
          const bindings = form[2]
          const params = bindings.map(([n]) => n.name)
          const initVals = bindings.map(([, expr]) => evaluate(expr, env, fuel))
          const e2 = new Env(env)
          const closure = new Closure(params, form.slice(3), e2)
          e2.define(loopName, closure)
          return new TailCall(closure, initVals)       // tail position
        }
        const e2 = new Env(env)
        for (const [name, expr] of form[1]) e2.define(name.name, evaluate(expr, env, fuel))
        for (let i = 2; i < form.length - 1; i++) evaluate(form[i], e2, fuel)
        if (form.length === 2) return undefined
        return new Tail(form[form.length - 1], e2)
      }
      case 'let*': {                                  // sequential: each binding sees the prior
        const e2 = new Env(env)
        for (const [name, expr] of form[1]) e2.define(name.name, evaluate(expr, e2, fuel))
        for (let i = 2; i < form.length - 1; i++) evaluate(form[i], e2, fuel)
        if (form.length === 2) return undefined
        return new Tail(form[form.length - 1], e2)
      }
      // `letrec` here already evaluates its inits left-to-right in the new
      // env, which is exactly R7RS §4.2.2 `letrec*` — one branch serves both.
      case 'letrec*':
      case 'letrec': {
        // Each binding sees every binding (forward-references allowed) —
        // the standard Lisp pattern for mutually recursive lambdas.
        // Bindings start as `undefined`, then each value is computed in
        // an env where every name already resolves; closures capture the
        // forward references at call time.
        const e2 = new Env(env)
        for (const [name] of form[1]) e2.define(name.name, undefined)
        for (const [name, expr] of form[1]) e2.set(name.name, evaluate(expr, e2, fuel))
        for (let i = 2; i < form.length - 1; i++) evaluate(form[i], e2, fuel)
        if (form.length === 2) return undefined
        return new Tail(form[form.length - 1], e2)
      }
      case 'let-values': {
        // R7RS §4.2.2 — (let-values (((a b) init) (rest init2)) body...)
        // Each init is evaluated in the OUTER env (parallel binding); its
        // (possibly multiple) values are destructured against the formals.
        const e2 = new Env(env)
        for (const [formals, initExpr] of form[1]) {
          bindValues(formals, evaluate(initExpr, env, fuel), e2)
        }
        for (let i = 2; i < form.length - 1; i++) evaluate(form[i], e2, fuel)
        if (form.length === 2) return undefined
        return new Tail(form[form.length - 1], e2)
      }
      case 'let*-values': {
        // Like let-values but each init sees the bindings established by the
        // clauses before it (sequential).
        const e2 = new Env(env)
        for (const [formals, initExpr] of form[1]) {
          bindValues(formals, evaluate(initExpr, e2, fuel), e2)
        }
        for (let i = 2; i < form.length - 1; i++) evaluate(form[i], e2, fuel)
        if (form.length === 2) return undefined
        return new Tail(form[form.length - 1], e2)
      }
      case 'quasiquote':
        return quasiExpand(form[1], env, fuel)
      case 'when': {
        if (evaluate(form[1], env, fuel) !== false) {
          for (let i = 2; i < form.length - 1; i++) evaluate(form[i], env, fuel)
          if (form.length === 2) return undefined
          return new Tail(form[form.length - 1], env)
        }
        return undefined
      }
      case 'and': {
        if (form.length === 1) return true
        for (let i = 1; i < form.length - 1; i++) {
          const r = evaluate(form[i], env, fuel)
          if (r === false) return false
        }
        return new Tail(form[form.length - 1], env)   // tail position
      }
      case 'or': {
        for (let i = 1; i < form.length - 1; i++) {
          const r = evaluate(form[i], env, fuel)
          if (r !== false) return r
        }
        if (form.length === 1) return false
        return new Tail(form[form.length - 1], env)   // tail position
      }
      case 'unless': {
        if (evaluate(form[1], env, fuel) === false) {
          for (let i = 2; i < form.length - 1; i++) evaluate(form[i], env, fuel)
          if (form.length === 2) return undefined
          return new Tail(form[form.length - 1], env)
        }
        return undefined
      }
      case 'cond': {
        for (let i = 1; i < form.length; i++) {
          const clause = form[i]
          const test = clause[0]
          const isElse = test instanceof Sym && test.name === 'else'
          const t = isElse ? true : evaluate(test, env, fuel)
          if (t !== false) {
            if (clause.length === 1) return t            // (cond (x)) → x's value
            // R7RS `=>`: (cond (test => proc)) applies proc to test's value.
            if (clause.length === 3 && clause[1] instanceof Sym && clause[1].name === '=>') {
              const proc = evaluate(clause[2], env, fuel)
              return apply(proc, [t], fuel)
            }
            for (let j = 1; j < clause.length - 1; j++) evaluate(clause[j], env, fuel)
            return new Tail(clause[clause.length - 1], env)
          }
        }
        return undefined
      }
      case 'case': {
        const key = evaluate(form[1], env, fuel)
        for (let i = 2; i < form.length; i++) {
          const clause = form[i]
          const data = clause[0]
          const hit = (data instanceof Sym && data.name === 'else') ||
            (Array.isArray(data) && data.some((d) =>
              d === key || (d instanceof Sym && key instanceof Sym && d.name === key.name)))
          if (hit) {
            if (clause.length === 1) return undefined
            // R7RS §4.2.1 — `(datums => proc)` applies proc to the key.
            if (clause[1] instanceof Sym && clause[1].name === '=>') {
              return new TailCall(evaluate(clause[2], env, fuel), [key])
            }
            for (let j = 1; j < clause.length - 1; j++) evaluate(clause[j], env, fuel)
            return new Tail(clause[clause.length - 1], env)
          }
        }
        return undefined
      }
      // R7RS §5.5 — define-record-type. Expands to:
      //   (define TYPE (_make-record-type 'name field1 field2 ...))
      //   (define (CONSTRUCTOR f1 f2 ...) (_make-record TYPE f1 f2 ...))
      //   (define (PREDICATE v) (_record-of-type? v TYPE))
      //   (define (FIELD-ACCESSOR v) (_record-ref v 'field))
      //   (define (FIELD-MUTATOR v x) (_record-set! v 'field x))
      case 'define-record-type': {
        // (define-record-type <name>
        //   (<constructor> field1 ...)
        //   <predicate>
        //   (<field> <accessor> [<mutator>]) ...)
        const typeName = form[1].name
        const ctorSpec = form[2]      // (ctor-name f1 f2 ...)
        const predName = form[3].name
        const fieldSpecs = form.slice(4)
        const ctorName = ctorSpec[0].name
        const ctorFields = ctorSpec.slice(1).map((s) => s.name)
        // 1. Create the type object.
        const makeRT = env.get('_make-record-type')
        const allFields = fieldSpecs.map((fs) => fs[0].name)
        const typeObj = makeRT(new Sym(typeName), ...allFields.map((f) => new Sym(f)))
        env.define(typeName, typeObj)
        // 2. Constructor.
        const makeRec = env.get('_make-record')
        env.define(ctorName, (...args) => {
          // Constructor takes ctorFields; fill any others with undefined.
          const values = allFields.map((f) => {
            const idx = ctorFields.indexOf(f)
            return idx >= 0 ? args[idx] : undefined
          })
          return makeRec(typeObj, ...values)
        }, { perm: 'read' })
        // 3. Predicate.
        const recQ = env.get('_record-of-type?')
        env.define(predName, (v) => recQ(v, typeObj), { perm: 'read' })
        // 4. Accessors + mutators.
        const recRef = env.get('_record-ref')
        const recSet = env.get('_record-set!')
        for (const fs of fieldSpecs) {
          const fieldName = fs[0].name
          const accessorName = fs[1].name
          env.define(accessorName, (v) => recRef(v, new Sym(fieldName)), { perm: 'read' })
          if (fs.length > 2) {
            const mutatorName = fs[2].name
            env.define(mutatorName, (v, x) => recSet(v, new Sym(fieldName), x), { perm: 'state-change' })
          }
        }
        return undefined
      }
      // R7RS §6.11 — guard. (guard (var clause ...) body ...) — evaluate
      // body; if it raises, bind var to the condition and run clauses like
      // cond. If no clause matches, re-raise. Simplified: no re-raise
      // continuation (raise-continuable maps to raise).
      case 'guard': {
        // form = ['guard', [var-sym, clause, clause, ...], body, ...]
        const spec = form[1]
        const varSym = spec[0]
        const clauses = spec.slice(1)
        const body = form.slice(2)
        try {
          let result
          for (const b of body) result = evaluate(b, env, fuel)
          return result
        } catch (err) {
          // Only catch SchemeError / values raised via `raise`; native
          // errors flow through too (R7RS treats any raised value as a
          // condition object). A value raised via `raise` arrives wrapped in
          // RaisedValue — unwrap so the guard variable binds the raw datum.
          const condition = err instanceof RaisedValue ? err.value : err
          const e2 = new Env(env)
          e2.define(varSym.name, condition)
          for (const clause of clauses) {
            const test = clause[0]
            const isElse = test instanceof Sym && test.name === 'else'
            const t = isElse ? true : evaluate(test, e2, fuel)
            if (t !== false) {
              if (clause.length === 1) return t
              let result
              for (let j = 1; j < clause.length; j++) result = evaluate(clause[j], e2, fuel)
              return result
            }
          }
          // No clause matched — re-raise.
          throw err
        }
      }
      // R7RS §4.2.4 — do. Iteration construct.
      //   (do ((var init step) ...) (test result ...) body ...)
      case 'do': {
        const bindings = form[1]         // [[var init step], ...]
        const testClause = form[2]       // [test result ...]
        const body = form.slice(3)
        const e2 = new Env(env)
        // Init.
        for (const b of bindings) e2.define(b[0].name, evaluate(b[1], env, fuel))
        while (true) {
          const test = evaluate(testClause[0], e2, fuel)
          if (test !== false) {
            // Termination — evaluate result forms.
            let result
            for (let j = 1; j < testClause.length; j++) result = evaluate(testClause[j], e2, fuel)
            return result
          }
          // Body for side-effects.
          for (const b of body) evaluate(b, e2, fuel)
          // Step. Compute all steps in the CURRENT env before assigning
          // (R7RS §4.2.4 parallel semantics).
          const newVals = bindings.map((b) => b.length > 2 ? evaluate(b[2], e2, fuel) : e2.get(b[0].name))
          for (let i = 0; i < bindings.length; i++) e2.set(bindings[i][0].name, newVals[i])
        }
      }
      // R7RS §4.2.5 — delay. Wrap the expression in a lazy promise.
      case 'delay': {
        const expr = form[1]
        const promise = { __promise__: true, forced: false, value: undefined, thunk: null }
        promise.thunk = new Closure([], [expr], env)
        return promise
      }
      // R7RS §4.2.5 — delay-force builds a promise whose thunk yields another
      // promise; `force` already loops on that, which is what makes deep
      // recursive streams run in constant space.
      case 'delay-force': {
        const promise = { __promise__: true, forced: false, value: undefined, thunk: null }
        promise.thunk = new Closure([], [form[1]], env)
        return promise
      }
      // R7RS §4.2.9 — (case-lambda ((a) body) ((a b) body) ((a . r) body))
      case 'case-lambda': {
        const clauses = form.slice(1).map((clause) => {
          const { params, restParam } = parseParams(clause[0])
          return new Closure(params, clause.slice(1), env, restParam)
        })
        const dispatch = (...args) => {
          for (const c of clauses) {
            if (c.restParam ? args.length >= c.params.length : args.length === c.params.length) {
              return apply(c, args, fuel)
            }
          }
          throw new Error(`case-lambda: no clause accepts ${args.length} argument(s)`)
        }
        return dispatch
      }
      // R7RS §5.3.3 — (define-values (a b) producer)
      case 'define-values': {
        bindValues(form[1], evaluate(form[2], env, fuel), env)
        return undefined
      }
      // R7RS §4.2.6 — (parameterize ((param value) ...) body ...). Each
      // parameter is pushed for the dynamic extent of the body and popped on
      // the way out, including when the body raises.
      case 'parameterize': {
        const bound = []
        for (const [paramExpr, valExpr] of form[1]) {
          const p = evaluate(paramExpr, env, fuel)
          const v = evaluate(valExpr, env, fuel)
          if (!p || !p._isParameter) throw new Error('parameterize: not a parameter')
          p._parameter.push(v)
          bound.push(p._parameter)
        }
        try {
          let last
          for (let i = 2; i < form.length; i++) last = evaluate(form[i], env, fuel)
          return last
        } finally {
          for (let i = bound.length - 1; i >= 0; i--) bound[i].pop()
        }
      }
      // R7RS §4.2.1 — (cond-expand (feature body ...) ... (else body ...)).
      case 'cond-expand': {
        for (let i = 1; i < form.length; i++) {
          const clause = form[i]
          if (featureMatch(clause[0])) {
            let last
            for (let j = 1; j < clause.length; j++) last = evaluate(clause[j], env, fuel)
            return last
          }
        }
        return undefined
      }
      default:
        break
    }
  }

  // Function application. Operands are evaluated inline (not tail
  // positions); the call itself bounces through TailCall so deep
  // self/mutual recursion never grows the JS stack.
  const fn = evaluate(head, env, fuel)
  const args = []
  for (let i = 1; i < form.length; i++) args.push(evaluate(form[i], env, fuel))
  return new TailCall(fn, args)
}

/**
 * Public apply — kept as a callable seam for primitives that want to
 * call back into Scheme (e.g. `for-each`, sprite callbacks). Drives the
 * trampoline locally, same as `evaluate()`.
 */
export function apply(fn, args, fuel) {
  let cur = applyStep(fn, args, fuel)
  while (cur instanceof Tail || cur instanceof TailCall) {
    if (cur instanceof Tail) {
      cur = evalStep(cur.form, cur.env, fuel)
    } else {
      cur = applyStep(cur.fn, cur.args, fuel)
    }
  }
  return cur
}

/**
 * One application step. JS functions resolve immediately; Closures
 * produce a Tail to the last body form (with all preceding body forms
 * evaluated for side-effects). The trampoline unwinds the Tail.
 */
function applyStep(fn, args, fuel) {
  // `(:honest-null "reason")` is the authored sentinel for a slot whose
  // program is genuinely N/A (MUT verbs, world/scene introspection, etc.).
  // It is documentation, not a call — evaluate it to its reason string so
  // it runs cleanly instead of raising "not a function".
  if (fn instanceof Sym && fn.name === ':honest-null') {
    return args.length ? args[0] : undefined
  }
  if (typeof fn === 'function') {
    // Stack hook (2026-07-19). Push a frame for named primitives so a
    // panel can show "we're inside `book/read`" while it runs. Anonymous
    // JS fns (arrow closures inside apply, etc.) are skipped — they'd
    // just be noise. finally-pop keeps the ledger balanced even if the
    // primitive throws.
    if (_COUNT_HOOK && fn.__verbName) _COUNT_HOOK(fn.__verbName)
    if (_STACK_PUSH && fn.__verbName) {
      _STACK_PUSH(fn.__verbName, 'primitive')
      try { return fn(...args) }
      finally { if (_STACK_POP) _STACK_POP() }
    }
    return fn(...args)
  }
  if (fn instanceof Closure) {
    // Stack hook — push a frame for the duration of body-run. The all-
    // but-last body forms use non-tail `evaluate`, so their recursive
    // frames stack under this one; the last-form Tail replaces this
    // frame in the outer trampoline. We pop right before returning so
    // the "peak" ledger captures the maximum depth reached.
    const pushed = !!_STACK_PUSH
    if (pushed) _STACK_PUSH(fn.__verbName || '(lambda)', 'closure')
    try {
      const e = new Env(fn.env)
      // Index loop instead of forEach — closure-per-call (the cb) +
      // forEach's iteration protocol cost out of the hot apply path.
      // applyStep is the trampoline target for every Scheme function
      // call; even tiny per-call wins matter on deep let-loops.
      const params = fn.params
      const pLen = params.length
      for (let i = 0; i < pLen; i++) e.define(params[i], args[i])
      // Variadic tail (R7RS §4.1.4) — gather any args past the fixed
      // params into a list bound to `restParam`. Covers both the fully-
      // variadic `(lambda args body)` shape (params=[]) and the future
      // dotted-tail `(lambda (a b . rest) body)` shape (params=['a','b']).
      // Skip the slice when there are no extra args; an empty list is
      // observably identical and we save one allocation per call.
      if (fn.restParam) {
        e.define(fn.restParam, args.length > pLen ? args.slice(pLen) : [])
      }
      const body = fn.body
      const bLen = body.length
      if (bLen === 0) return undefined
      for (let i = 0; i < bLen - 1; i++) evaluate(body[i], e, fuel)
      return new Tail(body[bLen - 1], e)
    } finally {
      if (pushed && _STACK_POP) _STACK_POP()
    }
  }
  throw new Error('not a function: ' + String(fn))
}


// `quasiquote` expansion. Walks the template; `(unquote x)` evaluates `x`
// in place; `(unquote-splicing x)` splices a list into the surrounding
// list. Nested quasiquotes drop one level of "evaluate-through" per
// nesting. This is the small-but-correct shape — sufficient for cards
// and data-template code without dragging in a full macro expander.
function quasiExpand(form, env, fuel) {
  if (form instanceof Pair) {
    return new Pair(quasiExpand(form.car, env, fuel), quasiExpand(form.cdr, env, fuel))
  }
  if (!Array.isArray(form)) return form
  if (form.length === 0) return form
  const head = form[0]
  if (head instanceof Sym) {
    if (head.name === 'unquote') return evaluate(form[1], env, fuel)
    if (head.name === 'unquote-splicing') {
      throw new Error('unquote-splicing not at list position')
    }
  }
  const out = []
  for (let i = 0; i < form.length; i++) {
    const item = form[i]
    // `(1 . ,x)` reads as `(1 unquote x)` — the dotted tail of a quasiquote.
    if (i > 0 && item instanceof Sym && item.name === 'unquote' && form.length === i + 2) {
      let acc = evaluate(form[i + 1], env, fuel)
      for (let j = out.length - 1; j >= 0; j--) acc = new Pair(out[j], acc)
      return acc
    }
    if (Array.isArray(item) && item[0] instanceof Sym
        && item[0].name === 'unquote-splicing') {
      const spliced = evaluate(item[1], env, fuel)
      if (Array.isArray(spliced)) out.push(...spliced)
      else out.push(spliced)
    } else {
      out.push(quasiExpand(item, env, fuel))
    }
  }
  return out
}
