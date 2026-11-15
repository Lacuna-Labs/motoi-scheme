#!/usr/bin/env node
// ~750 lines (over 500 by reason): the door's route table grew with 3.0's run, broker, mail, grants, foreman, carts and playbooks doors; the routes move to door.mjs at P9.
// THE FOREMAN — owns the one daemon per machine that spawns and supervises workers and runs: the HTTP/socket doors (/health, /workers,
//   /tree, /check, /runs[/<id>/intents|results|said|finish|mode|header], /intents, /press, /press-check, /contracts, /carts, /foremen, /broker,
//   /grants, /mail, /playbooks[/reload|/<id>/run], /sentry[/mode]), the upstream queue, persistence.
// Owns: the doors, the signed-event gate, the worker records in ~/lacuna-world/foreman/workers/<id>.json, the ckpt/<id>.json resume.
// Refuses: any request without X-Foreman-Token (file ~/.lacuna/foreman-token, 600; compared in constant time; no CORS preflight answered);
//   unsigned, forged, stale, replayed or malformed envelopes (dropped, counted in /health.dropped); talk to anything but Lacuna's API and the
//   hands socket; a run writer of `outcome pass` but finish; booting when it is imported (it is a program, never a library).
// Implements: design §5 (the shape), §6 (the kernel and its seven changes), §17; keeps LACUNA-1.3-DESIGN §32 as history. The wire (law 5):
//   a request in `application/slat` is one signed (msg …) opened at the gate and answered as a signed (msg …); a plain JSON request (the desk,
//   the tests) is answered in JSON until P7 retires lacuna-api. Routes: see each handler below.
// Invariants (§18): unsigned/forged/stale/replayed envelope → dropped and counted; outcome pass only by the done-check; a restart resumes.
// Faults (§16): F-10 (dropped envelope), F-11 (mail dedupe count), F-05 (no room, exit 89 at admission), F-03, F-21 at the intent door.
// Upstream (reports, crashes, graves, need-brain, ask) goes to Lacuna's API; when Lacuna is down it waits in a queue file.
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { Supervisor, LIMITS } from './supervisor.mjs'
import { describe, trial } from './trial.mjs'
import { seal, PROTOCOL } from './protocol.mjs'
import { talk, thoughts, node, noteState } from './talk.mjs'
import { checkpointStore } from './alive.mjs'
import { fileRun, intent, result, said, finishRun, resultsOf, resultText, press, pressCheck, setRunMode } from './intents.mjs'
import { setStop } from './job-loop.mjs'
import { kickSweep } from './kick.mjs'
import { wakeSweep, gradeForm, inShadow } from './sentry.mjs'
import { sentryMode } from './sentry-mode.mjs'
import { coast } from './coast.mjs'
import { governor, memoryMetric } from './governor.mjs'   // E1.3: the box's memory from one source, the governor's answer
import { cartSweep } from './cart-sentry.mjs'
import { runDo, doResult, loadOrders } from './orders.mjs'
import { logStream } from '../../lacuna-scheme/src/log.js'
import { dispatch, dispatchEngineer, readOrders, seatChange, fileCartOrders, evalGate, evalBookText, readEvalBook } from './work-orders.mjs'
import { boxIndex } from './assign.mjs'
import { registry } from './agents.mjs'
import { renderContract, contractData } from './contract.mjs'
import { wallSweep, brokerStatus, swapDone, beginSwap, broker, control, actReply, POOLS, PROFILE_CONTEXT, turnHold } from './broker.mjs'
import { livingRuns } from './runs.mjs'
import { onRunRow as gridRunRow } from './grid-ledger.mjs'
import { ledgerWriter } from './ledger-chain.mjs'
import { judge as judgeRun } from './judge.mjs'   // the S2 judge (W1.3); the foreman's own judge() is its manners
import { sendMail } from './mail.mjs'
import { Subforemen } from './subforeman.mjs'
import { handsPresent, sendToHands, writeContract } from './hands-link.mjs'
import { hatchRefusal, hatchTurn } from './hatch.mjs'
import { diffReplays, recordSession, replaySession } from './sei-replay.mjs'
import { loadCarts, cartRows } from './carts.mjs'
import { loadPlaybooks, indexText } from './playbook.mjs'
import { startPlaybook } from './playbook-run.mjs'
import { tellDoor, ownerHush, readNotes } from './tells.mjs'   // the owner's tells (P5, lane control): filed here, decided by his press
import { cardDoor, forgeReads } from './card-worker.mjs'
import { readBox, priceOf, stateOf, admitCart } from './box.mjs'   // the office: this box's profile (O1–O4)
import { brainOver } from './cascade.mjs'   // order §1.5: the current brain's fields come from ~/.lacuna/brain-profile.json
import { readForms, dataToJson } from '../../lacuna-scheme/src/slat-data.js'   // law 5: the ledger and the mail are read by the one reader, never a regex

const HOME = os.homedir()
const PORT = Number(process.env.FOREMAN_PORT || 1139)
const LACUNA = process.env.LACUNA_URL || 'http://127.0.0.1:1138'
const DIR = process.env.FOREMAN_DIR || path.join(HOME, 'lacuna-world', 'foreman')
const TELL_DIR = path.join(DIR, 'tells')   // the owner's tells: petitions.slat and told.slat (tells.mjs)
const WORKERS = path.join(DIR, 'workers')
const QUEUE = path.join(DIR, 'upstream-queue.jsonl')
const CKPT = checkpointStore(process.env.FOREMAN_CKPT_DIR || path.join(DIR, 'ckpt'))
// §45.3's clock, in seconds (the defaults are alive.mjs ALIVE: hand 120, act 600, beat 30, mind 360, sweep 10)
const num = (k) => (process.env[k] ? Number(process.env[k]) : undefined)
const DEADLINES = Object.fromEntries(Object.entries({ hand: num('FOREMAN_HAND_S'), act: num('FOREMAN_ACT_S'), beat: num('FOREMAN_BEAT_S'),
                                                      mind: num('FOREMAN_MIND_S'), sweep: num('FOREMAN_SWEEP_S'), hop: num('FOREMAN_HOP_S') }).filter(([, v]) => v > 0))
const TOKEN_FILE = process.env.FOREMAN_TOKEN_FILE || path.join(HOME, '.lacuna', 'foreman-token')
const NAME = process.env.FOREMAN_NAME || `studio`
// A RUN FOREMAN (3.0 §6 change 4, subforeman.mjs): forked by the root with FOREMAN_SUB=<run>; it listens on its own socket, signs with
// a key that arrives over IPC (never the token file), and sends upstream through the root. The root also listens on ~/.lacuna/foreman.sock.
const SUB = process.env.FOREMAN_SUB || null
const SOCK = process.env.FOREMAN_SOCK || (SUB ? null : path.join(DIR, 'foreman.sock'))   // inside the foreman's folder: foreman.sb writes nowhere else
const MIND_MODEL = process.env.FOREMAN_MIND_MODEL || 'functiongemma'
// what a cart's minds are picked from (read only; the sandbox allows exactly these two files)
const TIERS_FILE = process.env.FOREMAN_TIERS || path.join(HOME, 'lacuna-world', 'bench', 'agents', 'tiers.json')
const BOX_FILE = process.env.FOREMAN_BOX || path.join(HOME, 'code', 'lacuna', 'lacuna-box', 'brain', 'box-minds.json')
// the brain now serving (brain, brain_files, brain_kv_gb, max_params_b, workhorse): switch-brain.sh writes it here, never into BOX_FILE
const BRAIN_FILE = process.env.FOREMAN_BRAIN_PROFILE || path.join(HOME, '.lacuna', 'brain-profile.json')
// RUNNER MODE (FLAME on Fly, §32/B34): the same foreman far from home. It listens where FOREMAN_HOST says (Fly's private
// network), exits when it has had no living worker for FOREMAN_IDLE_S (Fly then stops the machine: scale to zero) and,
// whatever happens, after FOREMAN_MAX_LIFE_S — an orphan can never run up a bill. Home is LACUNA_URL, over WireGuard.
const HOST = process.env.FOREMAN_HOST || '127.0.0.1'
const IDLE_S = Number(process.env.FOREMAN_IDLE_S || 0)          // 0: the Studio's foreman never idles out
const MAX_LIFE_S = Number(process.env.FOREMAN_MAX_LIFE_S || 0)
const PRIVATE = (ip) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip) || (HOST !== '127.0.0.1' && /^fdaa:/i.test(ip || ''))
// THE PROGRAM, NEVER A LIBRARY (P-2026-11-06-foreman-mjs-boots-on-import: a probe's `import('./foreman.mjs')` booted a
// foreman on the live folder and took the live foreman's socket): it boots only when node runs this file (launchd,
// subforeman.mjs's fork, `npm start`); an import starts nothing and says so
const MAIN = (() => { try { return fs.realpathSync(process.argv[1] || '') === fs.realpathSync(fileURLToPath(import.meta.url)) } catch { return false } })()
if (!MAIN) throw new Error('lacuna-foreman/foreman.mjs is the foreman program: run it with node; importing it starts nothing')
fs.mkdirSync(WORKERS, { recursive: true })

function token() {
  try { return fs.readFileSync(TOKEN_FILE, 'utf8').trim() } catch { /* first start */ }
  const t = crypto.randomBytes(24).toString('hex')
  fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true })
  fs.writeFileSync(TOKEN_FILE, t, { mode: 0o600 })
  return t
}
const TOKEN = SUB ? await new Promise((resolve) => {        // the derived key, HMAC(token, run), from the root; nothing else is accepted
  // 2026-10-24, U3: the wait is cleared when the key lands (it was never cleared: every run foreman left with exit 12 at 10 s)
  const wait = setTimeout(() => { console.error('no key from the root in 10 s'); process.exit(12) }, 10_000)
  const onKey = (m) => { if (m && m.t === 'key' && typeof m.key === 'string') { clearTimeout(wait); process.off('message', onKey); resolve(m.key) } }
  process.on('message', onKey)
}) : token()
// C2: every log line is also one `(log …)` form in the foreman's own folder (its jail writes nowhere else), chained; the
// severity from the words (a refusal, a failure or an error is a warning; a stop of the whole is notice), info otherwise
const LOGS = SUB ? null : logStream(path.join(DIR, 'logs', 'foreman.slat'), 'foreman')
const sevOf = (t) => (/\b(fail|error|refus|denied|could not|did not|not loaded|exit [1-9])/i.test(t) ? 'warning' : /\bstopping\b|\bhushed\b/i.test(t) ? 'notice' : 'info')
const log = (...a) => {
  console.log(new Date().toISOString().slice(0, 19), ...a)
  if (LOGS) { const t = a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '); try { LOGS.write(sevOf(t), String(a[0] ?? '').slice(0, 40), t) } catch { /* the text log stands */ } }
}
// design §11: every token compare is constant time (ch. 4 §4.1.5 named the `!==` here)
const TOKEN_BUF = Buffer.from(TOKEN)
const tokenOk = (t) => { const g = Buffer.from(String(t || '')); return g.length === TOKEN_BUF.length && crypto.timingSafeEqual(g, TOKEN_BUF) }
/** One `(run (@ …))` or `(mail (@ …))` line read as data by the one reader; null when the line is not that form. */
function readRow(line, head) {
  try { const [f, ...rest] = readForms(line); if (rest.length || !Array.isArray(f) || f.length !== 2 || f[0]?.name !== head) return null; return dataToJson(f[1]) } catch { return null }
}

// ── the way upstream: Lacuna's API, or the queue until it answers ───────────────────────────────────────────────────
async function post(url, body) {
  // sealed at SEND time, not when queued: a message that waited in the queue goes with a fresh nonce and time, and the
  // JSON round trip turns what slat cannot carry (NaN, undefined) into null first
  const msg = JSON.parse(JSON.stringify(body))
  const signed = { ...msg, ...seal(TOKEN, { from: `foreman:${NAME}`, to: 'lacuna', kind: 'upstream', body: msg, at: Date.now() / 1000 }) }
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Lacuna-Who': `foreman:${NAME}` },
                               body: JSON.stringify(signed), signal: AbortSignal.timeout(5000) })
  if (!r.ok) throw new Error(`${r.status}`)
}
// THE HANDS (3.0 §5.1): a hand or act goes to lacuna-executor over its socket when the daemon is there; the reply comes back
// in the same hop. Without the socket (or with FOREMAN_HANDS=python) the retiring road through Lacuna's API answers.
const HANDS_SOCK = process.env.LACUNA_HANDS_SOCK || path.join(HOME, '.lacuna', 'hands.sock')
// grants (§7.8): the foreman cannot read the owner's key (foreman.sb); the hands verify the owner's HMAC and keep the rows
async function grantToHands(row, kind) {
  if (!handsRoad()) return { ok: false, why: 'the hands are not up: no grant can be checked' }
  const { sendToHands } = await import('./hands-link.mjs')
  let answer = null
  const w = { id: 'grants', name: 'grants', parent: null, tier: 'act', run: { key: 'grants' }, pending: [], handlers: new Map(), state: 'running', thoughts: [] }
  const r = await sendToHands({ sup, sock: HANDS_SOCK, key: TOKEN, kind, w, data: { ticket: `grant-${Date.now()}`, op: kind, args: row, deadline: 10 }, deliver: (v) => { answer = v } })
  return answer ? { ok: answer.exit === 0, ...answer } : { ok: false, why: r.why }
}
const handsRoad = () => process.env.FOREMAN_HANDS !== 'python' && handsPresent(HANDS_SOCK)
// one read the door asks for (the Network card's `net`, CARDS-2.0 §6.2): a hand to the hands daemon, whose ring keeps the
// samples between asks; the rows, or {ok: false, why} in one sentence. Only the reads named here; never an act.
const DOOR_READS = new Set(['net', 'coast-sample'])
async function readForDoor(op) {
  if (!DOOR_READS.has(op)) return { ok: false, why: `no door read '${op}'` }
  if (!handsRoad()) return { ok: false, why: 'the hands are not up: the read has no daemon to ask' }
  let answer = null
  const w = { id: 'door-reads', name: 'door-reads', parent: null, tier: 'hand', run: { key: 'door-reads' }, pending: [], handlers: new Map(), state: 'running', thoughts: [] }
  const r = await sendToHands({ sup, sock: HANDS_SOCK, key: TOKEN, kind: 'hand', w, data: { ticket: `door-${op}-${Date.now()}`, op, args: [], deadline: 20 }, deliver: (v) => { answer = v } })
  if (!answer) return { ok: false, why: r.why || `the hands did not answer the ${op} read` }
  return answer.exit === 0 ? { ok: true, ...(answer.rows && typeof answer.rows === 'object' ? answer.rows : { rows: answer.rows }) } : { ok: false, why: String(answer.why || `the ${op} read ended ${answer.exit}`).slice(0, 300) }
}
// the coast through the hands (J1): the jail refuses ps and vm_stat to the foreman, so the hands' daemon samples them; with
// the hands down the coast says what it can (an empty sample reads as clear with no numbers) and never throws
async function coastNow() {
  const s = await readForDoor('coast-sample')
  return s.ok && Array.isArray(s.rows) ? coast({ rows: s.rows, vm: s.vm || '' }) : coast()
}
function upstream(kind, w, data) {
  if ((kind === 'hand' || kind === 'act') && sup && handsRoad()) {
    sendToHands({ sup, sock: HANDS_SOCK, key: TOKEN, kind, w, data }).then((r) => { if (!r.ok) log(`${kind} ${data.op} via hands: ${r.why}`) })
    return
  }
  // a run foreman's relay keeps its stamp (U3, 2026-10-24: the root dropped run_foreman, so no record said which run's foreman it came from)
  const msg = { at: Date.now() / 1000, foreman: NAME, kind, worker: { id: w.id, name: w.name, parent: w.parent, tier: w.tier, ...(w.run_foreman ? { run_foreman: w.run_foreman } : {}) }, data }
  if (SUB && process.send) { if (process.connected) process.send({ t: 'up', msg }); else enqueue(QUEUE, JSON.stringify(msg), kind); return }
  post(`${LACUNA}/api/foreman/event`, msg).catch(() => enqueue(QUEUE, JSON.stringify(msg), kind))
}
// THE QUEUE FILES (2026-10-24, U3): a line the disk refuses is named in the log, never a crash (an unhandled rejection killed the
// foreman); one drain per file at a time (two overlapping drains posted each line twice); the lines appended while a drain
// posts are kept (the drain used to write back only what it had read, losing them)
function enqueue(file, line, what) { try { fs.appendFileSync(file, line + '\n') } catch (e) { log(`could not queue ${what}: ${e.message}; it is lost`) } }
const queued = (file) => { try { return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean) } catch { return null } }
const draining = new Set()
async function drainFile(file, send) {
  const lines = queued(file)
  if (!lines || draining.has(file)) return
  draining.add(file)
  try {
    const left = []
    for (const l of lines) { try { await send(l) } catch { left.push(l) } }
    const all = [...left, ...(queued(file) || []).slice(lines.length)]
    fs.writeFileSync(file, all.length ? all.join('\n') + '\n' : '')
  } catch (e) { log(`could not rewrite ${path.basename(file)}: ${e.message}`) } finally { draining.delete(file) }
}
const drain = () => drainFile(QUEUE, (l) => post(`${LACUNA}/api/foreman/event`, JSON.parse(l)))

// ── subscriptions: Lacuna's metrics delivered as events ─────────────────────────────────────────────────────────────
const subs = new Map()                // `${id}:${metric}` → interval
function subscribe(w, metric, seconds) {
  const key = `${w.id}:${metric}`
  if (subs.has(key)) clearInterval(subs.get(key))
  const tick = async () => {
    if (w.state === 'paused') return                                  // held, not dropped: the resume picks it up again
    if (w.state !== 'running') { clearInterval(subs.get(key)); subs.delete(key); return }
    const mem = memoryMetric(governor(sup).answer(), metric)   // E1.3: the memory metrics are the governor's; disk and up:* stay on the series
    if (mem !== undefined) { if (mem !== null) sup.send(w.id, metric, mem, { background: true }); return }
    try {
      const r = await fetch(`${LACUNA}/api/home/series?names=${encodeURIComponent(metric)}&hours=0.25`, { signal: AbortSignal.timeout(5000) })
      const pts = (await r.json())[metric] || []
      if (pts.length) sup.send(w.id, metric, pts[pts.length - 1][1], { background: true })
    } catch { /* Lacuna away: the next tick tries again */ }
  }
  subs.set(key, setInterval(tick, seconds * 1000))
  setTimeout(tick, 500)
}

// ── persistence ─────────────────────────────────────────────────────────────────────────────────────────────────────
function save(w) {
  const keep = { id: w.id, name: w.name, program: w.program, tier: w.tier, parent: w.parent, policy: w.policy, by: w.by,
                 state: w.state, kv: w.kv, reports: w.reports.slice(-LIMITS.reportsKept), started: w.started, last: w.last,
                 crashes: w.crashes.length, children: w.children, verbs: [...w.verbs], readsUntrusted: !!w.readsUntrusted,
                 mind: w.mind, cart: w.cart, restarts: w.restarts || 0, pausedBy: w.pausedBy || null,
                 // §45.3: what a stopped worker's card still shows after a restart
                 pending: w.pending, packet: w.packet || null, steps: w.steps || 0, tools: w.tools,
                 stallReason: w.stallReason || null, lastBeat: w.lastBeat ?? null, checkpointT: w.checkpointT ?? null }
  fs.writeFileSync(path.join(WORKERS, `${w.id}.json`), JSON.stringify(keep, null, 1))
  if (SUB && process.send && process.connected && !w.told) { w.told = true; process.send({ t: 'own', id: w.id }) }
}
// ── manners: the box first ──────────────────────────────────────────────────────────────────────────────────────
const BUDGET = { rssMB: Number(process.env.FOREMAN_RSS_MB || 400), freeMB: Number(process.env.FOREMAN_FREE_MB || 900),
                 load: Number(process.env.FOREMAN_LOAD || os.cpus().length * 0.9), lagMs: 250 }
let hush = null, calmSince = 0, lag = 0
const now0 = () => Date.now() / 1000
// the owner's hush (a `(hush …)` row his press wrote, tells.mjs) is read here, at the judge, and stands until its `until`
const ownerHushWhy = (now) => { const h = ownerHush(TELL_DIR, now); return h ? `the owner hushed me until ${new Date(h.until * 1000).toISOString().slice(11, 16)} UTC (${h.record})` : null }
const lagProbe = () => { const t = Date.now(); setImmediate(() => { lag = Date.now() - t }) }
setInterval(lagProbe, 1000).unref()
// AVAILABLE memory, not "free": on macOS os.freemem() counts only untouched pages and ignores the cache the system gives
// back on demand — it read 69 MB on a box with gigabytes to spare, and hushed the foreman for nothing (2026-10-18). Lacuna
// samples the real figure (mem_available_gb) every minute; read it from there.
// D1 (2026-10-25): the box itself first, downward in the stack. E1.3 (2026-10-30): one source, the governor (the hands'
// pressure read and coast-sample); no reading is null, and memory is then not judged this turn (never a false hush). D4: wired too.
let availMB = null, wiredMB = 0
async function readAvailable() { ({ availMB, wiredMB } = await governor(sup).sense()) }
function judge() {
  readAvailable()
  const rss = process.memoryUsage().rss / 1e6, free = availMB ?? Infinity, load = os.loadavg()[0]
  const told = ownerHushWhy(now0())
  if (readNotes(TELL_DIR, 'lacuna.foreman', now0())) log('read the owner\'s notes at this judge')   // the boundary a letter names (§5.1)
  const why = told ? told : rss > BUDGET.rssMB ? `my memory ${rss.toFixed(0)} MB is over ${BUDGET.rssMB}` :
              free < BUDGET.freeMB ? `the box has ${free.toFixed(0)} MB free` :
              load > BUDGET.load ? `the box's load is ${load.toFixed(1)}` :
              lag > BUDGET.lagMs ? `I am ${lag} ms behind` : null
  const now = Date.now()
  if (why && !hush) { hush = why; calmSince = 0; log('hushed:', why); upstreamRaw('manners', { hushed: true, why }) }
  else if (!why && hush) {
    if (!calmSince) calmSince = now
    if (now - calmSince > 60_000) { log('calm again'); upstreamRaw('manners', { hushed: false, was: hush }); hush = null }
  } else if (why) hush = why
}
setInterval(judge, 15_000).unref()
function upstreamRaw(kind, data) { upstream(kind, { id: '-', name: `foreman:${NAME}`, parent: null, tier: '-' }, data) }

// the small mind: asked through Lacuna (/api/foreman/mind), which checks the model is one this box lets an agent have (or
// the 26B as a cascade's last rung, always in the background lane) and passes it to the gateway; the job's grammar travels
// in our `grammar` field (llama.cpp decodes under it), and the supervisor reads the answer under the same rules in code
// either way — the decoder is not the only fence. The answer carries the server's token certainty when it gives one.
async function mind(req) {
  const r = await fetch(`${LACUNA}/api/foreman/mind`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Foreman-Token': TOKEN },
    // the 26B rung waits for the background lane's slot (a person always has the other); a small rung answers in seconds
    signal: AbortSignal.timeout(req.last ? 300_000 : 60_000),
    body: JSON.stringify({ model: req.model || MIND_MODEL, grammar: req.grammar, system: req.system, prompt: req.prompt, job: req.job,
                           cascade: !!req.cascade, last: !!req.last, shadow: !!req.shadow }),
  })
  if (!r.ok) throw new Error(`the small mind answered ${r.status}`)
  const d = await r.json()
  if (!d.ok) throw new Error(d.why || 'no answer')
  return { text: d.text || '', certainty: d.certainty ?? null, box: d.box || null }
}

// SHADOW MODE (§40.3, the calibration pass): LACUNA_SHADOW=1 makes every eligible rung answer every job, foreman-wide
const SHADOW = process.env.LACUNA_SHADOW === '1'
// the cascade's records go up to Lacuna, which keeps ~/lacuna-world/cascade/*.jsonl (this sandbox writes only its folder);
// when Lacuna is away they wait in a queue file here
const CASCADE_QUEUE = path.join(DIR, 'cascade-queue.jsonl')
async function postCascade(line) {
  const r = await fetch(`${LACUNA}/api/foreman/cascade`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Foreman-Token': TOKEN },
                                                          body: line, signal: AbortSignal.timeout(5000) })
  if (!r.ok) throw new Error(`${r.status}`)
}
function cascade(kind, rec) {
  const line = JSON.stringify({ kind, record: rec })
  postCascade(line).catch(() => enqueue(CASCADE_QUEUE, line, `cascade ${kind}`))
}
const drainCascade = () => drainFile(CASCADE_QUEUE, postCascade)

// the tables a cart's minds are picked from, re-read when they change (another job writes tiers.json)
const tableCache = {}
function readTable(file) {
  try {
    const m = fs.statSync(file).mtimeMs
    if (tableCache[file]?.m !== m) tableCache[file] = { m, doc: JSON.parse(fs.readFileSync(file, 'utf8')) }
    return tableCache[file].doc
  } catch { return null }
}
const tables = () => ({ tiers: readTable(TIERS_FILE), box: brainOver(readTable(BOX_FILE), readTable(BRAIN_FILE)) })
// THE EVAL SESSIONS' BOOK (order §1.2b, work-orders.mjs evalGate): kept in the foreman's folder so a restart does not give a loop
// another 24 h; written whole after each eval filing
const EVAL_BOOK = path.join(DIR, 'eval-sessions.slat')
let evalBookNow = null
const evalBook = () => (evalBookNow ??= readEvalBook((() => { try { return fs.readFileSync(EVAL_BOOK, 'utf8') } catch { return '' } })()))
const saveEvalBook = () => { if (evalBookNow) try { fs.writeFileSync(EVAL_BOOK, evalBookText(evalBookNow)) } catch (e) { log('eval book not written', e.code || e.message) } }
function evalFiled(key) {
  const g = evalGate(evalBook(), key, Date.now() / 1000)
  if (g.session) saveEvalBook()
  return g
}
// THE BOX PROFILE (O1): in the foreman's own folder, the only place its jail reads; re-read when it changes
const PROFILE_FILE = process.env.FOREMAN_PROFILE || path.join(HOME, 'lacuna-world', 'foreman', 'box.slat')
let profileAt = 0, profile = { box: { name: 'this box', wiredMB: Infinity, admitMB: 1500 }, minds: [] }
function boxProfile() {
  try { const t = fs.statSync(PROFILE_FILE).mtimeMs; if (t !== profileAt) { profile = readBox(fs.readFileSync(PROFILE_FILE, 'utf8')); profileAt = t } } catch { /* no profile: every price says unmeasured */ }
  return profile
}
const liveBox = () => ({ brain: sup ? broker(sup).brain : '26b', loaded: [], availMB: availMB ?? undefined, wiredMB: availMB == null ? undefined : wiredMB })   // K1: wired too

// THE CONTRACT (K2): the foreman renders it; lacuna-executor is its one writer to runs/<key>/CONTRACT.slat (design §8). Until the
// hands daemon lands it lives here and is served by GET /contracts/<id>. A letter to Claude is one file in the mail dir.
const CONTRACTS = new Map()
// the file: the hands write runs/<id>/CONTRACT.slat (the single writer); one write per run per 500 ms, the last text wins
const contractTimers = new Map()
function contractToHands(w, text) {
  if (!sup || !handsRoad()) return
  clearTimeout(contractTimers.get(w.id))
  contractTimers.set(w.id, setTimeout(() => { contractTimers.delete(w.id); writeContract({ sup, sock: HANDS_SOCK, key: TOKEN, w, text: CONTRACTS.get(w.id) }).then((r) => { if (!r.ok) log(`contract ${w.id} not written: ${r.why}`) }) }, 500))
}
const MAIL_DIR = process.env.LACUNA_MAIL_DIR || path.join(DIR, 'mail')     // ~/lacuna-world/mail/to-claude is a link to it (foreman.sb, law 4)
const LEDGER = process.env.LACUNA_LEDGER || path.join(DIR, 'ledger', 'runs.slat')
const SENTRY_MODE = sentryMode(path.join(DIR, 'sentry-mode.slat'))   // shadow until the owner's leave-shadow press (lane L2)
const HEARTBEAT = path.join(DIR, 'heartbeat')
// THE CARTS (3.0 §12.3–12.4): read from the repo (foreman.sb allows it), indexed into the foreman's folder, the first five spawned at boot
const CARTS_DIR = process.env.FOREMAN_CARTS || path.join(path.dirname(new URL(import.meta.url).pathname), 'carts')
const CARTS_SERVE = process.env.FOREMAN_CARTS_SERVE === undefined ? undefined : process.env.FOREMAN_CARTS_SERVE === '' ? [] : process.env.FOREMAN_CARTS_SERVE.split(',')         // the hands' watchdog reads it (H5): one number, seconds, every sweep
// THE PLAYBOOKS (MINDS §5.2; playbook.mjs): the repo's trees, loaded at boot and on POST /playbooks/reload; the index into the foreman's folder.
// foreman.sb reads lacuna-foreman and lacuna-scheme only: the repo's playbooks/ needs FOREMAN_PLAYBOOKS or the jail's word (law 4: the owner's).
// The jail's word stays as written: tools/restart.mjs copies the trees and the hands' unit names into the foreman's own
// folder (playbooks/trees, playbooks/units.json), which foreman.sb reads; the repo's folder is used only when readable.
const REPO_PLAYBOOKS = path.join(path.dirname(new URL(import.meta.url).pathname), '..', '..', 'playbooks')
const PLAYBOOKS_DIR = process.env.FOREMAN_PLAYBOOKS || (() => { try { fs.readdirSync(REPO_PLAYBOOKS); return REPO_PLAYBOOKS } catch { return path.join(DIR, 'playbooks', 'trees') } })()
const UNITS_FILE = path.join(DIR, 'playbooks', 'units.json')
let playbooks = { playbooks: [], rows: [], faults: [], source: 'not loaded' }
async function reloadPlaybooks() {
  try {
    playbooks = await loadPlaybooks(PLAYBOOKS_DIR, { unitsFile: UNITS_FILE })
    try { fs.mkdirSync(path.join(DIR, 'playbooks'), { recursive: true }); fs.writeFileSync(path.join(DIR, 'playbooks', 'INDEX.slat'), indexText(playbooks.rows)) } catch (e) { log('could not write playbooks/INDEX.slat:', e.message) }
    const ready = playbooks.rows.filter((r) => r.state === 'ready').length
    log(`playbooks: ${playbooks.rows.length} read from ${PLAYBOOKS_DIR}, ${ready} ready, ${playbooks.rows.length - ready} refused (units from ${playbooks.source})`)
  } catch (e) { playbooks = { playbooks: [], rows: [], faults: [], source: `not loaded: ${e.message}` }; log('playbooks did not load:', e.message) }
  return playbooks
}
const mailFiles = new Map()                        // letter id → file, for the dedupe count (mail.mjs)
function mail(m) {                                 // one `(mail …)` form per file (§7.6)
  try { fs.mkdirSync(MAIL_DIR, { recursive: true }); const f = path.join(MAIL_DIR, m.file); fs.writeFileSync(f, m.text + '\n'); mailFiles.set(m.id, f) }
  catch (e) { log('could not write mail:', e.message) }
}
function mailCount(id, count) {                    // F-11: the same letter again → its count, no new file
  const f = mailFiles.get(id); if (!f) return
  try { fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(/\("count" \d+\)/, `("count" ${count})`)) } catch { /* the file went; the count is on the worker */ }
}
// the forever ledger, each row chained to the line before it (ledger-chain.mjs; E14 row 10: 10,352 rows had no chain)
const ledger = ledgerWriter(LEDGER)
// the work rows beside the run rows (finale order §10 row 5): `work.slat` in the same ledger folder, one `(work …)` a line
function work(text) { fs.mkdirSync(path.dirname(LEDGER), { recursive: true }); fs.appendFileSync(path.join(path.dirname(LEDGER), 'work.slat'), text) }
let sup = null

// THE CARD WORKERS' DOOR (CARDS-2.0 §8.1, lane W1): `POST /cards/<card>/open · close · ask`. A card's reads are its own records
// (Forge: the forge's runs through the door, one try, 5 s); its chip is one `(surface show …)` posted to the door as the seat
// `lacuna` (the door answers 404 until the Node door serves /api/surface: the chip is then refused and the paragraph says why).
const getJson = async (p) => { try { const r = await fetch(`${LACUNA}${p}`, { signal: AbortSignal.timeout(5000) }); return r.ok ? await r.json() : null } catch { return null } }
const surfaceForm = async (form) => {
  try {
    const r = await fetch(`${LACUNA}/api/surface`, { method: 'POST', headers: { 'Content-Type': 'application/slat', 'X-Lacuna-Seat': 'lacuna' }, body: form, signal: AbortSignal.timeout(5000) })
    const j = await r.json().catch(() => ({}))
    return { ok: r.ok && j.ok !== false, ...j, status: r.status }
  } catch (e) { return { ok: false, why: `the door did not answer (${String(e.message || e).slice(0, 60)})` } }
}
let cardRoutes = null
// one press → one task: a pressed restart tell starts one playbook run whose act the executor runs (law 4; tells.mjs pressTell)
const tells = () => (tellRoutes ||= tellDoor({ dir: TELL_DIR, now: now0, log, task: async ({ playbook, bindings, by }) => {
  const pb = playbooks.playbooks.find((p) => p.id === playbook)
  if (!pb) return { ok: false, why: `no playbook ${playbook} on this foreman (${playbooks.source})` }
  const r = startPlaybook(sup, pb, { bindings, pressed: true, shadow: false, by, hands: { sock: HANDS_SOCK, key: TOKEN } })
  if (r.ok) r.finished.then((rep) => log(`tell ${playbook} ${r.w.id}: ${rep.outcome}${rep.exit == null ? '' : ` (exit ${rep.exit})`} — ${rep.why}`))
  return r.ok ? { ok: true, run: r.w.id } : { ok: false, why: r.why }
} }))
let tellRoutes = null
const cardsDoor = () => (cardRoutes ||= cardDoor(sup, { reads: (card) => (card === 's-forge' ? forgeReads({ getJson, sup }) : null), surface: surfaceForm }))
sup = new Supervisor({
  now: () => Date.now() / 1000,
  contract: (w, text) => { const t = text ?? renderContract(w.contract); CONTRACTS.set(w.id, t); contractToHands(w, t) }, mail, mailCount, ledger, work,
  // R1.3 (K1.13): a sealed or failed run with a class is one row in the grid's ledger half; a refused append stays on the worker.
  // W1.3: a failed run is judged once, by the resident 26B or 12B, as a (judged …) row beside its run row (judge.mjs)
  onRunRow: (row, w) => {
    const r = gridRunRow(sup, w, row); if (w.gridLedgerError) log('grid ledger:', r.why)
    if (row?.outcome === 'fail') judgeRun(sup, w, row).then((j) => log('judge', w.id, j.row ? 'judged' : j.why), (e) => log('judge', w.id, e.message))
  },
  memory: () => (availMB == null ? null : { availMB, wiredMB }),
  brainNow: () => { try { return /^(e4b|26b|12b|e2b)$/.exec(fs.readFileSync(path.join(DIR, 'brain-now'), 'utf8').trim())?.[0] || null } catch { return null } },
  brainSet: (mind) => { try { fs.writeFileSync(path.join(DIR, 'brain-now'), `${mind}\n`) } catch { /* the next restart assumes the 26B and says so */ } },
  cartFits: (header) => admitCart(header, boxProfile(), liveBox()),   // O4: a cart that cannot run here is refused at filing   // the broker's wall reads the box (D1), wired measured (D4)
  // THE SWAP ROAD (K-7): the broker's act goes to the hands on a pseudo-worker, pressed by the swap door; the reply ends it.
  // F2: `forge-signal` → signalDone, `forge-park` → parkDone (15 = killed at the deadline, still parked), `forge-brain` and
  // `switch-brain` → swapDone (`forge-brain park` lands as the brain e2b, unpark as the 26B)
  act: (op, args) => {
    const w = { id: 'broker', name: 'broker', parent: null, tier: 'act', run: { key: 'broker' }, pending: [], handlers: new Map(), state: 'running', thoughts: [] }
    const done = actReply(sup, op, args)
    const road = op === 'switch-brain' || op === 'forge-brain' ? 'swap' : 'broker'   // the log's word: a swap, or a job's stop
    sendToHands({ sup, sock: HANDS_SOCK, key: TOKEN, kind: 'act', w, data: { ticket: `broker-${op}-${Date.now()}`, op, args, pressed: true, deadline: 900 }, deliver: (value) => {
      const r = done(value); log(road, op, args.join(' '), '→', JSON.stringify(r))
    } }).then((r) => { if (!r.ok) { log(`${road} act ${op} failed: ${r.why}`); done({ exit: 12, why: r.why }) } })
  },
  // THE DRIVER (K-8): a run a cart filed is handed to the brain loop behind the door, which drives it to its done-check
  drive: (w) => { fetch(`${LACUNA}/api/runs/${encodeURIComponent(w.id)}/drive`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Foreman-Token': TOKEN }, body: JSON.stringify({ run: w.id, key: w.run.key, goal: w.contract.goal, role: w.run.role || 'cart' }), signal: AbortSignal.timeout(10_000) })
    .then(async (r) => { if (!r.ok) log(`drive ${w.id}: the door answered ${r.status}`) }).catch((e) => log(`drive ${w.id}: ${e.message}`)) },
  id: () => `w-${crypto.randomBytes(3).toString('hex')}`,
  key: TOKEN, mind, tables, cascade, shadow: SHADOW, deadlines: DEADLINES,
  mindsIndex: () => boxIndex(process.env),   // MINDS §4.3 (A16): the assignment rule reads the minds and jobs forms, 60 s cached
  save, upstream, subscribe, manners: () => ownerHushWhy(now0()) || hush, checkpoint: (id, d) => CKPT.write(id, d),
  sentryShadow: SENTRY_MODE.shadow,   // SENTRY §5: the mode file's last line; shadow when there is none
  sentryModel: (seat = 'sentry') => boxProfile().minds.find((m) => (m.seats || []).includes(seat))?.tag ?? null,   // SENTRY-2.0 §8: minds from box.slat, by seat (sentry · label)
  deskDir: () => DESK_DIR,
  handRoad: () => (handsRoad() ? 'the executor' : 'Lacuna'),   // the road a cart's hand takes, said on its step (verbs.mjs)
  seat: (rows) => { const r = seatChange(sup, rows, { dir: DESK_DIR }); log('seat', rows?.mind, '→', r.did, r.why) },   // the desk's `seat` verb (work-orders.mjs)
})

// the root's run foremen (K4); a child has none
const foremen = SUB ? null : new Subforemen({ sup, token: TOKEN, dir: DIR, sockDir: DIR, upstream, log })

// THE RESUME (§45.3, 2026-10-19). This used to spawn each living record again from its program: the load ran, but every
// ticket in flight, every timer a step had armed and every subscription a step had made were gone — ci-guard (w-cf9317)
// came back "running" with "remembers nothing; 0 timer(s); no subscriptions" and stayed so for 8 h. Now a worker comes
// back from its checkpoint (supervisor.resume): its tickets keep their deadlines (an expired one is re-sent once by the
// sweep, then timed out), its step-armed timers are armed again by name, its subscriptions come back. A worker that has
// no checkpoint yet (written before §45.3) comes back from its record, and the zombie law judges it like any other.
function reload() {
  const rows = fs.readdirSync(WORKERS).filter((f) => f.endsWith('.json'))
    .map((f) => { try { return JSON.parse(fs.readFileSync(path.join(WORKERS, f), 'utf8')) } catch { return null } })
    .filter(Boolean)
  // parents before children by the records' own parent links, then by birth (2026-10-24, U3: a child born in its parent's
  // clock tick was read first and skipped as an orphan; B02's rule: never order by a clock what a list already orders)
  const byId = new Map(rows.map((r) => [r.id, r]))
  const depth = (r) => { let d = 0; for (let p = r; p.parent && byId.has(p.parent) && d < 8; p = byId.get(p.parent)) d++; return d }
  rows.sort((a, b) => depth(a) - depth(b) || a.started - b.started)
  for (const r of rows) {
    if (r.state === 'running' || r.state === 'starting' || r.state === 'paused') {
      if (r.parent && !sup.workers.has(r.parent)) continue      // an orphan whose parent did not come back
      try {
        const ck = CKPT.read(r.id)
        const w = sup.resume(ck && ck.id === r.id ? { ...ck, cart: ck.cart || r.cart } : { ...r, pending: r.pending || [] })
        w.reports = r.reports || []
        if (r.mind) w.mind = { ...w.mind, ...r.mind }             // the desk's counts survive a restart
        w.restarts = r.restarts || 0
        if (r.started) w.started = r.started                     // the desk's 'started' is when it first began
        // D-8 on the way back: a paused worker's contract says paused too (2026-11-01: the checkpoint held the contract from
        // before the owner's pause, so the forge-tender came back paused while the runs list said running)
        if (r.state === 'paused' && w.state === 'running') { w.state = 'paused'; w.pausedBy = r.pausedBy; if (w.contract) w.contract.state = 'paused' }
        save(w)   // 2026-10-24, U3: the fields set after the spawn's own save (reports, mind counts, restarts) reach the disk before a second death
      } catch (e) { log('could not bring back', r.name, e.message) }
    } else {
      sup.workers.set(r.id, { ...r, crashes: [], handlers: new Map(), timers: [], subs: [], reports: r.reports || [], children: r.children || [] })
    }
  }
  log(`brought back ${sup.living().length} living worker(s)`)
}

// ── the door ────────────────────────────────────────────────────────────────────────────────────────────────────────
// SLAT ON THE WIRE (law 5, design §6 change 6; rows 9/10, 2026-10-24): a request that arrives as a signed (msg …) in `application/slat` is
// opened at the gate (dropped and counted when unsigned, forged, stale, replayed or malformed) and answered as a signed (msg …) — kind
// `reply` on a 2xx, `refused` otherwise. JSON stays for the desk's and the tests' plain calls until P7.
const SLAT = new WeakMap()                          // res → the sender it answers in slat
function send(res, code, body) {
  const to = SLAT.get(res)
  if (to) {
    const env = seal(TOKEN, { from: `foreman:${NAME}`, to, kind: code < 300 ? 'reply' : 'refused', body: JSON.parse(JSON.stringify(body)), at: Date.now() / 1000 })
    res.writeHead(code, { 'Content-Type': 'application/slat', 'X-Slat-Sig': env.sig }); return res.end(env.slat)
  }
  res.writeHead(code, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}
// a program is at most 64 KB; an event carries its body twice (the signed slat and the plain JSON beside it) and a hand's
// rows may fill the protocol's own limit, so the event door takes up to that (2026-10-18: 500 log lines were refused)
const EVENT_BYTES = PROTOCOL.bodyBytes * 2 + 64_000
async function body(req, max = LIMITS.programBytes * 2, res = null) {
  let b = ''
  for await (const c of req) { b += c; if (b.length > max) throw new Error('too large') }
  if ((req.headers['content-type'] || '').startsWith('application/slat')) {
    const got = sup.gate.open({ slat: b, sig: req.headers['x-slat-sig'] })
    if (!got.ok) { const e = new Error(`dropped (${got.drop}): ${got.why}`); e.code = 401; throw e }
    if (res) SLAT.set(res, got.msg.from)
    req.msgKind = got.msg.kind
    return got.msg.body && typeof got.msg.body === 'object' ? got.msg.body : {}
  }
  return b ? JSON.parse(b) : {}
}

const server = http.createServer(async (req, res) => {
  const ip = req.socket.remoteAddress
  if (ip && !PRIVATE(ip)) return send(res, 403, { ok: false, why: 'loopback (or the private network) only' })
  if (!tokenOk(req.headers['x-foreman-token'])) return send(res, 401, { ok: false, why: 'no token' })
  const url = new URL(req.url, 'http://x')
  const parts = url.pathname.split('/').filter(Boolean)
  if (!ip || String(req.headers.accept || '').includes('application/slat')) SLAT.set(res, String(req.headers['x-lacuna-who'] || 'lacuna').slice(0, 40))   // law 5: the socket speaks slat
  try {
    // MINDS §4.6: the coast (is anything else eating the box) and the sentry's view of every living run — the slash commands read these
    if (req.method === 'GET' && url.pathname === '/coast') return send(res, 200, { ok: true, ...(await coastNow()) })
    if (req.method === 'GET' && url.pathname === '/sentry') {
      sup.sweep(); kickSweep(sup); wakeSweep(sup)
      const c = await coastNow()
      const runs = sup.living().filter((w) => w.run).map((w) => ({ id: w.id, name: w.name, state: w.state, cart: w.cart || null, grade: gradeForm(sup, w),
                                                                  would: (w.sentry?.would || []).slice(-3).map((x) => x.text), wakes: (w.sentry?.wakes || []).filter((k) => !k.fired).length }))
      return send(res, 200, { ok: true, coast: { level: c.level, clear: c.clear, free_pct: c.free_pct, others: c.others, say: c.say }, runs, broker: brokerStatus(sup), mode: SENTRY_MODE.mode() })
    }
    if (req.method === 'POST' && url.pathname === '/sentry/mode') {   // the leave-shadow petition's decided road (lane L2); back to shadow needs no press
      const r = SENTRY_MODE.set(await body(req, undefined, res), Date.now() / 1000)
      log('sentry mode:', r.ok ? r.mode : `refused: ${r.why}`)
      return send(res, r.ok ? 200 : 422, r)
    }
    if (req.method === 'GET' && url.pathname === '/health')
      return send(res, 200, { ok: true, foreman: NAME, living: sup.living().length, total: sup.workers.size, limits: LIMITS,
                              hushed: ownerHushWhy(now0()) || hush, shadow: SHADOW, budget: BUDGET, rss_mb: Math.round(process.memoryUsage().rss / 1e6), lag_ms: lag,
                              ...sup.status() })
    // a list is swept first (§45.3): a worker with nothing pending is never listed as running
    if (req.method === 'GET' && (url.pathname === '/workers' || url.pathname === '/tree')) { sup.sweep(); kickSweep(sup); wakeSweep(sup) }
    if (req.method === 'GET' && url.pathname === '/workers') {
      const all = [...sup.workers.values()].map(describe).sort((a, b) => (a.state === 'running' ? 0 : 1) - (b.state === 'running' ? 0 : 1) || b.started - a.started)
      return send(res, 200, { ok: true, foreman: NAME, hushed: ownerHushWhy(now0()) || hush, ...sup.status(), workers: all.slice(0, 200) })
    }
    if (req.method === 'GET' && url.pathname === '/tree')
      return send(res, 200, { ok: true, nodes: [...sup.workers.values()].map(node), events: sup.events.slice(-200) })
    if (foremen && parts[0] === 'workers' && parts[1] && foremen.owns(parts[1])) {   // a worker in a run foreman: its door answers
      const b = req.method === 'POST' ? await body(req, EVENT_BYTES, res) : null
      const r = await foremen.forward(foremen.owns(parts[1]), req.method, req.url, b)
      return send(res, r.code, r.body)
    }
    if (foremen && url.pathname === '/foremen' && req.method === 'GET') return send(res, 200, { ok: true, foremen: foremen.status(), brain: brokerStatus(sup).brain })
    if (foremen && url.pathname === '/foremen' && req.method === 'POST') { const b = await body(req, undefined, res); const r = foremen.spawn(b.run); return send(res, r.ok ? 200 : 422, r) }
    if (foremen && parts[0] === 'foremen' && parts[1] && parts[2] === 'workers' && req.method === 'POST') {   // spawn inside a run foreman
      const b = await body(req, undefined, res); const r = await foremen.forward(parts[1], 'POST', '/workers', b); return send(res, r.code, r.body)
    }
    if (foremen && parts[0] === 'foremen' && parts[1] && req.method === 'DELETE') return send(res, 200, { ok: foremen.stop(parts[1], `stopped by ${(url.searchParams.get('by') || 'lacuna').slice(0, 40)}`) })
    { const r = await cardsDoor()(req.method, url.pathname, () => body(req, EVENT_BYTES, res)); if (r) return send(res, r.status, r.json) }   // the card workers (W1)
    { const r = await tells()(req.method, url, () => body(req, EVENT_BYTES, res)); if (r) return send(res, r.status, r.json) }   // the owner's tells (P5)
    if (parts[0] === 'workers' && parts[2] === 'thoughts' && req.method === 'GET') {
      const w = sup.workers.get(parts[1])
      return w ? send(res, 200, { ok: true, items: thoughts(w, url.searchParams.get('n') || 50) }) : send(res, 404, { ok: false, why: 'no such worker' })
    }
    if (parts[0] === 'workers' && parts[2] === 'talk' && req.method === 'POST') {
      // the owner's words, through Lacuna, as a signed (talk …): the same gate as any message, and it must be for THIS worker
      const b = await body(req, EVENT_BYTES, res)
      const g = sup.gate.open({ slat: b.slat, sig: b.sig })
      if (!g.ok) return send(res, 401, { ok: false, why: `dropped (${g.drop}): ${g.why}` })
      if (g.msg.kind !== 'talk' || g.msg.to !== parts[1] || g.msg.from !== 'lacuna') return send(res, 400, { ok: false, why: 'a talk is (talk …) from lacuna to this worker' })
      const w = sup.workers.get(parts[1])
      if (!w) return send(res, 404, { ok: false, why: 'no such worker' })
      const m = g.msg.body || {}
      const r = await talk(sup, w, String(m.text || ''), String(m.who || 'the owner').slice(0, 40))
      log('talk:', w.name, r.by)
      return send(res, 200, { ok: true, ...r })
    }
    if (parts[0] === 'workers' && parts[2] === 'interrupt' && req.method === 'POST') {
      const b = await body(req, undefined, res)
      // F2: a pausable job goes through the broker (pause · park · resume; a resume from a park only with the press the API's
      // decided road sends, `pressed` and the diff hash); any other worker keeps talk.mjs's interrupt inside control()
      const r = control(sup, parts[1], String(b.mode || ''), String(b.by || 'the owner').slice(0, 40), { pressed: b.pressed === true, diff: typeof b.diff === 'string' ? b.diff.slice(0, 64) : null })
      log('interrupt:', parts[1], b.mode, r.ok ? (r.ids || [parts[1]]).join(' ') : r.why)
      return send(res, r.ok ? 200 : r.why === 'no such worker' ? 404 : 409, r)
    }
    if (parts[0] === 'workers' && parts[1] && req.method === 'GET') {
      const w = sup.workers.get(parts[1])
      return w ? send(res, 200, { ok: true, worker: describe(w) }) : send(res, 404, { ok: false, why: 'no such worker' })
    }
    if (url.pathname === '/check' && req.method === 'POST') {
      const b = await body(req, undefined, res)
      return send(res, 200, trial(b.program, tables()))
    }
    // O20, O21: the owner's Scheme — one form run now, or the standing orders in <foreman>/orders/ (orders.mjs)
    if (url.pathname === '/do' && req.method === 'POST') {
      const b = await body(req, undefined, res)
      let w; try { w = runDo(sup, String(b.form || ''), { tier: b.tier }) } catch (e) { return send(res, 422, { ok: false, why: String(e.message || e) }) }
      log('do', w.name, w.id, w.state)
      return send(res, w.state === 'grave' ? 422 : 200, doResult(w))
    }
    if (parts[0] === 'do' && parts[1] && req.method === 'GET') return send(res, 200, doResult(sup.workers.get(parts[1])))
    if (url.pathname === '/orders' && req.method === 'GET') return send(res, 200, { ok: true, orders: sup.living().filter((w) => w.name.startsWith('order:')).map((w) => ({ id: w.id, name: w.name, state: w.state })) })
    if (url.pathname === '/orders/reload' && req.method === 'POST') return send(res, 200, { ok: true, ...loadOrders(sup, path.join(DIR, 'orders'), { log }) })
    if (url.pathname === '/workers' && req.method === 'POST') {
      const b = await body(req, undefined, res)
      const w = sup.spawn({ name: b.name, program: b.program, tier: b.tier, policy: b.policy, parent: b.parent, by: b.by || 'lacuna',
                            verbs: Array.isArray(b.verbs) ? b.verbs : null, readsUntrusted: b.reads_untrusted === true,
                            // {goal, task, parent, done_so_far, cortex_refs, branch, deadline}: its first event, (on 'start …)
                            packet: b.packet && typeof b.packet === 'object' ? b.packet : null })
      log('spawned', w.name, w.id, w.state)
      return send(res, w.state === 'grave' ? 422 : 200, { ok: w.state !== 'grave', worker: describe(w), why: w.state === 'grave' ? w.last : undefined })
    }
    if (parts[0] === 'workers' && parts[2] === 'event' && req.method === 'POST') {
      const b = await body(req, EVENT_BYTES, res)
      const r = sup.deliver({ slat: b.slat, sig: b.sig }, { to: parts[1] })
      // the sender and the body's shape, never the body (2026-10-23: 5 unsigned + 5 forged drops on this road with no sender named)
      if (r.dropped) log('dropped at the door:', r.why, `from ${String(req.headers['x-lacuna-who'] || ip || 'socket').slice(0, 40)} to ${parts[1]} keys ${Object.keys(b).join(' ')} kind ${String(b?.kind ?? '-').slice(0, 20)}`)
      return send(res, r.dropped ? 401 : 200, r)
    }
    if (url.pathname === '/runs' && req.method === 'GET') {             // living runs; with a query also the ledger's ended runs (ch. 4 §4.11)
      const q = url.searchParams; const want = ['cart', 'outcome', 'key', 'exit'].filter((k) => q.has(k))
      if (!want.length && !q.has('ended')) return send(res, 200, { ok: true, runs: livingRuns(sup) })
      let ended = []
      try { ended = fs.readFileSync(LEDGER, 'utf8').trim().split('\n').filter(Boolean).slice(-5000).map((l) => readRow(l, 'run')).filter(Boolean)
                      .map((r) => ({ id: r.id, cart: r.cart, key: r.run, outcome: r.outcome, exit: r.exit, first_try: r['first-try'] === true, ended: r.ended })) } catch { /* no ledger yet */ }
      const match = (r) => want.every((k) => String(r[k === 'key' ? 'key' : k]) === q.get(k))
      const liv = livingRuns(sup).filter(match).map((r) => ({ ...r, living: true })); const end = ended.filter(match).slice(-Number(q.get('limit') || 200)).reverse().map((r) => ({ ...r, living: false }))
      return send(res, 200, { ok: true, runs: [...liv, ...end], ended: end })
    }
    if (url.pathname === '/mail' && req.method === 'POST') {           // a letter from a person or a tool (§7.6); the worker's own road is the mail verb
      const b = await body(req, undefined, res); const r = sendMail(sup, null, { kind: b.kind, severity: b.severity, what: b.what, evidence: b.evidence, asks: b.asks, run: b.run, untrusted: b.untrusted === true })
      return send(res, r.ok ? 200 : 422, r)
    }
    if (url.pathname === '/mail' && req.method === 'GET') {            // the letters on disk, newest first: {file, id, kind, from, at, severity, run, what, count}
      let rows = []
      try { rows = fs.readdirSync(MAIL_DIR).filter((f) => f.endsWith('.slat')).sort().reverse().slice(0, Number(url.searchParams.get('n') || 50)).map((f) => {
        const m = readRow(fs.readFileSync(path.join(MAIL_DIR, f), 'utf8').trim(), 'mail') || {}
        return { file: f, id: m.id ?? null, kind: m.kind ?? null, from: m.from ?? null, at: m.at ?? null, severity: m.severity ?? null, run: m.run ?? null, what: m.what ?? null, count: Number(m.count ?? 1) }
      }) } catch { /* no mail yet */ }
      const to = url.searchParams.get('to'); return send(res, 200, { ok: true, mail: to && to !== 'claude' ? [] : rows })
    }
    if (url.pathname === '/carts' && req.method === 'GET') return send(res, 200, { ok: true, carts: cartRows(sup, CARTS_DIR, { tables: tables() }) })
    // A29 (MINDS §5.6): every agent and its agency — the seats, the sentry and the broker, every cart with its workers, the shelf
    if (url.pathname === '/agents' && req.method === 'GET') { sup.sweep(); return send(res, 200, { ok: true, ...registry(sup, { cartRows: cartRows(sup, CARTS_DIR, { tables: tables() }), index: boxIndex(process.env) }) }) }
    if (url.pathname === '/carts/reload' && req.method === 'POST') { const r = loadCarts(sup, CARTS_DIR, { indexDir: path.join(DIR, 'carts'), serve: CARTS_SERVE, tables: tables(), log }); return send(res, 200, { ok: true, spawned: r.spawned, kept: r.kept, refused: r.refused }) }
    if (url.pathname === '/playbooks' && req.method === 'GET') return send(res, 200, { ok: true, source: playbooks.source, playbooks: playbooks.rows, faults: playbooks.faults })
    if (url.pathname === '/playbooks/reload' && req.method === 'POST') { const r = await reloadPlaybooks(); return send(res, 200, { ok: true, source: r.source, playbooks: r.rows, faults: r.faults }) }
    if (parts[0] === 'playbooks' && parts[1] && parts[2] === 'run' && req.method === 'POST') {   // one run of a ready tree: bindings, the owner's press, shadow
      const b = await body(req, undefined, res)
      const pb = playbooks.playbooks.find((p) => p.id === parts[1])
      if (!pb) return send(res, 404, { ok: false, why: `no playbook ${parts[1]}` })
      const r = startPlaybook(sup, pb, { bindings: b.bindings && typeof b.bindings === 'object' ? b.bindings : {}, pressed: b.pressed === true, shadow: typeof b.shadow === 'boolean' ? b.shadow : undefined,
                                         by: String(b.by || 'lacuna').slice(0, 40), hands: { sock: HANDS_SOCK, key: TOKEN } })
      if (!r.ok) return send(res, 422, r)
      r.finished.then((rep) => log(`playbook ${pb.id} ${r.w.id}: ${rep.outcome}${rep.exit == null ? '' : ` (exit ${rep.exit})`} — ${rep.why}`))
      log('playbook run', pb.id, r.w.id, r.shadow ? 'shadow' : 'live')
      return send(res, 200, { ok: true, run: r.w.id, playbook: pb.id, shadow: r.shadow, contract: renderContract(r.w.contract) })
    }
    if (url.pathname === '/broker' && req.method === 'GET') return send(res, 200, { ok: true, ...brokerStatus(sup) })
    // the office (O1–O3): every mind on this box with its state and the price of waking it; a price is never a swap
    if (url.pathname === '/box' && req.method === 'GET') {
      const p = boxProfile(); const live = liveBox()
      if (url.searchParams.get('mind')) return send(res, 200, priceOf(p, url.searchParams.get('mind'), live))
      return send(res, 200, { ok: true, box: p.box, avail_mb: live.availMB ?? null, minds: p.minds.map((m) => ({ ...m, state: stateOf(p, m, live), price: priceOf(p, m.id, live) })) })
    }
    if (url.pathname === '/box/price' && req.method === 'GET') return send(res, 200, priceOf(boxProfile(), url.searchParams.get('mind') || '', liveBox()))
    if (url.pathname === '/net' && req.method === 'GET') return send(res, 200, await readForDoor('net'))   // the Network card (§6.2)
    if (url.pathname === '/broker/swap' && req.method === 'POST') {     // the owner's (or the proof's) press on a swap: begins it
      const b = await body(req, undefined, res); const to = String(b.to || ''); if (!POOLS.brain.models.includes(to)) return send(res, 422, { ok: false, why: `to is ${POOLS.brain.models.join(', ')}` })
      // the owner's window for the load (the door sends the one switch-brain.sh reads), so the price is the profile that loads
      const profile = b.profile == null ? null : String(b.profile); if (profile && !Object.hasOwn(PROFILE_CONTEXT, profile)) return send(res, 422, { ok: false, why: `profile is ${Object.keys(PROFILE_CONTEXT).join(', ')}` })
      // a turn running on the desk's engine holds the swap until it ends, unless the owner says now (row 15; the engine's (status))
      const held = turnHold(sup.governor?.engine ? await sup.governor.engine().catch(() => null) : null, b.now === true)
      if (held) return send(res, 409, { ok: false, swap: null, held })
      broker(sup).armedBy = String(b.by || 'owner').slice(0, 40); const r = beginSwap(sup, to, `pressed by ${broker(sup).armedBy}`, broker(sup).armedBy, profile); return send(res, r.swap ? 200 : 409, { ok: !!r.swap, ...r })
    }
    if (url.pathname === '/broker/swapped' && req.method === 'POST') { const b = await body(req, undefined, res); return send(res, 200, swapDone(sup, { ok: b.ok !== false, to: b.to, why: b.why })) }
    if (url.pathname === '/runs' && req.method === 'POST') {
      const b = await body(req, undefined, res)
      const gate = evalFiled(b.key)   // order §1.2b: an eval session filing for 24 h without a pause is a loop no one watches
      if (!gate.ok) { log('run refused', b.key, gate.why); return send(res, 429, { ok: false, why: gate.why }) }
      const w = fileRun(sup, { key: b.key, goal: b.goal, expect: b.expect, doneCheck: b.done_check, hands: b.hands, acts: b.acts, tier: b.tier,
                               intensity: b.intensity, brain: b.brain, by: b.by || 'brain', desk: b.desk, hops: b.hops, repo: b.repo, touches: b.touches, press: b.press, role: b.role, class: b.class, jobs: b.jobs })
      log('run filed', w.name, w.id)
      return send(res, 200, { ok: true, run: w.id, key: w.run.key, contract: renderContract(w.contract) })
    }
    if (parts[0] === 'runs' && parts[1] && req.method === 'POST') {
      const b = await body(req, EVENT_BYTES, res)
      const r = parts[2] === 'intents' ? intent(sup, parts[1], { tool: b.tool, args: b.args, promise: b.promise, deadline_s: b.deadline_s, idem: b.idem })
              : parts[2] === 'results' ? result(sup, parts[1], b.kind === 'act' ? 'act' : 'hand', b)
              : parts[2] === 'said' ? said(sup, parts[1], b.text, { claimsDone: b.claims_done === true })
              : parts[2] === 'finish' ? finishRun(sup, parts[1], { pass: b.pass === true, why: b.why, answer: b.answer ?? null, yield: b.yield ?? null })
              : parts[2] === 'stop' ? setStop(sup, sup.workers.get(parts[1]), b.clear === true ? null : { mode: b.mode, by: b.by, said: b.said })   // P4: stop, hold, clear
              : parts[2] === 'mode' ? setRunMode(sup, parts[1], String(b.mode || ''), { by: b.by || 'owner' })   // W1.6: the card's WORK | BREAK switch
              : null
      if (!r) return send(res, 404, { ok: false, why: 'no such door' })
      if (r.fault) log('refused', parts[1], r.fault, r.why)
      return send(res, r.ok ? 200 : r.why === 'no such run' ? 404 : 422, r)
    }
    if (url.pathname === '/intents' && req.method === 'POST') {           // §6.2: one signed (msg (kind intent) …) names its run in the body
      const b = await body(req, EVENT_BYTES, res)
      if (req.msgKind && req.msgKind !== 'intent') return send(res, 422, { ok: false, why: `kind ${req.msgKind} is not intent` })
      const r = intent(sup, String(b.run || ''), { tool: b.tool, args: b.args, promise: b.promise, deadline: b.deadline, deadline_s: b.deadline_s, idem: b.idem, id: b.id })
      return send(res, r.ok ? 200 : r.why === 'no such run' ? 404 : 422, r.ok ? { ok: true, accepted: { intent: r.intent, ticket: r.ticket, promise: r.promise }, ...r } : r)
    }
    if (url.pathname === '/grants' && req.method === 'POST') {            // a grant row, owner-signed: the hands verify and keep it (they hold the key's road)
      const b = await body(req, undefined, res)
      const r = await grantToHands(b, 'grant'); return send(res, r.ok ? 200 : 422, r)
    }
    if (parts[0] === 'grants' && parts[1] && req.method === 'DELETE') { const r = await grantToHands({ id: parts[1] }, 'revoke'); return send(res, r.ok ? 200 : 422, r) }
    if (url.pathname === '/press-check' && req.method === 'POST') {
      if ((req.headers['content-type'] || '').startsWith('application/slat')) {   // the hands ask with a signed (msg …) and get one back
        let text = ''; for await (const c of req) { text += c; if (text.length > 64_000) throw new Error('too large') }
        const got = sup.gate.open({ slat: text, sig: req.headers['x-slat-sig'] })
        if (!got.ok) return send(res, 403, { ok: false, why: `dropped (${got.drop}): ${got.why}` })
        const c = pressCheck(sup, got.msg.body?.press || got.msg.body?.ticket)
        const env = seal(TOKEN, { from: 'foreman', to: 'hands', kind: c.pressed ? 'press-ok' : 'press-wait', body: c, at: Date.now() / 1000 })
        res.writeHead(200, { 'Content-Type': 'application/slat', 'X-Slat-Sig': env.sig }); return res.end(env.slat)
      }
      const b = await body(req, undefined, res); return send(res, 200, pressCheck(sup, b.ticket))
    }
    if (url.pathname === '/press' && req.method === 'POST') { const b = await body(req, undefined, res); const r = press(sup, b.ticket, b.by); return send(res, r.ok ? 200 : 404, r) }
    if (parts[0] === 'runs' && parts[1] && (parts[2] === 'results' || parts[2] === 'header') && req.method === 'GET') {
      const w = sup.workers.get(parts[1])
      if (!w || !w.run) return send(res, 404, { ok: false, why: 'no such run' })
      if (parts[2] === 'results' && parts[3]) { const r = resultText(w, parts[3]); return send(res, r.ok ? 200 : 404, r) }
      if (parts[2] === 'results') return send(res, 200, { ok: true, results: resultsOf(w) })
      // the brain's native `tools` array is built from this (B3): the header's hands and acts, nothing else (design §6 change 2b)
      return send(res, 200, { ok: true, key: w.run.key, tier: w.tier, desk: w.run.desk, intensity: w.run.intensity, hands: [...w.run.hands], acts: [...w.run.acts] })
    }
    if (parts[0] === 'contracts' && parts[1] && req.method === 'GET') {
      const w = sup.workers.get(parts[1])
      if (url.searchParams.get('as') === 'data' && w && w.contract) { res.writeHead(200, { 'Content-Type': 'application/slat' }); return res.end(contractData(w.contract)) }
      const text = w && w.contract ? renderContract(w.contract) : CONTRACTS.get(parts[1])
      if (!text) return send(res, 404, { ok: false, why: 'no such run' })
      res.writeHead(200, { 'Content-Type': 'application/slat' }); return res.end(text)
    }
    if (parts[0] === 'workers' && parts[1] && req.method === 'DELETE')
      return send(res, 200, { ok: sup.stop(parts[1], `stopped by ${(url.searchParams.get('by') || 'lacuna').slice(0, 40)}`) })
    if (url.pathname === '/hatch' && req.method === 'POST') {           // ROLEBENCH-2.0 §8, unit 8.7: the owner's terminal REPL on foreman.sock
      const no = hatchRefusal(req)
      if (no) return send(res, 403, { ok: false, why: no })
      const b = await body(req, undefined, res)
      const r = await hatchTurn(sup, b, { kind: req.msgKind, log })
      return send(res, r.ok ? 200 : 422, r)
    }
    if (url.pathname === '/replay' && req.method === 'GET') {
      const file = url.searchParams.get('file')
      if (file) return send(res, 200, { ok: true, ...replaySession(file) })
      const replayDir = path.join(DIR, 'replays')
      let files = []
      try { files = fs.readdirSync(replayDir).filter((f) => f.endsWith('.slat')).sort() } catch { /* none yet */ }
      return send(res, 200, { ok: true, replays: files })
    }
    if (url.pathname === '/replay' && req.method === 'POST') {
      const b = await body(req, undefined, res)
      const slat = typeof b.slat === 'string' && b.slat.trim()
        ? b.slat
        : recordSession({ session: b.session, jobId: b.jobId || 'watchdog-red', seed: b.seed ?? 42, mind: b.mind || 'gemma4:e4b', steps: b.steps })
      const base = replaySession(slat)
      const cand = b.candidate ? replaySession(slat, b.candidate) : null
      const diff = cand ? diffReplays(base, cand) : null
      return send(res, 200, { ok: true, slat, replay: base, ...(cand ? { candidate: cand, diff } : {}) })
    }
    return send(res, 404, { ok: false, why: 'no such door' })
  } catch (e) {
    return send(res, e && e.code === 401 ? 401 : 400, { ok: false, why: String(e.message).slice(0, 300) })
  }
})

// clean up after the dead (B39): a retired or buried worker's record is kept a week for the desk's history, then goes
function prune(days = 7) {
  const cutoff = Date.now() - days * 86400_000
  let gone = 0
  for (const f of fs.readdirSync(WORKERS).filter((x) => x.endsWith('.json'))) {
    const p = path.join(WORKERS, f)
    try {
      const r = JSON.parse(fs.readFileSync(p, 'utf8'))
      if (['retired', 'grave', 'stalled'].includes(r.state) && fs.statSync(p).mtimeMs < cutoff) {
        fs.unlinkSync(p); CKPT.drop(r.id); sup.workers.delete(r.id); gone++
      }
    } catch { /* a torn file is left for a person */ }
  }
  if (gone) log(`pruned ${gone} finished worker record(s) older than ${days} days`)
}

reload()
prune()
if (!SUB) try { loadOrders(sup, path.join(DIR, 'orders'), { log }) } catch (e) { log('orders did not load:', e.message) }
if (!SUB) try { loadCarts(sup, CARTS_DIR, { indexDir: path.join(DIR, 'carts'), serve: CARTS_SERVE, tables: tables(), log }) } catch (e) { log('carts did not load:', e.message) }
if (!SUB) await reloadPlaybooks()
sup.startSweep()                                   // §45.3: deadlines, heartbeats, the zombie law (every 10 s by default)
setInterval(() => { try { fs.writeFileSync(HEARTBEAT, String(Date.now() / 1000)) } catch { /* the watchdog will say so */ } const k = kickSweep(sup); for (const f of wakeSweep(sup)) log('wake', f.run, f.wake, f.why); for (const e of k.ended) log('run ended', e.run, e.why); const s = wallSweep(sup); if (s.swap) log('brain swap begun →', s.swap, s.why); for (const v of cartSweep(sup, { shadow: inShadow(sup) })) log('cart sentry', v.cart, v.run, v.check, v.action, v.detail) }, sup.alive.sweep * 1000).unref()   // K2 kick rule + K5 memory wall + O11 cart sentry, same clock
setInterval(prune, 6 * 3600_000).unref()
// THE WORK-ORDER DISPATCHER (0.A, T6): once a minute, with the owner's quiet from the door, a coder order swaps the 26B out for
// the 12B, runs, and the 26B comes back when none is left (work-orders.mjs)
const DESK_DIR = process.env.FOREMAN_DESK_DIR || path.join(os.homedir(), 'lacuna-world', 'foreman', 'desk')
async function quietS() {
  try { const r = await fetch(`${LACUNA}/api/desk/quiet`, { signal: AbortSignal.timeout(3000) }); const j = await r.json(); return Number(j.quiet_s) || 0 } catch { return 0 }
}
let lastDispatch = ''
setInterval(async () => {
  // cart orders first: a release becomes the release card through the door's road (the owner presses it)
  if (readOrders(DESK_DIR).some((x) => x.for === 'cart' && x.state === 'queued')) {
    const post = async (route, body) => (await fetch(`${LACUNA}${route}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-lacuna-who': 'lacuna' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20_000) })).json()
    for (const r of await fileCartOrders({ dir: DESK_DIR, post, book: evalBook() })) log('work orders:', r.did, r.order, r.card || r.why || '')
    saveEvalBook()
  }
  if (!readOrders(DESK_DIR).some((x) => x.for === 'coder' && ['queued', 'waiting-brain', 'running', 'parked'].includes(x.state)) && broker(sup).by !== 'work-order') return
  const r = dispatch(sup, { dir: DESK_DIR, quietS: await quietS() })
  const line = `${r.did} ${r.order || ''} ${r.run || ''} ${r.why || ''}`.trim()
  if (line !== lastDispatch) log('work orders:', line)
  lastDispatch = line
}, 60_000).unref()
// the engineer orders (O31): the second E4B slot takes one within seconds, so the desk's "send someone" is seamless
setInterval(() => { if (!readOrders(DESK_DIR).some((x) => x.for === 'engineer' && ['queued', 'waiting-brain', 'running'].includes(x.state))) return; const r = dispatchEngineer(sup, { dir: DESK_DIR }); if (r.did !== 'nothing') log('engineer orders:', r.did, r.order || '', r.run || '', r.why || '') }, 5_000).unref()
setInterval(drain, 30_000)
setInterval(drainCascade, 60_000).unref()
// each living worker's state into its thought ring, when it changed (talk.mjs)
setInterval(() => { for (const w of sup.living()) noteState(w, Date.now() / 1000) }, 300_000).unref()
const ready = () => { log(`foreman ${NAME} on ${SOCK || ''}${SOCK && PORT ? ' and ' : ''}${PORT ? `${HOST}:${PORT}` : ''}${IDLE_S ? ` · idles out after ${IDLE_S}s` : ''}${MAX_LIFE_S ? ` · lives at most ${MAX_LIFE_S}s` : ''}`); if (SUB && process.send) process.send({ t: 'ready' }) }
if (SOCK) { try { fs.unlinkSync(SOCK) } catch { /* none */ } fs.mkdirSync(path.dirname(SOCK), { recursive: true }); server.listen(SOCK, () => { fs.chmodSync(SOCK, 0o600); if (!PORT) ready() }) }
if (PORT) { const s2 = SOCK ? http.createServer(server.listeners('request')[0]) : server; s2.listen(PORT, HOST, ready) }
if (SUB) process.on('disconnect', () => { log('the root went away'); for (const w of sup.living()) sup.stop(w.id, 'the root foreman went away'); server.close(); process.exit(0) })   // close: no stale socket (U3, 2026-10-24)
const born = Date.now()
let idleSince = Date.now(), leaving = false
if (IDLE_S || MAX_LIFE_S) setInterval(() => {
  if (leaving) return
  if (sup.living().length) idleSince = Date.now()
  const idle = IDLE_S && Date.now() - idleSince > IDLE_S * 1000
  const old = MAX_LIFE_S && Date.now() - born > MAX_LIFE_S * 1000
  if (idle || old) {
    leaving = true
    const why = idle ? `no work for ${IDLE_S}s` : `reached its ${MAX_LIFE_S}s life`
    log('leaving:', why)
    for (const w of sup.living()) sup.stop(w.id, `the foreman left (${why})`)
    upstreamRaw('leaving', { why })
    setTimeout(() => process.exit(0), 1500)
  }
}, 5000).unref()
for (const s of ['SIGTERM', 'SIGINT']) process.on(s, () => { log('stopping'); server.close(); process.exit(0) })
