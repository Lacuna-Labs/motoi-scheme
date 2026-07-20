// game-instances.js — multi-instance game loop registry.
//
// Provenance: scheme-lang/src/game-instances.js. Migrated to
// motoi-scheme/lib/game/ on 2026-07-16 (Pass-3 Wave 1). Dialect-
// neutral; no content changes.
//
// The reference documents the "big-bang" pattern: start a world with
// (big-bang initial-state) → id, then drive it with (game/step id) and
// query it with (game/frame id) / (game/state id) / (game/running? id)
// / (game/stop id). This module owns the ID → instance map.
//
// It is deliberately small — no rendering, no physics, no scheduling.
// A game instance is just:
//   { id, state, frame, running, stepFn }
// The caller-supplied stepFn (optional) advances state one frame; if
// absent, game/step just increments the frame counter and returns 'ok.
//
// Kid-readable comment: this is the "you can have more than one game
// at once" part. Every big-bang gets an id — like room numbers in a
// hotel. Frame counter, state, running flag all live behind that id.

import { Sym } from '../../src/reader.js'
import { apply } from '../../src/interp.js'

// ── module-level registry ──────────────────────────────────────────────
const INSTANCES = new Map()
let NEXT_ID = 1

const nm = (x) => (x instanceof Sym ? x.name : x)

// BUG (Zane-2, 2026-07-17): accept both JS functions and Scheme Closures.
// Closures expose .params — the same shape check used in scheduler.js and
// game.js. Previously typeof-only, so (big-bang initial (lambda …)) from
// Scheme silently dropped the step-fn.
const _isCallable = (fn) => typeof fn === 'function' || !!(fn && fn.params)

// ── public API ─────────────────────────────────────────────────────────

export function createInstance(initialState, stepFn) {
  const id = NEXT_ID++
  INSTANCES.set(id, {
    id,
    state: initialState,
    frame: 0,
    running: true,
    stepFn: _isCallable(stepFn) ? stepFn : null,
  })
  return id
}

export function getInstance(id) {
  return INSTANCES.get(Number(id)) || null
}

export function stepInstance(id) {
  const inst = INSTANCES.get(Number(id))
  if (!inst) return new Sym('nan')
  if (!inst.running) return new Sym('done')
  inst.frame += 1
  if (inst.stepFn) {
    try {
      // BUG (Zane-2, 2026-07-17): route through apply so Scheme Closures
      // work as stepFn. Native JS functions still work — apply's
      // dispatch table (interp.js applyStep) forwards them unchanged.
      const next = typeof inst.stepFn === 'function'
        ? inst.stepFn(inst.state, inst.frame)
        : apply(inst.stepFn, [inst.state, inst.frame], { n: 200000 })
      if (next !== undefined) inst.state = next
    } catch {
      // stepFn threw — treat as an error status, don't stop the loop
      return new Sym('error')
    }
  }
  return new Sym('ok')
}

export function stopInstance(id) {
  const inst = INSTANCES.get(Number(id))
  if (!inst) return false
  inst.running = false
  return true
}

// Test seam.
export function clearInstances() {
  INSTANCES.clear()
  NEXT_ID = 1
}

// ── install into a Scheme env ──────────────────────────────────────────

export function installGameInstances(env) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  // (big-bang initial-state) → id
  // (big-bang initial-state step-fn) → id
  //   step-fn receives (state frame) and returns the next state.
  def('big-bang', (initialState, stepFn) => createInstance(initialState, stepFn), 'state-change')

  // (game/state id) → state | 'nan
  def('game/state', (id) => {
    const inst = getInstance(id)
    if (!inst) return new Sym('nan')
    return inst.state
  })

  // (game/frame id) → n | 'nan
  def('game/frame', (id) => {
    const inst = getInstance(id)
    if (!inst) return new Sym('nan')
    return inst.frame
  })

  // (game/running? id) → boolean
  def('game/running?', (id) => {
    const inst = getInstance(id)
    return !!(inst && inst.running)
  })

  // (game/step id) → status ('ok | 'done | 'error | 'nan)
  def('game/step', (id) => stepInstance(id), 'state-change')

  // (game/stop id) → #t | #f
  def('game/stop', (id) => stopInstance(id), 'state-change')

  return env
}

export default installGameInstances
