// tests/composer/cart-round-trip.test.js
//
// Cart-level round-trip. The bundle spec (Spec/CART-TEMPLATE.slat)
// mandates:
//
//   (equal? cart (composer/cart-apply cart (composer/cart-emit cart)))
//
// Marcus 2026-07-19 (Wave 4).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeCoreEnv } from '../../core/index.js'
import { evaluate } from '../../src/interp.js'
import { parse, Sym, sym } from '../../src/reader.js'
import {
  cartEmit, cartApply, cartEmpty, CART_SECTIONS,
  deepEqual, formatForm,
} from '../../lib/composer/composer.js'

test('cart-empty has all 7 canonical sections in order', () => {
  const cart = cartEmpty()
  assert.equal(cart.length, CART_SECTIONS.length)
  cart.forEach((pair, i) => {
    assert.ok(pair[0] instanceof Sym, 'key must be a Sym')
    assert.equal(pair[0].name, ':' + CART_SECTIONS[i])
    assert.deepEqual(pair[1], [], 'default section value is empty list')
  })
})

test('cart-emit normalizes a JS-object cart to canonical alist', () => {
  const cart = { meta: [[sym(':title'), 'demo']], sprites: [], code: [] }
  const emitted = cartEmit(cart)
  assert.equal(emitted.length, CART_SECTIONS.length)
  // meta is at index 0 and preserves its value.
  assert.equal(emitted[0][0].name, ':meta')
  assert.equal(emitted[0][1].length, 1)
  // palette missing → empty list.
  assert.equal(emitted[1][0].name, ':palette')
  assert.deepEqual(emitted[1][1], [])
})

test('cart round-trip identity — empty cart', () => {
  const cart = cartEmpty()
  const emitted = cartEmit(cart)
  const applied = cartApply(cart, emitted)
  assert.ok(deepEqual(cart, applied),
    `empty round-trip:\n  before: ${formatForm(cart)}\n  after:  ${formatForm(applied)}`)
})

test('cart round-trip identity — populated cart', () => {
  const cart = [
    [sym(':meta'),    [[sym(':title'), 'space-invaders'], [sym(':author'), 'alfred']]],
    [sym(':palette'), [[0, 0, 0], [255, 128, 128], [128, 255, 128]]],
    [sym(':sprites'), [[sym('sprite'), 0, [sym('bytes'), 1, 2, 3, 4]]]],
    [sym(':tiles'),   [[0, 0, 1], [1, 0, 2]]],
    [sym(':sounds'),  [[sym('adsr'), 0.01, 0.1, 0.7, 0.2]]],
    [sym(':music'),   []],
    [sym(':code'),    [[sym('display'), 'hi']]],
  ]
  const emitted = cartEmit(cart)
  const applied = cartApply(cart, emitted)
  const remitted = cartEmit(applied)
  assert.ok(deepEqual(emitted, remitted),
    `round-trip drift:\n  before: ${formatForm(emitted)}\n  after:  ${formatForm(remitted)}`)
})

test('cart-apply overwrites sections from the incoming template', () => {
  const cart = cartEmpty()
  const template = [
    [sym(':meta'), [[sym(':title'), 'updated']]],
  ]
  const applied = cartApply(cart, template)
  // meta was overwritten
  assert.equal(applied[0][1].length, 1)
  // Other sections stayed empty
  assert.deepEqual(applied[1][1], [])
})

test('composer/cart-emit + composer/cart-apply are registered on env', () => {
  const fuel = { n: 1_000_000 }
  const env = makeCoreEnv({ fuel })
  const emit = env.get('composer/cart-emit')
  const apply = env.get('composer/cart-apply')
  const empty = env.get('composer/cart-empty')
  assert.equal(typeof emit, 'function')
  assert.equal(typeof apply, 'function')
  assert.equal(typeof empty, 'function')
  // Round-trip via env-hosted verbs — end-to-end proof.
  const cart = empty()
  const template = emit(cart)
  const applied = apply(cart, template)
  assert.ok(deepEqual(cart, applied), 'end-to-end round-trip via env')
})

test('cart round-trip via Scheme evaluator', () => {
  const fuel = { n: 1_000_000 }
  const env = makeCoreEnv({ fuel })
  const src = `
    (let ((c (composer/cart-empty)))
      (equal? c (composer/cart-apply c (composer/cart-emit c))))
  `
  const forms = parse(src)
  let out
  for (const f of forms) out = evaluate(f, env, fuel)
  assert.equal(out, true, 'Scheme-level round-trip must be #t')
})
