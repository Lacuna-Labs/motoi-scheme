import json
from pathlib import Path
REF=Path('/Users/alfred/code/motoi-scheme/scheme/reference')
reps=json.load(open('/Users/alfred/code/motoi-scheme/scratch/notation-replacements.json'))

def encode_lit(s):
    return '"'+s.replace('\\','\\\\').replace('"','\\"').replace('\n','\\n').replace('\t','\\t').replace('\r','\\r')+'"'

byfile={}
for e in reps: byfile.setdefault(e['file'],[]).append(e)

applied=0; problems=[]
for fname,entries in byfile.items():
    p=REF/fname; text=p.read_text(); orig=text
    for e in entries:
        enc_old=encode_lit(e['old']); enc_new=encode_lit(e['new'])
        n=text.count(enc_old)
        if n==1:
            text=text.replace(enc_old,enc_new); applied+=1
        elif n==0:
            problems.append((fname,e['verb'],'NOTFOUND',e['old']))
        else:
            # disambiguate with :code prefix
            ctx_old=':code '+enc_old
            if text.count(ctx_old)==1:
                text=text.replace(ctx_old,':code '+enc_new); applied+=1
            else:
                problems.append((fname,e['verb'],f'AMBIG({n})',e['old']))
    if text!=orig:
        p.write_text(text)
print(f"applied: {applied}")
print(f"problems: {len(problems)}")
for pr in problems: print("  ",pr)
