#!/usr/bin/env python3
"""Transform r1-draft render blocks: (world (entity 'N (placement A B) (shapes ...)) ...)
   -> return the placement coords as vecs. Preserves ALL position math.
   Operates only on ```scheme blocks that contain '(placement'. Prints new file to stdout
   unless --write given.

Strategy: within a scheme block, find each top-level `(entity ... (placement X Y) (shapes ...))`
form via paren matching, extract the (placement X Y) subexpr, and collect them. Then rebuild
the block as: keep all `(define (name ...) ... )` wrappers but replace the (world ...) call
with (list vec ...). Because structure is regular, we do a scoped rewrite:
  - replace '(placement ' -> '(PLACEMENT_MARK '
  - remove '(shapes ...)' subtrees
  - replace '(world' -> '(list' and '(entity ...tag...' with nothing, keeping placements.
This is fiddly; instead we take a simpler robust route: parse each block's s-expressions,
and for any `world` form, return list of its entities' placement coordinate pairs.
"""
import re, sys

ROOT="/Users/alfred/code/motoi-scheme"
PATH=ROOT+"/scheme-books/book-of-motion/ch02-velocity.book.slatl"

def sexp_read(s, i):
    """Read one s-expression starting at index i (s[i]=='('). Return (tokens_tree, next_i).
       Very small reader: returns nested lists of strings for atoms."""
    assert s[i]=='('
    i+=1
    out=[]
    while i < len(s):
        c=s[i]
        if c.isspace(): i+=1; continue
        if c==';':  # comment to EOL
            j=s.find('\n', i)
            if j<0: j=len(s)
            i=j; continue
        if c=='(':
            sub,i=sexp_read(s,i); out.append(sub); continue
        if c==')':
            return out, i+1
        if c=='"':
            j=i+1
            while j<len(s) and s[j]!='"':
                if s[j]=='\\': j+=1
                j+=1
            out.append(s[i:j+1]); i=j+1; continue
        # atom
        j=i
        while j<len(s) and (not s[j].isspace()) and s[j] not in '();':
            j+=1
        out.append(s[i:j]); i=j
    return out, i

def find_placements(tree):
    """Recursively find (placement X Y) forms; return list of (Xsrc, Ysrc) source strings."""
    res=[]
    if isinstance(tree, list):
        if tree and tree[0]=='placement' and len(tree)>=3:
            res.append((unparse(tree[1]), unparse(tree[2])))
        else:
            for el in tree:
                res.extend(find_placements(el))
    return res

def unparse(t):
    if isinstance(t,str): return t
    return "("+" ".join(unparse(x) for x in t)+")"

def transform_block(code):
    if '(placement' not in code: return code, False
    # We only transform blocks whose render body is a (world ...) or (define ... (world ...)).
    # Approach: replace each top-level (world ...) form with (list <vec for each placement>).
    out=[]
    i=0
    changed=False
    # find 'call at end' patterns like (route 0.5) we may keep, but simplest: rebuild whole block
    # Tokenize into top-level forms
    forms=[]
    j=0
    n=len(code)
    while j<n:
        c=code[j]
        if c.isspace(): j+=1; continue
        if c==';':
            k=code.find('\n',j);
            if k<0:k=n
            forms.append(('comment',code[j:k])); j=k; continue
        if c=='(':
            tree,j2=sexp_read(code,j)
            forms.append(('form',tree,code[j:j2])); j=j2; continue
        j+=1
    def conv_world(tree):
        """If tree is a world form, return replacement source string, else None."""
        pls=find_placements(tree)
        if not pls: return None
        vecs=["(vec/make %s %s)"%(x,y) for (x,y) in pls]
        if len(vecs)==1: return vecs[0]
        return "(list "+" ".join(vecs)+")"
    def rebuild(tree):
        """Rebuild a form tree, replacing inner (world ...) with vec-list."""
        if not isinstance(tree,list): return unparse(tree)
        if tree and tree[0]=='world':
            r=conv_world(tree)
            if r is not None:
                nonlocal changed; changed=True
                return r
        # define with body containing world
        return "("+" ".join(rebuild(x) for x in tree)+")"
    newparts=[]
    for f in forms:
        if f[0]=='comment': newparts.append(f[1])
        else:
            tree=f[1]
            # direct world form (not inside define)
            if tree and tree[0]=='world':
                r=conv_world(tree)
                if r is not None: changed=True; newparts.append(r); continue
            newparts.append(rebuild(tree))
    newcode="\n".join(newparts)
    if not newcode.endswith("\n"): newcode+="\n"
    return newcode, changed

if __name__=="__main__":
    # dry-run test on first placement block
    import re as _re
    text=open(PATH).read()
    blocks=list(_re.finditer(r"```scheme\n(.*?)```", text, _re.DOTALL))
    cnt=0
    for m in blocks:
        code=m.group(1).replace('\\"','"')
        if '(placement' in code:
            new,ch=transform_block(code)
            if ch:
                cnt+=1
                if cnt<=3:
                    print("=== ORIG ==="); print(code)
                    print("=== NEW ==="); print(new); print()
    print("placement blocks transformed:", cnt)
