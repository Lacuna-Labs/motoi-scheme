// sound.js — the sound engine core.
//
// Provenance: scheme-lang/src/sound.js. Migrated to
// motoi-scheme/lib/audio/ on 2026-07-16 (Pass-3 Wave 1). Env var
// renamed SAKURA_SOUND → MOTOI_SOUND (backwards-compat: also honors
// SAKURA_SOUND).
//
// One timeline, many adapters. This module keeps a scheduled list of
// sound events. The `webaudio` adapter plays them in the browser; the
// `nodespeaker` adapter tries to hit `speaker` (npm) if it's installed;
// otherwise we fall back to the terminal bell (BEL, \x07).
//
// The engine itself is synthesis-agnostic: `tone`, `note`, `sfx`,
// `music`, `silence` all push a structured event onto the timeline.
// Adapters translate events → audible output.

// ── pitch parsing ───────────────────────────────────────────────────
//
// Accept a wide variety of pitch strings:
//   'A4', 'C#4', 'Db4', 'Gs3' (s = sharp), 'Bflat5'
// Anything unparseable throws.

const NOTE_BASE = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }

export function parsePitch(str) {
  // Accept a MIDI note number directly (60 = middle C).
  if (typeof str === 'number' && Number.isFinite(str)) return midiToFreq(str)
  // Accept Sym objects — unwrap to string name.
  if (str && typeof str === 'object' && typeof str.name === 'string') str = str.name
  if (typeof str !== 'string') throw new Error('parsePitch: expected string, symbol, or MIDI number')
  const s = str.trim()
  const m = s.match(/^([A-Ga-g])([#s]|b|flat|sharp)?(-?\d+)$/)
  if (!m) throw new Error(`unrecognized pitch: ${str}`)
  const letter = m[1].toLowerCase()
  let accidental = 0
  const acc = (m[2] || '').toLowerCase()
  if (acc === '#' || acc === 's' || acc === 'sharp') accidental = 1
  else if (acc === 'b' || acc === 'flat') accidental = -1
  const octave = +m[3]
  const semitone = NOTE_BASE[letter] + accidental
  const midi = 12 * (octave + 1) + semitone
  return midiToFreq(midi)
}

function midiToFreq(midi) {
  // A4 = 69 = 440 Hz. Standard equal-tempered tuning.
  return 440 * Math.pow(2, (midi - 69) / 12)
}

// Duration string → seconds. Accepts symbols like 'quarter, 'half, or
// a raw number.
export function parseDuration(d, bpm = 120) {
  if (typeof d === 'number') return d
  if (d && typeof d === 'object' && d.name) d = d.name
  if (typeof d !== 'string') return 0.25
  const beat = 60 / bpm
  switch (d.toLowerCase()) {
    case 'whole':      return beat * 4
    case 'half':       return beat * 2
    case 'quarter':    return beat
    case 'eighth':     return beat / 2
    case 'sixteenth':  return beat / 4
    case 'thirtysecond': case 'thirty-second': return beat / 8
    default:
      const n = parseFloat(d)
      return isNaN(n) ? 0.25 : n
  }
}

// ── the engine ──────────────────────────────────────────────────────

class SoundEngine {
  constructor() {
    // Timeline of scheduled events. Cleared by stop().
    this.timeline = []
    // Wall clock offset — where along the timeline we are.
    this.cursor = 0
    // Currently-configured adapter. Default to the terminal-bell fallback
    // so that headless tests work without pulling any native deps.
    this.adapter = new BellAdapter()
    // BPM used for symbolic durations ('quarter, 'half, …).
    this.bpm = 120
  }

  setAdapter(a) { this.adapter = a }

  // ── verbs ──────────────────────────────────────────────────────

  tone(freq, dur) {
    const event = { kind: 'tone', freq, dur, at: this.cursor }
    this.timeline.push(event)
    this.cursor += dur
    this.adapter.play(event)
    return { ok: true, kind: 'tone', freq, dur }
  }

  note(pitch, dur, vel) {
    const freq = parsePitch(pitch)
    const seconds = parseDuration(dur, this.bpm)
    const event = { kind: 'note', pitch, freq, dur: seconds, vel, at: this.cursor }
    this.timeline.push(event)
    this.cursor += seconds
    this.adapter.play(event)
    return { ok: true, kind: 'note', pitch, freq, dur: seconds, vel }
  }

  sfx(kind, freq, dur, spec) {
    const event = { kind: 'sfx', shape: kind, freq, dur, spec, at: this.cursor }
    this.timeline.push(event)
    this.cursor += dur
    this.adapter.play(event)
    return { ok: true, kind: 'sfx', shape: kind, freq, dur }
  }

  music(track) {
    const event = { kind: 'music', track, at: this.cursor }
    this.timeline.push(event)
    this.adapter.play(event)
    return { ok: true, kind: 'music', track }
  }

  silence(dur) {
    const event = { kind: 'silence', dur, at: this.cursor }
    this.timeline.push(event)
    this.cursor += dur
    return { ok: true, kind: 'silence', dur }
  }

  stop() {
    this.timeline.length = 0
    this.cursor = 0
    if (this.adapter && typeof this.adapter.stop === 'function') this.adapter.stop()
  }

  // Snapshot for save-cart.
  snapshot() {
    return { timeline: this.timeline.slice(), bpm: this.bpm }
  }

  // Restore from a save-cart snapshot.
  restore(snap) {
    this.timeline = (snap.timeline || []).slice()
    this.bpm = snap.bpm || 120
    this.cursor = this.timeline.reduce((c, e) => c + (e.dur || 0), 0)
  }
}

// ── adapters ────────────────────────────────────────────────────────

// The terminal-bell fallback. Every note / tone triggers a BEL character
// so the user gets audible feedback even on a machine with no audio
// deps installed. Silent on non-TTY (piped) stdout.
export class BellAdapter {
  play(event) {
    if (event.kind === 'silence') return
    // Env var: MOTOI_SOUND=off silences the bell. SAKURA_SOUND=off is
    // honored as a backwards-compat alias for Sakura-dialect consumers.
    const soundEnv = process.env.MOTOI_SOUND ?? process.env.SAKURA_SOUND
    if (process.stdout && process.stdout.isTTY && soundEnv !== 'off') {
      try { process.stdout.write('\x07') } catch { /* ignore */ }
    }
  }
  stop() {}
}

// The webaudio adapter. Only usable in a browser context — throws if
// asked to play in Node.
export class WebAudioAdapter {
  constructor(ctx) {
    if (!ctx && typeof AudioContext !== 'undefined') ctx = new AudioContext()
    if (!ctx) throw new Error('WebAudioAdapter: no AudioContext available')
    this.ctx = ctx
  }
  play(event) {
    const { ctx } = this
    if (event.kind === 'silence') return
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const freq = event.freq || 440
    const dur  = event.dur || 0.25
    const vel  = event.vel === undefined ? 0.8 : event.vel
    osc.frequency.value = freq
    osc.type = event.shape === 'square' ? 'square'
             : event.shape === 'saw'    ? 'sawtooth'
             : event.shape === 'triangle' ? 'triangle'
             : 'sine'
    gain.gain.setValueAtTime(0, now)
    const attack  = event.spec?.attack  ?? 0.01
    const decay   = event.spec?.decay   ?? 0
    const sustain = event.spec?.sustain ?? 1
    const release = event.spec?.release ?? 0.05
    gain.gain.linearRampToValueAtTime(vel, now + attack)
    if (decay > 0) gain.gain.linearRampToValueAtTime(vel * sustain, now + attack + decay)
    gain.gain.setValueAtTime(vel * sustain, now + Math.max(0, dur - release))
    gain.gain.linearRampToValueAtTime(0, now + dur)
    osc.connect(gain).connect(ctx.destination)
    osc.start(now)
    osc.stop(now + dur + 0.05)
  }
  stop() { /* browser cleans up finished nodes */ }
}

// The node-speaker adapter. Uses the optional `speaker` npm package to
// stream PCM to the OS audio driver. If it's not installed we fall
// back to the bell so tests keep passing.
export class NodeSpeakerAdapter {
  constructor(SpeakerCtor) {
    if (!SpeakerCtor) throw new Error('NodeSpeakerAdapter: `speaker` npm package not installed')
    this.SpeakerCtor = SpeakerCtor
    this.speaker = null
    this.sampleRate = 44100
  }
  ensureSpeaker() {
    if (!this.speaker) {
      this.speaker = new this.SpeakerCtor({
        channels: 1, bitDepth: 16, sampleRate: this.sampleRate,
      })
    }
    return this.speaker
  }
  play(event) {
    if (event.kind === 'silence') return
    const sr = this.sampleRate
    const dur = event.dur || 0.25
    const freq = event.freq || 440
    const vel = event.vel ?? 0.8
    const samples = Math.floor(sr * dur)
    const buf = Buffer.alloc(samples * 2)
    // Simple sine synthesis with a linear attack/release envelope.
    const attackSamples = Math.min(samples, Math.floor(sr * 0.01))
    const releaseSamples = Math.min(samples, Math.floor(sr * 0.05))
    for (let i = 0; i < samples; i++) {
      let env = 1
      if (i < attackSamples) env = i / attackSamples
      else if (i > samples - releaseSamples) env = (samples - i) / releaseSamples
      const sample = Math.sin(2 * Math.PI * freq * (i / sr)) * vel * env * 0.3
      const int16 = Math.max(-1, Math.min(1, sample)) * 32767 | 0
      buf.writeInt16LE(int16, i * 2)
    }
    try { this.ensureSpeaker().write(buf) } catch { /* ignore */ }
  }
  stop() {
    if (this.speaker) {
      try { this.speaker.end() } catch {}
      this.speaker = null
    }
  }
}

// ── singleton accessor ─────────────────────────────────────────────

let _engine = null
export function getSoundEngine() {
  if (!_engine) _engine = new SoundEngine()
  return _engine
}
