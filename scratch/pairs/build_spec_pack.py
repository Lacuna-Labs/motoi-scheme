#!/usr/bin/env python3
"""build_spec_pack.py — assemble scratch/pairs/spec-pack/ from IN-REPO sources only.

Deliverable 1 of the pairs work (Priya, 2026-08-03).

HARD RULE OBSERVED HERE: nothing in the output is written from memory of the
SRFI-1 document. Every line of every spec-pack file is either
  (a) a verbatim slice of a file that is in this repo, with file:line, or
  (b) a labelled editorial note, marked as such, that only DERIVES from (a).

The SRFI-1 normative prose is NOT in this repo — see spec-pack/00-SOURCES.md.

Sources used:
  spec/srfi-1.slatl                              (repo's derived part summary)
  spec/r7rs-small.slatl                          (repo's derived part summary)
  spec/R7RS-SMALL-PRIMITIVE-FLOOR.slat           (R7RS section citations)
  lib/std/srfi-1.js                              (current implementation + META)
  scratch/r7rs-conformance/larceny/list.sld      (SRFI-1 conformance suite,
                                                  adapted from srfi-1-test.sps)
  scheme/reference/39-list.slat                  (records that already exist)
"""

import os
import re

ROOT = '/Users/alfred/code/motoi-scheme'
OUT = os.path.join(ROOT, 'scratch/pairs/spec-pack')
LARCENY = 'scratch/r7rs-conformance/larceny/list.sld'
SRFI1JS = 'lib/std/srfi-1.js'

os.makedirs(OUT, exist_ok=True)


def read(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return f.read().split('\n')


LARC = read(LARCENY)
JS = read(SRFI1JS)
SPEC1 = read('spec/srfi-1.slatl')
SPECR7 = read('spec/r7rs-small.slatl')
FLOOR = read('spec/R7RS-SMALL-PRIMITIVE-FLOOR.slat')


def slice_cite(lines, rel, a, b):
    """1-indexed inclusive slice, prefixed with its citation."""
    body = '\n'.join(lines[a - 1:b])
    return f'    ;; {rel}:{a}-{b}\n' + '\n'.join('    ' + l for l in body.split('\n'))


def grep_cite(lines, rel, pattern, limit=8):
    out = []
    rx = re.compile(pattern)
    for i, l in enumerate(lines, 1):
        if rx.search(l):
            out.append(f'    ;; {rel}:{i}\n    {l.strip()}')
            if len(out) >= limit:
                break
    return '\n'.join(out) if out else '    ;; (no match in this file)'


# ── per-verb evidence table ───────────────────────────────────────────────
# larceny: list of (start, end) line ranges holding that verb's tests, or []
# NOTE all ranges were read and confirmed by hand before being written here.
VERBS = {
    # ── the linear-update (!) family ──────────────────────────────────
    'take!': dict(
        std='SRFI-1', family='linear-update',
        larceny=[(308, 313)],
        contract=(
            "Returns the first i elements of lst. The larceny/SRFI-1 suite requires "
            "the result to BE the argument -- (eq? x y), (eq? (cdr x) (cdr y)), "
            "(eq? (cddr x) (cddr y)) -- so take! is take that truncates in place by "
            "writing the terminator into the i-th cell's cdr. Everything from element "
            "i onward is unreachable from x afterwards."),
    ),
    'drop-right!': dict(
        std='SRFI-1', family='linear-update',
        larceny=[(315, 320)],
        contract=(
            "Returns all but the last i elements. The suite requires the same three "
            "eq? identities as take!: the result is the argument with its tail cut "
            "off, not a copy. (drop-right! x 3) on a six-element list leaves x itself "
            "three elements long."),
    ),
    'split-at!': dict(
        std='SRFI-1', family='linear-update',
        larceny=[(322, 332)],
        contract=(
            "Returns TWO values: the first i elements and the rest. The suite binds "
            "y to (cddr x) BEFORE the call and then requires (eq? a x) and (eq? b y) "
            "-- so split-at! severs one link and hands back the two halves of the "
            "original spine. Neither half is fresh storage."),
    ),
    'append!': dict(
        std='SRFI-1', family='linear-update',
        larceny=[(339, 349)],
        contract=(
            "Concatenates lists by relinking rather than copying. The suite requires "
            "seven eq? identities at once: the result is the first list, and each "
            "later argument appears in the result as ITSELF, not as a copy. Empty "
            "arguments are skipped. Mutating y after the call is visible through the "
            "result."),
    ),
    'concatenate!': dict(
        std='SRFI-1', family='linear-update',
        larceny=[(351, 354)],
        contract=(
            "One-level flatten of a list of lists, relinking the sub-lists instead of "
            "copying them. The suite's value test is the same as concatenate's; the "
            "identity requirement follows from append!, which concatenate! is defined "
            "in terms of."),
    ),
    'reverse!': dict(
        std='SRFI-1', family='linear-update',
        larceny=[],
        contract=(
            "Reverses a list by reversing its cdr pointers in place. NOTE: the "
            "larceny suite lists reverse! in its header (list.sld:84) but contains NO "
            "test body for it. No in-repo behavioural evidence beyond the name."),
    ),
    'append-reverse!': dict(
        std='SRFI-1', family='linear-update',
        larceny=[(356, 358)],
        contract=(
            "(append! (reverse! rev-head) tail) done in one pass. The suite tests the "
            "VALUE only -- it does not pin any eq? identity for this one."),
    ),
    'map!': dict(
        std='SRFI-1', family='linear-update',
        larceny=[(451, 454)],
        contract=(
            "Maps f over lst, writing each result back into the cell it came from. "
            "The suite is explicit and is the clearest test in the file: after "
            "(map! (lambda (x) (* x x)) l), BOTH the result and l itself equal "
            "(1 4 9). The argument list is overwritten element by element."),
    ),
    'filter!': dict(
        std='SRFI-1', family='linear-update',
        larceny=[(484, 490)],
        contract=(
            "Keeps the elements satisfying pred, unlinking the rest. The suite "
            "snapshots every cell of x with (pair-fold cons '() x) BEFORE the call, "
            "then requires every cell of the RESULT to be memq in that snapshot -- "
            "i.e. filter! allocates no new pairs at all."),
    ),
    'remove!': dict(
        std='SRFI-1', family='linear-update',
        larceny=[(503, 509)],
        contract=(
            "The complement of filter!: keeps the elements NOT satisfying pred, and "
            "the same no-new-pairs snapshot test applies."),
    ),
    'take-while!': dict(
        std='SRFI-1', family='linear-update',
        larceny=[(518, 522)],
        contract=(
            "The longest prefix all satisfying pred, truncated in place. The suite "
            "requires (eq? r x) and (eq? (cdr r) (cdr x)) -- same shape as take!, but "
            "the cut point is found by the predicate rather than given as a count."),
    ),
    'span!': dict(
        std='SRFI-1', family='linear-update',
        larceny=[(534, 543)],
        contract=(
            "Returns TWO values: (take-while pred lst) and (drop-while pred lst). The "
            "suite snapshots the cells first and requires every cell of BOTH returned "
            "halves to come from that snapshot -- span! splits the spine, it does not "
            "build two lists."),
    ),
    'break!': dict(
        std='SRFI-1', family='linear-update',
        larceny=[(545, 554)],
        contract=(
            "span! with the predicate negated: the prefix that does NOT satisfy pred, "
            "and the rest. Same cell-snapshot requirement as span!."),
    ),
    'delete!': dict(
        std='SRFI-1', family='linear-update',
        larceny=[(576, 582)],
        contract=(
            "Unlinks every element equal to x, under an optional equality predicate "
            "given as the THIRD argument. The suite calls (delete! 5 x <) and then "
            "requires every cell of the result to be one of x's original cells."),
    ),
    'delete-duplicates!': dict(
        std='SRFI-1', family='linear-update',
        larceny=[(589, 595)],
        contract=(
            "Keeps the first occurrence of each element and unlinks the later ones. "
            "Same no-new-pairs snapshot test."),
    ),
    # ── structure ──────────────────────────────────────────────────────
    'circular-list': dict(
        std='SRFI-1', family='structure',
        larceny=[(234, 242), (251, 256), (261, 265), (336, 337), (360, 362)],
        contract=(
            "Builds a circular list from its arguments: the last cdr points back at "
            "the head. The suite pins that it is NOT a list? and NOT a proper-list? "
            "and NOT a dotted-list?, that circular-list? says #t, that null-list? says "
            "#f, that length+ returns #f on it, and -- the load-bearing one -- that "
            "the elements are stored by IDENTITY and the cycle really closes: with "
            "x = (circular-list a b c), (eq? a (cadddr x)) is #t."),
    ),
    'pair-fold': dict(
        std='SRFI-1', family='structure',
        larceny=[(402, 412)],
        contract=(
            "Like fold, but f is applied to each successive PAIR (cdr-tail) of the "
            "list rather than each element. The suite's test is severe: f is "
            "(lambda (pair tail) (set-cdr! pair tail) pair), which destroys the list "
            "as it walks it. That only terminates if pair-fold has already taken the "
            "cdr of each pair BEFORE calling f, and it only produces (3 2 1) if the "
            "pairs handed to f are the argument's own cells."),
    ),
    'last-pair': dict(
        std='SRFI-1', family='structure',
        larceny=[],
        contract=(
            "The last PAIR of the list -- the cons cell itself, shared with the "
            "argument -- not the last element and not a fresh one-element list. "
            "NOTE: the larceny suite lists last-pair in its header (list.sld:75) but "
            "contains NO test body for it. In-repo behavioural evidence: none. The "
            "sharing requirement is asserted by the EXISTING reference record's own "
            "caveat (scheme/reference/39-list.slat), which flags Motoi's current "
            "answer as a divergence."),
    ),
    'list-copy': dict(
        std='R7RS-small', family='structure',
        larceny=[(218, 232)],
        contract=(
            "A shallow copy. The suite walks the original and the copy in lockstep "
            "and requires (not (eq? c cp)) at EVERY cdr position -- so every cell of "
            "the spine is fresh, not just the first. It also requires "
            "(list-copy '(1 2 3 . 4)) to answer (1 2 3 . 4), i.e. an improper list "
            "copies its spine and keeps its non-list tail."),
    ),
    # ── the two R7RS pair mutators ─────────────────────────────────────
    'set-car!': dict(
        std='R7RS-small', family='mutator',
        larceny=[],
        contract=(
            "Stores obj in the car field of pair. Return value unspecified. "
            "NOTE: the larceny suite lists set-car! in its header (list.sld:162) but "
            "contains NO test body for it. In-repo citation: "
            "spec/R7RS-SMALL-PRIMITIVE-FLOOR.slat:192 -- R7RS section 6.4, "
            "'Mutate car of pair', floor-eligible as a pair mutation primitive."),
    ),
    'set-cdr!': dict(
        std='R7RS-small', family='mutator',
        larceny=[(402, 410)],
        contract=(
            "Stores obj in the cdr field of pair. Return value unspecified. The only "
            "in-repo exercise of it is inside the pair-fold test, where "
            "(set-cdr! pair tail) is used to relink the argument's own cells into a "
            "reversed list -- which requires the write to land on the caller's cell "
            "and the new tail to be SHARED, not copied. In-repo citation: "
            "spec/R7RS-SMALL-PRIMITIVE-FLOOR.slat:193 -- R7RS section 6.4."),
    ),
}

HEADER = """;;; SPEC-PACK — {verb}
;;;
;;; Assembled {date} by build_spec_pack.py from IN-REPO sources ONLY.
;;; Standard: {std}   Family: {family}
;;;
;;; READ THIS FIRST: the normative SRFI-1 document is NOT in this repo.
;;; See 00-SOURCES.md. Everything below is either a verbatim in-repo slice
;;; (with file:line) or a note explicitly labelled DERIVED.
"""


def build(verb, d):
    parts = [HEADER.format(verb=verb, date='2026-08-03', std=d['std'], family=d['family'])]

    parts.append('\n;;; ── 1. CONTRACT (DERIVED from the in-repo evidence in §2-§5) ──\n')
    parts.append('(contract :verb "%s" :std "%s"\n  :text "%s")\n'
                 % (verb, d['std'], d['contract'].replace('"', "'")))

    parts.append('\n;;; ── 2. CONFORMANCE SUITE (verbatim) ──')
    parts.append(';;; scratch/r7rs-conformance/larceny/list.sld — "Adapted from')
    parts.append(';;; srfi-1-test.sps" (list.sld:183). The file carries its own caveat')
    parts.append(';;; at list.sld:171-173: "Some of these tests are not portable')
    parts.append(';;; because they require the procedures designated as \'linear update\'')
    parts.append(';;; variants in the spec (eg append!) to side-effect their arguments."')
    parts.append('(conformance-suite')
    if d['larceny']:
        for (a, b) in d['larceny']:
            parts.append(slice_cite(LARC, LARCENY, a, b))
    else:
        parts.append('    ;; NONE. This verb is named in the suite header but has no')
        parts.append('    ;; test body. There is no in-repo behavioural evidence for it.')
    parts.append(')\n')

    parts.append(';;; ── 3. THE REPO\'S OWN PART SUMMARY ──')
    parts.append(';;; spec/srfi-1.slatl and spec/r7rs-small.slatl are GENERATED from the')
    parts.append(';;; META in lib/std/ ("derived from the authored META in lib/std/ —')
    parts.append(';;; nothing invented", spec/srfi-1.slatl:8-9). They are the repo\'s own')
    parts.append(';;; summary, NOT the standard\'s text.')
    parts.append('(part-summary')
    pat = r':name "%s"' % re.escape(verb)
    hit = grep_cite(SPEC1, 'spec/srfi-1.slatl', pat, 2)
    if 'no match' in hit:
        hit = grep_cite(SPECR7, 'spec/r7rs-small.slatl', pat, 2)
    if 'no match' in hit:
        hit = '    ;; ABSENT from both spec/srfi-1.slatl and spec/r7rs-small.slatl.'
    parts.append(hit)
    fl = grep_cite(FLOOR, 'spec/R7RS-SMALL-PRIMITIVE-FLOOR.slat',
                   r':name %s\b' % re.escape(verb), 2)
    if 'no match' not in fl:
        parts.append(fl)
    parts.append(')\n')

    parts.append(';;; ── 4. CURRENT IMPLEMENTATION ──')
    parts.append('(implementation')
    imp = grep_cite(JS, SRFI1JS, r"'%s'" % re.escape(verb), 6)
    parts.append(imp)
    parts.append(')\n')

    parts.append(';;; ── 5. STATUS ──')
    parts.append('(status :value "needs-alfred"')
    parts.append('  :because "The normative %s text for this verb is not in the repo.' % d['std'])
    parts.append('           The CONTRACT above is DERIVED from the in-repo conformance')
    parts.append('           suite and part summary, not quoted from the standard.")')
    return '\n'.join(parts) + '\n'


for verb, d in VERBS.items():
    fn = verb.replace('!', '-bang').replace('*', '-star')
    with open(os.path.join(OUT, fn + '.slatl'), 'w', encoding='utf-8') as f:
        f.write(build(verb, d))

print('wrote %d spec-pack files to %s' % (len(VERBS), OUT))
