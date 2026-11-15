// hatch.test.mjs — THE HATCH (ROLEBENCH-2.0 §8). Owns: the tests of hatch.mjs: a signed turn runs as a watch worker and is
// one chained record in the foreman's log; an unsigned, forged or replayed turn is refused by the foreman's own gate with a
// sentence; a caller on a network port is refused before the body is read; a watch turn cannot act; the terminal's side
// seals, sends over a real unix socket and reads the answer, and never dials a network address. Refuses: a mock of the
// gate, the supervisor or the log (all real; the socket server below wires the pieces as the foreman's route does).
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { Supervisor } from '../supervisor.mjs'
import { logStream, verify } from '../../../lacuna-scheme/src/log.js'
import { hatchRefusal, hatchTurn, sealTurn, sendTurn, balanced } from '../hatch.mjs'

const KEY = 'the-test-foreman-token'
const dirs = []
test.after(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }) })
function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hatch-'))
  dirs.push(dir)
  let n = 0
  const host = { key: KEY, deadlines: { hand: 10, act: 40, beat: 5, mind: 20, hop: 50 }, now: () => 1000, id: () => `w${++n}`,
    save: () => {}, contract: () => {}, upstream: () => {} }
  const file = path.join(dir, 'logs', 'foreman.slat')
  const stream = logStream(file, 'foreman')
  const log = (stage, text) => stream.write('info', stage, `${stage} ${text}`)
  return { sup: new Supervisor(host), file, log, dir }
}

test('a signed turn runs as a watch worker and is one chained record in the foreman\'s log', async () => {
  const { sup, file, log } = setup()
  const g = sup.gate.open(sealTurn(KEY, { form: '(+ 40 2)', by: 'device:test-mac' }, 1000))
  assert.equal(g.ok, true)
  const r = await hatchTurn(sup, g.msg.body, { kind: g.msg.kind, log, waitMs: 100, now: () => 1000 })
  assert.equal(r.ok, true)
  assert.equal(r.value, 42)
  assert.equal(r.record, '(hatch (at "1970-01-01T00:16:40.000Z") (by "device:test-mac") (form "(+ 40 2)") (answer "value 42"))')
  const text = fs.readFileSync(file, 'utf8')
  assert.match(text, /\(stage "hatch"\) \(msg "hatch \(hatch \(at \\"1970-01-01T00:16:40.000Z\\"\) \(by \\"device:test-mac\\"\)/)
  assert.deepEqual(verify(text), { ok: true, lines: 1, broken: null })
  assert.equal(sup.workers.get(r.worker).tier, 'watch')
})

test('an unsigned, forged or replayed turn is refused by the gate with a sentence, and counted', () => {
  const { sup } = setup()
  const env = sealTurn(KEY, { form: '(+ 1 1)', by: 'device:test-mac' }, 1000)
  assert.deepEqual(sup.gate.open({ slat: env.slat }), { ok: false, drop: 'unsigned', why: 'the message is not signed' })
  assert.equal(sup.gate.open({ slat: env.slat, sig: sealTurn('another-key', { form: '(+ 1 1)', by: 'x' }, 1000).sig }).drop, 'forged')
  assert.equal(sup.gate.open(env).ok, true)
  assert.equal(sup.gate.open(env).drop, 'replayed')
  assert.deepEqual([sup.gate.drops.unsigned, sup.gate.drops.forged, sup.gate.drops.replayed], [1, 1, 1])
})

test('the hatch refuses a network caller and an unsigned body before it reads, each with a sentence', () => {
  assert.match(hatchRefusal({ socket: { remoteAddress: '127.0.0.1' }, headers: { 'content-type': 'application/slat' } }), /unix socket only, never on a network port/)
  assert.match(hatchRefusal({ socket: {}, headers: { 'content-type': 'application/json' } }), /signed \(msg … \(kind hatch\)\) only/)
  assert.equal(hatchRefusal({ socket: {}, headers: { 'content-type': 'application/slat' } }), null)
})

test('a watch turn cannot act, and another kind of message is no hatch turn; both are records', async () => {
  const { sup, file, log } = setup()
  const act = await hatchTurn(sup, { form: "(act 'restart \"door\")", by: 'device:test-mac' }, { kind: 'hatch', log, waitMs: 100 })
  assert.equal(act.ok, false)
  assert.ok(act.why)
  const other = await hatchTurn(sup, { form: '(+ 1 1)' }, { kind: 'talk', log, waitMs: 100 })
  assert.match(other.why, /a hatch turn is a \(msg … \(kind hatch\)\); this one is talk/)
  assert.equal(fs.readFileSync(file, 'utf8').trim().split('\n').length, 2)
})

test('the terminal seals, sends over a real unix socket and reads the answer; it never dials a network address', async () => {
  const { sup, log, dir } = setup()
  const sock = path.join(dir, 'f.sock')
  const server = http.createServer(async (req, res) => {   // wired as the foreman's route wires it
    const no = hatchRefusal(req)
    let text = ''
    for await (const c of req) text += c
    const g = no ? null : sup.gate.open({ slat: text, sig: req.headers['x-slat-sig'] })
    const out = no ? { ok: false, why: no } : !g.ok ? { ok: false, why: `dropped (${g.drop}): ${g.why}` }
      : await hatchTurn(sup, g.msg.body, { kind: g.msg.kind, log, waitMs: 100 })
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(out))
  })
  await new Promise((ok) => server.listen(sock, ok))
  try {
    const r = await sendTurn(sealTurn(KEY, { form: '(* 6 7)', by: 'device:test-mac' }, 1000), { token: KEY, socket: sock })
    assert.deepEqual([r.ok, r.value], [true, 42])
    const bad = await sendTurn({ slat: sealTurn(KEY, { form: '(* 6 7)', by: 'x' }, 1000).slat, sig: '0'.repeat(64) }, { token: KEY, socket: sock })
    assert.match(bad.why, /^dropped \(forged\)/)
  } finally {
    server.close()
  }
  assert.match((await sendTurn({ slat: '', sig: '' }, { token: KEY, socket: 'http://127.0.0.1:1139' })).why, /unix socket only/)
})

test('a typed form is whole when its parentheses balance outside strings and comments', () => {
  assert.equal(balanced("(hand 'disk)"), true)
  assert.equal(balanced('(+ 1'), false)
  assert.equal(balanced('(report "a ) b")'), true)
  assert.equal(balanced('(+ 1 ; a ) comment\n 2)'), true)
  assert.equal(balanced('   '), false)
})

test('a form that asks a hand waits for its reply and says when none came; the turn leaves no worker behind', async () => {
  const { sup, log } = setup()
  const r = await hatchTurn(sup, { form: "(hand 'disk)", by: 'device:test-mac' }, { kind: 'hatch', log, waitMs: 150 })
  assert.equal(r.ok, true)
  assert.match(r.record, /\(answer "value .* \(no reply in 0 s\)"\)\)$/)
  assert.notEqual(sup.workers.get(r.worker).state, 'running')
})
