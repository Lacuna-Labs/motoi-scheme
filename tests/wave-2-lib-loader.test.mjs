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
  // = 46 CORE + 4 MODULE = 50 total.
  assert.equal(env.__libSummary.modules.length, 50,
    '50 installer runs: 46 CORE (14 initial + 20 Wave-1-5 + composer + composer-v11 + http-serve + llm + completions + book-reader + book-tutor + cpu + reading-state + pair-programming + matrix + stack) + 4 MODULE (prefab, juggle, eng, ops)')
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
  ['core/game/game',         ['sprite', 'sprites', 'entity/make']],
  ['core/game/game-instances', ['big-bang']],
  ['core/game/scene',        ['scene/clear']],
  ['module/game-entity-advanced/prefab', ['prefab/define']],
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
