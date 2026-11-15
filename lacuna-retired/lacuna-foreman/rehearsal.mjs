// rehearsal.mjs — THE TEN-JOB REHEARSAL.
// owns: the ten SRE job descriptors from docs/eng/TEN-JOBS-2026-10-27.md (TEN_JOBS), running one job on an eval:rehearsal-*
//   session through its real .slat ladder, Supervisor, fileRun, intent, result, said, finishRun, doneCheck, runDeskVerb, and
//   fileCartOrders dry-run (rehearseJob), and walking all ten jobs in order with a pass/fail summary and mechanical why on any
//   fault (rehearseTen).
// refuses: running on the owner's session (Law 8: every session is eval:rehearsal-*), executing a live act against outside
//   services (Law 4, Law 10), or writing outcome pass without doneCheck (Law 6).
// implements: docs/LACUNA-1.0-POLISH-PASS.md §5.1–§5.2; docs/LACUNA-1.0-DESIGN.md §8; docs/eng/TEN-JOBS-2026-10-27.md.
// invariants: Law 6 ("outcome pass is written only by the foreman's done-check"); Law 8 ("Tests use session: eval:<name>").
// faults: F-02 (tool or provenance refused, exit 12); F-03 (hop cap or repeat loop refused).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Supervisor } from './supervisor.mjs'
import { fileRun, intent, result, said, finishRun } from './intents.mjs'
import { runDeskVerb } from './desk-verbs.mjs'
import { readOrders, runKeyOf } from './work-orders.mjs'
import { vmRunActorSteps } from './vm-sidecar.mjs'

const DESK_SET = new Set(['petition', 'work-order', 'note'])

/**
 * The ten canonical SRE jobs (docs/eng/TEN-JOBS-2026-10-27.md), each paired with its eval:rehearsal-* session and ladder steps.
 * @type {ReadonlyArray<object>}
 */
export const TEN_JOBS = Object.freeze([
  Object.freeze({
    index: 1, id: 'watchdog-red', playbook: 'WATCHDOG-RED', role: 'operator',
    session: 'eval:rehearsal-watchdog-red', wo: 900101, title: 'Red watchdog to green',
    goal: 'A watchdog is red; diagnose, fix, run tests and commit (recall WATCHDOG-RED).',
    hands: Object.freeze(['watchdogs', 'read', 'test-run']), acts: Object.freeze(['git-commit']),
    answer: 'Watchdog w-ci-health fixed and green; test-run exit 0, committed.',
    steps: Object.freeze([
      { op: 'watchdogs', args: [], value: { rows: [{ name: 'w-ci-health', state: 'red', consecutive: 3 }] } },
      { op: 'watchdogs', args: ['w-ci-health'], value: { rows: [{ name: 'w-ci-health', detail: 'timeout at line 42' }] } },
      { op: 'read', args: ['lacuna-foreman/carts/watchdog-sweep.sks'], value: { text: '(cart watchdog-sweep ...)' } },
      { op: 'test-run', args: ['lacuna-foreman/test/carts.test.mjs'], value: { ok: true, passed: 18, failed: 0 } },
      { op: 'git-commit', args: ['fix(foreman): restore watchdog-sweep threshold'], value: { sha: 'a1b2c3d' } },
    ]),
  }),
  Object.freeze({
    index: 2, id: 'disk', playbook: 'DISK', role: 'operator',
    session: 'eval:rehearsal-disk', wo: 900102, title: 'Disk free space and plan',
    goal: 'Check free space and top folders under ~/code and ~/lacuna-world (recall DISK).',
    hands: Object.freeze(['disk', 'disk-usage']), acts: Object.freeze([]),
    answer: 'Free space is 61 GB (13 % free of 460 GB); plan: prune ~/lacuna-world/runs older than 14 d.',
    steps: Object.freeze([
      { op: 'disk', args: [], value: { free_gb: 61, total_gb: 460, pct_free: 13 } },
      { op: 'disk-usage', args: ['~/lacuna-world'], value: { rows: [{ path: '~/lacuna-world/runs', gb: 18.4 }] } },
    ]),
  }),
  Object.freeze({
    index: 3, id: 'cart-repair', playbook: 'CART-REPAIR', role: 'engineer',
    session: 'eval:rehearsal-cart-repair', wo: 900103, title: 'Broken cart to passing strict check',
    goal: 'Repair the failing cart, pass strict and commit (recall CART-REPAIR).',
    hands: Object.freeze(['cart-lint', 'read', 'strict']), acts: Object.freeze(['patch', 'git-commit']),
    answer: 'Fixed cart-probe.sks line 14; strict exit 0, committed.',
    steps: Object.freeze([
      { op: 'cart-lint', args: ['cart-probe.sks'], value: { faults: [{ line: 14, code: 'L-ARITY' }] } },
      { op: 'read', args: ['lacuna-foreman/carts/cart-probe.sks'], value: { text: '(cart cart-probe ...)' } },
      { op: 'patch', args: { edits: [{ file: 'lacuna-foreman/carts/cart-probe.sks', write: '(cart (name "cart-probe")\n  (step "ok" (report \'summary "ok")))\n' }] }, value: { touched: ['lacuna-foreman/carts/cart-probe.sks'] } },
      { op: 'strict', args: ['cart-probe.sks'], value: { ok: true, faults: [] } },
      { op: 'git-commit', args: ['fix(carts): repair cart-probe arity'], value: { sha: 'b2c3d4e' } },
    ]),
  }),
  Object.freeze({
    index: 4, id: 'qa-down', playbook: 'QA-DOWN', role: 'operator',
    session: 'eval:rehearsal-qa-down', wo: 900104, title: 'QA down to up or failing service named',
    goal: 'Check QA services, inspect logs and disk, and file a qa-restart petition (recall QA-DOWN).',
    hands: Object.freeze(['services', 'service-log', 'disk', 'petition']), acts: Object.freeze([]),
    answer: 'qa-api is down (ECONNREFUSED :2137); filed petition qa-restart.',
    steps: Object.freeze([
      { op: 'services', args: [], value: [{ name: 'dev-api', up: true, healthy: true }, { name: 'qa-api', up: false, healthy: false }] },
      { op: 'service-log', args: ['qa-api'], value: { lines: ['ECONNREFUSED 127.0.0.1:2137'] } },
      { op: 'disk', args: [], value: { free_gb: 61, pct_free: 13 } },
      { op: 'petition', args: ['qa-restart', 'qa-api down on :2137; log shows ECONNREFUSED'], value: { filed: true } },
    ]),
  }),
  Object.freeze({
    index: 5, id: 'error-spike', playbook: 'ERROR-SPIKE', role: 'triager',
    session: 'eval:rehearsal-error-spike', wo: 900105, title: 'Error spike to root cause and work order',
    goal: 'Triage the error spike, inspect logs and git-log, and file a work-order (recall ERROR-SPIKE).',
    hands: Object.freeze(['errors', 'tail-log', 'git-log', 'work-order']), acts: Object.freeze([]),
    answer: 'Cause: null dereference in lacuna-node/frontend.mjs:142; filed work-order.',
    steps: Object.freeze([
      { op: 'errors', args: [], value: { count: 19, top: 'TypeError at lacuna-node/frontend.mjs:142' } },
      { op: 'tail-log', args: ['door'], value: { lines: ['TypeError: Cannot read properties of null at lacuna-node/frontend.mjs:142'] } },
      { op: 'git-log', args: ['lacuna-node/frontend.mjs'], value: { commits: [{ sha: 'c3d4e5f', subject: 'refactor door handler' }] } },
      { op: 'work-order', args: [{ goal: 'Guard null session in lacuna-node/frontend.mjs:142', for: 'engineer', repo: 'lacuna-node' }], value: { filed: true } },
    ]),
  }),
  Object.freeze({
    index: 6, id: 'work-orders', playbook: 'WORK-ORDERS', role: 'engineer',
    session: 'eval:rehearsal-work-orders', wo: 900106, title: 'Open work order to tested commit',
    goal: 'Implement the work order fix, run tests and commit (recall WORK-ORDERS).',
    hands: Object.freeze(['read', 'test-run']), acts: Object.freeze(['patch', 'git-commit']),
    answer: 'Implemented work order fix; test-run exit 0 and git-commit exit 0.',
    steps: Object.freeze([
      { op: 'read', args: ['lacuna-node/frontend.mjs'], value: { text: 'export function handleDoor(req) {}\n' } },
      { op: 'patch', args: { edits: [{ file: 'lacuna-node/frontend.mjs', write: 'export function handleDoor(req) { return Boolean(req) }\n' }] }, value: { touched: ['lacuna-node/frontend.mjs'] } },
      { op: 'test-run', args: ['lacuna-node/test/door.test.mjs'], value: { ok: true, passed: 12, failed: 0 } },
      { op: 'git-commit', args: ['fix(door): guard null session in handleDoor'], value: { sha: 'd4e5f6a' } },
    ]),
  }),
  Object.freeze({
    index: 7, id: 'hotfix', playbook: 'HOTFIX', role: 'engineer',
    session: 'eval:rehearsal-hotfix', wo: 900107, title: 'Regression on main to hotfix commit',
    goal: 'Reproduce the regression, patch the fix, pass test-run and commit (recall HOTFIX).',
    hands: Object.freeze(['git-log', 'test-run']), acts: Object.freeze(['patch', 'git-commit']),
    answer: 'Reproduced regression, patched fix, test-run exit 0 and git-commit exit 0.',
    steps: Object.freeze([
      { op: 'git-log', args: ['-n', '5'], value: { commits: [{ sha: 'e5f6a7b', subject: 'recent change' }] } },
      { op: 'test-run', args: ['lacuna-node/test/regression.test.mjs'], exit: 1, value: { ok: false, passed: 4, failed: 1 } },
      { op: 'patch', args: { edits: [{ file: 'lacuna-node/hotfix.mjs', write: 'export const fixed = true\n' }] }, value: { touched: ['lacuna-node/hotfix.mjs'] } },
      { op: 'test-run', args: ['lacuna-node/test/regression.test.mjs'], exit: 0, value: { ok: true, passed: 5, failed: 0 } },
      { op: 'git-commit', args: ['fix(hotfix): restore regression invariant'], value: { sha: 'f6a7b8c' } },
    ]),
  }),
  Object.freeze({
    index: 8, id: 'release', playbook: 'RELEASE', role: 'operator',
    session: 'eval:rehearsal-release', wo: 900108, title: 'Release train to iPad install and board',
    goal: 'Run the release train through pass, build, install-ipad and release-board (recall RELEASE).',
    hands: Object.freeze(['release-board', 'release-sort', 'pass', 'build']), acts: Object.freeze(['install-ipad']),
    answer: 'Release train passed, built, installed on iPad, and verified on release-board.',
    steps: Object.freeze([
      { op: 'release-board', args: [], value: { ready: true, pending: 2 } },
      { op: 'release-sort', args: [], value: { order: ['lacuna-scheme', 'lacuna-foreman'] } },
      { op: 'pass', args: [], value: { ok: true, suites: 12 } },
      { op: 'build', args: [], value: { ok: true, artifact: 'Lacuna-1.0.ipa' } },
      { op: 'install-ipad', args: ['Lacuna-1.0.ipa'], value: { ok: true, device: 'Alfred-iPad' } },
      { op: 'release-board', args: [], value: { ready: true, pending: 0, installed: 'Lacuna-1.0.ipa' } },
    ]),
  }),
  Object.freeze({
    index: 9, id: 'game-room', playbook: 'GAME-ROOM', role: 'maker',
    session: 'eval:rehearsal-game-room', wo: 900109, title: 'Playable game bundle from one sentence',
    goal: 'Write the game, pass make-exam, and build the bundle (recall GAME-ROOM).',
    hands: Object.freeze(['make-exam', 'make-bundle']), acts: Object.freeze(['make-write']),
    answer: 'Built playable bundle starlight-hop; make-exam exit 0, make-bundle exit 0.',
    steps: Object.freeze([
      { op: 'make-write', args: ['starlight-hop'], value: { touched: ['games/starlight-hop/index.html'] } },
      { op: 'make-exam', args: ['starlight-hop'], value: { ok: true, score: 100 } },
      { op: 'make-bundle', args: ['starlight-hop'], value: { ok: true, bundle: 'starlight-hop.bundle' } },
    ]),
  }),
  Object.freeze({
    index: 10, id: 'backup', playbook: 'BACKUP', role: 'operator',
    session: 'eval:rehearsal-backup', wo: 900110, title: 'Backup audit and verification note',
    goal: 'Check backup watchdogs, disk-usage, bundle-verify, and record a note (recall BACKUP).',
    hands: Object.freeze(['watchdogs', 'disk-usage', 'bundle-verify', 'note']), acts: Object.freeze([]),
    answer: 'Backups verified: 3 bundles intact, 0 corrupt.',
    steps: Object.freeze([
      { op: 'watchdogs', args: ['backup'], value: { rows: [{ name: 'w-backup-age', state: 'green' }] } },
      { op: 'disk-usage', args: ['~/lacuna-world/bundles'], value: { rows: [{ path: '~/lacuna-world/bundles', gb: 4.2 }] } },
      { op: 'bundle-verify', args: [], value: { verified: 3, corrupt: 0 } },
      { op: 'note', args: [{ topic: 'backup-audit', text: 'Backups verified: 3 bundles intact, 0 corrupt (4.2 GB).' }], value: { noted: true } },
    ]),
  }),
])

/**
 * Rehearses one job from TEN_JOBS on its `eval:rehearsal-*` session through a scratch `Supervisor`.
 * @param {object} job one descriptor from TEN_JOBS
 * @param {{qaUp?: boolean, fault?: {step?: number, exit?: number, skip?: boolean, answer?: string}}} [opts]
 * @return {object} the rehearsal row (`outcome`, `why`, `stepCount`, `latchClosed`, `floorEvents`, etc.)
 */
export function rehearseJob(job, opts = {}) {
  if (!job || !String(job.session || '').startsWith('eval:')) {
    throw new Error(`rehearsal refuses non-eval session: ${job?.session ?? 'none'} (Law 8)`)
  }
  let deskDir = null
  try { deskDir = fs.mkdtempSync(path.join(os.tmpdir(), `lacuna-rehearsal-${job.id}-`)) } catch { deskDir = null }
  let t = 1_762_000_000, n = 0, deskSeq = 0
  const floorEvents = []
  let deskRecord = null
  let dryOrder = null
  try {
    const host = {
      up: [], texts: [], letters: [], rows: [], acts: [],
      deadlines: { hand: 30, act: 60, beat: 10, mind: 30, hop: 120 },
      now: () => (t += 1),
      id: () => `w-${job.id}-${++n}`,
      save: () => {},
      deskDir: () => deskDir || os.tmpdir(),
      upstream: (kind, w, data) => host.up.push({ kind, name: w.name, data }),
      contract: (w, text) => host.texts.push(text),
      mail: (m) => host.letters.push(m),
      mailCount: () => {},
      ledger: (text) => host.rows.push(text),
      act: (op, args) => host.acts.push({ op, args }),
    }
    const sup = new Supervisor(host)
    const w = fileRun(sup, {
      key: `wo:wo-${job.wo}`,
      goal: job.goal,
      playbook: job.playbook,
      role: job.role,
      by: 'work-order',
      tier: job.acts.length ? 'act' : 'watch',
      press: job.acts.length ? 'standing' : null,
      hands: [...job.hands],
      acts: [...job.acts],
    })
    floorEvents.push({ type: 'run.start', run: w.id, session: job.session, playbook: job.playbook })

    if (job.playbook === 'RELEASE') {
      const from = `desk:${job.session}`
      if (deskDir) {
        runDeskVerb('work-order', [{ goal: 'Run the release cart for 1.0', for: 'cart' }], {
          dir: deskDir, run: from, now: host.now(), seq: () => ++deskSeq,
        })
        const [ord] = readOrders(deskDir)
        dryOrder = { filed: ord ? 1 : 0, dry: /^desk:eval:/.test(String(ord?.from || '')), runKey: ord ? runKeyOf(ord) : null }
      } else {
        dryOrder = { filed: 1, dry: /^desk:eval:/.test(from), runKey: runKeyOf({ id: 'wo-1', from }) }
      }
    }

    const steps = opts.qaUp && job.playbook === 'QA-DOWN'
      ? [{ op: 'services', args: [], value: [{ name: 'dev-api', up: true, healthy: true }, { name: 'qa-api', up: true, healthy: true }] }]
      : job.steps

    const fault = opts.fault || null
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      const stepNum = i + 1
      if (fault && fault.step === stepNum && fault.skip) continue
      const it = intent(sup, w.id, { tool: step.op, args: step.args })
      if (!it.ok) {
        floorEvents.push({ type: 'run.refused', run: w.id, step: stepNum, op: step.op, why: it.why })
        break
      }
      const exit = fault && fault.step === stepNum && Number.isInteger(fault.exit)
        ? fault.exit
        : Number.isInteger(step.exit) ? step.exit : 0
      if (DESK_SET.has(step.op) && deskDir) {
        deskRecord = runDeskVerb(step.op, step.args, {
          dir: deskDir,
          run: w.run.key,
          now: host.now(),
          seq: () => ++deskSeq,
        })
      }
      const kind = job.acts.includes(step.op) ? 'act' : 'hand'
      const val = Array.isArray(step.value) ? step.value : { ok: exit === 0, exit, ...step.value }
      if (Array.isArray(val)) Object.defineProperty(val, 'exit', { value: exit, enumerable: false })
      result(sup, w.id, kind, Array.isArray(step.value) ? { ticket: it.ticket, op: step.op, exit, rows: step.value } : { ticket: it.ticket, op: step.op, exit, ...step.value })
      floorEvents.push({ type: 'run.step', run: w.id, step: stepNum, op: step.op, exit, latchK: w.contract.latch?.k ?? 0 })
    }

    const answerText = fault && typeof fault.answer === 'string' ? fault.answer : job.answer
    said(sup, w.id, answerText, { claimsDone: true })
    const fin = finishRun(sup, w.id, { pass: true, answer: answerText })
    floorEvents.push({ type: fin.outcome === 'pass' ? 'run.done' : 'run.fail', run: w.id, outcome: fin.outcome })
    const vmActor = opts.vmWorkers ? vmRunActorSteps({
      id: w.id,
      session: job.session,
      gen: w.gen || 1,
      steps: w.run.results.map((r) => ({ op: r.tool, exit: Number.isInteger(r.value?.exit) ? r.value.exit : 0 })),
      latchClosed: Boolean(w.contract?.latch?.closed),
    }) : null

    return {
      index: job.index,
      id: job.id,
      session: job.session,
      wo: `wo-${job.wo}`,
      runId: w.id,
      playbook: job.playbook,
      role: job.role,
      title: job.title,
      outcome: w.contract.outcome,
      why: w.contract.why || `${w.contract.done_check} held`,
      doneCheck: w.contract.done_check,
      stepCount: w.run.results.length,
      latchK: w.contract.latch?.k ?? 0,
      latchN: w.contract.latch?.n ?? 0,
      latchClosed: Boolean(w.contract?.latch?.closed),
      dryOrder,
      deskRecord: deskRecord ? { exit: deskRecord.exit, file: path.basename(String(deskRecord.rows?.file || '')) } : null,
      vmActor,
      floorEvents,
    }
  } finally {
    if (deskDir) try { fs.rmSync(deskDir, { recursive: true, force: true }) } catch { /* ignore */ }
  }
}

/**
 * Rehearses all ten jobs in order on `eval:rehearsal-*` sessions and returns the summary and per-job rows.
 * @param {{faults?: Object<string, {step?: number, exit?: number, skip?: boolean, answer?: string}>, now?: () => number}} [opts]
 * @return {{at: number, total: number, passed: number, failed: number, rows: Array<object>}}
 */
export function rehearseTen(opts = {}) {
  const faults = opts.faults || {}
  const vmWorkers = opts.vmWorkers ?? (process.env.LACUNA_VM === 'actors' || process.env.LACUNA_VM === 'sidecar')
  const rows = TEN_JOBS.map((job) => {
    const fault = faults[job.playbook] || faults[job.id] || null
    return rehearseJob(job, { fault, vmWorkers })
  })
  const passed = rows.filter((r) => r.outcome === 'pass').length
  const failed = rows.length - passed
  const at = typeof opts.now === 'function' ? opts.now() : Math.floor(Date.now() / 1000)
  return { at, total: rows.length, passed, failed, rows }
}
