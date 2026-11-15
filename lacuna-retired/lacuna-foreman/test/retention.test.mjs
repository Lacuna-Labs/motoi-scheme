// retention.test.mjs — RETENTION AS DATA (R1.7). Owns: the proofs that the table beside the module reads with the eight
// classes the owner named (floor events 7 days; runs, contracts, verdicts, the grid forever; conversation condensed hourly;
// sentries' evidence 90 days; drills 30 days); that the reader refuses a class twice, a keep that is not days or forever, a
// past outside the three, a forever class with a drop, a condense with no cadence; that `ruleFor` finds a file's class by its
// globs (first match wins; a run's contract is `contracts`, not `runs`, so contracts stand before runs in the table or the test
// says so); that `plan` drops, condenses, keeps and names the unruled without touching a file. Refuses: a mock of the table.
import test from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import { PAST, expired, globToRegExp, loadRetention, plan, readRetention, ruleFor } from '../retention.mjs'

const T = loadRetention()
const H = os.homedir()

// spec: R1.7 (the owner's eight classes); E14 row 10 (records-10: the state root's record files and his threads with the minds,
// five classes) · class: E · method: the file beside the module
test('the table reads: the thirteen classes with the owner\'s days', () => {
  const by = Object.fromEntries(T.classes.map((c) => [c.name, c]))
  assert.deepEqual(Object.keys(by), ['floor-events', 'runs', 'contracts', 'verdicts', 'grid', 'conversation', 'sentry-evidence', 'drills',
    'owner-threads', 'acts', 'errors', 'telemetry', 'state'])
  for (const k of ['owner-threads', 'acts', 'state']) assert.deepEqual([by[k].keepDays, by[k].past], [null, 'forever'], k)
  assert.deepEqual([by.errors.keepDays, by.telemetry.keepDays], [90, 30])
  assert.deepEqual([by['floor-events'].keepDays, by['floor-events'].past], [7, 'drop'])
  for (const k of ['runs', 'contracts', 'verdicts', 'grid']) assert.deepEqual([by[k].keepDays, by[k].past], [null, 'forever'], k)
  assert.deepEqual([by.conversation.past, by.conversation.condense.cadence], ['condense', 'hourly'])
  assert.deepEqual([by['sentry-evidence'].keepDays, by.drills.keepDays], [90, 30])
  for (const c of T.classes) { assert.ok(c.holds.length > 10, c.name); assert.ok(c.paths.length >= 1, c.name) }
  assert.deepEqual(PAST, ['drop', 'condense', 'forever'])
})

// spec: "one sentence on a defect" · class: J7 · technique: six wrong tables
test('readRetention refuses a class twice, a bad keep, a bad past, forever with drop, days with forever, condense with no cadence', () => {
  const c = (body) => `(retention (version 1) ${body})`
  const row = (name, keep, past, extra = '') => `(class ${name} (holds "x") (paths "~/a/*") (keep ${keep}) (past ${past}) ${extra})`
  const bad = [
    [c(row('a', 7, 'drop') + row('a', 7, 'drop')), /class a twice/],
    [c(row('a', 'sometimes', 'drop')), /whole number of days or forever/],
    [c(row('a', 7, 'burn')), /past is one of drop · condense · forever, not burn/],
    [c(row('a', 'forever', 'drop')), /kept forever has \(past forever\)/],
    [c(row('a', 7, 'forever')), /names what happens past it/],
    [c(row('a', 1, 'condense')), /names its \(condense cadence/],
    [c('(class a (holds "x") (keep 7) (past drop))'), /names at least one glob/],
    [c(''), /rules at least one class/],
    ['(retention', /does not read/],
  ]
  for (const [text, re] of bad) assert.throws(() => readRetention(text), re, text.slice(0, 70))
})

// spec: "the class a file falls under by its globs" · class: E · technique: the real table over real-looking paths
test('ruleFor finds a file\'s class by its globs; a contract is contracts; an unknown file is unruled', () => {
  assert.equal(ruleFor('~/lacuna-world/floor/events-2026-10-30.slat').name, 'floor-events')
  assert.equal(ruleFor(`${H}/lacuna-world/floor/state-2026-10-30.slat`).name, 'floor-events')
  assert.equal(ruleFor('~/lacuna-world/runs/w-00c561/drive.jsonl').name, 'runs')
  assert.equal(ruleFor('~/lacuna-world/runs/w-00c561/CONTRACT.slat').name, 'runs', 'runs stands before contracts in the table: a run folder is kept whole (forever both)')
  assert.equal(ruleFor('~/lacuna-world/foreman/ledger/verdicts.slat').name, 'verdicts')
  assert.equal(ruleFor('~/lacuna-world/foreman/grid.slat').name, 'grid')
  assert.equal(ruleFor('~/.lacuna/conversation.jsonl').name, 'conversation')
  assert.equal(ruleFor('~/lacuna-world/sentry/evidence-2026-10-01.slat').name, 'sentry-evidence')
  assert.equal(ruleFor('~/.lacuna/drills.jsonl').name, 'drills')
  assert.equal(ruleFor('~/.lacuna/token'), null)
  assert.equal(ruleFor('~/lacuna-world/floor-events-x.slat'), null)
  assert.ok(globToRegExp('~/a/**/b-*.slat').test(`${H}/a/x/y/b-1.slat`))
  assert.ok(!globToRegExp('~/a/*.slat').test(`${H}/a/x/y.slat`))
})

// spec: "every drop a row"; the plan is pure · class: E · technique: six files of known ages
test('plan drops the old, condenses the conversation, keeps the young and the forever, names the unruled; touches nothing', () => {
  const p = plan([
    { path: '~/lacuna-world/floor/events-2026-10-01.slat', ageDays: 29 },
    { path: '~/lacuna-world/floor/events-2026-10-30.slat', ageDays: 0 },
    { path: '~/lacuna-world/runs/w-000001/drive.jsonl', ageDays: 400 },
    { path: '~/.lacuna/conversation.jsonl', ageDays: 2 },
    { path: '~/.lacuna/drills.jsonl', ageDays: 31 },
    { path: '~/.lacuna/token', ageDays: 900 },
  ])
  assert.deepEqual(p.drop.map((r) => [r.class, r.ageDays]), [['floor-events', 29], ['drills', 31]])
  assert.deepEqual(p.condense.map((r) => r.class), ['conversation'])
  assert.deepEqual(p.stands.map((r) => r.class), ['floor-events', 'runs'])
  assert.deepEqual(p.unruled.map((r) => r.path), ['~/.lacuna/token'])
  assert.equal(expired({ keepDays: null }, 10 ** 6), false)
  assert.equal(expired({ keepDays: 7 }, 7), false)
  assert.equal(expired({ keepDays: 7 }, 7.5), true)
})
