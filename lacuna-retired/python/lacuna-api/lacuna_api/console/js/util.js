// Shared helpers — the API, an element builder, confirm dialogs, formatting.
// SAFE BY CONSTRUCTION: log lines and telemetry are untrusted text, so nothing here builds HTML from strings — every
// element is made with createElement and every piece of text goes in through textContent.
export async function api(path, opts = {}) {
  const res = await fetch(path, { ...opts, headers: { 'Content-Type': 'application/json', 'X-Lacuna-Who': 'alfred', ...(opts.headers || {}) } })
  let body = null
  try { body = await res.json() } catch { body = null }
  if (!res.ok) {
    const d = body && body.detail
    const err = new Error((d && (d.why || (typeof d === 'string' ? d : null))) || (body && body.why) || res.statusText)
    err.status = res.status; err.body = body
    throw err
  }
  return body
}
export const post = (path, data) => api(path, { method: 'POST', body: JSON.stringify(data || {}) })

/** el('div.card', {onclick}, child, 'text', …) — class names after dots; strings become text nodes. */
export function el(spec, attrs, ...kids) {
  const [head, ...classes] = String(spec).split('.')
  const [tag, id] = head.split('#')
  const node = document.createElement(tag || 'div')
  if (id) node.id = id
  if (classes.length) node.className = classes.join(' ')
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null }
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue
    if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v)
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v)
    else if (k === 'text') node.textContent = String(v)
    else node.setAttribute(k, v === true ? '' : String(v))
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue
    node.appendChild(kid instanceof Node ? kid : document.createTextNode(String(kid)))
  }
  return node
}
/** kv('label', value, 'label', value, …) — a two-column list of facts. */
export function kv(...pairs) { const box = el('div.kv'); for (let i = 0; i < pairs.length; i += 2) box.append(el('span', { text: pairs[i] }), el('span', { text: pairs[i + 1] ?? '—' })); return box }
export function mount(parent, ...kids) { parent.replaceChildren(...kids.flat(Infinity).filter(Boolean)); labelTables(parent); return parent }
// Each cell learns its column's name, so a phone can stack a table's rows and still say what each number is.
function labelTables(root) {
  for (const t of root.querySelectorAll('table')) {
    const head = t.querySelector('tr:has(> th)'); if (!head) continue
    const names = [...head.children].map((th) => th.textContent.trim())
    for (const tr of t.querySelectorAll('tr')) [...tr.children].forEach((td, i) => { if (td.tagName === 'TD' && names[i] && td.colSpan === 1) td.dataset.label = names[i] })
  }
}

export const ago = (t) => { if (!t) return '—'; const s = Math.max(0, Date.now() / 1000 - t); if (s < 60) return `${s | 0}s ago`; if (s < 3600) return `${(s / 60) | 0}m ago`; if (s < 86400) return `${(s / 3600) | 0}h ago`; return `${(s / 86400) | 0}d ago` }
export const time = (t) => new Date(t * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
export const gb = (b) => `${(b / 1e9).toFixed(1)} GB`
export const n = (x) => Number(x || 0).toLocaleString('en-US')

export function confirmAct(title, body) {
  const d = document.getElementById('confirm')
  document.getElementById('confirmTitle').textContent = title
  document.getElementById('confirmBody').textContent = body
  return new Promise((res) => { d.onclose = () => res(d.returnValue === 'yes'); d.returnValue = ''; d.showModal() })
}

export function toast(text, level = 'info') {
  const bar = document.getElementById('alertbar')
  bar.hidden = false
  bar.style.borderColor = level === 'error' ? '#7a3434' : level === 'ok' ? '#2f6f55' : '#2a2a2a'
  bar.style.background = level === 'error' ? '#2a1616' : level === 'ok' ? '#132a20' : '#1a1a1a'
  bar.textContent = text
  clearTimeout(toast._t); toast._t = setTimeout(() => { bar.hidden = true }, 7000)
}

/** A tiny, safe Markdown renderer (headings, lists, code, tables, bold/code spans) — DOM only, never HTML strings. */
export function markdown(text) {
  const root = el('div.doc')
  const lines = String(text || '').split('\n')
  let i = 0
  const inline = (s) => {
    const out = []
    let last = 0
    for (const m of String(s).matchAll(/(`[^`]+`|\*\*[^*]+\*\*)/g)) {
      if (m.index > last) out.push(s.slice(last, m.index))
      out.push(m[0].startsWith('`') ? el('code', { text: m[0].slice(1, -1) }) : el('b', { text: m[0].slice(2, -2) }))
      last = m.index + m[0].length
    }
    if (last < s.length) out.push(s.slice(last))
    return out
  }
  while (i < lines.length) {
    const l = lines[i]
    if (/^```/.test(l)) { const buf = []; i++; while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]); i++; root.append(el('pre', {}, el('code', { text: buf.join('\n') }))); continue }
    const hm = l.match(/^(#{1,4})\s+(.*)/)
    if (hm) { root.append(el(`h${Math.min(4, hm[1].length)}`, {}, inline(hm[2]))); i++; continue }
    if (/^\|/.test(l)) {
      const t = el('table'); let first = true
      while (i < lines.length && /^\|/.test(lines[i])) {
        const cells = lines[i].split('|').slice(1, -1).map((c) => c.trim())
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) t.append(el('tr', {}, cells.map((c) => el(first ? 'th' : 'td', {}, inline(c)))))
        first = false; i++
      }
      root.append(t); continue
    }
    if (/^\s*[-*·]\s+/.test(l)) { const ul = el('ul'); while (i < lines.length && /^\s*[-*·]\s+/.test(lines[i])) ul.append(el('li', {}, inline(lines[i++].replace(/^\s*[-*·]\s+/, '')))); root.append(ul); continue }
    if (/^\s*\d+\.\s+/.test(l)) { const ol = el('ol'); while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) ol.append(el('li', {}, inline(lines[i++].replace(/^\s*\d+\.\s+/, '')))); root.append(ol); continue }
    if (/^>\s?/.test(l)) { root.append(el('blockquote', {}, inline(l.replace(/^>\s?/, '')))); i++; continue }
    if (/^---+$/.test(l.trim())) { root.append(el('hr')); i++; continue }
    if (l.trim()) { const buf = [l]; i++; while (i < lines.length && lines[i].trim() && !/^(#|```|\||\s*[-*·]\s|\s*\d+\.\s|>)/.test(lines[i])) buf.push(lines[i++]); root.append(el('p', {}, inline(buf.join(' ')))); continue }
    i++
  }
  return root
}
