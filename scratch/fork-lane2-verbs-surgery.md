# Fork Lane 2 — Sakura's verbs & libraries vs Motoi's libraries (surgery map)

Research-only. Every claim precedes its source path. 2026-07-27.

## 1. Where Sakura's verbs ("her words") live — THREE surfaces

Sakura's verbs are NOT in one place. There are three tiers:

- **Marionette (game/character surface) — `~/code/sakura-scheme/src/lib/marionette/`.**
  Per `marionette/index.js`: `installMarionette(env)` composes 20 namespace files
  (`entity.js world.js ai.js card.js synth.js sprite.js voice.js audio.js desk.js
  game.js scene.js group.js input.js tick.js misc.js` + binding/supporting/state).
  Verb count (grep of `'ns/verb':` literals) = **197 verbs**, namespaces:
  entity 42, world 40, ai 34, card 20, synth 10, sprite 9, voice 7, desk/audio 6,
  scene/game 4, tick/input/group 3, prefab/deploy/curator-voice 2. Names are SLASHED
  (`card/spawn`, `world/step`, `entity/move!`). Registration: `marionette/index.js:50`
  `def = (n,f,perm) => env.define(n,f,{perm})`.
- **Dialect (persona/app surface) — `~/code/sakura-scheme/src/lib/dialect/`.**
  Per `dialect/index.js`: `installSakuraDialect(env, hooks)` installs card/shop/flower/
  cortex/marketplace/surface. Names are HYPHENATED (`card-list`, `card-open`, `card-set!`
  — see `dialect/card/index.js`). ~95 verb-defs across 6 installers. Explicitly "OUTSIDE
  base Sakura per fork/variant doctrine", NOT auto-installed. Has an **installer-hook
  seam**: each installer takes `hooks` so Curator injects real Redux/canvas backings;
  absent hooks → in-memory adapters.
- **Curator LIVE runtime (the shipping copy) — `~/code/curator/curator-web/src/scheme/`.**
  The real, in-production verb layer: its OWN forked `interp.js macro.js reader.js base.js`
  + `runtime/dispatch.js` + **22 `*Verbs.js` files** (`cardVerbs.js shopVerbs.js spriteVerbs.js
  fxVerbs.js transferVerbs.js vendorVerbs.js` …) plus `curatorMarionette.js`. This is the
  1229-LOC-class "full-fat" surface the sakura-scheme dialect files call the "reference."
  `curatorMarionette.js` does `import { installMarionette } from 'sakura-scheme/lib/marionette'`
  — Curator consumes the hermetic runtime and adds glue.

(Note: `~/code/curator/sakura-scheme/` is only `reference/` docs + `_archive/`, not code.)

## 2. How Sakura's libraries work

Per `sakura-scheme/CLAUDE.md` + `src/index.js`: Sakura Scheme is a ~2,000-LOC JS Scheme
extracted FROM Curator on 2026-07-09 as the shared runtime. `makeBaseEnv(fuel)` builds a
hermetic base; `makeExtendedBaseEnv` adds "the four Motoi-ported lib modules (ported
2026-07-16 from motoi-scheme/lib)". Verb metadata via `verbRegistry.js` (`registerVerbMeta`).
Same interpreter FAMILY as Motoi. Public API = only `src/index.js` re-exports. VERSION 1.4.0.

## 3. How Motoi's libraries work

`motoi-scheme/src/base.js:24` `makeBaseEnv(fuel)` with `def = (n,f,perm='read',extra={})
=> e.define(n,f,{perm,...extra})` — **byte-for-byte the same signature as Sakura's base.js:40.**
`src/lib-loader.js` exports `installLibs / makeExtendedBaseEnv` and a CORE partition
(`installCore, makeCoreEnv, CORE_VERBS` — 322-verb core). Libs under `lib/{ai,game,math,…}`
+ lazy `modules/` (game-advanced, math-*, science-*). Same `verbRegistry.js` (Item-8 header
identical). Motoi runtime namespaces (grep): alg 64, math 45, ai 43, motoi 29, composer 27,
game 22, entity 20, cortex 12, tick 9, synth 6, sprite 4, voice 2 … VERSION 0.75.0-beta.

## 4. The surgery — dropping Motoi's engine under Sakura's verbs

Good news: **same engine family, identical `env.define` API + identical `verbRegistry`
contract.** The marionette/dialect installers are already written against exactly the
`env.define(name, fn, {perm})` seam Motoi exposes. They should drop in with near-zero API change.

Real friction = **NAMESPACE COLLISION**, not API. Motoi ALREADY ships `entity/*` (20),
`ai/*` (43), `game/*` (22), `world/*`, `cortex/*` (12), `synth/*`, `sprite/*`, `voice/*`,
`tick/*`, `input/*`, `card/composer` — the SAME namespaces as Marionette. Comparing
`marionette/entity.js` vs Motoi `entity/*`: near-identical name sets (both have
`entity/accel! bounce! damage! despawn! drag! friction! glide! goto! mass! max-speed!
move! overlaps? parent! pin!`) → strongly suggests Motoi's game verbs were DERIVED from
Marionette. So collisions are same-name/maybe-diverged-impl. Under last-writer-wins
`env.define`, install ORDER silently decides which body wins — the hazard.

Divergence to reconcile: Motoi `interp.js` = 792 lines vs Sakura 633; `verbRegistry.js`
md5s differ (independent drift). Reader/macro are the same family but must be diffed.
Dialect verbs (hyphenated `card-list`) do NOT collide with Motoi slashed names — clean.

Adapt/shim (not rewrite): pass `installSakuraDialect(env, hooks)` the Curator hooks;
resolve `sakura-scheme/lib/marionette` import path to Motoi. Rewrite/reconcile: the
overlapping entity/world/ai bodies (pick one impl per verb; keep Sakura behavior where
carts depend on it).

## 5. Cleanup needed on Sakura's side

- `~/code/curator/sakura-scheme/_archive/SAKURA-SCHEME-REFERENCE.slat.pre-split-2026-07-19`
  (3.4 MB pre-split relic) — archive/drop.
- Duplicate interpreter: Curator's `curator-web/src/scheme/{interp,macro,reader,base,
  dispatch}.js` fork vs sakura-scheme's — the move should collapse Curator onto the shared
  engine (CLAUDE.md already flags dispatch.js carve-out as queued).
- `dispatch.js` in sakura-scheme retains hard Curator imports (logbus, card-api, canvasPower,
  chipSink…) and is NOT exported — the security-policy carve-out is unfinished.
- Marionette stub markers (`MarionetteVerbNotImplemented`, stub verbs in world.js) + dialect
  stub verbs (`card/walk` "return 'ok") — decide promote vs delete during the move.

## SURGERY STEPS (ordered)

1. Diff Motoi vs Sakura core (`interp/macro/reader/base/verbRegistry.js`); pick ONE engine
   (Motoi, per plan) and reconcile the ~160-line interp drift + registry md5 drift.
2. Repoint `sakura-scheme/lib/marionette` + `installSakuraDialect` imports to run on Motoi's
   `env` (API already matches — validate `env.define` meta shape + `verbRegistry` parity).
3. Build a namespace-collision report: for every shared name (`entity/* world/* ai/* cortex/*
   synth/* sprite/* voice/* tick/* input/*`) diff Motoi impl vs Marionette impl.
4. Decide winner per collided verb; enforce deterministic install ORDER (Sakura behavior wins
   where carts depend on it) — add a guard so silent last-writer-wins can't regress.
5. Wire dialect `hooks` seam to Curator backings (or in-memory adapters for headless).
6. Collapse Curator's forked `curator-web/src/scheme` interpreter onto the shared engine;
   finish the `dispatch.js` core/security carve-out.
7. Run Curator + Sakura cart suites for backwards-compat ("behave exactly as now").
8. Archive `_archive` relic + resolve stubs.

## OPEN QUESTIONS FOR ALFRED

- For collided verbs (entity/world/ai): keep **Sakura's** impl or **Motoi's**? (They diverged.)
- Do the hyphenated dialect verbs (`card-list`) AND slashed marionette (`card/spawn`) BOTH
  ship in the merged language, or is one being retired?
- Is Curator's forked interpreter (`curator-web/src/scheme`) in scope to collapse now, or
  does it keep importing the package (status quo)?
- `sakura-scheme` VERSION 1.4.0 vs Motoi 0.75.0-beta — which version line survives the merge?
- unknown — needs Alfred: exact runtime verb tally per surface (grep counts are of source
  literals, not a live `motoi run` manifest).
