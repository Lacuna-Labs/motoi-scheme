# Motoi Scheme — Public API

The surface consumers may touch. Everything else in `src/` is internal.

## Named exports from `motoi-scheme`

Import path: `motoi-scheme` (from the top of `src/index.js`).

### Reader

- `parse(source: string) : SExpr[]` — tokenize + parse Scheme source into an S-expression list.
- `posOf(node)` — recover source-position metadata for an AST node.
- `clearParseCache()` — flush the LRU parse cache.
- `ReadError` — the error class thrown on syntactic failure.

### Interpreter

- `evaluate(expr, env) : any` — evaluate one AST node in an environment.
- `apply(fn, args) : any` — call a scheme function.
- `Env` — environment class.
- `Closure` — closure class.
- `Sym` — symbol type.

### Base library

- `makeBaseEnv() : Env` — build a fresh environment with all base verbs registered.

### Macros

- `expandProgram(exprs, env)` — expand hygienic and non-hygienic macros over a program.
- `MacroTable` — macro-registration table type.

### Verb registry

- `registerPrimitive(spec)` — register a verb with metadata `{ name, arity, contract, doc, examples, atom, tier, perm, namespace, since, impl }`.
- `getVerbMeta(name)` — retrieve verb metadata.
- `snapshotRegistry() : object` — snapshot the whole registry.
- `validateRegistry() : Warning[]` — validate + report gaps.
- `defaultMetaFor(name)` — construct a default metadata blob for a name.
- `CANONICAL_CHIP_KINDS`, `CANONICAL_PERMS`, `CANONICAL_POWER_TIERS` — enumerated constants.

### Introspection

- `help(sym) : Meta` — full help record for a symbol.
- `describe(sym)`, `typeOf(sym)`, `arityOf(sym)`, `docOf(sym)`, `sourceOf(sym)` — narrow accessors.
- `allVerbs() : string[]` — enumerate registered verbs.

### REPL

- `startRepl(env, options)` — boot the interactive REPL.

### Docs emitter

- `emitDocs({ outDir, inline })` — emit MD reference from the live registry.

### SLAT

- `slatLoads(text)`, `slatDumps(obj)` — parse / stringify SLAT.
- `slatToJsonl(records)`, `jsonlToSlat(records)` — convert between SLAT and JSONL.

### SLAT verbs

- `installSlatVerbs(env)` — register the SLAT verbs into an environment.
- `SLAT_VERBS_META` — metadata for the installed set.

### Constant

- `VERSION` — the interpreter version string (currently `0.1.0`).

## Not yet exported

The following exist in `src/` but are held internal pending rework:

- `dispatch.js` — the five-gate dispatcher. Currently carries hard imports of Curator internals (logbus, card-api, canvasPower, chipSink, chipEvent, chatChipBus, eventLog, correlationContext). A carve-out separating the core dispatcher (~500 LOC) from the Curator-specific security policy (~350 LOC) is queued as a follow-up. Do not import this file from user code today.

## Test resets (dev only)

- `__resetGensym()`, `__resetRegistry()`, `__resetMissingPermWarnings()` — internal helpers for testing.

## Stability

- Semantic versioning applies to the exports above.
- Anything under `src/` that is NOT listed above is considered internal and may change without notice.

## See also

- `Scheme/MOTOI-SCHEME-REFERENCE.slat` — the canonical language reference. When code and reference disagree, the reference wins.
- `Spec/dialect.slat` — the dialect schema each fork declares against.
- `CLAUDE.md` — per-repo agent guidance.
