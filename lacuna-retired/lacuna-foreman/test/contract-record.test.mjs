// contract-record.test.mjs — THE CONTRACT AS THE RECORD (lane U2). Owns: the unit tests of contract.mjs's bounds (steps
// 200, promises 32, kicks 32), its refusals (six exits, four outcomes, `pass` only checked, a `done` step only with a
// ticket), the stop path's code table, `bound`, `readContract`'s one-sentence faults and `contractData`. Refuses: a mock
// of contract.mjs; a test that reads a field without reading the rendered record the design says must exist.
// Implements: design §8 (17 fields; the bare form, never the envelope), §17 (every exit and outcome), law 6; engineering
// §3.3 `task-state`, §3.4 (one run), §3.5 rings (steps 200 · promises 32 · kicks 32).
// Invariants (§18): "if a step is done, then a ticket closed it (never a report line)"; "if swapped-at is set, the next
// step started on the new brain from the contract". Faults (§16): F-12.
// coverage: contract.mjs — lines 100% branches 100% functions 100% (2026-10-24, lane U2 files)
import test from 'node:test'
import assert from 'node:assert/strict'
import { openContract, contractStep, contractPromise, contractResolve, contractResult, contractSwap, contractExit, contractClose,
         renderContract, readContract, contractData, bound, EXIT, EXITS, OUTCOMES, STATES, STEPS_KEPT, PROMISES_KEPT, KICKS_KEPT } from '../contract.mjs'
import { readData } from '../../../lacuna-scheme/src/slat-data.js'

const mkSup = (o = {}) => { let t = 1000; const writes = []; return { writes, tick: (s) => { t += s }, host: { now: () => t, contract: (w, text) => writes.push(text), ...o } } }
const mkRun = (o = {}) => { const w = { id: 'w-c' }; openContract(w, { key: 'k-1', goal: 'g', doneCheck: '(> jobs 0)', ...o }); return w }

// spec: design §8 steps · eng §3.5 rings "steps 200" · B10
// class: B1 every *_KEPT bound holds under 10× its size · B5 the contract at full size
// technique: flood to 10× the bound (2,000 steps), then boundary at 200 and 201
// method: write 2,000 steps; the contract keeps the last 200, numbered on (n 1,801…2,000), `step` counts all 2,000; the
//         rendered file reads back whole with the same 200 rows; at 200 nothing is cut, at 201 the oldest goes
// sre: if a run loops for an hour, does its contract stay one bounded file instead of growing until the write fails?
test('steps keep the last 200 under a 10× flood, numbered on, and the file reads back with exactly those rows', () => {
  const s = mkSup(); const w = mkRun()
  for (let i = 1; i <= STEPS_KEPT; i++) contractStep(s, w, 'running', `s${i}`)
  assert.equal(w.contract.steps.length, STEPS_KEPT); assert.equal(w.contract.steps[0].n, 1)
  contractStep(s, w, 'running', 's201')
  assert.equal(w.contract.steps.length, STEPS_KEPT); assert.equal(w.contract.steps[0].n, 2)
  for (let i = 202; i <= 10 * STEPS_KEPT; i++) contractStep(s, w, i % 2 ? 'running' : 'done', `s${i}`, i % 2 ? null : `t-${i}`)
  const r = readContract(s.writes.at(-1))
  assert.equal(r.step, 2000); assert.equal(r.steps.length, 200); assert.equal(r.steps[0].n, 1801); assert.equal(r.steps.at(-1).n, 2000)
  assert.ok(r.steps.filter((x) => x.status === 'done').every((x) => x.ticket === `t-${x.n}`))
})

// spec: design §8 promises · §9 "Promises match tickets by id, never by words" · eng §3.5 rings "promises 32"
// class: B1 every *_KEPT bound holds under 10× its size · E10 a duplicate (an identity reused)
// technique: flood to 10× the bound (320 promises); then resolve the newest by its id
// method: before the fix the id was `p-${length + 1}`, so once the ring was full every new promise was p-33 and resolving
//         p-33 kept the wrong one; now ids are unique and rising, the ring keeps 32, and the resolve lands on its own row
// sre: if a chatty desk turn makes forty promises, does the kick rule still match each ticket to the right promise?
test('promise ids stay unique past the 32-row ring, so a ticket resolves the promise it names and no other', () => {
  const s = mkSup(); const w = mkRun()
  const ids = []
  for (let i = 1; i <= 10 * PROMISES_KEPT; i++) ids.push(contractPromise(s, w, `promise ${i}`, 60))
  assert.equal(new Set(ids).size, ids.length, 'every promise has its own id')
  assert.equal(w.contract.promises.length, PROMISES_KEPT)
  assert.deepEqual(w.contract.promises.map((p) => p.id), ids.slice(-PROMISES_KEPT))
  assert.equal(contractResolve(s, w, ids.at(-1), 'kept', 't-last'), true)
  assert.deepEqual(w.contract.promises.filter((p) => p.state === 'kept').map((p) => p.text), [`promise ${10 * PROMISES_KEPT}`])
  assert.equal(contractResolve(s, w, ids[0], 'kept'), false, 'a promise the ring forgot resolves nothing')
  assert.equal(readContract(s.writes.at(-1)).promises.at(-1).state, 'kept')
})

// spec: design §8 kicks (the 17th field) · eng §3.5 rings "kicks 32" · O-80
// class: B1 every *_KEPT bound holds under 10× its size
// technique: flood the in-memory kick list to 320 rows; render
// method: the file carries the last 32 kick records, in order; the in-memory list is the caller's (intents/kick keep it bounded)
// sre: if a run is kicked all night, does the P7 gate still read a bounded kicks field on the file?
test('the file carries only the last 32 kick records, oldest first', () => {
  const w = mkRun()
  for (let i = 0; i < 10 * KICKS_KEPT; i++) w.contract.kicks.push({ verdict: 'kick', category: 'deadline', evidence: { i }, by: 'kick.mjs' })
  const r = readContract(renderContract(w.contract))
  assert.equal(r.kicks.length, KICKS_KEPT); assert.equal(r.kicks[0].evidence.i, 10 * KICKS_KEPT - KICKS_KEPT); assert.equal(r.kicks.at(-1).evidence.i, 10 * KICKS_KEPT - 1)
})

// spec: design §8 (the contract at full size) · B10 "200 steps, 32 promises, 32 kicks renders and reads back whole, < 64 KB"
// class: B5 the contract at full size · J3 the event loop blocked
// technique: the worst case every ring allows: 240-char steps with tickets, 240-char promises, 32 kicks, a 4,000-char last result
// method: render and read back; every field survives; both take < 50 ms. The worst case is ~67 KB, over B10's 64 KB (B10's
//         case is 120-char steps); no design clause states a file size, so the bound held here is the rings' own: < 80 KB
// sre: if every ring is full at once, is the contract still one small file the hands can write in one rename?
test('a contract with every ring full at its widest renders under 80 KB and reads back whole', () => {
  const s = mkSup(); const w = mkRun()
  for (let i = 0; i < STEPS_KEPT; i++) contractStep(s, w, 'done', 'x'.repeat(300), `w-c-hand-${i}`)
  for (let i = 0; i < PROMISES_KEPT; i++) contractPromise(s, w, 'p'.repeat(300), 60)
  for (let i = 0; i < KICKS_KEPT; i++) w.contract.kicks.push({ verdict: 'kick', category: 'no-ticket', evidence: { i }, by: 'intents.mjs' })
  contractResult(s, w, { tail: 'y'.repeat(10_000) })
  const t0 = performance.now()
  const text = renderContract(w.contract)
  const r = readContract(text)
  assert.ok(performance.now() - t0 < 50)
  assert.ok(text.length < 80_000, `${text.length} chars`)
  assert.equal(r.steps.length, STEPS_KEPT); assert.equal(r.steps[0].text.length, 240); assert.equal(r.promises.length, PROMISES_KEPT); assert.equal(r.kicks.length, KICKS_KEPT)
})

// spec: design §18 "if a step is done, then a ticket closed it (never a report line)" · §16 F-12 · law 6
// class: L2 a step `done` from a report line
// technique: fault injection: a done step with every falsy ticket
// method: each refusal throws the F-12 sentence; the record shows nothing: step count unchanged, no row, no file write
// sre: if a cart reports "done" in words, can it ever turn into a done row the release reads as proof?
test('a done step without a ticket is refused and leaves no trace: no row, no step number, no file written', () => {
  const s = mkSup(); const w = mkRun()
  for (const t of [null, undefined, '', 0]) assert.throws(() => contractStep(s, w, 'done', 'report: all jobs listed', t), /F-12/)
  assert.deepEqual([w.contract.step, w.contract.steps.length, s.writes.length, w.contract.state], [0, 0, 0, 'filed'])
  assert.equal(contractStep(s, w, 'failed', 'a failed step needs no ticket'), 1)
  assert.equal(contractStep(s, w, 'skipped', 'nor a skipped one'), 2)
})

// spec: design §17 (the six codes, the four outcomes) · §6 change 5 · law 6 "`outcome pass` is written only by the foreman's done-check"
// class: L1 `pass` without a form
// technique: state-machine walk: every exit × every outcome × checked
// method: 6 × 4 × 2 calls on fresh contracts; the ones that may stand are exactly: pass only with exit 0 and checked; every
//         other outcome with any exit; refused calls leave exit, outcome and the file untouched
// sre: if any caller tries to write pass on a crash, a deadline or its own word, is it refused every time?
test('every exit × outcome × checked: pass stands only on exit 0 when checked; a refused close writes nothing', () => {
  let stood = 0
  for (const exit of [...EXITS, 1, 255]) for (const outcome of [...OUTCOMES, 'ok']) for (const checked of [false, true]) {
    const s = mkSup(); const w = mkRun()
    const may = EXITS.has(exit) && OUTCOMES.includes(outcome) && (outcome !== 'pass' || (checked && exit === EXIT.DONE))
    if (may) { contractExit(s, w, exit, outcome, { checked }); stood++; assert.equal(w.contract.exit, exit); assert.equal(readContract(s.writes.at(-1)).outcome, outcome) }
    else { assert.throws(() => contractExit(s, w, exit, outcome, { checked })); assert.deepEqual([w.contract.exit, w.contract.outcome, s.writes.length], [null, null, 0]) }
  }
  assert.equal(stood, 6 * 3 * 2 + 1, 'fail, stopped and waiting-owner on each of the six codes, checked or not; pass once: exit 0, checked')
})

// spec: design §8 states · §17 · eng §3.4 step 6 ("held → done; false → failed; no form → stopped, done")
// class: L5 the record's shape (the state a close writes)
// technique: table walk over contractExit's state map
// method: each (exit, outcome) → the state the design names; read it back from the file
// sre: if the desk filters runs by state, does every close land in the one state the design gives it?
test('contractExit writes the state the design gives each close, on the file', () => {
  for (const [exit, outcome, state] of [[0, 'pass', 'done'], [0, 'stopped', 'done'], [0, 'fail', 'failed'], [0, 'waiting-owner', 'waiting-owner'],
    [12, 'fail', 'failed'], [15, 'fail', 'failed'], [30, 'stopped', 'failed'], [89, 'fail', 'failed'], [99, 'fail', 'stalled'], [99, 'waiting-owner', 'waiting-owner']]) {
    const s = mkSup(); const w = mkRun()
    contractExit(s, w, exit, outcome, { checked: true })
    assert.equal(readContract(s.writes.at(-1)).state, state, `${exit} ${outcome}`)
  }
})

// spec: design §17 (each code's cause) · eng §3.4 step 7 (the other ends) · supervisor.stop's reason
// class: E8 a deadline passed · E6 an infinite loop (stalled) · E1 a handler throws · M6 memory pressure
// technique: table walk over every sentence the stop path writes, including the ones no test named before (memory, refused, done:)
// method: close a fresh contract with each reason; read exit, outcome and state from the rendered file; a second close is a no-op
// sre: if a run dies for any reason, does its record say which of the six it was, so a person reads the cause, not a guess?
test('the stop path maps every reason to its code: 15 · 99 · 30 · 89 · 12 · 0, and a second close changes nothing', () => {
  for (const [why, exit, outcome, state] of [
    ['stopped: jobs never answered (F-01)', 15, 'fail', 'failed'], ['stopped: hop deadline', 15, 'fail', 'failed'],
    ['stalled: nothing could wake it', 99, 'fail', 'stalled'], ['missed heartbeats', 99, 'fail', 'stalled'], ['promise missed twice', 99, 'fail', 'stalled'],
    ['buried: boom', 30, 'fail', 'failed'], ['crash in on hand', 30, 'fail', 'failed'],
    ['no room: memory below 1 GB', 89, 'fail', 'failed'], ['rss over budget', 89, 'fail', 'failed'],
    ['refused: wrote outside', 12, 'fail', 'failed'], ['a watch run may not act', 12, 'fail', 'failed'],
    ['done: the run ended', 0, 'fail', 'failed'], ['stopped by the owner', 0, 'stopped', 'done'], [null, 0, 'stopped', 'done'], [undefined, 0, 'stopped', 'done']]) {
    const s = mkSup(); const w = mkRun()
    contractClose(s, w, why)
    const r = readContract(s.writes.at(-1))
    assert.deepEqual([r.exit, r.outcome, r.state], [exit, outcome, state], String(why))
    contractClose(s, w, 'buried: again'); assert.equal(s.writes.length, 1, 'idempotent: no second write')
  }
})

// spec: design §8 (resume from the checkpoint) · law 6 · eng §3.4 step 6
// class: E16 a stale checkpoint older than the record (a restored contract that carries an outcome but no exit)
// technique: state-machine walk from a restored state: outcome set, exit null
// method: a `done:` stop keeps the restored outcome (pass → done; stopped → done) instead of inventing one
// sre: if the foreman restarts between the done-check and the stop, does the run end with the outcome the check wrote?
test('a restored contract with an outcome and no exit ends on that outcome at the done: stop', () => {
  for (const [outcome, state] of [['pass', 'done'], ['stopped', 'done'], ['fail', 'failed']]) {
    const s = mkSup(); const w = mkRun(); w.contract.outcome = outcome
    contractClose(s, w, 'done: the done-check passed')
    assert.deepEqual([w.contract.exit, w.contract.outcome, w.contract.state], [0, outcome, state])
  }
})

// spec: design §8 lifecycle (a worker that is not a run has no contract) · eng §2 contract.mjs row
// class: E11 an orphan (a call for a worker with no contract)
// technique: fault injection: every writer called on a worker that never opened a contract, and on a host with no `contract`
// method: each writer answers null/undefined/false and throws nothing; no host write happens; a host without the
//         `contract` callback still records on the worker
// sre: if a cart worker (no contract) trips a contract writer, does the foreman carry on instead of crashing the sweep?
test('every writer is a no-op on a worker with no contract, and works on a host without a contract callback', () => {
  const s = mkSup(); const bare = { id: 'w-bare' }
  assert.equal(contractStep(s, bare, 'done', 'x', 't'), null)
  assert.equal(contractPromise(s, bare, 'x', 60), null)
  assert.equal(contractResolve(s, bare, 'p-1', 'kept'), false)
  assert.equal(contractResult(s, bare, { x: 1 }), undefined)
  assert.equal(contractSwap(s, bare, '12b'), undefined)
  assert.equal(contractExit(s, bare, 0, 'pass'), undefined, 'not even a refusal: there is nothing to close')
  assert.equal(contractClose(s, bare, 'buried'), undefined)
  assert.equal(s.writes.length, 0)
  const quiet = { host: { now: () => 5 } }; const w = mkRun()
  assert.equal(contractStep(quiet, w, 'running', 'x'), 1); contractPromise(quiet, w, 'p', 0); contractResolve(quiet, w, 'p-1', null, null)
  contractResult(quiet, w, 1); contractSwap(quiet, w, 'b'); contractExit(quiet, w, 0, 'stopped'); contractClose(quiet, w, 'x')
  assert.deepEqual([w.contract.promises[0].state, w.contract.promises[0].ticket, w.contract.promises[0].deadline_at], ['open', null, 5 + 60])
})

// spec: design §9 "a promise … with no ticket inside its deadline" · eng §3.5 "promise deadline: the intent's deadline, or 60 s"
// class: J13 a value unset, empty or non-numeric
// technique: boundary on the deadline: absent, 0, NaN, a word, 0.5, 1, 120
// method: read deadline_at − made_at: 60 for absent/0/NaN/word, 1 for 0.5 (the floor is 1 s), the number otherwise
// sre: if the brain sends a promise with a junk deadline, does the kick rule still get a sane clock instead of NaN?
test('a promise deadline is the given seconds, 60 s when absent or not a number, and never under 1 s', () => {
  const s = mkSup(); const w = mkRun()
  const span = (d) => { contractPromise(s, w, 'x', d); const p = w.contract.promises.at(-1); return p.deadline_at - p.made_at }
  assert.deepEqual([undefined, 0, NaN, 'soon', 0.5, 1, 120].map(span), [60, 60, 60, 60, 1, 1, 120])
})

// spec: design §8 "swapped-at (the contract's step number at the swap; R9)" · §18 "if swapped-at is set, the next step started on the new brain"
// class: L5 the record's shape · E16 a stale checkpoint (the swap must survive the file)
// technique: swap at step 0 (right after filing) and at step 3; read back
// method: swapped-at is the step number, 0 included (a number, never null), and the brain name is the new brain
// sre: if the broker swaps the brain before the first step, does the record still say a swap happened?
test('swapped-at records the step at the swap, 0 included, and the new brain, on the file', () => {
  const s = mkSup(); const w = mkRun()
  contractSwap(s, w, 'gemma-12b')
  let r = readContract(s.writes.at(-1)); assert.deepEqual([r.swapped_at, r.brain], [0, 'gemma-12b'])
  for (let i = 0; i < 3; i++) contractStep(s, w, 'running', 'x')
  contractSwap(s, w, 26)
  r = readContract(s.writes.at(-1)); assert.deepEqual([r.swapped_at, r.brain], [3, '26'])
})

// spec: design §8 last-result "bounded" · eng §3.3 "last-result (data, bounded 4,000 chars / 50 items / depth 6)" · eng §3.6
// class: B5 the contract at full size · J7 hostile input (depth; a BigInt; a function; a Symbol)
// technique: boundary on each bound (4,000 / 4,001 chars; 50 / 51 items; 60 / 61 keys; depth 6 / 7) and the types JSON cannot carry
// method: bound() keeps the shape and cuts the bulk with a "+N" note; a BigInt, a function and a Symbol become strings so
//         the contract can always be rendered (the 2026-10-23 crash was a sliced JSON string)
// sre: if a hand answers with a monster, does the contract keep a readable summary and never crash the foreman?
test('bound keeps the shape and cuts the bulk at each bound; a value JSON cannot carry becomes its string', () => {
  assert.equal(bound('x'.repeat(4000)).length, 4000)
  assert.equal(bound('x'.repeat(4001)), 'x'.repeat(4000) + '… (+1)')
  assert.equal(bound(Array(50).fill(1)).length, 50); assert.deepEqual(bound(Array(51).fill(1)).slice(-2), [1, '… (+1)'])
  const keys = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`k${i}`, i]))
  assert.equal(Object.keys(bound(keys(61))).length, 60)
  let deep = 'leaf'; for (let i = 0; i < 9; i++) deep = [deep]
  assert.equal(JSON.stringify(bound(deep)), '[[[[[[["…"]]]]]]]', 'seven levels of list (depth 0–6) survive; depth 7 and below is one mark')
  assert.deepEqual([bound(null), bound(undefined), bound(0), bound(false)], [null, undefined, 0, false])
  assert.deepEqual([bound(10n), bound(Symbol.for('s')).toString(), typeof bound(() => 1)], ['10', 'Symbol(s)', 'string'])
  assert.equal(bound({ s: 'z'.repeat(100) }, 40).s.length, 80 + '… (+20)'.length, 'a nested string gets max/4, never under 80')
  const s = mkSup(); const w = mkRun()
  contractResult(s, w, { n: 10n, f: () => 1, rows: Array(500).fill('r') })
  assert.doesNotThrow(() => readContract(renderContract(w.contract)))
})

// spec: design §8 "one (task-state …)", §7.4 · eng §3.3 the contract file (17 fields, in this order)
// class: W5 malformed (shape) — the contract file read back
// technique: state-machine walk over every way the file can be wrong: not one form, the wrong head, a short or long form,
//            a field out of order, a field of three, a bad version, state, exit or outcome
// method: each readContract throws exactly one sentence naming the fault; the sentence never echoes more than the field
// sre: if a contract file is truncated or hand-edited, does the reader refuse it with a sentence instead of reading half?
test('readContract refuses every malformed file with one sentence naming the fault', () => {
  const good = renderContract(mkRun().contract)
  const cases = [
    ['', /exactly one form/], [null, /exactly one form/], ['5', /a contract is \(task-state/], ['("task-state" (v 1))', /a contract is/],
    ['(state-task (v 1))', /a contract is/], ['(task-state (v 1))', /a contract is/],
    [good.replace(/\)$/, ' (more 1) (more 2))'), /a contract is/],
    [good.replace('(v 1)', '(v 1 1)'), /field 1 must be \(v/], [good.replace('(v 1)', 'v'), /field 1 must be \(v/], [good.replace('(v 1)', '("v" 1)'), /field 1 must be/],
    [good.replace('(v 1)', '(v 2)'), /version 1 only/],
    [good.replace('(state "filed")', '(state "flying")'), /state flying is not one of/],
    [good.replace('(exit null)', '(exit 1)'), /exit 1 is not one of the six/],
    [good.replace('(outcome null)', '(outcome "ok")'), /outcome ok is not one of/],
  ]
  for (const [text, why] of cases) assert.throws(() => readContract(text), why, String(text).slice(0, 60))
  assert.equal(readContract(good.replace('(exit null)', '(exit 12)').replace('(outcome null)', '(outcome "fail")')).exit, 12)
})

// spec: design §7.4 "On the wire a contract is the (@ …) object (GET /contracts/<id>?as=data; slat-data reads it)" · law 5
// class: W5 malformed (a symbol as body data) — the data form must hold none
// technique: round trip through the one reader (slat-data `readData`), on a fresh contract and on a full one
// method: contractData's text reads as JSON with the 17 fields; the kicks, steps, promises and nulls survive; no symbol anywhere
// sre: if the brain loop reads a contract as data, does it get the same record the file holds, by the one reader?
test('contractData is the (@ …) object the one reader reads, with every field of the file', () => {
  const s = mkSup(); const w = mkRun({ cart: 'triggers', brain: '26b' })
  const fresh = readData(contractData({ ...w.contract, provenance: undefined, kicks: undefined }))
  assert.deepEqual([fresh.provenance, fresh.kicks, fresh['last-result']], [null, [], null])
  const old = readContract(renderContract({ ...w.contract, provenance: undefined, kicks: undefined }))   // a contract restored from before 2026-10-23
  assert.deepEqual([old.provenance, old.kicks], [null, []])
  contractStep(s, w, 'done', 'hand jobs → result 1', 'w-c-hand-1'); contractPromise(s, w, 'answer', 60); contractResult(s, w, { rows: [1] })
  w.contract.kicks.push({ verdict: 'kick', category: 'deadline', evidence: {}, by: 'kick.mjs' }); contractExit(s, w, 0, 'stopped')
  const d = readData(contractData(w.contract))
  assert.deepEqual(Object.keys(d), ['v', 'run', 'key', 'cart', 'goal', 'done-check', 'state', 'step', 'steps', 'promises', 'last-result', 'brain', 'swapped-at', 'exit', 'outcome', 'provenance', 'kicks', 'at', 'why'])   // + at, why (K1 2026-10-30)
  assert.match(d.at, /^lacuna:\/1\/4096\//, 'the data carries the run\'s coordinate'); assert.equal(typeof d.why, 'string', 'a stopped run says why')
  assert.deepEqual(d.steps, [{ n: 1, status: 'done', text: 'hand jobs → result 1', ticket: 'w-c-hand-1' }])
  assert.deepEqual([d.cart, d.brain, d['swapped-at'], d.exit, d.outcome, d['last-result'].rows], ['triggers', '26b', null, 0, 'stopped', [1]])
  assert.equal(d.promises[0].state, 'open'); assert.equal(d.kicks[0].category, 'deadline')
})

// spec: design §8 (the contract opens filed; a cart's header seeds goal and done-check) · §12 carts
// class: L5 the record's shape (what a fresh contract holds)
// technique: table over the seeds: options, a cart on the worker, neither
// method: open three contracts; read the rendered file: the options win; else the cart's does/done/name; else empty and null
// sre: if a cart files a run without naming its goal, does the contract still say what the cart is for?
test('a contract opens filed, seeded by the options, else by the worker\'s cart, else empty', () => {
  const a = { id: 'w-a', cart: { name: 'backup', does: 'back up the world', done: '(ok? bundle)' } }
  openContract(a)
  assert.deepEqual([a.contract.cart, a.contract.goal, a.contract.done_check, a.contract.key, a.contract.brain, a.contract.state], ['backup', 'back up the world', '(ok? bundle)', null, null, 'filed'])
  const b = { id: 'w-b', cart: { name: 'backup' } }; openContract(b, { goal: 'g', doneCheck: 'd', cart: 'repair', key: 'k', brain: '26b' })
  assert.deepEqual([b.contract.cart, b.contract.goal, b.contract.done_check, b.contract.key, b.contract.brain], ['repair', 'g', 'd', 'k', '26b'])
  const n = { id: 'w-n', cart: { name: 'backup' } }; openContract(n, { cart: null })
  assert.equal(n.contract.cart, 'backup', 'a null cart option is "not given" (??): the worker\'s cart names it')
  const c = { id: 'w-c' }; openContract(c, {})
  const r = readContract(renderContract(c.contract))
  assert.deepEqual([r.cart, r.goal, r.done_check, r.state, r.step, r.provenance], [null, '', '', 'filed', 0, { fact: null, episode: null, decision: null }])
  assert.deepEqual(STATES, ['filed', 'running', 'waiting-owner', 'paused', 'done', 'failed', 'stalled'])
})
