// hour.mjs — THE FIXTURE HOUR (lane F5-BC test fixture; A3 §9 "lane A's recorded hour" until F5-A records one). Owns: one
// deterministic hour of `(ev …)` objects built from the seed (no wall clock, no Math.random): the foreman's beats, the box's
// coast, ten services probed, five minds loaded with desk turns and 250 ms slot samples, thirty runs with steps, tickets,
// sentries, checks and verdicts, passes, a failure, a crash, a stall, a kick, presses, work orders, a visitor, a cloud call,
// a commit, cortex and forge rows, alerts raised, acked and resolved, a stale producer and its return, and one event of every
// catalog kind that the story does not produce. About 1.6 events a second. Refuses: a token, a key, a PIN, a secret; a
// kind outside the catalog.
import { draw } from '../../seed.js'
import { readCatalog } from './catalog.mjs'
import { sampleEvent, EPOCH } from './sample.mjs'

export { EPOCH }
const MINDS = ['e4b', 'e2b', '12b', '1b', '270m']
const SERVICES = ['door', 'foreman', 'hands', 'lme', 'brain', 'gateway', 'ollama', 'library', 'caddy', 'api']
const OPS = ['tail-log', 'read-file', 'disk', 'git-status', 'write-file', 'recall', 'web-search']

/**
 * The hour's events, seq-ordered, t in ms from EPOCH.
 * @return {!Array<!Object>}
 */
export function hourEvents() {
  const out = []
  const push = (s, kind, actor, data = {}, o = {}) => out.push({ s, kind, actor, at: o.at ?? (/^(run|sentry|hands)\.|^mind\.turn\./.test(kind) ? `studio·foreman·${o.run ?? '-'}·1·${o.step ?? '-'}·-` : '-'), ref: o.ref ?? null, data })
  const u = (k, i = 0) => draw(0x5a1a0001 + k, i)
  for (let s = 0; s < 3600; s += 10) push(s, 'foreman.beat', 'foreman', { living: Math.min(8, Math.floor(u(1, s) * 4) + (s > 300 && s < 3000 ? 2 : 0)), 'lag-ms': Math.floor(u(2, s) * 6), 'rss-mb': 180 + Math.floor(u(3, s) * 40), drops: 0 })
  for (let s = 2; s < 3600; s += 15) push(s, 'box.coast', 'box', { level: s > 2400 && s < 2520 ? 'tight' : 'clear', 'free-pct': s > 2400 && s < 2520 ? 4.5 : 28 + Math.round(u(4, s) * 60) / 10, 'wired-mb': 9000 + Math.floor(u(5, s) * 400), 'avail-mb': 10000 + Math.floor(u(6, s) * 500) })
  for (let s = 5; s < 3600; s += 30) SERVICES.forEach((name, i) => push(s + i * 0.3, 'service.probe', name, { ms: 2 + Math.floor(u(7, s + i) * 20), up: !(name === 'library' && s > 1500 && s < 1560), pid: 1000 + i, 'rss-mb': 100 + i * 20, code: null }))
  SERVICES.forEach((name, i) => push(1 + i * 0.1, 'service.up', name, { pid: 1000 + i, 'rss-mb': 100 + i * 20, at: `:${1137 + i}`, ...(name === 'lme' ? { 'p99-ms': 50, 'rss-budget-mb': 8000 } : {}) }))
  push(1500.5, 'service.down', 'library', { 'was-pid': 1007, why: 'probe' })
  push(1560.5, 'service.up', 'library', { pid: 1017, 'rss-mb': 120, at: ':1144' })
  for (let s = 8; s < 3600; s += 10) push(s, 'cortex.ops', 'cortex', { n: Math.floor(u(8, s) * 80), 'per-s': Math.round(u(8, s) * 80) / 10, 'node-put': 2, 'edge-put': 30, seq: 948300 + s })
  MINDS.forEach((id, i) => { push(3 + i * 4, 'mind.load.start', id, { 'need-mb': 4900, 'available-mb': 9000, by: i === 0 ? 'owner' : 'broker' }); push(5 + i * 4, 'mind.load.done', id, { 'hot-mb': 4901, 'arena-mb': 1573, 'warm-ms': 96 }); push(5.2 + i * 4, 'mind.engine.up', id, { pid: 500 + i, 'uptime-s': 100, served: 0, failed: 0, restart: false }) })
  push(40, 'mind.load.refused', '26b', { 'need-mb': 14439, 'available-mb': 9120, why: 'not enough memory' })
  push(2000, 'mind.engine.down', '1b', { 'probe-ms': 3, code: 503 })
  push(2030, 'mind.engine.up', '1b', { pid: 504, 'uptime-s': 2, served: 0, failed: 0, restart: true })
  push(3000, 'mind.unload', '270m', { by: 'broker', phase: 'begin' })
  push(3001, 'mind.unload', '270m', { by: 'broker', phase: 'done', 'held-s': 2990 })
  for (let k = 0; k < 8; k++) {
    const s0 = 60 + k * 420
    push(s0, 'mind.turn.start', 'e4b', { who: 'owner', session: `eval:hour-${k}`, model: 'e4b', mode: 'desk' })
    push(s0 + 0.2, 'mind.turn.phase', 'e4b', { phase: 'read', tokens: 0, n: 1 })
    for (let i = 0; i < 12; i++) push(s0 + 0.25 + i * 0.25, 'mind.slot', 'e4b', { slot: 0, busy: true, 'n-decoded': 0, held: 1200, 'n-ctx': 32768, tps: 0 })
    push(s0 + 3.3, 'mind.turn.phase', 'e4b', { phase: 'think', tokens: 0, n: 1, tps: 40 })
    push(s0 + 6, 'mind.turn.phase', 'e4b', { phase: 'answer', tokens: 8, n: 1, tps: 70 })
    for (let i = 0; i < 60; i++) push(s0 + 6.25 + i * 0.25, 'mind.slot', 'e4b', { slot: 0, busy: true, 'n-decoded': 8 + i * 18, held: 1200 + i * 18, 'n-ctx': 32768, tps: 60 + Math.round(u(9, k * 100 + i) * 300) / 10 })
    for (let i = 1; i <= 15; i++) push(s0 + 7 + i, 'mind.turn.phase', 'e4b', { phase: 'answer', tokens: 8 + i * 72, n: 1, tps: 72 })
    push(s0 + 22, 'mind.turn.done', 'e4b', { ms: 22000, tokens: 1088, tps: 72, 'prefill-ms': 3100, prompt: 6801, reused: 3926, reason: 'eos', slot: 0 })
    push(s0 + 22.5, 'mind.slot', 'e4b', { slot: 0, busy: false, 'n-decoded': 0, held: 0, 'n-ctx': 32768, tps: 0 })
    push(s0 + 23, 'owner.present', 'owner', { screen: 'floor', via: 'desk' })
  }
  push(1300, 'mind.turn.start', 'e2b', { who: 'owner', session: 'eval:hour-fail', model: 'e2b', mode: 'desk' })
  push(1302, 'mind.turn.fail', 'e2b', { reason: 'grammar: an unexpected {', code: null, grammar: true })
  push(1310, 'alert.ack', 'alert:e2b:grammar', { by: 'owner' })
  for (let n = 0; n < 30; n++) {
    const id = `w-${(0x100000 + n * 7919).toString(16).slice(-6)}`
    const brain = MINDS[n % 3]
    const s0 = 20 + n * 110
    const plan = 4 + (n % 5)
    push(s0, 'wo.filed', `wo-${900000 + n}`, { for: 'engineer', goal: `job ${n}`, from: 'owner', eta: null }, { ref: `wo-${900000 + n}` })
    push(s0 + 1, 'run.filed', id, { key: `job-${n}`, cart: n % 4 === 0 ? 'backup' : null, goal: `job ${n}`, by: 'owner', desk: false, tier: n % 2 ? 'act' : 'watch', parent: null, plan, sentry: 'cart' }, { ref: id, run: id })
    push(s0 + 2, 'wo.state', `wo-${900000 + n}`, { state: 'running', run: id, result: null }, { ref: `wo-${900000 + n}` })
    push(s0 + 4, 'run.start', id, { brain, plan }, { ref: id, run: id })
    push(s0 + 5, 'sentry.attach', `sentry-${n % 2 ? '1b' : '270m'}:${id}`, { model: n % 2 ? '1b' : '270m', run: id, domain: null, mode: 'shadow', 'period-s': 10 }, { ref: id, run: id })
    for (let i = 1; i <= plan; i++) {
      const si = s0 + 6 + i * 9
      push(si, 'run.step', id, { n: i, status: 'done', text: `step ${i} ${OPS[(n + i) % OPS.length]}`, ticket: null }, { ref: id, run: id, step: i })
      push(si + 1, 'run.ticket.open', id, { op: OPS[(n + i) % OPS.length], kind: 'hand', 'deadline-s': 120, n: i, pressed: false, ticket: `${id}-hand-${i}` }, { ref: id, run: id, step: i })
      push(si + 1 + 0.5 + u(10, n * 50 + i) * 3, 'hands.receipt', id, { op: OPS[(n + i) % OPS.length], kind: 'hand', exit: 0, ms: 145 + Math.floor(u(11, n * 50 + i) * 900), rows: 12, files: i === plan ? 1 : 0, sha: null, 'args-sha': 'ab12cd34ef56', ticket: `${id}-hand-${i}` }, { ref: `${id}-hand-${i}`, run: id, step: i })
      push(si + 6, 'sentry.check', `sentry-${n % 2 ? '1b' : '270m'}:${id}`, { kind: ['provenance', 'ast', 'semantics'][i % 3], n: 3, by: n % 2 ? '1b' : 'regex', ms: 40 }, { ref: id, run: id })
      if (i === 2 && n % 6 === 1) push(si + 7, 'sentry.verdict', `sentry-${n % 2 ? '1b' : '270m'}:${id}`, { check: 'claim-without-receipt', action: 'note', detail: 'said done; no receipt this step', shadow: true, by: '1b' }, { ref: id, run: id })
      if (i === 3 && n % 10 === 3) push(si + 7, 'run.promise', id, { id: `p-${n}`, text: 'tests green by the deadline', 'deadline-s': 60, ticket: null }, { ref: id, run: id })
      if (i === 3 && n % 10 === 3) push(si + 70, 'run.kick', id, { promise: `p-${n}`, missed: 1, category: 'deadline', why: 'no progress', step: 3 }, { ref: id, run: id })
    }
    const end = s0 + 6 + plan * 9 + 12
    if (n % 7 === 2) { push(end, 'press.wait', id, { id: `p-${n}-press`, action: 'git-push', run: id, reason: 'an act' }, { ref: `p-${n}-press` }); push(end + 25, 'press.pressed', id, { id: `p-${n}-press`, answer: 'yes', by: 'owner' }, { ref: `p-${n}-press` }) }
    if (n % 9 === 4) push(end + 1, 'run.claim', id, { 'claims-done': true, chars: 40, receipt: null, text: 'done' }, { ref: id, run: id })
    if (n === 11) { push(end + 2, 'run.stall', id, { why: 'nothing pending', missed: 2, exit: null }, { ref: id, run: id }); push(end + 40, 'run.fail', id, { why: 'stalled: nothing pending for 40 s', exit: 99, step: plan }, { ref: id, run: id }); push(end + 90, 'alert.ack', `alert:${id}:exit-99`, { by: 'owner' }) }
    else if (n === 17) { push(end + 2, 'run.crash', id, { why: 'SIGSEGV in the hands', crashes: 1, grave: false, step: plan, poisoned: false }, { ref: id, run: id }); push(end + 3, 'foreman.restart', 'foreman', { id, n: 1, of: 3, from: 'checkpoint' }); push(end + 30, 'run.fail', id, { why: 'crashed twice', exit: 30, step: plan }, { ref: id, run: id }) }
    else if (n === 23) { push(end + 2, 'run.pause', id, { by: 'broker', park: true, for: '26b' }, { ref: id, run: id }); push(end + 60, 'run.resume', id, { by: 'broker', from: 'parked' }, { ref: id, run: id }); push(end + 80, 'run.pass', id, { 'checked-by': 'done-check', minutes: 2, rounds: 1, kicks: 0 }, { ref: id, run: id }) }
    else if (n === 29) push(end + 2, 'run.stop', id, { why: 'by the owner', by: 'owner' }, { ref: id, run: id })
    else push(end + 30, 'run.pass', id, { 'checked-by': 'done-check', minutes: Math.round((end - s0) / 6) / 10, rounds: 1, kicks: n % 10 === 3 ? 1 : 0 }, { ref: id, run: id })
    push(end + 32, 'sentry.detach', `sentry-${n % 2 ? '1b' : '270m'}:${id}`, { why: 'ended' }, { ref: id, run: id })
    push(end + 33, 'wo.state', `wo-${900000 + n}`, { state: n === 11 || n === 17 ? 'failed' : 'done', run: id, result: n === 11 ? 'stalled' : 'ok' }, { ref: `wo-${900000 + n}` })
    if (n % 5 === 0) push(s0 + 30, 'mind.read', brain, { from: ['library', 'web', 'cortex'][n % 3], what: 'the backup playbook', ms: 40 })
  }
  push(700, 'alert.raise', 'alert:box:disk-low', { key: 'disk-low', level: 'warn', title: 'disk under 15 GB', source: 'alerts', actor: 'box', fault: 'disk-low' })
  push(900, 'alert.ack', 'alert:box:disk-low', { by: 'owner' })
  push(1100, 'alert.resolve', 'alert:box:disk-low', { 'after-s': 400 })
  push(1800, 'alert.raise', 'alert:foreman:lag', { key: 'lag', level: 'crit', title: 'the foreman lags 900 ms', source: 'alerts', actor: 'foreman', fault: 'lag' })
  push(1830, 'alert.resolve', 'alert:foreman:lag', { 'after-s': 30 })
  push(2400, 'foreman.hush', 'foreman', { why: 'available 1,200 MB' })
  push(2520, 'foreman.calm', 'foreman', { was: 'available 1,200 MB', 'hushed-s': 120 })
  push(2600, 'floor.stale', 'floor', { producer: 'lme-breadcrumbs', 'period-s': 6, 'silent-s': 18, actors: ['12b'] })
  push(2640, 'floor.fresh', 'floor', { producer: 'lme-breadcrumbs', 'silent-s': 58 })
  push(300, 'visitor.join', 'visitor:k3m9x2ab', { name: 'Sam', device: 'ipad' })
  for (let k = 0; k < 5; k++) { push(320 + k * 90, 'visitor.turn', 'visitor:k3m9x2ab', { mind: 'e2b', phase: 'start', ms: null, ok: null }); push(324 + k * 90, 'visitor.turn', 'visitor:k3m9x2ab', { mind: 'e2b', phase: 'done', ms: 4000, ok: true }) }
  push(800, 'visitor.made', 'visitor:k3m9x2ab', { file: 'pong.html', bytes: 4000, tested: true, mind: 'e2b' })
  push(1400, 'visitor.leave', 'visitor:k3m9x2ab', { 'after-s': 600 })
  push(1000, 'cloud.call', 'cloud', { model: 'gemini-3.8-flash', kind: 'plan', in: 13138, out: 146, cached: 0, ok: true, secs: 9.3 })
  push(1200, 'claude.commit', 'claude', { sha: 'abcdef123456', subject: 'the fold lands', 'age-s': 30 })
  for (let s = 100; s < 1300; s += 60) push(s, 'forge.step', 'forge', { n: Math.floor((s - 100) / 60) * 10, total: 200, loss: Math.round((2.4 - (s - 100) / 1000) * 100) / 100, secs: 10, model: 'e2b', stage: 'train' })
  push(1320, 'forge.pause', 'forge', { job: 'job-1', by: 'broker', park: true })
  push(2900, 'owner.quiet', 'owner', { s: 200 })
  push(3100, 'box.disk', 'box', { 'free-gb': 19.2, pct: 6.4 })
  const catalog = readCatalog()
  const have = new Set(out.map((e) => e.kind))
  let extra = 0
  for (const kind of catalog.keys()) if (!have.has(kind) && !kind.startsWith('scene.') && kind !== 'box.down.begin' && kind !== 'box.down.end' && kind !== 'box.up') out.push({ ...sampleEvent(kind, catalog.get(kind), 0, 0), s: 3500 + extra++ * 0.5 })
  out.sort((a, b) => a.s - b.s)
  return out.map((e, i) => ({ seq: i + 1, t: EPOCH + Math.round(e.s * 1000), kind: e.kind, actor: e.actor, at: e.at, ref: e.ref, src: ['hour', i + 1], data: e.data }))
}
