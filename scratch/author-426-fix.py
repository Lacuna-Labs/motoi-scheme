import json, re, subprocess
from pathlib import Path
import importlib.util
spec=importlib.util.spec_from_file_location("drv","/Users/alfred/code/motoi-scheme/scratch/ref-fill-driver.py")
drv=importlib.util.module_from_spec(spec); spec.loader.exec_module(drv)
ROOT='/Users/alfred/code/motoi-scheme'
REF=Path(f'{ROOT}/scheme/reference')

failing=json.load(open(f'{ROOT}/scratch/rung-notation-failing.json'))  # current 426
def sym_of(e):
    m=re.search(r'unbound symbol:\s*([^\s]+)', e.get('err','') or '')
    return m.group(1) if m else '(non-unbound)'

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
failset=set((e['file'],e['code']) for e in failing)
byfile={}
for e in failing: byfile.setdefault(e['file'],[]).append(e)

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
    # per-form: track cribs already chosen so we vary across sibling rungs when possible
    used_by_form={}
    for e in entries:
        code=e['code']; dom=e['domain']; s=sym_of(e)
        chosen=None; vname=None
        for name,form,cands in form_cache:
            if code in form:
                vname=name
                usedset=used_by_form.setdefault(id(form),set())
                passing=[]
                for key in PREF:
                    for val in cands.get(key,[]):
                        if val==code or (fname,val) in failset: continue
                        if run_ok(val): passing.append(val)
                # prefer a passing candidate not already used by a sibling rung
                fresh=[v for v in passing if v not in usedset]
                pick=(fresh or passing)
                if pick:
                    chosen=pick[0]; usedset.add(chosen)
                break
        if chosen:
            replacements.append({'file':fname,'verb':vname,'domain':dom,'old':code,'new':chosen,'sym':s})
        else:
            unresolved.append({'file':fname,'verb':vname,'domain':dom,'old':code,'sym':s})

json.dump(replacements,open(f'{ROOT}/scratch/fix426-replacements.json','w'),indent=1)
json.dump(unresolved,open(f'{ROOT}/scratch/fix426-unresolved.json','w'),indent=1)
print(f"RESOLVED: {len(replacements)}")
print(f"UNRESOLVED: {len(unresolved)}")
from collections import Counter
print("\n=== unresolved by failing-symbol root ===")
for s,n in Counter(u['sym'].split('/')[0].split('-')[0] for u in unresolved).most_common(20): print(f'  {n:4}  {s}')
