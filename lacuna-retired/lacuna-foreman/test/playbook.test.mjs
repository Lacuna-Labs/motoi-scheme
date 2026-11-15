// playbook.test.mjs — THE PLAYBOOK RUNNER'S TESTS (lane P). Owns: the loader over the repo's 33 playbooks (agent-bug and process-kill added 2026-10-24, gallery-draw by C12, the five maker trees by L3) (every
// unresolved unit printed, every refused tree refused cleanly with exit 12), the unit table's seams, and the runner on
// five fixture trees under test/fixtures/playbooks/: the three-step run end to end, a step over its deadline (exit 15),
// an unknown unit refused at load (exit 12, the step named), shadow (no act sent, a `would` row), the failure arm, and
// the when/each walk with an ask. Refuses: the live hands socket, the live mind, ~/lacuna-world (the served ledger goes
// to scratch); a mock of playbook.mjs or playbook-run.mjs. The hands and the mind are stubs behind the runner's `io` seam.
// Implements: LACUNA-MINDS-1.0 §5.2 (the switchboard), §4.3 (`served`), §5.3 (code yellow is a record); design §17.
// Invariants (§18): "if a step is done, a receipt closed it"; "nothing acts in shadow". Faults (§16): F-01, F-02, F-08.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadPlaybooks, unitTable, playbookRows, indexText, WHEN, EXIT_REFUSED } from '../playbook.mjs'
import { runPlaybook, startPlaybook, holds, doneCheck } from '../playbook-run.mjs'
import { readContract, renderContract } from '../contract.mjs'
import { readForms, dataToJson } from '../../../lacuna-scheme/src/slat-data.js'
import { Supervisor } from '../supervisor.mjs'
import { Gate, seal } from '../protocol.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const FIX = (name) => path.join(HERE, 'fixtures', 'playbooks', name)
const REPO_PLAYBOOKS = path.join(HERE, '..', '..', '..', 'playbooks')
/** The fixtures' unit table: three reads, one act — never the hands' moving table (lanes T/B/R are landing units today). */
const UNITS = { reads: ['files', 'port'], acts: ['trash'] }
const rec = (w) => readContract(renderContract(w.contract))
/** A fake host with a movable clock; every upstream, contract text, letter and ledger row captured (the k5 shape: the
 *  conformance fake-host's `ledger` array is shadowed by its `ledger` function, so its rows cannot be read — see the report). */
function makeSup(extra = {}) {
  let t = 1000, n = 0
  const h = { up: [], texts: [], letters: [], rows: [], tick: (s) => { t += s }, now: () => t, id: () => `w${++n}`, save: () => {},
              deadlines: { hand: 10, act: 40, beat: 5, mind: 20, hop: 50 }, upstream: (kind, w, data) => h.up.push({ kind, name: w.name, data }),
              contract: (w, text) => h.texts.push(text), mail: (m) => h.letters.push(m), mailCount: () => {}, ledger: (text) => h.rows.push(text), ...extra }
  return { h, s: new Supervisor(h) }
}
const load = async (name) => (await loadPlaybooks(FIX(name), { units: UNITS })).playbooks[0]

// one object with the three doors the runner calls (hands · mind · served) and the stubs' records (hops · asks · lines)
function stubs(h, o) {
  const lines = [], hops = [], asks = []
  const answer = o?.answer || (() => ({ exit: 0 }))
  const mind = o?.mind || (() => 'one line')
  return { hops, asks, lines,
    hands: async (x) => { hops.push({ kind: x.kind, ...x.data }); const r = await answer(x.kind, x.data, h); return { ...(r || {}), ticket: x.data.ticket, op: x.data.op, ok: (r?.exit ?? 30) === 0 } },
    mind: async (req) => { asks.push(req); return mind(req) },
    served: (line) => lines.push(line) }
}

// spec: MINDS §5.2 "a call can only land on a line that exists in the playbook's step" · UNITS §0 (35 units are NEW) · README "refuse an unknown unit with exit 12"
// class: E (a form the loader refuses) · L (the record: one fault row per unresolved unit, by playbook and step)
// technique: the loader over the real playbooks/ tree with the hands' live table (or the foreman's copy when the import is refused)
// method: print the unresolved list per playbook; assert each refused tree carries exit 12, every fault names its playbook and step,
//         no tree is `ready` with a fault, every `when` admitted is one of the named conditions, and the index rows read back through the one reader
// sre: if a playbook names a unit nobody built, does the foreman refuse to run it and say which step?
test('the 41 playbooks load (the seven work teams joined 2026-10-25, O24; service-restart 2026-11-06, P5): every unresolved unit is reported by playbook and step, and a tree with one is refused (exit 12)', async () => {
  const r = await loadPlaybooks(REPO_PLAYBOOKS)
  assert.equal(r.playbooks.length, 41, `41 playbooks in ${REPO_PLAYBOOKS}`)
  console.log(`  unit table from: ${r.source}`)
  for (const p of r.playbooks) {
    const other = p.faults.filter((f) => !p.unresolved.includes(f.unit))
    console.log(`  ${p.state.padEnd(7)} ${p.id.padEnd(20)} unresolved: ${p.unresolved.join(' ') || '-'}${other.length ? ` | ${other.map((f) => f.why.replace(/ is not one of the named conditions.*$/, ' is not a named condition')).join(' | ')}` : ''}`)
    assert.ok(p.steps.length >= 3 && p.steps.length <= 8, `${p.id} has 4–9 units (UNITS §3), read as ${p.steps.length} steps`)
    for (const f of p.faults) { assert.equal(f.playbook, p.id); assert.ok(f.step == null || Number.isInteger(f.step), 'a fault names its step or none') }
    if (p.faults.length) assert.deepEqual([p.state, p.exit], ['refused', EXIT_REFUSED], `${p.id} with faults is refused`)
    else assert.deepEqual([p.state, p.exit], ['ready', null])
    for (const s of p.steps) if (s.when) assert.ok(WHEN.includes(s.when) || p.faults.some((f) => f.step === s.n && /named conditions/.test(f.why)), `${p.id} step ${s.n}: when "${s.when}" is admitted or refused`)
  }
  const ready = r.playbooks.filter((p) => p.state === 'ready').map((p) => p.id)
  console.log(`  ready: ${ready.length} (${ready.join(' ') || '-'}); refused: ${41 - ready.length}`)
  const rows = readForms(indexText(r.rows))
  assert.equal(rows.length, 41)
  const row = dataToJson(rows[0][1])
  assert.deepEqual(Object.keys(row), ['id', 'version', 'cart', 'type', 'steps', 'units', 'unresolved', 'state', 'faults'])
  assert.equal(rows[0][0].name, 'playbook-row')
})

// spec: playbook.mjs header (the table's order: ask · reads · acts · verbs · mind:<name>) · MINDS §4.3 (the eight mind jobs)
// class: B (a boundary: the hands' import refused by the jail) · J (two tables that could drift)
// technique: the table built from an injected list, then from the default sources
// method: an injected table holds exactly what was given plus verbs, minds and ask; `ask` is structural before it is a verb;
//         a mind job is `mind:<name>`; the default source is named
// sre: when the jail refuses lacuna-executor, does the loader still build a table and say where it came from?
test('the unit table: injected reads and acts, the worker verbs, the mind jobs as mind:<name>, ask first', async () => {
  const { table, source } = await unitTable(UNITS)
  assert.equal(source, 'injected')
  assert.deepEqual(['files', 'port', 'trash', 'ask', 'mind:gist', 'mind:pick-fix', 'hand', 'report'].map((u) => table.get(u)?.kind), ['read', 'read', 'act', 'ask', 'mind', 'mind', 'verb', 'verb'])
  assert.equal(table.has('restore to scratch'), false)
  const d = await unitTable()
  assert.match(d.source, /lacuna-executor|HAND_READS/)
  assert.equal(d.table.get('disk-usage')?.kind, 'read')
})

// spec: MINDS §5.2 (step = line · bindings · deadline · done-check; a receipt closes it) · §4.3 `(served …)` · SENTRY §3 step 7 (the grade form) · law 6
// class: L (the record: step rows, receipts, grades, the served ledger, the run row)
// technique: three stubbed lines (a read, an act under a standing press, a mind) through the `io` seam on a fake host
// method: run `three`; read the contract back through readContract: 3 step rows each `done` with its receipt rc-1..rc-3, 2 grade
//         forms, 1 served line that reads as data, exit 0 and outcome pass by the done-check; the act hop carried pressed #t;
//         the worker retired and left one run row
// sre: does a three-step playbook leave a record an on-call can read step by step, with a receipt on every row?
test('a three-step playbook runs end to end: 3 step rows, 3 receipts, 2 grade forms, 1 served row, exit 0 pass', async () => {
  const { h, s } = makeSup()
  const io = stubs(h, { answer: (kind, d) => (d.op === 'files' ? { exit: 0, rows: [{ path: 'a' }, { path: 'b' }] } : { exit: 0, moved: d.args[0] }), mind: () => ({ text: 'two files, both scratch', certainty: 0.91, box: { model: 'gemma-1b', instance: 'sentry/1b@4' } }) })
  const pb = await load('three')
  assert.equal(pb.state, 'ready', pb.faults.map((f) => f.why).join('; '))
  const r = await runPlaybook(s, pb, { io, bindings: { 1: ['/scratch'], 2: ['/scratch/a'] } })
  assert.deepEqual([r.ok, r.exit, r.outcome], [true, 0, 'pass'], r.why)
  const w = s.workers.get(r.run)
  const c = rec(w)
  assert.deepEqual(c.steps.map((x) => [x.n, x.status, x.ticket]), [[1, 'done', 'rc-1'], [2, 'done', 'rc-2'], [3, 'done', 'rc-3']])
  assert.match(c.steps[0].text, /^hand files \/scratch → exit 0 in 0 ms \(step 1\)$/)
  assert.deepEqual([c.state, c.exit, c.outcome, w.state], ['done', 0, 'pass', 'retired'])
  assert.deepEqual(r.receipts.map((x) => [x.id, x.kind, x.status, x.exit]), [['rc-1', 'read', 'done', 0], ['rc-2', 'act', 'done', 0], ['rc-3', 'mind', 'done', 0]])
  assert.deepEqual(r.grades, [{ step: 1, receipts_closed: 1, receipts_open: 0, refused: 0, on_task: true }, { step: 2, receipts_closed: 1, receipts_open: 0, refused: 0, on_task: true }])
  assert.deepEqual(io.hops.map((x) => [x.kind, x.op, x.ticket, x.pressed, x.pressed_by, x.deadline]), [['hand', 'files', 'rc-1', false, null, 10], ['act', 'trash', 'rc-2', true, 'standing', 10]])
  assert.deepEqual(io.hops[1].args, ['/scratch/a'])
  assert.equal(io.asks.length, 1); assert.match(io.asks[0].prompt, /condense the rows to one line\nDATA: /); assert.equal(io.asks[0].jobClass, 'condense')
  assert.equal(io.lines.length, 1)
  const [served] = readForms(io.lines[0])
  assert.equal(served[0].name, 'served')
  assert.deepEqual(dataToJson(served[1]), { job: 'condense', mind: 'gemma-1b', ms: 0, result: 'pass', instance: 'sentry/1b@4', at: dataToJson(served[1]).at })
  assert.equal(typeof dataToJson(served[1]).at, 'number')
  assert.equal(r.served, 1)
  assert.equal(h.rows.length, 1, 'one run row'); assert.match(h.rows[0], /\("outcome" "pass"\) \("exit" 0\) \("checked-by" "foreman"\) \("rounds" 3\) \("kicks" 0\) \("swaps" 0\) \("hands" 1\)/)
  assert.equal(w.pending.length, 0, 'every ticket closed')
})

// spec: design §17 exit 15 · UNITS §0.3 (every step has a deadline) · F-01
// class: W (a deadline missed: the hands answer after the step's seconds)
// technique: fault injection: the hands stub moves the fake clock past the deadline before it answers exit 0
// method: the receipt is exit 15 though the reply said 0; the step row says "over 10 s"; the run ends exit 15 fail; the later
//         steps are recorded skipped, never run (one hop only)
// sre: if a read comes back late, is the step a failure on the record rather than a late success?
test('a step past its deadline-s fails with exit 15 and the playbook stops there', async () => {
  const { h, s } = makeSup()
  const io = stubs(h, { answer: () => { h.tick(11); return { exit: 0, rows: [] } } })
  const r = await runPlaybook(s, await load('three'), { io })
  assert.deepEqual([r.ok, r.exit, r.outcome], [false, 15, 'fail'])
  assert.match(r.why, /^step 1 files failed \(exit 15, rc-1\)$/)
  const c = rec(s.workers.get(r.run))
  assert.deepEqual(c.steps.map((x) => [x.n, x.status, x.ticket]), [[1, 'failed', 'rc-1'], [2, 'skipped', null], [3, 'skipped', null]])
  assert.match(c.steps[0].text, /exit 15 \(over 10 s\) in 11000 ms \(step 1\)/)
  assert.equal(io.hops.length, 1, 'nothing after the failed step went out')
  assert.deepEqual([c.exit, c.outcome, c.state], [15, 'fail', 'failed'])
})

// spec: README "refuse an unknown unit with exit 12" · MINDS §5.3 (a tool-call error: refused by form, counted, never retried) · F-02
// class: E (a prose step: "restore to scratch from the verify's clone")
// technique: the `unknown` fixture through the loader, then through the runner
// method: the loader marks it refused with exit 12 and one fault naming step 2 and the unit; the runner spawns nothing and
//         answers exit 12 with the same sentence
// sre: can a prose step ever reach the hands? (no: it never loads)
test('an unknown unit is refused at load with exit 12 and a sentence naming the step; the runner spawns nothing', async () => {
  const { s } = makeSup()
  const pb = await load('unknown')
  assert.deepEqual([pb.state, pb.exit, pb.unresolved], ['refused', 12, ["restore to scratch from the verify's clone"]])
  assert.equal(pb.faults.length, 1)
  assert.deepEqual([pb.faults[0].playbook, pb.faults[0].step, pb.faults[0].unit], ['unknown', 2, "restore to scratch from the verify's clone"])
  assert.match(pb.faults[0].why, /^step 2: the unit "restore to scratch from the verify's clone" is not in the unit table/)
  const r = await runPlaybook(s, pb, { io: stubs() })
  assert.deepEqual([r.ok, r.exit, r.outcome, r.run], [false, 12, 'fail', null]); assert.match(r.why, /playbook unknown is refused: step 2/)
  assert.equal(s.workers.size, 0, 'nothing spawned')
})

// spec: playbook-run.mjs header "nothing acts in shadow" · MINDS §5.1 (an act waits for the press) · law 4 (acts are effects, press-gated)
// class: M (an effect that must not happen) · L (the `would` row)
// technique: the `shadow` fixture (type check → shadow by default) with a read that returns two rows and an act per row
// method: the hands stub sees one hop (the read) and no act; the contract has two `would` rows with rc-shadow-1 and rc-shadow-2
//         naming the unit and the row; the run passes (a `would` counts as closed); with `shadow: false` the acts go out
// sre: can a Check-type playbook touch the box before the owner pressed it?
test('shadow: a Check type sends no act — a would row and rc-shadow-<n> instead; pressed, the act goes out', async () => {
  const { h, s } = makeSup()
  const io = stubs(h, { answer: () => ({ exit: 0, rows: [{ path: 'a' }, { path: 'b' }] }) })
  const pb = await load('shadow')
  const r = await runPlaybook(s, pb, { io })
  assert.deepEqual([r.shadow, r.ok, r.exit, r.outcome], [true, true, 0, 'pass'])
  assert.deepEqual(io.hops.map((x) => x.kind), ['hand'], 'no act reached the hands')
  const c = rec(s.workers.get(r.run))
  assert.deepEqual(c.steps.map((x) => [x.status, x.ticket]), [['done', 'rc-1'], ['would', 'rc-shadow-1'], ['would', 'rc-shadow-2']])
  assert.equal(c.steps[1].text, 'act trash {"path":"a"} (step 2)')
  assert.deepEqual(r.receipts.filter((x) => x.status === 'would').map((x) => x.id), ['rc-shadow-1', 'rc-shadow-2'])
  const io2 = stubs(h, { answer: () => ({ exit: 0, rows: [{ path: 'a' }] }) })
  const r2 = await runPlaybook(s, pb, { io: io2, shadow: false, pressed: true })
  assert.deepEqual([r2.shadow, r2.outcome, io2.hops.map((x) => [x.kind, x.pressed, x.pressed_by])], [false, 'pass', [['hand', false, null], ['act', true, 'owner']]])
})

// spec: the brief "(when "any step fails") runs only on a failure" · MINDS §5.3 (code yellow: the done-check fails a step, a record)
// class: E (the hands answer exit 30) · L (the arm's row and the final exit)
// technique: the `arm` fixture twice: the act fails (exit 30) once, holds once
// method: on the failure the arm (step 3, a read) runs and is `done`; step 4 is skipped after the failure; the run ends exit 30
//         fail with "the failure arm ran"; on the success the arm is `skipped: no step failed` and never hops
// sre: when a mitigation fails, does the playbook run its fallback step and still record the failure as a failure?
test('a (when "any step fails") step runs only after a failure, and the run still ends with the failure\'s exit', async () => {
  const { h, s } = makeSup()
  const io = stubs(h, { answer: (kind, d) => (d.op === 'trash' ? { exit: 30, why: 'the child died' } : { exit: 0, rows: [] }) })
  const pb = await load('arm')
  const r = await runPlaybook(s, pb, { io })
  assert.deepEqual([r.exit, r.outcome], [30, 'fail']); assert.match(r.why, /^step 2 trash failed \(exit 30, rc-2\); the failure arm ran$/)
  const c = rec(s.workers.get(r.run))
  assert.deepEqual(c.steps.map((x) => [x.n, x.status, x.ticket]), [[1, 'done', 'rc-1'], [2, 'failed', 'rc-2'], [3, 'done', 'rc-3'], [4, 'skipped', null]])
  assert.match(c.steps[3].text, /after step 2 failed/)
  assert.deepEqual(io.hops.map((x) => x.op), ['files', 'trash', 'port'])
  const io2 = stubs(h, { answer: () => ({ exit: 0, rows: [] }) })
  const r2 = await runPlaybook(s, pb, { io: io2 })
  assert.deepEqual([r2.exit, r2.outcome, io2.hops.map((x) => x.op)], [0, 'pass', ['files', 'trash']])
  const c2 = rec(s.workers.get(r2.run))
  assert.match(c2.steps[2].text, /the failure arm; no step failed/)
  assert.match(c2.steps[3].text, /when "P0" does not hold/)
})

// spec: MINDS §5.2 (branching ≤ 3 plus "ask"; "the desk decides only bindings and the named judgment points") · UNITS §2 cart 1 (per alert → P0 → page)
// class: J (the named conditions, as code) · L (the want row, waiting-owner)
// technique: the `route` fixture: a read with three rows, an act per row, an ask when the last row is P0
// method: `each` runs the act three times (rc-2..rc-4, the row as the first argument); `when "P0"` reads the previous result's
//         priority; the ask writes a want row, an upstream ask, a press ticket with no deadline, and the run pauses waiting-owner
//         with no exit; `holds` answers each named condition and refuses one that is not named
// sre: when a playbook reaches a step only the owner may take, does it stop and ask, with the record saying where it stands?
test('each iterates the previous rows, when reads the row\'s priority, and ask pauses the run as waiting-owner with a want row', async () => {
  const { h, s } = makeSup()
  const rows = [{ path: 'a', priority: 'P3' }, { path: 'b', priority: 'P1' }, { path: 'c', priority: 'P0' }]
  const io = stubs(h, { answer: (kind, d) => (d.op === 'files' ? { exit: 0, rows } : { exit: 0, moved: d.args[0].path, priority: d.args[0].priority }) })
  const pb = await load('route')
  const r = await runPlaybook(s, pb, { io })
  assert.deepEqual([r.ok, r.exit, r.outcome], [true, null, 'waiting-owner'])
  assert.deepEqual(io.hops.filter((x) => x.kind === 'act').map((x) => [x.ticket, x.args[0].path]), [['rc-2', 'a'], ['rc-3', 'b'], ['rc-4', 'c']])
  const w = s.workers.get(r.run)
  const c = rec(w)
  assert.deepEqual(c.steps.map((x) => [x.status, x.ticket]), [['done', 'rc-1'], ['done', 'rc-2'], ['done', 'rc-3'], ['done', 'rc-4'], ['waiting', 'rc-5']])
  assert.deepEqual([c.state, c.exit, w.state], ['waiting-owner', null, 'running'])
  assert.deepEqual(r.wants, [{ step: 3, receipt: 'rc-5', what: 'a P0 needs the owner', at: h.now() }])
  assert.deepEqual(w.pending.map((t) => [t.ticket, t.kind, t.deadline_at]), [['rc-5', 'press', null]], 'a press ticket with no deadline keeps the zombie law off')
  assert.deepEqual(h.up.filter((u) => u.kind === 'ask').map((u) => [u.data.what, u.data.ticket, u.data.step]), [['a P0 needs the owner', 'rc-5', 3]])
  assert.equal(r.grades.length, 2)
  const st = { prev: { ok: false, status: 503, rows: [1, 2, 3, 4], under_line: true, breached: true, priority: 'P2' }, prevExit: 15 }
  assert.deepEqual(WHEN.filter((x) => x !== 'any step fails').map((x) => holds(x, st)), [false, true, false, false, false, true, true, true, true, false, false, false, false])
  assert.deepEqual(['unhealthy', 'expiring', 'stale', 'flapping'].map((x) => holds(x, { prev: { unhealthy: true, expiring: true, stale: true, flapping: true } })), [true, true, true, true])
  assert.deepEqual([holds('pass', { prevExit: 0 }), holds('up', { prev: { ok: true, status: 200 } }), holds('P0', st, { priority: 'P0' })], [true, true, true])
  assert.throws(() => holds('weekly', st), /not one of the named conditions/)
  assert.match(doneCheck(pb, { receipts: [] }).why, /step\(s\) 1 never ran/)
})

// spec: playbook.mjs header (what the loader refuses: a second form, a field outside the form, an out-of-order step, a mind not declared)
// class: E (malformed trees) · B (the id must be the file name)
// technique: five bad trees written to scratch, read through the loader
// method: each tree is refused with the sentence that names what to fix; a tree that is not slat data is refused, never thrown
// sre: can a typo in a playbook's field pass silently? (no: every unknown field is a fault)
test('the loader refuses a malformed tree with a sentence: two forms, an unknown field, an undeclared mind, an out-of-order step, not data', async () => {
  fs.mkdirSync('/private/tmp/lacuna-unit', { recursive: true })
  const dir = fs.mkdtempSync('/private/tmp/lacuna-unit/P-')
  const put = (name, text) => fs.writeFileSync(path.join(dir, `${name}.slat`), text)
  put('two', '(playbook (id "two") (version 1) (cart "c") (type "t") (steps (step 1 (unit "files")))) (playbook)')
  put('field', '(playbook (id "field") (version 1) (cart "c") (type "t") (colour "blue") (steps (step 1 (unit "files"))))')
  put('mind', '(playbook (id "mind") (version 1) (cart "c") (type "t") (steps (step 1 (unit "gist"))))')
  put('order', '(playbook (id "order") (version 1) (cart "c") (type "t") (may files) (steps (step 2 (unit "files")) (step 1 (unit "files") (when "weekly"))))')
  put('data', '(playbook (id "data") #(1 2))')
  put('named', '(playbook (id "other") (version "1") (cart "c") (type "t") (may files) (steps (step 1 (unit "files"))))')
  const r = await loadPlaybooks(dir, { units: UNITS })
  const why = Object.fromEntries(r.playbooks.map((p) => [p.id, p.faults.map((f) => f.why)]))
  assert.match(why.two[0], /exactly one \(playbook …\) form, this one holds 2/)
  assert.match(why.field[0], /\(colour …\) is not one of id version cart type steps/)
  assert.match(why.mind[0], /the unit "gist" is not in the unit table/)
  assert.deepEqual(why.order, ['step 1: (when "weekly") is not one of the named conditions: "pass" "down" "up" "P0" "P1" "P2+" "under the line" "bundles > 3" "budget breached" "any step fails" "unhealthy" "expiring" "stale" "flapping"', 'step 1 is out of order (after 2)'])
  assert.match(why.data[0], /does not read as slat data/)
  assert.deepEqual(why.named, ['the id "other" is not the file name named', '(version …) holds one number'])
  assert.ok(r.playbooks.every((p) => p.state === 'refused' && p.exit === 12))
  assert.deepEqual(playbookRows(r.playbooks).map((x) => x.state), Array(6).fill('refused'))
  fs.rmSync(dir, { recursive: true, force: true })
})

// spec: design §5.1 (the hop to the hands, signed both ways) · MINDS §4.3 (`served.slat` in the ledger) · law 5 (one reader)
// class: W (the hands absent: no socket) · L (the served ledger on disk)
// technique: the runner's DEFAULT io (no stub): a scratch hands daemon on a Unix socket that opens the signed hop and answers a signed
//            result; the served row to $LACUNA_LEDGER_DIR; then the same run against a socket nobody listens on
// method: the three-step run passes through the real hands-link with the ticket rc-1 on the wire and the act pressed; served.slat holds
//         one row that reads back as data; with no hands the first step is exit 15 "the hands did not answer" and the run fails
// sre: with the hands up, does a playbook's hop go out signed and come back as the receipt; with the hands down, does it fail closed?
test('the default io: a signed hop to a scratch hands socket, the served row on disk, and exit 15 when no hands answer', async (t) => {
  const KEY = 'p'.repeat(32)
  const dir = fs.mkdtempSync('/private/tmp/lacuna-unit/P-io-')
  const sock = path.join(dir, 'h.sock')
  const seen = []
  const gate = new Gate(KEY, () => Date.now() / 1000)
  const srv = http.createServer((req, res) => {
    let text = ''; req.setEncoding('utf8'); req.on('data', (d) => { text += d })
    req.on('end', () => {
      const got = gate.open({ slat: text, sig: req.headers['x-slat-sig'] }); seen.push(got.ok ? { kind: got.msg.kind, ...got.msg.body } : { dropped: got.drop })
      const env = seal(KEY, { from: 'hands', to: 'foreman', kind: 'result', body: { ticket: got.msg.body.ticket, exit: 0, ms: 2, rows: [{ path: 'a' }] }, at: Date.now() / 1000 })
      res.writeHead(200, { 'Content-Type': 'application/slat', 'X-Slat-Sig': env.sig }); res.end(env.slat)
    })
  })
  await new Promise((r) => srv.listen(sock, r))
  const was = process.env.LACUNA_LEDGER_DIR; process.env.LACUNA_LEDGER_DIR = dir
  t.after(() => { srv.closeAllConnections?.(); srv.close(); fs.rmSync(dir, { recursive: true, force: true }); if (was == null) delete process.env.LACUNA_LEDGER_DIR; else process.env.LACUNA_LEDGER_DIR = was })
  const { h, s } = makeSup({ key: KEY, mind: async () => ({ text: 'one line', box: { model: 'gemma-1b', instance: 'i-1' } }) })
  h.now = () => Date.now() / 1000
  const pb = await load('three')
  const r = await runPlaybook(s, pb, { hands: { sock, key: KEY }, bindings: { 2: ['/scratch/a'] } })
  assert.deepEqual([r.exit, r.outcome], [0, 'pass'], r.why)
  assert.deepEqual(seen.map((x) => [x.kind, x.op, x.ticket, x.pressed, x.tier, x.deadline]), [['hand', 'files', 'rc-1', false, 'J0', 10], ['act', 'trash', 'rc-2', true, 'J1', 10]])
  const lines = fs.readFileSync(path.join(dir, 'served.slat'), 'utf8').trim().split('\n')
  assert.equal(lines.length, 1); assert.deepEqual(dataToJson(readForms(lines[0])[0][1]), { job: 'condense', mind: 'gemma-1b', ms: dataToJson(readForms(lines[0])[0][1]).ms, result: 'pass', instance: 'i-1', at: dataToJson(readForms(lines[0])[0][1]).at })
  const r2 = await runPlaybook(s, pb, { hands: { sock: path.join(dir, 'nobody.sock'), key: KEY } })
  assert.deepEqual([r2.exit, r2.outcome], [15, 'fail']); assert.match(r2.why, /^step 1 files failed \(exit 15, rc-1\)$/)
  assert.match(rec(s.workers.get(r2.run)).steps[0].text, /^hand files → exit 15 in \d+ ms \(step 1\)$/)
})

// spec: design §6 change 5 / F-08 (an act waits on the owner's press; never re-sent) · law 4 (press-gated)
// class: L (the want row, the press ticket) · M (an effect held)
// technique: the hands stub answers `waiting` for the unpressed act of a `press "none"` tree run live (shadow off)
// method: the step row is `waiting` with its receipt; a want row names the press; the ticket stays pending as a `press` with no
//         deadline (closeTicket's rule); the run pauses waiting-owner with no exit
// sre: when the owner has not pressed, does the act hold and the record say it is waiting on a person?
test('an act the hands hold for the press pauses the run as waiting-owner with a want row and a press ticket', async () => {
  const { h, s } = makeSup()
  const io = stubs(h, { answer: (kind, d) => (kind === 'act' ? { exit: null, waiting: 'the owner' } : { exit: 0, rows: [{ path: 'a' }] }) })
  const r = await runPlaybook(s, await load('shadow'), { io, shadow: false })
  assert.deepEqual([r.exit, r.outcome, r.ok], [null, 'waiting-owner', true])
  const w = s.workers.get(r.run)
  assert.deepEqual(rec(w).steps.map((x) => [x.status, x.ticket]), [['done', 'rc-1'], ['waiting', 'rc-2']])
  assert.deepEqual(r.wants.map((x) => [x.step, x.receipt, x.what]), [[2, 'rc-2', 'press trash (the owner)']])
  assert.deepEqual(w.pending.map((x) => [x.ticket, x.kind, x.deadline_at, x.waiting]), [['rc-2', 'press', null, 'the owner']])
  assert.deepEqual([rec(w).state, w.state], ['waiting-owner', 'running'])
})

// spec: playbook.mjs header (a worker verb resolves in the table) · playbook-run.mjs header (a verb unit has no runner: exit 12) · F-02
// class: E (refused by form at run time, counted, never retried)
// technique: the `verb` fixture: step 1 is `report`
// method: the loader admits it (the table holds every worker verb); the runner refuses step 1 with exit 12 and the sentence, the act
//         after it is skipped, the run fails exit 12; a runner fault is exit 30 crashed
// sre: can a playbook step call a cart verb the runner cannot run? (it loads, and the first run says so in one row)
test('a worker verb as a unit loads but is refused at run with exit 12 and a sentence', async () => {
  const { h, s } = makeSup()
  const io = stubs(h)
  const pb = await load('verb')
  assert.equal(pb.state, 'ready'); assert.equal(pb.steps[0].kind, 'verb')
  const r = await runPlaybook(s, pb, { io })
  assert.deepEqual([r.exit, r.outcome, io.hops.length], [12, 'fail', 0])
  const c = rec(s.workers.get(r.run))
  assert.deepEqual(c.steps.map((x) => [x.status, x.ticket]), [['refused', 'rc-1'], ['skipped', null]])
  assert.equal(c.steps[0].text, 'report: the verb unit report has no runner in a playbook (exit 12) (step 1)')
  // a fault inside the runner itself (here: a binding that throws) is exit 30 on the record, never an unhandled rejection
  const r3 = await runPlaybook(s, pb, { io, bindings: new Proxy({}, { get() { throw new Error('bad binding') } }) })
  assert.deepEqual([r3.exit, r3.outcome, r3.why], [30, 'fail', 'crashed: bad binding'])
})

// playbook.mjs:61-63 — the fallback when the jail refuses the import of lacuna-executor (reads from capabilities.mjs HAND_READS, no acts).
// The owner rules how the hands' catalogue reaches the foreman under foreman.sb (a hop, or the jail's word); until then the arm is
// reached only on the box, never in a test that can import the module.
test.todo('playbook.mjs:61-63 — the unit table when foreman.sb refuses lacuna-executor (the owner rules the road: a hop or the jail)')

// spec: MINDS §7.1 a small mind answers under a form · lane U3's mail 2026-10-24 (playbook mind units sent grammar null)
// technique: read the loaded trees' minds; a yes-no job and a signal->label job carry labels, a condense job does not
// method: loadPlaybooks over the repo's 25; the runner's request grammar is built from m.labels (mindGrammar) — asserted by shape here
test('a labelled job (yes-no, signal->label) carries its label set and the runner asks under a grammar; condense stays prose', async () => {
  const { loadPlaybooks, JOB_LABELS } = await import('../playbook.mjs')
  const { mindGrammar } = await import('../grammar.mjs')
  const { playbooks } = await loadPlaybooks(REPO_PLAYBOOKS)
  const disk = playbooks.find((p) => p.id === 'disk-line'); const day = playbooks.find((p) => p.id === 'day-report'); const conf = playbooks.find((p) => p.id === 'conformance-nightly')
  assert.deepEqual(disk.minds.janitor.labels, JOB_LABELS['yes-no'])
  assert.deepEqual(conf.minds.triage.labels, JOB_LABELS['signal->label'])
  assert.equal(day.minds.gist.labels, null)
  assert.match(mindGrammar({ name: 'janitor', verbs: new Set(), labels: disk.minds.janitor.labels }), /label ::= "'yes" \| "'no"/)
})

// spec: R1.4 "the grid decides who decides" · class: E · technique: the routed fixture (a mind job naming swe/systems-code L4 and a budget)
// over a grid with one passing E4B cell behind the host's routeFiles seam · method: the mind request carries the cell's tag; without the
// cell the stub's default stands · sre: when the record says who passed, does the runner send the job there?
test('a mind job that names its role and function goes to the mind whose grid cell passes; without a cell the old choice stands', async () => {
  const { cellLine } = await import('../grid-ledger.mjs')
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'routed-'))
  const grid = path.join(d, 'grid.slat'); const box = path.join(d, 'box.slat')
  fs.writeFileSync(grid, '(grid (version 2))\n' + cellLine({ mind: 'e4b', role: 'swe', function: 'systems-code', level: 'L4', sitting: { form: 'sitting', pass: 0.94, n: 30, lb90: 0.94, at: '2026-10-30', source: 's.json' } }) + '\n')
  fs.writeFileSync(box, '(mind (id e4b) (tag "gemma4:e4b-it-qat") (seat pool) (file-mb 4916) (use-mb 6474))\n(mind (id e2b) (tag "gemma4:e2b-it-qat") (seat pool) (file-mb 3200) (use-mb 3600))\n')
  const pb = await load('routed')
  assert.equal(pb.state, 'ready', pb.faults.map((f) => f.why).join('; '))
  assert.deepEqual([pb.minds.gist.role, pb.minds.gist.function, pb.minds.gist.budget], ['swe', 'systems-code', { in: 4096, out: 256 }])
  const { h, s } = makeSup({ routeFiles: () => ({ grid, box }), memory: () => ({ availMB: 20000 }), loadedMinds: () => [], brainNow: () => 'e4b' })
  const io = stubs(h, { answer: (kind, d) => (d.op === 'files' ? { exit: 0, rows: [{ path: 'a' }] } : { exit: 0, moved: d.args[0] }), mind: () => ({ text: 'one line', certainty: 0.9 }) })
  const r = await runPlaybook(s, pb, { io, bindings: { 1: ['/scratch'], 2: ['/scratch/a'] } })
  assert.deepEqual([r.ok, r.exit], [true, 0], r.why)
  assert.equal(io.asks.length, 1)
  assert.equal(io.asks[0].model, 'gemma4:e4b-it-qat', 'the passing cell names the mind')
  fs.writeFileSync(grid, '(grid (version 2))\n')
  const again = makeSup({ routeFiles: () => ({ grid, box }), memory: () => ({ availMB: 20000 }), loadedMinds: () => [], brainNow: () => 'e4b' })
  const io2 = stubs(again.h, { answer: (kind, d) => (d.op === 'files' ? { exit: 0, rows: [{ path: 'a' }] } : { exit: 0, moved: d.args[0] }), mind: () => ({ text: 'one line', certainty: 0.9 }) })
  await runPlaybook(again.s, await load('routed'), { io: io2, bindings: { 1: ['/scratch'], 2: ['/scratch/a'] } })
  assert.equal(io2.asks[0].model, 'gemma4:e2b-it-qat', 'no cell: the smallest rung holding the budget, advice only')
})

