// AUDIT — every act on the Studio with who asked for it (alfred · claude · lacuna-for-…), newest first.
import { api, el, mount, ago } from './util.js'

let root, timer

async function refresh() {
  const rows = await api('/api/audit?limit=400')
  mount(root, el('table', {}, el('tr', {}, ['when', 'who', 'what', 'detail'].map((h) => el('th', { text: h }))),
    rows.map((r) => { const { t, who, action, ...rest } = r; return el('tr', {}, el('td', { text: ago(t) }), el('td.mono', { text: who }), el('td.mono', { text: action }), el('td.mono', { text: JSON.stringify(rest).slice(0, 260) })) })))
}
export async function init(node) { root = node; await refresh() }
export function enter() { clearInterval(timer); timer = setInterval(refresh, 8000) }
export function leave() { clearInterval(timer) }
