// MENTAT — why the cart ranker shows a cart, or does not (2026-10-08). The board (carts per band, signals firing per
// shop, carts that never fire, are never shown, or fail), a cart's own page, a signal's page, the explain box, the
// "right time?" list and the export. Everything is read through Lacuna's own /api/mentat/* (control/mentat.py carries
// it server-side from the dev API); the page never calls the curator itself.
// ★ A POLL NEVER REDRAWS THE SAME PICTURE: each answer is fingerprinted (its clock fields left out); the same
// fingerprint keeps the DOM, and only the "ago" cells are written in place.
import { api, el, mount, ago, n } from './util.js'
import { cartPage, signalPage } from './mentat-detail.js'
import { explainBox } from './mentat-explain.js'
import { listPage } from './mentat-list.js'

let root, timer
const f = { shop: '', category: '', band: '', flag: '' }
const view = { kind: 'board', id: null }
const ctx = { f, go, board: null, view }
const prints = new WeakMap()

/** The answer without its clock: two answers that differ only in when they were made draw the same picture. */
export function fingerprint(o) {
  if (!o || typeof o !== 'object') return JSON.stringify(o)
  const { at, checked_at, asked_at, ...rest } = o // eslint-disable-line no-unused-vars
  return JSON.stringify(rest)
}
/** Draw into `node` only when the picture changed; otherwise refresh the "ago" cells in place. */
export function paint(node, key, build) {
  if (!node) return false
  if (prints.get(node) === key && node.childNodes.length) {
    for (const c of node.querySelectorAll('[data-ago]')) c.textContent = ago(Number(c.dataset.ago))
    return false
  }
  mount(node, build())
  prints.set(node, key)
  return true
}
export const when = (t) => (t ? new Date(t * 1000).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')
export const agoCell = (t) => el('td', { text: ago(t), 'data-ago': t || '', title: when(t) })
export const score = (v) => (v == null ? '—' : Number(v).toFixed(2))
export const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '—')
export const failed = (e) => el('div.card', {}, el('h3', {}, el('span.dot'), 'Mentat cannot be read right now'), el('p.quiet', { text: e.message || String(e) }))
export function band(b, words) { return el(`span.tag.mt-band.b${b ?? 'x'}`, { text: words ? `band ${b} · ${words}` : `band ${b ?? '—'}` }) }
export function flags(list) { return (list || []).map((x) => el(`span.tag.mt-flag${/fail|dropped/.test(x) ? '.error' : /never|no-signal|needs/.test(x) ? '.warn' : ''}`, { text: x })) }
export function cartLink(slug) { return el('button.mt-link', { onclick: (e) => { e.stopPropagation(); go('cart', slug) } }, slug) }
export function signalLink(id) { return el('button.mt-link', { onclick: (e) => { e.stopPropagation(); go('signal', id) } }, id) }
export const scroll = (...kids) => el('div.mt-scroll', {}, ...kids)
export const head = (...names) => el('tr', {}, names.map((h) => el('th', { text: h })))

// ── the standing check: the curator's /health, through Lacuna (unknown is never green) ──────────────────────────
async function healthLine() {
  const s = await api('/api/mentat/status').catch((e) => ({ state: 'unknown', why: e.message, alerts: [] }))
  const dot = { ok: 'ok', warn: 'warn', error: 'err' }[s.state] || 'idle'
  const said = s.state === 'unknown' ? `UNKNOWN — ${s.why}` : s.state === 'ok' ? 'the standing check is clear' : `${s.alerts.length} condition${s.alerts.length === 1 ? '' : 's'} named by the standing check`
  paint(root.querySelector('#mtHealth'), fingerprint(s), () => el('div.card.mt-health', {},
    el('div.row', {}, el(`span.dot.${dot}`), el('b', { text: 'Standing check' }), el('span', { text: said }),
      s.checked_at ? el('span.quiet', { text: `checked ${ago(s.checked_at)}`, 'data-ago': s.checked_at }) : null),
    (s.alerts || []).map((a) => el('div.row.mt-alert', {}, el(`span.tag.${a.level === 'error' ? 'error' : 'warn'}`, { text: a.level }),
      el('span', { text: a.text }), subjects(a)))))
}

// what an alert is about. `subject` is only the head of the list; `count` is the true total, so "+N more" is
// counted from it, never from the head. A list the board pages (a cart never shown) opens there.
const ALERT_LIST = { 'cart-never-shown': ['never_shown', 'Fires, never shown'] }
export function moreCount(count, drawn) { const total = Number.isFinite(count) && count >= drawn ? count : drawn; return total - drawn }
function subjects(a) {
  if (!a.subject) return null
  const names = Array.isArray(a.subject) ? a.subject.map(String) : [String(a.subject)]
  const rest = moreCount(a.count, names.length)
  const list = ALERT_LIST[a.id]
  return el('span.row.mt-more', {}, names.map((x) => el('span.mono.quiet.mt-subj', { text: x })),
    rest > 0 ? (list ? el('button.mt-link', { onclick: () => go('list', { name: list[0], title: list[1] }) }, `+${n(rest)} more`)
      : el('span.tag', { text: `+${n(rest)} more` })) : null)
}
/** The first `few` of a list, and a key that shows the rest in place. */
export function more(items, few, draw) {
  const box = el('span.row.mt-more')
  const rest = items.length - few
  box.append(...items.slice(0, few).map(draw))
  if (rest > 0) box.append(el('button.mt-link', { onclick: (e) => { e.stopPropagation(); e.currentTarget.replaceWith(...items.slice(few).map(draw)) } }, `+${rest} more`))
  return box
}

// ── the board ────────────────────────────────────────────────────────────────────────────────────────────────────
// the board carries the first few names of each list and its real count; "+N more" opens the paged list
function list(b, name, title, empty) {
  const slugs = b[name] || []
  const count = b.lists?.[name]?.count ?? slugs.length
  return el('div.card', {}, el('h3', {}, el(`span.dot.${count ? 'warn' : 'ok'}`), title, el('span.quiet', { text: n(count) })),
    count ? el('span.row.mt-more', {}, slugs.map(cartLink),
      count > slugs.length ? el('button.mt-link', { onclick: () => go('list', { name, title }) }, `+${n(count - slugs.length)} more`) : null)
      : el('p.quiet', { text: empty }))
}
/** One row per cart (the board and the paged carts list draw the same table). */
export function cartTable(carts) {
  return scroll(el('table.mt-table', {}, head('cart', 'band', 'flags', 'score', 'shown', 'avg pos', 'runs · done · failed', 'last shown'),
    carts.map((c) => el('tr.click', { onclick: () => go('cart', c.slug) },
      el('td', {}, el('div', { text: c.title || c.slug }), el('div.mono.quiet', { text: `${c.slug} · ${c.category || '—'}` })),
      el('td', {}, band(c.band), el('div.quiet.mt-small', { text: c.band_words || '' })),
      el('td', {}, el('div.row', {}, flags(c.flags))),
      el('td.mono', {}, Object.entries(c.score || {}).map(([sh, v]) => el('div', { text: `${sh} ${score(v)}` }))),
      el('td.mono', { text: n(c.shown) }), el('td.mono', { text: c.avg_position == null ? '—' : Number(c.avg_position).toFixed(1) }),
      el('td.mono', { text: `${n(c.runs)} · ${n(c.done)} · ${n(c.failed)}` }), agoCell(c.last_shown)))))
}

const cartsCount = (b) => b.lists?.carts?.count ?? b.totals.matching ?? b.totals.carts

function boardPicture(b) {
  const shops = b.shops || []
  const max = Math.max(1, ...Object.values(b.totals.by_band || {}))
  const share = b.totals.no_signal_share || 0
  const setF = (k, v) => () => { f[k] = String(f[k]) === String(v) ? '' : String(v); syncFilters(); refresh() }
  return [
    el('div.row.mt-sum', {}, el('span.num', { text: `${n(b.totals.matching ?? b.totals.carts)} carts` }),
      (b.totals.matching ?? b.totals.carts) !== b.totals.carts ? el('span.quiet', { text: `match the filters, of ${n(b.totals.carts)} ·` }) : null,
      b.snapshot ? el('span.quiet', { text: `snapshot ${b.snapshot.id} · ${b.snapshot.source} · ${when(b.snapshot.at)}` }) : el('span.quiet', { text: 'no snapshot yet' }),
      el(`span.tag${share > 0 ? '.warn' : ''}`, { text: `no-signal share ${Math.round(share * 100)}%` })),
    el('div.grid.mt-grid', {},
      el('div.card', {}, el('h3', {}, 'Carts per band'),
        (b.filters.bands || [0, 1, 2, 3, 4]).slice().reverse().map((k) => {
          const c = b.totals.by_band?.[String(k)] || 0
          return el('button.mt-bandrow', { onclick: setF('band', k), 'aria-pressed': String(f.band === String(k)) },
            el('span.mono', { text: `band ${k}` }), el('div.bar', {}, el('i', { style: { width: `${Math.round((100 * c) / max)}%` } })), el('span.mono', { text: String(c) }))
        })),
      el('div.card', {}, el('h3', {}, 'Flags'),
        Object.keys(b.totals.by_flag || {}).length ? el('div.row', {}, Object.entries(b.totals.by_flag).map(([k, v]) =>
          el('button.mt-chip', { onclick: setF('flag', k), 'aria-pressed': String(f.flag === k) }, `${k} · ${v}`))) : el('p.quiet', { text: 'No flags. Every cart has a signal and runs.' })),
      list(b, 'never_fire', 'Never fire', 'Every cart has fired.'),
      list(b, 'never_shown', 'Fires, never shown', 'Every cart whose signal fires has been shown.'),
      list(b, 'failing', 'Failing', 'No cart is failing.')),
    el('h2', { text: 'Signals — how often each fired, per shop' }),
    (b.signals || []).length ? scroll(el('table.mt-table', {}, head('signal', 'severity', 'distance', ...shops, 'carts it raises'),
      b.signals.map((s) => el('tr.click', { onclick: () => go('signal', s.id) },
        el('td', {}, el('span.mono', { text: s.id })), el('td.mono', { text: String(s.severity) }), el('td.mono', { text: String(s.distance) }),
        shops.map((sh) => el(`td.mono${(s.fires?.[sh] || 0) === 0 ? '.mt-zero' : ''}`, { text: n(s.fires?.[sh] || 0) })),
        el('td', {}, more(s.carts || [], 4, cartLink)))))) : el('p.quiet', { text: 'No signals.' }),
    el('h2', { text: `Carts — ${n(b.carts?.length)} shown here of ${n(cartsCount(b))} matching` }),
    (b.carts || []).length ? el('div', {}, cartTable(b.carts),
      cartsCount(b) > b.carts.length ? el('button.mt-rows', { onclick: () => go('list', { name: 'carts', title: 'Carts' }) }, `Show all ${n(cartsCount(b))} — a page at a time`) : null)
      : el('p.quiet', { text: 'No cart matches these filters.' }),
  ]
}

async function showBoard() {
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v !== ''))
  const node = root.querySelector('#mtView')
  try {
    const b = await api(`/api/mentat/board?${qs}`)
    if (view.kind !== 'board' || String(qs) !== String(new URLSearchParams(Object.entries(f).filter(([, v]) => v !== '')))) return  // a late answer to an older question
    ctx.board = b
    fillFilters(b)
    paint(node, `board|${qs}|${fingerprint(b)}`, () => boardPicture(b))
  } catch (e) { if (view.kind === 'board') paint(node, `board-err|${e.message}`, () => failed(e)) }
}

// ── right time? ─────────────────────────────────────────────────────────────────────────────────────────────────
async function showRight() {
  const node = root.querySelector('#mtView')
  try {
    const r = await api(`/api/mentat/right-time${f.shop ? `?shop=${encodeURIComponent(f.shop)}` : ''}`)
    if (view.kind !== 'right') return
    paint(node, `right|${f.shop}|${fingerprint(r)}`, () => [
      el('h2', { text: 'Misorders — the top cart answered a less urgent signal than one that was firing' }),
      r.misorders.length ? scroll(el('table.mt-table', {}, head('when', 'shop', 'object', 'on top', 'its signal · band', 'most urgent signal · band', ''),
        r.misorders.map((m) => el('tr', {}, agoCell(m.t), el('td.mt-nw', { text: m.shop }), el('td.mono', { text: m.object }),
          el('td', {}, cartLink(m.top.slug)), el('td', {}, signalLink(m.top.signal), ` · ${m.top.band}`),
          el('td', {}, signalLink(m.most_urgent.signal), ` · ${m.most_urgent.band}`),
          el('td', {}, el('button', { onclick: () => go('explain', { cart: m.top.slug, object: m.object, shop: m.shop, impression: m.impression }) }, 'Explain')))))) : el('p.quiet', { text: 'No misorders: the top cart answered the most urgent signal every time.' }),
      el('h2', { text: 'Shown, never run' }),
      r.shown_never_run.length ? scroll(el('table.mt-table', {}, head('cart', 'times shown', 'last shown'),
        r.shown_never_run.map((s) => el('tr', {}, el('td', {}, cartLink(s.slug)), el('td.mono', { text: n(s.shown) }), agoCell(s.last_shown))))) : el('p.quiet', { text: 'Every cart that was shown has run.' }),
    ])
  } catch (e) { if (view.kind === 'right') paint(node, `right-err|${e.message}`, () => failed(e)) }
}

// ── the shell: the views, the filters, the export ───────────────────────────────────────────────────────────────
const sel = (key, label) => el('select', { id: `mt-${key}`, 'aria-label': label, onchange: (e) => { f[key] = e.target.value; refresh() } }, el('option', { value: '', text: label }))
function fillFilters(b) {
  const want = { shop: b.shops || [], category: b.filters?.categories || [], band: (b.filters?.bands || []).map(String), flag: b.filters?.flags || [] }
  const label = { shop: 'every shop', category: 'every category', band: 'every band', flag: 'any flag' }
  for (const [k, opts] of Object.entries(want)) {
    const s = root.querySelector(`#mt-${k}`); if (!s) continue
    const key = JSON.stringify(opts); if (s.dataset.opts === key) continue
    s.replaceChildren(el('option', { value: '', text: label[k] }), ...opts.map((o) => el('option', { value: o, text: k === 'band' ? `band ${o}` : o })))
    s.dataset.opts = key; s.value = f[k]
  }
}
function syncFilters() { for (const k of Object.keys(f)) { const s = root.querySelector(`#mt-${k}`); if (s) s.value = f[k] } }

function go(kind, id = null) {
  view.kind = kind; view.id = id
  for (const b of root.querySelectorAll('.mt-seg button')) b.classList.toggle('on', b.dataset.kind === kind)
  root.querySelector('#mtFilters').hidden = kind !== 'board'
  prints.delete(root.querySelector('#mtView'))
  mount(root.querySelector('#mtView'), el('p.quiet', {}, el('span.spin'), ' asking Mentat…'))
  root.scrollIntoView({ block: 'start' })
  refresh()
}

async function refresh() {
  healthLine()
  const node = root.querySelector('#mtView')
  if (view.kind === 'board') return showBoard()
  if (view.kind === 'right') return showRight()
  if (view.kind === 'cart') return cartPage(node, view.id, ctx)
  if (view.kind === 'signal') return signalPage(node, view.id, ctx)
  if (view.kind === 'list') return listPage(node, view.id, ctx)
  if (view.kind === 'explain' && !node.querySelector('.mt-explain')) {
    if (!ctx.board) ctx.board = await api('/api/mentat/board').catch(() => null)
    mount(node, explainBox(ctx, view.id && typeof view.id === 'object' ? view.id : {}))
  }
}

export async function init(node) {
  root = node
  const seg = (kind, text) => el('button', { 'data-kind': kind, class: kind === 'board' ? 'on' : null, onclick: () => go(kind) }, text)
  mount(root,
    el('div#mtHealth'),
    el('div.toolbar.mt-bar', {},
      el('div.mt-seg', {}, seg('board', 'Board'), seg('right', 'Right time?'), seg('explain', 'Explain')),
      sel('shop', 'every shop'),
      el('span#mtFilters.row', {}, sel('category', 'every category'), sel('band', 'every band'), sel('flag', 'any flag')),
      el('span.mt-export', {}, el('span.quiet', { text: 'export' }),
        el('a.mt-dl', { href: '/api/mentat/export?format=csv', download: '' }, 'CSV'), el('a.mt-dl', { href: '/api/mentat/export?format=jsonl', download: '' }, 'JSONL'))),
    el('div#mtView'))
  await refresh()
}
export function enter() { clearInterval(timer); timer = setInterval(() => { if (view.kind !== 'explain') refresh() }, 15000) }
export function leave() { clearInterval(timer) }
