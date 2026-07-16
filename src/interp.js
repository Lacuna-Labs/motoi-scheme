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

import { Sym } from './reader.js'
import { registerVerbMeta, defaultMetaFor } from './verbRegistry.js'

// v2.20.0-A5 — track which verb names have already emitted a
// missing-perm warning, so a hot-mounted installer (test setup re-runs
// `installCardVerbs` per test) doesn't drown the console with the same
// name. The Set is process-global; the audit's test seam clears it.
const MISSING_PERM_WARNED = new Set()
export function __resetMissingPermWarnings() { MISSING_PERM_WARNED.clear() }

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
      // v2.20.0-A5 perm-audit floor: warn (NOT throw) the first time a
      // verb registers without an explicit `meta.perm`. The legacy
      // 2-arg path still works (defaultMetaFor infers from the name);
      // the warning surfaces every bare registration so authors of
      // future verbs know to declare. See CARD-MANIFEST-CONTRACT §3.2.
      // The check is best-effort — we never block boot or registration.
      if ((!meta || meta.perm == null) && !MISSING_PERM_WARNED.has(name)) {
        MISSING_PERM_WARNED.add(name)
        try {
          if (typeof console !== 'undefined' && typeof console.warn === 'function') {
            console.warn(
              `[verbRegistry] env.define('${name}') missing explicit perm — ` +
              `falling back to defaultMetaFor inference. ` +
              `Declare perm per CARD-MANIFEST-CONTRACT.md §3.2.`,
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
  'let', 'let*', 'letrec', 'quasiquote', 'when', 'and',
  'or', 'unless', 'cond', 'case',
])

function evalStep(form, env, fuel) {
  if (--fuel.n < 0) throw new Error('fuel exhausted')
  if (form instanceof Sym) return env.get(form.name)
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
        if (Array.isArray(form[1])) {                 // (define (f a b) body...)
          const name = form[1][0].name
          // A6 (B3): dotted-tail params — (define (f a b . rest) body) binds
          // `rest` to a list of all args past the fixed ones. parseParams
          // splits the `.` marker out of the param list.
          const { params, restParam } = parseParams(form[1].slice(1))
          env.define(name, new Closure(params, form.slice(2), env, restParam))
        } else {                                       // (define x v)
          env.define(form[1].name, evaluate(form[2], env, fuel))
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
            for (let j = 1; j < clause.length - 1; j++) evaluate(clause[j], env, fuel)
            return new Tail(clause[clause.length - 1], env)
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
  if (typeof fn === 'function') return fn(...args)
  if (fn instanceof Closure) {
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
  }
  throw new Error('not a function: ' + String(fn))
}


// `quasiquote` expansion. Walks the template; `(unquote x)` evaluates `x`
// in place; `(unquote-splicing x)` splices a list into the surrounding
// list. Nested quasiquotes drop one level of "evaluate-through" per
// nesting. This is the small-but-correct shape — sufficient for cards
// and data-template code without dragging in a full macro expander.
function quasiExpand(form, env, fuel) {
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
  for (const item of form) {
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
