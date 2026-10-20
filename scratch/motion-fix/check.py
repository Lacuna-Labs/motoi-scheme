#!/usr/bin/env python3
"""Verify each ```scheme block runs green. If the chapter contains a 'runtime'
   prelude block (one that defines world/step), prepend THAT block to every
   later block — mirroring how a reader runs the chapter top-to-bottom."""
import re, subprocess, sys, os, tempfile

ROOT="/Users/alfred/code/motoi-scheme"

def blocks(text):
    out=[]
    for i,m in enumerate(re.finditer(r"```scheme\n(.*?)```", text, re.DOTALL)):
        code=m.group(1).replace('\\"','"').replace('\\\\','\\')
        line=text[:m.start()].count("\n")+1
        out.append((i,line,code))
    return out

def run(code):
    with tempfile.NamedTemporaryFile("w",suffix=".scm",dir=ROOT+"/scratch/motion-fix",delete=False) as f:
        f.write(code); tmp=f.name
    try:
        p=subprocess.run(["./bin/motoi","run",tmp],cwd=ROOT,capture_output=True,text=True,timeout=90)
        return (p.stdout or "")+(p.stderr or "")
    except subprocess.TimeoutExpired: return "TIMEOUT"
    finally: os.unlink(tmp)

path=sys.argv[1]
if not path.startswith("/"): path=os.path.join(ROOT,"scheme-books/book-of-motion",path)
verbose="-v" in sys.argv
text=open(path).read()
bs=blocks(text)
# find the runtime/prelude block: the FIRST block defining world/step
prelude=None
for i,line,code in bs:
    if "(define (world/step" in code:
        prelude=code; prelude_idx=i; break
npass=nfail=0
for idx,line,code in bs:
    testcode=code
    if prelude is not None and idx!=prelude_idx and ("world/" in code or "entity/" in code):
        testcode=prelude+"\n"+code
    out=run(testcode)
    bad=("error" in out.lower()) or ("unbound" in out.lower()) or ("TIMEOUT" in out)
    if bad:
        nfail+=1
        fe=next((l for l in out.splitlines() if "error" in l.lower() or "unbound" in l.lower()), (out.splitlines() or [""])[0])
        print(f"FAIL block#{idx} @line{line} :: {fe[:130]}")
        if verbose: print("   CODE:\n     "+code[:500].replace(chr(10),chr(10)+"     "))
    else:
        npass+=1
print(f"\n{os.path.basename(path)}: {len(bs)} blocks, {npass} pass, {nfail} fail  (prelude={'yes' if prelude else 'no'})")
