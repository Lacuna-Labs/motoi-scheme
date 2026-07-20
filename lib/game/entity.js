// entity.js — CORE `entity/*` verbs (Wave 2, 2026-07-16).
//
// Doctrine (Alfred, 2026-07-16 LOCK): the CORE reference uses names
// entity/spawn / entity/set-vel! / entity/despawn! / entity/move! that
// don't match the existing lib/game/game.js surface (entity/make /
// entity/set-velocity! / entity/remove! / entity/move). Rather than
// rename the running lib and break carts, we register BOTH names and
// route them to the SAME underlying game state. Alfred's decision:
// amend the CORE reference to also accept the lib names. This module
// installs the CORE-declared names by delegating to the shared game
// state.
//
// installEntity(env, game) uses the game state passed in from
// makeCoreEnv so entity/spawn and (entity/make …) hit the SAME entity
// map. That means downstream verbs like entity/all, entity/count,
// entity/state work uniformly whichever creation path was used.

import { Sym } from '../../src/reader.js'

const nm = (x) => (x instanceof Sym ? x.name : x)

// Auto-id counter for entity/spawn when the caller doesn't name one.
let _autoId = 1
function _nextId() { return `e${_autoId++}` }

export function installEntity(env, game) {
  const def = (n, f, perm = 'state-change') => env.define(n, f, { perm })

  // (entity/spawn kind x y w? h?) → id
  // (entity/spawn kind x y) — kind is a symbol name (like 'ball).
  // Returns the assigned id. If a caller wants a stable id, use
  // (entity/make id x y ...) — the lib alias.
  def('entity/spawn', (kind, x, y, w = 16, h = 16) => {
    const id = _nextId()
    const kindName = String(nm(kind))
    game.entities.set(id, {
      id,
      kind: kindName,
      x: Number(x) || 0,
      y: Number(y) || 0,
      vx: 0, vy: 0,
      w: Number(w) || 16,
      h: Number(h) || 16,
      tags: new Set([kindName]),
      alive: true,
      hp: 1,
    })
    return id
  }, 'paint')

  // (entity/kind id) → kind symbol.
  def('entity/kind', (id) => {
    const e = game.entities.get(String(nm(id)))
    if (!e) return new Sym('nan')
    return new Sym(e.kind || 'unknown')
  }, 'read')

  // (entity/alive? id) → boolean.
  def('entity/alive?', (id) => {
    const e = game.entities.get(String(nm(id)))
    return !!(e && e.alive !== false)
  }, 'read')

  // (entity/pos id) → (x y).
  def('entity/pos', (id) => {
    const e = game.entities.get(String(nm(id)))
    if (!e) return [0, 0]
    return [e.x, e.y]
  }, 'read')

  // (entity/x id) → x.
  def('entity/x', (id) => {
    const e = game.entities.get(String(nm(id)))
    return e ? e.x : 0
  }, 'read')

  // (entity/y id) → y.
  def('entity/y', (id) => {
    const e = game.entities.get(String(nm(id)))
    return e ? e.y : 0
  }, 'read')

  // (entity/vel id) → (vx vy).
  def('entity/vel', (id) => {
    const e = game.entities.get(String(nm(id)))
    if (!e) return [0, 0]
    return [e.vx || 0, e.vy || 0]
  }, 'read')

  // (entity/set-pos! id x y) → undefined
  def('entity/set-pos!', (id, x, y) => {
    const e = game.entities.get(String(nm(id)))
    if (!e) return undefined
    e.x = Number(x) || 0
    e.y = Number(y) || 0
    return undefined
  }, 'paint')

  // (entity/set-vel! id vx vy) → undefined. Alias of entity/set-velocity!.
  def('entity/set-vel!', (id, vx, vy) => {
    const e = game.entities.get(String(nm(id)))
    if (!e) return undefined
    e.vx = Number(vx) || 0
    e.vy = Number(vy) || 0
    return undefined
  }, 'paint')

  // (entity/move! id dx dy) → undefined. Additive; alias of entity/move.
  def('entity/move!', (id, dx, dy) => {
    const e = game.entities.get(String(nm(id)))
    if (!e) return undefined
    e.x += Number(dx) || 0
    e.y += Number(dy) || 0
    return undefined
  }, 'paint')

  // (entity/goto! id x y) → undefined. Absolute teleport.
  def('entity/goto!', (id, x, y) => {
    const e = game.entities.get(String(nm(id)))
    if (!e) return undefined
    e.x = Number(x) || 0
    e.y = Number(y) || 0
    return undefined
  }, 'paint')

  // (entity/glide! id x y speed?) — set velocity toward target.
  def('entity/glide!', (id, x, y, speed) => {
    const e = game.entities.get(String(nm(id)))
    if (!e) return undefined
    const s = speed ?? 1
    const dx = x - e.x, dy = y - e.y
    const d = Math.hypot(dx, dy)
    if (d === 0) { e.vx = 0; e.vy = 0; return undefined }
    e.vx = (dx / d) * s
    e.vy = (dy / d) * s
    return undefined
  }, 'paint')

  // (entity/accel! id ax ay) — additive velocity.
  def('entity/accel!', (id, ax, ay) => {
    const e = game.entities.get(String(nm(id)))
    if (!e) return undefined
    e.vx = (e.vx || 0) + (Number(ax) || 0)
    e.vy = (e.vy || 0) + (Number(ay) || 0)
    return undefined
  }, 'paint')

  // (entity/overlaps? a b) → boolean AABB test.
  def('entity/overlaps?', (a, b) => {
    const A = game.entities.get(String(nm(a)))
    const B = game.entities.get(String(nm(b)))
    if (!A || !B) return false
    return (A.x < B.x + B.w &&
            B.x < A.x + A.w &&
            A.y < B.y + B.h &&
            B.y < A.y + A.h)
  }, 'read')

  // (entity/distance a b) → euclidean distance between centers.
  def('entity/distance', (a, b) => {
    const A = game.entities.get(String(nm(a)))
    const B = game.entities.get(String(nm(b)))
    if (!A || !B) return Infinity
    return Math.hypot((A.x + A.w / 2) - (B.x + B.w / 2),
                      (A.y + A.h / 2) - (B.y + B.h / 2))
  }, 'read')

  // (entity/despawn! id) — mark and remove. Alias of entity/remove!.
  def('entity/despawn!', (id) => {
    const key = String(nm(id))
    const e = game.entities.get(key)
    if (!e) return false
    e.alive = false
    game.entities.delete(key)
    return true
  }, 'paint')

  // (entity/hp! id hp) — set hit points.
  def('entity/hp!', (id, hp) => {
    const e = game.entities.get(String(nm(id)))
    if (!e) return undefined
    e.hp = Number(hp) || 0
    return e.hp
  }, 'paint')

  // (entity/damage! id amount) → new hp (0 if dead).
  def('entity/damage!', (id, amount) => {
    const e = game.entities.get(String(nm(id)))
    if (!e) return 0
    e.hp = (e.hp ?? 1) - (Number(amount) || 0)
    if (e.hp <= 0) {
      e.hp = 0
      e.alive = false
    }
    return e.hp
  }, 'paint')

  // (entity/untag! id tag) — remove a tag.
  // BUG-1 fix (Zane-2, 2026-07-17): normalize legacy Array-shaped .tags to
  // a Set before deleting. Previously assumed Set (worked for
  // entity/spawn) but threw on entity/make (which used []).
  def('entity/untag!', (id, tag) => {
    const e = game.entities.get(String(nm(id)))
    if (!e) return false
    const t = String(nm(tag))
    if (Array.isArray(e.tags)) e.tags = new Set(e.tags)
    if (!(e.tags instanceof Set)) { e.tags = new Set(); return false }
    return e.tags.delete(t)
  }, 'paint')

  // (entity/shape! id shape) — set the entity's rendering shape.
  def('entity/shape!', (id, shape) => {
    const e = game.entities.get(String(nm(id)))
    if (!e) return undefined
    e.shape = nm(shape)
    return e.shape
  }, 'paint')

  // (entity/sprite! id sprite-name) — attach a sprite name.
  def('entity/sprite!', (id, name) => {
    const e = game.entities.get(String(nm(id)))
    if (!e) return undefined
    e.sprite = String(nm(name))
    return e.sprite
  }, 'paint')

  // (object/spawn ...) — deprecated alias of entity/spawn per Alfred.
  def('object/spawn', (kind, x, y, w = 16, h = 16) => {
    const id = _nextId()
    game.entities.set(id, {
      id,
      kind: String(nm(kind)),
      x: Number(x) || 0, y: Number(y) || 0,
      vx: 0, vy: 0,
      w: Number(w) || 16, h: Number(h) || 16,
      tags: new Set(), alive: true, hp: 1,
    })
    return id
  }, 'paint')

  // (object/fetch id) → entity data as alist, or #f.
  def('object/fetch', (id) => {
    const e = game.entities.get(String(nm(id)))
    if (!e) return false
    return [
      [new Sym(':id'), e.id],
      [new Sym(':kind'), new Sym(e.kind || 'unknown')],
      [new Sym(':x'), e.x],
      [new Sym(':y'), e.y],
      [new Sym(':vx'), e.vx || 0],
      [new Sym(':vy'), e.vy || 0],
      [new Sym(':w'), e.w],
      [new Sym(':h'), e.h],
      [new Sym(':hp'), e.hp ?? 1],
      [new Sym(':alive'), !!e.alive],
    ]
  }, 'read')

  return env
}

export function __resetEntityIds() { _autoId = 1 }

export default installEntity
