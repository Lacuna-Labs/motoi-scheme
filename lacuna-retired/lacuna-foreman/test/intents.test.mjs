// intents.test.mjs — THE INTENT DOOR, THE FIRST TESTS (lane U2; K2 of the build). Owns: the unit tests of the intent
// door's main road: a run is a worker; an intent is a ticket checked against the header; results are positional; a shell
// on a desk run and a tool outside the header are refused with F-02; an act is never re-sent (F-21); the deadline ends
// the run with exit 15; the done-check alone writes pass. The refusals' edges live in intents-door.test.mjs, the replies,
// presses and ends in intents-result.test.mjs. Refuses: a mock of intents.mjs or the supervisor.
// Implements: design §6 changes 1–2, §7.1–7.3, §8, §12.3, §17, §21 (ReAct cap, T7); laws 3 · 4 · 6; engineering §3.3–§3.5.
// Invariants (§18): "if an act ran, then a press ticket preceded it"; "if a step is done, then a ticket closed it".
// Faults (§16): F-01, F-02, F-03, F-06, F-08, F-21.
// coverage: intents.mjs — lines 100% branches 99.06% functions 100% (2026-10-24, lane U2 files; :169 :179 :183 named test.todo in intents-result)
import test from 'node:test'
import assert from 'node:assert/strict'
import { Supervisor } from '../supervisor.mjs'
import { fileRun, intent, result, said, finishRun, resultsOf, holdForOwner, resultText, press, pressCheck } from '../intents.mjs'
import { readContract, renderContract } from '../contract.mjs'

const DEADLINES = { hand: 10, act: 40, beat: 5, mind: 20, hop: 50 }
function host() {
  let t = 1000, n = 0
  const up = [], texts = []
  return { up, texts, tick: (s) => { t += s }, deadlines: DEADLINES, now: () => t, id: () => `w${++n}`, save: () => {},
           upstream: (kind, w, data) => up.push({ kind, name: w.name, data }), contract: (w, text) => texts.push(text) }
}

// spec: design §6 change 2 (b) · §12.3 (desk: reads only, no shell) · F-02 · exit 12
// class: L3 an act without a press (a shell on a desk run)
// technique: state walk filed → running with one refusal of each kind, then one accepted hand
// method: read the faults, the ticket's span (the hand deadline), the upstream hand with n and run, the contract state
// sre: if the brain asks a desk turn for a shell, is it refused while its reads still run?
test('a desk run reads only: a hand in the header is a ticket; a shell is F-02; a tool outside the header is F-02', () => {
  const h = host(); const s = new Supervisor(h)
  const w = fileRun(s, { key: 'r-1', goal: 'how many jobs run', doneCheck: '(number? jobs)' })
  assert.equal(w.state, 'running'); assert.equal(w.contract.state, 'filed'); assert.ok(w.awaiting)
  assert.equal(intent(s, w.id, { tool: 'shell', args: ['ls'] }).fault, 'F-02')
  assert.equal(intent(s, w.id, { tool: 'release-now' }).fault, 'F-02')
  const r = intent(s, w.id, { tool: 'jobs', args: ['all'] })
  assert.deepEqual([r.ok, r.kind, r.n], [true, 'hand', 1])
  assert.equal(w.pending.length, 1); assert.equal(w.pending[0].deadline_at - w.pending[0].sent_at, DEADLINES.hand)
  assert.equal(w.awaiting, undefined)
  assert.equal(h.up.at(-1).kind, 'hand'); assert.equal(h.up.at(-1).data.n, 1); assert.equal(h.up.at(-1).data.run, 'r-1')
  assert.equal(w.contract.state, 'running')
})

// spec: design §6 change 2 (positional results) · §18 "if a step is done, then a ticket closed it"
// class: L2 a step `done` from a report line · E10 replies out of order
// technique: replies in reverse order of the intents
// method: each lands at its own n; the window gets positions only; the file shows two done rows, each with its ticket
// sre: if the hands answer out of order, does each answer land where the brain asked for it?
test('a result lands by position; the step is done by its ticket; the run waits on its brain again', () => {
  const h = host(); const s = new Supervisor(h)
  const w = fileRun(s, { key: 'r-2', goal: 'g' })
  const a = intent(s, w.id, { tool: 'jobs' })
  const b = intent(s, w.id, { tool: 'disk' })
  const rb = result(s, w.id, 'hand', { ticket: b.ticket, op: 'disk', ok: true, free_gb: 22 })
  assert.deepEqual([rb.ok, rb.n], [true, 2])
  const ra = result(s, w.id, 'hand', { ticket: a.ticket, op: 'jobs', ok: true, rows: 3 })
  assert.equal(ra.n, 1)
  assert.deepEqual(resultsOf(w).map((r) => [r.n, r.tool]), [[2, 'disk'], [1, 'jobs']])
  assert.ok(!('value' in resultsOf(w)[0]), 'the window gets positions, never the text')
  const c = readContract(renderContract(w.contract))
  assert.equal(c.steps.filter((x) => x.status === 'done').length, 2)
  assert.ok(c.steps.filter((x) => x.status === 'done').every((x) => x.ticket))
  assert.equal(w.pending.length, 0); assert.ok(w.awaiting)
})

// spec: law 4 (acts never re-sent) · design §16 F-21, F-02 · §17 exit 15
// class: E10 a duplicate (an act re-sent) · E8 a deadline passed
// technique: time travel past the act deadline
// method: a watch run's act is F-02; a second identical act is F-21; past the deadline the act is not re-sent and the run ends 15 fail
// sre: if an act's reply is lost, does the box decline to run it again on its own?
test('an act needs the act tier and the header; it is never re-sent; a second identical act is F-21', () => {
  const h = host(); const s = new Supervisor(h)
  const watch = fileRun(s, { key: 'r-3', goal: 'g', acts: ['restart-api'] })
  assert.equal(intent(s, watch.id, { tool: 'restart-api' }).fault, 'F-02')
  const w = fileRun(s, { key: 'r-4', goal: 'g', tier: 'act', hands: ['jobs'], acts: ['restart-api'] })
  const r = intent(s, w.id, { tool: 'restart-api', args: ['dev'] })
  assert.equal(r.kind, 'act'); assert.equal(w.pending[0].once, true)
  assert.equal(intent(s, w.id, { tool: 'restart-api', args: ['dev'] }).fault, 'F-21')
  h.tick(DEADLINES.act + 1); s.sweep()
  assert.equal(h.up.filter((u) => u.kind === 'act').length, 1, 'not re-sent')
  assert.equal(w.state, 'retired'); assert.match(w.last, /never answered/)
  assert.deepEqual([w.contract.exit, w.contract.outcome], [15, 'fail'])
})

// spec: design §6 change 2 (f) re-send only with (idem #t) · §17 exit 15
// class: E8 a deadline passed · E9 a message lost
// technique: time travel over three runs: idem no, default, idem yes
// method: the first two end exit 15 at the first deadline; idem #t is re-sent once (tries 2), then ends 15
// sre: if a read is lost, is it asked again only when the brain said it is safe to ask twice?
test('idem: a late hand is re-sent once only when the intent says (idem #t); idem no and the default are never re-sent (§6 change 2f)', () => {
  const h = host(); const s = new Supervisor(h)
  const a = fileRun(s, { key: 'r-5', goal: 'g' }); intent(s, a.id, { tool: 'jobs', idem: false })
  const d = fileRun(s, { key: 'r-5d', goal: 'g' }); intent(s, d.id, { tool: 'jobs' })
  const b = fileRun(s, { key: 'r-6', goal: 'g' }); intent(s, b.id, { tool: 'jobs', idem: true })
  h.tick(DEADLINES.hand + 1); s.sweep()
  assert.equal(a.state, 'retired'); assert.equal(a.contract.exit, 15)
  assert.equal(d.state, 'retired'); assert.equal(d.contract.exit, 15, 'the default is once (corrected 2026-10-23)')
  assert.equal(b.state, 'running'); assert.equal(b.pending[0].tries, 2)
  h.tick(DEADLINES.hand + 1); s.sweep()
  assert.equal(b.contract.exit, 15)
})

// spec: law 6 (a claim is not a record) · design §9 (said)
// class: L4 a claim in `said` · L1 `pass` without a form
// technique: a done claim, then finish with pass on a run with no done-check form
// method: the claim is kept, no outcome is written, nothing goes upstream; finish writes stopped (never pass); a second finish is refused
// sre: if the brain says it is done, does the ledger still say only what a form checked?
test('prose is said, counted, never run; a done claim is a claim; only finishRun writes pass', () => {
  const h = host(); const s = new Supervisor(h)
  const w = fileRun(s, { key: 'r-7', goal: 'g' })
  assert.equal(said(s, w.id, 'I will now list the jobs').saids, 1)
  said(s, w.id, '(done "all jobs listed")', { claimsDone: true })
  assert.equal(w.run.claimed, '(done "all jobs listed")'); assert.equal(w.contract.outcome, null)
  assert.equal(h.up.filter((u) => u.kind === 'hand').length, 0)
  const f = finishRun(s, w.id, { pass: true, why: '3 jobs' })
  assert.deepEqual([f.ok, f.outcome], [true, 'stopped'], 'law 6: no done-check form, so nothing was checked — a clean end is stopped, never pass')
  assert.equal(w.state, 'retired'); assert.deepEqual([w.contract.exit, w.contract.state], [0, 'done'])
  assert.equal(finishRun(s, w.id, { pass: false }).ok, false)
})

// spec: design §16 F-08 (no deadline on a person) · §9
// class: E7 a zombie (the zombie law must stay off a held run)
// technique: time travel an hour past a held act
// method: the act is a press with no deadline; the contract is waiting-owner; the sweep leaves the run running
// sre: if the owner takes an hour to press, is the run still there, waiting, not stalled?
test('a press holds the run for the owner: waiting-owner, no deadline on a person, the zombie law stays off', () => {
  const h = host(); const s = new Supervisor(h)
  const w = fileRun(s, { key: 'r-8', goal: 'g', tier: 'act', acts: ['release'] })
  intent(s, w.id, { tool: 'release' })
  holdForOwner(s, w.id, 'the release card')
  assert.equal(w.contract.state, 'waiting-owner'); assert.equal(w.pending[0].kind, 'press'); assert.equal(w.pending[0].deadline_at, null)
  h.tick(3600); s.sweep()
  assert.equal(w.state, 'running')
})

// spec: eng §3.5 hop deadline · design §16 F-06 · §17 exit 99
// class: E7 a zombie · E8 a deadline passed
// technique: boundary on the hop deadline: one second inside, then past it plus the beat
// method: inside the hop the run is running; past it the run is stalled with exit 99
// sre: if the brain never sends its next intent, does the run end as stalled instead of hanging forever?
test('the run between hops is not a zombie inside its hop deadline, and is stalled past it', () => {
  const h = host(); const s = new Supervisor(h)
  const w = fileRun(s, { key: 'r-9', goal: 'g' })
  const i = intent(s, w.id, { tool: 'jobs' }); result(s, w.id, 'hand', { ticket: i.ticket, op: 'jobs', ok: true })   // one hop: the brain now owes the next
  h.tick(DEADLINES.hop - 1); s.sweep()
  assert.equal(w.state, 'running')
  h.tick(2 + DEADLINES.beat); s.sweep()
  assert.equal(w.state, 'stalled'); assert.equal(w.contract.exit, 99)
})

// spec: design §6 change 4 (filing) · §8 "key (goal hash, dedupe at filing)" · eng §3.4 step 1
// class: E10 a duplicate (a second filing under one key) · L5 the record (filed upstream)
// technique: a cart program files twice under one key
// method: one run; the header, cart, repo and touches as filed; the checkout act goes up; the filed upstream names the trigger
// sre: if a trigger fires twice, does one run do the work?
test("(file '((key …) …)) from a cart files a run once under its key; a second file returns the same run; the trigger goes up", () => {
  const h = host(); const s = new Supervisor(h)
  const cart = `(lacuna-cart 'triggers '((does . "fires") (done . "fired") (agent . ((tier . watch) (verbs . (on file report remember))))))
(on 'tick (lambda (x) (remember 'run (file '((key "ipad-verify@07:00") (cart ipad-verify) (goal "verify the iPad") (done-check "(ok? r)") (trigger t-1) (evidence "07:00") (hands (jobs devices)) (repo curator) (touches ("carts/automations/*.sks")))))))`
  const t = s.spawn({ name: 'triggers', program: cart })
  s.send(t.id, 'tick', 0)
  const run = s.workers.get(t.kv.run)
  assert.ok(run && run.run); assert.equal(run.run.key, 'ipad-verify@07:00'); assert.equal(run.contract.cart, 'ipad-verify'); assert.equal(run.parent, null, 'filed by the cart, never its child'); assert.equal(run.by, t.id)
  assert.deepEqual([...run.run.hands], ['jobs', 'devices']); assert.equal(run.restart, 'temporary'); assert.equal(run.run.repo, 'curator'); assert.deepEqual(run.run.touches, ['carts/automations/*.sks'])
  assert.equal(h.up.find((u) => u.kind === 'act' && u.data.op === 'checkout').data.args[0], 'curator')
  const up = h.up.find((u) => u.kind === 'filed'); assert.equal(up.data.trigger, 't-1'); assert.equal(up.data.key, 'ipad-verify@07:00')
  s.send(t.id, 'tick', 0)
  assert.equal(t.kv.run, run.id, 'merged on its key')
  assert.equal(s.living().filter((x) => x.run).length, 1)
})

// spec: §21 ReAct row (cap 5, ≤ 7) · eng §3.5 hop cap · F-03 · exit 12
// class: E6 an infinite loop (a brain that never finishes)
// technique: boundary: hops 9 clamps to 7; the eighth intent
// method: the cap is 7; the eighth is F-03 exit 12 with a kick and one kick row; resultText reads position 3, refuses 9
// sre: if the brain loops, does the foreman stop taking work and say so?
test('the hop cap: 5 by default, at most 7; past it no intent is taken, a kick is sent and recorded', () => {
  const h = host(); const s = new Supervisor(h)
  const w = fileRun(s, { key: 'r-cap', goal: 'g', hops: 9 })
  assert.equal(w.run.cap, 7)
  for (let i = 1; i <= 7; i++) { const r = intent(s, w.id, { tool: 'jobs' }); assert.equal(r.ok, true); result(s, w.id, 'hand', { ticket: r.ticket, op: 'jobs', ok: true, i }) }
  const r = intent(s, w.id, { tool: 'jobs' })
  assert.deepEqual([r.ok, r.fault, r.exit, r.kick], [false, 'F-03', 12, true]); assert.match(r.why, /hop cap 7 reached/)
  assert.equal(w.contract.kicks.length, 1)
  assert.equal(fileRun(s, { key: 'r-d', goal: 'g' }).run.cap, 5)
  assert.deepEqual(resultText(w, 3).value.i, 3); assert.equal(resultText(w, 9).ok, false)
})

// spec: law 4 (press-gated) · §18 "if an act ran, then a press ticket preceded it"
// class: L3 an act without a press · L6 the audit row names `decided_by`
// technique: state walk unpressed → pressed
// method: pressCheck false, then true with by, op and args; an unknown ticket is refused
// sre: if the hands ask whether an act may run, is the answer the owner's recorded press?
test('a press on an act ticket is marked and the hands can check it', () => {
  const h = host(); const s = new Supervisor(h)
  const w = fileRun(s, { key: 'r-p', goal: 'g', tier: 'act', acts: ['release'] })
  const i = intent(s, w.id, { tool: 'release', args: ['1.2.4'] })
  assert.deepEqual(pressCheck(s, i.ticket).pressed, false)
  assert.equal(press(s, i.ticket, 'owner').op, 'release')
  const c = pressCheck(s, i.ticket)
  assert.deepEqual([c.pressed, c.by, c.op, c.args], [true, 'owner', 'release', ['1.2.4']])
  assert.equal(pressCheck(s, 'nope').ok, false)
})

// spec: design §16 F-08 · §8 "an issued act ticket is never reissued" · law 4
// class: L3 an act without a press · E8 (no deadline on a person)
// technique: state walk act → press → (2 h) → pressed → answered
// method: waiting is not a result; the press re-sends the SAME ticket pressed; the answer closes it
// sre: if the owner presses late, does exactly the waiting act run, once?
test('an act the hands answer with waiting becomes a press ticket; the press sends the SAME ticket again, pressed', () => {
  const h = host(); const s = new Supervisor(h)
  const w = fileRun(s, { key: 'r-w', goal: 'g', tier: 'act', acts: ['bundle'] })
  const i = intent(s, w.id, { tool: 'bundle', args: ['world'] })
  const r = result(s, w.id, 'act', { ticket: i.ticket, op: 'bundle', exit: null, waiting: "the owner's press" })
  assert.equal(r.waiting, true); assert.equal(w.run.results.length, 0, 'waiting is not a result'); assert.equal(w.pending[0].kind, 'press'); assert.equal(w.pending[0].deadline_at, null); assert.equal(w.contract.state, 'waiting-owner')
  h.tick(7200); s.sweep(); assert.equal(w.state, 'running', 'no deadline on a person')
  const p = press(s, i.ticket, 'owner')
  assert.equal(p.op, 'bundle'); assert.equal(w.pending[0].kind, 'act'); assert.ok(w.pending[0].deadline_at > h.now())
  const up = h.up.filter((u) => u.kind === 'act'); assert.equal(up.length, 2); assert.equal(up[1].data.ticket, i.ticket); assert.equal(up[1].data.pressed, true)
  assert.equal(w.contract.state, 'running')
  const done = result(s, w.id, 'act', { ticket: i.ticket, op: 'bundle', exit: 0, status: 0, rows: { bundle: 'x' } })
  assert.equal(done.waiting, false); assert.equal(w.pending.length, 0); assert.equal(w.run.results.at(-1).value.rows.bundle, 'x')
})

// spec: law 6 · design §8 done-check · §17 exit 0 (pass, fail, stopped)
// class: L1 `pass` without a form
// technique: table over done-check forms: false, true, throws, words, false on exit 0
// method: the form decides; words are stopped; a failed check on exit 0 is state failed
// sre: if the brain claims success, does only a checked form write pass on the ledger?
test('law 6: the done-check judges the caller\'s pass over the results; no form = the caller\'s word; a form that throws = fail', () => {
  const h = host(); const s = new Supervisor(h)
  const w = fileRun(s, { key: 'r-dc', goal: 'g', doneCheck: "(> (length (get jobs 'rows)) 2)", hands: ['jobs'] })
  const i = intent(s, w.id, { tool: 'jobs' }); result(s, w.id, 'hand', { ticket: i.ticket, op: 'jobs', exit: 0, rows: [1, 2] })
  const f = finishRun(s, w.id, { pass: true, why: 'the brain says so' })
  assert.equal(f.outcome, 'fail'); assert.match(w.last, /done-check/)
  const w2 = fileRun(s, { key: 'r-dc2', goal: 'g', doneCheck: "(> (length (get jobs 'rows)) 2)", hands: ['jobs'] })
  const i2 = intent(s, w2.id, { tool: 'jobs' }); result(s, w2.id, 'hand', { ticket: i2.ticket, op: 'jobs', exit: 0, rows: [1, 2, 3] })
  assert.equal(finishRun(s, w2.id, { pass: true }).outcome, 'pass')
  const w3 = fileRun(s, { key: 'r-dc3', goal: 'g', doneCheck: '(nope)' })
  assert.equal(finishRun(s, w3.id, { pass: true }).outcome, 'fail')
  const w4 = fileRun(s, { key: 'r-dc4', goal: 'g', doneCheck: 'the owner is happy' })
  assert.equal(finishRun(s, w4.id, { pass: true }).outcome, 'stopped', 'a done-check in words checks nothing: the caller\'s word is never pass (law 6, 2026-10-23)')
  assert.deepEqual([w4.contract.exit, w4.contract.state], [0, 'done'])
  const w5 = fileRun(s, { key: 'r-dc5', goal: 'g', doneCheck: '(= 1 2)' })
  finishRun(s, w5.id, { pass: true })
  assert.deepEqual([w5.contract.exit, w5.contract.outcome, w5.contract.state], [0, 'fail', 'failed'], 'a failed check on exit 0 is state failed, not done')
})

// spec: design §8 lifecycle (checkout at filing) · §21 T7 standing press · eng §3.4 step 1
// class: L3 an act without a press (the standing press) · L6 decided_by
// technique: a filing with repo and touches by a cart; a desk filing
// method: the checkout act goes up pressed with touches; the cart-filed run is driven; the desk run is not
// sre: if a repair run is filed, is its checkout asked once, under the cart's standing press?
test('a run filed with a repo asks the hands for its checkout at once (standing press) and carries touches; a cart-filed run is driven', () => {
  const driven = []; const h = { ...host(), drive: (w) => driven.push(w.id) }; const s = new Supervisor(h)
  const w = fileRun(s, { key: 'r-co', goal: 'repair x', repo: 'curator', touches: ['carts/automations/x.sks'], by: 'w-cart', hands: ['read'] })
  const up = h.up.find((u) => u.kind === 'act'); assert.equal(up.data.op, 'checkout'); assert.deepEqual(up.data.args, ['curator']); assert.equal(up.data.pressed, true); assert.deepEqual(up.data.touches, ['carts/automations/x.sks'])
  assert.equal(w.pending[0].kind, 'act'); assert.equal(w.pending[0].once, true); assert.deepEqual(driven, [w.id])
  const d = fileRun(s, { key: 'desk:x', goal: 'g', desk: true, by: 'brain' }); assert.deepEqual(driven, [w.id], 'a desk run is not driven')
})

// spec: §21 ReAct (the repetitive-loop failure) · F-03
// class: E6 an infinite loop (the same refused read)
// technique: two refused results with the same args, then a third ask, then changed args
// method: the third is F-03 with a kick row marked repeat; changed arguments go through
// sre: if the brain asks the same broken read again and again, is it told to change course?
test('the repeat rule: the same tool and args after two refused results is kicked, not sent a third time', () => {
  const h = host(); const s = new Supervisor(h)
  const w = fileRun(s, { key: 'r-rep', goal: 'g', hands: ['cart-record'] })
  for (let k = 1; k <= 2; k++) { const i = intent(s, w.id, { tool: 'cart-record', args: [{ name: 'x y' }] }); assert.equal(i.ok, true); result(s, w.id, 'hand', { ticket: i.ticket, op: 'cart-record', exit: 12, why: 'name is a plain name' }) }
  const third = intent(s, w.id, { tool: 'cart-record', args: [{ name: 'x y' }] })
  assert.deepEqual([third.ok, third.fault, third.kick], [false, 'F-03', true]); assert.match(third.why, /refused twice/)
  assert.equal(w.contract.kicks.at(-1).category, 'no-ticket'); assert.equal(w.contract.kicks.at(-1).evidence.repeat, true)
  const changed = intent(s, w.id, { tool: 'cart-record', args: [{ name: 'xy' }] }); assert.equal(changed.ok, true, 'changed arguments go through')
})

// spec: §21 T7 · law 4 · §18 decided_by
// class: L6 the audit row names `decided_by`
// technique: an act that waits on a standing-press run
// method: pressed at once by standing:<filer>; the same ticket went up again; the step row says so
// sre: if a cart's own press covers an act, is who decided still on the record?
test('a standing press (T7): an act that waits on a run filed with (press standing) is pressed at once, said on the record', () => {
  const h = host(); const s = new Supervisor(h)
  const w = fileRun(s, { key: 'r-sp', goal: 'g', tier: 'act', acts: ['patch'], press: 'standing', by: 'w-cart' })
  const i = intent(s, w.id, { tool: 'patch', args: [{ diff: 'x' }] })
  const r = result(s, w.id, 'act', { ticket: i.ticket, op: 'patch', exit: null, waiting: "the owner's press" })
  assert.equal(r.pressed, 'standing'); assert.equal(w.pending[0].kind, 'act'); assert.equal(w.pending[0].pressed.by, 'standing:w-cart')
  assert.equal(h.up.filter((u) => u.kind === 'act' && u.data.op === 'patch').length, 2, 'the same ticket went again, pressed')
  assert.ok(w.contract.steps.some((x) => /standing press on patch/.test(x.text)))
})

// spec: eng §3.5 "filedEach 8" · design §6 (LIMITS)
// class: B7 workers 65, depth 4, children 9, filedEach 9
// technique: boundary: the eighth and the ninth filing from one cart
// method: the ninth answers #f; ending one run makes room
// sre: if a cart files runs in a loop, does the kernel cap what one filer can have in flight?
test("the kernel's ceiling on runs in flight per filer: the ninth (file …) answers #f until one ends", () => {
  const h = host(); const s = new Supervisor(h)
  const cart = `(lacuna-cart 'filer '((does . "fires") (done . "fired") (agent . ((tier . watch) (verbs . (on file remember))))))
(on 'tick (lambda (x) (remember 'last (file (list (list 'key (string-append "k@" (number->string x))) (list 'goal "g"))))))`
  const t = s.spawn({ name: 'filer', program: cart })
  for (let i = 1; i <= 8; i++) { s.send(t.id, 'tick', i); assert.equal(typeof t.kv.last, 'string') }
  s.send(t.id, 'tick', 9); assert.equal(t.kv.last, false, 'the ninth is not filed')
  const first = s.living().find((w) => w.run && w.run.key === 'k@1'); s.stop(first.id, 'done')
  s.send(t.id, 'tick', 10); assert.equal(typeof t.kv.last, 'string', 'an ended run makes room')
})

// spec: eng §3.4 step 1 (<run>, <dir>) · §21 ReAct (repeat rule)
// class: E6 an infinite loop (three refusals of one tool)
// technique: three refused reads with differently spelled args
// method: the goal names the run's dir; the fourth ask is kicked
// sre: if the brain re-spells the same broken path, is the loop still caught?
test('the goal names the run: <run> and <dir> are the id and the checkout; three refusals of one tool in a row are kicked whatever the args', () => {
  const h = host(); const s = new Supervisor(h)
  const w = fileRun(s, { key: 'r-g', goal: 'read <dir>/carts/x.sks in run <run>', repo: 'curator', hands: ['files'] })
  assert.equal(w.contract.goal, `read runs/${w.id}/curator/carts/x.sks in run ${w.id}`)
  for (const p of ['a', 'a/', 'a/*']) { const i = intent(s, w.id, { tool: 'files', args: [{ path: p }] }); result(s, w.id, 'hand', { ticket: i.ticket, op: 'files', exit: 12, why: 'does not exist' }) }
  const r = intent(s, w.id, { tool: 'files', args: [{ path: 'a//' }] })
  assert.deepEqual([r.ok, r.kick], [false, true])
})
