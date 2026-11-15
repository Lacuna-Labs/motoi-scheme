// card-worker.mjs — THE CARD WORKER (LACUNA-CARDS-2.0 §8.1, §8.2). Owns: one worker per open card,
// `worker/<card>#<instance>`, spawned when the card opens and stopped when it closes; its registry row for `GET /agents`;
// the answer to "how is that run going?" in the card's drawer (resolve the run, two reads on question, one AFH paragraph
// that names what it read, then `(surface show <card> <kind> <record> <view>)` through the door so the drawer places the
// chip); and `cardDoor`, the three foreman routes `POST /cards/<card>/open · close · ask` a mount serves in one line.
// Refuses: a card id outside `s-<name>`; a second worker for a card that already has one (the open returns the living
// one); a hand, an act, a file or a spawn (its program asks for `every` only, tier watch); a press (the surface's `show`
// places a chip, never a press, law 4); a chip without a receipt (a refused `show` places nothing and the paragraph says
// why: fail closed); a guessed run (no run named, none live, or several live: it asks which); a second try at a read or
// at the door (law 10: one try, then it says so); reading another card's drawer (§8.5: a card worker reads its own).
// Implements: LACUNA-CARDS-2.0 §8.1 (the agent, its reads, its verbs), §8.2 (the six steps), §8.5 (a card worker's
// reads); LACUNA-MINDS-1.0 §3.1 (the instance id); design §6 (a watch-tier worker under the supervisor).
// Invariants (design §18): "if an agent is listed as running, then a worker or a server behind it is alive" (the row
// comes from `sup.living()` only); "if the desk moved by a seat, then a receipt row names the seat" (the chip rides the
// door's receipt); "no seat presses".
// Faults (design §16): none raised by id; a read or the door that does not answer is one sentence in the answer.
import crypto from 'node:crypto'

/** A card id: the desk's `s-<name>` (apps/registry.jsx). */
export const CARD = /^s-[a-z0-9][a-z0-9-]{0,39}$/

/** The worker's program: one 60 s beat so the zombie law (alive.mjs, F-06) never stalls it while its card is open. */
export const CARD_PROGRAM = `(every 60 (lambda () #t)) (on 'ask (lambda (q) #t))`

/** What a card worker may be told from the desk: talk only (its card's close stops it). */
export const CARD_POWERS = Object.freeze(['talk'])

/**
 * The cards whose records this worker reads on question: card → the record kind it answers on and the view its chip
 * opens. A card not listed answers that it reads no run (an honest null) until its lane adds a row.
 */
export const CARD_RECORDS = Object.freeze({
  's-forge': { kind: 'run', view: 'effect', noun: 'run' },
})

const RUN_ID = /^[A-Za-z0-9][A-Za-z0-9@._-]{0,63}$/
const QUESTION = /\bhow(?:'s| is| are)?\b.*\b(going|doing|coming along)\b|\b(status|progress)\b.*\b(run|job|training)\b|\bhow far\b/i
const ROUTE = /^\/cards\/([^/]+)\/(open|close|ask)$/
const NAME = /^worker\/(s-[a-z0-9][a-z0-9-]{0,39})#([0-9a-z]{4})$/

/**
 * A worker's card, or null. A card worker brought back from its checkpoint after a foreman restart carries its name and
 * program but not this field: it is read again from them, so the card's next open finds it and its close stops it.
 * @param {object} w a worker
 * @returns {object|null}
 */
export function cardOf(w) {
  if (w.cardWorker) return w.cardWorker
  const m = w.program === CARD_PROGRAM ? String(w.name).match(NAME) : null
  if (!m) return null
  w.cardWorker = { card: m[1], id: w.name, instance: m[2], opened: w.started, named: null }
  return w.cardWorker
}

/**
 * The living worker for a card, or null.
 * @param {object} sup the supervisor
 * @param {string} card
 * @returns {object|null}
 */
export function workerOf(sup, card) {
  return sup.living().find((w) => cardOf(w)?.card === card) || null
}

/**
 * Opens a card's worker: spawns it when the card has none living, else returns the one it has.
 * @param {object} sup
 * @param {string} card
 * @param {{by?: string}} [o]
 * @returns {{ok: true, id: string, wid: string, fresh: boolean}|{ok: false, why: string}}
 */
export function openCard(sup, card, o = {}) {
  if (!CARD.test(String(card || ''))) return { ok: false, why: `"${String(card).slice(0, 48)}" is not a card id (s-<name>)` }
  const had = workerOf(sup, card)
  if (had) return { ok: true, id: had.cardWorker.id, wid: had.id, fresh: false }
  const instance = parseInt(crypto.randomBytes(3).toString('hex'), 16).toString(36).padStart(4, '0').slice(-4)
  const id = `worker/${card}#${instance}`
  let w
  try {
    w = sup.spawn({ name: id, program: CARD_PROGRAM, tier: 'watch', by: String(o.by || 'desk').slice(0, 40), verbs: ['every'], restart: 'temporary', kv: { card } })
  } catch (e) {
    return { ok: false, why: `the foreman did not spawn ${id}: ${String(e.message).slice(0, 200)}` }
  }
  if (w.state === 'grave') return { ok: false, why: `${id} did not load: ${w.last || 'its program failed'}` }
  w.cardWorker = { card, id, instance, opened: sup.host.now(), named: null }
  return { ok: true, id, wid: w.id, fresh: true }
}

/**
 * Closes a card's worker: stops it (state retired), so the registry no longer lists it.
 * @param {object} sup
 * @param {string} card
 * @returns {{ok: boolean, id: (string|null)}}
 */
export function closeCard(sup, card) {
  const w = workerOf(sup, card)
  if (!w) return { ok: true, id: null }
  return { ok: sup.stop(w.id, 'its card closed'), id: w.cardWorker.id }
}

/**
 * The registry rows for `GET /agents`: one per living card worker, kind `worker` (K1's worker shape) with its `card`
 * (agents.mjs calls this).
 * @param {object} sup
 * @returns {object[]}
 */
export function cardWorkerRows(sup) {
  return sup.living().filter((w) => cardOf(w)).map((w) => ({
    id: w.cardWorker.id, kind: 'worker', name: `${w.cardWorker.card}'s worker`, card: w.cardWorker.card, wid: w.id,
    does: `the ${w.cardWorker.card} card's worker: answers in its drawer from its form, its area and reads on question`,
    state: w.state, opened: w.cardWorker.opened, color: '#00e5ff', powers: CARD_POWERS,
  }))
}

/**
 * True when the words ask how a run is going.
 * @param {string} text
 * @returns {boolean}
 */
export function isRunQuestion(text) {
  return QUESTION.test(String(text || ''))
}

/**
 * Resolves "that run" (§8.2 step 2): the newest run id named in the thread, then the worker's last chip, then the one
 * live run on the card; several live or none is a question back. Pure.
 * @param {{thread?: string[], named?: (string|null), runs: Array<{id: string, live: boolean}>}} o
 * @returns {{id: string, by: string}|{ask: string}}
 */
export function resolveRun({ thread = [], named = null, runs = [] }) {
  const ids = runs.map((r) => r.id).filter((id) => RUN_ID.test(String(id)))
  for (const turn of [...thread].reverse()) {
    const hit = ids.filter((id) => String(turn).includes(id)).sort((a, b) => b.length - a.length)[0]
    if (hit) return { id: hit, by: 'named in this drawer' }
  }
  if (named && ids.includes(named)) return { id: named, by: 'the last chip in this drawer' }
  const live = runs.filter((r) => r.live && ids.includes(r.id))
  if (live.length === 1) return { id: live[0].id, by: 'the one live run on the card' }
  const some = (live.length ? live : runs.filter((r) => ids.includes(r.id))).slice(0, 3).map((r) => r.id)
  return { ask: some.length ? `Which run: ${some.join(', ')}?` : 'No run is live on this card and none is named. Which run?' }
}

const clock = (t) => new Date(t * 1000).toTimeString().slice(0, 5)
const num = (n) => (typeof n === 'number' ? n.toLocaleString('en-US') : String(n))

/**
 * The paragraph from the two reads, in AFH voice, naming what it read and when (§8.2 step 6). Pure.
 * @param {{id: string, contract: (object|null), status: (object|null), readAt: {contract: number, status: number}, why?: object}} o
 * @returns {string}
 */
export function compose({ id, contract, status, readAt, why = {} }) {
  const s = status || {}
  const parts = []
  if (s.live) {
    const pct = s.of ? Math.round((100 * s.step) / s.of) : null
    parts.push(`${id} trains: step ${num(s.step)}${s.of ? ` of ${num(s.of)}${pct != null ? ` (${pct} %)` : ''}` : ''}`)
  } else if (status) parts.push(`${id} is not training now${s.outcome ? `; it ended ${s.outcome}` : ''}`)
  else parts.push(`${id} has no forge status`)
  if (s.loss != null) parts.push(`loss ${s.loss}`)
  if (s.stage) parts.push(`stage ${s.stage}`)
  if (contract) parts.push(`contract ${contract.state}${contract.step ? ` at step ${contract.step}` : ''}`)
  const read = [
    contract ? `the contract at ${clock(readAt.contract)}` : `no contract (${why.contract || 'it is not a foreman run yet'})`,
    status ? `the forge run status at ${clock(readAt.status)}` : `no run status (${why.status || 'the forge did not list it'})`,
  ]
  return `${parts.join(', ')}. Read: ${read.join('; ')}.`
}

/**
 * The surface form that places the chip (§8.1 its verbs). Pure.
 * @param {string} card
 * @param {string} kind
 * @param {string} record
 * @param {string} view
 * @returns {string}
 */
export function showForm(card, kind, record, view) {
  return `(surface show ${card} ${kind} ${record} ${view})`
}

const once = async (f, ...args) => {
  try {
    return { ok: true, v: await f(...args) }
  } catch (e) {
    return { ok: false, why: String(e && e.message ? e.message : e).slice(0, 160) }
  }
}

/**
 * Answers one question in a card's drawer (§8.2). Each read and the door get one try.
 * @param {{card: string, text: string, thread?: string[], named?: (string|null), now: function(): number,
 *          reads?: {runs: function(): Promise<Array>, contract: function(string): Promise<?object>, status: function(string): Promise<?object>},
 *          surface?: function(string): Promise<{ok: boolean, receipt?: string, why?: string}>,
 *          brain?: function(object): Promise<string>}} q
 * @returns {Promise<{ok: boolean, text: string, read: string[], show: ?object, run?: string}>}
 */
export async function answer(q) {
  const rule = CARD_RECORDS[q.card]
  if (!rule || !q.reads) return { ok: true, text: `This card's worker reads no run on ${q.card} yet; its records are not wired to the worker.`, read: [], show: null }
  if (!isRunQuestion(q.text)) return { ok: true, text: `I answer how a ${rule.noun} on this card is going today; ask "how is that ${rule.noun} going".`, read: [], show: null }
  const listed = await once(q.reads.runs)
  if (!listed.ok) return { ok: false, text: `The card's runs did not answer (${listed.why}); one try, no retry.`, read: [], show: null }
  const pick = resolveRun({ thread: q.thread, named: q.named, runs: listed.v || [] })
  if (pick.ask) return { ok: true, text: pick.ask, read: ['runs'], show: null }
  const c = await once(q.reads.contract, pick.id)
  const tc = q.now()
  const s = await once(q.reads.status, pick.id)
  const ts = q.now()
  const why = { contract: c.ok ? null : `the read failed: ${c.why}`, status: s.ok ? null : `the read failed: ${s.why}` }
  const contract = c.ok ? c.v : null
  const status = s.ok ? s.v : null
  let text = compose({ id: pick.id, contract, status, readAt: { contract: tc, status: ts }, why })
  if (q.brain) {
    const b = await once(q.brain, { card: q.card, question: q.text, run: pick.id, contract, status, paragraph: text })
    if (b.ok && typeof b.v === 'string' && b.v.trim()) text = b.v.trim()
  }
  const read = [contract ? 'contract' : null, status ? 'status' : null].filter(Boolean)
  const state = status?.live ? 'live' : status ? 'ended' : 'unknown'
  if (!q.surface) return { ok: true, text: `${text} No chip: the surface door is not wired to this worker.`, read, show: null, run: pick.id }
  const form = showForm(q.card, rule.kind, pick.id, rule.view)
  const r = await once(q.surface, form)
  if (!r.ok || !r.v?.ok) return { ok: true, text: `${text} No chip: the door refused the show (${r.ok ? r.v?.why || 'no reason given' : r.why}).`, read, show: null, run: pick.id }
  return { ok: true, text, read, run: pick.id, show: { card: q.card, kind: rule.kind, record: pick.id, view: rule.view, state, receipt: r.v.receipt, form } }
}

/**
 * Forge's reads for its worker (§8.2 step 3): the runs and a run's status from the forge's run list
 * (`GET /api/forge/runs`: `live[]` with `{errand, worker?, step: {step, of, loss, stage, model}}`, `records[]`; a job the
 * hands started is named by its `worker`), and the contract from the foreman's own memory (the worker itself, or one whose
 * contract key, run or name is the run). Each call reads once.
 * @param {{getJson: function(string): Promise<object>, sup: object}} o `getJson` is the mount's one-try door client
 * @returns {{runs: function(): Promise<Array>, contract: function(string): Promise<?object>, status: function(string): Promise<?object>}}
 */
export function forgeReads({ getJson, sup }) {
  const rows = async () => {
    const d = await getJson('/api/forge/runs')
    if (!d || d.ok === false) throw new Error(d?.why || 'GET /api/forge/runs did not answer')
    const live = (d.live || []).map((x) => ({ id: String(x.worker || x.errand), live: true, ...(x.step || {}) }))   // a job the hands started: its worker is its id (F5)
    const ended = (d.records || []).filter((r) => r.model && !live.some((l) => l.id === r.model)).map((r) => ({ id: String(r.model), live: false, outcome: r.headline || null }))
    return [...live, ...ended]
  }
  return {
    runs: rows,
    status: async (id) => (await rows()).find((r) => r.id === id) || null,
    contract: async (id) => [...sup.workers.values()].find((w) => w.contract && (w.id === id || w.contract.key === id || w.contract.run === id || w.name === id))?.contract || null,
  }
}

/**
 * The foreman routes for the card workers, for a mount of one line in foreman.mjs:
 * `POST /cards/<card>/open`, `POST /cards/<card>/close`, `POST /cards/<card>/ask` {text, thread, session}.
 * @param {object} sup
 * @param {{reads?: function(string): object, surface?: function(string): Promise<object>, brain?: function(object): Promise<string>}} [deps]
 *   `reads(card)` returns the card's reads; `surface(form)` posts one form to the door with the seat `lacuna`
 * @returns {function(string, string, function(): Promise<object>): Promise<?{status: number, json: object}>}
 */
export function cardDoor(sup, deps = {}) {
  return async (method, pathname, readBody) => {
    const m = String(pathname).match(ROUTE)
    if (!m || method !== 'POST') return null
    const [, card, verb] = m
    if (!CARD.test(card)) return { status: 422, json: { ok: false, why: `"${card.slice(0, 48)}" is not a card id (s-<name>)` } }
    if (verb === 'open') { const r = openCard(sup, card); return { status: r.ok ? 200 : 422, json: r } }
    if (verb === 'close') return { status: 200, json: closeCard(sup, card) }
    const w = workerOf(sup, card)
    if (!w) return { status: 409, json: { ok: false, why: `${card} is not open: no worker answers its drawer` } }
    const b = (await readBody()) || {}
    const text = String(b.text || '').slice(0, 2000)
    if (!text.trim()) return { status: 422, json: { ok: false, why: 'a question is words' } }
    const thread = (Array.isArray(b.thread) ? b.thread : []).slice(-20).map((t) => String(t).slice(0, 2000))
    const a = await answer({ card, text, thread, named: w.cardWorker.named, now: () => sup.host.now(), reads: deps.reads?.(card) || null, surface: deps.surface, brain: deps.brain })
    if (a.run) w.cardWorker.named = a.run
    w.last = `asked in its drawer (${String(b.session || 'card').slice(0, 40)}): ${a.show ? 'a chip' : 'words'}`
    return { status: 200, json: { ...a, worker: w.cardWorker.id } }
  }
}
