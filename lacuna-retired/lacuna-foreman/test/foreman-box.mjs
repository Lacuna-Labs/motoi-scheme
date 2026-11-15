// foreman-box.mjs — U3'S SCRATCH BOX FOR THE ROOT. Owns: one scratch foreman per test as a child process (through
// tools/burn-in/scratch.mjs `startForeman`, imported, never edited) under /private/tmp/lacuna-unit/U3/<short>/ with HOME
// pointed at that dir, so every default path the daemon derives from the home (the token, the hands socket, the tiers
// table, the world) lands in scratch; a stub door from the same file; a scriptable door for the cases the stub cannot
// play (a slow answer, a status code, a mind that says no); the coverage directory passed through so the child's lines
// count; the clean stop of everything a test started. Refuses: the live foreman (:1139), the door (:1138), the brain
// (:8091), ~/lacuna-world and ~/.lacuna (HOME is the scratch dir, LACUNA_URL is a stub); a token on stdout.
// Implements: unit-test work order §5 (process kill and signal on our own scratch child only), §6 (the daemon's door and
// signal paths reached by booting it). Invariants (§18): none of its own. Faults (§16): none.
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import crypto from 'node:crypto'
import { startForeman, startStubDoor, request, sleep, now } from '../../../tools/burn-in/scratch.mjs'
import { seal, Gate } from '../protocol.mjs'

export { request, sleep, now, seal, startStubDoor }
export const U3 = '/private/tmp/lacuna-unit/U3'
export const CLOCK = new URL('./foreman-clock.mjs', import.meta.url).pathname

/** A fresh scratch dir with a short path (a Unix socket path is ≤ 104 bytes, M2). */
export function scratch(tag) {
  const d = path.join(U3, `${tag}-${crypto.randomBytes(3).toString('hex')}`)
  fs.mkdirSync(d, { recursive: true, mode: 0o700 })
  return d
}

/**
 * The environment every scratch foreman gets on top of scratch.mjs's own: the home is the scratch dir, the tables and the
 * carts are scratch files, the coverage directory rides through. `clock` loads the time-scaling preload (foreman-clock.mjs).
 * @param {string} dir the scratch dir
 * @param {{clock?: number, env?: object}} o
 */
export function scratchEnv(dir, o = {}) {
  const carts = path.join(dir, 'carts-src'); fs.mkdirSync(carts, { recursive: true })
  return {
    HOME: dir, FOREMAN_TIERS: path.join(dir, 'tiers.json'), FOREMAN_BOX: path.join(dir, 'box.json'), FOREMAN_CARTS: carts,
    NODE_V8_COVERAGE: process.env.NODE_V8_COVERAGE,
    // a scratch foreman is not hushed by the real box's load (the CI runs beside model sittings); the hush on load has its
    // own test, which sets FOREMAN_LOAD itself (2026-10-25)
    FOREMAN_LOAD: '1000',
    ...(o.clock ? { NODE_OPTIONS: `--import=${CLOCK}`, U3_CLOCK_SCALE: String(o.clock) } : {}),
    ...(o.env || {}),
  }
}

/**
 * Boot a scratch foreman for test `t` and stop it (SIGTERM, then SIGKILL) when the test ends.
 * @param {object} t the node:test context
 * @param {{tag?: string, dir?: string, door?: object, clock?: number, env?: object, sock?: string, port?: number, keep?: boolean}} o
 * @returns {Promise<{f: object, door: object, dir: string}>}
 */
export async function boot(t, o = {}) {
  const dir = o.dir || scratch(o.tag || 'f')
  const door = o.door || await startStubDoor()
  const f = await startForeman({ dir, door: door.url, port: o.port, sock: o.sock, env: scratchEnv(dir, o) })
  t.after(async () => {
    if (!f.exited) { f.kill('SIGTERM'); if (!(await f.waitExit(3000))) { f.kill('SIGKILL'); await f.waitExit(2000) } }
    if (!o.door) await door.close()
    if (!o.keep) fs.rmSync(dir, { recursive: true, force: true })
  })
  return { f, door, dir }
}

/**
 * A door whose every answer the test writes: `route(pathname, body, req)` returns `{status, body}` or `{hang: ms}` or
 * `{destroy: true}`; every request is recorded in `seen`.
 */
export function scriptDoor(route) {
  const seen = []
  const srv = http.createServer((req, res) => {
    let b = ''; req.on('data', (d) => { b += d })
    req.on('end', async () => {
      const u = new URL(req.url, 'http://x'); let j = null; try { j = JSON.parse(b || 'null') } catch { j = b }
      seen.push({ path: u.pathname, query: u.search, body: j, headers: req.headers })
      const a = (await route(u.pathname, j, req)) || { status: 200, body: { ok: true } }
      if (a.hang) await sleep(a.hang)
      if (a.destroy) return req.socket.destroy()
      res.writeHead(a.status || 200, { 'content-type': 'application/json' }); res.end(typeof a.body === 'string' ? a.body : JSON.stringify(a.body ?? { ok: true }))
    })
  })
  return new Promise((resolve) => srv.listen(0, '127.0.0.1', () => resolve({
    url: `http://127.0.0.1:${srv.address().port}`, seen, events: seen,
    close: () => new Promise((r) => { srv.closeAllConnections?.(); srv.close(() => r()) }),
  })))
}

/** Poll `fn` every 20 ms until it returns truthy or `ms` passes; returns the last value. */
export async function until(fn, ms = 5000) {
  const end = Date.now() + ms; let v
  while (Date.now() < end) { v = await fn(); if (v) return v; await sleep(20) }
  return v
}

/** The upstream kinds a stub door heard, in order. */
export const kinds = (door) => door.events.map((e) => e.kind)

/** A worker program that reports `n` on every `ping` and can be made to throw. */
export const PROBE = `(on 'ping (lambda (x) (remember 'n (+ 1 (recall 'n 0))) (report 'pong (recall 'n 0))))
(on 'boom (lambda (x) (car '())))`

/**
 * The box's memory as the governor reads it (E1.3, 2026-10-30: the foreman's one memory source is the hands' coast-sample,
 * never the API's series): a scratch hands socket in `dir` whose coast-sample answers `st.memGb` GB as vm_stat pages; null
 * answers no reading (exit 12), 'down' drops the connection; every other op answers exit 12. Boot the foreman with `dir`
 * and `env` so it signs with the token the socket checks.
 * @param {object} t the node:test context
 * @param {{memGb: (number|null|string)}} st read on every request
 * @returns {Promise<{dir: string, env: {LACUNA_HANDS_SOCK: string}, ops: string[]}>}
 */
export async function memoryHands(t, st) {
  const dir = scratch('mem')
  const sock = path.join(dir, 'h.sock')
  const ops = []
  const srv = http.createServer((req, res) => {
    let text = ''
    req.setEncoding('utf8')
    req.on('data', (d) => { text += d })
    req.on('end', () => {
      if (st.memGb === 'down') return req.socket.destroy()
      const key = fs.readFileSync(path.join(dir, 'token'), 'utf8').trim()
      // the foreman's own clock (a test may jump it): the request's `at` is the time both gates judge by
      const at = Number(text.match(/\(at ([\d.]+)\)/)?.[1]) || now()
      const got = new Gate(key, () => at).open({ slat: text, sig: req.headers['x-slat-sig'] })
      ops.push(got.msg?.body?.op)
      const pages = Math.round((Number(st.memGb) * 1e9) / 16384)
      const body = got.ok && got.msg.body?.op === 'coast-sample' && st.memGb != null
        ? { ticket: got.msg.body.ticket, exit: 0, rows: { rows: [], vm: `Mach Virtual Memory Statistics: (page size of 16384 bytes)\nPages free: ${pages}.\nPages active: 1.\nPages inactive: 0.\nPages speculative: 0.\nPages wired down: 1000.\n` } }
        : { ticket: got.msg?.body?.ticket ?? null, exit: 12, why: `no ${got.msg?.body?.op || 'reading'} here` }
      const out = seal(key, { from: 'hands', to: 'foreman', kind: 'result', body, at })
      res.writeHead(200, { 'Content-Type': 'application/slat', 'X-Slat-Sig': out.sig })
      res.end(out.slat)
    })
  })
  await new Promise((r) => srv.listen(sock, r))
  t.after(() => new Promise((c) => { srv.closeAllConnections?.(); srv.close(() => c()) }))
  return { dir, env: { LACUNA_HANDS_SOCK: sock }, ops }
}
