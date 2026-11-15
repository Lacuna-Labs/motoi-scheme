// phase.test.mjs — THE PHASE STREAM, the foreman's part (K1.9; SENTRY-2.0 §7, unit 3.6). Owns: the proofs that each of the
// nine kinds the foreman emits validates against the floor's catalog (F5-A's `floor/validate.js` when it exists, else F5-BC's
// catalog copy in `floor/test/fixtures/kinds.slat`); that a field outside a kind's row is dropped and never sent; that the
// kinds ride the bus from the real roads (a step row, a ticket opened and closed, a said, a sentry's attach, check, verdict
// and detach) with the coordinate and the run as `ref`; that a kind outside the nine is refused. Refuses: a mock of
// phase.mjs; the roads are the real ones on a real Supervisor.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { makeSup } from '../../../test/conformance/fake-host.mjs'
import { fileRun, intent, result, said } from '../intents.mjs'
import { verdict } from '../sentry/verdicts.mjs'
import { emit, KINDS, pause, detach, sentryActor } from '../phase.mjs'
import { parse as parseCoordinate } from '../coordinate.mjs'

// F5-A's validator when it has landed; until then F5-BC's catalog copy (RULINGS §1(a) over A2 §3), the same semantics
async function validator() {
  const own = new URL('../floor/validate.js', import.meta.url)
  if (fs.existsSync(own)) { const m = await import(own.href); return { name: 'floor/validate.js', check: (ev) => m.validateEvent(ev) } }
  const { readCatalog, validate } = await import('../floor/test/fixtures/catalog.mjs')
  const cat = readCatalog()
  return { name: 'floor/test/fixtures/kinds.slat', check: (ev) => validate(cat, ev) }
}
const asEvent = (u, n) => ({ seq: n, t: Math.round(Date.now()), kind: u.kind, actor: u.data.actor, at: u.data.at, ref: u.data.ref, src: ['foreman-bus', n],
  data: Object.fromEntries(Object.entries(u.data).filter(([k]) => !['at', 'ref', 'actor'].includes(k))) })
const mine = (h) => h.up.filter((u) => KINDS[u.kind])

// spec: SENTRY-2.0 §7 · RULINGS §1(a) (the kind catalog) · A2 §3.2, §3.3 · the brief K1.9 gate · class: L5 the record's shape
// technique: drive every kind through its real road, then validate each bus event against the catalog
// method: nine kinds seen at least once; every event validates; at parses as a coordinate; ref is the run
// sre: does every event the foreman puts on the bus fit the floor's catalog before the door ever sees it?
test('every kind the foreman emits validates against the floor catalog, with its coordinate and its run', async () => {
  const v = await validator()
  const { h, s } = makeSup()
  const w = fileRun(s, { key: 'wo:wo-5', goal: 'fix the probe', by: 'work-order', role: 'coder', tier: 'act', hands: ['read'], acts: ['patch'] })
  const i = intent(s, w.id, { tool: 'read', args: ['a.mjs'] })
  result(s, w.id, 'hand', { ticket: i.ticket, op: 'read', exit: 0, ms: 12, rows: [1, 2] })
  said(s, w.id, 'I will read the probe next.')
  await w.sentryPending                                   // the said's boundary is asynchronous (the labeler's wall); its rows land here
  verdict(s, w, { check: 'drift', action: 'warn', why: 'x', detail: 'd' })
  pause(s, w, { by: 'owner', park: true, forWhat: 'the 26B' })
  detach(s, w, 'ended')
  const seen = new Set(mine(h).map((u) => u.kind))
  assert.deepEqual([...seen].sort(), Object.keys(KINDS).sort(), `all nine kinds rode the bus (validated by ${v.name})`)
  let n = 0
  for (const u of mine(h)) {
    const ev = asEvent(u, ++n)
    const r = v.check(ev)
    assert.equal(r.ok, true, `${u.kind}: ${r.why}`)
    assert.equal(ev.ref, w.id)
    assert.equal(parseCoordinate(ev.at).service, 4096, `${u.kind} carries the foreman's coordinate`)
  }
  const sv = mine(h).find((u) => u.kind === 'sentry.verdict')
  assert.equal(sv.data.actor, sentryActor(w))
  const claim = mine(h).find((u) => u.kind === 'run.claim')
  assert.deepEqual(Object.keys(claim.data).sort(), ['actor', 'at', 'chars', 'claims-done', 'ref'], 'a claim carries chars, never the words')
})

// spec: phase.mjs "a field outside the kind's catalog row is dropped, never sent" · law 7 · class: L1 fail closed
// technique: emit with a stray field and a text over the cap; a kind outside the nine
// method: the stray field is absent on the bus; the string is cut to 300; the unknown kind throws one sentence
// sre: can a producer leak a field the catalog does not know onto the floor's log?
test('a field outside the kind\'s row is dropped, a long string is cut, a kind outside the nine is refused', () => {
  const { h, s } = makeSup()
  const w = fileRun(s, { key: 'r', goal: 'g' })
  const ev = emit(s, w, 'run.step', { n: 1, status: 'running', text: 'x'.repeat(400), args: ['secret'], ticket: null })
  assert.deepEqual(Object.keys(ev.data), ['n', 'status', 'text'])
  assert.equal(ev.data.text.length, 300)
  assert.equal(h.up.at(-1).data.args, undefined)
  assert.throws(() => emit(s, w, 'run.outcome', {}), /not a kind the foreman emits/)
  assert.throws(() => emit(s, w, 'mind.turn.phase', {}), /not a kind the foreman emits/)
})

// spec: A2 §3.2 run.ticket.open|close (the ticket's n, deadline-s, exit, ms, rows) · class: L5
// technique: one hand opened and closed by its receipt · method: the open carries op, kind, n, ticket, deadline-s; the close carries exit, ms, rows count and the same ticket
// sre: can the floor draw the deadline ring from the open and close it on the receipt?
test('a ticket opened and closed rides the bus with its deadline, its position and its receipt\'s numbers', () => {
  const { h, s } = makeSup()
  const w = fileRun(s, { key: 'r', goal: 'g' })
  const i = intent(s, w.id, { tool: 'jobs', deadline_s: 7 })
  result(s, w.id, 'hand', { ticket: i.ticket, op: 'jobs', exit: 0, ms: 33, rows: [1, 2, 3] })
  const open = h.up.find((u) => u.kind === 'run.ticket.open'), close = h.up.find((u) => u.kind === 'run.ticket.close')
  assert.deepEqual([open.data.op, open.data.kind, open.data.n, open.data.ticket, open.data['deadline-s'], open.data.pressed], ['jobs', 'hand', 1, i.ticket, 7, false])
  assert.deepEqual([close.data.exit, close.data.ms, close.data.rows, close.data.ticket, close.data.op], [0, 33, 3, i.ticket, 'jobs'])
  assert.equal(parseCoordinate(open.data.at).call, 1, 'the open carries the call ordinal')
})
