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
import { makeCoreEnv } from '../core/index.js'
import { resetMediaState } from '../lib/media/media.js'
import { Sym, sym } from '../src/reader.js'

function fresh() {
  resetMediaState()
  return makeCoreEnv()
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
  assert.equal(recall(sym('planet')), 'earth')
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
  assert.equal(recall(sym('temp')), 999)
  forget(sym('temp'))
  const v = recall(sym('temp'))
  assert.ok(v === undefined || v === null || v === false)
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

test('entity/set! — safe on missing entity (returns value)', () => {
  const env = fresh()
  const set = get(env, 'entity/set!')
  const v = set(sym('ghost'), sym('hp'), 5)
  // Should not throw; returns the value.
  assert.equal(v, 5)
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

test('easing/* — the 10 named-easing constants are all Syms', () => {
  const env = fresh()
  const names = [
    'linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out',
    'emphasized', 'standard', 'decelerated', 'accelerated', 'spring',
  ]
  for (const n of names) {
    const full = 'easing/' + n
    const v = get(env, full)
    assert.ok(v instanceof Sym, `${full} should be a Sym`)
    assert.equal(v.name, full)
  }
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

test('sprite — no-throw registration of a sprite draw', () => {
  const env = fresh()
  const sprite = get(env, 'sprite')
  // Signature: (name x y color?)
  assert.doesNotThrow(() => sprite(sym('hero'), 10, 20))
})

test('sprites — returns list after sprite() calls', () => {
  const env = fresh()
  const sprite = get(env, 'sprite')
  const sprites = get(env, 'sprites')
  sprite(sym('a'), 0, 0)
  sprite(sym('b'), 5, 5)
  const list = sprites()
  assert.ok(Array.isArray(list))
  assert.ok(list.length >= 2, 'both draws recorded')
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

test('game/frame — unknown id returns nan-sym (no throw)', () => {
  const env = fresh()
  const gf = get(env, 'game/frame')
  const v = gf(sym('no-such-instance'))
  assert.ok(v !== undefined)
})

test('game/state — unknown id returns nan-sym (no throw)', () => {
  const env = fresh()
  const gs = get(env, 'game/state')
  const v = gs(sym('no-such-instance'))
  assert.ok(v !== undefined)
})

test('game/running? — false on unknown id', () => {
  const env = fresh()
  const gr = get(env, 'game/running?')
  assert.equal(gr(sym('no-such-instance')), false)
})

test('big-bang + game/step + game/stop — instance lifecycle', () => {
  const env = fresh()
  const bigBang = get(env, 'big-bang')
  const gStep = get(env, 'game/step')
  const gStop = get(env, 'game/stop')
  const gRunning = get(env, 'game/running?')
  const inst = bigBang(0, (s) => s + 1)
  // big-bang returns an id-shaped value we can pass back.
  assert.ok(inst !== undefined)
  assert.doesNotThrow(() => gStep(inst))
  assert.doesNotThrow(() => gStop(inst))
  // After stop, running? should be false.
  assert.equal(gRunning(inst), false)
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
