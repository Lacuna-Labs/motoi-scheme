#!/usr/bin/env python3
"""Run every reference/book program that mentions `substring` and report any
that now RAISE. substring stopped clamping on 2026-08-02 (R7RS 6.7), so a
program relying on the old clamp is exactly what this has to surface."""
import os, re, sys, subprocess, glob
sys.path.insert(0, 'scripts')
from importlib.machinery import SourceFileLoader
cc = SourceFileLoader('cc', 'scripts/compliance-check-runnable.py')
# reuse the extractor + unescape without running the module's main body
src = open('scripts/compliance-check-runnable.py').read()
ns = {}
exec(compile(src[:src.index('failures = []')], 'cc', 'exec'), ns)
extract_records, get_str_at, unescape, verb_name = (
    ns['extract_records'], ns['get_str_at'], ns['unescape'], ns['verb_name'])

MOTOI = './bin/motoi'
def run(code):
    open('/tmp/subchk.scm','w').write(code)
    try:
        r = subprocess.run([MOTOI,'run','/tmp/subchk.scm'], capture_output=True,
                           timeout=15, text=True, cwd='.')
        return r.returncode == 0, (r.stdout + r.stderr)
    except subprocess.TimeoutExpired:
        return False, '<timeout>'

targets = sorted(glob.glob('scheme/reference/*.slat')) + \
          sorted(glob.glob('scheme-books/*/*.book.slatl'))
checked = 0; bad = []
for path in targets:
    text = open(path, errors='replace').read()
    for tag in ('(verb', '(chapter'):
        for rec in extract_records(text, tag):
            for key in ('program','composition','code','examples','prose'):
                raw = get_str_at(rec, key)
                if not raw: continue
                code = unescape(raw)
                if 'substring' not in code: continue
                for snippet in re.findall(r'\(substring[^\n]*', code):
                    pass
                checked += 1
                ok, out = run(code)
                if not ok and 'substring:' in out:
                    bad.append((path, verb_name(rec), key, out.strip().splitlines()[0][:160]))
print(f'programs mentioning substring, executed: {checked}')
print(f'now failing BECAUSE of substring: {len(bad)}')
for p,v,k,e in bad[:40]:
    print(f'  {p.split("/")[-1]:34s} {v:24s} {k:12s} {e}')
