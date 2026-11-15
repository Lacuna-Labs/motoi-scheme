// ledger-chain.test.mjs — THE FOREVER LEDGER'S CHAIN (ledger-chain.mjs). Owns: the proofs that each row the foreman's
// ledger writes names the hash of the line before, in a form every reader still reads (the two-element alist row, runs.mjs's
// verdict row), that a second writer goes on the same chain, and that a changed or unchained row breaks the verify at its
// line. Refuses: the live ledger (a scratch file under /private/tmp/lacuna-unit). Implements: E14 §5 row 10 (records-01).
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { readForms } from '../../../lacuna-scheme/src/slat-data.js'
import { chainRow, ledgerWriter, prevOf, sha, verifyLedger } from '../ledger-chain.mjs'
import { appendVerdict, readVerdict } from '../runs.mjs'

fs.mkdirSync('/private/tmp/lacuna-unit', { recursive: true })
const scratch = () => path.join(fs.mkdtempSync('/private/tmp/lacuna-unit/ledger-'), 'runs.slat')
const LEGACY = '(governor (@ ("at" 1793996713) ("act" "level") ("level" "normal")))\n(swap (@ ("from" "26b") ("to" "12b") ("ok" #t)))\n'

// spec: E14 §5 row 10 (records-01: runs.slat 10,352 rows, 0 with a prev; the floor and the grid chain theirs)
// class: J a forever record with no proof of order
// technique: a scratch ledger holding two rows from before the chain, then rows of both shapes through the foreman's writer,
//            then a second writer on the same file (a restart, a run foreman's process)
// method: every new row names the hash of the line before; the alist row stays two elements and the verdict row reads
//         through readVerdict; the verify counts the rows before the chain and passes (red before: no row named a prev)
// sre: can the owner prove the ledger's order, and do the ledger's readers still read it?
test('each ledger row names the hash of the line before, and every reader still reads it', () => {
  const file = scratch()
  fs.writeFileSync(file, LEGACY)
  const write = ledgerWriter(file)
  write('(run (@ ("id" "w-1") ("outcome" "pass") ("exit" 0)))\n')
  const sup = { host: { ledger: write, now: () => 100 } }
  const w = { id: 'w-1', run: { key: 'k' }, cart: null }
  appendVerdict(sup, w, { run: 'w-1', step: 1, check: 'no-progress', by: 'code', action: 'kick', detail: 'd', why: 'quiet', at: 'w-1:1', t: 100, light: 'amber' })
  ledgerWriter(file)('(cart-sentry (@ ("run" "w-1") ("check" "no-progress")))\n')
  const lines = fs.readFileSync(file, 'utf8').trim().split('\n')
  assert.equal(lines.length, 5)
  for (let i = 2; i < 5; i++) assert.equal(prevOf(lines[i]), sha(lines[i - 1]), `row ${i + 1}`)
  const [run] = readForms(lines[2])
  assert.equal(run.length, 2, 'the alist row is still two elements')
  assert.equal(readVerdict(lines[3]).why, 'quiet')
  assert.deepEqual(verifyLedger(fs.readFileSync(file, 'utf8')), { ok: true, rows: 5, before: 2, chained: 3, broken: null })
  const fresh = scratch()
  ledgerWriter(fresh)('(swap (@ ("ok" #t)))')
  assert.equal(prevOf(fs.readFileSync(fresh, 'utf8').trim()), 'genesis')
})

// spec: E14 §5 row 10 (lacuna.ledger.chain.01 red at the first broken line) · class: M a record changed after it was written ·
// technique: change one chained row's words; append a row by hand with no prev · method: the verify names the line and why ·
// sre: when a row of the forever ledger is edited, does the watchdog say which?
test('a changed row breaks the chain at the line after it; a row with no prev after the chain began breaks it at itself', () => {
  const file = scratch()
  fs.writeFileSync(file, LEGACY)
  const write = ledgerWriter(file)
  for (let i = 0; i < 3; i++) write(`(run (@ ("id" "w-${i}") ("outcome" "pass")))`)
  const lines = fs.readFileSync(file, 'utf8').trim().split('\n')
  const edited = [...lines]
  edited[3] = edited[3].replace('w-1', 'w-9')
  assert.deepEqual(verifyLedger(edited.join('\n')).broken, { line: 5, why: 'its prev is not the hash of the line before' })
  assert.deepEqual(verifyLedger([...lines, '(swap (@ ("ok" #t)))'].join('\n')).broken, { line: 6, why: 'the row names no prev after the chain began' })
  assert.throws(() => chainRow('not a form', 'genesis'), /one form a line/)
})
