# -*- coding: utf-8 -*-
import sys; sys.path.insert(0,'/Users/alfred/code/motoi-scheme/scratch/zain')
from emit import main

R = {}

R['assv'] = dict(
 name='assv', std='R7RS-small', signature='(assv obj alist) -> entry-or-#f',
 summary='The first entry of an association list whose key is eqv? to obj, or #f when no entry matches.',
 explanation=(
  "The middle member of the assq / assv / assoc trio. All three walk an association list and hand back the "
  "whole matching ENTRY, not the value inside it -- pulling the value out is a second step, usually cdr or "
  "cadr depending on how the entry was built. What separates the three is the comparison. R7RS-small 6.4 says "
  "assq compares with eq?, assv with eqv?, and assoc with equal? (or a predicate you supply). eqv? is the "
  "middle strength: it is eq? plus a promise about NUMBERS and CHARACTERS, so assv is the one you reach for "
  "when the keys are numeric. Motoi accepts both entry shapes -- a proper list (k v) and a real dotted pair "
  "built by cons -- and answers whichever it found, so the caller must know which shape the table was built "
  "in. MOTOI'S assv IS NOT eqv?-BASED. It is the same comparison as assq: identity, plus a by-name test for "
  "symbols and a by-value test for characters. On small integers and flonums that is indistinguishable from "
  "eqv?, which is why the defect hides. On an EXACT RATIONAL it is not: (assv 1/2 table) answers #f on a "
  "table that contains 1/2, while (eqv? 1/2 1/2) answers #t. Use assoc when the keys are rationals, and read "
  "the caveats. Two neighbouring jobs get mistaken for this one. To ask whether a key is PRESENT rather than "
  "to fetch its entry, memv over the keys says so more directly. To look up by a key that is a list or a "
  "string, assoc is the verb the standard intends."),
 examples=[
  ('novice', "(assv 2 '((1 red) (2 green) (3 blue)))",
   "(2 green) -- the whole entry, key and all. Getting at green is a second step."),
  ('intermediate', "(list (assv 1/2 (list (list 1/2 'half))) (eqv? 1/2 1/2))",
   "(#f #t) -- the defect in one line. eqv? says the two halves are the same object-for-comparison, and assv, "
   "which R7RS-small defines IN TERMS OF eqv?, still misses."),
  ('expert',
   "(define t (list (list 1/2 'half) (list 2 'two)))\n"
   "(display (list 'assq (assq 1/2 t) 'assv (assv 1/2 t) 'assoc (assoc 1/2 t) 'eqv-says (eqv? 1/2 1/2)))\n(newline)",
   "The three lookups side by side on one table: assq #f, assv #f, assoc (1/2 half), and eqv? #t. assv "
   "should have matched wherever eqv? does. It behaves as assq. assoc is the working escape hatch."),
 ],
 caveats=[
  "assv returns the ENTRY, not the value. Pull the value out with cdr (dotted entries) or cadr (list entries).",
  "DIVERGENCE from R7RS-small 6.4: Motoi's assv is implemented identically to assq, not in terms of eqv?. "
  "(assv 1/2 (list (list 1/2 'half))) answers #f although (eqv? 1/2 1/2) answers #t. Exact rationals are the "
  "case that breaks; use assoc for those.",
  "It also matches STRING keys by value, which eqv? does not promise -- a second, opposite-direction "
  "divergence from the same implementation.",
  "A missing key answers #f, and #f is also a perfectly good value to store, so (cadr (assv k t)) crashes on "
  "a miss. Test the entry before you take it apart.",
  "Entries may be (k v) lists or (k . v) dotted pairs; assv finds both, and hands back what it found.",
 ],
 usecases=["Looking up a numeric code in a small table.",
           "Palette and opcode tables keyed by small integers.",
           "Any table small enough that a linear walk beats a hash table."],
 related=["assq","assoc","memv","memq","list","cdr"],
 concept="Association-list lookup at the eqv? strength: identity plus a promise about numbers and characters.",
 prereq=["list","eqv?"],
 progression="Learn assq for symbol keys, then assv for numeric keys, then assoc when the key is a list or a string -- and in Motoi today, reach for assoc one step earlier than the standard says you must.",
 status='needs-alfred',
 provenance=("R7RS-small 6.4; reference record added 2026-08-02, every example executed. FLAGGED: lib/base/"
  "r7rs-small.js:505 defines assv with the SAME comparison body as assq (=== plus symbol-name plus char-value) "
  "rather than eqv?. Verified by execution 2026-08-02: (assv 1/2 (list (list 1/2 'half))) -> #f while "
  "(eqv? 1/2 1/2) -> #t and (assoc 1/2 ...) -> (1/2 half)."),
 row2=dict(
  eng="(define palette (list (list 1 'red) (list 2 'green) (list 3 'blue)))\n(display (list 'found (assv 2 palette) 'missing (assv 9 palette)))\n(newline)",
  math="(define t (list (list 1/2 'half) (list 2 'two)))\n(display (list 'assq (assq 1/2 t) 'assv (assv 1/2 t) 'assoc (assoc 1/2 t) 'eqv-says (eqv? 1/2 1/2)))\n(newline)",
  cs="(define listy (list (list 'a 1) (list 'b 2)))\n(define dotty (list (cons 'a 1) (cons 'b 2)))\n(display (list 'list-shape (assv 'b listy) 'dotted-shape (assv 'b dotty) 'miss (assv 'z listy)))\n(newline)",
  problem=("The operator has a small table keyed by integers -- a palette index to a colour name -- and needs "
   "the entry for one index. Candidates: assv (the standard verb for numeric keys, comparing at eqv? strength), "
   "assq (identity only, which happens to work for small integers in every implementation but is not promised), "
   "assoc (structural equality, always correct and slightly slower), or a hash table (right at a size this "
   "table is not). For integer keys assv is the verb the standard names -- but in Motoi today assv IS assq, so "
   "for any key that is not a small integer, a symbol or a character, assoc is the honest choice."),
  explanation=("eng: palette lookup with the miss handled as #f, not as an error. math: the three comparisons "
   "run against one table, with eqv? printed beside them as the reference answer. cs: both entry shapes probed, "
   "because assv reports whichever shape it found and downstream code has to match."),
  meta=("Why the miss is #f and not an error: a lookup that fails is an ordinary outcome and deserves a value, "
   "not an exception path. Why assoc and not assv here: the row shows exactly when that swap becomes necessary."),
  l_eng="A linear lookup over a table of ten entries beats a hash table on every axis that matters at that size, including readability.",
  l_math="eqv? is an equivalence relation strictly between eq? and equal?; assq, assv and assoc are the same walk under those three relations.",
  l_cs="When a library verb is documented by reference to another verb, test it AGAINST that verb. One equal? between assv and a hand-rolled eqv? walk would have caught this."),
 row3=dict(
  setup="Find the first record in a small table whose label matches, and hand back the whole record rather than the part you wanted.",
  rungs=[("list","(assv 2 '((1 red) (2 green) (3 blue)))"),
         ("looking up a seat number on a paper seating chart",
          "(define chart (list (list 12 'window) (list 13 'aisle) (list 14 'middle)))\n(display (list 'seat-13 (assv 13 chart) 'seat-99 (assv 99 chart)))\n(newline)"),
         ("a partial function given by an explicit finite table of (input output) pairs",
          "(define f (list (list 0 1) (list 1 1) (list 2 2) (list 3 6)))\n(define (apply-f n) (let ((e (assv n f))) (if e (cadr e) 'undefined)))\n(display (map apply-f (list 0 3 7)))\n(newline)")],
  explanation=("In list, assv walks a table and returns the matching entry. On a paper seating chart you run "
   "your finger down the numbers and stop at the row -- and what you have then is the ROW, not the seat type. "
   "In mathematics a finite table of (input output) pairs IS a partial function, and a lookup that misses is "
   "the argument being outside the domain. All three share: a linear scan, a match on one field, a whole record "
   "returned, and an explicit answer for the miss."),
  meta=("The partial-function reading is the useful one: #f is not a failure, it is the statement that the "
   "argument is not in the domain. Code that treats a miss as an exception has misread the table."),
  l_eng="Return the record and let the caller take the field. A lookup that also projects makes two decisions where one was asked for.",
  l_math="A finite table of pairs is a partial function; the miss result is the boundary of its domain, and deserves a name.",
  l_cs="Related patterns: dict.get(k, default) in Python, Map.get returning undefined in JS, Maybe/Option in Haskell and Rust -- all the same choice about how to spell absence."),
 row4=dict(
  eng="(define t (list (list 1 'a) (list 2 'b) (list 3 'c)))\n(display (list 'entry (assv 2 t) 'is-member (if (assv 2 t) #t #f) 'miss (assv 9 t)))\n(newline)",
  math="(define (assv-agrees-with-eqv? k t)\n  (let ((found (assv k t))\n        (hand (let loop ((xs t)) (cond ((null? xs) #f) ((eqv? (caar xs) k) (car xs)) (else (loop (cdr xs)))))))\n    (equal? found hand)))\n(display (list 'ints (assv-agrees-with-eqv? 2 (list (list 1 'a) (list 2 'b)))\n               'rationals (assv-agrees-with-eqv? 1/2 (list (list 1/2 'half)))))\n(newline)",
  cs="(define t (list (list 1/2 'half)))\n(display (list 'assq (assq 1/2 t) 'assv (assv 1/2 t) 'assoc (assoc 1/2 t)\n               'assv-equals-assq (equal? (assv 1/2 t) (assq 1/2 t))))\n(newline)",
  claim=("R7RS-small 6.4 says assv finds an entry exactly when eqv? holds on its key. In Motoi that agreement "
   "holds for integers and fails for exact rationals: a hand-written eqv? walk finds the 1/2 entry and assv "
   "does not. assv is instead equal to assq on every input tested."),
  invariant="R7RS requires: for all k, alist. assv(k, alist) = the first entry e with eqv?(car(e), k). Motoi satisfies this for integers, symbols, characters and flonums, and VIOLATES it for exact rationals",
  meta=("The pattern is a verb specified by reference to another verb, tested against that verb. What would "
   "falsify the positive half: an integer key where the hand-written eqv? walk and assv disagreed. The third "
   "program is the evidence for the :status flag -- assv and assq return equal? results on a case where the "
   "standard requires them to differ."),
  l_eng="When a spec defines one verb in terms of another, the differential test writes itself and costs four lines.",
  l_math="eq? implies eqv? implies equal?; a chain of coarsening equivalences means assq's results are a subset of assv's, which are a subset of assoc's. Motoi collapses the first two.",
  l_cs="A defect that is invisible on the common input and visible on the rare one is the expensive kind. Probe the rare input on purpose."),
 row5=dict(
  eng="(define opcodes (list (list 0 'nop) (list 1 'load) (list 2 'store) (list 3 'halt)))\n(define (decode n)\n  (let ((e (assv n opcodes)))\n    (if e (cadr e) 'illegal)))\n(display (map decode (list 0 2 3 9)))\n(newline)",
  math="(define (table->function t fallback)\n  (lambda (k) (let ((e (assv k t))) (if e (cadr e) fallback))))\n(define fib (table->function (list (list 0 0) (list 1 1) (list 2 1) (list 3 2) (list 4 3)) 'out-of-table))\n(display (map fib (list 0 4 9)))\n(newline)",
  cs="(define (safe-lookup k t)\n  (let ((e (assoc k t)))\n    (if e (cadr e) 'absent)))\n(define t (list (list 1/2 'half) (list 2 'two)))\n(display (list 'assv-path (if (assv 1/2 t) 'found 'MISSED) 'assoc-path (safe-lookup 1/2 t)))\n(newline)",
  base="assv finds the first entry whose key matches, and answers #f on a miss.",
  emergent=("eng: an opcode decoder -- the table is the specification, and 'illegal is the named answer for "
   "everything outside it. math: a finite table turned into a FUNCTION by closing over it, with the fallback "
   "supplied at construction time rather than at every call site. cs: the same lookup routed through assoc, "
   "which is what you must do today for any key that is not an integer, a symbol or a character."),
  emergent_name="the table-as-function",
  meta=("The composition is assv plus a miss branch plus a closure. What emerges is the table-as-function "
   "family: a lookup table, a default, and a name -- which is how opcode decoders, palettes, dispatch tables "
   "and memo caches are all spelled. The cs lane is the workaround the :status flag makes necessary."),
  l_eng="Bind the fallback once at construction; a default repeated at every call site is a default waiting to drift.",
  l_math="Closing a finite table into a total function is exactly extending a partial function by a constant on the complement of its domain.",
  l_cs="A dispatch table is data, and data can be printed, diffed and tested. That is the whole argument for it over a cond."),
)

for k in list(R):
    for row in ('row2','row3','row4','row5'):
        d = R[k][row]
        for a,b in (('l_eng','l-eng'),('l_math','l-math'),('l_cs','l-cs'),('emergent_name','emergent-name')):
            if a in d: d[b]=d.pop(a)
        if 'rungs' in d: pass

if __name__ == '__main__':
    main(R, sys.argv[1:])
