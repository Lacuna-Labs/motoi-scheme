// domain-verbs.js — task-routing primitives for Motoi Scheme.
//
// Installs 7 singleton verbs used by the escalation reference:
//   domain/of         — classify a task-kind
//   floor/problem?    — predicate for floor-level escalation
//   route/off-domain  — hand off to external handler
//   pattern/clave     — return son-clave rhythm descriptor
//   transport/tempo   — set the shared BPM
//   weather/conjure   — spawn a transient weather effect
//   collision/define-layers! — assign layer bit indices
//
// Reference: scheme/reference/{21-domain,27-floor,54-route,49-pattern,68-transport,71-weather,14-collision}.slat.

import { Sym } from '../../src/reader.js'

import { isList, seqVerb } from '../base/list.js'
const nm = (x) => (x instanceof Sym ? x.name : String(x))

// -- module-level state (shared per REPL) -----------------------------
let _bpm = 120
const _floorProblems = new Set()  // e.g. 'account-lockout, 'inventory-critical
const _layerIndex = new Map()     // layer-symbol → bit-index

// Kind → (domain, reads, via, reason). The dictionary is small and
// curriculum-scoped. Unknown kinds classify as 'unknown.
const DOMAIN_TABLE = {
  'inventory-check':  { domain: 'inventory',    reads: 'catalog',  via: 'internal', reason: 'stock lookup' },
  'inventory-critical': { domain: 'inventory',  reads: 'catalog',  via: 'internal', reason: 'stock alert' },
  'restock':          { domain: 'inventory',    reads: 'catalog',  via: 'internal', reason: 'restock request' },
  'payment-dispute':  { domain: 'payment',      reads: 'ledger',   via: 'external', reason: 'human review' },
  'account-lockout':  { domain: 'account',      reads: 'auth-log', via: 'external', reason: 'identity check' },
  'shipping-delay':   { domain: 'transport',    reads: 'tracking', via: 'internal', reason: 'route adjust' },
  'legal':            { domain: 'self',         reads: 'policy',   via: 'external', reason: 'legal review' },
  'web-research':     { domain: 'web-research', reads: 'search',   via: 'external', reason: 'external lookup' },
}

// Set of kinds where floor/problem? returns #t.
const FLOOR_KINDS = new Set([
  'payment-dispute', 'account-lockout', 'inventory-critical', 'shipping-delay', 'data-loss', 'legal',
])


// ── inline registration metadata (2026-07-22) ────────────────────
// See engineering/HOW-TO-REGISTER-A-VERB.md.
export const VERBS = [
  "collision/define-layers!",
  "domain/of",
  "entity/mask!",
  "floor/mark!",
  "floor/problem?",
  "layer-bit-index",
  "pattern/clave",
  "route/off-domain",
  "transport/bpm",
  "transport/tempo",
  "weather/conjure",
]
export const LAZY = false

export function installDomainVerbs(env) {
  const def = (name, fn, perm = 'read') => {
    Object.defineProperty(fn, '__verbName', { value: name })
    env.define(name, seqVerb(fn), { perm })
  }

  // ── domain/of ───────────────────────────────────────────────
  def('domain/of', (kind) => {
    const k = nm(kind)
    const entry = DOMAIN_TABLE[k] || { domain: 'unknown', reads: 'none', via: 'unknown', reason: 'unclassified' }
    return [
      [new Sym(':domain'), new Sym(entry.domain)],
      [new Sym(':reads'),  new Sym(entry.reads)],
      [new Sym(':via'),    new Sym(entry.via)],
      [new Sym(':reason'), entry.reason],
    ]
  })

  // ── floor/problem? ──────────────────────────────────────────
  def('floor/problem?', (kind, _ctx) => FLOOR_KINDS.has(nm(kind)))

  // Allow programmatic registration of new floor kinds for tests / carts.
  def('floor/mark!', (kind) => { _floorProblems.add(nm(kind)); FLOOR_KINDS.add(nm(kind)); return true })

  // ── route/off-domain ────────────────────────────────────────
  // Fire-and-forget: prints a log entry and returns a terminal-state
  // symbol. The escalation surface is host-side; here we just witness.
  def('route/off-domain', (kind) => {
    const k = nm(kind)
    // Store the routing for downstream inspection.
    _floorProblems.add(k)
    return new Sym('routed-off-domain')
  })

  // ── pattern/clave ───────────────────────────────────────────
  // Son clave: 2-3 has hits on beats 1,4,7,11,13; 3-2 is reversed.
  def('pattern/clave', (direction) => {
    const d = direction ? nm(direction) : '2-3'
    const map = d === '3-2' ? [1, 3, 5, 8, 11] : [1, 4, 7, 11, 13]
    return [
      [new Sym(':kind'), new Sym('clave')],
      [new Sym(':direction'), new Sym(d)],
      [new Sym(':map'), map],
    ]
  })

  // ── transport/tempo ─────────────────────────────────────────
  def('transport/tempo', (bpm) => {
    if (typeof bpm !== 'number' || bpm <= 0) throw new Error('transport/tempo: need positive number')
    _bpm = bpm
    return new Sym('ok')
  })
  def('transport/bpm', () => _bpm)

  // ── weather/conjure ─────────────────────────────────────────
  // Returns 'ok on success; escalate token if subsystem is unavailable.
  // For the curriculum runtime we always succeed.
  def('weather/conjure', (state, at, scale, colour) => {
    // Named-arg style is used at the reference; here we accept positional.
    if (typeof state === 'undefined') throw new Error('weather/conjure: need state')
    return new Sym('ok')
  })

  // ── collision/define-layers! ────────────────────────────────
  def('collision/define-layers!', (layers) => {
    if (!isList(layers)) throw new Error('collision/define-layers!: need list')
    _layerIndex.clear()
    layers.forEach((l, i) => { _layerIndex.set(nm(l), i) })
    return true
  })
  def('layer-bit-index', (layer) => {
    const i = _layerIndex.get(nm(layer))
    return typeof i === 'number' ? i : -1
  })
  def('entity/mask!', (_layer, _against) => {
    // Curriculum stub — records intent; the physics wire lives in game/.
    return true
  })

  return env
}

export default installDomainVerbs
