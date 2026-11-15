// verbs.test.mjs — U1 unit tests for `verbs.mjs`, the verbs a worker program may call.
// owns: the proofs that every governed verb is checked against the worker's set and counted, that timers and
//   subscriptions are clamped to their floors, that a report is never a done step, that a refusal is a sentence, and
//   that the pure helpers answer for any input shape without a throw.
// refuses: to mock verbs.mjs; every test runs a real worker program on a real Supervisor and a fake clock (makeSup).
// implements: design §6 (the engine's verbs the worker may call; change 2: a cart's hand keeps its re-send), §4 (one word,
//   one meaning), §8 (a report is a step's text, never `done`), law 2, law 11; eng §2 rows, §3.3 worker events, §3.5
//   (everyMin 5, subscribeMin 15, reportsKept 200).
// invariants: "If an act ran, then a press ticket preceded it" (an act only from the header); "If a step is done, then a
//   ticket closed it" (a report never closes a step).
// faults: F-02 (a verb not held, an act not in the header: refused with a sentence), F-12 (a report line is not done).
// coverage: verbs.mjs — lines 100% branches 99.40% functions 100% (2026-10-24, with verbs-file.test.mjs; line 148 todo)
import test from 'node:test'
import assert from 'node:assert/strict'
import { makeSup } from '../../../test/conformance/fake-host.mjs'
import { LIMITS } from '../supervisor.mjs'
import { trial } from '../trial.mjs'

const ups = (h, kind) => h.up.filter((u) => u.kind === kind)
const crashWhy = (h) => ups(h, 'crashed').at(-1)?.data.why
const stopAll = (s) => { for (const id of s.workers.keys()) s.stop(id, 'test over') }

// spec: design §6 (verbs held per worker) · §11 · F-02 · law 11
// class: E1 a handler throws (the refusal is a throw in the handler; the worker restarts)
// technique: state walk over the refusal reasons: not among its verbs; untrusted and acting; ask on a watch worker
// method: three workers each call a verb they do not hold; read the `crashed` row's sentence for each and the tool count
//         (a refused call is never counted)
// sre: if a worker reaches for a verb it was not given, does the record say exactly why, in a sentence a person reads?
test('a verb the worker does not hold is refused with a sentence and never counted', () => {
  const { h, s } = makeSup()
  const narrow = s.spawn({ name: 'narrow', verbs: ['report'], program: `(on 'go (lambda (x) (remember 'k 1)))` })
  s.send(narrow.id, 'go', 1)
  assert.match(crashWhy(h), /narrow may not \(remember …\) — it is not among its verbs$/)
  assert.equal(narrow.tools?.remember, undefined)
  const reader = s.spawn({ name: 'reader', readsUntrusted: true, program: `(on 'go (lambda (x) (spawn 'k "(define x 1)")))` })
  s.send(reader.id, 'go', 1)
  assert.match(crashWhy(h), /reader may not \(spawn …\) — it reads untrusted text, so it may not act$/)
  const watch = s.spawn({ name: 'watch', program: `(on 'go (lambda (x) (ask "restart vite")))` })
  s.send(watch.id, 'go', 1)
  assert.match(crashWhy(h), /watch is a watch worker — it may not ask to act$/)
  const actor = s.spawn({ name: 'actor', tier: 'act', verbs: ['report'], program: `(on 'go (lambda (x) (ask "x")))` })
  s.send(actor.id, 'go', 1)
  assert.match(crashWhy(h), /actor may not \(ask …\) — it is not among its verbs$/)
  assert.equal(ups(h, 'ask').length, 0)
})

// spec: design §6 · eng §3.5 (everyMin 5 s, subscribeMin 15 s; after 1 s … 7 days)
// class: J6 a timer kept alive or doubled (a timer below its floor would spin the loop)
// technique: boundary: 0, 4, garbage, 10 days; a procedure that is not one
// method: a load calls every/after/subscribe with out-of-range seconds; read each returned value (the clamp), the timer
//         specs (load origin), the subscription (60 s default for garbage), and the `on needs a procedure` refusal
// sre: if a cart asks for a timer every 0 s, does the foreman hold it to 5 s instead of burning a core?
test('timers and subscriptions are clamped to their floors; a non-procedure handler is refused', () => {
  const { h, s } = makeSup()
  const subs = []; h.subscribe = (w, m, sec) => subs.push([m, sec])
  const w = s.spawn({ name: 'clamps', program: `
    (remember 'e0 (every 0 (lambda () #t)))
    (remember 'e4 (every "soon" (lambda () #t)))
    (remember 'a0 (after 0 (lambda () #t)))
    (remember 'a10d (after 864000 (lambda () #t)))
    (remember 's0 (subscribe 'disk_free_pct 1))
    (remember 'sx (subscribe 'mem_pressure "often"))
    (on 'bad (lambda (x) (on 'y 5)))
    (on 'bad2 (lambda (x) (every 60 "not a procedure")))` })
  assert.deepEqual([w.kv.e0, w.kv.e4, w.kv.a0, w.kv.a10d, w.kv.s0, w.kv.sx], [LIMITS.everyMin, LIMITS.everyMin, 1, 7 * 86400, LIMITS.subscribeMin, 60])
  assert.deepEqual(w.timers.map((t) => [t.spec.verb, t.spec.origin]), [['every', 'load'], ['every', 'load'], ['after', 'load'], ['after', 'load']])
  assert.deepEqual(subs, [['disk_free_pct', 15], ['mem_pressure', 60]])
  s.send(w.id, 'bad', 1)
  assert.match(crashWhy(h), /on needs a procedure$/)
  s.send(w.id, 'bad2', 1)
  assert.match(crashWhy(h), /every needs a procedure$/)
  const stepper = s.spawn({ name: 'stepper', program: `(on 'go (lambda (x) (every 60 (lambda () #t)) (after 60 (lambda () #t))))` })
  s.send(stepper.id, 'go', 1)
  assert.deepEqual(stepper.timers.map((t) => t.spec.origin), ['step', 'step'], 'a step\'s timer is re-armed by the checkpoint, not the load')
  const dry = trial(`(every 60 (lambda () (report 'a 1))) (every 90 (lambda () (report 'b 1))) (after 5 (lambda () (report 'c 1))) (after 9 (lambda () (report 'd 1)))`)
  assert.deepEqual(dry.reports.map((r) => r.kind), ['a', 'b', 'c', 'd'], 'a dry run calls every timer once, arming none')
  const quiet = s.spawn({ name: 'nohost', program: `(subscribe 'disk_free_gb 30)` })
  delete h.subscribe
  assert.equal(quiet.subs.length, 1)
  stopAll(s)
})

// spec: design §8 (a step is `done` only by a ticket; `report 'step` is the step's text) · §12.2 · F-12 · eng §3.5 reports 200
// class: L2 a step `done` from a report line
// technique: state walk + boundary at 10× the report ring (2,000 reports → 200 kept)
// method: a cart with a contract reports 'step "built it" and a non-string; read the contract rows (status running, the
//         text joined, never done); report 2,000 times and read the ring (200, the newest last); read the parent's
//         child-report hop
// sre: if a cart reports "step: all tests pass", does the contract ever say done without a ticket?
test('a report is the step\'s text, never done; the ring keeps 200; a child\'s report hops to its parent', () => {
  const { h, s } = makeSup()
  const c = s.spawn({ name: 'stepper', program: `(lacuna-cart 'stepper '((does . "steps") (done . "stepped") (agent . ((tier . watch) (verbs . (on report))))))
(on 'go (lambda (x) (report 'step "built it" 42)))
(on 'many (lambda (n) (let loop ((i 0)) (when (< i n) (report 'tick i) (loop (+ i 1))))))` })
  s.send(c.id, 'go', 1)
  const row = c.contract.steps.at(-1)
  assert.deepEqual([row.status, row.text, row.ticket], ['running', 'built it 42', null])
  assert.ok(!c.contract.steps.some((x) => x.status === 'done'), 'F-12: a report is never done')
  s.send(c.id, 'many', 2000)
  assert.equal(c.reports.length, LIMITS.reportsKept)
  assert.deepEqual(c.reports.at(-1).data, [1999])
  const p = s.spawn({ name: 'p', program: `(on 'child-report (lambda (r) (remember 'from (get r 'from)))) (remember 'k (spawn 'kid "(on 'go (lambda (x) (report 'hi x)))"))` })
  s.send(p.kv.k, 'go', 3)
  assert.equal(p.kv.from, 'kid')
  assert.ok(ups(h, 'report').some((u) => u.name === 'kid'))
  stopAll(s)
})

// spec: design §9 (mail is the channel; dedupe) · §7.6 · F-11 · law 7
// class: E10 a duplicate message (the same letter twice within the hour)
// technique: state walk: a good letter, the same again, a letter with a bad kind
// method: a worker mails 'self-report twice with the same what; read the host's letters (one), the thought "(count 2)",
//         and the returned id (the same); mail a kind outside the three: the handler crashes with the mail's sentence
// sre: if a cart mails the same complaint every minute, does Claude's mailbox get one letter with a count?
test('mail writes one letter, raises a count on the same one, and refuses a kind outside the three', () => {
  const { h, s } = makeSup()
  const w = s.spawn({ name: 'mailer', program: `
    (on 'go (lambda (x) (remember 'id (mail 'self-report "disk is low" '(("fault" "F-07") ("severity" "stuck"))))))
    (on 'plain (lambda (x) (mail 'ticket "no extra")))
    (on 'bad (lambda (x) (mail 'shout "loud")))` })
  s.send(w.id, 'go', 1); const first = w.kv.id
  s.send(w.id, 'go', 1)
  assert.equal(h.letters.length, 1); assert.equal(w.kv.id, first)
  assert.equal(h.letters[0].severity, 'stuck'); assert.equal(h.letters[0].evidence.fault, 'F-07')
  assert.ok(w.thoughts.some((t) => t.kind === 'mail' && /\(count 2\)$/.test(t.text)))
  s.send(w.id, 'plain', 1)
  assert.equal(h.letters[1].severity, 'note')
  s.send(w.id, 'bad', 1)
  assert.match(crashWhy(h), /mail kind is one of self-report ticket handoff-note, not shout$/)
})

// spec: design §11 (a child ≤ its parent; literal spawn) · law 11 · eng §3.3
// class: B7 a ceiling (the child's tier and verbs, never wider)
// technique: state walk over the spawn argument shapes: none, a tier, a verb list, a tier and a verb list, a non-string
// method: an act-tier parent spawns four children and one with a number for a program; read each child's tier and verbs
//         and the refusal sentence
// sre: can a cart widen a child by passing its arguments in an unexpected order?
test('spawn reads (spawn name prog), a tier, a verb list, or both; a program that is not text is refused', () => {
  const { h, s } = makeSup()
  const p = s.spawn({ name: 'lead', tier: 'act', program: `
    (define a (spawn 'a "(every 60 (lambda () #t))"))
    (define b (spawn 'b "(every 60 (lambda () #t))" 'watch))
    (define c (spawn 'c "(every 60 (lambda () #t))" '(report)))
    (define d (spawn 'd "(every 60 (lambda () #t))" 'act '(report hand)))
    (on 'num (lambda (x) (spawn 'e 42)))` })
  const kids = p.children.map((id) => s.workers.get(id))
  assert.deepEqual(kids.map((k) => [k.name, k.tier]), [['a', 'act'], ['b', 'watch'], ['c', 'act'], ['d', 'act']])
  assert.deepEqual([...kids[2].verbs], ['report']); assert.deepEqual([...kids[3].verbs].sort(), ['hand', 'report'])
  s.send(p.id, 'num', 1)
  assert.match(crashWhy(h), /lead may spawn only a program written in its own text/)
  stopAll(s)
})

// spec: design §6 change 1 (hands are reads) · §11 (untrusted readers never act) · law 11 · F-02
// class: L3 an act without a press (a quarantined worker reaching for an effect through `hand`)
// technique: boundary: a read op and a non-read op from a worker marked untrusted
// method: the untrusted worker hands 'jobs (one `hand` row upstream) and then 'merge (crashed with the sentence; no row)
// sre: if a worker that read a hostile page asks the hands for something that is not a read, does it reach the hands?
test('a worker that reads untrusted text may hand only a read', () => {
  const { h, s } = makeSup()
  const w = s.spawn({ name: 'reader', readsUntrusted: true, program: `(on 'ok (lambda (x) (hand 'jobs "all"))) (on 'bad (lambda (x) (hand 'merge "main")))` })
  s.send(w.id, 'ok', 1)
  s.send(w.id, 'bad', 1)
  assert.deepEqual(ups(h, 'hand').map((u) => u.data.op), ['jobs'])
  assert.match(crashWhy(h), /reader reads untrusted text — it may hand only a read$/)
})

// spec: design §6 change 5 (an issued act is followed on the restart, never reissued) · law 4 · §16 F-02, F-08
// class: L3 an act without a press; E10 a duplicate message (the reload asks the act again)
// technique: state walk: an act outside a cart, an act its header does not name, an act adopted on a crash restart
// method: a plain worker acts → refused; a cart with no (acts …) acts → refused; a cart acts 'merge (not in its header) →
//         refused; a cart acts 'pass at start, the
//         reply says waiting (press), it crashes and reloads: still one `act` row upstream and the same ticket pending
// sre: if a cart crashes while its act waits on the owner's press, does the restart ask the owner a second time?
test('an act is only one the cart header names, and a restart follows the issued act, never reissues it', () => {
  const { h, s } = makeSup()
  const plain = s.spawn({ name: 'plain', tier: 'act', program: `(on 'go (lambda (x) (act 'pass)))` })
  s.send(plain.id, 'go', 1)
  assert.match(crashWhy(h), /plain may act only with an act its cart header names — not pass$/)
  const rel = s.spawn({ name: 'rel', tier: 'act', program: `(lacuna-cart 'rel '((does . "releases") (done . "released") (agent . ((tier . act) (verbs . (on act hand ask)))) (acts . (pass))))
(act 'pass "v1")
(hand 'jobs)
(on 'hand (lambda (r) #t))
(on 'help (lambda (x) (ask "press it")))
(on 'act (lambda (r) #t))
(on 'wrong (lambda (x) (act 'merge)))
(on 'boom (lambda (x) (car '())))` })
  const bare = s.spawn({ name: 'bare', tier: 'act', program: `(lacuna-cart 'bare '((does . "x") (done . "y") (agent . ((tier . act) (verbs . (on act))))))
(on 'go (lambda (x) (act 'pass)))` })
  s.send(bare.id, 'go', 1)
  assert.match(crashWhy(h), /bare may act only with an act its cart header names — not pass$/, 'a header with no (acts …) names none')
  const old = s.spawn({ name: 'old', tier: 'act', cart: { acts: null }, program: `(lacuna-cart 'old '((does . "x") (done . "y") (agent . ((tier . act) (verbs . (on act)))) (acts . (pass))))
(on 'go (lambda (x) (act 'pass)))` })
  s.send(old.id, 'go', 1)
  assert.match(crashWhy(h), /old may act only with an act its cart header names — not pass$/, 'a checkpointed cart record with acts null names none')
  s.send(rel.id, 'wrong', 1)
  assert.match(crashWhy(h), /rel may act only with an act its cart header names — not merge$/)
  const t = rel.pending.find((x) => x.kind === 'act').ticket
  s.send(rel.id, 'act', { ticket: t, op: 'pass', waiting: 'the owner\'s press' })
  s.send(rel.id, 'boom', 1)
  assert.equal(ups(h, 'act').length, 1, 'never reissued')
  assert.deepEqual(rel.pending.filter((x) => x.kind !== 'hand').map((x) => [x.ticket, x.kind]), [[t, 'press']])
  assert.equal(ups(h, 'hand').length, 2, 'the read was adopted on the first restart and asked afresh after the poisoned second')
  assert.ok(rel.thoughts.some((x) => /may be poisoned: restarting from kv only, 1 ticket\(s\) dropped, 1 act\(s\) followed/.test(x.text)))
  s.send(rel.id, 'help', 1)
  assert.deepEqual(ups(h, 'ask').at(-1).data, { what: 'press it' })
})

// spec: design §6 (stop; the pure helpers are everyone's) · §4 · eng §3.3
// class: J7 JSON.parse on hostile input (helpers fed every shape)
// technique: seeded bounded fuzz is not needed: a state walk over each helper's input shapes
// method: get on a non-list, a missing key, a malformed row; take with a negative and a garbage count; sort-by down, up,
//         on rows missing the key and on a non-list; now, my-name, display, newline; (stop) retires the worker on the
//         next tick with "it stopped itself"
// sre: can a hand's odd reply shape crash a cart through a helper? Every helper must answer, not throw.
test('the pure helpers answer for any shape, and (stop) retires the worker on the next tick', async () => {
  const { h, s } = makeSup()
  const w = s.spawn({ name: 'helper', program: `
    (remember 'g1 (get 5 'ok 'none))
    (remember 'g2 (get '((a 1) 7 (ok #t)) 'ok 'none))
    (remember 'g3 (get '((a 1)) 'ok))
    (remember 't1 (take '(1 2 3) -2))
    (remember 't2 (take '(1 2 3) "x"))
    (remember 't3 (take 5 1))
    (remember 't4 (take '(1 2 3) 2))
    (define rows '(((n "b") (size 2)) ((n "a") (size 9)) ((n "c")) ((n "d") (size 2))))
    (remember 's1 (map (lambda (r) (get r 'n)) (sort-by rows 'size)))
    (remember 's2 (map (lambda (r) (get r 'n)) (sort-by rows 'size 'up)))
    (remember 's3 (sort-by 5 'size))
    (remember 'r1 (recall 'g2))
    (remember 'r2 (recall 'nope 'dflt))
    (remember 'now (now))
    (remember 'me (my-name))
    (display "hello")
    (newline)
    (on 'quit (lambda (x) (stop)))` })
  assert.deepEqual([w.kv.g1.$sym, w.kv.g2, w.kv.g3], ['none', true, false])
  assert.deepEqual([w.kv.t1, w.kv.t2, w.kv.t3, w.kv.t4], [[], [], [], [1, 2]])
  assert.deepEqual(w.kv.s1, ['a', 'b', 'd', 'c'])
  assert.deepEqual(w.kv.s2, ['c', 'b', 'd', 'a'])
  assert.deepEqual([w.kv.s3, w.kv.now, w.kv.me, w.kv.r1, w.kv.r2.$sym], [[], h.now(), 'helper', true, 'dflt'])
  assert.equal(w.last, 'said: hello')
  assert.ok(w.tools.get >= 3 && w.tools.display === 1 && w.tools.newline === 1, 'pure helpers are counted too')
  s.send(w.id, 'quit', 1)
  assert.equal(w.state, 'running', 'the stop waits for the handler to return')
  await new Promise((r) => setTimeout(r, 1))
  assert.equal(w.state, 'retired'); assert.equal(w.last, 'it stopped itself')
  assert.ok(ups(h, 'retired').some((u) => u.name === 'helper' && u.data.why === 'it stopped itself'))
})

// spec: design §12 (a cart asks the brain only at its judgment points; F-09) · eng §3.3 (need-brain)
// class: E10 a duplicate message (two brain questions from one cart get two tickets)
// technique: state walk: a cart question (ticket numbered by its brain count) and a plain worker's question
// method: a cart asks twice at its judgment point; read the two need-brain rows (tickets end -brain-1, -brain-2; topic
//         and fallback from the header); a plain worker asks once; read its ticket and its ask-owner fallback
// sre: if a cart asks the 26B twice, can the answers be told apart?
test('need-brain opens one ticket per question: a cart numbers them by its brain count, with its header\'s fallback', () => {
  const { h, s } = makeSup()
  const c = s.spawn({ name: 'judge', program: `(lacuna-cart 'judge '((does . "judges") (done . "judged") (agent . ((tier . watch) (verbs . (on need-brain)))) (judgment . ((pick . skip)))))
(on 'go (lambda (x) (need-brain 'pick "a or b?" 1) (need-brain 'pick "c or d?")))` })
  s.send(c.id, 'go', 1)
  const rows = ups(h, 'need-brain').map((u) => u.data)
  assert.deepEqual(rows.map((r) => r.ticket), [`${c.id}-brain-1`, `${c.id}-brain-2`])
  assert.deepEqual([rows[0].topic, rows[0].fallback, rows[0].question, rows[0].facts], ['pick', 'skip', '[pick] a or b?', [1]])
  const w = s.spawn({ name: 'plain', program: `(on 'go (lambda (x) (need-brain "ok?")))` })
  s.send(w.id, 'go', 1)
  const last = ups(h, 'need-brain').at(-1).data
  assert.match(last.ticket, new RegExp(`^${w.id}-brain-\\d+$`)); assert.deepEqual([last.topic, last.fallback], [null, 'ask-owner'])
  assert.equal(w.pending[0].deadline_at, h.now() + s.alive.mind)
})

// spec: design §6 (send-to: one hop between agents, signed) · law 5 · eng §3.2
// class: W6 a wrong `to` (a hop to a worker that is gone)
// technique: state walk: a living receiver, a stopped receiver
// method: a worker sends to a living peer (#t; the peer's handler ran) and to a stopped one (#f); read the gate's drop
//         counts (none: a stopped receiver is not a forged envelope)
// sre: does a message to a dead worker fail visibly to the sender instead of vanishing?
test('send-to answers #t when the peer took it and #f when the peer is gone', () => {
  const { s } = makeSup()
  const peer = s.spawn({ name: 'peer', program: `(on 'ping (lambda (x) (remember 'got x)))` })
  const w = s.spawn({ name: 'caller', program: `(on 'go (lambda (to) (remember 'ok (send-to to 'ping 7))))` })
  s.send(w.id, 'go', peer.id)
  assert.deepEqual([w.kv.ok, peer.kv.got], [true, 7])
  s.stop(peer.id)
  s.send(w.id, 'go', peer.id)
  assert.equal(w.kv.ok, false)
  assert.deepEqual(Object.values(s.status().dropped).reduce((a, b) => a + b, 0), 0)
})

