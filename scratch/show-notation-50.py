import re, sys, json
from pathlib import Path
sys.path.insert(0, str(Path('/Users/alfred/code/motoi-scheme/scratch')))
import importlib.util
spec = importlib.util.spec_from_file_location("drv", "/Users/alfred/code/motoi-scheme/scratch/ref-fill-driver.py")
drv = importlib.util.module_from_spec(spec); spec.loader.exec_module(drv)
REF = Path('/Users/alfred/code/motoi-scheme/scheme/reference')

# target (file, verb) pairs
TARGETS = {
 '03-alg.slat': ['alg/direct-product','alg/group-from-table','alg/identity','alg/is-isomorphic?','alg/pcset','alg/perm-conjugate','alg/subgroup?','alg/zn-mul'],
 '12-char.slat': ['char-alphabetic?','char-lower-case?','char-numeric?','char-upper-case?','char-whitespace?','char<=?','char<?','char=?','char>=?','char>?'],
 '15-comb.slat': ['comb/bell'],
 '17-complex.slat': ['complex/=','complex/from-polar'],
 '18-const.slat': ['const/e','const/sqrt3'],
 '30-grid.slat': ['grid/clear','grid/dot','grid/flower-clear!','grid/flower-state!','grid/glow'],
 '38-linalg.slat': ['linalg/eigenvectors','linalg/is-symmetric?','linalg/qr'],
 '41-matrix.slat': ['matrix/-','matrix/multiply','matrix/sub','matrix/transpose'],
 '56-seq.slat': ['seq/arithmetic','seq/fibonacci','seq/geometric','seq/geometric-sum','seq/partial-sums'],
 '61-sym.slat': ['sym/->string'],
 '66-time.slat': ['time/across','time/then'],
 '69-vec.slat': ['vec/cross','vec/scale','vec/sub'],
 '72-world.slat': ['world/attract!'],
}

CODE_KEYS=('code','eng-program','math-program','cs-program','program',
           'eng-composition','math-composition','cs-composition','composition')

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

NONASCII=re.compile(r'[^\x00-\x7f]')
def has_math(s):
    return bool(NONASCII.search(s)) or '↦' in s

for fname, verbs in TARGETS.items():
    text=(REF/fname).read_text()
    forms=drv.extract_verb_forms(text)
    for form in forms:
        m=re.search(r':name\s+"([^"]+)"', form)
        if not m: continue
        name=m.group(1)
        if name not in verbs: continue
        # collect all code-key literals in order
        lits=[]
        for km in re.finditer(r':(' + '|'.join(CODE_KEYS) + r')\s+"', form):
            key=km.group(1); qpos=form.index('"', km.end()-1)
            val,_=read_lit(form, qpos)
            lits.append((key,val))
        print("="*70)
        print(f"FILE {fname}  VERB {name}")
        for i,(key,val) in enumerate(lits):
            flag = "  <<<NOTATION" if has_math(val) else ""
            oneline = val.replace('\n','\\n')
            print(f"  [{i}] :{key}{flag}")
            print(f"       {oneline[:200]}")
