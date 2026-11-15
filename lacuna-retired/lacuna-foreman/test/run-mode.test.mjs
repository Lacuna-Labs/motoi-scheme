// run-mode.test.mjs — U1 unit tests for W1.6, a run's WORK | BREAK mode (ROAD-TO-1.0 Category 2 ruling 7).
// owns: the proofs that a run on break has every act refused at the intent door with a sentence while its reads go on, and acts
//   again once switched back to work; that the mode is recorded on the contract (written only on break, so a working run keeps
//   its bytes) and reads back; that a mode outside the two, or a run that does not exist, is refused; that a switch is a floor event.
// refuses: a mock of intents.mjs or contract.mjs (runs filed through the real fileRun on a real Supervisor).
// implements: W1.6 (docs/lanes/1.0/W1-work-road.md); ROAD Category 2 ruling 7 ("break clamps acts in the hands' tier, never by a
//   door route": the foreman's door refuses first, the hands' clamp is H1.5).
// invariants: law 4 ("acts are effects, press-gated"): on break no act leaves the foreman.
// faults: F-02 (a refused act, exit 12).
import test from 'node:test'
import assert from 'node:assert/strict'
import { makeSup } from '../../../test/conformance/fake-host.mjs'
import { fileRun, intent, setRunMode, MODES } from '../intents.mjs'
import { readContract, renderContract } from '../contract.mjs'

const file = (s) => fileRun(s, { key: 'wo:wo-6', goal: 'add a test for parse()', by: 'work-order', role: 'coder', tier: 'act', hands: ['read'], acts: ['patch'] })

// spec: Category 2 ruling 7 · class: L3 an act without a press (an act while the owner said break)
// technique: one run switched to break and back, asking a read and an act each time
// method: on break the act is refused with F-02 and the sentence, the read is taken; back at work the act is taken
// sre: when the owner says "take a break", can a run still change something? It must not, and it must say why.
test('a run on break has its acts refused with a sentence while its reads go on; back at work it acts', () => {
  const { s } = makeSup()
  const w = file(s)
  assert.deepEqual(setRunMode(s, w.id, 'break'), { ok: true, mode: 'break', changed: true })
  const act = intent(s, w.id, { tool: 'patch', args: [{ file: 'a.mjs', write: 'x' }] })
  assert.equal(act.ok, false)
  assert.equal(act.fault, 'F-02')
  assert.match(act.why, /the run is on break: patch waits until the owner switches it back to work/)
  assert.equal(intent(s, w.id, { tool: 'read', args: ['a.mjs'] }).ok, true, 'reads go on')
  setRunMode(s, w.id, 'work')
  assert.equal(intent(s, w.id, { tool: 'patch', args: [{ file: 'a.mjs', write: 'x' }] }).ok, true, 'at work the act goes')
})

// spec: W1.6 "the foreman records the run's mode" · class: L5 the record's shape
// technique: render and read the contract at work, on break, and at work again
// method: a working run's contract carries no mode field; on break it carries (mode "break") and reads back as break
// sre: after a foreman restart, does a run that was on break come back on break? It reads its mode from the contract.
test('the mode is recorded on the contract only on break, and reads back', () => {
  const { s } = makeSup()
  const w = file(s)
  const atWork = renderContract(w.contract)
  assert.doesNotMatch(atWork, /\(mode /)
  assert.equal(readContract(atWork).mode, 'work')
  setRunMode(s, w.id, 'break')
  const onBreak = renderContract(w.contract)
  assert.match(onBreak, /\(mode "break"\)\)$/)
  assert.equal(readContract(onBreak).mode, 'break')
  setRunMode(s, w.id, 'work')
  assert.equal(renderContract(w.contract), atWork, 'back at work, the bytes are a working run\'s')
})

// spec: W1.6 · class: W5 malformed (a mode outside the two; a run that does not exist) · E (a switch that changes nothing)
// technique: setRunMode over bad input and a repeated switch, with the host's upstream captured
// method: an unknown mode and an unknown run are refused with a sentence; the same mode twice is no change; a change is one event
// sre: can a typo on the card put a run in a state no code knows? It must be refused.
test('a mode outside the two or an unknown run is refused; a switch is one floor event', () => {
  const { s, h } = makeSup()
  const w = file(s)
  assert.deepEqual(MODES, ['work', 'break'])
  assert.match(setRunMode(s, w.id, 'nap').why, /a run's mode is work or break/)
  assert.match(setRunMode(s, 'w-none', 'break').why, /no such run/)
  assert.equal(setRunMode(s, w.id, 'work').changed, false)
  setRunMode(s, w.id, 'break', { by: 'owner' })
  const events = (h.up || h.upstream || []).filter((u) => (u.kind || u[0]) === 'mode')
  assert.equal(events.length, 1)
})
