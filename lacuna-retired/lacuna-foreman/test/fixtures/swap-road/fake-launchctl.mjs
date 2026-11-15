#!/usr/bin/env node
// fake-launchctl.mjs — A STAND-IN FOR launchctl ON THE SWAP ROAD (swap-road.test.mjs). Owns: `bootout`, `bootstrap` and
// `print` for one job, every call written to $FAKE_STATE/calls.log; a bootstrap starts fake-engine.mjs on $LME_SOCK with the
// plist's model, or, when $FAKE_REFUSE names that model, plays the engine's memory refusal exactly as the engine leaves it
// (the breadcrumb pair with `(ok off)`, last-load written, the F-LME-load line in the log) and starts nothing. Refuses:
// touching the real launchd. Implements: the parts of launchctl(1) switch-brain.sh calls. Invariants: none. Faults: none.
import fs from 'node:fs'
import path from 'node:path'
import { spawn, execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const [cmd, a1, a2] = process.argv.slice(2)
if (!cmd) process.exit(0)   // `node --test` runs every file under test/: with no command there is nothing to do
const S = process.env.FAKE_STATE
const LME = process.env.LME_DIR
const now = () => Math.floor(Date.now() / 1000)
fs.appendFileSync(path.join(S, 'calls.log'), `${[cmd, a1, a2].filter(Boolean).join(' ')}\n`)
const pidFile = path.join(S, 'engine.pid')
const loaded = path.join(S, 'loaded')
if (cmd === 'print') process.exit(fs.existsSync(loaded) ? 0 : 113)
if (cmd === 'bootout') {
  try {
    const pid = Number(fs.readFileSync(pidFile, 'utf8'))
    process.kill(pid, 'SIGTERM')
    for (let i = 0; i < 100; i++) { try { process.kill(pid, 0) } catch { break } execFileSync('/bin/sleep', ['0.05']) }
  } catch { /* no engine running */ }
  fs.rmSync(pidFile, { force: true }); fs.rmSync(loaded, { force: true })
  process.exit(0)
}
if (cmd === 'bootstrap') {
  const args = execFileSync('/usr/libexec/PlistBuddy', ['-c', 'Print :ProgramArguments', a2], { encoding: 'utf8' }).split('\n').slice(1, -2).map((s) => s.trim())
  const model = path.basename(args[args.indexOf('serve') + 1])
  let profile = 'desk'
  try { profile = execFileSync('/usr/libexec/PlistBuddy', ['-c', 'Print :EnvironmentVariables:LME_PROFILE', a2], { encoding: 'utf8' }).trim() } catch { /* the engine's default */ }
  fs.writeFileSync(loaded, '')
  fs.appendFileSync(path.join(S, 'loads.log'), `${model} ${profile}\n`)
  const crumbs = path.join(LME, 'breadcrumbs.slat')
  fs.appendFileSync(crumbs, `(load (at ${now()}) (what "${args[args.indexOf('serve') + 1]}") (need-mb 11245) (available-mb 8125) (pid ${process.pid}))\n`)
  if (process.env.FAKE_REFUSE && model.includes(process.env.FAKE_REFUSE)) {
    fs.appendFileSync(crumbs, `(loaded (at ${now()}) (ok off))\n`)
    fs.writeFileSync(path.join(LME, 'last-load'), String(now()))
    fs.appendFileSync(process.env.LME_LOG, 'F-LME-load: needs 11245 MB (6637 MB of it already resident) + 1500 MB floor, 1867 MB available\n')
    process.exit(0)   // launchctl answers 0: the job is loaded; its process exits 1 on its own
  }
  fs.appendFileSync(crumbs, `(loaded (at ${now()}) (ok on))\n`)
  fs.writeFileSync(path.join(LME, 'last-load'), String(now()))
  const engine = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fake-engine.mjs')
  const child = spawn(process.execPath, [engine, process.env.LME_SOCK, model, profile, process.env.FAKE_BUSY || '0'], { detached: true, stdio: 'ignore' })
  fs.writeFileSync(pidFile, String(child.pid))
  child.unref()
  process.exit(0)
}
process.exit(64)
