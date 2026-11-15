// router.test.mjs — THE ONE ROUTER (R1.4; ROLEBENCH-2.0 §5). Owns: the proofs that a step routes to the smallest rung holding
// its budget, smallest first, a resident mind winning a tie; that a passing grid cell decides over size alone and is named on
// the why (the two 12B work orders of 10-30: a coder step at the 12B's size with the 12B's cell); that an advising cell is
// advice and a not-sat mind is advice only; that a mind the box cannot load is passed over for one it can; that one climb
// per step starts above the rung left; that a step over every proven size is refused with a handoff to the queue, and to
// waiting-owner on the second refusal, as the record's `(handoff …)` line; that the box profile's minds read. Refuses: a
// mock of the router; the cells are sealed by grid-ledger.mjs's own writer.
import test from 'node:test'
import assert from 'node:assert/strict'
import { cellLine, readCells } from '../grid-ledger.mjs'
import { readHandoff } from '../runs.mjs'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { boxMinds, cellFor, priceOf, route, routeJob, gridCells, boxProfile } from '../router.mjs'

const cells = (rows) => readCells(rows.map(cellLine).join('\n'), { ladder: null }).cells
const sitting = (lb90, n, form = 'sitting') => ({ form, pass: lb90, n, lb90, at: '2026-10-30', source: 's.json' })
const BOX = [{ id: '270m', useMb: 380 }, { id: '1b', useMb: 1310 }, { id: 'e2b', useMb: 3600 }, { id: 'e4b', useMb: 6474 }, { id: '12b', useMb: 11319 }, { id: '26b', useMb: 19000 }, { id: '31b', useMb: 20500 }]
const coder = { n: 2, budget: { in: 24000, out: 3000, s: 600 } }   // wo-273615's size: past the E4B (16,384 in), inside the 12B
const label = { n: 1, budget: { in: 700, out: 20, s: 3 } }

// spec: "the two 12B work orders of 10-30 route to the 12B with the cell on the why" · class: E · technique: a passing 12B cell
test('a coder step at the 12B\'s size routes to the 12B and names its passing cell; without a cell the same pick is advice only', () => {
  const grid = cells([{ mind: '12b', role: 'swe', function: 'systems-code', level: 'L4', sitting: sitting(0.93, 28) }])
  const r = route({ role: 'swe', function: 'systems-code', level: 'L4', step: coder }, { cells: grid, box: BOX, resident: { brain: 'e4b' }, availMb: 20000 })
  assert.equal(r.mind, '12b')
  assert.equal(r.authority, 'record')
  assert.match(r.why, /^12b: the grid's cell swe\/systems-code L4 passes \(lb90 0\.93, n 28\); to load: 11319 MB$/)
  assert.equal(r.priceMb, 11319)
  assert.equal(r.handoff, null)
  const bare = route({ role: 'swe', function: 'systems-code', level: 'L4', step: coder }, { cells: [], box: BOX, resident: { brain: 'e4b' }, availMb: 20000 })
  assert.deepEqual([bare.mind, bare.authority], ['12b', 'none'])
  assert.match(bare.why, /^12b: the smallest rung holding step 2's budget \(24000 in, 3000 out\); no cell for swe\/systems-code L4: advice only; to load: 11319 MB$/)
})

// spec: "a label job climbs smallest-first"; a resident mind wins a tie · class: E
test('a label job takes the smallest rung that fits, resident or not; from names the rung left', () => {
  const r = route({ jobClass: 'label', step: label }, { box: BOX, resident: { loaded: [] }, availMb: 20000 })
  assert.deepEqual([r.mind, r.climb], ['270m', false])
  const warm = route({ jobClass: 'label', step: label }, { box: BOX, resident: { loaded: ['1b'] }, availMb: 20000, cells: cells([
    { mind: '270m', role: 'se', function: 'daemons', level: 'L3', sitting: sitting(0.95, 30) }, { mind: '1b', role: 'se', function: 'daemons', level: 'L3', sitting: sitting(0.95, 30) }]), role: 'se', function: 'daemons', level: 'L3' })
  assert.equal(warm.mind, '270m', 'two passing cells: the smaller rung, resident or not (MINDS §4.3: the lowest rung first; residency is a price)')
  const up = route({ jobClass: 'label', step: label, from: '270m' }, { box: BOX, availMb: 20000 })
  assert.deepEqual([up.mind, up.climb], ['1b', true])
})

// spec: "an advising cell is advice; passes beats advises; a demoted cell advises" · class: E
test('passes outranks advises outranks none, whatever the rung; a screen advises at most', () => {
  const grid = cells([
    { mind: 'e4b', role: 'swe', function: 'systems-code', level: 'L4', sitting: sitting(0.85, 20) },
    { mind: '12b', role: 'swe', function: 'systems-code', level: 'L4', sitting: sitting(0.92, 25) },
    { mind: '26b', role: 'swe', function: 'systems-code', level: 'L4', sitting: sitting(1, 1, 'screen') },
  ])
  const small = { n: 1, budget: { in: 8000, out: 1000 } }
  const r = route({ role: 'swe', function: 'systems-code', level: 'L4', step: small }, { cells: grid, box: BOX, availMb: 30000 })
  assert.deepEqual([r.mind, r.authority], ['12b', 'record'], 'the passing 12B over the advising E4B though the E4B is smaller')
  const noTwelve = route({ role: 'swe', function: 'systems-code', level: 'L4', step: small }, { cells: grid.filter((c) => c.mind !== '12b'), box: BOX, availMb: 30000 })
  assert.deepEqual([noTwelve.mind, noTwelve.authority], ['e4b', 'advice'])
  assert.equal(cellFor(grid, '26b', 'swe', 'systems-code', 'L4').standing, 'advises')
})

// spec: the climb's price against the free memory · class: E · technique: 8 GB free
test('a mind the box cannot load is passed over; a resident mind costs nothing', () => {
  const r = route({ step: coder }, { box: BOX, resident: { brain: 'e4b' }, availMb: 8000 })
  assert.equal(r.mind, null, 'the 12B needs 11,319 MB and nothing bigger fits either')
  assert.match(r.why, /^nothing fits: 12b needs 11319 MB, 26b needs 19000 MB, 31b needs 20500 MB against 8000 MB free$/)
  const resident = route({ step: coder }, { box: BOX, resident: { brain: '12b' }, availMb: 1000 })
  assert.deepEqual([resident.mind, resident.priceMb], ['12b', 0])
  assert.deepEqual(priceOf(BOX, '12b', 20000), { useMb: 11319, fits: true })
  assert.deepEqual(priceOf(BOX, 'no-such', 20000), { useMb: null, fits: null })
})

// spec: "a step over the proven size is refused with a handoff; a second refusal = waiting-owner" · class: E
test('a step over every size is a handoff to the queue, to waiting-owner on the second refusal, as the record\'s line', () => {
  const huge = { n: 3, budget: { in: 10 ** 6, out: 10 } }
  const r = route({ step: huge, at: 'lacuna:/1/4096/273615/1/1/3/-', partial: { did: 'read the dogs' } }, { box: BOX, availMb: 30000 })
  assert.equal(r.mind, null)
  assert.deepEqual([r.handoff.from, r.handoff.to, r.handoff.step], ['router', 'queue', 3])
  assert.match(r.handoff.why, /^no mind holds step 3's budget \(1000000 in, 10 out\)$/)
  const back = readHandoff(r.handoffLine)
  assert.deepEqual([back.from, back.to, back.step], ['router', 'queue', 3])
  const second = route({ step: huge, refusals: 1, from: 'e4b' }, { box: BOX, availMb: 30000 })
  assert.equal(second.handoff.to, 'waiting-owner')
  assert.deepEqual([second.handoff.from, second.candidates], ['e4b', []])
})

// spec: the box profile as the router reads it · class: E
test('boxMinds reads (mind (id …) … (use-mb n)) forms, null for an unmeasured one', () => {
  const text = '(mind (id 12b) (tag "x") (seat brain) (file-mb 6652) (use-mb 11319)\n  (load-s null null))\n(mind (id flux) (tag "p") (seat painter) (file-mb null) (use-mb 9728))\n(mind (id odd) (use-mb null))'
  assert.deepEqual(boxMinds(text), [{ id: '12b', tag: 'x', useMb: 11319 }, { id: 'flux', tag: 'p', useMb: 9728 }, { id: 'odd', tag: null, useMb: null }])
})

// spec: the live seam: the grid file, the box file, the broker's brain, the host's memory · class: E · technique: temp files behind the host's seam
test('routeJob reads the grid and the box files and answers the mind\'s tag; a job with neither budget nor role is not routed', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'router-'))
  const grid = path.join(d, 'grid.slat'); const box = path.join(d, 'box.slat')
  fs.writeFileSync(grid, '(grid (version 2))\n' + cellLine({ mind: 'e4b', role: 'swe', function: 'systems-code', level: 'L4', sitting: sitting(0.94, 30) }) + '\n')
  fs.writeFileSync(box, '(mind (id e4b) (tag "gemma4:e4b-it-qat") (seat pool) (file-mb 4916) (use-mb 6474))\n(mind (id 12b) (tag "gemma4:12b-it-qat") (seat brain) (file-mb 6652) (use-mb 11319))\n')
  assert.equal(gridCells(grid).length, 1)
  assert.equal(boxProfile(box)[1].tag, 'gemma4:12b-it-qat')
  const sup = { host: { memory: () => ({ availMB: 20000 }), loadedMinds: () => [], routeFiles: () => ({ grid, box }) }, broker: { brain: 'e2b', swapping: null, lowSince: null, minds: 0, foremen: new Set(), swaps: [] } }
  assert.equal(routeJob(sup, { job: 'condense' }), null, 'no budget, no role: nothing to route')
  const r = routeJob(sup, { role: 'swe', function: 'systems-code', level: 'L4', job: 'condense', budget: { in: 4096, out: 256 }, n: 3 })
  assert.deepEqual([r.mind, r.tag, r.authority], ['e4b', 'gemma4:e4b-it-qat', 'record'])
  assert.match(r.why, /^e4b: the grid's cell swe\/systems-code L4 passes \(lb90 0\.94, n 30\); to load: 6474 MB$/)
  const bare = routeJob(sup, { role: 'swe', function: 'systems-code', level: 'L5', budget: { in: 4096, out: 256 } })
  assert.deepEqual([bare.mind, bare.authority], ['e2b', 'none'], 'no L5 cell: the smallest fitting rung, the resident E2B')
  fs.writeFileSync(grid, '(grid (version 2))\n')
  assert.equal(gridCells(grid).length, 0, 'the cache follows the file')
})
