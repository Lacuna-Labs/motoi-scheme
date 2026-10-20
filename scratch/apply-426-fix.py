import json
from pathlib import Path
REF=Path('/Users/alfred/code/motoi-scheme/scheme/reference')
reps=json.load(open('/Users/alfred/code/motoi-scheme/scratch/fix426-replacements.json'))

def enc(s):
    return '"'+s.replace('\\','\\\\').replace('"','\\"').replace('\n','\\n').replace('\t','\\t').replace('\r','\\r')+'"'

byfile={}
for e in reps: byfile.setdefault(e['file'],[]).append(e)

applied=0; problems=[]
for fname,entries in byfile.items():
    p=REF/fname; text=p.read_text(); orig=text
    for e in entries:
        dom=enc(e['domain']); old=enc(e['old']); new=enc(e['new'])
        ctx=':domain '+dom+' :code '+old
        n=text.count(ctx)
        if n==1:
            text=text.replace(ctx,':domain '+dom+' :code '+new); applied+=1
        elif n==0:
            if text.count(':code '+old)==1:
                text=text.replace(':code '+old,':code '+new); applied+=1
            else:
                problems.append((fname,e['verb'],'NOTFOUND',e['sym'],e['old'][:40]))
        else:
            problems.append((fname,e['verb'],f'AMBIG({n})',e['sym'],e['old'][:40]))
    if text!=orig: p.write_text(text)

print(f"applied: {applied}")
print(f"problems: {len(problems)}")
for pr in problems[:60]: print("  ",pr)
