import re, subprocess, os, sys
os.chdir('/Users/alfred/code/motoi-scheme')
BOOK='scheme-books/book-of-music'
PRE=open('scratch/FINAL-preamble.scm').read().split('(display (as-freq')[0]
files=sys.argv[1:] or sorted(f for f in os.listdir(BOOK) if f.endswith('.book.slatl'))
BLK=re.compile(r'^```scheme\s*$'); END=re.compile(r'^```\s*$')
def unesc(s): return s.replace('\\"','"').replace('\\\\','\\')
# metavariable-template detection: a block that is a single form of bare lowercase words
def is_template(code):
    c=code.strip()
    if c.count('\n')>0: return False
    return bool(re.fullmatch(r'\([a-z][\w/-]*(?:\s+[a-z][\w-]*)+\)', c))
G=[0,0,0]
for fn in files:
    lines=open(os.path.join(BOOK,fn),encoding='utf-8').read().split('\n')
    blocks=[]; i=0
    while i<len(lines):
        if BLK.match(lines[i]):
            j=i+1
            while j<len(lines) and not END.match(lines[j]): j+=1
            blocks.append(unesc('\n'.join(lines[i+1:j]))); i=j+1
        else: i+=1
    if not blocks: continue
    defs=[]; fails=[]
    for k,code in enumerate(blocks):
        if is_template(code): continue
        wrong=('WRONG' in code) or ('not a verb' in code) or ('will error' in code) or ('DOES NOT' in code) or ('DO NOT' in code)
        ctx=PRE+'\n'+'\n'.join(defs)+'\n'
        r=subprocess.run(['./bin/motoi','run','/dev/stdin'],input=ctx+code,capture_output=True,text=True,timeout=45)
        out=(r.stdout+r.stderr)
        err='error' in out.lower()
        if err and not wrong:
            el=next((l for l in out.split('\n') if 'error' in l.lower()),'')
            # ignore validator-only fuel artifact by retrying standalone-with-preamble
            if 'fuel exhausted' in el:
                r2=subprocess.run(['./bin/motoi','run','/dev/stdin'],input=PRE+'\n'+code,capture_output=True,text=True,timeout=45)
                if 'error' not in (r2.stdout+r2.stderr).lower():
                    err=False
                else: el=next((l for l in (r2.stdout+r2.stderr).split('\n') if 'error' in l.lower()),el)
            if err: fails.append((k,el.strip()[:70]))
        if not err and '(define' in code:
            clean='\n'.join(l for l in code.split('\n') if not re.match(r'\s*\((display|write|newline)',l))
            defs.append(clean)
    G[0]+=len(blocks); G[1]+=len(fails)
    tag='ALL GREEN' if not fails else f'{len(fails)} fail'
    print(f"{fn}: {len(blocks)} blocks, {tag}", flush=True)
    for k,e in fails: print(f"    #{k}: {e}", flush=True)
print(f"GRAND {G[0]} blocks {G[1]} fail", flush=True)
