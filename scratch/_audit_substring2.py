#!/usr/bin/env python3
"""Second pass on substring: classify every call site by RISK of now raising."""
import os, re, collections, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CORPUS_DIRS = ["scheme", "scheme-books", "word-books", "carts", "graphs",
               "training-data", "training", "modules", "rosetta", "site",
               "engineering", "Spec", "words", "scratch/sft-plans"]
EXTS = {".slat", ".slatl", ".sks", ".jsonl", ".scm", ".md", ".json", ".txt"}

def corpus_files():
    seen = set()
    for d in CORPUS_DIRS:
        p = os.path.join(ROOT, d)
        if not os.path.isdir(p): continue
        for dp, dn, fn in os.walk(p):
            dn[:] = [x for x in dn if x not in ("node_modules", ".git")]
            for f in sorted(fn):
                if os.path.splitext(f)[1].lower() in EXTS:
                    fp = os.path.realpath(os.path.join(dp, f))
                    if fp not in seen: seen.add(fp); yield fp

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

def balanced(text,start):
    depth=0;i=start;instr=False
    while i<len(text):
        c=text[i]
        if instr:
            if c=="\\": i+=2;continue
            if c=='"': instr=False
        else:
            if c=='"': instr=True
            elif c=="(": depth+=1
            elif c==")":
                depth-=1
                if depth==0: return text[start:i+1]
        i+=1
        if i-start>3000: return None
    return None

def split_args(s):
    """split the balanced sexp body into top-level tokens"""
    body = s[1:-1]
    toks=[];cur="";depth=0;instr=False;i=0
    while i<len(body):
        c=body[i]
        if instr:
            cur+=c
            if c=="\\": cur+=body[i+1];i+=2;continue
            if c=='"': instr=False
            i+=1;continue
        if c=='"': instr=True;cur+=c;i+=1;continue
        if c=="(": depth+=1;cur+=c;i+=1;continue
        if c==")": depth-=1;cur+=c;i+=1;continue
        if c.isspace() and depth==0:
            if cur: toks.append(cur);cur=""
            i+=1;continue
        cur+=c;i+=1
    if cur: toks.append(cur)
    return toks

rx = re.compile(r"\(substring[\s)]")
rows=[]
for fp in corpus_files():
    text = unescape(open(fp,encoding="utf-8",errors="replace").read())
    rel = os.path.relpath(fp, ROOT)
    for m in rx.finditer(text):
        s = balanced(text, m.start())
        if s is None: continue
        toks = split_args(s)
        args = toks[1:]
        end = args[2] if len(args)>2 else None
        start_a = args[1] if len(args)>1 else None
        rows.append((rel, " ".join(s.split()), start_a, end))

def cls(start_a, end):
    if end is None: cat="2-ARG(no end)"
    elif re.fullmatch(r"-?\d+", end or ""): cat="end=literal"
    elif "min" in (end or ""): cat="end=min-guarded"
    elif "string-length" in (end or ""): cat="end=string-length-expr"
    else: cat="end=computed"
    neg = "NEG?" if (start_a and not re.fullmatch(r"\d+", start_a) and "-" in start_a) else ""
    return cat + (" "+neg if neg else "")

cats = collections.Counter()
for rel, s, a, e in rows:
    cats[cls(a,e)] += 1

print(f"TOTAL substring call sites: {len(rows)}\n")
for k,v in cats.most_common(): print(f"{v:>5}  {k}")

print("\n\n=== end=computed  (the risk class) ===")
for rel,s,a,e in rows:
    if cls(a,e).startswith("end=computed"):
        print(f"  {rel}\n      {s[:200]}")
print("\n\n=== end=string-length-expr ===")
for rel,s,a,e in rows:
    if cls(a,e).startswith("end=string-length-expr"):
        print(f"  {rel}\n      {s[:200]}")
print("\n\n=== 2-ARG with non-literal start ===")
for rel,s,a,e in rows:
    if e is None and a and not re.fullmatch(r"\d+", a):
        print(f"  {rel}\n      {s[:200]}")
