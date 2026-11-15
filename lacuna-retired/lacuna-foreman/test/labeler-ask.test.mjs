// labeler-ask.test.mjs — the labeler's host road (sentry/labeler.mjs askLabel): `sentryAsk` instead of askMind, the same wall.
import assert from 'node:assert/strict'
import test from 'node:test'
import { askLabel, QUESTIONS } from '../sentry/labeler.mjs'

const q = { name: 'on-task?', labels: QUESTIONS['on-task?'] }

test('askLabel asks on the host\'s sentryAsk; an answer outside the grammar is unsure, never a guess', async () => {
  let asked = null
  const sup = { host: { now: () => Date.now() / 1000, sentryModel: () => 'a-1b', sentryAsk: async (_s, req) => { asked = req; return 'yes, that works the goal' } } }
  const r = await askLabel(sup, q, 'Goal: x')
  assert.equal(asked.model, 'a-1b')
  assert.equal(asked.maxTokens, 24)
  assert.equal(r.label, 'unsure')
  assert.ok(['dropped', 'late'].includes(r.by))
})

test('no road and no mind: none, as before', async () => {
  const r = await askLabel({ host: { now: () => 0, sentryModel: () => 'a-1b' } }, q, 'x')
  assert.deepEqual(r, { label: 'unsure', by: 'none', ms: 0 })
})

