import re, os
os.chdir('/Users/alfred/code/motoi-scheme')
BOOK='scheme-books/book-of-music'
MARK='<!-- needs-alfred: Curator-16 sprite substrate not in Motoi; music-theory prose kept, visual rendering deferred -->'
# a BUILD directive counts as sprite/render if it mentions any of these
SPRITE=re.compile(r'(sprite|glyph|dot.?matrix|Curator-16|note-value|blossom|animat|'
                  r'render[^>]*(staff|staves|grid|waveform|diagram|spectrum|stave|clef|barline|notehead|circle))',re.I)
# match a whole BUILD directive comment, optionally wrapped in backticks
DIR=re.compile(r'`?<!--\s*BUILD:.*?-->`?', re.S)
total={}
for fn in sorted(os.listdir(BOOK)):
    if not fn.endswith('.book.slatl'): continue
    p=os.path.join(BOOK,fn)
    txt=open(p,encoding='utf-8').read()
    n=[0]
    def repl(m):
        s=m.group(0)
        if SPRITE.search(s):
            n[0]+=1
            return MARK
        return s
    new=DIR.sub(repl,txt)
    if n[0]:
        open(p,'w',encoding='utf-8').write(new)
        total[fn]=n[0]
for fn,c in total.items(): print(f"{fn}: {c} sprite BUILD -> needs-alfred")
print("TOTAL sprite markers:", sum(total.values()))
