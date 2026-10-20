import re, os, sys
os.chdir('/Users/alfred/code/motoi-scheme')
BOOK='scheme-books/book-of-music'
MARK='<!-- needs-alfred: world/knowledge + motoi/say are Curator knowledge-graph / persona verbs with no Motoi substrate; music-theory prose kept, the style-atom lookup and spoken aside are deferred -->'
files=['appendix-drill-15-form-structure.book.slatl','appendix-drill-11-world-percussion.book.slatl',
       'appendix-drill-14-orchestration.book.slatl','ch04-melody.book.slatl','ch06-harmony.book.slatl']
for fn in files:
    p=os.path.join(BOOK,fn)
    lines=open(p,encoding='utf-8').read().split('\n')
    out=[]; i=0; added=0
    while i<len(lines):
        if lines[i].strip()=='```scheme':
            # find block end
            j=i+1
            while j<len(lines) and lines[j].strip()!='```': j+=1
            block='\n'.join(lines[i+1:j])
            if 'world/knowledge' in block and MARK not in (out[-1] if out else ''):
                out.append(MARK)
                added+=1
        out.append(lines[i]); i+=1
    open(p,'w',encoding='utf-8').write('\n'.join(out))
    print(f"{fn}: added {added} needs-alfred markers")
