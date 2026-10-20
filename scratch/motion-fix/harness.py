#!/usr/bin/env python3
"""Extract every ```scheme block from a book-of-motion chapter, run it, report pass/fail."""
import re, subprocess, sys, os, tempfile

ROOT = "/Users/alfred/code/motoi-scheme"
RIPPED_PREFIXES = ("world/","entity/","motion/","scene/","part/","game/",
                   "group/","prefab/","camera/","audio/","note/","sound/")
RIPPED_EXACT = ("synth/play",)

def blocks(path):
    """Yield (index, start_line, code) for each ```scheme fenced block."""
    text = open(path).read()
    out = []
    # find fenced scheme blocks
    idx = 0
    for m in re.finditer(r"```scheme\n(.*?)```", text, re.DOTALL):
        code = m.group(1).replace('\\"','"').replace('\\\\','\\')
        start_line = text[:m.start()].count("\n") + 1
        out.append((idx, start_line, code))
        idx += 1
    return out

def run(code):
    with tempfile.NamedTemporaryFile("w", suffix=".scm", dir=ROOT+"/scratch/motion-fix", delete=False) as f:
        f.write(code)
        tmp = f.name
    try:
        p = subprocess.run(["./bin/motoi","run",tmp], cwd=ROOT,
                           capture_output=True, text=True, timeout=60)
        out = (p.stdout or "") + (p.stderr or "")
        return out
    except subprocess.TimeoutExpired:
        return "TIMEOUT"
    finally:
        os.unlink(tmp)

def ripped_used(code):
    used = set()
    for pre in RIPPED_PREFIXES:
        for m in re.finditer(re.escape(pre)+r"[a-zA-Z0-9!?*/<>=+-]*", code):
            used.add(m.group(0))
    for ex in RIPPED_EXACT:
        if ex in code:
            used.add(ex)
    return used

if __name__ == "__main__":
    path = sys.argv[1]
    if not path.startswith("/"):
        path = os.path.join(ROOT,"scheme-books/book-of-motion",path)
    verbose = "-v" in sys.argv
    bs = blocks(path)
    npass = nfail = 0
    for idx, line, code in bs:
        out = run(code)
        err = ("error:" in out) or ("unbound symbol" in out) or ("TIMEOUT" in out)
        if err:
            nfail += 1
            ru = ripped_used(code)
            firsterr = next((l for l in out.splitlines() if "error" in l.lower() or "unbound" in l.lower()), out.splitlines()[0] if out.splitlines() else "")
            print(f"FAIL block#{idx} @line{line}  ripped={sorted(ru)}  :: {firsterr[:120]}")
            if verbose:
                print("     CODE:", repr(code[:200]))
        else:
            npass += 1
    print(f"\n{os.path.basename(path)}: {len(bs)} blocks, {npass} pass, {nfail} fail")
