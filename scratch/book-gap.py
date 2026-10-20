import re, subprocess, sys, os, glob
from collections import Counter

MOTOI = "/Users/alfred/code/motoi-scheme/bin/motoi"

def blocks(text):
    out=[]
    for m in re.finditer(r"```scheme\n(.*?)```", text, re.S):
        out.append((m.start(1), m.group(1)))
    return out

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
    code=unescape(code)
    try:
        p = subprocess.run([MOTOI,"run","/dev/stdin"], input=code,
                           capture_output=True, text=True, timeout=30)
        return p.returncode, (p.stdout+p.stderr)
    except subprocess.TimeoutExpired:
        return 1, "TIMEOUT"

NEG = re.compile(r";;\s*(WRONG|BAD|DON'?T|ANTI-?PATTERN|broken on purpose|won'?t work|does ?n'?t work|fails intentionally|is not)", re.I)

def is_negative(code):
    return bool(NEG.search(code))

folder = sys.argv[1]
gap = Counter()
total=0; passed=0; neg=0; realfail=0
fails=[]
for f in sorted(glob.glob(os.path.join(folder,"*.slatl"))):
    text=open(f).read()
    base=os.path.basename(f)
    for i,(off,code) in enumerate(blocks(text)):
        total+=1
        if is_negative(code):
            neg+=1; continue
        rc,outp=run(code)
        ok = rc==0 and "unbound symbol" not in outp and "error:" not in outp.lower() and "TIMEOUT" not in outp
        if ok:
            passed+=1; continue
        line=text[:off].count("\n")+1
        um=re.search(r"unbound symbol:\s*(\S+)", outp)
        if um:
            gap[um[1]]+=1
            fails.append(f"{base}:L{line} #{i} UNWIRED({um[1]}): {code.strip().splitlines()[0][:60]}")
        else:
            realfail+=1
            fails.append(f"{base}:L{line} #{i} REALFAIL: {outp.strip().replace(chr(10),' | ')[:120]}")

print(f"TOTAL {total}  PASS {passed}  NEG {neg}  UNWIRED {sum(gap.values())}  REALFAIL {realfail}")
print("=== gap symbols ===")
for s,c in gap.most_common():
    print(f"{c:4}  {s}")
print("=== first 40 failing blocks ===")
for line in fails[:40]:
    print(line)
