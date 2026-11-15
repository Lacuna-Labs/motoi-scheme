// u5-door.mjs — THE U5 LANE'S DOOR STUB. Owns: an HTTP stub of the Lacuna API's two mind roads (`POST /api/foreman/mind`,
// `POST /api/foreman/cascade`) on 127.0.0.1:<free port>, scripted per request (an answer, a status, a raw body, a delay,
// a body that never ends, a socket destroyed, no answer at all), and `doorMind`, the foreman's door adapter shape
// (foreman.mjs `mind()`: POST JSON, `AbortSignal.timeout`, `!r.ok` throws, `!d.ok` throws, the body's `text`,
// `certainty`, `box` passed through as the door wrote them). Refuses: the live door (:1138), the brain (:8091), the small
// minds (:8092+), any token (the stub ignores the header it is sent). Implements: work order U5 (mock the door, never the
// module under test), design §10 (the small mind is asked through Lacuna), engineering §3.2 hop 7 (a small mind 60 s,
// the 26B rung 300 s). Invariants (§18): none of its own. Faults (§16): none.
import http from 'node:http'

/**
 * Start a stub door. `script(req)` decides each answer from `{path, body}`; it returns one of
 * `{json}` · `{status, json}` · `{raw}` · `{delayMs, json}` · `{hang: true}` (headers sent, body never ends) ·
 * `{never: true}` (nothing is ever written) · `{destroy: true}` (the socket is cut).
 * @param {function({path: string, body: object}): object} script the answer per request
 * @returns {Promise<{url: string, hits: Array<{path: string, body: object}>, close: function(): Promise<void>}>}
 */
export function startDoor(script) {
  const hits = []
  const srv = http.createServer((req, res) => {
    let b = ''
    req.on('data', (d) => { b += d })
    req.on('end', () => {
      let body = {}
      try { body = JSON.parse(b || '{}') } catch { body = { unreadable: b } }
      const path = new URL(req.url, 'http://x').pathname
      hits.push({ path, body })
      const a = script({ path, body }) || { json: { ok: true } }
      if (a.destroy) { req.socket.destroy(); return }
      if (a.never) return
      const send = () => {
        if (a.hang) { res.writeHead(200, { 'content-type': 'application/json' }); res.write('{"ok":true,'); return }
        const text = a.raw != null ? a.raw : JSON.stringify(a.json)
        res.writeHead(a.status || 200, { 'content-type': 'application/json' })
        res.end(text)
      }
      if (a.delayMs) setTimeout(send, a.delayMs).unref()
      else send()
    })
  })
  return new Promise((resolve) => srv.listen(0, '127.0.0.1', () => resolve({
    url: `http://127.0.0.1:${srv.address().port}`, hits,
    close: () => new Promise((r) => { srv.closeAllConnections(); srv.close(() => r()) }),
  })))
}

/**
 * The foreman's door adapter for the small mind, the same contract as `foreman.mjs` `mind()` (2026-10-24), with the
 * timeouts shortened for a test. What the door writes in `text`, `certainty` and `box` reaches the module unchanged.
 * @param {string} url the stub door
 * @param {{smallMs?: number, lastMs?: number}} [o] the hop deadlines (production: 60,000 and 300,000 ms)
 * @returns {function(object): Promise<{text: *, certainty: *, box: *}>}
 */
export function doorMind(url, { smallMs = 2000, lastMs = 2000 } = {}) {
  return async (req) => {
    const r = await fetch(`${url}/api/foreman/mind`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(req.last ? lastMs : smallMs),
      body: JSON.stringify({ model: req.model || 'functiongemma', grammar: req.grammar, system: req.system, prompt: req.prompt,
                             job: req.job, cascade: !!req.cascade, last: !!req.last, shadow: !!req.shadow }),
    })
    if (!r.ok) throw new Error(`the small mind answered ${r.status}`)
    const d = await r.json()
    if (!d.ok) throw new Error(d.why || 'no answer')
    return { text: d.text || '', certainty: d.certainty ?? null, box: d.box || null }
  }
}

/** A scratch dir for this lane under /private/tmp (M9: the real path, never the /tmp link). */
export const U5_TMP = '/private/tmp/lacuna-unit/U5'
