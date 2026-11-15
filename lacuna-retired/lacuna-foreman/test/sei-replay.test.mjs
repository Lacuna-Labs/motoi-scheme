// sei-replay.test.mjs — tests for CL-SEI #6 (Replay as an eval harness).
// owns: unit tests verifying `recordSession`, `replaySession`, and `diffReplays` across deterministic seeds, candidate
//   minds/prompts, injected step faults, and non-eval session refusal (Law 8).
// refuses: non-eval sessions or live network traffic.
// implements: docs/lanes/1.0/tasks/CL-SEI-scheme-erlang-inference.md (#6); docs/eng/sei-1.1/DECISIONS.md (§6).
// invariants: Law 6 (doneCheck governs pass); Law 8 (eval:<name> sessions only).
// faults: F-02; F-10.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { recordSession, replaySession, diffReplays } from '../sei-replay.mjs'
import * as workerActor from '../floor/actors/worker.js'
import * as serviceActor from '../floor/actors/service.js'
import * as foremanActor from '../floor/actors/foreman.js'
import * as sentryActor from '../floor/actors/sentry.js'
import * as lacunaActor from '../floor/actors/lacuna.js'

describe('CL-SEI #6: sei-replay eval harness', () => {
  it('records a deterministic Slat session and replays it with identical forms, seed draws, and pass outcome', () => {
    const rec = recordSession({ jobId: 'watchdog-red', seed: 108, mind: 'gemma4:e4b' })
    assert.ok(rec.startsWith('(replay-session (v 1) (session "eval:rehearsal-watchdog-red")'))

    const base = replaySession(rec)
    const cand = replaySession(rec, { mind: 'gemma4:26b' })
    assert.equal(base.outcome, 'pass')
    assert.equal(base.seedVerified, true)
    assert.equal(cand.mind, 'gemma4:26b')

    const diff = diffReplays(base, cand)
    assert.equal(diff.match, true)
    assert.equal(diff.diffs.length, 0)
  })

  it('detects form, latch, and outcome diffs when a candidate run drops or fails a required step', () => {
    const rec = recordSession({ jobId: 'cart-repair', seed: 77, mind: 'gemma4:e4b' })
    const base = replaySession(rec)
    const faulted = replaySession(rec, { mind: 'gemma4:e2b', fault: { step: 4, exit: 1 } })

    assert.equal(base.outcome, 'pass')
    assert.equal(faulted.outcome, 'fail')

    const diff = diffReplays(base, faulted)
    assert.equal(diff.match, false)
    assert.equal(diff.outcomeMatch, false)
    assert.equal(diff.latchMatch, false)
    assert.equal(diff.formsMatch, false)
    assert.ok(diff.diffs.some((d) => d.field === 'outcome'))
    assert.ok(diff.diffs.some((d) => d.field === 'latch'))
    assert.ok(diff.diffs.some((d) => d.field === 'step' && d.step === 4))
  })

  it('refuses non-eval sessions on both record and replay (Law 8)', () => {
    assert.throws(() => recordSession({ session: 'owner', jobId: 'disk' }), /Law 8/)
    const badText = '(replay-session (v 1) (session "owner") (seed 42) (mind "gemma4:e4b") (job "disk") (draws 1) (steps))\n'
    assert.throws(() => replaySession(badText), /Law 8/)
  })

  it('F5-BC: propagates rec.stale across worker, service, foreman, sentry, and lacuna floor actors', () => {
    const w = workerActor.create('w-1', 10)
    w.stale = 12
    assert.equal(workerActor.classify(w, 20).state, 'unknown')

    const s = serviceActor.create('svc:door', 10)
    s.up = true
    s.stale = 12
    assert.equal(serviceActor.classify(s, 20).state, 'stale')

    const f = foremanActor.create('foreman', 10)
    f.lastBeatT = 10
    f.stale = 12
    assert.equal(foremanActor.classify(f, 20).state, 'stale')

    const sn = sentryActor.create('sentry:w-1', 10)
    sn.stale = 12
    assert.equal(sentryActor.classify(sn, 20).state, 'unknown')

    const l = lacunaActor.create('lacuna', 10)
    l.stale = 12
    assert.equal(lacunaActor.classify(l, 20).state, 'stale')
  })
})
