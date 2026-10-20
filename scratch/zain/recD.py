# -*- coding: utf-8 -*-
"""first, last, take, drop. Every :code and every row program in this file was
executed before its note was written; transcripts in gE.scm gF.scm gG.scm gH.scm."""
import sys; sys.path.insert(0,'/Users/alfred/code/motoi-scheme/scratch/zain')
from emit import main
R={}

R['first'] = dict(
 name='first', std='SRFI-1', tier='core', kind='pure',
 signature='(first pair) -> obj',
 summary='The first element of a list. Same answer as car on a proper list, and a name that reads at the call site.',
 explanation=(
  "SRFI-1 gives the first ten positions of a list ordinal names -- first through tenth -- so that code which "
  "means \"the winner\" does not have to say car. On a proper list first and car agree exactly, and the choice "
  "between them is entirely about the reader: car is the right word when you are taking a structure apart cell "
  "by cell, and first is the right word when the list is a sequence and you want its front. That is not a small "
  "thing in a teaching language; (first queue) says what it is for and (car queue) says how it is done. SRFI-1 "
  "defines first as car, which means it is an error to apply it to anything that is not a pair. Motoi does not "
  "raise there: because a proper list is stored as a flat vector, first is a direct index, and indexing past the "
  "end of a vector yields a non-value -- an object that prints as nothing and is TRUE in an if. So (first '()) "
  "does not stop your program, it hands you something that passes every test you are likely to write. Guard the "
  "empty case with null? BEFORE you call first, every time. Two neighbouring jobs get mistaken for this one. For "
  "the whole rest of the list use drop or cdr. For an element by index use list-ref, which does raise when the "
  "index is out of range."),
 examples=[
  ('novice',
   "(first (list 10 20 30))",
   "10 -- the front of the list, unchanged and uncopied. The list itself is untouched."),
  ('intermediate',
   "(define queue (list 'ada 'brue 'cyd))\n(display (list 'next-up (first queue) 'waiting (length (drop queue 1))))\n(newline)",
   "Prints (next-up ada waiting 2). first and drop are the two halves of the same split: one names the front, the other names everything else."),
  ('expert',
   "(display (list 'empty (if (first '()) 'truthy-NON-VALUE 'false)\n               'dotted (if (first (cons 1 2)) 'truthy-NON-VALUE 'false)\n               'string (first \"abc\")))\n(newline)",
   "Prints (empty truthy-NON-VALUE dotted truthy-NON-VALUE string a). Three divergences from SRFI-1 in one line: the empty list yields a truthy non-value instead of an error, a real dotted pair does too instead of yielding 1, and a STRING is accepted and yields its first character as a one-character string. car raises on all three."),
 ],
 caveats=[
  "DIVERGENCE from SRFI-1: (first '()) does not raise. It returns a non-value that prints as nothing and is TRUE in an if, so a missing-element bug survives the obvious check. Test (null? xs) before calling.",
  "DIVERGENCE from SRFI-1: first on a real dotted pair from cons also yields a truthy non-value rather than the car. SRFI-1 defines first as car, which would answer 1 for (cons 1 2). Use car when the argument may be a dotted pair.",
  "DIVERGENCE: first accepts a STRING and returns its first character as a one-character string -- (first \"abc\") is \"a\", and string? on that is #t while char? is #f. car raises on a string. Do not rely on this; use string-ref for characters.",
  "On any non-empty proper list first and car agree exactly, including when the element is itself a list, a string, or a nested structure. Prefer first when the argument is a sequence and car when it is a cons cell.",
  "It does not copy and does not consume: the list is exactly as long after the call as before.",
 ],
 usecases=["Naming the front of a queue, a ranking, or a sorted result at the call site.",
           "Reading the winner out of (sort xs better?) without a second traversal.",
           "Peeking at a stack, guarded by null?."],
 related=["car","last","drop","take","list-ref","second"],
 status='needs-alfred',
 concept="Ordinal access to the front of a sequence, as against structural decomposition of a pair.",
 prereq=["car","list","null?"],
 progression="Learn car first so you know what first is a name for, then null? so you can guard it, then first -- and read the empty-list caveat before you use it on anything you did not build yourself.",
 provenance=("SRFI-1 (ordinal accessors first..tenth); reference record added 2026-08-02, every example executed. "
  "Implementation src/base.js:696, a direct index (a) => a[0]. FLAGGED, three divergences verified 2026-08-02: "
  "(1) (first '()) returns a truthy non-value where SRFI-1's definition as car makes it an error; (2) first on a "
  "cons-built dotted pair also returns a truthy non-value where SRFI-1 would answer the car; (3) first accepts a "
  "string and returns a one-character string, where car raises. All three follow from the implementation being "
  "an unguarded index rather than a call to car."),
 row2=dict(
  eng="(define queue (list 'ada 'brue 'cyd))\n(display (list 'next-up (first queue) 'waiting (length (drop queue 1))))\n(newline)",
  math="(define seq (list 5 8 13 21))\n(display (list 'a0 (first seq) 'rest (drop seq 1)))\n(newline)",
  cs="(display (list 'list (first (list 1 2))\n               'empty (if (first '()) 'truthy-NON-VALUE 'false)\n               'dotted (if (first (cons 1 2)) 'truthy-NON-VALUE 'false)\n               'string (first \"abc\")))\n(newline)",
  problem=("The operator has a sorted queue and needs the item being served next. Candidates: first (says what "
   "it means and works on any non-empty proper list), car (identical answer, but the word is about cell "
   "structure, not about order), and list-ref with index 0 (correct, slower to read, and the only one of the "
   "three that RAISES on an empty list). When the queue can be empty, none of them is safe without a null? "
   "guard -- and only list-ref will tell you when you forgot."),
  explanation=("eng: naming the head of a work queue and counting what is left behind it. math: reading a0 out "
   "of a sequence, which is the reading that makes first the right word rather than car. cs: the boundary row -- "
   "a normal list, the empty list, a dotted pair, and a string, three of which answer something SRFI-1 says is "
   "an error."),
  meta=("Why the cs row exists at all: three of its four cases are the divergences, and they are invisible from "
   "the eng and math rows. A verb that never raises has to be probed deliberately or its failure mode is never seen."),
  l_eng="Choose the accessor whose NAME matches the reader's model of the data. The compiler does not care; the next reader does.",
  l_math="Indexing a sequence and destructuring a pair are different operations that happen to coincide on proper lists; the coincidence is an implementation fact, not a definition.",
  l_cs="An accessor that returns a truthy non-value instead of raising converts a crash into a wrong answer, which is strictly worse. Guard at the call site."),
 row3=dict(
  setup="Take the front item of an ordered collection without disturbing the collection.",
  rungs=[("list","(define xs (list 1 2 3))\n(display (first xs))\n(newline)"),
         ("reading the name at the top of a race result",
          "(define race (list 'ada 'brue 'cyd))\n(display (list 'winner (first race)))\n(newline)"),
         ("naming a0, the initial term of a sequence",
          "(define seq (list 5 8 13 21))\n(display (list 'a0 (first seq)))\n(newline)")],
  explanation=("In list, first indexes position zero. Reading the winner off a race result is the same act: the "
   "sheet is ordered, the top line is distinguished by that order alone, and reading it changes nothing. In "
   "mathematics it is naming a0, the term that anchors a recurrence. All three share: an order that already "
   "exists, a distinguished front, and a read that leaves the collection intact."),
  meta=("What travels is the ORDER. first is meaningless on a set and meaningful on a sequence, which is why "
   "the name is better than car in every one of these three readings."),
  l_eng="If the front of your collection is meaningful, say so with the name you use to read it.",
  l_math="a0 is not just an element; it is the base case, and code that reads it is usually about to recur.",
  l_cs="Related patterns: xs[0] in most languages, head in Haskell (which also errors on empty), and Rust's first returning Option -- three answers to the empty case, and only one of them is safe by construction."),
 row4=dict(
  eng="(display (list 'first=car (map (lambda (l) (equal? (first l) (car l)))\n                               (list (list 1) (list 1 2) (list \"s\" 2) (list (list 3) 4)))))\n(newline)",
  math="(define (rebuild l) (equal? l (cons (first l) (drop l 1))))\n(display (map rebuild (list (list 1) (list 1 2 3))))\n(newline)",
  cs="(display (list 'unchanged (let ((l (list 1 2 3))) (first l) (length l))))\n(newline)",
  claim=("On every non-empty proper list, first answers exactly what car answers -- for atoms, strings and "
   "nested lists alike -- and the list can be reconstructed as (cons (first l) (drop l 1)). Reading the front "
   "consumes nothing: the list is the same length afterwards."),
  invariant="For all non-empty proper lists l. first(l) = car(l), and cons(first(l), drop(l,1)) = l, and length(l) is unchanged by the call",
  meta=("The pattern is an alias proved against the verb it aliases, across four element shapes so that "
   "nesting cannot hide a difference. What would falsify it: any element shape where the two disagree, or a "
   "rebuild that does not equal the original. The claim is deliberately restricted to NON-EMPTY PROPER lists, "
   "because that is exactly the domain on which it holds."),
  l_eng="When you introduce an alias, write the test that proves it is one. Otherwise the two drift and nobody notices which call sites moved.",
  l_math="cons(first(l), rest(l)) = l is the destructor-constructor law; a sequence type that fails it is not a list.",
  l_cs="Testing across element shapes catches representation leaks. Here the string case is the one that would have found the divergence if the argument, not the element, had been the string."),
 row5=dict(
  eng="(define (peek stack) (if (null? stack) 'empty (first stack)))\n(display (list (peek (list 1 2)) (peek '())))\n(newline)",
  math="(define (argmax-by f xs) (first (sort xs (lambda (a b) (> (f a) (f b))))))\n(display (argmax-by (lambda (n) n) (list 3 9 4)))\n(newline)",
  cs="(define (label-run xs) (list (first xs) (length xs)))\n(display (label-run (list 'ore 'ore 'ore)))\n(newline)",
  base="first reads the front element of a proper list.",
  emergent=("eng: a total peek -- first wrapped in the null? guard the implementation does not provide, which "
   "is the wrapper every program using first should actually have. math: argmax expressed as sort-then-take-"
   "front, the composition that makes first worth having as a name at all. cs: run-length labelling, where the "
   "front element STANDS FOR the whole block -- the pattern underneath compression, grouping and deduplication."),
  emergent_name="the total peek",
  meta=("The composition is first plus one guard, or first plus an ordering. What emerges is the "
   "representative-element family: peek, argmax, mode, run-label and group-key are all a sort or a partition "
   "followed by reading the front. The eng lane is the one to copy verbatim -- a bare first on a list you did "
   "not build is a latent wrong answer, not a latent crash."),
  l_eng="Wrap an unsafe primitive once, name the wrapper, and use the wrapper. A guard repeated at ten call sites will be missing from the eleventh.",
  l_math="argmax is not a primitive; it is an order plus a projection, and writing it that way makes the tie-breaking rule explicit instead of accidental.",
  l_cs="Letting the front element represent a group is how sorting turns into grouping. Once the data is ordered, first is the whole of the aggregation step."),
)

R['last'] = dict(
 name='last', std='SRFI-1', tier='core', kind='pure',
 signature='(last pair) -> obj',
 summary='The last element of a list. Constant time here, because Motoi stores a proper list as a flat vector.',
 explanation=(
  "SRFI-1's last answers the final ELEMENT of a non-empty list -- not the final pair, which is last-pair's "
  "job and a different value. The distinction matters: for (1 2 3), last is 3 and last-pair is (3). In a "
  "cell-based Scheme last has to walk the whole chain, which is why the standard warns that it is a linear "
  "operation and why experienced Scheme programmers reach for reverse or an accumulator instead of calling it "
  "in a loop. In Motoi a proper list is a flat vector and last is a single index from the end, so that cost "
  "argument does not apply -- but the code you write should still read as though it does, because the same "
  "code has to run in other Schemes. SRFI-1 defines last only on non-empty lists; applying it to '() is an "
  "error. Motoi does not raise: it indexes past the end and hands back a non-value that prints as nothing and "
  "is TRUE in an if, so an empty-list bug reaches production looking healthy. Guard with null? or pair?. Two "
  "neighbouring jobs get mistaken for this one. For the final PAIR use last-pair. For everything except the "
  "final element use take with (- (length xs) 1)."),
 examples=[
  ('novice',
   "(last (list 10 20 30))",
   "30 -- the final element, not the final pair. (last-pair (list 10 20 30)) would answer (30)."),
  ('intermediate',
   "(define log (list 'boot 'load 'ready))\n(display (list 'latest (last log) 'earlier (take log (- (length log) 1))))\n(newline)",
   "Prints (latest ready earlier (boot load)). last and that take are the two halves of a split at the back, the mirror of first and drop at the front."),
  ('expert',
   "(display (list 'list (last (list 1 2 3))\n               'one (last (list 9))\n               'empty (if (last '()) 'truthy-NON-VALUE 'false)\n               'dotted (if (last (cons 1 2)) 'truthy-NON-VALUE 'false)))\n(newline)",
   "Prints (list 3 one 9 empty truthy-NON-VALUE dotted truthy-NON-VALUE). A one-element list is the interesting middle case -- there first and last are the same element. The empty list and a real dotted pair both yield truthy non-values where SRFI-1 says error."),
 ],
 caveats=[
  "DIVERGENCE from SRFI-1: (last '()) does not raise. It returns a non-value that prints as nothing and is TRUE in an if. Guard with null? or pair? before calling.",
  "DIVERGENCE from SRFI-1: last on a real dotted pair from cons yields a truthy non-value. SRFI-1's last is defined over improper lists too, via (car (last-pair x)).",
  "DIVERGENCE: last accepts a STRING and returns its final character as a one-character string. Use string-ref for characters.",
  "last is the final ELEMENT; last-pair is the final PAIR. For (1 2 3) they are 3 and (3). Reaching for the wrong one is the most common mistake with this verb.",
  "On a one-element list first and last are the same element and (equal? (first l) (last l)) is #t. Code that assumes they differ needs a length check.",
  "Motoi's last is constant time because proper lists are vectors. Do not carry that assumption to other Schemes, where SRFI-1 last is linear and calling it inside a loop is quadratic.",
 ],
 usecases=["Reading the most recent entry of an append-only log or reading list.",
           "Taking the total off the end of a running-sum list.",
           "Naming the final state of a recorded run of a state machine."],
 related=["first","last-pair","take","drop","reverse","list-ref"],
 status='needs-alfred',
 concept="Access to the back of a sequence, and the element-versus-pair distinction that goes with it.",
 prereq=["list","length","car"],
 progression="Learn first, then reverse so you can see what last would cost elsewhere, then last -- and learn last-pair immediately after so the two never get confused.",
 provenance=("SRFI-1 (last); reference record added 2026-08-02, every example executed. Implementation "
  "src/base.js:697, a direct index (a) => a[a.length - 1]. FLAGGED, three divergences verified 2026-08-02: "
  "(1) (last '()) returns a truthy non-value where SRFI-1 makes it an error; (2) last on a cons-built dotted "
  "pair returns a truthy non-value where SRFI-1 answers via last-pair; (3) last accepts a string. Also noted, "
  "not a divergence but a portability trap: this last is O(1) because proper lists are flat vectors, while "
  "SRFI-1's is O(n)."),
 row2=dict(
  eng="(define log (list 'boot 'load 'ready))\n(display (list 'latest (last log) 'earlier (take log (- (length log) 1))))\n(newline)",
  math="(define partials (list 1 3 6 10 15))\n(display (list 'total (last partials) 'n (length partials)))\n(newline)",
  cs="(display (list 'list (last (list 1 2 3))\n               'one (last (list 9))\n               'empty (if (last '()) 'truthy-NON-VALUE 'false)\n               'dotted (if (last (cons 1 2)) 'truthy-NON-VALUE 'false)))\n(newline)",
  problem=("The operator has an append-only status log and needs the current status. Candidates: last (says "
   "exactly that, and is O(1) here), (car (reverse log)) (portable, correct, and copies the whole log to read "
   "one item), and (list-ref log (- (length log) 1)) (correct, arithmetic at the call site, and the only one "
   "that raises when the log is empty). last is the right word; the empty log is the case that decides whether "
   "you need a guard around it, and you do."),
  explanation=("eng: reading the current status off a log and keeping everything before it. math: reading the "
   "total off a list of partial sums, where the last element IS the answer and the rest is the working. cs: "
   "the boundary row -- a normal list, a one-element list where first and last coincide, the empty list, and a "
   "dotted pair."),
  meta=("Why the one-element case is in the cs row rather than treated as trivial: it is the only input on "
   "which first and last agree, and code that branches on 'is there more than one' is exactly the code that "
   "gets it wrong."),
  l_eng="The most recent entry of a log is a read, not a pop. Keep the reading verb and the removing verb apart in your vocabulary.",
  l_math="In a list of partial sums the last element is the total; recognising that saves a fold and is the reason scan-then-last is a standard idiom.",
  l_cs="Constant-time access to the back is a property of the REPRESENTATION, not of the operation. Code that depends on it is not portable, even when it is correct here."),
 row3=dict(
  setup="Name the final item of an ordered collection, the one everything else led up to.",
  rungs=[("list","(display (last (list 1 2 3)))\n(newline)"),
         ("reading the most recent number off a meter with a printed history",
          "(define readings (list 10 12 15))\n(display (list 'most-recent (last readings)))\n(newline)"),
         ("naming aN, the final term of a finite sequence",
          "(define ps (list 1 3 6 10))\n(display (list 'aN (last ps)))\n(newline)")],
  explanation=("In list, last indexes the final position. Reading the most recent number off a meter's printed "
   "history is the same act: the strip is ordered by time, the bottom line is the current value, and everything "
   "above it is history you are choosing not to read. In mathematics it is naming aN, the terminal term of a "
   "finite sequence. All three share: an order, a distinguished back, and a read that consumes nothing."),
  meta=("The meter strip carries something the list does not: the order is TIME, so the last line is not merely "
   "final, it is CURRENT. That is why last shows up in logs, histories and event streams far more than in "
   "ordinary data."),
  l_eng="When the ordering of your collection is time, the last element has a name in the domain -- current, latest, now -- and that name belongs in the code.",
  l_math="A finite sequence has a terminal term and an infinite one does not; reaching for last is an assertion that the collection is finite.",
  l_cs="Related patterns: xs[-1] in Python, xs[xs.length-1] in JS, last in Haskell (which errors on empty), and Rust's last returning Option. Same read, four different empty-case contracts."),
 row4=dict(
  eng="(display (list 'last=car-reverse (map (lambda (l) (equal? (last l) (car (reverse l))))\n                                      (list (list 1) (list 1 2) (list 1 2 3)))))\n(newline)",
  math="(display (list 'last=car-last-pair (equal? (last (list 1 2 3)) (car (last-pair (list 1 2 3))))))\n(newline)",
  cs="(display (list 'single (let ((l (list 7))) (list (equal? (first l) (last l)) (car l)))))\n(newline)",
  claim=("On every non-empty proper list, last answers the same object as (car (reverse l)) and the same object "
   "as (car (last-pair l)). On a one-element list it additionally coincides with first, which is the boundary "
   "where length-based branching goes wrong."),
  invariant="For all non-empty proper lists l. last(l) = car(reverse(l)) = car(last-pair(l)); and when length(l) = 1, last(l) = first(l)",
  meta=("The pattern is one verb proved against two independent constructions of the same value, so that a bug "
   "in either construction cannot hide the bug in last. What would falsify it: a list where reverse and "
   "last-pair disagree, or a singleton where first and last differ. The three list lengths in the eng program "
   "are chosen to cross the singleton boundary."),
  l_eng="Prove a value against two independent routes, not one. A single oracle that shares an implementation with the thing under test proves nothing.",
  l_math="last(l) = car(reverse(l)) is a duality statement: reverse turns back into front, which is why so many back-oriented verbs have front-oriented definitions.",
  l_cs="The singleton is the boundary case for every front-versus-back distinction. Put it in the test before you put the verb in the code."),
 row5=dict(
  eng="(define (final-state moves) (last moves))\n(display (final-state (list 'idle 'run 'halt)))\n(newline)",
  math="(define (span xs) (- (last xs) (first xs)))\n(display (span (list 10 12 15 21)))\n(newline)",
  cs="(define (extend xs) (append xs (list (+ 1 (last xs)))))\n(display (extend (extend (list 1 2))))\n(newline)",
  base="last reads the final element of a proper list.",
  emergent=("eng: the final state of a recorded run -- a trace is a list of states and its last entry is where "
   "the machine ended up, which turns a log into an answer. math: span, first and last together, the smallest "
   "program in which the two ends of a sequence are read as a pair rather than separately. cs: a self-extending "
   "list, where last supplies the seed for the next term -- the recurrence pattern, written iteratively."),
  emergent_name="the terminal read",
  meta=("The composition is last plus either the front or an append. What emerges is the endpoint family: final "
   "state, span, range, delta, and any recurrence whose next term is a function of the previous one. The math "
   "lane is the one to notice -- reading BOTH ends turns a sequence into an interval, and intervals compose in "
   "ways that individual elements do not."),
  l_eng="A trace plus one read is a result. Recording every state and then taking the last one is often simpler and always more debuggable than carrying a single mutable state.",
  l_math="Reading both endpoints turns a sequence into an interval; that is the step from data to measurement.",
  l_cs="A recurrence written as append-plus-last is O(n) per step here and quadratic overall; it is the clearest way to write it and the wrong way to run it. Know which you are doing."),
)

R['take'] = dict(
 name='take', std='SRFI-1', tier='core', kind='pure',
 signature='(take list k) -> list',
 summary='A new list of the first k elements. Motoi CLAMPS when k exceeds the length instead of raising, which SRFI-1 does not allow.',
 explanation=(
  "take and drop are the two halves of one cut: take keeps the front, drop keeps the back, and appending them "
  "in that order gives the original list back. That law is the reason to learn them as a pair rather than "
  "separately. SRFI-1 is explicit that (take lis k) requires lis to have at least k elements -- asking for "
  "more is an error, and SRFI-1's take is also allowed to work on improper lists as long as the prefix itself "
  "is proper. Motoi does neither. It slices a flat vector with a clamped index, so (take '(1 2) 99) quietly "
  "answers (1 2) instead of raising, a negative k is clamped to zero, and an improper list answers '() rather "
  "than its prefix. The clamping is the one to carry: a program that asks for five and is handed two will run, "
  "and the shortfall will surface somewhere else, later, as a wrong number. If the length matters, check it. "
  "SRFI-1's take is also permitted to share structure with its argument; Motoi's always returns a fresh list, "
  "so mutating the result never touches the original. Two neighbouring jobs get mistaken for this one. For the "
  "back of the list use drop. To split at a point and keep both halves at once, use split-at."),
 examples=[
  ('novice',
   "(take (list 1 2 3 4 5) 2)",
   "(1 2) -- a NEW list of the first two. The original is untouched and still five long."),
  ('intermediate',
   "(display (list 'prefixes (map (lambda (k) (take (list 1 2 3) k)) (list 0 1 2 3))))\n(newline)",
   "Prints (prefixes (() (1) (1 2) (1 2 3))). Every prefix from empty to whole; k is a count, not an index, so k = 0 gives the empty list and k = length gives a copy of the whole."),
  ('expert',
   "(display (list 'exact (take (list 1 2 3) 3) 'over (take (list 1 2) 9) 'zero (take (list 1 2) 0)\n               'empty (take '() 4) 'negative (take (list 1 2) -1) 'dotted (take (cons 1 2) 1)))\n(newline)",
   "Prints (exact (1 2 3) over (1 2) zero () empty () negative () dotted ()). Not one of these raises. SRFI-1 says asking for 9 from a 2-element list is an ERROR; Motoi hands back what it has. If the count matters to your program, compare it against length yourself."),
 ],
 caveats=[
  "DIVERGENCE from SRFI-1: asking for more elements than the list has does not raise -- it CLAMPS and returns the whole list. (take '(1 2) 9) is (1 2). SRFI-1 requires at least k elements. Compare against length when the count is load-bearing.",
  "DIVERGENCE from SRFI-1: a negative k is clamped to 0 and answers '() rather than raising.",
  "DIVERGENCE from SRFI-1: on an improper list, take answers '() rather than the proper prefix. SRFI-1 allows (take '(1 2 . 3) 2) to yield (1 2).",
  "The result is always a FRESH list, never shared with the argument -- (eq? (take xs (length xs)) xs) is #f. SRFI-1 permits sharing, so code that relies on either behaviour is unportable.",
  "k is a COUNT, not an index. (take xs 2) gives two elements, positions 0 and 1. Off-by-one here is the classic error; the prefix ladder in the intermediate example is worth reading once.",
  "For the complementary half use drop, and remember the law: (append (take xs k) (drop xs k)) equals xs for every k, including k past the end.",
 ],
 usecases=["Paging: showing the first n results and counting the remainder.",
           "Chunking a list into fixed-size blocks, with drop supplying the recursion.",
           "Truncating a display list and appending an ellipsis marker."],
 related=["drop","list-head","split-at","take-right","first","list-tail"],
 status='needs-alfred',
 concept="Cutting a sequence at a count, keeping the front half, without consuming the original.",
 prereq=["list","length","append"],
 progression="Learn length so k means something, then take and drop together as one cut, then the append law that ties them -- and only then split-at, which is both at once.",
 provenance=("SRFI-1 (take); reference record added 2026-08-02, every example executed. Implementation "
  "src/base.js:659, Array.slice with Math.max(0, n|0). FLAGGED, three divergences verified 2026-08-02: "
  "(1) k greater than the length CLAMPS instead of erroring, which SRFI-1 forbids; (2) negative k clamps to 0; "
  "(3) an improper list answers '() rather than its proper prefix, which SRFI-1 permits. Also noted, not a "
  "divergence: the result is always fresh, where SRFI-1 permits sharing."),
 row2=dict(
  eng="(define feed (list 9 8 7 6 5 4))\n(display (list 'page1 (take feed 3) 'rest (length (drop feed 3))))\n(newline)",
  math="(display (list 'prefixes (map (lambda (k) (take (list 1 2 3) k)) (list 0 1 2 3))))\n(newline)",
  cs="(display (list 'exact (take (list 1 2 3) 3) 'over (take (list 1 2) 9) 'zero (take (list 1 2) 0)\n               'empty (take '() 4) 'negative (take (list 1 2) -1) 'dotted (take (cons 1 2) 1)))\n(newline)",
  problem=("The operator has a long result feed and wants the first page plus a count of what remains. "
   "Candidates: take with drop (one cut, two reads, and the count comes from length of the back half), "
   "split-at (the same cut in one call, returning both halves), and list-head (identical behaviour to take "
   "here, but it is not the standard name and is not portable). take plus drop is the pair to learn; split-at "
   "is what you graduate to when you were going to compute both halves anyway."),
  explanation=("eng: paging a feed and reporting the remainder, the commonest real use. math: the full prefix "
   "ladder from k=0 to k=length, which is the clearest single picture of what k means. cs: six boundary cases "
   "in one row, three of which SRFI-1 calls errors and none of which raises here."),
  meta=("Why the ladder is the math row: k is the only argument, and showing every legal value of it at once "
   "is more informative than any single call. The endpoints -- empty and whole -- are where the off-by-one lives."),
  l_eng="When you page data, report the remainder in the same breath. A page with no count of what is left behind is a page the caller cannot act on.",
  l_math="The prefixes of a list form a chain under the prefix order, from the empty list to the list itself; take is the indexing function of that chain.",
  l_cs="A verb that clamps where the standard says error is the hardest kind of divergence to find, because every test you would naturally write passes."),
 row3=dict(
  setup="Keep the front portion of an ordered collection, up to a stated count, and leave the original intact.",
  rungs=[("list","(display (take (list 1 2 3 4) 2))\n(newline)"),
         ("reading the podium off a finishing order",
          "(display (list 'top3 (take (list 'gold 'silver 'bronze 'fourth) 3)))\n(newline)"),
         ("taking the first n terms of a sequence to form a partial sum",
          "(display (list 'partial-sum-inputs (take (list 1 2 3 4 5) 3)))\n(newline)")],
  explanation=("In list, take slices a prefix. Reading the podium off a finishing order is the same act: the "
   "order already exists, three is a decision made outside the data, and the fourth runner is not removed from "
   "the results by being left off the podium. In mathematics it is taking the first n terms to form a partial "
   "sum. All three share: an order, a count chosen by the caller rather than by the data, and an original that "
   "survives the cut."),
  meta=("The podium is honest about the divergence too. If only two runners finished, a podium of three is a "
   "question the data cannot answer -- SRFI-1 raises, Motoi hands you two and says nothing."),
  l_eng="A cut point that comes from outside the data is a policy. Write it where the policy lives, not buried in the slicing call.",
  l_math="A partial sum is a fold over a prefix; separating 'which terms' from 'what to do with them' is what makes both reusable.",
  l_cs="Related patterns: xs[:n] in Python, slice(0,n) in JS, Haskell's take (which also clamps, and is the likely ancestor of this behaviour). Two of the three clamp; SRFI-1 does not."),
 row4=dict(
  eng="(display (list 'prefix-of (let ((xs (list 1 2 3 4 5)))\n  (map (lambda (k) (equal? xs (append (take xs k) (drop xs k)))) (list 0 1 2 3 4 5)))))\n(newline)",
  math="(display (list 'lengths (let ((xs (list 1 2 3 4 5)))\n  (map (lambda (k) (length (take xs k))) (list 0 3 5 12)))))\n(newline)",
  cs="(display (list 'copy-not-alias (let ((xs (list 1 2 3))) (eq? (take xs 3) xs))))\n(newline)",
  claim=("For every k from 0 to the length, (append (take xs k) (drop xs k)) reconstructs xs exactly -- take "
   "and drop are a partition, not two independent slices. The length of the result is the MINIMUM of k and the "
   "length of the list, which is where the divergence shows: at k = 12 on a 5-element list the length is 5, "
   "not an error. And the result is never eq? to the argument, even when it contains every element."),
  invariant="For all lists xs and counts k >= 0. append(take(xs,k), drop(xs,k)) = xs, and length(take(xs,k)) = min(k, length(xs)) -- where SRFI-1 instead requires k <= length(xs)",
  meta=("The pattern is a partition law tested across the whole legal range of the cut point plus one value "
   "beyond it. What would falsify it: any k where the two halves do not rejoin, or a length that is not the "
   "minimum. The value 12 in the math program is not decoration -- it is the evidence for the :status flag, and "
   "it is the single line that would have caught this divergence had it been written earlier."),
  l_eng="Test the argument range including one value outside it. The behaviour outside the contract is behaviour your callers will eventually depend on.",
  l_math="take and drop form a partition of the list at k; partition laws are stronger tests than element-wise checks because they constrain both halves at once.",
  l_cs="min(k, length) instead of an error is a design choice, not a bug in isolation -- but it is a divergence from the cited standard, and an undocumented divergence is a bug regardless of which behaviour is nicer."),
 row5=dict(
  eng="(define (bounded xs cap) (if (> (length xs) cap) (append (take xs cap) (list '...)) xs))\n(display (list (bounded (list 1 2 3 4 5) 3) (bounded (list 1 2) 3)))\n(newline)",
  math="(define (chunk xs n) (if (null? xs) '() (cons (take xs n) (chunk (drop xs n) n))))\n(display (chunk (list 1 2 3 4 5 6 7) 3))\n(newline)",
  cs="(define (window xs k n) (take (drop xs k) n))\n(display (window (list 'a 'b 'c 'd 'e 'f) 2 3))\n(newline)",
  base="take returns a fresh list of the first k elements.",
  emergent=("eng: a bounded display -- truncate and mark, with the length check that take itself does not "
   "perform, which is what turns silent clamping into a visible ellipsis. math: chunking, take and drop in "
   "mutual recursion, and the place where the clamp is a FEATURE: the final short chunk falls out for free "
   "instead of needing a special case. cs: a window, drop then take, two counts composing into an offset and a "
   "width -- the whole of slicing from two verbs."),
  emergent_name="the sliding window",
  meta=("The composition is take with drop. What emerges is the window family: paging, chunking, batching, "
   "n-grams and sliding windows are all offset-plus-width over an ordered collection. The math lane is worth a "
   "second look because it is the one place where Motoi's clamping divergence makes the code SHORTER -- and "
   "that is exactly why the divergence survived undocumented."),
  l_eng="Show the reader that data was truncated. A silently shortened list is indistinguishable from a short list, and the caller cannot tell which they got.",
  l_math="Chunking is a fold whose step consumes n elements instead of one; recognising that gives you the termination proof for free.",
  l_cs="An offset and a width beat a start and an end index: they do not change meaning when the collection is shorter than expected, and they compose."),
)

R['drop'] = dict(
 name='drop', std='SRFI-1', tier='core', kind='pure',
 signature='(drop list k) -> list',
 summary='Everything after the first k elements. Motoi returns a fresh COPY and clamps past the end; SRFI-1 shares structure and calls the overshoot an error.',
 explanation=(
  "drop is the back half of the cut whose front half is take, and the law that binds them is that appending "
  "take then drop rebuilds the original for every k. In SRFI-1 drop is the cheap half: it is defined as "
  "repeated cdr, so it SHARES structure with its argument and costs nothing to produce -- (drop lis k) is "
  "literally a pointer into lis. Motoi cannot do that, because a proper list is a flat vector with no interior "
  "pointer to hand out, so drop copies. Three consequences follow and all three were verified: the result is "
  "not eq? to the corresponding tail, mutating the result cannot affect the original, and the cost is linear "
  "in what survives rather than in what is skipped. The other divergence is the overshoot. SRFI-1 requires the "
  "list to have at least k elements; Motoi clamps and answers '(). The contrast worth memorising is with "
  "list-tail, the R7RS-small verb doing the same job: (list-tail '(1 2) 9) RAISES, while (drop '(1 2) 9) "
  "answers '(). Same intent, opposite failure behaviour, one chapter apart. Two neighbouring jobs get mistaken "
  "for this one. For the front use take. For a strict version that reports the overshoot use list-tail."),
 examples=[
  ('novice',
   "(drop (list 1 2 3 4 5) 2)",
   "(3 4 5) -- everything after the first two. A NEW list; the original is still five long."),
  ('intermediate',
   "(display (list 'suffixes (map (lambda (k) (drop (list 1 2 3) k)) (list 0 1 2 3))))\n(newline)",
   "Prints (suffixes ((1 2 3) (2 3) (3) ())). Every suffix from whole to empty. k = 0 drops nothing and k = length drops everything, so drop shrinks exactly as take grows."),
  ('expert',
   "(display (list 'over (drop (list 1 2) 9) 'negative (drop (list 1 2) -1) 'dotted (drop (cons 1 2) 1)\n               'list-tail-over (guard (e (#t 'raised)) (list-tail (list 1 2) 9))))\n(newline)",
   "Prints (over () negative (1 2) dotted () list-tail-over raised). The last field is the whole lesson: list-tail RAISES on the same overshoot that drop clamps to '(). Two verbs for one job, two contracts, and only list-tail's matches SRFI-1's stated requirement."),
 ],
 caveats=[
  "DIVERGENCE from SRFI-1: dropping more elements than the list has does not raise -- it CLAMPS and returns '(). SRFI-1 requires at least k elements. list-tail, one chapter over, raises on exactly this input; use it when the overshoot is a bug you want reported.",
  "DIVERGENCE from SRFI-1: the result is a fresh COPY, not a shared tail. (eq? (drop xs 1) (drop xs 1)) is #f, and mutating the result with list-set! leaves the original unchanged. SRFI-1's drop is repeated cdr and shares structure, so portable code must not depend on either behaviour.",
  "DIVERGENCE from SRFI-1: a negative k is clamped to 0 and returns the whole list rather than raising.",
  "DIVERGENCE from SRFI-1: on an improper list, drop answers '() rather than the corresponding tail.",
  "Because the result is a copy, drop costs time proportional to what SURVIVES, not to what is skipped. In a cell-based Scheme it is the reverse. Do not port a performance assumption in either direction.",
  "The partition law holds regardless: (append (take xs k) (drop xs k)) equals xs for every k, including k past the end.",
 ],
 usecases=["Skipping a header row before processing the body of a table.",
           "Supplying the recursive step of a chunking or n-gram walk, with take supplying the block.",
           "Rotating a list by appending the dropped front to the kept back."],
 related=["take","list-tail","split-at","drop-right","cdr","first"],
 status='needs-alfred',
 concept="Cutting a sequence at a count, keeping the back half -- and the sharing-versus-copying question that goes with it.",
 prereq=["list","take","cdr"],
 progression="Learn cdr, then take, then drop as its complement, then the append law -- and read list-tail beside it, because the difference in what they do when you overshoot is the most useful fact in either record.",
 provenance=("SRFI-1 (drop); reference record added 2026-08-02, every example executed. Implementation "
  "src/base.js:660, Array.slice with Math.max(0, n|0). FLAGGED, four divergences verified 2026-08-02: "
  "(1) k greater than the length CLAMPS to '() instead of erroring, where the sibling R7RS-small verb list-tail "
  "raises on the same input; (2) the result is a COPY, not a shared tail -- (eq? (drop xs 1) (drop xs 1)) is #f "
  "and list-set! on the result does not reach the original, where SRFI-1 defines drop as repeated cdr and "
  "explicitly shares; (3) negative k clamps to 0; (4) an improper list answers '()."),
 row2=dict(
  eng="(define csv (list 'header 'r1 'r2 'r3))\n(display (list 'rows (drop csv 1) 'header (first csv)))\n(newline)",
  math="(display (list 'suffixes (map (lambda (k) (drop (list 1 2 3) k)) (list 0 1 2 3))))\n(newline)",
  cs="(display (list 'exact (drop (list 1 2 3) 3) 'over (drop (list 1 2) 9) 'zero (drop (list 1 2) 0)\n               'empty (drop '() 4) 'negative (drop (list 1 2) -1) 'dotted (drop (cons 1 2) 1)\n               'list-tail-over (guard (e (#t 'raised)) (list-tail (list 1 2) 9))))\n(newline)",
  problem=("The operator has a parsed table whose first row is a header and needs the body. Candidates: drop "
   "with 1 (says exactly that, and clamps silently on a table that turned out to be empty), cdr (identical "
   "answer on a non-empty list, and the word is about cells rather than about rows), and list-tail with 1 "
   "(same answer, and RAISES on the empty table). The choice is entirely about what should happen when the "
   "table is empty, and that is a decision the parser's caller has to make explicitly, because drop will not "
   "make it for them."),
  explanation=("eng: skipping a header row and naming it in the same breath, so the reader can see both halves "
   "of the cut. math: the full suffix ladder from k=0 to k=length, the mirror of take's prefix ladder. cs: "
   "seven cases in one row, ending with the list-tail contrast that is the single most useful fact about this "
   "verb."),
  meta=("Why list-tail is in drop's cs row: two verbs in this same reference do the same job with opposite "
   "contracts, and a reader who learns only one will eventually pick the wrong one for a case that matters."),
  l_eng="When two verbs differ only in what they do on bad input, that difference IS the API. Choose on the failure behaviour, not on the name.",
  l_math="The suffixes of a list form a descending chain under the suffix order; drop is its indexing function, exactly as take indexes the prefixes.",
  l_cs="Silent clamping and loud raising are both defensible. Having both in one language under two names, undocumented, is not."),
 row3=dict(
  setup="Set aside the front portion of an ordered collection and keep what is behind it.",
  rungs=[("list","(display (drop (list 1 2 3 4) 2))\n(newline)"),
         ("crossing off the days already gone and keeping the rest of the week",
          "(display (list 'remaining (drop (list 'mon 'tue 'wed) 1)))\n(newline)"),
         ("naming the tail of a sequence from index k onward",
          "(display (list 'tail-from-2 (drop (list 5 8 13 21) 2)))\n(newline)")],
  explanation=("In list, drop slices a suffix. Crossing off the days already gone is the same act: the week has "
   "an order, the cut point comes from outside the data -- today's date -- and Monday is not deleted from the "
   "calendar by being behind you. In mathematics it is naming the tail of a sequence from index k, the "
   "construction every proof by induction on a suffix relies on. All three share: an order, an externally "
   "chosen cut, and an original that survives."),
  meta=("The week is honest about the copy too. Crossing days off a calendar leaves the calendar; here you get "
   "a NEW list of remaining days, and writing on it does not write on the week."),
  l_eng="A cut point that comes from the clock, not the data, belongs in a named variable. Buried arithmetic in a slicing call is where off-by-one errors live.",
  l_math="Induction on the tail of a sequence is the standard shape for proofs about streams and lists; drop is that step made concrete.",
  l_cs="Related patterns: xs[n:] in Python (copies), slice(n) in JS (copies), and Haskell's drop (shares, lazily). Motoi copies, SRFI-1 shares -- the same name for two different cost models."),
 row4=dict(
  eng="(display (list 'shares (let ((xs (list 1 2 3))) (eq? (drop xs 1) (drop xs 1)))\n               'equal (let ((xs (list 1 2 3))) (equal? (drop xs 1) (list-tail xs 1)))))\n(newline)",
  math="(display (list 'lengths (let ((xs (list 1 2 3 4 5)))\n  (map (lambda (k) (length (drop xs k))) (list 0 3 5 12)))))\n(newline)",
  cs="(display (list 'independent (let* ((xs (list 1 2 3)) (d (drop xs 1)))\n  (list-set! d 0 'X) (list 'xs xs 'd d))))\n(newline)",
  claim=("drop returns a value EQUAL to the corresponding tail and never EQ? to it. Its length is the length "
   "of the list minus k, floored at zero -- so a k past the end gives 0 rather than an error. And because the "
   "result is an independent copy, mutating it with list-set! leaves the original untouched, which is exactly "
   "what a SRFI-1 drop would NOT guarantee."),
  invariant="For all lists xs and counts k >= 0. drop(xs,k) is equal? to list-tail(xs,k) whenever the latter is defined, drop(xs,k) is never eq? to any tail of xs, and length(drop(xs,k)) = max(0, length(xs) - k)",
  meta=("The pattern is an identity test separated from an equality test, because the two disagree here and "
   "the disagreement IS the finding. What would falsify it: an eq? that came back #t, or a mutation of the "
   "result that reached xs. The cs program is the direct evidence -- it writes to the copy and shows the "
   "original unmarked -- and it is the line that decided the :status flag."),
  l_eng="Test identity with eq? and value with equal?, and never let one stand in for the other. A copy passes every equal? test a shared tail passes.",
  l_math="Equality of value and equality of reference are different relations; a language that conflates them cannot express sharing at all.",
  l_cs="Sharing is unobservable until somebody mutates. That is why a copy-versus-share divergence stays hidden for years and then surfaces as one impossible bug."),
 row5=dict(
  eng="(define (skip-header rows) (if (eq? (first rows) 'header) (drop rows 1) rows))\n(display (list (skip-header (list 'header 1 2)) (skip-header (list 1 2))))\n(newline)",
  math="(define (rotate xs k) (append (drop xs k) (take xs k)))\n(display (rotate (list 1 2 3 4 5) 2))\n(newline)",
  cs="(define (every-nth xs n) (if (null? xs) '() (cons (first xs) (every-nth (drop xs n) n))))\n(display (every-nth (list 1 2 3 4 5 6 7) 3))\n(newline)",
  base="drop returns a fresh list of everything after the first k elements.",
  emergent=("eng: a conditional header skip -- drop guarded by a test, so a table that has no header is not "
   "silently shortened by one row. math: rotation, drop and take appended in the OTHER order, which is the "
   "entire implementation of a cyclic shift and the clearest evidence that the two verbs are one cut. cs: "
   "decimation, drop supplying the recursive step and first supplying the sample -- and it terminates only "
   "because drop clamps to '() rather than raising."),
  emergent_name="the cyclic shift",
  meta=("The composition is drop with take, in both orders. Appended front-then-back it is the identity; "
   "appended back-then-front it is a rotation. What emerges is the shift family: rotation, circular buffers, "
   "round-robin scheduling and decimation. The cs lane depends on the clamping divergence for its base case, "
   "which is a fair warning -- code that leans on a divergence will not port."),
  l_eng="Guard the skip. Dropping a header that was never there costs you a row and produces no error anywhere.",
  l_math="A rotation is a partition reassembled in the opposite order; seeing it that way makes the group structure of rotations obvious and the implementation one line.",
  l_cs="Recursion that terminates because a verb clamps instead of raising is correct here and broken elsewhere. Write the null? guard even when the clamp would have saved you."),
)

for k in list(R):
    for row in ('row2','row3','row4','row5'):
        d=R[k][row]
        for a,b in (('l_eng','l-eng'),('l_math','l-math'),('l_cs','l-cs'),('emergent_name','emergent-name')):
            if a in d: d[b]=d.pop(a)

if __name__=='__main__': main(R, sys.argv[1:])
