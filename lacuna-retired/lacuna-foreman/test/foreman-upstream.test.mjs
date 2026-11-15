// foreman-upstream.test.mjs — U3: THE WAY UPSTREAM (`post`, `drain`, the queue files, the drive and cascade roads). Owns:
// the tests that put a scriptable door (up, down, slow, 500) in front of a scratch foreman and read what the door received
// and what waits in `upstream-queue.jsonl` and `cascade-queue.jsonl`: every event once, sealed at send time, nothing lost
// while the door is down or slow, nothing posted twice, no retry loop, no crash when the disk refuses the queue.
// Refuses: the live door (:1138); a mock of foreman.mjs. Implements: unit-test work order §3 row foreman.mjs (`post`/`drain`;
// eng §3.2 rows 5, 6, 7; §3.5 upstream queue drained every 30 s, cascade queue every 60 s; §10.2 "upstream queue, door
// down: drained, no loop"; burn-in B32; law 10). Invariants (§18): none by sentence; the record here is "nothing lost,
// nothing retried in a loop" (eng §3.5). Faults (§16): none by id (the queue is the fault's absence).
// coverage: foreman.mjs — see foreman-door.test.mjs (2026-10-24)
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { boot, scriptDoor, scratch, until, sleep, PROBE } from './foreman-box.mjs'
import { Gate } from '../protocol.mjs'

/** A door with a mode the test turns: up · down (socket destroyed) · slow (hangs `ms`, then destroyed) · 500. */
async function modalDoor(t, ms = 400) {
  const state = { mode: 'up', ev: [], drives: [] }
  const d = await scriptDoor((p, body) => {
    if (p === '/api/home/series') return { body: {} }
    if (state.mode === 'down') return { destroy: true }
    if (state.mode === 'slow') return { hang: ms, destroy: true }
    if (state.mode === '500') return { status: 500, body: { ok: false } }
    if (p === '/api/foreman/event') state.ev.push(body)
    if (/\/drive$/.test(p)) state.drives.push(body)
    return { body: { ok: true } }
  })
  t.after(() => d.close())
  return Object.assign(state, { door: d })
}
const pongs = (st) => st.ev.filter((e) => e.kind === 'report' && e.data?.kind === 'pong').map((e) => e.data.data[0])
const queue = (dir, name = 'upstream-queue.jsonl') => { try { return fs.readFileSync(path.join(dir, name), 'utf8').split('\n').filter(Boolean) } catch { return [] } }

// spec: eng §3.2 row 6 (JSON body with the sealed {slat, sig} merged beside the plain fields; `X-Lacuna-Who: foreman:<name>`) · law 5 · law 7
// class: W8 a reply that cannot be sealed (what slat cannot carry turns into null first)
// technique: a scriptable door that records every event
// method: spawn a probe; ping it; read the report event: the plain fields, the sealed slat opened with the token (from
//         foreman:burn to lacuna, kind upstream) whose body equals the plain fields, the who header
// sre: if Python or a later reader checks the signature, does every upstream event carry one over the exact fields it sent?
test('an upstream event carries its plain fields and a signed (msg … (kind upstream)) of the same fields, sealed at send time', async (t) => {
  const st = await modalDoor(t)
  const { f } = await boot(t, { tag: 'up', door: st.door })
  const w = (await f.call('POST', '/workers', { name: 'probe', program: PROBE })).body.worker
  await f.event(w.id, 'ping', 1)
  const e = await until(() => st.ev.find((x) => x.kind === 'report'))
  assert.deepEqual([e.foreman, e.worker.id, e.worker.name, e.data.kind], ['burn', w.id, 'probe', 'pong'])
  const o = new Gate(f.token(), () => Date.now() / 1000).open({ slat: e.slat, sig: e.sig })
  assert.equal(o.ok, true); assert.deepEqual([o.msg.from, o.msg.to, o.msg.kind], ['foreman:burn', 'lacuna', 'upstream'])
  const { slat, sig, ...plain } = e
  assert.deepEqual(o.msg.body, plain)
  assert.equal(st.door.seen.find((x) => x.path === '/api/foreman/event').headers['x-lacuna-who'], 'foreman:burn')
})

// spec: eng §3.5 ("upstream queue drained every 30 s … nothing is lost, nothing is retried in a loop") · B32 · law 10
// class: E9 a message lost (door down); J9 ECONNRESET
// technique: time travel (foreman-clock.mjs: the 30 s drain every 300 ms) and a door that destroys the socket, then answers 500, then is up
// method: door down: three pings → three lines in the queue, no crash; door 500: still queued (a non-2xx is a failure);
//         door up: the queue empties and every pong arrives exactly once (in the order the posts failed; each carries `at`)
// sre: if Lacuna's API is down for a while, does every event wait on disk and arrive exactly once when it returns?
test('door down or 500: events wait in the queue file; when the door returns each arrives once and the queue empties', async (t) => {
  const st = await modalDoor(t)
  const { f, dir } = await boot(t, { tag: 'q', door: st.door, clock: 0.01 })
  const w = (await f.call('POST', '/workers', { name: 'probe', program: PROBE })).body.worker
  st.mode = 'down'
  for (let i = 0; i < 3; i++) await f.event(w.id, 'ping', i)
  assert.ok(await until(() => queue(dir).filter((l) => l.includes('"pong"')).length === 3), 'three waiting')
  st.mode = '500'; await sleep(700)
  assert.equal(queue(dir).filter((l) => l.includes('"pong"')).length, 3, 'a 500 is not a delivery')
  st.mode = 'up'
  assert.ok(await until(() => queue(dir).length === 0, 4000), 'drained')
  assert.deepEqual([...pongs(st)].sort((a, b) => a - b), [1, 2, 3], 'each once (the queue keeps failure order; each event carries its `at`)')
})

// spec: eng §3.5 ("nothing is lost, nothing is retried in a loop") · B32 · law 4 spirit (never re-sent)
// class: E9 a message lost and E10 a duplicate message (two drains over one file; an append during a drain)
// technique: time travel (drain every 300 ms) against a slow door (each try hangs 400 ms then fails): drains overlap, and
//            new events fail and append while a drain is still posting
// method: queue three pongs with the door down; make the door slow; ping three more while drains run; bring the door up;
//         wait for the queue to empty; the door must hold pongs 1–6, each exactly once
// sre: if the door is slow when it comes back, does the queue still deliver every event exactly once?
test('a slow door never loses an event appended during a drain, and two drains never post one line twice', async (t) => {
  const st = await modalDoor(t, 400)
  const { f, dir } = await boot(t, { tag: 'race', door: st.door, clock: 0.01 })
  const w = (await f.call('POST', '/workers', { name: 'probe', program: PROBE })).body.worker
  st.mode = 'down'
  for (let i = 0; i < 3; i++) await f.event(w.id, 'ping', i)
  await until(() => queue(dir).filter((l) => l.includes('"pong"')).length === 3)
  st.mode = 'slow'
  for (let i = 0; i < 3; i++) { await sleep(250); await f.event(w.id, 'ping', i) }
  await sleep(900)
  st.mode = 'up'
  await until(() => queue(dir).length === 0 && pongs(st).length >= 6, 6000)
  await sleep(700)
  assert.deepEqual([...pongs(st)].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6], `got ${JSON.stringify(pongs(st))}`)
})

// spec: eng §3.5 (the queue is the record while the door is down) · J11 (fs EISDIR/ENOSPC on the queue) · design §16 (a fault is said, never a death)
// class: J11 fs refusal on the queue file; J1 an unhandled rejection in the upstream catch
// technique: fault injection: the queue path is a directory; and a person removes the queue file in the middle of a drain
// method: (a) boot with upstream-queue.jsonl a directory; door down; ping; the foreman is still up 1 s later and its log
//         says the event could not be queued; (b) on another foreman, with a slow door, delete the queue file during a
//         drain: the drain ends, the foreman stays up and the lines it could not post are written back; (c) a queue file
//         made read-only (0444) while lines wait: the drain posts them, cannot rewrite the file, says so, and stays up
// sre: if the disk refuses the queue, does the foreman keep supervising and say what it lost, instead of crashing?
test('a queue the disk refuses never kills the foreman: the event is named as lost; a queue removed mid-drain is written back', async (t) => {
  const st = await modalDoor(t)
  const dir = scratch('qdir'); fs.mkdirSync(path.join(dir, 'upstream-queue.jsonl'), { recursive: true })
  const { f } = await boot(t, { dir, door: st.door })
  const w = (await f.call('POST', '/workers', { name: 'probe', program: PROBE })).body.worker
  st.mode = 'down'
  await f.event(w.id, 'ping', 1)
  await sleep(1000)
  assert.equal(f.exited, null, 'still up'); assert.equal((await f.call('GET', '/health')).status, 200)
  assert.ok(f.log.some((l) => /could not queue report/.test(l)), f.log.slice(-3).join(' | '))
  const st2 = await modalDoor(t, 600)
  const { f: g, dir: d2 } = await boot(t, { tag: 'qrm', door: st2.door, clock: 0.01 })
  const w2 = (await g.call('POST', '/workers', { name: 'probe', program: PROBE })).body.worker
  st2.mode = 'down'; await g.event(w2.id, 'ping', 1)
  await until(() => queue(d2).length >= 1)
  st2.mode = 'slow'; await sleep(450)
  fs.rmSync(path.join(d2, 'upstream-queue.jsonl'), { force: true })
  await sleep(900)
  assert.equal(g.exited, null)
  assert.ok(queue(d2).some((l) => l.includes('"pong"')), 'the line it could not post is back on disk')
  st2.mode = 'down'; await g.event(w2.id, 'ping', 2); await until(() => queue(d2).length >= 2)
  fs.chmodSync(path.join(d2, 'upstream-queue.jsonl'), 0o444); st2.mode = 'up'
  assert.ok(await until(() => g.log.some((l) => l.includes('could not rewrite upstream-queue.jsonl: EACCES'))), 'a queue it cannot rewrite is named')
  assert.equal(g.exited, null)
  fs.chmodSync(path.join(d2, 'upstream-queue.jsonl'), 0o600)
})

// spec: eng §3.2 row 5 (foreman → door `POST /api/runs/<id>/drive`, JSON {run, key, goal}, one try, 10 s) · K-8 · law 10
// class: E9 a message lost (the drive answered 500; the door down)
// technique: a scriptable door: up, then 500, then down
// method: file three runs `by: cart` with hands (not desk runs): the first drive arrives with {run, key, goal}; the second
//         is answered 500 and logged; the third meets a dead door and is logged; each is tried once
// sre: if a cart files a run and the brain loop cannot take it, is that said once in the log instead of retried forever?
test('a run a cart files is handed to the drive road once: {run, key, goal, role}; a 500 or a dead door is one log line each', async (t) => {
  const st = await modalDoor(t)
  const { f } = await boot(t, { tag: 'drv', door: st.door })
  const file = (key) => f.call('POST', '/runs', { key, goal: `goal ${key}`, hands: ['disk'], by: 'cart:test' }).then((r) => r.body.run)
  const a = await file('d1')
  const d = await until(() => st.drives[0])
  assert.deepEqual(d, { run: a, key: 'd1', goal: 'goal d1', role: 'cart' })
  st.mode = '500'; const b = await file('d2')
  assert.ok(await until(() => f.log.some((l) => l.includes(`drive ${b}: the door answered 500`))))
  st.mode = 'down'; const c = await file('d3')
  assert.ok(await until(() => f.log.some((l) => l.startsWith(`${l.slice(0, 19)} drive ${c}:`) && !l.includes('answered'))))
  assert.equal(st.door.seen.filter((x) => x.path.endsWith('/drive')).length, 3, 'one try each')
})
