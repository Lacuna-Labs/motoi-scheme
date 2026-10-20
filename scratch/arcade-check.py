import sys, re, subprocess
path = sys.argv[1]
text = open(path).read()
blocks = []
for m in re.finditer(r'```scheme\n(.*?)```', text, re.S):
    blocks.append(('fence', m.group(1).replace('\\"', '"')))
# code-block :source "..."  — :source is followed by a big string literal.
for m in re.finditer(r':source\s*\n?\s*"(.*?)"\)', text, re.S):
    blocks.append(('anchor', m.group(1).replace('\\"', '"')))
prelude = ""
for i,(kind,b) in enumerate(blocks):
    exp = None
    em = re.search(r';;\s*=>\s*(.*)', b)
    if em: exp = em.group(1).strip()
    src = prelude + "\n" + b
    r = subprocess.run(['./bin/motoi','run','/dev/stdin'], input=src, capture_output=True, text=True)
    allout = r.stdout+r.stderr
    out = allout.strip().splitlines()
    tail = out[-1] if out else ""
    bad = ("unbound symbol" in allout or "fuel" in allout or
           re.search(r'\berror\b', allout, re.I))
    status = "ERR" if bad else "ok"
    print(f"block {i} [{kind}]: {status}  expected[{exp}]  got_tail[{tail}]")
    if bad: print("   >>", allout.strip()[:200])
    prelude = src
