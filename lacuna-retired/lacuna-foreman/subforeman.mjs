// subforeman.mjs — RUN FOREMEN (design §6 change 4). Owns: a run's own process — `child_process.fork` of foreman.mjs from
// the root only, admitted by the broker (≥ 1 GB free, ≤ 8), given a derived key HMAC(token, run) over IPC (never the token
// file, never the environment), its own state dir `<DIR>/sub/<run>/`, its door on `~/.lacuna/foreman-<run>.sock`;
// `/workers/<id>/*` for a worker it owns forwarded over that socket (the signed reply opened with the derived key); its upstream relayed through the root; on exit
// (a crash, a `kill -9`) its workers are buried in the root's record and the death counts toward the root's intensity;
// the root kills every child when it leaves. Refuses: a fork from a child (depth 2), a ninth child, a run twice.
// Implements: design §6 change 4, §17 (exit 89 at admission).
// Invariants (§18): "If a run foreman died, then its children are buried and the root's intensity counted it"; a child never holds the token.
// Faults (§16): F-05 (no room, exit 89 at admission).
import crypto from 'node:crypto'
import { fork as nodeFork } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { admit, release } from './broker.mjs'
import { Gate } from './protocol.mjs'
import { sendMail } from './mail.mjs'

export const INTENSITY = Object.freeze({ deaths: 3, window: 300 })   // OTP's restart intensity on the root: three run-foreman deaths in 300 s

export const DEPTH = 2
const FOREMAN = fileURLToPath(new URL('./foreman.mjs', import.meta.url))

/** The derived key a run foreman signs with: HMAC(token, run). The token itself never leaves the root. */
export const derivedKey = (token, run) => crypto.createHmac('sha256', String(token)).update(String(run)).digest('hex')

export class Subforemen {
  /**
   * @param {object} o {sup, token, dir, sockDir, upstream(kind, w, data), log, fork?} — `fork` is injectable for tests
   */
  constructor(o) {
    this.sup = o.sup; this.token = o.token; this.dir = o.dir; this.sockDir = o.sockDir
    this.upstream = o.upstream; this.log = o.log || (() => {}); this.fork = o.fork || defaultFork
    this.children = new Map()                       // run → {proc, key, sock, workers: Set<id>, since}
    this.owner = new Map()                          // worker id → run
    this.deaths = []                                // for the root's intensity
    if (!process.env.FOREMAN_SUB) process.on('exit', () => this.killAll('the root is leaving'))
  }

  /** Start a run foreman for `run`. → {ok, run, sock} or {ok:false, exit, why}. */
  spawn(run) {
    run = String(run).replace(/[^\w.@-]/g, '_').slice(0, 60)
    if (process.env.FOREMAN_SUB) return { ok: false, exit: 12, why: `a run foreman does not fork (depth ${DEPTH})` }
    if (this.children.has(run)) return { ok: false, exit: 12, why: `run foreman ${run} is already running` }
    const now = this.sup.host.now()
    this.deaths = this.deaths.filter((t) => now - t < INTENSITY.window)
    if (this.deaths.length >= INTENSITY.deaths) return { ok: false, exit: 30, why: `${this.deaths.length} run foremen died in ${INTENSITY.window} s: no fork until the window passes (I-06)` }
    const a = admit(this.sup, 'foreman', { id: run })
    if (!a.ok) return a
    const key = derivedKey(this.token, run)
    const sock = path.join(this.sockDir, `foreman-${run}.sock`)
    const env = { ...process.env, FOREMAN_SUB: run, FOREMAN_DIR: path.join(this.dir, 'sub', run), FOREMAN_SOCK: sock, FOREMAN_PORT: '0', FOREMAN_NAME: `${process.env.FOREMAN_NAME || 'studio'}/${run}` }
    delete env.FOREMAN_TOKEN_FILE
    const proc = this.fork(FOREMAN, env)
    const child = { proc, key, sock, workers: new Set(), since: this.sup.host.now(), ready: false }
    this.children.set(run, child)
    proc.on('message', (m) => this._message(run, child, m))
    proc.on('exit', (code, signal) => this._exit(run, child, code, signal))
    proc.send({ t: 'key', key })                    // the only way the key travels
    this.log('run foreman forked', run, proc.pid)
    return { ok: true, run, sock }
  }

  _message(run, child, m) {
    if (!m || typeof m !== 'object') return
    if (m.t === 'ready') { child.ready = true; return }
    if (m.t === 'own' && m.id) { child.workers.add(String(m.id)); this.owner.set(String(m.id), run); return }
    if (m.t === 'up' && m.msg) {                    // upstream relayed through the root, stamped with the run
      const { kind, worker, data } = m.msg
      this.upstream(kind, { ...(worker || { id: '-', name: `foreman:${run}` }), run_foreman: run }, data)
    }
  }

  _exit(run, child, code, signal) {
    this.children.delete(run)
    release(this.sup, 'foreman', run)
    try { fs.unlinkSync(child.sock) } catch { /* already gone */ }
    const why = signal ? `killed by ${signal}` : `exited ${code}`
    this.deaths.push(this.sup.host.now())
    const recent = this.deaths.filter((t) => this.sup.host.now() - t < INTENSITY.window).length
    if (recent >= INTENSITY.deaths) sendMail(this.sup, null, { kind: 'self-report', severity: 'sick', what: `${recent} run foremen died in ${INTENSITY.window} s (last: ${run}, ${why}); no fork until the window passes`, run, asks: 'a person looks at the run foremen' })
    for (const id of child.workers) {               // buried in the root's record: never a silent death
      this.owner.delete(id)
      this.upstream('child-graved', { id, name: `${run}:${id}`, parent: null, tier: '-', run_foreman: run }, { why: `its run foreman ${why}`, crashes: 1 })
    }
    this.upstream('run-foreman-exit', { id: run, name: `foreman:${run}`, parent: null, tier: '-' }, { why, workers: child.workers.size, code, signal })
    this.log('run foreman left', run, why)
  }

  /** Which run foreman owns worker `id`, or null. */
  owns(id) { return this.owner.get(String(id)) || null }

  /** Forward one door request to the child that owns it. → {code, body} */
  forward(run, method, pathname, body = null) {
    const child = this.children.get(run)
    if (!child) return Promise.resolve({ code: 404, body: { ok: false, why: `no run foreman ${run}` } })
    return new Promise((resolve) => {
      const data = body == null ? null : JSON.stringify(body)
      const req = http.request({ socketPath: child.sock, path: pathname, method, headers: { 'X-Foreman-Token': child.key, 'Content-Type': 'application/json', ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) }, timeout: 10_000 }, (res) => {
        let b = ''
        res.on('data', (c) => { b += c })
        res.on('end', () => {
          // the child's socket speaks slat (law 5): its reply is a (msg …) signed with the derived key, opened here
          // (2026-10-24, U3: read as JSON, every forwarded answer was "no JSON")
          if (String(res.headers['content-type'] || '').startsWith('application/slat')) {
            const o = (child.gate ||= new Gate(child.key, () => this.sup.host.now())).open({ slat: b, sig: res.headers['x-slat-sig'] })
            return resolve(o.ok ? { code: res.statusCode, body: o.msg.body } : { code: 502, body: { ok: false, why: `the run foreman's reply was dropped (${o.drop})` } })
          }
          let j; try { j = JSON.parse(b) } catch { j = { ok: false, why: 'the run foreman answered with no JSON' } } resolve({ code: res.statusCode, body: j })
        })
      })
      req.on('error', (e) => resolve({ code: 502, body: { ok: false, why: `the run foreman ${run} did not answer: ${e.message}` } }))
      req.on('timeout', () => { req.destroy(new Error('timeout')) })
      if (data) req.write(data)
      req.end()
    })
  }

  /** Stop one run foreman (SIGTERM, then SIGKILL after 3 s). */
  stop(run, why = 'stopped') {
    const child = this.children.get(run)
    if (!child) return false
    this.log('stopping run foreman', run, why)
    child.proc.kill('SIGTERM')
    const t = setTimeout(() => { try { child.proc.kill('SIGKILL') } catch { /* gone */ } }, 3000); t.unref?.()
    return true
  }

  killAll(why) { for (const run of [...this.children.keys()]) this.stop(run, why) }

  status() {
    return [...this.children.entries()].map(([run, c]) => ({ run, pid: c.proc.pid ?? null, ready: c.ready, workers: c.workers.size, since: c.since, sock: c.sock }))
  }
}

function defaultFork(file, env) { return nodeFork(file, [], { env, stdio: ['ignore', 'inherit', 'inherit', 'ipc'] }) }
