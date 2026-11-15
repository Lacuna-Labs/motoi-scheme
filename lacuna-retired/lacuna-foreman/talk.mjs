// TALKABLE WORKERS — owns how the owner talks to any bot, interrupts one, and Lacuna knows (the owner, 2026-10-18: "Any spawned agent, I can
//   talk to it … I can interrupt one of them, and Lacuna knows what I'm doing"). Owns: thoughts (bounded ring per worker), events (bounded ring
//   per foreman: spawn · crash · restart · grave · stop · pause · resume · talk), talk (a signed (talk …); a mind answers from a quarantine-safe
//   slice under a text grammar of exactly (say "…")), pause/resume (timers, subscriptions, (after …) steps; walks children).
// Refuses: any verb in a talk answer (dropped, counted; the program answers instead with its state in plain words); the 26B unless the worker
//   holds need-brain; writing the world — the foreman's door calls these, Lacuna audits who did what.
// Implements: design §6, §13 (the desk talks to workers), §11; keeps LACUNA-1.3-DESIGN §36 as history.
// Invariants (§18): none written here; talking never makes a worker act (law 11).
// Faults (§16): none by id.
import { parse, Sym, toJson } from './scheme.mjs'
import { LAST_RUNG } from './cascade.mjs'
import { aliveFields } from './alive.mjs'          // a cycle (alive.mjs thinks through here); both use it only at run time
import { askMind } from './mind.mjs'             // a cycle (mind.mjs thinks through here); both use it only at run time

export const TALK = Object.freeze({ thoughts: 200, events: 200, text: 600, words: 1000, reply: 600 })

const short = (v, n = 160) => { const s = typeof v === 'string' ? v : JSON.stringify(toJson(v)); return (s ?? '').length > n ? s.slice(0, n) + '…' : s ?? '' }
const clock = (t) => new Date(t * 1000).toTimeString().slice(0, 5)
const ago = (s) => (s < 90 ? `${Math.round(s)} s` : s < 5400 ? `${Math.round(s / 60)} min` : `${(s / 3600).toFixed(1)} h`)

/** One thought into a worker's ring. */
export function think(w, kind, text, now) {
  const r = (w.thoughts ||= [])
  r.push({ t: now, kind, text: String(text ?? '').slice(0, TALK.text) })
  if (r.length > TALK.thoughts) r.splice(0, r.length - TALK.thoughts)
}

export const thoughts = (w, n = 50) => (w.thoughts || []).slice(-Math.max(1, Math.min(TALK.thoughts, Number(n) || 50)))

/** One line in the foreman's tree history. */
export function event(sup, kind, w, why = '') {
  const e = (sup.events ||= [])
  e.push({ t: sup.host.now(), kind, id: w.id, name: w.name, why: String(why || '').slice(0, 300) })
  if (e.length > TALK.events) e.splice(0, e.length - TALK.events)
}

/** Wire the rings into a supervisor without touching its control flow: spawn, send, hop and the way upstream are watched. */
export function attachTalk(sup) {
  sup.events = []
  const now = () => sup.host.now()
  const spawn = sup.spawn.bind(sup)
  sup.spawn = (o) => { const w = spawn(o); if (w.state !== 'grave') event(sup, 'spawn', w, `by ${o.by || 'lacuna'}`); return w }
  const send = sup.send.bind(sup)
  sup.send = (id, kind, value, o) => {
    const w = sup.workers.get(id)
    if (w && kind !== 'mind') think(w, 'mail-in', `${kind} ${short(value)}`, now())     // a mind's answer is its own thought
    return send(id, kind, value, o)
  }
  const hop = sup.hop.bind(sup)
  sup.hop = (from, to, kind, body) => {
    const w = sup.workers.get(from)
    if (w) think(w, 'mail-out', `${kind} → ${sup.workers.get(to)?.name || to} ${short(body)}`, now())
    return hop(from, to, kind, body)
  }
  const up = sup.host.upstream
  sup.host.upstream = (kind, w, data) => {
    if (w && sup.workers.get(w.id) === w) {
      if (kind === 'report') think(w, 'report', `${data.kind} ${short(data.data)}`, now())
      else if (kind === 'crashed') { event(sup, 'crash', w, data.why); w.restarts = (w.restarts || 0) + 1; event(sup, 'restart', w, `crash ${data.crashes} of 3`) }
      else if (kind === 'child-graved') event(sup, 'grave', w, data.why)
      else if (kind === 'retired') event(sup, 'stop', w, data.why)
      else if (['need-brain', 'hand', 'ask', 'act'].includes(kind)) think(w, 'mail-out', `${kind} → lacuna ${short(data)}`, now())
    }
    return up(kind, w, data)
  }
}

// ── pause / resume ─────────────────────────────────────────────────────────────────────────────────────────────────
function family(sup, w, out = []) {
  out.push(w)
  for (const c of w.children) { const x = sup.workers.get(c); if (x) family(sup, x, out) }
  return out
}

/** pause | resume | stop, walking its children. → {ok, ids, why?} */
export function interrupt(sup, id, mode, who = 'the owner') {
  const r = interruptInner(sup, id, mode, who)
  const w = sup.workers.get(id)
  if (r && r.ok && w && w.contract && (mode === 'pause' || mode === 'resume')) {   // D-8: the contract says paused, and running again
    w.contract.state = mode === 'pause' ? 'paused' : (w.contract.step > 0 ? 'running' : 'filed'); sup.host.contract?.(w, null)
  }
  return r
}

function interruptInner(sup, id, mode, who = 'the owner') {
  const w = sup.workers.get(id)
  if (!w) return { ok: false, why: 'no such worker' }
  const t = sup.host.now()
  if (mode === 'stop') {
    const ids = family(sup, w).filter((x) => !['retired', 'grave'].includes(x.state)).map((x) => x.id)   // a stalled one stops too
    return sup.stop(id, `stopped by ${who}`) ? { ok: true, ids } : { ok: false, why: `the worker is ${w.state}` }
  }
  const [from, to] = mode === 'pause' ? ['running', 'paused'] : mode === 'resume' ? ['paused', 'running'] : [null, null]
  if (!from) return { ok: false, why: 'mode is pause, resume or stop' }
  if (w.state !== from) return { ok: false, why: `the worker is ${w.state}` }
  const ids = []
  for (const x of family(sup, w)) {
    if (x.state !== from) continue
    x.state = to
    x.pausedBy = to === 'paused' ? { who, at: t } : null
    event(sup, mode, x, x === w ? `by ${who}` : `its parent ${w.name}, by ${who}`)
    think(x, 'state', to === 'paused' ? `paused by ${who}` : `resumed by ${who}`, t)
    if (to === 'running') for (const f of (x.held || []).splice(0)) f()   // the (after …) steps that came due while it slept
    if (to === 'running') for (const [k, v] of (x.mailbox || []).splice(0)) sup.send(x.id, k, v)   // its mailbox, in order
    sup.host.save(x)
    ids.push(x.id)
  }
  return { ok: true, ids }
}

// ── what it is doing, two ways ─────────────────────────────────────────────────────────────────────────────────────
/** The declared purpose: a cart's (does . "…"), else the program's opening ;; comment, else what it listens for. */
export function purpose(w) {
  if (w.cart?.does) return w.cart.does
  const lead = []
  for (const l of String(w.program || '').split('\n')) { const m = l.match(/^\s*;+\s?(.*)$/); if (m) lead.push(m[1]); else if (l.trim()) break }
  return lead.join(' ').trim().slice(0, 300) || null
}

/** Quarantine-safe: only what its program declared and what it chose to keep — text it read is never handed on. */
export function safeState(w, now) {
  const safe = (v) => (typeof v === 'number' || typeof v === 'boolean' || v == null ? v
    : w.readsUntrusted ? `(${typeof v === 'string' ? 'text' : 'data'} it read)` : short(v, 80))
  return {
    name: w.name, tier: w.tier, state: w.state, running_for: ago(now - w.started), purpose: purpose(w),
    listens_for: [...(w.handlers?.keys() || [])], watches: (w.subs || []).map((s) => `${s.metric} every ${s.seconds} s`),
    timers: (w.timers || []).length, remembered: Object.fromEntries(Object.entries(w.kv || {}).slice(0, 12).map(([k, v]) => [k, safe(v)])),
    last_reports: (w.reports || []).slice(-3).map((r) => ({ kind: r.kind, at: clock(r.at), data: (r.data || []).map(safe) })),
    children: (w.children || []).length, paused_by: w.pausedBy?.who || null,
  }
}

/** "a" or "an" before a word (video G4: "a act worker"). */
const an = (word) => (/^[aeiou]/i.test(String(word || '')) ? 'an' : 'a')
/** A sentence ends with its stop (video G4: a cart's `does`, unstopped, ran into the next sentence). */
const stopped = (s) => (/[.!?]$/.test(String(s).trim()) ? String(s).trim() : `${String(s).trim()}.`)

/** The program's answer, by code: its state in plain words. */
export function plainWords(w, now) {
  const s = safeState(w, now)
  const out = [`I am ${w.name}, ${an(w.tier)} ${w.tier} worker${w.cart ? ` (the cart ${w.cart.name})` : ''}, ${w.state === 'paused' ? 'paused' : w.state} — started ${clock(w.started)}, ${s.running_for} ago.`]
  if (w.state === 'paused') out.push(`${s.paused_by} paused me at ${clock(w.pausedBy.at)}; my timers and subscriptions wait.`)
  if (s.purpose) out.push(`What I do: ${stopped(s.purpose)}`)
  if (s.watches.length) out.push(`I watch ${s.watches.join(', ')}.`)
  if (s.listens_for.length) out.push(`I listen for ${s.listens_for.join(', ')}.`)
  if (s.timers) out.push(`I have ${s.timers} timer${s.timers > 1 ? 's' : ''} set.`)
  const keys = Object.entries(s.remembered)
  out.push(keys.length ? `I remember ${keys.map(([k, v]) => `${k} = ${typeof v === 'string' ? v : JSON.stringify(v)}`).join(', ')}.` : 'I remember nothing yet.')
  const r = s.last_reports.at(-1)
  out.push(r ? `My last report: ${r.kind}: ${r.data.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join('; ')}, at ${r.at}.` : 'I have not reported anything yet.')
  const heard = (w.thoughts || []).filter((x) => x.kind === 'mail-in').at(-1)
  if (heard) out.push(`Last I heard: ${heard.text} at ${clock(heard.t)}.`)
  if (s.children) out.push(`I have ${s.children} child worker${s.children > 1 ? 's' : ''}.`)
  return out.join(' ')
}

/** Periodic state into the ring, only when it changed. */
export function noteState(w, now) {
  const s = safeState(w, now)
  const line = `${s.state}; remembers ${Object.keys(s.remembered).join(', ') || 'nothing'}; ${s.timers} timer(s); ${s.watches.join(', ') || 'no subscriptions'}`
  if (w._stateLine !== line) { w._stateLine = line; think(w, 'state', line, now) }
}

// ── the mind's side: a text grammar, read back in code ───────────────────────────────────────────────────────────────
export const SAY_GRAMMAR = [
  'root ::= "(say \\"" ch* "\\")"',
  'ch ::= [^"\\\\\\n] | "\\\\" ["\\\\n]',
].join('\n')

/** Exactly (say "…"): anything else — a verb, two forms, junk — is refused, never run. */
export function readSay(text) {
  let forms
  try { forms = parse(String(text || '').trim()) } catch (e) { return { ok: false, why: `it does not read: ${e.message}` } }
  const f = forms[0]
  if (forms.length !== 1 || !Array.isArray(f) || !(f[0] instanceof Sym)) return { ok: false, why: 'not one (say "…") form' }
  if (f[0].name !== 'say') return { ok: false, why: `talking may only (say "…"), not (${f[0].name} …)` }
  if (f.length !== 2 || typeof f[1] !== 'string' || !f[1].trim()) return { ok: false, why: '(say "…") holds one string' }
  return { ok: true, text: f[1].trim().slice(0, TALK.reply) }
}

/** Which model answers for this worker's mind, or null (with why) when only the 26B would and it may not ask the brain. */
export function talkModel(w) {
  const job = [...(w.jobs?.values() || [])][0]
  if (!job) return { ok: false, why: 'it has no mind' }
  // a cart's job names its model (or its ladder's smallest rung); a plain (mind-job …) uses the foreman's default (null)
  const model = job.model || (job.rungs || []).find((m) => m !== LAST_RUNG) || (job.rungs?.length ? LAST_RUNG : null)
  if (model === LAST_RUNG && !w.verbs?.has('need-brain')) return { ok: false, why: 'only the 26B could answer, and it may not ask the brain' }
  return { ok: true, model, job: job.name }
}

// video C4 (2026-10-31): "make me a pong game" reached the forge-tender, which said what it does and never pointed to the desk.
// A worker cannot act from the talk road; words that ask it for work get one more sentence, by code: who can take it
const WORK_VERB = '(make|build|create|write|draw|design|generate|code|start|run|fix|deploy|file|train|add|set up)'
const ASKS_WORK = new RegExp(`^\\s*(please\\s+)?${WORK_VERB}\\b|\\b(can|could|would|will) you (please )?${WORK_VERB}\\b`, 'i')

/**
 * The sentence a request for work gets from a worker (video C4), or null when the words ask for none.
 * @param {{name: string}} w @param {string} words
 * @returns {?string}
 */
export function pointer(w, words) {
  return ASKS_WORK.test(String(words || '')) ? `${w.name} cannot take work from here; ask Lacuna at the desk, who can.` : null
}

/** The owner talks; → Promise<{reply, by: 'mind' | 'program'}>. The program is never handed the words as an event. */
export async function talk(sup, w, words, who = 'the owner') {
  const now = () => sup.host.now()
  const said = String(words || '').trim().slice(0, TALK.words)
  think(w, 'talk', `${who}: ${said}`, now())
  event(sup, 'talk', w, `${who}: ${said.slice(0, 200)}`)
  noteState(w, now())
  const pick = talkModel(w)
  let reply = null
  if (pick.ok && sup.host.mind) {
    const slice = safeState(w, now())
    const req = {
      job: 'talk', grammar: SAY_GRAMMAR, model: pick.model, untrusted: !!w.readsUntrusted,
      cascade: pick.model === LAST_RUNG, last: pick.model === LAST_RUNG,
      system: `You are the small mind of ${w.name}, one worker in a foreman. The owner is talking to you. Answer in one to three plain ` +
              'sentences, from YOUR STATE only, as exactly (say "…"). You cannot act from here: no verb, no promise to do anything. ' +
              'If YOUR STATE does not hold the answer, say so.',
      prompt: `THE OWNER SAYS: ${said}\nYOUR STATE: ${JSON.stringify(slice)}`,
    }
    think(w, 'prompt', `talk (${pick.model || 'the default mind'}): ${JSON.stringify(slice)}`, now())
    const ask = () => askMind(sup, req)                          // cut at the mind clock (J18)
    const p = (sup.mindQueue = (sup.mindQueue || Promise.resolve()).catch(() => {}).then(ask))
    sup.pending.add(p)
    try {
      const out = await p
      const text = out && typeof out === 'object' ? out.text : out
      const c = out && typeof out === 'object' && out.certainty != null ? ` (certainty ${Number(out.certainty).toFixed(2)})` : ''
      think(w, 'answer', `talk: ${short(text, 400)}${c}`, now())
      const r = readSay(text)
      if (r.ok) reply = { reply: r.text, by: 'mind' }
      else { w.mind.dropped++; w.mind.last_drop = r.why; think(w, 'answer', `dropped: ${r.why}`, now()) }
    } catch (e) {
      w.mind.failed++
      think(w, 'answer', `the mind did not answer: ${short(e && e.message ? e.message : e, 200)}`, now())
    } finally { sup.pending.delete(p) }
  }
  reply ||= { reply: plainWords(w, now()), by: 'program' }
  const away = pointer(w, said)
  if (away) reply = { ...reply, reply: `${reply.reply} ${away}` }
  think(w, 'talk', `→ ${reply.reply}`, now())
  sup.host.save(w)
  return reply
}

/** One node of the desk's tree. */
export function node(w) {
  const pick = talkModel(w)
  // a living worker's jobs; a finished cart's declared minds (its record keeps the header, not the jobs)
  const job = [...(w.jobs?.values() || [])][0] || Object.entries(w.cart?.minds || {}).map(([name, m]) => ({ name, model: m.model }))[0]
  const last = w.thoughts?.at(-1)
  return {
    id: w.id, name: w.name, kind: job ? 'agent' : 'worker', tier: w.tier,
    mind: job ? { model: (pick.ok && pick.model) || job.model || job.rungs?.[0] || null, job: job.name } : null,
    state: w.state, parent: w.parent, started: w.started, restarts: w.restarts || 0,
    last_line: w.last || (last ? `${last.kind}: ${last.text}` : null),
    ...aliveFields(w),           // §45.3: what it waits on, its beat, its packet, its checkpoint, its tool counts
  }
}
