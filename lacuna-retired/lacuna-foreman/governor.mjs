// governor.mjs — THE BOX GOVERNOR. Owns: the one reading of the box's memory (the hands' `pressure` read: the kernel's
// pressure level, sampled by the hands at 1 s and kept as changes; the hands' `coast-sample`: available and wired MB from
// vm_stat), its level (normal · warn · critical · unknown), the one answer the broker and the foreman's manners read, the
// price of a model load against the box profile (with the mind's measured prefill rate, for the swap's first-token estimate),
// and, only under LACUNA_GOVERNOR=1 (default off; the owner, 2026-11-04:
// "governors off. when i ask for an llm i get it. let the os clear the memory"), the acts the level calls for: refuse,
// with the number; evict idle minds; drain (no new work while the work in flight finishes); park (the broker parks the
// lowest pausable job through the hands, under the act's deadline). Off, it reports: every price admits with its figure
// and the level never drains or parks. Every level change and every act is one `(governor …)` row in the run ledger.
// Refuses: to cut a token stream (it has no stop verb; a drain only closes the door to new work); armed, a decision on a
// reading older than GOVERNOR.staleS (the level reads unknown and a load is refused, never priced on a guess); an act
// without its row; a Mach
// call per token (it reads the hands' samples on its own clock, never per request). Implements: ROAD-TO-1.0-2026-10-30
// Category 5 "(2) the memory watchdog is a box governor in the foreman (a gen_server)" and rulings D1–D2;
// LACUNA-SCHEME-BEHAVIOURS-1.0 `define-server` in Node's shape (init, handleCast, handleCall, handleInfo are pure functions
// of the message and the state; the server below runs their acts); LME-1.0 §3 law 3 (memory decided before a load); SRE
// ch. 21 (refuse when overloaded, with the number). Invariants (§18): "no act without a record"; "a refused load names the
// number it needed". Faults (§16): F-05 (no room), F-C1 (a stale reading decides nothing).
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { vmMemory } from './coast.mjs'
import { readBox } from './box.mjs'
import { handsPresent, sendToHands } from './hands-link.mjs'
import { toSlat } from './protocol.mjs'
import { readForms } from '../../lacuna-scheme/src/slat-data.js'

/** The governor's lines and clocks (seconds, MB). One place; the tests hold them. */
export const GOVERNOR = Object.freeze({
  staleS: 30,         // F-C1: older than this, a reading decides nothing (the coast's COAST.staleS)
  warnMB: 2048,       // available under this is warn (the wall's lowMB)
  criticalMB: 1024,   // available under this is critical (the wall's admitMB)
  calmS: 60,          // below critical this long before the drain lifts (the foreman's manners use the same calm)
  fastS: 2,           // while the level is not normal, the server asks the hands this often
  floorMB: 1500,      // a load leaves at least this much (the engine's own floor; box.slat admit-floor-mb overrides)
  compressedWarnMB: 8192,  // the compressor occupying this much is warn (video A2: 9.45 GB compressed on the 32 GB box at 03:19)
  swapWarnMBPerS: 1,  // swapping out this fast between two samples is warn (A2: 8.47 GB swapped while the kernel said normal)
})
/** kern.memorystatus_vm_pressure_level → its word (the dispatch levels the kernel reports: 1, 2, 4). */
export const PRESSURE = Object.freeze({ 1: 'normal', 2: 'warn', 4: 'critical' })
const RANK = Object.freeze({ normal: 0, warn: 1, critical: 2 })
/** The governor acts (refuses, evicts, drains, parks) only under LACUNA_GOVERNOR=1; off, it reports (the owner, 2026-11-04). */
export const governorActs = () => process.env.LACUNA_GOVERNOR === '1'

/**
 * The first state (define-server's init).
 * @param {number} now seconds
 * @returns {object}
 */
export function init(now) {
  return { level: 'unknown', why: 'no reading yet', since: now, availMB: null, wiredMB: null, coastAt: null, pressure: null,
    pressureAt: null, cursor: 0, drain: false, calmSince: null, park: false, compressedMB: null, swapouts: null, swapMBPerS: null }
}

/**
 * A cast: a reading arrives. `coast` carries vm_stat's text; `pressure` the hands' answer (the level now, the changes since
 * the cursor); `parked` is the broker saying it acted on `park`.
 * @param {{t: string, at?: number, vm?: string, level?: number, changes?: Array<{level: number}>, seq?: number}} msg
 * @param {object} state
 * @returns {object} the next state
 */
export function handleCast(msg, state) {
  if (msg.t === 'coast') {
    const m = vmMemory(msg.vm)
    if (!m) return state
    // the swap-out rate between this sample and the last (a counter since boot; a reset or a first sample has no rate)
    const dt = state.coastAt != null ? msg.at - state.coastAt : 0
    const rate = m.swapouts != null && state.swapouts != null && dt > 0 && m.swapouts >= state.swapouts
      ? Math.round((m.swapouts - state.swapouts) * m.pageBytes / 1e6 / dt * 10) / 10 : null
    return { ...state, availMB: m.availMB, wiredMB: m.wiredMB, coastAt: msg.at, compressedMB: m.compressedMB, swapouts: m.swapouts, swapMBPerS: rate }
  }
  if (msg.t === 'pressure') {
    // a critical blip between two asks counts: the worst level seen since the cursor, then the cursor moves
    const seen = [msg.level, ...(msg.changes || []).map((c) => c.level)].filter((x) => PRESSURE[x])
    if (!seen.length) return state
    const worst = seen.reduce((a, b) => (RANK[PRESSURE[b]] > RANK[PRESSURE[a]] ? b : a))
    return { ...state, pressure: worst, pressureAt: msg.at, cursor: Number.isInteger(msg.seq) ? msg.seq : state.cursor }
  }
  if (msg.t === 'parked') return { ...state, park: false }
  return state
}

/**
 * The level a state reads at `now`, and why, from the fresh readings only (F-C1).
 * @param {object} s
 * @param {number} now
 * @returns {{level: string, why: string, source: string}}
 */
export function levelOf(s, now) {
  const coast = s.coastAt != null && now - s.coastAt <= GOVERNOR.staleS && Number.isFinite(s.availMB)
  const press = s.pressureAt != null && now - s.pressureAt <= GOVERNOR.staleS && PRESSURE[s.pressure]
  if (!coast && !press) return { level: 'unknown', why: 'no reading in the last 30 s (the hands are down or the read was refused)', source: 'none' }
  const byCoast = !coast ? null : s.availMB < GOVERNOR.criticalMB ? 'critical' : s.availMB < GOVERNOR.warnMB ? 'warn' : 'normal'
  // A2: heavy compression or swapping is warn while the kernel may still say normal; it says so and never drains (warn has no act)
  const squeezed = coast && s.compressedMB != null && s.compressedMB >= GOVERNOR.compressedWarnMB
  const swapping = coast && s.swapMBPerS != null && s.swapMBPerS >= GOVERNOR.swapWarnMBPerS
  const byStrain = squeezed || swapping ? 'warn' : null
  const byPress = press ? PRESSURE[s.pressure] : null
  const level = [byCoast, byStrain, byPress].filter(Boolean).reduce((a, b) => (RANK[b] > RANK[a] ? b : a))
  const parts = [coast ? `${s.availMB} MB available` : null, squeezed ? `${s.compressedMB} MB compressed (over ${GOVERNOR.compressedWarnMB})` : null,
    swapping ? `swapping out ${s.swapMBPerS} MB/s (over ${GOVERNOR.swapWarnMBPerS})` : null, press ? `the kernel's pressure ${byPress}` : null].filter(Boolean)
  return { level, why: parts.join(', '), source: [coast ? 'coast' : null, press ? 'pressure' : null].filter(Boolean).join('+') }
}

/**
 * An info: the governor's clock ticks; the level is decided again and the acts it calls for are returned as data.
 * @param {{t: 'tick', now: number}} msg
 * @param {object} state
 * @returns {{state: object, acts: Array<Object>}}
 */
export function handleInfo(msg, state) {
  if (msg.t !== 'tick') return { state, acts: [] }
  const now = msg.now
  const { level, why } = levelOf(state, now)
  const acts = []
  let { drain, calmSince, park, since } = state
  if (level !== state.level) { acts.push({ act: 'level', level, was: state.level, why }); since = now }
  if (!(msg.acts ?? governorActs())) {
    // off (the default): the level is reported and nothing acts; a drain left by an armed governor lifts with its row
    if (drain) acts.push({ act: 'drain', on: false, why: `the governor reports only (LACUNA_GOVERNOR is not 1): ${why}` })
    return { state: { ...state, level, why, since, drain: false, calmSince: null, park: false }, acts }
  }
  if (level === 'critical') {
    calmSince = null
    if (!drain) { drain = true; park = true; acts.push({ act: 'drain', on: true, why: `the box's memory is critical: ${why}` }, { act: 'park', why }) }
  } else if (drain && level === 'unknown') {
    calmSince = null   // fail closed: no reading is not calm; the drain holds until a real reading says so
  } else if (drain) {
    calmSince ??= now
    if (now - calmSince >= GOVERNOR.calmS) { drain = false; park = false; calmSince = null; acts.push({ act: 'drain', on: false, why: `below critical for ${GOVERNOR.calmS} s: ${why}` }) }
  }
  return { state: { ...state, level, why, since, drain, calmSince, park }, acts }
}

/**
 * A call: `answer` (the one answer the broker and the manners read) or `price` (may a load of `needMB` start, the serving
 * mind's `freedMB` given back first). The reply is data; the state does not change.
 * @param {{t: string, now: number, to?: string, profile?: string, needMB?: ?number, freedMB?: number, floorMB?: number,
 *     source?: string}} msg
 * @param {object} state
 * @returns {{reply: Object, state: object}}
 */
export function handleCall(msg, state) {
  const { level, why, source } = levelOf(state, msg.now)
  if (msg.t === 'answer') {
    const reply = { level, why, source, availMB: level === 'unknown' ? null : state.availMB, wiredMB: level === 'unknown' ? null : state.wiredMB,
      pressure: state.pressure, at: Math.max(state.coastAt ?? 0, state.pressureAt ?? 0) || null, since: state.since,
      admit: !state.drain, drain: state.drain, park: state.park,
      compressedMB: level === 'unknown' ? null : state.compressedMB, swapMBPerS: level === 'unknown' ? null : state.swapMBPerS }
    return { reply, state }
  }
  if (msg.t === 'price') return { reply: priced(msg, state, level, why), state }
  return { reply: { ok: false, why: `the governor answers answer or price, not ${msg.t}` }, state }
}

function mindNameForGlass(id) {
  const s = String(id || '')
  if (s === 'embedder' || s === 'embeddinggemma') return 'the embedder'
  if (s === 'lacuna') return 'Lacuna'
  return `the ${s.toUpperCase()}`
}

function joinNames(list) {
  if (list.length <= 1) return list[0] || ''
  return `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`
}

// off (the default; the owner, 2026-11-04): the load proceeds; the figure is the record and the OS clears the memory
function freely(msg, state, level, why, of, floor) {
  const freed = msg.freedMB || 0
  const known = level !== 'unknown' && Number.isFinite(state.availMB)
  const room = known && msg.needMB != null ? Math.round(state.availMB + freed - msg.needMB) : null
  const fig = !known ? `no memory reading (${why})`
    : msg.needMB == null ? `${state.availMB} MB available; no measured use-mb in the box profile`
      : `${state.availMB} MB available + ${freed} MB freed − ${msg.needMB} MB${msg.source ? ` (${msg.source})` : ''} leaves ${room} MB`
  return {
    ok: true,
    why: `${of} loads on the owner's word: ${fig}; the governor reports (level ${level}) and refuses nothing`,
    needMB: msg.needMB ?? null,
    roomMB: room,
    floorMB: floor,
    level,
    ...(Array.isArray(msg.resident) ? { evict: [], evictedMB: 0, glass: null } : {}),
  }
}

function priced(msg, state, level, why) {
  const floor = msg.floorMB ?? GOVERNOR.floorMB
  const of = `the ${msg.to}${msg.profile ? ` (${msg.profile} profile)` : ''}`
  if (!(msg.acts ?? governorActs())) return freely(msg, state, level, why, of, floor)
  if (msg.needMB == null) return { ok: false, why: `${of} has no measured use-mb in the box profile: a load is never priced on a guess` }
  // the box's state now (no reading, critical, draining) refuses this load and passes; the next price may differ
  if (level === 'unknown') return { ok: false, transient: true, why: `no memory reading (${why}): a load is never priced on a guess`, needMB: msg.needMB }
  if (level === 'critical') return { ok: false, transient: true, why: `the box's memory is critical (${why}): no load starts`, needMB: msg.needMB }
  if (state.drain) return { ok: false, transient: true, why: `the box drains until ${GOVERNOR.calmS} s below critical: no load starts`, needMB: msg.needMB }
  let freed = msg.freedMB || 0
  const evict = []
  let evictedMB = 0
  const resident = Array.isArray(msg.resident) ? msg.resident : null
  if (resident && Math.round(state.availMB + freed - msg.needMB) < floor) {
    const idle = resident
      .filter((r) => r && r.id !== msg.to && r.id !== msg.from && !r.inTurn && (!r.inRun || msg.ownerAsked) && Number.isFinite(r.useMB) && r.useMB > 0)
      .sort((a, b) => (a.lastTurnAt ?? 0) - (b.lastTurnAt ?? 0))
    for (const r of idle) {
      evict.push(r.id)
      evictedMB += r.useMB
    }
    freed += evictedMB
  }
  const room = Math.round(state.availMB + freed - msg.needMB)
  const sum = `${state.availMB} MB available + ${freed} MB freed − ${msg.needMB} MB${msg.source ? ` (${msg.source})` : ''} leaves ${room} MB`
  if (room >= floor) {
    const glass = evict.length ? `Loading ${mindNameForGlass(msg.to)}: sending ${joinNames(evict.map(mindNameForGlass))} home first (${(evictedMB / 1000).toFixed(1)} GiB).` : null
    return {
      ok: true,
      why: `${of} fits: ${sum}, over the ${floor} MB floor`,
      needMB: msg.needMB,
      roomMB: room,
      floorMB: floor,
      ...(resident ? { evict, evictedMB, glass } : {}),
    }
  }
  const holders = resident
    ? resident
        .filter((r) => r && r.id !== msg.to && (r.inTurn || (r.inRun && !msg.ownerAsked)))
        .map((r) => ({ id: r.id, useMB: r.useMB, giB: Number(((r.useMB || 0) / 1000).toFixed(1)), inTurn: !!r.inTurn, inRun: r.inRun || false }))
    : []
  const holderSay = holders.length
    ? `; held by ${holders.map((h) => `${mindNameForGlass(h.id)} (${h.giB.toFixed(1)} GiB${typeof h.inRun === 'string' ? `, mid-run on ${h.inRun}` : h.inRun ? ', in run' : ', in turn'})`).join(', ')}. Wait for the run or stop it.`
    : ''
  return {
    ok: false,
    why: `no room for ${of}: ${sum}, under the ${floor} MB floor${holderSay}`,
    needMB: msg.needMB,
    roomMB: room,
    floorMB: floor,
    ...(resident ? { evict: [], holders } : {}),
  }
}

// ── the box profile: a mind's row and the profile it runs under on this box ──────────────────────────────────────────
/**
 * The row a load of `to` is priced by: the box profile's `(mind (id <to>) …)` with its `use-mb`, its `(profile …)`, its
 * source and its measured `prefill-tok-s` (null: unmeasured).
 * @param {string} text the box profile's slat
 * @param {string} to the mind's id
 * @returns {?{id: string, useMB: ?number, profile: ?string, source: string, floorMB: number, prefillTokS: ?number}}
 */
export function boxRow(text, to) {
  const p = readBox(text)
  const m = p.minds.find((x) => x.id === to)
  if (!m) return null
  const form = readForms(text).find((f) => Array.isArray(f) && sym(f[0]) === 'mind' && f.some((k) => Array.isArray(k) && sym(k[0]) === 'id' && String(sym(k[1])) === to))
  const prof = form?.find((k) => Array.isArray(k) && sym(k[0]) === 'profile')
  return { id: m.id, useMB: m.useMB, profile: prof ? String(sym(prof[1])) : null, source: m.source, floorMB: p.box.admitMB, prefillTokS: m.prefillTokS }
}

// ── the server: runs the callbacks, asks the hands, writes every act ──────────────────────────────────────────────────
/**
 * The governor of a supervisor (one per foreman): `sense()` asks the hands and decides; `answer()`; `price(o)`; `cast(m)`;
 * `engine()` (the desk engine's `(status)`).
 * @param {object} sup the supervisor (host.now, host.ledger; sup.key signs the hop to the hands)
 * @param {{read?: function(string, Array): Promise<Object>, boxFile?: string, handsSock?: string, deskSock?: string,
 *     fast?: boolean}} [o] `read` replaces the hop to the hands (tests); `fast` (default: the live hop) arms the 2 s clock
 *     while the level is not normal
 * @returns {{sense: function(): Promise<Object>, answer: function(): Object, price: function(Object): Object,
 *     cast: function(Object): void, engine: function(): Promise<Object>, state: function(): object}}
 */
export function governor(sup, o = {}) {
  return (sup.governor ||= server(sup, o))
}

/**
 * The engine's own `(status)` on its socket, read by the one reader: what it serves, its profile, whether it drains. A read,
 * never a `gen`.
 * @param {string} sock the engine's socket
 * @param {number} [ms] the wait for the one answer line
 * @returns {Promise<{ok: boolean, model?: ?string, profile?: ?string, draining?: boolean, busy?: number, uptimeS?: number, why?: string}>}
 */
export function engineStatus(sock, ms = 2000) {
  return new Promise((resolve) => {
    const c = net.createConnection(sock)
    let buf = ''
    let done = false
    const end = (v) => { if (!done) { done = true; c.destroy(); resolve(v) } }
    c.on('error', (e) => end({ ok: false, why: e.code || e.message }))
    c.on('connect', () => c.write('(status (id "governor"))\n'))
    c.on('data', (d) => { buf += d; const i = buf.indexOf('\n'); if (i >= 0) end(readStatus(buf.slice(0, i))) })
    setTimeout(() => end({ ok: false, why: `no answer in ${ms} ms` }), ms).unref()
  })
}

const sym = (x) => (x && typeof x === 'object' && 'name' in x ? x.name : x)
function readStatus(line) {
  try {
    const [f] = readForms(line)
    if (sym(f?.[0]) !== 'ok') return { ok: false, why: line.slice(0, 200) }
    const kv = Object.fromEntries(f.slice(1).filter(Array.isArray).map((p) => [sym(p[0]), sym(p[1])]))
    return { ok: true, model: kv.model ?? null, profile: kv.profile ?? null, draining: kv.draining === true, busy: Number(kv.busy ?? 0),
      uptimeS: Number(kv['uptime-s'] ?? 0) }
  } catch (e) { return { ok: false, why: `the status line does not read (${e.message})` } }
}

/**
 * A worker's memory metric from the answer (the `subscribe` verb's mem_available_gb in GB, mem_pressure as the kernel's level
 * 1, 2 or 4): the value, null when the governor has no fresh reading, undefined for a metric that is not memory's.
 * @param {Object} answer the governor's answer
 * @param {string} metric
 * @returns {(number|null|undefined)}
 */
export function memoryMetric(answer, metric) {
  if (metric === 'mem_available_gb') return answer.availMB == null ? null : Math.round(answer.availMB / 100) / 10
  if (metric === 'mem_pressure') return answer.level === 'unknown' || !PRESSURE[answer.pressure] ? null : answer.pressure
  return undefined
}

/** The governor's answer when one exists, else null (a supervisor whose governor never started). */
export const answerOf = (sup) => (sup.governor ? sup.governor.answer() : null)

function server(sup, o) {
  let state = init(sup.host.now())
  let timer = null
  let lastRefusal = null
  const sock = o.handsSock || process.env.LACUNA_HANDS_SOCK || path.join(os.homedir(), '.lacuna', 'hands.sock')
  const boxFile = o.boxFile || process.env.FOREMAN_PROFILE || path.join(os.homedir(), 'lacuna-world', 'foreman', 'box.slat')
  const deskSock = o.deskSock || process.env.LACUNA_DESK_SOCK || path.join(os.homedir(), '.lacuna', 'lme', 'desk.sock')
  const read = o.read || ((op, args) => askHands(sup, sock, op, args))
  const fast = o.fast ?? !o.read   // the live hop arms the 2 s clock while the level is not normal; a test's reader does not
  const run = (acts) => { for (const a of acts) record(sup, a, state) }
  const g = {
    async sense() {
      const [p, c] = await Promise.all([read('pressure', [state.cursor]).catch(() => null), read('coast-sample', []).catch(() => null)])
      const at = sup.host.now()
      if (p?.ok) state = handleCast({ t: 'pressure', level: p.level, changes: p.changes, seq: p.seq, at }, state)
      if (c?.ok) state = handleCast({ t: 'coast', vm: c.vm, at }, state)
      const r = handleInfo({ t: 'tick', now: at }, state)
      state = r.state
      run(r.acts)
      if (fast && state.level !== 'normal' && !timer) timer = setTimeout(() => { timer = null; g.sense() }, GOVERNOR.fastS * 1000).unref()
      return g.answer()
    },
    answer: () => handleCall({ t: 'answer', now: sup.host.now() }, state).reply,
    price({ to, profile = null, from = null, resident = null, needMB = null, ownerAsked = false }) {
      let text = ''
      try { text = fs.readFileSync(boxFile, 'utf8') } catch { /* no profile: every load reads unmeasured below */ }
      const row = boxRow(text, to)
      const out = boxRow(text, from)
      const resRows = Array.isArray(resident)
        ? resident.map((r) => ({ ...r, useMB: r.useMB ?? boxRow(text, r.id)?.useMB ?? null }))
        : null
      const reply = handleCall({ t: 'price', now: sup.host.now(), to, profile: profile || row?.profile, needMB: needMB ?? row?.useMB ?? null,
        freedMB: from ? out?.useMB ?? 0 : 0, floorMB: row?.floorMB, source: row?.source?.split(/[:;]/)[0], resident: resRows, ownerAsked }, state).reply
      // one row per price; a refusal repeated in the same words (a sweep asking again while the box is unchanged) is the same act
      if (reply.ok || lastRefusal !== reply.why) record(sup, { act: reply.ok ? 'admit' : 'refuse', why: reply.why, to, need_mb: reply.needMB ?? null }, state)
      lastRefusal = reply.ok ? null : reply.why
      return { ...reply, prefillTokS: row?.prefillTokS ?? null }   // the swap's first-token estimate reads it (the order §1.14)
    },
    cast(msg) { state = handleCast(msg, state) },
    engine: () => engineStatus(deskSock),
    state: () => state,
  }
  return g
}

function record(sup, a, state) {
  const row = { at: Math.round(sup.host.now()), act: a.act, level: a.level ?? state.level, why: String(a.why || '').slice(0, 300) }
  if (a.was) row.was = a.was
  if (a.on !== undefined) row.on = a.on
  if (a.to) row.to = a.to
  if (a.need_mb != null) row['need-mb'] = a.need_mb
  if (Number.isFinite(state.availMB)) row['avail-mb'] = state.availMB
  if (PRESSURE[state.pressure]) row.pressure = state.pressure
  sup.host.ledger?.(`(governor ${toSlat(row)})\n`)
}

// one hand to the hands' daemon (the foreman's door reads use the same hop): the rows, or {ok: false, why}
async function askHands(sup, sock, op, args) {
  if (!handsPresent(sock)) return { ok: false, why: 'the hands are not up' }
  let answer = null
  const w = { id: 'governor', name: 'governor', parent: null, tier: 'hand', run: { key: 'governor' }, pending: [], handlers: new Map(), state: 'running', thoughts: [] }
  const r = await sendToHands({ sup, sock, key: sup.key, kind: 'hand', w, data: { ticket: `governor-${op}-${Date.now()}`, op, args, deadline: 10 }, deliver: (v) => { answer = v } })
  if (!answer) return { ok: false, why: r.why || `the hands did not answer the ${op} read` }
  if (answer.exit !== 0) return { ok: false, why: String(answer.why || `the ${op} read ended ${answer.exit}`).slice(0, 200) }
  return { ok: true, ...(answer.rows && typeof answer.rows === 'object' ? answer.rows : { rows: answer.rows }) }
}
