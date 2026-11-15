// sentry-mode.test.mjs — the sentry's mode on the record (lane L2; LACUNA-SENTRY-1.0 §5). Owns: the proofs that the mode
// reads shadow with no file, an empty file or a line the one reader refuses; that live is refused without the owner's
// press or without the sitting that passed; that a pressed live with its sitting appends one line and the host reads live;
// that back to shadow needs no press; that a live mode lets the sentry's kick leave the record and shadow keeps it in; and
// that the scratch foreman's door `POST /sentry/mode` records the change and `GET /sentry` and `/agents` read it.
// Refuses: the live foreman and ~/lacuna-world (every file is under a scratch dir); a mock of sentry-mode.mjs or sentry.mjs.
// Implements: SENTRY §5, §7; CARDS-2.0 §6.1 (leave shadow). Invariants: "in shadow, nothing leaves the record"; "every change
// of mode is a line on the record". Faults: F-S2 (a kick sent in shadow) cannot happen without a live line.
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { MODES, readMode, setMode, sentryMode } from '../sentry-mode.mjs'
import { Supervisor } from '../supervisor.mjs'
import { apply, inShadow } from '../sentry.mjs'
import { boot } from './foreman-box.mjs'

const scratch = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sentry-mode-')), 'sentry-mode.slat')

// spec: SENTRY §5 (advisory until its exam) · class: fail closed · sre: what does the box do when the record is gone or torn?
test('the mode reads shadow with no file, an empty file, and a torn or foreign line', () => {
  const f = scratch()
  assert.deepEqual(MODES, ['shadow', 'live'])
  assert.equal(readMode(f).mode, 'shadow')
  fs.writeFileSync(f, '')
  assert.equal(readMode(f).mode, 'shadow')
  fs.writeFileSync(f, '(sentry-mode (@ ("mode" "live")\n(other (@ ("mode" "live")))\n(sentry-mode (@ ("mode" "loud")))\n')
  assert.equal(readMode(f).mode, 'shadow')
})

// spec: lane L2 leave-shadow · class: the press gate · sre: can anything but the owner's press make the sentry act?
test('live is refused without the press or the sitting; a pressed live with its sitting is one line; shadow needs no press', () => {
  const f = scratch()
  assert.match(setMode(f, { mode: 'live', sitting: 's2' }, 1).why, /owner's press/)
  assert.match(setMode(f, { mode: 'live', pressed: true }, 1).why, /names the sitting/)
  assert.match(setMode(f, { mode: 'loud', pressed: true, sitting: 's2' }, 1).why, /shadow or live/)
  assert.equal(fs.existsSync(f), false, 'a refusal writes nothing')
  const r = setMode(f, { mode: 'live', pressed: true, sitting: 's2', by: 'alfred' }, 100)
  assert.equal(r.ok, true); assert.deepEqual(readMode(f), { mode: 'live', at: 100, by: 'alfred', sitting: 's2' })
  assert.equal(setMode(f, { mode: 'shadow', by: 'alfred' }, 200).ok, true)
  assert.equal(readMode(f).mode, 'shadow')
  assert.equal(fs.readFileSync(f, 'utf8').trim().split('\n').length, 2, 'each change is one line; nothing is rewritten')
})

// spec: SENTRY §3 step 6, S-6 · class: the host's switch · technique: a real Supervisor and sentry.apply on a planted verdict
test('the host reads the file: shadow keeps the kick on the record, live sends it', () => {
  const f = scratch(); const m = sentryMode(f)
  const sent = []
  const sup = new Supervisor({ now: () => 1000, id: () => 'w1', save: () => {}, upstream: (k) => sent.push(k), sentryShadow: m.shadow })
  const w = { id: 'w1', name: 'r', run: { key: 'r' }, contract: { kicks: [], promises: [] }, handlers: new Map(), thoughts: [], state: 'running' }
  const v = { slice: { step: 1, turn: 1 }, sentences: [{ n: 0, kind: 'claim-without-receipt', text: 'I restarted it', evidence: [], by: 'regex' }] }
  assert.equal(inShadow(sup), true)
  const a = apply(sup, w, v)
  assert.equal(a.shadow, true); assert.equal(a.kicks, 0); assert.equal(a.would, 1); assert.deepEqual(sent.filter((k) => k === 'kick'), [], 'the bus carries the verdict, never a kick, in shadow')
  m.set({ mode: 'live', pressed: true, sitting: 's2' }, 1000)
  assert.equal(inShadow(sup), false)
  const b = apply(sup, w, v)
  assert.equal(b.kicks, 1); assert.deepEqual(sent.filter((k) => k === 'kick'), ['kick'])
})

const cleanups = []
let box
before(async () => { ({ f: box } = await boot({ after: (fn) => cleanups.push(fn) }, { tag: 'sentry-mode' })) })
after(async () => { for (const fn of cleanups.reverse()) await fn() })

// spec: lane L2 · class: W1 a door that answers · technique: the scratch foreman (its own FOREMAN_DIR)
test('the door records a pressed live and a shadow; /sentry and /agents read the mode', async () => {
  const no = await box.call('POST', '/sentry/mode', { mode: 'live', sitting: 's2' })
  assert.equal(no.status, 422); assert.match(no.body.why, /owner's press/)
  assert.equal((await box.call('GET', '/sentry')).body.mode.mode, 'shadow')
  const yes = await box.call('POST', '/sentry/mode', { mode: 'live', pressed: true, sitting: 's2', by: 'alfred' })
  assert.equal(yes.status, 200); assert.equal(yes.body.mode, 'live')
  assert.equal((await box.call('GET', '/sentry')).body.mode.mode, 'live')
  assert.equal((await box.call('GET', '/agents')).body.agents.find((a) => a.id === 'agent/sentry').shadow, false)
  assert.equal((await box.call('POST', '/sentry/mode', { mode: 'shadow' })).status, 200)
  assert.equal((await box.call('GET', '/agents')).body.agents.find((a) => a.id === 'agent/sentry').shadow, true)
})
