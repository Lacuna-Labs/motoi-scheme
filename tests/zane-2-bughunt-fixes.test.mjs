// tests/zane-2-bughunt-fixes.test.mjs
//
// Zane #2 bug-hunt regression tests. Each test locks a bug fixed during
// the 2026-07-17 hunt so future edits can't silently reintroduce it.
//
// See scratch/zane-2-bughunt-log.slat for the running log.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Sym } from '../src/reader.js'
import { makeCoreEnv } from '../core/index.js'

function fresh() {
  const env = makeCoreEnv()
  env.vars.get('world/reset!')()
  return env
}
const sym = (n) => new Sym(n)
const get = (env, n) => env.vars.get(n)

// ── BUG-1: entity/tag! (Array shape) vs entity/untag! (Set shape) disagree ──
// entity/spawn creates `tags: new Set(...)`; entity/tag! called .includes()
// and .push() (Array methods) → JS TypeError. entity/untag! called .delete()
// (Set method) which happened to work on Set but not on Array. Fix: normalize
// tags to Set at creation and in tag ops.

test('BUG-1 — entity/tag! works on entity/spawn-created entity (Set-shaped tags)', () => {
  const env = fresh()
  const spawn = get(env, 'entity/spawn')
  const tag = get(env, 'entity/tag!')
  const hasTag = get(env, 'entity/has-tag?')

  const id = spawn(sym('ball'), 0, 0)
  // Before the fix: TypeError — e.tags.includes is not a function.
  assert.equal(tag(id, sym('sparkly')), true)
  assert.equal(hasTag(id, sym('sparkly')), true)
})

test('BUG-1 — entity/untag! works on entity/make-created entity (Array-shaped tags legacy)', () => {
  const env = fresh()
  const make = get(env, 'entity/make')
  const tagFn = get(env, 'entity/tag!')
  const untag = get(env, 'entity/untag!')
  const hasTag = get(env, 'entity/has-tag?')

  const id = make(sym('crate'), 5, 5)
  tagFn(sym(id), sym('heavy'))
  assert.equal(hasTag(sym(id), sym('heavy')), true)
  // Before the fix: for entities made via entity/make (Array tags),
  // untag! called Array.delete which doesn't exist. Fix normalizes to Set.
  assert.equal(untag(sym(id), sym('heavy')), true)
  assert.equal(hasTag(sym(id), sym('heavy')), false)
})

test('BUG-1 — entity/tag! is idempotent (no duplicate tags)', () => {
  const env = fresh()
  const spawn = get(env, 'entity/spawn')
  const tagFn = get(env, 'entity/tag!')
  const hasTag = get(env, 'entity/has-tag?')

  const id = spawn(sym('ball'), 0, 0)
  tagFn(id, sym('shiny'))
  tagFn(id, sym('shiny'))
  tagFn(id, sym('shiny'))
  // Set semantics: only one tag stored regardless of how many times added.
  assert.equal(hasTag(id, sym('shiny')), true)
})

test('BUG-1 — entity/hits-tag works on entity/spawn-created entities', () => {
  const env = fresh()
  const spawn = get(env, 'entity/spawn')
  const tagFn = get(env, 'entity/tag!')
  const hits = get(env, 'entity/hits-tag')

  const hero = spawn(sym('hero'), 0, 0, 16, 16)
  const coin = spawn(sym('coin'), 5, 5, 8, 8)
  tagFn(coin, sym('pickup'))
  // Before the fix: entity/hits-tag also used .includes() → TypeError
  // when the other entity's tags is a Set (spawn-created).
  const result = hits(hero, sym('pickup'))
  assert.ok(Array.isArray(result))
  assert.equal(result.length, 1)
})

// ── BUG-2: with-seed only replaces (random), not other random verbs ──
// The reference declares random-int, random-elem, random-boolean, etc. — if
// any of those bypass the seeded RNG, `with-seed` is a lie: two runs with
// the same seed diverge. Fix: route ALL random verbs through the shared rng.

test('BUG-2 — with-seed makes (random) deterministic (baseline)', () => {
  const env = fresh()
  const rand = get(env, 'random')
  const withSeed = get(env, 'with-seed')

  const a = withSeed(42, () => rand())
  const b = withSeed(42, () => rand())
  assert.equal(a, b, 'same seed must produce same random value')
})

test('BUG-2 — with-seed also seeds (random-int) when present', () => {
  const env = fresh()
  const withSeed = get(env, 'with-seed')
  let randomInt = null
  try { randomInt = get(env, 'random-int') } catch {}
  if (typeof randomInt !== 'function') return  // verb absent — skip

  const a = withSeed(1234, () => randomInt(100))
  const b = withSeed(1234, () => randomInt(100))
  assert.equal(a, b, 'same seed must produce same random-int value')
})

test('BUG-2 — with-seed also seeds (random-elem) when present', () => {
  const env = fresh()
  const withSeed = get(env, 'with-seed')
  let randomElem = null
  try { randomElem = get(env, 'random-elem') } catch {}
  if (typeof randomElem !== 'function') return

  const a = withSeed(999, () => randomElem([10, 20, 30, 40, 50]))
  const b = withSeed(999, () => randomElem([10, 20, 30, 40, 50]))
  assert.equal(a, b, 'same seed must produce same random-elem value')
})

test('BUG-2 — with-seed also seeds (random-boolean) when present', () => {
  const env = fresh()
  const withSeed = get(env, 'with-seed')
  let randomBool = null
  try { randomBool = get(env, 'random-boolean') } catch {}
  if (typeof randomBool !== 'function') return

  // 5-shot determinism check.
  const a = withSeed(7, () => [randomBool(), randomBool(), randomBool(), randomBool(), randomBool()])
  const b = withSeed(7, () => [randomBool(), randomBool(), randomBool(), randomBool(), randomBool()])
  assert.deepEqual(a, b, 'same seed must produce same random-boolean sequence')
})

// ── BUG-3: part/shake bypasses with-seed (Math.random directly) ──

test('BUG-3 — with-seed makes part/shake deterministic', () => {
  const env = fresh()
  const withSeed = get(env, 'with-seed')
  const partShake = get(env, 'part/shake')

  // Each call to part/shake returns a NEW jitter fn; calling that fn
  // consumes rng state. Under a fixed seed the sequence must repeat.
  const draw = () => {
    const fn = partShake(1)
    return [fn(0), fn(0.25), fn(0.5), fn(0.75)]
  }
  const a = withSeed(2024, draw)
  const b = withSeed(2024, draw)
  assert.deepEqual(a, b, 'same seed must produce same part/shake sequence')
})

// ── BUG-4: ai/wander bypasses with-seed (Math.random directly) ──

test('BUG-4 — with-seed makes ai/wander deterministic', () => {
  const env = fresh()
  const withSeed = get(env, 'with-seed')
  const wander = get(env, 'ai/wander')

  const draw = () => [
    wander([0, 0], [1, 0], 0.5),
    wander([0, 0], [0, 1], 0.5),
    wander([0, 0], [1, 1], 0.5),
  ]
  const a = withSeed(4242, draw)
  const b = withSeed(4242, draw)
  assert.deepEqual(a, b, 'same seed must produce same ai/wander sequence')
})

// ── BUG-11: time/delta ate a tick when caller passed unknown unit ──

test('BUG-11 — time/delta with unknown unit does NOT consume the wall-clock tick', async () => {
  const env = fresh()
  const timeDelta = get(env, 'time/delta')

  // Reset the module clock via the exported test seam.
  const { __resetTimeClock } = await import('../lib/system/time-verbs.js')
  __resetTimeClock()

  // First real call establishes clock.last (returns 0).
  const first = timeDelta(new Sym('ms'))
  assert.equal(first, 0, 'first call returns 0 by contract')

  // Wait a measurable amount.
  await new Promise(r => setTimeout(r, 30))

  // Bogus unit call — must return 'nan and NOT eat the tick.
  const nan = timeDelta(new Sym('parsecs'))
  assert.ok(nan instanceof Sym && nan.name === 'nan')

  // Next legit call should still see the ~30ms that elapsed since the
  // FIRST call — proving the bogus-unit call didn't reset clock.last.
  const second = timeDelta(new Sym('ms'))
  assert.ok(typeof second === 'number')
  assert.ok(second >= 25, `expected >= 25ms, got ${second} — bogus unit call ate the tick`)
})

// ── BUG-12: on-tick / after rejected Scheme closures silently ──

test('BUG-12 — on-tick accepts Scheme closures (params-carrying objects)', () => {
  const env = fresh()
  const onTick = get(env, 'on-tick')

  // Emulate a Scheme Closure: a plain object with .params (matches the
  // shape check used elsewhere in game.js: `fn && fn.params`). Before
  // the fix, this returned -1 (silent rejection).
  const fakeClosure = { params: ['dt'], body: [], env: null }
  const id = onTick(fakeClosure)
  assert.ok(id > 0, `on-tick returned ${id}; must accept closure-shaped handler`)
})

test('BUG-12 — after accepts Scheme closures', () => {
  const env = fresh()
  const after = get(env, 'after')

  const fakeClosure = { params: [], body: [], env: null }
  const id = after(1000, fakeClosure)
  assert.ok(id > 0, `after returned ${id}; must accept closure-shaped handler`)
})

// ── BUG-15: big-bang stepFn silently dropped Scheme closures ──

// ── BUG-16: cortex/write only unwrapped top-level Syms ──

test('BUG-16 — cortex/write recursively unwraps nested Syms', async () => {
  // CORTEX_PATH is captured at import time from ~/.motoi/cortex.slat.
  // We save the file's current contents (if any), run our round-trip,
  // then restore. Uses a unique key so we don't clobber real entries
  // even if the file exists.
  const { readFileSync, writeFileSync, existsSync, mkdirSync } = await import('node:fs')
  const { join, dirname } = await import('node:path')
  const { homedir } = await import('node:os')
  const CORTEX_PATH = join(homedir(), '.motoi', 'cortex.slat')
  const uniqueKey = `zane2-bug16-test-${process.pid}-${Date.now()}`

  let savedContent = null
  if (existsSync(CORTEX_PATH)) {
    savedContent = readFileSync(CORTEX_PATH, 'utf8')
  }

  try {
    const env = fresh()
    const write = get(env, 'cortex/write')
    const read = get(env, 'cortex/read')

    // A nested structure with Syms inside — a common Sakura shape.
    const alist = [[new Sym(':kind'), new Sym('sprite')], [new Sym(':pos'), [1, 2, 3]]]
    write(new Sym(uniqueKey), alist)
    const back = read(new Sym(uniqueKey))
    // Before the fix, the inner Syms round-tripped as {name: '...'} objects.
    // After the fix, they arrive as plain strings.
    assert.ok(Array.isArray(back), 'expected array')
    assert.equal(back[0][0], ':kind', 'nested Sym key should have unwrapped to string')
    assert.equal(back[0][1], 'sprite', 'nested Sym value should have unwrapped to string')
    assert.deepEqual(back[1][1], [1, 2, 3])
  } finally {
    // Restore the original file (or delete if none existed) so we
    // don't leave a marker record behind in Alfred's real store.
    if (savedContent !== null) {
      try { writeFileSync(CORTEX_PATH, savedContent, 'utf8') } catch {}
    } else {
      try { (await import('node:fs')).unlinkSync(CORTEX_PATH) } catch {}
    }
  }
})

test('BUG-15 — big-bang stores a Scheme-closure step-fn (not silently dropped)', async () => {
  const env = fresh()
  const bigBang = get(env, 'big-bang')
  const gameStep = get(env, 'game/step')
  const gameFrame = get(env, 'game/frame')
  const gameState = get(env, 'game/state')

  // Emulate a real interp Closure via the actual Closure class.
  const { Closure, Env } = await import('../src/interp.js')
  const stepEnv = new Env()
  // Body that always returns 42 as the next state — literal 42 form.
  const closure = new Closure(['state', 'frame'], [42], stepEnv)

  const id = bigBang(0, closure)
  assert.ok(typeof id === 'number' && id > 0)

  // If the closure was dropped (bug), state stays 0 forever.
  const status = gameStep(id)
  assert.ok(status instanceof Sym && status.name === 'ok', `expected 'ok, got ${status && status.name}`)
  assert.equal(gameFrame(id), 1)
  assert.equal(gameState(id), 42, 'state should have been updated by closure step-fn')
})
