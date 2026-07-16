// macro.js — a minimal but real hygienic macro system (SC1, B3).
//
// `define-syntax` + a `syntax-rules` subset, expanded as a SEPARATE PASS
// that runs BEFORE the interpreter and — crucially — before the security
// gate (runtime/dispatch.js walkVerbCalls). The order matters for safety:
//
//   SOURCE → parse → EXPAND (here) → walkVerbCalls (gate) → evaluate
//
// A macro can rewrite `(safe-paint c r)` into `(paint-glow c r)`, so the
// gate must see the EXPANDED tree — otherwise a macro could smuggle a
// forbidden verb past the perm check. The dispatcher therefore expands
// first and gates the result. See expandForGate() + the dispatch wiring.
//
// HYGIENE (practical subset): template identifiers that the macro
// INTRODUCES as *binders* (in a `let`/`lambda`/`letrec`/`define`) are
// alpha-renamed to fresh gensyms, so a macro's internal temporary can't
// capture (or be captured by) a name from the use site. Pattern
// variables, the macro's literals, and references to free/global names
// pass through unrenamed (referential transparency for the common case).
// This is not full R7RS hygiene, but it closes the two capture holes that
// actually bite: (a) a macro temp shadowing a user var, and (b) a user
// var shadowing a macro temp.
//
// FUEL: every expansion step decrements a shared counter; a macro that
// expands without bound (a recursive macro with no base case, or a fork
// bomb) is killed with `macro fuel exhausted` rather than hanging the
// thread. DoS gate per Soo-Jin + Sentinel.

import { Sym, sym, posOf, tagPos } from './reader.js'

const ELLIPSIS = '...'
const UNDERSCORE = '_'

// A compiled macro transformer.
class SyntaxRules {
  constructor(literals, rules, defEnv) {
    this.literals = new Set(literals)        // names matched literally
    this.rules = rules                        // [{ pattern, template }]
    this.defEnv = defEnv                      // macro table at definition site
  }
}

// The macro table is a simple name → SyntaxRules map. We thread one table
// through a whole expansion pass; nested `define-syntax` (e.g. inside a
// `begin`) extends it.
export class MacroTable {
  constructor(parent = null) {
    this.map = new Map()
    this.parent = parent
  }
  get(name) {
    if (this.map.has(name)) return this.map.get(name)
    if (this.parent) return this.parent.get(name)
    return undefined
  }
  has(name) { return this.get(name) !== undefined }
  set(name, transformer) { this.map.set(name, transformer) }
  child() { return new MacroTable(this) }
}

// ── gensym (hygiene) ────────────────────────────────────────────────────
let _gensymCounter = 0
export function __resetGensym() { _gensymCounter = 0 }
function gensym(base) {
  _gensymCounter = (_gensymCounter + 1) >>> 0
  return sym(`${base}~${_gensymCounter}`)
}

// ── syntax-rules compilation ────────────────────────────────────────────
//
// (syntax-rules (lit ...) (pattern template) ...)
//
// Returns a SyntaxRules. `(syntax-rules)` with no rules is legal (matches
// nothing) but unusual — we still compile it.
function compileSyntaxRules(form, macros) {
  // form = ['syntax-rules', (literals…), rule…]
  if (!Array.isArray(form) || !(form[0] instanceof Sym) || form[0].name !== 'syntax-rules') {
    throw new Error('define-syntax: expected (syntax-rules (lits…) rules…)')
  }
  const litList = form[1]
  if (!Array.isArray(litList)) throw new Error('syntax-rules: literal list must be a list')
  const literals = litList.map((s) => {
    if (!(s instanceof Sym)) throw new Error('syntax-rules: literals must be identifiers')
    return s.name
  })
  const rules = []
  for (let i = 2; i < form.length; i++) {
    const r = form[i]
    if (!Array.isArray(r) || r.length < 2) throw new Error('syntax-rules: each rule is (pattern template)')
    rules.push({ pattern: r[0], template: r[1] })
  }
  return new SyntaxRules(literals, rules, macros)
}

// ── pattern matching ─────────────────────────────────────────────────────
//
// Match a USE form against a rule's pattern. The pattern's HEAD (the macro
// keyword) is ignored — R7RS says the first pattern element is a
// placeholder for the macro name. Returns a bindings object on success,
// null on failure. Ellipsis (`...`) binds the preceding pattern variable
// to a LIST of matches (depth-1 ellipsis is supported, which covers the
// vast majority of real macros).

function isEllipsis(x) { return x instanceof Sym && x.name === ELLIPSIS }

// Collect the pattern variables in a pattern (everything that's a Sym and
// not a literal, the ellipsis, or `_`). Used to know which template
// identifiers are substitutions vs. literal template text.
function patternVars(pat, literals, out = new Set()) {
  if (pat instanceof Sym) {
    if (pat.name === ELLIPSIS || pat.name === UNDERSCORE) return out
    if (!literals.has(pat.name)) out.add(pat.name)
    return out
  }
  if (Array.isArray(pat)) for (const p of pat) patternVars(p, literals, out)
  return out
}

function matchPattern(pat, form, literals, binds, fuel) {
  if (--fuel.n < 0) throw new Error('macro fuel exhausted')
  if (pat instanceof Sym) {
    if (pat.name === UNDERSCORE) return true              // wildcard
    if (literals.has(pat.name)) {
      // Literal: must match the same identifier exactly.
      return form instanceof Sym && form.name === pat.name
    }
    binds[pat.name] = form                               // pattern variable
    return true
  }
  if (Array.isArray(pat)) {
    if (!Array.isArray(form)) return false
    // Find an ellipsis position, if any (depth-1).
    let ellipsisAt = -1
    for (let i = 0; i < pat.length; i++) {
      if (isEllipsis(pat[i])) { ellipsisAt = i; break }
    }
    if (ellipsisAt === -1) {
      if (pat.length !== form.length) return false
      for (let i = 0; i < pat.length; i++) {
        if (!matchPattern(pat[i], form[i], literals, binds, fuel)) return false
      }
      return true
    }
    // Ellipsis: pat = [ before…, sub, '...', after… ]
    const sub = pat[ellipsisAt - 1]
    const before = pat.slice(0, ellipsisAt - 1)
    const after = pat.slice(ellipsisAt + 1)
    const minFixed = before.length + after.length
    if (form.length < minFixed) return false
    // before
    for (let i = 0; i < before.length; i++) {
      if (!matchPattern(before[i], form[i], literals, binds, fuel)) return false
    }
    // after (from the tail)
    for (let i = 0; i < after.length; i++) {
      if (!matchPattern(after[i], form[form.length - after.length + i], literals, binds, fuel)) return false
    }
    // the repeated middle
    const repeatForms = form.slice(before.length, form.length - after.length)
    const vars = patternVars(sub, literals)
    // Each ellipsis var collects an array of per-iteration matches.
    const collected = {}
    for (const v of vars) collected[v] = []
    for (const rf of repeatForms) {
      const sb = {}
      if (!matchPattern(sub, rf, literals, sb, fuel)) return false
      for (const v of vars) collected[v].push(sb[v])
    }
    for (const v of vars) binds[v] = { __ellipsis: true, items: collected[v] }
    return true
  }
  // literal datum (number / string / boolean): must be equal.
  return pat === form
}

// ── template instantiation (with hygiene) ────────────────────────────────
//
// Walk the template. Substitute pattern variables. Identifiers introduced
// by the template that are NOT pattern variables get a per-expansion
// rename ONLY when they appear in binder position (hygiene). We do a
// two-pass-ish approach: first compute the set of template-introduced
// binder names, mint a fresh gensym per binder, then substitute.

const BINDING_FORMS = new Set(['let', 'let*', 'letrec', 'lambda', 'define', 'do'])

// Collect template identifiers that the template itself BINDS (so they're
// safe to rename). We only rename names that are (a) not pattern vars and
// (b) appear in a binder position within the template. This keeps free
// references (to globals / verbs) transparent.
function collectTemplateBinders(tpl, patVars, out = new Set()) {
  if (!Array.isArray(tpl) || tpl.length === 0) return out
  const head = tpl[0]
  if (head instanceof Sym && BINDING_FORMS.has(head.name)) {
    if (head.name === 'lambda') {
      const params = tpl[1]
      if (params instanceof Sym) { if (!patVars.has(params.name)) out.add(params.name) }
      else if (Array.isArray(params)) {
        for (const p of params) if (p instanceof Sym && !patVars.has(p.name)) out.add(p.name)
      }
    } else if (head.name === 'define') {
      const sig = tpl[1]
      if (sig instanceof Sym) { if (!patVars.has(sig.name)) out.add(sig.name) }
      else if (Array.isArray(sig)) {
        // (define (f a b) …) — f + a,b are binders.
        for (const p of sig) if (p instanceof Sym && !patVars.has(p.name)) out.add(p.name)
      }
    } else {
      // let / let* / letrec — bindings list is tpl[1] (named-let: tpl[2]).
      let bindIdx = 1
      if (tpl[1] instanceof Sym) { // named let
        if (!patVars.has(tpl[1].name)) out.add(tpl[1].name)
        bindIdx = 2
      }
      const binds = tpl[bindIdx]
      if (Array.isArray(binds)) {
        for (const b of binds) {
          if (Array.isArray(b) && b[0] instanceof Sym && !patVars.has(b[0].name)) out.add(b[0].name)
        }
      }
    }
  }
  for (const child of tpl) collectTemplateBinders(child, patVars, out)
  return out
}

function instantiate(tpl, binds, rename, fuel) {
  if (--fuel.n < 0) throw new Error('macro fuel exhausted')
  if (tpl instanceof Sym) {
    if (Object.prototype.hasOwnProperty.call(binds, tpl.name)) {
      const b = binds[tpl.name]
      // An ellipsis var used outside an ellipsis context — splice its items
      // verbatim is wrong; surface a clear error instead of silent nonsense.
      if (b && b.__ellipsis) throw new Error(`macro: pattern var '${tpl.name}' used without (...)`)
      return b
    }
    if (rename.has(tpl.name)) return rename.get(tpl.name)
    return tpl
  }
  if (!Array.isArray(tpl)) return tpl
  const out = []
  for (let i = 0; i < tpl.length; i++) {
    const item = tpl[i]
    const next = tpl[i + 1]
    if (next && isEllipsis(next)) {
      // `item ...` — expand item once per ellipsis iteration.
      const vars = ellipsisVarsIn(item, binds)
      if (vars.length === 0) {
        // No ellipsis var under this `...` — degenerate; emit item once.
        out.push(instantiate(item, binds, rename, fuel))
      } else {
        const len = binds[vars[0]].items.length
        for (let k = 0; k < len; k++) {
          const sub = Object.create(binds)
          for (const v of vars) sub[v] = binds[v].items[k]
          out.push(instantiate(item, sub, rename, fuel))
        }
      }
      i++ // skip the ellipsis token
    } else {
      out.push(instantiate(item, binds, rename, fuel))
    }
  }
  return out
}

// Which ellipsis-bound pattern vars appear inside `tpl`.
function ellipsisVarsIn(tpl, binds, out = []) {
  if (tpl instanceof Sym) {
    if (Object.prototype.hasOwnProperty.call(binds, tpl.name)
        && binds[tpl.name] && binds[tpl.name].__ellipsis && !out.includes(tpl.name)) {
      out.push(tpl.name)
    }
    return out
  }
  if (Array.isArray(tpl)) for (const x of tpl) ellipsisVarsIn(x, binds, out)
  return out
}

// Apply one syntax-rules transformer to a use form. Returns the rewritten
// form, or throws if no rule matched.
function applyTransformer(tr, useForm, fuel) {
  for (const rule of tr.rules) {
    const binds = {}
    // The pattern's head is the macro keyword placeholder — match the TAIL.
    const patTail = Array.isArray(rule.pattern) ? rule.pattern.slice(1) : []
    const formTail = Array.isArray(useForm) ? useForm.slice(1) : []
    // Build a synthetic list pattern/form so ellipsis logic at the top level
    // works uniformly.
    if (matchPattern(patTail, formTail, tr.literals, binds, fuel)) {
      const pv = patternVars(rule.pattern, tr.literals)
      const binders = collectTemplateBinders(rule.template, pv)
      const rename = new Map()
      for (const b of binders) rename.set(b, gensym(b))
      return instantiate(rule.template, binds, rename, fuel)
    }
  }
  throw new Error(`macro: no syntax-rules clause matched ${useForm[0] && useForm[0].name}`)
}

// ── the expansion pass ────────────────────────────────────────────────────
//
// expandTop(forms, opts) walks a top-level program, collecting
// `define-syntax` definitions and expanding every macro use. Returns the
// expanded program with `define-syntax` forms REMOVED (they're compile-time
// only — the runtime never sees them).
//
// opts.fuel — { n } step counter (DoS cap). opts.macros — a MacroTable to
// seed/extend (lets a host install built-in macros).

const DEFAULT_MACRO_FUEL = 100000

// Recursion-depth ceiling for macro RE-EXPANSION (a macro that emits a
// macro use). A runaway recursive macro (`(boom x) → (boom (x))`) grows
// the form unboundedly; without this cap it overflows the JS stack with an
// opaque "Maximum call stack size exceeded" before the fuel counter fires.
// The depth guard turns that into a clean, attributable error and keeps the
// thread alive. 400 is far past any legitimate macro (real macros expand a
// handful of levels). The DoS gate (Soo-Jin + Sentinel) is fuel OR depth,
// whichever trips first.
const MAX_EXPAND_DEPTH = 400

export function expandTop(forms, { fuel, macros } = {}) {
  const f = fuel || { n: DEFAULT_MACRO_FUEL }
  const table = macros || new MacroTable()
  const out = []
  for (const form of forms) {
    const e = expandForm(form, table, f, 0)
    if (e !== SKIP) out.push(e)
  }
  return out
}

// Sentinel: a form that fully consumed (a define-syntax) emits nothing.
const SKIP = Symbol('macro-skip')

function expandForm(form, table, fuel, depth = 0) {
  if (--fuel.n < 0) throw new Error('macro fuel exhausted')
  if (depth > MAX_EXPAND_DEPTH) throw new Error('macro expansion too deep — recursive macro?')
  if (!Array.isArray(form)) return form
  if (form.length === 0) return form
  const head = form[0]

  if (head instanceof Sym) {
    // define-syntax — register and emit nothing.
    if (head.name === 'define-syntax') {
      const name = form[1]
      if (!(name instanceof Sym)) throw new Error('define-syntax: name must be an identifier')
      table.set(name.name, compileSyntaxRules(form[2], table))
      return SKIP
    }
    // let-syntax / letrec-syntax — local macros: ((name rules)…) body…
    if (head.name === 'let-syntax' || head.name === 'letrec-syntax') {
      const child = table.child()
      const binds = form[1]
      if (Array.isArray(binds)) {
        for (const b of binds) {
          if (Array.isArray(b) && b[0] instanceof Sym) {
            child.set(b[0].name, compileSyntaxRules(b[1], child))
          }
        }
      }
      // Expand the body in the child table; wrap in begin so the result is
      // one form (the interpreter has `begin`).
      const body = form.slice(2).map((bf) => expandForm(bf, child, fuel, depth + 1)).filter((x) => x !== SKIP)
      return [sym('begin'), ...body]
    }
    // `quote` subtree is data — do not expand inside it.
    if (head.name === 'quote') return form

    // A macro use — expand, then RE-EXPAND the result (macros can emit
    // macros). Bounded by fuel AND depth. The expanded form inherits the
    // use-site source position so an error in macro-generated code still
    // points at where the operator wrote the macro call.
    if (table.has(head.name)) {
      const tr = table.get(head.name)
      const rewritten = applyTransformer(tr, form, fuel)
      const result = expandForm(rewritten, table, fuel, depth + 1)
      const usePos = posOf(form)
      if (usePos) tagPos(result, usePos)
      return result
    }
  }
  // Recurse into children (quasiquote handled by the interpreter — but a
  // macro use INSIDE an unquote should still expand; we expand all children
  // uniformly EXCEPT quoted data above). Rebuilt arrays inherit the
  // original form's source position (SC1b) so located errors survive
  // expansion.
  // Structural recursion into children does NOT count against the macro
  // re-expansion depth cap (a deeply-NESTED but non-recursive program is
  // fine — fuel bounds total work). Only macro RE-EXPANSION increments
  // `depth`, so the cap targets runaway recursive macros specifically.
  const out = form.map((child) => {
    const e = expandForm(child, table, fuel, depth)
    return e === SKIP ? [] : e
  })
  const pos = posOf(form)
  if (pos) tagPos(out, pos)
  return out
}

// expandForGate(source-forms) — the single entry the dispatcher uses to
// get the fully-expanded program (so the gate walks the REAL verb tree).
// Returns { forms, fuelUsed }.
export function expandProgram(forms, opts = {}) {
  const fuel = opts.fuel || { n: DEFAULT_MACRO_FUEL }
  const start = fuel.n
  const expanded = expandTop(forms, { ...opts, fuel })
  return { forms: expanded, fuelUsed: start - fuel.n }
}

export const _internals = Object.freeze({
  MacroTable, gensym, matchPattern, instantiate, applyTransformer,
  compileSyntaxRules, collectTemplateBinders, patternVars,
})
