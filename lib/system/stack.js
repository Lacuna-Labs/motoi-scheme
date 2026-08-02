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
//
// RECORDING IS OFF BY DEFAULT (2026-08-02). Installing this module used to
// wire the interp hooks immediately, and since it is an eager part of the
// core bundle that meant every program in the language paid for the ledger.
// Measured on a fib(21) + 60k-iteration loop: 22% of total evaluation time,
// spent allocating a frame object per closure application and unwinding it
// through a try/finally that nothing was reading. The count hook next door
// costs 1.2% and stays on; this one does not.
//
// A live call stack is a DEBUGGER'S instrument, so it arms where a debugger
// lives — the TUI, the IDE server, the REPL — or on request via
// `(motoi/stack-record! #t)` / `MOTOI_STACK=1`. When it is off the verbs say
// so rather than reporting an empty stack, which would read as "your program
// has no frames" instead of "nobody was writing them down".

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

// ── recording gate ───────────────────────────────────────────────────

let _recording = false

/** Arm or disarm the ledger. Returns the resulting state. */
export function setStackRecording(on) {
  const want = on !== false && on !== null && on !== undefined
  if (want === _recording) return _recording
  _recording = want
  if (want) setStackHooks({ push, pop })
  else { clearStackHooks(); clear() }
  return _recording
}

export function isStackRecording() { return _recording }

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

// ── inline registration metadata (2026-07-22) ────────────────────
// See engineering/HOW-TO-REGISTER-A-VERB.md.
export const VERBS = [
  "motoi/stack",
  "motoi/stack-clear!",
  "motoi/stack-depth",
  "motoi/stack-peak",
  "motoi/stack-record!",
  "motoi/stack-recording?",
]
export const LAZY = false

// What the frame verbs answer while recording is off. It is shaped like a
// frame so every existing reader — the TUI panel, the IDE server — renders it
// without a special case, and it says the true thing: the ledger was not
// running, which is not the same as the program having no frames.
const OFF_FRAME = () => ([[
  [new Sym(':name'), '(stack recording is off — (motoi/stack-record! #t) to start)'],
  [new Sym(':kind'), new Sym('off')],
  [new Sym(':depth'), 0],
]])

export function installStack(env, fuel) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  // Honour an explicit opt-in from the environment so a profiling script or a
  // one-off `MOTOI_STACK=1 motoi run …` gets the ledger without code changes.
  if (process.env.MOTOI_STACK === '1') setStackRecording(true)

  // (motoi/stack) → live frames, deepest first (top of list = deepest).
  def('motoi/stack', () => {
    if (!_recording) return OFF_FRAME()
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
    if (!_recording) return OFF_FRAME()
    const ordered = _state.peak.slice().reverse()
    return ordered.map(frameToAlist)
  })

  // (motoi/stack-depth) → current live depth (integer), or #f when the
  // ledger is off. #f rather than 0: we do not know the depth, and 0 is a
  // number a caller would reasonably do arithmetic on.
  def('motoi/stack-depth', () => (_recording ? _state.frames.length : false))

  // (motoi/stack-clear!) → reset the ledger. Returns #t.
  def('motoi/stack-clear!', () => { clear(); return true }, 'state-change')

  // (motoi/stack-record! on?) → arm or disarm the ledger; returns the new
  // state. Recording costs roughly a fifth of evaluation time, which is why
  // it is not the default — turn it on around the code you are debugging.
  def('motoi/stack-record!', (on) => setStackRecording(on !== false), 'state-change')

  // (motoi/stack-recording?) → #t when the ledger is running.
  def('motoi/stack-recording?', () => _recording)

  return { installed: VERBS.slice() }
}

/** Test-only. Removes interp hooks so the module singleton doesn't leak
 *  between tests. */
export function _uninstallStack() {
  setStackRecording(false)
}

export default installStack
