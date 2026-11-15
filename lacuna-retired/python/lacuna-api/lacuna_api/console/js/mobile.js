// THE PHONE CUT — Lacuna built for a thumb, not the desktop squeezed.
//
// His (2026-09-25): "I'll be doing this on my phone A LOT… mobile-first controls… no floating edges, no floating frames,
// no cheap buttons." So on a phone the console is its own shell, laid out the way on-call apps are:
//   · a BOTTOM TAB BAR (the thumb zone): Home · Ask · Ship · Signals · More
//   · HOME answers "is everything OK?" in one line, then what needs you (proposals, alerts), her server, her iPad, the
//     services — full-bleed rows, color only where something needs a hand
//   · every act is a BOTTOM SHEET with the consequence written out and one big button; her side always asks first
//   · 48pt targets, 16px inputs (iOS never zooms), safe-area insets, dynamic viewport height — no bar jumps
// The desktop console is untouched; main.js picks this cut when the screen is a phone.
import { decide as ownerDecide } from './owner.js'
import { api, post, el, mount, ago } from './util.js'

const TABS = [
  ['home', 'Home', 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z'],
  ['ask', 'Ask', 'M4 5h16v11H8l-4 4z'],
  ['ship', 'Ship', 'M12 3l7 4v10l-7 4-7-4V7zM5 7l7 4 7-4M12 11v10'],
  ['signals', 'Signals', 'M3 12h4l3-8 4 16 3-8h4'],
  ['more', 'More', 'M5 12h.01M12 12h.01M19 12h.01'],
]
let shell, pages = {}, current = 'home', timer = null, dock = null

// ── THE PAGE IS NEVER BLANK (finish pass, 2026-09-25). Home waited on two slow calls and showed black for seconds;
// now the last answer paints at once (kept in this browser, up to six hours), marked "as of", and the fresh one
// replaces it. With nothing kept, a skeleton of rows holds the shape.
const CACHE = 'lacuna.m.cache.v1'
function remember(key, value) { try { const all = JSON.parse(localStorage.getItem(CACHE) || '{}'); all[key] = { t: Date.now(), value }; localStorage.setItem(CACHE, JSON.stringify(all)) } catch { /* private mode */ } }
function recall(key) { try { const e = (JSON.parse(localStorage.getItem(CACHE) || '{}'))[key]; return e && Date.now() - e.t < 6 * 3600e3 ? e : null } catch { return null } }
const skeleton = (n = 4) => section(null, ...Array.from({ length: n }, () => el('div.m-skel', {}, el('span.m-skel-dot'), el('span.m-skel-t', {}, el('i'), el('i')))))
const asOf = (t) => el('div.m-asof', { text: `as of ${ago(t / 1000)} · refreshing…` })
/** paint from what is kept, then from the console; `fetch` returns the value, `paint(node, value, stamp)` draws it.
 * A poll that changes nothing draws nothing (his, 2026-09-26: "it's blinking"): the answer is reduced by STABLE to
 * what would change the picture, and the same picture stays. */
const painted = {}
const STABLE = {
  home: ({ o, pk, rel }) => ({ s: o.services.map((s) => [s.name, s.up, s.healthy]), d: o.drift, p: (o.petitions || []).map((p) => p.id), a: (o.alerts || []).map((a) => [a.key, a.acked]), disk: o.disk.free_gb, mem: Math.round(o.memory.available_gb * 2) / 2, pk, rel: rel && [rel.job?.id, rel.job?.running, rel.steps?.map((s) => s.state)] }),
  more: ({ self, boot, drills, notify }) => ({ ok: self?.ok, boot: boot && [boot.at, boot.done, boot.down, boot.not_kept_for_reboot], d: drills?.history?.slice(0, 2), r: drills?.running?.kind, notify }),
}
async function fresh(node, key, fetch, paint) {
  const had = recall(key)
  if (!node.childElementCount) { if (had) paint(node, had.value, had.t); else mount(node, skeleton()) }
  const value = await fetch()
  remember(key, value)
  const fp = JSON.stringify((STABLE[key] || ((v) => v))(value))
  if (painted[key] === fp && node.childElementCount && !node.querySelector('.m-asof, .m-skel')) return
  painted[key] = fp
  paint(node, value, null)
}

// ── the sheet: every act lives here ────────────────────────────────────────────────────────────────────────────
function sheet({ title, body, action, danger = false, run }) {
  const scrim = el('div.m-scrim')
  const panel = el('div.m-sheet', { role: 'dialog', 'aria-modal': 'true' })
  const close = () => { panel.classList.remove('on'); scrim.classList.remove('on'); setTimeout(() => { scrim.remove(); panel.remove() }, 220) }
  const status = el('p.m-sheet-status')
  const go = action ? el(`button.m-big${danger ? '.m-danger' : '.m-primary'}`, {
    onclick: async () => {
      go.disabled = true; status.textContent = 'Working…'
      try { const msg = await run(); status.textContent = msg || 'Done.'; setTimeout(() => { close(); refresh() }, 900) }
      catch (e) { status.textContent = e.message; status.classList.add('m-bad'); go.disabled = false }
    } }, action) : null
  // only the parts that exist — an absent action appended as-is rendered the word "null" (found on the phone, 2026-09-25)
  panel.append(...[el('div.m-grip'), el('h3', { text: title }), typeof body === 'string' ? el('p', { text: body }) : body,
    status, go, el('button.m-big.m-quiet', { onclick: close }, action ? 'Cancel' : 'Close')].filter(Boolean))
  scrim.onclick = close
  document.body.append(scrim, panel)
  requestAnimationFrame(() => { scrim.classList.add('on'); panel.classList.add('on') })
}

const dotOf = (s) => (!s.up ? 'bad' : s.healthy === false ? 'warn' : 'ok')
const row = (lead, title, sub, trail, onclick) =>
  el(`button.m-row${onclick ? '' : '.m-static'}`, onclick ? { onclick } : {}, lead, el('span.m-row-t', {}, el('b', { text: title }), sub ? el('small', { text: sub }) : null), trail || null)
const dot = (kind) => el(`span.m-dot.m-${kind}`)
const section = (title, ...kids) => el('section.m-sec', {}, title ? el('h2', { text: title }) : null, ...kids)

// ── HOME ─────────────────────────────────────────────────────────────────────────────────────────────────────────
function serviceSheet(s) {
  const hers = s.hers
  const acts = s.up ? [['restart', 'Restart'], ['stop', 'Stop']] : [['start', 'Start']]
  const body = el('div', {},
    el('p', { text: `${s.about || ''}` }),
    el('p.m-mono', { text: `:${s.port} · ${s.up ? (s.healthy === false ? 'up, not healthy' : 'up, healthy') : 'DOWN'} · ${s.supervised ? 'kept by launchd' : 'hand-started'}` }),
    el('div.m-acts', {}, acts.map(([a, word]) => el(`button.m-big${a === 'stop' ? '.m-danger' : ''}`, {
      onclick: () => sheet({ title: `${word} ${s.title}?`, danger: hers || a === 'stop',
        body: hers ? `${s.title} is the customer's server — the iPad talks to it. ${word === 'Stop' ? 'Nothing answers the iPad until it is started again.' : 'The iPad loses it for about 20 seconds.'}` : `${word} ${s.title} now.`,
        action: word, run: async () => { const r = await post(`/api/services/${s.name}/${a}`, { confirm: !!hers }); return r.ok === false ? (r.why || 'It did not happen.') : `${s.title}: ${a} done.` } }) }, word))),
    s.name !== 'lacuna' ? el('button.m-big.m-quiet', { onclick: async () => { const x = await api(`/api/services/${s.name}/explain`); sheet({ title: `Why — ${s.title}`, body: el('pre.m-pre', { text: `${x.cause || ''}\n\n${(x.log || '').slice(-1800)}` }) }) } }, s.up ? 'Its log' : 'Why is it down?') : null)
  sheet({ title: s.title, body })
}

async function renderHome(node) {
  await fresh(node, 'home', async () => { const [o, pk, rel] = await Promise.all([api('/api/overview'), api('/api/packages').catch(() => null), api('/api/release').catch(() => null)]); return { o, pk, rel } }, paintHome)
}

function paintHome(node, { o, pk, rel }, stamp) {
  const down = o.services.filter((s) => !s.up && s.name !== 'tunnel')
  const alerts = (o.alerts || []).filter((a) => !a.acked && a.level !== 'info')
  const waiting = o.petitions || []
  const needs = down.length + alerts.length + waiting.length + (o.drift || []).length
  const qa = o.services.find((s) => s.name === 'qa-api')
  const running = rel?.job?.running ? rel : null
  mount(node,
    stamp ? asOf(stamp) : null,
    el(`div.m-hero.m-${needs ? 'warn' : 'ok'}`, {},
      el('div.m-hero-k', { text: needs ? `${needs} thing${needs > 1 ? 's' : ''} need${needs > 1 ? '' : 's'} you` : 'All clear' }),
      el('div.m-hero-s', { text: needs ? [down.length && `${down.length} down`, waiting.length && `${waiting.length} waiting for your yes`, alerts.length && `${alerts.length} alert${alerts.length > 1 ? 's' : ''}`, (o.drift || []).length && 'drift'].filter(Boolean).join(' · ') : `the customer's server and ${o.services.filter((s) => s.up).length} services up · ${o.disk.free_gb} GB free` })),
    waiting.length ? section('Waiting for your yes', ...waiting.map((p) => el('div.m-card', {},
      el('b', { text: p.effect || p.action }), el('small', { text: `asked: ${p.reason || '—'} · ${p.by}, ${ago(p.t)}` }),
      el('div.m-acts', {},
        el('button.m-big.m-danger', { onclick: () => sheet({ title: 'Approve?', danger: true, body: p.effect || p.action, action: 'Approve', run: async () => { const r = await ownerDecide(p.id, true); return r.ok ? 'Approved — it is running.' : (r.why || 'It did not run.') } }) }, 'Approve'),
        el('button.m-big', { onclick: async () => { await ownerDecide(p.id, false); refresh() } }, 'Decline'))))) : null,
    (o.drift || []).length ? section('Drift — expected vs running', ...(o.drift || []).map((d) => row(dot('warn'), d.service, d.detail, null,
      () => sheet({ title: `Drift · ${d.service}`, body: `${d.detail}\n\n${/dev-api/.test(d.service) ? 'Restarting the dev API picks up the code on disk.' : /qa/.test(d.service) ? 'QA changes only by promotion — see Ship.' : ''}`.trim(),
        action: /dev-api/.test(d.service) ? 'Restart the dev API' : null,
        run: async () => { const r = await post('/api/services/dev-api/restart', {}); return r.ok === false ? (r.why || 'It did not restart.') : 'Restarted.' } })))) : null,
    alerts.length ? section('Alerts', ...alerts.slice(0, 6).map((a) => row(dot(a.level === 'error' ? 'bad' : 'warn'), a.title, `${ago(a.t)} — ${a.body}`, null,
      () => sheet({ title: a.title, body: a.body, action: 'Seen', run: async () => { await post('/api/alerts/ack', { key: a.key }); return 'Marked seen.' } })))) : null,
    running ? section('A release is running', stepper(running)) : null,
    section('Customer server',
      row(dot(qa ? dotOf(qa) : 'bad'), 'QA', `${pk?.qa_is_running_commit || '—'}${pk?.qa_matches_main ? ' · on main' : ''} · :5050`, el('span.m-chev', { text: '›' }), () => qa && serviceSheet(qa)),
      row(dot(pk?.ipad_running_build ? 'ok' : 'idle'), 'The iPad', pk?.ipad_running_build ? `build ${pk.ipad_running_build}` : (pk?.ipad_note || 'not on the network'), null, null)),
    section('Services', ...o.services.filter((s) => s.name !== 'qa-api').map((s) =>
      row(dot(dotOf(s)), s.title, `:${s.port} · ${s.up ? 'up' : 'DOWN'}${s.hers ? ' · customer' : ''}`, el('span.m-chev', { text: '›' }), () => serviceSheet(s)))),
    section('The machine',
      row(dot(o.disk.low ? 'bad' : 'ok'), `${o.disk.free_gb} GB free`, 'disk', null, null),
      row(dot(o.memory.pressure === 'normal' ? 'ok' : 'warn'), `${o.memory.available_gb} GB available`, `memory · ${o.memory.pressure}`, null, null)))
}

// ── SHIP: the package, promote, builds, her iPad, jobs ─────────────────────────────────────────────────────────────
// the four steps of a release, as rows: ○ waiting · ◐ running · ● done · ✗ failed
const MARK = { waiting: 'idle', running: 'spin', done: 'ok', failed: 'bad' }
function stepper(rel) {
  return el('div.m-steps', {}, (rel.steps || []).map((st) => el('div.m-step', { 'data-state': st.state },
    st.state === 'running' ? el('span.m-spin') : dot(MARK[st.state] || 'idle'),
    el('span.m-row-t', {}, el('b', { text: `${st.n}/4 ${st.title}` }), st.said ? el('small', { text: st.said }) : null))),
    rel.done ? el('p.m-said.m-good', { text: `Done — ${rel.done}` }) : null,
    rel.stopped ? el('p.m-said.m-bad', { text: `Stopped — ${rel.stopped}` }) : null)
}

function releaseSheet(wait) {
  const skip = el('input', { type: 'checkbox', id: 'relSkip' })
  sheet({ title: 'Release to the iPad?', danger: true,
    body: el('div', {},
      el('p', { text: `${wait.count ? `${wait.count} commit${wait.count > 1 ? 's' : ''} on dev` : 'Nothing new on dev'} go the one way: the workflow pass on the simulator (about 5 min), then the promote to QA with the build (the gate; QA rolls back by itself), then the install on the iPad over the air, and the iPad's own word that it runs the build. Each step shows here as it goes.` }),
      el('label.m-check', {}, skip, el('span', { text: 'the pass ran clean by hand just now — skip it' }))),
    action: 'Release', run: async () => { const r = await post('/api/release', { confirm: true, skip_pass: skip.checked }); return r.ok ? 'Released — following it here.' : (r.why || 'It did not start.') } })
}

async function renderShip(node) {
  await fresh(node, 'ship', async () => { const [pk, dep, jobs, rel] = await Promise.all([api('/api/packages').catch(() => null), api('/api/deploys').catch(() => ({ builds: [] })), api('/api/jobs').catch(() => []), api('/api/release').catch(() => null)]); return { pk, dep, jobs, rel } }, paintShip)
}

function paintShip(node, { pk, dep, jobs, rel }, stamp) {
  const wait = pk?.waiting_on_dev_not_on_qa || { count: 0, commits: [] }
  const running = (jobs || []).filter((j) => j.running)
  const busy = running.some((j) => ['release', 'promote', 'deploy', 'build'].includes(j.kind))
  mount(node,
    stamp ? asOf(stamp) : null,
    section('The release',
      el('div.m-card', {},
        el('b', { text: rel?.job ? (rel.job.running ? 'Running now' : rel.done ? `Last release: done` : `Last release: stopped`) : 'No release yet' }),
        rel?.job ? el('small', { text: `${rel.job.title} · ${ago(rel.job.started)} · ${rel.job.who}` }) : el('small', { text: 'one path: pass → promote + build → install → the iPad reports it' }),
        rel?.job ? stepper(rel) : null,
        el('div.m-acts', {}, el('button.m-big.m-primary', { disabled: busy, onclick: () => releaseSheet(wait) }, busy ? 'A release is running' : 'Release to the iPad')))),
    section('The package',
      el('div.m-card', {},
        el('b', { text: wait.count ? `${wait.count} commit${wait.count > 1 ? 's' : ''} on dev, not on QA` : 'Nothing to promote' }),
        el('small', { text: `QA runs ${pk?.qa_is_running_commit || '—'} · dev ${pk?.dev_commit || '—'}` }),
        wait.count ? el('ul.m-commits', {}, wait.commits.slice(0, 8).map((c) => el('li', { text: c }))) : null,
        wait.count ? el('div.m-acts', {},
          el('button.m-big.m-primary', { onclick: () => sheet({ title: 'Promote to QA?', danger: true,
            body: 'The tests gate it (anything main does not already fail stops it), main fast-forwards, and the customer\'s server restarts on it for about 20 seconds. If QA does not come up, it rolls back by itself.',
            action: 'Promote', run: async () => { const r = await post('/api/deploys/promote', { confirm: true }); return r.ok ? 'Promoting — follow it under Jobs.' : 'It did not start.' } }) }, 'Promote to QA')) : null)),
    running.length ? section('Running now', ...running.map((j) => row(el('span.m-spin'), j.title, `${j.who} · ${ago(j.started)}`, el('span.m-chev', { text: '›' }), () => jobSheet(j)))) : null,
    section('The iPad',
      row(dot(pk?.ipad_running_build ? 'ok' : 'idle'), pk?.ipad_running_build ? `build ${pk.ipad_running_build}` : 'Not on the network', 'what the iPad runs now', null, null),
      ...(dep.builds || []).slice(0, 5).map((b) => row(dot(b.ok ? 'idle' : 'bad'), `${b.version || '?'} · ${b.sha || ''}`, `built ${ago(b.created)} · ${b.ref}`, el('span.m-pill', { text: 'Install' }),
        () => sheet({ title: `Install ${b.version} on the iPad?`, danger: true, body: `Build ${b.build} (${b.ref} @ ${b.sha}) goes onto the iPad over the air. An older build is how you roll back.`,
          action: 'Install on the iPad', run: async () => { const r = await post(`/api/deploys/${b.id}/install`, { confirm: true }); return r.ok ? 'Installing — follow it under Jobs.' : (r.why || 'It did not start.') } })))),
    section('Recent jobs', ...(jobs || []).filter((j) => !j.running).slice(0, 6).map((j) =>
      row(dot(j.code === 0 ? 'ok' : 'bad'), j.title, `${j.code === 0 ? 'done' : `exit ${j.code}`} · ${ago(j.started)}`, el('span.m-chev', { text: '›' }), () => jobSheet(j)))))
}

async function jobSheet(j) {
  const log = await api(`/api/jobs/${j.id}/log?lines=80`).catch(() => ({ log: '' }))
  const text = typeof log === 'string' ? log : (log.log || log.tail || '')
  sheet({ title: j.title, body: el('pre.m-pre', { text: text.split('\n').filter((l) => !/^\s*$/.test(l)).slice(-40).join('\n') || '(no log yet)' }) })
}

// ── SIGNALS: error classes (new and rising first) ─────────────────────────────────────────────────────────────────
async function renderSignals(node) {
  await fresh(node, 'signals', async () => { const [rows, h, wd] = await Promise.all([api('/api/errors/classes?hours=24&limit=60').catch(() => []), api('/api/health').catch(() => null), api('/api/watchdogs').catch(() => null)]); return { rows, h, wd } }, paintSignals)
}

const agoS = (s) => s < 90 ? `${s}s` : s < 5400 ? `${Math.round(s / 60)}m` : s < 172800 ? `${Math.round(s / 3600)}h` : `${Math.round(s / 86400)}d`
function paintSignals(node, { rows, h, wd }, stamp) {
  // A WATCHDOG THAT HAS SINCE RECOVERED IS NOT RED (2026-09-25: podcast.ear read "NEW · absent" in red fifteen minutes
  // after it came back). The classes remember the incident; the watchdog's CURRENT state says whether it is over.
  const now = {}
  for (const env of ['dev', 'qa']) for (const w of (h?.watchdogs?.[env] || [])) now[`${env}:${w.name}`] = w.level
  const over = (r) => /^watch\./.test(r.subsystem || '') && ['info', 'ok'].includes(now[`${r.env}:${r.subsystem}`])
  const list = (Array.isArray(rows) ? rows : rows.classes || []).map((r) => ({ ...r, over: over(r) }))
    .sort((a, b) => (a.over - b.over) || ((b.signal ? 1 : 0) - (a.signal ? 1 : 0)) || (b.last_hour || 0) - (a.last_hour || 0))
  const live = list.filter((r) => !r.over).length
  const dogs = [...(wd?.dev || []).map((w) => ({ ...w, env: 'dev' })), ...(wd?.qa || []).map((w) => ({ ...w, env: 'QA' }))]
    .sort((a, b) => (a.stale - b.stale) || ((b.level === 'error') - (a.level === 'error')) || ((b.level === 'warn') - (a.level === 'warn')))
  const loud = dogs.filter((w) => !w.stale && w.level !== 'info')
  mount(node,
    stamp ? asOf(stamp) : null,
    section('Watchdogs',
      row(dot('idle'), 'Run the checks now', 'kick the watchdogs: sample, evaluate, drift — says what it raised', el('span.m-pill', { text: 'Kick' }),
        () => sheet({ title: 'Run the checks now?', body: 'The minute\'s pass runs at once on our side: services, error classes, drift, disk, memory. Anything new lands under Alerts.', action: 'Run',
          run: async () => { const r = await post('/api/checks/run', {}); return r.raised?.length ? `Raised: ${r.raised.map((a) => a.title).join(', ')}` : `Ran — ${r.alerts} open alert${r.alerts === 1 ? '' : 's'}, ${r.drift.length} drift row${r.drift.length === 1 ? '' : 's'}.` } })),
      ...(loud.length ? loud : dogs.slice(0, 6)).map((w) => row(dot(w.stale ? 'idle' : w.level === 'error' ? 'bad' : w.level === 'warn' ? 'warn' : 'ok'),
        `${w.env} · ${w.name}${w.stale ? ' · stale' : ''}`, `${agoS(w.age_s)} ago — ${String(w.summary || '')}`, el('span.m-chev', { text: '›' }),
        () => sheet({ title: `${w.env} · ${w.name}`, body: el('pre.m-pre', { text: `${w.level} · ${agoS(w.age_s)} ago${w.stale ? ' (stale — its last word is old; the service may not have spoken since)' : ''}\n\n${w.summary}` }) }))),
      dogs.length > (loud.length || 6) ? el('p.m-said', { text: `${dogs.length - (loud.length || 6)} more are quiet and current` }) : null),
    section(list.length ? `${live} live · ${list.length - live} recovered · 24 h` : 'No warnings or errors in 24 hours',
    ...list.slice(0, 40).map((r) => row(dot(r.over ? 'idle' : r.level === 'error' ? 'bad' : 'warn'),
      `${r.over ? 'RECOVERED · ' : r.signal ? `${r.signal.toUpperCase()} · ` : ''}${r.subsystem} · ${r.action}`, `${r.env === 'qa' ? 'QA' : 'dev'} · ${r.last_hour || 0}/h · ${r.last_day || 0}/24h — ${r.template}`,
      el('span.m-chev', { text: '›' }), () => sheet({ title: `${r.subsystem} · ${r.action}`, body: el('pre.m-pre', { text: `${r.template}\n\n${JSON.stringify(r.sample, null, 2).slice(0, 1600)}` }) })))))
}

// ── MORE ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const DRILLS = [['kill', 'vite', 'Kill vite'], ['kill', 'dev-api', 'Kill the dev API'], ['kill', 'speech-helper', 'Kill the speech helper'], ['kill', 'tunnel', 'Kill the tunnel'], ['bootout', 'dev-api', 'Boot the dev API out and in']]
function drillSheet(kind, name, title) {
  sheet({ title: `${title}?`, danger: true,
    body: `On purpose, now: ${kind === 'kill' ? `SIGKILL ${name} and time launchd's restart` : `launchctl bootout ${name}, then bootstrap it — the shape of a reboot`}. Our side only; QA and the iPad are never drilled. Up to two minutes.`,
    action: 'Run the drill', run: async () => { const r = await post(`/api/drills/${kind}/${name}`, {}); return r.ok ? `Back in ${r.back_s} s · launchd restarted it: ${r.launchd_restarted ? 'yes' : 'no'}${r.throttle_s ? ` · throttle ${r.throttle_s} s` : ''}` : (r.why || r.refused || 'It did not come back.') } })
}

async function renderMore(node) {
  await fresh(node, 'more', async () => { const [self, boot, drills, notify] = await Promise.all([api('/api/self').catch(() => null), api('/api/boot').catch(() => null), api('/api/drills').catch(() => null), api('/api/notify').catch(() => null)]); return { self, boot, drills, notify } }, paintMore)
}

function paintMore(node, { self, boot, drills, notify }, stamp) {
  const last = (drills?.history || [])[0]
  mount(node,
    stamp ? asOf(stamp) : null,
    section('Lacuna',
      row(dot(self?.ok ? 'ok' : 'bad'), self?.ok ? 'Watching' : 'The watcher is stalled', self ? `heartbeat ${self.heartbeat_age_s}s ago · ${self.passes} passes` : '', null, null),
      boot?.done ? row(dot(boot.down?.length ? 'bad' : boot.not_kept_for_reboot?.length ? 'warn' : 'ok'), boot.kind === 'reboot' ? 'After the reboot' : 'After Lacuna restarted',
        `${boot.down?.length ? `${boot.down.join(', ')} did not come back` : `everything back in ${boot.took_s} s`}${boot.not_kept_for_reboot?.length ? ` · ${boot.not_kept_for_reboot.join(', ')} would not survive a reboot` : ''} · ${ago(boot.at)}`, el('span.m-chev', { text: '›' }),
        () => sheet({ title: 'The boot report', body: el('pre.m-pre', { text: Object.entries(boot.up || {}).map(([n, s]) => `● ${n}  back in ${s} s`).concat((boot.down || []).map((n) => `○ ${n}  DID NOT COME BACK`), (boot.not_kept_for_reboot || []).map((n) => `! ${n}  no RunAtLoad agent loaded — lacuna svc supervise ${n}`)).join('\n') || '(nothing kept)' }) })) : null,
      row(dot('idle'), 'Open the full console', 'every tab, laid out for a big screen', el('span.m-chev', { text: '›' }), () => { try { localStorage.setItem('lacuna.cut', 'desk') } catch { /* */ } location.reload() })),
    section('Tests', ...[['release', 'Battery · release pass', '/api/battery/release'], ['web', 'Web tests', '/api/tests/web'], ['api', 'API tests', '/api/tests/api']].map(([k, t, url]) =>
      row(dot('idle'), t, 'on dev and the simulator — never the customer\'s side', el('span.m-pill', { text: 'Run' }),
        () => sheet({ title: `Run ${t.toLowerCase()}?`, body: 'It runs as a job on dev; its result lands under Ship › Recent jobs.', action: 'Run', run: async () => { await post(url, {}); return 'Started.' } })))),
    section('Drills — break our side on purpose',
      last ? row(dot(last.ok ? 'ok' : 'bad'), `Last: ${last.kind} ${last.service}`, `${last.ok ? `back in ${last.back_s} s` : 'did not come back'} · ${ago(last.t)}`, null, null) : null,
      ...DRILLS.map(([kind, name, title]) => row(dot('idle'), title, kind === 'kill' ? 'SIGKILL it; launchd brings it back' : 'bootout, then bootstrap — a reboot for one agent', el('span.m-pill', { text: 'Drill' }), () => drillSheet(kind, name, title)))),
    section('Notices — where a notice goes',
      row(dot('ok'), 'The Studio', 'a macOS banner, always', null, null),
      row(dot(notify?.imessage ? 'ok' : 'idle'), 'iMessage', notify?.imessage || 'not set — lacuna notify set imessage <number or Apple ID>', null, null),
      row(dot(notify?.ntfy ? 'ok' : 'idle'), 'ntfy', notify?.ntfy || 'not set — lacuna notify set ntfy https://ntfy.sh/<topic>', null, null),
      row(dot('idle'), 'Send a test notice', 'down every channel that is set', el('span.m-pill', { text: 'Send' }),
        () => sheet({ title: 'Send a test notice?', body: 'One notice, now, down every channel that is set.', action: 'Send', run: async () => { const r = await post('/api/notify/test', {}); return `Sent down: ${(r.sent || []).join(', ')}` } }))))
}

// ── the shell ────────────────────────────────────────────────────────────────────────────────────────────────────
async function show(tab) {
  current = tab
  for (const [id] of TABS) { pages[id].hidden = id !== tab; shell.querySelector(`[data-tab="${id}"]`).setAttribute('aria-current', id === tab ? 'page' : 'false') }
  shell.querySelector('.m-title').textContent = TABS.find(([id]) => id === tab)[1] === 'Home' ? 'Lacuna' : TABS.find(([id]) => id === tab)[1]
  if (tab === 'ask') { dock?.scrollToEnd?.(); dock?.focus(); return }
  await refresh()
}

async function refresh() {
  const node = pages[current]
  try {
    if (current === 'home') await renderHome(node)
    else if (current === 'ship') await renderShip(node)
    else if (current === 'signals') await renderSignals(node)
    else if (current === 'more') await renderMore(node)
  } catch (e) { mount(node, section(null, el('p.m-empty', { text: `The console did not answer: ${e.message}` }))) }
}

// THE SHELL IS AS TALL AS THE SCREEN YOU SEE (2026-09-26). `position: fixed; inset: 0` came out short of Chrome's own
// toolbar on iOS, so the tab bar sat a quarter of the way up with black under it. The visual viewport's height is the
// one number every iOS browser reports honestly; it becomes --vvh on every resize, scroll of the toolbars, and turn.
function fit() {
  const vv = window.visualViewport
  const h = Math.round((vv && vv.height) || window.innerHeight)
  document.documentElement.style.setProperty('--vvh', `${h}px`)
  if (shell && vv) shell.style.top = `${Math.round(vv.offsetTop || 0)}px`
  // the layout viewport must not scroll under the fixed shell: a browser that grew the page under its toolbar
  // scrolled the shell out from under the tab bar (the "taller bottom" regression, 2026-09-26)
  if (window.scrollY) window.scrollTo(0, 0)
}

export async function init() {
  document.body.classList.add('m')
  fit()
  window.addEventListener('resize', fit); window.addEventListener('orientationchange', fit)
  if (window.visualViewport) { window.visualViewport.addEventListener('resize', fit); window.visualViewport.addEventListener('scroll', fit) }
  document.getElementById('main')?.remove(); document.querySelector('header.top')?.remove(); document.getElementById('alertbar')?.remove()
  const icon = (d) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); const p = document.createElementNS(s.namespaceURI, 'path'); p.setAttribute('d', d); s.append(p); return s }
  shell = el('div.m-shell', {},
    el('header.m-top', {}, el('span.m-mark'), el('b.m-title', { text: 'Lacuna' }), el('button.m-refresh', { 'aria-label': 'Refresh', onclick: () => refresh() }, '↻')),
    el('main.m-pages', {}, TABS.map(([id]) => (pages[id] = el(`div.m-page.m-page-${id}`, { hidden: id !== 'home' })))),
    el('nav.m-tabs', { 'aria-label': 'Lacuna' }, TABS.map(([id, word, d]) => el('button', { 'data-tab': id, onclick: () => show(id) }, icon(d), el('span', { text: word })))))
  document.body.append(shell)
  fit()
  dock = await import('./dock.js')
  dock.mountPage(pages.ask)
  await show('home')
  const light = () => api('/api/self').then((s) => { shell.querySelector('.m-mark').dataset.on = s?.ok ? 'yes' : 'no' }).catch(() => { shell.querySelector('.m-mark').dataset.on = 'no' })
  light()
  timer = setInterval(() => { if (document.visibilityState === 'visible') { light(); if (current !== 'ask') refresh() } }, 10000)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && current !== 'ask') refresh() })
}
