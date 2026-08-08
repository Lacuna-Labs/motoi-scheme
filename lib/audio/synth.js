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
import { apply } from '../../src/interp.js'
import { getSoundEngine, parsePitch, parseDuration } from './sound.js'

import { isList, seqVerb } from '../base/list.js'
const nm = (x) => (x instanceof Sym ? x.name : x)
const sym = (s) => new Sym(s)

// Invoke a Scheme closure OR a native fn (same shape as world.js callProc).
function callProc (fn, args) {
  if (typeof fn === 'function') return fn(...args)
  if (fn && fn.params) return apply(fn, args, { n: 2_000_000 })
  return undefined
}
const isProc = (f) => typeof f === 'function' || !!(f && f.params)

// Alists in Motoi are 2-element PROPER lists, not dotted pairs, so callers
// read them with (cadr (assoc 'key h)). See lib/system/system.js:115.
const alist = (pairs) => pairs.map(([k, v]) => [sym(k), v])

// ── onset subscribers ────────────────────────────────────────────────
// synth/onset-tap registers a handler that fires on each attack transient.
// Every voice trigger in this module IS an onset, so that is where we fire.
const onsetSubs = []
let onsetSeq = 0
function fireOnset (kind, info) {
  if (!onsetSubs.length) return
  const event = alist([['kind', sym(kind)], ...Object.entries(info).map(([k, v]) => [k, v])])
  // Snapshot: a handler may unsubscribe itself while we are iterating.
  for (const s of onsetSubs.slice()) {
    try { callProc(s.handler, [event]) } catch { /* a bad handler must not kill the voice */ }
  }
}


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
  const def = (n, f, perm = 'read') => env.define(n, seqVerb(f), { perm })

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
      fireOnset('drum', { engine: sym('808'), voice: sym(vn), freq })
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
      fireOnset('sample', { engine: sym('sp1200'), sample: sym(sn), freq })
      // Reference (62-synth.slat, synth/sp1200): the return is a tagged tuple
      // "[ok result] | [pending-sample-bank {sample pitch reason dsp_available
      // spRate}]", and the caveat is explicit: "Sample bank is not yet wired in
      // v1; every call returns pending-sample-bank, not playback." The old
      // definition returned a bare 'ok, so every documented (car r) errored.
      // spRate is "a constant determined by the sample bank"; with no bank
      // wired it is not determinable, so it reports 'none rather than a
      // made-up rate.
      return [sym('pending-sample-bank'), alist([
        ['sample', sym(sn)],
        ['pitch', p],
        ['reason', sym('sample-bank-not-wired')],
        ['dsp_available', true],
        ['spRate', sym('none')],
      ])]
    } catch { return [sym('error'), sym('sp1200-failed'), sym('none')] }
  }, 'paint')

  // (synth/orchestra voice-map pitch dur?) — trigger multiple voices
  // as a single blend. voice-map is a list of (voice weight) pairs.
  // Returns 'ok on schedule; 'error on shape mismatch.
  def('synth/orchestra', (voices, pitch, dur) => {
    if (!isList(voices)) return new Sym('error')
    try {
      const e = engine()
      const seconds = parseDuration(dur ?? 0.5, e.bpm)
      const savedCursor = e.cursor
      const p = pitch != null ? pitch : 'C4'
      const freq = typeof p === 'number' ? p : parsePitch(p)
      for (const pair of voices) {
        if (!isList(pair) || pair.length < 2) continue
        const voice = nm(pair[0])
        const weight = Number(pair[1]) || 1
        e.cursor = savedCursor
        const event = { kind: 'orchestra', voice, weight, freq, dur: seconds, at: e.cursor }
        e.timeline.push(event)
        try { e.adapter.play({ ...event, kind: 'note' }) } catch { /* ignore */ }
      }
      e.cursor = savedCursor + seconds
      fireOnset('orchestra', { engine: sym('orchestra') })
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
      fireOnset('orchestra', { engine: sym('orch') })
      return new Sym('ok')
    } catch { return new Sym('error') }
  }, 'paint')

  // (synth/load-score name) — fetch a pre-composed score by name.
  //
  // Reference (62-synth.slat, synth/load-score):
  //   "(synth/load-score name) -> ['ok score] | ['error status info]
  //    | ['pending-fetch info]"
  //   invariant: car(synth/load-score _) in {ok, error, pending-fetch,
  //   unknown-score}
  // The old definition took a LIST of note tuples and returned a bare count
  // or bare 'error — a different verb entirely. Reference wins.
  //
  // KNOWN is the hardcoded score registry the reference describes. The score
  // names come from the reference itself; no fetch URL for them is recorded
  // anywhere in this repo, and no score sidecar is wired, so a known name
  // takes the reference's own documented 'pending-fetch branch ("Requires a
  // working fetch implementation ...; returns ['pending-fetch ...] if fetch is
  // unavailable"). No URL is invented here.
  const KNOWN = ['beethoven-9-mvt-4']
  def('synth/load-score', (name) => {
    const n = nm(name)
    if (typeof n !== 'string' || n === '') {
      return [sym('error'), sym('bad-score-name'), alist([['got', name === undefined ? sym('none') : name]])]
    }
    // "name must match a key in the KNOWN registry; unknown names return
    // 'unknown-score error with the list of known score names."
    const key = n.toLowerCase() // the reference calls the name case-insensitive
    if (!KNOWN.includes(key)) {
      return [sym('unknown-score'), sym(key), KNOWN.map((k) => sym(k))]
    }
    return [sym('pending-fetch'), alist([
      ['name', sym(key)],
      ['reason', sym('score-fetch-not-wired')],
      ['retryable', true],
    ])]
  }, 'paint')

  // (synth/onset-tap handler) — subscribe to onset (attack transient) events.
  //
  // Reference (62-synth.slat, synth/onset-tap):
  //   "(synth/onset-tap handler) -> [ok {unsubscribe unsub event name}]
  //    | [error reason details]"
  //   caveats: "Handler must be a function; passing anything else returns an
  //   error tuple." / "The unsubscribe function is a closure; call it to
  //   remove the listener." / "Multiple handlers can be registered; each will
  //   fire independently on the same onset event."
  // The old definition took an onset STRENGTH number and returned the bpm — a
  // tap-tempo estimator, not a subscription. Reference wins.
  def('synth/onset-tap', (handler) => {
    if (!isProc(handler)) {
      return [sym('error'), sym('handler-not-a-function'), alist([['got', handler === undefined ? sym('none') : handler]])]
    }
    const name = `onset-sub-${++onsetSeq}`
    const rec = { handler, name }
    onsetSubs.push(rec)
    // The unsubscribe closure is idempotent: calling it twice is not an error.
    const unsubscribe = () => {
      const i = onsetSubs.indexOf(rec)
      if (i >= 0) { onsetSubs.splice(i, 1); return true }
      return false
    }
    return [sym('ok'), alist([
      ['unsubscribe', unsubscribe],
      ['unsub', unsubscribe],
      ['event', sym('onset')],
      ['name', sym(name)],
    ])]
  }, 'paint')

  return env
}

export default installSynth
