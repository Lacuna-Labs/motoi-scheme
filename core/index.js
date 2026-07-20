// core/index.js — Motoi CORE loader.
//
// Created 2026-07-16 as Phase 1 of the CORE-vs-MODULE restructure.
//
// Doctrine (Alfred, 2026-07-16-lock): 322-verb CORE always installs.
// Modules load on demand via (import (motoi ...)). This entry is what
// the CLI, REPL, and bin/motoi reach for by default.
//
// installCore(env) semantics:
//   1. Install the R7RS-small primitives (base library — already on env
//      via makeBaseEnv; installCore takes an env that ALREADY has
//      makeBaseEnv called on it).
//   2. Install lib modules whose ENTIRE contents are CORE (r7rs-small,
//      alg subset, sprite, text, easing, animation, media,
//      game+game-instances, scene, ai, system, time-verbs).
//   3. Do NOT install module-only lib files (eng.js, ops.js,
//      game-theory.js, juggle.js, prefab.js). Those load via
//      (import (motoi <path>)) — see modules/*/MANIFEST.slat.
//
// A NOTE ON PHYSICAL SEPARATION:
//   Today the existing lib installers are monolithic — a single call
//   to installR7rsSmall(env) registers all 157 verbs. Some of those
//   are CORE and some are MODULE (e.g. exact->inexact is MODULE).
//   Physical extraction of module-only verbs from monolithic installers
//   is a follow-up refactor. This loader lands the CORE-FIRST invariant
//   (installCore is a distinct entry) and lets the introspection surface
//   filter by CORE_VERBS to answer "what does the model memorize?"

import { makeBaseEnv } from '../src/base.js'

// base tier — pure Scheme modules
import { installR7rsSmall } from '../lib/base/r7rs-small.js'
import { installAlg } from '../lib/base/alg.js'
import { installAssert } from '../lib/base/assert.js'

// graphics tier
import { installSprite } from '../lib/graphics/sprite.js'
import { installText } from '../lib/graphics/text.js'
import { installEasing } from '../lib/graphics/easing.js'
import { installAnimation } from '../lib/graphics/animation.js'

// media tier
import { registerMedia, getMediaState } from '../lib/media/media.js'

// game tier — CORE parts only
import { installGame, makeGameState } from '../lib/game/game.js'
import { installGameInstances } from '../lib/game/game-instances.js'
import { installScene } from '../lib/game/scene.js'

// ai tier
import { installAi } from '../lib/ai/ai.js'

// system tier — CORE parts (system, time-verbs). NOT eng or ops (module).
import { installSystem } from '../lib/system/system.js'
import { installTime } from '../lib/system/time-verbs.js'
import { installStack } from '../lib/system/stack.js'

// ── Wave 1-5 (2026-07-16 completion) ────────────────────────────────
import { installConst } from '../lib/math/const.js'
import { installMathBasic } from '../lib/math/basic.js'
import { installMathPedagogy } from '../lib/math/pedagogy.js'
import { installGeom } from '../lib/graphics/geom.js'
import { installVec } from '../lib/graphics/vec.js'
// ── Matrix (2026-07-19 Wave 2) ──────────────────────────────────────
// 13 verbs — matrix/make, matrix/rows, matrix/cols, matrix/ref,
// matrix/row, matrix/col, matrix/transpose, matrix/identity,
// matrix/zero, matrix/scale, matrix/add, matrix/sub, matrix/multiply,
// matrix/matvec. Book of ML ch 3+ leans on these; nothing else in the
// runtime provided them.
import { installMatrix } from '../lib/math/matrix.js'
import { installTick } from '../lib/audio/tick.js'
import { installFramebufferVerbs } from '../lib/graphics/framebuffer-verbs.js'
import { installScheduler } from '../lib/game/scheduler.js'
import { installMisc } from '../lib/game/misc.js'
import { installAnimationBudget } from '../lib/graphics/animation-budget.js'
import { installEntity } from '../lib/game/entity.js'
import { installWorld } from '../lib/game/world.js'
import { installGrid } from '../lib/game/grid.js'
import { installCamera } from '../lib/game/camera.js'
import { installMotion } from '../lib/game/motion.js'
import { installPart } from '../lib/game/part.js'
import { installSteering } from '../lib/ai/steering.js'
import { installAudioVerbs } from '../lib/audio/audio-verbs.js'
import { installArtifact } from '../lib/system/artifact.js'
import { installCortexIO } from '../lib/ai/cortex-io.js'

// ── Composer (2026-07-17) ───────────────────────────────────────────
// 15 composer/* verbs — UI widgets that translate to Scheme forms.
// Spec: engineering/COMPOSER-1.0.ENG.slat.
import { installComposer } from '../lib/composer/composer.js'

// ── Composer v1.1 extensions (2026-07-17) ───────────────────────────
// +10 verbs: song/config, composer/voice-pool, voice/mix, voice/compose,
// composer/voice-assign, composer/voice-mix-set, color/named,
// color/name-of, color/palette-html-16, composer/render-tui,
// composer/tree-logo. Spec: engineering/COMPOSER-1.1.ENG.slat.
import { installComposerV11 } from '../lib/composer/composer-v11.js'

// ── HTTP host (2026-07-17) ──────────────────────────────────────────
// 4 verbs — http/serve, http/wait-until-ready, http/stop, http/serve-info.
// Kids host their carts locally so friends can play them.
// Spec: engineering/COMPOSER-1.1.ENG.slat (Task 4).
import { installHttpServe } from '../lib/net/http-serve.js'

// ── LLM-augmented REPL/IDE (2026-07-17) ─────────────────────────────
// 13 verbs (Tier 0, persona-scoped) — llm/ask, llm/complete, llm/stream,
// llm/embed, llm/config, copilot/ask, copilot/what-is, copilot/explain,
// copilot/fix, copilot/complete, copilot/scaffold, copilot/pretty-error,
// copilot/rag. Spec: engineering/LLM-AUGMENTED-REPL-1.0.ENG.slat.
// Installs LATE so its llm/complete + llm/embed override the stubs
// in lib/ai/ai.js with env-var-configurable versions.
import { installLLM } from '../lib/ai/llm.js'

// ── Completions (2026-07-17) ────────────────────────────────────────
// 6 verbs — Tier A (free: at-point, import-suggestions, next-arg) +
// Tier B (LLM: smart-at-point, body) + config (mode).
// Installs AFTER installLLM so it can look up llm/ask + llm/complete.
import { installCompletions } from '../lib/ai/completions.js'

// ── Book reader (2026-07-17) ────────────────────────────────────────
// 6 verbs — book/list, book/read, book/toc, book/example, book/search,
// book/next + book/prev. Turns scheme-books/ into a REPL-addressable
// surface: kids read tutorials AT the prompt and hit enter to run
// examples. Cursor state persists via cortex/read + cortex/write.
import { installBookReader } from '../lib/book/reader.js'

// ── Book-of-Code tutor (2026-07-19) ─────────────────────────────────
// 5 verbs — book-of-code/table-of-contents, book-of-code/chapter,
// book-of-code/read, book-of-code/run-code-block, book-of-code/tutor.
// A Motoi-voiced pedagogical layer on top of the generic book/*
// reader. Focused on Book of Code because that's the book with a
// runnable CPU underneath (Chapter 12) — the tutor knows how to walk
// a kid through the fetch/decode/execute loop step by step.
import { installBookOfCodeTutor } from '../lib/book/tutor.js'

// ── CPU (2026-07-19) ────────────────────────────────────────────────
// 12 verbs — cpu/boot!, cpu/load-program!, cpu/step!, cpu/run!,
// cpu/state, cpu/read-mem, cpu/write-mem!, cpu/display, cpu/assemble,
// cpu/disassemble, cpu/halted?, cpu/opcodes. An honest 8-bit CPU in
// Motoi Scheme — the runtime for Book of Code Chapter 12.
import { installCpu } from '../lib/system/cpu.js'

// ── Reading state (2026-07-19 Wave 2) ───────────────────────────────
// 11 verbs — motoi/reading-state, motoi/mark-read!, motoi/mark-block-run!,
// motoi/reading-progress, motoi/bookmark!, motoi/bookmarks,
// motoi/bookmark-delete!, motoi/highlight!, motoi/highlights,
// motoi/log-exchange!, motoi/session-log (+ /reset! /path).
// Persistent state at ~/.motoi/reading-state.slat so the book tutor
// knows what the user has read. Alfred: "how will it know what text
// was read?" — this answer.
import { installReadingState } from '../lib/system/reading-state.js'

// ── Pair programming (2026-07-19 Wave 2) ────────────────────────────
// 9 verbs — motoi/pair-on!, motoi/pair-off!, motoi/pair-mode?,
// motoi/pair-set-mode!, motoi/explain, motoi/explain-selection,
// motoi/refactor-suggest, motoi/bug-spot, motoi/ambient-complete,
// motoi/pair-narrate!, motoi/pair-state. Motoi as pair-partner:
// ambient completions, F2-to-explain, turn-taking driver. Composes
// with reading-state to log every pair event.
import { installPairProgramming } from '../lib/system/pair-programming.js'

// ── Hacker mode (2026-07-19 Wave 4) ─────────────────────────────────
// 3 verbs — motoi/hacker-mode-on!, motoi/hacker-mode-off!, motoi/hacker-mode?.
// Runtime flag toggled from Scheme. The IDE + TUI paint the palette shift;
// this file is the runtime hinge so pairs teaching the verb can execute.
import { installHackerMode } from '../lib/system/hacker-mode.js'

import { CORE_VERBS, coreCoverage } from './core-verbs.js'

/**
 * Install every CORE lib module onto an existing env. The env must
 * already have makeBaseEnv called on it (or be created here — see
 * makeCoreEnv below).
 *
 * @param {Env} env
 * @param {object} opts  Optional. { fuel } — passed through.
 * @returns {object}
 *   { modules: [{name, verbs, ok, error}], total, failed, game, coverage }
 */
export function installCore (env, opts = {}) {
  const fuel = opts.fuel ?? { n: 1_000_000 }
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

  // base tier — CORE
  runInstaller('core/base/r7rs-small',   () => installR7rsSmall(env, fuel))
  runInstaller('core/base/alg',          () => installAlg(env, fuel))
  runInstaller('core/base/assert',       () => installAssert(env, fuel))

  // graphics tier — CORE
  runInstaller('core/graphics/sprite',   () => installSprite(env))
  runInstaller('core/graphics/easing',   () => installEasing(env))
  runInstaller('core/graphics/text',     () => installText(env))

  // media tier — CORE (owns tone/note/circle)
  runInstaller('core/media/media',       () => registerMedia(env, fuel))

  // game tier — CORE (game loop primitives; NOT juggle, prefab, game-theory)
  const game = makeGameState()
  runInstaller('core/game/game',         () => installGame(env, game))
  runInstaller('core/graphics/animation', () => installAnimation(env, {
    getMedia: getMediaState,
    game,
  }))
  runInstaller('core/game/game-instances', () => installGameInstances(env))
  runInstaller('core/game/scene',        () => installScene(env, game))

  // ai tier — CORE (steering + BT basics; NOT flow-fields / pathfinding)
  runInstaller('core/ai/ai',             () => installAi(env))

  // system tier — CORE (system/health + registry + time; NOT eng or ops)
  runInstaller('core/system/system',     () => installSystem(env))
  runInstaller('core/system/time-verbs', () => installTime(env))
  // motoi/stack — evaluation-frame ledger for the TUI + IDE stack panel.
  // Attaches push/pop hooks in interp.js; the hooks are additive no-ops
  // when the module isn't installed. Marcus, TUI wave (2026-07-19).
  runInstaller('core/system/stack',      () => installStack(env, fuel))

  // ── Wave 1-5 CORE completion (2026-07-16) ─────────────────────────
  runInstaller('core/math/const',        () => installConst(env, fuel))
  runInstaller('core/math/basic',        () => installMathBasic(env, fuel))
  runInstaller('core/math/pedagogy',     () => installMathPedagogy(env, fuel))
  runInstaller('core/graphics/geom',     () => installGeom(env, fuel))
  runInstaller('core/graphics/vec',      () => installVec(env, fuel))
  runInstaller('core/math/matrix',       () => installMatrix(env, fuel))
  runInstaller('core/audio/tick',        () => installTick(env, fuel))
  // framebuffer-verbs relies on fb/text being defined; it's installed by
  // installText above so we run this AFTER.
  runInstaller('core/graphics/framebuffer-verbs', () => installFramebufferVerbs(env, fuel))
  runInstaller('core/graphics/animation-budget', () => installAnimationBudget(env, fuel))
  runInstaller('core/game/scheduler',    () => installScheduler(env, fuel))
  runInstaller('core/game/misc',         () => installMisc(env, fuel))
  // Wave 2 — entity/world/grid/camera share the game state constructed above.
  runInstaller('core/game/entity',       () => installEntity(env, game))
  runInstaller('core/game/world',        () => installWorld(env, game, fuel))
  runInstaller('core/game/grid',         () => installGrid(env, fuel))
  runInstaller('core/game/camera',       () => installCamera(env, fuel))
  // Wave 3 — motion + part
  runInstaller('core/game/motion',       () => installMotion(env, game, fuel))
  runInstaller('core/game/part',         () => installPart(env, fuel))
  // Wave 5 — steering, audio (CORE-only, no DSP), artifact, cortex-io
  runInstaller('core/ai/steering',       () => installSteering(env, fuel))
  runInstaller('core/audio/audio-verbs', () => installAudioVerbs(env, fuel))
  runInstaller('core/system/artifact',   () => installArtifact(env, fuel))
  runInstaller('core/ai/cortex-io',      () => installCortexIO(env, fuel))
  runInstaller('core/composer/composer', () => installComposer(env, fuel))
  // Composer v1.1 extensions load AFTER installComposer so they see
  // the extension-registry tables composer.js exports.
  runInstaller('core/composer/composer-v11', () => installComposerV11(env, fuel))
  // HTTP host — kids hosting carts for friends.
  runInstaller('core/net/http-serve',    () => installHttpServe(env, fuel))
  // LLM Tier-0 runs LATE so its llm/complete + llm/embed override
  // the stubs registered by installAi above.
  runInstaller('core/ai/llm',            () => installLLM(env, fuel))
  // Completions run AFTER LLM so smart-at-point + body can look up
  // llm/ask + llm/complete on the same env.
  runInstaller('core/ai/completions',    () => installCompletions(env, fuel))
  // Book reader — installed after cortex/* is present so book/next +
  // book/prev can persist cursor state via cortex/write.
  runInstaller('core/book/reader',       () => installBookReader(env, fuel))
  // Book-of-Code tutor — sits on top of book/read + book/example, so
  // installs after them. Adds Motoi's voice around the raw prose.
  runInstaller('core/book/tutor',        () => installBookOfCodeTutor(env, fuel))
  // CPU — install after cortex + book so the tutor's Chapter 12 walkthrough
  // can reach cpu/boot!, cpu/step!, and cpu/display.
  runInstaller('core/system/cpu',        () => installCpu(env, fuel))
  // Reading state — install after tutor so tutor can look up progress;
  // and pair-programming installed AFTER reading-state so its tryLog
  // path resolves. Order is load-bearing here.
  runInstaller('core/system/reading-state',   () => installReadingState(env, fuel))
  runInstaller('core/system/pair-programming', () => installPairProgramming(env, fuel))
  runInstaller('core/system/hacker-mode',     () => installHackerMode(env))

  const total = modules.reduce((s, m) => s + m.verbs, 0)
  const failed = modules.filter((m) => !m.ok)
  const coverage = coreCoverage(env)

  return { modules, total, failed, game, coverage }
}

/**
 * makeCoreEnv — build a fresh env with base + CORE pre-wired.
 * This is the CORE-first entrypoint.
 */
export function makeCoreEnv (opts = {}) {
  const fuel = opts.fuel ?? { n: 1_000_000 }
  const env = makeBaseEnv(fuel)
  const summary = installCore(env, { fuel })
  env.__coreSummary = summary
  return env
}

export { CORE_VERBS, coreCoverage, isCore } from './core-verbs.js'
export { getMediaState } from '../lib/media/media.js'
