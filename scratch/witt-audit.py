#!/usr/bin/env python3
"""witt-audit.py — path-filtered wrapper around audit-books-v2 logic.

Usage:
  python3 scratch/witt-audit.py <path-substring> [--json out.json]

Same extraction + chapter-scoped run as audit-books-v2.py, but restricted to
files whose relative path contains <path-substring>. Chapter prefix semantics
are preserved (prefix accumulates within a file only), so results for a single
file are identical to the full-corpus run.
"""
from __future__ import annotations
import json, re, sys
from pathlib import Path
from collections import defaultdict, Counter, OrderedDict
from concurrent.futures import ThreadPoolExecutor

REPO = Path('/Users/alfred/code/motoi-scheme')
BOOKS = REPO / 'scheme-books'
sys.path.insert(0, str(REPO / 'scratch'))
import importlib.util
_spec = importlib.util.spec_from_file_location('aref', str(REPO / 'scratch' / 'audit-ref.py'))
aref = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(aref)

PROMPT_RE = re.compile(r'^\s*(sakura>|motoi>|>>>|\$ )', re.M)
FENCE_RE = re.compile(r'```(scheme|motoi)\n(.*?)```', re.S)
PROSE_KEY_RE = re.compile(r':prose\s+"')
LINE_COMMENT = re.compile(r';[^\n]*')
STRING_LIT = re.compile(r'"(?:[^"\\]|\\.)*"')


def code_has_ellipsis(body: str) -> bool:
    stripped = STRING_LIT.sub('""', LINE_COMMENT.sub('', body))
    return '...' in stripped or 'ELLIPSIS' in stripped


def extract_prose_blocks(filt):
    progs = []
    for path in sorted(BOOKS.rglob('*.slatl')) + sorted(BOOKS.rglob('*.slat')):
        rel = str(path.relative_to(BOOKS))
        if filt not in rel:
            continue
        text = path.read_text()
        idx = 0
        for pm in PROSE_KEY_RE.finditer(text):
            prose, _ = aref.read_string_literal(text, pm.end() - 1)
            for lang, body in FENCE_RE.findall(prose):
                idx += 1
                if PROMPT_RE.search(body):
                    continue
                if not body.strip():
                    continue
                progs.append({'file': rel, 'key': f'{lang}-block-{idx}',
                              'code': body, 'fragment': code_has_ellipsis(body)})
    return progs


def run(progs, outname):
    by_file = OrderedDict()
    for p in progs:
        by_file.setdefault(p['file'], []).append(p)
    items = []
    for f, blocks in by_file.items():
        prefix_parts = []
        for p in blocks:
            prefix = '\n'.join(prefix_parts)
            scoped = (prefix + '\n' + p['code']) if prefix else p['code']
            items.append({'p': p, 'standalone': p['code'], 'scoped': scoped,
                          'nprefix': len(prefix_parts)})
            prefix_parts.append(p['code'])

    def work(it):
        if it['p']['fragment']:
            return it, 'fragment', '', 'fragment', ''
        rc1, o1, e1 = aref.run_one(it['standalone'])
        c1, i1 = aref.classify(it['standalone'], rc1, o1, e1)
        if c1 == 'ok' or it['nprefix'] == 0:
            return it, c1, i1, c1, i1
        rc2, o2, e2 = aref.run_one(it['scoped'])
        c2, i2 = aref.classify(it['scoped'], rc2, o2, e2)
        return it, c1, i1, c2, i2

    scoped_cats = Counter(); phantom = []; real = defaultdict(list); fragments = 0
    with ThreadPoolExecutor(max_workers=8) as ex:
        for it, c1, i1, c2, i2 in ex.map(work, items):
            if c2 == 'fragment':
                fragments += 1
                continue
            scoped_cats[c2] += 1
            if c1 != 'ok':
                if c2 == 'ok':
                    phantom.append({'file': it['p']['file'], 'key': it['p']['key']})
                else:
                    real[c2].append({'file': it['p']['file'], 'key': it['p']['key'],
                                     'scoped_cat': c2, 'scoped_info': i2,
                                     'code': it['p']['code']})
    testable = len(items) - fragments
    n_real = sum(len(v) for v in real.values())
    print(f'== {filt} :: {len(items)} blocks, {fragments} fragments, {testable} testable, {len(by_file)} files ==')
    print(f'  PASS {scoped_cats.get("ok",0)}   REAL-FAIL {n_real}   phantom {len(phantom)}')
    for c, v in sorted(real.items(), key=lambda kv: -len(kv[1])):
        print(f'     {c:<18s} {len(v)}')
    perfile = Counter(r['file'] for v in real.values() for r in v)
    for f, n in sorted(perfile.items()):
        print(f'       {n:>4d}  {f}')
    if outname:
        Path(f'scratch/{outname}').write_text(json.dumps(
            {'testable': testable, 'pass': scoped_cats.get('ok', 0),
             'real_count': n_real, 'real': real}, indent=2))
        print(f'  -> scratch/{outname}')
    return n_real


if __name__ == '__main__':
    filt = sys.argv[1]
    out = None
    if '--json' in sys.argv:
        out = sys.argv[sys.argv.index('--json') + 1]
    run(extract_prose_blocks(filt), out)
