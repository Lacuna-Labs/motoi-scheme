// BATTERY — every pass (the release workflow pass, the full burn-in) with each act's result, and the test suites.
import { api, post, el, mount, confirmAct, toast } from './util.js'

let root, timer, open = null

async function start(kind, label) {
  if (!(await confirmAct(`Run ${label}?`, 'On the dev API + the simulator. It relaunches the simulator app for each act.'))) return
  await post(`/api/battery/${kind}`); toast(`${label} started`); refresh()
}
async function suite(kind) {
  await post(`/api/tests/${kind}`); toast(`${kind} suite started — Control › Jobs follows it`); refresh()
}

async function refresh() {
  const passes = await api('/api/battery')
  mount(root.querySelector('#passes'), passes.map((p) => {
    const body = el('table', { hidden: open !== p.log }, el('tr', {}, ['act', 'held MB', 'page errors', 'telemetry', 'result'].map((h) => el('th', { text: h }))),
      p.runs.map((r) => el('tr', {}, el('td.mono', { text: r.name }), el('td.mono', { text: r.held_mb ?? '' }),
        el('td', {}, el(`span.dot.${(r.page_errors || 0) ? 'err' : 'ok'}`), ` ${r.page_errors ?? '—'}`),
        el('td.mono', { text: `${r.tel_errors ?? '—'} err / ${r.tel_warns ?? '—'} warn` }),
        el('td.mono', { text: r.act_error ? `ERROR: ${r.act_error}` : (r.result || r.raw || '') }))))
    return el('div.card', { style: { marginBottom: '10px' } },
      el('h3', { style: { cursor: 'pointer' }, onclick: () => { open = open === p.log ? null : p.log; body.hidden = open !== p.log } },
        el(`span.dot.${p.problems ? 'err' : p.finished ? 'ok' : 'warn'}`), p.log, el('span.quiet', { text: ` ${p.began} · ${p.runs.length} runs · ${p.problems} with problems${p.finished ? '' : ' · still running'}` })),
      body)
  }))
}

export async function init(node) {
  root = node
  mount(root, el('div.toolbar', {},
    el('button.go', { onclick: () => start('release', 'the release pass') }, 'Run the release pass'),
    el('button', { onclick: () => start('full', 'the full battery') }, 'Run the full battery'),
    el('button', { onclick: () => suite('web') }, 'Web tests (~3 min)'),
    el('button', { onclick: () => suite('api') }, 'API tests (~45 min)')), el('div#passes'))
  await refresh()
}
export function enter() { clearInterval(timer); timer = setInterval(refresh, 15000) }
export function leave() { clearInterval(timer) }
