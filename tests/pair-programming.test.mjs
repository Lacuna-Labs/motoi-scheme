// tests/pair-programming.test.mjs — Motoi as pair partner.
//
// Provenance: 2026-07-19 (Marcus, IDE Wave 2). Verifies:
//   - pair-on! / off! toggles mode
//   - explain returns a warm, "we"-voice paragraph
//   - refactor-suggest catches the six known rewrites
//   - bug-spot runs code in an isolated env + returns a fix hint
//   - ambient-complete returns registry hits ordered by prefix
//   - every pair event logs via motoi/log-exchange! (composes with
//     reading-state)

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, unlinkSync } from 'node:fs'
import { makeCoreEnv } from '../core/index.js'
import { evaluate } from '../src/interp.js'
import { parse, Sym } from '../src/reader.js'
import { READING_STATE_PATH, _resetSharedStateForTests } from '../lib/system/reading-state.js'

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

function cleanState() {
  _resetSharedStateForTests()
  try { if (existsSync(READING_STATE_PATH)) unlinkSync(READING_STATE_PATH) } catch { /* fine */ }
}

// ── mode toggle ───────────────────────────────────────────────────────

test('motoi/pair-on! + motoi/pair-mode? — toggles user-drives', () => {
  cleanState()
  const env = makeCoreEnv({ fuel: { n: 500000 } })
  evalSrc('(motoi/pair-on!)', env)
  const { out } = evalSrc('(motoi/pair-mode?)', env)
  assert.ok(out instanceof Sym)
  assert.equal(out.name, 'user-drives')
})

test('motoi/pair-off! — returns to off', () => {
  cleanState()
  const env = makeCoreEnv({ fuel: { n: 500000 } })
  evalSrc('(motoi/pair-on!)', env)
  evalSrc('(motoi/pair-off!)', env)
  const { out } = evalSrc('(motoi/pair-mode?)', env)
  assert.equal(out.name, 'off')
})

test('motoi/pair-set-mode! motoi-drives — switches mode', () => {
  cleanState()
  const env = makeCoreEnv({ fuel: { n: 500000 } })
  evalSrc('(motoi/pair-set-mode! (quote motoi-drives))', env)
  const { out } = evalSrc('(motoi/pair-mode?)', env)
  assert.equal(out.name, 'motoi-drives')
})

test('motoi/pair-set-mode! invalid — returns #f', () => {
  cleanState()
  const env = makeCoreEnv({ fuel: { n: 500000 } })
  const { out } = evalSrc('(motoi/pair-set-mode! (quote spaceship))', env)
  assert.equal(out, false)
})

// ── explanation ───────────────────────────────────────────────────────

test('motoi/explain — special form uses warm we-voice', () => {
  cleanState()
  const env = makeCoreEnv({ fuel: { n: 500000 } })
  const { out } = evalSrc('(motoi/explain "(define x 5)")', env)
  assert.match(out, /\[motoi\]/)
  assert.match(out, /we/)
  assert.match(out, /naming/)
})

test('motoi/explain — lambda gets the parameter/body explanation', () => {
  cleanState()
  const env = makeCoreEnv({ fuel: { n: 500000 } })
  const { out } = evalSrc('(motoi/explain "(lambda (x) (* x x))")', env)
  assert.match(out, /parameter/)
})

test('motoi/explain — a registered verb call cites the verb name', () => {
  cleanState()
  const env = makeCoreEnv({ fuel: { n: 500000 } })
  const { out } = evalSrc('(motoi/explain "(vec/dot (list 1 2) (list 3 4))")', env)
  // vec/dot should be recognised
  assert.match(out, /vec\/dot/)
})

test('motoi/explain-selection — same as motoi/explain', () => {
  cleanState()
  const env = makeCoreEnv({ fuel: { n: 500000 } })
  const { out } = evalSrc('(motoi/explain-selection "(if #t 1 2)")', env)
  assert.match(out, /branch/)
})

test('motoi/explain — empty selection asks user to select', () => {
  cleanState()
  const env = makeCoreEnv({ fuel: { n: 500000 } })
  const { out } = evalSrc('(motoi/explain "")', env)
  assert.match(out, /select/)
})

// ── refactor suggestions ─────────────────────────────────────────────

test('motoi/refactor-suggest — (if x #t #f) becomes (and x)', () => {
  cleanState()
  const env = makeCoreEnv({ fuel: { n: 500000 } })
  const { out } = evalSrc('(motoi/refactor-suggest "(if foo #t #f)")', env)
  assert.match(alistGet(out, ':suggested'), /\(and foo\)/)
  assert.equal(alistGet(out, ':changed?'), true)
})

test('motoi/refactor-suggest — (car (cdr xs)) becomes cadr', () => {
  cleanState()
  const env = makeCoreEnv({ fuel: { n: 500000 } })
  const { out } = evalSrc('(motoi/refactor-suggest "(car (cdr xs))")', env)
  assert.match(alistGet(out, ':suggested'), /\(cadr xs\)/)
})

test('motoi/refactor-suggest — (vec/make (list …)) becomes (vec/make …)', () => {
  cleanState()
  const env = makeCoreEnv({ fuel: { n: 500000 } })
  const { out } = evalSrc('(motoi/refactor-suggest "(vec/make (list 1 2 3))")', env)
  assert.match(alistGet(out, ':suggested'), /\(vec\/make 1 2 3\)/)
})

test('motoi/refactor-suggest — geom/sin gets math/sin alias', () => {
  cleanState()
  const env = makeCoreEnv({ fuel: { n: 500000 } })
  const { out } = evalSrc('(motoi/refactor-suggest "(geom/sin x)")', env)
  assert.match(alistGet(out, ':suggested'), /math\/sin/)
})

test('motoi/refactor-suggest — clean code returns unchanged + why="looks fine"', () => {
  cleanState()
  const env = makeCoreEnv({ fuel: { n: 500000 } })
  const { out } = evalSrc('(motoi/refactor-suggest "(+ 1 2)")', env)
  assert.equal(alistGet(out, ':changed?'), false)
  assert.match(alistGet(out, ':why'), /fine/)
})

// ── bug spotting ──────────────────────────────────────────────────────

test('motoi/bug-spot — good code returns :ok? #t', () => {
  cleanState()
  const env = makeCoreEnv({ fuel: { n: 500000 } })
  const { out } = evalSrc('(motoi/bug-spot "(+ 1 2)")', env)
  assert.equal(alistGet(out, ':ok?'), true)
})

test('motoi/bug-spot — unbalanced parens surfaces error + fix', () => {
  cleanState()
  const env = makeCoreEnv({ fuel: { n: 500000 } })
  const { out } = evalSrc('(motoi/bug-spot "(+ 1 2")', env)
  assert.equal(alistGet(out, ':ok?'), false)
  assert.ok(alistGet(out, ':error'))
})

test('motoi/bug-spot — unknown variable surfaces error', () => {
  cleanState()
  const env = makeCoreEnv({ fuel: { n: 500000 } })
  const { out } = evalSrc('(motoi/bug-spot "(no-such-verb 1)")', env)
  assert.equal(alistGet(out, ':ok?'), false)
})

// ── ambient completions ──────────────────────────────────────────────

test('motoi/ambient-complete — vec/ prefix returns vec/* verbs', () => {
  cleanState()
  const env = makeCoreEnv({ fuel: { n: 500000 } })
  const { out } = evalSrc('(motoi/ambient-complete "vec/")', env)
  assert.ok(Array.isArray(out))
  assert.ok(out.length > 0, 'should suggest at least one vec/* verb')
  const names = out.map((row) => alistGet(row, ':name'))
  assert.ok(names.some((n) => n.startsWith('vec/')))
})

test('motoi/ambient-complete — short prefix returns empty', () => {
  cleanState()
  const env = makeCoreEnv({ fuel: { n: 500000 } })
  const { out } = evalSrc('(motoi/ambient-complete "v")', env)
  assert.deepEqual(out, [])
})

// ── pair-narrate ──────────────────────────────────────────────────────

test('motoi/pair-narrate! — returns [motoi]-prefixed text', () => {
  cleanState()
  const env = makeCoreEnv({ fuel: { n: 500000 } })
  const { out } = evalSrc('(motoi/pair-narrate! "watch this")', env)
  assert.equal(out, '[motoi] watch this')
})

// ── introspection ─────────────────────────────────────────────────────

test('motoi/pair-state — reflects mode + last actions', () => {
  cleanState()
  const env = makeCoreEnv({ fuel: { n: 500000 } })
  evalSrc('(motoi/pair-on!)', env)
  evalSrc('(motoi/explain "(+ 1 2)")', env)
  const { out } = evalSrc('(motoi/pair-state)', env)
  assert.equal((alistGet(out, ':mode') || {}).name, 'user-drives')
  assert.ok(alistGet(out, ':last-explanation'))
})

// ── composition with reading-state ────────────────────────────────────

test('pair events log via reading-state session log', () => {
  cleanState()
  const env = makeCoreEnv({ fuel: { n: 500000 } })
  evalSrc('(motoi/pair-on!)', env)
  evalSrc('(motoi/explain "(+ 1 2)")', env)
  const { out } = evalSrc('(motoi/session-log 20)', env)
  // We expect at least the pair-on + explain events to be logged.
  const kinds = out.map((row) => (alistGet(row, ':kind') || {}).name)
  assert.ok(kinds.includes('pair-on'))
  assert.ok(kinds.includes('explain'))
  cleanState()
})
