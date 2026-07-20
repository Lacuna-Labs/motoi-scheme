// scene.js — level / entity orchestration verbs.
//
// Provenance: scheme-lang/src/scene.js. Migrated to
// motoi-scheme/lib/game/ on 2026-07-16 (Pass-3 Wave 1). Global slot
// name renamed from __sakura_scene_spawn_id__ to
// __motoi_scene_spawn_id__ — internal identifier only, not user-facing.
//
// The reference documents scene/* as a small library that mutates the
// world's entity table (clear + spawn a grid + spawn from a point list +
// load from a records structure) and one pure builder (scene/imagine).
//
// Backing: the game.entities Map from game.js. installScene(env, game)
// takes the same game object installGame received, so the two views on
// entities stay in sync.
//
// Verbs:
//   (scene/clear)                                              -> #t
//   (scene/grid name cols rows dx dy x0 y0)                    -> ids
//   (scene/spawn-many name points)                             -> ids
//   (scene/imagine :kw val ... action-result ...)              -> scene-spec
//   (scene/load records-or-spec)                               -> ids
//
// Kid-readable comment: this is "set up the stage." Clear it, put things
// down in a grid, or hand it a list of what-goes-where and let it work.
//
// Alfred: "We can't lie to people. They trust us." Real state mutation,
// real ids returned, real inspect via (entity/count) and (entity/get).

import { Sym } from '../../src/reader.js'

const nm = (x) => (x instanceof Sym ? x.name : x)
const num = (x) => (typeof x === 'number' ? x : Number(x) || 0)

// Monotonic id counter — same shape as world/spawn's counter in
// reference-impls.js. We namespace under a different global slot so
// there's no collision with the world/spawn stream.
function nextSceneId() {
  if (!globalThis.__motoi_scene_spawn_id__) {
    globalThis.__motoi_scene_spawn_id__ = 0
  }
  return ++globalThis.__motoi_scene_spawn_id__
}

// A scene-spec is an opaque record that scene/load can consume. We use
// a plain object with a discriminator so consumers can tell it apart
// from a bare records list.
export function makeSceneSpec(options, actions) {
  return {
    kind: 'scene-spec',
    options,
    actions,
  }
}

function isSceneSpec(x) {
  return x && typeof x === 'object' && x.kind === 'scene-spec'
}

// Parse (scene/imagine :kw val ...body) — reference syntax. `:` in symbol
// name marks a keyword. Anything not preceded by a `:kw` is an action.
function parseImagineArgs(args) {
  const options = {}
  const actions = []
  let i = 0
  while (i < args.length) {
    const a = args[i]
    const name = a instanceof Sym ? a.name : null
    if (name && name.startsWith(':')) {
      // keyword; consume next as its value
      if (i + 1 >= args.length) break
      options[name.slice(1)] = args[i + 1]
      i += 2
    } else {
      actions.push(a)
      i += 1
    }
  }
  return { options, actions }
}

// Spawn one entity into game.entities and return the id. Used by grid,
// spawn-many, and load. `name` is the prefab kind (a Sym); position is
// (x, y). Size defaults to 16×16 like entity/make. The entity gets a
// tag equal to the prefab kind so scene queries can find it later.
function spawnOne(game, name, x, y) {
  const kind = String(nm(name))
  const id = `scene-${kind}-${nextSceneId()}`
  // BUG-1 unification (Zane-2, 2026-07-17): tags stored as Set so this
  // matches entity/spawn + entity/make (already normalized). Downstream
  // tag verbs live-normalize regardless, but keeping the shape consistent
  // avoids the one-shot upgrade cost on every scene entity.
  game.entities.set(id, {
    id,
    x: num(x),
    y: num(y),
    vx: 0,
    vy: 0,
    w: 16,
    h: 16,
    tags: new Set([kind]),
    static: false,
  })
  return id
}

// ── verb impls ─────────────────────────────────────────────────────────

// (scene/clear) — empty the entity table. Returns #t per spec.
// Spec says "does not affect running animations, timers, or the visual
// surface itself—only the entity layer." We honor that: no other state
// touched.
export function sceneClear(game) {
  game.entities.clear()
  return true
}

// (scene/grid name cols rows dx dy x0 y0) — cols × rows grid.
// Reference confirms row-major (columns iterate fastest, then rows).
// Returns a flat list of ids.
export function sceneGrid(game, name, cols, rows, dx, dy, x0, y0) {
  const nCols = num(cols) | 0
  const nRows = num(rows) | 0
  const stepX = num(dx)
  const stepY = num(dy)
  const oX = num(x0)
  const oY = num(y0)
  const ids = []
  for (let j = 0; j < nRows; j++) {
    for (let i = 0; i < nCols; i++) {
      ids.push(spawnOne(game, name, oX + i * stepX, oY + j * stepY))
    }
  }
  return ids
}

// (scene/spawn-many name points) — points is a list of [x y] pairs.
// Malformed points are silently skipped per spec.
export function sceneSpawnMany(game, name, points) {
  if (!Array.isArray(points)) return []
  const ids = []
  for (const p of points) {
    if (!Array.isArray(p) || p.length < 2) continue
    ids.push(spawnOne(game, name, p[0], p[1]))
  }
  return ids
}

// (scene/imagine :kw val ...actions) — pure; returns a scene-spec.
export function sceneImagine(...args) {
  const { options, actions } = parseImagineArgs(args)
  return makeSceneSpec(options, actions)
}

// (scene/load records-or-spec) — records is either a scene-spec or a
// list of (name x y) triples. Returns list of ids.
export function sceneLoad(game, arg) {
  const ids = []
  if (isSceneSpec(arg)) {
    // The spec's actions are (name x y) triples same as records.
    for (const r of arg.actions) {
      if (Array.isArray(r) && r.length >= 3) {
        ids.push(spawnOne(game, r[0], r[1], r[2]))
      }
    }
    return ids
  }
  if (Array.isArray(arg)) {
    for (const r of arg) {
      if (Array.isArray(r) && r.length >= 3) {
        ids.push(spawnOne(game, r[0], r[1], r[2]))
      }
    }
    return ids
  }
  return ids
}

// ── install into env ───────────────────────────────────────────────────

export function installScene(env, game) {
  const def = (n, f, perm) => env.define(n, f, { perm })

  def('scene/clear',      () => sceneClear(game),                            'state-change')
  def('scene/grid',       (name, cols, rows, dx, dy, x0, y0) =>
                              sceneGrid(game, name, cols, rows, dx, dy, x0, y0),  'state-change')
  def('scene/spawn-many', (name, points) => sceneSpawnMany(game, name, points), 'state-change')
  def('scene/imagine',    (...args) => sceneImagine(...args),                    'read')
  def('scene/load',       (arg) => sceneLoad(game, arg),                         'state-change')

  return env
}

export default installScene
