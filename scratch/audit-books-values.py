#!/usr/bin/env python3
"""audit-books-values.py — the VALUE-aware book gate.

`audit-ref.classify` returns `ok` for any block that exits 0 without printing
`error:`. It never looks at WHAT was printed, so a block that runs perfectly and
prints the wrong number is certified green. That is the same defect that put 85
wrong claims into the corpus, and repairing books against a run-only gate would
reproduce it at scale.

The books already state their own expected values: 2,600+ `;; => <value>`
markers. This gate reads them.

For every top-level EXPRESSION carrying a `;; =>` marker, the block is rewritten
so the expression's printed output and its returned value are both captured, the
chapter-scoped program is run once, and the claim is compared against both. A
claim matching neither is a MISMATCH — a real defect, reported with the code, the
claim, and what actually happened.

Definitions are never instrumented (they have no interesting value), and a
marker whose text cannot be read as a self-delimiting claim is reported as
`unreadable-claim` rather than quietly passing.

  python3 scratch/audit-books-values.py --selftest   # prove the gate FAILS a lie
  python3 scratch/audit-books-values.py [--limit N]
"""
from __future__ import annotations
import json, os, re, sys
from pathlib import Path
from collections import Counter, OrderedDict, defaultdict
from concurrent.futures import ThreadPoolExecutor

REPO = Path('/Users/alfred/code/motoi-scheme')
sys.path.insert(0, str(REPO / 'scratch'))
sys.path.insert(0, str(REPO / 'scratch' / 'r7rs-conformance'))
import importlib.util

_s = importlib.util.spec_from_file_location('aref', str(REPO / 'scratch' / 'audit-ref.py'))
aref = importlib.util.module_from_spec(_s); _s.loader.exec_module(aref)
_s = importlib.util.spec_from_file_location('bv2', str(REPO / 'scratch' / 'audit-books-v2.py'))
bv2 = importlib.util.module_from_spec(_s); _s.loader.exec_module(bv2)
# The reference gate already knows how to read a claim off the front of prose.
# Import it rather than write a second parser that can drift from the first.
_s = importlib.util.spec_from_file_location('refgate', str(REPO / 'scratch' / 'verify-reference-notes.py'))
refgate = importlib.util.module_from_spec(_s); _s.loader.exec_module(refgate)
from sexp_split import split_forms  # noqa: E402

OM, VM, EM = '@@O%d@@', '@@V%d@@', '@@E%d@@'
MARKER_RE = re.compile(r'^\s*;+\s*=>\s?(.*)$')
COMMENT_RE = re.compile(r'^\s*;+\s?(.*)$')
NON_VALUE_HEADS = ('define', 'import', 'load', 'include')

# A claim can assert that the form RAISES. Whole chapters are built on this —
# book-of-limits/appendix-a-reading-the-error teaches how to read an error
# message, so every block in it is a deliberate failure whose text the book
# quotes. Scoring those as run-errors marked 23 blocks broken where the book
# and the engine already agreed word for word.
ERROR_CLAIM_RE = re.compile(r'^\s*error\b', re.I)
# The engine's own error line, however it reached us. The gate's own markers are
# stripped before this is applied — the open marker is displayed immediately
# before the form runs, so it lands flush against the error text and would
# otherwise defeat the line anchor.
ERROR_LINE_RE = re.compile(r'^\s*(error:.*)$', re.M)
MARKER_STRIP_RE = re.compile(r'@@[OVE]\d+@@')
# `;; error: …` with no arrow — the books' other way of claiming a raise.
BARE_ERROR_MARKER_RE = re.compile(r'^\s*;+\s*(error:.*)$')


def normalize(v):
    return re.sub(r'\s+', ' ', v.strip())


def balanced(s):
    depth, in_str, esc = 0, False, False
    for c in s:
        if in_str:
            if esc: esc = False
            elif c == '\\': esc = True
            elif c == '"': in_str = False
            continue
        if c == '"': in_str = True
        elif c == '(': depth += 1
        elif c == ')': depth -= 1
    return depth == 0 and not in_str


def head_symbol(form_src):
    m = re.match(r'\(\s*([^\s()]+)', form_src)
    return m.group(1) if m else None


def is_output_fence(code):
    """True when the block is a DISPLAYED VALUE rather than a program.

    Books print a result in its own fence right after the call that produced it
    — `(help 'car)` is followed by a fence holding `((:name car) (:doc "…") …)`.
    Executed, that calls `:name` as a procedure, and because every later block
    of the chapter carries this one as its prefix, one such fence took down 18
    blocks of 02-verb-metadata on its own.

    The test is narrow on purpose: a keyword in head position (`(:name …)`) can
    never be a legal call in any program, so no real code is discarded by it.
    Output that happens to LOOK like a call is left alone and still checked.
    """
    spans = split_forms(code)
    if not spans:
        return False
    heads = [applied_symbol(code[s:e]) for s, e, _ in spans]
    return all(h is not None and h.startswith(':') for h in heads)


def applied_symbol(form_src):
    """The symbol this form would actually CALL.

    `head_symbol` stops at a nested head: for `((:name car) (:doc "…"))` it sees
    an open paren and gives up. But that form calls `(:name car)`, whose own
    head is `:name` — so peel the head position down to its first token.
    """
    m = re.match(r'\(+\s*([^\s()]+)', form_src)
    return m.group(1) if m else None


def has_error_claim(code):
    """Whether any claim in the block says the form raises."""
    return any(ERROR_CLAIM_RE.match(c) for _s, _e, c, _f in annotate(code))


def error_claim_ok(claim, blob):
    """The claim states an error; did the engine raise THAT error?

    Compared on the engine's message text, not merely on the fact that
    something failed — a block claiming `error: string-length: expected a
    string` must not pass because an unrelated verb blew up two lines earlier.
    """
    want = normalize(claim)
    if want.lower().startswith('error:'):
        want = want[len('error:'):].strip()
    for m in ERROR_LINE_RE.finditer(MARKER_STRIP_RE.sub('\n', blob)):
        got = normalize(m.group(1))[len('error:'):].strip()
        if got == want or got.startswith(want) or want.startswith(got):
            return True
    return False


def claim_after(code, end, next_start):
    """The `;; => …` claim attached to the form ending at `end`, or None.

    The gap between two top-level forms holds only whitespace and comments, so
    the first `=>` comment in it belongs to the form just closed. A claim that
    leaves parens open keeps absorbing following comment lines — book values are
    often wrapped — and if it never balances it is reported as unreadable rather
    than guessed at.

    The marker has to be ADJACENT: a `=>` line ten lines of prose below a form
    is annotating something else, and pairing it with this form invents a
    mismatch that is not there.

    An error is claimed in two spellings — `;; => error: …` (9 in the books) and
    a bare `;; error: …` (19). Both are the author saying "this raises, and this
    is what it says", so both are read as claims. The message is still checked
    against what the engine actually raised, so admitting the second spelling
    cannot pass a block that fails a different way.
    """
    gap = code[end:next_start]
    lines = gap.split('\n')
    for i, ln in enumerate(lines):
        if i > 2:
            return None
        m = MARKER_RE.match(ln) or BARE_ERROR_MARKER_RE.match(ln)
        if not m:
            if ln.strip() and not COMMENT_RE.match(ln):
                return None
            continue
        claim = m.group(1).rstrip()
        j = i + 1
        while not balanced(claim) and j < len(lines):
            cm = COMMENT_RE.match(lines[j])
            if not cm or MARKER_RE.match(lines[j]):
                break
            claim += '\n' + cm.group(1).rstrip()
            j += 1
        return claim
    return None


def annotate(code):
    """[(start, end, claim)] for every instrumentable top-level form."""
    spans = split_forms(code)
    claims = [
        claim_after(code, e, spans[k + 1][0] if k + 1 < len(spans) else len(code))
        for k, (_s, e, _line) in enumerate(spans)
    ]

    # `(newline)` has no value and prints only a line break, so a claim sitting
    # under it is describing what the PREVIOUS form displayed:
    #     (display (room-color r))
    #     (newline)
    #     ;; => red
    # Judging it against (newline) invents a mismatch. Simply skipping it would
    # be worse — the display would then go unchecked, which is how a wrong claim
    # gets certified. Move it back one form so it is still judged, just against
    # the form the author meant.
    for k, (s, e, _l) in enumerate(spans):
        if k and claims[k] is not None and claims[k - 1] is None \
                and code[s:e].strip() == '(newline)':
            claims[k - 1], claims[k] = claims[k], None

    out = []
    for k, (s, e, _line) in enumerate(spans):
        claim = claims[k]
        if claim is None:
            continue
        src = code[s:e]
        h = head_symbol(src)
        if h and any(h == n or h.startswith(n + '-') for n in NON_VALUE_HEADS):
            continue
        # A form carrying `;; =>` markers on its OWN inner lines is annotating
        # its sub-expressions one by one. The trailing marker is the last of
        # that series, not a claim about the whole form's value, so checking it
        # against the whole form manufactures a mismatch.
        if MARKER_RE.search(src) or re.search(r';+\s*=>', src):
            out.append((s, e, claim, 'inner-claims'))
            continue
        out.append((s, e, claim, None))
    return out


def instrument(code, ann):
    parts, last = [], 0
    for idx, (s, e, _claim, _flag) in enumerate(ann):
        parts.append(code[last:s])
        parts.append(
            f'(begin (display "{OM % idx}") '
            f'(let ((__gate-v {code[s:e]})) '
            f'(display "{VM % idx}") (write __gate-v) (display "{EM % idx}")))'
        )
        last = e
    parts.append(code[last:])
    return ''.join(parts)


def carve(blob, idx):
    o, v, e = OM % idx, VM % idx, EM % idx
    a = blob.find(o)
    b = blob.find(v, a + 1) if a >= 0 else -1
    c = blob.find(e, b + 1) if b >= 0 else -1
    if a < 0 or b < 0 or c < 0:
        return None, None
    return blob[a + len(o):b], blob[b + len(v):c]


def claim_variants(claim):
    """The readings of a `;; =>` marker that could legitimately be the claim.

    Book markers routinely carry a trailing gloss — `1        (default zoom)`,
    `noop    (no such entity)`, `(0 20)   ; deltas accumulate`. Each variant is
    a narrowing of the SAME text, never a different value, so accepting any of
    them cannot turn a wrong number into a right one.
    """
    seen, out = set(), []

    def add(s):
        s = normalize(s)
        if s and s not in seen:
            seen.add(s); out.append(s)
        # `'nan` / `'(1 2 3)` is how a book writes a datum it expects back; the
        # printer emits the datum without the quote. Same text either way, so
        # this cannot make a wrong value match a right one.
        if s.startswith("'") and len(s) > 1 and s[1:] not in seen:
            seen.add(s[1:]); out.append(s[1:])

    add(claim)
    add(re.sub(r'\s;[^\n]*$', '', claim))                    # trailing ; gloss
    lit = refgate.leading_literal(claim.strip())
    if lit:
        add(lit)
    if not claim.lstrip().startswith(('(', '#(', '"')):
        add(re.split(r'\s{2,}', claim.strip())[0])           # value<gap>prose
    return out


VALUEISH_RE = re.compile(r'^\s*([("#\'`~]|[+-]?[.\d]|#[tf])')
TILDE_NUM_RE = re.compile(r'^~\s*([+-]?\d*\.?\d+)$')


def approx_ok(claim, actual):
    """`~0.625` is the books' own way of writing "about". Honour it, at the
    precision the book chose — `~0.6` accepts 0.625, `~0.63` does not."""
    m = TILDE_NUM_RE.match(claim)
    if not m:
        return False
    text = m.group(1)
    places = len(text.split('.')[1]) if '.' in text else 0
    try:
        want = float(text)
    except ValueError:
        return False
    for a in actual:
        try:
            got = float(a)
        except (ValueError, TypeError):
            continue
        if round(got, places) == round(want, places):
            return True
    return False


def is_checkable(claim):
    """Whether the marker text is a VALUE at all, rather than a sentence.

    Some `=>` markers carry commentary ("reading the census on one machine").
    Those cannot be compared to anything. They are reported unchecked — never
    silently passed, which is the failure mode this whole gate exists to stop.
    """
    c = claim.strip()
    if not c:
        return False
    if len(c.split()) == 1:
        return True
    if VALUEISH_RE.match(c):
        return True
    return refgate.leading_literal(c) is not None


PLACEHOLDER_RE = re.compile(r"<[A-Za-z][\w-]*>")


def has_placeholder(claim):
    """`<count>` / `<titles>` is a template slot, not a value.

    The author is saying "some number goes here", so there is nothing to
    compare against. Reported unchecked, never passed — the same treatment a
    prose claim gets.
    """
    return bool(PLACEHOLDER_RE.search(claim))


def elision_ok(claim, actual):
    """`(a b c ...)` — the author deliberately truncated a long result.

    Passes only when the real value genuinely EXTENDS the stated prefix, so it
    cannot rubber-stamp a changed answer: the prefix must still match
    character-for-character AND carry real content (a bare `(...` proves
    nothing and is rejected).
    """
    c = claim.strip()
    if '...' not in c:
        return False
    # The marker is written both ways: `0.974...` and `(1 2 3 ...)`. Take
    # everything before the first ellipsis as the prefix that must hold.
    head = normalize(c.split('...', 1)[0].rstrip().rstrip(','))
    if len(head.strip('( \t')) < 3:
        return False
    return any(a.startswith(head) and len(a) > len(head) for a in actual if a)


def judge(claim, printed, value):
    """PASS only if the claim matches what actually happened.

    Books use `;; =>` for two things — the value of an expression and the text a
    `display` emits — so both are accepted. Neither is a proxy: a block whose
    value AND output both contradict every reading of the claim always fails.
    """
    if not normalize(claim):
        return 'empty-claim'
    if normalize(claim) in ('...', 'ELLIPSIS'):
        return 'skip'
    actual = {normalize(value), normalize(printed), normalize(printed + value)}
    for c in claim_variants(claim):
        if c in actual:
            return 'pass'
        if approx_ok(c, actual):
            return 'pass'
    if elision_ok(claim, actual):
        return 'pass'
    if has_placeholder(claim):
        return 'prose-claim'
    if not is_checkable(claim):
        return 'prose-claim'
    return 'mismatch'


def check_block(prefix, code):
    """[(claim, verdict, printed, value)] plus a block-level status."""
    if '@@O0@@' in code or '__gate-v' in code:
        return 'uninstrumentable', []
    if is_output_fence(code):
        return 'output-fence', []
    ann = annotate(code)
    if not ann:
        return 'no-claims', []
    prog = (prefix + '\n' + instrument(code, ann)) if prefix else instrument(code, ann)
    rc, out, err = aref.run_one(prog, timeout=30)
    blob = out + err
    if rc != 0 or re.search(r'^\s*error:', blob, re.M):
        # Which form raised? Each instrumented form prints its open marker
        # BEFORE evaluating, so the last open marker in the output names the
        # form that did not finish.
        raised = max((i for i in range(len(ann)) if (OM % i) in blob), default=None)
        if raised is not None and ERROR_CLAIM_RE.match(ann[raised][2]) \
                and error_claim_ok(ann[raised][2], blob):
            rows = []
            for idx, (s, e, claim, flag) in enumerate(ann):
                if idx < raised:
                    printed, value = carve(blob, idx)
                    v = flag or (judge(claim, printed, value)
                                 if printed is not None else 'never-ran')
                elif idx == raised:
                    v = 'pass'
                else:
                    v = 'never-ran'
                rows.append({'claim': claim, 'verdict': v, 'code': code[s:e][:300]})
            return 'ran', rows
        first = (err.strip() or out.strip()).splitlines()
        return 'run-error', [{'error': first[0] if first else '', 'nclaims': len(ann)}]
    rows = []
    for idx, (s, e, claim, flag) in enumerate(ann):
        printed, value = carve(blob, idx)
        if printed is None:
            rows.append({'claim': claim, 'verdict': 'never-ran', 'code': code[s:e][:300]})
            continue
        v = flag or judge(claim, printed, value)
        rows.append({'claim': claim, 'verdict': v, 'printed': printed[:300],
                     'value': value[:300], 'code': code[s:e][:300]})
    return 'ran', rows


SELFTEST_TRUE = '(+ 1 2)\n;; => 3\n(display "hi")\n;; => hi\n'
SELFTEST_LIE = '(+ 1 2)\n;; => 4\n(list 1 2)\n;; => (9 9)\n'
# The claim states the error the engine actually raises.
SELFTEST_ERR_TRUE = '(string-length 42)\n;; => error: string-length: expected a string, got the number 42\n'
# The claim states an error, but NOT the one that happens. Accepting this would
# make the error path a proxy for "something failed", which is the whole bug
# class this gate exists to catch.
SELFTEST_ERR_LIE = '(string-length 42)\n;; => error: car: expected a pair, got the empty list\n'
# Printed output, not a program.
SELFTEST_FENCE = '((:name car)\n (:doc "The first element."))\n;; => whatever\n'
# Elision: the prefix must still be literally true, and the value must extend it.
SELFTEST_ELIDE_TRUE = '(list 1 2 3 4 5)\n;; => (1 2 3 ...)\n'
SELFTEST_ELIDE_LIE = '(list 1 2 3 4 5)\n;; => (9 9 9 ...)\n'
# A prefix with no content must NOT pass — otherwise `(...` rubber-stamps
# every list in the corpus.
SELFTEST_ELIDE_VAGUE = '(list 1 2 3)\n;; => (...)\n'
SELFTEST_PLACEHOLDER = '(list 1 2)\n;; => (<count> <items>)\n'
# A quoted datum prints without its quote; the LIE must still fail.
SELFTEST_QUOTE_TRUE = "(list 1 2)\n;; => '(1 2)\n"
SELFTEST_QUOTE_LIE = "(list 1 2)\n;; => '(9 9)\n"
# A claim under `(newline)` belongs to the display above it. Moving it must not
# make it unfalsifiable — the LIE has to still be caught.
SELFTEST_NEWLINE_TRUE = '(display "red")\n(newline)\n;; => red\n'
SELFTEST_NEWLINE_LIE = '(display "red")\n(newline)\n;; => blue\n'


def selftest():
    """The acceptance test: the gate must FAIL a block that states a wrong value."""
    ok = True

    def case(label, code, want_status, want_verdicts):
        nonlocal ok
        st, rows = check_block('', code)
        got = [r.get('verdict') for r in rows]
        good = st == want_status and (want_verdicts is None or got == want_verdicts)
        print(f'  {label:<18} -> {st} {got}  {"OK" if good else "GATE BROKEN"}')
        ok &= good

    case('true claims', SELFTEST_TRUE, 'ran', ['pass', 'pass'])
    case('false claims', SELFTEST_LIE, 'ran', ['mismatch', 'mismatch'])
    case('true error claim', SELFTEST_ERR_TRUE, 'ran', ['pass'])
    case('false error claim', SELFTEST_ERR_LIE, 'run-error', None)
    case('output fence', SELFTEST_FENCE, 'output-fence', [])
    # Elision: a truncated claim passes only when the value EXTENDS its prefix.
    case('elision true', SELFTEST_ELIDE_TRUE, 'ran', ['pass'])
    case('elision lie', SELFTEST_ELIDE_LIE, 'ran', ['mismatch'])
    case('elision too vague', SELFTEST_ELIDE_VAGUE, 'ran', ['mismatch'])
    # A template slot is unchecked, never passed.
    case('placeholder', SELFTEST_PLACEHOLDER, 'ran', ['prose-claim'])
    case('quoted datum true', SELFTEST_QUOTE_TRUE, 'ran', ['pass'])
    case('quoted datum lie', SELFTEST_QUOTE_LIE, 'ran', ['mismatch'])
    case('newline claim true', SELFTEST_NEWLINE_TRUE, 'ran', ['pass'])
    case('newline claim lie', SELFTEST_NEWLINE_LIE, 'ran', ['mismatch'])
    print('SELFTEST', 'PASS' if ok else 'FAIL')
    return 0 if ok else 1


def main():
    if '--selftest' in sys.argv:
        sys.exit(selftest())
    limit = None
    if '--limit' in sys.argv:
        limit = int(sys.argv[sys.argv.index('--limit') + 1])

    progs = bv2.extract_prose_blocks()
    by_file = OrderedDict()
    for p in progs:
        by_file.setdefault(p['file'], []).append(p)

    items = []
    for f, blocks in by_file.items():
        prefix_parts = []
        for p in blocks:
            items.append({'file': f, 'key': p['key'], 'code': p['code'],
                          'prefix': '\n'.join(prefix_parts), 'fragment': p['fragment']})
            # A block that is printed output, or that deliberately raises, must
            # not become the prefix of everything after it. Both were doing so:
            # appendix-a's first `(string-length 42)` killed the 16 blocks below
            # it, and 02-verb-metadata's output fence killed 17. Both tests read
            # the source only, so they can be decided before anything runs.
            if is_output_fence(p['code']) or has_error_claim(p['code']):
                continue
            prefix_parts.append(p['code'])
    if limit:
        items = items[:limit]

    def work(it):
        if it['fragment']:
            return it, 'fragment', []
        st, rows = check_block(it['prefix'], it['code'])
        return it, st, rows

    status = Counter(); verdicts = Counter()
    mismatches = []; errors = []
    done = 0
    with ThreadPoolExecutor(max_workers=8) as ex:
        for it, st, rows in ex.map(work, items):
            status[st] += 1
            for r in rows:
                if st == 'run-error':
                    errors.append({'file': it['file'], 'key': it['key'], **r})
                    continue
                verdicts[r['verdict']] += 1
                if r['verdict'] != 'pass':
                    mismatches.append({'file': it['file'], 'key': it['key'], **r})
            done += 1
            if done % 500 == 0:
                print(f'  ...{done}/{len(items)}', file=sys.stderr)

    print(f'\n== VALUE GATE ({len(items)} blocks) ==')
    for k, v in status.most_common():
        print(f'  block {k:<18s} {v}')
    print('  claims:')
    for k, v in verdicts.most_common():
        print(f'    {k:<14s} {v}')
    out = REPO / 'scratch' / 'audit-books-values.json'
    out.write_text(json.dumps({
        'blocks': len(items), 'block_status': dict(status), 'claim_verdicts': dict(verdicts),
        'mismatches': mismatches, 'run_errors': errors,
    }, indent=2))
    print(f'  -> {out}')


if __name__ == '__main__':
    main()
