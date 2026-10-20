#!/usr/bin/env python3
"""conformance-audit.py — is every standard verb implemented correctly?

Per Alfred 2026-07-24: "Audit them and replace all of them with SRFI compatible
version and always the latest and best one." Precedence ladder (CLAUDE.md):
R7RS-small first, then the latest/best SRFI, then Motoi-own.

This harness runs a spec-derived test for each standard verb through
./bin/motoi and classifies:
  PASS      — output matches the latest/best spec
  DIVERGE   — bound but wrong result/shape (needs replacement)
  MISSING   — unbound (needs implementing, or is a rejected non-standard name)

Latest/best spec chosen per verb:
  lists   -> SRFI-1
  strings -> R7RS §6.7 where it exists, else SRFI-13 (the string SRFI in-tree)
  hash    -> SRFI-125 (supersedes SRFI-69)
  random  -> SRFI-27 (make-random-source / random-integer / random-real)
"""
import subprocess, sys, json
from pathlib import Path

MOTOI = str(Path(__file__).resolve().parent.parent / 'bin' / 'motoi')

def run(code, timeout=15):
    try:
        r = subprocess.run([MOTOI, 'run', '/dev/stdin'], input=code,
                           capture_output=True, text=True, timeout=timeout)
        # rstrip only trailing newlines — leading spaces are significant
        # (string-pad "5" 3 => "  5"), so a full .strip() gives false DIVERGE.
        return (r.stdout or '').rstrip('\n'), (r.stderr or '').strip(), r.returncode
    except subprocess.TimeoutExpired:
        return '', 'TIMEOUT', -99

# (verb, standard, latest-best, display-expr, expected-substring)
# expected is the spec-correct output; DIVERGE if bound but mismatched.
TESTS = [
  # ─── SRFI-1 lists ───
  ("fold",           "SRFI-1", "SRFI-1", "(display (fold - 0 (list 1 2 3)))", "2"),          # elem-first (kons elem acc)
  ("fold-right",     "SRFI-1", "SRFI-1", "(display (fold-right cons (list) (list 1 2 3)))", "(1 2 3)"),
  ("reduce",         "SRFI-1", "SRFI-1", "(display (reduce - 0 (list 1 2 3)))", "2"),          # SRFI-1 reduce: (f elem acc), ridentity for empty
  ("filter",         "SRFI-1", "SRFI-1", "(display (filter odd? (list 1 2 3 4 5)))", "(1 3 5)"),
  ("remove",         "SRFI-1", "SRFI-1", "(display (remove odd? (list 1 2 3 4 5)))", "(2 4)"),
  ("partition",      "SRFI-1", "SRFI-1", "(call-with-values (lambda () (partition odd? (list 1 2 3 4))) (lambda (a b) (display a) (display b)))", "(1 3)(2 4)"),
  ("take",           "SRFI-1", "SRFI-1", "(display (take (list 1 2 3 4 5) 2))", "(1 2)"),
  ("drop",           "SRFI-1", "SRFI-1", "(display (drop (list 1 2 3 4 5) 2))", "(3 4 5)"),
  ("last",           "SRFI-1", "SRFI-1", "(display (last (list 1 2 3)))", "3"),
  ("last-pair",      "SRFI-1", "SRFI-1", "(display (last-pair (list 1 2 3)))", "(3)"),
  ("first",          "SRFI-1", "SRFI-1", "(display (first (list 1 2 3)))", "1"),
  ("iota",           "SRFI-1", "SRFI-1", "(display (iota 5))", "(0 1 2 3 4)"),
  ("iota",           "SRFI-1", "SRFI-1", "(display (iota 3 1))", "(1 2 3)"),          # iota count start
  ("delete-duplicates","SRFI-1","SRFI-1","(display (delete-duplicates (list 1 1 2 3 3)))", "(1 2 3)"),
  ("find",           "SRFI-1", "SRFI-1", "(display (find even? (list 1 3 4 5)))", "4"),
  ("any",            "SRFI-1", "SRFI-1", "(display (any even? (list 1 3 4)))", "#t"),
  ("every",          "SRFI-1", "SRFI-1", "(display (every odd? (list 1 3 5)))", "#t"),
  ("count",          "SRFI-1", "SRFI-1", "(display (count even? (list 1 2 3 4)))", "2"),
  ("concatenate",    "SRFI-1", "SRFI-1", "(display (concatenate (list (list 1 2) (list 3))))", "(1 2 3)"),
  ("append-map",     "SRFI-1", "SRFI-1", "(display (append-map (lambda (x) (list x x)) (list 1 2)))", "(1 1 2 2)"),
  ("list-index",     "SRFI-1", "SRFI-1", "(display (list-index even? (list 1 3 4)))", "2"),
  ("take-while",     "SRFI-1", "SRFI-1", "(display (take-while odd? (list 1 3 4 5)))", "(1 3)"),
  ("drop-while",     "SRFI-1", "SRFI-1", "(display (drop-while odd? (list 1 3 4 5)))", "(4 5)"),
  ("cons*",          "SRFI-1", "SRFI-1", "(display (cons* 1 2 (list 3 4)))", "(1 2 3 4)"),
  ("list-tabulate",  "SRFI-1", "SRFI-1", "(display (list-tabulate 3 (lambda (i) (* i i))))", "(0 1 4)"),
  # ─── SRFI-13 strings (only those NOT in R7RS §6.7) ───
  ("string-join",    "SRFI-13","SRFI-13","(display (string-join (list \"a\" \"b\" \"c\") \",\"))", "a,b,c"),
  ("string-index",   "SRFI-13","SRFI-13","(display (string-index \"hello\" #\\l))", "2"),
  ("string-contains","SRFI-13","SRFI-13","(display (string-contains \"hello\" \"ll\"))", "2"),
  ("string-take",    "SRFI-13","SRFI-13","(display (string-take \"hello\" 2))", "he"),
  ("string-drop",    "SRFI-13","SRFI-13","(display (string-drop \"hello\" 2))", "llo"),
  ("string-pad",     "SRFI-13","SRFI-13","(display (string-pad \"5\" 3))", "  5"),
  ("string-pad-right","SRFI-13","SRFI-13","(display (string-pad-right \"5\" 3))", "5  "),
  ("string-trim",    "SRFI-13","SRFI-13","(display (string-trim \"  hi  \"))", "hi"),
  ("string-reverse", "SRFI-13","SRFI-13","(display (string-reverse \"abc\"))", "cba"),
  ("string-titlecase","SRFI-13","SRFI-13","(display (string-titlecase \"hello world\"))", "Hello World"),
  # ─── SRFI-125 hash tables (supersedes SRFI-69) ───
  ("make-hash-table","SRFI-125","SRFI-125","(display (hash-table? (make-hash-table)))", "#t"),
  ("hash-table-set!","SRFI-125","SRFI-125","(let ((h (make-hash-table))) (hash-table-set! h 'k 9) (display (hash-table-ref h 'k)))", "9"),
  ("hash-table-ref/default","SRFI-125","SRFI-125","(display (hash-table-ref/default (make-hash-table) 'x 'D))", "D"),
  ("hash-table-update!/default","SRFI-125","SRFI-125","(let ((h (make-hash-table))) (hash-table-update!/default h 'k (lambda (v) (+ v 1)) 0) (display (hash-table-ref h 'k)))", "1"),
  ("hash-table-delete!","SRFI-125","SRFI-125","(let ((h (make-hash-table))) (hash-table-set! h 'k 1) (hash-table-delete! h 'k) (display (hash-table-contains? h 'k)))", "#f"),
  ("hash-table-keys","SRFI-125","SRFI-125","(let ((h (make-hash-table))) (hash-table-set! h 'a 1) (display (hash-table-keys h)))", "(a)"),
  ("hash-table-size","SRFI-125","SRFI-125","(let ((h (make-hash-table))) (hash-table-set! h 'a 1) (display (hash-table-size h)))", "1"),
  ("hash-table->alist","SRFI-125","SRFI-125","(let ((h (make-hash-table))) (hash-table-set! h 'a 1) (display (hash-table->alist h)))", "((a . 1))"),
  # ─── SRFI-27 random (latest/best random SRFI) ───
  ("random-integer", "SRFI-27","SRFI-27","(display (< (random-integer 10) 10))", "#t"),
  ("random-real",    "SRFI-27","SRFI-27","(display (< (random-real) 1))", "#t"),
  ("make-random-source","SRFI-27","SRFI-27","(display (if (make-random-source) 1 0))", "1"),
]

def classify(exp, out, err, rc):
    if 'unbound symbol' in err:
        return 'MISSING', err.splitlines()[0] if err else ''
    if rc != 0 or 'error' in err.lower():
        return 'DIVERGE', (err.splitlines()[0] if err else out)[:80]
    if out == exp or exp in out:
        return 'PASS', out
    return 'DIVERGE', f"got {out!r} want {exp!r}"

def main():
    rows = []
    from collections import Counter
    tally = Counter()
    for verb, std, best, expr, exp in TESTS:
        out, err, rc = run(expr)
        status, info = classify(exp, out, err, rc)
        tally[status] += 1
        rows.append({'verb': verb, 'std': std, 'best': best, 'status': status,
                     'expr': expr, 'expected': exp, 'info': info})
    print("=== CONFORMANCE AUDIT (latest/best spec) ===")
    print(f"  {dict(tally)}  of {len(TESTS)} tests\n")
    for st in ('MISSING', 'DIVERGE', 'PASS'):
        sub = [r for r in rows if r['status'] == st]
        if not sub: continue
        print(f"--- {st} ({len(sub)}) ---")
        for r in sub:
            print(f"  [{r['std']:<8}] {r['verb']:<24} {r['info']}")
        print()
    Path('scratch/conformance-audit.json').write_text(json.dumps(rows, indent=2))
    print("-> scratch/conformance-audit.json")

if __name__ == '__main__':
    main()
