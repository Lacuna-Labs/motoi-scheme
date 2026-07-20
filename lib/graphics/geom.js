// geom.js — 2D geometry primitives.
//
// Doctrine (Alfred, 2026-07-16): every `geom/*` verb is a pure function
// on numeric points and lists of numbers. Points are 2-element lists
// (x y). Segments are 2-element lists of points. No framebuffer touch —
// that's a separate `draw` pass.

import { Sym } from '../../src/reader.js'

function tag(name, ...rest) { return [new Sym(name), ...rest] }

// Coerce a point argument to [x, y]. Accepts (x y) list or (:x N :y N) alist.
function pt(p) {
  if (Array.isArray(p)) {
    if (p.length === 2 && typeof p[0] === 'number') return [p[0], p[1]]
    // could be alist ((x N)(y N))
    let x = 0, y = 0
    for (const entry of p) {
      if (!Array.isArray(entry) || entry.length < 2) continue
      const k = entry[0] instanceof Sym ? entry[0].name : entry[0]
      if (k === 'x' || k === ':x') x = entry[1]
      else if (k === 'y' || k === ':y') y = entry[1]
    }
    return [x, y]
  }
  return [0, 0]
}

export function installGeom(env, fuel) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  // (geom/point x y) — tagged 2D point [x y].
  def('geom/point', (x, y) => [x, y])
  // (geom/segment p1 p2) — tagged 2-point segment.
  def('geom/segment', (a, b) => tag('segment', pt(a), pt(b)))
  // (geom/circle cx cy r) — tagged circle description.
  def('geom/circle', (cx, cy, r) => tag('circle', cx, cy, r))
  // (geom/triangle a b c) — tagged triangle description.
  def('geom/triangle', (a, b, c) => tag('triangle', pt(a), pt(b), pt(c)))

  // (geom/distance p1 p2) — Euclidean distance.
  def('geom/distance', (a, b) => {
    const [x1, y1] = pt(a), [x2, y2] = pt(b)
    return Math.hypot(x2 - x1, y2 - y1)
  })

  // (geom/midpoint p1 p2)
  def('geom/midpoint', (a, b) => {
    const [x1, y1] = pt(a), [x2, y2] = pt(b)
    return [(x1 + x2) / 2, (y1 + y2) / 2]
  })

  // (geom/rotate p angle) — rotate a point around origin by angle radians.
  def('geom/rotate', (p, angle) => {
    const [x, y] = pt(p)
    const c = Math.cos(angle), s = Math.sin(angle)
    return [x * c - y * s, x * s + y * c]
  })

  // (geom/translate p dx dy) — shift a point by (dx, dy).
  def('geom/translate', (p, dx, dy) => {
    const [x, y] = pt(p)
    return [x + dx, y + dy]
  })

  // (geom/slope p1 p2)
  def('geom/slope', (a, b) => {
    const [x1, y1] = pt(a), [x2, y2] = pt(b)
    const dx = x2 - x1
    if (dx === 0) return Infinity
    return (y2 - y1) / dx
  })

  // (geom/angle-between p1 p2) — radians from horizontal.
  def('geom/angle-between', (a, b) => {
    const [x1, y1] = pt(a), [x2, y2] = pt(b)
    return Math.atan2(y2 - y1, x2 - x1)
  })

  // Trig — direct forwards from Math, in the geom/* namespace so kids
  // can grep for the whole family.
  def('geom/sin', (x) => Math.sin(x))
  def('geom/cos', (x) => Math.cos(x))
  def('geom/tan', (x) => Math.tan(x))
  def('geom/atan2', (y, x) => Math.atan2(y, x))

  // Conversions.
  def('geom/->radians', (deg) => deg * Math.PI / 180)
  def('geom/->degrees', (rad) => rad * 180 / Math.PI)

  // Patch 3 (2026-07-19, Book of ML feedback): math/* aliases for the
  // trig family. `math/*` is the CANONICAL path going forward — it's
  // the namespace 11-year-olds and Book of ML reach for by name.
  // `geom/*` stays as legacy alias so prior carts don't break. Both
  // resolve to the same JS function.
  //
  // The math/exp math/log math/sqrt et al. already live in lib/math/basic.js;
  // this patch fills in the trig neighbourhood so the whole trig family
  // is reachable at math/*.
  def('math/sin',   (x) => Math.sin(x))
  def('math/cos',   (x) => Math.cos(x))
  def('math/tan',   (x) => Math.tan(x))
  def('math/atan2', (y, x) => Math.atan2(y, x))
  def('math/asin',  (x) => Math.asin(x))
  def('math/acos',  (x) => Math.acos(x))
  def('math/atan',  (x) => Math.atan(x))

  // Area / circumference helpers.
  def('geom/circle-area', (r) => Math.PI * r * r)
  def('geom/circle-circumference', (r) => 2 * Math.PI * r)

  // Triangle area via three points, using the shoelace formula.
  def('geom/triangle-area', (a, b, c) => {
    const [x1, y1] = pt(a), [x2, y2] = pt(b), [x3, y3] = pt(c)
    return Math.abs((x2 - x1) * (y3 - y1) - (x3 - x1) * (y2 - y1)) / 2
  })

  // Polygon area via the shoelace formula. `pts` is a list of 2-lists.
  def('geom/polygon-area', (pts) => {
    if (!Array.isArray(pts) || pts.length < 3) return 0
    let s = 0
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pt(pts[i])
      const [x2, y2] = pt(pts[(i + 1) % pts.length])
      s += x1 * y2 - x2 * y1
    }
    return Math.abs(s) / 2
  })

  return env
}

export default installGeom
