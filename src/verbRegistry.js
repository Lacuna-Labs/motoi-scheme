// verbRegistry.js — the dispatcher's source of truth for every verb.
//
// Item 8 of the substrate-security burn-down (2026-06-07, HelloSurfaceFix).
//
// The Scheme interpreter (interp.js) holds bindings in `Env.vars`. The
// dispatcher (runtime/dispatch.js) walks the AST + checks each verb call
// against this registry — perm tier, confirm gate, rate limit, arg schema.
//
// One process-wide registry keyed by verb name. Verbs are app-global —
// the same `card-open` lives in every cart — so this is the right grain.
// Per-call-site metadata would mean threading the env through dispatch
// and lookup; for 1.0 the same shape across callers is the simpler win.
//
// Categories (per docs/sakura/HELLO-SURFACE-1.0.md §8.8.3):
//
//   read           — pure observe; safe for any tier
//   paint          — visual side-effects only (dots, glyphs)
//   state-change   — moves cards, focuses, opens / closes UI
//   destructive    — deletes data, changes platforms (publishes, transfers)
//   financial      — money moves
//   network        — outbound network call
//   personal-data  — reads / writes operator PII
//
// Each meta entry also carries:
//
//   confirm        — boolean; if true the dispatcher requires `caller.confirmed`
//   rateLimit      — string ('1/30s', '10/min') or null
//   schema         — optional `(args) => true | string` validator
//   idempotent     — boolean; if true the dispatcher dedupes recent calls
//
// Registration happens in two places:
//   · `Env.define(name, val, meta)` — the canonical site; every verb
//     installer (cardVerbs, motionVerbs, surfaces, etc.) passes meta.
//   · `defaultMetaFor(name)` — name-pattern fallback so two-arg legacy
//     calls keep working; paint-* → 'paint', otherwise 'read'.
//
// At app startup the runtime calls `validateRegistry()` which fails fast
// if any state-change-or-stronger verb is missing a `perm` declaration.
// "Missing" means the meta entry was inferred from the name as 'read'
// or 'paint' AND the name pattern looks state-changing (ends in '!',
// or starts with 'card-' / 'shop-' / 'transfer' / 'delete' / 'move' /
// 'organize' / 'summon'). We err on the side of failing fast so a new
// verb cannot ship without thinking about its tier.

const REGISTRY = new Map()

// Canonical perm vocabulary — the closed set CARD-MANIFEST-CONTRACT.md §3.2
// lists. Every explicit `perm:` declaration MUST be one of these; the
// permAudit test fails fast on any deviation. `animate` is the v2.20.0-A5
// addition (motion + camera-fly verbs that side-effect visually but
// don't mutate state).
export const CANONICAL_PERMS = Object.freeze([
  'read',
  'paint',
  'animate',
  'state-change',
  'destructive',
  'financial',
  'network',
  'personal-data',
])

// Canonical power-tier vocabulary — the third closed-set meta axis
// (W2-5, Architect audit D-4). `perm` answers "may this caller fire?";
// `powerTier` answers "may the substrate let it run right now?". The
// dispatcher reads the substrate's live tier (canvasPower.getTier:
// full | half | quarter | paused) and refuses verbs whose declared
// powerTier outranks what the substrate can afford. This closes the
// "substrate paused, cart still RAF'ing" gap.
//
//   always      — pure read / compute; runs at any substrate tier (default)
//   paint       — static draw; runs at full/half/quarter; SKIP at paused
//   animate     — motion / tween / RAF loop; runs at full/half; SKIP at quarter/paused
//   full-power  — GPU filters / heavy compute; full ONLY
export const CANONICAL_POWER_TIERS = Object.freeze([
  'always',
  'paint',
  'animate',
  'full-power',
])

// Canonical chip kinds a verb may auto-emit on success (W2-5, Architect
// audit D-5). When a verb's meta declares `chip`, the dispatcher emits
// one chip.v1 envelope per accepted call — zero per-verb code. `null`
// (the default) emits nothing.
export const CANONICAL_CHIP_KINDS = Object.freeze([
  'paint.applied',
  'motion.applied',
  'look.changed',
])

// Derive a sensible powerTier default from the perm when the installer
// didn't declare one. paint verbs are static draws; animate verbs are
// tweens/RAF; everything else is safe at any substrate tier.
function defaultPowerTierFor(perm) {
  if (perm === 'paint') return 'paint'
  if (perm === 'animate') return 'animate'
  return 'always'
}

// Names that *look* like writes — used by `defaultMetaFor` to either
// stamp a sane default OR force the verb registration to be explicit.
const STATE_CHANGE_PATTERNS = [
  /!$/,                 // ends in ! — Scheme bang convention
  /^card-/,             // any card-* not in READ_VERBS
  /^shop-/,             // any shop-* (publish, etc.)
  /^store-/,            // store-listing-set-price, etc.
  /^transfer\b/,
  /^summon\b/,
  /^organize\b/,
  /^move-/,
  /^delete/,
  /^publish/,
  /^pay-/,
  /^send-/,
]

// Explicit READ-ONLY card-* / shop-* names — getters that read state
// without changing it. These keep the 'read' default even though the
// name pattern would otherwise force an explicit perm declaration.
const READ_VERBS = new Set([
  'card-list', 'card-rows', 'cards-list', 'card-kinds', 'card-kind',
  'card-id-of', 'card-find-by-kind', 'card-get',
  'card-rect', 'card-canvas-rect', 'card-screen-rect',
  'card-visible?', 'card-where', 'card-each',
  'shop-id', 'shop-name', 'shop-readiness',
])

const PAINT_PATTERNS = [
  /^paint-/,
  /^plot$/,
  /^pixel$/,
  /^flower/,
  /^pulse/,
  /^pulse-/,
  /^path$/,
  /^disc$/,
  /^rasterize-/,
  /^clear-surface/,
  /^dot-count/,
]

/**
 * defaultMetaFor — infer reasonable metadata from a verb's name. This
 * keeps two-arg `env.define(name, fn)` calls working for the long tail
 * of pure helpers and paint primitives without making every installer
 * declare every verb explicitly.
 *
 * Returns a meta object the registry treats as "inferred" (vs. an
 * explicitly-passed meta). The validator (see `validateRegistry`) uses
 * the inferred flag to surface verbs that look state-changing but
 * didn't get an explicit perm.
 */
export function defaultMetaFor(name) {
  // Paint primitives — visual side-effects only.
  if (PAINT_PATTERNS.some((re) => re.test(name))) {
    return { perm: 'paint', confirm: false, rateLimit: null, schema: null, idempotent: true, _inferred: true }
  }
  // Explicit read-only names override the state-change pattern.
  if (READ_VERBS.has(name)) {
    return { perm: 'read', confirm: false, rateLimit: null, schema: null, idempotent: true, _inferred: true }
  }
  // State-change-looking names — flag so the validator can fail fast.
  if (STATE_CHANGE_PATTERNS.some((re) => re.test(name))) {
    return { perm: 'state-change', confirm: false, rateLimit: null, schema: null, idempotent: false, _inferred: true, _needsExplicitPerm: true }
  }
  // Pure / arithmetic / list primitives — language values, perm 'read'.
  return { perm: 'read', confirm: false, rateLimit: null, schema: null, idempotent: true, _inferred: true }
}

/**
 * registerVerbMeta — record a verb's metadata. Called from `Env.define`
 * for every function-valued binding. The last writer wins (re-registering
 * is fine; tests do it every run).
 */
export function registerVerbMeta(name, meta) {
  if (!name || typeof name !== 'string') return
  const perm = meta.perm || 'read'
  // Normalize the meta shape so the dispatcher can read without checks.
  REGISTRY.set(name, {
    // The dispatcher-facing fields (unchanged shape).
    perm,
    confirm: meta.confirm === true,
    rateLimit: meta.rateLimit || null,
    schema: typeof meta.schema === 'function' ? meta.schema : null,
    idempotent: meta.idempotent === true,
    // W2-5 / D-4 — power-tier axis. Falls back to a perm-derived default
    // so legacy registrations need no migration.
    powerTier: CANONICAL_POWER_TIERS.includes(meta.powerTier)
      ? meta.powerTier
      : defaultPowerTierFor(perm),
    // W2-5 / D-5 — auto-emitted chip kind ('paint.applied' /
    // 'motion.applied' / 'look.changed') or null (default, no chip).
    chip: CANONICAL_CHIP_KINDS.includes(meta.chip) ? meta.chip : null,
    // W2-4 — backwards-alias bookkeeping. A deprecated alias keeps old
    // corpus carts running but is flagged so tooling (manual, corpus
    // generator, lint) can steer authors to `aliasFor`.
    deprecated: meta.deprecated === true,
    aliasFor: typeof meta.aliasFor === 'string' ? meta.aliasFor : null,
    _inferred: meta._inferred === true,
    _needsExplicitPerm: meta._needsExplicitPerm === true,
    // ── v1.4.0 introspection surface — additive, dispatcher ignores. ───
    // These fields are what the REPL, CLI, doc emitter, and
    // (help 'name) all read from. They were previously accepted by
    // env.define but not stored; storing them here so the introspection
    // layer has one source of truth. No dispatcher change.
    name: meta.name || name,
    doc: typeof meta.doc === 'string' ? meta.doc : null,
    contract: typeof meta.contract === 'string' ? meta.contract : null,
    arity: meta.arity ?? null,
    examples: Array.isArray(meta.examples) ? meta.examples : [],
    atom: typeof meta.atom === 'string' ? meta.atom : null,
    tier: typeof meta.tier === 'string' ? meta.tier : null,
    source: typeof meta.source === 'string' ? meta.source : null,
    namespace: typeof meta.namespace === 'string' ? meta.namespace : null,
    since: typeof meta.since === 'string' ? meta.since : null,
  })
}

/**
 * getVerbMeta — dispatcher lookup. Returns `null` if unknown — the
 * dispatcher treats that as an unknown-verb rejection (per §8.8.4 of
 * the canon).
 */
export function getVerbMeta(name) {
  return REGISTRY.get(name) || null
}

/**
 * hasVerb — quick membership test for the dispatcher.
 */
export function hasVerb(name) {
  return REGISTRY.has(name)
}

/**
 * validateRegistry — fail-fast startup check. Iterates every registered
 * verb; if any one was inferred as 'state-change' (name pattern matched
 * the bang-convention or write-prefix) without an explicit perm, throws.
 *
 * Throwing at app startup is the point: a verb that looks like a write
 * needs the author to think about whether Sakura can fire it. The
 * registry check is the cheapest place to catch the omission.
 *
 * Returns the list of inferred-state-change verbs (empty when clean).
 * `{ throwOnFail: false }` lets tests inspect without blowing up.
 */
export function validateRegistry({ throwOnFail = true } = {}) {
  const violations = []
  for (const [name, meta] of REGISTRY.entries()) {
    if (meta._needsExplicitPerm && meta._inferred) {
      violations.push(name)
    }
  }
  if (violations.length > 0 && throwOnFail) {
    throw new Error(
      `verbRegistry: ${violations.length} state-changing verb(s) registered without explicit perm — ` +
      `add a meta arg to env.define for: ${violations.join(', ')}`
    )
  }
  return violations
}

/**
 * snapshotRegistry — copy of the current table for tests / introspection.
 */
export function snapshotRegistry() {
  const out = {}
  for (const [name, meta] of REGISTRY.entries()) out[name] = { ...meta }
  return out
}

/**
 * __resetRegistry — test-only seam. Wipes everything so a test can
 * re-register from scratch.
 */
export function __resetRegistry() {
  REGISTRY.clear()
}

export default {
  defaultMetaFor,
  registerVerbMeta,
  getVerbMeta,
  hasVerb,
  validateRegistry,
  snapshotRegistry,
  __resetRegistry,
}
