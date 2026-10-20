#!/usr/bin/env python3
"""verify.py — run every program in programs.py through ./bin/motoi and
report the exact output (or the failure). No program enters the reference
until it appears here with a clean exit and a sane value."""
import subprocess, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from programs import ALL

ROOT = '/Users/alfred/code/motoi-scheme'
TMP = '/tmp/motoi-physics-ref-check.scm'

only = sys.argv[1] if len(sys.argv) > 1 else None
fails = 0
total = 0
for verb, progs in ALL.items():
    if only and only != verb:
        continue
    print(f'══ {verb}')
    for key, src in progs.items():
        total += 1
        with open(TMP, 'w') as fh:
            fh.write(src + '\n')
        r = subprocess.run([f'{ROOT}/bin/motoi', 'run', TMP],
                           capture_output=True, text=True, cwd=ROOT, timeout=60)
        out = (r.stdout or '').strip().replace('\n', ' | ')
        err = (r.stderr or '').strip().replace('\n', ' | ')
        bad = r.returncode != 0 or 'error' in err.lower() or 'unbound' in out.lower()
        if bad:
            fails += 1
            print(f'  FAIL {key}: rc={r.returncode} out={out!r} err={err!r}')
        else:
            print(f'  ok   {key}: {out}')
print(f'\n{total} programs, {fails} failing')
sys.exit(1 if fails else 0)
