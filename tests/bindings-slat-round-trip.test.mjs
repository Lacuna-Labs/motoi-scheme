// bindings-slat-round-trip.test.mjs
//
// Verify the JS slat binding round-trips every fixture in
// tests/vectors.slat. The Python binding runs its equivalent test
// under bindings/python/tests/test_slat.py against the SAME fixture,
// so the two bindings stay wire-compatible.
//
// Contract: for each line L in vectors.slat, slatLoads(slatDumps(slatLoads(L)))
// must deep-equal slatLoads(L).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import { slatLoads, slatDumps } from '../bindings/js/slat.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = resolve(__dirname, 'vectors.slat')

function loadVectorLines() {
  const text = readFileSync(FIXTURE, 'utf8')
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith(';'))
}

test('bindings/js/slat.js — vectors.slat exists and is non-empty', () => {
  const lines = loadVectorLines()
  assert.ok(lines.length > 0, 'vectors.slat should have at least one fixture')
})

test('bindings/js/slat.js — round-trips every vector', () => {
  const lines = loadVectorLines()
  for (const line of lines) {
    const first = slatLoads(line)
    const emitted = slatDumps(first)
    const second = slatLoads(emitted)
    assert.deepStrictEqual(second, first, `round-trip failed for: ${line}`)
  }
})
