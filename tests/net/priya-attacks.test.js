// tests/net/priya-attacks.test.js
//
// Failing test cases from Priya's audit of Composer v1.1 HTTP host.
// See engineering/PRIYA-COMPOSER-AUDIT.ENG.slat for full findings.
//
// These tests DEMONSTRATE bugs. They FAIL against the current
// implementation on purpose — each failure maps to a finding ID.
// When the fix lands, flip these from red → green.
//
// Ship-blocker: P-01 (symlink escape). All others hardening.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { symlinkSync, unlinkSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { createConnection } from 'node:net'
import { request as httpRequest, get as httpGet } from 'node:http'
import { makeCoreEnv } from '../../core/index.js'
import { installHttpServe, _internal } from '../../lib/net/http-serve.js'

function freshEnv() {
  const fuel = { n: 1_000_000 }
  const env = makeCoreEnv({ fuel })
  return { env, fuel }
}

async function startServer(env, opts = {}) {
  const { Sym } = await import('../../src/reader.js')
  const serve = env.get('http/serve')
  const waitReady = env.get('http/wait-until-ready')
  const stop = env.get('http/stop')
  const record = serve(
    new Sym(':port'), opts.port ?? 0,
    new Sym(':cart-dir'), opts.cartDir ?? 'carts',
    new Sym(':compose-perm'), new Sym(opts.composePerm ?? 'local-only'),
  )
  await waitReady(record)
  return { record, stop }
}

function get(port, path) {
  return new Promise((resolveP, reject) => {
    const req = httpGet(`http://127.0.0.1:${port}${path}`, (res) => {
      let body = ''
      res.on('data', (c) => { body += c })
      res.on('end', () => resolveP({ status: res.statusCode, body, headers: res.headers }))
    })
    req.on('error', reject)
    req.setTimeout(3000, () => { req.destroy(new Error('timeout')); reject(new Error('timeout')) })
  })
}

// ── P-01 · symlink escape (HIGH · ship-blocker) ─────────────────────

test('P-01 · symlink escape: /play/:symlinked-cart leaks /tmp file contents', async () => {
  const secretPath = '/tmp/__priya_p01_secret.txt'
  writeFileSync(secretPath, 'PRIYA-P01-SECRET-DATA-should-not-be-served')
  const cartDir = resolve('carts')
  const linkPath = join(cartDir, 'priya-p01-escape.slat')
  try { unlinkSync(linkPath) } catch {}
  symlinkSync(secretPath, linkPath)

  const { env } = freshEnv()
  const { record, stop } = await startServer(env)
  try {
    const res = await get(record.port, '/play/priya-p01-escape')
    // The FIX makes this a 404 (symlinks refused). Currently: 200 with the secret embedded.
    assert.notEqual(res.status, 200,
      `SYMLINK ESCAPE — expected 404 (refuse symlinks), got ${res.status}. ` +
      `Body includes secret? ${res.body.includes('PRIYA-P01-SECRET-DATA')}`)
    assert.ok(!res.body.includes('PRIYA-P01-SECRET-DATA'),
      'response body must not include contents of symlinked-out file')
  } finally {
    stop(record)
    try { unlinkSync(linkPath) } catch {}
    try { unlinkSync(secretPath) } catch {}
  }
})

test('P-01b · symlinked cart-dir itself is refused by safeResolveCartDir', () => {
  const realCartDir = resolve('carts')
  const linkDir = resolve('__priya_p01b_link_cartdir')
  try { unlinkSync(linkDir) } catch {}
  symlinkSync(realCartDir, linkDir)
  try {
    // Under the fix, safeResolveCartDir should refuse a symlinked cart-dir
    // (or at least realpath-verify it stays under cwd). Currently: silently
    // accepts because statSync follows the link.
    assert.throws(() => _internal.safeResolveCartDir('__priya_p01b_link_cartdir'),
      /symlink|escape/i,
      'expected safeResolveCartDir to refuse a symlinked cart-dir')
  } finally {
    try { unlinkSync(linkDir) } catch {}
  }
})

// ── P-01c · symlink chain (link → link → link → target) ──────────────

test('P-01c · symlink chain of length 5 is refused', async () => {
  const secretPath = '/tmp/__priya_p01c_secret.txt'
  writeFileSync(secretPath, 'PRIYA-P01C-CHAIN-SECRET')
  const cartDir = resolve('carts')
  // Chain: chain0.slat → /tmp/link1 → /tmp/link2 → /tmp/link3 → /tmp/link4 → secret
  const chainLinks = [
    '/tmp/__priya_p01c_link4',
    '/tmp/__priya_p01c_link3',
    '/tmp/__priya_p01c_link2',
    '/tmp/__priya_p01c_link1',
  ]
  const finalLink = join(cartDir, 'priya-p01c-chain.slat')
  for (const l of [...chainLinks, finalLink]) { try { unlinkSync(l) } catch {} }
  // Build in reverse: innermost link → secret first.
  let prevTarget = secretPath
  for (const l of chainLinks) {
    symlinkSync(prevTarget, l)
    prevTarget = l
  }
  symlinkSync(prevTarget, finalLink)

  const { env } = freshEnv()
  const { record, stop } = await startServer(env)
  try {
    const res = await get(record.port, '/play/priya-p01c-chain')
    assert.notEqual(res.status, 200,
      `SYMLINK CHAIN — expected 404/refuse, got ${res.status}`)
    assert.ok(!res.body.includes('PRIYA-P01C-CHAIN-SECRET'),
      'response body must not leak the chain-target file')
  } finally {
    stop(record)
    try { unlinkSync(finalLink) } catch {}
    for (const l of chainLinks) { try { unlinkSync(l) } catch {} }
    try { unlinkSync(secretPath) } catch {}
  }
})

// ── P-01d · symlink to /etc/passwd via a symlink hop ────────────────

test('P-01d · symlink to symlink pointing at /etc/passwd is refused', async () => {
  const cartDir = resolve('carts')
  const hop = '/tmp/__priya_p01d_hop'
  const link = join(cartDir, 'priya-p01d-passwd.slat')
  try { unlinkSync(hop) } catch {}
  try { unlinkSync(link) } catch {}
  symlinkSync('/etc/passwd', hop)
  symlinkSync(hop, link)

  const { env } = freshEnv()
  const { record, stop } = await startServer(env)
  try {
    const res = await get(record.port, '/play/priya-p01d-passwd')
    assert.notEqual(res.status, 200,
      `SYMLINK HOP TO /etc/passwd — expected refusal, got ${res.status}`)
    assert.ok(!res.body.includes('root:'),
      'response body must not include /etc/passwd content')
  } finally {
    stop(record)
    try { unlinkSync(link) } catch {}
    try { unlinkSync(hop) } catch {}
  }
})

// ── P-01e · symlink placed inside a subdir traversal ────────────────

test('P-01e · symlink under a subdir is still refused', async () => {
  const cartDir = resolve('carts')
  const subDir = join(cartDir, '__priya_p01e_sub')
  const secretPath = '/tmp/__priya_p01e_secret.txt'
  writeFileSync(secretPath, 'PRIYA-P01E-SUBDIR-SECRET')
  mkdirSync(subDir, { recursive: true })
  const link = join(subDir, 'evil.slat')
  try { unlinkSync(link) } catch {}
  symlinkSync(secretPath, link)

  const { env } = freshEnv()
  const { record, stop } = await startServer(env)
  try {
    const res = await get(record.port, '/play/__priya_p01e_sub%2Fevil')
    assert.notEqual(res.status, 200,
      `SYMLINK IN SUBDIR — expected refusal, got ${res.status}`)
    assert.ok(!res.body.includes('PRIYA-P01E-SUBDIR-SECRET'),
      'response body must not include the symlink-targeted secret')
  } finally {
    stop(record)
    try { unlinkSync(link) } catch {}
    try { unlinkSync(secretPath) } catch {}
    try {
      const { rmSync } = await import('node:fs')
      rmSync(subDir, { recursive: true, force: true })
    } catch {}
  }
})

// ── P-04 · double http/serve on same port ───────────────────────────

test('P-04 · second http/serve on same port surfaces the error (not silent false)', async () => {
  const { env } = freshEnv()
  const { Sym } = await import('../../src/reader.js')
  const serve = env.get('http/serve')
  const waitReady = env.get('http/wait-until-ready')
  const stop = env.get('http/stop')
  // Bind first server to a specific port.
  const r1 = serve(new Sym(':port'), 0, new Sym(':cart-dir'), 'carts')
  await waitReady(r1)
  const port = r1.port
  try {
    const r2 = serve(new Sym(':port'), port, new Sym(':cart-dir'), 'carts')
    const ready = await waitReady(r2, 500)
    // Under the fix, the record should carry :error EADDRINUSE or
    // wait-until-ready should reject. Currently: returns false silently.
    assert.ok(ready === false || (r2 && r2.error),
      'double-listen should surface EADDRINUSE, not silently return false with no diagnostic')
    // Also — the failed record must not leak in _servers.
    assert.ok(r2.error, `r2.error should be set with the EADDRINUSE error; got ${JSON.stringify(r2.error ?? null)}`)
    stop(r2)
  } finally {
    stop(r1)
  }
})

// ── P-03 · Slowloris — server must set explicit timeouts ────────────

test('P-03 · server sets explicit headersTimeout / requestTimeout / keepAliveTimeout', async () => {
  const { env } = freshEnv()
  const { record, stop } = await startServer(env)
  try {
    // Under the fix, these are explicitly configured. Currently: undefined
    // (falls through to Node defaults — 60s / 300s / 5s in Node 18+, but
    // NOT explicitly set means it's fragile across Node versions).
    // The server object is on record.server per http-serve.js.
    const s = record.server
    assert.ok(s.headersTimeout && s.headersTimeout < 30000,
      `headersTimeout should be explicitly set to <30s; got ${s.headersTimeout}`)
    assert.ok(s.requestTimeout && s.requestTimeout < 30000,
      `requestTimeout should be explicitly set to <30s; got ${s.requestTimeout}`)
  } finally {
    stop(record)
  }
})

// ── P-05 · listCarts depth cap ──────────────────────────────────────

test('P-05 · listCarts respects the depth cap advertised in the doctrine comment', async () => {
  // Create a deep genuine directory tree inside carts/.
  const deepBase = resolve('carts', '__priya_p05_deep')
  mkdirSync(deepBase, { recursive: true })
  let dir = deepBase
  for (let i = 0; i < 8; i++) {
    dir = join(dir, `level${i}`)
    mkdirSync(dir, { recursive: true })
  }
  writeFileSync(join(dir, 'deep-cart.slat'), '(cart :name "deep")')
  try {
    const carts = _internal.listCarts(resolve('carts'))
    const deep = carts.find((c) => c.name.includes('deep-cart'))
    // Doctrine comment says "recursive, one level". Under the fix, the deep
    // cart at depth 9 should NOT appear (depth cap = 2). Currently: it appears
    // because recursion is unbounded.
    assert.ok(!deep,
      `deep-cart at depth 9 should be hidden by depth cap; found: ${deep && deep.name}`)
  } finally {
    // Cleanup the deep tree.
    try {
      const { rmSync } = await import('node:fs')
      rmSync(deepBase, { recursive: true, force: true })
    } catch {}
  }
})

// ── P-07 · dot-file cart is readable via /play/.name ─────────────────

test('P-07 · dot-prefixed cart name is refused (align read policy with list policy)', async () => {
  const cartDir = resolve('carts')
  const dotCart = join(cartDir, '.priya-p07-hidden.slat')
  writeFileSync(dotCart, '(cart :hidden "secret")')
  const { env } = freshEnv()
  const { record, stop } = await startServer(env)
  try {
    const res = await get(record.port, '/play/.priya-p07-hidden')
    // Under the fix, dot-prefixed segments are refused → 404 without body leak.
    // Currently: 200 with the file contents rendered.
    assert.notEqual(res.status, 200,
      `dot-prefixed cart name should be refused; got ${res.status}`)
    assert.ok(!res.body.includes('secret'),
      'response body must not include the hidden cart contents')
  } finally {
    stop(record)
    try { unlinkSync(dotCart) } catch {}
  }
})

// ── P-09 · HEAD support ──────────────────────────────────────────────

test('P-09 · HEAD /play/:cart returns 200 with empty body (RFC 7231)', async () => {
  const { env } = freshEnv()
  const { record, stop } = await startServer(env)
  try {
    const status = await new Promise((resolveP, reject) => {
      const req = httpRequest({
        hostname: '127.0.0.1',
        port: record.port,
        path: '/play/composer%2Fsynth-patch',
        method: 'HEAD',
      }, (res) => {
        res.on('data', () => {})
        res.on('end', () => resolveP(res.statusCode))
      })
      req.on('error', reject)
      req.setTimeout(3000, () => { req.destroy(new Error('timeout')); reject(new Error('timeout')) })
      req.end()
    })
    // Under the fix, HEAD returns 200 like GET but with no body.
    // Currently: 405 (only GET is allowed by explicit method check).
    assert.equal(status, 200, `HEAD should be 200 like GET; got ${status}`)
  } finally {
    stop(record)
  }
})

// ── P-06 · safeCartPath (dead code) explicit dot-check ──────────────

test('P-06 · safeCartPath does not admit "." or ".." even in isolation', () => {
  const cartDir = resolve('carts')
  // Note: safeCartPath is not exported via _internal in the current code,
  // but we verify the DESIGN INVARIANT: neither of these names should ever
  // resolve to a real cart, regardless of which helper is used.
  const bad = _internal.safeCartPathWithSubdir(cartDir, '.')
  const badder = _internal.safeCartPathWithSubdir(cartDir, '..')
  assert.equal(bad, null, `. as cart name must return null`)
  assert.equal(badder, null, `.. as cart name must return null`)
  // Additional: names ending in a dot or containing consecutive dots.
  // Under the tighter regex from P-06 fix these would also be null.
  // Currently the base regex allows "foo.." — surface for future misuse.
  const suspicious = _internal.safeCartPathWithSubdir(cartDir, 'foo..bar')
  // Not currently blocked — this assert documents desired-behavior.
  assert.equal(suspicious, null, `consecutive dots should be refused; got ${suspicious}`)
})

// ── P-08 · IPv6 loopback variants classified as local ──────────────

test('P-08 · isLocalRequest accepts all 127.0.0.0/8 addresses', () => {
  // Under the fix, all of these are classified as local (they all ARE
  // loopback per RFC 3330). Currently: only exact 127.0.0.1 / ::1 /
  // ::ffff:127.0.0.1 are accepted.
  const cases = [
    { addr: '127.0.0.1',              expect: true },
    { addr: '127.0.0.2',              expect: true }, // currently false
    { addr: '127.1.2.3',              expect: true }, // currently false
    { addr: '::1',                    expect: true },
    { addr: '::ffff:127.0.0.1',       expect: true },
    { addr: '::ffff:127.0.0.2',       expect: true }, // currently false
    { addr: '203.0.113.42',           expect: false },
    { addr: '',                       expect: false },
    { addr: undefined,                expect: false },
  ]
  for (const c of cases) {
    const req = { socket: c.addr === undefined ? null : { remoteAddress: c.addr } }
    const actual = _internal.isLocalRequest(req)
    assert.equal(actual, c.expect,
      `isLocalRequest(${JSON.stringify(c.addr)}) expected ${c.expect}, got ${actual}`)
  }
})
