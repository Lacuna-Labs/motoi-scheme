#!/usr/bin/env python3
"""Extract fenced code blocks from scheme-books/*.book.slatl prose (and .sks
carts) that MENTION one of the changed/divergent verbs, execute them, and report
which now fail.  Read-only: writes only to /tmp."""
import os, re, sys, subprocess, glob, collections

ROOT = "/Users/alfred/code/motoi-scheme"
os.chdir(ROOT)

def unescape(t):
    out=[];i=0
    while i<len(t):
        c=t[i]
        if c=="\\" and i+1<len(t):
            n=t[i+1]
            if n=="n": out.append("\n");i+=2;continue
            if n=="t": out.append("\t");i+=2;continue
            if n=='"': out.append('"');i+=2;continue
            if n=="\\": out.append("\\");i+=2;continue
        out.append(c);i+=1
    return "".join(out)

TARGETS = ["substring", "cons*", "delete-duplicates"]

def run(code):
    open('/tmp/_auditrun.scm','w').write(code)
    try:
        r = subprocess.run(['./bin/motoi','run','/tmp/_auditrun.scm'],
                           capture_output=True, timeout=20, text=True)
        return r.returncode == 0, (r.stdout + r.stderr)
    except subprocess.TimeoutExpired:
        return False, '<timeout>'

paths = sorted(glob.glob('scheme-books/*/*.book.slatl')) + \
        sorted(glob.glob('word-books/**/*.slatl', recursive=True))

blocks = []
for p in paths:
    text = unescape(open(p, errors='replace').read())
    for m in re.finditer(r"```(?:scheme|motoi)?\n(.*?)```", text, re.S):
        code = m.group(1)
        if any(t in code for t in TARGETS):
            blocks.append((p, code))

print(f"fenced code blocks mentioning a target verb: {len(blocks)} "
      f"in {len(set(b[0] for b in blocks))} files")

fails = collections.defaultdict(list)
for p, code in blocks:
    ok, out = run(code)
    if not ok:
        first = out.strip().splitlines()[0][:170] if out.strip() else '<no output>'
        cause = 'TARGET' if any(t + ':' in out for t in TARGETS) else 'other'
        fails[cause].append((p, first, code[:120].replace("\n"," ⏎ ")))

print(f"\nfailing: {sum(len(v) for v in fails.values())}")
for cause in ('TARGET','other'):
    print(f"\n--- cause={cause}: {len(fails[cause])} ---")
    for p, err, code in fails[cause]:
        print(f"  {p}\n     code: {code}\n     err : {err}")
