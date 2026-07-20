// src/ide-server.js — Motoi Scheme IDE HTTP host.
//
// Provenance: 2026-07-19 (Marcus, infra lane). Backs the `motoi ide`
// CLI command. Serves a 3-panel VS Code-style browser IDE (file tree ·
// tabbed editor · REPL/output) that talks to Motoi over HTTP.
//
// Why a dedicated server rather than re-using http/serve:
//   * http/serve is cart-oriented (`/play/:cart` · `/compose/:cart`) with
//     a permission gate and a landing page — a different surface. The
//     IDE needs POST /api/eval (evaluation) and structured GETs for the
//     book — those don't belong under the cart namespace.
//   * A separate server keeps the two paths independent: if a kid is
//     hosting a cart on 3333 for friends and using the IDE on 3737,
//     they don't fight over ports or permissions.
//
// Endpoints:
//   GET  /              → the IDE HTML (single file).
//   GET  /ide.css       → the IDE stylesheet.
//   GET  /ide.js        → the IDE Vue/vanilla script.
//   GET  /api/books     → JSON list of every book slug.
//   GET  /api/toc?book=code → JSON list of chapter records for a book.
//   GET  /api/chapter?book=code&n=1 → JSON of chapter prose + code-blocks.
//   POST /api/eval      → { source: "..." } → { value: "...", error: null }.
//   GET  /api/session   → JSON of the current session's env verbs (for
//                          the completions panel).
//
// Security:
//   * Localhost-only bind by default (127.0.0.1). Caller passes
//     :host "0.0.0.0" to open to LAN — same posture as http/serve.
//   * The eval endpoint runs against a per-server env with the full
//     CORE roster including cpu/*. Fuel-capped per request so a runaway
//     (loop forever) can't hang the server. The env persists across
//     requests so (define x 5) then (+ x 1) works.
//   * No file writes. The IDE can READ books + eval Scheme; saving files
//     is a follow-up wave. Kids don't lose work — nothing gets written.

import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parse } from './reader.js'
import { evaluate } from './interp.js'
import { makeCoreEnv } from '../core/index.js'
import { expandProgram } from './macro.js'
import { snapshotRegistry } from './verbRegistry.js'
import { getMediaState } from '../lib/media/media.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const IDE_DIR = join(__dirname, '..', 'site', 'ide-assets')

// ── formatting (mirror of REPL) ───────────────────────────────────────

function format(v) {
  if (v === undefined) return ''
  if (v === null) return '()'
  if (v === true) return '#t'
  if (v === false) return '#f'
  if (typeof v === 'string') return JSON.stringify(v)
  if (v && typeof v === 'object' && 'name' in v && typeof v.name === 'string') {
    // Sym
    return v.name
  }
  if (Array.isArray(v)) return '(' + v.map(format).join(' ') + ')'
  return String(v)
}

// ── the session env ──────────────────────────────────────────────────
//
// One env per server. Fresh CPU state, fresh Cortex, fresh everything.
// If a caller wants a clean slate they can hit POST /api/reset (not
// wired yet — follow-up).

function makeSession(fuel = 200000) {
  const env = makeCoreEnv({ fuel: { n: fuel * 5 } })  // installer needs headroom
  const out = { stdout: '' }
  // Route (display …) and (newline) into the session's captured stdout
  // so eval output shows up in the REPL panel instead of the server's
  // terminal.
  //
  // We install these ON TOP of base — env.define is legal for new-name
  // rebinds on pre-freeze envs. base.js binds display/newline to
  // process.stdout.write; we replace them with our capture.
  try {
    env.define('display', (v) => { out.stdout += _displayFormat(v); return undefined }, { perm: 'read' })
    env.define('newline', () => { out.stdout += '\n'; return undefined }, { perm: 'read' })
  } catch { /* frozen — swallow */ }
  return { env, out, fuel }
}

// Mirror the display formatter from src/base.js (private there).
function _displayFormat(v) {
  if (v === undefined) return ''
  if (v === null) return '()'
  if (v === true) return '#t'
  if (v === false) return '#f'
  if (typeof v === 'string') return v   // display prints strings UNQUOTED
  if (v && typeof v === 'object' && 'name' in v && typeof v.name === 'string') return v.name
  if (Array.isArray(v)) return '(' + v.map(_displayFormat).join(' ') + ')'
  return String(v)
}

// ── static asset loading ──────────────────────────────────────────────

function readAsset(name) {
  const p = join(IDE_DIR, name)
  try { return readFileSync(p, 'utf8') } catch { return null }
}

// Content-Type map for the asset router.
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
}

function extOf(path) {
  const i = path.lastIndexOf('.')
  return i < 0 ? '' : path.slice(i)
}

// ── JSON request body ─────────────────────────────────────────────────

function readJsonBody(req, maxBytes = 65536) {
  return new Promise((resolve, reject) => {
    let data = ''
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > maxBytes) {
        reject(new Error('body too large'))
        req.destroy()
        return
      }
      data += chunk.toString('utf8')
    })
    req.on('end', () => {
      if (!data) return resolve({})
      try { resolve(JSON.parse(data)) } catch (e) { reject(e) }
    })
    req.on('error', reject)
  })
}

// ── book helpers (mirror lib/book/reader for API responses) ───────────

function bookApi(env, action, params) {
  // We call the book/* verbs directly on the env so the API + REPL see
  // the same data. That's the whole point of building on top of book/*.
  const fuelBox = { n: 500000 }
  try {
    if (action === 'list') {
      const fn = env.get('book/list')
      return { ok: true, value: fn() }
    }
    if (action === 'toc') {
      const fn = env.get('book/toc')
      const slug = params.book || 'code'
      return { ok: true, value: fn(_sym(':book'), _sym(slug)) }
    }
    if (action === 'chapter') {
      const slug = params.book || 'code'
      const n = Number(params.n)
      // If the caller is asking about Book of Code specifically, use the
      // tutor's structured chapter verb — the IDE renders sections/blocks.
      if (slug === 'code' && typeof env.get('book-of-code/chapter') === 'function') {
        const fn = env.get('book-of-code/chapter')
        const rec = fn(n)
        return { ok: true, value: alistToObject(rec) }
      }
      // Fallback: generic book/read prose.
      const fn = env.get('book/read')
      const prose = fn(_sym(':book'), _sym(slug), _sym(':chapter'), n)
      return { ok: true, value: { prose } }
    }
  } catch (e) {
    return { ok: false, error: e.message }
  }
  return { ok: false, error: 'unknown book action: ' + action }
}

function _sym(name) {
  // Minimal reader-Sym stand-in; the interp's Env resolves by name only
  // so a plain object with .name suffices for keyword args.
  //
  // We can't import Sym without circular headaches from cli.js — use
  // parse('name') to get the real class instance instead.
  const forms = parse(name)
  return forms[0]
}

// Alist ((:key val) (:key val)) → JS object { key: val }. Recursive.
function alistToObject(v) {
  if (Array.isArray(v) && v.length > 0
      && Array.isArray(v[0]) && v[0].length === 2
      && v[0][0] && typeof v[0][0] === 'object' && 'name' in v[0][0]
      && String(v[0][0].name).startsWith(':')) {
    const obj = {}
    for (const pair of v) {
      const k = String(pair[0].name).slice(1)
      obj[k] = alistToObject(pair[1])
    }
    return obj
  }
  if (Array.isArray(v)) return v.map(alistToObject)
  if (v && typeof v === 'object' && 'name' in v && typeof v.name === 'string') return v.name
  return v
}

// ── eval endpoint ─────────────────────────────────────────────────────

function evalSource(session, source) {
  const { env, out } = session
  out.stdout = ''
  // Hijack process.stdout.write during eval — verbs like `fb/dump` write
  // ANSI colored blocks directly to process.stdout, bypassing (display).
  // Route those bytes into the session's captured stream so the IDE's
  // REPL panel can render them (ansi-to-DOM in ide.js's log()).
  const realWrite = process.stdout.write.bind(process.stdout)
  process.stdout.write = (chunk) => {
    try { out.stdout += typeof chunk === 'string' ? chunk : chunk.toString('utf8') }
    catch { /* soft-fail — bare buffer */ }
    return true
  }
  try {
    const forms = parse(source)
    const { forms: expanded } = expandProgram(forms, { fuel: { n: session.fuel } })
    const fuel = { n: session.fuel }
    let result
    for (const f of expanded) result = evaluate(f, env, fuel)
    return {
      ok: true,
      value: result === undefined ? '' : format(result),
      stdout: out.stdout,
    }
  } catch (e) {
    return { ok: false, error: e.message, stdout: out.stdout }
  } finally {
    process.stdout.write = realWrite
  }
}

// ── session verbs ─────────────────────────────────────────────────────

function verbsList() {
  // The whole registered set, sorted, tagged with namespace when present.
  const snap = snapshotRegistry()
  const out = []
  for (const name of Object.keys(snap).sort()) {
    const meta = snap[name] || {}
    out.push({
      name,
      namespace: meta.namespace || null,
      doc: meta.doc || null,
    })
  }
  return out
}

// ── the server ────────────────────────────────────────────────────────

/**
 * startIdeServer({ port, host, fuel, silent }) → { server, url, session }.
 * A promise that resolves when the server is listening.
 */
export function startIdeServer({ port = 3737, host = '127.0.0.1', fuel = 200000, silent = false } = {}) {
  const session = makeSession(fuel)

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
    const path = url.pathname

    const send = (status, body, type = 'text/plain; charset=utf-8') => {
      res.writeHead(status, { 'Content-Type': type })
      res.end(body)
    }
    const sendJson = (status, obj) => send(status, JSON.stringify(obj), MIME['.json'])

    try {
      // ── static assets ─────────────────────────────────────────────
      if (req.method === 'GET' && (path === '/' || path === '/index.html')) {
        const html = readAsset('index.html')
        if (!html) return send(500, 'IDE assets missing at ' + IDE_DIR)
        return send(200, html, MIME['.html'])
      }
      if (req.method === 'GET' && path === '/ide.css') {
        const css = readAsset('ide.css')
        if (!css) return send(404, 'not found')
        return send(200, css, MIME['.css'])
      }
      if (req.method === 'GET' && path === '/ide.js') {
        const js = readAsset('ide.js')
        if (!js) return send(404, 'not found')
        return send(200, js, MIME['.js'])
      }

      // ── API: books ────────────────────────────────────────────────
      if (req.method === 'GET' && path === '/api/books') {
        return sendJson(200, bookApi(session.env, 'list', {}))
      }
      if (req.method === 'GET' && path === '/api/toc') {
        const book = url.searchParams.get('book') || 'code'
        return sendJson(200, bookApi(session.env, 'toc', { book }))
      }
      if (req.method === 'GET' && path === '/api/chapter') {
        const book = url.searchParams.get('book') || 'code'
        const n = url.searchParams.get('n') || '1'
        return sendJson(200, bookApi(session.env, 'chapter', { book, n }))
      }

      // ── API: eval ────────────────────────────────────────────────
      if (req.method === 'POST' && path === '/api/eval') {
        let body
        try { body = await readJsonBody(req) }
        catch (e) { return sendJson(400, { ok: false, error: 'bad body: ' + e.message }) }
        const source = String(body.source || '')
        if (!source.trim()) return sendJson(400, { ok: false, error: 'empty source' })
        const result = evalSource(session, source)
        return sendJson(200, result)
      }

      // ── API: verbs (autocomplete data) ───────────────────────────
      if (req.method === 'GET' && path === '/api/verbs') {
        return sendJson(200, { ok: true, value: verbsList() })
      }

      // ── API: help (structured metadata for one verb) ─────────────
      // Backs the REPL's `,help <verb>` meta-command. Returns the
      // introspect blob (doc / contract / arity / examples / etc.) so
      // the client can render a colored, formatted help card.
      if (req.method === 'GET' && path === '/api/help') {
        const verb = (url.searchParams.get('verb') || '').trim()
        if (!verb) return sendJson(400, { ok: false, error: 'missing verb' })
        try {
          const { help } = await import('./introspect.js')
          const meta = help(verb)
          if (!meta) return sendJson(200, { ok: false, error: `unknown verb: ${verb}` })
          return sendJson(200, { ok: true, meta })
        } catch (e) {
          return sendJson(200, { ok: false, error: e.message })
        }
      }

      // ── API: canvas (fantasy-console framebuffer) ────────────────
      //
      // Marcus 2026-07-19. Returns the current framebuffer as
      // palette-indexed bytes + palette. The client polls at ~30 fps
      // via rAF and blits into an HTML canvas.
      //
      // Wire shape (JSON, base64 to keep the array compact-ish):
      //   { ok, w, h, palette: [[r,g,b,a], …], pixels: "<base64>" }
      // The palette is intentionally the raw RGBA quad — cheap for the
      // client to translate into ImageData.
      if (req.method === 'GET' && path === '/api/canvas') {
        try {
          const fb = getMediaState().fb
          const pixelsB64 = Buffer.from(fb.pixels.buffer, fb.pixels.byteOffset, fb.pixels.byteLength).toString('base64')
          return sendJson(200, {
            ok: true,
            w: fb.w,
            h: fb.h,
            palette: fb.palette.map(c => c.slice()),
            pixels: pixelsB64,
            color: fb.color,
          })
        } catch (e) {
          return sendJson(200, { ok: false, error: e.message })
        }
      }

      // ── API: stack (call-stack visualization panel) ──────────────
      //
      // Marcus 2026-07-19. Returns the frame ledger populated by
      // lib/system/stack.js. Client polls at ~10 fps when Stack panel
      // is open. `which=live` returns whatever's on the ledger right
      // now; `which=peak` returns the deepest set seen since the last
      // reset. When live is empty we fall back to peak so the idle
      // view still shows something useful.
      //
      //   GET /api/stack?which=live  (default)
      //   GET /api/stack?which=peak
      if (req.method === 'GET' && path === '/api/stack') {
        try {
          const which = url.searchParams.get('which') === 'peak' ? 'peak' : 'live'
          const verb = which === 'peak' ? 'motoi/stack-peak' : 'motoi/stack'
          const fn = session.env.get(verb)
          const depthFn = session.env.get('motoi/stack-depth')
          const framesAlist = fn()
          const depth = depthFn()
          const frames = (Array.isArray(framesAlist) ? framesAlist : []).map(alistToObject)
          return sendJson(200, {
            ok: true,
            which,
            depth,
            frames,
            idle: which === 'live' && frames.length === 0,
          })
        } catch (e) {
          return sendJson(200, { ok: false, error: e.message })
        }
      }

      // ── API: CPU state (for the CPU visualization panel) ─────────
      if (req.method === 'GET' && path === '/api/cpu') {
        try {
          const fn = session.env.get('cpu/state')
          const disp = session.env.get('cpu/display')
          const stateAlist = fn(64)   // dump first 64 bytes to display
          return sendJson(200, {
            ok: true,
            state: alistToObject(stateAlist),
            display: disp(),
          })
        } catch (e) {
          return sendJson(200, { ok: false, error: e.message })
        }
      }

      // ── API: pair-programming — mode + explain + ambient-complete
      //    (Wave 2 additions, 2026-07-19)
      if (req.method === 'GET' && path === '/api/pair/state') {
        try {
          const st = session.env.get('motoi/pair-state')
          return sendJson(200, { ok: true, state: alistToObject(st()) })
        } catch (e) { return sendJson(200, { ok: false, error: e.message }) }
      }
      if (req.method === 'POST' && path === '/api/pair/mode') {
        try {
          const body = await readJsonBody(req)
          const mode = String(body.mode || 'off')
          const src = mode === 'off'
            ? '(motoi/pair-off!)'
            : `(motoi/pair-set-mode! (quote ${mode}))`
          const r = evalSource(session, src)
          return sendJson(200, r)
        } catch (e) { return sendJson(500, { ok: false, error: e.message }) }
      }
      if (req.method === 'POST' && path === '/api/pair/explain') {
        try {
          const body = await readJsonBody(req)
          const source = String(body.source || '').replace(/"/g, '\\"')
          const context = String(body.context || '').replace(/"/g, '\\"')
          const src = `(motoi/explain-selection "${source}")`
          const r = evalSource(session, src)
          return sendJson(200, r)
        } catch (e) { return sendJson(500, { ok: false, error: e.message }) }
      }
      if (req.method === 'POST' && path === '/api/pair/complete') {
        try {
          const body = await readJsonBody(req)
          const prefix = String(body.prefix || '').replace(/"/g, '\\"')
          const src = `(motoi/ambient-complete "${prefix}")`
          const r = evalSource(session, src)
          return sendJson(200, r)
        } catch (e) { return sendJson(500, { ok: false, error: e.message }) }
      }
      if (req.method === 'POST' && path === '/api/pair/refactor') {
        try {
          const body = await readJsonBody(req)
          const source = String(body.source || '').replace(/"/g, '\\"')
          const src = `(motoi/refactor-suggest "${source}")`
          const r = evalSource(session, src)
          return sendJson(200, r)
        } catch (e) { return sendJson(500, { ok: false, error: e.message }) }
      }
      if (req.method === 'POST' && path === '/api/pair/bug-spot') {
        try {
          const body = await readJsonBody(req)
          const source = String(body.source || '').replace(/"/g, '\\"')
          const src = `(motoi/bug-spot "${source}")`
          const r = evalSource(session, src)
          return sendJson(200, r)
        } catch (e) { return sendJson(500, { ok: false, error: e.message }) }
      }

      // ── API: reading state — global snapshot + per-chapter progress
      if (req.method === 'GET' && path === '/api/reading-state') {
        try {
          const fn = session.env.get('motoi/reading-state')
          return sendJson(200, { ok: true, state: alistToObject(fn()) })
        } catch (e) { return sendJson(200, { ok: false, error: e.message }) }
      }
      if (req.method === 'GET' && path === '/api/reading-progress') {
        const book = url.searchParams.get('book') || 'code'
        const chapter = Number(url.searchParams.get('n') || 1)
        const total = url.searchParams.get('total')
        try {
          const fn = session.env.get('motoi/reading-progress')
          const rec = total ? fn(book, chapter, Number(total)) : fn(book, chapter)
          return sendJson(200, { ok: true, progress: alistToObject(rec) })
        } catch (e) { return sendJson(200, { ok: false, error: e.message }) }
      }
      if (req.method === 'POST' && path === '/api/bookmark') {
        try {
          const body = await readJsonBody(req)
          const name = String(body.name || '').replace(/"/g, '\\"')
          const context = String(body.context || '').replace(/"/g, '\\"')
          const src = `(motoi/bookmark! (quote ${name}) "${context}")`
          const r = evalSource(session, src)
          return sendJson(200, r)
        } catch (e) { return sendJson(500, { ok: false, error: e.message }) }
      }
      if (req.method === 'POST' && path === '/api/highlight') {
        try {
          const body = await readJsonBody(req)
          const text = String(body.text || '').replace(/"/g, '\\"')
          const context = String(body.context || '').replace(/"/g, '\\"')
          const src = `(motoi/highlight! "${text}" "${context}")`
          const r = evalSource(session, src)
          return sendJson(200, r)
        } catch (e) { return sendJson(500, { ok: false, error: e.message }) }
      }

      send(404, 'not found')
    } catch (e) {
      send(500, 'server error: ' + e.message)
    }
  })

  // Bound-timeouts (Priya doctrine from http-serve).
  server.headersTimeout   = 30_000
  server.requestTimeout   = 60_000
  server.keepAliveTimeout = 5_000

  return new Promise((resolve, reject) => {
    server.on('error', reject)
    server.listen(port, host, () => {
      // When port=0 is passed, node picks one — read it back.
      const bound = server.address()
      const boundPort = bound && typeof bound === 'object' ? bound.port : port
      const url = `http://${host === '0.0.0.0' ? 'localhost' : host}:${boundPort}/`
      if (!silent) {
        process.stdout.write(`Motoi IDE listening on ${url}\n`)
        process.stdout.write('  · file tree · tabbed editor · REPL panel\n')
        process.stdout.write('  · Ctrl+C to stop\n')
      }
      resolve({ server, url, session, port: boundPort })
    })
  })
}

export default startIdeServer
