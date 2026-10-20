import json, re, subprocess
from pathlib import Path
import importlib.util
spec=importlib.util.spec_from_file_location("drv","/Users/alfred/code/motoi-scheme/scratch/ref-fill-driver.py")
drv=importlib.util.module_from_spec(spec); spec.loader.exec_module(drv)
ROOT='/Users/alfred/code/motoi-scheme'
REF=Path(f'{ROOT}/scheme/reference')

failing=json.load(open(f'{ROOT}/scratch/rung-notation-failing.json'))
# the 924: unbound bare (non-slashed) symbol
bare=[]
for e in failing:
    err=e.get('err','') or ''
    if 'unbound symbol' not in err: continue
    m=re.search(r'unbound symbol:\s*([^\s]+)', err)
    if m and '/' not in m.group(1):
        e['sym']=m.group(1); bare.append(e)

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

_run_cache={}
def run_ok(code):
    if not code.strip(): return False
    if code in _run_cache: return _run_cache[code]
    try:
        p=subprocess.run(['node','bin/motoi','run','/dev/stdin'],input=code,
                         capture_output=True,text=True,cwd=ROOT,timeout=30)
        ok=(p.returncode==0)
    except Exception: ok=False
    _run_cache[code]=ok; return ok

PREF=['program','math-program','cs-program','eng-program','math-composition','cs-composition','eng-composition','composition','code']
failset=set((e['file'],e['code']) for e in bare)

byfile={}
for e in bare: byfile.setdefault(e['file'],[]).append(e)

replacements=[]; unresolved=[]
for fname,entries in sorted(byfile.items()):
    text=(REF/fname).read_text()
    forms=drv.extract_verb_forms(text)
    form_cache=[]
    for form in forms:
        nm=re.search(r':name\s+"([^"]+)"',form)
        name=nm.group(1) if nm else '?'
        cands={}
        for km in re.finditer(r':(program|math-program|cs-program|eng-program|math-composition|cs-composition|eng-composition|composition|code)\s+"',form):
            key=km.group(1); qpos=form.index('"',km.end()-1)
            val,_=read_lit(form,qpos); cands.setdefault(key,[]).append(val)
        form_cache.append((name,form,cands))
    for e in entries:
        code=e['code']; dom=e['domain']
        chosen=None; vname=None
        # locate enclosing form via the exact (:domain "D" :code "C") tuple text
        for name,form,cands in form_cache:
            if code in form:
                vname=name
                for key in PREF:
                    for val in cands.get(key,[]):
                        if val==code: continue
                        if (fname,val) in failset: continue
                        if run_ok(val): chosen=val; break
                    if chosen: break
                break
        if chosen:
            replacements.append({'file':fname,'verb':vname,'domain':dom,'old':code,'new':chosen,'sym':e['sym']})
        else:
            unresolved.append({'file':fname,'verb':vname,'domain':dom,'old':code,'sym':e['sym']})

json.dump(replacements,open(f'{ROOT}/scratch/fix924-replacements.json','w'),indent=1)
json.dump(unresolved,open(f'{ROOT}/scratch/fix924-unresolved.json','w'),indent=1)
print(f"RESOLVED (verb real, crib available): {len(replacements)}")
print(f"UNRESOLVED (no passing crib in verb):  {len(unresolved)}")
from collections import Counter
print("\n=== resolved by domain-label kind (top) ===")
for d,n in Counter(r['domain'][:30] for r in replacements).most_common(12): print(f'  {n:4}  {d}')
print("\n=== unresolved failing-symbol roots (top) ===")
for s,n in Counter(u['sym'].split('-')[0] for u in unresolved).most_common(15): print(f'  {n:4}  {s}')
