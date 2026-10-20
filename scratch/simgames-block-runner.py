import os, re, subprocess, sys

BOOK = "/Users/alfred/code/motoi-scheme/scheme-books/book-of-simulation-games"
MOTOI = "/Users/alfred/code/motoi-scheme/bin/motoi"
ROOT = "/Users/alfred/code/motoi-scheme"

def run_block(code):
    p = subprocess.run([MOTOI, "run", "/dev/stdin"], input=code,
                       capture_output=True, text=True, cwd=ROOT, timeout=60)
    return p.returncode, p.stdout, p.stderr

def extract_blocks(text):
    # matches ```scheme ... ```
    blocks = []
    for m in re.finditer(r"```scheme\n(.*?)```", text, re.DOTALL):
        blocks.append((m.start(), m.group(1)))
    return blocks

files = sys.argv[1:] or sorted(f for f in os.listdir(BOOK) if f.endswith(".slatl"))
total=passed=failed=0
for fn in files:
    path = os.path.join(BOOK, fn)
    text = open(path).read()
    blocks = extract_blocks(text)
    if not blocks: continue
    for i,(pos,code) in enumerate(blocks):
        total+=1
        rc,out,err = run_block(code)
        line = text[:pos].count("\n")+1
        bad = rc!=0 or "unbound symbol" in (out+err) or "error" in err.lower()
        if bad:
            failed+=1
            print(f"FAIL {fn} block#{i} (line {line})")
            print("  ERR:", (err or out).strip().replace("\n"," | ")[:200])
        else:
            passed+=1
print(f"\nTOTAL {total} PASS {passed} FAIL {failed}")
