import json, re
failing=json.load(open('/Users/alfred/code/motoi-scheme/scratch/rung-notation-failing.json'))

# math glyphs that only appear in true notation (not valid scheme tokens)
GLYPHS=set('×≅→↦∅∏∘⇀√⊆⊂⊄⇔⇒≡∈∉∀∃∧∨·−ᵀ⁻ⁿ∫≠∼≈∇⊗⊕∂ℝℤℕℚℂ∞')

def strip_comments_strings(code):
    out=[]; i=0; n=len(code); instr=False
    while i<n:
        c=code[i]
        if instr:
            if c=='\\': i+=2; continue
            if c=='"': instr=False
            i+=1; continue
        if c=='"': instr=True; i+=1; continue
        if c==';':
            while i<n and code[i]!='\n': i+=1
            continue
        out.append(c); i+=1
    return ''.join(out)

notation=[]
for e in failing:
    body=strip_comments_strings(e['code'])
    if any(g in body for g in GLYPHS):
        notation.append(e)

print(f"NOTATION defects (glyph outside comment/string): {len(notation)}")
by_file={}
for e in notation:
    by_file.setdefault(e['file'],[]).append(e)
for f in sorted(by_file):
    print(f"\n### {f}  ({len(by_file[f])})")
    for e in by_file[f]:
        print(f"   [{e['domain'][:44]:44}]  {e['code']!r}")
json.dump(notation,open('/Users/alfred/code/motoi-scheme/scratch/notation-defects.json','w'),indent=1)
