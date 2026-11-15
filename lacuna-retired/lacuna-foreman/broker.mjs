// broker.mjs — THE POOLS, THE MEMORY WALL, THE SWAP ROAD AND THE PAUSABLE JOBS (design §10, §6 change 4; MINDS §4.5; ROAD-TO-1.0 Category 5; 517 lines, over 500 by reason: the swap road grew its price, 2026-11-06). Owns: one
// ledger of the pools (the desk's engine on ~/.lacuna/lme/desk.sock holding one mind at a time; the small minds with MIND_MAX; Ollama :11435), the admission
// of a run foreman or a mind (under LACUNA_GOVERNOR=1: ≥ 1 GB non-wired free and never while the governor drains, else exit 89 "no room"; off, the
// figure is a `(governor (act report))` row and the seat is given), Permutation B with hysteresis (free < 2 GB
// for 5 min → the 12B; back at > 6 GB), the swap recorded on every living run's contract. THE SWAP ROAD (E1.2, 2026-10-30): a swap begins only after the
// governor prices the load against the box profile, the serving mind's size given back (POSTMORTEMS 2026-10-30: the E4B was stopped for a 12B that could not
// fit); the act `switch-brain` runs drain → wait in flight → release → cadence → load once → verify (lacuna-box/brain/switch-brain.sh) and answers one
// `(swap-road …)` summary, read here by the one reader; a priced swap answers its price before the load (the order §1.14: the memory for the profile the
// owner chose, and the first token's wait at the mind's measured prefill rate); every swap, begun or refused, is one `(swap …)` row with ok or the
// refusal's own words; a swap under a running turn is held until it ends or the owner says now (`turnHold`, row 15); a refused
// swap writes one letter and holds the next automatic try at that mind until a person presses (law 10: one try). Refuses: a ninth run foreman; any admission
// or second swap while a swap is in flight; a swap the owner did not arm when `host.swapArmed` says so; a second automatic swap to a mind whose last swap was
// refused; a swap the governor cannot price. A supervisor without a governor (a test, a trial) prices nothing and probes nothing, as before. It never runs
// `switch-brain.sh` itself: the swap is an act the hands do; the broker emits it and records the reply. Every swap is a `(swap …)` record in the run ledger
// (D3). THE PAUSABLE JOBS (F2, 2026-10-24): the one pauser. A job with (pausable . #t) is paused (worker paused, mailbox kept, deadline clock held,
// `forge-signal stop` to its pid), parked (`forge-park`: checkpoint and exit, `parked-at <step>`) or resumed (SIGCONT after a pause; after a park only on the
// owner's press, with the diff hash he saw); compute pressure pauses the lowest priority, memory pressure parks it (the governor's `park` word, on the sweep
// clock). A job whose base cannot sit beside the 26B, or whose need leaves under 1 GB free, parks the 26B for its run (`forge-brain park`; the E2B face
// fronts the desk; swapped-at on every living contract) and brings it back when it ends. A passed job's exam is owed to the owner's press, never run here.
// Each control is a `stops` row on the job's contract; a pause row's step is the trainer's own, as the hands read it after SIGSTOP (F5). Refuses: a control
// on a worker without the header; a resume from a park without the press; a second park in flight; an exam on its own. Implements §10, §6 change 4, F-05;
// MINDS §4.5; CARDS-2.0 §6.5, §8.4; ROAD-TO-1.0 Category 5 (3) "lame-duck drain is the swap road". Invariants (§18): "the 26B and the 12B are never
// co-resident"; "a paused worker is not dead"; "an act from the desk is a press ticket or a foreman route"; "a refused load produces one record and no
// retry". Faults (§16): F-05. 517 lines (over 500 by reason, 2026-11-06; lane engine-context grew the swap road's price): the pausable jobs (F2) share the broker's one state with the swap road; they are the seam for a
// split.
import { contractSwap, renderContract, STOPS_KEPT } from './contract.mjs'
import { think, interrupt, event } from './talk.mjs'
import { answerOf, governorActs } from './governor.mjs'
import { sendMail } from './mail.mjs'
import { toSlat } from './protocol.mjs'
import { readForms, dataToJson } from '../../lacuna-scheme/src/slat-data.js'

/** The desk's mind by default: the engineer on duty (OFFICE-PROTOCOL §1). Work that borrowed the port gives it back to him. */
export const DESK_MIND = 'e4b'
// the brain pool takes the 31B too (2026-11-04: it could never come forward: the swap refused it as not a brain)
export const POOLS = Object.freeze({ brain: { port: 8091, models: ['e4b', '26b', '12b', '31b'] }, minds: { from: 8092, max: 3 }, embed: { port: 11435 } })
export const WALL = Object.freeze({ admitMB: 1024, lowMB: 2048, lowForS: 300, highMB: 6144, runForemen: 8 })
/** The engine profile each mind loads under on the swap road (LME-1.0 §4.6c; the profile names are lme's `profile_named`).
 *  switch-brain.sh holds the same table; test/swap-road.test.mjs keeps the two equal. */
export const SWAP_PROFILE = Object.freeze({ e4b: 'desk', '12b': 'desk', '26b': 'worker', '31b': 'tight' })   // the 12B on desk in 1.0 (the lead, 10-30); the 26B on worker: on desk it needed 17.3 GB and the box refused it twice (2026-11-04); the 31B on tight (1 slot, 8,192): on worker with 2 slots it needed 25,042 MB and answered nothing (11-05)
/** The context each engine profile holds, in tokens (lme/src/engine/profile.cpp `profile_named`; test/swap-road.test.mjs keeps the two
 *  equal): the most the first turn on a freshly loaded mind reads, which the swap's first-token estimate prices. */
export const PROFILE_CONTEXT = Object.freeze({ desk: 32768, worker: 16384, long: 65536, tight: 8192, batch: 8192 })
/** The authors who begin a swap with no person behind it: one try each; a refusal holds the next until a press (law 10). */
export const AUTO = Object.freeze(['wall', 'work-order', 'forge'])

/** One broker per supervisor: pools and the wall's clock. */
export function broker(sup) {
  // the brain the port holds survives a foreman restart (OFFICE-PROTOCOL §1: the E4B on duty by default; a restart that
  // assumed the 26B would price every wake wrong): the host reads the last swap's record
  return (sup.broker ||= { brain: sup.host.brainNow?.() || '26b', swapping: null, lowSince: null, minds: 0, foremen: new Set(), swaps: [] })
}

/** The box's memory as the host measures it: {availMB, wiredMB}; a host without a probe is "plenty". */
const memory = (sup) => sup.host.memory?.() || { availMB: Infinity, wiredMB: 0 }

/**
 * May this `kind` (`foreman` | `mind`) start now? → {ok} or {ok:false, exit:89, why} (F-05).
 */
export function admit(sup, kind, { id = null } = {}) {
  const r = admitInner(sup, kind, { id })
  if (!r.ok && r.fault) sup.host.upstream?.('no-room', { id: 'broker', name: 'broker', parent: null, tier: '-' }, { fault: r.fault, exit: r.exit, why: r.why, kind, id })   // §16: the record shows F-05
  return r
}

function admitInner(sup, kind, { id = null } = {}) {
  const b = broker(sup)
  const m = memory(sup)
  if (b.swapping) return { ok: false, exit: 89, fault: 'F-05', why: `no room: the brain is switching to the ${b.swapping.to} (Permutation B)` }
  const g = answerOf(sup)   // an armed governor (LACUNA_GOVERNOR=1) drains on critical memory: no new work while the work in flight finishes
  if (g?.drain) return { ok: false, exit: 89, fault: 'F-05', why: `no room: the box drains (${g.why}); the work in flight finishes first` }
  if (m.availMB < WALL.admitMB) {
    const low = `${Math.round(m.availMB)} MB non-wired free, under ${WALL.admitMB}`
    if (governorActs()) return { ok: false, exit: 89, fault: 'F-05', why: `no room: ${low}` }
    // off (the default; the owner, 2026-11-04): memory is reported, never a refusal; the OS clears it
    sup.host.ledger?.(`(governor ${toSlat({ at: Math.round(sup.host.now()), act: 'report', kind, 'avail-mb': Math.round(m.availMB), why: `admitted with ${low}: the governor reports only` })})\n`)
  }
  if (kind === 'foreman') {
    // a count cap is a governor too (the owner, 2026-11-04: "remove all governors. those things cost"): it refuses only under LACUNA_GOVERNOR=1
    if (b.foremen.size >= WALL.runForemen && governorActs()) return { ok: false, exit: 89, fault: 'F-05', why: `no room: ${WALL.runForemen} run foremen already` }
    if (id) b.foremen.add(String(id))
  } else if (kind === 'mind') {
    if (process.env.LACUNA_AUTO_LOADS !== '1') return { ok: false, exit: 89, fault: 'F-05', why: 'the owner decides who is loaded (2026-11-04): no small mind starts by itself; wake it from its card' }
    if (b.minds >= POOLS.minds.max && governorActs()) return { ok: false, exit: 89, fault: 'F-05', why: `no room: ${POOLS.minds.max} small minds already (MIND_MAX)` }
    b.minds += 1
  } else return { ok: false, exit: 12, why: `the broker admits foreman or mind, not ${kind}` }
  return { ok: true }
}

/** A foreman or mind ended: give its seat back. */
export function release(sup, kind, id = null) {
  const b = broker(sup)
  if (kind === 'foreman') b.foremen.delete(String(id))
  else if (kind === 'mind') b.minds = Math.max(0, b.minds - 1)
}

/**
 * The wall's sweep, on the sweep clock: low memory for `lowForS` → swap to the 12B; high again → back to the 26B.
 * → {swap: '12b'|'26b'|null}. The act goes out as `switch-brain`; `swapDone` records the reply.
 */
export function wallSweep(sup) {
  const b = broker(sup)
  const now = sup.host.now()
  const m = memory(sup)
  // the governor's park word (critical memory): the lowest pausable job parks through the hands, once an episode
  if (answerOf(sup)?.park) { relieve(sup, 'memory', `the box's memory is critical: ${answerOf(sup).why}`); sup.governor.cast({ t: 'parked' }) }
  if (b.swapping) return { swap: null, swapping: b.swapping.to }
  if (b.brain === 'e2b') return { swap: null, held: 'the 26B is parked for the forge; the job brings it back when it ends' }
  if (!Number.isFinite(m.availMB)) return { swap: null, why: 'no memory reading: the wall does nothing' }   // 2026-10-24: Infinity read as "high again" and swapped the brain back mid-batch
  if (b.brain === '26b') {
    if (m.availMB < WALL.lowMB) {
      b.lowSince ??= now
      if (now - b.lowSince >= WALL.lowForS) return beginSwap(sup, '12b', `${Math.round(m.availMB)} MB free for ${Math.round(now - b.lowSince)} s`, 'wall')
    } else b.lowSince = null
  } else if (b.brain === '12b' && m.availMB > WALL.highMB) {
    // the wall undoes only its own swap: a swap the owner (or the proof) pressed stays until a press says otherwise (2026-10-23: the
    // wall swapped the brain back 22 s after the proof's pressed swap, because the 26B's absence is what makes the memory "high again")
    if (b.by !== 'wall') return { swap: null, held: `the 12B was pressed by ${b.by || 'a person'}; the wall does not undo a press` }
    return beginSwap(sup, '26b', `${Math.round(m.availMB)} MB free again`, 'wall')
  }
  return { swap: null }
}

/**
 * A swap's hold while a turn runs on the desk's engine (the make-it-right audit, E14 §5 row 15; T-SRE sre-14: a swap under a
 * turn wrote `cancel` and left no row): the engine's `(status)` says busy, and the owner did not say now. A reading that
 * failed holds nothing (no engine answers: no turn to cut).
 * @param {?{ok: boolean, busy?: number}} engine the governor's `engine()` read
 * @param {boolean} now the owner's word to swap under the turn (the turn is written cut by a swap)
 * @returns {?string} the hold's sentence, or null: the swap may begin
 */
export function turnHold(engine, now = false) {
  if (now || !engine?.ok || !(engine.busy > 0)) return null
  return `a turn is running on the desk's engine (${engine.busy} busy): the swap waits for it to end; /swap <mind> now cuts it, and the turn says cut by a swap`
}

/**
 * Begin a swap. `by` is `wall` (the memory rule) or the presser's name; the wall later undoes only its own. `profile` is the
 * owner's window for the load (the door sends the one switch-brain.sh reads, `profile.<mind>`); none: SWAP_PROFILE's.
 * @returns {{swap: ?string, why?: string, held?: string, refused?: boolean, swapping?: string, price?: {profile: string,
 *     needMB: ?number, roomMB: ?number, prefillTokens: ?number, prefillTokS: ?number, firstTokenS: ?number}}} `price`: the
 *     governor's figure and the first token's wait, said before the load (null fields: unmeasured)
 */
export function beginSwap(sup, to, why, by = 'press', profile = null) {
  const b = broker(sup)
  // one swap at a time (2026-10-24, U3: a second press mid-swap sent a second switch-brain act and replaced the first's author)
  if (b.swapping) return { swap: null, held: `a swap to the ${b.swapping.to} is in flight (begun by ${b.swapping.by}); one at a time` }
  if (sup.host.swapArmed && !sup.host.swapArmed()) return { swap: null, held: `a swap to the ${to} is owed (${why}) and waits for the owner's press` }
  // law 10, one try (POSTMORTEMS 2026-10-30: the dispatcher began the same refused swap three times): a refusal holds every
  // automatic swap to that mind; a person's press clears the hold and is the next try
  // THE OWNER DECIDES WHO IS LOADED (his word, 2026-11-04: "do not at all start with any LLMs except lacuna and I decide who is loaded"):
  // no automatic author (the wall, the work-order dispatcher, the forge) moves the desk; a person's press or /swap does. The old
  // automatic road is opt-in by LACUNA_AUTO_LOADS=1 (its tests set it).
  if (AUTO.includes(by) && process.env.LACUNA_AUTO_LOADS !== '1') return { swap: null, held: `the owner decides who is loaded: a swap to the ${to} waits for his /swap or a card's key (asked by ${by}: ${why})` }
  const hold = b.refused?.[to]
  if (hold && AUTO.includes(by)) return { swap: null, held: `the swap to the ${to} was refused at ${clock(hold.at)} (${hold.why}); one try: a press starts the next` }
  if (b.refused) delete b.refused[to]
  // E1.2: the room is priced before anything stops; the serving mind's size comes back when it leaves
  const viaSwitch = to !== 'e2b' && b.brain !== 'e2b'
  const prof = profile || SWAP_PROFILE[to] || null
  let price = null
  if (viaSwitch && sup.governor && prof) {
    const p = sup.governor.price({ to, profile: prof, from: b.brain })
    if (p.transient) return { swap: null, held: p.why }   // the box's state now (no reading, critical): not now, no hold
    if (!p.ok) return refuseSwap(sup, { to, why, by, failed: p.why, stage: 'price', serving: b.brain })
    // the first token's wait: the profile's whole context (the most a fresh mind's first turn reads) at the mind's measured
    // prefill rate; an unmeasured rate estimates nothing (null, never a guess)
    const tokens = PROFILE_CONTEXT[prof] ?? null
    const tokS = p.prefillTokS ?? null
    price = { profile: prof, needMB: p.needMB ?? null, roomMB: p.roomMB ?? null, prefillTokens: tokens, prefillTokS: tokS,
      firstTokenS: tokens != null && tokS > 0 ? Math.round(tokens / tokS) : null }
  }
  b.swapping = { to, since: sup.host.now(), why, by, profile: viaSwitch ? prof : null }
  b.lowSince = null
  sup.host.upstream('brain-swap', { id: 'broker', name: 'broker', parent: null, tier: '-' }, { to, why, phase: 'begin' })
  // e2b = the 26B parked for the forge (its slots saved, the label out) and the face at the desk; back from it is an unpark
  if (to === 'e2b') sup.host.act?.('forge-brain', ['park'])
  else if (b.brain === 'e2b') sup.host.act?.('forge-brain', ['unpark'])
  else sup.host.act?.('switch-brain', [to])
  return { swap: to, why, ...(price ? { price } : {}) }
}

const clock = (t) => `${new Date(t * 1000).toISOString().slice(11, 19)}Z`
const BROKER = { id: 'broker', name: 'broker', parent: null, tier: '-' }

/** One `(swap …)` row: from, to, who, why, how long, whether it held, the refusal's own words, what serves after (D3). */
function swapRow(sup, o) {
  const row = { from: o.from ?? null, to: o.to, by: o.by || 'press', why: String(o.why || '').slice(0, 200), seconds: o.seconds ?? 0, ok: o.ok }
  if (o.failed) row.failed = String(o.failed).slice(0, 300)
  if (o.stage) row.stage = o.stage
  if (o.profile) row.profile = o.profile
  if (o.serving !== undefined) row.serving = o.serving
  row.at = Math.round(sup.host.now())
  sup.host.ledger?.(`(swap ${toSlat(row)})\n`)
}

// a refused swap: one row, one letter, the hold on the next automatic try (law 10); the mind that served still serves
function refuseSwap(sup, { to, why, by, failed, stage, serving, seconds = 0, profile = null }) {
  const b = broker(sup)
  swapRow(sup, { from: b.brain, to, by, why, seconds, ok: false, failed, stage, profile, serving })
  ;(b.refused ||= {})[to] = { at: sup.host.now(), why: String(failed).slice(0, 200), by }
  b.swaps.push({ to, at: sup.host.now(), failed })
  sup.host.upstream('brain-swap', BROKER, { to, phase: stage === 'price' ? 'refused' : 'failed', why: failed })
  sup.host.upstream?.('no-room', BROKER, { fault: 'F-05', exit: 89, why: failed, kind: 'swap', id: to })
  const lost = serving == null
  sendMail(sup, null, { kind: 'self-report', severity: lost ? 'sick' : 'wrong',
    what: `The swap to the ${to} was refused: ${String(failed).slice(0, 300)}. ${lost ? 'Nothing serves the desk.' : `The ${serving} serves the desk.`} One try; a press starts the next.`,
    evidence: { to, by, stage: stage || 'load', failed: String(failed).slice(0, 300), serving: serving ?? null } })
  return { swap: null, held: failed, refused: true }
}

/**
 * The hands answered the swap act: the brain is `to` now; every living run's contract records `swapped-at`. A refusal keeps
 * what the swap road says serves (`serving`; the old mind when the reply does not say) and holds the next automatic try.
 * @param {object} sup
 * @param {{ok?: boolean, to?: ?string, why?: string, serving?: ?string, profile?: ?string}} [o] `serving` null: nothing serves
 * @returns {{ok: boolean, brain?: ?string, why?: string}}
 */
export function swapDone(sup, { ok = true, to = null, why = '', serving = undefined, profile = null } = {}) {
  const b = broker(sup)
  const s = b.swapping
  if (!s) return { ok: false, why: 'no swap in flight' }
  b.swapping = null
  // D3 (2026-10-25): every swap is a record in the ledger, not only memory: from, to, who, why, how long, and whether it held
  const from = b.brain
  const seconds = Math.round((sup.host.now() - s.since) * 10) / 10
  if (!ok) {
    const now = serving === undefined ? from : serving
    refuseSwap(sup, { to: s.to, why: s.why, by: s.by, failed: why, serving: now, seconds, profile: profile || s.profile })
    b.brain = now
    return { ok: false, why, brain: now }
  }
  swapRow(sup, { from, to: s.to, by: s.by, why: s.why, seconds, ok: true })   // the A7 §4.1 row as the floor reads it
  if (b.refused) delete b.refused[to || s.to]
  b.brain = to || s.to
  sup.host.brainSet?.(b.brain)
  b.by = s.by || 'press'
  b.swaps.push({ to: b.brain, at: sup.host.now(), by: b.by })
  for (const w of sup.living()) if (w.contract) { contractSwap(sup, w, b.brain); think(w, 'state', `the brain is the ${b.brain} now (${s.why}); the next step starts from the contract`, sup.host.now()) }
  sup.host.upstream('brain-swap', { id: 'broker', name: 'broker', parent: null, tier: '-' }, { to: b.brain, phase: 'done', why: s.why })
  // the job that parked the 26B ended while the park was in flight: the 26B comes straight back (one swap at a time)
  if (b.brain === 'e2b' && !b.parkedFor) beginSwap(sup, '26b', 'the forge job ended while the 26B was parking', 'forge')
  return { ok: true, brain: b.brain }
}

/** What the desk shows: the pools and the wall. */
export function brokerStatus(sup) {
  const b = broker(sup)
  const m = memory(sup)
  return { brain: b.brain, by: b.by || null, swapping: b.swapping, parked_for: b.parkedFor || null, face_says: faceSays(sup), minds: b.minds, mind_max: POOLS.minds.max, run_foremen: b.foremen.size, run_foremen_max: WALL.runForemen,
           avail_mb: Number.isFinite(m.availMB) ? Math.round(m.availMB) : null, wired_mb: Math.round(m.wiredMB || 0), low_since: b.lowSince, swaps: b.swaps.slice(-10),
           governor: answerOf(sup), refused: b.refused && Object.keys(b.refused).length ? b.refused : null }
}

/**
 * The swap road's own summary, the last `(swap-road (@ …))` line switch-brain.sh prints, read by the one reader (law 5).
 * @param {{tail?: string, why?: string}} value the hands' answer to the act
 * @returns {?{ok: boolean, to: string, from: ?string, profile: ?string, serving: ?string, refused: ?string, blob: ?string, seconds: ?number}}
 */
export function roadSummary(value) {
  const lines = `${value?.tail || ''}\n${value?.why || ''}`.split('\n').map((l) => l.slice(l.indexOf('(swap-road '))).filter((l) => l.startsWith('(swap-road '))
  for (const line of lines.reverse()) {
    try {
      const [f] = readForms(line)
      const o = dataToJson(f[1])
      if (o && typeof o === 'object') return { ...o, serving: o.serving === 'none' ? null : o.serving ?? null }
    } catch { /* a torn or cut line: the one before it, or no summary */ }
  }
  return null
}

// ── THE PAUSABLE JOBS (F2) ──────────────────────────────────────────────────────────────────────────────────────────
/** The bases a forge job trains and whether each sits beside the 26B (MINDS §4.5: Permutation A leaves 5.3 GiB, so only a
 *  270M or a small-rank 1B; an E2B or E4B job is Permutation T). `needMB` is measured or null (forge_sft.py:38). */
export const JOB_BASES = Object.freeze({
  '270m': { needMB: 2048, beside26b: true }, functiongemma: { needMB: 2048, beside26b: true },
  '1b': { needMB: null, beside26b: true }, e2b: { needMB: null, beside26b: false }, e4b: { needMB: null, beside26b: false },
  'painter-flux-schnell-4bit': { needMB: 9728, beside26b: false },   // C12: a draw parks the 26B on the 32 GB box (CARDS-2.0 §6.15)
})

/**
 * Does a job on `base` needing `needMB` park the 26B? The desk's estimate applies the same rule (pressRoad.js parksBrain).
 * @param {{base: ?string, needMB: ?number, availMB: number, brain: string}} o
 * @returns {{park: boolean, why: string}}
 */
export function mustPark({ base, needMB = null, availMB = Infinity, brain = '26b' }) {
  if (brain !== '26b') return { park: false, why: `the brain is the ${brain}; only the 26B parks for the forge` }
  const row = JOB_BASES[String(base || '').toLowerCase()]
  if (row && !row.beside26b) return { park: true, why: `a ${base} job does not fit beside the 26B (MINDS §4.5, Permutation T)` }
  const need = needMB ?? row?.needMB ?? null
  if (need != null && Number.isFinite(availMB) && availMB - need < WALL.admitMB)
    return { park: true, why: `${Math.round(availMB)} MB free less ${need} MB needed leaves under ${WALL.admitMB} MB` }
  return { park: false, why: need == null ? `a ${base || 'job'} fits beside the 26B (MINDS §4.5)` : `${need} MB fits beside the 26B` }
}

/** The face's one sentence while the 26B is parked (CARDS-2.0 §8.4), or null. */
export function faceSays(sup) {
  const p = broker(sup).brain === 'e2b' ? broker(sup).parkedFor : null
  if (!p) return null
  const left = p.backAt ? Math.max(1, Math.round((p.backAt - sup.host.now()) / 60)) : null
  return `The 26B is parked for the forge${left ? `; back in about ${left} minutes` : ''}.`
}

const stopsRow = (sup, w, row) => {
  const r = { ...row, at: sup.host.now(), step: 'step' in row ? row.step : w.contract?.step ?? null }
  ;(w.pausable.rows ||= []).push(r)
  const c = w.contract
  if (c) {
    (c.stops ||= []).push(r)
    if (c.stops.length > STOPS_KEPT) c.stops.splice(0, c.stops.length - STOPS_KEPT)
    sup.host.contract?.(w, renderContract(c))
  }
  sup.host.save(w)
  return r
}

/** The job's deadline clock resumes: every pending deadline, the hop window and the last beat move by the held span. */
function releaseClock(sup, w) {
  const p = w.pausable
  if (p.heldAt == null) return 0
  const held = Math.max(0, sup.host.now() - p.heldAt)
  for (const t of w.pending || []) if (t.deadline_at != null) t.deadline_at += held
  if (w.awaiting) { w.awaiting.since += held; w.awaiting.due += held }
  if (w.lastBeat != null) w.lastBeat += held
  p.heldAt = null
  return held
}

const jobOf = (sup, id) => {
  const w = sup.workers.get(id)
  if (!w) return { why: 'no such worker' }
  if (!w.pausable) return { why: `${w.name} is not pausable: its header has no (pausable . #t)` }
  return { w }
}

/**
 * Pause: the worker freezes in frame (mailbox kept, clock held) and its process gets SIGSTOP through the hands.
 * `signal: false` is the park's pause: the record only, since the park's own act stops the process (parkJob).
 */
export function pauseJob(sup, id, { by = 'the owner', why = 'pressed', signal = true } = {}) {
  const { w, why: no } = jobOf(sup, id)
  if (!w) return { ok: false, why: no }
  const r = interrupt(sup, id, 'pause', by)
  if (!r.ok) return r
  w.pausable.heldAt = sup.host.now()
  const pid = w.pausable.pid
  if (pid && signal) sup.host.act?.('forge-signal', [pid, 'stop', id, w.pausable.runDir || null])
  else if (!pid) w.pausable.stopOwed = true   // pressed before the trainer started: SIGSTOP goes when its pid arrives (supervisor send)
  // the step is the trainer's, read by the hands from its progress record once SIGSTOP lands (signalDone); null until then
  const row = stopsRow(sup, w, { kind: 'pause', by, why, pid: pid || null, ...(pid && signal ? { step: null } : {}) })
  return { ok: true, ids: r.ids, signal: pid && signal ? 'SIGSTOP' : null, row }
}

/** Park: paused first, then `forge-park` writes the checkpoint and ends the process; parkDone records `parked-at`. */
export function parkJob(sup, id, { by = 'the owner', why = 'pressed' } = {}) {
  const { w, why: no } = jobOf(sup, id)
  if (!w) return { ok: false, why: no }
  const p = w.pausable
  if (p.parked) return { ok: false, why: `${w.name} is parked at step ${p.parked.step ?? 0} already` }
  if (p.parking) return { ok: false, why: `a park of ${w.name} is in flight (begun by ${p.parking.by}); one at a time` }
  // one act, the park's own SIGCONT and SIGTERM: a SIGSTOP sent beside it raced it, landed last, and held SIGTERM pending to the
  // park's deadline (the CI's final red of 2026-11-01, P-2026-11-01-the-eye-loaded-the-ci); the pause is the record only
  if (w.state === 'running') { const r = pauseJob(sup, id, { by, why: `park: ${why}`, signal: false }); if (!r.ok) return r }
  else if (w.state !== 'paused') return { ok: false, why: `the worker is ${w.state}` }
  if (!p.pid) return parkDone(sup, { id, ok: true, step: null, checkpoint: null, why: 'no process: nothing to checkpoint' }, { by, why })
  p.parking = { by, why, since: sup.host.now() }
  sup.host.act?.('forge-park', [p.pid, p.runDir, id])
  return { ok: true, parking: true, pid: p.pid }
}

/** The hands answered `forge-park`: the job is parked at its newest checkpoint (or the park failed and it stays paused). */
export function parkDone(sup, { id, ok = true, step = null, checkpoint = null, snapshot = null, why = '' } = {}, asked = null) {
  const w = sup.workers.get(id)
  if (!w?.pausable) return { ok: false, why: 'no such pausable worker' }
  const p = w.pausable
  const { by, why: reason } = asked || p.parking || { by: 'the broker', why: '' }
  p.parking = null
  if (!ok) { stopsRow(sup, w, { kind: 'park-failed', by, why: String(why).slice(0, 200) }); return { ok: false, why } }
  p.parked = { step: step ?? 0, checkpoint, snapshot, at: sup.host.now() }
  p.pid = null
  const row = stopsRow(sup, w, { kind: 'park', by, why: reason || why, parked_at: step ?? 0, checkpoint, snapshot })
  think(w, 'state', `parked at step ${step ?? 0} by ${by}${checkpoint ? `; checkpoint ${checkpoint}` : '; no checkpoint, a resume starts at step 0'}`, sup.host.now())
  event(sup, 'park', w, `at step ${step ?? 0}, by ${by}`)
  return { ok: true, parked_at: step ?? 0, checkpoint, row }
}

/** Resume: after a pause, SIGCONT; after a park, only on the owner's press (a new process from the checkpoint). */
export function resumeJob(sup, id, { by = 'the owner', pressed = false, diff = null } = {}) {
  const { w, why: no } = jobOf(sup, id)
  if (!w) return { ok: false, why: no }
  const p = w.pausable
  if (w.state !== 'paused') return { ok: false, why: `the worker is ${w.state}` }
  if (p.parking) return { ok: false, why: `a park of ${w.name} is in flight; resume after it lands` }
  const parked = p.parked
  if (parked && !pressed) return { ok: false, press: true, why: `${w.name} is parked at step ${parked.step}: a resume starts a new process from the checkpoint, so it is a press (the diff first)` }
  const r = interrupt(sup, id, 'resume', by)
  if (!r.ok) return r
  const held = releaseClock(sup, w)
  if (parked) {
    p.parked = null
    const row = stopsRow(sup, w, { kind: 'resume', by, from_park: parked.step, checkpoint: parked.checkpoint, diff: diff ? String(diff).slice(0, 64) : null, held_s: held })
    if (w.handlers.has('resume')) sup.send(id, 'resume', { checkpoint: parked.checkpoint, step: parked.step, diff })
    return { ok: true, ids: r.ids, from_park: parked.step, row }
  }
  p.stopOwed = false   // a resume before the trainer started cancels the owed SIGSTOP
  if (p.pid) sup.host.act?.('forge-signal', [p.pid, 'continue', id, p.runDir || null])
  const row = stopsRow(sup, w, { kind: 'resume', by, held_s: held, pid: p.pid || null })
  return { ok: true, ids: r.ids, signal: p.pid ? 'SIGCONT' : null, row }
}

/** The hands answered `forge-signal`: a signal that did not land is said, and a pause that did not stop the process undone. */
export function signalDone(sup, { id, ok = true, mode = 'stop', why = '', step = null } = {}) {
  const w = sup.workers.get(id)
  if (!w?.pausable) return { ok: false, why: 'no such pausable worker' }
  if (ok && mode === 'stop' && Number.isInteger(step)) {
    // the pause row names the step the trainer stopped at (its train.log, read by the hands after SIGSTOP; F5)
    const row = [...(w.pausable.rows || [])].reverse().find((r) => r.kind === 'pause')
    if (row && row.step == null) {
      row.step = step
      if (w.contract) sup.host.contract?.(w, renderContract(w.contract))
      sup.host.save(w)
    }
  }
  if (ok) return { ok: true }
  stopsRow(sup, w, { kind: 'signal-failed', by: 'the hands', why: `${mode}: ${String(why).slice(0, 180)}` })
  // fail closed on the record: a process that never stopped is not shown paused
  // a park in flight owns the process: a stop that missed it (the trainer already ending on the park's SIGTERM) resumes nothing
  if (mode === 'stop' && w.state === 'paused' && !w.pausable.parked && !w.pausable.parking) { interrupt(sup, id, 'resume', 'the broker'); releaseClock(sup, w) }
  return { ok: false, why }
}

/**
 * One control by name: the door's interrupt route calls this. A worker without the header keeps talk.mjs's interrupt.
 * @param {object} sup
 * @param {string} id the worker
 * @param {string} mode pause · park · resume · stop
 * @param {string} by who pressed
 * @param {{pressed?: boolean, diff?: string}} [o] the press and the diff hash, for a resume from a park
 */
export function control(sup, id, mode, by = 'the owner', o = {}) {
  const w = sup.workers.get(id)
  if (!w?.pausable || mode === 'stop') return mode === 'park' ? { ok: false, why: w ? `${w.name} is not pausable: its header has no (pausable . #t)` : 'no such worker' } : interrupt(sup, id, mode, by)
  if (mode === 'pause') return pauseJob(sup, id, { by })
  if (mode === 'park') return parkJob(sup, id, { by })
  if (mode === 'resume') return resumeJob(sup, id, { by, pressed: o.pressed === true, diff: o.diff ?? null })
  return { ok: false, why: 'mode is pause, park, resume or stop' }
}

/**
 * Pressure relief: compute pauses, memory parks, the lowest priority first (then the youngest), one job per call.
 * @param {object} sup
 * @param {'compute'|'memory'} need
 * @param {string} why the reason the card shows (`person turn`, `wall`)
 */
export function relieve(sup, need, why) {
  const can = (w) => w.pausable && !w.pausable.parking && !w.pausable.parked && (w.state === 'running' || (need === 'memory' && w.state === 'paused'))
  const pick = sup.living().filter(can).sort((a, b) => (a.pausable.priority - b.pausable.priority) || (b.started - a.started))[0]
  if (!pick) return { ok: false, why: `no pausable job to ${need === 'memory' ? 'park' : 'pause'}` }
  const r = need === 'memory' ? parkJob(sup, pick.id, { by: 'the broker', why }) : pauseJob(sup, pick.id, { by: 'the broker', why })
  return { ...r, id: pick.id, mode: need === 'memory' ? 'park' : 'pause' }
}

/**
 * The broker's acts and the reply each lands on (the foreman host's act road): the hands' record → the broker's word.
 * `forge-park` exit 15 is a park killed at its deadline: still parked, at the newest checkpoint.
 * @param {object} sup
 * @param {string} op forge-signal · forge-park · forge-brain · switch-brain
 * @param {Array} args the act's args as sent
 * @returns {function({exit: number, why?: string, rows?: Object}): Object}
 */
export const actReply = (sup, op, args) => (value) => {
  const ok = value.exit === 0
  const why = value.why || ''
  if (op === 'forge-signal') return signalDone(sup, { id: args[2], mode: args[1], ok, why, step: value.rows?.step ?? null })
  if (op === 'forge-park') return parkDone(sup, { id: args[2], ok: ok || value.exit === 15, step: value.rows?.parked_at ?? null, checkpoint: value.rows?.checkpoint ?? null, snapshot: value.rows?.snapshot ?? null, why })
  if (op === 'forge-brain') return swapDone(sup, { ok, to: args[0] === 'park' ? 'e2b' : '26b', why })
  // the swap road's summary is the hands' record of what serves now; without one (a deadline, a form refusal) nothing is claimed
  const sum = roadSummary(value)
  const r = swapDone(sup, { ok: ok && sum?.ok !== false, to: args[0], why: sum?.refused || why, serving: sum ? sum.serving : undefined, profile: sum?.profile ?? null })
  if (sup.governor) checkServing(sup, sum).catch(() => { /* the check is advice on top of the hands' record */ })
  return r
}

/**
 * After a swap, the engine's own word on what it serves (M-32: liveness from the probe, never from the broker's memory):
 * one `(status)` on the desk socket through the governor. A silent socket, a draining engine or another model than the
 * road's summary names is one `(swap-check …)` row and one letter. A supervisor without a governor checks nothing.
 * @param {object} sup
 * @param {?{'serving-blob'?: string}} sum the swap road's summary
 * @returns {Promise<{ok: boolean, why?: string, model?: string, skipped?: boolean}>}
 */
export async function checkServing(sup, sum) {
  if (!sup.governor) return { ok: true, skipped: true }
  const st = await sup.governor.engine()
  const want = sum?.['serving-blob'] ? String(sum['serving-blob']).split('/').pop() : null
  const why = !st.ok ? `nothing answers on the desk socket after the swap (${st.why})`
    : st.draining ? 'the engine on the desk socket is draining after the swap'
      : want && st.model !== want ? `the desk socket serves ${st.model}, not ${want}` : null
  if (!why) return { ok: true, model: st.model }
  sup.host.ledger?.(`(swap-check ${toSlat({ ok: false, why, serving: st.ok ? st.model : null, at: Math.round(sup.host.now()) })})\n`)
  sendMail(sup, null, { kind: 'self-report', severity: st.ok ? 'wrong' : 'sick', what: `After the swap: ${why}.`, evidence: { expected: want, model: st.model ?? null } })
  return { ok: false, why }
}

/** A pausable job started: the broker parks the 26B when the base or the wall says so (CARDS-2.0 §8.4). */
export function jobStarted(sup, w) {
  const p = w.pausable
  const d = mustPark({ base: p.base, needMB: p.memoryMB, availMB: memory(sup).availMB, brain: broker(sup).brain })
  if (!d.park) return { park: false, why: d.why }
  const r = beginSwap(sup, 'e2b', `the forge job ${w.name}: ${d.why}`, 'forge')
  if (r.swap) broker(sup).parkedFor = { job: w.id, name: w.name, since: sup.host.now(), backAt: p.etaS ? sup.host.now() + p.etaS : null }
  return { park: !!r.swap, why: r.swap ? d.why : r.held }
}

/** A pausable job ended: the 26B comes back when no other job holds it; a passed job's exam waits on the owner's press
 *  (passed = the done-check's pass, or a clean done after the hands answered its last act exit 0). */
export function jobEnded(sup, w, why = '') {
  const b = broker(sup)
  let back = null
  if (b.parkedFor?.job === w.id) {
    const other = sup.living().find((x) => x !== w && x.pausable && mustPark({ base: x.pausable.base, needMB: x.pausable.memoryMB, brain: '26b' }).park)
    if (other) b.parkedFor = { ...b.parkedFor, job: other.id, name: other.name }
    else { b.parkedFor = null; back = beginSwap(sup, '26b', `the forge job ${w.name} ended`, 'forge') }
  }
  // owed after the foreman's done-check passed, or after a clean done whose last act the hands answered exit 0 (their record, not a claim)
  const passed = w.contract?.outcome === 'pass' || (/^done:/.test(String(why)) && w.pausable.lastAct?.exit === 0)
  if (passed) sup.host.upstream('exam-owed', w, { run: w.id, base: w.pausable.base, kind: w.pausable.kind, why: "the exam waits on the owner's press" })
  return { back: back?.swap || null, exam: passed ? 'owed' : null }
}
