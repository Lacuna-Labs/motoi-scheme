#!/usr/bin/env python3
"""audit-ref.py — extract + (optionally) run every program field in the Motoi
reference, classifying failures into real bugs vs illustrative fragments.

Program-bearing fields (per 15-program standard):
  Row 1  :examples        -> :code
  Row 2  :row-2-audit     -> :eng-program / :math-program / :cs-program
  Row 3  :row-3-dimension -> :code
  Row 4  :row-4-proof     -> :eng-program / :math-program / :cs-program
  Row 5  :row-5-emergence -> :eng-composition / :math-composition / :cs-composition

Usage:
  python3 scratch/audit-ref.py extract          # count + dump program inventory
  python3 scratch/audit-ref.py static            # static-only checks (fast)
  python3 scratch/audit-ref.py run [--limit N]   # execute each program, classify
"""
from __future__ import annotations
import json, re, sys, subprocess, tempfile, os
from pathlib import Path
from collections import defaultdict, Counter

REPO = Path('/Users/alfred/code/motoi-scheme')
REF = REPO / 'scheme' / 'reference'
MOTOI = str(REPO / 'bin' / 'motoi')

sys.path.insert(0, str(REPO / 'scratch'))
import importlib.util
_spec = importlib.util.spec_from_file_location('drv', str(REPO / 'scratch' / 'ref-fill-driver.py'))
drv = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(drv)

# fields that carry runnable code, and the section they live in
CODE_KEYS = ('code',)
PROG_KEYS = ('eng-program', 'math-program', 'cs-program', 'program')
COMP_KEYS = ('eng-composition', 'math-composition', 'cs-composition', 'composition')
ALL_KEYS = CODE_KEYS + PROG_KEYS + COMP_KEYS


def read_string_literal(text, i):
    """text[i] must be the opening quote. Return (decoded, end_index_after_quote)."""
    assert text[i] == '"'
    out = []
    j = i + 1
    while j < len(text):
        c = text[j]
        if c == '\\':
            nxt = text[j + 1] if j + 1 < len(text) else ''
            out.append({'n': '\n', 't': '\t', 'r': '\r', '"': '"', '\\': '\\'}.get(nxt, nxt))
            j += 2
            continue
        if c == '"':
            return ''.join(out), j + 1
        out.append(c)
        j += 1
    return ''.join(out), j


def extract_programs():
    """Yield dicts: file, verb, key, value(code). Order = document order."""
    progs = []
    key_re = re.compile(r':(' + '|'.join(re.escape(k) for k in ALL_KEYS) + r')\s*"')
    for path in sorted(REF.glob('*.slat')):
        text = path.read_text()
        for v in drv.extract_verb_forms(text):
            nm = re.search(r':name\s+"([^"]+)"', v)
            if not nm:
                continue
            verb = nm.group(1)
            for m in key_re.finditer(v):
                key = m.group(1)
                qpos = m.end() - 1
                code, _ = read_string_literal(v, qpos)
                progs.append({'file': path.name, 'verb': verb, 'key': key, 'code': code})
    return progs


def paren_delta(code):
    depth = 0; ins = False; esc = False
    for c in code:
        if ins:
            if esc: esc = False
            elif c == '\\': esc = True
            elif c == '"': ins = False
        else:
            if c == '"': ins = True
            elif c == '(': depth += 1
            elif c == ')': depth -= 1
    return depth


CORRUPTION_MARKERS = (':provenance', ':note "', ':dialect', ':tier "', ':summary')


def static_checks(progs):
    imbalance = []
    corruption = []
    charlit = []
    empty = []
    for p in progs:
        code = p['code']
        if not code.strip():
            empty.append(p); continue
        d = paren_delta(code)
        if d != 0:
            imbalance.append((p, d))
        for mk in CORRUPTION_MARKERS:
            if mk in code:
                corruption.append((p, mk)); break
        if re.search(r'#\\', code):
            charlit.append(p)
    return imbalance, corruption, charlit, empty


# The CLI default is 200,000 (src/cli.js:200). The book audit prepends every
# earlier block in a chapter as a cumulative prefix, so a late block in a long
# chapter re-executes everything before it and exhausts that budget on chapter
# LENGTH rather than on any defect. 430 of the 1,119 reported book failures were
# this and nothing else. AUDIT_FUEL overrides for anyone who wants the old number.
AUDIT_FUEL = os.environ.get('AUDIT_FUEL', '2000000000')


def run_one(code, timeout=15):
    # Every run gets its OWN empty MOTOI_HOME.
    #
    # Cortex persists: `cortex/record` appends to `$MOTOI_HOME/copilot/cortex.slatl`
    # (src/paths.js:18,33), and MOTOI_HOME defaults to ~/motoi. With no isolation
    # the gate was writing into the developer's real store and READING IT BACK, so
    # every cortex claim in the corpus measured "however many times this gate has
    # ever run on this machine" instead of what the chapter does. Watched live:
    #
    #   (length (cortex/query :subject 'reader :predicate 'preferred-color))
    #   book claims 1; gate said 12, then 34, then 45 — same code, same day.
    #
    # That is an answer-shaped nothing of the worst kind, because it is PLAUSIBLE:
    # splicing it in would have written a machine-and-date-specific number into the
    # corpus as if it were a fact about the language, and the next run would
    # disagree with it. A fresh home makes the chapter's own prefix the only writer,
    # which is what a reader following along actually has.
    #
    # BOOK_AUDIT_HOME=shared restores the old behavior for anyone who wants it.
    try:
        env = dict(os.environ)
        if env.get('BOOK_AUDIT_HOME') == 'shared':
            r = subprocess.run([MOTOI, 'run', '--fuel', AUDIT_FUEL, '/dev/stdin'],
                               input=code, capture_output=True, text=True, timeout=timeout)
            return r.returncode, (r.stdout or ''), (r.stderr or '')
        with tempfile.TemporaryDirectory(prefix='motoi-audit-') as home:
            env['MOTOI_HOME'] = home
            r = subprocess.run([MOTOI, 'run', '--fuel', AUDIT_FUEL, '/dev/stdin'],
                               input=code, capture_output=True, text=True,
                               timeout=timeout, env=env)
            return r.returncode, (r.stdout or ''), (r.stderr or '')
    except subprocess.TimeoutExpired:
        return -99, '', 'TIMEOUT'


def classify(code, rc, out, err):
    blob = (err + out).strip()
    first = blob.splitlines()[0] if blob else ''
    if rc == -99:
        return 'timeout', first
    if 'error:' not in blob.lower() and rc == 0:
        return 'ok', ''
    low = blob.lower()
    m = re.search(r'unbound symbol:\s*(\S+)', blob)
    if m:
        sym = m.group(1)
        if sym.startswith('#\\'):
            return 'reader-charlit', sym
        if '/' in sym:
            return 'unbound-verb', sym
        return 'unbound-freevar', sym
    if 'missing )' in low or 'unexpected' in low or 'unterminated' in low or 'eof' in low:
        return 'parse-error', first
    if 'error:' in low:
        return 'runtime-error', first
    return 'other', first


# symbols that are genuine engine/reader gaps, NOT illustrative free variables.
# an unbound-freevar hit on one of these is a real defect worth preserving.
REAL_GAP_SYMS = {
    'fold-left', 'foldl', 'fold-right', 'foldr', 'reduce-right',
    '+inf.0', '-inf.0', '+nan.0', 'honest-null',
    'read', 'read-char', 'read-line', 'peek-char', 'read-string',
    'list-head', 'last-pair', 'list-copy', 'take', 'drop',
    'string-split', 'string-join', 'char-ready?',
}


def bucket_of(category, info):
    """defect = usefully broken (real problem). fragment = intentional free-var snippet."""
    if category == 'ok':
        return 'ok'
    if category == 'unbound-freevar':
        sym = info.strip()
        if sym in REAL_GAP_SYMS or '/' in sym or sym.startswith(('+', '-')) and sym[-2:] == '.0':
            return 'defect'
        return 'fragment'
    if category == 'unbound-verb':
        # fraction misread by reader (no rational literals) = defect; real cross-ref = defect too
        return 'defect'
    if category in ('parse-error', 'runtime-error', 'reader-charlit', 'timeout'):
        return 'defect'
    return 'defect'


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else 'extract'
    if mode == 'preserve':
        from concurrent.futures import ThreadPoolExecutor
        progs = extract_programs()
        outdir = REPO / '_status' / 'teaching-cases' / 'ref-audit-2026-07-24'
        outdir.mkdir(parents=True, exist_ok=True)
        rows = []

        def work(item):
            i, p = item
            rc, out, err = run_one(p['code'])
            cat, info = classify(p['code'], rc, out, err)
            return i, p, cat, info, (err + out).strip()

        cats = Counter(); buckets = Counter()
        done = 0
        with ThreadPoolExecutor(max_workers=8) as ex:
            for i, p, cat, info, blob in ex.map(work, enumerate(progs)):
                cats[cat] += 1
                b = bucket_of(cat, info)
                buckets[b] += 1
                if b == 'defect':
                    rows.append({'idx': i, 'file': p['file'], 'verb': p['verb'],
                                 'key': p['key'], 'category': cat, 'error': info,
                                 'broken_code': p['code'], 'runner_output': blob[:600]})
                done += 1
                if done % 2000 == 0:
                    print(f'  ...{done}/{len(progs)}', file=sys.stderr)
        rows.sort(key=lambda r: r['idx'])
        jf = outdir / 'usefully-broken-programs.jsonl'
        with jf.open('w') as fh:
            for r in rows:
                fh.write(json.dumps(r) + '\n')
        # per-category tallies for the README
        defect_by_cat = Counter(r['category'] for r in rows)
        defect_by_file = Counter(r['file'] for r in rows)
        summary = {
            'generated': __import__('datetime').datetime.now().isoformat(timespec='seconds'),
            'total_programs': len(progs), 'categories': dict(cats),
            'buckets': dict(buckets), 'defect_by_category': dict(defect_by_cat),
            'defect_by_file': dict(defect_by_file.most_common()),
        }
        (outdir / 'summary.json').write_text(json.dumps(summary, indent=2))
        print(f'\nPreserved {len(rows)} usefully-broken programs -> {jf}')
        print(f'Buckets: {dict(buckets)}')
        print(f'Defect by category: {dict(defect_by_cat)}')
        return
    progs = extract_programs()
    by_file = Counter(p['file'] for p in progs)
    print(f'Programs extracted: {len(progs)} across {len(by_file)} files, '
          f'{len(set(p["verb"] for p in progs))} verbs')

    if mode == 'extract':
        for f in sorted(by_file):
            print(f'  {f:<32s} {by_file[f]}')
        return

    if mode in ('static', 'run'):
        imb, corr, chl, emp = static_checks(progs)
        print(f'\n== STATIC ==')
        print(f'  paren-imbalanced code strings: {len(imb)}')
        print(f'  corruption-marker in code:     {len(corr)}')
        print(f'  #\\ char-literal usage:         {len(chl)}')
        print(f'  empty code strings:            {len(emp)}')
        Path('scratch/audit-static.json').write_text(json.dumps({
            'imbalance': [{'file': p['file'], 'verb': p['verb'], 'key': p['key'], 'delta': d,
                           'code': p['code'][:400]} for p, d in imb],
            'corruption': [{'file': p['file'], 'verb': p['verb'], 'key': p['key'], 'marker': mk,
                            'code': p['code'][:400]} for p, mk in corr],
            'charlit': [{'file': p['file'], 'verb': p['verb'], 'key': p['key'],
                         'code': p['code'][:400]} for p in chl],
            'empty': [{'file': p['file'], 'verb': p['verb'], 'key': p['key']} for p in emp],
        }, indent=2))
        print('  -> scratch/audit-static.json')

    if mode == 'run':
        from concurrent.futures import ThreadPoolExecutor
        limit = None
        if '--limit' in sys.argv:
            limit = int(sys.argv[sys.argv.index('--limit') + 1])
        target = progs[:limit] if limit else progs
        cats = Counter()
        details = defaultdict(list)

        def work(p):
            rc, out, err = run_one(p['code'])
            return p, classify(p['code'], rc, out, err)

        done = 0
        with ThreadPoolExecutor(max_workers=8) as ex:
            for p, (cat, info) in ex.map(work, target):
                cats[cat] += 1
                if cat != 'ok':
                    details[cat].append({'file': p['file'], 'verb': p['verb'],
                                         'key': p['key'], 'info': info, 'code': p['code'][:300]})
                done += 1
                if done % 1000 == 0:
                    print(f'  ...{done}/{len(target)}', file=sys.stderr)
        print(f'\n== RUN ({len(target)} programs) ==')
        for c, n in cats.most_common():
            print(f'  {c:<20s} {n}')
        Path('scratch/audit-run.json').write_text(json.dumps(
            {'counts': dict(cats), 'details': details}, indent=2))
        print('  -> scratch/audit-run.json')


if __name__ == '__main__':
    main()
