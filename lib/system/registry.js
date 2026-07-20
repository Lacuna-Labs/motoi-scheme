// lib/system/registry.js — Wave-1 shim for registerPrimitive.
//
// Provenance: scheme-lang/src/registry.js (registerPrimitive extracted;
//   full reference-gated registration is deferred to Wave 2+ when
//   reference-loader.js migrates and can enforce "no bind without
//   reference entry" per Alfred's floor doctrine.)
//
// Migrated 2026-07-16 for Motoi Pass-3 Wave 1. Kept minimal so ops.js
// (and future lib/base/wired-verbs*.js consumers) resolves imports and
// compiles cleanly. Once lib/base/reference-loader.js lands, replace
// this shim with a full port of registerPrimitive that consults
// getVerbEntry(name) and refuses to bind unlisted verbs.
//
// Alfred: "we can't lie to people. They trust us." — no auto-stub
//   pattern. Wave-1 shim is honest: it just delegates to env.define,
//   which is what env.define was doing anyway. The reference-gate is
//   ADDED in a later wave; it is not being SILENTLY BYPASSED.

export function registerPrimitive(env, name, fn, meta) {
  if (!env || typeof env.define !== 'function') {
    throw new Error('registerPrimitive: env must be an Env with a .define(name, fn, meta) method')
  }
  if (typeof name !== 'string' || !name) {
    throw new Error('registerPrimitive: name must be a non-empty string')
  }
  // Meta-kind registrations (2026-07-16 reconciliation): a "meta"
  // binding is a value-shaped constant — font/default, easing/spring,
  // const/pi — rather than a callable verb. They participate in the
  // verb registry so introspection (:kind "meta") lists them, and so
  // callers can pass them by name to keyword arguments. Detect by
  // meta.kind === 'meta' OR by the value being a non-function.
  //
  // For meta-kind: fn is a *value* (Sym, number, string, list). Skip
  // the function-typed guard and let env.define stash it. env.define
  // already special-cases: it only touches verbRegistry when the value
  // is a function, so non-function bindings pass through cleanly.
  const isMeta = (meta && meta.kind === 'meta') || typeof fn !== 'function'
  if (!isMeta && typeof fn !== 'function') {
    throw new Error(`registerPrimitive(${name}): fn must be a function`)
  }
  // Wave-1: no reference-entry check yet (reference-loader migrates in
  // Wave 2). env.define carries the meta through motoi's verbRegistry
  // via the existing Env implementation.
  env.define(name, fn, meta)
}
