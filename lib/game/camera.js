// camera.js — dashed-name camera verbs.
//
// Doctrine: separate from world/camera-*. These operate on the
// framebuffer viewport directly via a shared cameraState from world.js.
// Names use dashes (camera-pan, camera-x) matching the CORE reference.

import { cameraState } from './world.js'

export function installCamera(env, fuel) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  // (camera-center-on x y) — set camera position.
  def('camera-center-on', (x, y) => {
    cameraState.x = Number(x) || 0
    cameraState.y = Number(y) || 0
    return [cameraState.x, cameraState.y]
  }, 'paint')

  // (camera-pan dx dy) — additive pan.
  def('camera-pan', (dx, dy) => {
    cameraState.x += Number(dx) || 0
    cameraState.y += Number(dy) || 0
    return [cameraState.x, cameraState.y]
  }, 'paint')

  // (camera-pan-to x y speed?) — for CORE, just teleport; a real UI
  // adapter could animate.
  def('camera-pan-to', (x, y, speed) => {
    cameraState.x = Number(x) || 0
    cameraState.y = Number(y) || 0
    return [cameraState.x, cameraState.y]
  }, 'paint')

  // (camera-zoom-to z) — set zoom.
  def('camera-zoom-to', (z) => { cameraState.zoom = Number(z) || 1; return cameraState.zoom }, 'paint')

  // (camera-home) → snap to (0,0) OR the recorded home coords.
  def('camera-home', () => {
    cameraState.x = cameraState.homeX
    cameraState.y = cameraState.homeY
    return [cameraState.x, cameraState.y]
  }, 'paint')

  // (camera-set! x y zoom?) — full state set + record as new home.
  def('camera-set!', (x, y, zoom) => {
    cameraState.x = Number(x) || 0
    cameraState.y = Number(y) || 0
    if (zoom != null) cameraState.zoom = Number(zoom) || 1
    cameraState.homeX = cameraState.x
    cameraState.homeY = cameraState.y
    return [cameraState.x, cameraState.y, cameraState.zoom]
  }, 'paint')

  // (camera-frame) → current viewport as (x y w h). Width/height come
  // from the framebuffer via viewport (installed elsewhere) — but for
  // pure math we fall back to (0, 0, 80, 80).
  def('camera-frame', () => [cameraState.x, cameraState.y, 80, 80])

  // (camera-state) → alist of current camera.
  def('camera-state', () => [
    ['x', cameraState.x],
    ['y', cameraState.y],
    ['zoom', cameraState.zoom],
    ['shake', cameraState.shake],
  ])

  // (camera-x) → current x.
  def('camera-x', () => cameraState.x)
  // (camera-y) → current y.
  def('camera-y', () => cameraState.y)

  return env
}

export default installCamera
