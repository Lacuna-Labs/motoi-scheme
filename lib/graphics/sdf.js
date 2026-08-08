// sdf.js — Stage 4: signed distance fields + boolean algebra.
//
// Authored 2026-07-29 (drawing-primitives build, stage 4). Made by
// Alfred Borden.
//
// A signed distance field answers one question for every point on the
// canvas: "how far am I from this shape, and am I inside (negative) or
// outside (positive)?" That single scalar makes booleans trivial —
// union is `min`, intersection is `max`, subtraction is
// `max(a, -b)` — so Motoi can carve a window out of a wall or fuse two
// blobs with plain arithmetic. Distance formulas after Inigo Quilez's
// 2D SDF catalogue (iquilezles.org/articles/distfunctions2d).
//
// An SDF here is an opaque value `{ __sdf: true, f }` where `f(x,y)`
// returns the signed distance in pixels. Constructors build them,
// booleans combine them, and only `sdf-fill` samples the field across
// the live framebuffer and paints the inside. Pure until the sink runs
// — deterministic and interpreter-gradeable like the rest of the stack.

import { Sym } from '../../src/reader.js'
import { getMediaState } from '../media/media.js'
import { recordPrimitive } from './framebuffer-verbs.js'
import { NAMED_COLORS } from './framebuffer.js'

import { seqVerb } from '../base/list.js'
function fb () {
  const st = getMediaState()
  return st && st.fb ? st.fb : null
}

function colorIndex (f, color) {
  if (color === undefined || color === null) return f.color
  if (color instanceof Sym) color = color.name
  if (typeof color === 'string') {
    const n = NAMED_COLORS[color.toLowerCase()]
    return n === undefined ? f.color : n
  }
  const len = f.palette.length
  return (((color | 0) % len) + len) % len
}

function isSdf (v) { return v && typeof v === 'object' && v.__sdf === true }
function makeSdf (f) { return { __sdf: true, f } }
function asF (v) { return isSdf(v) ? v.f : (typeof v === 'function' ? v : () => Infinity) }

export const VERBS = [
  'sdf/circle', 'sdf/box', 'sdf/segment',
  'sdf-union', 'sdf-intersect', 'sdf-subtract',
  'sdf-fill', 'sdf-fill-rect', 'sdf?',
]
export const LAZY = false

export function installSdf (env) {
  const def = (n, f, perm = 'read') => env.define(n, seqVerb(f), { perm })

  // (sdf/circle cx cy r) — distance to a circle of radius r.
  def('sdf/circle', (cx, cy, r) => {
    const CX = +cx, CY = +cy, R = Math.abs(+r)
    return makeSdf((x, y) => Math.hypot(x - CX, y - CY) - R)
  })

  // (sdf/box cx cy hw hh) — axis-aligned box, hw/hh are half-extents.
  def('sdf/box', (cx, cy, hw, hh) => {
    const CX = +cx, CY = +cy, HW = Math.abs(+hw), HH = Math.abs(+hh)
    return makeSdf((x, y) => {
      const dx = Math.abs(x - CX) - HW
      const dy = Math.abs(y - CY) - HH
      const ox = Math.max(dx, 0), oy = Math.max(dy, 0)
      return Math.hypot(ox, oy) + Math.min(Math.max(dx, dy), 0)
    })
  })

  // (sdf/segment x0 y0 x1 y1 thick) — a fat line segment (capsule).
  def('sdf/segment', (x0, y0, x1, y1, thick) => {
    const AX = +x0, AY = +y0, BX = +x1, BY = +y1, T = Math.abs(+thick) / 2
    const bax = BX - AX, bay = BY - AY
    const bab = bax * bax + bay * bay || 1
    return makeSdf((x, y) => {
      const pax = x - AX, pay = y - AY
      let h = (pax * bax + pay * bay) / bab
      h = h < 0 ? 0 : (h > 1 ? 1 : h)
      return Math.hypot(pax - bax * h, pay - bay * h) - T
    })
  })

  // (sdf-union a b) — everything in a OR b.  min.
  def('sdf-union', (a, b) => {
    const fa = asF(a), fb2 = asF(b)
    return makeSdf((x, y) => Math.min(fa(x, y), fb2(x, y)))
  })

  // (sdf-intersect a b) — only where a AND b.  max.
  def('sdf-intersect', (a, b) => {
    const fa = asF(a), fb2 = asF(b)
    return makeSdf((x, y) => Math.max(fa(x, y), fb2(x, y)))
  })

  // (sdf-subtract a b) — a with b carved out.  max(a, -b).
  def('sdf-subtract', (a, b) => {
    const fa = asF(a), fb2 = asF(b)
    return makeSdf((x, y) => Math.max(fa(x, y), -fb2(x, y)))
  })

  def('sdf?', (v) => isSdf(v))

  // (sdf-fill sdf [color]) — paint every pixel of the live framebuffer
  // whose signed distance is <= 0 (inside the shape).
  def('sdf-fill', (sdf, color) => {
    const f = fb(); if (!f || !isSdf(sdf)) return undefined
    const g = sdf.f
    const c = colorIndex(f, color)
    for (let y = 0; y < f.h; y++) {
      for (let x = 0; x < f.w; x++) {
        if (g(x, y) <= 0) f.plot(x, y, c)
      }
    }
    f.version++
    recordPrimitive(['sdf-fill'], { x: 0, y: 0, w: f.w, h: f.h })
    return undefined
  }, 'paint')

  // (sdf-fill-rect sdf x0 y0 x1 y1 [color]) — same, but only sample a
  // bounding rectangle. Faster when the shape is small.
  def('sdf-fill-rect', (sdf, x0, y0, x1, y1, color) => {
    const f = fb(); if (!f || !isSdf(sdf)) return undefined
    const g = sdf.f
    const c = colorIndex(f, color)
    const xa = Math.max(0, Math.min(+x0, +x1) | 0)
    const xb = Math.min(f.w - 1, Math.max(+x0, +x1) | 0)
    const ya = Math.max(0, Math.min(+y0, +y1) | 0)
    const yb = Math.min(f.h - 1, Math.max(+y0, +y1) | 0)
    for (let y = ya; y <= yb; y++) {
      for (let x = xa; x <= xb; x++) {
        if (g(x, y) <= 0) f.plot(x, y, c)
      }
    }
    f.version++
    recordPrimitive(['sdf-fill-rect', xa, ya, xb - xa + 1, yb - ya + 1],
      { x: xa, y: ya, w: xb - xa + 1, h: yb - ya + 1 })
    return undefined
  }, 'paint')

  return env
}

export default installSdf
