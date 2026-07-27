// lib/system/verb-stats.js — persistent per-verb call counter.
//
// Provenance: 2026-07-22. Alfred proposed this on 2026-07-14 as task #749
// after asking whether we could go into the trillions. Answer: yes, easily
// — 64-bit integers hold ~9.2×10¹⁸. This ships the piece.
//
// Doctrine (Alfred, 2026-07-14):
//   Counters live in a SLAT file, queried at inference — not baked into
//   weights. The weights teach the PATTERN ("read a call-count, reason
//   about it"); the actual numbers come from the live counter via
//   self-census. Same law as intelligence-hooks: weights ≠ facts.
//
// Design:
//   - A module-level BigInt Map holds the live counters.
//   - `setCountHook` in interp.js fires on every named-primitive dispatch;
//     we increment the count for the verb name.
//   - Reads: `stats/verb-calls` returns an alist of the top-N verbs by
//     call count (deterministic sort: count desc, then name asc).
//     `stats/verb-calls-of` returns the count for one verb.
//   - Persistence: on process exit, flush the whole counter map to
//     ~/.motoi/stats.slat as key-value pairs. Load on startup so counters
//     accumulate across sessions.
//   - The write side is exit-only (no per-call disk hit). If the process
//     is killed uncleanly, we lose the delta since last exit; that is the
//     accepted trade-off vs. hot-path IO.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { setCountHook, setErrorHook } from '../../src/interp.js'
import { Sym } from '../../src/reader.js'

// ── singletons ──────────────────────────────────────────────────────────

// Per-verb call count. BigInt so trillions are fine.
const _calls = new Map()   // verbName → BigInt count

// Session bookkeeping.
const _session = {
  startedAt: Date.now(),
  sessionsTotal: 0n,
  fuelBudgetHint: 0n,   // updated by callers if they want; not required
}

// Path where we persist. Configurable via env var for tests.
function statsPath() {
  return process.env.MOTOI_STATS_PATH
    || path.join(homedir(), '.motoi', 'stats.slat')
}

// ── the error census — the "wrong sink" ─────────────────────────────────
//
// Mirror of the call counter, but for FAILURES. Where the call counter
// answers "did this verb run, and how often?", the error census answers
// "did this KIND of failure happen, and how often?". Same law: the count
// lives in SLAT and is read live; weights teach the pattern (read an
// error-count, reason about it as a negative signal), not the numbers.
//
// Doctrine (Alfred, 2026-07-26/27) — negative selection:
//   The job of this index is to ELIMINATE wrongs, not to rank rights. It
//   is the place wrongs drain into. Frequency = selection pressure: the
//   more a shape fails, the harder we steer away from it. We do NOT build
//   a ranker for good answers — the model's native intelligence picks
//   among the survivors.
//
// The hook fires at the run/eval/REPL boundary (see interp.js noteError):
// only errors that ESCAPE a program are real failures. Errors caught and
// handled by Scheme `guard` are handled, and correctly do NOT count.
//
// match-or-mint: every escaped error is normalized to a stable ERROR-KEY.
// A brand-new key is minted PROVISIONAL; once it recurs past the promote
// threshold it becomes REAL (a recurring, load-bearing failure shape).

const PROMOTE_THRESHOLD = 3n

const _errCounts = new Map()   // errorKey → BigInt count (lifetime)
const _errMeta   = new Map()   // errorKey → { status, firstSeen, lastSeen }

// This-session bookkeeping — reset every process.
const _errNovel   = new Set()  // keys first-ever-seen in THIS session
const _errSession = new Map()  // errorKey → BigInt count (this session)

// Normalize a thrown thing to a stable, low-cardinality ERROR-KEY. The key
// is the coordinate we count against; it must be identical across runs for
// "the same kind of failure". Ordered: language families first (stable,
// cross-cutting), then ad-hoc per-verb validation ("verb: message"), then
// a misc fallback. Never throws.
const _ERR_FAMILIES = [
  [/\bunbound symbol\b/i,                 'unbound-symbol'],
  [/\bmacro fuel exhausted\b/i,           'macro-fuel-exhausted'],
  [/\bfuel\b.*\bexhaust/i,                'fuel-exhausted'],
  [/\bprogram too big\b/i,                'program-too-big'],
  [/\bfrozen sandbox\b/i,                 'frozen-sandbox'],
  [/\bunquote-splicing not at top\b/i,    'unquote-splicing-misplaced'],
  [/\bnot a (procedure|function)\b/i,     'not-a-procedure'],
  [/\bwrong (number of|arity)\b/i,        'wrong-arity'],
  [/\bexpected\b.*\bpair\b|\bnot a pair\b/i, 'not-a-pair'],
  [/\bdivision by zero\b|\bdivide by zero\b/i, 'division-by-zero'],
  [/\bunexpected (eof|end of input)\b/i,  'unexpected-eof'],
  [/\bunexpected (close|closing) paren/i, 'unexpected-close-paren'],
  [/\bunterminated string\b/i,            'unterminated-string'],
  [/\bindex out of (range|bounds)\b/i,    'index-out-of-range'],
]

function normalizeError(err) {
  let msg = ''
  try {
    msg = (err && (err.message != null ? String(err.message) : String(err))) || ''
  } catch { msg = '' }

  for (const [rx, key] of _ERR_FAMILIES) {
    if (rx.test(msg)) return key
  }

  // Ad-hoc per-verb validation strings look like "verb/name: some detail"
  // or "verb/name: ...". Key on the verb + the leading complaint word, so
  // "composer/sprite-grid: :size must be positive" and "...: :size too big"
  // collapse toward the same verb but stay distinct from other verbs.
  const vm = msg.match(/^([A-Za-z][\w!?*+.\-]*\/[\w!?*+.\-]+)\s*:\s*(.*)$/)
  if (vm) {
    const verb = vm[1]
    const rest = (vm[2] || '').trim().toLowerCase()
    // first keyword-ish token of the complaint, to keep cardinality low
    const tok = (rest.match(/[a-z][\w\-]*/) || [''])[0]
    return tok ? `verb:${verb}:${tok}` : `verb:${verb}`
  }

  // Fallback: bucket by the error class name if we have one, else misc.
  let cls = ''
  try { cls = (err && err.name) ? String(err.name) : '' } catch { cls = '' }
  if (cls && cls !== 'Error') return `class:${cls}`
  return 'misc-uncategorized'
}

// ── load / save SLAT ────────────────────────────────────────────────────

// The SLAT is a very simple key-value shape — one top-level form per
// concern. We do NOT reach for the reader here because we want this file
// to survive a broken reader (self-preservation). Parser is a tiny hand-
// rolled scan for `:<name>  <bigint>` lines inside blocks; write is the
// mirror.
const _RX_ENTRY = /^\s*:([A-Za-z][\w!?*+/\-]*)\s+(\d+)n?/gm

function loadStats() {
  const p = statsPath()
  if (!existsSync(p)) return
  let text
  try { text = readFileSync(p, 'utf8') } catch { return }

  // Find the (verb-calls ...) block.
  const vcMatch = text.match(/\(verb-calls([\s\S]*?)\n\)/)
  if (vcMatch) {
    const body = vcMatch[1]
    let m
    _RX_ENTRY.lastIndex = 0
    while ((m = _RX_ENTRY.exec(body)) !== null) {
      const [, name, num] = m
      try { _calls.set(name, BigInt(num)) } catch { /* skip malformed */ }
    }
  }

  const scMatch = text.match(/\(sessions([\s\S]*?)\n\)/)
  if (scMatch) {
    const m = scMatch[1].match(/:total\s+(\d+)/)
    if (m) { try { _session.sessionsTotal = BigInt(m[1]) } catch { /* ignore */ } }
  }

  // Load the error census. Prior counts + status + first-seen carry over so
  // recurrence (and provisional→real promotion) accumulates across sessions.
  const ecMatch = text.match(/\(error-counts([\s\S]*?)\n\)/)
  if (ecMatch) {
    const rx = /\(:key\s+"([^"]*)"\s+:count\s+(\d+)\s+:status\s+"([^"]*)"\s+:first-seen\s+"([^"]*)"\s+:last-seen\s+"([^"]*)"\)/g
    let m
    while ((m = rx.exec(ecMatch[1])) !== null) {
      const [, key, count, status, firstSeen, lastSeen] = m
      try {
        _errCounts.set(key, BigInt(count))
        _errMeta.set(key, {
          status: status === 'real' ? 'real' : 'provisional',
          firstSeen, lastSeen,
        })
      } catch { /* skip malformed */ }
    }
  }
}

function saveStats() {
  const p = statsPath()
  try { mkdirSync(path.dirname(p), { recursive: true }) } catch { /* ignore */ }

  // Sort by (count desc, name asc) for deterministic diffs.
  const rows = [...(_calls.entries())].sort((a, b) => {
    if (a[1] !== b[1]) return a[1] > b[1] ? -1 : 1
    return a[0] < b[0] ? -1 : (a[0] > b[0] ? 1 : 0)
  })

  const lines = []
  lines.push(';;; ~/.motoi/stats.slat — persistent per-verb + session counters.')
  lines.push(';;; Written on process exit; read on start. See verb-stats.js.')
  lines.push(';;; This file is DATA, not code — Motoi reads it as key-value pairs.')
  lines.push('')
  lines.push('(verb-calls')
  for (const [name, count] of rows) {
    // pad name to a comfortable width for eye-parsing
    lines.push(`  :${name.padEnd(30)} ${count.toString()}`)
  }
  lines.push(')')
  lines.push('')
  lines.push('(sessions')
  lines.push(`  :total   ${(_session.sessionsTotal + 1n).toString()}`)
  lines.push(`  :last-started-at  "${new Date(_session.startedAt).toISOString()}"`)
  lines.push(`  :last-ended-at    "${new Date().toISOString()}"`)
  lines.push(')')
  lines.push('')

  // The error census — the wrong sink. One record per error-key, sorted by
  // (count desc, key asc) for deterministic diffs. Keys are quoted because
  // they carry `:` and `/`. This is DATA — Motoi reads it as key-value pairs.
  const errRows = [...(_errCounts.entries())].sort((a, b) => {
    if (a[1] !== b[1]) return a[1] > b[1] ? -1 : 1
    return a[0] < b[0] ? -1 : (a[0] > b[0] ? 1 : 0)
  })
  lines.push('(error-counts')
  for (const [key, count] of errRows) {
    const meta = _errMeta.get(key) || { status: 'provisional', firstSeen: '', lastSeen: '' }
    lines.push(`  (:key "${key}" :count ${count.toString()} :status "${meta.status}"`
      + ` :first-seen "${meta.firstSeen || ''}" :last-seen "${meta.lastSeen || ''}")`)
  }
  lines.push(')')

  try { writeFileSync(p, lines.join('\n') + '\n', 'utf8') } catch { /* best-effort */ }
}

// ── the count hook ──────────────────────────────────────────────────────

function _increment(name) {
  const cur = _calls.get(name) || 0n
  _calls.set(name, cur + 1n)
}

// The error hook — record one escaped error into the wrong sink. Never
// throws (telemetry must not break the failure it is recording).
function _recordError(err) {
  let key
  try { key = normalizeError(err) } catch { key = 'misc-uncategorized' }
  const nowIso = new Date().toISOString()

  const prev = _errCounts.get(key) || 0n
  const next = prev + 1n
  _errCounts.set(key, next)

  const sess = _errSession.get(key) || 0n
  _errSession.set(key, sess + 1n)

  let meta = _errMeta.get(key)
  if (!meta) {
    // First time this key is seen THIS process. If it was already on disk
    // (prev > 0) it is not novel; otherwise it is brand-new to the census.
    meta = { status: 'provisional', firstSeen: nowIso, lastSeen: nowIso }
    _errMeta.set(key, meta)
    if (prev === 0n) _errNovel.add(key)
  }
  meta.lastSeen = nowIso
  // Promote provisional → real once it recurs past the threshold.
  if (meta.status === 'provisional' && next >= PROMOTE_THRESHOLD) {
    meta.status = 'real'
  }
}

// Wire the hooks to interp.js. This must be called once at install time.
let _hookWired = false
function ensureHook() {
  if (_hookWired) return
  setCountHook(_increment)
  setErrorHook(_recordError)
  _hookWired = true
  // Flush on exit (process events cover all clean-exit paths).
  process.on('exit', saveStats)
  process.on('SIGINT',  () => { saveStats(); process.exit(130) })
  process.on('SIGTERM', () => { saveStats(); process.exit(143) })
}

// ── verb wrappers ───────────────────────────────────────────────────────

function topNVerbs(n = 25) {
  const rows = [...(_calls.entries())].sort((a, b) => a[1] > b[1] ? -1 : 1)
  return rows.slice(0, n).map(([name, count]) => [new Sym(':' + name), Number(count)])
}

function countForVerb(name) {
  const key = (name && name.name) || String(name || '')
  const c = _calls.get(key) || 0n
  // JavaScript numbers can hold up to 2^53 — a trillion fits fine (10^12).
  // If the count exceeds Number.MAX_SAFE_INTEGER we return the BigInt string
  // to preserve precision.
  return c < BigInt(Number.MAX_SAFE_INTEGER) ? Number(c) : c.toString()
}

function statsPathForScheme() { return statsPath() }

function statsSummary() {
  let totalCalls = 0n
  for (const c of _calls.values()) totalCalls += c
  return [
    [new Sym(':verbs-tracked'), _calls.size],
    [new Sym(':total-calls'), totalCalls < BigInt(Number.MAX_SAFE_INTEGER)
      ? Number(totalCalls) : totalCalls.toString()],
    [new Sym(':sessions'), Number(_session.sessionsTotal + 1n)],
    [new Sym(':session-uptime-ms'), Date.now() - _session.startedAt],
    [new Sym(':stats-slat'), statsPath()],
  ]
}

// ── error-census readers ────────────────────────────────────────────────

function _asNum(big) {
  return big < BigInt(Number.MAX_SAFE_INTEGER) ? Number(big) : big.toString()
}

function errorCountOf(key) {
  const k = (key && key.name) || String(key || '')
  return _asNum(_errCounts.get(k) || 0n)
}

// Top-N error-keys by lifetime count, as an alist of
// (:<key> count status). Default N=25.
function topNErrors(n = 25) {
  const rows = [...(_errCounts.entries())].sort((a, b) => {
    if (a[1] !== b[1]) return a[1] > b[1] ? -1 : 1
    return a[0] < b[0] ? -1 : (a[0] > b[0] ? 1 : 0)
  })
  return rows.slice(0, n).map(([key, count]) => {
    const meta = _errMeta.get(key) || { status: 'provisional' }
    return [new Sym(':' + key), _asNum(count), new Sym(meta.status)]
  })
}

function errorSummary() {
  let total = 0n
  let real = 0, provisional = 0
  for (const [key, c] of _errCounts.entries()) {
    total += c
    const meta = _errMeta.get(key)
    if (meta && meta.status === 'real') real++
    else provisional++
  }
  let sessionTotal = 0n
  for (const c of _errSession.values()) sessionTotal += c
  return [
    [new Sym(':distinct-errors'), _errCounts.size],
    [new Sym(':total-errors'), _asNum(total)],
    [new Sym(':real'), real],
    [new Sym(':provisional'), provisional],
    [new Sym(':novel-this-session'), _errNovel.size],
    [new Sym(':errors-this-session'), _asNum(sessionTotal)],
    [new Sym(':stats-slat'), statsPath()],
  ]
}

// Errors first-ever-seen in THIS session — the mint side of match-or-mint.
function novelErrors() {
  return [...(_errNovel)].sort().map((key) => {
    const meta = _errMeta.get(key) || { status: 'provisional', firstSeen: '' }
    return [new Sym(':' + key), _asNum(_errCounts.get(key) || 0n), new Sym(meta.status)]
  })
}

// ── installer ───────────────────────────────────────────────────────────


// ── inline registration metadata (2026-07-22) ────────────────────
// See engineering/HOW-TO-REGISTER-A-VERB.md.
export const VERBS = [
  "stats/error-count-of",
  "stats/error-counts",
  "stats/error-novel",
  "stats/error-summary",
  "stats/flush!",
  "stats/path",
  "stats/summary",
  "stats/verb-calls",
  "stats/verb-calls-of",
]
export const LAZY = false

export function installVerbStats(env) {
  loadStats()      // pull prior counts off disk
  ensureHook()     // wire increment hook

  const def = (n, f, perm = 'read', doc = '') =>
    env.define(n, f, { perm, doc, namespace: 'stats', tier: 'operator' })

  def('stats/verb-calls', (n) => topNVerbs(n ? Number(n) : 25), 'read',
      'Return top-N verbs by lifetime call count as an alist. Default N=25.')

  def('stats/verb-calls-of', countForVerb, 'read',
      'Return the lifetime call count for one verb. Numbers if safe, string if past MAX_SAFE_INTEGER.')

  def('stats/summary', () => statsSummary(), 'read',
      'Return a summary alist: verbs-tracked, total-calls, sessions, session-uptime-ms, stats-slat path.')

  def('stats/flush!', () => { saveStats(); return true }, 'state-change',
      'Force a flush of counters to ~/.motoi/stats.slat. Normally happens on process exit.')

  def('stats/path', () => statsPath(), 'read',
      'Return the path where per-verb counters persist.')

  // ── error census (the wrong sink) ──────────────────────────────
  def('stats/error-counts', (n) => topNErrors(n ? Number(n) : 25), 'read',
      'Return top-N error-keys by lifetime count as an alist of (:key count status). Default N=25.')

  def('stats/error-count-of', errorCountOf, 'read',
      'Return the lifetime count for one error-key (e.g. (stats/error-count-of "unbound-symbol")).')

  def('stats/error-summary', () => errorSummary(), 'read',
      'Return a summary alist: distinct-errors, total-errors, real, provisional, novel-this-session, errors-this-session, stats-slat.')

  def('stats/error-novel', () => novelErrors(), 'read',
      'Return the error-keys first-ever-seen in THIS session (the mint side of match-or-mint) as (:key count status).')

  return env
}

// ── test hook (not part of the public API) ──────────────────────────────

export function _resetStats() {
  _calls.clear()
  _session.sessionsTotal = 0n
  _errCounts.clear()
  _errMeta.clear()
  _errNovel.clear()
  _errSession.clear()
}

export default installVerbStats
