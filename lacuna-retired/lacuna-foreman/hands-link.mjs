// hands-link.mjs — THE HOP TO THE HANDS (design §5.1, §6 change 6). Owns: one signed `(msg …)` per hand or act sent to
// `~/.lacuna/hands.sock` as `POST /msg` (body = the slat text, `X-Slat-Sig`), the signed `result` reply opened at the
// gate, and its delivery back to the worker that asked: a run gets it as its positional result, a cart as `(on 'hand …)`
// or `(on 'act …)`. Refuses: a reply that is unsigned, forged, stale, replayed or malformed (dropped and counted at the
// foreman's gate, the ticket left to its deadline); a hop when the socket is absent (the caller falls back to Lacuna's
// API, the retiring road). Implements §5.1 (foreman ↔ lacuna-executor), §7.3 (`result`). Invariants (§18): "every hop is a
// signed (msg …) read by one reader". Faults (§16): F-10 (dropped at the gate), F-01 (exit 15 from the hands).
import fs from 'node:fs'
import http from 'node:http'
import { seal, Gate } from './protocol.mjs'
import { result as runResult } from './intents.mjs'
import { think } from './talk.mjs'

/** Is the hands daemon's door there? */
export const handsPresent = (sock) => { try { return fs.statSync(sock).isSocket() } catch { return false } }

/**
 * Send one hand or act to the hands and deliver the reply. Never throws; a failure is thought on the worker and the
 * ticket keeps its deadline (alive.mjs decides what happens next).
 * @param {object} o {sup, sock, key, kind: 'hand'|'act', w, data: {ticket, op, args, n?, run?}, from?, timeoutMs?}
 * @returns {Promise<{ok: boolean, exit?: number, why?: string}>}
 */
export async function sendToHands(o) {
  const { sup, sock, key, kind, w, data } = o
  const now = () => sup.host.now()
  const gate = (sup.handsGate ||= new Gate(key, now))
  const deadline = data.deadline ?? (kind === 'act' ? sup.alive.acts[data.op] ?? sup.alive.act : sup.alive.hand)
  // `run` is the run's id (its directory runs/<id>/, the name its contract carries); the key rides beside it (2026-10-23: a checkout landed under the key)
  const t = (w.pending || []).find((x) => x.ticket === String(data.ticket)) || null
  const body = { ticket: data.ticket, op: data.op, args: data.args || [], run: w.id, key: data.run || w.run?.key || w.contract?.key || null, deadline, tier: w.jailTier || (kind === 'act' ? 'J1' : 'J0'), pressed: data.pressed === true, pressed_by: data.pressed_by || null,   // pressed: the owner's press landed; the same ticket, once more; by whom (the audit row)
                 touches: data.touches || w.run?.touches || w.cart?.touches || [], repo: data.repo || w.run?.repo || null,   // the run's checkout, for every act in it
                 // SENTRY-2.0 §4 (K1.3): the ticket's coordinate, its generation, its step, the step's allows and their hash (H1.2:
                 // the hands recompute the hash and fence the op, lacuna-executor/fence.mjs)
                 at: data.at || t?.at || w.contract?.at || null, gen: t?.gen ?? w.gen ?? 1, step: w.contract?.latch?.k ?? null,
                 allows: w.contract?.latch?.allows ?? null, allows_sha256: w.contract?.latch?.allows_sha ?? null }
  const env = seal(key, { from: o.from || 'foreman', to: 'hands', kind, body, at: now() })
  const got = await post(sock, env, (o.timeoutMs ?? (deadline + 15) * 1000))
  if (!got.ok) { think(w, 'state', `${kind} ${data.op} ${data.ticket}: the hands did not answer (${got.why})`, now()); return got }
  const r = gate.open({ slat: got.text, sig: got.sig })
  if (!r.ok) { think(w, 'state', `${kind} ${data.op} ${data.ticket}: reply dropped (${r.drop}: ${r.why}) — F-10`, now()); return { ok: false, why: r.why, drop: r.drop } }
  const m = r.msg
  if (m.kind !== 'result') { think(w, 'state', `${kind} ${data.op}: the hands answered '${m.kind}', not result`, now()); return { ok: false, why: `kind ${m.kind}` } }
  // a cart reads its answer as (get r 'result …), the errand-era shape; the hands answer rows, text or tail: the first present
  // rides as `result` too, and a reply with none carries no `result` key, so the cart's default still holds
  const answer = m.body?.rows ?? m.body?.result ?? m.body?.text ?? m.body?.tail
  const value = { ...(m.body || {}), ...(answer == null ? {} : { result: answer }), ticket: data.ticket, op: data.op, ok: (m.body?.exit ?? 30) === 0 }
  if (o.deliver) { try { o.deliver(value) } catch (e) { return { ok: false, why: String(e.message || e) } } return { ok: true, exit: value.exit } }
  const live = sup.workers.get(w.id)
  if (!live || live.state !== 'running') return { ok: true, exit: value.exit, late: true }
  try {                                             // a fault in the delivery is the worker's thought, never the daemon's death
    if (live.run) runResult(sup, w.id, kind, value)
    else sup.send(w.id, kind, value)
  } catch (e) { think(w, 'state', `${kind} ${data.op}: the reply could not be delivered (${String(e.message || e).slice(0, 160)})`, now()); return { ok: false, why: String(e.message || e) } }
  return { ok: true, exit: value.exit }
}

function post(sock, env, timeoutMs) {
  return new Promise((resolve) => {
    const req = http.request({ socketPath: sock, path: '/msg', method: 'POST', timeout: timeoutMs,
      headers: { 'Content-Type': 'application/slat', 'X-Slat-Sig': env.sig, 'Content-Length': Buffer.byteLength(env.slat) } }, (res) => {
      let text = ''
      res.setEncoding('utf8'); res.on('data', (d) => { text += d })
      res.on('end', () => resolve({ ok: true, code: res.statusCode, text, sig: res.headers['x-slat-sig'] }))
    })
    req.on('timeout', () => req.destroy(new Error(`no reply in ${timeoutMs} ms`)))
    req.on('error', (e) => resolve({ ok: false, why: e.message }))
    req.end(env.slat)
  })
}

/**
 * The contract to its one writer (design §6 change 3): `(msg … (kind contract) (body (run <id>) (text …)))` to the hands, which
 * write `~/lacuna-world/runs/<id>/CONTRACT.slat` atomically. Never throws; a refusal or a drop is thought on the worker.
 * @param {object} o {sup, sock, key, w, text}
 */
export async function writeContract(o) {
  const { sup, sock, key, w, text } = o
  const now = () => sup.host.now()
  const gate = (sup.handsGate ||= new Gate(key, now))
  const env = seal(key, { from: 'foreman', to: 'hands', kind: 'contract', body: { run: w.id, text }, at: now() })
  const got = await post(sock, env, 10_000)
  if (!got.ok) { think(w, 'state', `contract not written: the hands did not answer (${got.why})`, now()); return got }
  const r = gate.open({ slat: got.text, sig: got.sig })
  if (!r.ok) { think(w, 'state', `contract not written: reply dropped (${r.drop})`, now()); return { ok: false, why: r.why } }
  const b = r.msg.body || {}
  if (b.exit !== 0) { think(w, 'state', `contract not written: ${b.why || 'refused'}`, now()); return { ok: false, why: b.why } }
  return { ok: true, path: b.path, sha: b.sha }
}
