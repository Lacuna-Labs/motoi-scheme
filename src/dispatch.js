// dispatch.js — the dispatcher chokepoint (Item 9 of the burn-down).
//
// Every entry-point into Scheme execution routes through `dispatchScheme`.
// One function, one gate, one place to harden. Implements §8.8.4 of
// docs/sakura/HELLO-SURFACE-1.0.md (the intent classifier) and §8.9.1
// (the five-gate chain).
//
// Flow:
//
//   src + caller → parse(src)
//                 → walkVerbCalls(ast)
//                 → for each verb call:
//                     · look up meta in verbRegistry
//                     · check perm against caller.tier
//                     · validate args against schema (if any)
//                     · check rate limit
//                     · if confirm:true and !caller.confirmed → reject
//                     · if perm:'destructive' and tier === 'sakura' → reject
//                 → on rejection: { ok: false, reason, verb, args } + trace
//                 → on accept: hand to the underlying runtime (runWithCards)
//
// Caller tiers (per §8.8.1):
//   'system'           — engine-internal carts (shipped in build)
//   'operator-gesture' — direct UI tap / drag / keyboard
//   'operator-voice'   — wake-word + voice command
//   'sakura'           — LLM-emitted scheme
//   'external'         — URL hash / deep link / webhook
//   'untrusted'        — chat textarea, free-form input (default)
//
// The tier ranks (read < paint < state-change < destructive) gate which
// permission level a tier can fire. `untrusted` only ever fires `read` —
// and even that is a defence-in-depth nicety; untrusted input shouldn't
// reach the parser at all (it's data, not code).

import { parse, Sym } from './reader.js'
import { expandProgram } from './macro.js'
import { getVerbMeta, validateRegistry } from './verbRegistry.js'

// ── Hermetic side-effect seams (Motoi doctrine) ─────────────────────
//
// A dialect built on top of Motoi may need the dispatcher to write to
// its own audit bus, event log, chip queue, correlation context, and
// substrate-power throttle. Motoi is the BASE dialect and ships none
// of those stacks — it must run hermetic. So we provide the smallest
// possible local stand-ins here plus injection points a dialect can
// wire up without patching this file.
//
// The default behaviours are the honest floor:
//   emit / auditVerb / chipEmit / chatChipEmit  → no-op
//   currentCaller                                → module-scope slot
//   powerTier                                    → 'full'
//   evLog.{start,complete,fail}                  → no-op handle
//   correlationId                                → per-dispatch UUID-ish
//
// A dialect wires its own by calling `installDispatchHooks({...})`
// before the first dispatchScheme() call. Any subset is honoured; the
// rest keep the no-op floor.

const _defaultHooks = {
  emit:                () => {},
  chipEmit:            () => {},
  chipShape:           (x) => x,
  chatChipEmit:        () => {},
  evLog:               {
    start:    () => ({}),
    complete: () => {},
    fail:     () => {},
  },
  currentCorrelationId: () => null,
  withCorrelation:      (_id, fn) => fn(),
  mintCorrelationId:    (prefix) =>
    `${prefix || 'corr'}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
  powerTier:           () => 'full',
  operatorId:          () => 'anonymous',
}

let _hooks = { ..._defaultHooks }

/**
 * Wire dialect-specific side-effect sinks into the dispatcher. Any
 * omitted keys retain the hermetic no-op default. Callable more than
 * once (later calls override earlier); intended to be called at
 * substrate startup, before the first dispatchScheme.
 */
export function installDispatchHooks(hooks = {}) {
  _hooks = { ..._defaultHooks, ...hooks }
}

/** Reset hooks to the hermetic defaults. Test-seam. */
export function resetDispatchHooks() {
  _hooks = { ..._defaultHooks }
}

// Current-caller carrier. In dialects with a card layer this lives in
// the card surface API so nested (card-do ...) invocations don't
// escalate tier. In Motoi we keep the exact same stack-disciplined
// seam locally: a module-scope slot, get/set pair, honoured by
// dispatchScheme's try/finally block.
let _currentCaller = null
function _setCurrentCaller(c) { _currentCaller = c }
function _getCurrentCaller()  { return _currentCaller }
export function currentDispatchCaller() { return _currentCaller }

// Convenience getters that read from `_hooks` at call time (so a late
// installDispatchHooks still takes effect for subsequent dispatches).
const emit             = (...a) => _hooks.emit(...a)
const chipEmit         = (...a) => _hooks.chipEmit(...a)
const chipShape        = (x)    => _hooks.chipShape(x)
const chatChipEmit     = (...a) => _hooks.chatChipEmit(...a)
const evLog = {
  start:    (...a) => _hooks.evLog.start(...a),
  complete: (...a) => _hooks.evLog.complete(...a),
  fail:     (...a) => _hooks.evLog.fail(...a),
}
const currentCorrelationId = () => _hooks.currentCorrelationId()
const mintCorrelationId    = (p) => _hooks.mintCorrelationId(p)
const withCorrelation      = (id, fn) => _hooks.withCorrelation(id, fn)
const powerTierRead        = () => _hooks.powerTier()

// Tier → permission set. Higher tiers inherit lower.
//
// `animate` is the v2.20.0-A5 addition (CARD-MANIFEST-CONTRACT.md §3.2):
// motion / camera-fly verbs touch CSS classes + emit cardEvents but
// don't write app data. The dispatcher treats it as non-destructive —
// every tier including `external` / `untrusted` can fire an animation,
// matching the existing implicit behaviour for the 14 verbs flagged in
// SCHEME-INVENTORY §3.1 + §3.5. Distinct from `read` in the registry so
// future tier work (HS-1.0 §8.8.3) can grade animations apart from
// pure observation without changing every caller.
// Exported (v2.20.0 / Item M1) so the intent-codegen grammar builder can
// read the SAME perm floor the dispatcher enforces. The grammar is the
// first safety gate; reading TIER_PERMS here means the grammar and the
// dispatch gate can never drift — they share one source of truth.
export const TIER_PERMS = {
  system: new Set(['read', 'paint', 'animate', 'state-change', 'destructive', 'financial', 'network', 'personal-data']),
  'operator-gesture': new Set(['read', 'paint', 'animate', 'state-change', 'destructive', 'financial', 'network', 'personal-data']),
  'operator-voice': new Set(['read', 'paint', 'animate', 'state-change', 'destructive', 'financial', 'network', 'personal-data']),
  sakura: new Set(['read', 'paint', 'animate', 'state-change']),
  external: new Set(['read', 'animate']),
  untrusted: new Set(['read', 'animate']),
}

// One-shot startup-validation guard — runs `validateRegistry()` once per
// process. After v2.20.0-S6 (A2/A3/A4/A5/A4b) the registry should be
// self-consistent: every state-changing verb declares an explicit perm.
// Strict mode asserts that property at every startup — future regressions
// fail loudly instead of silently warning into the trace bus.
let _validated = false
function ensureValidated() {
  if (_validated) return
  _validated = true
  const violations = validateRegistry({ throwOnFail: true })
  // `validateRegistry` throws on any violation; if we got here, the
  // registry is clean. Emit a one-shot trace line so the audit bus has
  // a "ok, validated, clean" marker on every boot.
  if (violations.length === 0) {
    emit({
      from: 'dispatch',
      action: 'registry.validated',
      level: 'info',
      summary: 'verbRegistry: clean — every state-changing verb declares explicit perm',
    })
  }
}

// Module-scope monotonic clock. Picked once per process: previously the
// dispatcher rebuilt this closure on every accepted dispatch (the wrapper
// + the typeof-performance check). Pinning it at module load means the
// hot path does ONE call into performance.now() per timing read, with
// no `typeof` branch in the way.
const NOW = (typeof performance !== 'undefined' && typeof performance.now === 'function')
  ? () => performance.now()
  : () => Date.now()

// Per-verb-per-tier rate limit counters. Keyed by `${verb}::${tier}`,
// value is `{ count, windowStart }`. Resets each window.
const RATE_BUCKETS = new Map()

// Memoize parsed rate-limit specs. The spec strings live in the verb
// registry (a closed, small set — '1/30s', '60/min', '3/h', …) so the
// cache size is bounded by the registry size; never grows unbounded.
// Each `rateOk()` call used to re-run the regex; the cache cuts that to
// one Map.get per call once warm. Cached `null` for malformed specs so
// the test seam (`__resetRateBuckets`) doesn't need to clear it.
const RATE_LIMIT_CACHE = new Map()

function parseRateLimit(spec) {
  if (!spec || typeof spec !== 'string') return null
  if (RATE_LIMIT_CACHE.has(spec)) return RATE_LIMIT_CACHE.get(spec)
  // '1/30s' | '5/min' | '10/min' | '3/h'
  const m = spec.match(/^(\d+)\/(\d+)?\s*(s|sec|secs|min|mins|m|h|hr|hrs)$/i)
  if (!m) { RATE_LIMIT_CACHE.set(spec, null); return null }
  const n = parseInt(m[1], 10)
  const k = m[2] ? parseInt(m[2], 10) : 1
  const unit = m[3].toLowerCase()
  let ms = k * 1000
  if (unit.startsWith('m') && unit !== 'ms') ms = k * 60 * 1000
  if (unit.startsWith('h')) ms = k * 60 * 60 * 1000
  const out = { n, ms }
  RATE_LIMIT_CACHE.set(spec, out)
  return out
}

function rateOk(verbName, tier, spec) {
  const limit = parseRateLimit(spec)
  if (!limit) return true
  const key = `${verbName}::${tier}`
  const now = Date.now()
  let bucket = RATE_BUCKETS.get(key)
  if (!bucket || now - bucket.windowStart >= limit.ms) {
    bucket = { count: 0, windowStart: now }
  }
  bucket.count += 1
  RATE_BUCKETS.set(key, bucket)
  return bucket.count <= limit.n
}

// Test-only seam.
export function __resetRateBuckets() {
  RATE_BUCKETS.clear()
}

// ── Power-tier gate (W2-5 / Architect D-4) ──────────────────────────
//
// Which verb powerTiers may run at each substrate tier. `perm` answers
// "may this caller fire?"; `powerTier` answers "may the substrate let
// it run right now?". Two orthogonal gates — this one closes the
// "substrate paused, cart still RAF'ing" gap: at `paused` the substrate
// freezes the dream, so a cart calling `(camera-pan-to x y 800)` must
// be refused rather than spinning a main-thread tween.
const POWER_ALLOW = {
  full:    new Set(['always', 'paint', 'animate', 'full-power']),
  half:    new Set(['always', 'paint', 'animate']),
  quarter: new Set(['always', 'paint']),
  paused:  new Set(['always']),
}

// Injectable reader so tests can pin the substrate tier without
// touching the live power controller (which in a dialect may attach
// battery / visibility / frame-budget listeners on first read).
let _powerTierReader = null
export function __setPowerTierReader(fn) {
  _powerTierReader = typeof fn === 'function' ? fn : null
}
function substratePowerTier() {
  try {
    const t = _powerTierReader ? _powerTierReader() : powerTierRead()
    return POWER_ALLOW[t] ? t : 'full'
  } catch {
    return 'full'
  }
}

// ── Chip auto-emission (W2-5 / Architect D-5) ───────────────────────
//
// When a verb's registry meta declares `chip` ('paint.applied' /
// 'motion.applied' / 'look.changed'), the dispatcher emits one chip.v1
// envelope per accepted call — zero per-verb code. Best-effort: a chip
// emission must never fail a dispatch.
function _operatorId() {
  try { return _hooks.operatorId() || 'anonymous' }
  catch { return 'anonymous' }
}

// W1-6 (Abel §1.5, no-false-claims): a withStars-wrapped verb that fails
// doesn't throw — it returns the honest ['error', '<branch>: …'] envelope
// (degrade / retry-exhausted / escalate / ask-human / precondition /
// guard). The chip says "motion.applied"; an envelope says it wasn't.
// Recognise the shape so the chip gate below can skip emission.
function isErrorEnvelope(value) {
  return Array.isArray(value) && value[0] === 'error'
}

function emitVerbChip(call, meta, traceId) {
  try {
    chipEmit(chipShape({
      kind: meta.chip,
      platform: 'system',
      operator_id: _operatorId(),
      payload: {
        verb: call.name,
        args: call.args.map(previewArg),
        traceId,
      },
      tags: ['verb', meta.chip.split('.')[0]],
    }))
  } catch { /* chip emission best-effort — never block a dispatch */ }
}

// Walk a parsed Scheme AST and yield every application form whose head
// is a Sym name. The dispatcher then checks each: language special
// form → skip; registry hit → gate-check; registry miss → 'unknown-verb'.
//
// `quote` and `quasiquote` subtrees are NOT walked — `'a-name` is data,
// not code. Without that guard a literal symbol inside `(quote ...)`
// would be flagged as an unknown verb call.
//
// Note: this is a structural walk, not a control-flow analysis. A verb
// inside an `if` branch may never run, but we still gate-check it.
// That's stricter than necessary; for safety the trade is fine. (The
// alternative — gating only the verbs that fire — would let "branch
// might be destructive" trees slip through static review.)

// Macro expansion budget at the gate (DoS cap, Soo-Jin + Sentinel). A
// fork-bomb macro throws `macro fuel exhausted` and is rejected as a
// parse-class error before any verb is gated or the runner runs.
const MACRO_GATE_FUEL = 100000

const SPECIAL_FORMS = new Set([
  'quote', 'quasiquote', 'unquote', 'unquote-splicing',
  'if', 'cond', 'case', 'when', 'unless',
  'and', 'or', 'not',
  'define', 'set!', 'lambda', 'let', 'let*', 'letrec',
  'begin',
  // Macro forms — stripped by expandProgram before the walk, but listed
  // here so a stray reference (e.g. inside quoted data) never trips the
  // unknown-verb gate.
  'define-syntax', 'let-syntax', 'letrec-syntax', 'syntax-rules',
  // `else` is the cond-clause keyword.
  'else',
])

/**
 * Walk a parsed Scheme AST collecting every verb-call site (head-of-form
 * Sym applications) AND every locally-defined name (carts that author
 * their own helpers via `(define (helper args) body)` register names
 * the dispatcher should NOT reject as unknown).
 *
 * Returns { calls, locals } where:
 *   calls  — Array<{ name, args, form }>     — every Sym-headed call
 *   locals — Set<string>                     — locally-defined names
 *
 * The dispatcher's unknown-verb rejection skips any call whose name is
 * in `locals` (the verb is a user-defined helper, not a registry call).
 * Other gates — perm / confirm / rate / schema — still fire for every
 * registry hit, so this does NOT open a hole: a local helper that calls
 * a destructive verb inside its body lands in `calls` via the body walk
 * and gets gated normally.
 */
export function walkVerbCalls(ast, out = [], locals = new Set()) {
  if (!ast) return { calls: out, locals }
  if (Array.isArray(ast)) {
    if (ast.length > 0 && ast[0] instanceof Sym) {
      const name = ast[0].name
      // Don't descend into `quote` / `quasiquote` — their bodies are data.
      if (name === 'quote') return { calls: out, locals }
      if (name === 'quasiquote') {
        // A quasiquoted form may contain `(unquote …)` islands that
        // ARE code. Walk those only.
        for (let i = 1; i < ast.length; i++) walkQuasi(ast[i], out)
        return { calls: out, locals }
      }
      // (define (fn-name args...) body...)         — function defn
      // (define fn-name (lambda (args...) body...)) — anonymous defn bound
      // (define x value)                           — value defn (NOT a verb)
      // For (1) the head of form[1] is the name; for (2) the second form
      // is the lambda; for (3) the second form is a value expression. We
      // collect names from all three so the cart's helper names skip the
      // unknown-verb gate.
      if (name === 'define' && ast.length >= 2) {
        const sig = ast[1]
        if (sig instanceof Sym) {
          locals.add(sig.name)
        } else if (Array.isArray(sig) && sig.length > 0 && sig[0] instanceof Sym) {
          locals.add(sig[0].name)
        }
      }
      // (let ((name expr) ...) body)              — local bindings
      // (let* ((name expr) ...) body)
      // (letrec ((name expr) ...) body)
      // (let loop ((name expr) ...) body)         — named-let recursion
      if (name === 'let' || name === 'let*' || name === 'letrec') {
        // Named-let: (let loop ((a 1)) body) — the second form is the
        // loop name (a Sym), the third is the bindings list.
        let bindIdx = 1
        if (ast[1] instanceof Sym) {
          locals.add(ast[1].name)  // loop name
          bindIdx = 2
        }
        const binds = ast[bindIdx]
        if (Array.isArray(binds)) {
          for (const b of binds) {
            if (Array.isArray(b) && b.length > 0 && b[0] instanceof Sym) {
              locals.add(b[0].name)
            }
          }
        }
      }
      // (lambda (args...) body...) — collect arg names
      if (name === 'lambda' && ast.length >= 2 && Array.isArray(ast[1])) {
        for (const a of ast[1]) {
          if (a instanceof Sym) locals.add(a.name)
        }
      }
      if (!SPECIAL_FORMS.has(name)) {
        // Every Sym-headed application is recorded — even if the
        // registry doesn't know it (so we can return unknown-verb).
        out.push({ name, args: ast.slice(1), form: ast })
      }
    }
    for (const child of ast) walkVerbCalls(child, out, locals)
  }
  return { calls: out, locals }
}

function walkQuasi(node, out) {
  if (!Array.isArray(node)) return
  if (node.length > 0 && node[0] instanceof Sym) {
    const name = node[0].name
    if (name === 'unquote' || name === 'unquote-splicing') {
      for (let i = 1; i < node.length; i++) walkVerbCalls(node[i], out)
      return
    }
  }
  for (const child of node) walkQuasi(child, out)
}

// Render a small structural preview of arg shapes — useful for
// trace logs without serialising entire trees.
function previewArg(arg, depth = 0) {
  if (arg == null) return 'nil'
  if (arg instanceof Sym) return `'${arg.name}`
  if (typeof arg === 'string') return arg.length > 24 ? `${JSON.stringify(arg.slice(0, 24))}…` : JSON.stringify(arg)
  if (typeof arg === 'number' || typeof arg === 'boolean') return String(arg)
  if (Array.isArray(arg)) {
    if (depth > 2) return '(…)'
    if (arg.length === 0) return '()'
    return '(' + arg.slice(0, 4).map((a) => previewArg(a, depth + 1)).join(' ') +
      (arg.length > 4 ? ' …' : '') + ')'
  }
  return String(arg).slice(0, 24)
}

// Trace bus emission — every dispatch decision lands here so the
// audit story (§8.8.6) reconstructs who tried to do what.
function trace(decision, payload) {
  try {
    emit({
      from: 'dispatch',
      action: `dispatch.${decision}`,
      level: decision === 'accepted' ? 'info' : 'warn',
      summary: `${payload.verb}: ${decision}${payload.reason ? ' — ' + payload.reason : ''}`,
      detail: payload,
    })
  } catch { /* audit-bus best-effort */ }
}

// ── audit-line shape (v2.20.0-L2a) ──────────────────────────────────
//
// The chip economy's audit-line FLOOR. Every verb call that survives
// the gate chain emits one structured line; every verb call that the
// gate chain rejects emits one too. Both shapes carry the same shared
// fields so a downstream consumer (audit bus, chip sink, future
// mirror) can grep on `traceId` to stitch together a single dispatch.
//
// Shape (verbatim — keep this comment + AUDIT_LINE_KEYS in sync):
//
//   {
//     ts:         ISO timestamp at the moment the audit line is emitted
//     verb:       string         — one verb per line (never comma-joined)
//     args:       string[]       — previewArg()'d call.args (size-bounded)
//     caller: {
//       tier:     string         — 'system' | 'operator-gesture' | …
//       surface:  string|null    — 'chat' | 'shop-services' | 'card-do' | …
//       address:  string|null    — '#card/<kind>/<instance>' when known
//     },
//     perm:       string|null    — from verbRegistry (registry exposes this)
//     result: {
//       status:   'ok' | 'error'
//       value?:   any            — dispatch-level return (accept only)
//       code?:    string         — rejection reason code (reject only)
//       reason?:  string         — human-friendly explanation (reject only)
//     },
//     durationMs: number         — per-verb time (accepts) or 0 (rejects)
//     confirmed:  boolean        — was caller.confirmed set this dispatch?
//     traceId:    string         — correlate sibling verbs in one dispatch
//   }
//
// Matches H1 cart-pipeline harness (tests/harness/cart-pipeline/index.js)
// and V1 virtual-shop log shape (tests/fixtures/virtual-shops/index.js).
// The harness adds `cartId`, `runId`, `stateName` from its bus; those
// are cart-driver concepts and stay absent here.

export const AUDIT_LINE_KEYS = Object.freeze([
  'ts', 'verb', 'args', 'caller', 'perm', 'result',
  'durationMs', 'confirmed', 'traceId',
])

// Mint a short, unique trace id per dispatch. ~62 bits of entropy via
// a `Math.random().toString(36)` draw + a monotonic counter so two
// dispatches that land in the same ms still get distinct ids. Not
// crypto-grade — that's a future ratchet — but uniqueness is what
// matters for stitching, and a downstream consumer can replace with
// crypto.randomUUID() if available (we keep the API stable).
let _traceCounter = 0
function mintTraceId() {
  _traceCounter = (_traceCounter + 1) >>> 0
  const a = Math.random().toString(36).slice(2, 8)
  const b = _traceCounter.toString(36)
  return `tr-${a}${b}`
}

/**
 * auditVerb — emit ONE structured audit line per verb call.
 *
 * Sibling subscribers (audit-bus → chip sink → future mirror) read
 * the `detail` payload, which carries the verbatim shape above. The
 * legacy aggregated trace still fires AFTER the per-verb lines so any
 * existing listener that grepped on `dispatch.accepted` keeps working.
 */
function auditVerb(decision, line) {
  try {
    emit({
      from: 'dispatch',
      action: `dispatch.verb.${decision}`,
      level: decision === 'accepted' ? 'info' : 'warn',
      summary:
        decision === 'accepted'
          ? `${line.verb}: ok (${line.durationMs}ms)`
          : `${line.verb}: rejected — ${line.result && line.result.code}`,
      detail: line,
    })
  } catch { /* audit-bus best-effort */ }
}

// Build the per-verb audit line. Pulled into a helper so reject + accept
// paths produce byte-identical key sets.
function buildAuditLine({
  verb,
  args,
  caller,
  perm,
  result,
  durationMs,
  confirmed,
  traceId,
}) {
  return {
    ts: new Date().toISOString(),
    verb,
    args,
    caller: {
      tier:    caller.tier || 'untrusted',
      surface: caller.surface || null,
      address: caller.address || null,
    },
    perm: perm || null,
    result,
    durationMs: durationMs >= 0 ? durationMs : 0,
    confirmed: !!confirmed,
    traceId,
  }
}

/**
 * dispatchScheme — the gate. Parse the source, walk every verb call,
 * check each call against the registry + tier + rate + confirm rules.
 * If any fail, return an envelope; don't execute. If all pass, hand
 * the source to `runner(source)` (the legacy runtime entry point).
 *
 * @param {string} source       Scheme source code.
 * @param {object} caller
 * @param {string} caller.tier  'system' | 'operator-gesture' | 'operator-voice' |
 *                              'sakura' | 'external' | 'untrusted'
 * @param {boolean} [caller.confirmed]  Operator gestured confirm on this
 *                                       dispatch — only applies when the
 *                                       gate-check itself wants it.
 * @param {string} [caller.surface]    Optional surface name ('chat',
 *                                       'shop-services', 'card-do', …) —
 *                                       v2.20.0-L2a addition; lands in
 *                                       the audit line caller sub-object.
 * @param {string} [caller.address]    Optional card address
 *                                       ('#card/<kind>/<instance>') —
 *                                       v2.20.0-L2a addition.
 * @param {Function} runner     The underlying runtime entry — typically
 *                              the legacy `runWithCards` from index.js.
 * @returns { ok, value?, reason?, verb?, args?, traceId? }
 *
 * On reject:
 *   { ok: false, reason, verb, args }
 * On accept:
 *   { ok: true, value: <runner result>, traceId }
 *
 * The function NEVER THROWS for security rejections — it returns an
 * envelope so the caller can decide whether to surface to the operator
 * (e.g. Sakura's "I can't do that — confirm in chat" chip) or just log
 * it. A real parser/runtime error still propagates as an exception via
 * `runner(source)`.
 */
export function dispatchScheme(source, caller, runner) {
  ensureValidated()
  const tier = (caller && caller.tier) || 'untrusted'
  const confirmed = !!(caller && caller.confirmed)
  // Surface + address are the v2.20.0-L2a additions to the caller
  // shape. Optional — call sites that haven't been threaded yet pass
  // `{tier, confirmed}` and the audit line records `null`. Forwards-
  // compatible: a future tier-aware HTTP boundary (v2.21.0) populates
  // them without breaking today's callers.
  const callerCtx = {
    tier,
    surface: (caller && caller.surface) || null,
    address: (caller && caller.address) || null,
  }
  const perms = TIER_PERMS[tier] || TIER_PERMS.untrusted

  // Mint a trace id at the top so every audit line in this dispatch —
  // accepts and rejects alike — can be stitched back together with one
  // grep across the sinks (audit bus, chip queue, mirrors).
  const traceId = mintTraceId()

  // LEGAL-FLOOR (Alfred 2026-06-14): ensure correlation_id for the whole
  // dispatch so all per-verb events share one id and replay can group
  // them. The id is picked up from the active correlation context if
  // one was set by an outer cart-run wrapper; otherwise minted here.
  const correlationId = currentCorrelationId() || mintCorrelationId('dispatch')

  // Reject-path helper. Returns the same envelope the legacy code did
  // ({ ok:false, reason, verb, args }) AND emits the structured audit
  // line so subscribers see the rejection in the same shape as accepts.
  function rejectVerb(call, reason, code, extra = {}) {
    const args = call.args.map(previewArg)
    auditVerb('rejected', buildAuditLine({
      verb:       call.name,
      args,
      caller:     callerCtx,
      perm:       extra.perm || (extra.meta && extra.meta.perm) || null,
      result:     { status: 'error', code, reason },
      durationMs: 0,
      confirmed,
      traceId,
    }))
    // LEGAL-FLOOR: emit the structured per-verb event too. The dispatcher
    // CANNOT throw on a security rejection (the caller depends on the
    // envelope shape), so we emit start+fail in one tick. Best-effort —
    // an eventLog failure must NEVER block a dispatch.
    try {
      const h = evLog.start({
        verb: call.name,
        cart: callerCtx.address || null,
        caller: callerCtx.tier,
        args: call.args,
        correlation_id: correlationId,
      })
      evLog.fail(h, { error_class: code, error_message: reason })
    } catch { /* never wedge a dispatch */ }
    // Keep the legacy aggregated reject trace too — existing listeners
    // that grep `dispatch.rejected` shouldn't regress. Strip `meta`
    // from the extras (it's only used by the audit line builder).
    const legacyExtras = { ...extra }
    delete legacyExtras.meta
    trace('rejected', {
      verb: call.name, reason: code, tier, traceId, ...legacyExtras,
    })
    return { ok: false, reason: code, verb: call.name, args }
  }

  // 1. Parse, then EXPAND MACROS (SC1c / security — Soo-Jin + Sentinel).
  //
  // The gate MUST run on the post-expansion tree: a macro can rewrite an
  // innocuous head into a forbidden verb (`(sneaky)` → `(receive-listing
  // …)`). If we walked the raw source the gate would only see `sneaky`
  // and miss the smuggled destructive verb. So we expand BEFORE
  // walkVerbCalls — the same expansion the runner will perform — and gate
  // the result. The macro fuel is its OWN bounded budget (DoS cap), kept
  // separate from the eval fuel; a fork-bomb macro throws `macro fuel
  // exhausted` here and is reported as a parse-class rejection (never
  // reaches the runner).
  let ast
  try {
    const parsed = parse(source)
    const { forms } = expandProgram(parsed, { fuel: { n: MACRO_GATE_FUEL } })
    ast = forms
  } catch (e) {
    const reason = `parse: ${e && e.message ? e.message : String(e)}`
    trace('parse-error', { reason, source: previewArg(source), traceId })
    return { ok: false, reason, verb: null, args: null }
  }

  // 2. Walk + classify every verb call AND collect locally-defined
  // names. Cart authors are free to write helpers via (define (fn ...)
  // ...); those names are not in the registry but are not unknown — the
  // call inside (define (scene-transfer ...) (let ((src (scene-first-of-
  // kind …)) …)) is to a helper the cart itself defined, not a registry
  // miss. The walker yields both: registry-missing names that ARE locals
  // skip the unknown-verb gate.
  const calls = []
  const locals = new Set()
  for (const form of ast) walkVerbCalls(form, calls, locals)

  // Walk the calls and keep the ones the dispatcher actually gates (i.e.
  // not skipped as user-locals). The retained list drives the accept-path
  // audit emission below — one structured line per call.
  const gatedCalls = []

  // Substrate power tier — read lazily (first verb that declares a
  // non-'always' powerTier) and at most once per dispatch.
  let _substrateTier = null

  for (const call of calls) {
    const meta = getVerbMeta(call.name)

    // Unknown verb — but if the name was locally defined (a cart helper
    // or let-binding), don't reject. Other gates still fire for every
    // registry hit, so this never opens a hole for destructive verbs.
    if (!meta) {
      if (locals.has(call.name)) continue
      return rejectVerb(call, 'unknown-verb', 'unknown-verb')
    }

    // Perm check.
    if (!perms.has(meta.perm)) {
      return rejectVerb(call, 'perm-denied', 'perm-denied', { meta, perm: meta.perm })
    }

    // Sakura cannot fire destructive. Hard rule, even though TIER_PERMS
    // already excludes destructive from the sakura set — this is a
    // belt-and-suspenders so a future tier-set drift doesn't silently
    // open the gate.
    if (meta.perm === 'destructive' && tier === 'sakura') {
      return rejectVerb(call, 'sakura-cannot-destroy', 'sakura-cannot-destroy', { meta, perm: meta.perm })
    }

    // Confirm gate. Only operator tiers can confirm (Sakura can't say
    // "I confirm" for the operator).
    if (meta.confirm && !confirmed) {
      const isOperator = tier === 'operator-gesture' || tier === 'operator-voice' || tier === 'system'
      if (!isOperator || !confirmed) {
        return rejectVerb(call, 'confirm-required', 'confirm-required', { meta, perm: meta.perm })
      }
    }

    // Schema validation — opt-in per verb (most verbs lean on
    // safetyStars' precondition for shape checks; schema is the
    // dispatcher-level pre-parse-shape gate for verbs that want it).
    if (meta.schema) {
      try {
        const ok = meta.schema(call.args)
        if (ok !== true) {
          const reason = typeof ok === 'string' ? `arg-shape: ${ok}` : 'arg-shape'
          return rejectVerb(call, reason, reason, { meta, perm: meta.perm })
        }
      } catch (e) {
        const reason = `arg-shape: schema threw: ${e && e.message ? e.message : String(e)}`
        return rejectVerb(call, reason, reason, { meta, perm: meta.perm })
      }
    }

    // Rate limit.
    if (meta.rateLimit && !rateOk(call.name, tier, meta.rateLimit)) {
      return rejectVerb(call, 'rate-limit', 'rate-limit', { meta, perm: meta.perm, rateLimit: meta.rateLimit })
    }

    // Power-tier gate (W2-5 / D-4). The substrate's live tier decides
    // whether this verb's declared powerTier may run right now. Pure
    // reads (`always`) pass at every tier, so the common path costs one
    // Set lookup. The read is cached per dispatch (one substrate state
    // per gate walk).
    const declaredPower = meta.powerTier || 'always'
    if (declaredPower !== 'always') {
      if (_substrateTier === null) _substrateTier = substratePowerTier()
      if (!POWER_ALLOW[_substrateTier].has(declaredPower)) {
        return rejectVerb(call, 'power-tier', 'power-tier', {
          meta, perm: meta.perm, powerTier: declaredPower, substrateTier: _substrateTier,
        })
      }
    }

    gatedCalls.push({ call, meta })
  }

  // 3. All gates passed — execute via the runner. Wrap in
  // performance.now() so each verb's audit line carries a real
  // durationMs. The dispatcher runs the WHOLE source through `runner`
  // (the legacy entry — it does not interpret verbs one-by-one), so
  // the same elapsed-time figure attributes to every verb in this
  // dispatch. That's an honest representation today — the audit line
  // tells you "this dispatch took N ms" not "this individual verb took
  // K ms". A future per-verb timing ratchet would mean changing the
  // runner contract.
  const t0 = NOW()

  // Set the current-caller context for any nested (card-do …) inside
  // the runner — Phase B of the card-do chokepoint: tier doesn't
  // escalate when the call crosses a card boundary. Stack-disciplined
  // restore so re-entrant dispatch (a runner that itself calls
  // dispatchScheme) preserves the right tier on the way out.
  const prevCaller = _getCurrentCaller()
  let value
  let runnerError = null
  try {
    _setCurrentCaller({ tier, confirmed, surface: callerCtx.surface, address: callerCtx.address })
    value = runner(source)
  } catch (e) {
    runnerError = e
  } finally {
    _setCurrentCaller(prevCaller)
  }

  const durationMs = Math.max(0, Math.round(NOW() - t0))

  // Emit one structured audit line per verb call. The accept path
  // mirrors the reject path's shape exactly — same keys, same caller
  // sub-object, same traceId — so a downstream consumer can read one
  // event stream and reconstruct who did what without branching on
  // `dispatch.verb.accepted` vs `dispatch.verb.rejected`.
  //
  // If the runner threw, every walked verb's `result.status` is
  // 'error' (we can't attribute the throw to one verb — see the
  // honest-timing comment above). Real security rejections never
  // reach this branch; they returned from rejectVerb already.
  for (const { call, meta } of gatedCalls) {
    const result = runnerError
      ? {
          status: 'error',
          code:   'runtime-error',
          reason: runnerError && runnerError.message ? runnerError.message : String(runnerError),
        }
      : { status: 'ok', value }
    auditVerb('accepted', buildAuditLine({
      verb:       call.name,
      args:       call.args.map(previewArg),
      caller:     callerCtx,
      perm:       meta && meta.perm,
      result,
      durationMs,
      confirmed,
      traceId,
    }))
    // LEGAL-FLOOR (Alfred 2026-06-14): structured per-verb event with
    // ULID, parent_event_id, correlation_id — the evidence layer Alfred
    // shows a customer in a dispute. Best-effort — eventLog failure must
    // NEVER block dispatch. start+complete (or start+fail) per gated
    // call.
    try {
      const h = evLog.start({
        verb: call.name,
        cart: callerCtx.address || null,
        caller: callerCtx.tier,
        args: call.args,
        correlation_id: correlationId,
      })
      if (runnerError) {
        evLog.fail(h, {
          error_class: 'runtime',
          error_message: runnerError && runnerError.message ? runnerError.message : String(runnerError),
        })
      } else {
        evLog.complete(h, { result_value: value })
      }
    } catch { /* never wedge a dispatch */ }
    // W2-5 / D-5 — auto-emit the verb's declared chip on success.
    // Sakura-magic moments (paint-glow, card-toss, …) land on the chip
    // queue so the trace card + Engram replay can observe them.
    //
    // W1-6 gate: skip the chip when the dispatch's resulting value is a
    // withStars error envelope (['error', 'degrade: …']). The verb body
    // failed without throwing; emitting 'motion.applied' would claim an
    // act that never happened. Coarse like durationMs — the envelope is
    // the value of the WHOLE dispatch, so a multi-verb source whose
    // last verb degrades withholds chips for all of them. Honest > over-
    // claiming: a missing chip is recoverable, a false one is not.
    if (!runnerError && !isErrorEnvelope(value) && meta && meta.chip) {
      emitVerbChip(call, meta, traceId)
    }
  }

  // Keep the legacy aggregated `dispatch.accepted` trace too. Existing
  // listeners (e.g. a System card's audit-bus filter) grepped this
  // action; we don't break them. The detail payload now carries
  // traceId so the aggregated line can be cross-referenced with the
  // per-verb ones.
  trace('accepted', {
    verb: gatedCalls.map(({ call }) => call.name).join(','),
    tier,
    callCount: gatedCalls.length,
    durationMs,
    traceId,
  })

  // Multiplier #17 — show-reasoning. One reasoning event per dispatch,
  // not per verb (noise). Callers MAY enrich via `caller.reasoning` —
  // {understood_as, context_consulted, prefs_honored}. When absent we
  // fill honest defaults: understood_as = null ("—"), context = [],
  // prefs = []. The drawer renders "—" for missing — never invents.
  try {
    const callerReasoning = (caller && caller.reasoning) || {}
    const routeVerbs = gatedCalls.map(({ call }) => call.name)
    chatChipEmit('reasoning', {
      traceId,
      understood_as:     callerReasoning.understood_as || null,
      route: {
        cardId: callerCtx.address || null,
        verb:   routeVerbs.length === 1 ? routeVerbs[0] : routeVerbs.join(', '),
      },
      context_consulted: callerReasoning.context_consulted || [],
      prefs_honored:     callerReasoning.prefs_honored || [],
      tier,
      ts: Date.now(),
    })
  } catch { /* never wedge a dispatch */ }

  if (runnerError) {
    // A real runtime error (fuel exhausted, unbound symbol, etc.) is
    // NOT a security rejection — re-throw so callers see the same
    // error they'd see without the gate. We've already emitted the
    // per-verb audit lines with `status: 'error'` above.
    throw runnerError
  }

  return { ok: true, value, traceId }
}

export default dispatchScheme

// LEGAL-FLOOR re-export — cart runners can wrap a whole run in a
// correlation context so every dispatch inside it shares one id.
export { withCorrelation, mintCorrelationId, currentCorrelationId }
