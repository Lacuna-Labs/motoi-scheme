// TERMINAL — a real login shell on the Studio (the operator's; the model never gets one), xterm.js over /ws/terminal.
import { el, mount } from './util.js'

let root, term, fit, ws

function open() {
  if (ws && ws.readyState <= 1) return
  ws = new WebSocket(`ws://${location.host}/ws/terminal`)
  ws.binaryType = 'arraybuffer'
  ws.onopen = () => { fit.fit(); ws.send(JSON.stringify({ resize: true, rows: term.rows, cols: term.cols })); term.focus() }
  ws.onmessage = (e) => term.write(typeof e.data === 'string' ? e.data : new Uint8Array(e.data))
  ws.onclose = () => term.write('\r\n\x1b[90m[the shell closed — press any key for a new one]\x1b[0m\r\n')
}

export async function init(node) {
  root = node
  const box = el('div#term')
  mount(root, box)
  term = new window.Terminal({ fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', fontSize: 13, cursorBlink: true,
    theme: { background: '#000000', foreground: '#f2f2f2', cursor: '#b39cff' }, scrollback: 5000 })
  fit = new window.FitAddon.FitAddon()
  term.loadAddon(fit)
  term.open(box)
  term.onData((d) => { if (!ws || ws.readyState !== 1) { open(); return } ws.send(new TextEncoder().encode(d)) })
  window.addEventListener('resize', () => { if (root.classList.contains('on')) { fit.fit(); if (ws?.readyState === 1) ws.send(JSON.stringify({ resize: true, rows: term.rows, cols: term.cols })) } })
}
export function enter() { setTimeout(() => { fit.fit(); open(); term.focus() }, 50) }
