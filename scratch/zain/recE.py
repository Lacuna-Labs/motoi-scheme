# -*- coding: utf-8 -*-
"""list-head, list-set, list-set!, nth. Every :code and row program executed
before its note was written; transcripts in gI.scm gJ.scm gK.scm."""
import sys; sys.path.insert(0,'/Users/alfred/code/motoi-scheme/scratch/zain')
from emit import main
R={}

R['list-head'] = dict(
 name='list-head', std='Motoi-own', tier='core', kind='pure',
 signature='(list-head list k) -> list',
 summary='A new list of the first k elements. Behaves identically to take here, and is NOT a standard name -- the in-code comment claiming it is R7RS is wrong.',
 explanation=(
  "list-head is the MIT Scheme name for the prefix operation, and it is the natural partner of list-tail: "
  "one names the front, the other names the back, and appending them at the same k rebuilds the list. That "
  "symmetry of NAMES is the whole case for having it, because it is not a symmetry of CONTRACTS -- list-tail "
  "raises when you ask it to go past the end, and list-head does not. It is worth being blunt about where "
  "this verb sits on Motoi's conformance ladder. R7RS-small 6.4 defines list-tail, list-ref, list-copy and "
  "list-set!; it does NOT define list-head. SRFI-1 spells the same operation take. So list-head is Motoi-own, "
  "and the comment above its definition in src/base.js calling it 'the R7RS name' is FALSE and has been "
  "reported. Its implementation is byte-for-byte the same slice as take, so every take divergence is a "
  "list-head divergence: overshooting clamps instead of erroring, a negative k clamps to zero, an improper "
  "list answers '(), and the result is always a fresh copy. Prefer take in new code. It is the SRFI-1 name, "
  "it is what other Schemes will recognise, and it is what the rest of this chapter uses. Two neighbouring "
  "jobs get mistaken for this one. For the back half use list-tail, which raises on overshoot. For both "
  "halves at once use split-at."),
 examples=[
  ('novice',
   "(list-head (list 1 2 3 4) 2)",
   "(1 2) -- the first two, in a new list. Exactly what (take (list 1 2 3 4) 2) answers; take is the portable spelling."),
  ('intermediate',
   "(define page (list 'a 'b 'c 'd 'e))\n(display (list 'shown (list-head page 2) 'hidden (list-tail page 2)))\n(newline)",
   "Prints (shown (a b) hidden (c d e)). This pairing -- head and tail at the same k -- is the reason the name exists; the two halves rejoin to the original."),
  ('expert',
   "(display (list 'agree (map (lambda (k) (equal? (list-head (list 1 2 3) k) (take (list 1 2 3) k))) (list 0 1 2 3 9))))\n(newline)",
   "Prints (agree (#t #t #t #t #t)). Identical to take at every k INCLUDING the overshoot at 9, where both quietly answer the whole list. list-tail would have raised there, so the head/tail pairing is symmetric in name and asymmetric in contract."),
 ],
 caveats=[
  "PROVENANCE CORRECTION: list-head is NOT in R7RS-small. R7RS-small 6.4 has list-tail, list-ref, list-copy and list-set!, and no list-head. The comment at src/base.js:661 calling it 'the R7RS name' is false. The name is MIT Scheme's; the operation is SRFI-1's take.",
  "Prefer take. list-head and take have identical implementations here, but take is the name SRFI-1 gives and the one other Schemes will accept.",
  "DIVERGENCE, inherited from take: asking for more than the list has CLAMPS and returns the whole list rather than erroring. (list-head '(1 2) 9) is (1 2).",
  "ASYMMETRY worth knowing: list-head clamps on overshoot and list-tail RAISES on it, even though the names invite you to treat them as a matched pair.",
  "DIVERGENCE, inherited from take: a negative k clamps to 0, and an improper list answers '() rather than its prefix.",
  "The result is always a FRESH list, never shared with the argument. (eq? (list-head xs (length xs)) xs) is #f.",
 ],
 usecases=["Reading MIT-Scheme-derived code that already uses this name.",
           "Pairing with list-tail when the head/tail vocabulary is what the surrounding code speaks.",
           "Truncating a list to a maximum display length."],
 related=["take","list-tail","split-at","drop","list-ref"],
 status='needs-alfred',
 concept="A non-standard alias for the prefix operation, and what a false provenance comment costs.",
 prereq=["take","list-tail","length"],
 progression="Learn take first, because it is the portable name; learn list-head only when you meet it in code, and read the provenance correction before you cite it as standard.",
 provenance=("Motoi-own; the name is MIT Scheme's, the operation is SRFI-1 take. NOT in R7RS-small -- checked "
  "against R7RS-small 6.4, which defines list-tail, list-ref, list-copy and list-set! and no list-head. "
  "Reference record added 2026-08-02, every example executed. Implementation src/base.js:662, identical slice "
  "to take at src/base.js:659. FLAGGED: the source comment at src/base.js:661 states 'list-head is the R7RS "
  "name for take's prefix operation', which is FALSE and should be corrected. Behavioural divergences are "
  "take's, verified 2026-08-02: clamps on overshoot, clamps negative k to 0, answers '() on an improper list."),
 row2=dict(
  eng="(define page (list 'a 'b 'c 'd 'e))\n(display (list 'shown (list-head page 2) 'hidden (list-tail page 2)))\n(newline)",
  math="(display (list 'ladder (map (lambda (k) (list-head (list 1 2 3) k)) (list 0 1 2 3))))\n(newline)",
  cs="(display (list 'exact (list-head (list 1 2) 2) 'over (list-head (list 1 2) 9) 'negative (list-head (list 1 2) -1)\n               'dotted (list-head (cons 1 2) 1)\n               'list-tail-over (guard (e (#t 'raised)) (list-tail (list 1 2) 9))))\n(newline)",
  problem=("The operator is porting a routine from MIT Scheme that splits a page with list-head and list-tail "
   "and needs to know whether the pair still behaves as one cut. Candidates: keep both names (reads the same, "
   "but the two halves now have different overshoot contracts), move both to take and drop (uniform clamping, "
   "SRFI-1 names, and the overshoot becomes silent on BOTH sides), or move to take and list-tail (the front "
   "clamps, the back raises -- deliberate asymmetry, and the one to pick when a short page is a bug)."),
  explanation=("eng: the head/tail pairing at one k, which is the idiom being ported. math: the prefix ladder, "
   "identical to take's. cs: the boundary row, ending with the list-tail contrast that shows the pairing is "
   "not symmetric in its failure behaviour."),
  meta=("Why the cs row ends on list-tail: this record exists mostly to correct a provenance claim and to warn "
   "about a name pairing that promises more symmetry than it delivers."),
  l_eng="Two verbs whose names form a pair are not thereby a matched pair. Check the failure behaviour of both before relying on the symmetry.",
  l_math="Prefix and suffix at the same index partition a sequence; the partition law holds here even where one half would have raised.",
  l_cs="A comment asserting a standard is a claim, and claims decay. Cite the section, or do not cite."),
 row3=dict(
  setup="Keep the front portion of an ordered collection under the name that pairs with list-tail.",
  rungs=[("list","(display (list-head (list 1 2 3 4) 2))\n(newline)"),
         ("tearing off the top copy of a duplicate docket and leaving the rest of the pad",
          "(define pad (list 'copy1 'copy2 'copy3))\n(display (list 'torn (list-head pad 1) 'pad-left (list-tail pad 1)))\n(newline)"),
         ("naming the initial segment a0..a(k-1) of a sequence",
          "(display (list 'initial-segment (list-head (list 5 8 13 21) 2)))\n(newline)")],
  explanation=("In list, list-head slices a prefix. Tearing the top copy off a docket pad is the same act: the "
   "pad is ordered, the tear line comes from outside the data, and what stays on the pad is exactly the "
   "complement. In mathematics it is the initial segment a0..a(k-1), the standard object in every induction "
   "over a finite prefix. All three share: an order, an externally chosen cut, and two complementary halves."),
  meta=("The docket pad is honest about the copy. You get a NEW list; writing on the torn sheet does not write "
   "on the pad, which is not what MIT Scheme's cell-sharing version would have given you."),
  l_eng="When you port a name, port its contract too, or write down where the contract changed.",
  l_math="An initial segment is determined by its length alone, which is why k and not a predicate is the right argument here.",
  l_cs="Related patterns: list-head in MIT Scheme, take in SRFI-1 and Haskell, xs[:k] in Python. One operation, four names, and only one of them is standard in this language."),
 row4=dict(
  eng="(display (list 'agree (map (lambda (k) (equal? (list-head (list 1 2 3) k) (take (list 1 2 3) k))) (list 0 1 2 3 9))))\n(newline)",
  math="(display (list 'rejoins (let ((xs (list 1 2 3))) (equal? xs (append (list-head xs 1) (list-tail xs 1))))))\n(newline)",
  cs="(display (list 'copy-not-alias (eq? (list-head (list 1 2 3) 3) (list 1 2 3))))\n(newline)",
  claim=("list-head is behaviourally indistinguishable from take at every k, including the overshoot that "
   "SRFI-1 calls an error. At any k the list-tail complement rejoins it to the original, and the result is "
   "always a fresh list rather than an alias."),
  invariant="For all lists xs and k >= 0. list-head(xs,k) = take(xs,k); and for k <= length(xs), append(list-head(xs,k), list-tail(xs,k)) = xs; and list-head(xs,k) is never eq? to xs",
  meta=("The pattern is an alias claim proved across the argument range plus one value beyond it, which is "
   "what makes it a claim about the CONTRACT and not just about the common cases. What would falsify it: any k "
   "where the two disagree. The value 9 is the one that matters, because it is the value at which SRFI-1 says "
   "both should have raised."),
  l_eng="Prove an alias across the whole range including the illegal part. Two verbs that agree on legal input and differ on illegal input are not aliases.",
  l_math="The rejoin law is restricted to k <= length here because list-tail's domain is, even though list-head's is not; a law is only as wide as its narrowest term.",
  l_cs="If two names are exact aliases, delete one or document which is preferred. Leaving both undocumented guarantees a codebase that uses both at random."),
 row5=dict(
  eng="(define (truncate-for-display xs cap)\n  (if (> (length xs) cap) (list-head xs cap) xs))\n(display (list (truncate-for-display (list 1 2 3 4) 2) (truncate-for-display (list 1) 2)))\n(newline)",
  math="(define (initial-segments xs)\n  (map (lambda (k) (list-head xs k)) (range 0 (+ 1 (length xs)))))\n(display (initial-segments (list 1 2 3)))\n(newline)",
  cs="(define (split-here xs k) (list (list-head xs k) (list-tail xs k)))\n(display (split-here (list 1 2 3 4) 2))\n(newline)",
  base="list-head returns a fresh list of the first k elements.",
  emergent=("eng: a guarded truncation, with the length test the verb does not perform. math: the full chain of "
   "initial segments built by mapping list-head over every k -- the prefix lattice, which is the object every "
   "prefix-based induction quantifies over. cs: a hand-rolled split, list-head and list-tail returned together, "
   "which is what split-at already does in one call and one traversal."),
  emergent_name="the prefix chain",
  meta=("The composition is list-head over a range of k. What emerges is the prefix-chain family: running "
   "totals, autocomplete candidates, incremental parsers and any algorithm that consumes a sequence "
   "left to right. The cs lane is the argument for split-at -- if you want both halves, ask for both halves."),
  l_eng="Cap a display list explicitly. A truncation the reader cannot see is a lie the reader cannot detect.",
  l_math="The prefix chain is totally ordered by inclusion, which is exactly why induction over prefixes works and induction over arbitrary subsets does not.",
  l_cs="Computing both halves with two calls traverses twice and can go out of sync. Use the verb that returns both."),
)

R['list-set'] = dict(
 name='list-set', std='Motoi-own', tier='core', kind='pure',
 signature='(list-set list i obj) -> list',
 summary='A NEW list with element i replaced. The original is untouched. Out-of-range is a silent no-op, not an error.',
 explanation=(
  "list-set is the copying counterpart of list-set!, and the bang is the only thing that distinguishes their "
  "names from a value that could not be more different: list-set! changes the list every holder can see, and "
  "list-set changes nothing and hands you a new list. For almost all code in this reference the copying "
  "version is the one to reach for, because a fresh list cannot surprise a caller who was never consulted. "
  "This verb is Motoi-own. R7RS-small 6.4 defines list-set! and nothing without the bang; SRFI-1 has neither. "
  "Its contract here is total -- there is no input on which it raises. An index past the end returns the list "
  "unchanged, a negative index returns the list unchanged, and a non-list argument is returned as it was: "
  "(list-set 5 0 'x) is 5 and (list-set \"ab\" 0 'x) is \"ab\". That totality is a design choice with a cost. "
  "A misindexed update produces a correct-looking list that is simply missing the change, and nothing in the "
  "program says so. If the index is meant to be valid, check it against length and raise yourself. Two "
  "neighbouring jobs get mistaken for this one. To change the list in place use list-set!. To change the FIRST "
  "element specifically use set-car!."),
 examples=[
  ('novice',
   "(list-set (list 1 2 3) 1 99)",
   "(1 99 3) -- a new list. Evaluate the original again and it is still (1 2 3)."),
  ('intermediate',
   "(define board (list 'empty 'empty 'empty))\n(define moved (list-set board 1 'x))\n(display (list 'before board 'after moved))\n(newline)",
   "Prints (before (empty empty empty) after (empty x empty)). Two lists now exist. This is the whole reason to prefer list-set: the previous position is still available, which is what makes undo and history free."),
  ('expert',
   "(display (list 'over (list-set (list 1 2 3) 9 'FAR) 'negative (list-set (list 1 2 3) -1 'NEG)\n               'number (list-set 5 0 'x) 'string (list-set \"ab\" 0 'x)))\n(newline)",
   "Prints (over (1 2 3) negative (1 2 3) number 5 string ab). Not one of these raises and not one of them applies the update. A bad index or a bad argument gives you back something that looks entirely healthy, so validate the index before the call if it matters."),
 ],
 caveats=[
  "Out-of-range is a SILENT NO-OP. (list-set '(1 2 3) 9 'x) returns (1 2 3) unchanged, with no error. A misindexed update is invisible; compare against length before calling if the index is load-bearing.",
  "A negative index is also a silent no-op.",
  "A non-list argument is returned UNCHANGED rather than raising: (list-set 5 0 'x) is 5, (list-set \"ab\" 0 'x) is \"ab\", and a cons-built dotted pair comes back as itself. The verb never raises on any input.",
  "It is Motoi-own. R7RS-small 6.4 defines list-set! only; there is no standard list-set. Code using it will not port.",
  "The original is never modified and the result is never eq? to it. That is the point of the verb; if you wanted the holders of the original to see the change, you wanted list-set!.",
  "The whole list is copied on every call, so building a list by repeated list-set is quadratic. Build with map, or use a vector.",
 ],
 usecases=["Updating one cell of a game board while keeping the previous position for undo.",
           "Producing a changed configuration without disturbing the one other code is holding.",
           "Generating every one-position variation of a list by mapping over its indices."],
 related=["list-set!","set-car!","list-ref","map","list-copy","vector-set!"],
 status='needs-alfred',
 concept="Functional update: producing a changed copy rather than changing the thing.",
 prereq=["list","list-ref","map"],
 progression="Learn list-ref so indices mean something, then list-set, then list-set! -- in that order, so that the copying version is the habit and the mutating one is the exception.",
 provenance=("Motoi-own. NOT in R7RS-small -- 6.4 defines list-set! and nothing without the bang -- and not in "
  "SRFI-1. Reference record added 2026-08-02, every example executed. Implementation src/base.js:1136: copies "
  "with slice, writes only when 0 <= i < length, and returns a non-list argument unchanged. FLAGGED for "
  "review, not as a standards divergence but as a design hazard verified 2026-08-02: the verb is TOTAL. An "
  "out-of-range index, a negative index, a number, a string and a dotted pair all return successfully with the "
  "update silently not applied, so a misindexed call is indistinguishable from a correct one."),
 row2=dict(
  eng="(define board (list 'empty 'empty 'empty))\n(define moved (list-set board 1 'x))\n(display (list 'before board 'after moved))\n(newline)",
  math="(define (update-all xs v) (map (lambda (i) (list-set xs i v)) (list 0 1 2)))\n(display (update-all (list 'a 'b 'c) 'Z))\n(newline)",
  cs="(display (list 'over (list-set (list 1 2 3) 9 'FAR) 'negative (list-set (list 1 2 3) -1 'NEG)\n               'number (list-set 5 0 'x) 'string (list-set \"ab\" 0 'x) 'empty (list-set '() 0 'x)))\n(newline)",
  problem=("The operator needs one square of a game board changed while the previous position stays available "
   "for undo. Candidates: list-set (a new board, the old one intact, and undo is free because the old board "
   "still exists), list-set! (one board, changed in place, and undo now needs a separate record of what was "
   "there), and rebuilding with map and an index test (same result as list-set, more code, and the index test "
   "is explicit -- which given list-set's silent no-op is an argument in its favour)."),
  explanation=("eng: one move on a board, with both positions printed so the reader can see two lists exist. "
   "math: every one-position variation at once, which is the neighbourhood of a point in a search space. cs: "
   "five inputs that should not all succeed, and all five do."),
  meta=("Why the cs row is five cases: this verb has no failure mode at all, so the only way to show its "
   "contract is to exhibit the inputs on which a raise would have been reasonable and did not happen."),
  l_eng="Prefer the copying update. Undo, history and time-travel debugging are free consequences of never destroying the previous value.",
  l_math="A one-position variation is a neighbour in Hamming distance; generating all of them is the move-generation step of every local search.",
  l_cs="A total function that swallows bad input is not safer than one that raises -- it moves the failure from the call site to somewhere unrelated and much later."),
 row3=dict(
  setup="Produce a version of an ordered collection that differs in exactly one place, without disturbing the original.",
  rungs=[("list","(display (list-set (list 1 2 3) 1 99))\n(newline)"),
         ("photocopying a form and correcting one field on the copy",
          "(define form (list 'name 'blank 'city))\n(define corrected (list-set form 1 'thirty))\n(display (list 'original form 'copy corrected))\n(newline)"),
         ("defining a sequence b that agrees with a everywhere except at index i",
          "(define a (list 5 8 13))\n(define b (list-set a 1 0))\n(display (list 'a a 'b b))\n(newline)")],
  explanation=("In list, list-set copies and writes one slot. Photocopying a form and correcting a field on the "
   "copy is the same act: the filed original still says what it said, the copy differs in one place, and "
   "anybody holding the original is unaffected. In mathematics it is defining b to agree with a except at "
   "index i, the standard way to specify a perturbed sequence. All three share: an original that survives, a "
   "difference confined to one position, and two values where there was one."),
  meta=("The photocopy carries the cost too. Copying a whole form to change one field is wasteful if you do it "
   "in a loop -- and doing it in a loop is exactly what makes list-set quadratic."),
  l_eng="If somebody may still need the old value, do not overwrite it. Storage is cheap; a lost previous state is not recoverable.",
  l_math="Specifying a function as 'agrees with f except at x' is the cleanest way to define a perturbation, and it composes: two such updates commute when the indices differ.",
  l_cs="Related patterns: persistent update in Clojure and Scala, immutable.js set, and the copy-on-write that most functional data structures do behind the scenes -- all trading a copy for the ability to keep the past."),
 row4=dict(
  eng="(display (list 'original-intact (let* ((xs (list 1 2 3)) (ys (list-set xs 1 99))) (list 'xs xs 'ys ys 'same (eq? xs ys)))))\n(newline)",
  math="(define (one-diff? a b i)\n  (and (= (length a) (length b))\n       (equal? (list-ref b i) 'Z)\n       (equal? (append (list-head a i) (list-tail a (+ i 1)))\n               (append (list-head b i) (list-tail b (+ i 1))))))\n(display (map (lambda (i) (one-diff? (list 'a 'b 'c) (list-set (list 'a 'b 'c) i 'Z) i)) (list 0 1 2)))\n(newline)",
  cs="(display (list 'no-op-over (equal? (list-set (list 1 2 3) 9 'x) (list 1 2 3))\n               'no-op-neg (equal? (list-set (list 1 2 3) -1 'x) (list 1 2 3))\n               'raises (guard (e (#t 'raised)) (list-set (list 1 2 3) 9 'x))))\n(newline)",
  claim=("list-set changes exactly one position and nothing else: the length is preserved, every other element "
   "is unchanged, the original list is untouched, and the result is never eq? to it. When the index is out of "
   "range it changes NOTHING and still returns successfully."),
  invariant="For all lists xs, indices i and objects v. length(list-set(xs,i,v)) = length(xs); the result differs from xs at index i only when 0 <= i < length(xs), and is equal? to xs otherwise; xs is never modified and is never eq? to the result",
  meta=("The pattern is a functional update proved by what it left alone, at every index, with the "
   "out-of-range case proved to be a successful no-op rather than a raise. What would falsify it: a changed "
   "length, a changed neighbour, a mutated original, or an out-of-range call that raised. The last field of "
   "the cs program is the evidence for the :status flag -- it asks for a raise and gets a value."),
  l_eng="Prove that an update left the neighbours alone. Off-by-one damage always shows up next door, not at the index you were watching.",
  l_math="Agreeing everywhere except one point is a strong specification: it determines the result completely given the original and the new value.",
  l_cs="A guard expression that returns the value instead of 'raised is the most compact way to record 'this did not fail, and it should have'."),
 row5=dict(
  eng="(define (place board i mark)\n  (if (and (>= i 0) (< i (length board)))\n      (list-set board i mark)\n      (error \"square out of range\" i)))\n(display (list (place (list '- '- '-) 1 'x)\n               (guard (e (#t 'rejected)) (place (list '- '- '-) 9 'x))))\n(newline)",
  math="(define (neighbours xs alt)\n  (map (lambda (i) (list-set xs i alt)) (range 0 (length xs))))\n(display (neighbours (list 0 0 0) 1))\n(newline)",
  cs="(define (history-of moves start)\n  (let loop ((ms moves) (state start) (acc (list start)))\n    (if (null? ms) (reverse acc)\n        (let ((next (list-set state (first (first ms)) (last (first ms)))))\n          (loop (drop ms 1) next (cons next acc))))))\n(display (history-of (list (list 0 'x) (list 2 'o)) (list '- '- '-)))\n(newline)",
  base="list-set returns a copy of a list with one element replaced.",
  emergent=("eng: a validated placement -- list-set wrapped in the range check the verb does not perform, which "
   "converts the silent no-op into a refusal and is the wrapper every use of this verb should have. math: the "
   "neighbourhood of a point, every one-position variation generated at once, which is the move generator of "
   "local search and the perturbation set of a Hamming ball. cs: a full move history, where because each "
   "update copies, every intermediate state SURVIVES and the whole game is available afterwards."),
  emergent_name="the persistent history",
  meta=("The composition is list-set applied repeatedly. What emerges is the persistent-history family: undo "
   "stacks, replay, time-travel debugging and version chains all come free from an update that copies. The eng "
   "lane is the one to copy verbatim -- the silent no-op is this verb's one real hazard, and one wrapper "
   "removes it."),
  l_eng="Wrap a total verb in the validation it lacks, once, and name the wrapper. Otherwise every call site is a place the check could be missing.",
  l_math="The set of one-position variations is a Hamming ball of radius one; search algorithms are largely a policy for choosing which neighbour to visit.",
  l_cs="Persistence is not a feature you add; it is what you get for free when updates copy. The cost is memory, and it buys you the entire past."),
)

R['list-set!'] = dict(
 name='list-set!', std='R7RS-small', tier='core', kind='state-change',
 signature='(list-set! list k obj) -> unspecified',
 summary='Replace element k of a list IN PLACE. R7RS says k must be a valid index; Motoi does not check, and an out-of-range k GROWS the list instead.',
 explanation=(
  "R7RS-small 6.4 defines list-set! as the indexed mutator: it stores obj into position k of an existing list "
  "so that everyone holding that list sees the change, and it says plainly that it is an error if k is not a "
  "valid index. In Motoi it is also the verb that reaches PAST the first cell. set-car! can only touch the "
  "front of a proper list, because cdr of a proper list here returns a fresh copy and mutation through it is "
  "discarded -- so list-set! is the only working way to change element 1, 2 or 3 of a list in place. That "
  "makes it more important here than in most Schemes. It is also less safe. The index is never validated. A "
  "k past the end does not raise: it GROWS the list, filling the gap with truthy non-values, so "
  "(list-set! (list 'p 'q 'r) 6 'FAR) leaves a list of length seven with three holes that are neither null "
  "nor false. A fractional k is truncated toward zero, so 1.7 writes position 1. A negative k is silently "
  "ignored. And a list that came from a QUOTED literal is mutable and stays mutated -- writing into a '() "
  "literal produces a one-element list at that site whose null? is now #f, permanently. Compare vector-set!, "
  "which raises on an out-of-range index. Two neighbouring jobs get mistaken for this one. For a copy use "
  "list-set. For the first element only, set-car! reads better."),
 examples=[
  ('novice',
   "(define grid (list 0 0 0 0))\n(list-set! grid 2 'X)\n(display grid)\n(newline)",
   "Prints (0 0 X 0). The same list, changed. Nothing was rebuilt and nothing was rebound."),
  ('intermediate',
   "(define xs (list 1 2 3))\n(define alias xs)\n(list-set! xs 0 'A)\n(display (list 'xs xs 'alias alias 'eq (eq? xs alias)))\n(newline)",
   "Prints (xs (A 2 3) alias (A 2 3) eq #t). One write, two names. This is the entire reason to mutate, and the entire reason a mutated list should not cross a boundary you do not own."),
  ('expert',
   "(define xs (list 'p 'q 'r))\n(list-set! xs 6 'FAR)\n(display (list 'len (length xs) 'hole-null (null? (list-ref xs 4)) 'hole-truthy (if (list-ref xs 4) 'truthy 'false)))\n(newline)",
   "Prints (len 7 hole-null #f hole-truthy truthy). The list GREW from 3 to 7. R7RS-small 6.4 says an invalid index is an error; here it silently extends the list and fills the gap with truthy non-values -- objects that are not null, not false, and pass every guard you would think to write."),
 ],
 caveats=[
  "DIVERGENCE from R7RS-small 6.4: an out-of-range k does not raise. It GROWS the list, padding with truthy non-values. (list-set! (list 'p 'q 'r) 6 'FAR) leaves length 7 with three holes that are neither null nor false. vector-set! raises on the same mistake; this does not.",
  "DIVERGENCE: (list-set! '() 0 'x) succeeds and turns that empty list into a one-element list. If the '() came from a quoted literal, the literal STAYS mutated -- a later evaluation at that site returns (x) and null? on it is #f. This can silently defeat every empty-list guard downstream. Never mutate anything you did not build with list or cons.",
  "A fractional index is truncated toward zero: (list-set! xs 1.7 'F) writes position 1 with no complaint.",
  "A negative index is silently ignored -- the list is unchanged and nothing is reported.",
  "It raises on a non-list and on a cons-built dotted pair, naming itself in the message. Those are the only two inputs it refuses.",
  "It returns a non-value: it prints as nothing and is TRUE in an if. Sequence it, never test it.",
  "In Motoi this is the ONLY way to mutate a list element past the first. set-car! reaches the front cell only, because cdr of a proper list returns a fresh copy.",
 ],
 usecases=["Changing an element other than the first of a shared list, which set-car! cannot do here.",
           "Filling a preallocated list of slots inside a loop.",
           "Swapping two elements in place with a temporary."],
 related=["list-set","set-car!","set-cdr!","vector-set!","list-ref"],
 status='needs-alfred',
 concept="Indexed in-place mutation, and what happens when nobody checks the index.",
 prereq=["list-ref","list","eq?"],
 progression="Learn list-ref, then list-set for the safe version, then list-set! -- and read the growth caveat before using an index you did not compute yourself.",
 provenance=("R7RS-small 6.4 (list-set!); reference record added 2026-08-02, every example executed. "
  "Implementation lib/base/r7rs-small.js:514: raises when the argument is not a JS array, then writes "
  "lst[k|0] = v with no bounds check. FLAGGED, four divergences verified 2026-08-02: (1) an out-of-range k "
  "GROWS the list and pads with truthy non-values where R7RS-small 6.4 says an invalid index is an error, and "
  "where the sibling vector-set! raises; (2) (list-set! '() 0 'x) succeeds, and when the '() is a quoted "
  "literal the mutation PERSISTS at that site so null? there becomes #f, which R7RS-small 4.1.2 calls an "
  "error; (3) a fractional k is truncated by |0 with no complaint; (4) a negative k is silently ignored."),
 row2=dict(
  eng="(define slots (list 'idle 'idle 'idle))\n(list-set! slots 1 'busy)\n(display (list 'slots slots))\n(newline)",
  math="(define (fill! xs v) (let loop ((i 0)) (if (< i (length xs)) (begin (list-set! xs i v) (loop (+ i 1))) xs)))\n(display (fill! (list 1 2 3) '-))\n(newline)",
  cs="(display (list 'grows (let ((xs (list 1 2 3))) (list-set! xs 6 'FAR) (length xs))\n               'negative-ignored (let ((xs (list 1 2 3))) (list-set! xs -1 'N) xs)\n               'fraction (let ((xs (list 1 2 3))) (list-set! xs 1.7 'F) xs)\n               'vector-set-raises (guard (e (#t 'raised)) (let ((v (vector 1 2 3))) (vector-set! v 9 'x) v))))\n(newline)",
  problem=("The operator has a fixed set of worker slots held by several parts of a scheduler and needs slot 1 "
   "marked busy so all of them see it. Candidates: list-set! (one list, everybody sees it, and the index is "
   "unchecked), set-car! (cannot reach slot 1 at all here -- it would mutate a discarded copy and report "
   "nothing), and list-set with a rebind (a new list, so the other holders keep the stale one). When shared "
   "visibility past the first element is the requirement, list-set! is the only verb that does it."),
  explanation=("eng: marking one slot of a shared table. math: filling every position by index, the loop shape "
   "this verb exists for. cs: four boundary cases -- the growth, the ignored negative, the truncated fraction, "
   "and vector-set! raising on the very mistake list-set! absorbs."),
  meta=("Why vector-set! is in the cs row: it is the same operation on the sibling type in the same language, "
   "and it raises. The contrast is the clearest possible statement that the growth is a defect and not a style."),
  l_eng="An index that came from arithmetic is an index you have not validated. Validate it where it is computed, because this verb never will.",
  l_math="A total function on indices is not a kindness when the index space is bounded; it erases the distinction between a valid position and a mistake.",
  l_cs="When two sibling types disagree about whether an out-of-range write is an error, one of them is wrong. Here the vector is right."),
 row3=dict(
  setup="Change one numbered position of a thing that already exists, in place, so everyone looking at it sees the change.",
  rungs=[("list","(define xs (list 1 2 3))\n(list-set! xs 1 99)\n(display xs)\n(newline)"),
         ("writing a new number into one numbered box on a shared parts shelf",
          "(define shelf (list 'bolts 'nuts 'washers))\n(define stocktaker shelf)\n(list-set! shelf 1 'NUTS-M6)\n(display (list 'shelf shelf 'stocktaker stocktaker))\n(newline)"),
         ("assigning to a component of a mutable indexed family, as against defining a new family",
          "(define fam (list 0 0 0))\n(list-set! fam 2 7)\n(display (list 'fam fam))\n(newline)")],
  explanation=("In list, list-set! writes position k. Relabelling one numbered box on a shared parts shelf is "
   "the same act: there is one shelf, the stocktaker walking past reads the new label, and nobody had to be "
   "handed a new shelf. In mathematics it is assignment to a component of a mutable indexed family, which is a "
   "different operation from defining a new family that happens to differ at k. All three share: one object, "
   "one numbered position, and an audience that was not notified."),
  meta=("The shelf is honest about the growth too. Asking for box 6 on a three-box shelf should be a question "
   "the shelf refuses; here it grows three empty boxes and answers as though nothing happened."),
  l_eng="Shared mutable state must be written down as a design decision, because it cannot be inferred from any single call site.",
  l_math="A mutable indexed family is not a function; equality over it is not stable in time, so proofs about it need a state parameter.",
  l_cs="Related patterns: lst[i] = x in Python, arr[i] = x in JS (which also grows), and vector-set! right here (which does not). The JS behaviour is where this divergence came from."),
 row4=dict(
  eng="(define xs (list 1 2 3))\n(define alias xs)\n(list-set! xs 1 99)\n(display (list 'through-alias alias 'eq (eq? xs alias) 'length (length xs)))\n(newline)",
  math="(define (set-then-read i)\n  (let ((xs (list 'a 'b 'c)))\n    (list-set! xs i 'W)\n    (list-ref xs i)))\n(display (map set-then-read (list 0 1 2)))\n(newline)",
  cs="(display (list 'in-range (let ((xs (list 1 2 3))) (list-set! xs 1 'V) (length xs))\n               'out-of-range (let ((xs (list 1 2 3))) (list-set! xs 6 'V) (length xs))\n               'r7rs-says 'error))\n(newline)",
  claim=("For a valid index, list-set! writes position k and changes nothing else: the length is unchanged, "
   "the identity is unchanged, and a subsequent list-ref at k reads the new value through every alias. For an "
   "INVALID index the length changes, which is the observable signature of the divergence."),
  invariant="For all lists xs and valid indices k. after list-set!(xs,k,v): list-ref(xs,k) = v, length(xs) is unchanged, and xs is eq? to its former self. For k >= length(xs), length(xs) becomes k+1 -- where R7RS-small 6.4 requires k to be a valid index",
  meta=("The pattern is a mutator proved by its invariant and then shown to break that invariant outside its "
   "contract. What would falsify the positive half: a changed length in range, or a write invisible through an "
   "alias. The cs program is the evidence for the :status flag: two lengths from the same starting list, and "
   "only one of them is defensible."),
  l_eng="Assert the length before and after a mutation. Length is the cheapest invariant there is and it catches the entire class of growth bugs.",
  l_math="An operation that changes the domain of an indexed family is a different operation from one that changes its values; conflating them loses the type.",
  l_cs="Silent growth is worse than a crash and worse than a no-op: the data structure is now a shape nothing downstream was written to handle."),
 row5=dict(
  eng="(define (swap! xs i j) (let ((t (list-ref xs i))) (list-set! xs i (list-ref xs j)) (list-set! xs j t) xs))\n(display (swap! (list 'a 'b 'c) 0 2))\n(newline)",
  math="(define (safe-set! xs i v)\n  (if (and (>= i 0) (< i (length xs)))\n      (begin (list-set! xs i v) xs)\n      (error \"index out of range\" i)))\n(display (list (safe-set! (list 1 2 3) 1 'V)\n               (guard (e (#t 'rejected)) (safe-set! (list 1 2 3) 9 'V))))\n(newline)",
  cs="(define (tally! counts i) (list-set! counts i (+ 1 (list-ref counts i))) counts)\n(define c (list 0 0 0))\n(tally! c 1)\n(tally! c 1)\n(tally! c 2)\n(display c)\n(newline)",
  base="list-set! writes one indexed position of an existing list in place.",
  emergent=("eng: an in-place swap, the smallest program that mutation makes shorter than rebuilding, and the "
   "primitive underneath every in-place sort. math: a bounds-checked wrapper that restores the R7RS contract "
   "the implementation dropped -- this is the version to use, not the bare verb. cs: a tally, read-modify-write "
   "at an index, which is the counting-sort and histogram pattern and the reason indexed mutation exists at all."),
  emergent_name="the indexed accumulator",
  meta=("The composition is list-set! plus list-ref at the same index. What emerges is the indexed-accumulator "
   "family: histograms, counting sort, sieves, dynamic-programming tables and in-place permutations. The math "
   "lane is the mandatory one -- a bare list-set! with a computed index is a silent list-growth waiting to "
   "happen, and one wrapper removes the whole class."),
  l_eng="Write the bounds check once, in a wrapper, and never call the bare verb. A check repeated at ten sites will be missing from the eleventh.",
  l_math="Read-modify-write at an index is the whole of counting; the algorithms differ only in what the index is computed from.",
  l_cs="When an implementation drops a contract the standard requires, restore it in a wrapper and name the wrapper after the contract, not after the verb."),
)

R['nth'] = dict(
 name='nth', std='Motoi-own', tier='core', kind='pure',
 signature='(nth list i) -> obj',
 summary='The element at index i. Motoi-own; unlike list-ref it does not raise when the index is out of range -- it hands back a truthy non-value.',
 explanation=(
  "nth reads an element by position, which is exactly what R7RS-small's list-ref does, under a name borrowed "
  "from Common Lisp. Two things about that borrowing are worth stating. First, Common Lisp's nth takes the "
  "INDEX FIRST -- (nth 1 list) -- and Motoi's takes the LIST first, so code copied from a Lisp reference will "
  "compile here and read the wrong argument. Second, Common Lisp's nth returns NIL past the end, which is "
  "false there; Motoi returns a non-value, which is TRUE here, so the defensive idiom that works in Lisp "
  "silently fails in Motoi. The conformance ladder says use the standard name when there is one, and there "
  "is: list-ref is R7RS-small 6.4, it takes the same arguments in the same order, and it RAISES on an "
  "out-of-range index with a message naming the length and the valid range. That difference is the whole "
  "reason to prefer it. nth's out-of-range answer is an object that prints as nothing, is not null, is not "
  "false, and passes every guard a reader would think to write, so a bad index becomes a wrong answer far "
  "away instead of an error here. Use nth only when reading code that already does. Two neighbouring jobs get "
  "mistaken for this one. For the front element use first. To find the index of a value use list-index."),
 examples=[
  ('novice',
   "(nth (list 'a 'b 'c) 1)",
   "b -- index 1 is the SECOND element. Indices start at zero, and (list-ref (list 'a 'b 'c) 1) answers the same thing."),
  ('intermediate',
   "(define (col table i) (map (lambda (r) (nth r i)) table))\n(display (col (list (list 1 2) (list 3 4) (list 5 6)) 1))\n(newline)",
   "Prints (2 4 6). Reading one column out of a list of rows is the honest use of an index-taking accessor: the index is the same for every row, so it deserves a name."),
  ('expert',
   "(display (list 'over (if (nth (list 1 2) 9) 'truthy-NON-VALUE 'false)\n               'negative (if (nth (list 1 2) -1) 'truthy-NON-VALUE 'false)\n               'list-ref-over (guard (e (#t 'raised)) (list-ref (list 1 2) 9))))\n(newline)",
   "Prints (over truthy-NON-VALUE negative truthy-NON-VALUE list-ref-over raised). Same job, same arguments, opposite contracts. list-ref tells you the index was wrong; nth hands you something that will pass an if and fail somewhere else."),
 ],
 caveats=[
  "DIVERGENCE in spirit from the conformance ladder: this duplicates R7RS-small 6.4's list-ref under a non-standard name and a weaker contract. Prefer list-ref.",
  "An out-of-range index does NOT raise. It returns a non-value that prints as nothing, is not null?, is not #f, and is TRUE in an if. list-ref raises on the same input with a message naming the valid range.",
  "A negative index does the same -- a truthy non-value, no error.",
  "ARGUMENT ORDER TRAP: Common Lisp's nth is (nth index list). Motoi's is (nth list index). Code copied from a Lisp reference will read the arguments backwards and, because both arguments are often integers in test data, may not fail visibly.",
  "Common Lisp's nth returns NIL past the end, which is FALSE there. Motoi's returns a truthy non-value, so the standard Lisp defensive idiom (if (nth ...) ...) is inverted here.",
  "It accepts a STRING and returns a one-character string at that index. list-ref does not.",
  "On a cons-built dotted pair it returns a truthy non-value rather than the car.",
 ],
 usecases=["Reading a column out of a list of equal-length rows.",
           "Reading code ported from Common Lisp that already uses this name.",
           "Positional field access where the position has a name in the domain."],
 related=["list-ref","first","last","list-index","list-tail","vector-ref"],
 status='needs-alfred',
 concept="Indexed read, and what a missing bounds check costs when the failure value is truthy.",
 prereq=["list","list-ref","first"],
 progression="Learn list-ref first and keep using it; learn nth only so you can recognise it in ported code, and read the out-of-range caveat before you trust its answer.",
 provenance=("Motoi-own; the name is Common Lisp's, the operation is R7RS-small 6.4 list-ref. Reference record "
  "added 2026-08-02, every example executed. Implementation src/base.js:698, a bare index (a, i) => a[i] with "
  "no bounds check. FLAGGED, verified 2026-08-02: (1) an out-of-range or negative index returns a TRUTHY "
  "non-value where the standard sibling list-ref raises with a range message; (2) the argument order is "
  "reversed from Common Lisp's nth, which is (nth index list); (3) it accepts a string and returns a "
  "one-character string; (4) it returns a truthy non-value on a cons-built dotted pair. Per the conformance "
  "ladder this duplicates a standard verb under a divergent name and a weaker contract."),
 row2=dict(
  eng="(define row (list 'name 'age 'city))\n(display (list 'field1 (nth row 1)))\n(newline)",
  math="(define (col table i) (map (lambda (r) (nth r i)) table))\n(display (col (list (list 1 2) (list 3 4) (list 5 6)) 1))\n(newline)",
  cs="(display (list 'in-range (nth (list 1 2) 1)\n               'over (if (nth (list 1 2) 9) 'truthy-NON-VALUE 'false)\n               'negative (if (nth (list 1 2) -1) 'truthy-NON-VALUE 'false)\n               'list-ref-over (guard (e (#t 'raised)) (list-ref (list 1 2) 9))))\n(newline)",
  problem=("The operator is reading a fixed-layout record and needs field 1. Candidates: nth (short, "
   "non-standard, and silent when the record is shorter than expected), list-ref (identical arguments, R7RS "
   "name, and raises with the valid range when the record is short), and second from SRFI-1's ordinal family "
   "(reads best when the position has a fixed meaning, and shares nth's silence). Short records are the whole "
   "risk here, and only list-ref reports one."),
  explanation=("eng: one positional field read. math: the same index applied across every row, which turns an "
   "index into a column and is the one use that justifies the verb. cs: the contract row -- in range, past the "
   "end, negative, and list-ref raising on the input nth absorbs."),
  meta=("Why list-ref appears in nth's own cs row: the two are the same operation, and the only interesting "
   "fact about nth is that it is the weaker of the pair."),
  l_eng="A record read by index needs a length check somewhere. If the accessor does not do it, the parser must.",
  l_math="Applying one index across a family of sequences is projection; naming it as such is clearer than calling it an index read.",
  l_cs="Between two verbs that compute the same value, choose the one that fails loudly. The value is identical; the debugging is not."),
 row3=dict(
  setup="Read the item at a numbered position of an ordered collection.",
  rungs=[("list","(display (nth (list 'a 'b 'c) 1))\n(newline)"),
         ("reading the value off a numbered gauge on a panel",
          "(define panel (list 'temp 'pressure 'flow))\n(display (list 'gauge-2 (nth panel 2)))\n(newline)"),
         ("evaluating a finite sequence at index i",
          "(define a (list 5 8 13 21))\n(display (list 'a2 (nth a 2)))\n(newline)")],
  explanation=("In list, nth indexes a position. Reading a numbered gauge on a panel is the same act: the "
   "panel's layout is fixed, the number is how you refer to a gauge, and reading it changes nothing. In "
   "mathematics it is evaluating a finite sequence at index i. All three share: a fixed layout, a number that "
   "means a place rather than a quantity, and a read that consumes nothing."),
  meta=("The panel carries the hazard too. Asking for gauge 9 on a three-gauge panel should be an error; nth "
   "hands you a blank that reads as present, which on a real panel is the worst possible failure."),
  l_eng="A numbered position is only meaningful against a documented layout. Write the layout down next to the reads.",
  l_math="Indexing is function application on a finite domain; asking outside the domain is not a value, it is a category error.",
  l_cs="Related patterns: nth in Common Lisp (index first, NIL past the end), xs[i] in Python (raises), and Rust's get returning Option. Four contracts, and Motoi's is the only one whose failure value is true."),
 row4=dict(
  eng="(display (list 'agrees-with-list-ref (map (lambda (i) (equal? (nth (list 'x 'y 'z) i) (list-ref (list 'x 'y 'z) i))) (list 0 1 2))))\n(newline)",
  math="(display (list 'nth0=first (equal? (nth (list 1 2 3) 0) (first (list 1 2 3)))\n               'nth-last=last (equal? (nth (list 1 2 3) 2) (last (list 1 2 3)))))\n(newline)",
  cs="(display (list 'nth-over (if (nth (list 1 2) 9) 'truthy-NON-VALUE 'false)\n               'list-ref-over (guard (e (#t 'raised)) (list-ref (list 1 2) 9))\n               'same-verb-different-contract #t))\n(newline)",
  claim=("On every valid index, nth answers exactly what list-ref answers, and at the endpoints it agrees with "
   "first and last. The two verbs differ ONLY outside the valid range, where list-ref raises and nth returns a "
   "truthy non-value -- so no test restricted to legal indices can distinguish them."),
  invariant="For all lists xs and 0 <= i < length(xs). nth(xs,i) = list-ref(xs,i); nth(xs,0) = first(xs); nth(xs, length(xs)-1) = last(xs). Outside that range list-ref raises and nth does not",
  meta=("The pattern is an equivalence proved on the legal domain and then deliberately broken outside it, "
   "which is the shape of every 'these are the same except when it matters' finding. What would falsify the "
   "positive half: any legal index where they disagree. The cs program is the evidence for the :status flag "
   "and is the only line in the record that distinguishes the two verbs at all."),
  l_eng="When two implementations agree on all legal input, your tests will never tell them apart. Test the illegal input or you are not testing the difference.",
  l_math="Two functions that agree on a domain are the same function on that domain; the difference lives entirely in how they handle what is outside it.",
  l_cs="The endpoints are where an indexed accessor earns its keep. Anchor it against first and last so an off-by-one cannot hide."),
 row5=dict(
  eng="(define (safe-nth xs i) (if (and (>= i 0) (< i (length xs))) (nth xs i) 'out-of-range))\n(display (list (safe-nth (list 1 2) 1) (safe-nth (list 1 2) 9)))\n(newline)",
  math="(define (transpose rows)\n  (map (lambda (i) (map (lambda (r) (nth r i)) rows))\n       (range 0 (length (first rows)))))\n(display (transpose (list (list 1 2 3) (list 4 5 6))))\n(newline)",
  cs="(define (lookup layout row field)\n  (nth row (list-index (lambda (n) (eq? n field)) layout)))\n(define layout (list 'name 'age 'city))\n(display (lookup layout (list 'ada 31 'brooklyn) 'city))\n(newline)",
  base="nth reads the element at a numbered position.",
  emergent=("eng: a bounds-checked read that returns a NAMED sentinel instead of a truthy blank -- the wrapper "
   "that makes this verb usable, because 'out-of-range is a value you can test and a non-value is not. math: "
   "transpose, one index applied across every row and every index applied in turn, which is the whole of "
   "turning rows into columns. cs: named field access, where list-index converts a NAME into a position and "
   "nth reads it -- the two verbs together are a schema."),
  emergent_name="the named field",
  meta=("The composition is nth with a computed index. What emerges is the schema family: named field access, "
   "transpose, pivot, join keys and column selection all reduce to converting a name into a position and "
   "reading it. The eng lane is the mandatory wrapper; the cs lane is the pattern that makes positional data "
   "readable, and once you have it you should be calling list-ref underneath it."),
  l_eng="Return a sentinel you can test for. A failure value that is indistinguishable from a legitimate one is not a failure value.",
  l_math="Transposition is index exchange; writing it as such makes it obvious that it is its own inverse.",
  l_cs="A schema is a map from names to positions. Build it once, and never write a bare numeric index in the body of your program."),
)

for k in list(R):
    for row in ('row2','row3','row4','row5'):
        d=R[k][row]
        for a,b in (('l_eng','l-eng'),('l_math','l-math'),('l_cs','l-cs'),('emergent_name','emergent-name')):
            if a in d: d[b]=d.pop(a)

if __name__=='__main__': main(R, sys.argv[1:])
