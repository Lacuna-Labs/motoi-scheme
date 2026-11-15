// intents-result.test.mjs — RESULTS, PRESSES, CLAIMS AND THE END OF A RUN (lane U2). Owns: the unit tests of `result`,
// `resultText`, `resultsOf`, `press`, `pressCheck`, `said`, `finishRun`, `doneCheck` and `holdForOwner` in intents.mjs:
// a reply lands once at its position, a duplicate never lands twice, a hand that wrote outside its touches stops the run
// (exit 12, mail), an act runs only pressed, a claim is never a record, and `pass` is written only by a form that held.
// Refuses: a mock of intents.mjs or the supervisor; the live door, hands and ledger.
// Implements: design §6 change 1–2 (f), §7.1–7.3, §8 lifecycle, §9 (a said promise is watched), §17, §18; laws 3 · 4 · 6;
// engineering §3.3 (`result` `said` `press` fields), §3.4 steps 5–7, §3.5 (RESULTS_KEPT 32).
// Invariants (§18): "if an act ran, then a press ticket preceded it, and the audit row names decided_by"; "if a step is
// done, then a ticket closed it"; "if a hand wrote outside runs/<run>/ … the run stops (exit 12) and mail goes out".
// Faults (§16): F-03, F-08, F-12, F-21; exits 0 · 12 · 15.
// coverage: intents.mjs — lines 100% branches 99.06% functions 100% (2026-10-24, lane U2 files; :169 :179 :183 named test.todo in intents-result)
import test from 'node:test'
import assert from 'node:assert/strict'
import { makeSup, DEADLINES } from '../../../test/conformance/fake-host.mjs'
import { fileRun, intent, result, said, finishRun, doneCheck, holdForOwner, press, pressCheck, resultText, resultsOf, RESULTS_KEPT } from '../intents.mjs'
import { readContract, renderContract } from '../contract.mjs'
import { readData } from '../../../lacuna-scheme/src/slat-data.js'

const rec = (w) => readContract(renderContract(w.contract))
const ask = (s, w, tool, args = [], o = {}) => intent(s, w.id, { tool, args, ...o })

// spec: design §6 change 2 (f) "on result, writes the step and last-result" · §18 "if a step is done, then a ticket closed it"
// class: E10 a duplicate message (the hands answer twice; a late reply after its ticket closed)
// technique: replay of the same signed reply, then the reply with a different value
// method: before the fix the second reply landed as a second row at the same position, overwrote last-result, and (by op)
//         could close another pending ticket of the same tool; now it is refused, the record keeps the first, and the
//         other ticket stays open
// sre: if the hands' reply is delivered twice, does the brain read one result per position and no ticket close by accident?
test('a second reply to a ticket already answered is refused: one row per position, last-result kept, other tickets untouched', () => {
  const { s } = makeSup()
  const w = fileRun(s, { key: 'dup', goal: 'g' })
  const a = ask(s, w, 'jobs', ['a']); const b = ask(s, w, 'jobs', ['b'])
  assert.equal(result(s, w.id, 'hand', { ticket: a.ticket, op: 'jobs', exit: 0, rows: 1 }).ok, true)
  const again = result(s, w.id, 'hand', { ticket: a.ticket, op: 'jobs', exit: 0, rows: 999 })
  assert.deepEqual([again.ok, again.duplicate], [false, true]); assert.match(again.why, /already answered/)
  assert.deepEqual(w.run.results.map((r) => [r.n, r.value.rows]), [[1, 1]])
  assert.equal(rec(w).last_result.rows, 1)
  assert.deepEqual(w.pending.map((t) => t.ticket), [b.ticket], 'the other jobs ticket is still open')
  assert.equal(rec(w).steps.filter((x) => x.status === 'done').length, 1)
})

// spec: design §18 "if a hand wrote outside runs/<run>/, then the jail is wrong; the run stops (exit 12) and mail goes out" · I-03 · exit 12
// class: M1 a sandbox-exec denial / a jail that is wrong · L5 the record (kick row, contract exit, letter)
// technique: fault injection: the hands answer `rule: touched-outside`
// method: read the three records the invariant names: the contract (exit 12, fail, failed), the kick row (touchedOutside),
//         the letter to Claude (severity wrong, the run's key, the ticket as evidence); the worker is retired and the reply says why
// sre: if a jailed child writes outside its run, does the foreman stop the run and tell someone, in the record?
test('a hand that wrote outside its touches stops the run with exit 12, a kick row and one letter', () => {
  const { h, s } = makeSup()
  const w = fileRun(s, { key: 'jail', goal: 'g' })
  const i = ask(s, w, 'files', [{ path: 'x' }])
  const r = result(s, w.id, 'hand', { ticket: i.ticket, op: 'files', exit: 12, rule: 'touched-outside', why: 'wrote ~/elsewhere' })
  assert.deepEqual([r.ok, r.exit], [false, 12]); assert.match(r.why, /wrote outside touches/)
  assert.deepEqual([w.contract.exit, w.contract.outcome, w.contract.state, w.state], [12, 'fail', 'failed', 'retired'])
  assert.deepEqual(rec(w).kicks.at(-1).evidence, { ticket: i.ticket, touchedOutside: true, why: 'wrote ~/elsewhere', now: h.now() })
  assert.equal(h.letters.length, 1)
  const m = h.letters[0]
  assert.deepEqual([m.severity, m.run, m.evidence.ticket, m.kind, m.to], ['wrong', 'jail', i.ticket, 'self-report', 'claude'])
  assert.match(m.what, /outside the run's touches: wrote ~\/elsewhere/)
  const w2 = fileRun(s, { key: 'jail2', goal: 'g' })
  result(s, w2.id, 'hand', { ticket: 'unknown', rule: 'touched-outside' })
  assert.deepEqual([w2.contract.exit, h.letters.at(-1).evidence.ticket, rec(w2).kicks.at(-1).evidence.why], [12, null, ''])
  assert.match(h.letters.at(-1).what, /touches: $/)
})

// spec: law 3 · law 4 (acts are press-gated) · §18 "if an act ran, then a press ticket preceded it, and the audit row names decided_by"
// class: L3 an act without a press · L6 the audit row names `decided_by`
// technique: state-machine walk over a press ticket: unpressed → checked → pressed by the owner → checked → pressed again
// method: the act goes up unpressed (no `pressed` field); pressCheck answers false until a press, then true with `by`;
//         the press names its presser (cut to 40 chars) and the run; a second press changes the presser, never re-sends;
//         a press on a hand ticket or no ticket is refused
// sre: if the hands ask "may I run this act?", is the answer the owner's recorded word, never a default yes?
test('an act goes up unpressed; pressCheck says no until a press names who decided; a hand ticket cannot be pressed', () => {
  const { h, s } = makeSup()
  const w = fileRun(s, { key: 'pr', goal: 'g', tier: 'act', hands: ['jobs'], acts: ['release'] })
  const i = ask(s, w, 'release', ['1.2.4'])
  assert.equal(h.up.at(-1).data.pressed, undefined)
  assert.deepEqual(pressCheck(s, i.ticket), { ok: true, pressed: false, by: null, run: w.id, op: 'release', args: ['1.2.4'], kind: 'act' })
  const p = press(s, i.ticket, 'o'.repeat(60))
  assert.deepEqual(p, { ok: true, run: w.id, op: 'release' })
  assert.equal(pressCheck(s, i.ticket).by.length, 40)
  assert.equal(press(s, i.ticket).ok, true); assert.equal(pressCheck(s, i.ticket).by, 'owner', 'the default presser is the owner')
  assert.equal(h.up.filter((u) => u.kind === 'act').length, 1, 'a press on a ticket still in flight never re-sends it')
  const hand = ask(s, w, 'jobs')
  assert.deepEqual(press(s, hand.ticket), { ok: false, why: `no act ticket ${hand.ticket}` })
  assert.deepEqual(pressCheck(s, hand.ticket), { ok: false, pressed: false, why: `no act ticket ${hand.ticket}` })
})

// spec: design §16 F-08 "the act waits on the owner's press; no deadline by design" · §8 "an issued act ticket is never reissued"
// class: L3 an act without a press · E8 a deadline passed (none on a person) · J13 a per-op deadline from the header
// technique: state-machine walk: act → waiting → (24 h) → pressed → re-sent under the same ticket with the per-op deadline
// method: the pressed act goes up again with the same ticket, `pressed: true`, `pressed_by`, its n and the run's key; its
//         deadline is the header's per-op span when one is set, else the act span; a run not waiting-owner keeps its state
// sre: if the owner presses a day later, does exactly the act he saw run, once, with a fresh clock?
test('a waiting act pressed a day later goes up once more under the same ticket, with the per-op deadline and the presser', () => {
  const { h, s } = makeSup()
  const w = fileRun(s, { key: 'late', goal: 'g', tier: 'act', acts: ['bundle', 'merge'] })
  s.alive.acts.bundle = 77
  const i = ask(s, w, 'bundle', ['world'])
  result(s, w.id, 'act', { ticket: i.ticket, op: 'bundle', exit: null, waiting: "the owner's press" })
  h.tick(86_400); s.sweep(); assert.equal(w.state, 'running')
  press(s, i.ticket, 'alfred')
  const up = h.up.filter((u) => u.kind === 'act').at(-1).data
  assert.deepEqual([up.ticket, up.pressed, up.pressed_by, up.n, up.run], [i.ticket, true, 'alfred', 1, 'late'])
  assert.equal(w.pending[0].deadline_at - h.now(), 77); assert.equal(w.pending[0].waiting, undefined)
  const j = ask(s, w, 'merge')
  result(s, w.id, 'act', { ticket: j.ticket, op: 'merge', exit: null, waiting: 'press' })
  w.contract.state = 'running'
  press(s, j.ticket)
  assert.equal(w.pending.find((t) => t.ticket === j.ticket).deadline_at - h.now(), s.alive.act)
  assert.equal(w.contract.state, 'running')
  const orphan = { id: 'w-x', pending: [{ ticket: 't-x', kind: 'press', op: 'merge', args: [] }] }
  s.workers.set('w-x', { ...orphan, state: 'running' })
  assert.equal(press(s, 't-x').ok, true, 'a press ticket on a worker that is not a run still goes up')
  assert.equal(h.up.at(-1).data.run, undefined)
})

// spec: §21 T7 standing press ("the filing cart's header says so, recorded on each ticket") · law 4 · §18 decided_by
// class: L6 the audit row names `decided_by` · L3 an act without a press
// technique: state-machine walk: a standing-press run's act waits → pressed at once, said on the record; a second waiting
//            reply on the same, already-pressed ticket holds the run instead of pressing twice
// method: read the presser (`standing:<filer>`, or `standing:cart` when the filer is unknown), the step row, and the
//         run's state when the hands still say waiting after the standing press
// sre: if a cart's standing press covers its acts, is every one still recorded with who decided, and never pressed twice?
test('a standing press is recorded per ticket with its filer; a waiting reply after it holds the run for the owner', () => {
  const { h, s } = makeSup()
  const w = fileRun(s, { key: 'st', goal: 'g', tier: 'act', acts: ['patch'], press: 'standing', drive: false })
  delete w.by
  const i = ask(s, w, 'patch', [{ diff: 'x' }])
  const r = result(s, w.id, 'act', { ticket: i.ticket, op: 'patch', exit: null, waiting: 'press' })
  assert.equal(r.pressed, 'standing'); assert.equal(w.pending[0].pressed.by, 'standing:cart')
  // the hands answer waiting again on the re-sent, already-pressed ticket (a press-check race)
  const r2 = result(s, w.id, 'act', { ticket: i.ticket, op: 'patch', exit: null, waiting: 'press' })
  assert.equal(r2.waiting, true); assert.equal(w.contract.state, 'waiting-owner')
  assert.equal(h.up.filter((u) => u.kind === 'act').length, 2, 'the standing press sent it once; the second waiting sent nothing')
})

// spec: design §6 change 2 (positional results; "a result is addressed by position, never pasted back") · eng §3.5 RESULTS_KEPT 32
// class: B1 every *_KEPT bound holds under 10× its size · J16 an array that grows without a bound
// technique: flood: 320 hops' results on one run (the cap lifted by hand, the bound is the subject)
// method: the run keeps the last 32 results; resultText finds a kept n and refuses a forgotten one; resultsOf gives
//         positions and tools only, never the value
// sre: if a long run answers hundreds of reads, does the foreman hold 32 of them and the window only their positions?
test('a run keeps its last 32 results; resultText reads a kept position and refuses a forgotten one; the window gets no values', () => {
  const { s } = makeSup()
  const w = fileRun(s, { key: 'many', goal: 'g' })
  w.run.cap = Infinity
  for (let k = 1; k <= 10 * RESULTS_KEPT; k++) { const i = ask(s, w, 'jobs', [k]); result(s, w.id, 'hand', { ticket: i.ticket, op: 'jobs', exit: 0, k }) }
  assert.equal(w.run.results.length, RESULTS_KEPT); assert.equal(w.run.results[0].n, 10 * RESULTS_KEPT - RESULTS_KEPT + 1)
  assert.equal(resultText(w, 320).value.k, 320); assert.equal(resultText(w, '300').ok, true)
  assert.deepEqual(resultText(w, 1), { ok: false, why: 'no result 1' })
  assert.ok(resultsOf(w).every((r) => Object.keys(r).join() === 'n,tool,ticket,at'))
  assert.deepEqual([resultsOf({}), resultText({}, 1).ok], [[], false])
})

// spec: design §6 change 2 (f) (a re-sent ticket answers under its old id) · alive.mjs `was` · eng §3.4 step 5
// class: E10 a duplicate message (the first try answers late) · E9 a message lost (the re-send)
// technique: time travel past the hand deadline with `idem #t`; the first try's ticket answers after the re-send
// method: the reply under the old ticket closes the re-sent ticket, lands at the intent's position, and the done step
//         names the ticket that was open
// sre: if a slow read answers just after its retry went out, does the run take that answer once, at the right position?
test('a reply under the ticket a re-send replaced closes the re-sent ticket at the same position', () => {
  const { h, s } = makeSup()
  const w = fileRun(s, { key: 'idem', goal: 'g' })
  const i = ask(s, w, 'jobs', [], { idem: true })
  h.tick(DEADLINES.hand + 1); s.sweep()
  const t = w.pending[0]; assert.equal(t.tries, 2); assert.deepEqual(t.was, [i.ticket])
  const r = result(s, w.id, 'hand', { ticket: i.ticket, op: 'jobs', exit: 0 })
  assert.deepEqual([r.ok, r.n, r.waiting], [true, 1, false])
  assert.equal(w.pending.length, 0); assert.equal(rec(w).steps.at(-1).ticket, t.ticket)
})

// spec: design §6 change 4 (a run that ended takes no reply) · eng §3.4 step 7
// class: E11 an orphan (a reply for a run that ended) · E9 a message lost
// technique: state-machine walk: no run; a plain worker; a run retired; a reply with no value; a reply of a kind no ticket closes
// method: the orphan replies are refused with the supervisor's sentence and leave no row; a reply naming no ticket lands
//         at the current position with no done step; a kind that closes no ticket leaves the ticket open and says waiting
// sre: if the hands answer a run that already ended, does the reply die quietly instead of writing to a closed record?
test('a reply for no run or an ended run writes nothing; a reply that closes no ticket lands without a done step', () => {
  const { s } = makeSup()
  assert.deepEqual(result(s, 'w-none', 'hand', {}), { ok: false, why: 'no such run' })
  const w = fileRun(s, { key: 'end', goal: 'g' })
  const i = ask(s, w, 'jobs')
  s.stop(w.id, 'stopped by the owner')
  const r = result(s, w.id, 'hand', { ticket: i.ticket, op: 'jobs', exit: 0 })
  assert.equal(r.ok, false); assert.match(r.why, /retired/); assert.equal(w.run.results.length, 0)
  const v = fileRun(s, { key: 'v', goal: 'g' })
  const j = ask(s, v, 'jobs')
  const nil = result(s, v.id, 'hand', null)
  assert.deepEqual([nil.ok, nil.n, nil.ticket], [true, 1, '']); assert.equal(v.pending.length, 0, 'the oldest jobs ticket closed by kind')
  assert.equal(rec(v).steps.filter((x) => x.status === 'done').length, 0, 'no ticket was named: no done step')
  const k = ask(s, v, 'disk')
  const kick = result(s, v.id, 'kick', { ticket: k.ticket, op: 'disk' })
  assert.deepEqual([kick.ok, kick.waiting], [true, true]); assert.equal(v.pending[0].ticket, k.ticket)
  assert.equal(j.ok, true)
})

// spec: law 6 "a claim is not a record" · design §9 "a said message for a desk-turn promise" is watched by the kick rule · §16 F-03
// class: L4 a claim in `said` · L1 `pass` without a form
// technique: table over prose: a promise phrase, a done claim, plain prose, an explicit promise; a run waiting on its brain
// method: each said is counted, never executed (no upstream hand); a promise phrase or a done claim opens a promise with
//         no ticket (the kick rule's input); plain prose opens none; the claim is kept for the done-check and writes no
//         outcome; the brain's wait is re-armed from now
// sre: if the brain says "I'll restart it" and does nothing, is that on the record as an open promise the kick rule chases?
test('said is counted and never run; a promise phrase or a done claim opens a ticketless promise; plain prose does not', () => {
  const { h, s } = makeSup()
  const w = fileRun(s, { key: 'talk', goal: 'g' })
  for (const [text, opens] of [["I'll restart the api", true], ['let me check', true], ['NEXT I read the disk', true], ['the disk is fine', false], ['going to look', true]]) {
    const before = w.contract.promises.length
    said(s, w.id, text)
    assert.equal(w.contract.promises.length - before, opens ? 1 : 0, text)
  }
  said(s, w.id, 'x'.repeat(300), { claimsDone: true })
  assert.equal(w.run.claimed.length, 240); assert.equal(w.contract.promises.at(-1).ticket, null)
  said(s, w.id, 'plain words', { promise: 'restart within a minute' })
  assert.equal(w.contract.promises.at(-1).text, 'restart within a minute')
  assert.equal(w.run.saids, 7); assert.equal(w.contract.outcome, null); assert.equal(h.up.filter((u) => u.kind === 'hand').length, 0)
  h.tick(30); said(s, w.id, 'still here'); assert.equal(w.awaiting.since, h.now(), 'the wait on the brain starts again')
  const i = ask(s, w, 'jobs'); assert.equal(w.awaiting, undefined)
  said(s, w.id, 'waiting for jobs'); assert.equal(w.awaiting, undefined, 'a run waiting on a hand is not put back on its brain')
  assert.deepEqual(said(s, 'w-none', 'x'), { ok: false, why: 'no such run' })
  assert.equal(i.ok, true)
})

// spec: design §8 "done only after the foreman's own done-check" · §17 exit 0 · eng §3.4 step 6 · law 6
// class: L1 `pass` without a form · E6 an infinite loop (a done-check that never ends)
// technique: table over done-check forms: held, false, throws, an endless loop (fuel), null, words, none; over `pass` true/false
// method: read finishRun's outcome, the contract's exit/state, and the stop sentence; a loop in the check is stopped by fuel
//         and judged fail; a caller's `pass: false` on a form that holds is still pass (the form decides); the why joins
// sre: if a cart writes a done-check that loops forever, does the foreman still end the run, with fail, in bounded time?
test('finishRun: the form decides pass or fail, an endless check is stopped by fuel, words and no form are stopped, never pass', () => {
  const { s } = makeSup()
  const end = (doneCheck, pass, extra = {}) => {
    const w = fileRun(s, { key: `f-${Math.random()}`, goal: 'g', doneCheck, hands: ['jobs'] })
    const i = ask(s, w, 'jobs'); result(s, w.id, 'hand', { ticket: i.ticket, op: 'jobs', exit: 0, rows: [1, 2, 3] })
    const f = finishRun(s, w.id, { pass, ...extra })
    return [f.outcome, w.contract.exit, w.contract.state, w.last]
  }
  const t0 = performance.now()
  const loop = end('(let loop ((i 0)) (loop (+ i 1)))', true)
  assert.ok(performance.now() - t0 < 2000)
  assert.deepEqual(loop.slice(0, 3), ['fail', 0, 'failed']); assert.match(loop[3], /done-check: .*could not be judged/)
  assert.deepEqual(end("(= (length (get jobs 'rows)) 3)", false).slice(0, 3), ['pass', 0, 'done'])
  assert.match(end("(= (length (get jobs 'rows)) 3)", true, { why: '3 rows' })[3], /^done: the done-check passed — 3 rows$/)
  assert.match(end('(= 1 2)', false)[3], /^done: the done-check failed$/)
  assert.match(end('(= 1 2)', true, { why: 'trust me' })[3], /trust me — done-check: \(= 1 2\) answered false/)
  assert.deepEqual(end('null', true).slice(0, 2), ['stopped', 0], 'a bare word is not a form')
  assert.deepEqual(end('(begin null)', true).slice(0, 2), ['fail', 0], 'a form that answers null failed')
  assert.match(end('', false)[3], /^done: the run failed \(no done-check\)$/)
  assert.match(end('', true)[3], /^done: the run ended \(no done-check\)$/)
  assert.deepEqual(finishRun(s, 'w-none', { pass: true }), { ok: false, why: 'no such run' })
})

// spec: design §8 / law 6 ("each tool's last result bound by its name … `(get jobs 'rows)`, `results`, `answer`, `hops`")
// class: L1 `pass` without a form · J7 hostile input (a tool name that is not a symbol)
// technique: table over the check's environment: get with a symbol, a string and a default; take; results; answer; hops;
//            a tool name with characters a symbol cannot hold
// method: evaluate doneCheck directly on a run with three results; read pass/checked/why for each form
// sre: if a cart's check asks for a field that is not there, does it fail with a sentence instead of passing by accident?
test('doneCheck binds each tool\'s last result, results, answer and hops; get and take never throw on missing data', () => {
  const { s } = makeSup()
  const w = fileRun(s, { key: 'dc', goal: 'g', hands: ['jobs', 'git-log', 'tail-log'] })
  for (const [tool, value] of [['jobs', { rows: [1, 2] }], ['jobs', { rows: [1, 2, 3] }], ['git-log', { n: 5 }]]) {
    const i = ask(s, w, tool); result(s, w.id, 'hand', { ticket: i.ticket, op: tool, exit: 0, ...value })
  }
  w.run.results.push({ n: 9, tool: 'odd tool!', value: { ok: 1 }, ticket: 't', at: 0 })
  const check = (form, answer) => { w.contract.done_check = form; return doneCheck(w, answer) }
  assert.equal(check("(= (length (get jobs 'rows)) 3)").pass, true, 'the last jobs result')
  assert.equal(check('(= (get git-log "n") 5)').pass, true)
  assert.equal(check("(get jobs 'missing 'dflt)").pass, true); assert.equal(check("(get jobs 'missing)").pass, false)
  assert.equal(check("(get 5 'rows)").pass, false); assert.equal(check("(get (list 1 (list 'a)) 'a)").pass, false)
  assert.equal(check("(= (length (take (get jobs 'rows) 2)) 2)").pass, true); assert.equal(check("(null? (take 5 2))").pass, true)
  assert.equal(check("(null? (take (get jobs 'rows) 'x))").pass, true)
  assert.equal(check('(= (length results) 4)').pass, true); assert.equal(check('(= hops 3)').pass, true)
  assert.equal(check('(get odd-tool- (quote ok))').pass, true, 'a name a symbol cannot hold is bound with dashes')
  assert.equal(check('(string=? answer "done")', 'done').pass, true); assert.equal(check('(eq? answer #f)').checked, true)
  const f = check('(car (list))'); assert.deepEqual([f.pass, f.checked], [false, true]); assert.match(f.why, /could not be judged/)
  assert.deepEqual(doneCheck({}), { pass: false, checked: false, why: 'no done-check' })
  assert.deepEqual(doneCheck({ contract: { done_check: 'it works' } }), { pass: false, checked: false, why: 'the done-check is words, not a form: nothing was checked' })
  assert.deepEqual(doneCheck({ contract: { done_check: '(= hops 0)' } }).pass, true, 'a run with no results: hops 0')
})

// spec: design §8 / §17 "`pass` is never written without a form that held" · law 6 · I-x (the ledger)
// class: L1 `pass` without a form · E10 a duplicate (a second finish)
// technique: replay: finish twice; finish after the run ended another way
// method: the second finish is refused with the first outcome named; a run stopped by a deadline cannot be finished as pass
// sre: if the brain loop retries its finish, or finishes a run the foreman already stopped, can it ever overwrite the record?
test('a run ends once: a second finish, or a finish after a deadline stop, is refused and the record keeps the first end', () => {
  const { h, s } = makeSup()
  const w = fileRun(s, { key: 'once', goal: 'g', doneCheck: '(= 1 1)' })
  assert.equal(finishRun(s, w.id, { pass: true }).outcome, 'pass')
  assert.deepEqual(finishRun(s, w.id, { pass: false }), { ok: false, why: 'the run already ended (pass)' })
  const d = fileRun(s, { key: 'dead', goal: 'g', doneCheck: '(= 1 1)' })
  ask(s, d, 'jobs'); h.tick(DEADLINES.hand + 1); s.sweep()
  assert.deepEqual([d.contract.exit, d.contract.outcome], [15, 'fail'])
  assert.deepEqual(finishRun(s, d.id, { pass: true }), { ok: false, why: 'the run already ended (fail)' })
  assert.equal(readData(JSON.stringify(1)), 1)
})

// spec: design §16 F-08 · §9 (no deadline on a person) · eng §3.3 "a second cap asks the owner"
// class: E7 a zombie (held for a person: nothing must stall it) · L3 an act without a press
// technique: state-machine walk: holdForOwner on a run with an act, a hand and no reason; on no run
// method: every act becomes a press with no deadline and the reason (default "the owner"); a hand keeps its deadline;
//         the contract is waiting-owner and the run no longer waits on its brain
// sre: if a run waits on the owner over a weekend, is it held (not stalled, not killed) and does it say why?
test('holdForOwner turns every act into a press with no deadline and says why; hands keep their deadlines', () => {
  const { s } = makeSup()
  const w = fileRun(s, { key: 'hold', goal: 'g', tier: 'act', hands: ['jobs'], acts: ['merge'] })
  ask(s, w, 'merge'); ask(s, w, 'jobs')
  assert.deepEqual(holdForOwner(s, w.id), { ok: true })
  const [a, hd] = w.pending
  assert.deepEqual([a.kind, a.deadline_at, a.waiting], ['press', null, 'the owner'])
  assert.equal(hd.kind, 'hand'); assert.ok(hd.deadline_at > 0)
  assert.equal(w.contract.state, 'waiting-owner'); assert.equal(w.awaiting, undefined)
  assert.deepEqual(holdForOwner(s, 'w-none', 'x'), { ok: false, why: 'no such run' })
})

// spec: design §8 "On foreman restart: resume from checkpoint; an issued act ticket is never reissued" · K3 · law 4
// class: E12 the supervisor itself dies (kill -9; resume from the record; what is lost)
// technique: a host that captures every checkpoint as JSON (what a kill -9 leaves on disk)
// method: after an act intent and its waiting reply, the last checkpoint holds the run's contract, its header as lists,
//         and the act ticket as a press with `once` — the facts a restart needs so the act is never asked twice
// sre: if the foreman is killed between an act's ask and the owner's press, does the record on disk keep the act unsent-twice?
test('the checkpoint a kill -9 leaves holds the run, its contract and the act ticket marked once, as JSON', () => {
  const saved = []
  const { h, s } = makeSup(); h.checkpoint = (id, d) => saved.push(JSON.parse(JSON.stringify(d)))
  const w = fileRun(s, { key: 'ck', goal: 'g', tier: 'act', acts: ['release'] })
  const i = ask(s, w, 'release', ['1.2'])
  result(s, w.id, 'act', { ticket: i.ticket, op: 'release', exit: null, waiting: 'press' })
  const ck = saved.filter((d) => d.id === w.id).at(-1)
  assert.deepEqual(ck.pending.map((t) => [t.ticket, t.kind, t.once, t.n]), [[i.ticket, 'press', true, 1]])
  assert.deepEqual([ck.run.key, ck.run.acts, ck.run.hops, ck.contract.steps.length], ['ck', ['release'], 1, 1])
})

// spec: design §8 "On foreman restart: resume from checkpoint" · law 4 (press-gated) · eng §3.4 step 5
// class: E16 a stale checkpoint older than the record (a worker record with no pending list) · J2 an uncaught exception
// technique: fault injection on the worker's state: the pending list removed from a living run and a living plain worker
// method: result, press, pressCheck and holdForOwner each answer with "no ticket" (or land the reply with no done step)
//         and never throw; the supervisor always sets the list, so this holds the guards a hand-built record relies on
// sre: if a worker comes back from an old checkpoint without its ticket list, does the door still answer instead of crashing?
test('a worker record with no pending list answers every press and reply without a throw', () => {
  const { s } = makeSup()
  const w = fileRun(s, { key: 'np', goal: 'g', tier: 'act', acts: ['merge'] })
  const plain = s.spawn({ name: 'plain', program: "(on 'hand (lambda (r) #t))" })
  delete w.pending; delete plain.pending
  assert.deepEqual(press(s, 't-1'), { ok: false, why: 'no act ticket t-1' })
  assert.deepEqual(pressCheck(s, 't-1'), { ok: false, pressed: false, why: 'no act ticket t-1' })
  assert.deepEqual(holdForOwner(s, w.id, 'x'), { ok: true })
  // SENTRY-2.0 §4 (K1): a reply that names a ticket nobody holds is a broken call link: refused red, never landed, never a throw
  const r = result(s, w.id, 'act', { ticket: 't-1', op: 'merge', exit: 0 })
  assert.deepEqual([r.ok, r.exit, r.check], [false, 12, 'no-ticket']); assert.equal(rec(w).steps.filter((x) => x.status === 'done').length, 0)
  const again = result(s, w.id, 'act', { ticket: 't-2', op: 'merge', exit: 0 })
  assert.deepEqual([again.ok, again.check], [false, 'no-ticket'])
  assert.equal(w.run.results.length, 0, 'nothing landed')
})

// spec: design §9 "Promises match tickets by id, never by words" · §18 "if a promise is open past its deadline, then a kick was sent"
// class: L5 the record's shape (the promise's state on the file) · E10 a duplicate (the promise kept once)
// technique: state-machine walk over one promise: made with the intent, kept by its ticket's reply
// method: the intent's promise is open with the intent's ticket; the reply closes the ticket and marks the promise kept
//         on the rendered contract, so the kick rule never chases it
// sre: if the brain promised a read and the read answered, is the promise kept on the record, so no false kick follows?
test('a promise made with an intent is kept by that intent\'s reply, on the file', () => {
  const { s } = makeSup()
  const w = fileRun(s, { key: 'pk', goal: 'g' })
  const i = ask(s, w, 'jobs', [], { promise: 'count the jobs', deadline: 5 })
  assert.deepEqual([rec(w).promises[0].state, w.contract.promises[0].ticket, w.contract.promises[0].deadline_at - w.contract.promises[0].made_at], ['open', i.ticket, 5])
  result(s, w.id, 'hand', { ticket: i.ticket, op: 'jobs', exit: 0 })
  assert.deepEqual(rec(w).promises[0], { id: i.promise, text: 'count the jobs', state: 'kept' })
})

