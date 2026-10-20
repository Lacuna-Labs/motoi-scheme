import re, subprocess, json
from pathlib import Path
REF=Path('/Users/alfred/code/motoi-scheme/scheme/reference')

def read_lit(text,i):
    out=[]; j=i+1
    while j<len(text):
        c=text[j]
        if c=='\\':
            nxt=text[j+1] if j+1<len(text) else ''
            out.append({'n':'\n','t':'\t','r':'\r','"':'"','\\':'\\'}.get(nxt,nxt)); j+=2; continue
        if c=='"': return ''.join(out), j+1
        out.append(c); j+=1
    return ''.join(out), j

# find (:domain "..." :code "...") tuples
dom_re=re.compile(r':domain\s+"')
results=[]
for f in sorted(REF.glob('*.slat')):
    text=f.read_text()
    for m in dom_re.finditer(text):
        qpos=m.end()-1
        domval,after=read_lit(text,qpos)
        # find next :code after this within a small window (same tuple)
        cm=re.search(r':code\s+"', text[after:after+400])
        if not cm: continue
        cpos=after+cm.end()-1
        codeval,_=read_lit(text,cpos)
        results.append((f.name,domval,codeval,cpos))

# test-run each code value
failing=[]
for fname,dom,code,cpos in results:
    p=subprocess.run(['node','bin/motoi','run','/dev/stdin'],input=code,
                     capture_output=True,text=True,cwd='/Users/alfred/code/motoi-scheme',timeout=30)
    if p.returncode!=0:
        failing.append({'file':fname,'domain':dom,'code':code,
                        'err':(p.stderr or p.stdout).strip().splitlines()[-1] if (p.stderr or p.stdout).strip() else ''})

print(f"total :domain rungs: {len(results)}")
print(f"FAILING rung :code: {len(failing)}")
for e in failing:
    print("="*60)
    print(f"{e['file']}  [{e['domain'][:50]}]")
    print(f"  code: {e['code']!r}")
    print(f"  err : {e['err'][:90]}")
json.dump(failing,open('/Users/alfred/code/motoi-scheme/scratch/rung-notation-failing.json','w'),indent=1)
