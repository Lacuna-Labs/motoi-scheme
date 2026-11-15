// tells.test.mjs — THE OWNER'S TELLS ON THE FOREMAN (WORK-CHIPS-CHAT-DESIGN-2026-11-06 §5.1, §8 row P5; lane control). Owns: the
// proofs that each tell verb is filed as one waiting `(tell …)` row and refused where the entity does not take it (a service takes
// no words); that a record tell's press writes its record and a task tell's press starts exactly one task, never before the press
// and never twice; that a press without `pressed: true` decides nothing; that the owner's hush and his notes are read by the
// foreman; and that a scratch foreman's door files, presses and reports the hush on /health. Refuses: the live foreman and
// ~/lacuna-world (every file is under a scratch dir); a mock of tells.mjs. Implements: §5.1, §8 row P5; law 4. Invariants:
// "if an act ran, a press preceded it"; "every tell is a row". Faults: F-02 (a tell's arguments refused).
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { TELLS, NO_WORDS, checkTell, takes, takesWords, kindOf, fileTell, listTells, pressTell, ownerHush, notesTo, readNotes, rows, files } from '../tells.mjs'
import http from 'node:http'
import { boot, scratch as scratch2, seal, now, sleep, until } from './foreman-box.mjs'
import { Gate } from '../protocol.mjs'

const scratch = () => fs.mkdtempSync(path.join(os.tmpdir(), 'tells-'))
const T0 = 1_794_000_000

// one good tell per verb, and the record head it leaves when pressed (the table is the contract: a verb added without a case fails)
const CASES = {
  hush: { to: 'lacuna.foreman', args: { minutes: 15 }, head: 'hush' },
  note: { to: 'forge', args: { said: 'park the 1B tonight', via: 'ipad' }, head: 'note-from-owner' },
  known: { to: 'lacuna.ci', args: { suite: 'python', until: '34062fc5' }, head: 'known' },
  forget: { to: 'cortex', args: { id: 'chunk:9f2a' }, head: 'forget' },
  correct: { to: 'cortex', args: { id: 'chunk:9f2a', said: 'the desk runs the E4B, not the 8B' }, head: 'correct' },
  recheck: { to: 'sentry:w-1a35f9', args: { step: 3 }, head: 'recheck' },
  ignore: { to: 'sentry:w-1a35f9', args: { claim: 'I restarted it' }, head: 'ignore' },
  restart: { to: 'lacuna.runtime', args: { label: 'ai.lacunalabs.runtime', why: 'the owner held restart on its panel' }, head: null },
}

// spec: §5.1 the table · class: E a verb with no case · sre: can a tell verb ship without the test that proves its road?
test('every tell verb has its case, and the kinds read from ids as the registry names them', () => {
  assert.deepEqual(Object.keys(TELLS).sort(), Object.keys(CASES).sort())
  assert.equal(kindOf('lacuna.foreman'), 'foreman'); assert.equal(kindOf('lacuna.ci'), 'ci'); assert.equal(kindOf('lacuna.executor'), 'service')
  assert.equal(kindOf('sentry:w-1'), 'sentry'); assert.equal(kindOf('cortex'), 'cortex'); assert.equal(kindOf('nobody'), null)
  assert.deepEqual(takes('lacuna.foreman'), ['hush', 'note', 'restart'])
  assert.deepEqual(takes('lacuna.inference'), ['restart'])
  assert.equal(takesWords('lacuna.executor'), false); assert.equal(takesWords('lacuna.ci'), true); assert.equal(takesWords('forge'), true)
})

// spec: RL43 takes words · class: F-02 refused args · sre: does a word to a service, or a secret, ever become a row?
test('a tell the entity does not take is refused with its sentence, and nothing is written', () => {
  const d = scratch()
  assert.match(checkTell({ to: 'lacuna.executor', verb: 'note', args: { said: 'hi' } }).why, new RegExp(NO_WORDS))
  assert.match(checkTell({ to: 'lacuna.ci', verb: 'note', args: { said: 'hi' } }).why, /known <suite> until <sha>/)
  assert.match(checkTell({ to: 'cortex', verb: 'note', args: { said: 'hi' } }).why, /correct <id>/)
  assert.match(checkTell({ to: 'lacuna.foreman', verb: 'hush', args: { minutes: 600 } }).why, /1 to 240/)
  assert.match(checkTell({ to: 'lacuna.foreman', verb: 'note', args: { said: 'token: abcdef123' } }).why, /secret/)
  assert.match(checkTell({ to: 'lacuna.runtime', verb: 'restart', args: { label: 'com.apple.Finder', why: 'x' } }).why, /ai\.lacunalabs/)
  assert.match(checkTell({ to: 'lacuna.runtime', verb: 'restart', args: { label: 'ai.lacunalabs.runtime' } }).why, /says why/)
  assert.match(checkTell({ to: 'nobody', verb: 'note', args: { said: 'hi' } }).why, /no entity/)
  assert.equal(fileTell(d, { to: 'lacuna.executor', verb: 'note', args: { said: 'hi' } }, T0).ok, false)
  assert.equal(fs.existsSync(files(d).petitions), false, 'a refusal writes nothing')
})

// spec: §5.1 one road, law 4 · class: press gate, never re-sent · technique: a counting task road per verb
for (const [verb, c] of Object.entries(CASES)) {
  test(`${verb}: filed waiting, nothing happens before the press, one press → ${c.head ? `one (${c.head} …) record` : 'one task through the executor'}, a second press is refused`, async () => {
    const d = scratch(); const tasks = []
    const io = { task: async (t) => { tasks.push(t); return { ok: true, run: 'w-task1' } } }
    const f = fileTell(d, { to: c.to, verb, args: c.args, by: 'owner' }, T0)
    assert.equal(f.ok, true, f.why); assert.equal(f.state, 'waiting'); assert.equal(f.end, c.head ? 'record' : 'task')
    assert.equal(listTells(d, { to: c.to })[0].state, 'waiting')
    assert.equal(tasks.length, 0); assert.equal(rows(files(d).told).length, 0, 'nothing before the press')
    assert.match((await pressTell(d, f.petition, { approve: true }, T0 + 1, io)).why, /signed press/, 'no pressed flag, no decision')
    const p = await pressTell(d, f.petition, { approve: true, pressed: true, by: 'device:ipad' }, T0 + 2, io)
    assert.equal(p.ok, true, p.why)
    if (c.head) {
      assert.equal(p.state, 'recorded'); assert.equal(tasks.length, 0)
      const told = rows(files(d).told); assert.equal(told.length, 1); assert.equal(told[0].head, c.head)
      assert.equal(told[0].row.to, c.to); assert.equal(told[0].row.petition, f.petition); assert.equal(told[0].row.by, 'device:ipad')
      assert.match(p.said, /recorded as/)
    } else {
      assert.equal(p.state, 'ran'); assert.equal(p.run, 'w-task1'); assert.equal(tasks.length, 1)
      assert.equal(tasks[0].playbook, 'service-restart'); assert.deepEqual(tasks[0].bindings[2], [{ label: 'ai.lacunalabs.runtime' }])
    }
    const again = await pressTell(d, f.petition, { approve: true, pressed: true }, T0 + 3, io)
    assert.equal(again.ok, false); assert.match(again.why, /never re-sent/); assert.equal(tasks.length, c.head ? 0 : 1)
  })
}

// spec: §5.1 · class: a declined press · sre: does a no leave a row and start nothing?
test('a declined tell leaves its row and starts nothing; a task that does not start says why on the row', async () => {
  const d = scratch(); let n = 0
  const a = fileTell(d, { to: 'lacuna.ci', verb: 'restart', args: { label: 'ai.lacunalabs.ci', why: 'red for 58 h' } }, T0)
  const no = await pressTell(d, a.petition, { approve: false, pressed: true }, T0 + 1, { task: async () => { n++; return { ok: true } } })
  assert.equal(no.state, 'declined'); assert.equal(n, 0); assert.equal(listTells(d)[0].state, 'declined')
  const b = fileTell(d, { to: 'lacuna.ci', verb: 'restart', args: { label: 'ai.lacunalabs.ci', why: 'red for 58 h' } }, T0 + 2)
  const bad = await pressTell(d, b.petition, { approve: true, pressed: true }, T0 + 3, { task: async () => ({ ok: false, why: 'no playbook service-restart' }) })
  assert.equal(bad.ok, false); assert.equal(listTells(d).find((x) => x.id === b.petition).state, 'failed')
  assert.match(listTells(d).find((x) => x.id === b.petition).why, /no playbook/)
})

// spec: §5.1 the record the entity reads at its next boundary · class: honest null · sre: does a record nobody reads say so?
test('the hush stands until its until; the foreman reads its notes once; a record with no reader says so', async () => {
  const d = scratch(); const io = {}
  const h = fileTell(d, { to: 'lacuna.foreman', verb: 'hush', args: { minutes: 15 } }, T0)
  assert.equal(ownerHush(d, T0), null, 'no hush before the press')
  const hp = await pressTell(d, h.petition, { pressed: true }, T0, io)
  assert.match(hp.said, /the foreman, before its next new work/)
  assert.equal(ownerHush(d, T0 + 899).until, T0 + 900); assert.equal(ownerHush(d, T0 + 900), null)
  const n = fileTell(d, { to: 'lacuna.foreman', verb: 'note', args: { said: 'take the CI first' } }, T0)
  await pressTell(d, n.petition, { pressed: true }, T0, io)
  assert.equal(notesTo(d, 'lacuna.foreman')[0].read, null)
  assert.equal(readNotes(d, 'lacuna.foreman', T0 + 15), 1); assert.equal(readNotes(d, 'lacuna.foreman', T0 + 30), 0, 'read once')
  assert.equal(notesTo(d, 'lacuna.foreman')[0].read, T0 + 15)
  const k = fileTell(d, { to: 'lacuna.ci', verb: 'known', args: { suite: 'python', until: '34062fc5' } }, T0)
  const kp = await pressTell(d, k.petition, { pressed: true }, T0, io)
  assert.equal(kp.reader, null); assert.match(kp.said, /does not read known rows yet/)
})

const cleanups = []
let box
before(async () => { ({ f: box } = await boot({ after: (fn) => cleanups.push(fn) }, { tag: 'tells' })) })
after(async () => { for (const fn of cleanups.reverse()) await fn() })

// spec: §5.1, §8 row P5 · class: W1 a door that answers · technique: the scratch foreman (its own FOREMAN_DIR)
test('the door files a hush, refuses a press without the flag, records the pressed one, and /health says the owner hushed it', async () => {
  const f = await box.call('POST', '/tells', { to: 'lacuna.foreman', verb: 'hush', args: { minutes: 15 }, by: 'owner' })
  assert.equal(f.status, 200, JSON.stringify(f.body)); assert.equal(f.body.state, 'waiting')
  assert.equal((await box.call('POST', '/tells', { to: 'lacuna.executor', verb: 'note', args: { said: 'hi' } })).status, 422)
  assert.equal((await box.call('POST', `/tells/${f.body.petition}/press`, { approve: true })).status, 409)
  assert.equal((await box.call('POST', '/tells/t-none/press', { approve: true, pressed: true })).status, 404)
  const p = await box.call('POST', `/tells/${f.body.petition}/press`, { approve: true, pressed: true, by: 'device:ipad' })
  assert.equal(p.status, 200, JSON.stringify(p.body)); assert.equal(p.body.state, 'recorded')
  assert.match(String((await box.call('GET', '/health')).body.hushed), /the owner hushed me until/)
  const l = await box.call('GET', '/tells?to=lacuna.foreman')
  assert.equal(l.body.tells[0].state, 'recorded')
})

// spec: §5.1 "one press → one task the executor runs", law 4 · class: the press gate end to end · technique: a scratch foreman and a
// scratch hands socket that opens every signed hop · sre: can a restart reach the executor before the owner's press, or twice?
test('a restart tell reaches the executor as one pressed launchd-kickstart only after the press, and never on a second press', async (t) => {
  const dir = scratch2('tellx'); const sock = path.join(dir, 'h.sock'); const seen = []
  const { f } = await boot(t, { dir, env: { LACUNA_HANDS_SOCK: sock } })
  const srv = http.createServer((req, res) => {
    let text = ''; req.setEncoding('utf8'); req.on('data', (d) => { text += d })
    req.on('end', () => {
      const key = fs.readFileSync(path.join(dir, 'token'), 'utf8').trim()
      const got = new Gate(key, () => Number(text.match(/\(at ([\d.]+)\)/)?.[1]) || now()).open({ slat: text, sig: req.headers['x-slat-sig'] })
      if (got.ok) seen.push(got.msg.body)
      const out = seal(key, { from: 'hands', to: 'foreman', kind: 'result', body: { ticket: got.msg?.body?.ticket ?? null, exit: 0, rows: { label: 'ai.lacunalabs.runtime', pid: 42 } }, at: now() })
      res.writeHead(200, { 'Content-Type': 'application/slat', 'X-Slat-Sig': out.sig }); res.end(out.slat)
    })
  })
  await new Promise((r) => srv.listen(sock, r)); t.after(() => new Promise((c) => { srv.closeAllConnections?.(); srv.close(() => c()) }))
  const filed = await f.call('POST', '/tells', { to: 'lacuna.runtime', verb: 'restart', args: { label: 'ai.lacunalabs.runtime', why: 'the owner held restart' } })
  assert.equal(filed.status, 200, JSON.stringify(filed.body)); assert.equal(filed.body.end, 'task')
  await sleep(300)
  assert.equal(seen.filter((b) => b.op === 'launchd-kickstart').length, 0, 'nothing reaches the executor before the press')
  const p = await f.call('POST', `/tells/${filed.body.petition}/press`, { approve: true, pressed: true, by: 'device:ipad' })
  assert.equal(p.status, 200, JSON.stringify(p.body)); assert.equal(p.body.state, 'ran'); assert.match(p.body.run, /^w-/)
  await until(() => seen.some((b) => b.op === 'letter'), 8000)
  const kicks = seen.filter((b) => b.op === 'launchd-kickstart')
  assert.equal(kicks.length, 1); assert.equal(kicks[0].pressed, true); assert.equal(kicks[0].pressed_by, 'owner')
  assert.deepEqual(kicks[0].args, [{ label: 'ai.lacunalabs.runtime' }])
  assert.equal((await f.call('POST', `/tells/${filed.body.petition}/press`, { approve: true, pressed: true })).status, 409)
  await sleep(200)
  assert.equal(seen.filter((b) => b.op === 'launchd-kickstart').length, 1, 'one press, one task')
})
