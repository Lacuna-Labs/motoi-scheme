// cascade-policy-dir.test.mjs — THE POLICY FOLDER. Owns: proof that the cascade reads its thresholds and rules from the
// folder FOREMAN_CASCADE_DIR names, and that a folder with no files means the defaults (0.6, unknown climbs, no rules).
// Refuses: the ladder and the climb (cascade-ladder.test.mjs, cascade-climb.test.mjs hold them). Implements: design §9 (the
// 90% gate; a missing policy is the default, never a crash). Invariants: "if a mind's gate is below 90%, its verdicts are
// advice". Faults: F-16.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const dir = fs.mkdtempSync('/private/tmp/lacuna-unit-cascade-')
const probe = (env) => JSON.parse(spawnSync(process.execPath, ['--input-type=module', '-e', "import { policy } from '/Users/alfred/code/lacuna/lacuna-foreman/cascade.mjs'; console.log(JSON.stringify(policy()))"], { env: { ...process.env, ...env }, encoding: 'utf8' }).stdout.trim())

// spec: design §9 · F-16
// class: J11 a file that is missing or unreadable
// technique: fault injection by environment — the folder is empty, then holds one file, then a file that does not parse
// method: point FOREMAN_CASCADE_DIR at a scratch folder in a child process (the module reads the env at import); assert the
//         defaults, then the file's values, then the defaults again for the unparseable file
// sre: if the calibration writes a broken thresholds.json, does every small mind stop, or does the gate fall back to 0.6?
test('an empty policy folder means the defaults; a file is read; a file that does not parse falls back', () => {
  assert.deepEqual(probe({ FOREMAN_CASCADE_DIR: dir }), { thresholds: { default: 0.6, unknown: 'climb', jobs: {} }, rules: {} })
  fs.writeFileSync(path.join(dir, 'thresholds.json'), JSON.stringify({ default: 0.8, unknown: 'refuse', jobs: { label: 0.9 } }))
  fs.writeFileSync(path.join(dir, 'rules.json'), JSON.stringify({ label: ['noise'] }))
  assert.deepEqual(probe({ FOREMAN_CASCADE_DIR: dir }), { thresholds: { default: 0.8, unknown: 'refuse', jobs: { label: 0.9 } }, rules: { label: ['noise'] } })
  fs.writeFileSync(path.join(dir, 'thresholds.json'), '{not json')
  assert.equal(probe({ FOREMAN_CASCADE_DIR: dir }).thresholds.default, 0.6)
  fs.rmSync(dir, { recursive: true, force: true })
})
