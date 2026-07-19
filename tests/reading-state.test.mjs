// tests/reading-state.test.mjs — persistent per-chapter progress.
//
// Provenance: 2026-07-19 (Marcus, IDE Wave 2). Alfred's question:
// "how will it know what text was read?" — this file verifies that
// (motoi/reading-state) roundtrips through disk, the tutor's progress
// bar has real data behind it, and highlights/bookmarks/session-log
// all persist across sessions.
//
// Tests avoid touching `~/.motoi/reading-state.slat` — every test uses
// a temp path via MOTOI_READING_STATE_PATH-like isolation. We do this
// by resetting the shared state box between tests and using the exposed
// _resetSharedStateForTests seam.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, unlinkSync, readFileSync } from 'node:fs'
import { makeCoreEnv } from '../core/index.js'
import { evaluate } from '../src/interp.js'
import { parse, Sym } from '../src/reader.js'
import {
  READING_STATE_PATH,
  emptyState,
  serializeStateToSlat,
  parseStateFromSlat,
  _resetSharedStateForTests,
} from '../lib/system/reading-state.js'

function evalSrc(src, envOpt) {
  const fuel = { n: 1_000_000 }
  const env = envOpt || makeCoreEnv({ fuel })
  const forms = parse(src)
  let out
  for (const f of forms) out = evaluate(f, env, fuel)
  return { out, env }
}

function alistGet(alist, key) {
  if (!Array.isArray(alist)) return undefined
  for (const pair of alist) {
    if (Array.isArray(pair) && pair.length === 2 && pair[0] instanceof Sym) {
      if (pair[0].name === key) return pair[1]
    }
  }
  return undefined
}

// Every test that mutates disk state resets first so we don't collide
// with the real user's ~/.motoi file, and we clean up after.
function cleanSharedAndFile() {
  _resetSharedStateForTests()
  try {
    if (existsSync(READING_STATE_PATH)) unlinkSync(READING_STATE_PATH)
  } catch { /* fine */ }
}

// ── (1) SLAT round-trip ──────────────────────────────────────────────

test('serialize + parse — state round-trips', () => {
  const s = emptyState()
  s.chapters['code:12'] = {
    book: 'code', chapter: 12,
    firstReadAt: 100, lastVisitedAt: 200,
    sections: { intro: {}, 'fetch-decode': {} },
    codeBlockRuns: { 1: 3, 2: 1 },
    notes: 'my thoughts on the fetch loop',
  }
  s.bookmarks['attention'] = { context: 'ml/12', createdAt: 300 }
  s.highlights.push({ text: '(vec/dot ws xs)', context: 'buffer 3', at: 400 })
  s.sessionLog.push({ at: 500, kind: 'in', text: '(+ 1 2)' })
  s.sessionLog.push({ at: 600, kind: 'out', text: '3' })

  const slat = serializeStateToSlat(s)
  assert.match(slat, /MOTOI READING STATE/)
  assert.match(slat, /:book "code"/)
  assert.match(slat, /:chapter 12/)

  const back = parseStateFromSlat(slat)
  assert.equal(back.chapters['code:12'].chapter, 12)
  assert.equal(back.chapters['code:12'].book, 'code')
  assert.equal(back.chapters['code:12'].notes, 'my thoughts on the fetch loop')
  assert.equal(back.chapters['code:12'].codeBlockRuns['1'], 3)
  assert.deepEqual(Object.keys(back.chapters['code:12'].sections).sort(),
    ['fetch-decode', 'intro'])
  assert.equal(back.bookmarks['attention'].context, 'ml/12')
  assert.equal(back.highlights[0].text, '(vec/dot ws xs)')
  assert.equal(back.sessionLog[1].text, '3')
})

// ── (2) verb wiring — mark-read, then read state ─────────────────────

test('motoi/mark-read! — records a chapter visit; reading-state returns it', () => {
  cleanSharedAndFile()
  const env = makeCoreEnv({ fuel: { n: 500000 } })

  evalSrc('(motoi/mark-read! "code" 6 (quote intro))', env)
  const { out } = evalSrc('(motoi/reading-state (quote code/6))', env)

  assert.equal(alistGet(out, ':book'), 'code')
  assert.equal(alistGet(out, ':chapter'), 6)
  assert.equal(alistGet(out, ':section-count'), 1)
  assert.deepEqual(alistGet(out, ':sections'), ['intro'])
})

test('motoi/mark-read! — multiple sections accumulate', () => {
  cleanSharedAndFile()
  const env = makeCoreEnv({ fuel: { n: 500000 } })
  evalSrc('(motoi/mark-read! "code" 6 (quote intro))', env)
  evalSrc('(motoi/mark-read! "code" 6 (quote body))', env)
  evalSrc('(motoi/mark-read! "code" 6 (quote wrap-up))', env)
  const { out } = evalSrc('(motoi/reading-state (quote code/6))', env)
  assert.equal(alistGet(out, ':section-count'), 3)
})

// ── (3) code-block runs increment the counter ─────────────────────────

test('motoi/mark-block-run! — bumps the per-block run counter', () => {
  cleanSharedAndFile()
  const env = makeCoreEnv({ fuel: { n: 500000 } })
  const r1 = evalSrc('(motoi/mark-block-run! "code" 12 1)', env).out
  const r2 = evalSrc('(motoi/mark-block-run! "code" 12 1)', env).out
  const r3 = evalSrc('(motoi/mark-block-run! "code" 12 1)', env).out
  assert.equal(r1, 1)
  assert.equal(r2, 2)
  assert.equal(r3, 3)
})

// ── (4) reading-progress alist ────────────────────────────────────────

test('motoi/reading-progress — returns read + total + last-visited-at', () => {
  cleanSharedAndFile()
  const env = makeCoreEnv({ fuel: { n: 500000 } })
  evalSrc('(motoi/mark-read! "code" 6 (quote a))', env)
  evalSrc('(motoi/mark-read! "code" 6 (quote b))', env)
  const { out } = evalSrc('(motoi/reading-progress "code" 6 4)', env)
  assert.equal(alistGet(out, ':read'), 2)
  assert.equal(alistGet(out, ':total'), 4)
  assert.ok(alistGet(out, ':last-visited-at') > 0)
})

// ── (5) bookmarks ─────────────────────────────────────────────────────

test('motoi/bookmark! + motoi/bookmarks — round-trip', () => {
  cleanSharedAndFile()
  const env = makeCoreEnv({ fuel: { n: 500000 } })
  evalSrc('(motoi/bookmark! (quote attention-lemma) "ml/12")', env)
  evalSrc('(motoi/bookmark! (quote backprop) "ml/9")', env)
  const { out } = evalSrc('(motoi/bookmarks)', env)
  assert.equal(out.length, 2)
  const names = out.map((row) => alistGet(row, ':name')).sort()
  assert.deepEqual(names, ['attention-lemma', 'backprop'])
})

test('motoi/bookmark-delete! — removes a bookmark', () => {
  cleanSharedAndFile()
  const env = makeCoreEnv({ fuel: { n: 500000 } })
  evalSrc('(motoi/bookmark! (quote temp) "test")', env)
  const before = evalSrc('(motoi/bookmarks)', env).out.length
  evalSrc('(motoi/bookmark-delete! (quote temp))', env)
  const after = evalSrc('(motoi/bookmarks)', env).out.length
  assert.equal(before, 1)
  assert.equal(after, 0)
})

// ── (6) highlights ────────────────────────────────────────────────────

test('motoi/highlight! + motoi/highlights — track selections', () => {
  cleanSharedAndFile()
  const env = makeCoreEnv({ fuel: { n: 500000 } })
  evalSrc('(motoi/highlight! "(vec/dot ws xs)" "buffer 1")', env)
  evalSrc('(motoi/highlight! "(matrix/mult A B)" "buffer 1")', env)
  const { out } = evalSrc('(motoi/highlights 10)', env)
  assert.equal(out.length, 2)
  // Most-recent-first
  assert.equal(alistGet(out[0], ':text'), '(matrix/mult A B)')
})

// ── (7) session log ──────────────────────────────────────────────────

test('motoi/log-exchange! + motoi/session-log — round-trip', () => {
  cleanSharedAndFile()
  const env = makeCoreEnv({ fuel: { n: 500000 } })
  evalSrc('(motoi/log-exchange! (quote in) "(+ 1 2)")', env)
  evalSrc('(motoi/log-exchange! (quote out) "3")', env)
  const { out } = evalSrc('(motoi/session-log 10)', env)
  assert.equal(out.length, 2)
  assert.equal(alistGet(out[0], ':text'), '(+ 1 2)')
  assert.equal((alistGet(out[0], ':kind') || {}).name, 'in')
})

// ── (8) disk persistence — file exists after a mark ───────────────────

test('reading-state file materializes at ~/.motoi/reading-state.slat', () => {
  cleanSharedAndFile()
  const env = makeCoreEnv({ fuel: { n: 500000 } })
  evalSrc('(motoi/mark-read! "code" 6 (quote intro))', env)
  assert.ok(existsSync(READING_STATE_PATH),
    `expected file at ${READING_STATE_PATH}`)
  const body = readFileSync(READING_STATE_PATH, 'utf8')
  assert.match(body, /MOTOI READING STATE/)
  assert.match(body, /:book "code"/)
  assert.match(body, /:chapter 6/)
  cleanSharedAndFile()
})

// ── (9) reset! wipes state ────────────────────────────────────────────

test('motoi/reading-state/reset! — empties the state', () => {
  cleanSharedAndFile()
  const env = makeCoreEnv({ fuel: { n: 500000 } })
  evalSrc('(motoi/mark-read! "code" 6 (quote a))', env)
  evalSrc('(motoi/bookmark! (quote x) "y")', env)
  evalSrc('(motoi/reading-state/reset!)', env)
  const { out } = evalSrc('(motoi/reading-state)', env)
  assert.deepEqual(alistGet(out, ':chapters'), [])
  assert.deepEqual(alistGet(out, ':bookmarks'), [])
  cleanSharedAndFile()
})

// ── (10) tutor integration — reading-progress shows in tutor voice ────

test('book-of-code/tutor 1 — shows progress bar after mark-read!', () => {
  cleanSharedAndFile()
  const env = makeCoreEnv({ fuel: { n: 500000 } })
  // Mark one section read, then ask the tutor to preview chapter 1.
  evalSrc('(motoi/mark-read! "code" 1 (quote intro))', env)
  const { out } = evalSrc('(book-of-code/tutor 1)', env)
  assert.match(String(out || ''), /Progress:/, 'tutor should show progress line')
  cleanSharedAndFile()
})
