import re, sys
from pathlib import Path
REF=Path('/Users/alfred/code/motoi-scheme/scheme/reference')
CODE_KEYS=('code','eng-program','math-program','cs-program','program',
           'eng-composition','math-composition','cs-composition','composition')
COMMUT={'+','*','max','min','gcd','lcm','nt/gcd','nt/lcm','math/gcd','math/lcm','game/surreal-add'}
BANNED=('fold-left','foldl','foldr')
key_re=re.compile(r':(' + '|'.join(map(re.escape,CODE_KEYS)) + r')\s*"')

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
def encode_lit(s):
    return '"'+s.replace('\\','\\\\').replace('"','\\"').replace('\n','\\n').replace('\t','\\t').replace('\r','\\r')+'"'

def local_defs(code):
    L=set()
    for nm in BANNED:
        if re.search(r'\(define\s+\('+re.escape(nm)+r'\b',code) or re.search(r'\(define\s+'+re.escape(nm)+r'\s+\(lambda',code):
            L.add(nm)
    return L

TOK=re.compile(r'\((fold-left|foldl|foldr)(\s+)')
def read_token(s,i):
    j=i
    while j<len(s) and s[j] not in ' \t\n\r()': j+=1
    return s[i:j], j
def read_balanced(s,i):
    d=0; j=i; instr=False
    while j<len(s):
        c=s[j]
        if instr:
            if c=='\\': j+=2; continue
            if c=='"': instr=False
        else:
            if c=='"': instr=True
            elif c=='(': d+=1
            elif c==')':
                d-=1
                if d==0: return s[i:j+1], j+1
        j+=1
    return s[i:], j

def transform(code):
    L=local_defs(code)
    out=[]; pos=0; n=0
    while True:
        m=TOK.search(code,pos)
        if not m: out.append(code[pos:]); break
        op=m.group(1); ws=m.group(2); after=m.end()
        out.append(code[pos:m.start()])
        if op in L:                      # locally-defined shim: leave call/def alone
            out.append(code[m.start():after]); pos=after; continue
        if op=='foldl': out.append('(fold'+ws); pos=after; n+=1; continue
        if op=='foldr': out.append('(fold-right'+ws); pos=after; n+=1; continue
        # fold-left
        if after<len(code) and code[after]=='(':
            blk,end=read_balanced(code,after)
            lm=re.match(r'\(lambda\s*\(([^)]*)\)',blk)
            if lm and len(lm.group(1).split())==2:
                p=lm.group(1).split()
                out.append('(fold'+ws+'(lambda ('+p[1]+' '+p[0]+')'+blk[lm.end():]); pos=end; n+=1; continue
            out.append(code[m.start():after]); pos=after; continue
        proc,pend=read_token(code,after)
        if proc in COMMUT: out.append('(fold'+ws+proc); pos=pend; n+=1; continue
        out.append('(fold'+ws+'(lambda (%x %a) ('+proc+' %a %x))'); pos=pend; n+=1; continue
    return ''.join(out), n

dry='--write' not in sys.argv
prog_edited=0; call_edited=0; files=0; skipped_shim=0
for path in sorted(REF.glob('*.slat')):
    text=path.read_text(); edits=[]
    for vm in key_re.finditer(text):
        q=vm.end()-1; code,end=read_lit(text,q)
        if not any(b in code for b in BANNED): continue
        L=local_defs(code)
        # does it have an unbound (non-local) banned call?
        has_unbound=any(m.group(1) not in L for m in TOK.finditer(code))
        if not has_unbound:
            skipped_shim+=1; continue
        new,n=transform(code)
        if n>0 and new!=code:
            edits.append((q,end,encode_lit(new))); prog_edited+=1; call_edited+=n
    if edits:
        files+=1
        if not dry:
            for s,e,lit in sorted(edits,reverse=True): text=text[:s]+lit+text[e:]
            path.write_text(text)
print(f"programs transformed: {prog_edited}  calls rewritten: {call_edited}  files: {files}  shim-programs-skipped: {skipped_shim}")
print("MODE:", "DRY" if dry else "WROTE")
