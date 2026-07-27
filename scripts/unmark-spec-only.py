#!/usr/bin/env python3
"""unmark-spec-only.py — reverse the spec-only sweep on files whose verbs
are now wired. Removes the two-line `\n     :runs "spec-only"` insertion
inserted by mark-unwired-spec-only.py.
"""
import os, re

REF_DIR = '/Users/alfred/code/motoi-scheme/scheme/reference'
FILES = [
    '13-chem.slat', '14-collision.slat', '21-domain.slat', '25-exact.slat',
    '27-floor.slat', '31-group.slat', '45-num.slat', '49-pattern.slat',
    '53-prefab.slat', '54-route.slat', '68-transport.slat', '71-weather.slat',
]

MARK = '\n     :runs "spec-only"'
edits = 0
for fn in FILES:
    path = os.path.join(REF_DIR, fn)
    if not os.path.exists(path):
        print(f'SKIP {fn}'); continue
    text = open(path).read()
    if MARK not in text:
        print(f'{fn}: no marker present')
        continue
    n = text.count(MARK)
    new_text = text.replace(MARK, '')
    with open(path, 'w') as f: f.write(new_text)
    edits += n
    print(f'{fn}: removed {n} markers')
print(f'\nTotal markers removed: {edits}')
