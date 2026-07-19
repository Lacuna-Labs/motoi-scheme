// tests/net/http-serve.test.js
//
// Composer v1.1 — HTTP host tests.
//
// Alfred, 2026-07-17: kids host their carts so friends can play. Kids
// don't ship OWASP audits, so the server we ship for them must be
// safe by construction:
//   - cart-dir under cwd only
//   - path-traversal refused
//   - local-only compose refuses non-local (spoofed X-Forwarded-For too)

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { get } from 'node:http'
import { EventEmitter } from 'node:events'
import { makeCoreEnv } from '../../core/index.js'
import { installHttpServe, _internal } from '../../lib/net/http-serve.js'

function freshEnv() {
  const fuel = { n: 1_000_000 }
  const env = makeCoreEnv({ fuel })
  return { env, fuel }
}

// Sugar for GET; returns { status, body, headers }.
function httpGet(port, path) {
  return new Promise((resolve, reject) => {
    const req = get(`http://127.0.0.1:${port}${path}`, (res) => {
      let body = ''
      res.on('data', (c) => { body += c })
      res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }))
    })
    req.on('error', reject)
    req.setTimeout(3000, () => { req.destroy(new Error('timeout')); reject(new Error('timeout')) })
  })
}

// Start a server, wait for the bound port, hand back { server-record, port, stop }.
async function startServer(env, opts = {}) {
  const serve = env.get('http/serve')
  const waitReady = env.get('http/wait-until-ready')
  const stop = env.get('http/stop')
  const record = serve(...opts.args ||
    [{ name: ':port' } && Symbol.for('placeholder')])
  return { record, stop }
}

// ── happy-path — landing + /play/:cart ─────────────────────────────

test('http/serve — landing page returns 200 with brand stripes', async () => {
  const { env } = freshEnv()
  const serve = env.get('http/serve')
  const waitReady = env.get('http/wait-until-ready')
  const stop = env.get('http/stop')
  // We call serve with ephemeral port 0. carts/ dir already exists in cwd.
  const args = [
    { constructor: { name: 'Sym' } }, // placeholder; we build the call properly below
  ]
  // The verb is variadic and expects Sym-keyword pairs. Import Sym.
  const { Sym } = await import('../../src/reader.js')
  const record = serve(new Sym(':port'), 0, new Sym(':cart-dir'), 'carts', new Sym(':compose-perm'), new Sym('local-only'))
  try {
    const ready = await waitReady(record)
    assert.ok(ready, 'server bound')
    const port = record.port
    const res = await httpGet(port, '/')
    assert.equal(res.status, 200, 'landing 200')
    assert.ok(res.body.includes('MOTOI SCHEME'), 'brand text present')
    assert.ok(res.body.includes('/play/'), 'has play link')
    // Brand stripes are inline styles referencing pink/green/brown hex.
    // The stripe row is present as three colored div blocks.
    assert.ok(res.body.match(/background:#[0-9a-f]{6}/i), 'stripe colors inline')
  } finally {
    stop(record)
  }
})

test('http/serve — GET /play/synth-patch returns 200 with cart source', async () => {
  const { env } = freshEnv()
  const { Sym } = await import('../../src/reader.js')
  const serve = env.get('http/serve')
  const waitReady = env.get('http/wait-until-ready')
  const stop = env.get('http/stop')
  const record = serve(new Sym(':port'), 0, new Sym(':cart-dir'), 'carts', new Sym(':compose-perm'), new Sym('local-only'))
  try {
    await waitReady(record)
    const res = await httpGet(record.port, '/play/composer%2Fsynth-patch')
    assert.equal(res.status, 200, `expected 200; got ${res.status}: ${res.body.slice(0, 200)}`)
    assert.ok(res.body.includes('synth-patch'), 'cart name in shell')
    assert.ok(res.body.includes('composer/canvas') || res.body.includes('composer'), 'cart source shown')
  } finally {
    stop(record)
  }
})

// ── security — path traversal ──────────────────────────────────────

test('http/serve — path traversal via ../ is refused (403)', async () => {
  const { env } = freshEnv()
  const { Sym } = await import('../../src/reader.js')
  const serve = env.get('http/serve')
  const waitReady = env.get('http/wait-until-ready')
  const stop = env.get('http/stop')
  const record = serve(new Sym(':port'), 0, new Sym(':cart-dir'), 'carts', new Sym(':compose-perm'), new Sym('local-only'))
  try {
    await waitReady(record)
    // Literal ../ in URL → refused at request-line inspection.
    const res = await httpGet(record.port, '/play/..%2Fpackage.json')
    // Either 403 (literal .. found) or 404 (cart lookup rejected). Either
    // is acceptable — the load-bearing property is "not 200".
    assert.notEqual(res.status, 200,
      `traversal should not succeed; got ${res.status}`)
  } finally {
    stop(record)
  }
})

test('http/serve — literal .. in URL segment is refused', async () => {
  // Bypass Node's URL normalization by sending a raw request.
  const { env } = freshEnv()
  const { Sym } = await import('../../src/reader.js')
  const { createConnection } = await import('node:net')
  const serve = env.get('http/serve')
  const waitReady = env.get('http/wait-until-ready')
  const stop = env.get('http/stop')
  const record = serve(new Sym(':port'), 0, new Sym(':cart-dir'), 'carts', new Sym(':compose-perm'), new Sym('local-only'))
  try {
    await waitReady(record)
    // Raw request with literal .. — Node's http server passes this
    // through untouched so our url-inspection catches it.
    const status = await new Promise((resolveP, reject) => {
      const sock = createConnection(record.port, '127.0.0.1', () => {
        sock.write('GET /play/../package.json HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n')
      })
      let buf = ''
      sock.on('data', (c) => { buf += c.toString() })
      sock.on('end', () => {
        const m = /^HTTP\/1\.\d (\d+)/.exec(buf)
        resolveP(m ? Number(m[1]) : 0)
      })
      sock.on('error', reject)
      sock.setTimeout(3000, () => { sock.destroy(new Error('timeout')); reject(new Error('timeout')) })
    })
    assert.equal(status, 403, `expected 403; got ${status}`)
  } finally {
    stop(record)
  }
})

// ── security — compose local-only ─────────────────────────────────
//
// We can't easily bind a non-loopback address in a test, so we exercise
// the isLocalRequest function + the handler directly with a stubbed
// request whose remoteAddress looks remote.

test('http/serve — compose refuses non-localhost even with X-Forwarded-For spoof', async () => {
  const cartDir = _internal.safeResolveCartDir('carts')
  const handler = _internal.makeHandler({ cartDir, composePerm: 'local-only' })
  // Fake a request from a non-local IP that also sends X-Forwarded-For: 127.0.0.1
  const req = new EventEmitter()
  req.method = 'GET'
  req.url = '/compose/composer%2Fsynth-patch'
  req.headers = { 'x-forwarded-for': '127.0.0.1' } // spoofed!
  req.socket = { remoteAddress: '203.0.113.42' }   // TEST-NET-3 address
  const res = {
    statusCode: 0,
    _headers: {},
    setHeader(k, v) { this._headers[k] = v },
    end(body) { this._body = body; this._done = true },
  }
  handler(req, res)
  assert.equal(res.statusCode, 403,
    `compose from non-local should be 403 despite XFF spoof; got ${res.statusCode}`)
  assert.ok(res._body.includes('local-only'), 'response mentions local-only reason')
})

test('http/serve — compose ACCEPTS from real localhost socket', async () => {
  const cartDir = _internal.safeResolveCartDir('carts')
  const handler = _internal.makeHandler({ cartDir, composePerm: 'local-only' })
  const req = new EventEmitter()
  req.method = 'GET'
  req.url = '/compose/composer%2Fsynth-patch'
  req.headers = {}
  req.socket = { remoteAddress: '127.0.0.1' }
  const res = {
    statusCode: 0,
    _headers: {},
    setHeader(k, v) { this._headers[k] = v },
    end(body) { this._body = body; this._done = true },
  }
  handler(req, res)
  assert.equal(res.statusCode, 200, `local compose should be 200; got ${res.statusCode}`)
  assert.ok(res._body.includes('compose'))
})

// ── security — cart-dir must be under cwd ─────────────────────────

test('http/serve — cart-dir escaping cwd throws', () => {
  assert.throws(() => _internal.safeResolveCartDir('/etc'),
    /escapes cwd/,
    'expected safeResolveCartDir to reject /etc')
})

test('http/serve — cart-dir with .. traversal throws', () => {
  // A path like '../../../etc' relative to cwd — resolves outside cwd.
  assert.throws(() => _internal.safeResolveCartDir('../../../etc'),
    /escapes cwd/)
})

test('http/serve — non-existent cart-dir throws', () => {
  assert.throws(() => _internal.safeResolveCartDir('carts/does-not-exist-nowhere'),
    /does not exist/)
})

// ── security — method + malformed url ─────────────────────────────

test('http/serve — POST returns 405', async () => {
  const { env } = freshEnv()
  const { Sym } = await import('../../src/reader.js')
  const serve = env.get('http/serve')
  const waitReady = env.get('http/wait-until-ready')
  const stop = env.get('http/stop')
  const record = serve(new Sym(':port'), 0, new Sym(':cart-dir'), 'carts', new Sym(':compose-perm'), new Sym('local-only'))
  try {
    await waitReady(record)
    // Send a POST via low-level http request.
    const { request } = await import('node:http')
    const status = await new Promise((resolveP, reject) => {
      const req = request({
        hostname: '127.0.0.1',
        port: record.port,
        path: '/',
        method: 'POST',
      }, (res) => {
        res.on('data', () => {})
        res.on('end', () => resolveP(res.statusCode))
      })
      req.on('error', reject)
      req.end('body')
    })
    assert.equal(status, 405, `POST should be 405, got ${status}`)
  } finally {
    stop(record)
  }
})

// ── introspection ─────────────────────────────────────────────────

test('http/serve — http/serve-info returns an alist', async () => {
  const { env } = freshEnv()
  const { Sym } = await import('../../src/reader.js')
  const serve = env.get('http/serve')
  const waitReady = env.get('http/wait-until-ready')
  const stop = env.get('http/stop')
  const info = env.get('http/serve-info')
  const record = serve(new Sym(':port'), 0, new Sym(':cart-dir'), 'carts')
  try {
    await waitReady(record)
    const alist = info(record)
    assert.ok(Array.isArray(alist))
    const portPair = alist.find((p) => p[0] instanceof Sym && p[0].name === ':port')
    assert.ok(portPair, 'has :port pair')
    assert.equal(portPair[1], record.port)
  } finally {
    stop(record)
  }
})

// ── stop is idempotent ────────────────────────────────────────────

test('http/serve — stop returns #t, second stop is soft-no-op', async () => {
  const { env } = freshEnv()
  const { Sym } = await import('../../src/reader.js')
  const serve = env.get('http/serve')
  const stop = env.get('http/stop')
  const waitReady = env.get('http/wait-until-ready')
  const record = serve(new Sym(':port'), 0, new Sym(':cart-dir'), 'carts')
  await waitReady(record)
  const r1 = stop(record)
  assert.equal(r1, true)
  const r2 = stop(record)
  // Second stop is best-effort — either true or false; must not throw.
  assert.ok(r2 === true || r2 === false)
})
