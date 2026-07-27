// synth.js — extra synth voice families beyond core drum kit.
//
// Provenance: 2026-07-22 (Motoi wire-up). The reference documents
// several named synth patches — 808 (Roland TR-808 style analog kit),
// sp1200 (E-mu SP-1200 12-bit sampler feel), orchestra (multi-voice
// blend), orch (a shorthand for orchestra) — plus utility verbs for
// loading a JSON score and mapping onset detection to a tap tempo.
//
// Doctrine (Alfred, 2026-07-16): audio DSP is honest. When a real
// synthesizer sidecar isn't wired, these verbs push shape-preserving
// events onto the timeline and return 'ok. Kids can compose songs
// without a sound card; the events still exist for downstream review.

import { Sym } from '../../src/reader.js'
import { getSoundEngine, parsePitch, parseDuration } from './sound.js'

const nm = (x) => (x instanceof Sym ? x.name : x)


// ── inline registration metadata (2026-07-22) ────────────────────
// See engineering/HOW-TO-REGISTER-A-VERB.md.
export const VERBS = [
  "synth/808",
  "synth/load-score",
  "synth/onset-tap",
  "synth/orch",
  "synth/orchestra",
  "synth/sp1200",
]
export const LAZY = false

export function installSynth(env, fuel) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  const engine = () => getSoundEngine()

  // Character map for TR-808 drum voices. Each name maps to an
  // approximate frequency the fallback bell/sfx can use as a proxy.
  const T808 = {
    kick: 55, snare: 200, 'closed-hat': 8000, 'open-hat': 6000,
    'low-tom': 90, 'mid-tom': 140, 'hi-tom': 220,
    clap: 1200, rimshot: 1800, cowbell: 800, cymbal: 5000,
  }

  // (synth/808 voice step?) — trigger a TR-808 style hit. voice is a
  // symbol like 'kick 'snare 'closed-hat 'clap.
  def('synth/808', (voice, step) => {
    try {
      const e = engine()
      const vn = nm(voice) || 'kick'
      const freq = T808[vn] ?? 200
      e.sfx('808', freq, 0.12, { patch: vn, step: step ?? 0 })
      return new Sym('ok')
    } catch { return new Sym('error') }
  }, 'paint')

  // (synth/sp1200 sample-name pitch? dur?) — SP-1200 style sampler.
  // Records a 'sample event on the timeline; adapter decides how it
  // sounds. Pitch defaults to A3; duration to 0.25s.
  def('synth/sp1200', (sample, pitch, dur) => {
    try {
      const e = engine()
      const sn = nm(sample) || 'kick'
      const p = pitch != null ? pitch : 'A3'
      const freq = typeof p === 'number' ? p : parsePitch(p)
      const seconds = parseDuration(dur ?? 0.25, e.bpm)
      const event = { kind: 'sample', engine: 'sp1200', sample: sn, freq, dur: seconds, at: e.cursor }
      e.timeline.push(event)
      e.cursor += seconds
      try { e.adapter.play({ ...event, kind: 'note' }) } catch { /* ignore */ }
      return new Sym('ok')
    } catch { return new Sym('error') }
  }, 'paint')

  // (synth/orchestra voice-map pitch dur?) — trigger multiple voices
  // as a single blend. voice-map is a list of (voice weight) pairs.
  // Returns 'ok on schedule; 'error on shape mismatch.
  def('synth/orchestra', (voices, pitch, dur) => {
    if (!Array.isArray(voices)) return new Sym('error')
    try {
      const e = engine()
      const seconds = parseDuration(dur ?? 0.5, e.bpm)
      const savedCursor = e.cursor
      const p = pitch != null ? pitch : 'C4'
      const freq = typeof p === 'number' ? p : parsePitch(p)
      for (const pair of voices) {
        if (!Array.isArray(pair) || pair.length < 2) continue
        const voice = nm(pair[0])
        const weight = Number(pair[1]) || 1
        e.cursor = savedCursor
        const event = { kind: 'orchestra', voice, weight, freq, dur: seconds, at: e.cursor }
        e.timeline.push(event)
        try { e.adapter.play({ ...event, kind: 'note' }) } catch { /* ignore */ }
      }
      e.cursor = savedCursor + seconds
      return new Sym('ok')
    } catch { return new Sym('error') }
  }, 'paint')

  // (synth/orch . voices) — shorthand for orchestra with equal weights.
  // Kids can write (synth/orch 'strings 'brass 'winds) without a map.
  def('synth/orch', (...voices) => {
    try {
      const e = engine()
      const seconds = parseDuration(0.5, e.bpm)
      const savedCursor = e.cursor
      for (const v of voices) {
        const voice = nm(v)
        e.cursor = savedCursor
        const event = { kind: 'orchestra', voice, weight: 1, dur: seconds, at: e.cursor }
        e.timeline.push(event)
        try { e.adapter.play({ ...event, kind: 'note' }) } catch { /* ignore */ }
      }
      e.cursor = savedCursor + seconds
      return new Sym('ok')
    } catch { return new Sym('error') }
  }, 'paint')

  // (synth/load-score score) — accept a list of (pitch dur velocity?)
  // tuples and schedule them sequentially. Returns count of scheduled
  // events, or 'error on shape mismatch.
  def('synth/load-score', (score) => {
    if (!Array.isArray(score)) return new Sym('error')
    let count = 0
    try {
      const e = engine()
      for (const item of score) {
        if (!Array.isArray(item) || item.length < 1) continue
        const [pitch, dur, vel] = item
        try {
          e.note(pitch, dur ?? 0.25, vel)
          count++
        } catch { /* skip malformed */ }
      }
      return count
    } catch { return new Sym('error') }
  }, 'paint')

  // (synth/onset-tap onset-strength) — feed instantaneous onset
  // strength (0..1) and adjust engine bpm via a simple tap-tempo
  // estimator. Returns the current bpm. First tap sets tap-time; each
  // subsequent tap above threshold updates bpm to (60 / delta).
  const tapState = { lastTap: 0 }
  def('synth/onset-tap', (strength) => {
    const s = Number(strength) || 0
    const e = engine()
    if (s < 0.5) return e.bpm
    const now = Date.now() / 1000
    const dt = now - tapState.lastTap
    if (tapState.lastTap > 0 && dt > 0.15 && dt < 3.0) {
      // Smooth toward the new bpm to avoid noisy taps swamping the value.
      const newBpm = 60 / dt
      e.bpm = Math.round((e.bpm * 0.6 + newBpm * 0.4))
    }
    tapState.lastTap = now
    return e.bpm
  }, 'paint')

  return env
}

export default installSynth
