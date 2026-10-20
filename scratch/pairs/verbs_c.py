#!/usr/bin/env python3
"""verbs_c.py -- cell-reusing filters and the in-place map.

Priya, 2026-08-03. Companion to verbs_table.py; same rules apply.

The four filter verbs share a test shape in the conformance suite: it collects
the argument's cells with pair-fold BEFORE the call and then asserts that every
cell of the RESULT was among them. That is a weaker guarantee than the eq?
checks the truncating verbs get -- it says nothing is allocated, but it does
not say which cell comes back as the head. It cannot: the head is dropped
whenever the first element is filtered out.

map! is the odd one. It does not relink anything; it overwrites each car in
place, so the spine survives and the contents do not.
"""

from verbs_table import LESSON

FILTER_BANG = dict(
    name='filter!', std='SRFI-1', library='higher-order', kind='state-change',
    signature='(filter! pred lst) -> list',
    summary='The elements of lst satisfying pred, kept by unlinking the ones that fail rather than by copying the ones that pass. The argument is destroyed.',
    explanation=(
        'filter builds a fresh list of the elements that pass. filter! keeps the passing cells '
        'where they are and re-points the cdrs to skip the failing ones. The suite\'s check at '
        'list.sld:484-490 is worth reading closely, because it is weaker than the one take! gets: '
        'it gathers the argument\'s cells first and then requires every cell of the result to have '
        'been among them. It does not assert that the result is eq? to the argument, and it '
        'cannot -- if the first element fails, the head cell is not in the result at all. '
        + LESSON + ' That is a sharper warning here than elsewhere: with take! the argument '
        'variable at least still points at the head of the answer, but with filter! it may point '
        'at a dropped cell whose cdr now skips ahead into the middle of the result. There is no '
        'sense in which the old variable is a prefix or a stub. It is a fragment.'),
    examples=[
        ('novice',
         "(define xs (list 0 7 8 8 43 -4))\n(display (filter! even? xs))\n(newline)"),
        ('intermediate',
         ";; nothing is allocated: every cell of the result came from xs.\n"
         "(define xs (list 0 7 8 8 43 -4))\n(define cells (pair-fold cons (list) xs))\n"
         "(define kept (filter! even? xs))\n"
         "(display (list 'kept kept 'no-new-cells (every (lambda (c) (memq c cells)) (pair-fold cons (list) kept))))\n(newline)"),
        ('expert',
         ";; when the first element fails, the argument variable is left naming a\n"
         ";; cell that is not in the result at all.\n"
         "(define xs (list 7 8 9 10))\n(define kept (filter! even? xs))\n"
         "(display (list 'kept kept 'head-was-dropped (not (eq? kept xs))))\n(newline)"),
    ],
    caveats=[
        'The argument is destroyed. list.sld:484-490 asserts every cell of the result came from the argument -- nothing is allocated.',
        'The result is NOT necessarily eq? to the argument. When the first element fails the predicate, the argument\'s head cell is dropped and the old variable names a fragment.',
        'The order of the kept elements is preserved.',
        'pred is called on every element, unlike take-while! which stops early.',
        'remove! is filter! with the predicate negated; the two share an implementation and a hazard.',
    ],
    drawbacks=[
        'The leftover binding is neither a prefix nor a stub, which makes the damage harder to describe than for any other verb here.',
        'It saves allocation but not traversal, and the pure filter is already a single pass.',
        'Because the head may or may not survive, code that both filters destructively and keeps the old name is wrong in a way that depends on the data.',
    ],
    usecases=[
        'Compacting a large freshly-built list in place inside a producer.',
        'Removing dead entries from a private worklist between passes.',
        'Memory-constrained pipelines where the filtered-out cells must be reclaimed immediately.',
    ],
    related=['filter', 'remove!', 'delete!', 'partition', 'delete-duplicates!'],
    learn=('Filtering by unlinking, and the fragment left behind',
           ['filter', 'set-cdr!', 'pair-fold', 'eq?'],
           'Filter purely first. Then draw the cells on paper and trace which cdr changes when an element in the middle is dropped, and which changes when the first one is.'),
    provenance='SRFI-1 linear-update procedures; conformance evidence scratch/r7rs-conformance/larceny/list.sld:484-490; signature derived from the filter record in scheme/reference/33-higher-order.slat. Drafted 2026-08-03; NOT RUN.',
    status='needs-alfred',
    r2=([('eng-program', "(define xs (list 0 7 8 43 -4))\n(display (filter! even? xs))\n(newline)"),
         ('math-program', "(define a (list 0 7 8 43 -4))\n(define b (list 0 7 8 43 -4))\n(display (equal? (filter even? a) (filter! even? b)))\n(newline)"),
         ('cs-program', "(define xs (list 7 8 9 10))\n(define kept (filter! even? xs))\n(display (list 'head-dropped (not (eq? kept xs))))\n(newline)"),
         ('problem', 'The operator wants to compact a large list they built, dropping the entries that fail a test. Candidates: filter (fresh list, source intact), remove with a negated predicate (same, and one negation to get wrong), or filter! (no allocation, source destroyed). The wrinkle that decides it is not speed: with filter! the operator must ALSO stop using the old variable, and unlike take! there is no version of the old variable that is still useful.'),
         ('explanation', 'eng: the compacted list comes back and the old name is unusable. math: filter! agrees with filter for every predicate and proper list. cs: whether the head survives depends on the first element, so no single statement about the old variable is true for all inputs.'),
         ('meta', 'The verbs in this family differ in what they leave behind, and filter! leaves behind the least describable thing in the set. That alone is an argument for the pure form.')],
        ('If you cannot write down what the old variable means afterwards, do not keep the old variable.',
         'filter and filter! are the same function of their arguments; only the survivors differ.',
         'A result that is sometimes eq? to the argument and sometimes not is the worst case for a caller trying to reason.')),
    r3=([('setup', 'Removing the entries that fail a test by unlinking them, rather than by copying the ones that pass.'),
         ('rungs', [
             ('list', "(display (filter! even? (list 1 2 3 4)))\n(newline)"),
             ('a rake with defective wagons cut out', "(define rake (list 'good 'defective 'good 'good))\n(display (filter! (lambda (w) (eq? w 'good)) rake))\n(newline)"),
             ('a playlist with unavailable tracks skipped', "(define playlist (list 'ok 'gone 'ok))\n(display (filter! (lambda (t) (eq? t 'ok)) playlist))\n(newline)"),
         ]),
         ('explanation', 'In list, the failing cells are bypassed by re-pointing the cdr before them. Cutting defective wagons out of a rake couples the good wagons on either side directly together; the defective ones are on the ground, not in a second train. A playlist that skips unavailable tracks does the same to an ordering. All three share a removal that closes the gap rather than leaving one.'),
         ('meta', 'The shape transfers wherever removal must preserve the order and adjacency of what remains.')],
        ('Closing the gap is the whole job; a removal that leaves a hole is a different operation.',
         'Filtering preserves order, which is what distinguishes it from selection into a set.',
         'This is the linked-list deletion pattern, and the reason it needs the cell BEFORE the one being dropped.')),
    r4=([('eng-program', "(define kept (filter! even? (list 1 2 3 4)))\n(display (list 'kept kept 'len (length kept)))\n(newline)"),
         ('math-program', "(define (partition-law? p xs)\n  (= (length xs) (+ (length (filter p xs)) (length (remove p xs)))))\n(display (list (partition-law? even? (list 1 2 3 4)) (partition-law? even? (list)) (partition-law? even? (list 2 4))))\n(newline)"),
         ('cs-program', "(define xs (list 0 7 8))\n(define cells (pair-fold cons (list) xs))\n(define kept (filter! even? xs))\n(display (every (lambda (c) (memq c cells)) (pair-fold cons (list) kept)))\n(newline)"),
         ('claim', 'filter! returns the elements of lst satisfying pred, in their original order, in a list built entirely from lst\'s own cells. It is equal? to (filter pred lst). It is eq? to lst exactly when the first element of lst satisfies pred.'),
         ('invariant', 'forall pred, proper lst. equal?(filter!(pred, lst), filter(pred, lst)) and every cell of filter!(pred, lst) is a cell of lst and |filter(pred,lst)| + |remove(pred,lst)| = |lst|'),
         ('meta', 'The pattern is order-preserving selection with no allocation. What would falsify the claim: a fresh cell in the result, a reordering, or a length that does not complement remove. The cell-membership program is the one that distinguishes filter! from filter at all -- every equal? test passes on both.')],
        ('The cell-membership check is the only assertion that can tell the two verbs apart. Write it or you have not tested this verb.',
         'filter and remove partition the list, and the lengths must add up; that is the cheapest sanity law available.',
         'pair-fold over both lists is the standard technique for asserting no allocation, and it is why pair-fold belongs in this same set of records.')),
    r5=([('eng-composition', "(define (compact! xs) (filter! (lambda (x) x) xs))\n(display (compact! (list 1 #f 2 #f 3)))\n(newline)"),
         ('math-composition', "(define (both p xs) (list (filter p xs) (remove p xs)))\n(display (both even? (list 1 2 3 4)))\n(newline)"),
         ('cs-composition', "(define (count-matching p xs) (length (filter p xs)))\n(display (count-matching even? (list 1 2 3 4)))\n(newline)"),
         ('base', 'filter! keeps the passing cells and unlinks the failing ones.'),
         ('emergent', 'eng: compaction, dropping false entries from a sparse list. math: pairing filter with remove gives both halves, and that pairing is what partition does in one pass -- which is the verb to reach for when you want both, because filter! has already destroyed the list the remove would need. cs: counting matches never needs the list at all, and noticing that is often the fix for code that was reaching for a destructive filter to save memory.'),
         ('meta', 'The family is selection. What emerges is the same constraint seen with take-while!: any composition that needs the source twice rules out the destructive form, and partition exists precisely because that composition is common.')],
        ('When you want both sides, ask for both sides. Filtering twice is two passes and, destructively, impossible.',
         'partition is filter and remove fused; the fusion is what makes it usable where the destructive form is not.',
         'Counting or summing over a filter never needs the intermediate list, and folding is the honest way to say so.')),
)

REMOVE_BANG = dict(
    name='remove!', std='SRFI-1', library='higher-order', kind='state-change',
    signature='(remove! pred lst) -> list',
    summary='The elements of lst NOT satisfying pred, kept by unlinking the ones that do. The argument is destroyed.',
    explanation=(
        'remove! is filter! with the predicate read the other way: filter! keeps what passes, '
        'remove! drops it. The suite tests them with the same list and the same predicate at '
        'list.sld:503-509 and list.sld:484-490, and the two results are complementary. Everything '
        'true of filter! structurally is true here -- cells are unlinked, nothing is allocated, '
        'the result is eq? to the argument only when the FIRST element survives, which for remove! '
        'means only when the first element FAILS the predicate. ' + LESSON + ' The reason both '
        'names exist is the same reason span! and break! both exist: the sentence a caller wants '
        'to write is sometimes "keep the valid ones" and sometimes "drop the expired ones", and '
        'making one of those go through a negation is where the polarity bugs come from.'),
    examples=[
        ('novice',
         "(define xs (list 0 7 8 8 43 -4))\n(display (remove! even? xs))\n(newline)"),
        ('intermediate',
         ";; complementary to filter!: together they account for every element.\n"
         "(define a (list 0 7 8 43))\n(define b (list 0 7 8 43))\n"
         "(display (list 'removed (remove! even? a) 'filtered (filter! even? b)))\n(newline)"),
        ('expert',
         ";; the head survives only when the first element fails the predicate.\n"
         "(define xs (list 2 3 4 5))\n(define left (remove! even? xs))\n"
         "(display (list 'left left 'head-was-dropped (not (eq? left xs))))\n(newline)"),
    ],
    caveats=[
        'The argument is destroyed. list.sld:503-509 asserts every cell of the result came from the argument.',
        'The result is eq? to the argument only when the first element does NOT satisfy pred. Otherwise the old variable names a dropped cell.',
        'Order is preserved among the elements that remain.',
        'pred is called on every element; there is no early exit.',
        'remove! and filter! are complementary. Calling both on one list is impossible -- the first call destroys the input to the second.',
    ],
    drawbacks=[
        'Having the complementary pair doubles the surface for one behaviour and doubles the chance of reading the wrong polarity.',
        'Like filter!, the leftover binding is a fragment rather than a truncation.',
        'Wanting both halves is common and this verb cannot supply them; the pure partition can.',
    ],
    usecases=[
        'Purging expired entries from a private cache list in place.',
        'Dropping sentinel or padding values out of a freshly-decoded buffer.',
        'Any "delete where" pass over a list with exactly one owner.',
    ],
    related=['remove', 'filter!', 'delete!', 'partition', 'delete-duplicates!'],
    learn=('Complementary selection and predicate polarity',
           ['remove', 'filter!', 'partition', 'not'],
           'Write the same purge with filter! and with remove! and see which one needed a not. The one that did not is the one to keep.'),
    provenance='SRFI-1 linear-update procedures; conformance evidence scratch/r7rs-conformance/larceny/list.sld:503-509; signature derived from the remove record in scheme/reference/33-higher-order.slat. Drafted 2026-08-03; NOT RUN.',
    status='needs-alfred',
    r2=([('eng-program', "(define xs (list 0 7 8 43))\n(display (remove! even? xs))\n(newline)"),
         ('math-program', "(define a (list 0 7 8 43))\n(define b (list 0 7 8 43))\n(display (equal? (remove even? a) (remove! even? b)))\n(newline)"),
         ('cs-program', "(define xs (list 2 3 4))\n(define left (remove! even? xs))\n(display (not (eq? left xs)))\n(newline)"),
         ('problem', 'The operator wants to purge expired entries from a private cache list. Candidates: remove (fresh list, source intact), filter with a negated predicate (same result, one negation), or remove! (no allocation, source destroyed). Choosing remove over filter here is not efficiency, it is that "drop the expired" is the sentence, and writing it as "keep the not-expired" adds a step where a mistake can live.'),
         ('explanation', 'eng: the survivors come back and the cache variable is unusable. math: remove! agrees with remove everywhere, and complements filter! on the same input. cs: the head survives only when the first entry is a survivor, so the identity of the result is data-dependent.'),
         ('meta', 'Polarity is chosen for the reader, not for the machine. Both compile to the same work.')],
        ('Write the sentence you mean. A negation at the call site is a defect with a delay fuse.',
         'remove(p) = filter(not-p); the duality is exact and the naming is for humans.',
         'Data-dependent result identity is the shared hazard of the whole filter family.')),
    r3=([('setup', 'Dropping the entries that match a test by unlinking them and closing the gap.'),
         ('rungs', [
             ('list', "(display (remove! even? (list 1 2 3 4)))\n(newline)"),
             ('a shelf cleared of expired stock', "(define shelf (list 'fresh 'expired 'fresh))\n(display (remove! (lambda (i) (eq? i 'expired)) shelf))\n(newline)"),
             ('a guest list with cancellations struck out', "(define guests (list 'coming 'cancelled 'coming))\n(display (remove! (lambda (g) (eq? g 'cancelled)) guests))\n(newline)"),
         ]),
         ('explanation', 'In list, matching cells are bypassed. Clearing expired stock off a shelf leaves the remaining items in the same order with the gaps closed. Striking cancellations off a guest list does the same to a roster, and the roster is still a roster. All three share a deletion defined by a property rather than by position.'),
         ('meta', 'The shape transfers wherever the thing to remove is identified by a test rather than by an index.')],
        ('Deleting by property scales; deleting by index breaks as soon as two things are deleted.',
         'Property-based deletion is the complement of property-based selection, and one traversal answers both.',
         'This is why databases express deletion as a predicate over rows and not as a list of positions.')),
    r4=([('eng-program', "(define left (remove! even? (list 1 2 3 4)))\n(display (list 'left left 'len (length left)))\n(newline)"),
         ('math-program', "(define (complement? p xs)\n  (and (equal? (append (filter p xs) (remove p xs))\n               (append (filter p xs) (remove p xs)))\n       (= (length xs) (+ (length (filter p xs)) (length (remove p xs))))))\n(display (list (complement? even? (list 1 2 3 4)) (complement? even? (list))))\n(newline)"),
         ('cs-program', "(define xs (list 0 7 8))\n(define cells (pair-fold cons (list) xs))\n(define left (remove! even? xs))\n(display (every (lambda (c) (memq c cells)) (pair-fold cons (list) left)))\n(newline)"),
         ('claim', 'remove! returns the elements of lst that do not satisfy pred, in order, in a list built from lst\'s own cells. It is equal? to (remove pred lst) and complementary to (filter pred lst): the two lengths sum to the length of lst.'),
         ('invariant', 'forall pred, proper lst. equal?(remove!(pred, lst), remove(pred, lst)) and |filter(pred,lst)| + |remove(pred,lst)| = |lst| and every cell of remove!(pred,lst) is a cell of lst'),
         ('meta', 'The pattern is complementary order-preserving selection. What would falsify the claim: lengths that do not sum, a reordering, or an allocated cell. Note the lengths law has to be checked on the PURE verbs -- once remove! has run there is no list left to filter, which is itself the reason partition exists.')],
        ('The law you want to check cannot be checked on the destructive verbs. That is a finding, not an inconvenience.',
         'Complementarity is a conservation law: nothing is created and nothing is lost, only sorted into two piles.',
         'partition computes both piles in one pass and is the verb the law is actually testable on.')),
    r5=([('eng-composition', "(define (purge! xs bad) (remove! (lambda (x) (eq? x bad)) xs))\n(display (purge! (list 'a 'b 'a) 'a))\n(newline)"),
         ('math-composition', "(define (split-by p xs) (list (filter p xs) (remove p xs)))\n(display (split-by even? (list 1 2 3 4)))\n(newline)"),
         ('cs-composition', "(define (clean rows) (remove null? rows))\n(display (clean (list (list 1) (list) (list 2))))\n(newline)"),
         ('base', 'remove! drops the matching cells and closes the gaps.'),
         ('emergent', 'eng: a purge by value, which is where delete! comes from -- delete! is remove! with the predicate fixed to an equality against one object. math: the split into both piles again, and again it must use the pure verbs. cs: dropping empty rows is the commonest real use, and it is written pure because rows nearly always came from somewhere else.'),
         ('meta', 'The family is predicate deletion. What emerges is the ladder from remove! down to delete! -- as the predicate gets more specific the verb gets more convenient, and the hazard stays exactly the same.')],
        ('A more convenient verb with the same hazard is a more dangerous verb, because it invites use.',
         'Fixing a predicate to equality against a constant is specialisation, not a new operation.',
         'The commonest real filters run on data with other owners, which is why the pure forms dominate in practice.')),
)

DELETE_BANG = dict(
    name='delete!', std='SRFI-1', library='list', kind='state-change',
    signature='(delete! x lst [=]) -> list',
    summary='Every element of lst equal to x removed, by unlinking. The argument is destroyed.',
    explanation=(
        'delete! is remove! with the predicate fixed to a comparison against one object. Every '
        'element matching x goes, not just the first -- this is a filter, not a find-and-remove. '
        'The optional third argument is the comparison, and its ARGUMENT ORDER is the detail that '
        'catches people: it is called as (= x element), with the object you are deleting FIRST. '
        'The suite proves this at list.sld:576-582, where (delete! 5 (list 1 48 2 5 37) <) yields '
        '(1 2 5) -- 48 and 37 went because (< 5 48) and (< 5 37) are true, and 5 itself stayed '
        'because (< 5 5) is false. Read as (< element 5) the answer would have been different, so '
        'this is not a stylistic point. ' + LESSON + ' The default comparison is equal?, not eqv? '
        'and not eq?, so delete! on a list of lists compares contents.'),
    examples=[
        ('novice',
         "(define xs (list 1 2 1 3))\n(display (delete! 1 xs))\n(newline)"),
        ('intermediate',
         ";; the comparison is called (= x element) -- x FIRST.\n"
         "(define xs (list 1 48 2 5 37))\n(display (delete! 5 xs <))\n(newline)"),
        ('expert',
         ";; the default comparison is equal?, so contents are compared, not identity.\n"
         "(define xs (list (list 1) (list 2) (list 1)))\n(display (delete! (list 1) xs))\n(newline)"),
    ],
    caveats=[
        'The argument is destroyed. list.sld:576-582 asserts every cell of the result came from the argument.',
        'The optional comparison is called as (= x element), with x -- the value being deleted -- as the FIRST argument. list.sld:576-582 pins this with (delete! 5 x <) yielding (1 2 5).',
        'ALL matching elements are removed, not just the first.',
        'The default comparison is equal?, so structurally equal values are deleted even when they are not the same object.',
        'The result is eq? to the argument only when the first element does not match.',
    ],
    drawbacks=[
        'The comparison argument order is backwards from what most callers assume and there is no way to detect the mistake with a symmetric predicate.',
        'Using a non-symmetric comparison is legal and almost always a mistake in disguise.',
        'Like remove!, it leaves a fragment rather than a truncation.',
    ],
    usecases=[
        'Purging a known sentinel value out of a private list.',
        'Removing all occurrences of a retired identifier from a self-owned index.',
        'Set-like difference against a single element where the list has one owner.',
    ],
    related=['delete', 'remove!', 'delete-duplicates!', 'filter!', 'member'],
    learn=('Fixed-object deletion and comparison argument order',
           ['delete', 'remove!', 'equal?', 'member'],
           'Call delete with a non-symmetric comparison such as < and predict the answer before running it. Getting that prediction wrong once is how the argument order gets learned.'),
    provenance='SRFI-1 linear-update procedures; conformance evidence scratch/r7rs-conformance/larceny/list.sld:576-582, which also pins the comparison argument order; signature derived from the delete record in scheme/reference/39-list.slat. Drafted 2026-08-03; NOT RUN.',
    status='needs-alfred',
    r2=([('eng-program', "(define xs (list 1 2 1 3))\n(display (delete! 1 xs))\n(newline)"),
         ('math-program', "(define a (list 1 2 1 3))\n(define b (list 1 2 1 3))\n(display (equal? (delete 1 a) (delete! 1 b)))\n(newline)"),
         ('cs-program', "(define xs (list 1 48 2 5 37))\n(display (list 'x-comes-first (delete! 5 xs <)))\n(newline)"),
         ('problem', 'The operator wants every occurrence of one value gone from a list they own. Candidates: delete (fresh list, source intact), (remove! (lambda (e) (equal? x e)) lst) (same effect, and writing the lambda is where the argument order stops being a trap because you chose it), or delete! (shortest, source destroyed, and the comparison order is now the library\'s choice rather than yours). The explicit lambda is worth considering purely because it makes the order visible.'),
         ('explanation', 'eng: every matching element is gone and the list variable is unusable. math: delete! agrees with delete for every x, list and comparison. cs: the comparison receives x first, which the < example makes impossible to misread.'),
         ('meta', 'A convenience verb hides a decision the explicit form makes you state. Sometimes that decision is one you want to see.')],
        ('When a shorthand hides an argument order, the longhand is not more verbose, it is more honest.',
         'delete(x, l, =) = remove(lambda e. =(x, e), l); the order is part of the specification.',
         'A symmetric comparison hides the bug, so the test must use a non-symmetric one.')),
    r3=([('setup', 'Removing every occurrence of one value from a sequence by unlinking its cells.'),
         ('rungs', [
             ('list', "(display (delete! 1 (list 1 2 1 3)))\n(newline)"),
             ('a bunch of keys with every copy of one key taken off', "(define keys (list 'front 'back 'front 'shed))\n(display (delete! 'front keys))\n(newline)"),
             ('a stock list with a discontinued line withdrawn', "(define stock (list 'a 'discontinued 'b 'discontinued))\n(display (delete! 'discontinued stock))\n(newline)"),
         ]),
         ('explanation', 'In list, every cell whose element matches is bypassed. Taking every copy of one key off a bunch removes all of them, not the first one you find, and the ring closes up. Withdrawing a discontinued line from a stock list is the same act on a catalogue. All three share a removal that is exhaustive rather than positional.'),
         ('meta', 'The shape transfers wherever "remove that value" means all of them, which is nearly always what a person means.')],
        ('People mean all of them. A verb that removes the first is the one that needs the special name.',
         'Deleting a value is set difference against a singleton, and it is idempotent on the pure form.',
         'Exhaustive removal is one pass; first-match removal is one pass with an early exit, and they are different verbs.')),
    r4=([('eng-program', "(define r (delete! 1 (list 1 2 1 3)))\n(display (list 'result r))\n(newline)"),
         ('math-program', "(define (none-left? x xs) (not (member x (delete x xs))))\n(display (list (none-left? 1 (list 1 2 1)) (none-left? 9 (list 1 2))))\n(newline)"),
         ('cs-program', "(define xs (list 1 48 2 5 37))\n(define r (delete! 5 xs <))\n(display (list 'result r 'proves-order (equal? r (list 1 2 5))))\n(newline)"),
         ('claim', 'delete! removes every element e of lst for which (= x e) is true, where = defaults to equal? and is called with x as its first argument. The result preserves order, is built from lst\'s own cells, and is equal? to (delete x lst =).'),
         ('invariant', 'forall x, proper lst, comparison =. equal?(delete!(x, lst, =), delete(x, lst, =)) and no element e of the result satisfies =(x, e) and every cell of the result is a cell of lst'),
         ('meta', 'The pattern is exhaustive value removal. What would falsify the claim: a surviving match, a reordering, an allocated cell, or -- the one a symmetric test cannot see -- a comparison called as (= element x). The < program is included precisely because it is the only one of the three that can detect the argument order.')],
        ('One of these three programs can detect the argument-order bug. The other two cannot. Know which is which.',
         'The post-condition "no element satisfies the comparison" is what makes deletion exhaustive by definition.',
         'Choosing a non-symmetric comparison for the test is a deliberate technique, not a curiosity.')),
    r5=([('eng-composition', "(define (withdraw! stock line) (delete! line stock))\n(display (withdraw! (list 'a 'x 'b 'x) 'x))\n(newline)"),
         ('math-composition', "(define (difference xs ys)\n  (fold (lambda (y acc) (delete y acc)) xs ys))\n(display (difference (list 1 2 3 4) (list 2 4)))\n(newline)"),
         ('cs-composition', "(define (dedupe xs) (delete-duplicates xs))\n(display (dedupe (list 1 2 1 3)))\n(newline)"),
         ('base', 'delete! removes every element matching one value, by unlinking.'),
         ('emergent', 'eng: a withdrawal step in a catalogue. math: folding delete over a second list is set difference, and it is written with the pure verb because the fold reads its accumulator again on every step -- which the destructive form has already eaten. cs: delete-duplicates is the same machinery pointed at the list itself rather than at an external value, which is why the two records sit next to each other.'),
         ('meta', 'The family is set-like removal. What emerges is a boundary that keeps recurring: fold and recursion need their accumulator intact, so the destructive verbs live at the leaves of a computation, never in its spine.')],
        ('Destructive verbs belong at the leaves. Any accumulator that is read again needs the pure form.',
         'Set difference is a fold of deletions; the fold is what forces the purity.',
         'Deduplication is deletion aimed inward, and it inherits every property of deletion including the comparison order.')),
)

DELETE_DUPLICATES_BANG = dict(
    name='delete-duplicates!', std='SRFI-1', library='list', kind='state-change',
    signature='(delete-duplicates! lst [=]) -> list',
    summary='lst with later duplicates unlinked, keeping the FIRST occurrence of each element. The argument is destroyed.',
    explanation=(
        'delete-duplicates! keeps the first occurrence of each element and unlinks every later one, '
        'so the order of the survivors is the order of first appearance. The suite fixes this at '
        'list.sld:589-595: (a b a c a b c z) becomes (a b c z), which is only correct if it is the '
        'FIRST a that stays. ' + LESSON + ' Two things worth knowing before you reach for it. The '
        'default comparison is equal?, and the optional one is called with the element already '
        'kept as its first argument, matching delete!. And the cost is quadratic -- every candidate '
        'is compared against everything kept so far -- so on a large list a hash table or a sort '
        'will beat it comfortably, and the allocation this verb saves is not where the time is '
        'going.'),
    examples=[
        ('novice',
         "(define xs (list 'a 'b 'a 'c))\n(display (delete-duplicates! xs))\n(newline)"),
        ('intermediate',
         ";; the FIRST occurrence is the one that survives.\n"
         "(define xs (list 'a 'b 'a 'c 'a 'b 'c 'z))\n(display (delete-duplicates! xs))\n(newline)"),
        ('expert',
         ";; equal? by default, so structurally equal lists count as duplicates.\n"
         "(define xs (list (list 1) (list 2) (list 1)))\n(display (delete-duplicates! xs))\n(newline)"),
    ],
    caveats=[
        'The argument is destroyed. list.sld:589-595 asserts every cell of the result came from the argument.',
        'The FIRST occurrence of each element survives; later ones are unlinked. Order is order of first appearance.',
        'The default comparison is equal?. The optional comparison is called with the retained element first, as in delete!.',
        'The cost is quadratic in the number of distinct elements. For large lists this is the wrong tool regardless of allocation.',
        'The result is eq? to the argument, since the first element is always kept.',
    ],
    drawbacks=[
        'Quadratic time makes the allocation saving irrelevant at the sizes where anyone would care about allocation.',
        'equal? on deeply nested elements is itself expensive, and it is called O(n squared) times.',
        'A caller who wanted the LAST occurrence of each element has to reverse, deduplicate and reverse again, which no longer saves anything.',
    ],
    usecases=[
        'Deduplicating a short private list where clarity beats asymptotics.',
        'Canonicalising a small set of symbols built inside one function.',
        'Cleaning a freshly-parsed option list before handing it on.',
    ],
    related=['delete-duplicates', 'delete!', 'remove!', 'member', 'filter!'],
    learn=('First-occurrence semantics and quadratic cost',
           ['delete-duplicates', 'delete!', 'member', 'equal?'],
           'Deduplicate a list by hand with member and an accumulator. The comparison count you write is the cost, and it is the reason to reach for a hash table when the list grows.'),
    provenance='SRFI-1 linear-update procedures; conformance evidence scratch/r7rs-conformance/larceny/list.sld:589-595; signature derived from the delete-duplicates record in scheme/reference/39-list.slat, extended with the optional comparison SRFI-1 specifies. Drafted 2026-08-03; NOT RUN.',
    status='needs-alfred',
    r2=([('eng-program', "(display (delete-duplicates! (list 'a 'b 'a 'c)))\n(newline)"),
         ('math-program', "(define a (list 'a 'b 'a 'c))\n(define b (list 'a 'b 'a 'c))\n(display (equal? (delete-duplicates a) (delete-duplicates! b)))\n(newline)"),
         ('cs-program', "(display (list 'first-wins (delete-duplicates! (list 'a 'b 'a 'c 'a 'b 'c 'z))))\n(newline)"),
         ('problem', 'The operator wants one of each element from a list they own. Candidates: delete-duplicates (fresh list, source intact, quadratic), a hash table pass (linear, needs the table part loaded, order must be handled deliberately), or delete-duplicates! (no allocation, source destroyed, still quadratic). Note what the third option does NOT fix: the cost. If the list is large enough for allocation to matter it is large enough for the quadratic term to dominate, so the destructive choice is answering the wrong question.'),
         ('explanation', 'eng: one of each comes back, in order of first appearance, and the source variable is unusable. math: delete-duplicates! agrees with delete-duplicates on every list and comparison. cs: the result is eq? to the argument here, because the first element is always kept -- the one verb in the filter family where that is unconditional.'),
         ('meta', 'When the destructive variant does not change the asymptotics, reaching for it is a sign the cost model was never examined.')],
        ('Fix the algorithm before you fix the allocation. The allocation is rarely the term that matters.',
         'Deduplication is quadratic under an arbitrary equality and linear under hashing; the equality is what decides.',
         'This is the only verb in its family whose result is always eq? to its argument, because position one always survives.')),
    r3=([('setup', 'Keeping one of each distinct value, in order of first appearance, by unlinking the repeats.'),
         ('rungs', [
             ('list', "(display (delete-duplicates! (list 1 2 1 3)))\n(newline)"),
             ('a guest list with double bookings struck out', "(define guests (list 'ana 'bo 'ana 'cy))\n(display (delete-duplicates! guests))\n(newline)"),
             ('a bibliography with repeated citations merged', "(define cites (list 'r1 'r2 'r1 'r3))\n(display (delete-duplicates! cites))\n(newline)"),
         ]),
         ('explanation', 'In list, later matching cells are bypassed. Striking double bookings off a guest list keeps the earlier booking, which is the fair rule and also the one this verb implements. Merging repeated citations in a bibliography keeps the first appearance so the numbering stays stable. All three share first-come-first-kept as the tie-break.'),
         ('meta', 'The shape transfers wherever arrival order confers priority, which is most places a person would deduplicate by hand.')],
        ('First-come-first-kept is the rule people expect; a verb that kept the last would need to say so loudly.',
         'Deduplication is the quotient of a sequence by an equivalence, and the representative chosen is the earliest.',
         'Stable order of first appearance is what makes output diffable between runs.')),
    r4=([('eng-program', "(define r (delete-duplicates! (list 'a 'b 'a)))\n(display (list 'result r))\n(newline)"),
         ('math-program', "(define (idempotent? xs)\n  (equal? (delete-duplicates (delete-duplicates xs)) (delete-duplicates xs)))\n(display (list (idempotent? (list 1 2 1)) (idempotent? (list)) (idempotent? (list 1 2))))\n(newline)"),
         ('cs-program', "(define xs (list 'a 'b 'a 'c))\n(define cells (pair-fold cons (list) xs))\n(define r (delete-duplicates! xs))\n(display (every (lambda (c) (memq c cells)) (pair-fold cons (list) r)))\n(newline)"),
         ('claim', 'delete-duplicates! returns a list containing the first occurrence of each distinct element of lst, in order of first appearance, built from lst\'s own cells. It is equal? to (delete-duplicates lst =) and eq? to lst.'),
         ('invariant', 'forall proper lst, comparison =. equal?(delete-duplicates!(lst,=), delete-duplicates(lst,=)) and no two elements of the result satisfy = and every element of lst is =-equal to exactly one element of the result and eq?(delete-duplicates!(lst,=), lst)'),
         ('meta', 'The pattern is quotient by an equivalence with an earliest representative. What would falsify the claim: two =-equal elements surviving, an element of the input with no representative, or the LAST occurrence surviving instead of the first -- which is the failure the (a b a c a b c z) case is shaped to catch, and equal? alone cannot see it on a list of distinct-looking symbols.')],
        ('Choose test data where keeping the first and keeping the last give different answers, or the test proves nothing.',
         'Idempotence is the law worth checking, and it holds only on the pure form since the destructive one eats its input.',
         'Both directions matter: no duplicates survive, and nothing was lost. Either alone admits a wrong implementation.')),
    r5=([('eng-composition', "(define (unique! xs) (delete-duplicates! xs))\n(display (unique! (list 1 2 1)))\n(newline)"),
         ('math-composition', "(define (union xs ys) (delete-duplicates (append xs ys)))\n(display (union (list 1 2) (list 2 3)))\n(newline)"),
         ('cs-composition', "(define (count-distinct xs) (length (delete-duplicates xs)))\n(display (count-distinct (list 1 2 1 3)))\n(newline)"),
         ('base', 'delete-duplicates! keeps the first of each distinct element and unlinks the rest.'),
         ('emergent', 'eng: a uniqueness pass, named. math: appending then deduplicating is set union, and it is the composition that shows why the pure form is needed -- the append has already consumed the arguments\' identity and the deduplication needs the joined list whole. cs: counting distinct elements builds the whole deduplicated list only to measure it, which is the signal that a fold with a set would be the honest implementation.'),
         ('meta', 'The family is set semantics over lists. What emerges is that lists make a poor set: every operation is quadratic, and the destructive verbs remove an allocation that was never the problem.')],
        ('If every operation you want is a set operation, the list was the wrong structure.',
         'Union, intersection and difference over lists are all quadratic under an arbitrary equality.',
         'Building a structure only to take its length is the standard sign that a fold was wanted instead.')),
)

MAP_BANG = dict(
    name='map!', std='SRFI-1', library='higher-order', kind='state-change',
    signature='(map! f lst) -> list',
    summary='f applied to every element of lst, with the results written back into lst\'s own cells. The argument\'s contents are destroyed; its spine is not.',
    explanation=(
        'map! is the odd one in this family. Every other linear-update verb here re-points cdrs '
        'and leaves the elements alone; map! does the opposite -- it walks the spine writing a new '
        'car into every cell and changes no cdr at all. The suite makes the consequence explicit '
        'at list.sld:451-454: after (map! (lambda (x) (* x x)) l), both the returned list and l '
        'itself are (1 4 9). The spine is intact, the length is unchanged, and the returned list '
        'is eq? to the argument. ' + LESSON + ' But state the damage precisely, because it is not '
        'the usual damage: the argument variable still names a list of the right length in the '
        'right order, and every value in it has been replaced. Nothing about its shape says '
        'anything happened. Anyone else holding that list, or any cell of it, now sees mapped '
        'values where they left originals.'),
    examples=[
        ('novice',
         "(define xs (list 1 2 3))\n(display (map! (lambda (n) (* n n)) xs))\n(newline)"),
        ('intermediate',
         ";; the argument is overwritten in place: xs holds the squares now.\n"
         "(define xs (list 1 2 3))\n(define m (map! (lambda (n) (* n n)) xs))\n"
         "(display (list 'm m 'xs xs 'same-object (eq? m xs)))\n(newline)"),
        ('expert',
         ";; anyone else holding the list sees the new values, with no warning.\n"
         "(define xs (list 1 2 3))\n(define also-xs xs)\n"
         "(map! (lambda (n) (+ n 100)) xs)\n"
         "(display (list 'other-holder also-xs))\n(newline)"),
    ],
    caveats=[
        'The argument\'s CONTENTS are destroyed, not its spine. list.sld:451-454 asserts the argument itself equals the mapped result afterwards.',
        'The result is eq? to the argument, the length is unchanged, and the shape gives no sign that anything was overwritten.',
        'It writes cars, unlike every other linear-update verb in this set, which write cdrs. That is the difference to remember.',
        'SRFI-1 defines the linear-update map over a single list. For the multi-list case use map.',
        'f is applied for effect on the list as well as for its value; do not assume the order in which cells are written is unobservable.',
    ],
    drawbacks=[
        'It is the only verb here whose damage is invisible in the structure, which makes it the hardest to spot in review.',
        'Any other holder of the list, or of a cell inside it, is silently affected.',
        'It saves one allocation per element and nothing else; map is otherwise identical in cost.',
    ],
    usecases=[
        'Normalising a large freshly-built list in place inside a producer.',
        'Scaling or quantising a private buffer of numbers where the originals are not wanted again.',
        'Tight loops where the per-element allocation of map has been measured and matters.',
    ],
    related=['map', 'for-each', 'filter!', 'set-car!', 'pair-for-each'],
    learn=('Overwriting contents versus relinking structure',
           ['map', 'set-car!', 'set-cdr!', 'eq?'],
           'Compare what map! writes with what filter! writes. One touches cars and one touches cdrs, and that single difference explains every difference in their hazards.'),
    provenance='SRFI-1 linear-update procedures; conformance evidence scratch/r7rs-conformance/larceny/list.sld:451-454; signature derived from the map record in scheme/reference/33-higher-order.slat, restricted to the single-list case SRFI-1 specifies for the linear-update form. Drafted 2026-08-03; NOT RUN.',
    status='needs-alfred',
    r2=([('eng-program', "(define xs (list 1 2 3))\n(display (map! (lambda (n) (* n n)) xs))\n(newline)"),
         ('math-program', "(define a (list 1 2 3))\n(define b (list 1 2 3))\n(display (equal? (map (lambda (n) (* n n)) a) (map! (lambda (n) (* n n)) b)))\n(newline)"),
         ('cs-program', "(define xs (list 1 2 3))\n(define m (map! (lambda (n) (* n n)) xs))\n(display (list 'same-object (eq? m xs) 'argument-overwritten xs))\n(newline)"),
         ('problem', 'The operator wants to transform every element of a large list they built. Candidates: map (fresh list of the same length, source intact), for-each with an explicit set-car! (identical effect, and the mutation is visible at the call site), or map! (same effect, mutation hidden behind a familiar name). The middle option is worth real consideration: it is longer, and it is the only one of the three where a reader can see that a write happens.'),
         ('explanation', 'eng: the transformed list comes back and the source variable holds the same transformed list. math: map! agrees with map on the single-list case for every f. cs: the argument is the result, so every holder of the list has been changed.'),
         ('meta', 'When a destructive verb is spelled almost identically to a pure one and leaves no structural trace, the explicit longhand stops being verbosity and becomes documentation.')],
        ('Spelling the mutation out is worth a line when nothing else in the code shows it happened.',
         'map and map! agree as functions; they differ only in whether a new spine is allocated.',
         'Structural invisibility is what makes this the hardest linear-update verb to catch in review.')),
    r3=([('setup', 'Replacing every entry of a sequence with a computed value, in the storage it already occupies.'),
         ('rungs', [
             ('list', "(display (map! (lambda (n) (* 2 n)) (list 1 2 3)))\n(newline)"),
             ('repainting every wagon in a rake', "(define rake (list 'red 'red 'red))\n(display (map! (lambda (w) 'blue) rake))\n(newline)"),
             ('revaluing every line of a price list', "(define prices (list 100 200 300))\n(display (map! (lambda (p) (* p 2)) prices))\n(newline)"),
         ]),
         ('explanation', 'In list, each car is overwritten where it sits. Repainting a rake changes every wagon and builds no new rolling stock; the rake is the same rake and the old colours are gone. Revaluing a price list in place changes what every line says without reissuing the document. All three share an update that preserves identity and destroys history.'),
         ('meta', 'The shape transfers wherever the container is meant to persist and only its contents are meant to change.')],
        ('Identity preserved, history destroyed. That is the trade in-place update always makes.',
         'The mapping is pointwise, so the structure is untouched by definition and only the values move.',
         'This is why in-place transformation is safe for arrays and dangerous for shared lists: the danger comes from the sharing, not the writing.')),
    r4=([('eng-program', "(define xs (list 1 2 3))\n(define m (map! (lambda (n) (* n n)) xs))\n(display (list 'm m 'len (length m)))\n(newline)"),
         ('math-program', "(define (length-preserved? f xs)\n  (= (length xs) (length (map f xs))))\n(display (list (length-preserved? (lambda (n) (* n n)) (list 1 2 3)) (length-preserved? (lambda (n) n) (list))))\n(newline)"),
         ('cs-program', "(define xs (list 1 2 3))\n(define alias xs)\n(map! (lambda (n) (+ n 100)) xs)\n(display (list 'alias-sees-new-values alias))\n(newline)"),
         ('claim', 'For a proper list lst and a one-argument procedure f, map! returns a list eq? to lst whose elements are f applied to the original elements in order. The length and the spine are unchanged; every car has been replaced.'),
         ('invariant', 'forall f, proper lst. eq?(map!(f, lst), lst) and |map!(f,lst)| = |lst| and equal?(map!(f,lst), map(f, lst-as-it-was))'),
         ('meta', 'The pattern is pointwise in-place update. What would falsify the claim: a fresh list returned, a changed length, or an argument left holding its original values. The alias program is the one that matters -- it is the only one that shows the damage, because the other two are equally true of map.')],
        ('Two of these three programs pass identically on map. Only the alias one is testing map!.',
         'Pointwise transformation preserves length by construction; it is the cheapest invariant available.',
         'An eq? result plus changed contents is the exact signature of in-place update, and it is what a test must assert.')),
    r5=([('eng-composition', "(define (normalise! xs total) (map! (lambda (n) (/ n total)) xs))\n(display (normalise! (list 1 2 3) 6))\n(newline)"),
         ('math-composition', "(define (compose-maps f g xs) (map f (map g xs)))\n(display (compose-maps (lambda (n) (+ n 1)) (lambda (n) (* n 2)) (list 1 2 3)))\n(newline)"),
         ('cs-composition', "(define (map-via-for-each! f xs)\n  (pair-for-each (lambda (p) (set-car! p (f (car p)))) xs)\n  xs)\n(display (map-via-for-each! (lambda (n) (* n n)) (list 1 2 3)))\n(newline)"),
         ('base', 'map! writes f of each element back into the cell it came from.'),
         ('emergent', 'eng: in-place normalisation, the numeric case this verb was made for. math: composing two maps is one map of the composition, and the fusion is available to the pure form and not to the destructive one, since the intermediate list is the argument. cs: writing map! out of pair-for-each and set-car! is four lines and shows exactly what it does, which is the version to prefer when a reader has to be convinced.'),
         ('meta', 'The family is elementwise transformation. What emerges is that the pure form fuses and the destructive form does not, so a chain of two map! calls does twice the work a chain of two map calls needs to.')],
        ('The destructive form blocks the optimisation the pure form enables. Chained maps are the case where map wins outright.',
         'map f after map g equals map of f-composed-with-g; that rewrite needs both maps to be pure.',
         'Building the verb from set-car! and pair-for-each is the readable version, and it is not meaningfully slower.')),
)
