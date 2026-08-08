// world.js — the retained-mode game engine (Layer 3.5).
//
// Provenance: rebuilt 2026-07-25 to replace the Curator game-object client
// stubs ripped in the surgery (core/index.js, 2026-07-25). Those stubs were
// thin RPC shells whose real bodies lived in Curator's browser host. This
// file is the REAL thing — a small, headless, deterministic retained-mode
// world that runs with no host in sight. The Book of Arcade Games (ch08+)
// is written against this surface.
//
// The model:
//   · A world holds a flat list of entities. Each entity is a record with
//     position, velocity, size, a `kind` symbol, and physics flags.
//   · One fixed-timestep integrator (world/step): gravity → velocity →
//     position → floor clamp → solid AABB resolution → collision record.
//   · Dynamic vs static: the 'player archetype is dynamic by default; grid
//     tiles and other spawned kinds are static until made dynamic via a
//     positive gravity-scale (or a non-zero velocity). This is the signal
//     the book relies on — a player falls, the ground it stands on does not,
//     and neither had to be marked by hand.
//   · Paint verbs (paint-cell / paint-text) draw world-space rectangles into
//     the shared framebuffer, offset by the camera. Headless (no set-mode)
//     they are safe no-ops that still record a trace.
//   · big-bang runs the game: call the setup proc, then drive the registered
//     on-frame handler. Headless it runs a bounded number of frames and
//     returns a trace; a live driver (the TUI Game composer) can attach and
//     step it one real frame at a time instead.
//
// Kid-readable: this is the "make a whole game" part. Spawn things, give the
// world gravity, say what happens each frame, and press big-bang.

import { Sym, sym } from '../../src/reader.js'
import { apply } from '../../src/interp.js'
import { getMediaState } from '../media/media.js'
// The single input store. system.js does not import world.js, so this is
// one-directional — no cycle.
import { __peekSystemState } from '../system/system.js'

import { isNull, seqVerb } from '../base/list.js'
const nm = (x) => (x instanceof Sym ? x.name : (x == null ? x : String(x)))
// The one answer for "that handle names no live entity". Interned once so
// every verb in this file returns the SAME symbol object and `eq?` — which is
// what the reference's own guards use — works on it.
const NOT_FOUND = sym('entity-not-found')
const truthy = (x) => x !== false && x !== undefined && x !== null

// ── the live world ────────────────────────────────────────────────────
// One module-level world. world/reset! rebuilds it. This mirrors how the
// framebuffer + media state are single live objects the verbs mutate.
function freshWorld() {
  return {
    entities: [],
    nextId: 1,
    gravity: { x: 0, y: 0 },
    floor: null,
    frameNo: 0,
    onFrame: null,
    collisions: [],
    onCollision: null,   // single-slot handler, fired per overlapping pair
    friction: null,      // world-wide velocity multiplier; null = none
    layers: null,
    camera: { x: 0, y: 0, follow: null, lag: 0.1, dzw: 0, dzh: 0,
              bounds: null, shake: 0, shakeAmp: 0, pan: null },
    scheduled: [],   // (framesLeft, proc) from world/after
    tape: null,      // { recording, frames: [...] }
    driven: false,   // true when a live driver (TUI) owns the frame clock
    running: true,   // loop lifecycle: #t = ticking, #f = stopped (world/stop)
  }
}
let W = freshWorld()

// Input state — the driver (TUI) writes here each frame from real key state.
// 2026-08-01: this used to be a module-local store read by world-local
// input/down? / input/pressed? defs that shadowed lib/system/system.js. It
// now writes THROUGH to the one system store that input/set! also writes and
// input/down? reads, so a live driver and a scripted input/set! can never
// disagree. Unknown button names are ignored by the system store, matching
// the reference caveat ("invalid button names are silently ignored").
export function setInput({ down, pressed } = {}) {
  const state = __peekSystemState()
  const held = new Set((down || []).map(nm))
  const edges = new Set((pressed || []).map(nm))
  for (const b of state.held.keys()) state.held.set(b, held.has(b))
  for (const b of state.pressed.keys()) state.pressed.set(b, edges.has(b))
}
export function getWorld() { return W }

// Invoke a Scheme closure OR a native fn with a fresh fuel budget, so a
// long game loop never drains the caller's budget and one frame can't wedge
// the whole run.
function callProc(fn, args) {
  if (typeof fn === 'function') return fn(...args)
  if (fn && fn.params) return apply(fn, args, { n: 2_000_000 })
  return undefined
}

// Speed below which an entity counts as settled. The reference
// (42-motion.slat) states this threshold as 0.01, so it is fixed here
// rather than tunable — the manual is the authority.
const SETTLE_EPSILON = 0.01

// Resolve a target NAME (Sym or string) to a live entity. motion/on-settle
// takes an entity by name, but every other entity verb takes the handle, so
// this is the one place the name→handle lookup lives. First live match wins.
export function findEntityByName(name) {
  const want = nm(name)
  return W.entities.find((e) => e.alive && e.kind === want) || null
}

// ── the one entity resolver ─────────────────────────────────────────────
//
// The reference (scheme/reference/24-entity.slat) addresses entities BY ID.
// Every reader and mutator in that chapter is signed `(entity/... id ...)`,
// and the records that spell the contract out agree:
//
//   entity/make    :contract "id is symbol or string, x/y/w/h are numbers
//                             → the entity's id as a string"
//   entity/remove! :contract "id is symbol or string → #t if removed, #f if
//                             id was not present"
//   entity/state   :contract "id is symbol or string → (id x y vx vy w h) …"
//   entity/all     :contract "→ list of entity ids (strings)"
//
// The engine had THREE resolvers and none of them accepted a symbol:
//   · `ent`           — record only (≈33 reader/mutator call sites)
//   · `resolve`       — record or NUMERIC id
//   · `resolveTarget` — record, tween, or kind-name
// So `(entity/pos 'bullseye)` answered `(0 0)` for an entity standing at
// (320, 240), `(entity/alive? 'bullseye)` answered `#f` for a live one, and
// `(entity/remove! 'p1)` removed nothing and reported `#f`. Answer-shaped,
// wrong, never an error — exactly the class of defect the reference exists to
// settle. Reference wins.
//
// One resolver, accepting every spelling the chapter uses:
//   · the record itself                  — the handle world/spawn returns
//   · a symbol or string id              — the name entity/make stamped
//   · a kind name                        — what findEntityByName matched
//   · an integer id, or its string form  — what entity/id reads back and what
//                                          entity/all reports for an anonymous
//                                          spawn
// Live entities win over despawned ones, so `entity/alive?` can still answer
// honestly about a body that is present but dead.
export function resolveEntity(e) {
  if (e === null || e === undefined) return null
  // A handle. Sym is an object too, so it has to be excluded by name here.
  if (typeof e === 'object' && !(e instanceof Sym) && '_id' in e) return e
  if (typeof e === 'number') return W.entities.find((x) => x._id === e) || null
  // Sym, JS string, or MStr (which extends String, so nm() reads its text).
  const want = nm(e)
  if (want == null || want === '') return null
  const named = W.entities.find((x) => x.name === want && x.alive) ||
                W.entities.find((x) => x.name === want)
  if (named) return named
  const byKind = findEntityByName(want) ||
                 W.entities.find((x) => x.kind === want)
  if (byKind) return byKind
  if (/^-?\d+$/.test(want)) return W.entities.find((x) => x._id === Number(want)) || null
  return null
}

// The id the reference reports for an entity: the stamped name when it has
// one (entity/make), otherwise the integer id as a string (entity/spawn).
// `entity/all` is contracted to return these.
function entityIdString(e) {
  return e.name == null ? String(e._id) : e.name
}

// AABB overlap — strict (touching edges is not a collision).
function overlap(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w &&
         a.y < b.y + b.h && b.y < a.y + a.h
}

function makeEntity(kind, x, y) {
  const kindName = nm(kind)
  return {
    _id: W.nextId++,
    kind: kindName,
    // The id the reference addresses this entity by. entity/make stamps it
    // (":contract \"id is symbol or string\"" — 24-entity.slat); the anonymous
    // spawn family leaves it null and is addressed by its integer _id instead.
    name: null,
    x: Number(x) || 0,
    y: Number(y) || 0,
    w: 16, h: 16,
    vx: 0, vy: 0,
    shape: 'rect',
    solid: false,
    sensor: false,
    // The player archetype is dynamic by default; everything else is static
    // world geometry until made dynamic. See header note.
    dynamic: kindName === 'player',
    gscale: 1,
    mass: 1,
    bounce: 0,
    friction: 0,
    drag: 0,
    maxSpeed: null,
    hp: 1,
    alive: true,
    layer: null,
    team: null,
    tags: new Set(),
    scratch: new Map(),
  }
}

// ── color assignment for paint-cell ─────────────────────────────────────
const TAG_COLOR = new Map([
  ['ground', 4], ['wall', 5], ['floor', 5], ['brick', 4],
  ['player', 8], ['hero', 8], ['p1', 8], ['p2', 12],
  ['goal', 11], ['exit', 11], ['door', 11],
  ['coin', 10], ['gem', 10], ['star', 10], ['pickup', 10], ['powerup', 14],
  ['enemy', 8], ['boss', 2], ['bullet', 7], ['shot', 7], ['spike', 6],
  ['sky', 12], ['cloud', 6], ['platform', 4],
])
let _nextTagColor = 8
function colorForTag(tag) {
  const t = nm(tag)
  if (TAG_COLOR.has(t)) return TAG_COLOR.get(t)
  const c = _nextTagColor
  _nextTagColor = (_nextTagColor >= 15) ? 8 : _nextTagColor + 1
  TAG_COLOR.set(t, c)
  return c
}

// ── inline registration metadata ────────────────────────────────────────
export const VERBS = [
  'world/reset!', 'world/spawn', 'world/each', 'world/step', 'world/gravity!',
  'world/floor!', 'world/frame', 'world/collisions', 'world/count', 'world/find',
  'world/hash', 'world/after', 'world/attract!',
  'world/running?', 'world/stop', 'world/start', 'world/state',
  'world/camera-follow!', 'world/camera-bounds!', 'world/camera-shake!',
  'world/camera-snap!', 'world/camera-pan-to', 'world/camera',
  'world/tape-record!', 'world/tape-stop!', 'world/tape-replay',
  'world/tape-save', 'world/tape-hash', 'world/tape-frames',
  'entity/x', 'entity/y', 'entity/vel', 'entity/kind', 'entity/all',
  'entity/shape!', 'entity/solid!', 'entity/sensor!', 'entity/gravity-scale!',
  'entity/move!', 'entity/set-vel!', 'entity/set-pos!', 'entity/make',
  'entity/spawn', 'entity/hp', 'entity/hp!', 'entity/despawn!', 'entity/max-speed!',
  'entity/layer!', 'entity/bounce!', 'entity/mass!', 'entity/friction!',
  'entity/drag!', 'entity/distance', 'entity/alive?', 'entity/damage!',
  'entity/team', 'entity/id', 'entity/untag!', 'entity/remove!', 'entity/ref',
  'entity/set!', 'entity/state', 'entity/tag!',
  'scene/grid', 'paint-clear', 'paint-cell', 'paint-text',
  // input/down? + input/pressed? removed from this list 2026-08-01: this part
  // no longer defines them (they belong to lib/system/system.js, which is
  // where input/set! writes). Claiming them here made the parts registry
  // report a provider that was shadowing rather than owning.
  'collision/define-layers!',
  'big-bang', 'on-frame', 'on-collision',
  // The kid-facing vocabulary over the same integrator — see the block
  // above installWorld's physics/* section for why these live here.
  'physics/step', 'physics/gravity!', 'physics/gravity',
  'physics/friction!', 'physics/friction',
  'physics/apply-force', 'physics/apply-gravity', 'physics/apply-impulse',
  'entity/set-velocity!', 'entity/move', 'entity/collides?', 'entity/static?',
]
export const LAZY = false

export function installWorld(env, fuel) {
  // A new environment is a new world. W is module-global (the integrator
  // and the entity store are process state), so without this two programs
  // in one process inherit each other's entities — which showed up as a
  // collision handler firing for a leftover entity from an earlier run.
  W = freshWorld()

  const def = (n, f, perm = 'state-change', doc = '') =>
    env.define(n, seqVerb(f), { perm, doc, namespace: n.split('/')[0] })

  // ── world lifecycle ───────────────────────────────────────────────────

  def('world/reset!', () => { W = freshWorld(); return undefined })

  // (world/spawn kind x y) → entity handle. The handle is the record
  // itself; entity/* verbs read and mutate it, and eq? gives identity.
  def('world/spawn', (kind, x, y) => {
    const e = makeEntity(kind, x, y)
    W.entities.push(e)
    return e
  })

  // (entity/make id x y [w h]) → the id, as a string.
  //
  // NOT an alias of entity/spawn — the reference draws the line itself
  // (24-entity.slat, entity/make :meta): "world/spawn is anonymous;
  // entity/make is named." Three things it locks that this def used to get
  // wrong, all of them silently:
  //   · :signature "(entity/make id x y [w h]) -> string" and :doc "Returns
  //     the id as a string so it can be chained into further entity/* calls."
  //     It returned the raw record, which printed as `[object Object]`.
  //   · The first argument is an ID, not a kind. It is stamped on the entity
  //     so every entity/* verb can address the body by that name.
  //   · Upsert, last-write-wins. :row-4-proof :invariant
  //     "∀ id args1 args2. count-after(make(id, args1); make(id, args2)) = 1",
  //     and the cs-program asserts `(equal? (entity/pos 'twin) '(100 100))`
  //     after making 'twin twice. It pushed a second body instead, so count
  //     grew by 2 and the FIRST 'twin was what any lookup found.
  // `kind` keeps mirroring the id, which is what entity/kind, the tag colours
  // and findEntityByName have always read for a made entity.
  def('entity/make', (id, x, y, w, h) => {
    const key = nm(id)
    const e = makeEntity(id, x, y)
    e.name = key == null ? null : String(key)
    if (w !== undefined) e.w = Number(w) || e.w
    if (h !== undefined) e.h = Number(h) || e.h
    const prior = W.entities.findIndex((o) => o.name !== null && o.name === e.name)
    if (prior >= 0) W.entities.splice(prior, 1)
    W.entities.push(e)
    return entityIdString(e)
  })
  def('entity/spawn', (kind, x, y) => {
    const e = makeEntity(kind, x, y)
    W.entities.push(e)
    return e
  })

  // (scene/grid tag cols rows cell-w cell-h origin-x origin-y) — spawn a
  // cols×rows grid of static tiles tagged `tag`, laid out from (ox, oy).
  def('scene/grid', (tag, cols, rows, cw, ch, ox = 0, oy = 0) => {
    const t = nm(tag)
    const C = cols | 0, R = rows | 0
    const W_ = Number(cw) || 16, H_ = Number(ch) || 16
    const OX = Number(ox) || 0, OY = Number(oy) || 0
    const made = []
    for (let r = 0; r < R; r++) {
      for (let c = 0; c < C; c++) {
        const e = makeEntity(t, OX + c * W_, OY + r * H_)
        e.w = W_; e.h = H_
        e.dynamic = false          // tiles are static world geometry
        W.entities.push(e)
        made.push(e)
      }
    }
    return made
  })

  // (world/each tag proc) — call proc on each alive entity whose kind or
  // tag matches. proc receives the entity handle.
  def('world/each', (tag, proc) => {
    const t = nm(tag)
    for (const e of W.entities.slice()) {
      if (!e.alive) continue
      if (e.kind === t || e.tags.has(t)) callProc(proc, [e])
    }
    return undefined
  }, 'read')

  def('world/count', (tag) => {
    if (tag === undefined) return W.entities.filter((e) => e.alive).length
    const t = nm(tag)
    return W.entities.filter((e) => e.alive && (e.kind === t || e.tags.has(t))).length
  }, 'read')

  // (world/find tag) → list of matching handles; (world/find pred) → filter.
  def('world/find', (sel) => {
    if (typeof sel === 'function' || (sel && sel.params)) {
      return W.entities.filter((e) => e.alive && truthy(callProc(sel, [e])))
    }
    const t = nm(sel)
    return W.entities.filter((e) => e.alive && (e.kind === t || e.tags.has(t)))
  }, 'read')

  def('world/gravity!', (gx, gy) => {
    W.gravity = { x: Number(gx) || 0, y: Number(gy) || 0 }
    return undefined
  })

  def('world/floor!', (y) => { W.floor = Number(y); return undefined })

  def('world/frame', () => W.frameNo, 'read')

  // (world/after n proc) — run proc after n frames.
  def('world/after', (n, proc) => {
    W.scheduled.push({ left: (n | 0), proc })
    return undefined
  })

  // ── the integrator ───────────────────────────────────────────────────
  //
  // (world/step) — advance one fixed frame: gravity, integrate, floor,
  // resolve solids, record every overlapping pair (solid OR sensor) so a
  // win-check can read (world/collisions).
  def('world/step', () => {
    W.frameNo += 1

    // Snapshot speeds before integrating: "settled" means the entity WAS
    // moving and now is not, so the comparison needs the pre-step value.
    // Reading it after friction has already zeroed the velocity is how the
    // first attempt at this silently never fired.
    const preSpeed = new Map()
    for (const e of W.entities) preSpeed.set(e, Math.hypot(e.vx, e.vy))

    // 1. gravity + integrate dynamic bodies.
    for (const e of W.entities) {
      if (!e.alive || !e.dynamic) continue
      e.vx += W.gravity.x * e.gscale
      e.vy += W.gravity.y * e.gscale
      if (e.drag) { e.vx *= (1 - e.drag); e.vy *= (1 - e.drag) }
      // World-level friction from (physics/friction! f): a velocity
      // multiplier applied to every dynamic body. Per-entity drag still
      // stacks on top for a body that needs to be stickier than the world.
      if (W.friction != null) { e.vx *= W.friction; e.vy *= W.friction }
      if (e.maxSpeed != null) {
        const sp = Math.hypot(e.vx, e.vy)
        if (sp > e.maxSpeed && sp > 0) {
          const k = e.maxSpeed / sp
          e.vx *= k; e.vy *= k
        }
      }
      e.x += e.vx
      e.y += e.vy
    }

    // 1b. spin tween (visual pose only; AABB collision is unrotated).
    for (const e of W.entities) {
      if (!e.alive || !e.spinFrames) continue
      e.spin = (e.spin || 0) + e.spinRate
      e.spinFrames -= 1
      if (e.spinFrames <= 0) { e.spinFrames = 0; e.spinRate = 0 }
    }

    // 2. floor clamp.
    if (W.floor != null) {
      for (const e of W.entities) {
        if (!e.alive || !e.dynamic) continue
        if (e.y + e.h > W.floor && e.vy > 0) {
          e.y = W.floor - e.h
          e.vy = e.bounce > 0 ? -e.vy * e.bounce : 0
        }
      }
    }

    // 3. resolve solid–solid overlaps. Only push movable (dynamic, non-heavy)
    //    bodies; a heavy or static body holds its ground.
    const solids = W.entities.filter((e) => e.alive && e.solid && !e.sensor)
    for (let i = 0; i < solids.length; i++) {
      for (let j = i + 1; j < solids.length; j++) {
        const a = solids[i], b = solids[j]
        if (!overlap(a, b)) continue
        resolvePair(a, b)
      }
    }

    // 4. record every overlapping pair (solid + sensor both count).
    const alive = W.entities.filter((e) => e.alive)
    const pairs = []
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const a = alive[i], b = alive[j]
        if (a.kind === b.kind && !a.sensor && !b.sensor) {
          // Skip same-kind tile/tile pairs — huge and never interesting.
          if (!a.dynamic && !b.dynamic) continue
        }
        if (overlap(a, b)) pairs.push([a, b])
      }
    }
    W.collisions = pairs

    // 4b. fire the on-collision handler once per overlapping pair. The
    //     reference (28-game.slat) specifies the handler receives the two
    //     kinds as Syms and that pair order is unspecified, so a handler
    //     must treat (a b) and (b a) alike.
    if (W.onCollision) {
      for (const [a, b] of pairs) callProc(W.onCollision, [sym(a.kind), sym(b.kind)])
    }

    // 4c. settle detection for motion/on-settle's entity form. Fires the
    //     first frame an entity's speed drops below the threshold after
    //     having been above it — so a body that never moved never "settles",
    //     and one parked by the floor or a solid does. Runs after collision
    //     resolution because that is what zeroes the velocity.
    for (const e of W.entities) {
      if (!e.alive || !e._onSettle) continue
      const pre = preSpeed.get(e) || 0
      const post = Math.hypot(e.vx, e.vy)
      if (pre > SETTLE_EPSILON && post <= SETTLE_EPSILON) {
        const cb = e._onSettle
        e._onSettle = null      // fires exactly once per registration
        callProc(cb, [sym(e.kind)])
      }
    }

    // 5. fire scheduled callbacks.
    if (W.scheduled.length) {
      const due = []
      W.scheduled = W.scheduled.filter((s) => {
        s.left -= 1
        if (s.left <= 0) { due.push(s.proc); return false }
        return true
      })
      for (const p of due) callProc(p, [])
    }

    // 6. camera follow.
    stepCamera()

    // 7. tape record.
    if (W.tape && W.tape.recording) tapeCapture()
    return undefined
  })

  function resolvePair(a, b) {
    const aMov = a.dynamic && a.mass < 999
    const bMov = b.dynamic && b.mass < 999
    if (!aMov && !bMov) return
    // minimum translation vector on the axis of least penetration.
    const dx1 = (b.x + b.w) - a.x        // push a right
    const dx2 = (a.x + a.w) - b.x        // push a left
    const dy1 = (b.y + b.h) - a.y        // push a down
    const dy2 = (a.y + a.h) - b.y        // push a up
    const penX = Math.min(dx1, dx2)
    const penY = Math.min(dy1, dy2)
    if (penX < penY) {
      const sign = dx1 < dx2 ? 1 : -1    // move a by +sign, b by -sign
      applyPush(a, b, aMov, bMov, penX * sign, 0, 'x')
    } else {
      const sign = dy1 < dy2 ? 1 : -1
      applyPush(a, b, aMov, bMov, 0, penY * sign, 'y')
    }
  }
  function applyPush(a, b, aMov, bMov, dx, dy, axis) {
    if (aMov && bMov) {
      a.x += dx / 2; a.y += dy / 2
      b.x -= dx / 2; b.y -= dy / 2
    } else if (aMov) {
      a.x += dx; a.y += dy
    } else {
      b.x -= dx; b.y -= dy
    }
    // zero the velocity of a movable body on the resolved axis.
    if (axis === 'x') { if (aMov) a.vx = 0; if (bMov) b.vx = 0 }
    else { if (aMov) a.vy = 0; if (bMov) b.vy = 0 }
  }

  def('world/collisions', () => W.collisions.slice(), 'read')

  // ── the physics/* surface ─────────────────────────────────────────────
  //
  // These names are what the manual reaches for: 28-game.slat and
  // 42-motion.slat both define on-collision and motion/on-settle in terms
  // of "fires from within physics/step". They were implemented in
  // lib/game/game.js against a SECOND entity store, and went unbound when
  // that installer was dropped in the 2026-07-25 Curator rip — so the
  // manual described a runtime the language no longer had.
  //
  // They are bound here, over the one live store, as the kid-facing names
  // for the world/* engine: `(physics/gravity! 1)` reads to an eleven-year-
  // old in a way `(world/gravity! 0 1)` does not. Same integrator either
  // way — these are a vocabulary, not a second physics.

  // Targets arrive as a handle (every entity/* verb), a name (the physics/*
  // verbs in game.js took names), or a tween record (a heart can fall too).
  // A tween is not an entity, so it is checked first; everything else goes
  // through the one entity resolver (which already accepts the handle, the
  // stamped id, the kind name, and the integer id).
  const resolveTarget = (t) => {
    if (t && typeof t === 'object' && !(t instanceof Sym) &&
        typeof t.durationFrames === 'number') return t     // tween
    return resolveEntity(t)
  }
  const isTween = (t) => t && typeof t === 'object' && typeof t.durationFrames === 'number'

  def('physics/step', () => env.get('world/step')())

  // Gravity is a scalar here — straight down, the only direction a learner
  // means by "gravity". The vector form stays available as world/gravity!.
  def('physics/gravity!', (g) => { W.gravity = { x: 0, y: Number(g) || 0 }; return undefined })
  def('physics/gravity', () => W.gravity.y, 'read')

  // Friction is a per-frame velocity multiplier: 1.0 = none, 0.98 = slow
  // decay, 0.0 = instant stop. Matches the game.js semantics the reference
  // was written against.
  def('physics/friction!', (f) => {
    const v = Number(f)
    W.friction = Number.isFinite(v) ? v : 0.98
    return undefined
  })
  def('physics/friction', () => (W.friction == null ? 1 : W.friction), 'read')

  def('physics/apply-force', (target, fx, fy) => {
    const dx = Number(fx) || 0
    const dy = Number(fy) || 0
    const t = resolveTarget(target)
    if (!t) return false
    if (isTween(t)) { t.fromX += dx; t.toX += dx; t.fromY += dy; t.toY += dy; return true }
    t.vx += dx; t.vy += dy
    if (t.vx || t.vy) t.dynamic = true
    return true
  })

  def('physics/apply-gravity', (target, g) => {
    const acc = (g === undefined ? W.gravity.y : Number(g)) || 0
    const t = resolveTarget(target)
    if (!t) return false
    if (isTween(t)) { t.toY += acc; t.fromY += acc * 0.5; return true }
    t.vy += acc
    t.dynamic = true
    return true
  })

  // A synonym for apply-force, kept because "impulse" reads better in some
  // scripts. The tween form scales up — a nudge should be visible.
  def('physics/apply-impulse', (target, dvx, dvy) => {
    const t = resolveTarget(target)
    if (!t) return false
    if (isTween(t)) {
      t.toX += (Number(dvx) || 0) * 5
      t.toY += (Number(dvy) || 0) * 5
      return true
    }
    t.vx += Number(dvx) || 0
    t.vy += Number(dvy) || 0
    if (t.vx || t.vy) t.dynamic = true
    return true
  })

  // Name-or-handle variants of the entity verbs the physics/* vocabulary
  // pairs with. entity/set-vel! and entity/move! (handle-only) stay as they
  // are; these accept either, because a learner following the game chapter
  // has a name in hand, not a handle.
  def('entity/set-velocity!', (target, vx, vy) => {
    const e = resolveTarget(target)
    if (!e || isTween(e)) return false
    e.vx = Number(vx) || 0
    e.vy = Number(vy) || 0
    if (e.vx || e.vy) e.dynamic = true
    return true
  })
  def('entity/move', (target, dx, dy) => {
    const e = resolveTarget(target)
    if (!e || isTween(e)) return false
    e.dynamic = true
    e.x += Number(dx) || 0
    e.y += Number(dy) || 0
    return true
  })
  def('entity/collides?', (a, b) => {
    const ea = resolveTarget(a), eb = resolveTarget(b)
    if (!ea || !eb || isTween(ea) || isTween(eb)) return false
    return overlap(ea, eb)
  }, 'read')
  def('entity/static?', (target) => {
    const e = resolveTarget(target)
    return !!e && !isTween(e) && !e.dynamic
  }, 'read')

  // (on-collision handler | #f) — install the per-step collision callback.
  //
  // Documented in Scheme/reference/28-game.slat and implemented in
  // lib/game/game.js, but that installer was dropped from installCore in the
  // 2026-07-25 Curator rip, leaving the verb unbound while the manual still
  // promised it. It is bound HERE rather than by re-installing game.js
  // because game.js keeps a second, id-keyed entity store that nothing
  // populates any more — two stores is what silently broke motion/on-settle.
  // One store, one owner.
  def('on-collision', (handler) => {
    if (handler === false || handler == null) { W.onCollision = null; return undefined }
    W.onCollision = handler
    return undefined
  })

  // (world/hash) — a cheap deterministic signature of world state, for
  // replay/attract verification. Sum of quantized entity fields.
  def('world/hash', () => {
    let h = 2166136261 >>> 0
    for (const e of W.entities) {
      const s = `${e.kind}:${Math.round(e.x)}:${Math.round(e.y)}:${e.alive ? 1 : 0}`
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0
      }
    }
    return h
  }, 'read')

  // ── camera ────────────────────────────────────────────────────────────
  function stepCamera() {
    const cam = W.camera
    if (cam.follow && cam.follow.alive) {
      const st = getMediaState()
      const vw = st && st.fb ? st.fb.w : 128
      const vh = st && st.fb ? st.fb.h : 128
      const tx = cam.follow.x + cam.follow.w / 2 - vw / 2
      const ty = cam.follow.y + cam.follow.h / 2 - vh / 2
      // deadzone: only move when the target left the box.
      if (Math.abs(tx - cam.x) > cam.dzw) cam.x += (tx - cam.x) * cam.lag
      if (Math.abs(ty - cam.y) > cam.dzh) cam.y += (ty - cam.y) * cam.lag
    }
    if (cam.bounds) {
      const st = getMediaState()
      const vw = st && st.fb ? st.fb.w : 128
      const vh = st && st.fb ? st.fb.h : 128
      cam.x = Math.max(cam.bounds.x, Math.min(cam.x, cam.bounds.x + cam.bounds.w - vw))
      cam.y = Math.max(cam.bounds.y, Math.min(cam.y, cam.bounds.y + cam.bounds.h - vh))
    }
    if (cam.shake > 0) cam.shake -= 1
  }

  def('world/camera-follow!', (e, lag = 0.1, dzw = 0, dzh = 0) => {
    W.camera.follow = e
    W.camera.lag = Number(lag) || 0.1
    W.camera.dzw = Number(dzw) || 0
    W.camera.dzh = Number(dzh) || 0
    return undefined
  })
  def('world/camera-bounds!', (x, y, w, h) => {
    W.camera.bounds = { x: Number(x) || 0, y: Number(y) || 0,
                        w: Number(w) || 0, h: Number(h) || 0 }
    return undefined
  })
  def('world/camera-shake!', (amp = 4, dur = 12) => {
    W.camera.shake = dur | 0
    W.camera.shakeAmp = Number(amp) || 0
    return undefined
  })
  def('world/camera-snap!', (x, y) => {
    W.camera.x = Number(x) || 0
    W.camera.y = Number(y) || 0
    return undefined
  })
  def('world/camera-pan-to', (x, y) => {
    W.camera.x = Number(x) || 0
    W.camera.y = Number(y) || 0
    return undefined
  })
  def('world/camera', () => [W.camera.x, W.camera.y], 'read')

  // ── tape (record / replay / attract mode) ─────────────────────────────
  // Capture one frame of the current world into the tape. The reference
  // (72-world.slat, world/tape-save :explanation) fixes the recorded shape:
  // a frame is (frame-number cam-x cam-y hash (entity-list) local-camera) and
  // an entity record is (id kind sprite x y state). We store plain JS data
  // here (no Sym objects) so world/tape-hash can still JSON.stringify frames;
  // world/tape-save is what converts to the documented Scheme list.
  function tapeCapture () {
    if (!W.tape) return
    const ents = W.entities.map((e) => ({
      id: e._id,
      kind: e.kind,
      // sprite and state are optional per-entity slots; the reference's
      // missing-field convention for tape data is the symbol 'none, not null.
      sprite: e.scratch && e.scratch.has('sprite') ? e.scratch.get('sprite') : null,
      x: e.x,
      y: e.y,
      state: e.scratch && e.scratch.has('state') ? e.scratch.get('state') : null,
      // retained for collision/replay consumers of the raw buffer
      w: e.w, h: e.h, alive: e.alive,
    }))
    let h = 2166136261 >>> 0
    const s = JSON.stringify(ents)
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0 }
    W.tape.frames.push({
      n: W.frameNo | 0,
      camx: W.camera.x,
      camy: W.camera.y,
      hash: h,
      ents,
      lcam: [W.camera.x, W.camera.y, camK()],
    })
    // Rolling window: once the tape reaches `cap` frames, older frames roll off.
    const cap = W.tape.cap | 0
    if (cap > 0) while (W.tape.frames.length > cap) W.tape.frames.shift()
  }

  // Reference (world/tape-record!): "(world/tape-record! [cap]) -> #t",
  // "Arm the motion tape and capture the current world frame", "Always returns
  // `true`", "If `cap` argument is non-numeric or <= 0, capacity defaults to
  // unlimited". The old definition took no argument, captured no initial frame
  // and returned undefined; reference wins on all three.
  def('world/tape-record!', (cap) => {
    const c = Number(cap)
    W.tape = { recording: true, cap: (Number.isFinite(c) && c > 0) ? Math.floor(c) : 0, frames: [] }
    tapeCapture()
    return true
  })
  // Reference (world/tape-stop!): "-> number", "return the final frame count",
  // and a caveat that a repeat call "still returns the current frame count".
  // The old definition returned undefined.
  def('world/tape-stop!', () => { if (!W.tape) return 0; W.tape.recording = false; return W.tape.frames.length })
  def('world/tape-frames', () => (W.tape ? W.tape.frames.length : 0), 'read')
  def('world/tape-replay', () => (W.tape ? W.tape.frames.slice() : []), 'read')
  // Reference (world/tape-save): "-> (list) | '()", "Serialize the entire
  // motion tape into a portable, re-renderable list of frames". The old
  // definition returned the frame COUNT, so every documented (length saved)
  // use errored.
  def('world/tape-save', () => {
    if (!W.tape) return []
    const noneOr = (v) => (v == null ? sym('none') : (typeof v === 'string' ? sym(v) : v))
    return W.tape.frames.map((f) => [
      f.n, f.camx, f.camy, f.hash,
      f.ents.map((e) => [e.id, sym(e.kind), noneOr(e.sprite), e.x, e.y, noneOr(e.state)]),
      f.lcam ? f.lcam.slice() : sym('none'),
    ])
  })
  def('world/tape-hash', () => {
    let h = 2166136261 >>> 0
    const frames = W.tape ? W.tape.frames : []
    const s = JSON.stringify(frames)
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0 }
    return h
  }, 'read')

  def('world/attract!', (proc) => {
    // Attract mode: replay a recorded tape headless as a demo. We just run
    // the setup proc again (the caller usually feeds recorded input).
    if (proc) callProc(proc, [])
    return undefined
  })

  // ── entity readers ────────────────────────────────────────────────────
  // One resolver for the whole surface — see resolveEntity at the top of the
  // file for why there used to be three and what that cost.
  const ent = resolveEntity
  // CONTRACT fix (2026-08-04): every reader below answered a PLAUSIBLE value
  // on a miss — 0, 0, (0 0), and nothing at all — so a stale id, a despawned
  // body or a misspelled name read back as an entity at the origin, standing
  // still, with no kind. The reference states the miss answer for all four:
  //
  //   entity/x  :explanation "…returns the symbol 'entity-not-found rather
  //             than an error—a defensive pattern…"
  //   entity/y  :caveats "Returns 'entity-not-found if the id is invalid…"
  //   entity/kind :summary "…or 'entity-not-found if the id is unknown."
  //   entity/pos  :drawbacks "If the entity does not exist, returns
  //             'entity-not-found instead of a list."
  //
  // entity/vel is the one the reference does NOT state. It is corrected here
  // to match its four siblings rather than left as the only reader in the
  // family that lies, and the reference record now says so — flagged for
  // Alfred as an extension rather than a conformance fix.
  //
  // A symbol where a number was expected is loud: arithmetic on it raises at
  // the point of the mistake instead of propagating a wrong number. That is
  // the whole reason the reference chose it.
  def('entity/x', (e) => { const t = ent(e); return t ? t.x : NOT_FOUND }, 'read')
  def('entity/y', (e) => { const t = ent(e); return t ? t.y : NOT_FOUND }, 'read')
  def('entity/vel', (e) => { const t = ent(e); return t ? [t.vx, t.vy] : NOT_FOUND }, 'read')
  def('entity/kind', (e) => { const t = ent(e); return t ? sym(t.kind) : NOT_FOUND }, 'read')
  // (entity/all) → the ids, as strings. :contract "→ list of entity ids
  // (strings)"; :doc "Snapshot of game.entities.keys()"; the expert example
  // feeds each element straight to `string->symbol`. This returned the raw
  // entity RECORDS, so `(display (entity/all))` printed `([object Object])`
  // and every documented consumer of the list was wrong.
  def('entity/all', () => W.entities.filter((e) => e.alive).map(entityIdString), 'read')
  def('entity/count', (tag) => {
    const live = W.entities.filter((e) => e.alive)
    if (tag === undefined) return live.length
    const t = nm(tag)
    return live.filter((e) => e.kind === t || e.tags.has(t)).length
  }, 'read')
  def('entity/alive?', (e) => { const t = ent(e); return !!(t && t.alive) }, 'read')
  def('entity/id', (e) => { const t = ent(e); return t ? t._id : 0 }, 'read')
  def('entity/team', (e) => {
    const t = ent(e)
    return t ? (t.team == null ? undefined : sym(t.team)) : undefined
  }, 'read')
  def('entity/hp', (e) => { const t = ent(e); return t ? t.hp : 0 }, 'read')
  def('entity/distance', (a, b) => {
    const p = ent(a), q = ent(b)
    if (!p || !q) return Infinity
    const ax = p.x + p.w / 2, ay = p.y + p.h / 2
    const bx = q.x + q.w / 2, by = q.y + q.h / 2
    return Math.hypot(ax - bx, ay - by)
  }, 'read')
  def('entity/state', (e) => {
    const t = ent(e)
    return t ? [sym(t.kind), t.x, t.y, t.vx, t.vy, t.w, t.h] : undefined
  }, 'read')
  // CONFORMANCE fix (2026-08-01): the reference (Scheme/reference/24-entity.slat,
  // entity/ref) locks the signature as "(entity/ref id key) → value | 'nan" and
  // the caveat "Missing keys return 'nan (the symbol), not null or nil; always
  // check with eq? or compare to 'nan." This installer returned `undefined` for
  // both the missing-entity and missing-key cases, so `(eq? (entity/ref ...) 'nan)`
  // — the guard every reference example uses — was silently always #f. The
  // id-keyed twin in lib/game/game.js already returned NAN_SYM correctly, but
  // installGame stopped being called on 2026-07-25 and this weaker definition
  // became the only live one. Reference wins.
  const NAN_SYM = sym('nan')
  def('entity/ref', (e, key) => {
    const t = ent(e)
    if (!t) return NAN_SYM
    const k = nm(key)
    return t.scratch.has(k) ? t.scratch.get(k) : NAN_SYM
  }, 'read')

  // ── entity mutators ───────────────────────────────────────────────────
  def('entity/shape!', (e, shape, w, h) => {
    const t = ent(e)
    if (!t) return e
    t.shape = nm(shape) || 'rect'
    if (w !== undefined) t.w = Number(w) || t.w
    if (h !== undefined) t.h = Number(h) || t.h
    return t
  })
  def('entity/solid!', (e, on = true) => { const t = ent(e); if (!t) return e; t.solid = truthy(on); return t })
  // CONTRACT fix (2026-08-04). Reference signature: "(entity/sensor! id bool)
  // -> #t|'entity-not-found". This returned the ARGUMENT on a miss and the
  // entity record on success, so neither branch matched — and the miss branch
  // was the dangerous one, because handing back a truthy id makes a failed
  // call indistinguishable from a successful one. Same correction as
  // entity/set-vel! and entity/set-pos! below; entity/pose! and
  // entity/shape-flower! already did it this way.
  def('entity/sensor!', (e, on = true) => {
    const t = ent(e)
    if (!t) return NOT_FOUND
    t.sensor = truthy(on)
    return true
  })
  def('entity/gravity-scale!', (e, k) => {
    const t = ent(e)
    if (!t) return e
    t.gscale = Number(k) || 0
    if (t.gscale > 0) t.dynamic = true
    return t
  })
  def('entity/move!', (e, dx, dy) => {
    const t = ent(e)
    if (!t) return e
    t.dynamic = true
    t.x += Number(dx) || 0
    t.y += Number(dy) || 0
    return t
  })
  // Reference signature: "(entity/set-vel! id vx vy) -> #t|'entity-not-found".
  def('entity/set-vel!', (e, vx, vy) => {
    const t = ent(e)
    if (!t) return NOT_FOUND
    t.vx = Number(vx) || 0
    t.vy = Number(vy) || 0
    if (t.vx || t.vy) t.dynamic = true
    return true
  })
  // Reference signature: "(entity/set-pos! id x y) -> #t|'entity-not-found".
  def('entity/set-pos!', (e, x, y) => {
    const t = ent(e)
    if (!t) return NOT_FOUND
    t.x = Number(x) || 0
    t.y = Number(y) || 0
    return true
  })
  // Reference signature: "(entity/hp! id hp) → void" — so the SUCCESS value is
  // nothing, not the entity record this used to hand back. The reference says
  // nothing about the miss; returning the argument (what it did) is the one
  // answer that is definitely wrong, because a truthy id reads as success. The
  // signature is extended to "void | 'entity-not-found" in the reference to
  // record the miss, and flagged for Alfred.
  def('entity/hp!', (e, n) => {
    const t = ent(e)
    if (!t) return NOT_FOUND
    t.hp = Number(n) || 0
    return undefined
  })
  def('entity/damage!', (e, n) => {
    const t = ent(e)
    if (!t) return e
    t.hp -= Number(n) || 0
    if (t.hp <= 0) { t.hp = 0; t.alive = false }
    return t
  })
  def('entity/despawn!', (e) => { const t = ent(e); if (t) t.alive = false; return undefined })
  // (entity/remove! id) -> boolean. :contract "id is symbol or string → #t if
  // removed, #f if id was not present". It took a record ONLY, so the shape
  // every example uses — `(entity/remove! 'p1)`, and the sweep
  // `(for-each entity/remove! (entity/all))` — matched nothing, removed
  // nothing, and reported #f. Now it removes by id, as documented.
  def('entity/remove!', (e) => {
    const t = ent(e)
    if (!t) return false
    t.alive = false
    const i = W.entities.indexOf(t)
    if (i >= 0) W.entities.splice(i, 1)
    return true
  })
  def('entity/max-speed!', (e, s) => { const t = ent(e); if (!t) return e; t.maxSpeed = Number(s); return t })
  def('entity/bounce!', (e, b) => { const t = ent(e); if (!t) return e; t.bounce = Number(b) || 0; return t })
  def('entity/mass!', (e, m) => { const t = ent(e); if (!t) return e; t.mass = Number(m) || 1; return t })
  def('entity/friction!', (e, f) => { const t = ent(e); if (!t) return e; t.friction = Number(f) || 0; return t })
  def('entity/drag!', (e, d) => { const t = ent(e); if (!t) return e; t.drag = Number(d) || 0; return t })
  def('entity/layer!', (e, l) => { const t = ent(e); if (!t) return e; t.layer = nm(l); return t })
  def('entity/team', (e, t) => {
    // reader/setter overload: (entity/team e) reads, (entity/team e 'red) sets.
    const r = ent(e)
    if (!r) return undefined
    if (t === undefined) return r.team == null ? undefined : sym(r.team)
    r.team = nm(t)
    return r
  })
  // CONFORMANCE fix (2026-08-01): on an unknown entity this returned the
  // unresolved argument itself (e.g. `(entity/tag! 'ghost 'enemy)` → `ghost`),
  // a TRUTHY value reporting success for a no-op that tagged nothing. The
  // id-keyed twin in lib/game/game.js returns #f on the miss path; it stopped
  // being installed 2026-07-25. Only the miss path changes here — the success
  // return is left exactly as it was so no working caller shifts.
  def('entity/tag!', (e, t) => { const r = ent(e); if (!r) return false; r.tags.add(nm(t)); return r })
  def('entity/untag!', (e, t) => { const r = ent(e); if (!r) return e; r.tags.delete(nm(t)); return r })
  def('entity/set!', (e, key, val) => {
    const t = ent(e)
    if (t) t.scratch.set(nm(key), val)
    return val
  })

  // ── input ─────────────────────────────────────────────────────────────
  // SHADOW fix (2026-08-01): this installer used to re-`def` input/down? and
  // input/pressed? over the module-local INPUT store. installWorld runs at
  // core/index.js:407, AFTER installSystem at :341, so these overrode the
  // documented implementations in lib/system/system.js — the ones that
  // input/set! actually writes to. The result was a broken round-trip:
  // (input/set! 'left #t) wrote system state, (input/down? 'left) read the
  // world store, and the answer was permanently #f. Nothing ever wrote the
  // world store either — setInput() had zero callers in the whole tree, so
  // the override was a dead store shadowing a live one.
  //
  // The definitions now live in exactly one place (lib/system/system.js).
  // setInput() is kept as the TUI/driver hook but routes into that same single
  // store, so a driver and input/set! can no longer disagree.

  // ── collision layers ──────────────────────────────────────────────────
  // (collision/define-layers! spec) — record a layer interaction table.
  // Stored for the resolver to consult; the default resolver treats all
  // solids as colliding, so this is advisory metadata for now.
  def('collision/define-layers!', (spec) => { W.layers = spec; return undefined })

  // ── paint ─────────────────────────────────────────────────────────────
  def('paint-clear', (color) => {
    const st = getMediaState()
    if (st && st.fb) st.fb.clear(color === undefined ? 0 : (color | 0))
    return undefined
  }, 'paint')

  // (paint-cell tag x y w h) — draw a filled world-space cell, offset by the
  // camera. Headless (no framebuffer) it is a safe no-op.
  def('paint-cell', (tag, x, y, w = 16, h = 16) => {
    const st = getMediaState()
    if (!st || !st.fb) return undefined
    const sx = Math.round((Number(x) || 0) - W.camera.x)
    const sy = Math.round((Number(y) || 0) - W.camera.y)
    st.fb.rectFill(sx, sy, Number(w) || 16, Number(h) || 16, colorForTag(tag))
    return undefined
  }, 'paint')

  // (paint-text str x y [color]) — draw text at world coords, camera-offset.
  def('paint-text', (str, x, y, color) => {
    const st = getMediaState()
    if (!st || !st.fb) return undefined
    const sx = Math.round((Number(x) || 0) - W.camera.x)
    const sy = Math.round((Number(y) || 0) - W.camera.y)
    const fbText = env.vars.get('fb/text')
    if (typeof fbText === 'function') fbText(String(str), sx, sy, color)
    return undefined
  }, 'paint')

  // ── frame handler + big-bang ──────────────────────────────────────────
  // This file loads last, so this binding is the one `on-frame` resolves to.
  // It used to write W.onFrame ONLY, which big-bang reads and the media loop
  // does not — so `(on-frame f)` followed by `(tick-frame)` ran nothing and
  // the frame counter sat at 0. media.js and game.js both install into
  // media.events.frame; overriding them dropped that half on the floor.
  // Write both slots, the same way game.js bridges its own.
  def('on-frame', (fn) => {
    if (typeof fn !== 'function' && !(fn && fn.params)) {
      throw new Error('on-frame: handler must be a procedure')
    }
    W.onFrame = fn
    const st = getMediaState()
    if (st && st.events) {
      st.events.frame = [fn]
      if (st.loop && st.loop.ensureRunning) st.loop.ensureRunning()
    }
    return undefined
  })

  // (big-bang setup [frames]) — run the game. Call the setup proc (which
  // builds the world and registers on-frame), then drive frames. Headless,
  // run a bounded number and return a trace. A live TUI driver sets
  // W.driven=true (via the exported runtime) and steps frames itself.
  def('big-bang', (setup, frames) => {
    if (setup) callProc(setup, [])
    if (W.driven) return sym('driven')
    const N = frames === undefined ? 30 : (frames | 0)
    let painted = 0
    for (let i = 0; i < N; i++) {
      if (W.onFrame) callProc(W.onFrame, [])
      painted++
    }
    return [sym('frames'), painted]
  })

  // ── loop lifecycle (single-world model) ────────────────────────────────
  // The console runs one world. world/running? / world/stop / world/start
  // are the pause-resume lifecycle a fantasy console needs. The frame clock
  // (world/frame) is preserved across a stop — stopping never rewinds time.
  def('world/running?', () => W.running === true, 'read',
    'Returns #t while the world loop is live, #f after world/stop.')
  def('world/stop', () => { W.running = false; return undefined },
    'Halt the world loop. The frame counter is preserved; world/start resumes.')
  def('world/start', () => { W.running = true; return undefined },
    'Resume a stopped world loop. Idempotent when already running.')
  def('world/state', () => [
    [sym(':frame'), W.frameNo],
    [sym(':running'), W.running === true],
    [sym(':entities'), W.entities.length],
  ], 'read', 'A small status alist: frame counter, running flag, entity count.')

  // ── entity kinematics (thin, on the existing entity store) ─────────────
  // Was a second resolver that took a record or a NUMERIC id and nothing
  // else, so `(entity/pos 'bullseye)` — the spelling the reference's own
  // eng-program uses — fell through to `(0 0)`. Same resolver as the readers
  // now; see resolveEntity at the top of the file.
  const resolve = resolveEntity
  // CONTRACT fix (2026-08-04): the miss answered `(0 0)`, which is a real
  // position — the origin — so a stale or misspelled handle read as an entity
  // sitting at the top-left corner and every downstream computation carried
  // on. The reference's own drawback says "If the entity does not exist,
  // returns 'entity-not-found instead of a list." Reference wins. Same
  // correction as entity/x, entity/y, entity/kind and entity/vel below.
  def('entity/pos', (e) => { const t = resolve(e); return t ? [t.x, t.y] : NOT_FOUND }, 'read')
  def('entity/overlaps?', (a, b) => { const p = resolve(a), q = resolve(b); return !!(p && q && overlap(p, q)) }, 'read')
  def('entity/accel!', (e, ax, ay) => { const t = resolve(e); if (t) { t.vx = (t.vx || 0) + (Number(ax) || 0); t.vy = (t.vy || 0) + (Number(ay) || 0); t.dynamic = true } return undefined })
  def('entity/apply-force!', (e, fx, fy) => {
    // F = m·a → Δv = F/m. A pinned (mass 0 / non-dynamic) body ignores force.
    //
    // CONTRACT fix (2026-08-01): this returned `undefined` on every path. The
    // reference locks it as "(entity/apply-force! target fx fy) -> boolean"
    // with :status "landed" :since "2026-07-16" — a RATIFIED contract from the
    // reconciliation. It also records :provenance "motoi-scheme/lib/game/game.js",
    // i.e. the boolean-returning twin in game.js was the sanctioned provider;
    // that installer stopped being called 2026-07-25 and this void-returning
    // version silently took over the name. #t = impulse applied, #f = no-op
    // (unresolvable target, or a pinned body that ignores force).
    //
    // TWEEN FORM restored (2026-08-01): the reference summary is "Apply a force
    // impulse to an entity OR TWEEN", and the explanation spells the second form
    // out — "For a tween record (returned by motion / bounce / slide / fade /
    // motion/move-to), it shifts the tween's from and to endpoints by (fx, fy),
    // nudging the visual trajectory." game.js implemented both forms; this
    // installer only ever implemented the entity half, so the documented tween
    // form went silently missing when game.js stopped being installed 2026-07-25.
    // Restored to the game.js shape.
    if (e && typeof e === 'object' &&
        ('fromX' in e || 'toX' in e) &&
        typeof e.durationFrames === 'number') {
      const dx = Number(fx) || 0
      const dy = Number(fy) || 0
      e.fromX += dx; e.toX += dx
      e.fromY += dy; e.toY += dy
      return true
    }
    const t = resolve(e); if (!t) return false
    if (t.pinned) return false
    // NOTE (2026-08-01, unresolved — flagged for Alfred, deliberately NOT
    // changed here): the reference says of this verb "no mass division, so this
    // is an impulse in the game-loop sense", and game.js did `e.vx += dx`. This
    // installer divides by mass. The two agree for default-mass bodies
    // (mass == null → 1), and diverge only once a cart calls entity/mass!.
    // Conforming it is a physics-semantics decision that could move existing
    // carts, so it is reported rather than silently rewritten.
    const m = t.mass == null ? 1 : (Number(t.mass) || 1)
    t.vx = (t.vx || 0) + (Number(fx) || 0) / m
    t.vy = (t.vy || 0) + (Number(fy) || 0) / m
    t.dynamic = true
    return true
  })
  def('entity/pin!', (e, on = true) => {
    // Anchor a body in place: freeze velocity, stop integrating it. An
    // un-pin (on=#f) hands it back to the physics step as a dynamic body.
    const t = resolve(e); if (!t) return undefined
    const pinned = truthy(on)
    t.pinned = pinned
    if (pinned) { t.vx = 0; t.vy = 0; t.dynamic = false }
    else { t.dynamic = true }
    return undefined
  })
  def('entity/rotate!', (e, deg, ...rest) => {
    // Visual spin of the sprite pose (the AABB used for collision does not
    // rotate). Immediate by default; :duration N spreads the turn over N
    // frames via the integrator's spin tween. :easing accepted, advisory.
    //
    // CONTRACT fix (2026-08-01): this returned `undefined` on every path. The
    // reference locks it as
    // "(entity/rotate! id angle [:duration ms] [:easing e]) -> boolean" with
    // :status "landed" :since "2026-07-16" — a RATIFIED reconciliation
    // contract — and records :provenance "motoi-scheme/lib/game/game.js".
    // game.js's boolean-returning twin stopped being installed 2026-07-25 and
    // this void-returning version silently took over the name. #t = the spin
    // was accepted (snapped or tweened), #f = target did not resolve.
    const t = resolve(e); if (!t) return false
    const d = Number(deg) || 0
    let duration = 0
    for (let i = 0; i < rest.length - 1; i++) {
      if (rest[i] instanceof Sym && nm(rest[i]) === ':duration') duration = Math.max(0, rest[i + 1] | 0)
    }
    if (duration <= 0) { t.spin = (t.spin || 0) + d; return true }
    t.spinRate = d / duration
    t.spinFrames = duration
    return true
  })
  def('entity/glide!', (e, x, y, frames, _ease) => {
    const t = resolve(e); if (!t) return undefined
    const n = Math.max(1, (frames | 0) || 1)
    t.vx = ((Number(x) || 0) - t.x) / n; t.vy = ((Number(y) || 0) - t.y) / n; t.dynamic = true
    W.scheduled.push({ left: n, proc: () => { t.vx = 0; t.vy = 0; t.x = Number(x) || 0; t.y = Number(y) || 0 } })
    return undefined
  })
  def('entity/goto!', (e, state) => { const t = resolve(e); if (t) t.kind = nm(state); return undefined })
  def('entity/sprite!', (e, spr) => { const t = resolve(e); if (t) t.scratch.set('sprite', nm(spr)); return undefined })
  def('entity/pose!', (e, spin, sx, sy) => {
    const t = resolve(e); if (!t) return sym('entity-not-found')
    if (spin !== undefined) t.spin = Number(spin) || 0
    if (sx !== undefined) t.sx = Number(sx) || 1
    if (sy !== undefined) t.sy = Number(sy) || 1
    return true
  })
  def('entity/parent!', (e, parent) => {
    const t = resolve(e); if (!t) return undefined
    t.parent = (parent == null || (isNull(parent))) ? null : resolve(parent)
    return undefined
  })
  def('entity/team!', (e, team) => { const t = resolve(e); if (t) t.team = nm(team); return undefined })
  def('entity/shape-flower!', (e, n) => { const t = resolve(e); if (!t) return sym('entity-not-found'); t.shape = 'flower'; t.petals = (n | 0) || 5; return true })
  def('entity/collisions', (e) => {
    const t = resolve(e); if (!t) return []
    const out = []
    for (const [a, b] of W.collisions) { if (a === t) out.push(b); else if (b === t) out.push(a) }
    return out
  }, 'read')

  // ── camera accessors + moves (2.5D pan/zoom over the shared framebuffer) ─
  const camK = () => (W.camera.k == null ? 1 : W.camera.k)
  def('camera-x', () => W.camera.x, 'read')
  def('camera-y', () => W.camera.y, 'read')
  def('camera-scale', () => camK(), 'read')
  def('camera-state', () => [[sym('x'), W.camera.x], [sym('y'), W.camera.y], [sym('k'), camK()]], 'read')
  def('camera-home', (_ms) => { W.camera.x = 0; W.camera.y = 0; W.camera.k = 1; return undefined })
  def('camera-center-on', (x, y, scale, _ms) => { W.camera.x = Number(x) || 0; W.camera.y = Number(y) || 0; if (scale !== undefined) W.camera.k = Number(scale) || 1; return undefined })
  def('camera-set!', (x, y, s, _ms) => { W.camera.x = Number(x) || 0; W.camera.y = Number(y) || 0; if (s !== undefined) W.camera.k = Number(s) || 1; return undefined })
  def('camera-pan', (dx, _ms) => { W.camera.x += Number(dx) || 0; return undefined })
  def('camera-tilt', (dy, _ms) => { W.camera.y += Number(dy) || 0; return undefined })
  def('camera-zoom-to', (scale, _ms) => { W.camera.k = Number(scale) || 1; return sym('ok') })
  def('camera-pan-to', (x, y, _ms) => { W.camera.x = Number(x) || 0; W.camera.y = Number(y) || 0; return undefined })
  const bbox = () => {
    const al = W.entities.filter((e) => e.alive)
    if (!al.length) return null
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (const e of al) { x0 = Math.min(x0, e.x); y0 = Math.min(y0, e.y); x1 = Math.max(x1, e.x + e.w); y1 = Math.max(y1, e.y + e.h) }
    return { x0, y0, x1, y1 }
  }
  def('camera-bring-to-view', (e, _pad, _ms) => { const t = resolve(e); if (t) { W.camera.x = t.x + t.w / 2; W.camera.y = t.y + t.h / 2 } return undefined })
  def('camera-fit-all', (_pad, _ms) => { const b = bbox(); if (b) { W.camera.x = (b.x0 + b.x1) / 2; W.camera.y = (b.y0 + b.y1) / 2 } return undefined })
  def('camera-trace', (_msg) => sym('ok'))
  def('camera-record', (_clip, _opts) => { W.cameraTape = { frames: [] }; return [sym('camera-tape'), 0] })
  def('camera-frame', (handle, _source) => { if (W.cameraTape) W.cameraTape.frames.push(1); return handle })
  def('camera-export', (handle, _opts) => handle)

  // ── world physics (impulses, wind, distance links, snapshots) ──────────
  def('world/render', (_pitch) => W.entities.filter((e) => e.alive).length, 'paint')
  def('world/nearest', (e, kind) => {
    const t = resolve(e); if (!t) return sym('nan')
    const k = kind === undefined ? null : nm(kind)
    let best = null, bd = Infinity
    for (const o of W.entities) {
      if (o === t || !o.alive) continue
      if (k && o.kind !== k) continue
      const d = Math.hypot((o.x + o.w / 2) - (t.x + t.w / 2), (o.y + o.h / 2) - (t.y + t.h / 2))
      if (d < bd) { bd = d; best = o }
    }
    return best || sym('nan')
  }, 'read')
  def('world/impulse!', (e, dvx, dvy) => { const t = resolve(e); if (t) { t.vx = (t.vx || 0) + (Number(dvx) || 0); t.vy = (t.vy || 0) + (Number(dvy) || 0); t.dynamic = true } return undefined })
  def('world/wind!', (dvx, dvy) => { for (const e of W.entities) if (e.alive && e.dynamic) { e.vx = (e.vx || 0) + (Number(dvx) || 0); e.vy = (e.vy || 0) + (Number(dvy) || 0) } return undefined })
  def('world/repel!', (e, cx, cy, strength) => {
    const t = resolve(e); if (!t) return undefined
    const dx = (t.x + t.w / 2) - (Number(cx) || 0), dy = (t.y + t.h / 2) - (Number(cy) || 0)
    const d2 = dx * dx + dy * dy + 1, s = (Number(strength) || 0) / d2, d = Math.sqrt(d2)
    t.vx = (t.vx || 0) + (dx / d) * s; t.vy = (t.vy || 0) + (dy / d) * s; t.dynamic = true
    return undefined
  })
  def('world/snapshot', () => ({ [Symbol.for('world-snapshot')]: true, ents: W.entities.map((e) => ({ _id: e._id, x: e.x, y: e.y, vx: e.vx, vy: e.vy, kind: e.kind, alive: e.alive })) }), 'read')
  def('world/restore!', (snap) => {
    if (!snap || typeof snap !== 'object' || !snap.ents) return sym('bad-snapshot')
    const byId = new Map(W.entities.map((e) => [e._id, e]))
    for (const s of snap.ents) { const e = byId.get(s._id); if (e) { e.x = s.x; e.y = s.y; e.vx = s.vx; e.vy = s.vy; e.kind = s.kind; e.alive = s.alive } }
    return undefined
  })
  def('world/link!', (a, b, rest, stiff) => {
    W.links = W.links || []
    const p = resolve(a), q = resolve(b); if (!p || !q) return undefined
    const r = rest === undefined ? Math.hypot(p.x - q.x, p.y - q.y) : Number(rest) || 0
    W.links.push({ a: p, b: q, rest: r, stiff: stiff === undefined ? 1 : Number(stiff) || 1 })
    return undefined
  })
  def('world/link-rest!', (a, b, rest) => {
    W.links = W.links || []
    const p = resolve(a), q = resolve(b), r = Number(rest) || 0
    for (const l of W.links) if ((l.a === p && l.b === q) || (l.a === q && l.b === p)) l.rest = r
    return r | 0
  })
  def('world/solve!', (iters) => {
    W.links = W.links || []
    const N = iters === undefined ? 1 : (iters | 0)
    for (let k = 0; k < N; k++) for (const l of W.links) {
      const dx = l.b.x - l.a.x, dy = l.b.y - l.a.y, d = Math.hypot(dx, dy) || 1
      const diff = ((d - l.rest) / d) * 0.5 * l.stiff
      l.a.x += dx * diff; l.a.y += dy * diff; l.b.x -= dx * diff; l.b.y -= dy * diff
    }
    return W.frame | 0
  })
  def('world/sway-all!', (tag, period, amplitude) => {
    const t = nm(tag), per = Number(period) || 60, amp = Number(amplitude) || 1
    let n = 0
    W.entities.forEach((e, i) => {
      if (!e.alive) return
      if (e.kind === t || (e.tags && e.tags.has(t))) { e.spin = Math.sin((W.frame / per) * Math.PI * 2 + i) * amp; n++ }
    })
    return n
  })
  def('world/tape-audio', () => (W.tape && W.tape.audio ? W.tape.audio.slice() : []), 'read')
  def('world/tape-clear!', () => { W.tape = null; return true })
  def('world/tape-recording?', () => !!(W.tape && W.tape.recording), 'read')
  def('world/tape-lcamera', () => (W.tape ? [W.camera.x, W.camera.y, camK()] : sym('none')), 'read')

  return env
}

export default installWorld
