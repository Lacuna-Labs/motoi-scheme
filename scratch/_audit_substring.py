#!/usr/bin/env python3
"""Extract every (substring ...) CALL SITE in the corpus, unescaped, and
statically classify the ones whose arguments are all literals.

Output is meant to be READ, not summed blindly.
"""
import os, re, json, sys, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CORPUS_DIRS = ["scheme", "scheme-books", "word-books", "carts", "graphs",
               "training-data", "training", "modules", "rosetta", "site",
               "engineering", "Spec", "words", "scratch/sft-plans"]
EXTS = {".slat", ".slatl", ".sks", ".jsonl", ".scm", ".md", ".json", ".txt"}

def corpus_files():
    seen = set()
    for d in CORPUS_DIRS:
        p = os.path.join(ROOT, d)
        if not os.path.isdir(p):
            continue
        for dp, dn, fn in os.walk(p):
            dn[:] = [x for x in dn if x not in ("node_modules", ".git")]
            for f in sorted(fn):
                if os.path.splitext(f)[1].lower() in EXTS:
                    fp = os.path.realpath(os.path.join(dp, f))
                    if fp not in seen:
                        seen.add(fp); yield fp

def unescape(t):
    # single left-to-right pass, same fix as compliance-check-runnable.py
    out = []; i = 0
    while i < len(t):
        c = t[i]
        if c == "\\" and i + 1 < len(t):
            n = t[i+1]
            if n == "n": out.append("\n"); i += 2; continue
            if n == "t": out.append("\t"); i += 2; continue
            if n == '"': out.append('"'); i += 2; continue
            if n == "\\": out.append("\\"); i += 2; continue
        out.append(c); i += 1
    return "".join(out)

def balanced(text, start):
    """Return the balanced s-expr beginning at index start (a '('), or None."""
    depth = 0; i = start; instr = False
    while i < len(text):
        c = text[i]
        if instr:
            if c == "\\": i += 2; continue
            if c == '"': instr = False
        else:
            if c == '"': instr = True
            elif c == "(": depth += 1
            elif c == ")":
                depth -= 1
                if depth == 0:
                    return text[start:i+1]
        i += 1
        if i - start > 3000: return None
    return None

VERB = sys.argv[1] if len(sys.argv) > 1 else "substring"
rx = re.compile(r"\(" + re.escape(VERB) + r"[\s)]")

sites = []
for fp in corpus_files():
    raw = open(fp, encoding="utf-8", errors="replace").read()
    text = unescape(raw)
    rel = os.path.relpath(fp, ROOT)
    for m in rx.finditer(text):
        s = balanced(text, m.start())
        if s is None:
            continue
        line = text.count("\n", 0, m.start()) + 1
        ctx = text[max(0, m.start()-260): m.start()+len(s)+300].replace("\n", " ⏎ ")
        sites.append((rel, line, " ".join(s.split()), ctx))

print(f"### {VERB}: {len(sites)} CALL SITES (balanced-sexp parsed) "
      f"in {len(set(s[0] for s in sites))} files\n")

# static classification for all-literal calls
LIT = re.compile(r'^\(' + re.escape(VERB) + r'\s+"((?:[^"\\]|\\.)*)"\s+(-?\d+)(?:\s+(-?\d+))?\s*\)$')
lit_bad, lit_ok, dyn = [], [], []
for rel, line, s, ctx in sites:
    m = LIT.match(s)
    if m:
        st = m.group(1); a = int(m.group(2)); b = int(m.group(3)) if m.group(3) else None
        n = len(st)
        bad = a < 0 or a > n or (b is not None and (b < 0 or b > n or a > b))
        (lit_bad if bad else lit_ok).append((rel, line, s))
    else:
        dyn.append((rel, line, s, ctx))

print(f"all-literal args : {len(lit_ok)+len(lit_bad)}  "
      f"(in-range {len(lit_ok)} / OUT-OF-RANGE-NOW-RAISES {len(lit_bad)})")
print(f"non-literal args : {len(dyn)}  (need reading)\n")

if lit_bad:
    print("--- LITERAL CALLS THAT NOW RAISE ---")
    for rel, line, s in lit_bad:
        print(f"  {rel}:{line}  {s}")
print()
print("--- ALL CALL SITES (file:line  expr) ---")
by_file = collections.Counter(s[0] for s in sites)
for f, n in by_file.most_common():
    print(f"{n:>5}  {f}")
