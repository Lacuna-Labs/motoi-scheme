import re, subprocess, os, sys, json
os.chdir('/Users/alfred/code/motoi-scheme')
BOOK='scheme-books/book-of-music'
PRE=open('scratch/FINAL-preamble.scm').read()
# strip the trailing display self-checks from preamble
PRE=PRE.split('(display (as-freq')[0]
files=sys.argv[1:] or sorted(f for f in os.listdir(BOOK) if f.endswith('.book.slatl'))
BLK=re.compile(r'^```scheme\s*$'); END=re.compile(r'^```\s*$')
def unesc(s): return s.replace('\\"','"').replace('\\\\','\\')
for fn in files:
    lines=open(os.path.join(BOOK,fn),encoding='utf-8').read().split('\n')
    blocks=[]; i=0
    while i<len(lines):
        if BLK.match(lines[i]):
            j=i+1
            while j<len(lines) and not END.match(lines[j]): j+=1
            blocks.append(unesc('\n'.join(lines[i+1:j]))); i=j+1
        else: i+=1
    if not blocks:
        print(f"{fn}: 0 blocks"); continue
    # test each block WITH preamble prepended (simulates reading chapter with foundation loaded)
    fails=[]
    for k,code in enumerate(blocks):
        full=PRE+'\n'+code
        r=subprocess.run(['./bin/motoi','run','/dev/stdin'],input=full,capture_output=True,text=True,timeout=60)
        out=(r.stdout+r.stderr)
        if 'error' in out.lower():
            el=next((l for l in out.split('\n') if 'error' in l.lower()),'')
            fails.append((k,el.strip()[:80]))
    print(f"{fn}: {len(blocks)} blocks, {len(fails)} still-fail WITH-preamble", flush=True)
    for k,e in fails: print(f"    blk#{k}: {e}", flush=True)
