// playbook-handoff.test.mjs — U1 unit tests for the playbook runner's router road (K1.13): a mind step no mind can hold is a
// `(handoff …)` row and is never attempted; the first classed step the router's mind took is the run's class, which the
// grid ledger counts at the run row through the host's `onRunRow`.
// owns: the proofs that a step over every proven size, or one no mind can load in the free memory, is handed off (exit 12,
//   exit 89), not asked, not a failure (the run ends `stopped`, the failure arm does not run), and that a sealed run with a
//   class is one `(grid-run …)` row in a scratch ledger.
// refuses: the live hands, the live mind, ~/lacuna-world (the grid, the box profile and the ledger are scratch files); a
//   mock of playbook-run.mjs, router.mjs, runs.mjs or grid-ledger.mjs. The hands and the mind are stubs behind `io`.
// implements: ROLEBENCH-2.0 §5.1 (nobody yet: the queue, with the why), §5.3 (the handoff); R1.3 (the run row moves a cell);
//   SENTRY-2.0 §6 (a step larger than the mind's proven size is never attempted).
// invariants: "a step larger than the mind's proven size is never attempted"; "a claim is not a record" (the row is the record).
// faults: F-02 (a refused unit, exit 12); F-05 (no room, exit 89).
// coverage: playbook-run.mjs — the mind step's handoff and class branches (2026-10-31, with playbook.test.mjs)
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadPlaybooks } from '../playbook.mjs'
import { runPlaybook } from '../playbook-run.mjs'
import { readHandoff } from '../runs.mjs'
import { cellLine, onRunRow, gridLedger, readGridLedger } from '../grid-ledger.mjs'
import { Supervisor } from '../supervisor.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROUTED = fs.readFileSync(path.join(HERE, 'fixtures', 'playbooks', 'routed', 'routed.slat'), 'utf8')
const UNITS = { reads: ['files', 'port'], acts: ['trash'] }
const BINDINGS = { 1: ['/scratch'], 2: ['/scratch/a'], 4: ['1139'] }

/** A fake host (the playbook.test.mjs shape): clock, ids, and every upstream, contract text and ledger row captured. */
function makeSup(extra = {}) {
  let t = 1000, n = 0
  const h = { up: [], rows: [], now: () => t, id: () => `w${++n}`, save: () => {}, deadlines: { hand: 10, act: 40, beat: 5, mind: 20, hop: 50 },
              upstream: (kind, w, data) => h.up.push({ kind, name: w.name, data }), contract: () => {}, mail: () => {}, mailCount: () => {},
              ledger: (text) => h.rows.push(text), ...extra }
  return { h, s: new Supervisor(h) }
}
/** The hands and the mind as stubs; every hop and every ask recorded. */
function stubs() {
  const hops = [], asks = []
  return { hops, asks,
    hands: async (x) => { hops.push({ kind: x.kind, ...x.data }); const r = x.data.op === 'files' ? { exit: 0, rows: [{ path: 'a' }] } : { exit: 0, moved: x.data.args?.[0] }; return { ...r, ticket: x.data.ticket, op: x.data.op, ok: true } },
    mind: async (req) => { asks.push(req); return { text: 'one line', certainty: 0.9 } },
    served: () => {} }
}
/** A scratch copy of the routed fixture with the mind's budget replaced and, optionally, a failure arm as step 4. */
async function routedWith(budget, { arm = false } = {}) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-'))
  let text = ROUTED.replace('(budget 4096 256)', `(budget ${budget})`)
  if (arm) text = text.replace('(may files trash)', '(may files trash port)')
    .replace('(done "one line"))\n', '(done "one line"))\n    (step 4 (unit "port") (args "(1139)") (deadline-s 5) (done "listening") (when "any step fails"))\n')
  fs.writeFileSync(path.join(d, 'routed.slat'), text)
  const pb = (await loadPlaybooks(d, { units: UNITS })).playbooks[0]
  assert.equal(pb.state, 'ready', pb.faults.map((f) => f.why).join('; '))
  return { d, pb }
}
const scratchFiles = (d, boxText) => {
  const grid = path.join(d, 'grid.slat'); const box = path.join(d, 'box.slat')
  fs.writeFileSync(grid, '(grid (version 2))\n'); fs.writeFileSync(box, boxText)
  return { grid, box }
}

// spec: ROLEBENCH-2.0 §5.1 (nobody yet: the queue, with the why), §5.3 · SENTRY-2.0 §6
// class: L5 the ledger row's shape (the handoff row) · E8 a deadline passed (no: the step is never sent)
// technique: the routed fixture with a budget of 100,000 tokens in, over every rung's proven size, and a failure arm as step 4
// method: the mind is never asked; one (handoff …) row reads back from router to queue at step 3 with the why and step 2's value as
//         its partial; the step is refused with exit 12; the run ends stopped (not fail) and the failure arm's hop is never sent
// sre: if a playbook asks a small mind for work no mind on the box can hold, does the foreman stop and say why instead of letting it guess?
test('a step over every proven size is handed off to the queue: never asked, exit 12, the run stopped, the failure arm not run', async () => {
  const { d, pb } = await routedWith('100000 256', { arm: true })
  try {
    const files = scratchFiles(d, '(mind (id e4b) (tag "gemma4:e4b-it-qat") (seat pool) (file-mb 4916) (use-mb 6474))\n')
    const { h, s } = makeSup({ routeFiles: () => files, memory: () => ({ availMB: 20000 }), loadedMinds: () => [], brainNow: () => 'e4b' })
    const io = stubs()
    const r = await runPlaybook(s, pb, { io, bindings: BINDINGS })
    assert.equal(io.asks.length, 0, 'the mind is never asked')
    assert.deepEqual([r.outcome, r.exit], ['stopped', 12], r.why)
    assert.match(r.why, /^step 3 handed off to queue \(rc-3\): no mind holds step 3's budget \(100000 in, 256 out\)/)
    assert.deepEqual(io.hops.map((x) => x.op), ['files', 'trash'], 'the failure arm (port) is not sent: a handoff is not a failure')
    const rows = h.rows.filter((x) => x.startsWith('(handoff '))
    assert.equal(rows.length, 1)
    const hr = readHandoff(rows[0])
    assert.deepEqual([hr.from, hr.to, hr.step], ['router', 'queue', 3])
    assert.match(hr.why, /no mind holds step 3's budget/)
    assert.equal(hr.partial.moved, '/scratch/a', 'the partial is what the run had done: step 2\'s value')
    assert.match(hr.at, /^lacuna:\//)
    assert.equal(r.receipts[2].status, 'refused')
    assert.match(r.steps.find((x) => x.status === 'refused').text, /^mind gist: handed off to queue, not attempted — /)
    assert.ok(h.up.some((u) => u.kind === 'handoff' && u.data.to === 'queue'), 'the floor hears the handoff')
    // the control: the same tree with a budget a mind holds and a mind that fails does run the arm, so the assertion above can fail
    const ctl = await routedWith('4096 256', { arm: true })
    const c = makeSup({ routeFiles: () => files, memory: () => ({ availMB: 20000 }), loadedMinds: () => [], brainNow: () => 'e4b' })
    const failing = { ...stubs(), mind: async () => { throw new Error('the mind timed out') } }
    const failed = await runPlaybook(c.s, ctl.pb, { io: failing, bindings: BINDINGS })
    assert.equal(failed.outcome, 'fail', failed.why)
    assert.deepEqual(failing.hops.map((x) => x.op), ['files', 'trash', 'port'], 'a failed mind step runs the failure arm')
    fs.rmSync(ctl.d, { recursive: true, force: true })
  } finally { fs.rmSync(d, { recursive: true, force: true }) }
})

// spec: ROLEBENCH-2.0 §5.1 (residency is a price), §5.3 · design §17 (exit 89: no room)
// class: M6 memory pressure (the minds that hold the budget cannot load in the free memory)
// technique: a budget of 20,000 tokens in (only the 12B, 26B and 31B hold it) against a box profile pricing each above 4,000 MB free
// method: the router finds three candidates and no admissible one; the step is handed off with exit 89 and the price on the why
// sre: when the box is full, does a step that needs a bigger mind wait in the queue with the price named instead of evicting the desk?
test('a step only minds the free memory cannot load can hold is handed off with exit 89 and the price on the why', async () => {
  const { d, pb } = await routedWith('20000 256')
  try {
    const files = scratchFiles(d, ['(mind (id 12b) (tag "gemma3:12b-it-qat") (seat pool) (file-mb 8900) (use-mb 9000))',
      '(mind (id 26b) (tag "gemma4:26b-a4b-it-qat") (seat brain) (file-mb 15600) (use-mb 17000))',
      '(mind (id 31b) (tag "gemma4:31b-it-qat") (seat pool) (file-mb 19000) (use-mb 20000))'].join('\n') + '\n')
    const { h, s } = makeSup({ routeFiles: () => files, memory: () => ({ availMB: 4000 }), loadedMinds: () => [], brainNow: () => 'e4b' })
    const io = stubs()
    const r = await runPlaybook(s, pb, { io, bindings: BINDINGS })
    assert.equal(io.asks.length, 0)
    assert.deepEqual([r.outcome, r.exit], ['stopped', 89], r.why)
    const hr = readHandoff(h.rows.find((x) => x.startsWith('(handoff ')))
    assert.match(hr.why, /^nothing fits: 12b needs 9000 MB, 26b needs 17000 MB, 31b needs 20000 MB against 4000 MB free/)
  } finally { fs.rmSync(d, { recursive: true, force: true }) }
})

// spec: R1.3 (a run row moves a cell: a sealed run is a grid row in its class) · ROLEBENCH-2.0 §5.2 (the run's why carries the cell)
// class: L5 the ledger row's shape (the grid's ledger half)
// technique: the routed fixture over a grid with one passing E4B cell; the host's onRunRow is grid-ledger.mjs's own, over a scratch ledger
// method: the run passes; the playbook worker carries the class (swe/systems-code L4, the e4b, 4,352 tokens); the run row reaches
//         the grid ledger as one chained (grid-run …) row; a run whose mind step names no class leaves the ledger empty
// sre: when a mind does classed work and the done-check seals it, does the grid's live rate see that run?
test('a sealed run whose step the router classed is one (grid-run …) row; an unclassed run is none', async () => {
  const { d, pb } = await routedWith('4096 256')
  try {
    const files = scratchFiles(d, '(mind (id e4b) (tag "gemma4:e4b-it-qat") (seat pool) (file-mb 4916) (use-mb 6474))\n')
    fs.writeFileSync(files.grid, '(grid (version 2))\n' + cellLine({ mind: 'e4b', role: 'swe', function: 'systems-code', level: 'L4', sitting: { form: 'sitting', pass: 0.94, n: 30, lb90: 0.94, at: '2026-10-30', source: 's.json' } }) + '\n')
    const ledgerFile = path.join(d, 'ledger', 'grid.slat')
    const ledger = gridLedger(ledgerFile)
    const heard = []
    const box = makeSup({ routeFiles: () => files, memory: () => ({ availMB: 20000 }), loadedMinds: () => [], brainNow: () => 'e4b',
                          onRunRow: (row, w) => heard.push(onRunRow(box.s, w, row, { ledger })) })
    const io = stubs()
    const r = await runPlaybook(box.s, pb, { io, bindings: BINDINGS })
    assert.deepEqual([r.outcome, r.exit], ['pass', 0], r.why)
    assert.equal(io.asks[0].model, 'gemma4:e4b-it-qat')
    assert.equal(heard.length, 1, 'the run row reached the hook once')
    assert.equal(heard[0].why, null, heard[0].why)
    const back = readGridLedger(fs.readFileSync(ledgerFile, 'utf8'))
    assert.equal(back.broken, null)
    assert.equal(back.rows.length, 1)
    assert.deepEqual([back.rows[0].mind, back.rows[0].role, back.rows[0].function, back.rows[0].level, back.rows[0].outcome, back.rows[0].tokens],
      ['e4b', 'swe', 'systems-code', 'L4', 'pass', 4352])
    // a mind step that names no role or function is not classed: its run is no grid item
    const plain = await routedWith('4096 256')
    fs.writeFileSync(path.join(plain.d, 'routed.slat'), fs.readFileSync(path.join(plain.d, 'routed.slat'), 'utf8').replace(' (role swe) (function systems-code) (budget 4096 256)', ''))
    const unclassed = (await loadPlaybooks(plain.d, { units: UNITS })).playbooks[0]
    const again = makeSup({ routeFiles: () => files, memory: () => ({ availMB: 20000 }), onRunRow: (row, w) => heard.push(onRunRow(again.s, w, row, { ledger })) })
    const r2 = await runPlaybook(again.s, unclassed, { io: stubs(), bindings: BINDINGS })
    assert.equal(r2.outcome, 'pass', r2.why)
    assert.match(heard[1].why, /the router did not class this run: no grid item/)
    assert.equal(readGridLedger(fs.readFileSync(ledgerFile, 'utf8')).rows.length, 1, 'still one row')
    fs.rmSync(plain.d, { recursive: true, force: true })
  } finally { fs.rmSync(d, { recursive: true, force: true }) }
})
