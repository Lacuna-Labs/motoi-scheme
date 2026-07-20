// lib-loader.js — wire the 21 migrated lib modules into a Motoi env.
//
// Created 2026-07-16 as Pass-3 Wave-2 Step 1 (Sakura cleanup wave).
//
// Doctrine: Motoi ships base + libraries out of the box. `makeBaseEnv`
// alone gives you 117 primitives (arithmetic, list, string, IO); to
// actually run the reference examples (audio, drawing, game, ai) you
// need the lib-side installers wired in.
//
// This module exports:
//
//   installLibs(env, opts)     — install every lib module's verbs
//                                onto an existing env. Returns a
//                                summary { modules: [...], counts }.
//
//   makeExtendedBaseEnv(opts)  — the one-call convenience: build a
//                                fresh base env, then run installLibs
//                                on it. This is what CLI / REPL / bin
//                                consumers should call.
//
// The 21 lib modules are loaded in dependency order:
//
//   base tier      → r7rs-small, alg          (pure Scheme modules)
//   graphics tier  → sprite                    (framebuffer helpers)
//   media tier     → media                     (shared fb/audio/loop; owns
//                                               tone/note/circle/etc.)
//   audio tier     → (bell adapter is auto,
//                     sound + audio-driver are
//                     accessed by media)
//   game tier      → game, game-instances,
//                     scene, prefab, juggle,
//                     game-theory (utility)    (need game state object)
//   ai tier        → ai                        (Cortex/LLM verbs)
//   system tier    → system, eng, time-verbs,
//                     ops                      (host adapters)
//
// r7rs-types is exported types (no verbs). topo is utility functions
// (no verbs — used internally by other libs when wired later).
// animation is accessed via getAnimationLoop from media.js.
// registry.js exports registerPrimitive shim (used by ops.js).

import { makeBaseEnv } from './base.js'
import { installCore, makeCoreEnv } from '../core/index.js'

// MODULE-tier installers only. All CORE-tier installers (r7rs-small,
// alg, sprite, text, easing, animation, media, game, game-instances,
// scene, ai, system, time-verbs) are wired via installCore(env) in
// core/index.js — importing them again here would be dead weight and
// invite drift. If you need a CORE installer directly, reach for the
// re-exports at the bottom of this file or import from '../core/'.
import { installPrefab } from '../lib/game/prefab.js'
import { installJuggle } from '../lib/game/juggle.js'
import { installEng } from '../lib/system/eng.js'
import { installOps } from '../lib/system/ops.js'

// ── main entry ─────────────────────────────────────────────────────────

/**
 * Install every lib module onto an existing env.
 *
 * @param {Env}    env   Existing evaluator env (usually from makeBaseEnv).
 * @param {object} opts  Optional. { fuel } — fuel box shared with base;
 *                       if omitted, a fresh {n: 1e6} is used.
 * @returns {object}     { modules: [{name, verbs, ok}], total, failed }
 */
export function installLibs(env, opts = {}) {
  const fuel = opts.fuel ?? { n: 1_000_000 }

  // Snapshot pre-install verb names so we can attribute new ones to
  // each module. env.vars is a Map; every module installer calls
  // env.define which grows it.
  const modules = []

  const snap = () => new Set(env.vars.keys())

  const runInstaller = (name, fn) => {
    const before = snap()
    let ok = true
    let error = null
    try {
      fn()
    } catch (e) {
      ok = false
      error = e && e.message ? e.message : String(e)
    }
    const after = snap()
    const added = [...after].filter((k) => !before.has(k))
    modules.push({ name, verbs: added.length, ok, error, added })
    return { name, verbs: added.length, ok, error }
  }

  // ── CORE FIRST (Alfred lock, 2026-07-16). installCore installs the
  //    322-verb CORE partition via the core/ entry. Everything after is
  //    module-classified — kept installed here for backwards compat
  //    with existing callers of makeExtendedBaseEnv, but flagged as
  //    module-only by the introspection surface.
  const coreSummary = installCore(env, { fuel })
  // Fold core module records into our modules list (rename with core/ prefix
  // already applied in installCore).
  for (const m of coreSummary.modules) modules.push(m)
  const game = coreSummary.game

  // ── MODULE tier (loaded here for backwards compat; will be on-demand
  //    via (import (motoi ...)) after modules/ split is fully wired).
  runInstaller('module/game-entity-advanced/prefab', () => installPrefab(env))
  runInstaller('module/game-juggle/juggle',          () => installJuggle(env))
  runInstaller('module/math-advanced/eng',           () => installEng(env))
  runInstaller('module/math-advanced/ops',           () => installOps(env))

  const total = modules.reduce((s, m) => s + m.verbs, 0)
  const failed = modules.filter((m) => !m.ok)

  return { modules, total, failed, game }
}

/**
 * The one-call convenience — a fresh env with base + libs pre-wired.
 * This is what CLI / REPL / bin consumers should reach for.
 *
 * @param {object} opts  Optional. { fuel } — passed through.
 */
export function makeExtendedBaseEnv(opts = {}) {
  const fuel = opts.fuel ?? { n: 1_000_000 }
  const env = makeBaseEnv(fuel)
  const summary = installLibs(env, { fuel })
  // Attach the summary so callers can introspect what got wired.
  env.__libSummary = summary
  return env
}

// Re-export the media-state accessor so callers can inspect the
// shared framebuffer / audio timeline that media.js owns.
export { getMediaState } from '../lib/media/media.js'

// Re-export the CORE-first entrypoint (Phase 1 of the CORE-vs-MODULE
// restructure, 2026-07-16). Consumers that want the 322-verb CORE
// partition (no module verbs) reach for makeCoreEnv instead of
// makeExtendedBaseEnv.
export { installCore, makeCoreEnv, CORE_VERBS, coreCoverage, isCore } from '../core/index.js'
