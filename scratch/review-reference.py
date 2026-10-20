#!/usr/bin/env python3
"""Extract every :code and :program string from the reference chapters and run each
through ./bin/motoi. Parallel across cores. Writes a compact pass/fail report.
Local CPU only — no cloud cost."""
import re, subprocess, pathlib, sys, json
from concurrent.futures import ProcessPoolExecutor

REF = pathlib.Path("scheme/reference")
MOTOI = ["./bin/motoi", "run", "/dev/stdin"]

def scan_strings(text, keyword):
    """Yield string literals that follow `:keyword` in a slat file, unescaped."""
    out = []
    i = 0
    kw = ":" + keyword
    while True:
        j = text.find(kw, i)
        if j < 0:
            break
        k = j + len(kw)
        # skip whitespace to the opening quote
        while k < len(text) and text[k] in " \t\r\n":
            k += 1
        if k >= len(text) or text[k] != '"':
            i = j + len(kw)
            continue
        k += 1
        buf = []
        while k < len(text):
            c = text[k]
            if c == "\\" and k + 1 < len(text):
                nxt = text[k+1]
                buf.append({'n':'\n','t':'\t','"':'"','\\':'\\'}.get(nxt, nxt))
                k += 2
                continue
            if c == '"':
                break
            buf.append(c)
            k += 1
        out.append("".join(buf))
        i = k + 1
    return out

def collect():
    items = []  # (chapter, idx, code)
    for path in sorted(REF.glob("*.slat")):
        t = path.read_text()
        codes = scan_strings(t, "code") + scan_strings(t, "program")
        for n, c in enumerate(codes):
            if c.strip() and "(" in c and ")" in c:
                items.append((path.name, n, c))
    return items

def run_one(item):
    name, n, code = item
    try:
        p = subprocess.run(MOTOI, input=code, capture_output=True, text=True, timeout=25)
        return (name, n, code, p.returncode, ((p.stdout or "")+(p.stderr or "")).strip())
    except subprocess.TimeoutExpired:
        return (name, n, code, 124, "TIMEOUT")

def main():
    items = collect()
    print(f"collected {len(items)} runnable code slots across reference chapters", flush=True)
    results = []
    with ProcessPoolExecutor(max_workers=8) as ex:
        for r in ex.map(run_one, items, chunksize=8):
            results.append(r)
    fails = [r for r in results if r[3] != 0]
    # aggregate failures by chapter + by error signature
    by_chapter = {}
    for name, n, code, rc, out in fails:
        by_chapter[name] = by_chapter.get(name, 0) + 1
    print(f"\nTOTAL={len(results)} PASS={len(results)-len(fails)} FAIL={len(fails)}", flush=True)
    print("\n--- failures per chapter ---")
    for name in sorted(by_chapter, key=lambda k: -by_chapter[k]):
        print(f"  {by_chapter[name]:4d}  {name}")
    # dump full failures to json for fixing
    with open("scratch/reference-failures.json", "w") as f:
        json.dump([{"chapter":a,"idx":b,"code":c,"err":e} for a,b,c,_,e in fails], f, indent=1)
    print("\nfull failure detail -> scratch/reference-failures.json")

if __name__ == "__main__":
    main()
