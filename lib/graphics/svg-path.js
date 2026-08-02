// svg-path.js — Stage 5: the SVG-path importer.
//
// Authored 2026-07-29 (drawing-primitives build, stage 5). Made by
// Alfred Borden.
//
// The whole open-icon world speaks one dialect: the SVG path string.
// `M12 2 L2 22 L22 22 Z` is a triangle; every Feather, Lucide, Bootstrap
// and Material glyph is a handful of these. This module reads that `d`
// string — the subset that matters (M/L/H/V/C/Q/Z, absolute and
// relative) — flattens the Béziers into line segments, and hands back a
// pixel-native POINT LIST. That list feeds `poly` / `fill-poly` from
// shapes-raster, so importing an icon is just "parse, then draw the
// points." It is how Motoi reaches a real vocabulary of named things
// (a heart, a star, an arrow) without inventing each one by hand.
//
// Scaling: points come out in the path's own coordinate space; pass
// `scale`, `ox`, `oy` to place and size the result on the canvas.

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

// Tokenize a path `d` string into [command-letter | number] tokens.
function tokenize (d) {
  const toks = []
  const re = /([MmLlHhVvCcSsQqTtAaZz])|(-?\d*\.?\d+(?:[eE][-+]?\d+)?)/g
  let m
  while ((m = re.exec(d)) !== null) {
    if (m[1]) toks.push(m[1])
    else toks.push(parseFloat(m[2]))
  }
  return toks
}

function cubic (p0, p1, p2, p3, steps, out) {
  for (let i = 1; i <= steps; i++) {
    const t = i / steps, u = 1 - t
    const x = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0]
    const y = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]
    out.push([x, y])
  }
}

function quad (p0, p1, p2, steps, out) {
  for (let i = 1; i <= steps; i++) {
    const t = i / steps, u = 1 - t
    const x = u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0]
    const y = u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]
    out.push([x, y])
  }
}

// Parse a path into an array of points (a single flattened polyline).
// Subpaths (multiple M) are concatenated; Z closes back to the subpath
// start. steps = flattening resolution for curves.
function pathToPoints (d, scale, ox, oy, steps) {
  scale = scale === undefined ? 1 : +scale
  ox = ox === undefined ? 0 : +ox
  oy = oy === undefined ? 0 : +oy
  steps = steps ? (steps | 0) : 8
  const toks = tokenize(String(d))
  const raw = []
  let i = 0
  let cx = 0, cy = 0        // current point
  let sx = 0, sy = 0        // subpath start
  let cmd = null
  const num = () => toks[i++]
  const isCmd = (t) => typeof t === 'string'

  while (i < toks.length) {
    if (isCmd(toks[i])) { cmd = toks[i++] }
    const rel = cmd === cmd.toLowerCase()
    const C = cmd.toUpperCase()
    switch (C) {
      case 'M': {
        let x = num(), y = num()
        if (rel) { x += cx; y += cy }
        cx = x; cy = y; sx = x; sy = y
        raw.push([cx, cy])
        cmd = rel ? 'l' : 'L'   // subsequent pairs are implicit lineto
        break
      }
      case 'L': {
        let x = num(), y = num()
        if (rel) { x += cx; y += cy }
        cx = x; cy = y; raw.push([cx, cy])
        break
      }
      case 'H': {
        let x = num(); if (rel) x += cx
        cx = x; raw.push([cx, cy])
        break
      }
      case 'V': {
        let y = num(); if (rel) y += cy
        cy = y; raw.push([cx, cy])
        break
      }
      case 'C': {
        let x1 = num(), y1 = num(), x2 = num(), y2 = num(), x = num(), y = num()
        if (rel) { x1 += cx; y1 += cy; x2 += cx; y2 += cy; x += cx; y += cy }
        cubic([cx, cy], [x1, y1], [x2, y2], [x, y], steps, raw)
        cx = x; cy = y
        break
      }
      case 'Q': {
        let x1 = num(), y1 = num(), x = num(), y = num()
        if (rel) { x1 += cx; y1 += cy; x += cx; y += cy }
        quad([cx, cy], [x1, y1], [x, y], steps, raw)
        cx = x; cy = y
        break
      }
      case 'Z': {
        raw.push([sx, sy]); cx = sx; cy = sy
        break
      }
      default: {
        // Unsupported command (S/T/A) — skip a conservative pair to
        // avoid infinite loops; better a rough shape than a hang.
        num()
        break
      }
    }
  }
  return raw.map(([x, y]) => [ox + x * scale, oy + y * scale])
}

function strokePolyline (f, pts, c, close) {
  const n = pts.length
  if (n < 2) return
  for (let k = 0; k + 1 < n; k++) {
    f.line(pts[k][0] | 0, pts[k][1] | 0, pts[k + 1][0] | 0, pts[k + 1][1] | 0, c)
  }
  if (close) f.line(pts[n - 1][0] | 0, pts[n - 1][1] | 0, pts[0][0] | 0, pts[0][1] | 0, c)
  f.version++
}

function fillPolygon (f, points, c) {
  const n = points.length
  if (n < 3) return
  let minY = Infinity, maxY = -Infinity
  for (const [, y] of points) { if (y < minY) minY = y; if (y > maxY) maxY = y }
  minY = Math.max(0, Math.floor(minY)); maxY = Math.min(f.h - 1, Math.ceil(maxY))
  for (let y = minY; y <= maxY; y++) {
    const xs = []
    for (let k = 0; k < n; k++) {
      const [x1, y1] = points[k], [x2, y2] = points[(k + 1) % n]
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

function bboxOf (pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const [x, y] of pts) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y }
  if (!Number.isFinite(x0)) return { x: 0, y: 0, w: 0, h: 0 }
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}

export const VERBS = [
  'svg-path->points', 'draw-svg-path', 'fill-svg-path',
]
export const LAZY = false

export function installSvgPath (env) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  // (svg-path->points d [scale] [ox] [oy] [steps]) → list of (x y) points.
  def('svg-path->points', (d, scale, ox, oy, steps) =>
    pathToPoints(d, scale, ox, oy, steps), 'read')

  // (draw-svg-path d ox oy scale [color]) — stroke the path.
  def('draw-svg-path', (d, ox, oy, scale, color) => {
    const f = fb(); if (!f) return undefined
    const pts = pathToPoints(d, scale, ox, oy)
    strokePolyline(f, pts, colorIndex(f, color), false)
    recordPrimitive(['draw-svg-path'], bboxOf(pts))
    return undefined
  }, 'paint')

  // (fill-svg-path d ox oy scale [color]) — even-odd fill the path.
  def('fill-svg-path', (d, ox, oy, scale, color) => {
    const f = fb(); if (!f) return undefined
    const pts = pathToPoints(d, scale, ox, oy)
    fillPolygon(f, pts, colorIndex(f, color))
    recordPrimitive(['fill-svg-path'], bboxOf(pts))
    return undefined
  }, 'paint')

  return env
}

export default installSvgPath
