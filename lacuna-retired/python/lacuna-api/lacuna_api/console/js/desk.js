// THE DESKTOP CUT (main.js chooses it for a big screen). The console's shell: tabs (each pane loads the first time it is opened and refreshes while it is in front), the
// clock, and the alert bell (polled every 10 s; a new unacknowledged error lights the bar).
import { api, post, el, mount, toast, time } from './util.js'

const panes = {
  control: () => import('./control.js'), errors: () => import('./errors.js'), logs: () => import('./logs.js'),
  graphs: () => import('./graphs.js'), mentat: () => import('./mentat.js'), terminal: () => import('./terminal.js'), deploys: () => import('./deploys.js'),
  battery: () => import('./battery.js'), runbooks: () => import('./runbooks.js'), audit: () => import('./audit.js'),
}
const loaded = {}
let current = null

async function show(tab) {
  if (!panes[tab]) tab = 'control'
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab))
  requestAnimationFrame(() => document.querySelector('#tabs button.on')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }))   // a tab past the strip's edge comes into view
  document.querySelectorAll('.pane').forEach((p) => p.classList.toggle('on', p.id === `pane-${tab}`))
  if (current && loaded[current]?.leave) loaded[current].leave()
  current = tab
  try { localStorage.setItem('lacuna.tab', tab) } catch { /* */ }
  if (location.hash !== `#${tab}`) history.replaceState(null, '', `#${tab}`)
  const node = document.getElementById(`pane-${tab}`)
  if (!loaded[tab]) {
    mount(node, el('p.quiet', {}, el('span.spin'), ' loading…'))
    loaded[tab] = await panes[tab]()
    await loaded[tab].init(node)
  }
  if (loaded[tab].enter) loaded[tab].enter()
}
document.getElementById('tabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) show(b.dataset.tab) })
window.addEventListener('hashchange', () => show(location.hash.slice(1)))
window.lacunaShow = show

setInterval(() => { document.getElementById('clock').textContent = new Date().toLocaleTimeString() }, 1000)

let seen = new Set()
async function pollAlerts() {
  try {
    const alerts = await api('/api/alerts')
    const open = alerts.filter((a) => !a.acked && a.level !== 'info')
    const bell = document.getElementById('bell')
    bell.classList.toggle('hot', open.some((a) => a.level === 'error'))
    document.getElementById('bellN').textContent = open.length
    for (const a of open) {
      const k = `${a.key}@${a.t}`
      if (!seen.has(k)) { seen.add(k); if (seen.size > 1 || open.length === 1) toast(`${time(a.t)} · ${a.title} — ${a.body}`, a.level === 'error' ? 'error' : 'info') }
    }
  } catch { /* the page keeps going; the server may be restarting */ }
}
document.getElementById('bell').addEventListener('click', async () => { await post('/api/alerts/ack'); pollAlerts(); show('control') })
setInterval(pollAlerts, 10000)
pollAlerts()

// THE WAY BACK (2026-09-28): the phone's More › "Open the full console" pins the desktop cut (`lacuna.cut = desk`, main.js)
// and main.js promised a "Phone view" key to undo it — there was none, so a phone that opened the full console was stuck.
document.getElementById('phoneCut').addEventListener('click', () => { try { localStorage.setItem('lacuna.cut', 'phone') } catch { /* */ } location.reload() })

let start = location.hash.slice(1)
if (!start) { try { start = localStorage.getItem('lacuna.tab') } catch { start = null } }
show(start || 'control')

// THE DOCK — Lacuna beside every tab (js/dock.js); the header key and "/" open it, Esc closes it
import('./dock.js').then((dock) => dock.init().then(() => {
  document.getElementById('askLacuna').addEventListener('click', () => dock.open(!document.body.classList.contains('dk-open')))
  document.addEventListener('keydown', (e) => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '') || document.activeElement?.closest?.('.xterm')
    if (e.key === '/' && !typing) { e.preventDefault(); dock.open(true) }
  })
}))
