// motoi-scheme — public API surface
//
// This module is the ONLY entry point consumers should import from.
// Everything else in src/ is internal. See PUBLIC-API.md for the full
// list of exported symbols and their contracts.
//
// Consumers pin a SemVer range in their package.json:
//   "motoi-scheme": "^0.1.0"
//
// Then import cleanly:
//   import { parse, evaluate, Env, makeExtendedBaseEnv } from 'motoi-scheme'

// Reader — tokenizer + parser + source-position map.
export {
  Sym,
  sym,
  posOf,
  tagPos,
  ReadError,
  tokenize,
  parse,
  clearParseCache,
  parseCacheStats,
} from './reader.js'

// Interpreter — evaluator, env, closure, TCO trampoline, fuel budget.
export {
  Env,
  Closure,
  evaluate,
  apply,
  __resetMissingPermWarnings,
} from './interp.js'

// Base library — 80+ primitives (arithmetic, list, string, R7RS subset).
export { makeBaseEnv } from './base.js'

// Extended base — makeBaseEnv + lib/* installers (media, game, ai,
// system, r7rs-small, alg, sprite, eng, time, ops). Consumers that
// want to actually run the reference examples (audio/play, entity/*,
// scene/*, draw verbs) should reach for this instead of makeBaseEnv.
export { makeExtendedBaseEnv, installLibs, getMediaState } from './lib-loader.js'

// CORE-first — Phase 1 of the CORE-vs-MODULE restructure (Alfred lock
// 2026-07-16). makeCoreEnv installs the 322-verb CORE partition and
// nothing else. Modules load on demand via (import (motoi ...)) — see
// modules/*/MANIFEST.slat. isCore(name) and coreCoverage(env) are
// introspection helpers for docs-emitter and the RAG lookup layer.
export { installCore, makeCoreEnv, CORE_VERBS, coreCoverage, isCore } from './lib-loader.js'

// Macros — hygienic syntax-rules + define-macro.
export {
  MacroTable,
  expandTop,
  expandProgram,
  __resetGensym,
} from './macro.js'

// Verb registry — metadata format + validation.
export {
  CANONICAL_PERMS,
  CANONICAL_POWER_TIERS,
  CANONICAL_CHIP_KINDS,
  defaultMetaFor,
  registerVerbMeta,
  getVerbMeta,
  hasVerb,
  validateRegistry,
  snapshotRegistry,
  __resetRegistry,
} from './verbRegistry.js'

// Introspection surface — what REPL, CLI, docs, and downstream dialects all read.
export {
  help,
  describe,
  typeOf,
  arityOf,
  docOf,
  sourceOf,
} from './introspect.js'

// REPL — interactive session machinery + meta-command dispatch.
export { startRepl } from './repl.js'

// Doc emitter — verb metadata → Markdown reference pages.
export { emitDocs } from './docs-emitter.js'

// Slat — line-delimited S-expression serialization (mirrors bindings/python).
export {
  slatLoads,
  slatDumps,
  slatToJsonl,
  jsonlToSlat,
} from './slat.js'

// Slat verbs — the Book-of-SLAT primitive set wired into the base env.
// `installSlatVerbs(env)` is the seam consumers use when they build an
// env by hand instead of calling `makeBaseEnv` (which already installs
// them). `SLAT_VERBS_META` exports the metadata roster for doc emitters
// and RAG indexers.
export {
  installSlatVerbs,
  SLAT_VERBS_META,
} from './slat-verbs.js'

// Version pin. Consumers can check at runtime:
//   import { VERSION } from 'motoi-scheme'
//   if (VERSION.split('.')[0] !== '0') throw new Error('expected motoi-scheme@0.x')
export const VERSION = '0.75.0-beta'

// Dispatcher — the parse → gate → run chokepoint. Ships hermetic with
// no-op sinks; a dialect wires its own audit-bus / chip queue / event
// log via `installDispatchHooks({...})` before the first dispatch.
// See src/dispatch.js for the seam surface.
export {
  dispatchScheme,
  walkVerbCalls,
  TIER_PERMS,
  AUDIT_LINE_KEYS,
  installDispatchHooks,
  resetDispatchHooks,
  currentDispatchCaller,
  currentCorrelationId,
  mintCorrelationId,
  withCorrelation,
  __resetRateBuckets,
  __setPowerTierReader,
} from './dispatch.js'
