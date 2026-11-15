// shape.mjs — THE SHAPE RULE (lane K1; LACUNA-CARDS-2.0 §4.2, §4.3). Owns: the one function from a registry row's
// identity to its `(shape …)` form and its voxel grid: the family (you · desk · cloud · claude · foreman · sentry ·
// standing · worker), the superformula parameters `docs/design/cards-2.0/draw.mjs` draws `shapes.svg` with, the hue from
// the §4.2 table, the size (fixed; the desk the largest; a foreman by its team; a worker 12 px + 4 px per set of weights),
// the phase from the instance, and the live routine (bees, breath, idle · working · stuck · sleeping). Refuses: to read
// anything but the row (no clock, no random, no file: the same row yields the same bytes); to draw weights as a body;
// to invent a family for a row the table does not name (it says `(kind none)`: the form gives no body); to rotate
// an outline by instance (siblings look alike). Implements: LACUNA-CARDS-2.0 §4.1–§4.3, the §4.2 table; MINDS §3.1
// (ids, `role/base@version#instance`). Invariants (§18): "if two rows have the same identity, then their bodies are the
// same bytes"; "if a row is weights, then it is never drawn as an entity". Faults (§16): none raised (an unknown row is
// `(kind none)`, said in the form).

/** The superformula parameters per family, byte-for-byte those of `draw.mjs P` (the drawing is the reference, §2.3). */
export const GEN = Object.freeze({
  disc: Object.freeze({ m: 0, n1: 1, n2: 1, n3: 1 }),
  box: Object.freeze({ m: 4, n1: 0.6, n2: 1, n3: 1 }),
  soft: Object.freeze({ m: 4, n1: 6, n2: 6, n3: 6 }),
  hex: Object.freeze({ m: 6, n1: 1, n2: 1, n3: 1 }),
  lens: Object.freeze({ m: 2, n1: 1, n2: 1.2, n3: 1.2 }),
  worker: Object.freeze({ m: 3, n1: 1.4, n2: 1.4, n3: 1.4 }),
})

/** The §4.2 colour column; the cloud seat wears its account's colour (ruling R13; Settings picks the account). */
export const HUE = Object.freeze({
  you: '#f4f4f8', desk: '#b6ff00', claude: '#e8a87c', foreman: '#ffb000', sentry: '#00e5ff', standing: '#9aa0a6',
  plain: '#b7c35a', smart: '#b6ff00', cloud: Object.freeze({ gemini: '#4285f4', deepseek: '#4d6bfe' }),
})

/** Radii in px: the fixed bodies, the desk the largest, a foreman 12 + 2 per worker up to 30, a worker 12 + 4 per set. */
export const SIZE = Object.freeze({ fixed: 18, desk: 36, foremanBase: 12, foremanPer: 2, foremanMax: 30, workerBase: 12, workerPer: 4 })

/** Breath in cycles per second per routine: idle once a minute; stuck is the 0.5 Hz shiver; sleeping is still. */
export const BREATH = Object.freeze({ idle: 0.017, working: 0.4, stuck: 0.5, sleeping: 0 })

const SEATS = Object.freeze({ 'seat/owner': 'you', 'seat/desk': 'desk', 'seat/cloud': 'cloud', 'seat/claude': 'claude' })
const ASLEEP = new Set(['shelved', 'off', 'away', 'sleeping'])

/**
 * The superformula radius at angle t (Gielis), as `draw.mjs superPath` computes it.
 * @param {{m: number, n1: number, n2: number, n3: number}} p
 * @param {number} t radians
 * @returns {number}
 */
export function superRadius(p, t) {
  if (p.m === 0) return 1
  return Math.pow(Math.pow(Math.abs(Math.cos((p.m * t) / 4)), p.n2) + Math.pow(Math.abs(Math.sin((p.m * t) / 4)), p.n3), -1 / p.n1)
}

/**
 * The outline as an SVG path, the same points `draw.mjs superPath` writes (phase 0: phase is breath, never rotation).
 * @param {{m: number, n1: number, n2: number, n3: number}} p
 * @param {number} cx
 * @param {number} cy
 * @param {number} R px
 * @param {number} [steps]
 * @returns {string}
 */
export function outlinePath(p, cx, cy, R, steps = 180) {
  const pts = []
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2; const r = superRadius(p, t)
    pts.push(`${(cx + R * r * Math.cos(t)).toFixed(1)},${(cy + R * r * Math.sin(t)).toFixed(1)}`)
  }
  return `M ${pts.join(' L ')} Z`
}

/** FNV-1a, 32 bit: a stable phase from a string, no randomness. */
function fnv(s) {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return h >>> 0
}

/**
 * The phase (0–1, two places) of an id: from its instance part `#k7m2` when it has one, else from the whole id.
 * @param {string} id
 * @returns {number}
 */
export function phaseOf(id) {
  const s = String(id); const k = s.indexOf('#')
  return Math.round((fnv(k >= 0 ? s.slice(k + 1) : s) / 0x100000000) * 100) / 100
}

/** The sets of weights a worker carries: a listed `weights` array, else one when it thinks with a mind. */
const setsOf = (row) => (Array.isArray(row.weights) ? row.weights.length : row.mind ? 1 : 0)

/** Who the row is in the §4.2 table: its family, generator, hue and radius; `null` when the table does not name it. */
function familyOf(row, cloud) {
  const seat = SEATS[row.id]
  if (seat === 'you') return { kind: 'you', gen: 'disc', hue: HUE.you, r: SIZE.fixed }
  if (seat === 'desk') return { kind: 'desk', gen: 'disc', hue: HUE.desk, r: SIZE.desk }
  if (seat === 'cloud') return { kind: 'cloud', gen: 'box', hue: HUE.cloud[cloud] || HUE.cloud.gemini, r: SIZE.fixed }
  if (seat === 'claude') return { kind: 'claude', gen: 'soft', hue: HUE.claude, r: SIZE.fixed }
  if (row.id === 'agent/sentry') return { kind: 'sentry', gen: 'lens', hue: HUE.sentry, r: SIZE.fixed }
  if (row.kind === 'standing') return { kind: 'standing', gen: 'disc', hue: HUE.standing, r: SIZE.fixed }
  if (row.kind === 'cart') {
    const team = (row.workers || []).length
    return { kind: 'foreman', gen: 'hex', hue: HUE.foreman, r: Math.min(SIZE.foremanMax, SIZE.foremanBase + SIZE.foremanPer * team), floor: true }
  }
  if (row.kind === 'shelf') return { kind: 'worker', gen: 'worker', hue: HUE.smart, r: SIZE.workerBase + SIZE.workerPer, sets: 1 }
  if (row.kind === 'agent' || row.kind === 'worker') {
    const sets = setsOf(row)
    return { kind: 'worker', gen: 'worker', hue: sets ? HUE.smart : HUE.plain, r: SIZE.workerBase + SIZE.workerPer * sets, sets }
  }
  return null
}

/** The live half: bees (tool calls in flight), the routine and its breath. */
function routineOf(row) {
  const team = row.kind === 'cart' ? row.workers || [] : [row]
  const bees = team.reduce((n, w) => n + (Array.isArray(w.pending) ? w.pending.length : 0), 0)
  const stuck = team.some((w) => w.stall_reason || (w.missed_beats || 0) > 0)
  const routine = stuck ? 'stuck' : (ASLEEP.has(row.state) || (row.kind === 'shelf' && row.state !== 'serving')) ? 'sleeping'
    : row.state === 'running' || row.state === 'serving' ? 'working' : 'idle'
  return { bees: row.kind === 'cart' ? bees : 0, routine, breath: BREATH[routine] }
}

/** A number as slat writes it: at most three places, no trailing zeros. */
const num = (n) => String(Math.round(n * 1000) / 1000)
const str = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`

/**
 * The `(shape …)` form for one registry row (§4.2). The same row always yields the same string.
 * @param {{id: string, kind?: string, state?: string, workers?: object[], mind?: object, weights?: object[]}} row
 * @param {{cloud?: 'gemini'|'deepseek'}} [o] the cloud seat's account (Settings, R13); Gemini until chosen
 * @returns {string}
 */
export function shapeForm(row, o = {}) {
  const f = familyOf(row, o.cloud)
  if (!f) return `(shape (id ${str(row.id)}) (kind none))`
  const p = GEN[f.gen]; const live = routineOf(row)
  return `(shape (id ${str(row.id)}) (kind ${f.kind}) (gen super) (m ${num(p.m)}) (n1 ${num(p.n1)}) (n2 ${num(p.n2)}) (n3 ${num(p.n3)})`
    + ` (r ${num(f.r)}) (phase ${num(phaseOf(row.id))}) (hue ${str(f.hue)}) (bees ${live.bees}) (breath ${num(live.breath)})`
    + ` (routine ${live.routine})${f.floor ? ' (floor #t)' : ''})`
}

/**
 * The voxel grid for one row (§4.3): the outline rasterized at cell centres, 5–9 cubes a side by size; `#` a body cube,
 * `*` a lit cube (one per set of weights, centre outward), `.` empty. `[]` when the row has no body.
 * @param {object} row
 * @returns {string[]}
 */
export function voxelGrid(row) {
  const f = familyOf(row)
  if (!f) return []
  const p = GEN[f.gen]
  const side = Math.min(9, 5 + Math.max(0, Math.ceil((f.r - 14) / 5)))
  let max = 0
  for (let i = 0; i < 360; i++) max = Math.max(max, superRadius(p, (i / 360) * Math.PI * 2))
  const cells = []
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const u = (2 * (x + 0.5)) / side - 1; const v = 1 - (2 * (y + 0.5)) / side
      const rho = Math.hypot(u, v); const t = Math.atan2(v, u)
      cells.push({ x, y, rho, in: rho <= superRadius(p, t) / max + 1e-9 })
    }
  }
  const lit = new Set(cells.filter((c) => c.in).sort((a, b) => a.rho - b.rho || a.y - b.y || a.x - b.x).slice(0, f.sets || 0).map((c) => c.y * side + c.x))
  const rows = []
  for (let y = 0; y < side; y++) rows.push(cells.slice(y * side, (y + 1) * side).map((c) => (lit.has(c.y * side + c.x) ? '*' : c.in ? '#' : '.')).join(''))
  return rows
}

/**
 * Stamps every registry row, and every worker riding in a cart row, with its form and voxel grid (`GET /agents`).
 * @param {object[]} agents the registry rows from agents.mjs
 * @param {{cloud?: 'gemini'|'deepseek'}} [o]
 * @returns {object[]} new rows; the input is not changed
 */
export function stampShapes(agents, o = {}) {
  const stamp = (row) => ({ ...row, shape: shapeForm(row, o), voxels: voxelGrid(row) })
  return agents.map((a) => (a.kind === 'cart' && Array.isArray(a.workers) ? { ...stamp(a), workers: a.workers.map(stamp) } : stamp(a)))
}
