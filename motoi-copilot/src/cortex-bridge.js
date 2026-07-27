// cortex-bridge.js — persist the copilot's in-memory ReasoningStore into the
// ONE cortex.slatl, and hydrate it back on startup.
//
// reasoning-loop.js documents this as a HOST responsibility: the store mirrors
// the cortex record shape exactly, so this bridge routes its records through the
// cortex module — the single file-format + path authority. That path is always
// ~/motoi/copilot/cortex.slatl (see src/paths.js#userCortexSlatlPath), so the
// copilot can NEVER write outside its own home. Everything here soft-fails: a
// copilot with no writable cortex still runs; it just forgets between sessions.
//
// What persists (why RAG "remembers what it did / if it did the right thing"):
//   :reasoning-trace   — every suggestion episode (observed → candidates → chosen)
//   :reasoning-skill   — salted, floor-passing, human-chosen moves (callable)
//   :person-profile    — accreted per-person preference (paradigm/register/silence)
// Graph edges (associate) are secondary retrieval boosts and are NOT persisted
// here; the salience + preference memory that answers "did I do right" is.

import { cortexAppendRecord, cortexReadRecords } from '../../lib/ai/cortex.js'

const REASONING_KINDS = new Set([':reasoning-trace', ':reasoning-skill', ':person-profile'])

// Strip values the slatl serializer can't round-trip (Symbols like NONE,
// functions) so a persisted record re-reads identically.
function sanitize(v) {
  if (v === null || v === undefined) return null
  const t = typeof v
  if (t === 'symbol') return String(v.description || 'symbol')
  if (t === 'function') return '<fn>'
  if (Array.isArray(v)) return v.map(sanitize)
  if (t === 'object') {
    const out = {}
    for (const [k, val] of Object.entries(v)) out[k] = sanitize(val)
    return out
  }
  return v
}

function kindOf(rec) {
  if (!rec) return null
  if (typeof rec.kind === 'string') return rec.kind
  if (rec.kind && typeof rec.kind.sym === 'string') return rec.kind.sym
  return null
}

// Append a single reasoning record to the cortex. Returns true on success.
export function persistRecord(rec) {
  try {
    if (!REASONING_KINDS.has(kindOf(rec))) return false
    return cortexAppendRecord(sanitize(rec))
  } catch { return false }
}

// Persist every record the store currently holds. Append-only; on the next
// hydrate a later record with the same id/key wins (last-write-wins).
export function persistStore(store) {
  if (!store || typeof store.toCortexRecords !== 'function') return 0
  let n = 0
  for (const rec of store.toCortexRecords()) if (persistRecord(rec)) n++
  return n
}

// Rebuild the store's traces / skills / profiles Maps from persisted cortex
// records. Last record for a given id/key wins (the append-only log's tail is
// the current grade). Returns the count loaded.
export function hydrateStore(store, records) {
  if (!store) return 0
  let recs
  try { recs = records || cortexReadRecords() } catch { return 0 }
  let loaded = 0
  for (const rec of recs) {
    const kind = kindOf(rec)
    if (!REASONING_KINDS.has(kind)) continue
    if (kind === ':reasoning-trace' && rec.id) { store.traces.set(rec.id, rec); loaded++ }
    else if (kind === ':reasoning-skill' && rec.key) { store.skills.set(rec.key, rec); loaded++ }
    else if (kind === ':person-profile' && rec.key) { store.profiles.set(rec.key, rec); loaded++ }
  }
  return loaded
}

export default { persistRecord, persistStore, hydrateStore }
