// MENTAT — one cart's page and one signal's page (mentat.js routes here). A cart: its signals, its score over the
// snapshots, where it ranked each time it was weighed, how often it was shown, shown → run → done, which signals put it
// there each time, the runs, verbs and logs that followed, and the explain box. A signal: when it fired, on what, which
// carts it raised and whether they ran and finished. Both are fingerprinted like the board: the same answer keeps the DOM.
import { api, el, kv, ago, n } from './util.js'
import { paint, fingerprint, when, agoCell, score, pct, failed, band, flags, cartLink, signalLink, scroll } from './mentat.js'
import { explainBox } from './mentat-explain.js'

const COLORS = ['#6ea8fe', '#3ecf8e', '#f0b429', '#b39cff', '#f5a3c7', '#5dd6d0']
// a late answer to an older question never paints over the view in front
const here = (ctx, kind, id) => ctx.view.kind === kind && ctx.view.id === id
const head = (...names) => el('tr', {}, names.map((h) => el('th', { text: h })))

// A small chart, drawn at the width it will occupy so its labels are their real size; few ticks, so none collide.
function chart(title, series, { invert = false, dots = false, fmt = (v) => v, width = 460, h = 170 } = {}) {
  const all = series.flatMap((s) => s.points)
  const legend = el('div.legend')
  const box = el('div.chart.mt-chart', {}, el('h3.mt-chart-t', { text: title }))
  if (!all.length || typeof d3 === 'undefined') { box.append(el('p.quiet', { text: 'nothing yet' })); return box }
  const w = Math.max(280, width)
  const svg = d3.create('svg').attr('viewBox', `0 0 ${w} ${h}`).style('height', `${h}px`)
  const xs = d3.extent(all, (d) => d.t * 1000)
  if (xs[0] === xs[1]) { xs[0] -= 3600e3; xs[1] += 3600e3 }
  const x = d3.scaleTime().domain(xs).range([40, w - 10])
  const ys = invert ? [d3.max(all, (d) => d.v) || 1, 1] : [0, d3.max(all, (d) => d.v) || 1]
  const y = d3.scaleLinear().domain(ys).nice().range([h - 24, 10])
  series.forEach((s, i) => {
    const c = COLORS[i % COLORS.length]
    if (!dots) svg.append('path').datum(s.points).attr('fill', 'none').attr('stroke', c).attr('stroke-width', 1.8)
      .attr('d', d3.line().x((d) => x(d.t * 1000)).y((d) => y(d.v)))
    svg.append('g').selectAll('circle').data(s.points).join('circle').attr('cx', (d) => x(d.t * 1000)).attr('cy', (d) => y(d.v))
      .attr('r', dots ? 4 : 2.5).attr('fill', (d) => (d.hollow ? 'none' : c)).attr('stroke', c).attr('stroke-width', 1.5)
    const last = s.points[s.points.length - 1]
    legend.append(el('span', {}, el('i', { style: { background: c } }), `${s.name} · last ${fmt(last.v)}`))
  })
  svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${h - 22})`).call(d3.axisBottom(x).ticks(Math.max(2, Math.floor(w / 120))).tickSizeOuter(0))
  svg.append('g').attr('class', 'axis').attr('transform', 'translate(38,0)').call(d3.axisLeft(y).ticks(4).tickSizeOuter(0).tickFormat(invert ? d3.format('d') : null))
  box.append(svg.node(), legend)
  return box
}
const byShop = (rows, key) => {
  const m = new Map()
  for (const r of rows) { if (r[key] == null) continue; if (!m.has(r.shop)) m.set(r.shop, []); m.get(r.shop).push(r) }
  return [...m.entries()].map(([name, pts]) => ({ name, pts: pts.sort((a, b) => (a.at ?? a.t) - (b.at ?? b.t)) }))
}
const half = (node) => Math.floor(((node.clientWidth || 980) - 12) / ((node.clientWidth || 980) > 720 ? 2 : 1)) - 28

function funnel(c) {
  const steps = [['shown', c.shown], ['ran', c.ran], ['done', c.done]]
  const top = Math.max(1, c.shown || 0)
  return el('div.card', {}, el('h3', {}, 'Shown → run → done'),
    steps.map(([k, v], i) => el('div.mt-funnel', {}, el('span.mono', { text: k }), el('div.bar', {}, el('i', { style: { width: `${Math.round((100 * (v || 0)) / top)}%` } })),
      el('span.mono', { text: `${n(v)}${i ? ` · ${pct(v, steps[i - 1][1])}` : ''}` }))))
}

function cartPicture(d, node, ctx) {
  const c = d.cart
  const w = half(node)
  const trend = byShop(d.trend || [], 'score').map((s) => ({ name: s.name, points: s.pts.map((p) => ({ t: p.at, v: p.score })) }))
  const pos = byShop(d.impressions || [], 'position').map((s) => ({ name: s.name, points: s.pts.map((p) => ({ t: p.t, v: p.position, hollow: !p.shown })) }))
  return [
    el('div.row.mt-crumbs', {}, el('button', { onclick: () => ctx.go('board') }, '← Board'), el('span.quiet', { text: 'cart' })),
    el('h2.mt-title', { text: c.title || c.slug }),
    el('div.row', {}, el('span.mono.quiet', { text: c.slug }), band(c.band, c.band_words), flags(c.flags)),
    el('div.row.mt-signals', {}, el('span.quiet', { text: 'its signals' }), (c.signals || []).length ? c.signals.map(signalLink) : el('span.tag.warn', { text: 'none — no signal can raise it' })),
    el('div.grid.mt-grid', {},
      el('div.card', {}, el('h3', {}, 'Facts'), kv('category', c.category || '—', 'score', Object.entries(c.score || {}).map(([s, v]) => `${s} ${score(v)}`).join(' · ') || '—',
        'avg position', c.avg_position == null ? '—' : Number(c.avg_position).toFixed(1), 'runs', `${n(c.runs)} · ${n(c.done)} done · ${n(c.failed)} failed`,
        'last shown', ago(c.last_shown), 'last run', ago(c.last_run), 'last fired', ago(c.last_fired))),
      funnel(d.conversion || {})),
    el('div.grid.mt-charts', {}, chart('Score over the snapshots', trend, { fmt: score, width: w }),
      chart('Where it ranked (1 is the top; hollow = not shown)', pos, { invert: true, dots: true, width: w })),
    el('h2', { text: `Each time it was weighed — ${(d.impressions || []).length} shown here` }),
    (d.impressions || []).length ? scroll(el('table.mt-table', {}, head('when', 'shop', 'object', 'position', 'band', 'score', 'shown', 'signals that put it there', 'why', ''),
      d.impressions.map((i) => el('tr', {}, agoCell(i.t), el('td.mt-nw', { text: i.shop }), el('td.mono', { text: i.object ?? '—' }), el('td.mono', { text: String(i.position ?? '—') }),
        el('td.mono', { text: String(i.band ?? '—') }), el('td.mono', { text: score(i.score) }),
        el('td', {}, el(`span.dot.${i.shown ? 'ok' : 'idle'}`)), el('td', {}, el('div.row', {}, (i.signals || []).map(signalLink))),
        el('td.mt-why', { text: i.why || '' }),
        el('td', {}, el('button', { onclick: () => ctx.go('explain', { cart: c.slug, object: i.object, shop: i.shop, impression: i.id }) }, 'Explain')))))) : el('p.quiet', { text: 'Never weighed yet.' }),
    el('div.grid.mt-grid', {},
      el('div', {}, el('h2', { text: 'What it decided' }), (d.decisions || []).length ? scroll(el('table.mt-table', {}, head('when', 'decision', 'object', 'position'),
        d.decisions.map((x) => el('tr', {}, agoCell(x.t), el('td', { text: x.decision }), el('td.mono', { text: x.object || '—' }), el('td.mono', { text: String(x.position ?? '—') }))))) : el('p.quiet', { text: 'No decisions.' })),
      el('div', {}, el('h2', { text: 'Verbs it called' }), (d.verbs || []).length ? scroll(el('table.mt-table', {}, head('verb', 'ok', 'failed', 'last'),
        d.verbs.map((v) => el('tr', {}, el('td.mono', { text: v.verb }), el('td.mono', { text: n(v.ok) }), el(`td.mono${v.fail ? '.mt-bad' : ''}`, { text: n(v.fail) }), agoCell(v.last_t))))) : el('p.quiet', { text: 'No verbs yet.' }))),
    el('h2', { text: 'The runs that followed' }),
    (d.runs || []).length ? scroll(el('table.mt-table', {}, head('when', 'run', 'ended as', 'outcome', 'kind', 'took', 'steps · acts', 'stopped at'),
      d.runs.map((r) => el('tr', {}, agoCell(r.t), el('td.mono', { text: r.run_id }), el('td', {}, el(`span.tag.${r.ended_as === 'done' ? 'mt-ok' : 'error'}`, { text: r.ended_as || '—' })),
        el('td', { text: r.outcome || '' }), el('td', { text: r.kind || '' }), el('td.mono', { text: r.duration_ms == null ? '—' : `${(r.duration_ms / 1000).toFixed(1)} s` }),
        el('td.mono', { text: `${n(r.steps)} · ${n(r.acts)}` }), el('td.mono', { text: r.stop || '' }))))) : el('p.quiet', { text: 'It has never run.' }),
    el('h2', { text: 'Its logs' }),
    (d.logs || []).length ? el('div.loglines.mt-logs', {}, d.logs.map((l) => el('div', { class: l.level }, el('span.t', { text: `${when(l.t)} ` }), `${l.level} · ${l.summary}`))) : el('p.quiet', { text: 'No log lines.' }),
    el('h2', { text: 'Explain' }),
    el('div#mtCartExplain'),
  ]
}

export async function cartPage(node, slug, ctx) {
  try {
    const d = await api(`/api/mentat/cart/${encodeURIComponent(slug)}`)
    if (!here(ctx, 'cart', slug)) return
    const drew = paint(node, `cart|${slug}|${fingerprint(d)}`, () => cartPicture(d, node, ctx))
    if (drew) {
      if (!ctx.board) ctx.board = await api('/api/mentat/board').catch(() => null)
      const last = (d.impressions || [])[d.impressions.length - 1]
      node.querySelector('#mtCartExplain')?.append(explainBox(ctx, { cart: slug, object: last?.object, shop: last?.shop || ctx.f.shop }))
    }
  } catch (e) { if (here(ctx, 'cart', slug)) paint(node, `cart-err|${slug}|${e.message}`, () => [el('button', { onclick: () => ctx.go('board') }, '← Board'), failed(e)]) }
}

function signalPicture(d, node, ctx) {
  const s = d.signal
  const fires = byShop(d.trend || [], 'fires').map((x) => ({ name: x.name, points: x.pts.map((p) => ({ t: p.at, v: p.fires })) }))
  const total = (d.trend || []).reduce((a, r) => a + (r.fires || 0), 0)
  return [
    el('div.row.mt-crumbs', {}, el('button', { onclick: () => ctx.go('board') }, '← Board'), el('span.quiet', { text: 'signal' })),
    el('h2.mt-title', { text: s.id }),
    el('div.grid.mt-grid', {},
      el('div.card', {}, el('h3', {}, 'What it means'), el('p', { text: s.meaning || '—' }), kv('severity', s.severity, 'distance', s.distance, 'fires in the trend', n(total))),
      chart('Fires per snapshot, per shop', fires, { width: half(node) })),
    el('h2', { text: 'Where it fired' }),
    (d.impressions || []).length ? scroll(el('table.mt-table', {}, head('when', 'shop', 'object', 'carts it raised'),
      d.impressions.map((i) => el('tr', {}, agoCell(i.t), el('td.mt-nw', { text: i.shop }), el('td.mono', { text: i.object ?? '—' }), el('td', {}, el('div.row', {}, (i.carts || []).map(cartLink))))))) : el('p.quiet', { text: 'It has not fired on any object.' }),
    el('h2', { text: 'The carts it raised — did they run, did they finish' }),
    (d.carts || []).length ? scroll(el('table.mt-table', {}, head('cart', 'raised', 'ran', 'done', 'ran of raised', 'done of ran'),
      d.carts.map((c) => el('tr', {}, el('td', {}, cartLink(c.slug)), el('td.mono', { text: n(c.raised) }), el('td.mono', { text: n(c.ran) }), el('td.mono', { text: n(c.done) }),
        el('td.mono', { text: pct(c.ran, c.raised) }), el('td.mono', { text: pct(c.done, c.ran) }))))) : el('p.quiet', { text: 'It raises no cart.' }),
  ]
}

export async function signalPage(node, id, ctx) {
  try {
    const d = await api(`/api/mentat/signal/${encodeURIComponent(id)}`)
    if (!here(ctx, 'signal', id)) return
    paint(node, `signal|${id}|${fingerprint(d)}`, () => signalPicture(d, node, ctx))
  } catch (e) { if (here(ctx, 'signal', id)) paint(node, `signal-err|${id}|${e.message}`, () => [el('button', { onclick: () => ctx.go('board') }, '← Board'), failed(e)]) }
}
