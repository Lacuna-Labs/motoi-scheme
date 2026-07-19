// tests/mapping-approval-2026-07-16.test.mjs
//
// Smoke tests for the 5 verbs added 2026-07-16 from the Sakura->Motoi
// verb-mapping approval batch.
//
// Verbs under test:
//   escalate             — control-flow: raise a named condition
//   text/rasterize       — text → pixel raster (mirror of sprite/rasterize)
//   assert/check-with    — predicate assertion
//   assert/invariants    — batched invariant checks
//   assert/audit-verify  — recursive spec-tree audit
//
// Run: node --test tests/mapping-approval-2026-07-16.test.mjs
// Or:  node --test tests/*.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeExtendedBaseEnv } from '../src/lib-loader.js'
import { resetMediaState } from '../lib/media/media.js'
import { Sym, sym } from '../src/reader.js'
import { ErrorObject } from '../lib/base/r7rs-types.js'

function fresh() {
  resetMediaState()
  return makeExtendedBaseEnv()
}

// ── escalate ─────────────────────────────────────────────────────────

test('escalate — registers as a CORE verb', () => {
  const env = fresh()
  assert.ok(env.vars.has('escalate'), 'escalate is registered')
  assert.equal(typeof env.vars.get('escalate'), 'function')
})

test('escalate — raises a named condition with correct type + irritants', () => {
  const env = fresh()
  const escalate = env.vars.get('escalate')
  try {
    escalate(sym('timeout'), 'req-42', 5000)
    assert.fail('escalate should have thrown')
  } catch (e) {
    assert.ok(e instanceof ErrorObject, 'raises an ErrorObject')
    assert.equal(e._errorType, 'timeout', 'type is the condition name')
    assert.deepEqual(e._errorIrritants, ['req-42', 5000],
      'irritants preserved verbatim')
    assert.ok(String(e.message).includes('timeout'),
      'message includes the condition name')
  }
})

test('escalate — catchable by with-exception-handler; type surfaces via error-object-type', () => {
  const env = fresh()
  const escalate = env.vars.get('escalate')
  const withHandler = env.vars.get('with-exception-handler')
  const errType = env.vars.get('error-object-type')

  const result = withHandler(
    (e) => ['caught', errType(e).name],
    () => { escalate(sym('retry-exhausted'), 3) },
  )
  assert.deepEqual(result, ['caught', 'retry-exhausted'])
})

test('escalate — bare string name works too (degraded but not crash)', () => {
  const env = fresh()
  const escalate = env.vars.get('escalate')
  try {
    escalate('plain-string-name')
    assert.fail('should throw')
  } catch (e) {
    assert.equal(e._errorType, 'plain-string-name')
  }
})

// ── text/rasterize ───────────────────────────────────────────────────

test('text/rasterize — registers as a CORE verb', () => {
  const env = fresh()
  assert.ok(env.vars.has('text/rasterize'), 'text/rasterize is registered')
})

test('text/rasterize — empty string returns zero-sized raster', () => {
  const env = fresh()
  const raster = env.vars.get('text/rasterize')('', null, null)
  // raster is an alist: ((Sym('width') 0) (Sym('height') 0) ... (Sym('cells') []))
  assert.ok(Array.isArray(raster))
  const findKey = (k) => {
    for (const entry of raster) {
      if (entry[0] instanceof Sym && entry[0].name === k) return entry[1]
    }
    return undefined
  }
  assert.equal(findKey('width'), 0)
  assert.equal(findKey('height'), 0)
  assert.deepEqual(findKey('cells'), [])
})

test('text/rasterize — non-empty string produces sized raster with cells', () => {
  const env = fresh()
  const raster = env.vars.get('text/rasterize')('hi', sym('default'), sym('red'))
  const findKey = (k) => {
    for (const entry of raster) {
      if (entry[0] instanceof Sym && entry[0].name === k) return entry[1]
    }
    return undefined
  }
  const w = findKey('width')
  const h = findKey('height')
  const cells = findKey('cells')
  assert.ok(w > 0, 'width is positive')
  assert.ok(h > 0, 'height is positive')
  assert.ok(Array.isArray(cells), 'cells is a list')
  assert.equal(cells.length, w * h, 'default stub raster is dense (w*h cells)')
  // Each cell shape: [x, y, color-string]
  const c0 = cells[0]
  assert.ok(Array.isArray(c0) && c0.length === 3)
  assert.equal(typeof c0[2], 'string')
})

test('text/rasterize — record shape has :font and :color', () => {
  const env = fresh()
  // Use 'yellow' which is in NAMED_COLORS so it round-trips as a name;
  // unknown color names degrade to a "#<index>" fallback (that path is
  // exercised in the earlier :cells test which passes sym('red')).
  const raster = env.vars.get('text/rasterize')('X', sym('mono'), sym('yellow'))
  const findKey = (k) => {
    for (const entry of raster) {
      if (entry[0] instanceof Sym && entry[0].name === k) return entry[1]
    }
    return undefined
  }
  const font = findKey('font')
  assert.ok(font instanceof Sym, ':font is a Sym')
  assert.equal(font.name, 'mono')
  assert.equal(findKey('color'), 'yellow')
})

// ── assert/check-with ───────────────────────────────────────────────

test('assert/check-with — registers as a CORE verb', () => {
  const env = fresh()
  assert.ok(env.vars.has('assert/check-with'))
  assert.ok(env.vars.has('assert/invariants'))
  assert.ok(env.vars.has('assert/audit-verify'))
})

test('assert/check-with — pass returns the value unchanged', () => {
  const env = fresh()
  const check = env.vars.get('assert/check-with')
  const isPositive = (x) => x > 0
  const out = check(isPositive, 42, 'must be positive')
  assert.equal(out, 42)
})

test('assert/check-with — fail raises assertion-failed with the value', () => {
  const env = fresh()
  const check = env.vars.get('assert/check-with')
  const isPositive = (x) => x > 0
  try {
    check(isPositive, -1, 'must be positive')
    assert.fail('should have thrown')
  } catch (e) {
    assert.ok(e instanceof ErrorObject)
    assert.equal(e._errorType, 'assertion-failed')
    assert.deepEqual(e._errorIrritants, [-1])
    assert.ok(String(e.message).includes('must be positive'))
  }
})

test('assert/check-with — non-procedure pred raises assertion-arg-error', () => {
  const env = fresh()
  const check = env.vars.get('assert/check-with')
  try {
    check('not-a-proc', 42, 'msg')
    assert.fail('should have thrown')
  } catch (e) {
    assert.ok(e instanceof ErrorObject)
    assert.equal(e._errorType, 'assertion-arg-error')
  }
})

// ── assert/invariants ───────────────────────────────────────────────

test('assert/invariants — all pass returns #t', () => {
  const env = fresh()
  const inv = env.vars.get('assert/invariants')
  const pairs = [
    [() => true, 'always true'],
    [() => 5 > 0, 'five is positive'],
  ]
  assert.equal(inv(pairs), true)
})

test('assert/invariants — collects ALL failures (not just first)', () => {
  const env = fresh()
  const inv = env.vars.get('assert/invariants')
  const pairs = [
    [() => false, 'first fail'],
    [() => true,  'this passes'],
    [() => false, 'second fail'],
    [() => { throw new Error('boom') }, 'third throws'],
  ]
  try {
    inv(pairs)
    assert.fail('should have thrown')
  } catch (e) {
    assert.ok(e instanceof ErrorObject)
    assert.equal(e._errorType, 'invariants-failed')
    // Three failures reported (two false + one throw)
    assert.equal(e._errorIrritants.length, 3)
    assert.equal(e._errorIrritants[0][0], 'first fail')
    assert.equal(e._errorIrritants[1][0], 'second fail')
    assert.equal(e._errorIrritants[2][0], 'third throws')
    assert.ok(String(e._errorIrritants[2][1]).includes('boom'))
  }
})

test('assert/invariants — malformed input raises assertion-arg-error', () => {
  const env = fresh()
  const inv = env.vars.get('assert/invariants')
  try {
    inv('not a list')
    assert.fail('should have thrown')
  } catch (e) {
    assert.ok(e instanceof ErrorObject)
    assert.equal(e._errorType, 'assertion-arg-error')
  }
})

// ── assert/audit-verify ─────────────────────────────────────────────

test('assert/audit-verify — leaf tags pass on matching values', () => {
  const env = fresh()
  const audit = env.vars.get('assert/audit-verify')
  assert.equal(audit(42, sym('number')), true)
  assert.equal(audit(42, sym('integer')), true)
  assert.equal(audit('hi', sym('string')), true)
  assert.equal(audit(sym('foo'), sym('symbol')), true)
  assert.equal(audit(true, sym('boolean')), true)
  assert.equal(audit([1, 2], sym('list')), true)
  assert.equal(audit('anything', sym('any')), true)
})

test('assert/audit-verify — leaf mismatch raises audit-failed with path', () => {
  const env = fresh()
  const audit = env.vars.get('assert/audit-verify')
  try {
    audit('hi', sym('number'))
    assert.fail('should have thrown')
  } catch (e) {
    assert.ok(e instanceof ErrorObject)
    assert.equal(e._errorType, 'audit-failed')
    assert.equal(e._errorIrritants.length, 1)
    const [path, expected, got] = e._errorIrritants[0]
    assert.deepEqual(path, [], 'root-level failure has empty path')
    assert.equal(expected, 'number')
    assert.equal(got, 'string')
  }
})

test('assert/audit-verify — (list-of number) passes on homogeneous numeric list', () => {
  const env = fresh()
  const audit = env.vars.get('assert/audit-verify')
  const spec = [sym('list-of'), sym('number')]
  assert.equal(audit([1, 2, 3, 4], spec), true)
})

test('assert/audit-verify — (list-of number) fails on mixed list, reports index', () => {
  const env = fresh()
  const audit = env.vars.get('assert/audit-verify')
  const spec = [sym('list-of'), sym('number')]
  try {
    audit([1, 'two', 3], spec)
    assert.fail('should have thrown')
  } catch (e) {
    assert.equal(e._errorType, 'audit-failed')
    const [path, expected, got] = e._errorIrritants[0]
    assert.deepEqual(path, [1], 'failure at index 1')
    assert.equal(expected, 'number')
    assert.equal(got, 'string')
  }
})

test('assert/audit-verify — alist spec verifies record shape', () => {
  const env = fresh()
  const audit = env.vars.get('assert/audit-verify')
  const personSpec = [
    [sym('name'), sym('string')],
    [sym('age'),  sym('integer')],
  ]
  const good = [
    [sym('name'), 'alfa'],
    [sym('age'),  42],
  ]
  assert.equal(audit(good, personSpec), true)

  const bad = [
    [sym('name'), 'alfa'],
    [sym('age'),  '42'],   // string instead of integer
  ]
  try {
    audit(bad, personSpec)
    assert.fail('should have thrown')
  } catch (e) {
    assert.equal(e._errorType, 'audit-failed')
    const [path, expected, got] = e._errorIrritants[0]
    assert.deepEqual(path, ['age'])
    assert.equal(expected, 'integer')
    assert.equal(got, 'string')
  }
})

// ── CORE registry coverage ──────────────────────────────────────────

test('CORE_VERBS — all 5 new verbs are members of the CORE set', async () => {
  const { CORE_VERBS } = await import('../core/core-verbs.js')
  assert.ok(CORE_VERBS.has('escalate'), 'escalate is CORE')
  assert.ok(CORE_VERBS.has('text/rasterize'), 'text/rasterize is CORE')
  assert.ok(CORE_VERBS.has('assert/check-with'), 'assert/check-with is CORE')
  assert.ok(CORE_VERBS.has('assert/invariants'), 'assert/invariants is CORE')
  assert.ok(CORE_VERBS.has('assert/audit-verify'), 'assert/audit-verify is CORE')
})
