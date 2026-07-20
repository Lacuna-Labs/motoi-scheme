// prefab.js — reusable spawn recipes (prefab layer).
//
// Provenance: scheme-lang/src/prefab.js. Migrated to
// motoi-scheme/lib/game/ on 2026-07-16 (Pass-3 Wave 1).
//
// A prefab is a NAMED spawn template. You author it once and instantiate
// it any number of times by name + position. It stores:
//   name  — the template's symbol (e.g. 'goomba)
//   spec  — an alist of default entity properties: ((w . 12) (h . 12)
//           (tags . (enemy)) (kind . mob) ...)
// Spawning consumes the entity/make verb from installGame (L3), so a
// prefab spawn is EXACTLY like a hand-authored entity/make + a batch
// of entity/tag! calls — no magic, just a shortcut.
//
// Kid-readable comment: think of a prefab as a stamp. You stamp
// (prefab/define) once to make the stamp, then (prefab/spawn) it
// wherever you want. Same shape every time.

import { Sym } from '../../src/reader.js'

const nm = (x) => (x instanceof Sym ? x.name : x)

// ── module-level registry ──────────────────────────────────────────────
//
// One map per running REPL. Not per-instance — prefab templates are
// shared across all game instances by name.
const PREFABS = new Map()

// Test seam.
export function clearPrefabs() {
  PREFABS.clear()
}

// ── spec normalization ─────────────────────────────────────────────────
//
// The spec can arrive as:
//   an alist:  '((w . 12) (h . 12) (tags . (enemy)))
//   a JS obj:  { w: 12, h: 12, tags: ['enemy'] }
//   a Map:     new Map(...)
// We normalize to a JS object for internal use.
function normalizeSpec(spec) {
  if (spec instanceof Map) return Object.fromEntries(spec)
  if (Array.isArray(spec)) {
    const out = {}
    for (const entry of spec) {
      if (Array.isArray(entry) && entry.length >= 2) {
        const key = String(nm(entry[0]))
        const val = entry.length === 2 ? entry[1] : entry.slice(1)
        // Alist with dotted-pair notation: (key . value). After the
        // reader normalizes '(k . v) it may arrive as ['k', 'v'] or
        // as ['k', 'v'] — either way, we take index [1].
        out[key] = normalizeSpecValue(val)
      } else if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
        Object.assign(out, entry)
      }
    }
    return out
  }
  if (spec && typeof spec === 'object') {
    // Might be a plain object OR a dialect record.
    const out = {}
    for (const [k, v] of Object.entries(spec)) out[k] = normalizeSpecValue(v)
    return out
  }
  return {}
}

function normalizeSpecValue(v) {
  if (v instanceof Sym) return v.name
  if (Array.isArray(v)) return v.map(normalizeSpecValue)
  return v
}

// ── install into a Scheme env ──────────────────────────────────────────

export function installPrefab(env) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  // (prefab/define name spec) → #t
  //   Register a template. Overwrites any existing template of the
  //   same name (idempotent-friendly for hot-reload). Returns #t.
  def('prefab/define', (name, spec) => {
    const key = String(nm(name))
    PREFABS.set(key, { name: key, spec: normalizeSpec(spec) })
    return true
  }, 'state-change')

  // (prefab/spawn name x y) → id | 'nan
  //   Instantiate the template at (x, y). Uses the env's entity/make
  //   (from installGame) as the underlying creation call. Applies any
  //   tags, kind, w, h from the spec. Returns the new entity id (from
  //   entity/make), or 'nan if the template is unknown.
  def('prefab/spawn', (name, x, y) => {
    const key = String(nm(name))
    const prefab = PREFABS.get(key)
    if (!prefab) return new Sym('nan')

    const spec = prefab.spec || {}
    const w = spec.w !== undefined ? Number(spec.w) : 16
    const h = spec.h !== undefined ? Number(spec.h) : 16

    // Use entity/make from the env (installed by installGame). Fall
    // back to a stub-shape return if the game layer isn't loaded.
    let entityMake
    try { entityMake = env.get('entity/make') } catch { entityMake = null }
    if (typeof entityMake !== 'function') {
      // No game layer — return the intent as a shaped record so the
      // caller can still inspect what would have happened.
      return { kind: 'prefab-spawn', name: key, x: Number(x), y: Number(y), spec }
    }

    // Auto-generate a unique id per spawn: '<name>-<counter>' as a Sym.
    const id = uniqueId(key)
    entityMake(new Sym(id), Number(x), Number(y), w, h)

    // Apply tags via entity/tag! (also from installGame). Silent when
    // the tag verb isn't available — the entity still exists.
    if (Array.isArray(spec.tags)) {
      let tagFn = null
      try { tagFn = env.get('entity/tag!') } catch { tagFn = null }
      if (typeof tagFn === 'function') {
        for (const t of spec.tags) tagFn(new Sym(id), new Sym(String(nm(t))))
      }
    }

    return id
  }, 'state-change')

  return env
}

// ── unique id counter ──────────────────────────────────────────────────
const counters = new Map()
function uniqueId(name) {
  const n = (counters.get(name) || 0) + 1
  counters.set(name, n)
  return `${name}-${n}`
}

export default installPrefab
