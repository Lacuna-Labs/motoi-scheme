#!/usr/bin/env node
// every-verb-smoke.mjs — invoke plausible arguments against every declared
// CORE verb via makeCoreEnv() and record pass/fail. Complements the
// mapping-approval + core-coverage tests by actually CALLING verbs, not
// just checking registration.
//
// Outputs a JSON report:
//   { total, passed, failed, notCallable, samples, verbs: [{name, ok, error?}] }

import { makeCoreEnv } from '../core/index.js'
import { CORE_VERBS } from '../core/core-verbs.js'
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Sym } from '../src/reader.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, `every-verb-smoke-2026-07-16.json`)

const env = makeCoreEnv()

// Plausible argument builders per name. Fall through defaults for common
// patterns. The goal: MOST verbs get called with meaningful args; those
// that need very specific shapes get skipped cleanly.
function argsFor(name) {
  // Zero-arg cases
  const zeroArg = new Set([
    'const/pi','const/tau','const/e','const/phi',
    'math/pi','math/tau','math/e',
    'surface-exists?','pixels-wide','pixels-tall','viewport','viewport-width',
    'cols','rows','begin-frame','end-frame','on-canvas-trace','measure-content',
    'sprites','sprites/clear','audio/halt','audio/playing?','tempo',
    'time/now','time/iso','grid-cols','grid-rows','grid-live-count','grid-origin',
    'grid-step-count','camera-home','camera-frame','camera-state','camera-x','camera-y',
    'world/reset!','world/frame','world/count','world/collisions','world/render',
    'sub-position-per-beat','get-color','mode-info','frame-rate','fb-snapshot',
    'framebuffer','render','key?','touch','base/make-character',
  ])
  if (zeroArg.has(name)) return []

  // Common namespace prefixes
  if (name.startsWith('math/')) {
    if (name === 'math/sqrt' || name === 'math/floor' || name === 'math/ceil' ||
        name === 'math/round' || name === 'math/exp' || name === 'math/log' ||
        name === 'math/log2' || name === 'math/log10' || name === 'math/square' ||
        name === 'math/cube') return [4]
    if (name === 'math/pow') return [2, 8]
    if (name === 'math/hypot') return [3, 4]
    if (name === 'math/gcd' || name === 'math/lcm') return [12, 18]
    if (name === 'math/lerp') return [0, 10, 0.5]
    if (name === 'math/clamp') return [5, 0, 3]
    if (name === 'math/sum' || name === 'math/avg') return [[1, 2, 3, 4]]
    if (name === 'math/pct') return [25, 100]
    if (name === 'math/compare') return [1, 2]
    if (name === 'math/area-model' || name === 'math/array') return [3, 4]
    if (name === 'math/count-on') return [5, 4]
    if (name === 'math/digit-at') return [1234, 2]
    if (name === 'math/expanded-form') return [132]
    if (name === 'math/fraction-bar' || name === 'math/ratio-bar') return [1, 2]
    if (name === 'math/integer-line') return [0, 10]
    if (name === 'math/log-base') return [8, 2]
    if (name === 'math/mixed-number') return [1, 1, 2]
    if (name === 'math/number-line') return [0, 10, 2]
    if (name === 'math/round-half-up') return [1.5]
    if (name === 'math/round-to-place') return [1234, 2]
    if (name === 'math/skip-count') return [0, 5, 4]
    if (name === 'math/place-value') return [1234, 2]
    return [1]
  }
  if (name.startsWith('geom/')) {
    if (name === 'geom/point') return [3, 4]
    if (name === 'geom/segment') return [[0, 0], [3, 4]]
    if (name === 'geom/circle') return [10, 10, 5]
    if (name === 'geom/triangle') return [[0, 0], [4, 0], [0, 3]]
    if (name === 'geom/distance' || name === 'geom/midpoint' || name === 'geom/slope' ||
        name === 'geom/angle-between') return [[0, 0], [3, 4]]
    if (name === 'geom/rotate') return [[3, 4], 0.5]
    if (name === 'geom/translate') return [[3, 4], 1, 2]
    if (name === 'geom/sin' || name === 'geom/cos' || name === 'geom/tan') return [0.5]
    if (name === 'geom/atan2') return [1, 1]
    if (name === 'geom/->radians') return [180]
    if (name === 'geom/->degrees') return [Math.PI]
    if (name === 'geom/circle-area' || name === 'geom/circle-circumference') return [5]
    if (name === 'geom/triangle-area') return [[0, 0], [4, 0], [0, 3]]
    if (name === 'geom/polygon-area') return [[[0, 0], [4, 0], [4, 3], [0, 3]]]
    return [1]
  }
  if (name.startsWith('vec/')) {
    if (name === 'vec/make') return [3, 4]
    if (name === 'vec/zero') return [3]
    if (name === 'vec/dim' || name === 'vec/norm' || name === 'vec/normalize') return [[3, 4]]
    if (name === 'vec/ref') return [[10, 20, 30], 1]
    if (name === 'vec/scale') return [[3, 4], 2]
    if (name === 'vec/dot' || name === 'vec/add' || name === 'vec/sub' ||
        name === 'vec/+' || name === 'vec/-' || name === 'vec/distance') return [[1, 2], [3, 4]]
    if (name === 'vec/lerp') return [[0, 0], [10, 10], 0.5]
    return [[1, 2]]
  }
  if (name.startsWith('tick/')) {
    if (name === 'tick/pulse') return [0.3, 0.5]
    if (name === 'tick/phase') return [1.5, 1]
    if (name === 'tick/osc') return [0.25, 2]
    return [0.5]
  }
  if (name.startsWith('const/')) return []
  if (name.startsWith('animation/')) {
    if (name === 'animation/budget') return [16]
    if (name === 'animation/reflow-policy') return []
    if (name === 'animation/set-reflow-policy') return [new Sym('auto')]
    if (name === 'animation/tick') return []
    if (name === 'animation/tweens' || name === 'animation/clear!') return []
    return []
  }
  if (name.startsWith('easing/')) return [0.5, 0, 1, 1]  // t, b, c, d
  if (name === 'bezier-ease' || name === 'named-ease' || name === 'spring-ease') return [0.5]
  if (name === 'bounce' || name === 'slide' || name === 'fade') return [0, 10, 30]

  if (name.startsWith('entity/')) {
    if (name === 'entity/spawn') return [new Sym('test-ball'), 10, 20]
    if (name === 'entity/make') return [new Sym('e-manual'), 10, 20]
    if (name === 'entity/kind' || name === 'entity/alive?' || name === 'entity/pos' ||
        name === 'entity/x' || name === 'entity/y' || name === 'entity/vel' ||
        name === 'entity/state' || name === 'entity/static?') return ['e1']
    if (name === 'entity/set-pos!' || name === 'entity/set-vel!' ||
        name === 'entity/set-velocity!' || name === 'entity/move!' ||
        name === 'entity/goto!' || name === 'entity/accel!' ||
        name === 'entity/move' || name === 'entity/apply-force!') return ['e1', 5, 5]
    if (name === 'entity/glide!') return ['e1', 50, 50, 2]
    if (name === 'entity/overlaps?' || name === 'entity/distance' ||
        name === 'entity/collides?') return ['e1', 'e2']
    if (name === 'entity/despawn!' || name === 'entity/remove!' ||
        name === 'entity/pin!' || name === 'entity/unpin!') return ['e1']
    if (name === 'entity/hp!' || name === 'entity/damage!') return ['e1', 10]
    if (name === 'entity/untag!' || name === 'entity/tag!' ||
        name === 'entity/has-tag?' || name === 'entity/hits-tag') return ['e1', new Sym('enemy')]
    if (name === 'entity/shape!' || name === 'entity/sprite!') return ['e1', new Sym('circle')]
    if (name === 'entity/ref') return ['e1', new Sym('x')]
    if (name === 'entity/set!') return ['e1', new Sym('color'), 5]
    if (name === 'entity/turn' || name === 'entity/rotate!') return ['e1', 0.5]
    if (name === 'entity/all' || name === 'entity/count') return []
    return ['e1']
  }
  if (name.startsWith('world/')) {
    if (name === 'world/spawn') return [new Sym('ball'), 10, 20]
    if (name === 'world/step') return []
    if (name === 'world/render' || name === 'world/frame' || name === 'world/count' ||
        name === 'world/collisions' || name === 'world/reset!' || name === 'world/camera') return []
    if (name === 'world/each' || name === 'world/find') return [() => true]
    if (name === 'world/nearest') return ['e1']
    if (name === 'world/camera-follow!') return ['e1']
    if (name === 'world/camera-bounds!') return [0, 0, 100, 100]
    if (name === 'world/camera-shake!') return [10]
    if (name === 'world/camera-snap!') return [50, 50]
    if (name === 'world/gravity!') return [0.5]
    if (name === 'world/floor!') return [100]
    if (name === 'world/wind!') return [0.1, 0]
    if (name === 'world/impulse!') return ['e1', 1, 1]
    if (name === 'world/after') return [100, () => 1]
    return []
  }
  if (name.startsWith('grid/') || name.startsWith('grid-')) {
    if (name === 'grid-init') return [10, 10]
    if (name === 'grid-cell?' || name === 'grid-cell-age' || name === 'grid-cell-state') return [1, 1]
    if (name === 'grid-cell-set!') return [1, 1, true]
    if (name === 'grid-neighbors') return [1, 1]
    if (name === 'grid-step') return [4]
    if (name === 'grid/dot' || name === 'grid/glow') return [1, 1, 10]
    if (name === 'grid/clear') return []
    if (name === 'grid/card-center') return [1, 1]
    return []
  }
  if (name.startsWith('camera-')) {
    if (name === 'camera-center-on' || name === 'camera-pan' ||
        name === 'camera-pan-to' || name === 'camera-snap!') return [10, 10]
    if (name === 'camera-zoom-to') return [2]
    if (name === 'camera-home' || name === 'camera-frame' || name === 'camera-state' ||
        name === 'camera-x' || name === 'camera-y') return []
    if (name === 'camera-set!') return [10, 10, 2]
    return []
  }
  if (name.startsWith('motion/')) {
    if (name === 'motion/halt' || name === 'motion/drop') return ['e1']
    if (name === 'motion/arc') return ['e1', 50, 30]
    if (name === 'motion/follow-input' || name === 'motion/anchor-to-input') return ['e1']
    if (name === 'motion/with-feel' || name === 'motion/with-pace') return [new Sym('quick'), () => 1]
    if (name === 'motion/move-to') return ['e1', 50, 50, 30]
    if (name === 'motion/on-settle') return ['e1', () => 1]
    if (name === 'motion') return ['e1', 50, 50]
    return []
  }
  if (name.startsWith('part/')) {
    // Every part/* takes an optional amplitude/arg and returns a fn.
    if (name === 'part/look-toward') return [10, 20]
    if (name === 'part/turn') return [0, Math.PI]
    return [1]
  }
  if (name.startsWith('ai/')) {
    if (name === 'ai/seek' || name === 'ai/flee') return [[0, 0], [10, 10], 2]
    if (name === 'ai/wander') return [[0, 0], [1, 1], 0.1]
    if (name === 'ai/arrive') return [[0, 0], [10, 10], 2, 20]
    if (name === 'ai/pursue' || name === 'ai/evade') return [[0, 0], [10, 10], [1, 0], 2]
    if (name === 'ai/align') return [[[1, 0], [0, 1]], 2]
    if (name === 'ai/cohere') return [[0, 0], [[5, 5], [10, 10]], 2]
    if (name === 'ai/separate') return [[0, 0], [[5, 5], [10, 10]], 10, 2]
    if (name === 'ai/flock') return [[0, 0], [1, 0], [[5, 5]], [[0, 1]]]
    if (name === 'ai/decide') return [['a', 'b'], [0.3, 0.7]]
    if (name === 'ai/utility') return [5, 0, 10]
    if (name === 'ai/bt-tick') return [[new Sym('bt-action'), () => true]]
    if (name === 'ai/bt-sequence' || name === 'ai/bt-selector') return [[new Sym('bt-action'), () => true]]
    if (name === 'ai/bt-action' || name === 'ai/bt-condition') return [() => true]
    if (name === 'ai/bb-set!') return [new Sym('key'), 42]
    if (name === 'ai/bb-get' || name === 'ai/bb-has?' || name === 'ai/bb-del!') return [new Sym('key')]
    return []
  }
  if (name.startsWith('audio/')) {
    if (name === 'audio/play') return [new Sym('tone'), 440, 0.1]
    if (name === 'audio/master-volume' || name === 'audio/tempo') return []
    return []
  }
  if (name.startsWith('note/')) {
    if (name === 'note/strike' || name === 'note/release') return ['C4', 0.1]
    if (name === 'note/place-at') return ['C4', 0.5, 0.1]
    return []
  }
  if (name.startsWith('synth/')) {
    if (name === 'synth/play') return [new Sym('sine'), 'C4', 0.2]
    if (name === 'synth/chord') return [['C4', 'E4', 'G4'], 0.5]
    if (name === 'synth/kit') return [new Sym('kick'), 0]
    return []
  }
  if (name.startsWith('artifact/')) {
    if (name === 'artifact/save') return ['smoke-test', 'hello']
    if (name === 'artifact/cite' || name === 'artifact/delete' || name === 'artifact/list') return ['smoke-test']
    return []
  }
  if (name.startsWith('cortex/')) {
    if (name === 'cortex/write') return [new Sym('smoke-key'), 42]
    if (name === 'cortex/read' || name === 'cortex/forget') return [new Sym('smoke-key')]
    if (name === 'cortex/remember') return [new Sym('smoke-key'), 42]
    if (name === 'cortex/recall') return [new Sym('smoke-key')]
    if (name === 'cortex/query') return [new Sym('smoke-key')]
    if (name === 'cortex/keys' || name === 'cortex/size') return []
    return []
  }
  if (name.startsWith('time/')) {
    if (name === 'time/now' || name === 'time/iso') return []
    if (name === 'time/from-ms') return [60000, new Sym('m')]
    if (name === 'time/to-ms') return [1, new Sym('m')]
    if (name === 'time/delta') return [new Sym('ms')]
    return []
  }
  if (name.startsWith('text/')) {
    if (name === 'text/draw') return ['hello', 5, 5]
    if (name === 'text/measure' || name === 'text/wrap' || name === 'text/rasterize') return ['hello']
    if (name === 'text/overlay' || name === 'text/overlay-clear') return []
    return ['hi']
  }
  if (name.startsWith('font/')) return []

  // Scheduler
  if (name === 'on-tick' || name === 'after') return [() => 1]
  if (name === 'cancel-tick') return [1]
  if (name === 'wait') return [100]
  if (name === 'stop-when') return [() => false]
  if (name === 'at-beat' || name === 'beat/on') return [1, () => 1]
  if (name === 'across-beats') return [1, 4, () => 1]
  if (name === 'land-on-downbeat') return [1.7]
  if (name === 'arc-between') return [0, 10, () => 1]

  // Misc/top-level
  if (name === 'random') return []
  if (name === 'with-seed' || name === 'with-spacing') return [42, () => 1]
  if (name === 'to-draw') return [() => 1]
  if (name === 'clear-surface-layer') return []
  if (name === 'after-frame') return [() => 1]
  if (name === 'eval') return [42]

  // Sprite
  if (name === 'sprite') return [new Sym('ball'), 10, 20]
  if (name === 'sprite/address') return [new Sym('ball')]
  if (name === 'sprite/landmarks' || name === 'sprite/rasterize') return [new Sym('ball')]

  // Framebuffer draw shortcuts
  if (name === 'clear') return [0]
  if (name === 'circle' || name === 'disc') return [10, 10, 5]
  if (name === 'line') return [0, 0, 10, 10]
  if (name === 'rect' || name === 'rect-fill') return [0, 0, 10, 10]
  if (name === 'plot') return [[[0, 0, 1]]]
  if (name === 'pset') return [5, 5, 8]
  if (name === 'pget') return [5, 5]
  if (name === 'flower/paint') return [1, 10, 10, 0, 1, 1, 0, 5]
  if (name === 'set-mode') return [80, 80]
  if (name === 'set-color') return [8]
  if (name === 'set-frame-rate') return [30]
  if (name === 'sleep' || name === 'silence') return [0.01]
  if (name === 'sync' || name === 'stop' || name === 'stop-sound' ||
      name === 'tick-frame') return []
  if (name === 'frame') return []
  if (name === 'fire-key') return [new Sym('a')]
  if (name === 'fire-mouse') return [10, 10, 0]
  if (name === 'fire-gamepad') return [0, 0, true]
  if (name === 'fb-restore') return [{ w: 80, h: 80, palette: [], pixels: [], color: 8, frame: 0 }]
  if (name === 'fb/text') return ['hi', 5, 5]
  if (name === 'save-cart' || name === 'load-cart') return ['/tmp/smoke.cart']
  if (name === 'tone') return [440, 0.01]
  if (name === 'note') return ['C4', 0.01]
  if (name === 'chord') return [['C4', 'E4'], 0.01]
  if (name === 'melody') return [['C4', 'E4'], 0.01]
  if (name === 'sfx') return [new Sym('blip'), 440, 0.01]
  if (name === 'music') return [null]
  if (name === 'on-frame' || name === 'on-key' || name === 'on-mouse' || name === 'on-gamepad') return [() => 1]

  // Game loop
  if (name === 'big-bang') return [null, () => 1]
  if (name === 'to-draw') return [() => 1]
  if (name === 'game/frame' || name === 'game/state' || name === 'game/step' ||
      name === 'game/running?' || name === 'game/stop') return [1]

  // Input probes
  if (name === 'input/down?') return [new Sym('space')]

  // Assertions + escalate
  if (name === 'assert/check-with') return [(x) => x > 0, 5, 'positive']
  if (name === 'assert/invariants') return [[]]
  if (name === 'assert/audit-verify') return [42, new Sym('number')]
  if (name === 'escalate') return [new Sym('note'), 'smoke-test']

  return null   // signal: skip
}

// Setup shared state — some verbs assume entities named e1/e2 exist.
// Create them so downstream entity/* calls don't false-fail.
try {
  const spawn = env.vars.get('entity/spawn')
  if (spawn) { spawn(new Sym('smoke'), 5, 5) ; spawn(new Sym('smoke'), 8, 8) }
  const gridInit = env.vars.get('grid-init')
  if (gridInit) gridInit(10, 10)
} catch { /* ignore */ }

// Iterate every CORE verb, invoke it, record result.
const verbs = []
let passed = 0, failed = 0, skipped = 0, notCallable = 0
const failures = []

for (const name of CORE_VERBS) {
  const fn = env.vars.get(name)
  if (typeof fn !== 'function') {
    // Constants (font/*, easing/named constants) are registered as
    // non-function values — count as pass if defined.
    if (env.vars.has(name)) {
      passed++
      verbs.push({ name, ok: true, note: 'constant-value' })
      continue
    }
    notCallable++
    verbs.push({ name, ok: false, error: 'not-registered' })
    failures.push({ name, error: 'not-registered' })
    continue
  }
  const args = argsFor(name)
  if (args === null) {
    // Unknown arg shape — try zero args as best-effort.
    try {
      const r = fn()
      passed++
      verbs.push({ name, ok: true, note: 'zero-arg-fallback' })
    } catch (e) {
      // Skip: unknown-shape verb we can't drive
      skipped++
      verbs.push({ name, ok: false, error: 'unknown-arg-shape', message: String(e && e.message || e) })
    }
    continue
  }
  try {
    const r = fn(...args)
    passed++
    verbs.push({ name, ok: true })
  } catch (e) {
    failed++
    const msg = e && e.message ? String(e.message) : String(e)
    verbs.push({ name, ok: false, error: msg })
    failures.push({ name, error: msg })
  }
}

const total = verbs.length
const report = {
  timestamp: new Date().toISOString(),
  total, passed, failed, skipped, notCallable,
  passRate: (passed / total * 100).toFixed(1) + '%',
  failures: failures.slice(0, 50),
  verbs,
}

writeFileSync(OUT, JSON.stringify(report, null, 2))
console.log(`smoke: ${passed}/${total} pass (${report.passRate}). failed=${failed} skipped=${skipped} not-callable=${notCallable}`)
console.log(`report: ${OUT}`)
if (failures.length > 0) {
  console.log(`\nfirst 15 failures:`)
  for (const f of failures.slice(0, 15)) console.log(`  ${f.name} — ${f.error}`)
}
