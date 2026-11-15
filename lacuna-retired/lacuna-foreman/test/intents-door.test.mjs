// intents-door.test.mjs — THE INTENT DOOR'S REFUSALS AND BOUNDS (lane U2). Owns: the unit tests of `fileRun` and
// `intent` in intents.mjs: every refusal with its fault id and exit 12 (F-02 header, F-02 shell, F-03 cap and repeat,
// F-21 an act asked twice), the clamp of a deadline to the header's, the record each refusal leaves, and the bounds on
// what a refused loop may grow (steps 200, kicks 32). Refuses: a mock of intents.mjs (the supervisor is the real one on
// the conformance fake host); the live door.
// Implements: design §6 change 1 (the brain emits, the foreman records), §6 change 2 (a–f), §7.1–7.2, §12.3, §21 ReAct
// row (hop cap 5, ≤ 7); laws 3 · 4 · 6; engineering §3.3 intent fields, §3.4 step 4, §3.5 (HOP, HOPS, DESK_READS, rings).
// Invariants (§18): "if an act ran, then a press ticket preceded it"; "if a step is done, a ticket closed it".
// Faults (§16): F-02, F-03, F-21 (exit 12).
// coverage: intents.mjs — lines 100% branches 99.06% functions 100% (2026-10-24, lane U2 files; :169 :179 :183 named test.todo in intents-result)
import test from 'node:test'
import assert from 'node:assert/strict'
import { makeSup, DEADLINES } from '../../../test/conformance/fake-host.mjs'
import { fileRun, intent, result, holdForOwner, HOP, HOPS, SHELL, DESK_READS } from '../intents.mjs'
import { HAND_READS } from '../capabilities.mjs'
import { readContract, renderContract, STEPS_KEPT, KICKS_KEPT } from '../contract.mjs'

const rec = (w) => readContract(renderContract(w.contract))

// spec: design §6 change 2 (b) "checks tool against the run's header" · §12.3 "the desk default: reads only, no shell" · F-02 · exit 12
// class: L3 an act without a press (a shell is an effect) · W5 malformed (an intent with no tool)
// technique: table walk over SHELL × {desk run, act run without the act, act run with it}; empty and blank tools
// method: each refusal carries F-02 and exit 12, and the contract shows a `skipped` row with the fault; only a shell the
//         act header names is taken (as an act); nothing refused reaches upstream
// sre: if the brain asks for a shell on a desk turn, is it refused with a sentence and a record, never run?
test('every shell name is refused on a desk run and on a run whose acts do not name it; a blank tool is F-02 too', () => {
  const { h, s } = makeSup()
  const desk = fileRun(s, { key: 'd', goal: 'g' })
  const act = fileRun(s, { key: 'a', goal: 'g', tier: 'act', hands: ['shell', 'jobs'], acts: ['restart-api'] })
  const named = fileRun(s, { key: 'n', goal: 'g', tier: 'act', acts: ['shell'] })
  for (const tool of SHELL) {
    for (const w of [desk, act]) {
      const r = intent(s, w.id, { tool, args: ['ls'] })
      assert.deepEqual([r.ok, r.fault, r.exit], [false, 'F-02', 12], `${tool} on ${w.run.key}`); assert.match(r.why, /is a shell/)
    }
  }
  for (const tool of ['', '   ', undefined, null]) assert.equal(intent(s, desk.id, { tool }).fault, 'F-02')
  assert.equal(intent(s, desk.id).fault, 'F-02', 'no intent at all')
  const skipped = rec(desk).steps.filter((x) => x.status === 'skipped')
  assert.equal(skipped.length, SHELL.size + 5); assert.ok(skipped.every((x) => /^F-02: /.test(x.text) && x.ticket === null))
  assert.equal(h.up.filter((u) => u.kind === 'hand' || (u.kind === 'act' && u.data.op !== 'checkout')).length, 0)
  const ok = intent(s, named.id, { tool: 'shell', args: ['ls'] })
  assert.deepEqual([ok.ok, ok.kind], [true, 'act'], 'a shell the act header names is an act, under its press')
})

// spec: finale order §3.11 unit 2 ("a shell is a verb under the jail with the hands' allow-list") · §12.3 (the desk reads only) · law 3
// class: L3 an act without a press (a shell must stay refused) · B the road works
// technique: the desk default header; one intent per name
// method: a desk run holds `sh`; (sh "df" "-h") goes upstream as a hand with its arguments, a ticket and a running step; `shell`
//         and `bash` on the same run stay F-02 "is a shell"; a run whose header lacks `sh` refuses it as outside the header
// sre: when the desk mind calls a command, does the foreman hand it to the executor as a read, and still refuse a shell?
test('sh is a desk hand: the intent goes upstream as a read with its arguments; shell and bash stay refused', () => {
  const { h, s } = makeSup()
  const desk = fileRun(s, { key: 'sh', goal: 'g' })
  assert.ok(desk.run.hands.has('sh') && DESK_READS.includes('sh') && HAND_READS.has('sh') && !SHELL.has('sh'))
  const r = intent(s, desk.id, { tool: 'sh', args: [{ cmd: 'df', argv: ['-h', '/'] }] })
  assert.deepEqual([r.ok, r.kind], [true, 'hand'])
  const up = h.up.filter((u) => u.kind === 'hand')
  assert.equal(up.length, 1); assert.deepEqual([up[0].data.op, up[0].data.args], ['sh', [{ cmd: 'df', argv: ['-h', '/'] }]])
  for (const tool of ['shell', 'bash']) assert.match(intent(s, desk.id, { tool, args: ['df -h'] }).why, /is a shell; a desk run reads only/)
  const narrow = fileRun(s, { key: 'n2', goal: 'g', hands: ['disk'] })
  assert.match(intent(s, narrow.id, { tool: 'sh', args: [{ cmd: 'df' }] }).why, /sh is not in the run's header/)
})

// spec: design §6 change 2 (b) · §16 F-02 "the brain named a hand or act the run's header does not hold" · §11 (a watch run never acts)
// class: L3 an act without a press (a watch-tier run asking an act)
// technique: table over header × tier: a read outside the header, an act outside it, an act on a watch run, a name in both lists
// method: read the fault, exit and sentence; a name in hands and acts is an act (the effect wins); the window lists six hands at most
// sre: if the brain hallucinates a tool, does it get one sentence naming what it holds, so it can choose again?
test('a tool outside the header, and any act on a watch run, are F-02 exit 12 with the header in the sentence; a name in both is an act', () => {
  const { s } = makeSup()
  const w = fileRun(s, { key: 'h', goal: 'g', hands: ['jobs', 'disk', 'health', 'services', 'alerts', 'errors', 'builds'] })
  const r = intent(s, w.id, { tool: 'release-now' })
  assert.deepEqual([r.fault, r.exit], ['F-02', 12]); assert.match(r.why, /not in the run's header \(hands jobs disk health services alerts errors…\)/)
  const watch = fileRun(s, { key: 'wa', goal: 'g', hands: ['jobs'], acts: ['bundle'] })
  assert.deepEqual(watch.run.acts, new Set(), 'a watch run holds no acts, whatever the filing says')
  assert.equal(intent(s, watch.id, { tool: 'bundle' }).fault, 'F-02')
  const both = fileRun(s, { key: 'b', goal: 'g', tier: 'act', hands: ['bundle'], acts: ['bundle'] })
  assert.equal(intent(s, both.id, { tool: 'bundle' }).kind, 'act')
  w.tier = 'watch'; w.run.acts.add('bundle')                         // a header that names an act on a watch worker
  const r2 = intent(s, w.id, { tool: 'bundle' })
  assert.deepEqual([r2.fault, r2.exit], ['F-02', 12]); assert.match(r2.why, /a watch run may not act \(bundle\)/)
})

// spec: design §16 F-21 "the brain asked the same act with the same args while its ticket was open" · §6 change 2 (e) "an act first
//       waits on its press ticket" · §16 F-08 "never re-ask" · law 4 "acts are … never re-sent"
// class: E10 a duplicate message (an act re-sent) · L3 an act without a press
// technique: state-machine walk: act pending → waiting on the press → asked again; then held for the owner → asked again
// method: before the fix, an act whose ticket waited on the owner's press (kind `press`) was not seen as pending, so the
//         same act opened a second ticket and went to the hands a second time; now both asks are F-21 and upstream holds one act
// sre: if the brain grows impatient while the owner has not pressed, could the box run the release twice once he does?
test('an act asked again while its ticket waits on the owner\'s press is F-21: one ticket, one act upstream', () => {
  const { h, s } = makeSup()
  const w = fileRun(s, { key: 'p', goal: 'g', tier: 'act', acts: ['bundle', 'release'] })
  const i = intent(s, w.id, { tool: 'bundle', args: ['world'] })
  result(s, w.id, 'act', { ticket: i.ticket, op: 'bundle', exit: null, waiting: "the owner's press" })
  assert.equal(w.pending[0].kind, 'press')
  const again = intent(s, w.id, { tool: 'bundle', args: ['world'] })
  assert.deepEqual([again.ok, again.fault, again.exit], [false, 'F-21', 12]); assert.match(again.why, /already pending; an act is never re-sent/)
  const j = intent(s, w.id, { tool: 'release', args: ['1.2'] })
  holdForOwner(s, w.id, 'the release card')
  assert.equal(intent(s, w.id, { tool: 'release', args: ['1.2'] }).fault, 'F-21')
  assert.equal(intent(s, w.id, { tool: 'bundle', args: ['other'] }).ok, true, 'other arguments are another act')
  assert.equal(h.up.filter((u) => u.kind === 'act' && u.data.op === 'bundle' && u.data.args[0] === 'world').length, 1)
  assert.equal(h.up.filter((u) => u.kind === 'act' && u.data.op === 'release').length, 1)
  assert.equal(w.pending.filter((t) => t.op === 'release').length, 1); assert.equal(j.ok, true)
})

// spec: design §6 change 2 (c) "clamps deadline to the header's" · §7.1 `deadline` · eng §3.3 "deadline (s)" · F-01 · exit 15
// class: E8 a deadline passed · J13 a value non-numeric
// technique: boundary on the intent's deadline: none, 0, negative, a word, under the header's, over it, `deadline_s`
// method: read each ticket's deadline_at − sent_at: the header's 10 s unless a positive number below it is given; a longer
//         ask never extends the header (the clamp); `deadline` wins over `deadline_s`
// sre: if the brain asks for an hour on a read, does the hands' clock still kill it at the header's deadline?
test('an intent\'s deadline only shortens the header\'s: a longer or junk deadline keeps the header\'s 10 s', () => {
  const { s } = makeSup()
  const w = fileRun(s, { key: 'dl', goal: 'g', hands: ['jobs', 'disk', 'health', 'services', 'alerts', 'errors', 'builds'], hops: 7 })
  const span = (o) => { const r = intent(s, w.id, { tool: 'jobs', args: [String(Math.random())], ...o }); const t = w.pending.find((x) => x.ticket === r.ticket); return t.deadline_at - t.sent_at }
  assert.deepEqual([span({}), span({ deadline: 0 }), span({ deadline: -5 }), span({ deadline: 'soon' }), span({ deadline: 3 }), span({ deadline: 3600 }), span({ deadline_s: 4, deadline: undefined })],
    [DEADLINES.hand, DEADLINES.hand, DEADLINES.hand, DEADLINES.hand, 3, DEADLINES.hand, 4])
})

// spec: §21 ReAct row "the hop cap 5, at most 7" · eng §3.5 hop cap · F-03 · design §9 (a kick) · eng §3.3 "a second cap asks the owner"
// class: E6 an infinite loop (a brain that never finishes) · E7 a zombie (held for the owner, no deadline on a person)
// technique: state-machine walk past the cap: the first hit, the second, a third
// method: hop 6 on a cap-5 run is F-03 with a kick event sent to the run and a kick row; the second hit holds the run for
//         the owner (waiting-owner, the act becomes a press with no deadline) and says `waiting`; the cap reads 1…7 from `hops`
// sre: if the brain loops forever, does the foreman stop taking intents, kick once, and then hand the run to a person?
test('past the hop cap the first intent is kicked, the second holds the run for the owner; the cap is 1…7 from the filing', () => {
  const { h, s } = makeSup()
  assert.deepEqual([0, 1, 3, 7, 8, 'x', -2].map((hops) => fileRun(s, { key: `c${hops}`, goal: 'g', hops }).run.cap), [HOPS.default, 1, 3, 7, HOPS.max, HOPS.default, 1])
  const w = fileRun(s, { key: 'cap', goal: 'g', tier: 'act', hands: ['jobs'], acts: ['bundle'] })
  for (let k = 1; k < HOPS.default; k++) { const r = intent(s, w.id, { tool: 'jobs', args: [k] }); result(s, w.id, 'hand', { ticket: r.ticket, op: 'jobs', exit: 0 }) }
  assert.equal(intent(s, w.id, { tool: 'bundle' }).ok, true, 'the fifth hop is an act, still pending')
  const first = intent(s, w.id, { tool: 'jobs' })
  assert.deepEqual([first.fault, first.exit, first.kick, first.waiting], ['F-03', 12, true, undefined])
  const second = intent(s, w.id, { tool: 'jobs' })
  assert.deepEqual([second.fault, second.waiting], ['F-03', true]); assert.match(second.why, /hit twice: the owner decides/)
  assert.equal(w.contract.state, 'waiting-owner'); assert.equal(w.pending[0].kind, 'press'); assert.equal(w.pending[0].deadline_at, null)
  assert.equal(rec(w).kicks.length, 2); assert.equal(rec(w).kicks[0].evidence.cap, 5)
  assert.equal(h.up.filter((u) => u.kind === 'hand').length, HOPS.default - 1)
  h.tick(7200); s.sweep(); assert.equal(w.state, 'running', 'no deadline on a person')
})

// spec: eng §3.5 rings "steps 200 · kicks 32" ("nothing that only grows") · design §8 · §21 ReAct (repeat rule)
// class: J16 an array that grows without a bound · B1 every *_KEPT bound holds under 10× its size
// technique: flood: a brain that keeps asking after the cap and the repeat rule refuse it, 10× each ring
// method: before the fix a refused intent pushed a `skipped` step and a kick row with no bound, so a looping brain grew the
//         contract (and every checkpoint) without end; now the steps ring holds 200 and the kicks 32, newest last
// sre: if a broken brain loops on refused intents all night, does the run's record stay small enough to checkpoint?
test('a brain looping on refused intents grows neither the steps past 200 nor the kick record past 32', () => {
  const { s } = makeSup()
  const w = fileRun(s, { key: 'loop', goal: 'g', hops: 1 })
  const r = intent(s, w.id, { tool: 'jobs' }); result(s, w.id, 'hand', { ticket: r.ticket, op: 'jobs', exit: 0 })
  for (let i = 0; i < 10 * STEPS_KEPT; i++) intent(s, w.id, { tool: i % 2 ? 'jobs' : 'nope' })
  assert.ok(w.contract.steps.length <= STEPS_KEPT, `${w.contract.steps.length} steps`)
  assert.ok(w.contract.kicks.length <= KICKS_KEPT, `${w.contract.kicks.length} kicks`)
  assert.equal(w.contract.steps.at(-1).n, w.contract.step, 'the newest step is kept')
  assert.ok(JSON.stringify(w.contract).length < 80_000)
})

// spec: design §6 change 2 (positional results) · §7.2 accepted {intent, ticket, promise} · eng §3.3 "`n` is the position the result will carry"
// class: L5 the record's shape (positions and the accepted form)
// technique: state-machine walk over three accepted intents; the accepted reply's fields
// method: `n` is 1, 2, 3; the reply carries {ok, ticket, n, kind, intent, promise}; `intent` is the brain's id when given,
//         else the ticket; upstream carries n and the run's key; a promise is recorded with the intent's ticket
// sre: if the brain reads result 2, is it the second thing that was asked and ran, never another?
test('positions count the run\'s intents 1, 2, 3; the accepted form names the brain\'s id, the ticket and the promise', () => {
  const { h, s } = makeSup()
  const w = fileRun(s, { key: 'pos', goal: 'g' })
  const a = intent(s, w.id, { tool: 'jobs', id: 'i-1' })
  const b = intent(s, w.id, { tool: 'disk', promise: 'read the disk', id: 7 })
  assert.deepEqual([a.n, b.n, a.intent, b.intent, a.promise, b.promise], [1, 2, 'i-1', '7', null, 'p-1'])
  assert.deepEqual(Object.keys(b), ['ok', 'ticket', 'n', 'kind', 'intent', 'promise'])
  const c = intent(s, w.id, { tool: 'health' })
  assert.equal(c.intent, c.ticket, 'no id: the ticket names the intent')
  assert.deepEqual(h.up.filter((u) => u.kind === 'hand').map((u) => [u.data.n, u.data.run]), [[1, 'pos'], [2, 'pos'], [3, 'pos']])
  assert.equal(w.contract.promises[0].ticket, b.ticket); assert.equal(w.contract.promises[0].deadline_at - w.contract.promises[0].made_at, s.alive.hand)
})

test.todo('design §6 change 2: "a refusal is exit 12 with one sentence, and it still occupies its positional result slot" — intents.mjs ' +
  'gives a refusal no position (`n` counts accepted intents; the refusal is a `skipped` step row). Not changed here: the brain loop ' +
  '(lacuna-node, not U2) polls results/<n> by the accepted n. MAIL [U2] [lead]; reachable once the lead rules which is right.')

// spec: design §7.1 "args" (a list, or the object the hand names) · eng §3.3 "args: [<one object>]"
// class: J7 hostile input (a 10,000-char argument; a non-list) · J15 Unicode
// technique: boundary on argument length (2,000 / 2,001 chars) and on the args' type
// method: string args are cut at 2,000 chars; an object passes as the object; a number or string is no args; the step row
//         names the args (an object as JSON, cut to 120)
// sre: if the brain pastes a whole file into an argument, does the ticket carry a bounded copy?
test('string arguments are cut at 2,000 chars; an object is passed whole; anything else is no arguments', () => {
  const { h, s } = makeSup()
  const w = fileRun(s, { key: 'args', goal: 'g', hops: 7 })
  intent(s, w.id, { tool: 'jobs', args: ['x'.repeat(2000), 'y'.repeat(2001), 5, { a: 1 }] })
  assert.deepEqual(h.up.at(-1).data.args.map((a) => (typeof a === 'string' ? a.length : a)), [2000, 2000, 5, { a: 1 }])
  intent(s, w.id, { tool: 'files', args: { path: 'runs/x', glob: '中*' } })
  assert.deepEqual(h.up.at(-1).data.args, { path: 'runs/x', glob: '中*' })
  assert.match(w.contract.steps.at(-1).text, /^2: hand files \{"path":"runs\/x","glob":"中\*"\}$/)
  for (const args of [7, 'ls', null]) { intent(s, w.id, { tool: 'disk', args }); assert.deepEqual(h.up.at(-1).data.args, []) }
})

// spec: design §6 change 4 / §17 (a run that is not running takes no intent) · eng §3.4
// class: E11 an orphan (an intent for a run that ended) · E9 a message lost (what the sender sees)
// technique: state-machine walk: no such run, a worker that is not a run, a run stopped, a run paused
// method: an unknown id and a plain worker answer "no such run" with no fault; a stopped or paused run refuses with its
//         state and no fault (nothing was asked wrong), and the stopped contract gets no row
// sre: if the brain loop sends an intent after its run ended, does it learn that in one sentence without a phantom ticket?
test('an intent for no run, a plain worker or a run that is not running is refused with no fault and no record', () => {
  const { s } = makeSup()
  assert.deepEqual(intent(s, 'w-none', { tool: 'jobs' }), { ok: false, fault: null, why: 'no such run' })
  const plain = s.spawn({ name: 'plain', program: "(on 'x (lambda (v) #t))" })
  assert.equal(intent(s, plain.id, { tool: 'jobs' }).why, 'no such run')
  const w = fileRun(s, { key: 'gone', goal: 'g' }); s.stop(w.id, 'stopped by the owner')
  const steps = w.contract.steps.length
  const r = intent(s, w.id, { tool: 'jobs' })
  assert.deepEqual([r.ok, r.fault, r.exit], [false, null, null]); assert.match(r.why, /the run is retired/)
  assert.equal(w.contract.steps.length, steps)
})

// spec: design §6 change 4 (filing) · §8 lifecycle "file … contract filed" · eng §3.4 step 1 · §12.3 DESK_READS
// class: L5 the record's shape (what a filing writes) · E12 the supervisor dies (the checkpoint a restart reads)
// technique: table walk over the filing's options; a host that captures checkpoints
// method: a desk run holds DESK_READS ∩ the read table; `allReads` holds the whole table; given hands win; intensity picks
//         the hop deadline; the run is checkpointed with its contract, header and wait at filing (a restart brings it back)
// sre: if the foreman is killed right after a filing, does the checkpoint hold the run, its header and its contract?
test('a filing seeds the header from its options and checkpoints the run with its contract at once', () => {
  const saved = []
  const { h, s } = makeSup(); h.checkpoint = (id, d) => saved.push(JSON.parse(JSON.stringify(d)))
  const desk = fileRun(s, { key: 'k1', goal: 'g', intensity: 'high' })
  assert.deepEqual([...desk.run.hands], [...DESK_READS.filter((x) => HAND_READS.has(x)), 'work-order', 'seat', 'remember', 'note', 'say', 'review', 'petition']); assert.equal(desk.run.desk, true)   // + the desk's own verbs (desk-verbs.mjs)
  assert.equal(desk.awaiting.due - desk.awaiting.since, DEADLINES.hop, 'the host\'s hop clock wins')
  delete h.deadlines
  const all = fileRun(s, { key: 'k2', goal: 'g', allReads: true, intensity: 'low', desk: false, touches: 'x', cart: 'c', name: 'my-run', parent: null, press: 'yes' })
  assert.equal(all.run.hands.size, HAND_READS.size); assert.equal(all.run.desk, false); assert.equal(all.awaiting.due - all.awaiting.since, HOP.low)
  assert.deepEqual([all.name, all.run.cart, all.run.touches, all.run.press, all.run.repo, all.contract.cart], ['my-run', 'c', [], null, null, 'c'])
  const n = fileRun(s, { key: 'k3', goal: 'g', intensity: 'urgent', touches: Array.from({ length: 30 }, (_, i) => i), desk: true, hands: ['jobs'] })
  assert.deepEqual([n.run.intensity, n.run.touches.length, n.run.touches[0], n.run.desk], ['normal', 24, '0', true])
  const ck = saved.filter((d) => d.id === all.id).at(-1)
  assert.deepEqual([ck.contract.key, ck.contract.state, ck.run.key, ck.run.hands.length, typeof ck.awaiting.due], ['k2', 'filed', 'k2', HAND_READS.size, 'number'])
  for (const bad of [undefined, {}, { key: 'k' }, { goal: 'g' }, { key: '', goal: 'g' }]) assert.throws(() => fileRun(s, bad), /a run is filed with a key and a goal/)
})

// spec: design §6 change 2 (a) ("takes run from the turn, not the body") · eng §3.3 `runs {key, goal, …}` (from the brain loop's JSON)
// class: J2 an uncaught exception in a callback · E11 an orphan (a half-filed run)
// technique: fault injection on the filing's types: a goal that is a number, a key that is a number
// method: before the fix `o.goal.slice` threw after the worker was spawned and its contract opened, leaving a running run
//         nobody filed; now the goal is read as text, the filing completes, and the record names it
// sre: if the door passes a JSON number as a goal, does the foreman file the run or refuse it, never leave a half-filed worker?
test('a goal or key that is not a string files a whole run, never a half-filed worker', () => {
  const { s } = makeSup()
  const w = fileRun(s, { key: 42, goal: 1234 })
  assert.equal(w.run.key, '42'); assert.equal(w.contract.goal, '1234')
  assert.match(w.thoughts.at(-1).text, /^run filed: 1234 /)
  assert.equal([...s.workers.values()].filter((x) => x.state === 'running').length, 1)
})

// spec: design §12 (a cart's header names its hands and acts as symbols) · §6 change 2 (b)
// class: J7 hostile input (a header list that is not a list; symbols for names)
// technique: table over header shapes: symbols ({name}), a bare string, an act tier with no acts
// method: symbol names read as their names; a string where a list belongs holds nothing; an act run filed with no acts holds none
// sre: if a cart writes its header as symbols or a bare word, does the run hold exactly what it names, never a surprise tool?
test('a header names its tools as symbols or strings; a bare word where a list belongs holds nothing', () => {
  const { s } = makeSup()
  const sym = fileRun(s, { key: 's1', goal: 'g', tier: 'act', hands: [{ name: 'jobs' }, 'disk'], acts: [{ name: 'merge' }] })
  assert.deepEqual([[...sym.run.hands], [...sym.run.acts]], [['jobs', 'disk'], ['merge']])
  const word = fileRun(s, { key: 's2', goal: 'g', hands: 'jobs' })
  assert.equal(word.run.hands.size, 0); assert.equal(intent(s, word.id, { tool: 'jobs' }).fault, 'F-02')
  const none = fileRun(s, { key: 's3', goal: 'g', tier: 'act', hands: ['jobs'] })
  assert.equal(none.run.acts.size, 0)
})

// spec: finale order §3.11, §3.19 (the room files a run for one call; a pressed act lands hours after the room's turn left) ·
//       intents.mjs result ("a run filed `once` ends with its one receipt") · law 6 (the run's end is the foreman's word)
// class: L5 a run left open (it would stall at its hop deadline and read as a failure) · technique: two once-runs and a plain one
// method: a once-run ends when its one receipt lands: stopped on exit 0, failed with the receipt's words otherwise; a once-run
//         whose act waits on the owner's press stays open until the press's receipt; a plain run keeps awaiting its brain; the
//         desk's default header holds `git`, a hand
// sre: when the owner presses an act the next morning, does its run end clean, or show a stall nobody caused?
test('a run filed once ends with its one receipt; one waiting on the press stays open until then; the desk holds the git hand', () => {
  const { h, s } = makeSup()
  const ok = fileRun(s, { key: 'room:e4b:one', goal: 'g', desk: true, hands: ['git'], hops: 1, once: true })
  intent(s, ok.id, { tool: 'git', args: [{ mind: 'e4b', verb: 'status' }] })
  const r = result(s, ok.id, 'hand', { ticket: h.up.filter((u) => u.kind === 'hand').at(-1).data.ticket, op: 'git', exit: 0, rows: { text: '## main' } })
  assert.equal(r.ended, true); assert.deepEqual([ok.contract.exit, ok.contract.outcome], [0, 'stopped'])
  const bad = fileRun(s, { key: 'room:e4b:two', goal: 'g', desk: true, hands: ['git'], hops: 1, once: true })
  intent(s, bad.id, { tool: 'git', args: [{ mind: 'e4b', verb: 'push' }] })
  result(s, bad.id, 'hand', { ticket: h.up.filter((u) => u.kind === 'hand').at(-1).data.ticket, op: 'git', exit: 12, why: 'git-push' })
  assert.equal(bad.contract.outcome, 'fail'); assert.match(bad.contract.why, /^exit 12: git-push/)
  const act = fileRun(s, { key: 'room:e4b:push', goal: 'g', desk: true, tier: 'act', acts: ['git-push'], hops: 1, once: true })
  intent(s, act.id, { tool: 'git-push', args: [{ branch: 'cl/release' }] })
  const sent = h.up.filter((u) => u.kind === 'act').at(-1).data
  result(s, act.id, 'act', { ticket: sent.ticket, op: 'git-push', waiting: "the owner's press" })
  assert.equal(act.contract.exit, null, 'it waits on the owner, open'); assert.equal(act.pending.at(-1).kind, 'press')
  result(s, act.id, 'act', { ticket: sent.ticket, op: 'git-push', exit: 0, rows: { text: 'pushed' } })
  assert.deepEqual([act.contract.exit, act.contract.outcome], [0, 'stopped'])
  const plain = fileRun(s, { key: 'p', goal: 'g', hands: ['git'] })
  intent(s, plain.id, { tool: 'git', args: [{ mind: 'e4b', verb: 'log' }] })
  result(s, plain.id, 'hand', { ticket: h.up.filter((u) => u.kind === 'hand').at(-1).data.ticket, op: 'git', exit: 0 })
  assert.equal(plain.contract.exit, null); assert.ok(plain.awaiting)
  assert.ok(fileRun(s, { key: 'd2', goal: 'g' }).run.hands.has('git') && DESK_READS.includes('git'))
})
