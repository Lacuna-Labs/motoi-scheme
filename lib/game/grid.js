// grid.js — Conway-style grid ops + a `grid/dot` draw verb.
//
// Doctrine (Alfred, 2026-07-16): a grid is a 2D bitmap of cells with
// per-cell age (steps since last state change). `grid-init` allocates
// it; `grid-neighbors` returns the 8-neighborhood; grid/dot draws one
// cell into the framebuffer.

import { Sym } from '../../src/reader.js'
import { getMediaState } from '../media/media.js'

const state = {
  cols: 0, rows: 0,
  cells: null,   // Uint8Array (0/1)
  ages: null,    // Int32Array
  originX: 0, originY: 0,
  step: 1,       // pixel step for draw
  stepCount: 0,  // simulation ticks elapsed
}

export function __resetGrid() {
  state.cols = 0; state.rows = 0
  state.cells = null; state.ages = null
  state.originX = 0; state.originY = 0
  state.step = 1; state.stepCount = 0
}

export function installGrid(env, fuel) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

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

  return env
}

export default installGrid
