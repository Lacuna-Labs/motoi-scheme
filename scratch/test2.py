import re, subprocess, sys, os, json
os.chdir('/Users/alfred/code/motoi-scheme')
BOOK='scheme-books/book-of-music'
files=sys.argv[1:] or sorted(f for f in os.listdir(BOOK) if f.endswith('.book.slatl'))
BLOCK=re.compile(r'^```scheme\s*$'); END=re.compile(r'^```\s*$')

def unesc(s):
    return s.replace('\\"','"').replace('\\\\','\\')

CORE_UNBOUND=set()  # known-broken core verbs
summary={}
for fn in files:
    p=os.path.join(BOOK,fn)
    lines=open(p,encoding='utf-8').read().split('\n')
    blocks=[]; i=0
    while i<len(lines):
        if BLOCK.match(lines[i]):
            start=i+1; j=i+1
            while j<len(lines) and not END.match(lines[j]): j+=1
            blocks.append((start+1, '\n'.join(lines[start:j]))); i=j+1
        else: i+=1
    # collect all top-level defines across chapter to detect cross-block helper deps
    defined=set()
    for _,c in blocks:
        for m in re.finditer(r'\(define\s+\(?([A-Za-z0-9\-\?!*/+<>=]+)', unesc(c)):
            defined.add(m.group(1))
    fails=[]
    for (ln,code) in blocks:
        raw=unesc(code)
        r=subprocess.run(['./bin/motoi','run','/dev/stdin'],input=raw,capture_output=True,text=True,timeout=60)
        out=(r.stdout+r.stderr)
        if 'error' in out.lower():
            errln=next((l for l in out.split('\n') if 'error' in l.lower()), out.split('\n')[0]).strip()[:90]
            # classify: is the unbound symbol a chapter-defined helper?
            cls='REAL'
            m=re.search(r'unbound symbol:\s*(\S+)', errln)
            if m and m.group(1) in defined: cls='CTX'  # defined elsewhere in chapter
            fails.append((ln,cls,errln))
    summary[fn]=(len(blocks),fails)
    real=[f for f in fails if f[1]=='REAL']
    print(f"{fn}: {len(blocks)} blocks, {len(real)} REAL-fail, {len(fails)-len(real)} ctx-only", flush=True)
    for ln,cls,e in real:
        print(f"   L{ln} [{cls}]: {e}", flush=True)
json.dump({k:(v[0],[list(x) for x in v[1]]) for k,v in summary.items()}, open('scratch/sum2.json','w'))
