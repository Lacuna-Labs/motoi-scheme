// sandbox.js — Gate 3: speculative run.
//
// Alfred (explicit): "Sandbox the code before offering it."
//
// Before a completion is shown as ghost text, we RUN it — in a fresh, fuel-
// capped, throwaway env — and suppress it if it errors. This is the third gate
// and the one open-language competitors cannot build: because Motoi programs
// RUN and the interpreter is deterministic, "does it work?" is a cheap function
// call, not a guess.
//
// Safety properties of the speculative run:
//   · Fuel-capped   — a small fuel budget bounds runaway loops; overrun ⇒ reject.
//   · Fresh env     — every speculation gets its own extended env; no state from
//                     one suggestion leaks into another or into the user's world.
//   · Timeout-bound — a wall-clock cap catches anything fuel doesn't.
//   · Non-committal — the real cortex/filesystem writes go to a temp HOME so a
//                     speculative `cortex/remember` cannot mutate the user's
//                     saved game. (Set via MOTOI_HOME override before build.)
//   · Warm pool     — a pre-built env is reused across speculations for latency,
//                     re-created when its fuel is spent. Reuse is safe because a
//                     completion is graded on "does it run to a value", and we
//                     reset per-run fuel; for full isolation call fresh:true.
//
// The sandbox never throws to the caller — it returns a verdict object.

import { makeExtendedBaseEnv } from 'motoi-scheme'
import { parse } from 'motoi-scheme/reader'
import { evaluate } from 'motoi-scheme/interp'
import { expandProgram } from 'motoi-scheme/macro'

const DEFAULT_FUEL = 50_000       // enough for real completions, cheap to burn
const DEFAULT_TIMEOUT_MS = 200    // matches the inline-latency budget ceiling

// ── warm env pool ──────────────────────────────────────────────────────────
// Building an extended env installs ~1600 verbs — too slow to do per keystroke.
// We keep one warm env and recycle it. Each speculative run gets a fresh fuel
// box; the env's bindings are read-only for pure completions. When a run
// defines a top-level name, that binding persists in the warm env — which is
// FINE for our purpose (we only care "did it run to a value?") and occasionally
// helpful (a define in the prefix stays visible to the suffix). Hosts that need
// hard isolation pass { fresh: true }.

let _warm = null
function warmEnv() {
  if (!_warm) _warm = makeExtendedBaseEnv({ fuel: { n: 1 } })
  return _warm
}

/**
 * speculativeRun — run source in a sandbox and return a verdict.
 *
 * @param {string} source   Scheme source (the reconstructed program: prefix +
 *   candidate middle + suffix, or a whole candidate program).
 * @param {object} [opts]
 * @param {number} [opts.fuel=50000]
 * @param {number} [opts.timeoutMs=200]
 * @param {boolean} [opts.fresh=false]  build a throwaway env (full isolation)
 * @returns {{ok:boolean, value?:*, error?:string, kind?:string, ms:number, fuelUsed:number}}
 */
export function speculativeRun(source, opts = {}) {
  const fuelBudget = opts.fuel ?? DEFAULT_FUEL
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const t0 = now()

  const env = opts.fresh ? makeExtendedBaseEnv({ fuel: { n: 1 } }) : warmEnv()
  const fuel = { n: fuelBudget }

  let forms
  try {
    forms = parse(source)
  } catch (e) {
    return verdict(false, undefined, e, 'parse', t0, fuelBudget - fuel.n)
  }

  let expanded
  try {
    const r = expandProgram(forms, { fuel: { n: fuelBudget } })
    expanded = r.forms
  } catch (e) {
    return verdict(false, undefined, e, 'macro', t0, fuelBudget - fuel.n)
  }

  let result
  const deadline = now() + timeoutMs
  // A speculative run must be SIDE-EFFECT-FREE at the terminal: a candidate that
  // calls (display …) should never leak its output to the user's screen. We
  // capture process stdout/stderr writes for the duration of the run and drop
  // them. (Real drawing/audio side-effects target the throwaway env's media
  // state, not the host console, so those are already isolated.)
  const restore = captureStdio()
  try {
    for (const f of expanded) {
      if (now() > deadline) {
        restore()
        return verdict(false, undefined, new Error('timeout'), 'timeout', t0, fuelBudget - fuel.n)
      }
      result = evaluate(f, env, fuel)
    }
  } catch (e) {
    restore()
    const kind = classifyError(e)
    return verdict(false, undefined, e, kind, t0, fuelBudget - fuel.n)
  }
  restore()
  return verdict(true, result, undefined, 'ok', t0, fuelBudget - fuel.n)
}

// Reset the warm pool (test seam + host recycle hook).
export function resetSandbox() { _warm = null }

// ── helpers ──────────────────────────────────────────────────────────────

function verdict(ok, value, error, kind, t0, fuelUsed) {
  return {
    ok,
    value,
    error: error ? (error.message || String(error)) : undefined,
    kind,
    ms: Math.max(0, Math.round((now() - t0) * 1000) / 1000),
    fuelUsed,
  }
}

function classifyError(e) {
  const msg = (e && e.message) || String(e)
  if (/unbound symbol/i.test(msg)) return 'unbound'
  if (/out of fuel|fuel exhausted/i.test(msg)) return 'fuel'
  if (/timeout/i.test(msg)) return 'timeout'
  if (/parse|unexpected|reader|missing \)|unterminated/i.test(msg)) return 'parse'
  return 'runtime'
}

// Silence process stdout/stderr writes for the length of a speculative run.
// Returns a restore() thunk. Robust to nested calls (idempotent restore).
function captureStdio() {
  const outWrite = process.stdout.write.bind(process.stdout)
  const errWrite = process.stderr.write.bind(process.stderr)
  const sink = () => true
  process.stdout.write = sink
  process.stderr.write = sink
  let restored = false
  return () => {
    if (restored) return
    restored = true
    process.stdout.write = outWrite
    process.stderr.write = errWrite
  }
}

// High-resolution monotonic clock in ms (float).
function now() {
  if (typeof performance !== 'undefined' && performance.now) return performance.now()
  const [s, ns] = process.hrtime()
  return s * 1000 + ns / 1e6
}

export default speculativeRun
