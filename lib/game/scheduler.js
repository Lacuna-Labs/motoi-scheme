// scheduler.js — timing / scheduling primitives on top of the game loop.
//
// Doctrine (Alfred, 2026-07-16): pure scheduling. Each verb pushes a
// tagged clause onto the local scheduler registry OR runs immediately
// against wall-clock. No frame loop is spun up; callers with a real
// runtime (media.js's animation loop) can drain the registry each tick.
//
// Verbs:
//   on-tick fn                — register a per-tick handler
//   cancel-tick id            — remove a handler by id
//   after ms fn               — one-shot after N ms
//   wait ms                   — return a tagged "wait" clause
//   stop-when pred            — return a tagged clause
//   at-beat beat fn           — schedule at a beat (beat clock local)
//   across-beats a b fn       — schedule across beat range
//   land-on-downbeat beat     — snap value to nearest downbeat integer
//   sub-position-per-beat n   — declare subdivisions per beat
//   arc-between a b fn        — interpolation clause
//   tempo bpm?                — get/set the beat clock BPM
//   beat/on beat fn           — namespaced alias of at-beat
//   on-canvas-trace           — LIVES in framebuffer-verbs.js; not here

import { Sym } from '../../src/reader.js'

// Local registry — module-scoped, cleared on demand by test harnesses.
const state = {
  nextId: 1,
  tickHandlers: new Map(),  // id -> fn
  afterQueue: [],           // { fireAt, fn }
  bpm: 120,
  subs: 4,                  // subdivisions per beat
}

export function __resetScheduler() {
  state.nextId = 1
  state.tickHandlers.clear()
  state.afterQueue.length = 0
  state.bpm = 120
  state.subs = 4
}

function tag(name, ...rest) { return [new Sym(name), ...rest] }

export function installScheduler(env, fuel) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  // BUG (Zane-2, 2026-07-17): accept BOTH JS functions and Scheme
  // Closures (from src/interp.js). Previously only typeof === 'function'
  // passed the gate, so any (on-tick (lambda () …)) or (after ms
  // (lambda () …)) call from Scheme silently returned -1 without
  // registering the handler. Closures expose a .params array; the same
  // shape check is used elsewhere in this codebase (see game.js:355).
  const isCallable = (fn) => typeof fn === 'function' || !!(fn && fn.params)

  // (on-tick fn) → id. Registers a per-frame handler. Returns the id
  // for later cancellation. The active game-loop (media.js) may drain
  // and execute these; in pure REPL mode they simply sit registered.
  def('on-tick', (fn) => {
    if (!isCallable(fn)) return -1
    const id = state.nextId++
    state.tickHandlers.set(id, fn)
    return id
  }, 'paint')

  // (cancel-tick id) → #t if removed, #f otherwise.
  def('cancel-tick', (id) => state.tickHandlers.delete(id | 0), 'paint')

  // (after ms fn) → id. One-shot after ms have passed. Returns id.
  def('after', (ms, fn) => {
    if (!isCallable(fn)) return -1
    const id = state.nextId++
    state.afterQueue.push({ id, fireAt: Date.now() + (ms | 0), fn })
    return id
  }, 'paint')

  // (wait ms) → tagged clause. Consumers of the clause block for ms.
  def('wait', (ms) => tag('wait', ms | 0))

  // (stop-when pred) → tagged clause.
  def('stop-when', (pred) => tag('stop-when', pred))

  // (at-beat beat fn) → tagged clause OR immediate register.
  def('at-beat', (beat, fn) => tag('at-beat', beat, fn))

  // (beat/on beat fn) — namespaced alias.
  def('beat/on', (beat, fn) => tag('at-beat', beat, fn))

  // (across-beats a b fn) → tagged clause spanning beats a..b.
  def('across-beats', (a, b, fn) => tag('across-beats', a, b, fn))

  // (land-on-downbeat beat) — round a beat number to the nearest whole
  // beat. Useful for snapping user actions.
  def('land-on-downbeat', (beat) => Math.round(beat))

  // (sub-position-per-beat n?) — get or set subdivisions per beat.
  def('sub-position-per-beat', (n) => {
    if (n != null) state.subs = n | 0
    return state.subs
  }, 'paint')

  // (arc-between a b fn) → tagged clause for interpolation.
  def('arc-between', (a, b, fn) => tag('arc-between', a, b, fn))

  // (tempo bpm?) → current BPM. If bpm supplied, sets it.
  def('tempo', (bpm) => {
    if (bpm != null) state.bpm = Number(bpm) || state.bpm
    return state.bpm
  }, 'paint')

  return env
}

export default installScheduler
