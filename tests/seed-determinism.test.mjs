// tests/seed-determinism.test.mjs
//
// Provenance: 2026-08-02. `(with-seed n thunk)` promises a learner that the
// same seed replays the same run. That promise has been broken and repaired
// three times — Zane-2 BUG-2/3/4 (2026-07-17) caught `random-int`/`randint`/
// `rng-uniform`/`part/shake`/`ai/wander`, and `random-integer` was still
// escaping on 2026-08-01. Every one of those was the same mistake: a new
// random verb was written against `Math.random` because the seed lived in
// `lib/game/misc.js`, where a verb author elsewhere had no reason to look.
//
// The repair was to hoist the draw to `src/rng.js`. This file is what keeps
// it repaired, and it is deliberately NOT a list of verbs to check:
//
//   1. It ENUMERATES the live environment for anything random-shaped and
//      fails on a name it has never been told about. Adding a random verb
//      therefore forces an explicit decision here — you cannot add one
//      quietly.
//   2. It greps the source for `Math.random` outside the allowlist, so a
//      bypass fails even before the verb is bound.
//
// A fourth regression has to defeat both.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'
import { makeCoreEnv } from '../core/index.js'
import { evaluate } from '../src/interp.js'
import { parse } from '../src/reader.js'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))

function run(src) {
  const fuel = { n: 1_000_000 }
  const env = makeCoreEnv({ fuel })
  let last
  for (const form of parse(src)) last = evaluate(form, env, fuel)
  return last
}

// Anything that looks like it might produce randomness. Deliberately wider
// than the true set — a false positive costs one line in NOT_A_DRAW, while
// a false negative costs another silent replay bug.
const RANDOM_SHAPED = /random|rng|randint|shuffle|dice|noise|jitter|wander|scatter/i

function boundNames() {
  const fuel = { n: 1_000_000 }
  const names = new Set()
  for (let e = makeCoreEnv({ fuel }); e; e = e.parent) {
    for (const k of e.vars.keys()) names.add(k)
  }
  return [...names].sort()
}

// One draw per verb. The expression must consume exactly one number from
// the stream so interleaving stays meaningful.
const DRAWS = {
  'random': '(random 100)',
  'random-int': '(random-int 1000)',
  'random-range': '(random-range 0 1)',
  'random-pick': '(random-pick (list 1 2 3 4 5 6 7 8))',
  'randint': '(randint 0 1000)',
  'rng-uniform': '(rng-uniform)',
  'random-integer': '(random-integer 1000)',
  'random-real': '(random-real)',
  'alg/random-element': '(alg/random-element (list 1 2 3 4 5 6 7 8))',
  'ai/wander': '(ai/wander (list 0 0) (list 1 0) 1)',
}

// Matched the pattern but draws nothing. Each needs a stated reason — an
// empty excuse here is how a real draw gets waved through.
const NOT_A_DRAW = {
  'make-random-source': 'constructor; the source it returns draws via random-integer, covered above',
  'random-source-randomize!': 'no-op by design — reseeding from entropy would let a cart escape with-seed',
  'plot/scatter': 'scatter PLOT; matched "scatter" by name only, no draw',
}

test('every random-shaped verb in the live env is classified', () => {
  const unknown = boundNames()
    .filter((n) => RANDOM_SHAPED.test(n))
    .filter((n) => !(n in DRAWS) && !(n in NOT_A_DRAW))
  assert.deepEqual(unknown, [],
    `Unclassified random-shaped verb(s): ${unknown.join(', ')}.\n`
    + 'Add each to DRAWS (with an expression taking exactly one draw) or to\n'
    + 'NOT_A_DRAW (with a reason). If it draws, it MUST use seededRandom()\n'
    + 'from src/rng.js — never Math.random — or (with-seed …) will not cover it.')
})

// Eight draws makes an accidental collision between two seeds negligible
// even for the smallest range under test (8 choices → 8^-8).
const seq = (expr) => `(list ${Array(8).fill(expr).join(' ')})`
const seeded = (seed, body) => `(with-seed ${seed} (lambda () ${body}))`

for (const [name, expr] of Object.entries(DRAWS)) {
  test(`${name} is deterministic under with-seed`, () => {
    const a = run(seeded(4242, seq(expr)))
    const b = run(seeded(4242, seq(expr)))
    assert.deepEqual(a, b, `${name} escaped the seed — it is not drawing from src/rng.js`)
  })

  test(`${name} actually varies with the seed`, () => {
    const a = run(seeded(4242, seq(expr)))
    const c = run(seeded(99, seq(expr)))
    assert.notDeepEqual(a, c, `${name} ignores the seed value — a constant would pass the test above`)
  })
}

// The heart of the original bug: each verb was individually "random", but
// they drew from DIFFERENT streams, so a cart mixing them diverged on replay
// even though every verb looked fine in isolation.
test('all random verbs share ONE stream under a single seed', () => {
  const mixed = `(list ${Object.values(DRAWS).join(' ')})`
  assert.deepEqual(run(seeded(2026, mixed)), run(seeded(2026, mixed)))
  assert.notDeepEqual(run(seeded(2026, mixed)), run(seeded(2027, mixed)))
})

test('the seed does not leak outside its dynamic extent', () => {
  // Two unseeded runs must differ, or with-seed has pinned the global rng.
  const draws = seq('(rng-uniform)')
  assert.notDeepEqual(run(draws), run(draws))
  // ...including after a seeded extent has run and unwound.
  const after = `${seeded(5, '(rng-uniform)')} ${draws}`
  assert.notDeepEqual(run(after), run(after))
})

test('with-seed restores the previous rng even when the thunk raises', () => {
  const src = `(guard (e (#t 'caught)) ${seeded(5, '(raise (quote boom))')})`
  assert.equal(run(src).name, 'caught')
  const draws = seq('(rng-uniform)')
  assert.notDeepEqual(run(draws), run(draws))
})

test('nested with-seed restores the outer seed', () => {
  const body = `(list (rng-uniform) ${seeded(7, '(rng-uniform)')} (rng-uniform))`
  const outer = run(seeded(3, body))
  assert.deepEqual(outer, run(seeded(3, body)))
  // The inner extent must not change what the outer stream yields next.
  const noInner = run(seeded(3, '(list (rng-uniform) (rng-uniform))'))
  assert.equal(outer[0], noInner[0])
  assert.equal(outer[2], noInner[1])
})

// ── the source-level gate ────────────────────────────────────────────
//
// Catches a bypass before the verb is ever bound, which the enumeration
// gate above cannot do for a verb that is lazy-loaded or not yet wired.

const MATH_RANDOM_ALLOWED = {
  'src/rng.js': 'the one legitimate draw — everything else routes through it',
  'src/dispatch.js': 'correlation-ID suffixes, not a value any program observes',
  'lib/ai/cortex.js': 'memory-record IDs, already nondeterministic via Date.now',
}

async function* jsFiles(dir) {
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name.startsWith('.')) continue
    const p = join(dir, ent.name)
    if (ent.isDirectory()) yield* jsFiles(p)
    else if (ent.name.endsWith('.js')) yield p
  }
}

test('no verb source reaches for Math.random outside the allowlist', async () => {
  const offenders = []
  for (const root of ['src', 'lib', 'core']) {
    for await (const path of jsFiles(join(REPO, root))) {
      const rel = relative(REPO, path)
      if (rel in MATH_RANDOM_ALLOWED) continue
      const text = await readFile(path, 'utf8')
      for (const [i, line] of text.split('\n').entries()) {
        // Skip prose: these files explain the bug, and the explanation
        // naming Math.random is not itself a call.
        if (/^\s*(\/\/|\*)/.test(line)) continue
        if (line.includes('Math.random')) offenders.push(`${rel}:${i + 1}`)
      }
    }
  }
  assert.deepEqual(offenders, [],
    `Math.random called outside src/rng.js at: ${offenders.join(', ')}.\n`
    + 'A draw here escapes (with-seed …) and breaks replay. Import\n'
    + 'seededRandom from src/rng.js instead, or add the file to\n'
    + 'MATH_RANDOM_ALLOWED with a reason if it is an ID and not a value.')
})
