# Fork Lane 1 — The Language-Move Mechanism (repo/engine level)

RESEARCH ONLY. Findings verified by reading both repos + THE-PLAN. Date 2026-07-27.

## The one fact that reframes everything

**Sakura is the parent; Motoi is the fork.** Motoi's git history bottoms out at
`852385c "Initial Motoi Scheme extraction from sakura-scheme (first pass)"` (2026-07-16).
Sakura's history runs 179 commits back through Curator (v2.x). Motoi's CLAUDE.md says
"Extracted 2026-07-16 from ~/code/sakura-scheme/". So the direction is Sakura → Motoi,
and THE-PLAN §3.2 *always* named `~/code/sakura-scheme/` as THE engine repo. Alfred's
"move Motoi→Sakura" is really "promote the more-finished FORK back onto the canonical
engine repo name." Not a new idea — a reconciliation with the original plan.

## 1. What's actually in each language core

Both `src/` dirs are the SAME 14-file engine skeleton (same filenames: reader, interp,
base, macro, dispatch, index, cli, repl, verbRegistry, slat-verbs, introspect,
docs-emitter, slat, lib-loader). Same public export list in index.js (near-identical).

Motoi is the more complete engine and has diverged/grown:
- Motoi src total **6922 LOC** vs Sakura **5826 LOC**.
- base.js 1014 vs 881 · interp.js 792 vs 633 · reader.js 313 vs 232 · repl.js **870 vs 319**
  · cli.js **480 vs 175**. Motoi's REPL/CLI are 2.5-3x richer.
- Motoi adds `core/` (core-verbs, verb-manifest, parts-registry — the CORE-vs-MODULE
  322-verb partition), `modules/` (17 loadable modules), `rosetta/` (dialect compat),
  and a locked R7RS+SRFI standard-library discipline. Motoi is NOT a stub or a copy —
  it is the same engine carried further.
- Sakura's src carries the Curator/Sakura DIALECT layer inside the engine repo:
  `src/lib/dialect/{card,shop,flower,cortex,marketplace,surface}` + `src/lib/marionette`
  (198 verbs). Motoi keeps the base hermetic and pushes dialect verbs to consumers.

Verdict: **Motoi = the better/finished engine. Sakura = the correct name + the real
consumer wiring + the dialect surface.** They are siblings; Motoi is ahead on the core.

## 2. Fork vs move — the operation

Three options considered:
- (a) git filter-repo / subtree to preserve history — **breaks**: Motoi and Sakura share
  ZERO commit hashes (Motoi was squash-extracted, 22 commits). There's no common ancestor
  to graft onto; a subtree merge would just paste Motoi's 22-commit tree as a foreign root.
- (b) rename motoi-scheme repo → sakura-scheme — **breaks** the CONSUMERS: 3 live
  consumers (Curator, Lacuna, Gastronomy) pin `sakura-scheme@^1.4.0` and the GitHub repo
  URL. Renaming the wrong-named repo orphans them.
- (c) copy Motoi's engine INTO the existing sakura-scheme repo and reconcile — **RIGHT.**
  The sakura-scheme repo is the one consumers already pin; keep it as the home, overwrite
  its `src/` engine files with Motoi's (superset), keep Sakura's `src/lib/dialect/*` +
  `marionette` + `CONSUMERS.md` + `CHANGELOG.md` + package name/version line.

Mechanism (in sakura-scheme, on a branch):
```
# from a Motoi checkout, copy the engine core (NOT dialect verbs):
cp motoi-scheme/src/{reader,interp,base,macro,verbRegistry,introspect,repl,cli,
   docs-emitter,slat,slat-verbs,lib-loader}.js  sakura-scheme/src/
cp -r motoi-scheme/core sakura-scheme/src/core
cp -r motoi-scheme/modules sakura-scheme/modules
cp -r motoi-scheme/rosetta sakura-scheme/rosetta
# reconcile index.js exports; keep Sakura's installSakuraDialect + adapters exports;
# reconcile dispatch.js (both have the Curator-coupling carve-out still pending)
```
History: accept that Motoi's engine history does not merge cleanly; preserve it by
tagging Motoi's final commit and referencing it in the CHANGELOG ("engine replaced by
Motoi @22bf58b"). Do NOT filter-repo — it won't stitch.

## 3. Backwards-compat surface

"Behave exactly as now" = the frozen public API in both PUBLIC-API.md / index.js — these
are already near-identical (parse, evaluate, Env, Closure, makeBaseEnv,
makeExtendedBaseEnv, macro table, verb registry, introspection, REPL, docs, slat). Motoi
is a SUPERSET (adds installCore/makeCoreEnv/CORE_VERBS, dispatch exports). So consumers
importing the Sakura surface keep working IF Motoi's index.js re-exports Sakura's names.
Pins to reconcile (CONSUMERS.md): Curator ^1.4.0 (148k LOC verb layer), Lacuna ^1.4.0,
Gastronomy ^1.4.0 (reader-only), Forge (optional). The move must ship as sakura-scheme
**v1.5.0 (minor, additive)** — NOT a name change from the consumer's view.

## 4. Standardization deltas

- Version identity: Motoi package 0.75.0-beta / dialect.slat says 0.1.0; Sakura 1.4.0.
  Landing spot = sakura-scheme 1.5.x. VERSION string must be reconciled (Motoi's internal
  VERSION const is '0.75.0-beta').
- Std library: Motoi LOCKED R7RS-small + SRFI-1/13/125/27, conformance ladder, broken-
  examples. Sakura's base.js predates that lock (125 primitives, some dup aliases). The
  move imports Motoi's standardized base — this IS the "things change a bit" Alfred meant.
- Namespaces: Motoi keeps base hermetic (dialect verbs live in consumers per THE-PLAN
  §3.3). Sakura currently ships card/shop/flower/cortex/surface/marketplace + marionette
  INSIDE the engine repo. Reconciliation must decide: keep Sakura's dialect libs as an
  opt-in `installSakuraDialect` (already the seam) layered on Motoi's hermetic base.
- License mismatch: Motoi Apache-2.0 vs Sakura MIT — must pick one (THE-PLAN §3.7 says MIT).
- dispatch.js: BOTH still carry the un-carved Curator coupling (logbus, card-api, etc.).
  Pre-existing debt, not caused by the move; carry it forward as-is.

## 5. Prior planning

THE-PLAN Ch.3 already decided ALL of this: one engine, sakura-scheme is the engine repo
(§3.2), MIT license + npm name reserved (§3.7), consumers pin SemVer, dialect verbs stay
in consumers (§3.3), additive-by-default versioning (§3.9). The engine-extraction sequence
(§3.6) was written for Curator→sakura; it does NOT anticipate a Motoi side-fork. What the
new framing CHANGES: instead of extracting the engine from Curator, we swap in Motoi's
already-further engine as the sakura-scheme core. rosetta/dialect.slat is the deterministic
adapter mechanism (refuses/modifies/adopts/adds) — Motoi declares itself the base with no
parent; a proper Sakura dialect.slat (parent="motoi") is the "wire up her words" step
Alfred described. rosetta is a spec + empty adapters/tags dirs — the compat COMPILER is
designed, not yet built.

---
RECOMMENDATION: **This is a MOVE, not a fork — mechanism (c): copy Motoi's superset engine
into the existing sakura-scheme repo, ship as sakura-scheme v1.5.0 (minor/additive), keep
Sakura's name+consumers+dialect layer, layer dialect verbs on Motoi's hermetic base via the
existing installSakuraDialect seam. Do NOT git filter-repo (no shared ancestry to graft).**

OPEN QUESTIONS FOR ALFRED:
- License: Motoi Apache-2.0 vs Sakura MIT — THE-PLAN says MIT. Confirm MIT?
- Motoi's git history (22 squashed commits) can't merge into Sakura's tree. OK to lose it
  and reference by tag/CHANGELOG, or do you want a preserved-history graft attempt?
- Version: land as sakura-scheme 1.5.0? (Consumers auto-update on minor.)
- Dialect verbs (card/shop/flower/cortex/marionette): keep them living IN sakura-scheme as
  an opt-in installer, or push to consumers per THE-PLAN §3.3? "Wire up her words" implies
  keeping them in-repo — confirm.
- dispatch.js Curator-coupling carve-out is still pending in BOTH — defer again? (unknown —
  needs Alfred whether the 1-week window includes it.)
