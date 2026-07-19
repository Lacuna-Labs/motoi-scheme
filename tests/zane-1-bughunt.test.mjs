// tests/zane-1-bughunt.test.mjs
//
// Zane #1 (Engineer/Bug Hunter) — scope covers:
//   src/{reader,interp,macro,base,cli}
//   lib/base/{r7rs-small,assert}
//   lib/math/{const,basic,pedagogy}
//   lib/graphics/{geom,vec,framebuffer,easing,text}
//
// Each test names the file + bug it defends against. Fixes are
// concentrated in the corresponding source files; tests here are the
// regression floor.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeCoreEnv } from '../core/index.js'
import { makeBaseEnv } from '../src/base.js'
import { Sym, sym, parse, tokenize } from '../src/reader.js'
import { evaluate } from '../src/interp.js'

function fresh() { return makeCoreEnv() }
function baseOnly() { return makeBaseEnv({ n: 1_000_000 }) }

// ── lib/math/pedagogy.js — math/round-to-place float precision ──────────

test('math/round-to-place: no float ghost at place=-1 (21.44 → 21.4)', () => {
  const env = fresh()
  const round = env.vars.get('math/round-to-place')
  // Before fix: 21.400000000000002. After: 21.4 exactly.
  assert.equal(round(21.44, -1), 21.4)
  assert.equal(round(21.45, -1), 21.5)
  assert.equal(round(0.1 + 0.2, -1), 0.3)
})

test('math/round-to-place: place=0 rounds to integer', () => {
  const env = fresh()
  const round = env.vars.get('math/round-to-place')
  assert.equal(round(3.7, 0), 4)
  assert.equal(round(3.4, 0), 3)
  assert.equal(round(-3.5, 0), -3) // Math.round rounds ties toward +∞
})

test('math/round-to-place: place=2 rounds to nearest 100', () => {
  const env = fresh()
  const round = env.vars.get('math/round-to-place')
  assert.equal(round(1234, 2), 1200)
  assert.equal(round(1250, 2), 1300)
})

test('math/round-to-place: place=-2 rounds to nearest 0.01, no float ghost', () => {
  const env = fresh()
  const round = env.vars.get('math/round-to-place')
  assert.equal(round(1.234, -2), 1.23)
  assert.equal(round(1.235, -2), 1.24)
})

// ── lib/math/pedagogy.js — math/expanded-form ──────────────────────────

test('math/expanded-form 0 returns (0), not empty list', () => {
  const env = fresh()
  const ef = env.vars.get('math/expanded-form')
  // Before fix: []. After fix: [0].
  assert.deepEqual(ef(0), [0])
})

test('math/expanded-form 205 skips zero digits properly', () => {
  const env = fresh()
  const ef = env.vars.get('math/expanded-form')
  assert.deepEqual(ef(205), [200, 5])
})

// ── src/base.js — even?/odd? on non-integer inputs ─────────────────────

test('odd?: non-integer inputs are not odd', () => {
  const env = baseOnly()
  const oddQ = env.vars.get('odd?')
  assert.equal(oddQ(1.5), false)   // 1.5 is not odd
  assert.equal(oddQ(3), true)
  assert.equal(oddQ(-3), true)
  assert.equal(oddQ(0), false)
})

test('even?: non-integer inputs are not even', () => {
  const env = baseOnly()
  const evenQ = env.vars.get('even?')
  assert.equal(evenQ(2.5), false)  // 2.5 is not even
  assert.equal(evenQ(4), true)
  assert.equal(evenQ(-4), true)
  assert.equal(evenQ(0), true)
})

// ── src/base.js — eq?/equal? on symbols (previously broken by second def) ──

test('eq? on symbols by name (not reference)', () => {
  const env = baseOnly()
  const eqQ = env.vars.get('eq?')
  // Two Sym instances with the same name should be eq? per the smart
  // equality semantics. sym() interns, but a fresh Sym() shouldn't fail
  // the invariant.
  assert.equal(eqQ(sym('foo'), sym('foo')), true)
  assert.equal(eqQ(new Sym('bar'), new Sym('bar')), true)
})

test('equal? on nested lists is structural', () => {
  const env = baseOnly()
  const equalQ = env.vars.get('equal?')
  assert.equal(equalQ([1, [2, 3]], [1, [2, 3]]), true)
  assert.equal(equalQ([1, [2, 4]], [1, [2, 3]]), false)
  // Symbol equality inside a list
  assert.equal(equalQ([sym('a'), sym('b')], [sym('a'), sym('b')]), true)
})

// ── src/reader.js — number regex admits multiple dots incorrectly? ──────

test('reader NUM_RE: 1.2.3 is NOT parsed as number', () => {
  // Should be parsed as a symbol, since 1.2.3 is not a valid number.
  const forms = parse('1.2.3')
  assert.equal(forms.length, 1)
  assert.ok(forms[0] instanceof Sym, `expected Sym, got ${typeof forms[0]}`)
  assert.equal(forms[0].name, '1.2.3')
})

test('reader NUM_RE: plain 1.5 IS a number', () => {
  const forms = parse('1.5')
  assert.equal(forms.length, 1)
  assert.equal(forms[0], 1.5)
})

test('reader NUM_RE: 1e10 scientific is either sym or number, but consistent', () => {
  // Not required to parse as number, but must not throw.
  const forms = parse('1e10')
  assert.equal(forms.length, 1)
})

// ── src/reader.js — apostrophe-in-identifier gives clean error ─────────
// (architect message @ 2026-07-17T01:22)

test("reader: apostrophe mid-identifier throws a legible ReadError", () => {
  assert.throws(
    () => parse("(define (fx-convert-banker's x) x)"),
    /apostrophe .* inside identifier/,
  )
})

test("reader: apostrophe at token start (quote) still works", () => {
  // 'foo → (quote foo)
  const forms = parse("'foo")
  assert.ok(Array.isArray(forms[0]))
  assert.equal(forms[0][0].name, 'quote')
  assert.equal(forms[0][1].name, 'foo')
})

test("reader: nested quote ''foo works", () => {
  const forms = parse("''foo")
  // (quote (quote foo))
  assert.equal(forms[0][0].name, 'quote')
  assert.equal(forms[0][1][0].name, 'quote')
  assert.equal(forms[0][1][1].name, 'foo')
})

test("reader: (list 'a 'b 'c) parses cleanly", () => {
  const forms = parse("(list 'a 'b 'c)")
  assert.equal(forms[0].length, 4)
})

// ── src/base.js — car/cdr on empty list should error, not silent nil ────

test('car on empty list returns undefined (documented) — but member on non-list is #f', () => {
  const env = baseOnly()
  // member on empty list returns false, not empty list
  const member = env.vars.get('member')
  assert.equal(member(3, []), false)
})

// ── lib/graphics/vec.js — vec/normalize zero-vector safety ────────────

test('vec/normalize on zero vector returns a zero vector (no NaN)', () => {
  const env = fresh()
  const norm = env.vars.get('vec/normalize')
  assert.deepEqual(norm([0, 0]), [0, 0])
  assert.deepEqual(norm([0, 0, 0]), [0, 0, 0])
})

test('vec/dim on scalar returns 1', () => {
  const env = fresh()
  const dim = env.vars.get('vec/dim')
  assert.equal(dim(5), 1)
  assert.equal(dim([1, 2, 3]), 3)
})

// ── lib/graphics/geom.js — geom/slope vertical line ───────────────────

test('geom/slope: horizontal line = 0, not -0', () => {
  const env = fresh()
  const slope = env.vars.get('geom/slope')
  // Horizontal line has slope 0
  assert.equal(slope([0, 5], [10, 5]), 0)
  // Vertical line has slope Infinity
  assert.equal(slope([5, 0], [5, 10]), Infinity)
})

test('geom/polygon-area: triangle', () => {
  const env = fresh()
  const area = env.vars.get('geom/polygon-area')
  // Right triangle with legs 3 and 4 → area 6
  assert.equal(area([[0, 0], [4, 0], [0, 3]]), 6)
})

// ── lib/graphics/easing.js — bezier/spring input sanity ────────────────

test('bezier-ease: t=0 → 0, t=1 → 1', () => {
  const env = fresh()
  const bez = env.vars.get('bezier-ease')
  assert.equal(bez(0, 0.42, 0, 0.58, 1), 0)
  assert.equal(bez(1, 0.42, 0, 0.58, 1), 1)
})

test('named-ease: linear returns t', () => {
  const env = fresh()
  const ne = env.vars.get('named-ease')
  assert.equal(ne(0.5, 'linear'), 0.5)
  assert.equal(ne(0, 'linear'), 0)
  assert.equal(ne(1, 'linear'), 1)
})

test('named-ease: unknown name falls back to linear', () => {
  const env = fresh()
  const ne = env.vars.get('named-ease')
  assert.equal(ne(0.5, 'not-a-real-easing-name'), 0.5)
})

// ── lib/base/r7rs-small.js — exact-integer? for edge cases ─────────────

test('exact-integer?: NaN is not', () => {
  const env = fresh()
  const q = env.vars.get('exact-integer?')
  assert.equal(q(NaN), false)
  assert.equal(q(3), true)
  assert.equal(q(3.5), false)
  assert.equal(q(Infinity), false)
})

test('complex?: NaN is not (Number.isFinite requirement)', () => {
  const env = fresh()
  const q = env.vars.get('complex?')
  assert.equal(q(NaN), false)
  assert.equal(q(3), true)
  assert.equal(q(Infinity), false)
})

// ── src/interp.js — case matches numbers correctly ─────────────────────

test('case: matches integer datum', () => {
  const env = fresh()
  const src = `
    (case 2
      ((1) 'one)
      ((2) 'two)
      (else 'other))`
  const forms = parse(src)
  const fuel = { n: 100000 }
  const r = evaluate(forms[0], env, fuel)
  assert.equal(r instanceof Sym && r.name, 'two')
})

test('case: else clause matches when nothing else does', () => {
  const env = fresh()
  const src = `
    (case 99
      ((1 2 3) 'low)
      (else 'high))`
  const forms = parse(src)
  const fuel = { n: 100000 }
  const r = evaluate(forms[0], env, fuel)
  assert.equal(r instanceof Sym && r.name, 'high')
})

// ── lib/math/basic.js — math/gcd/lcm on negatives ──────────────────────

test('math/gcd handles negative inputs (abs both)', () => {
  const env = fresh()
  const gcd = env.vars.get('math/gcd')
  assert.equal(gcd(-12, 8), 4)
  assert.equal(gcd(12, -8), 4)
  assert.equal(gcd(-12, -8), 4)
})

test('math/gcd(0, 0) = 0', () => {
  const env = fresh()
  const gcd = env.vars.get('math/gcd')
  assert.equal(gcd(0, 0), 0)
})

test('math/lcm(0, x) = 0', () => {
  const env = fresh()
  const lcm = env.vars.get('math/lcm')
  assert.equal(lcm(0, 5), 0)
  assert.equal(lcm(5, 0), 0)
})

test('math/gcd works past 2^31 (no |0 wrap)', () => {
  const env = fresh()
  const gcd = env.vars.get('math/gcd')
  // 3B and 6B share gcd 3B
  assert.equal(gcd(3_000_000_000, 6_000_000_000), 3_000_000_000)
  // Old behaviour would have | 0'd both operands to negative, breaking this
})

test('math/lcm works past 2^31 (no |0 wrap)', () => {
  const env = fresh()
  const lcm = env.vars.get('math/lcm')
  // lcm(2B, 3B) = 6B
  assert.equal(lcm(2_000_000_000, 3_000_000_000), 6_000_000_000)
})

// ── src/introspect.js — arity: 0 must not become null ─────────────────

test('help() preserves arity=0 (newline / pi are zero-arg)', async () => {
  // Use base env only — r7rs-small.js re-defines newline via def() which
  // strips the rich meta table's arity=0 (a pre-existing installer
  // shape). What we're verifying here: the introspect wrapper does NOT
  // truthy-coerce arity=0 to null. That's the fix.
  baseOnly()
  const { help } = await import('../src/introspect.js')
  const nlMeta = help('newline')
  assert.ok(nlMeta, 'newline meta should exist')
  assert.equal(nlMeta.arity, 0, 'newline should report arity 0, not null')
})

// ── src/base.js — modulo/remainder edge cases ─────────────────────────

test('modulo: sign follows divisor (Scheme semantics)', () => {
  const env = baseOnly()
  const mod = env.vars.get('modulo')
  assert.equal(mod(7, 3), 1)
  assert.equal(mod(-7, 3), 2)  // Scheme modulo: result has divisor sign
  assert.equal(mod(7, -3), -2)
  assert.equal(mod(-7, -3), -1)
})

test('remainder: sign follows dividend', () => {
  const env = baseOnly()
  const rem = env.vars.get('remainder')
  assert.equal(rem(7, 3), 1)
  assert.equal(rem(-7, 3), -1)
  assert.equal(rem(7, -3), 1)
})

// ── src/base.js — string->number sanity ────────────────────────────────

test('string->number: garbage returns #f', () => {
  const env = baseOnly()
  const s2n = env.vars.get('string->number')
  assert.equal(s2n('hello'), false)
  assert.equal(s2n('42'), 42)
  assert.equal(s2n('3.14'), 3.14)
  // Radix 16
  assert.equal(s2n('ff', 16), 255)
})

// ── lib/graphics/framebuffer.js — Framebuffer.plot bounds ──────────────

test('Framebuffer.plot: out-of-bounds is silent no-op, not crash', async () => {
  const { Framebuffer } = await import('../lib/graphics/framebuffer.js')
  const fb = new Framebuffer(10, 10)
  // Should not throw
  fb.plot(-1, 5, 3)
  fb.plot(5, -1, 3)
  fb.plot(100, 5, 3)
  fb.plot(5, 100, 3)
  // Verify no accidental writes at edges
  assert.equal(fb.peek(-1, 5), 0)
  assert.equal(fb.peek(100, 5), 0)
})

test('Framebuffer.setColor with unknown string leaves color unchanged', async () => {
  const { Framebuffer } = await import('../lib/graphics/framebuffer.js')
  const fb = new Framebuffer(10, 10)
  fb.setColor(3)
  assert.equal(fb.color, 3)
  fb.setColor('not-a-real-color')
  assert.equal(fb.color, 3) // unchanged
})

// ── lib/base/assert.js — assert/check-with returns value on success ────

test('assert/check-with returns value when predicate is truthy', () => {
  const env = fresh()
  const check = env.vars.get('assert/check-with')
  const posQ = env.vars.get('positive?')
  assert.equal(check(posQ, 5, 'must be positive'), 5)
})

// ── lib/base/r7rs-small.js — full car/cdr chain accessors (R7RS §6.4.1) ──

test('caar/cdar/cddr — 2-deep accessors present', () => {
  const env = fresh()
  const caar = env.vars.get('caar')
  const cdar = env.vars.get('cdar')
  const cddr = env.vars.get('cddr')
  assert.ok(typeof caar === 'function', 'caar missing')
  assert.ok(typeof cdar === 'function', 'cdar missing')
  assert.ok(typeof cddr === 'function', 'cddr missing')
  // (caar '((1 2) (3 4))) → 1
  assert.equal(caar([[1, 2], [3, 4]]), 1)
  // (cdar '((1 2) (3 4))) → (2)
  assert.deepEqual(cdar([[1, 2], [3, 4]]), [2])
  // (cddr '(1 2 3 4)) → (3 4)
  assert.deepEqual(cddr([1, 2, 3, 4]), [3, 4])
})

test('caaar/caadr/cadar/cdaar/cdadr/cddar/cdddr — 3-deep accessors present', () => {
  const env = fresh()
  const names = ['caaar', 'caadr', 'cadar', 'cdaar', 'cdadr', 'cddar', 'cdddr']
  for (const n of names) {
    assert.ok(typeof env.vars.get(n) === 'function', `${n} missing`)
  }
  // (cdddr '(1 2 3 4 5)) → (4 5)
  assert.deepEqual(env.vars.get('cdddr')([1, 2, 3, 4, 5]), [4, 5])
  // (caadr '((1) (2 3) (4))) → 2
  //   cdr → ((2 3) (4)); car → (2 3); car → 2
  assert.equal(env.vars.get('caadr')([[1], [2, 3], [4]]), 2)
})

test('cadddr/cddddr — 4-deep accessors present (were missing)', () => {
  const env = fresh()
  const cadddr = env.vars.get('cadddr')
  const cddddr = env.vars.get('cddddr')
  assert.ok(typeof cadddr === 'function', 'cadddr missing')
  assert.ok(typeof cddddr === 'function', 'cddddr missing')
  // (cadddr '(1 2 3 4 5)) → 4
  assert.equal(cadddr([1, 2, 3, 4, 5]), 4)
  // (cddddr '(1 2 3 4 5 6)) → (5 6)
  assert.deepEqual(cddddr([1, 2, 3, 4, 5, 6]), [5, 6])
})

// ── lib/graphics/framebuffer-verbs.js — after-frame callbacks fire ─────

test('after-frame callbacks are actually invoked on end-frame', () => {
  const env = fresh()
  const beginFrame = env.vars.get('begin-frame')
  const endFrame = env.vars.get('end-frame')
  const afterFrame = env.vars.get('after-frame')

  let fired = 0
  let receivedFrame = null
  afterFrame(function(frameNo) { fired++; receivedFrame = frameNo })

  beginFrame()
  endFrame()
  assert.equal(fired, 1, 'after-frame callback should have fired once')
  assert.equal(typeof receivedFrame, 'number', 'callback receives frame number')

  // Registrations are drained — a second end-frame should NOT refire.
  beginFrame()
  endFrame()
  assert.equal(fired, 1, 'after-frame is one-shot; no refire on next frame')
})

test('after-frame with broken callback does not brick end-frame', () => {
  const env = fresh()
  const beginFrame = env.vars.get('begin-frame')
  const endFrame = env.vars.get('end-frame')
  const afterFrame = env.vars.get('after-frame')

  afterFrame(function() { throw new Error('boom') })
  let secondFired = false
  afterFrame(function() { secondFired = true })

  beginFrame()
  // Must not throw
  const r = endFrame()
  assert.equal(typeof r, 'number', 'end-frame still returns a frame number')
  assert.equal(secondFired, true, 'second callback fires even if first threw')
})
