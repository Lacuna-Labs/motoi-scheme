// world.js — CORE `world/*` verbs (Wave 2, 2026-07-16).
//
// Doctrine: a world is a container of entities + camera + physics
// params. Uses the shared game state passed in from makeCoreEnv so
// world verbs and entity verbs point at the SAME entities map. No new
// storage class — world is a facade over `game`.

import { Sym } from '../../src/reader.js'
import { apply } from '../../src/interp.js'

const nm = (x) => (x instanceof Sym ? x.name : x)

let _wAutoId = 1
function _nextId() { return `w${_wAutoId++}` }

// Camera state — module-scoped, shared with camera.js consumers.
export const cameraState = {
  x: 0, y: 0, zoom: 1,
  followId: null,
  bounds: null,   // { x, y, w, h }
  shake: 0,       // remaining shake ticks
  homeX: 0, homeY: 0,
}

export function __resetWorld() {
  _wAutoId = 1
  cameraState.x = 0; cameraState.y = 0; cameraState.zoom = 1
  cameraState.followId = null; cameraState.bounds = null; cameraState.shake = 0
  cameraState.homeX = 0; cameraState.homeY = 0
}

export function installWorld(env, game, fuel) {
  const _fuel = fuel ?? { n: 1_000_000 }
  const def = (n, f, perm = 'state-change') => env.define(n, f, { perm })

  // (world/spawn kind x y ...) → id.  Delegates to entity/spawn but with
  // a "w" prefix on id.
  def('world/spawn', (kind, x, y, w = 16, h = 16) => {
    const id = _nextId()
    const kindName = String(nm(kind))
    game.entities.set(id, {
      id, kind: kindName,
      x: Number(x) || 0, y: Number(y) || 0,
      vx: 0, vy: 0,
      w: Number(w) || 16, h: Number(h) || 16,
      tags: new Set([kindName]), alive: true, hp: 1,
    })
    return id
  }, 'paint')

  // (world/step) — integrate a physics tick. Returns frame counter.
  def('world/step', () => {
    for (const e of game.entities.values()) {
      if (!e.alive) continue
      // integrate: v *= friction, v.y += gravity, pos += v
      e.vy = (e.vy || 0) + (game.gravity || 0)
      e.vx = (e.vx || 0) * (game.friction || 1)
      e.vy = (e.vy || 0) * (game.friction || 1)
      e.x += e.vx
      e.y += e.vy
    }
    game.frameNo = (game.frameNo || 0) + 1
    if (cameraState.shake > 0) cameraState.shake--
    if (cameraState.followId) {
      const e = game.entities.get(cameraState.followId)
      if (e) { cameraState.x = e.x; cameraState.y = e.y }
    }
    return game.frameNo
  }, 'paint')

  // (world/render) → tagged list of entity render descriptors.
  def('world/render', () => {
    const out = []
    for (const e of game.entities.values()) {
      out.push([new Sym('entity'), e.id, e.x, e.y, e.w, e.h])
    }
    return out
  }, 'read')

  // (world/frame) → current frame counter.
  def('world/frame', () => game.frameNo || 0, 'read')

  // (world/each fn) — apply fn to each entity id.
  def('world/each', (fn) => {
    if (fn == null) return undefined
    for (const id of Array.from(game.entities.keys())) {
      try { apply(fn, [id], _fuel) } catch { /* skip failures */ }
    }
    return undefined
  }, 'paint')

  // (world/find pred) → list of matching entity ids.
  def('world/find', (pred) => {
    if (pred == null) return []
    const r = []
    for (const id of game.entities.keys()) {
      try {
        if (apply(pred, [id], _fuel) !== false) r.push(id)
      } catch { /* skip */ }
    }
    return r
  }, 'read')

  // (world/count) → total entity count.
  def('world/count', () => game.entities.size, 'read')

  // (world/nearest ref) → id of the nearest OTHER entity, or #f.
  def('world/nearest', (ref) => {
    const R = game.entities.get(String(nm(ref)))
    if (!R) return false
    let bestId = false, bestD = Infinity
    for (const [id, e] of game.entities) {
      if (id === R.id) continue
      const d = Math.hypot(e.x - R.x, e.y - R.y)
      if (d < bestD) { bestD = d; bestId = id }
    }
    return bestId
  }, 'read')

  // (world/camera) → (x y zoom).
  def('world/camera', () => [cameraState.x, cameraState.y, cameraState.zoom], 'read')

  // (world/camera-follow! id) — camera follows entity.
  def('world/camera-follow!', (id) => {
    cameraState.followId = String(nm(id))
    return undefined
  }, 'paint')

  // (world/camera-bounds! x y w h) — clamp camera to bounds.
  // BUG (Zane-2, 2026-07-17): coerce to Number to match every other
  // world/camera-* verb. Previously stored raw args, so a Scheme caller
  // passing symbols or strings ended up with a bounds record that
  // silently mis-compared later.
  def('world/camera-bounds!', (x, y, w, h) => {
    cameraState.bounds = {
      x: Number(x) || 0,
      y: Number(y) || 0,
      w: Number(w) || 0,
      h: Number(h) || 0,
    }
    return undefined
  }, 'paint')

  // (world/camera-shake! magnitude) — set shake ticks.
  def('world/camera-shake!', (m) => {
    cameraState.shake = m | 0
    return undefined
  }, 'paint')

  // (world/camera-snap! x y) — teleport camera to (x,y).
  def('world/camera-snap!', (x, y) => {
    cameraState.x = Number(x) || 0
    cameraState.y = Number(y) || 0
    return undefined
  }, 'paint')

  // (world/gravity! g) → set world gravity.
  def('world/gravity!', (g) => { game.gravity = Number(g) || 0; return game.gravity }, 'paint')

  // (world/floor! y) → set collision floor. Entities with y > floor bounce.
  def('world/floor!', (y) => { game._floor = Number(y); return undefined }, 'paint')

  // (world/wind! wx wy?) → apply constant wind vector.
  def('world/wind!', (wx, wy) => {
    game._wind = [Number(wx) || 0, Number(wy) || 0]
    return undefined
  }, 'paint')

  // (world/reset!) → clear entities + reset frame.
  def('world/reset!', () => {
    game.entities.clear()
    game.frameNo = 0
    game.stopped = false
    return undefined
  }, 'paint')

  // (world/collisions) → list of ((a-id b-id) ...) overlapping pairs.
  def('world/collisions', () => {
    const list = Array.from(game.entities.values())
    const pairs = []
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j]
        if (a.x < b.x + b.w && b.x < a.x + a.w &&
            a.y < b.y + b.h && b.y < a.y + a.h) {
          pairs.push([a.id, b.id])
        }
      }
    }
    return pairs
  }, 'read')

  // (world/impulse! id fx fy) — additive velocity.
  def('world/impulse!', (id, fx, fy) => {
    const e = game.entities.get(String(nm(id)))
    if (!e) return undefined
    e.vx = (e.vx || 0) + (Number(fx) || 0)
    e.vy = (e.vy || 0) + (Number(fy) || 0)
    return undefined
  }, 'paint')

  // (world/after ms fn) — schedule after N ms. Simple: pushes to a
  // shared queue that world/step drains on tick. For CORE, we just
  // register into game state's ._after queue and drain naively.
  def('world/after', (ms, fn) => {
    if (!game._after) game._after = []
    game._after.push({ at: Date.now() + (ms | 0), fn })
    return undefined
  }, 'paint')

  return env
}

export default installWorld
