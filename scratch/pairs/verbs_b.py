#!/usr/bin/env python3
"""verbs_b.py -- two-value splitters and spine-relinkers.

Priya, 2026-08-03. Companion to verbs_table.py; same rules apply.
Multi-value returns are shown with let-values, never SRFI-8 receive:
receive is not part of Motoi's standard.
"""

from verbs_table import LESSON

# ---------------------------------------------------------------------------
# FAMILY B -- one spine, two values. The suite (list.sld:326-332, 534-554)
# checks that BOTH returned lists are built from the argument's own cells.
# ---------------------------------------------------------------------------

SPLIT_AT_BANG = dict(
    name='split-at!', std='SRFI-1', library='list', kind='state-change',
    signature='(split-at! lst i) -> two values: (prefix rest)',
    summary='The first i elements and the rest, as two values, produced by severing the spine once. Both values are made of the argument\'s own cells.',
    explanation=(
        'split-at! is the verb that take! and drop cannot be written as a pair. Severing the spine '
        'at i is a single write; what split-at! adds is that it hands you both ends of the cut. '
        'The suite is precise about this at list.sld:326-332: the first value is eq? to the '
        'argument and the second is eq? to the cell that was (cddr x) before the call. Nothing is '
        'allocated and nothing is copied. ' + LESSON + ' Try to build it yourself out of take! and '
        'drop and you meet the problem head-on -- after take! has cut, the tail is unreachable, so '
        'the drop has to happen first, and now you are relying on an ordering the call site does '
        'not show. This verb exists to make that ordering unnecessary.'),
    examples=[
        ('novice',
         "(define xs (list 1 2 3 4 5 6))\n(let-values (((front back) (split-at! xs 2)))\n  (display (list 'front front 'back back))\n  (newline))"),
        ('intermediate',
         ";; the front value IS xs; the back value is the cell that used to follow it.\n"
         "(define xs (list 1 2 3 4 5 6))\n(define tail-cell (cddr xs))\n"
         "(let-values (((front back) (split-at! xs 2)))\n  (display (list 'front-is-xs (eq? front xs) 'back-is-old-tail (eq? back tail-cell)))\n  (newline))"),
        ('expert',
         ";; i = 0 has no cell to cut: the prefix is empty and the whole list comes\n"
         ";; back as the second value, so nothing is destroyed.\n"
         "(define xs (list 1 2 3))\n(let-values (((front back) (split-at! xs 0)))\n  (display (list 'front front 'back-is-xs (eq? back xs)))\n  (newline))"),
    ],
    caveats=[
        'The argument is destroyed. list.sld:326-332 asserts the first value is eq? to the argument and the second is eq? to its old tail cell.',
        'Both values share storage with each other\'s past: mutating one where they used to be joined is not visible to the other, but mutating cells within either is visible to anything else holding them.',
        'i must be between 0 and the length of lst inclusive.',
        'It returns TWO values. Use let-values; a plain define binds only the first and silently loses the rest.',
        'At i = 0 nothing is written and the argument survives whole as the second value.',
    ],
    drawbacks=[
        'Two live references into what used to be one list is exactly the state that makes later reasoning hard.',
        'Multiple return values do not compose with ordinary function application; every use costs a let-values.',
        'It is not bound in the current engine at all, so code written against it does not run today.',
    ],
    usecases=[
        'Splitting a self-owned buffer into header and body without allocating either.',
        'Chunking a producer\'s output in place when each chunk is consumed before the next split.',
        'The correct replacement for a take!/drop pairing, which cannot be written in a safe order.',
    ],
    related=['split-at', 'take!', 'drop', 'span!', 'break!'],
    learn=('Two values from one cut, and why the pure pairing cannot be imitated',
           ['split-at', 'take!', 'drop', 'set-cdr!'],
           'Write split-at first. Then try to build split-at! out of take! and drop and watch the ordering constraint appear; that failure is the lesson.'),
    provenance='SRFI-1 linear-update procedures; conformance evidence scratch/r7rs-conformance/larceny/list.sld:326-332; signature derived from the split-at record in scheme/reference/39-list.slat. NOT BOUND in lib/std/srfi-1.js as of 2026-08-03 -- this record documents a verb the engine is missing, not one it gets wrong. Drafted 2026-08-03; NOT RUN.',
    status='needs-alfred',
    r2=([('eng-program', "(define xs (list 1 2 3 4 5 6))\n(let-values (((front back) (split-at! xs 2)))\n  (display (list front back))\n  (newline))"),
         ('math-program', "(define a (list 1 2 3 4 5))\n(define b (list 1 2 3 4 5))\n(let-values (((pa qa) (split-at a 2)) ((pb qb) (split-at! b 2)))\n  (display (list (equal? pa pb) (equal? qa qb)))\n  (newline))"),
         ('cs-program', "(define xs (list 1 2 3 4))\n(define old-tail (cddr xs))\n(let-values (((front back) (split-at! xs 2)))\n  (display (list (eq? front xs) (eq? back old-tail)))\n  (newline))"),
         ('problem', 'The operator has a buffer and needs both the first i elements and everything after. Candidates: split-at (two fresh lists, source intact), take plus drop (two traversals and two allocations, source intact), or split-at! (one write, nothing allocated, source destroyed). The pure pairing is always available; the destructive pairing is NOT, because take! makes the tail unreachable. That is the argument for split-at! existing as its own verb rather than as a convenience.'),
         ('explanation', 'eng: both halves come back and the buffer variable now names only the front. math: the two values are equal? to what split-at would have produced, for every legal i. cs: the second value is the argument\'s own tail cell, so the halves are not independent objects that happen to have equal contents.'),
         ('meta', 'When a destructive verb cannot be decomposed into other destructive verbs, that is the signal it belongs in the library rather than in each caller.')],
        ('If the ordering constraint lives in your head instead of in the API, it will be got wrong.',
         'split-at! agrees with split-at on both values; the difference is entirely in what remains.',
         'A cut that yields both sides is one write; the same result by composition is two traversals and an ordering hazard.')),
    r3=([('setup', 'Dividing a sequence at an index and keeping both parts, by severing rather than copying.'),
         ('rungs', [
             ('list', "(let-values (((a b) (split-at! (list 1 2 3 4) 2)))\n  (display (list a b))\n  (newline))"),
             ('a train uncoupled mid-rake', "(define rake (list 'loco 'car1 'car2 'brake-van))\n(let-values (((front rest) (split-at! rake 2)))\n  (display (list 'front front 'rest rest))\n  (newline))"),
             ('a page boundary in a paginated feed', "(define feed (list 'r1 'r2 'r3 'r4 'r5))\n(let-values (((page rest) (split-at! feed 2)))\n  (display (list 'page page 'rest rest))\n  (newline))"),
         ]),
         ('explanation', 'In list, one write at index i produces two lists. Uncoupling a rake mid-train is the same act: one coupling released, two trains, no rolling stock built or scrapped. A page boundary in a feed divides rows the same way, and the rest is still a feed. All three share that the division is a severed link, not a duplication.'),
         ('meta', 'The shape transfers wherever the parts are made of the whole and the whole is not wanted again.')],
        ('Uncoupling is one action producing two results; copying is two actions producing two results.',
         'The parts partition the original: disjoint, ordered, and their append is the whole.',
         'This is why a linked list splits in O(1) at a known cell and an array does not.')),
    r4=([('eng-program', "(define xs (list 1 2 3 4 5 6))\n(let-values (((f b) (split-at! xs 2)))\n  (display (list 'lengths (length f) (length b)))\n  (newline))"),
         ('math-program', "(define (rejoins? n i)\n  (let loop ((k n) (xs (list)))\n    (if (> k 0)\n        (loop (- k 1) (cons k xs))\n        (let-values (((f b) (split-at! xs i)))\n          (equal? (append f b) (let loop2 ((k n) (ys (list))) (if (> k 0) (loop2 (- k 1) (cons k ys)) ys)))))))\n(display (list (rejoins? 5 0) (rejoins? 5 2) (rejoins? 5 5)))\n(newline)"),
         ('cs-program', "(define xs (list 1 2 3))\n(let-values (((f b) (split-at! xs 0)))\n  (display (list 'prefix-empty (null? f) 'rest-is-argument (eq? b xs)))\n  (newline))"),
         ('claim', 'For a proper list lst and 0 <= i <= (length lst), split-at! returns two values equal? to those of (split-at lst i), whose append is equal? to the original contents. For i > 0 the first value is eq? to lst; for i = 0 the second value is eq? to lst and nothing is written.'),
         ('invariant', 'forall proper lst, 0 <= i <= |lst|. (f, b) = split-at!(lst, i) satisfies |f| = i and equal?(append(f, b), lst-as-it-was) and (i > 0 implies eq?(f, lst)) and (i = 0 implies eq?(b, lst))'),
         ('meta', 'The pattern is a partition proved by rejoining. What would falsify the claim: an append that does not reconstruct the original, a first value of the wrong length, or a fresh cell where the argument\'s own was required. Note the invariant has to say "lst-as-it-was" -- after the call there is no lst to compare against, which is itself the lesson.')],
        ('The invariant cannot name the argument after the call. That awkwardness is the honest shape of destruction.',
         'Rejoining is the natural proof of a partition, and it is available here because both parts are returned.',
         'The i = 0 boundary is where the effect vanishes and the second value aliases the argument; test it explicitly.')),
    r5=([('eng-composition', "(define (header-and-body! msg header-size)\n  (let-values (((h b) (split-at! msg header-size)))\n    (list 'header h 'body b)))\n(display (header-and-body! (list 'v 'len 'd1 'd2) 2))\n(newline)"),
         ('math-composition', "(define (halves! xs)\n  (let-values (((a b) (split-at! xs (quotient (length xs) 2))))\n    (list a b)))\n(display (halves! (list 1 2 3 4 5 6)))\n(newline)"),
         ('cs-composition', "(define (chunks xs n)\n  (if (<= (length xs) n)\n      (list xs)\n      (let-values (((head rest) (split-at xs n)))\n        (cons head (chunks rest n)))))\n(display (chunks (list 1 2 3 4 5) 2))\n(newline)"),
         ('base', 'split-at! severs a list at an index and returns both parts, each made of the original cells.'),
         ('emergent', 'eng: header/body framing with no allocation, the shape every wire protocol wants. math: a midpoint split is the first half of a merge sort, and the destructive version is exactly why in-place merge sorts are written on lists. cs: repeated chunking CAN use the destructive verb, unlike take-while!, because split-at! hands back the remainder to recurse on -- shown here in the pure form so the recursion is readable, and the destructive swap is a one-word change.'),
         ('meta', 'The family is divide-and-conquer. What emerges is the distinguishing property of split-at! among these verbs: it returns the remainder, so it is the only linear-update verb in this set that can be applied repeatedly to its own output.')],
        ('Returning the remainder is what makes a destructive verb loopable. Verbs that swallow the tail cannot recurse.',
         'Midpoint splitting plus merging is mergesort; on lists the split is free and the merge does the work.',
         'This is the verb that makes an in-place list sort expressible at all.')),
)

SPAN_BANG = dict(
    name='span!', std='SRFI-1', library='list', kind='state-change',
    signature='(span! pred lst) -> two values: (prefix rest)',
    summary='The longest leading run satisfying pred, and everything after it, as two values, cut out of lst\'s own cells.',
    explanation=(
        'span! is to split-at! what take-while! is to take!: the cut point is discovered by a '
        'predicate instead of supplied as an index. It is the verb that makes take-while! usable, '
        'because it returns the part take-while! throws away. The suite checks both returned lists '
        'at list.sld:534-543 and requires every cell of both to have come from the argument -- '
        'nothing is allocated. ' + LESSON + ' The relationship worth memorising is that span! and '
        'break! are the same verb with the predicate inverted, and that (span! pred lst) is exactly '
        '(take-while! pred lst) paired with the drop-while the caller could not have taken '
        'afterwards.'),
    examples=[
        ('novice',
         "(define xs (list 2 18 3 10 22 9))\n(let-values (((run rest) (span! even? xs)))\n  (display (list 'run run 'rest rest))\n  (newline))"),
        ('intermediate',
         ";; both values are carved from xs; the run is xs cut short.\n"
         "(define xs (list 2 18 3 10))\n(let-values (((run rest) (span! even? xs)))\n  (display (list 'run-is-xs (eq? run xs) 'rest rest))\n  (newline))"),
        ('expert',
         ";; span! and break! are one verb under two names for the predicate.\n"
         "(define a (list 2 4 5 6))\n(define b (list 2 4 5 6))\n"
         "(let-values (((ra sa) (span! even? a)) ((rb sb) (break! odd? b)))\n  (display (list 'span ra sa 'break rb sb))\n  (newline))"),
    ],
    caveats=[
        'The argument is destroyed when the run is non-empty. list.sld:534-543 asserts every cell of both results came from the argument.',
        'When the first element fails the predicate the run is empty, nothing is written, and the second value is the argument itself.',
        'It returns TWO values; bind them with let-values.',
        'pred stops being called at the first failure. A predicate with side effects will not see the remainder.',
    ],
    drawbacks=[
        'Like take-while!, whether anything was destroyed depends on the data, so the hazard is intermittent.',
        'Holding both halves keeps the whole original reachable, so the memory saving over span is smaller than it looks.',
        'The pred-inverted equivalence with break! means two names for one behaviour, and readers must check which one they are looking at.',
    ],
    usecases=[
        'Consuming a leading run off a self-owned worklist while keeping the remainder to loop on.',
        'Tokenising a character list in place, run by run.',
        'The safe replacement for take-while! whenever the tail is still needed.',
    ],
    related=['span', 'break!', 'take-while!', 'drop-while', 'split-at!'],
    learn=('Predicate-found cut points that return both sides',
           ['span', 'take-while!', 'split-at!', 'let-values'],
           'Learn span, then take-while!, then span! -- the third is the first two reconciled, and the reconciliation is the point.'),
    provenance='SRFI-1 linear-update procedures; conformance evidence scratch/r7rs-conformance/larceny/list.sld:534-543; signature derived from the span record in scheme/reference/39-list.slat. Drafted 2026-08-03; NOT RUN.',
    status='needs-alfred',
    r2=([('eng-program', "(define xs (list 2 18 3 10))\n(let-values (((run rest) (span! even? xs)))\n  (display (list run rest))\n  (newline))"),
         ('math-program', "(define a (list 2 18 3 10))\n(define b (list 2 18 3 10))\n(let-values (((ra sa) (span even? a)) ((rb sb) (span! even? b)))\n  (display (list (equal? ra rb) (equal? sa sb)))\n  (newline))"),
         ('cs-program', "(define xs (list 3 4))\n(let-values (((run rest) (span! even? xs)))\n  (display (list 'empty-run (null? run) 'rest-is-argument (eq? rest xs)))\n  (newline))"),
         ('problem', 'The operator is draining a worklist a run at a time and needs both the run and what is left. Candidates: span (both halves fresh, source intact), take-while plus drop-while (two traversals, and the predicate runs twice), or span! (one traversal, one write, source destroyed). take-while! is not a candidate at all here, because it discards the remainder the loop needs.'),
         ('explanation', 'eng: the run comes back and so does the rest, which is what lets the loop continue. math: both values agree with span for every predicate and list. cs: the cells are the argument\'s, so the two halves are views onto one destroyed original rather than independent objects.'),
         ('meta', 'The candidate that gets eliminated first is the informative one: take-while! loses the tail, and a loop cannot be built on a verb that loses the tail.')],
        ('Choose the verb that returns what the loop needs next, not the one that reads shortest.',
         'span computes take-while and drop-while in one pass; the predicate is evaluated once per element.',
         'Two traversals with a side-effecting predicate is a correctness bug, not just a slow path.')),
    r3=([('setup', 'Splitting a sequence at the first element that fails a test, keeping both sides.'),
         ('rungs', [
             ('list', "(let-values (((r s) (span! even? (list 2 4 5 6))))\n  (display (list r s))\n  (newline))"),
             ('a queue drained until the first blocked job', "(define q (list 'ready 'ready 'blocked 'ready))\n(let-values (((served waiting) (span! (lambda (j) (eq? j 'ready)) q)))\n  (display (list 'served served 'waiting waiting))\n  (newline))"),
             ('a line of text split at the first non-digit', "(define chars (list #\\4 #\\2 #\\x #\\7))\n(let-values (((digits rest) (span! char-numeric? chars)))\n  (display (list 'digits digits 'rest rest))\n  (newline))"),
         ]),
         ('explanation', 'In list, the split lands at the first failure. A queue drained until the first blocked job stops there and the blocked job is still at the head of what remains, ready for a different policy. A tokeniser splitting at the first non-digit does the same and hands the remainder to the next rule. All three share a boundary the data chooses and a remainder that is still wanted.'),
         ('meta', 'The shape transfers wherever a scan stops on a condition and the unscanned part continues to another stage.')],
        ('A stop rule that discards the remainder is a scan; one that returns it is a stage in a pipeline.',
         'The failing element belongs to the second part, which is what makes repeated spanning terminate.',
         'This is the classic lexer step: match a run, hand the rest to the next rule.')),
    r4=([('eng-program', "(define xs (list 2 18 3))\n(let-values (((r s) (span! even? xs)))\n  (display (list 'run r 'rest s))\n  (newline))"),
         ('math-program', "(define (span-laws? p xs)\n  (let-values (((r s) (span p xs)))\n    (and (every p r)\n         (or (null? s) (not (p (car s))))\n         (equal? (append r s) xs))))\n(display (list (span-laws? even? (list 2 4 5 6)) (span-laws? even? (list 1 2)) (span-laws? even? (list 2 4))))\n(newline)"),
         ('cs-program', "(define a (list 2 4 5))\n(define b (list 2 4 5))\n(let-values (((ra sa) (span! even? a)) ((rb sb) (break! odd? b)))\n  (display (list 'same-run (equal? ra rb) 'same-rest (equal? sa sb)))\n  (newline))"),
         ('claim', 'span! returns two values: the maximal prefix of lst all of whose elements satisfy pred, and the remainder beginning with the first element that does not. Their append equals the original contents, and both are built from lst\'s own cells. It agrees value-for-value with span, and with break! under a negated predicate.'),
         ('invariant', 'forall pred, proper lst. (r, s) = span!(pred, lst) satisfies every(pred, r) and (s = () or not pred(car(s))) and equal?(append(r, s), lst-as-it-was) and span!(pred, lst) = break!(not-pred, lst)'),
         ('meta', 'The pattern is a predicate-located partition. What would falsify the claim: a remainder whose head satisfies pred (not maximal), an append that does not reconstruct the original, or disagreement with break! under negation.')],
        ('Three assertions carry this: all of the run passes, the head of the rest fails, and the two rejoin.',
         'Maximality plus reconstruction pins the answer uniquely; either alone admits wrong splits.',
         'The span/break duality is worth a test of its own, because an implementation that gets one right can still get the other inverted.')),
    r5=([('eng-composition', "(define (drain-ready q)\n  (let-values (((served waiting) (span (lambda (j) (eq? j 'ready)) q)))\n    (list 'served served 'waiting waiting)))\n(display (drain-ready (list 'ready 'ready 'blocked)))\n(newline)"),
         ('math-composition', "(define (runs p xs)\n  (if (null? xs)\n      (list)\n      (let-values (((r s) (span p xs)))\n        (if (null? r)\n            (cons (list (car xs)) (runs p (cdr xs)))\n            (cons r (runs p s))))))\n(display (runs even? (list 2 4 5 6 8)))\n(newline)"),
         ('cs-composition', "(define (tokenise chars)\n  (if (null? chars)\n      (list)\n      (let-values (((digits rest) (span char-numeric? chars)))\n        (if (null? digits)\n            (cons (car chars) (tokenise (cdr chars)))\n            (cons digits (tokenise rest))))))\n(display (tokenise (list #\\1 #\\2 #\\x #\\3)))\n(newline)"),
         ('base', 'span! cuts a list at the first element failing a predicate and returns both parts.'),
         ('emergent', 'eng: a drain step that a scheduler can call in a loop. math: repeated spanning is run-length segmentation, the thing take-while! could not express -- and note the empty-run branch, which is what stops the recursion from spinning. cs: a tokeniser is that segmentation with the predicate changed; shown pure so the recursion is readable, and destructive only if the character list is genuinely single-owner.'),
         ('meta', 'The family is repeated segmentation. What emerges is the same rule split-at! demonstrated: a linear-update verb is loopable exactly when it returns its own remainder.')],
        ('The empty-run guard is not defensive coding, it is what makes the loop terminate.',
         'Run-length segmentation is repeated maximal-prefix extraction; the remainder is the recursion variable.',
         'Every lexer is this shape, which is why the verb that returns the remainder is the one that got standardised.')),
)

BREAK_BANG = dict(
    name='break!', std='SRFI-1', library='list', kind='state-change',
    signature='(break! pred lst) -> two values: (prefix rest)',
    summary='Everything before the first element that satisfies pred, and the rest, as two values cut from lst\'s own cells.',
    explanation=(
        'break! stops at the first element that MATCHES, where span! stops at the first that fails. '
        'That single inversion is the whole difference: (break! pred lst) and '
        '(span! (lambda (x) (not (pred x))) lst) are the same call. It is worth having both names '
        'because the sentence a caller wants to write is sometimes "up to the first delimiter" and '
        'sometimes "while it is still a digit", and forcing one of those through a negation is how '
        'off-by-one predicates get written. The suite exercises it at list.sld:545-554 and requires '
        'both returned lists to be built from the argument\'s cells. ' + LESSON),
    examples=[
        ('novice',
         "(define xs (list 3 1 4 1 5 9))\n(let-values (((before rest) (break! even? xs)))\n  (display (list 'before before 'rest rest))\n  (newline))"),
        ('intermediate',
         ";; the matching element heads the SECOND value, it is not consumed.\n"
         "(define xs (list 'a 'b 'comma 'c))\n(let-values (((field rest) (break! (lambda (t) (eq? t 'comma)) xs)))\n  (display (list 'field field 'rest-head (car rest)))\n  (newline))"),
        ('expert',
         ";; break! with a never-true predicate: whole list in front, empty rest,\n"
         ";; and the argument has been cut at its very end.\n"
         "(define xs (list 1 3 5))\n(let-values (((before rest) (break! even? xs)))\n  (display (list 'before before 'rest-empty (null? rest)))\n  (newline))"),
    ],
    caveats=[
        'The argument is destroyed when the prefix is non-empty. list.sld:545-554 asserts both results are built from the argument\'s cells.',
        'The element that satisfies pred is NOT consumed; it is the head of the second value. Callers splitting on a delimiter must drop it themselves.',
        'When the first element already satisfies pred the prefix is empty, nothing is written, and the second value is the argument.',
        'It returns TWO values; bind them with let-values.',
    ],
    drawbacks=[
        'Having both break! and span! doubles the surface for one behaviour, and a reader must check which polarity is in play.',
        'The delimiter surviving into the remainder is a standing source of one-element-too-many bugs in split loops.',
        'As with span!, the destruction is data-dependent and so the hazard is intermittent.',
    ],
    usecases=[
        'Splitting a self-owned token list at the first delimiter.',
        'Reading up to a sentinel in a buffer you built, keeping the sentinel for the next stage to inspect.',
        'Error scanning: everything before the first bad record, plus the bad record and what follows.',
    ],
    related=['break', 'span!', 'take-while!', 'drop-while', 'split-at!'],
    learn=('Polarity: stopping at a match versus stopping at a failure',
           ['break', 'span!', 'let-values', 'not'],
           'Write one split loop with span! and the same loop with break! and notice which one needed a negation. That is how you learn which to reach for.'),
    provenance='SRFI-1 linear-update procedures; conformance evidence scratch/r7rs-conformance/larceny/list.sld:545-554; signature derived from the break record in scheme/reference/39-list.slat. Drafted 2026-08-03; NOT RUN.',
    status='needs-alfred',
    r2=([('eng-program', "(define xs (list 3 1 4 1 5))\n(let-values (((b r) (break! even? xs)))\n  (display (list b r))\n  (newline))"),
         ('math-program', "(define a (list 3 1 4 1))\n(define b (list 3 1 4 1))\n(let-values (((ba ra) (break even? a)) ((bb rb) (break! even? b)))\n  (display (list (equal? ba bb) (equal? ra rb)))\n  (newline))"),
         ('cs-program', "(define xs (list 'a 'stop 'b))\n(let-values (((before rest) (break! (lambda (t) (eq? t 'stop)) xs)))\n  (display (list 'delimiter-kept (car rest)))\n  (newline))"),
         ('problem', 'The operator wants everything up to the first delimiter in a token list they own. Candidates: break (both halves fresh), span with a negated predicate (same result, one negation to get wrong), or break! (no allocation, source destroyed). The reason to prefer break! over span!-with-not here has nothing to do with speed: the sentence is "until the delimiter", and writing it as "while not the delimiter" is where the polarity bug enters.'),
         ('explanation', 'eng: the field comes back and the delimiter is still at the head of the remainder. math: break! agrees with break on both values, and with span! under negation. cs: both values are made of the argument\'s cells, so the original is gone even though nothing was allocated.'),
         ('meta', 'Choosing the verb whose polarity matches your sentence is a correctness measure, not a style preference.')],
        ('Match the verb to the sentence. Negations added at the call site are defects waiting for a rush.',
         'break and span are De Morgan duals; the implementation can be one function, the API should not be.',
         'The delimiter staying in the remainder is a deliberate design choice and the single most-missed detail of this verb.')),
    r3=([('setup', 'Cutting a sequence just before the first element that matches, keeping both sides.'),
         ('rungs', [
             ('list', "(let-values (((b r) (break! even? (list 3 1 4 5))))\n  (display (list b r))\n  (newline))"),
             ('a CSV field ending at the first comma', "(define row (list #\\a #\\b #\\, #\\c))\n(let-values (((field rest) (break! (lambda (c) (char=? c #\\,)) row)))\n  (display (list 'field field 'rest rest))\n  (newline))"),
             ('a log read up to the first error line', "(define lines (list 'ok 'ok 'error 'ok))\n(let-values (((clean from-error) (break! (lambda (l) (eq? l 'error)) lines)))\n  (display (list 'clean clean 'from-error from-error))\n  (newline))"),
         ]),
         ('explanation', 'In list, the cut lands just before the first match. A CSV field ends at the first comma and the comma stays for the parser to step over. A log read up to the first error keeps the error line at the head of what remains, because the error is the thing the next stage cares about. All three share a match that is a boundary marker rather than a member of what precedes it.'),
         ('meta', 'The shape transfers wherever the matching element is significant to the NEXT stage rather than to the one that stopped.')],
        ('Leave the marker where the next reader will look for it.',
         'The prefix is characterised by containing no match; the remainder by starting with one.',
         'Delimiter handling is where hand-written parsers most often lose or duplicate an element.')),
    r4=([('eng-program', "(define xs (list 3 1 4))\n(let-values (((b r) (break! even? xs)))\n  (display (list 'before b 'rest r))\n  (newline))"),
         ('math-program', "(define (break-laws? p xs)\n  (let-values (((b r) (break p xs)))\n    (and (not (any p b))\n         (or (null? r) (p (car r)))\n         (equal? (append b r) xs))))\n(display (list (break-laws? even? (list 3 1 4 5)) (break-laws? even? (list 2 3)) (break-laws? even? (list 1 3))))\n(newline)"),
         ('cs-program', "(define a (list 3 1 4))\n(define b (list 3 1 4))\n(let-values (((ba ra) (break! even? a)) ((bb rb) (span! odd? b)))\n  (display (list 'dual (equal? ba bb) (equal? ra rb)))\n  (newline))"),
         ('claim', 'break! returns the maximal prefix of lst containing no element satisfying pred, together with the remainder, which is empty or begins with an element satisfying pred. Their append is the original contents, both are built from lst\'s cells, and the pair equals what span! returns under a negated predicate.'),
         ('invariant', 'forall pred, proper lst. (b, r) = break!(pred, lst) satisfies not any(pred, b) and (r = () or pred(car(r))) and equal?(append(b, r), lst-as-it-was) and break!(pred, lst) = span!(not-pred, lst)'),
         ('meta', 'The pattern is a De Morgan dual pair. What would falsify the claim: a match inside the prefix, a remainder not headed by a match, or a break!/span! disagreement under negation -- the last being the one an implementation sharing a single helper is most likely to get wrong in exactly one direction.')],
        ('Test the dual explicitly. A shared implementation can satisfy one polarity and invert the other.',
         'not-any over the prefix and pred over the head of the rest are the two halves of maximality here.',
         'The never-matches case leaves the whole list in front and an empty remainder; the always-matches case is its mirror.')),
    r5=([('eng-composition', "(define (first-field row sep)\n  (let-values (((f rest) (break (lambda (c) (char=? c sep)) row)))\n    (list 'field f 'rest rest)))\n(display (first-field (list #\\a #\\, #\\b) #\\,))\n(newline)"),
         ('math-composition', "(define (split-on p xs)\n  (if (null? xs)\n      (list (list))\n      (let-values (((b r) (break p xs)))\n        (if (null? r)\n            (list b)\n            (cons b (split-on p (cdr r)))))))\n(display (split-on even? (list 1 3 4 5 6 7)))\n(newline)"),
         ('cs-composition', "(define (until-error lines)\n  (let-values (((clean rest) (break (lambda (l) (eq? l 'error)) lines)))\n    (list 'clean-count (length clean) 'stopped (not (null? rest)))))\n(display (until-error (list 'ok 'ok 'error 'ok)))\n(newline)"),
         ('base', 'break! cuts a list just before the first element satisfying a predicate and returns both parts.'),
         ('emergent', 'eng: field extraction, the parser\'s smallest step. math: repeated breaking with an explicit cdr past the delimiter is full string-splitting, and that cdr is the line the delimiter-keeping rule exists to make you write on purpose. cs: an early-stop scan that reports both the clean run and whether it stopped, which is more useful than either alone.'),
         ('meta', 'The family is delimiter-driven parsing. What emerges is that the awkward-looking choice to keep the delimiter is what lets the caller decide whether to drop it, and that decision differs between splitting and error reporting.')],
        ('An API that keeps the marker lets the caller choose; one that eats it has already chosen for them.',
         'Splitting on a delimiter is repeated breaking plus an explicit skip; the skip is a separate decision.',
         'Reporting whether the scan stopped early is why break returns two values instead of a truncated list.')),
)

# ---------------------------------------------------------------------------
# FAMILY C -- relink the spine. append!/concatenate!/append-reverse!/reverse!
# ---------------------------------------------------------------------------

APPEND_BANG = dict(
    name='append!', std='SRFI-1', library='list', kind='state-change',
    signature='(append! lst ...) -> list',
    summary='The arguments joined end to end by relinking their last cells, rather than by copying. Every argument but the last is destroyed.',
    explanation=(
        'append copies every argument except the last, because it must not disturb them. append! '
        'copies nothing: it walks to the end of each list and writes the next list into that last '
        'cell. The suite pins the sharing exactly at list.sld:339-349 -- the result is eq? to the '
        'first argument, and the cells of every later argument appear in the result unchanged. '
        + LESSON + ' Two details a caller will meet. Empty arguments are skipped, so '
        '(append! x y \'() z) joins three lists and the empty one leaves no trace. And append! is '
        'NOT cheap: it must find each list\'s end, so it costs a full traversal of every argument '
        'but the last. What it saves is allocation, not time. Anyone reaching for it because "the '
        'destructive one is O(1)" has the wrong model -- that is what set-cdr! on a held last cell '
        'is for, and append! is the version that does not make you hold the cell.'),
    examples=[
        ('novice',
         "(define a (list 1 2))\n(define b (list 3 4))\n(display (append! a b))\n(newline)"),
        ('intermediate',
         ";; a is the result; b is now a suffix of a.\n"
         "(define a (list 1 2))\n(define b (list 3 4))\n(define joined (append! a b))\n"
         "(display (list 'joined-is-a (eq? joined a) 'b-inside (eq? (cddr joined) b)))\n(newline)"),
        ('expert',
         ";; empty arguments are skipped; later mutation of b shows through the result.\n"
         "(define a (list 1 2))\n(define b (list 3 4))\n(define c (list 5 6))\n"
         "(define joined (append! a b (list) c))\n(set-car! b 99)\n"
         "(display (list 'joined joined))\n(newline)"),
    ],
    caveats=[
        'Every argument but the last is destroyed. list.sld:339-349 asserts the result is eq? to the first argument and contains the later arguments\' own cells.',
        'The later arguments remain live inside the result. Mutating one of them afterwards changes the result too.',
        'It costs a traversal of every argument but the last, so it is NOT constant time. It saves allocation only.',
        'Empty arguments are skipped and contribute nothing, including no cell to relink.',
        'If the same list is passed twice you have built a cycle, and anything that walks the result will not stop.',
    ],
    drawbacks=[
        'Passing a list you did not build makes the caller\'s list a suffix of yours, which is action at a distance in both directions.',
        'The traversal cost surprises people who chose it for speed; the pure append costs the same walk plus one allocation.',
        'The aliasing rules out reuse: an argument to append! can never be appended again.',
    ],
    usecases=[
        'Assembling a large result from freshly-built segments inside a single producer.',
        'Accumulator patterns where each segment is built, appended and never referred to again.',
        'Avoiding a copy of a very large prefix when the prefix is provably single-owner.',
    ],
    related=['append', 'concatenate!', 'append-reverse!', 'reverse!', 'set-cdr!'],
    learn=('Relinking versus copying, and why relinking is not free',
           ['append', 'set-cdr!', 'last-pair', 'eq?'],
           'Understand what append copies and why. Then look at where append! writes, and count the traversals -- the count is the surprise.'),
    provenance='SRFI-1 linear-update procedures; conformance evidence scratch/r7rs-conformance/larceny/list.sld:339-349; signature derived from the append record in scheme/reference/39-list.slat. Drafted 2026-08-03; NOT RUN.',
    status='needs-alfred',
    r2=([('eng-program', "(define a (list 1 2))\n(define b (list 3 4))\n(display (append! a b))\n(newline)"),
         ('math-program', "(define a1 (list 1 2))\n(define b1 (list 3 4))\n(define a2 (list 1 2))\n(define b2 (list 3 4))\n(display (equal? (append a1 b1) (append! a2 b2)))\n(newline)"),
         ('cs-program', "(define a (list 1 2))\n(define b (list 3 4))\n(define joined (append! a b))\n(display (list 'result-is-first-arg (eq? joined a) 'second-arg-embedded (eq? (cddr joined) b)))\n(newline)"),
         ('problem', 'The operator is assembling one long list out of many freshly-built segments. Candidates: append (copies every segment but the last, source lists all survive), a fold with cons over the reversed segments (one allocation per element, no traversal of ends), or append! (no allocation, every segment but the last destroyed). The measurement that decides this is allocation pressure, and the fact that changes it is ownership -- if any segment came from outside the producer, append! is wrong regardless of what the profiler says.'),
         ('explanation', 'eng: the segments become one list and the segment variables are no longer independent. math: append! agrees with append as a value for every sequence of proper lists. cs: the eq? checks are the observable difference, and they are what makes a later mutation of any segment visible in the result.'),
         ('meta', 'The performance argument for append! is narrower than people assume: it removes allocation and keeps the traversal. Reaching for it to remove the traversal is a misread.')],
        ('Know which cost you are removing. Removing allocation and removing traversal are different purchases.',
         'append and append! are the same function of their arguments; only the survivors differ.',
         'Building a cycle by passing the same list twice is the sharp edge, and nothing warns you.')),
    r3=([('setup', 'Joining sequences by connecting the end of one to the start of the next, instead of copying them into a new sequence.'),
         ('rungs', [
             ('list', "(display (append! (list 1 2) (list 3 4)))\n(newline)"),
             ('coupling two rakes of wagons', "(define front (list 'loco 'car1))\n(define back (list 'car2 'van))\n(display (append! front back))\n(newline)"),
             ('splicing two spools of tape', "(define reel-a (list 'a1 'a2))\n(define reel-b (list 'b1 'b2))\n(display (append! reel-a reel-b))\n(newline)"),
         ]),
         ('explanation', 'In list, the last cell of one list is made to point at the next. Coupling two rakes is the same act performed with a coupler: no wagons are built, and afterwards there is one train, not two. Splicing tape joins two reels into one and there is no way to hand someone reel-a afterwards. All three share a join that consumes the separateness of the parts.'),
         ('meta', 'The shape transfers wherever joining is physical rather than descriptive -- where after the join the parts no longer independently exist.')],
        ('A physical join destroys the parts. A described join does not. Know which one your verb is.',
         'Concatenation is associative, which is why the multi-argument form is well-defined without bracketing.',
         'Walking to the end of each segment is the hidden cost, and it is why an accumulator that keeps the last cell beats repeated appending.')),
    r4=([('eng-program', "(define a (list 1 2))\n(define b (list 3 4))\n(define j (append! a b))\n(display (list 'joined j 'len (length j)))\n(newline)"),
         ('math-program', "(define (assoc-holds?)\n  (let ((l (append (list 1) (append (list 2) (list 3))))\n        (r (append (append (list 1) (list 2)) (list 3))))\n    (equal? l r)))\n(display (assoc-holds?))\n(newline)"),
         ('cs-program', "(define a (list 1 2))\n(define b (list 3 4))\n(define j (append! a b))\n(set-car! b 99)\n(display (list 'mutating-b-changed-the-result j))\n(newline)"),
         ('claim', 'For proper lists l1..ln, append! returns a list equal? to (append l1 ... ln). The result is eq? to the first non-empty argument, and the cells of every later argument are present in the result unchanged, so a subsequent mutation of any argument is visible through the result.'),
         ('invariant', 'forall proper l1..ln. equal?(append!(l1,...,ln), append(l1,...,ln)) and eq?(append!(l1,...,ln), first-non-empty(l1,...,ln))'),
         ('meta', 'The pattern is value-equality with structural sharing. What would falsify the claim: disagreement with append, a fresh list where the first argument was required, or a later argument being copied instead of embedded. The mutation program is the sharpest test -- an implementation that copies passes every equal? check and fails this one.')],
        ('The mutation-after-join check is the one that catches a copying implementation. Nothing else does.',
         'Associativity means the n-ary form needs no bracketing rule, which is why SRFI-1 spells it variadic.',
         'Structural sharing is the feature and the hazard, and they cannot be separated.')),
    r5=([('eng-composition', "(define (assemble! . segments)\n  (if (null? segments) (list) (apply append! segments)))\n(display (assemble! (list 1 2) (list 3) (list 4 5)))\n(newline)"),
         ('math-composition', "(define (flatten-once xss)\n  (apply append xss))\n(display (flatten-once (list (list 1 2) (list 3) (list 4 5))))\n(newline)"),
         ('cs-composition', "(define (build-with-tail-pointer items)\n  (let loop ((rest items) (acc (list)))\n    (if (null? rest) (reverse acc) (loop (cdr rest) (cons (car rest) acc)))))\n(display (build-with-tail-pointer (list 1 2 3)))\n(newline)"),
         ('base', 'append! joins lists by writing each one into the last cell of the one before it.'),
         ('emergent', 'eng: a variadic assembler, which is what apply plus append! buys you. math: concatenate is exactly this with the segments already in a list, which is why SRFI-1 ships both and why concatenate! is not redundant. cs: the accumulate-and-reverse idiom is the version that never appends at all -- it is O(n) total where repeated appending is O(n squared), and it is the right answer far more often than either append or append!.'),
         ('meta', 'The family is list assembly. What emerges is that the interesting choice is usually not append versus append!, but whether to append at all -- cons-and-reverse beats both, and reaching for a destructive append is often a sign the accumulator was built the wrong way round.')],
        ('The best fix for a slow append is usually to stop appending, not to append destructively.',
         'Repeated concatenation is quadratic; accumulation with a single final reversal is linear.',
         'cons-and-reverse allocates more and runs faster, which is a useful corrective to allocation-counting.')),
)

CONCATENATE_BANG = dict(
    name='concatenate!', std='SRFI-1', library='list', kind='state-change',
    signature='(concatenate! lst-of-lsts) -> list',
    summary='The lists inside one list of lists, joined by relinking. Every inner list but the last is destroyed.',
    explanation=(
        'concatenate! is append! with the arguments already collected into a list, which is the '
        'form you are in when the segments were produced by a map or a loop rather than written '
        'out at the call site. It is not a convenience wrapper you could skip: (apply append! xss) '
        'breaks on a long xss because implementations limit argument counts, and concatenate! has '
        'no such limit. The suite exercises it at list.sld:353-354 with an embedded empty list, '
        'confirming empties are skipped exactly as in append!. ' + LESSON + ' The outer list is '
        'not destroyed -- its cells are untouched -- but every inner list except the last is, and '
        'after the call the outer list is a list of aliases into one long chain rather than a list '
        'of independent lists.'),
    examples=[
        ('novice',
         "(display (concatenate! (list (list 1 2) (list 3 4) (list 5))))\n(newline)"),
        ('intermediate',
         ";; the inner lists are consumed; the outer list still holds handles into\n"
         ";; the middle of the result.\n"
         "(define first-seg (list 1 2))\n(define second-seg (list 3 4))\n"
         "(define result (concatenate! (list first-seg second-seg)))\n"
         "(display (list 'result-is-first (eq? result first-seg) 'second-embedded (eq? (cddr result) second-seg)))\n(newline)"),
        ('expert',
         ";; embedded empty lists contribute nothing at all.\n"
         "(display (concatenate! (list (list 1 2) (list) (list 3))))\n(newline)"),
    ],
    caveats=[
        'Every inner list but the last is destroyed. list.sld:353-354 gives the value; the structure follows append!, list.sld:339-349.',
        'The OUTER list is not modified, so it survives as a list of aliases pointing into the middle of the result.',
        'Empty inner lists are skipped and leave no trace.',
        'Prefer this to (apply append! xss): apply is limited by the implementation\'s argument count and this is not.',
        'A repeated inner list makes a cycle, exactly as a repeated argument does in append!.',
    ],
    drawbacks=[
        'The surviving outer list is a loaded weapon -- each of its elements is now a pointer into a shared chain.',
        'Cost is a traversal of every inner list but the last, so it is linear in the total length, not in the number of segments.',
        'It cannot be applied twice to the same structure, which rules it out of any iterative assembly.',
    ],
    usecases=[
        'Flattening one level of a map result inside a producer that owns everything it made.',
        'Joining a long run of segments where the count would defeat apply.',
        'Assembling output buffers in a pipeline stage that is the last reader of its input.',
    ],
    related=['concatenate', 'append!', 'append-map', 'append', 'reverse!'],
    learn=('Collected arguments and the limits of apply',
           ['concatenate', 'append!', 'apply', 'map'],
           'Learn concatenate, then append!, then ask why SRFI-1 ships a separate name instead of telling you to use apply. The answer is a real limit, not tidiness.'),
    provenance='SRFI-1 linear-update procedures; conformance evidence scratch/r7rs-conformance/larceny/list.sld:353-354 (value) and 339-349 (the append! structure it inherits); signature derived from the concatenate record in scheme/reference/39-list.slat. Drafted 2026-08-03; NOT RUN.',
    status='needs-alfred',
    r2=([('eng-program', "(display (concatenate! (list (list 1 2) (list 3 4))))\n(newline)"),
         ('math-program', "(define a (list (list 1 2) (list 3)))\n(define b (list (list 1 2) (list 3)))\n(display (equal? (concatenate a) (concatenate! b)))\n(newline)"),
         ('cs-program', "(define seg (list 3 4))\n(define result (concatenate! (list (list 1 2) seg)))\n(display (eq? (cddr result) seg))\n(newline)"),
         ('problem', 'The operator has a list of segments produced by a map and wants one flat list. Candidates: concatenate (copies all but the last segment), (apply append! segs) (works until the segment count exceeds what apply allows, then fails at run time on exactly the large inputs you built it for), or concatenate! (no allocation, no argument limit, segments destroyed). The apply form is the trap: it passes every small test.'),
         ('explanation', 'eng: one flat list comes back and the segments are no longer separate lists. math: concatenate! agrees with concatenate for every list of proper lists. cs: the outer list survives holding pointers into the middle of the chain, which is a state worth naming because nothing about the call suggests it.'),
         ('meta', 'A limit that only bites at scale is the most expensive kind. The named verb exists to remove it, not to save typing.')],
        ('A form that fails only on large inputs will pass review and fail in production.',
         'Concatenation of a sequence of sequences is a fold; the variadic and collected forms are the same operation.',
         'Argument-count limits are real and implementation-specific, which is why the standard provides the collected form.')),
    r3=([('setup', 'Joining a collection of sequences into one, by relinking rather than copying.'),
         ('rungs', [
             ('list', "(display (concatenate! (list (list 1 2) (list 3))))\n(newline)"),
             ('joining a yard full of rakes into one train', "(define rakes (list (list 'a1 'a2) (list 'b1) (list 'c1 'c2)))\n(display (concatenate! rakes))\n(newline)"),
             ('splicing a box of tape reels end to end', "(define reels (list (list 'r1a 'r1b) (list 'r2a)))\n(display (concatenate! reels))\n(newline)"),
         ]),
         ('explanation', 'In list, each inner list is written into the end of the one before it. Joining every rake in a yard gives one train and empties the yard of separate rakes, though the yard\'s paperwork still lists them. Splicing a box of reels gives one reel and a box of labels that no longer describe anything separable. All three share a surviving index over parts that have stopped being parts.'),
         ('meta', 'The shape transfers wherever a catalogue outlives the separateness of the things it catalogues.')],
        ('The stale index is the real hazard here, not the join itself.',
         'Concatenation over a collection is the monoid fold; the empty segment is the identity and vanishes.',
         'Holding references into the interior of a merged structure is how use-after-merge bugs get written.')),
    r4=([('eng-program', "(define r (concatenate! (list (list 1 2) (list 3 4))))\n(display (list 'result r 'len (length r)))\n(newline)"),
         ('math-program', "(define (identity-skipped?)\n  (equal? (concatenate (list (list 1) (list) (list 2)))\n          (concatenate (list (list 1) (list 2)))))\n(display (identity-skipped?))\n(newline)"),
         ('cs-program', "(define segs (list (list 1 2) (list 3)))\n(define kept (cadr segs))\n(define r (concatenate! segs))\n(display (list 'outer-list-still-points-inside (eq? (cddr r) kept)))\n(newline)"),
         ('claim', 'For a list of proper lists xss, concatenate! returns a list equal? to (concatenate xss) and to (apply append! xss) where apply is able to accept the count. Empty inner lists contribute nothing. The result is eq? to the first non-empty inner list, and every later inner list is embedded in it.'),
         ('invariant', 'forall list-of-proper-lists xss. equal?(concatenate!(xss), concatenate(xss)) and concatenate!(xss) contains each non-empty element of xss as a suffix-sharing sublist'),
         ('meta', 'The pattern is a fold of a monoid with the empty list as identity. What would falsify the claim: an empty segment leaving a trace, disagreement with concatenate, or a segment copied rather than embedded. The outer-list program is the one that documents the surviving-alias hazard rather than testing the claim.')],
        ('One of these programs proves the claim and one documents the hazard. Both belong in the record.',
         'The empty list is the identity of concatenation, which is why skipping it is required rather than optional.',
         'Suffix-sharing is checkable with eq? and invisible to equal?, which is the whole reason this record exists.')),
    r5=([('eng-composition', "(define (flatten-segments! segs) (concatenate! segs))\n(display (flatten-segments! (list (list 1) (list 2 3))))\n(newline)"),
         ('math-composition', "(define (append-map-like f xs) (concatenate (map f xs)))\n(display (append-map-like (lambda (n) (list n n)) (list 1 2)))\n(newline)"),
         ('cs-composition', "(define (join-rows rows) (concatenate rows))\n(display (join-rows (list (list 'a 'b) (list 'c))))\n(newline)"),
         ('base', 'concatenate! joins a list of lists into one by relinking the inner lists.'),
         ('emergent', 'eng: a flattening step for a pipeline stage that owns its input. math: concatenate composed with map is append-map, which is why SRFI-1 ships append-map as its own verb -- and why append-map! exists too, with the same hazards as this one. cs: row joining is the everyday case, and it is written pure here because rows almost always have another owner.'),
         ('meta', 'The family is one-level flattening. What emerges is the composition map-then-concatenate, and the observation that the destructive version is only safe when the map itself produced the segments -- which is exactly when append-map! would have been the better call.')],
        ('If the segments came from a map you just ran, the fused verb is clearer than the two-step.',
         'map followed by concatenate is bind; recognising it names the whole family.',
         'The safety argument and the fusion argument point the same way, which is a good sign the API is right.')),
)

APPEND_REVERSE_BANG = dict(
    name='append-reverse!', std='SRFI-1', library='list', kind='state-change',
    signature='(append-reverse! rev-head tail) -> list',
    summary='The elements of rev-head in reverse order followed by tail, built by turning rev-head\'s own cells around. rev-head is destroyed.',
    explanation=(
        'append-reverse! is the accumulator-flushing verb. The standard way to build a list is to '
        'cons onto an accumulator, which leaves it backwards, and then reverse it -- and if there '
        'is something to attach afterwards, append-reverse does both steps in one pass. The '
        'destructive form does it without allocating: it walks rev-head reversing each cdr in '
        'place, and the last cell it turns around is made to point at tail. The suite gives the '
        'value at list.sld:358. ' + LESSON + ' Note the asymmetry, because it is the useful part: '
        'rev-head is destroyed and tail is NOT. tail is simply the thing the reversed cells end up '
        'pointing at, so passing a shared list as tail is safe, while passing one as rev-head is '
        'not. That asymmetry is what makes the verb usable in a loop whose accumulator is private '
        'and whose result tail is not.'),
    examples=[
        ('novice',
         "(display (append-reverse! (list 3 2 1) (list 4 5 6)))\n(newline)"),
        ('intermediate',
         ";; rev-head is consumed; tail is embedded untouched.\n"
         "(define acc (list 3 2 1))\n(define tail (list 4 5))\n"
         "(define out (append-reverse! acc tail))\n"
         "(display (list 'out out 'tail-embedded (eq? (cdddr out) tail)))\n(newline)"),
        ('expert',
         ";; the accumulator flush: build backwards, then flush onto what follows.\n"
         "(define (collect-then-flush items rest)\n  (let loop ((xs items) (acc (list)))\n    (if (null? xs)\n        (append-reverse! acc rest)\n        (loop (cdr xs) (cons (car xs) acc)))))\n"
         "(display (collect-then-flush (list 1 2 3) (list 'end)))\n(newline)"),
    ],
    caveats=[
        'rev-head is destroyed; tail is not. list.sld:358 gives the value, and the asymmetry follows from reversing rev-head\'s cells in place.',
        'tail is embedded, not copied, so later mutation of tail shows through the result.',
        'tail need not be a proper list -- whatever it is becomes the terminator, exactly as in append-reverse.',
        'Passing the same list as both arguments builds a cycle.',
    ],
    drawbacks=[
        'The asymmetry between the two arguments is invisible at the call site and easy to get backwards.',
        'It only pays off when rev-head is a private accumulator, which is a narrower situation than it appears.',
        'Reversing in place makes rev-head unusable even for error reporting after the call.',
    ],
    usecases=[
        'Flushing a cons-built accumulator onto an existing tail at the end of a loop.',
        'Building a list front-to-back in linear time with no intermediate reversal allocation.',
        'The last step of a hand-written map or filter written with an accumulator.',
    ],
    related=['append-reverse', 'reverse!', 'append!', 'reverse', 'fold'],
    learn=('Accumulator flushing, and reading argument asymmetry',
           ['reverse', 'append-reverse', 'cons', 'fold'],
           'Write a loop that conses onto an accumulator and reverses at the end. Then replace the last two steps with append-reverse and see the pass disappear.'),
    provenance='SRFI-1 linear-update procedures; conformance evidence scratch/r7rs-conformance/larceny/list.sld:358; signature derived from the append-reverse record in scheme/reference/39-list.slat. Drafted 2026-08-03; NOT RUN.',
    status='needs-alfred',
    r2=([('eng-program', "(display (append-reverse! (list 3 2 1) (list 4 5)))\n(newline)"),
         ('math-program', "(define a (list 3 2 1))\n(define b (list 3 2 1))\n(display (equal? (append-reverse a (list 4)) (append-reverse! b (list 4))))\n(newline)"),
         ('cs-program', "(define tail (list 4 5))\n(define out (append-reverse! (list 3 2 1) tail))\n(display (eq? (cdddr out) tail))\n(newline)"),
         ('problem', 'The operator has finished a cons-accumulator loop and needs the result in order, attached to an existing tail. Candidates: (append (reverse acc) tail) (two passes, two allocations), (append-reverse acc tail) (one pass, one allocation, acc survives), or append-reverse! (one pass, no allocation, acc destroyed). Because acc is private to the loop by construction, this is one of the few places where the destructive choice is genuinely uncontroversial.'),
         ('explanation', 'eng: the accumulator comes back the right way round and joined to the tail. math: append-reverse!(h, t) = append(reverse(h), t) for every proper h. cs: tail is embedded rather than copied, which is what makes the operation allocation-free and what makes a shared tail still safe.'),
         ('meta', 'This is the case that justifies the whole linear-update family: a value with exactly one owner, produced and consumed inside one function.')],
        ('The clean case for destruction is a value that was born and dies inside one function.',
         'append-reverse fuses a reversal and a concatenation into one traversal.',
         'Argument asymmetry is a design tool: destroy the private one, share the public one.')),
    r3=([('setup', 'Turning a backwards-built pile the right way round and attaching it to what follows.'),
         ('rungs', [
             ('list', "(display (append-reverse! (list 3 2 1) (list 4)))\n(newline)"),
             ('a stack of plates emptied onto a shelf', "(define stack (list 'top 'middle 'bottom))\n(define shelf (list 'existing))\n(display (append-reverse! stack shelf))\n(newline)"),
             ('a shunting siding cleared onto the main line', "(define siding (list 'w3 'w2 'w1))\n(define main (list 'm1))\n(display (append-reverse! siding main))\n(newline)"),
         ]),
         ('explanation', 'In list, the cells of rev-head are turned around and the last points at tail. Emptying a stack of plates onto a shelf takes them off in the opposite order to the one they went on, which is the reversal, and the shelf is not disturbed. Clearing a shunting siding onto the main line is the same move: the siding empties, the main line grows, and the wagons come out reversed. All three share a last-in-first-out store discharging into a first-in-first-out one.'),
         ('meta', 'The shape transfers wherever a stack empties into a queue -- the reversal is not an extra step, it is what the discharge IS.')],
        ('The reversal is free because it is the discharge order, not a separate operation.',
         'A stack read out is a reversed sequence; that is the definition, not a consequence.',
         'This is why accumulator-then-reverse is the standard list-building idiom rather than a workaround.')),
    r4=([('eng-program', "(define out (append-reverse! (list 3 2 1) (list 4 5)))\n(display (list 'out out 'len (length out)))\n(newline)"),
         ('math-program', "(define (law? h t)\n  (let ((h2 (list-copy h)))\n    (equal? (append-reverse! h2 t) (append (reverse h) t))))\n(display (list (law? (list 3 2 1) (list 4)) (law? (list) (list 4)) (law? (list 1) (list))))\n(newline)"),
         ('cs-program', "(define t (list 4 5))\n(define out (append-reverse! (list 3 2 1) t))\n(set-car! t 99)\n(display (list 'tail-mutation-visible out))\n(newline)"),
         ('claim', 'For a proper list rev-head and any object tail, append-reverse! returns a value equal? to (append (reverse rev-head) tail). rev-head\'s cells are re-used to build the result; tail is embedded unchanged and is not copied.'),
         ('invariant', 'forall proper h, any t. equal?(append-reverse!(h, t), append(reverse(h), t)) and t is a suffix of the result by identity, not by copy'),
         ('meta', 'The pattern is fused reverse-and-append. What would falsify the claim: disagreement with the two-step form, or a copied tail -- and the empty-rev-head case, where the result must be tail itself, is the boundary that catches implementations that always allocate.')],
        ('The empty-accumulator case must return the tail unchanged; that is where an always-allocating implementation shows itself.',
         'The law append-reverse(h,t) = append(reverse(h),t) is the specification; the fusion is the optimisation.',
         'Testing tail identity with a mutation is the only way to see the difference from the pure form.')),
    r5=([('eng-composition', "(define (flush! acc rest) (append-reverse! acc rest))\n(display (flush! (list 3 2 1) (list 4)))\n(newline)"),
         ('math-composition', "(define (my-map f xs)\n  (let loop ((rest xs) (acc (list)))\n    (if (null? rest)\n        (append-reverse! acc (list))\n        (loop (cdr rest) (cons (f (car rest)) acc)))))\n(display (my-map (lambda (n) (* n n)) (list 1 2 3)))\n(newline)"),
         ('cs-composition', "(define (my-reverse xs) (append-reverse xs (list)))\n(display (my-reverse (list 1 2 3)))\n(newline)"),
         ('base', 'append-reverse! turns a backwards accumulator round in place and attaches it to a tail.'),
         ('emergent', 'eng: the flush step, named. math: a hand-written map falls out of it -- accumulate forwards, flush at the end -- and this is how map is actually implemented in most Schemes. cs: reverse itself is append-reverse with an empty tail, which is worth noticing because it means reverse! and append-reverse! are one function with a default argument.'),
         ('meta', 'The family is accumulator discipline. What emerges is that reverse, map, filter and append-reverse are all the same loop with different bodies, and the flush is the only part that varies.')],
        ('Once you see the flush, every list-building loop looks the same, and that is the point.',
         'reverse is the special case with an empty tail; the general verb subsumes it.',
         'This is why a Scheme implementation can define reverse!, map and filter over one internal helper.')),
)

REVERSE_BANG = dict(
    name='reverse!', std='SRFI-1', library='list', kind='state-change',
    signature='(reverse! lst) -> list',
    summary='The elements of lst in reverse order, built by turning lst\'s own cells around. The argument is destroyed.',
    explanation=(
        'reverse allocates one cell per element and leaves its argument alone. reverse! allocates '
        'nothing: it walks the spine turning every cdr to point backwards, so the cell that was '
        'first becomes last and the cell that was last is returned. ' + LESSON + ' The specific '
        'shape of the damage is worth stating because it is not the usual one -- after '
        '(reverse! xs), xs still names a valid list, but it is the ONE-ELEMENT list holding what '
        'used to be the first element. It has not become empty and it has not become the reversed '
        'list. That is the most confusing outcome in this whole family, because the variable still '
        'works and still prints, and it is wrong. There is no test for reverse! anywhere in the '
        'conformance suite (list.sld names it at :84 with no body), so this record rests on the '
        'structure of the operation rather than on evidence from the repo.'),
    examples=[
        ('novice',
         "(display (reverse! (list 1 2 3)))\n(newline)"),
        ('intermediate',
         ";; xs is left naming the one-element list (1), not the reversed list.\n"
         "(define xs (list 1 2 3))\n(define r (reverse! xs))\n"
         "(display (list 'reversed r 'xs-now xs))\n(newline)"),
        ('expert',
         ";; the pure form is what you want unless the argument is private.\n"
         "(define shared (list 1 2 3))\n(define safe (reverse shared))\n"
         "(display (list 'safe safe 'shared-intact shared))\n(newline)"),
    ],
    caveats=[
        'The argument is destroyed. After the call the argument variable names a one-element list holding what was the first element -- it does not name the reversed list and it is not empty.',
        'That outcome is a valid list, so nothing signals the error. This is the most quietly wrong of the linear-update verbs.',
        'There is NO test for reverse! in scratch/r7rs-conformance/larceny/list.sld (named at :84, no body). This record is derived from the structure of an in-place reversal, not from in-repo evidence.',
        'reverse! is append-reverse! with an empty tail; if you need to attach something afterwards, use append-reverse! and save a pass.',
    ],
    drawbacks=[
        'The half-valid leftover binding is a worse failure mode than an outright error would be.',
        'It saves allocation only, and reverse is already a single linear pass.',
        'Nothing in the engine or the reader can warn about a stale reference to a reversed list.',
    ],
    usecases=[
        'Flipping a private accumulator at the end of a loop when nothing else holds it.',
        'In-place reversal of a large freshly-built list where the allocation is measured and material.',
        'Implementing other list verbs internally, where the ownership argument is local and checkable.',
    ],
    related=['reverse', 'append-reverse!', 'append!', 'list-copy', 'fold'],
    learn=('When the wreckage is still a valid value',
           ['reverse', 'set-cdr!', 'append-reverse!', 'eq?'],
           'Reverse a list purely. Then reason about what the argument variable must point at after an in-place reversal, before you run it. That prediction is the lesson.'),
    provenance='SRFI-1 linear-update procedures; NAMED at scratch/r7rs-conformance/larceny/list.sld:84 with NO TEST BODY -- no in-repo behavioural evidence exists for this verb. Signature derived from the reverse record in scheme/reference/39-list.slat; semantics derived from the structure of an in-place spine reversal. Drafted 2026-08-03; NOT RUN.',
    status='needs-alfred',
    r2=([('eng-program', "(display (reverse! (list 1 2 3)))\n(newline)"),
         ('math-program', "(define a (list 1 2 3))\n(define b (list 1 2 3))\n(display (equal? (reverse a) (reverse! b)))\n(newline)"),
         ('cs-program', "(define xs (list 1 2 3))\n(define r (reverse! xs))\n(display (list 'reversed r 'argument-variable-now xs))\n(newline)"),
         ('problem', 'The operator has a backwards accumulator and wants it forwards. Candidates: reverse (one pass, n cells allocated, argument intact), reverse! (one pass, nothing allocated, argument left naming a one-element list), or append-reverse! if anything is to be attached afterwards (one pass, nothing allocated, and no separate append). If a tail exists at all, the third is strictly better than the first two.'),
         ('explanation', 'eng: the reversed list comes back and the old variable is left holding a stub. math: reverse! agrees with reverse as a value on every proper list. cs: the stub is what makes this verb dangerous -- a destroyed binding that still type-checks and still prints.'),
         ('meta', 'Ask what the argument variable points at afterwards. For most of this family the answer is "a truncated list"; for reverse! it is "a one-element list", and that surprises people.')],
        ('Predict the wreckage before you run the verb. If you cannot, do not use the destructive form.',
         'Value agreement with reverse is total; the argument variable is where they part.',
         'A destroyed binding that remains a valid value is the failure mode static checking cannot reach.')),
    r3=([('setup', 'Turning a sequence around by re-pointing its links, rather than by building a new one.'),
         ('rungs', [
             ('list', "(display (reverse! (list 1 2 3)))\n(newline)"),
             ('a train run round a loop', "(define rake (list 'loco 'car1 'van))\n(display (reverse! rake))\n(newline)"),
             ('a stack emptied into another stack', "(define s (list 'top 'mid 'bottom))\n(display (reverse! s))\n(newline)"),
         ]),
         ('explanation', 'In list, every cdr is turned to point at its predecessor. A train run round a loop comes back with the van leading and the loco at the rear; no wagons were built and the rake as it was does not exist any more. A stack emptied into another stack arrives in the opposite order for the same reason. All three share an order change achieved by moving connections rather than contents.'),
         ('meta', 'The shape transfers wherever reversal is a property of traversal rather than of storage.')],
        ('Moving the connections is cheaper than moving the contents, and it destroys the original arrangement.',
         'Reversal is an involution: doing it twice returns the original order.',
         'Pointer reversal is the classic in-place list algorithm and the one every linked-list interview asks for.')),
    r4=([('eng-program', "(define r (reverse! (list 1 2 3)))\n(display (list 'r r 'len (length r)))\n(newline)"),
         ('math-program', "(define (involution? xs)\n  (equal? (reverse (reverse xs)) xs))\n(display (list (involution? (list)) (involution? (list 1)) (involution? (list 1 2 3))))\n(newline)"),
         ('cs-program', "(define xs (list 1 2 3))\n(define r (reverse! xs))\n(display (list 'argument-is-now-a-stub (equal? xs (list 1)) 'result-is-old-last-cell (equal? r (list 3 2 1))))\n(newline)"),
         ('claim', 'For a proper list lst, reverse! returns a list equal? to (reverse lst). The returned list is built from lst\'s own cells, and the argument variable is left naming a one-element list holding the original first element. reverse! is append-reverse! with an empty tail.'),
         ('invariant', 'forall proper lst. equal?(reverse!(lst), reverse(lst)) and reverse!(lst) = append-reverse!(lst, ())'),
         ('meta', 'The pattern is in-place pointer reversal. What would falsify the claim: disagreement with reverse, or an argument variable left naming something other than a one-element list -- but note that nothing in the repo tests this, so the second half of the claim is derivation, not evidence, and it is why the record is marked needs-alfred.')],
        ('Say plainly which half of a claim is evidence and which is derivation. The reader cannot tell otherwise.',
         'Involution is the property worth testing on the pure form; the destructive form cannot be applied twice to check it.',
         'The absence of a conformance test is itself a finding, and it belongs in the record rather than in a side note.')),
    r5=([('eng-composition', "(define (flip! xs) (reverse! xs))\n(display (flip! (list 1 2 3)))\n(newline)"),
         ('math-composition', "(define (reverse-via-append-reverse xs) (append-reverse xs (list)))\n(display (reverse-via-append-reverse (list 1 2 3)))\n(newline)"),
         ('cs-composition', "(define (palindrome? xs) (equal? xs (reverse xs)))\n(display (list (palindrome? (list 1 2 1)) (palindrome? (list 1 2))))\n(newline)"),
         ('base', 'reverse! turns a list around by re-pointing its cells.'),
         ('emergent', 'eng: the flip step at the end of an accumulator loop. math: reverse expressed through append-reverse shows the two are one verb, and it is the form that generalises. cs: a palindrome check needs the argument twice, so it can never use the destructive form -- the second reference is already gone.'),
         ('meta', 'The family is order inversion. What emerges is a simple test for whether a destructive verb is admissible at all: count the references to the argument after the call. One is fine, two is a bug.')],
        ('Count the uses of the argument after the call. More than none means the pure verb.',
         'A predicate comparing a value to its own reversal needs both, which rules out in-place reversal by construction.',
         'The reference count is the cheapest static check a reviewer can apply to a bang verb.')),
)
