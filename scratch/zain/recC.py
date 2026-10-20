# -*- coding: utf-8 -*-
import sys; sys.path.insert(0,'/Users/alfred/code/motoi-scheme/scratch/zain')
from emit import main
R={}

R['set-car!'] = dict(
 name='set-car!', std='R7RS-small', tier='core', kind='state-change',
 signature='(set-car! pair obj) -> unspecified',
 summary='Replace the car of a pair in place. The pair itself keeps its identity; everything holding it sees the new value.',
 explanation=(
  "One of the two mutators R7RS-small 6.4 defines on pairs. set-car! does not build anything: it reaches "
  "into a pair that already exists and overwrites its left slot. The pair is still eq? to what it was, so "
  "every variable, list and closure holding that pair now reads the new value. That is the whole point and "
  "the whole danger, and it is the reason almost all list code in this reference is written with cons, map "
  "and filter instead -- a fresh list cannot surprise a caller that was not consulted. Motoi represents a "
  "proper list as a flat vector rather than a chain of cells, so set-car! reaches the FIRST element of a "
  "list and the LEFT component of a real dotted pair built by cons; on either it succeeds, and on the empty "
  "list or a non-pair it raises, naming itself in the message. The return value is unspecified in R7RS and "
  "in Motoi it is a non-value: it prints as nothing and it is TRUE in an if, so never write "
  "(if (set-car! p x) ...). The dangerous case is a QUOTED LITERAL. R7RS-small 4.1.2 says altering a "
  "constant is an error; Motoi does not stop you, and the mutation STICKS -- a literal inside a procedure "
  "body is one object, so the next call to that procedure returns the mutated list. Two neighbouring jobs "
  "get mistaken for this one. To produce a changed list without touching the original, list-set builds a "
  "copy. To change an element by index rather than at the front, list-set! takes the index."),
 examples=[
  ('novice',
   "(define cfg (list 'width 320))\n(set-car! cfg 'height)\n(display cfg)\n(newline)",
   "Prints (height 320). The list was not rebuilt; the same object now reads differently."),
  ('intermediate',
   "(define shared (list 1 2 3))\n(define alias shared)\n(set-car! shared 99)\n(display (list 'shared shared 'alias alias 'same (eq? shared alias)))\n(newline)",
   "Prints (shared (99 2 3) alias (99 2 3) same #t). One mutation, two names, and eq? still #t -- the identity is what makes the change visible through alias."),
  ('expert',
   "(define xs (list 1 2 3))\n(display (list 'cdr-is-a-fresh-copy (eq? (cdr xs) (cdr xs))))\n(newline)\n(set-car! (cdr xs) 'LOST)\n(display (list 'xs xs))\n(newline)",
   "Prints (cdr-is-a-fresh-copy #f) then (xs (1 2 3)). THE MUTATION WENT NOWHERE. Motoi's cdr of a proper list returns a FRESH COPY, so set-car! reached the copy and the copy was discarded. Only the FIRST cell of a proper list can be mutated this way; for any other position use list-set!."),
 ],
 caveats=[
  "It returns a non-value: it prints as nothing and is TRUE in an if. Sequence it with begin or a body, never test it.",
  "(set-car! '() x) raises, and so does set-car! on a number or a string. The empty list is not a pair, so there is no slot to write.",
  "HAZARD, and a divergence from R7RS-small 4.1.2: Motoi lets you mutate a QUOTED LITERAL, and the change persists across every later evaluation of that literal. Build with list or cons anything you intend to mutate.",
  "DIVERGENCE, and the one that costs the most: on a PROPER LIST, cdr returns a fresh copy -- (eq? (cdr xs) (cdr xs)) is #f -- so (set-car! (cdr xs) v) mutates a discarded copy and xs is unchanged, with no error. Only the first cell is reachable. Use list-set! for any other index. On a cons-built pair CHAIN, cdr does share and the idiom works.",
  "Every holder of the pair sees the change. That is the feature; it is also why a mutated list should never cross a module boundary you do not own.",
  "For a copy-and-change with no aliasing risk, list-set answers a new list and leaves the original alone.",
 ],
 usecases=["Updating a field of a record held by several parts of a program on purpose.",
           "Writing a result back into a preallocated slot inside a tight loop.",
           "Teaching the difference between rebuilding a list and changing one."],
 related=["set-cdr!","list-set!","list-set","cons","car","eq?"],
 status='needs-alfred',
 concept="In-place mutation of a pair's left slot, preserving object identity.",
 prereq=["car","cons","eq?"],
 progression="Learn car and cons first, then eq? so identity means something, then set-car! -- and learn list-set immediately after so you know what you are giving up.",
 provenance=("R7RS-small 6.4; reference record added 2026-08-02, every example executed. Implementation "
  "src/base.js:306, declared 'state-change'. Verified 2026-08-02: succeeds on a non-empty list and on a "
  "cons-built pair, raises on '() and on a non-pair, and returns a truthy non-value. FLAGGED, two "
  "divergences: (1) cdr of a PROPER LIST returns a fresh copy, so (set-car! (cdr xs) v) is a silent no-op "
  "and only the first cell of a proper list is mutable -- (eq? (cdr xs) (cdr xs)) is #f; (2) quoted "
  "literals are mutable and the mutation persists across later evaluations of the same literal, which "
  "R7RS-small 4.1.2 calls an error."),
 row2=dict(
  eng="(define slot (list 'empty 0))\n(set-car! slot 'ore)\n(list-set! slot 1 7)\n(display (list 'slot slot 'note 'second-field-needed-list-set))\n(newline)",
  math="(define p (cons 'left 'right))\n(set-car! p 'LEFT)\n(display (list 'pair p 'car (car p) 'cdr (cdr p)))\n(newline)",
  cs="(display (list 'empty-raises (guard (e (#t 'raised)) (set-car! '() 1))\n               'number-raises (guard (e (#t 'raised)) (set-car! 5 1))\n               'returns (if (set-car! (list 1) 2) 'truthy-NON-VALUE 'false)))\n(newline)",
  problem=("The operator has one record that several parts of a frame loop already hold, and needs a field "
   "changed so that all of them see it. Candidates: set-car! (changes the object every holder points at), "
   "list-set (returns a NEW list, so the other holders keep the old one), or rebuilding with cons and "
   "rebinding (same problem, plus the rebinding). When the shared view IS the requirement, set-car! is the "
   "honest verb -- and when it is not the requirement, it is the bug."),
  explanation=("eng: filling a preallocated two-slot record in place, reaching the second slot through cdr. "
   "math: the same mutator on a real dotted pair, showing that it writes the left component and leaves the "
   "right alone. cs: the boundary probe -- the empty list raises, a number raises, and the return value is a "
   "truthy non-value that must never be tested."),
  meta=("Why set-car! and not a rebuild: a rebuild changes what a NAME refers to, and the other holders were "
   "never told. Mutation changes the object, which is either exactly right or exactly wrong, never neutral."),
  l_eng="Reach for mutation only when shared visibility is the requirement. If you cannot name who else is holding the object, you cannot justify the call.",
  l_math="set-car! is not a function of its argument to a result; it is a state transition, and the object's identity is what carries the state.",
  l_cs="A verb whose return value is unspecified should be sequenced, never tested. Motoi's truthy non-value punishes the test with a wrong branch rather than an error."),
 row3=dict(
  setup="Change one component of a thing that already exists, in place, so that everybody already looking at it sees the change.",
  rungs=[("list","(define xs (list 'a 'b))\n(set-car! xs 'A)\n(display xs)\n(newline)"),
         ("correcting the name on a shared whiteboard rather than writing a new board",
          "(define board (list 'ada 'shift-lead))\n(define whoever-is-looking board)\n(set-car! board 'brue)\n(display (list 'board board 'other-viewer whoever-is-looking))\n(newline)"),
         ("assignment to a component of a mutable tuple, as against forming a new tuple",
          "(define t (cons 1 2))\n(define before (car t))\n(set-car! t 99)\n(display (list 'before before 'after (car t) 'same-object #t))\n(newline)")],
  explanation=("In list, set-car! overwrites the first slot. Correcting a shared whiteboard is the same act: "
   "there is one board, everybody in the room reads the correction, and nobody had to be handed a new board. "
   "In mathematics the honest reading is assignment to a component of a mutable tuple, which is a different "
   "operation from forming a new tuple that happens to differ in one place. All three share: one object, one "
   "slot, and an audience that did not have to be notified."),
  meta=("The audience is the whole story. If nobody else is looking, mutation and rebuilding are "
   "indistinguishable and you should prefer the rebuild; if somebody is, they are opposite operations."),
  l_eng="Shared mutable state is a design decision that must be written down, because it cannot be inferred from the call site.",
  l_math="A mutable tuple is not a mathematical tuple; equality over it is not stable in time, which is why proofs about it need a state parameter.",
  l_cs="Related patterns: assignment to a struct field in C, list[0] = x in Python, and the total absence of both in Haskell -- three different answers to the same question."),
 row4=dict(
  eng="(define xs (list 1 2 3))\n(define before (eq? xs xs))\n(set-car! xs 99)\n(display (list 'identity-kept before 'value-changed (car xs) 'length-kept (length xs)))\n(newline)",
  math="(define (mutate-then-read v)\n  (let ((p (list v 'tail)))\n    (set-car! p 'written)\n    (car p)))\n(display (map mutate-then-read (list 1 'a \"s\")))\n(newline)",
  cs="(define (try th) (guard (e (#t 'raised)) (th)))\n(display (list 'list (try (lambda () (let ((p (list 1 2))) (set-car! p 9) p)))\n               'dotted (try (lambda () (let ((p (cons 1 2))) (set-car! p 9) p)))\n               'empty (try (lambda () (set-car! '() 9)))\n               'number (try (lambda () (set-car! 5 9)))))\n(newline)",
  claim=("set-car! changes the car and nothing else: the object stays eq? to itself, its length is unchanged, "
   "and a subsequent car reads the new value. It succeeds on a non-empty list and on a cons-built dotted "
   "pair, and raises on the empty list and on any non-pair."),
  invariant="For all pairs p and objects v. after set-car!(p, v): car(p) = v, cdr(p) is unchanged, length(p) is unchanged, and p is eq? to its former self",
  meta=("The pattern is a mutator proved by what it did NOT change. What would falsify it: a changed length, "
   "a changed cdr, or a lost identity. The third program is the domain probe, and the pair of raising cases "
   "is the part worth keeping in a test file -- an accessor family in this same chapter fails to raise there."),
  l_eng="Test a mutator on its untouched neighbours. Bugs in mutation are almost always collateral, not direct.",
  l_math="A well-behaved state transition is characterised as much by its invariants as by its effect.",
  l_cs="set-car! raising on '() is the behaviour the composed accessors in this chapter fail to provide; the contrast is worth reading side by side."),
 row5=dict(
  eng="(define (make-counter) (list 0))\n(define (bump! c) (set-car! c (+ 1 (car c))) c)\n(define c (make-counter))\n(bump! c)\n(bump! c)\n(display (list 'counter c))\n(newline)",
  math="(define (swap-heads! a b)\n  (let ((tmp (car a)))\n    (set-car! a (car b))\n    (set-car! b tmp)))\n(define p (list 1 2))\n(define q (list 8 9))\n(swap-heads! p q)\n(display (list 'p p 'q q))\n(newline)",
  cs="(define (rebuild-head xs v) (cons v (cdr xs)))\n(define original (list 1 2 3))\n(define rebuilt (rebuild-head original 99))\n(display (list 'original original 'rebuilt rebuilt 'shared-object (eq? original rebuilt)))\n(newline)",
  base="set-car! overwrites the left slot of an existing pair.",
  emergent=("eng: a counter box -- a ONE-slot list whose only cell is bumped in place, which is how you get "
   "a mutable cell in a language that has no boxes of its own. It has to be one slot: a two-slot box bumped "
   "through cdr would silently do nothing here. math: an in-place swap of two heads through a "
   "temporary, the smallest program in which mutation buys something a rebuild cannot. cs: the same edit done "
   "by rebuilding, printed beside the original so the reader can see that the original is untouched and the "
   "two are not eq?."),
  emergent_name="the mutable cell",
  meta=("The composition is set-car! plus a list used as a box. What emerges is the mutable-cell family: "
   "counters, accumulators, memo slots and generator state are all one pair and one mutator. The cs lane is "
   "the deliberate contrast -- the same intent expressed without mutation -- and for most code in this "
   "reference it is the one to copy."),
  l_eng="A counter that lives in a box can be passed to a procedure; a counter that lives in a binding cannot.",
  l_math="Swapping requires either a temporary or a reversible operation; there is no third option, and that is a statement about information, not about syntax.",
  l_cs="Show the immutable version next to the mutable one. A reader who has seen both will pick correctly; a reader who has seen one will not know there was a choice."),
)

R['set-cdr!'] = dict(
 name='set-cdr!', std='R7RS-small', tier='core', kind='state-change',
 signature='(set-cdr! pair obj) -> unspecified',
 summary='Replace the cdr of a pair in place. On a cons-built pair any object may become the tail; on a list built by list the new tail must itself be a list, and it is COPIED.',
 explanation=(
  "The second of R7RS-small 6.4's two pair mutators, and the one where Motoi's representation shows through. "
  "A conforming Scheme stores a list as a chain of cells, so set-cdr! merely repoints one cell and can do "
  "anything: attach a non-list to make an improper list, splice a shared tail, or close a cycle. Motoi "
  "stores a PROPER LIST as a flat vector, which has no cell to repoint, so it does what it can and refuses "
  "the rest with an explanation rather than half-doing it. On a real dotted pair from (cons x y) it behaves "
  "as the standard describes: any object may become the cdr, and the new tail is SHARED, so a later change "
  "to that object shows through. On a list built by list it accepts only a list as the new tail, raises with "
  "a teaching message on anything else, refuses a tail that would make the list circular, and -- the "
  "important one -- COPIES the tail rather than sharing it. In a conforming Scheme (set-cdr! p q) makes "
  "p's cdr BE q; in Motoi, when p is a proper list, it becomes a copy of q, so a later mutation of q is "
  "invisible from p. This verb was recently reported as unbound. It is bound: src/base.js:311. Two "
  "neighbouring jobs get mistaken for this one. To shorten a list, (set-cdr! p '()) works and is clear. To "
  "build an improper list, use cons directly -- it is the constructor, and it never has to refuse."),
 examples=[
  ('novice',
   "(define p (cons 1 2))\n(set-cdr! p 7)\n(display p)\n(newline)",
   "Prints (1 . 7). On a real dotted pair the new tail may be any object at all, exactly as R7RS-small 6.4 describes."),
  ('intermediate',
   "(define q (list 1 2 3))\n(set-cdr! q (list 8 9))\n(display q)\n(newline)\n(set-cdr! q '())\n(display q)\n(newline)",
   "Prints (1 8 9) then (1). The whole tail is replaced, not appended to; setting the cdr to '() is how you truncate a list to its head."),
  ('expert',
   "(define tail (list 8 9))\n(define host (list 1 2 3))\n(set-cdr! host tail)\n(set-car! tail 'CHANGED)\n(display (list 'host host 'tail tail 'shared (eq? (cdr host) tail)))\n(newline)",
   "Prints (host (1 8 9) tail (CHANGED 9) shared #f). THE TAIL WAS COPIED. In a conforming Scheme host would read (1 CHANGED 9) and shared would be #t. Motoi's proper lists are flat vectors, so there is no cell to share; do not build shared-tail structures on top of set-cdr!."),
 ],
 caveats=[
  "It returns a non-value: it prints as nothing and is TRUE in an if. Sequence it, never test it.",
  "DIVERGENCE from R7RS-small 6.4: on a list built by list, the new tail is COPIED, not shared. (eq? (cdr p) q) is #f afterwards, and later mutations of q are invisible from p. On a cons-built dotted pair the tail IS shared.",
  "DIVERGENCE: on a PROPER LIST, cdr returns a fresh copy, so (set-cdr! (cdr xs) v) mutates a discarded copy and xs is unchanged, with no error. Only the outermost cell of a proper list is reachable by these mutators.",
  "DIVERGENCE: (set-cdr! (list 1 2) 7) raises rather than producing the improper list (1 . 7). Motoi's proper lists are flat vectors with no cell to hold a non-list tail. Build the improper list with cons instead; the message says so.",
  "DIVERGENCE: a tail that leads back to the same list is refused rather than producing a circular list. Motoi cannot represent a cycle in a flat vector, so it declines instead of leaving the list half-written.",
  "HAZARD, and a divergence from R7RS-small 4.1.2: quoted literals are mutable here and the change persists across later evaluations of the same literal. Build with list or cons anything you intend to mutate.",
  "(set-cdr! '() x) raises. The empty list is not a pair.",
  "A cons-built pair whose cdr is later set to a list prints as (1 . (8 9)) rather than the standard (1 8 9). The value is right; the printing is not.",
 ],
 usecases=["Truncating a list in place with (set-cdr! p '()).",
           "Replacing the tail of a record held by several parts of a program on purpose.",
           "Building a real improper pair by cons and then adjusting its right component."],
 related=["set-car!","cons","cdr","list-set!","append","list-copy"],
 concept="In-place mutation of a pair's right slot, constrained by how the implementation stores lists.",
 prereq=["cdr","cons","eq?"],
 progression="Learn cons and cdr, then set-car! for the easy slot, then set-cdr! -- and read the three divergences before writing any structure that relies on a shared tail.",
 status='needs-alfred',
 provenance=("R7RS-small 6.4; reference record added 2026-08-02, every example executed. Implementation "
  "src/base.js:311, declared 'state-change'. BOUND -- an earlier report of set-cdr! being unbound is stale, "
  "verified 2026-08-02. FLAGGED, three divergences all verified by execution: (1) on a proper list the new "
  "tail is COPIED (const tail = v.slice()), so (eq? (cdr p) q) is #f and later mutation of q is invisible; "
  "(2) a non-list tail on a proper list RAISES instead of producing an improper list; (3) a cyclic tail is "
  "REFUSED. All three follow from proper lists being flat vectors rather than cell chains."),
 row2=dict(
  eng="(define log (list 'head 'a 'b 'c))\n(set-cdr! log (list 'a))\n(display (list 'truncated log 'length (length log)))\n(newline)",
  math="(define p (cons 'left 'right))\n(set-cdr! p 'RIGHT)\n(display (list 'pair p 'car (car p) 'cdr (cdr p)))\n(newline)",
  cs="(display (list 'non-list-tail-raises (guard (e (#t 'raised)) (set-cdr! (list 1 2) 7))\n               'pair-tail-fine (guard (e (#t 'raised)) (let ((c (cons 1 2))) (set-cdr! c 'end) c))\n               'cycle-refused (guard (e (#t 'raised)) (let ((z (list 1 2))) (set-cdr! z z) z))\n               'empty-raises (guard (e (#t 'raised)) (set-cdr! '() (list 1)))))\n(newline)",
  problem=("The operator has a bounded log held by several parts of a frame loop and wants it truncated so "
   "that all of them see the shorter list. Candidates: set-cdr! with a shorter tail (one object, everybody "
   "sees it), take (returns a NEW list, so the other holders keep the long one), or rebinding the name (same "
   "problem). When shared visibility is the requirement, set-cdr! is the honest verb -- provided the "
   "replacement tail is itself a list, because in Motoi anything else raises."),
  explanation=("eng: truncating a shared log in place and checking the new length. math: the same mutator on "
   "a real dotted pair, where R7RS's full freedom is available and any object may become the right component. "
   "cs: the four boundary cases in one row -- a non-list tail on a proper list raises, the same tail on a "
   "cons-built pair is fine, a cycle is refused, and the empty list raises."),
  meta=("Why the cs row is four cases and not one: the verb behaves differently depending on how its FIRST "
   "argument was built, which is unusual and is the single fact a caller most needs to carry."),
  l_eng="When a verb's behaviour depends on how its argument was constructed, that dependency belongs in the caveats, not in a comment.",
  l_math="A representation choice is not neutral: storing a list as a vector removes the cell that set-cdr! is defined to repoint, and the standard's guarantees go with it.",
  l_cs="Refusing loudly beats half-doing. A raise with an explanation is a better outcome than a structure the printer cannot render."),
 row3=dict(
  setup="Replace everything after the front of an existing chain, in place, leaving the front and its identity alone.",
  rungs=[("list","(define xs (list 1 2 3 4))\n(set-cdr! xs (list 9))\n(display xs)\n(newline)"),
         ("uncoupling a train behind the engine and backing a different rake onto it",
          "(define train (list 'engine 'coach-a 'coach-b))\n(set-cdr! train (list 'flatbed))\n(display (list 'train train))\n(newline)"),
         ("redefining the tail of a sequence from index 1 on, keeping a0",
          "(define seq (list 5 8 13 21))\n(set-cdr! seq (list 0 0))\n(display (list 'a0-kept (car seq) 'seq seq))\n(newline)")],
  explanation=("In list, set-cdr! replaces the whole tail. Uncoupling behind the engine and backing on a "
   "different rake is the same move: the engine keeps its number and its crew, and everything behind it is "
   "different. In mathematics it is redefining a sequence from index 1 onward while keeping a0. All three "
   "share: a distinguished head that survives, a tail replaced wholesale rather than edited, and an identity "
   "that outlives the change."),
  meta=("The train is honest about one more thing: what you back onto the engine has to be a rake. Motoi says "
   "the same -- the new tail of a proper list must be a list -- where a cell-based Scheme would let you "
   "couple anything at all."),
  l_eng="Replacing a tail wholesale is a different operation from editing it, and the wholesale version is far easier to reason about.",
  l_math="Keeping a0 and redefining the rest is how piecewise and recursive sequence definitions are actually written.",
  l_cs="Related patterns: lst[1:] = other in Python (which also copies), splice in JS, and the cell repointing that Lisp made famous -- three representations, three different promises."),
 row4=dict(
  eng="(define xs (list 1 2 3))\n(set-cdr! xs (list 9))\n(display (list 'head-kept (car xs) 'tail (cdr xs) 'length (length xs)))\n(newline)",
  math="(define (tail-shared? build)\n  (let ((host (build))\n        (t (list 8 9)))\n    (set-cdr! host t)\n    (eq? (cdr host) t)))\n(display (list 'proper-list (tail-shared? (lambda () (list 1 2 3)))\n               'cons-pair (tail-shared? (lambda () (cons 1 2)))))\n(newline)",
  cs="(define t (list 8 9))\n(define host (list 1 2 3))\n(set-cdr! host t)\n(set-car! t 'CHANGED)\n(display (list 'host host 'tail t 'r7rs-would-say '(1 CHANGED 9)))\n(newline)",
  claim=("set-cdr! keeps the car and replaces everything after it. Whether the new tail is SHARED depends on "
   "how the first argument was built: a cons-built dotted pair shares its tail as R7RS-small 6.4 requires, "
   "and a list built by list gets a COPY, so a later mutation of the tail object is invisible from the host."),
  invariant="For all pairs p and lists q. after set-cdr!(p, q): car(p) is unchanged. R7RS additionally requires cdr(p) to be eq? to q; Motoi satisfies that only when p is a cons-built pair, and VIOLATES it when p is a proper list",
  meta=("The pattern is one verb with two behaviours selected by the representation of its argument. What "
   "would falsify the positive half: a changed car, or a length that did not match the new tail. The math "
   "program is the differential test -- one predicate, two constructors, two answers -- and it is the "
   "evidence for the :status flag."),
  l_eng="When one verb has two behaviours, write the test that selects between them and keep it. Prose will not survive a refactor.",
  l_math="Sharing is an identity property, not a value property; equal? cannot see it and eq? must be used.",
  l_cs="A copy where the caller expected an alias is the quietest possible bug: everything reads correctly until somebody writes."),
 row5=dict(
  eng="(define (make-ring-buffer n) (list 'buf))\n(define (refill! b items) (set-cdr! b items) b)\n(define b (make-ring-buffer 3))\n(refill! b (list 1 2 3))\n(display b)\n(newline)\n(refill! b (list 7))\n(display b)\n(newline)",
  math="(define (truncate! xs) (set-cdr! xs '()) xs)\n(display (list 'from-4 (truncate! (list 1 2 3 4)) 'from-1 (truncate! (list 9))))\n(newline)",
  cs="(define (safe-retail xs new)\n  (if (list? new) (begin (set-cdr! xs new) xs) (cons (car xs) new)))\n(display (list 'list-tail (safe-retail (list 1 2) (list 8 9))\n               'atom-tail (safe-retail (list 1 2) 7)))\n(newline)",
  base="set-cdr! replaces everything after the head of an existing pair.",
  emergent=("eng: a refillable buffer whose head is a stable handle -- callers keep the handle and the "
   "contents change under them, which is the only reason to prefer this over rebuilding. math: truncation as "
   "a one-liner, with the degenerate single-element case beside it. cs: a total wrapper that routes around "
   "the divergence -- if the new tail is a list, mutate; if it is not, build the improper pair with cons, "
   "which is what a conforming Scheme would have done for you."),
  emergent_name="the stable handle",
  meta=("The composition is set-cdr! plus a head used as a handle. What emerges is the stable-handle family: "
   "buffers, queues and worklists whose identity outlives their contents. The cs lane is the workaround the "
   ":status flag makes necessary, and it is worth reading as a template -- when an implementation refuses a "
   "case the standard allows, wrap it once and name the fallback."),
  l_eng="A handle whose identity is stable lets you hand out one reference and change the contents later; that is the entire value proposition of mutation.",
  l_math="Truncation and extension are the same operation on the tail, and both leave the head fixed, which is why the head makes a good name.",
  l_cs="When you must work around a divergence, do it in one named wrapper. A workaround scattered across call sites becomes indistinguishable from the bug."),
)

for k in list(R):
    for row in ('row2','row3','row4','row5'):
        d=R[k][row]
        for a,b in (('l_eng','l-eng'),('l_math','l-math'),('l_cs','l-cs'),('emergent_name','emergent-name')):
            if a in d: d[b]=d.pop(a)

if __name__=='__main__': main(R, sys.argv[1:])
