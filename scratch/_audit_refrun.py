#!/usr/bin/env python3
"""Run ONLY the reference snippets that mention a target verb, and report which
fail and why. Reuses verify-reference-records.py's own extractor."""
import os, re, sys, glob, collections
from importlib.machinery import SourceFileLoader

ROOT = "/Users/alfred/code/motoi-scheme"
os.chdir(ROOT)
m = SourceFileLoader('vrr', 'scratch/verify-reference-records.py').load_module()

TARGETS = sys.argv[1:] or ["substring", "cons*", "delete-duplicates"]

jobs = []
for path in sorted(glob.glob('scheme/reference/*.slat')):
    if path.endswith('MANIFEST.slat'): continue
    text = open(path).read()
    for rec in m.extract_records(text):
        nm = re.search(r':name\s+"([^"]+)"', rec)
        name = nm.group(1) if nm else '<unnamed>'
        for field, code in m.snippets(rec):
            if any(t in code for t in TARGETS):
                jobs.append((len(jobs), f'{os.path.basename(path)}:{name}', field, code))

print(f'reference snippets mentioning {TARGETS}: {len(jobs)}')
from concurrent.futures import ThreadPoolExecutor
with ThreadPoolExecutor(max_workers=8) as ex:
    results = list(ex.map(m.run_snippet, jobs))

fails = [r for r in results if not r[3]]
print(f'FAILING: {len(fails)}')
byverb = collections.Counter()
for name, field, code, ok, out in fails:
    first = (out.splitlines()[0] if out else '')
    cause = 'OTHER'
    for t in TARGETS:
        if t + ':' in first: cause = t
    byverb[cause] += 1
    print(f'\n--- [{cause}] {name} [:{field}]\n    {code.splitlines()[0][:100]}\n    -> {first[:180]}')
print('\ncause histogram:', dict(byverb))
