// vm-sidecar.test.mjs — the foreman's road to the Lacuna VM (vm-sidecar.mjs): a real `lvm serve` on a scratch socket; programs
// evaluated through the envelope; a grant's session holds its verbs and no others; a request answered once; the R7RS probe
// through the socket. Skipped when vm/build/lvm is not built (cmake -S vm -B vm/build && cmake --build vm/build).
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { vmEval, vmRequest, sidecarOn, vmActorOn, vmRunActorSteps } from '../vm-sidecar.mjs'
import { rehearseTen } from '../rehearsal.mjs'
import { TESTS } from '../../../docs/eng/scheme-1.0/research/probe/tests.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const LVM = path.resolve(HERE, '../../../vm/build/lvm')
const built = fs.existsSync(LVM)
let dir, socket, server, sealedSocket, sealedServer, keyPath

before(async () => {
  if (!built) return
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lvm-sidecar-'))
  socket = path.join(dir, 'vm.sock')
  server = spawn(LVM, ['serve', '--socket', socket], { stdio: ['ignore', 'ignore', 'pipe'] })
  // a second VM whose socket takes sealed envelopes only: a scratch key, named by its path (law 7)
  keyPath = path.join(dir, 'vm.key')
  fs.writeFileSync(keyPath, 'test-' + 'k'.repeat(40) + '\n', { mode: 0o600 })
  sealedSocket = path.join(dir, 'vm-sealed.sock')
  sealedServer = spawn(LVM, ['serve', '--socket', sealedSocket, '--key', keyPath], { stdio: ['ignore', 'ignore', 'pipe'] })
  for (let i = 0; i < 100 && !(fs.existsSync(socket) && fs.existsSync(sealedSocket)); i++) await new Promise((r) => setTimeout(r, 20))
})
after(() => {
  if (server) server.kill()
  if (sealedServer) sealedServer.kill()
  if (dir) fs.rmSync(dir, { recursive: true, force: true })
})

test('the road is off unless LACUNA_VM=sidecar', () => {
  const was = process.env.LACUNA_VM
  delete process.env.LACUNA_VM
  assert.equal(sidecarOn(), false)
  process.env.LACUNA_VM = 'sidecar'
  assert.equal(sidecarOn(), true)
  if (was === undefined) delete process.env.LACUNA_VM
  else process.env.LACUNA_VM = was
})

test('a program evaluates on the VM and its value comes back as data', { skip: !built }, async () => {
  const r = await vmEval('(define (sq x) (* x x)) (map sq (list 1 2 3))', { socket })
  assert.equal(r.ok, true)
  assert.deepEqual(r.value, [1, 4, 9])
  const big = await vmEval('(expt 2 100)', { socket })
  assert.match(big.text, /\(value 1267650600228229401496703205376\)/)
})

test('the foreman runs as a cart: the verbs it holds, and no others', { skip: !built }, async () => {
  const shown = await vmEval('(show time)', { socket })
  assert.equal(shown.ok, true)
  const ran = await vmEval('(run (echo hi))', { socket })
  assert.equal(ran.ok, false)
  assert.match(ran.text, /run is not bound here/)
})

test('a sender with no grant is refused; a mind answers in its own session', { skip: !built }, async () => {
  const r = await vmRequest('(show time)', { socket, from: 'nobody' })
  assert.equal(r.act, 'refuse')
  const m = await vmRequest('(show disk)', { socket, from: 'studio.minds.triage' })
  assert.equal(m.act, 'inform')
  const bad = await vmRequest('(run (rm -rf /))', { socket, from: 'studio.minds.triage' })
  assert.equal(bad.act, 'refuse')
})

test('the R7RS probe, through the socket: 84 of 84', { skip: !built }, async () => {
  let pass = 0
  for (const [, src] of TESTS) {
    const r = await vmEval(`#!r7rs\n${src}`, { socket })
    if (r.ok && r.value?.name === undefined && (r.value === true || /\(value #t\)/.test(r.text))) pass++
  }
  assert.equal(pass, TESTS.length)
})

test('law 5 on the hop: with a key, envelopes go sealed both ways, and an unsealed or forged one is refused', { skip: !built }, async () => {
  const ok = await vmEval('(* 6 7)', { socket: sealedSocket, keyPath })
  assert.equal(ok.ok, true)
  assert.equal(ok.value, 42)
  const bare = await vmRequest('(show time)', { socket: sealedSocket, keyPath: '' })
  assert.equal(bare.act, 'refuse')
  assert.match(bare.text, /sealed envelopes only/)
  const other = path.join(dir, 'other.key')
  fs.writeFileSync(other, 'another-key\n', { mode: 0o600 })
  await assert.rejects(vmEval('(* 6 7)', { socket: sealedSocket, keyPath: other }), /the seal does not verify/)
})

test('step B (CL-VM11 B.1–B.3): rehearseTen passes 10/10 with VM actor workers on eval:<name> sessions, and LACUNA_VM=js keeps the JS fallback', { skip: !built }, () => {
  assert.equal(vmActorOn('eval:rehearsal-watchdog-red'), true)
  const ten = rehearseTen({ vmWorkers: true })
  assert.equal(ten.passed, 10)
  assert.equal(ten.failed, 0)
  for (const r of ten.rows) {
    assert.equal(r.outcome, 'pass', r.id)
    assert.equal(r.vmActor?.ok, true, r.id)
    assert.equal(r.vmActor?.runtime, 'lvm', r.id)
    assert.equal(r.vmActor?.stepCount, r.stepCount, r.id)
    assert.equal(r.vmActor?.latchClosed, true, r.id)
  }
  const prev = process.env.LACUNA_VM
  try {
    process.env.LACUNA_VM = 'js'
    assert.equal(vmActorOn('eval:rehearsal-watchdog-red'), false)
    const fb = vmRunActorSteps({ id: 'w-fb-1', session: 'eval:test', steps: [{ op: 'disk', exit: 0 }], latchClosed: true })
    assert.equal(fb.runtime, 'js-fallback')
    assert.equal(fb.fallback, 'js')
  } finally {
    if (prev === undefined) delete process.env.LACUNA_VM
    else process.env.LACUNA_VM = prev
  }
})
