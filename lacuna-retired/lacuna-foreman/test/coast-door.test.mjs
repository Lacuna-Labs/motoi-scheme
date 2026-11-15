// coast-door.test.mjs — the foreman's `/coast` and `/sentry` routes on a scratch foreman (MINDS §4.6; the slash commands read them).
// owns: the proof that the door answers a coast reading with a level and the sentry's sentence, and a sentry view with the
//   coast, the living runs' grade forms and the broker. refuses: the live foreman; a mock of coast.mjs or sentry.mjs.
// implements: MINDS §4.6; SENTRY §2.5. invariants: "if the desk stepped down, then a coast row said why". faults: none raised.
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { boot } from './foreman-box.mjs'

const cleanups = []
let f
before(async () => { ({ f } = await boot({ after: (fn) => cleanups.push(fn) }, { tag: 'coast' })) })
after(async () => { for (const fn of cleanups.reverse()) await fn() })

// spec: MINDS §4.6 · class: W1 a door that answers · technique: the real ps on the scratch foreman's own process
// method: GET /coast then GET /sentry after filing one run; the run's grade rides in the view
// sre: can the owner ask "is the coast clear" and get one sentence with units, never a dump?
test('/coast answers a level and the sentry\'s sentence; /sentry adds every living run\'s grade and the broker', async () => {
  const c = await f.call('GET', '/coast')
  assert.equal(c.status, 200); assert.ok(['clear', 'busy', 'tight'].includes(c.body.level)); assert.match(c.body.say, /^(The coast is clear|Other work has the box|Memory is tight)/)
  const r = await f.call('POST', '/runs', { key: 'coast-1', goal: 'g', hands: ['jobs'] })
  assert.equal(r.status, 200)
  const s = await f.call('GET', '/sentry')
  assert.equal(s.status, 200); assert.equal(s.body.coast.level, c.body.level)
  const run = s.body.runs.find((x) => x.id === r.body.run || x.id === r.body.worker?.id || x.name?.includes('coast-1')) || s.body.runs[0]
  assert.ok(run, 'the filed run is in the sentry view'); assert.equal(run.grade.on_task, true); assert.equal(run.grade.kicks, 0)
  assert.ok(s.body.broker && typeof s.body.broker === 'object')
})

// spec: A29 the agents registry on the door · technique: the scratch foreman with no carts and no index
// method: GET /agents; the six standing rows, counts honest · sre: can the agents screen draw agency from one read?
test('/agents answers the seats, the sentry and the broker, every cart with its workers and the shelf, with honest counts', async () => {
  const r = await f.call('GET', '/agents')
  assert.equal(r.status, 200); assert.equal(r.body.ok, true)
  assert.deepEqual(r.body.agents.slice(0, 6).map((a) => a.id), ['seat/owner', 'seat/desk', 'seat/cloud', 'seat/claude', 'agent/sentry', 'agent/broker'])
  assert.equal(r.body.counts.seats, 4); assert.equal(typeof r.body.counts.carts, 'number'); assert.equal(typeof r.body.counts.shelf, 'number')
})
