// agents.mjs — THE AGENTS REGISTRY (work order A29; MINDS §5.5, §5.6). Owns: the one list of every agent this foreman
// knows and its agency, for the agents screen and the agent library: the seats (the owner, Lacuna's desk, the cloud seat,
// Claude), the standing agents (the switchboard, the sentry, the broker), every cart on the box as an agent with its living
// workers, each open card's worker (card-worker.mjs, CARDS-2.0 §8.1), and the shelf's agents from the weights index (a
// role that has trained weights). Each row says what it is, what
// it does, its state, who it is made of (weights, workers) and what it may be told (the kernel's powers it answers to:
// pause · resume · stop · talk · sit-exam), so a screen can draw agency instead of a ring around the foreman. Refuses: to
// invent an agent (every row comes from a record: the supervisor's workers, the carts dir, the weights index, the broker);
// to act (a registry is a read); to name a process the foreman does not manage. Implements: LACUNA-MINDS-1.0 §5.5 (the
// compositions), §5.6 items 10 and the agent library, §3.1 (ids). Invariants (§18): "if an agent is listed as running,
// then a worker or a server behind it is alive". Faults (§16): none raised (a missing index is an empty shelf, said).
import { node } from './talk.mjs'
import { brokerStatus, broker } from './broker.mjs'
import { KINDS as SENTRY_KINDS } from './sentry.mjs'
import { stampShapes } from './shape.mjs'
import { cardWorkerRows } from './card-worker.mjs'

/** What each kind of agent may be told from the desk (MINDS §5.6 item 13). */
export const POWERS = Object.freeze({
  seat: ['talk'], standing: ['talk'], cart: ['run', 'pause', 'resume', 'stop', 'talk'], worker: ['pause', 'resume', 'stop', 'talk'], shelf: ['sit-exam', 'train'],
})

const seat = (id, name, does, state, color) => ({ id, kind: 'seat', name, does, state, color, powers: POWERS.seat })

/**
 * The seats and standing agents: who faces the owner and who always runs (MINDS §4.1, §4.6).
 * @param {object} sup
 * @param {{coast?: object, claude?: boolean, cloud?: boolean}} [o]
 * @returns {object[]}
 */
export function standing(sup, o = {}) {
  const b = brokerStatus(sup)
  const living = sup.living()
  const sentryRuns = living.filter((w) => w.sentry).length
  return [
    seat('seat/owner', 'the owner', 'the one with the press', 'present', '#e8eaed'),
    seat(`seat/desk`, 'Lacuna', `the desk, the switchboard; the ${b.brain} resident${b.swapping ? `, swapping to the ${b.swapping}` : ''}`, b.swapping ? 'swapping' : 'running', '#b6ff00'),
    seat('seat/cloud', 'Cloud Lacuna', 'the cloud seat: plans, never acts; one try', o.cloud === false ? 'off' : 'available', '#8c7bff'),
    seat('seat/claude', 'Claude', 'the engineer at the desk; talks to the owner and to Lacuna', o.claude === false ? 'away' : 'available', '#c8956c'),
    { id: 'agent/sentry', kind: 'standing', name: 'the sentry', does: `labels every said (${SENTRY_KINDS.join(' · ')}); watches promises; speaks for the box`, state: 'running',
      watching: sentryRuns, shadow: typeof sup.host.sentryShadow === 'function' ? sup.host.sentryShadow() !== false : true, color: '#00e5ff', powers: POWERS.standing },
    { id: 'agent/broker', kind: 'standing', name: 'the broker', does: 'residency: who is loaded, the wall, the swap', state: b.swapping ? 'swapping' : 'running',
      brain: b.brain, minds: b.minds, avail_mb: b.avail_mb, color: '#9aa0a6', powers: POWERS.standing },
  ]
}

/**
 * Every cart on the box as an agent, with its living workers (the foreman's connection to the cards, MINDS §5.6).
 * @param {object} sup
 * @param {object[]} cartRows from carts.mjs `cartRows`
 * @returns {object[]}
 */
export function cartAgents(sup, cartRows) {
  const byCart = new Map()
  for (const w of sup.living()) { const name = w.cart?.name || w.contract?.cart; if (!name) continue; (byCart.get(name) || byCart.set(name, []).get(name)).push(w) }
  return cartRows.map((r) => {
    const ws = byCart.get(r.name) || []
    return { id: `cart/${r.name}`, kind: 'cart', name: r.name, does: r.does || r.goal || null, version: r.version ?? null, tier: r.tier ?? null, exam: r.exam ?? null,
             state: ws.length ? (ws.some((w) => w.state === 'running') ? 'running' : ws[0].state) : (r.state || 'idle'), runs: r.runs ?? null, first_try: r.firstTry ?? null,
             workers: ws.map((w) => ({ ...node(w), powers: POWERS.worker })), minds: r.minds ?? null, powers: POWERS.cart }
  })
}

/**
 * The shelf: every role with trained weights in the index, as an agent you can put to work (the agent library).
 * @param {{minds: object[]}|null} index from assign.mjs `loadIndex`
 * @returns {object[]}
 */
export function shelfAgents(index) {
  if (!index || !index.minds?.length) return []
  const byRole = new Map()
  for (const m of index.minds) {
    const role = String(m.id).split('/')[0]; if (!role || role === 'base') continue
    const list = byRole.get(role) || byRole.set(role, []).get(role); list.push(m)
  }
  return [...byRole.entries()].map(([role, ms]) => {
    const best = ms.map((m) => ({ m, row: m.exams.filter((e) => e.inRole && e.recall != null).sort((a, b) => b.recall - a.recall)[0] })).filter((x) => x.row).sort((a, b) => b.row.recall - a.row.recall)[0]
    return { id: `agent/${role}`, kind: 'shelf', name: role, does: ms[0].exams[0]?.class ? `${ms[0].exams[0].class}` : null, state: ms.some((m) => m.state === 'serving') ? 'serving' : 'shelved',
             weights: ms.map((m) => ({ id: m.id, base: m.base || m.tag, quant: m.quant, state: m.state, resident: m.resident, exams: m.exams.length })),
             best: best ? { id: best.m.id, recall: best.row.recall, level: best.row.level, class: best.row.class } : null, powers: POWERS.shelf }
  })
}

/**
 * The whole registry, for `GET /agents`; every row carries its `(shape …)` form and voxel grid (CARDS-2.0 §4.2, lane K1).
 * @returns {{agents: object[], counts: object}}
 */
export function registry(sup, { cartRows = [], index = null, claude, cloud, cloudAccount } = {}) {
  const agents = stampShapes([...standing(sup, { claude, cloud }), ...cartAgents(sup, cartRows), ...cardWorkerRows(sup), ...shelfAgents(index)], { cloud: cloudAccount })
  const counts = { seats: 4, standing: 2, carts: cartRows.length, running_carts: agents.filter((a) => a.kind === 'cart' && a.state === 'running').length,
                   workers: agents.filter((a) => a.kind === 'cart').reduce((n, a) => n + a.workers.length, 0), shelf: agents.filter((a) => a.kind === 'shelf').length, brain: broker(sup).brain }
  return { agents, counts }
}
