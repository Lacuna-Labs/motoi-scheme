// RUNBOOKS — the manuals Lacuna works from: the SRE manual, environments, ports, how each server starts, the design.
import { api, el, mount, markdown } from './util.js'

let root

async function show(id) {
  root.querySelectorAll('.list button').forEach((b) => b.classList.toggle('on', b.dataset.id === id))
  const d = await api(`/api/docs/${id}`)
  mount(root.querySelector('#doc'), el('p.quiet.mono', { text: d.path }), d.text ? markdown(d.text) : el('p', { text: 'This document does not exist yet.' }))
}

export async function init(node) {
  root = node
  const docs = await api('/api/docs')
  const search = el('input', { placeholder: 'search the manuals…', style: { width: '100%', marginBottom: '8px' } })
  const results = el('div')
  search.addEventListener('input', () => {
    clearTimeout(init._t)
    init._t = setTimeout(async () => {
      if (!search.value.trim()) { mount(results); return }
      const hits = await api(`/api/docs/search?q=${encodeURIComponent(search.value)}`)
      mount(results, hits.map((h) => el('div.card', { style: { cursor: 'pointer', marginBottom: '6px' }, onclick: () => show(h.doc) },
        el('div.quiet', { text: `${h.title} · line ${h.line}` }), el('div.mono', { text: h.text }))))
    }, 250)
  })
  mount(root, el('div.split', {},
    el('div', {}, search, results, el('div.list', {}, docs.map((d) => el('button', { 'data-id': d.id, disabled: !d.exists, onclick: () => show(d.id) }, d.title)))),
    el('div#doc')))
  await show(docs.find((d) => d.exists)?.id || docs[0].id)
}
