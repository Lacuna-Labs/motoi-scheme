// lib/audio/dsp.js — Motoi Scheme · the real audio DSP backend.
//
// Created 2026-07-25. Replaces the ripped Curator audio-* client stubs
// (core/index.js §"Curator game-object client verbs … ripped 2026-07-25")
// with a genuine, dependency-free digital-signal engine. Everything here is
// real math on a real sample buffer: a hand-rolled radix-2 FFT, log-spaced
// spectrum bands, RMS / peak / LUFS meters, spectral-flux onset detection,
// tempo-locked beat phase, and a chroma-based key estimator.
//
// The fantasy-console model: Motoi has ONE internal mixer. `audio/play`
// pushes a voice into it; each analysis verb renders the mixer's current
// window and measures it. No microphone, no OS sound card, no native npm —
// the signal the program reacts to is the signal the console synthesizes,
// so a `.scm` program produces the SAME analysis on every machine. That is
// the "emit scheme without the LLM" contract: deterministic audio.
//
// Provenance: Motoi-own (fantasy-console audio). DSP math is textbook —
// Cooley-Tukey FFT, Krumhansl-Schmuckler key profiles, ITU-R BS.1770 LUFS
// gating (single-frame approximation). Analysis conventions mirror the
// audio-reactive verbs the reference chapter 07-audio documents.

import { Sym } from '../../src/reader.js'

import { seqVerb } from '../base/list.js'
// ── constants ────────────────────────────────────────────────────
const SR = 44100 // sample rate (Hz)
const N = 1024 // analysis window (power of two, for radix-2 FFT)
const FPS = 60 // logical frames per second (console frame clock)
const BANDS = 32 // spectrum band count

// ── module singleton: the mixer + clock ──────────────────────────
function freshEngine () {
  return {
    playing: false,
    master: 1.0,
    tempo: 120, // beats per minute
    tempoSet: false, // has the program declared a tempo/played anything?
    frame: 0, // logical frame counter
    voices: [], // [{ seed, freq, gain }]
    _cacheFrame: -1, // memo guard for renderWindow
    _buf: new Float32Array(N),
    _mag: new Float32Array(N / 2),
    _bands: new Float32Array(BANDS),
    _prevBands: new Float32Array(BANDS),
    _flux: 0,
  }
}
let A = freshEngine()

export function resetAudioEngine () { A = freshEngine() }

// ── deterministic string → seed (FNV-1a) ─────────────────────────
function seedOf (s) {
  let h = 0x811c9dc5
  const str = String(s)
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

// A voice's fundamental is chosen from a pentatonic set by its seed so
// different resource names sound like different notes — deterministically.
const PENTATONIC = [220, 246.94, 293.66, 329.63, 392.0, 440, 493.88, 587.33]
function voiceFor (name) {
  const seed = seedOf(name)
  return { seed, freq: PENTATONIC[seed % PENTATONIC.length], gain: 0.6 }
}

// ── the signal: render the current N-sample window ───────────────
// Sum every voice (fundamental + two harmonics) plus a kick transient at
// each beat boundary, scaled by master volume. Fully determined by
// A.frame, A.tempo, A.voices — no wall clock, no randomness.
function renderWindow () {
  if (A._cacheFrame === A.frame) return A._buf
  const buf = A._buf
  buf.fill(0)
  const t0 = A.frame / FPS // window start time (s)
  const beatPeriod = 60 / (A.tempo || 120) // seconds per beat
  if (A.playing && A.voices.length) {
    for (let i = 0; i < N; i++) {
      const t = t0 + i / SR
      let s = 0
      for (const v of A.voices) {
        s += v.gain * Math.sin(2 * Math.PI * v.freq * t)
        s += v.gain * 0.35 * Math.sin(2 * Math.PI * v.freq * 2 * t)
        s += v.gain * 0.18 * Math.sin(2 * Math.PI * v.freq * 3 * t)
      }
      // kick: a decaying 60 Hz thump in the first 80 ms after each beat.
      const phase = t % beatPeriod
      if (phase < 0.08) {
        const env = Math.exp(-phase * 40)
        s += 1.1 * env * Math.sin(2 * Math.PI * 60 * phase)
      }
      buf[i] = (s / (A.voices.length + 1)) * A.master
    }
  }
  A._cacheFrame = A.frame
  computeSpectrum(buf)
  return buf
}

// ── radix-2 Cooley-Tukey FFT (in-place, iterative) ───────────────
// re/im are length-N Float64Arrays. Decimation-in-time, bit-reversal
// permutation up front. Textbook; no dependencies.
function fft (re, im) {
  const n = re.length
  // bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    const wr = Math.cos(ang)
    const wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let cr = 1
      let ci = 0
      for (let k = 0; k < len / 2; k++) {
        const a = i + k
        const b = i + k + len / 2
        const tr = re[b] * cr - im[b] * ci
        const ti = re[b] * ci + im[b] * cr
        re[b] = re[a] - tr
        im[b] = im[a] - ti
        re[a] += tr
        im[a] += ti
        const ncr = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = ncr
      }
    }
  }
}

// Compute magnitude spectrum + log-spaced 32-band summary + spectral flux.
function computeSpectrum (buf) {
  const re = new Float64Array(N)
  const im = new Float64Array(N)
  for (let i = 0; i < N; i++) {
    // Hann window to reduce spectral leakage.
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1))
    re[i] = buf[i] * w
  }
  fft(re, im)
  const half = N / 2
  for (let i = 0; i < half; i++) {
    A._mag[i] = Math.hypot(re[i], im[i]) / half
  }
  // fold FFT bins into BANDS log-spaced buckets over [1, half)
  A._prevBands.set(A._bands)
  const lo = 1
  const hi = half
  let flux = 0
  for (let b = 0; b < BANDS; b++) {
    const f0 = Math.floor(lo * Math.pow(hi / lo, b / BANDS))
    const f1 = Math.max(f0 + 1, Math.floor(lo * Math.pow(hi / lo, (b + 1) / BANDS)))
    let acc = 0
    let cnt = 0
    for (let k = f0; k < f1 && k < half; k++) { acc += A._mag[k]; cnt++ }
    const v = cnt ? acc / cnt : 0
    A._bands[b] = v
    const d = v - A._prevBands[b]
    if (d > 0) flux += d // half-wave rectified spectral flux
  }
  A._flux = flux
}

// ── meters ───────────────────────────────────────────────────────
function rms () {
  const buf = renderWindow()
  let s = 0
  for (let i = 0; i < N; i++) s += buf[i] * buf[i]
  return Math.sqrt(s / N)
}
function peak () {
  const buf = renderWindow()
  let p = 0
  for (let i = 0; i < N; i++) { const a = Math.abs(buf[i]); if (a > p) p = a }
  return p
}
// ITU-R BS.1770-style momentary loudness (single-window approximation,
// no K-weighting filter — good enough for a fantasy console's meter).
function lufs () {
  const ms = Math.pow(rms(), 2)
  if (ms < 1e-9) return false // gated: silence returns #f
  return -0.691 + 10 * Math.log10(ms)
}

// ── beat / onset / tempo ─────────────────────────────────────────
function beatPeriodFrames () { return Math.max(1, Math.round((60 / (A.tempo || 120)) * FPS)) }
function onBeat () {
  if (!A.playing) return false
  return A.frame % beatPeriodFrames() === 0
}
function onsetStrength () { renderWindow(); return A._flux }
function isOnset () {
  if (!A.playing) return false
  // A percussive transient: either a beat boundary, or spectral flux above
  // an adaptive threshold (mean band energy).
  if (onBeat()) return true
  renderWindow()
  let mean = 0
  for (let b = 0; b < BANDS; b++) mean += A._bands[b]
  mean /= BANDS
  return A._flux > mean * 1.5
}

// ── key detection (Krumhansl-Schmuckler) ─────────────────────────
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const KS_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
const KS_MINOR = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
function chroma () {
  renderWindow()
  const c = new Float64Array(12)
  const half = N / 2
  for (let k = 1; k < half; k++) {
    const f = (k * SR) / N
    if (f < 27.5 || f > 4200) continue
    const midi = 69 + 12 * Math.log2(f / 440)
    const pc = ((Math.round(midi) % 12) + 12) % 12
    c[pc] += A._mag[k]
  }
  return c
}
function correlate (v, profile, shift) {
  let sv = 0; let sp = 0
  for (let i = 0; i < 12; i++) { sv += v[i]; sp += profile[i] }
  const mv = sv / 12; const mp = sp / 12
  let num = 0; let dv = 0; let dp = 0
  for (let i = 0; i < 12; i++) {
    const a = v[(i + shift) % 12] - mv
    const b = profile[i] - mp
    num += a * b; dv += a * a; dp += b * b
  }
  const den = Math.sqrt(dv * dp)
  return den ? num / den : 0
}
function detectKey () {
  if (!A.playing) return false
  const c = chroma()
  let best = { score: -2, note: 0, mode: 'major' }
  for (let s = 0; s < 12; s++) {
    const maj = correlate(c, KS_MAJOR, s)
    const min = correlate(c, KS_MINOR, s)
    if (maj > best.score) best = { score: maj, note: s, mode: 'major' }
    if (min > best.score) best = { score: min, note: s, mode: 'minor' }
  }
  const conf = Math.max(0, Math.min(1, (best.score + 1) / 2))
  return [NOTE_NAMES[best.note], best.mode, conf]
}

// ── list/vector helpers for Motoi values ─────────────────────────
function bandsList () { renderWindow(); return Array.from(A._bands) }
function spectrumVec () { renderWindow(); return Array.from(A._bands) }
// perceptual bands: A-weighting-ish emphasis on mid bands.
function perceptualBands () {
  renderWindow()
  return Array.from(A._bands).map((v, b) => {
    const centre = BANDS / 3
    const w = 1 / (1 + Math.abs(b - centre) / centre)
    return v * (0.5 + w)
  })
}

// ── handles (callable native procs) ──────────────────────────────
// audio-play / audio/play → an AudioHandle: a proc that answers messages.
function makeAudioHandle (name) {
  const id = seedOf(name)
  const h = (msg) => {
    const m = msg instanceof Sym ? msg.name : String(msg)
    switch (m) {
      case 'id': return id
      case 'name': return name
      case 'halt': A.playing = A.voices.length > 1; return new Sym('halted')
      case 'playing?': return A.playing
      default: return new Sym('audio-handle')
    }
  }
  h.__audioHandle = { id, name }
  return h
}
// audio/bar-clock → a clock proc answering 'phase and 'radians, aligned to
// bars (bars-per-rotation beats each).
function makeBarClock (handle, barsPerRotation) {
  const bars = Number(barsPerRotation) || 4
  const clock = (msg) => {
    const m = msg instanceof Sym ? msg.name : String(msg)
    const beatPeriod = 60 / (A.tempo || 120)
    const t = A.frame / FPS
    const rotationPeriod = beatPeriod * bars
    const phase = (t % rotationPeriod) / rotationPeriod
    if (m === 'phase') return phase
    if (m === 'radians') return phase * 2 * Math.PI
    if (m === 'bars') return bars
    return new Sym('bar-clock')
  }
  clock.__barClock = { bars }
  return clock
}

// ── the installer ────────────────────────────────────────────────
export const VERBS = [
  // playback / transport
  'audio-play', 'audio/play', 'audio-halt', 'audio/halt',
  'audio-master-volume', 'audio/master-volume', 'audio-tempo', 'audio/tempo',
  'audio-time', 'audio-playing?', 'audio/playing?',
  // clocks
  'audio-bar-clock', 'audio/bar-clock',
  // spectrum
  'audio-bands', 'audio-band', 'audio-perceptual-bands', 'audio/spectrum',
  // meters
  'audio-rms', 'audio-peak', 'audio/lufs',
  // rhythm
  'audio-beat?', 'audio-bpm', 'audio/onset?', 'audio/onset-strength',
  // key + input
  'audio/key', 'audio/listen', 'audio/transcribe-with-cloud-help',
  // frame pump
  'audio-tick!',
]
export const LAZY = false

export function installAudioDsp (env, fuel) {
  const def = (n, f, perm = 'read', doc = '') =>
    env.define(n, seqVerb(f), { perm, doc, namespace: 'audio', tier: 'operator' })

  // ── transport ──────────────────────────────────────────────
  const play = (resource) => {
    const name = resource == null ? 'sound' : (resource instanceof Sym ? resource.name : String(resource))
    A.playing = true
    A.tempoSet = true
    A.voices.push(voiceFor(name))
    A._cacheFrame = -1
    return makeAudioHandle(name)
  }
  def('audio-play', play, 'state-change', 'Begin playing a named audio source; returns an AudioHandle.')
  def('audio/play', (resource) => play(resource), 'state-change',
    'Start playback of a named audio resource; returns a zero-duration AudioHandle.')

  const halt = (handle) => {
    if (A.voices.length) A.voices.pop()
    if (!A.voices.length) A.playing = false
    A._cacheFrame = -1
    return typeof handle === 'function' ? handle : new Sym('halted')
  }
  def('audio-halt', halt, 'state-change', 'Stop playback on a handle; returns the handle.')
  def('audio/halt', halt, 'state-change', 'Stop a previously started audio source.')

  const setVol = (level) => {
    A.master = Math.max(0, Math.min(1, Number(level) || 0))
    return makeAudioHandle('master')
  }
  def('audio-master-volume', setVol, 'state-change', 'Set global volume (0..1); returns an AudioHandle.')
  def('audio/master-volume', setVol, 'state-change', 'Set master output volume (0..1) for all audio.')

  const setTempo = (bpm) => {
    if (bpm !== undefined) { A.tempo = Math.max(1, Number(bpm) || 120); A.tempoSet = true }
    return A.tempo
  }
  def('audio-tempo', (bpm) => { setTempo(bpm); return makeAudioHandle('tempo') }, 'state-change',
    'Set playback tempo in BPM; returns a zero-duration AudioHandle.')
  def('audio/tempo', () => A.tempo, 'read', 'Return the current tempo in beats per minute.')

  def('audio-time', () => A.frame / FPS, 'read', 'Elapsed time of the audio clock, in seconds.')
  def('audio-playing?', () => A.playing, 'read', 'Whether the audio system is currently producing signal.')
  def('audio/playing?', () => A.playing && rms() > 1e-4, 'read',
    'Whether the live audio contains audible signal this frame.')

  // ── clocks ─────────────────────────────────────────────────
  def('audio-bar-clock', (handle, bars) => makeBarClock(handle, bars), 'read',
    'Create a bar-aligned clock from a handle; answers (clock \'phase) and (clock \'radians).')
  def('audio/bar-clock', (handle, bars) => makeBarClock(handle, bars), 'read',
    'Derive a rotational clock from a playback handle, aligned to bars.')

  // ── spectrum ───────────────────────────────────────────────
  def('audio-bands', () => bandsList(), 'read', 'Fresh list of the 32 current spectrum band magnitudes.')
  def('audio-band', (n) => {
    const b = bandsList()
    const i = Math.max(0, Math.min(BANDS - 1, Number(n) | 0))
    return b[i]
  }, 'read', 'Magnitude of the n-th frequency band (0..31).')
  def('audio-perceptual-bands', () => perceptualBands(), 'read',
    'Spectrum bands adjusted for perceptual (mid-emphasis) weighting.')
  def('audio/spectrum', () => spectrumVec(), 'read', 'A 32-element vector of frequency magnitudes.')

  // ── meters ─────────────────────────────────────────────────
  def('audio-rms', () => rms(), 'read', 'Instantaneous RMS audio energy (0..1).')
  def('audio-peak', () => peak(), 'read', 'Peak (maximum) amplitude of the current audio window.')
  def('audio/lufs', () => lufs(), 'read', 'Perceived loudness (LUFS), or #f during silence.')

  // ── rhythm ─────────────────────────────────────────────────
  def('audio-beat?', () => onBeat(), 'read', 'Whether the current frame lands on a musical beat.')
  def('audio-bpm', () => (A.tempoSet ? A.tempo : false), 'read', 'Detected BPM of the playing audio, or #f.')
  def('audio/onset?', () => isOnset(), 'read', 'Whether a percussive transient occurs this frame.')
  def('audio/onset-strength', () => onsetStrength(), 'read', 'Scalar [0,∞) onset likelihood (spectral flux).')

  // ── key + input ────────────────────────────────────────────
  def('audio/key', () => detectKey(), 'read', 'Detected [note mode confidence], or #f if nothing is playing.')
  def('audio/listen', () => {
    // A deterministic console has no microphone; report the internal mixer
    // as the "live" envelope so audio-reactive programs run headless.
    A.playing = A.playing || A.voices.length > 0
    return [new Sym('ok'), rms()]
  }, 'state-change', 'Activate the live audio analyser; returns [status envelope].')
  def('audio/transcribe-with-cloud-help', (hint) => {
    // Honest deferral: transcription needs a cloud model, absent in the
    // deterministic runtime. Return a pending-cloud-help marker, no fabrication.
    return [new Sym('pending-cloud-help'), hint == null ? new Sym('none') : hint]
  }, 'read', 'Request cloud transcription of audio input; returns a pending marker.')

  // ── frame pump ─────────────────────────────────────────────
  def('audio-tick!', (n) => {
    const steps = n === undefined ? 1 : Math.max(1, Number(n) | 0)
    A.frame += steps
    A._cacheFrame = -1
    return A.frame
  }, 'state-change', 'Advance the audio frame clock by n frames (default 1).')

  return env
}

export default installAudioDsp
