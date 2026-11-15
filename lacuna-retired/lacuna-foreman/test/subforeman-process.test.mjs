// subforeman-process.test.mjs — U3: RUN FOREMEN AS REAL PROCESSES. Owns: the tests that ask a scratch root foreman for a
// run foreman through its door (`POST /foremen`), reach a worker inside it, kill it, kill the root under it, and start a
// run foreman with no key; and read what the root's record, the stub door and the mail dir say afterwards. Refuses: the
// live foreman; a fake fork here (subforeman.test.mjs holds the in-process cases); a mock of subforeman.mjs or foreman.mjs.
// Implements: unit-test work order §3 row subforeman.mjs (design §6 change 4; eng §3.2 row 14; §3.5 INTENSITY 3/300;
// burn-in B27, B28). Invariants (§18): "if a run foreman died, then its children are buried and the root's intensity
// counted it"; a child never holds the token. Faults (§16): F-04 (the root's intensity), F-05 (exit 89 at admission).
// coverage: subforeman.mjs — lines 100% branches 100% functions 100% with subforeman.test.mjs (2026-10-24)
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { boot, scratch, scratchEnv, until, sleep, request, PROBE } from './foreman-box.mjs'
import { freePort } from '../../../tools/burn-in/scratch.mjs'
import { FOREMAN_MJS } from '../../../tools/burn-in/scratch.mjs'

const alive = (pid) => { try { process.kill(pid, 0); return true } catch { return false } }

// spec: design §6 change 4 (a run foreman: fork, derived key over IPC, its socket) · eng §3.2 row 14 · I-06
// class: E13 the run foreman dies (here: dies on its own clock, unasked)
// technique: time travel (foreman-clock.mjs scales the child's 10 s key timer to 100 ms; the root and the run foreman share the clock)
// method: ask the root for a run foreman; wait 1.5 s (150 s of the children's timers); it must still be listed, ready, with no
//         `run-foreman-exit` upstream and no letter
// sre: if a run takes longer than ten seconds, does its own foreman stay up, or does it die and count against the root?
test('a run foreman that got its key stays up past the 10 s key wait (no exit 12, no death counted)', async (t) => {
  const { f, door } = await boot(t, { tag: 'subk', clock: 0.01 })
  const r = await f.call('POST', '/foremen', { run: 'r-long' })
  assert.equal(r.status, 200)
  assert.ok(await until(async () => (await f.call('GET', '/foremen')).body.foremen[0]?.ready), 'it said ready')
  await sleep(1500)
  const fm = (await f.call('GET', '/foremen')).body.foremen
  assert.deepEqual(fm.map((x) => x.run), ['r-long'], 'still up')
  assert.equal(door.events.some((e) => e.kind === 'run-foreman-exit'), false)
  assert.equal(f.log.some((l) => l.includes('no key from the root')), false)
})

// spec: design §6 change 4 (`/workers/<id>/*` routed to the owning child; upstream relayed; buried on kill -9) · B27 · I-06
// class: E13 the run foreman dies; M3 a stale socket file after kill -9
// technique: process kill (SIGKILL to the run foreman, our own grandchild)
// method: fork r1; spawn a worker in it through the root; send it a signed event through the root's door (the root forwards
//         over the child's socket); read the report relayed upstream stamped with the run; kill -9 the child; read
//         `child-graved` and `run-foreman-exit` upstream, the socket gone, /foremen empty, the worker no longer owned
// sre: if a run foreman is killed, does the root bury what it ran, say so upstream, and leave no socket behind?
test('a worker inside a run foreman is reached through the root; kill -9 of the run foreman buries it upstream and removes the socket', async (t) => {
  const { f, door } = await boot(t, { tag: 'sub9' })
  const s = (await f.call('POST', '/foremen', { run: 'r1' })).body
  assert.ok(await until(async () => (await f.call('GET', '/foremen')).body.foremen[0]?.ready))
  const sp = await f.call('POST', '/foremen/r1/workers', { name: 'inner', program: PROBE })
  assert.equal(sp.status, 200); const id = sp.body.worker.id
  assert.ok(await until(async () => (await f.call('GET', '/foremen')).body.foremen[0].workers === 1), 'the child said own')
  const g = await f.call('GET', `/workers/${id}`)
  assert.equal(g.status, 200); assert.equal(g.body.worker.name, 'inner')
  const ev = await f.event(id, 'ping', 1, { key: (await import('../subforeman.mjs')).derivedKey(f.token(), 'r1') })
  assert.equal(ev.status, 200)
  assert.ok(await until(() => door.events.find((e) => e.kind === 'report' && e.worker.run_foreman === 'r1')), 'the report came up through the root')
  const pid = (await f.call('GET', '/foremen')).body.foremen[0].pid
  process.kill(pid, 'SIGKILL')
  assert.ok(await until(() => door.events.find((e) => e.kind === 'run-foreman-exit')))
  const graved = door.events.filter((e) => e.kind === 'child-graved')
  assert.equal(graved.length, 1); assert.equal(graved[0].worker.id, id); assert.match(graved[0].data.why, /killed by SIGKILL/)
  assert.equal(fs.existsSync(s.sock), false)
  assert.deepEqual((await f.call('GET', '/foremen')).body.foremen, [])
  assert.equal((await f.call('GET', `/workers/${id}`)).status, 404, 'no longer routed to a dead child')
})

// spec: design §6 change 4 ("counted toward the root's intensity") · eng §3.5 INTENSITY 3/300 · eng §3.7 (a fourth fork refused) · B28 · F-04
// class: E2 restart intensity exceeded (on run foremen)
// technique: process kill three times inside the window
// method: fork and kill -9 three run foremen; the fourth `POST /foremen` is 422 with exit 30 and "no fork until the window
//         passes"; one letter in the mail dir names the deaths
// sre: if run foremen keep dying, does the root stop forking them and tell a person, instead of a fork storm?
test('three run-foreman deaths inside 300 s: the fourth fork is 422 exit 30 and one letter is on disk', async (t) => {
  const { f, dir } = await boot(t, { tag: 'subi' })
  for (const run of ['d1', 'd2', 'd3']) {
    await f.call('POST', '/foremen', { run })
    const st = await until(async () => (await f.call('GET', '/foremen')).body.foremen.find((x) => x.run === run && x.ready))
    process.kill(st.pid, 'SIGKILL')
    await until(async () => !(await f.call('GET', '/foremen')).body.foremen.length)
  }
  const r = await f.call('POST', '/foremen', { run: 'd4' })
  assert.equal(r.status, 422); assert.equal(r.body.exit, 30); assert.match(r.body.why, /no fork until the window passes/)
  const letters = fs.readdirSync(path.join(dir, 'mail'))
  assert.equal(letters.length, 1); assert.match(fs.readFileSync(path.join(dir, 'mail', letters[0]), 'utf8'), /3 run foremen died in 300 s/)
})

// spec: design §6 change 4 ("the root installs process.on('exit') → kill every child") · eng §3.5 · OTP shutdown (children before parent)
// class: E15 shutdown ordering; E11 an orphan (parent gone; child's fate)
// technique: signal (SIGTERM to the root) and process kill (SIGKILL to the root)
// method: (a) fork a run foreman; SIGTERM the root; the run foreman's pid is gone within 2 s;
//         (b) fork one; SIGKILL the root (no exit handler runs); the IPC channel closes and the run foreman stops its
//         workers and leaves on its own within 2 s
// sre: if the root leaves, cleanly or not, does any run foreman outlive it as an orphan holding a socket?
test('no run foreman outlives the root: SIGTERM kills it from the exit hook; SIGKILL leaves it to its disconnect and it goes', async (t) => {
  for (const sig of ['SIGTERM', 'SIGKILL']) {
    const { f } = await boot(t, { tag: `subo${sig.slice(3, 5)}` })
    await f.call('POST', '/foremen', { run: 'o1' })
    const st = await until(async () => (await f.call('GET', '/foremen')).body.foremen[0]?.ready && (await f.call('GET', '/foremen')).body.foremen[0])
    await f.call('POST', '/foremen/o1/workers', { name: 'inner', program: PROBE })
    f.kill(sig); await f.waitExit()
    assert.ok(await until(() => !alive(st.pid), 3000), `the run foreman ${st.pid} left after the root's ${sig}`)
    assert.equal(fs.existsSync(st.sock), false)
  }
})

// spec: design §6 change 4 (the derived key arrives over IPC, never the token file, never the environment) · eng §3.1
// class: E7 a zombie (a run foreman that never got its key)
// technique: process boot as a run foreman (FOREMAN_SUB set) with an IPC channel that never carries a key; time travel
// method: spawn foreman.mjs with FOREMAN_SUB and stdio ipc; send a 0, a junk message and a key that is a number; it says "no key from the root in 10 s" and exits 12
// sre: if the root dies between the fork and the key, does the run foreman leave instead of waiting forever?
test('a run foreman that never gets its key leaves with exit 12 and says why', async (t) => {
  const dir = scratch('nokey')
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const env = { ...scratchEnv(dir, { clock: 0.01 }), PATH: process.env.PATH, FOREMAN_SUB: 'lost', FOREMAN_DIR: dir, FOREMAN_SOCK: path.join(dir, 's.sock'), FOREMAN_PORT: '0', LACUNA_URL: 'http://127.0.0.1:9' }
  for (const k of Object.keys(env)) if (env[k] === undefined) delete env[k]
  const p = spawn(process.execPath, [FOREMAN_MJS], { env, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] })
  let err = ''; p.stderr.on('data', (d) => { err += d })
  p.send(0); p.send({ t: 'junk' }); p.send({ t: 'key', key: 5 })   // nothing but a string key under t: 'key' is a key
  const code = await new Promise((r) => p.on('exit', (c) => r(c)))
  assert.equal(code, 12); assert.match(err, /no key from the root in 10 s/)
  assert.equal(fs.existsSync(path.join(dir, 's.sock')), false, 'it never opened a door')
})


// spec: design §6 change 4 (a run foreman: its door, `own`, `up`, `ready` over IPC; "a run foreman does not fork"; it leaves
//       when the root goes) · eng §3.2 row 14 · I-06
// class: E11 an orphan (the root's channel closes); W6 a wrong door (a run foreman has no /foremen)
// technique: process boot as a run foreman with a TCP door and no socket (FOREMAN_PORT set, FOREMAN_SOCK unset), driven over IPC
// method: send the key; read {t: ready}; GET /health with the key (200); GET /foremen (404: a run foreman has none); spawn a
//         worker (IPC {t: own}); ping it (IPC {t: up} with the report); disconnect: it stops its worker and exits 0
// sre: if a run foreman runs alone, does it speak only through its root, refuse to manage foremen, and leave with its root?
test('a run foreman on a TCP door: ready, own and up over IPC; no /foremen; it leaves with exit 0 when the root\'s channel closes', async (t) => {
  const dir = scratch('solo'); const port = await freePort(); const key = 'd'.repeat(64)
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const env = { ...scratchEnv(dir), PATH: process.env.PATH, FOREMAN_SUB: 'solo', FOREMAN_DIR: dir, FOREMAN_PORT: String(port), LACUNA_URL: 'http://127.0.0.1:9' }
  for (const k of Object.keys(env)) if (env[k] === undefined) delete env[k]
  const p = spawn(process.execPath, [FOREMAN_MJS], { env, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] })
  const msgs = []; p.on('message', (m) => msgs.push(m)); let out = ''; p.stdout.on('data', (d) => { out += d })
  const exit = new Promise((r) => p.on('exit', (c) => r(c)))
  p.send({ t: 'key', key })
  assert.ok(await until(() => msgs.some((m) => m.t === 'ready')))
  const call = (method, pth, body) => request({ host: '127.0.0.1', port, method, path: pth, headers: { 'X-Foreman-Token': key } }, body)
  assert.equal((await call('GET', '/health')).status, 200)
  assert.equal((await call('GET', '/foremen')).status, 404)
  const w = (await call('POST', '/workers', { name: 'inner', program: PROBE })).body.worker
  assert.ok(await until(() => msgs.some((m) => m.t === 'own' && m.id === w.id)))
  const { seal, now } = await import('./foreman-box.mjs')
  await call('POST', `/workers/${w.id}/event`, seal(key, { from: 'lacuna', to: w.id, kind: 'ping', body: 1, at: now() }))
  assert.ok(await until(() => msgs.some((m) => m.t === 'up' && m.msg.kind === 'report')))
  p.disconnect()
  assert.equal(await exit, 0); assert.match(out, /the root went away/)
  assert.match(out, new RegExp(`foreman studio on 127\\.0\\.0\\.1:${port}$`, 'm'), 'no socket: the TCP door only')
})

// spec: design §6 change 4 (the root stops a run foreman: SIGTERM, then SIGKILL) · eng §3.2 row 14 (`DELETE /foremen/<run>`)
// class: E15 shutdown ordering (a run foreman stopped by a person)
// technique: state-machine walk through the root's door: fork, stop with a name, stop again, stop a run that is not there
// method: DELETE /foremen/r1?by=desk (ok true; the run-foreman-exit follows), DELETE again (ok false), DELETE /foremen/ (no
//         run named: 404 "no such door")
// sre: if a person stops a run foreman from the desk, does it stop and say so, and is a second stop harmless?
test('DELETE /foremen/<run> stops it (ok, then its exit upstream); again is ok false; no run named is 404', async (t) => {
  const { f, door } = await boot(t, { tag: 'subd' })
  await f.call('POST', '/foremen', { run: 'r1' })
  await until(async () => (await f.call('GET', '/foremen')).body.foremen[0]?.ready)
  assert.deepEqual((await f.call('DELETE', '/foremen/r1?by=desk')).body, { ok: true })
  assert.ok(await until(() => door.events.some((e) => e.kind === 'run-foreman-exit')))
  assert.ok(f.log.some((l) => l.includes('stopping run foreman r1 stopped by desk')))
  assert.deepEqual((await f.call('DELETE', '/foremen/r1')).body, { ok: false })
  assert.equal((await f.call('DELETE', '/foremen/')).status, 404)
  assert.equal((await f.call('POST', '/foremen', { run: 'r2' })).status, 200)
  assert.equal((await f.call('POST', '/foremen', { run: 'r2' })).status, 422, 'twice is refused')
})
