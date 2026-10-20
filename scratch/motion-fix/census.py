#!/usr/bin/env python3
"""Census: across all chapters, run each scheme block, collect first-unbound-symbol counts."""
import re, subprocess, os, tempfile, glob, collections

ROOT = "/Users/alfred/code/motoi-scheme"
BD = ROOT+"/scheme-books/book-of-motion"

def blocks(path):
    text = open(path).read()
    return [m.group(1).replace('\\"','"').replace('\\\\','\\') for m in re.finditer(r"```scheme\n(.*?)```", text, re.DOTALL)]

def run(code):
    with tempfile.NamedTemporaryFile("w", suffix=".scm", dir=ROOT+"/scratch/motion-fix", delete=False) as f:
        f.write(code); tmp=f.name
    try:
        p = subprocess.run(["./bin/motoi","run",tmp],cwd=ROOT,capture_output=True,text=True,timeout=60)
        return (p.stdout or "")+(p.stderr or "")
    except subprocess.TimeoutExpired: return "TIMEOUT"
    finally: os.unlink(tmp)

sym = collections.Counter()
per_file = {}
for path in sorted(glob.glob(BD+"/*.slatl")):
    bs = blocks(path); npass=nfail=0
    for code in bs:
        out = run(code)
        if "error" in out.lower() or "unbound" in out.lower() or "TIMEOUT" in out:
            nfail+=1
            m = re.search(r"unbound symbol: ([^\s]+)", out)
            if m: sym[m.group(1)]+=1
            else:
                m2 = re.search(r"error: ([^\n]+)", out)
                sym["ERR:"+(m2.group(1)[:30] if m2 else "?")]+=1
        else: npass+=1
    per_file[os.path.basename(path)]=(len(bs),npass,nfail)

print("=== PER FILE (blocks/pass/fail) ===")
for k,(t,p,f) in per_file.items():
    if f: print(f"  {k}: {t}/{p}/{f}")
print("\n=== FIRST-ERROR SYMBOL COUNTS ===")
for s,c in sym.most_common(60): print(f"  {c:4d}  {s}")
tot=sum(t for t,_,_ in per_file.values()); tp=sum(p for _,p,_ in per_file.values()); tf=sum(f for _,_,f in per_file.values())
print(f"\nTOTAL: {tot} blocks, {tp} pass, {tf} fail")
