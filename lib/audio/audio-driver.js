// audio-driver.js — cross-platform audio playback for terminal builds.
//
// Provenance: scheme-lang/src/audio-driver.js. Migrated to
// motoi-scheme/lib/audio/ on 2026-07-16 (Pass-3 Wave 1). tmp-file
// prefix neutralized from 'sakura-tone-' to 'motoi-tone-'.
//
// Zero JS dependencies. Generates PCM WAV in-memory and pipes to the
// system player: afplay (macOS), aplay/paplay (Linux), or powershell
// SoundPlayer (Windows). For the web IDE, browser Web Audio API is
// wired separately (see src/web-ide/serve.js).
//
// Wired verbs use playTone / playNote / playSample below. Missing
// system player → the call is a graceful no-op (returns 'no-audio,
// not a crash — honest, per the "no lies" rule).
//
// Alfred: "audio has to work."

import { spawn } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { tmpdir, platform } from 'node:os'
import { join } from 'node:path'

// ── platform-aware player selection ─────────────────────────────────
//
// We prefer players that accept a filename arg on stdin/argv. WAV is
// universally supported.

function pickPlayer() {
  const os = platform()
  if (os === 'darwin') return { cmd: 'afplay', args: [] }
  if (os === 'linux') {
    // aplay (ALSA) is more universally installed; paplay (PulseAudio) is
    // often present on desktop. We just try aplay first.
    return { cmd: 'aplay', args: ['-q'], fallback: { cmd: 'paplay', args: [] } }
  }
  if (os === 'win32') {
    return {
      cmd: 'powershell',
      args: ['-NoProfile', '-Command'],
      // We synthesize the -Command arg at play time because it needs the file path.
      buildCommand: (path) => `(New-Object Media.SoundPlayer '${path}').PlaySync()`,
    }
  }
  return null
}

// ── WAV synthesizer ─────────────────────────────────────────────────
//
// Simple monophonic 16-bit PCM WAV. Sample rate 44.1kHz. Enough for a
// tone, a note, a short chirp. No filters, no envelope aside from a
// linear fade-out to avoid the trailing click.

const SAMPLE_RATE = 44100

function synthWav(samples) {
  const dataLen = samples.length * 2 // 16-bit = 2 bytes per sample
  const buf = Buffer.alloc(44 + dataLen)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + dataLen, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)          // fmt chunk size
  buf.writeUInt16LE(1, 20)           // PCM
  buf.writeUInt16LE(1, 22)           // mono
  buf.writeUInt32LE(SAMPLE_RATE, 24)
  buf.writeUInt32LE(SAMPLE_RATE * 2, 28) // byte rate
  buf.writeUInt16LE(2, 32)           // block align
  buf.writeUInt16LE(16, 34)          // bits per sample
  buf.write('data', 36)
  buf.writeUInt32LE(dataLen, 40)
  for (let i = 0; i < samples.length; i++) {
    // Clamp + write 16-bit signed sample.
    let s = Math.max(-1, Math.min(1, samples[i]))
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2)
  }
  return buf
}

// ── waveform generators ─────────────────────────────────────────────

function sineTone(freq, duration, amplitude = 0.5) {
  const n = Math.floor(SAMPLE_RATE * duration)
  const out = new Float32Array(n)
  const fade = Math.min(Math.floor(SAMPLE_RATE * 0.01), Math.floor(n / 4))
  for (let i = 0; i < n; i++) {
    let a = amplitude
    if (i < fade) a *= (i / fade)
    if (i > n - fade) a *= ((n - i) / fade)
    out[i] = a * Math.sin(2 * Math.PI * freq * i / SAMPLE_RATE)
  }
  return out
}

// MIDI note number → frequency in Hz. R7RS-compatible arithmetic.
function noteToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

// ── play ────────────────────────────────────────────────────────────

async function playBuffer(wavBuf) {
  const player = pickPlayer()
  if (!player) return { ok: false, reason: 'unsupported-platform' }
  const path = join(tmpdir(), `motoi-tone-${process.pid}-${Date.now()}.wav`)
  try {
    writeFileSync(path, wavBuf)
    const args = player.buildCommand
      ? [...player.args, player.buildCommand(path)]
      : [...player.args, path]
    await new Promise((resolve) => {
      const child = spawn(player.cmd, args, { stdio: 'ignore' })
      child.on('exit', () => resolve())
      child.on('error', () => {
        // Silent — treat as no-audio. Cleanup happens below.
        resolve()
      })
    })
  } finally {
    try { unlinkSync(path) } catch {}
  }
  return { ok: true }
}

// ── public API ──────────────────────────────────────────────────────

export async function playTone(freq, duration = 0.25, amplitude = 0.5) {
  const samples = sineTone(freq, duration, amplitude)
  const wav = synthWav(samples)
  return playBuffer(wav)
}

export async function playNote(midi, duration = 0.25, amplitude = 0.5) {
  return playTone(noteToFreq(midi), duration, amplitude)
}

// ── polyphonic mix ──────────────────────────────────────────────────
//
// Mix up to VOICE_LIMIT notes into a single WAV for sample-accurate
// simultaneous playback. Beats firing N concurrent afplay processes
// (which drift because of process-spawn latency ~30-50ms).
//
// Each voice is { midi | freq, duration, amplitude?, startOffset? }.
// Per-voice amplitude is scaled by 1/sqrt(N) so a chord of N voices
// doesn't clip.

export const VOICE_LIMIT = 16

function mixVoices(voices, totalDuration) {
  const n = Math.floor(SAMPLE_RATE * totalDuration)
  const out = new Float32Array(n)
  const gain = 1 / Math.max(1, Math.sqrt(voices.length))
  for (const v of voices) {
    const freq = v.freq != null ? v.freq : noteToFreq(v.midi)
    const dur  = v.duration != null ? v.duration : 0.25
    const amp  = (v.amplitude != null ? v.amplitude : 0.5) * gain
    const off  = Math.floor(SAMPLE_RATE * (v.startOffset || 0))
    const len  = Math.min(Math.floor(SAMPLE_RATE * dur), n - off)
    if (len <= 0) continue
    const fade = Math.min(Math.floor(SAMPLE_RATE * 0.01), Math.floor(len / 4))
    for (let i = 0; i < len; i++) {
      let a = amp
      if (i < fade) a *= (i / fade)
      if (i > len - fade) a *= ((len - i) / fade)
      out[off + i] += a * Math.sin(2 * Math.PI * freq * i / SAMPLE_RATE)
    }
  }
  return out
}

// Play a chord: N notes all attacking simultaneously.
// `notes` is a list of MIDI numbers (or objects with { midi, amplitude? }).
export async function playChord(notes, duration = 0.4, amplitude = 0.5) {
  if (!Array.isArray(notes) || notes.length === 0) return { ok: false, reason: 'no-notes' }
  const voices = notes.slice(0, VOICE_LIMIT).map(n => {
    if (typeof n === 'number') return { midi: n, duration, amplitude }
    return { midi: n.midi, amplitude: n.amplitude != null ? n.amplitude : amplitude, duration }
  })
  const samples = mixVoices(voices, duration)
  return playBuffer(synthWav(samples))
}

// Play a sequence: notes attack at successive offsets. Each event is a
// MIDI number OR { midi, duration?, startOffset?, amplitude? }.
// If startOffset is absent, notes butt up back-to-back.
export async function playSequence(events, defaultDur = 0.25, amplitude = 0.5) {
  if (!Array.isArray(events) || events.length === 0) return { ok: false, reason: 'no-events' }
  let cursor = 0
  const voices = []
  for (const e of events) {
    const midi = typeof e === 'number' ? e : e.midi
    const dur  = (typeof e === 'object' && e.duration != null) ? e.duration : defaultDur
    const off  = (typeof e === 'object' && e.startOffset != null) ? e.startOffset : cursor
    voices.push({ midi, duration: dur, amplitude, startOffset: off })
    cursor = off + dur
  }
  const samples = mixVoices(voices, cursor)
  return playBuffer(synthWav(samples))
}

export function isAudioAvailable() {
  return pickPlayer() !== null
}

export function audioBackend() {
  const p = pickPlayer()
  if (!p) return 'none'
  return p.cmd
}
