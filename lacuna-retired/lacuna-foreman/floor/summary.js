// summary.js — LACUNA'S FOLD SUMMARY (lane F5-BC; THE-FLOOR-5.0 §3.2; A9 §8; RULINGS Q-P1). Owns: what runs, what is stuck
// and for how long, what failed and the `why`, what waits on the owner, the minds' states and the cube's own lights, built
// from the registry as one `(summary …)` form of at most 1,200 characters that the Lacuna agent's turn carries; when the
// floor is busier than the cap the lists keep their newest rows and say how many they cut. Refuses: prose, a guess, a
// secret (ids, states, causes and seconds only; never a goal's words beyond 60 characters), more than 1,200 characters.
// Implements: master §3.2. Invariants (design §18): "a claim is not a record" (every row names a record's id).
// Faults (§16): none.

import { writeData } from '../../../lacuna-scheme/src/slat-data.js'
import { tick } from './fold.js'

/** The cap in characters (master §3.2 as the brief fixes it). */
export const MAX_CHARS = 1200
const GOAL_CHARS = 60

/**
 * The summary at `logT` as one `(summary …)` form (the fold is settled there first).
 * @param {!Object} f the fold handle @param {number} logT
 * @return {string} ≤ 1,200 characters
 */
export function summary(f, logT) {
  tick(f, logT)
  const recs = [...f.registry.values()]
  const runs = recs.filter((r) => r.kind === 'worker' && !r.eval)
  const age = (t) => Math.max(0, Math.round(logT - (t ?? logT)))
  const living = runs.filter((r) => ['working', 'stepping', 'stalled', 'waiting-press', 'done-claimed', 'resumed', 'kicked', 'falling', 'budding'].includes(r.state))
  const stuck = runs.filter((r) => r.state === 'stalled' || (r.kind === 'worker' && r.state === 'unknown' && !r.outcome))
    .sort((a, b) => b.since - a.since).map((r) => ({ run: r.id, state: r.state, 'for-s': age(r.since), cause: r.cause, step: r.step, plan: r.plan }))
  const failed = runs.filter((r) => r.state === 'failed').sort((a, b) => b.fail.at - a.fail.at)
    .map((r) => ({ run: r.id, why: r.cause, 'age-s': age(r.fail.at), acked: r.ackT != null }))
  const waits = recs.filter((r) => r.kind === 'worker' && r.pressWait).sort((a, b) => a.pressWait.since - b.pressWait.since)
    .map((r) => ({ run: r.id, action: r.pressWait.action, id: r.pressWait.id, 'for-s': age(r.pressWait.since), goal: String(r.goal ?? '').slice(0, GOAL_CHARS) }))
  const minds = recs.filter((r) => r.kind === 'mind' && r.state !== 'dark').map((r) => ({ id: r.id, state: r.state, ...(r.cause ? { cause: r.cause } : {}), ...(r.onJob ? { run: r.onJob } : {}) }))
  const lac = f.registry.get('lacuna')
  const foreman = f.registry.get('foreman')
  const alerts = recs.filter((r) => r.kind === 'alert' && r.raisedT != null && r.resolvedT == null && r.ackT == null).length
  const base = {
    logt: Math.round(logT), foreman: foreman ? { state: foreman.state, ...(foreman.cause ? { cause: foreman.cause } : {}), living: foreman.living } : null,
    runs: { living: living.length, queued: runs.filter((r) => r.state === 'queued').length, 'waiting-press': waits.length, stuck: stuck.length, failed: failed.length },
    lacuna: lac ? { edge: lac.state, lights: lac.lights ?? null, unwatched: lac.unwatched ?? 0, 'alerts-open': alerts } : null,
    scene: f.floor.scene ? f.floor.scene.name : null,
  }
  for (let cut = 0; cut <= 4; cut++) {
    const text = render(base, cutList(stuck, cut), cutList(failed, cut), cutList(waits, cut), cut >= 3 ? [] : minds)
    if (text.length <= MAX_CHARS) return text
  }
  return render(base, [], [], [], []).slice(0, MAX_CHARS)
}

/** The newest `n` rows of a list with a `cut` row saying how many were left out; `n` falls with each cut. */
function cutList(list, cut) {
  const keep = [8, 4, 2, 1, 0][cut]
  if (list.length <= keep) return list
  return [...list.slice(0, keep), { cut: list.length - keep }]
}

function render(base, stuck, failed, waits, minds) {
  return `(summary (logt ${base.logt}) (foreman ${writeData(base.foreman)}) (runs ${writeData(base.runs)}) (stuck ${writeData(stuck)}) (failed ${writeData(failed)}) (waits ${writeData(waits)}) (minds ${writeData(minds)}) (lacuna ${writeData(base.lacuna)}) (scene ${writeData(base.scene)}))`
}
