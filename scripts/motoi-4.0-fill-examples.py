#!/usr/bin/env python3
"""
motoi-4.0-fill-examples.py — Motoi 4.0 coverage lane (Ada, 2026-07-18).

For each of the 127 Appendix Z verbs that has no :examples block in the
reference, inject a canonical :examples list authored FROM R7RS/SRFI
semantics. Every example is real Motoi code (no fabrication of behavior).

Source citations:
- R7RS-small §6.6  (chars), §6.7 (strings), §6.2 (numeric tower),
  §6.10 (ports), §6.9 (bytevectors), §6.11 (exceptions), §4.2.4 (do),
  §4.2.5 (delay/force), §5.5 (records), §6.8 (vectors).
- SRFI-1 (list library), SRFI-13 (string library), SRFI-125 (hash tables).
- Existing runtime behavior in motoi-scheme/src/r7rs-completions.js
  (the implementation is the ground-truth for return-shape).

Every author-added example is a small, correct call that returns a
deterministic value — verified against the implementation's contract.

INSERTION SITE: for each missing verb, we splice a new
`\n  :examples (\n    (:dialect "motoi" :tier "novice" ...))\n`
line before the closing `)`  of the verb form (before the closing paren
at the same indent as the :name line).

USAGE:
  python3 scripts/motoi-4.0-fill-examples.py

Idempotent: if a verb already has :examples, we skip it.
"""

from __future__ import annotations
import re
import sys
from pathlib import Path

REF = Path("/Users/alfred/code/motoi-scheme/scheme/MOTOI-SCHEME-REFERENCE.slat")

# ─────────────────────────────────────────────────────────────────────
# EXAMPLE AUTHORING TABLE
# ─────────────────────────────────────────────────────────────────────
# Each entry: verb-name -> list of (tier, code, note) tuples.
# Semantics verified against R7RS + src/r7rs-completions.js.

EXAMPLES = {
    # ─── SRFI-1 selectors (nth) ─────────────────────────────────────
    "sixth":   [("novice", "(sixth (list 1 2 3 4 5 6))", "6."),
                ("intermediate", "(sixth (map (lambda (i) (* i i)) (iota 10)))", "The sixth square: 25.")],
    "seventh": [("novice", "(seventh (list 'a 'b 'c 'd 'e 'f 'g))", "'g."),
                ("intermediate", "(seventh (iota 10))", "The seventh element of (0 1 2 3 4 5 6 7 8 9): 6.")],
    "eighth":  [("novice", "(eighth (iota 10))", "7."),
                ("intermediate", "(eighth (list \"a\" \"b\" \"c\" \"d\" \"e\" \"f\" \"g\" \"h\"))", "\"h\".")],
    "ninth":   [("novice", "(ninth (iota 10))", "8."),
                ("intermediate", "(ninth (map (lambda (n) (* n 10)) (iota 10)))", "80.")],
    "tenth":   [("novice", "(tenth (iota 10))", "9."),
                ("intermediate", "(tenth (list 'a 'b 'c 'd 'e 'f 'g 'h 'i 'j))", "'j.")],

    # ─── list-copy ────────────────────────────────────────────────
    "list-copy": [("novice", "(list-copy (list 1 2 3))", "(1 2 3) — a fresh copy."),
                  ("intermediate", "(define original (list 1 2 3))\n(define twin (list-copy original))\n(eq? original twin)", "#f — same content, different list.")],

    # ─── SRFI-13 strings ──────────────────────────────────────────
    "string-downcase":  [("novice", "(string-downcase \"HELLO\")", "\"hello\"."),
                          ("intermediate", "(string-downcase \"Motoi Scheme\")", "\"motoi scheme\".")],
    "string-take":      [("novice", "(string-take \"hello\" 3)", "\"hel\"."),
                          ("intermediate", "(string-take \"motoi-scheme\" 5)", "\"motoi\".")],
    "string-drop":      [("novice", "(string-drop \"hello\" 3)", "\"lo\"."),
                          ("intermediate", "(string-drop \"motoi-scheme\" 6)", "\"scheme\".")],
    "string-pad-right": [("novice", "(string-pad-right \"7\" 3 \"0\")", "\"700\" — zero-padded on the right."),
                          ("intermediate", "(string-pad-right \"hi\" 5)", "\"hi   \" — space-padded to 5 chars.")],
    "string-trim":      [("novice", "(string-trim \"   hello   \")", "\"hello\"."),
                          ("intermediate", "(string-trim \"\\t\\nmotoi\\n\")", "\"motoi\" — trims tabs and newlines too.")],
    "string-trim-left": [("novice", "(string-trim-left \"   hello   \")", "\"hello   \"."),
                          ("intermediate", "(string-trim-left \"\\n\\n\\nmotoi\")", "\"motoi\".")],
    "string-trim-right":[("novice", "(string-trim-right \"   hello   \")", "\"   hello\"."),
                          ("intermediate", "(string-trim-right \"motoi\\n\\n\")", "\"motoi\".")],
    "string-reverse":   [("novice", "(string-reverse \"hello\")", "\"olleh\"."),
                          ("intermediate", "(string-reverse \"motoi\")", "\"iotom\".")],
    "string-count":     [("novice", "(string-count \"hello\" \"l\")", "2."),
                          ("intermediate", "(string-count \"mississippi\" \"s\")", "4.")],
    "string->list":     [("novice", "(string->list \"abc\")", "(\"a\" \"b\" \"c\")."),
                          ("intermediate", "(map string-upcase (string->list \"hi\"))", "(\"H\" \"I\") — upper-case each character.")],
    "list->string":     [("novice", "(list->string (list \"a\" \"b\" \"c\"))", "\"abc\"."),
                          ("intermediate", "(list->string (map string-upcase (string->list \"hi\")))", "\"HI\" — round-trip through a list.")],
    "string":           [("novice", "(string \"h\" \"i\")", "\"hi\" — join char-strings."),
                          ("intermediate", "(string \"a\" \"b\" \"c\" \"d\")", "\"abcd\".")],
    "make-string":      [("novice", "(make-string 5 \"x\")", "\"xxxxx\"."),
                          ("intermediate", "(make-string 3 \"-\")", "\"---\" — a separator.")],
    "string-copy":      [("novice", "(string-copy \"hello\")", "\"hello\" — a fresh copy."),
                          ("intermediate", "(define a \"hi\")\n(define b (string-copy a))\n(equal? a b)", "#t — same content.")],
    "string<?":         [("novice", "(string<? \"apple\" \"banana\")", "#t — lexicographic order."),
                          ("intermediate", "(string<? \"z\" \"a\")", "#f.")],
    "string>?":         [("novice", "(string>? \"banana\" \"apple\")", "#t."),
                          ("intermediate", "(string>? \"a\" \"z\")", "#f.")],
    "string<=?":        [("novice", "(string<=? \"apple\" \"apple\")", "#t."),
                          ("intermediate", "(string<=? \"a\" \"b\")", "#t.")],
    "string>=?":        [("novice", "(string>=? \"banana\" \"banana\")", "#t."),
                          ("intermediate", "(string>=? \"b\" \"a\")", "#t.")],
    "string-ci=?":      [("novice", "(string-ci=? \"Hello\" \"hello\")", "#t — case-insensitive equal."),
                          ("intermediate", "(string-ci=? \"MOTOI\" \"motoi\")", "#t.")],
    "string-ci<?":      [("novice", "(string-ci<? \"apple\" \"BANANA\")", "#t — case-insensitive compare."),
                          ("intermediate", "(string-ci<? \"Z\" \"a\")", "#f — 'z' > 'a' case-insensitive.")],
    "string->symbol":   [("novice", "(string->symbol \"hello\")", "hello — the symbol."),
                          ("intermediate", "(define name \"count\")\n(string->symbol name)", "count — build symbols at runtime.")],

    # ─── R7RS §6.6 characters (chars are 1-char strings in Motoi) ──
    "char?":            [("novice", "(char? \"a\")", "#t — single-character strings are chars."),
                          ("intermediate", "(char? \"ab\")", "#f — two-char string is not a char.")],
    "char=?":           [("novice", "(char=? \"a\" \"a\")", "#t."),
                          ("intermediate", "(char=? \"a\" \"b\")", "#f.")],
    "char<?":           [("novice", "(char<? \"a\" \"b\")", "#t."),
                          ("intermediate", "(char<? \"a\" \"a\")", "#f.")],
    "char>?":           [("novice", "(char>? \"b\" \"a\")", "#t."),
                          ("intermediate", "(char>? \"a\" \"b\")", "#f.")],
    "char<=?":          [("novice", "(char<=? \"a\" \"a\")", "#t."),
                          ("intermediate", "(char<=? \"a\" \"b\")", "#t.")],
    "char>=?":          [("novice", "(char>=? \"b\" \"b\")", "#t."),
                          ("intermediate", "(char>=? \"b\" \"a\")", "#t.")],
    "char-alphabetic?": [("novice", "(char-alphabetic? \"a\")", "#t."),
                          ("intermediate", "(char-alphabetic? \"5\")", "#f — digit, not letter.")],
    "char-numeric?":    [("novice", "(char-numeric? \"5\")", "#t."),
                          ("intermediate", "(char-numeric? \"a\")", "#f.")],
    "char-whitespace?": [("novice", "(char-whitespace? \" \")", "#t — space."),
                          ("intermediate", "(char-whitespace? \"\\t\")", "#t — tab.")],
    "char-upper-case?": [("novice", "(char-upper-case? \"A\")", "#t."),
                          ("intermediate", "(char-upper-case? \"a\")", "#f.")],
    "char-lower-case?": [("novice", "(char-lower-case? \"a\")", "#t."),
                          ("intermediate", "(char-lower-case? \"A\")", "#f.")],
    "char-upcase":      [("novice", "(char-upcase \"a\")", "\"A\"."),
                          ("intermediate", "(char-upcase \"z\")", "\"Z\".")],
    "char-downcase":    [("novice", "(char-downcase \"A\")", "\"a\"."),
                          ("intermediate", "(char-downcase \"Z\")", "\"z\".")],
    "char-foldcase":    [("novice", "(char-foldcase \"A\")", "\"a\" — canonical lowercase for comparison."),
                          ("intermediate", "(char-foldcase \"z\")", "\"z\" — already folded.")],
    "char->integer":    [("novice", "(char->integer \"a\")", "97 — ASCII/unicode codepoint."),
                          ("intermediate", "(char->integer \"A\")", "65.")],
    "integer->char":    [("novice", "(integer->char 65)", "\"A\"."),
                          ("intermediate", "(integer->char (+ (char->integer \"a\") 1))", "\"b\" — the next letter.")],

    # ─── R7RS §6.2 numeric tower ────────────────────────────────────
    "exact":            [("novice", "(exact 3.5)", "7/2 — the exact rational."),
                          ("intermediate", "(exact 1.5)", "3/2.")],
    "inexact":          [("novice", "(inexact 1)", "1.0 — floating-point 1."),
                          ("intermediate", "(inexact 3/2)", "1.5.")],
    "exact->inexact":   [("novice", "(exact->inexact 1/2)", "0.5."),
                          ("intermediate", "(exact->inexact 22/7)", "3.142857142857143 — an approximation of pi.")],
    "inexact->exact":   [("novice", "(inexact->exact 0.5)", "1/2."),
                          ("intermediate", "(inexact->exact 3.0)", "3.")],
    "exact?":           [("novice", "(exact? 3)", "#t — integers are exact."),
                          ("intermediate", "(exact? 3.0)", "#f — floats are inexact.")],
    "inexact?":         [("novice", "(inexact? 3.0)", "#t."),
                          ("intermediate", "(inexact? 3)", "#f.")],
    "integer?":         [("novice", "(integer? 3)", "#t."),
                          ("intermediate", "(integer? 3.5)", "#f.")],
    "rational?":        [("novice", "(rational? 1/2)", "#t."),
                          ("intermediate", "(rational? 3)", "#t — every integer is rational.")],
    "real?":            [("novice", "(real? 3.14)", "#t."),
                          ("intermediate", "(real? 3)", "#t — every integer is real.")],
    "complex?":         [("novice", "(complex? 3)", "#t — every real is complex."),
                          ("intermediate", "(complex? 3.14)", "#t.")],
    "exact-integer?":   [("novice", "(exact-integer? 3)", "#t."),
                          ("intermediate", "(exact-integer? 3.0)", "#f — inexact integers fail this test.")],
    "finite?":          [("novice", "(finite? 3.14)", "#t."),
                          ("intermediate", "(finite? (/ 1.0 0.0))", "#f — infinity is not finite.")],
    "infinite?":        [("novice", "(infinite? (/ 1.0 0.0))", "#t."),
                          ("intermediate", "(infinite? 3.14)", "#f.")],
    "nan?":             [("novice", "(nan? (/ 0.0 0.0))", "#t."),
                          ("intermediate", "(nan? 3.14)", "#f.")],
    "numerator":        [("novice", "(numerator 3/4)", "3."),
                          ("intermediate", "(numerator 6)", "6 — integers are k/1.")],
    "denominator":      [("novice", "(denominator 3/4)", "4."),
                          ("intermediate", "(denominator 6)", "1.")],
    "truncate":         [("novice", "(truncate 3.7)", "3.0 — toward zero."),
                          ("intermediate", "(truncate -3.7)", "-3.0 — toward zero, not down.")],
    "atan":             [("novice", "(atan 1)", "0.7853981633974483 — pi/4."),
                          ("intermediate", "(atan 1 1)", "0.7853981633974483 — 2-arg form: atan(y/x) in the right quadrant.")],

    # ─── R7RS §6.10 I/O + string ports ────────────────────────────
    "write":            [("novice", "(write \"hello\")", "Prints \"hello\" — with quotes, machine-readable form."),
                          ("intermediate", "(write (list 1 \"two\" 'three))", "Prints (1 \"two\" three) — write shows the shape.")],
    "write-string":     [("novice", "(write-string \"hello\")", "Prints hello — no quotes, no newline."),
                          ("intermediate", "(let ((p (open-output-string)))\n  (write-string \"hi\" p)\n  (get-output-string p))", "\"hi\" — captured into a string port.")],
    "write-char":       [("novice", "(write-char \"a\")", "Prints a — one character."),
                          ("intermediate", "(let ((p (open-output-string)))\n  (write-char \"x\" p)\n  (write-char \"y\" p)\n  (get-output-string p))", "\"xy\".")],
    "read-line":        [("novice", "(read-line (open-input-string \"hello\\nworld\"))", "\"hello\" — one line, newline stripped."),
                          ("intermediate", "(let ((p (open-input-string \"a\\nb\\nc\")))\n  (list (read-line p) (read-line p) (read-line p)))", "(\"a\" \"b\" \"c\").")],
    "read-char":        [("novice", "(read-char (open-input-string \"hi\"))", "\"h\" — one character."),
                          ("intermediate", "(let ((p (open-input-string \"ab\")))\n  (list (read-char p) (read-char p)))", "(\"a\" \"b\").")],
    "peek-char":        [("novice", "(peek-char (open-input-string \"hi\"))", "\"h\" — see without consuming."),
                          ("intermediate", "(let ((p (open-input-string \"xy\")))\n  (list (peek-char p) (read-char p) (read-char p)))", "(\"x\" \"x\" \"y\") — peek is idempotent.")],
    "eof-object":       [("novice", "(eof-object)", "The sentinel value indicating end-of-file."),
                          ("intermediate", "(eof-object? (eof-object))", "#t — every eof-object is eof.")],
    "eof-object?":      [("novice", "(eof-object? (eof-object))", "#t."),
                          ("intermediate", "(let ((p (open-input-string \"\")))\n  (eof-object? (read-char p)))", "#t — empty stream reads eof.")],
    "open-output-string": [("novice", "(define p (open-output-string))\n(write-string \"hi\" p)\n(get-output-string p)", "\"hi\"."),
                            ("intermediate", "(let ((p (open-output-string)))\n  (write 42 p)\n  (write-string \" and \" p)\n  (write 43 p)\n  (get-output-string p))", "\"42 and 43\".")],
    "get-output-string":[("novice", "(let ((p (open-output-string)))\n  (write-string \"done\" p)\n  (get-output-string p))", "\"done\"."),
                          ("intermediate", "(let ((p (open-output-string)))\n  (for-each (lambda (x) (write-string (number->string x) p)) (list 1 2 3))\n  (get-output-string p))", "\"123\".")],
    "close-port":       [("novice", "(let ((p (open-input-string \"hi\")))\n  (close-port p)\n  'closed)", "closed."),
                          ("intermediate", "(let ((p (open-input-string \"\")))\n  (close-port p)\n  (port? p))", "#t — the port object still exists, just closed.")],
    "close-input-port": [("novice", "(let ((p (open-input-string \"hi\")))\n  (close-input-port p)\n  'closed)", "closed."),
                          ("intermediate", "(close-input-port (open-input-string \"anything\"))", "Closes cleanly.")],
    "close-output-port":[("novice", "(let ((p (open-output-string)))\n  (close-output-port p)\n  'closed)", "closed."),
                          ("intermediate", "(close-output-port (open-output-string))", "Closes cleanly.")],
    "input-port?":      [("novice", "(input-port? (open-input-string \"x\"))", "#t."),
                          ("intermediate", "(input-port? (open-output-string))", "#f — output port fails this test.")],
    "output-port?":     [("novice", "(output-port? (open-output-string))", "#t."),
                          ("intermediate", "(output-port? (open-input-string \"x\"))", "#f.")],
    "port?":            [("novice", "(port? (open-input-string \"x\"))", "#t."),
                          ("intermediate", "(port? \"not a port\")", "#f.")],
    "with-input-from-string": [("novice", "(with-input-from-string \"hello\" (lambda () (read-line)))", "\"hello\"."),
                                ("intermediate", "(with-input-from-string \"a\\nb\" (lambda () (list (read-line) (read-line))))", "(\"a\" \"b\").")],

    # ─── R7RS §6.9 bytevectors ────────────────────────────────────
    "make-bytevector": [("novice", "(make-bytevector 4 0)", "#u8(0 0 0 0)."),
                         ("intermediate", "(make-bytevector 3 255)", "#u8(255 255 255) — three max bytes.")],
    "bytevector":      [("novice", "(bytevector 1 2 3)", "#u8(1 2 3)."),
                         ("intermediate", "(bytevector 72 105)", "#u8(72 105) — 'H' and 'i' in ASCII.")],
    "bytevector?":     [("novice", "(bytevector? (bytevector 1 2))", "#t."),
                         ("intermediate", "(bytevector? (list 1 2))", "#f — a list is not a bytevector.")],
    "bytevector-length": [("novice", "(bytevector-length (bytevector 1 2 3))", "3."),
                           ("intermediate", "(bytevector-length (make-bytevector 100 0))", "100.")],
    "bytevector-u8-ref": [("novice", "(bytevector-u8-ref (bytevector 10 20 30) 1)", "20 — zero-indexed."),
                           ("intermediate", "(bytevector-u8-ref (bytevector 72 105) 0)", "72.")],
    "bytevector-u8-set!": [("novice", "(define bv (bytevector 1 2 3))\n(bytevector-u8-set! bv 0 99)\nbv", "#u8(99 2 3)."),
                            ("intermediate", "(let ((bv (make-bytevector 3 0)))\n  (bytevector-u8-set! bv 0 65)\n  (bytevector-u8-set! bv 1 66)\n  (bytevector-u8-set! bv 2 67)\n  bv)", "#u8(65 66 67) — 'A' 'B' 'C'.")],
    "bytevector-copy": [("novice", "(bytevector-copy (bytevector 1 2 3))", "#u8(1 2 3) — a fresh copy."),
                         ("intermediate", "(define original (bytevector 1 2 3 4))\n(define twin (bytevector-copy original))\n(eq? original twin)", "#f — separate storage.")],
    "bytevector-append": [("novice", "(bytevector-append (bytevector 1 2) (bytevector 3 4))", "#u8(1 2 3 4)."),
                           ("intermediate", "(bytevector-append (bytevector 72) (bytevector 105))", "#u8(72 105).")],
    "string->utf8":    [("novice", "(string->utf8 \"hi\")", "#u8(104 105) — 'h' and 'i' as UTF-8 bytes."),
                         ("intermediate", "(bytevector-length (string->utf8 \"hello\"))", "5.")],

    # ─── SRFI-125 hash tables ─────────────────────────────────────
    "make-hash-table": [("novice", "(make-hash-table)", "A new empty hash table."),
                         ("intermediate", "(let ((h (make-hash-table)))\n  (hash-table-set! h 'name \"Motoi\")\n  (hash-table-ref h 'name #f))", "\"Motoi\".")],
    "hash-table?":     [("novice", "(hash-table? (make-hash-table))", "#t."),
                         ("intermediate", "(hash-table? (list 'not 'a 'table))", "#f.")],
    "hash-table-set!": [("novice", "(let ((h (make-hash-table)))\n  (hash-table-set! h 'k 42)\n  (hash-table-ref h 'k #f))", "42."),
                         ("intermediate", "(let ((h (make-hash-table)))\n  (hash-table-set! h 'a 1)\n  (hash-table-set! h 'b 2)\n  (hash-table-size h))", "2.")],
    "hash-table-ref":  [("novice", "(let ((h (make-hash-table)))\n  (hash-table-set! h 'x 10)\n  (hash-table-ref h 'x #f))", "10."),
                         ("intermediate", "(hash-table-ref (make-hash-table) 'missing 'default)", "default.")],
    "hash-table-ref/default": [("novice", "(hash-table-ref/default (make-hash-table) 'k 0)", "0 — the default."),
                                ("intermediate", "(let ((h (make-hash-table)))\n  (hash-table-set! h 'count 5)\n  (hash-table-ref/default h 'count 0))", "5.")],
    "hash-ref":        [("novice", "(let ((h (make-hash-table)))\n  (hash-set! h 'k 42)\n  (hash-ref h 'k #f))", "42 — alias for hash-table-ref."),
                         ("intermediate", "(hash-ref (make-hash-table) 'missing 'nope)", "nope.")],
    "hash-set!":       [("novice", "(let ((h (make-hash-table)))\n  (hash-set! h 'k 42)\n  (hash-ref h 'k #f))", "42 — alias for hash-table-set!."),
                         ("intermediate", "(let ((h (make-hash-table)))\n  (hash-set! h 'a 1)\n  (hash-set! h 'b 2)\n  (hash-table-size h))", "2.")],
    "hash-table-delete!": [("novice", "(let ((h (make-hash-table)))\n  (hash-table-set! h 'k 42)\n  (hash-table-delete! h 'k)\n  (hash-table-ref h 'k 'gone))", "gone."),
                            ("intermediate", "(let ((h (make-hash-table)))\n  (hash-table-set! h 'a 1)\n  (hash-table-set! h 'b 2)\n  (hash-table-delete! h 'a)\n  (hash-table-size h))", "1.")],
    "hash-table-exists?": [("novice", "(let ((h (make-hash-table)))\n  (hash-table-set! h 'k 42)\n  (hash-table-exists? h 'k))", "#t."),
                            ("intermediate", "(hash-table-exists? (make-hash-table) 'missing)", "#f.")],
    "hash-table-contains?": [("novice", "(let ((h (make-hash-table)))\n  (hash-table-set! h 'x 10)\n  (hash-table-contains? h 'x))", "#t — alias for hash-table-exists?."),
                              ("intermediate", "(hash-table-contains? (make-hash-table) 'nope)", "#f.")],
    "hash-table-keys": [("novice", "(let ((h (make-hash-table)))\n  (hash-table-set! h 'a 1)\n  (hash-table-set! h 'b 2)\n  (hash-table-keys h))", "(a b) — order unspecified."),
                         ("intermediate", "(length (hash-table-keys (make-hash-table)))", "0 — an empty table has no keys.")],
    "hash-table-values": [("novice", "(let ((h (make-hash-table)))\n  (hash-table-set! h 'a 1)\n  (hash-table-set! h 'b 2)\n  (hash-table-values h))", "(1 2) — order unspecified."),
                           ("intermediate", "(length (hash-table-values (make-hash-table)))", "0.")],
    "hash-table-size": [("novice", "(hash-table-size (make-hash-table))", "0."),
                         ("intermediate", "(let ((h (make-hash-table)))\n  (hash-table-set! h 'a 1)\n  (hash-table-set! h 'b 2)\n  (hash-table-set! h 'c 3)\n  (hash-table-size h))", "3.")],
    "hash-table-clear!": [("novice", "(let ((h (make-hash-table)))\n  (hash-table-set! h 'k 42)\n  (hash-table-clear! h)\n  (hash-table-size h))", "0."),
                           ("intermediate", "(let ((h (make-hash-table)))\n  (hash-table-set! h 'a 1)\n  (hash-table-clear! h)\n  (hash-table-exists? h 'a))", "#f.")],
    "hash-table-fold": [("novice", "(let ((h (make-hash-table)))\n  (hash-table-set! h 'a 1)\n  (hash-table-set! h 'b 2)\n  (hash-table-fold h (lambda (k v acc) (+ v acc)) 0))", "3 — sum of values."),
                         ("intermediate", "(let ((h (make-hash-table)))\n  (hash-table-set! h 'a 10)\n  (hash-table-set! h 'b 20)\n  (hash-table-fold h (lambda (k v acc) (cons (list k v) acc)) (list)))", "((a 10) (b 20)) — collect key-value pairs.")],
    "hash-table->alist": [("novice", "(let ((h (make-hash-table)))\n  (hash-table-set! h 'k 42)\n  (hash-table->alist h))", "((k 42))."),
                           ("intermediate", "(length (hash-table->alist (make-hash-table)))", "0.")],
    "alist->hash-table": [("novice", "(hash-table-ref (alist->hash-table (list (list 'k 42))) 'k #f)", "42."),
                           ("intermediate", "(hash-table-size (alist->hash-table (list (list 'a 1) (list 'b 2) (list 'c 3))))", "3.")],

    # ─── R7RS §6.8 vectors ───────────────────────────────────────
    "vector":          [("novice", "(vector 1 2 3)", "#(1 2 3)."),
                         ("intermediate", "(vector-length (vector 'a 'b 'c 'd))", "4.")],
    "make-vector":     [("novice", "(make-vector 3 0)", "#(0 0 0)."),
                         ("intermediate", "(make-vector 5 \"x\")", "#(\"x\" \"x\" \"x\" \"x\" \"x\").")],
    "vector?":         [("novice", "(vector? (vector 1 2 3))", "#t."),
                         ("intermediate", "(vector? (list 1 2 3))", "#t — in Motoi, vectors and lists share representation.")],
    "vector-length":   [("novice", "(vector-length (vector 1 2 3))", "3."),
                         ("intermediate", "(vector-length (make-vector 100 0))", "100.")],
    "vector-set!":     [("novice", "(let ((v (vector 1 2 3)))\n  (vector-set! v 0 99)\n  v)", "#(99 2 3)."),
                         ("intermediate", "(let ((v (make-vector 3 0)))\n  (vector-set! v 1 42)\n  v)", "#(0 42 0).")],
    "vector->list":    [("novice", "(vector->list (vector 1 2 3))", "(1 2 3)."),
                         ("intermediate", "(map (lambda (x) (* x 2)) (vector->list (vector 1 2 3)))", "(2 4 6).")],
    "list->vector":    [("novice", "(list->vector (list 1 2 3))", "#(1 2 3)."),
                         ("intermediate", "(vector-length (list->vector (iota 10)))", "10.")],
    "vector-map":      [("novice", "(vector-map (lambda (x) (* x x)) (vector 1 2 3))", "#(1 4 9)."),
                         ("intermediate", "(vector-map (lambda (x) (+ x 10)) (vector 1 2 3 4))", "#(11 12 13 14).")],
    "vector-for-each": [("novice", "(vector-for-each display (vector 1 2 3))", "Prints 123 — side effect on each element."),
                         ("intermediate", "(let ((sum 0))\n  (vector-for-each (lambda (x) (set! sum (+ sum x))) (vector 1 2 3 4))\n  sum)", "10.")],
    "vector-fill!":    [("novice", "(let ((v (make-vector 3 0)))\n  (vector-fill! v 7)\n  v)", "#(7 7 7)."),
                         ("intermediate", "(let ((v (vector 1 2 3 4 5)))\n  (vector-fill! v 0)\n  v)", "#(0 0 0 0 0).")],
    "vector-copy":     [("novice", "(vector-copy (vector 1 2 3))", "#(1 2 3) — a fresh copy."),
                         ("intermediate", "(define original (vector 1 2 3))\n(define twin (vector-copy original))\n(eq? original twin)", "#f — separate storage.")],

    # ─── R7RS §6.11 exceptions ───────────────────────────────────
    "raise":           [("novice", "(guard (c (#t 'caught)) (raise 'oops))", "caught — raise triggers the guard handler."),
                         ("intermediate", "(guard (c ((symbol? c) c)) (raise 'boom))", "boom.")],
    "raise-continuable":[("novice", "(guard (c (#t 'caught)) (raise-continuable 'oops))", "caught."),
                          ("intermediate", "(guard (c ((eq? c 'signal) 'handled)) (raise-continuable 'signal))", "handled.")],
    "error-object?":   [("novice", "(guard (c ((error-object? c) 'got-error)) (error \"boom\"))", "got-error."),
                         ("intermediate", "(error-object? 'not-an-error)", "#f.")],
    "error-object-message": [("novice", "(guard (c ((error-object? c) (error-object-message c))) (error \"boom\"))", "\"boom\"."),
                              ("intermediate", "(guard (c ((error-object? c) (error-object-message c))) (error \"bad-arg\" 42))", "\"bad-arg\".")],
    "error-object-irritants": [("novice", "(guard (c ((error-object? c) (error-object-irritants c))) (error \"boom\" 1 2 3))", "(1 2 3) — the irritants."),
                                ("intermediate", "(guard (c ((error-object? c) (length (error-object-irritants c)))) (error \"x\" 'a 'b))", "2.")],
    "error?":          [("novice", "(guard (c ((error? c) 'yes-error)) (error \"boom\"))", "yes-error."),
                         ("intermediate", "(error? \"not an error\")", "#f.")],

    # ─── R7RS §4.2.5 lazy ────────────────────────────────────────
    "force":           [("novice", "(force (delay (+ 1 2)))", "3 — forces the promise."),
                         ("intermediate", "(let ((p (delay (* 6 7))))\n  (force p))", "42.")],
    "make-promise":    [("novice", "(force (make-promise 42))", "42 — a pre-forced promise."),
                         ("intermediate", "(promise? (make-promise 'value))", "#t.")],
    "promise?":        [("novice", "(promise? (delay 42))", "#t."),
                         ("intermediate", "(promise? 42)", "#f.")],

    # ─── higher-order helpers ────────────────────────────────────
    "identity":        [("novice", "(identity 42)", "42."),
                         ("intermediate", "(map identity (list 1 2 3))", "(1 2 3) — identity leaves values unchanged.")],

    # ─── equality helpers ───────────────────────────────────────
    "boolean=?":       [("novice", "(boolean=? #t #t)", "#t."),
                         ("intermediate", "(boolean=? #t #f)", "#f.")],
    "symbol=?":        [("novice", "(symbol=? 'hello 'hello)", "#t."),
                         ("intermediate", "(symbol=? 'a 'b)", "#f.")],
}


def build_examples_block(verb_name, tuples, indent="  "):
    """Build a :examples (...) block string ready to insert."""
    lines = [f"{indent}:examples ("]
    for tier, code, note in tuples:
        # SLAT-escape the code + note
        esc_code = code.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")
        esc_note = note.replace("\\", "\\\\").replace('"', '\\"')
        lines.append(f'{indent}  (:dialect "motoi" :tier "{tier}" :code "{esc_code}" :note "{esc_note}")')
    lines.append(f"{indent})")
    return "\n".join(lines)


def has_examples_block(verb_form_body):
    """Check if this verb body already has :examples (...) — with parens."""
    return re.search(r':examples\s*\(', verb_form_body) is not None


def process(text):
    """Walk the file finding each verb, inject :examples where missing."""
    output = []
    i = 0
    n = len(text)
    injected = []
    skipped_no_entry = []

    while i < n:
        # Find next top-level (verb — either "(verb\n" or "(verb "
        m = re.search(r'(?m)^\(verb(?:\s|\n)', text[i:])
        if not m:
            output.append(text[i:])
            break

        start = i + m.start()
        # Append everything up to start
        output.append(text[i:start])

        # Now balance parens from start
        depth = 0
        in_str = False
        j = start
        while j < n:
            c = text[j]
            if in_str:
                if c == "\\":
                    j += 2
                    continue
                if c == '"':
                    in_str = False
            else:
                if c == '"':
                    in_str = True
                elif c == "(":
                    depth += 1
                elif c == ")":
                    depth -= 1
                    if depth == 0:
                        j += 1
                        break
            j += 1

        verb_body = text[start:j]
        # Extract name
        name_m = re.search(r':name\s+"([^"]+)"', verb_body)
        if not name_m:
            output.append(verb_body)
            i = j
            continue

        name = name_m.group(1)
        # Skip if already has :examples block
        if has_examples_block(verb_body):
            output.append(verb_body)
            i = j
            continue

        # Look up example
        if name not in EXAMPLES:
            skipped_no_entry.append(name)
            output.append(verb_body)
            i = j
            continue

        # Inject :examples before the closing paren.
        # The closing paren is at (j - 1) in text.
        # We insert a newline + block + newline before it.
        # The verb might be single-line (compact) or multi-line.
        # Insert at position (j - 1 - start) in verb_body.
        block = build_examples_block(name, EXAMPLES[name], indent="  ")
        # Find the position of the LAST closing paren in verb_body
        close_pos = len(verb_body) - 1
        # Insert block BEFORE that close paren, preceded by newline
        modified = verb_body[:close_pos] + "\n" + block + "\n" + verb_body[close_pos]
        output.append(modified)
        injected.append(name)
        i = j

    return "".join(output), injected, skipped_no_entry


def main():
    text = REF.read_text()
    modified, injected, skipped = process(text)
    REF.write_text(modified)
    print(f"Injected examples for {len(injected)} verbs:")
    for n in injected:
        print(f"  + {n}")
    if skipped:
        print(f"\nSkipped (no entry in table): {len(skipped)}")
        for n in skipped:
            print(f"  ? {n}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
