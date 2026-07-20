// core/core-verbs.js — the definitive 322-verb Motoi CORE registry.
//
// Created 2026-07-16 as Phase 1 of the CORE-vs-MODULE restructure.
//
// Doctrine (Alfred): a 1.5B model should memorize CORE and retrieve MODULE.
// CORE = 322 verbs an 11-year-old / hobbyist reaches for in month one.
// Source of truth: scratch/motoi-core-verbs-list.slat and
// design-docs/architect-motoi-core-vs-module-2026-07-16.slat.
//
// Runtime semantics: this file is the AUTHORITATIVE partition. The
// runtime installers in lib/*/ still register the same verbs onto the
// env; installCore(env) simply installs the lib modules whose verbs are
// classified CORE, and this list is used by the introspection surface
// and the docs-emitter to tag which verbs live in CORE vs MODULE.
//
// When a verb appears in this set, it is:
//   - part of the model's memorized vocabulary
//   - shipped in the default REPL / CLI without `(import ...)`
//   - discoverable via (help) with :core flag
//   - covered at TIER-1 (20 pairs/verb minimum) in training data.
//
// Verbs NOT in this set are MODULE verbs — installed by the same lib
// files today (for backwards compat) but flagged as module-only in
// introspection and marked with :module "(motoi ...)" in the reference.

export const CORE_VERBS = new Set([
  // ── DRAW / FRAMEBUFFER ─────────────────────────────────────────
  'fb/text',
  'text/draw',
  'text/measure',
  'text/wrap',
  'clear-surface-layer',
  'begin-frame',
  'end-frame',
  'on-frame',
  'after-frame',
  'on-canvas-trace',
  'surface-exists?',
  'pixels-wide',
  'pixels-tall',
  'viewport',
  'viewport-width',
  'cols',
  'rows',

  // ── SPRITES ────────────────────────────────────────────────────
  'sprite',
  'sprites',
  'sprite/address',
  'sprite/landmarks',
  'sprite/rasterize',

  // ── FONT constants ─────────────────────────────────────────────
  'font/default',
  'font/mono',
  'font/big',
  'font/tiny',

  // ── EASING + ANIMATION ─────────────────────────────────────────
  'bezier-ease',
  'named-ease',
  'spring-ease',
  'easing/emphasized',
  'easing/standard',
  'easing/decelerated',
  'easing/accelerated',
  'easing/linear',
  'easing/ease-in',
  'easing/ease-out',
  'easing/ease-in-out',
  'easing/spring',
  'animation/budget',
  'animation/reflow-policy',
  'animation/set-reflow-policy',
  'bounce',
  'slide',
  'fade',
  'with-spacing',

  // ── MOTION ─────────────────────────────────────────────────────
  'motion/move-to',
  'motion/halt',
  'motion/drop',
  'motion/arc',
  'motion/follow-input',
  'motion/anchor-to-input',
  'motion/with-feel',
  'motion/with-pace',

  // ── GAME LOOP + BIG-BANG ───────────────────────────────────────
  'big-bang',
  'to-draw',
  'game/frame',
  'game/state',
  'game/step',
  'game/stop',
  'game/running?',

  // ── INPUT ──────────────────────────────────────────────────────
  'input/down?',
  'input/pressed?',
  'input/buttons',
  'input/may-i?',
  'input/set!',
  'key?',
  'on-key',
  'touch',

  // ── TIMING / SCHEDULE ──────────────────────────────────────────
  'on-tick',
  'cancel-tick',
  'after',
  'wait',
  'stop',
  'stop-when',
  'at-beat',
  'beat/on',
  'across-beats',
  'land-on-downbeat',
  'sub-position-per-beat',
  'arc-between',
  'tempo',
  'frame',

  // ── TIME ───────────────────────────────────────────────────────
  'time/now',
  'time/delta',
  'time/when',
  'time/every-ms',
  'time/across',
  'time/during',
  'time/then',
  'time/until',
  'time/iso',
  'time/from-ms',
  'time/to-ms',

  // ── AUDIO ──────────────────────────────────────────────────────
  'audio/play',
  'audio/halt',
  'audio/playing?',
  'audio/master-volume',
  'audio/tempo',
  // DSP verbs demoted to `(motoi audio-analysis)` module per Alfred
  // 2026-07-16 lock. See architect-motoi-core-runtime-completion-2026-07-16.slat
  // §6 :cant-be-pure-js. Not CORE — they need FFT + native audio input
  // (onnxruntime-node / WASM DSP / IPC daemon) and shouldn't gate a
  // 1.5B-param model's memorized surface.
  //   'audio/onset?', 'audio/onset-strength', 'audio/bar-clock',
  //   'audio/key', 'audio/spectrum', 'audio/listen', 'audio/lufs',

  // ── NOTES / MUSIC ──────────────────────────────────────────────
  'note',
  'note/strike',
  'note/release',
  'note/place-at',

  // ── SYNTH ──────────────────────────────────────────────────────
  'synth/play',
  'synth/chord',
  'synth/kit',

  // ── TICK ───────────────────────────────────────────────────────
  'tick/sine',
  'tick/osc',
  'tick/pulse',
  'tick/ease',
  'tick/phase',

  // ── BASIC MATH ─────────────────────────────────────────────────
  'math/pi',
  'math/tau',
  'math/e',
  'math/sqrt',
  'math/floor',
  'math/ceil',
  'math/round',
  'math/hypot',
  'math/lerp',
  'math/clamp',
  'math/square',
  'math/cube',
  'math/pow',
  'math/log',
  'math/log10',
  'math/log2',
  'math/exp',
  'math/avg',
  'math/sum',
  'math/pct',
  'math/compare',
  'math/gcd',
  'math/lcm',

  // ── K-6 MATH PEDAGOGY (Alfred locked as CORE 2026-07-16) ───────
  'math/area-model',
  'math/array',
  'math/count-on',
  'math/digit-at',
  'math/expanded-form',
  'math/fraction-bar',
  'math/integer-line',
  'math/log-base',
  'math/mixed-number',
  'math/number-line',
  'math/ratio-bar',
  'math/round-half-up',
  'math/round-to-place',
  'math/skip-count',
  'math/place-value',

  // ── CONST ──────────────────────────────────────────────────────
  'const/pi',
  'const/tau',
  'const/e',
  'const/phi',

  // ── RANDOMNESS ─────────────────────────────────────────────────
  'random',
  'randint',
  'random-int',
  'random-range',
  'random-pick',
  'with-seed',

  // ── GEOMETRY ───────────────────────────────────────────────────
  'geom/point',
  'geom/segment',
  'geom/circle',
  'geom/triangle',
  'geom/distance',
  'geom/midpoint',
  'geom/rotate',
  'geom/translate',
  'geom/slope',
  'geom/angle-between',
  'geom/sin',
  'geom/cos',
  'geom/tan',
  'geom/atan2',
  'geom/->radians',
  'geom/->degrees',
  'geom/circle-area',
  'geom/circle-circumference',
  'geom/triangle-area',
  'geom/polygon-area',

  // ── VEC ────────────────────────────────────────────────────────
  'vec/make',
  'vec/add',
  'vec/sub',
  'vec/+',
  'vec/-',
  'vec/scale',
  'vec/dot',
  'vec/norm',
  'vec/normalize',
  'vec/distance',
  'vec/lerp',
  'vec/zero',
  'vec/ref',
  'vec/dim',

  // ── ENTITY ─────────────────────────────────────────────────────
  'entity/make',
  'entity/spawn',
  'entity/all',
  'entity/count',
  'entity/ref',
  'entity/kind',
  'entity/alive?',
  'entity/pos',
  'entity/x',
  'entity/y',
  'entity/vel',
  'entity/set!',
  'entity/set-pos!',
  'entity/set-vel!',
  'entity/move!',
  'entity/goto!',
  'entity/glide!',
  'entity/accel!',
  'entity/overlaps?',
  'entity/distance',
  'entity/despawn!',
  'entity/remove!',
  'entity/hp!',
  'entity/damage!',
  'entity/tag!',
  'entity/untag!',
  'entity/state',
  'entity/shape!',
  'entity/sprite!',

  // ── WORLD ──────────────────────────────────────────────────────
  'world/spawn',
  'world/step',
  'world/render',
  'world/frame',
  'world/each',
  'world/find',
  'world/count',
  'world/nearest',
  'world/camera',
  'world/camera-follow!',
  'world/camera-bounds!',
  'world/camera-shake!',
  'world/camera-snap!',
  'world/gravity!',
  'world/floor!',
  'world/wind!',
  'world/reset!',
  'world/collisions',
  'world/impulse!',
  'world/after',

  // ── OBJECT ─────────────────────────────────────────────────────
  'object/spawn',
  'object/fetch',

  // ── SCENE ──────────────────────────────────────────────────────
  'scene/clear',
  'scene/grid',
  'scene/load',
  'scene/spawn-many',
  'scene/imagine',

  // ── GRID ───────────────────────────────────────────────────────
  'grid/dot',
  'grid/clear',
  'grid/glow',
  'grid/card-center',
  'grid-init',
  'grid-cols',
  'grid-rows',
  'grid-cell?',
  'grid-cell-age',
  'grid-cell-set!',
  'grid-cell-state',
  'grid-live-count',
  'grid-neighbors',
  'grid-origin',
  'grid-step',
  'grid-step-count',

  // ── PART ───────────────────────────────────────────────────────
  'part/wave',
  'part/nod',
  'part/turn',
  'part/tilt',
  'part/step',
  'part/reach',
  'part/point',
  'part/raise',
  'part/lower',
  'part/shake',
  'part/breathe',
  'part/lean',
  'part/look-toward',
  'part/shrug',
  'part/bow',
  'part/sway',
  'part/expression',

  // ── CAMERA ─────────────────────────────────────────────────────
  'camera-center-on',
  'camera-pan',
  'camera-pan-to',
  'camera-zoom-to',
  'camera-home',
  'camera-set!',
  'camera-frame',
  'camera-state',
  'camera-x',
  'camera-y',

  // ── AI ─────────────────────────────────────────────────────────
  'ai/seek',
  'ai/flee',
  'ai/wander',
  'ai/arrive',
  'ai/pursue',
  'ai/evade',
  'ai/align',
  'ai/cohere',
  'ai/separate',
  'ai/flock',
  'ai/decide',
  'ai/utility',
  'ai/bt-tick',
  'ai/bt-sequence',
  'ai/bt-selector',
  'ai/bt-action',
  'ai/bt-condition',
  'ai/bb-get',
  'ai/bb-set!',
  'ai/bb-has?',
  'ai/bb-del!',

  // ── CORTEX ─────────────────────────────────────────────────────
  'cortex/remember',
  'cortex/recall',
  'cortex/query',
  'cortex/forget',
  'cortex/keys',
  'cortex/size',
  'cortex/read',
  'cortex/write',

  // ── ARTIFACT ───────────────────────────────────────────────────
  'artifact/save',
  'artifact/list',
  'artifact/cite',
  'artifact/delete',

  // ── SYSTEM ─────────────────────────────────────────────────────
  'system/health',
  'system/registry',

  // ── EVAL / DISPLAY ─────────────────────────────────────────────
  'eval',
  'display',
  'measure-content',

  // ── UTILITY ────────────────────────────────────────────────────
  'base/make-character',

  // ── CONTROL FLOW (added 2026-07-16 from Sakura->Motoi mapping) ─
  'escalate',

  // ── TEXT (added 2026-07-16 from Sakura->Motoi mapping) ─────────
  'text/rasterize',

  // ── ASSERT (added 2026-07-16 from Sakura->Motoi mapping) ───────
  'assert/check-with',
  'assert/invariants',
  'assert/audit-verify',
])

/** True if `verb` is part of the CORE 322. */
export function isCore (verb) {
  return CORE_VERBS.has(verb)
}

/** Return a summary of core verb coverage against an installed env. */
export function coreCoverage (env) {
  const installed = new Set(env.vars.keys())
  const present = []
  const missing = []
  for (const v of CORE_VERBS) {
    if (installed.has(v)) present.push(v)
    else missing.push(v)
  }
  return {
    total: CORE_VERBS.size,
    present: present.length,
    missing: missing.length,
    missingList: missing,
  }
}
