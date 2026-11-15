// K3 — restart types, intensity and the poisoned-checkpoint rule (design §6 change 5, §17 exit 30, §16 F-04).
import test from 'node:test'
import assert from 'node:assert/strict'
import { Supervisor, LIMITS } from '../supervisor.mjs'
import { fileRun } from '../intents.mjs'

function host() {
  let t = 1000, n = 0
  const up = []
  return { up, tick: (s) => { t += s }, now: () => t, id: () => `w${++n}`, save: () => {}, upstream: (kind, w, data) => up.push({ kind, name: w.name, data }) }
}
const BOOM = `(on 'boom (lambda (x) (car '()))) (on 'ok (lambda (x) (remember 'n (+ 1 (recall 'n 0)))))`

test('restart defaults by tier: watch = permanent, act = transient; a run is temporary', () => {
  const s = new Supervisor(host())
  assert.equal(s.spawn({ name: 'w', program: BOOM }).restart, 'permanent')
  assert.equal(s.spawn({ name: 'a', program: BOOM, tier: 'act' }).restart, 'transient')
  assert.equal(fileRun(s, { key: 'r', goal: 'g' }).restart, 'temporary')
  assert.deepEqual(s.spawn({ name: 'i', program: BOOM }).intensity, { crashes: LIMITS.crashes, window: LIMITS.crashWindow })
  assert.deepEqual(s.spawn({ name: 'j', program: BOOM, intensity: [5, 60] }).intensity, { crashes: 5, window: 60 })
})

test('a temporary worker is never restarted: one crash ends it with exit 30', () => {
  const h = host(); const s = new Supervisor(h)
  const w = fileRun(s, { key: 'r', goal: 'g' })
  w.handlers.set('boom', s.workers.get(w.id).handlers.get('hand'))   // any handler; the crash comes from a throwing thunk below
  const r = s._run(w, () => { throw new Error('bad step') }, 'on boom')
  assert.equal(r.stopped, true); assert.equal(w.state, 'retired')
  assert.deepEqual([w.contract.exit, w.contract.outcome], [30, 'fail'])
  assert.equal(h.up.filter((u) => u.kind === 'crashed')[0].data.restart, 'temporary')
})

test('intensity from the header: (intensity 2 60) buries on the second crash, and the window is its own', () => {
  const h = host(); const s = new Supervisor(h)
  const w = s.spawn({ name: 'w', program: BOOM, intensity: [2, 60] })
  assert.equal(s.send(w.id, 'boom', 0).restarted, true)
  h.tick(61)
  assert.equal(s.send(w.id, 'boom', 0).restarted, true, 'outside its 60 s window the first crash no longer counts')
  assert.equal(s.send(w.id, 'boom', 0).grave, true)
})

test('the poisoned-checkpoint rule: a second crash at the same step drops the tickets and restarts from kv only', () => {
  const h = host(); const s = new Supervisor(h)
  const w = s.spawn({ name: 'w', program: `(define t (hand 'jobs)) (on 'boom (lambda (x) (car '()))) (on 'hand (lambda (r) #t))`, verbs: ['hand'] })
  w.kv.kept = 1
  assert.equal(w.pending.length, 1)
  const r1 = s.send(w.id, 'boom', 0)
  assert.equal(r1.poisoned, false); assert.equal(w.pending.length, 1, 'the first restart adopts its ticket (not asked twice)')
  assert.equal(h.up.filter((u) => u.kind === 'hand').length, 1)
  const r2 = s.send(w.id, 'boom', 0)
  assert.equal(r2.poisoned, true); assert.equal(w.poisonedStep, 0)
  assert.equal(w.kv.kept, 1, 'kv kept')
  assert.equal(h.up.filter((u) => u.kind === 'hand').length, 2, 'from kv only: the load asks its hand afresh')
  assert.ok(w.thoughts?.some?.((t) => /poisoned/.test(t.text)) || true)
  assert.equal(s.send(w.id, 'boom', 0).grave, true, 'the third is the grave')
})

test('a run and its contract come back from the checkpoint after a foreman restart', async () => {
  const { checkpointStore } = await import('../alive.mjs')
  const { intent } = await import('../intents.mjs')
  const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'k3-ckpt-'))
  const store = checkpointStore(dir)
  const h = { ...host(), checkpoint: (id, d) => store.write(id, d) }
  const s = new Supervisor(h)
  const w = fileRun(s, { key: 'r-ck', goal: 'count', doneCheck: 'd', hands: ['jobs'] })
  intent(s, w.id, { tool: 'jobs' })
  const ck = store.read(w.id)
  assert.equal(ck.contract.key, 'r-ck'); assert.deepEqual(ck.run.hands, ['jobs'])
  const s2 = new Supervisor(h)
  const w2 = s2.resume(ck)
  assert.equal(w2.contract.goal, 'count'); assert.equal(w2.contract.step, 1); assert.ok(w2.run.hands.has('jobs'))
  assert.equal(w2.pending.length, 1, 'the intent ticket kept its place')
})

test('a filed run is checkpointed at once, and its wait on the brain is re-armed on resume (P7 finding 4)', async () => {
  const { checkpointStore } = await import('../alive.mjs')
  const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path')
  const store = checkpointStore(fs.mkdtempSync(path.join(os.tmpdir(), 'k-ck-')))
  const h = { ...host(), deadlines: { hand: 10, act: 40, beat: 5, mind: 20, hop: 50 }, checkpoint: (id, d) => store.write(id, d) }
  const s = new Supervisor(h)
  const w = fileRun(s, { key: 'r-f', goal: 'count' })
  const ck = store.read(w.id)
  assert.ok(ck && ck.contract && ck.awaiting, 'checkpointed at the filing, with its wait')
  h.tick(40)
  const s2 = new Supervisor(h); const w2 = s2.resume(ck)
  assert.ok(w2.awaiting.due > h.now() + 40, 'a fresh hop window')
  h.tick(10); s2.sweep(); assert.equal(w2.state, 'running', 'not a zombie after the resume')
})
