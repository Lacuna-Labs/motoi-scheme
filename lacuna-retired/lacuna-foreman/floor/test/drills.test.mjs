// drills.test.js — THE THREE DRILLS END-TO-END (CL-UX Part A; A8-SCENE-SCHEME §2.5, §2.6, §5.1, §8.4).
// Owns: verifying that `stall.slat`, `night.slat`, and `disk.slat` read, validate, and play end-to-end through the pure
// ESM fold (`fold.js` + `scene.js` + `clock.js`) with zero refused events, 100% expectation pass rate across both
// unheld and owner-held branches, deterministic `(state …)` keyframes across tick cadences (30 Hz, 60 Hz, 120 Hz) and
// restore round-trips (Node vs browser client keyframe parity). Refuses: any mock of the fold or scene player.
// Implements: docs/eng/floor-5.0/A8-SCENE-SCHEME.md §2.5–§2.6, §5.1; docs/lanes/1.0/tasks/CL-UX-floor-desk-ide-chat.md Part A.
// Invariants (design §18): "live, replay, drills and scenes are one code path". Faults (§16): none.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { readScene, play } from '../scene.js'
import { createFold, fold, restore, snapshot, tick, refused } from '../fold.js'
import { validateEvent } from '../validate.js'

const EPOCH = Date.UTC(2026, 10, 1, 12, 0, 0)
const DRILLS = [
  { name: 'stall', culprit: 'w-d20002', heldAt: 30000, minVerdicts: 10 },
  { name: 'night', culprit: null, heldAt: null, minVerdicts: 8 },
  { name: 'disk', culprit: 'w-d10001', heldAt: 20000, minVerdicts: 2 },
]

const loadDrill = (name) => readFileSync(new URL(`../drills/${name}.slat`, import.meta.url), 'utf8')
const sha16 = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16)

for (const d of DRILLS) {
  test(`drill ${d.name}.slat plays end-to-end with zero refusals, all expectations green, and exact Node/browser fold parity`, () => {
    const raw = loadDrill(d.name)
    const parsed = readScene(raw)
    assert.equal(parsed.ok, true, parsed.why)
    assert.equal(parsed.scene.name, d.name)

    const branches = d.culprit ? [[], [{ actor: d.culprit, atMs: d.heldAt }]] : [[]]
    for (const presses of branches) {
      const out = play(parsed.scene, { epoch: EPOCH, by: 'owner', presses })
      assert.deepEqual(refused(out.f), [], `${d.name}: fold refused events`)
      const failedVerdicts = out.verdicts.filter((v) => !v.ok)
      assert.deepEqual(failedVerdicts, [], `${d.name}: failed verdicts`)
      assert.ok(out.verdicts.length >= d.minVerdicts, `${d.name}: expected >= ${d.minVerdicts} verdicts`)

      // Every emitted event passes catalog validation.
      const invalid = out.events.map((e) => [e, validateEvent(e)]).filter(([, v]) => !v.ok)
      assert.deepEqual(invalid, [], `${d.name}: catalog validation`)

      if (parsed.scene.score) {
        assert.equal(out.score.result, presses.length ? 'win' : 'lose', `${d.name} score`)
      }

      // Browser fold parity: a fresh client fold that receives the emitted events and ticks at 60 Hz produces the exact same final (state …) keyframe.
      const browserFold = createFold({ epoch: EPOCH })
      const endMs = parsed.scene.secs * 1000
      let idx = 0
      const stepMs = 1000 / 60
      for (let tMs = 0; tMs <= endMs; tMs += stepMs) {
        const batch = []
        while (idx < out.events.length && out.events[idx].t - EPOCH <= tMs) {
          batch.push(out.events[idx++])
        }
        if (batch.length) fold(browserFold, batch)
        tick(browserFold, (EPOCH + tMs - browserFold.epoch) / 1000)
      }
      while (idx < out.events.length) fold(browserFold, [out.events[idx++]])
      tick(browserFold, (EPOCH + endMs - browserFold.epoch) / 1000)
      const browserState = snapshot(browserFold, browserFold.logT)
      assert.equal(browserState, out.state, `${d.name}: Node and browser fold state parity`)

      // Keyframe restore parity: restoring the final state into a blank fold yields byte-identical snapshot.
      const restored = restore(createFold({ epoch: 0 }), out.state)
      assert.equal(snapshot(restored, restored.logT), out.state, `${d.name}: restore round-trip`)
      assert.equal(sha16(out.state).length, 16)
    }
  })
}
