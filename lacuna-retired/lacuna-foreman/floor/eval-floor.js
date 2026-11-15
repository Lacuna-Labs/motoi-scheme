// eval-floor.js — THE EVAL FLOOR: ONE ISOLATED IN-MEMORY FLOOR, ITS CLOCK AND ITS ROWS (lane CL-UX Part A / F5-H;
// A8-SCENE-SCHEME §3–§5). Owns: a floor's state (`newFloor`); one event stamped, validated and folded onto it
// (`stampAndFold`); its due rows played up to a time, a scene's expectations judged on the way (`advanceTo`); a scene
// opened from the drills (`openScene`) and closed with its score (`closeScene`); a replay of recorded day events opened
// (`replayFloor`); a failed expectation's three records (`recordFail`: the ledger's row, the truth report, the scene's
// verdict event); the floor's ledger row (`floorRow`). Split from verbs.js (finale order §3.16 unit 4), whose twelve
// verbs read their arguments and call these. Refuses: an event `validateEvent` refuses (it throws `<kind> (<actor>):
// <why>`); a scene file that does not read. Nothing here touches the live day file: a floor is memory and the host's
// ledger. Implements: A8-SCENE-SCHEME §3–§5. Invariants (design §18): "live, replay, drills and scenes are one code
// path" (every event folds through fold.js); "a claim is not a record" (a failed expectation is a row and an event,
// never a throw). Faults (§16): none raised.
import { createHash } from 'node:crypto'
import { sym } from '../../../lacuna-scheme/src/reader.js'
import { createFold, fold as foldEvents, tick, actor as actorOf, snapshot, registry } from './fold.js'
import { readScene, judge, evalPred, SCENE_AT } from './scene.js'
import { kinds, validateEvent } from './validate.js'

/** A snapshot's or a text's hash, `sha256:<hex>`. @param {string} text @return {string} */
export const sha256 = (text) => `sha256:${createHash('sha256').update(String(text)).digest('hex')}`

/**
 * A floor's state: its fold, its clock in ms, its events and due rows, its verdict counts, the actors it has seen.
 * @param {{id: string, sceneName: string, f: !Object, logTMs: (number|undefined), srcSeq: (number|undefined),
 *     events: (!Array|undefined), params: (!Object|undefined), actorsSeen: !Set<string>}} o
 * @return {!Object}
 */
export function newFloor({ id, sceneName, f, logTMs = 0, srcSeq = 0, events = [], params = {}, actorsSeen }) {
  return {
    id,
    sceneName,
    epoch: f.epoch,
    f,
    logTMs,
    seq: f.seq,
    srcSeq,
    events,
    due: [],
    order: 0,
    verdicts: [],
    passes: 0,
    fails: 0,
    scoreSpec: null,
    presses: new Map(),
    params,
    actorsSeen,
  }
}

/**
 * The floor's row in the host's ledger and in a verb's answer (open, close, a replay's open).
 * @param {!Object} st @param {{runId: string, cartName: string, action: string, hash: string, score: *, at: number}} o
 * @return {!Object}
 */
export function floorRow(st, { runId, cartName, action, hash, score, at }) {
  return {
    run: runId,
    cart: cartName,
    floor: st.id,
    scene: st.sceneName,
    action,
    events: st.events.length,
    actors: registry(st.f).size,
    passes: st.passes,
    fails: st.fails,
    hash,
    score,
    at,
  }
}

/**
 * Stamps one event onto the floor (its seq, its time, its source the scene), validates it, and folds it.
 * @param {!Object} st @param {string} kind @param {string} actor @param {?string} ref @param {?Object} data
 * @param {number} atMs
 * @return {!Object} the event
 * @throws {Error} `<kind> (<actor>): <why>` when the event does not validate
 */
export function stampAndFold(st, kind, actor, ref, data, atMs) {
  const cat = kinds()
  const k = cat.get(kind)
  const ev = {
    seq: ++st.seq,
    t: st.epoch + atMs,
    kind,
    actor,
    at: k?.at ? SCENE_AT : '-',
    ref: ref ?? (k?.ref ? actor : null),
    src: [`scene:${st.sceneName}`, ++st.srcSeq],
    data: data ?? {},
  }
  const v = validateEvent(ev)
  if (!v.ok) throw new Error(`${kind} (${actor}): ${v.why}`)
  st.events.push(ev)
  st.actorsSeen.add(actor)
  foldEvents(st.f, [ev])
  return ev
}

/**
 * Plays the floor's due rows up to `targetMs` in time order: events fold, expectations are judged and counted, and
 * the clock stands at `targetMs`.
 * @param {!Object} st @param {number} targetMs
 */
export function advanceTo(st, targetMs) {
  st.due.sort((a, b) => a.at - b.at || a.order - b.order)
  while (st.due.length > 0 && st.due[0].at <= targetMs) {
    const item = st.due.shift()
    st.logTMs = item.at
    tick(st.f, st.logTMs / 1000)
    const ctx = { presses: st.presses, atMs: item.at, f: st.f, params: st.params }
    if (item.when && !evalPred(item.when, ctx)) continue
    if (item.unless && evalPred(item.unless, ctx)) continue
    if (item.type === 'ev') {
      let data = item.data
      if (item.kind === 'mind.turn.done' && data.ms == null) {
        const turn = actorOf(st.f, item.actor)?.turn
        data = { ...data, ms: turn ? Math.max(0, Math.round(item.at - (turn.startT * 1000 + st.f.epoch - st.epoch))) : 0 }
      }
      stampAndFold(st, item.kind, item.actor, item.ref, data, item.at)
    } else if (item.type === 'expect') {
      const res = judge(item, st.f, st.logTMs / 1000)
      if (res.ok) st.passes++
      else st.fails++
      st.verdicts.push({ at: item.at, actor: item.actor, ...res })
      stampAndFold(st, 'scene.verdict', 'lacuna', null, {
        check: `${item.actor}@${item.at}`.slice(0, 60),
        ok: res.ok,
        why: res.ok ? String(item.why).slice(0, 200) : `want ${JSON.stringify(res.want)}, got ${JSON.stringify(res.got)}: ${item.why}`.slice(0, 200),
      }, item.at)
    }
  }
  st.logTMs = targetMs
  tick(st.f, st.logTMs / 1000)
}

/**
 * Opens a scene's floor: the scene file's rows due (or, with no file, a begin and a beat), its ledger row written.
 * @param {!Object} host @param {{cartName: string, runId: string, name: string, params: !Object}} o
 * @return {{st: !Object, row: !Object}}
 * @throws {Error} the scene file does not read, or an event does not validate
 */
export function openScene(host, { cartName, runId, name, params }) {
  const floorId = `eval:${cartName}:${name}`
  const f = createFold({ epoch: host.epoch })
  const st = newFloor({ id: floorId, sceneName: name, f, params, actorsSeen: new Set(['lacuna', 'foreman', 'box']) })
  const raw = host.readSceneFile(name)
  if (raw != null) {
    const parsed = readScene(raw, params)
    if (!parsed.ok) throw new Error(`the scene ${name} does not read: ${parsed.why}`)
    st.scoreSpec = parsed.scene.score
    st.params = parsed.scene.params
    for (const a of parsed.scene.actors) st.actorsSeen.add(a)
    for (const r of parsed.scene.rows) {
      if (r.type === 'ev' && (r.kind === 'scene.begin' || r.kind === 'scene.end')) continue
      st.due.push({ ...r, order: ++st.order })
    }
    stampAndFold(st, 'scene.begin', 'lacuna', null, { name, secs: parsed.scene.secs, by: parsed.scene.by || 'cart' }, 0)
    advanceTo(st, 0)
  } else {
    stampAndFold(st, 'scene.begin', 'lacuna', null, { name, secs: 60, by: 'cart' }, 0)
    stampAndFold(st, 'foreman.beat', 'foreman', null, { living: 1, total: 1 }, 0)
  }
  host.openFloors.set(floorId, st)
  const row = floorRow(st, {
    runId, cartName, action: 'open', hash: sha256(snapshot(st.f, 0)), score: null, at: Math.round(st.epoch / 1000),
  })
  host.ledger.push({ kind: 'floor-scene', ...row })
  return { st, row }
}

/**
 * Closes a scene's floor: its score judged (win, lose, none, or null with no score), its end stamped, its ledger row
 * written.
 * @param {!Object} host @param {!Object} st @param {{cartName: string, runId: string}} o
 * @return {!Object} the row, its score a symbol
 */
export function closeScene(host, st, { cartName, runId }) {
  let score = null
  if (st.scoreSpec) {
    const ctx = { presses: st.presses, atMs: st.logTMs, f: st.f, params: st.params }
    score = st.scoreSpec.win && evalPred(st.scoreSpec.win, ctx)
      ? 'win'
      : st.scoreSpec.lose && evalPred(st.scoreSpec.lose, ctx)
      ? 'lose'
      : 'none'
  }
  stampAndFold(st, 'scene.end', 'lacuna', null, { name: st.sceneName, score }, st.logTMs)
  const row = floorRow(st, {
    runId,
    cartName,
    action: 'close',
    hash: sha256(snapshot(st.f, st.logTMs / 1000)),
    score: score ? sym(score) : null,
    at: Math.round((st.epoch + st.logTMs) / 1000),
  })
  host.ledger.push({ kind: 'floor-scene', ...row, score })
  host.openFloors.delete(st.id)
  return row
}

/**
 * Opens a replay floor from recorded day events (a beat first when the window has none), its ledger row written.
 * @param {!Object} host
 * @param {{cartName: string, runId: string, events: !Array, day: string, fromT: number, toT: number}} o
 * @return {!Object} the floor
 */
export function replayFloor(host, { cartName, runId, events, day, fromT, toT }) {
  const floorId = `eval:${cartName}:replay:${day}`
  const f = createFold({ epoch: fromT })
  if (!events.some((e) => e.kind === 'foreman.beat')) {
    foldEvents(f, [{ seq: 0, t: fromT, kind: 'foreman.beat', actor: 'foreman', at: '-', ref: null, src: ['foreman-health', 0], data: { living: 1, total: 1 } }])
  }
  foldEvents(f, events)
  const logTMs = Math.max(0, toT - f.epoch)
  tick(f, logTMs / 1000)
  const st = newFloor({ id: floorId, sceneName: `replay:${day}`, f, logTMs, srcSeq: events.length, events: [...events],
    actorsSeen: new Set(events.map((e) => e.actor).filter(Boolean)) })
  host.openFloors.set(floorId, st)
  const hash = sha256(snapshot(f, logTMs / 1000))
  const row = floorRow(st, { runId, cartName, action: 'open', hash, score: null, at: Math.round(fromT / 1000) })
  host.ledger.push({ kind: 'floor-scene', ...row })
  return st
}

/**
 * A failed expectation: counted, a row in the ledger and in the truth report, and a `scene.verdict` event; never a
 * throw.
 * @param {!Object} host @param {!Object} st
 * @param {{runId: string, cartName: string, check: string, actor: string, want: string, got: string, detail: string,
 *     why: string}} o
 * @return {boolean} false
 */
export function recordFail(host, st, { runId, cartName, check, actor, want, got, detail, why }) {
  st.fails++
  const row = {
    run: runId,
    cart: cartName,
    floor: st.id,
    scene: st.sceneName,
    check,
    action: 'fail',
    actor,
    want,
    got,
    detail,
    logt: st.logTMs,
    at: Math.round((st.epoch + st.logTMs) / 1000),
  }
  host.ledger.push({ kind: 'floor-expect', ...row })
  host.reports.push({ kind: 'truth', ...row })
  stampAndFold(st, 'scene.verdict', 'lacuna', null, {
    check: check.slice(0, 60),
    ok: false,
    why: why.slice(0, 200),
  }, st.logTMs)
  return false
}
