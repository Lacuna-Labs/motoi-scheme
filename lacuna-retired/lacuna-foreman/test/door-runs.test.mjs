// door-runs.test.mjs — U3: THE DOOR'S RUN, PRESS, CONTRACT, LEDGER AND MAIL ROUTES. Owns: the tests that drive one run
// end to end through a scratch foreman's door the way the brain loop and the hands do (`POST /runs`, `/runs/<id>/intents|
// results|said|finish`, `POST /intents` in slat, `GET /runs/<id>/results|header`, `/contracts/<id>`, `/press`,
// `/press-check` in slat and JSON), and read the records the design says must exist (the contract text, the ledger rows
// behind `GET /runs?…`, the letters behind `GET /mail`). Refuses: the live foreman; a mock of foreman.mjs or intents.mjs.
// Implements: unit-test work order §3 row foreman.mjs (design §6 change 2 the intent door, §8 the contract, §13 the desk;
// eng §3.2 rows 1, 2, 4, 17; §3.3; law 6). Invariants (§18): "if an act ran, then a press ticket preceded it"; "if an envelope
// is unsigned … dropped and counted" (the press-check's own gate). Faults (§16): F-02, F-03, F-10, F-11, F-21.
// coverage: foreman.mjs — see foreman-door.test.mjs (2026-10-24)
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { boot, seal, now, request } from './foreman-box.mjs'
import { Gate } from '../protocol.mjs'

const cleanups = []
let f, dir
before(async () => { ({ f, dir } = await boot({ after: (fn) => cleanups.push(fn) }, { tag: 'runs', env: { LACUNA_LEDGER: '' } })) })
after(async () => { for (const fn of cleanups.reverse()) await fn() })
const file = (b) => f.call('POST', '/runs', b).then((r) => r.body)
const slat = (p, kind, body, key) => { const e = seal(key || f.token(), { from: 'hands', to: 'foreman', kind, body, at: now() }); return f.call('POST', p, e.slat, { headers: { 'content-type': 'application/slat', 'x-slat-sig': e.sig } }) }

// spec: design §6 change 2 (the intent door: tool in the header, deadline ≤ the header's, positional results) · design §8 · eng §3.2 rows 1, 2 · law 6
// class: L2 a step `done` from a report line (never: only the ticket closes it); L1 `pass` without a form
// technique: state-machine walk over one run: filed → intent → result → said → finish, then every read of it
// method: file a run with a done-check form; intent `disk` (200, n 1); a tool outside the header (422 F-02, the refusal
//         logged); the result as a hand (200); results list and result 1 (and 9: 404); the header; said with claims_done;
//         finish with pass → outcome pass because the form held; the contract text says exit 0, outcome pass
// sre: if the brain drives a run through the door, does the record say what the tickets did, not what the brain claimed?
test('one run through the door: intent, a refused tool, result 1, said, finish; the contract and the header read back', async () => {
  const r = await file({ key: 'door-run', goal: 'read the disk', hands: ['disk'], done_check: '(get disk \'ok #t)', by: 'brain' })
  assert.match(r.contract, /^\(task-state /)
  const i = await f.call('POST', `/runs/${r.run}/intents`, { tool: 'disk', args: ['/'], deadline_s: 30 })
  assert.equal(i.status, 200); assert.equal(i.body.n, 1)
  const no = await f.call('POST', `/runs/${r.run}/intents`, { tool: 'shell' })
  assert.equal(no.status, 422); assert.equal(no.body.fault, 'F-02'); assert.ok(f.log.some((l) => l.includes(`refused ${r.run} F-02`)))
  const res = await f.call('POST', `/runs/${r.run}/results`, { ticket: i.body.ticket, exit: 0, ok: true, rows: { free_gb: 9 } })
  assert.equal(res.status, 200)
  assert.deepEqual((await f.call('GET', `/runs/${r.run}/results`)).body.results.map((x) => [x.n, x.tool]), [[1, 'disk']])
  assert.equal((await f.call('GET', `/runs/${r.run}/results/1`)).body.value.rows.free_gb, 9)
  assert.equal((await f.call('GET', `/runs/${r.run}/results/9`)).status, 404)
  const h = (await f.call('GET', `/runs/${r.run}/header`)).body
  assert.deepEqual([h.key, h.hands, h.acts, h.desk], ['door-run', ['disk'], [], false])
  assert.equal((await f.call('POST', `/runs/${r.run}/said`, { text: 'the disk has room', claims_done: true })).body.claimed, true)
  const fin = await f.call('POST', `/runs/${r.run}/finish`, { pass: true, why: 'read' })
  assert.equal(fin.body.outcome, 'pass')
  assert.match((await f.call('GET', `/contracts/${r.run}`)).text, /\(exit 0\) \(outcome "pass"\)/)
  assert.equal((await f.call('POST', `/runs/${r.run}/finish`, { pass: true })).status, 422, 'a run ends once')
  assert.equal((await f.call('GET', `/contracts/${r.run}?as=data`)).headers['content-type'], 'application/slat')
})

// spec: design §6 change 2 ("takes run from the turn, not the body") · design §7.2 (`accepted` is the reply) · eng §3.2 row 1 · eng §3.7 · F-10
// class: W5 malformed (a slat of another kind at the intent door); W1 unsigned
// technique: boundary over the kinds the door accepts; a run that does not exist
// method: POST /intents as slat kind intent (200 with `accepted`); as slat kind said (422 "kind said is not intent"); as
//         JSON for a missing run (404); a refused tool (422); a non-run worker's header and results (404)
// sre: if the brain loop sends the wrong kind or names a run that is gone, does the door refuse it in one sentence?
test('POST /intents: a signed (kind intent) is accepted with its ticket; another kind is 422; a missing run is 404', async () => {
  const r = await file({ key: 'intents-1', goal: 'g', hands: ['disk', 'jobs'] })
  const ok = await slat('/intents', 'intent', { run: r.run, tool: 'jobs', id: 'b-1', deadline: 20 })
  assert.equal(ok.status, 200); assert.equal(ok.body.accepted.intent, 'b-1'); assert.ok(ok.body.accepted.ticket)
  assert.match((await slat('/intents', 'said', { run: r.run, tool: 'jobs' })).body.why, /kind said is not intent/)
  assert.equal((await f.call('POST', '/intents', { run: 'w-none', tool: 'jobs' })).status, 404)
  assert.equal((await f.call('POST', '/intents', { tool: 'jobs' })).status, 404, 'no run named: no such run')
  assert.equal((await f.call('POST', '/intents', { run: r.run, tool: 'git-push' })).status, 422)
  const plain = (await f.call('POST', '/workers', { name: 'plain', program: "(on 'x (lambda (v) v))" })).body.worker
  assert.equal((await f.call('GET', `/runs/${plain.id}/header`)).status, 404)
  assert.equal((await f.call('GET', '/runs/w-none/results')).status, 404)
  assert.equal((await f.call('POST', '/runs/w-none/said', { text: 'x' })).status, 404)
})

// spec: law 4 (acts are press-gated, never re-sent) · design §9 (press tickets have no deadline) · eng §3.2 row 4 (`/press-check`
//       signed both ways) · I-02 ("if an act ran, a press ticket preceded it") · F-08 · F-21 · F-10
// class: L3 an act without a press; W2 forged at the press-check; J10 a body too large
// technique: state-machine walk over a press ticket: asked (wait) → pressed (ok); plus fault injection at the gate
// method: file an act run; intent restart-service (the act's ticket); the same act again (422 F-21); press-check in slat →
//         press-wait signed from foreman to hands; POST /press by the owner; press-check → press-ok, by owner; a forged
//         press-check → 403; one over 64,000 chars → 400; JSON press-check (and one with nothing); a press on no ticket → 404;
//         the act's result posted as kind act lands as result 1
// sre: if the hands ask whether an act may run, is the answer signed, true only after the owner's press, and never forged?
test('the press: an act waits (press-wait) until the owner presses (press-ok); the check is signed both ways and a forged one is 403', async () => {
  const r = await file({ key: 'press-1', goal: 'restart', tier: 'act', acts: ['restart-service'] })
  const i = await f.call('POST', `/runs/${r.run}/intents`, { tool: 'restart-service', args: ['ai.lacunalabs.x'] })
  assert.equal(i.body.kind, 'act')
  assert.equal((await f.call('POST', `/runs/${r.run}/intents`, { tool: 'restart-service', args: ['ai.lacunalabs.x'] })).body.fault, 'F-21')
  const open = (res) => new Gate(f.token(), now).open({ slat: res.text, sig: res.headers['x-slat-sig'] })
  const w1 = open(await slat('/press-check', 'press-check', { press: i.body.ticket }))
  assert.equal(w1.ok, true); assert.equal(w1.msg.kind, 'press-wait'); assert.deepEqual([w1.msg.from, w1.msg.to], ['foreman', 'hands'])
  assert.equal((await f.call('POST', '/press', { ticket: i.body.ticket, by: 'owner' })).status, 200)
  const w2 = open(await slat('/press-check', 'press-check', { ticket: i.body.ticket }))
  assert.equal(w2.msg.kind, 'press-ok'); assert.equal(w2.msg.body.by, 'owner')
  assert.equal((await slat('/press-check', 'press-check', { press: i.body.ticket }, 'k'.repeat(48))).status, 403)
  const huge = seal(f.token(), { from: 'hands', to: 'foreman', kind: 'press-check', body: { press: 'x'.repeat(70_000) }, at: now() })
  assert.equal((await f.call('POST', '/press-check', huge.slat, { headers: { 'content-type': 'application/slat', 'x-slat-sig': huge.sig } })).status, 400)
  assert.equal((await f.call('POST', '/press-check', { ticket: i.body.ticket })).body.pressed, true)
  assert.equal((await f.call('POST', '/press-check')).body.ok, false, 'no ticket, no content type: no press')
  assert.equal((await f.call('POST', '/press', { ticket: 'no-such' })).status, 404)
  const done = await f.call('POST', `/runs/${r.run}/results`, { kind: 'act', ticket: i.body.ticket, exit: 0 })
  assert.equal(done.status, 200); assert.equal((await f.call('GET', `/runs/${r.run}/results/1`)).body.tool, 'restart-service')
})

// spec: design §13 (the desk reads runs: living and ended) · ch. 4 §4.11 (`GET /runs?…` reads the ledger) · law 5 (the ledger read by the one reader)
// class: J7 JSON/slat on hostile input (junk ledger lines); L5 the ledger row's shape
// technique: state put on the ledger file (junk lines beside real rows), then every query arm
// method: end two runs (stopped, fail); append five junk lines (two forms, a number, a short form, another head, a broken
//         form); GET /runs (living only), ?ended=1, ?outcome=fail, ?key=…&limit=1, ?cart=none; each ended row has the shape
// sre: if the ledger holds a torn or foreign line, does the desk's run list still read, skipping only that line?
test('GET /runs: living by default; with a query the ledger\'s ended runs, junk lines skipped, filtered by outcome, key, cart and limit', async () => {
  const a = await file({ key: 'led-a', goal: 'g' }); const b = await file({ key: 'led-b', goal: 'g' })
  await f.call('POST', `/runs/${a.run}/finish`, { pass: true }); await f.call('POST', `/runs/${b.run}/finish`, { pass: false, why: 'no' })
  const ledger = path.join(dir, 'ledger', 'runs.slat')
  fs.appendFileSync(ledger, '(run (@ ("id" "x"))) (run (@))\n42\n(run)\n(mail (@ ("id" "m")))\n(run (@ ("id" "y"\n')
  const living = (await f.call('GET', '/runs')).body
  assert.equal(living.ended, undefined); assert.equal(living.runs.some((x) => x.id === a.run), false)
  const ended = (await f.call('GET', '/runs?ended=1')).body.ended
  assert.deepEqual(ended.map((x) => x.key).slice(0, 2), ['led-b', 'led-a'], 'newest first, junk skipped')
  assert.deepEqual(Object.keys(ended[0]).sort(), ['cart', 'ended', 'exit', 'first_try', 'id', 'key', 'living', 'outcome'])
  assert.deepEqual((await f.call('GET', '/runs?outcome=fail')).body.ended.map((x) => x.key), ['led-b'])
  assert.equal((await f.call('GET', '/runs?key=led-a&limit=1')).body.runs.length, 1)
  assert.deepEqual((await f.call('GET', '/runs?cart=none')).body.runs, [])
})

// spec: design §9 (mail is the channel; dedupe) · eng §3.2 row 17 (one `(mail …)` per file; a repeat raises `count` in place) · F-11 · law 7
// class: J11 fs (the mail dir missing; a letter file gone before its count); J7 junk letter files
// technique: state-machine walk over a letter: none → one → the same again (count 2) → its file removed → again (count 3)
// method: GET /mail before any letter ([]); POST a bad kind (422); POST a letter; the same letter (count 2 in place, one
//         file); junk .slat files beside it read as nulls with count 1; ?n=1; ?to=someone (empty); delete the file and send
//         again (no crash, ok)
// sre: if the same trouble is mailed a hundred times, is it one file with a count, and can no file on disk crash the reader?
test('mail: none yet is [], a repeat is one file with count 2, junk files read as nulls, a removed file never crashes the count', async () => {
  assert.deepEqual((await f.call('GET', '/mail')).body.mail, [])
  assert.equal((await f.call('POST', '/mail', { kind: 'gossip', what: 'x' })).status, 422)
  const one = (await f.call('POST', '/mail', { kind: 'self-report', severity: 'note', what: 'the disk is at 91%', run: 'r', untrusted: true })).body
  const two = (await f.call('POST', '/mail', { kind: 'self-report', severity: 'note', what: 'the disk is at 91%' })).body
  assert.equal(two.count, 2); assert.equal(two.id, one.id)
  const md = path.join(dir, 'mail'); const files = fs.readdirSync(md)
  assert.equal(files.length, 1); assert.match(fs.readFileSync(path.join(md, files[0]), 'utf8'), /\("count" 2\)/)
  for (const [n, t] of [['0-a.slat', '(mail (@)) (mail (@))'], ['0-b.slat', '7'], ['0-c.slat', '(mail)'], ['0-d.slat', '(run (@ ("id" "r")))'], ['0-e.slat', '(mail (@ ("id"']]) fs.writeFileSync(path.join(md, n), t)
  const all = (await f.call('GET', '/mail?to=claude')).body.mail
  assert.equal(all[0].count, 2); assert.equal(all[0].what, 'the disk is at 91%')
  assert.ok(all.slice(1).every((m) => m.id === null && m.count === 1))
  assert.equal((await f.call('GET', '/mail?n=1')).body.mail.length, 1)
  assert.deepEqual((await f.call('GET', '/mail?to=someone')).body.mail, [])
  fs.unlinkSync(path.join(md, files[0]))
  assert.equal((await f.call('POST', '/mail', { kind: 'self-report', severity: 'note', what: 'the disk is at 91%' })).body.count, 3)
})

// spec: eng §3.2 row 17 (the mail dir is the foreman's folder) · design §9 · F-11
// class: J11 fs ENOTDIR (a mail dir that cannot be made)
// technique: fault injection (LACUNA_MAIL_DIR under a regular file)
// method: boot with the mail dir under a file; POST a letter twice; read 200 both times, the log line "could not write mail",
//         and no crash on the count of a letter that has no file
// sre: if the disk refuses the mail, does the foreman keep running and say so in its log?
test('a mail dir that cannot be made: the letter is refused by the disk, logged, and the foreman keeps serving', async (t) => {
  const { f: g, dir: d } = await boot(t, { tag: 'mailx', env: { LACUNA_MAIL_DIR: '/dev/null/mail' } })
  for (let i = 0; i < 2; i++) assert.equal((await g.call('POST', '/mail', { kind: 'self-report', what: 'no room' })).status, 200)
  assert.ok(g.log.some((l) => l.includes('could not write mail')))
  assert.equal((await g.call('GET', '/health')).status, 200); assert.equal(fs.existsSync(path.join(d, 'mail')), false)
})

// spec: design §8 (the contract is served by `GET /contracts/<id>`; a run's contract after its worker record is pruned) · eng §3.5 (prune every 6 h)
// class: J16 a Map that grows (the contract cache outlives the pruned record); E12 what is kept
// technique: time travel (foreman-clock.mjs: the 6 h prune every 2.2 s) and an mtime moved 8 days back
// method: boot fast; no ledger yet (ended is []); file and finish a run; age its record 8 days; wait for the prune (gone:
//         /workers/<id> 404); GET /contracts/<id> still answers the contract text from memory; a never-filed id is 404
// sre: if the desk asks for an old run's contract after the prune, does it still get it rather than an error?
test('a pruned run\'s contract is still served from the foreman\'s memory; an unknown run is 404', async (t) => {
  // the hush on the box's real load has its own test (foreman-manners); this one is about pruning, so its scratch foreman's
  // load line is out of reach (2026-10-25: a model sitting beside the CI put the load at 12.8 and hushed every filing)
  const { f: g, dir: d } = await boot(t, { tag: 'prn', clock: 0.0001, env: { FOREMAN_LOAD: '1000' } })
  assert.deepEqual((await g.call('GET', '/runs?ended=1')).body.ended, [], 'no ledger yet: nothing ended')
  await g.call('POST', '/workers', { name: 'alive', program: "(on 'x (lambda (v) v))" })   // a living worker for the state notes
  // under load the foreman hushes and refuses a new run (correctly); file it once the hush lifts (2026-10-25: under the CI's
  // load this test read `undefined` for the run and failed on a path, not on its subject)
  let r = {}
  for (let i = 0; i < 40 && !r.run; i++) { r = (await g.call('POST', '/runs', { key: 'old', goal: 'g' })).body; if (!r.run) await new Promise((res) => setTimeout(res, 250)) }
  assert.ok(r.run, `the run was filed (${JSON.stringify(r).slice(0, 120)})`)
  await g.call('POST', `/runs/${r.run}/finish`, { pass: false })
  const rec = path.join(d, 'workers', `${r.run}.json`); const old = (Date.now() - 8 * 86400_000) / 1000
  fs.utimesSync(rec, old, old)
  const end = Date.now() + 6000; while (fs.existsSync(rec) && Date.now() < end) await new Promise((res) => setTimeout(res, 50))
  assert.equal(fs.existsSync(rec), false, 'pruned')
  assert.equal((await g.call('GET', `/workers/${r.run}`)).status, 404)
  const c = await g.call('GET', `/contracts/${r.run}`)
  assert.equal(c.status, 200); assert.match(c.text, /\(task-state /)
  assert.equal((await g.call('GET', '/contracts/w-never')).status, 404)
})

// spec: eng §3.2 row 2 ("a socket caller or Accept: application/slat gets a signed reply") · law 5
// class: W8 a reply that cannot be sealed (a body with what slat cannot carry)
// technique: boundary: a result value with a number slat has no form for, read back over the socket
// method: post a result whose value holds 1e999 (Infinity once parsed); read it back over the socket: the reply seals (the JSON
//         round trip turns Infinity into null) and opens at the gate
// sre: if a hand returns a number slat cannot write, does the door still answer instead of hanging the caller?
test('a reply holding a number slat cannot write is still sealed (null in its place) and opens at the gate', async () => {
  const r = await file({ key: 'inf', goal: 'g', hands: ['disk'] })
  const i = (await f.call('POST', `/runs/${r.run}/intents`, { tool: 'disk' })).body
  await f.call('POST', `/runs/${r.run}/results`, `{"ticket":"${i.ticket}","exit":0,"x":1e999}`, { headers: { 'content-type': 'application/json' } })
  const res = await request({ socketPath: f.sock, method: 'GET', path: `/runs/${r.run}/results/1`, headers: { 'X-Foreman-Token': f.token() } })
  const o = new Gate(f.token(), now).open({ slat: res.text, sig: res.headers['x-slat-sig'] })
  assert.equal(o.ok, true); assert.equal(o.msg.body.value.x, null)
})
