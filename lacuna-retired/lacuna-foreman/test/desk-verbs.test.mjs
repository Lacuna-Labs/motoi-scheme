// desk-verbs.test.mjs — THE DESK'S THREE VERBS. Owns: the tests of desk-verbs.mjs and its road through the intent door:
// each verb writes one record and answers with the ticket the record carries; bad arguments are refused (exit 12); a desk
// run holds the verbs, a cart run does not; the answer lands as a positional result like a hand's. Refuses: a mock of
// intents.mjs, the supervisor or the file system (a temp folder is the world). Implements: WORK-ORDER 0.A, 0.C11, T6, T7.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Supervisor } from '../supervisor.mjs'
import { fileRun, intent } from '../intents.mjs'
import { DESK_VERBS, TO_DESK_S, runDeskVerb, isDeskVerb } from '../desk-verbs.mjs'

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'desk-verbs-'))
function host(dir) {
  let t = 1000, n = 0
  const up = []
  return { up, deadlines: { hand: 10, act: 40, beat: 5, mind: 20, hop: 50 }, now: () => t, id: () => `w${++n}`, save: () => {},
           upstream: (kind, w, data) => up.push({ kind, data }), contract: () => {}, deskDir: () => dir }
}

test('each verb writes one record and answers with the id the record carries', () => {
  const dir = tmp(); let k = 0
  const ctx = { dir, run: 'desk:test:1', now: 1000, seq: () => (k += 1) }
  const wo = runDeskVerb('work-order', { goal: 'split cards.css per card', for: 'coder', repo: 'lacuna' }, ctx)
  assert.equal(wo.exit, 0); assert.equal(wo.rows.id, 'wo-0001'); assert.equal(wo.rows.state, 'queued')
  const rec = fs.readFileSync(path.join(dir, 'work-orders', 'wo-0001.slat'), 'utf8')
  assert.match(rec, /^\(work-order \(id "wo-0001"\) \(run "desk:test:1"\) \(at 1000\) \(for "coder"\) \(goal "split cards.css per card"\)/)
  const s = runDeskVerb('seat', { mind: '26B', why: 'think it through' }, ctx)
  assert.deepEqual([s.exit, s.rows.mind, s.rows['eta-s']], [0, '26b', TO_DESK_S['26b']])
  const s31 = runDeskVerb('seat', { mind: '31b', why: 'deep architecture' }, ctx)
  assert.deepEqual([s31.exit, s31.rows.mind, s31.rows['eta-s']], [0, '31b', TO_DESK_S['31b']])
  const p = runDeskVerb('petition', ['empty the Trash (36 GB)', 'disk at 82%'], ctx)
  assert.equal(p.exit, 0); assert.equal(p.rows.state, 'waiting-owner'); assert.ok(fs.existsSync(path.join(dir, 'petitions', `${p.rows.id}.slat`)))
})

test('the brain\'s shape, one object in a list, reads as that object (live T6)', () => {
  const dir = tmp()
  const r = runDeskVerb('work-order', [{ for: 'coder', goal: 'add a hello module with a test', repo: 'lacuna' }], { dir, run: 'r', now: 1, seq: () => 7 })
  assert.equal(r.exit, 0); assert.equal(r.rows.for, 'coder')
})

test('bad arguments are refused with exit 12 and write nothing', () => {
  const dir = tmp(); const ctx = { dir, run: 'r', now: 1 }
  assert.equal(runDeskVerb('work-order', { goal: 'x', for: 'the moon' }, ctx).exit, 12)
  assert.equal(runDeskVerb('work-order', { for: 'coder' }, ctx).exit, 12)
  assert.equal(runDeskVerb('seat', { mind: '7b' }, ctx).exit, 12)   // e4b is a seat now: the engineer on duty back (OFFICE-PROTOCOL §1)
  assert.equal(runDeskVerb('petition', { action: 'reboot' }, ctx).exit, 12)
  assert.equal(runDeskVerb('reboot', {}, ctx).exit, 12)
  assert.deepEqual(fs.readdirSync(dir), [])
  assert.ok(isDeskVerb('seat') && !isDeskVerb('disk'))
  assert.deepEqual(DESK_VERBS.map((v) => v.name), ['work-order', 'seat', 'remember', 'note', 'say', 'review', 'petition'])
})

test('a desk run holds the verbs and the answer lands as its positional result; a cart run does not hold them', async () => {
  const dir = tmp(); const h = host(dir); const s = new Supervisor(h)
  const w = fileRun(s, { key: 'desk:eval:2', goal: 'write the exporter', doneCheck: '#t' })
  const r = intent(s, w.id, { tool: 'work-order', args: { goal: 'a 300-line exporter for the minds index', for: 'coder', repo: 'lacuna' } })
  assert.deepEqual([r.ok, r.kind, r.n], [true, 'hand', 1])
  assert.equal(h.up.filter((u) => u.kind === 'hand' || u.kind === 'act').length, 0)   // never sent to the hands (the phase stream rides the bus beside it)
  await new Promise((ok) => setTimeout(ok, 5))
  assert.equal(w.pending.length, 0)
  const row = w.run.results.at(-1)
  assert.equal(row.n, 1); assert.equal(row.tool, 'work-order'); assert.equal(row.value.exit, 0); assert.match(row.value.rows.id, /^wo-\d{4}$/)
  const cart = fileRun(s, { key: 'cart:x', goal: 'g', doneCheck: '#t', hands: ['disk'] })
  assert.equal(intent(s, cart.id, { tool: 'seat', args: { mind: '26b' } }).fault, 'F-02')
})

test('M2: remember appends one fact to the profile; a secret or a bad kind is refused', () => {
  const dir = tmp(); const profile = path.join(dir, 'memory', 'profile.slat')
  const ok = runDeskVerb('remember', { fact: 'Alfred likes short answers in the morning.', kind: 'preference', importance: 6 }, { dir, run: 'r', now: 5, profile })
  assert.equal(ok.exit, 0); assert.equal(ok.rows.importance, 6)
  assert.match(fs.readFileSync(profile, 'utf8'), /\(memory \(id "m-\d+"\) \(run "r"\) \(at 5\) \(kind "preference"\) \(fact "Alfred likes short answers in the morning\."\) \(importance 6\) \(from "desk"\)\)/)
  assert.equal(runDeskVerb('remember', { fact: 'password: hunter2hunter2', kind: 'box' }, { dir, run: 'r', now: 5, profile }).exit, 12)
  assert.equal(runDeskVerb('remember', { fact: 'something long enough', kind: 'gossip' }, { dir, run: 'r', now: 5, profile }).exit, 12)
})

test('note appends a dated paragraph to the topic file in the world; a secret or an empty topic is refused', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'note-'))
  const ctx = { dir: path.join(root, 'foreman', 'desk'), notes: path.join(root, 'notes'), run: 'desk:eval:n:1', now: 1792950000 }
  const r = runDeskVerb('note', [{ topic: 'Sentry Forge!', text: 'Pairs are at 140 of 200 per class.' }], ctx)
  assert.equal(r.exit, 0)
  assert.equal(r.rows.topic, 'sentry-forge')
  runDeskVerb('note', { topic: 'sentry-forge', text: 'Second paragraph.' }, ctx)
  const t = fs.readFileSync(path.join(root, 'notes', 'sentry-forge.md'), 'utf8')
  assert.match(t, /140 of 200[\s\S]*Second paragraph/)
  assert.match(t, /<!-- n-\d+ · 2026-10-\d\dT\d\d:\d\dZ · desk:eval:n:1 -->/)
  assert.equal(runDeskVerb('note', { topic: '', text: 'x y z' }, ctx).exit, 12)
  assert.equal(runDeskVerb('note', { topic: 'k', text: 'token: abc' }, ctx).exit, 12)
})

test('an eval run never writes the owner\'s profile or notes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'evalmem-'))
  const ctx = { dir: root, run: 'desk:eval:x:1', now: 1792950000 }
  assert.equal(runDeskVerb('remember', { fact: 'Alfred likes late-50s jazz.', kind: 'preference' }, ctx).exit, 0)
  assert.equal(runDeskVerb('note', { topic: 't', text: 'abc def' }, ctx).exit, 0)
  assert.ok(fs.existsSync(path.join(root, 'memory', 'eval-profile.slat')))
  assert.ok(!fs.existsSync(path.join(root, 'memory', 'profile.slat')))
  assert.ok(fs.existsSync(path.join(root, 'notes', 'eval', 't.md')))
  runDeskVerb('remember', { fact: 'Alfred likes late-50s jazz.', kind: 'preference' }, { ...ctx, run: 'desk:console:1' })
  assert.ok(fs.existsSync(path.join(root, 'memory', 'profile.slat')))
})

test('an eval run\'s seat request is recorded and never moves the seat', async () => {
  const dir = tmp(); const h = host(dir); const seats = []; h.seat = (rows) => seats.push(rows)
  const s = new Supervisor(h)
  const evalRun = fileRun(s, { key: 'desk:eval:m0-8:1', goal: 'what is the 12B good at?', desk: true, by: 'desk' })
  intent(s, evalRun.id, { kind: 'hand', tool: 'seat', args: [{ mind: '12b' }] })
  await new Promise((r) => setImmediate(r))
  assert.deepEqual(seats, [], 'no seat change from an eval run')
  const own = fileRun(s, { key: 'desk:console:1', goal: 'bring the coder', desk: true, by: 'desk' })
  intent(s, own.id, { kind: 'hand', tool: 'seat', args: [{ mind: '12b' }] })
  await new Promise((r) => setImmediate(r))
  assert.equal(seats.length, 1)
  assert.equal(seats[0].state, 'requested')
})

// ── agent talk (O26) and the protocol (O12) ─────────────────────────────────────────────────────────────────────────────
test('agents say lines to each other through the foreman; a refusal names its reason; a conversation ends at its cap', () => {
  const dir = tmp(); let n = 0; const ctx = { dir, run: 'desk:1', now: 1, seq: () => ++n }
  const a = runDeskVerb('say', { to: 'planner', text: 'the telemetry card needs a plan', kind: 'offer', conversation: 'telemetry card' }, ctx)
  assert.equal(a.exit, 0); assert.deepEqual([a.rows.conversation, a.rows.line], ['telemetry-card', 1])
  assert.equal(runDeskVerb('say', { to: 'engineer', text: 'no', kind: 'refuse' }, ctx).exit, 12, 'a refusal without its reason')
  assert.equal(runDeskVerb('say', { to: 'engineer', text: 'the spec says both', kind: 'refuse', reason: 'spec-contradiction' }, ctx).exit, 0)
  assert.equal(runDeskVerb('say', { to: 'janitor', text: 'x' }, ctx).exit, 12)
  for (let i = 0; i < 10; i++) runDeskVerb('say', { to: 'planner', text: `line ${i}`, conversation: 'telemetry card' }, ctx)
  assert.equal(runDeskVerb('say', { to: 'planner', text: 'one more', conversation: 'telemetry card' }, ctx).exit, 0)
  assert.match(runDeskVerb('say', { to: 'planner', text: 'past the cap', conversation: 'telemetry card' }, ctx).why, /12 lines/)
  assert.ok(fs.readFileSync(`${dir}/talk/telemetry-card.slat`, 'utf8').includes('(kind "offer")'))
})

test('I.A.3: the second refusal in a thread ends the loop and files it for the owner; the thread then takes no more lines', () => {
  const dir = tmp(); let n = 0; const ctx = { dir, run: 'desk:1', now: 1, seq: () => ++n }
  runDeskVerb('say', { to: 'engineer', text: 'split cards.css', kind: 'offer', conversation: 'wo-1' }, ctx)
  assert.equal(runDeskVerb('say', { to: 'planner', text: 'the spec names two files', kind: 'refuse', reason: 'spec-contradiction', conversation: 'wo-1' }, ctx).rows.ended, undefined)
  runDeskVerb('say', { to: 'engineer', text: 'amended: one file', kind: 'offer', conversation: 'wo-1' }, ctx)
  const r = runDeskVerb('say', { to: 'planner', text: 'still two', kind: 'refuse', reason: 'spec-contradiction', conversation: 'wo-1' }, ctx)
  assert.deepEqual([r.rows.ended, r.rows.filed], [true, 'owner'])
  assert.match(runDeskVerb('say', { to: 'engineer', text: 'try again', conversation: 'wo-1' }, ctx).why, /tie-break/)
})

test('I15: a review names every CL of its order; changes need a finding; the record is kept', () => {
  const dir = tmp(); const ctx = { dir, run: 'desk:1', now: 1, seq: () => 7 }
  assert.match(runDeskVerb('review', { order: 'wo-12', cls: [], verdict: 'approve' }, ctx).why, /every CL/)
  assert.match(runDeskVerb('review', { order: 'wo-12', cls: ['a3f19c2'], verdict: 'changes' }, ctx).why, /no finding/)
  const r = runDeskVerb('review', { order: 'wo-12', cls: ['a3f19c2', 'b1c2d3e'], verdict: 'changes', findings: ['lastN.mjs:3 <= runs past the end'] }, ctx)
  assert.equal(r.exit, 0)
  const rec = fs.readFileSync(`${dir}/reviews/${fs.readdirSync(`${dir}/reviews`)[0]}`, 'utf8')
  assert.match(rec, /\(cls "a3f19c2 b1c2d3e"\)/); assert.match(rec, /lastN\.mjs:3/)
})
