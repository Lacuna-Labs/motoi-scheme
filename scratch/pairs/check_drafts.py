#!/usr/bin/env python3
"""check_drafts.py — editor's gate over scratch/pairs/drafts/.

Priya, 2026-08-03. Run after every drafting pass and after every hand edit.

Checks, in order of how much they would cost if they slipped:

  1. PENDING-ENGINE      every :note is the literal placeholder, nothing else.
                         This is the rule that must not break: a printed value
                         in a draft is a value nobody ran.
  2. NO PRINTED VALUES   no `=> <something>` and no "prints (…)" anywhere in
                         the record, including inside :caveats and the rows.
  3. BALANCED            the record parses as one balanced s-expression.
  4. FIELD ORDER         the house order, no missing required field.
  5. KNOWN VERBS         every name in :related resolves: documented in
                         scheme/reference/, one of the 21 being drafted, or
                         bound in the engine (_bound-names.txt).
  6. NOT A RESTATEMENT   :explanation is not a paraphrase of :summary, and for
                         a `!` verb it actually says the destroyed-binding
                         lesson.
  7. NO PROMPT LEAK      the record does not quote the drafting instructions.

Exit status is the number of drafts with at least one FAIL.
"""

import os
import re
import sys

ROOT = '/Users/alfred/code/motoi-scheme'
DRAFTS = os.path.join(ROOT, 'scratch/pairs/drafts')
NAMES = os.path.join(ROOT, 'scratch/pairs/_all-verb-names.txt')
BOUND = os.path.join(ROOT, 'scratch/pairs/_bound-names.txt')

ORDER = [':name', ':std', ':library', ':tier', ':kind', ':signature',
         ':summary', ':explanation', ':examples', ':caveats', ':drawbacks',
         ':usecases', ':related', ':learn', ':provenance',
         ':row-2-audit', ':row-3-dimension', ':row-4-proof', ':row-5-emergence']

DRAFTED = {
    'take!', 'drop-right!', 'split-at!', 'append!', 'map!', 'filter!', 'remove!',
    'take-while!', 'span!', 'break!', 'delete!', 'delete-duplicates!', 'reverse!',
    'append-reverse!', 'concatenate!', 'circular-list', 'pair-fold', 'last-pair',
    'list-copy', 'set-car!', 'set-cdr!',
}

LEAK = [
    'HARD RULES', 'FIELD ORDER', 'FIELD JOBS', 'exemplar', 'EXEMPLAR',
    'spec pack', 'SPEC PACK', 'Say this plainly', 'in your own words',
    'IN YOUR OWN WORDS', 'PENDING-ENGINE is', 'the record must',
    'You are drafting', 'THE LESSON', 'three-discipline lens',
]

PRINTED = [
    (re.compile(r'=>\s*\S'), 'contains `=> value` (a printed value)'),
    (re.compile(r'\bPrints?\b\s*[("\'#]'), 'says what something prints'),
    (re.compile(r':note\s+"(?!PENDING-ENGINE")'), ':note is not the placeholder'),
]


def _read(path):
    try:
        with open(path, encoding='utf-8') as f:
            return {l.strip() for l in f if l.strip()}
    except IOError:
        return set()


def known_names():
    """A :related target is resolvable if it is documented in the reference,
    is one of the 21 being drafted, or is actually bound in the engine.

    The third source is not redundant. circular-list?, dotted-list?,
    pair-fold-right and pair-for-each are bound in lib/std/srfi-1.js and
    appear in NO reference chapter -- the same implemented-but-undocumented
    state that hid the 15 broken linear-update verbs. They are legitimate
    :related targets; the reference is what is incomplete, not the link.
    Names in neither list (e.g. `flatten`) are invented and still FAIL.
    """
    return _read(NAMES) | DRAFTED | _read(BOUND)


def balanced(text):
    depth, in_str, esc = 0, False, False
    for c in text:
        if in_str:
            if esc:
                esc = False
            elif c == '\\':
                esc = True
            elif c == '"':
                in_str = False
        else:
            if c == '"':
                in_str = True
            elif c == '(':
                depth += 1
            elif c == ')':
                depth -= 1
                if depth < 0:
                    return False
    return depth == 0 and not in_str


def field(rec, key):
    m = re.search(re.escape(key) + r'\s+"((?:[^"\\]|\\.)*)"', rec)
    return m.group(1) if m else None


def check(path, known):
    raw = open(path, encoding='utf-8').read()
    rec = raw[raw.find('(verb'):]
    name = field(rec, ':name') or '<unnamed>'
    fails, warns = [], []

    for rx, why in PRINTED:
        for m in rx.finditer(rec):
            fails.append('%s -- %r' % (why, rec[max(0, m.start() - 40):m.end() + 40]))

    if not balanced(rec):
        fails.append('UNBALANCED s-expression')

    seen = [k for k in ORDER if re.search(re.escape(k) + r'[\s(]', rec)]
    missing = [k for k in ORDER if k not in seen]
    if missing:
        fails.append('missing fields: ' + ' '.join(missing))
    pos = [rec.find(k) for k in seen]
    if pos != sorted(pos):
        warns.append('fields out of house order')

    rel = re.search(r':related\s*\(([^)]*)\)', rec)
    if rel:
        for n in re.findall(r'"([^"]+)"', rel.group(1)):
            if n not in known:
                fails.append(':related names an unknown verb: %r' % n)

    summ, expl = field(rec, ':summary') or '', field(rec, ':explanation') or ''
    if len(expl) < 400:
        warns.append(':explanation is thin (%d chars)' % len(expl))
    if summ and summ[:60].lower() in expl.lower():
        warns.append(':explanation restates :summary verbatim')
    if name.endswith('!') and not re.search(
            r'destroy|reuse|reused|relink|overwrit|in place|no longer',
            expl, re.I):
        fails.append(':explanation never states the destroyed-binding lesson')

    for phrase in LEAK:
        if phrase in rec:
            fails.append('PROMPT LEAK: %r' % phrase)

    ex = len(re.findall(r':dialect\s+"motoi"', rec))
    if ex < 3:
        warns.append('only %d examples (want 3-5)' % ex)

    return name, fails, warns


def main():
    known = known_names()
    bad = 0
    files = sorted(f for f in os.listdir(DRAFTS) if f.endswith('.slat'))
    if not files:
        print('no drafts in %s' % DRAFTS)
        return 0
    for f in files:
        name, fails, warns = check(os.path.join(DRAFTS, f), known)
        status = 'FAIL' if fails else ('warn' if warns else 'ok  ')
        print('%s  %-22s %s' % (status, name, f))
        for x in fails:
            print('        FAIL  ' + x[:200])
        for x in warns:
            print('        warn  ' + x[:200])
        if fails:
            bad += 1
    print('\n%d drafts, %d with failures' % (len(files), bad))
    return bad


if __name__ == '__main__':
    sys.exit(main())
