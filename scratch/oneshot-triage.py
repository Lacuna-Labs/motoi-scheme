import re, subprocess, os, glob

BOOK = "/Users/alfred/code/motoi-scheme/scheme-books/book-of-one-shot"
MOTOI = "/Users/alfred/code/motoi-scheme/bin/motoi"

def unescape(code):
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
    p=subprocess.run([MOTOI,"run","/dev/stdin"],input=unescape(code),
                     capture_output=True,text=True,timeout=30)
    return p.returncode,(p.stdout+p.stderr)

for f in sorted(glob.glob(os.path.join(BOOK,"*.slatl"))):
    text=open(f).read()
    base=os.path.basename(f)
    for m in re.finditer(r"```scheme\n(.*?)```", text, re.S):
        code=m.group(1); off=m.start(1); endoff=m.end()
        rc,outp=run(code)
        ok = rc==0 and "unbound symbol" not in outp and "error:" not in outp.lower() and ".for is not iterable" not in outp
        if ok: continue
        line=text[:off].count("\n")+1
        # look at context: 250 chars before block and 300 after for markers
        ctx = text[max(0,off-400):endoff+400]
        marked = ("[needs:" in ctx) or ("BUILD:" in ctx) or ("needs-alfred" in ctx)
        # detect failure class
        if ".for is not iterable" in outp: cls="BRACKET"
        elif "inf.0" in outp: cls="INF"
        elif re.search(r"unbound symbol: \d+/\d+", outp): cls="RATIONAL"
        elif "unbound symbol: every?" in outp: cls="EVERYQ"
        elif "unbound symbol: format" in outp: cls="FORMAT"
        elif "unbound symbol: loam/recall" in outp: cls="LOAM"
        else:
            us=re.search(r"unbound symbol: (\S+)",outp)
            cls="UNB:"+ (us.group(1) if us else "?")
        flag = "  <<< UNMARKED" if not marked else ""
        firstline=code.strip().split("\n")[0][:60]
        print(f"{base}:L{line} [{cls}]{flag} {firstline}")
