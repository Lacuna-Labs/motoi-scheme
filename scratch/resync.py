import re, os
os.chdir('/Users/alfred/code/motoi-scheme')
BOOK='scheme-books/book-of-music'
PRE=open('scratch/FINAL-preamble.scm').read().split('(display (as-freq')[0].rstrip()
def esc(s): return s.replace('\\','\\\\').replace('"','\\"')
ESC=esc(PRE)
# match the fenced code block right after the waves-foundation marker
# in-file it looks like: <!-- waves-foundation -->\n```scheme\n...code...\n```
pat=re.compile(r'(<!-- waves-foundation -->\n```scheme\n).*?(\n```)', re.S)
n=0
for fn in sorted(os.listdir(BOOK)):
    if not fn.endswith('.book.slatl'): continue
    p=os.path.join(BOOK,fn); txt=open(p,encoding='utf-8').read()
    if '<!-- waves-foundation -->' not in txt: continue
    new,cnt=pat.subn(lambda m: m.group(1)+ESC+m.group(2), txt)
    if cnt:
        open(p,'w',encoding='utf-8').write(new); n+=1
        print(f"{fn}: resynced foundation")
print("resynced files:",n)
