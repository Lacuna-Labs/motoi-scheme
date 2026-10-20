#!/usr/bin/env python3
"""audit-books-v2.py — corrected chapter-scoped book census.

Fixes the phantom-fail inflation in audit-books.py: the old extractor skipped
ANY fenced block containing '...', which dropped chapter-runtime PREAMBLES
whose only '...' was inside a comment (e.g. ';; --- and so on ...'). Dropping
the preamble unbinds dsin/TAU/paint-cell in every later block -> hundreds of
phantom unbound-symbol fails.

Correction: strip line-comments and string contents before the ellipsis check.
A block is a genuine fragment only if a bare '...' survives as CODE. All other
blocks (incl. comment-bearing preambles) are kept, contribute their defines to
the chapter prefix, and are themselves tested.
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
    """True only if '...' appears as CODE (not in a comment or string)."""
    stripped = STRING_LIT.sub('""', LINE_COMMENT.sub('', body))
    return '...' in stripped or 'ELLIPSIS' in stripped


def extract_prose_blocks():
    progs = []
    for path in sorted(BOOKS.rglob('*.slatl')) + sorted(BOOKS.rglob('*.slat')):
        text = path.read_text()
        rel = str(path.relative_to(BOOKS))
        idx = 0
        for pm in PROSE_KEY_RE.finditer(text):
            qstart = pm.end() - 1
            prose, qend = aref.read_string_literal(text, qstart)
            for lang, body in FENCE_RE.findall(prose):
                idx += 1
                if PROMPT_RE.search(body):
                    continue
                if not body.strip():
                    continue
                is_fragment = code_has_ellipsis(body)
                # The block lives inside an ESCAPED string literal, so it is not
                # byte-identical to anything in the file. A repair needs to find
                # its way back, so the literal's span travels with the block.
                progs.append({'file': rel, 'key': f'{lang}-block-{idx}',
                              'code': body, 'fragment': is_fragment,
                              'literal_span': [qstart, qend]})
    return progs


def run_chapter_scoped(progs, outname):
    by_file = OrderedDict()
    for p in progs:
        by_file.setdefault(p['file'], []).append(p)

    items = []
    for f, blocks in by_file.items():
        prefix_parts = []
        for i, p in enumerate(blocks):
            prefix = '\n'.join(prefix_parts)
            scoped = (prefix + '\n' + p['code']) if prefix else p['code']
            items.append({'p': p, 'standalone': p['code'], 'scoped': scoped,
                          'nprefix': len(prefix_parts)})
            # genuine fragments still contribute their defines to the prefix,
            # but we don't fault them for their own bare-'...' non-runnability.
            prefix_parts.append(p['code'])

    def work(it):
        # skip TESTING pure fragments (bare ... in code) — they can't run alone,
        # but they DID contribute to the prefix above.
        if it['p']['fragment']:
            return it, 'fragment', '', 'fragment', ''
        rc1, o1, e1 = aref.run_one(it['standalone'])
        c1, i1 = aref.classify(it['standalone'], rc1, o1, e1)
        if c1 == 'ok' or it['nprefix'] == 0:
            return it, c1, i1, c1, i1
        rc2, o2, e2 = aref.run_one(it['scoped'])
        c2, i2 = aref.classify(it['scoped'], rc2, o2, e2)
        return it, c1, i1, c2, i2

    standalone_cats = Counter(); scoped_cats = Counter()
    phantom = []; real = defaultdict(list); fragments = 0
    done = 0; total = len(items)
    with ThreadPoolExecutor(max_workers=8) as ex:
        for it, c1, i1, c2, i2 in ex.map(work, items):
            if c2 == 'fragment':
                fragments += 1
                continue
            standalone_cats[c1] += 1
            scoped_cats[c2] += 1
            if c1 != 'ok':
                if c2 == 'ok':
                    phantom.append({'file': it['p']['file'], 'key': it['p']['key'],
                                    'standalone_cat': c1, 'standalone_info': i1})
                else:
                    real[c2].append({'file': it['p']['file'], 'key': it['p']['key'],
                                     'scoped_cat': c2, 'scoped_info': i2,
                                     'standalone_cat': c1, 'code': it['p']['code'][:300]})
            done += 1
            if done % 500 == 0:
                print(f'  ...{done}/{total}', file=sys.stderr)

    testable = total - fragments
    sc_fail = testable - scoped_cats.get('ok', 0)
    n_real = sum(len(v) for v in real.values())
    print(f'\n== CHAPTER-SCOPED v2 ({total} blocks, {fragments} pure fragments, '
          f'{testable} testable across {len(by_file)} files) ==')
    print(f'  chapter PASS : {scoped_cats.get("ok",0)}')
    print(f'  chapter FAIL : {sc_fail}')
    print(f'  -> PHANTOM (flips to pass under corrected scope): {len(phantom)}')
    print(f'  -> REAL     (still fails): {n_real}')
    print('  real by category:')
    for c, v in sorted(real.items(), key=lambda kv: -len(kv[1])):
        print(f'     {c:<18s} {len(v)}')
    Path(f'scratch/{outname}').write_text(json.dumps({
        'total_blocks': total, 'fragments': fragments, 'testable': testable,
        'files': len(by_file), 'chapter_fail': sc_fail,
        'phantom_count': len(phantom), 'real_count': n_real,
        'scoped_cats': dict(scoped_cats), 'phantom': phantom, 'real': real,
    }, indent=2))
    print(f'  -> scratch/{outname}')


if __name__ == '__main__':
    progs = extract_prose_blocks()
    by_file = Counter(p['file'] for p in progs)
    nfrag = sum(1 for p in progs if p['fragment'])
    print(f'v2 extracted {len(progs)} blocks ({nfrag} fragments) across {len(by_file)} files')
    run_chapter_scoped(progs, 'audit-books-v2.json')
