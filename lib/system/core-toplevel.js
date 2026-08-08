// core-toplevel.js — leftover top-level CORE verbs the manifest hadn't
// wired yet. As of 2026-07-22 the audit showed 30 CORE entries with no
// impl; 27 were audio-* and camera-* (own files). This file owns the
// remaining 3:
//
//   grid-step-3state rule-fn   — advance a 3-state cellular automaton
//   grid-step-4state rule-fn   — advance a 4-state cellular automaton
//   grid-step-aged rule-fn     — binary CA that tracks per-cell age
//
// Provenance: signatures + semantics from scheme/reference/01-core.slat
// verb records (2026-07-22). The bulk grid state (cols/rows/cells/ages)
// lives in lib/game/grid.js; we import its module-private state via a
// small getter so a cart that calls grid-init then grid-step-3state
// sees the same grid.
//
// Note (2026-07-22): the task prompt lists `at-beat`, `big-bang`,
// `escalate`, and `display` alongside these three. Runtime probes on
// 2026-07-22 confirmed those four are ALREADY bound by other lib files
// (scheduler.js, game-instances.js, r7rs-small.js). This file adds
// only the still-missing grid-step-* verbs so we don't collide.

import { Sym } from '../../src/reader.js'
import { apply as _apply } from '../../src/interp.js'
import { getGridState } from '../game/grid.js'


import { seqVerb } from '../base/list.js'
// ── inline registration metadata (2026-07-22) ────────────────────
// See engineering/HOW-TO-REGISTER-A-VERB.md.
export const VERBS = [
  "grid-step-3state",
  "grid-step-4state",
  "grid-step-aged",
  // Sensor + notation top-level (2026-07-22 completion).
  "input-may-i?",
  "note-dots",
  "note-place",
  "note-place-at",
  "note-release",
  "note-strike",
]
export const LAZY = false

// Route rule-fn calls through the interpreter's apply so Scheme
// Closures (which don't fire on a bare native call) work the same as
// native JS functions. Matches the pattern in game-instances.js.
function _callRule(fn, args) {
  if (typeof fn === 'function') return fn(...args)
  if (fn && fn.params) return _apply(fn, args, { n: 200000 })
  return null
}

// Count live neighbours (state > 0) on a wrap-free 8-neighbour cell.
function _countLiveNeighbours(cells, cols, rows, c, r) {
  let n = 0
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dc === 0 && dr === 0) continue
      const nc = c + dc, nr = r + dr
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue
      if (cells[nr * cols + nc] > 0) n++
    }
  }
  return n
}

function _stepMultiState(ruleFn, clampMax) {
  const g = getGridState()
  if (!g || !g.cells || g.cols === 0 || g.rows === 0) return undefined
  const { cols, rows, cells, ages } = g
  const next = new Uint8Array(cells.length)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c
      const cur = cells[idx]
      const nHeads = _countLiveNeighbours(cells, cols, rows, c, r)
      let nv = cur
      if (ruleFn != null) {
        const out = _callRule(ruleFn, [cur, nHeads])
        const asNum = Number(out)
        if (Number.isFinite(asNum)) nv = Math.max(0, Math.min(clampMax, asNum | 0))
      } else {
        // No rule provided → default = Conway's Life on binary axis.
        if (cur > 0) nv = (nHeads === 2 || nHeads === 3) ? 1 : 0
        else         nv = (nHeads === 3) ? 1 : 0
      }
      next[idx] = nv
      if (ages) {
        if (nv !== cur) ages[idx] = 0
        else if (ages[idx] < 65535) ages[idx] += 1
      }
    }
  }
  cells.set(next)
  if (g.stepCount != null) g.stepCount += 1
  return undefined
}

export function installCoreToplevel(env, ctx) {
  const def = (n, f, perm = 'read') => env.define(n, seqVerb(f), { perm })

  // (grid-step-3state rule-fn?) — rule returns 0|1|2 for (state, nHeads).
  def('grid-step-3state', (ruleFn) => _stepMultiState(ruleFn, 2), 'paint')

  // (grid-step-4state rule-fn?) — rule returns 0|1|2|3 for (state, nHeads).
  def('grid-step-4state', (ruleFn) => _stepMultiState(ruleFn, 3), 'paint')

  // (grid-step-aged rule-fn?) — binary automaton with per-cell age
  // tracking. Rule returns 0|1. Aging is done inside _stepMultiState.
  def('grid-step-aged', (ruleFn) => _stepMultiState(ruleFn, 1), 'paint')

  // ── input sensor gate (2026-07-22) ────────────────────────────
  // (input-may-i?) — asks whether the input sensor is currently
  // allowed. Host installs a live gate; headless Motoi returns #t
  // (sensor available). Reference: 01-core.slat's input-may-i? +
  // scheme/reference/34-input.slat.
  // A Motoi lambda is a Closure, not a JS function, so `typeof fn ===
  // 'function'` was false for the exact argument this verb exists to take:
  // the predicate fell into the constant branch and was stored as a truthy
  // value, which locks the gate permanently OPEN — the opposite of intent.
  // The constant branch also read JS truthiness, so (input-may-i-set! 0)
  // closed the gate though 0 is true in Scheme.
  let _sensorGate = () => true
  def('input-may-i?', () => _sensorGate() !== false)
  def('input-may-i-set!', (fn) => {
    _sensorGate = (typeof fn === 'function' || (fn && fn.params))
      ? () => _callRule(fn, []) !== false
      : () => fn !== false
    return true
  }, 'paint')

  // ── note-* top-level notation aliases (2026-07-22) ────────────
  // The 43-note.slat reference wraps these in a `note/` namespace
  // AND surfaces the dashed aliases at top level for shorthand in
  // musical carts. Both call into the same state.
  //
  // note-place / note-place-at — put a glyph at a staff slot.
  // note-strike / note-release — sound/cut a sustained pitch.
  // note-dots — set the dot-count decoration on the most recent note.
  const _staffState = { placed: [], sustained: null, dots: 0 }
  const nmSym = (x) => (x instanceof Sym ? x.name : String(x))
  def('note-place', (pitch, stave) => {
    _staffState.placed.push({ pitch: nmSym(pitch), stave: stave ?? 0 })
    return new Sym('placed')
  }, 'paint')
  def('note-place-at', (pitch, stave, clef) => {
    _staffState.placed.push({ pitch: nmSym(pitch), stave: stave ?? 0, clef: clef ? nmSym(clef) : 'treble' })
    return new Sym('placed')
  }, 'paint')
  def('note-strike', (pitch, duration) => {
    _staffState.sustained = { pitch: nmSym(pitch), duration: duration ?? 1 }
    return new Sym('struck')
  }, 'paint')
  def('note-release', () => {
    _staffState.sustained = null
    return new Sym('released')
  }, 'paint')
  def('note-dots', (count) => {
    _staffState.dots = Number(count) || 0
    return _staffState.dots
  }, 'paint')

  return env
}

export default installCoreToplevel
