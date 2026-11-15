// foreman-manners.test.mjs — U3: THE ROOT'S MANNERS, ITS MINDS AND ITS METRICS. Owns: the tests that make a scratch foreman
// hush (its own memory, the box's memory as Lacuna samples it, the load, the event loop's lag) and calm again, ask its small
// minds through a scriptable door (an answer, a 500, a refusal, the 26B rung), keep the cascade's records (queued when the
// door is down, drained when it returns), deliver subscribed metrics, and read its tables. Refuses: the live door and the
// brain; a mock of foreman.mjs. Implements: unit-test work order §3 row foreman.mjs (eng §3.5 "manners: judged every 15 s;
// RSS 400 MB · free 900 MB · load 0.9/core · lag 250 ms", "cascade queue every 60 s", "the small mind 60 s; the 26B as a
// rung 300 s"; eng §3.2 row 7; design §10). Invariants (§18): "if a mind's gate is below 90% per class, then its verdicts are
// advice" (the shadow flag reaches every rung). Faults (§16): F-20 (the foreman hushes on its memory), F-16.
// coverage: foreman.mjs — see foreman-door.test.mjs (2026-10-24)
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { boot, scriptDoor, scratch, until, sleep, memoryHands, PROBE } from './foreman-box.mjs'

const BOX = JSON.parse(fs.readFileSync(new URL('./fixtures/box-minds.json', import.meta.url), 'utf8'))
const TIERS = { models: [{ model: 'functiongemma:latest', params_b: 0.27 }, { model: 'gemma3:270m', params_b: 0.27 }, { model: 'gemma3:1b', params_b: 1.0 }, { model: 'lacuna-worker-lite', params_b: 25.2 }],
  classes: { label: { pick: 'lacuna-worker-lite', ranked: [{ model: 'lacuna-worker-lite', params_b: 25.2, pct: 100 }, { model: 'gemma3:1b', params_b: 1.0, pct: 70 }, { model: 'functiongemma:latest', params_b: 0.27, pct: 36.4 }] } } }
const SENTRY = `(lacuna-cart 'sentry
  '((does . "reads a log once") (agent . ((tier . watch) (verbs . (on report mind-job mind done))))
    (minds . ((label . ((job . signal->label) (labels . (noise real-error new-thing)) (untrusted . #t))))) (done . "read")))
(mind-job 'label '(:ask "what is this line?" :needs (line) :labels (noise real-error new-thing) :untrusted #t))
(on 'line (lambda (l) (mind 'label (list (cons 'line l)))))
(on 'mind (lambda (m) (report 'heard (get m 'label 'unread))))`
const TALKER = `(mind-job 'chat '(:ask "?" :needs (x) :labels (a b)))\n${PROBE}`

/** A door whose memory sample, mind answers and cascade road the test sets. */
async function mindDoor(t, s = {}) {
  const st = { memGb: 8, mind: 'ok', cascade: 'up', minds: [], cascades: [], events: [], series: 0, ...s }
  const d = await scriptDoor((p, b) => {
    if (p === '/api/home/series') { st.series++; if (st.memGb === 'down') return { destroy: true }; const now = Date.now() / 1000; return { body: st.memGb == null ? {} : { mem_available_gb: [[now, st.memGb]], cpu_pct: [[now - 5, 1], [now, 42]] } } }
    if (p === '/api/foreman/mind') {
      st.minds.push(b)
      if (st.mind === '500') return { status: 500 }
      if (st.mind === 'no') return { body: { ok: false, why: 'the slot is busy' } }
      if (st.mind === 'bare') return { body: { ok: false } }
      if (b.job === 'talk') return { body: st.mind === 'empty' ? { ok: true } : { ok: true, text: '(say "all is quiet")', certainty: 0.8, box: 'studio' } }
      return { body: b.last ? { ok: true, text: "(label 'real-error)", certainty: 0.95 } : { ok: true, text: "(label 'noise)", certainty: 0.2 } }
    }
    if (p === '/api/foreman/cascade') { if (st.cascade === 'down') return { destroy: true }; if (st.cascade === '500') return { status: 500 }; st.cascades.push(b); return { body: { ok: true } } }
    if (p === '/api/foreman/event') st.events.push(b)
    return { body: { ok: true } }
  })
  t.after(() => d.close())
  return Object.assign(st, { door: d })
}
function tables(dir) { fs.writeFileSync(path.join(dir, 'tiers.json'), JSON.stringify(TIERS)); fs.writeFileSync(path.join(dir, 'box.json'), JSON.stringify(BOX)) }
const health = async (f) => (await f.call('GET', '/health')).body

// spec: eng §3.5 (manners: RSS 400 MB · free 900 MB · load 0.9/core · lag 250 ms; judged every 15 s) · F-20 · design §6 (a hushed foreman spawns nothing new)
// class: B2 RSS flat (the budget's own judge); M6 memory pressure (Lacuna's available sample)
// technique: boundary by env (a budget the foreman is already over) and time travel (the 15 s judge every 150 ms)
// method: (a) FOREMAN_RSS_MB=1: /health.hushed names "my memory", a `manners` event goes up once, a new spawn is refused
//         "not now — the foreman is hushed"; (b) the door's memory sample under FOREMAN_FREE_MB: "the box has 500 MB free";
//         (c) FOREMAN_LOAD=0: "the box's load"; each budget visible on /health.budget
// sre: if the box is short of memory or busy, does the foreman stop taking new work and say why, once?
test('hush: over its own RSS, under the box\'s free memory or over the load, the foreman says why once and refuses a new spawn', async (t) => {
  const st = await mindDoor(t)
  const { f } = await boot(t, { tag: 'rss', door: st.door, clock: 0.01, env: { FOREMAN_RSS_MB: '1', FOREMAN_LOAD: '1000' } })
  assert.ok(await until(async () => /my memory \d+ MB is over 1/.test((await health(f)).hushed)))
  const sp = await f.call('POST', '/workers', { name: 'late', program: PROBE })
  assert.equal(sp.status, 400); assert.match(sp.body.why, /not now — the foreman is hushed/)
  await sleep(400)
  assert.equal(st.events.filter((e) => e.kind === 'manners').length, 1, 'said once, not every judge')
  assert.equal((await health(f)).budget.rssMB, 1)
  const st2 = await mindDoor(t, { memGb: 0.5 })
  const m2 = await memoryHands(t, st2)
  const { f: g } = await boot(t, { dir: m2.dir, door: st2.door, clock: 0.01, env: { FOREMAN_LOAD: '1000', ...m2.env } })
  assert.ok(await until(async () => /the box has 500 MB free/.test((await health(g)).hushed)))
  assert.equal(st2.series, 0, 'E1.3: the memory comes from the governor, never the API\'s series')
  const { f: h } = await boot(t, { tag: 'load', door: (await mindDoor(t)).door, clock: 0.01, env: { FOREMAN_LOAD: '0' } })
  assert.ok(await until(async () => /the box's load is/.test((await health(h)).hushed)))
})

// spec: eng §3.5 (lag 250 ms; "the foreman hushes background work when the box is busy") · Node "Don't block the event loop"
// class: J3 the event loop blocked
// technique: starvation by load: concurrent /check trials of a program that spins near its fuel, so one poll phase runs > 250 ms
// method: boot with clock 0.01 (judge every 150 ms, the lag probe every 10 ms); send rounds of 8 heavy /check requests at
//         once until /health.hushed says "ms behind" (at most 40 rounds); /health.lag_ms is a number throughout
// sre: if something blocks the foreman's loop, does it notice its own lateness and stop taking background work?
test('a blocked event loop: lag over 250 ms is a hush that names the lag', async (t) => {
  const { f } = await boot(t, { tag: 'lag', door: (await mindDoor(t)).door, clock: 0.01, env: { FOREMAN_LOAD: '1000' } })
  const spin = `(define (spin n) (if (> n 0) (spin (- n 1)) 0))\n${Array.from({ length: 24 }, (_, i) => `(on 'a${i} (lambda (x) (spin 4000)))`).join('\n')}`
  let hushed = null
  for (let i = 0; i < 40 && !hushed; i++) {
    await Promise.all(Array.from({ length: 8 }, () => f.call('POST', '/check', { program: spin }).catch(() => null)))
    const h = await health(f); assert.equal(typeof h.lag_ms, 'number')
    if (/ms behind/.test(h.hushed || '')) hushed = h.hushed
  }
  assert.match(hushed || '', /I am \d+ ms behind/)
})

// spec: eng §3.5 (manners: calm again after 60 s under every budget) · design §6 · J14 (a clock that jumps forward)
// class: J14 clock jumps (forward past the calm window)
// technique: time travel: the door's memory sample goes low then high; SIGUSR2 moves the foreman's Date.now 61 s forward
// method: hush on "free" memory; the door's sample recovers (the hush holds, no second manners event); the sample is gone for
//         a turn (memory not judged: never a false hush); the clock jumps 61 s; /health.hushed is null and a `manners`
//         event with hushed false and `was` goes up
// sre: if the box recovers, does the foreman resume work by itself, and only after a calm minute?
test('calm again: after the box recovers and a minute passes, the hush lifts and says what it was', async (t) => {
  const st = await mindDoor(t, { memGb: 0.5 })
  const hands = await memoryHands(t, st)
  const { f } = await boot(t, { dir: hands.dir, door: st.door, clock: 0.01, env: { FOREMAN_LOAD: '1000', ...hands.env } })
  assert.ok(await until(async () => (await health(f)).hushed))
  st.memGb = 8; await sleep(300)
  assert.ok((await health(f)).hushed, 'not before the calm minute')
  st.memGb = null; await sleep(200); st.memGb = 'down'; await sleep(200); st.memGb = 8; await sleep(200)
  f.kill('SIGUSR2')
  assert.ok(await until(async () => (await health(f)).hushed === null))
  await until(() => st.events.filter((e) => e.kind === 'manners').length === 2)
  const m = st.events.filter((e) => e.kind === 'manners')
  assert.deepEqual(m.map((e) => e.data.hushed), [true, false]); assert.match(m[1].data.was, /MB free/)
})

// spec: design §10 (the small minds and the 26B as a cascade's last rung) · eng §3.2 row 7 (`POST /api/foreman/mind`, token header; 60 s / 300 s) · §3.5 cascade queue 60 s
// class: E9 a message lost (cascade records while the door is down); J18 a hop that never answers (each mind call has a deadline)
// technique: a scriptable door: small rungs unsure, the 26B sure; the cascade road down then up; time travel for the drain
// method: write the tables; spawn the sentry cart; send it a traceback line: the door is asked rung by rung (cascade: true;
//         the last with last: true and the token header) and the cart reports real-error; the escalation record is queued
//         while the cascade road is down (and while it answers 500) and arrives when it returns; LACUNA_SHADOW=1 marks every request shadow
// sre: if the small minds are unsure, does the job climb to the 26B, and is every climb kept even when Lacuna is away?
test('a cart\'s mind climbs to the 26B through the door; its escalation is queued while the cascade road is down and drained after', async (t) => {
  const st = await mindDoor(t, { cascade: 'down' })
  const dir = scratch('mind'); tables(dir)
  const { f } = await boot(t, { dir, door: st.door, clock: 0.01, env: { LACUNA_SHADOW: '1' } })
  const w = (await f.call('POST', '/workers', { name: 'sentry', program: SENTRY })).body.worker
  assert.equal(w.state, 'running')
  await f.event(w.id, 'line', 'Traceback (most recent call last):')
  assert.ok(await until(() => st.events.some((e) => e.kind === 'report' && e.data.kind === 'heard'), 8000))
  assert.ok(st.minds.length >= 2); assert.ok(st.minds.every((m) => m.cascade === true && m.shadow === true))
  assert.ok(st.minds.some((m) => m.last === true))
  assert.equal(st.door.seen.find((x) => x.path === '/api/foreman/mind').headers['x-foreman-token'], f.token())
  assert.ok(await until(() => fs.existsSync(path.join(dir, 'cascade-queue.jsonl'))))
  st.cascade = '500'; await sleep(1500)
  assert.ok(fs.readFileSync(path.join(dir, 'cascade-queue.jsonl'), 'utf8').includes('escalation'), 'a 500 keeps it queued')
  st.cascade = 'up'
  assert.ok(await until(() => st.cascades.some((c) => c.kind === 'escalation'), 3000), 'drained after the road came back')
  assert.equal((await health(f)).shadow, true)
})

// spec: design §13 (`say`: the owner talks to a worker; the mind answers from its state) · eng §3.2 row 7 · §3.5 the small mind 60 s
// class: J18 a Promise that never settles (a mind that fails is a thought, never a hang); W5 malformed answer
// technique: a scriptable door answering talk with words, then 500, then a refusal with and without why, then no text
// method: talk to a worker with a mind job four times through the signed talk door: by mind ("all is quiet"); then by
//         program each time the mind fails, and the worker's thoughts say why ("answered 500", "the slot is busy", "no answer")
// sre: if the small mind is down, does the owner still get an answer from the program, and is the failure on the record?
test('talk to a worker with a mind: the mind answers; a 500, a refusal or an empty answer falls back to the program and the thought says why', async (t) => {
  const st = await mindDoor(t)
  const { f } = await boot(t, { tag: 'talk', door: st.door })
  const w = (await f.call('POST', '/workers', { name: 'talker', program: TALKER })).body.worker
  const { seal, now } = await import('./foreman-box.mjs')
  const say = () => f.call('POST', `/workers/${w.id}/talk`, seal(f.token(), { from: 'lacuna', to: w.id, kind: 'talk', body: { text: 'how is it' }, at: now() })).then((r) => r.body)
  const r1 = await say(); assert.deepEqual([r1.by, r1.reply], ['mind', 'all is quiet'])
  assert.equal(st.minds[0].model, 'functiongemma', 'the foreman\'s default small mind')
  for (const mode of ['500', 'no', 'bare', 'empty']) { st.mind = mode; assert.equal((await say()).by, 'program', mode) }
  const th = (await f.call('GET', `/workers/${w.id}/thoughts?n=200`)).body.items.map((x) => x.text).join('\n')
  assert.match(th, /the small mind answered 500/); assert.match(th, /the slot is busy/); assert.match(th, /no answer/)
})

// spec: E1.3 (the memory metrics are the governor's: mem_available_gb in GB, mem_pressure the kernel's level; disk and up:* stay on the series)
// class: J2 a wrong record (a memory number from a second source)
// technique: a worker subscribed to mem_available_gb on a box whose hands answer 8 GB; the door also serves a different number
// method: the worker receives 8 from the governor, and the door is never asked for mem_available_gb
// sre: does a worker watching memory see the same number the foreman decides by?
test('a memory subscription is the governor\'s number, never the API\'s series', async (t) => {
  const st = await mindDoor(t, { memGb: 3 })
  const hands = await memoryHands(t, { memGb: 8 })
  const { f } = await boot(t, { dir: hands.dir, door: st.door, clock: 0.01, env: hands.env })
  const w = (await f.call('POST', '/workers', { name: 'mem', program: "(subscribe 'mem_available_gb 15) (on 'mem_available_gb (lambda (v) (remember 'gb v)))" })).body.worker
  assert.ok(await until(async () => (await f.call('GET', `/workers/${w.id}`)).body.worker.kv.gb === 8))
  assert.equal(st.door.seen.filter((x) => x.query.includes('mem_available_gb')).length, 0)
})

// spec: design §6 change 7 (subscriptions: Lacuna's metrics delivered as events) · eng §3.5 (`subscribeMin` 15 s) · §45.3 (a paused worker's subscription is held)
// class: E18 subscriptions after restart (and while paused); J6 a timer doubled (the same metric subscribed twice)
// technique: time travel (a 15 s subscription every 150 ms) against a door that serves the metric
// method: spawn a worker that subscribes to cpu_pct twice; it receives 42 (the newest point); pause it: no delivery while
//         paused; resume: deliveries again; the door down for a tick, then an answer without the metric, cost nothing;
//         stop it: its interval ends (the door stops being asked for it)
// sre: if a worker watches a metric, does it see the newest value, nothing while paused, and leave no timer behind when it stops?
test('a subscription delivers the newest point, holds while paused, ends when the worker stops, and survives a missing door', async (t) => {
  const st = await mindDoor(t)
  const { f } = await boot(t, { tag: 'sub', door: st.door, clock: 0.01 })
  const prog = "(subscribe 'cpu_pct 15) (subscribe 'cpu_pct 15) (on 'cpu_pct (lambda (v) (remember 'cpu v) (remember 'n (+ 1 (recall 'n 0)))))"
  const w = (await f.call('POST', '/workers', { name: 'watch', program: prog })).body.worker
  assert.ok(await until(async () => (await f.call('GET', `/workers/${w.id}`)).body.worker.kv.cpu === 42))
  await f.call('POST', `/workers/${w.id}/interrupt`, { mode: 'pause' })
  const n1 = (await f.call('GET', `/workers/${w.id}`)).body.worker.kv.n; await sleep(500)
  assert.equal((await f.call('GET', `/workers/${w.id}`)).body.worker.kv.n, n1, 'nothing while paused')
  await f.call('POST', `/workers/${w.id}/interrupt`, { mode: 'resume' })
  assert.ok(await until(async () => (await f.call('GET', `/workers/${w.id}`)).body.worker.kv.n > n1))
  st.memGb = 'down'; await sleep(400); st.memGb = null; await sleep(400); st.memGb = 8   // a dead door, then an answer without the metric
  assert.equal((await f.call('GET', `/workers/${w.id}`)).body.worker.state, 'running')
  await f.call('DELETE', `/workers/${w.id}`)
  // under load (the CI runs the suites beside a model sitting) the stop lands late: wait for the worker to be gone, then
  // for the door's count to settle, before judging that the interval ended (2026-10-25: the only red in the CI's runs)
  await until(async () => ((await f.call('GET', `/workers/${w.id}`)).body.worker?.state ?? 'gone') !== 'running')
  const count = () => st.door.seen.filter((x) => x.query.includes('cpu_pct')).length
  let asked = count(); for (let i = 0; i < 10; i++) { await sleep(300); const now = count(); if (now === asked) break; asked = now }
  await sleep(600)
  assert.ok(count() <= asked + 1, 'its interval ended')
})

// spec: foreman.mjs tables ("re-read when they change; another job writes tiers.json") · design §10 (the box's minds)
// class: J7 JSON.parse on hostile input (a torn table); J11 fs ENOENT
// technique: state on disk changed under a running foreman
// method: no tables (a cart's minds have no rungs but it loads); write the tables (the ladder appears on the next spawn);
//         tear tiers.json (the next spawn reads no tiers and still loads); /carts and /carts/reload answer throughout (a
//         serving list that names no cart spawns none); a carts dir that is a device: "carts did not load", still serving
// sre: if another job rewrites or tears the tables, does the foreman read the new one and never crash on the torn one?
test('the minds\' tables are read when they change; a torn or missing table is no table, never a crash', async (t) => {
  const dir = scratch('tbl')
  const { f } = await boot(t, { dir, door: (await mindDoor(t)).door, env: { FOREMAN_CARTS_SERVE: 'nothing,else' } })
  const rungs = async () => { const w = (await f.call('POST', '/workers', { name: 's', program: SENTRY })).body.worker; return w.cart?.minds?.label?.model ?? null }
  const none = await rungs()
  tables(dir); const some = await rungs()
  assert.notEqual(some, none, 'the ladder appears once the tables exist')
  assert.equal(await rungs(), some, 'read from the cache while unchanged')
  fs.writeFileSync(path.join(dir, 'tiers.json'), '{"models": [')
  await rungs()
  assert.equal((await f.call('GET', '/carts')).status, 200)
  const rl = await f.call('POST', '/carts/reload', {}); assert.equal(rl.status, 200); assert.deepEqual(rl.body.spawned, [], 'only the named carts serve, and none is named')
  const { f: g } = await boot(t, { tag: 'nocarts', door: (await mindDoor(t)).door, env: { FOREMAN_CARTS: '/dev/null' } })
  assert.ok(g.log.some((l) => l.includes('carts did not load:')), 'a carts dir that is not a dir is a log line')
  assert.equal((await g.call('GET', '/health')).status, 200)
})
