import json, subprocess, os, tempfile
NAMES = "caar cdar caaar caadr cadar cdaar cdadr cddar cdddr caaaar caaadr caadar caaddr cadaar cadadr caddar cadddr cdaaar cdaadr cdadar cdaddr cddaar cddadr cdddar cddddr".split()
def ops(n): return list(reversed(n[1:-1]))
def segments(o):
    segs=[0]
    for c in o:
        if c=='d': segs[-1]+=1
        else: segs.append(0)
    return segs           # len == num_a + 1
class C:
    def __init__(s): s.n=0
    def next(s): s.n+=1; return s.n
def render(o):
    return "("+" ".join(render(x) for x in o)+")" if isinstance(o,list) else str(o)
def build(name):
    segs=segments(ops(name)); ctr=C()
    def leaf(trail):
        if trail==0: return ctr.next()
        return [ctr.next() for _ in range(trail+2)]
    def sib(i):
        # a structurally similar sibling for level i
        return make(i, sibling=True)
    def make(i, sibling=False):
        if i==len(segs)-1: return leaf(segs[-1])
        k=segs[i]
        out=[]
        for _ in range(k): out.append(make(i+1, True))
        out.append(make(i+1))
        out.append(make(i+1, True))
        return out
    return render(make(0))
data={}
for n in NAMES:
    o=ops(n)
    data[n]={"letters":n[1:-1],"ops":o,"depth":len(o),
             "expansion":"".join(f"(c{c}r " for c in n[1:-1])+"x"+")"*len(o),
             "result_is_tail": n[1]=='d', "all_d": set(n[1:-1])=={'d'},
             "input":build(n)}
json.dump(data,open('/tmp/cxr-data.json','w'),indent=1)
# emit a probe program
lines=[]
for n,d in data.items():
    lines.append(f"(display (list '{n} ({n} '{d['input']})))")
    lines.append("(newline)")
open('/Users/alfred/code/motoi-scheme/scratch/zain/cxr4.scm','w').write("\n".join(lines)+"\n")
print(json.dumps({k:v['input'] for k,v in data.items()},indent=0))
