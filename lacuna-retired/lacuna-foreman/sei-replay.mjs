// sei-replay.mjs — REPLAY AS AN EVAL HARNESS (CL-SEI #6).
// owns: recording a session's checked step forms, seed, and mind as Slat data (`recordSession`), replaying a recorded
//   session deterministically under `withSeed` against `rehearseJob` (`replaySession`), and diffing two replayed runs by
//   checked step forms, latch progression, seed draws, and done-check outcomes (`diffReplays`).
// refuses: recording or replaying a non-eval session (Law 8: every session is `eval:<name>`), or touching live outside
//   services during replay (Law 10).
// implements: docs/lanes/1.0/tasks/CL-SEI-scheme-erlang-inference.md (#6 Replay as an eval harness);
//   docs/eng/sei-1.1/DECISIONS.md (§6).
// invariants: Law 5 ("One envelope, one reader: every hop is a signed (msg …) read by slat-data"); Law 6 ("outcome pass
//   is written only by the foreman's done-check"); Law 8 ("Tests use session: eval:<name>").
// faults: F-02 (tool or session refused); F-10 (malformed Slat recording refused by slat-data).
import { readForm, writeString } from '../../lacuna-scheme/src/slat-data.js'
import { seededRandom, withSeed } from '../../lacuna-scheme/src/rng.js'
import { TEN_JOBS, rehearseJob } from './rehearsal.mjs'

const symName = (x) => (x && typeof x === 'object' && 'name' in x ? x.name : String(x ?? ''))

function fieldOf(form, key) {
  if (!Array.isArray(form)) return undefined
  for (let i = 1; i < form.length; i++) {
    const item = form[i]
    if (Array.isArray(item) && symName(item[0]) === key) return item.slice(1)
  }
  return undefined
}

function drawN(seed, count) {
  return withSeed(seed, () => {
    const out = []
    for (let i = 0; i < count; i++) {
      out.push(Math.round(seededRandom() * 1_000_000))
    }
    return out
  })
}

/**
 * Records a deterministic session transcript as Slat text `(replay-session ...)`.
 * @param {{session?: string, seed?: number, mind?: string, jobId?: string}} [spec]
 * @return {string} Slat recording text
 */
export function recordSession(spec = {}) {
  const jobId = spec.jobId || 'watchdog-red'
  const job = TEN_JOBS.find((j) => j.id === jobId || j.playbook === jobId) || TEN_JOBS[0]
  const session = spec.session || job.session
  if (!String(session).startsWith('eval:')) {
    throw new Error(`sei-replay refuses non-eval session: ${session} (Law 8)`)
  }
  const seed = Number.isInteger(spec.seed) ? spec.seed : 42
  const mind = spec.mind || 'gemma4:e4b'
  const draws = drawN(seed, job.steps.length || 1)
  const stepForms = job.steps.map((s, idx) => {
    const exit = Number.isInteger(s.exit) ? s.exit : 0
    return `(step ${idx + 1} (op ${writeString(s.op)}) (exit ${exit}) (draw ${draws[idx]}))`
  }).join(' ')
  const drawText = draws.join(' ')
  return `(replay-session (v 1) (session ${writeString(session)}) (seed ${seed}) (mind ${writeString(mind)}) (job ${writeString(job.id)}) (draws ${drawText}) (steps ${stepForms}))\n`
}

/**
 * Replays a Slat `(replay-session ...)` recording deterministically under `withSeed` and `rehearseJob`.
 * @param {string} recordingText Slat recording produced by `recordSession`
 * @param {{mind?: string, fault?: {step?: number, exit?: number, skip?: boolean, answer?: string}, vmWorkers?: boolean}} [opts]
 * @return {object} replay summary with checked step forms, latch state, draws, and done-check outcome
 */
export function replaySession(recordingText, opts = {}) {
  const form = readForm(String(recordingText || ''))
  if (!Array.isArray(form) || symName(form[0]) !== 'replay-session') {
    throw new Error('sei-replay: expected (replay-session ...) form')
  }
  const session = String(fieldOf(form, 'session')?.[0] || '')
  if (!session.startsWith('eval:')) {
    throw new Error(`sei-replay refuses non-eval session: ${session} (Law 8)`)
  }
  const seed = Number(fieldOf(form, 'seed')?.[0] ?? 42)
  const recordedMind = String(fieldOf(form, 'mind')?.[0] || 'gemma4:e4b')
  const mind = opts.mind || recordedMind
  const jobId = String(fieldOf(form, 'job')?.[0] || 'watchdog-red')
  const recordedDraws = (fieldOf(form, 'draws') || []).map(Number)
  const job = TEN_JOBS.find((j) => j.id === jobId || j.playbook === jobId)
  if (!job) throw new Error(`sei-replay: unknown job ${jobId}`)

  const replayJob = Object.freeze({ ...job, session })
  const draws = drawN(seed, replayJob.steps.length || 1)
  const row = withSeed(seed, () => rehearseJob(replayJob, { fault: opts.fault, vmWorkers: opts.vmWorkers }))
  const stepEvents = row.floorEvents.filter((e) => e.type === 'run.step')
  const forms = stepEvents.map((e, idx) => `(${e.op} (step ${e.step}) (exit ${e.exit}) (latch ${e.latchK}) (draw ${draws[idx] ?? 0}))`)

  return {
    session,
    seed,
    mind,
    recordedMind,
    jobId: replayJob.id,
    playbook: replayJob.playbook,
    outcome: row.outcome,
    why: row.why,
    doneCheck: row.doneCheck,
    stepCount: row.stepCount,
    latchK: row.latchK,
    latchN: row.latchN,
    latchClosed: row.latchClosed,
    draws,
    recordedDraws,
    seedVerified: draws.length === recordedDraws.length && draws.every((d, i) => d === recordedDraws[i]),
    forms,
    floorEvents: row.floorEvents,
  }
}

/**
 * Compares two replayed runs (`baseRun` vs `candidateRun`) by checked step forms, latch progression, and done-check outcome.
 * @param {object} baseRun result of `replaySession`
 * @param {object} candidateRun result of `replaySession`
 * @return {{match: boolean, outcomeMatch: boolean, latchMatch: boolean, formsMatch: boolean, seedMatch: boolean, diffs: Array<object>}}
 */
export function diffReplays(baseRun, candidateRun) {
  const diffs = []
  const outcomeMatch = baseRun.outcome === candidateRun.outcome && baseRun.doneCheck === candidateRun.doneCheck
  if (!outcomeMatch) {
    diffs.push({
      field: 'outcome',
      base: { outcome: baseRun.outcome, why: baseRun.why },
      candidate: { outcome: candidateRun.outcome, why: candidateRun.why },
    })
  }
  const latchMatch = baseRun.latchClosed === candidateRun.latchClosed && baseRun.latchK === candidateRun.latchK
  if (!latchMatch) {
    diffs.push({
      field: 'latch',
      base: { k: baseRun.latchK, n: baseRun.latchN, closed: baseRun.latchClosed },
      candidate: { k: candidateRun.latchK, n: candidateRun.latchN, closed: candidateRun.latchClosed },
    })
  }
  const seedMatch = Boolean(baseRun.seedVerified && candidateRun.seedVerified && baseRun.seed === candidateRun.seed)
  if (!seedMatch) {
    diffs.push({ field: 'seed', base: baseRun.seed, candidate: candidateRun.seed })
  }
  const maxSteps = Math.max(baseRun.forms.length, candidateRun.forms.length)
  let formsMatch = baseRun.forms.length === candidateRun.forms.length
  for (let i = 0; i < maxSteps; i++) {
    const b = baseRun.forms[i] || null
    const c = candidateRun.forms[i] || null
    if (b !== c) {
      formsMatch = false
      diffs.push({ field: 'step', step: i + 1, base: b, candidate: c })
    }
  }
  return {
    match: outcomeMatch && latchMatch && formsMatch && seedMatch,
    outcomeMatch,
    latchMatch,
    formsMatch,
    seedMatch,
    diffs,
  }
}
