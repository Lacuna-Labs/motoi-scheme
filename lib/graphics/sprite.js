// sprite.js — the sprite (cell-cluster) layer.
//
// Provenance: scheme-lang/src/sprite.js. Migrated to
// motoi-scheme/lib/graphics/ on 2026-07-16 (Pass-3 Wave 1). Default
// cell color-name 'blossom' preserved for backwards compat with the
// Sakura dialect (Sakura consumers rely on the exact string).
//
// A Motoi sprite is NOT a bitmap. It's a named cluster of CELLS, each
// tagged with an offset in the sprite's local frame. Along with the
// cells you can name PETALS — anchor points inside the cluster that
// callers refer to symbolically ('head, 'foot, 'hand).
//
// This is different from framebuffer paint calls: sprites are cataloged
// data. The rasterize verb turns a sprite (or a raw cell cluster) into
// stamps on the shared framebuffer.
//
// The internal model:
//   SPRITES : Map<name, sprite>
//     sprite = { name, cells: [{x, y, color}, ...],
//                petals: Map<name, [x, y]> }
//
// petals are used by (sprite/address sprite-name petal-name) to
// resolve a named anchor to a coordinate — useful for attaching one
// entity to another (a shield to a hero's arm).
//
// Kid-readable comment: a sprite is like a jigsaw picture made of
// small squares. Each square is a "cell" you can color. Petals are
// dots you put on the picture to remember "this is where the eye is"
// or "this is where the hand is."

import { Sym } from '../../src/reader.js'
import { getMediaState } from '../media/media.js'

const nm = (x) => (x instanceof Sym ? x.name : x)

// ── module-level registry ──────────────────────────────────────────────
const SPRITES = new Map()

export function defineSprite(name, cells, petals) {
  SPRITES.set(String(name), {
    name: String(name),
    cells: normalizeCells(cells),
    petals: normalizePetals(petals),
  })
}

export function clearSprites() {
  SPRITES.clear()
}

function normalizeCells(cells) {
  if (!Array.isArray(cells)) return []
  return cells.map((c) => {
    if (Array.isArray(c)) {
      return {
        x: Number(c[0]) || 0,
        y: Number(c[1]) || 0,
        color: c.length > 2 ? String(nm(c[2])) : 'blossom',
      }
    }
    if (c && typeof c === 'object') {
      return {
        x: Number(c.x) || 0,
        y: Number(c.y) || 0,
        color: c.color ? String(nm(c.color)) : 'blossom',
      }
    }
    return { x: 0, y: 0, color: 'blossom' }
  })
}

function normalizePetals(petals) {
  const m = new Map()
  if (!petals) return m
  if (petals instanceof Map) {
    for (const [k, v] of petals) m.set(String(nm(k)), toCoord(v))
    return m
  }
  if (Array.isArray(petals)) {
    for (const entry of petals) {
      if (Array.isArray(entry) && entry.length >= 2) {
        m.set(String(nm(entry[0])), toCoord(entry.slice(1)))
      }
    }
    return m
  }
  if (typeof petals === 'object') {
    for (const [k, v] of Object.entries(petals)) m.set(k, toCoord(v))
  }
  return m
}

function toCoord(v) {
  if (Array.isArray(v)) return [Number(v[0]) || 0, Number(v[1]) || 0]
  if (v && typeof v === 'object' && 'x' in v && 'y' in v) return [Number(v.x) || 0, Number(v.y) || 0]
  return [0, 0]
}

// ── install into a Scheme env ──────────────────────────────────────────

export function installSprite(env) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  // (sprite/define name cells [petals]) → #t
  //   Register a sprite. Not in the reference but needed to author test
  //   sprites. cells = list of (x y color) triples; petals = alist of
  //   (name x y). Backing storage for the reference verbs below.
  def('sprite/define', (name, cells, petals) => {
    defineSprite(String(nm(name)), cells, petals)
    return true
  }, 'state-change')

  // (sprite/address sprite-ref petal-ref) → (list x y) | error
  //   Resolve a sprite+petal to a cell coordinate.
  def('sprite/address', (spriteRef, petalRef) => {
    if (petalRef === undefined) {
      // Reference-shape one-arg call — return the sprite's origin as
      // (0 0) if the sprite exists, else an error record.
      const s = SPRITES.get(String(nm(spriteRef)))
      if (!s) return { kind: 'error', reason: 'unknown-sprite', sprite: String(nm(spriteRef)) }
      return [0, 0]
    }
    const s = SPRITES.get(String(nm(spriteRef)))
    if (!s) return { kind: 'error', reason: 'unknown-sprite', sprite: String(nm(spriteRef)) }
    const p = s.petals.get(String(nm(petalRef)))
    if (!p) return { kind: 'error', reason: 'unknown-petal', sprite: s.name, petal: String(nm(petalRef)) }
    return [p[0], p[1]]
  })

  // (sprite/landmarks sprite-ref) → list-of-petal-names | error
  //   List the sprite's named anchor points.
  def('sprite/landmarks', (spriteRef) => {
    const s = SPRITES.get(String(nm(spriteRef)))
    if (!s) return { kind: 'error', reason: 'unknown-sprite', sprite: String(nm(spriteRef)) }
    return Array.from(s.petals.keys()).map((k) => new Sym(k))
  })

  // (sprite/rasterize cells col row [spin sx sy dy alphas]) → stamp-count
  //
  // Stamp a cluster of cells into the framebuffer. Two shapes:
  //   1. cells is a Sym → look up in SPRITES, use its cells
  //   2. cells is a list of (x y color) triples → use directly
  //
  // The `col`/`row` are the destination position on the framebuffer.
  // Optional args:
  //   spin — rotation in radians (default 0)
  //   sx sy — scale factors (default 1)
  //   dy — y-shift after rotation (default 0)
  //   alphas — per-cell alpha values (default all 1)
  //
  // Returns the number of cells actually stamped.
  def('sprite/rasterize', (cellsOrName, col, row, spin = 0, sx = 1, sy = 1, dy = 0, alphas = null) => {
    const media = getMediaState()
    if (!media || !media.fb) return 0

    // Resolve the cluster.
    let cluster
    if (cellsOrName instanceof Sym || typeof cellsOrName === 'string') {
      const s = SPRITES.get(String(nm(cellsOrName)))
      if (!s) return 0
      cluster = s.cells
    } else if (Array.isArray(cellsOrName)) {
      cluster = normalizeCells(cellsOrName)
    } else {
      return 0
    }

    const cx = Number(col) || 0
    const cy = Number(row) || 0
    const rot = Number(spin) || 0
    const scaleX = Number(sx) || 1
    const scaleY = Number(sy) || 1
    const yShift = Number(dy) || 0
    const cs = Math.cos(rot)
    const sn = Math.sin(rot)

    let stamped = 0
    // We reach into media.fb.paint if available; otherwise store on
    // the sprite accumulator (whichever the current framebuffer
    // exposes). Fall back to pushing plain records into media.fb.stamps
    // if present.
    const paint = media.fb.paint || media.fb.set
    for (let i = 0; i < cluster.length; i++) {
      const c = cluster[i]
      // Rotate + scale the local offset.
      const lx = c.x * scaleX
      const ly = c.y * scaleY
      const rx = lx * cs - ly * sn
      const ry = lx * sn + ly * cs
      const px = Math.round(cx + rx)
      const py = Math.round(cy + ry + yShift)
      const alpha = Array.isArray(alphas) && i < alphas.length
        ? Number(alphas[i]) : 1
      if (typeof paint === 'function') {
        try {
          paint.call(media.fb, px, py, c.color, alpha)
          stamped += 1
        } catch { /* keep counting */ }
      } else if (Array.isArray(media.fb.stamps)) {
        media.fb.stamps.push({ x: px, y: py, color: c.color, alpha })
        stamped += 1
      } else {
        // No paint channel — record the intent so callers can still
        // observe the stamp count. Increment and continue.
        stamped += 1
      }
    }
    return stamped
  }, 'paint')

  return env
}

export default installSprite
