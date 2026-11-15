// verb-table.test.mjs — U1 unit tests for `verb-table.mjs`: verbs.slat is the source, verbs.json its byte-for-byte copy.
// owns: the proofs that the committed verbs.json is the copy verbs.slat makes, that a drift or a missing copy is seen and
//   rewritten, and that a table which is not data, or has no verbs list, is refused before anything is written.
// refuses: to edit the foreman's own verbs.slat or verbs.json; every write goes to a scratch directory under the OS temp dir.
// implements: COMMON §2 law 12 (no JSON in a config; the JSON is a generated copy); eng §3.3 (the verbs); K1.13.
// invariants: none of §18.
// faults: none by id.
// coverage: verb-table.mjs — lines 98.67% branches 86.67% functions 100% (2026-10-31; :67, the real `--write`, is not run)
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { VERB_FILES, readVerbTable, verbsJson, checkVerbTable, writeVerbTable } from '../verb-table.mjs'

const scratch = () => {
  const dir = mkdtempSync(join(tmpdir(), 'verb-table-'))
  return { dir, files: { slat: join(dir, 'verbs.slat'), json: join(dir, 'verbs.json') } }
}

// spec: K1.13 (verbs.json matches the generated file byte for byte) · law 12
// class: L5 the ledger row's shape (a generated copy against its source)
// technique: golden file: the committed verbs.json against the copy the committed verbs.slat makes
// method: read both from disk; the copy must equal the file to the byte, and both must hold the same verbs in order
// sre: if someone edits verbs.json by hand, or edits verbs.slat and forgets the copy, does the retiring API read a table the foreman does not hold?
test('the committed verbs.json is the copy verbs.slat makes, byte for byte', () => {
  const c = checkVerbTable()
  assert.equal(c.same, true, 'run: node lacuna-foreman/verb-table.mjs --write')
  const table = readVerbTable(readFileSync(VERB_FILES.slat, 'utf8'))
  assert.deepEqual(table.verbs.map((v) => v.name), JSON.parse(readFileSync(VERB_FILES.json, 'utf8')).verbs.map((v) => v.name))
  assert.ok(table.verbs.length >= 29, `the table holds ${table.verbs.length} verbs`)
})

// spec: K1.13 · law 12
// class: J11 fs ENOENT (the copy is missing) and L5 the ledger row's shape (the copy drifts from its source)
// technique: fault injection in a scratch directory: a copy with one verb's text changed, then no copy at all
// method: the check reports the drift; the write restores the exact bytes; a second write changes nothing; a missing copy is written
// sre: when the copy drifts, does the generator see it and restore the exact bytes, and stay quiet when nothing changed?
test('a drifted or missing copy is seen, rewritten to the exact bytes, and a clean copy is left alone', () => {
  const { dir, files } = scratch()
  try {
    writeFileSync(files.slat, readFileSync(VERB_FILES.slat, 'utf8'))
    writeFileSync(files.json, readFileSync(VERB_FILES.json, 'utf8').replace('"tier": "watch"', '"tier": "act"'))
    assert.equal(checkVerbTable(files).same, false)
    assert.equal(writeVerbTable(files), true)
    assert.equal(readFileSync(files.json, 'utf8'), readFileSync(VERB_FILES.json, 'utf8'))
    assert.equal(writeVerbTable(files), false, 'a clean copy is not rewritten')
    rmSync(files.json)
    const c = checkVerbTable(files)
    assert.equal(c.have, null)
    assert.equal(writeVerbTable(files), true)
    assert.equal(readFileSync(files.json, 'utf8'), readFileSync(VERB_FILES.json, 'utf8'))
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

// spec: K1.13 · law 5 (the one reader) · law 12
// class: W5 malformed (a symbol as body data; an unclosed list; a table without its verbs list)
// technique: table of bad sources in a scratch directory
// method: a symbol where a string belongs, an unclosed list, a table with no verbs list: each throws and leaves the copy as it was
// sre: if a hand edit breaks verbs.slat, does the generator refuse it instead of writing a broken copy the API then reads?
test('a source that is not data, or holds no verbs list, is refused and the copy is left as it was', () => {
  const { dir, files } = scratch()
  try {
    writeFileSync(files.json, 'the old copy\n')
    for (const [bad, why] of [['(@ ("verbs" ((@ ("name" on)))))', /symbols/], ['(@ ("verbs" (', /unclosed/], ['(@ ("_" "no table"))', /no \("verbs"/]]) {
      writeFileSync(files.slat, bad)
      assert.throws(() => writeVerbTable(files), why, bad)
      assert.equal(readFileSync(files.json, 'utf8'), 'the old copy\n')
    }
    assert.equal(verbsJson({ _: 'x', verbs: [] }), '{\n "_": "x",\n "verbs": []\n}\n')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

// spec: K1.13 (the generator's command line)
// class: J12 process exit codes (the check a commit hook or CI would call)
// technique: child process: `--check` over the committed files, and no flag at all
// method: --check exits 0 and says the copy matches; no flag exits 2 with the usage line
// sre: can a CI step call the check and trust its exit status?
test('the command line: --check exits 0 on the committed files, no flag exits 2 with the usage', () => {
  const cli = fileURLToPath(new URL('../verb-table.mjs', import.meta.url))
  const ok = spawnSync(process.execPath, [cli, '--check'], { encoding: 'utf8', timeout: 10_000 })
  assert.equal(ok.status, 0, ok.stderr)
  assert.match(ok.stdout, /^info: verbs\.json matches verbs\.slat byte for byte/)
  const bare = spawnSync(process.execPath, [cli], { encoding: 'utf8', timeout: 10_000 })
  assert.equal(bare.status, 2)
  assert.match(bare.stderr, /^usage: /)
})
