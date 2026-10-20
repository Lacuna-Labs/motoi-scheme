#!/usr/bin/env python3
"""Rewrite `(entity/ref X 'hp)` -> `(entity/hp X)` on the lines where the
example writes the hp SLOT (entity/hp! / entity/damage!) and then reads it back.

Evidence: 24-entity.slat's own records separate the two stores —
  entity/ref  : "Retrieve a per-entity SCRATCH value by key"
  entity/hp!  : :meta "entity/set! is generic scratch; hp! is the slot tied to
                 damage/death"
  entity/hp   : "(entity/hp entity) -> integer / Read an entity's current hit
                 points", :impl-status "wired"
and lib/game/world.js writes e.hp in hp!/damage! but e.scratch in set!.
So `(entity/ref e 'hp)` after `(entity/hp! e 50)` is always 'nan.

Line 596 is deliberately EXCLUDED: it calls (entity/set! hero 'hp 100), i.e.
genuine scratch usage, and is correct as written.
"""
import re, sys

PATH = 'scheme/reference/24-entity.slat'
LINES = [256, 269, 283, 284, 301, 310, 311, 820, 832]

with open(PATH) as f:
    lines = f.readlines()

pat = re.compile(r"\(entity/ref\s+([A-Za-z0-9_\-]+)\s+'hp\)")
n = 0
for ln in LINES:
    old = lines[ln - 1]
    new, k = pat.subn(r'(entity/hp \1)', old)
    if k == 0:
        print(f'!! no match on line {ln}', file=sys.stderr)
    lines[ln - 1] = new
    n += k

# line 269 targets a bare id (8) that resolves to no entity, so hp!/damage!
# were both no-ops. Give it a real handle.
lines[268] = lines[268].replace(
    "(define enemy 8)\\n", "(define enemy (world/spawn 'enemy 0 0))\\n")

with open(PATH, 'w') as f:
    f.writelines(lines)
print(f'rewrote {n} scratch-hp reads')
