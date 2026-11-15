// mail.mjs — MAIL TO CLAUDE (design §7.6, §9). Owns: the one letter shape {id kind from to at severity run what evidence asks
// untrusted}, the dedupe (identical `what` from one sender within an hour raises a count on the letter already written,
// no new file — F-11), the file name `<ts>-<from>-<kind>.slat`, the `(mail …)` verb's argument check. Refuses: a kind
// outside self-report|ticket|handoff-note, a severity outside sick|stuck|wrong|note, an empty `what`, a letter over 8,192
// bytes, evidence the wire cannot carry (NaN); a secret in a letter (law 7: scrubbed at emit time, `[redacted]`).
// Nobody is woken: Claude reads the directory while working (law: Lacuna never wakes Claude). Implements §7.6, §9.3, law 7.
// Invariants (§18): "a letter names its run and its evidence". Faults (§16): F-11.
import { toSlat } from './protocol.mjs'

export const KINDS = Object.freeze(['self-report', 'ticket', 'handoff-note'])
export const SEVERITIES = Object.freeze(['sick', 'stuck', 'wrong', 'note'])
/** The dedupe window (F-11), a letter's size cap, and the recent-letters memory per supervisor. */
export const DEDUPE_S = 3600, BYTES = 8192, KEPT = 500

// LAW 7 at emit time: the rules of lacuna-executor/redact.mjs (its key denylist and token shapes), copied because foreman.sb
// cannot read lacuna-executor; test/mail.test.mjs imports redact.mjs's KEY_DENYLIST so the two cannot drift (2026-10-24, U2).
const DENY = ['token', 'secret', 'password', 'passwd', 'passphrase', 'pin', 'api_key', 'apikey', 'api-key', 'authorization', 'cookie', 'set-cookie',
  'bearer', 'private_key', 'private-key', 'credential', 'credentials', 'sig', 'signature', 'hmac', 'owner-key', 'session_key', 'client_secret',
  'access_key', 'refresh_token'].map((k) => k.replace(/[-_]/g, '[-_]?')).join('|')
const MARK = '[redacted]'
const KEY_RX = new RegExp(`(^|[^a-z0-9])(${DENY})$`, 'i')
const TEXT_RX = [new RegExp(`((?:${DENY})["']?\\s*[:=]\\s*(?:bearer\\s+|basic\\s+)?["']?)([^\\s"',;&]{3,})`, 'gi'), new RegExp(`(--(?:${DENY})[= ])([^\\s]+)`, 'gi')]
const SHAPES = [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, /\bsk-[A-Za-z0-9_-]{16,}/g, /\bAIza[0-9A-Za-z_-]{30,}/g,
  /\bhf_[A-Za-z0-9]{20,}/g, /\bgh[pousr]_[A-Za-z0-9]{30,}/g, /\bxox[abprs]-[A-Za-z0-9-]{10,}/g, /\b[0-9a-f]{48,}\b/gi]
/** A value with every secret replaced: denylisted keys lose their value; strings lose key=value pairs, flags and token shapes. */
const scrub = (v, d = 0) => (d > 24 ? MARK : typeof v === 'string' ? SHAPES.reduce((t, rx) => t.replace(rx, MARK), TEXT_RX.reduce((t, rx) => t.replace(rx, (_, k) => k + MARK), v))
  : Array.isArray(v) ? v.map((x) => scrub(x, d + 1)) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, KEY_RX.test(k) ? MARK : scrub(x, d + 1)])) : v)

/** The sender's recent letters, for the dedupe: {key → {id, at, count}}; one map per supervisor. */
const recent = (sup) => (sup.mailRecent ||= new Map())

/**
 * Write one letter (or raise the count on an identical one from the same sender within the hour).
 * @param {object} sup the supervisor (host.now, host.mail)
 * @param {{id: string, name: string, run?: {key: string}}|null} w the sender (a worker), or null for the foreman itself
 * @param {{kind?: string, severity?: string, what: string, evidence?: object, asks?: string, untrusted?: boolean, run?: string}} o
 * @returns {{ok: boolean, id?: string, count?: number, why?: string}}
 */
export function sendMail(sup, w, o = {}) {
  const kind = o.kind || 'self-report', severity = o.severity || 'note'
  if (!KINDS.includes(kind)) return { ok: false, why: `mail kind is one of ${KINDS.join(' ')}, not ${kind}` }
  if (!SEVERITIES.includes(severity)) return { ok: false, why: `mail severity is one of ${SEVERITIES.join(' ')}, not ${severity}` }
  const what = scrub(String(o.what || '').trim())
  if (!what) return { ok: false, why: 'a letter says what' }
  const now = sup.host.now()
  const from = w ? w.name : 'foreman'
  const key = `${from}\n${what}`
  const seen = recent(sup).get(key)
  if (seen && now - seen.at < DEDUPE_S) {
    seen.count += 1
    sup.host.mailCount?.(seen.id, seen.count)
    return { ok: true, id: seen.id, count: seen.count, deduped: true }
  }
  const id = `m-${Math.round(now * 1000).toString(36)}-${(w ? w.id : 'f').replace(/[^\w-]/g, '')}`
  const row = { id, kind, from, to: 'claude', at: now, severity, run: o.run ?? (w?.run?.key || w?.contract?.key || w?.id || null),
                what: what.slice(0, 2000), evidence: o.evidence && typeof o.evidence === 'object' ? scrub(o.evidence) : {}, asks: o.asks == null ? null : scrub(String(o.asks).slice(0, 500)),
                untrusted: o.untrusted === true, count: 1 }
  let text
  try { text = `(mail ${toSlat(row)})` } catch (e) { return { ok: false, why: `a letter is data: ${e.message}` } }   // W8: never a throw into the sender
  if (Buffer.byteLength(text, 'utf8') > BYTES) return { ok: false, why: `a letter is under ${BYTES} bytes` }      // J15: the cap is bytes on disk
  recent(sup).delete(key)                          // a renewed letter is the newest: the bound forgets older ones first
  recent(sup).set(key, { id, at: now, count: 1 })
  if (recent(sup).size > KEPT) recent(sup).delete(recent(sup).keys().next().value)
  sup.host.mail?.({ ...row, text, file: fileName(row) })
  return { ok: true, id, count: 1 }
}

/** `<ts>-<from>-<kind>.slat`, local time, no colons. */
export function fileName(row) {
  const d = new Date(row.at * 1000)
  const ts = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19).replace(/[:T]/g, '-')
  return `${ts}-${String(row.from).replace(/[^\w.-]/g, '_').slice(0, 40)}-${row.kind}.slat`
}

/** The (mail 'kind "what" (@ ("fault" "F-07") ("severity" "stuck") …)) verb's reading of its arguments. */
export function mailArgs(kind, what, extra) {
  // (@ ("k" v) …) when the engine has the data register, or the quoted alist '(("k" v) …) until it does
  const e = Array.isArray(extra) ? Object.fromEntries(extra.filter((p) => Array.isArray(p) && p.length).map((p) => [String(p[0] && p[0].name ? p[0].name : p[0]), p.length === 2 ? p[1] : p.slice(1)]))
          : extra && typeof extra === 'object' ? extra : {}
  const evidence = { ...e }; delete evidence.severity; delete evidence.asks; delete evidence.untrusted
  return { kind: String(kind), what: String(what), severity: e.severity == null ? (e.fault ? 'wrong' : 'note') : String(e.severity), evidence, asks: e.asks, untrusted: e.untrusted === true }
}
