// foreman-restart.test.mjs — U3: KILL -9 AND THE RESUME (`reload`, `save`). Owns: the tests that kill a scratch foreman
// with SIGKILL, start it again in the same dir, and read what came back against the records on disk; and the tests that
// put records on disk the way a crash leaves them (torn, orphaned, unloadable, a checkpoint of another worker, parent and
// child born in one clock tick) and read what `reload` does with each. Refuses: the live foreman and its world; a mock of
// foreman.mjs. Implements: unit-test work order §3 row foreman.mjs (`reload`, `save`; eng §10.2 "kill -9 → back"; burn-in
// B25); design §6 (a restart resumes; §45.3 kept as history). Invariants (§18): "if a run foreman died, then its children
// are buried" (here: a worker's children come back with it, never as orphans). Faults (§16): F-06 (a resumed zombie is judged).
// coverage: foreman.mjs — see foreman-door.test.mjs's header for the lane's figure (2026-10-24)
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { boot, scratch, scratchEnv, until, PROBE } from './foreman-box.mjs'
import { startForeman, startStubDoor } from '../../../tools/burn-in/scratch.mjs'

const TIMER = `(every 60 (lambda () (remember 't (+ 1 (recall 't 0))))) ${PROBE}`
async function again(t, f, dir, o = {}) {
  const door = await startStubDoor()
  const g = await startForeman({ dir, door: door.url, port: f.port, env: scratchEnv(dir, o) })
  t.after(async () => { g.kill('SIGTERM'); await g.waitExit(3000); await door.close(); fs.rmSync(dir, { recursive: true, force: true }) })
  return g
}
const byName = async (f) => Object.fromEntries((await f.call('GET', '/workers')).body.workers.map((w) => [w.name, w]))

// spec: design §6 (a restart resumes from the checkpoint) · eng §10.2 ("kill -9 → back … kv + timers intact, living count equal") · B25 · I-06
// class: E12 the supervisor itself dies (kill -9; resume from the record); M3 a stale socket file after kill -9
// technique: process kill (SIGKILL to our own scratch child) and a restart in the same dir, port and token
// method: spawn a probe (kv n=2 after two pings), a timer worker and a third worker we pause; kill -9; the socket file is
//         still there; boot again; read /workers: three living, kv n=2, one timer, the paused one paused, and the socket answers
// sre: if the box kills the foreman, does every worker come back as it was, and does the next start clear the dead socket?
test('kill -9 then a start in the same dir: every living worker is back with its kv, its timer and its pause; the stale socket is replaced', async (t) => {
  const { f, dir } = await boot(t, { tag: 'k9', keep: true })
  const p = (await f.call('POST', '/workers', { name: 'probe', program: PROBE })).body.worker
  await f.event(p.id, 'ping', 1); await f.event(p.id, 'ping', 2)
  await f.call('POST', '/workers', { name: 'timer', program: TIMER })
  const z = (await f.call('POST', '/workers', { name: 'held', program: PROBE })).body.worker
  assert.equal((await f.call('POST', `/workers/${z.id}/interrupt`, { mode: 'pause', by: 'test' })).status, 200)
  const before = (await f.call('GET', '/health')).body.living
  f.kill('SIGKILL'); await f.waitExit()
  assert.equal(fs.existsSync(f.sock), true, 'kill -9 leaves the socket file behind')
  const g = await again(t, f, dir)
  assert.equal((await g.call('GET', '/health', undefined, { uds: true })).status, 200, 'the socket answers again')
  assert.equal((await g.call('GET', '/health')).body.living, before)
  const w = await byName(g)
  assert.equal(w.probe.kv.n, 2); assert.equal(w.timer.timers, 1); assert.equal(w.held.state, 'paused')
  assert.ok(g.log.some((l) => l.includes(`brought back ${before} living worker(s)`)))
})

// spec: design §6 (a restart resumes; never a blank worker) · foreman.mjs reload ("an orphan whose parent did not come back")
// class: E16 a stale checkpoint older than the record; J7 JSON.parse on hostile input (a torn record)
// technique: state put on disk the way a crash leaves it, then a boot (no clock, no mock)
// method: write six records: one torn; one retired; one living with no checkpoint (its pending ticket on the record);
//         one living whose checkpoint names another id; one whose program cannot load (empty); one orphan whose parent
//         has no record; two records that name each other as parent; two records with no reports or children; plus the mind counts, reports, restarts and started on one. Boot; kill -9 before any event (a
//         crash loop); boot again; read /workers, the record file and the log
// sre: if the disk holds what a crash left, does the foreman bring back what it can, say what it could not, and never die on it?
test('reload: a torn record is skipped, a retired one is listed not run, a record without a usable checkpoint comes back from itself, an unloadable one is named', async (t) => {
  const dir = scratch('rec'); const W = path.join(dir, 'workers'); const C = path.join(dir, 'ckpt')
  fs.mkdirSync(W, { recursive: true }); fs.mkdirSync(C, { recursive: true })
  const rec = (id, o = {}) => ({ id, name: id, program: PROBE, tier: 'watch', parent: null, state: 'running', kv: {}, reports: [], started: 100, children: [], ...o })
  const put = (r) => fs.writeFileSync(path.join(W, `${r.id}.json`), JSON.stringify(r))
  fs.writeFileSync(path.join(W, 'w-torn.json'), '{"id": "w-torn", "state": "runn')
  put(rec('w-ret', { state: 'retired', last: 'stopped by test' }))
  put(rec('w-nock', { kv: { n: 5 }, reports: [{ kind: 'pong' }], pending: [{ ticket: 't-1', kind: 'hand', op: 'disk', args: [], sent_at: 99, deadline_at: 4e9, tries: 1 }],
                      mind: { asked: 3, ran: 2 }, restarts: 4, started: 77 }))
  put(rec('w-other', { kv: { n: 1 } })); fs.writeFileSync(path.join(C, 'w-other.json'), JSON.stringify({ id: 'w-else', name: 'w-else', program: PROBE, kv: { n: 99 } }))
  put(rec('w-bad', { program: '' }))
  put(rec('w-orph', { parent: 'w-gone' }))
  put(rec('w-cy1', { parent: 'w-cy2' })); put(rec('w-cy2', { parent: 'w-cy1' }))   // a parent loop a torn write could leave: both orphans, no hang
  for (const [id, state] of [['w-bare', 'running'], ['w-bret', 'retired']]) put({ id, name: id, program: PROBE, tier: 'watch', parent: null, state, kv: {}, started: 100 })   // records older than reports and children
  const { f } = await boot(t, { dir, keep: true })
  assert.ok(f.log.some((l) => /could not bring back w-bad a worker needs a program/.test(l)))
  f.kill('SIGKILL'); await f.waitExit()                    // a second death before any event: what the first resume wrote is all there is
  const g = await again(t, f, dir)
  const w = await byName(g)
  assert.deepEqual(Object.keys(w).sort(), ['w-bare', 'w-bret', 'w-nock', 'w-other', 'w-ret'])
  assert.deepEqual([w['w-bare'].reports, w['w-bret'].children], [[], []])
  assert.equal(w['w-ret'].state, 'retired')
  assert.equal(w['w-nock'].kv.n, 5); assert.equal(w['w-nock'].pending[0].ticket, 't-1'); assert.equal(w['w-nock'].started, 77)
  assert.equal(w['w-nock'].mind.asked, 3); assert.equal(w['w-nock'].reports.length, 1)
  assert.equal(w['w-other'].kv.n, 1, 'a checkpoint of another id is not this worker')
  assert.equal(JSON.parse(fs.readFileSync(path.join(W, 'w-nock.json'), 'utf8')).restarts, 4, 'restarts survive in the record')
  assert.equal(fs.existsSync(path.join(W, 'w-orph.json')), true, 'the orphan record is left on disk for a person')
})

// spec: design §6 (a restart resumes) · I-06 ("its children are buried", never orphaned by the restart) · POSTMORTEMS 2026-10-24 B02
//       (never order by a clock what the system already orders by a list)
// class: E14 a split between root and child records (parent and child born in one clock tick)
// technique: state on disk: two records with one `started` (a host clock in whole seconds or one millisecond), the child's id
//            listed first by the directory; then a boot
// method: spawn a parent and a child through the door; kill -9; give both records and checkpoints one `started` and ids
//         that sort child first; boot; both must be living and the parent must list the child
// sre: if a worker and its child were born in the same tick, does a restart bring the child back, or lose it as an orphan?
test('a child born in its parent\'s clock tick comes back after kill -9 even when its record is read first', async (t) => {
  const { f, dir } = await boot(t, { tag: 'tie', keep: true })
  const par = (await f.call('POST', '/workers', { name: 'par', program: PROBE })).body.worker
  const kid = (await f.call('POST', '/workers', { name: 'kid', program: PROBE, parent: par.id })).body.worker
  f.kill('SIGKILL'); await f.waitExit()
  const ids = { [kid.id]: 'w-a-kid', [par.id]: 'w-b-par' }
  for (const sub of ['workers', 'ckpt']) {
    for (const file of fs.readdirSync(path.join(dir, sub))) {
      const p = path.join(dir, sub, file); let text = fs.readFileSync(p, 'utf8')
      for (const [from, to] of Object.entries(ids)) text = text.split(from).join(to)
      const j = JSON.parse(text); j.started = 1792800000; if (j.t) j.t = 1792800000
      fs.unlinkSync(p); fs.writeFileSync(path.join(dir, sub, `${j.id}.json`), JSON.stringify(j))
    }
  }
  assert.deepEqual(fs.readdirSync(path.join(dir, 'workers')), ['w-a-kid.json', 'w-b-par.json'], 'the child is read first')
  const g = await again(t, f, dir)
  const w = await byName(g)
  assert.equal(w.par?.state, 'running'); assert.equal(w.kid?.state, 'running', 'the child came back')
  assert.deepEqual(w.par.children, ['w-a-kid']); assert.equal(w.kid.parent, 'w-b-par')
})

test.todo('E17 doubled on restart: a parent whose program spawns a child at load comes back with two children after kill -9 (the resumed child and a new one from its re-run load); supervisor.mjs/verbs.mjs `spawn` on a resume is lane U1\'s (MAIL [U3] [U1] 2026-10-24)')

// spec: design §8 (the contract) · design §6 change 3 (the contract survives a foreman restart) · K3 · P7 finding 4
// class: E12 the supervisor itself dies (a run in flight)
// technique: process kill and restart
// method: file a run and accept one intent; kill -9; boot; GET /contracts/<id> is the same contract with step 1; the
//         run's header (hands) and its pending ticket are back
// sre: if the foreman dies mid-run, does the brain find the same run, the same step and the same ticket after the restart?
test('a run in flight comes back after kill -9 with its contract, its header and its ticket', async (t) => {
  const { f, dir } = await boot(t, { tag: 'run9', keep: true })
  const run = (await f.call('POST', '/runs', { key: 'k9-run', goal: 'read the disk', hands: ['disk'] })).body.run
  const i = (await f.call('POST', `/runs/${run}/intents`, { tool: 'disk', args: ['/'] })).body
  const c1 = (await f.call('GET', `/contracts/${run}`)).text
  f.kill('SIGKILL'); await f.waitExit()
  const g = await again(t, f, dir)
  const c2 = (await g.call('GET', `/contracts/${run}`)).text
  assert.equal(c2, c1)
  const h = (await g.call('GET', `/runs/${run}/header`)).body
  assert.deepEqual(h.hands, ['disk']); assert.equal(h.key, 'k9-run')
  const w = (await g.call('GET', `/workers/${run}`)).body.worker
  assert.equal(w.pending[0].ticket, i.ticket)
  assert.ok(await until(async () => (await g.call('GET', '/runs')).body.runs.some((r) => r.id === run)), 'listed as living')
})

// class: E12 the supervisor itself dies (a paused run) · L4 a false record (the runs list says running)
// technique: process kill and restart
// method: file a run, pause it, kill -9, boot; GET /runs and GET /workers/<id> both say paused
// sre: after a restart, can the desk show a run the owner paused as running? (2026-11-01: the forge-tender's worker came back
//      paused, its contract running, and the runs list said running; the checkpoint held the contract from before the pause)
test('a paused run comes back paused, its contract too: the runs list never says a paused run runs', async (t) => {
  const { f, dir } = await boot(t, { tag: 'pause9', keep: true })
  const run = (await f.call('POST', '/runs', { key: 'k9-paused', goal: 'read the disk', hands: ['disk'] })).body.run
  await f.call('POST', `/runs/${run}/intents`, { tool: 'disk', args: ['/'] })
  assert.equal((await f.call('POST', `/workers/${run}/interrupt`, { mode: 'pause', by: 'test' })).status, 200)
  const state = async (g) => (await g.call('GET', '/runs')).body.runs.find((r) => r.id === run)?.state
  assert.equal(await state(f), 'paused', 'paused before the kill')
  f.kill('SIGKILL'); await f.waitExit()
  const g = await again(t, f, dir)
  assert.ok(await until(async () => (await state(g)) !== undefined), 'listed as living')
  assert.equal((await g.call('GET', `/workers/${run}`)).body.worker.state, 'paused')
  assert.equal(await state(g), 'paused', 'the runs list says what the worker is')
})

test.todo('E12 what is lost: a finished run\'s contract is not in its worker record (save() keeps no contract), so after a restart GET /contracts/<id> is 404 for it; the hands\' runs/<id>/CONTRACT.slat holds it. Whether the door should read that file is the lead\'s call (MAIL [U3] [lead] 2026-10-24)')
