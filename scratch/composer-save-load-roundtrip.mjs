// scratch/composer-save-load-roundtrip.mjs
//
// End-to-end save+load round-trip check. Builds a canvas, fills notes/
// pixels/cells, composer/save to tmp, composer/load from tmp, composer/emit
// and compare byte-for-byte to expected shape. Kid draws sprite, saves,
// reopens tomorrow — this is that test.

import { makeCoreEnv } from '../core/index.js'
import { evaluate } from '../src/interp.js'
import { parse, sym } from '../src/reader.js'
import {
  formatForm,
  pianoRollPlace, spriteGridSet, tileMapSet,
  timelinePlace, fxChainAdd, pickerChoose,
} from '../lib/composer/composer.js'
import { unlinkSync } from 'node:fs'

const fuel = { n: 5_000_000 }
const env = makeCoreEnv({ fuel })

function evalSrc(src) {
  const forms = parse(src)
  let out
  for (const f of forms) out = evaluate(f, env, fuel)
  return out
}

const canvas = evalSrc(`
  (composer/canvas (list :bind (quote (workshop)))
    (composer/piano-roll :bind (quote (workshop :song)) :steps 16 :emit-shape (quote sequence))
    (composer/sprite-grid :bind (quote (workshop :hero)) :size (quote (8 8)) :palette (quote pico-8))
    (composer/tile-map :bind (quote (workshop :map)) :size (quote (8 8)))
    (composer/timeline :bind (quote (workshop :anim)) :entities (quote (hero)) :duration 60 :fps 30)
    (composer/fx-chain :bind (quote (workshop :fx)) :available (quote (fx/reverb fx/delay)))
    (composer/instrument-picker :bind (quote (workshop :wave)) :choices (quote (sine square triangle)))
    (composer/live-code :bind (quote (workshop :src)))
    (composer/color-picker :bind (quote (workshop :bg)) :palette (quote pico-8) :value (quote red))
    (composer/toggle :bind (quote (workshop :loop)) :label "loop" :value #t)
    (composer/text-field :bind (quote (workshop :title)) :label "title" :value "my song"))
`)

// (b) Fill state.
pianoRollPlace(canvas.children[0], 'C4', 0, { vel: 0.8, dur: 1 })
pianoRollPlace(canvas.children[0], 'E4', 2, { vel: 0.7, dur: 1 })
pianoRollPlace(canvas.children[0], 'G4', 4, { vel: 0.9, dur: 2 })
spriteGridSet(canvas.children[1], 2, 2, 8)
spriteGridSet(canvas.children[1], 5, 2, 8)
spriteGridSet(canvas.children[1], 3, 5, 12)
spriteGridSet(canvas.children[1], 4, 5, 12)
tileMapSet(canvas.children[2], 0, 0, 1)
tileMapSet(canvas.children[2], 7, 7, 5)
timelinePlace(canvas.children[3], 'hero', 0, [100, 100])
timelinePlace(canvas.children[3], 'hero', 30, [200, 100])
timelinePlace(canvas.children[3], 'hero', 60, [200, 200])
fxChainAdd(canvas.children[4], 'fx/reverb', { wet: 0.4 })
fxChainAdd(canvas.children[4], 'fx/delay', { time: 0.25 })
pickerChoose(canvas.children[5], 'triangle')
canvas.children[6].state.source = '(display "kid wrote this")'

// (c) Save.
const emit = env.get('composer/emit')
const save = env.get('composer/save')
const load = env.get('composer/load')
const path = `/tmp/motoi-save-load-${process.pid}.slat`
save(canvas, path)

// (d) Load.
const loaded = load(path)

// (e) Emit both, compare byte-for-byte.
const before = formatForm(emit(canvas))
const after = formatForm(emit(loaded))

// Cleanup.
try { unlinkSync(path) } catch { /* ignore */ }

console.log('=== BEFORE ===')
console.log(before)
console.log('=== AFTER ===')
console.log(after)
console.log('=== MATCH? ===')
console.log(before === after ? 'PASS byte-for-byte match' : 'FAIL diverged')

if (before !== after) {
  // Diff by-line.
  const bl = before.split('\n')
  const al = after.split('\n')
  for (let i = 0; i < Math.max(bl.length, al.length); i++) {
    if (bl[i] !== al[i]) {
      console.log(`  diff at line ${i + 1}:`)
      console.log(`    before: ${bl[i]}`)
      console.log(`    after:  ${al[i]}`)
    }
  }
  process.exit(1)
}
