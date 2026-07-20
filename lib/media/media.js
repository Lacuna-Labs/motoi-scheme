// media.js — L1 MEDIA verbs registered on the base env.
//
// Provenance: scheme-lang/src/media.js. Migrated to
// motoi-scheme/lib/media/ on 2026-07-16 (Pass-3 Wave 1). Cart-snapshot
// header string changed from 'sakura scheme cart snapshot' to
// 'motoi scheme cart snapshot' — Sakura consumers writing new snapshots
// will produce motoi-branded files, but slatToCart still accepts the
// old header (it keys on '#!json-blob', not on the comment line).
//
// This module owns the SHARED runtime framebuffer + shared audio timeline
// + shared animation loop. Every media verb (circle, disc, line, rect,
// plot, clear, render, tone, note, on-frame, …) reads or writes this
// shared state.
//
// The shape:
//
//   getMediaState()  → the singleton { fb, audio, loop, events }
//   registerMedia(env, fuel) → attach verbs to the base env
//
// Verbs stay pure w/r/t their arguments — they mutate ONLY the media
// singleton, never each other's data. That's what lets `on-frame` and
// `render` compose cleanly.
//
// Two flavors of verbs live here:
//
//   A) DRAW verbs (`clear`, `circle`, `disc`, `line`, `rect`, `plot`).
//      These mutate the framebuffer and RETURN a tagged list of the
//      shape they drew — so `(circle 40 40 15)` at the REPL still
//      "prints as a picture" via richDisplay.js's tagged-list detection,
//      AND writes into the shared framebuffer so subsequent `(render)`
//      calls include it. Best of both worlds.
//
//   B) LIFECYCLE verbs (`set-mode`, `render`, `frame`, `on-frame`, …).
//      These affect the runtime, not one shape. They return sensible
//      Scheme values (undefined, integers, symbols).

import {
  Framebuffer,
  DEFAULT_PALETTE,
  MODES,
  resolveMode,
} from '../graphics/framebuffer.js'
import { Sym } from '../../src/reader.js'
import { recordPrimitive } from '../graphics/framebuffer-verbs.js'
import { getSoundEngine } from '../audio/sound.js'
import { getAnimationLoop } from '../graphics/animation.js'
// Node-only imports for the cart sandbox (Priya 2026-07-17). Browser
// build.mjs strips these; save-cart / load-cart already error cleanly
// when tryLoadFs() returns null, and _safeCartPath returns null when
// homedir/path aren't available.
import { homedir as _osHomedir } from 'node:os'
import { join as _pathJoin } from 'node:path'

// ── singleton state ─────────────────────────────────────────────────

let _state = null

export function getMediaState() {
  if (!_state) _state = createMediaState()
  return _state
}

// Test-only reset. Real programs never call this — the state is a
// process-wide singleton and animations run continuously.
export function resetMediaState() {
  if (_state) {
    _state.loop.stop()
    _state.audio.stop()
  }
  _state = null
}

function createMediaState() {
  const fb = new Framebuffer(80, 80)
  const audio = getSoundEngine()
  const loop = getAnimationLoop(fb)
  // Handler registry — animation.js pushes into these when the user
  // calls (on-frame …), (on-key …), etc.
  const events = {
    frame:   [],
    key:     [],
    mouse:   [],
    gamepad: [],
  }
  loop.attachEvents(events)
  return { fb, audio, loop, events }
}

// ── helper: coerce a name (string OR Scheme Sym) ────────────────────

function nameOf(v) {
  if (typeof v === 'string') return v
  if (v instanceof Sym) return v.name
  return null
}

// ── cart-path sandbox (Priya 2026-07-17) ────────────────────────────
//
// Restrict save-cart / load-cart to `~/motoi/carts/<safe-name>`.
// Callers pass a bare filename; we strip everything outside
// `[A-Za-z0-9._-]`, reject empty / dot-only names, and refuse anything
// that looks like a path (contains `/` or `\`, starts with `.`).

import { userCartsDir } from '../../src/paths.js'

let _cartDirCache = null
function _cartDir() {
  if (_cartDirCache) return _cartDirCache
  try {
    _cartDirCache = userCartsDir()
    return _cartDirCache
  } catch { return null }
}

function _ensureCartDir(fs) {
  const d = _cartDir()
  if (!d) return
  try { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }) }
  catch { /* soft-fail — writeFileSync will surface a clean error */ }
}

function _safeCartPath(raw) {
  const dir = _cartDir()
  if (!dir) return null
  const s = String(nameOf(raw) ?? raw ?? '')
  // Reject anything that smells like a path or traversal attempt.
  if (!s || s.includes('/') || s.includes('\\') || s.startsWith('.')) return null
  const cleaned = s.replace(/[^A-Za-z0-9._-]/g, '_')
  if (!cleaned || cleaned === '.' || cleaned === '..') return null
  try { return _pathJoin(dir, cleaned) }
  catch { return null }
}

// ── verb registration ───────────────────────────────────────────────

export function registerMedia(env, fuel) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  // Give the animation loop access to the fuel cell so per-frame
  // handlers reset fuel each tick.
  const st0 = getMediaState()
  st0.loop.attachFuel(fuel)

  // ── mode + palette ──────────────────────────────────────────────

  // (set-mode w h) or (set-mode 'pico8). Reallocates the framebuffer.
  def('set-mode', (a, b) => {
    const st = getMediaState()
    const { w, h } = resolveMode(nameOf(a) ?? a, b)
    const palette = st.fb.palette   // preserve palette across mode change
    const color   = st.fb.color
    st.fb = new Framebuffer(w, h, palette)
    st.fb.color = color
    st.loop.attachFramebuffer(st.fb)
    return [w, h]
  })

  // (set-color c) — c is an integer index 0..15 or a color name symbol.
  def('set-color', (c) => {
    const st = getMediaState()
    return st.fb.setColor(nameOf(c) ?? c)
  })

  // (get-color) — read current draw color.
  def('get-color', () => getMediaState().fb.color)

  // (mode-info) — return current mode as (w h) list.
  def('mode-info', () => {
    const fb = getMediaState().fb
    return [fb.w, fb.h]
  })

  // ── drawing ─────────────────────────────────────────────────────

  // (clear) or (clear c). Wipes the framebuffer to color 0 (or c).
  def('clear', (c) => {
    const st = getMediaState()
    st.fb.clear(c === undefined ? 0 : (c | 0))
    // Return sym so the REPL's richDisplay prints it as ';; ()' rather
    // than an accidental graphic.
    return undefined
  })

  // (circle cx cy r) — draws into the framebuffer. Side effect only.
  //
  // Alfred's floor doctrine: "We can't lie to people. They trust us."
  // Historically these draw verbs returned a tagged-list receipt like
  // (circle 40 40 15) so richDisplay could re-render the shape from
  // the REPL value. But the descriptor-shape sweep (2026-07-14) called
  // that a lie by shape — a return value that walks like a descriptor
  // is a descriptor. Real side-effect verbs in R7RS return unspecified.
  // The actual pixels landed in the framebuffer; `(render)` reads them.
  //
  // 2026-07-19 bug fix (infinite jes / HaxForFood Discord): every draw
  // verb now calls recordPrimitive so `(on-canvas-trace)` actually
  // returns the primitives drawn. Before this pass, the trace stayed
  // empty regardless of what was drawn, so graphics "didn't work" from
  // the debugger's POV even though pixels landed. Kids hit F2 or
  // `(on-canvas-trace)` and see the shape list; that's the pedagogical
  // affordance.
  def('circle', (cx, cy, r) => {
    getMediaState().fb.circle(+cx, +cy, +r)
    recordPrimitive(['circle', +cx, +cy, +r], { x: +cx - +r, y: +cy - +r, w: 2 * +r, h: 2 * +r })
    return undefined
  })

  // (disc cx cy r) — filled circle, side effect only.
  def('disc', (cx, cy, r) => {
    getMediaState().fb.disc(+cx, +cy, +r)
    recordPrimitive(['disc', +cx, +cy, +r], { x: +cx - +r, y: +cy - +r, w: 2 * +r, h: 2 * +r })
    return undefined
  })

  // (line x0 y0 x1 y1) — line segment, side effect only.
  def('line', (x0, y0, x1, y1) => {
    getMediaState().fb.line(+x0, +y0, +x1, +y1)
    recordPrimitive(
      ['line', +x0, +y0, +x1, +y1],
      { x: Math.min(+x0, +x1), y: Math.min(+y0, +y1), w: Math.abs(+x1 - +x0) + 1, h: Math.abs(+y1 - +y0) + 1 },
    )
    return undefined
  })

  // (rect x y w h) — rectangle outline, side effect only.
  // Aliases: rectangle, draw-rect (see below).
  def('rect', (x, y, w, h) => {
    getMediaState().fb.rect(+x, +y, +w, +h)
    recordPrimitive(['rect', +x, +y, +w, +h], { x: +x, y: +y, w: +w, h: +h })
    return undefined
  })

  // (rect-fill x y w h) — filled rectangle, side effect only.
  // Aliases: fill-rect, filled-rectangle (see below).
  def('rect-fill', (x, y, w, h) => {
    getMediaState().fb.rectFill(+x, +y, +w, +h)
    recordPrimitive(['rect-fill', +x, +y, +w, +h], { x: +x, y: +y, w: +w, h: +h })
    return undefined
  })

  // (plot data) → a plot record. Also rasterizes into the framebuffer.
  def('plot', (data) => {
    const st = getMediaState()
    st.fb.plotSeries(data)
    recordPrimitive(['plot', Array.isArray(data) ? data.length : 0], null)
    return { kind: 'plot', data: Array.isArray(data) ? data.slice() : [] }
  })

  // (pset x y c) — single-pixel poke.
  // Aliases: pixel, put-pixel, set-pixel!, plot-pixel (see below).
  def('pset', (x, y, c) => {
    getMediaState().fb.plot(+x, +y, c === undefined ? undefined : (c | 0))
    recordPrimitive(['pset', +x, +y, c === undefined ? null : (c | 0)], { x: +x, y: +y, w: 1, h: 1 })
    return undefined
  })

  // ── Common-name aliases for beginners (2026-07-19) ─────────────
  // A real user (infinite jes) reported "graphics don't seem to work"
  // in part because he typed rectangle / pixel — canonical names in most
  // Schemes and drawing DSLs but not in Motoi's original roster. Adding
  // them as aliases means naive attempts succeed instead of unbinding.
  // The canonical form (rect / pset / rect-fill) stays the primary; these
  // are pointer verbs that dispatch to the same implementation.
  const _rect     = env.get('rect')
  const _rectFill = env.get('rect-fill')
  const _pset     = env.get('pset')
  const _clear    = env.get('clear')
  def('rectangle',         _rect)
  def('draw-rect',         _rect)
  def('fill-rect',         _rectFill)
  def('filled-rectangle',  _rectFill)
  def('pixel',             _pset)
  def('put-pixel',         _pset)
  def('set-pixel!',        _pset)
  def('plot-pixel',        _pset)
  // background / bg-clear — same signature as (clear c?). Reaches for the
  // shared _clear so both routes truly do the same thing; no divergence.
  def('background',        _clear)
  def('bg-clear',          _clear)

  // (flower/paint n col row [spin sx sy dy petals]) — paint a flower sprite.
  //
  // Real rasterization into the framebuffer via Framebuffer.paintFlower.
  // Sprite index n picks one of 4 canned shapes (dot-cluster / daisy /
  // hex / tulip-ish). Optional spin, X/Y scale, vertical offset, and
  // petal color list follow the reference signature.
  //
  // Returns undefined per reference §flower/paint (:signature ... -> null).
  def('flower/paint', (n, col, row, spin, sx, sy, dy, petals) => {
    getMediaState().fb.paintFlower(n, col, row, spin, sx, sy, dy, petals)
    return undefined
  }, 'animate')

  // (pget x y) — read a pixel's palette index.
  def('pget', (x, y) => getMediaState().fb.peek(+x, +y))

  // (frame ...) has two contract shapes in the reference:
  //   (frame)                         → integer, current frame counter
  //   (frame w h shape ...)           → a "composite frame" record
  //
  // We support both. Zero args returns the counter; more args returns
  // a composite record the display can render as one image.
  def('frame', (...args) => {
    const st = getMediaState()
    if (args.length === 0) return st.fb.frame
    // With args: treat the first two as width/height if they're numbers,
    // and the remaining as tagged-list shapes composed together.
    if (args.length >= 2 && typeof args[0] === 'number' && typeof args[1] === 'number') {
      const [w, h, ...shapes] = args
      return { kind: 'graphic', w, h, shapes }
    }
    // Otherwise every arg is a shape — bundle them.
    return { kind: 'graphic', shapes: args }
  })

  // (render) — force the current framebuffer to display via the routed
  // adapter and return a tagged-list snapshot. Also returns a plain
  // record so `,image` and richDisplay pick it up.
  def('render', () => {
    const fb = getMediaState().fb
    return { kind: 'framebuffer', w: fb.w, h: fb.h, palette: fb.palette.map(c => c.slice()), pixels: Array.from(fb.pixels) }
  })

  // (fb-snapshot) — same as render, alias kept for symmetry with
  // (fb-restore).
  def('fb-snapshot', () => {
    const fb = getMediaState().fb
    return fb.toObject()
  })

  // (framebuffer) — friendly discoverable name. Same as (render) / (fb-snapshot);
  // returns a framebuffer snapshot the REPL renders as an image. Ships as a
  // verb so `(framebuffer)` in the REPL shows what you've drawn without
  // needing to remember the fb-snapshot name.
  def('framebuffer', () => {
    const fb = getMediaState().fb
    return { kind: 'framebuffer', w: fb.w, h: fb.h, palette: fb.palette.map(c => c.slice()), pixels: Array.from(fb.pixels) }
  })

  // (fb-restore snap) — load a snapshot back into the buffer.
  def('fb-restore', (snap) => {
    const st = getMediaState()
    if (!snap || typeof snap !== 'object') throw new Error('fb-restore: bad snapshot')
    st.fb = Framebuffer.fromObject(snap)
    st.loop.attachFramebuffer(st.fb)
    return undefined
  })

  // Convert a note name like "A4", "C#5", "Bb3" to a MIDI number.
  // Returns NaN for unrecognizable input; callers should feature-test.
  function nameToMidi(name) {
    if (!name || typeof name !== 'string') return NaN
    const m = name.match(/^([A-Ga-g])([#b])?(-?\d+)$/)
    if (!m) return NaN
    const letter = m[1].toUpperCase()
    const accidental = m[2] || ''
    const octave = parseInt(m[3], 10)
    const semis = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[letter]
    if (semis === undefined) return NaN
    const delta = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0
    return (octave + 1) * 12 + semis + delta
  }

  // ── SOUND ────────────────────────────────────────────────────────
  //
  // Verbs delegate to two backends:
  //   1. The in-process SoundEngine — records the note-on for the media
  //      state (for web IDE + tests that observe scheduled sounds).
  //   2. The system audio driver — actually makes noise via afplay/aplay/
  //      powershell. Fire-and-forget so the REPL stays responsive.

  // (tone freq dur) — a sine wave at freq Hz for dur seconds. Plays.
  def('tone', (freq, dur) => {
    const f = +freq
    const d = dur === undefined ? 0.25 : +dur
    // Fire the real audio driver in the background.
    import('./audio-driver.js').then(m => m.playTone(f, d)).catch(() => {})
    return getMediaState().audio.tone(f, d)
  })

  // (note pitch [dur] [velocity]) — pitch is a symbol like 'A4 or 'C#4
  // or an integer MIDI number. Plays through the system audio driver.
  def('note', (pitch, dur, vel) => {
    const st = getMediaState()
    const p = nameOf(pitch) ?? String(pitch)
    const d = dur === undefined ? 0.25 : +dur
    const v = vel === undefined ? 0.8 : +vel
    const midi = typeof pitch === 'number' ? pitch : nameToMidi(p)
    // Fire the driver — a MIDI number is enough. Fire-and-forget.
    if (Number.isFinite(midi)) {
      import('./audio-driver.js').then(m => m.playNote(midi, d, v)).catch(() => {})
    }
    // Delegate to in-process engine for the media-state record. Numeric
    // pitches don't parse there today; skip the engine call in that case
    // rather than throw. The driver already played.
    if (typeof pitch === 'number') return undefined
    return st.audio.note(p, d, v)
  })

  // (chord notes [dur] [velocity]) — mix up to 16 voices into one WAV and
  // play them as a single sample-accurate sound. `notes` is a list of MIDI
  // numbers OR note-name symbols. Beats firing N (note ...) calls in a
  // row (each has 30-50ms process-spawn latency; mixed chord attacks
  // together, drift-free).
  def('chord', (notes, dur, vel) => {
    const d = dur === undefined ? 0.4 : +dur
    const v = vel === undefined ? 0.5 : +vel
    const listArr = Array.isArray(notes) ? notes : []
    const midis = listArr
      .map(x => typeof x === 'number' ? x : nameToMidi(nameOf(x) ?? String(x)))
      .filter(m => Number.isFinite(m))
    if (midis.length === 0) return undefined
    import('./audio-driver.js').then(m => m.playChord(midis, d, v)).catch(() => {})
    return undefined
  })

  // (melody notes [dur] [velocity]) — a sequence of notes played back to
  // back at the given per-note duration. `notes` is a list of MIDI numbers
  // OR note-name symbols. Mixed into one WAV for smooth playback.
  def('melody', (notes, dur, vel) => {
    const d = dur === undefined ? 0.2 : +dur
    const v = vel === undefined ? 0.5 : +vel
    const listArr = Array.isArray(notes) ? notes : []
    const midis = listArr
      .map(x => typeof x === 'number' ? x : nameToMidi(nameOf(x) ?? String(x)))
      .filter(m => Number.isFinite(m))
    if (midis.length === 0) return undefined
    import('./audio-driver.js').then(m => m.playSequence(midis, d, v)).catch(() => {})
    return undefined
  })

  // (sfx kind freq dur . opts) — a synthesized sound effect.
  def('sfx', (kind, freq, dur, ...opts) => {
    const st = getMediaState()
    const k = nameOf(kind) ?? 'pulse'
    // opts arrive as flat (:key val :key val ...) pairs. Bundle them.
    const spec = { attack: 0.01, decay: 0, sustain: 1, release: 0.05 }
    for (let i = 0; i < opts.length - 1; i += 2) {
      const key = nameOf(opts[i])
      if (key) spec[key.replace(/^:/, '')] = opts[i + 1]
    }
    return st.audio.sfx(k, +freq, dur === undefined ? 0.25 : +dur, spec)
  })

  // (music track) — schedule a named track. Empty string = silence.
  def('music', (track) => {
    return getMediaState().audio.music(nameOf(track) ?? String(track ?? ''))
  })

  // (silence dur) — reserve dur seconds of quiet on the timeline.
  def('silence', (dur) => {
    return getMediaState().audio.silence(dur === undefined ? 0.25 : +dur)
  })

  // (stop-sound) — cancel any scheduled audio.
  def('stop-sound', () => {
    getMediaState().audio.stop()
    return undefined
  })

  // ── ANIMATION + INPUT ───────────────────────────────────────────

  // (on-frame handler) — install a frame handler. Handler is called
  // with the current frame number.
  //
  // Reference (MOTOI-SCHEME-REFERENCE.slat, on-frame): "Single callback;
  // no chaining or multiple listeners." So we REPLACE the handler on
  // each call — later calls override earlier ones — matching the
  // documented shape. Users who want multiplex can compose in Scheme.
  def('on-frame', (fn) => {
    if (typeof fn !== 'function' && !(fn && fn.params)) {
      throw new Error('on-frame: handler must be a procedure')
    }
    const st = getMediaState()
    st.events.frame = [fn]
    st.loop.ensureRunning()
    return undefined
  })

  // (on-key handler) — handler receives the key name (a symbol).
  // Single-slot per the reference; later calls override earlier ones.
  def('on-key', (fn) => {
    if (typeof fn !== 'function' && !(fn && fn.params)) {
      throw new Error('on-key: handler must be a procedure')
    }
    const st = getMediaState()
    st.events.key = [fn]
    return undefined
  })

  // (on-mouse handler) — handler receives (x y button).
  def('on-mouse', (fn) => {
    if (typeof fn !== 'function' && !(fn && fn.params)) {
      throw new Error('on-mouse: handler must be a procedure')
    }
    const st = getMediaState()
    st.events.mouse = [fn]
    return undefined
  })

  // (on-gamepad handler) — handler receives (pad-index button pressed?).
  def('on-gamepad', (fn) => {
    if (typeof fn !== 'function' && !(fn && fn.params)) {
      throw new Error('on-gamepad: handler must be a procedure')
    }
    const st = getMediaState()
    st.events.gamepad = [fn]
    return undefined
  })

  // (sync) — explicit yield. In Node it's a microtask; in the browser
  // it's a raf.
  def('sync', () => {
    // The interpreter is synchronous; sync just returns the frame
    // number, giving the caller a chance to snapshot state.
    return getMediaState().fb.frame
  })

  // (sleep sec) — busy-wait for at most `sec` seconds. In a real
  // animation loop this is short (<0.1s); longer values throw so we
  // don't hang a REPL by accident.
  //
  // 2026-07-19: added (sleep-ms N) as an additive alias so kids typing
  // "wait 200 milliseconds" get a blocking pause. (wait ms) in the
  // scheduler returns a tagged clause and does NOT block — that's a
  // foot-gun we can't fix without a signature change. sleep-ms is
  // the honest way. Also added (print v) as an alias of display and
  // (println v) = display + newline for kids from other languages.
  def('sleep', (sec) => {
    const seconds = +sec
    if (!(seconds >= 0)) throw new Error('sleep: expected non-negative seconds')
    if (seconds > 5) throw new Error('sleep: refusing to hang more than 5s')
    const start = Date.now()
    const target = start + seconds * 1000
    // Deliberately spin — this is the terminal REPL, and busy-loop is
    // fine at short durations. Browser and animation loops use rAF.
    while (Date.now() < target) { /* spin */ }
    return undefined
  })

  // (sleep-ms N) — blocking pause for N milliseconds. Additive alias
  // of sleep — the tagged-clause `wait` doesn't block, and this is
  // what a kid types. Caps at 5000 ms like sleep.
  def('sleep-ms', (ms) => {
    const seconds = (+ms) / 1000
    if (!(seconds >= 0)) throw new Error('sleep-ms: expected non-negative ms')
    if (seconds > 5) throw new Error('sleep-ms: refusing to hang more than 5000 ms')
    const target = Date.now() + seconds * 1000
    while (Date.now() < target) { /* spin */ }
    return undefined
  })

  // (print v) — alias of display. Familiar to kids from Python/Racket.
  // Does NOT append a newline; use println for that.
  const _display = env.get('display')
  const _newline = env.get('newline')
  def('print',   (v) => _display(v))

  // (println v) — display + newline. What most kids mean by "print".
  def('println', (v) => {
    if (v !== undefined) _display(v)
    return _newline()
  })

  // (frame-rate) — return the target frame rate the loop is running at.
  def('frame-rate', () => getMediaState().loop.fps)

  // (set-frame-rate n) — change the target FPS (1..120).
  def('set-frame-rate', (n) => {
    const st = getMediaState()
    st.loop.fps = Math.max(1, Math.min(120, n | 0))
    return st.loop.fps
  })

  // (stop) — halt the animation loop.
  def('stop', () => {
    getMediaState().loop.stop()
    return undefined
  })

  // (tick-frame) — manually advance the animation loop by one frame.
  // Useful in scripts and tests where you want a deterministic
  // step-by-step run instead of the wall-clock setInterval.
  def('tick-frame', () => {
    const st = getMediaState()
    st.loop.tick()
    return st.fb.frame
  })

  // (fire-key name) — synthesize a key event. Wraps on-key handlers.
  def('fire-key', (name) => {
    getMediaState().loop.fireKey(nameOf(name) ?? String(name))
    return undefined
  })

  // (fire-mouse x y button) — synthesize a mouse event.
  def('fire-mouse', (x, y, button) => {
    getMediaState().loop.fireMouse(+x, +y, button === undefined ? 0 : (button | 0))
    return undefined
  })

  // (fire-gamepad pad button pressed?) — synthesize a gamepad event.
  def('fire-gamepad', (pad, button, pressed) => {
    getMediaState().loop.fireGamepad(pad | 0, button | 0, !!pressed)
    return undefined
  })

  // ── SAVE / LOAD CART ────────────────────────────────────────────
  //
  // SECURITY (Priya 2026-07-17): both verbs sandbox the caller-supplied
  // path to `~/.motoi/carts/` and reject any traversal / absolute path.
  // Prior behavior: caller passed an arbitrary FS path, verb wrote/read
  // there — an untrusted-tier cart could clobber `~/.ssh/authorized_keys`
  // or read arbitrary files. Now the caller passes a bare filename;
  // characters outside `[A-Za-z0-9._-]` are stripped; the result is
  // joined under `~/.motoi/carts/`. `save-cart` also carries `perm:paint`
  // so `untrusted` / `external` tiers can't fire it at all.

  def('save-cart', (path) => {
    const st = getMediaState()
    const cart = {
      version: 1,
      created: new Date().toISOString(),
      framebuffer: st.fb.toObject(),
      audio: st.audio.snapshot(),
    }
    const p = _safeCartPath(path)
    if (!p) throw new Error('save-cart: invalid cart name (must be a bare filename)')
    // Emit as a SLAT record — same reader as the language uses.
    const slat = cartToSlat(cart)
    const fs = tryLoadFs()
    if (!fs) throw new Error('save-cart: filesystem not available in this environment')
    _ensureCartDir(fs)
    fs.writeFileSync(p, slat, 'utf-8')
    return p
  }, 'paint')

  // (load-cart path) — restore state from a .sks cart.
  def('load-cart', (path) => {
    const p = _safeCartPath(path)
    if (!p) throw new Error('load-cart: invalid cart name (must be a bare filename)')
    const fs = tryLoadFs()
    if (!fs) throw new Error('load-cart: filesystem not available in this environment')
    const raw = fs.readFileSync(p, 'utf-8')
    const cart = slatToCart(raw)
    const st = getMediaState()
    st.fb = Framebuffer.fromObject(cart.framebuffer)
    st.loop.attachFramebuffer(st.fb)
    st.audio.restore(cart.audio || {})
    return p
  }, 'paint')
}

// ── cart serialization ──────────────────────────────────────────────

// Cart serialization uses a simple prose-header + JSON-blob shape.
// Human-readable at the top; strict JSON for the state so we can
// round-trip losslessly without fighting a hand-rolled parser.
//
//   ; motoi scheme cart snapshot
//   ; created 2026-...
//   #!json-blob
//   { ... }
function cartToSlat(cart) {
  const header = [
    '; motoi scheme cart snapshot',
    `; created ${cart.created}`,
    `; version ${cart.version}`,
    '#!json-blob',
  ].join('\n')
  return header + '\n' + JSON.stringify(cart, null, 0) + '\n'
}

function slatToCart(raw) {
  const marker = raw.indexOf('#!json-blob')
  if (marker < 0) throw new Error('load-cart: not a recognized snapshot (missing #!json-blob)')
  // Everything after the marker's newline is the JSON blob.
  const nl = raw.indexOf('\n', marker)
  if (nl < 0) throw new Error('load-cart: truncated snapshot')
  const jsonPart = raw.slice(nl + 1).trim()
  let cart
  try { cart = JSON.parse(jsonPart) }
  catch (e) { throw new Error('load-cart: invalid JSON payload: ' + e.message) }
  if (!cart.framebuffer || !Array.isArray(cart.framebuffer.pixels)) {
    throw new Error('load-cart: cart missing framebuffer')
  }
  return cart
}

// Filesystem access — Node only. In the browser build, the `import`
// line below gets stripped by build.mjs; the runtime skips fs and
// save-cart/load-cart error cleanly at call time.
import * as _nodeFs from 'node:fs'
function tryLoadFs() {
  // eslint-disable-next-line no-undef
  try { return typeof _nodeFs !== 'undefined' ? _nodeFs : null } catch { return null }
}
