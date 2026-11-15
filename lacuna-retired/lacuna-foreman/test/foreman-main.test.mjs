// foreman-main.test.mjs — THE FOREMAN IS A PROGRAM, NEVER A LIBRARY (P-2026-11-06-foreman-mjs-boots-on-import). Owns: the
// proof that importing lacuna-foreman/foreman.mjs starts nothing: no socket, no listener, no files and no process left,
// and the import says why. Refuses: the live folder (the child runs with HOME, FOREMAN_DIR, FOREMAN_SOCK and
// LACUNA_WORLD in a scratch folder, FOREMAN_PORT 0, so even a foreman that did boot touches only the scratch).
// Implements: the lead's ruling after the postmortem (a main guard; the worktree's tests on a scratch FOREMAN_DIR).
// Invariants (§18): none. Faults (§16): none by id; the postmortem's.
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const FOREMAN = new URL('../foreman.mjs', import.meta.url).href

// spec: P-2026-11-06-foreman-mjs-boots-on-import · the lead's ruling (a main guard)
// class: W8 a side effect at import · L3 a write outside its folder
// technique: a child process that imports the module under a scratch HOME, with a deadline
// method: the import rejects with its sentence, the child exits at once, and the scratch holds no socket and no file
// sre: can a probe that imports the foreman take the live foreman's socket again?
test('importing foreman.mjs starts nothing: it says it is a program, makes no socket and no file, and leaves no process', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'foreman-main-'))
  const dir = path.join(home, 'lacuna-world', 'foreman')
  const env = { ...process.env, HOME: home, FOREMAN_DIR: dir, FOREMAN_SOCK: path.join(dir, 'foreman.sock'), FOREMAN_PORT: '0',
    LACUNA_WORLD: path.join(home, 'lacuna-world'), LACUNA_HOME: path.join(home, '.lacuna'), FOREMAN_DESK_DIR: path.join(dir, 'desk'),
    // a foreman that did boot reaches nothing live: no API, no executor, no carts, no playbooks, no ledger, no mail
    LACUNA_URL: 'http://127.0.0.1:9', LACUNA_HANDS_SOCK: path.join(home, 'hands.sock'), FOREMAN_CARTS: path.join(home, 'carts'),
    FOREMAN_PLAYBOOKS: path.join(home, 'playbooks'), LACUNA_LEDGER: path.join(home, 'ledger'), LACUNA_MAIL_DIR: path.join(home, 'mail'),
    FOREMAN_TOKEN_FILE: path.join(home, 'token'), FOREMAN_BRAIN_PROFILE: path.join(home, 'brain.json') }
  const probe = `import(${JSON.stringify(FOREMAN)}).then(() => console.log('booted'), (e) => { console.log('refused: ' + e.message); process.exit(0) })`
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', probe], { env, cwd: home, timeout: 8000, encoding: 'utf8' })
  assert.equal(r.signal, null, 'the child exits by itself; a booted foreman keeps listening until the deadline kills it')
  assert.match(r.stdout, /^refused: lacuna-foreman\/foreman\.mjs is the foreman program: run it with node; importing it starts nothing/)
  const left = fs.readdirSync(home, { recursive: true })
  assert.deepEqual(left, [], 'nothing written: no folder, no socket, no worker record')
  fs.rmSync(home, { recursive: true, force: true })
})
