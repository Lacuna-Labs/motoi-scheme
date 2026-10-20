import re, subprocess, os, glob

BOOK = "/Users/alfred/code/motoi-scheme/scheme-books/book-of-one-shot"
MOTOI = "/Users/alfred/code/motoi-scheme/bin/motoi"

# device / illustrative verbs the book deliberately uses (unwired by design)
DEVICE = ["surface","cortex/recall","fetch","store","clock/now","system/registry",
          "knowledge/of","world/knowledge","loam/recall","loam/store","escalate",
          "weather/","bank/","email/","calendar/","contact/","currency/","author/",
          "book/","reading/","geo/","location/","profile/","home/","plant/","device/",
          "academic/","fitness/","article/","articles/","sms/","grocery/","finance/",
          "cart/","projects/","todo/","quiz/","stock/","devices/","sound/","synth/",
          "note/","event/","clock/unix-time","clock/hour","clock/day"]

def unescape(code):
    out=[]; i=0
    while i < len(code):
        c=code[i]
        if c=='\\' and i+1<len(code):
            n=code[i+1]
            if n=='\\': out.append('\\'); i+=2; continue
            if n=='"': out.append('"'); i+=2; continue
        out.append(c); i+=1
    return ''.join(out)

def run(code):
    p=subprocess.run([MOTOI,"run","/dev/stdin"],input=unescape(code),
                     capture_output=True,text=True,timeout=30)
    return p.returncode,(p.stdout+p.stderr)

def has_device(code):
    return any(d in code for d in DEVICE)

for f in sorted(glob.glob(os.path.join(BOOK,"*.slatl"))):
    text=open(f).read(); base=os.path.basename(f)
    for m in re.finditer(r"```scheme\n(.*?)```", text, re.S):
        code=m.group(1); off=m.start(1)
        rc,outp=run(code)
        ok = rc==0 and "unbound symbol" not in outp and "error:" not in outp.lower() and ".for is not iterable" not in outp
        if ok: continue
        if has_device(code): continue  # illustrative, leave alone
        line=text[:off].count("\n")+1
        print(f"=== {base}:L{line} ===")
        print(unescape(code).rstrip())
        print("  ->",outp.strip().replace("\n"," | ")[:150])
        print()
