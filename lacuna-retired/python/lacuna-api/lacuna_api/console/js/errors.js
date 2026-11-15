// ERRORS — every kind of warning and error as one class with a count ("we got 30,000 of these"), its early-warning
// signal (NEW · RISING · RETURNED), where it came from (dev / QA, API / her iPad / the Studio), and a sample.
import { api, el, mount, ago, n } from './util.js'

let root, timer
const f = { env: '', level: '', category: '', hours: 24, q: '' }

function row(r) {
  const tr = el('tr.click', {},
    el('td', {}, r.signal ? el(`span.tag.${r.signal}`, { text: r.signal }) : null),
    el('td', {}, el(`span.tag.${r.level}`, { text: r.level })),
    el('td', { text: r.env === 'qa' ? 'QA' : 'dev' }),
    el('td', { text: r.category }),
    el('td', {}, el('div.mono', { text: `${r.subsystem} · ${r.action}` }), el('div', { text: r.template })),
    el('td.mono', { text: n(r.last_hour) }), el('td.mono', { text: n(r.last_day) }), el('td.mono', { text: n(r.count) }),
    el('td', { text: ago(r.last) }), el('td', { text: r.source }))
  const detail = el('tr', { hidden: true }, el('td', { colspan: 10 }, el('pre.log', { text: JSON.stringify(r.sample, null, 2) }),
    el('p.quiet', { text: `first seen ${new Date(r.first * 1000).toLocaleString()} · class ${r.id}` })))
  tr.addEventListener('click', () => { detail.hidden = !detail.hidden })
  return [tr, detail]
}

async function refresh() {
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v !== '' && v != null))
  const [rows, sum] = await Promise.all([api(`/api/errors/classes?${qs}`), api(`/api/errors/summary?hours=${f.hours}`)])
  const cats = Object.entries(sum.by_category).sort((a, b) => b[1].events - a[1].events)
  mount(root.querySelector('#errSum'), el('div.row', {},
    el('span.num', { text: `${n(sum.events_24h)} events` }), el('span.quiet', { text: ` in ${sum.classes} kinds, last ${f.hours} h ` }),
    ['new', 'rising', 'returned'].map((s) => el(`span.tag.${s}`, { text: `${sum.signals[s]} ${s}` })),
    cats.slice(0, 8).map(([c, v]) => el('button', { onclick: () => { f.category = f.category === c ? '' : c; refresh() }, style: { borderColor: f.category === c ? '#b39cff' : '' } }, `${c} · ${n(v.events)}`))))
  mount(root.querySelector('#errTable'), rows.length ? el('table', {},
    el('tr', {}, ['signal', 'level', 'env', 'category', 'what', '1 h', '24 h', 'all', 'last', 'from'].map((h) => el('th', { text: h }))),
    rows.flatMap(row)) : el('p.quiet', { text: 'No warnings or errors match. Quiet is good.' }))
}

export async function init(node) {
  root = node
  const sel = (key, opts) => el('select', { onchange: (e) => { f[key] = e.target.value; refresh() } }, opts.map(([v, t]) => el('option', { value: v, text: t })))
  mount(root,
    el('div.toolbar', {},
      sel('env', [['', 'dev + QA'], ['dev', 'dev'], ['qa', 'QA (customer)']]),
      sel('level', [['', 'warnings + errors'], ['error', 'errors'], ['warn', 'warnings']]),
      sel('hours', [['24', 'last 24 h'], ['1', 'last hour'], ['6', 'last 6 h'], ['72', 'last 3 days'], ['336', 'last 2 weeks']]),
      el('input', { placeholder: 'find…', oninput: (e) => { f.q = e.target.value; clearTimeout(init._q); init._q = setTimeout(refresh, 250) } })),
    el('div#errSum', { style: { marginBottom: '12px' } }), el('div#errTable'))
  await refresh()
}
export function enter() { clearInterval(timer); timer = setInterval(refresh, 10000) }
export function leave() { clearInterval(timer) }
