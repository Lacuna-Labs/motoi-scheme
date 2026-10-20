import re, glob, sys, os
APPLY = '--apply' in sys.argv
COMMUTATIVE = {'+','*','max','min','gcd','lcm','math/gcd','math/lcm','nt/gcd','nt/lcm',
               'complex/+','vec/+','vec/add','linalg/vec-add','matrix/add','phys/q+','game/surreal-add'}
# whitespace incl escaped \n inside slat strings
WS = r'(?:\s|\\n)*'
stats={'foldl':0,'foldr':0,'lambda_swap':0,'comm_bare':0}
defer=[]  # (file, snippet)
def transform(txt, fname):
    # A: foldl -> fold, foldr -> fold-right (only as call heads: '(foldl ' / '(foldr ')
    def a1(m): stats['foldl']+=1; return '(fold '
    txt=re.sub(r'\(foldl'+WS+r'(?=[\(\w])', a1, txt) if False else txt
    # simpler: replace '(foldl' head and '(foldr' head
    txt, n = re.subn(r'\(foldl(?=[\s\\])', '(fold', txt); stats['foldl']+=n
    txt, n = re.subn(r'\(foldr(?=[\s\\])', '(fold-right', txt); stats['foldr']+=n
    # B: (fold-left <ws> (lambda <ws> ( P1 <ws> P2 )  -> (fold (lambda (P2 P1)
    lam = re.compile(r'\(fold-left'+WS+r'\(lambda'+WS+r'\('+WS+r'([^\s()\\]+)'+WS+r'([^\s()\\]+)'+WS+r'\)')
    def b(m):
        stats['lambda_swap']+=1
        return f'(fold (lambda ({m.group(2)} {m.group(1)})'
    txt = lam.sub(b, txt)
    # C: commutative bare callbacks
    def c(m):
        cb=m.group(1)
        if cb in COMMUTATIVE:
            stats['comm_bare']+=1
            return '(fold '+cb
        else:
            # defer: record short context
            i=m.start()
            defer.append((os.path.basename(fname), cb, txt[i:i+70].replace('\\n',' ')))
            return m.group(0)
    txt = re.sub(r'\(fold-left'+WS+r'([^\s()\\]+)', c, txt)
    return txt
for f in sorted(glob.glob('scheme/reference/*.slat')):
    if '_archive' in f: continue
    orig=open(f).read()
    new=transform(orig, f)
    if APPLY and new!=orig:
        open(f,'w').write(new)
print("STATS:", stats)
print(f"\nDEFERRED (need judgment): {len(defer)}")
seen={}
for fn,cb,ctx in defer:
    seen.setdefault(cb,[]).append((fn,ctx))
for cb,items in sorted(seen.items(), key=lambda x:-len(x[1])):
    print(f"\n  callback `{cb}`  ×{len(items)}")
    for fn,ctx in items[:3]:
        print(f"      {fn}: {ctx}")
