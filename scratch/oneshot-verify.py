import re, subprocess, sys, os, glob

BOOK = "/Users/alfred/code/motoi-scheme/scheme-books/book-of-one-shot"
MOTOI = "/Users/alfred/code/motoi-scheme/bin/motoi"

# verbs that are intentionally unwired / marked BUILD or [needs:] in prose
UNWIRED = {
    "surface","clock/now","cortex/recall","fetch","store",
    "knowledge/of","world/knowledge","system/registry",
    "escalate",  # exists but throws
}

def blocks(text):
    # find ```scheme ... ``` fenced blocks with their char offsets
    out=[]
    for m in re.finditer(r"```scheme\n(.*?)```", text, re.S):
        out.append((m.start(1), m.group(1)))
    return out

def unescape(code):
    # book.slatl prose escapes quotes and backslashes for the SLAT string literal.
    # single left-to-right pass: \\ -> \ , \" -> "
    out=[]; i=0
    while i < len(code):
        c=code[i]
        if c=='\\' and i+1 < len(code):
            n=code[i+1]
            if n=='\\': out.append('\\'); i+=2; continue
            if n=='"': out.append('"'); i+=2; continue
        out.append(c); i+=1
    return ''.join(out)

def run(code):
    code=unescape(code)
    p = subprocess.run([MOTOI,"run","/dev/stdin"], input=code,
                       capture_output=True, text=True, timeout=30)
    return p.returncode, (p.stdout+p.stderr)

def uses_unwired(code):
    hits=set()
    for v in UNWIRED:
        # word-ish boundary
        if re.search(r"\("+re.escape(v)+r"\b", code):
            hits.add(v)
    return hits

for f in sorted(glob.glob(os.path.join(BOOK,"*.slatl"))):
    text=open(f).read()
    bl=blocks(text)
    if not bl: continue
    base=os.path.basename(f)
    for i,(off,code) in enumerate(bl):
        rc,outp=run(code)
        ok = rc==0 and "unbound symbol" not in outp and "error:" not in outp.lower()
        unw=uses_unwired(code)
        if ok:
            continue
        # failing
        line = text[:off].count("\n")+1
        tag = "UNWIRED("+",".join(sorted(unw))+")" if unw else "REALFAIL"
        firstline=code.strip().split("\n")[0][:70]
        print(f"{base}:L{line} #{i} {tag}: {firstline}")
        if tag=="REALFAIL":
            print("    OUT:", outp.strip().replace("\n"," | ")[:200])
