// places-due.test.mjs — WHAT THE PLACES' RULES WOULD REMOVE (lacuna-foreman/places-due.mjs; lane P1, P.3's dry run). Owns: each
// rule's selector read against a real scratch tree (an age under a folder, the newest kept per repo, a name pattern kept to its
// newest, a repository's ignored build folders by age, a cache past its size); a rule that needs a record said so, never decided by
// age; a path a running program uses refused; the tree untouched. Refuses: the live box (a scratch home; its own table).
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { readPlaces, PLACES_FILE } from '../places.mjs'
import { due, diskIo, rows } from '../places-due.mjs'

const DAY = 86_400_000
const aged = (p, days) => { const t = (Date.now() - days * DAY) / 1000; fs.utimesSync(p, t, t) }
const put = (p, bytes = 10, days = 0) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, 'x'.repeat(bytes)); aged(p, days) }

const TABLE = `
(place (name repos) (path "~/code/*") (holds "source") (remove (what "build outputs git ignores") (globs "dist/" "build/") (older-than-days 7)) (removes cleanup-cart))
(place (name state) (path "~/.lacuna") (holds "state")
  (remove (what "logs") (under "logs") (older-than-days 14))
  (remove (what "builds past the last three per repo") (under "builds") (keep-last 3) (per repo))
  (keep (what "the KV persist") (by "the engine")) (removes cleanup-cart) (create #t))
(place (name backups) (path "~/lacuna-backups") (holds "backups")
  (remove (what "dailies past the last three") (globs "lacuna-*.tar.gz") (keep-last 3))
  (keep (what "the hourly world bundles") (under "world-hourly")) (removes cleanup-cart) (create #t))
(place (name forge) (path "~/code/forge") (holds "the forge") (remove (what "weights never named") (under "weights") (older-than-days 30) (needs "the weight records")) (removes cleanup-cart))
(place (name caches) (path "~/.cache") (holds "caches") (report (what "every cache's size") (paths "~/.cache/uv" "~/.cache/none")) (remove (what "the uv cache past 1 KB") (under "uv") (over-gb 0.000001)) (removes cleanup-cart))
`

function scratch() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'due-'))
  put(path.join(home, '.lacuna/logs/old.log'), 100, 20); put(path.join(home, '.lacuna/logs/new.log'), 100, 1)
  for (const b of ['20261026-124758-main-a1', '20261026-134759-main-a1', '20261027-104759-main-b2', '20261028-104759-main-c3', '20261027-090000-curator-d4'])
    put(path.join(home, '.lacuna/builds', b, 'bundle.js'), 50)
  for (const d of ['2026-10-23', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30']) put(path.join(home, `lacuna-backups/lacuna-${d}.tar.gz`), 1000)
  put(path.join(home, 'lacuna-backups/world-hourly/lacuna-world-1.bundle'), 500)
  const repo = path.join(home, 'code/app')
  fs.mkdirSync(repo, { recursive: true })
  execFileSync('/usr/bin/git', ['-C', repo, '-c', 'init.defaultBranch=main', 'init', '-q'], { env: { PATH: '/usr/bin:/bin', HOME: home } })
  fs.writeFileSync(path.join(repo, '.gitignore'), 'build/\ndist/\n')
  put(path.join(repo, 'build/app.o'), 200, 10); aged(path.join(repo, 'build'), 10)
  put(path.join(repo, 'dist/app.js'), 200, 2); aged(path.join(repo, 'dist'), 2)
  put(path.join(home, 'code/notes/build/x.txt'), 20, 30); aged(path.join(home, 'code/notes/build'), 30)   // no repository: never a candidate
  put(path.join(home, '.cache/uv/wheel.whl'), 5000)
  put(path.join(home, 'code/forge/weights/old.gguf'), 10, 90)
  return home
}
const tree = (d) => execFileSync('/usr/bin/find', [d, '-print'], { encoding: 'utf8' }).split('\n').sort()

// spec: LACUNA-ENGINEERING-1.0 §4, P1 brief P.3 · class: E each selector · technique: a scratch home built to cross every rule
// once · method: the candidates, the reports, the unevaluated · sre: would a first cleanup take only what the table says, and say
// what it cannot decide?
test('each rule finds what it names: an old log, a repo\'s fourth build, the oldest dailies, an old ignored build, a big cache', () => {
  const home = scratch()
  const before = tree(home)
  const out = due(readPlaces(TABLE, home), diskIo({ home, running: () => [], open: () => [] }))
  const rel = (p) => path.relative(home, p)
  assert.deepEqual(out.candidates.map((c) => [c.place, rel(c.path)]), [
    ['repos', 'code/app/build'],
    ['state', '.lacuna/logs/old.log'],
    ['state', '.lacuna/builds/20261026-124758-main-a1'],
    ['backups', 'lacuna-backups/lacuna-2026-10-23.tar.gz'],
    ['backups', 'lacuna-backups/lacuna-2026-10-27.tar.gz'],
    ['caches', '.cache/uv'],
  ])
  assert.ok(out.candidates.every((c) => c.bytes > 0 && c.what && c.why), 'each with its bytes, its rule and why')
  assert.match(out.candidates[0].why, /ignored, 10 days old, over 7/)
  assert.deepEqual(out.reports.map((r) => [r.place, rel(r.path), r.bytes > 0]), [['caches', '.cache/uv', true], ['caches', '.cache/none', false]])
  assert.deepEqual(out.unevaluated, [{ place: 'forge', what: 'weights never named', why: 'it needs the weight records' }])
  assert.deepEqual(tree(home), before, 'a dry run removes nothing')
})

// spec: the cleanup cart's own rule (never a path under a live forge run, O-47), carried to the places · class: R a live user ·
// technique: a running program's path under a candidate · method: the refusal · sre: can a cleanup remove the build a live program
// runs from?
test('a candidate a running program uses is refused with the program named', () => {
  const home = scratch()
  const exe = path.join(home, 'code/app/build/engine')
  const out = due(readPlaces(TABLE, home), diskIo({ home, running: () => [{ pid: 4242, exe }], open: () => [] }))
  assert.ok(!out.candidates.some((c) => c.path.endsWith('code/app/build')))
  assert.deepEqual(out.refused.map((r) => [path.relative(home, r.path), r.why]), [['code/app/build', 'in use: pid 4242 runs from it']])
})

// spec: places.slat · class: E the real table · technique: the real file on a scratch home · method: every remove rule evaluated or
// naming its need · sre: does the box's own table read whole, with nothing decided by a guess?
test('the real table evaluates whole on an empty home: nothing to remove, and every rule that needs a record says which', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'due-'))
  const out = due(readPlaces(fs.readFileSync(PLACES_FILE, 'utf8'), home), diskIo({ home, running: () => [], open: () => [] }))
  assert.deepEqual(out.candidates, [])
  assert.deepEqual(out.unevaluated.map((u) => u.place), ['forge', 'forge', 'forge', 'ollama'])
  assert.ok(out.unevaluated.every((u) => /^it needs /.test(u.why)))
})

// spec: places-due.mjs select · class: W a rule the planner cannot read · technique: a remove with no selector, a report with no
// path, a size rule by its own path · method: the unevaluated rows and the candidate · sre: does a vague rule ever become a removal?
test('a rule with no selector or no path is said undecided, never removed by; a size rule may name its own path', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'due-'))
  put(path.join(home, 'Library/big/blob'), 3000)
  const table = `(place (name odd) (path "~/odd") (holds "odd things") (remove (what "something vague")) (report (what "sizes"))
    (remove (what "the big cache past 1 KB") (path "~/Library/big") (over-gb 0.000001)) (remove (what "a small one past 1 GB") (path "~/Library/big") (over-gb 1)) (removes cleanup-cart))`
  const out = due(readPlaces(table, home), diskIo({ home, running: () => [], open: () => [] }))
  assert.deepEqual(out.unevaluated, [{ place: 'odd', what: 'something vague', why: 'it names no selector the planner reads' },
    { place: 'odd', what: 'sizes', why: 'it names no path the planner reads' }])
  assert.deepEqual(out.candidates.map((c) => [path.relative(home, c.path), c.what]), [['Library/big', 'the big cache past 1 KB']])
})

// spec: the finale's order §1.1b ("a persist file that is not the serving profile's and is older than 2 days is removed by the
// cleanup cart"); places.slat's state row; lme/src/engine/persist.hpp (the serving tag) · class: D7 a cache fills the disk (11 GB
// of persist files on 11-06) · technique: the real table on a scratch home with persist files of two layouts, old and new ·
// method: the candidates with the tag written; undecided with no tag; nothing said when nothing is old · sre: does the cart take
// the old layouts' files and never the file the serving engine will read back?
test('the KV persist: files of another layout older than 2 days go; the serving layout\'s and the young stay; no tag, no decision', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'due-'))
  const kv = (n, days) => put(path.join(home, '.lacuna/kv', n), 100, days)
  kv('persist-aaaa000000000001-0.lmekv', 5); kv('persist-aaaa000000000001-1.lmekv', 3)    // another layout, old
  kv('persist-bbbb000000000002-0.lmekv', 9)                                               // the serving layout, old: kept
  kv('persist-cccc000000000003-0.lmekv', 1)                                               // another layout, young: kept
  kv('lane-a.lmekv', 30)                                                                  // a session file: not the persist's rule
  const real = () => due(readPlaces(fs.readFileSync(PLACES_FILE, 'utf8'), home), diskIo({ home, running: () => [], open: () => [] }))
  const rule = "KV persist files not the serving profile's"
  let out = real()
  assert.deepEqual(out.candidates.filter((c) => c.what === rule), [])
  assert.match(out.unevaluated.find((u) => u.what === rule)?.why ?? '', /^it needs the serving engine's tag in .*\/\.lacuna\/kv\/serving-tag \(3 file\(s\) over 2 days wait\)$/)
  fs.writeFileSync(path.join(home, '.lacuna/kv/serving-tag'), 'bbbb000000000002\n')
  out = real()
  assert.deepEqual(out.candidates.filter((c) => c.what === rule).map((c) => [c.place, path.basename(c.path), c.why]), [
    ['state', 'persist-aaaa000000000001-0.lmekv', '5 days old, over 2, not the serving layout bbbb000000000002'],
    ['state', 'persist-aaaa000000000001-1.lmekv', '3 days old, over 2, not the serving layout bbbb000000000002'],
  ])
  assert.ok(!out.unevaluated.some((u) => u.what === rule))
})

// spec: places-due.mjs diskIo · class: E the box's own reading · technique: the real process table, read only · method: this test's
// own pid · sre: does the in-use guard read the programs that are running, not a list of its own?
test('the running programs and the open files are read from the box: this test is among them', () => {
  assert.ok(diskIo().running().some((x) => x.pid === process.pid))
  assert.ok(diskIo().open().some((x) => x.pid === process.pid && x.path.startsWith('/')), 'its own open files, by path')
})

// spec: the in-use guard · class: R a live reader · technique: a server holding a file under a candidate open · method: the
// refusal · sre: can a cleanup remove the build a server is serving (Caddy and the APIs serve files from folders)?
test('a candidate holding a file a program has open is refused with the program named', () => {
  const home = scratch()
  const open = () => [{ pid: 5151, path: path.join(home, 'lacuna-backups/lacuna-2026-10-23.tar.gz') }]
  const out = due(readPlaces(TABLE, home), diskIo({ home, running: () => [], open }))
  assert.deepEqual(out.refused.map((r) => [path.relative(home, r.path), r.why]), [['lacuna-backups/lacuna-2026-10-23.tar.gz', 'in use: pid 5151 holds a file in it open']])
  assert.ok(!out.candidates.some((c) => c.path.endsWith('lacuna-2026-10-23.tar.gz')))
})

// spec: P1 brief P.3 ("every removal a row in ~/lacuna-world/ledger/cleanup.slat"); the part's gate ("the cleanup cart's dry run
// as rows") · class: E the record's shape · technique: the scratch home's dry run as rows, read back with the one reader · method:
// each row's fields · sre: does a dry run read the same way as the run that removes, so the owner can compare them?
test('the dry run as the cleanup ledger\'s rows: one per candidate and refusal, read back by the one reader', async () => {
  const { readForms } = await import('../../../lacuna-scheme/src/slat-data.js')
  const home = scratch()
  const exe = path.join(home, 'code/app/build/engine')
  const out = due(readPlaces(TABLE, home), diskIo({ home, running: () => [{ pid: 4242, exe }], open: () => [] }))
  const text = rows(out, 1793536000).join('\n')
  const forms = readForms(text)
  assert.equal(forms.length, out.candidates.length + out.refused.length)
  const did = forms.map((f) => f.find((x) => Array.isArray(x) && x[0].name === 'did')[1].name)
  assert.deepEqual([...new Set(did)], ['would-remove', 'refused'])
  assert.match(text, /\(cleanup \(at 1793536000\) \(place state\) \(path "[^"]+\/\.lacuna\/logs\/old\.log"\) \(bytes \d+\) \(rule "logs"\) \(why "20 days old, over 14"\) \(did would-remove\)\)/)
})
