// GRAPHS (D3, his call: "just use D3JS for now until we could generalize our graphs"): errors over time by category,
// requests and p95 latency per environment, disk and memory, and which services were up.
import { api, el, mount } from './util.js'

let root, timer, hours = 24
const COLORS = ['#ef5b5b', '#f0b429', '#6ea8fe', '#3ecf8e', '#b39cff', '#f5a3c7', '#5dd6d0', '#c8a36b', '#9aa4b2', '#e07b39', '#7fbf5f']

// Charts are drawn at the width they will occupy, so a label is its real size (a scaled-down wide canvas made them tiny).
let fullW = 1000
function frame(title, h = 220, w = fullW) {
  const svg = d3.create('svg').attr('viewBox', `0 0 ${w} ${h}`).style('height', `${h}px`)
  const legend = el('div.legend')
  return { node: el('div.chart', {}, el('h3', { text: title, style: { margin: '0 0 6px', fontSize: '13px', color: '#a3a3a3' } }), svg.node(), legend), svg, legend, w, h }
}
const halfW = () => { const cols = Math.max(1, Math.floor((fullW + 12) / 472)); return Math.floor((fullW + 12) / cols) - 12 - 26 }

function axes(g, x, y, h) {
  g.svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${h - 22})`).call(d3.axisBottom(x).ticks(8).tickSizeOuter(0))
  g.svg.append('g').attr('class', 'axis').attr('transform', 'translate(44,0)').call(d3.axisLeft(y).ticks(4).tickSizeOuter(0))
}

function stacked(rows) {
  const g = frame(`Warnings + errors per 15 minutes, by category — last ${hours} h`)
  if (!rows.length) { g.legend.append('nothing yet'); return g.node }
  const cats = [...new Set(rows.map((r) => r.category))]
  const times = [...new Set(rows.map((r) => r.t))].sort((a, b) => a - b)
  const table = times.map((t) => { const o = { t }; for (const c of cats) o[c] = 0; for (const r of rows) if (r.t === t) o[r.category] = r.n; return o })
  const series = d3.stack().keys(cats)(table)
  const x = d3.scaleTime().domain([new Date(times[0] * 1000), new Date(times[times.length - 1] * 1000 + 900000)]).range([46, g.w - 8])
  const y = d3.scaleLinear().domain([0, d3.max(series, (s) => d3.max(s, (d) => d[1])) || 1]).nice().range([g.h - 24, 8])
  const color = d3.scaleOrdinal(cats, COLORS)
  const bw = Math.max(1, (x(new Date(times[0] * 1000 + 900000)) - x(new Date(times[0] * 1000))) - 1)
  g.svg.append('g').selectAll('g').data(series).join('g').attr('fill', (s) => color(s.key))
    .selectAll('rect').data((s) => s).join('rect').attr('x', (d) => x(new Date(d.data.t * 1000))).attr('width', bw)
    .attr('y', g.h - 24).attr('height', 0).transition().duration(600).attr('y', (d) => y(d[1])).attr('height', (d) => Math.max(0, y(d[0]) - y(d[1])))
  axes(g, x, y, g.h)
  for (const c of cats) g.legend.append(el('span', {}, el('i', { style: { background: color(c) } }), c))
  return g.node
}

function lines(title, groups, fmt = (v) => v) {
  const g = frame(title, 180, halfW())
  const all = groups.flatMap((s) => s.points)
  if (!all.length) { g.legend.append('nothing yet'); return g.node }
  const x = d3.scaleTime().domain(d3.extent(all, (d) => new Date(d.t * 1000))).range([46, g.w - 8])
  const y = d3.scaleLinear().domain([0, d3.max(all, (d) => d.v) || 1]).nice().range([g.h - 24, 8])
  groups.forEach((s, i) => {
    const path = g.svg.append('path').datum(s.points).attr('fill', 'none').attr('stroke', COLORS[i % COLORS.length]).attr('stroke-width', 1.8)
      .attr('d', d3.line().x((d) => x(new Date(d.t * 1000))).y((d) => y(d.v)).curve(d3.curveMonotoneX))
    const len = path.node().getTotalLength()
    path.attr('stroke-dasharray', `${len} ${len}`).attr('stroke-dashoffset', len).transition().duration(800).attr('stroke-dashoffset', 0)
    const last = s.points[s.points.length - 1]
    g.legend.append(el('span', {}, el('i', { style: { background: COLORS[i % COLORS.length] } }), `${s.name} · now ${fmt(last.v)}`))
  })
  axes(g, x, y, g.h)
  return g.node
}

async function refresh() {
  fullW = Math.max(480, (root.clientWidth || 1000) - 26)
  const [errs, routes, disk, mem, dev, qa] = await Promise.all([
    api(`/api/errors/series?hours=${hours}`), api(`/api/metrics/routes?hours=${hours}`),
    api(`/api/metrics/series?name=disk_free_gb&hours=${hours}`), api(`/api/metrics/series?name=mem_available_gb&hours=${hours}`),
    api(`/api/metrics/series?name=up:dev-api&hours=${hours}`), api(`/api/metrics/series?name=up:qa-api&hours=${hours}`)])
  const per = (env, key) => routes.filter((r) => r.env === env).map((r) => ({ t: r.t, v: r[key] }))
  mount(root.querySelector('#charts'),
    stacked(errs),
    el('div.grid', { style: { gridTemplateColumns: 'repeat(auto-fill, minmax(460px, 1fr))', marginTop: '12px' } },
      lines('Requests per minute', [{ name: 'dev', points: per('dev', 'n') }, { name: 'QA', points: per('qa', 'n') }]),
      lines('p95 latency per minute (ms)', [{ name: 'dev', points: per('dev', 'p95') }, { name: 'QA', points: per('qa', 'p95') }], (v) => `${v} ms`),
      lines('Disk free (GB)', [{ name: 'disk', points: disk.map((d) => ({ t: d.t, v: d.v })) }], (v) => `${v} GB`),
      lines('Memory available (GB)', [{ name: 'memory', points: mem.map((d) => ({ t: d.t, v: d.v })) }], (v) => `${v} GB`),
      lines('Services up (1 = up)', [{ name: 'dev API', points: dev.map((d) => ({ t: d.t, v: d.v })) }, { name: 'QA API', points: qa.map((d) => ({ t: d.t, v: d.v })) }])))
}

export async function init(node) {
  root = node
  mount(root, el('div.toolbar', {}, el('select', { onchange: (e) => { hours = Number(e.target.value); refresh() } },
    [[24, 'last 24 h'], [6, 'last 6 h'], [1, 'last hour'], [72, 'last 3 days'], [336, 'last 2 weeks']].map(([v, t]) => el('option', { value: v, text: t })))), el('div#charts'))
  await refresh()
}
export function enter() { clearInterval(timer); timer = setInterval(refresh, 60000) }
export function leave() { clearInterval(timer) }
