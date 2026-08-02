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
  assert.match(r.stderr, /unknown command '?definitely-not-a-cmd'?/)
})

// ── `help` and `docs` — the two commands that read the verb registry ──
//
// Added 2026-08-02. Both were broken in the same way: the registry is filled
// in by the library INSTALLERS, not by importing their modules, and neither
// command built an environment first. `motoi help entity/make` therefore
// answered "unknown verb" — indistinguishable, to a learner, from the verb
// not existing — while `motoi help car` worked, because a handful of base
// verbs happen to register at import time.
//
// `docs` had two further faults: a missing `await` (it wrote a Promise to
// stdout and crashed), and `regen` defaulting to `docs/reference` instead of
// the canonical `scheme/reference`, which would have quietly produced a
// second divergent copy of the manual.

test('cli — help finds a verb from a library, not just the base', () => {
  for (const verb of ['car', 'string-join', 'random-integer']) {
    const r = run(['help', verb])
    assert.strictEqual(r.code, 0, `motoi help ${verb}: ${r.stderr}`)
    assert.match(r.stdout, new RegExp(`^${verb.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+—`))
  }
})

test('cli — help still reports a genuinely unknown verb', () => {
  const r = run(['help', 'definitely-not-a-verb'])
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /unknown verb/)
})

test('cli — docs writes the manual instead of a Promise', () => {
  const r = run(['docs'])
  assert.strictEqual(r.code, 0, r.stderr)
  assert.doesNotMatch(r.stdout, /\[object Promise\]/)
  assert.ok(r.stdout.length > 100_000,
    `docs emitted only ${r.stdout.length} bytes — the manual is larger than that`)
})

test('cli — docs is not truncated at the 64K pipe buffer', () => {
  // `process.exit` drops whatever stdout has not flushed. Through a pipe that
  // capped the manual at exactly 65536 bytes, with exit code 0, so nothing
  // reported that `motoi docs | less` had been cut off mid-sentence.
  const r = run(['docs'])
  assert.notStrictEqual(r.stdout.length, 65536)
  assert.match(r.stdout.trimEnd().slice(-1), /\S/)
})
