// tests/hooks/pre-commit.test.mjs
//
// Exercises the Motoi network-abstinence pre-commit hook against synthetic
// staged files inside a throwaway git repo under $TMPDIR.
//
// Uses node:test (motoi-scheme's actual runner per package.json). The
// describe/it/test names are also vitest-compatible if this repo later
// migrates.
//
// Each test:
//   1. mkdtemp a fresh dir, `git init`
//   2. copy .githooks/pre-commit into that repo
//   3. write & stage synthetic files
//   4. run the hook manually (NOT via `git commit`, to keep the test hermetic
//      and avoid needing git identity config)
//   5. assert exit code + stderr contents
//
// The hook reads staged state via `git diff --cached`, so we stage but never
// commit. Running the hook binary directly reproduces exactly what git would
// invoke.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, mkdirSync, copyFileSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..', '..')
const HOOK_SRC = join(REPO_ROOT, '.githooks', 'pre-commit')

function runGit(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' })
  if (r.status !== 0) {
    throw new Error(
      `git ${args.join(' ')} failed in ${cwd}: ${r.stderr || r.stdout}`
    )
  }
  return r
}

function initFixture() {
  const dir = mkdtempSync(join(tmpdir(), 'motoi-hook-'))
  runGit(dir, 'init', '-q', '-b', 'main')
  // dummy identity so future `git commit` (if added) would work; harmless.
  runGit(dir, 'config', 'user.email', 'test@example.com')
  runGit(dir, 'config', 'user.name', 'Test')
  // Copy the hook in and mark executable.
  mkdirSync(join(dir, '.githooks'), { recursive: true })
  copyFileSync(HOOK_SRC, join(dir, '.githooks', 'pre-commit'))
  chmodSync(join(dir, '.githooks', 'pre-commit'), 0o755)
  return dir
}

function stageFile(dir, relpath, contents) {
  const abs = join(dir, relpath)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, contents)
  runGit(dir, 'add', relpath)
}

function runHook(dir) {
  return spawnSync('bash', ['.githooks/pre-commit'], {
    cwd: dir,
    encoding: 'utf8',
  })
}

// ---------- fixtures ---------------------------------------------------------

test('fast path — commit touching neither lib/ nor src/ passes', () => {
  const dir = initFixture()
  stageFile(dir, 'engineering/note.slat', '(note :ok true)\n')
  const r = runHook(dir)
  assert.equal(r.status, 0, `expected pass, got ${r.status}\n${r.stderr}`)
})

test('lib/net/http-serve.js — allow-listed, modifying it passes', () => {
  const dir = initFixture()
  // Simulate the file already existing (committed) then being modified.
  stageFile(dir, 'lib/net/http-serve.js', '// server code\nexport function serve() {}\n')
  runGit(dir, '-c', 'core.hooksPath=/dev/null', 'commit', '-q', '-m', 'seed')
  // Now modify it.
  writeFileSync(
    join(dir, 'lib/net/http-serve.js'),
    '// server code v2\nexport function serve() { return 1 }\n'
  )
  runGit(dir, 'add', 'lib/net/http-serve.js')
  const r = runHook(dir)
  assert.equal(r.status, 0, `expected pass, got ${r.status}\n${r.stderr}`)
})

test('lib/net/loam-client.js — REJECTED with loam-flavored message', () => {
  const dir = initFixture()
  stageFile(
    dir,
    'lib/net/loam-client.js',
    "export async function loamGet(url) { return fetch(url) }\n"
  )
  const r = runHook(dir)
  assert.equal(r.status, 1, 'expected rejection')
  assert.match(r.stderr, /LOAM-flavored violation/)
  assert.match(r.stderr, /_archive-doctrine-violation-loam-client-2026-07-17/)
  assert.match(r.stderr, /Motoi cannot connect to networks\. Ever\./)
  assert.match(r.stderr, /lib\/net\/loam-client\.js/)
})

test('lib/net/etsy-fetcher.js — REJECTED as generic net-file violation', () => {
  const dir = initFixture()
  stageFile(dir, 'lib/net/etsy-fetcher.js', 'export function fetchIt() {}\n')
  const r = runHook(dir)
  assert.equal(r.status, 1, 'expected rejection')
  assert.match(r.stderr, /new file under lib\/net\/ \(not on allow-list\)/)
  assert.match(r.stderr, /Motoi cannot connect to networks/)
  assert.match(r.stderr, /Sakura/)
})

test('src/foo.js — fetch("https://…") REJECTED', () => {
  const dir = initFixture()
  stageFile(
    dir,
    'src/analytics.js',
    'export async function ping() {\n  return fetch("https://api.example.com/ping")\n}\n'
  )
  const r = runHook(dir)
  assert.equal(r.status, 1, 'expected rejection')
  assert.match(r.stderr, /source lines that shape like an HTTP client/)
  assert.match(r.stderr, /remote HTTP fetch|remote URL string literal/)
  assert.match(r.stderr, /src\/analytics\.js/)
})

test('src/foo.js — fetch("http://localhost:8080") ALLOWED (loopback)', () => {
  const dir = initFixture()
  stageFile(
    dir,
    'src/repl.js',
    'export async function ping() {\n  return fetch("http://localhost:8080/health")\n}\n'
  )
  const r = runHook(dir)
  assert.equal(r.status, 0, `expected pass, got ${r.status}\n${r.stderr}`)
})

test('lib/ai/llm.js — exempt (curl to local model endpoint OK)', () => {
  const dir = initFixture()
  stageFile(
    dir,
    'lib/ai/llm.js',
    "// local model exception\nconst r = await fetch('http://api.remote.example/x')\n"
  )
  const r = runHook(dir)
  assert.equal(r.status, 0, `expected pass, got ${r.status}\n${r.stderr}`)
})

test('comments containing http:// are ignored', () => {
  const dir = initFixture()
  stageFile(
    dir,
    'src/notes.js',
    '// see https://example.com/docs for background\nexport const x = 1\n'
  )
  const r = runHook(dir)
  assert.equal(r.status, 0, `expected pass, got ${r.status}\n${r.stderr}`)
})

test('axios import in src/ REJECTED', () => {
  const dir = initFixture()
  stageFile(
    dir,
    'src/thing.js',
    "import axios from 'axios'\nexport const q = axios.get('/x')\n"
  )
  const r = runHook(dir)
  assert.equal(r.status, 1)
  assert.match(r.stderr, /axios/)
})
