// animation.js — the shared animation loop.
//
// Provenance: scheme-lang/src/animation.js. Migrated to
// motoi-scheme/lib/graphics/ on 2026-07-16 (Pass-3 Wave 1). Dialect-
// neutral; no content changes.
//
// One loop, many callbacks. When the user calls `(on-frame handler)` we
// push into a callback list; when a key/mouse/gamepad event fires we
// dispatch to the appropriate list. The framebuffer's `frame` counter
// increments once per tick.
//
// The loop uses `setInterval` at 60Hz by default. In tests we stop
// after a fixed number of ticks (see `runFor()`).

import { apply } from '../../src/interp.js'
import { Sym } from '../../src/reader.js'

class AnimationLoop {
  constructor(fb) {
    this.fb = fb
    this.fps = 60
    this.running = false
    this.handle = null
    // Reference to media state's events. Set by attachEvents.
    this._events = null
    // Fuel budget cell — the media verbs get their fuel from the base
    // env's fuel object; the loop replenishes fuel each frame so long-
    // running games don't exhaust the fuel counter.
    this._fuel = null
  }

  attachFramebuffer(fb) { this.fb = fb }
  attachEvents(events)  { this._events = events }
  attachFuel(fuel)      { this._fuel = fuel }

  ensureRunning() {
    if (this.running) return
    this.running = true
    // If we don't have fuel we can't call handlers safely. Defer
    // starting until the first frame handler runs.
    const interval = Math.max(1, Math.floor(1000 / this.fps))
    // Node's setInterval isn't perfectly accurate at high FPS, but at
    // 60Hz it's within a couple ms — plenty for animation.
    this.handle = setInterval(() => this.tick(), interval)
    // Unref so tests/REPL can exit without an explicit stop().
    if (this.handle && typeof this.handle.unref === 'function') this.handle.unref()
  }

  stop() {
    if (this.handle) clearInterval(this.handle)
    this.handle = null
    this.running = false
  }

  tick() {
    if (!this._events || !this.fb) return
    this.fb.frame++
    // Replenish fuel each frame so a game can run indefinitely.
    if (this._fuel) this._fuel.n = 200000
    for (const fn of this._events.frame) {
      try {
        // Call with zero args — reference semantics for on-frame.
        callHandler(fn, [], this._fuel)
      } catch (e) {
        // Stop the loop on unhandled error so the REPL surfaces it.
        // eslint-disable-next-line no-console
        console.error('on-frame handler error:', e && e.message ? e.message : e)
        this.stop()
        return
      }
    }
  }

  // Manually advance the loop N frames — useful in tests when we don't
  // want to wait for a real setInterval to fire.
  runFor(nFrames) {
    for (let i = 0; i < nFrames; i++) this.tick()
  }

  // Fire a key event through the registered handlers.
  fireKey(name) {
    if (!this._events) return
    const sym = typeof name === 'string' ? new Sym(name) : name
    for (const fn of this._events.key) {
      try { callHandler(fn, [sym], this._fuel) } catch { /* soft-fail */ }
    }
  }

  fireMouse(x, y, button) {
    if (!this._events) return
    for (const fn of this._events.mouse) {
      try { callHandler(fn, [x, y, button ?? 0], this._fuel) } catch { /* soft-fail */ }
    }
  }

  fireGamepad(pad, button, pressed) {
    if (!this._events) return
    for (const fn of this._events.gamepad) {
      try { callHandler(fn, [pad, button, !!pressed], this._fuel) } catch { /* soft-fail */ }
    }
  }
}

function callHandler(fn, args, fuel) {
  if (typeof fn === 'function') return fn(...args)
  // Closure — go through interp's apply so fuel accounting works.
  if (fn && fn.params) return apply(fn, args, fuel || { n: 200000 })
  throw new Error('handler is not callable')
}

// ── singleton ──────────────────────────────────────────────────────

let _loop = null
export function getAnimationLoop(fb) {
  if (!_loop) _loop = new AnimationLoop(fb)
  else if (fb) _loop.attachFramebuffer(fb)
  return _loop
}

// ── tween registry — text-friendly animation targets ────────────────
//
// Added 2026-07-16 as the text-anim lane. A tween is a lightweight
// "animate this thing over time" record. Two flavors:
//
//   text tween     → the target is a string (usually an emoji). The
//                    driver draws it via fb/text on each frame.
//   sprite tween   → the target is a sprite id (from sprite/define).
//                    The driver stamps it via the sprite raster.
//
// A tween is pure DATA — we don't mutate the framebuffer here. Each
// frame the caller can inspect (animation/tweens) to see what's live,
// or the `motion` verb sets up its own on-frame handler that draws
// the current position using fb/text.

const TWEENS = []

export function addTween(t) {
  TWEENS.push(t)
  return t
}

export function getTweens() {
  return TWEENS
}

export function clearTweens() {
  TWEENS.length = 0
}

// Compute a tween's current visible state given the current frame
// counter. Returns { x, y, done } — done is true once elapsed ≥ duration.
export function tweenState(tween, frame) {
  const start   = tween.startFrame ?? 0
  const durF    = Math.max(1, tween.durationFrames ?? 1)
  const elapsed = Math.max(0, frame - start)
  const t       = Math.min(1, elapsed / durF)
  const done    = elapsed >= durF
  const ease    = typeof tween.ease === 'function' ? tween.ease(t) : t
  const x       = tween.fromX + (tween.toX - tween.fromX) * ease
  const y       = tween.fromY + (tween.toY - tween.fromY) * ease
  return { x, y, t, done }
}

// ── animation-verb installer ────────────────────────────────────────
//
// (motion target :from (x y) :to (x y) :duration ms :easing name)
//   Tween a target (text/emoji or sprite name) from A to B.
//
// (bounce target [:height h] [:easing name])
//   The kid-friendly one-liner: bounce a target up by `height` pixels
//   and back down, springy by default.
//
// (animation/tweens)         → the live tween list
// (animation/tick)           → advance one frame; redraws all tweens
// (animation/clear!)         → drop every tween
//
// The verbs go through fb/text via renderText — no direct browser or
// terminal I/O. Sprite targets go through paint via the game state.
//
// Kid API: (bounce "🎉") — one call, animated emoji.
// Adult API: full :from / :to / :duration / :easing control.

import { namedEase, springEase, NAMED_EASINGS, bezierEase } from './easing.js'
import { Sym as SymCls, sym } from '../../src/reader.js'
import { renderText } from '../../adapters/base.js'
import { NAMED_COLORS } from './framebuffer.js'

const _nm = (x) => (x instanceof SymCls ? x.name : x)

// Extract keyword-shaped options from a flat arg list.
// Input: [ 'target, ':from, [10 10], ':to, [40 40], ':duration, 800 ]
// Output: { target: 'target, from: [10,10], to: [40,40], duration: 800 }
function kwargs(args) {
  const out = { positional: [] }
  let i = 0
  while (i < args.length) {
    const a = args[i]
    const name = a instanceof SymCls ? a.name : (typeof a === 'string' ? a : null)
    if (name && name.startsWith(':')) {
      out[name.slice(1)] = args[i + 1]
      i += 2
    } else {
      out.positional.push(a)
      i += 1
    }
  }
  return out
}

function pairCoord(v, fallbackX = 0, fallbackY = 0) {
  if (Array.isArray(v) && v.length >= 2) {
    return [Number(v[0]) || 0, Number(v[1]) || 0]
  }
  return [fallbackX, fallbackY]
}

function easeFnFromArg(easing) {
  if (easing == null) return (t) => t
  if (typeof easing === 'function') return easing
  const key = String(_nm(easing)).toLowerCase()
  const short = key.startsWith('easing/') ? key.slice(7) : key
  if (short === 'spring') return (t) => springEase(t)
  const spec = NAMED_EASINGS[short]
  if (Array.isArray(spec)) return (t) => bezierEase(t, spec[0], spec[1], spec[2], spec[3])
  return (t) => t
}

// Turn a duration-in-ms into a frame count at the current loop fps.
// Default 60fps ⇒ 800ms → 48 frames.
function msToFrames(ms, fps) {
  const f = Math.max(1, Math.round((Number(ms) || 0) * (Number(fps) || 60) / 1000))
  return f
}

// Draw one text tween at its current position via the adapter seam.
function drawTextTween(tween, x, y) {
  const s = String(tween.target ?? '')
  const c = tween.color ?? 14
  const cname = typeof c === 'string' ? c : (NAMED_COLORS[String(c).toLowerCase()] !== undefined ? c : `#${c}`)
  try {
    renderText(s, Math.round(x), Math.round(y), cname, tween.font || 'default')
  } catch { /* soft-fail */ }
  // Also push into the framebuffer's text overlay so headless tests see it.
  if (tween._fb) {
    if (!tween._fb.textOverlay) tween._fb.textOverlay = []
    const rec = {
      str: s, x: Math.round(x), y: Math.round(y),
      color: cname, font: tween.font || 'default',
    }
    // Include the current alpha when this tween is a fade (or has one
    // otherwise set). Headless observers can then verify opacity
    // interpolation independently of the host renderer.
    if (typeof tween.alpha === 'number') rec.alpha = tween.alpha
    tween._fb.textOverlay.push(rec)
    tween._fb.version++
  }
}

export function installAnimation(env, opts = {}) {
  const def = (n, f, perm = 'paint') => env.define(n, f, { perm })
  const getMedia = opts.getMedia
  const gameState = opts.game

  // (motion target :from (x y) :to (x y) :duration ms :easing name)
  //   Kick off a tween. The target can be a string (text/emoji) or a
  //   symbol (sprite name from game.js). Returns the tween record.
  def('motion', (...args) => {
    const kw = kwargs(args)
    const target = kw.target !== undefined ? kw.target : kw.positional[0]
    const from   = pairCoord(kw.from, 0, 0)
    const to     = pairCoord(kw.to, from[0], from[1])
    const durMs  = Number(kw.duration) || 800
    const st     = getMedia ? getMedia() : null
    const fps    = st?.loop?.fps || 60
    const durF   = msToFrames(durMs, fps)
    const easeFn = easeFnFromArg(kw.easing)
    const targetStr = target instanceof SymCls ? target.name : target

    const tween = {
      kind: typeof targetStr === 'string' ? 'text' : 'sprite',
      target: targetStr,
      fromX: from[0], fromY: from[1],
      toX:   to[0],   toY:   to[1],
      startFrame: st?.fb?.frame || 0,
      durationFrames: durF,
      ease: easeFn,
      color: kw.color ?? 14,
      font: kw.font ? String(_nm(kw.font)) : 'default',
      _fb: st?.fb || null,
    }
    addTween(tween)
    return tween
  })

  // (bounce target [:height h] [:easing e] [:duration ms] [:at (x y)])
  //   The kid-friendly one-liner: bounce a target UP by `:height` pixels
  //   and back down. Locked shape (2026-07-16 reconciliation):
  //     :height   pixels of peak displacement (default 40)
  //     :easing   easing curve — symbol OR procedure (default easing/spring)
  //     :duration ms for the full up-and-back arc (default 700)
  //     :at       optional (x y) origin; defaults to (40 40)
  //   target may be a text string / emoji OR an entity reference (Sym).
  def('bounce', (...args) => {
    const kw = kwargs(args)
    const target = kw.target !== undefined ? kw.target : kw.positional[0]
    const height = Number(kw.height) || 40
    const easing = kw.easing ?? sym('easing/spring')
    const durMs  = Number(kw.duration) || 700
    const st     = getMedia ? getMedia() : null
    const fps    = st?.loop?.fps || 60
    const durF   = msToFrames(durMs, fps)
    const at     = pairCoord(kw.at, 40, 40)

    // Bounce is: go up `height`, come back down. We do it as a single
    // tween with the easing shaping the SIN-arc timing curve.
    const easeFn = easeFnFromArg(easing)
    const targetStr = target instanceof SymCls ? target.name : target

    const tween = {
      kind: typeof targetStr === 'string' ? 'text' : 'sprite',
      target: targetStr,
      fromX: at[0], fromY: at[1],
      toX:   at[0], toY:   at[1],
      startFrame: st?.fb?.frame || 0,
      durationFrames: durF,
      ease: (t) => easeFn(t),
      color: kw.color ?? 14,
      font: kw.font ? String(_nm(kw.font)) : 'default',
      _fb: st?.fb || null,
      // Bounce-specific: the offset applied is a sin arc peaking at
      // `height` pixels above `at[1]`, driven by the eased t.
      _bounceHeight: height,
    }
    addTween(tween)
    return tween
  })

  // (slide target :from-side side [:distance d] [:duration ms] [:easing e]
  //         [:at (x y)])
  //   Slide a target IN from an edge — 'left, 'right, 'top, or 'bottom.
  //   Locked shape (2026-07-16 reconciliation):
  //     :from-side  one of 'left, 'right, 'top, 'bottom (required)
  //     :distance   pixels of off-screen offset (default 100)
  //     :duration   ms for the slide (default 400)
  //     :easing     easing curve — symbol OR procedure (default easing/emphasized)
  //     :at         optional (x y) target position; defaults to (40 40)
  //   target may be a text string / emoji OR an entity reference (Sym).
  def('slide', (...args) => {
    const kw = kwargs(args)
    const target = kw.target !== undefined ? kw.target : kw.positional[0]
    const rawSide = kw['from-side'] ?? kw.side ?? 'left'
    const side = String(_nm(rawSide)).toLowerCase()
    const distance = Number(kw.distance) || 100
    const durMs  = Number(kw.duration) || 400
    const easing = kw.easing ?? sym('easing/emphasized')
    const st     = getMedia ? getMedia() : null
    const fps    = st?.loop?.fps || 60
    const durF   = msToFrames(durMs, fps)
    const at     = pairCoord(kw.at, 40, 40)

    // Compute the start position based on the side we slide in from.
    let fromX = at[0], fromY = at[1]
    if (side === 'left')       fromX = at[0] - distance
    else if (side === 'right') fromX = at[0] + distance
    else if (side === 'top')   fromY = at[1] - distance
    else if (side === 'bottom')fromY = at[1] + distance

    const easeFn = easeFnFromArg(easing)
    const targetStr = target instanceof SymCls ? target.name : target

    const tween = {
      kind: typeof targetStr === 'string' ? 'text' : 'sprite',
      target: targetStr,
      fromX, fromY,
      toX: at[0], toY: at[1],
      startFrame: st?.fb?.frame || 0,
      durationFrames: durF,
      ease: easeFn,
      color: kw.color ?? 14,
      font: kw.font ? String(_nm(kw.font)) : 'default',
      _fb: st?.fb || null,
      _slideSide: side,
    }
    addTween(tween)
    return tween
  })

  // (fade target [:from a] [:to b] [:duration ms] [:easing e] [:at (x y)])
  //   Fade a target's OPACITY from :from to :to. Locked shape:
  //     :from     starting alpha 0..1 (default 1.0)
  //     :to       ending alpha 0..1 (default 0.0)
  //     :duration ms for the fade (default 600)
  //     :easing   easing curve — symbol OR procedure (default easing/standard)
  //     :at       optional (x y) origin for the painted target; (40 40) default
  //   target may be a text string / emoji OR an entity reference (Sym).
  //   The tween's :from/:to are stored on the record as `_fromAlpha` /
  //   `_toAlpha`; each frame the tween's current alpha is available for
  //   the driver to apply. The text overlay records include a numeric
  //   `alpha` field so headless observers can verify the fade.
  def('fade', (...args) => {
    const kw = kwargs(args)
    const target = kw.target !== undefined ? kw.target : kw.positional[0]
    const fromA = kw.from === undefined ? 1.0 : Number(kw.from)
    const toA   = kw.to   === undefined ? 0.0 : Number(kw.to)
    const durMs  = Number(kw.duration) || 600
    const easing = kw.easing ?? sym('easing/standard')
    const st     = getMedia ? getMedia() : null
    const fps    = st?.loop?.fps || 60
    const durF   = msToFrames(durMs, fps)
    const at     = pairCoord(kw.at, 40, 40)

    const easeFn = easeFnFromArg(easing)
    const targetStr = target instanceof SymCls ? target.name : target

    const tween = {
      kind: typeof targetStr === 'string' ? 'text' : 'sprite',
      target: targetStr,
      fromX: at[0], fromY: at[1],
      toX:   at[0], toY:   at[1],
      startFrame: st?.fb?.frame || 0,
      durationFrames: durF,
      ease: easeFn,
      color: kw.color ?? 14,
      font: kw.font ? String(_nm(kw.font)) : 'default',
      _fb: st?.fb || null,
      _fromAlpha: fromA,
      _toAlpha:   toA,
      alpha: fromA,
    }
    addTween(tween)
    return tween
  })

  // (animation/tick) — advance one frame + redraw all tweens.
  //   Callers can drive this manually (headless tests) or hook it to
  //   on-frame for a live loop. Returns the number of active tweens.
  def('animation/tick', () => {
    const st = getMedia ? getMedia() : null
    if (!st || !st.fb) return 0
    const frame = st.fb.frame
    let active = 0
    for (const tween of TWEENS) {
      const s = tweenState(tween, frame)
      let x = s.x, y = s.y
      // Bounce: apply sin-shaped arc so it goes up and comes down.
      if (typeof tween._bounceHeight === 'number') {
        const arc = Math.sin(Math.PI * s.t) * tween._bounceHeight
        x = tween.fromX
        y = tween.fromY - arc
      }
      // Fade: interpolate the tween's alpha from _fromAlpha → _toAlpha
      // using the eased t. Store on the tween so the overlay observers
      // and any listener (motion/on-settle etc.) can read the current
      // opacity every frame.
      if (typeof tween._fromAlpha === 'number' &&
          typeof tween._toAlpha === 'number') {
        const ease = typeof tween.ease === 'function' ? tween.ease(s.t) : s.t
        tween.alpha = tween._fromAlpha +
                      (tween._toAlpha - tween._fromAlpha) * ease
      }
      if (tween.kind === 'text') drawTextTween(tween, x, y)
      else if (tween.kind === 'sprite' && gameState) {
        // Sprite tween: nudge the sprite's spec if it exists.
        for (const sp of gameState.sprites) {
          if (sp.name === String(tween.target)) {
            sp.x = x; sp.y = y
            if (typeof tween.alpha === 'number') sp.alpha = tween.alpha
          }
        }
      }
      // Settle callback: when a tween completes on this frame, invoke
      // its on-settle callback exactly once. See motion/on-settle.
      if (s.done && !tween._settled) {
        tween._settled = true
        if (typeof tween._onSettle === 'function') {
          try { tween._onSettle(tween) } catch { /* soft-fail */ }
        }
      }
      if (!s.done) active++
    }
    return active
  })

  // (animation/tweens) → the current live tween list (test-facing).
  def('animation/tweens', () => TWEENS.slice(), 'read')

  // (animation/clear!) — drop every tween.
  def('animation/clear!', () => { clearTweens(); return undefined })

  // (motion/move-to target x y [:duration ms] [:easing e])
  //   Universal travel verb: build a tween that carries the target
  //   from its current position to (x, y). If `:duration` is omitted
  //   the target snaps INSTANTLY (returns a completed no-op tween);
  //   otherwise the tween animates over `:duration` milliseconds using
  //   the given easing (default easing/standard).
  //   `target` may be a string (text/emoji) or a Sym (entity id).
  //   Locked shape (2026-07-16 reconciliation): uniform :duration +
  //   :easing across every motion verb, symbol OR procedure accepted.
  def('motion/move-to', (...args) => {
    const kw = kwargs(args)
    const target = kw.target !== undefined ? kw.target : kw.positional[0]
    const x = kw.x !== undefined ? Number(kw.x)
             : (kw.positional.length >= 2 ? Number(kw.positional[1]) : 0)
    const y = kw.y !== undefined ? Number(kw.y)
             : (kw.positional.length >= 3 ? Number(kw.positional[2]) : 0)
    const st  = getMedia ? getMedia() : null
    const fps = st?.loop?.fps || 60
    const targetStr = target instanceof SymCls ? target.name : target
    const durMs = kw.duration === undefined ? 0 : Number(kw.duration)

    // Look up the entity's current position if the target names one.
    let fromX = 0, fromY = 0
    if (gameState && typeof targetStr === 'string' &&
        gameState.entities && gameState.entities.has(targetStr)) {
      const e = gameState.entities.get(targetStr)
      fromX = e.x; fromY = e.y
    } else if (kw.from) {
      const p = pairCoord(kw.from, 0, 0)
      fromX = p[0]; fromY = p[1]
    }

    // No duration → instant snap. Move the entity now and return a
    // completed tween record so callers can still chain :on-settle etc.
    if (!(durMs > 0)) {
      if (gameState && typeof targetStr === 'string' &&
          gameState.entities && gameState.entities.has(targetStr)) {
        const e = gameState.entities.get(targetStr)
        e.x = x; e.y = y
      }
      const snap = {
        kind: typeof targetStr === 'string' &&
              gameState && gameState.entities && gameState.entities.has(targetStr)
              ? 'sprite' : 'text',
        target: targetStr,
        fromX: x, fromY: y, toX: x, toY: y,
        startFrame: st?.fb?.frame || 0,
        durationFrames: 1,
        ease: (t) => t,
        color: kw.color ?? 14,
        font: kw.font ? String(_nm(kw.font)) : 'default',
        _fb: st?.fb || null,
        _instant: true,
      }
      addTween(snap)
      return snap
    }

    const easeFn = easeFnFromArg(kw.easing ?? sym('easing/standard'))
    const tween = {
      kind: typeof targetStr === 'string' &&
            gameState && gameState.entities && gameState.entities.has(targetStr)
            ? 'sprite' : 'text',
      target: targetStr,
      fromX, fromY,
      toX: x, toY: y,
      startFrame: st?.fb?.frame || 0,
      durationFrames: msToFrames(durMs, fps),
      ease: easeFn,
      color: kw.color ?? 14,
      font: kw.font ? String(_nm(kw.font)) : 'default',
      _fb: st?.fb || null,
    }
    addTween(tween)
    return tween
  })

  // (motion/on-settle target handler)
  //   Register a callback fired exactly once when `target` stops moving.
  //   `target` may be:
  //     · a tween record (from motion/motion/move-to/bounce/slide/fade)
  //       — handler fires when the tween's frame count elapses
  //     · a Sym / string entity id — handler fires when the entity's
  //       associated tween(s) complete, or when its velocity settles
  //       below the resting threshold (0.01 magnitude)
  //   Handler receives the target (tween record or entity id) so
  //   consumers can inspect the final state.
  def('motion/on-settle', (target, handler) => {
    if (typeof handler !== 'function' && !(handler && handler.params)) {
      throw new Error('motion/on-settle: handler must be a procedure')
    }
    // Wrap closures so they can be applied through the interpreter.
    const wrap = (fn) => {
      if (typeof fn === 'function') return fn
      return (arg) => apply(fn, [arg], { n: 200000 })
    }
    const cb = wrap(handler)

    // Tween form.
    if (target && typeof target === 'object' &&
        typeof target.durationFrames === 'number') {
      target._onSettle = cb
      if (target._settled) target._settled = false
      return true
    }

    // Entity form. Attach to the entity's scratch so the next physics
    // step / tween completion targeting it fires the callback.
    if (gameState && gameState.entities) {
      const key = target instanceof SymCls ? target.name : String(target)
      const e = gameState.entities.get(key)
      if (e) {
        e._onSettle = cb
        // Attach also to any live tween whose target names this entity.
        for (const tw of TWEENS) {
          if (String(tw.target) === key) tw._onSettle = cb
        }
        return true
      }
    }
    return false
  })

  return env
}
