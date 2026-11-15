// hands-link.test.mjs — U3 (K6): THE HOP TO THE HANDS. Owns: the tests of hands-link.mjs against a hands daemon played by
// an in-test Unix socket server speaking signed slat: a hand or act signed out, the signed `result` opened at the reply
// gate and delivered (a run's positional result, a cart's `(on 'hand …)`), and every way the hop fails (no socket, no
// reply in time, a forged or foreign reply, a worker gone, a delivery that throws); the contract to its one writer.
// Refuses: the live hands (~/.lacuna/hands.sock); a mock of hands-link.mjs or of the gate. Implements: unit-test work
// order §3 row hands-link.mjs (design §6 change 1 the foreman asks the hands, signed both ways; change 3; §12 trials; eng
// §3.2 row 3; §3.3 hand/result fields; §3.5 hands hop wait deadline + 15 s). Invariants (§18): "dropped and counted" (the
// reply gate). Faults (§16): F-01 (exit 15 from the hands, carried), F-10 (a reply dropped at the gate).
// coverage: hands-link.mjs — lines 100% branches 98.55% functions 100% (2026-10-24; the one gap is named as a todo below)
import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { Supervisor } from '../supervisor.mjs'
import { fileRun, intent } from '../intents.mjs'
import { sendToHands, handsPresent, writeContract } from '../hands-link.mjs'
import { renderContract } from '../contract.mjs'
import { Gate, seal } from '../protocol.mjs'

const KEY = 'k'.repeat(32)
const U3 = '/private/tmp/lacuna-unit/U3'
/** A hands daemon in this process. `answer(got)` returns a sealed `{slat, sig}`, or `{hang: ms}`, or `{raw}` (no signature). */
function fakeHands(sock, answer) {
  const gate = new Gate(KEY, () => Date.now() / 1000)
  const srv = http.createServer((req, res) => {
    let text = ''; req.setEncoding('utf8'); req.on('data', (d) => { text += d })
    req.on('end', async () => {
      const got = gate.open({ slat: text, sig: req.headers['x-slat-sig'] })
      const out = await answer(got)
      if (out.hang) { await new Promise((r) => setTimeout(r, out.hang)); return res.destroy() }
      res.writeHead(200, { 'Content-Type': 'application/slat', ...(out.sig ? { 'X-Slat-Sig': out.sig } : {}) }); res.end(out.slat ?? out.raw)
    })
  })
  return new Promise((r) => srv.listen(sock, () => r(srv)))
}
const tmpSock = () => { fs.mkdirSync(U3, { recursive: true }); return path.join(fs.mkdtempSync(path.join(U3, 'hl-')), 'h.sock') }
const reply = (body, o = {}) => seal(o.key || KEY, { from: 'hands', to: 'foreman', kind: o.kind || 'result', body, at: Date.now() / 1000 })
function host(extra = {}) { return { now: () => Date.now() / 1000, id: () => `w${Math.random().toString(36).slice(2, 6)}`, save: () => {}, upstream: () => {}, deadlines: { hand: 10, act: 40, beat: 5, mind: 20, hop: 50, acts: { pass: 900 } }, ...extra } }
async function served(t, answer) { const sock = tmpSock(); const srv = await fakeHands(sock, answer); t.after(() => { srv.closeAllConnections?.(); srv.close(); fs.rmSync(path.dirname(sock), { recursive: true, force: true }) }); return sock }

// spec: design §6 change 1 (signed both ways) · eng §3.2 row 3 · §3.3 (hand fields: ticket op args run key deadline tier) · law 5
// class: W1–W4 at the reply gate (here the good path, the reference for the failures below)
// technique: a scratch hands socket that opens the request and answers a signed result
// method: file a run; intent a read; send it; read what the hands opened (kind hand, J0, deadline 10, run = id, key) and the
//         record: the ticket closed, result 1 with the rows
// sre: if the foreman asks the hands for a read, does exactly the asked read go out signed and land as the run's result 1?
test('a run intent goes to the hands signed and comes back as result n', async (t) => {
  let seen = null
  const sock = await served(t, (got) => { seen = got.msg; return reply({ ticket: got.msg.body.ticket, exit: 0, status: null, ms: 3, rows: { free_gb: 22 } }) })
  const s = new Supervisor({ ...host(), key: KEY })
  const w = fileRun(s, { key: 'r-h', goal: 'g', hands: ['disk'] })
  const i = intent(s, w.id, { tool: 'disk', args: ['/'] })
  const r = await sendToHands({ sup: s, sock, key: KEY, kind: 'hand', w, data: { ticket: i.ticket, op: 'disk', args: ['/'], n: i.n } })
  assert.equal(r.ok, true); assert.equal(seen.kind, 'hand'); assert.deepEqual(seen.body.args, ['/']); assert.equal(seen.body.tier, 'J0'); assert.equal(seen.body.deadline, 10); assert.equal(seen.body.run, w.id); assert.equal(seen.body.key, 'r-h')
  assert.equal(w.pending.length, 0); assert.equal(w.run.results[0].value.rows.free_gb, 22); assert.equal(w.run.results[0].n, 1)
})

// spec: design §6 change 1 · eng §3.1 (the gate: a forged reply is dropped and counted) · I-05 · F-10
// class: W2 forged (a reply signed with another key)
// technique: fault injection at the hands: the second reply is sealed with a wrong key
// method: a cart's hand comes back as (on 'hand …) with rows and op; then a forged reply: ok false, drop forged, the ticket
//         still pending (its deadline decides), handsGate.drops.forged 1
// sre: if something else answers on the hands socket, is its answer thrown away and counted, and the ticket left to its clock?
test('a cart hand comes back as (on \'hand …) with the op as a symbol; a forged reply is dropped and the ticket stays', async (t) => {
  let forge = false
  const sock = await served(t, (got) => reply({ ticket: got.msg.body.ticket, exit: 0, status: null, rows: [1, 2] }, { key: forge ? 'x'.repeat(32) : KEY }))
  const s = new Supervisor({ ...host(), key: KEY })
  const w = s.spawn({ name: 'c', program: `(define t (hand 'jobs)) (on 'hand (lambda (r) (remember 'rows (get r 'rows)) (remember 'op (get r 'op))))`, verbs: ['hand', 'remember'] })
  await sendToHands({ sup: s, sock, key: KEY, kind: 'hand', w, data: { ticket: w.pending[0].ticket, op: 'jobs', args: [] } })
  assert.deepEqual(w.kv.rows, [1, 2]); assert.equal(w.pending.length, 0)
  forge = true
  const w2 = s.spawn({ name: 'c2', program: `(define t (hand 'jobs)) (on 'hand (lambda (r) #t))`, verbs: ['hand'] })
  const r = await sendToHands({ sup: s, sock, key: KEY, kind: 'hand', w: w2, data: { ticket: w2.pending[0].ticket, op: 'jobs', args: [] } })
  assert.equal(r.ok, false); assert.equal(r.drop, 'forged'); assert.equal(w2.pending.length, 1, 'the ticket keeps its deadline')
  assert.equal(s.handsGate.drops.forged, 1)
  assert.ok(w2.thoughts.some((x) => /reply dropped \(forged/.test(x.text)))
})

// spec: design §6 change 1 ("without the socket the caller falls back") · eng §3.2 row 3
// class: J9 ENOENT (no socket file); M3 a stale path
// technique: boundary: a path that does not exist
// method: handsPresent is false; sendToHands answers ok false with the connect error, never throws, and thinks it
// sre: if the hands daemon is not running, does the foreman learn that in one sentence and keep the ticket?
test('no socket: handsPresent is false and the hop says so', async () => {
  assert.equal(handsPresent('/nonexistent/h.sock'), false)
  const s = new Supervisor({ ...host(), key: KEY })
  const w = fileRun(s, { key: 'r-x', goal: 'g' }); const i = intent(s, w.id, { tool: 'jobs' })
  const r = await sendToHands({ sup: s, sock: '/nonexistent/h.sock', key: KEY, kind: 'hand', w, data: { ticket: i.ticket, op: 'jobs' } })
  assert.equal(r.ok, false); assert.match(r.why, /ENOENT|connect/)
  assert.ok(w.thoughts.some((x) => /the hands did not answer/.test(x.text)))
})

// spec: design §6 change 3 (the contract's one writer is the hands: `(kind contract) (body (run <id>) (text …))`) · eng §3.2 row 3
// class: E9 a message lost (no answer, a dropped reply, a refusal with and without why)
// technique: a scratch hands socket answering four ways, then none
// method: writeContract: ok with path and sha; refused "bad" (exit 12, its why); refused with no why and no body; a forged
//         reply (dropped); no socket; every failure is a thought on the run, never a throw
// sre: if the contract cannot be written, does the run's record say why while the run goes on?
test('the contract goes to the hands as a contract message for run <id>, and a refusal, a drop or no hands is thought, never thrown', async (t) => {
  const seen = []
  const sock = await served(t, (got) => {
    seen.push(got.msg); const text = got.msg.body.text
    if (text === 'forge') return reply({ exit: 0 }, { key: 'x'.repeat(32) })
    if (text === 'bare') return reply(null)
    return reply({ ticket: null, exit: text.includes('bad') ? 12 : 0, why: text.includes('bad') ? 'outside runs/' : undefined, path: '/runs/x/CONTRACT.slat', sha: 'abc' })
  })
  const s = new Supervisor({ ...host(), key: KEY })
  const w = fileRun(s, { key: 'r-c', goal: 'g' })
  const r = await writeContract({ sup: s, sock, key: KEY, w, text: renderContract(w.contract) })
  assert.deepEqual(r, { ok: true, path: '/runs/x/CONTRACT.slat', sha: 'abc' }); assert.equal(seen[0].kind, 'contract'); assert.equal(seen[0].body.run, w.id); assert.match(seen[0].body.text, /^\(task-state /)
  assert.deepEqual(await writeContract({ sup: s, sock, key: KEY, w, text: 'bad' }), { ok: false, why: 'outside runs/' })
  assert.equal((await writeContract({ sup: s, sock, key: KEY, w, text: 'bare' })).ok, false)
  assert.equal((await writeContract({ sup: s, sock, key: KEY, w, text: 'forge' })).ok, false)
  assert.equal((await writeContract({ sup: s, sock: '/nonexistent/h.sock', key: KEY, w, text: 'x' })).ok, false)
  const th = w.thoughts.map((x) => x.text).join('\n')
  assert.match(th, /contract not written: outside runs/); assert.match(th, /contract not written: refused/); assert.match(th, /reply dropped \(forged\)/); assert.match(th, /the hands did not answer/)
})

// spec: eng §3.5 ("hands hop wait: deadline + 15 s"; act deadline 600 s or the header's per-op) · design §6 change 1 (tier J1 for an act; pressed, pressed_by) · law 4
// class: J18 a Promise that never settles (a hands daemon that never answers); E8 a deadline passed
// technique: boundary on the deadlines (a per-op act deadline, the default act deadline) and a hands that hangs past `timeoutMs`
// method: send an act `pass` (per-op 900 s, J1, pressed by owner, touches from the cart, repo from the run) and an act `merge`
//         (the default 40 s); read the fields the hands saw; then a hands that hangs 300 ms with timeoutMs 50: ok false "no reply in 50 ms"
// sre: if the hands hang, does the foreman's hop end on its own clock, and does every act carry its press and its deadline?
test('an act carries its per-op deadline, J1, the press and its touches; a hands that never answers ends at timeoutMs', async (t) => {
  const seen = []
  const sock = await served(t, (got) => { seen.push(got.msg); return got.msg.body.op === 'slow' ? { hang: 300 } : reply({ ticket: got.msg.body.ticket, exit: 0 }) })
  const s = new Supervisor({ ...host(), key: KEY })
  const w = { id: 'w-act', name: 'act-cart', run: undefined, cart: { touches: ['repo:x'] }, contract: { key: 'k-c' }, thoughts: [] }
  const got = []
  await sendToHands({ sup: s, sock, key: KEY, kind: 'act', w, from: 'foreman:test', data: { ticket: 't1', op: 'pass', pressed: true, pressed_by: 'owner' }, deliver: (v) => got.push(v) })
  await sendToHands({ sup: s, sock, key: KEY, kind: 'act', w: { ...w, jailTier: 'J2', cart: undefined }, data: { ticket: 't2', op: 'merge', touches: ['a'], repo: 'r' }, deliver: (v) => got.push(v) })
  assert.deepEqual([seen[0].from, seen[0].body.deadline, seen[0].body.tier, seen[0].body.pressed, seen[0].body.pressed_by, seen[0].body.key], ['foreman:test', 900, 'J1', true, 'owner', 'k-c'])
  assert.deepEqual(seen[0].body.touches, ['repo:x'])
  assert.deepEqual([seen[1].body.deadline, seen[1].body.tier, seen[1].body.pressed, seen[1].body.pressed_by, seen[1].body.repo], [40, 'J2', false, null, 'r'])
  assert.deepEqual(got.map((v) => [v.ticket, v.ok]), [['t1', true], ['t2', true]])
  const t0 = Date.now()
  const r = await sendToHands({ sup: s, sock, key: KEY, kind: 'hand', w, data: { ticket: 't3', op: 'slow' }, timeoutMs: 50 })
  assert.equal(r.ok, false); assert.match(r.why, /no reply in 50 ms/); assert.ok(Date.now() - t0 < 300)
})

// spec: design §7.3 (`result` fields; exit missing is not success) · eng §3.3 · law 6 (a claim is not a record)
// class: W5 malformed (a reply of another kind; a result with no body); E11 an orphan (the worker gone before its reply)
// technique: state-machine walk over the reply: kind health, result with null body, a deliver that throws, a worker that
//            stopped, a run's result whose delivery throws (a host whose mail throws on the I-03 path); each throw also as a
//            bare string (not an Error)
// method: each case's return and the worker's thought; a null body is ok false (exit 30 by default), never success
// sre: if the hands answer oddly or the worker died meanwhile, is the answer recorded as what it is and nothing crashes?
test('odd replies: another kind, a null body (not ok), a deliver that throws, a stopped worker (late), a delivery that throws (a thought)', async (t) => {
  const sock = await served(t, (got) => {
    const op = got.msg.body.op
    if (op === 'health') return reply({ lag: 0 }, { kind: 'health' })
    if (op === 'nobody') return reply(null)
    if (op === 'outside') return reply({ ticket: got.msg.body.ticket, exit: 12, rule: 'touched-outside', why: 'wrote /etc' })
    return reply({ ticket: got.msg.body.ticket, exit: 0 })
  })
  const s = new Supervisor({ ...host({ mail: () => { throw new Error('the mail dir is gone') } }), key: KEY })
  const w = s.spawn({ name: 'c', program: "(on 'hand (lambda (r) (remember 'ok (get r 'ok))))", verbs: ['remember'] })
  assert.deepEqual(await sendToHands({ sup: s, sock, key: KEY, kind: 'hand', w, data: { ticket: 'a', op: 'health' } }), { ok: false, why: 'kind health' })
  let v = null
  await sendToHands({ sup: s, sock, key: KEY, kind: 'hand', w, data: { ticket: 'b', op: 'nobody' }, deliver: (x) => { v = x } })
  assert.equal(v.ok, false, 'no exit is not success'); assert.equal(v.ticket, 'b')
  const thrown = await sendToHands({ sup: s, sock, key: KEY, kind: 'hand', w, data: { ticket: 'c', op: 'x' }, deliver: () => { throw new Error('the reader went away') } })
  assert.deepEqual(thrown, { ok: false, why: 'the reader went away' })
  // eslint-disable-next-line no-throw-literal
  const words = await sendToHands({ sup: s, sock, key: KEY, kind: 'hand', w, data: { ticket: 'c2', op: 'x' }, deliver: () => { throw 'plain words' } })
  assert.deepEqual(words, { ok: false, why: 'plain words' }, 'a thrown string is said as it is')
  s.stop(w.id, 'test')
  assert.deepEqual(await sendToHands({ sup: s, sock, key: KEY, kind: 'hand', w, data: { ticket: 'd', op: 'x' } }), { ok: true, exit: 0, late: true })
  const run = fileRun(s, { key: 'r-o', goal: 'g', hands: ['disk'] }); const i = intent(s, run.id, { tool: 'disk' })
  const r = await sendToHands({ sup: s, sock, key: KEY, kind: 'hand', w: run, data: { ticket: i.ticket, op: 'outside' } })
  assert.equal(r.ok, false); assert.match(r.why, /the mail dir is gone/)
  assert.ok(run.thoughts.some((x) => /the reply could not be delivered \(the mail dir is gone\)/.test(x.text)))
  // eslint-disable-next-line no-throw-literal
  const s2 = new Supervisor({ ...host({ mail: () => { throw 'disk full' } }), key: KEY })
  const run2 = fileRun(s2, { key: 'r-o2', goal: 'g', hands: ['disk'] }); const i2 = intent(s2, run2.id, { tool: 'disk' })
  assert.deepEqual(await sendToHands({ sup: s2, sock, key: KEY, kind: 'hand', w: run2, data: { ticket: i2.ticket, op: 'outside' } }), { ok: false, why: 'disk full' })
  assert.ok(run2.thoughts.some((x) => /could not be delivered \(disk full\)/.test(x.text)))
})


// spec: carts read a reply's answer as (get r 'result …) (lacuna-foreman/carts: backup, cart-lint, ci-cd, cleanup, queue…); the
//       hands answer rows, text or tail (lacuna-executor/hands.mjs shape). K0 2026-10-30: Gemini's alias kept, made sound.
// class: W5 malformed (a reply with no answer field must not plant an undefined `result`)
// technique: two signed replies through a scratch socket, read at `deliver`
// method: rows → `result` is the rows; text only → `result` is the text; why only → no `result` key at all
// sre: does a cart that reads 'result see the hands' answer, and keep its own default when there is none?
test('a reply\'s rows, text or tail ride as result; a reply with none carries no result key', async (t) => {
  const bodies = [{ exit: 0, status: null, ms: 1, rows: { bundles: ['a'] } }, { exit: 0, status: null, ms: 1, text: 'ok' }, { exit: 12, status: null, ms: 1, why: 'refused' }]
  let i = 0
  const sock = await served(t, (got) => reply({ ticket: got.msg.body.ticket, ...bodies[i++] }))
  const s = new Supervisor({ ...host(), key: KEY })
  const w = s.spawn({ name: 'reader', program: "(on 'hand (lambda (r) r))" })
  const got = []
  for (let n = 0; n < bodies.length; n++) await sendToHands({ sup: s, sock, key: KEY, kind: 'hand', w, data: { ticket: `t-${n}`, op: 'disk' }, deliver: (v) => got.push(v) })
  assert.deepEqual(got[0].result, { bundles: ['a'] })
  assert.equal(got[1].result, 'ok')
  assert.equal('result' in got[2], false)
  assert.equal(got[2].ok, false)
})
