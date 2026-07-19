// cli-options.test.mjs
//
// Contract: motoi CLI recognises all documented top-level options
// (--fuel, --seed, --no-color, --verb-layer) without treating them as
// unknown commands. Value-taking flags reject bogus input with a clear
// error. Regression: prior to 2026-07-17 only --fuel was wired; the
// other three declared-in-usage flags surfaced as "unknown command".

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BIN = resolve(__dirname, '..', 'bin', 'motoi')

function run(args) {
  const res = spawnSync('node', [BIN, ...args], { encoding: 'utf8' })
  return { code: res.status, stdout: res.stdout, stderr: res.stderr }
}

test('cli — --fuel <n> is consumed and eval runs', () => {
  const r = run(['--fuel', '100000', 'eval', '(+ 1 2)'])
  assert.strictEqual(r.code, 0, r.stderr)
  assert.match(r.stdout, /^3\s*$/)
})

test('cli — --seed <n> is accepted (not an unknown command)', () => {
  const r = run(['--seed', '42', 'eval', '(+ 1 2)'])
  assert.strictEqual(r.code, 0, r.stderr)
  assert.match(r.stdout, /^3\s*$/)
})

test('cli — --no-color is accepted (not an unknown command)', () => {
  const r = run(['--no-color', 'eval', '(+ 1 2)'])
  assert.strictEqual(r.code, 0, r.stderr)
  assert.match(r.stdout, /^3\s*$/)
})

test('cli — --verb-layer <path> is accepted (not an unknown command)', () => {
  const r = run(['--verb-layer', '/tmp/does-not-matter', 'eval', '(+ 1 2)'])
  assert.strictEqual(r.code, 0, r.stderr)
  assert.match(r.stdout, /^3\s*$/)
})

test('cli — combined options are accepted in any order', () => {
  const r = run(['--fuel', '50000', '--seed', '7', '--no-color', 'eval', '(* 6 7)'])
  assert.strictEqual(r.code, 0, r.stderr)
  assert.match(r.stdout, /^42\s*$/)
})

test('cli — --fuel with garbage value exits with a clear error', () => {
  const r = run(['--fuel', 'notanumber', 'eval', '(+ 1 2)'])
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /--fuel expects a positive integer/)
})

test('cli — --seed with garbage value exits with a clear error', () => {
  const r = run(['--seed', 'notanumber', 'eval', '(+ 1 2)'])
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /--seed expects an integer/)
})

test('cli — --verb-layer with no value exits with a clear error', () => {
  const r = run(['--verb-layer'])
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /--verb-layer expects a path/)
})

test('cli — unknown command still surfaces "unknown command"', () => {
  const r = run(['definitely-not-a-cmd'])
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /unknown command: definitely-not-a-cmd/)
})
