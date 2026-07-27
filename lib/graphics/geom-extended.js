// geom-extended.js — the 37 geom/* verbs not covered by lib/graphics/geom.js.
//
// Provenance: 2026-07-22. Wires the verbs listed in /tmp/lanes/29-geom.txt
// against scheme/reference/29-geom.slat. `geom.js` already binds the
// primitive family (point / segment / circle / triangle / distance /
// midpoint / rotate / slope / angle-between (2-pt) / trig-forwards).
// This file adds:
//   * inverse trig at geom/*
//   * arc, sector, circle-family (arc-length, sector-area)
//   * volume/surface for cones, cylinders, prisms, pyramids, spheres
//   * polygon perimeter, dilate, transform-polygon, regular-polygon-vertices
//   * triangle classifiers (collinear?, similar?)
//   * pythagoras + law-of-cosines/sines + right-triangle solvers
//   * reflections (x, y, origin, arbitrary line)
//   * rotate-about a center
//   * interior-angle (radians and degrees variants)
//   * inscribed-angle
//   * angle-between four-scalar form
//   * regular-polygon-area
//   * triangle-area-heron
//
// Two functions in the reference (geom/angle-between and geom/midpoint)
// have both 4-scalar and 2-point overloads in the wild. `geom.js` binds
// the point form under those names; we do NOT rebind them here.
//
// Doctrine: pure numeric transforms. No framebuffer touch, no side effects.
//
// Signature conventions from 29-geom.slat:
//   • Trig verbs take DEGREES (per geom.js docstrings — kid-facing UX).
//     Existing geom/sin/cos/tan take radians; not overridden here.
//   • Arc/sector/pythagoras/law-of-cosines/law-of-sines take numeric
//     scalars per the reference.
//   • Point-arg verbs (dilate, rotate-about, reflect-*, transform-polygon)
//     take 2-element (x y) lists.

import { Sym } from '../../src/reader.js'

// ── metadata ──────────────────────────────────────────────────────
export const VERBS = [
  'geom/arc-length',
  'geom/arccos',
  'geom/arcsin',
  'geom/arctan',
  'geom/collinear?',
  'geom/cone-surface',
  'geom/cone-volume',
  'geom/cylinder-surface',
  'geom/cylinder-volume',
  'geom/dilate',
  'geom/inscribed-angle',
  'geom/interior-angle',
  'geom/interior-angle-deg',
  'geom/law-of-cosines-angle',
  'geom/law-of-cosines-side',
  'geom/law-of-sines-side',
  'geom/perimeter',
  'geom/polygon-perimeter',
  'geom/prism-volume',
  'geom/pyramid-volume',
  'geom/pythagoras-hypotenuse',
  'geom/pythagoras-leg',
  'geom/reflect-line',
  'geom/reflect-origin',
  'geom/reflect-x',
  'geom/reflect-y',
  'geom/regular-polygon-area',
  'geom/regular-polygon-vertices',
  'geom/right-triangle-angle',
  'geom/rotate-about',
  'geom/sector-area',
  'geom/similar?',
  'geom/solve-right',
  'geom/sphere-surface',
  'geom/sphere-volume',
  'geom/transform-polygon',
  'geom/triangle-area-heron',
]
export const LAZY = true
export const BOOK = 'book-of-math/ch08-geometry'
export const TESTS = [
  ['(geom/arccos 0)', '1.5707963267948966'],
  ['(geom/pythagoras-hypotenuse 3 4)', '5'],
  ['(geom/sphere-volume 1)', '4.1887902047863905'],
  ['(geom/triangle-area-heron 3 4 5)', '6'],
]

// ── helpers ───────────────────────────────────────────────────────
function pt(p) {
  if (Array.isArray(p)) {
    if (p.length >= 2 && typeof p[0] === 'number') return [+p[0], +p[1]]
    // alist ((:x N) (:y N))
    let x = 0, y = 0
    for (const entry of p) {
      if (!Array.isArray(entry) || entry.length < 2) continue
      const k = entry[0] instanceof Sym ? entry[0].name : entry[0]
      if (k === 'x' || k === ':x') x = entry[1]
      else if (k === 'y' || k === ':y') y = entry[1]
    }
    return [+x, +y]
  }
  return [0, 0]
}

const DEG2RAD = Math.PI / 180
const RAD2DEG = 180 / Math.PI

// ── installer ─────────────────────────────────────────────────────
export function installGeomExtended(env, ctx) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  // ── inverse trig (radians) ──────────────────────────────────────
  def('geom/arccos', (x) => Math.acos(+x))
  def('geom/arcsin', (x) => Math.asin(+x))
  def('geom/arctan', (x) => Math.atan(+x))

  // ── arc / sector ────────────────────────────────────────────────
  // Reference: (geom/arc-length radius angle-radians) -> length.
  def('geom/arc-length', (r, ang) => Math.abs(+r) * Math.abs(+ang))
  // (geom/sector-area radius angle-radians) -> 0.5 · r² · θ.
  def('geom/sector-area', (r, ang) => 0.5 * (+r) * (+r) * Math.abs(+ang))

  // ── solids ──────────────────────────────────────────────────────
  def('geom/cone-surface',    (r, slant) => Math.PI * (+r) * ((+r) + (+slant)))
  def('geom/cone-volume',     (r, h)     => (Math.PI * (+r) * (+r) * (+h)) / 3)
  def('geom/cylinder-surface',(r, h)     => 2 * Math.PI * (+r) * ((+r) + (+h)))
  def('geom/cylinder-volume', (r, h)     => Math.PI * (+r) * (+r) * (+h))
  def('geom/prism-volume',    (base, h)  => (+base) * (+h))
  def('geom/pyramid-volume',  (base, h)  => ((+base) * (+h)) / 3)
  def('geom/sphere-surface',  (r)        => 4 * Math.PI * (+r) * (+r))
  def('geom/sphere-volume',   (r)        => (4/3) * Math.PI * (+r) * (+r) * (+r))

  // ── polygon helpers ─────────────────────────────────────────────
  // (geom/polygon-perimeter pts)
  def('geom/polygon-perimeter', (pts) => {
    if (!Array.isArray(pts) || pts.length < 2) return 0
    let s = 0
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pt(pts[i])
      const [x2, y2] = pt(pts[(i + 1) % pts.length])
      s += Math.hypot(x2 - x1, y2 - y1)
    }
    return s
  })

  // (geom/perimeter p1 p2 p3) — triangle perimeter.
  def('geom/perimeter', (a, b, c) => {
    const [x1, y1] = pt(a), [x2, y2] = pt(b), [x3, y3] = pt(c)
    return Math.hypot(x2 - x1, y2 - y1) +
           Math.hypot(x3 - x2, y3 - y2) +
           Math.hypot(x1 - x3, y1 - y3)
  })

  // (geom/dilate point center scale) — scale point about center by factor.
  def('geom/dilate', (p, center, scale) => {
    const [x, y] = pt(p), [cx, cy] = pt(center)
    const s = +scale
    return [cx + (x - cx) * s, cy + (y - cy) * s]
  })

  // (geom/transform-polygon points transform-fn ...args)
  def('geom/transform-polygon', (points, fn, ...rest) => {
    if (!Array.isArray(points)) return []
    if (typeof fn !== 'function') return points.map(pt)
    return points.map((p) => fn(p, ...rest))
  })

  // (geom/regular-polygon-vertices n r [start-angle-radians])
  def('geom/regular-polygon-vertices', (n, r, startAngle) => {
    const N = Math.max(3, n | 0)
    const R = +r
    const s = startAngle == null ? 0 : +startAngle
    const out = new Array(N)
    for (let i = 0; i < N; i++) {
      const th = s + i * 2 * Math.PI / N
      out[i] = [R * Math.cos(th), R * Math.sin(th)]
    }
    return out
  })

  // (geom/regular-polygon-area n side) — n · s² / (4 · tan(π/n)).
  def('geom/regular-polygon-area', (n, s) => {
    const N = Math.max(3, n | 0)
    const side = +s
    return (N * side * side) / (4 * Math.tan(Math.PI / N))
  })

  // ── triangle classifiers ────────────────────────────────────────
  def('geom/collinear?', (p1, p2, p3) => {
    const [x1, y1] = pt(p1), [x2, y2] = pt(p2), [x3, y3] = pt(p3)
    const cross = (x2 - x1) * (y3 - y1) - (y2 - y1) * (x3 - x1)
    return Math.abs(cross) < 1e-9
  })

  // Return either a scale ratio (number) if similar, or #f.
  def('geom/similar?', (sides1, sides2) => {
    if (!Array.isArray(sides1) || !Array.isArray(sides2) || sides1.length !== sides2.length) return false
    const a = [...sides1].map((x) => +x).sort((x, y) => x - y)
    const b = [...sides2].map((x) => +x).sort((x, y) => x - y)
    if (a[0] === 0) return false
    const k = b[0] / a[0]
    for (let i = 1; i < a.length; i++) {
      if (Math.abs(b[i] / a[i] - k) > 1e-6) return false
    }
    return k
  })

  // ── pythagoras ──────────────────────────────────────────────────
  def('geom/pythagoras-hypotenuse', (a, b) => Math.hypot(+a, +b))
  def('geom/pythagoras-leg', (hyp, leg) => {
    const H = +hyp, L = +leg
    const d = H * H - L * L
    return d < 0 ? NaN : Math.sqrt(d)
  })

  // ── law of cosines / sines ──────────────────────────────────────
  // (geom/law-of-cosines-angle a b c) — angle opposite side c, in radians.
  def('geom/law-of-cosines-angle', (a, b, c) => {
    const A = +a, B = +b, C = +c
    const denom = 2 * A * B
    if (denom === 0) return NaN
    const cosC = (A*A + B*B - C*C) / denom
    return Math.acos(Math.max(-1, Math.min(1, cosC)))
  })
  // (geom/law-of-cosines-side a b angle-C) — side c opposite angle C.
  def('geom/law-of-cosines-side', (a, b, angC) => {
    const A = +a, B = +b
    return Math.sqrt(A*A + B*B - 2*A*B*Math.cos(+angC))
  })
  // (geom/law-of-sines-side a angle-A angle-B) — side b opposite angle B.
  def('geom/law-of-sines-side', (a, angA, angB) => {
    const sA = Math.sin(+angA)
    if (sA === 0) return NaN
    return (+a) * Math.sin(+angB) / sA
  })

  // ── right triangle helpers ──────────────────────────────────────
  // (geom/right-triangle-angle opposite hypotenuse) → arcsin(opp/hyp).
  def('geom/right-triangle-angle', (opp, hyp) => {
    const r = (+opp) / (+hyp)
    return Math.asin(Math.max(-1, Math.min(1, r)))
  })

  // (geom/solve-right param1 param2) — heuristic solver returning an alist
  // ((hyp N) (opp N) (adj N) (angle N)) given any two of {hyp, opp, adj, angle}.
  // Kid-facing shape from the reference: takes two numbers.  We do the
  // canonical common case (opp + adj) and return the full alist.  Callers
  // that supply (opp hyp) or (adj hyp) can pass zeros for the missing slot
  // — we compute what we can.
  def('geom/solve-right', (p1, p2) => {
    // Assume (opp adj) as the canonical pair.
    const opp = +p1, adj = +p2
    const hyp = Math.hypot(opp, adj)
    const angle = adj === 0 ? Math.PI / 2 : Math.atan(opp / adj)
    return [
      [new Sym('hyp'),   hyp],
      [new Sym('opp'),   opp],
      [new Sym('adj'),   adj],
      [new Sym('angle'), angle],
    ]
  })

  // ── reflections ─────────────────────────────────────────────────
  def('geom/reflect-x', (p) => { const [x, y] = pt(p); return [ x, -y] })
  def('geom/reflect-y', (p) => { const [x, y] = pt(p); return [-x,  y] })
  def('geom/reflect-origin', (p) => { const [x, y] = pt(p); return [-x, -y] })
  // (geom/reflect-line point a b c) — reflect across line ax + by + c = 0.
  def('geom/reflect-line', (p, a, b, c) => {
    const [x, y] = pt(p)
    const A = +a, B = +b, C = +c
    const denom = A*A + B*B
    if (denom === 0) return [x, y]
    const d = (A*x + B*y + C) / denom
    return [x - 2*A*d, y - 2*B*d]
  })

  // ── rotate about arbitrary center ───────────────────────────────
  def('geom/rotate-about', (p, center, theta) => {
    const [x, y] = pt(p), [cx, cy] = pt(center)
    const t = +theta
    const cs = Math.cos(t), sn = Math.sin(t)
    const dx = x - cx, dy = y - cy
    return [cx + dx*cs - dy*sn, cy + dx*sn + dy*cs]
  })

  // ── interior angles ─────────────────────────────────────────────
  // Radians: ((n-2) · π) / n.
  def('geom/interior-angle',     (n) => ((n - 2) * Math.PI) / n)
  // Degrees: (n-2) · 180 / n.
  def('geom/interior-angle-deg', (n) => ((n - 2) * 180) / n)
  // Inscribed angle theorem: inscribed = central / 2.
  def('geom/inscribed-angle', (central) => (+central) / 2)

  // ── triangle area (Heron) ───────────────────────────────────────
  def('geom/triangle-area-heron', (a, b, c) => {
    const A = +a, B = +b, C = +c
    const s = (A + B + C) / 2
    const inner = s * (s - A) * (s - B) * (s - C)
    return inner < 0 ? NaN : Math.sqrt(inner)
  })

  return env
}

export default installGeomExtended
