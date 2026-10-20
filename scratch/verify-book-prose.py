#!/usr/bin/env python3
"""verify-book-prose.py — run every `;; -> …` claim in book PROSE.

verify-book-examples.py gates the (example :code … :expected …) records. It
does not see the fenced code blocks inside :prose, and those carry MORE claims
than the example records do — a `;; -> 42` in a teaching block is exactly as
much a promise about the language as an :expected field, and until now nothing
ran it.

A block's earlier forms are the setup for its later ones, so each claim is run
as [every preceding top-level form in the same block] + [the annotated form].
Motoi's `run` echoes only the last form's value, so the claim compares cleanly.

Usage:
    python3 scratch/verify-book-prose.py                 # scheme-books + word-books
    python3 scratch/verify-book-prose.py scheme-books    # one tree
    python3 scratch/verify-book-prose.py --book book-of-values

Exit code is the number of failing claims, capped at 250. Reports only.
"""

import os, re, sys, subprocess, tempfile
from concurrent.futures import ThreadPoolExecutor

ROOT = '/Users/alfred/code/motoi-scheme'
MOTOI_BIN = f'{ROOT}/bin/motoi'
DUMP = os.environ.get('PROSE_DUMP', '/tmp/book-prose-failures.tsv')
TREES = ['scheme-books', 'word-books']

SANDBOX_HOME = tempfile.mkdtemp(prefix='motoi-prose-verify-')
CHILD_ENV = {**os.environ, 'MOTOI_HOME': SANDBOX_HOME}



def unescape(s):
    out, i, n = [], 0, len(s)
    while i < n:
        c = s[i]
        if c == '\\' and i + 1 < n:
            nxt = s[i + 1]
            out.append({'n': '\n', 't': '\t', 'r': '\r', '"': '"', '\\': '\\'}.get(nxt, '\\' + nxt))
            i += 2
        else:
            out.append(c)
            i += 1
    return ''.join(out)


def prose_of(text):
    """The :prose field is one long escaped string literal. Slice it by hand;
    a regex over a 40KB literal with a backtracking alternation is not worth it."""
    k = text.find(':prose')
    if k < 0:
        return ''
    q = text.find('"', k)
    if q < 0:
        return ''
    i, n, esc = q + 1, len(text), False
    start = i
    while i < n:
        c = text[i]
        if esc:
            esc = False
        elif c == '\\':
            esc = True
        elif c == '"':
            break
        i += 1
    return unescape(text[start:i])


# Authors spell the arrow three ways across the 34 books; `=>` outnumbers `->`
# seven to one, so a gate that matched only `->` saw an eighth of the claims.
CLAIM = re.compile(r'^\s*;;\s*(?:->|=>|returns\b)\s*(.+?)\s*$')


def depth_delta(line):
    """Paren balance of one line, ignoring string literals, ; comments and
    #\\( / #\\) character literals."""
    d, i, n, in_str, esc = 0, 0, len(line), False, False
    while i < n:
        c = line[i]
        if in_str:
            if esc: esc = False
            elif c == '\\': esc = True
            elif c == '"': in_str = False
        elif c == '"':
            in_str = True
        elif c == ';':
            break
        elif c == '#' and i + 2 < n and line[i + 1] == '\\':
            i += 3
            continue
        elif c == '(':
            d += 1
        elif c == ')':
            d -= 1
        i += 1
    return d


CONT = re.compile(r'^\s*;;\s?(.*)$')


def clean_expected(text):
    """An authored claim often carries an aside: `#t     (200000 ms = 200s)` or
    `30480    ;; 100 ft = 30.480 m`. The value is the head; the aside is prose.
    Only strip it when what remains is itself a complete, balanced form."""
    # Most aggressive candidate first — `#f     (+nan.0 is not equal to +nan.0)`
    # is balanced as a whole, so trying the whole string first keeps the aside.
    #
    # An aside introduced by a SINGLE `;` is just as common as `;;` —
    # `7   ; 2 + 3 + 2` — and splitting only on `;;` left it attached, so the
    # claim could never match however right it was. Two agents reported the
    # same phantom failures independently. Only take the single-`;` cut when
    # the head has balanced quotes: depth_delta stops at `;` even inside a
    # string, so it would call the truncated `"hi` balanced and silently eat
    # a value like `"hi ; there"`.
    def _quotes_even(s):
        n, i, esc = 0, 0, False
        while i < len(s):
            c = s[i]
            if esc: esc = False
            elif c == '\\': esc = True
            elif c == '"': n += 1
            i += 1
        return n % 2 == 0
    semi = re.split(r'\s+;', text)[0]
    heads = [] if semi == text or not _quotes_even(semi) else [
        re.split(r'\s{2,}[(\[]', semi)[0], semi]
    for cut in (*heads,
                re.split(r'\s{2,}[(\[]', text.split(';;')[0])[0],
                re.split(r'\s{2,}[(\[]', text)[0], text.split(';;')[0], text):
        c = cut.strip()
        if c and depth_delta(c) == 0:
            return c
    return text.strip()


def claims_in_block(block, carried):
    """-> list of (preamble_forms, form, expected). `carried` is every form
    already seen in earlier blocks of the same chapter; a book chapter is
    sequential prose, so a helper defined in block 2 is in scope in block 7."""
    forms, buf, depth = [], [], 0
    out, pending = [], None
    for line in block.split('\n'):
        stripped = line.strip()
        m = CLAIM.match(line)
        if m and depth == 0 and not buf:
            if forms:
                pending = [m.group(1)]
                out.append((carried + forms[:-1], forms[-1], pending))
            continue
        # A claim too wide for one line is continued on bare `;;` lines.
        if pending is not None and stripped.startswith(';;'):
            cm = CONT.match(line)
            if cm and depth_delta(' '.join(pending)) != 0:
                pending.append(cm.group(1))
                continue
        pending = None
        if not stripped and not buf:
            continue
        if stripped.startswith(';') and not buf:
            continue
        buf.append(line)
        depth += depth_delta(line)
        if depth <= 0:
            forms.append('\n'.join(buf))
            buf, depth = [], 0
    return [(pre, form, clean_expected(' '.join(exp))) for pre, form, exp in out], forms


def norm(s):
    return re.sub(r'\s+', ' ', (s or '').strip())


def matches(actual, expected):
    a, e = norm(actual), norm(expected)
    if a == e or a.strip('"') == e.strip('"'):
        return True
    # `;; -> #t` next to a value the author wrote unquoted, and display- vs
    # write-style strings, are the same claim spelled two ways.
    if a == f'"{e}"' or f'"{a}"' == e:
        return True
    return False


# Blocks that are illustrative rather than runnable. A claim whose text is not
# a value — prose like "an error", "#f, always" — is a teaching sentence, not a
# testable output, and is skipped rather than counted as a failure.
NON_VALUE = re.compile(r'\b(error|raises?|unspecified|depends|varies|implementation|or\s|maybe|something|approximately|roughly|etc)\b|\.\.\.', re.I)

# A clock or a die is a different value every run. The claim is untestable by
# construction, not wrong — count it as skipped rather than as a failure.
NONDET = re.compile(r'\b(current-(time|second|jiffy|date)|now|time/(now|iso)|random\S*)\b')

# Only DEFINITIONS carry forward into a later block. A book chapter also
# contains sketch blocks — bracket notation, `[sign: …]`, prose-as-code — and
# carrying one of those forward makes every later claim in the chapter fail on
# the sketch rather than on itself. Definitions are what a later block relies on.
_SKETCH = re.compile(r'[\[\]…⟨⟩]|\.\.\.')


def CARRYABLE(form):
    return form.lstrip().startswith('(define') and not _SKETCH.search(form)


def is_prose(expected):
    """`;; => count of shops that returned a non-empty product list` is an
    exercise prompt, not an output. A Scheme value starts with a delimiter, a
    digit, a sign, `#`, or a quote — an English sentence starts with a word."""
    e = expected.strip()
    return bool(e) and e[0] not in '("\'#-+0123456789' and len(e.split()) >= 3


def run_claim(args):
    idx, name, code, expected = args
    tmp = os.path.join(SANDBOX_HOME, f'prose-{idx}.scm')
    with open(tmp, 'w') as f:
        f.write(code)
    try:
        r = subprocess.run([MOTOI_BIN, 'run', tmp], capture_output=True,
                           timeout=20, cwd=ROOT, text=True, env=CHILD_ENV)
        out = (r.stdout or '').strip()
        err = (r.stderr or '').strip()
        if r.returncode != 0 or re.search(r'^\s*error:', out + err, re.M):
            first = (err or out).splitlines()[0] if (err or out) else ''
            return (name, code, expected, 'ERROR', first)
        # No output means the annotated form had no value to echo, so the claim
        # is describing something other than this form's result. Not comparable.
        if not out:
            return (name, code, expected, 'SKIP', '')
        return (name, code, expected,
                'MATCH' if matches(out, expected) else 'MISMATCH', out)
    except subprocess.TimeoutExpired:
        return (name, code, expected, 'ERROR', '<timeout>')
    except Exception as e:
        return (name, code, expected, 'ERROR', f'<exception: {e}>')
    finally:
        try: os.unlink(tmp)
        except OSError: pass


def main():
    argv = list(sys.argv[1:])
    only_book = None
    if '--book' in argv:
        k = argv.index('--book')
        only_book = argv[k + 1]
        del argv[k:k + 2]
    trees = argv or TREES

    paths = []
    for t in trees:
        base = t if os.path.isabs(t) else os.path.join(ROOT, t)
        for dirpath, _, files in os.walk(base):
            if only_book and only_book not in dirpath:
                continue
            for fn in sorted(files):
                if fn.endswith('.slatl') or fn.endswith('.slat'):
                    paths.append(os.path.join(dirpath, fn))

    jobs, skipped = [], 0
    for path in sorted(paths):
        with open(path, errors='replace') as f:
            text = f.read()
        prose = prose_of(text)
        if ';;' not in prose:
            continue
        rel = os.path.relpath(path, ROOT)
        carried = []
        for bi, block in enumerate(re.findall(r'```[a-z]*\n(.*?)```', prose, re.S)):
            claims, forms = claims_in_block(block, carried)
            for ci, (pre, form, expected) in enumerate(claims):
                code = '\n'.join(pre + [form])
                if (NON_VALUE.search(expected) or NONDET.search(code)
                        or is_prose(expected) or form.lstrip().startswith('(define')):
                    skipped += 1
                    continue
                jobs.append((len(jobs), f'{rel}#b{bi}c{ci}', code, expected))
            carried = carried + [f for f in forms if CARRYABLE(f)]

    if not jobs:
        print('no prose claims matched.')
        return 0

    with ThreadPoolExecutor(max_workers=8) as ex:
        results = list(ex.map(run_claim, jobs))

    counts = {'MATCH': 0, 'MISMATCH': 0, 'ERROR': 0, 'SKIP': 0}
    for r in results:
        counts[r[3]] += 1
    bad = [r for r in results if r[3] not in ('MATCH', 'SKIP')]

    with open(DUMP, 'w') as f:
        f.write('kind\tlocation\texpected\tactual\tcode\n')
        for name, code, expected, kind, actual in bad:
            f.write('\t'.join(x.replace('\t', ' ').replace('\n', '\\n') for x in
                              (kind, name, expected, actual, code[:400])) + '\n')

    print(f'prose claims run        : {len(results)}')
    print(f'  MATCH                 : {counts["MATCH"]}')
    print(f'  MISMATCH              : {counts["MISMATCH"]}')
    print(f'  ERROR                 : {counts["ERROR"]}')
    print(f'  skipped (prose claim) : {skipped + counts["SKIP"]}')
    print(f'full list               : {DUMP}')
    return min(len(bad), 250)


if __name__ == '__main__':
    sys.exit(main())
