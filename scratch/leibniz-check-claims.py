#!/usr/bin/env python3
"""leibniz-check-claims.py — run every snippet in a reference chapter and report
the ones whose FINAL printed value is #f.

verify-reference-records.py only asks "did it run". verify-reference-notes.py
only checks notes that OPEN with a self-delimiting literal, and chapter 11 has
none of those — it reports "no checkable claims matched", i.e. it certifies
nothing at all here.

But chapter 11 is full of snippets that ARE assertions: the row-4 proof rows say
outright "if the invariant ever prints #f, the verb has drifted". Those are
machine-checkable without guessing an expected value: a snippet whose result is
the boolean #f has falsified its own documented claim. That is the check this
script runs.

Usage: python3 scratch/leibniz-check-claims.py 11-calc.slat
Exit code = number of snippets that printed #f.
"""

import os, re, sys, subprocess, tempfile
from concurrent.futures import ThreadPoolExecutor

ROOT = '/Users/alfred/code/motoi-scheme'
REF_DIR = f'{ROOT}/scheme/reference'
MOTOI = f'{ROOT}/bin/motoi'
HOME = tempfile.mkdtemp(prefix='leibniz-claims-')
ENV = {**os.environ, 'MOTOI_HOME': HOME}


def snippets(text):
    """Every double-quoted string in the chapter that looks like Scheme code."""
    out = []
    for m in re.finditer(r'"((?:[^"\\]|\\.)*)"', text):
        raw = m.group(1)
        code = raw.replace('\\n', '\n').replace('\\"', '"').replace('\\\\', '\\')
        if not code.lstrip().startswith('('):
            continue
        if '->' in code.split('\n')[0] and code.count('\n') == 0:
            continue          # a :signature line, not a program
        out.append((m.start(), code))
    return out


def run(code):
    with tempfile.NamedTemporaryFile('w', suffix='.scm', delete=False) as fh:
        fh.write(code + '\n')
        path = fh.name
    try:
        p = subprocess.run([MOTOI, 'run', path], capture_output=True,
                           text=True, env=ENV, timeout=90)
        return (p.stdout or '') + (p.stderr or '')
    except subprocess.TimeoutExpired:
        return '<timeout>'
    finally:
        os.unlink(path)


def main():
    names = sys.argv[1:] or ['11-calc.slat']
    bad = 0
    for name in names:
        text = open(f'{REF_DIR}/{name}', encoding='utf-8').read()
        snips = snippets(text)
        with ThreadPoolExecutor(max_workers=8) as ex:
            results = list(ex.map(lambda s: run(s[1]), snips))
        for (off, code), out in zip(snips, results):
            tail = out.strip().split('\n')[-1].strip() if out.strip() else ''
            if tail == '#f' or '<timeout>' in out:
                bad += 1
                line = text[:off].count('\n') + 1
                print(f'--- {name}:{line}  -> {tail or "<timeout>"}')
                for l in code.split('\n')[:6]:
                    print('    ' + l)
                print()
        print(f'{name}: {len(snips)} snippets, {bad} printing #f')
    return bad


if __name__ == '__main__':
    sys.exit(min(main(), 250))
