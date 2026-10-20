#!/usr/bin/env python3
"""probe-opaque-leaks.py — run every reference snippet and flag JS artifacts in its OUTPUT.

The reference gate (verify-reference-notes.py) only checks snippets whose note
opens with a self-delimiting literal; everything else is skipped as prose. That
leaves a blind spot exactly where this bug class lives: a snippet can print
`[object Object]` and still be "skipped, honest".

This runs every `:code` in every chapter and greps the OUTPUT for the two
JavaScript artifacts that are not Scheme values:

    [object Object]   — String(v) on a plain host object
    #<record>         — the catch-all in lib/base/r7rs-small.js's write printer

Reports only. Never edits a chapter.
"""

import os, re, sys, subprocess, tempfile
from concurrent.futures import ThreadPoolExecutor

ROOT = '/Users/alfred/code/motoi-scheme'
REF_DIR = f'{ROOT}/scheme/reference'
MOTOI_BIN = f'{ROOT}/bin/motoi'
SANDBOX_HOME = tempfile.mkdtemp(prefix='motoi-leak-home-')
CHILD_ENV = {**os.environ, 'MOTOI_HOME': SANDBOX_HOME}

ARTIFACTS = ('[object Object]', '#<record>')

CODE_RE = re.compile(r':code\s+"((?:[^"\\]|\\.)*)"')


def unescape(s):
    return (s.replace('\\n', '\n').replace('\\t', '\t')
             .replace('\\"', '"').replace('\\\\', '\\'))


def run(args):
    chapter, lineno, code = args
    with tempfile.NamedTemporaryFile('w', suffix='.scm', delete=False) as f:
        f.write(code + '\n')
        path = f.name
    try:
        p = subprocess.run([MOTOI_BIN, 'run', path], capture_output=True,
                           text=True, timeout=25, env=CHILD_ENV)
        out = (p.stdout or '') + (p.stderr or '')
    except Exception as e:
        out = f'<<harness: {e}>>'
    finally:
        os.unlink(path)
    hit = [a for a in ARTIFACTS if a in out]
    return (chapter, lineno, code, out.strip()[:200], hit) if hit else None


def main():
    names = sys.argv[1:] or sorted(n for n in os.listdir(REF_DIR) if n.endswith('.slat'))
    jobs = []
    for name in names:
        text = open(f'{REF_DIR}/{name}').read()
        for m in CODE_RE.finditer(text):
            lineno = text.count('\n', 0, m.start()) + 1
            jobs.append((name, lineno, unescape(m.group(1))))

    print(f'snippets: {len(jobs)}')
    hits = []
    with ThreadPoolExecutor(max_workers=8) as ex:
        for r in ex.map(run, jobs):
            if r:
                hits.append(r)
    for chapter, lineno, code, out, hit in sorted(hits):
        print(f'\n{chapter}:{lineno}  {hit}')
        print(f'  code: {code[:160]!r}')
        print(f'  out : {out!r}')
    print(f'\nLEAKS: {len(hits)}')
    return len(hits)


if __name__ == '__main__':
    sys.exit(min(main(), 250))
