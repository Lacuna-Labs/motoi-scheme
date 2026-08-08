// grid.js — Conway-style grid ops + a `grid/dot` draw verb.
//
// Doctrine (Alfred, 2026-07-16): a grid is a 2D bitmap of cells with
// per-cell age (steps since last state change). `grid-init` allocates
// it; `grid-neighbors` returns the 8-neighborhood; grid/dot draws one
// cell into the framebuffer.

import { Sym, Pair } from '../../src/reader.js'
import { getMediaState } from '../media/media.js'

import { seqVerb } from '../base/list.js'
const state = {
  cols: 0, rows: 0,
  cells: null,   // Uint8Array (0/1)
  ages: null,    // Int32Array
  originX: 0, originY: 0,
  step: 1,       // pixel step for draw
  stepCount: 0,  // simulation ticks elapsed
  flowers: new Map(), // name → { c, r, tc, tr, st }
}

export function __resetGrid() {
  state.cols = 0; state.rows = 0
  state.cells = null; state.ages = null
  state.originX = 0; state.originY = 0
  state.step = 1; state.stepCount = 0
  state.flowers.clear()
}

// Symbol/name coercion helper used by the flower verbs. Kids pass names
// as plain symbols (flower-a) or strings ("flower-a"); we normalize to
// a string key in the flowers Map.
const nm = (x) => (x instanceof Sym ? x.name : x)

// Accessor for cross-file grid consumers (e.g. lib/system/core-toplevel.js
// which owns grid-step-3state/4state/aged). Returns the LIVE state object
// — mutations by the caller are seen here.
export function getGridState() { return state }


// ── inline registration metadata (2026-07-22) ────────────────────
// See engineering/HOW-TO-REGISTER-A-VERB.md.
export const VERBS = [
  "grid-cell-age",
  "grid-cell-set!",
  "grid-cell-state",
  "grid-cell?",
  "grid-cols",
  "grid-init",
  "grid-live-count",
  "grid-neighbors",
  "grid-origin",
  "grid-rows",
  "grid-step",
  "grid-step-count",
  "grid/card-center",
  "grid/clear",
  "grid/dot",
  "grid/flower-clear!",
  "grid/flower-go-to!",
  "grid/flower-list",
  "grid/flower-move-to!",
  "grid/flower-pos",
  "grid/flower-settled?",
  "grid/flower-spawn!",
  "grid/flower-state!",
  "grid/glow",
]
export const LAZY = false

export function installGrid(env, fuel) {
  const def = (n, f, perm = 'read') => env.define(n, seqVerb(f), { perm })

  // (grid-init cols rows) — allocate. Returns (cols rows).
  def('grid-init', (cols, rows) => {
    state.cols = cols | 0
    state.rows = rows | 0
    state.cells = new Uint8Array(state.cols * state.rows)
    state.ages = new Int32Array(state.cols * state.rows)
    state.stepCount = 0
    return [state.cols, state.rows]
  }, 'paint')

  // (grid-cols) → integer.
  def('grid-cols', () => state.cols)
  // (grid-rows) → integer.
  def('grid-rows', () => state.rows)

  // (grid-cell? c r) → boolean (is that cell live?)
  def('grid-cell?', (c, r) => {
    if (!state.cells) return false
    c |= 0; r |= 0
    if (c < 0 || r < 0 || c >= state.cols || r >= state.rows) return false
    return state.cells[r * state.cols + c] !== 0
  })

  // (grid-cell-age c r) → age (steps since last state change).
  def('grid-cell-age', (c, r) => {
    if (!state.ages) return 0
    c |= 0; r |= 0
    if (c < 0 || r < 0 || c >= state.cols || r >= state.rows) return 0
    return state.ages[r * state.cols + c]
  })

  // (grid-cell-set! c r on?) → the new value.
  def('grid-cell-set!', (c, r, on) => {
    if (!state.cells) return 0
    c |= 0; r |= 0
    if (c < 0 || r < 0 || c >= state.cols || r >= state.rows) return 0
    const idx = r * state.cols + c
    const cur = state.cells[idx]
    const v = (on === false || on === null || on === 0 || on == null) ? 0 : 1
    if (cur !== v) state.ages[idx] = 0
    state.cells[idx] = v
    return v
  }, 'paint')

  // (grid-cell-state c r) → 0 or 1.
  def('grid-cell-state', (c, r) => {
    if (!state.cells) return 0
    c |= 0; r |= 0
    if (c < 0 || r < 0 || c >= state.cols || r >= state.rows) return 0
    return state.cells[r * state.cols + c]
  })

  // (grid-live-count) → total live cells.
  def('grid-live-count', () => {
    if (!state.cells) return 0
    let n = 0
    for (let i = 0; i < state.cells.length; i++) if (state.cells[i]) n++
    return n
  })

  // (grid-neighbors c r) → list of (c r) for the 8 neighbors.
  def('grid-neighbors', (c, r) => {
    const out = []
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dc === 0 && dr === 0) continue
        out.push([c + dc, r + dr])
      }
    }
    return out
  })

  // (grid-origin) → (x y) pixel origin for drawing.
  def('grid-origin', () => [state.originX, state.originY])

  // (grid-step step?) → get/set the pixel step per cell.
  def('grid-step', (step) => {
    if (step != null) state.step = Math.max(1, step | 0)
    return state.step
  }, 'paint')

  // (grid-step-count) → simulation tick counter.
  def('grid-step-count', () => state.stepCount)

  // (grid/dot c r color?) — draw one live cell at (c, r) as a step×step
  // block starting at origin. Returns the drawn rect.
  def('grid/dot', (c, r, color) => {
    const st = getMediaState()
    if (!st || !st.fb) return undefined
    const px = state.originX + (c | 0) * state.step
    const py = state.originY + (r | 0) * state.step
    st.fb.rectFill(px, py, state.step, state.step, color | 0)
    return [new Sym('grid-dot'), c, r, state.step]
  }, 'paint')

  // (grid/clear) — clear the framebuffer AND zero the grid cells.
  def('grid/clear', () => {
    const st = getMediaState()
    if (st && st.fb) st.fb.clear(0)
    if (state.cells) state.cells.fill(0)
    if (state.ages) state.ages.fill(0)
    return undefined
  }, 'paint')

  // (grid/glow c r intensity?) — draw a dot with a glow color index.
  def('grid/glow', (c, r, intensity) => {
    const st = getMediaState()
    if (!st || !st.fb) return undefined
    const col = intensity != null ? (intensity | 0) : 10
    const px = state.originX + (c | 0) * state.step
    const py = state.originY + (r | 0) * state.step
    st.fb.rectFill(px, py, state.step, state.step, col)
    return [new Sym('grid-glow'), c, r, col]
  }, 'paint')

  // (grid/card-center col row) → (px py) — pixel-center of the cell.
  def('grid/card-center', (col, row) => [
    state.originX + (col | 0) * state.step + Math.floor(state.step / 2),
    state.originY + (row | 0) * state.step + Math.floor(state.step / 2),
  ])

  // ── Flowers (grid-anchored placeholder actors) ─────────────────────
  //
  // A "flower" is a named grid-anchored actor used in card game / kid
  // examples: place a flower at a cell; move it toward a target cell
  // one step per tick; ask if it has settled. Pure CORE — no rendering
  // side effects beyond the pos/state tables; renderers pick these up
  // and draw them however they want. NOT a dialect verb (no card/*
  // dependency); the flower is just a labeled sprite of your choice.

  // (grid/flower-spawn! id colour x y) → #t. Register the flower.
  //
  // CONFORMANCE fix (Shannon 2026-08-02): this took (name, col, row) — no
  // colour parameter — while the reference locks
  // `(grid/flower-spawn! id colour x y)` (30-grid.slat:552) and 90 of the 92
  // call sites in scheme/reference pass four arguments. The colour landed in
  // `col`, `'red' | 0` is 0, and the real column was read as the row, so every
  // one of those 90 examples spawned its flower at column 0 with the y
  // dropped entirely. `(grid/flower-spawn! 'rose 'red 3 4)` gave (0 . 3).
  // Nothing errored — the wrong cell just looked like a cell. Reference wins.
  def('grid/flower-spawn!', (name, colour, col, row) => {
    const nn = String(nm(name))
    state.flowers.set(nn, {
      c: col | 0, r: row | 0,
      tc: col | 0, tr: row | 0,
      colour: colour == null ? null : String(nm(colour)),
      st: 'idle',
    })
    return true
  }, 'paint')

  // (grid/flower-list) → list of flower names.
  def('grid/flower-list', () => Array.from(state.flowers.keys()))

  // (grid/flower-pos id) → (x . y) or #f.
  //
  // CONFORMANCE fix (Shannon 2026-08-02): returned the PROPER LIST [c, r], but
  // the reference locks a dotted pair — :signature "(grid/flower-pos id) ->
  // (x . y) or #f" (30-grid.slat:439), the prose "returns a pair (x . y) of
  // numbers", and every one of the 11 examples that destructures a result
  // reads it with (car p)/(cdr p); none use cadr. On a proper list (cdr p) is
  // the one-element list (y), which is truthy, so most of those examples
  // printed "(3)" where they meant "3" and only the two doing arithmetic on
  // it failed. Reference wins.
  def('grid/flower-pos', (name) => {
    const f = state.flowers.get(String(nm(name)))
    return f ? new Pair(f.c, f.r) : false
  })

  // (grid/flower-go-to! name col row) — set target cell; flower will
  // walk toward it on subsequent (grid/flower-move-to!) or step ticks.
  def('grid/flower-go-to!', (name, col, row) => {
    const f = state.flowers.get(String(nm(name)))
    if (!f) return false
    f.tc = col | 0; f.tr = row | 0
    f.st = 'walking'
    return true
  }, 'paint')

  // (grid/flower-move-to! name) — advance the flower one step toward
  // its target cell using Chebyshev (king) moves. Returns the new (c r).
  def('grid/flower-move-to!', (name) => {
    const f = state.flowers.get(String(nm(name)))
    if (!f) return false
    const dc = Math.sign(f.tc - f.c)
    const dr = Math.sign(f.tr - f.r)
    f.c += dc; f.r += dr
    if (f.c === f.tc && f.r === f.tr) f.st = 'idle'
    return [f.c, f.r]
  }, 'paint')

  // (grid/flower-settled? name) → boolean. True iff at its target and
  // state is 'idle. Kids call this from the tick loop as a stop
  // condition for a "walk over here" motion.
  def('grid/flower-settled?', (name) => {
    const f = state.flowers.get(String(nm(name)))
    if (!f) return false
    return f.c === f.tc && f.r === f.tr && f.st === 'idle'
  })

  // (grid/flower-state! name new-state?) — get or set the state symbol.
  // Common values: 'idle 'walking 'bloom 'wilted. Kid-choosable.
  def('grid/flower-state!', (name, newState) => {
    const f = state.flowers.get(String(nm(name)))
    if (!f) return false
    if (newState != null) f.st = String(nm(newState))
    return new Sym(f.st)
  }, 'paint')

  // (grid/flower-clear!) → drop every flower. Framebuffer is untouched.
  def('grid/flower-clear!', () => {
    state.flowers.clear()
    return true
  }, 'paint')

  return env
}

export default installGrid
