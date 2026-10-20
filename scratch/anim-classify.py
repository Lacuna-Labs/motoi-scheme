import re, subprocess, os, glob
os.chdir('/Users/alfred/code/motoi-scheme')
files = sorted(glob.glob('scheme-books/book-of-animation/*.slatl'))

SUBSTRATE = re.compile(r'\b(paint-cell|big-bang|build|animate|world/|entity/|scene/|camera-|camera/|prefab/|part/|maze|motion/|game/|audio/|note/|synth/|sound/|cell/at|field\b)')

cat = {}
for f in files:
    lines = open(f).read().split('\n')
    i=0
    while i < len(lines):
        if lines[i].strip()=='```scheme':
            start=i+1; j=i+1
            while j<len(lines) and lines[j].strip()!='```': j+=1
            body=lines[start:j]; code='\n'.join(body).replace('\\"','"')
            with open('scratch/_blk.scm','w') as fh: fh.write(code)
            r=subprocess.run(['./bin/motoi','run','scratch/_blk.scm'],capture_output=True,text=True,timeout=30)
            out=r.stdout+r.stderr
            if 'unbound symbol' in out or 'error:' in out:
                sub = bool(SUBSTRATE.search(code))
                key = 'SUBSTRATE' if sub else 'OTHER'
                cat.setdefault(key,[]).append((f,start+1,out.strip().split(chr(10))[0][:80]))
            i=j+1
        else: i+=1

for k in ('OTHER','SUBSTRATE'):
    lst=cat.get(k,[])
    print(f'### {k}: {len(lst)}')
    if k=='OTHER':
        for f,ln,o in lst: print(f'  {f.split("/")[-1]}:{ln}  {o}')
