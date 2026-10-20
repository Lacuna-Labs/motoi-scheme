import os, re, subprocess, sys

BOOK = "/Users/alfred/code/motoi-scheme/scheme-books/book-of-simulation-games"
MOTOI = "/Users/alfred/code/motoi-scheme/bin/motoi"
ROOT = "/Users/alfred/code/motoi-scheme"

def run_block(code):
    p = subprocess.run([MOTOI, "run", "/dev/stdin"], input=code,
                       capture_output=True, text=True, cwd=ROOT, timeout=60)
    return p.returncode, p.stdout, p.stderr

def extract_blocks(text):
    return [(m.start(), m.group(1)) for m in re.finditer(r"```scheme\n(.*?)```", text, re.DOTALL)]

files = sys.argv[1:] or sorted(f for f in os.listdir(BOOK) if f.endswith(".slatl"))
for fn in files:
    path = os.path.join(BOOK, fn)
    text = open(path).read()
    blocks = extract_blocks(text)
    if not blocks: continue
    ctx = ""   # accumulated definitions
    print(f"=== {fn} ({len(blocks)} blocks) ===")
    for i,(pos,code) in enumerate(blocks):
        line = text[:pos].count("\n")+1
        # Try WITH accumulated context first
        rc,out,err = run_block(ctx+"\n"+code)
        msg = (err or out).strip()
        bad = rc!=0 or "unbound symbol" in msg or "error" in err.lower()
        if bad:
            # try isolated to see if it's a ctx issue
            rc2,out2,err2 = run_block(code)
            msg2 = (err2 or out2).strip()
            first = msg.split("\n")[0][:120]
            print(f"  FAIL block#{i} (line {line}): {first}")
        else:
            ctx += "\n"+code   # only accumulate successful blocks
