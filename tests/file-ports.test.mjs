// tests/file-ports.test.mjs — R7RS §6.13.1 file ports, §6.14 `load`, and
// §4.1.7 `include` / `include-ci`.
//
// decision-010 deferred this whole surface — "Motoi has no file ports." That
// was a scope call, not a conformance argument, and it cost 13 verbs the
// standard requires: three drops plus three cascading failures in Larceny's
// base.sld and four failures in chibi's. Struck 2026-08-03.
//
// Two properties here are NOT conformance and would be silently lost without a
// test, because both only show up in a program that misbehaves:
//
//   1. Writes go THROUGH to the descriptor. If a file port buffered instead,
//      a program that forgot to close would lose everything it wrote, and the
//      failure would look like the program never ran.
//   2. Every filename is canonicalized by `safePath` first. A file port must
//      not become the one door in the engine that reads outside the allowed
//      roots.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { makeCoreEnv } from '../core/index.js'
import { evaluate } from '../src/interp.js'
import { parse } from '../src/reader.js'
import { expandProgram } from '../src/macro.js'

// The sandbox allows cwd and below, so the scratch dir is where a test may
// write. `scratch/` is the repo's working area (CLAUDE.md) and gitignored.
const SCRATCH = join(process.cwd(), 'scratch')

function run(src, baseDir = undefined) {
  const fuel = { n: 1_000_000 }
  const env = makeCoreEnv({ fuel })
  const { forms } = expandProgram(parse(src), { fuel: { n: 1_000_000 }, baseDir })
  let last
  for (const f of forms) last = evaluate(f, env, fuel)
  return last
}

// Compare RENDERED output, not the raw carrier. A Scheme symbol is a `Sym`
// and a list is a cell chain, so `assert.equal(run("'x"), 'x')` compares an
// object against a string and fails for a reason that has nothing to do with
// what is being tested.
function shows(src, expected, baseDir = undefined) {
  assert.equal(run(`(with-output-to-string (lambda () (write ${src})))`, baseDir), expected)
}

function withTempDir(fn) {
  const dir = mkdtempSync(join(SCRATCH, 'fileport-'))
  try { return fn(dir) } finally { rmSync(dir, { recursive: true, force: true }) }
}

// A path the Scheme program can name. Relative to cwd so it stays inside the
// sandbox no matter where the runner was started.
const rel = (dir, name) => join(dir, name).slice(process.cwd().length + 1)

test('a textual file port round-trips what was written to it', () => {
  withTempDir((dir) => {
    const f = rel(dir, 'round.txt')
    shows(`(begin
              (call-with-output-file "${f}"
                (lambda (p) (display "hello" p) (newline p) (write (list 1 2 3) p)))
              (call-with-input-file "${f}"
                (lambda (p) (list (read-line p) (read-line p) (eof-object? (read-line p))))))`,
      '("hello" "(1 2 3)" #t)')
  })
})

test('writes reach the disk without waiting for a close', () => {
  // The port is opened and written to and then simply abandoned — no
  // close-port, no call-with-port. A buffering implementation loses this
  // text entirely, and loses it silently.
  withTempDir((dir) => {
    const f = rel(dir, 'unclosed.txt')
    run(`(let ((p (open-output-file "${f}"))) (display "not lost" p))`)
    assert.equal(readFileSync(join(process.cwd(), f), 'utf8'), 'not lost')
  })
})

test('the current port is rebound for the extent of with-output-to-file', () => {
  withTempDir((dir) => {
    const f = rel(dir, 'current.txt')
    // The thunk takes NO port argument — that is the whole point of this verb.
    shows(`(begin
              (with-output-to-file "${f}" (lambda () (display "via current port")))
              (with-input-from-file "${f}" (lambda () (read-line))))`,
      '"via current port"')
    // …and the parameter is restored afterwards, including the case where the
    // thunk raised. A leaked current-output-port would break every later
    // `display` in the program, which is a failure far from its cause.
    shows(`(begin
              (guard (e (#t 'raised))
                (with-output-to-file "${rel(dir, 'raised.txt')}"
                  (lambda () (display "x") (error "boom"))))
              (with-output-to-string (lambda () (display "still stdout"))))`,
      '"still stdout"')
  })
})

test('a binary file port carries bytes, not text', () => {
  withTempDir((dir) => {
    const f = rel(dir, 'bytes.bin')
    const got = run(`(begin
        (let ((p (open-binary-output-file "${f}")))
          (write-u8 65 p) (write-bytevector (bytevector 66 67) p) (close-port p))
        (let ((p (open-binary-input-file "${f}")))
          (let ((bv (read-bytevector 8 p))) (close-port p) bv)))`)
    assert.deepEqual([...got], [65, 66, 67])
    assert.equal(readFileSync(join(process.cwd(), f), 'utf8'), 'ABC')
  })
})

test('file-exists? and delete-file agree about the same file', () => {
  withTempDir((dir) => {
    const f = rel(dir, 'gone.txt')
    writeFileSync(join(process.cwd(), f), 'x')
    shows(`(let ((before (file-exists? "${f}")))
             (delete-file "${f}")
             (list before (file-exists? "${f}")))`,
      '(#t #f)')
  })
})

test('a filesystem failure raises something file-error? can name', () => {
  // §6.11. Without this the only way to survive a missing file is a bare
  // `(guard (e (#t …)))`, which swallows every other condition too.
  withTempDir((dir) => {
    shows(`(guard (e ((file-error? e) 'file-error)) (open-input-file "${rel(dir, 'absent.txt')}"))`,
      'file-error')
    shows(`(guard (e ((file-error? e) 'file-error)) (delete-file "${rel(dir, 'absent.txt')}"))`,
      'file-error')
  })
})

test('a path outside the sandbox is refused, not read', () => {
  // safePath is the engine-wide guard every other file-touching verb uses.
  // A file port must not be the exception that reads /etc/passwd.
  shows(`(guard (e ((file-error? e) 'refused)) (open-input-file "/etc/passwd"))`, 'refused')
  shows(`(guard (e ((file-error? e) 'refused)) (open-output-file "/tmp/motoi-escape-probe"))`, 'refused')
  // `file-exists?` answers a boolean, so refusal is #f — there is no third
  // answer in its contract and raising would make it unusable as a guard.
  shows(`(file-exists? "/etc/passwd")`, '#f')
})

test('load expands the file before it evaluates it', () => {
  // `eval` alone would meet the first define-syntax and have nothing to do
  // with it, so the macro below is the point of the test, not decoration.
  withTempDir((dir) => {
    const f = rel(dir, 'loaded.scm')
    writeFileSync(join(process.cwd(), f), `
      (define-syntax twice (syntax-rules () ((_ e) (begin e e))))
      (define (loaded-fact n) (if (= n 0) 1 (* n (loaded-fact (- n 1)))))
      (twice (loaded-fact 5))
    `)
    // The definitions land in the calling environment, and the value of the
    // last form comes back.
    shows(`(list (load "${f}") (loaded-fact 6))`, '(120 720)')
  })
})

test('include splices a file at expand time, macros and all', () => {
  withTempDir((dir) => {
    writeFileSync(join(dir, 'part.scm'), `
      (define (inc-a x) (+ x 100))
      (define-syntax inc-twice (syntax-rules () ((_ e) (inc-a (inc-a e)))))
    `)
    // A macro defined in the included file must be visible to the code AFTER
    // the include — that is what makes `include` different from `load`.
    shows(`(begin (include "part.scm") (list (inc-a 1) (inc-twice 1)))`, '(101 201)', dir)
  })
})

test('include-ci folds case; include does not', () => {
  withTempDir((dir) => {
    writeFileSync(join(dir, 'shout.scm'), `(DEFINE (SHOUTED X) (* X 2))`)
    assert.equal(run(`(include-ci "shout.scm") (shouted 21)`, dir), 42)
    // Plain `include` reads the same file case-SENSITIVELY, so `DEFINE` stays
    // spelled `DEFINE` — not a definition at all, just an application of an
    // unbound name. Motoi's reader is case-sensitive per §2.1.
    assert.throws(() => run(`(include "shout.scm") (shouted 21)`, dir), /DEFINE/)
  })
})

test('include resolves relative to the including file, not the process', () => {
  // §4.1.7 leaves this implementation-specific and suggests the including
  // file's directory. A subdirectory is used so cwd could not accidentally
  // find the file and make the test pass for the wrong reason.
  withTempDir((dir) => {
    writeFileSync(join(dir, 'sibling.scm'), `(define sibling-value 7)`)
    assert.equal(run(`(include "sibling.scm") sibling-value`, dir), 7)
  })
})

test('(scheme file) is now a library cond-expand can see', () => {
  shows(`(cond-expand ((library (scheme file)) 'have-file) (else 'no-file))`, 'have-file')
})
