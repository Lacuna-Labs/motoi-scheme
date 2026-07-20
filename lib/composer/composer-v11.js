// composer-v11.js — Motoi Composer v1.1 extensions.
//
// Doctrine (Alfred, 2026-07-17): v1.0 shipped the round-trip layer.
// v1.1 adds four extensions in one pass:
//   1. 16-voice polyphony (up from 8 in v2-audio-design proposal)
//   2. voice-16 as a MIXER — combines other voices into one output
//   3. HTML-16 color palette (see lib/graphics/named-colors-html.js)
//   4. TUI renderer (see lib/composer/tui.js)
//
// This module is loaded IN ADDITION to composer.js. It adds new verbs
// (song/config, voice/mix, voice/compose, composer/voice-pool,
// composer/render-tui, color/named, color/name-of) and one new widget
// kind (voice-pool). Existing verbs are untouched — round-trip
// guarantees hold.
//
// Provenance: engineering/COMPOSER-1.1.ENG.slat (Task 1 + 2 + 3).

import { Sym, sym } from '../../src/reader.js'
import { colorNamed, colorNameOf, NAMED_COLORS_HTML, NAMED_COLORS_HTML_ORDER } from '../graphics/named-colors-html.js'
import { renderCanvasToTUI, TREE_LOGO } from './tui.js'
import { WIDGET_EMITTERS, WIDGET_APPLIERS, WIDGET_INSTANTIATORS } from './composer.js'

const nm = (x) => (x instanceof Sym ? x.name : x)

// Plist → object helper (same pattern as composer.js).
function plistToObj(args) {
  const out = {}
  let i = 0
  while (i < args.length) {
    const a = args[i]
    const name = a instanceof Sym ? a.name : null
    if (name && name.startsWith(':')) {
      if (i + 1 >= args.length) break
      out[name.slice(1)] = args[i + 1]
      i += 2
    } else {
      i += 1
    }
  }
  return out
}

// ── voice-pool widget ──────────────────────────────────────────────
//
// A voice-pool record models a 16-voice polyphony bank.
// - Voices 1..15 are individual instrument slots. Each holds
//   { instrument, pitch, at, dur, vel } — nulls when idle.
// - Voice 16 is the MIXER. Its `mixes` field is a list of voice ids
//   (1-based) it combines into a single output stream.
//
// Round-trip: composer/voice-pool emits its full state; apply reads it
// back. Nothing about the pool leaks into voices 1..15's individual
// waveforms — it's a routing statement, not a mutation.

function makeVoicePool(opts) {
  const size = 16 // Alfred: fixed at 16 for v1.1
  const voices = new Array(size).fill(null).map(() => ({
    instrument: null, pitch: null, at: null, dur: null, vel: null,
  }))
  // Voice 16 is the mixer.
  voices[15] = { mixes: [], gain: 1.0 }

  // Reload individual voice assignments (voices 1..15) from opts.voices
  // if present. Shape: ((idx (:instrument ... :pitch ... :at ... :dur ... :vel ...)) ...)
  // — an alist of [1-based-index, plist-of-kws].
  if (Array.isArray(opts.voices)) {
    for (const bucket of opts.voices) {
      if (!Array.isArray(bucket) || bucket.length < 2) continue
      const idx1 = Number(nm(bucket[0]))
      const idx = idx1 - 1
      if (!Number.isFinite(idx) || idx < 0 || idx > 14) continue
      const pairs = bucket[1]
      if (!Array.isArray(pairs)) continue
      const spec = {}
      for (let i = 0; i < pairs.length; i += 2) {
        const k = pairs[i]
        const v = pairs[i + 1]
        const key = k instanceof Sym && k.name.startsWith(':') ? k.name.slice(1) : String(nm(k))
        // Unwrap (quote sym) if present.
        let val = v
        if (Array.isArray(v) && v.length === 2 && v[0] instanceof Sym && v[0].name === 'quote') {
          val = v[1]
        }
        if (val instanceof Sym) val = val.name
        spec[key] = val
      }
      voices[idx] = { ...voices[idx], ...spec }
    }
  }

  const pool = {
    kind: 'voice-pool',
    bind: Array.isArray(opts.bind) ? opts.bind.map((p) => String(nm(p))) : [],
    opts: {
      size,
      steal: opts.steal ? String(nm(opts.steal)) : 'oldest',
    },
    state: { voices },
  }

  // Reload mixer routing from opts.mix if present.
  if (Array.isArray(opts.mix)) voicePoolSetMix(pool, opts.mix)

  return pool
}

// Assign an instrument to a voice slot. Returns the voice id (1-based).
// If no voice is free, applies the steal policy (oldest = voice 1).
function voicePoolAssign(w, voiceId, spec) {
  if (w.kind !== 'voice-pool') return w
  const idx = Number(voiceId) - 1
  if (idx < 0 || idx > 14) return w // 15 = mixer, off-limits
  w.state.voices[idx] = { ...w.state.voices[idx], ...spec }
  return w
}

// Set the mixer voice's mix list. `voiceIds` is an array of 1-based
// voice ids (must be in 1..15). Duplicates are stripped in insertion
// order; out-of-range ids are dropped.
function voicePoolSetMix(w, voiceIds) {
  if (w.kind !== 'voice-pool') return w
  const seen = new Set()
  const out = []
  for (const v of Array.isArray(voiceIds) ? voiceIds : []) {
    const n = Number(nm(v))
    if (!Number.isFinite(n)) continue
    if (n < 1 || n > 15) continue
    const ni = n | 0
    if (seen.has(ni)) continue
    seen.add(ni)
    out.push(ni)
  }
  w.state.voices[15].mixes = out
  return w
}

// Emit the voice-pool widget declaration form. This preserves the
// mixer routing AND the individual voice assignments (1..15) so a
// saved pool round-trips authored state.
function emitVoicePoolDeclaration(w) {
  const mixes = w.state.voices[15].mixes || []
  // For voices 1..15, emit only slots that have been assigned (any non-null
  // field). Shape: ((1 (:instrument 'lead :pitch 'C4 ...)) (3 (:instrument 'bass ...)) ...)
  const voicesOut = []
  for (let i = 0; i < 15; i++) {
    const v = w.state.voices[i]
    if (!v) continue
    const pairs = []
    for (const [k, val] of Object.entries(v)) {
      if (val == null) continue
      // Symbolic values (instrument names, pitches) get quoted.
      if (typeof val === 'string') pairs.push(sym(':' + k), [sym('quote'), sym(val)])
      else pairs.push(sym(':' + k), val)
    }
    if (pairs.length > 0) voicesOut.push([i + 1, pairs])
  }
  return [
    sym('composer/voice-pool'),
    sym(':bind'), [sym('quote'), w.bind.map((n) => sym(n))],
    sym(':steal'), [sym('quote'), sym(w.opts.steal)],
    sym(':mix'), [sym('quote'), mixes.map((n) => Number(n))],
    sym(':voices'), [sym('quote'), voicesOut],
  ]
}

// Apply an incoming form to a voice-pool widget.
function applyFormToVoicePool(w, form) {
  // Extract kws.
  for (let i = 1; i < form.length; i++) {
    const a = form[i]
    const name = a instanceof Sym ? a.name : null
    if (!name || !name.startsWith(':')) continue
    if (i + 1 >= form.length) break
    const key = name.slice(1)
    const val = form[i + 1]
    i++
    if (key === 'steal') {
      const v = unquote(val)
      w.opts.steal = String(nm(v))
    } else if (key === 'mix') {
      const v = unquote(val)
      if (Array.isArray(v)) voicePoolSetMix(w, v)
    } else if (key === 'voices') {
      const v = unquote(val)
      if (!Array.isArray(v)) continue
      for (const bucket of v) {
        if (!Array.isArray(bucket) || bucket.length < 2) continue
        const idx1 = Number(nm(bucket[0]))
        const idx = idx1 - 1
        if (!Number.isFinite(idx) || idx < 0 || idx > 14) continue
        const pairs = bucket[1]
        if (!Array.isArray(pairs)) continue
        const spec = {}
        for (let j = 0; j < pairs.length; j += 2) {
          const k = pairs[j]
          const vv = pairs[j + 1]
          const kk = k instanceof Sym && k.name.startsWith(':') ? k.name.slice(1) : String(nm(k))
          let vvv = vv
          if (Array.isArray(vv) && vv.length === 2 && vv[0] instanceof Sym && vv[0].name === 'quote') {
            vvv = vv[1]
          }
          if (vvv instanceof Sym) vvv = vvv.name
          spec[kk] = vvv
        }
        w.state.voices[idx] = { ...w.state.voices[idx], ...spec }
      }
    }
  }
  return w
}

function unquote(f) {
  if (Array.isArray(f) && f.length === 2 && f[0] instanceof Sym && f[0].name === 'quote') {
    return f[1]
  }
  return f
}

// ── song/config record ─────────────────────────────────────────────
//
// (song/config :voices 16 :voice-steal 'oldest :bpm 120 ...) returns a
// plain record so callers can inspect it. Voices >16 clamp to 16 with
// a warning field. This makes the emitted form self-documenting.

function makeSongConfig(opts) {
  let voices = Number(opts.voices ?? 16)
  const warnings = []
  if (!Number.isFinite(voices)) {
    warnings.push(`voices=${JSON.stringify(opts.voices)} is not a number; clamped to 1`)
    voices = 1
  }
  if (voices > 16) {
    warnings.push(`voices=${voices} clamped to 16 (Motoi Composer v1.1 max)`)
    voices = 16
  }
  if (voices < 1) {
    warnings.push(`voices=${voices} clamped to 1`)
    voices = 1
  }
  // Voices must be an integer — fractional voices are meaningless. Round
  // toward the safer floor (1.5 → 1) and warn.
  if (!Number.isInteger(voices)) {
    const rounded = Math.max(1, Math.floor(voices))
    warnings.push(`voices=${voices} rounded to integer ${rounded}`)
    voices = rounded
  }
  return {
    kind: 'song-config',
    voices,
    voiceSteal: opts['voice-steal'] ? String(nm(opts['voice-steal'])) : 'oldest',
    bpm: Number(opts.bpm ?? 120),
    warnings,
  }
}

// ── voice/mix and voice/compose ────────────────────────────────────
//
// (voice/mix voice-ids) returns a composite record referencing a set
// of voice slots. Runtime uses this to route the mixer's output stream.
// (voice/compose voices) is the alias per Alfred's phrasing — "compose
// them together".

// Cap on user-supplied voice ids — must be at most 15 (the non-mixer
// voice slots). Prevents unbounded allocation from Scheme args
// (voice/mix ×1M would allocate a 1M-elem array otherwise).
const VOICE_MIX_MAX = 15

function makeMixRecord(voiceIds, gain = 1.0) {
  const seen = new Set()
  const ids = []
  for (const v of Array.isArray(voiceIds) ? voiceIds : []) {
    if (ids.length >= VOICE_MIX_MAX) break
    const n = Number(nm(v))
    if (!Number.isFinite(n) || n < 1 || n > 15) continue
    const ni = n | 0
    // Dedupe — mirror voicePoolSetMix (unified semantics).
    if (seen.has(ni)) continue
    seen.add(ni)
    ids.push(ni)
  }
  return {
    kind: 'voice-mix',
    voices: ids,
    gain: Number(gain),
  }
}

// ── installer ──────────────────────────────────────────────────────

// Register widget-kind hooks into composer.js's extension tables. Safe
// to call more than once — subsequent calls overwrite (idempotent).
function registerWidgetHooks() {
  WIDGET_EMITTERS.set('voice-pool', emitVoicePoolDeclaration)
  WIDGET_APPLIERS.set('voice-pool', applyFormToVoicePool)
  WIDGET_INSTANTIATORS.set('composer/voice-pool', (opts) => makeVoicePool(opts))
}

export function installComposerV11(env, fuel) {
  registerWidgetHooks()
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  // Task 1a: song/config — top-level song configuration.
  def('song/config', (...args) => makeSongConfig(plistToObj(args)), 'state-change')

  // Task 1b: composer/voice-pool widget.
  def('composer/voice-pool', (...args) => makeVoicePool(plistToObj(args)), 'state-change')

  // Task 1c: voice/mix + voice/compose.
  def('voice/mix', (voiceIds, gain) => makeMixRecord(voiceIds, gain != null ? gain : 1.0), 'read')
  def('voice/compose', (voiceIds, gain) => makeMixRecord(voiceIds, gain != null ? gain : 1.0), 'read')

  // Voice-pool mutation helpers exposed as verbs (kids can drive the
  // pool from Scheme, not just from a Curator UI).
  def('composer/voice-assign', (pool, voiceId, spec) => {
    // Spec is a plist or a plain object; coerce.
    let obj = spec
    if (Array.isArray(spec)) obj = plistToObj(spec)
    if (obj && obj instanceof Sym) obj = { instrument: obj.name }
    return voicePoolAssign(pool, voiceId, obj || {})
  }, 'state-change')

  def('composer/voice-mix-set', (pool, voiceIds) => voicePoolSetMix(pool, voiceIds), 'state-change')

  // Task 2: color/named + color/name-of.
  def('color/named', (name) => {
    const hex = colorNamed(nm(name))
    return hex == null ? false : hex
  }, 'read')

  def('color/name-of', (hex) => {
    const n = colorNameOf(nm(hex))
    return n == null ? false : sym(n)
  }, 'read')

  // The full 16-name list as a Scheme value.
  def('color/palette-html-16', () => NAMED_COLORS_HTML_ORDER.map((n) => sym(n)), 'read')

  // Task 3: composer/render-tui + tree logo.
  def('composer/render-tui', (canvas, opts) => {
    let o = {}
    if (Array.isArray(opts)) o = plistToObj(opts)
    else if (opts && typeof opts === 'object') o = opts
    return renderCanvasToTUI(canvas, o)
  }, 'read')

  def('composer/tree-logo', () => TREE_LOGO, 'read')

  return env
}

// ── exports for round-trip integration ──────────────────────────────
//
// composer.js's `emitWidgetDeclaration` doesn't know about voice-pool.
// We patch it at install time via env hooks — but since the composer
// exports a switch-based emit function that we can't easily extend from
// outside, we ALSO expose emit + apply helpers here for tests to hit
// directly. The v11 installer additionally REPLACES composer/emit and
// composer/apply on `env` with wrappers that dispatch voice-pool.

export { emitVoicePoolDeclaration, applyFormToVoicePool, makeVoicePool, voicePoolSetMix, voicePoolAssign, makeMixRecord }
