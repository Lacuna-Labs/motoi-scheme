#!/usr/bin/env python3
"""append.py — render all 23 verb records and append to 39-list.slat."""
import sys, os, importlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import render, TARGET

MODS = ['verbs_a', 'verbs_b', 'verbs_c', 'verbs_d']
verbs = []
for m in MODS:
    verbs.extend(importlib.import_module(m).VERBS)
print('verbs to append: %d' % len(verbs))

text = open(TARGET).read()
existing = text.count('\n(verb\n')
print('existing (verb records: %d' % existing)

names = [v['name'] for v in verbs]
dupes = [n for n in names if ':name "%s"' % n in text]
if dupes:
    sys.exit('ABORT: already present: %s' % dupes)

banner = ('\n;; ═══════════════════════════════════════════════════════════════\n'
          ';; SRFI-1 surface completion — 23 verbs appended 2026-08-02.\n'
          ';; Implemented in lib/std/srfi-1.js; documented against observed\n'
          ';; runtime behavior, not against the SRFI-1 document.\n'
          ';; ═══════════════════════════════════════════════════════════════\n\n')

body = banner + '\n'.join(render(v) for v in verbs)
with open(TARGET, 'a') as f:
    f.write(body)
print('appended %d bytes' % len(body))

# header bump: only the (chapter ...) line
text = open(TARGET).read()
old = '(chapter :number "39" :library "list" :verb-count 15 :training-eligible #t)'
new = '(chapter :number "39" :library "list" :verb-count %d :training-eligible #t)' % (existing + len(verbs))
assert text.count(old) == 1, 'chapter line not found exactly once'
open(TARGET, 'w').write(text.replace(old, new))
print('chapter header -> verb-count %d' % (existing + len(verbs)))
