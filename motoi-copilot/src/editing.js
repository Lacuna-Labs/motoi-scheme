// editing.js — the editing model: address code by CURSOR OFFSET and by FORM.
//
// Alfred: "why can't it do both?" — s-expressions are forms, so we can name a
// piece of code by its structure (the third top-level define; the form named
// `update`) AND by a raw character offset (the caret). This module gives the
// copilot both handles over one buffer. One-human-one-AI local ⇒ no CRDT/OT;
// edits are plain text splices with structural awareness.
//
// Two addressing schemes, one buffer:
//   · offset   — `formAtOffset(buffer, off)` returns the innermost form whose
//                span contains the caret. This is the "held form": the AI routes
//                its propose-diff there (design §editing "ownership").
//   · form     — `findTopForm(buffer, name)` returns the top-level definition of
//                a named thing (define / define-record-type / define-syntax).
//
// Both return a Span { start, end, text, path } so an edit is a splice.

import { parse } from 'motoi-scheme/reader'
import { Sym } from 'motoi-scheme/reader'

const nm = (x) => (x instanceof Sym ? x.name : null)

/**
 * A Span locates a form in the buffer by character range.
 * @typedef {object} Span
 * @property {number} start  inclusive char offset of the opening paren
 * @property {number} end    exclusive char offset just past the closing paren
 * @property {string} text   the exact source of the form
 * @property {number[]} path structural path from the top ([2,0] = 3rd top form,
 *                           its 1st child), for form-addressing
 */

/**
 * scan — tokenize the buffer into a flat list of paren events + atom spans,
 * tracking source offsets. Robust to comments, strings, and char literals so a
 * paren inside a string never miscounts. Returns the top-level form spans and a
 * nested tree so both addressing schemes can be answered.
 * @param {string} buffer
 * @returns {{tops: Span[], tree: Node[]}}
 */
export function scan(buffer) {
  const tops = []
  const rootChildren = []
  const stack = [] // frames: { start, children: [] }
  let i = 0
  const n = buffer.length

  const openForm = () => {
    stack.push({ start: i, children: [] })
  }
  const closeForm = () => {
    const frame = stack.pop()
    const node = {
      start: frame.start,
      end: i + 1, // include the ')'
      children: frame.children,
    }
    if (stack.length === 0) rootChildren.push(node)
    else stack[stack.length - 1].children.push(node)
    return node
  }

  while (i < n) {
    const c = buffer[i]
    if (c === ';') { while (i < n && buffer[i] !== '\n') i++; continue }
    if (c === '"') {
      i++
      while (i < n && buffer[i] !== '"') { if (buffer[i] === '\\') i++; i++ }
      i++; continue
    }
    if (c === '#' && buffer[i + 1] === '\\') {
      i += 2
      if (i < n) i++
      while (i < n && /[A-Za-z0-9]/.test(buffer[i])) i++
      continue
    }
    if (c === '(' || c === '[') { openForm(); i++; continue }
    if (c === ')' || c === ']') { if (stack.length) closeForm(); i++; continue }
    i++
  }
  for (const node of rootChildren) {
    tops.push(nodeToSpan(buffer, node, []))
  }
  return { tops, tree: rootChildren }
}

function nodeToSpan(buffer, node, path) {
  return {
    start: node.start,
    end: node.end,
    text: buffer.slice(node.start, node.end),
    path,
    children: node.children,
  }
}

/**
 * formAtOffset — the innermost form whose span contains `off`. This is the
 * "held form" the AI routes edits to. Returns null if the caret is in
 * top-level whitespace.
 * @param {string} buffer
 * @param {number} off
 * @returns {Span|null}
 */
export function formAtOffset(buffer, off) {
  const { tree } = scan(buffer)
  let best = null
  const descend = (nodes, path) => {
    for (let idx = 0; idx < nodes.length; idx++) {
      const node = nodes[idx]
      if (off >= node.start && off <= node.end) {
        best = nodeToSpan(buffer, node, path.concat(idx))
        descend(node.children, path.concat(idx))
        return
      }
    }
  }
  descend(tree, [])
  if (!best) return null
  // strip children from the returned span for a clean public shape
  return { start: best.start, end: best.end, text: best.text, path: best.path }
}

/**
 * findTopForm — the top-level definition of `name`. Recognizes the define
 * family. Returns the Span, or null.
 * @param {string} buffer
 * @param {string} name
 * @returns {Span|null}
 */
export function findTopForm(buffer, name) {
  const { tops } = scan(buffer)
  let forms
  try { forms = parse(buffer) } catch { return null }
  for (let idx = 0; idx < forms.length; idx++) {
    const f = forms[idx]
    if (definedName(f) === name) {
      const span = tops[idx]
      return span ? { start: span.start, end: span.end, text: span.text, path: [idx] } : null
    }
  }
  return null
}

// The name a top-level form defines, or null.
function definedName(form) {
  if (!Array.isArray(form) || form.length < 2) return null
  const head = nm(form[0])
  if (head === 'define' || head === 'define-syntax') {
    const t = form[1]
    if (t instanceof Sym) return t.name
    if (Array.isArray(t) && t[0] instanceof Sym) return t[0].name // (define (f …) …)
  }
  if (head === 'define-record-type') {
    return nm(form[1])
  }
  return null
}

/**
 * listTopForms — every top-level defined name with its Span. Powers "edit the
 * form named X" navigation and the agentic planner's file map.
 * @param {string} buffer
 * @returns {Array<{name:string|null, span:Span}>}
 */
export function listTopForms(buffer) {
  const { tops } = scan(buffer)
  let forms
  try { forms = parse(buffer) } catch { forms = [] }
  const out = []
  for (let idx = 0; idx < tops.length; idx++) {
    out.push({
      name: forms[idx] ? definedName(forms[idx]) : null,
      span: { ...tops[idx], children: undefined },
    })
  }
  return out
}

/**
 * splice — replace `span` with `replacement`, returning the new buffer + the
 * unified-diff-ready before/after. Pure; the host decides whether to apply.
 * @param {string} buffer
 * @param {Span} span
 * @param {string} replacement
 * @returns {{buffer:string, before:string, after:string, start:number, end:number}}
 */
export function splice(buffer, span, replacement) {
  const before = buffer.slice(span.start, span.end)
  const next = buffer.slice(0, span.start) + replacement + buffer.slice(span.end)
  return { buffer: next, before, after: replacement, start: span.start, end: span.end }
}

/**
 * insertAt — insert text at a caret offset (continuation edits). Returns the
 * new buffer.
 * @param {string} buffer
 * @param {number} off
 * @param {string} text
 * @returns {{buffer:string, at:number, inserted:string}}
 */
export function insertAt(buffer, off, text) {
  const at = Math.max(0, Math.min(off, buffer.length))
  return { buffer: buffer.slice(0, at) + text + buffer.slice(at), at, inserted: text }
}

/**
 * scopeAtOffset — the set of names lexically bound at a caret offset, gathered
 * from the enclosing binding forms (lambda params, let/letrec bindings, defines
 * above the caret). Feeds the RESOLVE gate's `outerScope` so a completion using
 * a let-bound var is not falsely flagged.
 * @param {string} buffer
 * @param {number} off
 * @returns {Set<string>}
 */
export function scopeAtOffset(buffer, off) {
  const scope = new Set()
  // Top-level defines that appear BEFORE the caret are in scope.
  let forms
  try { forms = parse(buffer) } catch { forms = [] }
  const { tops } = scan(buffer)
  for (let idx = 0; idx < forms.length; idx++) {
    const span = tops[idx]
    if (!span || span.start >= off) continue
    const nm2 = definedName(forms[idx])
    if (nm2) scope.add(nm2)
  }
  // Bindings from the enclosing form chain at the caret. We re-scan the held
  // form and add lambda params / let bindings whose body covers the caret.
  const held = formAtOffset(buffer, off)
  if (held) addLexicalBindings(held.text, off - held.start, scope)
  return scope
}

// Walk a form's text, adding binding names introduced by lambda/let/letrec/do
// whose body region covers localOff. Best-effort + generous (over-includes),
// which is the safe direction for a resolve gate.
function addLexicalBindings(text, localOff, scope) {
  let forms
  try { forms = parse(text) } catch { return }
  const visit = (form) => {
    if (!Array.isArray(form)) return
    const head = nm(form[0])
    if (head === 'lambda') {
      for (const p of paramList(form[1])) scope.add(p)
    } else if (head === 'let' || head === 'let*' || head === 'letrec') {
      let binds = form[1]
      if (binds instanceof Sym) { scope.add(binds.name); binds = form[2] } // named let
      if (Array.isArray(binds)) for (const b of binds) if (Array.isArray(b) && b[0] instanceof Sym) scope.add(b[0].name)
    } else if (head === 'do') {
      const specs = form[1]
      if (Array.isArray(specs)) for (const s of specs) if (Array.isArray(s) && s[0] instanceof Sym) scope.add(s[0].name)
    } else if (head === 'define') {
      const t = form[1]
      if (t instanceof Sym) scope.add(t.name)
      else if (Array.isArray(t) && t[0] instanceof Sym) { scope.add(t[0].name); for (const p of paramList(t.slice(1))) scope.add(p) }
    }
    for (const el of form) visit(el)
  }
  forms.forEach(visit)
}

function paramList(params) {
  if (params instanceof Sym) return [params.name]
  if (!Array.isArray(params)) return []
  const out = []
  for (const p of params) { if (p instanceof Sym && p.name !== '.') out.push(p.name) }
  return out
}

export default {
  scan, formAtOffset, findTopForm, listTopForms, splice, insertAt, scopeAtOffset,
}
