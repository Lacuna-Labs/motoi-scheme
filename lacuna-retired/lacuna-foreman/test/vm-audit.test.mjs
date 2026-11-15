import test from 'node:test'
import assert from 'node:assert/strict'
import { evalHead } from '../vm-sidecar.mjs'

test('the head of an eval and of a call form', () => {
  assert.equal(evalHead('(eval "(define x 1)")'), 'define')
  assert.equal(evalHead('(status)'), 'status')
  assert.equal(evalHead('(eval "42")'), '?')
})

