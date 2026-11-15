process.env.LACUNA_AUTO_LOADS = '1'   // these tests exercise the automatic swap road, opt-in since 2026-11-04 (the owner decides who is loaded)
// swap-road.test.mjs — E1.2 and E1.5: THE SWAP ROAD AND THE ENGINE'S LAUNCHER, run for real against fakes. Owns: the tests of
// lacuna-box/brain/switch-brain.sh (the dry run's plan; a load that fits; a refused load booted out and the old mind
// restored; both refused) and lacuna-box/brain/lme-serve.sh (the cadence waited out; the fourth start refused), each on a
// scratch box: a fake engine on a unix socket (fixtures/swap-road/fake-engine.mjs), a fake launchctl that starts it or plays
// the engine's memory refusal (fake-launchctl.mjs), a sleep that records instead of sleeping, fake Ollama manifests, a copy
// of the plist template. Refuses: the live launchd, the live engine, the live Ollama (OLLAMA_URL points at a closed port),
// ~/.lacuna and ~/lacuna-world. Implements: E1.2 gate ("the dry run shows drain → release → cadence → load once; a refused
// load produces one record and no retry"), E1.5 gate ("a fake breadcrumb 20 s old → the script sleeps 10 s; three refusals →
// exit with the sentence, no fourth start"). Invariants: "a refused load produces one record and no retry". Faults: F-LME-load.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { makeSup } from '../../../test/conformance/fake-host.mjs'
import { PROFILE_CONTEXT, SWAP_PROFILE, actReply, beginSwap, broker, roadSummary } from '../broker.mjs'
import { brainOver } from '../cascade.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const BRAIN = path.join(HERE, '..', '..', '..', 'lacuna-box', 'brain')
const FIX = path.join(HERE, 'fixtures', 'swap-road')
const DIGEST = { e4b: 'aaaa1111', '12b': 'bbbb2222', '26b': 'cccc3333', '31b': 'dddd4444' }
const TAG = { e4b: 'e4b-it-qat', '12b': '12b-it-qat', '26b': '26b-a4b-it-qat', '31b': '31b-it-qat' }
const now = () => Math.floor(Date.now() / 1000)

// one scratch box: the store, the plist (the template with fake paths), the engine's folder, the log, the fake state
function box({ lastLoadAgo = 600 } = {}) {
  fs.mkdirSync('/private/tmp/lacuna-unit', { recursive: true })
  const d = fs.mkdtempSync('/private/tmp/lacuna-unit/sw-')
  const store = path.join(d, 'models')
  const lib = path.join(store, 'manifests', 'registry.ollama.ai', 'library', 'gemma4')
  fs.mkdirSync(lib, { recursive: true })
  fs.mkdirSync(path.join(store, 'blobs'))
  for (const [mind, dig] of Object.entries(DIGEST)) {
    fs.writeFileSync(path.join(lib, TAG[mind]), JSON.stringify({ layers: [{ mediaType: 'application/vnd.ollama.image.model', digest: `sha256:${dig}` }] }))
    fs.writeFileSync(path.join(store, 'blobs', `sha256-${dig}`), 'gguf')
  }
  const la = path.join(d, 'la')
  const lme = path.join(d, 'lme')
  const state = path.join(d, 'state')
  for (const x of [la, lme, state]) fs.mkdirSync(x)
  const sock = path.join(d, 'd.sock')
  const plist = fs.readFileSync(path.join(BRAIN, 'plists', 'ai.lacunalabs.lme-desk.plist'), 'utf8')
    .replace(/\/Users\/alfred\/\.ollama\/models\/blobs\/sha256-[0-9a-f]+/, path.join(store, 'blobs', `sha256-${DIGEST.e4b}`))
    .replace('/Users/alfred/.lacuna/lme/desk.sock', sock)
  fs.writeFileSync(path.join(la, 'ai.lacunalabs.lme-desk.plist'), plist)
  fs.writeFileSync(path.join(lme, 'breadcrumbs.slat'), '')
  fs.writeFileSync(path.join(lme, 'last-load'), String(now() - lastLoadAgo))
  fs.copyFileSync(path.join(BRAIN, 'box-minds.json'), path.join(d, 'box-minds.json'))
  const env = { ...process.env, LA: la, LAUNCHCTL: path.join(FIX, 'fake-launchctl.mjs'), SWAP_SLEEP: path.join(FIX, 'fake-sleep.sh'),
    OLLAMA_STORE: store, OLLAMA_URL: 'http://127.0.0.1:9', LME_DIR: lme, LME_SOCK: sock, LME_LOG: path.join(d, 'lme.log'),
    MINDS: path.join(d, 'box-minds.json'), KEEP: path.join(d, 'keep.json'), ACTIVE_PROFILE: path.join(d, 'active.json'),
    FAKE_STATE: state, SWAP_STEP: '0.05', SWAP_LOAD_S: '10', SWAP_GONE_S: '5', SWAP_DRAIN_S: '5' }
  fs.writeFileSync(env.LME_LOG, '')
  return { d, env, sock, state, lme, plist: path.join(la, 'ai.lacunalabs.lme-desk.plist') }
}

// a mind serving, as launchd would have started it: its pid where the fake launchctl's bootout finds it
async function serving(b, { mind = 'e4b', busyPolls = 0 } = {}) {
  const child = spawn(process.execPath, [path.join(FIX, 'fake-engine.mjs'), b.sock, `sha256-${DIGEST[mind]}`, 'desk', String(busyPolls)], { detached: true, stdio: 'ignore' })
  child.unref()
  fs.writeFileSync(path.join(b.state, 'engine.pid'), String(child.pid))
  fs.writeFileSync(path.join(b.state, 'loaded'), '')
  for (let i = 0; i < 100 && !fs.existsSync(b.sock); i++) await new Promise((r) => setTimeout(r, 20))
}

const road = (b, args, extra = {}) => spawnSync('/bin/zsh', [path.join(BRAIN, 'switch-brain.sh'), ...args], { env: { ...b.env, ...extra }, encoding: 'utf8', timeout: 60_000 })
const lines = (f) => { try { return fs.readFileSync(f, 'utf8').split('\n').filter(Boolean) } catch { return [] } }
const lastLine = (out) => out.trim().split('\n').pop()
const cleanup = (b) => {
  try { process.kill(Number(fs.readFileSync(path.join(b.state, 'engine.pid'), 'utf8')), 'SIGTERM') } catch { /* no engine left */ }
  fs.rmSync(b.d, { recursive: true, force: true })
}
// the plist a swap loads: its own copy beside the engine's state; the seat's plist (b.plist, launchd's at a boot) is only read
// (E14 row 13)
const swapPlist = (b) => path.join(b.lme, 'ai.lacunalabs.lme-desk.swap.plist')
const plistKey = (b, k) => spawnSync('/usr/libexec/PlistBuddy', ['-c', `Print ${k}`, swapPlist(b)], { encoding: 'utf8' }).stdout.trim()

// spec: E1.2 ("the dry run shows drain → release → cadence → load once"); ROAD-TO-1.0 Category 5 (3); LME-1.0 §3 law 4
// class: E2 the wrong order (a load before the old mind is gone); J14 clock (the cadence read from last-load)
// technique: the real script with --dry-run on a scratch box; a last load 20 s old
// method: read the plan's step lines in order and the cadence's wait; nothing touched: no launchctl call, no sleep
// sre: before the box's brain moves, can the on-call read the whole road and see it waits the engine's cadence?
test('the dry run prints drain → wait → release → cadence → load once → verify, waits the cadence from last-load, and touches nothing', async () => {
  const b = box({ lastLoadAgo: 20 })
  await serving(b)
  const r = road(b, ['gemma4:12b-it-qat', '--dry-run'])
  try {
    assert.equal(r.status, 0, r.stderr)
    const steps = r.stdout.split('\n').map((l) => l.match(/^swap-road: {3}(\d) (\w+)/)).filter(Boolean).map((m) => `${m[1]} ${m[2]}`)
    assert.deepEqual(steps, ['1 drain', '2 wait', '3 release', '4 cadence', '5 load', '6 verify'])
    assert.match(r.stdout, /4 cadence {2}the last load was 2[01] s ago .*: wait (9|10) s/)
    assert.match(r.stdout, /from {2}e4b sha256-aaaa1111 \(profile desk\); health: \(model "sha256-aaaa1111"\)/)
    assert.match(r.stdout, /on a refusal: release at once \(no second try\); restore sha256-aaaa1111 \(profile desk\)/)
    assert.deepEqual(roadSummary({ tail: r.stdout }), { to: '12b', from: 'e4b', profile: 'desk', 'dry-run': true, ok: true, serving: 'e4b' })
    // a dry run reads which plist launchd loaded (`print`, E14 row 13) and calls nothing that moves a job
    assert.deepEqual(lines(path.join(b.state, 'calls.log')).filter((c) => !c.startsWith('print ')), [], 'a dry run boots nothing in or out')
    assert.deepEqual(lines(path.join(b.state, 'sleeps.log')), [])
  } finally { cleanup(b) }
})

// spec: E1.2; the lead's ruling of 10-30 (the 12B swaps on desk in 1.0); broker SWAP_PROFILE; lme profile_named (b5337d4a: desk, worker, sentry, batch, phone-study)
// class: L3 two tables drift (the script's and the broker's)
// technique: the dry run for each mind's tag; the summary's profile against SWAP_PROFILE
// method: one dry run per mind; `--profile` overrides the table; a tag with no manifest is refused before anything moves
// sre: does the road load each mind under the profile the governor priced?
test('the script loads each mind under the broker\'s SWAP_PROFILE, and --profile overrides it', () => {
  const b = box()
  for (const mind of Object.keys(SWAP_PROFILE)) {
    const r = road(b, [`gemma4:${TAG[mind]}`, '--dry-run'])
    assert.equal(roadSummary({ tail: r.stdout })?.profile, SWAP_PROFILE[mind], `${mind}: ${r.stdout}${r.stderr}`)
  }
  assert.equal(roadSummary({ tail: road(b, ['gemma4:12b-it-qat', '--dry-run', '--profile', 'desk']).stdout }).profile, 'desk')
  const none = road(b, ['gemma4:9b-none'])
  assert.equal(none.status, 2); assert.match(none.stdout, /refused: gemma4:9b-none has no manifest/)
  cleanup(b)
})

// spec: E1.2 (drain → wait in flight → release → cadence → load once → verify (health)); POSTMORTEMS 2026-10-30 root cause 6 (a bootstrap before the old process was gone answered error 5)
// class: E2 order; J10 a turn in flight (busy for three polls)
// technique: the real script on fakes; the E4B serving with a turn in flight; a last load 10 s ago
// method: read the fake launchctl's calls (the bootout before the one bootstrap), the load (the 12B on worker, by --profile), the cadence's
//         recorded sleep, the summary and the exit; the plist names the 12B and the profile
// sre: when the 12B fits, does the road finish the turn in flight, wait the cadence, load once and say what serves?
test('a load that fits: the turn in flight finishes, the old engine is gone before one bootstrap, the cadence is waited, (health) names the 12B; exit 0', async () => {
  const b = box({ lastLoadAgo: 10 })
  const seat = fs.readFileSync(b.plist, 'utf8')
  await serving(b, { busyPolls: 3 })
  // a cadence wider than the test's own run: at nice 20 in the CI the road took 20 s to reach its cadence, past the engine's 30 s,
  // and said "no wait" (red at fb4ee8e1, 2026-11-01 12:26Z; once before at 04:36 on 10-31, read then as a flake)
  const r = road(b, ['gemma4:12b-it-qat', '--profile', 'worker'], { SWAP_CADENCE_S: '600' })
  try {
    assert.equal(r.status, 0, r.stdout + r.stderr)
    assert.match(r.stdout, /swap-road: drain: \(ok \(id "swap"\) \(draining #t\) \(busy 1\)\)/)
    assert.match(r.stdout, /wait: (no turn in flight|the engine left after its drain)/)
    const calls = lines(path.join(b.state, 'calls.log')).map((l) => l.split(' ')[0])
    assert.equal(calls.filter((c) => c === 'bootstrap').length, 1, 'load once')
    assert.ok(calls.indexOf('bootout') < calls.indexOf('bootstrap'), `release before load: ${calls}`)
    assert.deepEqual(lines(path.join(b.state, 'loads.log')), [`sha256-${DIGEST['12b']} worker`])
    const [, ago, rest] = r.stdout.match(/cadence: the last load was (\d+) s ago; waiting (\d+) s/) || []
    assert.equal(Number(ago) + Number(rest), 600, `the cadence: 600 s (the test's) less the time since the last load\n${r.stdout}`)
    assert.ok(lines(path.join(b.state, 'sleeps.log')).includes(rest), 'the wait was slept')
    const sum = roadSummary({ tail: r.stdout })
    assert.deepEqual([sum.ok, sum.serving, sum['serving-blob'], sum.profile], [true, '12b', `sha256-${DIGEST['12b']}`, 'worker'])
    assert.equal(path.basename(plistKey(b, ':ProgramArguments:3')), `sha256-${DIGEST['12b']}`)
    assert.equal(plistKey(b, ':EnvironmentVariables:LME_PROFILE'), 'worker')
    // E14 row 13 (sre-04: the seat's plist named the 26B after a swap, so a reboot loaded it): the seat's plist is not written
    assert.equal(fs.readFileSync(b.plist, 'utf8'), seat, 'the seat\'s plist in LaunchAgents is byte-identical after the swap')
    // order §1.5 (2026-11-06): the swap writes the current brain to the brain profile, never the tracked box-minds.json
    assert.equal(fs.readFileSync(b.env.MINDS, 'utf8'), fs.readFileSync(path.join(BRAIN, 'box-minds.json'), 'utf8'), 'box-minds.json untouched')
    const active = JSON.parse(fs.readFileSync(b.env.ACTIVE_PROFILE, 'utf8'))
    assert.equal(active.brain, 'gemma4:12b-it-qat')
    assert.equal(path.basename(active.brain_files[0]), `sha256-${DIGEST['12b']}`)
    assert.equal(active.brain_kv_gb, 2.5)
    const over = brainOver(JSON.parse(fs.readFileSync(b.env.MINDS, 'utf8')), active)
    assert.deepEqual([over.brain, over.brain_kv_gb, over.max_params_b], ['gemma4:12b-it-qat', 2.5, 4], 'the foreman reads the brain from the profile')
  } finally { cleanup(b) }
})

// spec: E1.2 ("a refused load produces one record and no retry"; one try then a record and a letter, law 10); POSTMORTEMS 2026-10-30 (both entries)
// class: E10 a retry (the second try at a refused load); M6 memory (the engine's refusal)
// technique: the fake launchctl plays the 12B's memory refusal exactly as the engine leaves it (breadcrumb, last-load, log)
// method: one bootstrap of the 12B, a bootout at once, the cadence (about 30 s) recorded, one bootstrap of the E4B, never a
//         second of the 12B; exit 3; the summary carries the engine's own words; the broker reads it into one record,
//         one letter and a hold that keeps the dispatcher's next try from becoming a second act
// sre: if the 12B cannot fit, does the desk come back on the E4B, once, with the reason in the record and no loop?
test('a refused load is booted out at once and the E4B restored after the cadence; exit 3; the broker writes one record, one letter, and holds the next try', async () => {
  const b = box()
  await serving(b)
  const r = road(b, ['gemma4:12b-it-qat'], { FAKE_REFUSE: DIGEST['12b'] })
  try {
    assert.equal(r.status, 3, r.stdout + r.stderr)
    assert.deepEqual(lines(path.join(b.state, 'loads.log')), [`sha256-${DIGEST['12b']} desk`, `sha256-${DIGEST.e4b} desk`], 'one try at the 12B, then the E4B')
    const calls = lines(path.join(b.state, 'calls.log')).map((l) => l.split(' ')[0]).filter((c) => c !== 'print')
    assert.deepEqual(calls, ['bootout', 'bootstrap', 'bootout', 'bootstrap'])
    assert.ok(lines(path.join(b.state, 'sleeps.log')).some((s) => Number(s) >= 29 && Number(s) <= 30), 'the restore waits the cadence the refusal re-armed')
    const sum = roadSummary({ tail: r.stdout })
    assert.deepEqual([sum.ok, sum.serving, sum['serving-blob']], [false, 'e4b', `sha256-${DIGEST.e4b}`])
    assert.equal(sum.refused, 'F-LME-load: needs 11245 MB (6637 MB of it already resident) + 1500 MB floor, 1867 MB available')
    // the broker's side of the same road: the hands answer exit 30 with the script's tail (lacuna-executor/acts/repo.mjs)
    const { h, s } = makeSup()
    broker(s).brain = 'e4b'
    beginSwap(s, '12b', 'work order wo-1', 'work-order')
    const d = actReply(s, 'switch-brain', ['12b'])({ exit: 30, status: 3, why: `switch-brain exited 3: ${lastLine(r.stdout)}`, tail: r.stdout })
    assert.deepEqual([d.ok, d.brain], [false, 'e4b'])
    assert.equal(h.rows.length, 1)
    assert.match(h.rows[0], /^\(swap \(@ \("from" "e4b"\) \("to" "12b"\) \("by" "work-order"\).* \("ok" #f\) \("failed" "F-LME-load: needs 11245 MB/)
    assert.match(h.rows[0], /\("profile" "desk"\) \("serving" "e4b"\)/)
    assert.equal(h.letters.length, 1); assert.equal(h.letters[0].severity, 'wrong')
    const again = beginSwap(s, '12b', 'work order wo-1', 'work-order')
    assert.equal(again.swap, null)
    assert.match(again.held, /was refused at .*Z \(F-LME-load: needs 11245 MB.*\); one try: a press starts the next/)
    assert.equal(h.acts.length, 1, 'the dispatcher\'s next pass sends no second act')
  } finally { cleanup(b) }
})

// spec: E1.2 ("a refused load leaves a serving process or backs off"; the road says it when nothing serves); law 6 (a claim is not a record)
// class: M6 memory; E9 the last resort fails
// technique: both models refused by the fake engine
// method: exactly two bootstraps (the 12B once, the E4B once), exit 4, the summary's serving "none"; the broker's brain null and a sick letter
// sre: if neither mind can load, does the box say plainly that nothing serves, instead of a third try?
test('both refused: two loads, never a third; exit 4; nothing serves and the broker says so with a sick letter', async () => {
  const b = box()
  await serving(b)
  const r = road(b, ['gemma4:12b-it-qat'], { FAKE_REFUSE: 'sha256-' })
  try {
    assert.equal(r.status, 4, r.stdout + r.stderr)
    assert.equal(lines(path.join(b.state, 'loads.log')).length, 2)
    const sum = roadSummary({ tail: r.stdout })
    assert.ok(sum, r.stdout)
    assert.deepEqual([sum.ok, sum.serving], [false, null])
    const { h, s } = makeSup()
    broker(s).brain = 'e4b'
    beginSwap(s, '12b', 'pressed', 'owner')
    const d = actReply(s, 'switch-brain', ['12b'])({ exit: 30, status: 4, why: 'switch-brain exited 4', tail: r.stdout })
    assert.equal(d.brain, null)
    assert.equal(h.letters[0].severity, 'sick'); assert.match(h.letters[0].what, /Nothing serves the desk/)
  } finally { cleanup(b) }
})

const launch = (b, extra, args) => spawnSync('/bin/zsh', [path.join(BRAIN, 'lme-serve.sh'), ...args], { env: { ...b.env, LME_SERVE_SLEEP: path.join(FIX, 'fake-sleep.sh'), ...extra }, encoding: 'utf8' })

// spec: E1.5 ("a fake breadcrumb 20 s old → the script sleeps 10 s"); loadlock.cpp:38-40 (the cadence refusal it avoids)
// class: J14 clock; E10 the restart loop
// technique: a fake clock (LME_SERVE_NOW) and a recording sleep; /bin/echo as the engine binary
// method: last-load 20 s before the clock → one sleep of 10, one log line, then the engine's command line run as given
// sre: when launchd restarts the engine inside the cadence, does the start wait instead of being refused?
test('the launcher waits the rest of the cadence (a last load 20 s ago: 10 s), says so in one line, then runs the engine', () => {
  const b = box()
  const t = 2_000_000_000
  fs.writeFileSync(path.join(b.lme, 'last-load'), String(t - 20))
  const r = launch(b, { LME_SERVE_NOW: String(t) }, ['/bin/echo', 'serve', '/x/sha256-aaaa1111', b.sock, '2'])
  assert.equal(r.status, 0, r.stderr)
  assert.deepEqual(lines(path.join(b.state, 'sleeps.log')), ['10'])
  assert.equal(r.stderr.trim(), 'lme-serve: cadence: the last load was 20 s ago; waiting 10 s, then sha256-aaaa1111')
  assert.equal(r.stdout.trim(), `serve /x/sha256-aaaa1111 ${b.sock} 2`, 'the command line as given')
  const quiet = launch(b, { LME_SERVE_NOW: String(t + 100) }, ['/bin/echo', 'serve', '/x/m', b.sock])
  assert.match(quiet.stderr, /^lme-serve: start: m \(the last load was 120 s ago; 0 refused in 300 s\)/)
  cleanup(b)
})

// spec: E1.5 ("three refusals → exit with the sentence, no fourth start"); LACUNA-SCHEME-BEHAVIOURS-1.0 (intensity n seconds)
// class: E10 the restart loop (POSTMORTEMS 2026-10-30: 139 starts in 11 min 42 s)
// technique: breadcrumbs written as the engine writes them; a marker the engine would create if it started
// method: three refused loads of the model inside 300 s → exit 75 with the sentence and nothing started; another model's
//         refusals and refusals older than 300 s do not count; two refusals still start
// sre: if the engine keeps being refused, does the box stop starting it and say why in one line?
test('three refused loads of the model in 300 s: the fourth start is refused with one sentence, exit 75, the engine never starts', () => {
  const b = box()
  const t = 2_000_000_000
  const m = '/x/sha256-bbbb2222'
  const pair = (at, what, ok) => `(load (at ${at}) (what "${what}") (need-mb 11245) (available-mb 7800) (pid 1))\n(loaded (at ${at}) (ok ${ok}))\n`
  fs.writeFileSync(path.join(b.lme, 'breadcrumbs.slat'), pair(t - 400, m, 'off') + pair(t - 250, m, 'off') + pair(t - 200, '/x/other', 'off') + pair(t - 90, m, 'off') + pair(t - 60, m, 'on'))
  fs.writeFileSync(path.join(b.lme, 'last-load'), String(t - 60))
  const marker = path.join(b.d, 'started')
  const lme = path.join(FIX, 'fake-lme.sh')
  const two = launch(b, { LME_SERVE_NOW: String(t) }, [lme, 'serve', m, marker])
  assert.equal(two.status, 0, 'two refusals in the window still start')
  assert.ok(fs.existsSync(marker))
  fs.rmSync(marker)
  fs.appendFileSync(path.join(b.lme, 'breadcrumbs.slat'), pair(t - 30, m, 'off'))
  const r = launch(b, { LME_SERVE_NOW: String(t) }, [lme, 'serve', m, marker])
  assert.equal(r.status, 75)
  assert.equal(r.stderr.trim(), `lme-serve: refused: 3 loads of sha256-bbbb2222 were refused in the last 300 s (${b.lme}/breadcrumbs.slat); no fourth start until the window clears or the swap road loads another mind`)
  assert.equal(fs.existsSync(marker), false, 'no fourth start')
  assert.equal(launch(b, {}, ['/bin/echo']).status, 64, 'no engine command line')
  cleanup(b)
})

// the engine's table, read from its source: name → [context, slots, reuse margin, output cap] (lme/src/engine/profile.cpp)
function engineProfiles() {
  const src = fs.readFileSync(path.join(HERE, '..', '..', '..', 'lme', 'src', 'engine', 'profile.cpp'), 'utf8')
  const rows = [...src.matchAll(/\{"([\w-]+)", (\d+), \d+, (?:true|false), \d+, (\d+), (\d+), (\d+)\}/g)]
  return Object.fromEntries(rows.map((m) => [m[1], m.slice(2).map(Number)]))
}

// spec: the finale's order §3.9 (`long`: 65,536 tokens, one slot, output cap 16,384), §1.14 (`tight` for the 31B: one slot,
//       8,192, cap 4,096); lme/src/engine/profile.cpp; LME-1.0 §4.6c
// class: L3 two tables drift (the engine's rows, the script's shape_of, the door's PROFILE_WINDOW, the broker's PROFILE_CONTEXT
//        that prices a swap's first token); M6 memory (the 11-05 31B load ran the plist's 2 slots, 8,160 MB of KV, and
//        answered nothing)
// technique: the real script on fakes; the plist read back with PlistBuddy after each load
// method: the 26B on `long`: LME_PROFILE worker with LME_CONTEXT, LME_REUSE_MARGIN and LME_OUTPUT_CAP from the engine's row and
//         the slot argument 1; (status) reads it back as long; then the E4B on desk: the three keys gone, two slots again;
//         the 31B's dry run says tight, one slot, its context and cap
// sre: when the owner presses `/swap 26b long` or `/swap 31b`, does the engine get the shape the price was made on?
test('long and tight load as one slot with the engine\'s context, margin and output cap; a desk load after restores two slots', async () => {
  const eng = engineProfiles()
  assert.deepEqual(eng.long, [65536, 1, 4096, 16384])
  assert.deepEqual(eng.tight, [8192, 1, 1024, 4096])
  const agents = fs.readFileSync(path.join(HERE, '..', '..', '..', 'lacuna-node', 'frontend', 'agents.mjs'), 'utf8')
  for (const p of ['long', 'tight', 'worker', 'desk']) assert.match(agents, new RegExp(`[{ ]${p}: ${eng[p][0]}[,}]`), `the door's window for ${p}`)
  for (const [p, context] of Object.entries(PROFILE_CONTEXT)) assert.equal(context, eng[p][0], `the broker's context for ${p}`)
  const b = box()
  await serving(b)
  try {
    const r = road(b, ['gemma4:26b-a4b-it-qat', '--profile', 'long'])
    assert.equal(r.status, 0, r.stdout + r.stderr)
    assert.deepEqual([plistKey(b, ':EnvironmentVariables:LME_PROFILE'), plistKey(b, ':EnvironmentVariables:LME_CONTEXT'),
      plistKey(b, ':EnvironmentVariables:LME_REUSE_MARGIN'), plistKey(b, ':EnvironmentVariables:LME_OUTPUT_CAP'), plistKey(b, ':ProgramArguments:5')],
    ['worker', String(eng.long[0]), String(eng.long[2]), String(eng.long[3]), '1'])
    assert.equal(fs.readFileSync(path.join(b.lme, 'serving-profile'), 'utf8').trim(), 'long')
    assert.match(road(b, ['gemma4:e4b-it-qat', '--dry-run']).stdout, /from {2}26b sha256-cccc3333 \(profile long\)/, 'the plist reads back as long')
    const back = road(b, ['gemma4:e4b-it-qat'])
    assert.equal(back.status, 0, back.stdout + back.stderr)
    assert.deepEqual([plistKey(b, ':EnvironmentVariables:LME_PROFILE'), plistKey(b, ':EnvironmentVariables:LME_CONTEXT'),
      plistKey(b, ':EnvironmentVariables:LME_OUTPUT_CAP'), plistKey(b, ':ProgramArguments:5')], ['desk', '', '', '2'])
    const dry = road(b, ['gemma4:31b-it-qat', '--dry-run'])
    assert.match(dry.stdout, /to {4}31b gemma4:31b-it-qat → .* \(profile tight: 1 slot, 8192 tokens of context, output cap 4096\)/)
  } finally { cleanup(b) }
})

// spec: order 2026-11-06 §1.5 (a swap dirtied the repository: the current brain moved to ~/.lacuna/brain-profile.json)
// class: L3 two tables drift (the box file's brain and the profile's)
// technique: brainOver on a box file and profiles: none, a legacy one (one `file`), a full one
// method: the box's own word stands with no profile; the profile's five brain fields win; configuration fields are never taken from it
// sre: after a swap, does the foreman's cascade cap agents by the brain that really serves, with the repository clean?
test('the brain fields come from the brain profile over the box file; no profile leaves the box file\'s word', () => {
  const box = { agent_minds: ['functiongemma'], reserved: { 'gemma4:e4b': 'x' }, brain: 'old', brain_kv_gb: 3, max_params_b: 2 }
  assert.deepEqual(brainOver(box, null), box)
  assert.equal(brainOver(null, { brain: 'x' }), null)
  const legacy = brainOver(box, { brain: 'gemma4:e4b-it-qat', file: '/b/sha256-e4', reserved: {}, agent_minds: [] })
  assert.deepEqual([legacy.brain, legacy.brain_files, legacy.brain_kv_gb], ['gemma4:e4b-it-qat', ['/b/sha256-e4'], 3])
  assert.deepEqual([legacy.agent_minds, legacy.reserved], [box.agent_minds, box.reserved], 'configuration is never read from the profile')
  const full = brainOver(box, { brain: 'gemma4:12b-it-qat', brain_files: ['~/b'], brain_kv_gb: 2.5, max_params_b: 4, workhorse: 'gemma4:e4b' })
  assert.deepEqual([full.brain_kv_gb, full.max_params_b, full.workhorse], [2.5, 4, 'gemma4:e4b'])
})
