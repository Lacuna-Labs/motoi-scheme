// CONTROL — the services (start · stop · restart · supervise, and WHY when a start fails), petitions waiting for
// Alfred's yes, alerts, disk + what eats it, memory, both APIs and their watchdogs, and the running jobs.
import { decide as ownerDecide } from './owner.js'
import { api, post, el, mount, ago, gb, n, kv, confirmAct, toast } from './util.js'

let root, timer
// ★ A POLL THAT CHANGES NOTHING DRAWS NOTHING (his, 2026-09-26: "it's blinking — maybe a refresh"). Every 5 s the page
// was rebuilt from scratch, spinner and all, so the whole console blinked on the Studio's screen. Now each answer is
// reduced to what would change the picture; the same picture stays, and only the live numbers (the watcher's beat,
// the passes, the "ago" cells) are written in place.
let lastKey = null, lastApis = null
const picture = (o) => JSON.stringify({
  s: o.services.map((s) => [s.name, s.up, s.healthy, s.pid, s.supervised]), d: o.drift, p: (o.petitions || []).map((p) => [p.id, p.state]),
  a: (o.alerts || []).map((a) => [a.key, a.t, a.acked]), j: (o.jobs || []).map((j) => [j.id, j.running, j.code]),
  disk: o.disk.free_gb, mem: Math.round(o.memory.available_gb * 2) / 2, e: o.errors,
})

async function act(svc, action) {
  const hers = svc.hers
  if (hers && !(await confirmAct(`${action} ${svc.title}?`, `${svc.title} is the customer's server — the iPad talks to it. This ${action}s it now.`))) return
  if (action === 'stop' && !hers && !(await confirmAct(`Stop ${svc.title}?`, `Nothing will answer on :${svc.port} until it is started again.`))) return
  toast(`${action} ${svc.title}…`)
  try {
    const r = await post(`/api/services/${svc.name}/${action}`, { confirm: hers })
    if (r.ok === false || (action !== 'stop' && !r.up)) {
      toast(`${svc.title} did not come up — ${r.explain?.cause || r.why || 'see its log'}`, 'error')
      showLog(svc.name, r.explain)
    } else toast(`${svc.title}: ${action} done`, 'ok')
  } catch (e) { toast(`${svc.title}: ${e.message}`, 'error') }
  refresh()
}

async function showLog(name, explained) {
  const x = explained || (await api(`/api/services/${name}/explain`))
  const box = root.querySelector('#svcExplain')
  mount(box, el('div.card', {}, el('h3', {}, `Why ${name}: `, el('span', { text: x.cause })), el('pre.log', { text: x.log || '(no log yet)' })))
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

function serviceCard(s, me) {
  const state = s.up ? (s.healthy === false ? 'warn' : 'ok') : 'err'
  return el('div.card', {},
    el('h3', {}, el(`span.dot.${state}`), s.title, s.hers ? el('span.tag.customer', { text: 'customer' }) : null, s.supervised ? el('span.tag', { text: 'launchd' }) : el('span.tag', { text: 'hand-started' })),
    el('div.about', { text: s.about }),
    kv('port', `:${s.port}`, 'state', s.up ? (s.healthy === false ? 'up, not healthy' : 'up, healthy') : 'DOWN', 'pid', s.pid ?? '—'),
    s.name === 'lacuna' ? el('div', {},
      el('div#watcherLine', {}, me ? kv('watcher', me.ok ? `alive — beat ${me.heartbeat_age_s}s ago` : (me.heartbeat_age_s == null ? 'NOT STARTED' : `STALLED — last beat ${me.heartbeat_age_s}s ago`),
        'passes', n(me.passes), 'error db', `${me.db_mb} MB`) : null),
      el('div#bootLine.quiet', { style: { marginTop: '6px' } }),
      el('div.row', { style: { marginTop: '10px' } },
        el('button', { title: 'the minute\'s pass, now — kick the watchdogs', onclick: async () => { toast('running the checks…'); const r = await post('/api/checks/run', {}); toast(r.raised?.length ? `raised: ${r.raised.map((a) => a.title).join(', ')}` : `checks ran — ${r.alerts} open alert(s), ${r.drift.length} drift row(s)`, 'ok'); refresh() } }, 'Run the checks now'),
        el('button', { onclick: () => window.lacunaShow('deploys') }, 'Release…'))) : el('div.row', { style: { marginTop: '10px' } },
      s.up ? null : el('button.go', { onclick: () => act(s, 'start') }, 'Start'),
      s.up ? el('button', { onclick: () => act(s, 'restart') }, 'Restart') : null,
      s.up ? el('button', { onclick: () => act(s, 'stop') }, 'Stop') : null,
      el('button', { onclick: () => showLog(s.name) }, s.up ? 'Log' : 'Why?'),
      !s.supervised && s.can_supervise ? el('button', { title: 'Put it under launchd: it comes back after a crash or a reboot', onclick: () => act(s, 'supervise') }, 'Supervise') : null))
}

async function decide(p, approve) {
  if (approve && !(await confirmAct(`Approve: ${p.action}?`, `If approved: ${p.effect || p.action}\nAsked: ${p.reason || ''}\nFiled by ${p.by}.`))) return
  const r = await ownerDecide(p.id, approve)
  toast(r.ok ? (approve ? `approved — ${p.action} running` : 'declined') : (r.why || 'refused'), r.ok ? (approve ? 'ok' : 'info') : 'error')
  refresh()
  return r
}

async function refresh() {
  let o
  try { o = await api('/api/overview') } catch (e) { mount(root, el('p', { text: `The control plane did not answer: ${e.message}` })); lastKey = null; return }
  const disk = o.disk; const mem = o.memory
  const [eaters, me] = await Promise.all([api('/api/disk/eaters').catch(() => ({ sizes: {} })), api('/api/self').catch(() => null)])
  const eat = Object.entries(eaters.sizes || {}).sort((a, b) => b[1] - a[1]).slice(0, 8)
  const key = picture(o) + JSON.stringify(eat)
  if (key === lastKey && root.querySelector('#watcherLine')) {
    // the same picture: only the live numbers move
    const w = root.querySelector('#watcherLine')
    if (w && me) w.replaceChildren(kv('watcher', me.ok ? `alive — beat ${me.heartbeat_age_s}s ago` : (me.heartbeat_age_s == null ? 'NOT STARTED' : `STALLED — last beat ${me.heartbeat_age_s}s ago`), 'passes', n(me.passes), 'error db', `${me.db_mb} MB`))
    for (const td of root.querySelectorAll('[data-ago]')) td.textContent = ago(Number(td.dataset.ago))
    return
  }
  lastKey = key
  mount(root,
    o.petitions.length ? el('div', {}, el('h2', { text: 'Waiting for your yes' }), el('div.grid', {}, o.petitions.map((p) => el('div.card', {},
      el('h3', {}, el('span.dot.warn'), p.action, p.build ? el('span.tag', { text: p.build }) : null),
      p.effect ? el('div', {}, el('b', { text: 'If approved: ' }), p.effect) : null,
      el('div.about', { text: `asked: ${p.reason} — filed by ${p.by}, ${ago(p.t)}` }),
      el('div.row', {}, el('button.danger', { onclick: () => decide(p, true) }, 'Approve'), el('button', { onclick: () => decide(p, false) }, 'Decline')))))) : null,
    o.drift && o.drift.length ? el('div', {}, el('h2', { text: 'Drift — what Lacuna expects vs what is running' }),
      el('div.card', {}, o.drift.map((d) => el('div.row', { style: { marginBottom: '6px' } }, el('span.dot.warn'), el('span.tag', { text: d.kind }), el('b', { text: d.service }), el('span', { text: d.detail }))))) : null,
    el('h2', { text: 'Services' }),
    el('div.grid', {}, o.services.map((s) => serviceCard(s, me))),
    el('div#svcExplain'),
    el('h2', { text: 'The machine' }),
    el('div.grid', {},
      el('div.card', {}, el('h3', {}, el('span.dot'), 'Drills — DiRT'),
        el('div.about', { text: 'break one of OUR services on purpose and time its return; QA and the iPad are never drilled' }),
        el('div#drillLast.quiet'),
        el('div.row', { style: { marginTop: '8px' } }, [['kill', 'vite'], ['kill', 'dev-api'], ['kill', 'speech-helper'], ['kill', 'tunnel'], ['bootout', 'dev-api']].map(([k, nm]) =>
          el('button', { onclick: async () => { if (!(await confirmAct(`Drill: ${k} ${nm}?`, k === 'kill' ? `SIGKILL ${nm} now; launchd must bring it back (up to 2 min).` : `launchctl bootout ${nm}, then bootstrap it — the shape of a reboot for one agent.`))) return; toast(`drill ${k} ${nm}…`); try { const r = await post(`/api/drills/${k}/${nm}`, {}); toast(r.ok ? `${nm}: back in ${r.back_s} s · launchd restarted it: ${r.launchd_restarted ? 'yes' : 'no'}${r.throttle_s ? ` · throttle ${r.throttle_s} s` : ''}` : (r.why || r.refused || 'it did not come back'), r.ok ? 'ok' : 'error') } catch (e) { toast(e.message, 'error') } refresh() } }, `${k} ${nm}`)))),
      el('div.card', {}, el('h3', {}, el(`span.dot.${disk.low ? 'err' : 'ok'}`), 'Disk'), el('div.num', { text: `${disk.free_gb} GB free` }),
        el('div.bar', { style: { margin: '8px 0' } }, el('i', { style: { width: `${Math.round(100 * disk.used / disk.total)}%` } })),
        kv(...eat.flatMap(([k, v]) => [k, gb(v)])),
        el('button', { style: { marginTop: '8px' }, onclick: async () => { await api('/api/disk/eaters?refresh=true'); toast('measuring the eaters (a minute)…') } }, 'Measure again')),
      el('div.card', {}, el('h3', {}, el(`span.dot.${mem.pressure === 'normal' ? 'ok' : mem.pressure === 'warning' ? 'warn' : 'err'}`), 'Memory'),
        el('div.num', { text: `${mem.available_gb} GB available` }), kv('pressure', mem.pressure, 'total', gb(mem.total))),
      el('div.card', {}, el('h3', {}, el(`span.dot.${o.errors.signals.new + o.errors.signals.rising ? 'err' : 'ok'}`), 'Errors, 24 h'),
        el('div.num', { text: `${n(o.errors.events_24h)} events · ${o.errors.classes} kinds` }),
        el('div.row', {}, ['new', 'rising', 'returned'].map((s) => el(`span.tag.${s}`, { text: `${o.errors.signals[s]} ${s}` }))),
        el('button', { style: { marginTop: '8px' }, onclick: () => window.lacunaShow('errors') }, 'Open Errors'))),
    el('h2', { text: 'Alerts' }),
    o.alerts.length ? el('table', {}, el('tr', {}, ['when', 'level', 'what', ''].map((h) => el('th', { text: h }))),
      o.alerts.map((a) => el('tr', {}, el('td', { text: ago(a.t), 'data-ago': a.t }), el('td', {}, el(`span.tag.${a.level === 'error' ? 'error' : 'warn'}`, { text: a.level })),
        el('td', {}, el('b', { text: a.title }), el('div.quiet', { text: a.body })), el('td', { text: a.acked ? 'seen' : '' })))) : el('p.quiet', { text: 'No alerts. Lacuna is watching.' }),
    el('h2', { text: 'Jobs' }),
    o.jobs.length ? el('table', {}, o.jobs.map((j) => el('tr', {}, el('td', {}, j.running ? el('span.spin') : el(`span.dot.${j.code === 0 ? 'ok' : 'err'}`)),
      el('td', { text: j.title }), el('td', { text: j.who }), el('td', { text: ago(j.started), 'data-ago': j.started }), el('td.mono', { text: j.running ? 'running' : `exit ${j.code}` })))) : el('p.quiet', { text: 'No jobs yet.' }),
    el('h2', { text: 'The two APIs and their watchdogs' }),
    el('div#apis', {}, lastApis || el('p.quiet', {}, el('span.spin'), ' asking both APIs…')))
  api('/api/boot').then((b) => {
    const line = root.querySelector('#bootLine'); if (!line || !b?.done) return
    line.textContent = `${b.kind === 'reboot' ? 'after the reboot' : 'after Lacuna restarted'} (${ago(b.at)}): ${b.down?.length ? `${b.down.join(', ')} did not come back` : `everything back in ${b.took_s} s`}${b.not_kept_for_reboot?.length ? ` · would not survive a reboot: ${b.not_kept_for_reboot.join(', ')}` : ''}`
  }).catch(() => {})
  api('/api/drills').then((d) => {
    const line = root.querySelector('#drillLast'); if (!line) return
    const rows = (d.history || []).slice(0, 4)
    line.textContent = rows.length ? rows.map((r) => `${r.kind} ${r.service}: ${r.ok ? `back in ${r.back_s} s` : 'DID NOT COME BACK'} (${ago(r.t)})`).join(' · ') : 'no drills yet'
  }).catch(() => {})
  api('/api/health').then((hlt) => {
    const box = root.querySelector('#apis'); if (!box) return
    lastApis = el('div.grid', {}, Object.values(hlt.apis).map((a) => el('div.card', {},
      el('h3', {}, el(`span.dot.${a.up ? 'ok' : 'err'}`), a.label, el('span.tag', { text: `:${a.port}` })),
      a.up ? kv('version', a.healthz?.version ?? '—', 'commit', a.healthz?.sha ?? '—', 'camera', a.camera ? (a.camera.connected ? `connected (${a.camera.camera || ''})` : 'not in use') : '—',
        'turntable', a.turntable ? (a.turntable.connected ? `connected (${a.turntable.device || ''})` : 'not in use') : '—') : el('p', { text: a.error || 'down' }),
      // the dev API's production fence, one line: green when every part holds, red when a part is false or unread
      a.fence_line ? el('div.row', { style: { marginTop: '8px', flexWrap: 'nowrap', alignItems: 'baseline' } },
        el(`span.dot.${{ ok: 'ok', bad: 'err' }[a.fence_line.state] || ''}`),
        el('span', { text: a.fence_line.text, style: { flex: '1 1 0', minWidth: '0', overflowWrap: 'anywhere' } })) : null,
      el('div', { style: { marginTop: '8px' } }, (hlt.watchdogs[a.env] || []).slice(0, 14).map((w) => el('div.row', {},
        el(`span.dot.${w.level === 'error' ? 'err' : w.level === 'warn' ? 'warn' : 'ok'}`), el('span.mono', { text: w.name }), el('span.quiet', { text: String(w.summary || '').slice(0, 90) })))))))
    mount(box, lastApis)
  }).catch(() => {})
}

export async function init(node) { root = node; await refresh() }
export function enter() { clearInterval(timer); timer = setInterval(refresh, 8000) }
export function leave() { clearInterval(timer) }
