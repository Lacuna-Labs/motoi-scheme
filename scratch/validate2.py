import re, subprocess, os, sys
os.chdir('/Users/alfred/code/motoi-scheme')
BOOK='scheme-books/book-of-music'
PRE=open('scratch/FINAL-preamble.scm').read().split('(display (as-freq')[0]
files=sys.argv[1:] or sorted(f for f in os.listdir(BOOK) if f.endswith('.book.slatl'))
BLK=re.compile(r'^```scheme\s*$'); END=re.compile(r'^```\s*$')
def unesc(s): return s.replace('\\"','"').replace('\\\\','\\')
GRAND=[0,0]
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
    fails=[]; ctx=PRE+'\n'
    for k,code in enumerate(blocks):
        # skip intentional-wrong demo blocks
        wrong = ('WRONG' in code) or ('not a verb' in code) or ('will error' in code) or ('DOES NOT' in code)
        r=subprocess.run(['./bin/motoi','run','/dev/stdin'],input=ctx+code,capture_output=True,text=True,timeout=60)
        out=(r.stdout+r.stderr)
        err='error' in out.lower()
        if err and not wrong:
            el=next((l for l in out.split('\n') if 'error' in l.lower()),'')
            fails.append((k,el.strip()[:80]))
        # only accumulate context if this block itself defines things & runs clean (avoid poisoning ctx)
        if not err:
            ctx=ctx+code+'\n'
    GRAND[0]+=len(blocks); GRAND[1]+=len(fails)
    print(f"{fn}: {len(blocks)} blocks, {len(fails)} still-fail (cumulative, wrong-demos skipped)", flush=True)
    for k,e in fails: print(f"    blk#{k}: {e}", flush=True)
print(f"GRAND: {GRAND[0]} blocks, {GRAND[1]} still-fail", flush=True)
