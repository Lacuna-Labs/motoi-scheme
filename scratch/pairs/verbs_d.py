#!/usr/bin/env python3
"""verbs_d.py -- structure verbs and the two R7RS pair mutators.

Priya, 2026-08-03. Companion to verbs_table.py; same rules apply.

These six are not linear-update verbs. They are the ones whose MEANING depends
on real cons cells existing, which is why they are in this set at all:

  circular-list  cannot exist without a cdr that can point backwards.
  pair-fold      hands the caller a cell, which presupposes cells.
  last-pair      must return the argument's own final cell.
  list-copy      must produce a fresh cell at every spine position.
  set-car!       writes into a cell.
  set-cdr!       writes into a cell and must SHARE the new tail, not copy it.

Five of the six are impossible or wrong under the flat-array representation,
and they are a large part of why it is changing. list-copy is the exception:
its record makes no claim about Motoi today and carries no :status, because a
shallow copy of an array satisfies the observable contract. What it loses is
only the ability to STATE the contract -- "every spine cell is fresh" is not
false under flat arrays, it is unsayable, since there are no cells to compare.
That is why the suite's per-position (not (eq? c cp)) walk at list.sld:218-232
is the assertion to re-run first once cells exist.
"""

CIRCULAR_LIST = dict(
    name='circular-list', std='SRFI-1', library='list', kind='constructor',
    signature='(circular-list elt ...) -> circular list',
    summary='A list of the given elements whose last cell points back at the first, so walking it never ends.',
    explanation=(
        'circular-list builds a chain of cells and then writes the first cell into the cdr of the '
        'last one. The result has no end. It is not a proper list, because a proper list '
        'terminates in the empty list; it is not a dotted list, because a dotted list terminates '
        'in a non-list object; it is the third case, and SRFI-1 gives it a predicate of its own. '
        'The suite checks all four classifications at list.sld:234-242 and 251-265, and it also '
        'checks the wrap directly: for (circular-list a b c), the cadddr is eq? to a. This verb is '
        'the clearest single reason Motoi\'s list representation had to change. A circular list is '
        'a cdr pointing backwards, and a representation with no cdr to point cannot express one at '
        'all. The practical use is as an infinite repeating argument to a verb that stops for '
        'another reason -- zip against a finite list, or a repeating pattern of styles -- and the '
        'practical danger is that anything which walks to the end will not come back.'),
    examples=[
        ('novice',
         "(define ring (circular-list 1 2 3))\n(display (list (car ring) (cadr ring) (caddr ring) (cadddr ring)))\n(newline)"),
        ('intermediate',
         ";; it is neither proper nor dotted; it is its own classification.\n"
         "(define ring (circular-list 1 2 3))\n"
         "(display (list 'list? (list? ring) 'proper? (proper-list? ring)\n               'dotted? (dotted-list? ring) 'circular? (circular-list? ring)))\n(newline)"),
        ('expert',
         ";; the safe use: an endless argument to something that stops for its own\n"
         ";; reason. zip stops with the shortest list.\n"
         "(display (zip (list 1 2 3) (circular-list 'odd 'even)))\n(newline)"),
    ],
    caveats=[
        'DO NOT pass a circular list to length, reverse, list-copy, display, equal? or any other verb that walks to the end. It will not terminate.',
        'It is not a proper list and not a dotted list. list.sld:234-242 and 251-265 assert (not (list? ...)), (not (proper-list? ...)), (not (dotted-list? ...)) and (circular-list? ...).',
        '(null-list? (circular-list 1 2)) is false: it has cells, so it is not the empty list. list.sld:265.',
        'Use circular-list? to test before walking anything whose origin you do not control.',
        'Under Motoi\'s flat-array list representation this verb cannot be implemented at all. It is one of the verbs the cons-cell change exists to make possible.',
    ],
    drawbacks=[
        'Almost every list verb is unsafe on the result, and nothing about the value announces that at the point of use.',
        'A circular list that escapes into logging or error reporting hangs the program at the moment you most need output.',
        'Sharing one with another part of the system exports a hazard that part cannot see.',
    ],
    usecases=[
        'A repeating pattern supplied to zip or map alongside a finite list, so the finite one sets the length.',
        'Round-robin selection where the consumer takes a bounded number of elements.',
        'Testing that a verb genuinely stops early rather than walking its whole argument.',
    ],
    related=['circular-list?', 'proper-list?', 'dotted-list?', 'list?', 'set-cdr!'],
    learn=('The third kind of list',
           ['list?', 'set-cdr!', 'zip', 'proper-list?'],
           'Build one with cons and set-cdr! by hand before you use the constructor. Then predict which verbs are safe on it; that prediction is the skill.'),
    provenance='SRFI-1; conformance evidence scratch/r7rs-conformance/larceny/list.sld:234-242, 251-265, 336-337, 360-362. NO existing record in scheme/reference/ -- signature derived from the test usage. NOT IMPLEMENTABLE under the current flat-array representation. Drafted 2026-08-03; NOT RUN.',
    status='needs-alfred',
    r2=([('eng-program', "(define ring (circular-list 'a 'b))\n(display (list (car ring) (cadr ring) (caddr ring)))\n(newline)"),
         ('math-program', "(define ring (circular-list 1 2 3))\n(display (list 'wraps (eq? (cadddr ring) (car ring))))\n(newline)"),
         ('cs-program', "(define ring (circular-list 1 2))\n(display (list 'list? (list? ring) 'circular? (circular-list? ring) 'null-list? (null-list? ring)))\n(newline)"),
         ('problem', 'The operator wants to pair each element of a finite list with a repeating pattern. Candidates: build a pattern list as long as the data (needs the length up front and allocates it), write an index-modulo lookup (arithmetic at every step, and off-by-one risk), or zip against a circular-list (no length needed, no arithmetic, and the finite list decides when to stop). The third is the cleanest exactly as long as the consumer is known to stop early -- and knowing that is on the caller, because nothing checks.'),
         ('explanation', 'eng: the ring supplies elements forever and zip stops when the data does. math: the wrap is an identity, not a copy -- the fourth cell IS the first cell. cs: the classification predicates are how you find out what you are holding, and they are the only safe thing to do to an unknown list.'),
         ('meta', 'A value whose safety depends entirely on what the consumer does is a value that should not travel. Build it, use it, drop it.')],
        ('Keep the ring local. Anything that leaves the function must be a list that ends.',
         'Circularity is identity of the last cdr with an earlier cell, which is why eq? and not equal? is the test.',
         'The three classifications -- proper, dotted, circular -- exhaust the possibilities, and every list-walking verb must decide which it accepts.')),
    r3=([('setup', 'A sequence with no end, made by joining the last link back to the first.'),
         ('rungs', [
             ('list', "(define ring (circular-list 1 2 3))\n(display (list-head-safe ring 4))\n(newline)"),
             ('a loop of track a train runs round forever', "(define loop (circular-list 'station-a 'station-b))\n(display (list (car loop) (cadr loop) (caddr loop)))\n(newline)"),
             ('the days of the week', "(define week (circular-list 'mon 'tue 'wed 'thu 'fri 'sat 'sun))\n(display (list (car week) (list-ref week 7)))\n(newline)"),
         ]),
         ('explanation', 'In list, the last cdr points at the first cell. A loop of track has no terminus, so a train on it never arrives and a timetable for it must be bounded by something other than the track. The days of the week wrap the same way, which is why weekday arithmetic is modular. All three share a structure whose traversal must be stopped by the traveller, not by the road.'),
         ('meta', 'The shape transfers wherever the structure is endless and the bound comes from the consumer.')],
        ('If the road does not end, the driver must decide when to stop.',
         'A cycle is a sequence indexed by the integers modulo its period.',
         'Cycle detection exists because the alternative is a program that never returns; the tortoise and hare algorithm is the standard answer.')),
    r4=([('eng-program', "(define ring (circular-list 'a 'b 'c))\n(display (list (car ring) (cadr ring) (caddr ring) (cadddr ring)))\n(newline)"),
         ('math-program', "(define ring (circular-list 1 2 3))\n(display (list 'period-3 (eq? (list-ref ring 0) (list-ref ring 3))\n               (eq? (list-ref ring 1) (list-ref ring 4))))\n(newline)"),
         ('cs-program', "(define a (list 'a))\n(define ring (circular-list (car a) 'b 'c))\n(display (list 'not-proper (not (proper-list? ring)) 'not-dotted (not (dotted-list? ring)) 'is-circular (circular-list? ring)))\n(newline)"),
         ('claim', 'For n elements, circular-list returns a chain of n cells whose last cdr is the first cell. Element i and element i+n are the same object. The result satisfies circular-list? and fails list?, proper-list?, dotted-list? and null-list?.'),
         ('invariant', 'forall n > 0, elements e1..en. r = circular-list(e1..en) satisfies eq?(list-ref(r, i), list-ref(r, i+n)) for all i >= 0 and circular-list?(r) and not proper-list?(r) and not dotted-list?(r)'),
         ('meta', 'The pattern is a cycle of known period. What would falsify the claim: a period other than n, a classification predicate answering wrong, or -- the case that matters most in Motoi today -- the constructor being unable to build the wrap at all, which is exactly what the flat-array representation forces and why this record carries :status needs-alfred.')],
        ('The claim that cannot currently be satisfied is the most important line in this record.',
         'Period n means index arithmetic modulo n; that is the whole algebra of the structure.',
         'Four negative classifications and one positive is a stronger specification than the positive alone.')),
    r5=([('eng-composition', "(define (stripe items) (zip items (circular-list 'light 'dark)))\n(display (stripe (list 'r1 'r2 'r3)))\n(newline)"),
         ('math-composition', "(define (cycle-ref ring i) (list-ref ring i))\n(define week (circular-list 'mon 'tue 'wed))\n(display (list (cycle-ref week 0) (cycle-ref week 4)))\n(newline)"),
         ('cs-composition', "(define (bounded-take ring n)\n  (let loop ((r ring) (k n) (acc (list)))\n    (if (= k 0) (reverse acc) (loop (cdr r) (- k 1) (cons (car r) acc)))))\n(display (bounded-take (circular-list 1 2) 5))\n(newline)"),
         ('base', 'circular-list makes a chain whose last cell points back at its first.'),
         ('emergent', 'eng: alternating row styles, where the finite data supplies the bound. math: indexing a cycle is modular arithmetic, and list-ref past the period simply wraps. cs: the explicit bounded take is the pattern to internalise -- every consumer of a circular list must carry its own counter, because the structure will not stop it.'),
         ('meta', 'The family is unbounded structures with bounded consumers. What emerges is a discipline rather than a trick: the bound lives in the consumer, and every function that accepts a possibly-circular list must say what its bound is.')],
        ('State the bound in the consumer. A function that walks an argument to its end must document that it does.',
         'Modular indexing makes the cycle finite again from the caller\'s point of view.',
         'Every safe use of a circular list has an explicit counter somewhere; if you cannot find it, the use is not safe.')),
)

PAIR_FOLD = dict(
    name='pair-fold', std='SRFI-1', library='higher-order', kind='pure',
    signature='(pair-fold kons knil lst) -> value',
    summary='fold over the CELLS of lst rather than its elements, with each cell\'s tail read before kons is called so kons may safely destroy it.',
    explanation=(
        'fold hands your procedure each element. pair-fold hands it each CELL -- the pair whose car '
        'is the element -- along with the accumulator. That sounds like a small difference and it '
        'is not, because a cell can be written to. The property that makes the verb worth having '
        'is stated only in its implementation and proved by the suite at list.sld:402-410: '
        'pair-fold takes the cdr of each cell BEFORE calling kons, so kons is free to set-cdr! the '
        'cell it was given without breaking the traversal. The test does exactly that -- it passes '
        '(lambda (pair tail) (set-cdr! pair tail) pair) and gets a reversed list built entirely '
        'out of the original cells. That is reverse! written in three lines, and it is the reason '
        'pair-fold exists. Note that (pair-fold cons \'() lst) collects the cells themselves, '
        'which is the standard way to assert that some other verb allocated nothing -- the '
        'conformance suite uses it that way for filter!, remove!, span!, break!, delete! and '
        'delete-duplicates!.'),
    examples=[
        ('novice',
         "(display (pair-fold cons (list) (list 1 2 3)))\n(newline)"),
        ('intermediate',
         ";; the cells themselves, which is how you prove a verb allocated nothing.\n"
         "(define xs (list 1 2 3))\n(define cells (pair-fold cons (list) xs))\n"
         "(display (list 'count (length cells) 'first-cell-is-xs (memq xs cells)))\n(newline)"),
        ('expert',
         ";; the tail is read before kons runs, so kons may destroy the cell it gets.\n"
         ";; This is reverse! in three lines.\n"
         "(define xs (list 1 2 3))\n"
         "(display (pair-fold (lambda (pair tail) (set-cdr! pair tail) pair) (list) xs))\n(newline)"),
    ],
    caveats=[
        'kons receives the CELL, not the element. Its car is the element; use (car pair) inside kons.',
        'The cdr of each cell is read before kons is called, so kons may set-cdr! the cell it is given. list.sld:402-410 relies on this and would break without it.',
        'It is not itself destructive, but it is the verb that makes destruction expressible, which is why it belongs with this set.',
        '(pair-fold cons (list) lst) yields the cells in reverse order -- it is a fold, so the last cell is consed last.',
        'Do not use it on a circular list; it walks to the end.',
    ],
    drawbacks=[
        'Handing a caller a live cell hands them the ability to corrupt the structure mid-traversal, and only the read-ahead makes that survivable.',
        'Code using it is harder to read than the same code using fold, because every kons body starts with a car.',
        'It has no pure use that fold cannot express more clearly; its value is entirely in the mutable cases.',
    ],
    usecases=[
        'Asserting that a linear-update verb allocated nothing, by collecting the cells before and checking them after.',
        'Writing in-place list algorithms -- reversal, relinking, splicing -- without hand-rolling the traversal.',
        'Any algorithm that needs the tail of a list at each step, not just the element.',
    ],
    related=['fold', 'pair-fold-right', 'pair-for-each', 'set-cdr!', 'reverse!'],
    learn=('Folding over cells, and read-ahead as a safety property',
           ['fold', 'set-cdr!', 'cons', 'car'],
           'Write pair-fold yourself. Then move the (cdr p) read to after the kons call and watch the reversal test break; that break is the specification.'),
    provenance='SRFI-1; conformance evidence scratch/r7rs-conformance/larceny/list.sld:402-412, which also pins the read-ahead property. NO existing record in scheme/reference/ -- signature derived from the test usage. Drafted 2026-08-03; NOT RUN.',
    status='needs-alfred',
    r2=([('eng-program', "(display (pair-fold cons (list) (list 1 2 3)))\n(newline)"),
         ('math-program', "(define xs (list 1 2 3))\n(display (list 'cell-count (length (pair-fold cons (list) xs)) 'element-count (length xs)))\n(newline)"),
         ('cs-program', "(define xs (list 1 2 3))\n(display (pair-fold (lambda (pair tail) (set-cdr! pair tail) pair) (list) xs))\n(newline)"),
         ('problem', 'The operator wants to prove that a call to filter! allocated nothing. Candidates: measure the heap (coarse, noisy, and machine-specific), compare with eq? cell by cell (needs a traversal written by hand and gets the empty case wrong), or collect the cells with pair-fold before the call and check membership after. The third is what the conformance suite does for six different verbs, which is a strong hint it is the idiom.'),
         ('explanation', 'eng: the cells come back as a list you can hold and check later. math: the cell count equals the element count for a proper list, which is the sanity check on the fold itself. cs: the reversal program is the whole justification for the verb -- it destroys each cell as it visits it, and works only because the tail was already read.'),
         ('meta', 'The read-ahead is invisible in the signature and load-bearing in practice. Properties like that belong in the record, because nothing else will carry them.')],
        ('An unstated safety property is a property that gets optimised away by the next person.',
         'Cells and elements are in bijection for a proper list; the counts agreeing is the cheapest check available.',
         'This is the standard no-allocation assertion, and it is worth knowing by sight.')),
    r3=([('setup', 'Walking a chain and being handed each link, rather than the thing hanging from it.'),
         ('rungs', [
             ('list', "(display (pair-fold cons (list) (list 1 2)))\n(newline)"),
             ('a train inspected coupling by coupling', "(define rake (list 'car1 'car2 'car3))\n(display (length (pair-fold cons (list) rake)))\n(newline)"),
             ('a chain checked link by link rather than load by load', "(define chain (list 'l1 'l2 'l3))\n(display (map car (pair-fold cons (list) chain)))\n(newline)"),
         ]),
         ('explanation', 'In list, kons receives the pair. Inspecting a train coupling by coupling is a different job from inspecting it wagon by wagon: you can uncouple from a coupling and you cannot from a wagon. Checking a chain link by link lets you cut it, which checking the loads does not. All three share access to the connective tissue rather than to the contents.'),
         ('meta', 'The shape transfers wherever the operation is on the joins rather than on the things joined.')],
        ('Give the worker the coupling if the job is uncoupling. Give them the wagon if the job is unloading.',
         'The cells carry the structure; the elements carry the data. Folding over one is not folding over the other.',
         'Access to the links is what makes in-place restructuring possible at all.')),
    r4=([('eng-program', "(define cells (pair-fold cons (list) (list 1 2 3)))\n(display (list 'count (length cells)))\n(newline)"),
         ('math-program', "(define xs (list 1 2 3))\n(display (equal? (map car (reverse (pair-fold cons (list) xs))) xs))\n(newline)"),
         ('cs-program', "(define xs (list 1 2 3))\n(define r (pair-fold (lambda (pair tail) (set-cdr! pair tail) pair) (list) xs))\n(display (list 'reversed r 'built-from-original-cells (memq r (list r))))\n(newline)"),
         ('claim', 'pair-fold applies kons to each successive cell of lst and the accumulator, left to right, starting from knil. The cdr of each cell is read before kons is applied to it, so kons may modify that cell without disturbing the traversal. For a proper list the number of applications equals the length.'),
         ('invariant', 'forall kons, knil, proper lst. pair-fold(kons, knil, lst) applies kons exactly |lst| times, to the cells of lst in order, and the traversal is unaffected by kons mutating the cell it receives'),
         ('meta', 'The pattern is a fold with read-ahead. What would falsify the claim: a traversal that breaks when kons calls set-cdr! -- which is precisely the reversal test at list.sld:402-410 and precisely what an implementation that reads the cdr after the call would fail. Nothing about the signature warns of it.')],
        ('The falsifying case is a specific three-line program. Keep it; a prose statement of the property will not survive a rewrite.',
         'A fold applies its combiner once per element, and the cell-fold applies it once per cell; the counts must agree.',
         'Read-ahead is the difference between a traversal that tolerates mutation and one that does not.')),
    r5=([('eng-composition', "(define (cells-of xs) (pair-fold cons (list) xs))\n(display (length (cells-of (list 1 2 3))))\n(newline)"),
         ('math-composition', "(define (my-reverse! xs)\n  (pair-fold (lambda (pair tail) (set-cdr! pair tail) pair) (list) xs))\n(display (my-reverse! (list 1 2 3)))\n(newline)"),
         ('cs-composition', "(define (no-allocation? before after)\n  (every (lambda (c) (memq c before)) after))\n(define xs (list 1 2 3 4))\n(define before (pair-fold cons (list) xs))\n(display (no-allocation? before (pair-fold cons (list) (filter even? xs))))\n(newline)"),
         ('base', 'pair-fold folds a procedure over the cells of a list, reading each tail before the call.'),
         ('emergent', 'eng: a named cells-of helper, which is all most uses need. math: reverse! falls out in three lines, which is the strongest evidence that pair-fold is the primitive and the linear-update verbs are conveniences over it. cs: the no-allocation assertion, written once and reusable -- note it is shown against the PURE filter, where it correctly reports that allocation did happen.'),
         ('emergent-guard', ''),
         ('meta', 'The family is structural traversal. What emerges is a claim worth taking seriously: most of the linear-update verbs in this chapter can be written in a few lines of pair-fold, which means the interesting content of those records is their hazards, not their implementations.')],
        ('If the implementation is three lines, the record is carrying the hazards, not the code.',
         'A primitive that generates a family is worth more than any member of the family.',
         'The reusable assertion is the deliverable here; write it once and every linear-update test can use it.')),
)
# the placeholder key above must not reach the emitter
PAIR_FOLD['r5'] = ([kv for kv in PAIR_FOLD['r5'][0] if kv[0] != 'emergent-guard'],
                   PAIR_FOLD['r5'][1])

LAST_PAIR = dict(
    name='last-pair', std='SRFI-1', library='list', kind='pure',
    signature='(last-pair lst) -> pair',
    summary='The final CELL of lst -- the pair whose cdr is the terminator. It is the argument\'s own cell, not a copy.',
    explanation=(
        'last-pair returns a cell, not a value and not a list. The distinction is the entire point: '
        'because the returned cell is the argument\'s own, a set-cdr! on it extends the original '
        'list in constant time, and that is the idiom last-pair exists to support. (last x) gives '
        'you the final element; (take-right x 1) gives you a fresh one-element list; last-pair '
        'gives you a handle. Motoi currently returns a fresh one-element list from this verb -- '
        'the existing record in scheme/reference/39-list.slat documents that honestly as a '
        'divergence, and spec/srfi-1.slatl:64-66 wrongly promotes it to specification. Under real '
        'cons cells the answer must be the argument\'s cell, and the test for that is not equal? '
        'but eq?. For an improper list the final cell is still a cell and last-pair still returns '
        'it; the terminator is simply not the empty list.'),
    examples=[
        ('novice',
         "(define xs (list 1 2 3))\n(display (last-pair xs))\n(newline)"),
        ('intermediate',
         ";; it is the argument's own cell, which is what makes the handle useful.\n"
         "(define xs (list 1 2 3))\n(define cell (last-pair xs))\n"
         "(display (list 'is-own-cell (eq? cell (cddr xs))))\n(newline)"),
        ('expert',
         ";; the idiom: constant-time extension through the handle.\n"
         "(define xs (list 1 2 3))\n(set-cdr! (last-pair xs) (list 4))\n"
         "(display xs)\n(newline)"),
    ],
    caveats=[
        'It returns a PAIR, not a list and not an element. (car (last-pair lst)) is the last element; (last lst) is the same value more directly.',
        'The returned cell is the argument\'s own. Writing to it with set-cdr! changes the argument, which is the whole reason to use it.',
        'For an improper list the last cell is returned with its non-list cdr intact.',
        'On the empty list there is no pair to return; this is an error, not an empty result.',
        'MOTOI DIVERGES TODAY: the current implementation returns a fresh one-element list (lib/std/srfi-1.js:310-315), so the set-cdr! idiom silently does nothing. scheme/reference/39-list.slat records this; spec/srfi-1.slatl:64-66 wrongly states it as the specification.',
        'There is NO test for last-pair in scratch/r7rs-conformance/larceny/list.sld (named at :75, no body).',
    ],
    drawbacks=[
        'Finding the last cell costs a full traversal, so the constant-time extension it enables is only constant if you keep the handle.',
        'Holding a handle into someone else\'s list is an aliasing hazard with no expiry.',
        'It is easy to confuse with last and with take-right, and all three read plausibly at a call site.',
    ],
    usecases=[
        'Appending to a list in constant time by keeping the last cell as a tail pointer.',
        'Building a queue as a head pointer plus a last-cell pointer.',
        'Inspecting the terminator of a list whose properness is in doubt.',
    ],
    related=['last', 'take-right', 'set-cdr!', 'append!', 'list-tail'],
    learn=('Handles versus values',
           ['last', 'set-cdr!', 'take-right', 'eq?'],
           'Get the last element three ways -- last, car of last-pair, car of take-right 1 -- then try to extend the list through each. Only one of them works, and that tells you what last-pair is for.'),
    provenance='SRFI-1; NAMED at scratch/r7rs-conformance/larceny/list.sld:75 with NO TEST BODY. An existing record exists in scheme/reference/39-list.slat and documents the current Motoi divergence; spec/srfi-1.slatl:64-66 contradicts SRFI-1 and should be corrected. Drafted 2026-08-03 against the incoming cons-cell representation; NOT RUN.',
    status='needs-alfred',
    r2=([('eng-program', "(define xs (list 1 2 3))\n(display (list 'last-element (car (last-pair xs))))\n(newline)"),
         ('math-program', "(define xs (list 1 2 3))\n(display (list 'car-of-cell-is-last (equal? (car (last-pair xs)) (last xs))))\n(newline)"),
         ('cs-program', "(define xs (list 1 2 3))\n(display (list 'cell-is-shared (eq? (last-pair xs) (cddr xs))))\n(newline)"),
         ('problem', 'The operator wants to add an element to the end of a list. Candidates: (append lst (list x)) (copies the whole list every time, so a loop is quadratic), (append! lst (list x)) (no copy, but still walks to the end every time, so still quadratic), or keeping the last cell from last-pair and writing through it (constant time per addition, and quadratic only if you re-find the cell each time). The lesson is that last-pair does not make appending fast -- KEEPING its result does.'),
         ('explanation', 'eng: the last element is reachable through the cell, but so is the ability to extend. math: the car of the cell is the last element, which is the boring half of the verb. cs: the eq? check is the interesting half, and it is the one Motoi currently fails.'),
         ('meta', 'A handle is only worth having if you hold onto it. Re-deriving a handle every iteration is the same cost as not having one.')],
        ('Keep the handle or do not ask for it.',
         'The car of the last cell is the last element; that identity is what makes the two verbs confusable.',
         'A tail pointer turns a quadratic append loop into a linear one, and it is the standard queue implementation.')),
    r3=([('setup', 'Getting hold of the end of a chain, as a place rather than as a thing.'),
         ('rungs', [
             ('list', "(define xs (list 1 2 3))\n(display (car (last-pair xs)))\n(newline)"),
             ('the rear coupling of a train', "(define rake (list 'loco 'car1 'van))\n(display (list 'rear-item (car (last-pair rake))))\n(newline)"),
             ('the end of a queue at a counter', "(define queue (list 'first 'second))\n(display (list 'last-in-line (car (last-pair queue))))\n(newline)"),
         ]),
         ('explanation', 'In list, the final cell is where the terminator lives and where a new cell would be attached. The rear coupling of a train is not the last wagon -- it is the place a wagon gets added, which is why a shunter cares about the coupling and a passenger cares about the wagon. The end of a queue is a position, and the person standing there is a different fact. All three share a place distinguished from its occupant.'),
         ('meta', 'The shape transfers wherever the attachment point matters more than what is currently attached.')],
        ('The coupling and the last wagon are different things. Ask for the one your job needs.',
         'The last cell is the unique cell whose cdr is not a pair; that is the definition, and it is what a search must test.',
         'Every efficient append, queue and builder keeps a pointer to the attachment point.')),
    r4=([('eng-program', "(define xs (list 1 2 3))\n(define cell (last-pair xs))\n(display (list 'car (car cell)))\n(newline)"),
         ('math-program', "(define xs (list 1 2 3))\n(display (list 'agrees-with-last (equal? (car (last-pair xs)) (last xs))\n               'agrees-with-take-right (equal? (list (car (last-pair xs))) (take-right xs 1))))\n(newline)"),
         ('cs-program', "(define xs (list 1 2 3))\n(set-cdr! (last-pair xs) (list 4))\n(display (list 'extended xs))\n(newline)"),
         ('claim', 'For a non-empty list lst, last-pair returns the unique cell of lst whose cdr is not a pair. That cell is eq? to the argument\'s own final cell, so (set-cdr! (last-pair lst) tail) extends lst in place.'),
         ('invariant', 'forall non-empty lst. p = last-pair(lst) satisfies pair?(p) and not pair?(cdr(p)) and p is a cell of lst by identity and car(p) = last(lst)'),
         ('meta', 'The pattern is identity-preserving access to a boundary cell. What would falsify the claim: a fresh cell, which is exactly what Motoi returns today, and which the extension program detects while every equal?-based check passes. That program is the one to keep.')],
        ('The extension program is the test. Everything else in this record passes on the broken implementation too.',
         'Uniqueness of the last cell is what makes the verb well-defined on improper lists as well as proper ones.',
         'An identity claim needs an identity test; equal? cannot see the difference and never could.')),
    r5=([('eng-composition', "(define (extend! xs y) (set-cdr! (last-pair xs) (list y)) xs)\n(display (extend! (list 1 2) 3))\n(newline)"),
         ('math-composition', "(define (terminator lst) (cdr (last-pair lst)))\n(display (list 'proper-terminator (terminator (list 1 2))))\n(newline)"),
         ('cs-composition', "(define (make-queue xs) (list 'head xs 'tail (last-pair xs)))\n(display (make-queue (list 1 2 3)))\n(newline)"),
         ('base', 'last-pair returns the argument\'s own final cell.'),
         ('emergent', 'eng: constant-time extension, the idiom the verb exists for. math: reading the cdr of the last cell tells you the terminator, which is how properness is decided -- the empty list for a proper list, anything else for a dotted one. cs: a queue is a head pointer and a tail pointer, and last-pair is how the tail pointer is obtained once at construction and then maintained rather than re-derived.'),
         ('meta', 'The family is boundary handles. What emerges is that this one verb is the difference between a list being a value and a list being a mutable data structure, which is why its correctness is not a detail.')],
        ('Obtain the handle once, maintain it, never re-derive it.',
         'The terminator classifies the list; the last cell is where you read it.',
         'Whether last-pair returns a shared cell decides whether queues, builders and in-place appends are expressible at all.')),
)

LIST_COPY = dict(
    name='list-copy', std='R7RS-small', library='list', kind='pure',
    signature='(list-copy obj) -> object',
    summary='A shallow copy of a list: a fresh cell at every spine position, with the elements themselves shared.',
    explanation=(
        'list-copy is the verb that makes the linear-update family usable on data you do not own. '
        'Copy first, then destroy the copy. What it guarantees is precise and worth stating '
        'exactly: every cell of the spine is new, and no element is. The suite checks the first '
        'half explicitly at list.sld:218-232, walking both lists in step and asserting '
        '(not (eq? c cp)) at every position -- not just at the head. It checks the second half by '
        'implication and by the improper case at list.sld:232, where (list-copy \'(1 2 3 . 4)) '
        'keeps the dotted tail. So a list of lists copied this way shares its inner lists: '
        'set-car! on the copy is safe, set-car! on an element of the copy is not. R7RS-small 6.4 '
        'defines it over any object, and a non-pair argument is returned as it is.'),
    examples=[
        ('novice',
         "(define xs (list 1 2 3))\n(display (list-copy xs))\n(newline)"),
        ('intermediate',
         ";; every cell is fresh, not just the head.\n"
         "(define xs (list 1 2 3))\n(define cp (list-copy xs))\n"
         "(display (list 'head-fresh (not (eq? xs cp)) 'second-fresh (not (eq? (cdr xs) (cdr cp)))\n               'equal (equal? xs cp)))\n(newline)"),
        ('expert',
         ";; SHALLOW: the elements are shared, so mutating one shows through both.\n"
         "(define inner (list 'a))\n(define xs (list inner))\n(define cp (list-copy xs))\n"
         "(display (list 'spine-fresh (not (eq? xs cp)) 'element-shared (eq? (car cp) inner)))\n(newline)"),
    ],
    caveats=[
        'SHALLOW. The spine is fresh; the elements are the same objects. Mutating an element is visible through both lists.',
        'Every spine cell is fresh, not merely the head. list.sld:218-232 walks both lists and asserts (not (eq? c cp)) at each position.',
        'An improper list is copied with its dotted tail intact. list.sld:232.',
        'Do not call it on a circular list; it walks to the end.',
        'A non-pair argument is returned unchanged -- R7RS-small 6.4 defines it over any object.',
    ],
    drawbacks=[
        'The shallow guarantee is the one people forget, and a list of mutable elements copied this way gives a false sense of isolation.',
        'It allocates one cell per element, which is exactly the cost the linear-update verbs exist to avoid -- so copy-then-destroy is never faster than the pure verb.',
        'There is no deep variant in the standard, so a real isolation requirement has to be written by hand.',
    ],
    usecases=[
        'Making a private copy before calling a linear-update verb on data with another owner.',
        'Snapshotting a list before handing it to code that may mutate it.',
        'Detaching a result from an internal structure before returning it.',
    ],
    related=['list', 'append', 'take', 'vector-copy', 'reverse'],
    learn=('Shallow copying and what it does not protect',
           ['list', 'eq?', 'equal?', 'set-car!'],
           'Copy a list of lists, mutate an inner list, and print both. The result explains shallow copying better than any definition.'),
    provenance='R7RS-small 6.4 (cited spec/R7RS-SMALL-PRIMITIVE-FLOOR.slat:214); conformance evidence scratch/r7rs-conformance/larceny/list.sld:218-232. An existing record is in scheme/reference/39-list.slat. Drafted 2026-08-03; NOT RUN.',
    r2=([('eng-program', "(define xs (list 1 2 3))\n(define cp (list-copy xs))\n(display (list 'copy cp 'equal (equal? xs cp)))\n(newline)"),
         ('math-program', "(define xs (list 1 2 3))\n(define cp (list-copy xs))\n(display (list 'equal (equal? xs cp) 'not-identical (not (eq? xs cp))))\n(newline)"),
         ('cs-program', "(define inner (list 'a))\n(define cp (list-copy (list inner)))\n(display (list 'element-shared (eq? (car cp) inner)))\n(newline)"),
         ('problem', 'The operator needs to call filter! on a list that came in as an argument. Candidates: use filter instead (one allocation, no copy, and the source is untouched), copy then filter! (two allocations, and the source is untouched), or call filter! directly (fastest, and it destroys the caller\'s list). The middle option is the one people reach for and it is strictly worse than the first: copy-then-destroy allocates a whole spine to save allocating a shorter one.'),
         ('explanation', 'eng: the copy is a separate list with the same contents. math: equal? holds and eq? does not, which is the definition of a copy. cs: the elements are shared, so the isolation is one level deep only.'),
         ('meta', 'Copy-then-destroy is almost always a mistake in reasoning. If you have to copy, the pure verb was already the right answer.')],
        ('If a copy is needed to make the destructive verb safe, the pure verb was cheaper all along.',
         'A copy is equal but not identical; that pair of facts is what the word means.',
         'Shallow means the isolation stops at the first level, and nothing in the type says so.')),
    r3=([('setup', 'Duplicating the structure of a sequence while leaving its contents shared.'),
         ('rungs', [
             ('list', "(display (list-copy (list 1 2 3)))\n(newline)"),
             ('a second copy of a running order, listing the same acts', "(define running-order (list 'act1 'act2))\n(display (list-copy running-order))\n(newline)"),
             ('a duplicate index card set pointing at the same books', "(define cards (list 'book-a 'book-b))\n(display (list-copy cards))\n(newline)"),
         ]),
         ('explanation', 'In list, new cells hold the same elements. A second copy of a running order can be reordered without disturbing the first, and the acts on it are the same acts -- cancelling one cancels it on both sheets. A duplicate set of index cards points at the same books; you can reshelve the cards freely and the books do not move. All three share a duplicated arrangement over undisturbed contents.'),
         ('meta', 'The shape transfers wherever the ordering is what needs to vary independently and the things ordered do not.')],
        ('Copying the list is not copying the things in it, and the difference is where the bugs live.',
         'A copy of a sequence is a new function from positions to the same values.',
         'This is the same shallow-versus-deep distinction every language with references has to teach.')),
    r4=([('eng-program', "(define xs (list 1 2 3))\n(define cp (list-copy xs))\n(display (list 'equal (equal? xs cp)))\n(newline)"),
         ('math-program', "(define (all-cells-fresh? xs)\n  (let loop ((a xs) (b (list-copy xs)))\n    (cond ((null? a) #t)\n          ((eq? a b) #f)\n          (else (loop (cdr a) (cdr b))))))\n(display (list (all-cells-fresh? (list 1 2 3)) (all-cells-fresh? (list 1))))\n(newline)"),
         ('cs-program', "(define inner (list 'a))\n(define xs (list inner 'b))\n(define cp (list-copy xs))\n(set-car! inner 'changed)\n(display (list 'both-see-the-change (car (car cp))))\n(newline)"),
         ('claim', 'list-copy returns a list equal? to its argument in which every spine cell is a fresh object and every element is the same object as in the original. An improper list keeps its dotted tail. A non-pair argument is returned unchanged.'),
         ('invariant', 'forall proper lst. equal?(list-copy(lst), lst) and for every i, not eq?(list-tail(list-copy(lst), i), list-tail(lst, i)) and eq?(list-ref(list-copy(lst), i), list-ref(lst, i))'),
         ('meta', 'The pattern is structural duplication with referential sharing. What would falsify the claim: a shared spine cell at any position -- note the suite checks every position, not just the head, because a lazy or partial copy would pass a head-only check -- or an element that was itself copied, which would make the operation deep and break the sharing callers rely on.')],
        ('Check every position. A copy that shares its tail passes a head-only test and fails in production.',
         'Fresh at every spine position and shared at every element position is a two-part specification, and both parts are load-bearing.',
         'The mutation program is what demonstrates shallowness; no structural check can show it.')),
    r5=([('eng-composition', "(define (safe-filter! pred xs) (filter! pred (list-copy xs)))\n(display (safe-filter! even? (list 1 2 3 4)))\n(newline)"),
         ('math-composition', "(define (snapshot xs) (list-copy xs))\n(define xs (list 1 2 3))\n(define before (snapshot xs))\n(display (list 'before before 'now xs))\n(newline)"),
         ('cs-composition', "(define (deep-copy-2 xss) (map list-copy xss))\n(display (deep-copy-2 (list (list 1) (list 2))))\n(newline)"),
         ('base', 'list-copy duplicates the spine of a list and shares its elements.'),
         ('emergent', 'eng: the defensive wrapper that makes a linear-update verb safe on foreign data -- and which, as the audit row says, costs more than just calling the pure verb. math: snapshotting for comparison, where sharing the elements is exactly right because you want to compare the arrangement. cs: mapping list-copy over a list of lists is one level deeper, and noticing that there is no bottom to this ladder is how you learn why the standard stops at shallow.'),
         ('meta', 'The family is defensive duplication. What emerges is that depth is a per-use decision the standard deliberately refuses to make, and every codebase ends up writing the deep version it needs.')],
        ('The standard gives you one level. Any more is your specification, not the language\'s.',
         'Copy depth is a choice about which sharing you want to keep, and it has no universally right answer.',
         'A deep copy of a cyclic structure needs cycle detection, which is why no standard ships one casually.')),
)

SET_CAR_BANG = dict(
    name='set-car!', std='R7RS-small', library='list', kind='state-change',
    signature='(set-car! pair obj) -> unspecified',
    summary='Replace the car of a pair in place. The pair keeps its identity, so everything holding it sees the new value.',
    explanation=(
        'set-car! is one of the two mutators R7RS-small 6.4 defines on pairs, and it is as small as '
        'a verb gets: it overwrites one field of one cell. Nothing is allocated and nothing is '
        'relinked. What makes it worth a record is the consequence rather than the operation -- '
        'the pair keeps its identity, so every binding that reached that pair, by any route, now '
        'reads the new value. A list is a graph of shared cells, and set-car! changes the graph '
        'for everyone at once. There is no test for set-car! in the conformance suite (list.sld '
        'names it at :162 with no body), so this record rests on R7RS-small 6.4 as cited in '
        'spec/R7RS-SMALL-PRIMITIVE-FLOOR.slat:192. Motoi cannot implement it correctly under the '
        'flat-array representation, because on a proper list there is no pair object to write '
        'into; the existing record in scheme/reference/39-list.slat already carries '
        ':status "needs-alfred" for exactly this reason, and its examples assert the current '
        'wrong behaviour as though it were correct.'),
    examples=[
        ('novice',
         "(define p (cons 1 2))\n(set-car! p 99)\n(display p)\n(newline)"),
        ('intermediate',
         ";; the pair keeps its identity, so every holder sees the change.\n"
         "(define p (cons 1 2))\n(define also-p p)\n(set-car! p 99)\n"
         "(display (list 'p p 'also-p also-p))\n(newline)"),
        ('expert',
         ";; writing into a cell of a list changes the list for everyone.\n"
         "(define xs (list 1 2 3))\n(define shared xs)\n"
         "(set-car! (cdr xs) 'changed)\n"
         "(display (list 'xs xs 'shared shared))\n(newline)"),
    ],
    caveats=[
        'The pair must be a pair. Calling it on the empty list, a vector or a number is an error.',
        'The return value is unspecified. Do not use the result of set-car! for anything.',
        'Every holder of the pair sees the new car immediately. There is no copy and no notification.',
        'Literal pairs from quoted data must not be mutated; R7RS-small leaves that undefined and implementations do differ.',
        'There is NO test for set-car! in scratch/r7rs-conformance/larceny/list.sld (named at :162, no body).',
        'MOTOI DIVERGES TODAY: a proper list is a flat array with no pair object to write into. scheme/reference/39-list.slat already records this with :status "needs-alfred", and its examples currently assert the divergent behaviour as correct -- they must be rewritten when the cons-cell engine lands.',
    ],
    drawbacks=[
        'It is the smallest possible action-at-a-distance: one write, arbitrarily many observers, no way to enumerate them.',
        'It makes a value that was safe to share into one that is not, retroactively.',
        'Nothing in a function signature can say "I may set-car! your pairs".',
    ],
    usecases=[
        'Building mutable records out of pairs, where the car is a field.',
        'In-place transformation of a list you own, as map! does internally.',
        'Circular and self-referential structures, where the value must be written after the cell exists.',
    ],
    related=['set-cdr!', 'cons', 'car', 'map!', 'list-copy'],
    learn=('Identity, and why one write has many readers',
           ['cons', 'car', 'eq?', 'list-copy'],
           'Bind one pair to two names, write through one, read through the other. That two-line program is the whole concept of mutable shared state.'),
    provenance='R7RS-small 6.4 (cited spec/R7RS-SMALL-PRIMITIVE-FLOOR.slat:192). NAMED at scratch/r7rs-conformance/larceny/list.sld:162 with NO TEST BODY. An existing record in scheme/reference/39-list.slat already carries :status "needs-alfred". Drafted 2026-08-03 against the incoming cons-cell representation; NOT RUN.',
    status='needs-alfred',
    r2=([('eng-program', "(define p (cons 1 2))\n(set-car! p 99)\n(display p)\n(newline)"),
         ('math-program', "(define p (cons 1 2))\n(set-car! p 99)\n(display (list 'car (car p) 'cdr-unchanged (cdr p)))\n(newline)"),
         ('cs-program', "(define p (cons 1 2))\n(define q p)\n(set-car! p 99)\n(display (list 'other-name-sees-it (car q)))\n(newline)"),
         ('problem', 'The operator wants to change the first field of a record built as a pair. Candidates: rebuild the pair with cons and rebind (a new object, so other holders keep the old one -- which is either the bug or the whole point), or set-car! (same object, every holder updated). The question is not which is faster. It is whether the other holders should see the change, and that is a design decision the code should state out loud.'),
         ('explanation', 'eng: the pair now holds the new value. math: only the car changes; the cdr and the identity are untouched. cs: a second name for the pair reads the new value, which is the entire observable content of the verb.'),
         ('meta', 'Rebuild versus mutate is a question about who should observe the change. Answer it deliberately or the answer gets made by accident.')],
        ('Decide who should see the change before deciding how to make it.',
         'Mutation preserves identity and changes state; reconstruction preserves state and changes identity.',
         'The two-name program is the minimal demonstration of shared mutable state, and it belongs in every explanation of it.')),
    r3=([('setup', 'Changing what is stored in a place, without changing which place it is.'),
         ('rungs', [
             ('list', "(define p (cons 'old 'rest))\n(set-car! p 'new)\n(display p)\n(newline)"),
             ('the label on a numbered platform', "(define platform (cons 'destination-a 'platform-1))\n(set-car! platform 'destination-b)\n(display platform)\n(newline)"),
             ('the contents of a numbered pigeonhole', "(define hole (cons 'letter 'box-7))\n(set-car! hole 'parcel)\n(display hole)\n(newline)"),
         ]),
         ('explanation', 'In list, the car field is overwritten and the cell is the same cell. Changing the destination shown on a numbered platform does not renumber the platform, and everyone who was told to go to platform 1 now sees a different destination. Replacing the contents of a pigeonhole leaves the pigeonhole where it was. All three share an address that survives a change of contents.'),
         ('meta', 'The shape transfers wherever things are found by address rather than by value.')],
        ('Address stability is what makes the update visible to everyone who was given the address.',
         'A mutable cell is a function from time to values, indexed by a stable identity.',
         'This is the difference between a variable and a value, and it is the foundation of every data structure that changes.')),
    r4=([('eng-program', "(define p (cons 1 2))\n(set-car! p 99)\n(display (car p))\n(newline)"),
         ('math-program', "(define p (cons 1 2))\n(define d (cdr p))\n(set-car! p 99)\n(display (list 'cdr-untouched (eq? (cdr p) d)))\n(newline)"),
         ('cs-program', "(define xs (list 1 2 3))\n(define alias xs)\n(set-car! xs 99)\n(display (list 'alias-changed (car alias)))\n(newline)"),
         ('claim', 'set-car! replaces the car field of the given pair with obj. The pair\'s identity and its cdr are unchanged, so (eq? p p) still holds and every other reference to p reads the new car. The return value is unspecified.'),
         ('invariant', 'forall pair p, object o. after set-car!(p, o): eq?(car(p), o) and cdr(p) is unchanged by identity and p is unchanged by identity'),
         ('meta', 'The pattern is field assignment on a shared object. What would falsify the claim: a changed cdr, a new pair returned in place of mutation, or an alias that does not see the write -- and that last case is exactly what the flat-array representation produces on a proper list, which is why this record and the one in 39-list.slat both carry :status needs-alfred.')],
        ('The alias program is the one that fails on the current engine. Keep it at the front of the proof.',
         'Changing one field must leave the other alone; that is a separate assertion and it is worth making.',
         'An unspecified return value means the verb is called for effect, and code that reads its result is wrong even where it happens to work.')),
    r5=([('eng-composition', "(define (make-cell v) (cons v '()))\n(define (cell-set! c v) (set-car! c v))\n(define c (make-cell 1))\n(cell-set! c 2)\n(display (car c))\n(newline)"),
         ('math-composition', "(define (swap! p q)\n  (let ((tmp (car p)))\n    (set-car! p (car q))\n    (set-car! q tmp)))\n(define a (cons 1 'x))\n(define b (cons 2 'y))\n(swap! a b)\n(display (list (car a) (car b)))\n(newline)"),
         ('cs-composition', "(define (map-in-place! f xs)\n  (pair-for-each (lambda (p) (set-car! p (f (car p)))) xs)\n  xs)\n(display (map-in-place! (lambda (n) (* n n)) (list 1 2 3)))\n(newline)"),
         ('base', 'set-car! writes a new value into the first field of an existing pair.'),
         ('emergent', 'eng: a one-slot mutable box, which is the smallest useful stateful object and the basis of every larger one. math: swapping two cars needs a temporary, and the reason is the same reason it always is -- the first write destroys the value the second write needs. cs: map! written out of set-car! and pair-for-each, which is how it is actually implemented and the version worth reading before using the built-in.'),
         ('meta', 'The family is mutable state built from one primitive. What emerges is that boxes, records, in-place maps and object systems are all this verb with more names on top, so understanding its aliasing behaviour is not optional.')],
        ('Everything stateful in the language is built from this. Learn its aliasing before you build on it.',
         'The temporary in a swap is not ceremony; it is what the sequencing of destructive writes requires.',
         'Reading the four-line implementation of map! teaches more than the verb\'s documentation does.')),
)

SET_CDR_BANG = dict(
    name='set-cdr!', std='R7RS-small', library='list', kind='state-change',
    signature='(set-cdr! pair obj) -> unspecified',
    summary='Replace the cdr of a pair in place, SHARING the new tail rather than copying it. This is the verb that makes lists a mutable structure.',
    explanation=(
        'set-cdr! writes one field, exactly as set-car! does, but the field it writes is the one '
        'that holds the structure together -- so this single verb is what turns a list from a '
        'value into a mutable data structure. Everything in this chapter\'s linear-update family '
        'is set-cdr! underneath. The requirement that matters most is one people skip: the new '
        'tail is SHARED, not copied. After (set-cdr! p t), (eq? (cdr p) t) must hold. The write '
        'lands in place, on the caller\'s own cell: the pair keeps its identity, every other holder '
        'of it sees the new tail without being told, and the tail that was there before is no '
        'longer reachable through p. That is what '
        'makes constant-time extension possible, what makes append! able to embed its arguments, '
        'and what makes a circular list expressible at all -- write a cell into its own cdr and '
        'the list has no end. There is no direct test in the conformance suite, but list.sld:402-410 '
        'exercises it hard inside the pair-fold test: kons calls (set-cdr! pair tail) and the '
        'reversal that results is checked to be built from the original cells, which is only true '
        'if the write landed on the caller\'s cell with the tail shared. Motoi cannot do this today '
        'on a proper list -- there is no pair to write into, and the existing record in '
        'scheme/reference/39-list.slat documents the tail being COPIED, which is precisely the '
        'divergence that makes queues, circular lists and every linear-update verb impossible.'),
    examples=[
        ('novice',
         "(define p (cons 1 2))\n(set-cdr! p 99)\n(display p)\n(newline)"),
        ('intermediate',
         ";; the new tail is SHARED, not copied.\n"
         "(define p (cons 1 '()))\n(define t (list 2 3))\n(set-cdr! p t)\n"
         "(display (list 'p p 'tail-shared (eq? (cdr p) t)))\n(newline)"),
        ('expert',
         ";; a cell whose cdr is itself: a list with no end. Do not walk it.\n"
         "(define ring (list 1))\n(set-cdr! ring ring)\n"
         "(display (list 'first (car ring) 'second (cadr ring) 'wraps (eq? (cdr ring) ring)))\n(newline)"),
    ],
    caveats=[
        'The new tail is SHARED, not copied. (eq? (cdr p) obj) must hold after the call. Everything in the linear-update family depends on this.',
        'Any object may become the cdr, not only a list. That is how dotted pairs and improper lists are made.',
        'Writing a cell into its own cdr, directly or through a chain, makes a circular list. Nothing warns you and length will not return.',
        'The return value is unspecified.',
        'Literal pairs from quoted data must not be mutated.',
        'MOTOI DIVERGES TODAY: on a list built by list, the new tail is COPIED rather than shared (documented in scheme/reference/39-list.slat, which carries :status "needs-alfred"). That single divergence is why queues, circular lists, last-pair handles and all 15 linear-update verbs cannot work.',
    ],
    drawbacks=[
        'It can build a structure that no other verb in the language can safely consume, and it does so silently.',
        'It is the sharpest tool here: one wrong write reroutes an arbitrary amount of shared structure.',
        'A cycle created by accident is usually discovered as a hang, at the worst possible moment.',
    ],
    usecases=[
        'Constant-time list extension through a kept last-pair handle.',
        'Queues, ring buffers and any structure with a tail pointer.',
        'Implementing the linear-update verbs; every one of them is a set-cdr! in a loop.',
    ],
    related=['set-car!', 'cons', 'cdr', 'last-pair', 'circular-list'],
    learn=('The write that makes a list a structure',
           ['set-car!', 'cons', 'last-pair', 'eq?'],
           'Extend a list through last-pair, then build a two-element ring by hand, then predict what length would do to it. Stop before running that last one.'),
    provenance='R7RS-small 6.4 (cited spec/R7RS-SMALL-PRIMITIVE-FLOOR.slat:193). No dedicated test in scratch/r7rs-conformance/larceny/list.sld (named at :163); the strongest in-repo exercise is inside the pair-fold test at list.sld:402-410, which requires the write to land on the caller\'s cell with the tail SHARED. An existing record in scheme/reference/39-list.slat carries :status "needs-alfred". Drafted 2026-08-03 against the incoming cons-cell representation; NOT RUN.',
    status='needs-alfred',
    r2=([('eng-program', "(define p (cons 1 '()))\n(set-cdr! p (list 2 3))\n(display p)\n(newline)"),
         ('math-program', "(define p (cons 1 '()))\n(define t (list 2 3))\n(set-cdr! p t)\n(display (list 'shared (eq? (cdr p) t) 'car-unchanged (car p)))\n(newline)"),
         ('cs-program', "(define xs (list 1 2 3))\n(set-cdr! (last-pair xs) (list 4))\n(display (list 'extended-in-place xs))\n(newline)"),
         ('problem', 'The operator wants to add to the end of a list without copying it. Candidates: append (copies the whole list), append! (walks to the end every time), or keeping the last cell and writing through it with set-cdr! (one write, constant time). Only the third is actually constant time, and it is constant time only because the tail is SHARED -- if the implementation copied the tail instead, the operation would be linear and the shared structure everything else depends on would not exist.'),
         ('explanation', 'eng: the list now runs on into the new tail. math: the cdr is the new object by identity and the car is untouched. cs: extending through last-pair is the idiom, and it is the program that currently fails on Motoi.'),
         ('meta', 'The sharing requirement looks like an implementation detail and is actually the specification. Copying the tail satisfies every equal? test and breaks the language.')],
        ('The requirement that looks like a detail is the one that carries the structure. Sharing is not an optimisation here.',
         'Identity of the new cdr with the object passed in is the assertion; equality is not enough.',
         'This one write is the difference between a list library and a list data structure.')),
    r3=([('setup', 'Changing what a link points at, and so changing the shape of everything downstream.'),
         ('rungs', [
             ('list', "(define p (cons 1 '()))\n(set-cdr! p (list 2))\n(display p)\n(newline)"),
             ('re-setting the points at a junction', "(define junction (cons 'signal '()))\n(set-cdr! junction (list 'branch-line))\n(display junction)\n(newline)"),
             ('redirecting a forwarding address', "(define entry (cons 'name '()))\n(set-cdr! entry (list 'new-address))\n(display entry)\n(newline)"),
         ]),
         ('explanation', 'In list, the cdr is rewritten and everything after that point changes for every traveller. Re-setting the points at a junction sends every following train down a different line without touching either line. Redirecting a forwarding address changes where everything downstream goes while the entry itself stays where it was. All three share a small local change with an unbounded downstream effect.'),
         ('meta', 'The shape transfers wherever one connection determines an entire path.')],
        ('A one-word change to a route changes every journey that uses it.',
         'The reachable set from a cell is determined by its cdr, so rewriting the cdr rewrites the set.',
         'Pointer rewriting is how every linked structure is edited, and why every linked structure needs an ownership story.')),
    r4=([('eng-program', "(define p (cons 1 '()))\n(set-cdr! p (list 2 3))\n(display (list 'p p 'len (length p)))\n(newline)"),
         ('math-program', "(define p (cons 1 '()))\n(define t (list 2 3))\n(set-cdr! p t)\n(display (list 'shared-not-copied (eq? (cdr p) t)))\n(newline)"),
         ('cs-program', "(define ring (list 1))\n(set-cdr! ring ring)\n(display (list 'self-referential (eq? (cdr ring) ring) 'second-element (cadr ring)))\n(newline)"),
         ('claim', 'set-cdr! replaces the cdr field of the given pair with obj, sharing obj rather than copying it: (eq? (cdr p) obj) holds afterwards. The pair\'s identity and its car are unchanged. obj may be any object, including the pair itself, which produces a circular list.'),
         ('invariant', 'forall pair p, object o. after set-cdr!(p, o): eq?(cdr(p), o) and car(p) is unchanged and p is unchanged by identity'),
         ('meta', 'The pattern is structural assignment. What would falsify the claim: a copied tail -- which is exactly what Motoi does today on a proper list -- a changed car, or an inability to write the pair into itself. The self-referential program is the sharpest of the three, because a copying implementation cannot even express it: copying a list into its own cdr terminates and produces something finite and wrong.')],
        ('A copying implementation cannot build a ring. That is the one-line test for whether the representation is real.',
         'eq? is the assertion. Any test written with equal? passes on the broken implementation.',
         'The self-referential case is not an edge case; it is the case that proves the field is a pointer.')),
    r5=([('eng-composition', "(define (extend! xs y) (set-cdr! (last-pair xs) (list y)) xs)\n(display (extend! (list 1 2) 3))\n(newline)"),
         ('math-composition', "(define (make-ring n)\n  (let ((r (list n)))\n    (set-cdr! r r)\n    r))\n(define r (make-ring 7))\n(display (list (car r) (cadr r) (caddr r)))\n(newline)"),
         ('cs-composition', "(define (make-queue)\n  (let ((head (list 'sentinel)))\n    (cons head head)))\n(define (enqueue! q v)\n  (let ((cell (list v)))\n    (set-cdr! (cdr q) cell)\n    (set-cdr! q cell)\n    q))\n(define q (make-queue))\n(enqueue! q 1)\n(enqueue! q 2)\n(display (cdr (car q)))\n(newline)"),
         ('base', 'set-cdr! writes a shared tail into the second field of an existing pair.'),
         ('emergent', 'eng: constant-time extension. math: a cell pointing at itself is the smallest possible circular list, and it is one line. cs: a queue with a sentinel head and a tail pointer -- two set-cdr! calls per enqueue, constant time, and the structure every scheduler and buffer in the system is built from. None of these three programs can work if the tail is copied.'),
         ('meta', 'The family is mutable linked structure. What emerges is the full cost of the current representation: not one broken verb but a whole class of data structures that cannot be written at all, which is the case for changing it.')],
        ('This is the argument for the change, in three programs: extension, rings and queues. All three need a shared tail.',
         'Self-reference in one line is what a pointer field buys; nothing weaker gives it to you.',
         'Queues, rings and builders are the everyday structures, and every one of them is set-cdr! with a tail pointer.')),
)
