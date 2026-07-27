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

const nm = (x) => (x instanceof Sym ? x.name : (x == null ? x : String(x)))
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

// Input state — the driver (TUI) writes here; headless it stays empty so
// every input/down? / input/pressed? reads #f. down = held this frame,
// pressed = went down this frame (edge).
const INPUT = { down: new Set(), pressed: new Set() }
export function setInput({ down, pressed } = {}) {
  INPUT.down = new Set((down || []).map(nm))
  INPUT.pressed = new Set((pressed || []).map(nm))
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
  'input/down?', 'input/pressed?', 'collision/define-layers!',
  'big-bang', 'on-frame',
]
export const LAZY = false

export function installWorld(env, fuel) {
  const def = (n, f, perm = 'state-change', doc = '') =>
    env.define(n, f, { perm, doc, namespace: n.split('/')[0] })

  // ── world lifecycle ───────────────────────────────────────────────────

  def('world/reset!', () => { W = freshWorld(); return undefined })

  // (world/spawn kind x y) → entity handle. The handle is the record
  // itself; entity/* verbs read and mutate it, and eq? gives identity.
  def('world/spawn', (kind, x, y) => {
    const e = makeEntity(kind, x, y)
    W.entities.push(e)
    return e
  })

  // entity/make + entity/spawn are aliases people reach for.
  def('entity/make', (kind, x, y, w, h) => {
    const e = makeEntity(kind, x, y)
    if (w !== undefined) e.w = Number(w) || e.w
    if (h !== undefined) e.h = Number(h) || e.h
    W.entities.push(e)
    return e
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

    // 1. gravity + integrate dynamic bodies.
    for (const e of W.entities) {
      if (!e.alive || !e.dynamic) continue
      e.vx += W.gravity.x * e.gscale
      e.vy += W.gravity.y * e.gscale
      if (e.drag) { e.vx *= (1 - e.drag); e.vy *= (1 - e.drag) }
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
    if (W.tape && W.tape.recording) {
      W.tape.frames.push(W.entities.map((e) => ({
        kind: e.kind, x: e.x, y: e.y, w: e.w, h: e.h, alive: e.alive,
      })))
    }
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
  def('world/tape-record!', () => { W.tape = { recording: true, frames: [] }; return undefined })
  def('world/tape-stop!', () => { if (W.tape) W.tape.recording = false; return undefined })
  def('world/tape-frames', () => (W.tape ? W.tape.frames.length : 0), 'read')
  def('world/tape-replay', () => (W.tape ? W.tape.frames.slice() : []), 'read')
  def('world/tape-save', () => (W.tape ? W.tape.frames.length : 0))
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
  const ent = (e) => (e && typeof e === 'object' && '_id' in e) ? e : null
  def('entity/x', (e) => (ent(e) ? e.x : 0), 'read')
  def('entity/y', (e) => (ent(e) ? e.y : 0), 'read')
  def('entity/vel', (e) => (ent(e) ? [e.vx, e.vy] : [0, 0]), 'read')
  def('entity/kind', (e) => (ent(e) ? sym(e.kind) : undefined), 'read')
  def('entity/all', () => W.entities.filter((e) => e.alive), 'read')
  def('entity/count', (tag) => {
    const live = W.entities.filter((e) => e.alive)
    if (tag === undefined) return live.length
    const t = nm(tag)
    return live.filter((e) => e.kind === t || e.tags.has(t)).length
  }, 'read')
  def('entity/alive?', (e) => !!(ent(e) && e.alive), 'read')
  def('entity/id', (e) => (ent(e) ? e._id : 0), 'read')
  def('entity/team', (e) => (ent(e) ? (e.team == null ? undefined : sym(e.team)) : undefined), 'read')
  def('entity/hp', (e) => (ent(e) ? e.hp : 0), 'read')
  def('entity/distance', (a, b) => {
    if (!ent(a) || !ent(b)) return Infinity
    const ax = a.x + a.w / 2, ay = a.y + a.h / 2
    const bx = b.x + b.w / 2, by = b.y + b.h / 2
    return Math.hypot(ax - bx, ay - by)
  }, 'read')
  def('entity/state', (e) => (ent(e) ? [sym(e.kind), e.x, e.y, e.vx, e.vy, e.w, e.h] : undefined), 'read')
  def('entity/ref', (e, key) => {
    if (!ent(e)) return undefined
    const k = nm(key)
    return e.scratch.has(k) ? e.scratch.get(k) : undefined
  }, 'read')

  // ── entity mutators ───────────────────────────────────────────────────
  def('entity/shape!', (e, shape, w, h) => {
    if (!ent(e)) return e
    e.shape = nm(shape) || 'rect'
    if (w !== undefined) e.w = Number(w) || e.w
    if (h !== undefined) e.h = Number(h) || e.h
    return e
  })
  def('entity/solid!', (e, on = true) => { if (ent(e)) e.solid = truthy(on); return e })
  def('entity/sensor!', (e, on = true) => { if (ent(e)) e.sensor = truthy(on); return e })
  def('entity/gravity-scale!', (e, k) => {
    if (!ent(e)) return e
    e.gscale = Number(k) || 0
    if (e.gscale > 0) e.dynamic = true
    return e
  })
  def('entity/move!', (e, dx, dy) => {
    if (!ent(e)) return e
    e.dynamic = true
    e.x += Number(dx) || 0
    e.y += Number(dy) || 0
    return e
  })
  def('entity/set-vel!', (e, vx, vy) => {
    if (!ent(e)) return e
    e.vx = Number(vx) || 0
    e.vy = Number(vy) || 0
    if (e.vx || e.vy) e.dynamic = true
    return e
  })
  def('entity/set-pos!', (e, x, y) => {
    if (!ent(e)) return e
    e.x = Number(x) || 0
    e.y = Number(y) || 0
    return e
  })
  def('entity/hp!', (e, n) => { if (ent(e)) e.hp = Number(n) || 0; return e })
  def('entity/damage!', (e, n) => {
    if (!ent(e)) return e
    e.hp -= Number(n) || 0
    if (e.hp <= 0) { e.hp = 0; e.alive = false }
    return e
  })
  def('entity/despawn!', (e) => { if (ent(e)) e.alive = false; return undefined })
  def('entity/remove!', (e) => {
    if (!ent(e)) return false
    e.alive = false
    const i = W.entities.indexOf(e)
    if (i >= 0) W.entities.splice(i, 1)
    return true
  })
  def('entity/max-speed!', (e, s) => { if (ent(e)) e.maxSpeed = Number(s); return e })
  def('entity/bounce!', (e, b) => { if (ent(e)) e.bounce = Number(b) || 0; return e })
  def('entity/mass!', (e, m) => { if (ent(e)) e.mass = Number(m) || 1; return e })
  def('entity/friction!', (e, f) => { if (ent(e)) e.friction = Number(f) || 0; return e })
  def('entity/drag!', (e, d) => { if (ent(e)) e.drag = Number(d) || 0; return e })
  def('entity/layer!', (e, l) => { if (ent(e)) e.layer = nm(l); return e })
  def('entity/team', (e, t) => {
    // reader/setter overload: (entity/team e) reads, (entity/team e 'red) sets.
    if (!ent(e)) return undefined
    if (t === undefined) return e.team == null ? undefined : sym(e.team)
    e.team = nm(t)
    return e
  })
  def('entity/tag!', (e, t) => { if (ent(e)) e.tags.add(nm(t)); return e })
  def('entity/untag!', (e, t) => { if (ent(e)) e.tags.delete(nm(t)); return e })
  def('entity/set!', (e, key, val) => {
    if (ent(e)) e.scratch.set(nm(key), val)
    return val
  })

  // ── input ─────────────────────────────────────────────────────────────
  // Headless these read #f. The TUI Game composer calls setInput() each
  // frame from real key state, so the same game reacts live.
  def('input/down?', (k) => INPUT.down.has(nm(k)), 'read')
  def('input/pressed?', (k) => INPUT.pressed.has(nm(k)), 'read')

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
  def('on-frame', (fn) => { W.onFrame = fn; return undefined })

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
  const resolve = (e) => {
    if (e && typeof e === 'object' && '_id' in e) return e
    const n = Number(e)
    return W.entities.find((x) => x._id === n) || null
  }
  def('entity/pos', (e) => { const t = resolve(e); return t ? [t.x, t.y] : [0, 0] }, 'read')
  def('entity/overlaps?', (a, b) => { const p = resolve(a), q = resolve(b); return !!(p && q && overlap(p, q)) }, 'read')
  def('entity/accel!', (e, ax, ay) => { const t = resolve(e); if (t) { t.vx = (t.vx || 0) + (Number(ax) || 0); t.vy = (t.vy || 0) + (Number(ay) || 0); t.dynamic = true } return undefined })
  def('entity/apply-force!', (e, fx, fy) => {
    // F = m·a → Δv = F/m. A pinned (mass 0 / non-dynamic) body ignores force.
    const t = resolve(e); if (!t) return undefined
    if (t.pinned) return undefined
    const m = t.mass == null ? 1 : (Number(t.mass) || 1)
    t.vx = (t.vx || 0) + (Number(fx) || 0) / m
    t.vy = (t.vy || 0) + (Number(fy) || 0) / m
    t.dynamic = true
    return undefined
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
    const t = resolve(e); if (!t) return undefined
    const d = Number(deg) || 0
    let duration = 0
    for (let i = 0; i < rest.length - 1; i++) {
      if (rest[i] instanceof Sym && nm(rest[i]) === ':duration') duration = Math.max(0, rest[i + 1] | 0)
    }
    if (duration <= 0) { t.spin = (t.spin || 0) + d; return undefined }
    t.spinRate = d / duration
    t.spinFrames = duration
    return undefined
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
    t.parent = (parent == null || (Array.isArray(parent) && parent.length === 0)) ? null : resolve(parent)
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
