// assert.js — lightweight contract/assertion helpers for Motoi.
//
// Created 2026-07-16 from the Sakura->Motoi mapping (top-10 candidate
// #10). Kids and hobbyists writing simulators reach for assertion
// helpers constantly; Motoi has `error` + R7RS `guard`, but no cheap
// `check-with` predicate-assertion or `invariants` block. This module
// fills that gap with three verbs:
//
//   (assert/check-with pred value message)
//     Run `pred` on `value`. If it returns falsy, raise a structured
//     assertion error. If it returns truthy, return `value`.
//
//   (assert/invariants '((pred msg) ...))
//     Run each (pred msg) thunk-pair. Collect ALL failures (not just
//     the first). If any failed, raise a structured multi-failure
//     assertion error; otherwise return #t.
//
//   (assert/audit-verify value spec)
//     Recursively check that `value` matches the structural shape of
//     `spec`. Spec may be a symbol type-tag (number, string, list,
//     symbol, boolean, procedure, any), a list of specs (for element-
//     wise checking), or an alist mapping keys to specs. Returns #t on
//     match; raises a structured assertion error with the failure path
//     on mismatch.
//
// Doctrine (Alfred): the assertions cost pennies at runtime and give
// authors a rung between silent failure and full test suites. They are
// PEDAGOGICAL — a first-year Scheme kid can write `(assert/check-with
// positive? x "must be positive")` before they know `guard`, `raise`,
// or `error-object-*`. The errors they raise are catchable by the
// existing exception machinery (with-exception-handler / guard).

import { Sym } from '../../src/reader.js'
import { ErrorObject } from './r7rs-types.js'
import { apply } from '../../src/interp.js'

const nm = (x) => (x instanceof Sym ? x.name : x)

// ── installer ───────────────────────────────────────────────────────

export function installAssert(env, fuel) {
  const _fuel = fuel ?? { n: 1_000_000 }
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  // ── (assert/check-with pred value message) ────────────────────────
  //
  // Predicate assertion. Cheap runtime cost — one call to `pred`, one
  // truthy test. On failure, raises an ErrorObject whose type is
  // 'assertion-failed and whose irritants carry the offending value +
  // the predicate reference (so handlers can log the actual failure).
  //
  // Truthy result: returns `value` unchanged so this can chain in the
  // middle of an expression:  (let ((n (assert/check-with positive? x "n>0"))) ...)
  def('assert/check-with', (pred, value, message) => {
    if (typeof pred !== 'function') {
      throw new ErrorObject(
        'assert/check-with: pred must be a procedure',
        [pred],
        'assertion-arg-error',
      )
    }
    let result
    try {
      result = apply(pred, [value], _fuel)
    } catch (e) {
      // Predicate itself threw — surface as assertion failure with the
      // inner error message preserved.
      const msg = e && e.message ? String(e.message) : String(e)
      throw new ErrorObject(
        `assert/check-with: predicate threw: ${msg}`,
        [value],
        'assertion-failed',
      )
    }
    if (result === false || result === null || result === undefined) {
      const msg = message == null ? 'assertion failed'
        : (typeof message === 'string' ? message : String(nm(message)))
      throw new ErrorObject(
        `assert/check-with: ${msg}`,
        [value],
        'assertion-failed',
      )
    }
    return value
  })

  // ── (assert/invariants '((pred msg) ...)) ─────────────────────────
  //
  // Run a list of (pred msg) pairs. Each pred is a THUNK (zero-arg
  // procedure) — this lets the caller close over the values they want
  // to check without threading them as args. Collect all failures and
  // report them together, so a testing lane can see the full picture
  // rather than iterate one-by-one.
  //
  // Returns #t if all pass; raises with type 'invariants-failed and
  // irritants = list of ((msg . detail) ...) entries otherwise.
  def('assert/invariants', (pairs) => {
    if (!Array.isArray(pairs)) {
      throw new ErrorObject(
        'assert/invariants: expected a list of (pred msg) pairs',
        [pairs],
        'assertion-arg-error',
      )
    }
    const failures = []
    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i]
      if (!Array.isArray(pair) || pair.length < 1) {
        failures.push([`invariant ${i}: malformed pair`, pair])
        continue
      }
      const pred = pair[0]
      const msg = pair.length > 1
        ? (typeof pair[1] === 'string' ? pair[1] : String(nm(pair[1])))
        : `invariant ${i}`
      if (typeof pred !== 'function') {
        failures.push([msg, `not a procedure: ${String(pred)}`])
        continue
      }
      let ok
      try {
        ok = apply(pred, [], _fuel)
      } catch (e) {
        const em = e && e.message ? String(e.message) : String(e)
        failures.push([msg, `threw: ${em}`])
        continue
      }
      if (ok === false || ok === null || ok === undefined) {
        failures.push([msg, ok])
      }
    }
    if (failures.length === 0) return true
    throw new ErrorObject(
      `assert/invariants: ${failures.length} failure(s)`,
      failures,
      'invariants-failed',
    )
  })

  // ── (assert/audit-verify value spec) ──────────────────────────────
  //
  // Deep audit. Spec grammar:
  //
  //   'any           — always passes
  //   'number        — Number.isFinite(value)
  //   'integer       — Number.isInteger(value)
  //   'string        — typeof value === 'string'
  //   'symbol        — value instanceof Sym
  //   'boolean       — value === true || value === false
  //   'procedure     — typeof value === 'function'
  //   'list          — Array.isArray(value)
  //   'pair          — Array.isArray(value) && value.length >= 1
  //   (list-of spec) — array where every element matches spec
  //   (list spec …)  — array of exact length where each element matches
  //   ((:k spec) …)  — alist / object where each :k has a matching spec
  //
  // Returns #t on match; raises 'audit-failed with irritants =
  // (path expected got) on mismatch. Path is a list of keys/indices
  // walked to reach the failing site.
  def('assert/audit-verify', (value, spec) => {
    const problems = []
    _walk(value, spec, [], problems)
    if (problems.length === 0) return true
    throw new ErrorObject(
      `assert/audit-verify: ${problems.length} mismatch(es)`,
      problems,
      'audit-failed',
    )
  })

  return env
}

// ── shape-check helpers ─────────────────────────────────────────────

function _walk(value, spec, path, problems) {
  // Leaf spec: symbol or string type tag.
  if (spec instanceof Sym || typeof spec === 'string') {
    const tag = String(nm(spec))
    if (!_matchLeaf(value, tag)) {
      problems.push([path.slice(), tag, _describe(value)])
    }
    return
  }
  // Compound spec: array. First element decides the shape.
  if (!Array.isArray(spec)) {
    // Unknown spec form — refuse to guess.
    problems.push([path.slice(), 'unknown-spec', _describe(spec)])
    return
  }
  if (spec.length === 0) {
    // Empty spec matches only the empty list.
    if (!Array.isArray(value) || value.length !== 0) {
      problems.push([path.slice(), 'empty-list', _describe(value)])
    }
    return
  }
  const head = spec[0]
  const headTag = (head instanceof Sym || typeof head === 'string')
    ? String(nm(head)) : null

  if (headTag === 'list-of') {
    if (!Array.isArray(value)) {
      problems.push([path.slice(), 'list', _describe(value)])
      return
    }
    const elSpec = spec[1]
    for (let i = 0; i < value.length; i++) {
      _walk(value[i], elSpec, path.concat(i), problems)
    }
    return
  }
  if (headTag === 'list') {
    // (list spec1 spec2 ...) — fixed-length list, position-wise.
    const inner = spec.slice(1)
    if (!Array.isArray(value)) {
      problems.push([path.slice(), 'list', _describe(value)])
      return
    }
    if (value.length !== inner.length) {
      problems.push([path.slice(), `list-length-${inner.length}`, `list-length-${value.length}`])
      return
    }
    for (let i = 0; i < inner.length; i++) {
      _walk(value[i], inner[i], path.concat(i), problems)
    }
    return
  }
  // Otherwise treat as alist spec: ((key spec) (key spec) ...)
  // Each entry is expected to be a 2-element array [key, spec].
  for (let i = 0; i < spec.length; i++) {
    const entry = spec[i]
    if (!Array.isArray(entry) || entry.length !== 2) {
      problems.push([path.slice(), 'alist-entry', _describe(entry)])
      continue
    }
    const key = entry[0]
    const subSpec = entry[1]
    const found = _alistLookup(value, key)
    if (found === _MISSING) {
      problems.push([path.slice(), `key:${String(nm(key))}`, 'missing'])
      continue
    }
    _walk(found, subSpec, path.concat(String(nm(key))), problems)
  }
}

const _MISSING = Object.freeze({ __missing: true })

function _alistLookup(value, key) {
  if (!Array.isArray(value)) return _MISSING
  const keyName = String(nm(key))
  for (const entry of value) {
    if (!Array.isArray(entry) || entry.length < 1) continue
    const k = entry[0]
    if (String(nm(k)) === keyName) {
      return entry.length > 1 ? entry[1] : true
    }
  }
  return _MISSING
}

function _matchLeaf(value, tag) {
  switch (tag) {
    case 'any':       return true
    case 'number':    return typeof value === 'number' && Number.isFinite(value)
    case 'integer':   return typeof value === 'number' && Number.isInteger(value)
    case 'string':    return typeof value === 'string'
    case 'symbol':    return value instanceof Sym
    case 'boolean':   return value === true || value === false
    case 'procedure': return typeof value === 'function'
    case 'list':      return Array.isArray(value)
    case 'pair':      return Array.isArray(value) && value.length >= 1
    default:          return false   // unknown tag → mismatch, not silent pass
  }
}

function _describe(v) {
  if (v === null || v === undefined) return 'null'
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number'
  if (typeof v === 'string') return 'string'
  if (typeof v === 'boolean') return 'boolean'
  if (typeof v === 'function') return 'procedure'
  if (v instanceof Sym) return 'symbol'
  if (Array.isArray(v)) return 'list'
  return typeof v
}

export default installAssert
