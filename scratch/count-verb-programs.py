#!/usr/bin/env python3
"""Certify the '15 programs per verb' claim — schema-aware + honest-null-aware.
Every verb carries example/row program slots under several key names:
  :code            (the 3 :examples: novice/intermediate/expert)
  :eng-program :math-program :cs-program   (row-2..5, three domains each)
  :program         (legacy/plain)
A slot counts toward 15 whether it holds a real program OR an honest-null
(a deliberate ';; honest-null: ...' marker = 'no corpus signal, no fabrication').
We report BOTH: real-only and real+null (the at-spec number)."""
import re, pathlib, collections

REF = pathlib.Path("scheme/reference")
TARGET = 15
# any key ending in 'code' or 'program', capture its string body
SLOT = re.compile(r':([a-z][a-z0-9-]*?(?:code|program))\s+"((?:[^"\\]|\\.)*)"')

def verb_blocks(text):
    starts = [m.start() for m in re.finditer(r'(?m)^\(verb\b', text)]
    for i, s in enumerate(starts):
        e = starts[i+1] if i+1 < len(starts) else len(text)
        block = text[s:e]
        nm = re.search(r':name\s+"([^"]+)"', block)
        yield (nm.group(1) if nm else "?"), block

def is_null(body):
    return "honest-null" in body[:40] or body.strip().startswith(";; honest-null")

def count_slots(block):
    real = null = 0
    for key, body in SLOT.findall(block):
        if is_null(body):
            null += 1
        else:
            real += 1
    return real, null

rows = []
for path in sorted(REF.glob("*.slat")):
    for name, block in verb_blocks(path.read_text()):
        real, null = count_slots(block)
        rows.append((path.name, name, real, null))

total = len(rows)
def at_spec(r): return r[2] + r[3] >= TARGET   # real+null >= 15
def real_15(r): return r[2] >= TARGET          # real alone >= 15
spec_ok = [r for r in rows if at_spec(r)]
under   = [r for r in rows if not at_spec(r)]

print(f"VERBS={total}")
print(f"at-spec (real+honest-null >= {TARGET}): {len(spec_ok)}  ({100*len(spec_ok)/total:.1f}%)")
print(f"real-only >= {TARGET}:                   {len([r for r in rows if real_15(r)])}")
print(f"UNDER spec (real+null < {TARGET}):        {len(under)}")
tots = [r[2]+r[3] for r in rows]
print(f"total-slots  min={min(tots)} max={max(tots)} mean={sum(tots)/total:.1f}")
reals = [r[2] for r in rows]
print(f"real-slots   min={min(reals)} max={max(reals)} mean={sum(reals)/total:.1f}")

print("\n--- distribution of TOTAL slots (real+null) -> verbs ---")
dist = collections.Counter(r[2]+r[3] for r in rows)
for k in sorted(dist):
    flag = "  <-- UNDER" if k < TARGET else ("  == target" if k == TARGET else "  (over)")
    print(f"  {k:3d} slots : {dist[k]:4d} verbs{flag}")

print(f"\n--- every UNDER-spec verb (chapter : verb : real+null=total) ---")
for ch, name, real, null in sorted(under, key=lambda r:(r[2]+r[3], r[0])):
    print(f"  {real:2d}+{null:2d}={real+null:2d}  {ch:28s} {name}")
