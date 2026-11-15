// card-worker.test.mjs — unit and road tests for `card-worker.mjs`, the card worker (LACUNA-CARDS-2.0 §8.1, §8.2).
// owns: the proofs that a card's open spawns one worker the registry lists and its close takes it off; that the zombie
//   law never stalls it while its card is open; that "that run" resolves from the thread, the last chip, the one live run,
//   or asks; that "how is that run going" on a stub Forge run reads twice, answers in one paragraph naming its reads, and
//   places the chip through a real scratch surface door whose receipt names the seat; that a refused show places nothing.
// refuses: a mock of card-worker.mjs, of the supervisor, of the registry or of the surface door (all real; the brain and
//   the forge's run list are stubs). Nothing touches ~/lacuna-world or ~/.lacuna: the door's state dir is a temp dir.
// implements: CARDS-2.0 §8.1, §8.2, §9 lane W1. invariants: "if an agent is listed as running, then a worker or a server
//   behind it is alive"; "if the desk moved by a seat, then a receipt row names the seat". faults: none.
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { makeSup } from '../../../test/conformance/fake-host.mjs'
import { fileRun } from '../intents.mjs'
import { registry } from '../agents.mjs'
import { openCard, closeCard, workerOf, cardWorkerRows, resolveRun, isRunQuestion, answer, cardDoor, forgeReads, showForm, CARD_POWERS } from '../card-worker.mjs'
import { createDoor } from '../../../lacuna-node/frontend/server.mjs'
import { routes as surfaceRoutes, checkForm } from '../../../lacuna-node/frontend/surface.mjs'

// the stub run: one live 270M training on Forge, one ended record (the shape GET /api/forge/runs answers)
const FORGE = { ok: true, live: [{ errand: 'p-pick-hand', started: '15:30', step: { model: 'gemma-270m', stage: 'sft', step: 420, of: 1200, loss: 1.84 } }],
                recent: [], records: [{ file: 'r1.json', when: 'Oct 23', model: 'p-label-yes', headline: 'pass 0.91', kept_in: 'current' }] }
const listen = (srv) => new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok(srv.address().port)))
let dir; let door; let upstream; let port

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'card-worker-'))
  upstream = http.createServer((req, res) => { res.writeHead(404); res.end() })
  const up = await listen(upstream)
  door = createDoor({ host: '127.0.0.1', port: 0, upstreamHost: '127.0.0.1', upstreamPort: up, routes: surfaceRoutes({ env: { LACUNA_STATE_DIR: dir, LACUNA_CARD_FORMS: join(dir, 'no-forms') } }), log: () => {} })
  port = await listen(door)
})
after(() => {
  door.closeAllConnections(); door.close(); upstream.closeAllConnections(); upstream.close()
  rmSync(dir, { recursive: true, force: true })
})

const surface = async (form) => (await fetch(`http://127.0.0.1:${port}/api/surface`, { method: 'POST', headers: { 'content-type': 'application/slat', 'x-lacuna-seat': 'lacuna' }, body: form })).json()
const receipts = () => readFileSync(join(dir, 'surface.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l))
const getJson = async (p) => { if (p !== '/api/forge/runs') throw new Error(`no stub for ${p}`); return FORGE }

// spec: CARDS-2.0 §8.1 "spawned by the foreman when the card opens and buried when it closes; listed in GET /agents"
test('a card\'s open spawns one worker that GET /agents lists; a second open is the same one; the close takes it off', () => {
  const { h, s } = makeSup()
  const before = registry(s).agents.length
  const a = openCard(s, 's-forge')
  assert.equal(a.ok, true); assert.equal(a.fresh, true); assert.match(a.id, /^worker\/s-forge#[0-9a-z]{4}$/)
  const row = registry(s).agents.find((r) => r.card === 's-forge')
  assert.ok(row, 'the worker row is in the registry')
  assert.equal(row.id, a.id); assert.equal(row.kind, 'worker'); assert.equal(row.state, 'running'); assert.deepEqual(row.powers, CARD_POWERS)
  assert.ok(row.shape, 'K1 stamps its worker shape')
  const b = openCard(s, 's-forge')
  assert.equal(b.fresh, false); assert.equal(b.id, a.id); assert.equal(cardWorkerRows(s).length, 1)
  // the zombie law sweeps every GET /agents: ten minutes of quiet never stall an open card's worker
  for (let i = 0; i < 10; i++) { h.tick(60); s.sweep() }
  assert.equal(workerOf(s, 's-forge')?.state, 'running')
  const w = s.workers.get(a.wid)
  assert.deepEqual([...w.verbs], ['every'], 'it asks for its beat and nothing else: no hand, act, file or spawn')
  assert.deepEqual(closeCard(s, 's-forge'), { ok: true, id: a.id })
  assert.equal(registry(s).agents.find((r) => r.card === 's-forge'), undefined, 'the row goes on close')
  assert.equal(registry(s).agents.length, before); assert.equal(w.state, 'retired'); assert.equal(w.timers.length, 0)
  assert.deepEqual(closeCard(s, 's-forge'), { ok: true, id: null }, 'a second close is a no-op')
})

// a foreman restart resumes workers from their checkpoints with name, program and kv, not the card field
test('a card worker brought back from its checkpoint is found by its card again and its close stops it', () => {
  const { s } = makeSup()
  const a = openCard(s, 's-exam')
  const w = s.workers.get(a.wid)
  delete w.cardWorker
  assert.equal(workerOf(s, 's-exam')?.id, a.wid)
  assert.equal(openCard(s, 's-exam').fresh, false, 'the next open finds it; no second worker')
  assert.equal(cardWorkerRows(s)[0].id, a.id)
  assert.equal(closeCard(s, 's-exam').ok, true); assert.equal(w.state, 'retired')
  const other = s.spawn({ name: 'worker/s-exam#abcd', program: '(every 60 (lambda () #f))', verbs: ['every'] })
  assert.equal(workerOf(s, 's-exam'), null, 'a look-alike name with another program is not a card worker')
  s.stop(other.id, 'done')
})

test('a card id outside s-<name> is refused at open and at the door', async () => {
  const { s } = makeSup()
  for (const bad of ['forge', 's-', 'S-FORGE', '../s-forge', 's-forge;rm']) assert.equal(openCard(s, bad).ok, false, bad)
  const d = cardDoor(s)
  assert.equal((await d('POST', '/cards/s_forge/open', async () => ({}))).status, 422)
  assert.equal(await d('GET', '/cards/s-forge/open', async () => ({})), null, 'a GET is not its road')
  assert.equal(await d('POST', '/cards/s-forge/press', async () => ({})), null, 'no press road')
})

// spec: CARDS-2.0 §8.2 step 2
test('"that run": the newest run named in the thread, then the last chip, then the one live run, else it asks which', () => {
  const runs = [{ id: 'p-pick-hand', live: true }, { id: 'p-label-yes', live: false }, { id: 'p-pick', live: false }]
  assert.deepEqual(resolveRun({ thread: ['look at p-label-yes', 'and p-pick-hand?'], runs }), { id: 'p-pick-hand', by: 'named in this drawer' })
  assert.deepEqual(resolveRun({ thread: ['what about p-label-yes', 'how is that run going'], runs }), { id: 'p-label-yes', by: 'named in this drawer' })
  assert.equal(resolveRun({ thread: ['p-pick-hand'], runs }).id, 'p-pick-hand', 'the longest id wins over its prefix')
  assert.deepEqual(resolveRun({ thread: ['hi'], named: 'p-label-yes', runs }), { id: 'p-label-yes', by: 'the last chip in this drawer' })
  assert.deepEqual(resolveRun({ thread: [], runs }), { id: 'p-pick-hand', by: 'the one live run on the card' })
  assert.match(resolveRun({ runs: [{ id: 'a-1', live: true }, { id: 'b-2', live: true }] }).ask, /^Which run: a-1, b-2\?$/)
  assert.match(resolveRun({ runs: [] }).ask, /none is named/)
})

test('the question: how a run is going, in the owner\'s words', () => {
  for (const q of ['how is that run going', "How's it going?", 'how is the training doing', 'status of the run', 'how far along is it']) assert.equal(isRunQuestion(q), true, q)
  for (const q of ['start a job', 'what is this card', 'pause it']) assert.equal(isRunQuestion(q), false, q)
})

// spec: CARDS-2.0 §8.2 steps 1–6 on a stub run, through the foreman route and a real scratch surface door
test('"how is that run going" on Forge: two reads, one paragraph naming them, and the chip through the door with a receipt', async () => {
  const { h, s } = makeSup()
  const run = fileRun(s, { key: 'p-pick-hand', goal: 'train the pick-hand 270M' })
  assert.ok(run.contract, 'the stub run has a contract')
  const d = cardDoor(s, { reads: (card) => (card === 's-forge' ? forgeReads({ getJson, sup: s }) : null), surface })
  assert.equal((await d('POST', '/cards/s-forge/ask', async () => ({ text: 'how is that run going' }))).status, 409, 'a closed card has no worker')
  assert.equal((await d('POST', '/cards/s-forge/open', async () => ({}))).status, 200)
  const r = await d('POST', '/cards/s-forge/ask', async () => ({ text: 'how is that run going', thread: [], session: 'eval:w1-card-worker' }))
  assert.equal(r.status, 200)
  const a = r.json
  assert.match(a.text, /^p-pick-hand trains: step 420 of 1,200 \(35 %\), loss 1\.84, stage sft, contract filed\. Read: the contract at \d\d:\d\d; the forge run status at \d\d:\d\d\.$/)
  assert.deepEqual(a.read, ['contract', 'status'])
  assert.equal(a.form, undefined)
  assert.deepEqual({ ...a.show, receipt: undefined }, { card: 's-forge', kind: 'run', record: 'p-pick-hand', view: 'effect', state: 'live', receipt: undefined, form: '(surface show s-forge run p-pick-hand effect)' })
  const row = receipts().find((x) => x.id === a.show.receipt)
  assert.ok(row, 'the chip rides a receipt row')
  assert.equal(row.seat, 'lacuna'); assert.equal(row.ok, true); assert.equal(row.verb, 'show')
  assert.deepEqual(row.args, { card: 's-forge', kind: 'run', record: 'p-pick-hand', view: 'effect' })
  const feed = await (await fetch(`http://127.0.0.1:${port}/api/surface?since=0`)).json()
  assert.equal(feed.forms.at(-1).verb, 'show', 'the desk\'s feed carries the show')
  assert.equal(s.workers.get(workerOf(s, 's-forge').id).cardWorker.named, 'p-pick-hand', 'the worker keeps the run it showed')
  assert.match(a.worker, /^worker\/s-forge#/)
  h.tick(1)
  closeCard(s, 's-forge')
})

test('the show form is one the real verb table takes; a record outside its shape is refused', () => {
  const f = checkForm(showForm('s-forge', 'run', 'p-pick-hand', 'effect'))
  assert.deepEqual(f, { ok: true, verb: 'show', args: { card: 's-forge', kind: 'run', record: 'p-pick-hand', view: 'effect' } })
  assert.equal(checkForm('(surface show s-forge run "../etc/passwd" effect)').ok, false)
  assert.equal(checkForm('(surface show s-forge run p-pick-hand)').ok, false, 'four arguments')
})

test('a refused show places no chip and says why; a read that fails is named, never guessed', async () => {
  const reads = { runs: async () => [{ id: 'p-pick-hand', live: true }], contract: async () => { throw new Error('the foreman did not answer') }, status: async () => ({ id: 'p-pick-hand', live: true, step: 5, of: 10 }) }
  const a = await answer({ card: 's-forge', text: 'how is it going', now: () => 1000, reads, surface: async () => ({ ok: false, why: 'show is not a surface verb' }) })
  assert.equal(a.show, null)
  assert.match(a.text, /no contract \(the read failed: the foreman did not answer\)/)
  assert.match(a.text, /No chip: the door refused the show \(show is not a surface verb\)\.$/)
  const b = await answer({ card: 's-forge', text: 'how is it going', now: () => 1000, reads })
  assert.match(b.text, /No chip: the surface door is not wired/)
  const c = await answer({ card: 's-forge', text: 'how is it going', now: () => 1000, reads: { ...reads, runs: async () => { throw new Error('ECONNREFUSED') } } })
  assert.equal(c.ok, false); assert.match(c.text, /one try, no retry/)
})

test('the brain may compose the paragraph from the same reads; a silent brain leaves the record-built one', async () => {
  const reads = { runs: async () => [{ id: 'p-pick-hand', live: true }], contract: async () => null, status: async () => ({ id: 'p-pick-hand', live: true, step: 5, of: 10 }) }
  const seen = []
  const brain = async (q) => { seen.push(q); return 'p-pick-hand is halfway. Read: the run status.' }
  const a = await answer({ card: 's-forge', text: 'how is it going', now: () => 1000, reads, brain })
  assert.match(a.text, /^p-pick-hand is halfway\. Read: the run status\. No chip: the surface door is not wired/)
  assert.equal(seen[0].run, 'p-pick-hand'); assert.match(seen[0].paragraph, /^p-pick-hand trains: step 5 of 10 \(50 %\)/)
  const b = await answer({ card: 's-forge', text: 'how is it going', now: () => 1000, reads, brain: async () => { throw new Error('parked') } })
  assert.match(b.text, /^p-pick-hand trains/)
})

test('a card with no records wired and a question it does not take answer in one honest sentence', async () => {
  assert.match((await answer({ card: 's-exam', text: 'how is that run going', now: () => 1000, reads: {} })).text, /reads no run on s-exam yet/)
  const reads = { runs: async () => [], contract: async () => null, status: async () => null }
  assert.match((await answer({ card: 's-forge', text: 'start a job', now: () => 1000, reads })).text, /ask "how is that run going"/)
  assert.match((await answer({ card: 's-forge', text: 'how is that run going', now: () => 1000, reads })).text, /Which run\?$/)
})

test('forgeReads: live runs and ended records from the forge list; the contract from the foreman\'s memory by key', async () => {
  const { s } = makeSup()
  fileRun(s, { key: 'p-pick-hand', goal: 'train' })
  const r = forgeReads({ getJson, sup: s })
  assert.deepEqual((await r.runs()).map((x) => [x.id, x.live]), [['p-pick-hand', true], ['p-label-yes', false]])
  assert.equal((await r.status('p-pick-hand')).loss, 1.84)
  assert.equal((await r.status('nope')), null)
  assert.equal((await r.contract('p-pick-hand')).key, 'p-pick-hand')
  assert.equal(await r.contract('p-label-yes'), null)
  await assert.rejects(forgeReads({ getJson: async () => ({ ok: false, why: 'down' }), sup: s }).runs(), /down/)
})

// spec: CARDS-2.0 §9.3 step 4 (F5) · class: E · technique: a forge list holding a job the hands started · method: list,
// read its status and its contract · sre: does "how is it going?" find a Forge job started by kind, by its worker id?
test('forgeReads: a job the hands started is named by its worker, and its contract is that worker\'s', async () => {
  const { s } = makeSup()
  const w = fileRun(s, { key: 'desk:job', goal: 'train' })
  const get = async () => ({ live: [{ errand: `job-${w.id}`, worker: w.id, state: 'paused', step: { step: 26, of: 100, loss: 0.9 } }], records: [] })
  const r = forgeReads({ getJson: get, sup: s })
  assert.deepEqual((await r.runs()).map((x) => [x.id, x.live, x.step]), [[w.id, true, 26]])
  assert.equal((await r.contract(w.id)).key, 'desk:job')
  const a = await answer({ card: 's-forge', text: 'How is it going?', now: () => 1000, reads: r })
  assert.equal(a.run, w.id)
  assert.deepEqual(a.read, ['contract', 'status'])
})
