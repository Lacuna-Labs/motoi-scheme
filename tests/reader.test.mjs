// tests/reader.test.mjs — reader coverage, with Patch 4 (scientific
// notation) at the centre.
//
// Provenance: 2026-07-19 (Marcus). Ada surfaced in Book of ML that
// `1e-5` was tokenising as a symbol; the reader now accepts standard
// scientific notation as a number. Everything else in this file is
// smoke-coverage for the reader — enough to catch a regression that
// might slip into a future patch.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parse, tokenize, Sym, clearParseCache } from '../src/reader.js'

// ── Patch 4: scientific notation ─────────────────────────────────────

test('reader — 1e5 parses as number 100000', () => {
  clearParseCache()
  const forms = parse('1e5')
  assert.equal(forms.length, 1)
  assert.equal(forms[0], 100000)
})

test('reader — 1e-5 parses as number 0.00001', () => {
  clearParseCache()
  const forms = parse('1e-5')
  assert.equal(forms.length, 1)
  assert.equal(forms[0], 1e-5)
})

test('reader — 1.5e10 parses as number 15000000000', () => {
  clearParseCache()
  const forms = parse('1.5e10')
  assert.equal(forms.length, 1)
  assert.equal(forms[0], 1.5e10)
})

test('reader — -2E-3 parses as number -0.002', () => {
  clearParseCache()
  const forms = parse('-2E-3')
  assert.equal(forms.length, 1)
  assert.equal(forms[0], -0.002)
})

test('reader — .5e3 parses as number 500', () => {
  clearParseCache()
  const forms = parse('.5e3')
  assert.equal(forms.length, 1)
  assert.equal(forms[0], 500)
})

test('reader — 2e0 parses as number 2', () => {
  clearParseCache()
  const forms = parse('2e0')
  assert.equal(forms.length, 1)
  assert.equal(forms[0], 2)
})

test('reader — bare `e` still a symbol (no exponent digits)', () => {
  clearParseCache()
  const forms = parse('foo-e')
  assert.equal(forms.length, 1)
  assert.ok(forms[0] instanceof Sym)
  assert.equal(forms[0].name, 'foo-e')
})

test('reader — sci notation inside a list works', () => {
  clearParseCache()
  const forms = parse('(list 1e-5 1e5 3.14)')
  assert.equal(forms.length, 1)
  assert.deepEqual(forms[0].slice(1), [1e-5, 100000, 3.14])
})

// ── Backwards-compat: normal numbers still parse ─────────────────────

test('reader — plain integer 42 unchanged', () => {
  clearParseCache()
  assert.equal(parse('42')[0], 42)
})

test('reader — negative integer -7 unchanged', () => {
  clearParseCache()
  assert.equal(parse('-7')[0], -7)
})

test('reader — decimal 3.14 unchanged', () => {
  clearParseCache()
  assert.equal(parse('3.14')[0], 3.14)
})

test('reader — leading dot .5 unchanged', () => {
  clearParseCache()
  assert.equal(parse('.5')[0], 0.5)
})

test('reader — trailing dot 5. unchanged', () => {
  clearParseCache()
  assert.equal(parse('5.')[0], 5)
})

// ── Smoke: reader basics still work ──────────────────────────────────

test('reader — quoted list', () => {
  clearParseCache()
  const forms = parse("'(1 2 3)")
  assert.equal(forms.length, 1)
  assert.equal(forms[0][0].name, 'quote')
  assert.deepEqual(forms[0][1], [1, 2, 3])
})

test('reader — nested list', () => {
  clearParseCache()
  const forms = parse('(+ 1 (* 2 3))')
  assert.equal(forms.length, 1)
  assert.equal(forms[0][0].name, '+')
})

test('reader — string with escape', () => {
  clearParseCache()
  assert.equal(parse('"hi\\nthere"')[0], 'hi\nthere')
})
