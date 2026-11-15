// maker-rules.mjs — THE MAKER'S RULES (lane C13; shared with X1, the Factory; LACUNA-CARDS-2.0 §6.16, §6.21). It lives in
// lacuna-foreman/ because the foreman's done-check imports it under foreman.sb, which reads this folder and never changes
// (law 4; L3-R1 settled by the lead, 2026-10-25); the desk imports it through lacuna-home/src/arcade/maker.js. Owns: the
// done-check's rules for a thing a maker wrote to run in the sandbox (files: an entry page, regular files only, relative
// paths; the kit: it starts from /lib/kit.js; size ≤ 2 MB; no network; it stays in its pane), the fold of a sitting's
// signals into the runtime rules (loads, 60 frames, no console error, no network), the rail that joins the run's
// recorded check with what this sitting saw, and the maker's brief (the owner's words, the maker, the files, the rules).
// Refuses: the DOM and the network (pure functions: the foreman's done-check imports this file under Node, the card under
// Vite); naming a card (the card passes its words); writing `pass` (law 6: the done-check records, this file only judges);
// a file it cannot read (a file with no text fails "no network": fail closed). Implements: CARDS-2.0 §6.16 (the done-check:
// loads in the sandbox · 60 frames · no console error · ≤ 2 MB · no network · cover painted), §6.21 (one maker module).
// X1 adds the product half (§6.21): the bundle's rules (code, manuals, hashes, paths, no secret file), the L2 exam's fold
// over fixtures, `mayBundle` (no bundle without a passed exam) and the road's chips; the same refusals hold.
// Invariants (design §18): "a claim is not a record" (`source: 'here'` rows are marked as seen, never as recorded);
// "agent-written code never reaches the network or the desk's origin". Faults (§16): none raised; a broken rule is a row.

/** The rules' numbers (the drawing's done-check). */
export const RULES = Object.freeze({ maxBytes: 2 * 1024 * 1024, frames: 60, entry: 'index.html', kit: '/lib/kit.js' })

/** The rail's chips in the drawing's order: id, words, and whether the files or the sitting decide it. */
export const RAIL = Object.freeze([
  ['files', 'its files', 'files'], ['kit', 'starts from the kit', 'files'], ['size', '≤ 2 MB', 'files'],
  ['network', 'no network', 'files'], ['pane', 'stays in its pane', 'files'], ['loads', 'loads in the sandbox', 'sitting'],
  ['frames', '60 frames', 'sitting'], ['console', 'no console error', 'sitting'], ['cover', 'cover painted', 'record'],
])

/** What reaches the network, in source text. The origin's `connect-src 'none'` is the wall; this is the check. */
export const NETWORK = Object.freeze([
  [/\bfetch\s*\(/, 'fetch'], [/\bXMLHttpRequest\b/, 'XMLHttpRequest'], [/\bWebSocket\b/, 'WebSocket'],
  [/\bEventSource\b/, 'EventSource'], [/\bsendBeacon\b/, 'sendBeacon'], [/\bRTCPeerConnection\b/, 'RTCPeerConnection'],
  [/\bimportScripts\b/, 'importScripts'], [/\bnew\s+(?:Shared)?Worker\b/, 'a worker'],
  [/(?:src|href|action)\s*=\s*["']?\s*(?:https?:)?\/\//i, 'an outside address'],
  [/(?:\bfrom\s+|\bimport\s*\(?\s*)["'](?:https?:)?\/\//, 'an outside import'], [/url\(\s*["']?(?:https?:)?\/\//i, 'an outside url()'],
])

/** What leaves the pane or hides what it runs. */
export const ESCAPES = Object.freeze([
  [/\beval\s*\(/, 'eval'], [/\bnew\s+Function\b|\bFunction\s*\(/, 'Function'], [/\bimport\s*\(/, 'a dynamic import'],
  [/\b(?:window|globalThis|self|top|parent)\s*\[/, 'a computed global'], [/\b(?:top|parent|opener)\s*\.\s*(?:location|document)\b/, 'the parent page'],
  [/\b(?:window\.)?open\s*\(\s*["'`]/, 'window.open'], [/\blocation\s*(?:\.\s*(?:href|assign|replace)\s*)?=(?!=)/, 'a navigation'],
  [/\bdocument\s*\.\s*cookie\b/, 'a cookie'], [/\b(?:localStorage|sessionStorage|indexedDB)\b/, 'storage'],
])

const TEXT = /\.(?:html?|m?js|css|json|txt|svg|slat|md)$/i

/**
 * One row of a rule.
 * @param {string} rule @param {boolean} ok @param {string=} why
 * @return {{rule: string, ok: boolean, why: string}}
 */
const row = (rule, ok, why = '') => ({ rule, ok, why })

/**
 * The scan of one rule table over the text files; the first hit names the file and the reach.
 * @param {!Array<{path: string, text: (string|undefined)}>} files
 * @param {!ReadonlyArray} table
 * @return {?string}
 */
function firstHit(files, table) {
  for (const f of files) {
    if (!TEXT.test(f.path)) continue
    if (typeof f.text !== 'string') return `${f.path}: no text to read`
    for (const [re, what] of table) if (re.test(f.text)) return `${what} in ${f.path}`
  }
  return null
}

/**
 * The files rules of the done-check, judged on what the maker wrote.
 * @param {!Array<{path: string, bytes: number, kind: (string|undefined), text: (string|undefined)}>} files every entry
 *     under the thing's folder: `kind` is file, dir or symlink (lstat); text files carry their text
 * @param {!Object=} rules RULES or a card's own
 * @return {{ok: boolean, rows: !Array<{rule: string, ok: boolean, why: string}>}}
 */
export function checkFiles(files, rules = RULES) {
  const list = Array.isArray(files) ? files : []
  const plain = list.filter((f) => (f.kind || 'file') === 'file')
  const odd = list.find((f) => f.kind && f.kind !== 'file' && f.kind !== 'dir')
  const bad = list.find((f) => typeof f.path !== 'string' || f.path.startsWith('/') || f.path.split('/').includes('..') || f.path.includes('\\'))
  const entry = plain.some((f) => f.path === rules.entry)
  const filesWhy = odd ? `${odd.path} is a ${odd.kind}, not a file` : bad ? `${String(bad.path)} leaves the folder`
    : entry ? '' : `no ${rules.entry}`
  const scripts = plain.filter((f) => /\.m?js$/i.test(f.path) && typeof f.text === 'string')
  const kitRe = new RegExp(`from\\s+["']${rules.kit.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}["']`)
  const kit = scripts.some((f) => kitRe.test(f.text) && /\bstart\s*\(/.test(f.text))
  const bytes = plain.reduce((n, f) => n + (Number(f.bytes) || 0), 0)
  const mb = (n) => `${(n / 1048576).toFixed(1)} MB`
  const net = firstHit(plain, NETWORK)
  const esc = firstHit(plain, ESCAPES)
  const rows = [
    row('files', !filesWhy, filesWhy),
    row('kit', kit, kit ? '' : `no script imports ${rules.kit} and calls start()`),
    row('size', bytes <= rules.maxBytes, `${mb(bytes)} of ${mb(rules.maxBytes)}`),
    row('network', !net, net || ''),
    row('pane', !esc, esc || ''),
  ]
  return { ok: rows.every((r) => r.ok), rows }
}

/**
 * The runtime rules from one sitting's signals (arcade/kit.js posts them; the pane forwards only its own).
 * @param {!Array<{kind: string, n: (number|undefined), what: (string|undefined)}>} signals in arrival order
 * @param {!Object=} rules
 *     done: an error stopped the game, or every rule is answered
 * @return {{ok: boolean, done: boolean, rows: !Array<{rule: string, ok: ?boolean, why: string}>, score: ?number}}
 */
export function foldSitting(signals, rules = RULES) {
  const s = Array.isArray(signals) ? signals : []
  const ready = s.some((x) => x.kind === 'ready')
  const framed = s.find((x) => x.kind === 'frames' && x.n >= rules.frames)
  const err = s.find((x) => x.kind === 'error')
  const net = s.find((x) => x.kind === 'network')
  const scores = s.filter((x) => x.kind === 'score' && Number.isFinite(x.n))
  const rows = [
    { rule: 'loads', ok: ready ? true : err ? false : null, why: ready ? '' : err ? err.what || 'an error before ready' : 'not yet' },
    { rule: 'frames', ok: framed ? true : err ? false : null, why: framed ? `${framed.n} frames` : err ? 'stopped by an error' : 'counting' },
    { rule: 'console', ok: err ? false : framed ? true : null, why: err ? err.what || 'an error' : '' },
    { rule: 'network', ok: net ? false : framed ? true : null, why: net ? `${net.what || 'a reach'} refused` : '' },
  ]
  return { ok: rows.every((r) => r.ok === true), done: !!err || rows.every((r) => r.ok !== null), rows,
    score: scores.length ? scores[scores.length - 1].n : null }
}

/**
 * The rail: one chip per rule. A rule the run's check recorded shows the record; a rule this sitting saw and the record
 * lacks shows what was seen, marked `here`; anything else is unread.
 * @param {{recorded: (?{rows: Array<{rule: string, ok: boolean, why: (string|undefined)}>}|undefined),
 *     sitting: (?{rows: Array<{rule: string, ok: ?boolean, why: string}>}|undefined),
 *     cover: (?string|undefined)}} o the shelf item's check, foldSitting's answer, the cover's file
 * @return {!Array<{id: string, words: string, state: string, why: string, source: string}>} state: pass · fail · unread
 */
export function checkRail({ recorded = null, sitting = null, cover = null } = {}) {
  const rec = new Map((recorded?.rows || []).map((r) => [r.rule, r]))
  const here = new Map((sitting?.rows || []).map((r) => [r.rule, r]))
  return RAIL.map(([id, words, by]) => {
    if (id === 'cover' && !rec.has('cover')) {
      return { id, words, state: cover ? 'pass' : 'unread', why: cover ? '' : 'no cover painted', source: cover ? 'record' : 'none' }
    }
    const r = rec.get(id)
    if (r) return { id, words, state: r.ok ? 'pass' : 'fail', why: r.why || '', source: 'record' }
    const h = by === 'sitting' || id === 'network' ? here.get(id) : null
    if (h && h.ok !== null) return { id, words, state: h.ok ? 'pass' : 'fail', why: h.why || '', source: 'here' }
    return { id, words, state: 'unread', why: by === 'sitting' ? 'not played here' : 'not recorded', source: 'none' }
  })
}

/**
 * The maker's brief: what a maker run takes (a new run each time; refining sends the same thing with the files).
 * @param {{noun: string, words: string, maker: string, files: (Array<string>|undefined), rules: (Object|undefined)}} o
 *     the card's noun (game, product), the owner's words, the maker (12b · 26b · claude), the files to refine
 * @return {{noun: string, words: string, maker: string, files: !Array<string>, kit: string, rules: !Object, refine: boolean}}
 * @throws {Error} on no words or no maker
 */
export function makerBrief({ noun, words, maker, files = [], rules = RULES }) {
  const w = String(words || '').trim()
  if (!w) throw new Error(`a maker takes words: say the ${noun || 'thing'} you want`)
  if (!maker) throw new Error('pick a maker')
  return { noun: String(noun || 'thing'), words: w.slice(0, 2000), maker: String(maker), files: files.map(String),
    kit: rules.kit, rules: { maxBytes: rules.maxBytes, frames: rules.frames, entry: rules.entry }, refine: files.length > 0 }
}

/** The five parts of a bundle (BUNDLE-1.0; R10's words): id and the words on the glass. */
export const PARTS = Object.freeze([['code', 'code'], ['agents', 'agents'], ['weights', 'weights'], ['playbooks', 'playbooks'], ['manuals', 'manuals']])

/** The exam's gate for a product: level L2 or above, 90 percent of the fixtures (the standing bar, MINDS §7). */
export const EXAM = Object.freeze({ level: 2, bar: 90 })

/** The road of a product, in the drawing's order (§6.21). */
export const ROAD = Object.freeze([
  ['ask', 'ask'], ['plan', 'plan with an estimate'], ['parts', "the Studio's parts"], ['write', 'write'],
  ['exam', 'the exam on fixtures'], ['bundle', 'bundle'], ['press', 'the press'], ['shelf', 'the shelf'],
])

const SHA = /^[0-9a-f]{64}$/
const SECRET = /(?:^|\/)(?:\.env[^/]*|id_(?:rsa|ed25519)|secrets?|tokens?|pins?)(?:\/|\.|$)|\.(?:pem|key|p12)$/i

/**
 * The bundle rules, judged on the parts the record lists.
 * @param {?{parts: (Object<string, Array<{path: string, sha256: string, bytes: number}>>|undefined)}} bundle
 * @return {{ok: boolean, rows: !Array<{rule: string, ok: boolean, why: string}>}} no bundle fails closed
 */
export function checkBundle(bundle) {
  const parts = bundle && typeof bundle === 'object' && bundle.parts && typeof bundle.parts === 'object' ? bundle.parts : null
  if (!parts) return { ok: false, rows: [row('bundle', false, 'no bundle listed')] }
  const all = PARTS.flatMap(([id]) => (Array.isArray(parts[id]) ? parts[id] : []).map((f) => ({ ...f, part: id })))
  const n = (id) => (Array.isArray(parts[id]) ? parts[id].length : 0)
  const unhashed = all.find((f) => !SHA.test(String(f.sha256 || '')))
  const bad = all.find((f) => typeof f.path !== 'string' || f.path.startsWith('/') || f.path.split('/').includes('..') || f.path.includes('\\'))
  const secret = all.find((f) => SECRET.test(String(f.path || '')))
  const rows = [
    row('code', n('code') > 0, n('code') ? '' : 'no code listed'),
    row('manuals', n('manuals') > 0, n('manuals') ? '' : 'no manual listed'),
    row('hashes', !unhashed, unhashed ? `${unhashed.part}: ${String(unhashed.path)} has no sha256` : ''),
    row('paths', !bad, bad ? `${String(bad.path)} leaves the bundle` : ''),
    row('secrets', !secret, secret ? `${secret.path} names a key` : ''),
  ]
  return { ok: rows.every((r) => r.ok), rows }
}

/**
 * The exam's fold over the recorded fixtures. The record decides; this only counts (law 6).
 * @param {?{level: (number|string|undefined), fixtures: (Array<{id: string, ok: boolean, why: (string|undefined)}>|undefined)}} exam
 *     `level` is 2 or 'L2'
 * @param {!Object=} gate EXAM or a card's own
 * @return {{ok: boolean, level: ?number, n: number, passed: number, pct: ?number, why: string}} no exam, no fixtures or a
 *     level under the gate fails closed
 */
export function foldExam(exam, gate = EXAM) {
  const fx = Array.isArray(exam?.fixtures) ? exam.fixtures : []
  const level = Number.parseInt(String(exam?.level ?? '').replace(/^L/i, ''), 10)
  const passed = fx.filter((f) => f && f.ok === true).length
  const pct = fx.length ? (passed / fx.length) * 100 : null
  const first = fx.find((f) => f && f.ok !== true)
  let why = ''
  if (!exam) why = 'not sat'
  else if (!Number.isFinite(level) || level < gate.level) why = `sat at ${Number.isFinite(level) ? `L${level}` : 'no level'}, needs L${gate.level}`
  else if (!fx.length) why = 'no fixtures'
  else if (pct < gate.bar) why = `${passed} of ${fx.length} fixtures${first ? `; ${first.id}${first.why ? `: ${first.why}` : ''}` : ''}`
  return { ok: !why, level: Number.isFinite(level) ? level : null, n: fx.length, passed, pct, why }
}

/**
 * Whether a product may be bundled: its exam passed and its bundle rules hold. Fail closed.
 * @param {?Object} product a shelf row
 * @return {{ok: boolean, why: string}}
 */
export function mayBundle(product) {
  if (!product) return { ok: false, why: 'pick a product' }
  if (product.state === 'making') return { ok: false, why: 'it is being made' }
  const exam = foldExam(product.exam)
  if (!exam.ok) return { ok: false, why: `its exam: ${exam.why}` }
  const bad = checkBundle(product.bundle).rows.find((r) => !r.ok)
  if (bad) return { ok: false, why: `its bundle: ${bad.why || bad.rule}` }
  return { ok: true, why: '' }
}

/**
 * The road's chips from the contract's step rows; a step with no row is unread (no region without a record).
 * @param {?Array<{step: string, state: string, why: (string|undefined)}>} road
 * @param {?Object} exam the product's recorded exam, folded into the exam chip's words
 * @return {!Array<{id: string, words: string, state: string, why: string}>} state: done · running · waiting · failed · unread
 */
export function roadChips(road, exam = null) {
  const by = new Map((Array.isArray(road) ? road : []).map((r) => [r?.step, r]))
  return ROAD.map(([id, words]) => {
    const r = by.get(id)
    const state = r && ['done', 'running', 'waiting', 'failed'].includes(r.state) ? r.state : 'unread'
    let why = r?.why || (r ? '' : 'not recorded')
    if (id === 'exam' && exam) { const f = foldExam(exam); why = f.ok ? `L${f.level} · ${f.passed} of ${f.n} fixtures` : f.why }
    return { id, words, state, why: String(why).slice(0, 120) }
  })
}
