// MENTAT — the explain box: pick a cart, a shop and an object (and, if you like, one past impression) and Mentat
// answers in plain words whether the cart made the cut there, where it ranked, what it lost to, and the factors.
// It asks only when the button is pressed; it never polls.
import { api, el, kv, mount } from './util.js'

const TERMS = ['sev', 'prox', 'freq', 'health', 'wired', 'learn']
const REASON = {
  'no-signal': 'it has no signal', 'signal-not-firing': 'its signal is not firing here', 'needs-account': 'it needs an account that is not connected',
  dropped: 'it was dropped', 'below-cut': 'it ranked below the cut', 'not-for-shop': 'it is not for this shop',
}
const opt = (v, t) => el('option', { value: v, text: t })

function answerPicture(x) {
  const isIn = x.verdict === 'in'
  const where = x.position == null ? 'not ranked' : `ranked ${x.position}${x.cut != null ? `, the cut is ${x.cut}` : ''}`
  const f = x.factors || {}
  return el('div.mt-answer', {},
    el('div.row.mt-verdict', {}, el(`span.dot.${isIn ? 'ok' : 'err'}`), el('b', { text: isIn ? 'IN' : 'OUT' }), el('span', { text: where }),
      x.hard_reason ? el('span.tag.warn', { text: REASON[x.hard_reason] || x.hard_reason }) : null),
    el('ol.mt-lines', {}, (x.answer || []).map((line) => el('li', { text: line }))),
    x.lost_to ? el('p', {}, el('span.quiet', { text: 'lost to ' }), el('b.mono', { text: x.lost_to.slug }),
      el('span.quiet', { text: ` (score ${Number(x.lost_to.score).toFixed(2)}) by ${x.lost_to.by}` })) : null,
    el('div.grid.mt-grid', {},
      el('div.card', {}, el('h3', {}, 'Factors'), kv('band', f.band_words ? `${f.band} · ${f.band_words}` : (f.band ?? '—'),
        ...TERMS.flatMap((t) => [t, f.terms?.[t] == null ? '—' : Number(f.terms[t]).toFixed(3)]))),
      el('div.card', {}, el('h3', {}, 'Signals weighed'), (f.signals || []).length ? el('table.mt-table', {},
        el('tr', {}, ['signal', 'sev', 'prox', 'freq', 'weight'].map((h) => el('th', { text: h }))),
        f.signals.map((s) => el('tr', {}, el('td.mono', { text: s.id }), ['sev', 'prox', 'freq', 'weight'].map((k) => el('td.mono', { text: s[k] == null ? '—' : String(Math.round(s[k] * 1000) / 1000) })))))
        : el('p.quiet', { text: 'No signal was weighed.' }))))
}

/** The box. `pre` may name a cart, object, shop and impression to start from. */
export function explainBox(ctx, pre = {}) {
  const b = ctx.board || {}
  const carts = (b.carts || []).map((c) => c.slug)
  if (pre.cart && !carts.includes(pre.cart)) carts.unshift(pre.cart)
  const cart = el('select', { 'aria-label': 'cart' }, opt('', 'pick a cart'), carts.map((s) => opt(s, s)))
  const shop = el('select', { 'aria-label': 'shop' }, opt('', 'every shop'), (b.shops || []).map((s) => opt(s, s)))
  const object = el('select', { 'aria-label': 'object' }, opt('', 'pick an object'))
  const imp = el('select', { 'aria-label': 'impression' }, opt('', 'now (no past impression)'))
  const go = el('button.go', {}, 'Explain')
  const out = el('div.mt-out')
  cart.value = pre.cart || ''; shop.value = pre.shop || ''

  async function loadObjects() {
    const r = await api(`/api/mentat/objects${shop.value ? `?shop=${encodeURIComponent(shop.value)}` : ''}`).catch(() => ({ objects: [] }))
    const keep = object.value || pre.object || ''
    const objs = r.objects || []
    if (keep && !objs.some((o) => o.id === keep)) objs.unshift({ id: keep, title: keep })
    object.replaceChildren(opt('', 'pick an object'), ...objs.map((o) => opt(o.id, o.title && o.title !== o.id ? `${o.title} · ${o.id}` : o.id)))
    object.value = keep
    await loadImpressions()
  }
  async function loadImpressions() {
    const keep = imp.value || pre.impression || ''
    imp.replaceChildren(opt('', 'now (no past impression)'))
    if (!cart.value || !object.value) return
    const qs = new URLSearchParams({ cart: cart.value, object: object.value, limit: '20' })
    if (shop.value) qs.set('shop', shop.value)
    const r = await api(`/api/mentat/impressions?${qs}`).catch(() => ({ impressions: [] }))
    const list = r.impressions || []
    if (keep && !list.some((i) => i.id === keep)) list.unshift({ id: keep, t: null, shop: pre.shop })
    imp.append(...list.map((i) => opt(i.id, `${i.id}${i.t ? ` · ${new Date(i.t * 1000).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}${i.shop ? ` · ${i.shop}` : ''}`)))
    imp.value = keep
  }
  async function ask() {
    if (!cart.value || !object.value) { mount(out, el('p.quiet', { text: 'Pick a cart and an object first.' })); return }
    const qs = new URLSearchParams({ cart: cart.value, object: object.value })
    if (shop.value) qs.set('shop', shop.value)
    if (imp.value) qs.set('impression', imp.value)
    go.disabled = true
    mount(out, el('p.quiet', {}, el('span.spin'), ' asking Mentat…'))
    try { mount(out, answerPicture(await api(`/api/mentat/explain?${qs}`))) } catch (e) { mount(out, el('p', { text: `Mentat could not explain it: ${e.message}` })) }
    go.disabled = false
  }
  cart.addEventListener('change', () => { pre.impression = ''; loadImpressions() })
  shop.addEventListener('change', () => { pre.impression = ''; loadObjects() })
  object.addEventListener('change', () => { pre.impression = ''; loadImpressions() })
  go.addEventListener('click', ask)
  loadObjects().then(() => { if (pre.cart && pre.object && pre.impression) ask() })
  return el('div.card.mt-explain', {}, el('div.row.mt-form', {}, cart, shop, object, imp, go), out)
}
