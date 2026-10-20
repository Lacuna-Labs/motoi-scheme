#!/usr/bin/env python3
"""verbs_table.py -- the authored content for the 21 pair-representation verbs.

Priya, 2026-08-03. Read scratch/pairs/spec-pack/00-SOURCES.md first.

Every behavioural claim below traces to a line range in
scratch/r7rs-conformance/larceny/list.sld, the SRFI-1 conformance suite
("Adapted from srfi-1-test.sps", :183). Line ranges are cited in :provenance.
The normative SRFI-1 document is not in this repo and nothing here is quoted
from it.

Records are written to the STRONG reading of SRFI-1 linear update: a `!` verb
may destroy its argument, so the return value is the only thing a caller may
rely on. That is the reading the conformance suite tests, and it is the reading
under which the caveat is safe whichever way Alfred settles the question.
"""

LESSON = ('The bang is a licence to destroy. After the call the cells that '
          'made up the argument have been re-used, so the variable you passed '
          'in no longer names what it named. Bind the result and read only '
          'that.')

# ---------------------------------------------------------------------------
# FAMILY A -- truncate in place. The suite asserts (eq? x y): the argument's
# own head cell IS the result, and the spine has been severed inside it.
# ---------------------------------------------------------------------------

TAKE_BANG = dict(
    name='take!', std='SRFI-1', library='list', kind='state-change',
    signature='(take! lst k) -> list',
    summary='The first k elements of lst, taken by cutting the spine at k rather than by copying it. The argument is destroyed.',
    explanation=(
        'take! is the linear-update twin of take. take builds a fresh k-element list and leaves '
        'its argument untouched; take! reaches into the argument, severs the cdr of the k-th cell, '
        'and hands back the head cell it already had. The suite pins this exactly: after '
        '(take! x 3) on a six-element x, the result is eq? to x and shares every cell down to the '
        'cut. So the shortening is not a view of x, it IS x. ' + LESSON + ' The reason the verb '
        'exists is that take on a long list allocates k cells you are about to throw away; take! '
        'allocates none. The reason it is dangerous is that the saving is paid for out of the '
        "caller's variable, and nothing in the call site says so."),
    examples=[
        ('novice',
         "(define xs (list 1 2 3 4 5 6))\n(define kept (take! xs 3))\n"
         "(display (list 'returned kept))\n(newline)"),
        ('intermediate',
         ";; the destroyed binding: xs is not six long any more.\n"
         "(define xs (list 1 2 3 4 5 6))\n(define kept (take! xs 3))\n"
         "(display (list 'xs-now xs 'same-object (eq? kept xs)))\n(newline)"),
        ('expert',
         ";; take copies, take! cuts. Compare what happens to the source.\n"
         "(define a (list 1 2 3 4 5 6))\n(define b (list 1 2 3 4 5 6))\n"
         "(define pure (take a 3))\n(define destructive (take! b 3))\n"
         "(display (list 'a-after a 'b-after b))\n(newline)"),
    ],
    caveats=[
        'The argument is destroyed. list.sld:308-313 asserts (eq? x y) and (eq? (cddr x) (cddr y)): the result is the argument, cut short.',
        'The dropped tail is not returned to you. If you wanted both halves, split-at! is the verb that hands back both.',
        'k must not exceed the length of lst; there is no cell at which to cut.',
        'Nothing at the call site distinguishes take! from take. Reviewers cannot see the destruction; only the bang can warn them.',
    ],
    drawbacks=[
        'It is only a saving when the argument is genuinely dead. If any other binding still points into the list you have corrupted it at a distance.',
        'The verb cannot be used on a literal or on a list you did not build, because you do not know who else holds it.',
        'Reasoning about a function that calls take! stops being local: the caller has to be read too.',
    ],
    usecases=[
        'Trimming a large freshly-built list to length inside a producer, where the full list has no other owner.',
        'Bounded queues and windows, where the tail past k is provably garbage.',
        'Hot loops where the allocation of take shows up in a measurement, and only then.',
    ],
    related=['take', 'drop', 'split-at!', 'drop-right!', 'take-while!', 'list-tail'],
    learn=('Linear update: buying a saving with the caller\'s data',
           ['take', 'cdr', 'set-cdr!', 'eq?'],
           'Learn take first and use it. Reach for take! only when you can name the owner of the list and prove it is you.'),
    provenance='SRFI-1 linear-update procedures; conformance evidence scratch/r7rs-conformance/larceny/list.sld:308-313; signature derived from the take record in scheme/reference/39-list.slat. Drafted 2026-08-03 against the incoming cons-cell representation; NOT RUN.',
    status='needs-alfred',
    r2=([('eng-program', "(define xs (list 1 2 3 4 5 6))\n(define kept (take! xs 3))\n(display (list 'kept kept 'xs xs))\n(newline)"),
         ('math-program', "(define a (list 1 2 3 4 5))\n(define b (list 1 2 3 4 5))\n(display (equal? (take a 2) (take! b 2)))\n(newline)"),
         ('cs-program', "(define xs (list 1 2 3 4))\n(define kept (take! xs 2))\n(display (list 'result-is-argument (eq? kept xs)))\n(newline)"),
         ('problem', 'The operator has just built a long list inside a producer and wants only its first k elements. Candidates: take (copies k cells, leaves the source intact, safe to hand anyone), list-head (not in this dialect), or take! (allocates nothing but destroys the source). The question the operator must answer first is not which is faster, it is who else holds the list. If the answer is anyone at all, take is the only correct choice.'),
         ('explanation', 'eng: take! returns the prefix and leaves the caller holding a shortened list under the old name. math: as a value, take! agrees with take on every proper list and every legal k; they differ only in what they leave behind. cs: the result is eq? to the argument, which is the operational statement of "the argument was destroyed".'),
         ('meta', 'Choosing between a pure verb and its linear-update twin is an ownership question wearing a performance costume. Answer the ownership question first.')],
        ('Only spend the caller\'s data when the caller is you.',
         'take! and take are the same function of the argument; they differ in what survives the call.',
         'Aliasing is the whole story: eq? to the argument means every other holder of that list has been changed without being told.')),
    r3=(([('setup', 'Shortening a sequence by cutting it where it stands, rather than by copying the part you want.'),
          ('rungs', [
              ('list', "(define xs (list 1 2 3 4 5 6))\n(display (take! xs 3))\n(newline)"),
              ('a rope cut to length', "(define rope (list 'm1 'm2 'm3 'm4 'm5))\n(display (list 'cut (take! rope 2)))\n(newline)"),
              ('a bounded log', "(define (cap! entries n)\n  (if (> (length entries) n) (take! entries n) entries))\n(display (cap! (list 'a 'b 'c 'd) 2))\n(newline)"),
          ]),
          ('explanation', 'In list, take! severs the spine at k. Cutting a rope gives you the piece you wanted and destroys the rope you had; nobody expects the offcut to still be attached. A bounded log does the same to history: the entries past the cap are not archived, they are gone. All three share the shape of a cut that consumes what it cuts.'),
          ('meta', 'The shape transfers anywhere the source is single-owner and the discarded part has no claimant.')]),
        ('A cut is cheap and irreversible; a copy is expensive and safe. Pick on ownership.',
         'Truncation is a prefix operation; it is the copy or the cut that differs, not the prefix.',
         'This is the same trade as an in-place array resize versus a slice: identical results, different survivors.')),
    r4=([('eng-program', "(define xs (list 1 2 3 4 5 6))\n(define kept (take! xs 3))\n(display (list 'length (length kept) 'eq-to-arg (eq? kept xs)))\n(newline)"),
         ('math-program', "(define (agrees? n k)\n  (let ((a (build-list-1-to n)) (b (build-list-1-to n)))\n    (equal? (take a k) (take! b k))))\n(define (build-list-1-to n)\n  (let loop ((i n) (acc (list))) (if (= i 0) acc (loop (- i 1) (cons i acc)))))\n(display (list (agrees? 6 3) (agrees? 4 0) (agrees? 4 4)))\n(newline)"),
         ('cs-program', "(define xs (list 1 2 3 4 5 6))\n(define alias xs)\n(define kept (take! xs 3))\n(display (list 'alias-was-changed-too (eq? alias kept)))\n(newline)"),
         ('claim', 'For a proper list lst and 0 <= k <= (length lst), take! returns a list equal? to (take lst k), and that list is eq? to lst itself when k > 0. Every binding that pointed at lst before the call now points at the truncated result.'),
         ('invariant', 'forall proper lst, 0 <= k <= |lst|. equal?(take!(lst,k), take(lst,k)) and (k > 0 implies eq?(take!(lst,k), lst))'),
         ('meta', 'The pattern is value-agreement with survivor-disagreement. What would falsify the claim: a result not equal? to take, or a fresh list returned instead of the argument\'s own head cell -- which is precisely what the current array-backed implementation does, and why this record carries :status needs-alfred.')],
        ('The alias line is the one to read: a second name for the list was changed by a call it does not appear in.',
         'Agreement on values is not agreement on effects; a proof of the first says nothing about the second.',
         'A test that only checks equal? cannot tell take from take!. That is exactly how the aliasing shipped unnoticed.')),
    r5=([('eng-composition', "(define (first-page! rows n)\n  (take! rows n))\n(display (first-page! (list 'a 'b 'c 'd 'e) 2))\n(newline)"),
         ('math-composition', "(define (halves! xs k)\n  (let ((tail (drop xs k)))\n    (list (take! xs k) tail)))\n(display (halves! (list 1 2 3 4 5) 2))\n(newline)"),
         ('cs-composition', "(define (safe-take xs k)\n  (take (list-copy xs) k))\n(display (safe-take (list 1 2 3 4) 2))\n(newline)"),
         ('base', 'take! shortens a list by cutting its spine and returns the head cell it already had.'),
         ('emergent', 'eng: paging over a list you own, with no allocation per page. math: taking the tail BEFORE the cut is what makes a two-way split work at all -- once take! has run, the tail is unreachable, which is the whole argument for split-at!. cs: the defensive form -- copy, then take purely -- is what you write when you cannot prove ownership, and it costs exactly what take! was trying to save.'),
         ('meta', 'The composition family here is order-of-operations under destruction: with a pure verb the order of reads does not matter, with take! it decides whether the second read is possible.')],
        ('Sequence matters once a verb destroys. Write the reads before the cut.',
         'Under mutation, expressions stop commuting; the cut is a fence the other reads must be on the correct side of.',
         'split-at! exists because the hand-rolled take!-then-drop pairing is unwriteable in the correct order.')),
)

DROP_RIGHT_BANG = dict(
    name='drop-right!', std='SRFI-1', library='list', kind='state-change',
    signature='(drop-right! lst k) -> list',
    summary='All but the last k elements of lst, produced by cutting the spine rather than copying it. The argument is destroyed.',
    explanation=(
        'drop-right! and take! arrive at the same place from opposite directions: take! is told how '
        'many to keep, drop-right! is told how many to lose. Both cut the spine once and return the '
        "argument's own head cell -- the suite checks (eq? x y) for drop-right! at list.sld:315-320 "
        'exactly as it does for take!. The difference that matters is arithmetic, not structure: '
        'drop-right! must walk the list to learn its length before it knows where to cut, so it is '
        'not cheaper than drop-right in traversal, only in allocation. ' + LESSON + ' Note the '
        'asymmetry with drop-right\'s pure sibling: drop-right can afford to share the argument\'s '
        'cells because it never writes; drop-right! writes, so sharing becomes destruction.'),
    examples=[
        ('novice',
         "(define xs (list 1 2 3 4 5 6))\n(display (drop-right! xs 3))\n(newline)"),
        ('intermediate',
         ";; the argument is the result: xs has lost its last three.\n"
         "(define xs (list 1 2 3 4 5 6))\n(define head (drop-right! xs 3))\n"
         "(display (list 'head head 'xs xs 'same (eq? head xs)))\n(newline)"),
        ('expert',
         ";; k = 0 keeps everything; k = length gives the empty list and there is\n"
         ";; then no cell to return, so the argument binding is the only casualty.\n"
         "(define a (list 1 2 3))\n(define b (list 1 2 3))\n"
         "(display (list 'k0 (drop-right! a 0) 'kall (drop-right! b 3)))\n(newline)"),
    ],
    caveats=[
        'The argument is destroyed. list.sld:315-320 asserts the result is eq? to the argument and shares its cells down to the cut.',
        'It must traverse the whole list to find the cut point, so it saves allocation, not time.',
        'k greater than the length is an error; there is no negative-length list to return.',
        'The elements that were dropped are unreachable afterwards. Unlike split-at!, nothing hands them back.',
    ],
    drawbacks=[
        'Two traversals of the argument in the obvious implementation -- one to measure, one to cut -- against drop-right\'s one-and-a-copy.',
        'Correctness depends on a fact the type system cannot state: that this list has exactly one owner.',
        'It reads as an accessor at the call site while behaving as a command.',
    ],
    usecases=[
        'Stripping a known-length trailer (a checksum, a sentinel run) off a buffer you just assembled.',
        'Shrinking a scratch accumulator in a loop where the discarded tail is dead by construction.',
        'Symmetric partner to take! when the count you have is a count of what to lose.',
    ],
    related=['drop-right', 'take!', 'take-right', 'split-at!', 'last-pair'],
    learn=('Cutting from the far end, and why that costs a traversal',
           ['drop-right', 'length', 'set-cdr!', 'take!'],
           'Understand drop-right and take! as the two ways to name one cut, then learn why only one of them can be O(1) in a singly-linked list.'),
    provenance='SRFI-1 linear-update procedures; conformance evidence scratch/r7rs-conformance/larceny/list.sld:315-320; signature derived from the drop-right record in scheme/reference/39-list.slat. Drafted 2026-08-03; NOT RUN.',
    status='needs-alfred',
    r2=([('eng-program', "(define xs (list 1 2 3 4 5 6))\n(display (drop-right! xs 3))\n(newline)"),
         ('math-program', "(define a (list 1 2 3 4 5 6))\n(define b (list 1 2 3 4 5 6))\n(display (equal? (drop-right a 3) (drop-right! b 3)))\n(newline)"),
         ('cs-program', "(define xs (list 1 2 3 4 5 6))\n(define head (drop-right! xs 3))\n(display (eq? head xs))\n(newline)"),
         ('problem', 'The operator has a buffer with a fixed-size trailer to strip. Candidates: drop-right (copies the part it keeps, leaves the buffer whole), take with a computed count (same cost, one more arithmetic step to get wrong), or drop-right! (no allocation, buffer destroyed). Because the count of what to LOSE is what the operator holds, drop-right! reads more directly than take! here -- and that readability is the trap, since the two verbs differ in danger, not in clarity.'),
         ('explanation', 'eng: the trailer is gone and the buffer variable now names the stripped list. math: drop-right!(l,k) = drop-right(l,k) as a value, for every proper l and legal k. cs: the eq? check is the only observable difference, and no ordinary test looks for it.'),
         ('meta', 'When two verbs differ only in an effect no assertion in your suite examines, the suite is not telling you which one you called.')],
        ('Naming the cut by what you lose is clearer here, and clarity is not safety.',
         'The two directions of one cut agree on values for all legal arguments.',
         'A difference nothing observes is a difference that ships.')),
    r3=(([('setup', 'Removing a fixed-size tail from a sequence by severing it where it lies.'),
          ('rungs', [
              ('list', "(display (drop-right! (list 1 2 3 4 5) 2))\n(newline)"),
              ('a message with a trailing checksum', "(define frame (list 'h 'd1 'd2 'sum))\n(display (drop-right! frame 1))\n(newline)"),
              ('a queue that forgets its oldest', "(define (forget-oldest! q n) (drop-right! q n))\n(display (forget-oldest! (list 'new 'mid 'old) 1))\n(newline)"),
          ]),
          ('explanation', 'In list, the cut lands k from the end. A frame with a checksum is the same operation given a protocol name: strip the trailer, keep the payload, and the trailer is not wanted again. A queue that forgets its oldest entries is the same cut applied to time. All three share a tail that is known-dead before the call.'),
          ('meta', 'The shape transfers wherever the discarded suffix has already been consumed or was never wanted.')]),
        ('If the tail were wanted, this would be the wrong verb; split-at! would be the right one.',
         'Suffix removal is prefix retention with the count taken from the other end.',
         'Protocol framing is the everyday instance: header, payload, trailer, and only the payload survives.')),
    r4=([('eng-program', "(define xs (list 1 2 3 4 5 6))\n(define head (drop-right! xs 3))\n(display (list 'head head 'len (length head)))\n(newline)"),
         ('math-program', "(define (agree? n k)\n  (let loop ((i n) (a (list)) (b (list)))\n    (if (= i 0)\n        (equal? (drop-right a k) (drop-right! b k))\n        (loop (- i 1) (cons i a) (cons i b)))))\n(display (list (agree? 6 3) (agree? 3 0) (agree? 3 3)))\n(newline)"),
         ('cs-program', "(define xs (list 1 2 3 4))\n(define alias xs)\n(define head (drop-right! xs 1))\n(display (list 'alias-shortened-too (eq? alias head)))\n(newline)"),
         ('claim', 'For a proper list lst and 0 <= k <= (length lst), drop-right! returns a list equal? to (drop-right lst k); for k < (length lst) that result is eq? to lst. take!(lst, |lst|-k) and drop-right!(lst, k) name the same cut.'),
         ('invariant', 'forall proper lst, 0 <= k <= |lst|. equal?(drop-right!(lst,k), drop-right(lst,k)) and equal?(drop-right!(lst,k), take(lst, |lst| - k))'),
         ('meta', 'The pattern is one cut, two coordinate systems. What would falsify the claim: disagreement with drop-right at either boundary (k = 0, k = |lst|), or a fresh list where the argument\'s head cell was expected.')],
        ('State the invariant in both coordinate systems and the off-by-one has nowhere to hide.',
         'The identity drop-right(l,k) = take(l,|l|-k) is what lets one implementation serve both names.',
         'The k = 0 and k = |lst| boundaries are where linear-update verbs most often forget to return the argument.')),
    r5=([('eng-composition', "(define (strip-trailer! frame trailer-size)\n  (drop-right! frame trailer-size))\n(display (strip-trailer! (list 'h 'd 'sum) 1))\n(newline)"),
         ('math-composition', "(define (middle! xs front back)\n  (drop-right! (drop xs front) back))\n(display (middle! (list 1 2 3 4 5 6) 1 2))\n(newline)"),
         ('cs-composition', "(define (rotate-drop xs k)\n  (append (drop xs k) (drop-right xs (- (length xs) k))))\n(display (rotate-drop (list 1 2 3 4) 2))\n(newline)"),
         ('base', 'drop-right! cuts k cells off the end of a list and returns what is left of the argument.'),
         ('emergent', 'eng: trailer stripping, the protocol-shaped use. math: composing drop with drop-right! carves a middle segment, and note the pure drop must run FIRST -- after the destructive cut there is no original left to drop from. cs: the pure rotation shows what the same arithmetic looks like when nothing is destroyed, and it is the version you can call twice.'),
         ('meta', 'The family is segment extraction. What emerges is a rule: in a pipeline mixing pure and linear-update verbs, every pure read must precede the first destructive write.')],
        ('One destructive step in a pipeline fixes the order of every step around it.',
         'Front and back offsets compose into a middle segment; the algebra is unaffected by which verbs are destructive.',
         'Idempotence is the casualty. drop-right! called twice on the same variable does not mean what it means once.')),
)

TAKE_WHILE_BANG = dict(
    name='take-while!', std='SRFI-1', library='list', kind='state-change',
    signature='(take-while! pred lst) -> list',
    summary='The longest prefix of lst whose elements all satisfy pred, produced by cutting the spine at the first failure. The argument is destroyed.',
    explanation=(
        'Where take! is told where to cut, take-while! discovers it: the predicate walks the list '
        'and the cut lands at the first element that fails. The suite asserts (eq? r x) and '
        '(eq? (cdr r) (cdr x)) at list.sld:518-522, so once again the returned prefix is not a copy, '
        'it is the argument with its spine severed. ' + LESSON + ' There is one case worth naming '
        'because it looks like a bug and is not: if the FIRST element fails, the prefix is empty, '
        'there is no cell to cut, and the argument comes back untouched. So take-while! sometimes '
        'destroys and sometimes does not, decided at run time by data. A caller that reasons "it '
        'has a bang, so my variable is gone" is right to stop using the variable, but must not '
        'assume the variable changed.'),
    examples=[
        ('novice',
         "(define xs (list 2 18 3 10 22 9))\n(display (take-while! even? xs))\n(newline)"),
        ('intermediate',
         ";; the cut lands at the first odd element; xs is shortened to match.\n"
         "(define xs (list 2 18 3 10 22 9))\n(define evens (take-while! even? xs))\n"
         "(display (list 'evens evens 'xs xs 'same (eq? evens xs)))\n(newline)"),
        ('expert',
         ";; the empty-prefix case: nothing is cut, so nothing is destroyed.\n"
         "(define xs (list 3 4 5))\n(define got (take-while! even? xs))\n"
         "(display (list 'got got 'xs-intact xs))\n(newline)"),
    ],
    caveats=[
        'The argument is destroyed when the prefix is non-empty. list.sld:518-522 asserts (eq? r x) and (eq? (cdr r) (cdr x)).',
        'When the first element fails the predicate the result is the empty list and the argument is left whole. The destruction is data-dependent.',
        'The elements after the cut are not returned. span! is the verb that gives you both sides.',
        'pred is called on elements in order and stops at the first failure; do not rely on it being called on the rest.',
    ],
    drawbacks=[
        'Whether the call destroyed anything cannot be known without inspecting the data, which makes the failure mode intermittent rather than reproducible.',
        'It is the destructive verb most likely to pass a test suite by accident, because small test lists often fail on the first element.',
        'Predicates with side effects interact badly with the early stop: the tail never sees them.',
    ],
    usecases=[
        'Trimming a self-owned buffer at the first sentinel value.',
        'Consuming a run of same-shaped records off the front of a stream you assembled.',
        'Lexing-style prefix scans where the remainder is discarded rather than parsed.',
    ],
    related=['take-while', 'drop-while', 'span!', 'break!', 'take!'],
    learn=('Data-dependent destruction',
           ['take-while', 'take!', 'set-cdr!', 'eq?'],
           'Learn take-while, then take!, then see how take-while! inherits the danger of one and the run-time indecision of the other.'),
    provenance='SRFI-1 linear-update procedures; conformance evidence scratch/r7rs-conformance/larceny/list.sld:518-522; signature derived from the take-while record in scheme/reference/39-list.slat. Drafted 2026-08-03; NOT RUN.',
    status='needs-alfred',
    r2=([('eng-program', "(define xs (list 2 18 3 10))\n(display (list 'prefix (take-while! even? xs) 'xs xs))\n(newline)"),
         ('math-program', "(define a (list 2 18 3 10))\n(define b (list 2 18 3 10))\n(display (equal? (take-while even? a) (take-while! even? b)))\n(newline)"),
         ('cs-program', "(define xs (list 3 4 5))\n(define got (take-while! even? xs))\n(display (list 'empty-prefix got 'argument-untouched xs))\n(newline)"),
         ('problem', 'The operator wants the leading run of matching elements from a list they built. Candidates: take-while (copies the run, source intact), filter (wrong -- it keeps matches from everywhere, not just the front), or take-while! (no allocation, source cut). The decision is the usual ownership one, with a wrinkle: take-while! may not destroy anything at all, so a test that happens to fail on element one will not reveal the hazard.'),
         ('explanation', 'eng: the run comes back and the source variable is shortened to the same run. math: as a value take-while! agrees with take-while everywhere. cs: on an empty prefix nothing is written, which is why this verb hides its own danger better than take! does.'),
         ('meta', 'A hazard that fires on some inputs and not others is worse than one that always fires, because the always-fires kind gets caught on day one.')],
        ('Intermittent damage is harder to find than constant damage; treat the bang as unconditional even when the write is not.',
         'Value agreement with take-while is total; effect agreement is conditional on the prefix being non-empty.',
         'Test inputs should include a first-element failure and a whole-list match, or the boundary goes unexamined.')),
    r3=(([('setup', 'Keeping the leading run that satisfies a test, by cutting the sequence where the run ends.'),
          ('rungs', [
              ('list', "(display (take-while! even? (list 2 4 5 6)))\n(newline)"),
              ('a queue served until the first refusal', "(define q (list 'ready 'ready 'blocked 'ready))\n(display (take-while! (lambda (s) (eq? s 'ready)) q))\n(newline)"),
              ('a numeric series read until it leaves range', "(display (take-while! (lambda (n) (< n 100)) (list 3 40 99 100 5)))\n(newline)"),
          ]),
          ('explanation', 'In list, the cut lands at the first failing element. A queue served until the first refusal stops there by policy, not by count, and what follows is a different problem. A series read until it leaves range is the same stop rule applied to numbers. All three share a boundary discovered by the data rather than supplied by the caller.'),
          ('meta', 'The shape transfers wherever a run ends at a condition rather than at an index.')]),
        ('A stop rule beats a count when the data decides where the boundary is.',
         'The prefix is maximal: the element at the cut is the first counterexample, which is what makes the answer unique.',
         'Early termination is the reason this cannot be written as filter and then a length.')),
    r4=([('eng-program', "(define xs (list 2 18 3))\n(define r (take-while! even? xs))\n(display (list 'r r 'eq-to-arg (eq? r xs)))\n(newline)"),
         ('math-program', "(define (maximal? p xs)\n  (let ((r (take-while p xs)))\n    (and (every p r)\n         (or (= (length r) (length xs))\n             (not (p (list-ref xs (length r))))))))\n(display (list (maximal? even? (list 2 4 5 6)) (maximal? even? (list 1 2)) (maximal? even? (list 2 4))))\n(newline)"),
         ('cs-program', "(define xs (list 1 2 3))\n(define r (take-while! even? xs))\n(display (list 'nothing-destroyed (equal? xs (list 1 2 3)) 'result r))\n(newline)"),
         ('claim', 'take-while! returns the maximal prefix of lst all of whose elements satisfy pred. That result is equal? to (take-while pred lst). When the prefix is non-empty it is eq? to lst; when it is empty, lst is unchanged.'),
         ('invariant', 'forall pred, proper lst. r = take-while!(pred,lst) satisfies every(pred,r) and (|r| = |lst| or not pred(lst[|r|])) and (|r| > 0 implies eq?(r, lst))'),
         ('meta', 'The pattern is a maximal prefix under a predicate. What would falsify the claim: a result whose next element also satisfies pred (not maximal), an element in the result failing pred, or a fresh list returned in the non-empty case.')],
        ('State both halves of maximality -- all of these pass, and the next one does not -- or the proof admits short answers.',
         'Maximality is what makes the prefix unique; without it every prefix of a matching run would qualify.',
         'The empty-prefix branch needs its own assertion because it is the branch where the effect disappears.')),
    r5=([('eng-composition', "(define (serve-ready! q)\n  (take-while! (lambda (s) (eq? s 'ready)) q))\n(display (serve-ready! (list 'ready 'ready 'blocked)))\n(newline)"),
         ('math-composition', "(define (run-and-rest p xs)\n  (let ((rest (drop-while p xs)))\n    (list (take-while! p xs) rest)))\n(display (run-and-rest even? (list 2 4 5 6)))\n(newline)"),
         ('cs-composition', "(define (chunk-by p xs)\n  (if (null? xs)\n      (list)\n      (let ((run (take-while p xs)))\n        (if (null? run)\n            (cons (list (car xs)) (chunk-by p (cdr xs)))\n            (cons run (chunk-by p (drop xs (length run))))))))\n(display (chunk-by even? (list 2 4 5 6 8)))\n(newline)"),
         ('base', 'take-while! keeps the leading run that satisfies a predicate and cuts the list there.'),
         ('emergent', 'eng: a server that drains work until the first blocked item. math: pairing the run with the remainder requires reading the remainder first, which is the argument span! exists to settle. cs: chunking a list into runs cannot use the destructive verb at all -- every chunk after the first needs a list the destructive version has already eaten.'),
         ('meta', 'The family is run-segmentation. What emerges is a boundary on where linear update is usable: it serves one-shot consumption, and it cannot serve any algorithm that revisits the source.')],
        ('One-shot consumption is the whole domain of these verbs; anything that loops over the source is out.',
         'Runs partition a sequence, and a partition needs both sides -- which a prefix-only verb cannot supply.',
         'Chunking is the standard counterexample: it looks like repeated take-while and cannot be repeated take-while!.')),
)
