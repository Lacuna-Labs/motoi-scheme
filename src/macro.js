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
// The third piece — referential transparency — is there too: a free
// identifier in a template keeps the meaning it had where the macro was
// WRITTEN, whatever the use site did with that name. It comes in three
// parts, one per kind of meaning a definition site can give a name:
//
//   VARIABLE  → aliasFreeTemplateIds  (local macros: alias the def-site
//               binding under a name the use site could not have written)
//   MACRO     → the `tr.defEnv` re-expansion in expandForm
//   SYNTAX    → introducedSym / introducedIds (below)
//
// Telling apart two identifiers that share a NAME but reached the same form
// by different routes (`bound-identifier=?`) is now answered for the two
// questions `syntax-rules` itself asks — is this a literal, is this the
// ellipsis — by the marks below. It is NOT answered for variable references
// in a template under a plain `define-syntax`: `(let ((x 'outer))
// (define-syntax m …x…) (let ((x 'inner)) (m)))` still reads `inner`.
// That one wants per-identifier renaming, not another special case.
//
// FUEL: every expansion step decrements a shared counter; a macro that
// expands without bound (a recursive macro with no base case, or a fork
// bomb) is killed with `macro fuel exhausted` rather than hanging the
// thread. DoS gate per Soo-Jin + Sentinel.

import { Sym, sym, parse, posOf, tagPos } from './reader.js'
// `include` / `include-ci` (§4.1.7) splice a file's datums at EXPAND time, so
// the expander is the only place they can live — by the time the interpreter
// sees a form, the decision about what is in the program has been made.
import { readFileSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import { safePath } from '../lib/security/path-guard.js'

import { NIL, Pair, arrayToList, isList, isListish, isNull, isPair, listLength, listToArray, pairToString, seqVerb, toJS, toScheme } from '../lib/base/list.js'
const ELLIPSIS = '...'
const UNDERSCORE = '_'
// The default ellipsis as an IDENTIFIER, not a name. Every `ell` parameter
// below carries a `Sym` (or null, for a transformer that has no ellipsis).
const DEFAULT_ELL = sym(ELLIPSIS)

// ── identifier marks (bound-identifier=?, the narrow slice) ──────────────
//
// Two identifiers can share a NAME and still be different identifiers: one
// written in a macro's own source, one carried in from that macro's use
// site. `syntax-rules` has to tell them apart in exactly two places, and
// both are places where a name-only comparison gives a WRONG answer, not
// merely a less hygienic one:
//
//   * deciding whether a pattern identifier is one of the LITERALS, and
//   * deciding whether an identifier is the ELLIPSIS.
//
// Al Petrofsky's two tests in the R7RS conformance suite are built on
// precisely this. In `((m x) … (syntax-rules (k) ((n x) …) ((n y) …)) …)`
// the `k` in the literal list belongs to the outer macro's template while
// the `x` is replaced by the use site's `k`; comparing by name makes the
// pattern a literal that cannot match, and the wrong clause wins. In the
// custom-ellipsis test the same collision decides whether the inner
// transformer has an ellipsis at all.
//
// So a symbol that reaches a template through a PATTERN VARIABLE is given
// a per-expansion mark, and identifier sameness is name-plus-mark. This is
// the input half of the standard mark algorithm rather than the whole of
// it — template-written identifiers stay unmarked and therefore stay
// interned, which keeps this off the path of every other consumer of a
// symbol (`eqv?` on symbols already compares by name, src/base.js:764).
// A symbol that already carries a mark keeps it: its identity was fixed
// where it was introduced, and re-marking would sever it from the literal
// list it was introduced alongside.
let _markCounter = 0
function freshMark() { return ++_markCounter }

function markOf(s) { return (s && s.mark) || null }

// bound-identifier=?, for the two questions above only.
function sameId(a, b) {
  return a instanceof Sym && b instanceof Sym
      && a.name === b.name && markOf(a) === markOf(b)
}

function markSym(s, mark) {
  if (s.mark) return s
  const c = new Sym(s.name)
  c.mark = mark
  if (s.introduced) c.introduced = true
  return c
}

// Stamp every bare symbol a match bound to a pattern variable. Only bare
// symbols: a pattern variable bound to a LIST is spliced by reference (see
// USE_SITE below), and copying it to mark the symbols inside would drop the
// source positions that make macro-generated errors locatable.
function markBinds(binds, mark) {
  for (const k of Object.keys(binds)) {
    const v = binds[k]
    if (v instanceof Sym) binds[k] = markSym(v, mark)
    else if (v && v.__ellipsis) {
      v.items = v.items.map((it) => (it instanceof Sym ? markSym(it, mark) : it))
    }
  }
}

// The literal list, carrying both spellings: names (what nearly every caller
// wants, and what `.has()` / iteration have always yielded) and the literal
// identifiers themselves, for the mark-aware `is()`.
class Literals extends Set {
  constructor(syms) {
    super(syms.map((s) => s.name))
    this.syms = syms
  }
  is(id) { return this.syms.some((l) => sameId(l, id)) }
}

// Is this pattern identifier one of the transformer's literals? Falls back
// to the name when handed a plain Set, so `_internals.matchPattern` keeps
// its old contract for direct callers.
function isLiteralId(literals, id) {
  return literals.is ? literals.is(id) : literals.has(id.name)
}

// A compiled macro transformer.
class SyntaxRules {
  constructor(literals, rules, defEnv, ellipsis, defScope = null) {
    this.literals = literals instanceof Literals ? literals : new Literals(literals)
    this.rules = rules                        // [{ pattern, template }]
    this.defEnv = defEnv                      // macro table at definition site
    this.defScope = defScope                  // lexical scope at definition site
    // Naming the ellipsis as a literal takes the identifier back: there is
    // then no way to spell an ellipsis in this transformer, so it has none.
    // Same identifier, not merely the same name — see the marks note above.
    this.ellipsis = ellipsis && this.literals.is(ellipsis) ? null : ellipsis
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
// (syntax-rules <ellipsis> (lit ...) (pattern template) ...)   ← R7RS §4.3.2
//
// Returns a SyntaxRules. `(syntax-rules)` with no rules is legal (matches
// nothing) but unusual — we still compile it.
function compileSyntaxRules(form, macros, scope = null) {
  // form = ['syntax-rules', [<ellipsis>,] (literals…), rule…]
  if (!isList(form) || !(form[0] instanceof Sym) || form[0].name !== 'syntax-rules') {
    throw new Error('define-syntax: expected (syntax-rules (lits…) rules…)')
  }
  let i = 1
  let ellipsis = sym(ELLIPSIS)
  let customEllipsis = false
  if (form[i] instanceof Sym) { ellipsis = form[i]; customEllipsis = true; i++ }
  // `...` is only the ellipsis while it still MEANS the ellipsis. A program
  // may bind it as an ordinary variable — `(let ((... 19)) …)` — and inside
  // that scope a default-ellipsis transformer has no ellipsis at all, so
  // `...` is a plain pattern variable in a pattern and a plain reference in
  // a template. Two tests in the conformance suite turn on this, and both
  // agree with chibi. An explicitly NAMED ellipsis is exempt: naming it is
  // the act of choosing it, and a variable of that name is unrelated.
  if (!customEllipsis && scopeHas(scope, ELLIPSIS)) ellipsis = null
  const litList = form[i]
  i++
  if (!isList(litList)) throw new Error('syntax-rules: literal list must be a list')
  const literals = litList.map((s) => {
    if (!(s instanceof Sym)) throw new Error('syntax-rules: literals must be identifiers')
    return s
  })
  const rules = []
  for (; i < form.length; i++) {
    const r = form[i]
    if (!isList(r) || r.length < 2) throw new Error('syntax-rules: each rule is (pattern template)')
    rules.push({ pattern: r[0], template: r[1] })
  }
  return new SyntaxRules(literals, rules, macros, ellipsis, scope)
}

// ── pattern matching ─────────────────────────────────────────────────────
//
// Match a USE form against a rule's pattern. The pattern's HEAD (the macro
// keyword) is ignored — R7RS says the first pattern element is a
// placeholder for the macro name. Returns a bindings object on success,
// null on failure. Ellipsis (`...`) binds the preceding pattern variable
// to a LIST of matches (depth-1 ellipsis is supported, which covers the
// vast majority of real macros).

function isEllipsis(x, ell = DEFAULT_ELL) {
  return ell !== null && sameId(x, ell)
}

// Collect the pattern variables in a pattern (everything that's a Sym and
// not a literal, the ellipsis, or `_`). Used to know which template
// identifiers are substitutions vs. literal template text.
function patternVars(pat, literals, out = new Set(), ell = DEFAULT_ELL) {
  if (pat instanceof Sym) {
    if (isEllipsis(pat, ell) || pat.name === UNDERSCORE) return out
    if (!isLiteralId(literals, pat)) out.add(pat.name)
    return out
  }
  if (isList(pat)) for (const p of pat) patternVars(p, literals, out, ell)
  return out
}

function matchPattern(pat, form, literals, binds, fuel, ell = DEFAULT_ELL) {
  if (--fuel.n < 0) throw new Error('macro fuel exhausted')
  if (pat instanceof Sym) {
    // Literal wins over the `_` wildcard: naming `_` in the literal list is
    // how R7RS lets a macro match a bare underscore (larceny/base.sld).
    // The form side stays a NAME comparison — R7RS matches literals with
    // free-identifier=?, and tightening that here would stop a keyword one
    // macro emits into another macro's use form from matching.
    if (isLiteralId(literals, pat)) {
      // Literal: must match the same identifier exactly.
      return form instanceof Sym && form.name === pat.name
    }
    if (pat.name === UNDERSCORE) return true              // wildcard
    binds[pat.name] = form                               // pattern variable
    return true
  }
  if (isList(pat)) {
    if (!isList(form)) return false
    // Find an ellipsis position, if any (depth-1).
    let ellipsisAt = -1
    for (let i = 0; i < pat.length; i++) {
      if (isEllipsis(pat[i], ell)) { ellipsisAt = i; break }
    }
    if (ellipsisAt === -1) {
      if (pat.length !== form.length) return false
      for (let i = 0; i < pat.length; i++) {
        if (!matchPattern(pat[i], form[i], literals, binds, fuel, ell)) return false
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
      if (!matchPattern(before[i], form[i], literals, binds, fuel, ell)) return false
    }
    // after (from the tail)
    for (let i = 0; i < after.length; i++) {
      if (!matchPattern(after[i], form[form.length - after.length + i], literals, binds, fuel, ell)) return false
    }
    // the repeated middle
    const repeatForms = form.slice(before.length, form.length - after.length)
    const vars = patternVars(sub, literals, new Set(), ell)
    // Each ellipsis var collects an array of per-iteration matches.
    const collected = {}
    for (const v of vars) collected[v] = []
    for (const rf of repeatForms) {
      const sb = {}
      if (!matchPattern(sub, rf, literals, sb, fuel, ell)) return false
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
  if (!isList(tpl) || tpl.length === 0) return out
  const head = tpl[0]
  if (head instanceof Sym && BINDING_FORMS.has(head.name)) {
    if (head.name === 'lambda') {
      const params = tpl[1]
      if (params instanceof Sym) { if (!patVars.has(params.name)) out.add(params.name) }
      else if (isList(params)) {
        for (const p of params) if (p instanceof Sym && !patVars.has(p.name)) out.add(p.name)
      }
    } else if (head.name === 'define') {
      const sig = tpl[1]
      if (sig instanceof Sym) { if (!patVars.has(sig.name)) out.add(sig.name) }
      else if (isList(sig)) {
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
      if (isList(binds)) {
        for (const b of binds) {
          if (isList(b) && b[0] instanceof Sym && !patVars.has(b[0].name)) out.add(b[0].name)
        }
      }
    }
  }
  for (const child of tpl) collectTemplateBinders(child, patVars, out)
  return out
}

// Look up a pattern-var binding through the ellipsis-layered binds chain.
// Ellipsis iterations layer scopes with Object.create(binds), so a
// non-ellipsis var (e.g. `dur` in `(f x dur) ...`) lives on a prototype,
// not as an own property. Walk the chain but stop before Object.prototype
// so we never match built-ins like `toString`.
function findBind(binds, name) {
  let o = binds
  while (o && o !== Object.prototype) {
    if (Object.prototype.hasOwnProperty.call(o, name)) return { found: true, value: o[name] }
    o = Object.getPrototypeOf(o)
  }
  return { found: false, value: undefined }
}

function instantiate(tpl, binds, rename, fuel, ell = DEFAULT_ELL, noEll = false, intro = null) {
  if (--fuel.n < 0) throw new Error('macro fuel exhausted')
  if (tpl instanceof Sym) {
    const hit = findBind(binds, tpl.name)
    if (hit.found) {
      const b = hit.value
      // An ellipsis var used outside an ellipsis context — splice its items
      // verbatim is wrong; surface a clear error instead of silent nonsense.
      if (b && b.__ellipsis) throw new Error(`macro: pattern var '${tpl.name}' used without (...)`)
      return b
    }
    if (rename.has(tpl.name)) return rename.get(tpl.name)
    return tpl
  }
  if (!isList(tpl)) return tpl
  // R7RS §4.3.2 `(<ellipsis> <template>)`: emit <template> with every
  // ellipsis inside it stripped of its special meaning, so a macro can
  // write a literal `...` into the macro it is generating. Pattern
  // variables still substitute.
  if (!noEll && tpl.length === 2 && isEllipsis(tpl[0], ell)) {
    return instantiate(tpl[1], binds, rename, fuel, ell, true, intro)
  }
  const out = []
  for (let i = 0; i < tpl.length; i++) {
    const item = tpl[i]
    const next = tpl[i + 1]
    if (!noEll && next && isEllipsis(next, ell)) {
      // `item ...` — expand item once per ellipsis iteration.
      const vars = ellipsisVarsIn(item, binds)
      if (vars.length === 0) {
        // No ellipsis var under this `...` — degenerate; emit item once.
        out.push(instantiate(item, binds, rename, fuel, ell, noEll, intro))
      } else {
        const len = binds[vars[0]].items.length
        for (let k = 0; k < len; k++) {
          const sub = Object.create(binds)
          for (const v of vars) sub[v] = binds[v].items[k]
          out.push(instantiate(item, sub, rename, fuel, ell, noEll, intro))
        }
      }
      i++ // skip the ellipsis token
    } else if (i === 0 && intro && item instanceof Sym && intro.has(item.name) &&
               !rename.has(item.name) && !findBind(binds, item.name).found) {
      // Operator contributed by the template — carry the definition site's
      // reading of it, so a use-site variable of the same name cannot make a
      // keyword stop being one. See introducedSym.
      out.push(introducedSym(item.name))
    } else {
      out.push(instantiate(item, binds, rename, fuel, ell, noEll, intro))
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
  if (isList(tpl)) for (const x of tpl) ellipsisVarsIn(x, binds, out)
  return out
}

// ── lexical scope (read-only) ────────────────────────────────────────────
//
// A cons-chain of the variable names bound by enclosing binding forms. It
// exists for one question, asked only at a `let-syntax`: is this identifier
// a lexical variable HERE? Chain, not a copied Set, because it is built on
// every binding form in the program and read almost never.
//
// Under-reporting is safe (we simply skip the hygiene alias below).
// Over-reporting is not, so only forms whose binders are unambiguous are
// listed; `let-values`, `case-lambda` and friends are deliberately absent.
function scopeWith(form, scope) {
  const head = form[0]
  if (!(head instanceof Sym)) return scope
  const names = []
  const push = (x) => { if (x instanceof Sym) names.push(x.name) }
  switch (head.name) {
    case 'lambda': {
      const p = form[1]
      if (p instanceof Sym) push(p)
      else if (isList(p)) for (const q of p) push(q)
      break
    }
    case 'define': {
      const s = form[1]
      if (s instanceof Sym) push(s)
      else if (isList(s)) for (const q of s) push(q)
      break
    }
    case 'let': case 'let*': case 'letrec': case 'letrec*': {
      let i = 1
      if (form[1] instanceof Sym) { push(form[1]); i = 2 }   // named let
      const bs = form[i]
      if (isList(bs)) {
        for (const b of bs) {
          if (isList(b)) push(b[0])
          else push(b)
        }
      }
      break
    }
    default: return scope
  }
  if (names.length === 0) return scope
  return { names, parent: scope }
}

function scopeHas(scope, name) {
  for (let s = scope; s; s = s.parent) if (s.names.includes(name)) return true
  return false
}

// Identifiers a template REFERENCES freely: not pattern variables, not the
// names the template itself binds (those are gensym-renamed), not the
// ellipsis, and nothing inside `quote` (a quoted symbol is datum, not a
// reference — renaming it would change the value the macro produces).
function templateFreeIds(tpl, skip, ell, out = new Set()) {
  if (tpl instanceof Sym) {
    if (isEllipsis(tpl, ell) || tpl.name === UNDERSCORE) return out
    if (!skip.has(tpl.name)) out.add(tpl.name)
    return out
  }
  if (isList(tpl)) {
    if (tpl[0] instanceof Sym && tpl[0].name === 'quote') return out
    for (const t of tpl) templateFreeIds(t, skip, ell, out)
  }
  return out
}

function substIds(tpl, map, skip) {
  if (tpl instanceof Sym) {
    if (skip.has(tpl.name)) return tpl
    return map.get(tpl.name) || tpl
  }
  if (!isList(tpl)) return tpl
  if (tpl[0] instanceof Sym && tpl[0].name === 'quote') return tpl
  return tpl.map((t) => substIds(t, map, skip))
}

// R7RS §4.3.1 referential transparency for VARIABLES: a free identifier in
// a local macro's template must mean what it meant where the macro was
// written, even if the use site rebinds that name. We give each such
// identifier a fresh alias, rewrite the templates to use the alias, and let
// the caller bind `(alias . original)` at the definition site — a name the
// body cannot shadow because it did not exist when the body was written.
//
// LIMIT: the alias captures the variable's VALUE at let-syntax entry, so a
// later `set!` of the original is not seen through the macro. Real hygiene
// shares the binding; this shares the value. Only names proven lexical by
// `scope` are aliased, so a wrong guess is an unbound-variable error, never
// a silently different program.
function aliasFreeTemplateIds(transformers, scope) {
  const aliases = new Map()
  const perRule = []
  for (const tr of transformers) {
    for (const rule of tr.rules) {
      const pv = patternVars(rule.pattern, tr.literals, new Set(), tr.ellipsis)
      const skip = collectTemplateBinders(rule.template, pv)
      for (const v of pv) skip.add(v)
      for (const lit of tr.literals) skip.add(lit)
      perRule.push({ rule, skip })
      for (const id of templateFreeIds(rule.template, skip, tr.ellipsis)) {
        if (aliases.has(id)) continue
        // A macro keyword visible in the template's own environment is not a
        // variable reference — `letrec-syntax` siblings live here.
        if (tr.defEnv && tr.defEnv.has(id)) continue
        if (scopeHas(scope, id)) aliases.set(id, gensym(id))
      }
    }
  }
  if (aliases.size === 0) return null
  for (const { rule, skip } of perRule) rule.template = substIds(rule.template, aliases, skip)
  return aliases
}

// ── template-introduced identifiers ──────────────────────────────────────
//
// The mirror image of aliasFreeTemplateIds. That one covers a free template
// identifier that named a VARIABLE where the macro was written; this one
// covers a free template identifier that named SYNTAX there.
//
// R7RS §4.3.1 needs both halves — a template identifier means what it meant
// at the macro's DEFINITION site. In the standard's own example
//
//   (letrec-syntax ((my-or (syntax-rules () …
//                     (let ((temp e1)) (if temp temp (my-or e2 …))))))
//     (let ((x #f) (y 7) (temp 8) (let odd?) (if even?))
//       (my-or x (let temp) (if y) y)))
//
// the `let` and `if` the TEMPLATE emits are still keywords, while the `let`
// and `if` the USE SITE wrote are calls to `odd?` and `even?`. Both spellings
// land in the same expansion, so the difference cannot live in the name — it
// has to live on the identifier. A template-introduced operator therefore
// gets a fresh, UNINTERNED `Sym` flagged `introduced`, and `evalStep` skips
// its keyword-shadowing check for exactly those.
//
// "Introduced" is decided structurally, not per keyword name: an identifier
// is introduced when the template contributed it and the definition site had
// no lexical variable by that name. There is no list of keywords here, and
// adding a special form to the interpreter needs no change on this side.
//
// Only OPERATOR position is flagged, because that is the sole place the
// evaluator chooses between keyword and variable. Flagging data would push
// uninterned symbols into quoted structure for no gain. (`eq?` on symbols
// compares by name — src/base.js:638 — so an uninterned Sym is safe either
// way; this just keeps the blast radius at the one decision that reads it.)
//
// LIMIT, same shape as aliasFreeTemplateIds': `scopeWith` under-reports
// binders on purpose, so a macro written inside a scope that binds a keyword
// name through a form `scopeWith` does not track would see that identifier
// flagged. That costs nothing unless the program ALSO shadows a keyword, and
// under-reporting is the safe direction for the alias half, so the two
// halves keep one scope walker rather than two disagreeing ones.
const INTRODUCED = new Map()
function introducedSym(name) {
  let s = INTRODUCED.get(name)
  if (!s) { s = new Sym(name); s.introduced = true; INTRODUCED.set(name, s) }
  return s
}

// Names this rule's template contributes freely that were NOT lexical
// variables at the definition site. Memoized on the rule: it is a property of
// the transformer, not of the use. Computed lazily so it runs after
// aliasFreeTemplateIds has rewritten `rule.template`, and never at all for a
// macro that is defined but never used.
function introducedIds(tr, rule) {
  if (rule.__intro !== undefined) return rule.__intro
  const pv = patternVars(rule.pattern, tr.literals, new Set(), tr.ellipsis)
  const skip = collectTemplateBinders(rule.template, pv)
  for (const v of pv) skip.add(v)
  for (const lit of tr.literals) skip.add(lit)
  const out = new Set()
  for (const id of templateFreeIds(rule.template, skip, tr.ellipsis)) {
    if (!scopeHas(tr.defScope, id)) out.add(id)
  }
  rule.__intro = out.size === 0 ? null : out
  return rule.__intro
}

// Subtrees carried in from the macro USE site (the values bound to pattern
// variables) must keep resolving macro keywords in the use site's table,
// while everything the template itself contributed resolves in the
// transformer's definition environment — R7RS §4.3.1 referential
// transparency for keywords. The values are spliced by reference, so a
// WeakMap on the spliced array is enough for expandForm to switch back.
const USE_SITE = new WeakMap()

function markUseSite(v, table) {
  if (isList(v)) USE_SITE.set(v, table)
  else if (v && v.__ellipsis) for (const item of v.items) markUseSite(item, table)
}

// Apply one syntax-rules transformer to a use form. Returns the rewritten
// form, or throws if no rule matched.
function applyTransformer(tr, useForm, fuel, useTable) {
  for (const rule of tr.rules) {
    const binds = {}
    // The pattern's head is the macro keyword placeholder — match the TAIL.
    const patTail = isList(rule.pattern) ? rule.pattern.slice(1) : []
    const formTail = isList(useForm) ? useForm.slice(1) : []
    // Build a synthetic list pattern/form so ellipsis logic at the top level
    // works uniformly.
    if (matchPattern(patTail, formTail, tr.literals, binds, fuel, tr.ellipsis)) {
      const pv = patternVars(rule.pattern, tr.literals, new Set(), tr.ellipsis)
      const binders = collectTemplateBinders(rule.template, pv)
      const rename = new Map()
      for (const b of binders) rename.set(b, gensym(b))
      // Stamp the matched identifiers before they enter the template, so a
      // `syntax-rules` the template GENERATES can still tell them apart from
      // the identifiers the template wrote itself. See the marks note.
      markBinds(binds, freshMark())
      if (useTable) for (const k of Object.keys(binds)) markUseSite(binds[k], useTable)
      return instantiate(rule.template, binds, rename, fuel, tr.ellipsis, false, introducedIds(tr, rule))
    }
  }
  throw new Error(`macro: no syntax-rules clause matched ${useForm[0] && useForm[0].name}`)
}

// ── R7RS §4.2.4 do — built-in desugar ────────────────────────────────────
//
// (do ((var init [step]) ...) (test result ...) body ...)
//   ==>
// (let loop~N ((var init) ...)
//   (if test
//       (begin result ... )                ;; or unspecified if no results
//       (begin body ... (loop~N step ...))))
//
// * `step` is optional per R7RS; when omitted it defaults to `var` (the
//   binding is left unchanged for the next iteration).
// * `result ...` is optional; when absent the loop returns unspecified —
//   R7RS `(if #f #f)`. We emit that literally for the empty-result case.
// * `body ...` is optional; when absent the loop does no per-iteration
//   work aside from the step update and test.
// * The loop name is a fresh gensym so it can't collide with any name
//   the user introduced. Uses the existing hygiene machinery.
function desugarDo(form) {
  // form = [do, bindings, testClause, body...]
  if (!isList(form) || form.length < 3) {
    throw new Error('do: expected (do ((var init step) ...) (test result ...) body ...)')
  }
  const bindings = form[1]
  const testClause = form[2]
  const body = form.slice(3)

  if (!isList(bindings)) {
    throw new Error('do: bindings must be a list')
  }
  if (!isList(testClause) || testClause.length < 1) {
    throw new Error('do: test clause must be (test result ...)')
  }

  const vars = []
  const inits = []
  const steps = []
  for (const b of bindings) {
    if (!isList(b) || b.length < 2 || b.length > 3 || !(b[0] instanceof Sym)) {
      throw new Error('do: each binding must be (var init [step])')
    }
    vars.push(b[0])
    inits.push(b[1])
    // step defaults to var if omitted (R7RS: binding unchanged next iter)
    steps.push(b.length === 3 ? b[2] : b[0])
  }

  const test = testClause[0]
  const results = testClause.slice(1)

  const loopName = gensym('do-loop')

  // (begin result ...) — or the R7RS unspecified sentinel if no results.
  const thenBranch = results.length === 0
    ? [sym('if'), false, false]                  // (if #f #f) — unspecified
    : results.length === 1
      ? results[0]
      : [sym('begin'), ...results]

  // Body iteration: (begin body ... (loop step ...))
  const stepCall = [loopName, ...steps]
  const elseBranch = body.length === 0
    ? stepCall
    : [sym('begin'), ...body, stepCall]

  // Named-let: (let loop~N ((var init) ...) (if test then else))
  const namedLetBindings = vars.map((v, i) => [v, inits[i]])
  return [sym('let'), loopName, namedLetBindings,
          [sym('if'), test, thenBranch, elseBranch]]
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
    const e = expandForm(form, table, f, 0, null)
    if (e !== SKIP) out.push(e)
  }
  return out
}

// Sentinel: a form that fully consumed (a define-syntax) emits nothing.
const SKIP = Symbol('macro-skip')

// ── `include` file resolution ───────────────────────────────────────────
//
// §4.1.7 leaves the meaning of the filename implementation-specific and
// suggests resolving it relative to the file containing the `include`. That
// directory is not knowable from a form, so the caller supplies it:
// `expandProgram(forms, { baseDir })`, which `src/cli.js` sets to the
// directory of the file it is running. A program typed at the REPL has no
// such directory and falls back to the working directory, which is the only
// other place a bare relative name could sensibly mean.
//
// Both candidates go through `safePath`, the same sandbox every other
// file-touching verb in the engine uses — an `include` must not become the
// one door that reads outside the allowed roots.
let _includeBase = null

function readIncluded(who, name, foldCase) {
  const tried = []
  const roots = []
  if (_includeBase) roots.push(_includeBase)
  const candidates = isAbsolute(name)
    ? [name]
    : [_includeBase ? resolve(_includeBase, name) : null, resolve(process.cwd(), name)].filter(Boolean)
  for (const c of candidates) {
    tried.push(c)
    const abs = safePath(c, { verb: who, softFail: true, mustExist: true, roots })
    if (abs === null) continue
    const src = readFileSync(abs, 'utf8')
    return foldCase ? '#!fold-case\n' + src : src
  }
  throw new Error(`${who}: cannot read '${name}' (looked in ${tried.join(', ')})`)
}

function expandForm(form, table, fuel, depth = 0, scope = null) {
  if (--fuel.n < 0) throw new Error('macro fuel exhausted')
  if (depth > MAX_EXPAND_DEPTH) throw new Error('macro expansion too deep — recursive macro?')
  if (!isList(form)) return form
  if (form.length === 0) return form
  const useTable = USE_SITE.get(form)
  if (useTable) table = useTable
  const head = form[0]

  if (head instanceof Sym) {
    // define-syntax — register and emit nothing.
    if (head.name === 'define-syntax') {
      const name = form[1]
      if (!(name instanceof Sym)) throw new Error('define-syntax: name must be an identifier')
      table.set(name.name, compileSyntaxRules(form[2], table, scope))
      return SKIP
    }
    // let-syntax / letrec-syntax — local macros: ((name rules)…) body…
    if (head.name === 'let-syntax' || head.name === 'letrec-syntax') {
      const child = table.child()
      // Only `letrec-syntax` puts the new keywords in scope of each other's
      // templates; a `let-syntax` transformer sees the OUTER bindings.
      const defEnv = head.name === 'letrec-syntax' ? child : table
      const binds = form[1]
      const transformers = []
      if (isList(binds)) {
        for (const b of binds) {
          if (isList(b) && b[0] instanceof Sym) {
            const tr = compileSyntaxRules(b[1], defEnv, scope)
            transformers.push(tr)
            child.set(b[0].name, tr)
          }
        }
      }
      const aliases = aliasFreeTemplateIds(transformers, scope)
      const letBinds = aliases ? [...aliases].map(([name, alias]) => [alias, sym(name)]) : []
      // Expand the body in the child table, then collapse to one form. The
      // body is a <body> (R7RS §4.3.1), so an internal `define` it contains
      // — including one a local macro expanded into — belongs to the
      // let-syntax, not to the enclosing scope: `(let () …)`, not `begin`.
      const inner = scopeWith([sym('let'), letBinds], scope)
      const body = form.slice(2).map((bf) => expandForm(bf, child, fuel, depth + 1, inner)).filter((x) => x !== SKIP)
      if (body.length === 0) return [sym('begin')]
      return [sym('let'), letBinds, ...body]
    }
    // `quote` subtree is data — do not expand inside it.
    if (head.name === 'quote') return form

    // R7RS §4.2.4 `do` — built-in desugaring to named-let (Wave 0, per
    // architect-motoi-core-runtime-completion-2026-07-16 §4 :do-loop).
    // Kept at the macro layer (not interp.js) so the 3B backup base
    // surface stays clean — interpreter core doesn't grow. Runs BEFORE
    // user-macro-table lookup so user shadowing of `do` still works if
    // they explicitly redefine it (rare, but preserved).
    if (head.name === 'do' && !table.has('do')) {
      const rewritten = desugarDo(form)
      const result = expandForm(rewritten, table, fuel, depth + 1, scope)
      const usePos = posOf(form)
      if (usePos) tagPos(result, usePos)
      return result
    }

    // R7RS §4.1.7 `include` / `include-ci`. These read the named files and
    // splice their datums in as if they had been written here — which means
    // they can only happen at EXPAND time: by the time the interpreter sees a
    // form, the question of what is in the program is already settled. That
    // is also why they cannot be procedures, and why `load` (§6.14, a
    // procedure that evaluates at RUN time in whatever environment it is
    // handed) is not a substitute.
    //
    // The included datums are expanded in the SAME macro table as the
    // including form, so a `define-syntax` in an included file is visible to
    // the code after the include — the standard's whole point. `SKIP` is
    // filtered rather than left to the structural walk below, which would
    // turn a consumed `define-syntax` into a stray `()`.
    //
    // `include-ci` differs only in case folding, and the reader already
    // implements exactly that under §7.1.2 `#!fold-case` — so the directive
    // is prepended to the source rather than a second folding path being
    // written and kept in step with the first.
    if ((head.name === 'include' || head.name === 'include-ci') && !table.has(head.name)) {
      const ci = head.name === 'include-ci'
      const body = []
      for (let i = 1; i < form.length; i++) {
        const nameArg = form[i]
        if (typeof nameArg !== 'string' && !(nameArg && nameArg.constructor === String)) {
          throw new Error(`${head.name}: each argument must be a string literal naming a file`)
        }
        const src = readIncluded(head.name, String(nameArg), ci)
        for (const datum of parse(src)) {
          const e = expandForm(datum, table, fuel, depth, scope)
          if (e !== SKIP) body.push(e)
        }
      }
      const out = [sym('begin'), ...body]
      const usePos = posOf(form)
      if (usePos) tagPos(out, usePos)
      return out
    }

    // A macro use — expand, then RE-EXPAND the result (macros can emit
    // macros). Bounded by fuel AND depth. The expanded form inherits the
    // use-site source position so an error in macro-generated code still
    // points at where the operator wrote the macro call.
    if (table.has(head.name)) {
      const tr = table.get(head.name)
      const rewritten = applyTransformer(tr, form, fuel, table)
      const result = expandForm(rewritten, tr.defEnv || table, fuel, depth + 1, scope)
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
  const inner = scopeWith(form, scope)
  const out = form.map((child) => {
    const e = expandForm(child, table, fuel, depth, inner)
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
  // `include` resolves relative to the file being expanded. Saved and
  // restored rather than assigned, so a nested expansion — `load` calls
  // expandProgram from inside a running program — puts the outer file's
  // directory back when it finishes.
  const prevBase = _includeBase
  if (opts.baseDir !== undefined) _includeBase = opts.baseDir ? String(opts.baseDir) : null
  try {
    const expanded = expandTop(forms, { ...opts, fuel })
    return { forms: expanded, fuelUsed: start - fuel.n }
  } finally {
    _includeBase = prevBase
  }
}

export const _internals = Object.freeze({
  MacroTable, gensym, matchPattern, instantiate, applyTransformer,
  compileSyntaxRules, collectTemplateBinders, patternVars,
})
