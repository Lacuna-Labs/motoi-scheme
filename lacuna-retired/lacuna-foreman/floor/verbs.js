// verbs.js — THE TWELVE FLOOR VERBS FOR SCHEME CARTS AND TESTS (lane CL-UX Part A / F5-H; A8-SCENE-SCHEME §3). In the
// foreman's floor beside the fold and the scene player it drives (the lead's review moved it out of lacuna-scheme: the
// language never imports the foreman). The floor's mechanics are eval-floor.js's and the arguments' Scheme values
// alist.js's (split by responsibility, finale order §3.16 unit 4); this module reads each verb's arguments, holds the
// open floor, and binds the verbs. Owns: `floor-scene`, `floor-emit`, `floor-tick`, `floor-wait`, `floor-actor`,
// `floor-expect`, `floor-snapshot`, `floor-probe`, `floor-place`, `floor-camera`, `floor-say`, `floor-replay`, the
// `LIMITS` table, `FLOOR_VERBS_META`, and `installFloorVerbs(env, opts)` which binds the twelve verbs into a Lacuna
// Scheme environment over an isolated in-memory eval floor (`eval:<cart>:<scene>`). Refuses: touching the live day file
// (an eval floor is memory only); a second open floor without closing the first; more than `LIMITS.floors` (8) open
// floors in one host; `floor-emit` in the past (`at < logT`) or with an event that `validateEvent` refuses; a
// secret-shaped string in `floor-say` (law 7); throwing on a failed `floor-expect` (a failure is a verdict row with a
// `why` and `#f`, never a throw). Implements: docs/eng/floor-5.0/A8-SCENE-SCHEME.md §3–§5;
// docs/lanes/1.0/tasks/CL-UX-floor-desk-ide-chat.md Part A. Invariants (design §18): "live, replay, drills and scenes
// are one code path"; "a claim is not a record" (law 6); "nothing prints a token" (law 7). Faults (§16): none raised;
// misuse throws a one-sentence refusal.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sym, Pair } from '../../../lacuna-scheme/src/reader.js'
import { apply, Closure } from '../../../lacuna-scheme/src/interp.js'
import { actor as actorOf, pose as poseOf, snapshot, registry } from './fold.js'
import { judge, CHECKS, SCENE_AT } from './scene.js'
import { kinds, validateEvent } from './validate.js'
import { atom, alistToObj, pairToArray, objToAlist, getField } from './alist.js'
import { advanceTo, closeScene, openScene, recordFail, replayFloor, sha256, stampAndFold } from './eval-floor.js'

/** Bounds for eval floors and the twelve verbs (A8 §3). */
export const LIMITS = Object.freeze({
  floors: 8,
  sceneEvents: 4000,
  sceneActors: 256,
  sceneSecs: 600,
  floorWaitSteps: 4000,
  snapshotChars: 256_000,
  replayRows: 2000,
  sayChars: 200,
  slotCount: 64,
  placeDurMs: 10_000,
  fovMin: 20,
  fovMax: 90,
})

const SCENE_NAME = /^[a-z][a-z0-9-]{0,39}$/
const DRILLS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'drills')

// Token/secret detector for law 7 on floor-say (matches sk-ant, sk-, ghp_, hf_, AIza, Bearer, PEM, and key=value secrets).
const SECRET_RE = /\b(?:sk-ant-[A-Za-z0-9_-]{12,}|sk-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{20,}|hf_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{20,}|Bearer\s+[A-Za-z0-9._-]{12,}|(?:token|password|secret|api[_-]?key)\s*[:=]\s*['"]?[A-Za-z0-9._-]{8,})\b|-----BEGIN [A-Z ]*PRIVATE KEY-----/i

/**
 * Creates a shared floor host that tracks open eval floors (`LIMITS.floors` max), ledger rows, and optional probe callbacks.
 * @param {{epoch?: number, readSceneFile?: (name: string) => ?string, probe?: (floorId: string, actorId: string) => Object, maxFloors?: number}=} opts
 * @return {!Object}
 */
export function createFloorHost(opts = {}) {
  const openFloors = new Map()
  const ledger = []
  const reports = []
  const epoch = opts.epoch ?? Date.UTC(2026, 10, 1, 12, 0, 0)
  const maxFloors = opts.maxFloors ?? LIMITS.floors
  const readSceneFile = opts.readSceneFile ?? ((name) => {
    const p = path.join(DRILLS_DIR, `${name}.slat`)
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null
  })
  return { openFloors, ledger, reports, epoch, maxFloors, readSceneFile, probe: opts.probe ?? null }
}

const FLOOR_VERB_META = [
  ['floor-scene', 1, 'Open, close, or inspect this worker\'s isolated eval floor.', '(floor-scene \'open "stall")'],
  ['floor-emit', 3, 'Validate and queue or fold one event onto the open eval floor.', '(floor-emit \'run.start "w-1" \'((mind "e4b")))'],
  ['floor-tick', 1, 'Advance the open eval floor\'s logical clock by ms and fold due rows.', '(floor-tick 1000)'],
  ['floor-wait', 2, 'Step the eval floor forward until pred returns true or deadline-ms is reached.', '(floor-wait (lambda () #t) 5000)'],
  ['floor-actor', 1, 'Read one actor\'s folded state, pose, lights, and counters as an alist.', '(floor-actor "lacuna")'],
  ['floor-expect', 2, 'Assert actor fields or a boolean condition; records a verdict with why on failure and never throws.', '(floor-expect "up" #t "lacuna is up")'],
  ['floor-snapshot', 0, 'Return the canonical `(state …)` keyframe with quantized poses and its sha256 hash.', '(floor-snapshot)'],
  ['floor-probe', 1, 'Query an attached renderer for an actor\'s instance state, matrix, and screen rect.', '(floor-probe "e4b")'],
  ['floor-place', 3, 'Emit a `scene.place` layout target (slot or coordinates) for an actor.', '(floor-place "e4b" \'slot 3)'],
  ['floor-camera', 1, 'Emit a `scene.camera` director hint toward an actor or `\'home`.', '(floor-camera \'home 1200 45)'],
  ['floor-say', 1, 'Emit a `scene.say` line (≤ 200 chars, secret-checked under law 7).', '(floor-say "all checks green")'],
  ['floor-replay', 1, 'Open a replay floor from a window of recorded day events (≤ 2,000 rows).', '(floor-replay reply)'],
]

/** Metadata table for the twelve floor verbs. */
export const FLOOR_VERBS_META = Object.freeze(FLOOR_VERB_META.map(([name, arity, doc, example]) => ({
  name,
  arity,
  doc,
  examples: [{ level: 'novice', code: example }],
  namespace: 'floor',
  perm: 'read',
  tier: 'watch',
  source: 'lacuna-foreman/floor/verbs.js',
})))

/**
 * Installs the twelve `floor-*` verbs into `env`.
 * @param {!Object} env a Lacuna Scheme Env
 * @param {{host?: !Object, cart?: string, runId?: string, epoch?: number, fuel?: {n: number}, readSceneFile?: (name: string) => ?string, probe?: (floorId: string, actorId: string) => Object}=} opts
 * @return {!Object} env
 */
export function installFloorVerbs(env, opts = {}) {
  if (!env || typeof env.define !== 'function') {
    throw new TypeError('installFloorVerbs: expected an Env with .define')
  }
  const host = opts.host ?? createFloorHost(opts)
  const cartName = opts.cart ?? 'cart'
  const runId = opts.runId ?? 'w-eval'
  const fuelBox = opts.fuel ?? { n: 500_000 }
  let current = null

  const requireFloor = () => {
    if (!current) throw new Error('no floor is open: (floor-scene \'open …) first')
    return current
  }

  const floorSceneVerb = (actionSym, nameArg, paramsArg) => {
    const action = String(atom(actionSym))
    if (action === 'status') {
      if (!current) return false
      return objToAlist({
        floor: current.id,
        scene: current.sceneName,
        logt: current.logTMs,
        events: current.events.length,
        actors: registry(current.f).size,
        passes: current.passes,
        fails: current.fails,
      })
    }
    if (action === 'open') {
      if (current) throw new Error(`a floor is already open (${current.id}): close it first`)
      const name = String(atom(nameArg) ?? '')
      if (!SCENE_NAME.test(name)) throw new Error(`the name ${JSON.stringify(name)} is not a scene name ([a-z][a-z0-9-]{0,39})`)
      if (host.openFloors.size >= host.maxFloors) {
        throw new Error(`more than ${host.maxFloors} floors are open in this foreman`)
      }
      const { st, row } = openScene(host, { cartName, runId, name, params: alistToObj(paramsArg) })
      current = st
      return objToAlist(row)
    }
    if (action === 'close') {
      const row = closeScene(host, requireFloor(), { cartName, runId })
      current = null
      return objToAlist(row)
    }
    throw new Error(`floor-scene: unknown action ${JSON.stringify(action)}; expected 'open, 'close, or 'status`)
  }

  const floorEmitVerb = (kindSym, actorArg, dataArg, atMsArg) => {
    const st = requireFloor()
    const kind = String(atom(kindSym))
    if (kind === 'scene.begin' || kind === 'scene.end') {
      throw new Error(`${kind} is written only by floor-scene, never by floor-emit`)
    }
    const actor = String(atom(actorArg))
    const atMs = atMsArg != null ? Number(atMsArg) : st.logTMs
    if (!Number.isFinite(atMs) || atMs < st.logTMs) {
      throw new Error(`the past is folded: emit at or after logT (${st.logTMs} ms)`)
    }
    if (atMs > LIMITS.sceneSecs * 1000) {
      throw new Error(`at ${atMs} ms is past the ${LIMITS.sceneSecs} s scene limit`)
    }
    if (st.events.length + st.due.length >= LIMITS.sceneEvents) {
      throw new Error(`the floor ${st.id} has ${LIMITS.sceneEvents} events: the scene is too long for one floor`)
    }
    if (!st.actorsSeen.has(actor) && st.actorsSeen.size >= LIMITS.sceneActors) {
      throw new Error(`the floor ${st.id} has ${LIMITS.sceneActors} actors: at most ${LIMITS.sceneActors} allowed`)
    }
    const data = alistToObj(dataArg)
    const ref = data.ref != null ? String(data.ref) : null
    delete data.ref
    // Validate the candidate event immediately so schema errors fail at the call site.
    const cat = kinds()
    const k = cat.get(kind)
    if (!k) throw new Error(`unknown event kind ${kind}`)
    const probeEv = {
      seq: st.seq + 1,
      t: st.epoch + atMs,
      kind,
      actor,
      at: k.at ? SCENE_AT : '-',
      ref: ref ?? (k.ref ? actor : null),
      src: [`scene:${st.sceneName}`, st.srcSeq + 1],
      data,
    }
    const v = validateEvent(probeEv)
    if (!v.ok) throw new Error(`${kind}: ${v.why}`)
    st.actorsSeen.add(actor)
    if (atMs === st.logTMs) {
      stampAndFold(st, kind, actor, ref, data, atMs)
    } else {
      st.due.push({ type: 'ev', at: atMs, kind, actor, ref, data, order: ++st.order })
    }
    return atMs
  }

  const floorTickVerb = (msArg) => {
    const st = requireFloor()
    const ms = Number(msArg)
    if (!Number.isFinite(ms) || ms < 1 || ms > LIMITS.sceneSecs * 1000) {
      throw new Error(`floor-tick ms must be 1 to ${LIMITS.sceneSecs * 1000} (got ${msArg})`)
    }
    advanceTo(st, st.logTMs + ms)
    return st.logTMs
  }

  const floorWaitVerb = (pred, deadlineMsArg, stepMsArg) => {
    const st = requireFloor()
    if (typeof pred !== 'function' && !(pred instanceof Closure)) {
      throw new Error('floor-wait requires a procedure as its first argument')
    }
    const deadlineMs = Number(deadlineMsArg)
    const stepMs = stepMsArg != null ? Number(stepMsArg) : 250
    if (!Number.isFinite(deadlineMs) || deadlineMs < 0 || !Number.isFinite(stepMs) || stepMs <= 0) {
      throw new Error('floor-wait requires a positive deadline-ms and step-ms')
    }
    const maxSteps = Math.ceil(deadlineMs / stepMs)
    if (maxSteps > LIMITS.floorWaitSteps) {
      throw new Error(`floor-wait exceeds ${LIMITS.floorWaitSteps} steps (${maxSteps} requested)`)
    }
    const callPred = () => (typeof pred === 'function' ? pred() : apply(pred, [], fuelBox))
    if (callPred() !== false) return 0
    let waited = 0
    while (waited < deadlineMs) {
      const delta = Math.min(stepMs, deadlineMs - waited)
      advanceTo(st, st.logTMs + delta)
      waited += delta
      if (callPred() !== false) return waited
    }
    return false
  }

  const floorActorVerb = (idArg) => {
    const st = requireFloor()
    const id = String(atom(idArg))
    const rec = actorOf(st.f, id)
    if (!rec) return false
    const logTSec = st.logTMs / 1000
    const p = poseOf(st.f, id, logTSec)
    const sinceMs = Math.round((rec.since ?? 0) * 1000)
    const ageMs = Math.max(0, Math.round(st.logTMs - sinceMs))
    return objToAlist({
      id: rec.id,
      kind: sym(String(rec.kind)),
      state: sym(String(rec.state)),
      cause: rec.cause ? sym(String(rec.cause)) : null,
      'since-ms': sinceMs,
      'age-ms': ageMs,
      slot: rec.slot ?? null,
      at: rec.at ?? '-',
      pose: p || [],
      lights: objToAlist(rec.lights ?? {}),
      counters: objToAlist(rec.counters ?? {}),
    })
  }

  const floorExpectVerb = (nameArg, secondArg, thirdArg) => {
    const st = requireFloor()
    const checkName = String(atom(nameArg))
    // Boolean form: (floor-expect "name" ok? "why")
    if (typeof secondArg === 'boolean') {
      if (typeof thirdArg !== 'string' || !thirdArg.trim()) {
        throw new Error('floor-expect boolean form requires a non-empty why string')
      }
      if (secondArg) {
        st.passes++
        return true
      }
      return recordFail(host, st,
        { runId, cartName, check: checkName, actor: 'lacuna', want: '#t', got: '#f', detail: thirdArg, why: thirdArg })
    }
    // Actor field form: (floor-expect "name" "actor" '((state . failed) ...))
    const actor = String(atom(secondArg))
    const rawChecks = thirdArg instanceof Pair ? pairToArray(thirdArg) : Array.isArray(thirdArg) ? thirdArg : []
    if (!rawChecks.length) throw new Error('floor-expect requires at least one check clause')
    const checks = {}
    for (const item of rawChecks) {
      let k, args
      if (item instanceof Pair) {
        k = String(atom(item.car))
        const cdr = item.cdr
        args = cdr instanceof Pair ? pairToArray(cdr).map(atom) : [atom(cdr)]
      } else if (Array.isArray(item) && item.length >= 2) {
        k = String(atom(item[0]))
        args = item.length === 2 && Array.isArray(item[1]) ? item[1].map(atom) : item.slice(1).map(atom)
      } else {
        throw new Error('floor-expect clause must be a pair or list')
      }
      if (!CHECKS.includes(k)) {
        throw new Error(`floor-expect compares ${CHECKS.join(' ')}; not \`${k}\``)
      }
      checks[k] = args
    }
    const res = judge({ actor, checks, why: checkName }, st.f, st.logTMs / 1000)
    if (res.ok) {
      st.passes++
      return true
    }
    const wantStr = Object.entries(res.want).map(([k, v]) => `(${k} ${v})`).join(' ')
    const gotStr = Object.entries(res.got).map(([k, v]) => `(${k} ${v})`).join(' ')
    const why = `want ${wantStr}, got ${gotStr}`
    return recordFail(host, st,
      { runId, cartName, check: checkName, actor, want: wantStr, got: gotStr, detail: checkName, why })
  }

  const floorSnapshotVerb = () => {
    const st = requireFloor()
    const raw = snapshot(st.f, st.logTMs / 1000)
    const digest = sha256(raw)
    const withHash = `${raw.slice(0, -1)} (hash "${digest}"))`
    if (withHash.length > LIMITS.snapshotChars) {
      throw new Error(`the snapshot is ${withHash.length} characters; a floor this large is not for a cart`)
    }
    return withHash
  }

  const floorProbeVerb = (actorArg) => {
    const st = requireFloor()
    const actor = String(atom(actorArg))
    if (typeof host.probe === 'function') {
      const ans = host.probe(st.id, actor, st)
      if (ans && ans.ok) {
        return objToAlist({
          ok: true,
          actor,
          state: ans.state ?? [0, 0, 0, 0],
          matrix: ans.matrix ?? [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
          rect: ans.rect ?? [0, 0, 0, 0],
          logt: st.logTMs,
          agree: ans.agree !== false,
          why: ans.why ?? 'matched',
        })
      }
    }
    return objToAlist({
      ok: false,
      why: `no renderer is attached to ${st.id}`,
    })
  }

  const floorPlaceVerb = (actorArg, modeSym, targetArg, durMsArg) => {
    const st = requireFloor()
    const actor = String(atom(actorArg))
    if (!actorOf(st.f, actor)) throw new Error(`actor ${JSON.stringify(actor)} is not on the floor`)
    const mode = String(atom(modeSym))
    const durMs = durMsArg != null ? Number(durMsArg) : 600
    if (!Number.isFinite(durMs) || durMs < 0 || durMs > LIMITS.placeDurMs) {
      throw new Error(`floor-place dur-ms must be 0 to ${LIMITS.placeDurMs}`)
    }
    let slotStr
    if (mode === 'slot') {
      const slot = Number(targetArg)
      if (!Number.isInteger(slot) || slot < 0 || slot >= LIMITS.slotCount) {
        throw new Error(`slot ${targetArg} does not exist: lane C's layout has ${LIMITS.slotCount}`)
      }
      slotStr = `slot:${slot}`
    } else if (mode === 'to') {
      const coords = targetArg instanceof Pair ? pairToArray(targetArg) : Array.isArray(targetArg) ? targetArg : []
      if (coords.length !== 3 || !coords.every((n) => Number.isFinite(Number(n)))) {
        throw new Error('floor-place \'to requires a list of three numbers (x y z)')
      }
      slotStr = coords.map((n) => Number(n).toFixed(1)).join(',')
    } else {
      throw new Error(`floor-place mode must be 'slot or 'to (got ${mode})`)
    }
    stampAndFold(st, 'scene.place', actor, null, { actor, slot: slotStr.slice(0, 24) }, st.logTMs)
    return true
  }

  const floorCameraVerb = (targetArg, durMsArg, fovArg) => {
    const st = requireFloor()
    const target = String(atom(targetArg))
    const ms = durMsArg != null ? Number(durMsArg) : 1200
    if (!Number.isFinite(ms) || ms < 0 || ms > LIMITS.placeDurMs) {
      throw new Error(`floor-camera dur-ms must be 0 to ${LIMITS.placeDurMs}`)
    }
    if (fovArg != null) {
      const fov = Number(fovArg)
      if (!Number.isFinite(fov) || fov < LIMITS.fovMin || fov > LIMITS.fovMax) {
        throw new Error(`fov ${fovArg} is outside ${LIMITS.fovMin} to ${LIMITS.fovMax}`)
      }
    }
    stampAndFold(st, 'scene.camera', 'lacuna', null, { target: target.slice(0, 300), ms: Math.round(ms) }, st.logTMs)
    return true
  }

  const floorSayVerb = (textArg, actorArg) => {
    const st = requireFloor()
    const text = String(textArg ?? '')
    if (text.length > LIMITS.sayChars) {
      throw new Error(`floor-say text runs ${text.length} characters; at most ${LIMITS.sayChars}`)
    }
    if (SECRET_RE.test(text)) {
      throw new Error('a line never holds a secret')
    }
    const actor = actorArg != null ? String(atom(actorArg)) : 'lacuna'
    stampAndFold(st, 'scene.say', actor, null, { actor, text: text.slice(0, 120) }, st.logTMs)
    return true
  }

  const floorReplayVerb = (replyArg) => {
    const ok = getField(replyArg, 'ok')
    if (ok === false) {
      const why = getField(replyArg, 'why') || 'hand floor-events refused'
      throw new Error(`floor-replay refused: ${why}`)
    }
    const cut = getField(replyArg, 'cut')
    if (cut === true) {
      throw new Error(`the window holds more than ${LIMITS.replayRows} events: ask a smaller one`)
    }
    const rawEvents = getField(replyArg, 'events') ?? getField(replyArg, 'result') ?? []
    const events = rawEvents instanceof Pair ? pairToArray(rawEvents) : Array.isArray(rawEvents) ? rawEvents : []
    if (events.length > LIMITS.replayRows) {
      throw new Error(`the window holds more than ${LIMITS.replayRows} events: ask a smaller one`)
    }
    const allowDrills = Boolean(getField(replyArg, 'drills') || getField(replyArg, 'allowDrills'))
    for (const ev of events) {
      const kind = String(getField(ev, 'kind') ?? ev.kind ?? '')
      const src0 = Array.isArray(ev.src) ? String(ev.src[0]) : String(getField(ev, 'src') ?? '')
      if (!allowDrills && (kind.startsWith('scene.') || src0.startsWith('drill:') || src0.startsWith('scene:'))) {
        throw new Error(`floor-replay refuses drill or scene event (${kind}) unless drills are requested`)
      }
    }
    const day = String(getField(replyArg, 'day') ?? '2026-10-29')
    const fromT = events.length ? Number(events[0].t ?? getField(events[0], 't') ?? host.epoch) : host.epoch
    const toT = events.length ? Number(events[events.length - 1].t ?? getField(events[events.length - 1], 't') ?? fromT) : fromT
    if (current) {
      host.openFloors.delete(current.id)
      current = null
    }
    current = replayFloor(host, { cartName, runId, events, day, fromT, toT })
    return objToAlist({
      events: events.length,
      from: fromT,
      to: toT,
      logt: current.logTMs,
    })
  }

  const table = {
    'floor-scene': floorSceneVerb,
    'floor-emit': floorEmitVerb,
    'floor-tick': floorTickVerb,
    'floor-wait': floorWaitVerb,
    'floor-actor': floorActorVerb,
    'floor-expect': floorExpectVerb,
    'floor-snapshot': floorSnapshotVerb,
    'floor-probe': floorProbeVerb,
    'floor-place': floorPlaceVerb,
    'floor-camera': floorCameraVerb,
    'floor-say': floorSayVerb,
    'floor-replay': floorReplayVerb,
  }

  const metaByName = new Map(FLOOR_VERB_META.map(([n, ar, doc, ex]) => [n, { ar, doc, ex }]))
  for (const [name, fn] of Object.entries(table)) {
    const m = metaByName.get(name)
    env.define(name, fn, {
      perm: 'read',
      name,
      arity: m ? m.ar : null,
      doc: m ? m.doc : null,
      examples: m ? [{ level: 'novice', code: m.ex }] : [],
      namespace: 'floor',
      tier: 'watch',
      source: 'lacuna-foreman/floor/verbs.js',
    })
  }
  return env
}
