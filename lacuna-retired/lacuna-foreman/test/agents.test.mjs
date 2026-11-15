// agents.test.mjs — unit tests for `agents.mjs`, the agents registry (A29; MINDS §5.5, §5.6).
// owns: the proofs that the seats and standing agents are listed with their state from the broker and the sentry; that every
//   cart row becomes an agent carrying its living workers; that the shelf groups the index's trained weights by role with the
//   best in-role row; that nothing is invented when there is no cart and no index. refuses: a mock of agents.mjs.
// implements: MINDS §5.5, §5.6. invariants: "if an agent is listed as running, then a worker or a server behind it is alive". faults: none.
import test from 'node:test'
import assert from 'node:assert/strict'
import { makeSup } from '../../../test/conformance/fake-host.mjs'
import { fileRun } from '../intents.mjs'
import { loadIndex } from '../assign.mjs'
import { registry, standing, cartAgents, shelfAgents, POWERS } from '../agents.mjs'

const DIR = new URL('./fixtures/assign/', import.meta.url).pathname

// spec: MINDS §4.1 the seats, §4.6 the sentry and the broker as standing agents
test('the seats and the two standing agents are listed with their colours, their powers and the broker\'s brain', () => {
  const { s } = makeSup()
  const rows = standing(s)
  assert.deepEqual(rows.map((r) => r.id), ['seat/owner', 'seat/desk', 'seat/cloud', 'seat/claude', 'agent/sentry', 'agent/broker'])
  assert.equal(rows.find((r) => r.id === 'seat/claude').color, '#c8956c'); assert.equal(rows.find((r) => r.id === 'seat/desk').color, '#b6ff00')
  assert.match(rows.find((r) => r.id === 'seat/desk').does, /the 26b resident/)
  assert.equal(rows.find((r) => r.id === 'agent/sentry').shadow, true); assert.deepEqual(rows[0].powers, POWERS.seat)
})

// spec: MINDS §5.6 "the cards and their workers represented inside the foreman" · technique: two cart rows, one with a living run
test('every cart row is an agent; a living run filed for a cart rides as its worker with the worker\'s powers', () => {
  const { s } = makeSup()
  const w = fileRun(s, { key: 'r-1', goal: 'watch the disk', cart: 'disk-watch' })
  w.contract.cart = 'disk-watch'
  const rows = cartAgents(s, [{ name: 'disk-watch', does: 'the disk line', version: 2, tier: 'hand', state: 'ok', runs: 12, firstTry: 0.9 }, { name: 'release', does: 'the release train', version: 1 }])
  assert.equal(rows.length, 2)
  const d = rows.find((r) => r.id === 'cart/disk-watch')
  assert.equal(d.state, 'running'); assert.equal(d.workers.length, 1); assert.equal(d.workers[0].id, w.id); assert.deepEqual(d.workers[0].powers, POWERS.worker)
  assert.equal(rows.find((r) => r.id === 'cart/release').state, 'idle'); assert.deepEqual(d.powers, POWERS.cart)
})

// spec: MINDS §5.6 the agent library: a role with trained weights is an agent on the shelf · technique: the assign fixtures
test('the shelf groups trained weights by role with the best in-role row; bases are not agents', () => {
  const index = loadIndex({ mindsDir: DIR + 'minds', jobsDir: DIR + 'jobs' })
  const rows = shelfAgents(index)
  assert.deepEqual(rows.map((r) => r.id), ['agent/sentry'])
  assert.equal(rows[0].weights.length, 2); assert.equal(rows[0].best.id, 'sentry/1b@3'); assert.equal(rows[0].best.recall, 0.93)
  assert.equal(rows[0].state, 'shelved'); assert.deepEqual(rows[0].powers, POWERS.shelf)
})

// spec: "to invent an agent" is refused · technique: no carts, no index
test('with no carts and no index the registry is the seats and the standing agents, counted honestly', () => {
  const { s } = makeSup()
  const r = registry(s)
  assert.equal(r.agents.length, 6); assert.deepEqual(r.counts, { seats: 4, standing: 2, carts: 0, running_carts: 0, workers: 0, shelf: 0, brain: '26b' })
})
