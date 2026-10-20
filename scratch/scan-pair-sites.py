#!/usr/bin/env python3
"""scan-pair-sites.py — every corpus site the cons-cell change can invalidate.

Deterministic. No model, no judgement, no network. It answers one question per
site: does this text depend on the fact that Motoi spells a proper list as a
flat JavaScript array?

Two kinds of dependence, and they need different repairs:

  CODE  — a runnable snippet whose PRINTED VALUE may move. Cannot be repaired
          until the engine lands; the repair is then mechanical (run it, take
          stdout). These are what `verify-reference-notes.py` will re-gate.

  PROSE — a sentence that ASSERTS the array design. No harness will ever catch
          these, which is why they are scanned by phrase here. Repairing them
          needs authoring, and that is what the local model drafts.

Surfaces covered (all of them — the point of this file is that nothing is
scanned "later"):
    scheme/reference/           .slat verb records, incl. broken-examples,
                                error-cards, and the .slatl spec companions
    scheme-books/               .slatl + .slat chapters; code lives in fenced
                                ```scheme blocks inside :prose, NOT in :code
    graphs/                     .slat relation manifolds
    spec/  engineering/  site/  .slat + .md
    carts/                      .sks — whole file is code (SCANNED, NOT EDITED;
                                carts are out of scope until Alfred says so)

Usage:
    python3 scratch/scan-pair-sites.py                 # summary + write TSV
    python3 scratch/scan-pair-sites.py --tsv PATH
"""

import os, re, sys, json, argparse

ROOT = '/Users/alfred/code/motoi-scheme'

SURFACES = [
    ('reference',       'scheme/reference',   ('.slat', '.slatl')),
    ('scheme-books',    'scheme-books',       ('.slat', '.slatl')),
    ('graphs',          'graphs',             ('.slat',)),
    ('spec',            'spec',               ('.slat', '.slatl')),
    ('engineering',     'engineering',        ('.slat', '.md')),
    ('site',            'site',               ('.md',)),
    ('carts',           'carts',              ('.sks', '.slat')),
]

# ── the 20 verbs whose MEANING changes when cells become real ────────────
# Split by why, because the repair differs. The destructive SRFI-1 set is the
# dangerous group: they are bound today and silently return a fresh list
# instead of mutating, which is why all 23 larceny list.sld failures are here.
DESTRUCTIVE = [
    'take!', 'drop-right!', 'split-at!', 'append!', 'map!', 'filter!',
    'remove!', 'take-while!', 'span!', 'break!', 'delete!', 'delete-duplicates!',
    'reverse!', 'append-reverse!', 'concatenate!',
]
MUTATORS = ['set-car!', 'set-cdr!']
STRUCTURE = ['circular-list', 'circular-list?', 'pair-fold', 'pair-fold-right',
             'pair-for-each', 'last-pair', 'list-copy', 'list?', 'proper-list?',
             'dotted-list?', 'not-pair?']
SHARING = ['write-shared', 'write-simple', 'datum-label']

AFFECTED_VERBS = DESTRUCTIVE + MUTATORS + STRUCTURE + SHARING

# A verb mention, not a substring. `list?` must not match `list-copy?`, and
# `map!` must not match inside `map!!`. Scheme identifiers are delimited by
# whitespace, parens, or quote marks.
def verb_re(names):
    alts = '|'.join(re.escape(n) for n in sorted(names, key=len, reverse=True))
    return re.compile(r'(?<![A-Za-z0-9!?*/<>=+-])(' + alts + r')(?![A-Za-z0-9!?*/<>=+-])')

VERB_RE = verb_re(AFFECTED_VERBS)

# ── prose that ASSERTS the array design ─────────────────────────────────
# Each entry is (label, regex). These are the claims that become FALSE when
# cells land. A harness cannot check them, so they are enumerated by hand and
# matched literally — a miss here is a wrong sentence shipped into training.
PROSE_CLAIMS = [
    ('array-spelling',   r'flat (JavaScript |JS )?array|spells? a (proper )?list as|as a flat array'),
    ('no-cell',          r'no cell to hold|has no cells?\b|there is no cell'),
    ('cdr-allocates',    r'\bcdr\b[^.]{0,60}allocat|allocat[^.]{0,60}\bcdr\b'),
    ('no-shared-tail',   r'shared tail|share a tail|interior pointer'),
    ('eq-on-tail',       r'\(eq\?[^)]{0,40}\(cdr|eq\? on (a |the )?(sub)?list|not eq\? to itself'),
    ('empty-list-eq',    r"\(eq\?\s+'\(\)\s+'\(\)\)|\(eq\? \(list\) \(list\)\)"),
    ('no-circular',      r'circular list[^.]{0,80}(cannot|can not|impossible|not supported)|cannot (be )?(build|construct|make)[^.]{0,40}circular'),
    ('setcdr-limited',   r'set-cdr![^.]{0,120}(cons|only|cannot|no cell|proper list)'),
    ('mutation-fresh',   r'returns a fresh (list|copy) instead of mutating|does not actually mutate|non-destructive despite'),
]
PROSE_RES = [(lbl, re.compile(rx, re.I)) for lbl, rx in PROSE_CLAIMS]

# ── extraction ──────────────────────────────────────────────────────────
# A slat code-bearing field. The reference uses many names for the same thing;
# they are all "a runnable snippet" for our purposes.
CODE_FIELD_RE = re.compile(
    r':(code|example|program|composition|snippet|broken|fix|base|'
    r'eng-program|math-program|cs-program|eng-composition|math-composition|'
    r'cs-composition|solution|before|after)\s+"((?:[^"\\]|\\.)*)"')

# Books put runnable code in fenced blocks inside a :prose string.
FENCE_RE = re.compile(r'```(?:scheme|motoi|lisp)?\n(.*?)```', re.S)


def unescape(s):
    return (s.replace('\\n', '\n').replace('\\t', '\t')
             .replace('\\"', '"').replace('\\\\', '\\'))


def line_of(text, pos):
    return text.count('\n', 0, pos) + 1


def scan_file(path, rel):
    """Yield (kind, line, verb_or_claim, excerpt) for one file."""
    try:
        text = open(path, encoding='utf-8', errors='replace').read()
    except OSError:
        return

    is_cart = path.endswith('.sks')

    # ---- CODE sites ----
    if is_cart:
        spans = [(0, text)]
    else:
        spans = [(m.start(2), unescape(m.group(2))) for m in CODE_FIELD_RE.finditer(text)]
        spans += [(m.start(1), m.group(1)) for m in FENCE_RE.finditer(text)]

    for pos, code in spans:
        hits = sorted(set(VERB_RE.findall(code)))
        if hits:
            yield ('CODE', line_of(text, pos), ','.join(hits),
                   re.sub(r'\s+', ' ', code)[:140])

    # ---- PROSE claims ----
    # Scanned over the WHOLE file, because a false claim is just as damaging in
    # a :caveat, an :explanation, a comment, or a chapter body.
    for lbl, rx in PROSE_RES:
        for m in rx.finditer(text):
            a = max(0, m.start() - 60)
            yield ('PROSE', line_of(text, m.start()), lbl,
                   re.sub(r'\s+', ' ', text[a:m.end() + 80]))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--tsv', default='/tmp/pair-sites.tsv')
    args = ap.parse_args()

    rows = []
    per_surface = {}
    for name, subdir, exts in SURFACES:
        base = os.path.join(ROOT, subdir)
        if not os.path.isdir(base):
            per_surface[name] = {'files': 0, 'CODE': 0, 'PROSE': 0, 'absent': True}
            continue
        nf = c = p = 0
        for dirpath, dirnames, filenames in os.walk(base):
            dirnames[:] = [d for d in dirnames if d not in ('_archive', 'node_modules')]
            for fn in sorted(filenames):
                if not fn.endswith(exts):
                    continue
                nf += 1
                full = os.path.join(dirpath, fn)
                rel = os.path.relpath(full, ROOT)
                for kind, line, what, excerpt in scan_file(full, rel):
                    rows.append((name, rel, line, kind, what, excerpt))
                    if kind == 'CODE': c += 1
                    else: p += 1
        per_surface[name] = {'files': nf, 'CODE': c, 'PROSE': p}

    with open(args.tsv, 'w') as f:
        f.write('surface\tfile\tline\tkind\twhat\texcerpt\n')
        for r in rows:
            f.write('\t'.join(str(x).replace('\t', ' ') for x in r) + '\n')

    print(f'{"surface":<16}{"files":>7}{"CODE":>8}{"PROSE":>8}')
    print('-' * 39)
    tc = tp = tf = 0
    for name, _, _ in SURFACES:
        d = per_surface[name]
        if d.get('absent'):
            print(f'{name:<16}{"— absent":>23}')
            continue
        print(f'{name:<16}{d["files"]:>7}{d["CODE"]:>8}{d["PROSE"]:>8}')
        tf += d['files']; tc += d['CODE']; tp += d['PROSE']
    print('-' * 39)
    print(f'{"TOTAL":<16}{tf:>7}{tc:>8}{tp:>8}')

    # Which verbs actually appear, so the authoring list is measured not guessed.
    from collections import Counter
    vc = Counter()
    for r in rows:
        if r[3] == 'CODE':
            for v in r[4].split(','):
                vc[v] += 1
    print('\nverb mentions in runnable code:')
    for v, n in vc.most_common():
        print(f'  {v:<22}{n}')
    pc = Counter(r[4] for r in rows if r[3] == 'PROSE')
    print('\nprose claims asserting the array design:')
    for v, n in pc.most_common():
        print(f'  {v:<22}{n}')
    print(f'\nfull table -> {args.tsv}')


if __name__ == '__main__':
    main()
