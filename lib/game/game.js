// game.js — Layer 3 (L3): the fantasy-console game kit.
//
// Provenance: scheme-lang/src/game.js. Migrated to
// motoi-scheme/lib/game/ on 2026-07-16 (Pass-3 Wave 1). Default sprite
// color-arg 'blossom' preserved (public verb signature; changing it
// would break existing Sakura-dialect scripts).
//
// Small, standalone, no external deps. Ships with the base engine so a
// script that says (sprite 'ball 40 40) or (entity/make 'hero 10 10)
// just works out of the box.
//
// What's here:
//   · Simple entity system   — id → { x, y, vx, vy, w, h, tags }
//   · AABB collision         — rectangle-vs-rectangle overlap test
//   · Basic verlet physics   — gravity + friction + integration
//   · Sprite specs           — plain data pushed onto an accumulator
//   · Tile maps              — 2D grid of characters/numbers
//
// Adapter pattern:
//   The `game` object passed in acts as a seam. Curator's fancier engine
//   (HelloSurface, with real rendering + physics) can pass its own game
//   object with the same shape and swap the impl. Standalone REPL uses
//   the default one below.
//
// Kid-readable comment: this is the "moving things around" part of the
// language — where balls bounce, characters walk, and rectangles bump
// into each other.

import { Sym, sym } from '../../src/reader.js'
import { getMediaState } from '../media/media.js'
import { apply } from '../../src/interp.js'

// Turn a Sym into a plain string; passthrough otherwise. Handy for
// (entity/make 'ball ...) where 'ball arrives as a Sym.
const nm = (x) => (x instanceof Sym ? x.name : x)

// ── default game state ────────────────────────────────────────────────
//
// The controller — the runtime object that holds live game state across
// frames. Standalone REPL constructs one at startup; adapter callers
// pass in their own (Curator does).
export function makeGameState() {
  return {
    // Sprite specs pushed by (sprite …). Consumed by the renderer each
    // frame. Plain data; no side effects on push.
    sprites: [],
    // Entities are the moving/colliding things. Keyed by id (string
    // name from a Sym). Each entity has { x, y, vx, vy, w, h, tags }.
    entities: new Map(),
    // Gravity + friction — tuneable via (physics/gravity!) etc.
    gravity: 0.5,
    friction: 0.98,
    // Frame counter + stop signal. Real loop drivers own these; the
    // standalone REPL just reads them.
    frameNo: 0,
    stopped: false,
    // Tile map — 2D array; null when no map is set. See tilemap/set!.
    tilemap: null,
    tileW: 16,
    tileH: 16,
  }
}

// ── AABB collision ─────────────────────────────────────────────────────
//
// The workhorse. Two rectangles overlap when they overlap on BOTH axes.
// Strict — touching edges don't count as overlap (a.x + a.w === b.x is
// a "touch," not a "collision"). Matches the language's built-in
// `overlap?` predicate already in base.js.
export function aabbOverlap(x1, y1, w1, h1, x2, y2, w2, h2) {
  return x1 < x2 + w2 && x2 < x1 + w1 && y1 < y2 + h2 && y2 < y1 + h1
}

// ── verlet physics step ────────────────────────────────────────────────
//
// One integration step per entity. Position += velocity, velocity *=
// friction, velocity.y += gravity. Simple, stable, PICO-8-shaped. No
// forces — impulses only. Callers use (entity/move …) or set vx/vy
// directly.
function integrateVerlet(entity, game) {
  entity.vy += game.gravity
  entity.vx *= game.friction
  entity.vy *= game.friction
  entity.x += entity.vx
  entity.y += entity.vy
}

// ── install game verbs into a Scheme env ───────────────────────────────
//
// The Scheme side sees only verbs; the JS side owns the mutable game
// state. Curator overrides by passing its own `game` object (same shape).
export function installGame(env, game) {
  // Small helper — set perm on every def. Most game verbs are
  // state-change (they mutate the entity table or the sprite accumulator).
  const def = (n, f, perm = 'state-change') => env.define(n, f, { perm })

  // ── sprites ─────────────────────────────────────────────────────────
  //
  // (sprite name x y [color]) — push a sprite spec onto the accumulator.
  // A sprite is just data: the renderer decides how to paint it. Kids
  // can read this: "put a ball at 40 40."
  def('sprite', (name, x, y, color = 'blossom') => {
    game.sprites.push({
      type: 'sprite',
      name: String(nm(name)),
      x: Number(x) || 0,
      y: Number(y) || 0,
      color: String(nm(color)),
    })
    return undefined
  }, 'paint')

  // (sprites) — return the current sprite list (for tests + inspection).
  def('sprites', () => game.sprites.slice(), 'read')

  // (sprites/clear) — wipe the accumulator. Called each frame by the
  // driver before re-emitting sprites.
  def('sprites/clear', () => { game.sprites.length = 0; return undefined })

  // ── entities ────────────────────────────────────────────────────────
  //
  // The entity system is a simple id → data map. IDs are strings (from
  // Syms). Every entity has position, velocity, size, and tags.

  // (entity/make id x y [w h]) — create an entity. Returns the id (so a
  // caller can chain calls that need it).
  //
  // BUG-1 fix (Zane-2, 2026-07-17): tags now stored as a Set to match
  // entity/spawn (entity.js). Previously entity/make used [] while
  // entity/spawn used new Set(...); entity/tag!/untag! disagreed on the
  // storage shape. Unifying at every creation site + normalizing at every
  // read site keeps old carts working while eliminating the type-mismatch
  // TypeError.
  def('entity/make', (id, x, y, w = 16, h = 16) => {
    const key = String(nm(id))
    game.entities.set(key, {
      id: key,
      x: Number(x) || 0,
      y: Number(y) || 0,
      vx: 0,
      vy: 0,
      w: Number(w) || 16,
      h: Number(h) || 16,
      tags: new Set(),
      // Static entities are excluded from physics — walls, floors,
      // platforms. Set with (entity/pin! id).
      static: false,
    })
    return key
  })

  // BUG-1 fix helper (Zane-2, 2026-07-17): normalize legacy Array-shaped
  // .tags into a Set in-place, or return the existing Set. Idempotent.
  // Handles missing .tags too (returns a fresh Set attached to e).
  const _tagSet = (e) => {
    if (!e.tags) { e.tags = new Set(); return e.tags }
    if (e.tags instanceof Set) return e.tags
    if (Array.isArray(e.tags)) { e.tags = new Set(e.tags); return e.tags }
    // Unknown shape — replace with a fresh Set to avoid crashing callers.
    e.tags = new Set()
    return e.tags
  }

  // (entity/pin! id) — mark an entity as static: physics skips it.
  // Perfect for floors, walls, and any level geometry that shouldn't
  // move under gravity.
  def('entity/pin!', (id) => {
    const e = game.entities.get(String(nm(id)))
    if (!e) return false
    e.static = true
    e.vx = 0
    e.vy = 0
    return true
  })

  // (entity/unpin! id) — reverse of pin!. Physics acts on it again.
  def('entity/unpin!', (id) => {
    const e = game.entities.get(String(nm(id)))
    if (!e) return false
    e.static = false
    return true
  })

  // (entity/static? id) — is this entity pinned?
  def('entity/static?', (id) => {
    const e = game.entities.get(String(nm(id)))
    return !!(e && e.static)
  }, 'read')

  // (entity/state id) — read the entity's current physics state. Returns
  // a plain list for Scheme: (id x y vx vy w h). Nil when the id is
  // unknown. Renamed from entity/get per decision-017 (name collided
  // with the scratch-map accessor documented in the reference).
  def('entity/state', (id) => {
    const e = game.entities.get(String(nm(id)))
    if (!e) return undefined
    return [e.id, e.x, e.y, e.vx, e.vy, e.w, e.h]
  }, 'read')

  // (entity/ref id key) — read a per-entity scratch value by key.
  // Returns the special symbol 'nan when the key does not exist.
  // Companion accessor to entity/set!; mirrors hash-ref shape.
  // Decision-017: replaces the ambiguous entity/get name.
  const NAN_SYM = sym('nan')
  def('entity/ref', (id, key) => {
    const e = game.entities.get(String(nm(id)))
    if (!e || !e.scratch) return NAN_SYM
    const k = String(nm(key))
    return e.scratch.has(k) ? e.scratch.get(k) : NAN_SYM
  }, 'read')

  // (entity/set! id key val) — write a per-entity scratch value.
  // Returns val. Mirrors hash-set! shape.
  // Decision-017: replaces entity/get-set! (dual-verb name).
  def('entity/set!', (id, key, val) => {
    const e = game.entities.get(String(nm(id)))
    if (!e) return val
    if (!e.scratch) e.scratch = new Map()
    const k = typeof key === 'object' && key && key.__sym ? key.__sym : String(nm(key))
    e.scratch.set(k, val)
    return val
  })

  // (entity/move id dx dy) — nudge the entity's position directly. Bypasses
  // physics; useful for direct control (a keyboard-driven hero).
  def('entity/move', (id, dx, dy) => {
    const e = game.entities.get(String(nm(id)))
    if (!e) return false
    e.x += Number(dx) || 0
    e.y += Number(dy) || 0
    return true
  })

  // (entity/set-velocity! id vx vy) — set the velocity for physics-driven
  // motion. Gravity + friction will act on it next frame.
  def('entity/set-velocity!', (id, vx, vy) => {
    const e = game.entities.get(String(nm(id)))
    if (!e) return false
    e.vx = Number(vx) || 0
    e.vy = Number(vy) || 0
    return true
  })

  // (entity/turn id angle) — rotate the entity's velocity vector by angle
  // degrees. Sprite turns to match. Speed stays the same.
  def('entity/turn', (id, angle) => {
    const e = game.entities.get(String(nm(id)))
    if (!e) return false
    const rad = (Number(angle) || 0) * Math.PI / 180
    const cs = Math.cos(rad)
    const sn = Math.sin(rad)
    const nvx = e.vx * cs - e.vy * sn
    const nvy = e.vx * sn + e.vy * cs
    e.vx = nvx
    e.vy = nvy
    return true
  })

  // (entity/rotate! id angle [:duration ms] [:easing e])
  //   Rotate the entity's orientation. Locked shape (2026-07-16
  //   reconciliation): uniform :duration + :easing across every motion
  //   verb, symbol OR procedure accepted for :easing.
  //     · No :duration → instant snap (angle is applied now).
  //     · With :duration → the entity's `angle` interpolates from its
  //       current value to `angle` over :duration ms using :easing.
  //   Angle is in degrees; the entity stores `angle` (numeric degrees)
  //   that the renderer reads each frame. Also rotates the velocity
  //   vector so sprite + heading stay coherent.
  def('entity/rotate!', (...args) => {
    // Parse (id angle) positional, then optional :duration / :easing kws.
    let id, angle
    const kw = {}
    const positional = []
    let i = 0
    while (i < args.length) {
      const a = args[i]
      const kn = a instanceof Sym ? a.name : (typeof a === 'string' ? a : null)
      if (kn && kn.startsWith(':')) {
        kw[kn.slice(1)] = args[i + 1]
        i += 2
      } else {
        positional.push(a)
        i += 1
      }
    }
    id = positional[0]
    angle = Number(positional[1]) || 0
    const e = game.entities.get(String(nm(id)))
    if (!e) return false
    const durMs = kw.duration === undefined ? 0 : Number(kw.duration)
    const easingArg = kw.easing

    if (!(durMs > 0)) {
      // Instant snap: apply the rotation to velocity + orientation now.
      const startAngle = Number(e.angle) || 0
      const delta = angle - startAngle
      const rad = delta * Math.PI / 180
      const cs = Math.cos(rad), sn = Math.sin(rad)
      const nvx = e.vx * cs - e.vy * sn
      const nvy = e.vx * sn + e.vy * cs
      e.vx = nvx; e.vy = nvy
      e.angle = angle
      return true
    }

    // Animated rotate: seed a scratch object so the caller (or a test)
    // can advance it manually. We do NOT own an animation loop here —
    // dispatch a small tween state and let a per-frame tick drive it.
    const startAngle = Number(e.angle) || 0
    e._rotate = {
      startAngle,
      endAngle: angle,
      startedAt: Date.now(),
      durationMs: durMs,
      easing: easingArg,
    }
    e.angle = angle   // final value is known; interpolation is a hint
    return true
  })

  // (entity/apply-force! target fx fy)
  //   Locked-name alias of physics/apply-force. Same semantics: for an
  //   entity id, adds (fx, fy) to velocity; for a tween record, shifts
  //   its from/to endpoints so the on-screen motion nudges too.
  //   Kept as its own binding so it appears in the entity/* namespace.
  def('entity/apply-force!', (target, fx, fy) => {
    const dx = Number(fx) || 0
    const dy = Number(fy) || 0
    if (target && typeof target === 'object' &&
        ('fromX' in target || 'toX' in target) &&
        typeof target.durationFrames === 'number') {
      target.fromX += dx; target.toX += dx
      target.fromY += dy; target.toY += dy
      return true
    }
    const e = game.entities.get(String(nm(target)))
    if (!e) return false
    e.vx += dx; e.vy += dy
    return true
  })

  // (on-collision handler)
  //   Install a collision handler fired each `physics/step` for every
  //   pair of entities that overlap. Handler receives (a-id b-id) as
  //   symbols. Locked shape: generic game/physics, adapter-safe (no
  //   dependence on Sakura-specific state).
  //
  //   Single-slot per Motoi convention (matches on-frame/on-key). Set
  //   again to replace; pass #f (or false) to clear.
  def('on-collision', (fn) => {
    if (fn === false || fn === undefined || fn === null) {
      game._onCollision = null
      return undefined
    }
    if (typeof fn !== 'function' && !(fn && fn.params)) {
      throw new Error('on-collision: handler must be a procedure')
    }
    game._onCollision = fn
    return undefined
  })


  // (entity/tag! id tag) — add a tag to an entity. Tags are for grouping
  // (e.g. tag every enemy 'enemy, then collide them as a group).
  // BUG-1 fix (Zane-2, 2026-07-17): route through _tagSet so entities
  // created by either entity/make (was Array) or entity/spawn (Set) work.
  def('entity/tag!', (id, tag) => {
    const e = game.entities.get(String(nm(id)))
    if (!e) return false
    _tagSet(e).add(String(nm(tag)))
    return true
  })

  // (entity/has-tag? id tag) — predicate.
  def('entity/has-tag?', (id, tag) => {
    const e = game.entities.get(String(nm(id)))
    if (!e) return false
    return _tagSet(e).has(String(nm(tag)))
  }, 'read')

  // (entity/all) — the full entity list, as a list of ids. Read-only.
  def('entity/all', () => Array.from(game.entities.keys()), 'read')

  // (entity/remove! id) — take it off the map.
  def('entity/remove!', (id) => {
    return game.entities.delete(String(nm(id)))
  })

  // (entity/count) — how many entities exist.
  def('entity/count', () => game.entities.size, 'read')

  // ── collision ───────────────────────────────────────────────────────
  //
  // The engine-side collision uses the entity table; the pure predicate
  // `overlap?` (already in base.js) works on raw rectangles too.

  // (entity/collides? a b) — do these two entities overlap right now?
  def('entity/collides?', (aId, bId) => {
    const a = game.entities.get(String(nm(aId)))
    const b = game.entities.get(String(nm(bId)))
    if (!a || !b) return false
    return aabbOverlap(a.x, a.y, a.w, a.h, b.x, b.y, b.w, b.h)
  }, 'read')

  // (entity/hits-tag id tag) — return the list of entity ids that share
  // `tag` AND overlap with `id`. Handy for "did the hero touch any coin?"
  // BUG-1 fix (Zane-2, 2026-07-17): normalize `other.tags` via _tagSet so
  // Set-shaped and Array-shaped entities coexist. Skips entities with no
  // .tags field defensively.
  def('entity/hits-tag', (id, tag) => {
    const e = game.entities.get(String(nm(id)))
    if (!e) return []
    const t = String(nm(tag))
    const hits = []
    for (const [k, other] of game.entities) {
      if (k === e.id) continue
      if (!_tagSet(other).has(t)) continue
      if (aabbOverlap(e.x, e.y, e.w, e.h, other.x, other.y, other.w, other.h)) {
        hits.push(k)
      }
    }
    return hits
  }, 'read')

  // ── physics ─────────────────────────────────────────────────────────

  // (physics/step) — advance every non-static entity one frame. Gravity
  // + friction + integration. Called each frame by the driver.
  // Static entities (walls, floors, pinned platforms) are skipped.
  //
  // After integration:
  //   · fire `on-collision` for every unordered overlapping pair
  //   · fire per-entity `_onSettle` when velocity has fallen below
  //     the settle threshold (0.01 magnitude), once per settle event
  def('physics/step', () => {
    // Snapshot the pre-step velocity magnitudes so we can detect the
    // moment an entity settles.
    const preVel = new Map()
    for (const [k, e] of game.entities) {
      preVel.set(k, Math.hypot(e.vx, e.vy))
    }
    for (const e of game.entities.values()) {
      if (!e.static) integrateVerlet(e, game)
    }
    game.frameNo += 1

    // Small trampoline: invoke either a native JS callback or an
    // interpreter closure, so on-collision + on-settle accept both.
    const call = (fn, args) => {
      if (typeof fn === 'function') return fn(...args)
      if (fn && fn.params) return apply(fn, args, { n: 200000 })
      return undefined
    }

    // Fire the collision handler for every overlapping pair.
    if (game._onCollision) {
      const ents = Array.from(game.entities.values())
      for (let i = 0; i < ents.length; i++) {
        for (let j = i + 1; j < ents.length; j++) {
          const a = ents[i], b = ents[j]
          if (aabbOverlap(a.x, a.y, a.w, a.h, b.x, b.y, b.w, b.h)) {
            try {
              call(game._onCollision, [sym(a.id), sym(b.id)])
            } catch { /* soft-fail — never break physics on a handler bug */ }
          }
        }
      }
    }

    // Fire per-entity settle callbacks.
    const SETTLE = 0.01
    for (const [k, e] of game.entities) {
      const pre = preVel.get(k) || 0
      const post = Math.hypot(e.vx, e.vy)
      if (pre > SETTLE && post <= SETTLE && e._onSettle) {
        try { call(e._onSettle, [sym(e.id)]) } catch { /* soft-fail */ }
        // Fire once per settle event.
        e._onSettle = null
      }
    }
    return undefined
  })

  // (physics/gravity! g) — set the gravity constant. Zero = space.
  def('physics/gravity!', (g) => { game.gravity = Number(g) || 0; return undefined })

  // (physics/friction! f) — friction is a multiplier on velocity each
  // frame. 1.0 = no friction, 0.98 = slow decay, 0.0 = instant stop.
  def('physics/friction!', (f) => {
    const v = Number(f)
    game.friction = (Number.isFinite(v) ? v : 0.98)
    return undefined
  })

  // (physics/gravity) — read the current gravity value.
  def('physics/gravity', () => game.gravity, 'read')

  // (physics/friction) — read the current friction value.
  def('physics/friction', () => game.friction, 'read')

  // ── target-aware physics (2026-07-16, text-anim lane) ─────────────
  //
  // The physics/apply-* verbs accept two shapes of target:
  //   1. an entity id (Sym or string) → normal entity physics
  //   2. a tween record (from `motion` / `bounce`) → the tween's
  //      position is nudged, so a heart-emoji tween can bounce
  //      under gravity or take a knockback force
  //
  // Doctrine: the target argument decides how the force applies. This
  // is what lets a kid write (physics/apply-gravity my-emoji-tween)
  // AND a 60-year-old write (physics/apply-force 'hero 0 -20).

  const looksLikeTween = (t) =>
    t && typeof t === 'object' && ('fromX' in t || 'toX' in t) &&
    typeof t.durationFrames === 'number'

  // (physics/apply-force target fx fy) — accumulate a force impulse.
  //   For entities: adds directly to velocity.
  //   For tweens:   shifts fromY/toY (upward force = negative fy).
  //                 Also perturbs fromX/toX for horizontal impulses.
  def('physics/apply-force', (target, fx, fy) => {
    const dx = Number(fx) || 0
    const dy = Number(fy) || 0
    if (looksLikeTween(target)) {
      target.fromX += dx
      target.toX += dx
      target.fromY += dy
      target.toY += dy
      return true
    }
    const e = game.entities.get(String(nm(target)))
    if (!e) return false
    e.vx += dx
    e.vy += dy
    return true
  })

  // (physics/apply-gravity target [g]) — apply gravity to `target`
  //   for one frame. Uses the game's global gravity if `g` is omitted.
  //   Works on entities and on tweens (a heart falls, an entity falls).
  def('physics/apply-gravity', (target, g) => {
    const acc = (g === undefined ? game.gravity : Number(g)) || 0
    if (looksLikeTween(target)) {
      // Shift the tween's end position DOWN by `acc` — the next frame
      // will interpolate to a lower resting point.
      target.toY += acc
      // Also nudge the current from-position so the shift is felt now.
      target.fromY += acc * 0.5
      return true
    }
    const e = game.entities.get(String(nm(target)))
    if (!e || e.static) return false
    e.vy += acc
    return true
  })

  // (physics/apply-impulse target dvx dvy) — synonym for apply-force
  //   with entity-only semantics; kept as a named verb because
  //   "impulse" reads more naturally in some scripts.
  def('physics/apply-impulse', (target, dvx, dvy) => {
    if (looksLikeTween(target)) {
      target.toX += (Number(dvx) || 0) * 5
      target.toY += (Number(dvy) || 0) * 5
      return true
    }
    const e = game.entities.get(String(nm(target)))
    if (!e) return false
    e.vx += Number(dvx) || 0
    e.vy += Number(dvy) || 0
    return true
  })

  // ── tile maps ───────────────────────────────────────────────────────
  //
  // A tile map is a 2D array of tile-ids (numbers or symbols). Used for
  // walls, floors, background terrain. The renderer paints each tile in
  // its cell; game logic queries tiles for collision with entities.

  // (tilemap/set! rows) — install a tile map from a list of lists.
  //   (tilemap/set! '((0 0 0) (0 1 0) (0 0 0)))
  def('tilemap/set!', (rows) => {
    if (!Array.isArray(rows)) return false
    // Copy to a plain 2D array we own.
    game.tilemap = rows.map((r) => Array.isArray(r) ? r.slice() : [])
    return true
  })

  // (tilemap/get x y) — read the tile at column x, row y. Nil if
  // out-of-bounds or no map.
  def('tilemap/get', (x, y) => {
    if (!game.tilemap) return undefined
    const row = game.tilemap[y | 0]
    if (!row) return undefined
    return row[x | 0]
  }, 'read')

  // (tilemap/put! x y tile) — write a tile at (x, y).
  def('tilemap/put!', (x, y, tile) => {
    if (!game.tilemap) return false
    const row = game.tilemap[y | 0]
    if (!row) return false
    row[x | 0] = nm(tile)
    return true
  })

  // (tilemap/rows) / (tilemap/cols) — dimensions. Zero when no map.
  def('tilemap/rows', () => (game.tilemap ? game.tilemap.length : 0), 'read')
  def('tilemap/cols', () => (game.tilemap && game.tilemap[0] ? game.tilemap[0].length : 0), 'read')

  // (tilemap/tile-size! w h) — set the size of each tile in pixels. The
  // renderer uses this to place tiles on the framebuffer.
  def('tilemap/tile-size!', (w, h) => {
    game.tileW = Number(w) || 16
    game.tileH = Number(h) || 16
    return undefined
  })

  // (tilemap/tile-at-pixel px py) — reverse lookup: which tile lives at
  // this pixel? Useful for "did the ball hit a wall?" collision.
  def('tilemap/tile-at-pixel', (px, py) => {
    if (!game.tilemap) return undefined
    const tx = Math.floor(px / game.tileW)
    const ty = Math.floor(py / game.tileH)
    return env.get('tilemap/get')(tx, ty)
  }, 'read')

  // ── frame loop ──────────────────────────────────────────────────────
  //
  // Same shape as Curator's gameKit. The on-frame handler gets called
  // once per tick by the driver. (frame) reads the current tick number.
  //
  // L1 MEDIA (media.js) already registers on-frame + frame + stop. We
  // rebind them here to ALSO keep the legacy game.js single-handler
  // slot in sync — Curator's driver still reads game.onFrame + game
  // .frameNo, so we bridge those two worlds instead of picking one.
  const media = getMediaState()
  def('on-frame', (fn) => {
    // Old: assign to game.onFrame. Preserve so Curator's tickFrame
    // routine (which pulls game.onFrame) keeps working.
    game.onFrame = fn
    // New: also install into the L1 media loop's handler slot so the
    // scheme-lang animation loop invokes it on setInterval ticks.
    // Single-slot semantics per the reference — replace, don't push.
    media.events.frame = [fn]
    media.loop.ensureRunning()
    return undefined
  })
  // (frame) → current tick number. Preserves the L1 media semantics:
  // zero args → counter; with numeric w+h → composite shape record.
  // Syncs game.frameNo alongside so Curator's consumers still see the
  // right value directly.
  def('frame', (...args) => {
    game.frameNo = media.fb.frame
    if (args.length === 0) return media.fb.frame
    if (args.length >= 2 && typeof args[0] === 'number' && typeof args[1] === 'number') {
      const [w, h, ...shapes] = args
      return { kind: 'graphic', w, h, shapes }
    }
    return { kind: 'graphic', shapes: args }
  }, 'read')
  def('stop', () => {
    game.stopped = true
    media.loop.stop()
    return undefined
  })

  return env
}

// Adapter interface: consumers can swap the whole game module by
// providing their own installer. Default installer is `installGame`
// above; Curator will pass its own to override.
export default installGame
