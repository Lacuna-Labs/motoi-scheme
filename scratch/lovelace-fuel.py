#!/usr/bin/env python3
"""lovelace-fuel.py — single-file, fuel-aware book block harness.

Mirrors scratch/audit-books-v2.py extraction + chapter-scoping exactly, but:
  * scoped to ONE file (fast enough to iterate)
  * lets you vary --fuel so a block can be classified as
      non-terminating / heavy-but-terminating / other-bug
"""
from __future__ import annotations
import json, re, sys, subprocess, os, tempfile
from pathlib import Path
from collections import OrderedDict, Counter
from concurrent.futures import ThreadPoolExecutor

REPO = Path('/Users/alfred/code/motoi-scheme')
BOOKS = REPO / 'scheme-books'
MOTOI = str(REPO / 'bin' / 'motoi')

PROMPT_RE = re.compile(r'^\s*(sakura>|motoi>|>>>|\$ )', re.M)
FENCE_RE = re.compile(r'```(scheme|motoi)\n(.*?)```', re.S)
PROSE_KEY_RE = re.compile(r':prose\s+"')
LINE_COMMENT = re.compile(r';[^\n]*')
STRING_LIT = re.compile(r'"(?:[^"\\]|\\.)*"')

sys.path.insert(0, str(REPO / 'scratch'))
import importlib.util
_spec = importlib.util.spec_from_file_location('aref', str(REPO / 'scratch' / 'audit-ref.py'))
aref = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(aref)


def code_has_ellipsis(body: str) -> bool:
    stripped = STRING_LIT.sub('""', LINE_COMMENT.sub('', body))
    return '...' in stripped or 'ELLIPSIS' in stripped


def extract(path: Path):
    """Return list of blocks with the SAME idx numbering audit-books-v2 uses."""
    text = path.read_text()
    progs = []
    idx = 0
    for pm in PROSE_KEY_RE.finditer(text):
        prose, _ = aref.read_string_literal(text, pm.end() - 1)
        for lang, body in FENCE_RE.findall(prose):
            idx += 1
            if PROMPT_RE.search(body):
                continue
            if not body.strip():
                continue
            progs.append({'key': f'{lang}-block-{idx}', 'code': body,
                          'fragment': code_has_ellipsis(body)})
    return progs


def run_code(code, fuel=None, timeout=120):
    cmd = [MOTOI, 'run']
    if fuel:
        cmd += ['--fuel', str(fuel)]
    cmd += ['/dev/stdin']
    try:
        r = subprocess.run(cmd, input=code, capture_output=True, text=True,
                           timeout=timeout)
        return r.returncode, r.stdout or '', r.stderr or ''
    except subprocess.TimeoutExpired:
        return -99, '', 'TIMEOUT'


def cat(code, fuel=None, timeout=120):
    rc, o, e = run_code(code, fuel, timeout)
    c, i = aref.classify(code, rc, o, e)
    return c, i, o, e


def scoped_items(path: Path):
    blocks = extract(path)
    out = []
    prefix = []
    for p in blocks:
        pre = '\n'.join(prefix)
        out.append({'p': p, 'standalone': p['code'],
                    'scoped': (pre + '\n' + p['code']) if pre else p['code'],
                    'nprefix': len(prefix)})
        prefix.append(p['code'])
    return out


def audit(path: Path, fuel=None, workers=8):
    items = scoped_items(path)

    def work(it):
        if it['p']['fragment']:
            return it, 'fragment', ''
        c1, i1, _, _ = cat(it['standalone'], fuel)
        if c1 == 'ok' or it['nprefix'] == 0:
            return it, c1, i1
        c2, i2, _, _ = cat(it['scoped'], fuel)
        return it, c2, i2

    cats = Counter(); fails = []
    with ThreadPoolExecutor(max_workers=workers) as ex:
        for it, c, i in ex.map(work, items):
            if c == 'fragment':
                cats['fragment'] += 1
                continue
            cats[c] += 1
            if c != 'ok':
                fails.append({'key': it['p']['key'], 'cat': c, 'info': i})
    return cats, fails, items


if __name__ == '__main__':
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument('file')
    ap.add_argument('--fuel', type=int, default=None)
    a = ap.parse_args()
    p = BOOKS / a.file if not a.file.startswith('/') else Path(a.file)
    if not p.exists():
        p = Path(a.file)
    cats, fails, items = audit(p, a.fuel)
    testable = sum(v for k, v in cats.items() if k != 'fragment')
    print(f'{p.name}: {testable} testable, PASS {cats["ok"]}, FAIL {testable-cats["ok"]}'
          f'  (fragments {cats["fragment"]}, fuel={a.fuel or "default"})')
    fc = Counter(f['cat'] for f in fails)
    fuel_n = sum(1 for f in fails if 'fuel' in f['info'].lower())
    for k, v in fc.most_common():
        print(f'   {k:<18s} {v}')
    print(f'   [of which fuel-exhausted: {fuel_n}]')
    for f in fails[:400]:
        print(f'     {f["key"]:<22s} {f["cat"]:<16s} {f["info"][:110]}')
