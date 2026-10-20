import os, re, collections
ROOT = "/Users/alfred/code/motoi-scheme"
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
                    if fp not in seen:
                        seen.add(fp); yield fp

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

def balanced(text,start,cap=4000):
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
        if i-start>cap: return None
    return None

def split_args(s):
    body=s[1:-1]; toks=[];cur="";depth=0;instr=False;i=0
    while i<len(body):
        c=body[i]
        if instr:
            cur+=c
            if c=="\\":
                if i+1<len(body): cur+=body[i+1]
                i+=2;continue
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

_TEXTS = None
def texts():
    global _TEXTS
    if _TEXTS is None:
        _TEXTS = {}
        for fp in corpus_files():
            _TEXTS[os.path.relpath(fp, ROOT)] = unescape(
                open(fp, encoding="utf-8", errors="replace").read())
    return _TEXTS

def sites(verb, minargs=0, maxargs=None):
    out=[]
    for rel, text in texts().items():
        for m in re.finditer(r"\("+re.escape(verb)+r"[\s)]", text):
            s = balanced(text, m.start())
            if not s: continue
            a = split_args(s)[1:]
            if len(a) >= minargs and (maxargs is None or len(a) <= maxargs):
                out.append((rel, " ".join(s.split()), a))
    return out
