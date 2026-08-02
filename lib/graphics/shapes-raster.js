// shapes-raster.js — Stage 1 + Stage 2 direct-draw shape primitives.
//
// Authored 2026-07-29 (drawing-primitives build, stages 1–2). Made by
// Alfred Borden.
//
// Doctrine: the framebuffer (lib/graphics/framebuffer.js) is pure and
// already carries line / circle / disc / rect / rectFill. media.js
// exposes those as the verbs `line`, `circle`, `disc`, `rect`,
// `rect-fill`, `pset`. This module ADDS the missing outline+fill shape
// vocabulary the probe found unbound — triangle, polygon, star, ellipse,
// ngon (regular polygon), ring (annulus), arc — plus the two point-list
// workhorses `poly` (stroke a path) and `fill-poly` (scanline-fill a
// path). Every generator that returns points elsewhere in the stack
// (superformula, sdf, svg) rasterizes through `poly` / `fill-poly`, so
// this is the render floor the whole shape stack stands on.
//
// These are side-effect verbs: they mutate the shared framebuffer and
// return unspecified (undefined), exactly like `circle` / `line`. They
// also call recordPrimitive so (on-canvas-trace) sees them. An optional
// trailing color argument (palette index 0..15 or a color name symbol
// like 'red) is honored and restored so a fill never leaks draw state.
//
// Coordinates are pixel-native integers (NOT normalized). Guaranteed at
// the SD 320×240 canvas; other modes keep the raw verbs but lose the
// object-primitive guarantee (drawing-primitives resolution contract,
// Alfred 2026-07-28).

import { Sym } from '../../src/reader.js'
import { getMediaState } from '../media/media.js'
import { recordPrimitive } from './framebuffer-verbs.js'
import { NAMED_COLORS } from './framebuffer.js'

// ── helpers ──────────────────────────────────────────────────────────

function fb () {
  const st = getMediaState()
  return st && st.fb ? st.fb : null
}

// Resolve a color argument to a palette index. Accepts a number, a Sym
// ('red), or a bare string. undefined → keep current color.
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

// Run fn with the draw color pinned to `color` (if given), then restore.
function withColor (f, color, fn) {
  const prev = f.color
  f.color = colorIndex(f, color)
  try { fn(f.color) } finally { f.color = prev }
}

// A Scheme point is a 2-element list → JS array [x, y]. Coerce a list of
// points into an array of [x|0, y|0]. Tolerates nested arrays.
function toPoints (pts) {
  if (!Array.isArray(pts)) return []
  const out = []
  for (const p of pts) {
    if (Array.isArray(p) && p.length >= 2) out.push([+p[0], +p[1]])
  }
  return out
}

function bboxOf (points) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const [x, y] of points) {
    if (x < x0) x0 = x; if (y < y0) y0 = y
    if (x > x1) x1 = x; if (y > y1) y1 = y
  }
  if (!Number.isFinite(x0)) return { x: 0, y: 0, w: 0, h: 0 }
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}

// Stroke a closed polygon (connect consecutive points, close the loop).
function strokePolygon (f, points, c) {
  const n = points.length
  if (n === 0) return
  if (n === 1) { f.plot(points[0][0] | 0, points[0][1] | 0, c); f.version++; return }
  for (let i = 0; i < n; i++) {
    const [x0, y0] = points[i]
    const [x1, y1] = points[(i + 1) % n]
    f.line(x0 | 0, y0 | 0, x1 | 0, y1 | 0, c)
  }
  f.version++
}

// Even-odd scanline polygon fill.
function fillPolygon (f, points, c) {
  const n = points.length
  if (n < 3) { strokePolygon(f, points, c); return }
  let minY = Infinity, maxY = -Infinity
  for (const [, y] of points) { if (y < minY) minY = y; if (y > maxY) maxY = y }
  minY = Math.max(0, Math.floor(minY))
  maxY = Math.min(f.h - 1, Math.ceil(maxY))
  for (let y = minY; y <= maxY; y++) {
    const xs = []
    for (let i = 0; i < n; i++) {
      const [x1, y1] = points[i]
      const [x2, y2] = points[(i + 1) % n]
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
        const t = (y - y1) / (y2 - y1)
        xs.push(x1 + t * (x2 - x1))
      }
    }
    xs.sort((a, b) => a - b)
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(0, Math.ceil(xs[k]))
      const xb = Math.min(f.w - 1, Math.floor(xs[k + 1]))
      for (let x = xa; x <= xb; x++) f.plot(x, y, c)
    }
  }
  f.version++
}

// Regular n-gon vertices centered at (cx,cy), circumradius r, rotated by
// `rot` radians. Point 0 sits at angle -90° (top) + rot by default.
function ngonPoints (cx, cy, r, n, rot = 0) {
  n = Math.max(3, n | 0)
  const pts = []
  const base = -Math.PI / 2 + rot
  for (let i = 0; i < n; i++) {
    const a = base + (i * 2 * Math.PI / n)
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r])
  }
  return pts
}

// Star vertices: 2*points alternating outer/inner radius.
function starPoints (cx, cy, rOuter, rInner, points, rot = 0) {
  points = Math.max(2, points | 0)
  const pts = []
  const base = -Math.PI / 2 + rot
  for (let i = 0; i < points * 2; i++) {
    const a = base + (i * Math.PI / points)
    const r = (i % 2 === 0) ? rOuter : rInner
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r])
  }
  return pts
}

// Ellipse outline via parametric sampling (adaptive step by circumference).
function ellipsePoints (cx, cy, rx, ry, steps) {
  rx = Math.abs(rx); ry = Math.abs(ry)
  const n = steps || Math.max(12, Math.round((rx + ry) * 1.5))
  const pts = []
  for (let i = 0; i < n; i++) {
    const a = i * 2 * Math.PI / n
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry])
  }
  return pts
}

// ── verb list ────────────────────────────────────────────────────────

export const VERBS = [
  'triangle', 'triangle-fill',
  'polygon', 'polygon-fill', 'poly', 'fill-poly',
  'star', 'star-fill',
  'ellipse', 'ellipse-fill',
  'ngon', 'ngon-fill',
  'ring', 'arc',
]
export const LAZY = false

export function installShapesRaster (env) {
  const def = (n, f, perm = 'paint') => env.define(n, f, { perm })

  // (triangle x1 y1 x2 y2 x3 y3 [color]) — outline.
  def('triangle', (x1, y1, x2, y2, x3, y3, color) => {
    const f = fb(); if (!f) return undefined
    const pts = [[+x1, +y1], [+x2, +y2], [+x3, +y3]]
    withColor(f, color, (c) => strokePolygon(f, pts, c))
    recordPrimitive(['triangle', +x1, +y1, +x2, +y2, +x3, +y3], bboxOf(pts))
    return undefined
  })

  // (triangle-fill x1 y1 x2 y2 x3 y3 [color]) — filled.
  def('triangle-fill', (x1, y1, x2, y2, x3, y3, color) => {
    const f = fb(); if (!f) return undefined
    const pts = [[+x1, +y1], [+x2, +y2], [+x3, +y3]]
    withColor(f, color, (c) => fillPolygon(f, pts, c))
    recordPrimitive(['triangle-fill', +x1, +y1, +x2, +y2, +x3, +y3], bboxOf(pts))
    return undefined
  })

  // (polygon points [color]) / (poly points [color]) — stroke a closed
  // path. points is a list of (x y) pairs.
  const doPolygon = (pts, color, fill) => {
    const f = fb(); if (!f) return undefined
    const P = toPoints(pts)
    withColor(f, color, (c) => (fill ? fillPolygon : strokePolygon)(f, P, c))
    recordPrimitive([fill ? 'polygon-fill' : 'polygon', P.length], bboxOf(P))
    return undefined
  }
  def('polygon',      (pts, color) => doPolygon(pts, color, false))
  def('poly',         (pts, color) => doPolygon(pts, color, false))
  def('polygon-fill', (pts, color) => doPolygon(pts, color, true))
  def('fill-poly',    (pts, color) => doPolygon(pts, color, true))

  // (star cx cy outerR innerR points [rot] [color]) — outline.
  def('star', (cx, cy, rOuter, rInner, points, rot, color) => {
    const f = fb(); if (!f) return undefined
    const pts = starPoints(+cx, +cy, +rOuter, +rInner, +points, rot === undefined ? 0 : +rot)
    withColor(f, color, (c) => strokePolygon(f, pts, c))
    recordPrimitive(['star', +cx, +cy, +rOuter, +rInner, +points], bboxOf(pts))
    return undefined
  })

  // (star-fill cx cy outerR innerR points [rot] [color]) — filled.
  def('star-fill', (cx, cy, rOuter, rInner, points, rot, color) => {
    const f = fb(); if (!f) return undefined
    const pts = starPoints(+cx, +cy, +rOuter, +rInner, +points, rot === undefined ? 0 : +rot)
    withColor(f, color, (c) => fillPolygon(f, pts, c))
    recordPrimitive(['star-fill', +cx, +cy, +rOuter, +rInner, +points], bboxOf(pts))
    return undefined
  })

  // (ellipse cx cy rx ry [color]) — outline.
  def('ellipse', (cx, cy, rx, ry, color) => {
    const f = fb(); if (!f) return undefined
    const pts = ellipsePoints(+cx, +cy, +rx, +ry)
    withColor(f, color, (c) => strokePolygon(f, pts, c))
    recordPrimitive(['ellipse', +cx, +cy, +rx, +ry], { x: +cx - +rx, y: +cy - +ry, w: 2 * +rx, h: 2 * +ry })
    return undefined
  })

  // (ellipse-fill cx cy rx ry [color]) — filled.
  def('ellipse-fill', (cx, cy, rx, ry, color) => {
    const f = fb(); if (!f) return undefined
    const pts = ellipsePoints(+cx, +cy, +rx, +ry)
    withColor(f, color, (c) => fillPolygon(f, pts, c))
    recordPrimitive(['ellipse-fill', +cx, +cy, +rx, +ry], { x: +cx - +rx, y: +cy - +ry, w: 2 * +rx, h: 2 * +ry })
    return undefined
  })

  // (ngon cx cy r n [rot] [color]) — regular n-gon outline.
  def('ngon', (cx, cy, r, n, rot, color) => {
    const f = fb(); if (!f) return undefined
    const pts = ngonPoints(+cx, +cy, +r, +n, rot === undefined ? 0 : +rot)
    withColor(f, color, (c) => strokePolygon(f, pts, c))
    recordPrimitive(['ngon', +cx, +cy, +r, +n], { x: +cx - +r, y: +cy - +r, w: 2 * +r, h: 2 * +r })
    return undefined
  })

  // (ngon-fill cx cy r n [rot] [color]) — regular n-gon filled.
  def('ngon-fill', (cx, cy, r, n, rot, color) => {
    const f = fb(); if (!f) return undefined
    const pts = ngonPoints(+cx, +cy, +r, +n, rot === undefined ? 0 : +rot)
    withColor(f, color, (c) => fillPolygon(f, pts, c))
    recordPrimitive(['ngon-fill', +cx, +cy, +r, +n], { x: +cx - +r, y: +cy - +r, w: 2 * +r, h: 2 * +r })
    return undefined
  })

  // (ring cx cy rOuter rInner [color]) — filled annulus (donut).
  def('ring', (cx, cy, rOuter, rInner, color) => {
    const f = fb(); if (!f) return undefined
    const CX = +cx | 0, CY = +cy | 0
    const rO = Math.abs(+rOuter), rI = Math.abs(+rInner)
    const rO2 = rO * rO, rI2 = rI * rI
    withColor(f, color, (c) => {
      for (let dy = -rO; dy <= rO; dy++) {
        for (let dx = -rO; dx <= rO; dx++) {
          const d2 = dx * dx + dy * dy
          if (d2 <= rO2 && d2 >= rI2) f.plot(CX + dx, CY + dy, c)
        }
      }
      f.version++
    })
    recordPrimitive(['ring', CX, CY, rO, rI], { x: CX - rO, y: CY - rO, w: 2 * rO, h: 2 * rO })
    return undefined
  })

  // (arc cx cy r a0 a1 [color]) — stroke a circular arc from angle a0 to
  // a1 (radians). Sampled and connected with line segments.
  def('arc', (cx, cy, r, a0, a1, color) => {
    const f = fb(); if (!f) return undefined
    const CX = +cx, CY = +cy, R = Math.abs(+r)
    const A0 = +a0, A1 = +a1
    const steps = Math.max(4, Math.round(R * Math.abs(A1 - A0)))
    const pts = []
    for (let i = 0; i <= steps; i++) {
      const a = A0 + (A1 - A0) * (i / steps)
      pts.push([CX + Math.cos(a) * R, CY + Math.sin(a) * R])
    }
    withColor(f, color, (c) => {
      for (let i = 0; i + 1 < pts.length; i++) {
        f.line(pts[i][0] | 0, pts[i][1] | 0, pts[i + 1][0] | 0, pts[i + 1][1] | 0, c)
      }
      f.version++
    })
    recordPrimitive(['arc', CX, CY, R, A0, A1], { x: CX - R, y: CY - R, w: 2 * R, h: 2 * R })
    return undefined
  })

  return env
}

export default installShapesRaster
