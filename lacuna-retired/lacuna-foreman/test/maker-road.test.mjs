// maker-road.test.mjs — THE MAKERS' ROAD END TO END (lane L3). Owns: the five maker playbooks run by the real runner
// against a real hands daemon on a scratch socket (signed hops, the real reads and acts, the real jail), with a stand-in
// mind (a mock of the brain is allowed): the fixture game made, judged by the done-check and read off the door's shelf;
// a planted fetch made and failed (outcome not pass); Tally made, examined at L2 and bundled; the done-check failing closed
// when the rules do not load (the foreman's jail, ruling L3-R1). Refuses: the live ~/lacuna-world (shelves, runs, mail
// and ledger are temp dirs); a mock of the runner, the check or the hands. Implements: CARDS-2.0 §6.16, §6.21 (the
// done-whens); LACUNA-3.0-DESIGN §6 change 5 (`pass` only from the done-check). Invariants (§18): "a claim is not a
// record" (the check reads the folder through the hands). Faults (§16): none.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadPlaybooks } from '../playbook.mjs'
import { runPlaybook } from '../playbook-run.mjs'
import { makerCheck, makerForm, loadRules } from '../maker-check.mjs'
import { readContract } from '../contract.mjs'
import { Supervisor } from '../supervisor.mjs'
import { startHands } from '../../../lacuna-executor/hands.mjs'
import { makeReads } from '../../../lacuna-executor/reads.mjs'
import { makeActs } from '../../../lacuna-executor/acts.mjs'
import { readShelf } from '../../../lacuna-node/frontend/shelf.mjs'
import { standInAnswer } from '../../../test/arcade/stand-in-maker.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.join(HERE, '..', '..', '..')
const GAME = path.join(REPO, 'test', 'arcade', 'fixture-game')
const PRODUCT = path.join(REPO, 'test', 'factory', 'fixture-product')
const KEY = 'm'.repeat(40)

/** A temp world, a hands daemon over it, a supervisor whose host writes each contract where the hands' writer would. */
async function world(t, mind) {
  const root = fs.realpathSync(fs.mkdtempSync('/private/tmp/lacuna-unit-maker-'))
  const roots = { arcade: path.join(root, 'arcade', 'games'), factory: path.join(root, 'factory', 'products') }
  const runs = path.join(root, 'runs')
  for (const d of [...Object.values(roots), runs, path.join(root, 'mail'), path.join(root, 'ledger')]) fs.mkdirSync(d, { recursive: true })
  const sock = path.join(root, 'h.sock')
  const hands = await startHands({ sock, key: KEY, reads: makeReads({ runsRoot: runs, shelfRoots: roots }),
    acts: makeActs({ runsRoot: runs, make: { roots }, tickets: { mailDir: path.join(root, 'mail') } }) })
  const was = process.env.LACUNA_LEDGER_DIR; process.env.LACUNA_LEDGER_DIR = path.join(root, 'ledger')
  t.after(async () => { await hands.close(); fs.rmSync(root, { recursive: true, force: true }); if (was == null) delete process.env.LACUNA_LEDGER_DIR; else process.env.LACUNA_LEDGER_DIR = was })
  let n = 0
  const asks = []
  const h = { now: () => Date.now() / 1000, id: () => `w-maker-${++n}`, save: () => {}, key: KEY, upstream: () => {}, mail: () => {}, mailCount: () => {}, ledger: () => {},
    deadlines: { hand: 30, act: 60, beat: 5, mind: 20, hop: 50 },
    contract: (w, text) => { fs.mkdirSync(path.join(runs, w.id), { recursive: true }); fs.writeFileSync(path.join(runs, w.id, 'CONTRACT.slat'), text) },
    mind: async (req) => { asks.push(req); return { text: mind(req) } } }
  const s = new Supervisor(h)
  const { playbooks } = await loadPlaybooks(path.join(REPO, 'playbooks'))
  const pb = (id) => playbooks.find((p) => p.id === id)
  const go = (id, bindings) => runPlaybook(s, pb(id), { hands: { sock, key: KEY }, bindings, pressed: true, shadow: false, by: 'eval:maker' })
  return { root, roots, runs, s, go, asks }
}

const makeBindings = (kind, id, model, words = 'a catching game') => ({
  1: [{ kind, id, name: id, words, maker: '26b' }], 2: [{ model }], 3: [{ kind, id, name: id, maker: '26b' }], 4: [{ kind, id }],
  5: [{ to: 'desk', ticket: `${kind}:${id}`, text: `the maker's run for ${id} ended` }] })
const fourBindings = (kind, id, act) => ({ 1: [{ kind, id }], 2: [act], 3: [{ kind, id }], 4: [{ to: 'desk', ticket: `${kind}:${id}`, text: 'done' }] })

// spec: CARDS-2.0 §6.16 done-when (the brief: "a fixture game made by a stand-in mind passes the check and lands on the shelf read")
test('arcade-make: the stand-in mind\'s fixture game is written, passes the done-check and lands on the shelf read as made', async (t) => {
  const w = await world(t, () => standInAnswer(GAME))
  const r = await w.go('arcade-make', makeBindings('arcade', 'catch', 'lacuna-worker-lite'))
  assert.deepEqual([r.exit, r.outcome], [0, 'pass'], r.why)
  assert.match(r.why, /files check passed/)
  assert.deepEqual(r.receipts.map((x) => [x.unit, x.exit]), [['make-brief', 0], ['maker', 0], ['make-write', 0], ['make-files', 0], ['letter', 0]])
  assert.equal(w.asks[0].model, 'lacuna-worker-lite', 'the maker is the model the owner named')
  assert.equal(w.asks[0].last, true)
  assert.match(w.asks[0].prompt, /"noun":"game"/)
  const c = readContract(fs.readFileSync(path.join(w.runs, r.run, 'CONTRACT.slat'), 'utf8'))
  assert.equal(c.outcome, 'pass')
  assert.equal(c.last_result.check.ok, true)
  const shelf = readShelf('arcade', { roots: w.roots, runsRoot: w.runs })
  const game = shelf.games.find((g) => g.id === 'catch')
  assert.equal(game.state, 'made')
  assert.equal(game.run, r.run)
  assert.equal(game.check.ok, true)
  assert.equal(game.maker, '26b')
})

// spec: CARDS-2.0 §6.16 done-when ("a planted fetch fails the check") and the brief ("the run's outcome is not pass")
test('arcade-make: a planted fetch is written, the done-check fails it, the outcome is not pass and the shelf says failed', async (t) => {
  const w = await world(t, () => standInAnswer(GAME, { plant: 'game.js' }))
  const r = await w.go('arcade-make', makeBindings('arcade', 'planted', 'lacuna-worker-lite'))
  assert.equal(r.exit, 0, 'every step ran: the files landed')
  assert.notEqual(r.outcome, 'pass')
  assert.match(r.why, /network \(fetch in game\.js\)/)
  const c = readContract(fs.readFileSync(path.join(w.runs, r.run, 'CONTRACT.slat'), 'utf8'))
  assert.equal(c.outcome, 'fail')
  assert.equal(c.last_result.check.rows.find((x) => x.rule === 'network').ok, false)
  const game = readShelf('arcade', { roots: w.roots, runsRoot: w.runs }).games.find((g) => g.id === 'planted')
  assert.equal(game.state, 'failed')
  assert.equal(game.check.ok, false)
})

// spec: CARDS-2.0 §6.21 done-when; the brief ("Tally sits its exam through the verb and bundles")
test('factory: Tally is made, sits its exam at L2 (5 of 5), bundles after it, and the shelf reads the exam and the parts', async (t) => {
  const w = await world(t, () => standInAnswer(PRODUCT))
  const before = await w.go('factory-bundle', fourBindings('factory', 'tally', { kind: 'factory', id: 'tally' }))
  assert.notEqual(before.outcome, 'pass', 'nothing to bundle before it is made')
  const made = await w.go('factory-make', makeBindings('factory', 'tally', 'lacuna-worker-lite', 'count the error lines of a log'))
  assert.deepEqual([made.exit, made.outcome], [0, 'pass'], made.why)
  assert.match(w.asks[0].prompt, /"noun":"product"/)
  const early = await w.go('factory-bundle', fourBindings('factory', 'tally', { kind: 'factory', id: 'tally' }))
  assert.notEqual(early.outcome, 'pass', 'no bundle without a passed exam')
  assert.match(readContract(fs.readFileSync(path.join(w.runs, early.run, 'CONTRACT.slat'), 'utf8')).last_result.why, /its exam: not sat/)
  const exam = await w.go('factory-exam', fourBindings('factory', 'tally', { id: 'tally' }))
  assert.deepEqual([exam.exit, exam.outcome], [0, 'pass'], exam.why)
  assert.match(exam.why, /exam check passed/)
  const bundle = await w.go('factory-bundle', fourBindings('factory', 'tally', { kind: 'factory', id: 'tally' }))
  assert.deepEqual([bundle.exit, bundle.outcome], [0, 'pass'], bundle.why)
  const p = readShelf('factory', { roots: w.roots, runsRoot: w.runs }).products.find((x) => x.id === 'tally')
  assert.deepEqual([p.exam.level, p.exam.fixtures.length, p.exam.fixtures.every((f) => f.ok)], [2, 5, true])
  assert.equal(p.bundle.parts.code[0].path, 'tally.mjs')
  assert.ok(p.bundled.at > 0)
  assert.equal(p.state, 'made')
})

// spec: the brief's arcade-bundle; the send to the phone stays owed
test('arcade-bundle cuts the record for a game that passes; it is refused for a planted fetch', async (t) => {
  const w = await world(t, (req) => (/planted/.test(req.prompt) ? standInAnswer(GAME, { plant: 'main.js' }) : standInAnswer(GAME)))
  await w.go('arcade-make', makeBindings('arcade', 'catch', 'lacuna-worker-lite'))
  const ok = await w.go('arcade-bundle', fourBindings('arcade', 'catch', { kind: 'arcade', id: 'catch' }))
  assert.deepEqual([ok.exit, ok.outcome], [0, 'pass'], ok.why)
  await w.go('arcade-make', makeBindings('arcade', 'planted', 'lacuna-worker-lite', 'planted'))
  const no = await w.go('arcade-bundle', fourBindings('arcade', 'planted', { kind: 'arcade', id: 'planted' }))
  assert.notEqual(no.outcome, 'pass')
  assert.equal(readShelf('arcade', { roots: w.roots, runsRoot: w.runs }).games.find((g) => g.id === 'planted').bundled, null)
})

// spec: law 4 (foreman.sb never changes) and law 11 (fail closed); ruling L3-R1 · method: the import refused as the jail refuses it
test('the done-check fails closed when the rules do not load, and names the jail; an unknown maker form fails', async () => {
  const receipts = [{ unit: 'make-files', exit: 0, value: { rows: { kind: 'arcade', id: 'x', exists: true, files: [], records: {} } } }]
  const eperm = async () => { throw Object.assign(new Error("EPERM: operation not permitted, open '…/maker.js'"), { code: 'EPERM' }) }
  const r = await makerCheck('files', receipts, eperm)
  assert.equal(r.pass, false)
  assert.match(r.why, /EPERM.*foreman\.sb/)
  assert.equal((await loadRules(eperm)).ok, false)
  assert.equal((await loadRules()).ok, true, 'unjailed, the one rule set loads')
  assert.match((await makerCheck('files', [])).why, /no make-files read/)
  assert.equal((await makerCheck('poem', receipts)).pass, false)
  assert.deepEqual([makerForm('maker: files — x'), makerForm('maker: poem'), makerForm('the draw is exit 0')], ['files', '?', null])
})
