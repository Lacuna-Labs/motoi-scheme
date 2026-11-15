// curves-seed.test.mjs — THE HOUSE CURVES AND THE SEED (lane F5-BC, BC.10). Owns: the tests that the three house curves and
// the packet curve hit their endpoints and are monotone, that the exact spring is critically damped (never crosses its
// target) and reaches half its distance at one half-life from rest, that rc and blink have their periods, that fnv1a is
// life.js's (FNV-1a 32), that pcg is the JCGT 2020 hash the GPU runs (the test vector lane D checks its GLSL against), and
// that a draw is closed-form in k. Refuses: a curve with overshoot.
import test from 'node:test'
import assert from 'node:assert/strict'
import { bezier, enter, exit, glide, packet, rc, blink, spring, halfLife, held, smoothed, smoothstep } from '../curves.js'
import { fnv1a, pcg, seedOf, draw } from '../seed.js'

/** The reference PCG, written out long-hand with BigInt so a mistake in the fast path cannot hide (A6 §14). */
function pcgRef(v) {
  const M = (1n << 32n) - 1n
  const state = (BigInt(v) * 747796405n + 2891336453n) & M
  const word = ((((state >> ((state >> 28n) + 4n)) ^ state) & M) * 277803737n) & M
  return Number(((word >> 22n) ^ word) & M)
}

// spec: master §2.3 house tokens; A4 §5.1 · class: E · technique: sampling · method: 0 → 0, 1 → 1, monotone over 1,000 steps,
// no value outside [0, 1] · sre: does any house curve overshoot? (no)
test('the house curves are monotone from 0 to 1 with no overshoot', () => {
  for (const [name, c] of [['enter', enter], ['exit', exit], ['glide', glide], ['packet', packet], ['smoothstep', smoothstep]]) {
    assert.equal(c(0), 0, name)
    assert.equal(c(1), 1, name)
    let prev = 0
    for (let i = 1; i <= 1000; i++) {
      const v = c(i / 1000)
      assert.ok(v >= prev - 1e-9 && v <= 1 + 1e-9, `${name} at ${i / 1000}: ${v}`)
      prev = v
    }
  }
  assert.ok(Math.abs(bezier(0.25, 0.1, 0.25, 1)(0.5) - 0.8024) < 0.01)
})

// spec: A3 §6.2 the exact critically damped spring; R5 §1 · class: E · technique: step series · method: from rest at 10 toward 0,
// never below 0; at t = hl the envelope e^(−ωt) is ½ so the distance is ½(1 + ln 2) of the start; half-life clamps 120–300 ms ·
// sre: does the follow spring ever rock past its mark?
test('the spring is critically damped: never crosses the target, settles by half-lives, half-life clamped by mass', () => {
  let x = 10
  let v = 0
  let min = Infinity
  for (let i = 0; i < 600; i++) { const s = spring(x, v, 0, 0.2, 1 / 60); x = s.x; v = s.v; min = Math.min(min, x) }
  assert.ok(min >= -1e-9, `crossed to ${min}`)
  assert.ok(x < 1e-6)
  const at = spring(10, 0, 0, 0.2, 0.2)
  assert.ok(Math.abs(at.x - 10 * 0.5 * (1 + Math.LN2)) < 1e-9, `from rest, one half-life leaves (1 + ln 2) / 2 of the distance: ${at.x}`)
  assert.ok(Math.abs(spring(10, 0, 0, 0.2, 2).x) < 10 * Math.pow(2, -10) * 12, 'ten half-lives on: under the envelope')
  const oneShot = spring(10, 0, 0, 0.2, 10)
  const stepped = (() => { let y = 10; let w = 0; for (let i = 0; i < 600; i++) { const s = spring(y, w, 0, 0.2, 1 / 60); y = s.x; w = s.v } return y })()
  assert.ok(Math.abs(oneShot.x - stepped) < 1e-6, 'one step of 10 s equals 600 steps of 1/60 s')
  assert.equal(halfLife(0.5), 0.12)
  assert.equal(halfLife(3), 0.3)
  assert.ok(Math.abs(halfLife(1.1) - 0.132) < 1e-9)
})

// spec: A3 §2 rc and blink; A4 §5.2 · class: E · technique: table · method: rc period 1, blink 50 % duty at f Hz; held and smoothed ·
// sre: is a 0.6 Hz blink lit 0.5 of the time?
test('rc, blink, held and smoothed behave as A3 §2 writes them', () => {
  assert.equal(rc(0), 0)
  assert.ok(Math.abs(rc(0.5) - 1) < 1e-12)
  assert.ok(Math.abs(rc(1)) < 1e-12)
  let lit = 0
  for (let i = 0; i < 1000; i++) lit += blink(0.6, i / 100)
  assert.ok(Math.abs(lit / 1000 - 0.5) < 0.01)
  assert.equal(blink(0.5, 0), 1)
  assert.equal(blink(0.5, 1), 0)
  assert.equal(held(null, 10, 100), false)
  assert.equal(held(90, 10, 99.9), false)
  assert.equal(held(90, 10, 100), true)
  assert.ok(Math.abs(smoothed(0, 10, 0, 0.3, 0.3) - 5) < 1e-9)
  assert.equal(smoothed(0, 10, 5, 0.3, 1), 0)
})

// spec: A3 §2 seed = fnv1a(id); life.js:11-13 · class: E · technique: known vectors · method: FNV-1a 32 of '' and 'a' against the
// published values; seedOf and draw deterministic · sre: does the same id draw the same number on every box?
test('fnv1a is FNV-1a 32 (the published vectors) and a draw is a pure function of seed and k', () => {
  assert.equal(fnv1a(''), 0x811c9dc5)
  assert.equal(fnv1a('a'), 0xe40c292c)
  assert.equal(fnv1a('foobar'), 0xbf9cf968)
  assert.equal(seedOf('e4b'), pcg(fnv1a('e4b')))
  assert.equal(seedOf('e4b', 3), pcg((fnv1a('e4b') ^ 3) >>> 0))
  assert.notEqual(seedOf('e4b'), seedOf('e2b'))
  const a = draw(seedOf('e4b'), 7)
  assert.equal(a, draw(seedOf('e4b'), 7))
  assert.ok(a >= 0 && a < 1)
  assert.notEqual(draw(seedOf('e4b'), 7), draw(seedOf('e4b'), 8))
})

// spec: A6 §14 item 2 (the same PCG in JS and GLSL) · class: E · technique: a BigInt reference and fixed vectors · method:
// pcg of 0, 1, 42, 0xdeadbeef, 0xffffffff against the long-hand hash; the vectors are pasted in the report for lane D ·
// sre: do the CPU and the GPU draw the same voxel seed?
test('pcg is the JCGT 2020 hash, bit for bit against a BigInt reference (the GPU twin\'s test vector)', () => {
  for (const v of [0, 1, 2, 42, 1000, 0x9e3779b9, 0xdeadbeef, 0xffffffff, fnv1a('e4b'), fnv1a('w-5f0c6c')]) assert.equal(pcg(v), pcgRef(v), `pcg(${v})`)
  assert.equal(pcg(0), 129708002)
  assert.equal(pcg(1), 2831084092)
  assert.equal(pcg(42), 1223963391)
  assert.equal(pcg(0xdeadbeef), 1730779506)
  assert.equal(pcg(0xffffffff), 3861530882)
  assert.equal(fnv1a('e4b'), 2369488506)
  assert.equal(seedOf('e4b'), 3541235546)
})
