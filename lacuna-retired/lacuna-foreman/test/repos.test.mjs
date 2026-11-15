// repos.test.mjs — U1 unit tests for W1.2, the checkout follows the repository (ROAD-TO-1.0 Category 2 ruling 4).
// owns: the proofs that an order's repository is told from its own `(repo …)` or its goal's words and never defaulted; that the
//   work-order verb refuses an engineer or coder order whose repository cannot be told, with the sentence, and writes nothing;
//   that the dispatcher refuses a queued order with no repository (the sentence on the order, no run filed) and checks out the
//   one it names (wo-273615's shape: a Curator watchdog checked out in lacuna).
// refuses: a mock of repos.mjs, desk-verbs.mjs or work-orders.mjs (a real Supervisor and broker; the host's act is captured).
// implements: W1.2 (docs/lanes/1.0/W1-work-road.md); ROAD Category 2 ruling 4.
// invariants: none of §18.
// faults: none by id; a refusal is a sentence (exit 12 at the verb).
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Supervisor } from '../supervisor.mjs'
import { runDeskVerb } from '../desk-verbs.mjs'
import { dispatchEngineer, readOrders } from '../work-orders.mjs'
import { REPOS, repoOf } from '../repos.mjs'

// spec: ROAD Category 2 ruling 4 · class: L5 the record's shape (an order's repository)
// technique: table of names and goals, the incident's own among them
// method: a named repository in the list wins; one outside it is refused; a goal naming one repository other than lacuna gets it,
//         two get none; a lacuna goal or path gets lacuna; a goal naming nothing gets none, each refusal with its sentence
// sre: if an order says "the Curator watchdog", can it ever be checked out in lacuna again?
test('an order\'s repository is told from its name or its goal\'s words, never defaulted', () => {
  assert.deepEqual(REPOS, ['lacuna', 'curator', 'caliper', 'sakura-scheme'])
  assert.deepEqual(repoOf('curator', 'anything'), { repo: 'curator', why: null })
  assert.match(repoOf('loam', 'x').why, /'loam', which the jail does not read/)
  assert.equal(repoOf(null, 'the Curator watchdog dev-api.health is red; Lacuna reports it every hour').repo, 'curator', 'wo-273615: Lacuna in passing, Curator named')
  assert.equal(repoOf(null, 'port the Sakura Scheme reader').repo, 'sakura-scheme')
  assert.match(repoOf(null, 'compare curator and caliper').why, /names curator and caliper/)
  assert.equal(repoOf(null, 'add a test for lacuna-foreman/ladder.mjs').repo, 'lacuna')
  assert.equal(repoOf(null, 'fix the floor in Lacuna').repo, 'lacuna')
  assert.match(repoOf(null, 'fix the off-by-one in lastN').why, /names no repository/)
})

// spec: W1.2 "a work order names its repo" · class: W5 malformed (an order with no repository)
// technique: the verb over three orders in a scratch desk folder
// method: an engineer order naming nothing is refused (exit 12, the sentence, no record); with repo curator its record carries it;
//         a judge order (no checkout) needs none
// sre: when the desk files work without saying where, is it told so at once instead of running in the wrong tree?
test('the work-order verb refuses an engineer or coder order whose repository cannot be told, and records the one it names', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wo-r-'))
  try {
    const ctx = { dir, run: 'desk:t', now: 1, seq: () => 1 }
    const no = runDeskVerb('work-order', { goal: 'fix the off-by-one in lastN', for: 'engineer' }, ctx)
    assert.equal(no.exit, 12)
    assert.match(no.why || JSON.stringify(no), /names no repository/)
    const queue = path.join(dir, 'work-orders')
    assert.equal(fs.existsSync(queue) ? fs.readdirSync(queue).length : 0, 0, 'nothing written')
    const yes = runDeskVerb('work-order', { goal: 'fix the dev-api watchdog', for: 'engineer', repo: 'curator' }, { ...ctx, seq: () => 2 })
    assert.equal(yes.exit, 0)
    assert.equal(readOrders(dir)[0].repo, 'curator')
    assert.equal(runDeskVerb('work-order', { goal: 'a plan for the week', for: 'judge' }, { ...ctx, seq: () => 3 }).exit, 0, 'a judge order has no checkout')
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

// spec: W1.2 "a run never starts in a repo the ticket did not name" · class: L5 the record's shape
// technique: two hand-written order files (an order filed before W1.2 has no repo field) and the real engineer dispatcher
// method: the order naming nothing is refused with its sentence and files no run; the Curator order's run checks out curator
// sre: does an old order with no repository wait forever, run in lacuna, or say why it cannot run? It must say why.
test('the dispatcher refuses a queued order with no repository and checks out the one an order names', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wo-d-'))
  try {
    fs.mkdirSync(path.join(dir, 'work-orders'))
    fs.writeFileSync(path.join(dir, 'work-orders', 'wo-0001.slat'), '(work-order (id "wo-0001") (run "desk:1") (at 1) (for "engineer") (goal "fix the off-by-one in lastN") (state "queued"))\n')
    fs.writeFileSync(path.join(dir, 'work-orders', 'wo-0002.slat'), '(work-order (id "wo-0002") (run "desk:1") (at 2) (for "engineer") (goal "the Curator watchdog dev-api.health is red: fix it") (state "queued"))\n')
    let t = 1000, n = 0
    const host = { deadlines: { hand: 10, act: 40, beat: 5, mind: 20, hop: 50 }, now: () => t, id: () => `w${++n}`, save: () => {}, contract: () => {},
      upstream: () => {}, act: () => {}, drive: () => {}, brainNow: () => 'e4b' }
    const sup = new Supervisor(host)
    const r = dispatchEngineer(sup, { dir })
    assert.equal(r.did, 'run')
    assert.equal(r.order, 'wo-0002')
    assert.equal(sup.workers.get(r.run).run.repo, 'curator')
    const [first] = readOrders(dir)
    assert.equal(first.state, 'refused')
    assert.match(first.result, /names no repository/)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})
