#!/usr/bin/env python3
"""Stamp a :std provenance field onto every reference verb entry (2026-07-24).

"Type of lib is important metadata. Make sure it's in each verb." — Alfred.

For every (verb :name "NAME" ...) entry in the reference (per-chapter files AND
the canonical monolith), insert  :std "<standard>"  immediately after the name,
where <standard> comes from the deterministic verb->standard map built from the
wired parts registry (scratch/std-map.json): R7RS-small, SRFI-1, SRFI-13,
SRFI-27, SRFI-125. Verbs not in any standard part are Motoi-own console stdlib
-> "Motoi". Idempotent: skips a verb that already has :std.

Usage: python3 scratch/stamp-std.py [--apply]
"""
import re, sys, json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STDMAP = json.loads((ROOT / "scratch" / "std-map.json").read_text())
apply = "--apply" in sys.argv

# match the verb head + its name; \s spans newlines so both single-line
# (chapter) and multi-line (monolith) verb heads match.
VERB = re.compile(r'\(verb\s+:name\s+"([^"]+)"')

targets = sorted((ROOT / "scheme" / "reference").glob("*.slat"))
targets.append(ROOT / "scheme" / "MOTOI-SCHEME-REFERENCE.slat")

grand = {}
for path in targets:
    text = path.read_text(encoding="utf-8")
    out = []
    last = 0
    n = skipped = 0
    dist = {}
    for m in VERB.finditer(text):
        end = m.end()
        # idempotency: already has :std right after the name?
        if re.match(r'\s*:std\b', text[end:end+16]):
            skipped += 1
            continue
        name = m.group(1)
        std = STDMAP.get(name, "Motoi")
        out.append(text[last:end])
        out.append(f' :std "{std}"')
        last = end
        n += 1
        dist[std] = dist.get(std, 0) + 1
    out.append(text[last:])
    if n and apply:
        path.write_text("".join(out), encoding="utf-8")
    for k, v in dist.items():
        grand[k] = grand.get(k, 0) + v
    if n or skipped:
        print(f"{'STAMP' if apply else 'DRY  '} +{n:4d} (skip {skipped})  {path.name}")

print(f"\n{'APPLIED' if apply else 'DRY RUN'} total stamped:", sum(grand.values()))
print(grand)
