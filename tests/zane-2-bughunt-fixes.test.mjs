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

// REBASELINED 2026-08-01 (bucket 1, stale-by-design). The BUG-1 DEFECT IS
// STILL FIXED — verified live below. Only the OBSERVER changed:
//
//  (a) `entity/has-tag?` and `entity/hits-tag` are unbound. They came from
//      installGame, ripped 2026-07-25 (core/index.js:47-52). They are NOT in
//      core/core-verbs.js (the authoritative CORE registry) and have NO entry
//      in scheme/reference/ — so they are correctly gone, not missing.
//      Replaced with `world/count` / `world/find`, which are bound, are in
//      core-verbs.js, and are named in this very verb's reference record:
//      scheme/reference/24-entity.slat:1955 :related ("entity/untag!"
//      "world/find" "world/each" "world/count" "entity/despawn!").
//
//  (b) The `assert.equal(tag(...), true)` return-value checks are dropped:
//      scheme/reference/24-entity.slat:1944 declares
//      `(entity/tag! id tag) -> void`, and :2059 `(entity/untag! id tag) ->
//      void`. Asserting a `true` return was never the ratified contract; the
//      surviving impl (lib/game/world.js:587) returns the entity. Asserting
//      the OBSERVABLE EFFECT instead of the return value is the stronger and
//      reference-faithful guard.
//
// The Set/Array shape guard itself is preserved and, in fact, tightened —
// tags.constructor is asserted directly on BOTH creation paths, which is the
// actual root cause BUG-1 was about.

test('BUG-1 — entity/tag! works on entity/spawn-created entity (Set-shaped tags)', () => {
  const env = fresh()
  const spawn = get(env, 'entity/spawn')
  const tag = get(env, 'entity/tag!')
  const count = get(env, 'world/count')

  const e = spawn(sym('ball'), 0, 0)
  // Root cause: tags must be a Set on the spawn path, never an Array.
  assert.ok(e.tags instanceof Set, 'entity/spawn must produce Set-shaped tags')
  // Before the fix: TypeError — e.tags.includes is not a function.
  tag(e, sym('sparkly'))
  assert.equal(count(sym('sparkly')), 1, 'tag must be observable via world/count')
})

test('BUG-1 — entity/untag! works on entity/make-created entity (Array-shaped tags legacy)', () => {
  const env = fresh()
  const make = get(env, 'entity/make')
  const tagFn = get(env, 'entity/tag!')
  const untag = get(env, 'entity/untag!')
  const count = get(env, 'world/count')

  const e = make(sym('crate'), 5, 5)
  // The legacy path must ALSO normalize to Set — that is the whole fix.
  assert.ok(e.tags instanceof Set, 'entity/make must produce Set-shaped tags')
  tagFn(e, sym('heavy'))
  assert.equal(count(sym('heavy')), 1)
  // Before the fix: for entities made via entity/make (Array tags),
  // untag! called Array.delete which doesn't exist. Fix normalizes to Set.
  untag(e, sym('heavy'))
  assert.equal(count(sym('heavy')), 0)
})

test('BUG-1 — entity/tag! is idempotent (no duplicate tags)', () => {
  const env = fresh()
  const spawn = get(env, 'entity/spawn')
  const tagFn = get(env, 'entity/tag!')
  const count = get(env, 'world/count')

  const e = spawn(sym('ball'), 0, 0)
  tagFn(e, sym('shiny'))
  tagFn(e, sym('shiny'))
  tagFn(e, sym('shiny'))
  // Set semantics: only one tag stored regardless of how many times added.
  assert.equal(e.tags.size, 1, 'three identical tags must collapse to one')
  assert.equal(count(sym('shiny')), 1)
})

test('BUG-1 — tag queries work across entity/spawn-created entities', () => {
  const env = fresh()
  const spawn = get(env, 'entity/spawn')
  const tagFn = get(env, 'entity/tag!')
  const find = get(env, 'world/find')

  const hero = spawn(sym('hero'), 0, 0, 16, 16)
  const coin = spawn(sym('coin'), 5, 5, 8, 8)
  assert.ok(hero.tags instanceof Set && coin.tags instanceof Set)
  tagFn(coin, sym('pickup'))
  // Before the fix: the tag-scan path also used .includes() → TypeError
  // when the other entity's tags is a Set (spawn-created).
  const result = find(sym('pickup'))
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

// REBASELINED 2026-08-01 (bucket 1, stale-by-design). part/shake no longer
// has ANY randomness to bypass, so the original premise cannot be tested as
// written. Evidence:
//   * The verb was re-homed into lib/game/composer.js:188 as a deterministic
//     sine gesture: simpleGesture('part/shake','head-yaw',
//                                 (u) => 15 * Math.sin(u * TWO_PI * 2), 20)
//   * `grep -n "Math.random" lib/game/composer.js` returns ZERO hits.
//   * The ratified signature is nullary and void, not a jitter-fn factory:
//     scheme/reference/48-part.slat:551-552 — :kind "null",
//     :signature "(part/shake) -> void". The old `partShake(1)` call and the
//     `fn(0)`/`fn(0.25)` returned-closure protocol are both gone.
//
// This is the with-seed bug class the whole green-gate exists for, so the
// guard is KEPT, not dropped — re-pointed at the property that still matters:
// part/shake must stay reproducible, which now also catches anyone
// re-introducing Math.random into it.
test('BUG-3 — part/shake is reproducible (no unseeded randomness)', () => {
  const env = fresh()
  const withSeed = get(env, 'with-seed')
  const partShake = get(env, 'part/shake')

  const a = withSeed(2024, () => JSON.stringify(partShake()))
  const b = withSeed(2024, () => JSON.stringify(partShake()))
  assert.deepEqual(a, b, 'same seed must produce same part/shake result')

  // Stronger: the gesture is a pure curve, so it must match even under a
  // DIFFERENT seed. If this ever fails, unseeded randomness has crept back in.
  const c = withSeed(999, () => JSON.stringify(partShake()))
  assert.deepEqual(a, c, 'part/shake must be a deterministic curve, not RNG-driven')
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

// REBASELINED 2026-08-01 (bucket 1, stale-by-design) + TEST-ISOLATION FIX.
//
// TWO separate problems were tangled together here.
//
// (1) WRONG EXPECTATION. The assertions demanded nested Syms come back as
//     PLAIN STRINGS. That was an artifact of the old KV module
//     (lib/ai/cortex-io.js), whose BUG-16 fix unwrapped Syms lossily. That
//     module is now SUPERSEDED — core/index.js:415-417: "Supersedes the
//     legacy KV cortex-io and ai.js's in-memory stubs — installs last so its
//     bindings win." The winning implementation is lib/ai/cortex.js:418.
//     The reference ratifies the NEW behavior, not the old one —
//     scheme/reference/19-cortex.slat:111 :explanation:
//       "The value can be any Scheme value — number, string, list, symbol,
//        or a nested structure. Cortex stores the value as-is; readers get
//        back the same shape."
//     Shape-preserving means a symbol in must be a SYMBOL out, not a string.
//     So the defect BUG-16 actually guarded — nested Syms silently losing
//     their Sym-ness and degrading to raw {name:...} JS objects — is fixed,
//     and fixed BETTER than before. The assertion is re-pointed at genuine
//     `instanceof Sym`, which is the stronger, reference-correct guard.
//
// (2) NO ISOLATION — this test was writing into Alfred's REAL store.
//     It saved/restored `~/.motoi/cortex.slat`, but the live store is
//     `~/motoi/copilot/cortex.slatl` (src/paths.js:33 userCortexSlatlPath →
//     copilotDir → motoiUserDir). Wrong directory AND wrong filename, so the
//     "restore" protected nothing. On 2026-08-01 the real store already held
//     15 leaked `zane2-bug16-test-*` fixture keys. Because cortex/write
//     upserts by key, this class of leak also makes tests pass once and fail
//     forever after. Fixed by running the round-trip in a CHILD PROCESS with
//     MOTOI_HOME pointed at a temp dir — required because lib/ai/cortex.js:53
//     freezes `const PATH = userCortexSlatlPath()` at module-import time, so
//     setting the env var in-process after the static import is too late.
test('BUG-16 — cortex/write preserves nested Syms (shape-preserving round-trip)', async () => {
  const { mkdtempSync, rmSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const { execFileSync } = await import('node:child_process')

  const home = mkdtempSync(join(tmpdir(), 'motoi-bug16-'))
  try {
    const script = `
      const { Sym } = await import('./src/reader.js')
      const { makeCoreEnv } = await import('./core/index.js')
      const env = makeCoreEnv(); env.vars.get('world/reset!')()
      const write = env.vars.get('cortex/write'), read = env.vars.get('cortex/read')
      const alist = [[new Sym(':kind'), new Sym('sprite')], [new Sym(':pos'), [1, 2, 3]]]
      write(new Sym('bug16-key'), alist)
      const back = read(new Sym('bug16-key'))
      console.log(JSON.stringify({
        isArray: Array.isArray(back),
        keyIsSym: back[0][0] instanceof Sym, keyName: back[0][0] && back[0][0].name,
        valIsSym: back[0][1] instanceof Sym, valName: back[0][1] && back[0][1].name,
        nested: back[1][1],
      }))
    `
    const out = execFileSync(process.execPath, ['--input-type=module', '--eval', script], {
      cwd: new URL('..', import.meta.url).pathname,
      env: { ...process.env, MOTOI_HOME: home },
      encoding: 'utf8',
    })
    const r = JSON.parse(out.trim().split('\n').pop())

    assert.ok(r.isArray, 'expected array')
    // Before the fix, inner Syms degraded to raw {name:'...'} JS objects —
    // neither symbol nor string. They must survive as real Syms.
    assert.ok(r.keyIsSym, 'nested Sym key must round-trip as a Sym, not a bare object')
    assert.equal(r.keyName, ':kind')
    assert.ok(r.valIsSym, 'nested Sym value must round-trip as a Sym')
    assert.equal(r.valName, 'sprite')
    assert.deepEqual(r.nested, [1, 2, 3], 'nested non-Sym data must round-trip unchanged')
  } finally {
    try { rmSync(home, { recursive: true, force: true }) } catch { /* best effort */ }
  }
})

// Superseded body of the original BUG-16 test is retained below in a disabled
// form purely as the historical record of what the old KV module asserted
// (CLAUDE.md: "No deletes. Ever."). It is not run.
async function _historicalBug16AssertionsFromCortexIoEra() {
  const uniqueKey = 'zane2-bug16-test'
  {
    const env = fresh()
    const write = get(env, 'cortex/write')
    const read = get(env, 'cortex/read')

    // A nested structure with Syms inside — a common downstream-dialect shape.
    const alist = [[new Sym(':kind'), new Sym('sprite')], [new Sym(':pos'), [1, 2, 3]]]
    write(new Sym(uniqueKey), alist)
    const back = read(new Sym(uniqueKey))
    // Before the fix, the inner Syms round-tripped as {name: '...'} objects.
    // After the fix, they arrive as plain strings.
    assert.ok(Array.isArray(back), 'expected array')
    assert.equal(back[0][0], ':kind', 'nested Sym key should have unwrapped to string')
    assert.equal(back[0][1], 'sprite', 'nested Sym value should have unwrapped to string')
    assert.deepEqual(back[1][1], [1, 2, 3])
  }
}

// REBASELINED 2026-08-01 (bucket 1, stale-by-design). THE GUARDED DEFECT IS
// STILL FIXED — a Scheme closure passed to big-bang is invoked, verified live:
//   ./bin/motoi eval "(begin (define n 0)
//                            (big-bang (lambda () (on-frame (lambda () (set! n (+ n 1))))) 5)
//                            (list 'n n))"   =>  (n 5)
// What changed is the API SHAPE. This test drove the multi-instance,
// id-keyed game/* surface (game/step, game/frame, game/state), which came
// from installGameInstances — ripped 2026-07-25 (core/index.js:47-52) and now
// unbound. The reference is explicit that the id-keyed model is not the
// language — scheme/reference/01-core.slat:752,756 :name "big-bang":
//   :signature "(big-bang setup [frames]) -> (frames N)"
//   :doc "Motoi runs ONE world. ... There is no game id and no per-instance
//         state cell: lifecycle is read with world/frame, world/running?,
//         and world/state ..."
// So `assert.ok(typeof id === 'number' && id > 0)` was asserting the
// existence of a game id the reference says does not exist. Re-pointed at the
// single-world API. The "not silently dropped" property — the thing this file
// exists to protect — is preserved and asserted by OBSERVED EFFECT (a counter
// the closure mutates), which is a stricter check than a truthy return.
test('BUG-15 — big-bang runs a Scheme-closure frame handler (not silently dropped)', () => {
  const env = fresh()
  const bigBang = get(env, 'big-bang')
  const onFrame = get(env, 'on-frame')

  let ticks = 0
  // A host-callable stand-in for a Scheme closure frame handler.
  const handler = () => { ticks += 1; return 42 }
  const setup = () => { onFrame(handler) }

  const result = bigBang(setup, 5)

  // Reference: returns the list (frames N).
  assert.ok(Array.isArray(result), `big-bang must return a list, got ${result}`)
  assert.ok(result[0] instanceof Sym && result[0].name === 'frames',
    `expected 'frames, got ${result[0] && result[0].name}`)
  assert.equal(result[1], 5, 'big-bang must report the frames it actually pumped')

  // If the handler was dropped (the BUG-15 defect), ticks stays 0 forever.
  assert.equal(ticks, 5, 'frame handler must be invoked once per pumped frame')
})

// Companion guard: prove a REAL interp Closure (not just a JS function) is
// accepted, which is the precise shape BUG-15 was about.
test('BUG-15 — big-bang accepts a real interp Closure as the frame handler', async () => {
  const env = fresh()
  const bigBang = get(env, 'big-bang')
  const onFrame = get(env, 'on-frame')
  const { Closure, Env } = await import('../src/interp.js')

  const stepEnv = new Env()
  const closure = new Closure([], [42], stepEnv)
  // Must not throw and must not silently skip the closure.
  const result = bigBang(() => { onFrame(closure) }, 3)
  assert.ok(Array.isArray(result) && result[1] === 3,
    `closure-shaped handler must be driven; got ${JSON.stringify(result)}`)
})
