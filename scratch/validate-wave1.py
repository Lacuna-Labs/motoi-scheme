#!/usr/bin/env python3
"""validate-wave1.py — independent verification of wave-1 authoring.

For each touched file: global paren balance (string-aware) + per-target-verb
15-count (real+honest-null) using the SAME balanced-paren counter as the driver.
No trust in agent reports; reads disk.
"""
import sys, json
from pathlib import Path

sys.path.insert(0, str(Path('/Users/alfred/code/motoi-scheme/scratch')))
import importlib.util
spec = importlib.util.spec_from_file_location(
    'drv', '/Users/alfred/code/motoi-scheme/scratch/ref-fill-driver.py')
drv = importlib.util.module_from_spec(spec)
spec.loader.exec_module(drv)

REF = Path('/Users/alfred/code/motoi-scheme/scheme/reference')

# lane file -> target verbs (from lane-batches-next.json snapshot)
PLAN = json.loads(Path('/Users/alfred/code/motoi-scheme/_status/lane-batches-next.json').read_text())
LANES = {L['file']: L['verbs'] for L in PLAN['lanes']}


def paren_balance(text):
    """string-aware paren delta over whole file; 0 == balanced."""
    depth = 0; ins = False; esc = False
    for c in text:
        if ins:
            if esc: esc = False
            elif c == '\\': esc = True
            elif c == '"': ins = False
        else:
            if c == '"': ins = True
            elif c == '(': depth += 1
            elif c == ')': depth -= 1
    return depth


def verb_by_name(text, name):
    for v in drv.extract_verb_forms(text):
        import re
        m = re.search(r':name\s+"([^"]+)"', v)
        if m and m.group(1) == name:
            return v
    return None


problems = []
for fname, verbs in LANES.items():
    text = (REF / fname).read_text()
    bal = paren_balance(text)
    bal_flag = '' if bal == 0 else f'  <<< PAREN DELTA {bal}'
    print(f'\n=== {fname}  (paren delta {bal}){bal_flag} ===')
    if bal != 0:
        problems.append(f'{fname}: whole-file paren delta {bal}')
    for name in verbs:
        v = verb_by_name(text, name)
        if v is None:
            print(f'  MISSING  {name}')
            problems.append(f'{fname}: verb {name} not found by extractor')
            continue
        real, null = drv.count_verb(v)
        total = real + null
        mark = 'OK ' if total >= 15 else '!! '
        if total < 15:
            problems.append(f'{fname}: {name} at {total} (<15)  real={real} null={null}')
        print(f'  {mark}{name:<34s} total={total:>2d}  (real={real} null={null})')

print('\n' + '=' * 60)
if problems:
    print(f'PROBLEMS: {len(problems)}')
    for p in problems:
        print('  - ' + p)
else:
    print('ALL CLEAR: every file paren-balanced, every target verb >=15.')
