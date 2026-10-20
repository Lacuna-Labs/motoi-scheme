#!/usr/bin/env python3
"""Independent round-trip verifier: parse the SAVED .slat, unescape properly, run every program."""
import re, os, subprocess, tempfile, sys

ROOT='/Users/alfred/code/motoi-scheme'
PATH=ROOT+'/scheme/reference/60-string.slat'
TARGET = set("""string-any string-concatenate string-every string-fold string-fold-right
string-index-right string-null? string-prefix? string-skip string-suffix? string-tokenize""".split())
CODE_KEYS = ('code','eng-program','math-program','cs-program','program',
             'eng-composition','math-composition','cs-composition','composition')

def records(text, tag='(verb'):
    out=[];i=0;n=len(text)
    while i<n:
        if (i==0 or text[i-1]=='\n') and text.startswith(tag,i):
            depth=0;in_s=False;esc=False;j=i
            while j<n:
                c=text[j]
                if in_s:
                    if esc: esc=False
                    elif c=='\\': esc=True
                    elif c=='"': in_s=False
                else:
                    if c=='"': in_s=True
                    elif c=='(': depth+=1
                    elif c==')':
                        depth-=1
                        if depth==0: j+=1;break
                j+=1
            out.append(text[i:j]); i=j
        else: i+=1
    return out

def read_string_at(s, i):
    """s[i] == '\"' ; return (value, next_index) with a CORRECT single-pass unescape."""
    assert s[i]=='"'
    j=i+1; buf=[]
    while j < len(s):
        c=s[j]
        if c=='\\':
            nxt=s[j+1]
            buf.append({'n':'\n','t':'\t','r':'\r','"':'"','\\':'\\'}.get(nxt, '\\'+nxt))
            j+=2
        elif c=='"':
            return ''.join(buf), j+1
        else:
            buf.append(c); j+=1
    raise ValueError('unterminated string')

def code_blocks(rec):
    out=[]
    for m in re.finditer(r':(' + '|'.join(CODE_KEYS) + r')\s+"', rec):
        key=m.group(1); qi=m.end()-1
        val,_=read_string_at(rec, qi)
        out.append((key,val))
    return out

def run(code):
    with tempfile.NamedTemporaryFile('w',suffix='.scm',delete=False,dir=ROOT+'/scratch/kleene') as f:
        f.write(code+'\n'); p=f.name
    try:
        r=subprocess.run([ROOT+'/bin/motoi','run',p],capture_output=True,text=True,timeout=60)
        return r.returncode,(r.stdout+r.stderr).strip()
    finally: os.unlink(p)

text=open(PATH).read()
total=0; failed=0; per={}
seen=set()
for rec in records(text):
    m=re.search(r':name\s+"([^"]+)"',rec)
    name=m.group(1)
    if name not in TARGET: continue
    seen.add(name)
    blocks=code_blocks(rec)
    per[name]=len(blocks)
    for key,code in blocks:
        total+=1
        rc,out=run(code)
        if rc!=0:
            failed+=1
            print('FAIL  %-20s %-16s\n  code: %s\n  err : %s' % (name,key,code.replace('\n',' | '),out))
print()
for n in sorted(per): print('  %-20s %2d programs' % (n,per[n]))
print('\nverbs found: %d/%d  missing: %s' % (len(seen),len(TARGET), sorted(TARGET-seen) or 'none'))
print('ROUND-TRIP: %d programs extracted from saved .slat, %d failed' % (total,failed))
sys.exit(1 if (failed or seen!=TARGET) else 0)
