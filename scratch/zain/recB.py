# -*- coding: utf-8 -*-
import sys; sys.path.insert(0,'/Users/alfred/code/motoi-scheme/scratch/zain')
from emit import main
R={}

R['memv'] = dict(
 name='memv', std='R7RS-small', signature='(memv obj lst) -> sublist-or-#f',
 summary='The tail of lst beginning with the first element eqv? to obj, or #f when there is none.',
 explanation=(
  "The membership test that answers with EVIDENCE. Where a predicate would answer #t, memv answers the "
  "sublist starting at the match, so the caller learns not only that the element is there but where. A "
  "non-empty list is true in a conditional, so (if (memv x xs) ...) reads as a membership test and costs "
  "nothing extra. R7RS-small 6.4 puts memq, memv and member in the same relation as assq, assv and assoc: "
  "eq?, eqv?, equal?. memv is the middle one, the one whose promise covers NUMBERS and CHARACTERS. That is "
  "why you reach for it over memq the moment the list holds numbers. MOTOI'S memv IS NOT FULLY eqv?-BASED. "
  "It compares with JavaScript identity plus a by-name test for symbols and a by-value test for characters. "
  "Integers, flonums and characters behave as the standard requires. EXACT RATIONALS DO NOT: (memv 1/2 "
  "(list 1/3 1/2)) answers #f on a list that plainly contains 1/2, while (eqv? 1/2 1/2) answers #t and "
  "(member 1/2 (list 1/2)) finds it. It also matches STRINGS by content, which eqv? does not promise -- "
  "loose in one direction, strict in the other, from the same line of code. Two neighbouring jobs get "
  "mistaken for this one. To ask whether ANY element satisfies a test rather than equals a value, any is "
  "the verb. To find the POSITION rather than the tail, list-index says so."),
 examples=[
  ('novice',"(memv 3 '(1 2 3 4 5))",
   "(3 4 5) -- not #t. The answer is the tail beginning at the match, which is true in a conditional and also tells you where."),
  ('intermediate',"(list (memv 1/2 (list 1/3 1/2)) (memv 2 '(1 2 3)))",
   "(#f (2 3)) -- the integer is found and the exact rational is not, in one line. R7RS-small defines memv by eqv?, and (eqv? 1/2 1/2) is #t."),
  ('expert',
   "(display (list 'memq (memq 1/2 (list 1/2)) 'memv (memv 1/2 (list 1/2)) 'member (member 1/2 (list 1/2))))\n(newline)",
   "The three walks on one list: memq #f, memv #f, member (1/2). memv sits between the other two by definition and here it sides entirely with memq. member is the working escape hatch for rational keys."),
 ],
 caveats=[
  "memv answers a SUBLIST, not #t. Do not print it as a yes/no; convert with (if (memv x xs) #t #f) when a boolean is what you want.",
  "DIVERGENCE from R7RS-small 6.4: Motoi's memv does not implement eqv? for exact rationals. (memv 1/2 (list 1/3 1/2)) answers #f although (eqv? 1/2 1/2) answers #t. Use member for rational elements.",
  "It matches STRINGS by content, which eqv? does not promise. Code that relies on that is relying on a bug, not on the standard.",
  "A miss answers #f, so (car (memv x xs)) crashes on a miss. Test before you take it apart.",
  "memv walks from the front and stops at the FIRST match; later duplicates are invisible.",
 ],
 usecases=["Testing membership in a small list of numeric codes.",
           "Finding where a value first occurs and keeping everything from there on.",
           "Guarding a branch on a set of allowed characters or opcodes."],
 related=["memq","member","assv","any","list-index","list-tail"],
 concept="Membership that answers with the tail from the match, at the eqv? strength.",
 prereq=["list","eqv?"],
 progression="Learn memq for symbols, memv for numbers and characters, member for everything structural -- and in Motoi reach for member one step earlier than the standard requires.",
 status='needs-alfred',
 provenance=("R7RS-small 6.4; reference record added 2026-08-02, every example executed. FLAGGED: lib/base/"
  "r7rs-small.js:490 compares with strict JS identity plus symbol-name and char-value special cases rather "
  "than eqv?. Verified by execution 2026-08-02: (memv 1/2 (list 1/3 1/2)) -> #f, (eqv? 1/2 1/2) -> #t, "
  "(member 1/2 (list 1/2)) -> (1/2). Strings match by content, which eqv? does not promise."),
 row2=dict(
  eng="(define allowed (list 1 2 3 5 8))\n(define (permitted? code) (if (memv code allowed) #t #f))\n(display (map permitted? (list 2 4 8)))\n(newline)",
  math="(display (list 'memq (memq 1/2 (list 1/2)) 'memv (memv 1/2 (list 1/2)) 'member (member 1/2 (list 1/2)) 'eqv-says (eqv? 1/2 1/2)))\n(newline)",
  cs="(display (list 'sym (memv 'c '(a b c d)) 'chr (memv #\\c (list #\\a #\\c)) 'str (memv \"b\" (list \"a\" \"b\")) 'flo (memv 2.0 (list 1.0 2.0)) 'miss (memv 9 '(1 2))))\n(newline)",
  problem=("The operator has a short whitelist of numeric opcodes and must decide whether an incoming code is "
   "on it. Candidates: memv (the standard verb for numeric elements, answering the tail), memq (identity only "
   "-- correct for small integers by accident, not by promise), member (structural equality, always correct), "
   "or a hash set (overkill at five elements). For a numeric whitelist memv is the verb the standard names, "
   "and wrapping it in an if to get a real boolean is one line."),
  explanation=("eng: a whitelist test that returns a genuine #t or #f rather than a sublist. math: the three "
   "walks and eqv? printed side by side, which is the differential test. cs: the element-type sweep -- "
   "symbols, characters, strings, flonums and a miss -- so the reader sees which types are safe."),
  meta=("Why the if-wrapper: a sublist is more information than a caller asked for, and more information "
   "leaking into a boolean position is how (length (memv ...)) gets written by mistake."),
  l_eng="Convert an evidence-returning verb to a boolean at the boundary, once, in a named predicate.",
  l_math="eq? refines eqv? refines equal?; the three walks should give a nested chain of results, and any collapse in that chain is a defect.",
  l_cs="Sweep the element types when you document a comparison verb. The type where it breaks is never the one in the example."),
 row3=dict(
  setup="Scan a sequence from the front, stop at the first item that matches, and hand back everything from that point on.",
  rungs=[("list","(memv 3 '(1 2 3 4 5))"),
         ("finding your stop on a printed list of stations and reading off the rest of the route",
          "(define route (list 1 2 3 4 5 6))\n(define (rest-of-journey from) (memv from route))\n(display (list 'from-4 (rest-of-journey 4) 'from-9 (rest-of-journey 9)))\n(newline)"),
         ("the suffix of a sequence beginning at the first index where a(i) equals x",
          "(define seq (list 5 8 13 21 34))\n(display (list 'suffix (memv 13 seq) 'length-from (length (memv 13 seq)) 'absent (memv 7 seq)))\n(newline)")],
  explanation=("In list, memv returns the tail from the match. Reading a printed list of stations, finding "
   "your stop gives you the remaining journey for free -- the finger that stopped is also the finger that "
   "points at the rest. In mathematics it is the suffix of a sequence from the first index where a(i) = x. "
   "All three share: a forward scan, a first match, and an answer that carries position rather than merely "
   "reporting presence."),
  meta=("The metaphor is exact about the thing that matters: you cannot find your stop without also being "
   "told what comes after it. Answering #t would be throwing away information the scan already had."),
  l_eng="Return the most informative cheap answer. A caller can always narrow it; it cannot widen a #t.",
  l_math="A membership test and a suffix selector are the same computation read with different eyes.",
  l_cs="Related patterns: str.find returning an index in Python, indexOf in JS, and Rust's iter().position() -- all pay for the scan and then keep the position."),
 row4=dict(
  eng="(define xs (list 1 2 3 4))\n(display (list 'tail (memv 3 xs) 'is-suffix (equal? (memv 3 xs) (list-tail xs 2)) 'miss (memv 9 xs)))\n(newline)",
  math="(define (memv-agrees-with-eqv? x xs)\n  (equal? (memv x xs)\n          (let loop ((ys xs)) (cond ((null? ys) #f) ((eqv? (car ys) x) ys) (else (loop (cdr ys)))))))\n(display (list 'ints (memv-agrees-with-eqv? 3 (list 1 2 3))\n               'chars (memv-agrees-with-eqv? #\\b (list #\\a #\\b))\n               'rationals (memv-agrees-with-eqv? 1/2 (list 1/3 1/2))))\n(newline)",
  cs="(display (list 'memv-equals-memq (equal? (memv 1/2 (list 1/2)) (memq 1/2 (list 1/2)))\n               'member-finds-it (member 1/2 (list 1/2))\n               'eqv-says (eqv? 1/2 1/2)))\n(newline)",
  claim=("R7RS-small 6.4 says memv finds an element exactly when eqv? holds. Against a hand-written eqv? walk "
   "Motoi agrees on integers and characters and DISAGREES on exact rationals, where it returns #f and the "
   "eqv? walk returns the suffix. On the failing case memv is equal? to memq."),
  invariant="R7RS requires: for all x, xs. memv(x, xs) = the first suffix of xs whose head is eqv? to x, else #f. Motoi satisfies this for integers, flonums, characters and symbols, and VIOLATES it for exact rationals",
  meta=("The pattern is a verb specified by reference to a predicate, tested against a hand-written walk over "
   "that predicate. What would falsify the positive half: an integer or character case where the two "
   "disagreed. The third program is the evidence for the :status flag."),
  l_eng="A four-line reference implementation is cheap insurance for any verb the spec defines by reference to another.",
  l_math="Suffix selection composes with list-tail: memv gives the suffix, list-index would give the index, and each determines the other.",
  l_cs="A comparison verb should be tested across the whole type lattice it claims to cover, not on the type the author had in mind."),
 row5=dict(
  eng="(define vowels (list #\\a #\\e #\\i #\\o #\\u))\n(define (vowel? c) (if (memv c vowels) #t #f))\n(display (map vowel? (list #\\a #\\z #\\o)))\n(newline)",
  math="(define (dedupe xs)\n  (cond ((null? xs) '())\n        ((memv (car xs) (cdr xs)) (dedupe (cdr xs)))\n        (else (cons (car xs) (dedupe (cdr xs))))))\n(display (dedupe (list 1 2 1 3 2 4)))\n(newline)",
  cs="(define (safe-member x xs) (if (member x xs) #t #f))\n(display (list 'memv-on-rational (if (memv 1/2 (list 1/2)) 'found 'MISSED)\n               'member-on-rational (safe-member 1/2 (list 1/2))))\n(newline)",
  base="memv answers the tail of a list from the first eqv? match, or #f.",
  emergent=("eng: a character-class predicate built from a five-element table -- the table is data, so the "
   "class can be printed and changed. math: last-occurrence deduplication, where memv over the REMAINING "
   "tail decides whether this occurrence is the last one, which keeps the final copy of each value. cs: the "
   "same membership question routed through member, which is what the :status flag forces for rational "
   "elements."),
  emergent_name="the membership table",
  meta=("The composition is memv plus a table plus a boolean conversion. What emerges is the membership-table "
   "family: character classes, whitelists, keyword sets and deduplication are one verb and one list apart. "
   "Note that dedupe's choice to test the TAIL rather than the accumulated head is what makes it keep the "
   "last occurrence -- testing the head would keep the first."),
  l_eng="A predicate backed by a visible table can be audited; a predicate backed by a cond cannot be printed.",
  l_math="Deduplication is a quotient by an equivalence relation, and which representative survives is a choice, not an accident.",
  l_cs="Quadratic deduplication is the right answer up to a few hundred elements and the wrong answer after; know which side of that line you are on."),
)

for k in list(R):
    for row in ('row2','row3','row4','row5'):
        d=R[k][row]
        for a,b in (('l_eng','l-eng'),('l_math','l-math'),('l_cs','l-cs'),('emergent_name','emergent-name')):
            if a in d: d[b]=d.pop(a)

if __name__=='__main__': main(R, sys.argv[1:])
