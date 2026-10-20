# -*- coding: utf-8 -*-
"""zip, range. Every :code and row program executed before its note was
written; transcripts in gM.scm and the iota comparison run."""
import sys; sys.path.insert(0,'/Users/alfred/code/motoi-scheme/scratch/zain')
from emit import main
R={}

R['zip'] = dict(
 name='zip', std='SRFI-1', tier='core', kind='pure',
 signature='(zip list1 list2) -> list',
 summary='Pair up two lists element by element, stopping at the shorter. SRFI-1 zip is VARIADIC; Motoi accepts exactly two lists and silently discards any others.',
 explanation=(
  "zip walks two lists in step and builds a list of small lists, one per position: (zip '(1 2) '(a b)) is "
  "((1 a) (2 b)). It is how you turn parallel data into paired data, which is what you need before you can "
  "map over it, sort it by one component, or hand it to assoc. SRFI-1 defines zip over ANY number of lists -- "
  "(zip clist1 clist2 ...) -- and defines it exactly as (map list clist1 clist2 ...). Motoi's takes exactly "
  "two, and that difference is not reported: a third list is accepted by the reader and DISCARDED at run "
  "time, so (zip '(1 2) '(a b) '(x y)) answers ((1 a) (2 b)) where SRFI-1 answers ((1 a x) (2 b y)). One list "
  "is worse still -- SRFI-1's (zip '(1 2)) is ((1) (2)), and Motoi's is '(). Both wrong answers look like "
  "plausible right answers, and neither raises. The fix is already in this chapter and is exactly what SRFI-1 "
  "says zip means: use (map list ...), which IS variadic here, verified at one, two and three lists. Use zip "
  "only for the two-list case, and read the caveats before you add a third. Two neighbouring jobs get "
  "mistaken for this one. To take a zipped list apart again, map first and last over it. To pair a list with "
  "its positions, zip it with (range 0 (length xs))."),
 examples=[
  ('novice',
   "(zip (list 1 2 3) (list 'a 'b 'c))",
   "((1 a) (2 b) (3 c)) -- one two-element list per position. The pairs are LISTS, not dotted pairs, so first and last read them."),
  ('intermediate',
   "(define (enumerate xs) (zip (range 0 (length xs)) xs))\n(display (enumerate (list 'a 'b 'c)))\n(newline)",
   "Prints ((0 a) (1 b) (2 c)). Pairing a list with its own indices is the commonest use of zip and the reason range sits next to it in this chapter."),
  ('expert',
   "(display (list 'two (zip (list 1 2) (list 'a 'b))\n               'three (zip (list 1 2) (list 'a 'b) (list 'x 'y))\n               'one (zip (list 1 2))\n               'map-list-three (map list (list 1 2) (list 'a 'b) (list 'x 'y))))\n(newline)",
   "Prints (two ((1 a) (2 b)) three ((1 a) (2 b)) one () map-list-three ((1 a x) (2 b y))). The third list was SILENTLY DISCARDED and the one-list case answered empty. SRFI-1 would give ((1 a x) (2 b y)) and ((1) (2)). map list is variadic here and is the correct replacement."),
 ],
 caveats=[
  "DIVERGENCE from SRFI-1: zip is VARIADIC in SRFI-1 and BINARY here. A third or later list is silently DISCARDED -- (zip '(1 2) '(a b) '(x y)) answers ((1 a) (2 b)) instead of ((1 a x) (2 b y)), with no error. Use (map list ...) for three or more.",
  "DIVERGENCE from SRFI-1: the one-list case answers '() rather than ((1) (2)). SRFI-1 defines (zip lis) as (map list lis).",
  "DIVERGENCE: a non-list argument answers '() rather than raising. (zip 5 '(1 2)) is ().",
  "It stops at the SHORTER list, which is SRFI-1 behaviour and is correct -- but it also means a length mismatch is silent. Compare lengths first if they are meant to agree.",
  "The elements of the result are two-element LISTS, not dotted pairs. Read them with first and last, or with car and cadr; (cdr p) gives a one-element list, not the second value.",
  "For the two-list case (zip a b) and (map list a b) agree exactly, verified. Prefer map list when the arity might change, because it will not silently drop an argument.",
 ],
 usecases=["Pairing a list with its own indices before mapping.",
           "Building an association list from parallel key and value lists.",
           "Combining parallel measurement series before a per-position computation."],
 related=["map","range","first","last","assoc","unzip"],
 status='needs-alfred',
 concept="Turning parallel sequences into a sequence of tuples, and what a silently dropped argument costs.",
 prereq=["list","map","length"],
 progression="Learn map over one list, then map over two, then zip as the name for the paired case -- and learn (map list ...) immediately after, because it is what zip is defined to be and it does not drop arguments.",
 provenance=("SRFI-1 (zip); reference record added 2026-08-02, every example executed. Implementation "
  "src/base.js:663, a two-parameter arrow (a, b) => ... FLAGGED, three divergences verified 2026-08-02: "
  "(1) SRFI-1's zip is VARIADIC and defined as (map list clist1 clist2 ...); Motoi's takes exactly two lists "
  "and SILENTLY DISCARDS any beyond the second -- (zip '(1 2) '(a b) '(x y)) answers ((1 a) (2 b)) where "
  "SRFI-1 answers ((1 a x) (2 b y)); (2) the one-list case answers '() where SRFI-1 answers ((1) (2)); "
  "(3) a non-list argument answers '() rather than raising. Motoi's own map IS correctly variadic, so "
  "(map list ...) is a conforming replacement and was verified at one, two and three lists."),
 row2=dict(
  eng="(define names (list 'ada 'brue 'cyd))\n(define scores (list 9 7 8))\n(display (zip names scores))\n(newline)",
  math="(define (dot a b) (apply + (map (lambda (p) (* (first p) (last p))) (zip a b))))\n(display (dot (list 1 2 3) (list 4 5 6)))\n(newline)",
  cs="(display (list 'two (zip (list 1 2) (list 'a 'b))\n               'three (zip (list 1 2) (list 'a 'b) (list 'x 'y))\n               'one (zip (list 1 2))\n               'ragged (zip (list 1 2 3) (list 'a 'b))\n               'non-list (zip 5 (list 1 2))\n               'map-list-three (map list (list 1 2) (list 'a 'b) (list 'x 'y))))\n(newline)",
  problem=("The operator has three parallel series -- timestamps, readings and flags -- and needs them combined "
   "per position. Candidates: zip (reads best, and here it will silently return only the first two series), "
   "(map list ts rs fs) (SRFI-1's own definition of zip, variadic, and correct at any arity), and two nested "
   "zips (correct but produces nested pairs that then need flattening). With three series there is exactly one "
   "right answer here and it is map list; zip would have produced a plausible, shorter, wrong result."),
  explanation=("eng: the ordinary two-list case, which is the only case this implementation handles. math: a "
   "dot product built from zip, the smallest program that shows why pairing has to happen before the "
   "arithmetic. cs: six cases in one row -- two lists, three lists, one list, ragged lists, a non-list, and "
   "map list doing the three-list job correctly. Three of those six answer something SRFI-1 does not."),
  meta=("Why map list appears in zip's own cs row: SRFI-1 defines zip AS map list, so putting them side by "
   "side is not a comparison of alternatives, it is showing the definition next to the thing that fails to "
   "meet it."),
  l_eng="An argument silently dropped is worse than an argument rejected. If arity might grow, use the variadic verb from the start.",
  l_math="Zipping is the transpose of a list of equal-length lists; recognising that tells you immediately what the ragged and empty cases should do.",
  l_cs="When a standard defines one verb in terms of another, test the definition. Here it holds at two lists and fails at one and at three."),
 row3=dict(
  setup="Bring two parallel ordered collections together so that corresponding items travel as one.",
  rungs=[("list","(display (zip (list 1 2) (list 'a 'b)))\n(newline)"),
         ("stapling a receipt to each item on a picking list",
          "(define items (list 'bolt 'nut))\n(define receipts (list 'r1 'r2))\n(display (zip items receipts))\n(newline)"),
         ("forming the graph of a function from its domain and its values",
          "(define xs (list 1 2 3))\n(define ys (list 1 4 9))\n(display (zip xs ys))\n(newline)")],
  explanation=("In list, zip walks two lists in step. Stapling a receipt to each item on a picking list is the "
   "same act: two stacks in the same order, joined so that neither can be reordered without the other. In "
   "mathematics it is forming the graph of a function from its domain and its values -- the set of pairs that "
   "IS the function. All three share: a shared ordering that carries the correspondence, and a result in which "
   "the correspondence has become structural instead of positional."),
  meta=("The picking list is honest about the failure too. If the receipts run out first you get a short "
   "stapled pile and no complaint, which is exactly what zip does when the lists are ragged."),
  l_eng="Two parallel lists are a correspondence held together by nothing but discipline. Zip them early and the discipline becomes a data structure.",
  l_math="A function IS its graph; zip is the constructor that turns a domain and a value list into one.",
  l_cs="Related patterns: zip in Python (variadic, stops short), zip in Haskell (binary, with zip3 and zipWith named separately), and SRFI-1's variadic zip. Motoi's name is SRFI-1's and its arity is Haskell's."),
 row4=dict(
  eng="(display (list 'zip=map-list (equal? (zip (list 1 2) (list 'a 'b)) (map list (list 1 2) (list 'a 'b)))))\n(newline)",
  math="(display (list 'lengths (map (lambda (p) (length (zip (first p) (last p))))\n                              (list (list (list 1 2 3) (list 'a 'b))\n                                    (list (list 1) (list 'a 'b 'c))\n                                    (list '() (list 'a))))))\n(newline)",
  cs="(display (list 'srfi1-def-holds-at-2 (equal? (zip (list 1 2) (list 'a 'b)) (map list (list 1 2) (list 'a 'b)))\n               'fails-at-3 (equal? (zip (list 1 2) (list 'a 'b) (list 'x 'y)) (map list (list 1 2) (list 'a 'b) (list 'x 'y)))\n               'fails-at-1 (equal? (zip (list 1 2)) (map list (list 1 2)))))\n(newline)",
  claim=("SRFI-1 defines zip as (map list clist1 clist2 ...). That definition HOLDS in Motoi at exactly two "
   "lists and FAILS at one and at three. Where it holds, the length of the result is the minimum of the input "
   "lengths, so a ragged pair produces the shorter answer with no complaint."),
  invariant="For all lists a, b. zip(a,b) = map(list, a, b) and length(zip(a,b)) = min(length(a), length(b)). For any other arity the SRFI-1 identity zip(l1..ln) = map(list, l1..ln) does NOT hold",
  meta=("The pattern is a standard's own defining equation used as the test oracle, evaluated at three "
   "arities. What would falsify the positive half: any two-list input where zip and map list disagree. The cs "
   "program is the evidence for the :status flag -- one predicate, three arities, and two #f answers that "
   "should both have been #t."),
  l_eng="When a spec defines one verb in terms of another, that equation is a free test. Write it down and run it at every arity the spec allows.",
  l_math="min-length is the right rule for ragged inputs because the pairing is only defined where both are; anything else invents data.",
  l_cs="An implementation that satisfies a defining equation on the common case and violates it elsewhere will pass every test somebody thought to write."),
 row5=dict(
  eng="(define (alist ks vs) (zip ks vs))\n(define a (alist (list 'a 'b) (list 1 2)))\n(display (list 'alist a 'lookup (assoc 'b a)))\n(newline)",
  math="(define (enumerate xs) (zip (range 0 (length xs)) xs))\n(display (enumerate (list 'p 'q 'r)))\n(newline)",
  cs="(define (unzip pairs) (list (map first pairs) (map last pairs)))\n(display (unzip (zip (list 1 2 3) (list 'a 'b 'c))))\n(newline)",
  base="zip pairs two lists element by element.",
  emergent=("eng: an association list built from parallel keys and values, which assoc then searches -- zip is "
   "the constructor for the oldest lookup structure in Lisp. math: enumerate, zip with range, which is how a "
   "list acquires its own indices as data. cs: unzip, the inverse, built from map with first and last -- and "
   "the round trip proves the pairing lost nothing."),
  emergent_name="the index-carrying list",
  meta=("The composition is zip with range, or zip with its inverse. What emerges is the tuple family: "
   "association lists, enumerated sequences, sorting by a computed key, and every join. The cs lane matters "
   "because unzip is not defined here -- it is two maps -- and knowing an operation is invertible tells you "
   "the pairing was lossless."),
  l_eng="Attach the index to the data rather than tracking it alongside. A separate counter is a second thing that can be wrong.",
  l_math="An invertible transformation loses no information; showing the inverse is the shortest proof that a representation change was safe.",
  l_cs="Sort-by-key is zip, sort, unzip. Recognising that saves writing a comparator and makes the key explicit."),
)

R['range'] = dict(
 name='range', std='Motoi-own', tier='core', kind='pure',
 signature='(range start end) -> list',
 summary='The integers from start up to but NOT including end. Motoi-own; SRFI-1 iota is the standard verb, and it also takes a step, which range silently ignores.',
 explanation=(
  "range builds the half-open integer interval: (range 0 5) is (0 1 2 3 4), five elements, starting at start "
  "and stopping BEFORE end. Half-open is the right convention and worth understanding rather than memorising: "
  "the length is exactly end minus start, adjacent ranges join without overlap or gap, and (range 0 (length "
  "xs)) is precisely the set of valid indices into xs. That last identity is why this verb exists. It is "
  "Motoi-own. R7RS-small has no such verb, and SRFI-1's spelling is iota, which is present and working in "
  "this same chapter: (iota 5) is (0 1 2 3 4), (iota 5 1) starts from 1, and (iota 5 0 2) steps by 2. iota "
  "takes a COUNT, a start and a step; range takes a start and an end and no step at all. The conformance "
  "ladder says prefer iota. There are three sharp edges, all verified and none of which raises. A third "
  "argument is accepted by the reader and SILENTLY IGNORED, so (range 0 5 2) is (0 1 2 3 4) and not (0 2 4) "
  "-- if you want a step you must use iota. A single argument answers '() rather than counting from zero, "
  "which is what a reader who knows Python would expect. And a backwards range answers '() rather than "
  "counting down. Two neighbouring jobs get mistaken for this one. For a count, a start and a step use iota. "
  "To pair a list with its indices use (zip (range 0 (length xs)) xs)."),
 examples=[
  ('novice',
   "(range 0 5)",
   "(0 1 2 3 4) -- five numbers. The end is NOT included, so the length is exactly end minus start."),
  ('intermediate',
   "(display (map (lambda (i) (* i i)) (range 1 6)))\n(newline)",
   "Prints (1 4 9 16 25). range supplies the counter and map supplies the body; between them they replace the whole of a for loop."),
  ('expert',
   "(display (list 'two-arg (range 0 5) 'three-arg (range 0 5 2) 'one-arg (range 5)\n               'backwards (range 3 1) 'iota-with-step (iota 5 0 2)))\n(newline)",
   "Prints (two-arg (0 1 2 3 4) three-arg (0 1 2 3 4) one-arg () backwards () iota-with-step (0 2 4 6 8)). The third argument was SILENTLY IGNORED -- a step of 2 changed nothing. The one-argument form answers empty rather than counting from zero. iota is the verb that actually takes a step."),
 ],
 caveats=[
  "HAZARD: a third argument is accepted and SILENTLY IGNORED. (range 0 5 2) is (0 1 2 3 4), not (0 2 4). There is no step. Use (iota count start step) when you need one.",
  "HAZARD: the one-argument form (range 5) answers '() rather than (0 1 2 3 4). Readers coming from Python expect the count-from-zero reading; range does not have it. iota does: (iota 5) is (0 1 2 3 4).",
  "A backwards range answers '() rather than counting down. (range 3 1) is (). There is no descending form; use (reverse (range 1 3)).",
  "It is Motoi-own. R7RS-small has no range, and SRFI-1's spelling is iota, which is present here and takes a count, a start and a step. Prefer iota in new code.",
  "The end is EXCLUDED. (range 0 5) stops at 4. That is deliberate: length equals end minus start, adjacent ranges tile without overlap, and (range 0 (length xs)) is exactly the valid indices of xs.",
  "Non-integer bounds are accepted and step by 1: (range 0 3.5) is (0 1 2 3) and (range 0.5 3) is (0.5 1.5 2.5). A non-numeric start is not rejected either -- (range 'a 'b) answers (a), which is nonsense produced silently.",
 ],
 usecases=["Generating the valid indices of a list for enumerate or for a positional map.",
           "Replacing a counting for loop with map or filter over an explicit list of counters.",
           "Building coordinate grids by nesting one range inside another."],
 related=["iota","zip","map","filter","length","list-ref"],
 status='needs-alfred',
 concept="The half-open integer interval as an explicit list, and why exclusive ends compose.",
 prereq=["list","map","length"],
 progression="Learn range as the counter for map, then the half-open convention and why it makes indices line up, then iota -- which is the standard name and the one that takes a step.",
 provenance=("Motoi-own. NOT in R7RS-small; SRFI-1's equivalent is iota, which is bound and working here and "
  "takes a count, a start and a step. Reference record added 2026-08-02, every example executed. "
  "Implementation src/base.js:352, a two-parameter arrow with a unit-step for loop. FLAGGED, verified "
  "2026-08-02: (1) a third argument is SILENTLY IGNORED, so (range 0 5 2) answers (0 1 2 3 4) rather than "
  "(0 2 4) -- there is no step parameter at all; (2) the one-argument form (range 5) answers '() rather than "
  "counting from zero; (3) a backwards range answers '() rather than descending; (4) non-numeric bounds are "
  "not rejected -- (range 'a 'b) answers (a). Per the conformance ladder this duplicates SRFI-1 iota under a "
  "non-standard name with strictly less capability."),
 row2=dict(
  eng="(define (evens n) (filter even? (range 0 n)))\n(display (evens 10))\n(newline)",
  math="(display (list 'sum-1-to-100 (apply + (range 1 101)) 'gauss (/ (* 100 101) 2)))\n(newline)",
  cs="(display (list 'two-arg (range 0 5) 'three-arg (range 0 5 2) 'one-arg (range 5)\n               'backwards (range 3 1) 'empty (range 2 2) 'negative (range -2 2)\n               'fractional (range 0 3.5) 'iota-with-step (iota 5 0 2)))\n(newline)",
  problem=("The operator needs every second frame number from 0 to 100. Candidates: range with a step "
   "argument (accepted by the reader, ignored at run time, and returns every frame -- a hundred-fold error "
   "delivered silently), (filter even? (range 0 100)) (correct, and builds the full list first), and "
   "(iota 50 0 2) (correct, builds only what is needed, and is the SRFI-1 name). The first candidate is the "
   "trap: it looks exactly like the Python call it was copied from and it does not do what that call does."),
  explanation=("eng: filtering a range, the correct way to get a step out of this verb. math: the sum of 1 to "
   "100 checked against Gauss's closed form, which is both a use and a test. cs: eight cases in one row -- "
   "the two-argument form, the ignored third argument, the empty one-argument form, backwards, degenerate, "
   "negative, fractional, and iota doing the stepping job properly."),
  meta=("Why iota closes the cs row: it is the standard verb for this operation, it is already bound here, and "
   "it does everything range does plus the step that range silently drops."),
  l_eng="An argument that is accepted and ignored is the most dangerous possible API. There is no error, no warning, and the call site reads as correct.",
  l_math="Checking a sum against a closed form is a test that costs one line and catches every off-by-one in the range that produced it.",
  l_cs="Before adding a verb, check whether the adopted standard already spells it. range and iota are the same idea, and only one of them ports."),
 row3=dict(
  setup="Lay out every whole number from a starting point up to, but not reaching, a stopping point.",
  rungs=[("list","(display (range 0 5))\n(newline)"),
         ("numbering the seats in a row from the aisle up to the wall",
          "(display (list 'seats (range 1 6)))\n(newline)"),
         ("enumerating the half-open interval of integers [a, b)",
          "(display (list 'interval (range -2 3)))\n(newline)")],
  explanation=("In list, range enumerates a half-open span. Numbering seats from the aisle up to the wall is "
   "the same act: you start where the row starts, you number every seat, and the wall is not a seat. In "
   "mathematics it is enumerating the integers of [a, b), and the square bracket and the round bracket say "
   "exactly which end is included. All three share: a start that counts, an end that does not, and a size "
   "that is simply the difference."),
  meta=("The wall is the whole lesson about half-open intervals. If the wall were a seat you could not put two "
   "rows end to end without either double-counting the join or leaving a gap -- and that is precisely why "
   "index ranges are half-open in every language that got it right."),
  l_eng="Half-open ranges tile. Two adjacent ranges cover everything exactly once, which is what makes chunking, paging and partitioning safe.",
  l_math="[a, b) has cardinality b - a with no correction term, which is why so many counting arguments are stated over half-open intervals.",
  l_cs="Related patterns: Python's range (half-open, and its one-argument form counts from zero), Ruby's ... operator, and SRFI-1 iota (count-based rather than end-based). Motoi's is half-open like Python's and has no one-argument form."),
 row4=dict(
  eng="(display (list 'lengths (map (lambda (p) (length (range (first p) (last p))))\n                              (list (list 0 5) (list 2 2) (list -2 2) (list 3 1)))))\n(newline)",
  math="(display (list 'tiles (equal? (range 0 6) (append (range 0 2) (append (range 2 4) (range 4 6))))))\n(newline)",
  cs="(display (list 'indices-line-up (let ((xs (list 'a 'b 'c)))\n  (equal? xs (map (lambda (i) (list-ref xs i)) (range 0 (length xs)))))))\n(newline)",
  claim=("The length of (range a b) is b - a when b > a and zero otherwise -- there is no descending form. "
   "Adjacent ranges sharing an endpoint TILE exactly: appending them reproduces the whole with no overlap and "
   "no gap. And (range 0 (length xs)) is precisely the set of valid indices of xs, so mapping list-ref over it "
   "reconstructs xs."),
  invariant="For all integers a, b. length(range(a,b)) = max(0, b - a); range(a,c) = append(range(a,b), range(b,c)) for a <= b <= c; and map(i -> list-ref(xs,i), range(0, length(xs))) = xs",
  meta=("The pattern is three properties that together pin down the half-open convention: the size law, the "
   "tiling law, and the index law. What would falsify them: a length with a plus-one, a tiling that duplicated "
   "the join, or an index map that raised at the end. The third is the practical one -- it is the reason "
   "range's end is exclusive, and it would fail immediately under any other convention."),
  l_eng="If your range convention makes indices line up without arithmetic at the call site, it is the right convention.",
  l_math="A tiling law is a stronger statement than a size law: it constrains the boundaries as well as the count.",
  l_cs="Reconstructing a collection by mapping its accessor over its index range is a one-line test that catches every off-by-one in both the range and the accessor."),
 row5=dict(
  eng="(define (grid w h)\n  (apply append (map (lambda (y) (map (lambda (x) (list x y)) (range 0 w))) (range 0 h))))\n(display (grid 3 2))\n(newline)",
  math="(define (enumerate xs) (zip (range 0 (length xs)) xs))\n(display (enumerate (list 'p 'q 'r)))\n(newline)",
  cs="(define (step-by a b k) (filter (lambda (i) (= 0 (modulo (- i a) k))) (range a b)))\n(display (list 'stepped (step-by 0 10 3) 'iota-equivalent (iota 4 0 3)))\n(newline)",
  base="range produces the half-open list of integers from start to end.",
  emergent=("eng: a coordinate grid, one range nested inside another and flattened -- the whole of iterating "
   "over two dimensions, and the shape underneath every raster, board and lookup table. math: enumerate, range "
   "zipped with the data, which turns positions into first-class values. cs: a stepped range built by "
   "filtering, which is the workaround for the ignored third argument, printed beside the iota call that does "
   "it directly."),
  emergent_name="the coordinate grid",
  meta=("The composition is range nested in range, or range zipped with data. What emerges is the iteration "
   "family: grids, index pairs, cartesian products, nested loops and every algorithm that visits positions "
   "rather than elements. The cs lane is the honest one -- it shows the workaround and the standard verb side "
   "by side, and iota is shorter."),
  l_eng="Make the iteration space a value. Once the positions are a list you can filter them, reorder them, or split them across workers.",
  l_math="A cartesian product of two ranges is a grid; nesting the constructors is the same statement as nesting the quantifiers.",
  l_cs="When you find yourself filtering a range to simulate a step, the verb you want already exists. Look for it before you write the filter."),
)

for k in list(R):
    for row in ('row2','row3','row4','row5'):
        d=R[k][row]
        for a,b in (('l_eng','l-eng'),('l_math','l-math'),('l_cs','l-cs'),('emergent_name','emergent-name')):
            if a in d: d[b]=d.pop(a)

if __name__=='__main__': main(R, sys.argv[1:])
