// contract.test.mjs — THE CONTRACT, THE FIRST TESTS (lane U2; K2 of the build). Owns: the unit tests of contract.mjs's
// core path: a contract opens filed, a done step names its ticket, the six codes and four outcomes, the stop path's
// codes, the text read back whole, a huge result bounded. The bounds and every refusal live in contract-record.test.mjs.
// Refuses: a mock of contract.mjs. Implements: design §8, §17, law 6; engineering §3.3 `task-state`, §3.4.
// Invariants (§18): "if a step is done, then a ticket closed it (never a report line)"; "if swapped-at is set, the next
// step started on the new brain from the contract". Faults (§16): F-12.
// coverage: contract.mjs — lines 100% branches 100% functions 100% (2026-10-24, lane U2 files)
import test from 'node:test'
import assert from 'node:assert/strict'
import { openContract, contractStep, contractPromise, contractResolve, contractResult, contractSwap, contractExit, contractClose,
         renderContract, readContract, EXIT } from '../contract.mjs'

const sup = () => { let t = 1000; const writes = []; return { writes, tick: (s) => { t += s }, host: { now: () => t, contract: (w, text) => writes.push(text) } } }
const run = (s, o = {}) => openContract({ id: 'w7', cart: null }, { key: 'k-1', goal: 'count the jobs', doneCheck: '(> jobs 0)', ...o }) && { id: 'w7' }

// spec: design §8 lifecycle ("contract filed" → steps) · §18 "if a step is done, then a ticket closed it" · F-12
// class: L2 a step `done` from a report line
// technique: state-machine walk filed → running; fault injection: a done step with no ticket
// method: open; a done step without a ticket throws F-12; a running then a done-with-ticket step; read the state and the two writes
// sre: if a report line claims a step is done, does the contract refuse it while a ticket's close is written?
test('a contract opens filed, steps make it running, a done step needs its ticket (F-12)', () => {
  const s = sup(); const w = { id: 'w7' }; openContract(w, { key: 'k-1', goal: 'count the jobs', doneCheck: '(> jobs 0)' })
  assert.equal(w.contract.state, 'filed')
  assert.throws(() => contractStep(s, w, 'done', 'jobs'), /F-12/)
  assert.equal(contractStep(s, w, 'running', 'hand jobs'), 1)
  assert.equal(contractStep(s, w, 'done', 'hand jobs', 'w7-hand-1'), 2)
  assert.equal(w.contract.state, 'running')
  assert.equal(s.writes.length, 2)
})

// spec: design §17 (six codes, four outcomes) · §6 change 5 · law 6
// class: L1 `pass` without a form
// technique: boundary on the vocabularies: exit 1, outcome "ok", pass unchecked
// method: each refusal throws its sentence; pass with checked writes exit 0 and state done
// sre: if any caller invents a code or claims pass on its own word, is the record refused?
test('exit codes are the six, outcomes the four, and pass needs the done-check', () => {
  const s = sup(); const w = { id: 'w7' }; openContract(w, { key: 'k', goal: 'g' })
  assert.throws(() => contractExit(s, w, 1, 'fail'), /not one of the six/)
  assert.throws(() => contractExit(s, w, 0, 'ok'), /not one of/)
  assert.throws(() => contractExit(s, w, 0, 'pass'), /done-check/)
  contractExit(s, w, EXIT.DONE, 'pass', { checked: true })
  assert.equal(w.contract.state, 'done'); assert.equal(w.contract.exit, 0)
})

// spec: design §17 (15 deadline, 99 stalled, 30 program error, 0 stopped) · eng §3.4 step 7
// class: E8 a deadline passed · E7 a zombie · E1 a handler throws
// technique: table walk over the stop sentences supervisor.stop writes; idempotence
// method: close with each reason; read exit, outcome, state; a second close changes nothing
// sre: if a run ends by force, does the record say why in one code, once?
test('the stop path names the code: never answered → 15, stalled → 99, buried → 30, an owner stop → 0 stopped', () => {
  for (const [why, exit, outcome, state] of [['stopped: jobs never answered', 15, 'fail', 'failed'], ['stalled: nothing pending, nothing could wake it', 99, 'fail', 'stalled'],
                                              ['buried: boom', 30, 'fail', 'failed'], ['stopped by the owner', 0, 'stopped', 'done']]) {
    const s = sup(); const w = { id: 'w7' }; openContract(w, { key: 'k', goal: 'g' })
    contractClose(s, w, why)
    assert.deepEqual([w.contract.exit, w.contract.outcome, w.contract.state], [exit, outcome, state], why)
    contractClose(s, w, 'buried: again')
    assert.equal(w.contract.exit, exit, 'idempotent')
  }
})

// spec: design §8 "the file holds the bare (task-state …) form, never a signed envelope" · §7.4 · eng §3.3
// class: L5 the record's shape · J15 Unicode and bytes (quotes and a newline in the goal)
// technique: round trip of every field after every writer ran; fault injection on field order and state
// method: render; no (msg …) in it; read back: goal with quotes and newline, steps, promises, last result, swap, nulls as null
// sre: if a person or the brain reads CONTRACT.slat, is it the one plain form, whole, with nulls that mean null?
test('the text is one bare (task-state …) that reads back whole; a wrong field order or state is one sentence', () => {
  const s = sup(); const w = { id: 'w7' }; openContract(w, { key: 'k-1', goal: 'say "hi"\nthen go', doneCheck: 'd', brain: 'gemma-26b' })
  contractPromise(s, w, 'answer in 2 min', 120)
  contractStep(s, w, 'running', 'hand jobs all')
  contractResult(s, w, { ok: true, rows: [1, 2, 3], note: 'x' })
  contractSwap(s, w, 'gemma-12b'); s.tick(5)
  contractResolve(s, w, 'p-1', 'kept', 'w7-hand-1')
  const text = renderContract(w.contract)
  assert.match(text, /^\(task-state \(v 1\) \(run "w7"\)/)
  assert.doesNotMatch(text, /\(msg /)
  const r = readContract(text)
  assert.equal(r.goal, 'say "hi"\nthen go'); assert.equal(r.state, 'running'); assert.equal(r.step, 1)
  assert.deepEqual(r.steps[0], { n: 1, status: 'running', text: 'hand jobs all', ticket: null })
  assert.deepEqual(r.promises[0], { id: 'p-1', text: 'answer in 2 min', state: 'kept' })
  assert.deepEqual(r.last_result, { ok: true, rows: [1, 2, 3], note: 'x' })
  assert.equal(r.brain, 'gemma-12b'); assert.equal(r.swapped_at, 1, 'the step at the swap'); assert.equal(r.exit, null)
  const fresh = readContract(renderContract(openContract({ id: 'w9' }, { goal: 'g' }).contract ? { id: 'w9' }.contract : (() => { const w = { id: 'w9' }; openContract(w, { goal: 'g' }); return w.contract })()))
  assert.deepEqual([fresh.key, fresh.cart, fresh.brain, fresh.swapped_at, fresh.exit, fresh.outcome], [null, null, null, null, null, null], 'nulls read back as null, not "null"')
  assert.throws(() => readContract(text.replace('(state "running")', '(state "flying")')), /state flying is not one of/)
  assert.throws(() => readContract(text.replace('(key "k-1") (cart null)', '(cart null) (key "k-1")')), /field 3 must be \(key/)
  assert.throws(() => readContract(text + ' (extra)'), /exactly one form/)
})

// spec: eng §3.6 "last-result bounded to 4,000 chars / 50 items / depth 6 (a 30 KB jobs reply once crashed the live foreman)"
// class: B5 the contract at full size · J7 hostile input (a 30 KB reply)
// technique: a reply of 400 rows of 500 chars and a 20,000-char tail
// method: bound keeps 50 rows and a "+350" note; the contract renders under 60,000 chars and stays valid JSON
// sre: if a hand returns a monster, does the foreman keep running with a readable summary in the record?
test('a huge result is bounded, never sliced into broken JSON (the live crash of 2026-10-23)', async () => {
  const { bound, contractResult, openContract: oc } = await import('../contract.mjs')
  const big = { rows: Array.from({ length: 400 }, (_, i) => ({ id: i, text: 'x'.repeat(500) })), tail: 'y'.repeat(20000) }
  const b = bound(big)
  assert.equal(b.rows.length, 51); assert.match(b.rows[50], /\+350/); assert.ok(b.tail.length < 1100)
  const s = sup(); const w = { id: 'w7' }; oc(w, { key: 'k', goal: 'g' })
  contractResult(s, w, big)
  assert.doesNotThrow(() => JSON.stringify(w.contract.last_result))
  assert.ok(renderContract(w.contract).length < 60000)
})
