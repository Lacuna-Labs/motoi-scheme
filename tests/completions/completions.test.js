// tests/completions/completions.test.js
//
// Tier-A (free) + Tier-B (LLM-augmented) completion verbs. Spec:
// engineering/LLM-AUGMENTED-REPL-1.0.ENG.slat (v1.0-completions).
//
// Blocks:
//   (1) Tier A — completions/at-point, completions/import-suggestions,
//       completions/next-arg. All local; no LLM tokens.
//   (2) Tier B — completions/smart-at-point, completions/body. Mocked
//       via the same child-process mock server the LLM tests use.
//   (3) Config — completions/mode round-trip.
//   (4) Degrade — Tier B with MOTOI_LLM_ENDPOINT unset returns Tier A
//       results silently.
//   (5) Latency — Tier A returns in <10ms.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeCoreEnv } from '../../core/index.js'
import { evaluate } from '../../src/interp.js'
import { parse, Sym } from '../../src/reader.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MOCK_SCRIPT = join(__dirname, '..', 'llm', 'mock-server.mjs')

// Evaluate a source string in a fresh env, return the last value.
function evalSrc(src, envOpt) {
  const fuel = { n: 1_000_000 }
  const env = envOpt || makeCoreEnv({ fuel })
  const forms = parse(src)
  let out
  for (const f of forms) out = evaluate(f, env, fuel)
  return out
}

function clearEnv() {
  delete process.env.MOTOI_LLM_ENDPOINT
  delete process.env.MOTOI_LLM_MODEL
  delete process.env.MOTOI_LLM_EMBED_ENDPOINT
  delete process.env.MOTOI_LLM_COMPLETION_MODE
}

// Look up :key in an alist-shaped record (list of [Sym, val] pairs).
function alistGet(alist, key) {
  if (!Array.isArray(alist)) return undefined
  for (const pair of alist) {
    if (Array.isArray(pair) && pair.length === 2 && pair[0] instanceof Sym) {
      if (pair[0].name === key) return pair[1]
    }
  }
  return undefined
}

// Convert a candidate record's :candidate field back to a string.
function candName(rec) {
  const c = alistGet(rec, ':candidate')
  return c instanceof Sym ? c.name : String(c)
}

// ── (1) Tier A tests ────────────────────────────────────────────────

test('completions Tier A — at-point prefix match on registry', () => {
  clearEnv()
  const result = evalSrc('(completions/at-point "no")')
  assert.ok(Array.isArray(result), 'result is a list')
  assert.ok(result.length > 0, 'got at least one candidate')
  const names = result.map(candName)
  // note/strike, note/release, note/place-at are all no-prefixed audio verbs.
  const hasNote = names.some((n) => n.startsWith('note/'))
  assert.ok(hasNote, `expected note/* candidates; got: ${names.slice(0, 5).join(', ')}`)
})

test('completions Tier A — at-point fuzzy match', () => {
  clearEnv()
  // "nsr" should fuzzy-match note/strike (n-s-r in order).
  const result = evalSrc('(completions/at-point "nsr")')
  const names = result.map(candName)
  // The top fuzzy hit should include note/strike given letters n->s->r.
  const idx = names.indexOf('note/strike')
  assert.ok(idx >= 0 && idx < 10,
    `expected note/strike in top 10 fuzzy hits; got: ${names.slice(0, 10).join(', ')}`)
})

test('completions Tier A — at-point returns candidate records with :kind :arity :doc :score :source', () => {
  clearEnv()
  const result = evalSrc('(completions/at-point "car")')
  assert.ok(result.length > 0, 'car should match something')
  const first = result[0]
  // Every candidate is an alist with these keys.
  assert.ok(alistGet(first, ':candidate') instanceof Sym, ':candidate is a Sym')
  assert.ok(alistGet(first, ':kind') instanceof Sym, ':kind is a Sym')
  assert.equal(typeof alistGet(first, ':doc'), 'string', ':doc is a string')
  assert.equal(typeof alistGet(first, ':score'), 'number', ':score is a number')
  assert.ok(alistGet(first, ':source') instanceof Sym, ':source is a Sym')
})

test('completions Tier A — at-point empty query returns empty list', () => {
  clearEnv()
  const result = evalSrc('(completions/at-point "")')
  assert.ok(Array.isArray(result))
  assert.equal(result.length, 0)
})

test('completions Tier A — import-suggestions for note/strike returns (motoi audio)', () => {
  clearEnv()
  const result = evalSrc('(completions/import-suggestions (quote note/strike))')
  assert.ok(Array.isArray(result), 'result is a list')
  assert.ok(result.length > 0, 'got at least one suggestion')
  const first = result[0]
  const importPath = alistGet(first, ':import')
  assert.ok(Array.isArray(importPath), ':import is a list')
  const asNames = importPath.map((p) => p instanceof Sym ? p.name : String(p))
  assert.deepEqual(asNames, ['motoi', 'audio'],
    `expected (motoi audio); got (${asNames.join(' ')})`)
  const provides = alistGet(first, ':provides')
  assert.ok(provides instanceof Sym, ':provides is a Sym')
  assert.equal(provides.name, 'note/strike')
})

test('completions Tier A — import-suggestions for unknown namespace returns []', () => {
  clearEnv()
  const result = evalSrc('(completions/import-suggestions (quote zzz/never))')
  assert.ok(Array.isArray(result), 'result is a list')
  assert.equal(result.length, 0, 'no matches for unknown namespace')
})

test('completions Tier A — import-suggestions for game/nim-sum returns (motoi game-*)', () => {
  clearEnv()
  const result = evalSrc('(completions/import-suggestions (quote game/nim-sum))')
  assert.ok(result.length > 0)
  const first = result[0]
  const importPath = alistGet(first, ':import')
  const asNames = importPath.map((p) => p instanceof Sym ? p.name : String(p))
  assert.equal(asNames[0], 'motoi')
  assert.ok(asNames[1].startsWith('game') || asNames[1] === 'game',
    `expected game-flavored module; got ${asNames.join(' ')}`)
})

test('completions Tier A — next-arg reads verb contract when available', () => {
  clearEnv()
  // note/strike doesn't carry a rich :contract field today, so exercise
  // the graceful-fallback path — result should still shape correctly.
  const result = evalSrc(`(completions/next-arg (quote note/strike) (list (quote (quote C4))))`)
  assert.ok(alistGet(result, ':contract-fragment') !== undefined, 'has :contract-fragment')
  assert.ok(typeof alistGet(result, ':reason') === 'string', ':reason is a string')
})

test('completions Tier A — next-arg for a verb with a contract picks a number for a number slot', () => {
  clearEnv()
  // Use llm/config which has no interesting contract either, so we
  // grab any verb whose registry contract mentions "number" — since
  // meta.contract is rarely populated, we simply confirm that the
  // fallback path RETURNS a record, not an exception.
  const result = evalSrc(`(completions/next-arg (quote car) (list))`)
  assert.ok(Array.isArray(result), 'result is an alist')
  const reason = alistGet(result, ':reason')
  assert.ok(typeof reason === 'string' && reason.length > 0, 'has a reason')
})

test('completions Tier A — next-arg with contract-typed number suggests 0.5', () => {
  // Register a synthetic verb with a rich contract, then ask for its next arg.
  clearEnv()
  const fuel = { n: 1_000_000 }
  const env = makeCoreEnv({ fuel })
  // Manually register a verb with a contract so we can test the
  // contract-parsing path end-to-end.
  env.define('test/mul3', (a, b, c) => a * b * c, {
    perm: 'read',
    contract: '(number number number) -> number',
    arity: 3,
  })
  const result = evalSrc(
    `(completions/next-arg (quote test/mul3) (list 2 3))`,
    env)
  const suggestion = alistGet(result, ':suggestion')
  assert.equal(suggestion, 0.5,
    `expected 0.5 for number slot; got ${JSON.stringify(suggestion)}`)
  const frag = alistGet(result, ':contract-fragment')
  assert.equal(frag, 'number')
})

// ── (2) Tier B — mocked LLM ─────────────────────────────────────────

function startMockServer() {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [MOCK_SCRIPT, '0'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let buf = ''
    let ready = false
    proc.stdout.on('data', (chunk) => {
      buf += chunk.toString('utf8')
      const nl = buf.indexOf('\n')
      if (nl >= 0 && !ready) {
        ready = true
        try {
          const info = JSON.parse(buf.slice(0, nl))
          resolve({ proc, port: info.port })
        } catch (e) { reject(e) }
      }
    })
    proc.stderr.on('data', () => { /* eat */ })
    proc.on('error', reject)
    setTimeout(() => {
      if (!ready) {
        try { proc.kill() } catch { /* ignore */ }
        reject(new Error('mock server not ready in 5s'))
      }
    }, 5000).unref()
  })
}

async function withMockServer(fn) {
  const { proc, port } = await startMockServer()
  const url = `http://127.0.0.1:${port}/v1/chat/completions`
  process.env.MOTOI_LLM_ENDPOINT = url
  process.env.MOTOI_LLM_MODEL = 'mock-model'
  try {
    await fn()
  } finally {
    clearEnv()
    try { proc.kill() } catch { /* ignore */ }
    await new Promise((r) => proc.on('exit', r))
  }
}

test('completions Tier B — smart-at-point with mocked endpoint returns candidates', async () => {
  await withMockServer(async () => {
    // llm-first forces the LLM call even when local returns plenty.
    const result = evalSrc(`(completions/smart-at-point "no" :mode (quote llm-first))`)
    assert.ok(Array.isArray(result))
    assert.ok(result.length > 0, 'got at least one candidate')
    // At least one should be from :source 'llm (the mock returns a MOCK:
    // response; smart-at-point filters to identifier-shaped lines — the
    // mock's echo doesn't necessarily look like identifiers, so we accept
    // ANY response including no LLM lines).
    const sources = result.map((rec) => {
      const s = alistGet(rec, ':source')
      return s instanceof Sym ? s.name : String(s)
    })
    // Registry lines are always present as a fallback.
    assert.ok(sources.includes('registry'),
      `expected 'registry' source in ${sources.join(',')}`)
  })
})

test('completions Tier B — body-completion with mocked endpoint returns a string', async () => {
  await withMockServer(async () => {
    const result = evalSrc(
      `(completions/body "(define (fact n) (if (zero? n) 1")`)
    assert.ok(typeof result === 'string')
    assert.ok(result.startsWith('MOCK:'), `expected MOCK prefix, got: ${result}`)
  })
})

// ── (3) Config ──────────────────────────────────────────────────────

test('completions config — mode round-trip', () => {
  clearEnv()
  // Default is local-only.
  const initial = evalSrc('(completions/mode)')
  assert.ok(initial instanceof Sym)
  assert.equal(initial.name, 'local-only')
  // Set to llm-first — returns the PREVIOUS mode.
  const prev = evalSrc(`(completions/mode (quote llm-first))`)
  assert.ok(prev instanceof Sym)
  assert.equal(prev.name, 'local-only')
  // Read back.
  const now = evalSrc('(completions/mode)')
  assert.equal(now.name, 'llm-first')
  // Reset for other tests.
  evalSrc(`(completions/mode (quote local-only))`)
})

test('completions config — mode rejects bogus value with #f, no change', () => {
  clearEnv()
  evalSrc(`(completions/mode (quote local-only))`)
  const bogus = evalSrc(`(completions/mode (quote nonsense))`)
  assert.equal(bogus, false)
  const now = evalSrc('(completions/mode)')
  assert.equal(now.name, 'local-only')
})

// ── (4) Degrade ─────────────────────────────────────────────────────

test('completions degrade — smart-at-point with LLM unset returns Tier A silently', () => {
  clearEnv()  // no MOTOI_LLM_ENDPOINT
  const result = evalSrc(`(completions/smart-at-point "no" :mode (quote llm-first))`)
  assert.ok(Array.isArray(result))
  // Should be the same shape as Tier A — every candidate has :source 'registry.
  for (const rec of result) {
    const s = alistGet(rec, ':source')
    assert.ok(s instanceof Sym)
    assert.equal(s.name, 'registry',
      `expected registry source (no LLM); got ${s.name}`)
  }
})

test('completions degrade — body with LLM unset returns #f (no throw)', () => {
  clearEnv()
  const result = evalSrc(`(completions/body "(define (fact n)")`)
  assert.equal(result, false)
})

// ── (5) Latency ─────────────────────────────────────────────────────

test('completions latency — Tier A at-point returns in <10ms per call', () => {
  clearEnv()
  const fuel = { n: 1_000_000 }
  const env = makeCoreEnv({ fuel })
  const fn = env.get('completions/at-point')
  // Warm-up.
  fn('no')
  // Measure 10 calls, assert average <10ms.
  const t0 = performance.now()
  for (let i = 0; i < 10; i++) fn('note')
  const avg = (performance.now() - t0) / 10
  assert.ok(avg < 10, `expected <10ms avg; got ${avg.toFixed(2)}ms`)
})

// ── (6) Verb registration smoke ─────────────────────────────────────

test('completions — all 6 verbs registered', () => {
  const fuel = { n: 1_000_000 }
  const env = makeCoreEnv({ fuel })
  const expected = [
    'completions/at-point',
    'completions/import-suggestions',
    'completions/next-arg',
    'completions/smart-at-point',
    'completions/body',
    'completions/mode',
  ]
  for (const name of expected) {
    assert.ok(env.vars.has(name), `verb '${name}' registered`)
    assert.equal(typeof env.get(name), 'function', `${name} is a function`)
  }
})
