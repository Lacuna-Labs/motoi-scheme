// THE DOCK — Lacuna to talk to, on every tab, beside the work instead of over it.
//
// His (2026-09-25): "a nice interface to talk to the LLM… not a shitty one that covers the entire screen." So the
// conversation lives in a panel docked on the right (a sheet from the bottom on a phone), opened from the header and
// closed with Esc — the tab you were reading stays where it was. It streams: each tool the model calls appears as a
// step while it works (/api/chat/stream), and a PROPOSAL (anything on her side: QA, a promote, her iPad) arrives as a
// card with what it will do and Approve / Decline — it runs only on that tap (control/chat.py `decide`).
//
// Kept in this browser only (a viewer's convenience; the audit log is the record): the last 40 messages.
import { decide as ownerDecide } from './owner.js'
import { api, post, el, markdown, toast } from './util.js'

const KEY = 'lacuna.dock.v1'
const STARTERS = ['What is going on?', 'Do we have a new package?', 'Is QA healthy?', 'Any new errors in the last hour?']
const TOOL_WORDS = {
  packages: 'checking the package', list_services: 'reading the services', explain_service: 'reading why it will not start',
  health_check: 'reading the machine', error_summary: 'reading the error classes', search_logs: 'searching the logs',
  search_runbooks: 'reading the runbooks', list_versions: 'reading the versions', battery_and_jobs: 'reading the jobs',
  job_log: 'reading a job log', control_service: 'acting on a service', run_battery: 'starting the battery',
  run_tests: 'starting the tests', build_version: 'starting a build', deploy_simulator: 'building the simulator app',
  draft_script: 'drafting a script', petition: 'proposing an action for your yes',
  web_search: 'searching the web', read_page: 'reading a web page', watchdogs: 'reading the watchdogs', boot_report: 'reading the boot report',
  drills: 'reading the drills', run_checks: 'running the checks now', run_drill: 'running a drill on our side',
}
let panel, list, input, sendKey, busy = false, history = []

function save() { try { localStorage.setItem(KEY, JSON.stringify(history.slice(-40))) } catch { /* private mode: this session only */ } }
function load() { try { history = JSON.parse(localStorage.getItem(KEY) || '[]') } catch { history = [] } }
// THE CONVERSATION IS ON THE CONSOLE (2026-09-26): the last page comes from /api/chat/history — the same turns from the
// phone, the desktop and the CLI — and "earlier" pages load as he scrolls up, so nothing blows up on a long history.
let oldest = null, more = false, loadingMore = false
const asMsg = (t) => (t.role === 'user' ? { who: 'me', text: t.content.replace(/^\[[^\]]*\]\s*/, ''), t: t.t } : { who: 'lacuna', text: t.content, t: t.t })
async function loadPage(before) {
  const r = await api(`/api/chat/history?limit=30${before ? `&before=${before}` : ''}`)
  const turns = (r.turns || []).map(asMsg)
  if (turns.length) oldest = r.turns[0].t
  more = !!r.more
  return turns
}
async function loadEarlier() {
  if (!more || loadingMore || !oldest) return
  loadingMore = true
  const keepH = list.scrollHeight, keepTop = list.scrollTop
  try { const turns = await loadPage(oldest); history = [...turns, ...history]; render(false); list.scrollTop = list.scrollHeight - keepH + keepTop }
  finally { loadingMore = false }
}
export function scrollToEnd() { requestAnimationFrame(() => { if (list) list.scrollTop = list.scrollHeight }) }

// THE PEEK (his, 2026-09-26: "give a peek into what it's saying… then I can ask it about what it was thinking"): the
// thinking the model did before an answer is kept with the answer, and it is OPEN by default — smaller, gray,
// indented, in the same face as the live thinking above it (his, later that day: "I want to read what it's going
// through… make it smaller text, indented or gray"). He can fold it; it never hides on its own.
function peek(thinking, open = true) {
  if (!thinking) return null
  const d = el('details.dk-peek', open ? { open: '' } : {})
  d.append(el('summary', { text: 'what I was thinking' }), el('div.dk-peek-text', { text: thinking }))
  return d
}

function bubble(m) {
  if (m.who === 'me') return el('div.dk-msg.dk-me', { text: m.text })
  const body = el('div.dk-text')
  body.append(markdown(m.text || ''))
  return el('div.dk-msg.dk-lacuna', {}, peek(m.thinking), body, m.meta ? el('div.dk-meta', { text: m.meta }) : null)
}

function stepChip(st) {
  return el(`div.dk-step${st.ok === false ? '.dk-step-no' : ''}`, {}, el('span.dk-dot'), TOOL_WORDS[st.tool] || st.tool)
}

function proposalCard(st) {
  const card = el('div.dk-card', {},
    el('div.dk-card-k', { text: 'Waiting for your yes' }),
    el('div.dk-card-t', { text: st.effect || 'an action on the customer\'s side' }))
  const row = el('div.dk-card-row')
  const decide = async (approve) => {
    row.replaceChildren(el('span.quiet', { text: approve ? 'Running…' : 'Declined.' }))
    try {
      const r = await ownerDecide(st.petition, approve)
      if (approve) row.replaceChildren(el('span', { text: r.ok ? 'Approved — it is running. Its progress is in Control › Jobs.' : (r.why || 'It did not run.') }))
    } catch (e) { row.replaceChildren(el('span.dk-err', { text: e.message })) }
  }
  row.append(el('button.danger', { onclick: () => decide(true) }, 'Approve'), el('button', { onclick: () => decide(false) }, 'Decline'))
  card.append(row)
  return card
}

function render(toEnd = true) {
  list.replaceChildren(more ? el('button.dk-earlier', { onclick: loadEarlier }, 'earlier…') : null, ...history.map(bubble))
  if (!history.length) {
    list.append(el('div.dk-hello', {},
      el('p', { text: 'Evening. Ask me anything; the services, the logs and the releases are a tool call away.' }),
      el('div.dk-starters', {}, STARTERS.map((s) => el('button', { onclick: () => ask(s) }, s)))))
  }
  // the conversation opens at its END — the last thing said — never at the top (his, 2026-09-26)
  if (toEnd) { list.scrollTop = list.scrollHeight; scrollToEnd() }
}

async function ask(text) {
  text = (text || '').trim()
  if (!text || busy) return
  busy = true; sendKey.disabled = true; input.value = ''
  history.push({ who: 'me', text }); save(); render()
  const live = el('div.dk-live')
  // THE TYPING SIGNAL IS THE MODEL WORKING (his: "make it a real signal that it's doing something… if it's not, don't").
  // Nothing here animates on a timer: the status line changes only when an event arrives — the mode, a tool step, a
  // thinking token, an answer token — and the words appear as the model makes them, rendered as they come.
  const status = el('div.dk-status', {}, el('span.dk-pulse'), el('span.dk-status-t', { text: 'reaching the model…' }))
  const think = el('div.dk-think', { hidden: '' }, el('div.dk-think-k', { text: 'thinking' }), el('div.dk-think-t'))
  const draft = el('div.dk-msg.dk-lacuna.dk-draft', { hidden: '' }, el('div.dk-text'))
  live.append(status, think, draft)
  list.append(live); list.scrollTop = list.scrollHeight
  const t0 = Date.now()
  let answerText = '', thinkText = '', mode = 'fast', renderQueued = false
  const say = (t) => { status.querySelector('.dk-status-t').textContent = t }
  const paint = () => { if (renderQueued) return; renderQueued = true; requestAnimationFrame(() => { renderQueued = false; draft.querySelector('.dk-text').replaceChildren(markdown(answerText)); list.scrollTop = list.scrollHeight }) }
  try {
    const res = await fetch('/api/chat/stream', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, session: 'dock' }), credentials: 'same-origin' })
    if (!res.ok || !res.body) throw new Error(`the console answered ${res.status}`)
    const reader = res.body.getReader(), dec = new TextDecoder()
    let buf = '', answer = null
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      let i
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const line = buf.slice(0, i).replace(/^data: /, ''); buf = buf.slice(i + 2)
        let ev; try { ev = JSON.parse(line) } catch { continue }
        if (ev.type === 'mode') { mode = ev.mode; say(mode === 'deep' ? 'thinking it through…' : 'looking…') }
        else if (ev.type === 'thinking') { thinkText += ev.text; think.hidden = false; think.querySelector('.dk-think-t').textContent = thinkText; think.scrollTop = think.scrollHeight; say('thinking…'); list.scrollTop = list.scrollHeight }
        else if (ev.type === 'token') { answerText += ev.text; draft.hidden = false; say('typing…'); paint() }
        else if (ev.type === 'step') {
          live.insertBefore(stepChip(ev), status)
          if (ev.tool === 'petition' && ev.petition) live.insertBefore(proposalCard(ev), status)
          say(TOOL_WORDS[ev.tool] || ev.tool); answerText = ''; draft.hidden = true
          list.scrollTop = list.scrollHeight
        } else if (ev.type === 'answer') answer = ev
      }
    }
    const steps = live.querySelectorAll('.dk-step').length
    const meta = `${((Date.now() - t0) / 1000).toFixed(1)} s · ${mode === 'deep' ? 'thought it through' : 'quick'}${steps ? ` · ${steps} step${steps > 1 ? 's' : ''}` : ''}${answer?.capped ? ' · stopped looking' : ''}`
    history.push({ who: 'lacuna', text: answer?.text || 'No answer came back.', meta, thinking: (answer?.thinking || thinkText || '').slice(0, 6000) }); save()
    // the steps and any card stay above the answer they led to; the live status, the thinking pane and the draft go
    status.remove(); think.remove(); draft.remove()
    const keep = live; render(); if (keep.childNodes.length) list.insertBefore(keep, list.lastChild)
  } catch (e) {
    // the truth, not a guess: a console that did not answer is one thing, a fault in this page is another
    const why = /Load failed|Failed to fetch|NetworkError|answered \d/.test(e.message) ? `the console did not answer (${e.message})` : `a fault in the page: ${e.message}`
    history.push({ who: 'lacuna', text: `That did not go through — ${why}. The audit will have my side if I answered.` }); save(); render()
    console.error('dock', e)
  } finally { busy = false; sendKey.disabled = false; input.focus() }
}

export function open(on = true) {
  if (!panel) return
  document.body.classList.toggle('dk-open', on)
  panel.setAttribute('aria-hidden', on ? 'false' : 'true')
  if (on) { render(); setTimeout(() => input.focus(), 60) }
}

/** build the conversation (list + composer) into `host`; `withHead` adds the dock's own title row */
function build(host, withHead) {
  load()
  const light = el('span.dk-light', { title: 'the model' })
  list = el('div.dk-list', { role: 'log', 'aria-live': 'polite' })
  input = el('textarea', { rows: 1, enterkeyhint: 'send', placeholder: 'Ask Lacuna…',
    oninput: () => { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 160)}px` },
    onkeydown: (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input.value) } if (e.key === 'Escape' && withHead) open(false) } })
  sendKey = el('button.go.dk-send', { onclick: () => ask(input.value), 'aria-label': 'Send' }, 'Send')
  if (withHead) {
    host.append(el('div.dk-head', {}, light, el('b', { text: 'Lacuna' }), el('span.dk-model', { text: '' }),
      el('button.dk-clear', { title: 'Start a new conversation', onclick: () => { history = []; save(); render() } }, 'New'),
      el('button.dk-x', { title: 'Close (Esc)', onclick: () => open(false) }, '×')))
  }
  host.append(list, el('div.dk-box', {}, input, sendKey))
  list.addEventListener('scroll', () => { if (list.scrollTop < 40) loadEarlier() })
  loadPage(null).then((turns) => { if (turns.length) { history = turns; save() } render() }).catch(() => { /* the kept copy stands */ })
  api('/api/chat/models').then((m) => {
    const md = host.querySelector('.dk-model'); if (md) md.textContent = m?.default || ''
    light.dataset.on = m && (m.available || []).includes(m.default) ? 'yes' : 'no'
  }).catch(() => { light.dataset.on = 'no' })
  render()
  return { light, clear: () => { history = []; save(); render() } }
}

/** the desktop: a panel docked on the right of every tab */
export async function init() {
  panel = el('aside.dock', { 'aria-label': 'Talk to Lacuna', 'aria-hidden': 'true' })
  document.body.append(panel)
  build(panel, true)
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('dk-open')) open(false) })
}

/** the phone: the same conversation as a whole page (the Ask tab) */
export function mountPage(host) { return build(host, false) }
export function focus() { scrollToEnd(); setTimeout(() => input?.focus(), 60) }
