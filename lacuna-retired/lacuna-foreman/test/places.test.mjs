// places.test.mjs — THE PLACES (lacuna-foreman/places.mjs, places.slat; LACUNA-ENGINEERING-1.0 §4; lane P1, unit P.1). Owns: the
// table read as data (every place with its path, what it holds, its rules in order and who removes); a first run that makes the
// places that are ours and never one that is not; the table's places as this box holds them. Refuses: removing anything (the
// cleanup cart's, P.3); the live box's state written (a scratch home; the box is only read).
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PLACES_FILE, readPlaces, ensure } from '../places.mjs'

const TABLE = fs.readFileSync(PLACES_FILE, 'utf8')

// spec: LACUNA-ENGINEERING-1.0 §4 · class: E the table as data · technique: the real file read with a scratch home · method: the
// rows' fields · sre: can the cleanup cart and the disk producer read every place, its rule and who removes, from one file?
test('the seven places read with their paths, holdings, rules in order and who removes', () => {
  const places = readPlaces(TABLE, '/home/x')
  assert.deepEqual(places.map((p) => p.name), ['repos', 'world', 'state', 'forge', 'backups', 'ollama', 'caches'])
  for (const p of places) {
    assert.ok(p.path.startsWith('/home/x/'), `${p.name}: its path under the home`)
    assert.ok(p.holds.length > 10 && p.rules.length > 0 && ['cleanup-cart', 'owner'].includes(p.removes), p.name)
  }
  const state = places.find((p) => p.name === 'state')
  assert.deepEqual(state.rules.map((r) => r.kind), ['remove', 'remove', 'remove', 'keep'])
  // the record files at the state root and the owner's threads: kept by retention.slat's classes (E14 row 10)
  assert.match(state.rules[3].by, /^retention\.slat, per class/)
  // the KV persist (the finale's order §1.1b): another layout's file, two days old, goes; the serving tag spares its own
  assert.deepEqual(state.rules[2], { kind: 'remove', what: "KV persist files not the serving profile's", under: 'kv', globs: 'persist-*.lmekv',
    'older-than-days': 2, 'spare-tag': 'kv/serving-tag' })
  assert.deepEqual(state.rules[1], { kind: 'remove', what: 'builds past the last three per repo', under: 'builds', 'keep-last': 3, per: 'repo' })
  assert.deepEqual(places.find((p) => p.name === 'repos').rules[0].globs, ['dist/', 'build/', '.build/', 'out/'])
  assert.equal(places.find((p) => p.name === 'ollama').removes, 'owner', 'a served model is the owner\'s to remove')
  assert.deepEqual(places.filter((p) => p.create).map((p) => p.name), ['world', 'state', 'forge', 'backups'])
})

// spec: P1 brief P.1 ("every path in the table exists or is created on first run") · class: E a first run · technique: a scratch
// home, run twice · method: what was made, what was absent · sre: does a first run make a cache or a served-model folder it does
// not own?
test('a first run makes the places that are ours, never a cache or the served models; a second run makes nothing', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'places-'))
  const places = readPlaces(TABLE, home)
  const one = ensure(places)
  assert.deepEqual(one.created.map((p) => path.relative(home, p)), ['lacuna-world', '.lacuna', 'code/forge', 'lacuna-backups'])
  assert.deepEqual(one.absent.map((p) => path.relative(home, p)), ['.ollama', '.cache'])
  assert.deepEqual(one.sets.map((p) => path.relative(home, p)), ['code/*'], 'a set of folders is never made')
  for (const p of one.created) assert.ok(fs.statSync(p).isDirectory())
  const two = ensure(places)
  assert.deepEqual(two.created, [])
  assert.equal(two.present.length, 4)
})

// spec: LACUNA-ENGINEERING-1.0 §4 · class: E the record against the box · technique: the live home, read only · method: each place
// that is ours exists · sre: does the table name the box's real folders (2026-11-01: the backup row said Lacuna-Backups; the folder
// is lacuna-backups)?
test('on the box, every place that is ours is a folder that exists', { skip: !fs.existsSync(path.join(os.homedir(), 'lacuna-world')) && 'not on the box' }, () => {
  for (const p of readPlaces(TABLE).filter((x) => x.create)) assert.ok(fs.statSync(p.path).isDirectory(), p.path)
  const backups = readPlaces(TABLE).find((x) => x.name === 'backups')
  assert.ok(fs.readdirSync(path.dirname(backups.path)).includes(path.basename(backups.path)), 'the folder\'s own spelling')
})

// spec: places.mjs readPlaces · class: W a sparse or foreign form · technique: a place with only its name and path, an empty field
// and a form of another head · method: the row · sre: does a half-written row read as a place with no rule, never as a crash?
test('a sparse place reads with empty holdings, no rule and no remover; a form of another head is not a place', () => {
  const [p, ...rest] = readPlaces('(place (name bare) (path "/x") ())\n(note (name n))', '/home/x')
  assert.deepEqual(p, { name: 'bare', path: '/x', holds: '', rules: [], removes: '', create: false })
  assert.deepEqual(rest, [])
})
