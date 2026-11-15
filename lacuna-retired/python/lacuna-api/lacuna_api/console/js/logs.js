// LOGS — the live tail of every stream on the Studio (dev + QA; the APIs, her iPad, the Studio app), over a WebSocket on
// :1138. Filters go to the server; pause holds the view; a click expands a line.
import { el, mount, time } from './util.js'

let root, ws, paused = false, box, count = 0
const f = { env: '', level: '', q: '', back: 600, quiet: true }
const MAX = 4000

function lineEl(r) {
  return el(`div.${r.level === 'error' ? 'error' : r.level === 'warn' ? 'warn' : 'x'}`, {},
    el('span.t', { text: time(r.t) }), ' ', el('span.env', { text: r.env === 'qa' ? 'QA ' : 'dev' }), ' ',
    el('span', { text: (r.source || '').padEnd(6).slice(0, 6) }), ' ', el('span.sub', { text: `${r.subsystem || ''}${r.action ? ' · ' + r.action : ''}` }), '  ', r.summary || '')
}

function connect() {
  if (ws) try { ws.close() } catch { /* */ }
  ws = new WebSocket(`ws://${location.host}/ws/logs`)
  ws.onopen = () => { mount(box); count = 0; ws.send(JSON.stringify(f)) }
  ws.onmessage = (e) => {
    if (paused) return
    const rows = JSON.parse(e.data)
    const atBottom = box.scrollTop + box.clientHeight >= box.scrollHeight - 30
    const frag = document.createDocumentFragment()
    for (const r of rows) frag.appendChild(lineEl(r))
    box.appendChild(frag)
    count += rows.length
    while (box.childElementCount > MAX) box.firstElementChild.remove()
    if (atBottom) box.scrollTop = box.scrollHeight
    root.querySelector('#logCount').textContent = `${count.toLocaleString('en-US')} lines`
  }
  ws.onclose = () => { setTimeout(() => { if (root.closest('.pane').classList.contains('on')) connect() }, 2000) }
}

export async function init(node) {
  root = node
  const sel = (key, opts) => el('select', { onchange: (e) => { f[key] = e.target.value; connect() } }, opts.map(([v, t]) => el('option', { value: v, text: t })))
  box = el('div.loglines')
  mount(root,
    el('div.toolbar', {},
      sel('env', [['', 'dev + QA'], ['dev', 'dev'], ['qa', 'QA (customer)']]),
      sel('level', [['', 'everything'], ['problems', 'warnings + errors'], ['error', 'errors'], ['warn', 'warnings'], ['info', 'info']]),
      el('input', { placeholder: 'filter…', oninput: (e) => { f.q = e.target.value; clearTimeout(init._q); init._q = setTimeout(connect, 300) } }),
      el('label.quiet', { title: 'Hide the routine lines: a 2xx request, a vitals tick, a keep-alive skip. Never hides a warning or an error.' },
        el('input', { type: 'checkbox', checked: true, onchange: (e) => { f.quiet = e.target.checked; connect() } }), ' hide routine'),
      el('button', { onclick: (e) => { paused = !paused; e.target.textContent = paused ? 'Resume' : 'Pause' } }, 'Pause'),
      el('button', { onclick: () => { mount(box); count = 0 } }, 'Clear'),
      el('span#logCount.quiet')),
    box)
}
export function enter() { connect() }
export function leave() { if (ws) try { ws.close() } catch { /* */ } }
