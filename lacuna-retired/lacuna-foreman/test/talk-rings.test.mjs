// talk-rings.test.mjs — WHAT A WORKER THINKS, WHAT THE TREE REMEMBERS, AND HOW A WORKER DESCRIBES ITSELF. Owns: the tests
// of talk.mjs `think`, `thoughts`, `event`, `attachTalk` (the watch on spawn, send, hop and the way upstream), `purpose`,
// `safeState`, `plainWords`, `noteState` and `node`, at their bounds and on records with fields missing. Refuses: the
// brain; a mock of talk.mjs (the Supervisor is real; a few calls take a worker record as the foreman keeps it on disk).
// Implements: work order U5 §3; design §13 (the desk reads `thoughts`; the Agents tree), §11 (quarantine: text a worker
// read is never handed on), engineering §3.5 rings (thoughts 200, events 200: "nothing that only grows"). Invariants (§18):
// none written here; talking never makes a worker act (law 11). Faults (§16): none by id.
// coverage: talk.mjs — lines 100% branches 100% functions 100% (2026-10-24, the lane's files alone)
import test from 'node:test'
import assert from 'node:assert/strict'
import { Supervisor } from '../supervisor.mjs'
import { TALK, think, thoughts, event, purpose, safeState, plainWords, noteState, node } from '../talk.mjs'

const T0 = 1_792_800_000
function host() {
  let t = T0
  let n = 0
  const up = []
  return { up, tick: (s) => { t += s }, now: () => t, id: () => `w${++n}`, save: () => {}, upstream: (kind, w, data) => up.push({ kind, name: w.name, data }) }
}

// spec: engineering §3.5 rings (thoughts 200 · events 200; "nothing that only grows") · design §13 (the desk reads thoughts)
// class: B1 a *_KEPT bound under 10× its size · J15 long text (cut at 600 characters) · J13 a count unset, zero, negative, text
// technique: boundary — 2,000 thoughts and 2,000 events; thoughts(n) at n = 0, -5, 'abc', 1, 10,000
// method: read the ring lengths, which entries survive (the newest), the cut text, and each thoughts(n) length
// sre: can a chatty worker grow the foreman's memory without end through its thought ring or the tree's history?
test('the thought ring and the tree history hold 200 each under 2,000 writes, newest kept; a read is 1 to 200 lines', () => {
  const w = {}
  assert.deepEqual(thoughts(w), [])
  for (let i = 0; i < 2000; i++) think(w, 'state', i === 1999 ? 'x'.repeat(5000) : i, T0 + i)
  think(w, 'state', undefined, T0)
  think(w, 'state', null, T0)
  assert.equal(w.thoughts.length, TALK.thoughts)
  assert.equal(w.thoughts[0].text, '1802')
  assert.equal(w.thoughts.at(-3).text.length, TALK.text)
  assert.deepEqual(w.thoughts.slice(-2).map((x) => x.text), ['', ''])
  assert.deepEqual([0, -5, 'abc', 1, 10_000, undefined].map((n) => thoughts(w, n).length), [50, 1, 50, 1, 200, 50])
  const sup = { host: { now: () => T0 } }
  for (let i = 0; i < 2000; i++) event(sup, 'talk', { id: `w${i}`, name: 'n' }, i % 2 ? 'y'.repeat(400) : undefined)
  assert.equal(sup.events.length, TALK.events)
  assert.equal(sup.events[0].id, 'w1800')
  assert.deepEqual([sup.events[0].why, sup.events[1].why.length], ['', 300])
})

// spec: design §13 (the tree: spawn · crash · restart · grave · stop · talk) · talk.mjs attachTalk ("without touching its control flow")
// class: E13 a worker replaced under the same id (a stale record must not write into the new one's ring) · J4 an event with no
//        listener (a send to no worker; the foreman's own upstream row)
// technique: state-machine walk over every upstream kind the watch reads, plus sends and hops that name no worker
// method: drive a real Supervisor; read the events and each worker's thoughts after each kind; assert the control flow's
//         answers (send, hop, upstream) are unchanged
// sre: when the desk shows a bot's history, is every line about that bot — and does the watch ever change what the kernel did?
test('the watch records each kind once, into the right ring, and never changes what spawn, send, hop or upstream answered', () => {
  const h = host()
  const s = new Supervisor(h)
  const bad = s.spawn({ name: 'bad', verbs: ['on'], program: '(car 1)' })
  assert.equal(bad.state, 'grave')
  assert.equal(s.events.some((e) => e.kind === 'spawn' && e.name === 'bad'), false, 'a program that never loaded was never spawned')
  const a = s.spawn({ name: 'a', verbs: ['on', 'send-to', 'report'], program: "(on 'go (lambda (to) (send-to to 'hi 1)))\n(on 'hi (lambda (x) x))" })
  const b = s.spawn({ name: 'b', verbs: ['on'], program: "(on 'hi (lambda (x) x))" })
  assert.equal(s.events.filter((e) => e.kind === 'spawn').map((e) => `${e.name} ${e.why}`).join(', '), 'a by lacuna, b by lacuna')
  s.send(a.id, 'go', b.id)
  assert.match(a.thoughts.find((t) => t.kind === 'mail-out').text, /^hi → b 1$/)
  s.send(a.id, 'go', 'nobody')
  assert.match(a.thoughts.filter((t) => t.kind === 'mail-out').at(-1).text, /^hi → nobody 1$/)
  assert.equal(s.hop('foreman', b.id, 'hi', 2).ok, true, 'a hop from outside the tree is delivered and thinks nothing for its sender')
  assert.equal(b.thoughts.at(-1).text, 'hi 2')
  s.send(b.id, 'hi', undefined)
  assert.equal(b.thoughts.at(-1).text, 'hi null')
  s.send(b.id, 'hi', { toJSON: () => undefined })
  assert.equal(b.thoughts.at(-1).text, 'hi ', 'a body with no JSON form is an empty line, never "undefined"')
  assert.deepEqual(s.send('w-none', 'hi', 1), { ok: false, why: 'no such worker' })
  s.send(b.id, 'mind', { ok: true })
  assert.equal(b.thoughts.some((t) => t.text.startsWith('mind')), false, "a mind's answer is its own thought, not mail")
  const n = b.thoughts.length
  for (const k of ['need-brain', 'hand', 'ask', 'act']) h.upstream(k, b, { op: k })
  h.upstream('cart-retired', b, {})
  h.upstream('retired', { id: '-', name: 'foreman:x' }, {})
  h.upstream('report', { ...b }, { kind: 'x', data: [1] })
  assert.deepEqual(b.thoughts.slice(n).map((t) => t.text), ['need-brain → lacuna {"op":"need-brain"}', 'hand → lacuna {"op":"hand"}', 'ask → lacuna {"op":"ask"}', 'act → lacuna {"op":"act"}'])
  h.upstream('retired', b, { why: 'by hand' })
  assert.deepEqual(s.events.at(-1), { t: T0, kind: 'stop', id: b.id, name: 'b', why: 'by hand' })
  assert.equal(h.up.filter((u) => u.kind === 'cart-retired' || u.name === 'foreman:x').length, 2, 'every upstream row still went up')
})

// spec: design §13 (purpose: the cart's does, else the program's opening comment) · §11 (quarantine: text it read never handed on)
// class: W7 a body with a secret (a quarantined worker's remembered text is never shown) · J13 a record with fields missing
// technique: state-machine walk — a cart, a commented program, a program with no comment, an untrusted reader, a bare record
// method: read purpose, safeState and plainWords for each; assert what is said and what is withheld
// sre: when the owner asks a log-reading bot what it remembers, can the log's text (and a secret in it) reach the desk?
test('a worker says what it does from its header or opening comment; a quarantined one never repeats text it read', () => {
  assert.equal(purpose({ cart: { does: 'reads the disk' } }), 'reads the disk')
  assert.equal(purpose({ program: ';; watches\n;;memory\n\n(on \'x (lambda (v) v))\n;; not this' }), 'watches memory')
  assert.equal(purpose({ program: "(on 'x (lambda (v) v))" }), null)
  assert.equal(purpose({}), null)
  const q = { name: 'q', tier: 'watch', state: 'running', started: T0, readsUntrusted: true, kv: { line: 'token=sk-live-1', rows: [1], n: 3, ok: true, none: null },
              reports: [{ kind: 'seen', at: T0, data: ['token=sk-live-1', 7] }, { kind: 'empty', at: T0 }] }
  const st = safeState(q, T0 + 30)
  assert.deepEqual(st.remembered, { line: '(text it read)', rows: '(data it read)', n: 3, ok: true, none: null })
  assert.deepEqual(st.last_reports.map((r) => r.data), [['(text it read)', 7], []])
  assert.deepEqual([st.listens_for, st.watches, st.timers, st.children, st.paused_by, st.running_for, st.purpose], [[], [], 0, 0, null, '30 s', null])
  assert.doesNotMatch(plainWords(q, T0 + 30), /sk-live/)
  assert.deepEqual(safeState({ name: 'r', started: T0 }, T0).remembered, {}, 'a record with no memory remembers nothing')
  const plain = { ...q, readsUntrusted: false, kv: { note: 'x'.repeat(200) } }
  assert.equal(safeState(plain, T0).remembered.note.length, 81, 'a trusted value is cut at 80 characters and marked')
})

// spec: design §13 (the program answers by code, in plain words) · AFH 33-337 (numbers with units; singular and plural)
// class: J14 clock jumps (running_for in s, min, h at 89 s, 90 s, 5,399 s, 5,400 s) · J13 every optional part present or absent
// technique: boundary on the age units; a state-machine walk over each sentence plainWords may add
// method: read plainWords for a worker built with each part; assert each sentence and the unit boundaries
// sre: when the owner asks "what are you doing?" with no mind to answer, is the program's own answer complete and true?
test('plain words carry every part the worker has, singular or plural, with the age in s, min or h at the right edges', () => {
  const base = { name: 'p', tier: 'watch', state: 'running', started: T0, kv: {} }
  const say = (w, dt = 0) => plainWords({ ...base, ...w }, T0 + dt)
  assert.match(say({}, 89), /running — started \d\d:\d\d, 89 s ago\. I remember nothing yet\. I have not reported anything yet\.$/)
  assert.match(say({}, 90), /, 2 min ago\./)
  assert.match(say({}, 5399), /, 90 min ago\./)
  assert.match(say({}, 5400), /, 1\.5 h ago\./)
  const full = say({ cart: { name: 'c', does: 'counts' }, state: 'paused', pausedBy: { who: 'the owner', at: T0 }, subs: [{ metric: 'mem', seconds: 30 }],
                     handlers: new Map([['go', 1]]), timers: [1], kv: { n: 2, s: 'x' }, reports: [{ kind: 'tick', at: T0, data: [1, 'a'] }],
                     thoughts: [{ kind: 'mail-in', text: 'go 1', t: T0 }], children: ['w2'] })
  for (const part of ['I am p, a watch worker (the cart c), paused', 'the owner paused me at', 'What I do: counts', 'I watch mem every 30 s.',
                      'I listen for go.', 'I have 1 timer set.', 'I remember n = 2, s = x.', 'My last report: tick: 1; a, at', 'Last I heard: go 1 at', 'I have 1 child worker.'])
    assert.ok(full.includes(part), part)
  const many = say({ timers: [1, 2], children: ['a', 'b'] })
  assert.ok(many.includes('I have 2 timers set.') && many.includes('I have 2 child workers.'))
  const w = { ...base }
  noteState(w, T0)
  noteState(w, T0 + 1)
  w.kv.k = 1
  noteState(w, T0 + 2)
  assert.deepEqual(w.thoughts.map((t) => t.text), ['running; remembers nothing; 0 timer(s); no subscriptions', 'running; remembers k; 0 timer(s); no subscriptions'])
})

// spec: design §13.3 (the Agents tree: a node per worker; its mind; its last line) · alive.mjs aliveFields
// class: E16 a stale record (a finished cart's record keeps its header's minds, not its jobs) · J13 a node with nothing to show
// technique: state-machine walk — a living agent, a cart record from disk, a plain worker with no thoughts, one with a last line
// method: read node() for each; assert kind, mind, last_line and the restarts default
// sre: after a foreman restart, does the desk's tree still show which mind a finished cart used, and never invent one?
test('a node is an agent with its mind when it has a job or a declared mind, a worker otherwise; its last line is the newest', () => {
  const s = new Supervisor(host())
  const live = s.spawn({ name: 'l', verbs: ['on', 'mind-job', 'mind'], program: "(mind-job 'j '(:needs (line) :labels (a)))" })
  const n1 = node(live)
  assert.deepEqual([n1.kind, n1.mind, n1.restarts, n1.last_line], ['agent', { model: null, job: 'j' }, 0, null])
  const rec = { id: 'w9', name: 'c', tier: 'watch', state: 'retired', parent: null, started: T0, restarts: 2,
                cart: { minds: { l: { model: 'gemma3:1b' } } }, thoughts: [{ kind: 'state', text: 'done' }] }
  const n2 = node(rec)
  assert.deepEqual([n2.kind, n2.mind, n2.restarts, n2.last_line], ['agent', { model: 'gemma3:1b', job: 'l' }, 2, 'state: done'])
  assert.equal(node({ ...rec, last: 'done: ran' }).last_line, 'done: ran')
  const bare = node({ id: 'w8', name: 'p', tier: 'watch', state: 'running', jobs: new Map([['j', { name: 'j', rungs: ['gemma3:270m'] }]]) })
  assert.deepEqual(bare.mind, { model: 'gemma3:270m', job: 'j' })
  const ladder = node({ id: 'w7', name: 'p', tier: 'watch', state: 'running', jobs: new Map([['j', { name: 'j', rungs: ['lacuna-worker-lite'] }]]) })
  assert.deepEqual(ladder.mind, { model: 'lacuna-worker-lite', job: 'j' }, 'the 26B is named even when it may not talk')
  const lone = node({ id: 'w6', name: 'p', tier: 'watch', state: 'running', jobs: new Map([['j', { name: 'j', rungs: [] }]]) })
  assert.deepEqual(lone.mind, { model: null, job: 'j' })
  assert.deepEqual([node({ id: 'w5', name: 'p' }).kind, node({ id: 'w5', name: 'p' }).mind], ['worker', null])
})

// spec: the video pass of 10-31, G4 ("a act worker"; a run-on "says each new failure once I listen for …") · class: G grammar ·
// technique: an act-tier worker with a cart whose does-line has no stop · method: read plainWords · sre: does a bot's own account
// read as sentences?
test('a worker says "an act worker", stops its purpose before the next sentence, and says its last report in words', () => {
  const w = { name: 'forge-tender', tier: 'act', state: 'running', started: T0, cart: { name: 'forge-tender', does: 'runs the forge steward errand once an hour and says each new failure once' },
              reports: [{ kind: 'step', at: T0, data: ['the last errand has not answered; this hour is skipped'] }] }
  const said = plainWords(w, T0 + 30)
  assert.match(said, /^I am forge-tender, an act worker \(the cart forge-tender\)/)
  assert.match(said, /What I do: runs the forge steward errand once an hour and says each new failure once\./)
  assert.match(said, /My last report: step: the last errand has not answered; this hour is skipped, at /)
})
