// time-verbs.js — L1.5 time/* modules (nao-commerce lane, 2026-07-14).
//
// Provenance: scheme-lang/src/time-verbs.js. Migrated to
// motoi-scheme/lib/system/ on 2026-07-16 (Pass-3 Wave 1). Reference
// file path updated SAKURA-SCHEME-REFERENCE.slat → MOTOI-SCHEME-REFERENCE.slat.
//
// Two flavors of verb here:
//
//   1. time/delta — a wall-clock read. Returns the elapsed time since
//      the last call in a named unit (ms/s/m/h/d). Pure math over the
//      module-local clock cursor.
//
//   2. time/during / time/until / time/when / time/every-ms / time/then
//      — meta-verbs. Each returns a tagged clause data structure that
//      big-bang consumes. Standalone REPL builds and returns the
//      clause; the host loop (when running) executes it.
//
//   3. time/across — AUTHOR-BLOCKED. Reference signature is *[verify]*
//      and behavior is undocumented. Per Alfred: no hallucination. We
//      register a clean-error stub with an explicit :entry-provenance
//      "author-blocked" message.
//
// Installed BEFORE installWiredVerbs (which stubs time/* as descriptors)
// so the preExisting check there skips our names. Since installAlg and
// installEng already run in makeBaseEnv, we sit in the same layer.

import { Sym } from '../../src/reader.js'

// Wall-clock cursor. Module-local so time/delta returns real deltas
// across a session. First call reports 0 (no prior tick).
const clock = {
  last: null,   // ms since epoch of last time/delta call
}

const nm = (x) => (x instanceof Sym ? x.name : x)

// Convert ms to the requested unit; returns null on unknown unit.
function convertUnit(ms, unit) {
  switch (unit) {
    case 'ms': return ms
    case 's':  return ms / 1000
    case 'm':  return ms / 60000
    case 'h':  return ms / 3600000
    case 'd':  return ms / 86400000
    default:   return null
  }
}

export function installTime(env) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  // (time/delta unit) -> number
  //
  // Elapsed ms/s/m/h/d since last call. First call returns 0 (no prior
  // tick — start of session). Unknown unit returns the 'nan sentinel
  // symbol per the tick/* verb convention. Wall-clock, not frame-tied,
  // so it survives paused execution honestly.
  //
  // BUG-11 fix (Zane-2, 2026-07-17): validate the unit BEFORE consuming
  // the wall-clock tick. Previously clock.last was updated even when the
  // caller passed an unknown unit, so the *next* legit call under-reported
  // its delta by the amount of the botched call's real elapsed time.
  def('time/delta', (unit) => {
    const u = nm(unit) || 'ms'
    // Cheap unit check: if unknown, do NOT touch the clock — return 'nan
    // and let the caller retry with a valid unit without losing the tick.
    if (convertUnit(0, u) === null) return new Sym('nan')
    const now = Date.now()
    const prev = clock.last
    clock.last = now
    const ms = prev === null ? 0 : (now - prev)
    return convertUnit(ms, u)
  })

  // (time/during predicate clause) -> tagged clause
  //
  // Meta-verb: bundles a predicate and a body clause into a "run body
  // each frame while predicate is true" declarative record. The clause
  // is consumed by big-bang.
  def('time/during', (pred, body) => {
    return [new Sym('clause/during'), pred, body]
  })

  // (time/until predicate clause) -> tagged clause
  //
  // Meta-verb: run the body each frame; signal done once predicate
  // becomes true. Pairs with time/then for sequential composition.
  def('time/until', (pred, body) => {
    return [new Sym('clause/until'), pred, body]
  })

  // (time/when predicate clause) -> tagged clause
  //
  // Meta-verb: one-shot trigger. The body runs exactly once, the first
  // frame the predicate is true.
  def('time/when', (pred, body) => {
    return [new Sym('clause/when'), pred, body]
  })

  // (time/every-ms milliseconds clause) -> tagged clause
  //
  // Meta-verb: wall-clock throttle. Wraps a clause so it fires at most
  // once per N milliseconds.
  def('time/every-ms', (ms, body) => {
    return [new Sym('clause/every-ms'), ms, body]
  })

  // (time/then clause-a clause-b) -> tagged clause
  //
  // Meta-verb: sequential composition. Run A until it signals done,
  // then run B.
  def('time/then', (a, b) => {
    return [new Sym('clause/then'), a, b]
  })

  // (time/across ...) -> AUTHOR-BLOCKED
  //
  // Reference file docs/MOTOI-SCHEME-REFERENCE.slat marks this verb's
  // signature and behavior as "*[verify]*" — undocumented. Per Alfred:
  // "We can't lie to people. They trust us." We refuse to invent
  // semantics. The verb registers so scripts parse; calling it returns
  // a well-shaped author-blocked descriptor telling the caller that
  // this verb is pending upstream clarification.
  def('time/across', (...args) => {
    return [
      new Sym('author-blocked'),
      new Sym('time/across'),
      new Sym('reason'),
      'reference signature and behavior are undocumented (marked *[verify]* in MOTOI-SCHEME-REFERENCE.slat). Escalated to Alfred; awaiting canonical spec before wiring.',
      new Sym('args'),
      args,
    ]
  })

  // ── added 2026-07-16, Wave 1 CORE completion ─────────────────────────
  // Simple wall-clock verbs used by scheduler-style code and by
  // Motoi Copilot training pairs.

  // (time/now) → current ms-since-epoch.
  def('time/now', () => Date.now())

  // (time/iso ms?) → ISO 8601 string for ms (default: now).
  def('time/iso', (ms) => new Date(ms == null ? Date.now() : ms).toISOString())

  // (time/from-ms ms unit) → ms converted to unit ('s 'm 'h 'd 'ms).
  def('time/from-ms', (ms, unit) => {
    const u = nm(unit) ?? 'ms'
    const v = convertUnit(ms, u)
    return v == null ? new Sym('nan') : v
  })

  // (time/to-ms n unit) → convert n of unit into ms.
  def('time/to-ms', (n, unit) => {
    switch (nm(unit)) {
      case 'ms': return n
      case 's':  return n * 1000
      case 'm':  return n * 60000
      case 'h':  return n * 3600000
      case 'd':  return n * 86400000
      default:   return new Sym('nan')
    }
  })
}

// Test seam — reset the wall-clock cursor between suite runs.
export function __resetTimeClock() {
  clock.last = null
}

export default installTime
