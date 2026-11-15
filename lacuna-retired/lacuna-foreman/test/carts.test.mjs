// carts.test.mjs — THE LANE C CARTS, EACH AS ITS EXAM UNIT (over 500 by reason: one replay test per curated exam unit in
// carts/units.json). Owns: one test per curated unit in carts/units.json, replaying its
// fixture under test/fixtures/carts/ through readCart and a real Supervisor with a mock host (the brain and Lacuna's reads are
// mocked; the cart and the foreman are real). Refuses: the live world, the brain, a mock of the cart under test. Implements:
// design §12.4 (the first five and the ranked next), §7.9 (exam units), architecture ch. 5. Invariants (§18): "If a step is done,
// then a ticket closed it"; "If a mind's gate is below 90% per class, then its verdicts are advice and no notice or kick came
// from it" (U-sentry). Faults (§16): F-02, F-09, F-11 (mail dedupe), F-15 (flood dedupe).
// coverage: cart.mjs — lines 100% branches 99.31% functions 100% · inventory.mjs — lines 98.33% branches 99.12% functions 97.83% (2026-10-24, the lane's files alone; every gap a todo)
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Supervisor } from '../supervisor.mjs'
import { readCart } from '../cart.mjs'
import { apply } from '../scheme.mjs'
import { FIELDS_3, headerFields } from '../inventory.mjs'
import { lintCarts } from '../carts/lint.mjs'
import { cartSweep } from '../cart-sentry.mjs'

const BOX = JSON.parse(readFileSync(new URL('./fixtures/box-minds.json', import.meta.url), 'utf8'))
const CARTS = new URL('../carts/', import.meta.url)
const UNITS = JSON.parse(readFileSync(new URL('units.json', CARTS), 'utf8'))
const fixture = (f) => JSON.parse(readFileSync(new URL(`./fixtures/carts/${f}`, import.meta.url), 'utf8'))
const program = (name) => readFileSync(new URL(`${name}.sks`, CARTS), 'utf8')

function host(answers = () => "(label 'unsure)") {
  let t = 1_792_800_000
  let n = 0
  const up = []
  return {
    up, key: 'test-key', tables: () => ({ tiers: null, box: BOX }), tick: (s) => { t += s }, now: () => t,
    id: () => `w${++n}`, save: () => {}, upstream: (kind, w, data) => up.push({ kind, data }),
    mind: async (req) => ({ text: answers(req), certainty: 1 }),
  }
}
const reports = (h, kind) => h.up.filter((u) => u.kind === 'report' && u.data.kind === kind).map((u) => u.data.data)
const ups = (h, kind) => h.up.filter((u) => u.kind === kind)
const alist = (pairs) => Object.fromEntries(pairs.map(([k, v]) => [k, v]))
/** Run a worker's timer of this verb once, as its interval would. */
const fire = (s, w, verb) => {
  const t = w.timers.find((x) => x.spec.verb === verb)
  s._metered(w, () => apply(t.fnRef, [], s._fuel(w)), verb)
}
// carts that wait on a kernel change before they read (mail C→K); each has its own todo test below
const WAITING = new Set([])
const settle = async (s) => { await s.settle(); await new Promise((r) => setTimeout(r, 2)) }

// spec: design §12.1 (the five 3.0 fields) · §12.4 · §7.9 (a curated unit per exam)
// class: W5 malformed (a committed cart missing a field) · L5 the header's shape
// technique: a sweep over every committed .sks file
// method: readCart and headerFields each; read the five fields and the unit
// sre: does every cart we ship carry a version, a restart type, deadlines, a contract and an exam?
test('every lane C cart reads under readCart, carries the five 3.0 fields, and names an exam with a curated unit', () => {
  const files = readdirSync(CARTS).filter((f) => f.endsWith('.sks') && !WAITING.has(f))
  assert.ok(files.length >= 5)
  for (const f of files) {
    const text = readFileSync(new URL(f, CARTS), 'utf8')
    const h = readCart(text, { box: BOX })
    assert.equal(`${h.name}.sks`, f)
    const fields = headerFields(text)
    for (const k of FIELDS_3) assert.ok(k in fields, `${f} has (${k} . …)`)
    assert.ok(Number.isInteger(fields.version), `${f} version is an integer`)
    assert.ok(['permanent', 'transient', 'temporary'].includes(fields.restart), `${f} restart type`)
    assert.ok(fields.contract && fields.contract.goal && fields.contract['done-check'], `${f} contract has goal and done-check`)
    assert.ok(UNITS[h.exam], `${f} exam ${h.exam} has a curated unit`)
  }
})

// spec: design §12.4 (steward) · §7.6 mail (one alert) · F-11 dedupe
// class: E2 intensity (12 consecutive failures park the errand) · B1 bounded alerts
// technique: fake clock: an hour of ticks with exit 75 injected
// method: fire the timer; read the reports, the alert count and the parked state
// sre: when an errand fails every 5 min, does the owner get one alert, not twelve?
test('U-steward: an hour of ticks, 12 consecutive exit 75 park the errand with one alert, a parked hour acts not, a failure is said once', () => {
  const h = host()
  const s = new Supervisor(h)
  const w = s.spawn({ name: 'forge-tender', program: program('forge-tender') })
  const acts = () => ups(h, 'act').length
  const hour = () => { h.tick(3600); fire(s, w, 'every') }
  assert.equal(acts(), 1)
  for (let i = 0; i < 11; i++) { s.send(w.id, 'act', { ok: false, op: 'forge', status: 75 }); hour() }
  assert.equal(acts(), 12)
  assert.equal(reports(h, 'alert').length, 0)
  s.send(w.id, 'act', { ok: false, op: 'forge', status: 75 })
  assert.equal(reports(h, 'alert').length, 1)
  assert.match(reports(h, 'alert')[0][0], /parked: 12 consecutive exit 75/)
  hour()
  assert.equal(acts(), 12, 'a parked hour issues no act')
  h.tick(6 * 3600)
  hour()
  assert.equal(acts(), 13, 'after the park, one try')
  s.send(w.id, 'act', { ok: false, op: 'forge', status: 2, why: 'boom' })
  hour()
  s.send(w.id, 'act', { ok: false, op: 'forge', status: 2, why: 'boom' })
  assert.equal(reports(h, 'alert').filter((a) => /status 2; boom/.test(a[0])).length, 1, 'the same failure is said once')
  assert.equal(w.kv.repeats, 1)
  hour()
  s.send(w.id, 'act', { ok: true, op: 'forge', status: 0 })
  assert.equal(w.kv.busy, 0)
  assert.equal(w.crashes.length, 0)
  assert.equal(w.state, 'running')
  s.stop(w.id, 'test over')
})

test('U-recall: an hour of ticks, 12 consecutive exit 75 park the reindex with one alert, a parked hour acts not, a failure is said once', () => {
  const h = host()
  const s = new Supervisor(h)
  const w = s.spawn({ name: 'recall-tender', program: program('recall-tender') })
  const acts = () => ups(h, 'act').length
  const hour = () => { h.tick(3600); fire(s, w, 'every') }
  assert.equal(acts(), 1)
  for (let i = 0; i < 11; i++) { s.send(w.id, 'act', { ok: false, op: 'cortex-reindex', status: 75 }); hour() }
  assert.equal(acts(), 12)
  assert.equal(reports(h, 'alert').length, 0)
  s.send(w.id, 'act', { ok: false, op: 'cortex-reindex', status: 75 })
  assert.equal(reports(h, 'alert').length, 1)
  assert.match(reports(h, 'alert')[0][0], /parked: 12 consecutive exit 75/)
  hour()
  assert.equal(acts(), 12, 'a parked hour issues no act')
  h.tick(6 * 3600)
  hour()
  assert.equal(acts(), 13, 'after the park, one try')
  s.send(w.id, 'act', { ok: false, op: 'cortex-reindex', status: 2, why: 'cortex busy' })
  hour()
  s.send(w.id, 'act', { ok: false, op: 'cortex-reindex', status: 2, why: 'cortex busy' })
  assert.equal(reports(h, 'alert').filter((a) => /status 2; cortex busy/.test(a[0])).length, 1, 'the same failure is said once')
  assert.equal(w.kv.repeats, 1)
  hour()
  s.send(w.id, 'act', { ok: true, op: 'cortex-reindex', status: 0 })
  assert.equal(w.kv.busy, 0)
  assert.equal(w.crashes.length, 0)
  assert.equal(w.state, 'running')
  s.stop(w.id, 'test over')
})

// spec: design §12.4 (triggers) · §7.2 (file under a key, once)
// class: E17 timers after restart (never doubled) · E10 a duplicate filing
// technique: fake clock over 24 h with 10 restarts
// method: read the file rows per trigger and per time
// sre: through ten foreman restarts, does a 6-hourly trigger still fire 4 times a day, not 40?
test('U-trig: ipad-6h files 4 times over 24 h through 10 restarts; at 03:00 once; a condition on its edge; a disabled trigger never', () => {
  const fx = fixture('triggers.json')
  const h = host()
  const t0 = h.now()
  const history = Object.fromEntries(fx.rows.map((r) => [r.id, t0 - r.last_ago]))
  const midnight = t0 - (t0 % 86400)
  const atToday = () => h.now() - (h.now() % 86400) + 3 * 3600
  history.nightly = t0 >= midnight + 3 * 3600 ? midnight + 3 * 3600 : midnight + 3 * 3600 - 86400   // it ran at its last 03:00
  let holds = false
  const rows = () => fx.rows.map((r) => alist([['id', r.id], ['cart', r.cart], ['enabled', r.enabled], ['every_s', r.every_s || 0],
    ['at_s', r.at ? atToday() : 0], ['holds', r.id === 'disk-low' ? holds : null], ['evidence', r.evidence || ''],
    ['last', history[r.id]]]))
  let s = new Supervisor(h)
  let w = s.spawn({ name: 'triggers', program: program('triggers') })
  const files = () => ups(h, 'filed').map((u) => u.data)
  for (let minute = 0, restarts = 0; minute <= 24 * 60; minute += 10) {
    if (minute > 0 && minute % 140 === 0 && restarts < 10) {        // a foreman restart: the checkpoint's memory comes back
      const kv = w.kv
      s.stop(w.id, 'restart')
      s = new Supervisor(h)
      w = s.spawn({ name: 'triggers', program: program('triggers'), kv })
      restarts++
    }
    holds = minute >= 600 && minute < 700 || minute >= 900               // true, false, true again: two edges
    s.send(w.id, 'hand', { ok: true, op: 'triggers', result: { rows: rows() } })
    for (const f of files()) if (history[f.trigger] < h.now() - 1) history[f.trigger] = h.now()   // the filing writes history
    h.tick(600)
  }
  const by = (id) => files().filter((f) => f.trigger === id)
  assert.equal(by('ipad-6h').length, 4)
  assert.deepEqual(by('ipad-6h').map((f) => f.cart), ['ipad-verify', 'ipad-verify', 'ipad-verify', 'ipad-verify'])
  assert.equal(new Set(by('ipad-6h').map((f) => f.key)).size, 4, 'one key per slot')
  assert.equal(by('nightly').length, 1)
  assert.equal(by('disk-low').length, 2)
  assert.equal(by('off').length, 0)
  assert.equal(w.crashes.length, 0)
  s.stop(w.id, 'test over')
})

// spec: design §12.4 · F-13 (seed last from history)
// class: E16 a stale checkpoint (blank memory at boot)
// technique: a boot with empty kv and a history
// method: load; read that nothing not due was filed
// sre: does a reboot fire every trigger at once (the F-13 morning)?
test('U-trig: a boot with blank memory seeds last from history and files nothing that is not due', () => {
  const h = host()
  const s = new Supervisor(h)
  const w = s.spawn({ name: 'triggers', program: program('triggers') })
  s.send(w.id, 'hand', { ok: true, op: 'triggers', result: { rows: [{ id: 'ipad-6h', cart: 'ipad-verify', enabled: true, every_s: 21600, last: h.now() - 60 }] } })
  assert.equal(ups(h, 'filed').length, 0)
  assert.deepEqual(w.kv.last, [['ipad-6h', h.now() - 60]])
  s.stop(w.id, 'test over')
})

// spec: design §9 (the line sentry; the gate; shadow, no notice) · F-15 · F-16
// class: the 90% gate invariant · B1 one verdict per body per hour
// technique: replay of the flood fixture
// method: run the cart over the replay; read verdicts, counts, actions and that no notice went up
// sre: in a log flood, does the sentry send hundreds of notices, or one typed verdict per body with a count?
test('U-sentry: the flood replay gives one typed verdict per body per hour with counts, every action advise, no notice', async () => {
  const fx = fixture('sentry-replay.json')
  const h = host(() => "(label 'real-error)")
  const s = new Supervisor(h)
  const w = s.spawn({ name: 'sentry-watch', program: program('sentry-watch') })
  const answerVotes = () => {
    for (let i = 0; i < 20; i++) {
      const pending = (w.pending || []).find((t) => t.op === 'knn')
      if (!pending) break
      const conf = /etsy/.test(pending.args[1]) ? 0.4 : 0.9
      s.send(w.id, 'hand', { ok: true, op: 'knn', ticket: pending.ticket, result: { mind: 'sentry', label: 'noise', confidence: conf } })
    }
  }
  const pass = (lines) => { s.send(w.id, 'hand', { ok: true, op: 'tail-log', result: { lines } }); answerVotes() }
  for (let i = 0; i < fx.repeat; i++) { pass([...fx.flood, ...fx.routine, ...(i === 0 ? fx.once : [])]); h.tick(60) }
  await settle(s)
  const verdicts = reports(h, 'verdict').map((d) => Object.fromEntries(d[0]))
  assert.equal(verdicts.length, 4)
  for (const v of verdicts) {
    for (const k of ['class', 'layer', 'confidence', 'evidence', 'action', 'shadow']) assert.ok(k in v, `verdict has ${k}`)
    assert.equal(v.action, 'advise')
    assert.equal(v.shadow, true)
    assert.equal(v.layer, 'knn')
  }
  // only the traceback meets a hard rule (the fence lines say ERROR but name no Error or Exception): a vote of noise there
  // becomes real-error; the fence bodies keep the vote's noise
  assert.deepEqual(verdicts.filter((v) => v.rule !== 'none').map((v) => v.class), ['real-error'])
  assert.deepEqual(verdicts.filter((v) => /^PRODUCTION FENCE/.test(v.evidence[0])).map((v) => v.class), ['noise', 'noise'])
  const counts = reports(h, 'counts').flatMap((d) => d[0].map((row) => Object.fromEntries(row)))
  assert.equal(Math.max(...counts.filter((c) => /api\.ebay/.test(c.body)).map((c) => c.count)), fx.repeat)
  assert.equal(reports(h, 'advice').length, 1, 'the unsure vote asked the Sentry once, as advice')
  assert.equal(w.kv.noise, fx.repeat * fx.routine.length)
  assert.equal(reports(h, 'alert').length + ups(h, 'ask').length, 0)
  h.tick(3601)                                                     // a new hour: the body is judged once more
  pass(fx.flood.slice(0, 1))
  assert.equal(reports(h, 'verdict').length, 5)
  s.stop(w.id, 'test over')
})

// spec: design §12.4 (backup) · law 4 (acts press-gated)
// class: E8 a deadline passed (a failed drill) · L3 (prune only after a passing drill)
// technique: replay of the bundles fixture with a failing drill
// method: run the cart; read the acts asked and that nothing was pruned on failure
// sre: can a backup cart delete old bundles when the restore drill failed?
test('U-backup: bundle, list, the restore drill, then prune to 3 hourly + 3 daily; a failed drill prunes nothing', async () => {
  const fx = fixture('bundles.json')
  const run = (verify) => {
    const h = host()
    const s = new Supervisor(h)
    const w = s.spawn({ name: 'backup', program: program('backup') })
    assert.equal(ups(h, 'act')[0].data.op, 'bundle')
    s.send(w.id, 'act', { ok: true, op: 'bundle', bundle: fx.bundles.at(-2) })
    s.send(w.id, 'hand', { ok: true, op: 'bundles', result: { bundles: fx.bundles.map((name) => ({ name })) } })
    const drill = ups(h, 'hand').find((u) => u.data.op === 'bundle-verify')
    assert.deepEqual(drill.data.args, ['lacuna-world-20261023-1500.bundle'])
    assert.equal(ups(h, 'act').length, 1, 'nothing is pruned before the drill')
    s.send(w.id, 'hand', { ok: true, op: 'bundle-verify', result: verify })
    return { h, s, w }
  }
  const good = run({ verified: true, heads: 3 })
  const prune = ups(good.h, 'act').find((u) => u.data.op === 'prune')
  const kept = fx.bundles.filter((n) => n.endsWith('.bundle') && !prune.data.args[0].includes(n))
  assert.deepEqual(kept, fx.keep)
  good.s.send(good.w.id, 'act', { ok: true, op: 'prune' })
  await settle(good.s)
  assert.match(reports(good.h, 'summary')[0][0], /20261023-1500.bundle made and verified; 5 kept, 15 pruned/)
  const bad = run({ verified: false, why: 'missing prerequisite commit' })
  await settle(bad.s)
  assert.equal(ups(bad.h, 'act').some((u) => u.data.op === 'prune'), false)
  assert.match(reports(bad.h, 'summary')[0][0], /stopped at the restore drill: .* did not verify \(missing prerequisite commit\); nothing was pruned/)
  assert.equal(bad.w.state, 'retired')
})

// spec: design §12.4 (cleanup) · §11 (never-safe paths)
// class: L3 an act without a press · M5 TCC-blocked and protected paths
// technique: replay of the cleanup tree fixture
// method: run the cart; read every candidate asked and the paths never touched
// sre: can the cleanup cart touch the live forge or a never-safe path?
test('U-clean: every candidate is asked, the never-safe and the live-forge paths are never touched, a near eval holds the run', async () => {
  const fx = fixture('cleanup-tree.json')
  const h = host(() => "(label 'unsure)")
  const s = new Supervisor(h)
  const w = s.spawn({ name: 'cleanup', program: program('cleanup') })
  s.send(w.id, 'hand', { ok: true, op: 'forge-runs', result: { live: fx.live, eval_near: false } })
  s.send(w.id, 'hand', { ok: true, op: 'disk', result: { disk: { free_pct: 9 }, files: fx.files, culprits: fx.culprits } })
  const asked = []
  for (let i = 0; i < 40; i++) {
    await settle(s)
    if (w.state !== 'running') break
    const ask = ups(h, 'ask')[asked.length]
    if (!ask) break
    const path = ask.data.what.match(/^Move (.*) · /)[1]
    asked.push(path)
    s.send(w.id, 'answer', { yes: !fx.never_safe.includes(path) })
    const act = ups(h, 'act').at(-1)
    if (act && act.data.args[0] === path && !act.answered) { act.answered = true; s.send(w.id, 'act', { ok: true, op: 'trash' }) }
  }
  await settle(s)
  const trashed = ups(h, 'act').map((u) => u.data.args[0])
  const candidates = fx.files.length + fx.culprits.filter((c) => c.gb >= 5).length
  assert.equal(asked.length, candidates - fx.under_live.length)
  for (const p of [...fx.never_safe, ...fx.under_live]) assert.equal(trashed.includes(p), false, `${p} untouched`)
  for (const p of fx.under_live) assert.equal(asked.includes(p), false, `${p} never asked`)
  assert.equal(reports(h, 'refused').length, 2)
  assert.equal(trashed.length, asked.length - fx.never_safe.length)
  assert.match(reports(h, 'summary')[0][0], /every candidate answered: 10 trashed, 5 kept, 2 refused/)
  const held = host()
  const s2 = new Supervisor(held)
  const w2 = s2.spawn({ name: 'cleanup', program: program('cleanup') })
  s2.send(w2.id, 'hand', { ok: true, op: 'forge-runs', result: { live: [], eval_near: true } })
  await settle(s2)
  assert.equal(ups(held, 'hand').some((u) => u.data.op === 'disk'), false)
  assert.match(reports(held, 'summary')[0][0], /held: an eval checkpoint is near/)
})

// spec: design §12.1 (condense and yes-no classes; judgment as an alist) · architecture ch. 5 §5.11
// class: W5 the header's shape
// technique: readCart over the committed ci-cd cart
// method: read judgment, minds and acts
// sre: does the ci-cd cart's header say exactly the minds and acts the design wrote?
test('ci-cd (architecture ch. 5 §5.11, verbatim) reads under readCart: condense and yes-no classes, judgment as an alist',
  () => {
    const h = readCart(program('ci-cd'), { box: BOX })
    assert.deepEqual(h.judgment, ['new-red', 'rollback'])
    assert.deepEqual(Object.keys(h.minds), ['triage', 'scribe', 'verdict'])
    assert.deepEqual(h.acts, ['pass', 'promote', 'build', 'install-ipad'])
  })

// spec: design §12.4 (ci-cd) · law 4 · law 10 (dev never reaches production)
// class: L3 an act without a press (a dry run touches nothing) · E10 a duplicate (one rerun of a flaky red)
// technique: replay: a dry run, a flaky red, a regression
// method: run the cart; read every act's answer, the reruns and the stop sentence
// sre: does a dry run of the release cart touch anything, and does a real regression stop it?
test('E-cicd: a dry run on dev answers every act and touches nothing; a flaky red reruns the pass once; a regression stops and says so', async () => {
  const run = (triage) => {
    const h = host((req) => (/release-note/.test(JSON.stringify(req)) ? '(summary "the gallery opens faster")' : `(label '${triage})`))
    const s = new Supervisor(h)
    const w = s.spawn({ name: 'ci-cd', program: program('ci-cd') })
    s.send(w.id, 'hand', { ok: true, op: 'release-board', result: { dev: { sha: 'b2' }, qa: { sha: 'a1' }, ipad: { sha: 'a1' } } })
    s.send(w.id, 'hand', { ok: true, op: 'git-log', result: { commits: ['gallery: open faster'] } })
    return { h, s, w }
  }
  const dry = run('flaky')
  await settle(dry.s)
  for (const op of ['pass', 'promote', 'build', 'install-ipad']) {
    assert.equal(ups(dry.h, 'act').at(-1).data.op, op)
    dry.s.send(dry.w.id, 'act', { ok: true, op, dry: true, would: `would ${op}` })
  }
  await settle(dry.s)
  assert.match(reports(dry.h, 'summary')[0][0], /dry run: every act answered what it would do; nothing was touched/)
  for (const [kind, expect] of [['flaky', /every red was flaky: the pass runs once more/], ['regression', /stopped at pass: 1 red, not flaky/]]) {
    const r = run(kind)
    await settle(r.s)
    r.s.send(r.w.id, 'act', { ok: true, op: 'pass', job: 'j1' })
    r.s.send(r.w.id, 'hand', { ok: true, op: 'job', result: { running: false, ok: false, lines: ['✗ gallery grid overlaps the title'] } })
    await settle(r.s)
    const said = [...reports(r.h, 'step'), ...reports(r.h, 'summary')].map((d) => d[0]).join(' | ')
    assert.match(said, expect)
    if (kind === 'flaky') assert.equal(ups(r.h, 'act').filter((u) => u.data.op === 'pass').length, 2)
  }
})

// spec: design §12.4 (cart-lint) · F-07
// class: F-07 the same fault named the same way each round
// technique: ten planted faults and a clean cart
// method: lint.mjs and the cart; read the faults by kind
// sre: does cart-lint find every planted fault and none on a clean cart? (prose-done: E14 §5 row 18, product-03)
test('U-lint: lint.mjs finds 11 planted faults, none on the clean cart; the cart reports each by kind', async () => {
  const d = new URL('./fixtures/lint/', import.meta.url).pathname
  const units = new Set(readFileSync(`${d}units.txt`, 'utf8').split('\n').filter(Boolean))
  const findings = lintCarts({ root: `${d}carts`, units, workersDir: `${d}workers`, index: readFileSync(`${d}INDEX.before.slat`, 'utf8') })
  assert.deepEqual(findings.map((f) => f.kind).sort(), ['dangling-exam', 'duplicate-handler', 'label-drift', 'missing-fields', 'no-exam',
    'no-touches', 'orphan-worker', 'prose-done', 'unbenched-class', 'unbumped-version', 'unused-verb'])
  const prose = findings.find((f) => f.kind === 'prose-done')
  assert.deepEqual([prose.cart, /the done-check is words \("one read"\)/.test(prose.says)], ['few-fields', true])
  assert.equal(findings.some((f) => f.cart === 'clean'), false)
  const h = host()
  const s = new Supervisor(h)
  const w = s.spawn({ name: 'cart-lint', program: program('cart-lint') })
  s.send(w.id, 'hand', { ok: true, op: 'cart-lint', result: { carts: 10, findings } })
  await settle(s)
  assert.equal(reports(h, 'fault').length, 11)
  assert.equal(w.state, 'retired')
  const h2 = host()
  const s2 = new Supervisor(h2)
  const w2 = s2.spawn({ name: 'cart-lint', program: program('cart-lint') })
  s2.send(w2.id, 'hand', { ok: true, op: 'cart-lint', result: { carts: 1, findings: [] } })
  await settle(s2)
  assert.equal(reports(h2, 'fault').length, 0)
})

// spec: design §12.4 (queue) · §7.2 (file once under a key)
// class: E10 a duplicate filing · E12 a reboot between
// technique: fake clock through a reboot
// method: read filed rows, the merge note and that off or busy files nothing
// sre: through a reboot, is the head of the queue filed exactly once?
test('U-queue: the head is filed once through a reboot; duplicate goals are named for a merge and never filed; off or busy files nothing', () => {
  const items = [
    { id: 'W36', kind: 'goal', goal: 'Sentry improvement plan: analyze failed cases and retrain the 270M', state: 'queued' },
    { id: 'W32', kind: 'goal', goal: 'Complete agent team designs', state: 'failed' },
    { id: 'W20', kind: 'goal', goal: 'Train 270M Sentry on W1 pairs', state: 'paused' },
    { id: 'W19', kind: 'goal', goal: 'Train 270M Sentry on W1 pairs', state: 'queued' },
    { id: 'W17', kind: 'goal', goal: 'Train 270M on W1 pairs again', state: 'queued' },
    { id: 'W40', kind: 'cart', ref: 'doc-drift', goal: 'paths our docs name that no longer exist', state: 'queued' },
  ]
  const h = host()
  let s = new Supervisor(h)
  let w = s.spawn({ name: 'queue', program: program('queue') })
  const read = (q) => s.send(w.id, 'hand', { ok: true, op: 'queue', result: q })
  read({ on: false, items })
  assert.equal(ups(h, 'filed').length, 0, 'an off queue files nothing')
  read({ on: true, running: 'W99', items })
  assert.equal(ups(h, 'filed').length, 0, 'a busy queue files nothing')
  read({ on: true, items })
  const kv = w.kv
  s.stop(w.id, 'reboot')
  s = new Supervisor(h)
  w = s.spawn({ name: 'queue', program: program('queue'), kv })
  read({ on: true, items })
  assert.deepEqual(ups(h, 'filed').map((u) => u.data.key), ['queue@W36'])
  const merges = reports(h, 'merge').map((d) => Object.fromEntries(d[0]))
  assert.deepEqual(merges.map((m) => `${m.item}→${m.into}`), ['W19→W20', 'W17→W20'])
  assert.equal(w.crashes.length, 0)
  s.stop(w.id, 'test over')
})

// spec: design §9 (wake between turns) · law 10 (no loops)
// class: B1 a bound (6 wakes in 600 s) · E10 duplicate endings coalesced
// technique: fake clock over a burst of endings
// method: read the wakes sent
// sre: can a burst of run endings wake Claude dozens of times?
test('U-wake: endings coalesce into one wake between turns; a passing verifier is none; a failure always; 6 wakes in 600 s at most', () => {
  const h = host()
  const s = new Supervisor(h)
  const w = s.spawn({ name: 'wake', program: program('wake') })
  const t = () => h.now()
  const look = (v) => s.send(w.id, 'hand', { ok: true, op: 'wake-state', result: { turn_running: false, quiet_s: 30, recent: [], ...v } })
  const job = (id, what, since) => ({ id, kind: 'job', what, since })
  look({ working: [job('forge-1', 'forge train', t() - 600), job('ipad-verify', 'ipad-verify', t() - 600), job('q-W36', 'queue item', t() - 300), job('t-9', 'task', t() - 100)] })
  h.tick(5)
  look({ working: [], recent: [{ id: 'forge-1', outcome: 'done' }, { id: 'ipad-verify', outcome: 'done' }, { id: 'q-W36', outcome: 'failed' }, { id: 't-9', outcome: 'done' }], turn_running: true })
  assert.equal(reports(h, 'wake').length, 0, 'no wake while a turn runs')
  h.tick(5)
  look({ working: [] })
  const wakes = reports(h, 'wake')
  assert.equal(wakes.length, 1)
  assert.deepEqual(wakes[0][0].map((e) => Object.fromEntries(e).id), ['forge-1', 'q-W36', 't-9'])
  for (let i = 0; i < 8; i++) {
    look({ working: [job(`x-${i}`, 'build', t() - 100)] })
    h.tick(5)
    look({ working: [], recent: [{ id: `x-${i}`, outcome: 'failed' }] })
    h.tick(5)
    look({ working: [] })
    h.tick(20)
  }
  assert.equal(reports(h, 'wake').length, 6, 'at most 6 wakes in 600 s; the rest wait')
  assert.ok(w.kv.pending.length >= 1)
  s.stop(w.id, 'test over')
})

// spec: design §12.4 (self-health) · §7.6 mail · F-11 dedupe
// class: E10 a duplicate (a second run files 0 new) · L3 (no act, no desk push)
// technique: three planted faults, run twice
// method: read tickets, mail notes and counts
// sre: does self-health file the same three tickets every run, or raise a count?
test('U-self: 3 planted faults give 3 tickets and 3 mail notes; a second run files 0 new and raises 3 counts; no desk push, no act', async () => {
  const facts = { 'forge-tender-restarts': 0, 'ipad-fires-6h': 2, 'notices-per-body': 1, 'free-gb': 20, bundles: 6, 'pytest-red': 0,
    'uncommitted-old': 0, 'contracts-stalled': 0, 'promises-overdue': 0, 'orphan-workers': 0, 'units-missing': 0, 'minds-below-gate': 0,
    services: [{ port: 1138, up: true }, { port: 1139, up: false }, { port: 8091, up: true }] }
  const once = async (open) => {
    const h = host()
    const s = new Supervisor(h)
    const w = s.spawn({ name: 'self-health', program: program('self-health') })
    s.send(w.id, 'hand', { ok: true, op: 'health-facts', result: { facts, open } })
    if (reports(h, 'ticket').length) s.send(w.id, 'brain', 'the trigger lost its last fire and the foreman is down; restore the trigger seed')
    await settle(s)
    return { h, w }
  }
  const first = await once([])
  const tickets = reports(first.h, 'ticket').map((d) => Object.fromEntries(d[0]).key)
  assert.deepEqual(tickets.sort(), ['self-health:free-gb', 'self-health:ipad-fires-6h', 'self-health:service-1139'])
  assert.equal(reports(first.h, 'mail').length, 3)
  assert.equal(first.w.state, 'retired')
  const second = await once(tickets.map((key) => ({ key, count: 1 })))
  assert.equal(reports(second.h, 'ticket').length, 0)
  assert.deepEqual(reports(second.h, 'ticket-count').map((d) => Object.fromEntries(d[0]).count), [2, 2, 2])
  for (const r of [first, second]) assert.equal(ups(r.h, 'ask').length + ups(r.h, 'act').length, 0)
})

// spec: CL-H17 · LACUNA-1.0-FINALE §1 rulings 6 and 7 (warn at 0 h, alert once red for 3 h, clear on green; 0 acts/pages)
// class: B1 bounded reports (1 warn at 0 h, 1 alert at 3 h, 1 clear on green per episode) · L3 tier watch (0 acts/pages)
// technique: fixture clock over 0 h (warn) → 5 min (quiet) → 3 h (alert) → 3 h 5 min (quiet) → green (clear) → new red
// method: advance h.tick(), fire the 300 s timer, inspect warn/alert/clear reports, verify 0 lint findings and 0 acts/asks
// sre: does a red watchdog warn once at 0 h, promote to one alert at 3 h, and clear once when green again?
test('U-sweep: warns at 0 h, promotes to one alert at 3 h, clears on green, and passes cart-lint', () => {
  const index = readFileSync(new URL('INDEX.slat', CARTS), 'utf8')
  const faults = lintCarts({ root: CARTS.pathname, units: new Set(Object.keys(UNITS)), index })
  assert.deepEqual(faults.filter((f) => f.cart === 'watchdog-sweep'), [])
  const desk = mkdtempSync('/private/tmp/lacuna-unit/sweep-desk-')   // a scratch desk: the alert's work order lands here, never the owner's
  const h = { ...host(), deskDir: () => desk }; const t0 = h.now(); const s = new Supervisor(h)
  const w = s.spawn({ name: 'watchdog-sweep', program: program('watchdog-sweep') })
  const orders = () => { try { return readdirSync(join(desk, 'work-orders')).map((f) => readFileSync(join(desk, 'work-orders', f), 'utf8')) } catch { return [] } }
  const row = (name, ok, why, mode = 'm') => ({ name, subsystem: 's', mode, ok, read: ok ? why : '', why: ok ? '' : why })
  const send = (rows) => s.send(w.id, 'hand', {
    ok: true, op: 'box-watchdogs',
    result: { rows, red: rows.filter((r) => !r.ok).length, green: rows.filter((r) => r.ok).length },
  })
  assert.equal(w.timers[0].spec.seconds, 300); assert.equal(ups(h, 'hand').at(-1).data.op, 'box-watchdogs')
  send([row('door.01', true, '200'), row('checkup.01', false, '356.3 h old, over 26', 'stale'), row('lme.01', false, 'unreadable', 'gone')])
  assert.deepEqual(reports(h, 'warn').map((d) => Object.fromEntries(d[0])), [
    { row: 'checkup.01', name: 'checkup.01', subsystem: 's', mode: 'stale', reading: '356.3 h old, over 26', since: t0 },
    { row: 'lme.01', name: 'lme.01', subsystem: 's', mode: 'gone', reading: 'unreadable', since: t0 },
  ])
  assert.equal(reports(h, 'alert').length, 0, 'under 3 h: warn only, no alert yet')
  h.tick(300); fire(s, w, 'every')
  send([row('door.01', true, '200'), row('checkup.01', false, '356.4 h old, over 26', 'stale'), row('lme.01', false, 'unreadable', 'gone')])
  assert.equal(reports(h, 'warn').length, 2, 'staying red before 3 h emits no second warn')
  assert.equal(reports(h, 'alert').length, 0)
  h.tick(10_500); fire(s, w, 'every')
  send([row('door.01', true, '200'), row('checkup.01', false, '359.3 h old, over 26', 'stale'), row('lme.01', false, 'unreadable', 'gone')])
  assert.deepEqual(reports(h, 'alert').map((d) => Object.fromEntries(d[0])), [
    { row: 'checkup.01', name: 'checkup.01', subsystem: 's', mode: 'stale', reading: '359.3 h old, over 26', since: t0 },
    { row: 'lme.01', name: 'lme.01', subsystem: 's', mode: 'gone', reading: 'unreadable', since: t0 },
  ])
  // E14 row 11: each alert files one work order for the judge to diagnose its row
  assert.equal(orders().length, 2)
  assert.ok(orders().some((o) => /\(for "judge"\)/.test(o) && /Diagnose the watchdog checkup\.01 \(s\): red for 3 h, reading 359\.3 h old, over 26; its mode: stale/.test(o)), orders()[0])
  h.tick(300); fire(s, w, 'every')
  send([row('door.01', true, '200'), row('checkup.01', false, '359.4 h old, over 26', 'stale'), row('lme.01', false, 'unreadable', 'gone')])
  assert.equal(reports(h, 'alert').length, 2, 'still red past 3 h emits no second alert')
  assert.equal(orders().length, 2, 'and files no second order')
  h.tick(300); fire(s, w, 'every')
  send([row('door.01', true, '200'), row('checkup.01', true, '0.1 h', 'stale'), row('lme.01', false, 'unreadable', 'gone')])
  assert.deepEqual(reports(h, 'clear').map((d) => Object.fromEntries(d[0]).row), ['checkup.01'])
  h.tick(300); fire(s, w, 'every')
  send([row('door.01', true, '200'), row('checkup.01', false, '27.0 h old, over 26', 'stale'), row('lme.01', false, 'unreadable', 'gone')])
  assert.equal(reports(h, 'warn').length, 3, 'new red episode starts with a warn')
  assert.equal(reports(h, 'alert').length, 2)
  assert.equal(ups(h, 'act').length + ups(h, 'ask').length + w.crashes.length, 0)
  s.stop(w.id, 'test over')
})

// spec: R1.7 (memory-audit.sks weekly: each class's size and growth, the plan; every drop a row, so the cart only reports) ·
//       the finale's ruling 7 (the reports feed the telemetry card)
// class: B1 bounded reports (one info row a class and one plan row a week) · L3 tier watch (0 acts, 0 pages)
// technique: fixture clock: week 1 (no growth), week 2 (growth, a class past its time), a read that does not answer
// method: fire the weekly timer, send the hand's answer, read the reports
// sre: does the weekly audit say each class's size and growth, and warn on rows past their time, without acting?
test('U-memory-audit: one row a class with its growth, the plan, a warn past time, and passes cart-lint', () => {
  const index = readFileSync(new URL('INDEX.slat', CARTS), 'utf8')
  const faults = lintCarts({ root: CARTS.pathname, units: new Set(Object.keys(UNITS)), index })
  assert.deepEqual(faults.filter((f) => f.cart === 'memory-audit'), [])
  const h = host(); const s = new Supervisor(h)
  const w = s.spawn({ name: 'memory-audit', program: program('memory-audit') })
  assert.equal(w.timers[0].spec.seconds, 604800); assert.equal(ups(h, 'hand').at(-1).data.op, 'memory-audit')
  const answer = (floorBytes, drop) => ({ ok: true, op: 'memory-audit', result: {
    classes: [{ class: 'floor-events', files: 2, bytes: floorBytes, oldestDays: 30, keep: 7, past: 'drop' },
      { class: 'runs', files: 9, bytes: 4096, oldestDays: 40, keep: 'forever', past: 'forever' }],
    plan: { drop, dropBytes: drop * 300, condense: 0, stands: 10 }, unruled: { count: 1 }, orphans: { count: 0 },
    cortex: { bytes: 100 }, partial: false } })
  s.send(w.id, 'hand', answer(500, 0))
  const info1 = reports(h, 'info').map((d) => Object.fromEntries(d[0]))
  assert.deepEqual(info1.filter((r) => r.class).map((r) => [r.class, r.bytes, r.grew]), [['floor-events', 500, 'none'], ['runs', 4096, 'none']])
  assert.deepEqual(info1.filter((r) => r.plan).map((r) => [r.drop, r.unruled, r['cortex-bytes']]), [[0, 1, 100]])
  assert.equal(reports(h, 'warn').length, 0)
  h.tick(604800); fire(s, w, 'every')
  s.send(w.id, 'hand', answer(800, 1))
  const info2 = reports(h, 'info').map((d) => Object.fromEntries(d[0])).slice(info1.length)
  assert.deepEqual(info2.filter((r) => r.class).map((r) => [r.class, r.grew]), [['floor-events', 300], ['runs', 0]])
  assert.deepEqual(reports(h, 'warn').map((d) => Object.fromEntries(d[0])).map((r) => [r.row, r.drop]), [['memory.past-time', 1]])
  s.send(w.id, 'hand', { ok: false, op: 'memory-audit', why: 'the hands are stopping' })
  assert.ok(reports(h, 'step').length >= 1)
  assert.equal(ups(h, 'act').length + ups(h, 'ask').length + w.crashes.length, 0)
  s.stop(w.id, 'test over')
})

// spec: order 2026-11-06 §1.11 (the memory-audit run read as abandoned at its hand: 13 kicks and 547 would-stop rows from
//       11-02 to 11-06, while the hand answered in 487 ms and the cart wrote its ten rows); cart-sentry.mjs (a header's step
//       deadline wins over STEP_S)
// class: J a progress clock that does not match the cart's own cadence
// technique: the real cart in a real Supervisor, its hand answered; the clock moved a week less an hour, then past a week
//            and a day
// method: the cart sentry's sweep finds no stall inside the week (red before: a kick 600 s after the hand), and still kicks
//         past the header's step deadline (a cart that stops reading is still caught)
// sre: does a weekly cart read as abandoned every quiet ten minutes of its week?
test('§1.11: the memory-audit cart is not abandoned in the week between its reads, and is kicked past a week and a day', () => {
  const h = host(); const s = new Supervisor(h)
  const w = s.spawn({ name: 'memory-audit', program: program('memory-audit') })
  s.send(w.id, 'hand', { ok: true, op: 'memory-audit', result: { classes: [], plan: { drop: 0, condense: 0, stands: 0 } } })
  assert.equal(reports(h, 'info').length, 1, 'the hand answered and the plan row was written')
  h.tick(604800 - 3600)
  assert.deepEqual(cartSweep(s, { shadow: true }).filter((v) => v.check === 'no-progress'), [])
  h.tick(86400 + 3601)
  assert.deepEqual(cartSweep(s, { shadow: true }).map((v) => [v.check, v.action]), [['no-progress', 'kick']])
  s.stop(w.id, 'test over')
})

// spec: 5.2 (nightly-rehearsal.sks: rehearse the ten jobs on eval:rehearsal-* sessions every night, report pass/fail and any why)
// class: B1 bounded reports (10 job rows + 1 summary row a night) · L3 tier watch (0 acts, 0 pages)
// technique: fixture clock: night 1 (10/10 pass), night 2 (9/10 pass, 1 fail with mechanical why), and a read that does not answer
// method: fire the nightly timer, send the ten-rehearsal hand's answer, read the info, warn and step reports
// sre: does the nightly rehearsal cart report all ten jobs and warn with the failing job's mechanical why without acting?
test('U-rehearsal: nightly-rehearsal reports 10 jobs and a summary on a clean night, warns with why on a failing job, and passes cart-lint', () => {
  const index = readFileSync(new URL('INDEX.slat', CARTS), 'utf8')
  const faults = lintCarts({ root: CARTS.pathname, units: new Set(Object.keys(UNITS)), index })
  assert.deepEqual(faults.filter((f) => f.cart === 'nightly-rehearsal'), [])
  const h = host(); const s = new Supervisor(h)
  const w = s.spawn({ name: 'nightly-rehearsal', program: program('nightly-rehearsal') })
  assert.equal(w.timers[0].spec.seconds, 86400); assert.equal(ups(h, 'hand').at(-1).data.op, 'ten-rehearsal')
  const rows10 = Array.from({ length: 10 }, (_, i) => ({
    id: `job-${i + 1}`, playbook: `PB-${i + 1}`, session: `eval:rehearsal-job-${i + 1}`,
    outcome: 'pass', why: '(latch-closed?) held', stepCount: 4, latchClosed: true,
  }))
  s.send(w.id, 'hand', { ok: true, op: 'ten-rehearsal', result: { at: 1000, total: 10, passed: 10, failed: 0, rows: rows10 } })
  const info1 = reports(h, 'info').map((d) => Object.fromEntries(d[0]))
  assert.equal(info1.filter((r) => r.job).length, 10)
  assert.deepEqual(info1.filter((r) => r.summary).map((r) => [r.total, r.passed, r.failed]), [[10, 10, 0]])
  assert.equal(reports(h, 'warn').length, 0)
  h.tick(86400); fire(s, w, 'every')
  const rows9 = rows10.map((r, i) => (i === 2 ? { ...r, outcome: 'fail', why: 'done-check: (eqv? (exit-of (quote strict)) 0) answered false' } : r))
  s.send(w.id, 'hand', { ok: true, op: 'ten-rehearsal', result: { at: 87400, total: 10, passed: 9, failed: 1, rows: rows9 } })
  const warns = reports(h, 'warn').map((d) => Object.fromEntries(d[0]))
  assert.equal(warns.length, 1)
  assert.equal(warns[0].job, 'job-3')
  assert.match(warns[0].why, /strict/)
  s.send(w.id, 'hand', { ok: false, op: 'ten-rehearsal', why: 'the hands are stopping' })
  assert.ok(reports(h, 'step').length >= 1)
  assert.equal(ups(h, 'act').length + ups(h, 'ask').length + w.crashes.length, 0)
  s.stop(w.id, 'test over')
})
