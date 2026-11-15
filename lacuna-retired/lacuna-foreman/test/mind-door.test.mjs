// mind-door.test.mjs — THE SMALL MIND AGAINST A DOOR THAT MISBEHAVES. Owns: the tests of mind.mjs and talk.mjs on the hop
// to the door (`POST /api/foreman/mind`, engineering §3.2 hop 7) when the door answers hostile JSON (J7), slowly, with an
// error status, a body that never ends, a cut socket (J10, J9), or never (J18). Refuses: the live door, the brain, any
// small mind; a mock of mind.mjs or talk.mjs (the door is the stub in fixtures/u5-door.mjs; the Supervisor is real).
// Implements: work order U5 §4 J7 · J9 · J10 · J18; design §10 (the small mind is asked through Lacuna), §13 (talk).
// Invariants (§18): "If a mind's gate is below 90% per class, then its verdicts are advice" — a door's failure is never
// a verdict: the worker hears ok #f and why. Faults (§16): none by id (a failed ask is counted, never a crash).
// coverage: mind.mjs — lines 100% branches 98.64% functions 100% (2026-10-24, the lane's files alone; two dead branches are todos)
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Supervisor } from '../supervisor.mjs'
import { talk } from '../talk.mjs'
import { startDoor, doorMind, U5_TMP } from './fixtures/u5-door.mjs'

// a plain worker with one mind job (no cart: the job has no ladder, so it takes mind.mjs's one-ask road)
const PLAIN = `;; labels one line
(mind-job 'l '(:ask "which?" :needs (line) :labels (a b)))
(on 'line (lambda (x) (mind 'l (list (cons 'line x)))))
(on 'mind (lambda (m) (report 'heard (get m 'ok #f) (get m 'label 'none) (get m 'why ""))))`
const VERBS = ['on', 'mind-job', 'mind', 'report']

function host(mind, o = {}) {
  let n = 0
  const up = []
  return { up, now: () => 1000, id: () => `w${++n}`, save: () => {}, upstream: (kind, w, data) => up.push({ kind, name: w.name, data }),
           mind, ...o }
}
const heard = (h) => h.up.filter((u) => u.kind === 'report' && u.data.kind === 'heard').map((u) => u.data.data)
async function until(cond, ms = 3000) {
  const end = Date.now() + ms
  while (!cond()) { if (Date.now() > end) return false; await new Promise((r) => setTimeout(r, 5)) }
  return true
}

// spec: design §10 (the small mind through Lacuna) · eng §3.2 hop 7 · mind.mjs header "refuses a crash of the worker for the mind's own failure"
// class: J7 JSON.parse on hostile input (a door body whose `text` or `certainty` cannot become a string or a number; depth 100,000)
// technique: process kill and read — the scenario runs in a scratch child under /private/tmp/lacuna-unit/U5 with no settle(),
//            exactly as the foreman runs (nothing awaits the mind's promise), against the stub door
// method: three hostile bodies to a plain worker; the child prints the worker's counts and what it heard, then exits 0;
//         assert the exit code, that every ask is counted failed, that the worker heard ok #f with why, and it still runs
// sre: can one bad JSON body from the door take the whole foreman (every worker on the box) down with an unhandled rejection?
test('a hostile door body is a failed ask the worker hears about; the foreman process survives it (exit 0, no unhandled rejection)', () => {
  mkdirSync(U5_TMP, { recursive: true })
  const script = join(U5_TMP, 'hostile-door.mjs')
  const here = new URL('..', import.meta.url).pathname
  writeFileSync(script, `
import { Supervisor } from '${here}supervisor.mjs'
import { startDoor, doorMind } from '${here}test/fixtures/u5-door.mjs'
const bodies = [
  '{"ok":true,"text":{"toString":1},"certainty":0.9}',
  '{"ok":true,"text":"(label \\'a)","certainty":{"valueOf":1,"toString":1}}',
  '{"ok":true,"text":' + '['.repeat(100000) + ']'.repeat(100000) + ',"certainty":0.9}',
]
let i = 0
const door = await startDoor(() => ({ raw: bodies[i++] }))
const up = []
const s = new Supervisor({ now: () => 1000, id: () => 'w1', save: () => {}, upstream: (k, w, d) => up.push({ k, d }), mind: doorMind(door.url) })
const w = s.spawn({ name: 'x', program: ${JSON.stringify(PLAIN)}, verbs: ${JSON.stringify(VERBS)} })
for (let k = 0; k < bodies.length; k++) s.send(w.id, 'line', 'l' + k)
const end = Date.now() + 5000
while (w.mind.failed + w.mind.dropped < bodies.length && Date.now() < end) await new Promise((r) => setTimeout(r, 5))
await door.close()
console.log(JSON.stringify({ state: w.state, mind: w.mind, heard: up.filter((u) => u.k === 'report').map((u) => u.d.data), polluted: ({}).polluted ?? null }))
`)
  const r = spawnSync(process.execPath, [script], { encoding: 'utf8', timeout: 20_000 })
  assert.equal(r.status, 0, `the scratch foreman died: ${r.stderr.split('\n').slice(0, 6).join(' | ')}`)
  const out = JSON.parse(r.stdout.trim().split('\n').at(-1))
  assert.equal(out.state, 'running')
  assert.equal(out.mind.asked, 3)
  assert.equal(out.mind.failed, 3, 'each hostile body is one failed ask, counted')
  assert.equal(out.heard.length, 3)
  for (const h of out.heard) { assert.equal(h[0], false); assert.match(h[2], /the small mind did not answer/) }
  assert.equal(out.polluted, null)
})

// spec: design §10 · eng §3.2 hop 7 (a small mind 60 s) · alive.mjs ALIVE.mind 360 s (the mind clock) · law 4 (the supervisor only supervises)
// class: J18 a Promise that never settles (the host's mind call never answers)
// technique: fault injection — host.mind returns a promise that never settles; the mind clock shortened to 0.05 s by host.deadlines
// method: two workers each ask once; the first ask hangs forever; read whether the second worker's question is ever put to
//         the mind, and what the first worker hears; assert both, then that settle() ends
// sre: if one ask hangs, does every other worker's mind on the box wait behind it forever (the one-mind queue is head-of-line)?
test('a mind call that never settles is cut at the mind clock: the worker hears why and the next question in the queue is asked', async () => {
  const asked = []
  const h = host((req) => { asked.push(req.prompt); return asked.length === 1 ? new Promise(() => {}) : { text: "(label 'b)", certainty: 1 } },
                 { deadlines: { mind: 0.05 } })
  const s = new Supervisor(h)
  const a = s.spawn({ name: 'a', program: PLAIN, verbs: VERBS })
  const b = s.spawn({ name: 'b', program: PLAIN, verbs: VERBS })
  s.send(a.id, 'line', 'first')
  s.send(b.id, 'line', 'second')
  assert.equal(await until(() => asked.length === 2 && heard(h).length === 2, 2000), true, `asked ${asked.length}, heard ${heard(h).length}`)
  await s.settle()
  const [first, second] = [h.up.find((u) => u.name === 'a' && u.kind === 'report').data.data, h.up.find((u) => u.name === 'b' && u.kind === 'report').data.data]
  assert.equal(first[0], false)
  assert.match(first[2], /no answer in 0\.05 s \(the mind clock\)/)
  assert.deepEqual(second.slice(0, 2), [true, 'b'])
  assert.equal(a.mind.failed, 1)
  assert.deepEqual(a.minding, [], 'the flight the heartbeat watched is closed')
})

// spec: design §13 (talk) · talk.mjs header "the program answers instead" · alive.mjs ALIVE.mind
// class: J18 a Promise that never settles (talk's mind)
// technique: fault injection on host.mind; the mind clock 0.05 s
// method: talk to a worker whose mind never answers; read the reply, who gave it, and the failed count
// sre: when the owner talks to a bot and the mind hangs, does the desk get an answer, or does the owner's request hang too?
test('talking to a worker whose mind never answers gets the program\'s own words at the mind clock, and the failure is counted', async () => {
  const h = host(() => new Promise(() => {}), { deadlines: { mind: 0.05 } })
  const s = new Supervisor(h)
  const w = s.spawn({ name: 'talker', program: PLAIN, verbs: VERBS })
  const r = await talk(s, w, 'what are you doing?')
  assert.equal(r.by, 'program')
  assert.match(r.reply, /^I am talker, a watch worker/)
  assert.equal(w.mind.failed, 1)
  assert.match(w.thoughts.filter((t) => t.kind === 'answer').at(-1).text, /no answer in 0\.05 s \(the mind clock\)/)
})

// spec: design §10 · eng §3.2 hop 7 (a small mind 60 s, the 26B rung 300 s) · mind.mjs header "refuses a crash of the worker"
// class: J10 HTTP slow body, wrong status, no body end · J9 socket cut (ECONNRESET) · J7 a body that is not JSON
// technique: a scripted stub door (fixtures/u5-door.mjs) behind the foreman's adapter shape, the adapter's deadline 150 ms
// method: one ask per door behaviour, in order through the one-mind queue; read each answer the worker heard and the counts
// sre: whatever the door does wrong, does the worker hear one clear sentence and keep running, and does the queue keep moving?
test('a door that is slow, says 500, says ok #f, sends junk, never ends its body or cuts the socket gives one failed ask each, in order', async () => {
  const plan = [
    { delayMs: 20, json: { ok: true, text: "(label 'a)", certainty: 0.9 } },
    { status: 500, json: { ok: false } },
    { json: { ok: false, why: 'the model is not one this box lets an agent have' } },
    { raw: '<html>502 Bad Gateway</html>' },
    { hang: true },
    { destroy: true },
    { delayMs: 400, json: { ok: true, text: "(label 'a)" } },
    { json: { ok: true } },
  ]
  let i = 0
  const door = await startDoor(() => plan[i++])
  try {
    const h = host(doorMind(door.url, { smallMs: 150 }))
    const s = new Supervisor(h)
    const w = s.spawn({ name: 'x', program: PLAIN, verbs: VERBS })
    for (let k = 0; k < plan.length; k++) s.send(w.id, 'line', `l${k}`)
    assert.equal(await until(() => heard(h).length === plan.length, 8000), true)
    await s.settle()
    const got = heard(h)
    assert.deepEqual(got[0].slice(0, 2), [true, 'a'])
    assert.match(got[1][2], /answered 500/)
    assert.match(got[2][2], /not one this box lets an agent have/)
    assert.match(got[3][2], /did not answer: .*JSON|Unexpected token/)
    assert.match(got[4][2], /did not answer: .*(aborted|timeout)/i)
    assert.match(got[5][2], /did not answer: fetch failed/)
    assert.match(got[6][2], /did not answer: .*(aborted|timeout)/i)
    assert.match(got[7][2], /not exactly one form/, 'an empty text reads as no form: dropped, never a label')
    assert.equal(w.state, 'running')
    assert.deepEqual([w.mind.asked, w.mind.labels, w.mind.failed, w.mind.dropped], [8, 1, 6, 1])
    assert.equal(door.hits.length, 8)
    assert.ok(door.hits.every((x) => x.path === '/api/foreman/mind' && x.body.job === 'l' && !('line' in x.body)))
  } finally { await door.close() }
})

// spec: design §10 · cascade.mjs header (certainty unknown climbs; the 26B last) · J7 NaN/Infinity
// class: J7 hostile numbers from the door (1e309 parses to Infinity; a string certainty)
// technique: the stub door answers each rung of a cart's ladder; the door's JSON carries 1e309 and "0.99" as certainty
// method: a cart with a two-rung ladder (functiongemma, then the 26B); read the escalation record the host keeps and the label
//         the worker heard; assert Infinity was recorded as unknown and climbed, never accepted on a guess
// sre: can a door that answers certainty 1e309 make a small mind's guess look sure and skip the 26B?
test('a rung whose certainty arrives as 1e309 is unknown and climbs; a string certainty is read as its number', async () => {
  const rungs = []
  const door = await startDoor(({ body }) => {
    rungs.push(body.model)
    if (body.model === 'functiongemma') return { raw: '{"ok":true,"text":"(label \'noise)","certainty":1e309}' }
    return { json: { ok: true, text: "(label 'real-error)", certainty: '0.99' } }
  })
  try {
    const kept = []
    const h = host(doorMind(door.url), { tables: () => ({ tiers: null, box: { agent_minds: ['functiongemma'] } }), cascade: (k, rec) => kept.push({ k, rec }) })
    const s = new Supervisor(h)
    const w = s.spawn({ name: 'c', program: `(lacuna-cart 'c '((does . "labels") (done . "d") (agent . ((tier . watch) (verbs . (on mind-job mind report))))
      (minds . ((l . ((job . signal->label) (labels . (noise real-error))))))))
(mind-job 'l '(:ask "?" :needs (line) :labels (noise real-error)))
(on 'line (lambda (x) (mind 'l (list (cons 'line x)))))
(on 'mind (lambda (m) (report 'heard (get m 'ok #f) (get m 'label 'none) (get m 'why ""))))` })
    s.send(w.id, 'line', 'GET / 200')
    await until(() => heard(h).length === 1)
    await s.settle()
    assert.deepEqual(rungs, ['functiongemma', 'lacuna-worker-lite'])
    assert.deepEqual(heard(h)[0].slice(0, 2), [true, 'real-error'])
    const esc = kept.find((k) => k.k === 'escalation').rec
    assert.equal(esc.rungs[0].certainty, null)
    assert.equal(esc.rungs[0].climbed, 'its certainty is unknown')
    assert.equal(esc.rungs[1].certainty, 0.99)
    assert.equal(esc.candidate_pair, true)
  } finally { await door.close() }
})
