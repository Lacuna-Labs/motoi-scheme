// superformula.js — Stage 3: the Gielis superformula generator.
//
// Authored 2026-07-29 (drawing-primitives build, stage 3). Made by
// Alfred Borden.
//
// One equation, six parameters, and you get circles, polygons, stars,
// flowers, leaves, gears, and a thousand organic shapes in between. This
// is how Motoi draws a shape it was never taught: name a symmetry `m`
// and three exponents, and the same formula bends a circle into the
// silhouette you want. Gielis (2003), "A generic geometric
// transformation that unifies a wide range of natural and abstract
// shapes."
//
//   r(φ) = ( |cos(mφ/4)/a|^n2 + |sin(mφ/4)/b|^n3 )^(-1/n1)
//
//   m   — rotational symmetry (petals / sides)
//   n1  — overall roundness (small → spiky, large → round)
//   n2,n3 — bulge of the two lobes
//   a,b — axis scaling (default 1)
//
// The generator returns a POINT LIST (a Scheme list of (x y) pairs) so
// it feeds straight into `poly` / `fill-poly` from shapes-raster, or
// into `superformula-image` for the composition algebra. Points are
// pixel-native and centered at (cx,cy), scaled by `radius`.

import { Sym } from '../../src/reader.js'
import { getMediaState } from '../media/media.js'
import { recordPrimitive } from './framebuffer-verbs.js'
import { NAMED_COLORS } from './framebuffer.js'

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

// Core: sample the superformula into an array of [x,y] points.
function superPoints (cx, cy, radius, m, n1, n2, n3, a, b, steps) {
  m = +m; n1 = +n1 || 1; n2 = +n2; n3 = +n3
  a = a === undefined ? 1 : (+a || 1)
  b = b === undefined ? 1 : (+b || 1)
  steps = steps ? (steps | 0) : 180
  if (steps < 3) steps = 3
  const pts = []
  for (let i = 0; i < steps; i++) {
    const phi = i * 2 * Math.PI / steps
    const t1 = Math.pow(Math.abs(Math.cos(m * phi / 4) / a), n2)
    const t2 = Math.pow(Math.abs(Math.sin(m * phi / 4) / b), n3)
    let r = Math.pow(t1 + t2, -1 / n1)
    if (!Number.isFinite(r)) r = 0
    pts.push([cx + Math.cos(phi) * r * radius, cy + Math.sin(phi) * r * radius])
  }
  return pts
}

function strokePolygon (f, points, c) {
  const n = points.length
  for (let i = 0; i < n; i++) {
    const a = points[i], b = points[(i + 1) % n]
    f.line(a[0] | 0, a[1] | 0, b[0] | 0, b[1] | 0, c)
  }
  f.version++
}

function fillPolygon (f, points, c) {
  const n = points.length
  if (n < 3) { strokePolygon(f, points, c); return }
  let minY = Infinity, maxY = -Infinity
  for (const [, y] of points) { if (y < minY) minY = y; if (y > maxY) maxY = y }
  minY = Math.max(0, Math.floor(minY)); maxY = Math.min(f.h - 1, Math.ceil(maxY))
  for (let y = minY; y <= maxY; y++) {
    const xs = []
    for (let i = 0; i < n; i++) {
      const [x1, y1] = points[i], [x2, y2] = points[(i + 1) % n]
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) xs.push(x1 + (y - y1) / (y2 - y1) * (x2 - x1))
    }
    xs.sort((u, v) => u - v)
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(0, Math.ceil(xs[k])), xb = Math.min(f.w - 1, Math.floor(xs[k + 1]))
      for (let x = xa; x <= xb; x++) f.plot(x, y, c)
    }
  }
  f.version++
}

export const VERBS = [
  'superformula', 'superformula-stroke', 'superformula-fill',
]
export const LAZY = false

export function installSuperformula (env) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  // (superformula cx cy radius m n1 n2 n3 [a] [b] [steps])
  //   → a list of (x y) points. Pure; draws nothing.
  def('superformula', (cx, cy, radius, m, n1, n2, n3, a, b, steps) =>
    superPoints(+cx, +cy, +radius, m, n1, n2, n3, a, b, steps), 'read')

  // (superformula-stroke cx cy radius m n1 n2 n3 [a] [b] [steps] [color])
  //   — draw the outline onto the live framebuffer.
  def('superformula-stroke', (cx, cy, radius, m, n1, n2, n3, a, b, steps, color) => {
    const f = fb(); if (!f) return undefined
    const pts = superPoints(+cx, +cy, +radius, m, n1, n2, n3, a, b, steps)
    const c = colorIndex(f, color)
    strokePolygon(f, pts, c)
    recordPrimitive(['superformula-stroke', +cx, +cy, +radius, +m],
      { x: +cx - +radius, y: +cy - +radius, w: 2 * +radius, h: 2 * +radius })
    return undefined
  }, 'paint')

  // (superformula-fill cx cy radius m n1 n2 n3 [a] [b] [steps] [color])
  //   — draw the filled shape onto the live framebuffer.
  def('superformula-fill', (cx, cy, radius, m, n1, n2, n3, a, b, steps, color) => {
    const f = fb(); if (!f) return undefined
    const pts = superPoints(+cx, +cy, +radius, m, n1, n2, n3, a, b, steps)
    const c = colorIndex(f, color)
    fillPolygon(f, pts, c)
    recordPrimitive(['superformula-fill', +cx, +cy, +radius, +m],
      { x: +cx - +radius, y: +cy - +radius, w: 2 * +radius, h: 2 * +radius })
    return undefined
  }, 'paint')

  return env
}

export default installSuperformula
