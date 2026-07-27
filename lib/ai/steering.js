// steering.js — Reynolds/Boids steering + tiny behavior-tree + blackboard.
//
// Doctrine (Alfred, 2026-07-16): pure math over vectors. Callers pass in
// position, velocity, target — verbs return a steering VECTOR (delta
// velocity) that the caller can integrate. No entity assumed.
//
// Vectors are 2-element lists [x, y]. All ops tolerate n-dim but the
// standard case is 2D.

import { Sym } from '../../src/reader.js'
import { apply } from '../../src/interp.js'
import { seededRandom } from '../game/misc.js'

function asVec(v) {
  if (Array.isArray(v)) return v.map(Number)
  return [+v || 0]
}
function vsub(a, b) {
  const A = asVec(a), B = asVec(b)
  return A.map((x, i) => x - (B[i] ?? 0))
}
function vadd(a, b) {
  const A = asVec(a), B = asVec(b)
  return A.map((x, i) => x + (B[i] ?? 0))
}
function vscale(v, k) { return asVec(v).map((x) => x * k) }
function vmag(v) { let s = 0; for (const x of asVec(v)) s += x * x; return Math.sqrt(s) }
function vnorm(v) {
  const m = vmag(v)
  if (m === 0) return asVec(v).slice()
  return asVec(v).map((x) => x / m)
}
function vlimit(v, max) {
  const m = vmag(v)
  if (m <= max || m === 0) return v
  return vscale(v, max / m)
}
function vavg(list) {
  if (!Array.isArray(list) || list.length === 0) return [0, 0]
  const dim = Array.isArray(list[0]) ? list[0].length : 1
  const acc = new Array(dim).fill(0)
  for (const v of list) {
    const V = asVec(v)
    for (let i = 0; i < dim; i++) acc[i] += V[i] ?? 0
  }
  return acc.map((x) => x / list.length)
}

// A blackboard is a plain object we store per-namespace.
const BOARDS = new Map()

export function __resetSteering() { BOARDS.clear() }


// ── inline registration metadata (2026-07-22) ────────────────────
// See engineering/HOW-TO-REGISTER-A-VERB.md.
export const VERBS = [
  "ai/align",
  "ai/arrive",
  "ai/bb-del!",
  "ai/bb-get",
  "ai/bb-has?",
  "ai/bb-set!",
  "ai/bt-action",
  "ai/bt-condition",
  "ai/bt-force",
  "ai/bt-invert",
  "ai/bt-parallel",
  "ai/bt-selector",
  "ai/bt-sequence",
  "ai/bt-tick",
  "ai/clear!",
  "ai/cohere",
  "ai/decide",
  "ai/evade",
  "ai/flee",
  "ai/flock",
  "ai/flow-at",
  "ai/flow-field",
  "ai/follow-flow",
  "ai/follow-path",
  "ai/grid",
  "ai/max-force!",
  "ai/passable?",
  "ai/path",
  "ai/pursue",
  "ai/seek",
  "ai/separate",
  "ai/utility",
  "ai/wall!",
  "ai/wander",
  "ai/waypoints",
]
export const LAZY = false

export function installSteering(env, fuel) {
  const _fuel = fuel ?? { n: 1_000_000 }
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  // ── steering ───────────────────────────────────────────────────────
  // Each returns a DESIRED-VELOCITY vector (or a STEERING FORCE = desired - current).
  // Callers integrate into position.

  // (ai/seek pos target max-speed?) → desired velocity toward target.
  def('ai/seek', (pos, target, max) => {
    const desired = vsub(target, pos)
    return vlimit(vnorm(desired).map((x) => x * (max ?? 1)), max ?? 1)
  })

  // (ai/flee pos target max-speed?) → opposite of seek.
  def('ai/flee', (pos, target, max) => {
    const desired = vsub(pos, target)
    return vlimit(vnorm(desired).map((x) => x * (max ?? 1)), max ?? 1)
  })

  // (ai/wander pos velocity strength?) → random jitter around velocity.
  // BUG-4 fix (Zane-2, 2026-07-17): route through seededRandom so
  // (with-seed …) makes wander deterministic. Previously Math.random
  // directly, so a boid replay under seed still diverged frame-to-frame.
  def('ai/wander', (pos, velocity, strength) => {
    const s = strength ?? 0.1
    const V = asVec(velocity)
    return V.map((x) => x + (seededRandom() - 0.5) * 2 * s)
  })

  // (ai/arrive pos target max-speed slow-radius?)
  def('ai/arrive', (pos, target, max, slowRadius) => {
    const desired = vsub(target, pos)
    const d = vmag(desired)
    const r = slowRadius ?? 20
    const m = max ?? 1
    const speed = d < r ? m * (d / r) : m
    if (d === 0) return [0, 0]
    return vscale(vnorm(desired), speed)
  })

  // (ai/pursue pos target target-vel max-speed?)
  def('ai/pursue', (pos, target, targetVel, max) => {
    const predicted = vadd(target, vscale(targetVel, 1))
    const desired = vsub(predicted, pos)
    return vlimit(vscale(vnorm(desired), max ?? 1), max ?? 1)
  })

  // (ai/evade pos target target-vel max-speed?)
  def('ai/evade', (pos, target, targetVel, max) => {
    const predicted = vadd(target, vscale(targetVel, 1))
    const desired = vsub(pos, predicted)
    return vlimit(vscale(vnorm(desired), max ?? 1), max ?? 1)
  })

  // (ai/align neighbors-velocities max-speed?) → average velocity.
  def('ai/align', (neighbors, max) => {
    const v = vavg(neighbors ?? [])
    return vlimit(v, max ?? 1)
  })

  // (ai/cohere pos neighbors-positions max-speed?) → toward centroid.
  def('ai/cohere', (pos, neighbors, max) => {
    if (!Array.isArray(neighbors) || neighbors.length === 0) return [0, 0]
    const centroid = vavg(neighbors)
    return vlimit(vsub(centroid, pos), max ?? 1)
  })

  // (ai/separate pos neighbors-positions min-dist max-speed?)
  def('ai/separate', (pos, neighbors, minDist, max) => {
    if (!Array.isArray(neighbors) || neighbors.length === 0) return [0, 0]
    const md = minDist ?? 10
    let steer = [0, 0]
    let count = 0
    for (const n of neighbors) {
      const d = vmag(vsub(pos, n))
      if (d > 0 && d < md) {
        const diff = vscale(vnorm(vsub(pos, n)), 1 / d)
        steer = vadd(steer, diff)
        count++
      }
    }
    if (count === 0) return [0, 0]
    steer = vscale(steer, 1 / count)
    return vlimit(steer, max ?? 1)
  })

  // (ai/flock pos vel neighbors-positions neighbors-velocities) → combined steer.
  def('ai/flock', (pos, vel, posns, vels) => {
    const align = vavg(vels ?? [])
    const cohere = posns && posns.length ? vsub(vavg(posns), pos) : [0, 0]
    const separate = (() => {
      if (!posns || posns.length === 0) return [0, 0]
      let s = [0, 0]; let c = 0
      for (const n of posns) {
        const d = vmag(vsub(pos, n))
        if (d > 0 && d < 15) {
          s = vadd(s, vscale(vnorm(vsub(pos, n)), 1 / d))
          c++
        }
      }
      return c ? vscale(s, 1 / c) : [0, 0]
    })()
    return vadd(vadd(vscale(align, 0.5), vscale(cohere, 0.3)), vscale(separate, 1.5))
  })

  // ── decision / utility ─────────────────────────────────────────────

  // (ai/decide options weights?) → pick highest-weighted option.
  def('ai/decide', (options, weights) => {
    if (!Array.isArray(options) || options.length === 0) return null
    const ws = Array.isArray(weights) ? weights : options.map(() => 1)
    let bestI = 0, bestW = -Infinity
    for (let i = 0; i < options.length; i++) {
      const w = Number(ws[i] ?? 0)
      if (w > bestW) { bestW = w; bestI = i }
    }
    return options[bestI]
  })

  // (ai/utility value min max) → normalized 0..1 utility score.
  def('ai/utility', (value, min, max) => {
    if (max === min) return 0
    return Math.max(0, Math.min(1, (value - min) / (max - min)))
  })

  // ── behavior-tree ──────────────────────────────────────────────────
  // Nodes are tagged lists. Ticks return 'success | 'failure | 'running.

  const SUCCESS = new Sym('success')
  const FAILURE = new Sym('failure')
  const RUNNING = new Sym('running')

  function tickNode(node) {
    if (!Array.isArray(node)) return FAILURE
    const head = node[0] instanceof Sym ? node[0].name : node[0]
    if (head === 'bt-sequence') {
      for (let i = 1; i < node.length; i++) {
        const r = tickNode(node[i])
        if (r === FAILURE || (r instanceof Sym && r.name === 'failure')) return FAILURE
        if (r === RUNNING || (r instanceof Sym && r.name === 'running')) return RUNNING
      }
      return SUCCESS
    }
    if (head === 'bt-selector') {
      for (let i = 1; i < node.length; i++) {
        const r = tickNode(node[i])
        if (r === SUCCESS || (r instanceof Sym && r.name === 'success')) return SUCCESS
        if (r === RUNNING || (r instanceof Sym && r.name === 'running')) return RUNNING
      }
      return FAILURE
    }
    if (head === 'bt-action') {
      const fn = node[1]
      if (fn == null) return FAILURE
      try {
        const out = apply(fn, [], _fuel)
        if (out === false || out === null || out === undefined) return FAILURE
        if (out instanceof Sym) return out
        return SUCCESS
      } catch { return FAILURE }
    }
    if (head === 'bt-condition') {
      const fn = node[1]
      if (fn == null) return FAILURE
      try {
        const out = apply(fn, [], _fuel)
        return (out === false || out === null || out === undefined) ? FAILURE : SUCCESS
      } catch { return FAILURE }
    }
    if (head === 'bt-invert') {
      const r = tickNode(node[1])
      const rn = r instanceof Sym ? r.name : String(r)
      if (rn === 'success') return FAILURE
      if (rn === 'failure') return SUCCESS
      return r
    }
    if (head === 'bt-parallel') {
      let sawRunning = false
      for (let i = 1; i < node.length; i++) {
        const r = tickNode(node[i])
        const rn = r instanceof Sym ? r.name : String(r)
        if (rn === 'failure') return FAILURE
        if (rn === 'running') sawRunning = true
      }
      return sawRunning ? RUNNING : SUCCESS
    }
    if (head === 'bt-force') {
      const forced = node[1]
      // Tick the child (if any) for its side effects, then return forced.
      if (node[2] != null) { try { tickNode(node[2]) } catch { /* swallow */ } }
      if (forced instanceof Sym) return forced
      const s = String(forced ?? 'success')
      if (s === 'success' || s === 'failure' || s === 'running') return new Sym(s)
      return SUCCESS
    }
    return FAILURE
  }

  // (ai/bt-tick node) → 'success | 'failure | 'running.
  def('ai/bt-tick', (node) => tickNode(node), 'paint')
  // (ai/bt-sequence . children) → tagged node.
  def('ai/bt-sequence', (...children) => [new Sym('bt-sequence'), ...children])
  // (ai/bt-selector . children) → tagged node.
  def('ai/bt-selector', (...children) => [new Sym('bt-selector'), ...children])
  // (ai/bt-action fn) → tagged node.
  def('ai/bt-action', (fn) => [new Sym('bt-action'), fn])
  // (ai/bt-condition fn) → tagged node.
  def('ai/bt-condition', (fn) => [new Sym('bt-condition'), fn])

  // ── blackboard ─────────────────────────────────────────────────────
  // Namespaced key/value store. Namespace defaults to 'default.

  function ns(name) {
    const key = name instanceof Sym ? name.name : String(name ?? 'default')
    if (!BOARDS.has(key)) BOARDS.set(key, new Map())
    return BOARDS.get(key)
  }

  // (ai/bb-get key namespace?) → value or null.
  def('ai/bb-get', (key, namespace) => {
    const board = ns(namespace)
    const k = key instanceof Sym ? key.name : String(key)
    return board.has(k) ? board.get(k) : null
  })

  // (ai/bb-set! key value namespace?) → value.
  def('ai/bb-set!', (key, value, namespace) => {
    const board = ns(namespace)
    const k = key instanceof Sym ? key.name : String(key)
    board.set(k, value)
    return value
  }, 'paint')

  // (ai/bb-has? key namespace?) → boolean.
  def('ai/bb-has?', (key, namespace) => {
    const board = ns(namespace)
    const k = key instanceof Sym ? key.name : String(key)
    return board.has(k)
  })

  // (ai/bb-del! key namespace?) → boolean.
  def('ai/bb-del!', (key, namespace) => {
    const board = ns(namespace)
    const k = key instanceof Sym ? key.name : String(key)
    return board.delete(k)
  }, 'paint')

  // ── BT decorators (2026-07-22) ─────────────────────────────────────
  //
  // (ai/bt-invert child) — always succeeds if child fails and vice versa.
  // Running stays running. Kids read it as "reverse this test."
  def('ai/bt-invert', (child) => [new Sym('bt-invert'), child])

  // (ai/bt-parallel . children) — tick every child; success iff ALL
  // succeed, failure iff ANY fails, else running. Useful for concurrent
  // conditions (e.g. drive + shoot).
  def('ai/bt-parallel', (...children) => [new Sym('bt-parallel'), ...children])

  // (ai/bt-force result child?) — always returns the forced result
  // regardless of the child's outcome. Handy for stubbing out branches
  // during authoring. Result is a symbol like 'success 'failure 'running.
  def('ai/bt-force', (result, child) => [new Sym('bt-force'), result, child])

  // ── Flow fields (2026-07-22) ───────────────────────────────────────
  //
  // A flow field is a 2D grid of unit-length vectors. Boids/agents that
  // want to "flow toward the mouse" or "spiral out" sample the field at
  // their world cell and add the result to their steering.

  const FIELDS = new Map()   // name → { cols, rows, cells: Array<[dx,dy]> }
  const PATHS  = new Map()   // name → list of waypoints
  const GRIDS  = new Map()   // name → { cols, rows, walls: Uint8Array }
  const MAX_FORCE = { v: 0.5 }

  // (ai/flow-field cols rows fn) → registers an anonymous field and
  // returns a tagged handle. fn is a Scheme lambda (c r) → (dx dy) that
  // fills each cell. Callers usually save the handle in a blackboard
  // key. For CORE we build the field synchronously — cheap up to
  // ~100×100 grids.
  def('ai/flow-field', (cols, rows, fn) => {
    const C = Math.max(1, cols | 0)
    const R = Math.max(1, rows | 0)
    const cells = new Array(C * R)
    for (let r = 0; r < R; r++) {
      for (let c = 0; c < C; c++) {
        let v = [0, 0]
        try {
          const out = fn ? apply(fn, [c, r], _fuel) : [0, 0]
          if (Array.isArray(out) && out.length >= 2) v = [+out[0] || 0, +out[1] || 0]
        } catch { v = [0, 0] }
        cells[r * C + c] = v
      }
    }
    const handle = new Sym(`field-${FIELDS.size}`)
    FIELDS.set(handle.name, { cols: C, rows: R, cells })
    return handle
  })

  // (ai/flow-at field-handle x y) → (dx dy). Sample the field at world
  // coordinate (x, y), returning the cell's flow vector. Out-of-range
  // returns (0 0) — the honest zero-motion answer.
  def('ai/flow-at', (handle, x, y) => {
    const key = handle instanceof Sym ? handle.name : String(handle)
    const f = FIELDS.get(key)
    if (!f) return [0, 0]
    const c = Math.max(0, Math.min(f.cols - 1, x | 0))
    const r = Math.max(0, Math.min(f.rows - 1, y | 0))
    return f.cells[r * f.cols + c] || [0, 0]
  })

  // (ai/follow-flow pos field-handle max-speed?) → steering vector.
  // Sample once at pos, scale to max-speed.
  def('ai/follow-flow', (pos, handle, max) => {
    const key = handle instanceof Sym ? handle.name : String(handle)
    const f = FIELDS.get(key)
    if (!f) return [0, 0]
    const P = asVec(pos)
    const c = Math.max(0, Math.min(f.cols - 1, P[0] | 0))
    const r = Math.max(0, Math.min(f.rows - 1, P[1] | 0))
    const v = f.cells[r * f.cols + c] || [0, 0]
    return vlimit(vscale(vnorm(v), max ?? 1), max ?? 1)
  })

  // ── Path following ────────────────────────────────────────────────
  //
  // (ai/waypoints name pts) — store a named list of waypoints. pts is a
  // list of (x y) pairs.
  def('ai/waypoints', (name, pts) => {
    const nn = name instanceof Sym ? name.name : String(name)
    PATHS.set(nn, Array.isArray(pts) ? pts.map(asVec) : [])
    return true
  }, 'paint')

  // (ai/path name) → waypoint list or empty list.
  def('ai/path', (name) => {
    const nn = name instanceof Sym ? name.name : String(name)
    return PATHS.get(nn) || []
  })

  // (ai/follow-path pos name max-speed?) → steering vector toward the
  // next unmet waypoint. Very simple heuristic: pick the first waypoint
  // still further than 1 unit from pos.
  def('ai/follow-path', (pos, name, max) => {
    const nn = name instanceof Sym ? name.name : String(name)
    const pts = PATHS.get(nn) || []
    const P = asVec(pos)
    for (const wp of pts) {
      const d = vmag(vsub(wp, P))
      if (d > 1) return vlimit(vscale(vnorm(vsub(wp, P)), max ?? 1), max ?? 1)
    }
    return [0, 0]
  })

  // ── Nav grid ──────────────────────────────────────────────────────
  //
  // (ai/grid cols rows) — allocate a named default nav grid. Returns
  // dims. Only one grid is active at a time (identity 'default).
  def('ai/grid', (cols, rows) => {
    const C = Math.max(1, cols | 0), R = Math.max(1, rows | 0)
    GRIDS.set('default', { cols: C, rows: R, walls: new Uint8Array(C * R) })
    return [C, R]
  }, 'paint')

  // (ai/wall! x y on?) — mark cell (x, y) as blocked (on non-nil) or
  // passable (on = 0/#f/null).
  def('ai/wall!', (x, y, on) => {
    const g = GRIDS.get('default')
    if (!g) return false
    const c = x | 0, r = y | 0
    if (c < 0 || r < 0 || c >= g.cols || r >= g.rows) return false
    const v = (on === false || on === 0 || on == null) ? 0 : 1
    g.walls[r * g.cols + c] = v
    return true
  }, 'paint')

  // (ai/passable? x y) → boolean. True iff in-range and not a wall.
  def('ai/passable?', (x, y) => {
    const g = GRIDS.get('default')
    if (!g) return true
    const c = x | 0, r = y | 0
    if (c < 0 || r < 0 || c >= g.cols || r >= g.rows) return false
    return g.walls[r * g.cols + c] === 0
  })

  // (ai/clear!) — drop all steering state: fields, paths, grids, max-force.
  // Kids call this between example scenes to reset without restart.
  def('ai/clear!', () => {
    FIELDS.clear()
    PATHS.clear()
    GRIDS.clear()
    MAX_FORCE.v = 0.5
    return true
  }, 'paint')

  // (ai/max-force! v?) — get/set the default max steering force. Some
  // higher-level verbs (flock, follow-flow) use this as their default.
  def('ai/max-force!', (v) => {
    if (v != null) MAX_FORCE.v = Math.max(0, Number(v) || 0)
    return MAX_FORCE.v
  }, 'paint')

  return env
}

export default installSteering
