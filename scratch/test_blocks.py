import re, subprocess, sys, os, json
os.chdir('/Users/alfred/code/motoi-scheme')
BOOK='scheme-books/book-of-music'
files=sys.argv[1:] or sorted(f for f in os.listdir(BOOK) if f.endswith('.book.slatl'))
BLOCK=re.compile(r'^```scheme\s*$')
END=re.compile(r'^```\s*$')
summary={}
for fn in files:
    p=os.path.join(BOOK,fn)
    lines=open(p,encoding='utf-8').read().split('\n')
    blocks=[]; i=0
    while i<len(lines):
        if BLOCK.match(lines[i]):
            start=i+1; j=i+1
            while j<len(lines) and not END.match(lines[j]): j+=1
            blocks.append((start+1, '\n'.join(lines[start:j])))  # 1-based start line of code
            i=j+1
        else: i+=1
    fails=[]
    for (ln,code) in blocks:
        r=subprocess.run(['./bin/motoi','run','/dev/stdin'],input=code,capture_output=True,text=True,timeout=60)
        out=(r.stdout+r.stderr)
        if 'unbound symbol' in out or 'error:' in out:
            # capture first error line
            errln=next((l for l in out.split('\n') if 'error' in l.lower()), out.split('\n')[0])
            fails.append((ln,errln.strip()[:100]))
    summary[fn]=(len(blocks),fails)
    print(f"{fn}: {len(blocks)} blocks, {len(fails)} FAIL")
    for (ln,e) in fails:
        print(f"   L{ln}: {e}")
json.dump(summary, open('scratch/block_summary.json','w'))
