// image-algebra.js — Stage 2c: the compositional image algebra.
//
// Authored 2026-07-29 (drawing-primitives build, stage 2c). Made by
// Alfred Borden.
//
// This is the keystone of the drawing stack: the layer that lets Motoi
// build a shape it has never seen by DECOMPOSING it into primitives and
// COMBINING them. A building is a series of rectangles stacked and
// nested; a tree is a triangle above a rectangle; a face is circles
// overlaid on a circle. The vocabulary here is deliberately the same as
// Racket's `2htdp/image` teaching library (MIT-licensed names): an image
// is a *value*, and combinators (`overlay`, `beside`, `above`,
// `place-image`, `rotate`, `scale`) take images and return images. Only
// at the very end does `draw-image` blit onto the live framebuffer.
//
// The model (Henderson "a picture is a value"): every image carries a
// width, a height, and a `raster()` that yields a w×h grid of palette
// indices with -1 meaning transparent. Composition is pure array
// blitting with transparency; nothing touches the framebuffer until the
// sink verb runs. That makes the whole algebra deterministic and
// gradeable by the interpreter, exactly like the rest of the stack.
//
// mode argument: 'solid' | 'fill'  → filled;  'outline' | 'stroke' →
// outline. color: palette index 0..15 or a color-name symbol ('red).

import { Sym } from '../../src/reader.js'
import { getMediaState } from '../media/media.js'
import { recordPrimitive } from './framebuffer-verbs.js'
import { NAMED_COLORS } from './framebuffer.js'

const TRANSPARENT = -1

// ── color / mode resolution ──────────────────────────────────────────

function resolveColor (color, fallback = 14) {
  if (color === undefined || color === null) return fallback
  if (color instanceof Sym) color = color.name
  if (typeof color === 'string') {
    const n = NAMED_COLORS[color.toLowerCase()]
    return n === undefined ? fallback : n
  }
  return ((color | 0) % 16 + 16) % 16
}

function isSolid (mode) {
  if (mode === undefined || mode === null) return true
  if (mode instanceof Sym) mode = mode.name
  mode = String(mode).toLowerCase()
  return mode === 'solid' || mode === 'fill' || mode === 'filled'
}

// ── MiniCanvas — a tiny transparent raster target ────────────────────
//
// A self-contained w×h grid of palette indices (Int16Array, init -1).
// Carries just the rasterizers the shape constructors need. Deliberately
// NOT the Framebuffer class — that one is opaque black (index 0) with no
// transparency, which would turn every composited image into a black box.

class MiniCanvas {
  constructor (w, h) {
    this.w = Math.max(1, w | 0)
    this.h = Math.max(1, h | 0)
    this.px = new Int16Array(this.w * this.h).fill(TRANSPARENT)
  }
  plot (x, y, c) {
    x = x | 0; y = y | 0
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return
    this.px[y * this.w + x] = c & 0xff
  }
  line (x0, y0, x1, y1, c) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0)
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1
    let err = dx + dy
    for (;;) {
      this.plot(x0, y0, c)
      if (x0 === x1 && y0 === y1) break
      const e2 = 2 * err
      if (e2 >= dy) { err += dy; x0 += sx }
      if (e2 <= dx) { err += dx; y0 += sy }
    }
  }
  disc (cx, cy, r, c) {
    cx |= 0; cy |= 0; r = Math.abs(r | 0)
    const r2 = r * r
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r2) this.plot(cx + dx, cy + dy, c)
      }
    }
  }
  circle (cx, cy, r, c) {
    cx |= 0; cy |= 0; r = Math.abs(r | 0)
    let x = r, y = 0, err = 1 - r
    while (x >= y) {
      this.plot(cx + x, cy + y, c); this.plot(cx + y, cy + x, c)
      this.plot(cx - y, cy + x, c); this.plot(cx - x, cy + y, c)
      this.plot(cx - x, cy - y, c); this.plot(cx - y, cy - x, c)
      this.plot(cx + y, cy - x, c); this.plot(cx + x, cy - y, c)
      y++
      if (err < 0) err += 2 * y + 1
      else { x--; err += 2 * (y - x) + 1 }
    }
  }
  rectFill (x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.plot(x + i, y + j, c)
  }
  rect (x, y, w, h, c) {
    this.line(x, y, x + w - 1, y, c)
    this.line(x, y + h - 1, x + w - 1, y + h - 1, c)
    this.line(x, y, x, y + h - 1, c)
    this.line(x + w - 1, y, x + w - 1, y + h - 1, c)
  }
  strokePoly (pts, c) {
    const n = pts.length
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n]
      this.line(a[0], a[1], b[0], b[1], c)
    }
  }
  fillPoly (pts, c) {
    const n = pts.length
    if (n < 3) { this.strokePoly(pts, c); return }
    let minY = Infinity, maxY = -Infinity
    for (const [, y] of pts) { if (y < minY) minY = y; if (y > maxY) maxY = y }
    minY = Math.max(0, Math.floor(minY)); maxY = Math.min(this.h - 1, Math.ceil(maxY))
    for (let y = minY; y <= maxY; y++) {
      const xs = []
      for (let i = 0; i < n; i++) {
        const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % n]
        if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
          xs.push(x1 + (y - y1) / (y2 - y1) * (x2 - x1))
        }
      }
      xs.sort((a, b) => a - b)
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.max(0, Math.ceil(xs[k])), xb = Math.min(this.w - 1, Math.floor(xs[k + 1]))
        for (let x = xa; x <= xb; x++) this.plot(x, y, c)
      }
    }
  }
}

// ── image value ──────────────────────────────────────────────────────

function makeImage (w, h, drawFn) {
  let cache = null
  return {
    __image: true,
    w: Math.max(1, w | 0),
    h: Math.max(1, h | 0),
    raster () {
      if (cache) return cache
      const mc = new MiniCanvas(this.w, this.h)
      drawFn(mc)
      cache = { w: mc.w, h: mc.h, px: mc.px }
      return cache
    }
  }
}

function isImage (v) { return v && typeof v === 'object' && v.__image === true }

// Blit src raster onto dst MiniCanvas/Framebuffer at top-left (ox,oy),
// honoring transparency. dst must expose plot(x,y,c).
function blit (dst, src, ox, oy) {
  const { w, h, px } = src
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = px[y * w + x]
      if (c !== TRANSPARENT) dst.plot(ox + x, oy + y, c)
    }
  }
}

// ── shape constructors (image-returning) ─────────────────────────────

function circleImg (r, mode, color) {
  r = Math.max(0, Math.abs(r | 0))
  const c = resolveColor(color)
  const size = 2 * r + 1
  return makeImage(size, size, (mc) => {
    if (isSolid(mode)) mc.disc(r, r, r, c); else mc.circle(r, r, r, c)
  })
}

function rectImg (w, h, mode, color) {
  w = Math.max(1, w | 0); h = Math.max(1, h | 0)
  const c = resolveColor(color)
  return makeImage(w, h, (mc) => {
    if (isSolid(mode)) mc.rectFill(0, 0, w, h, c); else mc.rect(0, 0, w, h, c)
  })
}

// Regular n-gon inscribed in a circle of radius r, point up.
function ngonImg (r, n, mode, color) {
  r = Math.max(1, Math.abs(r | 0)); n = Math.max(3, n | 0)
  const c = resolveColor(color)
  const size = 2 * r + 1
  const pts = []
  const base = -Math.PI / 2
  for (let i = 0; i < n; i++) {
    const a = base + i * 2 * Math.PI / n
    pts.push([r + Math.cos(a) * r, r + Math.sin(a) * r])
  }
  return makeImage(size, size, (mc) => {
    if (isSolid(mode)) mc.fillPoly(pts, c); else mc.strokePoly(pts, c)
  })
}

// Equilateral triangle by side length, point up.
function triangleImg (side, mode, color) {
  side = Math.max(1, Math.abs(side | 0))
  const c = resolveColor(color)
  const h = Math.round(side * Math.sqrt(3) / 2)
  const pts = [[side / 2, 0], [side, h], [0, h]]
  return makeImage(side + 1, h + 1, (mc) => {
    if (isSolid(mode)) mc.fillPoly(pts, c); else mc.strokePoly(pts, c)
  })
}

// 5-point (or n-point) star inscribed in radius r.
function starImg (r, points, mode, color) {
  r = Math.max(2, Math.abs(r | 0))
  points = Math.max(2, points | 0)
  const c = resolveColor(color)
  const rInner = r * 0.4
  const size = 2 * r + 1
  const pts = []
  const base = -Math.PI / 2
  for (let i = 0; i < points * 2; i++) {
    const a = base + i * Math.PI / points
    const rr = (i % 2 === 0) ? r : rInner
    pts.push([r + Math.cos(a) * rr, r + Math.sin(a) * rr])
  }
  return makeImage(size, size, (mc) => {
    if (isSolid(mode)) mc.fillPoly(pts, c); else mc.strokePoly(pts, c)
  })
}

function ellipseImg (w, h, mode, color) {
  w = Math.max(1, w | 0); h = Math.max(1, h | 0)
  const c = resolveColor(color)
  const rx = (w - 1) / 2, ry = (h - 1) / 2
  const n = Math.max(12, Math.round((rx + ry) * 1.5))
  const pts = []
  for (let i = 0; i < n; i++) {
    const a = i * 2 * Math.PI / n
    pts.push([rx + Math.cos(a) * rx, ry + Math.sin(a) * ry])
  }
  return makeImage(w, h, (mc) => {
    if (isSolid(mode)) mc.fillPoly(pts, c); else mc.strokePoly(pts, c)
  })
}

// A horizontal line image of given length.
function lineImg (len, color) {
  len = Math.max(1, Math.abs(len | 0))
  const c = resolveColor(color)
  return makeImage(len, 1, (mc) => mc.line(0, 0, len - 1, 0, c))
}

// ── combinators ──────────────────────────────────────────────────────

function overlay (imgs) {
  imgs = imgs.filter(isImage)
  if (imgs.length === 0) return makeImage(1, 1, () => {})
  const W = Math.max(...imgs.map((i) => i.w))
  const H = Math.max(...imgs.map((i) => i.h))
  return makeImage(W, H, (mc) => {
    // first image should end up on top → draw back-to-front (reversed).
    for (let k = imgs.length - 1; k >= 0; k--) {
      const im = imgs[k]
      blit(mc, im.raster(), Math.floor((W - im.w) / 2), Math.floor((H - im.h) / 2))
    }
  })
}

function beside (imgs) {
  imgs = imgs.filter(isImage)
  if (imgs.length === 0) return makeImage(1, 1, () => {})
  const W = imgs.reduce((s, i) => s + i.w, 0)
  const H = Math.max(...imgs.map((i) => i.h))
  return makeImage(W, H, (mc) => {
    let x = 0
    for (const im of imgs) {
      blit(mc, im.raster(), x, Math.floor((H - im.h) / 2))
      x += im.w
    }
  })
}

function above (imgs) {
  imgs = imgs.filter(isImage)
  if (imgs.length === 0) return makeImage(1, 1, () => {})
  const H = imgs.reduce((s, i) => s + i.h, 0)
  const W = Math.max(...imgs.map((i) => i.w))
  return makeImage(W, H, (mc) => {
    let y = 0
    for (const im of imgs) {
      blit(mc, im.raster(), Math.floor((W - im.w) / 2), y)
      y += im.h
    }
  })
}

// place-image: put `img` centered at (x,y) on `scene`, keep scene size.
function placeImage (img, x, y, scene) {
  if (!isImage(img) || !isImage(scene)) return scene
  x = x | 0; y = y | 0
  return makeImage(scene.w, scene.h, (mc) => {
    blit(mc, scene.raster(), 0, 0)
    blit(mc, img.raster(), x - Math.floor(img.w / 2), y - Math.floor(img.h / 2))
  })
}

function emptyScene (w, h, color) {
  w = Math.max(1, w | 0); h = Math.max(1, h | 0)
  if (color === undefined || color === null) {
    return makeImage(w, h, () => {}) // fully transparent
  }
  const c = resolveColor(color)
  return makeImage(w, h, (mc) => mc.rectFill(0, 0, w, h, c))
}

// Rotate CCW by `deg` degrees, nearest-neighbor into the new bbox.
function rotateImg (deg, img) {
  if (!isImage(img)) return img
  const rad = (+deg) * Math.PI / 180
  const cos = Math.cos(rad), sin = Math.sin(rad)
  const { w, h, px } = img.raster()
  const cx = (w - 1) / 2, cy = (h - 1) / 2
  const corners = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]]
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [px0, py0] of corners) {
    const rx = (px0 - cx) * cos - (py0 - cy) * sin
    const ry = (px0 - cx) * sin + (py0 - cy) * cos
    if (rx < minX) minX = rx; if (rx > maxX) maxX = rx
    if (ry < minY) minY = ry; if (ry > maxY) maxY = ry
  }
  const nw = Math.max(1, Math.round(maxX - minX) + 1)
  const nh = Math.max(1, Math.round(maxY - minY) + 1)
  const ncx = (nw - 1) / 2, ncy = (nh - 1) / 2
  return makeImage(nw, nh, (mc) => {
    for (let y = 0; y < nh; y++) {
      for (let x = 0; x < nw; x++) {
        // inverse rotate (clockwise) to sample the source.
        const dx = x - ncx, dy = y - ncy
        const sx = Math.round(dx * cos + dy * sin + cx)
        const sy = Math.round(-dx * sin + dy * cos + cy)
        if (sx >= 0 && sy >= 0 && sx < w && sy < h) {
          const c = px[sy * w + sx]
          if (c !== TRANSPARENT) mc.plot(x, y, c)
        }
      }
    }
  })
}

// Scale by (sx,sy) nearest-neighbor.
function scaleImg (sx, sy, img) {
  if (!isImage(img)) return img
  sx = Math.abs(+sx) || 1; sy = Math.abs(+sy) || 1
  const { w, h, px } = img.raster()
  const nw = Math.max(1, Math.round(w * sx)), nh = Math.max(1, Math.round(h * sy))
  return makeImage(nw, nh, (mc) => {
    for (let y = 0; y < nh; y++) {
      for (let x = 0; x < nw; x++) {
        const c = px[Math.min(h - 1, Math.floor(y / sy)) * w + Math.min(w - 1, Math.floor(x / sx))]
        if (c !== TRANSPARENT) mc.plot(x, y, c)
      }
    }
  })
}

function flipH (img) {
  if (!isImage(img)) return img
  const { w, h, px } = img.raster()
  return makeImage(w, h, (mc) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = px[y * w + x]; if (c !== TRANSPARENT) mc.plot(w - 1 - x, y, c)
    }
  })
}

function flipV (img) {
  if (!isImage(img)) return img
  const { w, h, px } = img.raster()
  return makeImage(w, h, (mc) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = px[y * w + x]; if (c !== TRANSPARENT) mc.plot(x, h - 1 - y, c)
    }
  })
}

// ── the sink: blit an image onto the LIVE framebuffer ────────────────

function liveFb () {
  const st = getMediaState()
  return st && st.fb ? st.fb : null
}

// ── install ──────────────────────────────────────────────────────────

export const VERBS = [
  'img/circle', 'img/square', 'img/rectangle', 'img/triangle',
  'img/star', 'img/star-poly', 'img/ellipse', 'img/regular-polygon', 'img/line',
  'overlay', 'beside', 'above', 'place-image', 'empty-scene',
  'rotate', 'scale', 'scale/xy', 'flip-horizontal', 'flip-vertical',
  'image-width', 'image-height', 'image?',
  'draw-image', 'draw-image/center',
]
export const LAZY = false

export function installImageAlgebra (env) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  // constructors
  def('img/circle',         (r, mode, color) => circleImg(r, mode, color))
  def('img/square',         (s, mode, color) => rectImg(s, s, mode, color))
  def('img/rectangle',      (w, h, mode, color) => rectImg(w, h, mode, color))
  def('img/triangle',       (s, mode, color) => triangleImg(s, mode, color))
  def('img/star',           (r, mode, color) => starImg(r, 5, mode, color))
  def('img/star-poly',      (r, points, mode, color) => starImg(r, points, mode, color))
  def('img/ellipse',        (w, h, mode, color) => ellipseImg(w, h, mode, color))
  def('img/regular-polygon', (r, n, mode, color) => ngonImg(r, n, mode, color))
  def('img/line',           (len, color) => lineImg(len, color))

  // combinators
  def('overlay',            (...imgs) => overlay(imgs))
  def('beside',             (...imgs) => beside(imgs))
  def('above',              (...imgs) => above(imgs))
  def('place-image',        (img, x, y, scene) => placeImage(img, x, y, scene))
  def('empty-scene',        (w, h, color) => emptyScene(w, h, color))
  def('rotate',             (deg, img) => rotateImg(deg, img))
  def('scale',              (factor, img) => scaleImg(factor, factor, img))
  def('scale/xy',           (sx, sy, img) => scaleImg(sx, sy, img))
  def('flip-horizontal',    (img) => flipH(img))
  def('flip-vertical',      (img) => flipV(img))

  // accessors
  def('image-width',        (img) => (isImage(img) ? img.w : 0))
  def('image-height',       (img) => (isImage(img) ? img.h : 0))
  def('image?',             (img) => isImage(img))

  // sink — top-left placement
  def('draw-image', (img, x, y) => {
    const f = liveFb(); if (!f || !isImage(img)) return undefined
    const r = img.raster()
    blit(f, r, +x | 0, +y | 0)
    f.version++
    recordPrimitive(['draw-image', +x | 0, +y | 0, img.w, img.h],
      { x: +x | 0, y: +y | 0, w: img.w, h: img.h })
    return undefined
  }, 'paint')

  // sink — centered placement
  def('draw-image/center', (img, x, y) => {
    const f = liveFb(); if (!f || !isImage(img)) return undefined
    const r = img.raster()
    const ox = (+x | 0) - Math.floor(img.w / 2)
    const oy = (+y | 0) - Math.floor(img.h / 2)
    blit(f, r, ox, oy)
    f.version++
    recordPrimitive(['draw-image/center', +x | 0, +y | 0, img.w, img.h],
      { x: ox, y: oy, w: img.w, h: img.h })
    return undefined
  }, 'paint')

  return env
}

export default installImageAlgebra
