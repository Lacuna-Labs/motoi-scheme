import json, re, subprocess, sys
from pathlib import Path
import importlib.util
spec=importlib.util.spec_from_file_location("drv","/Users/alfred/code/motoi-scheme/scratch/ref-fill-driver.py")
drv=importlib.util.module_from_spec(spec); spec.loader.exec_module(drv)
REF=Path('/Users/alfred/code/motoi-scheme/scheme/reference')
ROOT='/Users/alfred/code/motoi-scheme'

notation=json.load(open(f'{ROOT}/scratch/notation-defects.json'))

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

def run_ok(code):
    if not code.strip(): return False
    try:
        p=subprocess.run(['node','bin/motoi','run','/dev/stdin'],input=code,
                         capture_output=True,text=True,cwd=ROOT,timeout=30)
        return p.returncode==0
    except Exception: return False

# ordered candidate keys: prefer math framing, then claim-program, then others
PREF=['math-program','program','math-composition','eng-program','cs-program','eng-composition','cs-composition','composition','code']

# group notation by file
byfile={}
for e in notation: byfile.setdefault(e['file'],[]).append(e)

replacements=[]  # (file, old_code_notation, new_program)
unresolved=[]
GLYPHS=set('×≅→↦∅∏∘⇀√⊆⊂⊄⇔⇒≡∈∉∀∃∧∨·−ᵀ⁻ⁿ∫≠∼≈∇⊗⊕∂ℝℤℕℚℂ∞±ᵢₙ')
def is_notation(s):
    # reuse: strip comments/strings then glyph check
    out=[]; i=0; n=len(s); instr=False
    while i<n:
        c=s[i]
        if instr:
            if c=='\\': i+=2; continue
            if c=='"': instr=False
            i+=1; continue
        if c=='"': instr=True; i+=1; continue
        if c==';':
            while i<n and s[i]!='\n': i+=1
            continue
        out.append(c); i+=1
    return any(g in ''.join(out) for g in GLYPHS)

for fname,entries in byfile.items():
    text=(REF/fname).read_text()
    forms=drv.extract_verb_forms(text)
    # precompute per-form candidate programs
    form_cache=[]
    for form in forms:
        nm=re.search(r':name\s+"([^"]+)"',form)
        name=nm.group(1) if nm else '?'
        cands={}
        for km in re.finditer(r':(math-program|program|math-composition|eng-program|cs-program|eng-composition|cs-composition|composition|code)\s+"',form):
            key=km.group(1); qpos=form.index('"',km.end()-1)
            val,_=read_lit(form,qpos)
            cands.setdefault(key,[]).append(val)
        form_cache.append((name,form,cands))
    for e in entries:
        notn=e['code']
        # find enclosing form: the form whose text contains this exact :code "notation"
        target=f'"{notn}"' if False else notn
        chosen=None; vname=None
        for name,form,cands in form_cache:
            if notn in form:
                vname=name
                # pick first passing candidate that is itself NOT notation
                for key in PREF:
                    for val in cands.get(key,[]):
                        if val==notn: continue
                        if is_notation(val): continue
                        if run_ok(val):
                            chosen=val; break
                    if chosen: break
                break
        if chosen:
            replacements.append({'file':fname,'verb':vname,'old':notn,'new':chosen})
        else:
            unresolved.append({'file':fname,'verb':vname,'old':notn})

json.dump(replacements,open(f'{ROOT}/scratch/notation-replacements.json','w'),indent=1)
json.dump(unresolved,open(f'{ROOT}/scratch/notation-unresolved.json','w'),indent=1)
print(f"replacements: {len(replacements)}")
print(f"unresolved:   {len(unresolved)}")
for u in unresolved:
    print(f"  UNRESOLVED {u['file']} {u['verb']}  {u['old']!r}")
