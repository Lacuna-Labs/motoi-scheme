#!/usr/bin/env python3
"""audit-books.py — extract + run every runnable code field in scheme-books/,
classifying failures into real bugs vs illustrative fragments.

Runnable code in books lives in string fields whose value starts with '(':
  :code "(...)"     — worked examples / demos
  :example "(...)"  — inline examples
Non-runnable :code values are file-path references ("src/...") and are skipped.
:source is provenance/citation (wikipedia, papers) — NOT code, skipped.

Usage:
  python3 scratch/audit-books.py extract        # inventory
  python3 scratch/audit-books.py run            # execute each, classify
"""
from __future__ import annotations
import json, re, sys, subprocess
from pathlib import Path
from collections import defaultdict, Counter

REPO = Path('/Users/alfred/code/motoi-scheme')
BOOKS = REPO / 'scheme-books'
MOTOI = str(REPO / 'bin' / 'motoi')

sys.path.insert(0, str(REPO / 'scratch'))
import importlib.util
_spec = importlib.util.spec_from_file_location('aref', str(REPO / 'scratch' / 'audit-ref.py'))
aref = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(aref)

CODE_KEYS = ('code', 'example', 'run', 'src')


def extract_programs():
    progs = []
    key_re = re.compile(r':(' + '|'.join(CODE_KEYS) + r')\s+"')
    for path in sorted(BOOKS.rglob('*.slatl')) + sorted(BOOKS.rglob('*.slat')):
        text = path.read_text()
        for m in key_re.finditer(text):
            qpos = m.end() - 1
            code, _ = aref.read_string_literal(text, qpos)
            s = code.strip()
            # runnable = a scheme s-expression; skip file paths / prose fragments
            if not s.startswith('('):
                continue
            rel = str(path.relative_to(BOOKS))
            progs.append({'file': rel, 'key': m.group(1), 'code': code})
    return progs


PROMPT_RE = re.compile(r'^\s*(sakura>|motoi>|>>>|\$ )', re.M)
FENCE_RE = re.compile(r'```(scheme|motoi)\n(.*?)```', re.S)


PROSE_KEY_RE = re.compile(r':prose\s+"')


def extract_prose_blocks():
    """Runnable prose fenced blocks. Prose is a slat string field, so its inner
    quotes are escaped (\\") — decode the :prose value first, THEN pull fences.
    Skip transcripts (prompt-bearing) and ellipsis fragments — not standalone
    programs."""
    progs = []
    for path in sorted(BOOKS.rglob('*.slatl')) + sorted(BOOKS.rglob('*.slat')):
        text = path.read_text()
        rel = str(path.relative_to(BOOKS))
        idx = 0
        for pm in PROSE_KEY_RE.finditer(text):
            prose, _ = aref.read_string_literal(text, pm.end() - 1)
            for lang, body in FENCE_RE.findall(prose):
                idx += 1
                if PROMPT_RE.search(body):
                    continue
                if '...' in body or 'ELLIPSIS' in body:
                    continue
                if not body.strip():
                    continue
                progs.append({'file': rel, 'key': f'{lang}-block-{idx}', 'code': body})
    return progs


def run_set(progs, outname):
    from concurrent.futures import ThreadPoolExecutor
    cats = Counter()
    details = defaultdict(list)

    def work(p):
        rc, out, err = aref.run_one(p['code'])
        return p, aref.classify(p['code'], rc, out, err)

    done = 0
    with ThreadPoolExecutor(max_workers=8) as ex:
        for p, (cat, info) in ex.map(work, progs):
            cats[cat] += 1
            if cat != 'ok':
                details[cat].append({'file': p['file'], 'key': p['key'],
                                     'info': info, 'code': p['code'][:300]})
            done += 1
            if done % 500 == 0:
                print(f'  ...{done}/{len(progs)}', file=sys.stderr)
    print(f'\n== RUN ({len(progs)} programs) ==')
    for c, n in cats.most_common():
        print(f'  {c:<20s} {n}')
    Path(f'scratch/{outname}').write_text(json.dumps(
        {'counts': dict(cats), 'details': details}, indent=2))
    print(f'  -> scratch/{outname}')


def run_chapter_scoped(progs, outname):
    """Chapter-scoped runner. Books build `define`s across successive blocks in
    one chapter (file); running each block STANDALONE breaks that narrative
    thread and manufactures phantom failures. Here, for each runnable block we
    PREPEND every earlier runnable block of the SAME FILE in document order,
    then run the concatenation. A block that only failed because an earlier
    `define` was out of scope now sees it — so a standalone-fail that flips to
    chapter-pass is a PHANTOM (isolation artifact); a standalone-fail that STAYS
    failing under chapter scope is REAL (missing verb / genuine bug).

    Also runs each block standalone (via the same block set) so we can diff.
    """
    from concurrent.futures import ThreadPoolExecutor
    from collections import OrderedDict

    # group blocks by file, preserving extraction (document) order
    by_file = OrderedDict()
    for p in progs:
        by_file.setdefault(p['file'], []).append(p)

    # build one work item per block: (block, prefix_code)
    items = []
    for f, blocks in by_file.items():
        prefix_parts = []
        for i, p in enumerate(blocks):
            prefix = '\n'.join(prefix_parts)
            scoped = (prefix + '\n' + p['code']) if prefix else p['code']
            items.append({'p': p, 'standalone': p['code'], 'scoped': scoped,
                          'pos': i, 'nprefix': len(prefix_parts)})
            prefix_parts.append(p['code'])

    def work(it):
        rc1, o1, e1 = aref.run_one(it['standalone'])
        c1, i1 = aref.classify(it['standalone'], rc1, o1, e1)
        # only pay for the (slower) scoped run when standalone failed
        if c1 == 'ok' or it['nprefix'] == 0:
            return it, c1, i1, c1, i1
        rc2, o2, e2 = aref.run_one(it['scoped'])
        c2, i2 = aref.classify(it['scoped'], rc2, o2, e2)
        return it, c1, i1, c2, i2

    standalone_cats = Counter()
    scoped_cats = Counter()
    phantom = []       # failed standalone, passes when chapter-scoped
    real = defaultdict(list)  # failed both -> genuine (by scoped category)
    done = 0
    total = len(items)
    with ThreadPoolExecutor(max_workers=8) as ex:
        for it, c1, i1, c2, i2 in ex.map(work, items):
            standalone_cats[c1] += 1
            scoped_cats[c2] += 1
            if c1 != 'ok':
                if c2 == 'ok':
                    phantom.append({'file': it['p']['file'], 'key': it['p']['key'],
                                    'standalone_cat': c1, 'standalone_info': i1})
                else:
                    real[c2].append({'file': it['p']['file'], 'key': it['p']['key'],
                                     'scoped_cat': c2, 'scoped_info': i2,
                                     'standalone_cat': c1,
                                     'code': it['p']['code'][:300]})
            done += 1
            if done % 500 == 0:
                print(f'  ...{done}/{total}', file=sys.stderr)

    sa_fail = total - standalone_cats.get('ok', 0)
    sc_fail = total - scoped_cats.get('ok', 0)
    n_phantom = len(phantom)
    n_real = sum(len(v) for v in real.values())
    print(f'\n== CHAPTER-SCOPED RUN ({total} blocks across {len(by_file)} files) ==')
    print(f'  standalone fails : {sa_fail}')
    print(f'  chapter fails    : {sc_fail}')
    print(f'  -> PHANTOM (isolation artifact, flips to pass): {n_phantom}')
    print(f'  -> REAL     (still fails chapter-scoped)      : {n_real}')
    print('  real by category:')
    for c, v in sorted(real.items(), key=lambda kv: -len(kv[1])):
        print(f'     {c:<18s} {len(v)}')
    Path(f'scratch/{outname}').write_text(json.dumps({
        'total_blocks': total, 'files': len(by_file),
        'standalone_fail': sa_fail, 'chapter_fail': sc_fail,
        'phantom_count': n_phantom, 'real_count': n_real,
        'standalone_cats': dict(standalone_cats), 'scoped_cats': dict(scoped_cats),
        'phantom': phantom, 'real': real,
    }, indent=2))
    print(f'  -> scratch/{outname}')


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else 'extract'
    if mode == 'prose':
        progs = extract_prose_blocks()
        by_file = Counter(p['file'] for p in progs)
        print(f'Runnable prose blocks: {len(progs)} across {len(by_file)} files')
        run_set(progs, 'audit-books-prose.json')
        return
    if mode == 'chapter':
        # chapter-scoped: concatenate a chapter's runnable blocks in order
        # before running, to separate phantom (isolation) fails from real ones.
        source = sys.argv[2] if len(sys.argv) > 2 else 'prose'
        if source == 'code':
            progs = extract_programs()
        else:
            progs = extract_prose_blocks()
        by_file = Counter(p['file'] for p in progs)
        print(f'Chapter-scoped over {len(progs)} blocks across {len(by_file)} files '
              f'(source={source})')
        run_chapter_scoped(progs, f'audit-books-chapter-{source}.json')
        return
    progs = extract_programs()
    by_file = Counter(p['file'] for p in progs)
    print(f'Runnable code fields: {len(progs)} across {len(by_file)} files')

    if mode == 'extract':
        for f in sorted(by_file):
            print(f'  {f:<60s} {by_file[f]}')
        return

    if mode == 'run':
        from concurrent.futures import ThreadPoolExecutor
        cats = Counter()
        details = defaultdict(list)

        def work(p):
            rc, out, err = aref.run_one(p['code'])
            return p, aref.classify(p['code'], rc, out, err)

        done = 0
        with ThreadPoolExecutor(max_workers=8) as ex:
            for p, (cat, info) in ex.map(work, progs):
                cats[cat] += 1
                if cat != 'ok':
                    details[cat].append({'file': p['file'], 'key': p['key'],
                                         'info': info, 'code': p['code'][:300]})
                done += 1
                if done % 100 == 0:
                    print(f'  ...{done}/{len(progs)}', file=sys.stderr)
        print(f'\n== RUN ({len(progs)} programs) ==')
        for c, n in cats.most_common():
            print(f'  {c:<20s} {n}')
        Path('scratch/audit-books-run.json').write_text(json.dumps(
            {'counts': dict(cats), 'details': details}, indent=2))
        print('  -> scratch/audit-books-run.json')


if __name__ == '__main__':
    main()
