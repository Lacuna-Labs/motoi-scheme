// work-orders.mjs — THE WORK-ORDER DISPATCHER (work order 0.A, the ten T6 and T7; MINDS §4.3). Owns: the queue the
// desk's `work-order` verb writes (one `(work-order …)` record per file under the desk folder), taking a coder order
// when the owner is quiet: the 26B swaps out for the 12B (the broker's swap, one at a time), each coder order becomes
// a run (role coder, its checkout, the coder's reads and the whole-file patch, tests, a commit on lacuna/<run>, a
// standing press: the owner's own order filed it), and when no coder order is left the 26B comes back. Each order's
// record carries its state (queued · waiting-brain · running · done · failed · parked) and its run. Refuses: a swap
// while the owner talked in the last QUIET_S (the door says how long he has been quiet); a second coder run at once
// (one 12B, one leg); a judge or cart order (the 26B answers judge orders at the desk; carts run through their own
// road); a merge (the branch and a letter, never main). THE ENGINEER ORDERS (O31): while the E4B holds the port, its
// second slot takes an engineer order at once (dispatchEngineer). Implements: WORK-ORDER-2026-10-25-NIGHT 0.A, T6,
// T7, O31. Invariants (§18): "the 26B and the 12B are never co-resident" (the broker swaps); "outcome pass is written
// only by the done-check" (the run's done-check is the repository's own suites for its change, or the CI's verdict on
// its commit, and the commit; never a test the mind named: E14 §5 row 18). Faults (§16): none raised; a refused swap
// or run is a record state with its sentence.
import fs from 'node:fs'
import path from 'node:path'
import { broker, beginSwap, DESK_MIND } from './broker.mjs'
import { fileRun } from './intents.mjs'
import { repoOf } from './repos.mjs'
import { gridCells, route } from './router.mjs'
import { readForms } from '../../lacuna-scheme/src/slat-data.js'

/** Seconds of the owner's quiet before a swap for background work. */
export const QUIET_S = 600

/**
 * The run key for an order: `wo:<id>`, or `wo:eval:<id>` when the desk run that filed it was an eval session's (law 8: a test's
 * work never reaches the owner's notices; the wake skips a run whose name says `:eval:`. Wave 1's integration re-run, 2026-11-01:
 * `wo:wo-3678`, filed from `eval:wave1-integration-11`, lost the mark and its end reached the owner's desk as a notice).
 * @param {{id: string, from?: string}} order `from`: the desk run that filed it (`readOrders`; `run` is the dispatched run's id)
 * @return {string}
 */
export const runKeyOf = (order) => (/(^|:)eval:/.test(String(order.from || '')) ? `wo:eval:${order.id}` : `wo:${order.id}`)
/** What a coder run may read and do. */
export const CODER = Object.freeze({
  hands: ['files', 'read', 'outline', 'git-status', 'git-log', 'tail-log', 'recall', 'contract', 'design', 'web-search', 'read-page', 'code-where',   // every agent gets the internet, one try a site (O30)
    'overview', 'health', 'watchdogs', 'alerts', 'errors', 'disk', 'services', 'service-log', 'carts', 'cart-run', 'jobs', 'builds', 'release'],   // the box's reads, so an order can check what it fixes (2026-10-27: the ten jobs)
  acts: ['checkout', 'patch', 'test-run', 'git-commit', 'branch-and-mail'],
})
/**
 * A coder run's done-check (E14 §5 row 18; minds-15): the last test-run is the repository's own suites for the change
 * (`scope` "suite": lacuna-executor acts/suite.mjs), green by node's own status (`exit` 0 only says the tests ran), and
 * the commit landed. A test-run the mind pointed at (`scope` named, package or folder) is a step's check, never the
 * run's.
 */
export const DONE = "(and test-run git-commit (= (get test-run 'exit) 0) (eqv? (get test-run 'status) 0) "
  + "(equal? (get (get test-run 'rows) 'scope) \"suite\") (= (get git-commit 'exit) 0))"

/**
 * Reads the queue.
 * @param {string} dir the desk folder (…/foreman/desk)
 * @returns {Array<{id: string, file: string, for: string, goal: string, state: string, run: ?string, repo: ?string, repoWhy: ?string}>}
 */
export function readOrders(dir, opts = {}) {
  const d = path.join(dir, 'work-orders')
  let names = []
  try { names = fs.readdirSync(d).filter((f) => f.endsWith('.slat')).sort() } catch { return [] }
  const cells = Array.isArray(opts.cells) ? opts.cells : opts.gridFile ? gridCells(opts.gridFile) : []
  const roleMap = {
    coder: { role: 'engineer', function: 'patch' },
    engineer: { role: 'engineer', function: 'triage' },
    judge: { role: 'judge', function: 'grade' },
  }
  return names.map((n) => {
    const t = fs.readFileSync(path.join(d, n), 'utf8')
    const f = (k) => new RegExp(`\\(${k} "((?:[^"\\\\]|\\\\.)*)"\\)`).exec(t)?.[1]?.replace(/\\"/g, '"') ?? null
    const goal = f('goal') || '', r = repoOf(f('repo'), goal)   // W1.2: an order's repository is told, never defaulted
    const who = f('for')
    const sm = /\(suggested ([a-z0-9-]+) "((?:[^"\\]|\\.)*)"\)/.exec(t)
    const routed = !sm && cells.length && roleMap[who]
      ? route({ ...roleMap[who], step: { budget: { in: 1024, out: 256 } } }, { cells })
      : null
    const sugMind = sm
      ? sm[1]
      : routed?.authority === 'record' && routed.mind
        ? routed.mind
        : (who === 'coder' ? '12b' : who === 'engineer' ? 'e4b' : who === 'judge' ? '26b' : 'cart')
    const sugWhy = sm
      ? sm[2].replace(/\\"/g, '"')
      : routed?.authority === 'record' && routed.mind
        ? routed.why
        : (sugMind === '12b' ? 'the code base' : sugMind === 'e4b' ? 'the engineer on duty' : sugMind === '26b' ? 'the planner' : 'a cart')
    const suggestedLabel = sugMind === 'cart' ? 'suggested: a cart' : `suggested: the ${sugMind.toUpperCase()}`
    return { id: f('id'), file: path.join(d, n), for: who, goal, state: f('state') || 'queued', run: f('run-id'), repo: r.repo, repoWhy: r.why, from: f('run') || '', result: f('result') || null,
      suggested: { mind: sugMind, why: sugWhy }, suggestedLabel, takenBy: f('taken-by') || null }
  }).filter((o) => o.id)
}

/**
 * Any mind can take any ticket when the owner asks (CL-GEMMAS A.4): records `(taken-by "<mind>")` and returns the ticket.
 * @param {string} dir the desk folder
 * @param {string} id the ticket id (`wo-0001`)
 * @param {string} mind the mind taking it (`e4b`, `12b`, `26b`, `31b`, `e2b`, `lacuna`)
 * @returns {{ok: boolean, id?: string, takenBy?: string, suggested?: string, goal?: string, why?: string}}
 */
export function takeTicket(dir, id, mind) {
  const o = readOrders(dir).find((x) => x.id === id)
  if (!o) return { ok: false, why: `no ticket named ${id}` }
  const m = String(mind || '').trim().toLowerCase()
  if (!m) return { ok: false, why: 'name the mind taking the ticket' }
  let t = fs.readFileSync(o.file, 'utf8').trim().replace(/\)$/, '')
  t = t.replace(/ \(taken-by "[^"]*"\)/, '')
  t += ` (taken-by ${JSON.stringify(m)})`
  fs.writeFileSync(o.file, `${t})\n`)
  return { ok: true, id: o.id, takenBy: m, suggested: o.suggestedLabel, goal: o.goal }
}

/**
 * Sets an order's state (and its run, its result), rewriting its one record in place.
 * @param {{file: string}} o
 * @param {string} state
 * @param {{run?: string, result?: string}} [extra]
 */
export function setState(o, state, extra = {}) {
  let t = fs.readFileSync(o.file, 'utf8').trim().replace(/\)$/, '')
  t = t.replace(/ \(state "[^"]*"\)/, '').replace(/ \(run-id "[^"]*"\)/, '').replace(/ \(result "(?:[^"\\]|\\.)*"\)/, '')
  t += ` (state ${JSON.stringify(state)})` + (extra.run ? ` (run-id ${JSON.stringify(extra.run)})` : (o.run ? ` (run-id ${JSON.stringify(o.run)})` : '')) +
    (extra.result ? ` (result ${JSON.stringify(String(extra.result).slice(0, 300))})` : '')
  fs.writeFileSync(o.file, `${t})\n`)
}

/**
 * One pass of the dispatcher: settle finished runs, then take the next coder order, swapping the brain when needed.
 * @param {object} sup the supervisor
 * @param {{dir: string, quietS: number, now?: number}} o
 * @returns {{did: string, order?: string, run?: string, why?: string}}
 */
export function dispatch(sup, o) {
  const b = broker(sup)
  const orders = readOrders(o.dir).filter((x) => x.for === 'coder')
  for (const x of orders.filter((y) => y.state === 'running' && y.run)) {     // a run that ended settles its order
    const w = sup.workers.get(x.run)
    if (w && w.state === 'running') continue
    const outcome = w?.contract?.outcome || w?.contract?.state || 'ended'
    setState(x, outcome === 'pass' || outcome === 'done' ? 'done' : 'failed', { result: `run ${x.run}: ${outcome}` })
  }
  const live = readOrders(o.dir).filter((x) => x.for === 'coder')
  if (live.some((x) => x.state === 'running')) return { did: 'nothing', why: 'a coder run is in flight (one 12B, one leg)' }
  for (const x of live.filter((y) => (y.state === 'queued' || y.state === 'waiting-brain' || y.state === 'parked') && !y.repo)) setState(x, 'refused', { result: x.repoWhy })
  const next = live.find((x) => (x.state === 'queued' || x.state === 'waiting-brain' || x.state === 'parked') && x.repo)
  if (b.swapping) return { did: 'nothing', why: `a swap to the ${b.swapping.to} is in flight` }
  if (!next) {
    if (b.brain === '12b' && b.by === 'work-order') { beginSwap(sup, b.before || DESK_MIND, 'no coder order is left', 'work-order'); return { did: 'swap', why: `the coder is done: the ${b.before || DESK_MIND} comes back` } }
    return { did: 'nothing', why: 'no coder order is queued' }
  }
  if (b.brain !== '12b') {
    if ((o.quietS ?? 0) < QUIET_S) return { did: 'nothing', order: next.id, why: `the owner talked ${Math.round(o.quietS ?? 0)} s ago; the swap waits for ${QUIET_S} s of quiet` }
    const before = b.brain
    const r = beginSwap(sup, '12b', `work order ${next.id}`, 'work-order')
    if (!r.swap) return { did: 'nothing', order: next.id, why: r.held }
    b.before = before   // the coder gives the port back to whoever held it (the engineer on duty by default)
    setState(next, 'waiting-brain')
    return { did: 'swap', order: next.id, why: 'the 26B steps out for the coder' }
  }
  const w = fileRun(sup, { key: runKeyOf(next), goal: coderGoal(next), expect: next.expect, by: 'work-order', tier: 'act', hands: CODER.hands, acts: CODER.acts,
    press: 'standing', repo: next.repo, touches: ['**'], doneCheck: DONE, brain: '12b', role: 'coder',
    class: { role: 'swe', function: 'systems-code', level: 'L4', mind: '12b', size: { lines: null, tokens: 1500 } } })
  if (!w || !w.id) return { did: 'nothing', order: next.id, why: 'the run was not filed' }
  setState(next, 'running', { run: w.id })
  return { did: 'run', order: next.id, run: w.id }
}

/**
 * One pass for the engineer orders (O31, OFFICE-PROTOCOL §1c): while the E4B holds the brain's port, its second slot takes the
 * next engineer order at once as a run (the coder's reads and acts, its checkout, tests, a commit on lacuna/<run>), so the desk
 * keeps talking on the first slot. One engineer run at a time (two slots: the desk's and this one). When the port holds
 * another mind, the order waits and says why; it never swaps the brain (a wake is the owner's).
 * @param {object} sup the supervisor
 * @param {{dir: string}} o
 * @returns {{did: string, order?: string, run?: string, why?: string}}
 */
export function dispatchEngineer(sup, o) {
  const b = broker(sup)
  for (const x of readOrders(o.dir).filter((y) => y.for === 'engineer' && y.state === 'running' && y.run)) {
    const w = sup.workers.get(x.run)
    if (w && w.state === 'running') continue
    const outcome = w?.contract?.outcome || w?.contract?.state || 'ended'
    setState(x, outcome === 'pass' || outcome === 'done' ? 'done' : 'failed', { result: `run ${x.run}: ${outcome}` })
  }
  const live = readOrders(o.dir).filter((x) => x.for === 'engineer')
  if (live.some((x) => x.state === 'running')) return { did: 'nothing', why: 'an engineer run is in flight (the second slot is busy)' }
  for (const x of live.filter((y) => (y.state === 'queued' || y.state === 'waiting-brain') && !y.repo)) setState(x, 'refused', { result: x.repoWhy })
  const next = live.find((x) => (x.state === 'queued' || x.state === 'waiting-brain') && x.repo)
  if (!next) return { did: 'nothing', why: 'no engineer order is queued' }
  if (b.swapping || b.brain !== 'e4b') {
    if (next.state !== 'waiting-brain') setState(next, 'waiting-brain', { result: `the brain's port holds the ${b.swapping ? `swap to the ${b.swapping.to}` : b.brain}; the order runs when the engineer on duty is back` })
    return { did: 'nothing', order: next.id, why: `the port holds the ${b.brain}` }
  }
  const w = fileRun(sup, { key: runKeyOf(next), goal: coderGoal(next), expect: next.expect, by: 'work-order', tier: 'act', hands: CODER.hands, acts: CODER.acts,
    press: 'standing', repo: next.repo, touches: ['**'], doneCheck: DONE, brain: 'e4b', role: 'engineer',
    class: { role: 'swe', function: 'systems-code', level: 'L4', mind: 'e4b', size: { lines: null, tokens: 1500 } } })
  if (!w || !w.id) return { did: 'nothing', order: next.id, why: 'the run was not filed' }
  setState(next, 'running', { run: w.id })
  return { did: 'run', order: next.id, run: w.id }
}

/**
 * The coder run's goal: the order's words and how the leg ends.
 * @param {{id: string, goal: string, repo: string}} x
 * @returns {string}
 */
export function coderGoal(x) {
  return `Work order ${x.id}: ${x.goal}\nYour checkout of ${x.repo} is <dir> on branch lacuna/<run>. Write whole files with patch (edits [{file, write}]), ` +
    `with tests beside the code; run them with test-run as you go (package: the folder; or files: the test files, ` +
    `checkout-relative, when the folder has no package.json): those are your step's checks. ` +
    `The run's done is the repository's own suites for what you changed: test-run with suite: true, last, after your ` +
    `last change (the room picks the suites; a test you name never decides it). ` +
    `When it is green, git-commit with a one-line message, then branch-and-mail. ` +
    `Never merge. If the order is unclear, take the plainest reading and say which in the commit message. ` +
    // THE WAY OF WORKING (2026-10-27: the E4B, asked for a test, overwrote the module it was to test with a placeholder): read before you
    // write; change only what the order names; a new file is new; the playbook first, your own way when none fits (the owner: "let them
    // check the playbook… let them deviate and try if they can't get it right")
    `How to work: 1) recall the playbook for this kind of work (recall with the order's words) and follow it if one fits; if none fits, ` +
    `work it out yourself and say so in the commit message. 2) read every file you will change, whole, with read, before you patch it. ` +
    `3) change only the files the order names or must change; never rewrite a file you were not asked to change; a new test is a new ` +
    `file, beside the others. 4) run the tests; if they fail, read the failure, fix, and run again (three tries at most), then commit.`
}

/**
 * The owner asked for a mind at the desk (the `seat` verb): the 26B back while the coder holds the brain (its run parks, its
 * order goes back to the queue), or the coder now. The swap is the owner's, so the dispatcher never undoes it by itself.
 * @param {object} sup
 * @param {{mind: string}} rows the seat record's fields
 * @param {{dir: string}} o
 * @returns {{did: string, why: string}}
 */
export function seatChange(sup, rows, o) {
  const b = broker(sup)
  const mind = String(rows?.mind || '')
  if (mind === '26b' && b.brain === '12b') {
    for (const x of readOrders(o.dir).filter((y) => y.for === 'coder' && y.state === 'running')) {
      const w = x.run && sup.workers.get(x.run)
      if (w && w.state === 'running') sup.stop(w.id, 'parked: the owner asked for the 26B at the desk')
      setState(x, 'parked', { result: 'parked for the 26B; resumes when the coder is back' })
    }
    const r = beginSwap(sup, '26b', 'the owner asked for the 26B', 'owner')
    return r.swap ? { did: 'swap', why: 'the 26B is coming back' } : { did: 'nothing', why: r.held }
  }
  if (mind === '12b' && b.brain !== '12b') {
    const r = beginSwap(sup, '12b', 'the owner asked for the coder', 'owner')
    return r.swap ? { did: 'swap', why: 'the coder is coming to the desk' } : { did: 'nothing', why: r.held }
  }
  if ((mind === 'e4b' || mind === '31b' || (mind === '26b' && b.brain !== '12b')) && b.brain !== mind) {   // the engineer on duty back, the architect, or the planner called in
    const label = mind === 'e4b' ? 'engineer on duty' : mind === '31b' ? 'architect' : 'planner'
    const r = beginSwap(sup, mind, `the owner asked for the ${label}`, 'owner')
    return r.swap ? { did: 'swap', why: `the ${label} is coming to the desk` } : { did: 'nothing', why: r.held }
  }
  return { did: 'nothing', why: `the ${mind} already holds the seat or needs no swap` }
}

// ── THE EVAL SESSION'S LIFE (order 2026-11-06 §1.2b; P-2026-11-06-soak-orphan-two-weeks): a soak loop whose script was deleted
// filed a `desk:eval:soak:<t>` run every 5 min for two weeks. An eval session that files without a pause of EVAL_GAP_S for
// EVAL_LIFE_S is a loop no one watches: its runs and orders are refused, in one sentence, until it pauses an hour.
/** Seconds an eval session may file without a pause before it is refused. */
export const EVAL_LIFE_S = 24 * 3600
/** A pause this long ends an eval session's episode; its next filing starts a new one. */
export const EVAL_GAP_S = 3600

/** The eval session of a desk run's key (`desk:eval:soak:1730000000` → `eval:soak`), or null for any other key. */
export const evalSessionOf = (key) => /^desk:(eval:.+):[^:]+$/.exec(String(key || ''))?.[1] ?? null

/**
 * The gate on one filing from an eval session; it records the filing in the book (refused ones too, so a loop stays refused).
 * @param {Map<string, {first: number, last: number}>} book session → its episode, in seconds
 * @param {string} key the desk run's key (or an order's `from`)
 * @param {number} now seconds
 * @returns {{ok: boolean, session: ?string, why?: string}}
 */
export function evalGate(book, key, now) {
  const session = evalSessionOf(key)
  if (!session) return { ok: true, session: null }
  const e = book.get(session)
  if (!e || now - e.last > EVAL_GAP_S) { book.set(session, { first: now, last: now }); return { ok: true, session } }
  e.last = now
  const h = (now - e.first) / 3600
  if (now - e.first <= EVAL_LIFE_S) return { ok: true, session }
  return { ok: false, session, why: `refused: the eval session ${session} has filed without a pause for ${h.toFixed(1)} h, over ${EVAL_LIFE_S / 3600} h; no live session owns it (a loop no one watches). It files again after ${EVAL_GAP_S / 60} min of quiet` }
}

/** The book as slat, one `(eval-session …)` form a line, for the foreman's folder. */
export const evalBookText = (book) => [...book].map(([s, e]) => `(eval-session (name ${JSON.stringify(s)}) (first ${e.first}) (last ${e.last}))\n`).join('')

/** The book from its slat text; an unreadable form is skipped. */
export function readEvalBook(text) {
  const book = new Map()
  const sym = (x) => (x && typeof x === 'object' && 'name' in x ? x.name : x)
  let forms = []
  try { forms = readForms(String(text || '')) } catch { return book }   // a torn file starts a fresh book; the next filing writes it whole
  for (const f of forms) {
    if (!Array.isArray(f) || sym(f[0]) !== 'eval-session') continue
    const kv = Object.fromEntries(f.slice(1).filter(Array.isArray).map((p) => [sym(p[0]), p[1]]))
    if (typeof kv.name === 'string' && Number.isFinite(Number(kv.first)) && Number.isFinite(Number(kv.last))) book.set(kv.name, { first: Number(kv.first), last: Number(kv.last) })
  }
  return book
}

/** A cart order that names a release goes to the release card's road; today it is the one cart a work order may file. */
const RELEASE = /\b(release|ship|promote|deploy)\b/i

/**
 * Files the cart orders (the ten T4): a release order becomes the release card through the door's own road (`POST
 * /api/release/cart {mode: push}`), a petition that waits for the owner's press before anything runs; the card's id is
 * written into the order. Any other cart order is refused in one sentence (no other cart is started from a work order yet).
 * An order from an eval session past its life (evalGate, with `o.book`) is refused before anything is filed.
 * @param {{dir: string, post: function(string, object): Promise<object>, book?: Map, now?: number}} o
 * @returns {Promise<Array<{order: string, did: string, why?: string, card?: string}>>}
 */
export async function fileCartOrders(o) {
  const out = []
  for (const x of readOrders(o.dir).filter((y) => y.for === 'cart' && y.state === 'queued')) {
    if (!RELEASE.test(x.goal)) { setState(x, 'refused', { result: 'only the release cart is filed from a work order today' }); out.push({ order: x.id, did: 'refused' }); continue }
    let r = null
    // an order filed from an eval session files a DRY release, never a real card (2026-10-25: the ten's T4 put a real release card on
    // the owner's desk from a test; it waits for his decline)
    const dry = /^desk:eval:/.test(x.from)
    const gate = dry && o.book ? evalGate(o.book, x.from, o.now ?? Date.now() / 1000) : { ok: true }
    if (!gate.ok) { setState(x, 'refused', { result: gate.why }); out.push({ order: x.id, did: 'refused', why: gate.why }); continue }
    try { r = await o.post('/api/release/cart', { dry, mode: 'push' }) } catch (e) { r = { ok: false, why: String(e.message || e).slice(0, 200) } }
    const card = r && (r.petition || r.card || r.id)
    if (r && r.ok !== false && card) { setState(x, 'waiting-owner', { result: `${dry ? 'dry ' : ''}card ${card}: POST /api/desk/press/${card}` }); out.push({ order: x.id, did: 'card', card, dry }) }
    else { setState(x, 'failed', { result: `the release card was not filed: ${r?.why || 'no answer'}` }); out.push({ order: x.id, did: 'failed', why: r?.why }) }
  }
  return out
}
