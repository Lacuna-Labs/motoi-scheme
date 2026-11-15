// subforeman.test.mjs — U3 (K4): RUN FOREMEN IN THIS PROCESS. Owns: the tests of subforeman.mjs with an injected fork (a fake
// child: an EventEmitter with pid, send and kill) and a real Unix socket server playing the child's door: admitted by the
// broker, keyed by HMAC over IPC, its workers owned and forwarded (the signed reply opened with the derived key), buried in
// the root's record when the process dies, counted as a death; a child never forks; a child that ignores SIGTERM is killed.
// Refuses: a real fork here (subforeman-process.test.mjs holds those); a mock of subforeman.mjs. Implements: unit-test
// work order §3 row subforeman.mjs (design §6 change 4; §10 filedEach; eng §3.2 row 14; §3.5 INTENSITY 3/300).
// Invariants (§18): "if a run foreman died, then its children are buried and the root's intensity counted it"; a child never
// holds the token. Faults (§16): F-04 (intensity), F-05 (exit 89 at admission).
// coverage: subforeman.mjs — lines 100% branches 100% functions 100% with subforeman-process.test.mjs (2026-10-24)
import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { Supervisor } from '../supervisor.mjs'
import { Subforemen, derivedKey, INTENSITY, DEPTH } from '../subforeman.mjs'
import { WALL } from '../broker.mjs'
import { seal } from '../protocol.mjs'

function host(extra = {}) {
  let t = 1000, n = 0
  const up = []
  return { up, tick: (s) => { t += s }, now: () => t, id: () => `w${++n}`, save: () => {}, upstream: (kind, w, data) => up.push({ kind, name: w.name, data, run: w.run_foreman }), ...extra }
}
function fakeFork(o = {}) {
  const procs = []
  const fork = (file, env) => {
    const p = new EventEmitter(); if (!o.noPid) p.pid = 100 + procs.length; p.file = file; p.env = env; p.sent = []; p.send = (m) => p.sent.push(m)
    p.kill = (sig) => { p.killed = (p.killed || []).concat(sig); if (o.ignoreTerm && sig === 'SIGTERM') return; if (o.killThrows && sig === 'SIGKILL') throw new Error('ESRCH'); p.emit('exit', null, sig) }
    procs.push(p); return p
  }
  return { procs, fork }
}
const make = (h, f, o = {}) => new Subforemen({ sup: new Supervisor(h), token: 'tok', dir: '/d', sockDir: o.sockDir || '/s', upstream: h.upstream, fork: f.fork, log: o.log })

// spec: design §6 change 4 (a derived key HMAC(token, run) over IPC, never the token file, never the environment; its own dir and socket) · eng §3.1
// class: M8 secrets (the token never leaves the root); M2 the socket path (built from the run's sanitized name)
// technique: an injected fork that records the env and the IPC messages
// method: spawn 'ipad-verify@07:00': the run name is sanitized, the socket is <sockDir>/foreman-<run>.sock, the env has
//         FOREMAN_SUB/DIR/PORT 0 and no FOREMAN_TOKEN_FILE, the only IPC message is {t: key} with the derived key; twice is refused
// sre: if a run foreman is compromised, does it hold only its own run's key and never the box's token?
test('a run foreman is forked with its own dir and socket, keyed over IPC, never with the token', () => {
  const h = host(); const f = fakeFork(); const sf = make(h, f)
  const r = sf.spawn('ipad-verify@07:00')
  assert.equal(r.ok, true); assert.equal(r.sock, '/s/foreman-ipad-verify@07_00.sock')
  const p = f.procs[0]
  assert.match(p.file, /lacuna-foreman\/foreman\.mjs$/)
  assert.equal(p.env.FOREMAN_SUB, 'ipad-verify@07_00'); assert.equal(p.env.FOREMAN_DIR, '/d/sub/ipad-verify@07_00'); assert.equal(p.env.FOREMAN_PORT, '0')
  assert.equal(p.env.FOREMAN_TOKEN_FILE, undefined); assert.equal(Object.values(p.env).includes('tok'), false)
  assert.deepEqual(p.sent, [{ t: 'key', key: derivedKey('tok', 'ipad-verify@07_00') }])
  assert.notEqual(p.sent[0].key, 'tok')
  assert.equal(sf.spawn('ipad-verify@07:00').why, 'run foreman ipad-verify@07_00 is already running')
})

// spec: design §6 change 4 ("upstream relayed through the root"; `own`, `ready`, `up`) · eng §3.2 row 14
// class: W5 malformed (IPC messages that are not the protocol)
// technique: state-machine walk over the IPC kinds: junk, null, ready, own, up with and without a worker
// method: emit each; junk and null change nothing; ready marks the child; own records the worker; up is relayed stamped with
//         the run, and an up with no worker is relayed as the run foreman itself
// sre: if a child sends garbage over IPC, is it ignored, and is every real upstream line stamped with the run it came from?
test('ownership and relay: a child says own, its upstream passes through the root stamped with the run; junk is ignored', () => {
  const h = host(); const f = fakeFork(); const sf = make(h, f)
  sf.spawn('r1'); const p = f.procs[0]
  p.emit('message', null); p.emit('message', 'junk'); p.emit('message', { t: 'other' }); p.emit('message', { t: 'own' })
  assert.deepEqual(sf.status()[0].workers, 0); assert.equal(sf.status()[0].ready, false)
  p.emit('message', { t: 'ready' }); p.emit('message', { t: 'own', id: 'w-abc' })
  assert.equal(sf.owns('w-abc'), 'r1'); assert.equal(sf.status()[0].ready, true); assert.equal(sf.status()[0].workers, 1)
  p.emit('message', { t: 'up', msg: { kind: 'report', worker: { id: 'w-abc', name: 'probe' }, data: { kind: 'tick' } } })
  assert.equal(h.up.at(-1).kind, 'report'); assert.equal(h.up.at(-1).run, 'r1')
  p.emit('message', { t: 'up', msg: { kind: 'manners', data: { hushed: true } } })
  assert.deepEqual([h.up.at(-1).name, h.up.at(-1).run], ['foreman:r1', 'r1'])
})

// spec: design §6 change 4 ("buried with its children on kill -9, counted toward the root's intensity") · I-06 · eng §3.2 row 14
// class: E13 the run foreman dies; E11 an orphan (its workers)
// technique: process death on the fake child: SIGKILL, then a plain exit code
// method: two workers owned; exit by SIGKILL: two child-graved rows naming the signal, run-foreman-exit last, the workers no
//         longer owned, one death; the seat back; a second child exits 1: "exited 1"
// sre: if a run foreman dies, does the root bury what it ran and count the death, whatever killed it?
test('kill -9: its workers are buried in the root record, the seat is released, the death counts; a plain exit says its code', () => {
  const h = host(); const f = fakeFork(); const sf = make(h, f)
  sf.spawn('r1'); const p = f.procs[0]
  p.emit('message', { t: 'own', id: 'w-1' }); p.emit('message', { t: 'own', id: 'w-2' })
  p.emit('exit', null, 'SIGKILL')
  assert.equal(h.up.filter((u) => u.kind === 'child-graved').length, 2)
  assert.match(h.up.find((u) => u.kind === 'child-graved').data.why, /killed by SIGKILL/)
  assert.equal(h.up.at(-1).kind, 'run-foreman-exit'); assert.equal(sf.owns('w-1'), null); assert.equal(sf.deaths.length, 1)
  assert.equal(sf.spawn('r1').ok, true, 'the seat came back')
  f.procs[1].emit('exit', 1, null)
  assert.deepEqual(h.up.at(-1).data, { why: 'exited 1', workers: 0, code: 1, signal: null })
})

// spec: design §6 change 4 (admitted by broker.mjs only with ≥ 1 GB non-wired free, else exit 89; ≤ 8) · eng §3.5 WALL · F-05
// class: B7 ceilings (the 9th run foreman); M6 memory pressure
// technique: boundary on the host's memory probe and the count
// method: 500 MB: exit 89; 5,000 MB: eight forks; the ninth refused; stop one (SIGTERM); the ninth forks
// sre: if the box is short of memory or already runs eight, does a new run foreman wait instead of starting?
test('the wall: under 1 GB a run foreman is refused with exit 89; a ninth is refused (the governor armed: LACUNA_GOVERNOR=1)', (t) => {
  process.env.LACUNA_GOVERNOR = '1'; t.after(() => { delete process.env.LACUNA_GOVERNOR })   // off by default since the owner's 2026-11-04 ruling
  let avail = 500
  const h = host({ memory: () => ({ availMB: avail, wiredMB: 0 }) }); const f = fakeFork(); const sf = make(h, f)
  assert.equal(sf.spawn('r1').exit, 89)
  avail = 5000
  for (let i = 0; i < WALL.runForemen; i++) assert.equal(sf.spawn(`r${i}`).ok, true)
  assert.match(sf.spawn('r9').why, /8 run foremen already/)
  sf.stop('r0', 'test'); assert.deepEqual(f.procs[0].killed, ['SIGTERM'])
  assert.equal(sf.spawn('r9').ok, true)
})

// spec: design §6 change 4 ("counted toward the root's intensity") · eng §3.5 INTENSITY 3/300 · eng §3.7 · I-06 · F-04
// class: E2 restart intensity exceeded
// technique: fake clock (the host's) and boundary: three deaths 10 s apart; the window's end
// method: three forks die; one letter "3 run foremen died"; the fourth is exit 30 "no fork until the window passes"; 300 s
//         later the window has passed and a fork is allowed
// sre: if run foremen keep dying, does the root stop forking and tell a person, then try again after the window?
test('I-06: three run-foreman deaths in 300 s stop further forks for the window and write a letter', () => {
  const h = host(); const letters = []; h.mail = (m) => letters.push(m); const f = fakeFork(); const sf = make(h, f)
  for (let i = 0; i < INTENSITY.deaths; i++) { sf.spawn(`r${i}`); f.procs[i].emit('exit', null, 'SIGKILL'); h.tick(10) }
  assert.equal(letters.length, 1); assert.match(letters[0].what, /3 run foremen died/)
  const r = sf.spawn('r9'); assert.equal(r.exit, 30); assert.match(r.why, /no fork until the window passes/)
  h.tick(INTENSITY.window); assert.equal(sf.spawn('r9').ok, true, 'the window passed')
})

// spec: design §6 change 4 ("process depth 2": a run foreman never forks) · eng §3.2 row 14
// class: B7 ceilings (depth 3 of processes)
// technique: boundary: the environment of a run foreman (FOREMAN_SUB set) in this process
// method: with FOREMAN_SUB set, a Subforemen's spawn answers exit 12 "a run foreman does not fork (depth 2)" and forks nothing
// sre: if a run foreman tries to fork its own, is it refused before any process starts?
test('a run foreman does not fork: depth 2 is the limit, exit 12, nothing forked', () => {
  const h = host(); const f = fakeFork()
  process.env.FOREMAN_SUB = 'r-parent'
  try {
    const sf = make(h, f)
    assert.deepEqual(sf.spawn('child'), { ok: false, exit: 12, why: `a run foreman does not fork (depth ${DEPTH})` })
    assert.equal(f.procs.length, 0)
  } finally { delete process.env.FOREMAN_SUB }
})

// spec: design §6 change 4 ("the root installs process.on('exit') → kill every child"; stop = SIGTERM then SIGKILL after 3 s) · OTP shutdown timeout
// class: J8 a child that ignores SIGTERM; E15 shutdown ordering
// technique: fake clock (node:test mock timers) and a fake child that ignores SIGTERM (and one whose SIGKILL throws: already gone)
// method: stop an unknown run (false); stop a child that ignores SIGTERM: after 2,999 ms only SIGTERM, at 3,000 ms SIGKILL;
//         killAll on two children; a SIGKILL that throws is swallowed; status of a child with no pid says null
// sre: if a run foreman hangs on shutdown, is it killed after three seconds rather than left running?
test('stop: SIGTERM, then SIGKILL at 3 s for a child that ignores it; killAll stops every child; an unknown run is false', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const logs = []
  const h = host(); const f = fakeFork({ ignoreTerm: true, killThrows: false }); const sf = make(h, f, { log: (...a) => logs.push(a.join(' ')) })
  assert.equal(sf.stop('none'), false)
  sf.spawn('r1'); sf.stop('r1', 'test')
  t.mock.timers.tick(2999); assert.deepEqual(f.procs[0].killed, ['SIGTERM'])
  t.mock.timers.tick(1); assert.deepEqual(f.procs[0].killed, ['SIGTERM', 'SIGKILL'])
  const g = fakeFork({ ignoreTerm: true, killThrows: true, noPid: true }); const sg = make(host(), g)
  sg.spawn('a'); sg.spawn('b'); assert.deepEqual(sg.status().map((x) => x.pid), [null, null])
  sg.killAll('leaving'); t.mock.timers.tick(3000)
  assert.deepEqual(g.procs.map((p) => p.killed), [['SIGTERM', 'SIGKILL'], ['SIGTERM', 'SIGKILL']])
  assert.ok(logs.some((l) => l.includes('stopping run foreman r1 test')))
})

// spec: design §6 change 4 (`/workers/<id>/*` routed to the owning child over its socket) · law 5 (the child's socket speaks signed slat) · eng §3.2 row 14
// class: W2 forged (a reply not signed with the derived key); J9 ENOENT and a hang; W5 malformed (no JSON)
// technique: a real Unix socket server playing the child's door, answering each way in turn
// method: forward to an unknown run (404); a signed slat reply opened with the derived key (its body and status); a slat
//         reply signed with another key (502 "dropped"); a JSON reply; a reply that is neither (no JSON); a reply with no
//         content type; no socket (502 "did not answer"); the request carries the derived key and the JSON body
// sre: if the root forwards to a run foreman, does it trust only an answer signed with that run's key?
test('forward: a signed reply is opened with the derived key; a forged one is 502; JSON, junk and no socket each answer in a sentence', async (t) => {
  const dir = fs.mkdtempSync('/private/tmp/lacuna-unit/U3/fw-'); t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const h = host(); const f = fakeFork(); const sf = make(h, f, { sockDir: dir })
  assert.deepEqual(await sf.forward('none', 'GET', '/workers/x'), { code: 404, body: { ok: false, why: 'no run foreman none' } })
  sf.spawn('r1'); const key = derivedKey('tok', 'r1')
  let mode = 'slat'; const seen = []
  const srv = http.createServer((req, res) => {
    let b = ''; req.on('data', (d) => { b += d }); req.on('end', () => {
      seen.push({ token: req.headers['x-foreman-token'], body: b })
      if (mode === 'slat' || mode === 'forged') { const e = seal(mode === 'forged' ? 'x'.repeat(64) : key, { from: 'foreman:r1', to: 'lacuna', kind: 'reply', body: { ok: true, n: 7 }, at: h.now() }); res.writeHead(201, { 'content-type': 'application/slat', 'x-slat-sig': e.sig }); return res.end(e.slat) }
      if (mode === 'json') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end('{"ok":true}') }
      res.writeHead(200); res.end(mode === 'junk' ? 'not json' : '')
    })
  })
  await new Promise((r) => srv.listen(path.join(dir, 'foreman-r1.sock'), r)); t.after(() => srv.close())
  assert.deepEqual(await sf.forward('r1', 'POST', '/workers', { name: 'x' }), { code: 201, body: { ok: true, n: 7 } })
  assert.deepEqual(seen[0], { token: key, body: '{"name":"x"}' })
  mode = 'forged'; const fg = await sf.forward('r1', 'GET', '/workers/w'); assert.equal(fg.code, 502); assert.match(fg.body.why, /dropped \(forged\)/)
  mode = 'json'; assert.deepEqual(await sf.forward('r1', 'GET', '/workers/w'), { code: 200, body: { ok: true } })
  mode = 'junk'; assert.equal((await sf.forward('r1', 'GET', '/workers/w')).body.why, 'the run foreman answered with no JSON')
  mode = 'none'; assert.equal((await sf.forward('r1', 'GET', '/workers/w')).body.why, 'the run foreman answered with no JSON')
  srv.close(); fs.rmSync(path.join(dir, 'foreman-r1.sock'), { force: true })
  const gone = await sf.forward('r1', 'GET', '/workers/w'); assert.equal(gone.code, 502); assert.match(gone.body.why, /the run foreman r1 did not answer/)
})

// spec: eng §3.2 row 14 (HTTP over the child's socket, one try) · eng §3.5 (a hop has a deadline: 10 s here) · J18
// class: J18 a Promise that never settles (a child's door that never answers)
// technique: a real Unix socket server that accepts and never answers (no fake clock reaches a socket's own timeout)
// method: forward to it; after the 10 s socket timeout the answer is 502 "did not answer: timeout"; the test allows 13 s
// sre: if a run foreman hangs, does the root's door answer the desk within its deadline instead of hanging with it?
test('forward to a child that never answers ends at 10 s with 502 "timeout"', { timeout: 15_000 }, async (t) => {
  const dir = fs.mkdtempSync('/private/tmp/lacuna-unit/U3/ft-'); t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const h = host(); const sf = make(h, fakeFork(), { sockDir: dir }); sf.spawn('r1')
  const srv = http.createServer(() => {}); await new Promise((r) => srv.listen(path.join(dir, 'foreman-r1.sock'), r))
  t.after(() => { srv.closeAllConnections?.(); srv.close() })
  const t0 = Date.now(); const r = await sf.forward('r1', 'GET', '/workers/w')
  const elapsed = Date.now() - t0
  assert.equal(r.code, 502); assert.match(r.body.why, /did not answer: timeout/); assert.ok(elapsed >= 9_900 && elapsed < 13_000, `${elapsed} ms`)
})
