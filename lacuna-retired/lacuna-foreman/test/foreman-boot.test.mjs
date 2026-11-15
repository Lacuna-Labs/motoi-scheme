process.env.LACUNA_AUTO_LOADS = '1'   // exercises the wall's automatic swap, opt-in since 2026-11-04 (the owner decides who is loaded)
// foreman-boot.test.mjs — U3: THE ROOT FOREMAN AS A PROCESS, ITS BIRTH AND ITS DEATH. Owns: the tests that boot
// foreman.mjs as a scratch child (foreman-box.mjs) and hold its paths, its token file, its door's first checks (loopback,
// token), its socket, its signals, its heartbeat, its runner-mode exits, its prune and its env clocks. Refuses: the live
// foreman, door and brain; ~/lacuna-world and ~/.lacuna (HOME is the scratch dir); a mock of foreman.mjs (it is the real file).
// Implements: unit-test work order §3 row foreman.mjs (design §6 change 6, §11, §13; eng §3.2, §3.5, §5, §10.2).
// Invariants (§18): "if the desk shows a number, then the viewer proved a principal" (a request without the token gets none).
// Faults (§16): F-10 (a refused caller is counted nowhere and served nothing).
// coverage: foreman.mjs — see foreman-door.test.mjs's header for the lane's figure (2026-10-24)
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { boot, scratch, scratchEnv, request, sleep, until, kinds, startStubDoor, scriptDoor, memoryHands, PROBE } from './foreman-box.mjs'
import { startForeman } from '../../../tools/burn-in/scratch.mjs'
import { Gate } from '../protocol.mjs'

const mode = (p) => fs.statSync(p).mode & 0o777

// spec: design §11 (token file 600; principals) · eng §3.1 (the key is ~/.lacuna/foreman-token, 600) · eng §3.2 row 8 (the socket) · law 5
// class: M8 file mode 0600 on secrets
// technique: process boot with HOME pointed at a scratch dir and every path variable unset (the daemon's own defaults)
// method: pre-write one token at the scratch home's .lacuna/foreman-token; unset FOREMAN_DIR/SOCK/TOKEN_FILE/NAME/CARTS…; boot;
//         read the socket's mode, the heartbeat file and a /health asked over the socket, opened at a Gate with the token
// sre: if launchd starts the foreman with a bare environment, do its files land where the jail and the door expect them?
test('with no path set, the foreman keeps everything under its home: socket 0600 in lacuna-world/foreman, signed slat on it', async (t) => {
  const dir = scratch('dflt'); const door = await startStubDoor()
  const tok = crypto.randomBytes(24).toString('hex')
  fs.mkdirSync(path.join(dir, '.lacuna'), { recursive: true })
  fs.writeFileSync(path.join(dir, '.lacuna', 'foreman-token'), tok, { mode: 0o600 }); fs.writeFileSync(path.join(dir, 'token'), tok, { mode: 0o600 })
  const unset = Object.fromEntries(['FOREMAN_DIR', 'FOREMAN_SOCK', 'FOREMAN_TOKEN_FILE', 'FOREMAN_NAME', 'FOREMAN_CARTS', 'FOREMAN_CARTS_SERVE',
    'FOREMAN_TIERS', 'FOREMAN_BOX', 'LACUNA_HANDS_SOCK', 'LACUNA_MAIL_DIR'].map((k) => [k, undefined]))
  const f = await startForeman({ dir, door: door.url, env: { ...scratchEnv(dir, { clock: 0.01 }), ...unset } })
  t.after(async () => { f.kill('SIGTERM'); await f.waitExit(3000); await door.close(); fs.rmSync(dir, { recursive: true, force: true }) })
  const sock = path.join(dir, 'lacuna-world', 'foreman', 'foreman.sock')
  assert.equal(fs.statSync(sock).isSocket(), true); assert.equal(mode(sock), 0o600)
  const r = await request({ socketPath: sock, method: 'GET', path: '/health', headers: { 'X-Foreman-Token': tok } })
  assert.match(r.headers['content-type'], /^application\/slat/)
  const o = new Gate(tok, () => Date.now() / 1000).open({ slat: r.text, sig: r.headers['x-slat-sig'] })
  assert.equal(o.ok, true); assert.equal(o.msg.kind, 'reply'); assert.equal(o.msg.from, 'foreman:studio'); assert.equal(o.msg.to, 'lacuna')
  assert.equal(o.msg.body.foreman, 'studio')
  const carts = await f.call('GET', '/carts')
  assert.ok(carts.body.carts.length >= 5, 'the repo carts are the default shelf')
  assert.ok(await until(() => fs.existsSync(path.join(dir, 'lacuna-world', 'foreman', 'heartbeat'))), 'the heartbeat file is under the default dir')
})

// spec: design §11 (token file 600) · eng §3.1 (the key file, 600)
// class: M8 file mode 0600 on secrets
// technique: process boot twice in one scratch dir (first start, then a restart)
// method: boot with no token file; read its mode and length; kill; boot again; the same token opens the door
// sre: if the foreman restarts, does every client's token still work, and could another user on the box read it?
test('the token file is created 0600 at first start (48 hex) and read back unchanged at the next start', async (t) => {
  const { f, dir, door } = await boot(t, { tag: 'tok', keep: true })
  const file = path.join(dir, 'token'); const first = f.token()
  assert.equal(mode(file), 0o600); assert.match(first, /^[0-9a-f]{48}$/)
  assert.equal(f.log.join('\n').includes(first), false, 'the token never reaches the log (law 7)')
  f.kill('SIGTERM'); await f.waitExit()
  const g = await startForeman({ dir, door: door.url, port: f.port, env: scratchEnv(dir) })
  t.after(async () => { g.kill('SIGTERM'); await g.waitExit(3000); fs.rmSync(dir, { recursive: true, force: true }) })
  assert.equal(g.token(), first)
  assert.equal((await g.call('GET', '/health')).status, 200)
})

test.todo('M8: a 0644 token file is read and used; no design clause says the foreman refuses it (MAIL [U3] [lead] 2026-10-24); a refusal would need a clause and a launchd plan, since a refusing foreman does not boot')

// spec: design §11 ("timingSafeEqual on every token compare") · eng §3.7 row "§11 timingSafeEqual" · I-10 (a number only to a principal)
// class: J17 Buffer vs string compare (timing)
// technique: boundary (no header; the token minus one byte; plus one byte; the same length, one byte changed)
// method: each request asks /workers (a desk number); read the status and that no number came back; then the real token
// sre: if someone on the box guesses at the token, do they learn its length from a crash or a timing, or get a number?
test('without the exact token the door answers 401 "no token" and shows no number: missing, shorter, longer and one byte off', async (t) => {
  const { f } = await boot(t, { tag: 'auth' })
  const tok = f.token(); const flip = (tok[0] === 'a' ? 'b' : 'a') + tok.slice(1)
  for (const h of [{}, { 'X-Foreman-Token': tok.slice(1) }, { 'X-Foreman-Token': `${tok}0` }, { 'X-Foreman-Token': flip }]) {
    const r = await request({ host: '127.0.0.1', port: f.port, method: 'GET', path: '/workers', headers: h })
    assert.equal(r.status, 401); assert.deepEqual(r.body, { ok: false, why: 'no token' })
  }
  const ok = await f.call('GET', '/workers'); assert.equal(ok.status, 200); assert.equal(Array.isArray(ok.body.workers), true)
})

// spec: design §11 (the door binds loopback; principals) · eng §3.7 ("the TCP door is loopback-only") · foreman.mjs PRIVATE
// class: J9 socket errors and who is on the other end (a non-loopback peer)
// technique: process boot listening on every interface (FOREMAN_HOST=0.0.0.0, runner mode's road) and a call from the box's own LAN address
// method: find a non-internal IPv4 address; boot; ask /health from that address with the right token; expect 403 before the token
// sre: if the foreman is ever bound wider than loopback, does a caller from the network still get nothing?
test('a caller from off the loopback is refused 403 even with the right token', async (t) => {
  const lan = Object.values(os.networkInterfaces()).flat().find((a) => a && a.family === 'IPv4' && !a.internal)
  if (!lan) return t.skip('this box has no non-loopback IPv4 address')
  const { f } = await boot(t, { tag: 'lan', env: { FOREMAN_HOST: '0.0.0.0' } })
  const r = await request({ host: lan.address, port: f.port, method: 'GET', path: '/health', headers: { 'X-Foreman-Token': f.token() } })
  assert.equal(r.status, 403); assert.match(r.body.why, /loopback/)
})


// spec: design §6 change 6 (local hops on Unix sockets) · eng §3.2 row 8 · unit-test work order §4 M2
// class: M2 the Unix socket path over 104 bytes
// technique: boundary (a socket path of 125 bytes)
// method: boot with FOREMAN_SOCK too long; expect the process to exit non-zero at boot, never to stand half-up on TCP alone
// sre: if someone moves the world under a long path, does the foreman fail loudly at once instead of serving one door of two?
test('a socket path over 104 bytes stops the foreman at boot with a non-zero exit, and the TCP door never answers', async (t) => {
  const dir = scratch('m2'); const door = await startStubDoor()
  t.after(async () => { await door.close(); fs.rmSync(dir, { recursive: true, force: true }) })
  const sock = path.join(dir, `${'x'.repeat(80)}.sock`); assert.ok(Buffer.byteLength(sock) > 104)
  await assert.rejects(startForeman({ dir, door: door.url, sock, env: scratchEnv(dir), bootMs: 4000 }), /exited at boot \(1\)/)
})

// spec: eng §3.5 (the sweep 10 s, the heartbeat file every sweep) · O-37 (the watchdog reads it) · burn-in B29
// class: J11 fs EISDIR on the heartbeat path; E7 a zombie foreman looks alive
// technique: fault injection (the heartbeat path is a directory); sweep shortened by env (FOREMAN_SWEEP_S=1)
// method: (a) boot with a 1 s sweep; after the first sweep read the heartbeat's number three times over 2.4 s, each newer than two sweeps;
//         (b) boot with a directory where the file goes; the foreman still answers after three sweeps
// sre: if the foreman's heartbeat cannot be written, does it keep serving and let the watchdog say so (never crash on it)?
test('the heartbeat is a fresh number every sweep, and a heartbeat path it cannot write never stops the foreman', async (t) => {
  const { f, dir } = await boot(t, { tag: 'hb', env: { FOREMAN_SWEEP_S: '1' } })
  assert.ok(await until(() => fs.existsSync(path.join(dir, 'heartbeat')), 2500), 'the first sweep writes it')
  for (let i = 0; i < 3; i++) {
    await sleep(800)
    const at = Number(fs.readFileSync(path.join(dir, 'heartbeat'), 'utf8'))
    const age = Date.now() / 1000 - at
    assert.ok(age < 2.0, `heartbeat ${age.toFixed(2)} s old`)
  }
  const d2 = scratch('hbdir'); fs.mkdirSync(path.join(d2, 'heartbeat'))
  const { f: g } = await boot(t, { dir: d2, env: { FOREMAN_SWEEP_S: '1' } })
  await sleep(2500)
  assert.equal((await g.call('GET', '/health')).status, 200); assert.equal(g.exited, null)
  assert.equal(fs.statSync(path.join(d2, 'heartbeat')).isDirectory(), true)
  assert.equal(f.exited, null)
})


// spec: eng §3.5 (SIGTERM; launchd ThrottleInterval) · eng §10.2 ("SIGTERM exit 0 in 4 ms") · burn-in B26 · design §6 change 6
// class: E15 shutdown ordering (sockets unlinked); J12 SIGTERM SIGINT
// technique: signal to our own scratch child
// method: boot; SIGTERM; read the exit code, the time to exit and whether the socket file is still there; again with SIGINT
// sre: if launchd stops the foreman, does it leave at once with 0 (no throttle) and no stale socket for the next start?
for (const sig of ['SIGTERM', 'SIGINT']) {
  test(`${sig} is a clean stop: exit 0 inside 2 s and the socket file is gone`, async (t) => {
    const { f } = await boot(t, { tag: sig.toLowerCase() })
    assert.equal(fs.existsSync(f.sock), true)
    const t0 = Date.now(); f.kill(sig); const e = await f.waitExit(2000)
    assert.ok(e, 'it left'); assert.equal(e.code, 0); assert.ok(e.at - t0 < 2000)
    assert.equal(fs.existsSync(f.sock), false, 'no stale socket (M3)')
    assert.ok(f.log.some((l) => l.includes('stopping')))
  })
}

// spec: foreman.mjs runner mode (FOREMAN_IDLE_S, FOREMAN_MAX_LIFE_S: "an orphan can never run up a bill") · law 10
// class: E15 shutdown ordering (workers stopped, then `leaving` upstream, then exit 0)
// technique: time travel (foreman-clock.mjs: the 5 s check every 50 ms) and env clocks of 1 s
// method: (a) idle 1 s with a living worker: it stays; delete the worker: it leaves with "no work for 1s";
//         (b) max life 1 s with a living worker: it stops the worker, says "reached its 1s life", exits 0
// sre: if a remote foreman is forgotten, does it stop itself and say why, and does it stop its workers first?
test('runner mode: idle out only with no living worker; max life stops the workers, sends leaving, exits 0', async (t) => {
  const { f, door } = await boot(t, { tag: 'idle', clock: 0.01, env: { FOREMAN_IDLE_S: '1' } })
  assert.ok(f.log.some((l) => l.includes('idles out after 1s')))
  const w = (await f.call('POST', '/workers', { name: 'probe', program: PROBE })).body.worker
  await sleep(1500)
  assert.equal(f.exited, null, 'a living worker keeps it')
  await f.call('DELETE', `/workers/${w.id}?by=test`)
  const e = await f.waitExit(4000)
  assert.equal(e?.code, 0); assert.ok(f.log.some((l) => l.includes('leaving: no work for 1s')))
  assert.deepEqual(door.events.filter((x) => x.kind === 'leaving').map((x) => x.data.why), ['no work for 1s'])
  const { f: g, door: d2 } = await boot(t, { tag: 'life', clock: 0.01, env: { FOREMAN_MAX_LIFE_S: '1' } })
  assert.ok(g.log.some((l) => l.includes('lives at most 1s')))
  await g.call('POST', '/workers', { name: 'probe', program: PROBE })
  const e2 = await g.waitExit(4000)
  assert.equal(e2?.code, 0)
  assert.deepEqual(d2.events.filter((x) => x.kind === 'leaving').map((x) => x.data.why), ['reached its 1s life'])
  const order = kinds(d2).filter((k) => k === 'retired' || k === 'leaving' || k === 'stopped')
  assert.equal(order.at(-1), 'leaving', 'the workers are stopped before it says it leaves')
})

// spec: eng §3.5 ("records pruned: retired worker records after 7 days, every 6 h") · B39
// class: J16 a directory that grows without a bound
// technique: time travel on the files (utimes 8 days back) before boot
// method: write a retired record 8 days old with its checkpoint, a grave 1 day old, a stalled and a running one 8 days old, a torn
//         file 8 days old; boot; read which files remain and the log line
// sre: if the foreman runs for months, does the workers folder stay bounded, without ever deleting a living worker?
test('at boot, finished records older than 7 days go with their checkpoints; a younger one, a living one and a torn file stay', async (t) => {
  const dir = scratch('prune'); const W = path.join(dir, 'workers'); const C = path.join(dir, 'ckpt')
  fs.mkdirSync(W, { recursive: true }); fs.mkdirSync(C, { recursive: true })
  const old = (Date.now() - 8 * 86400_000) / 1000
  const rec = (id, state) => ({ id, name: id, program: "(on 'x (lambda (v) v))", tier: 'watch', parent: null, state, kv: {}, reports: [], started: 1, children: [] })
  for (const [id, state] of [['w-old', 'retired'], ['w-new', 'grave'], ['w-stl', 'stalled']]) fs.writeFileSync(path.join(W, `${id}.json`), JSON.stringify(rec(id, state)))
  fs.writeFileSync(path.join(C, 'w-old.json'), '{}'); fs.writeFileSync(path.join(W, 'w-torn.json'), '{"id": "w-t')
  const { reports, children, ...bare } = rec('w-run', 'running'); fs.writeFileSync(path.join(W, 'w-run.json'), JSON.stringify(bare))   // living, older than reports
  for (const n of ['w-old', 'w-stl', 'w-torn', 'w-run']) fs.utimesSync(path.join(W, `${n}.json`), old, old)
  const { f } = await boot(t, { dir })
  assert.deepEqual(fs.readdirSync(W).sort(), ['w-new.json', 'w-run.json', 'w-torn.json'])
  assert.equal(fs.existsSync(path.join(C, 'w-old.json')), false)
  assert.ok(f.log.some((l) => l.includes('pruned 2 finished worker record(s) older than 7 days')))
  const ws = (await f.call('GET', '/workers')).body.workers.map((w) => w.id)
  assert.deepEqual(ws.sort(), ['w-new', 'w-run'], 'the pruned are gone from the table too; the living one stays; the torn file is left for a person')
})

// spec: eng §3.5 (hand 120 s by default; the env makes it short) · design §6 change 2f
// class: J13 env unset, empty, non-numeric
// technique: boundary on the env (a number, zero, a word)
// method: boot with FOREMAN_HAND_S=7, FOREMAN_ACT_S=0, FOREMAN_BEAT_S=abc; file a run and ask one read; read the ticket's
//         deadline (7 s) and that the run still waits with the default beat (no NaN anywhere on /workers)
// sre: if an env var is mistyped in a plist, does the foreman fall back to the design's clock instead of NaN deadlines?
test('env clocks: a number is taken, zero and a word fall back to the design clock (no NaN on the desk)', async (t) => {
  const { f } = await boot(t, { tag: 'env', env: { FOREMAN_HAND_S: '7', FOREMAN_ACT_S: '0', FOREMAN_BEAT_S: 'abc' } })
  const run = (await f.call('POST', '/runs', { key: 'env-1', goal: 'read the disk', hands: ['disk'] })).body.run
  const i = await f.call('POST', `/runs/${run}/intents`, { tool: 'disk', args: ['/'] })
  assert.equal(i.status, 200)
  const w = (await f.call('GET', `/workers/${run}`)).body.worker
  assert.ok(w.pending[0].deadline_in_s > 6 && w.pending[0].deadline_in_s <= 7, `deadline ${w.pending[0].deadline_in_s}`)
  assert.equal(JSON.stringify(w).includes('NaN'), false); assert.equal(JSON.stringify(w).includes('null,"tries":null'), false)
})

// spec: eng §3.5 ("the sweep: deadlines, heartbeats, the zombie law, the kick rule, the memory wall and the heartbeat file ride one
//       clock") · design §10 (the wall: < 2 GB for 300 s) · design §9 / kick.mjs (no intent by the hop deadline → exit 99) · F-05 · F-06
// class: J14 clock jumps (forward past the wall's window); E8 a deadline passed (the hop deadline)
// technique: time travel (foreman-clock.mjs: the sweep every 10 ms; SIGUSR2 moves Date.now 61 s, five times) and a scratch hands
//            socket whose coast-sample is 1.5 GB (the governor's source, E1.3); a box profile that prices the 12B (E1.2)
// method: file a run, accept one intent and its result (the run now waits on its brain, FOREMAN_HOP_S=1); wait: the sweep ends
//         it ("run ended <id> F-06" in the log; a stalled letter on disk); jump the clock past 300 s of low memory: the sweep
//         begins the swap to the 12B ("brain swap begun → 12b") once the governor prices it, and, with the hands refusing the
//         act, the swap fails and is not left in flight
// sre: if the brain loop goes quiet or memory stays low, does the foreman's own clock act on it without anyone asking?
test('the sweep clock ends a run past its hop deadline and begins the wall\'s swap after 300 s of low memory', async (t) => {
  const door = await scriptDoor(() => ({ body: { ok: true } }))
  t.after(() => door.close())
  // E1.3: the memory is the governor's (the hands' coast-sample, 1.5 GB); E1.2: the swap is priced against the box profile first
  const hands = await memoryHands(t, { memGb: 1.5 })
  fs.writeFileSync(path.join(hands.dir, 'box.slat'), '(box (name "scratch") (admit-floor-mb 1500))\n(mind (id 26b) (use-mb 19000) (source "test"))\n(mind (id 12b) (use-mb 11319) (source "test"))\n')
  const { f, dir } = await boot(t, { dir: hands.dir, door, clock: 0.01, env: { LACUNA_AUTO_LOADS: '1', FOREMAN_SWEEP_S: '1', FOREMAN_HOP_S: '1', FOREMAN_LOAD: '1000', FOREMAN_PROFILE: path.join(hands.dir, 'box.slat'), ...hands.env } })
  const run = (await f.call('POST', '/runs', { key: 'hop', goal: 'g', hands: ['disk'] })).body.run
  const i = (await f.call('POST', `/runs/${run}/intents`, { tool: 'disk' })).body
  await f.call('POST', `/runs/${run}/results`, { ticket: i.ticket, exit: 0 })
  assert.ok(await until(() => f.log.some((l) => l.includes(`run ended ${run} F-06`))), 'ended by the hop deadline')
  assert.ok(fs.readdirSync(path.join(dir, 'mail')).length >= 1, 'a letter says it stalled')
  assert.ok(await until(async () => (await f.call('GET', '/broker')).body.low_since != null), 'the wall saw low memory')
  for (let k = 0; k < 5; k++) { f.kill('SIGUSR2'); await sleep(60) }
  assert.ok(await until(() => f.log.some((l) => l.includes('brain swap begun → 12b'))))
  assert.ok(await until(async () => (await f.call('GET', '/broker')).body.swapping === null), 'the hands refuse the act: the swap failed and is not in flight')
  assert.ok(hands.ops.includes('switch-brain'), 'priced, then sent once')
})
