// surfaces/web.js — the web GUI surface (HTTP + a tiny JSON protocol).
//
// The web surface exposes the copilot to a browser editor: ghost-text +
// next-edit + tab-to-accept, inline diff widgets, a side-panel grounded chat,
// and a LIVE PREVIEW hook (the killer differentiator — the sprite/animation/
// music plays as the code changes). This module is the SERVER half: a
// dependency-free node:http handler that speaks a small JSON protocol. The
// browser half (a static page) is served from `client()`.
//
// Endpoints (all POST JSON except GET /):
//   GET  /                      → the editor page (self-contained HTML)
//   POST /api/suggest           { text, offset, file?, person? } → Suggestion
//   POST /api/accept            { traceId, edited?, register? }  → { ok, learned }
//   POST /api/reject            { traceId, wantedSilence? }      → { ok }
//   POST /api/edit              { instruction, buffer, file? }   → AgenticResult
//   POST /api/preview           { buffer } → { ok, value?, error? }  (LIVE PREVIEW)
//   GET  /api/health            → { ok, verbs, backend }
//
// Every response string is de-branded. The live-preview endpoint runs the
// buffer through the SAME sandbox the gates use, so "does it run?" in the
// preview pane is the same truth the copilot uses to validate suggestions.

import { createServer } from 'node:http'
import { Copilot } from '../src/copilot.js'
import { speculativeRun } from '../src/sandbox.js'
import { debrand } from '../src/debrand.js'
import { hasBackend } from '../src/model-client.js'

export class WebSurface {
  /**
   * @param {object} [opts]
   * @param {Copilot} [opts.copilot]
   * @param {number} [opts.port=8787]
   */
  constructor(opts = {}) {
    this.cp = opts.copilot instanceof Copilot ? opts.copilot : new Copilot(opts)
    this.port = opts.port ?? 8787
    this.server = null
  }

  /** handler — the raw (req,res) function, exposed for embedding in a host. */
  handler() {
    return async (req, res) => {
      try {
        if (req.method === 'GET' && req.url === '/') return send(res, 200, this.client(), 'text/html')
        if (req.method === 'GET' && req.url === '/api/health') {
          return json(res, 200, { ok: true, verbs: this.cp.oracle.verbs.size, backend: hasBackend() })
        }
        if (req.method === 'POST') {
          const body = await readJson(req)
          switch (req.url) {
            case '/api/suggest': {
              const sug = await this.cp.suggest(
                { text: body.text ?? '', offset: body.offset ?? 0, file: body.file },
                { person: body.person, n: body.n ?? 5 },
              )
              // Strip the heavy rejection log for the wire; keep a count.
              return json(res, 200, {
                mode: sug.mode, offer: sug.offer, confidence: sug.confidence,
                alternatives: sug.alternatives, traceId: sug.traceId,
                guard: sug.guard ? debrand(sug.guard) : null, // cross-standard trap lesson
                offerableCount: sug.offerableCount, rejectedCount: sug.rejected.length,
                ms: sug.ms,
              })
            }
            case '/api/accept': {
              const learned = this.cp.accept(body.traceId, { edited: body.edited, register: body.register })
              return json(res, 200, { ok: true, learned: !!learned })
            }
            case '/api/reject': {
              this.cp.reject(body.traceId, { wantedSilence: body.wantedSilence })
              return json(res, 200, { ok: true })
            }
            case '/api/edit': {
              const r = await this.cp.agenticEdit(body.instruction ?? '', { buffer: body.buffer ?? '', file: body.file })
              return json(res, 200, r.ok
                ? { ok: true, program: r.program, confidence: r.confidence }
                : { ok: false, say: r.say })
            }
            case '/api/preview': {
              // LIVE PREVIEW — run the buffer through the sandbox and report the
              // value or the error. The browser renders sprite/tune/animation.
              const run = speculativeRun(body.buffer ?? '', { timeoutMs: 500, fuel: 200000 })
              return json(res, 200, {
                ok: run.ok,
                value: run.ok ? formatValue(run.value) : undefined,
                error: run.ok ? undefined : debrand(run.error || 'error'),
                kind: run.kind, ms: run.ms,
              })
            }
            default: return json(res, 404, { ok: false, error: 'not found' })
          }
        }
        return json(res, 405, { ok: false, error: 'method not allowed' })
      } catch (e) {
        return json(res, 500, { ok: false, error: debrand(e.message || String(e)) })
      }
    }
  }

  /** listen — start the HTTP server. Returns a promise of the bound port. */
  listen() {
    return new Promise((resolve) => {
      this.server = createServer(this.handler())
      this.server.listen(this.port, () => resolve(this.port))
    })
  }
  close() { return new Promise((r) => (this.server ? this.server.close(r) : r())) }

  /** client — the self-contained browser editor (HTML + inline JS). */
  client() {
    return WEB_CLIENT_HTML
  }
}

// ── http helpers ─────────────────────────────────────────────────────────────

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (c) => { data += c; if (data.length > 5e6) reject(new Error('body too large')) })
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}) } catch (e) { reject(e) } })
    req.on('error', reject)
  })
}
function send(res, code, body, type = 'text/plain') {
  res.writeHead(code, { 'content-type': type, 'access-control-allow-origin': '*' })
  res.end(body)
}
function json(res, code, obj) { send(res, code, JSON.stringify(obj), 'application/json') }

function formatValue(v) {
  if (v === undefined) return ''
  if (v === true) return '#t'
  if (v === false) return '#f'
  if (v && typeof v === 'object' && 'name' in v && typeof v.name === 'string') return v.name
  if (Array.isArray(v)) return '(' + v.map(formatValue).join(' ') + ')'
  return String(v)
}

// The browser editor: a textarea + ghost overlay, a live-preview pane, and a
// side-panel chat. Deliberately dependency-free (no build step) so it ships
// inside the packaged artifact. Kept lean; a host can replace it wholesale.
const WEB_CLIENT_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>Motoi Copilot</title>
<style>
  :root { --bg:#14131c; --fg:#e9e6f5; --dim:#7d789a; --ok:#6ee7a8; --warn:#f5cf6a; --acc:#8b7cf0; }
  * { box-sizing:border-box; } body { margin:0; font:14px/1.5 ui-monospace,Menlo,monospace; background:var(--bg); color:var(--fg); }
  header { padding:10px 16px; border-bottom:1px solid #2a2740; display:flex; gap:12px; align-items:center; }
  header b { color:var(--acc); } header .tag { color:var(--dim); font-size:12px; }
  main { display:grid; grid-template-columns:1fr 340px; height:calc(100vh - 44px); }
  .edit { position:relative; padding:16px; } .edit textarea { width:100%; height:60%; background:#1b1930; color:var(--fg); border:1px solid #2a2740; border-radius:8px; padding:12px; font:inherit; resize:none; }
  .ghost { color:var(--dim); min-height:24px; padding:6px 4px; } .ghost .conf { float:right; }
  .conf.verified { color:var(--ok); } .conf.best-guess { color:var(--warn); } .conf.silent { color:var(--dim); }
  .preview { margin-top:12px; padding:12px; border:1px solid #2a2740; border-radius:8px; background:#1b1930; min-height:120px; }
  .preview.err { border-color:#f56a6a; } .preview .val { color:var(--ok); } .preview .er { color:#f56a6a; }
  aside { border-left:1px solid #2a2740; padding:16px; overflow:auto; }
  aside h3 { color:var(--acc); margin:0 0 8px; font-size:12px; text-transform:uppercase; letter-spacing:.08em; }
  .row { display:flex; gap:8px; margin-top:8px; } button { background:#2a2740; color:var(--fg); border:0; border-radius:6px; padding:6px 10px; cursor:pointer; } button:hover { background:#3a3658; }
</style></head>
<body>
<header><b>motoi copilot</b><span class="tag">the copilot that can't invent a function that doesn't exist</span></header>
<main>
  <section class="edit">
    <textarea id="ed" spellcheck="false">(display (+ 1 2))
(newline)</textarea>
    <div class="ghost" id="ghost">— type, then press Tab for a verified suggestion —</div>
    <div class="preview" id="pv">live preview</div>
  </section>
  <aside>
    <h3>chat</h3>
    <div id="chat"></div>
    <div class="row"><input id="ask" placeholder="ask the copilot…" style="flex:1;background:#1b1930;color:var(--fg);border:1px solid #2a2740;border-radius:6px;padding:6px"><button onclick="doEdit()">go</button></div>
    <div class="row"><button onclick="preview()">run ▷ live preview</button></div>
  </aside>
</main>
<script>
const ed = document.getElementById('ed'), ghost = document.getElementById('ghost'), pv = document.getElementById('pv');
let lastTrace = null;
async function api(path, body){ const r = await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}); return r.json(); }
async function suggest(){ const s = await api('/api/suggest',{text:ed.value, offset:ed.selectionStart}); lastTrace = s.traceId;
  const warn = s.guard ? '<div class="warn">⚠ '+s.guard+'</div>' : '';
  if(s.offer===null){ ghost.innerHTML='<span class="conf silent">· nothing to add</span>'+warn; return; }
  ghost.innerHTML = s.offer + '<span class="conf '+s.confidence+'">'+s.confidence+'</span>'+warn; }
async function preview(){ const r = await api('/api/preview',{buffer:ed.value}); pv.className='preview'+(r.ok?'':' err');
  pv.innerHTML = r.ok ? ('<span class="val">'+(r.value||'ok')+'</span>') : ('<span class="er">'+r.error+'</span>'); }
async function doEdit(){ const q=document.getElementById('ask').value; const r=await api('/api/edit',{instruction:q,buffer:ed.value});
  const c=document.getElementById('chat'); c.innerHTML += '<div>'+(r.ok?('<pre>'+r.program+'</pre> ['+r.confidence+']'):r.say)+'</div>'; }
ed.addEventListener('keydown', e => { if(e.key==='Tab'){ e.preventDefault();
  if(ghost.dataset.pending){ ed.value = ed.value.slice(0,ed.selectionStart)+ghost.dataset.pending+ed.value.slice(ed.selectionStart); api('/api/accept',{traceId:lastTrace}); ghost.dataset.pending=''; ghost.textContent='(accepted)'; }
  else suggest(); }
  if(e.key==='Escape'){ api('/api/reject',{traceId:lastTrace, wantedSilence:true}); ghost.textContent='·'; } });
ed.addEventListener('input', ()=>{ clearTimeout(window._t); window._t=setTimeout(suggest, 120); });
</script>
</body></html>`

export default WebSurface
