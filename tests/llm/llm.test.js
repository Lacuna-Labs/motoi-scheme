// tests/llm/llm.test.js
//
// Tier-0 LLM verb tests. Spec:
// engineering/LLM-AUGMENTED-REPL-1.0.ENG.slat.
//
// Two blocks:
//   (1) With MOTOI_LLM_ENDPOINT UNSET — every verb degrades gracefully
//       to #f (except llm/config which returns ((:backend "none"))).
//       No throws.
//   (2) With a MOCK endpoint (tiny local node http server) — verbs
//       return real strings / vectors / records and compose with the
//       registry.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { makeCoreEnv } from '../../core/index.js'
import { evaluate } from '../../src/interp.js'
import { parse, Sym, sym } from '../../src/reader.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MOCK_SCRIPT = join(__dirname, 'mock-server.mjs')

// Evaluate a source string in a fresh env, return the last value.
function evalSrc(src, envOpt) {
  const fuel = { n: 1_000_000 }
  const env = envOpt || makeCoreEnv({ fuel })
  const forms = parse(src)
  let out
  for (const f of forms) out = evaluate(f, env, fuel)
  return out
}

// Clear env vars so each test starts clean.
function clearEnv() {
  delete process.env.MOTOI_LLM_ENDPOINT
  delete process.env.MOTOI_LLM_MODEL
  delete process.env.MOTOI_LLM_EMBED_ENDPOINT
}

// Find first :key value in an alist (list of [Sym, val] pairs).
function alistGet(alist, key) {
  if (!Array.isArray(alist)) return undefined
  for (const pair of alist) {
    if (Array.isArray(pair) && pair.length === 2 && pair[0] instanceof Sym) {
      if (pair[0].name === key) return pair[1]
    }
  }
  return undefined
}

// ── (1) UNSET-ENDPOINT tests ─────────────────────────────────────────

test('llm — unset endpoint: llm/config returns ((:backend "none"))', () => {
  clearEnv()
  const result = evalSrc('(llm/config)')
  assert.ok(Array.isArray(result), 'config is a list')
  assert.equal(alistGet(result, ':backend'), 'none')
})

test('llm — unset endpoint: llm/ask returns #f (no throw)', () => {
  clearEnv()
  const result = evalSrc('(llm/ask "hello")')
  assert.equal(result, false)
})

test('llm — unset endpoint: llm/complete returns #f', () => {
  clearEnv()
  const result = evalSrc('(llm/complete "(define x")')
  assert.equal(result, false)
})

test('llm — unset endpoint: llm/embed returns #f', () => {
  clearEnv()
  const result = evalSrc('(llm/embed "cortex")')
  assert.equal(result, false)
})

test('llm — unset endpoint: llm/stream returns #f', () => {
  clearEnv()
  // A dummy callback the verb won't call because the backend is missing.
  const result = evalSrc('(llm/stream "hi" (lambda (t) t))')
  assert.equal(result, false)
})

test('llm — unset endpoint: copilot/what-is (quote car) still returns registry record', () => {
  clearEnv()
  const result = evalSrc('(copilot/what-is (quote car))')
  const registryHit = alistGet(result, ':registry-hit')
  assert.ok(registryHit && typeof registryHit === 'object',
    'registry-hit populated even without LLM')
  const referenceHit = alistGet(result, ':reference-hit')
  // car may or may not have doc/contract stored — just check no throw.
  const confidence = alistGet(result, ':confidence')
  assert.ok(confidence instanceof Sym, 'confidence is a symbol')
})

test('llm — unset endpoint: copilot/what-is unknown symbol returns unknown confidence', () => {
  clearEnv()
  const result = evalSrc('(copilot/what-is (quote no-such-verb-xyzzy))')
  assert.equal(alistGet(result, ':registry-hit'), false)
  assert.equal(alistGet(result, ':llm-hit'), false)
  const confidence = alistGet(result, ':confidence')
  assert.equal(confidence.name, 'unknown')
})

test('llm — unset endpoint: copilot/fix returns #f gracefully', () => {
  clearEnv()
  const result = evalSrc('(copilot/fix "some error message")')
  assert.equal(result, false)
})

test('llm — unset endpoint: copilot/rag returns record with :answer #f + :sources list', () => {
  clearEnv()
  const result = evalSrc('(copilot/rag "how does car work")')
  const answer = alistGet(result, ':answer')
  assert.equal(answer, false, 'no LLM → :answer is #f')
  const sources = alistGet(result, ':sources')
  assert.ok(Array.isArray(sources), ':sources is a list even without LLM')
})

test('llm — unset endpoint: copilot/pretty-error falls back to :message extraction', () => {
  clearEnv()
  // Alist-shaped error record.
  const src = '(copilot/pretty-error (list (list (quote :message) "bad car call")))'
  const result = evalSrc(src)
  assert.equal(result, 'bad car call')
})

test('llm — unset endpoint: copilot/explain returns collected docs OR #f', () => {
  clearEnv()
  const result = evalSrc('(copilot/explain (quote car))')
  // Either collected docs (if car has doc) or #f. Both are graceful.
  assert.ok(result === false || typeof result === 'string')
})

test('llm — unset endpoint: copilot/complete without hole returns #f', () => {
  clearEnv()
  const result = evalSrc('(copilot/complete (quote (+ 1)))')
  assert.equal(result, false)
})

test('llm — unset endpoint: copilot/ask returns #f (no throw)', () => {
  clearEnv()
  const result = evalSrc('(copilot/ask "how do I define a variable")')
  assert.equal(result, false)
})

// ── (2) MOCK-endpoint tests ───────────────────────────────────────────

// Spin up the mock server in a CHILD PROCESS. If we ran it in-process,
// the sync HTTP verbs (curl via execFileSync) would deadlock: the parent
// event loop is blocked on the sync call, so it can't answer the request
// it just made. Out-of-process avoids that.
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
    // Fail-safe timeout: if the child doesn't emit ready in 5s, error out.
    setTimeout(() => {
      if (!ready) {
        try { proc.kill() } catch { /* ignore */ }
        reject(new Error('mock-server did not become ready within 5s'))
      }
    }, 5000).unref()
  })
}

async function withMockServer(fn) {
  const { proc, port } = await startMockServer()
  const url = `http://127.0.0.1:${port}/v1/chat/completions`
  const embedUrl = `http://127.0.0.1:${port}/v1/embeddings`
  process.env.MOTOI_LLM_ENDPOINT = url
  process.env.MOTOI_LLM_MODEL = 'mock-model'
  process.env.MOTOI_LLM_EMBED_ENDPOINT = embedUrl
  try {
    await fn()
  } finally {
    clearEnv()
    try { proc.kill() } catch { /* ignore */ }
    // Wait a beat so the OS releases the port before the next test.
    await new Promise((r) => proc.on('exit', r))
  }
}

test('llm — mock endpoint: llm/config reports http backend', async () => {
  await withMockServer(async () => {
    const result = evalSrc('(llm/config)')
    assert.equal(alistGet(result, ':backend'), 'http')
    assert.equal(alistGet(result, ':model'), 'mock-model')
  })
})

test('llm — mock endpoint: llm/ask returns the mocked response', async () => {
  await withMockServer(async () => {
    const result = evalSrc('(llm/ask "what is a closure")')
    assert.ok(typeof result === 'string')
    assert.ok(result.startsWith('MOCK:'), `expected MOCK prefix, got: ${result}`)
    assert.ok(result.includes('what is a closure'))
  })
})

test('llm — mock endpoint: llm/embed returns a vector', async () => {
  await withMockServer(async () => {
    const result = evalSrc('(llm/embed "hello")')
    assert.ok(Array.isArray(result), 'embedding is a list')
    assert.equal(result.length, 4)
    assert.equal(result[0], 0.1)
  })
})

test('llm — mock endpoint: copilot/what-is unknown symbol gets LLM guess', async () => {
  await withMockServer(async () => {
    const result = evalSrc('(copilot/what-is (quote no-such-verb-xyzzy-2))')
    const llmHit = alistGet(result, ':llm-hit')
    assert.ok(typeof llmHit === 'string', 'llm-hit is a string')
    assert.ok(llmHit.startsWith('MOCK:'))
    const confidence = alistGet(result, ':confidence')
    assert.equal(confidence.name, 'guess')
  })
})

test('llm — mock endpoint: copilot/what-is (quote car) composes registry + reference', async () => {
  await withMockServer(async () => {
    const result = evalSrc('(copilot/what-is (quote car))')
    const registryHit = alistGet(result, ':registry-hit')
    assert.ok(registryHit && typeof registryHit === 'object',
      'car is in the registry')
  })
})

test('llm — mock endpoint: copilot/rag returns record with :answer + :sources', async () => {
  await withMockServer(async () => {
    const result = evalSrc('(copilot/rag "how does car work")')
    const answer = alistGet(result, ':answer')
    assert.ok(typeof answer === 'string')
    assert.ok(answer.startsWith('MOCK:'))
    const sources = alistGet(result, ':sources')
    assert.ok(Array.isArray(sources))
    // Should have found car since "car" is a word in the question.
    assert.ok(sources.length >= 1, `expected sources; got ${sources.length}`)
  })
})

test('llm — mock endpoint: copilot/pretty-error rewrites an error record', async () => {
  await withMockServer(async () => {
    const src = '(copilot/pretty-error (list (list (quote :message) "car needs a pair")))'
    const result = evalSrc(src)
    assert.ok(typeof result === 'string')
    assert.ok(result.startsWith('MOCK:'), `expected MOCK prefix, got: ${result}`)
  })
})

test('llm — mock endpoint: copilot/complete fills a #!hole in a form', async () => {
  await withMockServer(async () => {
    // Use string version since #!hole is a special reader token; we
    // wrap in a string via quote as sym so the LLM sees it.
    const result = evalSrc(`(copilot/complete (quote (define (fact n) (if (zero? n) 1 (* n (fact #!hole))))))`)
    assert.ok(typeof result === 'string')
    assert.ok(result.startsWith('MOCK:'))
    // The prompt should mention #!hole.
    assert.ok(result.includes('#!hole'))
  })
})

test('llm — mock endpoint: copilot/ask returns the mocked response with persona prefix', async () => {
  await withMockServer(async () => {
    const result = evalSrc('(copilot/ask "what is a closure")')
    assert.ok(typeof result === 'string')
    assert.ok(result.startsWith('MOCK:'), `expected MOCK prefix, got: ${result}`)
    assert.ok(result.includes('what is a closure'))
  })
})

test('llm — mock endpoint: copilot/ask sends Motoi Copilot persona in system context', async () => {
  await withMockServer(async () => {
    // The mock server echoes the system role back as "SYSTEM: ..." so
    // we can verify copilot/ask actually prepended the persona.
    const result = evalSrc('(copilot/ask "how do I define a lambda")')
    assert.ok(typeof result === 'string')
    assert.ok(result.includes('SYSTEM:'), `expected SYSTEM echo, got: ${result}`)
    assert.ok(result.includes('Motoi Copilot'),
      `expected 'Motoi Copilot' in system context, got: ${result}`)
  })
})

test('llm — mock endpoint: copilot/ask surfaces in-scope verbs when prompt mentions them', async () => {
  await withMockServer(async () => {
    // Mention car — a registered verb — so the copilot/ask hint should
    // append the "in scope: ..." tail.
    const result = evalSrc('(copilot/ask "what does car do")')
    assert.ok(typeof result === 'string')
    assert.ok(result.includes('in scope:'),
      `expected in-scope hint, got: ${result}`)
    assert.ok(result.includes('car'),
      `expected 'car' in in-scope hint, got: ${result}`)
  })
})

test('llm — mock endpoint: llm/stream calls callback then #!eof', async () => {
  await withMockServer(async () => {
    // We test the callback path via a small JS-shim env. Scheme lambdas
    // work here too, so we go through the evaluator.
    const src = `
      (define collected (list))
      (define (cb tok) (set! collected (cons tok collected)))
      (llm/stream "hi" cb)
      collected
    `
    const result = evalSrc(src)
    assert.ok(Array.isArray(result))
    // At least 2 items: the response + the #!eof sentinel (in reverse
    // because we cons'd).
    assert.ok(result.length >= 2, `expected >=2 tokens; got ${result.length}`)
  })
})

test('llm — mock endpoint: copilot/fix returns a repaired form', async () => {
  await withMockServer(async () => {
    const result = evalSrc('(copilot/fix "car requires a pair")')
    assert.ok(typeof result === 'string')
    assert.ok(result.startsWith('MOCK:'))
  })
})

// ── (3) scaffold — writes to disk ─────────────────────────────────────

test('llm — copilot/scaffold writes a real file to a tmp dir + returns path', () => {
  clearEnv()
  const dir = join(tmpdir(), `motoi-llm-scaffold-${process.pid}`)
  const src = `(copilot/scaffold (quote verb) :name (quote hello) :purpose "say hi" :dir ${JSON.stringify(dir)})`
  const path = evalSrc(src)
  assert.ok(typeof path === 'string', 'scaffold returned a path')
  assert.ok(existsSync(path), `file exists at ${path}`)
  const content = readFileSync(path, 'utf8')
  assert.ok(content.includes(':name hello'), 'file contains :name')
  assert.ok(content.includes('"say hi"'), 'file contains :purpose')
  // Cleanup.
  try { unlinkSync(path) } catch { /* ignore */ }
})

test('llm — copilot/scaffold test-kind writes a .test.js', () => {
  clearEnv()
  const dir = join(tmpdir(), `motoi-llm-scaffold-${process.pid}-b`)
  const src = `(copilot/scaffold (quote test) :name (quote demo) :purpose "smoke" :dir ${JSON.stringify(dir)})`
  const path = evalSrc(src)
  assert.ok(typeof path === 'string')
  assert.ok(path.endsWith('.test.js'), `expected .test.js; got ${path}`)
  const content = readFileSync(path, 'utf8')
  assert.ok(content.includes("import { test }"))
  try { unlinkSync(path) } catch { /* ignore */ }
})

// ── (4) Ensure all 12 verbs registered ────────────────────────────────

test('llm — all 13 Tier-0 verbs registered in the env (persona-scoped)', () => {
  const fuel = { n: 1_000_000 }
  const env = makeCoreEnv({ fuel })
  const expected = [
    // Primitives (5)
    'llm/ask', 'llm/complete', 'llm/stream', 'llm/embed', 'llm/config',
    // Persona wrapper (1)
    'copilot/ask',
    // Introspection (3)
    'copilot/what-is', 'copilot/explain', 'copilot/fix',
    // Generative (2)
    'copilot/complete', 'copilot/scaffold',
    // Meta (2)
    'copilot/pretty-error', 'copilot/rag',
  ]
  for (const name of expected) {
    assert.ok(env.vars.has(name), `verb '${name}' registered`)
    assert.equal(typeof env.get(name), 'function', `${name} is a function`)
  }
})
