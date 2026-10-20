#!/usr/bin/env python3
"""verify-book-examples.py — run every (example :code … :expected …) in the books.

The reference chapters have had a gate since 2026-08-02; the books never did.
The reference gate looks for :code + :note, but book chapters spell the claim
:expected / :expected-output, so it matched nothing and reported zero coverage
on 800+ chapters. This is the missing gate.

An authored :expected is a CLAIM about the language. This executes the claim.

Usage:
    python3 scratch/verify-book-examples.py                 # scheme-books + word-books
    python3 scratch/verify-book-examples.py scheme-books    # one tree
    python3 scratch/verify-book-examples.py --book book-of-scheme

Exit code is the number of failing examples, capped at 250, so it can gate a
commit. Reports only — it never edits a chapter.
"""

import os, re, sys, subprocess, tempfile
from concurrent.futures import ThreadPoolExecutor

ROOT = '/Users/alfred/code/motoi-scheme'
MOTOI_BIN = f'{ROOT}/bin/motoi'
DUMP = '/tmp/book-example-failures.tsv'
TREES = ['scheme-books', 'word-books']

# Book examples write to the user store just like reference snippets do; an
# unset MOTOI_HOME both pollutes the real cortex and makes results order-dependent.
SANDBOX_HOME = tempfile.mkdtemp(prefix='motoi-book-verify-')
CHILD_ENV = {**os.environ, 'MOTOI_HOME': SANDBOX_HOME}


def extract_records(text, tag='(example'):
    """Balanced-paren record slicer that respects string literals."""
    records, i, n = [], 0, len(text)
    while i < n:
        if (i == 0 or text[i - 1] == '\n') and text.startswith(tag, i):
            start, depth, in_str, esc, j = i, 0, False, False, i
            while j < n:
                c = text[j]
                if in_str:
                    if esc: esc = False
                    elif c == '\\': esc = True
                    elif c == '"': in_str = False
                else:
                    if c == '"': in_str = True
                    elif c == '(': depth += 1
                    elif c == ')':
                        depth -= 1
                        if depth == 0:
                            j += 1
                            break
                j += 1
            records.append(text[start:j])
            i = j
        else:
            i += 1
    return records


def unescape(s):
    # Single pass. Sequential .replace() calls corrupt a literal backslash-n.
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


STR_FIELD = r':{}\s+"((?:[^"\\]|\\.)*)"'
# A bare :expected is an atom — 185, #t, #f, a symbol. Never a list; those are quoted.
ATOM_FIELD = r':{}\s+(#t|#f|[-+]?[0-9][^\s()]*|[^\s()"]+)'


def field(rec, name):
    m = re.search(STR_FIELD.format(name), rec)
    if m:
        return unescape(m.group(1)), True
    m = re.search(ATOM_FIELD.format(name), rec)
    if m:
        return m.group(1), False
    return None, False


def norm(s):
    return re.sub(r'\s+', ' ', (s or '').strip())


def matches(actual, expected, was_string):
    a, e = norm(actual), norm(expected)
    if a == e:
        return True
    # A string value may print with or without its surrounding quotes depending
    # on whether the chapter author wrote display- or write-style output.
    if was_string and a == f'"{e}"':
        return True
    if a.strip('"') == e.strip('"'):
        return True
    return False


def run_example(args):
    idx, name, code, expected, was_string = args
    tmp = os.path.join(SANDBOX_HOME, f'book-{idx}.scm')
    with open(tmp, 'w') as f:
        f.write(code)
    try:
        r = subprocess.run([MOTOI_BIN, 'run', tmp], capture_output=True,
                           timeout=20, cwd=ROOT, text=True, env=CHILD_ENV)
        out = (r.stdout or '').strip()
        err = (r.stderr or '').strip()
        if r.returncode != 0 or re.search(r'^\s*error:', out + err, re.M):
            return (name, code, expected, 'ERROR', (err or out).splitlines()[0] if (err or out) else '')
        return (name, code, expected,
                'MATCH' if matches(out, expected, was_string) else 'MISMATCH', out)
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

    jobs = []
    for path in sorted(paths):
        with open(path, errors='replace') as f:
            text = f.read()
        for rec in extract_records(text):
            code, _ = field(rec, 'code')
            if not code:
                continue
            expected, was_string = field(rec, 'expected')
            if expected is None:
                expected, was_string = field(rec, 'expected-output')
            if expected is None:
                continue
            m = re.search(r':ref\s+"([^"]+)"', rec)
            ref = m.group(1) if m else '<unnamed>'
            rel = os.path.relpath(path, ROOT)
            jobs.append((len(jobs), f'{rel}:{ref}', code.strip(), expected, was_string))

    if not jobs:
        print('no examples matched.')
        return 0

    with ThreadPoolExecutor(max_workers=8) as ex:
        results = list(ex.map(run_example, jobs))

    counts = {'MATCH': 0, 'MISMATCH': 0, 'ERROR': 0}
    for r in results:
        counts[r[3]] += 1
    bad = [r for r in results if r[3] != 'MATCH']

    with open(DUMP, 'w') as f:
        f.write('kind\tlocation\texpected\tactual\tcode\n')
        for name, code, expected, kind, actual in bad:
            f.write('\t'.join(x.replace('\t', ' ').replace('\n', '\\n') for x in
                              (kind, name, expected, actual, code[:300])) + '\n')

    print(f'examples with a claim : {len(results)}')
    print(f'  MATCH               : {counts["MATCH"]}')
    print(f'  MISMATCH            : {counts["MISMATCH"]}')
    print(f'  ERROR               : {counts["ERROR"]}')
    print(f'full list             : {DUMP}')
    for name, code, expected, kind, actual in bad[:40]:
        print(f'\n--- [{kind}] {name}\n    {code.splitlines()[0][:100]}'
              f'\n    expected: {expected[:100]}\n    actual  : {actual[:100]}')
    if len(bad) > 40:
        print(f'\n... and {len(bad) - 40} more')
    return min(len(bad), 250)


if __name__ == '__main__':
    sys.exit(main())
