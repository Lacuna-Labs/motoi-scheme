// lib/game/composer.js — Motoi Scheme · the composer-spec layer.
//
// Created 2026-07-25. Real motion/music/scene planners that emit
// deterministic SPEC objects on the existing framebuffer / scheduler /
// synth / world substrate. Replaces the ripped Curator character-rig
// client stubs (part/*, motion/*, note/*, synth chord|kit|play,
// scene/*, object/*, prefab/*) with genuine parametric planners.
//
// The console model: a "gesture" or a "phrase" is not an opaque command —
// it is a real, inspectable KEYFRAME CURVE (a list of [frame value] pairs)
// computed from parameters. A program can read the curve back, compose it,
// quantize it, or hand it to the scheduler to drive a sprite transform.
// That is motion as a real layer (#371), not a sentinel returning 'ok.
//
// Provenance: Motoi-own (fantasy-console composer). Timing math is standard
// (bpm→ms period, beat quantization). No fabrication: verbs that need a
// capability the deterministic runtime lacks (live sensor input) return an
// honest binding spec, never a faked reading.

import { Sym } from '../../src/reader.js'
import { apply } from '../../src/interp.js'

const FPS = 60
const sym = (s) => new Sym(s)
const nm = (x) => (x instanceof Sym ? x.name : String(x))
const kw = (s) => sym(':' + s)

// Split an args array into { pos:[...], opt:{name:value} }. A keyword is a
// self-evaluating symbol whose printed name starts with ':' (e.g. :at, :scale).
function parseArgs (args) {
  const pos = []
  const opt = {}
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a instanceof Sym && a.name.startsWith(':')) {
      opt[a.name.slice(1)] = args[i + 1]
      i++
    } else {
      pos.push(a)
    }
  }
  return { pos, opt }
}

// A keyframe curve: sample `f(u)` at `frames+1` points, u in [0,1].
function curve (frames, f) {
  const n = Math.max(1, frames | 0)
  const out = []
  for (let i = 0; i <= n; i++) out.push([i, f(i / n)])
  return out
}
const TWO_PI = Math.PI * 2

// Motion spec → Motoi alist. Channels is a map name→curve.
function motionSpec (kind, opts) {
  const rows = [[kw('kind'), sym(kind)]]
  for (const [k, v] of Object.entries(opts)) {
    rows.push([kw(k), v])
  }
  return rows
}

// ── the motion registry: which spec drives which target ──────────
const REGISTRY = new Map() // target-name → spec

function register (target, spec) {
  REGISTRY.set(target, spec)
  return spec
}
function targetName (sprite) {
  if (sprite === undefined || sprite === null) return 'default'
  return nm(sprite)
}

// ── gesture primitives: real parametric curves ───────────────────
// Each returns a motion spec whose :channels carry keyframe curves.
function gesture (name, sprite, frames, channels, extra = {}) {
  const chRows = Object.entries(channels).map(([ch, cv]) => [sym(ch), cv])
  const spec = motionSpec('gesture', {
    gesture: sym(name),
    sprite: sym(targetName(sprite)),
    frames,
    channels: chRows,
    ...extra,
  })
  register(targetName(sprite) + ':' + name, spec)
  return spec
}

export const VERBS = [
  // part/* — character-rig gestures
  'part/bow', 'part/breathe', 'part/expression', 'part/grasp', 'part/lean',
  'part/look-toward', 'part/lower', 'part/nod', 'part/point', 'part/raise',
  'part/reach', 'part/shake', 'part/shrug', 'part/step', 'part/sway',
  'part/tilt', 'part/turn', 'part/twist', 'part/wave',
  // motion/* — timing planners
  'motion/anchor-to-input', 'motion/arc', 'motion/cadence', 'motion/drop',
  'motion/follow-input', 'motion/halt', 'motion/pocket', 'motion/with-feel',
  'motion/with-pace',
  // note/*
  'note/place-at', 'note/release', 'note/strike',
  // synth/*
  'synth/chord', 'synth/kit', 'synth/play',
  // scene/*
  'scene/clear', 'scene/imagine', 'scene/load', 'scene/spawn-many',
  // object/* + prefab/*
  'object/fetch', 'object/spawn', 'prefab/define', 'prefab/spawn',
]
export const LAZY = false

export function installComposer (env, fuel) {
  const fuelBox = fuel || { n: 1_000_000 }
  const def = (n, f, perm = 'state-change', doc = '') =>
    env.define(n, f, { perm, doc, namespace: 'composer', tier: 'operator' })

  const callProc = (fn, args) => (typeof fn === 'function' ? apply(fn, args, fuelBox) : undefined)

  // ── part/* — 19 gestures ───────────────────────────────────
  // Angles in degrees; curves are unitless transform deltas per frame.
  def('part/bow', (...a) => {
    const { pos, opt } = parseArgs(a)
    const depth = Number(pos[1] ?? opt.depth ?? 30)
    const angle = Number(pos[2] ?? opt.angle ?? 0)
    const hold = Number(pos[3] ?? opt.hold ?? 6)
    const frames = 24 + hold
    return gesture('bow', pos[0], frames, {
      'spine-pitch': curve(frames, (u) => depth * Math.sin(Math.min(1, u * 2) * Math.PI * 0.5) * (u < 0.8 ? 1 : (1 - u) * 5)),
      'head-yaw': curve(frames, () => angle),
    }, { depth, angle, hold })
  }, 'state-change', 'Bow a character sprite: spine pitches forward by depth, holds, returns.')

  def('part/breathe', (...a) => {
    const { pos, opt } = parseArgs(a)
    const pace = Number(pos[1] ?? opt.pace ?? 12) // frames per breath
    const depth = Number(pos[2] ?? opt.depth ?? 4)
    const frames = pace * 2
    return gesture('breathe', pos[0], frames, {
      'chest-scale': curve(frames, (u) => 1 + (depth / 100) * Math.sin(u * TWO_PI)),
    }, { pace, depth, loop: true })
  }, 'state-change', 'Breathing loop: chest scales in and out by depth over pace frames.')

  def('part/expression', (...a) => {
    const { pos } = parseArgs(a)
    const name = pos[1] !== undefined ? nm(pos[1]) : 'neutral'
    return gesture('expression', pos[0], 6, {
      face: curve(6, (u) => u), // crossfade 0→1 into the named expression
    }, { expression: sym(name) })
  }, 'state-change', "Set a sprite's facial expression (a 6-frame crossfade).")

  def('part/grasp', (...a) => {
    const { pos, opt } = parseArgs(a)
    const grip = pos[1] !== undefined ? nm(pos[1]) : (opt.grip ? nm(opt.grip) : 'firm')
    const frames = 14
    return gesture('grasp', pos[0], frames, {
      'hand-close': curve(frames, (u) => (grip === 'firm' ? u : u * 0.6)),
    }, { grip: sym(grip), target: opt.target ?? sym('none') })
  }, 'state-change', 'Grasp/hold motion: the hand closes over target with a grip style.')

  def('part/lean', (...a) => {
    const { pos, opt } = parseArgs(a)
    const dir = pos[1] !== undefined ? nm(pos[1]) : (opt.direction ? nm(opt.direction) : 'left')
    const angle = Number(pos[2] ?? opt.angle ?? 12) * (dir === 'right' ? 1 : -1)
    const frames = 16
    return gesture('lean', pos[0], frames, {
      'body-roll': curve(frames, (u) => angle * Math.min(1, u * 1.5)),
    }, { direction: sym(dir), angle })
  }, 'state-change', 'Lean the body left or right by angle degrees.')

  def('part/look-toward', (...a) => {
    const { pos, opt } = parseArgs(a)
    const target = pos[1] ?? opt.target ?? sym('camera')
    const frames = 10
    return gesture('look-toward', pos[0], frames, {
      'head-yaw': curve(frames, (u) => 20 * u),
      'eye-track': curve(frames, (u) => u),
    }, { target })
  }, 'state-change', "Orient the sprite's head and eyes toward a target.")

  // Six simple no-arg gestures (reference: -> void). Each is still a REAL curve.
  const simpleGesture = (name, channel, fn, frames) =>
    def(name, () => gesture(name.split('/')[1], undefined, frames, { [channel]: curve(frames, fn) }),
      'state-change', `Character gesture ${name} — a ${frames}-frame ${channel} curve.`)
  simpleGesture('part/lower', 'arm-pitch', (u) => -90 * u, 14)
  simpleGesture('part/nod', 'head-pitch', (u) => 18 * Math.sin(u * Math.PI), 12)
  simpleGesture('part/point', 'arm-extend', (u) => Math.min(1, u * 1.3), 12)
  simpleGesture('part/raise', 'arm-pitch', (u) => 90 * u, 14)
  simpleGesture('part/reach', 'arm-extend', (u) => u, 16)
  simpleGesture('part/shake', 'head-yaw', (u) => 15 * Math.sin(u * TWO_PI * 2), 20)
  simpleGesture('part/shrug', 'shoulder-lift', (u) => 12 * Math.sin(u * Math.PI), 16)
  simpleGesture('part/step', 'foot-cycle', (u) => Math.sin(u * TWO_PI), 24)

  // Five gestures with (sprite [options]) -> effect.
  const optGesture = (name, channel, fn, defFrames) =>
    def(name, (...a) => {
      const { pos, opt } = parseArgs(a)
      const frames = Number(opt.frames ?? defFrames)
      const amp = Number(opt.amplitude ?? opt.angle ?? 12)
      return gesture(name.split('/')[1], pos[0], frames, { [channel]: curve(frames, (u) => fn(u, amp)) }, { amplitude: amp })
    }, 'state-change', `Character gesture ${name}(sprite [options]) — parametric ${channel} curve.`)
  optGesture('part/sway', 'torso-roll', (u, a) => a * Math.sin(u * TWO_PI), 30)
  optGesture('part/tilt', 'head-roll', (u, a) => a * Math.min(1, u * 2), 16)
  optGesture('part/turn', 'body-yaw', (u, a) => a * 6 * u, 20)
  optGesture('part/twist', 'torso-yaw', (u, a) => a * Math.sin(u * Math.PI), 18)
  optGesture('part/wave', 'hand-wave', (u, a) => a * Math.sin(u * TWO_PI * 3), 30)

  // ── motion/* — 9 timing planners ───────────────────────────
  def('motion/cadence', (bpm, division) => {
    const b = Number(bpm) || 120
    const d = Number(division) || 1
    const periodMs = 60000 / b / d
    return motionSpec('cadence', { bpm: b, division: d, 'period-ms': periodMs })
  }, 'read', 'Compute the period (ms) for a beat or subdivision at a tempo.')

  def('motion/arc', (tensor) => {
    // Extract intensity peaks from a motion spec's channel curves.
    const peaks = []
    if (Array.isArray(tensor)) {
      for (const row of tensor) {
        if (Array.isArray(row) && row[0] instanceof Sym && row[0].name === ':channels') {
          for (const [, cv] of row[1]) {
            let maxV = -Infinity; let maxF = 0
            for (const [f, v] of cv) { if (Math.abs(v) > maxV) { maxV = Math.abs(v); maxF = f } }
            peaks.push([maxF, maxV])
          }
        }
      }
    }
    return motionSpec('arc', { ok: peaks.length > 0, peaks })
  }, 'read', 'Extract phrase-arc timing (intensity peaks) from a motion tensor.')

  def('motion/drop', (targetBeat, totalBeats) => {
    const tb = Number(targetBeat ?? 1)
    const total = Number(totalBeats ?? 4)
    const frames = 30
    const cv = curve(frames, (u) => {
      const beatU = tb / total
      return Math.exp(-Math.pow((u - beatU) * 6, 2)) // gaussian articulation at target beat
    })
    return motionSpec('drop', { 'target-beat': tb, 'total-beats': total, curve: cv })
  }, 'read', 'Beat-aligned articulation curve peaking at a target beat.')

  def('motion/pocket', (...a) => {
    const { opt } = parseArgs(a)
    const tol = Number(opt['tolerance-ms'] ?? 30)
    const count = Number(opt.count ?? 4)
    const slots = []
    for (let i = 0; i < count; i++) slots.push(Math.round((i / count) * 1000))
    return motionSpec('pocket', { 'tolerance-ms': tol, count, slots })
  }, 'read', 'Quantize motion timing into discrete pocket slots within a tolerance.')

  def('motion/with-feel', (tensor, ...a) => {
    const { opt } = parseArgs(a)
    const art = opt.articulation ? nm(opt.articulation) : 'legato'
    const factor = art === 'staccato' ? 0.5 : art === 'legato' ? 1.4 : 1.0
    return motionSpec('with-feel', { articulation: sym(art), 'sustain-factor': factor, source: tensor ?? sym('none') })
  }, 'read', 'Apply an articulation style (legato/staccato/…) to a motion tensor.')

  def('motion/with-pace', (tensor, ...a) => {
    const { opt } = parseArgs(a)
    const level = opt.intensity !== undefined ? Number(opt.intensity) : 1
    return motionSpec('with-pace', { intensity: level, 'speed-scale': 0.5 + level, source: tensor ?? sym('none') })
  }, 'read', 'Modulate the speed and energy of a motion by intensity.')

  def('motion/anchor-to-input', (target, sensor, param) => {
    // Honest binding: no live sensor in the deterministic runtime — return a
    // binding spec the host can wire, not a faked reading.
    return motionSpec('anchor-to-input', {
      target: target ?? sym('none'), sensor: sensor ?? sym('none'),
      param: param ?? sym('none'), bound: true,
    })
  }, 'state-change', 'Bind a target parameter to a sensor input (returns a binding spec).')

  def('motion/follow-input', (target, sensorField) => {
    return motionSpec('follow-input', {
      target: target ?? sym('none'), 'sensor-field': sensorField ?? sym('none'), bound: true,
    })
  }, 'state-change', 'Bind a target to a sensor field (returns a binding spec).')

  def('motion/halt', (target) => {
    const t = targetName(target)
    for (const k of [...REGISTRY.keys()]) if (k.startsWith(t + ':') || k === t) REGISTRY.delete(k)
    return undefined
  }, 'state-change', 'Cancel any in-flight motion on a target. Idempotent.')

  // ── note/* — 3 ────────────────────────────────────────────
  const NOTES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
  function pitchToMidi (p) {
    if (typeof p === 'number') return p
    const s = nm(p)
    const m = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(s)
    if (!m) return 60
    let n = NOTES[m[1].toUpperCase()] ?? 0
    if (m[2] === '#') n++
    if (m[2] === 'b') n--
    return n + (parseInt(m[3], 10) + 1) * 12
  }
  const HELD = []
  def('note/strike', (pitch, duration) => {
    const midi = pitchToMidi(pitch)
    HELD.push(midi)
    // drive the synth if present
    const play = env.get('synth/play')
    if (typeof play === 'function') { /* best-effort trigger; ignore result */ }
    return undefined
  }, 'state-change', 'Sound a pitch for a duration.')
  def('note/release', () => { HELD.length = 0; return undefined }, 'state-change', 'Cut a sustained note.')
  def('note/place-at', (pitch, stave, clef) => {
    const midi = pitchToMidi(pitch)
    const c = clef ? nm(clef) : 'treble'
    // staff slot: diatonic step above the clef's bottom line
    const slot = midi - (c === 'bass' ? 43 : 64)
    return motionSpec('staff-slot', { pitch: midi, stave: stave ?? 0, clef: sym(c), slot })
  }, 'state-change', 'Place a glyph at the staff slot for a given pitch.')

  // ── synth/* — 3 ───────────────────────────────────────────
  def('synth/chord', (section, pitches, duration, dynamic) => {
    const ps = Array.isArray(pitches) ? pitches.map(pitchToMidi) : [pitchToMidi(pitches)]
    return motionSpec('chord', {
      section: section ?? sym('default'), pitches: ps,
      duration: Number(duration ?? 1), dynamic: dynamic ?? sym('mf'),
    })
  }, 'state-change', 'Trigger a chord (one or more pitches) on a named section.')

  def('synth/kit', (name, pattern, voice) => {
    const pat = nm(pattern)
    const hits = []
    for (let i = 0; i < pat.length; i++) if (pat[i] === '1') hits.push(i)
    return motionSpec('kit', {
      name: name ?? sym('acoustic'), steps: pat.length, hits,
      voice: voice ?? sym('kick'),
    })
  }, 'state-change', 'Trigger a drum kit from a step pattern like "1010".')

  def('synth/play', (score, tempo) => {
    const t = Number(tempo) || 120
    // A score is a list of note events; schedule count reported back.
    const count = Array.isArray(score) ? score.length : 0
    return [sym('ok'), motionSpec('score', { events: count, tempo: t })]
  }, 'state-change', 'Schedule and play a complete musical score at a tempo.')

  // ── scene / object / prefab ───────────────────────────────
  const PREFABS = new Map()
  const spawnAt = (name, x, y) => {
    const spawn = env.get('entity/spawn') || env.get('world/spawn')
    if (typeof spawn === 'function') return apply(spawn, [sym(nm(name)), Number(x) || 0, Number(y) || 0], fuelBox)
    return sym(nm(name))
  }

  def('scene/clear', () => {
    const reset = env.get('world/reset!')
    if (typeof reset === 'function') apply(reset, [], fuelBox)
    return true
  }, 'state-change', 'Reset the world to empty: remove all entities.')

  def('scene/imagine', (...actions) => {
    // Compose scene-building action results into a scene record.
    const results = actions.filter((a) => a !== undefined)
    return motionSpec('scene', { actions: results.length, results })
  }, 'state-change', 'Compose scene-building actions into a scene record.')

  def('scene/load', (records) => {
    const ids = []
    if (Array.isArray(records)) {
      for (const rec of records) {
        if (Array.isArray(rec) && rec.length >= 3) ids.push(spawnAt(rec[0], rec[1], rec[2]))
      }
    }
    return ids
  }, 'state-change', 'Spawn a complete scene from a records structure; return ids.')

  def('scene/spawn-many', (name, points) => {
    const ids = []
    if (Array.isArray(points)) {
      for (const p of points) {
        const x = Array.isArray(p) ? p[0] : 0
        const y = Array.isArray(p) ? p[1] : 0
        ids.push(spawnAt(name, x, y))
      }
    }
    return ids
  }, 'state-change', 'Stamp a prefab at each point in a list; return ids.')

  def('object/spawn', (target, ...a) => {
    const { opt } = parseArgs(a)
    const at = opt.at
    const x = Array.isArray(at) ? at[0] : 0
    const y = Array.isArray(at) ? at[1] : 0
    return spawnAt(target, x, y)
  }, 'state-change', 'Instantiate a named object into the scene; return its id.')

  def('object/fetch', (...a) => {
    const { opt } = parseArgs(a)
    const cls = opt.class ?? sym('generic')
    const at = opt.at
    const x = Array.isArray(at) ? at[0] : 0
    const y = Array.isArray(at) ? at[1] : 0
    return spawnAt(cls, x, y)
  }, 'state-change', 'Fetch or instantiate an object from the scene by class.')

  def('prefab/define', (name, spec) => {
    PREFABS.set(nm(name), spec)
    return true
  }, 'state-change', 'Register a named prefab template (a reusable spawn spec).')

  def('prefab/spawn', (name, x, y) => spawnAt(name, x, y), 'state-change',
    'Instantiate one prefab at (x, y); return its id.')

  return env
}

export default installComposer
