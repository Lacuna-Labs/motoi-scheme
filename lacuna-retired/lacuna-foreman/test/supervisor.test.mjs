// supervisor.test.mjs — U1 unit tests for `supervisor.mjs`: the baseline behaviours of the Erlang-model kernel (a worker
// loads, handles, reports, remembers; spawns a child; a crash restarts it; the third buries it; a child never outranks its
// parent; a loop stops itself; no worker reaches the host; the trial; manners).
// owns: the baseline; supervisor-restart (types, intensity, poisoned, strategies, order), supervisor-limits (every LIMITS
//   number, mailbox, fuel, manners), supervisor-wire (the gate, timers, the sweep, minds, trial), supervisor-record (kv,
//   sparse checkpoints, the desk record) and supervisor-known (the trial's table) hold the failure classes.
// refuses: to mock supervisor.mjs; every test runs real programs on a real Supervisor and a fake clock.
// implements: design §6 (the kernel; the seven changes; change 5), §11 (capabilities at spawn), §17 (30), laws 3 and 11;
//   eng §2 row, §3.5 (intensity 3/300, fuel 200,000/50,000, mailbox 100, workers 64, depth 3, children 8, filedEach 8,
//   everyMin 5, subscribeMin 15).
// invariants: "If a run foreman died, then its children are buried"; "If a step is done, then a ticket closed it".
// faults: F-04.
// coverage: supervisor.mjs — lines 100% branches 99.26% functions 98.85% (2026-10-24; supervisor*.test.mjs together;
//   the three unreachable branches and the trial's mind stub are todos in supervisor-record.test.mjs)
import test from 'node:test'
import assert from 'node:assert/strict'
import { Supervisor, LIMITS, TOMBSTONE_S } from '../supervisor.mjs'
import { describe } from '../trial.mjs'

function host() {
  let t = 1000
  let n = 0
  const up = []
  return {
    up, tick: (s) => { t += s },
    now: () => t, id: () => `w${++n}`, save: () => {}, upstream: (kind, w, data) => up.push({ kind, name: w.name, data }),
  }
}

// spec: design §6 (a slat program as a process: load, handle, report, remember) · eng §3.3 (report upstream)
// class: E9 a message lost (the baseline: an event delivered and its report on the record)
// technique: fake clock; one event, read upstream and the description
// method: send 'disk 6.2; read the `report` row upstream (kind alert, the data) and the kv on the description
// sre: does the simplest worker do what it says, with its report on the record and its memory on the card?
test('a worker loads, handles an event, reports and remembers', () => {
  const h = host()
  const s = new Supervisor(h)
  const w = s.spawn({ name: 'disk-watch', program: `
    (on 'disk (lambda (pct)
      (remember 'last pct)
      (if (< pct 10) (report 'alert "disk low" pct) (report 'ok pct))))` })
  assert.equal(w.state, 'running')
  assert.equal(s.send(w.id, 'disk', 6.2).ok, true)
  assert.deepEqual(h.up.at(-1), { kind: 'report', name: 'disk-watch', data: { at: 1000, kind: 'alert', data: ['disk low', 6.2] } })
  assert.equal(describe(w).kv.last, 6.2)
})

// spec: design §6 (spawn; a child's report hops to its parent, signed) · law 5 · eng §3.2
// class: E11 an orphan (the baseline: the child knows its parent and the parent hears it)
// technique: state walk over a two-level tree
// method: the child's parent and depth; the child reports; the parent's (on 'child-report) wrote its kv
// sre: does a child's word reach its parent through the signed hop, every time?
test('a worker spawns a worker; the child reports to its parent', () => {
  const h = host()
  const s = new Supervisor(h)
  const p = s.spawn({ name: 'parent', program: `
    (define heard '())
    (on 'child-report (lambda (r) (set! heard r) (remember 'heard #t)))
    (define kid (spawn 'kid "(on 'ping (lambda (x) (report 'pong x)))"))
    (remember 'kid kid)` })
  const kid = s.workers.get(p.kv.kid)
  assert.equal(kid.parent, p.id)
  assert.equal(kid.depth, 2)
  s.send(kid.id, 'ping', 7)
  assert.equal(p.kv.heard, true)
})

// spec: design §6 change 5 · eng §3.5 intensity 3/300 · F-04 · exit 30
// class: E2 restart intensity exceeded
// technique: fault injection on a fake clock: three crashes inside the window
// method: the first crash restarts (kv kept); the third is the grave; the parent's (on 'child-graved) ran; upstream has
//         `child-graved` for the worker
// sre: if a worker crash-loops, does the foreman stop restarting it and tell its parent?
test('a crash restarts the worker with its KV; the third in the window buries it and the parent hears', () => {
  const h = host()
  const s = new Supervisor(h)
  const p = s.spawn({ name: 'parent', program: `(on 'child-graved (lambda (x) (remember 'buried #t)))` })
  const w = s.spawn({ name: 'fragile', parent: p.id, program: `(on 'boom (lambda (x) (car '())))` })
  s.workers.get(w.id).kv.kept = 1
  assert.equal(s.send(w.id, 'boom', 0).restarted, true)
  assert.equal(w.state, 'running')
  assert.equal(w.kv.kept, 1)
  s.send(w.id, 'boom', 0)
  const r = s.send(w.id, 'boom', 0)
  assert.equal(r.grave, true)
  assert.equal(w.state, 'grave')
  assert.equal(p.kv.buried, true)
  assert.ok(h.up.some((u) => u.kind === 'child-graved' && u.name === 'fragile'))
})

// spec: design §6 change 5 · eng §3.5 intensity 3 in 300 s
// class: E2 restart intensity exceeded (its boundary: crashes spread past the window)
// technique: time travel: five crashes, each 301 s apart
// method: read the state after the fifth: running (the window forgets old crashes)
// sre: does a worker that fails once a day ever get buried for it? It must not.
test('crashes outside the window do not add up', () => {
  const h = host()
  const s = new Supervisor(h)
  const w = s.spawn({ name: 'slow-fail', program: `(on 'boom (lambda (x) (car '())))` })
  for (let i = 0; i < 5; i++) { s.send(w.id, 'boom', 0); h.tick(LIMITS.crashWindow + 1) }
  assert.equal(w.state, 'running')
})

// spec: design §11 (a child ≤ its parent) · §6 LIMITS depth 3 · eng §3.5
// class: B7 workers 65, depth 4, children 9, filedEach 9
// technique: boundary: a child asking for act under a watch parent; depth 3 then 4
// method: the child's tier is watch; a chain 3 deep is allowed and the 4th throws "deep"
// sre: can a watch worker raise an act-tier child, or a tree grow without a bound?
test('a child never outranks its parent, and depth is capped', () => {
  const s = new Supervisor(host())
  const p = s.spawn({ name: 'p', program: `(define c (spawn 'c "(define x 1)" 'act)) (remember 'c c)` })
  assert.equal(s.workers.get(p.kv.c).tier, 'watch')
  let parent = p.id
  for (let d = 2; d <= LIMITS.depth; d++) parent = s.spawn({ name: `d${d}`, program: '(define x 1)', parent }).id
  assert.throws(() => s.spawn({ name: 'too-deep', program: '(define x 1)', parent }), /deep/)
})

// spec: design §6 (fuel 50,000 per event) · eng §3.5 · §10.2 (fuel stops a loop in 4 ms)
// class: E6 an infinite loop (fuel)
// technique: fault injection: a handler that recurses forever
// method: the send answers not ok with "fuel" in its reason; the worker is running (restarted)
// sre: does an infinite loop in one cart cost a few ms and a record, never the foreman?
test('a loop stops itself (fuel), and the worker survives it', () => {
  const s = new Supervisor(host())
  const w = s.spawn({ name: 'loop', program: `(define (spin) (spin)) (on 'go (lambda (x) (spin)))` })
  const r = s.send(w.id, 'go', 0)
  assert.equal(r.ok, false)
  assert.match(r.why, /fuel/)
  assert.equal(w.state, 'running')
})

// spec: design §6 · law 3 (the brain never executes) · §11 (only an act worker asks) · F-02
// class: E1 a handler throws (the refusal is the throw)
// technique: state walk: a host-reaching verb; ask from watch; ask from act
// method: read each send's reason; the act worker's `ask` row upstream carries its words
// sre: can any worker think around the brain, or a watch worker ask for an act?
test("a worker cannot reach the host: llm/ and persona/ are refused; only an act worker may ask", () => {
  const h = host()
  const s = new Supervisor(h)
  const w = s.spawn({ name: 'curious', program: `(on 'go (lambda (x) (llm/ask "hi")))` })
  assert.match(s.send(w.id, 'go', 0).why, /not a worker's verb/)
  const watch = s.spawn({ name: 'watcher', program: `(on 'go (lambda (x) (ask "restart vite")))` })
  assert.match(s.send(watch.id, 'go', 0).why, /watch worker/)
  const act = s.spawn({ name: 'actor', tier: 'act', program: `(on 'go (lambda (x) (ask "restart vite")))` })
  assert.equal(s.send(act.id, 'go', 0).ok, true)
  assert.deepEqual(h.up.at(-1), { kind: 'ask', name: 'actor', data: { what: 'restart vite' } })
})

// spec: design §6 change 5 (a program that cannot load: the grave) · F-04
// class: E4 poisoned state on restart (a program that can never load)
// technique: fault injection: an unbalanced program
// method: the spawn returns a worker in the grave (no restart loop)
// sre: does a broken program cost one record, never a crash loop?
test('a program that does not load goes straight to the grave', () => {
  const s = new Supervisor(host())
  const w = s.spawn({ name: 'broken', program: `(on 'x` })
  assert.equal(w.state, 'grave')
})

// spec: design §6 (stop walks the children) · invariant "a run foreman died → its children are buried"
// class: E15 shutdown ordering (children before parent)
// technique: state walk over a parent and its child
// method: stop the parent; the child is retired
// sre: when a parent stops, does any child keep running alone?
test('stopping a parent stops its children', () => {
  const s = new Supervisor(host())
  const p = s.spawn({ name: 'p', program: `(remember 'c (spawn 'c "(define x 1)"))` })
  s.stop(p.id)
  assert.equal(s.workers.get(p.kv.c).state, 'retired')
})

// spec: design §6 (a dry run before anyone is asked) · law 11 (plan, then execute)
// class: E1 a handler throws (found before anyone is asked)
// technique: state walk over four programs: unloadable, throwing, a %-format, a good one
// method: read each trial's ok and problems (the metric, the string-append advice) and the good one's report
// sre: does the trial catch the mistakes the brain makes most, before the owner sees the cart?
test('a trial catches a program that will not load, a handler that throws, and a format that will not fill', async () => {
  const { trial } = await import('../trial.mjs')
  assert.equal(trial('(on (quote x)').ok, false)
  assert.match(trial("(subscribe 'mem_available_gb 60) (on 'mem_available_gb (lambda (gb) (car '())))").problems[0], /mem_available_gb/)
  assert.match(trial("(on 'mem_available_gb (lambda (gb) (report 'alert (format \"low %.2f\" gb))))").problems.join(' '), /string-append/)
  const good = trial("(on 'mem_available_gb (lambda (gb) (when (< gb 1.5) (report 'alert (string-append \"low: \" (number->string gb))))))")
  assert.equal(good.ok, true)
  assert.deepEqual(good.reports[0], { at: 0, kind: 'alert', data: ['low: 1'] })
})

// spec: design §6 (the dry run calls every timer once) · eng §3.5 everyMin
// class: J2 uncaught exception in a callback (a timer that would throw at 3 a.m.)
// technique: state walk: a broken timer, a good one
// method: the broken timer is "timer 1" in the problems; the good one passes
// sre: does a timer that would throw in an hour get caught now?
test('a trial runs every timer once and catches a broken one', async () => {
  const { trial } = await import('../trial.mjs')
  const bad = trial("(every 3600 (lambda () ((hand 'repos))))")
  assert.equal(bad.ok, false)
  assert.match(bad.problems.join(' '), /timer 1/)
  assert.equal(trial("(every 60 (lambda () (report 'tick 1)))").ok, true)
})

// spec: design §6 change 1 (a hand is a read; its answer comes back as an event) · eng §3.3
// class: E9 a message lost (the baseline: a hand answer delivered and read)
// technique: one reply delivered; read the report it caused
// method: the handler reads (get r 'ok) and (get r 'result); its report says 2
// sre: does a read's answer reach the cart in a shape it can use?
test('get reads a hand answer; hand sends its op upstream', () => {
  const h = host()
  const s = new Supervisor(h)
  const w = s.spawn({ name: 'surveyor', program: `
    (every 3600 (lambda () (hand 'repos)))
    (on 'hand (lambda (r) (when (get r 'ok) (report 'repos (length (get r 'result))))))` })
  s.send(w.id, 'hand', { ok: true, op: 'repos', result: [{ name: 'a' }, { name: 'b' }] })
  assert.deepEqual(h.up.at(-1).data.data, [2])
})

// spec: design §4 (one word, one meaning) · eng §3.3 (the verbs in verbs.slat, the source since K1.13)
// class: L5 the ledger row's shape (the verb table's shape matches the code)
// technique: source scan: every def('…') in supervisor, mind, cart and verbs against verbs.slat
// method: no defined verb missing from the table; every example in the table passes its trial
// sre: if a verb is added without its row, does the brain's table lie about what a worker can say?
test('verbs.slat describes every verb a worker has, and its examples pass their trial', async () => {
  const fs = await import('node:fs')
  const { trial } = await import('../trial.mjs')
  const { readVerbTable } = await import('../verb-table.mjs')
  const doc = readVerbTable(fs.readFileSync(new URL('../verbs.slat', import.meta.url), 'utf8'))
  // verbs.mjs since K1 (2026-10-23): the scan read only supervisor/mind/cart and so checked none of the worker verbs (U1)
  const src = ['../supervisor.mjs', '../verbs.mjs', '../mind.mjs', '../cart.mjs'].map((f) => fs.readFileSync(new URL(f, import.meta.url), 'utf8')).join('\n')
  const defined = [...src.matchAll(/def\('([a-z-]+)'/g)].map((m) => m[1])
  assert.deepEqual(doc.verbs.map((x) => x.name).filter((v) => !defined.includes(v)), [], 'every row of the table is a verb the code defines')
  assert.deepEqual(defined.filter((v) => !doc.verbs.some((x) => x.name === v)), [])
  for (const ex of doc.examples) assert.equal(trial(ex.program).ok, true, ex.what + ': ' + JSON.stringify(trial(ex.program).problems))
})

// spec: design §6 (manners) · eng §3.5 (manners judged every 15 s)
// class: M6 memory pressure (the box is busy; the foreman hushes)
// technique: fault injection: host.manners answers a reason, then null, then a reason
// method: a new spawn is refused while hushed; a background event is skipped and counted; a person's event lands
// sre: when the box is under pressure, does background work wait while the owner's own requests still get through?
test('manners: a hushed foreman skips background turns and refuses new spawns; a person\'s event still lands', () => {
  let hushed = 'the box has 300 MB free'
  const h = { ...host(), manners: () => hushed }
  const s = new Supervisor(h)
  assert.throws(() => s.spawn({ name: 'late', program: '(define x 1)' }), /hushed/)
  assert.equal(s.spawn({ name: 'his', program: '(define x 1)', by: 'owner' }).name, 'his')   // the owner's own always starts (2026-11-04)
  hushed = null
  const w = s.spawn({ name: 'w', program: "(on 'm (lambda (v) (report 'seen v)))" })
  hushed = 'the box is busy'
  assert.equal(s.send(w.id, 'm', 1, { background: true }).skipped, true)
  assert.equal(s.send(w.id, 'm', 2).ok, true)
  assert.equal(w.skipped, 1)
})

// spec: design §7 (symbols are not body data; an op is a symbol to the program) · eng §3.3
// class: J7 JSON.parse on hostile input (a string where the program expects a symbol)
// technique: one reply with op "jobs" as a string
// method: the cart's (case op ((jobs) …)) matched: its report kind is `matched`
// sre: (2026-10-19) six carts' case never matched because every op arrived as a string — does one now?
test("a hand's op comes back as a symbol, so a cart's case on it matches", () => {
  const h = host()
  const s = new Supervisor(h)
  const w = s.spawn({ name: 'op-case', program: `
    (on 'hand (lambda (r) (case (get r 'op 'none) ((jobs) (report 'matched 1)) (else (report 'missed 1)))))` })
  s.send(w.id, 'hand', { op: 'jobs', ok: true, result: [] })
  assert.equal(h.up.at(-1).data.kind, 'matched')
})

// spec: design §6 (a small KV kept on purpose) · eng §10.2 (kv intact)
// class: J7 JSON.parse on hostile input (a symbol through JSON)
// technique: round trip: remember a symbol and a list of symbols, recall both
// method: (eq? (recall 'step) 'pass) and (eq? (car (recall 'kinds)) 'flaky) both hold: the report says same
// sre: (2026-10-19) the release cart's every (eq? (recall 'step) 'pass) was false — is a symbol still a symbol?
test('a remembered symbol is recalled as a symbol, in lists too', () => {
  const h = host()
  const s = new Supervisor(h)
  const w = s.spawn({ name: 'kv-sym', program: `
    (on 'go (lambda (x)
      (remember 'step 'pass)
      (remember 'kinds (list 'flaky 'flaky))
      (report 'r (if (and (eq? (recall 'step 'none) 'pass) (eq? (car (recall 'kinds '())) 'flaky)) 'same 'lost))))` })
  s.send(w.id, 'go', 1)
  assert.equal(h.up.at(-1).data.data[0].name ?? h.up.at(-1).data.data[0], 'same')
})

// spec: design §6 LIMITS children 8 · eng §3.5
// class: B7 workers 65, depth 4, children 9, filedEach 9
// technique: boundary: the 8th and 9th child, then one ended
// method: eight spawns land; the ninth is refused; after one child stops, the ninth lands
// sre: does a parent whose old children finished get to spawn again, without ever passing 8 alive?
test('the child cap counts living children only: ended ones make room (2026-10-24)', () => {
  const h = host(); const s = new Supervisor(h)
  const p = s.spawn({ name: 'p', program: `(on 'go (lambda (x) (spawn 'kid "(on 'tick (lambda (x) #t))")))`, verbs: ['spawn'] })
  for (let i = 0; i < LIMITS.childrenEach; i++) assert.equal(s.send(p.id, 'go', 0).ok, true)
  assert.equal(s.send(p.id, 'go', 0).ok, false, 'the ninth living child is refused')
  s.stop(p.children[0], 'done')
  assert.equal(s.send(p.id, 'go', 0).ok, true, 'an ended child makes room')
})

// burn-in B02 (2026-10-24): rest_for_one ordered siblings by `started` in whole seconds; three children born in one
// second tied and the older ones were restarted too. OTP orders by start order. The strategies had no test before this.
// spec: design §6 (three strategies) · eng §10.2 (010 · 011 · 111) · POSTMORTEMS 2026-10-24 burn-in B02
// class: E3 the wrong strategy family
// technique: state walk over one_for_one, rest_for_one, one_for_all with siblings born in one clock second
// method: crash the middle child; read which children got new handlers: 010, 011, 111
// sre: does a crash restart exactly the siblings OTP's strategy names, by birth order, never by the clock?
test('the three strategies restart exactly the right children, even when the siblings were born in the same second', () => {
  const crash = `(on 'go (lambda (x) (car 1)))`
  const out = []
  for (const policy of ['one_for_one', 'rest_for_one', 'one_for_all']) {
    const s = new Supervisor(host())
    const p = s.spawn({ name: 'p', program: `(on 'x (lambda (v) #t))` })
    const kids = [1, 2, 3].map((i) => s.spawn({ name: `k${i}`, program: crash, parent: p.id, policy }))
    const before = kids.map((k) => k.handlers)
    s.send(kids[1].id, 'go', 1)
    out.push(kids.map((k, i) => (k.handlers !== before[i] ? 1 : 0)).join(''))
  }
  assert.deepEqual(out, ['010', '011', '111'])
})

// K0 (2026-10-30): Gemini's ghost-worker trap, kept without the mesh. The attic's test addressed the worker by an IPv6 string in
// the door's format (fd1a:c01a:…, 8 quads) while the foreman's mesh.mjs printed another (fd00:lacu:…, 7 quads, "lacu" not hex),
// so the guard never matched and this was the attic's one red test. The guard keys on the worker's id and the generation the
// sender names (`targetGen`); the coordinate's gen field (SENTRY-2.0 §4, ROAD category 6) is this counter.
// spec: design §6 (restart; the supervisor assigns the generation) · eng §3.3 (a reply clears its ticket) · law 6
// class: E10 a duplicate message (a reply meant for a past generation) · E11 an orphan (a message for a buried worker)
// technique: fake clock; a crash restart makes generation 2; the record leaves the table as prune() leaves it; the sweep past
//            TOMBSTONE_S
// method: gen 1 takes its reply only when the reply names gen 1 (gen 2 named: refused, the ticket stays); after the crash the
//         worker is gen 2 and a gen-1 message is refused; a stopped worker in the table answers as before ('the worker is
//         retired'); once its record leaves the table its tombstone answers 'buried' with the stop's why; after TOMBSTONE_S the
//         sweep drops the tombstone ('no such worker')
// sre: can a message meant for a dead generation or a buried worker reach the live one, or close the live one's ticket?
test('the ghost-worker guard: a message for a past generation or a buried worker is refused before it touches a ticket', () => {
  const h = host()
  const s = new Supervisor(h)
  const w = s.spawn({ name: 'gen-reader', program: `
    (define t (hand 'jobs "all"))
    (on 'hand (lambda (r) (remember 'got #t)))
    (on 'boom (lambda (x) (car 1)))` })
  assert.equal(w.gen, 1)
  const ticket = w.pending[0].ticket
  const early = s.send(w.id, 'hand', { ticket, op: 'jobs', ok: true }, { targetGen: 2 })
  assert.deepEqual([early.ok, early.ghost_worker], [false, true])
  assert.match(early.why, /^gen-reader runs generation 1; a message for generation 2 is refused$/)
  assert.equal(w.pending.length, 1, 'a refused ghost message never closes a ticket')
  assert.equal(s.send(w.id, 'hand', { ticket, op: 'jobs', ok: true }, { targetGen: 1 }).ok, true)
  assert.equal(w.pending.length, 0)

  s.send(w.id, 'boom', 1)                                   // a throwing handler restarts the worker: generation 2
  assert.deepEqual([w.gen, w.state], [2, 'running'])
  const late = s.send(w.id, 'boom', 1, { targetGen: 1 })
  assert.deepEqual([late.ok, late.ghost_worker], [false, true])
  assert.match(late.why, /runs generation 2; a message for generation 1 is refused/)
  assert.equal(w.gen, 2, 'the gen-1 message did not crash generation 2')

  s.stop(w.id, 'task completed')
  assert.deepEqual(s.send(w.id, 'boom', 1), { ok: false, why: 'the worker is retired' })   // the record still answers for itself
  s.workers.delete(w.id)                                    // prune() drops a finished record from the table
  const buried = s.send(w.id, 'boom', 1)
  assert.deepEqual([buried.ok, buried.ghost_worker], [false, true])
  assert.equal(buried.why, 'gen-reader (generation 2) is buried: task completed')
  h.tick(TOMBSTONE_S + 1); s.sweep()
  assert.deepEqual(s.send(w.id, 'boom', 1), { ok: false, why: 'no such worker' })
})
