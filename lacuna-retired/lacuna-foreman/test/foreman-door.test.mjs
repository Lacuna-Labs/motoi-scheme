// foreman-door.test.mjs — U3: THE DOOR'S WORKER ROUTES AND ITS GATE. Owns: the tests that speak to one scratch foreman's
// door (TCP and socket) as the desk, the API and a stranger do: `/health`, `/workers` (list, spawn, get, delete), `/tree`,
// `/check`, `/workers/<id>/event|talk|interrupt|thoughts`, the slat gate on the door (`application/slat`, `X-Slat-Sig`), the
// body limits and a body that is not JSON. Refuses: the live foreman; a mock of foreman.mjs or of the gate.
// Implements: unit-test work order §3 row foreman.mjs (design §6 change 6 the door on socket + port, token, slat reply; §11
// constant-time compare; §13 what the desk reads; eng §3.1 the gate's order, §3.2 rows 1, 8, 13; laws 5, 7).
// Invariants (§18): "if an envelope is unsigned, forged, stale, replayed or malformed, then it was dropped and
// /health.dropped counted it"; "if the desk shows a number, then the viewer proved a principal". Faults (§16): F-10, F-20.
// coverage: foreman.mjs — lines 100% branches 98.17% functions 100% (full suite, 2026-10-24; the unreached arms are named as test.todo)
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { boot, request, seal, now, PROBE, until } from './foreman-box.mjs'
import { Gate } from '../protocol.mjs'

const cleanups = []
let f
before(async () => { ({ f } = await boot({ after: (fn) => cleanups.push(fn) }, { tag: 'door' })) })
after(async () => { for (const fn of cleanups.reverse()) await fn() })
const spawnProbe = async (name = 'probe', extra = {}) => (await f.call('POST', '/workers', { name, program: PROBE, ...extra })).body.worker
const slatCall = (method, p, msg, { sig, key, headers = {} } = {}) => {
  const env = seal(key || f.token(), { from: 'brain', to: 'foreman', at: now(), ...msg })
  return f.call(method, p, env.slat, { headers: { 'content-type': 'application/slat', 'x-slat-sig': sig ?? env.sig, ...headers } })
}
const dropped = async () => (await f.call('GET', '/health')).body.dropped

// spec: design §6 change 6 (slat on the wire; replies are signed (msg …)) · eng §3.2 rows 1, 8 · law 5
// class: W8 a reply that cannot be sealed (here: the reply is sealed, kind by status)
// technique: state-machine walk over the reply form: TCP plain, TCP with Accept slat (named and unnamed caller), socket
// method: ask /health three ways and /workers/<missing> over the socket; open each slat reply at a Gate with the token: a
//         2xx is kind reply, a 404 kind refused, `to` is the caller's X-Lacuna-Who (40 chars at most) or `lacuna`
// sre: if the brain loop and the door speak slat, can every answer be verified, and is a refusal never mistaken for a reply?
test('the door answers JSON to a plain caller and a signed (msg …) to the socket or an Accept slat caller: reply on 2xx, refused otherwise', async () => {
  const open = (r) => new Gate(f.token(), now).open({ slat: r.text, sig: r.headers['x-slat-sig'] })
  const plain = await f.call('GET', '/health')
  assert.match(plain.headers['content-type'], /^application\/json/); assert.equal(plain.body.foreman, 'burn')
  const named = await request({ host: '127.0.0.1', port: f.port, method: 'GET', path: '/health', headers: { 'X-Foreman-Token': f.token(), accept: 'application/slat', 'x-lacuna-who': `door:${'x'.repeat(60)}` } })
  const o1 = open(named); assert.equal(o1.ok, true); assert.equal(o1.msg.kind, 'reply'); assert.equal(o1.msg.to, `door:${'x'.repeat(35)}`)
  const sock = await request({ socketPath: f.sock, method: 'GET', path: '/workers/w-none', headers: { 'X-Foreman-Token': f.token() } })
  const o2 = open(sock); assert.equal(sock.status, 404); assert.equal(o2.msg.kind, 'refused'); assert.equal(o2.msg.to, 'lacuna'); assert.equal(o2.msg.body.why, 'no such worker')
})

// spec: eng §3.1 (the gate's order: unsigned → malformed(size) → forged → malformed(shape) → stale → replayed) · I-05 · F-10 · design §6 change 6
// class: W9 the order of drops (and W1 W2 W3 W4 W5 at the door)
// technique: fault injection, one envelope per drop, against the live counter
// method: POST /check as slat: no sig; a forged sig; a stale `at` (now − 200 s); the same envelope twice; a malformed body
//         (a symbol); each 401 with "dropped (<kind>)"; /health.dropped counts each once; a good one answers 200
// sre: if a stranger or a broken clock writes to the door, is every bad envelope dropped, counted once, and nothing run?
test('the door\'s gate drops unsigned, forged, stale, replayed and malformed slat with 401, each counted once on /health', async () => {
  const d0 = await dropped()
  const prog = { program: PROBE }
  const r1 = await f.call('POST', '/check', seal(f.token(), { from: 'b', to: 'f', kind: 'check', body: prog, at: now() }).slat, { headers: { 'content-type': 'application/slat' } })
  assert.equal(r1.status, 401); assert.match(r1.body.why, /dropped \(unsigned\)/)
  assert.match((await slatCall('POST', '/check', { kind: 'check', body: prog }, { key: 'k'.repeat(48) })).body.why, /dropped \(forged\)/)
  assert.match((await slatCall('POST', '/check', { kind: 'check', body: prog, at: now() - 200 })).body.why, /dropped \(stale\)/)
  const env = seal(f.token(), { from: 'b', to: 'f', kind: 'check', body: prog, at: now() })
  const h = { 'content-type': 'application/slat', 'x-slat-sig': env.sig }
  assert.equal((await f.call('POST', '/check', env.slat, { headers: h })).status, 200)
  assert.match((await f.call('POST', '/check', env.slat, { headers: h })).body.why, /dropped \(replayed\)/)
  const bad = `(msg (v 1) (from "b") (to "f") (kind check) (at ${now()}) (nonce "0123456789abcdef") (body sym))`
  const sig = (await import('node:crypto')).createHmac('sha256', f.token()).update(bad).digest('hex')
  const r5 = await f.call('POST', '/check', bad, { headers: { 'content-type': 'application/slat', 'x-slat-sig': sig } })
  assert.equal(r5.status, 401); assert.match(r5.body.why, /dropped \(malformed\)/)
  const d1 = await dropped()
  for (const k of ['unsigned', 'forged', 'stale', 'replayed', 'malformed']) assert.equal(d1[k] - (d0[k] || 0), 1, k)
})

// spec: eng §3.1 (a body ≤ 256,000 chars; a program ≤ 64 KB) · eng §3.5 (envelope size) · foreman.mjs EVENT_BYTES
// class: J10 HTTP body too large; J7 JSON.parse on hostile input
// technique: boundary (a body over the route's limit) and a body that is not JSON
// method: POST /check with 129 KB (over programBytes × 2); POST /workers with `{` ; a slat body that is a list, then a string;
//         an empty body; a POST with no body and no content type; a JSON null as an event: 400 "too large", 400 with the
//         parse error, 200 with the body read as {}, 422 from the route itself, 400 for the null
// sre: if a client sends a huge or broken body, is it refused with a sentence instead of eating the foreman's memory?
test('a body over the route\'s limit or not JSON is a 400 with a sentence; a slat body that is not an object reads as {}', async () => {
  const big = await f.call('POST', '/check', { program: 'x'.repeat(130_000) })
  assert.equal(big.status, 400); assert.equal(big.body.why, 'too large')
  const broken = await f.call('POST', '/workers', '{', { headers: { 'content-type': 'application/json' } })
  assert.equal(broken.status, 400); assert.match(broken.body.why, /JSON/)
  const list = await slatCall('POST', '/check', { kind: 'check', body: [1, 2] })
  assert.equal(list.status, 200); assert.equal(list.body.ok, false, 'no program: the trial says so')
  const empty = await f.call('POST', '/broker/swapped', '', { headers: { 'content-type': 'application/json' } })
  assert.equal(empty.status, 200); assert.equal(empty.body.why, 'no swap in flight')
  const text = await slatCall('POST', '/check', { kind: 'check', body: 'just words' })
  assert.equal(text.status, 200); assert.equal(text.body.ok, false, 'a body that is a string reads as {}')
  const bare = await f.call('POST', '/mail')                                  // no body, no content type
  assert.equal(bare.status, 422); assert.equal(bare.body.why, 'a letter says what')
  const nul = await f.call('POST', `/workers/w-x/event`, 'null', { headers: { 'content-type': 'application/json' } })
  assert.equal(nul.status, 400, 'a JSON null where an event goes is a 400, never a crash')
})

// spec: design §13 (what the desk reads: workers, the tree) · design §6 (a list is swept first, §45.3) · I-10
// class: E7 a zombie (never listed as running)
// technique: state-machine walk: spawn, list, tree, get, delete, list again
// method: spawn two probes (one with verbs, reads_untrusted and a packet; one plain); /workers lists running first;
//         /tree has both nodes and the spawn events; GET one; DELETE it with and without `by`; it lists as retired
// sre: if the desk polls the list, does it see exactly the workers that live, newest first, and a stopped one as stopped?
test('spawn, list, tree, get and delete: running first, the tree has every node, a deleted worker lists as retired with who stopped it', async () => {
  const a = await spawnProbe('lister-a', { verbs: ['on', 'report', 'remember', 'recall'], reads_untrusted: true, packet: { goal: 'g' }, by: 'test' })
  const b = await spawnProbe('lister-b', { verbs: 'not-a-list', packet: 'not-an-object' })
  assert.equal(a.reads_untrusted, true); assert.equal(a.by, 'test'); assert.equal(a.packet.goal, 'g'); assert.equal(b.by, 'lacuna'); assert.equal(b.packet, null)
  assert.equal((await f.call('DELETE', `/workers/${a.id}?by=desk`)).body.ok, true)
  assert.equal((await f.call('DELETE', `/workers/${b.id}`)).body.ok, true)
  const c = await spawnProbe('lister-c')
  const ws = (await f.call('GET', '/workers')).body.workers
  const names = ws.map((w) => w.name)
  assert.ok(names.indexOf('lister-c') < names.indexOf('lister-a'), 'running first')
  assert.equal(ws.find((w) => w.id === a.id).state, 'retired'); assert.match(ws.find((w) => w.id === a.id).last, /stopped by desk/)
  assert.match(ws.find((w) => w.id === b.id).last, /stopped by lacuna/)
  const tree = (await f.call('GET', '/tree')).body
  assert.ok([a.id, b.id, c.id].every((id) => tree.nodes.some((n) => n.id === id)))
  assert.ok(Array.isArray(tree.events) && tree.events.length > 0)
  assert.equal((await f.call('GET', `/workers/${c.id}`)).body.worker.name, 'lister-c')
})

// spec: design §6 (a spawn that cannot load is refused with a sentence) · design §11 (capabilities only shrink; literal spawn)
// class: E1 a handler throws (at load: the grave); J7 a hostile program
// technique: fault injection (a program that throws at load; no program at all)
// method: POST /workers with a program whose load throws → 422 with the worker grave and `why`; with no program → 400
// sre: if someone spawns a broken program, does the door say so in a sentence and leave the foreman serving?
test('a program that throws at load is 422 with its grave and why; no program at all is 400', async () => {
  const g = await f.call('POST', '/workers', { name: 'broken', program: "(car '())" })
  assert.equal(g.status, 422); assert.equal(g.body.ok, false); assert.equal(g.body.worker.state, 'grave'); assert.ok(g.body.why)
  const n = await f.call('POST', '/workers', { name: 'none' })
  assert.equal(n.status, 400); assert.match(n.body.why, /needs a program/)
  assert.equal((await f.call('GET', '/health')).status, 200)
})

// spec: eng §3.2 row 13 (the event's sealed {slat, sig} wrapper opened at the same gate as row 1) · I-05 · F-10 · law 7
// class: W2 forged (row 13); W6 a wrong `to`
// technique: fault injection on the wrapper (a wrong key; a `to` naming another worker) and the log line it leaves
// method: send a signed ping (200, kv n=1); a forged one with X-Lacuna-Who; one over the socket with no who; one sealed to
//         another worker; read 401 for each bad one, the drop log line naming the sender and the keys, never the body
// sre: if events arrive for the wrong worker or with the wrong key, is nothing delivered and does the log say who sent it?
test('a worker\'s event: signed is delivered; forged or addressed to another worker is 401 and the log names the sender, not the body', async () => {
  const w = await spawnProbe('evt')
  assert.equal((await f.event(w.id, 'ping', 1)).status, 200)
  assert.equal((await f.call('GET', `/workers/${w.id}`)).body.worker.kv.n, 1)
  const forged = await f.call('POST', `/workers/${w.id}/event`, seal('k'.repeat(48), { from: 'lacuna', to: w.id, kind: 'ping', body: 'SECRET-BODY', at: now() }), { headers: { 'x-lacuna-who': 'stranger' } })
  assert.equal(forged.status, 401)
  const other = await f.call('POST', `/workers/${w.id}/event`, { ...seal(f.token(), { from: 'lacuna', to: 'w-else', kind: 'ping', body: 1, at: now() }), kind: 'ping' }, { uds: true })
  assert.equal(other.status, 401)
  const lines = f.log.filter((l) => l.includes('dropped at the door'))
  assert.ok(lines.some((l) => l.includes('from stranger') && l.includes('keys slat sig')))
  assert.ok(lines.some((l) => l.includes('from socket') && l.includes('kind ping')))
  assert.equal(f.log.some((l) => l.includes('SECRET-BODY')), false)
  assert.equal((await f.call('GET', `/workers/${w.id}`)).body.worker.kv.n, 1, 'nothing was delivered')
})

// spec: design §13 (`thoughts`, `interrupt`, `say`) · eng §3.2 row 13 (`/workers/<id>/talk`, `/interrupt`) · law 7 · I-11 (who is a label)
// class: W6 a wrong `to`; W5 malformed (a talk that is not a talk)
// technique: state-machine walk over the talk door: forged, wrong kind, wrong to, wrong from, no worker, good (no mind: the program answers)
// method: each case's status (401, 400, 400, 400, 404, 200 by program; an empty talk 200); the worker's thoughts carry the
//         talk; interrupt pause 200, an unknown mode 409, an unknown worker 404; thoughts of a missing worker 404; a paused
//         run's contract says paused
// sre: if a talk or an interrupt comes for the wrong worker or from the wrong sender, is it refused before it reaches the program?
test('talk, interrupt and thoughts: only a signed (talk …) from lacuna to this worker is heard; interrupts answer 200, 409 or 404', async () => {
  const w = await spawnProbe('talker')
  const talk = (o, key) => f.call('POST', `/workers/${o.to ?? w.id}/talk`, seal(key || f.token(), { from: o.from ?? 'lacuna', to: o.sealTo ?? w.id, kind: o.kind ?? 'talk', body: o.body ?? { text: 'how are you', who: 'the owner' }, at: now() }))
  assert.equal((await talk({}, 'k'.repeat(48))).status, 401)
  assert.equal((await talk({ kind: 'ping' })).status, 400)
  assert.equal((await talk({ sealTo: 'w-else' })).status, 400)
  assert.equal((await talk({ from: 'stranger' })).status, 400)
  assert.equal((await talk({ to: 'w-none', sealTo: 'w-none' })).status, 404)
  const ok = await talk({ body: {} })
  assert.equal(ok.status, 200); assert.equal(ok.body.by, 'program'); assert.ok(ok.body.reply)
  const nobody = await f.call('POST', `/workers/${w.id}/talk`, seal(f.token(), { from: 'lacuna', to: w.id, kind: 'talk', body: null, at: now() }))
  assert.equal(nobody.status, 200, 'a talk with no body is an empty talk')
  const th = await f.call('GET', `/workers/${w.id}/thoughts?n=5`)
  assert.equal(th.status, 200); assert.ok(th.body.items.length <= 5)
  assert.ok((await f.call('GET', `/workers/${w.id}/thoughts`)).body.items.some((x) => /the owner:/.test(x.text)))
  assert.equal((await f.call('GET', '/workers/w-none/thoughts')).status, 404)
  assert.equal((await f.call('POST', `/workers/${w.id}/interrupt`, { mode: 'pause' })).status, 200)
  assert.equal((await f.call('POST', `/workers/${w.id}/interrupt`, { mode: 'sideways', by: 'desk' })).status, 409)
  assert.equal((await f.call('POST', '/workers/w-none/interrupt', {})).status, 404)
  const run = (await f.call('POST', '/runs', { key: 'paused-run', goal: 'g' })).body.run
  assert.equal((await f.call('POST', `/workers/${run}/interrupt`, { mode: 'pause' })).status, 200)
  assert.match((await f.call('GET', `/contracts/${run}`)).text, /\(state "paused"\)/, 'a paused run\'s contract says paused')
})

// spec: design §12 (carts proven before a press: the trial) · eng §3.2 (the door's `/check`)
// class: J7 hostile input (a program that is not a program)
// technique: boundary: a good program, a program the reader refuses
// method: POST /check with a good program (ok), PROBE (its throwing 'boom named) and an unbalanced form (not ok); nothing spawns
// sre: if a cart is checked before a press, is the answer a verdict and never a running worker?
test('/check runs the trial only: a good program is ok, a broken one says why, and nothing is spawned', async () => {
  const before = (await f.call('GET', '/health')).body.total
  assert.equal((await f.call('POST', '/check', { program: "(on 'ping (lambda (x) (report 'pong 1)))" })).body.ok, true)
  assert.match((await f.call('POST', '/check', { program: PROBE })).body.problems.join(' '), /boom/, 'a handler that throws is named')
  const bad = (await f.call('POST', '/check', { program: '(on \'x' })).body
  assert.equal(bad.ok, false); assert.ok(bad.why || bad.problems)
  assert.equal((await f.call('GET', '/health')).body.total, before)
})

// spec: design §6 change 6 (one door, two carriers) · eng §3.2 (the door's routes) · law 5
// class: W5 malformed (a route that does not exist)
// technique: boundary on the route table
// method: GET /nothing and POST /runs/<id>/nothing; read 404 "no such door" in both
// sre: if a client misspells a route, is it told so instead of a silent 200?
test('an unknown route is 404 "no such door", including an unknown run verb', async () => {
  assert.deepEqual((await f.call('GET', '/nothing')).body, { ok: false, why: 'no such door' })
  const run = (await f.call('POST', '/runs', { key: 'nd', goal: 'g' })).body.run
  assert.equal((await f.call('POST', `/runs/${run}/nothing`, {})).status, 404)
  assert.ok(await until(async () => (await f.call('GET', '/health')).status === 200))
})

