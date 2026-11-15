// sentry-provenance.test.mjs — THE PROVENANCE CHAIN (K1.6; SENTRY-2.0 §4, unit 3.3). Owns: the proofs that the five links
// build from a run's records with each link's hash on the next and verify; that a hash edited, a prev swapped or a link
// with no record is the broken link named; and that at a call each broken link is a red verdict with its why: a result that
// names a ticket nobody holds (`no-ticket`), a receipt whose touched set leaves the run's touches (`outside-touches`: the run
// stops as I-03), a run filed as work with no order behind it (`no-order`), a ticket of a past generation (`stale-gen`).
// Refuses: a mock of provenance.mjs; every run is filed through intents.mjs on a real Supervisor.
import test from 'node:test'
import assert from 'node:assert/strict'
import { makeSup } from '../../../test/conformance/fake-host.mjs'
import { fileRun, intent, result } from '../intents.mjs'
import { LINKS, links, chain, verify, checkCall, authorityOf } from '../sentry/provenance.mjs'

const rows = (h) => h.rows.filter((l) => l.startsWith('(verdict '))

// spec: SENTRY-2.0 §4 "five links, each carrying the hash of the one before" · class: L5 the record's shape
// technique: a work-order run with a checkout result and one open ticket · method: the links' data, the chain's prevs, verify ok
// sre: can the record say, for one call, who authorized it, under which order, run and step, by table lookups alone?
test('the five links build from the run\'s records and verify; each link names the hash before it', () => {
  const { s } = makeSup()
  const w = fileRun(s, { key: 'wo:wo-273615', goal: 'fix the probe', by: 'work-order', role: 'coder', tier: 'act', hands: ['read'], acts: ['checkout', 'patch'], repo: 'lacuna', touches: ['**'] })
  const checkout = w.pending.find((t) => t.op === 'checkout')
  result(s, w.id, 'act', { ticket: checkout.ticket, op: 'checkout', exit: 0, rows: { dir: '/runs/x/lacuna', branch: `lacuna/${w.id}` } })
  const i = intent(s, w.id, { tool: 'read', args: ['a.mjs'] })
  const t = w.pending.find((x) => x.ticket === i.ticket)
  const l = links(s, w, t)
  assert.deepEqual(Object.keys(l), [...LINKS])
  assert.deepEqual([l.authority.kind, l.order.id, l.order.role, l.run.checkout.branch, l.call.ticket, l.call.gen], ['order', 'wo-273615', 'coder', `lacuna/${w.id}`, i.ticket, 1])
  const ch = chain(s, w, t)
  assert.equal(ch[0].prev, 'genesis')
  for (let k = 1; k < ch.length; k++) assert.equal(ch[k].prev, ch[k - 1].hash)
  assert.deepEqual(verify(ch), { ok: true, broken: null, why: null })
  assert.deepEqual([authorityOf({ by: 'owner:agents-room' }).kind, authorityOf({ by: 'w-cart' }).kind, authorityOf({ by: 'x' }, { pressed: { by: 'owner' } }).kind], ['owner', 'schedule', 'press'])
})

// spec: §4 "a broken link … is the red light" · class: W5 a tampered record
// technique: fault injection on the chain: a data edit, a swapped prev, a missing call link
// method: verify names the broken link and says why
// sre: if someone edits a link after the fact, does the walk catch it at that link?
test('an edited link, a swapped prev or a link with no record is the broken link named', () => {
  const { s } = makeSup()
  const w = fileRun(s, { key: 'wo:wo-7', goal: 'g', by: 'work-order' })
  const good = chain(s, w, { ticket: 'x', op: 'read', kind: 'hand', deadline_at: 1, at: 'lacuna:/1/4096/7/0/1/1/1', gen: 1 })
  const edited = good.map((x, i) => (i === 2 ? { ...x, data: { ...x.data, touches: ['/etc/**'] } } : x))
  assert.deepEqual([verify(edited).ok, verify(edited).broken], [false, 'run'])
  const swapped = good.map((x, i) => (i === 3 ? { ...x, prev: good[1].hash } : x))
  assert.deepEqual([verify(swapped).ok, verify(swapped).broken], [false, 'step'])
  const noCall = chain(s, w, null)
  assert.deepEqual([verify(noCall).ok, verify(noCall).broken], [false, 'call'])
  assert.match(verify(noCall).why, /no record behind it/)
  assert.equal(verify(good.slice(0, 4)).broken, 'call')
})

// spec: §4 "an act with no open ticket" · the brief K1.6 gate · class: L3 a result from nowhere
// technique: a result naming a ticket nobody holds; a reply naming no ticket (a press's answer)
// method: the first is refused exit 12 with the check named and a red row; the second lands with a note row and marks no step done
// sre: can a reply the foreman never asked for land as a result? (red, refused)
test('a result for a ticket nobody holds is red and refused; a reply naming no ticket lands with a note', () => {
  const { h, s } = makeSup()
  const w = fileRun(s, { key: 'r', goal: 'g' })
  const r = result(s, w.id, 'hand', { ticket: 'w-ghost-hand-9', op: 'jobs', exit: 0 })
  assert.deepEqual([r.ok, r.exit, r.check], [false, 12, 'no-ticket'])
  assert.match(rows(h).at(-1), /\(check "no-ticket"\) \(by "code"\) \(action "refuse"\)/)
  assert.equal(w.run.results.length, 0)
  const i = intent(s, w.id, { tool: 'jobs' })
  const nil = result(s, w.id, 'hand', { op: 'jobs', exit: 0 })
  assert.equal(nil.ok, true)
  assert.match(rows(h).at(-1), /\(check "no-ticket"\) \(by "code"\) \(action "note"\)/)
  assert.equal(w.contract.steps.filter((x) => x.status === 'done').length, 0, 'no ticket named: no step done')
  assert.equal(w.pending.find((t) => t.ticket === i.ticket), undefined, 'the oldest ticket of its kind closed, as before')
})

// spec: §4 "a path outside touches" · I-03 · class: L3 the jail is wrong
// technique: a receipt with a touched set outside the run's touches, with no rule from the hands
// method: the row outside-touches (stop), the run exit 12 fail with its why, one letter
// sre: if the hands do not flag a write outside touches, does the foreman still catch it on the receipt?
test('a receipt whose touched set leaves the run\'s touches is red: the run stops with exit 12 and its why', () => {
  const { h, s } = makeSup()
  const w = fileRun(s, { key: 'wo:wo-9', goal: 'g', by: 'work-order', tier: 'act', acts: ['patch'], touches: ['src/**'] })
  const i = intent(s, w.id, { tool: 'patch', args: { edits: [{ file: 'src/a.mjs', write: 'x' }] } })
  const r = result(s, w.id, 'act', { ticket: i.ticket, op: 'patch', exit: 0, touched: ['src/a.mjs', 'docs/notes.md'] })
  assert.deepEqual([r.ok, r.exit], [false, 12])
  assert.match(rows(h).find((l) => /outside-touches/.test(l)), /\(action "stop"\)/)
  assert.deepEqual([w.contract.exit, w.contract.outcome, w.state], [12, 'fail', 'retired'])
  assert.match(w.contract.why, /docs\/notes\.md/)
  assert.equal(h.letters.length, 1)
})

// spec: §4 "a run under no order" · class: L3 an authority missing
// technique: a run filed by the work-order road whose key names no order; the same key filed by the owner
// method: the first call is refused F-02 with no-order (red); the owner's run is not (its authority is his words)
// sre: can the work-order road file a run that no order stands behind?
test('a run filed as work with no order behind it is red at its first call; an owner\'s run is not', () => {
  const { h, s } = makeSup()
  const w = fileRun(s, { key: 'orphan', goal: 'g', by: 'work-order' })
  const r = intent(s, w.id, { tool: 'jobs' })
  assert.deepEqual([r.ok, r.fault, r.exit], [false, 'F-02', 12])
  assert.match(r.why, /no order link/)
  assert.match(rows(h).at(-1), /\(check "no-order"\) \(by "code"\) \(action "refuse"\)/)
  const o = fileRun(s, { key: 'mine', goal: 'g', by: 'owner:desk' })
  assert.equal(intent(s, o.id, { tool: 'jobs' }).ok, true)
  assert.equal(checkCall(s, o, { phase: 'intent', op: 'jobs' }).ok, true)
})

// spec: §4 "gen is the ghost-worker guard" · the brief K1.3 gate "a ticket with a stale gen is refused" · class: E11 a ghost
// technique: a ticket issued to generation 1; the worker restarts to generation 2; the receipt lands
// method: refused exit 12 with stale-gen and a red row; the result never lands
// sre: after a restart, can a receipt from the old generation close a step of the new one? (it must not)
test('a ticket of a past generation is refused when its receipt lands', () => {
  const { h, s } = makeSup()
  const w = fileRun(s, { key: 'r', goal: 'g' })
  const i = intent(s, w.id, { tool: 'jobs' })
  assert.equal(w.pending.find((t) => t.ticket === i.ticket).gen, 1)
  w.gen = 2
  const r = result(s, w.id, 'hand', { ticket: i.ticket, op: 'jobs', exit: 0 })
  assert.deepEqual([r.ok, r.exit, r.check], [false, 12, 'stale-gen'])
  assert.match(rows(h).at(-1), /stale-gen.*\(action "refuse"\)/)
  assert.equal(w.run.results.length, 0)
})
