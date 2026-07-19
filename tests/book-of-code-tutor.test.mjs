// tests/book-of-code-tutor.test.mjs
//
// Book-of-Code tutor — 5 verbs wrapping the raw `book/*` reader with a
// Motoi-voiced pedagogical layer. Author: Marcus (2026-07-19).
//
// Blocks:
//   (1) table-of-contents — returns chapter records with :title + :chapter.
//   (2) chapter N — returns structured record with :sections + :code-blocks.
//   (3) read N — plain prose string for a chapter.
//   (4) tutor with no arg — Motoi's intro voice.
//   (5) tutor N — chapter-specific intro (title + section list).
//   (6) run-code-block — evaluates a real ```scheme fence.
//   (7) missing chapter — polite fallback message.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeCoreEnv } from '../core/index.js'
import { evaluate } from '../src/interp.js'
import { parse, Sym } from '../src/reader.js'

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

// ── (1) table-of-contents ─────────────────────────────────────────────

test('book-of-code/table-of-contents — returns chapter records', () => {
  const { out } = evalSrc('(book-of-code/table-of-contents)')
  assert.ok(Array.isArray(out), 'toc is a list')
  assert.ok(out.length >= 2, 'at least the two authored chapters land')
  const first = out[0]
  const title = alistGet(first, ':title')
  const num = alistGet(first, ':chapter')
  assert.equal(typeof title, 'string')
  assert.ok(title.length > 0)
  assert.equal(typeof num, 'number')
})

// ── (2) chapter — structured ──────────────────────────────────────────

test('book-of-code/chapter 1 — returns structured record', () => {
  const { out } = evalSrc('(book-of-code/chapter 1)')
  assert.ok(Array.isArray(out), 'chapter returns an alist')
  const title = alistGet(out, ':title')
  const sections = alistGet(out, ':sections')
  assert.ok(String(title).includes('tallies'), 'title mentions tallies')
  assert.ok(Array.isArray(sections))
  assert.ok(sections.length > 0, 'chapter 1 has sections')
})

// ── (3) read — plain prose ────────────────────────────────────────────

test('book-of-code/read 1 — returns non-empty prose', () => {
  const { out } = evalSrc('(book-of-code/read 1)')
  assert.equal(typeof out, 'string')
  assert.ok(out.length > 100, 'prose is substantial')
  assert.ok(out.includes('tally') || out.includes('bone'), 'chapter 1 mentions tallies or bones')
})

// ── (4) tutor intro ───────────────────────────────────────────────────

test('book-of-code/tutor — no arg returns Motoi voice intro', () => {
  const { out } = evalSrc('(book-of-code/tutor)')
  assert.equal(typeof out, 'string')
  assert.ok(out.includes('motoi'), 'voice tag present')
  assert.ok(out.includes('Book of Code'), 'names the book')
})

// ── (5) chapter tutor ─────────────────────────────────────────────────

test('book-of-code/tutor 1 — chapter-specific intro', () => {
  const { out } = evalSrc('(book-of-code/tutor 1)')
  assert.equal(typeof out, 'string')
  assert.ok(out.includes('Chapter 1'))
})

// ── (6) run-code-block ────────────────────────────────────────────────
//
// The authored chapters contain runnable Scheme fences. We can't hard-
// code an assertion about "what block 1 evaluates to" because that
// depends on Ada's authored prose; instead we check that
// (a) missing block returns #f
// (b) present block does NOT throw and returns something
// (a real form or a parse-error string in the worst case, but never a
// throw the REPL would surface as an error).

test('book-of-code/run-code-block — missing block returns #f', () => {
  const { out } = evalSrc('(book-of-code/run-code-block 1 99)')
  assert.equal(out, false)
})

test('book-of-code/run-code-block — real block does not throw', () => {
  // Chapter 1 or 2 may or may not have runnable Scheme yet. If it does,
  // running block 1 should return something (a value or a string). If
  // not, it returns #f. Either way, must not throw.
  let threw = false
  try {
    evalSrc('(book-of-code/run-code-block 2 1)')
  } catch (e) { threw = true }
  assert.equal(threw, false, 'no throw')
})

// ── (7) missing chapter ───────────────────────────────────────────────

test('book-of-code/tutor 99 — polite fallback for missing chapter', () => {
  const { out } = evalSrc('(book-of-code/tutor 99)')
  assert.equal(typeof out, 'string')
  assert.ok(out.includes("isn't authored yet") || out.includes('table-of-contents'),
    'graceful fallback for missing chapter')
})

// ── smoke: tutor + CPU integration ────────────────────────────────────

test('CPU verbs and tutor coexist on the same env', () => {
  const { env } = evalSrc('(book-of-code/tutor)')
  const state = evalSrc('(cpu/boot!)', env).out
  assert.equal(alistGet(state, ':A'), 0)
  const disp = evalSrc('(cpu/display)', env).out
  assert.ok(disp.includes('A=00'))
})
