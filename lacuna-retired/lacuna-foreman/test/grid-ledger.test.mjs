// grid-ledger.test.mjs — THE GRID'S RECORD. Owns: the tests of grid-ledger.mjs: the role ladder as data (every function names
// at least one item, every item a grader, each of the ten jobs' step types once, one screen item per function); a ladder with
// a defect does not read; a cell is one sealed line that reads back only with its provenance; a hand-edited, unsealed or
// hand-promoted row is rejected with its sentence; a run row moves a cell; a live rate under 0.80 demotes a passing cell;
// the ledger's chain breaks on an edited row. Refuses: a mock of the module under test (real files under a temp folder).
import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { readRoleLadder, cellLine, readCells, standingOf, wilson, onRunRow, gridLedger, readGridLedger, foldLedger, cellKey, RULES } from '../grid-ledger.mjs'

const LADDER = readRoleLadder()

test('the role ladder: five roles, every function names an item, every item a grader (ROLEBENCH §2)', () => {
  assert.deepEqual(LADDER.roles.map((r) => r.id), ['se', 'swe', 'tpm', 'pe', 'pm'])
  const per = Object.fromEntries(LADDER.roles.map((r) => [r.id, LADDER.functions.filter((f) => f.role === r.id).length]))
  assert.deepEqual(per, { se: 7, swe: 6, tpm: 4, pe: 4, pm: 3 })
  for (const f of LADDER.functions) {
    assert.ok(f.items.length >= 1, `${f.role}/${f.id} names an item`)
    for (const it of f.items) assert.match(it.grader, /^(mechanical|rubric)$/, `${it.id} names a grader`)
    assert.ok(f.work && f.skill.length, `${f.role}/${f.id} names its work and its skill`)
  }
})

test('the ten jobs\' step types are each one item, and the screen sits one item per function', () => {
  const jobs = LADDER.functions.flatMap((f) => f.items.filter((i) => i.job != null).map((i) => i.job)).sort((a, b) => a - b)
  assert.deepEqual(jobs, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  assert.equal(new Set(LADDER.functions.map((f) => f.screen)).size, LADDER.functions.length)
})

test('a ladder with a defect does not read: a function with no item, an item with no grader, a job twice', () => {
  const head = '(role (id se) (badge "SE") (name "x") (what "y"))\n'
  assert.throws(() => readRoleLadder(head + '(function (role se) (id a) (name "a") (work "w") (skill "s") (screen x))'), /names no battery item/)
  assert.throws(() => readRoleLadder(head + '(function (role se) (id a) (name "a") (work "w") (skill "s") (item (id x) (what "q")) (screen x))'), /names no grader/)
  assert.throws(() => readRoleLadder(head + '(function (role se) (id a) (name "a") (work "w") (skill "s") (item (id x) (what "q") (grader mechanical) (job 1)) (item (id y) (what "q") (grader rubric) (job 1)) (screen x))'), /job 1's step type is named twice/)
  assert.throws(() => readRoleLadder(head + '(function (role sre) (id a) (name "a") (work "w") (skill "s") (item (id x) (what "q") (grader rubric)) (screen x))'), /names a role the ladder does not hold/)
})

const screenCell = { mind: 'e4b', role: 'swe', function: 'triage', level: 'L3',
  sitting: { form: 'screen', pass: 1, n: 1, lb90: +wilson(1, 1).toFixed(3), at: '2026-10-30T22:00:00Z', source: 'screen/2026-10-30T22-00-00Z-e4b.slat' },
  speed: { ttftMs: 640, totalMs: 4100, tps: 41.5, classifyS: 4.1, outTokens: 120, thinkTokens: 0 } }

test('a cell is one sealed line; it reads back with its provenance and its standing (advises at most from a screen)', () => {
  const line = cellLine(screenCell)
  assert.doesNotMatch(line, /\n/)
  assert.match(line, /^\(cell \(mind e4b\) \(role swe\) \(function triage\) \(level L3\) \(sitting \(form screen\) \(pass 1\) \(n 1\)/)
  assert.match(line, /\(standing advises\) \(seal "sha256:[0-9a-f]{64}"\)\)$/)
  const { cells, rejected } = readCells(line, { ladder: LADDER })
  assert.deepEqual(rejected, [])
  assert.equal(cells[0].standing, 'advises')
  assert.equal(cells[0].sitting.source, screenCell.sitting.source)
  assert.equal(cells[0].speed.classifyS, 4.1)
})

test('the reader rejects a hand-edited row, an unsealed row, a row with no provenance and a hand-promoted row', () => {
  const line = cellLine(screenCell)
  const edited = line.replace('(pass 1)', '(pass 0.5)')
  const noSeal = line.replace(/ \(seal "[^"]+"\)\)$/, ')')
  const noSource = cellLine({ ...screenCell, sitting: { ...screenCell.sitting, source: null } })
  // a careful forger re-seals the promoted line: the seal holds, the standing its numbers give does not
  const forged = line.replace(/ \(seal "[^"]+"\)\)$/, '').replace('(standing advises)', '(standing passes)')
  const promoted = `${forged} (seal "sha256:${crypto.createHash('sha256').update(forged).digest('hex')}"))`
  const { cells, rejected } = readCells([edited, noSeal, noSource, promoted].join('\n'), { ladder: LADDER })
  assert.equal(cells.length, 0)
  assert.match(rejected[0].why, /seal does not match its line: the row was edited by hand/)
  assert.match(rejected[1].why, /carries no seal/)
  assert.match(rejected[2].why, /names no provenance/)
  assert.match(rejected[3].why, /its standing passes is not what its numbers give \(advises\)/)
  const unknown = cellLine({ ...screenCell, function: 'paxos' })
  assert.match(readCells(unknown, { ladder: LADDER }).rejected[0].why, /the ladder holds no function swe\/paxos/)
})

test('the standing rule: passes at lb ≥ 0.90 and n ≥ 20; advises at lb ≥ 0.80; a screen advises at most', () => {
  const s = (k, n, form = 'ladder') => ({ sitting: { form, pass: k / n, n, lb90: wilson(k, n) } })
  assert.equal(standingOf(s(40, 40)), 'passes')
  assert.equal(standingOf(s(19, 19)), 'advises')          // lb 0.832 < 0.90 under n 20: a cell under n 20 gates nothing
  assert.equal(standingOf(s(18, 20)), 'not-sat')
  assert.equal(standingOf(s(2, 2, 'screen')), 'advises')
  assert.equal(standingOf(s(1, 2, 'screen')), 'not-sat')
  assert.equal(standingOf({}), 'not-sat')
})

const dirs = []
test.after(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }) })
function tmpLedger() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grid-ledger-'))
  dirs.push(dir)
  return path.join(dir, 'ledger', 'grid.slat')
}
const sup = { host: { now: () => 1793400000 } }
const run = (id, outcome) => [{ id, run: { class: { role: 'swe', function: 'state-machines', level: 'L4', size: { lines: 120, tokens: 3000 } } }, contract: { brain: '12b' } }, { outcome }]

test('a run row moves a cell: a sealed run is a grid row in its class; an unclassed or stopped run is none', () => {
  const file = tmpLedger(), ledger = gridLedger(file)
  const r = onRunRow(sup, ...run('w-a1', 'pass'), { ledger })
  assert.match(r.row, /^\(grid-run \(at "2026-10-30T[\d:.]+Z"\) \(run "w-a1"\) \(mind 12b\) \(role swe\) \(function state-machines\) \(level L4\) \(outcome pass\) \(lines 120\) \(tokens 3000\) \(prev "genesis"\)\)$/)
  assert.equal(onRunRow(sup, { id: 'w-a2', run: {}, contract: { brain: '12b' } }, { outcome: 'pass' }, { ledger }).row, null)
  assert.match(onRunRow(sup, ...run('w-a3', 'stopped'), { ledger }).why, /ended stopped: no grid item/)
  const { rows, broken } = readGridLedger(fs.readFileSync(file, 'utf8'))
  assert.equal(broken, null)
  const fold = foldLedger(rows)
  assert.deepEqual(fold['12b swe state-machines L4'], { pass: 1, n: 1, since: rows[0].at, lastFail: null, runs: ['w-a1'] })
  const cell = { mind: '12b', role: 'swe', function: 'state-machines', level: 'L4', ledger: fold[cellKey({ mind: '12b', role: 'swe', function: 'state-machines', level: 'L4' })] }
  const back = readCells(cellLine(cell), { ladder: LADDER })
  assert.deepEqual(back.rejected, [])
  assert.deepEqual(back.cells[0].ledger.runs, ['w-a1'])                      // a ledger-only cell's provenance is its run ids
  assert.equal(back.cells[0].standing, 'not-sat')                            // the ledger demotes; only a sitting promotes
})

test('a live rate under 0.80 demotes a passing cell to advises until a newer sitting re-proves it', () => {
  const file = tmpLedger(), ledger = gridLedger(file)
  const outcomes = ['pass', 'fail', 'pass', 'fail', 'pass']                  // 3 of 5: 0.60 < 0.80
  outcomes.forEach((o, i) => onRunRow(sup, ...run(`w-d${i}`, o), { ledger }))
  const fold = foldLedger(readGridLedger(fs.readFileSync(file, 'utf8')).rows)['12b swe state-machines L4']
  assert.deepEqual([fold.n, fold.pass, fold.lastFail], [5, 0.6, 'w-d3'])
  const sitting = { form: 'ladder', pass: 1, n: 40, lb90: +wilson(40, 40).toFixed(3), at: '2026-10-29T00:00:00Z', source: 'ladder/12b.slat' }
  const cell = { mind: '12b', role: 'swe', function: 'state-machines', level: 'L4', sitting, ledger: fold }
  assert.equal(standingOf({ sitting }), 'passes')
  assert.equal(standingOf(cell), 'advises')
  assert.match(cellLine(cell), /\(ledger \(pass 0\.6\) \(n 5\) \(since "[^"]+"\) \(last-fail "w-d3"\)\) \(runs "w-d0" "w-d1" "w-d2" "w-d3" "w-d4"\)/)
  const resat = foldLedger(readGridLedger(fs.readFileSync(file, 'utf8')).rows, { '12b swe state-machines L4': '2099-01-01T00:00:00Z' })
  assert.equal(resat['12b swe state-machines L4'], undefined)                // a sitting newer than the rows: they no longer count
  assert.equal(RULES.demoteN, 5)
})

test('the ledger\'s chain breaks at an edited row, and a failed append stays on the worker', () => {
  const file = tmpLedger(), ledger = gridLedger(file)
  onRunRow(sup, ...run('w-c1', 'pass'), { ledger }); onRunRow(sup, ...run('w-c2', 'fail'), { ledger }); onRunRow(sup, ...run('w-c3', 'pass'), { ledger })
  const text = fs.readFileSync(file, 'utf8').replace('(run "w-c2") (mind 12b) (role swe) (function state-machines) (level L4) (outcome fail)', '(run "w-c2") (mind 12b) (role swe) (function state-machines) (level L4) (outcome pass)')
  const r = readGridLedger(text)
  assert.equal(r.broken, 3)
  assert.deepEqual(r.rows.map((x) => x.run), ['w-c1'])                       // the edited row and every row after it are out
  const [w, row] = run('w-c4', 'pass')
  const out = onRunRow(sup, w, row, { ledger: { append: () => { throw new Error('EPERM: the disk said no') } } })
  assert.equal(out.row, null)
  assert.match(w.gridLedgerError, /refused the row: EPERM/)
})
