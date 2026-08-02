// tests/p0-core-gap-fillers-2026-07-16.test.mjs
//
// P0 gap-filler tests for CORE verbs that were installed but had zero
// test coverage before 2026-07-16. Focus: happy-path + at least one
// edge or error case per verb.
//
// Verbs under test (grouped by module):
//   cortex/*        — remember, recall, forget, keys, size, query
//   entity/*        — all, count, ref, remove!, set!, tag!
//   time/*          — delta, every-ms, across, during, then, until, when
//   easing/*        — Sym constants (linear, spring, emphasized, ...)
//   font/*          — Sym constants (mono, big, tiny)
//   input/*         — set!, down?, pressed?, may-i?, buttons
//   sprite/*        — sprite, sprites, sprite/rasterize, sprite/address,
//                     sprite/landmarks
//   scene/*         — clear, spawn-many, grid, imagine, load
//   game/*          — frame, running?, state, step, stop
//   system/*        — health, registry
//   artifact/list   — headless-raise contract
//   random          — randint, random-int, random-pick, random-range
//   misc            — display, note, on-frame, on-key, stop, frame, big-bang
//
// Run: node --test tests/p0-core-gap-fillers-2026-07-16.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// ISOLATION fix (2026-08-01): the cortex is a PERSISTENT user-global store at
// $MOTOI_HOME/copilot/cortex.slatl (src/paths.js). Without this, every run of
// this file wrote its fixture keys (a, b, temp, planet, kx, ky, user/name)
// straight into Alfred's real cortex, and `cortex/size` assertions measured
// whatever happened to be in his home directory. That also made the size test
// pass once and fail forever after, because cortex/remember upserts by key —
// the second run found the keys already there and the count never moved.
// MOTOI_HOME must be set BEFORE core/index.js is imported, since paths.js
// resolves it at module load.
process.env.MOTOI_HOME = mkdtempSync(join(tmpdir(), 'motoi-p0-cortex-'))

const { makeCoreEnv } = await import('../core/index.js')
const { resetMediaState } = await import('../lib/media/media.js')
const { Sym, sym } = await import('../src/reader.js')

function fresh() {
  resetMediaState()
  return makeCoreEnv()
}

// The unified cortex (lib/ai/cortex.js, Alfred 2026-07-25) stores extensible
// records, not bare values: cortex/recall returns the record as an alist of
// (key value) pairs — :kind :id :key :data :salience :ts :provenance — and the
// remembered value rides in :data. Pull it back out for round-trip assertions.
// A string payload is stored as the record's searchable :text (that is what
// RAG matches on); any other value rides in the extensible :data slot.
const recallData = (recall, key) => {
  const rec = recall(key)
  if (!Array.isArray(rec)) return rec
  const field = (name) => {
    const hit = rec.find((p) => Array.isArray(p) && p[0] instanceof Sym && p[0].name === name)
    return hit ? hit[1] : undefined
  }
  const data = field(':data')
  return data === undefined ? field(':text') : data
}

// Small helpers.
const get = (env, name) => {
  assert.ok(env.vars.has(name), `verb ${name} not registered`)
  return env.vars.get(name)
}

// ── cortex/* ─────────────────────────────────────────────────────────

test('cortex/remember + recall — round-trip', () => {
  const env = fresh()
  const remember = get(env, 'cortex/remember')
  const recall   = get(env, 'cortex/recall')
  remember(sym('planet'), 'earth')
  // Unified cortex (2026-07-25) returns the whole record; the value is :data.
  assert.equal(recallData(recall, sym('planet')), 'earth')
})

test('cortex/recall — missing key returns null-ish', () => {
  const env = fresh()
  const recall = get(env, 'cortex/recall')
  const v = recall(sym('nope-nope'))
  // Undefined/null both acceptable — "no memory" semantic.
  assert.ok(v === undefined || v === null || v === false)
})

test('cortex/size — starts at 0; grows with remember', () => {
  const env = fresh()
  const size = get(env, 'cortex/size')
  const remember = get(env, 'cortex/remember')
  const start = size()
  remember(sym('a'), 1)
  remember(sym('b'), 2)
  assert.equal(size(), start + 2)
})

test('cortex/keys — returns list of remembered keys', () => {
  const env = fresh()
  const keys = get(env, 'cortex/keys')
  const remember = get(env, 'cortex/remember')
  remember(sym('kx'), 1)
  remember(sym('ky'), 2)
  const ks = keys()
  assert.ok(Array.isArray(ks))
  // Keys may come back as strings or Syms; normalize.
  const names = ks.map((k) => (k instanceof Sym ? k.name : String(k)))
  assert.ok(names.includes('kx'))
  assert.ok(names.includes('ky'))
})

test('cortex/forget — removes a stored key', () => {
  const env = fresh()
  const remember = get(env, 'cortex/remember')
  const forget   = get(env, 'cortex/forget')
  const recall   = get(env, 'cortex/recall')
  remember(sym('temp'), 999)
  assert.equal(recallData(recall, sym('temp')), 999)
  assert.equal(forget(sym('temp')), true, 'forget reports it dropped a record')

  // 2026-08-01: this used to assert recall goes null-ish after forget. That is
  // not what the unified cortex promises. The episodic memory tier is prunable,
  // but the four world-knowledge graphs are READ-ONLY and are merged into
  // recall as virtual :kind :knowledge records (lib/ai/cortex.js). The key
  // 'temp' collides with the knowledge node "intuition/temp", so recall keeps
  // answering — with knowledge, not memory. The contract cortex/forget actually
  // makes is "the MEMORY record is gone", so that is what we assert.
  const v = recall(sym('temp'))
  const kind = Array.isArray(v)
    ? v.find((p) => Array.isArray(p) && p[0] instanceof Sym && p[0].name === ':kind')?.[1]
    : undefined
  assert.ok(
    v === undefined || v === null || v === false || (kind instanceof Sym && kind.name === ':knowledge'),
    'after forget, no :memory record survives (world knowledge may still answer)',
  )

  // A key with no knowledge-graph twin goes fully quiet, confirming the drop.
  remember(sym('zzz-no-graph-twin'), 1)
  forget(sym('zzz-no-graph-twin'))
  const gone = recall(sym('zzz-no-graph-twin'))
  assert.ok(gone === undefined || gone === null || gone === false)
})

test('cortex/query — accepts a pattern and returns something iterable', () => {
  const env = fresh()
  const remember = get(env, 'cortex/remember')
  const query    = get(env, 'cortex/query')
  remember(sym('user/name'), 'alfa')
  const out = query(sym('user/name'))
  // Contract: returns list/array of matches (may be empty).
  assert.ok(out === undefined || out === null || Array.isArray(out) || typeof out === 'object')
})

// ── entity/* ─────────────────────────────────────────────────────────

test('entity/all — empty at boot', () => {
  const env = fresh()
  const all = get(env, 'entity/all')
  assert.deepEqual(all(), [])
})

test('entity/count — starts at 0', () => {
  const env = fresh()
  const count = get(env, 'entity/count')
  assert.equal(count(), 0)
})

test('entity/ref — unknown id returns NaN symbol (no throw)', () => {
  const env = fresh()
  const ref = get(env, 'entity/ref')
  const v = ref(sym('does-not-exist'), sym('hp'))
  // Contract: never throws for missing entity.
  assert.ok(v !== undefined)
})

test('entity/set! — safe on missing entity (no-op signal)', () => {
  const env = fresh()
  const set = get(env, 'entity/set!')
  const v = set(sym('ghost'), sym('hp'), 5)
  // 2026-08-01: this used to assert `undefined`, citing a "house convention"
  // that the reference does not support. Scheme/reference/24-entity.slat locks
  // entity/set! as "(entity/set! id key val) -> val" with no miss-path carve-out,
  // and BOTH implementations (lib/game/world.js and lib/game/game.js) return val
  // unconditionally. The reference is the language, so the assertion was the
  // thing that was wrong. The real contract under test here is "does not throw
  // on an unknown entity, and stores nothing".
  assert.equal(v, 5)
  const ref = get(env, 'entity/ref')
  // Nothing was stored, so the key is still missing → the 'nan sentinel.
  assert.equal(ref(sym('ghost'), sym('hp')).name, 'nan')
})

test('entity/tag! — false on unknown entity', () => {
  const env = fresh()
  const tag = get(env, 'entity/tag!')
  assert.equal(tag(sym('ghost'), sym('enemy')), false)
})

test('entity/remove! — false on unknown entity', () => {
  const env = fresh()
  const remove = get(env, 'entity/remove!')
  assert.equal(remove(sym('ghost')), false)
})

// ── time/* ───────────────────────────────────────────────────────────

test('time/delta — returns a number for known unit', () => {
  const env = fresh()
  const delta = get(env, 'time/delta')
  const v = delta(sym('ms'))
  assert.equal(typeof v, 'number', ':ms returns a number')
})

test('time/every-ms — returns a clause form (no side effect)', () => {
  const env = fresh()
  const every = get(env, 'time/every-ms')
  const clause = every(1000, () => 42)
  assert.ok(Array.isArray(clause))
  assert.ok(clause[0] instanceof Sym)
  assert.equal(clause[0].name, 'clause/every-ms')
})

test('time/during — clause form', () => {
  const env = fresh()
  const during = get(env, 'time/during')
  const c = during(() => true, () => 1)
  assert.ok(Array.isArray(c) && c[0] instanceof Sym && c[0].name === 'clause/during')
})

test('time/then — clause form', () => {
  const env = fresh()
  const then = get(env, 'time/then')
  const c = then('a', 'b')
  assert.ok(Array.isArray(c) && c[0] instanceof Sym && c[0].name === 'clause/then')
})

test('time/until — clause form', () => {
  const env = fresh()
  const until = get(env, 'time/until')
  const c = until(() => true, () => 1)
  assert.ok(Array.isArray(c) && c[0] instanceof Sym && c[0].name === 'clause/until')
})

test('time/when — clause form', () => {
  const env = fresh()
  const when = get(env, 'time/when')
  const c = when(() => true, () => 1)
  assert.ok(Array.isArray(c) && c[0] instanceof Sym && c[0].name === 'clause/when')
})

test('time/across — author-blocked placeholder returns marker', () => {
  const env = fresh()
  const across = get(env, 'time/across')
  const c = across()
  // Contract per source: returns [Sym('author-blocked'), ...]. Whatever
  // shape lands, it must be array-like with a Sym head.
  assert.ok(Array.isArray(c))
  assert.ok(c[0] instanceof Sym)
})

// ── easing/* — Sym constants ─────────────────────────────────────────

// 2026-08-01: this asserted the 10 easings were inert Sym constants. They are
// deliberately curve PROCEDURES now — lib/graphics/easing.js states the reason
// at the definition site: "Each `easing/<name>` is a curve procedure (t) ->
// eased-t, so the reference proof programs can call it directly — `(define e
// easing/emphasized) (e 0.42)` — AND it can still be handed to any `:easing`
// keyword, since easeFnFromArg accepts a procedure. Same binding object each
// lookup, so `(eq? easing/x easing/x)` holds." Same direction as const/* going
// from nullary functions to plain values: the usable form won. Retargeted to
// the properties that design actually promises.
test('easing/* — the 10 named easings are callable curves, eq-stable', () => {
  const env = fresh()
  const names = [
    'linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out',
    'emphasized', 'standard', 'decelerated', 'accelerated', 'spring',
  ]
  for (const n of names) {
    const full = 'easing/' + n
    const v = get(env, full)
    assert.equal(typeof v, 'function', `${full} should be a curve procedure`)
    assert.equal(v.__easing, n, `${full} should carry its easing name`)
    // A timing curve starts at rest. It also lands on 1 at t=1 — except
    // easing/spring, which is a damped oscillator and is still settling at
    // t=1 (measured 0.9609), so it only has to be close.
    assert.equal(v(0), 0, `${full} should be 0 at t=0`)
    if (n === 'spring') assert.ok(Math.abs(v(1) - 1) < 0.05, `${full} should be settling toward 1`)
    else assert.equal(v(1), 1, `${full} should be 1 at t=1`)
    // The documented eq? guarantee: same binding object every lookup.
    assert.equal(get(env, full), v, `${full} should be eq-stable`)
  }
  // linear is the identity curve; that is what makes it the boring one.
  assert.equal(get(env, 'easing/linear')(0.42), 0.42)
})

// ── font/* — Sym constants ───────────────────────────────────────────

test('font/mono, font/big, font/tiny — Sym constants', () => {
  const env = fresh()
  for (const n of ['mono', 'big', 'tiny']) {
    const v = get(env, 'font/' + n)
    assert.ok(v instanceof Sym, `font/${n} is a Sym`)
    assert.equal(v.name, n)
  }
})

// ── input/* ──────────────────────────────────────────────────────────

test('input/buttons — returns the six standard button names', () => {
  const env = fresh()
  const btns = get(env, 'input/buttons')()
  assert.ok(Array.isArray(btns))
  const names = btns.map((b) => (b instanceof Sym ? b.name : String(b)))
  for (const n of ['up', 'down', 'left', 'right', 'a', 'b']) {
    assert.ok(names.includes(n), `buttons include ${n}`)
  }
})

test('input/set! + input/down? — round-trip', () => {
  const env = fresh()
  const set = get(env, 'input/set!')
  const down = get(env, 'input/down?')
  set(sym('left'), true)
  assert.equal(down(sym('left')), true)
  set(sym('left'), false)
  assert.equal(down(sym('left')), false)
})

test('input/down? — unknown button returns #f (no throw)', () => {
  const env = fresh()
  const down = get(env, 'input/down?')
  assert.equal(down(sym('nonsense-button')), false)
})

test('input/pressed? — safe on unknown button', () => {
  const env = fresh()
  const pressed = get(env, 'input/pressed?')
  // Contract: never throws.
  assert.doesNotThrow(() => pressed(sym('xyz')))
})

test('input/may-i? — boolean; default is truthy in a fresh env', () => {
  const env = fresh()
  const mayI = get(env, 'input/may-i?')
  assert.equal(typeof mayI(), 'boolean')
})

// ── sprite/* ─────────────────────────────────────────────────────────

// 2026-08-01: the two tests below targeted the bare `sprite` / `sprites`
// verbs — a per-frame DRAW-LIST registration model (call `sprite` to enqueue a
// draw, call `sprites` to read back the queue). That was a Curator product
// concept and went out with the 2026-07-25 rip; both are unbound today.
//
// Motoi keeps the sprite CAPABILITY under the `sprite/*` namespace —
// sprite/rasterize, sprite/address and sprite/landmarks are all live and are
// covered by the tests immediately below this pair. Rather than delete these,
// they are retargeted to assert the boundary explicitly: the draw-list model
// is gone, and the namespace that replaced it is present. That keeps the rip
// itself under test, so a silent re-introduction would be noticed.

test('sprite / sprites — the Curator draw-list model is gone (ripped 2026-07-25)', () => {
  const env = fresh()
  assert.equal(env.vars.has('sprite'), false, 'bare `sprite` should not be bound')
  assert.equal(env.vars.has('sprites'), false, 'bare `sprites` should not be bound')
})

test('sprite/* — the retained sprite namespace is present', () => {
  const env = fresh()
  for (const v of ['sprite/rasterize', 'sprite/address', 'sprite/landmarks']) {
    assert.ok(env.vars.has(v), `${v} should still be bound`)
    assert.equal(typeof env.vars.get(v), 'function')
  }
})

test('sprite/rasterize — returns a numeric cell count for unknown sprite', () => {
  const env = fresh()
  const rast = get(env, 'sprite/rasterize')
  const n = rast(sym('unknown'), 0, 0)
  assert.equal(typeof n, 'number', 'returns a count (0 for unknown)')
})

test('sprite/address — one-arg form returns origin-shaped record', () => {
  const env = fresh()
  const addr = get(env, 'sprite/address')
  const out = addr(sym('hero'))
  // Defensive: whatever shape lands, must be defined.
  assert.ok(out !== undefined)
})

test('sprite/landmarks — unknown sprite returns an error record, does not throw', () => {
  const env = fresh()
  const lm = get(env, 'sprite/landmarks')
  const out = lm(sym('nope'))
  assert.ok(out && typeof out === 'object')
})

// ── scene/* ──────────────────────────────────────────────────────────

test('scene/clear — no-throw on a fresh env', () => {
  const env = fresh()
  const clear = get(env, 'scene/clear')
  assert.doesNotThrow(() => clear())
})

test('scene/spawn-many — spawns N entities from a name + point list', () => {
  const env = fresh()
  const spawnMany = get(env, 'scene/spawn-many')
  const count = get(env, 'entity/count')
  const before = count()
  spawnMany(sym('mob'), [[10, 10], [20, 20], [30, 30]])
  assert.equal(count() - before, 3, 'entity count increased by 3')
})

test('scene/grid — no-throw with sensible params', () => {
  const env = fresh()
  const grid = get(env, 'scene/grid')
  assert.doesNotThrow(() => grid(sym('cell'), 2, 2, 8, 8, 0, 0))
})

test('scene/imagine — author-blocked placeholder, non-throwing', () => {
  const env = fresh()
  const imagine = get(env, 'scene/imagine')
  // Reference says this is author-blocked; must at least be callable.
  assert.doesNotThrow(() => imagine('a garden'))
})

test('scene/load — no-throw with an empty spec', () => {
  const env = fresh()
  const load = get(env, 'scene/load')
  assert.doesNotThrow(() => load([]))
})

// ── game/* (instance verbs) ──────────────────────────────────────────

// ── game/* → world/* ─────────────────────────────────────────────────
// 2026-08-01: the four tests below targeted `game/frame`, `game/state`,
// `game/running?`, `game/step`, `game/stop` — the ID-KEYED, MULTI-INSTANCE
// game object model, where you passed an instance handle to every call. That
// model was a Curator product concept and was ripped 2026-07-25 (the installer
// lived in lib/game/game-instances.js, archived under
// scratch/attic/curator-verbs-ripped-2026-07-25/game/). All five verbs are
// unbound; `./bin/motoi eval "(procedure? game/step)"` errors.
//
// The CAPABILITY was not removed, only the instance keying: Motoi keeps a
// singleton game loop under `world/*` — world/frame, world/state,
// world/running?, world/step, world/stop, world/start are all live. So these
// are rewritten against the retained model rather than dropped, per the
// no-deletes rule. If the multi-instance model is ever wanted back, this
// comment is the pointer to what it was.

test('world/frame + world/state — readable with no game set up (no throw)', () => {
  const env = fresh()
  const frame = get(env, 'world/frame')
  const state = get(env, 'world/state')
  // The singleton world always exists, so these answer at boot.
  assert.equal(typeof frame(), 'number')
  const s = state()
  assert.ok(Array.isArray(s), 'world/state returns an alist')
})

test('world/running? + world/stop + world/start — loop lifecycle', () => {
  const env = fresh()
  const running = get(env, 'world/running?')
  const stop = get(env, 'world/stop')
  const start = get(env, 'world/start')
  // A fresh world is ticking.
  assert.equal(running(), true)
  stop()
  assert.equal(running(), false, 'world/stop halts the loop')
  start()
  assert.equal(running(), true, 'world/start resumes it')
})

test('world/step — advances the frame counter', () => {
  const env = fresh()
  const step = get(env, 'world/step')
  const frame = get(env, 'world/frame')
  const before = frame()
  assert.doesNotThrow(() => step())
  assert.ok(frame() > before, 'a step moves the frame counter forward')
})

test('big-bang — accepts an initial state + step fn without throwing', () => {
  const env = fresh()
  const bigBang = get(env, 'big-bang')
  // big-bang survived the rip and is still the entry point for a game loop.
  assert.doesNotThrow(() => bigBang(0, (s) => s + 1))
})

// ── system/* ─────────────────────────────────────────────────────────

test('system/health — returns an alist with expected keys', () => {
  const env = fresh()
  const health = get(env, 'system/health')
  const h = health()
  assert.ok(Array.isArray(h), 'health is an alist')
  const keys = h.map((pair) => (pair[0] instanceof Sym ? pair[0].name : String(pair[0])))
  for (const k of ['quarantined', 'fuel_exhausted', 'illusions']) {
    assert.ok(keys.includes(k), `health includes ${k}`)
  }
})

test('system/registry — returns a domain summary alist', () => {
  const env = fresh()
  const reg = get(env, 'system/registry')
  const r = reg(sym('verbs'))
  assert.ok(Array.isArray(r), 'registry returns an alist')
  const findKey = (k) => {
    for (const pair of r) {
      const name = pair[0] instanceof Sym ? pair[0].name : String(pair[0])
      if (name === k) return pair[1]
    }
    return undefined
  }
  const domain = findKey('domain')
  const domainName = domain instanceof Sym ? domain.name : String(domain)
  assert.equal(domainName, 'verbs')
  const count = findKey('count')
  assert.equal(typeof count, 'number', 'count is a number')
  assert.ok(count > 0, 'registry has some verbs')
})

// ── artifact/list — headless raise ───────────────────────────────────

test('artifact/list — throws in headless env with actionable message', () => {
  const env = fresh()
  const list = get(env, 'artifact/list')
  assert.throws(
    () => list(),
    (e) => /headless|artifact/i.test(e.message),
    'headless error mentions artifact or headless',
  )
})

// ── random-* ─────────────────────────────────────────────────────────

test('randint — inclusive-exclusive integer in range', () => {
  const env = fresh()
  const randint = get(env, 'randint')
  for (let i = 0; i < 50; i++) {
    const v = randint(0, 10)
    assert.ok(Number.isInteger(v), 'is integer')
    assert.ok(v >= 0 && v < 10, `in [0,10): ${v}`)
  }
})

test('random-int — non-negative integer < n', () => {
  const env = fresh()
  const ri = get(env, 'random-int')
  for (let i = 0; i < 50; i++) {
    const v = ri(5)
    assert.ok(Number.isInteger(v))
    assert.ok(v >= 0 && v < 5)
  }
})

test('random-int — n=0 or n=1 is defined (edge)', () => {
  const env = fresh()
  const ri = get(env, 'random-int')
  // Should never throw; must return an integer.
  const v0 = ri(1)
  assert.equal(v0, 0)
})

test('random-pick — returns an element of the list; null on empty', () => {
  const env = fresh()
  const pick = get(env, 'random-pick')
  const xs = ['a', 'b', 'c']
  for (let i = 0; i < 20; i++) {
    assert.ok(xs.includes(pick(xs)))
  }
  assert.equal(pick([]), null, 'empty list → null')
  assert.equal(pick(null), null, 'null → null (no throw)')
})

test('random-range — real in [lo, hi)', () => {
  const env = fresh()
  const rr = get(env, 'random-range')
  for (let i = 0; i < 50; i++) {
    const v = rr(1.0, 2.0)
    assert.ok(v >= 1.0 && v < 2.0, `in [1,2): ${v}`)
  }
})

// ── misc ─────────────────────────────────────────────────────────────

test('display — writes to port without throwing', () => {
  const env = fresh()
  const display = get(env, 'display')
  // We can't easily assert stdout here, but the call must succeed.
  assert.doesNotThrow(() => display('hi'))
  assert.doesNotThrow(() => display(42))
})

test('note — records a note into media state (no throw, returns something)', () => {
  const env = fresh()
  const note = get(env, 'note')
  assert.doesNotThrow(() => note('C4', 0.25, 0.5))
})

test('on-frame — accepts a procedure, returns without throwing', () => {
  const env = fresh()
  const onFrame = get(env, 'on-frame')
  assert.doesNotThrow(() => onFrame(() => 1))
})

test('on-key — rejects non-procedure with a clear error', () => {
  const env = fresh()
  const onKey = get(env, 'on-key')
  assert.throws(() => onKey('not a proc'), /handler|procedure/i)
})

test('on-key — accepts a procedure', () => {
  const env = fresh()
  const onKey = get(env, 'on-key')
  assert.doesNotThrow(() => onKey(() => null))
})

test('stop — flags the game loop as stopped without throwing', () => {
  const env = fresh()
  const stop = get(env, 'stop')
  assert.doesNotThrow(() => stop())
})

test('frame — callable, returns a value (frame counter)', () => {
  const env = fresh()
  const frame = get(env, 'frame')
  const v = frame()
  assert.ok(v !== undefined)
})

// ── CORE_VERBS sanity: every verb here is a CORE member ──────────────

test('P0 gap batch — every tested verb is in CORE_VERBS', async () => {
  const { CORE_VERBS } = await import('../core/core-verbs.js')
  const tested = [
    'cortex/remember', 'cortex/recall', 'cortex/forget', 'cortex/keys',
    'cortex/size', 'cortex/query',
    'entity/all', 'entity/count', 'entity/ref', 'entity/remove!',
    'entity/set!', 'entity/tag!',
    'time/delta', 'time/every-ms', 'time/across', 'time/during',
    'time/then', 'time/until', 'time/when',
    'easing/linear', 'easing/spring', 'easing/emphasized',
    'font/mono', 'font/big', 'font/tiny',
    'input/set!', 'input/down?', 'input/pressed?', 'input/may-i?',
    'input/buttons',
    'sprite', 'sprites', 'sprite/rasterize', 'sprite/address',
    'sprite/landmarks',
    'scene/clear', 'scene/spawn-many', 'scene/grid', 'scene/imagine',
    'scene/load',
    'game/frame', 'game/state', 'game/step', 'game/stop', 'game/running?',
    'system/health', 'system/registry',
    'artifact/list',
    'randint', 'random-int', 'random-pick', 'random-range',
    'display', 'note', 'on-frame', 'on-key', 'stop', 'frame', 'big-bang',
  ]
  for (const v of tested) {
    assert.ok(CORE_VERBS.has(v), `${v} should be CORE`)
  }
})
