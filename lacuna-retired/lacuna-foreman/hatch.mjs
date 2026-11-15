// hatch.mjs — THE HATCH (ROLEBENCH-2.0 §8; §9 unit 8.7). Owns: one REPL turn from the owner's terminal to the foreman,
// both sides of it. The terminal's side seals a Scheme form as one protocol message, `(msg … (kind hatch) (body (@
// ("form" "…") ("by" "device:<name>"))))`, signed with this Mac's foreman token (the device's key: foreman.sb lets the
// foreman read no other, since it denies owner-key and owner-devices.json), and sends it over the foreman's unix
// socket. The foreman's side refuses a TCP caller and an unsigned body before it reads, lets its own gate open the
// message (unsigned, forged, stale or replayed: refused with the gate's sentence and counted), runs the form as a
// watch-tier worker on the `do` road (orders.mjs runDo: the verbs and caps a watch cart holds, capsFor), waits for
// its value and first reply, and writes one `(hatch (at)(by)(form)(answer))` record through the foreman's log stream
// (chained and redacted at emit time by lacuna-scheme/src/log.js). Refuses: a network listener (the socket only); a
// message of another kind; a form over 4,000 characters; an act tier (a hatch turn is a watch worker, and an act still
// waits for its press); printing the token (law 7). Implements: ROLEBENCH-2.0 §8 (the trap doors), §9 8.7.
// Invariants (§18): "every hatch turn is a record". Faults (§16): none raised; a refusal is one sentence.
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { seal } from './protocol.mjs'
import { runDo, doResult } from './orders.mjs'
import { readForms, dataToJson, writeString, writeData } from '../../lacuna-scheme/src/slat-data.js'

/** The hatch's bounds. */
export const HATCH = Object.freeze({ formChars: 4000, waitMs: 15_000, answerChars: 600 })
/** The foreman's socket: the hatch's only road. */
export const SOCKET = process.env.FOREMAN_SOCK || path.join(os.homedir(), 'lacuna-world', 'foreman', 'foreman.sock')

/**
 * Why the hatch refuses a request before reading its body, or null: a caller on a network port, or a body that is not
 * a signed slat message.
 * @param {import('node:http').IncomingMessage} req
 * @return {?string}
 */
export function hatchRefusal(req) {
  if (req.socket?.remoteAddress) return 'the hatch answers on the foreman\'s unix socket only, never on a network port'
  if (!String(req.headers['content-type'] || '').startsWith('application/slat')) {
    return 'the hatch takes one signed (msg … (kind hatch)) only; this request is not a signed message'
  }
  return null
}

/** The `(hatch …)` record's text. */
function recordText(r) {
  const parts = [['at', r.at], ['by', r.by], ['form', r.form], ['answer', r.answer]]
  return `(hatch${parts.map(([k, v]) => ` (${k} ${writeString(v)})`).join('')})`
}

/** A value as short slat text for the record and the terminal. */
const shown = (v) => {
  try {
    return writeData(v ?? null).slice(0, HATCH.answerChars)
  } catch {
    return String(v).slice(0, HATCH.answerChars)   // a value slat cannot carry (a symbol, a procedure) is said as text
  }
}

/**
 * One hatch turn on the foreman's side: the opened message's form runs as a watch worker, the answer is its value and
 * its first hand reply (within `waitMs`), and the turn is one record in the foreman's log.
 * @param {Object} sup the supervisor
 * @param {{form?: string, by?: string}} body the opened message's body
 * @param {{kind?: string, log: function(string, string): void, waitMs?: number, now?: function(): number}} o the
 *     message's kind and the foreman's log
 * @return {Promise<{ok: boolean, value?: *, reply?: *, why?: string, record: string}>}
 */
export async function hatchTurn(sup, body, o) {
  const at = new Date((o.now ? o.now() : Date.now() / 1000) * 1000).toISOString()
  const by = String(body?.by ?? '').slice(0, 60) || 'device:unknown'
  const form = String(body?.form ?? '').trim()
  const done = (r, answer) => {
    const record = recordText({ at, by, form: form.slice(0, HATCH.formChars), answer })
    o.log('hatch', record)
    return { ...r, record }
  }
  if (o.kind !== 'hatch') {
    const why = `a hatch turn is a (msg … (kind hatch)); this one is ${o.kind || 'no message'}`
    return done({ ok: false, why }, 'refused: not a hatch message')
  }
  if (!form) return done({ ok: false, why: 'the hatch takes one Scheme form' }, 'refused: no form')
  if (form.length > HATCH.formChars) {
    return done({ ok: false, why: `a hatch form is at most ${HATCH.formChars} characters` }, 'refused: too long')
  }
  let w
  try {
    w = runDo(sup, form, { tier: 'watch' })
  } catch (e) {
    const why = String(e.message || e)
    return done({ ok: false, why: why.slice(0, 300) }, `refused: ${why.slice(0, 200)}`)
  }
  // a form that asked a hand or an act waits for its first reply; a pure form is answered by its value at once
  const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms))
  const until = Date.now() + (o.waitMs ?? HATCH.waitMs)
  const open = () => (w.pending || []).length > 0
  let r = doResult(w)
  while (r.ok && r.reply == null && open() && w.state === 'running' && Date.now() < until) {
    await sleep(100)
    r = doResult(w)
  }
  const waiting = r.ok && r.reply == null && open()
  if (w.state === 'running') sup.stop(w.id, 'the hatch turn is answered')   // one turn, one worker
  if (!r.ok) return done({ ok: false, why: r.why, worker: w.id }, `refused: ${String(r.why).slice(0, 200)}`)
  const seconds = Math.round((o.waitMs ?? HATCH.waitMs) / 1000)
  const tail = r.reply != null ? ` reply ${shown(r.reply)}` : waiting ? ` (no reply in ${seconds} s)` : ''
  return done({ ok: true, value: r.value, reply: r.reply, worker: w.id }, `value ${shown(r.value)}${tail}`)
}

/**
 * The terminal's side: one form sealed as a hatch message with the foreman token.
 * @param {string} key the foreman token (read from its file, never printed)
 * @param {{form: string, by: string}} turn
 * @param {number=} at seconds since 1970
 * @return {{slat: string, sig: string}}
 */
export function sealTurn(key, turn, at = Date.now() / 1000) {
  return seal(key, { from: turn.by, to: 'foreman', kind: 'hatch', body: { form: turn.form, by: turn.by }, at })
}

/**
 * A foreman reply as data: the signed `(msg … (body …))` it answers a slat caller with, or JSON.
 * @param {string} text
 * @return {Object}
 */
export function replyOf(text) {
  try {
    return JSON.parse(text)
  } catch {
    const f = readForms(String(text))[0]
    const b = Array.isArray(f) ? f.find((x) => Array.isArray(x) && x[0]?.name === 'body') : null
    return b ? dataToJson(b[1]) : { ok: false, why: 'the foreman answered nothing readable' }
  }
}

/**
 * Sends one sealed turn over the foreman's unix socket. One try (law 10); never a network address.
 * @param {{slat: string, sig: string}} env
 * @param {{token: string, socket?: string, timeoutMs?: number}} o
 * @return {Promise<Object>} the foreman's answer
 */
export function sendTurn(env, o) {
  const socketPath = o.socket || SOCKET
  if (/^[a-z]+:\/\//i.test(socketPath)) {
    return Promise.resolve({ ok: false, why: 'the hatch speaks to a unix socket only, never a network address' })
  }
  return new Promise((resolve) => {
    const headers = { 'content-type': 'application/slat', accept: 'application/slat', 'x-slat-sig': env.sig,
      'x-foreman-token': o.token, 'x-lacuna-who': 'hatch' }
    const timeout = o.timeoutMs ?? HATCH.waitMs + 10_000
    const req = http.request({ socketPath, path: '/hatch', method: 'POST', timeout, headers }, (res) => {
      let text = ''
      res.setEncoding('utf8')
      res.on('data', (c) => { text += c })
      res.on('end', () => resolve(replyOf(text)))
    })
    req.on('timeout', () => req.destroy(new Error('the foreman did not answer in time')))
    const failed = (e) => {
      resolve({ ok: false, why: `the foreman's socket did not answer (${e.code || e.message}); one try, not retried` })
    }
    req.on('error', failed)
    req.end(env.slat)
  })
}

/**
 * Whether a typed text is one whole form yet: its parentheses balance outside strings.
 * @param {string} text
 * @return {boolean}
 */
export function balanced(text) {
  let depth = 0
  let inStr = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inStr) {
      if (c === '\\') i++
      else if (c === '"') inStr = false
    } else if (c === '"') inStr = true
    else if (c === ';') while (i < text.length && text[i] !== '\n') i++
    else if (c === '(') depth++
    else if (c === ')') depth--
  }
  return depth <= 0 && !inStr && text.trim().length > 0
}
