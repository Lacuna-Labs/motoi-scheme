// sample.mjs — ONE PLAUSIBLE EVENT PER KIND (lane F5-BC test fixture). Owns: a synthetic `(ev …)` object for any catalog
// kind, with an actor id in A3 §3.2's form for the kind's record, `at` and `ref` where mandatory, and data typed by field
// name (counts and ms as integers, flags as booleans, the rest as short strings). Refuses: a token, a key, a PIN, a wall clock.
import { draw } from '../../seed.js'

/** 2026-10-30 11:00:00 UTC, an hour boundary. */
export const EPOCH = 1793386800000

const ACTOR = {
  mind: 'e4b', worker: 'w-5f0c6c', sentry: 'sentry-1b:w-5f0c6c', foreman: 'foreman', wo: 'wo-995779', service: 'door', alert: 'alert:w-5f0c6c:f-06',
  owner: 'owner', landmark: 'cortex', box: 'box', visitor: 'visitor:k3m9x2ab', giant: 'cloud', floor: 'floor', lacuna: 'lacuna',
}
const NUMBER = /(-mb|-ms|-s|-gb|-pct|-chars|-n|-min|^n$|^ms$|^s$|^pid$|^seq$|^total$|^step$|^tokens$|^held$|^in$|^out$|^cached$|^secs$|^loss$|^tps$|^code$|^exit$|^files$|^rows$|^bytes$|^layers$|^living$|^drops$|^queue$|^of$|^hits$|^count$|^crashes$|^missed$|^tries$|^slot$|^part$|^off$|^actors$|^level$|^weight$|^plan$|^pct$)/
const FLAG = /^(busy|cold|kept|up|ok|tested|grammar|restart|draining|clean|desk|pressed|hushed|park|grave|poisoned|claims-done|shadow|visitor|solid)$/
const WORD = { phase: 'answer', state: 'running', action: 'note', check: 'provenance', kind: 'provenance', reason: 'eos', level: 'warn', by: 'owner', who: 'owner', model: '1b', from: 'library', to: 'e2b', dir: 'out', mode: 'shadow', answer: 'yes', status: 'done', tier: 'watch', op: 'tail-log', why: 'ok', category: 'deadline', stage: 'train', producer: 'lme-log', name: 'night', text: 'step one', key: 'k', goal: 'fix a red watchdog', file: 'game.html', run: 'w-5f0c6c', id: 'p-1', promise: 'p-1', ticket: 'w-5f0c6c-hand-1', what: 'the backup playbook', device: 'ipad', screen: 'floor', via: 'desk', holder: 'e4b', sha: 'abcdef123456', subject: 'fix', path: '/api/x', target: 'e4b', for: 'engineer', domain: null, cart: null, parent: null, role: null, eta: null, result: null, brain: 'e4b', args: '-', source: 'alerts', title: 'disk under 15 GB', actor: 'w-5f0c6c', fault: 'f-06', ref: 'w-5f0c6c', thread: 't-1', mind: 'e2b', job: 'job-1', adapter: 'a', slot: 'stage', score: null, class: 'c', tool: 'tail-log', suffix: 'x' }

/**
 * One plausible event of `kind`.
 * @param {string} kind @param {!Object} row the catalog row @param {number} seq @param {number} t ms UTC
 * @return {!Object}
 */
export function sampleEvent(kind, row, seq, t) {
  const actor = kind.startsWith('press.') || kind.startsWith('hands.') ? ACTOR.worker : kind.startsWith('door.') ? 'door' : kind === 'cortex.ops' || kind === 'cortex.recall' ? 'cortex' : kind.startsWith('forge.') ? 'forge' : kind === 'claude.commit' || kind === 'claude.talk' || kind === 'claude.mail' ? 'claude' : kind.startsWith('sentry.mode') || kind.startsWith('sentry.ready') ? 'lacuna' : ACTOR[row.record] ?? 'floor'
  const data = {}
  let i = 0
  for (const f of row.fields) {
    i++
    if (NUMBER.test(f) && !(f in WORD)) data[f] = f === 'tps' || f === 'loss' ? Math.round(draw(seq, i) * 800) / 10 : f === 'level' ? 'clear' : Math.floor(draw(seq, i) * 1000) + 1
    else if (FLAG.test(f)) data[f] = draw(seq, i) < 0.8
    else if (f in WORD) data[f] = WORD[f]
    else data[f] = f
  }
  if (kind === 'box.coast') data.level = 'clear'
  if (kind === 'mind.slot') data.busy = true
  if (kind.startsWith('visitor.turn')) data.phase = 'start'
  if (kind === 'floor.stale') data.actors = ['e4b']
  if (kind === 'mind.swap') data.phase = 'begin'
  if (kind === 'mind.unload') data.phase = 'begin'
  if (kind === 'wo.state') data.state = 'running'
  const at = row.at ? 'studio·foreman·w-5f0c6c·1·1·-' : '-'
  const ref = row.ref ? (kind.startsWith('wo.') ? 'wo-995779' : kind.startsWith('press.') ? 'p-1' : 'w-5f0c6c') : null
  return { seq, t, kind, actor, at, ref, src: ['fixture', seq], data }
}
