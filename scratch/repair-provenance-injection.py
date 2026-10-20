#!/usr/bin/env python3
"""Repair the provenance-injection corruption (2026-07-24).

A prior botched pass injected the fragment  :provenance "scheme/reference/<file>.slat"
mid-string across the per-chapter reference files (698 fragments in 53 files),
truncating :signature and prose strings. The injected value is always the file's
OWN path — never a legitimately-authored provenance value — so removal is safe
and deterministic and restores the original text.

Before editing, each file's authentic (corrupted) state is archived under
_archive/provenance-injection-repair-20260724/ so the broken artifact survives
(No deletes. Ever.).

Usage: python3 scratch/repair-provenance-injection.py [--apply]
Without --apply it is a dry run (reports counts, writes nothing).
"""
import re, sys, os, shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REFDIR = ROOT / "scheme" / "reference"
ARCHIVE = ROOT / "_archive" / "provenance-injection-repair-20260724" / "scheme" / "reference"
FRAG = re.compile(r' :provenance "scheme/reference/[^"]*\.slat"')

apply = "--apply" in sys.argv
total_files = 0
total_frags = 0
for path in sorted(REFDIR.glob("*.slat")):
    text = path.read_text(encoding="utf-8")
    n = len(FRAG.findall(text))
    if n == 0:
        continue
    total_files += 1
    total_frags += n
    print(f"{'REPAIR' if apply else 'DRY   '} {n:4d}  {path.name}")
    if apply:
        ARCHIVE.mkdir(parents=True, exist_ok=True)
        dest = ARCHIVE / path.name
        if not dest.exists():
            shutil.copy2(path, dest)
        path.write_text(FRAG.sub("", text), encoding="utf-8")

print(f"\n{'APPLIED' if apply else 'DRY RUN'}: {total_frags} fragments across {total_files} files")
if not apply:
    print("re-run with --apply to write changes (originals archived first)")
