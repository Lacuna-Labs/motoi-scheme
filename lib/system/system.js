// system.js — input/* + system/* real implementations.
//
// Provenance: scheme-lang/src/system.js. Migrated to
// motoi-scheme/lib/system/ on 2026-07-16 (Pass-3 Wave 1). The internal
// `_sakuraStub` property protocol is preserved (cross-file marker used
// by base.js / verbStatus.js / autocomplete.js — renaming is a repo-
// wide refactor deferred to a later pass).
//
// Owner: hiroshi (Lacuna Eng, input+system+eng lane, 2026-07-14).
//
// Alfred's floor rule: "We can't lie to people. They trust us."
// Every verb here returns the TRUTH of the runtime state — not a fake
// tagged descriptor. If a host frame loop isn't attached, the runtime
// button-state map is honestly empty (all buttons up, all edges clear),
// and reads reflect that. If a host DOES wire up and starts calling
// input/set!, reads reflect the new state through the same path.
//
// Layout:
//   - A single module-level `state` holds the button-map, edge-map, and
//     the permission flag. This is per-process (there's only one runtime
//     per JS module load); tests reset via __resetSystemState().
//   - installSystem(env) registers 10 verbs: 5 input/*, 5 system/*.
//   - Providers can be injected so system/registry, system/health, etc.
//     walk the LIVE env at call time (not the env at install time — the
//     env grows after we install).
//
// The 6 eng/* verbs live in base.js — they're pure math with no state,
// so they belong beside the other math primitives.

import { Sym } from '../../src/reader.js'

// Six canonical buttons — matches the reference's input/buttons contract.
const BUTTON_NAMES = ['up', 'down', 'left', 'right', 'a', 'b']

// Fresh state factory — used at module load and by __resetSystemState.
function freshState() {
  const held = new Map()      // button-name → boolean (currently held)
  const pressed = new Map()   // button-name → boolean (edge: went down since last frame)
  for (const b of BUTTON_NAMES) {
    held.set(b, false)
    pressed.set(b, false)
  }
  return {
    held,
    pressed,
    // Permission gate. Base runtime imposes no constraint, so the
    // default is #t (permitted). A host or accessibility layer can
    // flip it via a future input/set-permission! (not in this lane).
    permission: true,
    // Health snapshot — updated by future runtime hooks. Reference
    // permits all-null return, which is what an unwired runtime honestly
    // has. Keys use the exact spelling from the reference so downstream
    // (assoc 'fuel_exhausted h) reads work.
    health: { quarantined: null, fuel_exhausted: null, illusions: null },
    // Scheduler snapshot — three fuel tanks and a queue depth. Reference
    // permits null fields; base runtime has no scheduler attached, so
    // all three are null. A host with a real scheduler injects real
    // numbers via setSchedulerProvider.
    scheduler: { work: null, speech: null, Q_depth: null },
    // Surface snapshot — cards, grid, entities, camera. Base runtime
    // has no host surface, so cards=() and camera=default. Not a lie:
    // the base runtime literally HAS no surface.
    surface: {
      cards: [],
      camera: { x: 0, y: 0, k: 1 },
      entities: [],
      grid: null,
    },
    // Card fleet — same list system/surface reads. Base runtime: empty.
    cards: [],
  }
}

let state = freshState()

// Host adapter — attaches a callback so an outer runtime (with a real
// card fleet, live scheduler, etc.) can override the snapshots without
// this file knowing about it. Base runtime keeps the honest defaults.
let cardsProvider = null    // () -> [card, ...]
let healthProvider = null   // () -> { quarantined, fuel_exhausted, illusions }
let schedulerProvider = null // () -> { work, speech, Q_depth }
let surfaceProvider = null  // () -> { cards, camera, entities, grid, ... }
let registryProvider = null // (domain) -> [entry, ...]  — walks something at call time

// ─── Public API for host injection ─────────────────────────────────
export function setCardsProvider(fn)     { cardsProvider = typeof fn === 'function' ? fn : null }
export function setHealthProvider(fn)    { healthProvider = typeof fn === 'function' ? fn : null }
export function setSchedulerProvider(fn) { schedulerProvider = typeof fn === 'function' ? fn : null }
export function setSurfaceProvider(fn)   { surfaceProvider = typeof fn === 'function' ? fn : null }
export function setRegistryProvider(fn)  { registryProvider = typeof fn === 'function' ? fn : null }

// Test helper — reset the entire in-runtime system state to fresh
// defaults. All providers are cleared. Used by unit tests and by REPL
// harnesses that want a clean slate.
export function __resetSystemState() {
  state = freshState()
  cardsProvider = null
  healthProvider = null
  schedulerProvider = null
  surfaceProvider = null
  registryProvider = null
}

// Test helper — peek at the state slot. Do NOT use from user code; this
// is the JS-side back door only for tests.
export function __peekSystemState() { return state }

// ─── Small helpers ─────────────────────────────────────────────────
const nm = (x) => (x instanceof Sym ? x.name : String(x))
const isKnownButton = (b) => BUTTON_NAMES.indexOf(b) !== -1

// Convert a JS assoc-list into a Scheme association list — a list of
// (key value) pairs. Reference tools use `(assoc 'field snap)` which
// R7RS/Scheme resolves by scanning a list of 2-element lists.
const alist = (obj) => Object.entries(obj).map(([k, v]) => [new Sym(k), v])

// ─── Installer ─────────────────────────────────────────────────────
export function installSystem(env) {
  // input/* live here; permission tier per the audit.
  const def = (n, f, perm) => env.define(n, f, { perm })

  // ── input/buttons ─────────────────────────────────────────────────
  // Pure — constant list of six button symbols. Same list every call.
  // The reference says "immutable"; we return a fresh array each call
  // so accidental mutation doesn't corrupt state, but the values are
  // identical each time.
  def('input/buttons', () => BUTTON_NAMES.map((n) => new Sym(n)), 'read')

  // ── input/down? ───────────────────────────────────────────────────
  // Read the held-state map. Unknown button names return #f (matches
  // the reference caveat: "invalid names always return false").
  def('input/down?', (button) => {
    const b = nm(button)
    if (!isKnownButton(b)) return false
    return state.held.get(b) === true
  }, 'read')

  // ── input/pressed? ────────────────────────────────────────────────
  // Read the edge-map. True for exactly the frame after a false→true
  // transition. The frame-clear happens externally (a host's frame
  // loop calls the internal clear at end-of-frame). In the base REPL
  // with no host loop, edges persist until the next input/set! writes
  // a false-then-true — which is honest: nothing IS clearing frames.
  def('input/pressed?', (button) => {
    const b = nm(button)
    if (!isKnownButton(b)) return false
    return state.pressed.get(b) === true
  }, 'read')

  // ── input/may-i? ──────────────────────────────────────────────────
  // The permission gate. Base runtime: #t (no host constraint).
  def('input/may-i?', () => state.permission === true, 'read')

  // ── input/set! ────────────────────────────────────────────────────
  // Host hook — mutate the held state. Setting false→true triggers a
  // press edge (matches reference: "Setting a button to true from
  // false triggers a press edge"). Unknown buttons are silently
  // ignored (matches reference: "invalid button names are silently
  // ignored by the host").
  def('input/set!', (button, held) => {
    const b = nm(button)
    if (!isKnownButton(b)) return undefined
    const wasHeld = state.held.get(b) === true
    const nowHeld = held === true || (held !== false && held != null && held !== 0)
    state.held.set(b, nowHeld)
    if (!wasHeld && nowHeld) state.pressed.set(b, true)
    return undefined
  }, 'state-change')

  // ── system/cards ──────────────────────────────────────────────────
  // Snapshot the card fleet. Base runtime: empty list. A host adapter
  // can inject real cards via setCardsProvider — same code path.
  def('system/cards', () => {
    if (cardsProvider) {
      try {
        const cards = cardsProvider()
        return Array.isArray(cards) ? cards : []
      } catch { return [] }
    }
    return state.cards.slice()
  }, 'read')

  // ── system/health ─────────────────────────────────────────────────
  // Reference explicitly permits all-null return when the health
  // provider is unavailable. We return an assoc-list so Scheme's
  // (assoc 'quarantined h) works as documented.
  def('system/health', () => {
    if (healthProvider) {
      try { return alist(healthProvider()) } catch { return alist({ quarantined: null, fuel_exhausted: null, illusions: null }) }
    }
    return alist(state.health)
  }, 'read')

  // ── system/registry ───────────────────────────────────────────────
  // Walk the env's own verb bindings and return a snapshot. Each entry
  // is an assoc-list with :name, :kind keys.
  //
  // We hold a live env reference so the registry reflects the FULL
  // stack at call time (post-installWiredVerbs, post-registerReferenceVerbs).
  def('system/registry', (...args) => {
    const domain = args.length > 0 ? nm(args[0]) : 'verbs'
    if (registryProvider) {
      try {
        const rows = registryProvider(domain)
        return rows.map((r) => alist(r))
      } catch { /* fall through */ }
    }
    if (domain === 'events') {
      // No event registry attached; return the honest empty shape.
      return [[new Sym('domain'), new Sym('events')], [new Sym('entries'), []]]
    }
    // Walk env.vars — one entry per function binding.
    const entries = []
    for (const [name, val] of env.vars.entries()) {
      if (typeof val !== 'function') continue
      entries.push([
        [new Sym('name'), name],
        [new Sym('kind'), val._sakuraStub ? new Sym('stub') : new Sym('impl')],
      ])
    }
    return [
      [new Sym('domain'), new Sym('verbs')],
      [new Sym('count'), entries.length],
      [new Sym('entries'), entries],
    ]
  }, 'read')

  // ── system/scheduler ──────────────────────────────────────────────
  // Reference: three fields (work, speech, Q_depth), all may be null in
  // sandboxed contexts. Base runtime: all null. Assoc-list return.
  def('system/scheduler', () => {
    if (schedulerProvider) {
      try { return alist(schedulerProvider()) } catch { return alist({ work: null, speech: null, Q_depth: null }) }
    }
    return alist(state.scheduler)
  }, 'read')

  // ── system/surface ────────────────────────────────────────────────
  // Reference: cards, grid, entities, camera. Base runtime: cards=(),
  // camera=default, entities=(), grid=null. Assoc-list return.
  def('system/surface', () => {
    if (surfaceProvider) {
      try {
        const snap = surfaceProvider()
        return alist(snap)
      } catch { /* fall through */ }
    }
    const s = state.surface
    return [
      [new Sym('cards'), s.cards],
      [new Sym('camera'), alist(s.camera)],
      [new Sym('entities'), s.entities],
      [new Sym('grid'), s.grid],
    ]
  }, 'read')
}

export default installSystem
