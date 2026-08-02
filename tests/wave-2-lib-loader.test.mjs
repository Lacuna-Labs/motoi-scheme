// tests/wave-2-lib-loader.test.mjs
//
// Sakura-cleanup Wave 2 — Step 1 & 2 verification.
//
// STEP 1: verify each of the 21 migrated lib modules wires into a
//         Motoi env via installLibs, reports its verb count, and
//         we can look up 2-3 expected verbs per module.
//
// STEP 2: verify Alfred's `play` example — the reference-documented
//         audio verb — is now reachable. media.js registers `tone` /
//         `note` / `music` as the base audio surface (per media.js
//         source of truth). We smoke-test the seam that actually
//         drives sound: BellAdapter + a note trigger.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeExtendedBaseEnv, installLibs } from '../src/lib-loader.js'
import { makeBaseEnv } from '../src/base.js'

// ── STEP 1 — module-by-module verification ────────────────────────────

test('lib-loader — makeExtendedBaseEnv returns env with __libSummary', () => {
  const env = makeExtendedBaseEnv()
  assert.ok(env, 'env returned')
  assert.ok(env.__libSummary, 'summary attached')
  assert.ok(Array.isArray(env.__libSummary.modules), 'modules is an array')
  // Post CORE-vs-MODULE restructure (2026-07-16): 14 initial CORE installers
  // + 20 Wave 1-5 CORE completion installers (2026-07-16 evening) = 34 CORE
  // + 1 composer installer (2026-07-17)
  // + 1 composer-v11 installer (2026-07-17: 16-voice + HTML colors + TUI)
  // + 1 http-serve installer (2026-07-17: kids host carts for friends)
  // + 1 llm Tier-0 installer (2026-07-17)
  // + 1 completions installer (2026-07-17)
  // + 1 book-reader installer (2026-07-17: books-in-the-REPL)
  // + 1 book-of-code tutor installer (2026-07-19 Wave 1)
  // + 1 cpu installer (2026-07-19 Wave 1: 8-bit Motoi CPU)
  // + 1 reading-state installer (2026-07-19 Wave 2: per-chapter progress)
  // + 1 pair-programming installer (2026-07-19 Wave 2: ambient completions)
  // + 1 matrix installer (2026-07-19 Wave 2: matrix/* for Book of ML)
  // + 1 stack installer (2026-07-19 TUI wave: motoi/stack ledger)
  // = 46 CORE + 4 MODULE = 50 total (accounting as of 2026-07-19).
  //
  // RECONCILED 2026-07-24: the hand-maintained enumeration above drifted.
  // The live installer registry (lib-loader `installLibs`) now runs 81 CORE
  // + 4 MODULE = 85 installers, 0 failed. The exact per-installer breakdown
  // is no longer transcribed here (it re-drifts every wave); the count below
  // reflects the authoritative live summary, verified via
  // `env.__libSummary` (modules.length === 85, failed.length === 0). The
  // companion "no module failed to load" test guards load integrity.
  //
  // RE-RECONCILED 2026-08-01 (bucket 1, stale-by-design): 85 → 79.
  // The 2026-07-25 Curator-verb rip removed 6 installers (5 CORE + 1 MODULE);
  // the live count is now 76 CORE + 3 MODULE = 79, still with 0 failed.
  // Evidence — core/index.js:47-52: "The Curator game-object client verbs
  // (installGame/installScene/installEntity/installWorld/installCamera/
  // installMotion/installPart/installGroup/installPrefab/installGameInstances)
  // were ripped 2026-07-25 ... Archived to scratch/attic." The MODULE that
  // went is game-entity-advanced/prefab — its verbs were re-homed into
  // lib/game/composer.js and prefab/define + prefab/spawn are still bound.
  //
  // This number is a DRIFT TRIPWIRE, not a correctness claim. The companion
  // "no module failed to load" test is what guards load integrity, and it is
  // green (failed.length === 0). A drop here with 0 failed means installers
  // were removed on purpose; a drop here WITH failures means something broke.
  assert.equal(env.__libSummary.modules.length, 79,
    '79 installer runs: 76 CORE + 3 MODULE (juggle, eng, ops), 0 failed — live registry count as of 2026-08-01, post the 2026-07-25 rip')
})

test('lib-loader — no module failed to load', () => {
  const env = makeExtendedBaseEnv()
  const failed = env.__libSummary.failed
  if (failed.length > 0) {
    console.error('FAILED MODULES:', JSON.stringify(failed, null, 2))
  }
  assert.equal(failed.length, 0, `${failed.length} modules failed`)
})

test('lib-loader — total verb count grows meaningfully vs base', () => {
  const baseEnv = makeBaseEnv()
  const baseCount = baseEnv.vars.size
  const env = makeExtendedBaseEnv()
  const extCount = env.vars.size
  assert.ok(extCount > baseCount, `extended (${extCount}) > base (${baseCount})`)
  // Sanity: lib installers add hundreds of verbs across 14 modules.
  assert.ok(extCount - baseCount > 100,
    `expected 100+ new verbs; got ${extCount - baseCount}`)
})

// Per-module spot checks. For each module we look up 1-3 verbs the
// module is known to install. If a module's installer runs but binds
// zero verbs (or unexpected names), this catches it early.

// Post CORE-vs-MODULE restructure (2026-07-16): installer names carry
// a core/ or module/ prefix reflecting where the verbs land in the
// architect's classification.
const SPOT_CHECKS = [
  ['core/base/r7rs-small',   ['exact', 'char?', 'string->list']],
  ['core/base/alg',          ['alg/perm', 'alg/cyclic']],
  ['core/base/assert',       ['assert/check-with', 'assert/invariants', 'assert/audit-verify']],
  ['core/graphics/sprite',   ['sprite/define']],
  ['core/media/media',       ['tone', 'note', 'circle', 'clear', 'render']],
  // REBASELINED 2026-08-01 (bucket 1): core/game/game, core/game/game-instances,
  // core/game/scene and module/game-entity-advanced/prefab were ripped
  // 2026-07-25 (core/index.js:47-52) and no longer appear in __libSummary.
  // Their entries moved to RIPPED_INSTALLERS below — kept, not deleted, so the
  // record of what they used to install survives, and their still-live verbs
  // are re-asserted at their new homes.
  ['module/game-juggle/juggle',          ['juggle/valid?', 'juggle/balls']],
  ['core/ai/ai',             ['cortex/remember', 'cortex/recall', 'llm/complete']],
  ['core/system/system',     ['input/may-i?']],
  ['module/math-advanced/eng',           ['eng/tf', 'eng/tf-dc-gain']],
  ['core/system/time-verbs', ['time/delta']],
  ['module/math-advanced/ops',           []],   // ops registers many — check module ran
]

for (const [modName, verbs] of SPOT_CHECKS) {
  test(`spot-check: ${modName} registers verbs`, () => {
    const env = makeExtendedBaseEnv()
    const mod = env.__libSummary.modules.find((m) => m.name === modName)
    assert.ok(mod, `${modName} was run`)
    assert.ok(mod.ok, `${modName} succeeded: ${mod.error}`)
    if (verbs.length > 0) {
      // For each expected verb, either the specific name is in env,
      // or (fallback) we accept any 'added' verb from this module.
      for (const v of verbs) {
        const present = env.vars.has(v)
        if (!present) {
          console.warn(`  ${modName}: expected verb '${v}' not directly present. Module added ${mod.verbs} verbs total.`)
        }
      }
      // At least ONE expected verb must be present (module actually installed something recognizable).
      const anyPresent = verbs.some((v) => env.vars.has(v))
      assert.ok(anyPresent,
        `${modName}: none of [${verbs.join(',')}] found in env. Module added: ${mod.added.slice(0, 10).join(',')}...`)
    }
  })
}

// ── Installers ripped 2026-07-25 (bucket 1, stale-by-design) ──────────
// Kept as a record rather than deleted (CLAUDE.md: "No deletes. Ever.").
// Each entry: [installer-name, verbs-that-SURVIVED, verbs-that-are-GONE].
// The surviving verbs were re-homed (mostly into lib/game/composer.js and
// lib/game/world.js) and each was probed individually with
// `./bin/motoi eval "(procedure? VERB)"` on 2026-08-01.
const RIPPED_INSTALLERS = [
  ['core/game/game',                     ['entity/make', 'entity/spawn'], ['entity/has-tag?', 'entity/hits-tag']],
  ['core/game/game-instances',           ['big-bang'],                    ['game/step', 'game/frame', 'game/state']],
  ['core/game/scene',                    ['scene/clear', 'scene/load'],   ['scene/switch']],
  ['module/game-entity-advanced/prefab', ['prefab/define', 'prefab/spawn'], ['prefab/make']],
]

for (const [modName, survived, gone] of RIPPED_INSTALLERS) {
  test(`ripped 2026-07-25: ${modName} — installer gone, live verbs re-homed`, () => {
    const env = makeExtendedBaseEnv()
    const mod = env.__libSummary.modules.find((m) => m.name === modName)
    assert.equal(mod, undefined,
      `${modName} was ripped 2026-07-25 (core/index.js:47-52); if it is back, the reference chapter must be written first`)
    // The capability check that actually matters: a missing installer must
    // NOT mean a missing verb. These are still in scheme/reference/.
    for (const v of survived) {
      assert.equal(typeof env.vars.get(v), 'function',
        `${v} survived the rip and must stay bound`)
    }
    for (const v of gone) {
      assert.equal(env.vars.get(v), undefined,
        `${v} was ripped and is not documented in scheme/reference/`)
    }
  })
}

// ── STEP 2 — Alfred's play example ────────────────────────────────────

test('audio play — media.js note/tone verbs registered', () => {
  const env = makeExtendedBaseEnv()
  // The reference documents `audio/play`; media.js exposes the base
  // audio surface as `tone` / `note` / `music`. Verify these are
  // present — they are the seam the audio-driver drives.
  const audioSeams = ['tone', 'note', 'music', 'sfx', 'silence', 'stop-sound']
  for (const name of audioSeams) {
    assert.ok(env.vars.has(name), `audio seam '${name}' missing`)
  }
})

test('audio play — BellAdapter fires without throwing (headless)', async () => {
  // Direct JS-level smoke — the actual playback seam. If this throws,
  // NO cart can play a note in Motoi. Passes silently in a piped/CI
  // environment (BellAdapter is TTY-guarded).
  const { getSoundEngine } = await import('../lib/audio/sound.js')
  const engine = getSoundEngine()
  // Squelch the terminal bell during test.
  const prev = process.env.MOTOI_SOUND
  process.env.MOTOI_SOUND = 'off'
  try {
    const result = engine.note('C4', 0.05, 0.5)
    assert.ok(result && result.ok, 'note returned ok')
    assert.equal(result.pitch, 'C4')
    assert.ok(typeof result.freq === 'number', 'freq resolved')
    engine.stop()
  } finally {
    if (prev === undefined) delete process.env.MOTOI_SOUND
    else process.env.MOTOI_SOUND = prev
  }
})

test('audio play — env-level (note "C4" 0.05 0.5) evaluates', async () => {
  // Evaluate a note call through the Scheme dispatch pipeline. This
  // is the closest we can get to Alfred's `play` example without a
  // dedicated audio/play verb (that verb is a Wave-3+ deliverable
  // per reference-runtime-gap-2026-07-16.slat).
  const { parse } = await import('../src/reader.js')
  const { evaluate } = await import('../src/interp.js')
  const fuel = { n: 1_000_000 }
  const env = makeExtendedBaseEnv({ fuel })
  const prev = process.env.MOTOI_SOUND
  process.env.MOTOI_SOUND = 'off'
  try {
    const program = parse('(note "C4" 0.05 0.5)')
    const result = evaluate(program[0], env, fuel)
    // note returns { ok: true, kind, pitch, freq, dur, vel }
    assert.ok(result && result.ok, `note evaluated: ${JSON.stringify(result)}`)
  } finally {
    if (prev === undefined) delete process.env.MOTOI_SOUND
    else process.env.MOTOI_SOUND = prev
  }
})
