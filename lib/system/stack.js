// lib/system/stack.js — motoi/stack: a small evaluation-frame ledger.
//
// Provenance: 2026-07-19 (Marcus, TUI wave). Alfred wants a live call
// stack panel in the terminal IDE. Rather than reach into interp.js
// from the panel, we hang a tiny push/pop ledger off a shared module
// singleton and expose it through:
//
//   motoi/stack               → current frames, deepest first
//   motoi/stack-peak          → the highest depth touched since reset
//   motoi/stack-clear!        → drop the ledger + reset the peak
//
// Each frame is an alist:
//   ((:name  <verb-or-lambda>)
//    (:kind  'primitive | 'closure | 'special)
//    (:depth <int>))
//
// Doctrine: additive. If interp.js never pushes, everything here just
// returns an empty list — no crashes. The interp *does* push, but only
// when this module registers itself; before that the hooks are no-ops.

import { Sym } from '../../src/reader.js'
import { setStackHooks, clearStackHooks } from '../../src/interp.js'

// ── singleton ledger ─────────────────────────────────────────────────

const _state = {
  frames: [],   // live stack — grows on push, shrinks on pop
  peak: [],     // deepest frame set seen since the last clear
  peakDepth: 0,
  lastCompleted: [],  // snapshot of the stack right before the last pop-to-zero
}

function push(name, kind) {
  const depth = _state.frames.length + 1
  _state.frames.push({ name: String(name || '?'), kind: String(kind || 'closure'), depth })
  if (depth > _state.peakDepth) {
    _state.peakDepth = depth
    _state.peak = _state.frames.slice()
  }
}

function pop() {
  const f = _state.frames.pop()
  if (_state.frames.length === 0 && f) {
    // Root pop — remember the peak we hit during this evaluation as the
    // "last completed" view for idle rendering.
    _state.lastCompleted = _state.peak.slice()
  }
  return f
}

function clear() {
  _state.frames = []
  _state.peak = []
  _state.peakDepth = 0
  _state.lastCompleted = []
}

/** Test-only. Real callers don't reach in here. */
export function _stackState() { return _state }

// ── verb install ─────────────────────────────────────────────────────

function frameToAlist(f) {
  return [
    [new Sym(':name'),  f.name],
    [new Sym(':kind'),  new Sym(f.kind)],
    [new Sym(':depth'), f.depth],
  ]
}

/**
 * Register the motoi/stack surface + wire the interp hooks so eval
 * begins ledgering. Idempotent: calling twice reinstalls the same
 * hooks (harmless — same module singleton).
 */
export function installStack(env, fuel) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  setStackHooks({ push, pop })

  // (motoi/stack) → live frames, deepest first (top of list = deepest).
  def('motoi/stack', () => {
    const frames = _state.frames.length > 0
      ? _state.frames
      : _state.lastCompleted
    // Deepest first — matches the way a debugger presents "you're here"
    // at the top with unwinds beneath.
    const ordered = frames.slice().reverse()
    return ordered.map(frameToAlist)
  })

  // (motoi/stack-peak) → highest frame set seen since last clear.
  def('motoi/stack-peak', () => {
    const ordered = _state.peak.slice().reverse()
    return ordered.map(frameToAlist)
  })

  // (motoi/stack-depth) → current live depth (integer).
  def('motoi/stack-depth', () => _state.frames.length)

  // (motoi/stack-clear!) → reset the ledger. Returns #t.
  def('motoi/stack-clear!', () => { clear(); return true }, 'state-change')

  return { installed: ['motoi/stack', 'motoi/stack-peak', 'motoi/stack-depth', 'motoi/stack-clear!'] }
}

/** Test-only. Removes interp hooks so the module singleton doesn't leak
 *  between tests. */
export function _uninstallStack() {
  clearStackHooks()
  clear()
}

export default installStack
