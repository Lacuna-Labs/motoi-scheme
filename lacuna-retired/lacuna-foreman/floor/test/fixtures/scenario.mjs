// scenario.mjs — A FAKE CLOCK OVER THE FOLD (lane F5-BC test fixture). Owns: a small builder for event sequences at explicit
// seconds, folded into a fresh fold in time order, with `at(s)` sampling a record's state with the fold settled at that
// logT, so every on/off delay is asserted a second before and a second after its boundary (A3 §9); a heartbeat every
// `beats` seconds keeps the foreman fresh unless a test turns it off to study staleness. Refuses: a wall clock, a mock of
// the fold.
import { createFold, fold, tick, actor } from '../../fold.js'

/** 2026-10-30 11:00:00 UTC. */
export const EPOCH = 1793386800000

/**
 * A scenario: `ev(s, kind, actor, data, o)` queues an event at `s` seconds; `to(s)` folds everything due by `s` in time
 * order and settles there; `at(s, id)` returns the record; `state(s, id)` its state.
 * @param {{beats?: number}=} o a foreman beat every `beats` seconds (10 by default; 0 for none)
 * @return {!Object}
 */
export function scenario(o = {}) {
  const every = o.beats ?? 10
  const f = createFold({ epoch: EPOCH })
  const queue = []
  let seq = 0
  let foldedTo = -Infinity
  let lastBeat = -1
  const api = {
    f,
    ev(s, kind, actorId, data = {}, opt = {}) {
      if (s < foldedTo) throw new Error(`scenario: an event at ${s} s behind the folded time ${foldedTo} s (the fold never runs backwards; order the test)`)
      queue.push({ s, t: EPOCH + Math.round(s * 1000), kind, actor: actorId, at: opt.at ?? (/^(run|sentry|hands)\.|^mind\.turn\./.test(kind) ? 'studio·foreman·-·-·-·-' : '-'), ref: opt.ref ?? (/^(run|sentry|hands|press|wo)\./.test(kind) ? (opt.run ?? (kind.startsWith('wo.') ? actorId : /^w-/.test(actorId) ? actorId : (actorId.split(':')[1] ?? actorId))) : null), src: ['scenario', queue.length + 1], data, done: false })
      return api
    },
    /** Folds the queue up to `s` seconds (with the heartbeats due) and settles there. */
    to(s) {
      const due = queue.filter((e) => !e.done && e.s <= s)
      if (every > 0) for (let b = Math.floor(lastBeat / every) * every + every; b <= s; b += every) { if (b > lastBeat) due.push({ s: b, t: EPOCH + b * 1000, kind: 'foreman.beat', actor: 'foreman', at: '-', ref: null, src: ['scenario-beat', b], data: { living: 0, 'lag-ms': 2, 'rss-mb': 188, drops: 0 }, done: false, beat: true }) }
      due.sort((a, b) => a.s - b.s)
      for (const e of due) {
        e.done = true
        e.seq = ++seq
        if (e.beat) lastBeat = e.s
      }
      if (due.length) fold(f, due)
      foldedTo = Math.max(foldedTo, s)
      tick(f, s)
      return api
    },
    at(s, id) { api.to(s); return actor(f, id) },
    state(s, id) { return api.at(s, id)?.state ?? null },
    cause(s, id) { return api.at(s, id)?.cause ?? null },
  }
  return api
}

/** A loaded, resident mind at `s` seconds: load.start at s, load.done at s + 1, engine.up at s + 1.1. */
export function loadMind(sc, id, s, bytes) {
  sc.ev(s, 'mind.load.start', id, { 'need-mb': 4900, 'available-mb': 9000, ...(bytes ? { bytes } : {}) })
  sc.ev(s + 1, 'mind.load.done', id, { 'hot-mb': 4901, 'arena-mb': 1573, 'warm-ms': 96 })
  sc.ev(s + 1.1, 'mind.engine.up', id, { pid: 41022, 'uptime-s': 120, served: 1, failed: 0, restart: false })
  return sc
}

/** A foreman beat at `s` with `living` runs. */
export function beat(sc, s, living = 0) {
  return sc.ev(s, 'foreman.beat', 'foreman', { living, 'lag-ms': 2, 'rss-mb': 188, drops: 0 })
}

/** Beats from `from` to `to` every `every` seconds. */
export function beats(sc, from, to, every = 10, living = 0) {
  for (let s = from; s <= to; s += every) beat(sc, s, living)
  return sc
}

/** A run filed at `s`, started at `s + 1` with `brain`. */
export function startRun(sc, id, s, brain = 'e4b', plan = 7) {
  sc.ev(s, 'run.filed', id, { key: 'fix', cart: null, goal: 'fix a red watchdog', by: 'owner', desk: false, tier: 'act', parent: null, plan })
  sc.ev(s + 1, 'run.start', id, { brain, plan })
  return sc
}
