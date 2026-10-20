import re, subprocess, os
os.chdir('/Users/alfred/code/motoi-scheme')
BOOK='scheme-books/book-of-music'
PRE=open('scratch/FINAL-preamble.scm').read().split('(display (as-freq')[0].rstrip()
def unesc(s): return s.replace('\\"','"').replace('\\\\','\\')
# a block is "deferred" (needs-alfred / no substrate) if it uses these
DEFER=re.compile(r'world/knowledge|motoi/say')
grand_real=0
for fn in sorted(os.listdir(BOOK)):
    if not fn.endswith('.book.slatl'): continue
    txt=open(os.path.join(BOOK,fn),encoding='utf-8').read()
    blocks=[unesc(b) for b in re.findall(r'```scheme\n(.*?)\n```', txt, re.S)]
    acc=PRE; fails=[]; deferred=0; ran=0
    for i,b in enumerate(blocks,1):
        if DEFER.search(b):
            deferred+=1; continue
        src=acc+"\n"+b
        r=subprocess.run(['./bin/motoi','run','/dev/stdin'],input=src,
                         capture_output=True,text=True)
        err=r.stderr+r.stdout
        if 'error:' in err:
            m=re.search(r'error:[^\n]*',err); fails.append((i,m.group(0)))
        else:
            acc=src; ran+=1
    tag='ALL GREEN' if not fails else f'{len(fails)} REAL FAIL'
    print(f"{fn}: {len(blocks)} blocks | {ran} green | {deferred} deferred(needs-alfred) | {tag}")
    for i,e in fails: print(f"    #{i}: {e}")
    grand_real+=len(fails)
print("=== GRAND TOTAL REAL FAILS (excl needs-alfred):", grand_real, "===")
