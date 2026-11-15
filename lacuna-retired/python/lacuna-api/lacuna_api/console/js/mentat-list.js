// MENTAT — a long list, a page at a time (2026-10-08). The board carries only the first names of "never fire",
// "fires, never shown" and "failing", and the first carts; "+N more" and "Show all" open the list here, read from
// /api/mentat/list/<name> by offset (100 a page) under the board's filters. Fingerprinted like the rest.
import { api, el, n } from './util.js'
import { paint, fingerprint, failed, cartLink, cartTable } from './mentat.js'

const PAGE = 100
const here = (ctx, spec) => ctx.view.kind === 'list' && ctx.view.id === spec

export async function listPage(node, spec, ctx) {
  const off = spec.offset || 0
  const qs = new URLSearchParams(Object.entries(ctx.f).filter(([, v]) => v !== ''))
  qs.set('offset', String(off)); qs.set('limit', String(PAGE))
  const turn = (to) => () => { spec.offset = Math.max(0, to); listPage(node, spec, ctx) }
  try {
    const r = await api(`/api/mentat/list/${encodeURIComponent(spec.name)}?${qs}`)
    if (!here(ctx, spec) || (spec.offset || 0) !== off) return          // a late answer to an older page
    const items = r.items || []
    const last = off + items.length
    const pager = () => el('div.row.mt-pager', {},
      el('button', { disabled: off <= 0, onclick: turn(off - PAGE) }, '← Previous'),
      el('span.quiet', { text: items.length ? `${n(off + 1)}–${n(last)} of ${n(r.count)}` : `none of ${n(r.count)}` }),
      el('button', { disabled: last >= r.count, onclick: turn(off + PAGE) }, 'Next →'))
    const filters = [...qs.entries()].filter(([k]) => k !== 'offset' && k !== 'limit').map(([k, v]) => `${k} ${v}`).join(' · ')
    paint(node, `list|${spec.name}|${qs}|${fingerprint(r)}`, () => [
      el('div.row.mt-crumbs', {}, el('button', { onclick: () => ctx.go('board') }, '← Board'), el('span.quiet', { text: 'list' })),
      el('h2.mt-title', { text: `${spec.title || spec.name} — ${n(r.count)}` }),
      filters ? el('p.quiet', { text: `under the board's filters: ${filters}` }) : null,
      pager(),
      !items.length ? el('p.quiet', { text: 'Nothing on this page.' })
        : spec.name === 'carts' ? cartTable(items)
          : el('div.card', {}, el('div.row.mt-more', {}, items.map((s) => cartLink(typeof s === 'string' ? s : s.slug)))),
      items.length > 20 ? pager() : null,
    ])
  } catch (e) { if (here(ctx, spec)) paint(node, `list-err|${spec.name}|${e.message}`, () => [el('button', { onclick: () => ctx.go('board') }, '← Board'), failed(e)]) }
}
