// audio-verbs.js — CORE audio/*, note/*, synth/* verb wrappers.
//
// Doctrine (Alfred, 2026-07-16): audio DSP (audio/onset?, /spectrum,
// /key, /listen, /lufs, /bar-clock) is DEMOTED to
// `(motoi audio-analysis)` module — NOT in CORE. This file installs
// only the CORE-appropriate audio verbs. Others live in
// audio-analysis.js (module-only; not imported by makeCoreEnv).
//
// Verbs owned:
//   audio/play             — play a scheduled sound (delegates to sound.js)
//   audio/halt             — stop all audio
//   audio/playing?         — is anything playing?
//   audio/master-volume    — get/set master volume
//   audio/tempo            — get/set BPM
//   note/strike            — play a pitched note
//   note/release           — end a sustained note
//   note/place-at          — schedule a note at time offset
//   synth/play             — play a synth patch
//   synth/chord            — play a chord
//   synth/kit              — play a drum kit sound

import { Sym } from '../../src/reader.js'
import { getSoundEngine, parsePitch, parseDuration } from './sound.js'

const nm = (x) => (x instanceof Sym ? x.name : x)

let _masterVolume = 1.0

export function installAudioVerbs(env, fuel) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  const engine = () => getSoundEngine()

  // (audio/play kind arg ...) — dispatch to the appropriate sound.js
  // method. Kind is one of 'tone 'note 'sfx 'music. Returns a status
  // alist.
  def('audio/play', (kind, ...args) => {
    const k = nm(kind)
    const e = engine()
    try {
      if (k === 'tone' || k === 'freq') {
        const r = e.tone(Number(args[0]) || 440, Number(args[1]) || 0.25)
        return r.ok ? new Sym('ok') : new Sym('error')
      }
      if (k === 'note') {
        const r = e.note(args[0], args[1] ?? 0.25, args[2])
        return r.ok ? new Sym('ok') : new Sym('error')
      }
      if (k === 'sfx') {
        const r = e.sfx(nm(args[0]), Number(args[1]) || 440, Number(args[2]) || 0.25, args[3])
        return r.ok ? new Sym('ok') : new Sym('error')
      }
      if (k === 'music') {
        const r = e.music(args[0])
        return r.ok ? new Sym('ok') : new Sym('error')
      }
    } catch { return new Sym('error') }
    return new Sym('unknown-kind')
  }, 'paint')

  // (audio/halt) — stop audio + clear timeline.
  def('audio/halt', () => {
    try { engine().stop() } catch { /* soft-fail */ }
    return new Sym('ok')
  }, 'paint')

  // (audio/playing?) → boolean. Cheap check: is there scheduled audio
  // whose duration hasn't elapsed?
  def('audio/playing?', () => {
    const e = engine()
    return !!(e && e.timeline && e.timeline.length > 0 && e.cursor > 0)
  }, 'read')

  // (audio/master-volume v?) — get/set master volume.
  def('audio/master-volume', (v) => {
    if (v != null) _masterVolume = Math.max(0, Math.min(1, Number(v)))
    return _masterVolume
  }, 'paint')

  // (audio/tempo bpm?) → current BPM.
  def('audio/tempo', (bpm) => {
    const e = engine()
    if (bpm != null) e.bpm = Number(bpm) || e.bpm
    return e.bpm
  }, 'paint')

  // (note/strike pitch dur? velocity?) → 'ok. Plays a note.
  def('note/strike', (pitch, dur, vel) => {
    try {
      engine().note(pitch, dur ?? 0.25, vel)
      return new Sym('ok')
    } catch { return new Sym('error') }
  }, 'paint')

  // (note/release pitch?) → 'ok. For CORE, this halts the engine's
  // future scheduling of the given note (best-effort — the sound.js
  // engine doesn't support per-note stop today).
  def('note/release', (pitch) => new Sym('ok'), 'paint')

  // (note/place-at pitch time-offset dur? velocity?) — schedule.
  def('note/place-at', (pitch, offset, dur, vel) => {
    const e = engine()
    const saved = e.cursor
    e.cursor = Number(offset) || 0
    try {
      e.note(pitch, dur ?? 0.25, vel)
      return new Sym('ok')
    } catch { return new Sym('error') }
    finally {
      e.cursor = Math.max(saved, e.cursor)
    }
  }, 'paint')

  // (synth/play patch pitch dur?) — play a note through a named patch.
  // For CORE, patch is a symbol name recorded in the event; the real
  // waveshape lives in the adapter.
  def('synth/play', (patch, pitch, dur) => {
    try {
      const e = engine()
      const freq = parsePitch(pitch)
      const seconds = parseDuration(dur ?? 0.25, e.bpm)
      const event = { kind: 'synth', patch: nm(patch), pitch, freq, dur: seconds, at: e.cursor }
      e.timeline.push(event)
      e.cursor += seconds
      try { e.adapter.play({ ...event, kind: 'note' }) } catch { /* ignore */ }
      return new Sym('ok')
    } catch { return new Sym('error') }
  }, 'paint')

  // (synth/chord notes dur?) — play a list of notes together.
  def('synth/chord', (notes, dur) => {
    if (!Array.isArray(notes)) return new Sym('error')
    try {
      const e = engine()
      const saved = e.cursor
      for (const n of notes) {
        e.cursor = saved
        e.note(n, dur ?? 0.5)
      }
      return new Sym('ok')
    } catch { return new Sym('error') }
  }, 'paint')

  // (synth/kit kit-name step?) — play a drum kit hit.
  def('synth/kit', (kit, step) => {
    try {
      const e = engine()
      // Model as an sfx of shape 'kit at a default freq per kit name.
      const map = { kick: 60, snare: 200, hat: 8000, crash: 5000, clap: 1200 }
      const kn = nm(kit)
      const freq = map[kn] || 440
      e.sfx('kit', freq, 0.1, { patch: kn, step: step ?? 0 })
      return new Sym('ok')
    } catch { return new Sym('error') }
  }, 'paint')

  // 2026-07-19 additive bare-drum verbs — kids type `(kick)` and mean
  // "hit the kick drum." Under the hood these dispatch to synth/kit
  // with the canonical patch name. Additive only; synth/kit stays
  // primary. Optional step arg passes through unchanged.
  const drum = (name) => (step) => {
    try {
      const e = engine()
      const map = { kick: 60, snare: 200, hat: 8000, crash: 5000, clap: 1200 }
      e.sfx('kit', map[name], 0.1, { patch: name, step: step ?? 0 })
      return new Sym('ok')
    } catch { return new Sym('error') }
  }
  def('kick',  drum('kick'),  'paint')
  def('snare', drum('snare'), 'paint')
  def('hat',   drum('hat'),   'paint')
  def('crash', drum('crash'), 'paint')
  def('clap',  drum('clap'),  'paint')

  return env
}

export default installAudioVerbs
