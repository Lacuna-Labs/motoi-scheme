import re, subprocess, os, glob
os.chdir('/Users/alfred/code/motoi-scheme')
files = sorted(glob.glob('scheme-books/book-of-animation/*.slatl'))

# Curator substrate verb prefixes/names Motoi lacks (ripped 2026-07-25 + never-wired render/sim layer)
RIP = re.compile(r'\b('
    r'paint-cell|big-bang|build|animate|maze|dsqrt|cell/at'
    r'|world/[a-z!-]+|entity/[a-z!-]+|scene/[a-z!-]+|prefab/[a-z!-]+|part/[a-z!-]+'
    r'|camera-[a-z!-]+|camera/[a-z!-]+|motion/[a-z!-]+|game/[a-z!-]+|audio/[a-z!-]+'
    r'|note/[a-z!-]+|synth/[a-z!-]+|sound/[a-z!-]+'
    r'|bounce|slide|fade|fb/text|time/when|text/measure|text/wrap|ai/[a-z!-]+'
    r'|entity)\b')

def fails(code):
    with open('scratch/_blk.scm','w') as fh: fh.write(code)
    r=subprocess.run(['./bin/motoi','run','scratch/_blk.scm'],capture_output=True,text=True,timeout=30)
    o=r.stdout+r.stderr
    return ('unbound symbol' in o) or ('error:' in o) or ('not iterable' in o)

total=0; marked=0
for f in files:
    lines=open(f).read().split('\n')
    out=[]; i=0; changed=False
    while i<len(lines):
        if lines[i].strip()=='```scheme':
            start=i+1; j=i+1
            while j<len(lines) and lines[j].strip()!='```': j+=1
            body=lines[start:j]; code='\n'.join(body).replace('\\"','"')
            is_wrong_demo = ('WRONG' in code) or ('DO NOT' in code) or ('does not exist' in code)
            if fails(code) and not is_wrong_demo:
                total+=1
                # already marked directly above?
                prev = out[-1].strip() if out else ''
                if 'needs-alfred' not in prev:
                    verbs = sorted(set(RIP.findall(code)))
                    vs = ', '.join(verbs[:6]) + ('' if len(verbs)<=6 else ', ...')
                    out.append(f'<!-- needs-alfred: Curator render/sim substrate not in Motoi ({vs}) — prose kept, code not runnable here. -->')
                    marked+=1; changed=True
            out.extend(lines[i:j+1]); i=j+1
        else:
            out.append(lines[i]); i+=1
    if changed:
        open(f,'w').write('\n'.join(out))
print(f'failing blocks: {total}  markers inserted: {marked}')
