// registry-oracle.js — the RESOLVE authority (Gate 2 of the non-hallucination
// pipeline).
//
// The single defensible edge of the Motoi copilot: it CANNOT ghost an unbound
// verb, because Motoi has a LOCKED parts-registry and every symbol a suggestion
// mentions is checked against it before the suggestion is ever shown.
//
// "Resolvable" means one of:
//   1. a registered verb        — the parts-registry (verbRegistry.snapshotRegistry)
//   2. a special form           — handled directly by the interpreter switch
//   3. a macro / syntax keyword  — expanded by the macro pass
//   4. a locally-bound symbol    — a lambda param, let/letrec binding, define,
//                                   named-let loop var, do var, or record field
//                                   accessor introduced by the suggestion itself
//   5. a self-evaluating atom    — number, string, boolean, char, keyword (:foo),
//                                   the quote family, `#!default`, etc.
//
// (1)–(3) are the FIXED language surface, gathered once from a live env. (4) is
// computed per-form by a lexical-scope walk so we never reject a symbol the
// suggestion legitimately introduces. This is what lets the copilot complete
// `(let ((n 5)) ▮)` with `n` without calling `n` unbound.
//
// The oracle depends ONLY on the motoi-scheme public API (snapshotRegistry,
// makeExtendedBaseEnv). It reaches nothing else.

import { snapshotRegistry } from 'motoi-scheme/registry'
import { makeExtendedBaseEnv } from 'motoi-scheme'
import { Sym } from 'motoi-scheme/reader'

// ── The fixed language surface beyond the verb registry ──────────────────
//
// Special forms are dispatched by the interpreter's own switch — they are NOT
// registry verbs (snapshotRegistry does not list them). Mirrors the `case`
// arms in src/interp.js exactly (verified 2026-07-26). If the interpreter
// grows a special form, add it here; the test suite asserts the two stay in
// sync via a live probe.
export const SPECIAL_FORMS = Object.freeze(new Set([
  'and', 'begin', 'case', 'cond', 'define', 'define-record-type', 'delay',
  'do', 'guard', 'if', 'lambda', 'let', 'let-values', 'let*', 'let*-values',
  'letrec', 'or', 'quasiquote', 'quote', 'set!', 'unless', 'when',
]))

// Syntax keywords owned by the macro pass (src/macro.js). `syntax-rules`
// literals like `else`, `=>`, `_`, `...` are pattern syntax, never call heads.
export const SYNTAX_KEYWORDS = Object.freeze(new Set([
  'define-syntax', 'let-syntax', 'letrec-syntax', 'syntax-rules',
  'else', '=>', '_', '...', 'unquote', 'unquote-splicing',
]))

// Heads that BIND names into a nested scope. Value = a describer of where the
// bound names live in the form, consumed by `collectBindings`.
//   'params'    — (lambda PARAMS body…) — PARAMS may be a list or dotted/rest
//   'bindings'  — (let ((n v)…) body…) — each (name val)
//   'named-let' — (let loop ((n v)…) body…) — loop name + bindings
//   'define'    — (define name …) or (define (f a b) …)
//   'do'        — (do ((v init step)…) …)
//   'letvals'   — (let-values (((a b) expr)…) …)
//   'record'    — (define-record-type name (ctor f…) pred (field get set)…)
const BINDING_HEADS = Object.freeze({
  lambda: 'params',
  let: 'let',            // may be plain or named
  'let*': 'bindings',
  letrec: 'bindings',
  'let-values': 'letvals',
  'let*-values': 'letvals',
  define: 'define',
  do: 'do',
  'define-record-type': 'record',
  guard: 'guard',        // (guard (var clause…) body…)
})

const nm = (x) => (x instanceof Sym ? x.name : (typeof x === 'string' ? x : null))

// ── The oracle ───────────────────────────────────────────────────────────

export class RegistryOracle {
  /**
   * @param {object} [opts]
   * @param {Set<string>} [opts.verbs]  Pre-supplied verb-name set. When omitted
   *   the oracle builds a live extended env and snapshots the registry. Passing
   *   a set is the fast path for hosts that already hold one (and lets a
   *   downstream dialect / Curator inject its own layered registry — the
   *   registry is the registry).
   */
  constructor(opts = {}) {
    if (opts.verbs instanceof Set) {
      this.verbs = opts.verbs
    } else {
      // Build a live env so the registry is fully populated (installing every
      // lib registers its verbs). One-time cost; cache the snapshot.
      makeExtendedBaseEnv()
      this.verbs = new Set(Object.keys(snapshotRegistry()))
    }
  }

  /** Total resolvable head-symbols the oracle knows (registry ∪ forms ∪ syntax). */
  get size() {
    return this.verbs.size + SPECIAL_FORMS.size + SYNTAX_KEYWORDS.size
  }

  /**
   * knows — is this name resolvable at the global/language surface, ignoring
   * local scope? (registry verb, special form, or syntax keyword.)
   */
  knows(name) {
    const n = nm(name)
    if (n == null) return false
    return this.verbs.has(n) || SPECIAL_FORMS.has(n) || SYNTAX_KEYWORDS.has(n)
  }

  /**
   * unresolved — walk a parsed FORM (JS array/Sym tree from the reader) and
   * return every symbol that is neither globally resolvable NOR locally bound
   * by the form's own lexical structure. The list is the exact reason a
   * suggestion would fail to run. Empty ⇒ RESOLVE gate passes.
   *
   * @param {*} form   a single parsed form (or forms array)
   * @param {Set<string>} [outerScope] names bound by an enclosing context
   *   (e.g. the prefix the completion lives inside). Optional.
   * @returns {string[]} unresolved symbol names (deduped, in first-seen order)
   */
  unresolved(form, outerScope = new Set()) {
    const bad = new Map() // name -> true, preserving first-seen order
    this._walk(form, outerScope, bad)
    return [...bad.keys()]
  }

  // Recursively walk `form` collecting symbols in *head or argument* position
  // that resolve to nothing. `scope` is the set of locally-bound names visible
  // here. New bindings introduced by a binding-head extend `scope` for the
  // parts of the form they cover.
  _walk(form, scope, bad) {
    if (Array.isArray(form)) {
      if (form.length === 0) return
      const head = nm(form[0])

      // quote / quasiquote: quoted data is not code — its symbols are literals.
      if (head === 'quote') return
      if (head === 'quasiquote') { this._walkQuasi(form[1], scope, bad, 0); return }

      // Binding heads extend scope for their body.
      const kind = head != null ? BINDING_HEADS[head] : null
      if (kind) { this._walkBinding(kind, form, scope, bad); return }

      // Ordinary application: head must resolve, then every argument is code.
      for (const el of form) this._walk(el, scope, bad)
      return
    }

    // Atom.
    if (form instanceof Sym) {
      const n = form.name
      if (isSelfEvaluatingSymbol(n)) return
      if (scope.has(n)) return
      if (this.knows(n)) return
      bad.set(n, true)
      return
    }
    // number / string / boolean / char / bytevector / vector-of-atoms: literal.
    // (Vectors are SchemeVector objects; their contents are data, not code.)
  }

  // quasiquote walk: only `unquote` / `unquote-splicing` sub-parts are code.
  _walkQuasi(node, scope, bad, depth) {
    if (Array.isArray(node)) {
      const head = nm(node[0])
      if (head === 'unquote' || head === 'unquote-splicing') {
        if (depth === 0) { this._walk(node[1], scope, bad); return }
        this._walkQuasi(node[1], scope, bad, depth - 1)
        return
      }
      if (head === 'quasiquote') { this._walkQuasi(node[1], scope, bad, depth + 1); return }
      for (const el of node) this._walkQuasi(el, scope, bad, depth)
    }
    // atoms inside quasiquote are literal data unless unquoted (handled above)
  }

  _walkBinding(kind, form, scope, bad) {
    switch (kind) {
      case 'params': {
        // (lambda PARAMS body…)
        const inner = extendScope(scope, paramNames(form[1]))
        for (let i = 2; i < form.length; i++) this._walk(form[i], inner, bad)
        return
      }
      case 'let': {
        // plain (let ((n v)…) body…) OR named (let loop ((n v)…) body…)
        if (form[1] instanceof Sym) {
          // named let: the loop name is bound in the body; bindings' inits are
          // evaluated in the OUTER scope; body sees loop-name + binding names.
          const loopName = form[1].name
          const binds = form[2] || []
          for (const b of iterBindings(binds)) this._walk(b.val, scope, bad)
          const names = [loopName, ...bindingNames(binds)]
          const inner = extendScope(scope, names)
          for (let i = 3; i < form.length; i++) this._walk(form[i], inner, bad)
          return
        }
        // plain let: inits in outer scope, body in extended scope.
        const binds = form[1] || []
        for (const b of iterBindings(binds)) this._walk(b.val, scope, bad)
        const inner = extendScope(scope, bindingNames(binds))
        for (let i = 2; i < form.length; i++) this._walk(form[i], inner, bad)
        return
      }
      case 'bindings': {
        // let* / letrec: for our resolve purposes, treat all binding names as
        // visible to every init (letrec semantics) — a strict SUPERSET, so we
        // never false-flag. Inits + body walked in the extended scope.
        const binds = form[1] || []
        const inner = extendScope(scope, bindingNames(binds))
        for (const b of iterBindings(binds)) this._walk(b.val, inner, bad)
        for (let i = 2; i < form.length; i++) this._walk(form[i], inner, bad)
        return
      }
      case 'letvals': {
        // (let-values (((a b) expr) (c expr2)) body…)
        const clauses = form[1] || []
        const names = []
        for (const cl of clauses) {
          if (!Array.isArray(cl)) continue
          names.push(...paramNames(cl[0]))
          this._walk(cl[1], scope, bad) // producer expr in outer scope
        }
        const inner = extendScope(scope, names)
        for (let i = 2; i < form.length; i++) this._walk(form[i], inner, bad)
        return
      }
      case 'define': {
        // (define name expr)  OR  (define (f a b . rest) body…)
        const target = form[1]
        if (target instanceof Sym) {
          // value define — name visible to its own init (letrec-ish) + siblings.
          const inner = extendScope(scope, [target.name])
          for (let i = 2; i < form.length; i++) this._walk(form[i], inner, bad)
          return
        }
        if (Array.isArray(target)) {
          const fnName = nm(target[0])
          const params = paramNames(target.slice(1))
          const inner = extendScope(scope, [fnName, ...params].filter(Boolean))
          for (let i = 2; i < form.length; i++) this._walk(form[i], inner, bad)
          return
        }
        return
      }
      case 'do': {
        // (do ((v init step)…) (test expr…) body…)
        const specs = form[1] || []
        const names = []
        for (const s of specs) {
          if (!Array.isArray(s)) continue
          const vn = nm(s[0]); if (vn) names.push(vn)
          if (s[1] !== undefined) this._walk(s[1], scope, bad) // init: outer
        }
        const inner = extendScope(scope, names)
        // steps + test + body see the loop vars
        for (const s of specs) {
          if (Array.isArray(s) && s[2] !== undefined) this._walk(s[2], inner, bad)
        }
        for (let i = 2; i < form.length; i++) this._walk(form[i], inner, bad)
        return
      }
      case 'record': {
        // (define-record-type NAME (ctor f…) pred (field get [set])…)
        // Binds: the type name, ctor, pred, and every accessor/mutator.
        const names = []
        const typeName = nm(form[1]); if (typeName) names.push(typeName)
        const ctor = form[2]
        if (Array.isArray(ctor) && ctor[0]) { const c = nm(ctor[0]); if (c) names.push(c) }
        const pred = nm(form[3]); if (pred) names.push(pred)
        for (let i = 4; i < form.length; i++) {
          const fspec = form[i]
          if (!Array.isArray(fspec)) continue
          // (field-name accessor [mutator]) — accessor+mutator become verbs.
          for (let j = 1; j < fspec.length; j++) { const a = nm(fspec[j]); if (a) names.push(a) }
        }
        // Field references inside the definition are the field TAGS, not code.
        extendScope(scope, names) // (record forms introduce top-level names)
        // Nothing further to walk as code in a well-formed record def.
        return
      }
      case 'guard': {
        // (guard (var clause…) body…)
        const spec = form[1] || []
        const varName = nm(spec[0])
        const inner = extendScope(scope, varName ? [varName] : [])
        for (let i = 1; i < spec.length; i++) this._walk(spec[i], inner, bad)
        for (let i = 2; i < form.length; i++) this._walk(form[i], scope, bad)
        return
      }
      default:
        for (const el of form) this._walk(el, scope, bad)
    }
  }
}

// ── scope helpers ──────────────────────────────────────────────────────────

function extendScope(scope, names) {
  const out = new Set(scope)
  for (const n of names) if (n) out.add(n)
  return out
}

// (lambda) params: a Sym (rest arg), a proper list of Syms, or an
// improper/dotted list ((a b . rest)). Returns all bound names.
export function paramNames(params) {
  if (params instanceof Sym) return [params.name]
  if (!Array.isArray(params)) return []
  const out = []
  for (const p of params) {
    if (p instanceof Sym) {
      if (p.name === '.') continue           // dotted-tail marker
      out.push(p.name)
    } else if (Array.isArray(p) && p[0] instanceof Sym) {
      // optional-with-default shapes; take the name.
      out.push(p[0].name)
    }
  }
  return out
}

// Iterate ((name val) …) binding lists, yielding {name, val}. Tolerant of
// partially-typed bindings (a half-written (n ) during completion).
function* iterBindings(binds) {
  if (!Array.isArray(binds)) return
  for (const b of binds) {
    if (!Array.isArray(b)) continue
    const name = nm(b[0])
    yield { name, val: b.length > 1 ? b[1] : undefined }
  }
}

function bindingNames(binds) {
  const out = []
  for (const b of iterBindings(binds)) if (b.name) out.push(b.name)
  return out
}

// A symbol that stands for a literal, not a lookup.
function isSelfEvaluatingSymbol(n) {
  if (typeof n !== 'string' || n.length === 0) return false
  // Keywords (:foo) self-evaluate as symbols in Motoi's plist idiom.
  if (n[0] === ':') return true
  // The empty-ish sentinels the reader may hand back.
  if (n === '.') return true
  return false
}

export default RegistryOracle
