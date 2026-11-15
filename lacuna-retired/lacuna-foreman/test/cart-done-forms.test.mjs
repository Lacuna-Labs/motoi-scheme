// cart-done-forms.test.mjs — THE SIX ENDING CARTS' DONE-CHECK FORMS (finale 2026-11-06; law 6; lint `prose-done`).
// Owns: the proofs that backup, cart-lint, ci-cd, cleanup, sakura-repair-batch and self-health each carry a done-check
// FORM the foreman evaluates over the executor's answers and the cart's report rows (intents.mjs doneCheck), true on a
// fixture record and false on a broken one; that the foreman keeps each hand's and act's answer on the cart (alive.mjs
// keepReply), so a real run closes `pass` or `fail` by its form; and that self-health's gates are its `laws` table's.
// Refuses: a mock of the evaluator; the live world; a form that reads the said sentence. Implements: the lead's ruling
// of 2026-11-06 (every ending cart gets a real done-check form). Invariants (§18): "if a run is pass, the foreman's
// done-check said so". Faults (§16): B-19 (a prose done-check read as checked).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { readCart } from '../cart.mjs'
import { doneCheck } from '../intents.mjs'
import { parse } from '../scheme.mjs'
import { Supervisor } from '../supervisor.mjs'

const BOX = JSON.parse(readFileSync(new URL('./fixtures/box-minds.json', import.meta.url), 'utf8'))
const program = (name) => readFileSync(new URL(`../carts/${name}.sks`, import.meta.url), 'utf8')
const formOf = (name) => readCart(program(name), { box: BOX }).contract.done_check
// local noon, so the date `today` reads is the same in every time zone the suite runs in
const NOON = new Date(2026, 9, 23, 12, 0, 0).getTime() / 1000
const ENDING = ['backup', 'cart-lint', 'ci-cd', 'cleanup', 'sakura-repair-batch', 'self-health']

/**
 * A cart's record as the foreman keeps it: `answers` [op, value, args?] (the last per op is what the form reads; each
 * one counts in the tally, as alive.mjs keepReply counts), `reports` [kind, ...data], and `steps` rows.
 */
function record(name, { answers = [], reports = [], steps = [] } = {}) {
  const replies = {}, tally = {}
  for (const [op, value, args = []] of answers) {
    replies[op] = { value, args }
    const n = (tally[op] ||= { ok: 0, failed: 0, dry: 0 })
    if (value.dry) n.dry++
    else if (value.ok === true) n.ok++
    else n.failed++
  }
  return { name, cart: { name, steps, replies, tally }, reports: reports.map(([kind, ...data]) => ({ kind, data })),
           contract: { done_check: formOf(name) } }
}
const judge = (name, rec) => doneCheck(record(name, rec), 'whatever the cart said', NOON)
const holds = (name, rec, why) => {
  const c = judge(name, rec)
  assert.deepEqual([c.checked, c.pass], [true, true], `${name} ${why}: ${c.why}`)
}
const fails = (name, rec, why) => {
  const c = judge(name, rec)
  assert.deepEqual([c.checked, c.pass], [true, false], `${name} ${why}: ${c.why}`)
}

// spec: the lead's ruling 2026-11-06 (1) · law 6 · lint.mjs prose-done
// class: L5 the header's shape · E the contract's outcome
// technique: a sweep over the six ending carts
// method: readCart each; the done-check is one form; the done sentence and the goal stay words
// sre: can any of the six still end a run on a sentence nobody checked?
test('the six ending carts each carry a done-check form; the prose stays as the goal and the done sentence', () => {
  for (const name of ENDING) {
    const h = readCart(program(name), { box: BOX })
    assert.match(h.contract.done_check.trim(), /^\(/, `${name}'s done-check is a form`)
    assert.equal(parse(h.contract.done_check).length, 1, `${name}'s done-check is one form`)
    assert.ok(h.contract.goal && !/^\s*\(/.test(h.contract.goal), `${name} keeps its goal in words`)
    assert.ok(typeof h.done === 'string' && !/^\s*\(/.test(h.done), `${name} keeps its done sentence in words`)
    const bare = { cart: { steps: [] }, reports: [], contract: { done_check: h.contract.done_check } }
    const said = doneCheck(bare, h.done, NOON)
    assert.deepEqual([said.checked, said.pass], [true, false], `${name}: its done sentence and no record pass nothing`)
  }
})

const bundle = (stamp) => `lacuna-world-${stamp}.bundle`
const listed = (...names) => ['bundles',
  { ok: true, op: 'bundles', result: { bundles: names.map((name) => ({ name })) } }]
const drill = (name, result, ok = true) => ['bundle-verify', { ok, op: 'bundle-verify', result }, [name]]

// spec: backup.sks contract · design §21 O-58 (the restore drill) · lacuna-executor/reads/world.mjs (heads: a list)
// class: E the outcome · W5 a malformed answer
// technique: fixture records: the executor's answers as lacuna-executor gives them
// method: today's newest bundle verified with heads → true; not verified, yesterday's, another bundle drilled, no
//   heads, no drill → false
// sre: does a backup pass only when today's bundle reopened?
test('backup: true when the newest bundle is today\'s and the drill verified it with heads; false otherwise', () => {
  const ok = { verified: true, heads: ['refs/heads/main'], why: null }
  const today = bundle('20261023-1100'), early = bundle('20261023-0700'), yesterday = bundle('20261022-1900')
  holds('backup', { answers: [listed(yesterday, today), drill(today, ok)] }, 'good')
  holds('backup', { answers: [listed(today), drill(today, { verified: true, heads: 2 })] }, 'a count of heads')
  fails('backup', { answers: [listed(today), drill(today, { verified: false, heads: [], why: 'x' })] }, 'not verified')
  fails('backup', { answers: [listed(yesterday), drill(yesterday, ok)] }, "yesterday's newest")
  fails('backup', { answers: [listed(early, today), drill(early, ok)] }, 'an older bundle drilled')
  fails('backup', { answers: [listed(today), drill(today, { verified: true, heads: [] })] }, 'no heads')
  fails('backup', { answers: [listed(today)] }, 'no drill')
})

// spec: cart-lint.sks contract (its own lint reads 0 faults) · lint.mjs
// class: E the outcome
// technique: fixture records of the `cart-lint` read
// method: findings () → true; one finding, a refused read, no read → false
// sre: does a lint pass while the tree still holds a fault?
test('cart-lint: true when its lint read answers no findings; false on a finding, a refused read or none', () => {
  const read = (findings, ok = true) => ['cart-lint', { ok, op: 'cart-lint', result: { carts: 15, findings } }]
  holds('cart-lint', { answers: [read([])] }, 'clean')
  fails('cart-lint', { answers: [read([{ cart: 'doors', kind: 'prose-done', says: 'words' }])] }, 'one fault')
  fails('cart-lint', { answers: [read([], false)] }, 'refused')
  fails('cart-lint', {}, 'no read')
})

// spec: ci-cd.sks contract (the release board's row for the tip)
// class: E the outcome
// technique: fixture records of the `release-board` read
// method: dev = QA = the iPad (a short and a long sha) → true; the iPad behind, QA behind, no sha → false
// sre: does a release pass while her iPad runs another build?
test('ci-cd: true when the last release board says QA and her iPad run dev\'s head; false when one is behind', () => {
  const board = (dev, qa, ipad) => ['release-board', { ok: true, op: 'release-board',
    result: { dev: { sha: dev }, qa: { sha: qa }, ipad: { sha: ipad, kept: 3 }, pending: [] } }]
  holds('ci-cd', { answers: [board('a1b2c3d', 'a1b2c3d', 'a1b2c3d4e5f60718')] }, 'released')
  fails('ci-cd', { answers: [board('a1b2c3d', 'a1b2c3d', '9f8e7d6')] }, 'the iPad behind')
  fails('ci-cd', { answers: [board('a1b2c3d', '0000000', 'a1b2c3d')] }, 'QA behind')
  fails('ci-cd', { answers: [board('', '', '')] }, 'no sha')
})

// spec: cleanup.sks contract (the items removed match the plan) · design §21 O-47 (never under a live forge run)
// class: E the outcome · L3 an act outside the plan
// technique: fixture records: the forge-runs and disk reads, the trash acts' tally, the `trashed` report rows
// method: two trashed of the plan, none trashed, the hold → true; a path off the plan, under a live run, a count that
//   differs, no disk read → false
// sre: does a cleanup pass after it removed something nobody planned?
test('cleanup: true when the trash acts answered ok match the planned paths it trashed, or it held', () => {
  const forge = (o) => ['forge-runs', { ok: true, op: 'forge-runs',
    result: { live: ['/w/forge/runs/r1'], eval_near: false, ...o } }]
  const culprits = [{ path: '/w/cache', gb: 12 }, { path: '/w/forge/runs/r1/ckpt', gb: 30 },
    { path: '/w/small', gb: 2 }]
  const disk = ['disk', { ok: true, op: 'disk',
    result: { disk: { free_pct: 8 }, files: ['/w/a.log', { path: '/w/b.tmp' }], culprits } }]
  const trash = (n) => Array.from({ length: n }, () => ['trash', { ok: true, op: 'trash' }])
  const said = (...paths) => paths.map((p) => ['trashed', p])
  holds('cleanup', { answers: [forge(), disk, ...trash(2)], reports: said('/w/a.log', '/w/cache') }, 'two yeses')
  holds('cleanup', { answers: [forge(), disk] }, 'all kept')
  holds('cleanup', { answers: [forge({ eval_near: true })] }, 'the hold')
  const one = [forge(), disk, ...trash(1)]
  fails('cleanup', { answers: one, reports: said('/w/small') }, 'under 5 GB, off the plan')
  fails('cleanup', { answers: one, reports: said('/w/forge/runs/r1/ckpt') }, 'under a live run')
  fails('cleanup', { answers: [forge(), disk, ...trash(3)], reports: said('/w/a.log') }, 'three removed, one said')
  fails('cleanup', { answers: [forge()] }, 'no disk read and no hold')
})

const tile = (o) => ['batch', '100 tackled · 61 right · 50 first try', Object.entries({ frozen: 100, tackled: 100,
  right: 61, 'first-try': 50, ended: 139, stalls: 2, open: 0, queued: 0, ...o })]
const followed = (exit) => ({ name: 'hand contract', status: 'done', why: 'asked Lacuna to read contract "w-1"',
  ticket: 't9', ...(exit == null ? {} : { receipt: { exit, at: 1 } }) })

// spec: sakura-repair-batch.sks contract (the batch's task-receipts all ok) · design §12.6
// class: E the outcome · F-06 a stalled batch
// technique: fixture records: the batch report row, the contract reads' tally, the steps with their tasks
// method: all tackled, none open or queued, every read answered ok with a task-receipt → true; open runs, a failed
//   read, an unanswered task, right over ended, no batch row → false
// sre: does the batch pass while runs are still open or a read went unanswered?
test('sakura-repair-batch: true when every slug was tackled and ended and every task-receipt is ok', () => {
  const reads = (failed = 0) => [
    ...Array.from({ length: 3 }, () => ['contract', { ok: true, op: 'contract', rows: { exit: 0 } }]),
    ...Array.from({ length: failed }, () => ['contract', { ok: false, op: 'contract', why: 'no such run' }])]
  const ok = [followed(0)]
  holds('sakura-repair-batch', { answers: reads(), reports: [tile({ open: 3, ended: 1 }), tile()], steps: ok }, 'ok')
  fails('sakura-repair-batch', { answers: reads(), reports: [tile({ open: 2, queued: 9, tackled: 93 })], steps: ok },
        'three stalls stopped it')
  fails('sakura-repair-batch', { answers: reads(1), reports: [tile()], steps: ok }, 'a contract read failed')
  fails('sakura-repair-batch', { answers: reads(), reports: [tile()], steps: [followed(null)] },
        'a task with no task-receipt')
  fails('sakura-repair-batch', { answers: reads(), reports: [tile({ right: 140 })], steps: ok }, 'right over ended')
  fails('sakura-repair-batch', { answers: reads() }, 'no batch row')
})

// spec: self-health.sks contract (the watchdog read all green, or the reds named) · ch. 5 §5.12
// class: E the outcome
// technique: fixture records: the health-facts read, the ticket and ticket-count report rows
// method: all green → true; two reds, one filed and one counted → true; a red named by nobody, the wrong law named,
//   a refused read → false
// sre: does a health pass go green while a law is sick and unticketed?
test('self-health: true when the health read is all green or each red has a ticket or a count raised', () => {
  const facts = (f) => ['health-facts', { ok: true, op: 'health-facts', result: { open: [], facts: { 'free-gb': 80,
    bundles: 5, 'pytest-red': 0, services: [{ port: 5050, up: true }, { port: 5051, up: true }], ...f } } }]
  const ticket = (key) => ['ticket', [['kind', 'box'], ['key', `self-health:${key}`], ['measured', 12]]]
  const counted = (key) => ['ticket-count', [['key', `self-health:${key}`], ['count', 2], ['value', 0]]]
  const sick = { 'free-gb': 12, services: [{ port: 5050, up: true }, { port: 5051, up: false }] }
  holds('self-health', { answers: [facts({})] }, 'all green')
  holds('self-health', { answers: [facts(sick)], reports: [ticket('free-gb'), counted('service-5051')] }, 'reds named')
  fails('self-health', { answers: [facts(sick)], reports: [ticket('free-gb')] }, 'a port down, unnamed')
  fails('self-health', { answers: [facts({ 'pytest-red': 3 })], reports: [ticket('free-gb')] }, 'the wrong law named')
  const refused = ['health-facts', { ok: false, op: 'health-facts', why: 'no such read' }]
  fails('self-health', { answers: [refused] }, 'refused')
})

/** The first list in `x` (a parsed form) whose head is the symbol `head`. */
function find(x, head) {
  if (!Array.isArray(x)) return null
  if (x[0]?.name === head) return x
  for (const y of x) { const r = find(y, head); if (r) return r }
  return null
}

// spec: self-health.sks (one gate table in two places)
// class: L5 drift between a cart's body and its form
// technique: both parsed by the engine's reader
// method: the form's `gates` rows equal the `laws` table's (key op threshold) rows, in order
// sre: when a law's gate moves, does the done-check move with it?
test('self-health: the done-check\'s gates are the laws table\'s keys, ops and thresholds, in order', () => {
  const defined = parse(program('self-health')).find((f) => f[0]?.name === 'define' && f[1]?.name === 'laws')
  const laws = find(defined, 'quote')[1]
  const gates = find(find(parse(formOf('self-health')), 'gates'), 'quote')[1]
  const row = (key, op, lim) => `${String(key.name ?? key)} ${op.name} ${lim}`
  assert.deepEqual(gates.map((g) => row(g[0], g[1], g[2])), laws.map((l) => row(l[0], l[2], l[3])))
})

function host(now = NOON) {
  let t = now, n = 0
  const h = { up: [], texts: [], tick: (s) => { t += s }, now: () => t, id: () => `w${++n}`, save: () => {},
    tables: () => ({ tiers: null, box: BOX }), upstream: (kind, w, data) => h.up.push({ kind, data }),
    contract: (w, text) => h.texts.push(text), mail: () => {}, mailCount: () => {}, ledger: () => {} }
  return h
}
const settle = () => new Promise((r) => setTimeout(r, 5))

// spec: alive.mjs keepReply · cart.mjs done (the foreman's done-check at the cart's (done …))
// class: E the contract's outcome on a real run
// technique: a real Supervisor, the committed carts, the executor's answers sent as Lacuna sends them
// method: cart-lint with no findings → pass; with one → fail naming the form on one line; the answer, its args, the
//   tally and the task-receipt on the cart
// sre: does a real cart run end pass or fail by what the executor answered, never by what it said?
test('a real run keeps each hand\'s answer on the cart and its contract closes pass or fail by the form', async () => {
  const run = async (findings) => {
    const s = new Supervisor(host())
    const w = s.spawn({ name: 'cart-lint', program: program('cart-lint') })
    s.send(w.id, 'hand', { ok: true, op: 'cart-lint', result: { carts: 15, findings } })
    await settle()
    return w
  }
  const clean = await run([])
  assert.deepEqual([clean.contract.exit, clean.contract.outcome], [0, 'pass'])
  assert.deepEqual(clean.cart.replies['cart-lint'].args, [])
  assert.deepEqual(clean.cart.tally['cart-lint'], { ok: 1, failed: 0, dry: 0 })
  const step = clean.cart.steps.find((x) => x.name === 'hand cart-lint')
  assert.equal(step.receipt.exit, 0, 'the step that asked holds the task-receipt')
  const dirty = await run([{ cart: 'doors', kind: 'prose-done', says: 'the done-check is words' }])
  assert.deepEqual([dirty.contract.exit, dirty.contract.outcome], [0, 'fail'])
  assert.match(dirty.contract.why, /^done-check: \(and \(has 'cart-lint\) .* answered false/)
  assert.ok(!/\n/.test(dirty.contract.why), 'the form reads as one line in the why')
})

// spec: backup.sks (the drill reads the executor's list of heads) · alive.mjs keepReply (args)
// class: W5 the executor's real answer shape (heads is a list; the old body read it as a number and never verified)
// technique: a real Supervisor; the bundle names stamped with the host's own day
// method: bundle, list, drill with a list of heads, prune → the drill passes, prunes, and the contract closes pass
// sre: does the hourly backup verify a real bundle, and say pass only then?
test('backup on a real run: a list of heads verifies, the old bundles go, the contract closes pass', async () => {
  const d = new Date(NOON * 1000), two = (n) => String(n).padStart(2, '0')
  const day = `${d.getFullYear()}${two(d.getMonth() + 1)}${two(d.getDate())}`
  const names = ['0100', '0300', '0500', '0700', '0900'].map((t) => bundle(`${day}-${t}`))
  const h = host()
  const s = new Supervisor(h)
  const w = s.spawn({ name: 'backup', program: program('backup') })
  s.send(w.id, 'act', { ok: true, op: 'bundle', bundle: names.at(-1) })
  s.send(w.id, 'hand', { ok: true, op: 'bundles', result: { bundles: names.map((name) => ({ name, bytes: 9 })) } })
  s.send(w.id, 'hand', { ok: true, op: 'bundle-verify',
    result: { verified: true, heads: ['refs/heads/main', 'refs/heads/dev'], why: null } })
  const prune = h.up.find((u) => u.kind === 'act' && u.data.op === 'prune')
  assert.ok(prune, 'a verified drill prunes')
  assert.deepEqual(prune.data.args[0], names.slice(0, 2))
  s.send(w.id, 'act', { ok: true, op: 'prune' })
  await settle()
  const drilled = h.up.filter((u) => u.kind === 'report' && u.data.kind === 'step').map((u) => u.data.data[0])
  assert.ok(drilled.some((x) => /verified, 2 head\(s\)/.test(x)), drilled.join(' | '))
  assert.deepEqual([w.contract.exit, w.contract.outcome], [0, 'pass'])
})
