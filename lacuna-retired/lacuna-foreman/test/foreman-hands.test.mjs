// foreman-hands.test.mjs — U3: THE ROOT'S ROADS TO THE HANDS. Owns: the tests that put a scratch hands socket (an
// in-test UDS server speaking signed slat with the foreman's token) beside a scratch foreman and read what crosses: a run's
// hand and act through `upstream`, the contract to its one writer (debounced), the grant and revoke doors, the broker's
// swap act and its reply, and the retiring road when FOREMAN_HANDS=python or no socket is there. Refuses: the live hands
// (~/.lacuna/hands.sock); a mock of foreman.mjs or hands-link.mjs. Implements: unit-test work order §3 rows foreman.mjs and
// hands-link.mjs (design §6 change 1 the foreman asks the hands, signed both ways; change 3 the contract's one writer;
// §10 the swap is an act; eng §3.2 rows 3, 6; §3.5 contract write debounced 500 ms). Invariants (§18): "dropped and
// counted" (the reply gate); "if the brain is the 12B, then the 26B is not resident" (the swap records who). Faults (§16): F-01, F-05, F-10.
// coverage: foreman.mjs — see foreman-door.test.mjs; hands-link.mjs — see hands-link.test.mjs (2026-10-24)
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { boot, scratch, seal, now, until, sleep, kinds } from './foreman-box.mjs'
import { Gate } from '../protocol.mjs'

/** A hands daemon in this process: every signed request is opened with the token file's key; `answer(msg)` says the reply. */
function fakeHands(sock, tokenFile, answer) {
  const seen = []
  const srv = http.createServer((req, res) => {
    let text = ''; req.setEncoding('utf8'); req.on('data', (d) => { text += d })
    req.on('end', async () => {
      const key = fs.readFileSync(tokenFile, 'utf8').trim()
      const got = new Gate(key, now).open({ slat: text, sig: req.headers['x-slat-sig'] })
      seen.push(got.ok ? got.msg : { drop: got.drop })
      const a = (await answer(got.msg || {})) || {}
      if (a.hang) await sleep(a.hang)
      const out = seal(a.forge ? 'k'.repeat(48) : key, { from: 'hands', to: 'foreman', kind: a.kind || 'result', body: a.body ?? { ticket: got.msg?.body?.ticket ?? null, exit: 0 }, at: now() })
      res.writeHead(200, { 'Content-Type': 'application/slat', 'X-Slat-Sig': out.sig }); res.end(out.slat)
    })
  })
  return new Promise((r) => srv.listen(sock, () => r({ seen, close: () => new Promise((c) => { srv.closeAllConnections?.(); srv.close(() => c()) }) })))
}
async function withHands(t, answer, env = {}) {
  const dir = scratch('hands'); const sock = path.join(dir, 'h.sock')
  const { f, door } = await boot(t, { dir, env: { LACUNA_HANDS_SOCK: sock, ...env } })
  const h = await fakeHands(sock, path.join(dir, 'token'), answer)
  t.after(() => h.close())
  return { f, door, h, dir }
}

// spec: design §6 change 1 (a hand goes to lacuna-executor over its socket, signed; the reply comes back in the same hop) · eng §3.2 row 3 · §3.3
// class: E9 a message lost (what the sender sees when the hands answer, fail, or forge)
// technique: a scratch hands socket answering three ways: a good result, a forged reply, a reply of another kind
// method: file a run with three reads; intent each; read result 1 landed (exit 0, rows); the forged one never lands and the
//         foreman logs "via hands: …"; the other kind never lands; the hands saw kind hand, tier J0, run = the run id
// sre: if the hands answer, forge or say something else, does only a true signed result reach the run?
test('a run\'s hand goes to the hands socket signed; a signed result lands as result 1; a forged or foreign reply never lands and is logged', async (t) => {
  const { f, h } = await withHands(t, (m) => (m.body?.op === 'jobs' ? { forge: true } : m.body?.op === 'repos' ? { kind: 'health' } : { body: { ticket: m.body.ticket, exit: 0, rows: { free_gb: 12 } } }))
  const run = (await f.call('POST', '/runs', { key: 'hr', goal: 'g', hands: ['disk', 'jobs', 'repos'] })).body.run
  for (const tool of ['disk', 'jobs', 'repos']) assert.equal((await f.call('POST', `/runs/${run}/intents`, { tool }, {})).status, 200)
  assert.ok(await until(async () => (await f.call('GET', `/runs/${run}/results`)).body.results.length === 1))
  await until(() => f.log.filter((l) => / via hands: /.test(l)).length >= 2)
  const r1 = (await f.call('GET', `/runs/${run}/results/1`)).body
  assert.equal(r1.value.rows.free_gb, 12); assert.equal(r1.tool, 'disk')
  assert.ok(f.log.some((l) => /hand jobs via hands: /.test(l))); assert.ok(f.log.some((l) => /hand repos via hands: kind health/.test(l)))
  const sent = h.seen.find((m) => m.body?.op === 'disk')
  assert.deepEqual([sent.kind, sent.body.tier, sent.body.run, sent.body.key], ['hand', 'J0', run, 'hr'])
  assert.equal((await f.call('GET', '/health')).body.dropped.forged ?? 0, 0, 'the door\'s gate is not the hands\' gate')
})

// spec: design §6 change 3 (the contract's one writer is the hands) · eng §3.5 ("contract write: debounced 500 ms, the last text wins")
// class: J6 a timer doubled (the debounce); J18 a hop that never answers
// technique: a scratch hands socket that counts contract messages; a burst of contract changes inside 500 ms
// method: file a run and change its contract three times quickly (intent, said, said): the hands get one contract per
//         burst carrying the last text; then the hands refuse (exit 12) and the foreman logs "not written: <why>"
// sre: if a run writes its contract many times a second, does the disk see the last state once, and a refusal in the log?
test('the contract goes to the hands once per 500 ms burst with the last text; a refusal is logged, never thrown', async (t) => {
  let refuse = false
  const { f, h } = await withHands(t, (m) => (m.kind === 'contract' ? { body: refuse ? { exit: 12, why: 'outside runs/' } : { exit: 0, path: 'x', sha: 'y' } } : { body: { ticket: m.body.ticket, exit: 0 } }))
  const run = (await f.call('POST', '/runs', { key: 'cw', goal: 'g', hands: ['disk'] })).body.run
  await f.call('POST', `/runs/${run}/said`, { text: 'one' }); await f.call('POST', `/runs/${run}/said`, { text: 'I will read the disk' })
  assert.ok(await until(() => h.seen.some((m) => m.kind === 'contract')))
  await sleep(700)
  const cs = h.seen.filter((m) => m.kind === 'contract')
  assert.equal(cs.length, 1, 'one write for the burst'); assert.equal(cs[0].body.run, run); assert.match(cs[0].body.text, /I will read the disk/)
  refuse = true
  await f.call('POST', `/runs/${run}/said`, { text: 'I will look again' })
  assert.ok(await until(() => f.log.some((l) => l.includes(`contract ${run} not written: outside runs/`))))
})

// spec: design §11 (grants: the hands verify the owner's HMAC and keep the rows) · eng §3.2 row 3 (kinds grant · revoke)
// class: E9 a message lost (no hands; a refusal; a forged reply)
// technique: a scratch hands socket that grants, refuses, forges; then no socket at all
// method: POST /grants (200 with the hands' answer); DELETE /grants/<id> (revoke, 200); a refusal (422); a forged reply
//         (422, why names the drop); with no socket: 422 "the hands are not up: no grant can be checked"
// sre: if a grant cannot be checked by the hands, is it refused rather than assumed?
test('grants go to the hands as grant and revoke; a refusal or a forged reply is 422; with no hands, no grant is taken', async (t) => {
  let mode = 'ok'
  const { f, h, dir } = await withHands(t, () => (mode === 'forge' ? { forge: true } : { body: { ticket: null, exit: mode === 'ok' ? 0 : 12, why: mode === 'ok' ? undefined : 'bad signature' } }))
  const g = await f.call('POST', '/grants', { run: 'r', cap: 'git-push', scope: 'lacuna/*', sig: 'x' })
  assert.equal(g.status, 200); assert.equal(h.seen.at(-1).kind, 'grant'); assert.equal(h.seen.at(-1).body.args.cap, 'git-push')
  assert.equal((await f.call('DELETE', '/grants/g-1')).status, 200); assert.equal(h.seen.at(-1).kind, 'revoke'); assert.equal(h.seen.at(-1).body.args.id, 'g-1')
  mode = 'no'; assert.equal((await f.call('POST', '/grants', {})).status, 422); assert.equal((await f.call('DELETE', '/grants/g-2')).status, 422)
  mode = 'forge'; const fg = await f.call('POST', '/grants', {}); assert.equal(fg.status, 422); assert.match(fg.body.why, /signature|forged/)
  fs.rmSync(path.join(dir, 'h.sock'))
  const none = await f.call('POST', '/grants', {})
  assert.equal(none.status, 422); assert.equal(none.body.why, 'the hands are not up: no grant can be checked')
})


// spec: design §10 (the swap is an act the hands do; the broker emits it and records the reply) · K-7 · eng §3.2 row 3 · §18 "the 12B → the 26B not resident"
// class: E9 a message lost (the swap act's reply: ok, failed, no hands)
// technique: a scratch hands socket answering the switch-brain act; then none
// method: POST /broker/swap to 12b by the proof (a second press while it is in flight is 409, one act only): the hands get
//         act switch-brain [12b] pressed; the reply exit 0 ends the swap
//         (GET /broker: brain 12b, by proof, upstream brain-swap begin then done); swap back with the hands answering exit 1
//         (brain stays 12b, phase failed); a bad or missing `to`, or a window the engine has no profile for, is 422; with no socket
//         the act fails and the swap is not left in flight
// sre: if the brain must switch, does the record say who asked, and does a failed switch leave the broker able to try again?
test('the broker\'s swap is a switch-brain act to the hands; its reply ends the swap with who pressed it; a failure or no hands never leaves it in flight', async (t) => {
  let exit = 0
  const { f, h, door } = await withHands(t, (m) => ({ hang: m.body.op === 'switch-brain' ? 300 : 0, body: { ticket: m.body.ticket, exit, why: exit ? 'the 26B did not load' : '' } }))
  assert.equal((await f.call('POST', '/broker/swap', { to: '9b' })).status, 422)
  assert.equal((await f.call('POST', '/broker/swap', {})).body.why, 'to is e4b, 26b, 12b, 31b')
  assert.equal((await f.call('POST', '/broker/swap', { to: '12b', profile: 'huge' })).body.why, 'profile is desk, worker, long, tight, batch')
  const s = await f.call('POST', '/broker/swap', { to: '12b', by: 'proof' })
  assert.equal(s.status, 200)
  const twice = await f.call('POST', '/broker/swap', { to: '12b', by: 'owner' })
  assert.equal(twice.status, 409); assert.match(twice.body.held, /in flight \(begun by proof\)/)
  assert.ok(await until(async () => (await f.call('GET', '/broker')).body.brain === '12b'))
  assert.equal(h.seen.filter((m) => m.kind === 'act').length, 1, 'one switch-brain act for two presses')
  const act = h.seen.find((m) => m.kind === 'act'); assert.deepEqual([act.body.op, act.body.args, act.body.pressed], ['switch-brain', ['12b'], true])
  assert.equal((await f.call('GET', '/broker')).body.by, 'proof')
  assert.deepEqual(door.events.filter((e) => e.kind === 'brain-swap').map((e) => e.data.phase), ['begin', 'done'])
  exit = 1
  assert.equal((await f.call('POST', '/broker/swap', { to: '26b' })).status, 200)
  assert.ok(await until(() => door.events.some((e) => e.data?.phase === 'failed')))
  assert.equal((await f.call('GET', '/broker')).body.brain, '12b'); assert.equal((await f.call('GET', '/broker')).body.swapping, null)
  await h.close()                                        // the hands daemon goes away (its kept-alive connection with it)
  assert.equal((await f.call('POST', '/broker/swap', { to: '26b' })).status, 200)
  assert.ok(await until(() => f.log.some((l) => l.includes('swap act switch-brain failed'))))
  assert.equal((await f.call('GET', '/broker')).body.swapping, null)
  assert.ok(kinds(door).includes('brain-swap'))
})

// spec: design §6 change 1 (the retiring road: without the socket, or FOREMAN_HANDS=python, Lacuna's API answers) · eng §3.2 row 6 · §3.7
// class: E9 a message lost (which road a hand takes)
// technique: two foremen: one with a hands socket but FOREMAN_HANDS=python, one with no socket
// method: intent a read on each; the stub door receives an upstream `hand` event for both, and the socket sees nothing
// sre: if the hands daemon is off or opted out, does a hand still reach someone who can run it?
test('FOREMAN_HANDS=python or no socket: a hand goes upstream to Lacuna\'s API, never to the hands socket', async (t) => {
  const { f, h, door } = await withHands(t, () => ({}), { FOREMAN_HANDS: 'python' })
  const run = (await f.call('POST', '/runs', { key: 'py', goal: 'g', hands: ['disk'] })).body.run
  await f.call('POST', `/runs/${run}/intents`, { tool: 'disk' })
  assert.ok(await until(() => door.events.some((e) => e.kind === 'hand')))
  assert.equal(h.seen.length, 0)
  assert.equal((await f.call('POST', '/grants', {})).body.why, 'the hands are not up: no grant can be checked')
})

// spec: CARDS-2.0 §6.2 (the Network card reads the hands' `net` ring through the foreman; the lead, 2026-10-25)
// class: E9 a message lost · F-02 a read the door does not name
// technique: a scratch hands socket answering the net read, then refusing it; a second foreman with no socket
// sre: does the card get the ring's rows, a refusal in one sentence, and a sentence when the hands are down — never an act?
test('GET /net asks the hands for the net read (kind hand, tier J0) and answers its rows; a refusal and an absent daemon are one sentence', async (t) => {
  let refuse = false
  const { f, h } = await withHands(t, (m) => ({ body: refuse ? { ticket: m.body.ticket, exit: 12, why: 'nettop answered 1' } : { ticket: m.body.ticket, exit: 0, rows: { totals: { flows: 7, minute_in: 10, minute_out: 20 }, window_s: 60 } } }))
  const r = (await f.call('GET', '/net')).body
  assert.equal(r.ok, true); assert.equal(r.totals.flows, 7); assert.equal(r.window_s, 60)
  const sent = h.seen.find((m) => m.body?.op === 'net')
  assert.deepEqual([sent.kind, sent.body.tier], ['hand', 'J0'])
  refuse = true
  assert.deepEqual((await f.call('GET', '/net')).body, { ok: false, why: 'nettop answered 1' })
  assert.equal(h.seen.filter((m) => m.kind === 'act').length, 0, 'a door read never sends an act')
  const bare = await boot(t, { dir: scratch('nohands'), env: { LACUNA_HANDS_SOCK: path.join(scratch('nosock'), 'none.sock') } })
  assert.match((await bare.f.call('GET', '/net')).body.why, /hands are not up/)
})
