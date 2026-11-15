// shape.test.mjs — unit tests for `shape.mjs`, the shape rule (lane K1; LACUNA-CARDS-2.0 §4.2, §4.3).
// owns: the proofs that every §4.2 row's form draws the outline and colour `docs/design/cards-2.0/shapes.svg` shows, read
//   back from the drawing's own bytes; that a fixture id always yields the same form; that the form is slat data the one
//   reader (`slat-data`) reads; that size follows the table (fixed seats, the desk largest, a foreman by its team, a worker
//   12 px + 4 px per set of weights); that the routine is live and the body is not; that the voxel grid is 5–9 a side
//   and lights one cube per set of weights; that the registry stamps every row. refuses: a mock of shape.mjs; any read of
//   ~/lacuna-world or ~/.lacuna.
// implements: CARDS-2.0 §4.2, §4.3. invariants: "if two rows have the same identity, then their bodies are the same bytes";
//   "if a row is weights, then it is never drawn as an entity". faults: none.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { readForm } from '../../../lacuna-scheme/src/slat-data.js'
import { makeSup } from '../../../test/conformance/fake-host.mjs'
import { registry } from '../agents.mjs'
import { GEN, HUE, outlinePath, phaseOf, shapeForm, stampShapes, voxelGrid } from '../shape.mjs'

const SVG = readFileSync(new URL('../../../docs/design/cards-2.0/shapes.svg', import.meta.url), 'utf8')
/** Every outline path in the drawing: its `d` and its fill. */
const PATHS = [...SVG.matchAll(/<path d="([^"]+)" fill="([^"]+)"/g)].map((m) => ({ d: m[1], fill: m[2] }))

/** The form back as an object, through the one reader. */
function read(form) {
  const f = readForm(form)
  assert.equal(f[0].name, 'shape')
  return Object.fromEntries(f.slice(1).map(([k, v]) => [k.name, typeof v === 'object' && v?.name ? v.name : v]))
}

/** The §4.2 rows as registry rows, in the drawing's order (draw.mjs FAMILIES). */
const W = (id, o = {}) => ({ id, kind: 'worker', state: 'running', ...o })
const FAMILY = [
  { row: { id: 'seat/owner', kind: 'seat', state: 'present' }, kind: 'you' },
  { row: { id: 'seat/desk', kind: 'seat', state: 'running' }, kind: 'desk' },
  { row: { id: 'seat/cloud', kind: 'seat', state: 'available' }, kind: 'cloud' },
  { row: { id: 'seat/claude', kind: 'seat', state: 'available' }, kind: 'claude' },
  { row: { id: 'cart/forge-tender#k7m2', kind: 'cart', state: 'running', workers: [] }, kind: 'foreman' },
  { row: { id: 'agent/sentry', kind: 'standing', state: 'running' }, kind: 'sentry' },
  { row: W('w-plain'), kind: 'worker' },
  { row: W('w-smart', { kind: 'agent', mind: { model: 'sentry/1b@4', job: 'label' } }), kind: 'worker' },
  { row: W('w-three', { kind: 'agent', weights: [{}, {}, {}] }), kind: 'worker', scale: 1.6 },
]

// spec: §4.2 "the §4.2 table draws as shapes.svg" · technique: rebuild each family's outline from its form at the drawing's
//   own place and size (draw.mjs: x = 130 + (i % 5)·250, y = 125 + ⌊i / 5⌋·150, R = 38·scale) and find it byte for byte
test('every §4.2 body draws the outline and the colour shapes.svg shows', () => {
  FAMILY.forEach(({ row, kind, scale = 1 }, i) => {
    const s = read(shapeForm(row))
    assert.equal(s.kind, kind, row.id); assert.equal(s.gen, 'super')
    const d = outlinePath({ m: s.m, n1: s.n1, n2: s.n2, n3: s.n3 }, 130 + (i % 5) * 250, 125 + Math.floor(i / 5) * 150, 38 * scale)
    const hit = PATHS.find((p) => p.d === d)
    assert.ok(hit, `${row.id}: its outline is in shapes.svg`)
    assert.equal(hit.fill, s.hue, `${row.id}: its colour is the drawing's`)
  })
})

// spec: §4.2 "a cart is a floor, not a body … its foreman above it" · technique: the drawing's cart cell (x 1130, y 275)
test('a cart is the hexagon over a dashed floor, as the drawing has it', () => {
  const s = read(shapeForm({ id: 'cart/backup', kind: 'cart', state: 'idle', workers: [W('a'), W('b'), W('c')] }))
  assert.equal(s.kind, 'foreman'); assert.equal(s.floor, true); assert.equal(s.hue, '#ffb000')
  assert.deepEqual([s.m, s.n1, s.n2, s.n3], [GEN.hex.m, GEN.hex.n1, GEN.hex.n2, GEN.hex.n3])
  assert.ok(PATHS.some((p) => p.d === outlinePath(GEN.hex, 1130, 251, 12) && p.fill === s.hue), 'the foreman over the floor')
  assert.match(SVG, /<ellipse cx="1130" cy="285" rx="60" ry="22"[^>]*stroke-dasharray/)
})

// spec: §4.2 size column; the drawing's panel "R = 12 px + 4 px per set of weights" (2, 3 and 5 sets at x 1004, 1096, 1188)
test('a worker is 12 px plus 4 px per set of weights, lime when it carries any, olive when it carries none', () => {
  const plain = read(shapeForm(W('w-0')))
  assert.equal(plain.r, 12); assert.equal(plain.hue, HUE.plain)
  for (const [n, x] of [[2, 1004], [3, 1096], [5, 1188]]) {
    const s = read(shapeForm(W(`w-${n}`, { kind: 'agent', weights: Array(n).fill({}) })))
    assert.equal(s.r, 12 + 4 * n); assert.equal(s.hue, HUE.smart)
    assert.ok(PATHS.some((p) => p.d === outlinePath(GEN.worker, x, 520, s.r) && p.fill === s.hue), `${n} sets drawn at ${s.r} px`)
  }
})

// spec: §4.2 "the desk the largest"; a foreman "by its team's size" · technique: a team of 40 against the cap
test('the desk is the largest body; a foreman grows with its team and never passes the desk', () => {
  const desk = read(shapeForm({ id: 'seat/desk', kind: 'seat' })).r
  const r = (n) => read(shapeForm({ id: 'cart/c', kind: 'cart', workers: Array.from({ length: n }, (_, k) => W(`w${k}`)) })).r
  assert.equal(r(3), 18); assert.ok(r(5) > r(1)); assert.ok(r(40) < desk)
  for (const id of ['seat/owner', 'seat/cloud', 'seat/claude', 'agent/sentry']) assert.equal(read(shapeForm({ id, kind: 'seat' })).r, 18)
})

// spec: §4.2 the cloud seat wears its account's colour (R13) · technique: both accounts, and an unknown one
test('the cloud seat is Gemini blue until Settings chooses DeepSeek', () => {
  const cloud = { id: 'seat/cloud', kind: 'seat' }
  assert.equal(read(shapeForm(cloud)).hue, '#4285f4')
  assert.equal(read(shapeForm(cloud, { cloud: 'deepseek' })).hue, '#4d6bfe')
  assert.equal(read(shapeForm(cloud, { cloud: 'other' })).hue, '#4285f4')
})

// spec: the lane gate "a fixture id always yields the same form" · technique: the §4.2 example id, read twice, and
//   copies of the row in another key order
test('a fixture id always yields the same form, byte for byte', () => {
  const row = { id: 'cart/forge-tender#k7m2', kind: 'cart', state: 'running', workers: [W('w-1', { pending: [{}, {}, {}] })] }
  const a = shapeForm(row)
  assert.equal(shapeForm(structuredClone(row)), a)
  assert.equal(shapeForm({ workers: row.workers, state: 'running', kind: 'cart', id: row.id }), a)
  assert.equal(a, '(shape (id "cart/forge-tender#k7m2") (kind foreman) (gen super) (m 6) (n1 1) (n2 1) (n3 1) (r 14) '
    + `(phase ${phaseOf('cart/forge-tender#k7m2')}) (hue "#ffb000") (bees 3) (breath 0.4) (routine working) (floor #t))`)
  assert.deepEqual(voxelGrid(structuredClone(row)), voxelGrid(row))
})

// spec: §4.1 "instance · one spin-up #k7m2 · a phase" · technique: two instances of one role; one role without an instance
test('the phase comes from the instance: two spin-ups differ, the body does not', () => {
  const a = read(shapeForm(W('sentry/1b@4#k7m2'))); const b = read(shapeForm(W('sentry/1b@4#q9x1')))
  assert.notEqual(a.phase, b.phase)
  assert.ok(a.phase >= 0 && a.phase < 1)
  for (const k of ['kind', 'm', 'n1', 'n2', 'n3', 'r', 'hue']) assert.equal(a[k], b[k])
  assert.equal(phaseOf('x/y#k7m2'), phaseOf('z#k7m2'))
})

// spec: §4.2 routines: idle · working · stuck · sleeping; bees one per tool call in flight · technique: one row per routine
test('the routine is live: bees count the calls in flight, stuck wins, a shelved agent sleeps', () => {
  const cart = (workers, state = 'running') => read(shapeForm({ id: 'cart/c', kind: 'cart', state, workers }))
  assert.equal(cart([W('a', { pending: [{}, {}] }), W('b', { pending: [{}] })]).bees, 3)
  assert.equal(cart([W('a', { stall_reason: 'promise past its time' })]).routine, 'stuck')
  assert.equal(cart([W('a', { missed_beats: 2 })]).breath, 0.5)
  assert.equal(cart([], 'idle').routine, 'idle'); assert.equal(cart([], 'idle').breath, 0.017)
  const shelf = read(shapeForm({ id: 'agent/triage', kind: 'shelf', state: 'shelved' }))
  assert.equal(shelf.routine, 'sleeping'); assert.equal(shelf.breath, 0); assert.equal(shelf.kind, 'worker')
  assert.equal(read(shapeForm({ id: 'seat/claude', kind: 'seat', state: 'away' })).routine, 'sleeping')
})

// spec: §2.5 "a region with no record behind it is not drawn"; §4.2 weights are never an entity · technique: rows the
//   table does not name
test('a row the table does not name, weights among them, has no body', () => {
  for (const row of [{ id: 'weights/sentry/1b@4', kind: 'weights' }, { id: 'x', kind: 'mystery' }]) {
    assert.deepEqual(read(shapeForm(row)), { id: row.id, kind: 'none' })
    assert.deepEqual(voxelGrid(row), [])
  }
})

// spec: §4.3 "five to nine cubes a side"; "lit inner cubes are the sets of weights it carries" · technique: the sizes
//   from the smallest worker to the desk; a worker with five sets
test('the voxel grid is 5 to 9 cubes a side and lights one inner cube per set of weights', () => {
  const sides = [W('w'), { id: 'seat/owner', kind: 'seat' }, { id: 'seat/desk', kind: 'seat' }].map((r) => voxelGrid(r).length)
  assert.deepEqual(sides, [5, 6, 9])
  const disc = voxelGrid({ id: 'seat/desk', kind: 'seat' })
  assert.ok(disc.every((row) => row.length === 9)); assert.equal(disc[4][4], '#'); assert.equal(disc[0][0], '.')
  const five = voxelGrid(W('w5', { kind: 'agent', weights: Array(5).fill({}) }))
  assert.equal(five.join('').split('*').length - 1, 5)
  assert.equal(voxelGrid(W('w0')).join('').includes('*'), false)
})

// spec: §4.2 "the foreman stamps a (shape …) form on every registry row" · technique: the registry on the fake host with
//   one cart carrying a worker
test('the registry stamps every row and every worker in a cart with a form and a grid', () => {
  const { s } = makeSup()
  const rows = stampShapes([{ id: 'cart/disk-watch', kind: 'cart', state: 'running', workers: [W('w-1')] }])
  assert.equal(read(rows[0].workers[0].shape).kind, 'worker'); assert.ok(rows[0].workers[0].voxels.length >= 5)
  const r = registry(s, { cloudAccount: 'deepseek' })
  assert.equal(r.agents.length, 6)
  for (const a of r.agents) { assert.equal(typeof a.shape, 'string'); read(a.shape) }
  assert.equal(read(r.agents.find((a) => a.id === 'seat/cloud').shape).hue, '#4d6bfe')
  assert.equal(read(r.agents.find((a) => a.id === 'agent/broker').shape).kind, 'standing')
})
