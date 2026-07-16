// sakura-scheme — public API surface
//
// This module is the ONLY entry point consumers should import from.
// Everything else in src/ is internal. See PUBLIC-API.md for the full
// list of exported symbols and their contracts.
//
// Consumers pin a SemVer range in their package.json:
//   "sakura-scheme": "^1.4.0"
//
// Then import cleanly:
//   import { parse, evaluate, Env, makeBaseEnv } from 'sakura-scheme'

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

// Introspection surface — what REPL, CLI, docs, and Sakura all read.
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
export const VERSION = '0.1.0'

// NOTE: `dispatch.js` was extracted with the six-file cut but currently
// carries several hard imports of Curator internals (logbus, card-api,
// canvasPower, chipSink, chipEvent, chatChipBus, eventLog,
// correlationContext). Cleanly extracting it requires splitting the
// core dispatcher (~500 LOC) from the Curator-specific security policy
// (~350 LOC). That carve-out is queued as a follow-up sprint; for
// v1.4.0 the file lives in the repo (history preserved per Step (a)
// gate) but is NOT exported from this index. Curator continues to
// import its own copy at curator-web/src/scheme/runtime/dispatch.js.
