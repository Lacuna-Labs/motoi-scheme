#!/usr/bin/env python3
"""Score every @@T assertion in larceny-raw-list.sld.txt against Motoi.

Each expression runs in its own `./bin/motoi eval`, so one blow-up cannot take
the rest of the file with it. @@X is larceny's own answer for the same form.
"""
import json, os, re, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
SRC = os.path.join(REPO, "scratch/r7rs-conformance/larceny-raw-list.sld.txt")

cases = []
lines = open(SRC).read().split("\n")
for i, ln in enumerate(lines):
    if ln.startswith("@@T "):
        exp = None
        for j in range(i + 1, min(i + 4, len(lines))):
            if lines[j].startswith("@@X "):
                exp = lines[j][4:].strip()
                break
        cases.append((len(cases) + 1, ln[4:].strip(), exp))

ENV = dict(os.environ, MOTOI_HOME="/tmp/mx")

def run(c):
    n, expr, exp = c
    try:
        p = subprocess.run([os.path.join(REPO, "bin/motoi"), "eval", expr],
                           capture_output=True, text=True, timeout=30,
                           cwd=REPO, env=ENV)
        out = (p.stdout.strip().split("\n") or [""])[-1].strip()
    except subprocess.TimeoutExpired:
        out = "<timeout>"
    return (n, expr, exp, out)

with ThreadPoolExecutor(max_workers=8) as ex:
    res = list(ex.map(run, cases))

def norm(s):
    return re.sub(r"\s+", " ", (s or "").strip())

fails = []
for n, expr, exp, out in res:
    want = norm(exp)
    if want.startswith("ok "):
        want = want[3:]
    got = norm(out)
    if want != got:
        fails.append((n, expr, want, got))

print(f"{len(res) - len(fails)}/{len(res)} match larceny")
for n, expr, want, got in fails:
    print(f"\n#{n} exp={want!r} act={got!r}\n  {expr[:170]}")
