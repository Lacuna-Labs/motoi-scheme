// inventory-moves.test.mjs — THE INVENTORY'S WRITES AND ITS JUDGMENTS. Owns: the tests of inventory.mjs `planMoves`,
// `applyMoves`, `retireCart`, `examUnits`, `indexText`, `nearestCart`, `refuseNear` and the CLI (`node inventory.mjs`)
// at their edges: a move that would overwrite, a retire with no version, text with quotes and newlines in the index,
// a candidate with no words, the 0.85 line exactly. Refuses: the live world (the CLI runs as a scratch child with
// LACUNA_WORLD under /private/tmp/lacuna-unit/U5) and `--write` (it writes the committed carts/INDEX.slat, outside U5's
// files); a mock of inventory.mjs (an embedder is the test's function, as the `nearness` hand would be). Implements: work
// order U5 §3; design §12.3 (siblings, the nearest-cart refusal at 0.85, retire on successor), §12.4 and §7.9 (one exam
// unit per exam id). Invariants (§18): "a claim is not a record" (law 6) — a generated unit is `curated: false`, never
// read as a passed exam. Faults (§16): F-02 (a duplicate cart is refused, exit 12, one sentence).
// coverage: inventory.mjs — lines 98.33% branches 99.12% functions 97.83% (2026-10-24, the lane's files alone; the CLI's --write is a todo)
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from '../scheme.mjs'
import { applyMoves, examUnits, indexText, nearestCart, planMoves, refuseNear, retireCart, NEAR } from '../inventory.mjs'
import { U5_TMP } from './fixtures/u5-door.mjs'

const tmp = (p) => { mkdirSync(U5_TMP, { recursive: true }); return mkdtempSync(join(U5_TMP, `${p}-`)) }
const CART = (name, does, extra = '') => `(lacuna-cart '${name} '((does . "${does}") (done . "one pass") (agent . ((tier . watch) (verbs . (on report)))) ${extra}))\n`
const row = (name, meaning, state = 'serving') => ({ name, meaning, state })

// spec: design §12.3 (drafts/ and attic/; nothing is overwritten) · inventory.mjs header ("a move that would overwrite" refused)
// class: J11 fs EEXIST (a target that exists) · M3 a stale link · M7 APFS rename atomicity (all or nothing: checked before any move)
// technique: fault injection on a scratch tree: a dangling .draft link, a folder named like a kept version, a target that exists
// method: planMoves; applyMoves with one target taken; read that no file moved; then apply the rest and read the tree
// sre: can tidying the carts folder ever overwrite a draft someone kept, or leave the folder half-moved?
test('the loose-file plan skips links and folders; a move set with one taken target moves nothing; a free set moves all', () => {
  const root = tmp('moves')
  assert.deepEqual(planMoves(join(root, 'none')), [])
  writeFileSync(join(root, 'a.sks.draft'), CART('a', 'x'))
  writeFileSync(join(root, 'b.sks.old'), CART('b', 'x'))
  writeFileSync(join(root, 'c.sks.v2-2026-10-01'), CART('c', 'x'))
  writeFileSync(join(root, 'Not-a-cart.sks.draft'), 'x')
  symlinkSync(join(root, 'gone'), join(root, 'ghost.sks.draft'))
  mkdirSync(join(root, 'd.sks.v1'))
  const plan = planMoves(root)
  assert.deepEqual(plan.map((m) => m.to.slice(root.length)), ['/drafts/a.sks', '/attic/b.old.sks', '/attic/c.v2.sks'])
  mkdirSync(join(root, 'attic'))
  writeFileSync(join(root, 'attic', 'c.v2.sks'), 'kept')
  assert.throws(() => applyMoves(plan), /the move would overwrite .*attic\/c\.v2\.sks; nothing was moved/)
  assert.equal(existsSync(join(root, 'a.sks.draft')), true, 'nothing moved')
  assert.equal(applyMoves(plan.slice(0, 2)), 2)
  assert.deepEqual([existsSync(join(root, 'drafts', 'a.sks')), existsSync(join(root, 'attic', 'b.old.sks')), readFileSync(join(root, 'attic', 'c.v2.sks'), 'utf8')], [true, true, 'kept'])
})

// spec: design §12.3 ("retire on successor, 30 idle days, or press"; attic/<name>.v<N>.sks with a dated line)
// class: J11 fs ENOENT (no serving cart) and EEXIST (that version already retired) · M7 written first, removed second
// technique: state-machine walk — retire a cart with no version, again (refused), one that is not serving
// method: retireCart; read the attic file's first line and body, that the serving file is gone, and each refusal's sentence
// sre: can retiring a cart ever leave zero copies of it on disk?
test('a cart with no version retires as v0 with a dated line; the same version again or a cart not serving is refused', () => {
  const root = tmp('retire')
  writeFileSync(join(root, 'old.sks'), CART('old', 'old work'))
  const to = retireCart(root, 'old', 'replaced by new', '2026-10-24')
  assert.equal(to, join(root, 'attic', 'old.v0.sks'))
  assert.equal(readFileSync(to, 'utf8'), `;; retired 2026-10-24: replaced by new\n${CART('old', 'old work')}`)
  assert.equal(existsSync(join(root, 'old.sks')), false)
  writeFileSync(join(root, 'old.sks'), CART('old', 'old work'))
  assert.throws(() => retireCart(root, 'old', 'again', '2026-10-25'), /the attic already holds old\.v0\.sks; nothing was retired/)
  assert.equal(existsSync(join(root, 'old.sks')), true, 'a refused retire keeps the serving file')
  assert.throws(() => retireCart(root, 'never', 'x', '2026-10-25'), /no serving cart never; nothing was retired/)
})

// spec: design §12.3 (INDEX.slat regenerated deterministically) · §7 (slat on the file) · §7.9 (exam units; curated or generated)
// class: J15 Unicode and bytes (quotes, backslashes, newlines, multi-byte text in a row) · L5 the record's shape · E10 a duplicate exam id
// technique: boundary over every value type slat writes (null, booleans, numbers, arrays, text with escapes); a duplicate exam id
// method: indexText twice and parse every line back; examUnits over rows with a template, a duplicate, and ids out of order
// sre: does a cart whose sentence holds a quote or a newline break the index the desk and the foreman both read?
test('the index writes every value type and escapes text so each line reads back; exam units are one per id, sorted, templates skipped', () => {
  const rows = [{ name: 'q', version: 2, hash: 'h', state: 'serving', place: '.', tier: 'watch', restart: null, author: 'claude', exam: 'E-2', unit: true,
                  minds: ['l pick served=x'], acts: [], sentry: 'none', last: null, runs: 0, firstTry: null, final: null, fit: 'fits', missing: [],
                  problem: 'a "quoted" \\ problem\non two lines — ünïcode' }]
  const text = indexText(rows)
  assert.equal(text, indexText(rows))
  const lines = text.trim().split('\n').slice(1)
  for (const l of lines) assert.equal(parse(l).length, 1, l)
  assert.match(lines[1], /:unit #t .*:first-try #f .*:problem "a \\"quoted\\" \\\\ problem\\non two lines — ünïcode"\)$/)
  assert.match(lines[0], /^\(index :v 1 :carts 1 :serving 1 :draft 0 :retired 0 :template 0 :hash "[0-9a-f]{12}"\)$/)
  const units = examUnits([{ name: 'b', exam: 'E-2' }, { name: 'a', exam: 'E-1' }, { name: 'c', exam: 'E-2' }, { name: 't', exam: 'E-0', state: 'template' }, { name: 'n' }],
    { 'E-1': { class: 'kick', input: 1, expect: 'kick', check: 'c', gold: true } })
  assert.deepEqual(units.map((u) => [u.id, u.cart, u.curated]), [['E-1', 'a', true], ['E-2', 'b', false]])
  assert.equal(units[1].expect, 'outcome pass')
})

// spec: design §12.3 ("nearest-cart refusal at similarity 0.85") · CARTS-ARE-THE-WORK ("a cart never duplicates") · F-02 exit 12
// class: B7 a bound at its edge (similarity 0.85 refused, 0.849 passes) · J7 a candidate with no words (a zero vector) · J18 an
//        embedder that is the `nearness` hand (async)
// technique: boundary on the similarity by an embedder that returns chosen vectors; the words road for empty text
// method: nearestCart and refuseNear; read the name, similarity, by, the exit and the sentence
// sre: when the 26B writes a new cart, is a near-copy of a serving one refused at exactly the design's line, and only then?
test('a candidate at 0.85 is refused with exit 12; at 0.849 it passes; no words or no serving cart is similarity 0', async () => {
  assert.equal(NEAR, 0.85)
  assert.deepEqual(await nearestCart('anything', [row('a', '  '), row('b', 'b', 'draft')]), { name: null, similarity: 0, by: 'words' })
  assert.deepEqual(await nearestCart('x', [], { embed: async () => [] }), { name: null, similarity: 0, by: 'embedding' })
  assert.deepEqual(await nearestCart('', [row('a', 'reads the disk')]), { name: null, similarity: 0, by: 'words' })
  const at = (sim) => async (texts) => [[1, 0], ...texts.slice(1).map(() => [sim, Math.sqrt(1 - sim * sim)])]
  const rows = [row('disk-watch', 'reads the disk one pass')]
  const prog = CART('disk-copy', 'reads the disk again')
  await assert.rejects(refuseNear(prog, rows, { embed: at(0.85) }), (e) => e.exit === 12 && e.near.name === 'disk-watch' &&
    /^a cart that does this already serves: disk-watch \(similarity 0\.85 by embedding\); extend it instead of writing a duplicate$/.test(e.message))
  assert.deepEqual(await refuseNear(prog, rows, { embed: at(0.849) }), { name: 'disk-watch', similarity: 0.849, by: 'embedding' })
  assert.equal((await refuseNear(CART('disk-watch', 'reads the disk'), rows)).name, null, 'a cart is never its own duplicate')
  const broken = `(lacuna-cart 'half '((does . "reads the disk") (done . "one pass")))\n(hand 'disk)`
  await assert.rejects(refuseNear(broken, rows, {}), /already serves: disk-watch \(similarity 1 by words\)/, 'a candidate that does not read is judged by its words')
  assert.equal((await refuseNear('(not a cart)', rows)).similarity, 0)
})

// spec: inventory.mjs CLI ("scans the world's carts and this lane's carts; prints the summary and the moves; never moves a file")
// class: J13 env unset or pointing at a scratch world (LACUNA_WORLD) · J12 process exit codes (the CLI exits 0) · M9 /private/tmp
// technique: process — the CLI as a scratch child with LACUNA_WORLD under /private/tmp/lacuna-unit/U5; once more as a plain import
// method: run `node inventory.mjs` and an `-e` import of it; read the exit codes and the printed rows, moves and unit count
// sre: can an operator run the inventory by hand against a scratch world without it touching ~/lacuna-world or moving a file?
test('the CLI lists the world\'s and the lane\'s carts, the moves it would make and the units, and moves nothing; an import prints nothing', () => {
  const world = tmp('world')
  mkdirSync(join(world, 'carts'), { recursive: true })
  mkdirSync(join(world, 'foreman', 'workers'), { recursive: true })
  mkdirSync(join(world, 'bench', 'agents'), { recursive: true })
  writeFileSync(join(world, 'bench', 'agents', 'tiers.json'), JSON.stringify({ classes: {} }))
  writeFileSync(join(world, 'carts', 'probe.sks'), CART('probe', 'probes', '(exam . E-probe)'))
  writeFileSync(join(world, 'carts', 'idea.sks.draft'), CART('idea', 'an idea'))
  writeFileSync(join(world, 'carts', 'broken.sks'), "(lacuna-cart 'broken '((does . \"d\")))")
  writeFileSync(join(world, 'foreman', 'workers', 'w1.json'), JSON.stringify({ state: 'retired', cart: { name: 'probe', outcome: 'done', started: 1000 } }))
  const cli = new URL('../inventory.mjs', import.meta.url).pathname
  const r = spawnSync(process.execPath, [cli], { encoding: 'utf8', env: { PATH: process.env.PATH, HOME: world, LACUNA_WORLD: world }, timeout: 20_000 })
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /^serving  probe +v- E-probe · missing version restart deadlines contract sentry$/m)
  assert.match(r.stdout, /^draft    broken +v- no-exam — the cart broken says what it is done at/m)
  assert.match(r.stdout, /^move .*idea\.sks\.draft → .*drafts\/idea\.sks \(a draft is never loaded unattended\)$/m)
  assert.match(r.stdout, /^\d+ exam units \(\d+ curated\)$/m)
  assert.equal(existsSync(join(world, 'carts', 'idea.sks.draft')), true, 'the CLI never moves a file')
  assert.equal(existsSync(join(world, 'exam')), false, 'without --write it writes nothing')
  // no LACUNA_WORLD: the world is $HOME/lacuna-world — here a scratch HOME, never the owner's; no tiers.json there either
  const home = tmp('home')
  mkdirSync(join(home, 'lacuna-world', 'carts'), { recursive: true })
  writeFileSync(join(home, 'lacuna-world', 'carts', 'solo.sks'), CART('solo', 'alone'))
  const h = spawnSync(process.execPath, [cli], { encoding: 'utf8', env: { PATH: process.env.PATH, HOME: home }, timeout: 20_000 })
  assert.equal(h.status, 0, h.stderr)
  assert.match(h.stdout, /^serving  solo /m)
  const imp = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(cli)})`], { encoding: 'utf8', env: { PATH: process.env.PATH, LACUNA_WORLD: world }, timeout: 20_000 })
  assert.deepEqual([imp.status, imp.stdout], [0, ''])
})

test.todo('inventory.mjs:293-298 (`node inventory.mjs --write`): it writes lacuna-foreman/carts/INDEX.slat (a committed file outside ' +
  'U5\'s write set) as well as <world>/exam/units.jsonl; reachable when the lane carts folder is an argument or an env var')
test.todo('inventory.mjs:283 (`readJson(join(lane, \'units.json\')) || {}` in the CLI): the lane\'s carts/units.json is committed and ' +
  'always reads; reachable only by removing a committed file, which is outside U5\'s write set')
