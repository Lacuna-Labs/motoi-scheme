// DEPLOYS — the versions (tags, dev, main), the builds we kept (each one installable, so a ROLLBACK is installing an
// older build), what her iPad reports, and the simulator. Installing on her iPad always asks first.
import { api, post, el, mount, ago, confirmAct, toast } from './util.js'

let root, timer, follow = null

async function followJob(job) {
  follow = job.id
  const pane = root.querySelector('#jobLog')
  const tick = async () => {
    if (follow !== job.id) return
    const r = await api(`/api/jobs/${job.id}/log`).catch(() => null)
    if (!r) return
    mount(pane, el('div.card', {}, el('h3', {}, r.job?.running ? el('span.spin') : el(`span.dot.${r.job?.code === 0 ? 'ok' : 'err'}`), r.job?.title || job.title),
      el('pre.log', { text: r.text || '' })))
    const pre = pane.querySelector('pre'); if (pre) pre.scrollTop = pre.scrollHeight
    if (r.job?.running) setTimeout(tick, 2000); else refresh()
  }
  tick()
}

async function build(ref) {
  if (!(await confirmAct(`Build ${ref} for the iPad?`, 'It builds and ARCHIVES the app (a few minutes). Nothing is installed until you press Install.'))) return
  const r = await post('/api/deploys/build', { ref })
  toast(`building ${ref}…`); followJob(r.job)
}

async function install(b) {
  if (!(await confirmAct(`Install ${b.ref} (build ${b.build}) on the iPad?`, `Over the air, now. Version ${b.version || '?'} · ${b.sha} · points at ${b.origin}. The app restarts on the new build when it is next opened.`))) return
  try { const r = await post(`/api/deploys/${b.id}/install`, { confirm: true }); toast('installing on the iPad…'); followJob(r.job) } catch (e) { toast(e.message, 'error') }
}

// THE RELEASE — one path, one job, four steps (toolbox/release.sh): the stepper is read off the job's own lines
const MARK = { waiting: 'dot', running: 'spin', done: 'dot ok', failed: 'dot err' }
function stepper(rel) {
  return el('div.steps', {}, (rel.steps || []).map((st) => el('div.step', { 'data-state': st.state },
    st.state === 'running' ? el('span.spin') : el(`span.${MARK[st.state] || 'dot'}`),
    el('div', {}, el('b', { text: `${st.n}/4 ${st.title}` }), st.said ? el('div.quiet', { text: st.said }) : null))),
    rel.done ? el('p', { style: { color: 'var(--ok)' }, text: `Done — ${rel.done}` }) : null,
    rel.stopped ? el('p', { style: { color: 'var(--err)' }, text: `Stopped — ${rel.stopped}` }) : null)
}

async function release() {
  const skip = await confirmAct('Release to the iPad?', 'The one path: the workflow pass on the simulator (about 5 min), then the promote to QA with the build (gated; QA rolls back by itself), then the install on the iPad over the air, then the iPad\'s own word that it runs the build. Each step shows here as it goes.')
  if (!skip) return
  try { const r = await post('/api/release', { confirm: true }); toast('release started'); followJob(r.job) } catch (e) { toast(e.message, 'error') }
}

async function refresh() {
  const [d, rel] = await Promise.all([api('/api/deploys'), api('/api/release').catch(() => null)])
  const busy = Boolean(rel?.job?.running)
  mount(root.querySelector('#rel'),
    el('h2', { text: 'The release — dev → QA → the iPad, one path' }),
    el('div.card', {},
      el('div.row', {}, el('button.danger', { disabled: busy, onclick: release }, busy ? 'A release is running' : 'Release to the iPad'),
        rel?.job ? el('span.quiet', { text: `${rel.job.running ? 'running' : rel.done ? 'last: done' : 'last: stopped'} · ${rel.job.title} · ${ago(rel.job.started)} · ${rel.job.who}` }) : el('span.quiet', { text: 'no release yet — the pass, the promote with the build, the install, and the iPad reporting it' }),
        rel?.job ? el('button', { onclick: () => followJob(rel.job) }, 'Its log') : null),
      rel?.job ? stepper(rel) : null))
  mount(root.querySelector('#dep'),
    el('h2', { text: 'Builds we kept — install one (an older one is a rollback)' }),
    d.builds.length ? el('table', {}, el('tr', {}, ['', 'version', 'ref', 'commit', 'build', 'points at', 'made', ''].map((h) => el('th', { text: h }))),
      d.builds.map((b) => el('tr', {}, el('td', {}, el(`span.dot.${b.ok ? 'ok' : 'err'}`)), el('td', { text: b.version || '—' }), el('td.mono', { text: b.ref }),
        el('td.mono', { text: b.sha }), el('td.mono', { text: b.build }), el('td.mono', { text: b.origin }), el('td', { text: ago(b.created) }),
        el('td', {}, el('button.danger', { disabled: !b.ok, onclick: () => install(b) }, 'Install on the iPad'))))) : el('p.quiet', { text: 'No builds archived yet — build a version below.' }),
    el('h2', { text: 'Versions' }),
    el('table', {}, el('tr', {}, ['ref', 'commit', 'when', 'what', ''].map((h) => el('th', { text: h }))),
      d.versions.map((v) => el('tr', {}, el('td.mono', { text: v.ref }), el('td.mono', { text: v.sha }), el('td', { text: ago(v.t) }), el('td', { text: v.subject }),
        el('td', {}, el('button', { onclick: () => build(v.ref) }, 'Build for the iPad'))))))
}

export async function init(node) {
  root = node
  mount(root,
    el('div.toolbar', {},
      el('button', { onclick: async () => { const r = await api('/api/deploys/device'); toast(r.ok ? `the iPad reports build ${r.build || 'unknown'}` : r.why, r.ok ? 'ok' : 'info') } }, 'What is on the iPad?'),
      el('button', { onclick: async () => { if (await confirmAct('Rebuild the simulator app?', 'The Studio simulator gets the working tree (a few minutes).')) { const r = await post('/api/deploys/simulator'); followJob(r.job) } } }, 'Deploy to the simulator'),
      el('button', { onclick: () => build('working') }, 'Build the working tree for the iPad')),
    el('div#rel'), el('div#jobLog'), el('div#dep'))
  await refresh()
}
export function enter() { clearInterval(timer); timer = setInterval(refresh, 20000) }
export function leave() { clearInterval(timer) }
