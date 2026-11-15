// runs.test.mjs — THE RUN LEDGER AND THE RUN INDEX (lane U2). Owns: the unit tests of runs.mjs: `runByKey` (the merge on a
// key at filing), `livingRuns` (what the desk lists), `runRecord` (the `(run …)` row's shape, design §7.5) and `closeRun`
// (one row per run, a ledger that refuses noted on the worker, never a crash). Refuses: a mock of runs.mjs; the live
// ledger (~/lacuna-world/foreman/ledger/runs.slat) — the fake host captures every line.
// Implements: design §7.5 (the run record), §8 lifecycle ("(run …) appended → cart-retired upstream"), law 6 (`checked-by`
// only on a pass); engineering §3.3 the run row, §3.4 step 6, §6 files.
// Invariants (§18): "every run leaves one row" (the module's own); "if a step is done, a ticket closed it" (the `hands`
// count reads only done hand rows). Faults (§16): none of its own (a refusing ledger is noted, F-02 is the door's).
// coverage: runs.mjs — lines 100% branches 98.39% functions 100% (2026-10-24, lane U2 files; :45 named test.todo)
import test from 'node:test'
import assert from 'node:assert/strict'
import { makeSup } from '../../../test/conformance/fake-host.mjs'
import { runByKey, livingRuns, runRecord, closeRun } from '../runs.mjs'
import { fileRun, intent, result, finishRun } from '../intents.mjs'
import { contractSwap, contractStep } from '../contract.mjs'
import { readData } from '../../../lacuna-scheme/src/slat-data.js'
import { parse as parseCoordinate } from '../coordinate.mjs'

const row = (line) => readData(line.replace(/^\(run /, '').replace(/\)\n$/, ''))
/** The conformance host names `ledger` twice (the array, then the writer), so its capture is the function; capture here. */
const ledgerOf = (s) => { const lines = []; s.host.ledger = (t) => lines.push(t); return lines }
const FIELDS = ['id', 'cart', 'run', 'batch', 'attempt', 'first-try', 'outcome', 'exit', 'checked-by', 'rounds', 'kicks', 'swaps', 'hands', 'minutes', 'brain-seconds', 'minds', 'ended', 'why', 'at']   // + why, at (K1, 2026-10-30: SENTRY-2.0 §4, ROAD category 2 ruling 5)

// spec: design §7.5 run record {id, cart, run, batch, attempt, first-try, outcome, exit, checked-by, rounds, kicks, swaps,
//       hands, minutes, brain-seconds, minds} · eng §3.3 the run row (+ ended) · law 6
// class: L5 the ledger row's shape · L1 `pass` without a form (`checked-by` only on a pass)
// technique: a whole run on the fake host: filing, two hands, one result each, a done-check that holds
// method: read the one line the ledger got, by the one reader: the fields in their order, rounds = hops, hands = done hand
//         rows, checked-by = foreman (a pass), first-try on attempt 1, minutes from the fake clock
// sre: if the owner audits the ledger, does each row say what ran, how it ended, and who checked it?
test('a run that passed leaves one (run …) row in the design\'s field order, checked by the foreman', () => {
  const { h, s } = makeSup(); const ledger = ledgerOf(s)
  const w = fileRun(s, { key: 'r-led', goal: 'g', doneCheck: '(= hops 2)', cart: 'ipad-verify' })
  for (const tool of ['jobs', 'disk']) { const i = intent(s, w.id, { tool }); result(s, w.id, 'hand', { ticket: i.ticket, op: tool, exit: 0 }) }
  h.tick(90)
  finishRun(s, w.id, { pass: true })
  assert.equal(ledger.length, 1)
  const r = row(ledger[0])
  assert.deepEqual(Object.keys(r), FIELDS)
  assert.deepEqual([r.id, r.cart, r.run, r.batch, r.attempt, r['first-try'], r.outcome, r.exit, r['checked-by'], r.rounds, r.kicks, r.swaps, r.hands, r.minutes, r['brain-seconds'], r.minds, r.ended, r.why],
    [w.id, 'ipad-verify', 'r-led', null, 1, true, 'pass', 0, 'foreman', 2, 0, 0, 2, 1.5, 0, null, h.now(), null])
  assert.equal(r.at, w.contract.at, 'the row carries the run\'s coordinate')
  assert.deepEqual([parseCoordinate(r.at).service, parseCoordinate(r.at).gen], [4096, 1])
})

// spec: design §7.5 · law 6 ("first person only with a ticket"; `checked-by` names the check) · §17 exit codes on the row
// class: L1 `pass` without a form · L5 the ledger row's shape
// technique: table over outcomes and attempts: stopped, fail, a pass on attempt 2, a pass with a named checker
// method: build each record with runRecord; checked-by is null unless the outcome is pass; first-try only on a first pass
// sre: if a run passed only on its second attempt, does the ledger say so, so the first-try rate is honest?
test('checked-by is written only on a pass, first-try only on a first-attempt pass', () => {
  const { s } = makeSup()
  const rec = (outcome, opts) => { const w = fileRun(s, { key: `k-${Math.random()}`, goal: 'g' }); w.contract.outcome = outcome; w.contract.exit = 0; return runRecord(s, w, opts) }
  assert.deepEqual([rec('stopped')['checked-by'], rec('fail', { checkedBy: 'x' })['checked-by']], [null, null])
  const second = rec('pass', { attempt: 2, batch: 'b-1', checkedBy: 'strict' })
  assert.deepEqual([second['first-try'], second['checked-by'], second.batch, second.attempt], [false, 'strict', 'b-1', 2])
  assert.equal(rec('pass')['first-try'], true)
})

// spec: design §8 "swapped-at (the contract's step number at the swap)" · §7.5 `swaps` · §18 "if swapped-at is set …"
// class: L5 the ledger row's shape · E16 a value 0 read as absent
// technique: boundary on swapped-at: null, 0 (a swap right after filing), 3
// method: before the fix `swaps` was `swapped_at ? 1 : 0`, so a swap at step 0 was recorded as no swap; now any set
//         swapped-at (0 included) is one swap on the row
// sre: if the broker swapped the brain before the first step, does the ledger still say the run ran on two brains?
test('a brain swap at step 0 counts as a swap on the row', () => {
  const { s } = makeSup()
  const mk = () => fileRun(s, { key: `sw-${Math.random()}`, goal: 'g' })
  const none = mk(); assert.equal(runRecord(s, none).swaps, 0)
  const zero = mk(); contractSwap(s, zero, 'gemma-12b'); assert.equal(zero.contract.swapped_at, 0)
  assert.equal(runRecord(s, zero).swaps, 1)
  const three = mk(); for (let i = 0; i < 3; i++) contractStep(s, three, 'running', 'x'); contractSwap(s, three, 'b'); assert.equal(runRecord(s, three).swaps, 1)
})

// spec: design §7.5 (hands, kicks, minds, brain-seconds, rounds) · eng §3.3 the run row
// class: L5 the ledger row's shape · L2 a step `done` from a report line (only done hand rows count)
// technique: a worker built by hand: steps of every status and text, kicks, a mind record, brain seconds, no run header
// method: hands counts only `done` rows whose text starts "hand "; rounds falls back to the step count without a run;
//         minds names asked/labels/dropped/failed (zeros filled) when the mind was asked, else null; brain-seconds rounds
// sre: if the desk ranks carts by hands used, is a failed or reported step ever counted as work done?
test('the row counts only done hand steps, kicks and swaps; minds when asked; rounds from the steps without a run header', () => {
  const { s } = makeSup()
  const w = { id: 'w-hand', started: 1000, brainSeconds: 12.6, mind: { asked: 3, labels: 2 },
    contract: { cart: 'c', key: 'k', outcome: 'fail', exit: 30, kicks: [{}, {}], swapped_at: null,
      steps: [{ status: 'done', text: 'hand jobs → result 1' }, { status: 'running', text: 'hand disk' }, { status: 'done', text: 'act merge → result 2' }, { status: 'done', text: 'handoff' }] } }
  const r = runRecord(s, w)
  assert.deepEqual([r.hands, r.kicks, r.rounds, r['brain-seconds'], r.minds], [1, 2, 4, 13, { asked: 3, labels: 2, dropped: 0, failed: 0 }])
  const bare = runRecord(s, { id: 'w-b', started: 1000, contract: { outcome: null, exit: null } })
  assert.deepEqual([bare.hands, bare.kicks, bare.rounds, bare.minds, bare['brain-seconds'], bare.swaps], [0, 0, 0, null, 0, 0])
  assert.equal(runRecord(s, { id: 'w-none' }), null)
})

// spec: design §18 "every run leaves one row" (runs.mjs) · §8 lifecycle ("(run …) appended") · eng §3.4 step 6
// class: E10 a duplicate message (a second close) · J11 fs failure (the ledger refuses: ENOSPC, EACCES)
// technique: fault injection on the host's ledger: it throws ENOSPC; a host with no ledger; a worker that is not a run
// method: closeRun writes exactly one row however often it is called; a throwing ledger leaves the error on the worker
//         (cut to 200 chars) and the row is still answered; no contract → null and nothing written
// sre: if the disk fills as a run ends, does the foreman note it and carry on, never crash the stop path or write twice?
test('a run leaves one row however often it is closed; a ledger that throws is noted on the worker, never a crash', () => {
  const { s } = makeSup(); const ledger = ledgerOf(s)
  const w = fileRun(s, { key: 'once', goal: 'g' })
  assert.ok(closeRun(s, w)); assert.equal(closeRun(s, w), null); assert.equal(ledger.length, 1)
  s.stop(w.id, 'stopped by the owner'); assert.equal(ledger.length, 1, 'the stop path does not write a second row')
  assert.equal(w.ledgerError, undefined)
  const full = fileRun(s, { key: 'full', goal: 'g' })
  s.host.ledger = () => { const e = new Error('ENOSPC: no space left on device, write ' + 'x'.repeat(400)); e.code = 'ENOSPC'; throw e }
  const r = closeRun(s, full)
  assert.equal(r.run, 'full'); assert.match(full.ledgerError, /^ENOSPC/); assert.equal(full.ledgerError.length, 200)
  const odd = fileRun(s, { key: 'odd', goal: 'g' }); s.host.ledger = () => { throw 'a string' }
  closeRun(s, odd); assert.equal(odd.ledgerError, 'a string')
  delete s.host.ledger
  const quiet = fileRun(s, { key: 'quiet', goal: 'g' }); assert.ok(closeRun(s, quiet))
  assert.equal(closeRun(s, { id: 'w-x' }), null)
})

// spec: design §8 "key (goal hash, dedupe at filing)" · eng §3.4 step 1 (a second file under one key merges)
// class: E10 a duplicate message (a second filing) · E11 an orphan (a key whose run ended)
// technique: state-machine walk over the run's states: running, paused, stopped
// method: runByKey finds a running or paused run by its key (numbers read as strings), never a retired one, never a cart
// sre: if a trigger fires again while its run is paused, does it merge into that run instead of starting a twin?
test('runByKey finds a living run by its key, paused included, never one that ended', () => {
  const { s } = makeSup()
  const w = fileRun(s, { key: '42', goal: 'g' })
  assert.equal(runByKey(s, 42), w)
  w.state = 'paused'; assert.equal(runByKey(s, '42'), w)
  w.state = 'starting'; assert.equal(runByKey(s, '42'), w)
  w.state = 'running'; s.stop(w.id, 'stopped by the owner'); assert.equal(runByKey(s, '42'), null)
  s.spawn({ name: 'cart', program: "(on 'x (lambda (v) #t))" }); assert.equal(runByKey(s, 'cart'), null)
})

// spec: design §13 (what the desk reads) · eng §3.2 hop 8 (`GET /runs`)
// class: L5 the record's shape (the desk's list) · J14 the clock (a wait already past due)
// technique: a run on its brain, a run past its hop deadline, a cart worker, a plain worker, a run without a contract
// method: each row has the desk's fields; `awaiting` is the whole seconds left, never negative; a cart lists as kind cart;
//         a plain worker is not listed
// sre: if the owner opens the desk, does every living run show its state and how long it waits, and nothing else?
test('livingRuns lists runs and carts with the desk\'s fields, the wait in whole seconds and never below zero', () => {
  const { h, s } = makeSup()
  const a = fileRun(s, { key: 'a', goal: 'goal a', by: 'w-cart', drive: false })
  h.tick(10.4)
  const b = fileRun(s, { key: 'b', goal: 'g' }); b.awaiting.due = h.now() - 5
  const cart = s.spawn({ name: 'backup', program: "(on 'x (lambda (v) #t))" }); cart.cart = { name: 'backup' }
  const filed = s.spawn({ name: 'repair', program: "(on 'x (lambda (v) #t))" }); filed.cart = { name: 'repair' }; filed.contract = { key: 'rk', cart: 'repair', state: 'running', step: 2 }
  s.spawn({ name: 'plain', program: "(on 'x (lambda (v) #t))" })
  const bare = fileRun(s, { key: 'c', goal: 'g' }); delete bare.contract; delete bare.awaiting; delete bare.by
  const rows = livingRuns(s)
  assert.deepEqual(rows.map((r) => r.kind), ['run', 'run', 'cart', 'cart', 'run'])
  const rk = rows.splice(3, 1)[0]; assert.deepEqual([rk.key, rk.cart, rk.step], ['rk', 'repair', 2], 'a cart with a contract lists its key')
  const { work, ...first } = rows[0]
  assert.deepEqual([work.state, work.check, work.by], ['running', 'none', 'foreman'], 'a living run carries its work row (order §10 row 5)')
  assert.deepEqual(first, { id: a.id, key: 'a', cart: null, state: 'filed', step: 0, hops: 0, awaiting: 40, goal: 'goal a', by: 'w-cart', kind: 'run', role: null, desk: true, sentry: null, brain: null, open: 0, at: `lacuna:/1/4096/-/${a.slot}/1/0/-` })
  assert.equal(rows[1].awaiting, 0)
  assert.deepEqual([rows[2].key, rows[2].cart, rows[2].state, rows[2].step, rows[2].hops, rows[2].awaiting, rows[2].goal], [null, 'backup', 'running', 0, 0, null, null])
  assert.deepEqual([rows[3].key, rows[3].state, rows[3].by, rows[3].awaiting], ['c', 'running', null, null])
})

